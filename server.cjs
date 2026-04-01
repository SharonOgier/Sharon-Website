require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { Resend } = require("resend");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").trim();
const supabaseServiceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;
const app = express();
const PORT = Number(process.env.PORT || 10000);

const distPath = path.join(__dirname, "dist");
const distIndexPath = path.join(distPath, "index.html");
const publicPath = path.join(__dirname, "public");
const landingPath = path.join(publicPath, "landing.html");

const rawCorsOrigins = [
  process.env.CLIENT_URL,
  process.env.VITE_API_BASE_URL,
  ...(String(process.env.EXTRA_CORS_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

const CLIENT_URLS = [...new Set(rawCorsOrigins.filter(Boolean))];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || CLIENT_URLS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "stripe-signature", "x-api-key"],
  credentials: true,
};

app.use("/api", cors(corsOptions));
app.options("/api/*", cors(corsOptions));
app.use("/api", (req, _res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.originalUrl}`);
  next();
});

const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
const EMAIL_FROM = String(
  process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
).trim();
const EMAIL_REPLY_TO = String(process.env.EMAIL_REPLY_TO || "").trim();

const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
app.use("/api/stripe-webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    console.error("[JSON PARSE ERROR]", err.message);
    return res.status(400).json({ ok: false, error: "Invalid JSON in request body." });
  }
  next(err);
});
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (fs.existsSync(distPath)) {
  app.use(
    express.static(distPath, {
      index: false,
      extensions: false,
      fallthrough: true,
    })
  );
}

if (fs.existsSync(publicPath)) {
  app.use(
    express.static(publicPath, {
      index: false,
      extensions: false,
      fallthrough: true,
    })
  );
}

const rateLimitStore = new Map();

function rateLimit({ windowMs = 60000, max = 20, keyFn } = {}) {
  return function rateLimitMiddleware(req, res, next) {
    const key = (keyFn ? keyFn(req) : null) || req.ip || "unknown";
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", retryAfter);
      return res.status(429).json({ ok: false, error: "Too many requests — please slow down and try again shortly." });
    }

    entry.count += 1;
    return next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60_000);

// ── Security headers ───────────────────────────────────────────
app.use("/api/", (req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("X-XSS-Protection", "1; mode=block");
  next();
});

// ── General API: 60 requests per minute per IP ────────────────
app.use("/api/", rateLimit({ windowMs: 60_000, max: 60 }));

// ── Email endpoints: max 5 per 10 minutes per IP ──────────────
const emailRateLimit = rateLimit({ windowMs: 10 * 60_000, max: 5 });
app.use("/api/send-document-email", emailRateLimit);
app.use("/api/send-invoice-attachment-email", emailRateLimit);

// ── Stripe checkout: max 10 per 10 minutes per IP ─────────────
const stripeRateLimit = rateLimit({ windowMs: 10 * 60_000, max: 10 });
app.use("/api/create-checkout-session", stripeRateLimit);
app.use("/api/create-subscription-checkout", stripeRateLimit);

// ── PDF generation: max 20 per minute per IP ─────────────────
app.use("/api/test-pdf", rateLimit({ windowMs: 60_000, max: 20 }));

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyToCents(amount) {
  return Math.max(0, Math.round(safeNumber(amount) * 100));
}

function normaliseRecipients(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function isSafeHttpsUrl(value) {
  try {
    const u = new URL(String(value || ""));
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return true;
    return false;
  } catch {
    return false;
  }
}

function fileExists(pathValue) {
  try {
    return Boolean(pathValue) && fs.existsSync(pathValue);
  } catch {
    return false;
  }
}

function findChromeInDirectory(rootDir) {
  if (!fileExists(rootDir)) return null;

  const queue = [rootDir];
  const names = new Set(["chrome", "chrome.exe", "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]);

  while (queue.length) {
    const current = queue.shift();
    let entries = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_error) {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && names.has(entry.name)) {
        return fullPath;
      }
    }
  }

  return null;
}


async function resolveChromiumExecutablePath() {
  const envCandidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.GOOGLE_CHROME_BIN,
    process.env.CHROME_BIN,
    process.env.CHROMIUM_PATH,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of envCandidates) {
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  const bundledPath = await chromium.executablePath();
  if (fileExists(bundledPath)) {
    return bundledPath;
  }

  throw new Error(
    "Chromium executable could not be resolved. Set PUPPETEER_EXECUTABLE_PATH or install @sparticuz/chromium correctly."
  );
}

async function getBrowserDiagnostics() {
  const envPaths = {
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    GOOGLE_CHROME_BIN: process.env.GOOGLE_CHROME_BIN || null,
    CHROME_BIN: process.env.CHROME_BIN || null,
    CHROMIUM_PATH: process.env.CHROMIUM_PATH || null,
  };

  let bundledChromiumPath = null;
  let resolvedExecutablePath = null;
  let resolutionError = null;

  try {
    bundledChromiumPath = await chromium.executablePath();
  } catch (error) {
    resolutionError = error?.message || String(error);
  }

  const candidateOrder = [
    { source: "PUPPETEER_EXECUTABLE_PATH", path: envPaths.PUPPETEER_EXECUTABLE_PATH },
    { source: "GOOGLE_CHROME_BIN", path: envPaths.GOOGLE_CHROME_BIN },
    { source: "CHROME_BIN", path: envPaths.CHROME_BIN },
    { source: "CHROMIUM_PATH", path: envPaths.CHROMIUM_PATH },
    { source: "@sparticuz/chromium", path: bundledChromiumPath },
    { source: "system google-chrome", path: "/usr/bin/google-chrome-stable" },
    { source: "system chromium-browser", path: "/usr/bin/chromium-browser" },
    { source: "system chromium", path: "/usr/bin/chromium" },
  ];

  const candidates = candidateOrder.map((item) => ({
    source: item.source,
    path: item.path || null,
    exists: fileExists(item.path),
  }));

  try {
    resolvedExecutablePath = await resolveChromiumExecutablePath();
  } catch (error) {
    resolutionError = resolutionError || error?.message || String(error);
  }

  return {
    env: envPaths,
    chromiumHeadless: chromium.headless,
    chromiumArgsCount: Array.isArray(chromium.args) ? chromium.args.length : 0,
    bundledChromiumPath,
    candidates,
    launchExecutablePath: resolvedExecutablePath,
    resolutionError,
  };
}

function buildFallbackDocumentHtml(payload = {}) {
  const documentType = String(payload.documentType || "invoice").toLowerCase().trim();
  const isQuote = documentType === "quote";
  const businessName = payload.businessName || "Your Business";
  const clientName = payload.clientName || payload.customerName || "Client";
  const documentNumber =
    payload.number ||
    (isQuote ? payload.quoteNumber : payload.invoiceNumber) ||
    (isQuote ? "Quote" : "Invoice");
  const message = payload.message || `Please find your ${isQuote ? "quote" : "invoice"} attached.`;
  const stripeCheckoutUrl = String(payload.stripeCheckoutUrl || "").trim();
  const safeCheckoutUrl = !isQuote && isSafeHttpsUrl(stripeCheckoutUrl) ? stripeCheckoutUrl : "";
  const title = isQuote ? "Quote" : "Invoice";
  const numberLabel = isQuote ? "Quote No:" : "Invoice No:";
  const clientLabel = isQuote ? "Prepared For:" : "Billed To:";
  const actionLabel = isQuote ? "View quote" : "Pay invoice";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; padding: 32px; font-size: 14px; line-height: 1.5; }
    .card { border: 1px solid #d1d5db; border-radius: 14px; padding: 28px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 24px; }
    .title { font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: #6A1B9A; }
    .meta { color: #475569; margin: 3px 0; }
    .section-title { margin-top: 20px; margin-bottom: 8px; font-weight: 700; color: #006D6D; }
    .pay-link { display: inline-block; margin-top: 18px; padding: 12px 18px; background: #6A1B9A; color: #fff !important; text-decoration: none; border-radius: 10px; font-weight: 700; }
    .footer { margin-top: 28px; color: #64748B; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1 class="title">${title}</h1>
        <div class="meta"><strong>Business:</strong> ${escapeHtml(businessName)}</div>
        <div class="meta"><strong>${numberLabel}</strong> ${escapeHtml(documentNumber)}</div>
      </div>
      <div>
        <div class="meta"><strong>${clientLabel}</strong> ${escapeHtml(clientName)}</div>
      </div>
    </div>

    <div class="section-title">Message</div>
    <div>${escapeHtml(message)}</div>

    ${safeCheckoutUrl ? `<a class="pay-link" href="${escapeHtml(
      safeCheckoutUrl
    )}" target="_blank" rel="noreferrer">${actionLabel}</a>` : ""}

    <div class="footer">Generated by ${escapeHtml(businessName)}.</div>
  </div>
</body>
</html>`;
}


function ensureRenderableHtmlDocument(html) {
  const raw = String(html || "").trim();
  if (!raw) return "";

  const hasHtmlTag = /<html[\s>]/i.test(raw);
  if (hasHtmlTag) return raw;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @page { size: A4; margin: 20px; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; }
    body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>${raw}</body>
</html>`;
}

async function generatePdfFromHtml(html) {
  const renderableHtml = ensureRenderableHtmlDocument(html);
  const trimmedHtml = String(renderableHtml || "").trim();

  if (!trimmedHtml) {
    throw new Error("No HTML provided for PDF generation.");
  }

  const executablePath = await chromium.executablePath();

  const launchOptions = {
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: true,
  };

  let browser;
  let page;

  try {
    console.log("PDF HTML length:", trimmedHtml.length);

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 2000, deviceScaleFactor: 1 });
    await page.setJavaScriptEnabled(true);
    await page.setContent(trimmedHtml, { waitUntil: ["domcontentloaded", "networkidle0"], timeout: 45000 });

    try {
      await page.evaluate(async () => {
        const waitForImages = Array.from(document.images || []).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        });
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready.catch(() => {});
        }
        await Promise.all(waitForImages);
      });
    } catch (_error) {}

    await page.emulateMediaType("screen");

    const pageText = await page.evaluate(() => (document.body?.innerText || "").trim());
    const bodyHtmlLength = await page.evaluate(() => document.body?.innerHTML?.trim()?.length || 0);

    console.log("PDF render check:", {
      pageTextLength: pageText.length,
      bodyHtmlLength,
      startsWith: pageText.slice(0, 120),
    });

    if (!bodyHtmlLength) {
      throw new Error("Rendered HTML body was empty.");
    }

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    });

    return pdfBuffer;
  } finally {
    try {
      if (page) await page.close();
    } catch (_error) {}
    try {
      if (browser) await browser.close();
    } catch (_error) {}
  }
}

function normaliseBase64Attachment(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^data:application\/pdf;base64,(.+)$/i);
  return (match ? match[1] : raw).replace(/\s+/g, "");
}

async function sendEmailHtml({
  to,
  subject,
  emailHtml,
  emailText,
  replyTo,
}) {
  if (!resend) throw new Error("RESEND_API_KEY is missing in environment variables.");

  const recipients = normaliseRecipients(to);
  if (!recipients.length) throw new Error("Recipient email is required.");

  const resolvedHtml = String(emailHtml || "<p>Please see your document below.</p>").trim();
  if (!resolvedHtml) throw new Error("Email HTML is required.");

  const payload = {
    from: EMAIL_FROM,
    to: recipients,
    subject: String(subject || "Your document").trim() || "Your document",
    html: resolvedHtml,
  };

  const resolvedReplyTo = String(replyTo || EMAIL_REPLY_TO || "").trim();
  if (resolvedReplyTo) {
    payload.replyTo = resolvedReplyTo;
    payload.reply_to = resolvedReplyTo;
  }
  if (emailText) payload.text = String(emailText).trim();

  console.log("sendEmailHtml payload summary:", {
    to: recipients,
    subject: payload.subject,
    hasHtml: Boolean(payload.html),
    htmlLength: payload.html.length,
    hasText: Boolean(payload.text),
    hasReplyTo: Boolean(resolvedReplyTo),
  });

  const sendResult = await resend.emails.send(payload);
  if (sendResult?.error) {
    console.error("Resend API error:", JSON.stringify(sendResult.error, null, 2));
    throw new Error(sendResult.error.message || sendResult.error.name || "Resend email send failed.");
  }
  console.log("Resend send result:", JSON.stringify({ id: sendResult?.data?.id, error: sendResult?.error }, null, 2));

  return {
    ...(sendResult || {}),
    attachmentIncluded: false,
    attachmentSource: "none",
    pdfError: null,
  };
}

async function sendEmailWithPdf({
  to,
  subject,
  htmlForPdf,
  emailHtml,
  emailText,
  filename,
  replyTo,
  fallbackPdfPayload,
  attachmentBase64,
}) {
  if (!resend) throw new Error("RESEND_API_KEY is missing in environment variables.");

  const recipients = normaliseRecipients(to);
  if (!recipients.length) throw new Error("Recipient email is required.");

  const normalisedHtml = String(htmlForPdf || "").trim();
  const resolvedHtml = normalisedHtml || buildFallbackDocumentHtml(fallbackPdfPayload || {});

  let pdfBuffer = null;
  let attachmentSource = "none";
  let pdfError = null;

  try {
    pdfBuffer = await generatePdfFromHtml(resolvedHtml);
    attachmentSource = "server";
  } catch (error) {
    pdfError = error;
    console.warn("Server PDF generation failed. Sending email without attachment.", error);
  }

  const payload = {
    from: EMAIL_FROM,
    to: recipients,
    subject: subject || "Your document",
    html: emailHtml || "<p>Please find your PDF attached.</p>",
  };

  if (pdfBuffer && Buffer.isBuffer(pdfBuffer)) {
    const pdfHeader = pdfBuffer.slice(0, 5).toString();
    console.log("PDF check", {
      isBuffer: Buffer.isBuffer(pdfBuffer),
      length: pdfBuffer?.length,
      header: pdfHeader,
      filename: filename || "document.pdf",
      attachmentSource,
    });

    const debugPdfPath = path.join(process.cwd(), "debug-last-pdf.pdf");
    try {
      fs.writeFileSync(debugPdfPath, pdfBuffer);
      console.log("Saved debug PDF copy:", debugPdfPath);
    } catch (debugWriteError) {
      console.warn("Could not save debug PDF copy:", debugWriteError?.message || debugWriteError);
    }

    if (pdfHeader === "%PDF-") {
      payload.attachments = [
        {
          filename: filename || "document.pdf",
          content: pdfBuffer.toString("base64"),
          content_type: "application/pdf",
        },
      ];
    } else {
      pdfError = new Error(`Generated file is not a valid PDF. Header received: ${pdfHeader}`);
      console.warn(pdfError.message);
    }
  }

  const resolvedReplyTo = String(replyTo || EMAIL_REPLY_TO || "").trim();
  if (resolvedReplyTo) payload.replyTo = resolvedReplyTo;
  if (emailText) payload.text = emailText;

  const sendResult = await resend.emails.send(payload);
  return {
    ...sendResult,
    attachmentIncluded: Array.isArray(payload.attachments) && payload.attachments.length > 0,
    attachmentSource,
    pdfError: pdfError ? (pdfError.message || String(pdfError)) : null,
  };
}

app.get("/", (req, res) => {
  const bypass = req.query.portal || req.query.signin || req.query.app;
  if (!bypass && fs.existsSync(landingPath)) {
    return res.sendFile(landingPath);
  }
  if (fs.existsSync(distIndexPath)) {
    return res.sendFile(distIndexPath);
  }
  return res.json({ ok: true, message: `Server running on port ${PORT}` });
});

app.get("/portal", (_req, res) => {
  if (fs.existsSync(distIndexPath)) return res.sendFile(distIndexPath);
  return res.redirect("/");
});

app.get("/app", (_req, res) => {
  if (fs.existsSync(distIndexPath)) return res.sendFile(distIndexPath);
  return res.redirect("/");
});

app.get("/health", async (_req, res) => {
  const browserDiagnostics = await getBrowserDiagnostics();
  res.json({
    ok: true,
    message: `Server running on port ${PORT}`,
    resendConfigured: !!resendApiKey,
    stripeConfigured: !!stripeSecretKey,
    chromeExecutable: browserDiagnostics.launchExecutablePath,
    browser: browserDiagnostics,
    paths: {
      __dirname,
      distPath,
      distExists: fs.existsSync(distPath),
      distIndexExists: fs.existsSync(distIndexPath),
      publicPath,
      publicExists: fs.existsSync(publicPath),
      landingPath,
      landingExists: fs.existsSync(landingPath),
    },
  });
});

app.get("/api/debug-browser", async (_req, res) => {
  try {
    return res.json({ ok: true, diagnostics: await getBrowserDiagnostics() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/test-pdf", async (_req, res) => {
  try {
    const sampleHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PDF Test</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
    .box { border: 1px solid #ccc; border-radius: 12px; padding: 24px; }
    h1 { margin-top: 0; color: #6A1B9A; }
  </style>
</head>
<body>
  <div class="box">
    <h1>PDF Test Successful</h1>
    <p>If you can see this PDF, Puppeteer is working on the server.</p>
  </div>
</body>
</html>`;
    const pdfBuffer = await generatePdfFromHtml(sampleHtml);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="test.pdf"');
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF test failed:", error);
    return res.status(500).json({
      ok: false,
      error: "PDF test failed.",
      details: error.message,
      stack: error.stack,
      browser: await getBrowserDiagnostics(),
    });
  }
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "Stripe is not configured." });
    }

    const {
      invoiceId,
      invoiceNumber,
      customerName,
      customerEmail,
      description,
      currency,
      amount,
      total,
      totalAmount,
      invoiceTotal,
      grandTotal,
      successUrl,
      cancelUrl,
    } = req.body || {};

    const rawAmount =
      amount ??
      total ??
      totalAmount ??
      invoiceTotal ??
      grandTotal ??
      0;

    const resolvedAmount = moneyToCents(rawAmount);

    console.log("create-checkout-session amount debug:", {
      amount,
      total,
      totalAmount,
      invoiceTotal,
      grandTotal,
      rawAmount,
      resolvedAmount,
    });

    if (!resolvedAmount || resolvedAmount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Invoice amount is required and must be greater than zero.",
        received: {
          amount,
          total,
          totalAmount,
          invoiceTotal,
          grandTotal,
          rawAmount,
          resolvedAmount,
        },
      });
    }

    const requestOrigin = String(req.headers.origin || "").trim();
    const fallbackBaseUrl =
      (requestOrigin && isSafeHttpsUrl(requestOrigin) && requestOrigin) ||
      CLIENT_URLS.find((url) => isSafeHttpsUrl(url)) ||
      "http://localhost:5173";

    const resolvedSuccessUrl = String(
      successUrl || `${fallbackBaseUrl}?stripe=success&invoice=${encodeURIComponent(String(invoiceNumber || ""))}&invoiceId=${encodeURIComponent(String(invoiceId || ""))}`
    ).trim();

    const resolvedCancelUrl = String(
      cancelUrl || `${fallbackBaseUrl}?stripe=cancel&invoice=${encodeURIComponent(String(invoiceNumber || ""))}&invoiceId=${encodeURIComponent(String(invoiceId || ""))}`
    ).trim();

    if (!isSafeHttpsUrl(resolvedSuccessUrl) || !isSafeHttpsUrl(resolvedCancelUrl)) {
      return res.status(400).json({
        ok: false,
        error: "Redirect URLs must use https, or http for localhost.",
        received: {
          successUrl,
          cancelUrl,
          resolvedSuccessUrl,
          resolvedCancelUrl,
          requestOrigin,
        },
      });
    }

    const resolvedCurrency = String(currency || "aud").toLowerCase();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: String(customerEmail || "").trim() || undefined,
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: resolvedCurrency,
            unit_amount: resolvedAmount,
            product_data: {
              name: description || `Invoice ${invoiceNumber || invoiceId || ""}`.trim(),
              metadata: {
                invoiceId: String(invoiceId || ""),
                invoiceNumber: String(invoiceNumber || ""),
                customerName: String(customerName || ""),
              },
            },
          },
        },
      ],
      metadata: {
        invoiceId: String(invoiceId || ""),
        invoiceNumber: String(invoiceNumber || ""),
        customerName: String(customerName || ""),
        customerEmail: String(customerEmail || ""),
      },
    });

    return res.json({
      ok: true,
      id: session.id,
      url: session.url,
      resolvedSuccessUrl,
      resolvedCancelUrl,
    });
  } catch (error) {
    console.error("Stripe checkout session failed:", error);
    return res.status(500).json({
      ok: false,
      error: "Stripe checkout failed.",
      details: error.message,
    });
  }
});

app.post("/api/send-document-email", async (req, res) => {
  console.log("[EMAIL] Route hit, body size:", JSON.stringify(req.body || {}).length, "keys:", Object.keys(req.body || {}));
  try {
    const payload = req.body || {};
    const {
      to,
      subject,
      html,
      quoteHtml,
      invoiceHtml,
      text,
      documentType,
      replyTo,
      invoiceNumber,
      quoteNumber,
      number,
      documentHtml,
    } = payload;

    const recipients = normaliseRecipients(to || payload.recipients);
    if (!recipients.length) {
      return res.status(400).json({ ok: false, error: "Recipient email is required." });
    }

    const safeDocumentType = String(documentType || "document").toLowerCase().trim() || "document";
    const primaryHtml = String(
      safeDocumentType === "quote"
        ? (quoteHtml || documentHtml || html || "")
        : safeDocumentType === "invoice"
          ? (invoiceHtml || documentHtml || html || "")
          : (documentHtml || html || "")
    ).trim();

    if (!primaryHtml) {
      return res.status(400).json({
        ok: false,
        error: `Missing ${safeDocumentType} HTML for email body.`,
      });
    }

    const resolvedNumber = String(number || (safeDocumentType === "quote" ? quoteNumber : invoiceNumber) || "").trim();
    const resolvedSubject = String(subject || `${safeDocumentType === "invoice" ? "Invoice" : safeDocumentType === "quote" ? "Quote" : "Document"}${resolvedNumber ? ` ${resolvedNumber}` : ""}`).trim();

    console.log("send-document-email payload summary:", {
      documentType: safeDocumentType,
      recipients,
      subject: resolvedSubject,
      hasHtml: Boolean(primaryHtml),
      htmlLength: primaryHtml.length,
      number: resolvedNumber,
    });

    const emailResult = await sendEmailHtml({
      to: recipients,
      subject: resolvedSubject,
      emailHtml: primaryHtml,
      emailText: text || undefined,
      replyTo,
    });

    console.log("send-document-email success:", {
      documentType: safeDocumentType,
      recipients,
      number: resolvedNumber,
      id: emailResult?.data?.id || emailResult?.id || null,
    });

    return res.json({
      ok: true,
      message: `${safeDocumentType} email sent successfully.`,
      result: emailResult,
    });
  } catch (error) {
    console.error("Send document email failed:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to send document email.",
      details: error?.stack || null,
    });
  }
});

app.post("/api/send-invoice-attachment-email", async (req, res) => {
  try {
    const payload = req.body || {};
    const recipients = normaliseRecipients(payload.to || payload.recipients);
    const clientName = payload.clientName || payload.customerName || "Client";
    const invoiceNumber = payload.number || payload.invoiceNumber || "Invoice";

    console.log("send-invoice-attachment-email payload summary:", {
      recipients,
      invoiceNumber,
      hasInvoiceHtml: Boolean(String(payload.invoiceHtml || payload.documentHtml || payload.html || "").trim()),
    });

    const invoiceHtml = String(payload.invoiceHtml || payload.documentHtml || payload.html || "").trim();
    if (!invoiceHtml) {
      return res.status(400).json({ ok: false, error: "Invoice HTML is required for email body." });
    }

    const emailResult = await sendEmailHtml({
      to: recipients,
      subject: payload.subject || `Invoice ${invoiceNumber}`,
      emailHtml: invoiceHtml,
      emailText: payload.text || undefined,
      replyTo: payload.replyTo,
    });

    console.log("send-invoice-attachment-email success:", {
      recipients,
      invoiceNumber,
    });

    return res.json({
      ok: true,
      message: `Invoice emailed to ${recipients.join(", ")}`,
      result: emailResult,
    });
  } catch (error) {
    console.error("Email failed:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/create-subscription-checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "Stripe is not configured." });
    }

    const { email, userId, businessName, successUrl, cancelUrl } = req.body || {};

    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required." });
    }

    const priceId = String(process.env.STRIPE_SUBSCRIPTION_PRICE_ID || "").trim();
    if (!priceId) {
      return res.status(500).json({ ok: false, error: "STRIPE_SUBSCRIPTION_PRICE_ID is not set in environment variables." });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 0,
        metadata: { userId: String(userId || ""), businessName: String(businessName || "") },
      },
      metadata: { userId: String(userId || ""), type: "portal_subscription" },
      success_url: successUrl || `${req.headers.origin || ""}?subscribed=1`,
      cancel_url: cancelUrl || `${req.headers.origin || ""}?subscribed=0`,
    });

    return res.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("Subscription checkout failed:", error);
    return res.status(500).json({ ok: false, error: "Could not create subscription checkout.", details: error.message });
  }
});

app.post("/api/stripe-webhook", async (req, res) => {
  if (!stripe) return res.status(500).send("Stripe not configured.");

  const signature = req.headers["stripe-signature"];
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret) return res.status(400).send("Missing STRIPE_WEBHOOK_SECRET.");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const invoiceId = session?.metadata?.invoiceId || "";
      const subscriptionType = session?.metadata?.type || "";

      // ── Portal subscription checkout ──────────────────────
      if (subscriptionType === "portal_subscription" && supabase) {
        const userId = session?.metadata?.userId || "";
        const subscriptionId = session?.subscription || "";
        if (userId && subscriptionId) {
          try {
            const { data: rows } = await supabase
              .from("sas_profile")
              .select("id, data")
              .eq("user_id", userId)
              .limit(1);

            const row = rows?.[0];
            if (row) {
              const updatedData = {
                ...(row.data || {}),
                subscriptionStatus: "active",
                subscriptionId,
                stripeCustomerId: session.customer || "",
              };
              await supabase
                .from("sas_profile")
                .update({ data: updatedData, updated_at: new Date().toISOString() })
                .eq("id", row.id);
              console.log(`Portal subscription activated for userId: ${userId}`);
            }
          } catch (dbError) {
            console.error("Failed to update subscription status:", dbError);
          }
        }
      }

      // ── Invoice payment checkout ───────────────────────────
      if (invoiceId && supabase) {
        try {
          const { data: existing, error: fetchError } = await supabase
            .from("sas_invoices")
            .select("data")
            .eq("id", invoiceId)
            .single();

          if (fetchError) {
            console.error("Failed to fetch invoice from Supabase:", fetchError.message);
          } else if (existing) {
            const updatedData = {
              ...existing.data,
              status: "Paid",
              paidAt: new Date().toISOString(),
              paidVia: "Stripe",
            };
            const { error: updateError } = await supabase
              .from("sas_invoices")
              .update({ data: updatedData, updated_at: new Date().toISOString() })
              .eq("id", invoiceId);

            if (updateError) {
              console.error("Failed to update invoice status in Supabase:", updateError.message);
            }
          }
        } catch (dbError) {
          console.error("Supabase update error:", dbError);
        }
      }
    }

    // ── Subscription updated / cancelled ──────────────────────
    if (
      (event.type === "customer.subscription.updated" ||
       event.type === "customer.subscription.deleted") &&
      supabase
    ) {
      const subscription = event.data.object;
      const subscriptionId = subscription.id;
      const newStatus = subscription.status; // active | past_due | canceled | etc.

      try {
        // Find the profile row that has this subscriptionId in its data jsonb
        const { data: rows } = await supabase
          .from("sas_profile")
          .select("id, data")
          .filter("data->>'subscriptionId'", "eq", subscriptionId)
          .limit(1);

        const row = rows?.[0];
        if (row) {
          const updatedData = {
            ...(row.data || {}),
            subscriptionStatus: newStatus,
          };
          await supabase
            .from("sas_profile")
            .update({ data: updatedData, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          console.log(`Subscription ${subscriptionId} status → ${newStatus}`);
        }
      } catch (dbError) {
        console.error("Failed to update subscription status from webhook:", dbError);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    return res.status(500).send("Webhook handler failed.");
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (req.path === "/") return next();
  if (req.path.includes(".")) return next();

  if (fs.existsSync(distIndexPath)) {
    return res.sendFile(distIndexPath);
  }
  return res.status(404).send("Frontend not built. Run npm run build.");
});

app.use((error, _req, res, _next) => {
  console.error("[GLOBAL ERROR HANDLER]", error?.message, error?.stack);
  console.error("Unhandled server error:", {
    message: error?.message,
    name: error?.name,
    stack: error?.stack,
  });
  res.status(500).json({
    ok: false,
    error: error?.message || "An unexpected server error occurred.",
    details: error?.stack || null,
  });
});

// ── Overdue Invoice Reminder Cron ─────────────────────────────
// Runs every 24 hours — emails clients with invoices 1+ days overdue
const SHARON_EMAIL = process.env.SHARON_EMAIL || "info@sharonogier.com";

async function sendOverdueReminders() {
  if (!supabase) { console.log("[cron] Supabase not configured, skipping overdue check"); return; }
  if (!resend) { console.log("[cron] Resend not configured, skipping overdue emails"); return; }

  try {
    console.log("[cron] Checking for overdue invoices...");
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Fetch all unpaid invoices from all users
    const { data: invoiceRows, error: invErr } = await supabase
      .from("sas_invoices")
      .select("*");
    if (invErr) throw invErr;

    // Fetch all profiles (for business name + email)
    const { data: profileRows, error: profErr } = await supabase
      .from("sas_profile")
      .select("*");
    if (profErr) throw profErr;

    // Fetch all clients
    const { data: clientRows, error: clientErr } = await supabase
      .from("sas_clients")
      .select("*");
    if (clientErr) throw clientErr;

    let sent = 0;

    for (const invRow of (invoiceRows || [])) {
      const inv = invRow.data || invRow;
      // Only unpaid, non-credit-note invoices with a due date and client email
      if (inv.status === "Paid" || inv.status === "Cancelled") continue;
      if (inv.type === "credit_note") continue;
      if (!inv.dueDate || !inv.clientId) continue;

      // Check if exactly 1+ day overdue (dueDate < today)
      const dueDate = new Date(inv.dueDate + "T00:00:00");
      const diffDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      if (diffDays < 1) continue;

      // Only send on day 1 overdue (not every day)
      if (diffDays !== 1) continue;

      // Skip if already reminded
      if (inv.reminderSentAt) continue;

      // Find the client
      const clientRow = (clientRows || []).find((r) => {
        const c = r.data || r;
        return String(c.id) === String(inv.clientId);
      });
      const client = clientRow ? (clientRow.data || clientRow) : null;
      if (!client?.email) continue;

      // Find the profile (business) for this invoice
      const profileRow = (profileRows || []).find((r) => {
        const p = r.data || r;
        return String(p.id) === String(invRow.id?.toString().slice(0, 8)) || true;
      });
      const profile = profileRow ? (profileRow.data || profileRow) : {};
      const businessName = profile.businessName || "Sharon's Accounting Service";
      const abn = profile.abn || "";

      const amount = Number(inv.total || 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });
      const dueDateFmt = new Date(inv.dueDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#14202B;">
          <h2 style="color:#6A1B9A;">Payment Reminder</h2>
          <p>Dear ${client.name || "Valued Client"},</p>
          <p>This is a friendly reminder that the following invoice is now overdue:</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="background:#F5ECFB;">
              <td style="padding:12px;font-weight:700;">Invoice Number</td>
              <td style="padding:12px;">${inv.invoiceNumber || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding:12px;font-weight:700;">Amount Due</td>
              <td style="padding:12px;font-weight:700;color:#6A1B9A;">${amount}</td>
            </tr>
            <tr style="background:#FEF2F2;">
              <td style="padding:12px;font-weight:700;">Due Date</td>
              <td style="padding:12px;color:#991B1B;">${dueDateFmt} (overdue by ${diffDays} day${diffDays !== 1 ? "s" : ""})</td>
            </tr>
            ${inv.description ? `<tr><td style="padding:12px;font-weight:700;">Description</td><td style="padding:12px;">${inv.description}</td></tr>` : ""}
          </table>
          <p>Please arrange payment at your earliest convenience. If you have already made payment, please disregard this reminder.</p>
          <p>If you have any queries, please don't hesitate to contact us.</p>
          <br/>
          <p style="color:#64748B;font-size:13px;">
            ${businessName}<br/>
            ${abn ? "ABN: " + abn + "<br/>" : ""}
            ${SHARON_EMAIL}
          </p>
        </div>`;

      // Send to client + CC Sharon
      await resend.emails.send({
        from: EMAIL_FROM,
        to: [client.email],
        cc: [SHARON_EMAIL],
        subject: `Payment Reminder — Invoice ${inv.invoiceNumber || ""} overdue ${amount}`,
        html,
      });

      // Mark invoice as reminded in Supabase
      await supabase.from("sas_invoices").update({
        data: { ...inv, reminderSentAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("id", invRow.id);

      sent++;
      console.log(`[cron] Reminder sent for invoice ${inv.invoiceNumber} to ${client.email}`);
    }

    console.log(`[cron] Done — ${sent} reminder${sent !== 1 ? "s" : ""} sent`);
  } catch (err) {
    console.error("[cron] Overdue reminder error:", err.message || err);
  }
}

// Run once at startup (after 1 min delay) then every 24 hours
setTimeout(sendOverdueReminders, 60 * 1000);
setInterval(sendOverdueReminders, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Allowed CORS origins:", CLIENT_URLS);
  getBrowserDiagnostics()
    .then((diagnostics) => console.log("Chromium diagnostics:", diagnostics))
    .catch((error) => console.error("Chromium diagnostics failed:", error));
  if (!stripeSecretKey) console.warn("WARNING: STRIPE_SECRET_KEY is not set.");
  if (!resendApiKey) console.warn("WARNING: RESEND_API_KEY is not set.");
});

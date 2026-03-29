require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const { Resend } = require("resend");
const Stripe = require("stripe");

const app = express();
const PORT = Number(process.env.PORT || 10000);

const distPath = path.join(__dirname, "dist");
const distIndexPath = path.join(distPath, "index.html");

const rawCorsOrigins = [
  process.env.CLIENT_URL,
  process.env.VITE_API_BASE_URL,
  ...(String(process.env.EXTRA_CORS_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:10000",
  "http://127.0.0.1:10000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "https://sharons-portal.onrender.com",
  "https://portal.sharonogier.com",
  "https://sharonogier.com",
  "https://www.sharonogier.com",
];

const CLIENT_URLS = [...new Set(rawCorsOrigins.filter(Boolean))];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || CLIENT_URLS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "stripe-signature", "x-api-key"],
};

app.use("/api", cors(corsOptions));
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
const PUPPETEER_CACHE_DIR = String(
  process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), "node_modules", ".puppeteer_cache")
).trim();

process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_DIR;

app.use("/api/stripe-webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
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

const rateLimitStore = new Map();

function rateLimit({ windowMs = 60000, max = 20 } = {}) {
  return function rateLimitMiddleware(req, res, next) {
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      return res.status(429).json({ ok: false, error: "Too many requests. Please slow down." });
    }

    entry.count += 1;
    return next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60_000);

app.use("/api/", rateLimit({ windowMs: 60_000, max: 20 }));

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

function getBrowserDiagnostics() {
  const envPaths = {
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    GOOGLE_CHROME_BIN: process.env.GOOGLE_CHROME_BIN || null,
    CHROME_BIN: process.env.CHROME_BIN || null,
    CHROMIUM_PATH: process.env.CHROMIUM_PATH || null,
    PUPPETEER_CACHE_DIR,
  };

  let puppeteerPath = null;
  try {
    puppeteerPath = puppeteer.executablePath();
  } catch (_error) {
    puppeteerPath = null;
  }

  const discoveredCacheChrome = findChromeInDirectory(PUPPETEER_CACHE_DIR);

  const candidateOrder = [
    { source: "PUPPETEER_EXECUTABLE_PATH", path: envPaths.PUPPETEER_EXECUTABLE_PATH },
    { source: "GOOGLE_CHROME_BIN", path: envPaths.GOOGLE_CHROME_BIN },
    { source: "CHROME_BIN", path: envPaths.CHROME_BIN },
    { source: "CHROMIUM_PATH", path: envPaths.CHROMIUM_PATH },
    { source: "puppeteer.executablePath()", path: puppeteerPath },
    { source: "PUPPETEER_CACHE_DIR scan", path: discoveredCacheChrome },
    { source: "system google-chrome", path: "/usr/bin/google-chrome-stable" },
    { source: "system chromium-browser", path: "/usr/bin/chromium-browser" },
    { source: "system chromium", path: "/usr/bin/chromium" },
  ];

  const candidates = candidateOrder.map((item) => ({
    source: item.source,
    path: item.path,
    exists: fileExists(item.path),
  }));

  const usableCandidate = candidates.find((item) => item.exists);

  return {
    env: envPaths,
    puppeteerExecutablePath: puppeteerPath,
    cacheDirectoryExists: fileExists(PUPPETEER_CACHE_DIR),
    discoveredCacheChrome,
    candidates,
    launchExecutablePath: usableCandidate ? usableCandidate.path : null,
  };
}

function buildFallbackDocumentHtml(payload = {}) {
  const documentType = String(payload.documentType || "invoice").toLowerCase().trim();
  const isQuote = documentType === "quote";
  const businessName = payload.businessName || "Sharon's Accounting Service";
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

    <div class="footer">Generated by Sharon's Portal.</div>
  </div>
</body>
</html>`;
}

async function generatePdfFromHtml(html) {
  const diagnostics = getBrowserDiagnostics();
  const trimmedHtml = String(html || "").trim();

  if (!trimmedHtml) {
    throw new Error("No HTML provided for PDF generation.");
  }

  if (!diagnostics.launchExecutablePath) {
    const error = new Error(
      `Could not find Chrome in ${PUPPETEER_CACHE_DIR}. Run \"npx puppeteer browsers install chrome\" during build.`
    );
    error.browser = diagnostics;
    throw error;
  }

  const launchOptions = {
    headless: "new",
    executablePath: diagnostics.launchExecutablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
    ],
  };

  let browser;
  let page;
  try {
    console.log("PDF HTML length:", trimmedHtml.length);
    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 2000, deviceScaleFactor: 1 });
    await page.setContent(trimmedHtml, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    });

    return pdfBuffer;
  } catch (error) {
    error.browser = diagnostics;
    throw error;
  } finally {
    try {
      if (page) await page.close();
    } catch (_error) {}
    try {
      if (browser) await browser.close();
    } catch (_error) {}
  }
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
}) {
  if (!resend) throw new Error("RESEND_API_KEY is missing in environment variables.");

  const recipients = normaliseRecipients(to);
  if (!recipients.length) throw new Error("Recipient email is required.");

  const normalisedHtml = String(htmlForPdf || "").trim();
  const resolvedHtml = normalisedHtml || buildFallbackDocumentHtml(fallbackPdfPayload || {});

  let pdfBuffer;
  try {
    pdfBuffer = await generatePdfFromHtml(resolvedHtml);
  } catch (error) {
    const fallbackError = new Error(`PDF generation failed: ${error.message}`);
    fallbackError.cause = error;
    throw fallbackError;
  }

  const payload = {
    from: EMAIL_FROM,
    to: recipients,
    subject: subject || "Your document",
    html: emailHtml || "<p>Please find your PDF attached.</p>",
    attachments: [
      {
    filename: filename || "document.pdf",
    content: pdfBuffer.toString("base64"),
    encoding: "base64",
    contentType: "application/pdf",
      },
    ],
  };

  const resolvedReplyTo = String(replyTo || EMAIL_REPLY_TO || "").trim();
  if (resolvedReplyTo) payload.replyTo = resolvedReplyTo;
  if (emailText) payload.text = emailText;

  return await resend.emails.send(payload);
}

app.get("/", (_req, res) => {
  if (fs.existsSync(distIndexPath)) {
    return res.sendFile(distIndexPath);
  }
  return res.json({ ok: true, message: `Server running on port ${PORT}` });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    message: `Server running on port ${PORT}`,
    resendConfigured: !!resendApiKey,
    stripeConfigured: !!stripeSecretKey,
    puppeteerCacheDir: PUPPETEER_CACHE_DIR,
    chromeExecutable: getBrowserDiagnostics().launchExecutablePath,
  });
});

app.get("/api/debug-browser", (_req, res) => {
  try {
    return res.json({ ok: true, diagnostics: getBrowserDiagnostics() });
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
      browser: getBrowserDiagnostics(),
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
  try {
    const payload = req.body || {};
    const {
      to,
      subject,
      html,
      quoteHtml,
      invoiceHtml,
      text,
      filename,
      customerName,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      clientContactPerson,
      documentType,
      replyTo,
      stripeCheckoutUrl,
      invoiceNumber,
      quoteNumber,
      invoiceDate,
      dueDate,
      quoteDate,
      expiryDate,
      number,
      businessName,
      businessAddress,
      businessEmail,
      businessPhone,
      abn,
      logoDataUrl,
      description,
      comments,
      quantity,
      subtotal,
      gst,
      total,
      currencyCode,
      hidePhoneNumber,
      message,
      documentHtml,
    } = payload;

    const recipients = normaliseRecipients(to || payload.recipients);
    if (!recipients.length) {
      return res.status(400).json({ ok: false, error: "Recipient email is required." });
    }

    const safeDocumentType = String(documentType || "document").toLowerCase().trim() || "document";

    let htmlForPdf = "";
    if (safeDocumentType === "quote") {
      htmlForPdf = String(quoteHtml || documentHtml || html || "").trim();
    } else if (safeDocumentType === "invoice") {
      htmlForPdf = String(invoiceHtml || documentHtml || html || "").trim();
    } else {
      htmlForPdf = String(documentHtml || html || "").trim();
    }

    if (!htmlForPdf) {
      return res.status(400).json({
        ok: false,
        error: `Missing ${safeDocumentType} HTML for PDF generation.`,
      });
    }

    const emailHtml = String(html || htmlForPdf).trim();
    const resolvedNumber = number || (safeDocumentType === "quote" ? quoteNumber : invoiceNumber) || "";
    const safeFilename = String(
      filename || `${safeDocumentType}-${resolvedNumber || customerName || clientName || "client"}.pdf`
    )
      .replace(/\s+/g, "-")
      .toLowerCase();

    console.log("send-document-email payload summary:", {
      documentType: safeDocumentType,
      recipients,
      subject: subject || `Your ${safeDocumentType}`,
      hasHtml: Boolean(htmlForPdf),
      htmlLength: htmlForPdf.length,
      filename: safeFilename,
      number: resolvedNumber,
    });

    const emailResult = await sendEmailWithPdf({
      to: recipients,
      subject: subject || `Your ${safeDocumentType}`,
      htmlForPdf,
      emailHtml: emailHtml || `<p>Hello${customerName || clientName ? ` ${escapeHtml(customerName || clientName)}` : ""},</p>
<p>Please find your ${escapeHtml(safeDocumentType)} attached.</p>
<p>Kind regards,<br />Sharon's Accounting Service</p>`,
      emailText: text || undefined,
      filename: safeFilename,
      replyTo,
      fallbackPdfPayload: {
        documentType: safeDocumentType,
        businessName,
        businessAddress,
        businessEmail,
        businessPhone,
        abn,
        logoDataUrl,
        clientName: customerName || clientName,
        customerName: customerName || clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        clientContactPerson,
        number: resolvedNumber,
        invoiceNumber: invoiceNumber || "",
        quoteNumber: quoteNumber || "",
        invoiceDate: invoiceDate || "",
        dueDate: dueDate || "",
        quoteDate: quoteDate || "",
        expiryDate: expiryDate || "",
        description: description || "",
        comments: comments || "",
        quantity: quantity ?? 1,
        subtotal: subtotal ?? 0,
        gst: gst ?? 0,
        total: total ?? 0,
        currencyCode: currencyCode || "AUD",
        hidePhoneNumber: Boolean(hidePhoneNumber),
        message: message || `Please find your ${safeDocumentType} attached.`,
        stripeCheckoutUrl,
      },
    });

    console.log("send-document-email success:", {
      documentType: safeDocumentType,
      recipients,
      number: resolvedNumber,
    });

    return res.json({ ok: true, message: `${safeDocumentType} email sent successfully.`, result: emailResult });
  } catch (error) {
    console.error("Send document email failed:", error);
    return res.status(500).json({ ok: false, error: "Failed to send document email.", details: error.message });
  }
});

app.post("/api/send-invoice-attachment-email", async (req, res) => {
  try {
    const payload = req.body || {};
    const recipients = normaliseRecipients(payload.to || payload.recipients);
    const clientName = payload.clientName || "Client";
    const invoiceNumber = payload.number || payload.invoiceNumber || "Invoice";

    console.log("send-invoice-attachment-email payload summary:", {
      recipients,
      invoiceNumber,
      hasInvoiceHtml: Boolean(String(payload.invoiceHtml || payload.documentHtml || "").trim()),
    });

    const invoiceHtml = String(payload.invoiceHtml || payload.documentHtml || "").trim();
    if (!invoiceHtml) {
      return res.status(400).json({ ok: false, error: "Preview HTML is required for PDF generation." });
    }

    const emailResult = await sendEmailWithPdf({
      to: recipients,
      subject: `Invoice ${invoiceNumber}`,
      htmlForPdf: invoiceHtml,
      emailHtml: `<p>Hello ${escapeHtml(clientName)},</p><p>Please find your invoice attached.</p>`,
      filename: `invoice-${invoiceNumber}.pdf`,
      fallbackPdfPayload: {
        documentType: "invoice",
        businessName: payload.businessName,
        businessAddress: payload.businessAddress,
        businessEmail: payload.businessEmail,
        businessPhone: payload.businessPhone,
        abn: payload.abn,
        logoDataUrl: payload.logoDataUrl,
        clientName,
        customerName: clientName,
        clientEmail: payload.clientEmail,
        clientPhone: payload.clientPhone,
        clientAddress: payload.clientAddress,
        clientContactPerson: payload.clientContactPerson,
        invoiceNumber,
        number: invoiceNumber,
        invoiceDate: payload.invoiceDate,
        dueDate: payload.dueDate,
        description: payload.description,
        comments: payload.comments,
        quantity: payload.quantity,
        subtotal: payload.subtotal,
        gst: payload.gst,
        total: payload.total,
        currencyCode: payload.currencyCode,
        hidePhoneNumber: Boolean(payload.hidePhoneNumber),
        stripeCheckoutUrl: payload.stripeCheckoutUrl,
      },
    });

    console.log("send-invoice-attachment-email success:", {
      recipients,
      invoiceNumber,
    });

    return res.json({ ok: true, message: `Invoice emailed to ${recipients.join(", ")}`, result: emailResult });
  } catch (error) {
    console.error("Email failed:", error);
    return res.status(500).json({ ok: false, error: error.message });
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
      console.log(`Payment completed — session: ${session?.id}, invoiceId: ${invoiceId}`);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    return res.status(500).send("Webhook handler failed.");
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (req.path.includes(".")) return next();

  if (fs.existsSync(distIndexPath)) {
    return res.sendFile(distIndexPath);
  }
  return res.status(404).send("Frontend not built. Run npm run build.");
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled server error:", error);
  res.status(500).json({ ok: false, error: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Allowed CORS origins:", CLIENT_URLS);
  console.log("Puppeteer diagnostics:", getBrowserDiagnostics());
  if (!stripeSecretKey) console.warn("WARNING: STRIPE_SECRET_KEY is not set.");
  if (!resendApiKey) console.warn("WARNING: RESEND_API_KEY is not set.");
});

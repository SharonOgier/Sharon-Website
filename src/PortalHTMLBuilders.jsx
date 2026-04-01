import {
  safeNumber,
  formatCurrencyByCode,
  getClientCurrencyCode,
  calculateAdjustmentValues,
  formatDateAU,
  addDays,
  todayLocal,
  LOGO_PREVIEW_MAX_HEIGHT,
  LOGO_PREVIEW_MAX_WIDTH,
} from "./PortalHelpers";

const LOGO_DOCUMENT_MAX_HEIGHT = 140;
const LOGO_DOCUMENT_MAX_WIDTH = 440;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const nl2br = (value) => escapeHtml(value).replace(/\n/g, "<br/>");

export function buildQuoteHtml(quote, options = {}, ctx = {}) {
  const { profile, clients } = ctx;
  const getClientById = (id) => clients.find((c) => c.id === safeNumber(id));
  const clientIsGstExempt = (id) => Boolean(getClientById(id)?.outsideAustraliaOrGstExempt);
  const gstAppliesToClient = (id) => Boolean(profile.gstRegistered) && !clientIsGstExempt(id);
  const getDocumentBusinessName = () => profile.hideLegalNameOnDocs || !profile.legalBusinessName ? profile.businessName : profile.legalBusinessName;
  const getDocumentAddress = () => profile.hideAddressOnDocs ? "" : profile.address || "";
const { allowEmail = false } = options;
const qClient = getClientById(quote.clientId);
const currencyCode = quote.currencyCode || getClientCurrencyCode(qClient);
const money = (value) => formatCurrencyByCode(value, currencyCode);
const adjustments = calculateAdjustmentValues({
  subtotal: safeNumber(quote.subtotal),
  total: safeNumber(quote.total),
  client: qClient,
  profile,
});
const gstStatus =
  quote.gstStatus ||
  (clientIsGstExempt(quote.clientId)
    ? "GST not applicable"
    : safeNumber(quote.gst) > 0
      ? "GST applies"
      : "GST free");
const businessName = escapeHtml(getDocumentBusinessName());
const businessAddress = escapeHtml(getDocumentAddress());
const clientName = escapeHtml(qClient?.name || "");
const businessEmail = escapeHtml(profile.email || "");
const businessPhone = escapeHtml(profile.phone || "");
const businessAbn = escapeHtml(profile.abn || "");
const clientDetails =
  qClient?.includeAddressDetails && qClient?.addressDetails
    ? `<div style="margin-top:6px; color:#555;">${nl2br(qClient.addressDetails)}</div>`
    : "";

return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Quote Preview</title>
<style>
body { font-family: Arial; padding:40px; color:#14202B; }
.header { display:flex; justify-content:space-between; border-bottom:1px solid #ddd; padding-bottom:20px; }
.title { font-size:32px; font-weight:900; color:#6A1B9A; }
.right { text-align:right; font-size:14px; }
table { width:100%; border-collapse:collapse; margin-top:24px; }
th, td { padding:10px; border-bottom:1px solid #eee; }
th { text-align:left; color:#667085; }
.totals { width:360px; margin-left:auto; margin-top:20px; }
.totals div { display:flex; justify-content:space-between; padding:6px 0; }
.total { font-weight:800; font-size:18px; color:#006D6D; }
.footer { margin-top:30px; display:flex; justify-content:space-between; font-size:12px; color:#666; }
.print-toolbar { margin-bottom: 24px; display:flex !important; justify-content:space-between; align-items:center; gap:16px; }
.toolbar-actions { display:flex; gap:10px; flex-wrap:wrap; }
.preview-status { font-size:13px; color:#64748B; }
.print-button { background:#6A1B9A; color:#fff; border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer; text-decoration:none; display:inline-block; }
.email-button { background:#006D6D; color:#fff; border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer; }
@media print {
  .print-toolbar { display:none !important; }
  body { padding: 0; }
}
</style>
</head>
<body>

<div class="print-toolbar">
<div id="preview-email-status" class="preview-status"></div>
<div class="toolbar-actions">
  ${allowEmail ? `<button id="preview-email-button" class="email-button" onclick="window.opener && window.opener.sendQuoteFromPreview && window.opener.sendQuoteFromPreview(${JSON.stringify(quote.id)}, window)">Email Quote</button>` : ""}
  <a href="javascript:void(0)" class="print-button" onclick="window.print()">Print / Download PDF</a>
</div>
</div>

<div class="header">
<div>
  ${profile.logoDataUrl
    ? `<div style="margin-bottom:12px;"><img src="${profile.logoDataUrl}" alt="Logo" style="max-height:${LOGO_DOCUMENT_MAX_HEIGHT}px; max-width:${LOGO_DOCUMENT_MAX_WIDTH}px; object-fit:contain;" /></div>`
    : ""
  }
  <div class="title">QUOTE</div>
  <div style="margin-top:8px; font-weight:700;">${businessName}</div>
  <div style="font-size:13px; color:#555;">${businessAddress || ""}</div>
  <div style="font-size:13px; color:#555;">${businessEmail}${quote.hidePhoneNumber ? "" : ` | ${businessPhone}`}</div>
  <div style="font-size:13px; color:#555;">ABN: ${businessAbn}</div>
</div>

<div class="right">
  <div><strong>Quote ref:</strong> ${quote.quoteNumber || ""}</div>
  <div><strong>Quote date:</strong> ${formatDateAU(quote.quoteDate)}</div>
  <div><strong>Expiry date:</strong> ${formatDateAU(quote.expiryDate)}</div>
</div>
</div>

<div style="margin-top:20px; font-weight:700;">${clientName}</div>
${clientDetails}

<table>
<thead>
  <tr>
    <th>Description</th>
    <th>Qty</th>
    <th style="text-align:right">Unit Price</th>
    <th style="text-align:right">GST</th>
    <th style="text-align:right">Total (excl. GST)</th>
  </tr>
</thead>
<tbody>
  ${(quote.lineItems && quote.lineItems.length > 0
    ? quote.lineItems
    : [{ description: quote.description || "Professional services", quantity: quote.quantity || 1, unitPrice: safeNumber(quote.subtotal) / Math.max(1, safeNumber(quote.quantity || 1)), rowGst: quote.gst, rowTotal: quote.total }]
  ).map((item) => {
    const qty = safeNumber(item.quantity || item.qty || 1);
    const unit = safeNumber(item.unitPrice || item.unit || 0);
    const rowSub = unit * qty;
    const rowGst = safeNumber(item.rowGst != null ? item.rowGst : ((item.gstType || "GST on Income (10%)") === "GST on Income (10%)" ? rowSub * 0.1 : 0));
    return `<tr>
    <td>${escapeHtml(item.description || "Service")}</td>
    <td>${qty}</td>
    <td style="text-align:right">${money(unit)}</td>
    <td style="text-align:right">${money(rowGst)}</td>
    <td style="text-align:right">${money(rowSub)}</td>
  </tr>`;
  }).join("")}
</tbody>
</table>

<div class="totals">
<div><span>Subtotal (excl GST):</span><span>${money(quote.subtotal)}</span></div>
<div><span>Total GST:</span><span>${money(quote.gst)}</span></div>
<div><span>GST status:</span><span>${gstStatus}</span></div>
<div><span>Less fees:</span><span>${money(adjustments.feeAmount)}</span></div>
<div><span>Less tax withheld:</span><span>${money(adjustments.taxWithheld)}</span></div>
<div class="total"><span>Total estimate:</span><span>${money(quote.total)}</span></div>
<div class="total"><span>Net expected:</span><span>${money(adjustments.netExpected)}</span></div>
</div>

<div class="footer">
<div>For any queries relating to this quote please contact ${profile.businessName}</div>
<div>Private & Confidential</div>
</div>

</body>
</html>`;
}

export function buildQuoteEmailHtml(quote, ctx = {}) {
  const { profile, clients } = ctx;
  const getClientById = (id) => clients.find((c) => c.id === safeNumber(id));
  const clientIsGstExempt = (id) => Boolean(getClientById(id)?.outsideAustraliaOrGstExempt);
  const gstAppliesToClient = (id) => Boolean(profile.gstRegistered) && !clientIsGstExempt(id);
  const getDocumentBusinessName = () => profile.hideLegalNameOnDocs || !profile.legalBusinessName ? profile.businessName : profile.legalBusinessName;
  const getDocumentAddress = () => profile.hideAddressOnDocs ? "" : profile.address || "";
const qClient = getClientById(quote.clientId);
const currencyCode = quote.currencyCode || getClientCurrencyCode(qClient);
const money = (value) => formatCurrencyByCode(value, currencyCode);
const businessName = escapeHtml(getDocumentBusinessName());
const businessAddress = escapeHtml(getDocumentAddress());
const clientName = escapeHtml(qClient?.name || "");
const businessEmail = escapeHtml(profile.email || "");
const businessPhone = escapeHtml(profile.phone || "");
const businessAbn = escapeHtml(profile.abn || "");
const clientDetails =
  qClient?.includeAddressDetails && qClient?.addressDetails
    ? `<div style="margin-top:6px; color:#475569;">${nl2br(qClient.addressDetails)}</div>`
    : "";
const notesHtml = quote.comments
  ? `<div style="margin-top:20px; padding:16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px;">${nl2br(quote.comments)}</div>`
  : "";
const quoteLineItems = (quote.lineItems && quote.lineItems.length > 0)
  ? quote.lineItems
  : [{ description: quote.description || "Professional services", quantity: quote.quantity || 1, unitPrice: safeNumber(quote.subtotal) / Math.max(1, safeNumber(quote.quantity || 1)), rowGst: quote.gst, rowTotal: quote.total }];

return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Quote ${quote.quoteNumber || ""}</title>
</head>
<body style="margin:0; padding:24px; background:#F8FAFC; font-family:Arial, sans-serif; color:#14202B;">
  <div style="max-width:760px; margin:0 auto; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:18px; padding:28px;">
    ${profile.logoDataUrl
      ? `<div style="margin-bottom:16px;"><img src="${profile.logoDataUrl}" alt="Logo" style="max-height:${LOGO_PREVIEW_MAX_HEIGHT}px; max-width:${LOGO_PREVIEW_MAX_WIDTH}px; object-fit:contain;" /></div>`
      : ""
    }
    <div style="display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; border-bottom:1px solid #E2E8F0; padding-bottom:18px;">
      <div>
        <div style="font-size:30px; font-weight:900; color:#6A1B9A;">QUOTE</div>
        <div style="margin-top:8px; font-weight:700;">${businessName}</div>
        <div style="font-size:13px; color:#475569; margin-top:4px;">${businessAddress || ""}</div>
        <div style="font-size:13px; color:#475569; margin-top:4px;">${businessEmail}${quote.hidePhoneNumber ? "" : ` | ${businessPhone}`}</div>
        <div style="font-size:13px; color:#475569; margin-top:4px;">ABN: ${businessAbn}</div>
      </div>
      <div style="text-align:right; font-size:14px; color:#14202B;">
        <div><strong>Quote ref:</strong> ${quote.quoteNumber || ""}</div>
        <div style="margin-top:6px;"><strong>Quote date:</strong> ${formatDateAU(quote.quoteDate)}</div>
        <div style="margin-top:6px;"><strong>Expiry date:</strong> ${formatDateAU(quote.expiryDate)}</div>
      </div>
    </div>

    <div style="margin-top:20px;">
      <div style="font-weight:700;">${clientName}</div>
      ${clientDetails}
    </div>

    <table style="width:100%; border-collapse:collapse; margin-top:24px;">
      <thead>
        <tr>
          <th style="text-align:left; padding:10px; border-bottom:1px solid #E2E8F0; color:#64748B;">Description</th>
          <th style="text-align:left; padding:10px; border-bottom:1px solid #E2E8F0; color:#64748B;">Qty</th>
          <th style="text-align:right; padding:10px; border-bottom:1px solid #E2E8F0; color:#64748B;">Unit Price</th>
          <th style="text-align:right; padding:10px; border-bottom:1px solid #E2E8F0; color:#64748B;">GST</th>
          <th style="text-align:right; padding:10px; border-bottom:1px solid #E2E8F0; color:#64748B;">Total (excl. GST)</th>
        </tr>
      </thead>
      <tbody>
        ${quoteLineItems.map((item) => {
          const qty = safeNumber(item.quantity || item.qty || 1);
          const unit = safeNumber(item.unitPrice || item.unit || 0);
          const rowSub = unit * qty;
          const rowGst = safeNumber(item.rowGst != null ? item.rowGst : ((item.gstType || "GST on Income (10%)") === "GST on Income (10%)" ? rowSub * 0.1 : 0));
          return `<tr>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0;">${escapeHtml(item.description || "Professional services")}</td>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0;">${qty}</td>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0; text-align:right;">${money(unit)}</td>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0; text-align:right;">${money(rowGst)}</td>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0; text-align:right;">${money(rowSub)}</td>
        </tr>`;
        }).join("")}
      </tbody>
    </table>

    <div style="max-width:360px; margin:24px 0 0 auto;">
      <div style="display:flex; justify-content:space-between; padding:6px 0;"><span>Subtotal (excl GST):</span><span>${money(quote.subtotal)}</span></div>
      <div style="display:flex; justify-content:space-between; padding:6px 0;"><span>Total GST:</span><span>${money(quote.gst)}</span></div>
      <div style="display:flex; justify-content:space-between; padding:6px 0; font-weight:800; color:#006D6D;"><span>Total estimate:</span><span>${money(quote.total)}</span></div>
    </div>

    ${notesHtml}

    <div style="margin-top:24px; font-size:12px; color:#64748B; line-height:1.6;">
      This is a quote only and not a tax invoice.
    </div>
  </div>
</body>
</html>`;
}

// ── Clean email builders — summary + portal link, Gmail-safe ──────────────

export function buildInvoiceEmailHtml(invoice, stripeCheckoutUrl = "", ctx = {}) {
  const { profile, clients } = ctx;
  const getClientById = (id) => clients.find((c) => c.id === safeNumber(id));
  const getDocumentBusinessName = () => profile.hideLegalNameOnDocs || !profile.legalBusinessName ? profile.businessName : profile.legalBusinessName;
  const previewClient = getClientById(invoice.clientId);
  const currencyCode = invoice.currencyCode || getClientCurrencyCode(previewClient);
  const money = (v) => formatCurrencyByCode(v, currencyCode);
  const businessName = escapeHtml(getDocumentBusinessName());
  const clientName = escapeHtml(previewClient?.name || "");
  const portalUrl = typeof window !== "undefined" ? window.location.origin : "https://portal.sharonogier.com";

  const payOnlineBlock = stripeCheckoutUrl || profile.paypalPaymentLink ? `
    <tr><td style="padding:0 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F5;border:1px solid #E2E8F0;border-radius:12px;padding:16px;">
        <tr><td style="padding:16px;">
          <div style="font-weight:700;font-size:15px;color:#14202B;margin-bottom:8px;">Pay Online</div>
          <div style="font-size:13px;color:#555;margin-bottom:12px;">Choose your preferred payment method below.</div>
          ${stripeCheckoutUrl ? `<a href="${stripeCheckoutUrl}" style="display:inline-block;margin-right:10px;background:#6A1B9A;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700;font-size:14px;">Pay with Card</a>` : ""}
          ${profile.paypalPaymentLink ? `<a href="${profile.paypalPaymentLink}" style="display:inline-block;background:#0070BA;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700;font-size:14px;">Pay with PayPal</a>` : ""}
        </td></tr>
      </table>
    </td></tr>` : "";

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><title>Invoice ${escapeHtml(invoice.invoiceNumber || "")}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;color:#14202B;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

      <!-- Card -->
      <tr><td style="background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:32px;">
        <table width="100%" cellpadding="0" cellspacing="0">

          <!-- Title bar -->
          <tr><td style="padding:0 0 24px;border-bottom:2px solid #E2E8F0;">
            <div style="font-size:28px;font-weight:900;color:#6A1B9A;">TAX INVOICE</div>
            <div style="font-size:15px;font-weight:700;margin-top:6px;">${businessName}</div>
            <div style="font-size:13px;color:#555;margin-top:2px;">ABN: ${escapeHtml(profile.abn || "")}</div>
          </td></tr>

          <!-- Details -->
          <tr><td style="padding:20px 0;border-bottom:1px solid #E2E8F0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:top;width:50%;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:6px;">Billed To</div>
                  <div style="font-size:15px;font-weight:700;">${clientName}</div>
                </td>
                <td style="vertical-align:top;text-align:right;width:50%;">
                  <div style="font-size:13px;color:#555;margin-bottom:3px;"><strong>Invoice #:</strong> ${escapeHtml(invoice.invoiceNumber || "")}</div>
                  <div style="font-size:13px;color:#555;margin-bottom:3px;"><strong>Date:</strong> ${formatDateAU(invoice.invoiceDate)}</div>
                  <div style="font-size:13px;color:#555;"><strong>Due:</strong> ${formatDateAU(invoice.dueDate)}</div>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Amount -->
          <tr><td style="padding:20px 0;border-bottom:1px solid #E2E8F0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#555;">Subtotal (ex GST)</td>
                <td style="font-size:14px;text-align:right;">${money(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:#555;padding-top:4px;">GST</td>
                <td style="font-size:14px;text-align:right;padding-top:4px;">${money(invoice.gst)}</td>
              </tr>
              <tr>
                <td style="font-size:20px;font-weight:800;color:#006D6D;padding-top:12px;">Amount Due</td>
                <td style="font-size:20px;font-weight:800;color:#006D6D;text-align:right;padding-top:12px;">${money(invoice.total)}</td>
              </tr>
            </table>
          </td></tr>

          <!-- Payment -->
          <tr><td style="padding:20px 0;border-bottom:1px solid #E2E8F0;">
            <div style="font-size:13px;font-weight:700;margin-bottom:8px;">Payment Details</div>
            <div style="font-size:13px;color:#555;line-height:1.9;">
              ${profile.bankName ? `<div><strong>Account Name:</strong> ${escapeHtml(profile.bankName)}</div>` : ""}
              ${profile.bsb ? `<div><strong>BSB:</strong> ${escapeHtml(profile.bsb)}</div>` : ""}
              ${profile.accountNumber ? `<div><strong>Account Number:</strong> ${escapeHtml(profile.accountNumber)}</div>` : ""}
              ${profile.payId ? `<div><strong>PayID:</strong> ${escapeHtml(profile.payId)}</div>` : ""}
              <div style="margin-top:6px;"><strong>Reference:</strong> ${escapeHtml(invoice.paymentReference || invoice.invoiceNumber || "")}</div>
            </div>
          </td></tr>

          ${payOnlineBlock}

          <!-- View link -->
          <tr><td style="padding:24px 0 8px;text-align:center;">
            <div style="font-size:14px;color:#555;margin-bottom:14px;">Click the button below to view your full invoice.</div>
            <a href="${portalUrl}" style="display:inline-block;background:#6A1B9A;color:#fff;text-decoration:none;padding:13px 28px;border-radius:12px;font-weight:700;font-size:15px;">View Invoice</a>
          </td></tr>

          <!-- Footer -->
          <tr><td style="padding-top:24px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;text-align:center;">
            ${escapeHtml(businessName)} &nbsp;&middot;&nbsp; ${escapeHtml(profile.email || "")} &nbsp;&middot;&nbsp; Private &amp; Confidential
          </td></tr>

        </table>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function buildQuoteEmailHtmlInline(quote, ctx = {}) {
  const { profile, clients } = ctx;
  const getClientById = (id) => clients.find((c) => c.id === safeNumber(id));
  const getDocumentBusinessName = () => profile.hideLegalNameOnDocs || !profile.legalBusinessName ? profile.businessName : profile.legalBusinessName;
  const qClient = getClientById(quote.clientId);
  const currencyCode = quote.currencyCode || getClientCurrencyCode(qClient);
  const money = (v) => formatCurrencyByCode(v, currencyCode);
  const businessName = escapeHtml(getDocumentBusinessName());
  const clientName = escapeHtml(qClient?.name || "");
  const portalUrl = typeof window !== "undefined" ? window.location.origin : "https://portal.sharonogier.com";

  const notesBlock = quote.comments ? `
    <tr><td style="padding:0 0 20px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:6px;">Notes</div>
      <div style="font-size:14px;color:#555;line-height:1.6;">${nl2br(escapeHtml(quote.comments))}</div>
    </td></tr>` : "";

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><title>Quote ${escapeHtml(quote.quoteNumber || "")}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;color:#14202B;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

      <!-- Card -->
      <tr><td style="background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:32px;">
        <table width="100%" cellpadding="0" cellspacing="0">

          <!-- Title bar -->
          <tr><td style="padding:0 0 24px;border-bottom:2px solid #E2E8F0;">
            <div style="font-size:28px;font-weight:900;color:#6A1B9A;">QUOTE</div>
            <div style="font-size:15px;font-weight:700;margin-top:6px;">${businessName}</div>
            <div style="font-size:13px;color:#555;margin-top:2px;">ABN: ${escapeHtml(profile.abn || "")}</div>
          </td></tr>

          <!-- Details -->
          <tr><td style="padding:20px 0;border-bottom:1px solid #E2E8F0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:top;width:50%;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:6px;">Prepared For</div>
                  <div style="font-size:15px;font-weight:700;">${clientName}</div>
                </td>
                <td style="vertical-align:top;text-align:right;width:50%;">
                  <div style="font-size:13px;color:#555;margin-bottom:3px;"><strong>Quote ref:</strong> ${escapeHtml(quote.quoteNumber || "")}</div>
                  <div style="font-size:13px;color:#555;margin-bottom:3px;"><strong>Date:</strong> ${formatDateAU(quote.quoteDate)}</div>
                  <div style="font-size:13px;color:#555;"><strong>Expiry:</strong> ${formatDateAU(quote.expiryDate)}</div>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Amount -->
          <tr><td style="padding:20px 0;border-bottom:1px solid #E2E8F0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#555;">Subtotal (ex GST)</td>
                <td style="font-size:14px;text-align:right;">${money(quote.subtotal)}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:#555;padding-top:4px;">GST</td>
                <td style="font-size:14px;text-align:right;padding-top:4px;">${money(quote.gst)}</td>
              </tr>
              <tr>
                <td style="font-size:20px;font-weight:800;color:#006D6D;padding-top:12px;">Total Estimate</td>
                <td style="font-size:20px;font-weight:800;color:#006D6D;text-align:right;padding-top:12px;">${money(quote.total)}</td>
              </tr>
            </table>
          </td></tr>

          ${notesBlock}

          <!-- View link -->
          <tr><td style="padding:24px 0 8px;text-align:center;">
            <div style="font-size:14px;color:#555;margin-bottom:14px;">Click the button below to view your full quote.</div>
            <a href="${portalUrl}" style="display:inline-block;background:#6A1B9A;color:#fff;text-decoration:none;padding:13px 28px;border-radius:12px;font-weight:700;font-size:15px;">View Quote</a>
          </td></tr>

          <!-- Footer -->
          <tr><td style="padding-top:24px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;text-align:center;">
            ${escapeHtml(businessName)} &nbsp;&middot;&nbsp; ${escapeHtml(profile.email || "")} &nbsp;&middot;&nbsp; Private &amp; Confidential
          </td></tr>

        </table>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────


export function buildInvoiceHtml(invoice, stripeCheckoutUrl = "", options = {}, ctx = {}) {
  const { profile, clients } = ctx;
  const getClientById = (id) => clients.find((c) => c.id === safeNumber(id));
  const clientIsGstExempt = (id) => Boolean(getClientById(id)?.outsideAustraliaOrGstExempt);
  const gstAppliesToClient = (id) => Boolean(profile.gstRegistered) && !clientIsGstExempt(id);
  const getDocumentBusinessName = () => profile.hideLegalNameOnDocs || !profile.legalBusinessName ? profile.businessName : profile.legalBusinessName;
  const getDocumentAddress = () => profile.hideAddressOnDocs ? "" : profile.address || "";
const { allowEmail = false } = options;
const previewClient = getClientById(invoice.clientId);
const currencyCode = invoice.currencyCode || getClientCurrencyCode(previewClient);
const money = (value) => formatCurrencyByCode(value, currencyCode);
const feeAmount =
  invoice.feeAmount != null
    ? safeNumber(invoice.feeAmount)
    : calculateAdjustmentValues({
      subtotal: safeNumber(invoice.subtotal),
      total: safeNumber(invoice.total),
      client: previewClient,
      profile,
    }).feeAmount;
const taxWithheld =
  invoice.taxWithheld != null
    ? safeNumber(invoice.taxWithheld)
    : calculateAdjustmentValues({
      subtotal: safeNumber(invoice.subtotal),
      total: safeNumber(invoice.total),
      client: previewClient,
      profile,
    }).taxWithheld;
const netExpected =
  invoice.netExpected != null
    ? safeNumber(invoice.netExpected)
    : calculateAdjustmentValues({
      subtotal: safeNumber(invoice.subtotal),
      total: safeNumber(invoice.total),
      client: previewClient,
      profile,
    }).netExpected;
const gstStatus =
  invoice.gstStatus ||
  (clientIsGstExempt(invoice.clientId)
    ? "GST not applicable"
    : safeNumber(invoice.gst) > 0
      ? "GST applies"
      : "GST free");
const purchaseOrderReference = escapeHtml(invoice.purchaseOrderReference || "");
const purchaseOrderBlock =
  previewClient?.hasPurchaseOrder && purchaseOrderReference
    ? `<div style="margin-top:10px; font-size:14px; color:#555;"><strong>PO / Reference:</strong> ${purchaseOrderReference}</div>`
    : "";
const businessName = escapeHtml(getDocumentBusinessName());
const businessAddress = escapeHtml(getDocumentAddress());
const clientName = escapeHtml(previewClient?.name || "");
const clientEmail = escapeHtml(previewClient?.email || "");
const businessEmail = escapeHtml(profile.email || "");
const businessPhone = escapeHtml(profile.phone || "");
const businessAbn = escapeHtml(profile.abn || "");
const paymentReference = escapeHtml(invoice.paymentReference || invoice.invoiceNumber || "");

const clientDetails =
  previewClient?.includeAddressDetails && previewClient?.addressDetails
    ? `<div style="margin-top:6px; color:#555;">
          ${nl2br(previewClient.addressDetails)}
        </div>`
    : "";
return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice Preview</title>
<style>
body { font-family: Arial, sans-serif; padding: 40px; color: #14202B; }
.header { display:flex; justify-content:space-between; border-bottom:2px solid #eee; padding-bottom:20px; }
.title { font-size:34px; font-weight:900; color:#6A1B9A; }
.right { text-align:right; }
.section { margin-top:24px; }
table { width:100%; border-collapse: collapse; margin-top:20px; }
th, td { padding:12px; border-bottom:1px solid #ddd; font-size:14px; }
th { text-align:left; color:#64748B; }
.totals { margin-top:20px; width:360px; margin-left:auto; }
.totals div { display:flex; justify-content:space-between; padding:6px 0; }
.total { font-size:20px; font-weight:800; color:#006D6D; }
.payment { margin-top:30px; padding-top:20px; border-top:1px solid #ddd; }
.footer { margin-top:40px; font-size:12px; color:#666; display:flex; justify-content:space-between; }
.print-toolbar { margin-bottom: 24px; display:flex !important; justify-content:space-between; align-items:center; gap:16px; }
.toolbar-actions { display:flex; gap:10px; flex-wrap:wrap; }
.preview-status { font-size:13px; color:#64748B; }
.print-button { background:#6A1B9A; color:#fff; border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer; text-decoration:none; display:inline-block; }
.email-button { background:#006D6D; color:#fff; border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer; }
@media print {
  .print-toolbar { display:none !important; }
  body { padding: 0; }
}
</style>
</head>
<body>

<div class="print-toolbar">
<div id="preview-email-status" class="preview-status"></div>
<div class="toolbar-actions">
  ${allowEmail ? `<button id="preview-email-button" class="email-button" onclick="window.opener && window.opener.sendInvoiceFromPreview && window.opener.sendInvoiceFromPreview(${JSON.stringify(invoice.id)}, window)">Email Invoice</button>` : ""}
  <a href="javascript:void(0)" class="print-button" onclick="window.print()">Print / Download PDF</a>
</div>
</div>

<div class="header">
<div>
  ${profile.logoDataUrl
    ? `<div style="margin-bottom:12px;"><img src="${profile.logoDataUrl}" alt="Logo" style="max-height:${LOGO_DOCUMENT_MAX_HEIGHT}px; max-width:${LOGO_DOCUMENT_MAX_WIDTH}px; object-fit:contain;" /></div>`
    : ""
  }
  <div class="title">TAX INVOICE</div>
  <div style="margin-top:10px; font-weight:700;">${businessName}</div>
  <div style="font-size:14px; color:#555;">${businessAddress || ""}</div>
  <div style="font-size:14px; color:#555;">${businessEmail}${invoice.hidePhoneNumber ? "" : ` | ${businessPhone}`}</div>
  <div style="font-size:14px; color:#555;">ABN: ${businessAbn}</div>
</div>

<div class="right">
  <div><strong>Invoice #:</strong> ${invoice.invoiceNumber || ""}</div>
  <div><strong>Date:</strong> ${formatDateAU(invoice.invoiceDate)}</div>
  <div><strong>Due:</strong> ${formatDateAU(invoice.dueDate)}</div>
</div>
</div>

<div class="section">
<strong>Billed To:</strong><br/>
${clientName}<br/>
${clientEmail}
${clientDetails}
${purchaseOrderBlock}
</div>

<table>
<thead>
  <tr>
    <th>Description</th>
    <th>Qty</th>
    <th class="right">Unit Price</th>
    <th class="right">GST</th>
    <th class="right">Total</th>
  </tr>
</thead>
<tbody>
  ${(invoice.lineItems && invoice.lineItems.length > 0
    ? invoice.lineItems
    : [{ description: invoice.description || "Professional services", quantity: invoice.quantity || 1, unitPrice: safeNumber(invoice.subtotal) / Math.max(1, safeNumber(invoice.quantity || 1)), rowGst: invoice.gst, rowTotal: invoice.total }]
  ).map((item) => {
    const qty = safeNumber(item.quantity || item.qty || 1);
    const unit = safeNumber(item.unitPrice || item.unit || 0);
    const rowSub = unit * qty;
    const rowGst = safeNumber(item.rowGst != null ? item.rowGst : ((item.gstType || "GST on Income (10%)") === "GST on Income (10%)" ? rowSub * 0.1 : 0));
    const rowTotal = rowSub + rowGst;
    return `<tr>
    <td>${escapeHtml(item.description || "Service")}</td>
    <td>${qty}</td>
    <td class="right">${money(unit)}</td>
    <td class="right">${money(rowGst)}</td>
    <td class="right">${money(rowTotal)}</td>
  </tr>`;
  }).join("")}
</tbody>
</table>

<div class="totals">
<div><span>Subtotal (ex GST)</span><span>${money(invoice.subtotal)}</span></div>
<div><span>GST</span><span>${money(invoice.gst)}</span></div>
<div><span>GST status</span><span>${gstStatus}</span></div>
<div><span>Less fees</span><span>${money(feeAmount)}</span></div>
<div><span>Less tax withheld</span><span>${money(taxWithheld)}</span></div>
<div class="total"><span>Amount Due</span><span>${money(invoice.total)}</span></div>
<div class="total"><span>Net expected</span><span>${money(netExpected)}</span></div>
</div>

<div class="payment">
<strong>Please make payment to:</strong>
<div style="margin-top:10px; font-size:14px;">
  ${profile.bankName ? `<div><strong>Account Name:</strong> ${profile.bankName}</div>` : ""}
  ${profile.bsb ? `<div><strong>BSB:</strong> ${profile.bsb}</div>` : ""}
  ${profile.accountNumber ? `<div><strong>Account Number:</strong> ${profile.accountNumber}</div>` : ""}
  ${profile.payId ? `<div><strong>PayID:</strong> ${profile.payId}</div>` : ""}
</div>
<div style="margin-top:10px; font-size:13px; color:#555;">
  Please use reference: ${paymentReference}
</div>
${stripeCheckoutUrl || profile.paypalPaymentLink
    ? `<div style="margin-top:16px; padding:14px; border:1px solid #E2E8F0; border-radius:12px; background:#F7F6F5;">
        <div style="font-weight:700; color:#14202B; margin-bottom:8px;">Pay Online</div>
        <div style="font-size:13px; color:#555; margin-bottom:10px;">Choose your preferred payment method below.</div>
        ${stripeCheckoutUrl
      ? `<a href="${stripeCheckoutUrl}" target="_blank" rel="noreferrer" style="display:inline-block; margin-right:10px; background:#6A1B9A; color:#FFFFFF; text-decoration:none; padding:10px 16px; border-radius:10px; font-weight:700;">Pay with Card</a>`
      : ""
    }
        ${profile.paypalPaymentLink
      ? `<a href="${profile.paypalPaymentLink}" target="_blank" rel="noreferrer" style="display:inline-block; background:#0070BA; color:#FFFFFF; text-decoration:none; padding:10px 16px; border-radius:10px; font-weight:700;">Pay with PayPal</a>`
      : ""
    }
      </div>`
    : ""
  }
</div>

<div class="footer">
<div>For any queries please contact ${profile.businessName || "Your business"}</div>
<div>Private & Confidential</div>
</div>

<script>
  document.getElementById('print-btn') && document.getElementById('print-btn').addEventListener('click', function() { window.print(); });
</script>
</body>
</html>`;
}

export function openBlobUrlInWindow(w, blob) {
const url = URL.createObjectURL(blob);
try {
  if (w.location.origin === "null") {
    try {
      URL.revokeObjectURL(w.location.href);
    } catch (error) {
      console.warn("Could not revoke previous preview URL", error);
    }
  }
} catch (error) {
  console.warn("Could not inspect previous preview URL", error);
}
w.location.href = url;
const revoke = () => {
  try {
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn("Could not revoke preview URL", error);
  }
};
try {
  w.addEventListener("beforeunload", revoke, { once: true });
} catch (error) {
  console.warn("Preview cleanup listener failed", error);
}
setTimeout(revoke, 60000);
try {
  w.focus();
} catch (error) {
  console.warn("Preview window focus failed", error);
}
}

export function writeInvoicePreviewToWindow(w, invoice, stripeCheckoutUrl = "", options = {}, ctx = {}) {
const html = buildInvoiceHtml(invoice, stripeCheckoutUrl, options, ctx);
const blob = new Blob([html], { type: "text/html" });
openBlobUrlInWindow(w, blob);
}


// ── ATO Tax Form Page — proper component so useState works ───────────────────

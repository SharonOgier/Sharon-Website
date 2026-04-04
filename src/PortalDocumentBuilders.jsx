const colours = {
  purple: "#6A1B9A",
  teal: "#006D6D",
  navy: "#2B2F6B",
  bg: "#F8FAFC",
  white: "#FFFFFF",
  text: "#14202B",
  muted: "#64748B",
  border: "#E2E8F0",
  lightPurple: "#F5ECFB",
  lightTeal: "#E7F6F5",
  successText: "#166534",
};

const LOGO_DOCUMENT_MAX_HEIGHT = 140;
const LOGO_DOCUMENT_MAX_WIDTH = 440;
const LOGO_PREVIEW_MAX_HEIGHT = 180;
const LOGO_PREVIEW_MAX_WIDTH = 480;

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const collectValidationErrors = (...groups) => groups.flat().filter(Boolean);

const summariseValidationErrors = (title, errors, toastFn) => {
  if (!errors.length) return;
  if (toastFn) {
    errors.forEach((e) => toastFn.error(e, title));
  }
};

const DEFAULT_API_BASE_URL =
  ((typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL)
    ? String(import.meta.env.VITE_API_BASE_URL).trim()
    : "") ||
  (typeof window !== "undefined"
    ? (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      )
        ? "http://localhost:3001"
        : (typeof window !== "undefined" ? window.location.origin : "")
    : (typeof window !== "undefined" ? window.location.origin : ""));

const normaliseApiBaseUrl = (value) => String(value || "").trim().replace(/\/$/, "");

const getApiBaseUrl = (preferredValue = "") => {
  const fallbackUrl = normaliseApiBaseUrl(DEFAULT_API_BASE_URL);
  const rawCandidate = normaliseApiBaseUrl(preferredValue);

  if (!rawCandidate) {
    return fallbackUrl;
  }

  try {
    const parsed = new URL(rawCandidate);

    if (typeof window !== "undefined") {
      const pageIsLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const candidateIsLocal =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1";

      if (!pageIsLocal && candidateIsLocal) {
        return fallbackUrl;
      }

      if (window.location.protocol === "https:" && parsed.protocol !== "https:") {
        return fallbackUrl;
      }
    }

    return parsed.origin.replace(/\/$/, "");
  } catch (error) {
    console.warn("Invalid API base URL, falling back to default.", {
      preferredValue,
      fallbackUrl,
      error,
    });
    return fallbackUrl;
  }
};

const LOCKED_FEE_RATE_PERCENT = 1;
const DEFAULT_MONTHLY_SUBSCRIPTION = 45;

const SUPABASE_STORAGE_BUCKET = "receipts";

const SUPABASE_TABLES = {
  profile: "sas_profile",
  clients: "sas_clients",
  invoices: "sas_invoices",
  quotes: "sas_quotes",
  expenses: "sas_expenses",
  incomeSources: "sas_income_sources",
  services: "sas_services",
  documents: "sas_documents",
  suppliers: "sas_suppliers",
};

const SUPABASE_SCHEMA_SQL = `-- Run this once in Supabase SQL Editor
create table if not exists sas_profile (
  id bigint primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists sas_profile_user_id_idx on sas_profile (user_id);

create table if not exists sas_clients (
  id bigint primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists sas_clients_user_id_idx on sas_clients (user_id);

create table if not exists sas_invoices (
  id bigint primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists sas_invoices_user_id_idx on sas_invoices (user_id);

create table if not exists sas_quotes (
  id bigint primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists sas_quotes_user_id_idx on sas_quotes (user_id);

create table if not exists sas_expenses (
  id bigint primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists sas_expenses_user_id_idx on sas_expenses (user_id);

create table if not exists sas_income_sources (
  id bigint primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists sas_income_sources_user_id_idx on sas_income_sources (user_id);

create table if not exists sas_services (
  id bigint primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists sas_services_user_id_idx on sas_services (user_id);

create table if not exists sas_documents (
  id bigint primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists sas_documents_user_id_idx on sas_documents (user_id);

create table if not exists sas_suppliers (
  id bigint primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists sas_suppliers_user_id_idx on sas_suppliers (user_id);`;

const GST_TYPE_OPTIONS = [
  { value: "GST on Income (10%)", label: "GST on Income (10%)" },
  { value: "GST Free", label: "GST Free" },
  { value: "Input taxed / No GST", label: "Input taxed / No GST" },
];

const expenseCategories = [
  "Advertising",
  "Bank Fees",
  "Cost of goods sold",
  "Depreciation",
  "Insurance",
  "Motor vehicle expenses",
  "Office Supplies",
  "Printing",
  "Rent",
  "Repairs and maintenance",
  "Software",
  "Stationery",
  "Subscriptions",
  "Telephone and internet",
  "Travel",
  "Utilities",
  "Wages",
  "Other",
];

const incomeTypeOptions = [
  "Casual employment",
  "Salary",
  "Centrelink/Australian government payments",
  "Rental income",
  "Australian interest",
  "Australian dividends",
  "Income earned outside Australia",
  "Cryptocurrency gain/loss",
  "Capital gain/loss from sale of shares",
  "Managed funds distribution",
  "Partnership income",
  "Taxed government pension",
  "Superannuation lump sum payment",
  "Estate or trust income",
  "Capital gain/loss from property sale",
];

const incomeFrequencyOptions = [
  "Weekly",
  "Fortnightly",
  "Monthly",
  "Quarterly",
  "Annually",
  "One-off",
];

const inputStyle = {
  width: "100%",
  border: `1px solid ${colours.border}`,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  boxSizing: "border-box",
  background: colours.white,
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: colours.text,
  marginBottom: 6,
};

const cardStyle = {
  background: colours.white,
  border: `1px solid ${colours.border}`,
  borderRadius: 18,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const buttonPrimary = {
  background: colours.purple,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const buttonSecondary = {
  background: colours.white,
  color: colours.text,
  border: `1px solid ${colours.border}`,
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const currency = (value) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Only allow genuine base64 image data URLs -- prevents HTML/script injection via logo field
const safeLogoDataUrl = (value) =>
  typeof value === "string" && /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value.trim())
    ? value.trim()
    : "";

const nl2br = (value) => escapeHtml(value).replace(/\n/g, "<br/>");

// Parse YYYY-MM-DD as LOCAL date (not UTC) -- prevents day-shift in AU timezones
const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  const parts = String(dateString).slice(0, 10).split("-");
  if (parts.length !== 3) return new Date(dateString);
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
};

// Get today in YYYY-MM-DD local time (not UTC)
const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDateAU = (date) => {
  if (!date) return "";
  const d = parseLocalDate(date);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const addDays = (dateString, days) => {
  const base = parseLocalDate(dateString);
  base.setDate(base.getDate() + safeNumber(days));
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// End of month + 30 days: go to last day of the bill's month, then add 30 days
const addDaysEOM = (dateString) => {
  const base = parseLocalDate(dateString);
  const eom = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  eom.setDate(eom.getDate() + 30);
  const y = eom.getFullYear();
  const m = String(eom.getMonth() + 1).padStart(2, "0");
  const d = String(eom.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const nextNumber = (prefix, items, key) => {
  const nums = items
    .map((item) => String(item[key] || ""))
    .map((v) => Number((v.split("-")[1] || "0").replace(/\D/g, "")))
    .filter((v) => Number.isFinite(v));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
};

const makePaymentReference = (invoiceNumber) => `SAS-${invoiceNumber}`;

const currencyCodeFromLabel = (label) => {
  const value = String(label || "").toUpperCase();
  if (value.includes("USD")) return "USD";
  if (value.includes("NZD")) return "NZD";
  if (value.includes("GBP")) return "GBP";
  if (value.includes("EUR")) return "EUR";
  return "AUD";
};

const formatCurrencyByCode = (value, currencyCode = "AUD") =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const getClientCurrencyCode = (client) => currencyCodeFromLabel(client?.defaultCurrency || "AUD $");

const calculateAdjustmentValues = ({ subtotal = 0, total = 0, client, profile }) => {
  const feeAmount = client?.feesDeducted ?
    total * (LOCKED_FEE_RATE_PERCENT / 100) : 0;
  const taxWithheld = client?.deductsTaxPrior ? subtotal * (safeNumber(profile?.taxRate) / 100) : 0;
  const netExpected = total - feeAmount - taxWithheld;
  return {
    feeAmount,
    taxWithheld,
    netExpected,
  };
};

const buildPayPalInvoiceUrl = ({ businessEmail = "", amount = 0, currencyCode = "AUD", invoiceNumber = "" }) => {
  const email = String(businessEmail || "").trim();
  const total = safeNumber(amount);
  if (!email || total <= 0) return "";
  const params = new URLSearchParams({
    cmd: "_xclick",
    business: email,
    amount: total.toFixed(2),
    currency_code: String(currencyCode || "AUD").toUpperCase(),
    item_name: `Invoice ${invoiceNumber || ""}`.trim(),
    invoice: String(invoiceNumber || ""),
    charset: "UTF-8",
  });
  return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
};


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
.paypal-button { background:#003087; color:#fff; border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer; }
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
  ${safeLogoDataUrl(profile.logoDataUrl)
    ? `<div style="margin-bottom:12px;"><img src="${safeLogoDataUrl(profile.logoDataUrl)}" alt="Logo" style="max-height:${LOGO_DOCUMENT_MAX_HEIGHT}px; max-width:${LOGO_DOCUMENT_MAX_WIDTH}px; object-fit:contain;" /></div>`
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
    ${safeLogoDataUrl(profile.logoDataUrl)
      ? `<div style="margin-bottom:16px;"><img src="${safeLogoDataUrl(profile.logoDataUrl)}" alt="Logo" style="max-height:${LOGO_PREVIEW_MAX_HEIGHT}px; max-width:${LOGO_PREVIEW_MAX_WIDTH}px; object-fit:contain;" /></div>`
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
const paypalCheckoutUrl = buildPayPalInvoiceUrl({
  businessEmail: profile.paypalBusinessEmail,
  amount: invoice.total,
  currencyCode,
  invoiceNumber: invoice.invoiceNumber || paymentReference,
});

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
.paypal-button { background:#003087; color:#fff; border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer; }
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
  ${safeLogoDataUrl(profile.logoDataUrl)
    ? `<div style="margin-bottom:12px;"><img src="${safeLogoDataUrl(profile.logoDataUrl)}" alt="Logo" style="max-height:${LOGO_DOCUMENT_MAX_HEIGHT}px; max-width:${LOGO_DOCUMENT_MAX_WIDTH}px; object-fit:contain;" /></div>`
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
<div style="margin-top:16px; padding:14px; border:1px solid #E2E8F0; border-radius:12px; background:#F7F6F5;">
  <div style="font-weight:700; color:#14202B; margin-bottom:8px;">Pay Online</div>
  <div style="font-size:13px; color:#555; margin-bottom:10px;">Choose your preferred payment method below.</div>
  ${stripeCheckoutUrl
    ? `<a href="${stripeCheckoutUrl}" target="_blank" rel="noreferrer" style="display:inline-block; margin-right:10px; background:#6A1B9A; color:#FFFFFF; text-decoration:none; padding:10px 16px; border-radius:10px; font-weight:700;">Pay with Card</a>`
    : ""
  }
  <button onclick="if(window.opener && window.opener.payInvoiceWithPayPal) { window.opener.payInvoiceWithPayPal(${JSON.stringify({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, total: invoice.total, currencyCode: invoice.currencyCode || 'AUD', clientId: invoice.clientId })}); } else { alert('Please use the Pay with PayPal button in the portal.'); }" style="display:inline-block; background:#003087; color:#FFFFFF; border:none; padding:10px 16px; border-radius:10px; font-weight:700; cursor:pointer;">Pay with PayPal</button>
</div>
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



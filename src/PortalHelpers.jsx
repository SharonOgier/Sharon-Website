import html2pdf from "html2pdf.js";

export const colours = {
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

const navItems = [
  "dashboard",
  "financial insights",
  "invoices",
  "quotes",
  "clients",
  "services",
  "expenses",
  "bills / payables",
  "income sources",
  "documents",
  "bas report",
  "ato tax form",
  "settings",
];

export const navSections = [
  {
    title: "Main",
    items: ["dashboard", "financial insights", "invoices", "quotes", "expenses"],
  },
  {
    title: "Workspace",
    items: ["clients", "services", "bills / payables", "income sources", "documents"],
  },
  {
    title: "Admin",
    items: ["bas report", "ato tax form", "settings"],
  },
];

export const navLabels = {
  dashboard: "Home",
  "financial insights": "Financial Insights",
  invoices: "Invoices",
  quotes: "Quotes",
  clients: "Clients",
  services: "Services",
  expenses: "Expenses",
  "bills / payables": "Bills & Payables",
  "income sources": "Income Sources",
  documents: "Documents",
  "bas report": "BAS Report",
  "ato tax form": "ATO Tax Form",
  settings: "Settings",
};

export const settingsTabs = ["Profile", "Financial", "Branding", "Security"];

const LOGO_DOCUMENT_MAX_HEIGHT = 140;
const LOGO_DOCUMENT_MAX_WIDTH = 440;
export const LOGO_PREVIEW_MAX_HEIGHT = 180;
export const LOGO_PREVIEW_MAX_WIDTH = 480;

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

export const collectValidationErrors = (...groups) => groups.flat().filter(Boolean);

export const summariseValidationErrors = (title, errors, toastFn) => {
  if (!errors.length) return;
  if (toastFn) {
    errors.forEach((e) => toastFn.error(e, title));
  }
};

export const DEFAULT_API_BASE_URL =
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

export const getApiBaseUrl = (preferredValue = "") => {
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

export const LOCKED_FEE_RATE_PERCENT = 1;
export const DEFAULT_MONTHLY_SUBSCRIPTION = 45;

export const SUPABASE_STORAGE_BUCKET = "receipts";

export const SUPABASE_TABLES = {
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

export const GST_TYPE_OPTIONS = [
  { value: "GST on Income (10%)", label: "GST on Income (10%)" },
  { value: "GST Free", label: "GST Free" },
  { value: "Input taxed / No GST", label: "Input taxed / No GST" },
];

export const expenseCategories = [
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

export const incomeTypeOptions = [
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

export const incomeFrequencyOptions = [
  "Weekly",
  "Fortnightly",
  "Monthly",
  "Quarterly",
  "Annually",
  "One-off",
];

export const inputStyle = {
  width: "100%",
  border: `1px solid ${colours.border}`,
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  lineHeight: 1.4,
  boxSizing: "border-box",
  background: colours.white,
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
};

export const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: colours.text,
  marginBottom: 8,
};

export const cardStyle = {
  background: colours.white,
  border: `1px solid ${colours.border}`,
  borderRadius: 22,
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
};

export const buttonPrimary = {
  background: colours.purple,
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "11px 16px",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(106, 27, 154, 0.18)",
};

export const buttonSecondary = {
  background: colours.white,
  color: colours.text,
  border: `1px solid ${colours.border}`,
  borderRadius: 12,
  padding: "11px 16px",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
};

export const currency = (value) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

export const safeNumber = (value) => {
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

const nl2br = (value) => escapeHtml(value).replace(/\n/g, "<br/>");

// Parse YYYY-MM-DD as LOCAL date (not UTC) — prevents day-shift in AU timezones
export const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  const parts = String(dateString).slice(0, 10).split("-");
  if (parts.length !== 3) return new Date(dateString);
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
};

// Get today in YYYY-MM-DD local time (not UTC)
export const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const formatDateAU = (date) => {
  if (!date) return "";
  const d = parseLocalDate(date);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const addDays = (dateString, days) => {
  const base = parseLocalDate(dateString);
  base.setDate(base.getDate() + safeNumber(days));
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// End of month + 30 days: go to last day of the bill's month, then add 30 days
export const addDaysEOM = (dateString) => {
  const base = parseLocalDate(dateString);
  const eom = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  eom.setDate(eom.getDate() + 30);
  const y = eom.getFullYear();
  const m = String(eom.getMonth() + 1).padStart(2, "0");
  const d = String(eom.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const nextNumber = (prefix, items, key) => {
  const nums = items
    .map((item) => String(item[key] || ""))
    .map((v) => Number((v.split("-")[1] || "0").replace(/\D/g, "")))
    .filter((v) => Number.isFinite(v));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
};

export const makePaymentReference = (invoiceNumber) => `SAS-${invoiceNumber}`;

const currencyCodeFromLabel = (label) => {
  const value = String(label || "").toUpperCase();
  if (value.includes("USD")) return "USD";
  if (value.includes("NZD")) return "NZD";
  if (value.includes("GBP")) return "GBP";
  if (value.includes("EUR")) return "EUR";
  return "AUD";
};

export const formatCurrencyByCode = (value, currencyCode = "AUD") =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

export const getClientCurrencyCode = (client) => currencyCodeFromLabel(client?.defaultCurrency || "AUD $");

export const calculateAdjustmentValues = ({ subtotal = 0, total = 0, client, profile }) => {
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

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const parts = result.split(",");
      resolve(parts[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const generatePdfBase64FromHtml = async (html, filename = "document.pdf") => {
  const markup = String(html || "").trim();
  if (!markup) return "";

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#ffffff";
  container.style.zIndex = "-1";
  container.innerHTML = markup;
  document.body.appendChild(container);

  try {
    const worker = html2pdf()
      .set({
        margin: 10,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container);

    const pdfBlob = await worker.outputPdf("blob");
    return await blobToBase64(pdfBlob);
  } finally {
    container.remove();
  }
};

export const blankClient = {
  name: "",
  email: "",
  phone: "",
  address: "",
  contactPerson: "",
  workType: "Financial / Management Accountant",
  recruiterUsed: false,
  sendToClient: true,
  sendToMe: false,
  autoReminders: true,
  attachPdf: false,
  includeAddressDetails: true,
  addressDetails: "",
  sendReceipts: true,
  outsideAustraliaOrGstExempt: false,
  defaultCurrency: "AUD $",
  feesDeducted: false,
  deductsTaxPrior: false,
  shortTermRentalIncome: false,
  hasPurchaseOrder: false,
};

export const initialProfile = {
  businessName: "",
  abn: "",
  email: "",
  phone: "",
  address: "",
  invoicePrefix: "INV",
  quotePrefix: "QUO",
  paymentTermsDays: 14,
  taxRate: 30,
  feeRate: LOCKED_FEE_RATE_PERCENT,
  gstRegistered: true,

  bankName: "",
  bsb: "",
  accountNumber: "",
  payId: "",
  stripePaymentLink: "",
  paypalPaymentLink: "",
  stripeServerUrl: DEFAULT_API_BASE_URL,

  firstName: "",
  middleNames: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  personalAddress: "",
  workType: "Financial / Management Accountant",

  tfn: "",
  studentLoan: false,
  gstFreeSales: false,
  homeOfficePercent: "",

  logoFileName: "",
  logoDataUrl: "",

  legalBusinessName: "",
  hideLegalNameOnDocs: false,
  hideAddressOnDocs: false,
  hidePhoneOnDocs: true,

  twoFactor: false,
  setupComplete: false,
  setupCompletedAt: "",
  monthlySubscription: DEFAULT_MONTHLY_SUBSCRIPTION,
  accountStatus: "",
  trialStartedAt: "",
  subscriptionStatus: "",
  subscriptionId: "",
  stripeCustomerId: "",
};

export const initialClients = [];
export const initialInvoices = [];
export const initialQuotes = [];
export const initialExpenses = [];
export const initialIncomeSources = [];
export const initialDocuments = [];


export const formatMonthKey = (value) => {
  if (!value) return "Unknown";
  const parsed = parseLocalDate(String(value).slice(0, 10));
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

export const formatMonthLabel = (value) => {
  if (!value || value === "Unknown") return "Unknown";
  const parsed = parseLocalDate(`${value}-01`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
};

const TRIAL_DAYS = 14;
const FREE_ACCESS_EMAILS = [];

export function getSubscriptionAccess(profile) {
  const MASTER_EMAILS = ["info@sharonogier.com", "sharon@sharonogier.com"];
  const email = (profile?.email || "").toLowerCase().trim();
  if (MASTER_EMAILS.includes(email)) return { allowed: true, reason: "master" };
  if (FREE_ACCESS_EMAILS.includes(email)) return { allowed: true, reason: "whitelisted" };
  const status = profile?.subscriptionStatus || "";
  const trialStarted = profile?.trialStartedAt || profile?.setupCompletedAt || "";
  if (status === "active") return { allowed: true, reason: "active" };
  if (trialStarted) {
    const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - (Date.now() - new Date(trialStarted).getTime()) / (1000 * 60 * 60 * 24)));
    if (daysLeft > 0) return { allowed: true, reason: "trial", daysLeft };
    return { allowed: false, reason: "trial_expired", daysLeft: 0 };
  }
  if (!profile?.setupComplete) return { allowed: true, reason: "setup" };
  if (status === "canceled" || status === "past_due") return { allowed: false, reason: status };
  return { allowed: true, reason: "legacy" };
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { supabase } from "./client";



// ── Toast notification system ──────────────────────────────
export function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="sas-toasts" style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 99999,
      display: "grid", gap: 10, maxWidth: 380,
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "14px 16px",
          borderRadius: 14,
          boxShadow: "0 4px 24px rgba(0,0,0,0.13)",
          background: t.type === "error" ? "#FEE2E2"
            : t.type === "success" ? "#DCFCE7"
            : t.type === "warning" ? "#FEF9C3"
            : "#EFF6FF",
          borderLeft: `4px solid ${
            t.type === "error" ? "#EF4444"
            : t.type === "success" ? "#22C55E"
            : t.type === "warning" ? "#EAB308"
            : "#3B82F6"
          }`,
          fontSize: 14,
          color: "#14202B",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          minWidth: 280,
          animation: "toastIn 0.2s ease",
        }}>
          <div style={{ flex: 1, lineHeight: 1.5 }}>
            {t.title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.title}</div>}
            <div style={{ fontWeight: t.title ? 400 : 600 }}>{t.message}</div>
          </div>
          <button onClick={() => onRemove(t.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 18, lineHeight: 1, color: "#64748B", padding: 0, marginTop: -1,
          }}>×</button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = React.useState([]);
  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const add = (message, type = "info", title = "", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-4), { id, message, type, title }]);
    if (duration > 0) setTimeout(() => remove(id), duration);
  };
  const toast = {
    success: (message, title = "")  => add(message, "success", title),
    error:   (message, title = "")  => add(message, "error",   title, 6000),
    warning: (message, title = "")  => add(message, "warning", title),
    info:    (message, title = "")  => add(message, "info",    title),
  };
  return { toasts, toast, removeToast: remove };
}
// ────────────────────────────────────────────────────────────

// ── Confirm Modal ────────────────────────────────────────────
function ConfirmModal({ isOpen, title, message, confirmLabel = "Delete", onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99998, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#14202B", marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ background: "#fff", color: "#14202B", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Cancel</button>
          <button onClick={onConfirm} style={{ background: "#EF4444", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [confirmState, setConfirmState] = React.useState(null);
  const confirm = ({ title, message, confirmLabel = "Delete", onConfirm }) => {
    setConfirmState({ title, message, confirmLabel, onConfirm });
  };
  const close = () => setConfirmState(null);
  const modal = confirmState ? (
    <ConfirmModal isOpen title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel}
      onConfirm={() => { close(); confirmState.onConfirm(); }} onCancel={close} />
  ) : null;
  return { confirm, modal };
}
// ─────────────────────────────────────────────────────────────

// ── Subscription helpers ──────────────────────────────────────
const TRIAL_DAYS = 14;

// ── Add client emails here to give free access (no Stripe needed) ──
const FREE_ACCESS_EMAILS = [
  // "clientname@example.com",  ← add emails here, one per line
];

export function getSubscriptionAccess(profile) {
  // Master account — always full access, no paywall
  const MASTER_EMAILS = ["info@sharonogier.com", "sharon@sharonogier.com"];
  const email = (profile?.email || "").toLowerCase().trim();
  if (MASTER_EMAILS.includes(email)) return { allowed: true, reason: "master" };
  // Whitelisted clients — free access granted by Sharon
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

export function PaywallScreen({ profile, serverBaseUrl }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const access = getSubscriptionAccess(profile);
  const handleSubscribe = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${serverBaseUrl}/api/create-subscription-checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, userId: profile.user_id || profile.id, businessName: profile.businessName, successUrl: window.location.origin + "?subscribed=1", cancelUrl: window.location.origin + "?subscribed=0" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "Could not start checkout. Please try again.");
    } catch { setError("Could not reach the server. Please try again."); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#6A1B9A", marginBottom: 8 }}>{profile.businessName || "Your Portal"}</div>
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 32, marginTop: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{access.reason === "trial_expired" ? "⏰" : "🔒"}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#14202B", marginBottom: 10 }}>
            {access.reason === "trial_expired" ? "Your free trial has ended" : "Subscription required"}
          </div>
          <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, marginBottom: 24 }}>
            {access.reason === "trial_expired" ? "Subscribe now to keep access to all your invoices, clients, quotes and financial data." : "Reactivate your subscription to regain access."}
          </div>
          <div style={{ background: "#F5ECFB", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#6A1B9A" }}>${DEFAULT_MONTHLY_SUBSCRIPTION}</div>
            <div style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>per month · cancel anytime</div>
          </div>
          {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>}
          <button onClick={handleSubscribe} disabled={loading} style={{ width: "100%", background: loading ? "#9CA3AF" : "#6A1B9A", color: "#fff", border: "none", borderRadius: 12, padding: "14px 20px", fontSize: 16, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Redirecting to checkout..." : "Subscribe now — $" + DEFAULT_MONTHLY_SUBSCRIPTION + "/month"}
          </button>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 14 }}>Secure payment via Stripe · Cancel anytime</div>
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 20 }}>
          Already subscribed? <button onClick={() => window.location.reload()} style={{ background: "none", border: "none", color: "#6A1B9A", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Refresh to continue</button>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────

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
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  boxSizing: "border-box",
  background: colours.white,
};

export const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: colours.text,
  marginBottom: 6,
};

export const cardStyle = {
  background: colours.white,
  border: `1px solid ${colours.border}`,
  borderRadius: 18,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

export const buttonPrimary = {
  background: colours.purple,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

export const buttonSecondary = {
  background: colours.white,
  color: colours.text,
  border: `1px solid ${colours.border}`,
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
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

export function SectionCard({ title, children, right }) {
  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 800,
            color: colours.text,
          }}
        >
          {title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function SummaryBox({ title, value, subtitle }) {
  return (
    <div style={{ ...cardStyle, padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: colours.muted }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: colours.text,
          marginTop: 6,
        }}
      >
        {value}
      </div>
      {subtitle ? (
        <div style={{ fontSize: 12, color: colours.muted, marginTop: 6 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

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

export function DashboardHero({ title, subtitle, highlight, children }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colours.navy} 0%, ${colours.purple} 58%, ${colours.teal} 100%)`,
        borderRadius: 24,
        padding: 28,
        color: "#FFFFFF",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.7fr) minmax(280px, 1fr)",
        gap: 24,
        alignItems: "stretch",
        boxShadow: "0 18px 40px rgba(43, 47, 107, 0.18)",
      }}
      className="sas-hero-grid"
    >
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.14)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          Live financial reporting
        </div>
        <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 16 }}>{title}</div>
        <div style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.92, marginTop: 12, maxWidth: 780 }}>{subtitle}</div>
      </div>
      <div
        style={{
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: 22,
          padding: 22,
          display: "grid",
          gap: 16,
          alignContent: "space-between",
          minHeight: 200,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.82 }}>
            Current focus
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 10 }}>{highlight}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function InsightChip({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        borderRadius: 14,
        padding: "12px 14px",
        background: "rgba(255,255,255,0.14)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.84 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

export function MetricCard({ title, value, subtitle, accent = colours.purple }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: 18,
        position: "relative",
        overflow: "hidden",
        minHeight: 132,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${accent}12 0%, rgba(255,255,255,0) 76%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.2, color: colours.muted, textTransform: "uppercase" }}>{title}</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: colours.text, marginTop: 10 }}>{value}</div>
        <div style={{ fontSize: 12, color: colours.muted, marginTop: 10, lineHeight: 1.5 }}>{subtitle}</div>
      </div>
    </div>
  );
}

export function ActionHubCard({ icon, title, description, buttonLabel, onClick, tone = colours.purple }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: 20,
        display: "grid",
        gap: 12,
        border: `1px solid ${colours.border}`,
        minHeight: 196,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `${tone}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: colours.text }}>{title}</div>
        <div style={{ fontSize: 13, color: colours.muted, lineHeight: 1.6, marginTop: 6 }}>{description}</div>
      </div>
      <div style={{ marginTop: "auto" }}>
        <button onClick={onClick} style={{ ...buttonPrimary, background: tone, width: "100%" }}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export function MiniBarChart({ data, valueKey = "value", labelKey = "label", height = 80, accent = colours.teal }) {
  const max = Math.max(...(data || []).map((d) => safeNumber(d?.[valueKey])), 1);
  if (!data || !data.length) return <div style={{ fontSize: 12, color: colours.muted }}>No data yet.</div>;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, paddingTop: 4 }}>
      {data.map((d, i) => {
        const val = safeNumber(d?.[valueKey]);
        const barH = max > 0 ? Math.max(4, (val / max) * (height - 20)) : 4;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 9, color: colours.muted, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", maxWidth: "100%", textOverflow: "ellipsis" }}>
              {currency ? currency(val) : val}
            </div>
            <div style={{ width: "100%", height: barH, borderRadius: "4px 4px 0 0", background: `linear-gradient(180deg, ${accent} 0%, ${colours.navy} 100%)`, minHeight: 4 }} />
            <div style={{ fontSize: 9, color: colours.muted, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", maxWidth: "100%", textOverflow: "ellipsis" }}>
              {d?.[labelKey]}
            </div>
          </div>
        );
      })}
    </div>
  );
}


export function TrendBarsCard({ title, subtitle, data, valueKey, labelKey = "label", formatValue = (value) => value, accent = colours.teal, emptyText = "No data yet." }) {
  const max = Math.max(...(data || []).map((item) => safeNumber(item?.[valueKey])), 0);
  return (
    <SectionCard title={title} right={<div style={{ fontSize: 12, color: colours.muted }}>{subtitle}</div>}>
      {data && data.length ? (
        <div style={{ display: "grid", gap: 14 }}>
          {data.map((item) => {
            const value = safeNumber(item?.[valueKey]);
            const width = max > 0 ? Math.max(10, (value / max) * 100) : 0;
            return (
              <div key={`${item?.[labelKey]}-${value}`} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colours.text }}>{item?.[labelKey]}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colours.text }}>{formatValue(value, item)}</div>
                </div>
                <div style={{ height: 12, borderRadius: 999, background: colours.bg, overflow: "hidden" }}>
                  <div style={{ width: `${width}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${accent} 0%, ${colours.purple} 100%)` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: colours.muted }}>{emptyText}</div>
      )}
    </SectionCard>
  );
}

export function WaterfallCard({ title, rows }) {
  const max = Math.max(...(rows || []).map((row) => Math.abs(safeNumber(row?.value))), 0);
  return (
    <SectionCard title={title}>
      <div style={{ display: "grid", gap: 14 }}>
        {(rows || []).map((row) => {
          const value = safeNumber(row?.value);
          const width = max > 0 ? Math.max(8, (Math.abs(value) / max) * 100) : 0;
          const background = value >= 0 ? `linear-gradient(90deg, ${colours.teal} 0%, ${colours.navy} 100%)` : `linear-gradient(90deg, #F59E0B 0%, ${colours.purple} 100%)`;
          return (
            <div key={row.label} style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                <div style={{ fontWeight: 700, color: colours.text }}>{row.label}</div>
                <div style={{ fontWeight: 800, color: colours.text }}>{currency(value)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: value >= 0 ? "flex-start" : "flex-end" }}>
                <div style={{ width: `${width}%`, minWidth: width ? 54 : 0, height: 12, borderRadius: 999, background }} />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function ActivityListCard({ title, rows, emptyText = "No recent activity yet." }) {
  return (
    <SectionCard title={title}>
      {rows && rows.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => (
            <div
              key={`${row.type}-${row.label}-${row.date}`}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: 14,
                borderRadius: 16,
                background: colours.bg,
                border: `1px solid ${colours.border}`,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: row.type === "Expense" ? colours.purple : colours.teal,
                }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: colours.text }}>{row.label}</div>
                <div style={{ fontSize: 12, color: colours.muted, marginTop: 2 }}>{row.caption}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{row.value}</div>
                <div style={{ fontSize: 12, color: colours.muted, marginTop: 2 }}>{row.date}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: colours.muted }}>{emptyText}</div>
      )}
    </SectionCard>
  );
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "56px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: colours.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: colours.muted, lineHeight: 1.7, maxWidth: 360, marginBottom: action ? 24 : 0 }}>{message}</div>
      {action && (
        <button onClick={action.onClick} style={{
          background: colours.purple, color: "#fff", border: "none",
          borderRadius: 12, padding: "12px 24px", fontSize: 14,
          fontWeight: 700, cursor: "pointer",
        }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export function DataTable({ columns, rows, emptyState }) {
  if (!rows.length && emptyState) {
    return <EmptyState {...emptyState} />;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
        <thead>
          <tr style={{ background: "#F8FAFC" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: "left",
                  padding: 12,
                  fontSize: 13,
                  color: colours.muted,
                  borderBottom: `1px solid ${colours.border}`,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || idx}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: 12,
                    borderBottom: `1px solid ${colours.border}`,
                    fontSize: 14,
                    color: colours.text,
                    verticalAlign: "top",
                  }}
                >
                  {col.render ?
                    col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExpenseTypeModal({
  isOpen,
  onClose,
  expenseTypeStep,
  setExpenseTypeStep,
  expenseTypeSelection,
  setExpenseTypeSelection,
  expenseWorkType,
  setExpenseWorkType,
  expenseCategorySelection,
  setExpenseCategorySelection,
  expenseWorkTypes,
  setExpenseWorkTypes,
  searchExpenseCategory,
  setSearchExpenseCategory,
  expenseForm,
  setExpenseForm,
  receiptFile,
  setReceiptFile,
  onNext,
  toast = { warning: () => {} },
}) {
  if (!isOpen) return null;
  const filteredCategories = expenseCategories.filter((item) =>
    item.toLowerCase().includes(searchExpenseCategory.toLowerCase())
  );
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 500,
          background: colours.white,
          borderRadius: 8,
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: colours.navy,
            color: "#fff",
            padding: "16px 18px",
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          Select Expense type
        </div>

        <div style={{ padding: 16 }}>
          {expenseTypeStep === 1 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={labelStyle}>What kind of Expense is this? *</label>
                <select
                  style={inputStyle}
                  value={expenseTypeSelection}
                  onChange={(e) => setExpenseTypeSelection(e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Business Expense">Business Expense</option>
                  <option value="Client Reimbursement">Client Reimbursement</option>
                </select>
              </div>
            </div>
          )}

          {expenseTypeStep === 2 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={labelStyle}>What kind of Expense is this? *</label>
                <select
                  style={inputStyle}
                  value={expenseTypeSelection}
                  onChange={(e) => setExpenseTypeSelection(e.target.value)}
                >
                  <option value="Business Expense">Business Expense</option>
                  <option value="Client Reimbursement">Client Reimbursement</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Work type for this expense? *</label>
                <select
                  style={inputStyle}
                  value={expenseWorkType}
                  onChange={(e) => setExpenseWorkType(e.target.value)}
                >
                  {expenseWorkTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  style={{ ...buttonSecondary, padding: "8px 12px" }}
                  onClick={() => {
                    const newType = window.prompt("Add new work type");
                    if (newType && newType.trim()) {
                      const clean = newType.trim();
                      if (!expenseWorkTypes.includes(clean)) {
                        setExpenseWorkTypes((prev) => [...prev, clean]);
                      }
                      setExpenseWorkType(clean);
                    }
                  }}
                >
                  Add new work type +
                </button>
              </div>

              <div>
                <label style={labelStyle}>Expense category *</label>
                <input
                  style={inputStyle}
                  placeholder="Search category"
                  value={searchExpenseCategory}
                  onChange={(e) => setSearchExpenseCategory(e.target.value)}
                />
                <div
                  style={{
                    border: `1px solid ${colours.border}`,
                    borderTop: "none",
                    maxHeight: 180,
                    overflowY: "auto",
                    borderBottomLeftRadius: 10,
                    borderBottomRightRadius: 10,
                  }}
                >
                  {filteredCategories.map((item) => (
                    <div
                      key={item}
                      onClick={() => setExpenseCategorySelection(item)}
                      style={{
                        padding: 12,
                        cursor: "pointer",
                        background:
                          expenseCategorySelection === item ?
                            colours.lightTeal : colours.white,
                        borderBottom: `1px solid ${colours.border}`,
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {expenseTypeStep === 3 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={labelStyle}>Upload receipt</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  style={inputStyle}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setReceiptFile(file);
                    setExpenseForm((prev) => ({ ...prev,
                      receiptFileName: file.name,
                    }));
                  }}
                />
              </div>

              {expenseForm.receiptFileName ? (
                <div style={{ fontSize: 14, color: colours.muted }}>
                  Uploaded: {expenseForm.receiptFileName}
                </div>
              ) : <EmptyState icon="📁" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}

              {receiptFile ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={buttonSecondary}
                    onClick={() => {
                      const previewUrl = URL.createObjectURL(receiptFile);
                      const previewWindow = window.open(previewUrl, "_blank");
                      setTimeout(() => URL.revokeObjectURL(previewUrl), 60000);
                      if (!previewWindow) {
                        toast.warning("Preview popup was blocked by your browser.");
                      }
                    }}
                  >
                    Preview Receipt
                  </button>

                  <button
                    type="button"
                    style={buttonSecondary}
                    onClick={() => {
                      setReceiptFile(null);
                      setExpenseForm((prev) => ({ ...prev,
                        receiptFileName: "",
                        receiptUrl: "",
                      }));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : <EmptyState icon="📁" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: 16,
            borderTop: `1px solid ${colours.border}`,
          }}
        >
          <button
            style={{ ...buttonSecondary, flex: 1 }}
            onClick={() => {
              if (expenseTypeStep === 3) {
                setExpenseTypeStep(2);
              } else if (expenseTypeStep === 2) {
                setExpenseTypeStep(1);
              } else {
                onClose();
              }
            }}
          >
            Cancel
          </button>

          <button style={{ ...buttonPrimary, flex: 1 }} onClick={onNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function IncomeSourceModal({
  isOpen,
  onClose,
  incomeSourceForm,
  setIncomeSourceForm,
  onSave,
}) {
  if (!isOpen) return null;
  const selectedType = incomeSourceForm.incomeType;
  const showHelp = selectedType === "Casual employment";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: colours.white,
          borderRadius: 8,
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 18 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 18,
              color: colours.text,
              marginBottom: 16,
            }}
          >
            Create new Income Source
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={labelStyle}>Income Source *</label>
              <input
                style={inputStyle}
                value={incomeSourceForm.name}
                onChange={(e) =>
                  setIncomeSourceForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div>
              <label style={labelStyle}>Income type *</label>
              <select
                style={inputStyle}
                value={incomeSourceForm.incomeType}
                onChange={(e) =>
                  setIncomeSourceForm((prev) => ({ ...prev, incomeType: e.target.value }))
                }
              >
                <option value="">Select...</option>
                {incomeTypeOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {showHelp && (
              <div
                style={{
                  background: "#EEF4FF",
                  color: "#224C9A",
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                Casual income should not include any salary, self-employed or sole trader income.
                Your casual employment income tax rate will impact the tax you need to pay on your
                self-employed income.
              </div>
            )}

            <div>
              <label style={labelStyle}>Before tax I will earn *</label>
              <input
                style={inputStyle}
                placeholder="$ 0.00"
                value={incomeSourceForm.beforeTax}
                onChange={(e) =>
                  setIncomeSourceForm((prev) => ({ ...prev,
                    beforeTax: e.target.value.replace(/[^0-9.]/g, ""),
                  }))
                }
              />
            </div>

            <div>
              <label style={labelStyle}>Every *</label>
              <select
                style={inputStyle}
                value={incomeSourceForm.frequency}
                onChange={(e) =>
                  setIncomeSourceForm((prev) => ({ ...prev, frequency: e.target.value }))
                }
              >
                <option value="">Select...</option>
                {incomeFrequencyOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={incomeSourceForm.startedAfterDate}
                onChange={(e) =>
                  setIncomeSourceForm((prev) => ({ ...prev,
                    startedAfterDate: e.target.checked,
                  }))
                }
              />
              I started earning this income after 1 Jul 2025
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={incomeSourceForm.hasEndDate}
                onChange={(e) =>
                  setIncomeSourceForm((prev) => ({ ...prev,
                    hasEndDate: e.target.checked,
                  }))
                }
              />
              This Income Source has a fixed end date
            </label>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: 16,
            borderTop: `1px solid ${colours.border}`,
          }}
        >
          <button style={{ ...buttonSecondary, flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button style={{ ...buttonPrimary, flex: 1 }} onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Document builder functions (top-level for correct scope access) ──────────

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



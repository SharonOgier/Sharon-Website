import React, { useEffect, useMemo, useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { supabase } from "./client";



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

const navItems = [
  "dashboard",
  "financial insights",
  "clients",
  "invoices",
  "quotes",
  "services",
  "expenses",
  "income sources",
  "documents",
  "settings",
];

const settingsTabs = ["Profile", "Financial", "Branding", "Security"];

const LOGO_DOCUMENT_MAX_HEIGHT = 140;
const LOGO_DOCUMENT_MAX_WIDTH = 440;
const LOGO_PREVIEW_MAX_HEIGHT = 180;
const LOGO_PREVIEW_MAX_WIDTH = 480;

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const collectValidationErrors = (...groups) => groups.flat().filter(Boolean);

const summariseValidationErrors = (title, errors) => {
  if (!errors.length) return;
  alert(`${title}\n\n- ${errors.join("\n- ")}`);
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
        : "https://sharons-portal.onrender.com"
    : "https://sharons-portal.onrender.com");

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
};

const SUPABASE_SCHEMA_SQL = `-- Run this once in Supabase SQL Editor
create table if not exists sas_profile (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists sas_clients (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists sas_invoices (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists sas_quotes (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists sas_expenses (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists sas_income_sources (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists sas_services (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists sas_documents (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);`;

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

const formatDateAU = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const addDays = (dateString, days) => {
  const base = dateString ? new Date(dateString) : new Date();
  base.setDate(base.getDate() + safeNumber(days));
  return base.toISOString().slice(0, 10);
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

const fileToDataUrl = (file) =>
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

const blankClient = {
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

const initialProfile = {
  businessName: "",
  abn: "",
  email: "",
  phone: "",
  address: "",
  invoicePrefix: "INV",
  quotePrefix: "QUO",
  paymentTermsDays: 21,
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
};

const initialClients = [];
const initialInvoices = [];
const initialQuotes = [];
const initialExpenses = [];
const initialIncomeSources = [];
const initialDocuments = [];

function SectionCard({ title, children, right }) {
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

const formatMonthKey = (value) => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

const formatMonthLabel = (value) => {
  if (!value || value === "Unknown") return "Unknown";
  const parsed = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
};

function DashboardHero({ title, subtitle, highlight, children }) {
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

function InsightChip({ label, value }) {
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

function MetricCard({ title, value, subtitle, accent = colours.purple }) {
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

function TrendBarsCard({ title, subtitle, data, valueKey, labelKey = "label", formatValue = (value) => value, accent = colours.teal, emptyText = "No data yet." }) {
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

function WaterfallCard({ title, rows }) {
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

function ActivityListCard({ title, rows, emptyText = "No recent activity yet." }) {
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

function DataTable({ columns, rows }) {
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

function ExpenseTypeModal({
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
              ) : null}

              {receiptFile ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={buttonSecondary}
                    onClick={() => {
                      const previewUrl = URL.createObjectURL(receiptFile);
                      window.open(previewUrl, "_blank");
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
              ) : null}
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

function IncomeSourceModal({
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

function buildQuoteHtml(quote, options = {}, ctx = {}) {
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
const businessName = getDocumentBusinessName();
const businessAddress = getDocumentAddress();
const clientDetails =
  qClient?.includeAddressDetails && qClient?.addressDetails
    ? `<div style="margin-top:6px; color:#555;">${String(qClient.addressDetails).replace(/\n/g, "<br/>")}</div>`
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
  <div style="font-size:13px; color:#555;">${profile.email || ""}${quote.hidePhoneNumber ? "" : ` | ${profile.phone || ""}`}</div>
  <div style="font-size:13px; color:#555;">ABN: ${profile.abn}</div>
</div>

<div class="right">
  <div><strong>Quote ref:</strong> ${quote.quoteNumber || ""}</div>
  <div><strong>Quote date:</strong> ${formatDateAU(quote.quoteDate)}</div>
  <div><strong>Expiry date:</strong> ${formatDateAU(quote.expiryDate)}</div>
</div>
</div>

<div style="margin-top:20px; font-weight:700;">${qClient?.name || ""}</div>
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
  <tr>
    <td>${quote.description || "Professional services"}</td>
    <td>${quote.quantity || 1}</td>
    <td style="text-align:right">${money(safeNumber(quote.subtotal) / Math.max(1, safeNumber(quote.quantity || 1)))}</td>
    <td style="text-align:right">${money(quote.gst)}</td>
    <td style="text-align:right">${money(quote.subtotal)}</td>
  </tr>
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

function buildQuoteEmailHtml(quote, ctx = {}) {
  const { profile, clients } = ctx;
  const getClientById = (id) => clients.find((c) => c.id === safeNumber(id));
  const clientIsGstExempt = (id) => Boolean(getClientById(id)?.outsideAustraliaOrGstExempt);
  const gstAppliesToClient = (id) => Boolean(profile.gstRegistered) && !clientIsGstExempt(id);
  const getDocumentBusinessName = () => profile.hideLegalNameOnDocs || !profile.legalBusinessName ? profile.businessName : profile.legalBusinessName;
  const getDocumentAddress = () => profile.hideAddressOnDocs ? "" : profile.address || "";
const qClient = getClientById(quote.clientId);
const currencyCode = quote.currencyCode || getClientCurrencyCode(qClient);
const money = (value) => formatCurrencyByCode(value, currencyCode);
const businessName = getDocumentBusinessName();
const businessAddress = getDocumentAddress();
const clientDetails =
  qClient?.includeAddressDetails && qClient?.addressDetails
    ? `<div style="margin-top:6px; color:#475569;">${String(qClient.addressDetails).replace(/\n/g, "<br/>")}</div>`
    : "";
const notesHtml = quote.comments
  ? `<div style="margin-top:20px; padding:16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px;">${String(quote.comments).replace(/\n/g, "<br/>")}</div>`
  : "";

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
        <div style="font-size:13px; color:#475569; margin-top:4px;">${profile.email || ""}${quote.hidePhoneNumber ? "" : ` | ${profile.phone || ""}`}</div>
        <div style="font-size:13px; color:#475569; margin-top:4px;">ABN: ${profile.abn || ""}</div>
      </div>
      <div style="text-align:right; font-size:14px; color:#14202B;">
        <div><strong>Quote ref:</strong> ${quote.quoteNumber || ""}</div>
        <div style="margin-top:6px;"><strong>Quote date:</strong> ${formatDateAU(quote.quoteDate)}</div>
        <div style="margin-top:6px;"><strong>Expiry date:</strong> ${formatDateAU(quote.expiryDate)}</div>
      </div>
    </div>

    <div style="margin-top:20px;">
      <div style="font-weight:700;">${qClient?.name || ""}</div>
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
        <tr>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0;">${quote.description || "Professional services"}</td>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0;">${quote.quantity || 1}</td>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0; text-align:right;">${money(safeNumber(quote.subtotal) / Math.max(1, safeNumber(quote.quantity || 1)))}</td>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0; text-align:right;">${money(quote.gst)}</td>
          <td style="padding:10px; border-bottom:1px solid #E2E8F0; text-align:right;">${money(quote.subtotal)}</td>
        </tr>
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

function buildInvoiceHtml(invoice, stripeCheckoutUrl = "", options = {}, ctx = {}) {
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
const purchaseOrderBlock =
  previewClient?.hasPurchaseOrder && invoice.purchaseOrderReference
    ? `<div style="margin-top:10px; font-size:14px; color:#555;"><strong>PO / Reference:</strong> ${invoice.purchaseOrderReference}</div>`
    : "";
const businessName = getDocumentBusinessName();
const businessAddress = getDocumentAddress();

const clientDetails =
  previewClient?.includeAddressDetails && previewClient?.addressDetails
    ? `<div style="margin-top:6px; color:#555;">
          ${String(previewClient.addressDetails).replace(/\n/g, "<br/>")}
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
  <div style="font-size:14px; color:#555;">${profile.email || ""}${invoice.hidePhoneNumber ? "" : ` | ${profile.phone || ""}`}</div>
  <div style="font-size:14px; color:#555;">ABN: ${profile.abn || ""}</div>
</div>

<div class="right">
  <div><strong>Invoice #:</strong> ${invoice.invoiceNumber || ""}</div>
  <div><strong>Date:</strong> ${formatDateAU(invoice.invoiceDate)}</div>
  <div><strong>Due:</strong> ${formatDateAU(invoice.dueDate)}</div>
</div>
</div>

<div class="section">
<strong>Billed To:</strong><br/>
${previewClient?.name || ""}<br/>
${previewClient?.email || ""}
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
  <tr>
    <td>${invoice.description || "Professional services"}</td>
    <td>${invoice.quantity || 1}</td>
    <td class="right">${money(safeNumber(invoice.subtotal) / Math.max(1, safeNumber(invoice.quantity || 1)))}</td>
    <td class="right">${money(invoice.gst)}</td>
    <td class="right">${money(invoice.total)}</td>
  </tr>
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
  Please use reference: ${invoice.paymentReference || invoice.invoiceNumber || ""}
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

function writeInvoicePreviewToWindow(w, invoice, stripeCheckoutUrl = "", options = {}, ctx = {}) {
const html = buildInvoiceHtml(invoice, stripeCheckoutUrl, options, ctx);
const blob = new Blob([html], { type: "text/html" });
const url = URL.createObjectURL(blob);
w.location.href = url;
try {
  w.focus();
} catch (error) {
  console.warn("Preview window focus failed", error);
}
}


export default function AccountingPortalPrototype() {
  const [activePage, setActivePage] = useState("settings");
  const [activeSettingsTab, setActiveSettingsTab] = useState("Profile");
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authLoading, setAuthLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [setupComplete, setSetupComplete] = useState(false);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [hasLoadedUserProfile, setHasLoadedUserProfile] = useState(false);
  const [wizardForm, setWizardForm] = useState({
    firstName: "",
    lastName: "",
    preferredName: "",
    businessName: "",
    legalBusinessName: "",
    email: "",
    phone: "",
    address: "",
    abn: "",
    workType: "Financial / Management Accountant",
    gstRegistered: true,
  });
  const hasHydratedSupabaseState = useRef(false);
  const syncTimeoutRef = useRef(null);
  const [isSupabaseRestoring, setIsSupabaseRestoring] = useState(false);
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState(
    supabase ? "Ready to sync to database" : "Supabase not connected"
  );
  const [profile, setProfile] = useState(initialProfile);
  const [clients, setClients] = useState(initialClients);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [incomeSources, setIncomeSources] = useState(initialIncomeSources);
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentFile, setDocumentFile] = useState(null);
  const [services, setServices] = useState([]);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    gstType: "GST on Income (10%)",
    price: "",
    gst: "0.00",
    total: "0.00",
  });
  const [showIncomeSourceModal, setShowIncomeSourceModal] = useState(false);
  const [incomeSourceForm, setIncomeSourceForm] = useState({
    name: "",
    incomeType: "Casual employment",
    beforeTax: "",
    frequency: "",
    startedAfterDate: false,
    hasEndDate: false,
  });
  const [clientForm, setClientForm] = useState(blankClient);

  const [invoiceForm, setInvoiceForm] = useState({
    clientId: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: addDays(new Date().toISOString().slice(0, 10), initialProfile.paymentTermsDays),
    startDate: "",
    endDate: "",
    sendDate: "",
    sendTime: "",
    recurs: "Never",
    serviceId: "",
    gstType: "GST on Income (10%)",
    manualGst: false,
    currencyCode: "AUD",
    description: "",
    subtotal: "",
    comments: "",
    purchaseOrderReference: "",
    includesUntaxedPortion: false,
    hidePhoneNumber: initialProfile.hidePhoneOnDocs,
    quantity: 1,
    gstOverride: "",
    savedRecordId: null,
    invoiceNumber: "",
  });

  const buildInvoiceEditorForm = (invoice) => {
    const quantity = Math.max(1, safeNumber(invoice?.quantity || 1));
    const unitPrice = quantity ? safeNumber(invoice?.subtotal) / quantity : safeNumber(invoice?.subtotal);
    const selectedClient = getClientById(invoice?.clientId) || clients[0];
    const gstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);
    return {
      id: invoice?.id || null,
      invoiceNumber: invoice?.invoiceNumber || "",
      clientId: invoice?.clientId || clients[0]?.id || "",
      invoiceDate: invoice?.invoiceDate || new Date().toISOString().slice(0, 10),
      dueDate: invoice?.dueDate || addDays(invoice?.invoiceDate || new Date().toISOString().slice(0, 10), safeNumber(profile.paymentTermsDays)),
      startDate: invoice?.startDate || "",
      endDate: invoice?.endDate || "",
      sendDate: invoice?.sendDate || "",
      sendTime: invoice?.sendTime || "",
      recurs: invoice?.recurs || "Never",
      serviceId: invoice?.serviceId || "",
      gstType: gstExempt ? "GST Free" : invoice?.gstType || "GST on Income (10%)",
      manualGst: false,
      currencyCode: invoice?.currencyCode || getClientCurrencyCode(selectedClient),
      description: invoice?.description || "",
      subtotal: unitPrice ? unitPrice.toFixed(2) : "",
      comments: invoice?.comments || "",
      purchaseOrderReference: invoice?.purchaseOrderReference || "",
      includesUntaxedPortion: Boolean(invoice?.includesUntaxedPortion),
      hidePhoneNumber: invoice?.hidePhoneNumber == null ? profile.hidePhoneOnDocs : Boolean(invoice?.hidePhoneNumber),
      quantity,
      gstOverride: "",
      status: invoice?.status || "Draft",
      paymentReference: invoice?.paymentReference || makePaymentReference(invoice?.invoiceNumber || ""),
      stripeCheckoutUrl: invoice?.stripeCheckoutUrl || "",
    };
  };

  const [invoiceEditorOpen, setInvoiceEditorOpen] = useState(false);
  const [invoiceEditorForm, setInvoiceEditorForm] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    clientId: "",
    quoteDate: new Date().toISOString().slice(0, 10),
    expiryDate: addDays(new Date().toISOString().slice(0, 10), 31),
    serviceId: "",
    gstType: "GST on Income (10%)",
    manualGst: false,
    currencyCode: "AUD",
    description: "",
    quantity: 1,
    subtotal: "",
    gstOverride: "",
    comments: "",
    hidePhoneNumber: initialProfile.hidePhoneOnDocs,
    savedRecordId: null,
    quoteNumber: "",
  });

  const buildQuoteEditorForm = (quote) => {
    const quantity = Math.max(1, safeNumber(quote?.quantity || 1));
    const unitPrice = quantity ? safeNumber(quote?.subtotal) / quantity : safeNumber(quote?.subtotal);
    const selectedClient = getClientById(quote?.clientId) || clients[0];
    const gstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);
    return {
      id: quote?.id || null,
      quoteNumber: quote?.quoteNumber || "",
      clientId: quote?.clientId || clients[0]?.id || "",
      quoteDate: quote?.quoteDate || new Date().toISOString().slice(0, 10),
      expiryDate: quote?.expiryDate || addDays(quote?.quoteDate || new Date().toISOString().slice(0, 10), 31),
      serviceId: quote?.serviceId || "",
      gstType: gstExempt ? "GST Free" : quote?.gstType || "GST on Income (10%)",
      manualGst: false,
      currencyCode: quote?.currencyCode || getClientCurrencyCode(selectedClient),
      description: quote?.description || "",
      quantity,
      subtotal: unitPrice ? unitPrice.toFixed(2) : "",
      gstOverride: "",
      comments: quote?.comments || "",
      hidePhoneNumber: quote?.hidePhoneNumber == null ? profile.hidePhoneOnDocs : Boolean(quote?.hidePhoneNumber),
      status: quote?.status || "Draft",
    };
  };

  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false);
  const [quoteEditorForm, setQuoteEditorForm] = useState(null);

  const [clientEditorOpen, setClientEditorOpen] = useState(false);
  const [clientEditorForm, setClientEditorForm] = useState(null);
  const [expenseEditorOpen, setExpenseEditorOpen] = useState(false);
  const [expenseEditorForm, setExpenseEditorForm] = useState(null);
  const [incomeSourceEditorOpen, setIncomeSourceEditorOpen] = useState(false);
  const [incomeSourceEditorForm, setIncomeSourceEditorForm] = useState(null);
  const [documentEditorOpen, setDocumentEditorOpen] = useState(false);
  const [documentEditorForm, setDocumentEditorForm] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplier: "",
    category: "",
    description: "",
    amount: "",
    expenseType: "",
    workType: profile.workType,
    receiptFileName: "",
    receiptUrl: "",
  });
  const [receiptFile, setReceiptFile] = useState(null);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseTypeStep, setExpenseTypeStep] = useState(1);
  const [expenseTypeSelection, setExpenseTypeSelection] = useState("");
  const [expenseWorkType, setExpenseWorkType] = useState(profile.workType);
  const [expenseWorkTypes, setExpenseWorkTypes] = useState([
    "Financial / Management Accountant",
    "Bookkeeping",
    "Payroll",
    "Business Advisory",
  ]);
  const [expenseCategorySelection, setExpenseCategorySelection] = useState("");
  const [searchExpenseCategory, setSearchExpenseCategory] = useState("");

  const clearPortalForFreshSetup = () => {
    setProfile(initialProfile);
    setClients([]);
    setInvoices([]);
    setQuotes([]);
    setExpenses([]);
    setIncomeSources([]);
    setServices([]);
    setDocuments([]);
    window.localStorage.removeItem("sas_profile");
    window.localStorage.removeItem("sas_clients");
    window.localStorage.removeItem("sas_invoices");
    window.localStorage.removeItem("sas_quotes");
    window.localStorage.removeItem("sas_expenses");
    window.localStorage.removeItem("sas_incomeSources");
    window.localStorage.removeItem("sas_services");
    window.localStorage.removeItem("sas_documents");
  };

  const buildWizardProfile = () => {
    const businessName = String(wizardForm.businessName || "").trim();
    const email = String(wizardForm.email || authUser?.email || "").trim();
    const firstName = String(wizardForm.firstName || "").trim();
    const preferredName = String(wizardForm.preferredName || "").trim();
    const address = String(wizardForm.address || "").trim();

    return { ...initialProfile,
      firstName,
      lastName: String(wizardForm.lastName || "").trim(),
      preferredName: preferredName || firstName,
      businessName,
      legalBusinessName: String(wizardForm.legalBusinessName || "").trim(),
      email,
      phone: String(wizardForm.phone || "").trim(),
      address,
      personalAddress: address,
      abn: String(wizardForm.abn || "").trim(),
      workType: wizardForm.workType || "Financial / Management Accountant",
      gstRegistered: Boolean(wizardForm.gstRegistered),
    };
  };

  const completeSetupWizard = async () => {
    const nextProfile = { ...buildWizardProfile(),
      setupComplete: true,
      setupCompletedAt: new Date().toISOString(),
    };
    const wizardErrors = collectValidationErrors(
      !nextProfile.businessName && "Please enter your business name.",
      !nextProfile.email && "Please enter your email address.",
      nextProfile.email && !isValidEmail(nextProfile.email) && "Please enter a valid email address."
    );
    if (wizardErrors.length) {
      summariseValidationErrors("Setup wizard", wizardErrors);
      return;
    }

    setWizardSaving(true);
    try {
      clearPortalForFreshSetup();
      setProfile({
        ...nextProfile,
        setupComplete: true,
        setupCompletedAt: nextProfile.setupCompletedAt,
      });
      setWizardForm((prev) => ({ ...prev,
        businessName: nextProfile.businessName,
        legalBusinessName: nextProfile.legalBusinessName,
        email: nextProfile.email,
        firstName: nextProfile.firstName,
        lastName: nextProfile.lastName,
        preferredName: nextProfile.preferredName,
        phone: nextProfile.phone,
        address: nextProfile.address,
        abn: nextProfile.abn,
        workType: nextProfile.workType,
        gstRegistered: nextProfile.gstRegistered,
      }));
      setSetupComplete(true);
      setHasLoadedUserProfile(true);
      setActivePage("dashboard");

      if (supabase && authUser) {
        await saveProfileToSupabase(nextProfile);
      }
    } finally {
      setWizardSaving(false);
    }
  };

  useEffect(() => {
    if (!authUser?.email) return;
    setWizardForm((prev) => ({ ...prev,
      email: prev.email || authUser.email || "",
    }));
  }, [authUser]);

  useEffect(() => {
    if (!supabase?.auth) {
      setHasLoadedUserProfile(true);
      setAuthReady(true);
      return undefined;
    }

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("SUPABASE AUTH SESSION ERROR:", error);
        return;
      }
      setAuthUser(data?.session?.user || null);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setProfile((prev) => {
      const nextFeeRate = LOCKED_FEE_RATE_PERCENT;
      const nextStripeServerUrl = DEFAULT_API_BASE_URL;
      if (
        safeNumber(prev?.feeRate) === nextFeeRate &&
        String(prev?.stripeServerUrl || "").trim() === nextStripeServerUrl
      ) {
        return prev;
      }
      return {
        ...prev,
        feeRate: nextFeeRate,
        stripeServerUrl: nextStripeServerUrl,
      };
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sas_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    window.localStorage.setItem("sas_clients", JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    window.localStorage.setItem("sas_invoices", JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    window.localStorage.setItem("sas_quotes", JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    window.localStorage.setItem("sas_expenses", JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    window.localStorage.setItem("sas_incomeSources", JSON.stringify(incomeSources));
  }, [incomeSources]);

  useEffect(() => {
    window.localStorage.setItem("sas_services", JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    window.localStorage.setItem("sas_documents", JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    window.simulateInvoicePayment = simulateInvoicePayment;
    return () => {
      delete window.simulateInvoicePayment;
    };
  }, [invoices]);

  useEffect(() => {
    window.sendInvoiceFromPreview = sendInvoiceFromPreview;
    window.sendQuoteFromPreview = sendQuoteFromPreview;
    return () => {
      delete window.sendInvoiceFromPreview;
      delete window.sendQuoteFromPreview;
    };
  }, [invoices, quotes, profile, clients]);

  useEffect(() => {
    if (authUser) {
      restorePortalStateFromSupabase();
    }
  }, [authUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeStatus = params.get("stripe");
    const invoiceId = params.get("invoiceId");

    if (stripeStatus === "success" && authUser) {
      if (invoiceId) {
        setActivePage("invoices");
        const invoice = invoices.find((inv) => String(inv.id) === String(invoiceId));
        if (invoice && invoice.status !== "Paid") {
          const updatedInvoice = { ...invoice, status: "Paid", paidAt: new Date().toISOString(), paidVia: "Stripe" };
          (async () => {
            try {
              const savedInvoice = await upsertRecordInDatabase("sas_invoices", updatedInvoice);
              setInvoices((prev) => prev.map((inv) => String(inv.id) === String(invoiceId) ? savedInvoice : inv));
            } catch (e) {
              console.error("Failed to mark invoice paid on stripe success:", e);
            }
          })();
        }
      }
      restorePortalStateFromSupabase();
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    if (profile?.setupComplete) {
      setSetupComplete(true);
    }
  }, [authUser, profile?.setupComplete]);

  useEffect(() => {
    if (!hasHydratedSupabaseState.current || !supabase) return;

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      saveProfileToSupabase(profile);
    }, 800);

    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [profile]);

  const uploadReceiptToSupabase = async (file) => {
    if (!supabase) {
      throw new Error("Supabase client not provided");
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const today = new Date().toISOString().slice(0, 10);
    const folderPath = `sharons-accounting-service/expenses/${today}`;
    const filePath = `${folderPath}/receipt-${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filePath, file, { upsert: false });
    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(filePath);
    return {
      fileName: file.name,
      filePath,
      receiptUrl: publicUrlData.publicUrl,
    };
  };

  const uploadDocumentToSupabase = async (file) => {
    if (!supabase) {
      throw new Error("Supabase client not provided");
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const today = new Date().toISOString().slice(0, 10);
    const folderPath = `sharons-accounting-service/documents/${today}`;
    const filePath = `${folderPath}/document-${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filePath, file, { upsert: false });
    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(filePath);
    return {
      fileName: file.name,
      filePath,
      url: publicUrlData.publicUrl,
    };
  };

  const sanitiseForSupabase = (value) =>
    JSON.parse(
      JSON.stringify(value, (_, nestedValue) =>
        nestedValue === undefined ? null : nestedValue
      )
    );

  const coerceRowId = (value, fallbackIndex = 0) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return Date.now() + fallbackIndex;
  };

  const buildSupabaseRow = (item, fallbackIndex = 0) => {
    if (!authUser?.id) {
      throw new Error("Please sign in first.");
    }

    const id = coerceRowId(item?.id, fallbackIndex);
    return {
      id,
      user_id: authUser.id,
      data: sanitiseForSupabase({ ...(item || {}),
        id,
      }),
      updated_at: new Date().toISOString(),
    };
  };

  const fetchCollectionFromDatabase = async (tableName) => {
    if (!authUser?.id) throw new Error("Please sign in first.");

    const { data, error } = await supabase
      .from(tableName)
      .select("id, data, updated_at, user_id")
      .eq("user_id", authUser.id)
      .order("id", { ascending: true });
    if (error) throw error;

    return (data || []).map((row) => ({ ...(row.data || {}),
      id: row.id,
      user_id: row.user_id,
    }));
  };

  const upsertRecordInDatabase = async (tableName, record) => {
    if (!authUser?.id) throw new Error("Please sign in first.");
    const row = buildSupabaseRow(record);
    const { error } = await supabase
      .from(tableName)
      .upsert(row, { onConflict: "id" });
    if (error) throw error;

    return { ...(row.data || {}),
      id: row.id,
      user_id: row.user_id,
    };
  };

  const deleteRecordFromDatabase = async (tableName, id) => {
    if (!authUser?.id) throw new Error("Please sign in first.");
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("id", safeNumber(id))
      .eq("user_id", authUser.id);
    if (error) throw error;
  };


  const validateClientPayload = (payload) =>
    collectValidationErrors(
      !String(payload?.name || "").trim() && "Client name is required.",
      payload?.email && !isValidEmail(payload.email) && "Client email is invalid."
    );

  const validateInvoicePayload = (payload) =>
    collectValidationErrors(
      !payload?.clientId && "Invoice client is required.",
      !String(payload?.description || "").trim() && "Invoice description is required.",
      safeNumber(payload?.quantity) <= 0 && "Invoice quantity must be greater than zero.",
      safeNumber(payload?.subtotal) < 0 && "Invoice amount cannot be negative.",
      payload?.invoiceDate && payload?.dueDate && new Date(payload.dueDate) < new Date(payload.invoiceDate) && "Invoice due date cannot be before invoice date."
    );

  const validateQuotePayload = (payload) =>
    collectValidationErrors(
      !payload?.clientId && "Quote client is required.",
      !String(payload?.description || "").trim() && "Quote description is required.",
      safeNumber(payload?.quantity) <= 0 && "Quote quantity must be greater than zero.",
      safeNumber(payload?.subtotal) < 0 && "Quote amount cannot be negative.",
      payload?.quoteDate && payload?.expiryDate && new Date(payload.expiryDate) < new Date(payload.quoteDate) && "Quote expiry date cannot be before quote date."
    );

  const validateExpensePayload = (payload) =>
    collectValidationErrors(
      !String(payload?.supplier || "").trim() && "Expense supplier is required.",
      !String(payload?.category || "").trim() && "Expense category is required.",
      safeNumber(payload?.amount) <= 0 && "Expense amount must be greater than zero."
    );

  const validateIncomeSourcePayload = (payload) =>
    collectValidationErrors(
      !String(payload?.name || "").trim() && "Income source name is required.",
      !String(payload?.incomeType || "").trim() && "Income source type is required.",
      safeNumber(payload?.beforeTax) <= 0 && "Income source amount must be greater than zero.",
      !String(payload?.frequency || "").trim() && "Income frequency is required."
    );

  const handleAuthSubmit = async () => {
    if (!supabase?.auth) {
      alert("Supabase Auth is not configured in client.js");
      return;
    }

    const email = String(authForm.email || "").trim();
    const password = String(authForm.password || "");
    const confirmPassword = String(authForm.confirmPassword || "");

    const errors = collectValidationErrors(
      !isValidEmail(email) && "Enter a valid email address.",
      password.length < 6 && "Password must be at least 6 characters.",
      authMode === "signup" && password !== confirmPassword && "Passwords do not match."
    );
    if (errors.length) {
      summariseValidationErrors("Authentication", errors);
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Account created. Check your email if confirmation is enabled, then sign in.");
        setAuthMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      console.error("SUPABASE AUTH ERROR:", error);
      alert(error.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!supabase?.auth) {
      alert("Supabase Auth is not configured in client.js");
      return;
    }

    const email = String(authForm.email || "").trim();
    if (!isValidEmail(email)) {
      alert("Enter your email first, then click Reset password.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      alert("Password reset email sent.");
    } catch (error) {
      console.error("SUPABASE PASSWORD RESET ERROR:", error);
      alert(error.message || "Password reset failed");
    }
  };

  const handleSignOut = async () => {
    if (!supabase?.auth) return;
    try {
      await supabase.auth.signOut();
      hasHydratedSupabaseState.current = false;
      setIsSupabaseRestoring(false);
      setProfile(initialProfile);
      setClients([]);
      setInvoices([]);
      setQuotes([]);
      setExpenses([]);
      setIncomeSources([]);
      setServices([]);
      setDocuments([]);
      setSetupComplete(false);
      setHasLoadedUserProfile(false);
      setWizardForm({
        firstName: "",
        lastName: "",
        preferredName: "",
        businessName: "",
        legalBusinessName: "",
        email: "",
        phone: "",
        address: "",
        abn: "",
        workType: "Financial / Management Accountant",
        gstRegistered: true,
      });
      setActivePage("settings");
      setActiveSettingsTab("Profile");
    } catch (error) {
      console.error("SUPABASE SIGN OUT ERROR:", error);
    }
  };

  const getStableProfileRowId = () => {
    const clean = String(authUser?.id || "").replace(/[^a-fA-F0-9]/g, "").slice(0, 12);
    if (clean) {
      const parsed = Number.parseInt(clean, 16);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 1;
  };

  const saveProfileToSupabase = async (profilePayload) => {
    if (!supabase || !authUser?.id) return;
    try {
      setSupabaseSyncStatus("Saving profile to Supabase database...");
      const savedProfile = await upsertRecordInDatabase(SUPABASE_TABLES.profile, {
        ...profilePayload,
        id: profilePayload?.id || getStableProfileRowId(),
      });

      setProfile((prev) => ({
        ...prev,
        ...savedProfile,
        setupComplete: Boolean(savedProfile?.setupComplete ?? prev?.setupComplete),
        setupCompletedAt: savedProfile?.setupCompletedAt || prev?.setupCompletedAt || "",
      }));
      setSetupComplete(Boolean(savedProfile?.setupComplete));

      setSupabaseSyncStatus("Profile saved to Supabase database");
    } catch (error) {
      console.error("SUPABASE PROFILE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Supabase profile save failed");
    }
  };

  const saveAllCurrentStateToSupabase = async () => {
    if (!supabase) {
      setSupabaseSyncStatus("Supabase not connected");
      return;
    }

    setSupabaseSyncStatus("Saving all portal records to Supabase database...");

    try {
      await saveProfileToSupabase(profile);
      await Promise.all([ ...clients.map((item) => upsertRecordInDatabase(SUPABASE_TABLES.clients, item)),
        ...invoices.map((item) => upsertRecordInDatabase(SUPABASE_TABLES.invoices, item)),
        ...quotes.map((item) => upsertRecordInDatabase(SUPABASE_TABLES.quotes, item)),
        ...expenses.map((item) => upsertRecordInDatabase(SUPABASE_TABLES.expenses, item)),
        ...incomeSources.map((item) => upsertRecordInDatabase(SUPABASE_TABLES.incomeSources, item)),
        ...services.map((item) => upsertRecordInDatabase(SUPABASE_TABLES.services, item)),
        ...documents.map((item) => upsertRecordInDatabase(SUPABASE_TABLES.documents, item)),
      ]);
      setSupabaseSyncStatus("All portal records saved to Supabase database");
    } catch (error) {
      console.error("SUPABASE BULK SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Supabase bulk save failed");
    }
  };

  const restorePortalStateFromSupabase = async () => {
    if (!supabase || isSupabaseRestoring || !authUser) return;
    setHasLoadedUserProfile(false);
    setIsSupabaseRestoring(true);
    setSupabaseSyncStatus("Loading from Supabase database...");

    try {
      const [
        remoteProfileRows,
        remoteClients,
        remoteInvoices,
        remoteQuotes,
        remoteExpenses,
        remoteIncomeSources,
        remoteServices,
        remoteDocuments,
      ] = await Promise.all([
        fetchCollectionFromDatabase(SUPABASE_TABLES.profile),
        fetchCollectionFromDatabase(SUPABASE_TABLES.clients),
        fetchCollectionFromDatabase(SUPABASE_TABLES.invoices),
        fetchCollectionFromDatabase(SUPABASE_TABLES.quotes),
        fetchCollectionFromDatabase(SUPABASE_TABLES.expenses),
        fetchCollectionFromDatabase(SUPABASE_TABLES.incomeSources),
        fetchCollectionFromDatabase(SUPABASE_TABLES.services),
        fetchCollectionFromDatabase(SUPABASE_TABLES.documents),
      ]);
      hasHydratedSupabaseState.current = true;

      const remoteProfile =
        Array.isArray(remoteProfileRows) && remoteProfileRows.length
          ? [...remoteProfileRows].reverse().find((row) => Boolean(row?.setupComplete)) ||
            remoteProfileRows[remoteProfileRows.length - 1]
          : null;
      const nextProfile = remoteProfile?.data
        ? { ...initialProfile, ...remoteProfile.data, id: remoteProfile.id }
        : remoteProfile
          ? { ...initialProfile, ...remoteProfile }
          : initialProfile;
      const nextSetupComplete = Boolean(nextProfile.setupComplete);

      setProfile(nextProfile);
      setClients(Array.isArray(remoteClients) ? remoteClients : []);
      setInvoices(Array.isArray(remoteInvoices) ? remoteInvoices : []);
      setQuotes(Array.isArray(remoteQuotes) ? remoteQuotes : []);
      setExpenses(Array.isArray(remoteExpenses) ? remoteExpenses : []);
      setIncomeSources(Array.isArray(remoteIncomeSources) ? remoteIncomeSources : []);
      setServices(Array.isArray(remoteServices) ? remoteServices : []);
      setDocuments(Array.isArray(remoteDocuments) ? remoteDocuments : []);
      setSetupComplete(nextSetupComplete);
      setWizardForm((prev) => ({ ...prev,
        firstName: nextProfile.firstName || "",
        lastName: nextProfile.lastName || "",
        preferredName: nextProfile.preferredName || "",
        businessName: nextProfile.businessName || "",
        legalBusinessName: nextProfile.legalBusinessName || "",
        email: nextProfile.email || authUser?.email || "",
        phone: nextProfile.phone || "",
        address: nextProfile.address || "",
        abn: nextProfile.abn || "",
        workType: nextProfile.workType || "Financial / Management Accountant",
        gstRegistered: nextProfile.gstRegistered ?? true,
      }));

      if (nextSetupComplete) {
        setActivePage("dashboard");
      } else {
        setActivePage("settings");
        setActiveSettingsTab("Profile");
      }

      setSupabaseSyncStatus(
        nextSetupComplete ? "Loaded from Supabase database" : "Setup required for this user"
      );
    } catch (error) {
      console.error("SUPABASE DATABASE RESTORE ERROR:", error);
      hasHydratedSupabaseState.current = true;
      setSupabaseSyncStatus(error.message || "Supabase database load failed");
    } finally {
      setHasLoadedUserProfile(true);
      setIsSupabaseRestoring(false);
    }
  };

  const uploadDocument = async () => {
    try {
      if (!documentFile) {
        alert("Please select a file first");
        return;
      }

      const uploaded = await uploadDocumentToSupabase(documentFile);
      const newDocument = {
        id: Date.now(),
        name: uploaded.fileName,
        filePath: uploaded.filePath,
        url: uploaded.url,
        uploadedAt: new Date().toISOString(),
      };
      const savedDocument = await upsertRecordInDatabase(SUPABASE_TABLES.documents, newDocument);

      setDocuments((prev) => [...prev, savedDocument]);

      setSupabaseSyncStatus("Document saved to Supabase database");
      setDocumentFile(null);
      alert("Document uploaded");
    } catch (err) {
      console.error("DOCUMENT UPLOAD ERROR:", err);
      setSupabaseSyncStatus(err.message || "Document save failed");
      alert(err.message);
    }
  };

  const deleteDocument = async (id) => {
    if (!window.confirm("Delete this document from the list?")) return;
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.documents, id);
      setDocuments((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Document deleted from Supabase database");
    } catch (error) {
      console.error("DOCUMENT DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Document delete failed");
      alert(error.message || "Document delete failed");
    }
  };

  const calculateServiceValues = (priceValue, gstTypeValue) => {
    const price = safeNumber(priceValue);
    const gst = gstTypeValue === "GST on Income (10%)" ? price * 0.1 : 0;
    return {
      gst: gst.toFixed(2),
      total: (price + gst).toFixed(2),
    };
  };

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setServiceForm({
      name: "",
      gstType: "GST on Income (10%)",
      price: "",
      gst: "0.00",
      total: "0.00",
    });
  };

  const openNewServiceModal = () => {
    resetServiceForm();
    setShowServiceModal(true);
  };

  const openEditServiceModal = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      name: service.name || "",
      gstType: service.gstType || "",
      price: String(service.price ?? ""),
      gst: Number(service.gst || 0).toFixed(2),
      total: Number(service.total || 0).toFixed(2),
    });
    setShowServiceModal(true);
  };

  const handleServiceFormChange = (field, value) => {
    if (field === "name") {
      setServiceForm((prev) => ({ ...prev, name: value }));
      return;
    }

    if (field === "price") {
      const cleaned = value.replace(/[^0-9.]/g, "");
      const computed = calculateServiceValues(cleaned, serviceForm.gstType);
      setServiceForm((prev) => ({ ...prev,
        price: cleaned,
        gst: computed.gst,
        total: computed.total,
      }));
      return;
    }

    if (field === "gstType") {
      const computed = calculateServiceValues(serviceForm.price, value);
      setServiceForm((prev) => ({ ...prev,
        gstType: value,
        gst: computed.gst,
        total: computed.total,
      }));
      return;
    }
  };

  const saveService = async () => {
    if (!serviceForm.name.trim() || !serviceForm.gstType) return;
    const payload = {
      id: editingServiceId || Date.now(),
      name: serviceForm.name.trim(),
      gstType: serviceForm.gstType,
      price: safeNumber(serviceForm.price),
      gst: safeNumber(serviceForm.gst),
      total: safeNumber(serviceForm.total),
    };
    try {
      const savedService = await upsertRecordInDatabase(SUPABASE_TABLES.services, payload);
      if (editingServiceId) {
        setServices((prev) => prev.map((item) => (item.id === editingServiceId ? savedService : item)));
      } else {
        setServices((prev) => [...prev, savedService]);
      }

      setSupabaseSyncStatus("Service saved to Supabase database");
      setShowServiceModal(false);
      resetServiceForm();
    } catch (error) {
      console.error("SERVICE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Service save failed");
      alert(error.message || "Service save failed");
    }
  };

  const deleteService = async (serviceId) => {
    if (!window.confirm("Delete this service?")) return;
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.services, serviceId);
      setServices((prev) => prev.filter((item) => item.id !== serviceId));
      setSupabaseSyncStatus("Service deleted from Supabase database");
    } catch (error) {
      console.error("SERVICE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Service delete failed");
      alert(error.message || "Service delete failed");
    }
  };

  const resetIncomeSourceForm = () => {
    setIncomeSourceForm({
      name: "",
      incomeType: "Casual employment",
      beforeTax: "",
      frequency: "",
      startedAfterDate: false,
      hasEndDate: false,
    });
  };

  const saveIncomeSource = async () => {
    const incomeErrors = validateIncomeSourcePayload({ ...incomeSourceForm, beforeTax: safeNumber(incomeSourceForm.beforeTax) });
    if (incomeErrors.length) {
      summariseValidationErrors("Income source", incomeErrors);
      return;
    }

    const payload = {
      id: Date.now(),
      name: incomeSourceForm.name.trim(),
      incomeType: incomeSourceForm.incomeType,
      beforeTax: safeNumber(incomeSourceForm.beforeTax),
      frequency: incomeSourceForm.frequency,
      startedAfterDate: incomeSourceForm.startedAfterDate,
      hasEndDate: incomeSourceForm.hasEndDate,
    };
    try {
      const savedIncomeSource = await upsertRecordInDatabase(SUPABASE_TABLES.incomeSources, payload);
      setIncomeSources((prev) => [...prev, savedIncomeSource]);
      setSupabaseSyncStatus("Income source saved to Supabase database");
      setShowIncomeSourceModal(false);
      resetIncomeSourceForm();
    } catch (error) {
      console.error("INCOME SOURCE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Income source save failed");
      alert(error.message || "Income source save failed");
    }
  };

  const getClientName = (clientId) =>
    clients.find((c) => c.id === safeNumber(clientId))?.name || "Unknown client";

  const getClientById = (clientId) =>
    clients.find((c) => c.id === safeNumber(clientId));

  const formatClientCurrency = (value, clientId) =>
    formatCurrencyByCode(value, getClientCurrencyCode(getClientById(clientId)));

  const clientIsGstExempt = (clientId) => {
    const client = getClientById(clientId);
    return Boolean(client?.outsideAustraliaOrGstExempt);
  };

  const gstAppliesToClient = (clientId) =>
    Boolean(profile.gstRegistered) && !clientIsGstExempt(clientId);

  const calculateFormGst = ({ unitPrice, quantity, gstType, clientId, manualGst, gstOverride }) => {
    if (clientIsGstExempt(clientId)) {
      return 0;
    }

    if (manualGst && gstOverride !== "") {
      return safeNumber(gstOverride);
    }

    const subtotalExGst = safeNumber(unitPrice) * Math.max(1, safeNumber(quantity || 1));
    const serviceHasGst = gstType === "GST on Income (10%)";

    if (!gstAppliesToClient(clientId) || !serviceHasGst) {
      return 0;
    }

    return subtotalExGst * 0.1;
  };

  const getDocumentBusinessName = () =>
    profile.hideLegalNameOnDocs || !profile.legalBusinessName
      ? profile.businessName
      : profile.legalBusinessName;

  const getDocumentAddress = () => (profile.hideAddressOnDocs ? "" : profile.address || "");

  const buildLineItemSummary = ({ clientId, subtotal, total, gst, purchaseOrderReference = "" }) => {
    const client = getClientById(clientId);
    const adjustments = calculateAdjustmentValues({
      subtotal,
      total,
      client,
      profile,
    });
    return {
      client,
      currencyCode: getClientCurrencyCode(client),
      gstStatus: clientIsGstExempt(clientId) ? "GST not applicable" : gst > 0 ? "GST applies" : "GST free",
      feeAmount: adjustments.feeAmount,
      taxWithheld: adjustments.taxWithheld,
      netExpected: adjustments.netExpected,
      purchaseOrderReference,
    };
  };

  const sendSavedDocumentEmail = async ({ documentType, documentRecord }) => {
  let emailDocumentRecord = { ...(documentRecord || {}) };
  let stripeCheckoutUrl = emailDocumentRecord?.stripeCheckoutUrl || "";

  const client = getClientById(emailDocumentRecord?.clientId);

  const recipientList = Array.from(
    new Set(
      [
        client?.sendToClient && isValidEmail(client?.email)
          ? String(client.email).trim()
          : "",
        client?.sendToMe && isValidEmail(profile?.email)
          ? String(profile.email).trim()
          : "",
      ].filter(Boolean)
    )
  );

  if (!recipientList.length) {
    return {
      ok: false,
      skipped: true,
      message: `No email recipients configured for this ${documentType}.`,
    };
  }

  const serverBaseUrl = getApiBaseUrl(profile?.stripeServerUrl);

  if (
    documentType === "invoice" &&
    !stripeCheckoutUrl &&
    typeof resolveInvoiceStripeAmount === "function" &&
    resolveInvoiceStripeAmount(emailDocumentRecord) > 0
  ) {
    try {
      stripeCheckoutUrl = await createStripeCheckoutForInvoice(emailDocumentRecord);

      if (stripeCheckoutUrl) {
        emailDocumentRecord = {
          ...emailDocumentRecord,
          stripeCheckoutUrl,
        };
      }
    } catch (e) {
      console.error("EMAIL STRIPE LINK ERROR:", e);
    }
  }

  const resolvedTotal = safeNumber(
    emailDocumentRecord?.total ??
    emailDocumentRecord?.grandTotal ??
    emailDocumentRecord?.invoiceTotal ??
    emailDocumentRecord?.amount ??
    emailDocumentRecord?.totalAmount
  );

  let invoiceHtml = "";
  let quoteHtml = "";

  if (documentType === "invoice") {
    invoiceHtml = buildInvoiceHtml(
      emailDocumentRecord,
      stripeCheckoutUrl || emailDocumentRecord?.stripeCheckoutUrl || "",
      { allowEmail: false },
      { profile, clients }
    );
  }

  if (documentType === "quote") {
    try {
      quoteHtml = buildQuoteHtml(
        emailDocumentRecord,
        { allowEmail: false },
        { profile, clients }
      );
    } catch (error) {
      console.error("buildQuoteHtml crashed:", error);
      quoteHtml = "";
    }

    if (!String(quoteHtml || "").trim()) {
      console.warn("Using fallback quote HTML for PDF generation", {
        quoteId: emailDocumentRecord?.id,
        quoteNumber: emailDocumentRecord?.quoteNumber,
        clientId: emailDocumentRecord?.clientId,
      });

      quoteHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Quote ${emailDocumentRecord?.quoteNumber || ""}</title>
<style>
body { font-family: Arial, sans-serif; padding: 40px; color: #14202B; }
.card { border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; }
.title { font-size: 32px; font-weight: 900; color: #6A1B9A; margin-bottom: 18px; }
.row { margin: 8px 0; }
.label { font-weight: 700; }
.total { margin-top: 20px; font-size: 20px; font-weight: 800; color: #006D6D; }
</style>
</head>
<body>
  <div class="card">
    <div class="title">QUOTE</div>
    <div class="row"><span class="label">Business:</span> ${profile?.businessName || "Sharon's Accounting Service"}</div>
    <div class="row"><span class="label">Quote Number:</span> ${emailDocumentRecord?.quoteNumber || ""}</div>
    <div class="row"><span class="label">Quote Date:</span> ${formatDateAU(emailDocumentRecord?.quoteDate)}</div>
    <div class="row"><span class="label">Expiry Date:</span> ${formatDateAU(emailDocumentRecord?.expiryDate)}</div>
    <div class="row"><span class="label">Client:</span> ${getClientName(emailDocumentRecord?.clientId)}</div>
    <div class="row"><span class="label">Description:</span> ${emailDocumentRecord?.description || "Professional services"}</div>
    <div class="row"><span class="label">Quantity:</span> ${safeNumber(emailDocumentRecord?.quantity || 1)}</div>
    <div class="row"><span class="label">Subtotal:</span> ${formatCurrencyByCode(safeNumber(emailDocumentRecord?.subtotal), emailDocumentRecord?.currencyCode || "AUD")}</div>
    <div class="row"><span class="label">GST:</span> ${formatCurrencyByCode(safeNumber(emailDocumentRecord?.gst), emailDocumentRecord?.currencyCode || "AUD")}</div>
    <div class="total">Total Estimate: ${formatCurrencyByCode(resolvedTotal, emailDocumentRecord?.currencyCode || "AUD")}</div>
  </div>
</body>
</html>`;
    }
  }

  const emailBodyHtml =
    documentType === "invoice"
      ? invoiceHtml
      : buildQuoteEmailHtml(emailDocumentRecord, { profile, clients });

  const payload = {
    to: recipientList,
    subject:
      documentType === "invoice"
        ? `Invoice ${emailDocumentRecord?.invoiceNumber || ""} from ${profile.businessName || "Sharon's Accounting Service"}`
        : `Quote ${emailDocumentRecord?.quoteNumber || ""} from ${profile.businessName || "Sharon's Accounting Service"}`,
    customerName: getClientName(emailDocumentRecord?.clientId),
    clientName: getClientById(emailDocumentRecord?.clientId)?.name || "",
    clientEmail: getClientById(emailDocumentRecord?.clientId)?.email || "",
    businessName: profile?.businessName || "",
    businessAddress: profile?.address || "",
    businessEmail: profile?.email || "",
    businessPhone: profile?.phone || "",
    abn: profile?.abn || "",
    logoDataUrl: profile?.logoDataUrl || "",
    documentType,
    html: emailBodyHtml,
    documentHtml:
      documentType === "quote"
        ? (quoteHtml || emailBodyHtml)
        : (invoiceHtml || emailBodyHtml),
    quoteHtml: documentType === "quote" ? (quoteHtml || emailBodyHtml) : "",
    invoiceHtml: documentType === "invoice" ? (invoiceHtml || emailBodyHtml) : "",
    text: `Please find your ${documentType} attached.`,
    filename: `${documentType}-${emailDocumentRecord?.invoiceNumber || emailDocumentRecord?.quoteNumber || "document"}.pdf`,
    replyTo: profile?.email || "",
    number:
      documentType === "invoice"
        ? emailDocumentRecord?.invoiceNumber || ""
        : emailDocumentRecord?.quoteNumber || "",
    invoiceNumber: emailDocumentRecord?.invoiceNumber || "",
    quoteNumber: emailDocumentRecord?.quoteNumber || "",
    invoiceDate: emailDocumentRecord?.invoiceDate || "",
    dueDate: emailDocumentRecord?.dueDate || "",
    quoteDate: emailDocumentRecord?.quoteDate || "",
    expiryDate: emailDocumentRecord?.expiryDate || "",
    description: emailDocumentRecord?.description || "",
    comments: emailDocumentRecord?.comments || "",
    quantity: safeNumber(emailDocumentRecord?.quantity || 1),
    subtotal: safeNumber(emailDocumentRecord?.subtotal),
    gst: safeNumber(emailDocumentRecord?.gst),
    total: resolvedTotal,
    currencyCode: emailDocumentRecord?.currencyCode || "AUD",
    hidePhoneNumber: Boolean(emailDocumentRecord?.hidePhoneNumber),
    stripeCheckoutUrl: stripeCheckoutUrl || emailDocumentRecord?.stripeCheckoutUrl || "",
  };

   const endpoint =
    documentType === "invoice"
      ? `${serverBaseUrl}/api/send-invoice-attachment-email`
      : `${serverBaseUrl}/api/send-document-email`;

  console.log("SEND DOCUMENT EMAIL REQUEST:", {
    endpoint,
    documentType,
    recipients: recipientList,
    subject: payload.subject,
    filename: payload.filename,
    hasHtml: Boolean(payload.html),
    hasDocumentHtml: Boolean(payload.documentHtml),
    hasInvoiceHtml: Boolean(payload.invoiceHtml),
    hasQuoteHtml: Boolean(payload.quoteHtml),
    quoteHtmlLength: payload.quoteHtml?.length || 0,
  });

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("EMAIL NETWORK ERROR:", {
      endpoint,
      documentType,
      error,
    });
    throw new Error(`Could not reach the email server at ${endpoint}. Check the Stripe Server URL setting and your backend CORS configuration.`);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    console.error("EMAIL RESPONSE PARSE ERROR:", error);
  }

  console.log("SEND DOCUMENT EMAIL RESPONSE:", {
    endpoint,
    status: response.status,
    ok: response.ok,
    data,
  });

  if (!response.ok) {
    console.error("EMAIL ERROR:", data);
    throw new Error(data?.error || data?.details || "Email failed");
  }

  return {
    ok: true,
    message: data?.message || "Email sent",
    recipients: recipientList,
    stripeCheckoutUrl,
    updatedDocumentRecord: emailDocumentRecord,
  };
};
    useEffect(() => {
    setInvoiceForm((prev) => {
      const currentDate = prev.invoiceDate || new Date().toISOString().slice(0, 10);
      const autoDueDate = addDays(currentDate, safeNumber(profile.paymentTermsDays));
      return { ...prev,
        dueDate: autoDueDate,
        hidePhoneNumber: profile.hidePhoneOnDocs,
      };
    });
    }, [profile.paymentTermsDays, profile.hidePhoneOnDocs]);

    useEffect(() => {
    setInvoiceForm((prev) => ({ ...prev,
      dueDate: addDays(prev.invoiceDate || new Date().toISOString().slice(0, 10), safeNumber(profile.paymentTermsDays)),
    }));
    }, [invoiceForm.invoiceDate]);

    useEffect(() => {
    setQuoteForm((prev) => ({ ...prev,
      hidePhoneNumber: profile.hidePhoneOnDocs,
    }));
    }, [profile.hidePhoneOnDocs]);

    useEffect(() => {
    setInvoiceForm((prev) => {
      if (!prev.savedRecordId) return prev;
      return {
        ...prev,
        savedRecordId: null,
        invoiceNumber: "",
      };
    });
    }, [invoiceForm.clientId, invoiceForm.invoiceDate, invoiceForm.dueDate, invoiceForm.description, invoiceForm.subtotal, invoiceForm.quantity, invoiceForm.comments, invoiceForm.purchaseOrderReference, invoiceForm.includesUntaxedPortion, invoiceForm.hidePhoneNumber, invoiceForm.gstType, invoiceForm.gstOverride, invoiceForm.manualGst, invoiceForm.startDate, invoiceForm.endDate, invoiceForm.sendDate, invoiceForm.sendTime, invoiceForm.recurs, invoiceForm.serviceId]);

    useEffect(() => {
    setQuoteForm((prev) => {
      if (!prev.savedRecordId) return prev;
      return {
        ...prev,
        savedRecordId: null,
        quoteNumber: "",
      };
    });
    }, [quoteForm.clientId, quoteForm.quoteDate, quoteForm.expiryDate, quoteForm.serviceId, quoteForm.gstType, quoteForm.manualGst, quoteForm.currencyCode, quoteForm.description, quoteForm.quantity, quoteForm.subtotal, quoteForm.gstOverride, quoteForm.comments, quoteForm.hidePhoneNumber]);

    useEffect(() => {
    if (!invoiceEditorOpen || !invoiceEditorForm) return;

    setInvoiceEditorForm((prev) => {
      if (!prev) return prev;
      const selectedClient = getClientById(prev.clientId) || clients[0];
      if (!selectedClient) return prev;
      const gstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);

      return { ...prev,
        clientId: selectedClient.id,
        currencyCode: getClientCurrencyCode(selectedClient),
        gstType: gstExempt ? "GST Free" : prev.gstType || "GST on Income (10%)",
      };
    });
    }, [clients, invoiceEditorOpen]);

    useEffect(() => {
    if (!quoteEditorOpen || !quoteEditorForm) return;

    setQuoteEditorForm((prev) => {
      if (!prev) return prev;
      const selectedClient = getClientById(prev.clientId) || clients[0];
      if (!selectedClient) return prev;
      const gstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);

      return { ...prev,
        clientId: selectedClient.id,
        currencyCode: getClientCurrencyCode(selectedClient),
        gstType: gstExempt ? "GST Free" : prev.gstType || "GST on Income (10%)",
      };
    });
    }, [clients, quoteEditorOpen]);

    useEffect(() => {
    if (!clients.length) return;

    setInvoiceForm((prev) => {
      const clientId = clients.some((c) => c.id === safeNumber(prev.clientId)) ? prev.clientId : clients[0].id;
      const selectedClient = getClientById(clientId) || clients[0];
      return { ...prev,
        clientId,
        currencyCode: getClientCurrencyCode(selectedClient),
        manualGst: clientIsGstExempt(clientId) ? false : prev.manualGst,
        gstOverride: clientIsGstExempt(clientId) ? "" : prev.gstOverride,
      };
    });

    setQuoteForm((prev) => {
      const clientId = clients.some((c) => c.id === safeNumber(prev.clientId)) ? prev.clientId : clients[0].id;
      const selectedClient = getClientById(clientId) || clients[0];
      return { ...prev,
        clientId,
        currencyCode: getClientCurrencyCode(selectedClient),
        manualGst: clientIsGstExempt(clientId) ? false : prev.manualGst,
        gstOverride: clientIsGstExempt(clientId) ? "" : prev.gstOverride,
      };
    });
    }, [clients]);

    const invoiceAllocations = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "Paid")
      .map((inv) => {
        const gross = safeNumber(inv.total);
        const gst = safeNumber(inv.gst);
        const incomeExGst = gross - gst;
        const client = getClientById(inv.clientId);
        const feeAmount =
          inv.feeAmount != null ? safeNumber(inv.feeAmount) : calculateAdjustmentValues({
            subtotal: safeNumber(inv.subtotal),
            total: gross,
            client,
            profile,
          }).feeAmount;
        const taxWithheld =
          inv.taxWithheld != null ? safeNumber(inv.taxWithheld) : calculateAdjustmentValues({
            subtotal: safeNumber(inv.subtotal),
            total: gross,
            client,
            profile,
          }).taxWithheld;
        const estimatedTax = client?.deductsTaxPrior ? 0 : incomeExGst * (safeNumber(profile.taxRate) / 100);
        const netAvailable =
          inv.netExpected != null
            ? safeNumber(inv.netExpected)
            : gross - gst - estimatedTax - feeAmount - taxWithheld;
        return { ...inv,
          gross,
          gst,
          incomeExGst,
          estimatedTax,
          fee: feeAmount,
          taxWithheld,
          netAvailable,
        };
      });
    }, [invoices, clients, profile.taxRate, profile.feeRate]);

    const totals = useMemo(() => {
    const totalIncome = invoices.reduce((sum, inv) => sum + safeNumber(inv.total), 0);
    const paidIncome = invoices
      .filter((x) => x.status === "Paid")
      .reduce((sum, inv) => sum + safeNumber(inv.total), 0);
    const totalExpenses = expenses.reduce((sum, ex) => sum + safeNumber(ex.amount), 0);

    const gstCollected = invoiceAllocations.reduce((sum, x) => sum + x.gst, 0);
    const gstOnExpenses = expenses.reduce((sum, ex) => sum + safeNumber(ex.gst), 0);
    const gstPayable = gstCollected - gstOnExpenses;

    const incomeExGst = invoiceAllocations.reduce((sum, x) => sum + x.incomeExGst, 0);
    const estimatedTax = invoiceAllocations.reduce((sum, x) => sum + x.estimatedTax, 0);
    const totalFees = invoiceAllocations.reduce((sum, x) => sum + x.fee, 0);
    const totalTaxWithheld = invoiceAllocations.reduce((sum, x) => sum + x.taxWithheld, 0);
    const preExpenseAvailable = invoiceAllocations.reduce((sum, x) => sum + x.netAvailable, 0);
    const safeToSpend = preExpenseAvailable - totalExpenses;

    return {
      totalIncome,
      paidIncome,
      totalExpenses,
      gstCollected,
      gstOnExpenses,
      gstPayable,
      incomeExGst,
      estimatedTax,
      totalFees,
      totalTaxWithheld,
      preExpenseAvailable,
      safeToSpend,
    };
    }, [invoices, expenses, invoiceAllocations]);


    const buildClientEditorForm = (client) => ({ ...blankClient,
    ...(client || {}),
    });
    const buildExpenseEditorForm = (expense) => ({ ...(expense || {}),
    date: expense?.date || new Date().toISOString().slice(0, 10),
    supplier: expense?.supplier || "",
    category: expense?.category || "",
    description: expense?.description || "",
    amount: expense?.amount != null ? String(expense.amount) : "",
    expenseType: expense?.expenseType || "",
    workType: expense?.workType || profile.workType,
    receiptFileName: expense?.receiptFileName || "",
    receiptUrl: expense?.receiptUrl || "",
    });
    const buildIncomeSourceEditorForm = (item) => ({ ...(item || {}),
    name: item?.name || "",
    incomeType: item?.incomeType || "Casual employment",
    beforeTax: item?.beforeTax != null ? String(item.beforeTax) : "",
    frequency: item?.frequency || "",
    startedAfterDate: Boolean(item?.startedAfterDate),
    hasEndDate: Boolean(item?.hasEndDate),
    });
    const openClientEditor = (client) => {
    setClientEditorForm(buildClientEditorForm(client));
    setClientEditorOpen(true);
    };
    const closeClientEditor = () => {
    setClientEditorOpen(false);
    setClientEditorForm(null);
    };
    const openExpenseEditor = (expense) => {
    setExpenseEditorForm(buildExpenseEditorForm(expense));
    setExpenseEditorOpen(true);
    };
    const closeExpenseEditor = () => {
    setExpenseEditorOpen(false);
    setExpenseEditorForm(null);
    };
    const openIncomeSourceEditor = (item) => {
    setIncomeSourceEditorForm(buildIncomeSourceEditorForm(item));
    setIncomeSourceEditorOpen(true);
    };
    const closeIncomeSourceEditor = () => {
    setIncomeSourceEditorOpen(false);
    setIncomeSourceEditorForm(null);
    };
    const openDocumentEditor = (item) => {
    setDocumentEditorForm({ ...(item || {}),
      name: item?.name || "",
      url: item?.url || "",
    });
    setDocumentEditorOpen(true);
    };

    const closeDocumentEditor = () => {
    setDocumentEditorOpen(false);
    setDocumentEditorForm(null);
    };
    const saveClientEdits = async () => {
    if (!clientEditorForm) return;
    const payload = { ...clientEditorForm,
      name: String(clientEditorForm.name || "").trim(),
      address: clientEditorForm.addressDetails || clientEditorForm.address || "",
    };
    const errors = validateClientPayload(payload);
    if (errors.length) {
      summariseValidationErrors("Client", errors);
      return;
    }
    try {
      const savedClient = await upsertRecordInDatabase(SUPABASE_TABLES.clients, payload);
      setClients((prev) => prev.map((item) => (item.id === savedClient.id ? savedClient : item)));
      closeClientEditor();
      setSupabaseSyncStatus("Client updated in Supabase database");
    } catch (error) {
      console.error("CLIENT EDIT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Client update failed");
      alert(error.message || "Client update failed");
    }
    };

    const saveExpenseEdits = async () => {
    if (!expenseEditorForm) return;
    const payload = { ...expenseEditorForm,
      supplier: String(expenseEditorForm.supplier || "").trim(),
      category: String(expenseEditorForm.category || "").trim(),
      description: String(expenseEditorForm.description || "").trim(),
      amount: safeNumber(expenseEditorForm.amount),
      gst: safeNumber(expenseEditorForm.amount) / 11,
    };
    const errors = validateExpensePayload(payload);
    if (errors.length) {
      summariseValidationErrors("Expense", errors);
      return;
    }
    try {
      const savedExpense = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, payload);
      setExpenses((prev) => prev.map((item) => (item.id === savedExpense.id ? savedExpense : item)));
      closeExpenseEditor();
      setSupabaseSyncStatus("Expense updated in Supabase database");
    } catch (error) {
      console.error("EXPENSE EDIT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Expense update failed");
      alert(error.message || "Expense update failed");
    }
    };

    const saveIncomeSourceEdits = async () => {
    if (!incomeSourceEditorForm) return;
    const payload = { ...incomeSourceEditorForm,
      name: String(incomeSourceEditorForm.name || "").trim(),
      beforeTax: safeNumber(incomeSourceEditorForm.beforeTax),
    };
    const errors = validateIncomeSourcePayload(payload);
    if (errors.length) {
      summariseValidationErrors("Income source", errors);
      return;
    }
    try {
      const savedItem = await upsertRecordInDatabase(SUPABASE_TABLES.incomeSources, payload);
      setIncomeSources((prev) => prev.map((item) => (item.id === savedItem.id ? savedItem : item)));
      closeIncomeSourceEditor();
      setSupabaseSyncStatus("Income source updated in Supabase database");
    } catch (error) {
      console.error("INCOME SOURCE EDIT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Income source update failed");
      alert(error.message || "Income source update failed");
    }
    };
    const saveDocumentEdits = async () => {
    if (!documentEditorForm) return;
    const payload = { ...documentEditorForm,
      name: String(documentEditorForm.name || "").trim(),
      url: String(documentEditorForm.url || "").trim(),
    };
    if (!payload.name) {
      alert("Document name is required.");
      return;
    }
    try {
      const savedDocument = await upsertRecordInDatabase(SUPABASE_TABLES.documents, payload);
      setDocuments((prev) => prev.map((item) => (item.id === savedDocument.id ? savedDocument : item)));
      closeDocumentEditor();
      setSupabaseSyncStatus("Document updated in Supabase database");
    } catch (error) {
      console.error("DOCUMENT EDIT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Document update failed");
      alert(error.message || "Document update failed");
    }
    };

    const saveClient = async () => {
    const payload = {
      id: Date.now(),
      ...clientForm,
      name: String(clientForm.name || "").trim(),
      address: clientForm.addressDetails || clientForm.address || "",
    };
    const errors = validateClientPayload(payload);
    if (errors.length) {
      summariseValidationErrors("Client", errors);
      return;
    }

    try {
      const savedClient = await upsertRecordInDatabase(SUPABASE_TABLES.clients, payload);
      setClients((prev) => [...prev, savedClient]);
      setSupabaseSyncStatus("Client saved to Supabase database");
      setClientForm(blankClient);
    } catch (error) {
      console.error("CLIENT SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Client save failed");
      alert(error.message || "Client save failed");
    }
    };

    const saveInvoice = async () => {
    const invoiceErrors = validateInvoicePayload({ ...invoiceForm,
      subtotal: safeNumber(invoiceForm.subtotal),
      quantity: safeNumber(invoiceForm.quantity || 1),
    });
    if (invoiceErrors.length) {
      summariseValidationErrors("Invoice", invoiceErrors);
      return;
    }

    const quantity = Math.max(1, safeNumber(invoiceForm.quantity || 1));
    const subtotal = safeNumber(invoiceForm.subtotal) * quantity;
    const gst = calculateFormGst({
      unitPrice: invoiceForm.subtotal,
      quantity,
      gstType: invoiceForm.gstType,
      clientId: invoiceForm.clientId,
      manualGst: invoiceForm.manualGst,
      gstOverride: invoiceForm.gstOverride,
    });
    const total = subtotal + gst;
    const lineItemSummary = buildLineItemSummary({
      clientId: invoiceForm.clientId,
      subtotal,
      total,
      gst,
      purchaseOrderReference: invoiceForm.purchaseOrderReference,
    });
    const invoiceNumber = nextNumber(profile.invoicePrefix, invoices, "invoiceNumber");
    const invoiceDate = invoiceForm.invoiceDate || new Date().toISOString().slice(0, 10);
    const dueDate =
      invoiceForm.dueDate || addDays(invoiceDate, safeNumber(profile.paymentTermsDays));
    const payload = {
      id: Date.now(),
      invoiceNumber,
      clientId: safeNumber(invoiceForm.clientId),
      invoiceDate,
      dueDate,
      startDate: invoiceForm.startDate,
      endDate: invoiceForm.endDate,
      sendDate: invoiceForm.sendDate,
      sendTime: invoiceForm.sendTime,
      recurs: invoiceForm.recurs,
      serviceId: invoiceForm.serviceId,
      gstType: invoiceForm.gstType,
      currencyCode: lineItemSummary.currencyCode,
      gstStatus: lineItemSummary.gstStatus,
      description: invoiceForm.description,
      subtotal,
      gst,
      total,
      feeAmount: lineItemSummary.feeAmount,
      taxWithheld: lineItemSummary.taxWithheld,
      netExpected: lineItemSummary.netExpected,
      comments: invoiceForm.comments,
      purchaseOrderReference: invoiceForm.purchaseOrderReference,
      includesUntaxedPortion: invoiceForm.includesUntaxedPortion,
      hidePhoneNumber: invoiceForm.hidePhoneNumber,
      quantity,
      status: "Draft",
      paymentReference: makePaymentReference(invoiceNumber),
      stripeCheckoutUrl: "",
    };

    try {
      const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, payload);
      let nextInvoice = savedInvoice;
      const saveMessage = "Invoice saved to Supabase database. Use Preview to print or download the PDF.";

      setInvoices((prev) => [...prev, nextInvoice]);
      setInvoiceForm((prev) => ({
        ...prev,
        savedRecordId: nextInvoice.id,
        invoiceNumber: nextInvoice.invoiceNumber || "",
        currencyCode: nextInvoice.currencyCode || prev.currencyCode,
      }));
      setSupabaseSyncStatus(saveMessage);
      alert(saveMessage);
    } catch (error) {
      console.error("INVOICE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Invoice save failed");
      alert(error.message || "Invoice save failed");
    }
    };

    const openInvoiceEditor = (invoice) => {
    setInvoiceEditorForm(buildInvoiceEditorForm(invoice));
    setInvoiceEditorOpen(true);
    };
    const closeInvoiceEditor = () => {
    setInvoiceEditorOpen(false);
    setInvoiceEditorForm(null);
    };
    const saveInvoiceEdits = async () => {
    if (!invoiceEditorForm?.id || !invoiceEditorForm.clientId || !invoiceEditorForm.subtotal) return;
    const quantity = Math.max(1, safeNumber(invoiceEditorForm.quantity || 1));
    const subtotal = safeNumber(invoiceEditorForm.subtotal) * quantity;
    const gst = calculateFormGst({
      unitPrice: invoiceEditorForm.subtotal,
      quantity,
      gstType: invoiceEditorForm.gstType,
      clientId: invoiceEditorForm.clientId,
      manualGst: false,
      gstOverride: "",
    });
    const total = subtotal + gst;
    const lineItemSummary = buildLineItemSummary({
      clientId: invoiceEditorForm.clientId,
      subtotal,
      total,
      gst,
      purchaseOrderReference: invoiceEditorForm.purchaseOrderReference,
    });
    const updatedInvoice = {
      id: invoiceEditorForm.id,
      invoiceNumber: invoiceEditorForm.invoiceNumber,
      clientId: safeNumber(invoiceEditorForm.clientId),
      invoiceDate: invoiceEditorForm.invoiceDate,
      dueDate: invoiceEditorForm.dueDate,
      startDate: invoiceEditorForm.startDate,
      endDate: invoiceEditorForm.endDate,
      sendDate: invoiceEditorForm.sendDate,
      sendTime: invoiceEditorForm.sendTime,
      recurs: invoiceEditorForm.recurs,
      serviceId: invoiceEditorForm.serviceId,
      gstType: invoiceEditorForm.gstType,
      currencyCode: lineItemSummary.currencyCode,
      gstStatus: lineItemSummary.gstStatus,
      description: invoiceEditorForm.description,
      subtotal,
      gst,
      total,
      feeAmount: lineItemSummary.feeAmount,
      taxWithheld: lineItemSummary.taxWithheld,
      netExpected: lineItemSummary.netExpected,
      comments: invoiceEditorForm.comments,
      purchaseOrderReference: invoiceEditorForm.purchaseOrderReference,
      includesUntaxedPortion: invoiceEditorForm.includesUntaxedPortion,
      hidePhoneNumber: invoiceEditorForm.hidePhoneNumber,
      quantity,
      status: invoiceEditorForm.status || "Draft",
      paymentReference: invoiceEditorForm.paymentReference || "",
      stripeCheckoutUrl: invoiceEditorForm.stripeCheckoutUrl || "",
    };

    try {
      const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedInvoice);
      setInvoices((prev) =>
        prev.map((invoice) => (invoice.id === invoiceEditorForm.id ? savedInvoice : invoice))
      );
      setSupabaseSyncStatus("Invoice changes saved to Supabase database");
      closeInvoiceEditor();
    } catch (error) {
      console.error("INVOICE UPDATE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Invoice update failed");
      alert(error.message || "Invoice update failed");
    }
    };
    const saveQuote = async () => {
    const quoteErrors = validateQuotePayload({ ...quoteForm,
      subtotal: safeNumber(quoteForm.subtotal),
      quantity: safeNumber(quoteForm.quantity || 1),
    });
    if (quoteErrors.length) {
      summariseValidationErrors("Quote", quoteErrors);
      return;
    }

    const quantity = Math.max(1, safeNumber(quoteForm.quantity || 1));
    const subtotal = safeNumber(quoteForm.subtotal) * quantity;
    const gst = calculateFormGst({
      unitPrice: quoteForm.subtotal,
      quantity,
      gstType: quoteForm.gstType,
      clientId: quoteForm.clientId,
      manualGst: quoteForm.manualGst,
      gstOverride: quoteForm.gstOverride,
    });
    const total = subtotal + gst;
    const lineItemSummary = buildLineItemSummary({
      clientId: quoteForm.clientId,
      subtotal,
      total,
      gst,
    });
    const quoteNumber = nextNumber(profile.quotePrefix, quotes, "quoteNumber");
    const quoteDate = quoteForm.quoteDate || new Date().toISOString().slice(0, 10);
    const expiryDate = quoteForm.expiryDate || addDays(quoteDate, 31);
    const payload = {
      id: Date.now(),
      quoteNumber,
      clientId: safeNumber(quoteForm.clientId),
      quoteDate,
      expiryDate,
      serviceId: quoteForm.serviceId,
      gstType: quoteForm.gstType,
      currencyCode: lineItemSummary.currencyCode,
      gstStatus: lineItemSummary.gstStatus,
      description: quoteForm.description,
      quantity,
      subtotal,
      gst,
      total,
      feeAmount: lineItemSummary.feeAmount,
      taxWithheld: lineItemSummary.taxWithheld,
      netExpected: lineItemSummary.netExpected,
      comments: quoteForm.comments,
      hidePhoneNumber: quoteForm.hidePhoneNumber,
      status: "Draft",
    };
    try {
      const savedQuote = await upsertRecordInDatabase(SUPABASE_TABLES.quotes, payload);
      let nextQuote = savedQuote;
      const saveMessage = "Quote saved to Supabase database. Use Preview to print or download the PDF.";

      setQuotes((prev) => [...prev, nextQuote]);
      setQuoteForm((prev) => ({
        ...prev,
        savedRecordId: nextQuote.id,
        quoteNumber: nextQuote.quoteNumber || "",
        currencyCode: nextQuote.currencyCode || prev.currencyCode,
      }));
      setSupabaseSyncStatus(saveMessage);
      alert(saveMessage);
    } catch (error) {
      console.error("QUOTE SAVE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Quote save failed");
      alert(error.message || "Quote save failed");
    }
    };

    const openQuoteEditor = (quote) => {
    setQuoteEditorForm(buildQuoteEditorForm(quote));
    setQuoteEditorOpen(true);
    };
    const closeQuoteEditor = () => {
    setQuoteEditorOpen(false);
    setQuoteEditorForm(null);
    };
    const saveQuoteEdits = async () => {
    if (!quoteEditorForm?.id || !quoteEditorForm.clientId || !quoteEditorForm.subtotal) return;
    const quantity = Math.max(1, safeNumber(quoteEditorForm.quantity || 1));
    const subtotal = safeNumber(quoteEditorForm.subtotal) * quantity;
    const gst = calculateFormGst({
      unitPrice: quoteEditorForm.subtotal,
      quantity,
      gstType: quoteEditorForm.gstType,
      clientId: quoteEditorForm.clientId,
      manualGst: false,
      gstOverride: "",
    });
    const total = subtotal + gst;
    const lineItemSummary = buildLineItemSummary({
      clientId: quoteEditorForm.clientId,
      subtotal,
      total,
      gst,
    });
    const updatedQuote = {
      id: quoteEditorForm.id,
      quoteNumber: quoteEditorForm.quoteNumber,
      clientId: safeNumber(quoteEditorForm.clientId),
      quoteDate: quoteEditorForm.quoteDate,
      expiryDate: quoteEditorForm.expiryDate,
      serviceId: quoteEditorForm.serviceId,
      gstType: quoteEditorForm.gstType,
      currencyCode: lineItemSummary.currencyCode,
      gstStatus: lineItemSummary.gstStatus,
      description: quoteEditorForm.description,
      quantity,
      subtotal,
      gst,
      total,
      feeAmount: lineItemSummary.feeAmount,
      taxWithheld: lineItemSummary.taxWithheld,
      netExpected: lineItemSummary.netExpected,
      comments: quoteEditorForm.comments,
      hidePhoneNumber: quoteEditorForm.hidePhoneNumber,
      status: quoteEditorForm.status || "Draft",
    };

    try {
      const savedQuote = await upsertRecordInDatabase(SUPABASE_TABLES.quotes, updatedQuote);
      setQuotes((prev) =>
        prev.map((quote) => (quote.id === quoteEditorForm.id ? savedQuote : quote))
      );
      setSupabaseSyncStatus("Quote changes saved to Supabase database");
      closeQuoteEditor();
    } catch (error) {
      console.error("QUOTE UPDATE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Quote update failed");
      alert(error.message || "Quote update failed");
    }
    };
    const sendInvoiceFromPreview = async (invoiceId, previewWindow) => {
    const invoice = invoices.find((item) => String(item.id) === String(invoiceId));
    if (!invoice) {
      previewWindow?.alert?.("Invoice not found. Save the invoice first, then try again.");
      return;
    }

    const statusEl = previewWindow?.document?.getElementById?.("preview-email-status");
    const emailButton = previewWindow?.document?.getElementById?.("preview-email-button");
    const setStatus = (message, colour = "#64748B") => {
      if (statusEl) {
        statusEl.textContent = message || "";
        statusEl.style.color = colour;
      }
    };

    try {
      if (emailButton) {
        emailButton.disabled = true;
        emailButton.textContent = "Sending...";
        emailButton.style.opacity = "0.7";
        emailButton.style.cursor = "not-allowed";
      }
      setStatus("Sending invoice...", "#64748B");

      const result = await sendSavedDocumentEmail({
        documentType: "invoice",
        documentRecord: invoice,
      });

      if (result?.ok) {
        const updatedInvoice = {
          ...invoice,
          ...(result.updatedDocumentRecord || {}),
          stripeCheckoutUrl:
            result.stripeCheckoutUrl ||
            result.updatedDocumentRecord?.stripeCheckoutUrl ||
            invoice.stripeCheckoutUrl ||
            "",
          emailedAt: new Date().toISOString(),
          emailRecipients: result.recipients || [],
        };
        const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedInvoice);
        setInvoices((prev) =>
          prev.map((item) => (String(item.id) === String(invoiceId) ? savedInvoice : item))
        );
        setSupabaseSyncStatus(result.message || "Invoice emailed");
        setStatus(result.message || "Invoice emailed.", "#166534");
      } else {
        setStatus(result?.message || "Could not send invoice.", "#B42318");
      }
    } catch (error) {
      console.error("PREVIEW INVOICE EMAIL ERROR:", error);
      setStatus(`Send failed: ${error.message || "Unknown error"}`, "#B42318");
    } finally {
      if (emailButton) {
        emailButton.disabled = false;
        emailButton.textContent = "Email Invoice";
        emailButton.style.opacity = "1";
        emailButton.style.cursor = "pointer";
      }
    }
    };

    const sendQuoteFromPreview = async (quoteId, previewWindow) => {
    const quote = quotes.find((item) => String(item.id) === String(quoteId));
    if (!quote) {
      previewWindow?.alert?.("Quote not found. Save the quote first, then try again.");
      return;
    }

    const statusEl = previewWindow?.document?.getElementById?.("preview-email-status");
    const emailButton = previewWindow?.document?.getElementById?.("preview-email-button");
    const setStatus = (message, colour = "#64748B") => {
      if (statusEl) {
        statusEl.textContent = message || "";
        statusEl.style.color = colour;
      }
    };

    try {
      if (emailButton) {
        emailButton.disabled = true;
        emailButton.textContent = "Sending...";
        emailButton.style.opacity = "0.7";
        emailButton.style.cursor = "not-allowed";
      }
      setStatus("Sending quote...", "#64748B");

      const result = await sendSavedDocumentEmail({
        documentType: "quote",
        documentRecord: quote,
      });

      if (result?.ok) {
        const updatedQuote = {
          ...quote,
          emailedAt: new Date().toISOString(),
          emailRecipients: result.recipients || [],
        };
        const savedQuote = await upsertRecordInDatabase(SUPABASE_TABLES.quotes, updatedQuote);
        setQuotes((prev) =>
          prev.map((item) => (String(item.id) === String(quoteId) ? savedQuote : item))
        );
        setSupabaseSyncStatus(result.message || "Quote emailed");
        setStatus(result.message || "Quote emailed.", "#166534");
      } else {
        setStatus(result?.message || "Could not send quote.", "#B42318");
      }
    } catch (error) {
      console.error("PREVIEW QUOTE EMAIL ERROR:", error);
      setStatus(`Send failed: ${error.message || "Unknown error"}`, "#B42318");
    } finally {
      if (emailButton) {
        emailButton.disabled = false;
        emailButton.textContent = "Email Quote";
        emailButton.style.opacity = "1";
        emailButton.style.cursor = "pointer";
      }
    }
    };

    const writeQuotePreviewToWindow = (w, quote, options = {}) => {
    const html = buildQuoteHtml(quote, options, { profile, clients });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    w.location.href = url;
    try {
      w.focus();
    } catch (error) {
      console.warn("Preview window focus failed", error);
    }
    };

    const openSavedQuotePreview = (quote) => {
    const w = window.open("", "_blank");
    if (!w) return;
    writeQuotePreviewToWindow(w, quote, { allowEmail: true });
    };

    const saveExpense = async () => {
    try {
      const expenseErrors = validateExpensePayload({ ...expenseForm, amount: safeNumber(expenseForm.amount) });
      if (expenseErrors.length) {
        summariseValidationErrors("Expense", expenseErrors);
        return;
      }
      console.log("SAVE EXPENSE CLICKED");
      console.log("receiptFile:", receiptFile);
      if (!expenseForm.supplier || !expenseForm.amount || !expenseForm.category) {
        alert("Please fill supplier, amount and category");
        return;
      }

      const amount = safeNumber(expenseForm.amount);
      const gst = amount / 11;
      let receiptUrl = "";
      let receiptFileName = "";

      if (receiptFile) {
        console.log("Uploading receipt now...");
        console.log("UPLOAD FUNCTION CALLED");
        const uploaded = await uploadReceiptToSupabase(receiptFile);
        console.log("Upload result:", uploaded);
        receiptUrl = uploaded.receiptUrl;
        receiptFileName = uploaded.fileName;
      } else {
        console.log("No receipt file selected");
      }

      const payload = {
        id: Date.now(),
        ...expenseForm,
        amount,
        gst,
        receiptFileName,
        receiptUrl,
      };
      const savedExpense = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, payload);

      setExpenses((prev) => [...prev, savedExpense]);
      setExpenseForm({
        date: new Date().toISOString().slice(0, 10),
        supplier: "",
        category: "",
        description: "",
        amount: "",
        expenseType: "",
        workType: profile.workType,
        receiptFileName: "",
        receiptUrl: "",
      });
      setSupabaseSyncStatus("Expense saved to Supabase database");
      setReceiptFile(null);
      alert("Expense saved");
    } catch (err) {
      console.error("SAVE ERROR:", err);
      setSupabaseSyncStatus(err.message || "Expense save failed");
      alert(err.message);
    }
    };

    const markInvoicePaid = async (invoiceId, paidVia = "Manual") => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    const updatedInvoice = { ...invoice, status: "Paid", paidAt: new Date().toISOString(), paidVia };
    try {
      const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedInvoice);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? savedInvoice : inv))
      );
      setSupabaseSyncStatus("Invoice payment status saved to Supabase database");
    } catch (error) {
      console.error("MARK INVOICE PAID ERROR:", error);
      setSupabaseSyncStatus(error.message || "Invoice payment update failed");
      alert(error.message || "Invoice payment update failed");
    }
    };
    async function simulateInvoicePayment(invoiceId) {
    const invoice = invoices.find((x) => String(x.id) === String(invoiceId));
    if (!invoice) {
      alert("Invoice not found");
      return;
    }

    const updatedInvoice = { ...invoice,
      status: "Paid",
      paidAt: new Date().toISOString(),
    };
    try {
      const savedInvoice = await upsertRecordInDatabase(SUPABASE_TABLES.invoices, updatedInvoice);
      setInvoices((prev) =>
        prev.map((inv) =>
          String(inv.id) === String(invoiceId) ? savedInvoice : inv
        )
      );
      const client = getClientById(invoice.clientId);

      console.log("📧 SIMULATED PAYMENT RECEIPT");
      console.log("To:", client?.email || "no email");
      console.log("Invoice:", invoice.invoiceNumber);
      console.log("Amount:", invoice.total);
      setSupabaseSyncStatus("Simulated payment saved to Supabase database");
      alert(`Simulated payment completed for ${invoice.invoiceNumber}`);
    } catch (error) {
      console.error("SIMULATED PAYMENT ERROR:", error);
      setSupabaseSyncStatus(error.message || "Simulated payment failed");
      alert(error.message || "Simulated payment failed");
    }
    }

    const deleteInvoice = async (id) => {
    if (!window.confirm("Delete this invoice?")) return;
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.invoices, id);
      setInvoices((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Invoice deleted from Supabase database");
    } catch (error) {
      console.error("INVOICE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Invoice delete failed");
      alert(error.message || "Invoice delete failed");
    }
    };
    const deleteQuote = async (id) => {
    if (!window.confirm("Delete this quote?")) return;
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.quotes, id);
      setQuotes((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Quote deleted from Supabase database");
    } catch (error) {
      console.error("QUOTE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Quote delete failed");
      alert(error.message || "Quote delete failed");
    }
    };
    const deleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.expenses, id);
      setExpenses((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Expense deleted from Supabase database");
    } catch (error) {
      console.error("EXPENSE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Expense delete failed");
      alert(error.message || "Expense delete failed");
    }
    };
    const deleteClient = async (id) => {
    if (!window.confirm("Delete this client?")) return;
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.clients, id);
      setClients((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Client deleted from Supabase database");
    } catch (error) {
      console.error("CLIENT DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Client delete failed");
      alert(error.message || "Client delete failed");
    }
    };
    const deleteIncomeSource = async (id) => {
    if (!window.confirm("Delete this income source?")) return;
    try {
      await deleteRecordFromDatabase(SUPABASE_TABLES.incomeSources, id);
      setIncomeSources((prev) => prev.filter((item) => item.id !== id));
      setSupabaseSyncStatus("Income source deleted from Supabase database");
    } catch (error) {
      console.error("INCOME SOURCE DELETE ERROR:", error);
      setSupabaseSyncStatus(error.message || "Income source delete failed");
      alert(error.message || "Income source delete failed");
    }
    };

  const resolveInvoiceStripeAmount = (invoice) => {
    const storedTotal = safeNumber(
      invoice?.total ?? invoice?.grandTotal ?? invoice?.invoiceTotal ??
      invoice?.totalAmount ?? invoice?.amount ?? null
    );
    if (storedTotal > 0) return Number(storedTotal.toFixed(2));

    const quantity = Math.max(1, safeNumber(invoice?.quantity || 1));
    const resolvedSubtotal = safeNumber(invoice?.subtotal);
    const resolvedGst = safeNumber(invoice?.gst) > 0
      ? safeNumber(invoice?.gst)
      : calculateFormGst({
          unitPrice: quantity > 0 ? resolvedSubtotal / quantity : resolvedSubtotal,
          quantity,
          gstType: invoice?.gstType || "GST on Income (10%)",
          clientId: invoice?.clientId,
          manualGst: false,
          gstOverride: "",
        });
    const recomputed = resolvedSubtotal + resolvedGst;
    if (recomputed > 0) return Number(recomputed.toFixed(2));
    return 0;
  };

    const createStripeCheckoutForInvoice = async (invoice) => {
    const serverBaseUrl = getApiBaseUrl(profile?.stripeServerUrl);
    const selectedClient = getClientById(invoice?.clientId) || {};

    console.log("FULL INVOICE OBJECT:", invoice);

    const rawTotal = resolveInvoiceStripeAmount(invoice);

    console.log("INVOICE TOTAL DEBUG:", {
      total: invoice?.total,
      subtotal: invoice?.subtotal,
      gst: invoice?.gst,
      quantity: invoice?.quantity,
      rawTotal,
    });

    if (!Number.isFinite(rawTotal) || rawTotal <= 0) {
      console.error("Stripe invoice total could not be resolved", { invoice, rawTotal });
      throw new Error(`Invoice total could not be determined for ${invoice?.invoiceNumber || invoice?.id}. Please open and re-save the invoice.`);
    }

    const payload = {
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      clientId: invoice?.clientId,
      customerName: selectedClient?.name || selectedClient?.businessName || "",
      customerEmail: selectedClient?.email || "",
      description:
        invoice?.description ||
        `Invoice ${invoice?.invoiceNumber || invoice?.id || ""}`,
      currency: String(invoice?.currencyCode || "AUD").toLowerCase(),
      amount: Number(rawTotal.toFixed(2)),
      total: Number(rawTotal.toFixed(2)),
      successUrl: `${window.location.origin}?stripe=success&invoice=${encodeURIComponent(
        invoice?.invoiceNumber || ""
      )}&invoiceId=${encodeURIComponent(String(invoice?.id || ""))}`,
      cancelUrl: `${window.location.origin}?stripe=cancel&invoice=${encodeURIComponent(
        invoice?.invoiceNumber || ""
      )}&invoiceId=${encodeURIComponent(String(invoice?.id || ""))}`,
    };

    console.log("Stripe invoice payload", payload);
    console.log("Stripe amount being sent:", payload.amount, "type:", typeof payload.amount);
    
    let response;

    try {
      response = await fetch(`${serverBaseUrl}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("STRIPE CHECKOUT NETWORK ERROR:", {
        serverBaseUrl,
        error,
      });
      throw new Error(`Could not reach the Stripe server at ${serverBaseUrl}. Check the Stripe Server URL setting and your backend deployment.`);
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("Stripe checkout response error", data);
      throw new Error(data?.error || "Stripe checkout failed");
    }

    if (!data?.url) {
      throw new Error("Stripe checkout URL was not returned");
    }

    return data.url;
    };

    const payInvoiceWithStripe = async (invoice) => {
    try {
      const checkoutUrl = await createStripeCheckoutForInvoice(invoice);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("STRIPE CHECKOUT ERROR:", error);
      alert(error.message || "Stripe checkout failed");
    }
    };

    const resetExpenseModal = () => {
    setExpenseModalOpen(false);
    setExpenseTypeStep(1);
    setExpenseTypeSelection("");
    setExpenseWorkType(profile.workType);
    setExpenseCategorySelection("");
    setSearchExpenseCategory("");
    setReceiptFile(null);
    };

    const nextExpenseModalStep = () => {
    if (expenseTypeStep === 1) {
      if (!expenseTypeSelection) return;
      setExpenseTypeStep(2);
      return;
    }

    if (expenseTypeStep === 2) {
      if (!expenseTypeSelection || !expenseWorkType || !expenseCategorySelection) return;
      setExpenseForm((prev) => ({ ...prev,
        expenseType: expenseTypeSelection,
        workType: expenseWorkType,
        category: expenseCategorySelection,
      }));
      setExpenseTypeStep(3);
      return;
    }

    if (expenseTypeStep === 3) {
      setExpenseModalOpen(false);
      return;
    }
    };


    const openSavedInvoicePreview = async (invoice) => {
    const w = window.open("", "_blank");
    if (!w) return;

    w.document.open();
    w.document.write(`<!doctype html>
    <html>
    <head><meta charset="utf-8" /><title>Invoice Preview</title></head>
    <body style="font-family: Arial, sans-serif; padding: 40px; color: #14202B;">
    <div style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">Preparing invoice preview...</div>
    <div style="font-size: 14px; color: #64748B;">Generating the Stripe payment section.</div>
    </body>
    </html>`);
    w.document.close();

    let stripeCheckoutUrl = invoice.stripeCheckoutUrl || "";
    let previewInvoice = { ...invoice };

    try {
      if (!stripeCheckoutUrl && resolveInvoiceStripeAmount(invoice) > 0) {
        console.log("PREVIEW REQUESTING STRIPE SESSION FOR:", invoice.invoiceNumber);
        stripeCheckoutUrl = await createStripeCheckoutForInvoice(invoice);

        if (stripeCheckoutUrl) {
          previewInvoice = { ...invoice, stripeCheckoutUrl };
          setInvoices((prev) =>
            prev.map((item) =>
              item.id === invoice.id ? { ...item, stripeCheckoutUrl } : item
            )
          );
        }
      }
    } catch (error) {
      console.error("STRIPE PREVIEW ERROR:", error);
    }

    writeInvoicePreviewToWindow(w, previewInvoice, stripeCheckoutUrl, { allowEmail: true }, { profile, clients });
    w.simulateInvoicePayment = () => simulateInvoicePayment(invoice.id);
    };

    const openInvoicePreview = async () => {
    const previewSubtotal = safeNumber(invoiceForm.subtotal) * Math.max(1, safeNumber(invoiceForm.quantity || 1));
    const calculatedInvoiceGst = calculateFormGst({
      unitPrice: invoiceForm.subtotal,
      quantity: invoiceForm.quantity,
      gstType: invoiceForm.gstType,
      clientId: invoiceForm.clientId,
      manualGst: invoiceForm.manualGst,
      gstOverride: invoiceForm.gstOverride,
    });
    const previewGst = calculatedInvoiceGst;
    const previewTotal = previewSubtotal + previewGst;

    const savedInvoiceNumber = String(invoiceForm.invoiceNumber || "").trim();
    const previewNumber = savedInvoiceNumber || nextNumber(profile.invoicePrefix, invoices, "invoiceNumber");
    const previewInvoice = {
      id: invoiceForm.savedRecordId || Date.now(),
      invoiceNumber: previewNumber,
      clientId: safeNumber(invoiceForm.clientId),
      invoiceDate: invoiceForm.invoiceDate,
      dueDate: invoiceForm.dueDate,
      description: invoiceForm.description,
      subtotal: previewSubtotal,
      gst: previewGst,
      total: previewTotal,
      hidePhoneNumber: invoiceForm.hidePhoneNumber,
      quantity: safeNumber(invoiceForm.quantity || 1),
      paymentReference: makePaymentReference(previewNumber),
      stripeCheckoutUrl: "",
    };

    const w = window.open("", "_blank");
    if (!w) return;

    let stripeCheckoutUrl = "";
    try {
      if (resolveInvoiceStripeAmount(previewInvoice) > 0) {
        stripeCheckoutUrl = await createStripeCheckoutForInvoice(previewInvoice);
      }
    } catch (error) {
      console.error("STRIPE PREVIEW ERROR:", error);
    }

    const previewInvoiceWithStripe = {
      ...previewInvoice,
      stripeCheckoutUrl,
    };

    writeInvoicePreviewToWindow(w, previewInvoiceWithStripe, stripeCheckoutUrl, { allowEmail: true }, { profile, clients });
    w.simulateInvoicePayment = () => simulateInvoicePayment(previewInvoice.id);
    };

    const openQuotePreview = () => {
    const qSubtotal = safeNumber(quoteForm.subtotal) * Math.max(1, safeNumber(quoteForm.quantity || 1));
    const qGst = calculateFormGst({
      unitPrice: quoteForm.subtotal,
      quantity: quoteForm.quantity,
      gstType: quoteForm.gstType,
      clientId: quoteForm.clientId,
      manualGst: quoteForm.manualGst,
      gstOverride: quoteForm.gstOverride,
    });
    const qTotal = qSubtotal + qGst;

    const previewNumber = nextNumber(profile.quotePrefix, quotes, "quoteNumber");
    const previewQuote = {
      id: `preview-${Date.now()}`,
      quoteNumber: previewNumber,
      clientId: safeNumber(quoteForm.clientId),
      quoteDate: quoteForm.quoteDate,
      expiryDate: quoteForm.expiryDate,
      serviceId: quoteForm.serviceId,
      gstType: quoteForm.gstType,
      currencyCode: getClientCurrencyCode(getClientById(quoteForm.clientId)),
      gstStatus: clientIsGstExempt(quoteForm.clientId)
        ? "GST not applicable"
        : qGst > 0
          ? "GST applies"
          : "GST free",
      description: quoteForm.description,
      quantity: safeNumber(quoteForm.quantity || 1),
      subtotal: qSubtotal,
      gst: qGst,
      total: qTotal,
      feeAmount: calculateAdjustmentValues({
        subtotal: qSubtotal,
        total: qTotal,
        client: getClientById(quoteForm.clientId),
        profile,
      }).feeAmount,
      taxWithheld: calculateAdjustmentValues({
        subtotal: qSubtotal,
        total: qTotal,
        client: getClientById(quoteForm.clientId),
        profile,
      }).taxWithheld,
      netExpected: calculateAdjustmentValues({
        subtotal: qSubtotal,
        total: qTotal,
        client: getClientById(quoteForm.clientId),
        profile,
      }).netExpected,
      comments: quoteForm.comments,
      hidePhoneNumber: quoteForm.hidePhoneNumber,
      status: "Preview",
    };

    const w = window.open("", "_blank");
    if (!w) return;
    writeQuotePreviewToWindow(w, previewQuote, { allowEmail: true });
    };

    const exportToATOForm = () => {
      const classifyIncomeType = (src) => {
        const raw = String(src?.incomeType || "").toLowerCase();
        if (raw.includes("casual") || raw.includes("salary") || raw.includes("wage")) return "Salary/Wages";
        if (raw.includes("business") || raw.includes("sole trader")) return "Business (sole trader)";
        if (raw.includes("interest")) return "Interest";
        if (raw.includes("dividend")) return "Dividends";
        if (raw.includes("foreign")) return "Other";
        return "Other";
      };

      const incomeRecords = invoices
        .filter((inv) => inv.status === "Paid")
        .map((inv) => {
          const client = getClientById(inv.clientId);
          return {
            date: inv.paidAt ? inv.paidAt.slice(0, 10) : (inv.invoiceDate || ""),
            type: "Business (sole trader)",
            payer: client?.name || client?.businessName || inv.clientName || "",
            gross: safeNumber(inv.total),
            withheld: safeNumber(inv.taxWithheld || 0),
            franked: 0,
            franking: 0,
            abn: client?.abn || "",
          };
        });

      incomeSources.forEach((src) => {
        const beforeTax = safeNumber(src.beforeTax);
        if (beforeTax <= 0) return;
        const incomeType = classifyIncomeType(src);
        incomeRecords.push({
          date: new Date().toISOString().slice(0, 10),
          type: incomeType,
          payer: src.name || "",
          gross: beforeTax,
          withheld: safeNumber(src.taxWithheld || 0),
          franked: incomeType === "Dividends" ? beforeTax : 0,
          franking: safeNumber(src.frankingCredit || 0),
          abn: "",
        });
      });

      const expenseRecords = expenses.map((exp) => ({
        date: exp.date || "",
        type: exp.category || exp.expenseType || "Other",
        supplier: exp.supplier || exp.description || "",
        amount: safeNumber(exp.amount),
        gstIncl: exp.gstIncluded !== false ? "yes" : "no",
      }));

      const atoState = { income: incomeRecords, expenses: expenseRecords };
      const encoded = encodeURIComponent(JSON.stringify(atoState));
      window.open(`https://www.sharonogier.com/australian-ato-tax-form.html#import=${encoded}`, "_blank");
    };

    const monthlyFinance = useMemo(() => {
      const bucket = new Map();
      const ensureBucket = (key) => {
        if (!bucket.has(key)) {
          bucket.set(key, {
            monthKey: key,
            label: formatMonthLabel(key),
            revenue: 0,
            expenses: 0,
            gst: 0,
            net: 0,
          });
        }
        return bucket.get(key);
      };

      invoiceAllocations.forEach((invoice) => {
        const key = formatMonthKey(invoice.paidAt || invoice.invoiceDate);
        const row = ensureBucket(key);
        row.revenue += safeNumber(invoice.gross);
        row.gst += safeNumber(invoice.gst);
        row.net += safeNumber(invoice.netAvailable);
      });

      expenses.forEach((expense) => {
        const key = formatMonthKey(expense.date);
        const row = ensureBucket(key);
        row.expenses += safeNumber(expense.amount);
        row.net -= safeNumber(expense.amount);
      });

      return [...bucket.values()]
        .sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)))
        .slice(-6);
    }, [invoiceAllocations, expenses]);

    const clientRevenueRows = useMemo(() => {
      const grouped = new Map();
      invoiceAllocations.forEach((invoice) => {
        const key = getClientName(invoice.clientId) || "Unknown client";
        grouped.set(key, (grouped.get(key) || 0) + safeNumber(invoice.gross));
      });
      return [...grouped.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }, [invoiceAllocations]);

    const expenseCategoryRows = useMemo(() => {
      const grouped = new Map();
      expenses.forEach((expense) => {
        const key = expense.category || expense.expenseType || "Other";
        grouped.set(key, (grouped.get(key) || 0) + safeNumber(expense.amount));
      });
      return [...grouped.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    }, [expenses]);

    const invoiceStatusRows = useMemo(() => {
      const grouped = new Map();
      invoices.forEach((invoice) => {
        const key = invoice.status || "Draft";
        grouped.set(key, (grouped.get(key) || 0) + 1);
      });
      return [...grouped.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
    }, [invoices]);

    const recentActivityRows = useMemo(() => {
      const invoiceRows = invoices.map((invoice) => ({
        type: "Invoice",
        sortDate: invoice.paidAt || invoice.invoiceDate || "",
        date: formatDateAU(invoice.paidAt || invoice.invoiceDate),
        label: `${invoice.invoiceNumber || "Invoice"} · ${getClientName(invoice.clientId)}`,
        caption: `${invoice.status || "Draft"} invoice`,
        value: currency(invoice.total),
      }));

      const expenseRows = expenses.map((expense) => ({
        type: "Expense",
        sortDate: expense.date || "",
        date: formatDateAU(expense.date),
        label: expense.supplier || expense.description || "Expense",
        caption: expense.category || expense.expenseType || "Expense",
        value: currency(expense.amount),
      }));

      return [...invoiceRows, ...expenseRows]
        .sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)))
        .slice(0, 6);
    }, [invoices, expenses]);

    const dashboardInsights = useMemo(() => {
      const collectionRate = totals.totalIncome > 0 ? (totals.paidIncome / totals.totalIncome) * 100 : 0;
      const averagePaidInvoice = invoiceAllocations.length ? totals.paidIncome / invoiceAllocations.length : 0;
      const expenseCoverage = totals.totalExpenses > 0 ? totals.safeToSpend / totals.totalExpenses : 0;
      return {
        collectionRate,
        averagePaidInvoice,
        expenseCoverage,
        paidInvoiceCount: invoiceAllocations.length,
      };
    }, [totals, invoiceAllocations]);


    const financialInsights = useMemo(() => {
      const topClientValue = clientRevenueRows[0]?.value || 0;
      const topClientShare = totals.paidIncome > 0 ? (topClientValue / totals.paidIncome) * 100 : 0;
      const averageInvoiceValue = invoices.length ? totals.totalIncome / invoices.length : 0;
      const usableCashRatio = totals.paidIncome > 0 ? (totals.safeToSpend / totals.paidIncome) * 100 : 0;
      const expenseRatio = totals.paidIncome > 0 ? (totals.totalExpenses / totals.paidIncome) * 100 : 0;
      const gstRatio = totals.paidIncome > 0 ? (totals.gstPayable / totals.paidIncome) * 100 : 0;
      const volatility = monthlyFinance.length > 1
        ? monthlyFinance.slice(1).map((month, index) => {
            const previous = monthlyFinance[index]?.revenue || 0;
            const change = previous > 0 ? ((month.revenue - previous) / previous) * 100 : 0;
            return { ...month, change };
          })
        : [];
      const averageVolatility = volatility.length
        ? volatility.reduce((sum, row) => sum + Math.abs(row.change), 0) / volatility.length
        : 0;
      const healthScore = Math.max(
        0,
        Math.min(
          100,
          100 - Math.min(topClientShare, 100) * 0.35 - Math.min(expenseRatio, 100) * 0.25 - Math.min(averageVolatility, 100) * 0.2 + Math.max(usableCashRatio, 0) * 0.2,
        ),
      );
      let healthLabel = "Needs attention";
      if (healthScore >= 75) healthLabel = "Healthy";
      else if (healthScore >= 55) healthLabel = "Watch list";
      return {
        topClientShare,
        averageInvoiceValue,
        usableCashRatio,
        expenseRatio,
        gstRatio,
        averageVolatility,
        healthScore,
        healthLabel,
      };
    }, [clientRevenueRows, totals, invoices, monthlyFinance]);

    const renderDashboard = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero
        title={profile.businessName || "Sharon’s Accounting Service"}
        subtitle="Your dashboard now reads live from the SaaS records already stored in the portal. Paid invoices, expenses, GST, tax reserves, and client performance are summarised here automatically so reporting stays in one place."
        highlight={currency(totals.safeToSpend)}
      >
        <InsightChip label="Collection rate" value={`${dashboardInsights.collectionRate.toFixed(1)}%`} />
        <InsightChip label="Average paid invoice" value={currency(dashboardInsights.averagePaidInvoice)} />
        <InsightChip label="Paid invoices" value={String(dashboardInsights.paidInvoiceCount)} />
      </DashboardHero>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard title="Gross invoiced" value={currency(totals.totalIncome)} subtitle="All invoice values currently stored in the SaaS." accent={colours.navy} />
        <MetricCard title="Gross paid" value={currency(totals.paidIncome)} subtitle="Cash received from invoices marked Paid." accent={colours.teal} />
        <MetricCard title="GST payable" value={currency(totals.gstPayable)} subtitle={`Sales GST ${currency(totals.gstCollected)} less expense credits ${currency(totals.gstOnExpenses)}.`} accent={colours.purple} />
        <MetricCard title="Estimated tax reserve" value={currency(totals.estimatedTax)} subtitle="Set aside based on paid income excluding GST." accent={colours.navy} />
        <MetricCard title="Fees and withholding" value={currency(totals.totalFees + totals.totalTaxWithheld)} subtitle={`Fees ${currency(totals.totalFees)} · withheld ${currency(totals.totalTaxWithheld)}.`} accent={colours.purple} />
        <MetricCard title="Safe to spend" value={currency(totals.safeToSpend)} subtitle="After GST, estimated tax, platform fees, withholding, and recorded expenses." accent={colours.teal} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
          gap: 20,
        }}
      >
        <SectionCard title="Monthly financial momentum" right={<div style={{ fontSize: 12, color: colours.muted }}>Latest 6 months</div>}>
          {monthlyFinance.length ? (
            <div style={{ display: "grid", gap: 16 }}>
              {monthlyFinance.map((month) => {
                const maxValue = Math.max(...monthlyFinance.map((item) => Math.max(item.revenue, item.expenses, Math.abs(item.net))), 0);
                const revenueWidth = maxValue > 0 ? (month.revenue / maxValue) * 100 : 0;
                const expenseWidth = maxValue > 0 ? (month.expenses / maxValue) * 100 : 0;
                const netWidth = maxValue > 0 ? (Math.abs(month.net) / maxValue) * 100 : 0;
                return (
                  <div key={month.monthKey} style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{month.label}</div>
                      <div style={{ fontSize: 12, color: colours.muted }}>Net {currency(month.net)}</div>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colours.muted, marginBottom: 6 }}><span>Revenue</span><span>{currency(month.revenue)}</span></div>
                        <div style={{ height: 12, borderRadius: 999, background: colours.bg }}><div style={{ width: `${Math.max(revenueWidth, month.revenue ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colours.teal} 0%, ${colours.navy} 100%)` }} /></div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colours.muted, marginBottom: 6 }}><span>Expenses</span><span>{currency(month.expenses)}</span></div>
                        <div style={{ height: 12, borderRadius: 999, background: colours.bg }}><div style={{ width: `${Math.max(expenseWidth, month.expenses ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colours.purple} 0%, #C084FC 100%)` }} /></div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colours.muted, marginBottom: 6 }}><span>Net position</span><span>{currency(month.net)}</span></div>
                        <div style={{ height: 12, borderRadius: 999, background: colours.bg }}><div style={{ width: `${Math.max(netWidth, month.net ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: month.net >= 0 ? `linear-gradient(90deg, ${colours.teal} 0%, ${colours.purple} 100%)` : `linear-gradient(90deg, #F59E0B 0%, ${colours.purple} 100%)` }} /></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: colours.muted }}>Add paid invoices and expenses to unlock the monthly trend view.</div>
          )}
        </SectionCard>

        <WaterfallCard
          title="Cash movement"
          rows={[
            { label: "Paid income", value: totals.paidIncome },
            { label: "Less GST payable", value: -totals.gstPayable },
            { label: "Less estimated tax", value: -totals.estimatedTax },
            { label: "Less platform fees", value: -totals.totalFees },
            { label: "Less expenses", value: -totals.totalExpenses },
            { label: "Safe to spend", value: totals.safeToSpend },
          ]}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        <TrendBarsCard title="Top clients by paid revenue" subtitle="Based on invoices marked Paid" data={clientRevenueRows} valueKey="value" formatValue={(value) => currency(value)} accent={colours.teal} emptyText="No paid invoices yet." />
        <TrendBarsCard title="Expense categories" subtitle="Largest categories from recorded expenses" data={expenseCategoryRows} valueKey="value" formatValue={(value) => currency(value)} accent={colours.purple} emptyText="No expenses recorded yet." />
        <TrendBarsCard title="Invoice status mix" subtitle="A quick collections snapshot" data={invoiceStatusRows} valueKey="value" formatValue={(value) => `${value} item${value === 1 ? "" : "s"}`} accent={colours.navy} emptyText="No invoices yet." />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
          gap: 20,
        }}
      >
        <SectionCard title="Reporting actions" right={<div style={{ fontSize: 12, color: colours.muted }}>Use the same SaaS data everywhere</div>}>
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              <div style={{ ...cardStyle, padding: 16, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>ATO export</div>
                <div style={{ fontSize: 14, color: colours.text, lineHeight: 1.6, marginTop: 8 }}>Send paid invoice and expense data straight into the tax form page with the current portal records.</div>
                <button style={{ ...buttonPrimary, marginTop: 14 }} onClick={exportToATOForm}>Export to ATO Tax Form</button>
              </div>
              <div style={{ ...cardStyle, padding: 16, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Supabase sync</div>
                <div style={{ fontSize: 14, color: colours.text, lineHeight: 1.6, marginTop: 8 }}>Your dashboard reflects the same SaaS entities already saved in Supabase: invoices, expenses, clients, services, income sources, and documents.</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <button style={buttonSecondary} onClick={restorePortalStateFromSupabase}>Load from Supabase DB</button>
                  <button style={buttonPrimary} onClick={() => saveAllCurrentStateToSupabase()}>Save to Supabase DB</button>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: colours.muted, lineHeight: 1.6 }}>
              Status: {supabaseSyncStatus}
            </div>
          </div>
        </SectionCard>

        <ActivityListCard title="Recent activity" rows={recentActivityRows} />
      </div>

      <SectionCard title="Paid invoice allocation detail" right={<div style={{ fontSize: 12, color: colours.muted }}>Live from invoices marked Paid</div>}>
        <DataTable
          columns={[
            { key: "invoiceNumber", label: "Invoice" },
            { key: "clientId", label: "Client", render: (_, row) => getClientName(row.clientId) },
            { key: "gross", label: "Paid", render: (v) => currency(v) },
            { key: "gst", label: "GST", render: (v) => currency(v) },
            { key: "estimatedTax", label: "Tax", render: (v) => currency(v) },
            { key: "fee", label: "Fee", render: (v) => currency(v) },
            { key: "netAvailable", label: "Net", render: (v) => currency(v) },
          ]}
          rows={invoiceAllocations}
        />
      </SectionCard>
    </div>
    );
    const renderFinancialInsights = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero
        title="Financial Insights"
        subtitle="A focused view of revenue quality, cash reality, expenses, and tax so the numbers stay useful without feeling crowded."
        highlight={`${financialInsights.healthScore.toFixed(0)}/100`}
      >
        <InsightChip label="Health" value={financialInsights.healthLabel} />
        <InsightChip label="Top client share" value={`${financialInsights.topClientShare.toFixed(1)}%`} />
        <InsightChip label="Usable cash" value={`${financialInsights.usableCashRatio.toFixed(1)}%`} />
      </DashboardHero>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard title="Average invoice value" value={currency(financialInsights.averageInvoiceValue)} subtitle="Average across all invoices currently in the portal." accent={colours.navy} />
        <MetricCard title="Expense ratio" value={`${financialInsights.expenseRatio.toFixed(1)}%`} subtitle="Recorded expenses as a share of paid income." accent={colours.purple} />
        <MetricCard title="GST load" value={`${financialInsights.gstRatio.toFixed(1)}%`} subtitle="Net GST payable as a share of paid income." accent={colours.teal} />
        <MetricCard title="Revenue volatility" value={`${financialInsights.averageVolatility.toFixed(1)}%`} subtitle="Average month-to-month movement across recent months." accent={colours.navy} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
          gap: 20,
        }}
      >
        <SectionCard title="Revenue quality" right={<div style={{ fontSize: 12, color: colours.muted }}>Recent months</div>}>
          {monthlyFinance.length ? (
            <div style={{ display: "grid", gap: 14 }}>
              {monthlyFinance.map((month, index) => {
                const maxRevenue = Math.max(...monthlyFinance.map((item) => item.revenue), 0);
                const width = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                const previous = index > 0 ? monthlyFinance[index - 1].revenue : 0;
                const change = previous > 0 ? ((month.revenue - previous) / previous) * 100 : 0;
                return (
                  <div key={month.monthKey} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: colours.text }}>{month.label}</div>
                      <div style={{ fontSize: 12, color: colours.muted }}>
                        {index === 0 ? "Starting point" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs prior month`}
                      </div>
                    </div>
                    <div style={{ height: 12, borderRadius: 999, background: colours.bg }}>
                      <div style={{ width: `${Math.max(width, month.revenue ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colours.teal} 0%, ${colours.navy} 100%)` }} />
                    </div>
                    <div style={{ fontSize: 13, color: colours.text }}>{currency(month.revenue)} paid revenue</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: colours.muted }}>Add paid invoices to see revenue quality insights.</div>
          )}
        </SectionCard>

        <WaterfallCard
          title="Cash reality"
          rows={[
            { label: "Paid income", value: totals.paidIncome },
            { label: "Less GST payable", value: -totals.gstPayable },
            { label: "Less tax reserve", value: -totals.estimatedTax },
            { label: "Less expenses", value: -totals.totalExpenses },
            { label: "Safe to spend", value: totals.safeToSpend },
          ]}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        <TrendBarsCard title="Top clients" subtitle="Highest paid revenue contributors" data={clientRevenueRows.slice(0, 4)} valueKey="value" formatValue={(value) => currency(value)} accent={colours.teal} emptyText="No paid client revenue yet." />
        <TrendBarsCard title="Expense categories" subtitle="Largest recorded categories" data={expenseCategoryRows.slice(0, 5)} valueKey="value" formatValue={(value) => currency(value)} accent={colours.purple} emptyText="No expenses recorded yet." />
      </div>

      <SectionCard title="GST and tax snapshot" right={<div style={{ fontSize: 12, color: colours.muted }}>Current position</div>}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ ...cardStyle, padding: 18, background: colours.bg }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>GST collected</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colours.text, marginTop: 8 }}>{currency(totals.gstCollected)}</div>
            <div style={{ fontSize: 13, color: colours.muted, marginTop: 8 }}>Sales GST from invoices already marked Paid.</div>
          </div>
          <div style={{ ...cardStyle, padding: 18, background: colours.bg }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>GST credits</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colours.text, marginTop: 8 }}>{currency(totals.gstOnExpenses)}</div>
            <div style={{ fontSize: 13, color: colours.muted, marginTop: 8 }}>Input GST currently recognised from expenses.</div>
          </div>
          <div style={{ ...cardStyle, padding: 18, background: colours.bg }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Estimated tax reserve</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colours.text, marginTop: 8 }}>{currency(totals.estimatedTax)}</div>
            <div style={{ fontSize: 13, color: colours.muted, marginTop: 8 }}>Reserved from paid income excluding GST.</div>
          </div>
        </div>
      </SectionCard>
    </div>
    );

    const renderClients = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <SectionCard title="Client details">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <label style={labelStyle}>What is the name of the person or organisation? *</label>
            <input
              style={inputStyle}
              value={clientForm.name}
              onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>What type of work do you do for this Client? *</label>
            <select
              style={inputStyle}
              value={clientForm.workType}
              onChange={(e) => setClientForm({ ...clientForm, workType: e.target.value })}
            >
              <option>Financial / Management Accountant</option>
              <option>Bookkeeping</option>
              <option>Payroll</option>
              <option>BAS / GST Services</option>
              <option>Business Advisory</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>What is the name of the contact person there?</label>
            <input
              style={inputStyle}
              value={clientForm.contactPerson}
              onChange={(e) => setClientForm({ ...clientForm, contactPerson: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>What is their email address?</label>
            <input
              style={inputStyle}
              value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={clientForm.recruiterUsed}
              onChange={(e) => setClientForm({ ...clientForm, recruiterUsed: e.target.checked })}
            />
            I went through a recruiter or similar third party to get this work
          </label>
        </div>

        <details style={{ ...cardStyle, marginTop: 20, padding: 18, background: "#FAFAFA" }}>
          <summary style={{ fontWeight: 800, marginBottom: 14, cursor: "pointer" }}>Invoice & Quote Options</summary>

          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.sendToClient}
                onChange={(e) => setClientForm({ ...clientForm, sendToClient: e.target.checked })}
              />
              Send to my Client
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.sendToMe}
                onChange={(e) => setClientForm({ ...clientForm, sendToMe: e.target.checked })}
              />
              Send to me
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.autoReminders}
                onChange={(e) => setClientForm({ ...clientForm, autoReminders: e.target.checked })}
              />
              Automatically send reminders once an Invoice is more than 2 days overdue
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.includeAddressDetails}
                onChange={(e) =>
                  setClientForm({ ...clientForm, includeAddressDetails: e.target.checked })
                }
              />
              Include Client address or other details
            </label>

            {clientForm.includeAddressDetails && (
              <div>
                <label style={labelStyle}>Client address/additional details</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                  value={clientForm.addressDetails}
                  onChange={(e) =>
                    setClientForm({ ...clientForm,
                      addressDetails: e.target.value,
                      address: e.target.value,
                    })
                  }
                />
              </div>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.sendReceipts}
                onChange={(e) => setClientForm({ ...clientForm, sendReceipts: e.target.checked })}
              />
              Send receipts to this client for Invoice payments made via card
            </label>
          </div>
        </details>

        <details style={{ ...cardStyle, marginTop: 20, padding: 18, background: "#FAFAFA" }}>
          <summary style={{ fontWeight: 800, marginBottom: 14, cursor: "pointer" }}>Advanced Options</summary>

          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.outsideAustraliaOrGstExempt}
                onChange={(e) =>
                  setClientForm({ ...clientForm,
                    outsideAustraliaOrGstExempt: e.target.checked,
                  })
                }
              />
              This Client is outside Australia or Services for this Client are exempt from GST
            </label>

            <div style={{ maxWidth: 220 }}>
              <label style={labelStyle}>Default currency:</label>
              <select
                style={inputStyle}
                value={clientForm.defaultCurrency}
                onChange={(e) => setClientForm({ ...clientForm, defaultCurrency: e.target.value })}
              >
                <option>AUD $</option>
                <option>USD $</option>
                <option>NZD $</option>
                <option>GBP £</option>
                <option>EUR €</option>
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.feesDeducted}
                onChange={(e) => setClientForm({ ...clientForm, feesDeducted: e.target.checked })}
              />
              Payments will have fees or expenses deducted
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.deductsTaxPrior}
                onChange={(e) => setClientForm({ ...clientForm, deductsTaxPrior: e.target.checked })}
              />
              This Client deducts tax prior to payment
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.shortTermRentalIncome}
                onChange={(e) =>
                  setClientForm({ ...clientForm, shortTermRentalIncome: e.target.checked })
                }
              />
              This “Client” is for short-term rental income
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={clientForm.hasPurchaseOrder}
                onChange={(e) => setClientForm({ ...clientForm, hasPurchaseOrder: e.target.checked })}
              />
              I have a purchase order or reference number
            </label>
          </div>
        </details>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <button style={buttonSecondary} onClick={() => setClientForm(blankClient)}>
            Cancel
          </button>
          <button style={buttonPrimary} onClick={saveClient}>
            Save
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Client List">
        <DataTable
          columns={[
            { key: "name", label: "Client" },
            { key: "contactPerson", label: "Contact" },
            { key: "workType", label: "Work Type" },
            { key: "email", label: "Email" },
            { key: "defaultCurrency", label: "Currency" },
            {
              key: "actions",
              label: "",
              render: (_, row) => (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={buttonSecondary} onClick={() => openClientEditor(row)}>View / Edit</button>
                  <button style={buttonSecondary} onClick={() => deleteClient(row.id)}>Delete</button>
                </div>
              ),
            },
          ]}
          rows={clients}
        />

        {clientEditorOpen && clientEditorForm ? (
          <div style={{ marginTop: 20, ...cardStyle, padding: 20, border: `2px solid ${colours.lightPurple}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>View / Edit Client</h3>
              <button style={buttonSecondary} onClick={closeClientEditor}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <div><label style={labelStyle}>Client name</label><input style={inputStyle} value={clientEditorForm.name} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
              <div><label style={labelStyle}>Contact person</label><input style={inputStyle} value={clientEditorForm.contactPerson || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, contactPerson: e.target.value }))} /></div>
              <div><label style={labelStyle}>Email</label><input style={inputStyle} value={clientEditorForm.email || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
              <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={clientEditorForm.phone || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
              <div><label style={labelStyle}>Work type</label><input style={inputStyle} value={clientEditorForm.workType || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, workType: e.target.value }))} /></div>
              <div><label style={labelStyle}>Default currency</label><select style={inputStyle} value={clientEditorForm.defaultCurrency || "AUD $"} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, defaultCurrency: e.target.value }))}><option>AUD $</option><option>USD $</option><option>NZD $</option><option>GBP £</option><option>EUR €</option></select></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Address details</label><textarea style={{ ...inputStyle, minHeight: 90 }} value={clientEditorForm.addressDetails || clientEditorForm.address || ""} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, addressDetails: e.target.value, address: e.target.value }))} /></div>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <label style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "center" }}><input type="checkbox" checked={Boolean(clientEditorForm.outsideAustraliaOrGstExempt)} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, outsideAustraliaOrGstExempt: e.target.checked }))} /> Client is GST exempt / outside Australia</label>
              <label style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "center" }}><input type="checkbox" checked={Boolean(clientEditorForm.feesDeducted)} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, feesDeducted: e.target.checked }))} /> Fees deducted before payment</label>
              <label style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "center" }}><input type="checkbox" checked={Boolean(clientEditorForm.deductsTaxPrior)} onChange={(e) => setClientEditorForm((prev) => ({ ...prev, deductsTaxPrior: e.target.checked }))} /> Client deducts tax prior to payment</label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
              <button style={buttonSecondary} onClick={closeClientEditor}>Cancel</button>
              <button style={buttonPrimary} onClick={saveClientEdits}>Save Changes</button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
    );
    const renderInvoices = () => {
    const previewSubtotal = safeNumber(invoiceForm.subtotal) * Math.max(1, safeNumber(invoiceForm.quantity || 1));
    const calculatedInvoiceGst = calculateFormGst({
      unitPrice: invoiceForm.subtotal,
      quantity: invoiceForm.quantity,
      gstType: invoiceForm.gstType,
      clientId: invoiceForm.clientId,
      manualGst: invoiceForm.manualGst,
      gstOverride: invoiceForm.gstOverride,
    });
    const previewGst = calculatedInvoiceGst;
    const previewTotal = previewSubtotal + previewGst;
    const invoiceClient = getClientById(invoiceForm.clientId);
    const invoiceCurrencyCode = getClientCurrencyCode(invoiceClient);
    const invoiceMoney = (value) => formatCurrencyByCode(value, invoiceCurrencyCode);
    const invoiceAdjustments = calculateAdjustmentValues({
      subtotal: previewSubtotal,
      total: previewTotal,
      client: invoiceClient,
      profile,
    });
    const invoiceGstStatus = clientIsGstExempt(invoiceForm.clientId)
      ? "GST not applicable"
      : previewGst > 0
        ? "GST applies"
        : "GST free";
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <SectionCard title="Create Invoice">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple }}>
              <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Auto-filled from Profile</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colours.text, marginTop: 6 }}>{profile.businessName}</div>
              <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>ABN: {profile.abn || "-"}</div>
            </div>
            <div style={{ ...cardStyle, padding: 14, background: colours.lightTeal }}>
              <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Payment Details</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colours.text, marginTop: 6 }}>{profile.bankName || profile.businessName}</div>
              <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>Terms: {profile.paymentTermsDays} days</div>
            </div>
            <div style={{ ...cardStyle, padding: 14, background: colours.white }}>
              <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Contact on Document</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colours.text, marginTop: 6 }}>{profile.email || "-"}</div>
              <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{profile.hidePhoneOnDocs ? "Phone hidden from docs" : profile.phone || "-"}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Client</label>
              <select
                style={inputStyle}
                value={invoiceForm.clientId}
                onChange={(e) => {
                  const selectedClient = getClientById(e.target.value);
                  setInvoiceForm((prev) => ({ ...prev,
                    clientId: e.target.value,
                    currencyCode: getClientCurrencyCode(selectedClient),
                    manualGst: false,
                    gstOverride: "",
                    purchaseOrderReference: selectedClient?.hasPurchaseOrder ? prev.purchaseOrderReference : "",
                  }));
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Invoice Date</label>
              <input
                type="date"
                style={inputStyle}
                value={invoiceForm.invoiceDate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Due Date</label>
              <input
                type="date"
                style={inputStyle}
                value={invoiceForm.dueDate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Item / Service Name</label>
              <select
                style={inputStyle}
                value={invoiceForm.description}
                onChange={(e) => {
                  const selectedService = services.find((s) => s.name === e.target.value);
                  if (selectedService) {
                    setInvoiceForm((prev) => ({ ...prev,
                      serviceId: selectedService.id,
                      description: selectedService.name,
                      subtotal: String(selectedService.price ?? ""),
                      gstType: selectedService.gstType || "",
                      manualGst: false,
                      gstOverride: "",
                      quantity: 1,
                    }));
                  } else {
                    setInvoiceForm((prev) => ({ ...prev,
                      serviceId: "",
                      gstType: prev.gstType || "GST on Income (10%)",
                      description: e.target.value,
                      manualGst: false,
                      gstOverride: "",
                    }));
                  }
                }}
              >
                <option value="">Select a service...</option>
                {services.map((service) => (
                  <option key={service.id} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                type="number"
                style={inputStyle}
                value={invoiceForm.quantity}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev,
                    quantity: e.target.value,
                    ...(prev.manualGst ? {} : { gstOverride: "" }),
                  }))
                }
              />
            </div>

            <div>
              <label style={labelStyle}>Price (ex GST)</label>
              <input
                type="number"
                style={inputStyle}
                value={invoiceForm.subtotal}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev,
                    subtotal: e.target.value,
                    ...(prev.manualGst ? {} : { gstOverride: "" }),
                  }))
                }
              />
            </div>

            <div>
              <label style={labelStyle}>GST Type</label>
              <select
                style={{ ...inputStyle,
                  background: clientIsGstExempt(invoiceForm.clientId) ? "#F8FAFC" : colours.white,
                }}
                value={clientIsGstExempt(invoiceForm.clientId) ? "GST Free" : invoiceForm.gstType || "GST on Income (10%)"}
                disabled={clientIsGstExempt(invoiceForm.clientId)}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev,
                    gstType: e.target.value,
                    manualGst: false,
                    gstOverride: "",
                  }))
                }
              >
                {GST_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>GST Amount</label>
              <input
                type="number"
                style={{ ...inputStyle,
                  background: "#F8FAFC",
                }}
                readOnly
                value={
                  clientIsGstExempt(invoiceForm.clientId)
                    ? "0.00"
                    : calculatedInvoiceGst.toFixed(2)
                }
              />
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: colours.muted }}>
            {clientIsGstExempt(invoiceForm.clientId)
              ? "GST is currently turned off for this client because the client is marked as outside Australia or GST exempt."
              : invoiceForm.gstType === "GST on Income (10%)"
                ? "GST is automatically calculated from the GST type, price and quantity."
                : invoiceForm.description
                  ? "This line item is currently GST free."
                  : "Select a service, choose a GST type, and GST will auto-fill."}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <div style={{ minWidth: 360, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>Subtotal (ex GST):</span>
                <strong>{invoiceMoney(previewSubtotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>Total GST:</span>
                <strong>{invoiceMoney(previewGst)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>GST status:</span>
                <strong>{invoiceGstStatus}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>Less fees:</span>
                <strong>{invoiceMoney(invoiceAdjustments.feeAmount)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>Less tax withheld:</span>
                <strong>{invoiceMoney(invoiceAdjustments.taxWithheld)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 18 }}>
                <span style={{ color: colours.teal, fontWeight: 800 }}>Amount due:</span>
                <strong style={{ color: colours.teal }}>{invoiceMoney(previewTotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 18 }}>
                <span style={{ color: colours.purple, fontWeight: 800 }}>Net expected:</span>
                <strong style={{ color: colours.purple }}>{invoiceMoney(invoiceAdjustments.netExpected)}</strong>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Additional Settings">
          <details>
            <summary style={{ fontWeight: 800, cursor: "pointer", color: colours.text }}>Show additional settings</summary>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginTop: 16,
              }}
            >
              {invoiceClient?.hasPurchaseOrder ? (
                <div>
                  <label style={labelStyle}>Purchase order / reference</label>
                  <input
                    style={inputStyle}
                    value={invoiceForm.purchaseOrderReference}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, purchaseOrderReference: e.target.value })}
                  />
                </div>
              ) : null}

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Comments</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                  value={invoiceForm.comments}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, comments: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={invoiceForm.hidePhoneNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, hidePhoneNumber: e.target.checked })}
                />
                Hide my phone number
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={invoiceForm.includesUntaxedPortion}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, includesUntaxedPortion: e.target.checked })}
                />
                Includes untaxed portion
              </label>
            </div>
          </details>
        </SectionCard>

        <SectionCard
          title="Invoice Actions"
          right={
            <div style={{ display: "flex", gap: 10 }}>
              <button style={buttonSecondary} onClick={openInvoicePreview}>
                Preview
              </button>
              <button style={buttonSecondary}>Save Draft</button>
              <button style={buttonPrimary} onClick={saveInvoice}>
                Save Invoice
              </button>
            </div>
          }
        >
          <div style={{ color: colours.muted, fontSize: 14 }}>
            Use Preview to open a print-style invoice in a new tab, then click Print / Download PDF.
          </div>
        </SectionCard>

        <SectionCard title="Invoice List">
          <DataTable
            columns={[
              { key: "invoiceNumber", label: "Invoice" },
              { key: "clientId", label: "Client", render: (_, row) => getClientName(row.clientId) },
              { key: "invoiceDate", label: "Date", render: (v) => formatDateAU(v) },
              { key: "dueDate", label: "Due", render: (v) => formatDateAU(v) },
              { key: "total", label: "Total", render: (v, row) => formatCurrencyByCode(v, row.currencyCode || getClientCurrencyCode(getClientById(row.clientId))) },
              { key: "status", label: "Status", render: (v) => (
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background: v === "Paid" ? "#dcfce7" : v === "Draft" ? "#f1f5f9" : "#fef9c3",
                  color: v === "Paid" ? "#16a34a" : v === "Draft" ? "#64748b" : "#b45309",
                }}>
                  {v === "Paid" ? "✓ PAID" : v || "Draft"}
                </span>
              )},
              {
                key: "actions",
                label: "",
                render: (_, row) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={buttonSecondary} onClick={() => openInvoiceEditor(row)}>
                      View / Edit
                    </button>
                    <button style={buttonSecondary} onClick={() => openSavedInvoicePreview(row)}>
                      Preview
                    </button>

                    {row.status !== "Paid" ? (
                      <>
                        <button style={buttonSecondary} onClick={() => markInvoicePaid(row.id, "Bank Transfer")}>
                          Mark Paid (Bank)
                        </button>
                        <button style={buttonSecondary} onClick={() => markInvoicePaid(row.id, "PayPal")}>
                          Mark Paid (PayPal)
                        </button>
                      </>
                    ) : (
                      <span style={{ color: "#16a34a", fontWeight: 700, alignSelf: "center", fontSize: 13 }}>
                        ✓ Paid{row.paidVia ? ` via ${row.paidVia}` : ""}
                      </span>
                    )}

                  <button
                    style={{
                      ...buttonSecondary,
                      ...(row.status === "Paid" ? { opacity: 0.4, cursor: "not-allowed" } : {}),
                    }}
                    onClick={() => row.status !== "Paid" && deleteInvoice(row.id)}
                    title={row.status === "Paid" ? "Cannot delete a paid invoice" : "Delete invoice"}
                    disabled={row.status === "Paid"}
                  >
                    Delete
                  </button>
                  </div>
                ),
              },
            ]}
            rows={invoices}
          />
        </SectionCard>

        {invoiceEditorOpen && invoiceEditorForm ? (() => {
          const editorClient = getClientById(invoiceEditorForm.clientId);
          const editorSubtotal = safeNumber(invoiceEditorForm.subtotal) * Math.max(1, safeNumber(invoiceEditorForm.quantity || 1));
          const editorGst = calculateFormGst({
            unitPrice: invoiceEditorForm.subtotal,
            quantity: invoiceEditorForm.quantity,
            gstType: invoiceEditorForm.gstType,
            clientId: invoiceEditorForm.clientId,
            manualGst: false,
            gstOverride: "",
          });
          const editorTotal = editorSubtotal + editorGst;
          const editorCurrencyCode = getClientCurrencyCode(editorClient);
          const editorMoney = (value) => formatCurrencyByCode(value, editorCurrencyCode);
          const editorAdjustments = calculateAdjustmentValues({
            subtotal: editorSubtotal,
            total: editorTotal,
            client: editorClient,
            profile,
          });
          const editorGstStatus = clientIsGstExempt(invoiceEditorForm.clientId)
            ? "GST not applicable"
            : editorGst > 0
              ? "GST applies"
              : "GST free";
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3000,
                padding: 18,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 1100,
                  maxHeight: "92vh",
                  overflowY: "auto",
                  background: colours.white,
                  borderRadius: 22,
                  border: `1px solid ${colours.border}`,
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
                  padding: 24,
                  display: "grid",
                  gap: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: colours.text }}>Invoice {invoiceEditorForm.invoiceNumber}</div>
                    <div style={{ fontSize: 14, color: colours.muted, marginTop: 4 }}>
                      View and edit the saved invoice, then save changes back to Supabase.
                    </div>
                  </div>
                  <button style={buttonSecondary} onClick={closeInvoiceEditor}>Close</button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                  }}
                >
                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Status</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: colours.text, marginTop: 6 }}>{invoiceEditorForm.status}</div>
                  </div>
                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Payment reference</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: colours.text, marginTop: 6 }}>{invoiceEditorForm.paymentReference || "Not set"}</div>
                  </div>
                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Amount due</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: colours.teal, marginTop: 6 }}>{editorMoney(editorTotal)}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr", gap: 20 }}>
                  <div style={{ display: "grid", gap: 20 }}>
                    <SectionCard title="Invoice Details">
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 16,
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Client</label>
                          <select
                            style={inputStyle}
                            value={invoiceEditorForm.clientId}
                            onChange={(e) => {
                              const selectedClient = getClientById(e.target.value);
                              setInvoiceEditorForm((prev) => ({ ...prev,
                                clientId: e.target.value,
                                currencyCode: getClientCurrencyCode(selectedClient),
                                gstType: clientIsGstExempt(e.target.value) ? "GST Free" : prev.gstType,
                                purchaseOrderReference: selectedClient?.hasPurchaseOrder ? prev.purchaseOrderReference : "",
                              }));
                            }}
                          >
                            {clients.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>Invoice Date</label>
                          <input
                            type="date"
                            style={inputStyle}
                            value={invoiceEditorForm.invoiceDate}
                            onChange={(e) =>
                              setInvoiceEditorForm((prev) => ({ ...prev,
                                invoiceDate: e.target.value,
                                dueDate: addDays(e.target.value, safeNumber(profile.paymentTermsDays)),
                              }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Due Date</label>
                          <input
                            type="date"
                            style={inputStyle}
                            value={invoiceEditorForm.dueDate}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Status</label>
                          <select
                            style={inputStyle}
                            value={invoiceEditorForm.status}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, status: e.target.value }))}
                          >
                            <option value="Draft">Draft</option>
                            <option value="Sent">Sent</option>
                            <option value="Paid">Paid</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Item / Service Name</label>
                          <select
                            style={inputStyle}
                            value={invoiceEditorForm.description}
                            onChange={(e) => {
                              const selectedService = services.find((s) => s.name === e.target.value);
                              if (selectedService) {
                                setInvoiceEditorForm((prev) => ({ ...prev,
                                  serviceId: selectedService.id,
                                  description: selectedService.name,
                                  subtotal: String(selectedService.price ?? ""),
                                  gstType: clientIsGstExempt(prev.clientId)
                                    ? "GST Free"
                                    : selectedService.gstType || "GST on Income (10%)",
                                  quantity: 1,
                                }));
                              } else {
                                setInvoiceEditorForm((prev) => ({ ...prev,
                                  serviceId: "",
                                  description: e.target.value,
                                }));
                              }
                            }}
                          >
                            <option value="">Select a service...</option>
                            {services.map((service) => (
                              <option key={service.id} value={service.name}>{service.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>Quantity</label>
                          <input
                            type="number"
                            style={inputStyle}
                            value={invoiceEditorForm.quantity}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, quantity: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Price (ex GST)</label>
                          <input
                            type="number"
                            style={inputStyle}
                            value={invoiceEditorForm.subtotal}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, subtotal: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>GST Type</label>
                          <select
                            style={{ ...inputStyle,
                              background: clientIsGstExempt(invoiceEditorForm.clientId) ? "#F8FAFC" : colours.white,
                            }}
                            value={clientIsGstExempt(invoiceEditorForm.clientId) ? "GST Free" : invoiceEditorForm.gstType}
                            disabled={clientIsGstExempt(invoiceEditorForm.clientId)}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, gstType: e.target.value }))}
                          >
                            {GST_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>GST Amount</label>
                          <input type="number" style={{ ...inputStyle, background: "#F8FAFC" }} readOnly value={editorGst.toFixed(2)} />
                        </div>

                        {editorClient?.hasPurchaseOrder ? (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={labelStyle}>Purchase order / reference</label>
                            <input
                              style={inputStyle}
                              value={invoiceEditorForm.purchaseOrderReference}
                              onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, purchaseOrderReference: e.target.value }))}
                            />
                          </div>
                        ) : null}

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Comments</label>
                          <textarea
                            style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                            value={invoiceEditorForm.comments}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, comments: e.target.value }))}
                          />
                        </div>
                      </div>
                    </SectionCard>
                  </div>

                  <div style={{ display: "grid", gap: 20 }}>
                    <SectionCard title="Invoice Summary">
                      <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Subtotal</span><strong>{editorMoney(editorSubtotal)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>GST</span><strong>{editorMoney(editorGst)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>GST status</span><strong>{editorGstStatus}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Less fees</span><strong>{editorMoney(editorAdjustments.feeAmount)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Less tax withheld</span><strong>{editorMoney(editorAdjustments.taxWithheld)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, paddingTop: 8 }}><span style={{ color: colours.teal, fontWeight: 800 }}>Amount due</span><strong style={{ color: colours.teal }}>{editorMoney(editorTotal)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}><span style={{ color: colours.purple, fontWeight: 800 }}>Net expected</span><strong style={{ color: colours.purple }}>{editorMoney(editorAdjustments.netExpected)}</strong></div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Invoice Actions">
                      <div style={{ display: "grid", gap: 12 }}>
                        <button
                          style={buttonSecondary}
                          onClick={() =>
                            openSavedInvoicePreview({ ...invoices.find((invoice) => invoice.id === invoiceEditorForm.id),
                              ...invoiceEditorForm,
                              subtotal: editorSubtotal,
                              gst: editorGst,
                              total: editorTotal,
                              clientId: safeNumber(invoiceEditorForm.clientId),
                            })
                          }
                        >
                          Preview Invoice
                        </button>
                        <button
                          style={buttonSecondary}
                          onClick={() =>
                            setInvoiceEditorForm((prev) => ({ ...prev,
                              status: prev.status === "Paid" ? "Draft" : "Paid",
                            }))
                          }
                        >
                          {invoiceEditorForm.status === "Paid" ? "Mark as Draft" : "Mark as Paid"}
                        </button>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={invoiceEditorForm.hidePhoneNumber}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, hidePhoneNumber: e.target.checked }))}
                          />
                          Hide my phone number
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={invoiceEditorForm.includesUntaxedPortion}
                            onChange={(e) => setInvoiceEditorForm((prev) => ({ ...prev, includesUntaxedPortion: e.target.checked }))}
                          />
                          Includes untaxed portion
                        </label>
                      </div>
                    </SectionCard>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <button style={buttonSecondary} onClick={closeInvoiceEditor}>Cancel</button>
                  <button style={buttonPrimary} onClick={saveInvoiceEdits}>Save Changes</button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </div>
    );
    };
    const renderQuotes = () => {
    const qSubtotal = safeNumber(quoteForm.subtotal) * Math.max(1, safeNumber(quoteForm.quantity || 1));
    const qGst = calculateFormGst({
      unitPrice: quoteForm.subtotal,
      quantity: quoteForm.quantity,
      gstType: quoteForm.gstType,
      clientId: quoteForm.clientId,
      manualGst: quoteForm.manualGst,
      gstOverride: quoteForm.gstOverride,
    });
    const qTotal = qSubtotal + qGst;
    const quoteClient = getClientById(quoteForm.clientId);
    const quoteCurrencyCode = getClientCurrencyCode(quoteClient);
    const quoteMoney = (value) => formatCurrencyByCode(value, quoteCurrencyCode);
    const quoteAdjustments = calculateAdjustmentValues({
      subtotal: qSubtotal,
      total: qTotal,
      client: quoteClient,
      profile,
    });
    const quoteGstStatus = clientIsGstExempt(quoteForm.clientId)
      ? "GST not applicable"
      : qGst > 0
        ? "GST applies"
        : "GST free";
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <SectionCard title="Create Quote">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple }}>
              <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Auto-filled from Profile</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colours.text, marginTop: 6 }}>{profile.businessName}</div>
              <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>Quote Prefix: {profile.quotePrefix || "QUO"}</div>
            </div>
            <div style={{ ...cardStyle, padding: 14, background: colours.lightTeal }}>
              <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700 }}>Contact on Quote</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colours.text, marginTop: 6 }}>{profile.email || "-"}</div>
              <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{profile.hidePhoneOnDocs ? "Phone hidden from docs" : profile.phone || "-"}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Which Client is this Quote for?</label>
              <select
                style={inputStyle}
                value={quoteForm.clientId}
                onChange={(e) => {
                  const selectedClient = getClientById(e.target.value);
                  setQuoteForm((prev) => ({ ...prev,
                    clientId: e.target.value,
                    currencyCode: getClientCurrencyCode(selectedClient),
                    manualGst: false,
                    gstOverride: "",
                  }));
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Quote Date</label>
              <input
                type="date"
                style={inputStyle}
                value={quoteForm.quoteDate}
                onChange={(e) => setQuoteForm({ ...quoteForm, quoteDate: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Expiry Date</label>
              <input
                type="date"
                style={inputStyle}
                value={quoteForm.expiryDate}
                onChange={(e) => setQuoteForm({ ...quoteForm, expiryDate: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Item / Service name</label>
              <select
                style={inputStyle}
                value={quoteForm.description}
                onChange={(e) => {
                  const selectedService = services.find((s) => s.name === e.target.value);
                  if (selectedService) {
                    setQuoteForm((prev) => ({ ...prev,
                      serviceId: selectedService.id,
                      description: selectedService.name,
                      subtotal: String(selectedService.price ?? ""),
                      gstType: selectedService.gstType || "",
                      manualGst: false,
                      gstOverride: "",
                      quantity: 1,
                    }));
                  } else {
                    setQuoteForm((prev) => ({ ...prev,
                      serviceId: "",
                      gstType: prev.gstType || "GST on Income (10%)",
                      description: e.target.value,
                      manualGst: false,
                      gstOverride: "",
                    }));
                  }
                }}
              >
                <option value="">Select a service...</option>
                {services.map((service) => (
                  <option key={service.id} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                type="number"
                style={inputStyle}
                value={quoteForm.quantity}
                onChange={(e) =>
                  setQuoteForm((prev) => ({ ...prev,
                    quantity: e.target.value,
                    ...(prev.manualGst ? {} : { gstOverride: "" }),
                  }))
                }
              />
            </div>

            <div>
              <label style={labelStyle}>Price (ex GST)</label>
              <input
                type="number"
                style={inputStyle}
                value={quoteForm.subtotal}
                onChange={(e) =>
                  setQuoteForm((prev) => ({ ...prev,
                    subtotal: e.target.value,
                    ...(prev.manualGst ? {} : { gstOverride: "" }),
                  }))
                }
              />
            </div>

            <div>
              <label style={labelStyle}>GST Type</label>
              <select
                style={{ ...inputStyle,
                  background: clientIsGstExempt(quoteForm.clientId) ? "#F8FAFC" : colours.white,
                }}
                value={clientIsGstExempt(quoteForm.clientId) ? "GST Free" : quoteForm.gstType || "GST on Income (10%)"}
                disabled={clientIsGstExempt(quoteForm.clientId)}
                onChange={(e) =>
                  setQuoteForm((prev) => ({ ...prev,
                    gstType: e.target.value,
                    manualGst: false,
                    gstOverride: "",
                  }))
                }
              >
                {GST_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>GST Amount</label>
              <input
                type="number"
                style={{ ...inputStyle,
                  background: "#F8FAFC",
                }}
                readOnly
                value={
                  clientIsGstExempt(quoteForm.clientId)
                    ? "0.00"
                    : qGst.toFixed(2)
                }
              />
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: colours.muted }}>
            {clientIsGstExempt(quoteForm.clientId)
              ? "GST is currently turned off for this client because the client is marked as outside Australia or GST exempt."
              : quoteForm.gstType === "GST on Income (10%)"
                ? "GST is automatically calculated from the GST type, price and quantity."
                : quoteForm.description
                  ? "This line item is currently GST free."
                  : "Select a service, choose a GST type, and GST will auto-fill."}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <div style={{ minWidth: 360, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>Subtotal (excl GST):</span>
                <strong>{quoteMoney(qSubtotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>Total GST:</span>
                <strong>{quoteMoney(qGst)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>GST status:</span>
                <strong>{quoteGstStatus}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>Less fees:</span>
                <strong>{quoteMoney(quoteAdjustments.feeAmount)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: colours.muted }}>Less tax withheld:</span>
                <strong>{quoteMoney(quoteAdjustments.taxWithheld)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 18 }}>
                <span style={{ color: colours.teal, fontWeight: 800 }}>Total estimate:</span>
                <strong style={{ color: colours.teal }}>{quoteMoney(qTotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 18 }}>
                <span style={{ color: colours.purple, fontWeight: 800 }}>Net expected:</span>
                <strong style={{ color: colours.purple }}>{quoteMoney(quoteAdjustments.netExpected)}</strong>
              </div>
            </div>
          </div>        </SectionCard>

        <SectionCard
          title="Quote Actions"
          right={
            <div style={{ display: "flex", gap: 10 }}>
              <button style={buttonSecondary} onClick={openQuotePreview}>
                Preview
              </button>
              <button style={buttonSecondary}>Save Draft</button>
              <button style={buttonPrimary} onClick={saveQuote}>
                Save Quote
              </button>
            </div>
          }
        >
          <div style={{ color: colours.muted, fontSize: 14 }}>
            Use Preview to open a print-style quote in a new tab, then click Print / Download PDF.
          </div>
        </SectionCard>

        <SectionCard title="Quote List">
          <DataTable
            columns={[
              { key: "quoteNumber", label: "Quote" },
              { key: "clientId", label: "Client", render: (_, row) => getClientName(row.clientId) },
              { key: "quoteDate", label: "Date", render: (v) => formatDateAU(v) },
              { key: "expiryDate", label: "Expiry", render: (v) => formatDateAU(v) },
              { key: "total", label: "Total", render: (v, row) => formatCurrencyByCode(v, row.currencyCode || getClientCurrencyCode(getClientById(row.clientId))) },
              { key: "status", label: "Status" },
              {
                key: "actions",
                label: "",
                render: (_, row) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={buttonSecondary} onClick={() => openQuoteEditor(row)}>
                      View / Edit
                    </button>
                    <button style={buttonSecondary} onClick={() => openSavedQuotePreview(row)}>
                      Preview
                    </button>
                    <button style={buttonSecondary} onClick={() => deleteQuote(row.id)}>
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={quotes}
          />
        </SectionCard>
        {quoteEditorOpen && quoteEditorForm ? (() => {
          const editorClient = getClientById(quoteEditorForm.clientId);
          const editorSubtotal = safeNumber(quoteEditorForm.subtotal) * Math.max(1, safeNumber(quoteEditorForm.quantity || 1));
          const editorGst = calculateFormGst({
            unitPrice: quoteEditorForm.subtotal,
            quantity: quoteEditorForm.quantity,
            gstType: quoteEditorForm.gstType,
            clientId: quoteEditorForm.clientId,
            manualGst: false,
            gstOverride: "",
          });
          const editorTotal = editorSubtotal + editorGst;
          const editorCurrencyCode = getClientCurrencyCode(editorClient);
          const editorMoney = (value) => formatCurrencyByCode(value, editorCurrencyCode);
          const editorAdjustments = calculateAdjustmentValues({
            subtotal: editorSubtotal,
            total: editorTotal,
            client: editorClient,
            profile,
          });
          const editorGstStatus = clientIsGstExempt(quoteEditorForm.clientId)
            ? "GST not applicable"
            : editorGst > 0
              ? "GST applies"
              : "GST free";
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.45)",
                zIndex: 3000,
                overflowY: "auto",
                padding: 24,
              }}
            >
              <div
                style={{
                  maxWidth: 1180,
                  margin: "0 auto",
                  background: colours.bg,
                  borderRadius: 24,
                  padding: 24,
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
                  display: "grid",
                  gap: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, color: colours.muted, fontWeight: 700, letterSpacing: 0.4 }}>
                      QUOTE
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: colours.text }}>
                      {quoteEditorForm.quoteNumber || "Quote"}
                    </div>
                  </div>
                  <button style={buttonSecondary} onClick={closeQuoteEditor}>
                    Close
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)", gap: 20 }}>
                  <div style={{ display: "grid", gap: 20 }}>
                    <SectionCard title="Quote Details">
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 16,
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Client</label>
                          <select
                            style={inputStyle}
                            value={quoteEditorForm.clientId}
                            onChange={(e) => {
                              const selectedClient = getClientById(e.target.value);
                              setQuoteEditorForm((prev) => ({ ...prev,
                                clientId: e.target.value,
                                currencyCode: getClientCurrencyCode(selectedClient),
                                gstType: clientIsGstExempt(e.target.value) ? "GST Free" : prev.gstType,
                              }));
                            }}
                          >
                            {clients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>Quote Date</label>
                          <input
                            type="date"
                            style={inputStyle}
                            value={quoteEditorForm.quoteDate}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, quoteDate: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Expiry Date</label>
                          <input
                            type="date"
                            style={inputStyle}
                            value={quoteEditorForm.expiryDate}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, expiryDate: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Status</label>
                          <select
                            style={inputStyle}
                            value={quoteEditorForm.status}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, status: e.target.value }))
                            }
                          >
                            <option value="Draft">Draft</option>
                            <option value="Sent">Sent</option>
                            <option value="Accepted">Accepted</option>
                            <option value="Declined">Declined</option>
                            <option value="Expired">Expired</option>
                          </select>
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Item / Service name</label>
                          <select
                            style={inputStyle}
                            value={quoteEditorForm.description}
                            onChange={(e) => {
                              const selectedService = services.find((s) => s.name === e.target.value);
                              if (selectedService) {
                                setQuoteEditorForm((prev) => ({ ...prev,
                                  serviceId: selectedService.id,
                                  description: selectedService.name,
                                  subtotal: String(selectedService.price ?? ""),
                                  gstType: clientIsGstExempt(prev.clientId) ? "GST Free" : selectedService.gstType || "GST on Income (10%)",
                                  quantity: 1,
                                }));
                              } else {
                                setQuoteEditorForm((prev) => ({ ...prev,
                                  serviceId: "",
                                  description: e.target.value,
                                }));
                              }
                            }}
                          >
                            <option value="">Select a service...</option>
                            {services.map((service) => (
                              <option key={service.id} value={service.name}>
                                {service.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>Quantity</label>
                          <input
                            type="number"
                            style={inputStyle}
                            value={quoteEditorForm.quantity}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, quantity: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Price (ex GST)</label>
                          <input
                            type="number"
                            style={inputStyle}
                            value={quoteEditorForm.subtotal}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, subtotal: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>GST Type</label>
                          <select
                            style={{ ...inputStyle,
                              background: clientIsGstExempt(quoteEditorForm.clientId) ? "#F8FAFC" : colours.white,
                            }}
                            value={clientIsGstExempt(quoteEditorForm.clientId) ? "GST Free" : quoteEditorForm.gstType || "GST on Income (10%)"}
                            disabled={clientIsGstExempt(quoteEditorForm.clientId)}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, gstType: e.target.value }))
                            }
                          >
                            {GST_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>GST Amount</label>
                          <input
                            type="number"
                            style={{ ...inputStyle, background: "#F8FAFC" }}
                            readOnly
                            value={editorGst.toFixed(2)}
                          />
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={labelStyle}>Comments</label>
                          <textarea
                            style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                            value={quoteEditorForm.comments}
                            onChange={(e) =>
                              setQuoteEditorForm((prev) => ({ ...prev, comments: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </SectionCard>
                  </div>

                  <div style={{ display: "grid", gap: 20 }}>
                    <SectionCard title="Quote Summary">
                      <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Subtotal</span><strong>{editorMoney(editorSubtotal)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>GST</span><strong>{editorMoney(editorGst)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>GST status</span><strong>{editorGstStatus}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Less fees</span><strong>{editorMoney(editorAdjustments.feeAmount)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: colours.muted }}>Less tax withheld</span><strong>{editorMoney(editorAdjustments.taxWithheld)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, paddingTop: 8 }}><span style={{ color: colours.teal, fontWeight: 800 }}>Total estimate</span><strong style={{ color: colours.teal }}>{editorMoney(editorTotal)}</strong></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}><span style={{ color: colours.purple, fontWeight: 800 }}>Net expected</span><strong style={{ color: colours.purple }}>{editorMoney(editorAdjustments.netExpected)}</strong></div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Quote Actions">
                      <div style={{ display: "grid", gap: 12 }}>
                        <button
                          style={buttonSecondary}
                          onClick={() =>
                            openSavedQuotePreview({ ...(quotes.find((quote) => quote.id === quoteEditorForm.id) || {}),
                              ...quoteEditorForm,
                              subtotal: editorSubtotal,
                              gst: editorGst,
                              total: editorTotal,
                              clientId: safeNumber(quoteEditorForm.clientId),
                            })
                          }
                        >
                          Preview Quote
                        </button>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={quoteEditorForm.hidePhoneNumber}
                            onChange={(e) => setQuoteEditorForm((prev) => ({ ...prev, hidePhoneNumber: e.target.checked }))}
                          />
                          Hide my phone number
                        </label>
                      </div>
                    </SectionCard>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <button style={buttonSecondary} onClick={closeQuoteEditor}>Cancel</button>
                  <button style={buttonPrimary} onClick={saveQuoteEdits}>Save Changes</button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </div>
    );
    };

    const renderServices = () => {
    const filteredServices = services.filter((service) =>
      service.name.toLowerCase().includes(serviceSearch.toLowerCase())
    );
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <SectionCard
          title="Services"
          right={
            <div style={{ display: "flex", gap: 10 }}>
              <input
                style={{ ...inputStyle, minWidth: 220 }}
                placeholder="Search services"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
              />
              <button style={buttonPrimary} onClick={openNewServiceModal}>
                New Service
              </button>
            </div>
          }
        >
          <DataTable
            columns={[
              { key: "name", label: "Service" },
              { key: "gstType", label: "GST Type" },
              { key: "price", label: "Price", render: (v) => currency(v) },
              { key: "gst", label: "GST", render: (v) => currency(v) },
              { key: "total", label: "Total", render: (v) => currency(v) },
              {
                key: "actions",
                label: "",
                render: (_, row) => (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={buttonSecondary} onClick={() => openEditServiceModal(row)}>
                      Edit
                    </button>
                    <button style={buttonSecondary} onClick={() => deleteService(row.id)}>
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filteredServices}
          />
        </SectionCard>

        {showServiceModal && (
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
                borderRadius: 12,
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 20, borderBottom: `1px solid ${colours.border}` }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: colours.text }}>
                  {editingServiceId ? "Edit Service" : "New Service"}
                </div>
              </div>

              <div style={{ padding: 20, display: "grid", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Service Name</label>
                  <input
                    style={inputStyle}
                    value={serviceForm.name}
                    onChange={(e) => handleServiceFormChange("name", e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle}>GST Type</label>
                  <select
                    style={inputStyle}
                    value={serviceForm.gstType}
                    onChange={(e) => handleServiceFormChange("gstType", e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="GST on Income (10%)">GST on Income (10%)</option>
                    <option value="GST Free">GST Free</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Price</label>
                  <input
                    style={inputStyle}
                    value={serviceForm.price}
                    onChange={(e) => handleServiceFormChange("price", e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>GST</label>
                    <input style={inputStyle} value={serviceForm.gst} readOnly />
                  </div>
                  <div>
                    <label style={labelStyle}>Total</label>
                    <input style={inputStyle} value={serviceForm.total} readOnly />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "space-between",
                  padding: 20,
                  borderTop: `1px solid ${colours.border}`,
                }}
              >
                <button
                  style={buttonSecondary}
                  onClick={() => {
                    setShowServiceModal(false);
                    resetServiceForm();
                  }}
                >
                  Cancel
                </button>
                <button style={buttonPrimary} onClick={saveService}>
                  Save Service
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
    };

    const renderExpenses = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <SectionCard
        title="Expense Details"
        right={
          <button
            style={buttonPrimary}
            onClick={() => {
              setExpenseModalOpen(true);
              setExpenseTypeStep(1);
            }}
          >
            Add Expense
          </button>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              style={inputStyle}
              value={expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>Supplier</label>
            <input
              style={inputStyle}
              value={expenseForm.supplier}
              onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <input
              style={inputStyle}
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>Amount</label>
            <input
              type="number"
              style={inputStyle}
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Upload Receipt</label>
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
        </div>

        {expenseForm.receiptFileName ? (
          <div style={{ marginTop: 12, fontSize: 14, color: colours.muted }}>
            Selected receipt: {expenseForm.receiptFileName}
          </div>
        ) : null}

        {receiptFile ? (
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              style={buttonSecondary}
              onClick={() => {
                const previewUrl = URL.createObjectURL(receiptFile);
                window.open(previewUrl, "_blank");
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
              Remove Receipt
            </button>
          </div>
        ) : null}

        <div style={{ marginTop: 18 }}>
          <button style={buttonPrimary} onClick={saveExpense}>
            Save Expense
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Expense List">
        <DataTable
          columns={[
            { key: "date", label: "Date", render: (v) => formatDateAU(v) },
            { key: "supplier", label: "Supplier" },
            { key: "category", label: "Category" },
            { key: "description", label: "Description" },
            { key: "amount", label: "Amount", render: (v) => currency(v) },
            { key: "gst", label: "GST", render: (v) => currency(v) },
            { key: "expenseType", label: "Type" },
            { key: "workType", label: "Work Type" },
            {
              key: "actions",
              label: "Actions",
              render: (_, row) => (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {row.receiptUrl ? (
                    <button
                      style={buttonPrimary}
                      onClick={() => window.open(row.receiptUrl, "_blank")}
                    >
                      View Receipt
                    </button>
                  ) : (
                    <span style={{ color: colours.muted }}>No receipt</span>
                  )}

                  <button style={buttonSecondary} onClick={() => deleteExpense(row.id)}>
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          rows={expenses}
        />
      </SectionCard>
    </div>
    );
    const renderIncomeSources = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <SectionCard
        title="Income Sources"
        right={
          <button style={buttonPrimary} onClick={() => setShowIncomeSourceModal(true)}>
            New Income Source
          </button>
        }
      >
        <DataTable
          columns={[
            { key: "name", label: "Name" },
            { key: "incomeType", label: "Income Type" },
            { key: "beforeTax", label: "Before Tax", render: (v) => currency(v) },
            { key: "frequency", label: "Frequency" },
            {
              key: "startedAfterDate",
              label: "Started After 1 Jul 2025",
              render: (v) => (v ? "Yes" : "No"),
            },
            { key: "hasEndDate", label: "Fixed End Date", render: (v) => (v ? "Yes" : "No") },
            {
              key: "actions",
              label: "",
              render: (_, row) => (
                <button style={buttonSecondary} onClick={() => deleteIncomeSource(row.id)}>
                  Delete
                </button>
              ),
            },
          ]}
          rows={incomeSources}
        />
      </SectionCard>
    </div>
    );
    const renderDocuments = () => (
    <SectionCard
      title="Documents"
      right={
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="file"
            style={{ ...inputStyle, padding: "8px 10px", maxWidth: 260 }}
            onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
          />
          <button style={buttonPrimary} onClick={uploadDocument}>
            Upload
          </button>
        </div>
      }
    >
      <div style={{ color: colours.muted, fontSize: 14, marginBottom: 16 }}>
        Store generated PDFs, supporting documents, and uploaded files here.
      </div>

      {documents.length ? (
        <DataTable
          columns={[
            { key: "name", label: "Document" },
            {
              key: "uploadedAt",
              label: "Uploaded",
              render: (v) => formatDateAU(v),
            },
            {
              key: "url",
              label: "Open",
              render: (v) => (
                <a href={v} target="_blank" rel="noreferrer">
                  Open
                </a>
              ),
            },
            {
              key: "actions",
              label: "",
              render: (_, row) => (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={buttonSecondary} onClick={() => openDocumentEditor(row)}>View / Edit</button>
                  <button style={buttonSecondary} onClick={() => deleteDocument(row.id)}>Delete</button>
                </div>
              ),
            },
          ]}
          rows={documents}
        />
      ) : (
        <div style={{ color: colours.muted, fontSize: 14 }}>
          No documents uploaded yet.
        </div>
      )}

      {documentEditorOpen && documentEditorForm ? (
        <div style={{ marginTop: 20, ...cardStyle, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>View / Edit Document</h3>
            <button style={buttonSecondary} onClick={closeDocumentEditor}>Close</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <div><label style={labelStyle}>Document name</label><input style={inputStyle} value={documentEditorForm.name || ""} onChange={(e) => setDocumentEditorForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
            <div><label style={labelStyle}>URL</label><input style={inputStyle} value={documentEditorForm.url || ""} onChange={(e) => setDocumentEditorForm((prev) => ({ ...prev, url: e.target.value }))} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
            <button style={buttonSecondary} onClick={closeDocumentEditor}>Cancel</button>
            <button style={buttonPrimary} onClick={saveDocumentEdits}>Save Changes</button>
          </div>
        </div>
      ) : null}
    </SectionCard>
    );
    const renderSetupWizard = () => (
    <div style={{ minHeight: "100vh", background: colours.bg, display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ ...cardStyle, width: "100%", maxWidth: 760, padding: 28 }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: colours.text, marginBottom: 8 }}>Welcome to your portal setup</div>
        <div style={{ fontSize: 14, color: colours.muted, marginBottom: 22 }}>
          This wizard appears only for users who have not completed setup yet. It fills your Settings → Profile page first, then sends you to Settings so you can finish the rest of the pages yourself.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <div><label style={labelStyle}>First name</label><input style={inputStyle} value={wizardForm.firstName} onChange={(e) => setWizardForm((prev) => ({ ...prev, firstName: e.target.value }))} /></div>
          <div><label style={labelStyle}>Last name</label><input style={inputStyle} value={wizardForm.lastName} onChange={(e) => setWizardForm((prev) => ({ ...prev, lastName: e.target.value }))} /></div>
          <div><label style={labelStyle}>Preferred name</label><input style={inputStyle} value={wizardForm.preferredName} onChange={(e) => setWizardForm((prev) => ({ ...prev, preferredName: e.target.value }))} /></div>
          <div><label style={labelStyle}>Business name *</label><input style={inputStyle} value={wizardForm.businessName} onChange={(e) => setWizardForm((prev) => ({ ...prev, businessName: e.target.value }))} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Legal business name</label><input style={inputStyle} value={wizardForm.legalBusinessName} onChange={(e) => setWizardForm((prev) => ({ ...prev, legalBusinessName: e.target.value }))} /></div>
          <div><label style={labelStyle}>Email *</label><input style={inputStyle} value={wizardForm.email} onChange={(e) => setWizardForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={wizardForm.phone} onChange={(e) => setWizardForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Address</label><input style={inputStyle} value={wizardForm.address} onChange={(e) => setWizardForm((prev) => ({ ...prev, address: e.target.value }))} /></div>
          <div><label style={labelStyle}>ABN</label><input style={inputStyle} value={wizardForm.abn} onChange={(e) => setWizardForm((prev) => ({ ...prev, abn: e.target.value }))} /></div>
          <div><label style={labelStyle}>Work type</label><input style={inputStyle} value={wizardForm.workType} onChange={(e) => setWizardForm((prev) => ({ ...prev, workType: e.target.value }))} /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}><input type="checkbox" checked={wizardForm.gstRegistered} onChange={(e) => setWizardForm((prev) => ({ ...prev, gstRegistered: e.target.checked }))} />GST Registered</label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
          <button style={buttonPrimary} onClick={completeSetupWizard} disabled={wizardSaving}>{wizardSaving ? "Saving..." : "Continue to Dashboard"}</button>
          <button style={buttonSecondary} onClick={handleSignOut}>Log out</button>
        </div>
      </div>
    </div>
    );
    const renderAuthScreen = () => (
    <div style={{ minHeight: "100vh", background: colours.bg, display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ ...cardStyle, width: "100%", maxWidth: 520, padding: 28 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: colours.text, marginBottom: 8 }}>Sharon Portal Sign In</div>
        <div style={{ fontSize: 14, color: colours.muted, marginBottom: 20 }}>
          Sign in with Supabase Auth to view and edit invoices, quotes, expenses, and client data.
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} value={authForm.email} onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input type="password" style={inputStyle} value={authForm.password} onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))} />
          </div>
          {authMode === "signup" ? (
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input type="password" style={inputStyle} value={authForm.confirmPassword} onChange={(e) => setAuthForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} />
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <button style={buttonPrimary} onClick={handleAuthSubmit} disabled={authLoading}>{authLoading ? "Working..." : authMode === "signup" ? "Create Account" : "Sign In"}</button>
          <button style={buttonSecondary} onClick={() => setAuthMode((prev) => (prev === "signup" ? "signin" : "signup"))}>
            {authMode === "signup" ? "Use Sign In" : "Create Account"}
          </button>
          <button style={buttonSecondary} onClick={handlePasswordReset}>Reset Password</button>
        </div>
      </div>
    </div>
    );
    const renderSettings = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <SectionCard
        title="Settings"
        right={
          <div style={{ minWidth: 220 }}>
            <select
              style={inputStyle}
              value={activeSettingsTab}
              onChange={(e) => setActiveSettingsTab(e.target.value)}
            >
              {settingsTabs.map((tab) => (
                <option key={tab} value={tab}>
                  {tab}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {activeSettingsTab === "Profile" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Business Name</label>
              <input
                style={inputStyle}
                value={profile.businessName}
                onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>ABN</label>
              <input
                style={inputStyle}
                value={profile.abn}
                onChange={(e) => setProfile({ ...profile, abn: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={inputStyle}
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Phone</label>
              <input
                style={inputStyle}
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Address</label>
              <input
                style={inputStyle}
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              />
            </div>
          </div>
        )}

        {activeSettingsTab === "Financial" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Invoice Prefix</label>
              <input
                style={inputStyle}
                value={profile.invoicePrefix}
                onChange={(e) => setProfile({ ...profile, invoicePrefix: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Quote Prefix</label>
              <input
                style={inputStyle}
                value={profile.quotePrefix}
                onChange={(e) => setProfile({ ...profile, quotePrefix: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Payment Terms (days)</label>
              <input
                type="number"
                style={inputStyle}
                value={profile.paymentTermsDays}
                onChange={(e) => setProfile({ ...profile, paymentTermsDays: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Tax Rate %</label>
              <input
                type="number"
                style={inputStyle}
                value={profile.taxRate}
                onChange={(e) => setProfile({ ...profile, taxRate: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Fee Rate %</label>
              <input
                type="number"
                style={{ ...inputStyle, background: "#F8FAFC", color: colours.muted }}
                value={LOCKED_FEE_RATE_PERCENT}
                readOnly
                disabled
                title="Locked at 1%"
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.gstRegistered}
                onChange={(e) => setProfile({ ...profile, gstRegistered: e.target.checked })}
              />
              GST Registered
            </label>

            <div>
              <label style={labelStyle}>Bank Name</label>
              <input
                style={inputStyle}
                value={profile.bankName}
                onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>BSB</label>
              <input
                style={inputStyle}
                value={profile.bsb}
                onChange={(e) => setProfile({ ...profile, bsb: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Account Number</label>
              <input
                style={inputStyle}
                value={profile.accountNumber}
                onChange={(e) => setProfile({ ...profile, accountNumber: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>PayID</label>
              <input
                style={inputStyle}
                value={profile.payId}
                onChange={(e) => setProfile({ ...profile, payId: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Stripe Payment Link</label>
              <input
                style={inputStyle}
                value={profile.stripePaymentLink || ""}
                onChange={(e) => setProfile({ ...profile, stripePaymentLink: e.target.value })}
                placeholder="https://buy.stripe.com/..."
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>PayPal Payment Link</label>
              <input
                style={inputStyle}
                value={profile.paypalPaymentLink || ""}
                onChange={(e) => setProfile({ ...profile, paypalPaymentLink: e.target.value })}
                placeholder="https://www.paypal.com/paypalme/yourname"
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Stripe Server URL</label>
              <input
                style={inputStyle}
                value={profile.stripeServerUrl || ""}
                onChange={(e) => setProfile({ ...profile, stripeServerUrl: e.target.value })}
                placeholder="Leave blank for automatic live URL, or enter your backend URL"
              />
            </div>
          </div>
        )}

        {activeSettingsTab === "Branding" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={labelStyle}>Upload Logo</label>
              <input
                type="file"
                accept="image/*"
                style={inputStyle}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await fileToDataUrl(file);
                  setProfile((prev) => ({ ...prev,
                    logoFileName: file.name,
                    logoDataUrl: dataUrl,
                  }));
                }}
              />
            </div>

            {profile.logoDataUrl ? (
              <div>
                <img
                  src={profile.logoDataUrl}
                  alt="Logo preview"
                  style={{ maxHeight: LOGO_PREVIEW_MAX_HEIGHT, maxWidth: LOGO_PREVIEW_MAX_WIDTH, objectFit: "contain" }}
                />
              </div>
            ) : null}

            <div>
              <label style={labelStyle}>Legal Business Name</label>
              <input
                style={inputStyle}
                value={profile.legalBusinessName}
                onChange={(e) => setProfile({ ...profile, legalBusinessName: e.target.value })}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.hideLegalNameOnDocs}
                onChange={(e) => setProfile({ ...profile, hideLegalNameOnDocs: e.target.checked })}
              />
              Hide legal name on documents
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.hideAddressOnDocs}
                onChange={(e) => setProfile({ ...profile, hideAddressOnDocs: e.target.checked })}
              />
              Hide address on documents
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.hidePhoneOnDocs}
                onChange={(e) => setProfile({ ...profile, hidePhoneOnDocs: e.target.checked })}
              />
              Hide phone on documents
            </label>
          </div>
        )}

        {activeSettingsTab === "Security" && (
          <div style={{ display: "grid", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={profile.twoFactor}
                onChange={(e) => setProfile({ ...profile, twoFactor: e.target.checked })}
              />
              Enable two-factor authentication
            </label>
          </div>
        )}
      </SectionCard>
    </div>
    );
    if (!authReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colours.bg,
          display: "grid",
          placeItems: "center",
          color: colours.text,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Loading portal...
      </div>
    );
    }

    if (!authUser) {
    return renderAuthScreen();
    }

    if (isSupabaseRestoring || !hasLoadedUserProfile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colours.bg,
          display: "grid",
          placeItems: "center",
          color: colours.text,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Loading your profile.
      </div>
    );
    }

    if (!setupComplete) {
    return renderSetupWizard();
    }

    return (
    <div
      style={{
        minHeight: "100vh",
        background: colours.bg,
        color: colours.text,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
        <aside
          style={{
            background: colours.white,
            borderRight: `1px solid ${colours.border}`,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, color: colours.purple, marginBottom: 20 }}>
            {profile.businessName || "Sharons Accounting Service"}
          </div>

          <div style={{ fontSize: 13, color: colours.muted, marginBottom: 16 }}>
            Signed in as {authUser.email || "user"}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => setActivePage(item)}
                style={{
                  textAlign: "left",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                  background: activePage === item ? colours.lightPurple : "transparent",
                  color: activePage === item ? colours.purple : colours.text,
                }}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={handleSignOut}
            style={{ ...buttonSecondary, width: "100%", marginTop: 16 }}
          >
            Log out
          </button>
        </aside>

        <main style={{ padding: 24 }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            {activePage === "dashboard" && renderDashboard()}
            {activePage === "financial insights" && renderFinancialInsights()}
            {activePage === "clients" && renderClients()}
            {activePage === "invoices" && renderInvoices()}
            {activePage === "quotes" && renderQuotes()}
            {activePage === "services" && renderServices()}
            {activePage === "expenses" && renderExpenses()}
            {activePage === "income sources" && renderIncomeSources()}
            {activePage === "documents" && renderDocuments()}
            {activePage === "settings" && renderSettings()}
          </div>
        </main>
      </div>

      <ExpenseTypeModal
        isOpen={expenseModalOpen}
        onClose={resetExpenseModal}
        expenseTypeStep={expenseTypeStep}
        setExpenseTypeStep={setExpenseTypeStep}
        expenseTypeSelection={expenseTypeSelection}
        setExpenseTypeSelection={setExpenseTypeSelection}
        expenseWorkType={expenseWorkType}
        setExpenseWorkType={setExpenseWorkType}
        expenseCategorySelection={expenseCategorySelection}
        setExpenseCategorySelection={setExpenseCategorySelection}
        expenseWorkTypes={expenseWorkTypes}
        setExpenseWorkTypes={setExpenseWorkTypes}
        searchExpenseCategory={searchExpenseCategory}
        setSearchExpenseCategory={setSearchExpenseCategory}
        expenseForm={expenseForm}
        setExpenseForm={setExpenseForm}
        receiptFile={receiptFile}
        setReceiptFile={setReceiptFile}
        onNext={nextExpenseModalStep}
      />

      <IncomeSourceModal
        isOpen={showIncomeSourceModal}
        onClose={() => setShowIncomeSourceModal(false)}
        incomeSourceForm={incomeSourceForm}
        setIncomeSourceForm={setIncomeSourceForm}
        onSave={saveIncomeSource}
      />
    </div> 
    );
}

import React from "react";
import {
  colours,
  cardStyle,
  labelStyle,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
  currency,
  safeNumber,
  parseLocalDate,
  formatDateAU,
  addDays,
  addDaysEOM,
  todayLocal,
  formatCurrencyByCode,
  getClientCurrencyCode,
  calculateAdjustmentValues,
  GST_TYPE_OPTIONS,
  expenseCategories,
  incomeTypeOptions,
  incomeFrequencyOptions,
  blankClient,
  initialProfile,
  makePaymentReference,
  nextNumber,
  getApiBaseUrl,
  DEFAULT_API_BASE_URL,
  DEFAULT_MONTHLY_SUBSCRIPTION,
  SUPABASE_TABLES,
  isValidEmail,
  collectValidationErrors,
  summariseValidationErrors,
  getSubscriptionAccess,
  LOGO_PREVIEW_MAX_HEIGHT,
  LOGO_PREVIEW_MAX_WIDTH,
} from "./PortalHelpers";

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
    <div className="sas-confirm-backdrop" style={{ position: "fixed", inset: 0, zIndex: 99998, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="sas-confirm-card" style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: 'sans-serif' }}>
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

// ── Subscription helpers (imported from PortalHelpers) ───────────────────────

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
          {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13 }}>{error}</div>}
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

export function SectionCard({ title, children, right }) {
  return (
    <div className="sas-section-card" style={{ ...cardStyle, padding: 22, overflow: "hidden" }}>
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

export function SummaryBox({ title, value, subtitle }) {
  return (
    <div className="sas-summary-box" style={{ ...cardStyle, padding: 20, minHeight: 128 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: colours.muted }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 30,
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

export function DashboardHero({ title, subtitle, highlight, children }) {
  return (
    <div
      className="sas-dashboard-hero sas-hero-grid"
      style={{
        background: `linear-gradient(135deg, ${colours.navy} 0%, ${colours.purple} 58%, ${colours.teal} 100%)`,
        borderRadius: 26,
        padding: 30,
        color: "#FFFFFF",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.7fr) minmax(280px, 1fr)",
        gap: 24,
        alignItems: "stretch",
        boxShadow: "0 18px 40px rgba(43, 47, 107, 0.18)",
      }}
    >
      <div className="sas-hero-content" style={{ minWidth: 0 }}>
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
        <div className="sas-hero-title" style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 16, overflowWrap: "anywhere", wordBreak: "break-word" }}>{title}</div>
        <div className="sas-hero-subtitle" style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.92, marginTop: 12, maxWidth: 780 }}>{subtitle}</div>
      </div>
      <div
        className="sas-hero-focus-card"
        style={{
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: 22,
          padding: 22,
          display: "grid",
          gap: 16,
          alignContent: "space-between",
          minHeight: 200,
          minWidth: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.82 }}>
            Current focus
          </div>
          <div className="sas-hero-focus-value" style={{ fontSize: 30, fontWeight: 900, marginTop: 10, overflowWrap: "anywhere", wordBreak: "break-word" }}>{highlight}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function InsightChip({ label, value }) {
  return (
    <div
      className="sas-insight-chip"
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
      className="sas-metric-card"
      style={{
        ...cardStyle,
        padding: 18,
        position: "relative",
        overflow: "hidden",
        minHeight: 144,
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
      className="sas-action-card"
      style={{
        ...cardStyle,
        padding: 20,
        display: "grid",
        gap: 12,
        border: `1px solid ${colours.border}`,
        minHeight: 208,
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
    <div className="sas-table-wrap" style={{ overflowX: "auto", border: `1px solid ${colours.border}`, borderRadius: 18, background: "#fff" }}>
      <table className="sas-data-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 780 }}>
        <thead>
          <tr style={{ background: "#F8FAFC" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: "left",
                  padding: "13px 14px",
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
                    padding: "13px 14px",
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



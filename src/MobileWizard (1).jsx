/**
 * MobileWizard.jsx
 *
 * A self-contained, mobile-first wizard for creating Invoices, Quotes and
 * Expenses.  Drop it next to your other portal files and import it wherever
 * you need it.
 *
 * Usage example (inside your main portal component):
 *
 *   import MobileWizard from "./MobileWizard";
 *
 *   // Render it wherever you detect a small screen, e.g.:
 *   {isMobile && (
 *     <MobileWizard
 *       profile={profile}
 *       clients={clients}
 *       invoices={invoices}
 *       quotes={quotes}
 *       expenses={expenses}
 *       services={services}
 *       onSaveInvoice={saveInvoice}      // your existing save functions
 *       onSaveQuote={saveQuote}
 *       onSaveExpense={saveExpense}
 *       onEmailDocument={sendSavedDocumentEmail}
 *       supabaseTables={SUPABASE_TABLES}
 *       upsertRecord={upsertRecordInDatabase}
 *       toast={toast}
 *     />
 *   )}
 *
 * All save logic mirrors what the website already does. Emailing uses the same
 * sendSavedDocumentEmail / /api/send-invoice-attachment-email flow — no PDF,
 * just the HTML email body exactly like the website version.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  colours,
  safeNumber,
  todayLocal,
  addDays,
  formatDateAU,
  nextNumber,
  makePaymentReference,
  GST_TYPE_OPTIONS,
  expenseCategories,
  calculateAdjustmentValues,
  getClientCurrencyCode,
  formatCurrencyByCode,
  isValidEmail,
  getApiBaseUrl,
  SUPABASE_TABLES,
} from "./PortalHelpers";

// ─── tiny helpers ────────────────────────────────────────────────────────────

const currency = (v) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(Number(v || 0));

const blankLine = () => ({
  id: Date.now() + Math.random(),
  description: "",
  quantity: 1,
  unitPrice: "",
  gstType: "GST on Income (10%)",
  rowGst: 0,
  rowTotal: 0,
});

// ─── shared styles ───────────────────────────────────────────────────────────

const s = {
  screen: {
    position: "fixed",
    inset: 0,
    background: "#F8FAFC",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  header: {
    background: "#fff",
    borderBottom: `1px solid ${colours.border}`,
    padding: "12px 16px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  body: {
    flex: 1,
    padding: "16px 16px 100px",
    overflowY: "auto",
  },
  footer: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fff",
    borderTop: `1px solid ${colours.border}`,
    padding: "12px 16px",
    display: "flex",
    gap: 10,
    zIndex: 10,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: colours.text,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    border: `1px solid ${colours.border}`,
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    boxSizing: "border-box",
    background: "#fff",
    WebkitAppearance: "none",
    appearance: "none",
  },
  select: {
    width: "100%",
    border: `1px solid ${colours.border}`,
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    boxSizing: "border-box",
    background: "#fff",
    WebkitAppearance: "none",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24'%3E%3Cpath fill='%2364748B' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 36,
  },
  btnPrimary: {
    flex: 1,
    background: colours.purple,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 16px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  btnSecondary: {
    flex: 1,
    background: "#fff",
    color: colours.text,
    border: `1px solid ${colours.border}`,
    borderRadius: 12,
    padding: "14px 16px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  btnTeal: {
    flex: 1,
    background: colours.teal,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 16px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  card: {
    background: "#fff",
    border: `1px solid ${colours.border}`,
    borderRadius: 14,
    padding: "14px",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: colours.text,
    marginBottom: 16,
  },
  fieldGroup: { marginBottom: 14 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: 14,
    color: colours.muted,
  },
  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0 4px",
    fontSize: 18,
    fontWeight: 800,
    color: colours.teal,
    borderTop: `2px solid ${colours.border}`,
    marginTop: 8,
  },
  pill: (active) => ({
    flex: 1,
    padding: "10px 6px",
    borderRadius: 10,
    border: `2px solid ${active ? colours.purple : colours.border}`,
    background: active ? colours.lightPurple : "#fff",
    color: active ? colours.purple : colours.text,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    textAlign: "center",
    WebkitTapHighlightColor: "transparent",
  }),
  stepDot: (active, done) => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: done ? colours.teal : active ? colours.purple : colours.border,
    flexShrink: 0,
  }),
};

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ steps, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={s.stepDot(i === current, i < current)} />
            <span style={{ fontSize: 10, color: i === current ? colours.purple : colours.muted, fontWeight: i === current ? 700 : 400, whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? colours.teal : colours.border, marginBottom: 14, borderRadius: 1 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Document type selector ───────────────────────────────────────────────────

function TypeSelector({ onSelect, onClose }) {
  const types = [
    { key: "invoice", icon: "🧾", label: "Invoice", desc: "Bill a client for work done" },
    { key: "quote",   icon: "📋", label: "Quote",   desc: "Send a price estimate to a client" },
    { key: "expense", icon: "💳", label: "Expense",  desc: "Record a business expense" },
  ];
  return (
    <div style={s.screen}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: colours.purple }}>Quick Create</div>
            <div style={{ fontSize: 12, color: colours.muted, marginTop: 2 }}>What would you like to create?</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: colours.muted, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        </div>
      </div>
      <div style={s.body}>
        <div style={{ display: "grid", gap: 14, marginTop: 8 }}>
          {types.map(({ key, icon, label, desc }) => (
            <button key={key} onClick={() => onSelect(key)}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 16px", background: "#fff", border: `1px solid ${colours.border}`, borderRadius: 16, cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ fontSize: 32 }}>{icon}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: colours.text }}>{label}</div>
                <div style={{ fontSize: 13, color: colours.muted, marginTop: 3 }}>{desc}</div>
              </div>
              <div style={{ marginLeft: "auto", color: colours.muted, fontSize: 18 }}>›</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Line items editor ────────────────────────────────────────────────────────

function LineItemsStep({ lineItems, setLineItems, clientIsGstExempt, gstRegistered, services }) {
  const computeRow = (item) => {
    const qty = Math.max(1, safeNumber(item.quantity || 1));
    const unit = safeNumber(item.unitPrice);
    const rowSubtotal = qty * unit;
    const exempt = clientIsGstExempt;
    const effectiveGst = (!exempt && gstRegistered && item.gstType === "GST on Income (10%)") ? rowSubtotal * 0.1 : 0;
    return { ...item, rowGst: effectiveGst, rowTotal: rowSubtotal + effectiveGst };
  };

  const update = (id, field, value) => {
    setLineItems((prev) => prev.map((li) => li.id === id ? computeRow({ ...li, [field]: value }) : li));
  };

  const addLine = () => setLineItems((prev) => [...prev, computeRow(blankLine())]);
  const removeLine = (id) => setLineItems((prev) => prev.filter((li) => li.id !== id));

  const subtotal = lineItems.reduce((s, l) => s + safeNumber(l.unitPrice) * Math.max(1, safeNumber(l.quantity || 1)), 0);
  const gst = lineItems.reduce((s, l) => s + safeNumber(l.rowGst), 0);
  const total = subtotal + gst;

  return (
    <div>
      <div style={s.sectionTitle}>Line Items</div>
      {lineItems.map((li, idx) => (
        <div key={li.id} style={s.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: colours.purple }}>Item {idx + 1}</span>
            {lineItems.length > 1 && (
              <button onClick={() => removeLine(li.id)} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 18, cursor: "pointer", padding: 0 }}>🗑</button>
            )}
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Description *</label>
            {services && services.length > 0 ? (
              <select style={s.select} value={li.description}
                onChange={(e) => {
                  const svc = services.find((sv) => sv.name === e.target.value);
                  if (svc) {
                    update(li.id, "description", svc.name);
                    update(li.id, "unitPrice", svc.rate || svc.price || "");
                    update(li.id, "gstType", svc.gstType || "GST on Income (10%)");
                  } else {
                    update(li.id, "description", e.target.value);
                  }
                }}>
                <option value="">Select service…</option>
                {services.map((sv) => <option key={sv.id} value={sv.name}>{sv.name}</option>)}
                <option value="__custom__">Custom description…</option>
              </select>
            ) : (
              <input style={s.input} placeholder="Service or product description" value={li.description}
                onChange={(e) => update(li.id, "description", e.target.value)} />
            )}
            {/* Allow free-text if custom selected */}
            {li.description === "__custom__" && (
              <input style={{ ...s.input, marginTop: 8 }} placeholder="Enter description" value={li._customDesc || ""}
                onChange={(e) => {
                  setLineItems((prev) => prev.map((l) => l.id === li.id ? { ...l, description: e.target.value, _customDesc: e.target.value } : l));
                }} />
            )}
          </div>

          <div style={s.row2}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Qty</label>
              <input style={s.input} type="number" min="1" inputMode="decimal" value={li.quantity}
                onChange={(e) => update(li.id, "quantity", e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Unit Price ($)</label>
              <input style={s.input} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={li.unitPrice}
                onChange={(e) => update(li.id, "unitPrice", e.target.value)} />
            </div>
          </div>

          {!clientIsGstExempt && gstRegistered && (
            <div style={s.fieldGroup}>
              <label style={s.label}>GST Type</label>
              <select style={s.select} value={li.gstType} onChange={(e) => update(li.id, "gstType", e.target.value)}>
                {GST_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          <div style={{ fontSize: 13, color: colours.muted, textAlign: "right" }}>
            Line total: <strong style={{ color: colours.text }}>{currency(li.rowTotal)}</strong>
          </div>
        </div>
      ))}

      <button onClick={addLine} style={{ width: "100%", padding: "13px", border: `2px dashed ${colours.border}`, borderRadius: 12, background: "none", color: colours.purple, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 20 }}>
        + Add Line Item
      </button>

      {/* Totals summary */}
      <div style={s.card}>
        <div style={s.totalRow}><span>Subtotal (ex GST)</span><span>{currency(subtotal)}</span></div>
        {gst > 0 && <div style={s.totalRow}><span>GST (10%)</span><span>{currency(gst)}</span></div>}
        <div style={s.grandTotalRow}><span>Total</span><span>{currency(total)}</span></div>
      </div>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ type, number, emailing, emailResult, onDone, onCreateAnother }) {
  return (
    <div style={s.screen}>
      <div style={{ ...s.body, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{type === "expense" ? "✅" : "🎉"}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: colours.text, marginBottom: 8 }}>
          {type === "invoice" ? "Invoice Saved!" : type === "quote" ? "Quote Saved!" : "Expense Saved!"}
        </div>
        {number && (
          <div style={{ fontSize: 15, color: colours.muted, marginBottom: 20 }}>
            {type === "invoice" ? `Invoice #${number}` : type === "quote" ? `Quote #${number}` : ""}
          </div>
        )}
        {emailing && (
          <div style={{ fontSize: 14, color: colours.muted, marginBottom: 10 }}>📧 Sending email…</div>
        )}
        {emailResult && (
          <div style={{ fontSize: 14, color: emailResult.ok ? "#166534" : "#B42318", background: emailResult.ok ? "#DCFCE7" : "#FEE2E2", padding: "10px 16px", borderRadius: 10, marginBottom: 16 }}>
            {emailResult.message}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 16 }}>
          <button onClick={onCreateAnother} style={{ ...s.btnPrimary, flex: "none" }}>
            Create Another
          </button>
          <button onClick={onDone} style={{ ...s.btnSecondary, flex: "none" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE WIZARD
// ─────────────────────────────────────────────────────────────────────────────

function InvoiceWizard({ profile, clients, invoices, services, onClose, onSaved, upsertRecord, sendEmail, toast }) {
  const STEPS = ["Client", "Items", "Details", "Review"];
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [done, setDone] = useState(null); // { number }

  const today = todayLocal();
  const defaultDue = addDays(today, safeNumber(profile?.paymentTermsDays) || 14);

  const [form, setForm] = useState({
    clientId: "",
    invoiceDate: today,
    dueDate: defaultDue,
    lineItems: [blankLine()],
    comments: "",
    purchaseOrderReference: "",
    hidePhoneNumber: Boolean(profile?.hidePhoneOnDocs),
  });

  const setF = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const selectedClient = clients.find((c) => c.id === safeNumber(form.clientId));
  const clientIsGstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);

  // Recompute due date when invoice date changes
  useEffect(() => {
    if (form.invoiceDate) {
      setF("dueDate", addDays(form.invoiceDate, safeNumber(profile?.paymentTermsDays) || 14));
    }
  }, [form.invoiceDate]);

  const computeLines = useCallback(() => {
    return form.lineItems.map((li) => {
      const qty = Math.max(1, safeNumber(li.quantity || 1));
      const unit = safeNumber(li.unitPrice);
      const rowSubtotal = qty * unit;
      const exempt = clientIsGstExempt;
      const effectiveGst = (!exempt && profile?.gstRegistered && li.gstType === "GST on Income (10%)") ? rowSubtotal * 0.1 : 0;
      return { ...li, qty, unit, rowSubtotal, rowGst: effectiveGst, rowTotal: rowSubtotal + effectiveGst };
    });
  }, [form.lineItems, clientIsGstExempt, profile?.gstRegistered]);

  const totals = (() => {
    const lines = computeLines();
    const subtotal = lines.reduce((s, l) => s + l.rowSubtotal, 0);
    const gst = lines.reduce((s, l) => s + l.rowGst, 0);
    const total = subtotal + gst;
    const adj = calculateAdjustmentValues({ subtotal, total, client: selectedClient, profile });
    return { subtotal, gst, total, ...adj };
  })();

  const canNext = () => {
    if (step === 0) return Boolean(form.clientId);
    if (step === 1) return computeLines().some((l) => l.rowSubtotal > 0 || l.description);
    return true;
  };

  const handleSave = async () => {
    if (!form.clientId) { toast.warning("Please select a client"); return; }
    const computedLines = computeLines();
    const hasLines = computedLines.some((l) => l.rowSubtotal > 0 || l.description);
    if (!hasLines) { toast.warning("Add at least one line item"); return; }

    const invoiceNumber = nextNumber(profile?.invoicePrefix || "INV", invoices, "invoiceNumber");
    const payload = {
      invoiceNumber,
      clientId: safeNumber(form.clientId),
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate,
      lineItems: computedLines,
      gstType: computedLines[0]?.gstType || "GST on Income (10%)",
      currencyCode: getClientCurrencyCode(selectedClient),
      gstStatus: clientIsGstExempt ? "GST not applicable" : totals.gst > 0 ? "GST applies" : "GST free",
      description: computedLines.map((l) => l.description).filter(Boolean).join("; "),
      subtotal: totals.subtotal,
      gst: totals.gst,
      total: totals.total,
      feeAmount: totals.feeAmount,
      taxWithheld: totals.taxWithheld,
      netExpected: totals.netExpected,
      comments: form.comments,
      purchaseOrderReference: form.purchaseOrderReference,
      hidePhoneNumber: form.hidePhoneNumber,
      quantity: computedLines.reduce((s, l) => s + l.qty, 0),
      status: "Draft",
      paymentReference: makePaymentReference(invoiceNumber),
      stripeCheckoutUrl: "",
    };

    setSaving(true);
    try {
      const saved = await upsertRecord(SUPABASE_TABLES.invoices, payload);
      onSaved("invoice", saved);

      // Email — same logic as the website
      const shouldEmail = Boolean(selectedClient?.sendToClient && isValidEmail(selectedClient?.email));
      if (shouldEmail && sendEmail) {
        setEmailing(true);
        setDone({ number: invoiceNumber });
        try {
          const result = await sendEmail({ documentType: "invoice", documentRecord: saved });
          if (result?.ok) {
            await upsertRecord(SUPABASE_TABLES.invoices, { ...saved, emailedAt: new Date().toISOString(), emailRecipients: result.recipients || [] });
            setEmailResult({ ok: true, message: result.message || "Invoice emailed!" });
          } else if (!result?.skipped) {
            setEmailResult({ ok: false, message: result?.message || "Email failed" });
          }
        } catch (e) {
          setEmailResult({ ok: false, message: e.message || "Email failed" });
        } finally {
          setEmailing(false);
        }
      } else {
        setDone({ number: invoiceNumber });
      }
      toast.success(`Invoice ${invoiceNumber} saved!`);
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <SuccessScreen type="invoice" number={done.number} emailing={emailing} emailResult={emailResult}
        onDone={onClose} onCreateAnother={() => { setDone(null); setStep(0); setForm({ clientId: "", invoiceDate: today, dueDate: defaultDue, lineItems: [blankLine()], comments: "", purchaseOrderReference: "", hidePhoneNumber: Boolean(profile?.hidePhoneOnDocs) }); setEmailResult(null); }} />
    );
  }

  return (
    <div style={s.screen}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: colours.purple }}>New Invoice</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: colours.muted, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        </div>
        <StepBar steps={STEPS} current={step} />
      </div>

      <div style={s.body}>
        {/* Step 0: Client */}
        {step === 0 && (
          <div>
            <div style={s.sectionTitle}>Select Client</div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Client *</label>
              <select style={s.select} value={form.clientId} onChange={(e) => setF("clientId", e.target.value)}>
                <option value="">Choose a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.businessName ? ` — ${c.businessName}` : ""}</option>)}
              </select>
            </div>
            {selectedClient && (
              <div style={{ ...s.card, background: colours.lightPurple, border: `1px solid ${colours.purple}33` }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: colours.purple, marginBottom: 4 }}>{selectedClient.name}</div>
                {selectedClient.email && <div style={{ fontSize: 13, color: colours.muted }}>{selectedClient.email}</div>}
                {selectedClient.businessName && <div style={{ fontSize: 13, color: colours.muted }}>{selectedClient.businessName}</div>}
                {selectedClient.outsideAustraliaOrGstExempt && <div style={{ fontSize: 12, marginTop: 6, color: "#B45309", fontWeight: 600 }}>⚠️ GST exempt client</div>}
                {selectedClient.sendToClient && isValidEmail(selectedClient.email) && (
                  <div style={{ fontSize: 12, marginTop: 6, color: "#166534", fontWeight: 600 }}>📧 Invoice will be auto-emailed on save</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Line items */}
        {step === 1 && (
          <LineItemsStep
            lineItems={form.lineItems}
            setLineItems={(v) => setF("lineItems", typeof v === "function" ? v(form.lineItems) : v)}
            clientIsGstExempt={clientIsGstExempt}
            gstRegistered={profile?.gstRegistered}
            services={services}
          />
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div>
            <div style={s.sectionTitle}>Invoice Details</div>
            <div style={s.row2}>
              <div style={s.fieldGroup}>
                <label style={s.label}>Invoice Date</label>
                <input style={s.input} type="date" value={form.invoiceDate} onChange={(e) => setF("invoiceDate", e.target.value)} />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Due Date</label>
                <input style={s.input} type="date" value={form.dueDate} onChange={(e) => setF("dueDate", e.target.value)} />
              </div>
            </div>
            {selectedClient?.hasPurchaseOrder && (
              <div style={s.fieldGroup}>
                <label style={s.label}>PO / Reference</label>
                <input style={s.input} placeholder="Purchase order number" value={form.purchaseOrderReference} onChange={(e) => setF("purchaseOrderReference", e.target.value)} />
              </div>
            )}
            <div style={s.fieldGroup}>
              <label style={s.label}>Comments / Notes</label>
              <textarea style={{ ...s.input, minHeight: 80, resize: "vertical" }} placeholder="Any extra notes for the client…" value={form.comments} onChange={(e) => setF("comments", e.target.value)} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: colours.text }}>
              <input type="checkbox" checked={form.hidePhoneNumber} onChange={(e) => setF("hidePhoneNumber", e.target.checked)} />
              Hide phone number on invoice
            </label>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div>
            <div style={s.sectionTitle}>Review & Save</div>
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colours.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Client</div>
              <div style={{ fontWeight: 700 }}>{selectedClient?.name || "—"}</div>
              {selectedClient?.email && <div style={{ fontSize: 13, color: colours.muted }}>{selectedClient.email}</div>}
            </div>
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colours.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Dates</div>
              <div style={s.row2}>
                <div><div style={{ fontSize: 12, color: colours.muted }}>Invoice Date</div><div style={{ fontWeight: 700 }}>{formatDateAU(form.invoiceDate)}</div></div>
                <div><div style={{ fontSize: 12, color: colours.muted }}>Due Date</div><div style={{ fontWeight: 700 }}>{formatDateAU(form.dueDate)}</div></div>
              </div>
            </div>
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colours.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Items</div>
              {computeLines().map((li, i) => (
                <div key={li.id} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, marginBottom: 8, borderBottom: i < form.lineItems.length - 1 ? `1px solid ${colours.border}` : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{li.description || `Item ${i + 1}`}</div>
                    <div style={{ fontSize: 12, color: colours.muted }}>Qty {li.qty} × {currency(li.unit)}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{currency(li.rowTotal)}</div>
                </div>
              ))}
              <div style={s.totalRow}><span>Subtotal</span><span>{currency(totals.subtotal)}</span></div>
              {totals.gst > 0 && <div style={s.totalRow}><span>GST</span><span>{currency(totals.gst)}</span></div>}
              <div style={s.grandTotalRow}><span>Total Due</span><span>{currency(totals.total)}</span></div>
            </div>
            {form.comments && (
              <div style={s.card}>
                <div style={{ fontWeight: 700, fontSize: 14, color: colours.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Notes</div>
                <div style={{ fontSize: 14 }}>{form.comments}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <button style={s.btnSecondary} onClick={() => step === 0 ? onClose() : setStep((p) => p - 1)}>
          {step === 0 ? "Cancel" : "‹ Back"}
        </button>
        {step < STEPS.length - 1 ? (
          <button style={{ ...s.btnPrimary, opacity: canNext() ? 1 : 0.5 }} disabled={!canNext()} onClick={() => setStep((p) => p + 1)}>
            Next ›
          </button>
        ) : (
          <button style={s.btnTeal} disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save Invoice ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE WIZARD
// ─────────────────────────────────────────────────────────────────────────────

function QuoteWizard({ profile, clients, quotes, services, onClose, onSaved, upsertRecord, sendEmail, toast }) {
  const STEPS = ["Client", "Items", "Details", "Review"];
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  const today = todayLocal();
  const defaultExpiry = addDays(today, 31);

  const [form, setForm] = useState({
    clientId: "",
    quoteDate: today,
    expiryDate: defaultExpiry,
    lineItems: [blankLine()],
    comments: "",
    hidePhoneNumber: Boolean(profile?.hidePhoneOnDocs),
  });

  const setF = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const selectedClient = clients.find((c) => c.id === safeNumber(form.clientId));
  const clientIsGstExempt = Boolean(selectedClient?.outsideAustraliaOrGstExempt);

  const computeLines = useCallback(() => {
    return form.lineItems.map((li) => {
      const qty = Math.max(1, safeNumber(li.quantity || 1));
      const unit = safeNumber(li.unitPrice);
      const rowSubtotal = qty * unit;
      const effectiveGst = (!clientIsGstExempt && profile?.gstRegistered && li.gstType === "GST on Income (10%)") ? rowSubtotal * 0.1 : 0;
      return { ...li, qty, unit, rowSubtotal, rowGst: effectiveGst, rowTotal: rowSubtotal + effectiveGst };
    });
  }, [form.lineItems, clientIsGstExempt, profile?.gstRegistered]);

  const totals = (() => {
    const lines = computeLines();
    const subtotal = lines.reduce((s, l) => s + l.rowSubtotal, 0);
    const gst = lines.reduce((s, l) => s + l.rowGst, 0);
    const total = subtotal + gst;
    const adj = calculateAdjustmentValues({ subtotal, total, client: selectedClient, profile });
    return { subtotal, gst, total, ...adj };
  })();

  const canNext = () => {
    if (step === 0) return Boolean(form.clientId);
    if (step === 1) return computeLines().some((l) => l.rowSubtotal > 0 || l.description);
    return true;
  };

  const handleSave = async () => {
    if (!form.clientId) { toast.warning("Please select a client"); return; }
    const computedLines = computeLines();
    const hasLines = computedLines.some((l) => l.rowSubtotal > 0 || l.description);
    if (!hasLines) { toast.warning("Add at least one line item"); return; }

    const quoteNumber = nextNumber(profile?.quotePrefix || "QTE", quotes, "quoteNumber");
    const payload = {
      quoteNumber,
      clientId: safeNumber(form.clientId),
      quoteDate: form.quoteDate,
      expiryDate: form.expiryDate,
      lineItems: computedLines,
      gstType: computedLines[0]?.gstType || "GST on Income (10%)",
      currencyCode: getClientCurrencyCode(selectedClient),
      gstStatus: clientIsGstExempt ? "GST not applicable" : totals.gst > 0 ? "GST applies" : "GST free",
      description: computedLines.map((l) => l.description).filter(Boolean).join("; "),
      quantity: computedLines.reduce((s, l) => s + l.qty, 0),
      subtotal: totals.subtotal,
      gst: totals.gst,
      total: totals.total,
      feeAmount: totals.feeAmount,
      taxWithheld: totals.taxWithheld,
      netExpected: totals.netExpected,
      comments: form.comments,
      hidePhoneNumber: form.hidePhoneNumber,
      status: "Draft",
    };

    setSaving(true);
    try {
      const saved = await upsertRecord(SUPABASE_TABLES.quotes, payload);
      onSaved("quote", saved);
      toast.success(`Quote ${quoteNumber} saved!`);
      setDone({ number: quoteNumber });
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <SuccessScreen type="quote" number={done.number} emailing={false} emailResult={null}
        onDone={onClose} onCreateAnother={() => { setDone(null); setStep(0); setForm({ clientId: "", quoteDate: today, expiryDate: defaultExpiry, lineItems: [blankLine()], comments: "", hidePhoneNumber: Boolean(profile?.hidePhoneOnDocs) }); }} />
    );
  }

  return (
    <div style={s.screen}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: colours.navy }}>New Quote</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: colours.muted, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        </div>
        <StepBar steps={STEPS} current={step} />
      </div>

      <div style={s.body}>
        {step === 0 && (
          <div>
            <div style={s.sectionTitle}>Select Client</div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Client *</label>
              <select style={s.select} value={form.clientId} onChange={(e) => setF("clientId", e.target.value)}>
                <option value="">Choose a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.businessName ? ` — ${c.businessName}` : ""}</option>)}
              </select>
            </div>
            {selectedClient && (
              <div style={{ ...s.card, background: "#EEF4FF", border: `1px solid ${colours.navy}33` }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: colours.navy, marginBottom: 4 }}>{selectedClient.name}</div>
                {selectedClient.email && <div style={{ fontSize: 13, color: colours.muted }}>{selectedClient.email}</div>}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <LineItemsStep
            lineItems={form.lineItems}
            setLineItems={(v) => setF("lineItems", typeof v === "function" ? v(form.lineItems) : v)}
            clientIsGstExempt={clientIsGstExempt}
            gstRegistered={profile?.gstRegistered}
            services={services}
          />
        )}

        {step === 2 && (
          <div>
            <div style={s.sectionTitle}>Quote Details</div>
            <div style={s.row2}>
              <div style={s.fieldGroup}>
                <label style={s.label}>Quote Date</label>
                <input style={s.input} type="date" value={form.quoteDate} onChange={(e) => setF("quoteDate", e.target.value)} />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Expiry Date</label>
                <input style={s.input} type="date" value={form.expiryDate} onChange={(e) => setF("expiryDate", e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Comments / Notes</label>
              <textarea style={{ ...s.input, minHeight: 80, resize: "vertical" }} placeholder="Any notes for the client…" value={form.comments} onChange={(e) => setF("comments", e.target.value)} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: colours.text }}>
              <input type="checkbox" checked={form.hidePhoneNumber} onChange={(e) => setF("hidePhoneNumber", e.target.checked)} />
              Hide phone number on quote
            </label>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={s.sectionTitle}>Review & Save</div>
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colours.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Client</div>
              <div style={{ fontWeight: 700 }}>{selectedClient?.name || "—"}</div>
              {selectedClient?.email && <div style={{ fontSize: 13, color: colours.muted }}>{selectedClient.email}</div>}
            </div>
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colours.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Dates</div>
              <div style={s.row2}>
                <div><div style={{ fontSize: 12, color: colours.muted }}>Quote Date</div><div style={{ fontWeight: 700 }}>{formatDateAU(form.quoteDate)}</div></div>
                <div><div style={{ fontSize: 12, color: colours.muted }}>Expiry</div><div style={{ fontWeight: 700 }}>{formatDateAU(form.expiryDate)}</div></div>
              </div>
            </div>
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colours.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Items</div>
              {computeLines().map((li, i) => (
                <div key={li.id} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, marginBottom: 8, borderBottom: i < form.lineItems.length - 1 ? `1px solid ${colours.border}` : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{li.description || `Item ${i + 1}`}</div>
                    <div style={{ fontSize: 12, color: colours.muted }}>Qty {li.qty} × {currency(li.unit)}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{currency(li.rowTotal)}</div>
                </div>
              ))}
              <div style={s.totalRow}><span>Subtotal</span><span>{currency(totals.subtotal)}</span></div>
              {totals.gst > 0 && <div style={s.totalRow}><span>GST</span><span>{currency(totals.gst)}</span></div>}
              <div style={s.grandTotalRow}><span>Total Estimate</span><span>{currency(totals.total)}</span></div>
            </div>
          </div>
        )}
      </div>

      <div style={s.footer}>
        <button style={s.btnSecondary} onClick={() => step === 0 ? onClose() : setStep((p) => p - 1)}>
          {step === 0 ? "Cancel" : "‹ Back"}
        </button>
        {step < STEPS.length - 1 ? (
          <button style={{ ...s.btnPrimary, opacity: canNext() ? 1 : 0.5 }} disabled={!canNext()} onClick={() => setStep((p) => p + 1)}>
            Next ›
          </button>
        ) : (
          <button style={s.btnTeal} disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save Quote ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE WIZARD
// ─────────────────────────────────────────────────────────────────────────────

function ExpenseWizard({ profile, expenses, onClose, onSaved, upsertRecord, uploadReceipt, toast }) {
  const STEPS = ["Type", "Details", "Receipt", "Review"];
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [categorySearch, setCategorySearch] = useState("");

  const today = todayLocal();

  const [form, setForm] = useState({
    expenseType: "Business Expense",
    workType: profile?.workType || "",
    category: "",
    date: today,
    dueDate: "",
    supplier: "",
    description: "",
    amount: "",
  });
  const setF = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const filteredCategories = categorySearch
    ? expenseCategories.filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase()))
    : expenseCategories;

  const amount = safeNumber(form.amount);
  const gst = amount / 11;

  const canNext = () => {
    if (step === 0) return Boolean(form.expenseType && form.category);
    if (step === 1) return Boolean(form.supplier && form.amount && safeNumber(form.amount) > 0);
    return true;
  };

  const handleSave = async () => {
    if (!form.supplier || !form.amount || !form.category) {
      toast.warning("Please fill in supplier, amount and category");
      return;
    }
    setSaving(true);
    try {
      let receiptUrl = "";
      let receiptFileName = "";
      if (receiptFile && uploadReceipt) {
        const uploaded = await uploadReceipt(receiptFile);
        receiptUrl = uploaded.receiptUrl;
        receiptFileName = uploaded.fileName;
      }
      const payload = {
        ...form,
        amount,
        gst,
        isPaid: false,
        paidAt: "",
        receiptFileName,
        receiptUrl,
        dueDate: form.dueDate || form.date,
      };
      const saved = await upsertRecord(SUPABASE_TABLES.expenses, payload);
      onSaved("expense", saved);
      toast.success("Expense saved!");
      setDone(true);
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <SuccessScreen type="expense" number={null} emailing={false} emailResult={null}
        onDone={onClose} onCreateAnother={() => { setDone(false); setStep(0); setForm({ expenseType: "Business Expense", workType: profile?.workType || "", category: "", date: today, dueDate: "", supplier: "", description: "", amount: "" }); setReceiptFile(null); }} />
    );
  }

  return (
    <div style={s.screen}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: colours.teal }}>New Expense</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: colours.muted, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        </div>
        <StepBar steps={STEPS} current={step} />
      </div>

      <div style={s.body}>
        {/* Step 0: Type & category */}
        {step === 0 && (
          <div>
            <div style={s.sectionTitle}>Expense Type</div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Type *</label>
              <div style={{ display: "flex", gap: 10 }}>
                {["Business Expense", "Client Reimbursement"].map((t) => (
                  <button key={t} style={s.pill(form.expenseType === t)} onClick={() => setF("expenseType", t)}>{t}</button>
                ))}
              </div>
            </div>
            {profile?.workType && (
              <div style={s.fieldGroup}>
                <label style={s.label}>Work Type</label>
                <input style={s.input} value={form.workType} onChange={(e) => setF("workType", e.target.value)} placeholder={profile.workType} />
              </div>
            )}
            <div style={s.fieldGroup}>
              <label style={s.label}>Category * {form.category && <span style={{ color: colours.teal }}>— {form.category}</span>}</label>
              <input style={s.input} placeholder="Search categories…" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} />
              <div style={{ border: `1px solid ${colours.border}`, borderTop: "none", borderBottomLeftRadius: 10, borderBottomRightRadius: 10, maxHeight: 200, overflowY: "auto" }}>
                {filteredCategories.map((cat) => (
                  <div key={cat} onClick={() => { setF("category", cat); setCategorySearch(""); }}
                    style={{ padding: "12px 14px", cursor: "pointer", background: form.category === cat ? colours.lightTeal : "#fff", borderBottom: `1px solid ${colours.border}`, fontSize: 14, fontWeight: form.category === cat ? 700 : 400, color: form.category === cat ? colours.teal : colours.text }}>
                    {cat}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div>
            <div style={s.sectionTitle}>Expense Details</div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Supplier / Payee *</label>
              <input style={s.input} placeholder="e.g. Officeworks, AGL…" value={form.supplier} onChange={(e) => setF("supplier", e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Amount (incl. GST) *</label>
              <input style={s.input} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => setF("amount", e.target.value)} />
              {amount > 0 && (
                <div style={{ fontSize: 13, color: colours.muted, marginTop: 6 }}>
                  GST included: {currency(gst)} · Ex-GST: {currency(amount - gst)}
                </div>
              )}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <input style={s.input} placeholder="Brief description (optional)" value={form.description} onChange={(e) => setF("description", e.target.value)} />
            </div>
            <div style={s.row2}>
              <div style={s.fieldGroup}>
                <label style={s.label}>Expense Date</label>
                <input style={s.input} type="date" value={form.date} onChange={(e) => setF("date", e.target.value)} />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Due Date</label>
                <input style={s.input} type="date" value={form.dueDate} onChange={(e) => setF("dueDate", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Receipt */}
        {step === 2 && (
          <div>
            <div style={s.sectionTitle}>Receipt (Optional)</div>
            <div style={{ ...s.card, textAlign: "center", padding: 24 }}>
              {!receiptFile ? (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                  <div style={{ fontSize: 14, color: colours.muted, marginBottom: 16 }}>Upload a photo or PDF of your receipt</div>
                  <label style={{ ...s.btnPrimary, display: "inline-block", padding: "12px 20px", cursor: "pointer" }}>
                    Choose File
                    <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setReceiptFile(file); setF("receiptFileName", file.name); }
                    }} />
                  </label>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: colours.text, marginBottom: 4 }}>{receiptFile.name}</div>
                  <div style={{ fontSize: 12, color: colours.muted, marginBottom: 16 }}>{(receiptFile.size / 1024).toFixed(1)} KB</div>
                  <button onClick={() => { setReceiptFile(null); setF("receiptFileName", ""); }}
                    style={{ background: "none", border: "none", color: "#EF4444", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    Remove ✕
                  </button>
                </>
              )}
            </div>
            <div style={{ fontSize: 13, color: colours.muted, textAlign: "center", marginTop: 12 }}>
              You can skip this step and add a receipt later
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div>
            <div style={s.sectionTitle}>Review & Save</div>
            <div style={s.card}>
              <div style={s.row2}>
                <div><div style={{ fontSize: 12, color: colours.muted }}>Type</div><div style={{ fontWeight: 700 }}>{form.expenseType}</div></div>
                <div><div style={{ fontSize: 12, color: colours.muted }}>Category</div><div style={{ fontWeight: 700 }}>{form.category}</div></div>
              </div>
            </div>
            <div style={s.card}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colours.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Details</div>
              <div style={s.totalRow}><span>Supplier</span><span style={{ fontWeight: 700 }}>{form.supplier}</span></div>
              {form.description && <div style={s.totalRow}><span>Description</span><span>{form.description}</span></div>}
              <div style={s.totalRow}><span>Date</span><span>{formatDateAU(form.date)}</span></div>
              {form.dueDate && <div style={s.totalRow}><span>Due</span><span>{formatDateAU(form.dueDate)}</span></div>}
            </div>
            <div style={s.card}>
              <div style={s.totalRow}><span>Amount (incl. GST)</span><span>{currency(amount)}</span></div>
              <div style={s.totalRow}><span>GST included</span><span>{currency(gst)}</span></div>
              <div style={s.totalRow}><span>Ex-GST</span><span>{currency(amount - gst)}</span></div>
            </div>
            {receiptFile && (
              <div style={s.card}>
                <div style={{ fontSize: 13, color: colours.teal, fontWeight: 700 }}>📎 {receiptFile.name}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={s.footer}>
        <button style={s.btnSecondary} onClick={() => step === 0 ? onClose() : setStep((p) => p - 1)}>
          {step === 0 ? "Cancel" : "‹ Back"}
        </button>
        {step < STEPS.length - 1 ? (
          <button style={{ ...s.btnPrimary, opacity: canNext() ? 1 : 0.5 }} disabled={!canNext()} onClick={() => setStep((p) => p + 1)}>
            {step === 2 ? (receiptFile ? "Next ›" : "Skip ›") : "Next ›"}
          </button>
        ) : (
          <button style={s.btnTeal} disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save Expense ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT — MobileWizard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props:
 *   profile           — your profile object
 *   clients           — array of client objects
 *   invoices          — array of invoice objects (for numbering)
 *   quotes            — array of quote objects (for numbering)
 *   expenses          — array of expense objects
 *   services          — array of service objects (optional, for line item picker)
 *   onSaveInvoice     — called after a new invoice is saved to state: (invoice) => void
 *   onSaveQuote       — called after a new quote is saved to state: (quote) => void
 *   onSaveExpense     — called after a new expense is saved to state: (expense) => void
 *   onEmailDocument   — your sendSavedDocumentEmail function ({ documentType, documentRecord })
 *   upsertRecord      — your upsertRecordInDatabase(table, payload) function
 *   uploadReceipt     — your uploadReceiptToSupabase(file) function (optional)
 *   toast             — toast object with .success / .error / .warning
 *   onClose           — called when the wizard is dismissed
 */
export default function MobileWizard({
  profile,
  clients = [],
  invoices = [],
  quotes = [],
  expenses = [],
  services = [],
  onSaveInvoice,
  onSaveQuote,
  onSaveExpense,
  onEmailDocument,
  upsertRecord,
  uploadReceipt,
  toast,
  onClose,
}) {
  const [docType, setDocType] = useState(null); // null | "invoice" | "quote" | "expense"

  const handleSaved = (type, record) => {
    if (type === "invoice" && onSaveInvoice) onSaveInvoice(record);
    if (type === "quote" && onSaveQuote) onSaveQuote(record);
    if (type === "expense" && onSaveExpense) onSaveExpense(record);
  };

  if (!docType) {
    return <TypeSelector onSelect={setDocType} onClose={onClose} />;
  }

  if (docType === "invoice") {
    return (
      <InvoiceWizard
        profile={profile}
        clients={clients}
        invoices={invoices}
        services={services}
        onClose={onClose}
        onSaved={handleSaved}
        upsertRecord={upsertRecord}
        sendEmail={onEmailDocument}
        toast={toast}
      />
    );
  }

  if (docType === "quote") {
    return (
      <QuoteWizard
        profile={profile}
        clients={clients}
        quotes={quotes}
        services={services}
        onClose={onClose}
        onSaved={handleSaved}
        upsertRecord={upsertRecord}
        sendEmail={onEmailDocument}
        toast={toast}
      />
    );
  }

  if (docType === "expense") {
    return (
      <ExpenseWizard
        profile={profile}
        expenses={expenses}
        onClose={onClose}
        onSaved={handleSaved}
        upsertRecord={upsertRecord}
        uploadReceipt={uploadReceipt}
        toast={toast}
      />
    );
  }

  return null;
}

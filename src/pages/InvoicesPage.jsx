import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// InvoicesPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function InvoicesPage(props) {
  const {
    profile,
    clients,
    invoices,
    services,
    invoiceForm,
    setInvoiceForm,
    invoiceWizardStep,
    setInvoiceWizardStep,
    invoiceEditorOpen,
    invoiceEditorForm,
    setInvoiceEditorForm,
    savingInvoice,
    savingInvoiceEdits,
    invClientSearch,
    setInvClientSearch,
    showARCreditNoteModal,
    setShowARCreditNoteModal,
    creditNoteSource,
    setCreditNoteSource,
    creditNoteForm,
    setCreditNoteForm,
    setActivePage,
    confirm,
    cardStyle,
    colours,
    currency,
    formatDateAU,
    safeNumber,
    todayLocal,
    addDays,
    formatCurrencyByCode,
    getClientCurrencyCode,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    GST_TYPE_OPTIONS,
    DashboardHero,
    InsightChip,
    MetricCard,
    SectionCard,
    DataTable,
    EmptyState,
    saveInvoice,
    saveInvoiceEdits,
    openInvoiceEditor,
    closeInvoiceEditor,
    deleteInvoice,
    markInvoicePaid,
    openSavedInvoicePreview,
    openInvoicePreview,
    saveARCreditNote,
    createStripeCheckoutForInvoice,
    payInvoiceWithStripe,
    getClientName,
    getClientById,
    clientIsGstExempt,
    gstAppliesToClient,
    calculateFormGst,
    computeLineItemTotals,
    getDocumentBusinessName,
    getDocumentAddress,
    invoiceAllocations,
    totals,
  } = props;

    const invLines = computeLineItemTotals(invoiceForm.lineItems || [], invoiceForm.clientId);
    const previewSubtotal = invLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const previewGst = invLines.reduce((s, l) => s + l.rowGst, 0);
    const previewTotal = previewSubtotal + previewGst;
    const invoiceClient = getClientById(invoiceForm.clientId);
    const invoiceCurrencyCode = getClientCurrencyCode(invoiceClient);
    const invoiceMoney = (value) => formatCurrencyByCode(value, invoiceCurrencyCode);
    const invoiceAdjustments = calculateAdjustmentValues({ subtotal: previewSubtotal, total: previewTotal, client: invoiceClient, profile });
    const invoiceGstStatus = clientIsGstExempt(invoiceForm.clientId) ? "GST not applicable" : previewGst > 0 ? "GST applies" : "GST free";

    const totalInvoiced = invoices.reduce((s, inv) => s + safeNumber(inv.total), 0);
    const totalPaid = invoices.filter((inv) => inv.status === "Paid").reduce((s, inv) => s + safeNumber(inv.total), 0);
    const totalOutstanding = invoices.filter((inv) => inv.status !== "Paid").reduce((s, inv) => s + safeNumber(inv.total), 0);
    const overdueInvoices = invoices.filter((inv) => inv.status !== "Paid" && inv.dueDate && new Date(inv.dueDate) < new Date());
    const draftCount = invoices.filter((inv) => inv.status === "Draft").length;
    const recentMonths = (() => {
      const bucket = {};
      invoices.forEach((inv) => {
        const key = String(inv.invoiceDate || "").slice(0, 7);
        if (!key) return;
        bucket[key] = (bucket[key] || 0) + safeNumber(inv.total);
      });
      return Object.entries(bucket).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ label: k.slice(5), value: v }));
    })();
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <DashboardHero title="Invoices" subtitle="Create, send and track all your invoices. Live totals update as you add records." highlight={currency(totalPaid)}>
          <InsightChip label="Outstanding" value={currency(totalOutstanding)} />
          <InsightChip label="Overdue" value={`${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"}`} />
          <InsightChip label="Draft" value={`${draftCount}`} />
        </DashboardHero>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <MetricCard title="Total invoiced" value={currency(totalInvoiced)} subtitle="All invoices in the portal." accent={colours.navy} />
          <MetricCard title="Total paid" value={currency(totalPaid)} subtitle="Invoices marked as paid." accent={colours.teal} />
          <MetricCard title="Outstanding" value={currency(totalOutstanding)} subtitle="Unpaid invoices." accent={colours.purple} />
          <MetricCard title="Overdue" value={String(overdueInvoices.length)} subtitle="Past due date, still unpaid." accent={colours.navy} />
          <div style={{ ...cardStyle, padding: 18, gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Invoice totals by month</div>
            <MiniBarChart data={recentMonths} height={90} accent={colours.teal} />
          </div>
        </div>
        <SectionCard title="Create Invoice">
          {/* ── Wizard progress bar ── */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
            {["Client", "Details", "Line Items", "Review & Save"].map((label, i) => {
              const step = i + 1;
              const active = invoiceWizardStep === step;
              const done = invoiceWizardStep > step;
              return (
                <React.Fragment key={step}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: done ? "pointer" : "default" }}
                    onClick={() => done && setInvoiceWizardStep(step)}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13,
                      background: done ? colours.teal : active ? colours.purple : colours.border,
                      color: done || active ? "#fff" : colours.muted, transition: "all 0.2s" }}>
                      {done ? "✓" : step}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: active ? 800 : 500, color: active ? colours.purple : done ? colours.teal : colours.muted, whiteSpace: "nowrap" }}>{label}</div>
                  </div>
                  {i < 3 && <div style={{ flex: 1, height: 2, background: done ? colours.teal : colours.border, margin: "0 6px", marginBottom: 18, transition: "background 0.2s" }} />}
                </React.Fragment>
              );
            })}
          </div>

          {/* ── Step 1: Client ── */}
          {invoiceWizardStep === 1 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <label style={labelStyle}>Search or Select Client</label>
                <input style={{ ...inputStyle, fontSize: 15 }} value={invClientSearch}
                  onChange={(e) => { setInvClientSearch(e.target.value); if (!e.target.value) setInvoiceForm((p) => ({ ...p, clientId: "" })); }}
                  placeholder="Type client name..." />
                {invClientSearch && (
                  <div style={{ border: `1px solid ${colours.border}`, borderRadius: 10, marginTop: 4, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                    {clients.filter((c) => c.name.toLowerCase().includes(invClientSearch.toLowerCase()) || (c.businessName || "").toLowerCase().includes(invClientSearch.toLowerCase()))
                      .map((c) => (
                        <div key={c.id} onClick={() => { setInvoiceForm((p) => ({ ...p, clientId: String(c.id), currencyCode: getClientCurrencyCode(c) })); setInvClientSearch(c.name); }}
                          style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, borderBottom: `1px solid ${colours.border}`, background: String(invoiceForm.clientId) === String(c.id) ? colours.lightPurple : "#fff" }}>
                          <strong>{c.name}</strong>{c.businessName ? <span style={{ color: colours.muted }}> — {c.businessName}</span> : ""}
                        </div>
                      ))}
                    {clients.filter((c) => c.name.toLowerCase().includes(invClientSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: 13, color: colours.muted }}>No match — add a new client below</div>
                    )}
                  </div>
                )}
                {!invClientSearch && (
                  <select style={{ ...inputStyle, marginTop: 8 }} value={invoiceForm.clientId} onChange={(e) => {
                    const sel = getClientById(e.target.value);
                    setInvoiceForm((p) => ({ ...p, clientId: e.target.value, currencyCode: getClientCurrencyCode(sel) }));
                    setInvClientSearch(sel?.name || "");
                  }}>
                    <option value="">— or pick from list —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.businessName ? ` — ${c.businessName}` : ""}</option>)}
                  </select>
                )}
              </div>
              {invoiceForm.clientId && (() => {
                const c = getClientById(invoiceForm.clientId);
                return c ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div style={{ ...cardStyle, padding: 16, background: colours.lightPurple }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Client Details</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: colours.text }}>{c.name}</div>
                      {c.businessName && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{c.businessName}</div>}
                      {c.abn && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>ABN: {c.abn}</div>}
                    </div>
                    <div style={{ ...cardStyle, padding: 16, background: colours.lightTeal }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Contact</div>
                      {c.email && <div style={{ fontSize: 13, color: colours.text, marginTop: 2 }}>✉ {c.email}</div>}
                      {c.phone && <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>📞 {c.phone}</div>}
                      {c.address && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{c.address}</div>}
                    </div>
                    <div style={{ ...cardStyle, padding: 16, background: colours.white }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Billing</div>
                      <div style={{ fontSize: 13, color: colours.text }}>Currency: {c.defaultCurrency || "AUD $"}</div>
                      <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>GST: {clientIsGstExempt(c.id) ? "Exempt" : "Applicable"}</div>
                      {c.workType && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>{c.workType}</div>}
                    </div>
                  </div>
                ) : null;
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...buttonSecondary, fontSize: 13 }} onClick={() => { setClientModalForm({ name: "", businessName: "", email: "", phone: "", address: "", abn: "", defaultCurrency: "AUD $", workType: "" }); setEditingClientId(null); setShowClientModal(true); }}>
                    + New Client
                  </button>
                  <button style={{ ...buttonSecondary, fontSize: 13 }} onClick={() => { setImportType("clients"); setImportRows([]); setImportError(""); setShowImportModal(true); }}>
                    ⬆ Import
                  </button>
                </div>
                <button style={{ ...buttonPrimary, opacity: invoiceForm.clientId ? 1 : 0.4 }}
                  disabled={!invoiceForm.clientId}
                  onClick={() => setInvoiceWizardStep(2)}>Next: Details →</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Details ── */}
          {invoiceWizardStep === 2 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Invoice Date</label>
                  <input type="date" style={inputStyle} value={invoiceForm.invoiceDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Due Date</label>
                  <input type="date" style={inputStyle} value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Invoice Number</label>
                  <input style={inputStyle} value={invoiceForm.invoiceNumber || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} placeholder="Auto-generated if blank" />
                </div>
                <div>
                  <label style={labelStyle}>Recurring</label>
                  <select style={inputStyle} value={invoiceForm.recurs || "Never"} onChange={(e) => setInvoiceForm({ ...invoiceForm, recurs: e.target.value })}>
                    {["Never", "Weekly", "Fortnightly", "Monthly", "Quarterly", "Annually"].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  {invoiceForm.recurs && invoiceForm.recurs !== "Never" && (
                    <div style={{ fontSize: 12, color: colours.purple, marginTop: 5, fontWeight: 600 }}>🔁 New draft created {invoiceForm.recurs.toLowerCase()} on login</div>
                  )}
                </div>
                {invoiceClient?.hasPurchaseOrder && (
                  <div>
                    <label style={labelStyle}>Purchase Order / Reference</label>
                    <input style={inputStyle} value={invoiceForm.purchaseOrderReference || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, purchaseOrderReference: e.target.value })} />
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Comments (optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={invoiceForm.comments || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, comments: e.target.value })} placeholder="Any notes to appear on the invoice..." />
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <input type="checkbox" checked={invoiceForm.hidePhoneNumber} onChange={(e) => setInvoiceForm({ ...invoiceForm, hidePhoneNumber: e.target.checked })} />
                  Hide my phone number on this invoice
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <input type="checkbox" checked={invoiceForm.includesUntaxedPortion} onChange={(e) => setInvoiceForm({ ...invoiceForm, includesUntaxedPortion: e.target.checked })} />
                  Includes untaxed portion
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setInvoiceWizardStep(1)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setInvoiceWizardStep(3)}>Next: Line Items →</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Line Items ── */}
          {invoiceWizardStep === 3 && (
            <div style={{ display: "grid", gap: 16 }}>
              {/* Service quick-add */}
              {services.length > 0 && (
                <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colours.purple, flexShrink: 0 }}>📋 Add from Services:</div>
                  <select defaultValue="" style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    onChange={(e) => {
                      const svc = services.find((s) => String(s.id) === e.target.value);
                      if (!svc) return;
                      const exempt = clientIsGstExempt(invoiceForm.clientId);
                      const newItem = {
                        id: Date.now() + Math.random(),
                        description: svc.name + (svc.description ? " — " + svc.description : ""),
                        quantity: 1,
                        unitPrice: String(svc.price ?? ""),
                        gstType: exempt ? "GST Free" : (svc.gstType || "GST on Income (10%)"),
                      };
                      setInvoiceForm((prev) => ({
                        ...prev,
                        lineItems: [...(prev.lineItems || []).filter((l) => l.description || l.unitPrice), newItem],
                      }));
                      e.target.value = "";
                    }}>
                    <option value="">— pick a service to add —</option>
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.id}>{svc.name}{svc.price ? " — " + currency(svc.price) : ""}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: colours.muted, flexBasis: "100%" }}>Pick as many as you need — descriptions and prices are editable without affecting saved services</div>
                </div>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                  <thead>
                    <tr style={{ background: colours.bg }}>
                      {["Description", "Qty", "Unit Price (ex GST)", "GST Type", "GST", "Total", ""].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colours.muted, borderBottom: `1px solid ${colours.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(invoiceForm.lineItems || []).map((item, idx) => {
                      const qty = Math.max(1, safeNumber(item.quantity || 1));
                      const unit = safeNumber(item.unitPrice);
                      const rowSub = unit * qty;
                      const exempt = clientIsGstExempt(invoiceForm.clientId);
                      const effectiveGst = exempt ? "GST Free" : (item.gstType || "GST on Income (10%)");
                      const rowGst = effectiveGst === "GST on Income (10%)" ? rowSub * 0.1 : 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${colours.border}` }}>
                          <td style={{ padding: "8px 6px", minWidth: 200 }}>
                            <input style={{ ...inputStyle, fontSize: 13 }} value={item.description}
                              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))}
                              placeholder="Description" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 70 }}>
                            <input type="number" min="1" style={{ ...inputStyle, fontSize: 13 }} value={item.quantity}
                              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l) }))} />
                          </td>
                          <td style={{ padding: "8px 6px", width: 130 }}>
                            <input type="number" min="0" step="0.01" style={{ ...inputStyle, fontSize: 13 }} value={item.unitPrice}
                              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, unitPrice: e.target.value } : l) }))}
                              placeholder="0.00" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 160 }}>
                            <select style={{ ...inputStyle, fontSize: 13, background: exempt ? "#F8FAFC" : colours.white }} disabled={exempt} value={effectiveGst}
                              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, gstType: e.target.value } : l) }))}>
                              {GST_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "8px 6px", width: 90, fontSize: 13, color: colours.muted, textAlign: "right" }}>{invoiceMoney(rowGst)}</td>
                          <td style={{ padding: "8px 6px", width: 110, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{invoiceMoney(rowSub + rowGst)}</td>
                          <td style={{ padding: "8px 6px", width: 40 }}>
                            {(invoiceForm.lineItems || []).length > 1 && (
                              <button onClick={() => setInvoiceForm((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) }))}
                                style={{ background: "none", border: "none", cursor: "pointer", color: colours.muted, fontSize: 18, lineHeight: 1 }}>×</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => setInvoiceForm((prev) => ({ ...prev, lineItems: [...(prev.lineItems || []), blankLineItem()] }))}
                  style={{ ...buttonSecondary, fontSize: 13, padding: "7px 14px" }}>+ Add line</button>
                <span style={{ fontSize: 13, color: colours.muted }}>{(invoiceForm.lineItems || []).length} line{(invoiceForm.lineItems || []).length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setInvoiceWizardStep(2)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setInvoiceWizardStep(4)}>Next: Review →</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Save ── */}
          {invoiceWizardStep === 4 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div style={{ ...cardStyle, padding: 16, background: colours.lightPurple }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>From</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{profile.businessName}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>ABN: {profile.abn || "-"}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{profile.email}</div>
                </div>
                <div style={{ ...cardStyle, padding: 16, background: colours.lightTeal }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>To</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{invoiceClient?.name || "-"}</div>
                  {invoiceClient?.businessName && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{invoiceClient.businessName}</div>}
                  {invoiceClient?.email && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{invoiceClient.email}</div>}
                </div>
                <div style={{ ...cardStyle, padding: 16, background: colours.white }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Dates</div>
                  <div style={{ fontSize: 13, color: colours.text }}>Invoice: {invoiceForm.invoiceDate || "-"}</div>
                  <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>Due: {invoiceForm.dueDate || "-"}</div>
                  {invoiceForm.purchaseOrderReference && <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>PO: {invoiceForm.purchaseOrderReference}</div>}
                </div>
              </div>

              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 12 }}>Line Items</div>
                {(invoiceForm.lineItems || []).filter(l => l.description || l.unitPrice).map((item, idx) => {
                  const qty = Math.max(1, safeNumber(item.quantity || 1));
                  const unit = safeNumber(item.unitPrice);
                  const rowSub = unit * qty;
                  const exempt = clientIsGstExempt(invoiceForm.clientId);
                  const effectiveGst = exempt ? "GST Free" : (item.gstType || "GST on Income (10%)");
                  const rowGst = effectiveGst === "GST on Income (10%)" ? rowSub * 0.1 : 0;
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colours.border}`, fontSize: 14 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{item.description || "—"}</span>
                        <span style={{ color: colours.muted, marginLeft: 10 }}>× {qty} @ {invoiceMoney(unit)}</span>
                      </div>
                      <strong>{invoiceMoney(rowSub + rowGst)}</strong>
                    </div>
                  );
                })}
                <div style={{ marginTop: 16, borderTop: `2px solid ${colours.border}`, paddingTop: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>Subtotal (ex GST)</span><span>{invoiceMoney(previewSubtotal)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>GST</span><span>{invoiceMoney(previewGst)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: colours.teal, marginTop: 6 }}><span>Amount Due</span><span>{invoiceMoney(previewTotal)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: colours.purple }}><span>Net Expected</span><span>{invoiceMoney(invoiceAdjustments.netExpected)}</span></div>
                </div>
              </div>

              {invoiceForm.comments && (
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 6 }}>Comments</div>
                  <div style={{ fontSize: 14, color: colours.text }}>{invoiceForm.comments}</div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setInvoiceWizardStep(3)}>← Back</button>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={buttonSecondary} onClick={openInvoicePreview}>Preview PDF</button>
                  <button style={{ ...buttonSecondary, opacity: savingInvoice ? 0.6 : 1 }} disabled={savingInvoice} onClick={async () => { setInvoiceForm((prev) => ({ ...prev, status: "Draft" })); const ok = await saveInvoice(); if (ok) setInvoiceWizardStep(1); }}>Save Draft</button>
                  <button style={{ ...buttonPrimary, opacity: savingInvoice ? 0.6 : 1 }} disabled={savingInvoice} onClick={async () => { const ok = await saveInvoice(); if (ok) setInvoiceWizardStep(1); }}>{savingInvoice ? "Saving..." : "Save Invoice ✓"}</button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Invoice List">
          <DataTable
            emptyState={{ icon: "🧾", title: "No invoices yet", message: "Create your first invoice using the form above. Invoices can be emailed as a PDF with a Stripe payment link." }}
            columns={[
              { key: "invoiceNumber", label: "Invoice", render: (v, row) => <span>{v}{row.recurs && row.recurs !== "Never" ? <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: colours.purple, background: colours.lightPurple, padding: "2px 7px", borderRadius: 6 }}>🔁 {row.recurs}</span> : null}</span> },
              { key: "clientId", label: "Client", render: (_, row) => getClientName(row.clientId) },
              { key: "invoiceDate", label: "Date", render: (v) => formatDateAU(v) },
              { key: "dueDate", label: "Due", render: (v) => formatDateAU(v) },
              { key: "total", label: "Total", render: (v, row) => formatCurrencyByCode(v, row.currencyCode || getClientCurrencyCode(getClientById(row.clientId))) },
              { key: "status", label: "Status", render: (v, row) => (
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background: row.type === "credit_note" ? "#F5ECFB" : v === "Paid" ? "#dcfce7" : v === "Draft" ? "#f1f5f9" : "#fef9c3",
                  color: row.type === "credit_note" ? colours.purple : v === "Paid" ? "#16a34a" : v === "Draft" ? "#64748b" : "#b45309",
                }}>
                  {row.type === "credit_note" ? "CN" : v === "Paid" ? "✓ PAID" : v || "Draft"}
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
                    <button
                      style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                      onClick={() => sendInvoiceFromPreview(row.id)}
                    >
                      Email
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
                    {row.type !== "credit_note" && (
                      <button style={{ ...buttonSecondary, color: colours.purple, borderColor: colours.purple }}
                        onClick={() => { setCreditNoteSource(row); setCreditNoteForm({ amount: "", reason: "", date: todayLocal() }); setShowARCreditNoteModal(true); }}>
                        Credit Note
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={invoices}
          />
        </SectionCard>

        {invoiceEditorOpen && invoiceEditorForm ? (() => {
          const editorClient = getClientById(invoiceEditorForm.clientId);
          const editorComputedLines = computeLineItemTotals(invoiceEditorForm.lineItems || [], invoiceEditorForm.clientId);
          const editorSubtotal = editorComputedLines.reduce((s, l) => s + l.rowSubtotal, 0);
          const editorGst = editorComputedLines.reduce((s, l) => s + l.rowGst, 0);
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
                                dueDate: addDays(e.target.value, (safeNumber(profile.paymentTermsDays) || 14)),
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
                  <button style={{ ...buttonPrimary, opacity: savingInvoiceEdits ? 0.6 : 1 }} disabled={savingInvoiceEdits} onClick={saveInvoiceEdits}>{savingInvoiceEdits ? "Saving..." : "Save Changes"}</button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </div>
    );

}

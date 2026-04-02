import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// QuotesPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function QuotesPage(props) {
  const {
    profile,
    clients,
    invoices,
    quotes,
    services,
    quoteForm,
    setQuoteForm,
    quoteWizardStep,
    setQuoteWizardStep,
    quoteEditorOpen,
    quoteEditorForm,
    setQuoteEditorForm,
    savingQuote,
    savingQuoteEdits,
    quoteClientSearch,
    setQuoteClientSearch,
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
    calculateAdjustmentValues = () => ({ feeAmount: 0, taxWithheld: 0, netExpected: 0 }),
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    GST_TYPE_OPTIONS,
    DashboardHero,
    MiniBarChart = () => null,
    InsightChip,
    MetricCard,
    SectionCard,
    DataTable,
    EmptyState,
    saveQuote,
    saveQuoteEdits,
    openQuoteEditor,
    closeQuoteEditor,
    deleteQuote,
    openSavedQuotePreview,
    getClientName,
    getClientById,
    clientIsGstExempt,
    gstAppliesToClient,
    calculateFormGst,
    computeLineItemTotals,
    setClientModalForm = () => {},
    setEditingClientId = () => {},
    setShowClientModal = () => {},
    setImportType = () => {},
    setImportRows = () => {},
    setImportError = () => {},
    setShowImportModal = () => {},
  } = props;

    const quoteLines = computeLineItemTotals(quoteForm.lineItems || [], quoteForm.clientId);
    const qSubtotal = quoteLines.reduce((s, l) => s + l.rowSubtotal, 0);
    const qGst = quoteLines.reduce((s, l) => s + l.rowGst, 0);
    const qTotal = qSubtotal + qGst;
    const quoteClient = getClientById(quoteForm.clientId);
    const quoteCurrencyCode = getClientCurrencyCode(quoteClient);
    const quoteMoney = (value) => formatCurrencyByCode(value, quoteCurrencyCode);
    const quoteAdjustments = calculateAdjustmentValues({ subtotal: qSubtotal, total: qTotal, client: quoteClient, profile });
    const quoteGstStatus = clientIsGstExempt(quoteForm.clientId) ? "GST not applicable" : qGst > 0 ? "GST applies" : "GST free";

    const totalQuoted = quotes.reduce((s, q) => s + safeNumber(q.total), 0);
    const acceptedQuotes = quotes.filter((q) => q.status === "Accepted");
    const pendingQuotes = quotes.filter((q) => q.status === "Draft" || q.status === "Sent");
    const expiredQuotes = quotes.filter((q) => q.status === "Expired" || (q.expiryDate && new Date(q.expiryDate) < new Date() && q.status !== "Accepted"));
    const conversionRate = quotes.length > 0 ? (acceptedQuotes.length / quotes.length) * 100 : 0;
    const statusData = [
      { label: "Accepted", value: acceptedQuotes.length },
      { label: "Pending", value: pendingQuotes.length },
      { label: "Expired", value: expiredQuotes.length },
    ];
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <DashboardHero title="Quotes" subtitle="Create and manage quotes for clients. Track acceptance rates and convert to invoices." highlight={`${conversionRate.toFixed(0)}% accepted`}>
          <InsightChip label="Total quoted" value={currency(totalQuoted)} />
          <InsightChip label="Accepted" value={String(acceptedQuotes.length)} />
          <InsightChip label="Pending" value={String(pendingQuotes.length)} />
        </DashboardHero>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <MetricCard title="Total quoted" value={currency(totalQuoted)} subtitle="Value of all quotes in the portal." accent={colours.navy} />
          <MetricCard title="Accepted value" value={currency(acceptedQuotes.reduce((s, q) => s + safeNumber(q.total), 0))} subtitle="Value of accepted quotes." accent={colours.teal} />
          <MetricCard title="Conversion rate" value={`${conversionRate.toFixed(1)}%`} subtitle="Quotes accepted vs total sent." accent={colours.purple} />
          <MetricCard title="Expired" value={String(expiredQuotes.length)} subtitle="Quotes past expiry date." accent={colours.navy} />
          <div style={{ ...cardStyle, padding: 18, gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Quote status breakdown</div>
            <MiniBarChart data={statusData} height={90} accent={colours.purple} />
          </div>
        </div>
        <SectionCard title="Create Quote">
          {/* ── Wizard progress bar ── */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
            {["Client", "Details", "Line Items", "Review & Save"].map((label, i) => {
              const step = i + 1;
              const active = quoteWizardStep === step;
              const done = quoteWizardStep > step;
              return (
                <React.Fragment key={step}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: done ? "pointer" : "default" }}
                    onClick={() => done && setQuoteWizardStep(step)}>
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
          {quoteWizardStep === 1 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <label style={labelStyle}>Search or Select Client</label>
                <input style={{ ...inputStyle, fontSize: 15 }} value={quoteClientSearch}
                  onChange={(e) => { setQuoteClientSearch(e.target.value); if (!e.target.value) setQuoteForm((p) => ({ ...p, clientId: "" })); }}
                  placeholder="Type client name..." />
                {quoteClientSearch && (
                  <div style={{ border: `1px solid ${colours.border}`, borderRadius: 10, marginTop: 4, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                    {clients.filter((c) => c.name.toLowerCase().includes(quoteClientSearch.toLowerCase()) || (c.businessName || "").toLowerCase().includes(quoteClientSearch.toLowerCase()))
                      .map((c) => (
                        <div key={c.id} onClick={() => { setQuoteForm((p) => ({ ...p, clientId: String(c.id), currencyCode: getClientCurrencyCode(c) })); setQuoteClientSearch(c.name); }}
                          style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, borderBottom: `1px solid ${colours.border}`, background: String(quoteForm.clientId) === String(c.id) ? colours.lightPurple : "#fff" }}>
                          <strong>{c.name}</strong>{c.businessName ? <span style={{ color: colours.muted }}> — {c.businessName}</span> : ""}
                        </div>
                      ))}
                    {clients.filter((c) => c.name.toLowerCase().includes(quoteClientSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: 13, color: colours.muted }}>No match — add a new client below</div>
                    )}
                  </div>
                )}
                {!quoteClientSearch && (
                  <select style={{ ...inputStyle, marginTop: 8 }} value={quoteForm.clientId} onChange={(e) => {
                    const sel = getClientById(e.target.value);
                    setQuoteForm((p) => ({ ...p, clientId: e.target.value, currencyCode: getClientCurrencyCode(sel) }));
                    setQuoteClientSearch(sel?.name || "");
                  }}>
                    <option value="">— or pick from list —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.businessName ? ` — ${c.businessName}` : ""}</option>)}
                  </select>
                )}
              </div>
              {quoteForm.clientId && (() => {
                const c = getClientById(quoteForm.clientId);
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
                <button style={{ ...buttonPrimary, opacity: quoteForm.clientId ? 1 : 0.4 }}
                  disabled={!quoteForm.clientId}
                  onClick={() => setQuoteWizardStep(2)}>Next: Details →</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Details ── */}
          {quoteWizardStep === 2 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Quote Date</label>
                  <input type="date" style={inputStyle} value={quoteForm.quoteDate} onChange={(e) => setQuoteForm({ ...quoteForm, quoteDate: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Expiry Date</label>
                  <input type="date" style={inputStyle} value={quoteForm.expiryDate} onChange={(e) => setQuoteForm({ ...quoteForm, expiryDate: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Quote Number</label>
                  <input style={inputStyle} value={quoteForm.quoteNumber || ""} onChange={(e) => setQuoteForm({ ...quoteForm, quoteNumber: e.target.value })} placeholder="Auto-generated if blank" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Comments (optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={quoteForm.comments || ""} onChange={(e) => setQuoteForm({ ...quoteForm, comments: e.target.value })} placeholder="Any notes to appear on the quote..." />
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <input type="checkbox" checked={quoteForm.hidePhoneNumber} onChange={(e) => setQuoteForm({ ...quoteForm, hidePhoneNumber: e.target.checked })} />
                  Hide my phone number on this quote
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setQuoteWizardStep(1)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setQuoteWizardStep(3)}>Next: Line Items →</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Line Items ── */}
          {quoteWizardStep === 3 && (
            <div style={{ display: "grid", gap: 16 }}>
              {services.length > 0 && (
                <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colours.purple, flexShrink: 0 }}>📋 Add from Services:</div>
                  <select defaultValue="" style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    onChange={(e) => {
                      const svc = services.find((s) => String(s.id) === e.target.value);
                      if (!svc) return;
                      const exempt = clientIsGstExempt(quoteForm.clientId);
                      const newItem = {
                        id: Date.now() + Math.random(),
                        description: svc.name + (svc.description ? " — " + svc.description : ""),
                        quantity: 1,
                        unitPrice: String(svc.price ?? ""),
                        gstType: exempt ? "GST Free" : (svc.gstType || "GST on Income (10%)"),
                      };
                      setQuoteForm((prev) => ({
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
                    {(quoteForm.lineItems || []).map((item, idx) => {
                      const qty = Math.max(1, safeNumber(item.quantity || 1));
                      const unit = safeNumber(item.unitPrice);
                      const rowSub = unit * qty;
                      const exempt = clientIsGstExempt(quoteForm.clientId);
                      const effectiveGst = exempt ? "GST Free" : (item.gstType || "GST on Income (10%)");
                      const rowGst = effectiveGst === "GST on Income (10%)" ? rowSub * 0.1 : 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${colours.border}` }}>
                          <td style={{ padding: "8px 6px", minWidth: 200 }}>
                            <input style={{ ...inputStyle, fontSize: 13 }} value={item.description}
                              onChange={(e) => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))}
                              placeholder="Description" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 70 }}>
                            <input type="number" min="1" style={{ ...inputStyle, fontSize: 13 }} value={item.quantity}
                              onChange={(e) => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l) }))} />
                          </td>
                          <td style={{ padding: "8px 6px", width: 130 }}>
                            <input type="number" min="0" step="0.01" style={{ ...inputStyle, fontSize: 13 }} value={item.unitPrice}
                              onChange={(e) => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, unitPrice: e.target.value } : l) }))}
                              placeholder="0.00" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 160 }}>
                            <select style={{ ...inputStyle, fontSize: 13, background: exempt ? "#F8FAFC" : colours.white }} disabled={exempt} value={effectiveGst}
                              onChange={(e) => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, gstType: e.target.value } : l) }))}>
                              {GST_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "8px 6px", width: 90, fontSize: 13, color: colours.muted, textAlign: "right" }}>{quoteMoney(rowGst)}</td>
                          <td style={{ padding: "8px 6px", width: 110, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{quoteMoney(rowSub + rowGst)}</td>
                          <td style={{ padding: "8px 6px", width: 40 }}>
                            {(quoteForm.lineItems || []).length > 1 && (
                              <button onClick={() => setQuoteForm((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) }))}
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
                <button onClick={() => setQuoteForm((prev) => ({ ...prev, lineItems: [...(prev.lineItems || []), { id: Date.now() + Math.random(), description: "", quantity: 1, unitPrice: "", gstType: "GST on Income (10%)" }] }))}
                  style={{ ...buttonSecondary, fontSize: 13, padding: "7px 14px" }}>+ Add line</button>
                <span style={{ fontSize: 13, color: colours.muted }}>{(quoteForm.lineItems || []).length} line{(quoteForm.lineItems || []).length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setQuoteWizardStep(2)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setQuoteWizardStep(4)}>Next: Review →</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Save ── */}
          {quoteWizardStep === 4 && (
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
                  {(() => { const c = getClientById(quoteForm.clientId); return c ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{c.name}</div>
                      {c.businessName && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{c.businessName}</div>}
                      {c.email && <div style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{c.email}</div>}
                    </>
                  ) : null; })()}
                </div>
                <div style={{ ...cardStyle, padding: 16, background: colours.white }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Dates</div>
                  <div style={{ fontSize: 13, color: colours.text }}>Quote: {quoteForm.quoteDate || "-"}</div>
                  <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>Expires: {quoteForm.expiryDate || "-"}</div>
                </div>
              </div>

              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 12 }}>Line Items</div>
                {(quoteForm.lineItems || []).filter(l => l.description || l.unitPrice).map((item, idx) => {
                  const qty = Math.max(1, safeNumber(item.quantity || 1));
                  const unit = safeNumber(item.unitPrice);
                  const rowSub = unit * qty;
                  const exempt = clientIsGstExempt(quoteForm.clientId);
                  const effectiveGst = exempt ? "GST Free" : (item.gstType || "GST on Income (10%)");
                  const rowGst = effectiveGst === "GST on Income (10%)" ? rowSub * 0.1 : 0;
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colours.border}`, fontSize: 14 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{item.description || "—"}</span>
                        <span style={{ color: colours.muted, marginLeft: 10 }}>× {qty} @ {quoteMoney(unit)}</span>
                      </div>
                      <strong>{quoteMoney(rowSub + rowGst)}</strong>
                    </div>
                  );
                })}
                <div style={{ marginTop: 16, borderTop: `2px solid ${colours.border}`, paddingTop: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>Subtotal (ex GST)</span><span>{quoteMoney(qSubtotal)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>GST</span><span>{quoteMoney(qGst)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: colours.teal, marginTop: 6 }}><span>Total Estimate</span><span>{quoteMoney(qTotal)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: colours.purple }}><span>Net Expected</span><span>{quoteMoney(quoteAdjustments.netExpected)}</span></div>
                </div>
              </div>

              {quoteForm.comments && (
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 6 }}>Comments</div>
                  <div style={{ fontSize: 14, color: colours.text }}>{quoteForm.comments}</div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setQuoteWizardStep(3)}>← Back</button>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={buttonSecondary} onClick={openQuotePreview}>Preview PDF</button>
                  <button style={{ ...buttonSecondary, opacity: savingQuote ? 0.6 : 1 }} disabled={savingQuote} onClick={async () => { setQuoteForm((prev) => ({ ...prev, status: "Draft" })); const ok = await saveQuote(); if (ok) setQuoteWizardStep(1); }}>Save Draft</button>
                  <button style={{ ...buttonPrimary, opacity: savingQuote ? 0.6 : 1 }} disabled={savingQuote} onClick={async () => { const ok = await saveQuote(); if (ok) setQuoteWizardStep(1); }}>{savingQuote ? "Saving..." : "Save Quote ✓"}</button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Quote List">
          <DataTable
            emptyState={{ icon: "📋", title: "No quotes yet", message: "Create your first quote using the form above. Quotes can be converted to invoices once accepted." }}
            columns={[
              { key: "quoteNumber", label: "Quote" },
              { key: "clientId", label: "Client", render: (_, row) => getClientName(row.clientId) },
              { key: "quoteDate", label: "Date", render: (v) => formatDateAU(v) },
              { key: "expiryDate", label: "Expiry", render: (v) => formatDateAU(v) },
              { key: "total", label: "Total", render: (v, row) => formatCurrencyByCode(v, row.currencyCode || getClientCurrencyCode(getClientById(row.clientId))) },
              { key: "status", label: "Status", render: (v) => (
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background: v === "Accepted" ? "#dcfce7" : v === "Declined" ? "#fee2e2" : v === "Expired" ? "#f1f5f9" : v === "Sent" ? "#fef9c3" : "#f1f5f9",
                  color: v === "Accepted" ? "#16a34a" : v === "Declined" ? "#dc2626" : v === "Expired" ? "#64748b" : v === "Sent" ? "#b45309" : "#64748b",
                }}>
                  {v || "Draft"}
                </span>
              )},
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
                    <button
                      style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                      onClick={() => sendQuoteFromPreview(row.id)}
                    >
                      Email
                    </button>
                    {row.status !== "Declined" && row.status !== "Expired" && (
                      <button
                        style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                        onClick={() => convertQuoteToInvoice(row)}
                        title="Mark as Accepted and create a Draft invoice"
                      >
                        → Invoice
                      </button>
                    )}
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
          const editorComputedLines = computeLineItemTotals(quoteEditorForm.lineItems || [], quoteEditorForm.clientId);
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
                        {quoteEditorForm.status !== "Declined" && quoteEditorForm.status !== "Expired" && (
                          <button
                            style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal, fontWeight: 700 }}
                            onClick={() => {
                              const fullQuote = {
                                ...(quotes.find((q) => q.id === quoteEditorForm.id) || {}),
                                ...quoteEditorForm,
                                subtotal: editorSubtotal,
                                gst: editorGst,
                                total: editorTotal,
                                clientId: safeNumber(quoteEditorForm.clientId),
                              };
                              convertQuoteToInvoice(fullQuote);
                            }}
                          >
                            Convert to Invoice →
                          </button>
                        )}
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
                  <button style={{ ...buttonPrimary, opacity: savingQuoteEdits ? 0.6 : 1 }} disabled={savingQuoteEdits} onClick={saveQuoteEdits}>{savingQuoteEdits ? "Saving..." : "Save Changes"}</button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </div>
    );

}

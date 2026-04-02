import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BillsPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function BillsPage(props) {
  const {
    profile,
    expenses,
    suppliers,
    clients,
    expenseForm,
    setExpenseForm,
    billLineItems,
    setBillLineItems,
    billWizardStep,
    setBillWizardStep,
    savingBill,
    receiptFile,
    setReceiptFile,
    showSupplierModal,
    setShowSupplierModal,
    supplierForm,
    setSupplierForm,
    editingSupplierId,
    setEditingSupplierId,
    showAPCreditNoteModal,
    setShowAPCreditNoteModal,
    creditNoteSource,
    setCreditNoteSource,
    creditNoteForm,
    setCreditNoteForm,
    setActivePage,
    confirm,
    colours,
    cardStyle,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    currency,
    formatDateAU,
    safeNumber,
    todayLocal,
    addDays = (date, days) => { const d = new Date(date); if (Number.isNaN(d.getTime())) return date; d.setDate(d.getDate() + Number(days || 0)); return d.toISOString().slice(0,10); },
    addDaysEOM,
    expenseCategories,
    GST_TYPE_OPTIONS,
    DashboardHero,
    TrendBarsCard = () => null,
    InsightChip,
    MetricCard,
    SectionCard,
    DataTable,
    EmptyState,
    saveExpense,
    deleteExpense,
    markBillPaid,
    markBillUnpaid,
    sendExpenseDirect,
    saveSupplier,
    deleteSupplier,
    saveAPCreditNote,
    getClientName,
    totals,
    knownSuppliers = Array.from(new Set((suppliers || []).map((s) => s?.name).filter(Boolean))),
  } = props;

    const todayKey = todayLocal();
    const sevenDayKey = addDays(todayKey, 7);

    const billRows = expenses.map((item) => {
      const dueDate = item.dueDate || item.date || "";
      const isPaid = Boolean(item.isPaid);
      let status = "Unpaid";
      if (isPaid) status = "Paid";
      else if (dueDate && dueDate < todayKey) status = "Overdue";
      else if (dueDate && dueDate <= sevenDayKey) status = "Due soon";
      return {
        ...item,
        dueDate,
        status,
      };
    });

    const unpaidBills = billRows.filter((item) => !item.isPaid);
    const overdueBills = billRows.filter((item) => item.status === "Overdue");
    const dueSoonBills = billRows.filter((item) => item.status === "Due soon");
    const totalPayable = unpaidBills.reduce((sum, item) => sum + safeNumber(item.amount), 0);

    const supplierTotalsMap = unpaidBills.reduce((acc, item) => {
      const key = item.supplier || "Unknown supplier";
      acc[key] = (acc[key] || 0) + safeNumber(item.amount);
      return acc;
    }, {});
    const topSuppliers = Object.entries(supplierTotalsMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return (
      <div style={{ display: "grid", gap: 20 }}>
        <DashboardHero
          title="Bills and payables"
          subtitle="Track supplier bills, what is due soon, what is overdue, and what is already paid using your existing expense data."
          highlight={currency(totalPayable)}
        >
          <InsightChip label="Due soon" value={`${dueSoonBills.length} bill${dueSoonBills.length === 1 ? "" : "s"}`} />
          <InsightChip label="Overdue" value={`${overdueBills.length} bill${overdueBills.length === 1 ? "" : "s"}`} />
          <InsightChip label="Paid" value={`${billRows.filter((item) => item.isPaid).length} bill${billRows.filter((item) => item.isPaid).length === 1 ? "" : "s"}`} />
        </DashboardHero>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <MetricCard title="Total payable" value={currency(totalPayable)} subtitle="All unpaid supplier bills." accent={colours.purple} />
          <MetricCard title="Due in 7 days" value={currency(dueSoonBills.reduce((sum, item) => sum + safeNumber(item.amount), 0))} subtitle="Bills requiring attention soon." accent={colours.teal} />
          <MetricCard title="Overdue" value={currency(overdueBills.reduce((sum, item) => sum + safeNumber(item.amount), 0))} subtitle="Bills past their due date." accent={colours.navy} />
          <MetricCard title="Bills recorded" value={String(billRows.length)} subtitle="All supplier bills from your expense records." accent={colours.purple} />
        </div>

        <TrendBarsCard
          title="Top suppliers"
          subtitle="Largest unpaid commitments by supplier"
          data={topSuppliers}
          valueKey="value"
          formatValue={(value) => currency(value)}
          accent={colours.teal}
          emptyText="No unpaid supplier bills yet."
        />

        <SectionCard title="Enter Supplier Bill">
          {/* ── Wizard progress bar ── */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
            {["Supplier", "Details", "Line Items", "Review & Save"].map((label, i) => {
              const step = i + 1;
              const active = billWizardStep === step;
              const done = billWizardStep > step;
              return (
                <React.Fragment key={step}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: done ? "pointer" : "default" }}
                    onClick={() => done && setBillWizardStep(step)}>
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

          {/* Step 1: Supplier */}
          {billWizardStep === 1 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <label style={labelStyle}>Supplier Name</label>
                <input style={{ ...inputStyle, fontSize: 15 }} value={expenseForm.supplier}
                  onChange={(e) => {
                    const val = e.target.value;
                    const match = suppliers.find((s) => s.name.toLowerCase() === val.toLowerCase());
                    setExpenseForm((prev) => ({ ...prev, supplier: val,
                      supplierEmail: match?.email || prev.supplierEmail || "",
                      supplierPhone: match?.phone || prev.supplierPhone || "",
                      supplierAddress: match?.address || prev.supplierAddress || "",
                      supplierAbn: match?.abn || prev.supplierAbn || "",
                    }));
                  }}
                  placeholder="Type or select a supplier..." list="known-suppliers-list" />
                <datalist id="known-suppliers-list">
                  {knownSuppliers.map((s) => <option key={s} value={s} />)}
                </datalist>
                {knownSuppliers.length > 0 && (
                  <div style={{ fontSize: 12, color: colours.muted, marginTop: 6 }}>
                    Recent:{" "}
                    {knownSuppliers.slice(0, 5).map((s, i) => {
                      const match = suppliers.find((sup) => sup.name === s);
                      return (
                        <button key={s} onClick={() => setExpenseForm((prev) => ({ ...prev, supplier: s,
                          supplierEmail: match?.email || "",
                          supplierPhone: match?.phone || "",
                          supplierAddress: match?.address || "",
                          supplierAbn: match?.abn || "",
                        }))}
                          style={{ background: expenseForm.supplier === s ? colours.purple : colours.lightPurple, color: expenseForm.supplier === s ? "#fff" : colours.purple, border: "none", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer", marginLeft: i > 0 ? 6 : 4, fontWeight: 600 }}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}
                {expenseForm.supplier && suppliers.find((s) => s.name.toLowerCase() === expenseForm.supplier.toLowerCase()) && (() => {
                  const sup = suppliers.find((s) => s.name.toLowerCase() === expenseForm.supplier.toLowerCase());
                  return (
                    <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple, marginTop: 12, display: "grid", gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 4 }}>Supplier Details</div>
                      {sup.contactPerson && <div style={{ fontSize: 13, color: colours.text }}>👤 {sup.contactPerson}</div>}
                      {sup.email && <div style={{ fontSize: 13, color: colours.text }}>✉ {sup.email}</div>}
                      {sup.phone && <div style={{ fontSize: 13, color: colours.text }}>📞 {sup.phone}</div>}
                      {sup.address && <div style={{ fontSize: 13, color: colours.muted }}>{sup.address}</div>}
                      {sup.abn && <div style={{ fontSize: 13, color: colours.muted }}>ABN: {sup.abn}</div>}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <button style={{ ...buttonSecondary, fontSize: 13 }} onClick={() => { setSupplierForm({ name: expenseForm.supplier, email: "", phone: "", address: "", abn: "", contactPerson: "", notes: "" }); setEditingSupplierId(null); setShowSupplierModal(true); }}>
                  + Save supplier details
                </button>
                <button style={{ ...buttonPrimary, opacity: expenseForm.supplier.trim() ? 1 : 0.4 }}
                  disabled={!expenseForm.supplier.trim()}
                  onClick={() => setBillWizardStep(2)}>Next: Details →</button>
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {billWizardStep === 2 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 4 }}>Supplier</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: colours.text }}>{expenseForm.supplier}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Bill Date</label>
                  <input type="date" style={inputStyle} value={expenseForm.date}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value, dueDate: addDaysEOM(e.target.value) }))} />
                </div>
                <div>
                  <label style={labelStyle}>Due Date (EOM + 30 days)</label>
                  <input type="date" style={inputStyle} value={expenseForm.dueDate || expenseForm.date}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setBillWizardStep(1)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setBillWizardStep(3)}>Next: Line Items →</button>
              </div>
            </div>
          )}

          {/* Step 3: Line Items */}
          {billWizardStep === 3 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                  <thead>
                    <tr style={{ background: colours.bg }}>
                      {["Description", "Category", "Amount (incl GST)", "GST Incl?", "GST Credit", ""].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colours.muted, borderBottom: `1px solid ${colours.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billLineItems.map((item, idx) => {
                      const amt = safeNumber(item.amount);
                      const gstCredit = item.gstIncl === "yes" ? amt / 11 : 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${colours.border}` }}>
                          <td style={{ padding: "8px 6px", minWidth: 180 }}>
                            <input style={{ ...inputStyle, fontSize: 13 }} value={item.description}
                              onChange={(e) => setBillLineItems((prev) => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))}
                              placeholder="Description" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 160 }}>
                            <select style={{ ...inputStyle, fontSize: 13 }} value={item.category}
                              onChange={(e) => setBillLineItems((prev) => prev.map((l, i) => i === idx ? { ...l, category: e.target.value } : l))}>
                              <option value="">Select...</option>
                              {expenseCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "8px 6px", width: 130 }}>
                            <input type="number" min="0" step="0.01" style={{ ...inputStyle, fontSize: 13 }} value={item.amount}
                              onChange={(e) => setBillLineItems((prev) => prev.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))}
                              placeholder="0.00" />
                          </td>
                          <td style={{ padding: "8px 6px", width: 90 }}>
                            <select style={{ ...inputStyle, fontSize: 13 }} value={item.gstIncl}
                              onChange={(e) => setBillLineItems((prev) => prev.map((l, i) => i === idx ? { ...l, gstIncl: e.target.value } : l))}>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          </td>
                          <td style={{ padding: "8px 6px", width: 100, fontSize: 13, color: colours.muted, textAlign: "right" }}>{currency(gstCredit)}</td>
                          <td style={{ padding: "8px 6px", width: 40 }}>
                            {billLineItems.length > 1 && (
                              <button onClick={() => setBillLineItems((prev) => prev.filter((_, i) => i !== idx))}
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
                <button onClick={() => setBillLineItems((prev) => [...prev, blankBillLine()])}
                  style={{ ...buttonSecondary, fontSize: 13, padding: "7px 14px" }}>+ Add line</button>
                <span style={{ fontSize: 13, color: colours.muted }}>{billLineItems.length} line{billLineItems.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button style={buttonSecondary} onClick={() => setBillWizardStep(2)}>← Back</button>
                <button style={buttonPrimary} onClick={() => setBillWizardStep(4)}>Next: Review →</button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Save */}
          {billWizardStep === 4 && (() => {
            const totalAmt = billLineItems.reduce((s, l) => s + safeNumber(l.amount), 0);
            const totalGst = billLineItems.reduce((s, l) => s + (l.gstIncl === "yes" ? safeNumber(l.amount) / 11 : 0), 0);
            return (
              <div style={{ display: "grid", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div style={{ ...cardStyle, padding: 16, background: colours.lightPurple }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Supplier</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: colours.text }}>{expenseForm.supplier}</div>
                  </div>
                  <div style={{ ...cardStyle, padding: 16, background: colours.lightTeal }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 8 }}>Dates</div>
                    <div style={{ fontSize: 13, color: colours.text }}>Bill date: {formatDateAU(expenseForm.date)}</div>
                    <div style={{ fontSize: 13, color: colours.text, marginTop: 4 }}>Due: {formatDateAU(expenseForm.dueDate)}</div>
                  </div>
                </div>
                <div style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 12 }}>Line Items</div>
                  {billLineItems.filter(l => l.description || l.amount).map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colours.border}`, fontSize: 14 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{item.description || "—"}</span>
                        {item.category && <span style={{ color: colours.muted, marginLeft: 8, fontSize: 12 }}>{item.category}</span>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong>{currency(safeNumber(item.amount))}</strong>
                        {item.gstIncl === "yes" && <div style={{ fontSize: 11, color: colours.teal }}>GST: {currency(safeNumber(item.amount) / 11)}</div>}
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, borderTop: `2px solid ${colours.border}`, paddingTop: 12, display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: colours.muted }}>GST credit (claimable)</span><span style={{ color: colours.teal, fontWeight: 700 }}>{currency(totalGst)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: colours.purple, marginTop: 6 }}><span>Total Bill</span><span>{currency(totalAmt)}</span></div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                  <button style={buttonSecondary} onClick={() => setBillWizardStep(3)}>← Back</button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={buttonSecondary} onClick={() => {
                      setExpenseForm({ date: todayLocal(), dueDate: addDaysEOM(todayLocal()), supplier: "", category: "", description: "", amount: "", expenseType: "", workType: profile.workType, receiptFileName: "", receiptUrl: "" });
                      setBillLineItems([blankBillLine()]);
                      setBillWizardStep(1);
                    }}>Clear</button>
                    <button style={buttonPrimary} disabled={savingBill} onClick={async () => {
                      if (!expenseForm.supplier) { toast.warning("Supplier name is required"); return; }
                      if (totalAmt <= 0) { toast.warning("Add at least one line with an amount"); return; }
                      setSavingBill(true);
                      const primaryCategory = billLineItems.find((l) => l.category)?.category || "Other";
                      const combinedDesc = billLineItems.map((l) => l.description).filter(Boolean).join("; ");
                      const payload = {
                        ...expenseForm,
                        category: primaryCategory,
                        description: combinedDesc,
                        amount: totalAmt,
                        gst: totalGst,
                        billLineItems,
                        expenseType: "Bill / Payable",
                      };
                      try {
                        const saved = await upsertRecordInDatabase(SUPABASE_TABLES.expenses, payload);
                        setExpenses((prev) => [...prev, saved]);
                        toast.success("Bill saved!");
                        setExpenseForm({ date: todayLocal(), dueDate: addDaysEOM(todayLocal()), supplier: "", category: "", description: "", amount: "", expenseType: "", workType: profile.workType, receiptFileName: "", receiptUrl: "" });
                        setBillLineItems([blankBillLine()]);
                        setBillWizardStep(1);
                      } catch (err) {
                        toast.error(err.message || "Save failed");
                      } finally {
                        setSavingBill(false);
                      }
                    }}>{savingBill ? "Saving..." : "Save Bill ✓"}</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </SectionCard>


        <SectionCard title="Supplier Directory" right={
          <div style={{ display: "flex", gap: 8 }}>
            <button style={buttonSecondary} onClick={() => { setImportType("suppliers"); setImportRows([]); setImportError(""); setShowImportModal(true); }}>⬆ Import</button>
            <button style={buttonPrimary} onClick={() => { setSupplierForm({ name: "", email: "", phone: "", address: "", abn: "", contactPerson: "", notes: "" }); setEditingSupplierId(null); setShowSupplierModal(true); }}>+ Add Supplier</button>
          </div>
        }>
          <DataTable
            emptyState={{ icon: "🏢", title: "No suppliers yet", message: "Save supplier details here so they auto-fill when you enter bills. Name, email, phone, address and ABN all stored." }}
            columns={[
              { key: "name", label: "Supplier" },
              { key: "contactPerson", label: "Contact" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "abn", label: "ABN" },
              { key: "actions", label: "", render: (_, row) => (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={buttonSecondary} onClick={() => { setSupplierForm({ name: row.name || "", email: row.email || "", phone: row.phone || "", address: row.address || "", abn: row.abn || "", contactPerson: row.contactPerson || "", notes: row.notes || "" }); setEditingSupplierId(row.id); setShowSupplierModal(true); }}>Edit</button>
                  <button style={buttonSecondary} onClick={() => deleteSupplier(row.id)}>Delete</button>
                </div>
              )},
            ]}
            rows={suppliers}
          />
        </SectionCard>

        <SectionCard title="Bills list" right={<div style={{ fontSize: 12, color: colours.muted }}>Based on expense records</div>}>
          <DataTable
            emptyState={{ icon: "📄", title: "No bills yet", message: "Bills and payables you record will appear here. Use the form above to add your first bill." }}
            columns={[
              { key: "supplier", label: "Supplier" },
              { key: "category", label: "Category" },
              { key: "date", label: "Bill date", render: (value) => formatDateAU(value) },
              { key: "dueDate", label: "Due date", render: (value) => formatDateAU(value) },
              { key: "amount", label: "Amount", render: (value) => currency(value) },
              { key: "status", label: "Status", render: (v, row) => (
                <span style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: row.type === "credit_note" ? "#F5ECFB" : v === "Paid" ? "#dcfce7" : v === "Overdue" ? "#FEF2F2" : v === "Due soon" ? "#FFF7ED" : "#f1f5f9",
                  color: row.type === "credit_note" ? colours.purple : v === "Paid" ? "#16a34a" : v === "Overdue" ? "#991B1B" : v === "Due soon" ? "#92400E" : "#64748b",
                }}>
                  {row.type === "credit_note" ? "CN" : v}
                </span>
              )},
              {
                key: "actions",
                label: "Actions",
                render: (_, row) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {row.isPaid ? (
                      <button style={buttonSecondary} onClick={() => markBillUnpaid(row)}>Mark Unpaid</button>
                    ) : (
                      <button style={buttonPrimary} onClick={() => markBillPaid(row)}>Mark Paid</button>
                    )}
                    <button style={buttonSecondary} onClick={() => openExpenseEditor(row)}>View / Edit</button>
                    <button
                      style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                      onClick={() => sendExpenseDirect(row)}
                    >
                      Email
                    </button>
                    {row.type !== "credit_note" && (
                      <button style={{ ...buttonSecondary, color: colours.purple, borderColor: colours.purple }}
                        onClick={() => { setCreditNoteSource(row); setCreditNoteForm({ amount: "", reason: "", date: todayLocal() }); setShowAPCreditNoteModal(true); }}>
                        Credit Note
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={billRows}
          />
        </SectionCard>
      </div>
    );

}

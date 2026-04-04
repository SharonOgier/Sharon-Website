import React, { useState, useMemo } from "react";

// -----------------------------------------------------------------------------
// ExpensesPage
// All state and handlers come from SharonPortalWebsite via props.
// -----------------------------------------------------------------------------

export default function ExpensesPage(props) {
  const {
    expenses,
    expenseForm,
    setExpenseForm,
    savingExpense,
    receiptFile,
    setReceiptFile,
    expenseEditorOpen,
    expenseEditorForm,
    setExpenseEditorForm,
    expenseModalOpen,
    setExpenseModalOpen,
    expenseTypeStep,
    setExpenseTypeStep,
    expenseTypeSelection,
    setExpenseTypeSelection,
    expenseWorkType,
    setExpenseWorkType,
    expenseWorkTypes,
    setExpenseWorkTypes,
    expenseCategorySelection,
    setExpenseCategorySelection,
    searchExpenseCategory,
    setSearchExpenseCategory,
    confirm,
    setActivePage,
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
    addDaysEOM = (date) => date,
    expenseCategories,
    DashboardHero,
    MiniBarChart = () => null,
    InsightChip,
    MetricCard,
    SectionCard,
    DataTable,
    EmptyState,
    ExpenseTypeModal,
    saveExpense,
    deleteExpense,
    openExpenseEditor,
    closeExpenseEditor,
    saveExpenseEdits,
    resetExpenseModal,
    nextExpenseModalStep,
    totals,
    uploadReceiptToSupabase,
    openReceiptFile = null,
  } = props;

    const totalExpenseAmt = expenses.reduce((s, e) => s + safeNumber(e.amount), 0);
    const totalGstCredit = expenses.reduce((s, e) => s + safeNumber(e.gst), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthExpenses = expenses.filter((e) => String(e.date || "").slice(0, 7) === thisMonth).reduce((s, e) => s + safeNumber(e.amount), 0);
    const categoryTotals = expenses.reduce((acc, e) => { const cat = e.category || "Other"; acc[cat] = (acc[cat] || 0) + safeNumber(e.amount); return acc; }, {});
    const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label: label.slice(0, 8), value }));
    return (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero title="Expenses" subtitle="Record and categorise all business expenses. GST credits are calculated automatically." highlight={currency(totalExpenseAmt)}>
        <InsightChip label="This month" value={currency(thisMonthExpenses)} />
        <InsightChip label="GST credits" value={currency(totalGstCredit)} />
        <InsightChip label="Categories" value={String(Object.keys(categoryTotals).length)} />
      </DashboardHero>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard title="Total expenses" value={currency(totalExpenseAmt)} subtitle="All recorded expenses." accent={colours.purple} />
        <MetricCard title="This month" value={currency(thisMonthExpenses)} subtitle="Expenses recorded this calendar month." accent={colours.teal} />
        <MetricCard title="GST credits" value={currency(totalGstCredit)} subtitle="Claimable input tax credits." accent={colours.purple} />
        <MetricCard title="Categories used" value={String(Object.keys(categoryTotals).length)} subtitle="Distinct expense categories." accent={colours.purple} />
        <div style={{ ...cardStyle, padding: 18, gridColumn: "span 2" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Top expense categories</div>
          <MiniBarChart data={topCategories} height={90} accent={colours.purple} />
        </div>
      </div>
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
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value, dueDate: addDaysEOM(e.target.value) }))}
            />
          </div>


          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              style={inputStyle}
              value={expenseForm.dueDate || expenseForm.date}
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Supplier</label>
            <input
              style={inputStyle}
              value={expenseForm.supplier}
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, supplier: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <input
              style={inputStyle}
              value={expenseForm.category}
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Amount</label>
            <input
              type="number"
              style={inputStyle}
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              value={expenseForm.description}
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
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

        {receiptFile ? (
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: colours.muted }}>{expenseForm.receiptFileName}</span>
            <button
              type="button"
              style={buttonSecondary}
              onClick={() => {
                const previewUrl = URL.createObjectURL(receiptFile);
                window.open(previewUrl, "_blank");
              }}
            >
              Preview
            </button>
            <button
              type="button"
              style={buttonSecondary}
              onClick={() => {
                setReceiptFile(null);
                setExpenseForm((prev) => ({ ...prev, receiptFileName: "", receiptUrl: "" }));
              }}
            >
              Remove
            </button>
          </div>
        ) : expenseForm.receiptFileName ? (
          <div style={{ marginTop: 12, fontSize: 14, color: colours.muted }}>
            Saved receipt: {expenseForm.receiptFileName}
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 13, color: colours.muted }}>No receipt attached.</div>
        )}

        <div style={{ marginTop: 18 }}>
          <button style={buttonPrimary} onClick={saveExpense}>
            Save Expense
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Expense List">
        <DataTable
          emptyState={{ icon: "[money]", title: "No expenses yet", message: "Record your first expense using the form above. GST credits are calculated automatically and your Safe to Spend updates in real time." }}
          columns={[
            { key: "date", label: "Date", render: (v) => formatDateAU(v) },
            { key: "dueDate", label: "Due Date", render: (v, row) => formatDateAU(v || row.date) },
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
                  {row.filePath || row.receiptUrl ? (
                    <button
                      style={buttonPrimary}
                      onClick={() => openReceiptFile ? openReceiptFile(row) : row.receiptUrl && window.open(row.receiptUrl, "_blank", "noopener,noreferrer")}
                    >
                      View Receipt
                    </button>
                  ) : (
                    <span style={{ color: colours.muted }}>No receipt</span>
                  )}

                  <button
                    style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                    onClick={() => {
                      const w = window.open("", "_blank");
                      if (!w) return;
                      const receiptSection = row.receiptUrl
                        ? `<div style="margin-top:24px;">
                            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#6A1B9A;margin-bottom:8px;">Receipt</div>
                            ${row.receiptUrl.match(/\.(jpg|jpeg|png|webp)/i)
                              ? `<img src="${row.receiptUrl}" style="max-width:100%;border-radius:10px;border:1px solid #E2E8F0;" />`
                              : `<a href="${row.receiptUrl}" target="_blank" style="color:#6A1B9A;font-size:14px;">View attached receipt (PDF)</a>`
                            }
                           </div>`
                        : "";
                      w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Expense - ${row.supplier || row.description || ""}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; font-family: Arial, Helvetica, sans-serif; color: #14202B; background: #F8FAFC; }
  .card { background: #fff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px; max-width: 640px; margin: 0 auto; }
  .header { border-bottom: 2px solid #6A1B9A; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .title { font-size: 26px; font-weight: 900; color: #6A1B9A; }
  .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6A1B9A; margin-bottom: 4px; }
  .value { font-size: 14px; color: #14202B; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; }
  .amount { font-size: 28px; font-weight: 900; color: #006D6D; }
  .badge { display: inline-block; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 4px 12px; font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 16px; }
  .print-btn { display: block; margin: 24px auto 0; background: #6A1B9A; color: #fff; border: none; border-radius: 10px; padding: 12px 32px; font-size: 15px; font-weight: 700; cursor: pointer; }
  @media print { .print-btn { display: none; } body { background: #fff; padding: 0; } .card { border: none; border-radius: 0; box-shadow: none; } }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div>
      <div class="title">EXPENSE RECORD</div>
      <div style="font-size:13px;color:#64748B;margin-top:4px;">${row.expenseType || "Business Expense"}</div>
    </div>
    <div style="text-align:right;">
      <div class="amount">$${parseFloat(row.amount || 0).toFixed(2)}</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px;">incl. GST $${parseFloat(row.gst || 0).toFixed(2)}</div>
    </div>
  </div>
  <div class="grid">
    <div><div class="label">Supplier</div><div class="value">${row.supplier || "-"}</div></div>
    <div><div class="label">Date</div><div class="value">${row.date || "-"}</div></div>
    <div><div class="label">Category</div><div class="value">${row.category || "-"}</div></div>
    <div><div class="label">Due Date</div><div class="value">${row.dueDate || row.date || "-"}</div></div>
    <div><div class="label">Work Type</div><div class="value">${row.workType || "-"}</div></div>
    <div><div class="label">GST Amount</div><div class="value">$${parseFloat(row.gst || 0).toFixed(2)}</div></div>
  </div>
  ${row.description ? `<div class="label" style="margin-top:8px;">Description</div><div class="value">${row.description}</div>` : ""}
  ${receiptSection}
</div>
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`);
                      w.document.close();
                    }}
                  >
                    Preview &amp; Print
                  </button>

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

}

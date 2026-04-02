import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ExpensesPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

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
        <MetricCard title="Total expenses" value={currency(totalExpenseAmt)} subtitle="All recorded expenses." accent={colours.navy} />
        <MetricCard title="This month" value={currency(thisMonthExpenses)} subtitle="Expenses recorded this calendar month." accent={colours.teal} />
        <MetricCard title="GST credits" value={currency(totalGstCredit)} subtitle="Claimable input tax credits." accent={colours.purple} />
        <MetricCard title="Categories used" value={String(Object.keys(categoryTotals).length)} subtitle="Distinct expense categories." accent={colours.navy} />
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
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value, dueDate: addDaysEOM(e.target.value) })}
            />
          </div>


          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              style={inputStyle}
              value={expenseForm.dueDate || expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, dueDate: e.target.value })}
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
        ) : <EmptyState icon="📁" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}

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
        ) : <EmptyState icon="📁" title="No documents yet" message="Upload receipts, contracts and generated PDFs here. All documents are stored securely against your account." />}

        <div style={{ marginTop: 18 }}>
          <button style={buttonPrimary} onClick={saveExpense}>
            Save Expense
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Expense List">
        <DataTable
          emptyState={{ icon: "💸", title: "No expenses yet", message: "Record your first expense using the form above. GST credits are calculated automatically and your Safe to Spend updates in real time." }}
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

                  <button
                    style={{ ...buttonSecondary, color: colours.teal, borderColor: colours.teal }}
                    onClick={() => sendExpenseDirect(row)}
                  >
                    Email
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

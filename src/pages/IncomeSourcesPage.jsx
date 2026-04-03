import React, { useState, useMemo } from "react";

// -----------------------------------------------------------------------------
// IncomeSourcesPage
// All state and handlers come from SharonPortalWebsite via props.
// -----------------------------------------------------------------------------

export default function IncomeSourcesPage(props) {
  const {
    incomeSources,
    showIncomeSourceModal,
    setShowIncomeSourceModal,
    incomeSourceForm,
    setIncomeSourceForm,
    savingIncomeSource,
    incomeSourceEditorOpen,
    incomeSourceEditorForm,
    setIncomeSourceEditorForm,
    colours,
    cardStyle,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    currency,
    safeNumber,
    incomeTypeOptions,
    incomeFrequencyOptions,
    DashboardHero,
    InsightChip,
    MetricCard,
    SectionCard,
    DataTable,
    EmptyState,
    MiniBarChart,
    IncomeSourceModal,
    saveIncomeSource,
    deleteIncomeSource,
    openIncomeSourceEditor = () => {},
    closeIncomeSourceEditor = () => {},
    saveIncomeSourceEdits = () => {},
    savingIncomeSourceEdits = false,
  } = props;

    const totalBeforeTax = incomeSources.reduce((s, src) => s + safeNumber(src.beforeTax), 0);
    const annualised = incomeSources.reduce((s, src) => {
      const freq = src.frequency || "";
      const amt = safeNumber(src.beforeTax);
      const mult = freq === "Weekly" ? 52 : freq === "Fortnightly" ? 26 : freq === "Monthly" ? 12 : freq === "Quarterly" ? 4 : 1;
      return s + amt * mult;
    }, 0);
    const typeBreakdown = incomeSources.reduce((acc, src) => { const t = src.incomeType || "Other"; acc[t] = (acc[t] || 0) + safeNumber(src.beforeTax); return acc; }, {});
    const typeData = Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label: label.slice(0, 10), value }));
    return (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero title="Income Sources" subtitle="Track all personal and business income streams for tax reporting. Feeds directly into your ATO export." highlight={currency(annualised)}>
        <InsightChip label="Sources recorded" value={String(incomeSources.length)} />
        <InsightChip label="Total before tax" value={currency(totalBeforeTax)} />
        <InsightChip label="Annualised est." value={currency(annualised)} />
      </DashboardHero>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard title="Sources recorded" value={String(incomeSources.length)} subtitle="All income sources in the portal." accent={colours.purple} />
        <MetricCard title="Total before tax" value={currency(totalBeforeTax)} subtitle="Sum of all recorded before-tax amounts." accent={colours.teal} />
        <MetricCard title="Annualised estimate" value={currency(annualised)} subtitle="Projected annual income based on frequency." accent={colours.purple} />
        <MetricCard title="Income types" value={String(Object.keys(typeBreakdown).length)} subtitle="Distinct income type categories." accent={colours.purple} />
        <div style={{ ...cardStyle, padding: 18, gridColumn: "span 2" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colours.muted, textTransform: "uppercase", marginBottom: 10 }}>Income by type</div>
          <MiniBarChart data={typeData} height={90} accent={colours.teal} />
        </div>
      </div>
      <SectionCard title="Income Sources" right={<button style={buttonPrimary} onClick={() => setShowIncomeSourceModal(true)}>New Income Source</button>}>
        <DataTable
          emptyState={{ icon: "", title: "No income sources yet", message: "Add your income sources for your ATO export -- employment, freelance, rental income and other earnings.", action: { label: "Add income source", onClick: () => {} } }}
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
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={buttonSecondary} onClick={() => openIncomeSourceEditor(row)}>Edit</button>
                  <button style={buttonSecondary} onClick={() => deleteIncomeSource(row.id)}>Delete</button>
                </div>
              ),
            },
          ]}
          rows={incomeSources}
        />
      </SectionCard>

      {/* Income Source Editor Modal */}
      {incomeSourceEditorOpen && incomeSourceEditorForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: 28, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.22)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: colours.text }}>Edit Income Source</div>
              <button style={buttonSecondary} onClick={closeIncomeSourceEditor}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} value={incomeSourceEditorForm.name || ""} onChange={(e) => setIncomeSourceEditorForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Income Type</label>
                <select style={inputStyle} value={incomeSourceEditorForm.incomeType || ""} onChange={(e) => setIncomeSourceEditorForm((prev) => ({ ...prev, incomeType: e.target.value }))}>
                  {(incomeTypeOptions || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Amount Before Tax</label>
                <input type="number" min="0" step="0.01" style={inputStyle} value={incomeSourceEditorForm.beforeTax || ""} onChange={(e) => setIncomeSourceEditorForm((prev) => ({ ...prev, beforeTax: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Frequency</label>
                <select style={inputStyle} value={incomeSourceEditorForm.frequency || ""} onChange={(e) => setIncomeSourceEditorForm((prev) => ({ ...prev, frequency: e.target.value }))}>
                  <option value="">Select...</option>
                  {(incomeFrequencyOptions || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <input type="checkbox" checked={Boolean(incomeSourceEditorForm.startedAfterDate)} onChange={(e) => setIncomeSourceEditorForm((prev) => ({ ...prev, startedAfterDate: e.target.checked }))} />
                Started after 1 Jul 2025
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <input type="checkbox" checked={Boolean(incomeSourceEditorForm.hasEndDate)} onChange={(e) => setIncomeSourceEditorForm((prev) => ({ ...prev, hasEndDate: e.target.checked }))} />
                Has a fixed end date
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button style={buttonSecondary} onClick={closeIncomeSourceEditor}>Cancel</button>
              <button style={{ ...buttonPrimary, opacity: savingIncomeSourceEdits ? 0.6 : 1 }} disabled={savingIncomeSourceEdits} onClick={saveIncomeSourceEdits}>{savingIncomeSourceEdits ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    );

}

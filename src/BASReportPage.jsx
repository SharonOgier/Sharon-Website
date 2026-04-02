import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BASReportPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function BASReportPage(props) {
  const {
    profile,
    invoices,
    expenses,
    invoiceAllocations,
    totals,
    basQuarter,
    setBasQuarter,
    basNotes,
    setBasNotes,
    colours,
    cardStyle,
    buttonPrimary,
    inputStyle,
    labelStyle,
    currency,
    formatDateAU,
    safeNumber,
    DashboardHero,
    InsightChip,
    SectionCard,
    SummaryBox,
    setActivePage,
  } = props;

      const quarterOptions = [
        { value: "0", label: "All activity" },
        { value: "1", label: "Quarter 1 (Jul-Sep)" },
        { value: "2", label: "Quarter 2 (Oct-Dec)" },
        { value: "3", label: "Quarter 3 (Jan-Mar)" },
        { value: "4", label: "Quarter 4 (Apr-Jun)" },
      ];
      return (
        <div style={{ display: "grid", gap: 20 }}>
          <SectionCard title="BAS Report">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div>
                <label style={labelStyle}>Quarter</label>
                <select style={inputStyle} value={basQuarter} onChange={(e) => setBasQuarter(e.target.value)}>
                  {quarterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Lodged date</label>
                <input type="date" style={inputStyle} value={basNotes.lodgedDate} onChange={(e) => setBasNotes((prev) => ({ ...prev, lodgedDate: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Reference number</label>
                <input style={inputStyle} value={basNotes.referenceNumber} onChange={(e) => setBasNotes((prev) => ({ ...prev, referenceNumber: e.target.value }))} placeholder="ATO reference" />
              </div>
            </div>
          </SectionCard>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <SummaryBox title="G1 Total sales" value={currency(totals.totalIncome)} subtitle="Gross sales from invoices" />
            <SummaryBox title="1A GST on sales" value={currency(totals.gstCollected)} subtitle="GST collected from income" />
            <SummaryBox title="1B GST on purchases" value={currency(totals.gstOnExpenses)} subtitle="GST credits on expenses" />
            <SummaryBox title="Net GST" value={currency(totals.gstPayable)} subtitle="1A less 1B" />
          </div>
          <SectionCard title="BAS notes">
            <textarea
              style={{ ...inputStyle, minHeight: 140, resize: "vertical" }}
              value={basNotes.notes}
              onChange={(e) => setBasNotes((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Add BAS working notes, assumptions and lodgement details here."
            />
          </SectionCard>
        </div>
      );

}

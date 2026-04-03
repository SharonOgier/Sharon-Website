import React, { useState, useMemo } from "react";

// -----------------------------------------------------------------------------
// BASReportPage
// All state and handlers come from SharonPortalWebsite via props.
// -----------------------------------------------------------------------------

export default function BASReportPage(props) {
  const {
    profile = {},
    invoices = [],
    expenses = [],
    invoiceAllocations = [],
    totals = {},
    basQuarter,
    setBasQuarter,
    basNotes = {},
    setBasNotes,
    colours,
    cardStyle,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    currency,
    formatDateAU,
    safeNumber,
    DashboardHero,
    InsightChip,
    MetricCard,
    SectionCard,
    SummaryBox,
    setActivePage,
  } = props;

  const quarterOptions = [
    { value: "0", label: "All activity" },
    { value: "1", label: "Quarter 1 (Jul - Sep)" },
    { value: "2", label: "Quarter 2 (Oct - Dec)" },
    { value: "3", label: "Quarter 3 (Jan - Mar)" },
    { value: "4", label: "Quarter 4 (Apr - Jun)" },
  ];

  const quarterMonthRanges = {
    "1": ["07", "08", "09"],
    "2": ["10", "11", "12"],
    "3": ["01", "02", "03"],
    "4": ["04", "05", "06"],
  };

  const inRange = (dateStr) => {
    if (!basQuarter || basQuarter === "0") return true;
    const month = String(dateStr || "").slice(5, 7);
    return (quarterMonthRanges[basQuarter] || []).includes(month);
  };

  const filteredInvoices = invoices.filter((inv) => inRange(inv.invoiceDate));
  const filteredExpenses = expenses.filter((exp) => inRange(exp.date));

  const g1TotalSales = filteredInvoices.reduce((s, inv) => s + safeNumber(inv.total), 0);
  const gstOnSales = filteredInvoices.reduce((s, inv) => s + safeNumber(inv.gst), 0);
  const gstOnPurchases = filteredExpenses.reduce((s, exp) => s + safeNumber(exp.gst), 0);
  const netGst = gstOnSales - gstOnPurchases;
  const totalExpensesAmt = filteredExpenses.reduce((s, exp) => s + safeNumber(exp.amount), 0);

  const quarterLabel = quarterOptions.find((q) => q.value === basQuarter)?.label || "All activity";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero
        title="BAS Report"
        subtitle="Business Activity Statement summary. Select a quarter to filter by reporting period."
        highlight={currency(netGst)}
      >
        <InsightChip label="Quarter" value={quarterLabel} />
        <InsightChip label="GST on sales" value={currency(gstOnSales)} />
        <InsightChip label="GST on purchases" value={currency(gstOnPurchases)} />
      </DashboardHero>

      <SectionCard title="Reporting Period">
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
            <input type="date" style={inputStyle} value={basNotes.lodgedDate || ""} onChange={(e) => setBasNotes((prev) => ({ ...prev, lodgedDate: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>ATO reference number</label>
            <input style={inputStyle} value={basNotes.referenceNumber || ""} onChange={(e) => setBasNotes((prev) => ({ ...prev, referenceNumber: e.target.value }))} placeholder="ATO reference" />
          </div>
        </div>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard title="G1 Total sales" value={currency(g1TotalSales)} subtitle="Gross sales from invoices." accent={colours.purple} />
        <MetricCard title="1A GST on sales" value={currency(gstOnSales)} subtitle="GST collected from clients." accent={colours.teal} />
        <MetricCard title="1B GST on purchases" value={currency(gstOnPurchases)} subtitle="GST credits on recorded expenses." accent={colours.purple} />
        <MetricCard title="Net GST payable" value={currency(netGst)} subtitle="1A less 1B -- amount owing to ATO." accent={colours.teal} />
      </div>

      <SectionCard title="BAS Figures">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[
            { code: "G1",  label: "Total sales",           value: g1TotalSales,      note: "All invoiced amounts incl. GST" },
            { code: "G2",  label: "GST-free sales",         value: 0,                 note: "Sales not subject to GST" },
            { code: "G3",  label: "Input-taxed sales",      value: 0,                 note: "e.g. financial supplies" },
            { code: "G10", label: "Capital purchases",      value: 0,                 note: "Assets purchased this period" },
            { code: "G11", label: "Non-capital purchases",  value: totalExpensesAmt,  note: "Operating expenses incl. GST" },
            { code: "1A",  label: "GST on sales",           value: gstOnSales,        note: "GST collected -- pay to ATO" },
            { code: "1B",  label: "GST on purchases",       value: gstOnPurchases,    note: "GST credits -- claim back" },
          ].map(({ code, label, value, note }) => (
            <div key={code} style={{ ...cardStyle, padding: 16, background: colours.bg }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: colours.purple, letterSpacing: 0.5 }}>{code}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: colours.text }}>{currency(value)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colours.text }}>{label}</div>
              <div style={{ fontSize: 12, color: colours.muted, marginTop: 2 }}>{note}</div>
            </div>
          ))}
          <div style={{ ...cardStyle, padding: 16, background: netGst > 0 ? "#FEF2F2" : "#F0FDF4", border: `1px solid ${netGst > 0 ? "#FECACA" : "#BBF7D0"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: netGst > 0 ? "#991B1B" : "#166534", letterSpacing: 0.5 }}>Net GST</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: netGst > 0 ? "#991B1B" : "#166534" }}>{currency(Math.abs(netGst))}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: colours.text }}>{netGst > 0 ? "Amount payable to ATO" : netGst < 0 ? "Refund from ATO" : "Nil balance"}</div>
            <div style={{ fontSize: 12, color: colours.muted, marginTop: 2 }}>1A minus 1B</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Lodgement notes">
        <textarea
          style={{ ...inputStyle, minHeight: 140, resize: "vertical" }}
          value={basNotes.notes || ""}
          onChange={(e) => setBasNotes((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Add BAS working notes, assumptions and lodgement details here."
        />
        {basNotes.lodgedDate && (
          <div style={{ marginTop: 12, fontSize: 13, color: colours.muted }}>
            Lodged: {formatDateAU(basNotes.lodgedDate)}
            {basNotes.referenceNumber && <span style={{ marginLeft: 16 }}>Ref: {basNotes.referenceNumber}</span>}
          </div>
        )}
      </SectionCard>
    </div>
  );

}

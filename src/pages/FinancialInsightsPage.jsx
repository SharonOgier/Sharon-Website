import React from "react";

// -----------------------------------------------------------------------------
// FinancialInsightsPage
// All state and handlers come from SharonPortalWebsite via props.
// -----------------------------------------------------------------------------

export default function FinancialInsightsPage(props) {
  const {
    profile = {},
    totals = {},
    invoiceAllocations = [],
    monthlyFinance = [],
    clientRevenueRows = [],
    expenseCategoryRows = [],
    financialInsights = {},
    setActivePage = () => {},
    cardStyle = {},
    colours = {},
    currency = (value) => String(value ?? ""),
    formatDateAU = (value) => String(value ?? ""),
    safeNumber = (value) => Number(value || 0),
    todayLocal = () => new Date().toISOString().slice(0, 10),
    DashboardHero = ({ children }) => <div>{children}</div>,
    InsightChip = () => null,
    MetricCard = () => null,
    TrendBarsCard = () => null,
    WaterfallCard = () => null,
    SectionCard = ({ title, children, right }) => (
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>{title}</h2>
          {right}
        </div>
        {children}
      </section>
    ),
    ActionHubCard = () => null,
    DataTable = ({ columns = [], rows = [], emptyState = null }) => {
      if (!rows.length) {
        return emptyState ? <div>{emptyState.title || "No data available."}</div> : null;
      }
      return (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key || column.label} style={{ textAlign: "left", padding: 8 }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id ?? index}>
                {columns.map((column) => (
                  <td key={column.key || column.label} style={{ padding: 8, verticalAlign: "top" }}>
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    },
  } = props;

  const resolvedColours = {
    purple: colours.purple || "#6A1B9A",
    teal: colours.teal || "#006D6D",
    navy: colours.navy || "#2B2F6B",
    bg: colours.bg || "#F8FAFC",
    white: colours.white || "#FFFFFF",
    text: colours.text || "#14202B",
    muted: colours.muted || "#64748B",
    border: colours.border || "#E2E8F0",
    lightPurple: colours.lightPurple || "#F5ECFB",
    lightTeal: colours.lightTeal || "#E7F6F5",
  };

  const baseCardStyle = {
    background: resolvedColours.white,
    border: `1px solid ${resolvedColours.border}`,
    borderRadius: 18,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
    ...(cardStyle || {}),
  };

  const resolvedFinancialInsights = {
    healthScore: safeNumber(financialInsights?.healthScore),
    healthLabel: financialInsights?.healthLabel || "No rating yet",
    topThreeClientShare: safeNumber(financialInsights?.topThreeClientShare),
    topClientShare: safeNumber(financialInsights?.topClientShare),
    usableCashRatio: safeNumber(financialInsights?.usableCashRatio),
    averageMonthlyRevenue: safeNumber(financialInsights?.averageMonthlyRevenue),
    revenueChangePct: safeNumber(financialInsights?.revenueChangePct),
    expenseRatio: safeNumber(financialInsights?.expenseRatio),
    averageVolatility: safeNumber(financialInsights?.averageVolatility),
    expenseChangePct: safeNumber(financialInsights?.expenseChangePct),
    averageInvoiceValue: safeNumber(financialInsights?.averageInvoiceValue),
    bestMonth: financialInsights?.bestMonth || null,
    worstMonth: financialInsights?.worstMonth || null,
    largestExpenseCategory: financialInsights?.largestExpenseCategory || null,
    alerts: Array.isArray(financialInsights?.alerts) ? financialInsights.alerts : [],
  };

  const paidIncome = safeNumber(totals?.paidIncome);
  const totalIncome = safeNumber(totals?.totalIncome);
  const totalExpenses = safeNumber(totals?.totalExpenses);
  const gstCollected = safeNumber(totals?.gstCollected);
  const gstOnExpenses = safeNumber(totals?.gstOnExpenses);
  const gstPayable = safeNumber(totals?.gstPayable);
  const estimatedTax = safeNumber(totals?.estimatedTax);
  const totalFees = safeNumber(totals?.totalFees);
  const totalTaxWithheld = safeNumber(totals?.totalTaxWithheld);
  const preExpenseAvailable = safeNumber(totals?.preExpenseAvailable);
  const monthlySubscriptionCost = safeNumber(totals?.monthlySubscriptionCost);
  const safeToSpend = safeNumber(totals?.safeToSpend);

  const profitAndLossRows = [
    { line: "Sales / invoice income", amount: totalIncome },
    { line: "Less operating expenses", amount: -totalExpenses },
    { line: "Operating result", amount: totalIncome - totalExpenses },
    { line: "Less subscription", amount: -monthlySubscriptionCost },
    { line: "Net result after subscription", amount: totalIncome - totalExpenses - monthlySubscriptionCost },
  ];

  const cashMovementRows = [
    { line: "Paid income received", amount: paidIncome },
    { line: "Less GST payable", amount: -gstPayable },
    { line: "Less estimated tax reserve", amount: -estimatedTax },
    { line: "Less fees", amount: -totalFees },
    { line: "Less tax withheld", amount: -totalTaxWithheld },
    { line: "Less operating expenses", amount: -totalExpenses },
    { line: "Less subscription", amount: -monthlySubscriptionCost },
    { line: "Safe to spend", amount: safeToSpend },
  ];

  const gstReportRows = [
    { line: "GST collected on income", amount: gstCollected },
    { line: "GST credits on expenses", amount: -gstOnExpenses },
    { line: "Net GST position", amount: gstPayable },
  ];

  const revenueSummaryRows = (monthlyFinance || []).map((month) => ({
    period: month?.label || month?.monthKey || "-",
    revenue: safeNumber(month?.revenue),
    expenses: safeNumber(month?.expenses),
    net: safeNumber(month?.net),
  }));

  const allocationRows = (invoiceAllocations || []).map((item) => ({
    id: item?.id,
    invoiceNumber: item?.invoiceNumber || "-",
    date: item?.invoiceDate || item?.paidAt || todayLocal(),
    gross: safeNumber(item?.gross ?? item?.total),
    gst: safeNumber(item?.gst),
    incomeExGst: safeNumber(item?.incomeExGst),
    estimatedTax: safeNumber(item?.estimatedTax),
    fee: safeNumber(item?.fee),
    taxWithheld: safeNumber(item?.taxWithheld),
    netAvailable: safeNumber(item?.netAvailable),
  }));

  const tableCellStyle = {
    padding: "10px 12px",
    borderBottom: `1px solid ${resolvedColours.border}`,
    fontSize: 14,
    color: resolvedColours.text,
  };

  const renderSimpleReportTable = (rows) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 380 }}>
        <thead>
          <tr style={{ background: resolvedColours.bg }}>
            <th style={{ ...tableCellStyle, textAlign: "left", fontWeight: 800, color: resolvedColours.muted }}>Line item</th>
            <th style={{ ...tableCellStyle, textAlign: "right", fontWeight: 800, color: resolvedColours.muted }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.line}>
              <td style={{ ...tableCellStyle, fontWeight: 600 }}>{row.line}</td>
              <td style={{ ...tableCellStyle, textAlign: "right", fontWeight: 700 }}>{currency(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero
        title="Financial Reports"
        subtitle="This page now contains the actual financial reporting view for your portal, including Profit & Loss, cash movement, GST position, revenue summary, and paid invoice allocation detail."
        highlight={currency(safeToSpend)}
      >
        <InsightChip label="Safe to spend" value={currency(safeToSpend)} />
        <InsightChip label="GST payable" value={currency(gstPayable)} />
        <InsightChip label="Net result" value={currency(totalIncome - totalExpenses - monthlySubscriptionCost)} />
      </DashboardHero>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard title="Total income" value={currency(totalIncome)} subtitle="All invoice income recorded in the portal." accent={resolvedColours.purple} />
        <MetricCard title="Paid income" value={currency(paidIncome)} subtitle="Cash actually received from paid invoices." accent={resolvedColours.teal} />
        <MetricCard title="Total expenses" value={currency(totalExpenses)} subtitle="All expenses currently recorded." accent={resolvedColours.purple} />
        <MetricCard title="Safe to spend" value={currency(safeToSpend)} subtitle="Cash remaining after tax, GST, fees, expenses, and subscription." accent={resolvedColours.teal} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <SectionCard title="Profit & Loss" right={<div style={{ fontSize: 12, color: resolvedColours.muted }}>Core profitability report</div>}>
          {renderSimpleReportTable(profitAndLossRows)}
        </SectionCard>

        <SectionCard title="GST Position" right={<div style={{ fontSize: 12, color: resolvedColours.muted }}>Collected less credits</div>}>
          {renderSimpleReportTable(gstReportRows)}
        </SectionCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <SectionCard title="Cash Movement" right={<div style={{ fontSize: 12, color: resolvedColours.muted }}>How paid income is allocated</div>}>
          {renderSimpleReportTable(cashMovementRows)}
        </SectionCard>

        <WaterfallCard
          title="Cash efficiency"
          rows={[
            { label: "Paid income", value: paidIncome },
            { label: "Less GST payable", value: -gstPayable },
            { label: "Less tax reserve", value: -estimatedTax },
            { label: "Less expenses", value: -totalExpenses },
            { label: "Less subscription", value: -monthlySubscriptionCost },
            { label: "Safe to spend", value: safeToSpend },
          ]}
        />
      </div>

      <SectionCard title="Revenue Summary" right={<div style={{ fontSize: 12, color: resolvedColours.muted }}>Month-by-month report</div>}>
        <DataTable
          columns={[
            { key: "period", label: "Period" },
            { key: "revenue", label: "Revenue", render: (value) => currency(value) },
            { key: "expenses", label: "Expenses", render: (value) => currency(value) },
            { key: "net", label: "Net", render: (value) => currency(value) },
          ]}
          rows={revenueSummaryRows}
          emptyState={{ title: "No monthly revenue data yet." }}
        />
      </SectionCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        <SectionCard title="Client risk" right={<div style={{ fontSize: 12, color: resolvedColours.muted }}>Concentration view</div>}>
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ ...baseCardStyle, padding: 14, background: resolvedColours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: resolvedColours.muted }}>Top client share</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: resolvedColours.text, marginTop: 6 }}>{resolvedFinancialInsights.topClientShare.toFixed(1)}%</div>
              </div>
              <div style={{ ...baseCardStyle, padding: 14, background: resolvedColours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: resolvedColours.muted }}>Top 3 clients</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: resolvedColours.text, marginTop: 6 }}>{resolvedFinancialInsights.topThreeClientShare.toFixed(1)}%</div>
              </div>
            </div>
            <TrendBarsCard
              title="Top clients"
              subtitle="Highest paid revenue contributors"
              data={(clientRevenueRows || []).slice(0, 4)}
              valueKey="value"
              formatValue={(value) => currency(value)}
              accent={resolvedColours.teal}
              emptyText="No paid client revenue yet."
            />
          </div>
        </SectionCard>

        <SectionCard title="Expense behaviour" right={<div style={{ fontSize: 12, color: resolvedColours.muted }}>Largest categories and recent change</div>}>
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ ...baseCardStyle, padding: 14, background: resolvedColours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: resolvedColours.muted }}>Latest expense move</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: resolvedColours.text, marginTop: 6 }}>{`${resolvedFinancialInsights.expenseChangePct >= 0 ? "+" : ""}${resolvedFinancialInsights.expenseChangePct.toFixed(1)}%`}</div>
              </div>
              <div style={{ ...baseCardStyle, padding: 14, background: resolvedColours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: resolvedColours.muted }}>Largest category</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: resolvedColours.text, marginTop: 6 }}>{resolvedFinancialInsights.largestExpenseCategory?.label || "-"}</div>
                <div style={{ fontSize: 13, color: resolvedColours.muted, marginTop: 6 }}>{currency(resolvedFinancialInsights.largestExpenseCategory?.value || 0)}</div>
              </div>
            </div>
            <TrendBarsCard
              title="Expense categories"
              subtitle="Largest recorded categories"
              data={(expenseCategoryRows || []).slice(0, 5)}
              valueKey="value"
              formatValue={(value) => currency(value)}
              accent={resolvedColours.purple}
              emptyText="No expenses recorded yet."
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Paid Invoice Allocation Detail" right={<div style={{ fontSize: 12, color: resolvedColours.muted }}>Supporting detail behind cash figures</div>}>
        <DataTable
          columns={[
            { key: "invoiceNumber", label: "Invoice" },
            { key: "date", label: "Date", render: (value) => formatDateAU(value) },
            { key: "gross", label: "Gross", render: (value) => currency(value) },
            { key: "gst", label: "GST", render: (value) => currency(value) },
            { key: "incomeExGst", label: "Ex GST", render: (value) => currency(value) },
            { key: "estimatedTax", label: "Tax reserve", render: (value) => currency(value) },
            { key: "fee", label: "Fees", render: (value) => currency(value) },
            { key: "taxWithheld", label: "Tax withheld", render: (value) => currency(value) },
            { key: "netAvailable", label: "Net available", render: (value) => currency(value) },
          ]}
          rows={allocationRows}
          emptyState={{ title: "No paid invoice allocation data yet." }}
        />
      </SectionCard>

      <SectionCard title="Simple alerts" right={<div style={{ fontSize: 12, color: resolvedColours.muted }}>Automatic observations</div>}>
        <div style={{ display: "grid", gap: 12 }}>
          {(resolvedFinancialInsights.alerts || []).length ? (
            resolvedFinancialInsights.alerts.map((alert, index) => (
              <div
                key={index}
                style={{
                  ...baseCardStyle,
                  padding: 14,
                  background: resolvedColours.bg,
                  borderLeft: `4px solid ${index === 0 && String(alert).includes("No immediate") ? resolvedColours.teal : resolvedColours.purple}`,
                }}
              >
                <div style={{ fontSize: 14, color: resolvedColours.text, lineHeight: 1.6 }}>{alert}</div>
              </div>
            ))
          ) : (
            <div style={{ ...baseCardStyle, padding: 14, background: resolvedColours.bg }}>
              <div style={{ fontSize: 14, color: resolvedColours.text, lineHeight: 1.6 }}>No automatic alerts yet.</div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

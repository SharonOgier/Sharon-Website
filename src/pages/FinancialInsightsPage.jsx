import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// FinancialInsightsPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function FinancialInsightsPage(props) {
  const {
    profile,
    totals,
    invoiceAllocations,
    monthlyFinance,
    clientRevenueRows,
    expenseCategoryRows,
    financialInsights,
    setActivePage,
    cardStyle,
    colours,
    currency,
    formatDateAU,
    safeNumber,
    todayLocal,
    DashboardHero,
    InsightChip,
    MetricCard,
    TrendBarsCard,
    WaterfallCard,
    SectionCard,
    ActionHubCard,
    DataTable,
  } = props;

    <div style={{ display: "grid", gap: 20 }}>
      <DashboardHero
        title="Financial Insights"
        subtitle="A lighter analysis page that keeps the current look, but focuses on interpretation instead of repeating the dashboard."
        highlight={`${financialInsights.healthScore.toFixed(0)}/100`}
      >
        <InsightChip label="Health" value={financialInsights.healthLabel} />
        <InsightChip label="Top 3 client share" value={`${financialInsights.topThreeClientShare.toFixed(1)}%`} />
        <InsightChip label="You keep" value={`${Math.max(financialInsights.usableCashRatio, 0).toFixed(1)}%`} />
      </DashboardHero>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard title="Average monthly revenue" value={currency(financialInsights.averageMonthlyRevenue)} subtitle="Average paid revenue across the months currently shown." accent={colours.navy} />
        <MetricCard title="Revenue change" value={`${financialInsights.revenueChangePct >= 0 ? "+" : ""}${financialInsights.revenueChangePct.toFixed(1)}%`} subtitle="Movement versus the previous month." accent={colours.teal} />
        <MetricCard title="Expense ratio" value={`${financialInsights.expenseRatio.toFixed(1)}%`} subtitle="Recorded expenses as a share of paid income." accent={colours.purple} />
        <MetricCard title="Revenue volatility" value={`${financialInsights.averageVolatility.toFixed(1)}%`} subtitle="Average month-to-month movement across recent months." accent={colours.navy} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
          gap: 20,
        }}
      >
        <SectionCard title="Revenue reliability" right={<div style={{ fontSize: 12, color: colours.muted }}>Best, worst, and recent movement</div>}>
          {monthlyFinance.length ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Best month</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: colours.text, marginTop: 6 }}>{financialInsights.bestMonth?.label || "—"}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 6 }}>{currency(financialInsights.bestMonth?.revenue || 0)}</div>
                </div>
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Worst month</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: colours.text, marginTop: 6 }}>{financialInsights.worstMonth?.label || "—"}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 6 }}>{currency(financialInsights.worstMonth?.revenue || 0)}</div>
                </div>
                <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Average invoice</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: colours.text, marginTop: 6 }}>{currency(financialInsights.averageInvoiceValue)}</div>
                  <div style={{ fontSize: 13, color: colours.muted, marginTop: 6 }}>Across all invoices in the portal.</div>
                </div>
              </div>
              {monthlyFinance.map((month, index) => {
                const maxRevenue = Math.max(...monthlyFinance.map((item) => item.revenue), 0);
                const width = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                const previous = index > 0 ? monthlyFinance[index - 1].revenue : 0;
                const change = previous > 0 ? ((month.revenue - previous) / previous) * 100 : 0;
                return (
                  <div key={month.monthKey} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: colours.text }}>{month.label}</div>
                      <div style={{ fontSize: 12, color: colours.muted }}>
                        {index === 0 ? "Starting point" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs prior month`}
                      </div>
                    </div>
                    <div style={{ height: 12, borderRadius: 999, background: colours.bg }}>
                      <div style={{ width: `${Math.max(width, month.revenue ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colours.teal} 0%, ${colours.navy} 100%)` }} />
                    </div>
                    <div style={{ fontSize: 13, color: colours.text }}>{currency(month.revenue)} paid revenue</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: colours.muted }}>Add paid invoices to see revenue reliability insights.</div>
          )}
        </SectionCard>

        <WaterfallCard
          title="Cash efficiency"
          rows={[
            { label: "Paid income", value: totals.paidIncome },
            { label: "Less GST payable", value: -totals.gstPayable },
            { label: "Less tax reserve", value: -totals.estimatedTax },
            { label: "Less expenses", value: -totals.totalExpenses },
            { label: "Safe to spend", value: totals.safeToSpend },
          ]}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        <SectionCard title="Client risk" right={<div style={{ fontSize: 12, color: colours.muted }}>Concentration view</div>}>
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Top client share</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: colours.text, marginTop: 6 }}>{financialInsights.topClientShare.toFixed(1)}%</div>
              </div>
              <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Top 3 clients</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: colours.text, marginTop: 6 }}>{financialInsights.topThreeClientShare.toFixed(1)}%</div>
              </div>
            </div>
            <TrendBarsCard title="Top clients" subtitle="Highest paid revenue contributors" data={clientRevenueRows.slice(0, 4)} valueKey="value" formatValue={(value) => currency(value)} accent={colours.teal} emptyText="No paid client revenue yet." />
          </div>
        </SectionCard>

        <SectionCard title="Expense behaviour" right={<div style={{ fontSize: 12, color: colours.muted }}>Largest categories and recent change</div>}>
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Latest expense move</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: colours.text, marginTop: 6 }}>{`${financialInsights.expenseChangePct >= 0 ? "+" : ""}${financialInsights.expenseChangePct.toFixed(1)}%`}</div>
              </div>
              <div style={{ ...cardStyle, padding: 14, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Largest category</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: colours.text, marginTop: 6 }}>{financialInsights.largestExpenseCategory?.label || "—"}</div>
                <div style={{ fontSize: 13, color: colours.muted, marginTop: 6 }}>{currency(financialInsights.largestExpenseCategory?.value || 0)}</div>
              </div>
            </div>
            <TrendBarsCard title="Expense categories" subtitle="Largest recorded categories" data={expenseCategoryRows.slice(0, 5)} valueKey="value" formatValue={(value) => currency(value)} accent={colours.purple} emptyText="No expenses recorded yet." />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Simple alerts" right={<div style={{ fontSize: 12, color: colours.muted }}>Automatic observations</div>}>
        <div style={{ display: "grid", gap: 12 }}>
          {financialInsights.alerts.map((alert, index) => (
            <div key={index} style={{ ...cardStyle, padding: 14, background: colours.bg, borderLeft: `4px solid ${index === 0 && alert.includes("No immediate") ? colours.teal : colours.purple}` }}>
              <div style={{ fontSize: 14, color: colours.text, lineHeight: 1.6 }}>{alert}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>

}

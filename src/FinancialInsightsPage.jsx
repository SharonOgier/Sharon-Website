import React from "react";

export default function FinancialInsightsPage(props) {
  const {
    profile,
    clients,
    invoices,
    expenses,
    totals,
    invoiceAllocations,
    setActivePage,
    cardStyle,
    colours,
    currency,
    formatDateAU,
    safeNumber,
    DashboardHero,
    InsightChip,
    MetricCard,
    TrendBarsCard,
    WaterfallCard,
    SectionCard
  } = props;
    const reportTitle =
      activeFinancialTile === "profit_loss"
        ? "Statement of Profit or Loss"
        : activeFinancialTile === "cash_movement"
          ? "Cash Movement Statement"
          : activeFinancialTile === "gst_position"
            ? "GST Position Statement"
            : "Revenue Summary Statement";
    const reportSubtitle =
      activeFinancialTile === "profit_loss"
        ? "Prepared from portal activity currently recorded in your invoices and expenses."
        : activeFinancialTile === "cash_movement"
          ? "Prepared from paid invoices, tax reserves, GST balances and recorded expenses."
          : activeFinancialTile === "gst_position"
            ? "Prepared from GST collected on invoices and GST credits recorded on expenses."
            : "Prepared from paid client revenue and recent monthly trends recorded in the portal.";
    const statementRows =
      activeFinancialTile === "profit_loss"
        ? [
            { label: "Income", value: totals.incomeExGst, strong: true },
            { label: "Less: Expenses", value: -totals.totalExpenses },
            { label: "Operating surplus / (deficit)", value: totals.incomeExGst - totals.totalExpenses, strong: true },
            { label: "Less: Estimated tax reserve", value: -totals.estimatedTax },
            { label: "Net result after tax reserve", value: totals.incomeExGst - totals.totalExpenses - totals.estimatedTax, strong: true },
          ]
        : activeFinancialTile === "cash_movement"
          ? [
              { label: "Cash received from paid invoices", value: totals.paidIncome, strong: true },
              { label: "Less: GST payable", value: -totals.gstPayable },
              { label: "Less: Estimated tax reserve", value: -totals.estimatedTax },
              { label: "Less: Platform fees", value: -totals.totalFees },
              { label: "Less: Expenses paid / recorded", value: -totals.totalExpenses },
              { label: `Less: Subscription (${currency(totals.monthlySubscriptionCost)}/mo)`, value: -totals.monthlySubscriptionCost },
              { label: "Closing safe-to-spend balance", value: totals.safeToSpend, strong: true },
            ]
          : activeFinancialTile === "gst_position"
            ? [
                { label: "GST collected on invoices", value: totals.gstCollected, strong: true },
                { label: "Less: GST credits on expenses", value: -totals.gstOnExpenses },
                { label: "Net GST payable / (refundable)", value: totals.gstPayable, strong: true },
              ]
            : [
                { label: "Average monthly paid revenue", value: financialInsights.averageMonthlyRevenue, strong: true },
                { label: "Top client revenue share", value: financialInsights.topClientShare, suffix: "%" },
                { label: "Top three client revenue share", value: financialInsights.topThreeClientShare, suffix: "%" },
                { label: "Revenue volatility", value: financialInsights.averageVolatility, suffix: "%" },
              ];
    const rightColumnRows =
      activeFinancialTile === "profit_loss"
        ? [
            ["Gross invoiced", currency(totals.totalIncome)],
            ["GST collected", currency(totals.gstCollected)],
            ["Income ex GST", currency(totals.incomeExGst)],
            ["Expense ratio", `${financialInsights.expenseRatio.toFixed(1)}%`],
          ]
        : activeFinancialTile === "cash_movement"
          ? [
              ["Paid income", currency(totals.paidIncome)],
              ["GST payable", currency(totals.gstPayable)],
              ["Tax reserve", currency(totals.estimatedTax)],
              ["You keep", `${Math.max(financialInsights.usableCashRatio, 0).toFixed(1)}%`],
            ]
          : activeFinancialTile === "gst_position"
            ? [
                ["GST registration", profile.gstRegistered ? "Registered" : "Not registered"],
                ["GST collected", currency(totals.gstCollected)],
                ["GST credits", currency(totals.gstOnExpenses)],
                ["Net GST", currency(totals.gstPayable)],
              ]
            : [
                ["Average monthly revenue", currency(financialInsights.averageMonthlyRevenue)],
                ["Best month", `${financialInsights.bestMonth?.label || "—"} · ${currency(financialInsights.bestMonth?.revenue || 0)}`],
                ["Worst month", `${financialInsights.worstMonth?.label || "—"} · ${currency(financialInsights.worstMonth?.revenue || 0)}`],
                ["Average invoice", currency(financialInsights.averageInvoiceValue)],
              ];

    return (
    <div style={{ display: "grid", gap: 20 }}>
      <SectionCard title="Financial reports" right={<div style={{ fontSize: 12, color: colours.muted }}>Formal statement style</div>}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <ActionHubCard
            icon="📈"
            title="Profit & loss"
            description="Standard income less expenses style report."
            buttonLabel={activeFinancialTile === "profit_loss" ? "Showing report" : "View report"}
            onClick={() => setActiveFinancialTile("profit_loss")}
            tone={colours.purple}
          />
          <ActionHubCard
            icon="💧"
            title="Cash movement"
            description="Cash in, deductions, and closing usable balance."
            buttonLabel={activeFinancialTile === "cash_movement" ? "Showing report" : "View report"}
            onClick={() => setActiveFinancialTile("cash_movement")}
            tone={colours.teal}
          />
          <ActionHubCard
            icon="🧾"
            title="GST position"
            description="GST collected, GST credits, and net GST result."
            buttonLabel={activeFinancialTile === "gst_position" ? "Showing report" : "View report"}
            onClick={() => setActiveFinancialTile("gst_position")}
            tone={colours.navy}
          />
          <ActionHubCard
            icon="📊"
            title="Revenue summary"
            description="Revenue concentration and consistency summary."
            buttonLabel={activeFinancialTile === "revenue_summary" ? "Showing report" : "View report"}
            onClick={() => setActiveFinancialTile("revenue_summary")}
            tone={colours.purple}
          />
        </div>
      </SectionCard>

      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "28px 30px 20px", borderBottom: `1px solid ${colours.border}`, background: colours.white }}>
          <div style={{ fontSize: 13, letterSpacing: 1.1, textTransform: "uppercase", fontWeight: 800, color: colours.muted }}>
            Financial Statement
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: colours.text, marginTop: 8 }}>{reportTitle}</div>
          <div style={{ fontSize: 14, color: colours.muted, marginTop: 8, lineHeight: 1.7 }}>{reportSubtitle}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 18, fontSize: 13 }}>
            <div><strong>Entity:</strong> {profile.businessName || "Your business"}</div>
            <div><strong>Prepared on:</strong> {formatDateAU(todayLocal())}</div>
            <div><strong>Basis:</strong> Internal portal records</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)", gap: 0 }}>
          <div style={{ padding: "24px 30px 28px", borderRight: `1px solid ${colours.border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0 0 12px", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, color: colours.muted, borderBottom: `1px solid ${colours.border}` }}>Particulars</th>
                  <th style={{ textAlign: "right", padding: "0 0 12px", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, color: colours.muted, borderBottom: `1px solid ${colours.border}` }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {statementRows.map((row) => {
                  const displayValue = row.suffix ? `${safeNumber(row.value).toFixed(1)}${row.suffix}` : currency(row.value);
                  return (
                    <tr key={row.label}>
                      <td style={{ padding: "14px 0", fontSize: 15, fontWeight: row.strong ? 800 : 500, color: colours.text, borderBottom: `1px solid ${colours.border}` }}>{row.label}</td>
                      <td style={{ padding: "14px 0", textAlign: "right", fontSize: 15, fontWeight: row.strong ? 800 : 600, color: colours.text, borderBottom: `1px solid ${colours.border}` }}>{displayValue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 22, fontSize: 13, color: colours.muted, lineHeight: 1.8 }}>
              <strong style={{ color: colours.text }}>Notes:</strong>
              <div>• Figures are generated from the invoices, paid invoices, expenses, GST settings, and client allocations currently stored in the portal.</div>
              {activeFinancialTile === "profit_loss" && <div>• This statement is presented on a management-reporting basis rather than a statutory accounting basis.</div>}
              {activeFinancialTile === "cash_movement" && <div>• Safe-to-spend reflects paid income after GST, estimated tax, fees, expenses, and current subscription cost.</div>}
              {activeFinancialTile === "gst_position" && <div>• GST payable is shown net of GST credits recorded on expenses.</div>}
              {activeFinancialTile === "revenue_summary" && <div>• Client concentration percentages are based on paid revenue currently attributed to each client.</div>}
            </div>
          </div>

          <div style={{ padding: "24px 26px 28px", background: "#FCFCFD" }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 800, color: colours.muted, marginBottom: 14 }}>
              Supporting details
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {rightColumnRows.map(([label, value]) => (
                <div key={label} style={{ paddingBottom: 12, borderBottom: `1px solid ${colours.border}` }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", color: colours.muted, fontWeight: 800 }}>{label}</div>
                  <div style={{ fontSize: 16, color: colours.text, fontWeight: 800, marginTop: 6 }}>{value}</div>
                </div>
              ))}
            </div>

            {activeFinancialTile === "revenue_summary" && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 800, color: colours.muted, marginBottom: 10 }}>
                  Top clients
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {clientRevenueRows.slice(0, 5).map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, color: colours.text }}>
                      <span>{row.label}</span>
                      <strong>{currency(row.value)}</strong>
                    </div>
                  ))}
                  {!clientRevenueRows.length && <div style={{ fontSize: 13, color: colours.muted }}>No paid client revenue yet.</div>}
                </div>
              </div>
            )}

            {activeFinancialTile === "profit_loss" && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 800, color: colours.muted, marginBottom: 10 }}>
                  Largest expense categories
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {expenseCategoryRows.slice(0, 5).map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, color: colours.text }}>
                      <span>{row.label}</span>
                      <strong>{currency(row.value)}</strong>
                    </div>
                  ))}
                  {!expenseCategoryRows.length && <div style={{ fontSize: 13, color: colours.muted }}>No expenses recorded yet.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeFinancialTile === "revenue_summary" && monthlyFinance.length > 0 && (
        <SectionCard title="Monthly revenue schedule" right={<div style={{ fontSize: 12, color: colours.muted }}>Recent paid revenue periods</div>}>
          <DataTable
            columns={[
              { key: "label", label: "Period" },
              { key: "revenue", label: "Paid revenue", render: (v) => currency(v) },
              { key: "expenses", label: "Expenses", render: (v) => currency(v) },
              { key: "safeToSpend", label: "Safe to spend", render: (v) => currency(v) },
            ]}
            rows={monthlyFinance}
          />
        </SectionCard>
      )}

      <SectionCard title="Automatic observations" right={<div style={{ fontSize: 12, color: colours.muted }}>Report commentary</div>}>
        <div style={{ display: "grid", gap: 12 }}>
          {financialInsights.alerts.map((alert, index) => (
            <div key={index} style={{ padding: "14px 16px", border: `1px solid ${colours.border}`, borderRadius: 12, background: colours.white, fontSize: 14, color: colours.text, lineHeight: 1.7 }}>
              {alert}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
    );
    };
}

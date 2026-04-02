import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DashboardPage
// All state and handlers come from SharonPortalWebsite via props.
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage(props) {
  const {
    profile,
    clients,
    invoices,
    quotes,
    expenses,
    documents,
    services,
    totals,
    invoiceAllocations,
    monthlyFinance,
    clientRevenueRows,
    expenseCategoryRows,
    invoiceStatusRows,
    recentActivityRows,
    dashboardInsights,
    financialInsights,
    setActivePage,
    setActiveSettingsTab,
    cardStyle,
    colours,
    currency,
    formatDateAU,
    safeNumber,
    DEFAULT_MONTHLY_SUBSCRIPTION,
    buttonPrimary,
    buttonSecondary,
    inputStyle,
    labelStyle,
    DashboardHero,
    InsightChip,
    MetricCard,
    ActionHubCard,
    TrendBarsCard,
    WaterfallCard,
    ActivityListCard,
    SectionCard,
    DataTable,
    exportToATOForm,
    restorePortalStateFromSupabase,
    saveAllCurrentStateToSupabase,
    supabaseSyncStatus,
    getClientName,
  } = props;

      // ── Onboarding checklist ──────────────────────────────────────
      const onboardingSteps = [
        { label: "Add your business name", done: Boolean(profile.businessName), action: () => { setActivePage("settings"); setActiveSettingsTab("Profile"); } },
        { label: "Add your ABN", done: Boolean(profile.abn), action: () => { setActivePage("settings"); setActiveSettingsTab("Profile"); } },
        { label: "Set your GST registration status", done: Boolean(profile.gstRegistered !== undefined && profile.gstRegistered !== null), action: () => { setActivePage("settings"); setActiveSettingsTab("Financial"); } },
        { label: "Upload your logo", done: Boolean(profile.logoDataUrl), action: () => { setActivePage("settings"); setActiveSettingsTab("Branding"); } },
        { label: "Add your first client", done: clients.length > 0, action: () => setActivePage("invoices") },
        { label: "Create your first invoice", done: invoices.length > 0, action: () => setActivePage("invoices") },
      ];
      const doneCount = onboardingSteps.filter((s) => s.done).length;
      const allDone = doneCount === onboardingSteps.length;
      const pct = Math.round((doneCount / onboardingSteps.length) * 100);

      return (
    <div style={{ display: "grid", gap: 20 }}>
      {!allDone && (
        <div style={{ ...cardStyle, padding: 24, background: "linear-gradient(135deg, #F5ECFB 0%, #EDE9FE 100%)", border: "1px solid #E9D5FF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: colours.purple, marginBottom: 4 }}>🚀 Get started — {doneCount} of {onboardingSteps.length} complete</div>
              <div style={{ fontSize: 13, color: colours.muted }}>Complete these steps to get the most out of your portal</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: colours.purple }}>{pct}%</div>
              <div style={{ fontSize: 11, color: colours.muted }}>set up</div>
            </div>
          </div>
          <div style={{ background: "#E9D5FF", borderRadius: 99, height: 8, marginBottom: 20 }}>
            <div style={{ background: colours.purple, borderRadius: 99, height: 8, width: pct + "%", transition: "width 0.4s ease" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            {onboardingSteps.map((step, i) => (
              <div key={i} onClick={step.done ? undefined : step.action}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10,
                  background: step.done ? "#F0FDF4" : "#fff",
                  border: "1px solid " + (step.done ? "#BBF7D0" : "#E9D5FF"),
                  cursor: step.done ? "default" : "pointer",
                  opacity: step.done ? 0.8 : 1 }}>
                <div style={{ fontSize: 18, flexShrink: 0 }}>{step.done ? "✅" : "⬜"}</div>
                <div style={{ fontSize: 13, fontWeight: step.done ? 400 : 600, color: step.done ? "#166534" : colours.text,
                  textDecoration: step.done ? "line-through" : "none" }}>{step.label}</div>
                {!step.done && <div style={{ marginLeft: "auto", fontSize: 11, color: colours.purple, fontWeight: 700, flexShrink: 0 }}>Go →</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {allDone && (
        <div style={{ ...cardStyle, padding: 18, background: "#F0FDF4", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 28 }}>🎉</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#166534" }}>You're all set up!</div>
            <div style={{ fontSize: 13, color: "#166534", marginTop: 2 }}>Your portal is fully configured and ready to use.</div>
          </div>
        </div>
      )}
      <DashboardHero
        title={profile.businessName || "My Portal"}
        subtitle="Start with the actions you use most. This home view keeps invoices, quotes, expenses and financial performance in one place so you can move quickly without hunting through the portal."
        highlight={currency(totals.safeToSpend)}
      >
        <InsightChip label="Collection rate" value={`${dashboardInsights.collectionRate.toFixed(1)}%`} />
        <InsightChip label="Subscription/mo" value={currency(totals.monthlySubscriptionCost)} />
        <InsightChip label="Safe to spend" value={currency(totals.safeToSpend)} />
      </DashboardHero>

      <SectionCard title="Action hub" right={<div style={{ fontSize: 12, color: colours.muted }}>Most-used tasks first</div>}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <ActionHubCard
            icon="🧾"
            title="Create invoice"
            description="Generate a new invoice quickly and move straight into the invoice workspace."
            buttonLabel="Open invoices"
            onClick={() => setActivePage("invoices")}
            tone={colours.purple}
          />
          <ActionHubCard
            icon="💬"
            title="Create quote"
            description="Prepare a quote for a client and convert it later when work is approved."
            buttonLabel="Open quotes"
            onClick={() => setActivePage("quotes")}
            tone={colours.teal}
          />
          <ActionHubCard
            icon="💸"
            title="Add expense"
            description="Capture a business expense, upload the receipt and keep your records current."
            buttonLabel="Open expenses"
            onClick={() => setActivePage("expenses")}
            tone={colours.navy}
          />
          <ActionHubCard
            icon="📊"
            title="View insights"
            description="Review cash flow, margins, tax reserves and other performance signals."
            buttonLabel="Open insights"
            onClick={() => setActivePage("financial insights")}
            tone={colours.purple}
          />
        </div>
      </SectionCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard title="Gross invoiced" value={currency(totals.totalIncome)} subtitle="All invoice values currently stored in the portal." accent={colours.navy} />
        <MetricCard title="Gross paid" value={currency(totals.paidIncome)} subtitle="Cash received from invoices marked Paid." accent={colours.teal} />
        <MetricCard title="GST payable" value={currency(totals.gstPayable)} subtitle={`Sales GST ${currency(totals.gstCollected)} less expense credits ${currency(totals.gstOnExpenses)}.`} accent={colours.purple} />
        <MetricCard title="Estimated tax reserve" value={currency(totals.estimatedTax)} subtitle="Set aside based on paid income excluding GST." accent={colours.navy} />
        <MetricCard title="Portal subscription" value={currency(totals.monthlySubscriptionCost)} subtitle={`$${safeNumber(profile.monthlySubscription ?? DEFAULT_MONTHLY_SUBSCRIPTION)}/mo — set in Settings → Financial.`} accent={colours.purple} />
        <MetricCard title="Safe to spend" value={currency(totals.safeToSpend)} subtitle={`After GST, tax, fees, expenses & $${safeNumber(profile.monthlySubscription ?? DEFAULT_MONTHLY_SUBSCRIPTION)}/mo subscription.`} accent={colours.teal} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
          gap: 20,
        }}
      >
        <SectionCard title="Monthly financial momentum" right={<div style={{ fontSize: 12, color: colours.muted }}>Latest 6 months</div>}>
          {monthlyFinance.length ? (
            <div style={{ display: "grid", gap: 16 }}>
              {monthlyFinance.map((month) => {
                const maxValue = Math.max(...monthlyFinance.map((item) => Math.max(item.revenue, item.expenses, Math.abs(item.net))), 0);
                const revenueWidth = maxValue > 0 ? (month.revenue / maxValue) * 100 : 0;
                const expenseWidth = maxValue > 0 ? (month.expenses / maxValue) * 100 : 0;
                const netWidth = maxValue > 0 ? (Math.abs(month.net) / maxValue) * 100 : 0;
                return (
                  <div key={month.monthKey} style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: colours.text }}>{month.label}</div>
                      <div style={{ fontSize: 12, color: colours.muted }}>Net {currency(month.net)}</div>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colours.muted, marginBottom: 6 }}><span>Revenue</span><span>{currency(month.revenue)}</span></div>
                        <div style={{ height: 12, borderRadius: 999, background: colours.bg }}><div style={{ width: `${Math.max(revenueWidth, month.revenue ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colours.teal} 0%, ${colours.navy} 100%)` }} /></div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colours.muted, marginBottom: 6 }}><span>Expenses</span><span>{currency(month.expenses)}</span></div>
                        <div style={{ height: 12, borderRadius: 999, background: colours.bg }}><div style={{ width: `${Math.max(expenseWidth, month.expenses ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colours.purple} 0%, #C084FC 100%)` }} /></div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colours.muted, marginBottom: 6 }}><span>Net position</span><span>{currency(month.net)}</span></div>
                        <div style={{ height: 12, borderRadius: 999, background: colours.bg }}><div style={{ width: `${Math.max(netWidth, month.net ? 8 : 0)}%`, height: "100%", borderRadius: 999, background: month.net >= 0 ? `linear-gradient(90deg, ${colours.teal} 0%, ${colours.purple} 100%)` : `linear-gradient(90deg, #F59E0B 0%, ${colours.purple} 100%)` }} /></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: colours.muted }}>Add paid invoices and expenses to unlock the monthly trend view.</div>
          )}
        </SectionCard>

        <WaterfallCard
          title="Cash movement"
          rows={[
            { label: "Paid income", value: totals.paidIncome },
            { label: "Less GST payable", value: -totals.gstPayable },
            { label: "Less estimated tax", value: -totals.estimatedTax },
            { label: "Less platform fees", value: -totals.totalFees },
            { label: "Less expenses", value: -totals.totalExpenses },
            { label: `Less subscription (${currency(totals.monthlySubscriptionCost)}/mo)`, value: -totals.monthlySubscriptionCost },
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
        <TrendBarsCard title="Top clients by paid revenue" subtitle="Based on invoices marked Paid" data={clientRevenueRows} valueKey="value" formatValue={(value) => currency(value)} accent={colours.teal} emptyText="No paid invoices yet." />
        <TrendBarsCard title="Expense categories" subtitle="Largest categories from recorded expenses" data={expenseCategoryRows} valueKey="value" formatValue={(value) => currency(value)} accent={colours.purple} emptyText="No expenses recorded yet." />
        <TrendBarsCard title="Invoice status mix" subtitle="A quick collections snapshot" data={invoiceStatusRows} valueKey="value" formatValue={(value) => `${value} item${value === 1 ? "" : "s"}`} accent={colours.navy} emptyText="No invoices yet." />
      </div>

      <SectionCard title="Financial reports" right={<div style={{ fontSize: 12, color: colours.muted }}>Tap any report to open it</div>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <ActionHubCard
            icon="📈"
            title="Profit & loss"
            description="Income less expenses — operating surplus or deficit after tax reserve."
            buttonLabel="View report"
            onClick={() => setActivePage("financial insights")}
            tone={colours.purple}
          />
          <ActionHubCard
            icon="💧"
            title="Cash movement"
            description="Cash received, GST deducted, tax reserved, fees and closing safe-to-spend."
            buttonLabel="View report"
            onClick={() => setActivePage("financial insights")}
            tone={colours.teal}
          />
          <ActionHubCard
            icon="🧾"
            title="GST position"
            description="GST collected on invoices less GST credits on expenses — net amount owing."
            buttonLabel="View report"
            onClick={() => setActivePage("financial insights")}
            tone={colours.navy}
          />
          <ActionHubCard
            icon="📊"
            title="Revenue summary"
            description="Client concentration, best and worst months, revenue volatility."
            buttonLabel="View report"
            onClick={() => setActivePage("financial insights")}
            tone={colours.purple}
          />
        </div>
      </SectionCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
          gap: 20,
        }}
      >
        <SectionCard title="Reporting actions" right={<div style={{ fontSize: 12, color: colours.muted }}>Use the same SaaS data everywhere</div>}>
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              <div style={{ ...cardStyle, padding: 16, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>ATO export</div>
                <div style={{ fontSize: 14, color: colours.text, lineHeight: 1.6, marginTop: 8 }}>Send paid invoice and expense data straight into the tax form page with the current portal records.</div>
                <button style={{ ...buttonPrimary, marginTop: 14 }} onClick={exportToATOForm}>Export to ATO Tax Form</button>
              </div>
              <div style={{ ...cardStyle, padding: 16, background: colours.bg }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: colours.muted }}>Supabase sync</div>
                <div style={{ fontSize: 14, color: colours.text, lineHeight: 1.6, marginTop: 8 }}>Your dashboard reflects the same SaaS entities already saved in Supabase: invoices, expenses, clients, services, income sources, and documents.</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <button style={buttonSecondary} onClick={restorePortalStateFromSupabase}>Load from Supabase DB</button>
                  <button style={buttonPrimary} onClick={() => saveAllCurrentStateToSupabase()}>Save to Supabase DB</button>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: colours.muted, lineHeight: 1.6 }}>
              Status: {supabaseSyncStatus}
            </div>
          </div>
        </SectionCard>

        <ActivityListCard title="Recent activity" rows={recentActivityRows} />
      </div>

      <SectionCard title="Paid invoice allocation detail" right={<div style={{ fontSize: 12, color: colours.muted }}>Live from invoices marked Paid</div>}>
        <DataTable
          columns={[
            { key: "invoiceNumber", label: "Invoice" },
            { key: "clientId", label: "Client", render: (_, row) => getClientName(row.clientId) },
            { key: "gross", label: "Paid", render: (v) => currency(v) },
            { key: "gst", label: "GST", render: (v) => currency(v) },
            { key: "estimatedTax", label: "Tax", render: (v) => currency(v) },
            { key: "fee", label: "Fee", render: (v) => currency(v) },
            { key: "netAvailable", label: "Net", render: (v) => currency(v) },
          ]}
          rows={invoiceAllocations}
        />
      </SectionCard>
    </div>
      );

}

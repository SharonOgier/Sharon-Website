import React from "react";
import { buttonPrimary } from "./PortalHelpers";

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
    cardStyle = {},
    colours = {},
    currency = (v) => v,
    formatDateAU = (v) => v,
    safeNumber = (v) => Number(v || 0),
    DEFAULT_MONTHLY_SUBSCRIPTION,
    DashboardHero,
    InsightChip,
    MetricCard,
    SectionCard,
    setActivePage = () => {},
  } = props;
      // ── GST registration check ──────────────────────────────────
      if (!profile.gstRegistered) {
        return (
          <div style={{ display: "grid", gap: 20 }}>
            <DashboardHero title="BAS Report" subtitle="Business Activity Statement preparation for ATO lodgement." highlight="N/A" />
            <div style={{ ...cardStyle, padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: colours.text, marginBottom: 10 }}>GST Registration Required</div>
              <div style={{ fontSize: 14, color: colours.muted, lineHeight: 1.7, maxWidth: 400, margin: "0 auto 24px" }}>
                This business is not marked as GST registered. BAS reports only apply to GST-registered businesses.
              </div>
              <button style={buttonPrimary} onClick={() => setActivePage("settings")}>Go to Settings → Financial</button>
            </div>
          </div>
        );
      }

      // ── Quarter helpers ─────────────────────────────────────────
      const now = new Date();
      const quarters = [];
      for (let i = 0; i < 8; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
        const qMonth = d.getMonth();
        const qYear = d.getFullYear();
        const atoQ = qMonth >= 6 && qMonth <= 8 ? 1 : qMonth >= 9 && qMonth <= 11 ? 2 : qMonth >= 0 && qMonth <= 2 ? 3 : 4;
        const atoYear = qMonth >= 6 ? qYear : qYear - 1;
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const endMonthIdx = (qMonth + 2) % 12;
        const endYear = qMonth + 2 > 11 ? qYear + 1 : qYear;
        const label = `Q${atoQ} ${atoYear}/${String(atoYear+1).slice(2)} (${months[qMonth]}–${months[endMonthIdx]} ${endYear})`;
        const startDate = `${qYear}-${String(qMonth+1).padStart(2,"0")}-01`;
        const endDay = new Date(endYear, endMonthIdx+1, 0).getDate();
        const endDate = `${endYear}-${String(endMonthIdx+1).padStart(2,"0")}-${endDay}`;
        quarters.push({ label, startDate, endDate, key: `${atoYear}-Q${atoQ}` });
      }

      const qIdx = parseInt(basQuarter) || 0;
      const selectedQ = quarters[qIdx] || quarters[0];
      const { startDate, endDate } = selectedQ;
      const inRange = (d) => d && d >= startDate && d <= endDate;

      // ── Filter data ─────────────────────────────────────────────
      const qInvoices = invoices.filter((inv) => inv.type !== "credit_note" && inRange(inv.invoiceDate));
      const qCreditNotes = invoices.filter((inv) => inv.type === "credit_note" && inRange(inv.invoiceDate));
      const qExpenses = expenses.filter((exp) => exp.type !== "credit_note" && inRange(exp.date));

      // ── Simpler BAS (turnover < $10M — default for small business) ──
      // Full BAS adds G2, G3, G10, G11 — Simpler BAS only needs G1, 1A, 1B
      const isSimpler = safeNumber(profile.annualTurnover || 0) < 10000000 || !profile.annualTurnover;

      // ── G fields ────────────────────────────────────────────────
      // G1: Total sales including GST
      const g1 = qInvoices.reduce((s, inv) => s + safeNumber(inv.total), 0) + qCreditNotes.reduce((s, cn) => s + safeNumber(cn.total), 0);
      // G2: Export sales (GST-free exports) — manual entry
      const g2 = 0;
      // G3: Other GST-free sales — manual entry
      const g3 = 0;
      // G4 = G2 + G3
      const g4 = g2 + g3;
      // G5 = G1 - G4 (sales subject to GST)
      const g5 = g1 - g4;
      // G6 = G5 / 11 (GST on sales)
      const g6 = g5 / 11;
      // G10: Capital purchases (assets > $1000) — from expenses tagged as capital
      const g10 = qExpenses.filter((e) => e.category === "Capital equipment" || e.category === "Vehicle" || e.isCapital).reduce((s, e) => s + safeNumber(e.amount), 0);
      // G11: Non-capital purchases — all other expenses
      const g11 = qExpenses.filter((e) => e.category !== "Capital equipment" && e.category !== "Vehicle" && !e.isCapital).reduce((s, e) => s + safeNumber(e.amount), 0);

      // ── 1A: GST on sales ─────────────────────────────────────────
      const field1A = qInvoices.reduce((s, inv) => {
        const al = invoiceAllocations.find((a) => String(a.id) === String(inv.id));
        return s + (al ? al.gst : 0);
      }, 0) + qCreditNotes.reduce((s, cn) => s + safeNumber(cn.total) / 11, 0);

      // ── 1B: GST credits on purchases ─────────────────────────────
      const field1B = qExpenses.reduce((s, ex) => s + safeNumber(ex.gst), 0);

      // ── PAYG Withholding ──────────────────────────────────────────
      const w1 = qInvoices.reduce((s, inv) => {
        const al = invoiceAllocations.find((a) => String(a.id) === String(inv.id));
        return s + (al ? al.taxWithheld : 0);
      }, 0);
      const w2 = w1; // amounts withheld from W1
      const w3 = 0;  // withholding from investment distributions
      const w4 = 0;  // other withholding (no ABN etc)
      const w5 = w2 + w4 + w3; // total withheld (NOT including W1)

      // ── PAYG Income Tax Instalment ────────────────────────────────
      const t1 = qInvoices.reduce((s, inv) => {
        const al = invoiceAllocations.find((a) => String(a.id) === String(inv.id));
        return s + (al ? al.estimatedTax : 0);
      }, 0);

      // ── Summary ───────────────────────────────────────────────────
      // 8A = 1A + W5 + F4 + 1E + 1C + 7C (total amount owed)
      const field8A = field1A + w5;
      // 8B = 1B + 7D + 1D + 1F (total credits)
      const field8B = field1B;
      // Net = 8A - 8B (positive = pay ATO, negative = refund)
      const net9 = field8A - field8B;

      // ── Checklist items ─────────────────────────────────────────
      const checklist = [
        { label: "All invoices for the period have been entered", check: qInvoices.length > 0 },
        { label: "All expense receipts have been recorded", check: qExpenses.length > 0 },
        { label: "GST amounts on invoices look correct", check: field1A > 0 },
        { label: "GST credits on purchases look correct", check: field1B >= 0 },
        { label: "Business name and ABN are in Settings", check: Boolean(profile.businessName && profile.abn) },
        { label: "Lodgement date and reference recorded below", check: Boolean(basNotes.lodgedDate && basNotes.referenceNumber) },
      ];

      // ── Download ATO-formatted CSV ────────────────────────────────
      const downloadATOCSV = () => {
        const fmt = (val) => Math.round(val).toString(); // ATO uses whole dollars
        const rows = [
          ["ATO BUSINESS ACTIVITY STATEMENT"],
          [""],
          ["BUSINESS DETAILS"],
          ["Business Name", profile.businessName || ""],
          ["ABN", profile.abn || ""],
          ["Period", selectedQ.label],
          ["From", formatDateAU(startDate)],
          ["To", formatDateAU(endDate)],
          ["Reporting Method", isSimpler ? "Simpler BAS" : "Full BAS"],
          [""],
          ["SECTION G — GST ON SALES"],
          ["Label", "Description", "Amount ($)"],
          ["G1", "Total sales (including GST)", fmt(g1)],
          ...(!isSimpler ? [
            ["G2", "Export sales (GST-free exports)", fmt(g2)],
            ["G3", "Other GST-free sales", fmt(g3)],
            ["G4", "G2 + G3", fmt(g4)],
            ["G5", "Total sales subject to GST (G1 − G4)", fmt(g5)],
            ["G6", "GST on sales (G5 ÷ 11)", fmt(g6)],
          ] : []),
          ["1A", "GST on sales (amount to pay ATO)", fmt(field1A)],
          [""],
          ["SECTION P — GST CREDITS ON PURCHASES"],
          ["Label", "Description", "Amount ($)"],
          ...(!isSimpler ? [
            ["G10", "Capital purchases (incl GST)", fmt(g10)],
            ["G11", "Non-capital purchases (incl GST)", fmt(g11)],
          ] : []),
          ["1B", "GST credits on purchases", fmt(field1B)],
          [""],
          ["PAYG WITHHOLDING"],
          ["Label", "Description", "Amount ($)"],
          ["W1", "Total salary wages and other payments", fmt(w1)],
          ["W2", "Amount withheld from W1", fmt(w2)],
          ["W3", "Amounts withheld from investment distributions", fmt(w3)],
          ["W4", "Amounts withheld where no ABN quoted", fmt(w4)],
          ["W5", "Total amounts withheld (W2 + W4 + W3)", fmt(w5)],
          [""],
          ["PAYG INCOME TAX INSTALMENT"],
          ["Label", "Description", "Amount ($)"],
          ["T1", "Instalment income / estimated tax reserve", fmt(t1)],
          [""],
          ["SUMMARY"],
          ["Label", "Description", "Amount ($)"],
          ["8A", "Total amounts you owe (1A + W5)", fmt(field8A)],
          ["8B", "Total credits (1B)", fmt(field8B)],
          ["9", net9 >= 0 ? "Net amount owing to ATO (8A − 8B)" : "Net refund from ATO (8B − 8A)", fmt(Math.abs(net9))],
          ["", net9 >= 0 ? "YOU OWE THE ATO" : "ATO OWES YOU (REFUND)", ""],
          [""],
          ["LODGEMENT RECORD"],
          ["Date Lodged", basNotes.lodgedDate ? formatDateAU(basNotes.lodgedDate) : "Not yet lodged"],
          ["ATO Reference Number", basNotes.referenceNumber || ""],
          ["Notes", basNotes.notes || ""],
          [""],
          ["DISCLAIMER"],
          ["This report is a guide only. Always verify with your registered tax agent before lodging with the ATO."],
        ];
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `BAS_${selectedQ.key}_${profile.businessName || "report"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      };

      // ── Print ───────────────────────────────────────────────────
      const printBAS = () => {
        const fmt = (val) => `$${Math.round(val).toLocaleString("en-AU")}`;
        const win = window.open("", "_blank");
        win.document.write(`
          <html><head><title>BAS — ${selectedQ.label} — ${profile.businessName || ""}</title>
          <style>
            body{font-family:'Helvetica Neue',Arial,sans-serif;padding:40px;color:#14202B;max-width:800px;margin:0 auto;}
            h1{font-size:24px;font-weight:900;margin-bottom:4px;}
            .subtitle{color:#64748B;font-size:14px;margin-bottom:32px;}
            h2{font-size:14px;font-weight:800;text-transform:uppercase;color:#6A1B9A;margin:28px 0 10px;border-bottom:2px solid #E9D5FF;padding-bottom:6px;}
            table{width:100%;border-collapse:collapse;margin-bottom:8px;}
            td{padding:9px 12px;font-size:14px;border-bottom:1px solid #F1F5F9;}
            td:first-child{color:#475569;width:60px;font-weight:700;}
            td:nth-child(2){color:#14202B;}
            td:last-child{text-align:right;font-weight:700;width:120px;}
            .highlight td{background:#F5ECFB;}
            .total td{background:#14202B;color:#fff!important;font-size:16px;font-weight:900;}
            .total td:last-child{color:#A78BFA!important;}
            .owe td{background:#FEF2F2;} .owe td:last-child{color:#991B1B!important;}
            .refund td{background:#F0FDF4;} .refund td:last-child{color:#166534!important;}
            .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:28px;font-size:13px;}
            .meta div{background:#F8FAFC;padding:10px 14px;border-radius:8px;}
            .meta strong{display:block;color:#64748B;font-size:11px;text-transform:uppercase;margin-bottom:2px;}
            .disclaimer{background:#FFFBEB;border:1px solid #FDE68A;padding:14px;border-radius:8px;font-size:12px;color:#92400E;margin-top:28px;}
            @media print{body{padding:20px;}}
          </style></head><body>
          <h1>Business Activity Statement</h1>
          <div class="subtitle">${isSimpler ? "Simpler BAS" : "Full BAS"} — Prepared by ${profile.businessName || ""}</div>
          <div class="meta">
            <div><strong>Business</strong>${profile.businessName || "—"}</div>
            <div><strong>ABN</strong>${profile.abn || "—"}</div>
            <div><strong>Period</strong>${selectedQ.label}</div>
            <div><strong>Dates</strong>${formatDateAU(startDate)} – ${formatDateAU(endDate)}</div>
            ${basNotes.lodgedDate ? "<div><strong>Lodged</strong>" + formatDateAU(basNotes.lodgedDate) + "</div><div><strong>ATO Ref</strong>" + (basNotes.referenceNumber || "—") + "</div>" : ""}
          </div>

          <h2>Section G — GST on Sales</h2>
          <table>
            <tr><td>G1</td><td>Total sales including GST</td><td>${fmt(g1)}</td></tr>
            ${!isSimpler ? "<tr><td>G2</td><td>Export sales (GST-free)</td><td>" + fmt(g2) + "</td></tr><tr><td>G3</td><td>Other GST-free sales</td><td>" + fmt(g3) + "</td></tr><tr><td>G5</td><td>Sales subject to GST (G1 \u2212 G4)</td><td>" + fmt(g5) + "</td></tr><tr><td>G6</td><td>GST on sales (G5 \u00f711)</td><td>" + fmt(g6) + "</td></tr>" : ""}
            <tr class="highlight"><td>1A</td><td><strong>GST on sales — amount to pay ATO</strong></td><td>${fmt(field1A)}</td></tr>
          </table>

          <h2>Section P — GST Credits on Purchases</h2>
          <table>
            ${!isSimpler ? "<tr><td>G10</td><td>Capital purchases (incl GST)</td><td>" + fmt(g10) + "</td></tr><tr><td>G11</td><td>Non-capital purchases (incl GST)</td><td>" + fmt(g11) + "</td></tr>" : ""}
            <tr class="highlight"><td>1B</td><td><strong>GST credits on purchases</strong></td><td>${fmt(field1B)}</td></tr>
          </table>

          <h2>PAYG Withholding</h2>
          <table>
            <tr><td>W1</td><td>Total salary, wages and other payments</td><td>${fmt(w1)}</td></tr>
            <tr><td>W2</td><td>Amounts withheld from W1</td><td>${fmt(w2)}</td></tr>
            <tr class="highlight"><td>W5</td><td><strong>Total amounts withheld (W2 + W4 + W3)</strong></td><td>${fmt(w5)}</td></tr>
          </table>

          <h2>PAYG Income Tax Instalment</h2>
          <table>
            <tr><td>T1</td><td>Instalment income / estimated tax reserve</td><td>${fmt(t1)}</td></tr>
          </table>

          <h2>Summary</h2>
          <table>
            <tr><td>8A</td><td>Total you owe ATO (1A + W5)</td><td>${fmt(field8A)}</td></tr>
            <tr><td>8B</td><td>Total credits (1B)</td><td>${fmt(field8B)}</td></tr>
            <tr class="${net9 >= 0 ? "owe" : "refund"}"><td>9</td><td><strong>${net9 >= 0 ? "Net amount OWING to ATO" : "Net REFUND from ATO"}</strong></td><td>${fmt(Math.abs(net9))}</td></tr>
          </table>

          ${basNotes.notes ? "<p style=\"margin-top:20px;font-size:13px;color:#475569;\"><strong>Notes:</strong> " + basNotes.notes + "</p>" : ""}
          <div class="disclaimer">⚠️ This report is a guide only based on data entered in the portal. Always verify with your registered tax agent or BAS agent before lodging with the ATO. This report does not lodge directly with the ATO — use ATO Business Portal or your tax agent software to lodge.</div>
          </body></html>
        `);
        win.document.close();
        win.print();
      };

      return (
        <div style={{ display: "grid", gap: 20 }}>
          <DashboardHero title="BAS Report" subtitle={"Business Activity Statement — " + (profile.businessName || "") + ". " + (isSimpler ? "Simpler BAS" : "Full BAS") + " · Use this to prepare your ATO lodgement."} highlight={net9 >= 0 ? currency(net9) : "Refund " + currency(Math.abs(net9))}>
            <InsightChip label={net9 >= 0 ? "GST owing" : "GST refund"} value={currency(Math.abs(net9))} />
            <InsightChip label="1A sales GST" value={currency(field1A)} />
            <InsightChip label="1B credits" value={currency(field1B)} />
          </DashboardHero>

          {/* Note about CSV */}
          <div style={{ ...cardStyle, padding: 14, background: colours.lightPurple, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 20 }}>💡</div>
            <div style={{ fontSize: 13, color: colours.text, lineHeight: 1.6 }}>
              <strong>How to use the CSV:</strong> Download the ATO-formatted CSV below, open it, then copy each field value directly into the <strong>ATO Business Portal</strong> or your tax agent software. The labels (G1, 1A, 1B, W1 etc) match exactly what the ATO form shows.
              {isSimpler && <span style={{ color: colours.purple }}> Using <strong>Simpler BAS</strong> — only G1, 1A and 1B are required for businesses under $10M turnover.</span>}
            </div>
          </div>

          {/* Quarter selector + actions */}
          <SectionCard title="Select BAS Period" right={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={buttonSecondary} onClick={printBAS}>🖨 Print / PDF</button>
              <button style={buttonPrimary} onClick={downloadATOCSV}>⬇ Download ATO CSV</button>
            </div>
          }>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {quarters.map((q, i) => (
                <button key={q.key} onClick={() => setBasQuarter(String(i))}
                  style={{ ...cardStyle, padding: 14, textAlign: "left", cursor: "pointer", border: `2px solid ${qIdx === i ? colours.purple : colours.border}`, background: qIdx === i ? colours.lightPurple : colours.white }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: colours.purple }}>{q.label}</div>
                  <div style={{ fontSize: 12, color: colours.muted, marginTop: 4 }}>{formatDateAU(q.startDate)} – {formatDateAU(q.endDate)}</div>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Checklist */}
          <SectionCard title="Pre-Lodgement Checklist">
            <div style={{ display: "grid", gap: 10 }}>
              {checklist.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: item.check ? "#F0FDF4" : "#FFF7ED", border: `1px solid ${item.check ? "#BBF7D0" : "#FED7AA"}` }}>
                  <div style={{ fontSize: 18 }}>{item.check ? "✅" : "⬜"}</div>
                  <div style={{ fontSize: 14, color: item.check ? "#166534" : "#92400E", fontWeight: item.check ? 400 : 600 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Key metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <MetricCard title="1A — GST on sales" value={currency(field1A)} subtitle="GST collected from invoices this period." accent={colours.purple} />
            <MetricCard title="1B — GST credits" value={currency(field1B)} subtitle="GST paid on expenses and bills." accent={colours.teal} />
            <MetricCard title="Net GST" value={currency(Math.abs(net9))} subtitle={net9 >= 0 ? "Amount owing to ATO" : "Refund from ATO"} accent={net9 >= 0 ? colours.navy : colours.teal} />
            <MetricCard title="W1 — PAYG withheld" value={currency(w1)} subtitle="Withheld from contractor payments." accent={colours.navy} />
          </div>

          {/* Section G */}
          <SectionCard title="Section G — GST on Sales (1A)">
            <div style={{ fontSize: 13, color: colours.muted, marginBottom: 16 }}>GST collected from clients this period — {qInvoices.length} invoice{qInvoices.length !== 1 ? "s" : ""}. {isSimpler && <span style={{ color: colours.purple, fontWeight: 700 }}>Simpler BAS — only G1 and 1A required.</span>}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {[
                { label: "G1 — Total sales including GST", value: g1, note: "Does this include GST? Yes" },
                !isSimpler && { label: "G2 — Export sales (GST-free exports)", value: g2 },
                !isSimpler && { label: "G3 — Other GST-free sales", value: g3 },
                !isSimpler && { label: "G4 — G2 + G3", value: g4 },
                !isSimpler && { label: "G5 — Sales subject to GST (G1 − G4)", value: g5 },
                !isSimpler && { label: "G6 — GST on sales (G5 ÷ 11)", value: g6 },
                { label: "1A — GST on sales (enter this in ATO portal)", value: field1A, highlight: true },
              ].filter(Boolean).map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: row.highlight ? colours.lightPurple : i % 2 === 0 ? colours.bg : colours.white, fontSize: 14 }}>
                  <span style={{ fontWeight: row.highlight ? 800 : 400 }}>{row.label}{row.note && <span style={{ fontSize: 12, color: colours.muted, marginLeft: 8 }}>({row.note})</span>}</span>
                  <strong style={{ color: row.highlight ? colours.purple : colours.text }}>{currency(row.value)}</strong>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Section P */}
          <SectionCard title="Section P — GST Credits (1B)">
            <div style={{ fontSize: 13, color: colours.muted, marginBottom: 16 }}>
              GST credits claimable on purchases this period — {qExpenses.length} expense{qExpenses.length !== 1 ? "s" : ""}.
              {!isSimpler && <span style={{ marginLeft: 8 }}>G10 (capital) = {currency(g10)} · G11 (non-capital) = {currency(g11)}</span>}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {qExpenses.filter((e) => safeNumber(e.gst) > 0).slice(0, 8).map((exp, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderRadius: 8, background: i % 2 === 0 ? colours.bg : colours.white, fontSize: 13 }}>
                  <span>{exp.supplier || exp.description || "Expense"} <span style={{ color: colours.muted }}>· {formatDateAU(exp.date)}</span></span>
                  <span style={{ color: colours.teal, fontWeight: 700 }}>{currency(safeNumber(exp.gst))}</span>
                </div>
              ))}
              {qExpenses.filter((e) => safeNumber(e.gst) > 0).length === 0 && (
                <div style={{ padding: "10px 14px", fontSize: 13, color: colours.muted }}>No GST credits for this period.</div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: colours.lightTeal, fontSize: 14, marginTop: 4 }}>
                <strong>1B — Total GST credits</strong>
                <strong style={{ color: colours.teal }}>{currency(field1B)}</strong>
              </div>
            </div>
          </SectionCard>

          {/* Net GST */}
          <SectionCard title="Net GST Summary">
            <div style={{ display: "grid", gap: 6 }}>
              {[
                { label: "1A — GST on sales", value: field1A },
                { label: "1B — GST credits", value: -field1B },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: i % 2 === 0 ? colours.bg : colours.white, fontSize: 14 }}>
                  <span>{row.label}</span>
                  <strong>{row.value < 0 ? "(" + currency(Math.abs(row.value)) + ")" : currency(row.value)}</strong>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, fontSize: 17, fontWeight: 800, marginTop: 4, background: net9 >= 0 ? "#FEF2F2" : "#F0FDF4", color: net9 >= 0 ? "#991B1B" : "#166534" }}>
                <span>{net9 >= 0 ? "💸 GST owing to ATO" : "✅ GST refund from ATO"}</span>
                <span>{currency(Math.abs(net9))}</span>
              </div>
            </div>
          </SectionCard>

          {/* PAYG */}
          <SectionCard title="PAYG Withholding & Income Tax Instalment">
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: colours.lightPurple, fontSize: 14 }}>
                <strong>W1 — Total PAYG withheld</strong><strong style={{ color: colours.purple }}>{currency(w1)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: colours.bg, fontSize: 14 }}>
                <strong>T1 — Estimated income tax instalment</strong><strong>{currency(t1)}</strong>
              </div>
            </div>
          </SectionCard>

          {/* Lodgement notes */}
          <SectionCard title="Lodgement Record">
            <div style={{ fontSize: 13, color: colours.muted, marginBottom: 16 }}>Record the lodgement details once you've submitted this BAS to the ATO.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Date Lodged</label>
                <input type="date" style={inputStyle} value={basNotes.lodgedDate}
                  onChange={(e) => setBasNotes((p) => ({ ...p, lodgedDate: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>ATO Reference Number</label>
                <input style={inputStyle} value={basNotes.referenceNumber}
                  onChange={(e) => setBasNotes((p) => ({ ...p, referenceNumber: e.target.value }))}
                  placeholder="e.g. 12345678" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={basNotes.notes}
                onChange={(e) => setBasNotes((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Any notes for your records..." />
            </div>
          </SectionCard>

          {/* Disclaimer */}
          <div style={{ ...cardStyle, padding: 16, background: "#FFFBEB", border: `1px solid #FDE68A` }}>
            <div style={{ fontSize: 13, color: "#92400E", lineHeight: 1.7 }}>
              <strong>⚠️ Important:</strong> This BAS report is a guide only based on data entered in the portal. Always review carefully before lodging with the ATO. This software does not lodge BAS directly — lodgement must be done through ATO Business Portal or your registered tax agent software.
            </div>
          </div>
        </div>
      );
    };

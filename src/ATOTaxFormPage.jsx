import React from "react";
import {
  safeNumber,
  formatCurrencyByCode,
  getClientCurrencyCode,
  calculateAdjustmentValues,
  todayLocal,
  formatDateAU,
  colours,
  cardStyle,
  labelStyle,
  inputStyle,
  buttonSecondary,
  currency,
} from "./PortalHelpers";

export default function ATOTaxFormPage({ profile, invoices, expenses, incomeSources, colours, cardStyle, labelStyle, inputStyle, buttonSecondary, safeNumber, todayLocal, getClientById, currency }) {
  const [atoTab, setAtoTab] = React.useState("income");

  const GST = 0.10;
  const fmt = (v) => (Number(v)||0).toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2});
  const sumKey = (arr,k) => (arr||[]).reduce((s,x)=>s+Number(x[k]||0),0);
  const netOfGST = (amount, incl) => { const A=Number(amount)||0; return incl==="yes"?A/(1+GST):A; };
  const isBusinessIncome = (x) => (x.type||"").toLowerCase().includes("business");

  const classifyIncomeType = (src) => {
    const raw = String(src?.incomeType || "").toLowerCase();
    if (raw.includes("casual") || raw.includes("salary") || raw.includes("wage")) return "Salary/Wages";
    if (raw.includes("business") || raw.includes("sole trader")) return "Business (sole trader)";
    if (raw.includes("interest")) return "Interest";
    if (raw.includes("dividend")) return "Dividends";
    if (raw.includes("outside australia") || raw.includes("foreign")) return "Other";
    return "Other";
  };

  const portalIncome = [
    ...invoices.filter((inv) => inv.status === "Paid").map((inv) => {
      const client = getClientById(inv.clientId);
      return { date: inv.paidAt ? inv.paidAt.slice(0,10) : (inv.invoiceDate||""), type: "Business (sole trader)", payer: client?.name || client?.businessName || "", gross: safeNumber(inv.total), withheld: safeNumber(inv.taxWithheld||0), franked: 0, franking: 0, abn: client?.abn||"" };
    }),
    ...incomeSources.filter((s) => safeNumber(s.beforeTax) > 0).map((src) => {
      const t = classifyIncomeType(src);
      return { date: todayLocal(), type: t, payer: src.name||"", gross: safeNumber(src.beforeTax), withheld: safeNumber(src.taxWithheld||0), franked: t==="Dividends"?safeNumber(src.beforeTax):0, franking: safeNumber(src.frankingCredit||0), abn: "" };
    }),
  ];

  const portalExpenses = expenses.map((exp) => ({
    date: exp.date||"", type: exp.category||exp.expenseType||"Other",
    supplier: exp.supplier||exp.description||"", amount: safeNumber(exp.amount),
    gstIncl: exp.gstIncluded !== false ? "yes" : "no",
  }));

  // GST calcs
  const g1  = portalIncome.filter(isBusinessIncome).reduce((s,x)=>s+Number(x.gross||0),0);
  const b1a = g1 * GST / (1+GST);
  const g10 = portalExpenses.filter(x=>Number(x.amount||0)>=1000).reduce((s,x)=>s+Number(x.amount||0),0);
  const g11 = portalExpenses.filter(x=>Number(x.amount||0)<1000).reduce((s,x)=>s+Number(x.amount||0),0);
  const b1b = portalExpenses.reduce((s,x)=>x.gstIncl==="yes"?s+(Number(x.amount||0)*GST/(1+GST)):s,0);
  const basNet = b1a - b1b;

  // Tax calcs
  const totalIncome   = sumKey(portalIncome,"gross");
  const totalWithheld = sumKey(portalIncome,"withheld");
  const totalFranking = sumKey(portalIncome,"franking");
  const deductibleExp = portalExpenses.filter(x=>(x.type||"").toLowerCase()!=="capital item").reduce((s,x)=>s+netOfGST(x.amount,x.gstIncl),0);
  const taxableIncome = Math.max(0, totalIncome - deductibleExp);

  function atoTaxResident(t) {
    if(t<=18200)  return 0;
    if(t<=45000)  return (t-18200)*0.19;
    if(t<=135000) return 5092+(t-45000)*0.325;
    if(t<=190000) return 34242+(t-135000)*0.37;
    return 54672+(t-190000)*0.45;
  }
  const incomeTax      = atoTaxResident(taxableIncome);
  const medicare       = taxableIncome * 0.02;
  const lito           = taxableIncome<=37500?700:taxableIncome<=45000?700-0.05*(taxableIncome-37500):taxableIncome<=66667?325-0.015*(taxableIncome-45000):0;
  const taxAfterOffset = Math.max(0, incomeTax - totalFranking - lito);
  const balance        = taxAfterOffset + medicare - totalWithheld;

  const downloadCSV = (name, header, rows) => {
    const esc = (v) => `"${String(v??'').replace(/"/g,'""')}"`;
    const csv = [header, ...rows].map(r=>r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const th = {border:`1px solid ${colours.border}`,padding:8,textAlign:"left",background:"#f3f3f3"};
  const td = {border:`1px solid ${colours.border}`,padding:8};
  const tdr = {border:`1px solid ${colours.border}`,padding:8,textAlign:"right"};

  const tabs = [
    {id:"income",label:"Income"},
    {id:"expenses",label:"Expenses"},
    {id:"gst",label:"GST (BAS)"},
    {id:"bas",label:"BAS Summary"},
    {id:"tax",label:"Tax Summary"},
    {id:"itr",label:"ITR 2025–26"},
  ];

  return (
    <div style={{ display:"grid", gap:20 }}>
      <div style={{...cardStyle, padding:24}}>
        <div style={{fontSize:22,fontWeight:900,color:colours.purple,marginBottom:4}}>ATO Tax Form</div>
        <div style={{fontSize:14,color:colours.muted,marginBottom:16}}>Auto-populated from your portal data. Income, expenses, GST and tax summary.</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button style={buttonSecondary} onClick={()=>downloadCSV("income.csv",["date","type","payer","gross","withheld","franked","franking_credit","abn"],portalIncome.map(r=>[r.date,r.type,r.payer,r.gross,r.withheld,r.franked,r.franking,r.abn]))}>⬇ Income CSV</button>
          <button style={buttonSecondary} onClick={()=>downloadCSV("expenses.csv",["date","type","supplier","amount","gst_included"],portalExpenses.map(r=>[r.date,r.type,r.supplier,r.amount,r.gstIncl]))}>⬇ Expenses CSV</button>
          <button style={buttonSecondary} onClick={()=>downloadCSV("gst.csv",["g1_total_sales","g10_capital","g11_noncapital","1a_gst_payable","1b_gst_credits","net_gst"],[[g1,g10,g11,b1a,b1b,basNet]])}>⬇ GST CSV</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:colours.teal,borderRadius:10,display:"flex",flexWrap:"wrap",overflow:"hidden"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setAtoTab(t.id)} style={{flex:1,minWidth:100,padding:"10px 12px",border:"none",cursor:"pointer",fontWeight:700,fontSize:13,color:"#fff",background:atoTab===t.id?colours.purple:"transparent"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Income */}
      {atoTab==="income" && (
        <div style={{...cardStyle,padding:20}}>
          <h2 style={{color:colours.teal,margin:"0 0 14px",fontSize:18}}>Income Ledger</h2>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
              <thead><tr>{["Date","Type","Payer","Gross ($)","Withheld ($)","Franked ($)","Franking Cr ($)","ABN"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {portalIncome.length===0 && <tr><td colSpan={8} style={{...td,textAlign:"center",color:colours.muted}}>No paid invoices or income sources yet.</td></tr>}
                {portalIncome.map((r,i)=><tr key={i}><td style={td}>{r.date}</td><td style={td}>{r.type}</td><td style={td}>{r.payer}</td><td style={tdr}>${fmt(r.gross)}</td><td style={tdr}>${fmt(r.withheld)}</td><td style={tdr}>${fmt(r.franked)}</td><td style={tdr}>${fmt(r.franking)}</td><td style={td}>{r.abn}</td></tr>)}
              </tbody>
              <tfoot><tr style={{background:"#fbfbfb",fontWeight:600}}>
                <td colSpan={3} style={{...tdr,background:"#fbfbfb"}}>Totals:</td>
                <td style={tdr}>${fmt(sumKey(portalIncome,"gross"))}</td>
                <td style={tdr}>${fmt(sumKey(portalIncome,"withheld"))}</td>
                <td style={tdr}>${fmt(sumKey(portalIncome,"franked"))}</td>
                <td style={tdr}>${fmt(sumKey(portalIncome,"franking"))}</td>
                <td style={td}></td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Expenses */}
      {atoTab==="expenses" && (
        <div style={{...cardStyle,padding:20}}>
          <h2 style={{color:colours.teal,margin:"0 0 14px",fontSize:18}}>Expense Ledger</h2>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
              <thead><tr>{["Date","Type","Supplier","Amount ($)","GST Incl"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {portalExpenses.length===0 && <tr><td colSpan={5} style={{...td,textAlign:"center",color:colours.muted}}>No expenses recorded yet.</td></tr>}
                {portalExpenses.map((r,i)=><tr key={i}><td style={td}>{r.date}</td><td style={td}>{r.type}</td><td style={td}>{r.supplier}</td><td style={tdr}>${fmt(r.amount)}</td><td style={td}>{r.gstIncl}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div style={{fontSize:12,color:colours.muted,marginTop:10}}>For tax, deductions are net of GST where GST = Yes. Capital items are excluded from deductions.</div>
        </div>
      )}

      {/* GST */}
      {atoTab==="gst" && (
        <div style={{...cardStyle,padding:20}}>
          <h2 style={{color:colours.teal,margin:"0 0 14px",fontSize:18}}>GST (BAS) Summary</h2>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
            <tbody>
              {[
                {label:"G1 Total Sales (incl GST) — Business income only",val:g1},
                {label:"G10 Capital Purchases (≥ $1,000)",val:g10},
                {label:"G11 Non-Capital Purchases (< $1,000)",val:g11},
                {label:"1A GST on Sales (Payable)",val:b1a,bg:"#f7f7ff"},
                {label:"1B GST on Purchases (Credits)",val:b1b,bg:"#f7f7ff"},
                {label:"Net GST payable (1A − 1B)",val:basNet,bg:"#e7f6f6",bold:true},
              ].map((r,i)=>(
                <tr key={i} style={{background:r.bg||"transparent"}}>
                  <td style={{...td,fontWeight:r.bold?600:400}}>{r.label}</td>
                  <td style={{...tdr,fontWeight:r.bold?600:400}}>${fmt(r.val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{fontSize:12,color:colours.muted,marginTop:10}}>Only Business (sole trader) income contributes to G1. Credits only where GST included = Yes.</div>
        </div>
      )}

      {/* BAS Summary */}
      {atoTab==="bas" && (
        <div style={{display:"grid",gap:16}}>
          <div style={{...cardStyle,padding:20}}>
            <h3 style={{margin:"0 0 12px",color:"#333",fontSize:15}}>Period & Entity</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
              <div><label style={labelStyle}>ABN</label><input style={{...inputStyle,background:"#F8FAFC"}} readOnly value={profile.abn||""} /></div>
              <div><label style={labelStyle}>Business name</label><input style={{...inputStyle,background:"#F8FAFC"}} readOnly value={profile.businessName||""} /></div>
            </div>
          </div>
          <div style={{...cardStyle,padding:20}}>
            <h3 style={{margin:"0 0 12px",color:"#333",fontSize:15}}>GST Summary (from portal)</h3>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
              <tbody>
                {[
                  {label:"G1 Total sales (incl GST)",val:g1},
                  {label:"G10 Capital purchases (incl GST)",val:g10},
                  {label:"G11 Non-capital purchases (incl GST)",val:g11},
                  {label:"1A GST on sales (payable)",val:b1a,bg:"#f7f7ff"},
                  {label:"1B GST on purchases (credits)",val:b1b,bg:"#f7f7ff"},
                  {label:"Net GST for this BAS (1A − 1B)",val:basNet,bg:"#e7f6f6",bold:true},
                ].map((r,i)=>(
                  <tr key={i} style={{background:r.bg||"transparent"}}>
                    <td style={{...td,fontWeight:r.bold?600:400}}>{r.label}</td>
                    <td style={{...tdr,fontWeight:r.bold?600:400}}>${fmt(r.val)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{...cardStyle,padding:20}}>
            <h3 style={{margin:"0 0 8px",color:"#333",fontSize:15}}>Declaration</h3>
            <p style={{fontSize:12,color:"#666",marginBottom:12}}>I declare that the information provided for the above Business Activity Statement is true and correct, and that I am authorised to make this declaration.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
              <div><label style={labelStyle}>Signed by</label><input style={inputStyle} placeholder="Client name" /></div>
              <div><label style={labelStyle}>Date</label><input type="date" style={inputStyle} /></div>
            </div>
          </div>
        </div>
      )}

      {/* Tax Summary */}
      {atoTab==="tax" && (
        <div style={{...cardStyle,padding:20}}>
          <h2 style={{color:colours.teal,margin:"0 0 14px",fontSize:18}}>Tax Summary (Indicative — ATO brackets)</h2>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
            <tbody>
              {[
                {label:"Total Income",val:`$${fmt(totalIncome)}`},
                {label:"Less: Deductible Expenses",val:`−$${fmt(deductibleExp)}`},
                {label:"Taxable Income",val:`$${fmt(taxableIncome)}`},
                {label:"Less: Franking credits",val:`−$${fmt(totalFranking)}`},
                {label:"Less: LITO",val:`−$${fmt(lito)}`},
                {label:"Estimated Income Tax",val:`$${fmt(taxAfterOffset)}`},
                {label:"Medicare Levy (2%)",val:`$${fmt(medicare)}`},
                {label:"Less: PAYG Withheld",val:`−$${fmt(totalWithheld)}`},
                {label:"Net Balance (Payable + / Refund −)",val:balance>=0?`$${fmt(balance)}`:`−$${fmt(Math.abs(balance))}`,bold:true,color:balance>=0?"#b30021":"#166534"},
              ].map((r,i)=>(
                <tr key={i}>
                  <td style={{...td,fontWeight:r.bold?700:400}}>{r.label}</td>
                  <td style={{...tdr,fontWeight:r.bold?700:400,color:r.color||"inherit"}}>{r.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{fontSize:12,color:colours.muted,marginTop:10}}>⚠️ Indicative only based on 2025–26 ATO resident tax brackets. Does not include all offsets. Consult your registered tax agent.</div>
        </div>
      )}

      {/* ITR */}
      {atoTab==="itr" && (
        <div style={{...cardStyle,padding:20}}>
          <h2 style={{color:colours.teal,margin:"0 0 4px",fontSize:18}}>Individual Tax Return (ITR) — 2025–26 (Indicative)</h2>
          <div style={{fontSize:12,color:colours.muted,marginBottom:16}}>Pre-filled from your portal data. Review and adjust as needed.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:16}}>
            <div><label style={labelStyle}>Residency for tax</label><select style={inputStyle}><option>Resident</option><option>Non-resident</option></select></div>
            <div><label style={labelStyle}>HELP / HECS debt</label><select style={inputStyle}><option>No</option><option>Yes</option></select></div>
          </div>
          <h3 style={{fontSize:15,margin:"0 0 10px"}}>Income (pre-filled from portal)</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:16}}>
            {[
              {label:"Salary/Wages ($)",val:portalIncome.filter(x=>x.type==="Salary/Wages").reduce((s,x)=>s+x.gross,0)},
              {label:"PAYG tax withheld ($)",val:totalWithheld},
              {label:"Business (sole trader) gross ($)",val:portalIncome.filter(x=>isBusinessIncome(x)).reduce((s,x)=>s+x.gross,0)},
              {label:"Interest ($)",val:portalIncome.filter(x=>x.type==="Interest").reduce((s,x)=>s+x.gross,0)},
              {label:"Dividends — Franked ($)",val:sumKey(portalIncome,"franked")},
              {label:"Dividends — Franking credits ($)",val:sumKey(portalIncome,"franking")},
              {label:"Other income ($)",val:portalIncome.filter(x=>x.type==="Other").reduce((s,x)=>s+x.gross,0)},
            ].map(({label,val})=>(
              <div key={label}><label style={labelStyle}>{label}</label><input type="number" style={inputStyle} defaultValue={val>0?val.toFixed(2):""} min="0" step="0.01" /></div>
            ))}
          </div>
          <h3 style={{fontSize:15,margin:"0 0 10px"}}>Deductions</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:16}}>
            {[
              {label:"Work-related ($)",val:deductibleExp},
              {label:"Car (cents/km) ($)",val:0},
              {label:"Home office ($)",val:0},
              {label:"Gifts / Donations ($)",val:0},
              {label:"Tax agent fees ($)",val:0},
              {label:"Other deductions ($)",val:0},
            ].map(({label,val})=>(
              <div key={label}><label style={labelStyle}>{label}</label><input type="number" style={inputStyle} defaultValue={val>0?val.toFixed(2):""} min="0" step="0.01" /></div>
            ))}
          </div>
          <div style={{...cardStyle,padding:16,background:"#E7F6F6",border:`1px solid ${colours.teal}33`}}>
            {[
              {label:"Taxable Income",val:`$${fmt(taxableIncome)}`},
              {label:"Est. Income Tax",val:`$${fmt(taxAfterOffset)}`},
              {label:"Medicare Levy",val:`$${fmt(medicare)}`},
              {label:"Less PAYG Withheld",val:`−$${fmt(totalWithheld)}`},
              {label:"Est. Balance",val:balance>=0?`Owe $${fmt(balance)}`:`Refund $${fmt(Math.abs(balance))}`,bold:true,color:balance>=0?colours.purple:colours.teal},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:14}}>
                <span style={{color:colours.muted}}>{r.label}</span>
                <strong style={{color:r.color||colours.text}}>{r.val}</strong>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:colours.muted,marginTop:12}}>⚠️ Indicative only. Always verify with your registered tax agent before lodging with the ATO.</div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────


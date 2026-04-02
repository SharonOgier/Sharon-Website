import React, { useState } from "react";
import { safeNumber, todayLocal } from "./PortalHelpers";

// ── Colours matching the HTML ─────────────────────────────────────────────────
const TEAL   = "#006d6d";
const PURPLE = "#6a1b9a";
const BORDER = "#d7d7d7";

const ss = {
  btn:     { padding:"8px 10px", fontSize:13, borderRadius:8, border:`1px solid ${BORDER}`, cursor:"pointer", background:"#fff" },
  primary: { padding:"8px 10px", fontSize:13, borderRadius:8, border:`1px solid ${TEAL}`,   cursor:"pointer", background:TEAL,   color:"#fff" },
  outline: { padding:"8px 10px", fontSize:13, borderRadius:8, border:`1px solid ${PURPLE}`, cursor:"pointer", background:"#fff", color:PURPLE },
  danger:  { padding:"8px 10px", fontSize:13, borderRadius:8, border:"1px solid #b30021",   cursor:"pointer", background:"#fff", color:"#b30021" },
  sm:      { padding:"6px 8px", fontSize:12 },
  inp:     { width:"100%", padding:"8px 10px", fontSize:14, border:`1px solid ${BORDER}`, borderRadius:8, background:"#fff", boxSizing:"border-box" },
  lbl:     { fontSize:12, color:"#555", marginBottom:3, display:"block" },
  grid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10 },
  table:   { width:"100%", borderCollapse:"collapse", marginTop:10, fontSize:13.5 },
  th:      { border:`1px solid ${BORDER}`, padding:8, textAlign:"left",  background:"#f3f3f3" },
  thr:     { border:`1px solid ${BORDER}`, padding:8, textAlign:"right", background:"#f3f3f3", whiteSpace:"nowrap" },
  td:      { border:`1px solid ${BORDER}`, padding:8, textAlign:"left",  verticalAlign:"top" },
  tdr:     { border:`1px solid ${BORDER}`, padding:8, textAlign:"right", verticalAlign:"top" },
  tdf:     { border:`1px solid ${BORDER}`, padding:8, textAlign:"right", fontWeight:600, background:"#fbfbfb" },
  sec:     { margin:"12px 0", padding:12, border:`1px dashed ${BORDER}`, borderRadius:10, background:"#fff" },
  h2:      { color:TEAL,   margin:"8px 0 10px", fontSize:18 },
  h3:      { margin:"0 0 8px", color:"#333", fontSize:15 },
};

// ── Pure calculation functions (ported exactly from index.html JS) ────────────
const GST = 0.10;
const fmt = n => (Number(n)||0).toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2});
const nv  = v => Number(v)||0;
const sumKey = (arr,k) => (arr||[]).reduce((s,x)=>s+Number(x[k]||0),0);
const netOfGST = (amount,incl) => { const A=Number(amount)||0; return incl==="yes"?A/(1+GST):A; };
const isBI = x => (x.type||"").toLowerCase().includes("business");

function taxResident(t)    { t=nv(t); if(t<=18200)return 0; if(t<=45000)return(t-18200)*0.19; if(t<=120000)return 5092+(t-45000)*0.325; if(t<=180000)return 29467+(t-120000)*0.37; return 51667+(t-180000)*0.45; }
function taxNonResident(t) { t=nv(t); if(t<=120000)return t*0.325; if(t<=180000)return 39000+(t-120000)*0.37; return 61200+(t-180000)*0.45; }

function litoCalc(t,isRes) {
  if(!isRes) return 0; t=nv(t);
  if(t<=37500) return 700; if(t<=45000) return 700-0.05*(t-37500); if(t<=66667) return 325-0.015*(t-45000); return 0;
}
function saptoCalc(t,status) {
  if(status==="none") return 0; t=nv(t);
  let max=0,thr=0,cut=0;
  if(status==="single")  {max=2230;thr=34919;cut=52759;}
  else if(status==="couple")  {max=1602;thr=30994;cut=43810;}
  else if(status==="illness") {max=2040;thr=33732;cut=50052;}
  if(t<=thr) return max; if(t>=cut) return 0;
  return Math.max(0,max-0.125*(t-thr));
}
function helpCalc(ri,has) {
  if(!has) return 0; ri=nv(ri);
  if(ri<=54435)return 0; if(ri<=62738)return ri*0.01; if(ri<=68152)return ri*0.02; if(ri<=72207)return ri*0.025;
  if(ri<=75866)return ri*0.03; if(ri<=79768)return ri*0.035; if(ri<=83955)return ri*0.04; if(ri<=88487)return ri*0.045;
  if(ri<=93308)return ri*0.05; if(ri<=98471)return ri*0.055; if(ri<=103004)return ri*0.06; if(ri<=107978)return ri*0.065;
  if(ri<=113337)return ri*0.07; if(ri<=119122)return ri*0.075; if(ri<=125370)return ri*0.08; if(ri<=132120)return ri*0.085;
  if(ri<=139414)return ri*0.09; if(ri<=147296)return ri*0.095; return ri*0.10;
}
function mlsCalc(ri,isRes,hasCover,family,children) {
  if(!isRes||hasCover) return 0; ri=nv(ri);
  let base=family==="family"?194000:97000;
  if(family==="family"&&nv(children)>1) base+=(nv(children)-1)*1500;
  if(ri<=base) return 0;
  let rate=0.01; if(ri>base*1.5)rate=0.015; else if(ri>base*1.25)rate=0.0125;
  return ri*rate;
}

function dlCSV(name,header,rows) {
  const esc = v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const csv=[header,...rows].map(r=>r.map(esc).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ATOTaxFormPage({
  profile = {},
  invoices = [],
  expenses = [],
  incomeSources = [],
  getClientById = () => null,
}) {
  const [tab, setTab] = useState("income");

  // Portal data mapped to ledger format
  const classifyType = src => {
    const r=String(src?.incomeType||"").toLowerCase();
    if(r.includes("casual")||r.includes("salary")||r.includes("wage")) return "Salary/Wages";
    if(r.includes("business")||r.includes("sole trader")) return "Business (sole trader)";
    if(r.includes("interest")) return "Interest";
    if(r.includes("dividend")) return "Dividends";
    return "Other";
  };
  // Group portal invoices by type and sum — avoids one row per invoice
  const portalInc = (() => {
    const groups = {};
    invoices.filter(i=>i.status==="Paid").forEach(i=>{
      const key = "Business (sole trader)";
      if(!groups[key]) groups[key] = {type:key, payer:"Business income (portal invoices)", gross:0, withheld:0, franked:0, franking:0, abn:"", date:""};
      groups[key].gross    += safeNumber(i.total);
      groups[key].withheld += safeNumber(i.taxWithheld||0);
      if(!groups[key].date || i.paidAt?.slice(0,10) > groups[key].date) groups[key].date = i.paidAt?i.paidAt.slice(0,10):(i.invoiceDate||"");
    });
    // Group income sources by type
    incomeSources.filter(s=>safeNumber(s.beforeTax)>0).forEach(s=>{
      const t = classifyType(s);
      if(!groups[t]) groups[t] = {type:t, payer:`${t} (portal income sources)`, gross:0, withheld:0, franked:0, franking:0, abn:"", date:todayLocal()};
      groups[t].gross    += safeNumber(s.beforeTax);
      groups[t].withheld += safeNumber(s.taxWithheld||0);
      groups[t].franked  += t==="Dividends"?safeNumber(s.beforeTax):0;
      groups[t].franking += safeNumber(s.frankingCredit||0);
    });
    return Object.values(groups);
  })();
  const portalExp = expenses.map(e=>({date:e.date||"",type:e.category||e.expenseType||"Other",supplier:e.supplier||e.description||"",amount:safeNumber(e.amount),gstIncl:e.gstIncluded!==false?"yes":"no"}));

  // Manually added records
  const [extraInc, setExtraInc] = useState([]);
  const [extraExp, setExtraExp] = useState([]);
  const allInc = [...portalInc, ...extraInc];
  const allExp = [...portalExp, ...extraExp];

  // Income add form
  const [incF, setIncF] = useState({date:"",type:"Salary/Wages",payer:"",gross:"",withheld:"0",franked:"0",franking:"0",abn:""});
  // Expense add form
  const [expF, setExpF] = useState({date:"",type:"Work-related",supplier:"",amount:"",gstIncl:"yes"});

  const addInc = () => {
    if(!incF.date||nv(incF.gross)<=0){alert("Please enter a date and a gross amount greater than 0.");return;}
    setExtraInc(p=>[...p,{date:incF.date,type:incF.type,payer:incF.payer,gross:nv(incF.gross),withheld:nv(incF.withheld),franked:nv(incF.franked),franking:nv(incF.franking),abn:incF.abn}]);
    setIncF(p=>({...p,gross:"",withheld:"0",franked:"0",franking:"0",payer:"",abn:""}));
  };
  const addExp = () => {
    if(!expF.date||nv(expF.amount)<=0){alert("Please enter a date and an amount greater than 0.");return;}
    setExtraExp(p=>[...p,{date:expF.date,type:expF.type,supplier:expF.supplier,amount:nv(expF.amount),gstIncl:expF.gstIncl}]);
    setExpF(p=>({...p,supplier:"",amount:""}));
  };
  const delInc = i => setExtraInc(p=>p.filter((_,j)=>j!==i));
  const delExp = i => setExtraExp(p=>p.filter((_,j)=>j!==i));

  // GST calcs
  const g1  = allInc.filter(isBI).reduce((s,x)=>s+Number(x.gross||0),0);
  const b1a = allInc.filter(isBI).reduce((s,x)=>s+(Number(x.gross||0)*GST/(1+GST)),0);
  const g10 = allExp.filter(x=>Number(x.amount||0)>=1000).reduce((s,x)=>s+Number(x.amount||0),0);
  const g11 = allExp.filter(x=>Number(x.amount||0)<1000).reduce((s,x)=>s+Number(x.amount||0),0);
  const b1b = allExp.reduce((s,x)=>x.gstIncl==="yes"?s+(Number(x.amount||0)*GST/(1+GST)):s,0);
  const basNet = b1a-b1b;

  // Tax summary calcs
  const totInc = sumKey(allInc,"gross");
  const totWH  = sumKey(allInc,"withheld");
  const totFC  = sumKey(allInc,"franking");
  const deduct = allExp.filter(x=>(x.type||"").toLowerCase()!=="capital item").reduce((s,x)=>s+netOfGST(x.amount,x.gstIncl),0);
  const taxableSum = Math.max(0,totInc-deduct);

  // ITR state
  const [itr, setItr] = useState({
    residency:"Resident",help:"No",medicareOn:"yes",mlsFamily:"single",mlsChildren:"0",mlsCover:"yes",saptoStatus:"none",periodLabel:"",
    salary:"",payg:"",paygi:"",business:"",interest:"",franked:"",fc:"",cg:"",other:"",foreign:"",foreignTax:"",
    dWork:"",dCar:"",dHome:"",dGifts:"",dAgent:"",dOther:"",
    adjNetInv:"",adjRfba:"",adjResc:"",adjExForeign:"",
    cgtProceeds:"",cgtCost:"",cgtLosses:"",cgtDiscount:"yes",
  });
  const si = (k,v) => setItr(p=>({...p,[k]:v}));

  // ITR calcs
  const iI = {salary:nv(itr.salary),payg:nv(itr.payg),paygi:nv(itr.paygi),business:nv(itr.business),interest:nv(itr.interest),franked:nv(itr.franked),fc:nv(itr.fc),cg:nv(itr.cg),other:nv(itr.other),foreign:nv(itr.foreign),foreignTax:nv(itr.foreignTax)};
  const iD = {work:nv(itr.dWork),car:nv(itr.dCar),home:nv(itr.dHome),gifts:nv(itr.dGifts),agent:nv(itr.dAgent),other:nv(itr.dOther)};
  const iDtot = iD.work+iD.car+iD.home+iD.gifts+iD.agent+iD.other;
  const iAdj  = nv(itr.adjNetInv)+nv(itr.adjRfba)+nv(itr.adjResc)+nv(itr.adjExForeign);
  const iAssess = iI.salary+iI.business+iI.interest+iI.franked+iI.cg+iI.other+iI.foreign;
  const iTaxable = Math.max(0,iAssess-iDtot);
  const iRI      = iTaxable+iAdj;
  const isRes    = itr.residency==="Resident";
  const iTaxG    = isRes?taxResident(iTaxable):taxNonResident(iTaxable);
  const iLevy    = itr.medicareOn==="yes"&&isRes?iTaxable*0.02:0;
  const iMls     = mlsCalc(iRI,isRes,itr.mlsCover==="yes",itr.mlsFamily,itr.mlsChildren);
  const iHelp    = helpCalc(iRI,itr.help==="Yes");
  const iFito    = Math.min(iI.foreignTax,iTaxG);
  const iLito    = litoCalc(iTaxable,isRes);
  const iSapto   = saptoCalc(iTaxable,itr.saptoStatus);
  const iTotOff  = iI.fc+iFito+iLito+iSapto;
  const iTaxAft  = Math.max(0,iTaxG-iTotOff);
  const iBal     = iTaxAft+iLevy+iMls+iHelp-iI.payg-iI.paygi;

  const pullLedgers = () => {
    const wages   = allInc.filter(x=>{const t=(x.type||"").toLowerCase();return t.includes("salary")||t.includes("wage")||t.includes("casual");}).reduce((s,x)=>s+Number(x.gross||0),0);
    const biz     = allInc.filter(x=>(x.type||"").toLowerCase().includes("business")).reduce((s,x)=>s+Number(x.gross||0),0);
    const int_    = allInc.filter(x=>(x.type||"").toLowerCase().includes("interest")).reduce((s,x)=>s+Number(x.gross||0),0);
    const for_    = allInc.filter(x=>{const t=(x.type||"").toLowerCase();return t.includes("outside australia")||t.includes("foreign");}).reduce((s,x)=>s+Number(x.gross||0),0);
    const div     = allInc.filter(x=>(x.type||"").toLowerCase().includes("dividend")).reduce((s,x)=>s+Number(x.gross||0),0);
    const payg    = sumKey(allInc,"withheld");
    const franked = sumKey(allInc,"franked")||div;
    const fc      = sumKey(allInc,"franking");
    const mapped  = wages+biz+int_+for_+div;
    const other   = Math.max(0,sumKey(allInc,"gross")-mapped);
    const ded     = allExp.filter(x=>(x.type||"").toLowerCase()!=="capital item").reduce((s,x)=>s+netOfGST(x.amount,x.gstIncl),0);
    setItr(p=>({...p,salary:wages||"",business:biz||"",interest:int_||"",foreign:for_||"",other:other||"",payg:payg||"",franked:franked||"",fc:fc||"",dWork:ded||""}));
  };

  const applyCGT = () => {
    let gain=Math.max(0,nv(itr.cgtProceeds)-nv(itr.cgtCost));
    let net=Math.max(0,gain-nv(itr.cgtLosses));
    if(itr.cgtDiscount==="yes") net=net*0.5;
    si("cg",net?net.toFixed(2):"");
  };

  const TABS = [{id:"income",label:"Income"},{id:"expenses",label:"Expenses"},{id:"gst",label:"GST (BAS)"},{id:"basForm",label:"BAS Summary"},{id:"summary",label:"Tax Summary"},{id:"itr",label:"ITR 2025–26"}];

  return (
    <div style={{fontFamily:"Segoe UI,Arial,sans-serif",color:"#111",background:"#fafafa",borderRadius:12,border:`1px solid ${BORDER}`,overflow:"hidden"}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:`1px solid ${BORDER}`,background:"#fff",gap:10,flexWrap:"wrap"}}>
        <div>
          <div style={{fontWeight:800,color:PURPLE,fontSize:18}}>Sharon's Accounting Service</div>
          <div style={{fontSize:12,color:"#555"}}>ABN {profile.abn||"44869154258"} · {profile.email||"info@sharonogier.com"} · {profile.businessName||""}</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button style={{...ss.outline,...ss.sm}} onClick={()=>dlCSV("income.csv",["date","type","payer","gross","withheld","franked_amount","franking_credit","abn"],allInc.map(r=>[r.date,r.type,r.payer,r.gross,r.withheld,r.franked,r.franking,r.abn]))}>Download Income CSV</button>
          <button style={{...ss.outline,...ss.sm}} onClick={()=>dlCSV("expenses.csv",["date","type","supplier","amount","gst_included"],allExp.map(r=>[r.date,r.type,r.supplier,r.amount,r.gstIncl]))}>Download Expenses CSV</button>
          <button style={{...ss.outline,...ss.sm}} onClick={()=>dlCSV("gst_snapshot.csv",["period","g1_total_sales","g10_capital","g11_noncapital","gst_1a","gst_1b","gst_net"],[[itr.periodLabel,g1,g10,g11,b1a,b1b,basNet]])}>Download GST CSV</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:TEAL,flexWrap:"wrap"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,minWidth:110,padding:"10px 12px",color:"#fff",background:tab===t.id?PURPLE:"transparent",border:"none",cursor:"pointer",fontWeight:600,fontSize:13}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:16}}>

        {/* ── Income ── */}
        {tab==="income" && <>
          <h2 style={ss.h2}>Income Ledger</h2>
          <div style={ss.grid}>
            <div><label style={ss.lbl}>Date</label><input type="date" style={ss.inp} value={incF.date} onChange={e=>setIncF(p=>({...p,date:e.target.value}))} /></div>
            <div><label style={ss.lbl}>Type</label>
              <select style={ss.inp} value={incF.type} onChange={e=>setIncF(p=>({...p,type:e.target.value}))}>
                {["Salary/Wages","Government allowance","Business (sole trader)","Interest","Dividends","Other"].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={ss.lbl}>Payer</label><input style={ss.inp} placeholder="Employer/Agency/Client" value={incF.payer} onChange={e=>setIncF(p=>({...p,payer:e.target.value}))} /></div>
            <div><label style={ss.lbl}>Gross ($)</label><input type="number" style={ss.inp} step="0.01" min="0" value={incF.gross} onChange={e=>setIncF(p=>({...p,gross:e.target.value}))} /></div>
            <div><label style={ss.lbl}>Tax withheld ($)</label><input type="number" style={ss.inp} step="0.01" min="0" value={incF.withheld} onChange={e=>setIncF(p=>({...p,withheld:e.target.value}))} /></div>
            <div><label style={ss.lbl}>Franked amount ($)</label><input type="number" style={ss.inp} step="0.01" min="0" value={incF.franked} onChange={e=>setIncF(p=>({...p,franked:e.target.value}))} /></div>
            <div><label style={ss.lbl}>Franking credit ($)</label><input type="number" style={ss.inp} step="0.01" min="0" value={incF.franking} onChange={e=>setIncF(p=>({...p,franking:e.target.value}))} /></div>
            <div><label style={ss.lbl}>ABN (optional)</label><input style={ss.inp} value={incF.abn} onChange={e=>setIncF(p=>({...p,abn:e.target.value}))} /></div>
            <div style={{alignSelf:"end"}}><button style={ss.primary} onClick={addInc}>Add record</button></div>
          </div>
          <table style={ss.table}>
            <thead><tr>
              <th style={ss.th}>Date</th><th style={ss.th}>Type</th><th style={ss.th}>Payer</th>
              <th style={ss.thr}>Gross ($)</th><th style={ss.thr}>Withheld ($)</th>
              <th style={ss.thr}>Franked ($)</th><th style={ss.thr}>Franking Cr ($)</th>
              <th style={ss.th}>ABN</th><th style={ss.th}></th>
            </tr></thead>
            <tbody>
              {allInc.length===0 && <tr><td colSpan={9} style={{...ss.td,textAlign:"center",color:"#888",padding:16}}>No income records yet. Records from paid invoices and income sources appear here automatically.</td></tr>}
              {allInc.map((r,i)=>(
                <tr key={i} style={{background:i<portalInc.length?"#f9fff9":"#fff"}}>
                  <td style={ss.td}>{r.date}</td><td style={ss.td}>{r.type}</td><td style={ss.td}>{r.payer}</td>
                  <td style={ss.tdr}>${fmt(r.gross)}</td><td style={ss.tdr}>${fmt(r.withheld)}</td>
                  <td style={ss.tdr}>${fmt(r.franked)}</td><td style={ss.tdr}>${fmt(r.franking)}</td>
                  <td style={ss.td}>{r.abn}</td>
                  <td style={ss.td}>{i>=portalInc.length&&<button style={{...ss.danger,...ss.sm}} onClick={()=>delInc(i-portalInc.length)}>Delete</button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={3} style={ss.tdf}>Totals:</td>
              <td style={ss.tdf}>${fmt(sumKey(allInc,"gross"))}</td>
              <td style={ss.tdf}>${fmt(sumKey(allInc,"withheld"))}</td>
              <td style={ss.tdf}>${fmt(sumKey(allInc,"franked"))}</td>
              <td style={ss.tdf}>${fmt(sumKey(allInc,"franking"))}</td>
              <td colSpan={2} style={{background:"#fbfbfb",border:`1px solid ${BORDER}`}}></td>
            </tr></tfoot>
          </table>
          <div style={{marginTop:10,display:"flex",gap:8}}>
            {extraInc.length>0&&<button style={{...ss.danger,...ss.sm}} onClick={()=>{if(window.confirm("Delete ALL manually added income?"))setExtraInc([]);}}>Delete All Added Income</button>}
          </div>
        </>}

        {/* ── Expenses ── */}
        {tab==="expenses" && <>
          <h2 style={ss.h2}>Expense Ledger</h2>
          <div style={ss.grid}>
            <div><label style={ss.lbl}>Date</label><input type="date" style={ss.inp} value={expF.date} onChange={e=>setExpF(p=>({...p,date:e.target.value}))} /></div>
            <div><label style={ss.lbl}>Type</label>
              <select style={ss.inp} value={expF.type} onChange={e=>setExpF(p=>({...p,type:e.target.value}))}>
                {["Work-related","Capital item","Office supplies","Other"].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={ss.lbl}>Supplier</label><input style={ss.inp} value={expF.supplier} onChange={e=>setExpF(p=>({...p,supplier:e.target.value}))} /></div>
            <div><label style={ss.lbl}>Amount ($, incl GST)</label><input type="number" style={ss.inp} step="0.01" min="0" value={expF.amount} onChange={e=>setExpF(p=>({...p,amount:e.target.value}))} /></div>
            <div><label style={ss.lbl}>GST included?</label>
              <select style={ss.inp} value={expF.gstIncl} onChange={e=>setExpF(p=>({...p,gstIncl:e.target.value}))}>
                <option value="yes">Yes</option><option value="no">No</option>
              </select>
            </div>
            <div style={{alignSelf:"end"}}><button style={ss.primary} onClick={addExp}>Add expense</button></div>
          </div>
          <table style={ss.table}>
            <thead><tr>
              <th style={ss.th}>Date</th><th style={ss.th}>Type</th><th style={ss.th}>Supplier</th>
              <th style={ss.thr}>Amount ($)</th><th style={ss.th}>GST Incl</th><th style={ss.th}></th>
            </tr></thead>
            <tbody>
              {allExp.length===0&&<tr><td colSpan={6} style={{...ss.td,textAlign:"center",color:"#888",padding:16}}>No expenses yet. Expenses from your portal appear here automatically.</td></tr>}
              {allExp.map((r,i)=>(
                <tr key={i} style={{background:i<portalExp.length?"#f9fff9":"#fff"}}>
                  <td style={ss.td}>{r.date}</td><td style={ss.td}>{r.type}</td><td style={ss.td}>{r.supplier}</td>
                  <td style={ss.tdr}>${fmt(r.amount)}</td><td style={ss.td}>{r.gstIncl}</td>
                  <td style={ss.td}>{i>=portalExp.length&&<button style={{...ss.danger,...ss.sm}} onClick={()=>delExp(i-portalExp.length)}>Delete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{fontSize:12,color:"#666",marginTop:8}}>For tax, deductions are net of GST where GST = Yes. Capital items are excluded from deductions in this worksheet.</div>
          {extraExp.length>0&&<div style={{marginTop:8}}><button style={{...ss.danger,...ss.sm}} onClick={()=>{if(window.confirm("Delete ALL manually added expenses?"))setExtraExp([]);}}>Delete All Added Expenses</button></div>}
        </>}

        {/* ── GST ── */}
        {tab==="gst" && <>
          <h2 style={ss.h2}>GST (BAS) Summary</h2>
          <table style={ss.table}>
            <tbody>
              {[
                {l:<><b>G1</b> Total Sales (incl GST) — Business income only</>,v:g1},
                {l:<><b>G10</b> Capital Purchases (≥ $1,000)</>,v:g10},
                {l:<><b>G11</b> Non-Capital Purchases (&lt; $1,000)</>,v:g11},
                {l:<><b>1A</b> GST on Sales (Payable)</>,v:b1a,bg:"#f7f7ff"},
                {l:<><b>1B</b> GST on Purchases (Credits)</>,v:b1b,bg:"#f7f7ff"},
                {l:"Net GST payable (1A − 1B)",v:basNet,bg:"#e7f6f6",bold:true},
              ].map((r,i)=>(
                <tr key={i} style={{background:r.bg||"transparent"}}>
                  <td style={{...ss.td,fontWeight:r.bold?600:400}}>{r.l}</td>
                  <td style={{...ss.tdr,fontWeight:r.bold?600:400}}>${fmt(r.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{fontSize:12,color:"#666",marginTop:8}}>Only <b>Business (sole trader)</b> income contributes to G1. Credits only where GST included = Yes.</div>
        </>}

        {/* ── BAS Summary ── */}
        {tab==="basForm" && <>
          <h2 style={ss.h2}>BAS Summary</h2>
          <div style={ss.sec}>
            <h3 style={ss.h3}>Period &amp; Entity</h3>
            <div style={{...ss.grid,maxWidth:520}}>
              <div><label style={ss.lbl}>Period</label><input style={ss.inp} placeholder="If blank, uses Tax Summary period label" value={itr.periodLabel} onChange={e=>si("periodLabel",e.target.value)} /></div>
              <div><label style={ss.lbl}>ABN</label><input style={{...ss.inp,background:"#f8f8f8"}} readOnly value={profile.abn||""} /></div>
              <div><label style={ss.lbl}>Business name</label><input style={{...ss.inp,background:"#f8f8f8"}} readOnly value={profile.businessName||""} /></div>
            </div>
          </div>
          <div style={ss.sec}>
            <h3 style={ss.h3}>GST Summary (from ledger)</h3>
            <table style={ss.table}>
              <tbody>
                {[
                  {l:<><b>G1</b> Total sales (incl GST)</>,v:g1},
                  {l:<><b>G10</b> Capital purchases (incl GST)</>,v:g10},
                  {l:<><b>G11</b> Non-capital purchases (incl GST)</>,v:g11},
                  {l:<><b>1A</b> GST on sales (payable)</>,v:b1a,bg:"#f7f7ff"},
                  {l:<><b>1B</b> GST on purchases (credits)</>,v:b1b,bg:"#f7f7ff"},
                  {l:"Net GST for this BAS (1A − 1B)",v:basNet,bg:"#e7f6f6",bold:true},
                ].map((r,i)=>(
                  <tr key={i} style={{background:r.bg||"transparent"}}>
                    <td style={{...ss.td,fontWeight:r.bold?600:400}}>{r.l}</td>
                    <td style={{...ss.tdr,fontWeight:r.bold?600:400}}>${fmt(r.v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={ss.sec}>
            <h3 style={ss.h3}>Declaration (for client signature)</h3>
            <p style={{fontSize:12,color:"#666",margin:"0 0 12px"}}>I declare that the information provided for the above Business Activity Statement is true and correct, and that I am authorised to make this declaration.</p>
            <div style={{...ss.grid,maxWidth:520}}>
              <div><label style={ss.lbl}>Signed by</label><input style={ss.inp} placeholder="Client name" /></div>
              <div><label style={ss.lbl}>Date</label><input type="date" style={ss.inp} /></div>
            </div>
          </div>
        </>}

        {/* ── Tax Summary ── */}
        {tab==="summary" && <>
          <h2 style={ss.h2}>Tax Summary (Indicative — ATO brackets)</h2>
          <div style={{...ss.grid,maxWidth:520,marginBottom:12}}>
            <div><label style={ss.lbl}>Medicare Levy</label>
              <select style={ss.inp} value={itr.medicareOn} onChange={e=>si("medicareOn",e.target.value)}>
                <option value="yes">Yes (2%)</option><option value="no">No</option>
              </select>
            </div>
            <div><label style={ss.lbl}>Period label</label><input style={ss.inp} placeholder="e.g. 2025–26 full year" value={itr.periodLabel} onChange={e=>si("periodLabel",e.target.value)} /></div>
          </div>
          <table style={ss.table}>
            <tbody>
              {[
                {l:"Total Income",v:`$${fmt(totInc)}`},
                {l:"Less: Deductible Expenses",v:`−$${fmt(deduct)}`},
                {l:"Taxable Income",v:`$${fmt(taxableSum)}`},
                {l:"Less: Franking credits (tax offset)",v:`−$${fmt(totFC)}`},
                {l:"Estimated Income Tax",v:`$${fmt(Math.max(0,taxResident(taxableSum)-totFC))}`},
                {l:"Medicare Levy",v:`$${fmt(itr.medicareOn==="yes"?taxableSum*0.02:0)}`},
                {l:"Less: PAYG Withheld",v:`−$${fmt(totWH)}`},
                {l:"Net Balance (Payable + / Refund −)",v:(()=>{const bal=Math.max(0,taxResident(taxableSum)-totFC)+(itr.medicareOn==="yes"?taxableSum*0.02:0)-totWH; return bal>=0?`$${fmt(bal)}`:`−$${fmt(Math.abs(bal))}`;})(),bold:true},
              ].map((r,i)=>(
                <tr key={i}>
                  <td style={{...ss.td,fontWeight:r.bold?700:400}}>{r.l}</td>
                  <td style={{...ss.tdr,fontWeight:r.bold?700:400}}>{r.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>}

        {/* ── ITR ── */}
        {tab==="itr" && <>
          <h2 style={ss.h2}>Individual Tax Return (ITR) — 2025–26 (Indicative)</h2>
          <div style={{marginBottom:12}}><button style={{...ss.outline,...ss.sm}} onClick={()=>window.print()}>Save as PDF</button></div>

          <div style={ss.sec}>
            <h3 style={ss.h3}>General</h3>
            <div style={ss.grid}>
              <div><label style={ss.lbl}>Year</label><select style={ss.inp}><option>2025–26</option><option>2024–25</option></select></div>
              <div><label style={ss.lbl}>Residency for tax</label>
                <select style={ss.inp} value={itr.residency} onChange={e=>si("residency",e.target.value)}>
                  <option>Resident</option><option>Non-resident</option>
                </select>
              </div>
              <div><label style={ss.lbl}>HELP / HECS debt</label>
                <select style={ss.inp} value={itr.help} onChange={e=>si("help",e.target.value)}>
                  <option>No</option><option>Yes</option>
                </select>
              </div>
            </div>
          </div>

          <div style={ss.sec}>
            <h3 style={ss.h3}>Income (Assessable)</h3>
            <div style={ss.grid}>
              {[["Salary/Wages ($)","salary"],["PAYG tax withheld ($)","payg"],["PAYG instalments paid ($)","paygi"],
                ["Business (sole trader) gross ($)","business"],["Interest ($)","interest"],
                ["Dividends — Franked amount ($)","franked"],["Dividends — Franking credits ($)","fc"],
                ["Capital gains — Net assessable ($)","cg"],["Other income ($)","other"],
                ["Foreign income (taxable, in AUD) ($)","foreign"],["Foreign tax paid ($)","foreignTax"],
              ].map(([lbl,k])=>(
                <div key={k}><label style={ss.lbl}>{lbl}</label><input type="number" style={ss.inp} min="0" step="0.01" value={itr[k]} onChange={e=>si(k,e.target.value)} /></div>
              ))}
            </div>
          </div>

          <div style={ss.sec}>
            <h3 style={ss.h3}>Deductions</h3>
            <div style={ss.grid}>
              {[["Work-related ($)","dWork"],["Car (cents/km) — amount ($)","dCar"],
                ["Home office ($)","dHome"],["Gifts/Donations ($)","dGifts"],
                ["Tax agent fees ($)","dAgent"],["Other deductions ($)","dOther"],
              ].map(([lbl,k])=>(
                <div key={k}><label style={ss.lbl}>{lbl}</label><input type="number" style={ss.inp} min="0" step="0.01" value={itr[k]} onChange={e=>si(k,e.target.value)} /></div>
              ))}
            </div>
          </div>

          <div style={ss.sec}>
            <h3 style={ss.h3}>HELP / MLS Adjustments (repayment income)</h3>
            <div style={ss.grid}>
              {[["Net investment losses ($)","adjNetInv"],["Reportable fringe benefits amount ($)","adjRfba"],
                ["Reportable employer super contributions ($)","adjResc"],["Exempt foreign employment income ($)","adjExForeign"],
              ].map(([lbl,k])=>(
                <div key={k}><label style={ss.lbl}>{lbl}</label><input type="number" style={ss.inp} min="0" step="0.01" value={itr[k]} onChange={e=>si(k,e.target.value)} /></div>
              ))}
            </div>
          </div>

          <div style={ss.sec}>
            <h3 style={ss.h3}>CGT Helper (optional)</h3>
            <div style={ss.grid}>
              <div><label style={ss.lbl}>Capital proceeds ($)</label><input type="number" style={ss.inp} min="0" step="0.01" value={itr.cgtProceeds} onChange={e=>si("cgtProceeds",e.target.value)} /></div>
              <div><label style={ss.lbl}>Cost base ($)</label><input type="number" style={ss.inp} min="0" step="0.01" value={itr.cgtCost} onChange={e=>si("cgtCost",e.target.value)} /></div>
              <div><label style={ss.lbl}>Current year capital losses ($)</label><input type="number" style={ss.inp} min="0" step="0.01" value={itr.cgtLosses} onChange={e=>si("cgtLosses",e.target.value)} /></div>
              <div><label style={ss.lbl}>Held &gt; 12 months?</label>
                <select style={ss.inp} value={itr.cgtDiscount} onChange={e=>si("cgtDiscount",e.target.value)}>
                  <option value="yes">Yes (50% discount)</option><option value="no">No</option>
                </select>
              </div>
            </div>
            <div style={{marginTop:8}}><button style={{...ss.outline,...ss.sm}} onClick={applyCGT}>Apply to "Capital gains — Net assessable"</button></div>
          </div>

          <div style={ss.sec}>
            <h3 style={ss.h3}>Medicare Levy Surcharge (MLS) settings</h3>
            <div style={ss.grid}>
              <div><label style={ss.lbl}>Family status for MLS</label>
                <select style={ss.inp} value={itr.mlsFamily} onChange={e=>si("mlsFamily",e.target.value)}>
                  <option value="single">Single</option><option value="family">Family</option>
                </select>
              </div>
              <div><label style={ss.lbl}>Number of dependent children (for MLS)</label><input type="number" style={ss.inp} min="0" step="1" value={itr.mlsChildren} onChange={e=>si("mlsChildren",e.target.value)} /></div>
              <div><label style={ss.lbl}>Private hospital cover for full year?</label>
                <select style={ss.inp} value={itr.mlsCover} onChange={e=>si("mlsCover",e.target.value)}>
                  <option value="yes">Yes</option><option value="no">No</option>
                </select>
              </div>
              <div><label style={ss.lbl}>SAPTO status</label>
                <select style={ss.inp} value={itr.saptoStatus} onChange={e=>si("saptoStatus",e.target.value)}>
                  <option value="none">Not eligible / under age</option>
                  <option value="single">Single</option>
                  <option value="couple">Couple (each)</option>
                  <option value="illness">Couple separated due to illness (each)</option>
                </select>
              </div>
            </div>
          </div>

          <div style={ss.sec}>
            <h3 style={ss.h3}>ITR Summary</h3>
            <table style={ss.table}>
              <tbody>
                {[
                  ["Total assessable income",`$${fmt(iAssess)}`],
                  ["Less: Deductions",`−$${fmt(iDtot)}`],
                  ["Taxable income",`$${fmt(iTaxable)}`],
                  ["HELP / MLS repayment income",`$${fmt(iRI)}`],
                  ["Income tax (ATO brackets)",`$${fmt(iTaxAft)}`],
                  ["Medicare levy (if applicable)",`$${fmt(iLevy)}`],
                  ["Medicare levy surcharge (if applicable)",`$${fmt(iMls)}`],
                  ["HELP / HECS repayment",`$${fmt(iHelp)}`],
                  ["Less: Offsets — Franking credits",`−$${fmt(iI.fc)}`],
                  ["Less: Foreign income tax offset (simplified)",`−$${fmt(iFito)}`],
                  ["Less: Low income tax offset (LITO)",`−$${fmt(iLito)}`],
                  ["Less: Seniors and pensioners offset (SAPTO)",`−$${fmt(iSapto)}`],
                  ["Less: PAYG withheld",`−$${fmt(iI.payg)}`],
                  ["Less: PAYG instalments",`−$${fmt(iI.paygi)}`],
                ].map(([l,v])=><tr key={l}><td style={ss.td}>{l}</td><td style={ss.tdr}>{v}</td></tr>)}
                <tr>
                  <td style={{...ss.td,fontWeight:700}}><b>Net balance (Payable + / Refund −)</b></td>
                  <td style={{...ss.tdr,fontWeight:700,color:iBal>=0?"#b30021":"#166534"}}>{iBal>=0?`$${fmt(iBal)}`:`−$${fmt(Math.abs(iBal))}`}</td>
                </tr>
              </tbody>
            </table>
            <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
              <button style={{...ss.outline,...ss.sm}} onClick={pullLedgers}>Pull from Ledgers</button>
              <button style={{...ss.primary,...ss.sm}} onClick={()=>{}}>Recalculate ITR</button>
            </div>
          </div>
          <div style={{fontSize:12,color:"#666",marginTop:8}}>⚠️ Indicative only. Always verify with your registered tax agent before lodging with the ATO.</div>
        </>}

      </div>
      <div style={{padding:"10px 18px",borderTop:`1px solid ${BORDER}`,fontSize:12,color:"#666",background:"#fff",textAlign:"center"}}>
        © Sharon's Accounting Service — Teal #006d6d · Purple #6a1b9a
      </div>
    </div>
  );
}

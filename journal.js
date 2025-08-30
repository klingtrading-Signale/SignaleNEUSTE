(function(){
  const KEY = "a_plus_plus_journal_v1";
  const $ = sel => document.querySelector(sel);
  function load(){ try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]} }
  function save(arr){ localStorage.setItem(KEY, JSON.stringify(arr)) }
  function isCrypto(m){ return ["BTC","DOGE","SOL","SHIB","XRP"].includes(m); }
  function tickValueFor(m){ if(m==="ES") return 12.5; if(m==="MES") return 1.25; if(m==="NQ") return 5; if(m==="MNQ") return 0.5; return 1; }
  function tickStepFor(m){ return isCrypto(m) ? 0.01 : 0.25; }
  window.Journal = { init, add, addFromSignal, mark:setStatus, manual:setManual, del:remove, render };
  function add(entry){ const all=load(); all.push(entry); save(all); render(); }
  function addFromSignal(signalObj, contracts=1, note=""){
    if(!signalObj){ alert("Kein Signal verfügbar."); return; }
    const row = { id: Date.now(), date: signalObj.date || new Date().toLocaleDateString("de-DE"),
      market: signalObj.market, side: signalObj.side, orderType: (signalObj.orderType||"Limit"),
      entry: Number(signalObj.entry), sl: Number(signalObj.sl),
      tp1: signalObj.tps?.[0] ?? null, tp2: signalObj.tps?.[1] ?? null, tp3: signalObj.tps?.[2] ?? null,
      crv: Number(signalObj.crv ?? 0), prob: Math.round((signalObj.tp1Prob||0)*100),
      contracts: Number(contracts||1), status: "OPEN", pnlTicks: 0, pnlUSD: 0, note: note||"" };
    add(row);
  }
  function remove(id){ save(load().filter(x=>x.id!==id)); render(); }
  function setManual(id){ const px = prompt("Exit-Preis (für P&L Berechnung):"); const exit = Number(px); if(!isNaN(exit)) setStatus(id, "MANUAL", exit); }
  function setStatus(id, status, exitPrice){
    const all = load(); const idx = all.findIndex(x=>x.id===id); if(idx<0) return; const row = all[idx]; row.status = status;
    let exit = exitPrice; if(exit==null){ if(status==="SL") exit = row.sl; if(status==="TP1") exit = row.tp1; if(status==="TP2") exit = row.tp2; if(status==="TP3") exit = row.tp3; }
    if(exit!=null){ const step=tickStepFor(row.market); const tv=tickValueFor(row.market); const dir=row.side==="long"?1:-1; const pts=(exit-row.entry)*dir; const ticks=Math.round(pts/step);
      row.pnlTicks = ticks*(row.contracts||1); row.pnlUSD = (ticks*tv)*(row.contracts||1); }
    save(all); render();
  }
  function stats(rows){ const done=rows.filter(x=>x.status!=="OPEN");
    const wins = done.filter(x=>x.status?.startsWith("TP")).length + done.filter(x=>x.pnlUSD>0 && !x.status?.startsWith("TP") && x.status!=="SL").length;
    const hit = done.length ? Math.round(100*wins/done.length) : 0;
    const ticks=done.reduce((s,x)=>s+(x.pnlTicks||0),0); const usd=done.reduce((s,x)=>s+(x.pnlUSD||0),0);
    return {trades:rows.length, closed:done.length, hit, ticks, usd}; }
  function render(){
    const all = load(); const mf = $("#ajsJournalMarketFilter")?.value || "ALL"; const rf = $("#ajsJournalResultFilter")?.value || "ALL";
    let filtered=all; if(mf!=="ALL") filtered=filtered.filter(x=>x.market===mf);
    if(rf!=="ALL"){ if(rf==="OPEN") filtered=filtered.filter(x=>x.status==="OPEN"); else filtered=filtered.filter(x=>x.status===rf); }
    const s=stats(filtered);
    $("#ajsJournalStats").innerHTML = `<div class="ajs-stat">Trades: <strong>${s.trades}</strong></div>
      <div class="ajs-stat">Geschlossen: <strong>${s.closed}</strong></div>
      <div class="ajs-stat">Trefferquote: <strong>${s.hit}%</strong></div>
      <div class="ajs-stat">Ticks: <strong>${s.ticks}</strong></div>
      <div class="ajs-stat">Summe (USD): <strong>${s.usd.toFixed(2)}</strong></div>`;
    const rows = filtered.map(x=>`<tr>
        <td>${x.date}</td><td>${x.market}</td><td>${x.side?.toUpperCase()||""}</td><td>${x.orderType||""}</td>
        <td>${x.entry ?? ""}</td><td>${x.sl ?? ""}</td><td>${x.tp1 ?? "-"}</td>
        <td>${x.crv ?? ""}</td><td>${x.prob ?? ""}%</td>
        <td>${x.contracts ?? ""}</td><td>${x.status}</td>
        <td>
          <button onclick="Journal.mark(${x.id}, 'TP1')">TP1</button>
          <button onclick="Journal.mark(${x.id}, 'TP2')">TP2</button>
          <button onclick="Journal.mark(${x.id}, 'TP3')">TP3</button>
          <button onclick="Journal.mark(${x.id}, 'SL')">SL</button>
          <button onclick="Journal.manual(${x.id})">Manuell</button>
          <button onclick="Journal.del(${x.id})">Löschen</button>
        </td></tr>`).join("");
    $("#ajsJournalTable").innerHTML = `<div class="ajs-table"><table>
      <thead><tr><th>Datum</th><th>Markt</th><th>Richtung</th><th>Order</th>
      <th>Entry</th><th>SL</th><th>TP1</th><th>CRV</th><th>W'keit</th>
      <th>Kontrakte</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows||""}</tbody></table></div>`;
  }
  function exportCSV(){
    const all = load(); const header=["id","date","market","side","orderType","entry","sl","tp1","tp2","tp3","crv","prob","contracts","status","pnlTicks","pnlUSD","note"];
    const lines=[header.join(",")];
    for(const x of all){ const row=header.map(k=> (x[k]!==undefined&&x[k]!==null)? String(x[k]).replace(/,/g,"."):"").join(","); lines.push(row); }
    const blob=new Blob([lines.join("\n")],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="journal.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function init(){
    document.getElementById("ajsJournalMarketFilter")?.addEventListener("change", render);
    document.getElementById("ajsJournalResultFilter")?.addEventListener("change", render);
    document.getElementById("ajsExportCSV")?.addEventListener("click", exportCSV);
    document.getElementById("ajsClearJournal")?.addEventListener("click", ()=>{ if(confirm("Journal wirklich leeren?")){ localStorage.setItem(KEY,"[]"); render(); } });
    render();
  }
  document.addEventListener("DOMContentLoaded", ()=>{
    init();
    const btn=document.getElementById("ajsJournalAddBtn");
    if(btn){
      btn.addEventListener("click", ()=>{
        if(!window.LAST_SIGNAL){ alert("Kein aktives Signal zum Übernehmen."); return; }
        const c = prompt("Kontrakte (z.B. 1):", "1");
        const note = prompt("Notiz (optional):", "");
        addFromSignal(window.LAST_SIGNAL, Number(c||1), note||"");
      });
    }
  });
})();
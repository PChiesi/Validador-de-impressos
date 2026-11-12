/* ---------------- report ---------------- */
function reportRows(){
  const head = ["Arquivo", "Pasta", "Formato", "Páginas", "Situação", "IOF", "Detalhe IOF", forbLabel(), `Detalhe ${forbLabel()}`, "Frase obrigatória", "Similaridade (%)", "Diferenças na frase", "Ação sugerida", "Observações"];
  const rows = entries.filter(e => e.state === "done" || e.state === "err").map(e => {
    if (e.state === "err") return [e.name, e.dir || "", e.ext.toUpperCase(), e.pages || "", "Erro", "", "", "", "", "", "", "", "Abrir o arquivo e verificar manualmente", e.error];
    const r = e.result, ch = chipTexts(r);
    const iofD = r.iof.values.map(v => `${v.where}: ${v.raw}`).join("; ") || (r.iof.mentions.length ? `${r.iof.mentions.length} citação(ões) sem valor` : "");
    const forbD = Object.entries(r.forb.byTerm).map(([t, n]) => `${t} ${n}x`).join("; ") + (r.forb.hits.length ? ` (${[...new Set(r.forb.hits.map(h => h.where))].join(", ")})` : "");
    const diffs = r.phr.results.flatMap(p => (p.blocks || []).map(b => b.kind === "fuzzy" ? `${b.got} ≈ ${b.exp}` : !b.got ? `falta: ${b.exp}` : !b.exp ? `a mais: ${b.got}` : `${b.exp} → ${b.got}`)).join("; ");
    return [e.name, e.dir || "", e.ext.toUpperCase(), e.pages || "", OV[r.overall][1], ch[0][1], iofD, ch[1][1], forbD, ch[2][1], phrasePct(r) ?? "", diffs, actionsFor(e).join("; "), [...e.unread, ...e.notes].join(" ")];
  });
  return [head, ...rows];
}
async function copyReport(){
  const tsv = reportRows().map(r => r.map(c => String(c).replace(/[\t\n]+/g, " ")).join("\t")).join("\n");
  try { await navigator.clipboard.writeText(tsv); toast("Relatório copiado — cole no Excel."); }
  catch(e){
    const ta = document.createElement("textarea"); ta.value = tsv; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Relatório copiado — cole no Excel."); } catch(_){ toast("Não foi possível copiar."); }
    ta.remove();
  }
}
async function downloadXlsx(){
  try {
    await loadScript(LIBS.xlsx);
    const ws = XLSX.utils.aoa_to_sheet(reportRows());
    ws["!cols"] = [38, 40, 8, 8, 14, 20, 36, 20, 36, 26, 12, 46, 46, 40].map(w => ({ wch: w })); ws["!autofilter"] = { ref: ws["!ref"] };
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Validação");
    const d = new Date(); const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const ok = await saveBlob(new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `validacao-reforma-tributaria-${stamp}.xlsx`);
    if (ok) toast("Excel gerado.");
  } catch(e){ toast("Não foi possível gerar o Excel aqui — use “Copiar relatório”."); }
}

async function saveBlob(blob, name){
  // hospedagens que bloqueiam download direto podem expor window.__saveFile(blob, nome) → true/false
  if (typeof window.__saveFile === "function"){
    try { const r = await window.__saveFile(blob, name); if (r !== undefined) return r; } catch(e){ return false; }
  }
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
async function downloadHtmlReport(){
  const pending = entries.some(e => e.state === "run" || e.state === "q") || entries.some(e => shotRequests(e).some(q => q.shotState === "pending"));
  if (pending) toast("Ainda há arquivos ou prints em processamento — o relatório sai com o que já está pronto.");
  const img = q => q && q.shotState === "done" && q.shot ? `<img src="${q.shot}" alt="">` : "";
  const col = STATUS_COLORS_PRINT;
  const chip = (s, t) => `<span class="c" style="color:${col[s] || col.na};border-color:${col[s] || col.na}">${esc(t)}</span>`;
  const d = new Date(); const stamp = d.toLocaleString("pt-BR");
  const done = entries.filter(e => e.state === "done" || e.state === "err");
  const st = dashStats();
  const imgs = exportChartImages(st);
  const chartImg = id => imgs[id] ? `<img class="ch" src="${imgs[id]}" alt="">` : "";
  const kp = (v, l) => `<div class="k"><b>${v}</b><span>${l}</span></div>`;
  const exec = `<section class="exec"><h2>Resumo executivo</h2>
    <div class="kpis">${kp(st.total, "documentos")}${kp(st.rate + "%", "conformidade")}${kp(st.c.ok, "conformes")}${kp(st.c.warn, "para revisar")}${kp(st.c.fail, "não conformes")}${kp(st.pages, "páginas lidas")}</div>
    <h3>Leitura do resultado</h3><ul class="ins">${buildInsights(st).map(i => `<li>${i.html}</li>`).join("")}</ul>
    <div class="charts">${chartImg("status")}${chartImg("rules")}${chartImg("folders")}${chartImg("simil")}</div>
    <h3>Pendências prioritárias</h3>${pendingTableHtml(st, 200, true)}</section>`;
  const body = done.map(e => {
    const path = e.dir ? `<div class="p">📁 ${esc(e.dir)}</div>` : "";
    if (e.state === "err") return `<section><h2>${esc(e.name)} ${chip("fail", "Erro")}</h2>${path}<p>${esc(e.error)}</p></section>`;
    const r = e.result, ch = chipTexts(r);
    const iof = r.iof.values.map(v => `<div class="ev"><div class="w">${esc(v.where)} · ${esc(v.how)} · valor <b style="color:${v.zero ? col.ok : col.fail}">${esc(v.raw)}</b></div>${img(v)}</div>`).join("")
      + r.iof.mentions.map(m => `<div class="ev"><div class="w">${esc(m.where)} · citação sem valor</div>${img(m)}</div>`).join("");
    const forb = r.forb.hits.map(h => `<div class="ev"><div class="w">${esc(h.where)} · ${esc(h.term)}</div><p>${h.html}</p>${img(h)}</div>`).join("");
    const phr = r.phr.results.map(p => `<div class="ev"><div class="w">${p.status === "ok" ? "Encontrada exatamente (100%)" : (p.pct ?? Math.round(p.score * 100)) + "% de similaridade"}${p.where ? " · " + esc(p.where) : ""}</div>${(p.blocks || []).length ? `<ul class="df">${p.blocks.slice(0, 8).map(b => `<li>${b.kind === "fuzzy" ? `leitura: <i>${esc(b.got)}</i> ≈ ${esc(b.exp)}` : !b.got ? `falta: <b>${esc(b.exp)}</b>` : !b.exp ? `a mais: <i>${esc(b.got)}</i>` : `esperado <b>${esc(b.exp)}</b> → encontrado <i>${esc(b.got)}</i>`}</li>`).join("")}</ul>` : ""}${p.status !== "ok" && p.found ? `<p>${esc(p.found)}</p>` : ""}${img(p.shotReq)}</div>`).join("");
    return `<section><h2>${esc(e.name)} ${chip(r.overall, OV[r.overall][1])}</h2>${path}<p class="chips">${ch.map(([s, t]) => chip(s, t)).join(" ")}</p>
      <h3>IOF</h3>${iof || "<p>O documento não menciona IOF.</p>"}
      <h3>${esc(forbLabel())}</h3>${forb || "<p>Nenhuma menção encontrada.</p>"}
      <h3>Frase obrigatória</h3>${phr || "<p>Não encontrada.</p>"}
      ${[...e.unread, ...e.notes].length ? `<p class="n">${[...e.unread, ...e.notes].map(esc).join("<br>")}</p>` : ""}</section>`;
  }).join("");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Validação de impressos — Reforma Tributária — ${esc(stamp)}</title><style>
    body{font:14px/1.5 "IBM Plex Sans",Arial,Helvetica,sans-serif;color:#151B19;max-width:1040px;margin:0 auto;padding:0 24px 40px}
    header{background:#0B6B47;color:#fff;margin:0 -24px 24px;padding:28px 24px}header h1{margin:0;font-size:24px}header p{margin:6px 0 0;opacity:.85;font-size:13px}
    h2{font-size:17px;margin:0 0 6px}h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#4D5754;margin:18px 0 8px}
    section{border-top:2px solid #151B19;padding:16px 0 20px}section.exec{border-top:0}
    .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.k{border:1px solid #DADFDD;border-radius:10px;padding:12px}.k b{display:block;font-size:22px}.k span{font-size:12px;color:#66716D}
    .charts{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.ch{width:100%;border:1px solid #DADFDD;border-radius:10px;padding:8px;box-sizing:border-box;background:#fff}
    .ins li{margin:0 0 6px}table{width:100%;border-collapse:collapse;font-size:12.5px}th,td{border-bottom:1px solid #DADFDD;padding:7px 8px;text-align:left;vertical-align:top}th{background:#F5F7F6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#4D5754}
    .c{display:inline-block;font-size:12px;font-weight:700;border:1px solid;border-radius:4px;padding:1px 7px;margin-right:4px}
    .ev{margin:0 0 12px}.w{font-size:12px;color:#4D5754;margin-bottom:4px}.p{font-family:monospace;font-size:12px;color:#66716D;margin-bottom:6px}.df{margin:4px 0;font-size:12.5px}
    img{max-width:100%;border:1px solid #DADFDD;border-radius:4px;display:block;page-break-inside:avoid}
    mark{background:#FFE58A}.n{font-size:12px;color:#4D5754}
    @media print{header{-webkit-print-color-adjust:exact;print-color-adjust:exact}section{page-break-inside:auto}.charts{page-break-inside:avoid}}
    @media (max-width:700px){.kpis{grid-template-columns:repeat(2,1fr)}.charts{grid-template-columns:1fr}}
    </style></head><body><header><h1>Validação de impressos — Reforma Tributária</h1><p>Gerado em ${esc(stamp)} · ${done.length} documento(s) · Frase: “${esc(cfg.phrases.join(" | "))}” · Termos proibidos: ${esc(cfg.forbidden)} · Rótulos IOF: ${esc(cfg.iofTerms)} · Similaridade mínima: ${cfg.simil}%</p></header>${exec}<h2 style="margin-top:24px">Evidências por documento</h2>${body}</body></html>`;
  try { const ok = await saveBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `relatorio-impressos-reforma-tributaria-${d.toISOString().slice(0, 10)}.html`); if (ok) toast("Relatório gerado. Abra no navegador e use Ctrl+P para salvar em PDF."); }
  catch(e){ toast("Não foi possível baixar o relatório aqui."); }
}

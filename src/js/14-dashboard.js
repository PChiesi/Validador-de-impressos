/* ---------------- relatório executivo (gráficos + leitura) ---------------- */
const STATUS_COLORS = { ok: "#16A34A", warn: "#D97706", fail: "#E11D48", pend: "#94A3A0", na: "#A3ADA9", err: "#E11D48" };
const STATUS_COLORS_PRINT = { ok: "#15803D", warn: "#B45309", fail: "#BE123C", na: "#66716D" };
const charts = {};
const isDark = () => document.documentElement.classList.contains("dark");
const theme = dark => dark
  ? { text: "#C5CDCA", sub: "#8F9A96", grid: "rgba(255,255,255,.07)", card: "#151B19", font: '"IBM Plex Sans", system-ui, sans-serif' }
  : { text: "#38413E", sub: "#66716D", grid: "rgba(13,17,16,.07)", card: "#FFFFFF", font: '"IBM Plex Sans", system-ui, sans-serif' };
let dirPrefix = [];
function computeDirPrefix(){
  const dirs = entries.map(e => e.dir).filter(Boolean).map(d => d.split("/"));
  if (!dirs.length){ dirPrefix = []; return; }
  let pre = dirs[0].slice();
  for (const d of dirs){ let i = 0; while (i < pre.length && i < d.length && pre[i] === d[i]) i++; pre = pre.slice(0, i); }
  if (dirs.some(d => d.length === pre.length)) pre = pre.slice(0, -1);   // mantém ao menos um nível visível
  dirPrefix = pre;
}
const shortDir = d => {
  if (!d) return "(arquivos soltos)";
  let p = d.split("/");
  if (dirPrefix.length && dirPrefix.every((x, i) => p[i] === x)) p = p.slice(dirPrefix.length);
  const s = p.join(" / ");
  const lim = window.innerWidth < 640 ? 24 : 40; return s.length > lim ? "… " + s.slice(-(lim - 2)) : s;
};

function actionsFor(e){
  if (e.state === "err") return ["Abrir o arquivo e verificar manualmente (falha na leitura)"];
  const r = e.result, a = [];
  if (r.iof.status === "fail") a.push("Zerar o valor de IOF");
  if (r.iof.status === "warn") a.push("Conferir o IOF no print (valor não legível)");
  if (r.forb.status === "fail") a.push(`Remover a menção a ${Object.keys(r.forb.byTerm).join("/")}`);
  for (const p of r.phr.results){
    if (p.status === "fail") a.push("Incluir a frase da CBS");
    else if (p.status === "warn"){
      const num = (p.blocks || []).find(b => /\d/.test(b.exp) && /\d/.test(b.got));
      a.push(num ? `Corrigir a frase da CBS (${num.exp} → está ${num.got})` : "Ajustar a redação da frase da CBS");
    }
  }
  if (e.unread.length) a.push("Conferir páginas que não puderam ser lidas");
  if (r.empty) a.push("Documento sem texto legível — conferir manualmente");
  return a;
}

function dashStats(){
  computeDirPrefix();
  const list = entries;
  const c = counts(list), done = c.ok + c.warn + c.fail;
  const fin = list.filter(e => e.state === "done");
  const rule = key => { const o = { ok: 0, warn: 0, fail: 0, na: 0 }; fin.forEach(e => o[e.result[key].status]++); return o; };
  const reasons = { iofFail: 0, iofWarn: 0, forb: 0, phrAbs: 0, phrDiv: 0, unread: 0, err: 0, empty: 0 };
  const numDiff = new Map();
  let pages = 0, ocrPages = 0, unreadPages = 0, shots = 0;
  for (const e of list){
    if (e.state === "err"){ reasons.err++; continue; }
    if (e.state !== "done") continue;
    const r = e.result;
    pages += e.pages || 0;
    ocrPages += e.segments.filter(s => s.ocr).length;
    unreadPages += e.unread.length;
    shots += shotRequests(e).filter(q => q.shotState === "done").length;
    if (r.iof.status === "fail") reasons.iofFail++;
    if (r.iof.status === "warn") reasons.iofWarn++;
    if (r.forb.status === "fail") reasons.forb++;
    if (r.phr.results.some(p => p.status === "fail")) reasons.phrAbs++;
    else if (r.phr.results.some(p => p.status === "warn")) reasons.phrDiv++;
    if (e.unread.length) reasons.unread++;
    if (r.empty) reasons.empty++;
    for (const p of r.phr.results) for (const b of p.blocks || []){
      if (/\d/.test(b.exp) && /\d/.test(b.got)){ const k = `${b.exp} → ${b.got}`; numDiff.set(k, (numDiff.get(k) || 0) + 1); }
    }
  }
  const folders = new Map();
  for (const e of list){ const k = e.dir || ""; if (!folders.has(k)) folders.set(k, []); folders.get(k).push(e); }
  const folderStats = [...folders.entries()].map(([dir, es]) => ({ dir, c: counts(es) })).sort((a, b) => b.c.all - a.c.all);
  const buckets = [["100%", 100, 101], ["90–99%", 90, 100], ["80–89%", 80, 90], ["70–79%", 70, 80], ["50–69%", 50, 70], ["< 50%", 0, 50]].map(([l, lo, hi]) => ({ l, lo, hi, n: 0 }));
  for (const e of fin){ const p = phrasePct(e.result); if (p == null) continue; const b = buckets.find(b => p >= b.lo && p < b.hi); if (b) b.n++; }
  const pend = list.filter(e => e.state === "err" || (e.state === "done" && e.result.overall !== "ok"))
    .sort((a, b) => (stateOf(a) === "warn") - (stateOf(b) === "warn") || (a.dir || "").localeCompare(b.dir || "", "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
  return { c, done, total: c.all, rate: done ? Math.round(c.ok / done * 100) : 0, rules: { iof: rule("iof"), forb: rule("forb"), phr: rule("phr") }, reasons, numDiff, pages, ocrPages, unreadPages, shots, folderStats, buckets, pend, fin };
}

const pctOf = (n, d) => d ? Math.round(n / d * 100) : 0;
function buildInsights(st){
  const out = [], { c, done } = st;
  const ii = (icon, tone, html) => out.push({ icon, tone, html });
  if (!st.total) return out;
  if (c.pend) ii("fa-hourglass-half", "all", `<b>${done}</b> de <b>${st.total}</b> documentos já analisados; os números se atualizam a cada arquivo concluído.`);
  if (done){
    const tone = st.rate >= 90 ? "ok" : st.rate >= 60 ? "warn" : "fail";
    ii("fa-gauge-high", tone, `<b>${st.rate}%</b> dos documentos analisados estão <b>conformes</b> (${c.ok} de ${done}). ${c.fail ? `<b>${c.fail}</b> não conforme${c.fail > 1 ? "s" : ""}` : "Nenhum não conforme"}${c.warn ? ` e <b>${c.warn}</b> para revisar` : ""}.`);
  }
  const r = st.reasons;
  const causes = [
    [r.phrAbs, "frase da CBS ausente"], [r.forb, `menção a ${forbLabel()}`], [r.iofFail, "IOF com valor diferente de zero"],
    [r.phrDiv, "frase da CBS com divergência"], [r.iofWarn, "IOF citado sem valor legível"], [r.err, "falha na leitura do arquivo"], [r.unread, "páginas sem texto legível"],
  ].filter(x => x[0]).sort((a, b) => b[0] - a[0]);
  if (causes.length){
    const [n, label] = causes[0];
    ii("fa-ranking-star", "fail", `Principal motivo de pendência: <b>${label}</b> (${n} documento${n > 1 ? "s" : ""}).${causes.length > 1 ? " Em seguida: " + causes.slice(1, 3).map(([k, l]) => `${l} (${k})`).join("; ") + "." : ""}`);
  } else if (done) ii("fa-circle-check", "ok", "Nenhuma pendência encontrada nos documentos analisados.");
  if (st.numDiff.size){
    const top = [...st.numDiff.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    ii("fa-percent", "warn", `Valores divergentes na frase da CBS: ${top.map(([k, n]) => `<b>${esc(k)}</b> em ${n} documento${n > 1 ? "s" : ""}`).join("; ")}. Normalmente indicam texto antigo ainda não atualizado.`);
  }
  const withIssues = st.folderStats.filter(f => f.dir && (f.c.fail + f.c.warn) > 0);
  if (withIssues.length){
    const totalIssues = c.fail + c.warn;
    const top = withIssues.sort((a, b) => (b.c.fail + b.c.warn) - (a.c.fail + a.c.warn)).slice(0, 2);
    ii("fa-folder-tree", "warn", `Pastas com mais pendências: ${top.map(f => `<b>${esc(shortDir(f.dir))}</b> (${f.c.fail + f.c.warn} de ${f.c.all}, ${pctOf(f.c.fail + f.c.warn, totalIssues)}% do total)`).join(" e ")}.`);
  }
  if (st.ocrPages || st.unreadPages) ii("fa-eye", "all", `${st.ocrPages ? `<b>${st.ocrPages}</b> página(s) ou imagem(ns) lidas por OCR — os prints marcados “OCR” merecem conferência visual.` : ""}${st.unreadPages ? ` <b>${st.unreadPages}</b> página(s) não puderam ser lidas.` : ""}`);
  if (done && (c.fail || c.warn)) ii("fa-flag-checkered", "brand", `Recomendação: ${c.fail ? `tratar primeiro ${c.fail === 1 ? "o documento <b>não conforme</b>" : `os <b>${c.fail}</b> documentos não conformes`}, usando a tabela de pendências e os prints como evidência` : "não há documentos não conformes"}${c.warn ? `; depois revisar ${c.warn === 1 ? "o caso" : `os <b>${c.warn}</b> casos`} com divergência` : ""}.`);
  return out;
}

function pendingTableHtml(st, limit = 25, plain = false){
  if (!st.pend.length) return plain ? "<p>Nenhuma pendência.</p>" : `<tbody><tr><td class="!py-10 text-center text-ink-500" colspan="4"><i class="fa-solid fa-circle-check mr-2 text-emerald-500"></i>Nenhuma pendência até aqui.</td></tr></tbody>`;
  const rows = st.pend.slice(0, limit).map(e => {
    const s = stateOf(e), [stc, lab] = ST_META[s] || ST_META.q;
    const acts = actionsFor(e);
    if (plain) return `<tr><td>${esc(e.name)}</td><td>${esc(e.dir || "—")}</td><td>${esc(lab)}</td><td>${acts.map(esc).join("<br>")}</td></tr>`;
    return `<tr data-goto="${e.id}"><td><div class="font-semibold text-ink-900 dark:text-white" style="overflow-wrap:anywhere">${esc(e.name)}</div>${e.dir ? `<div class="mt-0.5 font-mono text-[11px] text-ink-400">${esc(e.dir)}</div>` : ""}</td><td><span class="badge ${stc}">${esc(lab)}</span></td><td>${acts.map(a => `<div class="flex gap-1.5"><i class="fa-solid fa-arrow-right mt-1 text-[9px] text-brand-500"></i><span>${esc(a)}</span></div>`).join("")}</td></tr>`;
  }).join("");
  const head = plain ? "<tr><th>Documento</th><th>Pasta</th><th>Situação</th><th>Ação sugerida</th></tr>" : "<tr><th>Documento</th><th>Situação</th><th>Ação sugerida</th></tr>";
  return plain ? `<table><thead>${head}</thead><tbody>${rows}</tbody></table>` : `<thead>${head}</thead><tbody>${rows}</tbody>`;
}

/* ---- configurações de gráfico ---- */
function chartBase(t, extra = {}){
  return Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 600, easing: "easeOutCubic" },
    plugins: { legend: { labels: { color: t.text, font: { family: t.font, size: 12 }, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded",
        filter: (item, data) => item.index != null && data.datasets.length === 1 ? (data.datasets[0].data[item.index] || 0) > 0 : (data.datasets[item.datasetIndex] ? data.datasets[item.datasetIndex].data.some(v => v > 0) : true) } },
      tooltip: { backgroundColor: "#151B19", titleFont: { family: t.font, weight: "600" }, bodyFont: { family: t.font }, padding: 10, cornerRadius: 8, displayColors: true } } }, extra);
}
const axis = (t, o = {}) => Object.assign({ ticks: { color: t.sub, font: { family: t.font, size: 11 } }, grid: { color: t.grid }, border: { display: false } }, o);
function cfgStatus(st, t){
  return { type: "doughnut", data: { labels: ["Conformes", "Revisar", "Não conformes", "Em análise"], datasets: [{ data: [st.c.ok, st.c.warn, st.c.fail, st.c.pend], backgroundColor: [STATUS_COLORS.ok, STATUS_COLORS.warn, STATUS_COLORS.fail, STATUS_COLORS.pend], borderColor: t.card, borderWidth: 3, hoverOffset: 6 }] },
    options: chartBase(t, { cutout: "72%", plugins: Object.assign(chartBase(t).plugins, { legend: { position: "bottom", labels: chartBase(t).plugins.legend.labels } }) }) };
}
function cfgRules(st, t){
  const R = st.rules, labels = ["IOF", forbLabel(), "Frase CBS"], keys = ["iof", "forb", "phr"];
  const ds = (label, k, color) => ({ label, data: keys.map(x => R[x][k]), backgroundColor: color, borderRadius: 4, barThickness: 22 });
  return { type: "bar", data: { labels, datasets: [ds("Atende", "ok", STATUS_COLORS.ok), ds("Revisar", "warn", STATUS_COLORS.warn), ds("Não atende", "fail", STATUS_COLORS.fail), ds("Não se aplica", "na", STATUS_COLORS.na)] },
    options: chartBase(t, { indexAxis: "y", scales: { x: axis(t, { stacked: true, ticks: { color: t.sub, precision: 0, font: { family: t.font, size: 11 } } }), y: axis(t, { stacked: true, grid: { display: false }, ticks: { color: t.text, font: { family: t.font, size: 12, weight: "600" } } }) } }) };
}
function cfgFolders(st, t){
  const top = st.folderStats.slice(0, 10);
  const ds = (label, k, color) => ({ label, data: top.map(f => f.c[k]), backgroundColor: color, borderRadius: 3, maxBarThickness: 18 });
  return { type: "bar", data: { labels: top.map(f => shortDir(f.dir)), datasets: [ds("Conformes", "ok", STATUS_COLORS.ok), ds("Revisar", "warn", STATUS_COLORS.warn), ds("Não conformes", "fail", STATUS_COLORS.fail), ds("Em análise", "pend", STATUS_COLORS.pend)] },
    options: chartBase(t, { indexAxis: "y", scales: { x: axis(t, { stacked: true, ticks: { color: t.sub, precision: 0, font: { family: t.font, size: 11 } } }), y: axis(t, { stacked: true, grid: { display: false }, ticks: { color: t.text, font: { family: t.font, size: 11.5 } } }) } }) };
}
function cfgSimil(st, t){
  const colors = st.buckets.map(b => b.lo >= 100 ? STATUS_COLORS.ok : b.lo >= cfg.simil || (b.hi > cfg.simil && b.lo < 100) ? STATUS_COLORS.warn : STATUS_COLORS.fail);
  return { type: "bar", data: { labels: st.buckets.map(b => b.l), datasets: [{ label: "Documentos", data: st.buckets.map(b => b.n), backgroundColor: colors, borderRadius: 6, maxBarThickness: 46 }] },
    options: chartBase(t, { plugins: Object.assign(chartBase(t).plugins, { legend: { display: false } }), scales: { x: axis(t, { grid: { display: false } }), y: axis(t, { ticks: { color: t.sub, precision: 0, font: { family: t.font, size: 11 } }, beginAtZero: true }) } }) };
}
const CHART_DEFS = { status: ["chStatus", cfgStatus], rules: ["chRules", cfgRules], folders: ["chFolders", cfgFolders], simil: ["chSimil", cfgSimil] };

function upsertChart(key, st){
  if (!window.Chart) return;
  const [id, build] = CHART_DEFS[key];
  const conf = build(st, theme(isDark()));
  const ch = charts[key];
  if (ch && ch._dark === isDark()){
    ch.data.labels = conf.data.labels;
    conf.data.datasets.forEach((d, i) => { if (ch.data.datasets[i]){ ch.data.datasets[i].data = d.data; ch.data.datasets[i].backgroundColor = d.backgroundColor; ch.data.datasets[i].label = d.label; } else ch.data.datasets.push(d); });
    ch.update();
    return;
  }
  if (ch) ch.destroy();
  const canvas = $(id);
  conf.options.onClick = (ev, els) => chartClick(key, els, st);
  conf.options.onHover = (ev, els) => { ev.native && (ev.native.target.style.cursor = els.length ? "pointer" : "default"); };
  charts[key] = new Chart(canvas, conf);
  charts[key]._dark = isDark();
}
function chartClick(key, els, st){
  if (!els.length) return;
  const i = els[0].index, di = els[0].datasetIndex;
  if (key === "status"){ filter = ["ok", "warn", "fail", "all"][i]; folderFilter = null; go("analise"); render(); }
  if (key === "folders"){ const f = st.folderStats[i]; folderFilter = f && f.dir ? f.dir : null; filter = ["ok", "warn", "fail", "all"][di] || "all"; go("analise"); render(); }
}

let dashTimer = null, dashDirty = true;
function scheduleDashboard(){ dashDirty = true; if (currentView !== "relatorio") return; if (dashTimer) return; dashTimer = setTimeout(() => { dashTimer = null; renderDashboard(); }, 450); }
function renderDashboard(force){
  if (!force && !dashDirty) return;
  dashDirty = false;
  const st = dashStats();
  const has = st.total > 0;
  $("repEmpty").hidden = has; $("repBody").hidden = !has;
  $("repLive").hidden = !st.c.pend;
  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  $("repStamp").innerHTML = !has ? "Os números e a leitura abaixo se atualizam enquanto os documentos são analisados."
    : st.c.pend ? `<i class="fa-solid fa-circle-notch fa-spin mr-1 text-brand-600"></i>Em andamento — ${st.done} de ${st.total} documentos analisados · atualizado às ${now}`
    : `${examples ? "Dados de exemplo · " : ""}${st.total} documento(s) analisado(s) · atualizado às ${now}`;
  if (!has) return;
  const k = (v, l, s, tone) => `<div class="rkpi"><div class="flex items-center justify-between"><span class="l !mt-0">${l}</span>${tone ? `<span class="h-2 w-2 rounded-full" style="background:${STATUS_COLORS[tone]}"></span>` : ""}</div><div class="v mt-3">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
  $("repKpis").innerHTML = k(st.total, "Documentos", st.c.pend ? `${st.c.pend} em análise` : "todos concluídos")
    + k(st.rate + "%", "Conformidade", `${st.c.ok} de ${st.done} analisados`, "ok")
    + k(st.c.fail, "Não conformes", `${pctOf(st.c.fail, st.done)}% dos analisados`, "fail")
    + k(st.c.warn, "Para revisar", `${pctOf(st.c.warn, st.done)}% dos analisados`, "warn")
    + k(st.pages, "Páginas lidas", st.ocrPages ? `${st.ocrPages} com OCR` : "texto digital")
    + k(st.shots, "Prints gerados", "evidências anexadas");
  $("chStatusN").textContent = st.rate + "%";
  const nFold = Math.min(10, st.folderStats.length);
  $("chFoldersBox").style.height = Math.max(200, 60 + nFold * 34) + "px";
  $("chFoldersHint").textContent = st.folderStats.length > 10 ? `10 de ${st.folderStats.length} pastas · clique para filtrar` : "clique para filtrar";
  for (const key of Object.keys(CHART_DEFS)) upsertChart(key, st);
  const tones = { ok: "tone-ok", warn: "tone-warn", fail: "tone-fail", all: "tone-all", brand: "bg-brand-600 text-white" };
  const ins = buildInsights(st);
  const insKey = ins.map(i => i.html).join("|");
  if ($("insights").dataset.k !== insKey){
    $("insights").dataset.k = insKey;
    $("insights").innerHTML = ins.map((i, n) => `<li class="insight" style="animation-delay:${n * 60}ms"><span class="ii ${tones[i.tone]}"><i class="fa-solid ${i.icon}"></i></span><span>${i.html}</span></li>`).join("");
  }
  $("pendTable").innerHTML = pendingTableHtml(st, 25);
  $("pendMeta").textContent = st.pend.length > 25 ? `25 de ${st.pend.length} · lista completa no Excel` : `${st.pend.length} documento(s)`;
}
function rebuildCharts(){ for (const k of Object.keys(charts)){ charts[k].destroy(); delete charts[k]; } dashDirty = true; if (currentView === "relatorio") renderDashboard(true); }

/* imagens dos gráficos para o relatório baixado (sempre no tema claro) */
function exportChartImages(st){
  const out = {};
  if (!window.Chart) return out;
  const t = theme(false);
  const size = { status: [560, 380], rules: [760, 380], folders: [760, Math.max(300, 80 + Math.min(10, st.folderStats.length) * 40)], simil: [560, 380] };
  for (const [key, [, build]] of Object.entries(CHART_DEFS)){
    const cv = document.createElement("canvas"); cv.width = size[key][0]; cv.height = size[key][1];
    const conf = build(st, t); conf.options.responsive = false; conf.options.animation = false; conf.options.devicePixelRatio = 2;
    conf.plugins = [{ id: "bg", beforeDraw: c => { const x = c.ctx; x.save(); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.restore(); } }];
    try { const ch = new Chart(cv, conf); out[key] = ch.toBase64Image("image/png", 1); ch.destroy(); } catch(e){}
  }
  return out;
}

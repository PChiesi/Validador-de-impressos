/* ---------------- rendering: análise ---------------- */
const ICON = {
  ok: '<i class="fa-solid fa-check"></i>',
  fail: '<i class="fa-solid fa-xmark"></i>',
  warn: '<i class="fa-solid fa-exclamation"></i>',
  na: '<i class="fa-solid fa-minus"></i>',
};
const ST_META = {
  ok: ["ok", "Conforme", "fa-circle-check"], warn: ["warn", "Revisar", "fa-triangle-exclamation"], fail: ["fail", "Não conforme", "fa-circle-xmark"],
  err: ["err", "Erro", "fa-bug"], run: ["run", "Lendo…", "fa-spinner fa-spin"], q: ["q", "Na fila", "fa-clock"],
};
const OV = { ok: ["ok", "Conforme"], warn: ["warn", "Revisar"], fail: ["fail", "Não conforme"] };
const STATUS_WORD = { ok: "OK", warn: "Revisar", fail: "Falhou", na: "N/A" };
function extIcon(ext){
  if (ext === "pdf") return "fa-file-pdf";
  if (ext === "docx" || ext === "doc" || ext === "rtf") return "fa-file-word";
  if (/^(xlsx|xls|csv)$/.test(ext)) return "fa-file-excel";
  if (ext === "pptx") return "fa-file-powerpoint";
  if (/^(png|jpe?g|bmp|gif|webp|tiff?)$/.test(ext)) return "fa-file-image";
  if (/^(htm|html|xml)$/.test(ext)) return "fa-file-code";
  return "fa-file-lines";
}
const forbLabel = () => termList(cfg.forbidden).map(t => t.toUpperCase()).join("/") || "Termos";
const phrasePct = r => r.phr.results.length ? Math.min(...r.phr.results.map(p => p.pct ?? Math.round(p.score * 100))) : null;
function chipTexts(r){
  const iofT = { ok: "IOF zerado", fail: "IOF com valor", warn: "IOF sem valor legível", na: "IOF não consta" }[r.iof.status];
  const fl = forbLabel();
  const forbT = { ok: `Sem ${fl}`, fail: `${Object.keys(r.forb.byTerm).join("/")} presente`, na: "Termos: sem regra" }[r.forb.status];
  const pct = phrasePct(r);
  const phrT = { ok: "Frase CBS exata", warn: `Frase CBS ${pct}% · divergente`, fail: pct ? `Frase CBS ausente · ${pct}%` : "Frase CBS ausente", na: "Frase: sem regra" }[r.phr.status];
  return [[r.iof.status, iofT], [r.forb.status, forbT], [r.phr.status, phrT]];
}
function stateOf(e){ return e.state === "done" ? e.result.overall : e.state === "err" ? "err" : e.state; }
const inFolder = (e, f) => !f || e.dir === f || e.dir.startsWith(f + "/");
function counts(list = entries){
  const c = { all: list.length, fail: 0, warn: 0, ok: 0, pend: 0 };
  list.forEach(e => { const s = stateOf(e); if (s === "err") c.fail++; else if (s === "q" || s === "run") c.pend++; else if (c[s] !== undefined) c[s]++; });
  return c;
}
const numAnim = {};
function setNum(id, to, fmt = v => v){
  const el = $(id); if (!el) return;
  const from = +el.dataset.v || 0; el.dataset.v = to;
  if (from === to){ el.textContent = fmt(to); return; }
  cancelAnimationFrame(numAnim[id]); const t0 = performance.now(), dur = 500;
  const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) numAnim[id] = requestAnimationFrame(step); };
  numAnim[id] = requestAnimationFrame(step);
}

function renderCounts(){
  const scope = entries.filter(e => inFolder(e, folderFilter));
  const c = counts(scope), done = c.ok + c.warn + c.fail;
  setNum("kpi-all-n", c.all); setNum("kpi-ok-n", c.ok); setNum("kpi-warn-n", c.warn); setNum("kpi-fail-n", c.fail);
  const pct = n => done ? Math.round(n / done * 100) + "%" : "—";
  $("kpi-all-p").textContent = c.pend ? `${c.pend} em análise` : (examples ? "exemplos" : (c.all ? "concluído" : "—"));
  $("kpi-ok-p").textContent = pct(c.ok); $("kpi-warn-p").textContent = pct(c.warn); $("kpi-fail-p").textContent = pct(c.fail);
  const rate = done ? Math.round(c.ok / done * 100) : 0;
  setNum("kpi-rate-n", rate);
  $("kpi-rate-bar").style.width = rate + "%";
  $("kpi-rate-meta").textContent = done ? `${c.ok} de ${done}` : "—";
  document.querySelectorAll("#kpis [data-filter]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
  const tab = (key, label, n) => `<button type="button" class="tab" data-filter="${key}" aria-pressed="${filter === key}">${label}<span class="n">${n}</span></button>`;
  $("tabs").innerHTML = tab("all", "Todos", c.all) + tab("fail", "Não conformes", c.fail) + tab("warn", "Revisar", c.warn) + tab("ok", "Conformes", c.ok);
  const fc = $("folderChip");
  fc.hidden = !folderFilter;
  if (folderFilter) fc.innerHTML = `<i class="fa-solid fa-folder-open"></i><span class="truncate">${esc(folderFilter)}</span><button type="button" data-clearfolder aria-label="Remover filtro de pasta"><i class="fa-solid fa-xmark"></i></button>`;
  // navegação
  const all = counts();
  $("navCount").textContent = all.all;
  $("navLive").hidden = !all.pend;
}

function renderProgress(){
  const total = entries.length, done = entries.filter(e => e.state === "done" || e.state === "err").length;
  const cur = entries.find(e => e.state === "run");
  const show = !!cur || (running && done < total);
  $("progress").hidden = !show;
  $("runPill").hidden = !show;
  if (show){
    $("progText").innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-brand-600 dark:text-brand-300"></i><span>Analisando <b>${Math.min(done + 1, total)}</b> de ${total}${cur ? ` — <span class="font-semibold">${esc(cur.name)}</span> · <span class="text-ink-500 dark:text-ink-400">${esc(cur.progress || "")}</span>` : ""}</span>`;
    $("progBar").style.width = (total ? (done / total) * 100 : 0) + "%";
    $("runPillTxt").textContent = `${done}/${total}`;
  }
  const cardP = cur && document.querySelector(`[data-prog="${cur.id}"]`);
  if (cardP) cardP.textContent = cur.progress || "";
}

/* ---- mapa da pasta ---- */
let treeOpen = new Set();
function buildTree(){
  const root = { name: "", path: "", kids: new Map(), docs: [] };
  for (const e of entries){
    if (!e.dir) continue;
    let node = root, acc = [];
    for (const part of e.dir.split("/")){
      acc.push(part);
      if (!node.kids.has(part)) node.kids.set(part, { name: part, path: acc.join("/"), kids: new Map(), docs: [] });
      node = node.kids.get(part);
    }
    node.docs.push(e);
  }
  const fill = n => { n.all = [...n.docs]; for (const k of n.kids.values()){ fill(k); n.all.push(...k.all); } return n; };
  return fill(root);
}
function renderTree(){
  const card = $("treeCard");
  const tree = buildTree();
  if (!tree.kids.size){ card.hidden = true; return; }
  card.hidden = false;
  const nFolders = (function cnt(n){ let s = 0; for (const k of n.kids.values()) s += 1 + cnt(k); return s; })(tree);
  $("treeMeta").textContent = `${tree.all.length} doc. · ${nFolders} pasta${nFolders === 1 ? "" : "s"}`;
  if (!treeOpen.size) for (const k of tree.kids.values()) treeOpen.add(k.path);
  const row = (n, depth) => {
    const c = counts(n.all), tot = Math.max(1, c.all);
    const hasKids = n.kids.size > 0, open = treeOpen.has(n.path);
    const bar = `<span class="tbar">${["ok", "warn", "fail", "pend"].map(k => c[k] ? `<i style="width:${c[k] / tot * 100}%;background:${STATUS_COLORS[k]}"></i>` : "").join("")}</span>`;
    let h = `<div class="flex items-center" style="padding-left:${depth * 14}px">
      <button type="button" class="icon-btn !h-7 !w-6 shrink-0 text-[10px] ${hasKids ? "" : "invisible"}" data-treetoggle="${esc(n.path)}" aria-label="${open ? "Recolher" : "Expandir"} pasta"><i class="fa-solid fa-chevron-${open ? "down" : "right"}"></i></button>
      <button type="button" class="tnode ${folderFilter === n.path ? "sel" : ""}" data-folder="${esc(n.path)}" title="${esc(n.path)}">
        <i class="fa-solid ${open && hasKids ? "fa-folder-open" : "fa-folder"} text-amber-500"></i><span class="tn-name">${esc(n.name)}</span>${bar}<span class="tn-n">${c.all}</span>
      </button></div>`;
    if (hasKids && open) for (const k of [...n.kids.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) h += row(k, depth + 1);
    return h;
  };
  $("tree").innerHTML = [...tree.kids.values()].map(k => row(k, 0)).join("");
}

/* ---- detalhes ---- */
function detailIof(r){
  const i = r.iof; let h = "";
  if (i.off) return `<p>Nenhum rótulo configurado.</p>`;
  if (i.status === "ok") h += `<p>Todos os ${i.values.length} valor(es) de IOF encontrados estão zerados.</p>`;
  if (i.status === "fail") h += `<p><b>${i.values.filter(v => !v.zero).length}</b> valor(es) de IOF diferente(s) de zero.</p>`;
  if (i.status === "warn") h += `<p>O IOF é citado, mas nenhum valor numérico foi identificado perto do rótulo. Confira no print.</p>`;
  if (i.status === "na") h += `<p>O documento não menciona IOF.</p>`;
  const ev = i.values.slice().sort((a, b) => a.zero - b.zero).slice(0, 12).map(v => `<div class="evi"><span class="where">${esc(v.where)} · ${esc(v.how)}${v.ocr ? " · lido por OCR, conferir" : ""}</span>Valor: <span class="val ${v.zero ? "ok" : "fail"}">${esc(v.raw)}</span><br>${esc(v.ctx).replace(/\n/g, "<br>")}${shotHtml(v)}</div>`);
  const mn = i.mentions.slice(0, 6).map(m => `<div class="evi"><span class="where">${esc(m.where)} · citação sem valor</span>${m.ctxHtml}${shotHtml(m)}</div>`);
  return h + (ev.length || mn.length ? `<div class="ev">${ev.join("")}${mn.join("")}</div>` : "");
}
function detailForb(r){
  const f = r.forb;
  if (f.status === "na") return `<p>Nenhum termo configurado.</p>`;
  if (f.status === "ok") return `<p>Nenhuma menção a ${esc(f.terms.join(", "))}.</p>`;
  const cnt = Object.entries(f.byTerm).map(([t, n]) => `${esc(t)}: ${n}×`).join(" · ");
  return `<p>Encontrado — ${cnt} em ${f.hits.length} frase(s)${f.hits.length > 12 ? " (mostrando as 12 primeiras)" : ""}.</p><div class="ev">${f.hits.slice(0, 12).map(h => `<div class="evi"><span class="where">${esc(h.where)}${h.ocr ? " · OCR" : ""} · ${esc(h.term)}</span>${h.html}${shotHtml(h)}</div>`).join("")}</div>`;
}
function simBar(pct){
  const col = pct >= 100 ? STATUS_COLORS.ok : pct >= cfg.simil ? STATUS_COLORS.warn : STATUS_COLORS.fail;
  return `<div class="grid gap-1.5"><div class="flex items-baseline justify-between text-[12px]"><span class="font-semibold text-ink-600 dark:text-ink-300">Similaridade</span><span class="font-mono font-semibold" style="color:${col}">${pct}%</span></div>
    <div class="simbar" title="Mínimo para divergência: ${cfg.simil}%"><i style="width:${pct}%;background:${col}"></i><b style="left:${cfg.simil}%"></b></div></div>`;
}
function diffRows(p){
  if (!p.blocks || !p.blocks.length) return "";
  const rows = p.blocks.slice(0, 8).map(b => {
    if (b.kind === "fuzzy") return `<div class="diffrow"><span class="lab">leitura</span><span class="fz">${esc(b.got)}</span><span class="text-ink-400">≈</span><span class="exp">${esc(b.exp)}</span></div>`;
    if (!b.got) return `<div class="diffrow"><span class="lab">falta</span><span class="exp">${esc(b.exp)}</span></div>`;
    if (!b.exp) return `<div class="diffrow"><span class="lab">a mais</span><span class="got">${esc(b.got)}</span></div>`;
    return `<div class="diffrow"><span class="lab">esperado</span><span class="exp">${esc(b.exp)}</span><i class="fa-solid fa-arrow-right text-[10px] text-ink-400"></i><span class="lab">encontrado</span><span class="got">${esc(b.got)}</span></div>`;
  }).join("");
  return `<div class="diffs">${rows}${p.blocks.length > 8 ? `<span class="hint">+ ${p.blocks.length - 8} diferença(s)</span>` : ""}</div>`;
}
function detailPhr(r){
  if (!r.phr.results.length) return `<p>Nenhuma frase configurada.</p>`;
  return r.phr.results.map((p, idx) => {
    const head = r.phr.results.length > 1 ? `<p class="!text-[12px] !text-ink-500">Frase ${idx + 1}: “${esc(p.phrase.slice(0, 70))}${p.phrase.length > 70 ? "…" : ""}”</p>` : "";
    const pct = p.pct ?? Math.round(p.score * 100);
    if (p.status === "ok") return head + simBar(100) + `<p>Encontrada exatamente${p.where ? ` em <b>${esc(p.where)}</b>` : ""}${p.ocr ? " (via OCR)" : ""}.</p>${shotHtml(p.shotReq)}`;
    let h = head + simBar(pct) + (p.status === "warn"
      ? `<p>Trecho <b>${pct}%</b> igual à frase configurada${p.where ? ` em <b>${esc(p.where)}</b>` : ""} — há diferenças a corrigir.</p>`
      : `<p>Não encontrada${pct >= 30 ? `. O trecho mais próximo tem <b>${pct}%</b> de similaridade${p.where ? ` (${esc(p.where)})` : ""}` : ""}.</p>`);
    if (pct >= 30 && p.found) h += diffRows(p) + `<div class="evi"><span class="where">Trecho no documento</span>${esc(p.found)}${shotHtml(p.shotReq)}</div>`;
    return h;
  }).join('<div class="h-px bg-ink-200 dark:bg-ink-800"></div>');
}

/* ---- linha de documento ---- */
const seenIds = new Set();
function docCard(e){
  const st = stateOf(e);
  const [stc, stLabel, stIcon] = ST_META[st] || ST_META.q;
  const meta = [e.ext.toUpperCase(), e.pages ? `${e.pages} pág.` : null, e.size != null ? fmtSize(e.size) : null].filter(Boolean).join(" · ");
  let chips = "";
  if (st === "run") chips = `<span class="chip"><i class="fa-solid fa-circle-notch fa-spin"></i><span data-prog="${e.id}">${esc(e.progress || "")}</span></span>`;
  else if (e.state === "done") chips = chipTexts(e.result).map(([s, t]) => `<span class="chip ${s}">${ICON[s]}${esc(t)}</span>`).join("") + (e.result.empty ? `<span class="chip warn">${ICON.warn}Nenhum texto lido</span>` : "");
  else if (st === "err") chips = `<span class="chip fail">${ICON.fail}${esc(e.error)}</span>`;
  const openable = e.state === "done" || e.state === "err";
  const isNew = !seenIds.has(e.id); seenIds.add(e.id);
  let body = "";
  if (e.open && openable){
    if (e.state === "done"){
      const r = e.result;
      const notes = [...e.unread, ...e.notes];
      const ck = (s, title, html) => `<div class="check"><div class="check-h"><span class="sicon ${s}">${ICON[s]}</span><h3>${esc(title)}</h3><span class="chip ${s} ml-auto">${STATUS_WORD[s]}</span></div>${html}</div>`;
      body = `<div class="doc-body">
        ${ck(r.iof.status, "IOF", detailIof(r))}
        ${ck(r.forb.status, forbLabel(), detailForb(r))}
        ${ck(r.phr.status, "Frase obrigatória", detailPhr(r))}
        ${notes.length ? `<ul class="notes">${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        <div class="flex flex-wrap items-start justify-between gap-2">
          <details class="raw min-w-0 flex-1"><summary><i class="fa-solid fa-align-left mr-1.5 opacity-60"></i>Ver texto extraído (${e.segments.length} trecho${e.segments.length === 1 ? "" : "s"})</summary><pre>${e.segments.map(s => `── ${esc(s.label)} ──\n${esc(segText(s))}`).join("\n\n")}</pre></details>
          <button type="button" class="btn btn-ghost !py-1.5 text-[12.5px] text-ink-500" data-remove="${e.id}"><i class="fa-regular fa-trash-can"></i>Remover da lista</button>
        </div></div>`;
    } else body = `<div class="doc-body"><p class="hint">${esc(e.error)}</p><div class="flex justify-end"><button type="button" class="btn btn-ghost !py-1.5 text-[12.5px]" data-remove="${e.id}"><i class="fa-regular fa-trash-can"></i>Remover da lista</button></div></div>`;
  }
  const path = e.dir ? `<span class="doc-path" title="${esc(e.dir)}"><i class="fa-regular fa-folder"></i><span>${esc(e.dir.replace(/\//g, " › "))}</span></span>` : "";
  return `<article class="doc st-${stc}${e.open ? " open" : ""}${isNew ? " fresh" : ""}" data-id="${e.id}">
    <button type="button" class="doc-head" data-toggle="${e.id}" aria-expanded="${!!e.open}" ${openable ? "" : "disabled"}>
      <span class="doc-ic st-${stc}"><i class="fa-solid ${extIcon(e.ext)}"></i></span>
      <span class="grid min-w-0 flex-1 gap-1.5">
        <span class="flex flex-wrap items-center gap-x-2 gap-y-1"><span class="font-semibold text-ink-900 dark:text-white" style="overflow-wrap:anywhere">${esc(e.name)}</span>${e.example ? `<span class="tag">Exemplo</span>` : ""}<span class="font-mono text-[11px] text-ink-400">${esc(meta)}</span></span>
        ${path}
        <span class="flex flex-wrap gap-1.5">${chips}</span>
      </span>
      <span class="flex shrink-0 items-center gap-2"><span class="badge ${stc}"><i class="fa-solid ${stIcon} text-[11px]"></i><span class="hidden sm:inline">${stLabel}</span></span>${openable ? `<i class="fa-solid fa-chevron-down chev"></i>` : ""}</span>
    </button>${body}</article>`;
}

let searchQ = "", pageSize = 50;
const ORDER = { err: 0, fail: 1, warn: 2, run: 3, q: 4, ok: 5 };
function visibleEntries(){
  const q = searchQ.trim().toLowerCase();
  return entries.filter(e => {
    const s = stateOf(e);
    return (filter === "all" || s === filter || (filter === "fail" && s === "err"))
      && inFolder(e, folderFilter)
      && (!q || (e.name + " " + e.dir).toLowerCase().includes(q));
  });
}
function renderList(){
  const vis = visibleEntries();
  const empty = (icon, title, sub) => `<div class="grid justify-items-center gap-2 px-6 py-14 text-center"><span class="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-[18px] text-ink-400 dark:bg-ink-800"><i class="fa-solid ${icon}"></i></span><strong class="text-ink-800 dark:text-ink-100">${title}</strong><span class="hint">${sub}</span></div>`;
  if (!entries.length) $("list").innerHTML = empty("fa-inbox", "Nenhum documento ainda", "Use “Adicionar” para selecionar arquivos ou mapear uma pasta.");
  else if (!vis.length) $("list").innerHTML = empty("fa-filter-circle-xmark", "Nada por aqui", searchQ ? "Nenhum arquivo com esse nome neste filtro." : "Nenhum documento neste filtro.");
  else $("list").innerHTML = vis.slice(0, pageSize).map(docCard).join("");
  $("more").hidden = vis.length <= pageSize;
  $("moreTxt").textContent = `Mostrar mais (${vis.length - pageSize} restantes)`;
}
function render(){
  renderCounts(); renderProgress(); renderTree(); renderList();
  $("exampleBar").hidden = !examples;
  const any = entries.some(e => e.state === "done" || e.state === "err");
  ["btnCopy", "btnXlsx", "btnHtml", "btnRepXlsx", "btnRepHtml"].forEach(id => $(id).disabled = !any);
  $("btnReproc").disabled = examples || !entries.some(e => e.file);
  $("ocrModeLbl").textContent = { auto: "Automático", sempre: "Sempre", nunca: "Desligado" }[cfg.ocrMode];
  scheduleDashboard();
}

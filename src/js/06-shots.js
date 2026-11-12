/* ---------------- prints (recortes do documento) ---------------- */
const SHOT_SCALE = 2.2;
const HL_COLORS = { ok: "#1D7446", fail: "#C0261D", warn: "#C27C0E", label: "#1F5FAF" };
function shotRequests(entry){
  const r = entry.result; if (!r) return [];
  const list = [];
  r.iof.values.slice(0, 12).forEach(v => list.push(v));
  r.iof.mentions.slice(0, 6).forEach(v => list.push(v));
  r.forb.hits.slice(0, 12).forEach(v => list.push(v));
  r.phr.results.forEach(p => { if (p.shotReq) list.push(p.shotReq); });
  return list;
}
let shotChain = Promise.resolve(), renderQueued = false;
function scheduleRender(){ if (renderQueued) return; renderQueued = true; setTimeout(() => { renderQueued = false; render(); }, 120); }
function queueShots(entry){
  const reqs = shotRequests(entry);
  reqs.forEach(q => { q.shotState = "pending"; });
  const gen = entry.shotGen = (entry.shotGen || 0) + 1;
  const p = shotChain.then(() => buildShots(entry, gen, reqs)).catch(e => console.error(e));
  shotChain = p;
  return p;
}
const rowHasGeom = row => row && row.top != null && row.h > 0;
async function buildShots(entry, gen, reqs){
  if (entry.shotGen !== gen || !reqs.length) return;
  const cache = new Map(); let pdf = null;
  try {
    for (const q of reqs){
      if (entry.shotGen !== gen) return;
      const seg = entry.segments[q.seg];
      let src = null;
      const geomOk = seg && seg.geom && seg.rows.slice(q.rows[0], q.rows[1] + 1).every(rowHasGeom);
      try {
        if (geomOk && (seg.geom === "pdf" || seg.geom === "px") && entry.file){
          const key = "p" + seg.page;
          if (!cache.has(key)){
            if (!pdf){
              await loadScript(LIBS.pdf); if (!window.pdfjsWorker) await loadScript(LIBS.pdfWorker);
              pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
              pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await entry.file.arrayBuffer()), cMapUrl: LIBS.cmaps, cMapPacked: true, isEvalSupported: false }).promise;
            }
            const page = await pdf.getPage(seg.page);
            const vp = page.getViewport({ scale: SHOT_SCALE });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
            const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            cache.set(key, { canvas, vp });
          }
          src = cache.get(key);
        } else if (geomOk && seg.geom === "img" && seg.blob){
          const key = "i" + q.seg;
          if (!cache.has(key)){
            const bm = await createImageBitmap(seg.blob);
            const f = Math.min(1, 3000 / Math.max(bm.width, bm.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(bm.width * f); canvas.height = Math.round(bm.height * f);
            const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bm, 0, 0, canvas.width, canvas.height); bm.close && bm.close();
            cache.set(key, { canvas, f });
          }
          src = cache.get(key);
        }
      } catch(e){ console.warn("print:", e); src = null; }
      if (entry.shotGen !== gen) return;
      try {
        if (src){ q.shot = cropShot(seg, src, q); q.shotKind = "real"; }
        else { q.shot = textShot(seg, q); q.shotKind = "text"; }
        q.shotState = "done";
      } catch(e){ console.warn("print:", e); q.shotState = "err"; }
      scheduleRender();
      await new Promise(r => setTimeout(r, 0));
    }
  } finally {
    for (const v of cache.values()){ v.canvas.width = v.canvas.height = 0; }
    if (pdf) pdf.destroy();
  }
}
function cellBox(seg, row, cell, a, b, src){
  const len = Math.max(1, cell.t.length);
  const fa = a == null ? 0 : a / len, fb = b == null ? 1 : b / len;
  const w = cell.x1 - cell.x0;
  const x0 = cell.x0 + w * fa, x1 = cell.x0 + w * fb;
  if (seg.geom === "pdf"){
    const p1 = src.vp.convertToViewportPoint(x0, -row.top + row.h * 0.92);
    const p2 = src.vp.convertToViewportPoint(x1, -row.top - row.h * 0.28);
    return { x: Math.min(p1[0], p2[0]), y: Math.min(p1[1], p2[1]), w: Math.abs(p2[0] - p1[0]), h: Math.abs(p2[1] - p1[1]) };
  }
  const f = seg.geom === "px" ? SHOT_SCALE / seg.pxScale : src.f;
  return { x: x0 * f, y: (row.top - row.h * 0.65) * f, w: (x1 - x0) * f, h: row.h * 1.3 * f };
}
function cropShot(seg, src, q){
  const [r0, r1] = q.rows;
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (let r = r0; r <= r1; r++){
    const row = seg.rows[r];
    for (const c of row){ const b = cellBox(seg, row, c, null, null, src); X0 = Math.min(X0, b.x); Y0 = Math.min(Y0, b.y); X1 = Math.max(X1, b.x + b.w); Y1 = Math.max(Y1, b.y + b.h); }
  }
  // one line of context above and below, when it sits close to the hit
  const hb = seg.rows[r0].map(c => cellBox(seg, seg.rows[r0], c, null, null, src));
  const rowH = Math.max(...hb.map(b => b.h));
  const rowBox = r => { const row = seg.rows[r]; if (!rowHasGeom(row)) return null; let a = Infinity, b = -Infinity, l = Infinity, rr = -Infinity; for (const c of row){ const bx = cellBox(seg, row, c, null, null, src); a = Math.min(a, bx.y); b = Math.max(b, bx.y + bx.h); l = Math.min(l, bx.x); rr = Math.max(rr, bx.x + bx.w); } return [a, b, b, l, rr]; };
  const up = r0 > 0 && rowBox(r0 - 1), dn = r1 < seg.rows.length - 1 && rowBox(r1 + 1);
  if (up && Y0 - up[1] < rowH * 1.2 && up[0] < Y0){ Y0 = up[0]; X0 = Math.min(X0, up[3]); X1 = Math.max(X1, up[4]); }
  if (dn && dn[0] - Y1 < rowH * 1.2 && dn[2] > Y1){ Y1 = dn[2]; X0 = Math.min(X0, dn[3]); X1 = Math.max(X1, dn[4]); }
  const cw = src.canvas.width, ch = src.canvas.height;
  const padX = 40, padY = 8;
  // keep a readable minimum width around short hits
  if (X1 - X0 < 520){ const c = (X0 + X1) / 2; X0 = c - 260; X1 = c + 260; }
  X0 = Math.max(0, X0 - padX); Y0 = Math.max(0, Y0 - padY); X1 = Math.min(cw, X1 + padX); Y1 = Math.min(ch, Y1 + padY);
  const bw = Math.max(1, X1 - X0), bh = Math.max(1, Y1 - Y0);
  const k = Math.min(1, 1400 / bw);
  const out = document.createElement("canvas");
  out.width = Math.round(bw * k); out.height = Math.round(bh * k);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src.canvas, X0, Y0, bw, bh, 0, 0, out.width, out.height);
  for (const h of q.hl){
    const row = seg.rows[h.r], cell = row && row[h.ci]; if (!cell) continue;
    const b = cellBox(seg, row, cell, h.a, h.b, src);
    const x = (b.x - X0) * k - 3, y = (b.y - Y0) * k - 2, w = b.w * k + 6, hh = b.h * k + 4;
    ctx.fillStyle = h.kind === "label" ? "rgba(31,95,175,0.14)" : "rgba(255,210,0,0.32)";
    ctx.fillRect(x, y, w, hh);
    ctx.strokeStyle = HL_COLORS[h.kind] || HL_COLORS.warn; ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, hh);
  }
  const url = out.toDataURL("image/jpeg", 0.9);
  out.width = out.height = 0;
  return url;
}
function wrapRuns(ctx, text, ranges, maxW){
  // split text into runs by highlight ranges, then wrap word by word
  const cuts = new Set([0, text.length]); ranges.forEach(g => { cuts.add(Math.max(0, g.a)); cuts.add(Math.min(text.length, g.b)); });
  const pts = [...cuts].sort((a, b) => a - b);
  const runs = [];
  for (let i = 0; i < pts.length - 1; i++){ const a = pts[i], b = pts[i + 1]; if (b <= a) continue; const g = ranges.find(g => g.a <= a && g.b >= b); runs.push({ t: text.slice(a, b), kind: g ? g.kind : null }); }
  const lines = [[]]; let x = 0;
  for (const run of runs){
    for (const piece of run.t.split(/(\s+)/)){
      if (!piece) continue;
      const w = ctx.measureText(piece).width;
      const isSpace = /^\s+$/.test(piece);
      if (!isSpace && x > 0 && x + w > maxW){ lines.push([]); x = 0; }
      if (isSpace && x === 0) continue;
      lines[lines.length - 1].push({ t: piece, x, w, kind: run.kind });
      x += w;
    }
  }
  return lines;
}
function textShot(seg, q){
  const [r0, r1] = q.rows;
  const rows = seg.rows.slice(r0, r1 + 1);
  const W = 880, P = 20, FS = 15, LH = 23, dpr = 2, CAP = 26;
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `${FS}px Arial, Helvetica, sans-serif`;
  const hlFor = (ri, ci) => q.hl.filter(h => h.r === r0 + ri && h.ci === ci);
  const grid = rows.some(r => r.length > 1 && r.every(c => c.x1 < 1e8));
  let blocks = [], H = P + CAP;
  if (grid){
    const xs = [...new Set(rows.flatMap(r => r.map(c => Math.round(c.x0 * 100) / 100)))].sort((a, b) => a - b);
    const ncol = Math.max(1, xs.length), colW = (W - 2 * P) / ncol;
    rows.forEach((row, ri) => {
      const cells = row.map((c, ci) => {
        const col = xs.indexOf(Math.round(c.x0 * 100) / 100);
        const lines = wrapRuns(measure, c.t, hlFor(ri, ci), colW - 16);
        return { col, lines };
      });
      const hRow = Math.max(1, ...cells.map(c => c.lines.length)) * LH + 12;
      blocks.push({ type: "row", y: H, h: hRow, cells, colW, ncol });
      H += hRow;
    });
  } else {
    rows.forEach((row, ri) => {
      const t = row.map(c => c.t).join("   ");
      // map per-cell highlights to row-text offsets
      let off = 0; const rng = [];
      row.forEach((c, ci) => { hlFor(ri, ci).forEach(h => rng.push({ a: off + h.a, b: off + h.b, kind: h.kind })); off += c.t.length + 3; });
      const lines = wrapRuns(measure, t, rng, W - 2 * P);
      blocks.push({ type: "para", y: H, lines });
      H += lines.length * LH + 4;
    });
  }
  H += P;
  const cv = document.createElement("canvas");
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#F1F3EF"; ctx.fillRect(0, 0, W, CAP);
  ctx.fillStyle = "#5B6770"; ctx.font = `600 11.5px Arial, Helvetica, sans-serif`; ctx.textBaseline = "middle";
  ctx.fillText(`TRECHO RECONSTITUÍDO DO TEXTO · ${seg.label.toUpperCase()}`, P, CAP / 2);
  ctx.strokeStyle = "#D8DDD6"; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  ctx.font = `${FS}px Arial, Helvetica, sans-serif`; ctx.textBaseline = "alphabetic";
  const drawLine = (line, x0, y) => {
    for (const p of line){
      if (p.kind){
        ctx.fillStyle = p.kind === "label" ? "rgba(31,95,175,0.16)" : "rgba(255,210,0,0.45)";
        ctx.fillRect(x0 + p.x - 1, y - FS + 1, p.w + 2, FS + 6);
        ctx.fillStyle = HL_COLORS[p.kind] || HL_COLORS.warn; ctx.fillRect(x0 + p.x - 1, y + 5, p.w + 2, 2);
      }
      ctx.fillStyle = "#18222B"; ctx.fillText(p.t, x0 + p.x, y);
    }
  };
  for (const b of blocks){
    if (b.type === "para") b.lines.forEach((ln, i) => drawLine(ln, P, b.y + 6 + (i + 1) * LH - 6));
    else {
      ctx.strokeStyle = "#C9CFC7";
      for (let c = 0; c < b.ncol; c++) ctx.strokeRect(P + c * b.colW + 0.5, b.y + 6.5, b.colW, b.h);
      for (const c of b.cells) c.lines.forEach((ln, i) => drawLine(ln, P + c.col * b.colW + 8, b.y + 6 + (i + 1) * LH));
    }
  }
  const url = cv.toDataURL("image/png");
  cv.width = cv.height = 0;
  return url;
}
function shotHtml(q){
  if (!q || !q.shotState) return "";
  if (q.shotState === "pending") return `<div class="shot-pending">Gerando print…</div>`;
  if (q.shotState === "err" || !q.shot) return `<div class="shot-pending">Não foi possível gerar o print deste trecho.</div>`;
  if (!q.shotId) q.shotId = ++shotSeq;
  shotReg.set(q.shotId, q);
  return `<button type="button" class="shotbtn" data-shot="${q.shotId}" aria-label="Ampliar print"><img src="${q.shot}" alt="Print do trecho encontrado"></button>${q.shotKind === "text" ? `<span class="shotnote">Formato sem página visual (Word, Excel, texto): o print reconstitui o trecho com a formatação simplificada.</span>` : ""}`;
}
let shotSeq = 0; const shotReg = new Map();


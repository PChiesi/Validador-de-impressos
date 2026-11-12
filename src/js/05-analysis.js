/* ---------------- analysis ---------------- */
const MONEY_RE = /(?:R\$\s*)?-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{1,4}(?:\s*%)?|R\$\s*-?\d+(?:\.\d{2})?(?![\d,])|(?<![\d.,])\d+(?:\.\d{1,2})?\s*%|(?<![\d.,\/])\d+\.\d{2}(?![\d.,\/])/g;
function parseMoney(raw){
  let v = raw.replace(/R\$|%|\s/g, "");
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(v);
  return isFinite(num) ? num : null;
}
function allMoney(s){
  const out = []; const re = new RegExp(MONEY_RE.source, "g"); let m;
  while ((m = re.exec(s))){ const num = parseMoney(m[0]); if (num != null) out.push({ raw: m[0].trim(), num, index: m.index, len: m[0].length, pct: m[0].includes("%") }); }
  return out;
}
function findMoney(s){ return allMoney(s)[0] || null; }
const termList = s => String(s || "").split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
function termRe(term){
  return new RegExp("(?<![\\p{L}\\p{N}])" + reEsc(term) + "(?![\\p{L}\\p{N}])", "giu");
}
/* ---- rótulos do IOF ----
   Variações reconhecidas (quando "reconhecer variações" está ligado):
   · sigla em qualquer caixa: IOF, Iof, iof, IOF-Seguros, IOF/Seguro
   · sigla com separadores (em maiúsculas): I.O.F., I. O. F., I O F, I-O-F, I_O_F, I•O•F
   · nome por extenso: Imposto sobre Operações Financeiras; Imposto sobre Operações de Crédito, Câmbio e Seguro(s);
     Imposto sobre Operações de Seguro(s); Imp. s/ Op. Financeiras e abreviações parecidas
   · erros de OCR (só em páginas lidas por OCR): I0F, l0F, 1OF, |OF, IO F                                    */
const B0 = "(?<![\\p{L}\\p{N}])", B1 = "(?![\\p{L}\\p{N}])";
const SEP = "[\\s.·•\\-–_/]";
const IOF_BUILTIN = [
  new RegExp(B0 + "iof\\.?" + B1, "giu"),
  new RegExp(B0 + `(?:I${SEP}{1,3}O${SEP}{0,3}F|IO${SEP}{1,3}F)\\.?` + B1, "gu"),
  new RegExp(B0 + "imposto\\s+(?:sobre|s\\s*\\/|s\\.)\\s*(?:as\\s+)?opera[çc][õo]es\\s+(?:de\\s+)?(?:cr[ée]dito\\s*,?\\s*c[âa]mbio\\s*,?\\s*e\\s+seguros?|financeiras|seguros?)" + B1, "giu"),
  new RegExp(B0 + "imp\\.?\\s*(?:sobre|s\\s*\\/|s\\.)\\s*op(?:er(?:a[çc][õo]es)?)?\\.?\\s*fin(?:anc(?:eiras?)?)?\\.?" + B1, "giu"),
];
const IOF_OCR = [ new RegExp(B0 + `[I1l|]${SEP}{0,2}[O0]${SEP}{0,2}F\\.?` + B1, "gu") ];
function iofLabelRes(ocr){
  const custom = termList(cfg.iofTerms).filter(t => !(cfg.iofVariants && /^i\W*o\W*f\W*$/i.test(t))).map(termRe);
  if (!cfg.iofVariants) return custom;
  return [...IOF_BUILTIN, ...(ocr ? IOF_OCR : []), ...custom];
}
function hlMark(text, ranges){
  ranges = ranges.slice().sort((x, y) => x.a - y.a); let out = "", p = 0;
  for (const g of ranges){ if (g.a < p) continue; out += esc(text.slice(p, g.a)) + "<mark>" + esc(text.slice(g.a, g.b)) + "</mark>"; p = g.b; }
  return out + esc(text.slice(p));
}
const mapOf = seg => { segText(seg); return seg._map; };
function rangeHL(seg, s, e, kind){
  return mapOf(seg).filter(m => m.e > s && m.s < e).map(m => ({ r: m.r, ci: m.ci, a: Math.max(s, m.s) - m.s, b: Math.min(e, m.e) - m.s, kind }));
}
function rowsOfRange(seg, s, e){
  const hs = mapOf(seg).filter(m => m.e > s && m.s < e);
  return hs.length ? [hs[0].r, hs[hs.length - 1].r] : [0, 0];
}
const rowStart = (seg, r) => (mapOf(seg).find(m => m.r === r) || { s: 0 }).s;
const rowEnd = (seg, r) => { const ms = mapOf(seg).filter(m => m.r === r); return ms.length ? ms[ms.length - 1].e : 0; };
function sentenceRange(seg, off, len){
  const text = segText(seg), map = mapOf(seg);
  const m0 = map.find(m => off >= m.s && off < m.e); if (!m0) return [off, off + len];
  const rows = seg.rows;
  if (rows[m0.r].length > 1){
    // table-like row: the whole cell is the "sentence"; widen to the row if the cell is tiny
    return m0.e - m0.s >= 25 ? [m0.s, m0.e] : [rowStart(seg, m0.r), rowEnd(seg, m0.r)];
  }
  let rA = m0.r, rB = m0.r;
  while (rA > 0 && m0.r - rA < 4 && rows[rA - 1].length === 1) rA--;
  while (rB < rows.length - 1 && rB - m0.r < 4 && rows[rB + 1].length === 1) rB++;
  const lim0 = rowStart(seg, rA), lim1 = rowEnd(seg, rB);
  const before = text.slice(lim0, off);
  let s = lim0; const re = /[.!?](?=\s)/g; let mm;
  while ((mm = re.exec(before))) s = lim0 + mm.index + 1;
  while (s < off && /\s/.test(text[s])) s++;
  const after = text.slice(off + len, lim1);
  const endM = /[.!?](?=\s|$)/.exec(after);
  const e = endM ? off + len + endM.index + 1 : lim1;
  return [s, e];
}

function checkIof(segs){
  const values = [], mentions = [];
  const pagesWithTextValue = new Set();
  if (!termList(cfg.iofTerms).length && !cfg.iofVariants) return { status: "na", values, mentions, off: true };
  const order = segs.map((_, i) => i).sort((a, b) => segs[a].ocr - segs[b].ocr);
  const seen = new Set();
  for (const si of order){
    const seg = segs[si], rows = seg.rows, res = iofLabelRes(seg.ocr);
    for (let r = 0; r < rows.length; r++){
      const row = rows[r];
      for (let ci = 0; ci < row.length; ci++){
        const cell = row[ci];
        const taken = [];   // trechos da célula já reconhecidos (evita contar "Imposto… (IOF)" duas vezes)
        for (const re of res){
          re.lastIndex = 0; let m;
          while ((m = re.exec(cell.t))){
            const labA = m.index, labB = m.index + m[0].length;
            if (taken.some(([a, b]) => labA < b && labB > a)) continue;
            taken.push([labA, labB]);
            const after = cell.t.slice(labB);
            let found = null, how = "", r2 = r, valHL = null, lowConf = null, lowHL = null;
            let cand = null, candHL = null, prefix = "";
            const v0 = findMoney(after);
            if (v0){ cand = v0; prefix = after.slice(0, v0.index); candHL = { r, ci, a: labB + v0.index, b: labB + v0.index + v0.len }; }
            else for (let cj = ci + 1; cj < row.length && !cand; cj++){
              const v = findMoney(row[cj].t);
              if (v){ cand = v; prefix = after + " " + row.slice(ci + 1, cj).map(c => c.t).join(" ") + " " + row[cj].t.slice(0, v.index); candHL = { r, ci: cj, a: v.index, b: v.index + v.len }; }
            }
            if (cand){
              const letters = prefix.replace(/R\$|[^\p{L}]/gu, "").length;
              if (letters <= 28){ found = cand; how = "ao lado"; valHL = candHL; } else { lowConf = cand; lowHL = candHL; }
            }
            if (!found){
              const tol = seg.tol ?? 18;
              const mid = (cell.x0 + Math.min(cell.x1, cell.x0 + 1e6)) / 2;
              for (let k = r + 1; k <= Math.min(rows.length - 1, r + 3) && !found; k++){
                const cands = rows[k].map((c, idx) => ({ c, idx })).filter(o => o.c.x1 >= cell.x0 - tol && o.c.x0 <= cell.x1 + tol)
                  .sort((a, b) => Math.abs((a.c.x0 + Math.min(a.c.x1, a.c.x0 + 1e6)) / 2 - mid) - Math.abs((b.c.x0 + Math.min(b.c.x1, b.c.x0 + 1e6)) / 2 - mid));
                for (const o of cands){
                  const v = findMoney(o.c.t);
                  if (v){ found = v; r2 = k; how = seg.tol >= 1e8 ? "linha seguinte" : "abaixo (coluna)"; valHL = { r: k, ci: o.idx, a: v.index, b: v.index + v.len }; break; }
                }
              }
            }
            if (!found && lowConf){ found = lowConf; valHL = lowHL; how = "mesma linha (distante do rótulo)"; }
            const labHL = { r, ci, a: labA, b: labB, kind: "label" };
            if (found){
              let pairHL = null;
              if (found.pct && how === "ao lado"){
                for (let cj = valHL.ci; cj < row.length && !pairHL; cj++){
                  const base = cj === valHL.ci ? valHL.b : 0;
                  const nx = allMoney(row[cj].t.slice(base)).find(x => !x.pct);
                  if (nx){ found = { raw: found.raw + " · " + nx.raw, num: Math.abs(found.num) + Math.abs(nx.num) }; pairHL = { r, ci: cj, a: base + nx.index, b: base + nx.index + nx.len }; }
                }
              }
              if (seg.ocr && seg.hasText && pagesWithTextValue.has(seg.page)) continue;
              if (!seg.ocr && seg.page) pagesWithTextValue.add(seg.page);
              const ctx = rowText(row) + (r2 !== r ? "\n↳ " + rowText(rows[r2]) : "");
              const key = seg.label + "|" + found.raw + "|" + ctx;
              if (seen.has(key)) continue; seen.add(key);
              const zero = Math.abs(found.num) < 0.005;
              const kind = zero ? "ok" : "fail";
              const hl = [labHL, { ...valHL, kind }]; if (pairHL) hl.push({ ...pairHL, kind });
              values.push({ seg: si, where: seg.label, raw: found.raw, num: found.num, zero, how, ocr: seg.ocr, ctx, rows: [Math.min(r, r2), Math.max(r, r2)], hl });
            } else {
              const key = seg.label + "|m|" + rowText(row);
              if (seen.has(key)) continue; seen.add(key);
              const rt = rowText(row), off = rt.indexOf(cell.t) + labA;
              mentions.push({ seg: si, where: seg.label, ctxHtml: hlMark(rt, [{ a: off, b: off + (labB - labA) }]), rows: [r, Math.min(rows.length - 1, r + 1)], hl: [{ ...labHL, kind: "warn" }] });
            }
          }
        }
      }
    }
  }
  let status = "na";
  if (values.some(v => !v.zero)) status = "fail";
  else if (values.length) status = "ok";
  else if (mentions.length) status = "warn";
  return { status, values, mentions };
}

function checkForbidden(segs){
  const terms = termList(cfg.forbidden);
  const hits = [], byTerm = {};
  const textPagesHit = new Set();
  const order = segs.map((_, i) => i).sort((a, b) => segs[a].ocr - segs[b].ocr);
  for (const si of order){
    const seg = segs[si], text = segText(seg);
    const bySentence = new Map();
    for (const term of terms){
      if (seg.ocr && seg.hasText && textPagesHit.has(seg.page + "|" + term.toLowerCase())) continue;
      const re = termRe(term); let m;
      while ((m = re.exec(text))){
        if (!seg.ocr && seg.page) textPagesHit.add(seg.page + "|" + term.toLowerCase());
        const T = term.toUpperCase(); byTerm[T] = (byTerm[T] || 0) + 1;
        const [s0, e0] = sentenceRange(seg, m.index, m[0].length);
        const key = s0 + ":" + e0;
        let h = bySentence.get(key);
        if (!h){
          h = { terms: new Set(), seg: si, where: seg.label, ocr: seg.ocr, sentence: text.slice(s0, e0), s0, e0, marks: [], rows: rowsOfRange(seg, s0, e0), hl: [] };
          bySentence.set(key, h); hits.push(h);
        }
        h.terms.add(T);
        h.marks.push({ a: m.index - s0, b: m.index - s0 + m[0].length });
        h.hl.push(...rangeHL(seg, m.index, m.index + m[0].length, "fail"));
      }
    }
  }
  hits.forEach(h => { h.html = hlMark(h.sentence.replace(/\n/g, " "), h.marks); h.term = [...h.terms].join("/"); });
  return { status: !terms.length ? "na" : hits.length ? "fail" : "ok", hits, byTerm, terms };
}

const normTok = t => t.replace(/[ºª°]/g, "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
function tokenize(text){
  const src = String(text); const out = []; const re = /[\p{L}\p{N}]+/gu; let m;
  while ((m = re.exec(src))){
    const n = normTok(m[0]); if (!n) continue;
    const prev = out[out.length - 1];
    if (prev && /^-\s*\n\s*$/.test(src.slice(prev.e, m.index)) && /\p{L}$/u.test(prev.o) && /^\p{L}/u.test(m[0])){ prev.n += n; prev.o += m[0]; prev.e = m.index + m[0].length; continue; }
    out.push({ n, o: m[0], s: m.index, e: m.index + m[0].length });
  }
  return out;
}
/* ---- similaridade da frase obrigatória ----
   1) candidatos: janelas com mais palavras em comum (saco de palavras);
   2) refinamento: alinhamento palavra a palavra (semi-global), tolerante a erros de OCR;
   3) nota = (acertos ponderados − 0,5 × palavras intrusas) ÷ palavras da frase. */
function lev(a, b){
  if (a === b) return 0;
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++){
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
function tokSim(a, b){
  if (a === b) return 1;
  if (/\d/.test(a) || /\d/.test(b)) return 0;             // números precisam ser idênticos (alíquota, lei)
  const L = Math.max(a.length, b.length); if (L < 4) return 0;
  const s = 1 - lev(a, b) / L;
  return s >= 0.75 ? s : 0;
}
const INSERT_PENALTY = 0.5;
function alignPhrase(P, D){
  const n = P.length, m = D.length, W = m + 1;
  const dp = new Float64Array((n + 1) * W), tb = new Int8Array((n + 1) * W); // 1 diag, 2 up (falta), 3 left (intrusa)
  for (let i = 1; i <= n; i++){
    dp[i * W] = 0; tb[i * W] = 2;
    for (let j = 1; j <= m; j++){
      const s = tokSim(P[i - 1].n, D[j - 1].n);
      let best = dp[(i - 1) * W + j - 1] + s, t = 1;
      if (j >= 2 && D[j - 2].n + D[j - 1].n === P[i - 1].n){ const v = dp[(i - 1) * W + j - 2] + 1; if (v > best){ best = v; t = 4; } } // palavra quebrada em duas
      const up = dp[(i - 1) * W + j]; if (up > best){ best = up; t = 2; }
      const left = dp[i * W + j - 1] - INSERT_PENALTY; if (left > best){ best = left; t = 3; }
      dp[i * W + j] = best; tb[i * W + j] = t;
    }
  }
  let bj = 0, bs = -Infinity;
  for (let j = 0; j <= m; j++){ const v = dp[n * W + j]; if (v > bs + 1e-9){ bs = v; bj = j; } }
  const ops = []; let i = n, j = bj;
  while (i > 0){
    const t = j > 0 ? tb[i * W + j] : 2;
    if (t === 1){ const s = tokSim(P[i - 1].n, D[j - 1].n); ops.push({ t: s === 1 ? "eq" : s > 0 ? "fuzzy" : "sub", p: i - 1, d: j - 1, s }); i--; j--; }
    else if (t === 4){ ops.push({ t: "eq", p: i - 1, d: j - 1, s: 1 }, { t: "join", d: j - 2 }); i--; j -= 2; }
    else if (t === 2){ ops.push({ t: "miss", p: i - 1 }); i--; }
    else { ops.push({ t: "extra", d: j - 1 }); j--; }
  }
  ops.reverse();
  // remove "intrusas" nas pontas (não deveriam existir, mas por segurança)
  while (ops.length && ops[0].t === "extra") ops.shift();
  while (ops.length && ops[ops.length - 1].t === "extra") ops.pop();
  const gain = ops.reduce((a, o) => a + (o.t === "eq" ? 1 : o.t === "fuzzy" ? o.s : 0), 0);
  const ins = ops.filter(o => o.t === "extra").length;
  const score = Math.max(0, Math.min(1, (gain - INSERT_PENALTY * ins) / n));
  return { score, ops };
}
function checkPhrases(segs){
  const doc = [], segOf = [];
  const srcs = segs.map(segText);
  segs.forEach((s, si) => { for (const t of tokenize(srcs[si])){ doc.push(t); segOf.push(si); } });
  const shotFor = (a, b, kind) => {
    const si = segOf[a]; let last = a; while (last + 1 <= b && segOf[last + 1] === si) last++;
    const seg = segs[si], s = doc[a].s, e = doc[last].e;
    return { seg: si, where: seg.label, rows: rowsOfRange(seg, s, e), hl: rangeHL(seg, s, e, kind) };
  };
  const docSlice = (a, b) => {
    const parts = []; let k0 = a;
    for (let k = a + 1; k <= b + 1; k++){
      if (k === b + 1 || segOf[k] !== segOf[k0]){ parts.push(srcs[segOf[k0]].slice(doc[k0].s, doc[k - 1].e)); k0 = k; }
    }
    return parts.join(" … ").replace(/\s+/g, " ").trim();
  };
  const list = cfg.phrases.map(p => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const results = list.map(phrase => {
    const ph = tokenize(phrase); const n = ph.length;
    if (!n) return null;
    // 1) exata
    for (let i = 0; i + n <= doc.length; i++){
      if (doc[i].n !== ph[0].n) continue;
      let ok = true; for (let k = 1; k < n; k++) if (doc[i + k].n !== ph[k].n){ ok = false; break; }
      if (ok){
        const w = new Set(); for (let k = i; k < i + n; k++) w.add(segs[segOf[k]].label);
        return { phrase, status: "ok", score: 1, pct: 100, where: [...w].join(" → "), ocr: segs[segOf[i]].ocr, found: docSlice(i, i + n - 1), blocks: [], missing: [], extra: [], shotReq: shotFor(i, i + n - 1, "ok") };
      }
    }
    // 2) candidatos por saco de palavras
    const need = new Map(); ph.forEach(t => need.set(t.n, (need.get(t.n) || 0) + 1));
    const have = new Map(); let matched = 0; const cand = [];
    const add = (t, d) => { const before = have.get(t) || 0, after = before + d; have.set(t, after); const q = need.get(t) || 0; matched += Math.min(after, q) - Math.min(before, q); };
    for (let i = 0; i < doc.length; i++){
      add(doc[i].n, 1);
      if (i >= n) add(doc[i - n].n, -1);
      const start = Math.max(0, i - n + 1);
      if (i >= Math.min(n, doc.length) - 1) cand.push([matched, start]);
    }
    cand.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const picked = [];
    for (const [cnt, st] of cand){
      if (picked.length >= 6 || cnt < Math.max(2, n * 0.2)) break;
      if (picked.every(p => Math.abs(p - st) >= Math.max(3, n / 2))) picked.push(st);
    }
    // 3) alinhamento
    let best = { score: 0, ops: [], off: 0 };
    for (const st of picked){
      const a = Math.max(0, st - Math.ceil(n / 2)), b = Math.min(doc.length, st + n + Math.ceil(n / 2));
      const r = alignPhrase(ph, doc.slice(a, b));
      if (r.score > best.score + 1e-9) best = { ...r, off: a };
    }
    if (best.ops.length && best.ops.every(o => o.t === "eq" || o.t === "join")){
      const dI = best.ops.map(o => o.d + best.off), a = Math.min(...dI), b = Math.max(...dI);
      return { phrase, status: "ok", score: 1, pct: 100, where: [...new Set(dI.map(k => segs[segOf[k]].label))].join(" → "), ocr: segs[segOf[a]].ocr, found: docSlice(a, b), blocks: [], missing: [], extra: [], shotReq: shotFor(a, b, "ok") };
    }
    const score = best.score, pct = Math.round(score * 100);
    let found = "", where = "", shotReq = null, blocks = [], missing = [], extra = [];
    const dIdx = best.ops.filter(o => o.d != null).map(o => o.d + best.off);
    if (dIdx.length && pct > 0){
      const a = Math.min(...dIdx), b = Math.max(...dIdx);
      found = docSlice(a, b);
      where = [...new Set(dIdx.map(k => segs[segOf[k]].label))].join(" → ");
      // blocos de divergência (texto original da frase × texto do documento)
      let cur = null;
      const flush = () => { if (!cur) return; const exp = cur.p.length ? phrase.slice(ph[Math.min(...cur.p)].s, ph[Math.max(...cur.p)].e) : ""; const got = cur.d.length ? docSlice(Math.min(...cur.d), Math.max(...cur.d)) : ""; blocks.push({ exp, got, kind: cur.kind }); cur = null; };
      for (const o of best.ops){
        if (o.t === "eq" || o.t === "join"){ flush(); continue; }
        const kind = o.t === "fuzzy" ? "fuzzy" : "diff";
        if (!cur || (cur.kind !== kind)) { flush(); cur = { p: [], d: [], kind }; }
        if (o.p != null) cur.p.push(o.p);
        if (o.d != null) cur.d.push(o.d + best.off);
        if (o.t === "miss") missing.push(ph[o.p].o);
        if (o.t === "extra") extra.push(doc[o.d + best.off].o);
        if (o.t === "sub"){ missing.push(ph[o.p].o); extra.push(doc[o.d + best.off].o); }
      }
      flush();
      if (pct >= 30) shotReq = shotFor(a, b, pct >= cfg.simil ? "warn" : "fail");
    }
    const status = pct >= cfg.simil ? "warn" : "fail";
    return { phrase, status, score, pct, found, missing, extra, blocks, where, shotReq };
  }).filter(Boolean);
  let status = "na";
  if (results.length) status = results.some(r => r.status === "fail") ? "fail" : results.some(r => r.status === "warn") ? "warn" : "ok";
  return { status, results };
}
function analyze(entry){
  const segs = entry.segments;
  const iof = checkIof(segs), forb = checkForbidden(segs), phr = checkPhrases(segs);
  const st = [iof.status, forb.status, phr.status];
  let overall = st.includes("fail") ? "fail" : st.includes("warn") ? "warn" : "ok";
  if (overall === "ok" && entry.unread.length) overall = "warn";
  const totalText = segs.reduce((a, s) => a + segText(s).length, 0);
  if (totalText < 5){ overall = "warn"; }
  entry.result = { iof, forb, phr, overall, empty: totalText < 5 };
}


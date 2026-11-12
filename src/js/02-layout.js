/* ---------------- layout model ----------------
   segment = { label, page, ocr, tol, rows: [[{t,x0,x1}]] }  */
function groupPositioned(items){ // items: {t,x,w,top,h}
  items = items.filter(i => i.t && i.t.trim());
  items.sort((a,b) => a.top - b.top || a.x - b.x);
  const rows = []; let cur = null;
  for (const it of items){
    if (cur && Math.abs(it.top - cur.top) <= Math.max(2, Math.min(it.h, cur.h) * 0.55)) cur.items.push(it);
    else { cur = { top: it.top, h: it.h, items: [it] }; rows.push(cur); }
  }
  return rows.map(r => {
    r.items.sort((a,b) => a.x - b.x);
    const cells = [];
    for (const it of r.items){
      const last = cells[cells.length - 1];
      const gap = last ? it.x - last.x1 : Infinity;
      const h = it.h || 10;
      if (last && gap <= h * 0.15) { last.t += it.t; last.x1 = Math.max(last.x1, it.x + it.w); }
      else if (last && gap <= h * 1.1) { last.t += " " + it.t; last.x1 = Math.max(last.x1, it.x + it.w); }
      else cells.push({ t: it.t, x0: it.x, x1: it.x + it.w });
    }
    cells.forEach(c => c.t = c.t.replace(/\s+/g, " ").trim());
    const out = cells.filter(c => c.t);
    out.top = r.top; out.h = Math.max(...r.items.map(i => i.h || 0)) || r.h;
    return out;
  }).filter(r => r.length);
}
function textRows(text){
  return String(text).split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean).map(l => [{ t: l, x0: 0, x1: 1e9 }]);
}
const rowText = r => r.map(c => c.t).join("   ");
function segText(s){
  if (s._text != null) return s._text;
  const map = []; let off = 0;
  s.rows.forEach((row, r) => { if (r) off += 1; row.forEach((c, ci) => { if (ci) off += 3; map.push({ r, ci, s: off, e: off + c.t.length }); off += c.t.length; }); });
  s._map = map;
  return s._text = s.rows.map(rowText).join("\n");
}

function htmlToRows(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [];
  const walk = el => {
    for (const n of el.children){
      const tag = n.tagName.toLowerCase();
      if (tag === "table"){
        for (const tr of n.querySelectorAll("tr")){
          if (tr.closest("table") !== n) continue;
          let col = 0; const cells = [];
          for (const td of tr.children){
            const span = parseInt(td.getAttribute("colspan") || "1", 10) || 1;
            const t = td.textContent.replace(/\s+/g, " ").trim();
            if (t) cells.push({ t, x0: col, x1: col + span - 0.01 });
            col += span;
          }
          if (cells.length) rows.push(cells);
          for (const inner of tr.querySelectorAll("table")) if (inner.parentElement.closest("table") === n) walk({ children: [inner] });
        }
      } else if (/^(p|h[1-6]|li|pre|blockquote|dt|dd|caption|figcaption|address)$/.test(tag)){
        const t = n.textContent.replace(/\s+/g, " ").trim();
        if (t) rows.push([{ t, x0: 0, x1: 1e9 }]);
      } else if (n.children.length) walk(n);
      else { const t = n.textContent.replace(/\s+/g, " ").trim(); if (t) rows.push([{ t, x0: 0, x1: 1e9 }]); }
    }
  };
  walk(doc.body);
  return rows;
}


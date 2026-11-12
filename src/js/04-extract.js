/* ---------------- extractors ---------------- */
async function extractPdf(entry, buf, mode, status){
  await loadScript(LIBS.pdf);
  if (!window.pdfjsWorker) await loadScript(LIBS.pdfWorker);
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
  const pdf = await lib.getDocument({ data: buf, cMapUrl: LIBS.cmaps, cMapPacked: true, isEvalSupported: false }).promise;
  entry.pages = pdf.numPages;
  const segs = [];
  const OPS = lib.OPS;
  for (let i = 1; i <= pdf.numPages; i++){
    status(`Página ${i} de ${pdf.numPages}`);
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const items = tc.items.filter(it => it.str && it.str.trim()).map(it => {
      const h = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
      return { t: it.str, x: it.transform[4], w: it.width, top: -it.transform[5], h };
    });
    const rows = groupPositioned(items);
    segs.push({ label: `Pág. ${i}`, page: i, ocr: false, tol: 18, rows, geom: "pdf" });
    const textLen = items.reduce((a, it) => a + it.t.trim().length, 0);
    let needOcr = mode === "sempre", reason = "";
    if (mode === "auto"){
      if (textLen < 40){ needOcr = true; reason = "sem texto digital"; }
      else {
        try {
          const ops = await page.getOperatorList();
          for (let k = 0; k < ops.fnArray.length; k++){
            const fn = ops.fnArray[k], a = ops.argsArray[k];
            let w = 0, h = 0;
            if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat){ w = a[1]; h = a[2]; }
            else if (fn === OPS.paintInlineImageXObject && a[0]){ w = a[0].width; h = a[0].height; }
            if (w * h >= 120000){ needOcr = true; reason = "contém imagem"; break; }
          }
        } catch(e){}
      }
    }
    if (needOcr){
      try {
        status(`Página ${i} de ${pdf.numPages} · OCR${reason ? " (" + reason + ")" : ""}`);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = Math.min(3.2, Math.max(1.5, 2200 / vp1.width));
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        await getOcr(status);
        status(`Página ${i} de ${pdf.numPages} · lendo imagem (OCR)`);
        const o = await ocrToRows(canvas, status);
        segs.push({ label: `Pág. ${i} (OCR)`, page: i, ocr: true, tol: o.tol * scale / 2, rows: o.rows, hasText: textLen >= 40, geom: "px", pxScale: scale });
        canvas.width = canvas.height = 0;
      } catch(e){
        if (textLen < 40) entry.unread.push(`Pág. ${i}: sem texto digital e não foi possível aplicar OCR.`);
        else entry.notes.push(`Pág. ${i}: contém imagem, mas o OCR não pôde ser aplicado.`);
        if (!entry.notes.includes(e.message)) entry.notes.push(e.message);
      }
    } else if (textLen < 40 && mode === "nunca"){
      entry.unread.push(`Pág. ${i}: sem texto digital (OCR desligado).`);
    }
    page.cleanup();
  }
  await pdf.destroy();
  return segs;
}

function xmlParas(xml){
  const d = new DOMParser().parseFromString(xml, "application/xml");
  const out = [];
  for (const p of d.getElementsByTagName("w:p")){
    let t = "";
    for (const n of p.getElementsByTagName("*")){
      if (n.nodeName === "w:t") t += n.textContent;
      else if (n.nodeName === "w:tab") t += " ";
    }
    t = t.replace(/\s+/g, " ").trim(); if (t) out.push(t);
  }
  return out;
}
async function ocrMedia(entry, zip, prefix, mode, status){
  const segs = [];
  if (mode === "nunca") return segs;
  const files = Object.keys(zip.files).filter(n => n.startsWith(prefix) && /\.(png|jpe?g|gif|bmp|webp|tiff?)$/i.test(n));
  let idx = 0;
  for (const name of files){
    idx++;
    const blob = await zip.file(name).async("blob");
    const area = await imageArea(blob);
    if (mode === "auto" && area >= 0 && area < 120000) continue;
    try {
      status(`Imagem ${idx} de ${files.length} · OCR`);
      const o = await ocrToRows(blob, status);
      if (o.rows.length) segs.push({ label: `Imagem ${name.split("/").pop()} (OCR)`, page: null, ocr: true, tol: o.tol, rows: o.rows, geom: "img", blob });
    } catch(e){ if (!entry.notes.includes(e.message)) entry.notes.push(e.message); entry.notes.push(`Imagem ${name.split("/").pop()} não pôde ser lida.`); }
  }
  return segs;
}
async function extractDocx(entry, buf, mode, status){
  await loadScript(LIBS.mammoth); await loadScript(LIBS.jszip);
  status("Lendo o corpo do documento");
  const res = await mammoth.convertToHtml({ arrayBuffer: buf }, { convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })) });
  const segs = [{ label: "Corpo", page: null, ocr: false, tol: 0, rows: htmlToRows(res.value) }];
  const zip = await JSZip.loadAsync(buf);
  const parts = Object.keys(zip.files).filter(n => /^word\/(header|footer|footnotes|endnotes)\d*\.xml$/.test(n)).sort();
  for (const n of parts){
    const paras = xmlParas(await zip.file(n).async("string"));
    if (paras.length) segs.push({ label: n.includes("header") ? "Cabeçalho" : n.includes("footer") ? "Rodapé" : "Notas", page: null, ocr: false, tol: 1e9, rows: paras.map(t => [{ t, x0: 0, x1: 1e9 }]) });
  }
  return segs.concat(await ocrMedia(entry, zip, "word/media/", mode, status));
}
async function extractPptx(entry, buf, mode, status){
  await loadScript(LIBS.jszip);
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files).filter(n => /^ppt\/(slides|notesSlides)\/\w+?\d+\.xml$/.test(n))
    .sort((a,b) => (a.includes("notes") - b.includes("notes")) || (parseInt(a.match(/(\d+)\.xml$/)[1]) - parseInt(b.match(/(\d+)\.xml$/)[1])));
  const segs = [];
  for (const n of slides){
    const d = new DOMParser().parseFromString(await zip.file(n).async("string"), "application/xml");
    const rows = [];
    for (const p of d.getElementsByTagName("a:p")){ let t = ""; for (const r of p.getElementsByTagName("a:t")) t += r.textContent; t = t.replace(/\s+/g, " ").trim(); if (t) rows.push([{ t, x0: 0, x1: 1e9 }]); }
    const num = n.match(/(\d+)\.xml$/)[1];
    if (rows.length) segs.push({ label: (n.includes("notes") ? "Notas do slide " : "Slide ") + num, page: +num, ocr: false, tol: 1e9, rows });
  }
  entry.pages = slides.filter(n => !n.includes("notes")).length;
  return segs.concat(await ocrMedia(entry, zip, "ppt/media/", mode, status));
}
async function extractXlsx(entry, buf, mode, status){
  await loadScript(LIBS.xlsx);
  const wb = XLSX.read(buf, { type: "array" });
  const segs = wb.SheetNames.map(name => {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" });
    const rows = data.map(r => r.map((v, i) => ({ t: String(v).replace(/\s+/g, " ").trim(), x0: i, x1: i + 0.99 })).filter(c => c.t)).filter(r => r.length);
    return { label: "Aba " + name, page: null, ocr: false, tol: 0, rows };
  });
  if (/^xlsx$/i.test(entry.ext)){
    try { await loadScript(LIBS.jszip); const zip = await JSZip.loadAsync(buf); segs.push(...await ocrMedia(entry, zip, "xl/media/", mode, status)); } catch(e){}
  }
  return segs;
}
function rtfToText(s){
  return s.replace(/\\par[d]?\b/g, "\n").replace(/\\line\b/g, "\n").replace(/\\tab\b/g, " ")
    .replace(/\{\\\*[^{}]*\}/g, "").replace(/\\'([0-9a-f]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (m, n) => String.fromCharCode((+n + 65536) % 65536))
    .replace(/\\[a-z]+-?\d* ?/gi, "").replace(/[{}]/g, "");
}
function legacyDocText(buf){
  const u8 = new Uint8Array(buf); const out = [];
  let cur = "";
  for (let i = 0; i + 1 < u8.length; i += 2){ const c = u8[i] | (u8[i+1] << 8); if ((c >= 32 && c < 0x250) || c === 13 || c === 10 || c === 9){ cur += c === 13 ? "\n" : String.fromCharCode(c); } else { if (cur.replace(/\s/g, "").length >= 6) out.push(cur); cur = ""; } }
  if (cur.replace(/\s/g, "").length >= 6) out.push(cur);
  let a = out.join("\n"); cur = ""; const out2 = [];
  for (let i = 0; i < u8.length; i++){ const c = u8[i]; if ((c >= 32 && c < 127) || c >= 0xC0 || c === 13 || c === 10 || c === 9){ cur += c === 13 ? "\n" : String.fromCharCode(c); } else { if (cur.replace(/\s/g, "").length >= 6) out2.push(cur); cur = ""; } }
  const b = out2.join("\n");
  const score = t => (t.match(/\b(de|que|o|a|em|do|da|para|com)\b/gi) || []).length;
  return score(a) >= score(b) ? a : b;
}
async function extract(entry, mode, status){
  const f = entry.file, ext = entry.ext;
  const buf = await f.arrayBuffer();
  if (ext === "pdf") return extractPdf(entry, buf, mode, status);
  if (ext === "docx") return extractDocx(entry, buf, mode, status);
  if (ext === "pptx") return extractPptx(entry, buf, mode, status);
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return extractXlsx(entry, buf, mode, status);
  if (/^(png|jpe?g|bmp|gif|webp|tiff?)$/.test(ext)){
    if (mode === "nunca"){ entry.unread.push("Imagem não lida: OCR desligado."); return []; }
    status("Lendo imagem (OCR)");
    const o = await ocrToRows(f, status);
    return [{ label: "Imagem (OCR)", page: 1, ocr: true, tol: o.tol, rows: o.rows, geom: "img", blob: f }];
  }
  const text = new TextDecoder("utf-8").decode(buf);
  if (ext === "htm" || ext === "html") return [{ label: "Documento", page: null, ocr: false, tol: 0, rows: htmlToRows(text) }];
  if (ext === "rtf") return [{ label: "Documento", page: null, ocr: false, tol: 1e9, rows: textRows(rtfToText(text)) }];
  if (ext === "doc"){
    entry.notes.push("Formato .doc antigo: a leitura é aproximada e imagens não são lidas. Se possível, salve como .docx ou PDF.");
    return [{ label: "Documento", page: null, ocr: false, tol: 1e9, rows: textRows(legacyDocText(buf)) }];
  }
  let t = text; if (t.includes("\uFFFD")) t = new TextDecoder("windows-1252").decode(buf);
  return [{ label: "Documento", page: null, ocr: false, tol: 1e9, rows: textRows(t) }];
}


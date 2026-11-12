/* ---------------- OCR ---------------- */
let ocrWorkerP = null, ocrError = null;
async function getOcr(onStatus){
  if (ocrError) throw ocrError;
  if (!ocrWorkerP){
    onStatus && onStatus("Preparando OCR (baixando o dicionário de português, só na primeira vez)…");
    ocrWorkerP = (async () => {
      await loadScript(LIBS.tesseract);
      return await withTimeout(Tesseract.createWorker("por", 1, LIBS.ocrOptions || {}), 180000, "O OCR demorou demais para iniciar.");
    })().catch(e => { ocrError = new Error("OCR indisponível neste ambiente (" + (e.message || e) + "). Abra o arquivo HTML localmente no navegador para ler imagens."); ocrWorkerP = null; throw ocrError; });
  }
  return ocrWorkerP;
}
async function ocrToRows(img, onStatus){
  const w = await getOcr(onStatus);
  const { data } = await w.recognize(img, {}, { text: true, blocks: true });
  let words = data.words;
  if (!words && data.blocks){ words = []; for (const b of data.blocks) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const wd of l.words || []) words.push(wd); }
  if (words && words.length){
    const items = words.filter(wd => wd.text && wd.text.trim()).map(wd => ({ t: wd.text, x: wd.bbox.x0, w: wd.bbox.x1 - wd.bbox.x0, top: (wd.bbox.y0 + wd.bbox.y1) / 2, h: wd.bbox.y1 - wd.bbox.y0 }));
    return { rows: groupPositioned(items), tol: 40 };
  }
  return { rows: textRows(data.text || ""), tol: 1e9 };
}
async function imageArea(blob){
  try { const bm = await createImageBitmap(blob); const a = bm.width * bm.height; bm.close && bm.close(); return a; } catch(e){ return -1; }
}


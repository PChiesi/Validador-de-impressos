
(() => {
"use strict";
const LIBS = {
  pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  cmaps: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
  mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js",
  jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
};
if (window.__LIBS__) Object.assign(LIBS, window.__LIBS__);

const DEFAULT_CFG = {
  phrases: ["Em atendimento à Lei nº 12.741/12 informamos que incide a alíquota de 10,85% de CBS sobre os prêmios de seguros, deduzidos conforme o estabelecido em legislação específica"],
  forbidden: "PIS, COFINS",
  iofTerms: "IOF",
  simil: 85,
  ocrMode: "auto",
  onlyPdf: true,
};
const STORE_KEY = "validador-impressos-config-v2";
let cfg = loadCfg();
function loadCfg(){
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); if (s && Array.isArray(s.phrases)) return Object.assign({}, DEFAULT_CFG, s); } catch(e){}
  return JSON.parse(JSON.stringify(DEFAULT_CFG));
}
function saveCfg(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch(e){} }


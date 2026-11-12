/* ---------------- examples ---------------- */
function exampleEntry(name, ext, pages, segs, dir = ""){
  const e = { id: nextId++, file: null, example: true, name, dir, ext, size: null, pages, state: "done", notes: [], unread: [], segments: segs, open: false };
  analyze(e); return e;
}
function loadExamples(){
  const L = (t) => [{ t, x0: 0, x1: 1e9 }];
  const phrase = DEFAULT_CFG.phrases[0];
  entries = [
    exampleEntry("Endosso_RC-DC_modelo_2025.pdf", "pdf", 2, [
      { label: "Pág. 1", page: 1, ocr: false, tol: 18, rows: [
        [{ t: "ENDOSSO DE ALTERAÇÃO — RC-DC", x0: 60, x1: 300 }],
        [{ t: "Prêmio líquido", x0: 60, x1: 140 }, { t: "R$ 1.250,00", x0: 420, x1: 480 }],
        [{ t: "IOF (7,38%)", x0: 60, x1: 120 }, { t: "R$ 92,25", x0: 420, x1: 470 }],
        [{ t: "Prêmio total", x0: 60, x1: 130 }, { t: "R$ 1.342,25", x0: 420, x1: 480 }] ] },
      { label: "Pág. 2", page: 2, ocr: false, tol: 18, rows: [
        L("Em atendimento à Lei nº 12.741/12 informamos que incidem as alíquotas de 0,65% de PIS/Pasep e de 4% para"),
        L("a COFINS sobre os prêmios de seguros, deduzidos do estabelecido em legislação específica.") ] } ], "Impressos/Transportes/RC-DC"),
    exampleEntry("Certificado_RC-V_revisado.docx", "docx", null, [
      { label: "Corpo", page: null, ocr: false, tol: 0, rows: [
        L("CERTIFICADO DE SEGURO — RC-V"),
        [{ t: "Prêmio líquido", x0: 0, x1: 0.99 }, { t: "IOF", x0: 1, x1: 1.99 }, { t: "Prêmio total", x0: 2, x1: 2.99 }],
        [{ t: "980,00", x0: 0, x1: 0.99 }, { t: "0,00", x0: 1, x1: 1.99 }, { t: "980,00", x0: 2, x1: 2.99 }] ] },
      { label: "Rodapé", page: null, ocr: false, tol: 1e9, rows: [ L(phrase.replace("10,85%", "9,25%")) ] } ], "Impressos/Transportes/RC-V"),
    exampleEntry("Apolice_RCTR-C_nova.pdf", "pdf", 1, [
      { label: "Pág. 1", page: 1, ocr: false, tol: 18, rows: [
        [{ t: "APÓLICE RCTR-C", x0: 60, x1: 200 }],
        [{ t: "Prêmio líquido", x0: 60, x1: 140 }, { t: "R$ 2.300,00", x0: 420, x1: 480 }],
        [{ t: "IOF", x0: 60, x1: 80 }, { t: "R$ 0,00", x0: 420, x1: 470 }] ] },
      { label: "Pág. 1 (OCR)", page: 1, ocr: true, hasText: true, tol: 40, rows: [ L(phrase.split(" que incide")[0]), L("que incide" + phrase.split(" que incide")[1]) ] } ], "Impressos/Transportes/RCTR-C"),
    exampleEntry("Apolice_RCTR-C_frota.pdf", "pdf", 1, [
      { label: "Pág. 1", page: 1, ocr: false, tol: 18, rows: [
        [{ t: "APÓLICE RCTR-C — FROTA", x0: 60, x1: 220 }],
        [{ t: "IOF", x0: 60, x1: 80 }, { t: "R$ 0,00", x0: 420, x1: 470 }],
        L(phrase.replace("alíquota", "alfquota")) ] } ], "Impressos/Transportes/RCTR-C"),
  ];
  entries[0].open = true;
  examples = true;
  entries.forEach(queueShots);
}


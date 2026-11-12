/* ---------------- regras ---------------- */
function renderPhrases(){
  $("phrases").innerHTML = cfg.phrases.map((p, i) => `<div class="phrase flex items-start gap-2"><textarea id="phrase-${i}" data-phrase="${i}" rows="4" aria-label="Frase obrigatória ${i + 1}">${esc(p)}</textarea>${cfg.phrases.length > 1 ? `<button type="button" class="icon-btn shrink-0 hover:!text-rose-600" data-delphrase="${i}" aria-label="Remover frase"><i class="fa-solid fa-xmark"></i></button>` : ""}</div>`).join("");
}
function syncRulesUI(){
  renderPhrases();
  $("forbidden").value = cfg.forbidden; $("iofTerms").value = cfg.iofTerms;
  $("simil").value = cfg.simil; $("similOut").textContent = cfg.simil + "%";
  $("ocrMode").value = cfg.ocrMode; $("onlyPdf").checked = !!cfg.onlyPdf;
}
$("phrases").addEventListener("input", ev => { const i = ev.target.dataset.phrase; if (i == null) return; cfg.phrases[+i] = ev.target.value.replace(/\s*\n\s*/g, " "); saveCfg(); reanalyzeAll(); });
$("phrases").addEventListener("click", ev => { const b = ev.target.closest("[data-delphrase]"); if (!b) return; cfg.phrases.splice(+b.dataset.delphrase, 1); saveCfg(); renderPhrases(); reanalyzeAll(); });
$("btnAddPhrase").addEventListener("click", () => { cfg.phrases.push(""); saveCfg(); renderPhrases(); const t = $("phrase-" + (cfg.phrases.length - 1)); t && t.focus(); });
$("forbidden").addEventListener("input", ev => { cfg.forbidden = ev.target.value; saveCfg(); reanalyzeAll(); });
$("iofTerms").addEventListener("input", ev => { cfg.iofTerms = ev.target.value; saveCfg(); reanalyzeAll(); });
$("simil").addEventListener("input", ev => { cfg.simil = +ev.target.value; $("similOut").textContent = cfg.simil + "%"; saveCfg(); reanalyzeAll(); });
$("ocrMode").addEventListener("change", ev => { cfg.ocrMode = ev.target.value; saveCfg(); render(); toast("Modo de OCR alterado — vale para os próximos arquivos."); });
$("onlyPdf").addEventListener("change", ev => { cfg.onlyPdf = ev.target.checked; saveCfg(); });
$("btnReset").addEventListener("click", () => { cfg = JSON.parse(JSON.stringify(DEFAULT_CFG)); saveCfg(); syncRulesUI(); reanalyzeAll(); toast("Regras restauradas."); });

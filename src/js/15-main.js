/* ---------------- início ---------------- */
syncRulesUI();
loadExamples();
syncThemeSwitch();
showView(location.hash.slice(1) || "analise");
render();
document.fonts && document.fonts.ready.then(moveIndicator);
})();

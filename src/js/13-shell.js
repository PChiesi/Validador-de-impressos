/* ---------------- shell: navegação, menus, tema ---------------- */
const VIEWS = { analise: "Análise", relatorio: "Relatório executivo", regras: "Regras de validação", ajuda: "Como funciona" };
let currentView = null;
function moveIndicator(){
  const act = document.querySelector(".nav-item.active"), ind = $("navIndicator");
  if (!act){ ind.style.opacity = 0; return; }
  ind.style.opacity = 1; ind.style.transform = `translateY(${act.offsetTop}px)`;
}
function showView(v){
  if (!VIEWS[v]) v = "analise";
  if (v === currentView) return;
  currentView = v;
  document.querySelectorAll("[data-view]").forEach(s => {
    const on = s.dataset.view === v;
    s.hidden = !on;
    if (on){ s.style.animation = "none"; void s.offsetWidth; s.style.animation = ""; }
  });
  document.querySelectorAll("[data-nav]").forEach(a => { a.classList.toggle("active", a.dataset.nav === v); a.toggleAttribute("aria-current", a.dataset.nav === v); });
  $("crumb").textContent = VIEWS[v];
  moveIndicator();
  closeSidebar();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  if (v === "relatorio") renderDashboard(true);
}
function go(v){ if (location.hash !== "#" + v){ try { history.replaceState(null, "", "#" + v); } catch(e){ location.hash = v; } } showView(v); }
window.addEventListener("hashchange", () => showView(location.hash.slice(1)));
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const v = a.getAttribute("href").slice(1); if (!VIEWS[v]) return;
  e.preventDefault(); go(v);
});

/* sidebar */
const sidebar = $("sidebar"), overlay = $("sbOverlay");
function openSidebar(){ sidebar.classList.add("open"); overlay.hidden = false; $("btnMenu").setAttribute("aria-expanded", "true"); }
function closeSidebar(){ sidebar.classList.remove("open"); overlay.hidden = true; $("btnMenu").setAttribute("aria-expanded", "false"); }
$("btnMenu").addEventListener("click", () => sidebar.classList.contains("open") ? closeSidebar() : openSidebar());
overlay.addEventListener("click", closeSidebar);
$("btnCollapse").addEventListener("click", () => {
  if (window.innerWidth < 1024){ closeSidebar(); return; }
  const c = document.documentElement.classList.toggle("sb-collapsed");
  try { localStorage.setItem("vdi-sidebar", c ? "collapsed" : "open"); } catch(e){}
  $("btnCollapse").title = c ? "Expandir menu" : "Recolher menu";
  setTimeout(() => { moveIndicator(); Object.values(charts).forEach(ch => ch.resize()); }, 320);
});
window.addEventListener("resize", () => { moveIndicator(); });

/* menus suspensos */
const MENUS = [["btnAdd", "addMenu"], ["btnExport", "expMenu"]];
function closeMenus(){ for (const [b, m] of MENUS){ $(m).hidden = true; $(b).setAttribute("aria-expanded", "false"); } }
for (const [b, m] of MENUS){
  $(b).addEventListener("click", e => {
    e.stopPropagation();
    const open = $(m).hidden; closeMenus();
    if (open){ $(m).hidden = false; $(b).setAttribute("aria-expanded", "true"); const first = $(m).querySelector(".menu-item:not(:disabled)"); first && first.focus(); }
  });
}
document.addEventListener("click", e => { if (!e.target.closest(".menu")) closeMenus(); });
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  closeMenus(); closeSidebar();
  if (!$("lb").hidden) closeLb();
});

/* tema */
function syncThemeSwitch(){ $("btnTheme").setAttribute("aria-checked", String(isDark())); }
$("btnTheme").addEventListener("click", () => {
  const root = document.documentElement, dark = !root.classList.contains("dark");
  root.classList.add("theme-anim");
  root.classList.toggle("dark", dark); root.style.colorScheme = dark ? "dark" : "light";
  try { localStorage.setItem("vdi-theme", dark ? "dark" : "light"); } catch(e){}
  syncThemeSwitch(); rebuildCharts();
  setTimeout(() => root.classList.remove("theme-anim"), 400);
});

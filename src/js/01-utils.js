/* ---------------- utilities ---------------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const scripts = {};
function loadScript(url){
  if (!scripts[url]) scripts[url] = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = url; s.async = true;
    s.onload = () => res(); s.onerror = () => { delete scripts[url]; rej(new Error("Não foi possível carregar a biblioteca: " + url.split("/").slice(-3).join("/"))); };
    document.head.appendChild(s);
  });
  return scripts[url];
}
function withTimeout(p, ms, msg){ let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); })]).finally(() => clearTimeout(t)); }
function toast(msg){
  const t = $("toast"); $("toastMsg").textContent = msg;
  t.hidden = false; t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 3600);
}
const extOf = name => (name.match(/\.([a-z0-9]+)$/i) || [,""])[1].toLowerCase();
const fmtSize = b => b < 1024 ? b + " B" : b < 1048576 ? (b/1024).toFixed(0) + " KB" : (b/1048576).toFixed(1) + " MB";


/* ---------------- eventos: entrada e lista ---------------- */
const drop = $("drop");
const pick = kind => { closeMenus(); (kind === "folder" ? $("dirIn") : $("fileIn")).click(); };
document.addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b){ e.preventDefault(); pick(b.dataset.add); } });
drop.addEventListener("click", () => pick("files"));
drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); pick("files"); } });
$("fileIn").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; go("analise"); });
$("dirIn").addEventListener("change", e => { addFiles(e.target.files, { fromFolder: true }); e.target.value = ""; go("analise"); });
let dragDepth = 0;
document.addEventListener("dragenter", e => { e.preventDefault(); dragDepth++; drop.classList.add("over"); });
document.addEventListener("dragover", e => e.preventDefault());
document.addEventListener("dragleave", e => { e.preventDefault(); if (--dragDepth <= 0){ dragDepth = 0; drop.classList.remove("over"); } });
document.addEventListener("drop", async e => {
  e.preventDefault(); dragDepth = 0; drop.classList.remove("over");
  const dt = e.dataTransfer; if (!dt) return;
  const items = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (items.some(i => i.isDirectory)){
    const fromDir = [], loose = [];
    const walk = (entry, bucket) => new Promise(res => {
      if (entry.isFile) entry.file(f => { const rel = entry.fullPath.replace(/^\//, ""); f._relPath = rel; try { Object.defineProperty(f, "webkitRelativePath", { value: rel }); } catch(_){} bucket.push(f); res(); }, () => res());
      else { const r = entry.createReader(); const all = []; const read = () => r.readEntries(async es => { if (!es.length){ for (const x of all) await walk(x, bucket); res(); } else { all.push(...es); read(); } }, () => res()); read(); }
    });
    toast("Mapeando a pasta…");
    for (const it of items) await walk(it, it.isDirectory ? fromDir : loose);
    if (loose.length) addFiles(loose);
    if (fromDir.length || items.some(i => i.isDirectory)) addFiles(fromDir, { fromFolder: true });
  } else addFiles(dt.files);
  go("analise");
});

const setFilter = f => { filter = (filter === f && f !== "all") ? "all" : f; pageSize = 50; render(); };
["kpis", "tabs"].forEach(id => $(id).addEventListener("click", e => { const b = e.target.closest("[data-filter]"); if (b) setFilter(b.dataset.filter); }));
$("search").addEventListener("input", e => { searchQ = e.target.value; pageSize = 50; renderList(); });
$("folderChip").addEventListener("click", e => { if (e.target.closest("[data-clearfolder]")){ folderFilter = null; render(); } });
$("tree").addEventListener("click", e => {
  const tg = e.target.closest("[data-treetoggle]");
  if (tg){ const p = tg.dataset.treetoggle; treeOpen.has(p) ? treeOpen.delete(p) : treeOpen.add(p); renderTree(); return; }
  const f = e.target.closest("[data-folder]");
  if (f){ folderFilter = folderFilter === f.dataset.folder ? null : f.dataset.folder; pageSize = 50; render(); }
});
$("btnMore").addEventListener("click", () => { pageSize += 50; renderList(); });
$("list").addEventListener("click", e => {
  const rm = e.target.closest("[data-remove]");
  if (rm){ entries = entries.filter(x => x.id !== +rm.dataset.remove); if (!entries.length) examples = false; render(); return; }
  const t = e.target.closest("[data-toggle]"); if (!t) return;
  const en = entries.find(x => x.id === +t.dataset.toggle); if (!en) return;
  en.open = !en.open; renderList();
});
function openDoc(id){
  const en = entries.find(x => x.id === id); if (!en) return;
  filter = "all"; folderFilter = null; searchQ = ""; $("search").value = "";
  en.open = true;
  const idx = visibleEntries().indexOf(en); if (idx >= pageSize) pageSize = idx + 1;
  go("analise"); render();
  requestAnimationFrame(() => { const el = document.querySelector(`.doc[data-id="${id}"]`); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); });
}
$("pendTable").addEventListener("click", e => { const r = e.target.closest("[data-goto]"); if (r) openDoc(+r.dataset.goto); });

$("btnCopy").addEventListener("click", () => { closeMenus(); copyReport(); });
$("btnXlsx").addEventListener("click", () => { closeMenus(); downloadXlsx(); });
$("btnHtml").addEventListener("click", () => { closeMenus(); downloadHtmlReport(); });
$("btnRepXlsx").addEventListener("click", downloadXlsx);
$("btnRepHtml").addEventListener("click", downloadHtmlReport);
if (window.self === window.top){ $("btnPrint").hidden = false; $("btnPrint").addEventListener("click", () => window.print()); }

let lbCur = null;
$("list").addEventListener("click", e => {
  const b = e.target.closest("[data-shot]"); if (!b) return;
  e.stopPropagation(); lbCur = shotReg.get(+b.dataset.shot); if (!lbCur) return;
  $("lbImg").src = lbCur.shot; $("lb").hidden = false; $("lbClose").focus();
}, true);
const closeLb = () => { $("lb").hidden = true; $("lbImg").removeAttribute("src"); };
$("lbClose").addEventListener("click", closeLb);
$("lb").addEventListener("click", e => { if (e.target.id === "lb") closeLb(); });
function pngBlob(url){
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); c.toBlob(b => b ? res(b) : rej(new Error("png")), "image/png"); }; img.onerror = rej; img.src = url; });
}
$("lbCopy").addEventListener("click", async () => {
  if (!lbCur) return;
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob(lbCur.shot) })]); toast("Imagem copiada — cole no e-mail, Word ou Teams."); }
  catch(e){ toast("O navegador bloqueou a cópia. Clique com o botão direito na imagem e escolha “Copiar imagem”."); }
});
$("lbSave").addEventListener("click", async () => {
  if (!lbCur) return;
  try { const b = await pngBlob(lbCur.shot); saveBlob(b, "print-" + lbCur.shotId + ".png"); } catch(e){ toast("Não foi possível baixar a imagem."); }
});
$("btnClear").addEventListener("click", () => { entries = entries.filter(e => e.state === "run"); examples = false; folderFilter = null; treeOpen.clear(); render(); toast("Lista limpa."); });
$("btnReproc").addEventListener("click", () => { entries.forEach(e => { if (e.file && e.state !== "run"){ e.state = "q"; e.segments = []; e.result = null; } }); render(); runQueue(); });

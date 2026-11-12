/* ---------------- state & queue ---------------- */
const SUPPORTED = /^(pdf|docx|doc|xlsx|xls|csv|pptx|png|jpe?g|bmp|gif|webp|tiff?|txt|htm|html|rtf|xml|eml)$/;
let entries = [], nextId = 1, filter = "all", running = false, examples = false;
let folderFilter = null;            // caminho de pasta selecionado no mapa
const splitPath = rel => { const parts = String(rel || "").split("/").filter(Boolean); const name = parts.pop() || ""; return { dir: parts.join("/"), name }; };

/* fileList: File[]; opts.fromFolder → arquivos vieram de uma pasta (inclui subpastas) */
function addFiles(fileList, opts = {}){
  let files = [...fileList].filter(f => !f.name.startsWith("~$") && !f.name.startsWith("."));
  const total = files.length;
  let ignored = 0;
  if (opts.fromFolder && cfg.onlyPdf){ const pdfs = files.filter(f => extOf(f.name) === "pdf"); ignored = total - pdfs.length; files = pdfs; }
  const ok = files.filter(f => SUPPORTED.test(extOf(f.name)));
  ignored += files.length - ok.length;
  if (examples){ entries = []; examples = false; folderFilter = null; }
  const known = new Set(entries.map(e => (e.dir ? e.dir + "/" : "") + e.name + "|" + e.size));
  let dup = 0;
  for (const f of ok){
    const rel = f.webkitRelativePath || f._relPath || f.name;
    const { dir, name } = splitPath(rel);
    const key = (dir ? dir + "/" : "") + name + "|" + f.size;
    if (known.has(key)){ dup++; continue; }
    known.add(key);
    entries.push({ id: nextId++, file: f, name, dir, fromFolder: !!opts.fromFolder, ext: extOf(name), size: f.size, state: "q", notes: [], unread: [], segments: [], pages: null, open: false, added: Date.now() });
  }
  if (opts.fromFolder){
    const dirs = new Set(ok.map(f => splitPath(f.webkitRelativePath || f._relPath || f.name).dir));
    toast(ok.length
      ? `Pasta mapeada: ${ok.length} ${cfg.onlyPdf ? "PDF(s)" : "arquivo(s)"} em ${dirs.size} pasta(s)${ignored ? ` · ${ignored} outro(s) ignorado(s)` : ""}${dup ? ` · ${dup} repetido(s)` : ""}.`
      : `Nenhum ${cfg.onlyPdf ? "PDF" : "arquivo compatível"} encontrado nessa pasta (${total} arquivo(s) verificados).`);
  } else if (ignored || dup) toast([ignored ? `${ignored} arquivo(s) ignorado(s) por formato não suportado` : "", dup ? `${dup} repetido(s)` : ""].filter(Boolean).join(" · ") + ".");
  render(); runQueue();
}
async function runQueue(){
  if (running) return; running = true;
  try {
    let e;
    while ((e = entries.find(x => x.state === "q"))){
      e.state = "run"; e.progress = "Abrindo arquivo"; e.t0 = performance.now(); render();
      const status = msg => { e.progress = msg; renderProgress(); };
      try {
        e.notes = []; e.unread = [];
        e.segments = await extract(e, cfg.ocrMode, status);
        analyze(e); e.state = "done";
        render();
        e.progress = "Gerando prints";
        await queueShots(e);
      } catch(err){
        console.error(err); e.state = "err"; e.error = (err && err.message) || String(err);
        if (/password|encrypt/i.test(e.error)) e.error = "PDF protegido por senha — não foi possível abrir.";
      }
      e.ms = performance.now() - e.t0;
      render();
    }
  } finally { running = false; render(); }
}
let reTimer = null;
function reanalyzeAll(){ clearTimeout(reTimer); reTimer = setTimeout(() => { entries.forEach(e => { if (e.state === "done"){ analyze(e); queueShots(e); } }); render(); }, 400); }

// Monta o index.html final: compila o CSS (Tailwind) e junta os módulos JS num único arquivo.
// Uso: npm install && npm run build
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL(".", import.meta.url).pathname;
mkdirSync(join(root, "dist"), { recursive: true });
execFileSync(join(root, "node_modules/.bin/tailwindcss"), ["-c", "tailwind.config.js", "-i", "src/styles.css", "-o", "dist/app.css", "--minify"], { cwd: root, stdio: "inherit" });

const css = readFileSync(join(root, "dist/app.css"), "utf8");
const jsDir = join(root, "src/js");
const js = readdirSync(jsDir).filter(f => f.endsWith(".js")).sort().map(f => `/* ${f} */\n` + readFileSync(join(jsDir, f), "utf8")).join("\n");
const tpl = readFileSync(join(root, "src/template.html"), "utf8");
const page = tpl.replace("/*{{CSS}}*/", () => css).replace("/*{{JS}}*/", () => js);
writeFileSync(join(root, "index.html"), page);
console.log(`index.html gerado (${(page.length / 1024).toFixed(0)} KB)`);


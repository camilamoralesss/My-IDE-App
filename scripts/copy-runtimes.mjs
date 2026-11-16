// Copia los runtimes (Pyodide y sql.js) a public/vendor para que la app funcione sin internet.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'vendor');

const copies = [
  ['pyodide', 'pyodide', ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']],
  ['sql.js/dist', 'sqljs', ['sql-wasm-browser.wasm']],
];

for (const [from, to, files] of copies) {
  mkdirSync(join(out, to), { recursive: true });
  for (const f of files) {
    const src = join(nm, from, f);
    if (!existsSync(src)) throw new Error(`No se encontró ${src}. ¿Ejecutaste npm install?`);
    cpSync(src, join(out, to, f));
  }
}
console.log('Runtimes copiados a public/vendor');

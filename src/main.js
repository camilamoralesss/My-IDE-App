import './style.css';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab, undo, redo } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { sql } from '@codemirror/lang-sql';

import { loadFiles, saveFiles, loadCurrent, saveCurrent, restoreDefaults } from './storage.js';
import { runPython } from './runners/python.js';
import { runSql, resetDb } from './runners/sql.js';
import { buildHtml, buildJsOnly, pickHtmlFor, isWebFile } from './runners/web.js';

// ---------- Estado ----------
let files = loadFiles();
let current = loadCurrent(files);
const states = new Map(); // un EditorState por archivo (conserva deshacer/rehacer)
let liveOn = true;           // vista previa en vivo para HTML/CSS/JS
try { liveOn = localStorage.getItem('codepad.live.v1') !== 'off'; } catch { /* noop */ }

const $ = (id) => document.getElementById(id);
const ext = (name) => name.split('.').pop().toLowerCase();
const LANGS = {
  py: { label: 'PY', lang: () => python() },
  html: { label: 'HTML', lang: () => html() },
  css: { label: 'CSS', lang: () => css() },
  js: { label: 'JS', lang: () => javascript() },
  sql: { label: 'SQL', lang: () => sql() },
};

// ---------- Editor ----------
const language = new Compartment();
let saveTimer;

function makeState(name) {
  return EditorState.create({
    doc: files[name] ?? '',
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      oneDark,
      language.of(LANGS[ext(name)]?.lang() ?? []),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        files[current] = u.state.doc.toString();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveFiles(files), 400);
        if (liveOn && isWebFile(current)) scheduleLive();
      }),
    ],
  });
}

const view = new EditorView({ parent: $('editor') });

function openFile(name, { keepPrevious = true } = {}) {
  if (keepPrevious && states.has(current)) states.set(current, view.state);
  current = name;
  saveCurrent(name);
  if (!states.has(name)) states.set(name, makeState(name));
  view.setState(states.get(name));
  $('file-name').textContent = name;
  $('file-lang').textContent = LANGS[ext(name)]?.label ?? ext(name).toUpperCase();
  $('btn-reset-db').hidden = ext(name) !== 'sql';
  renderFileList();
  applyLayout();
  if (liveOn && isWebFile(name)) renderWeb();
}

// ---------- Barra de símbolos (teclado móvil) ----------
const KEYS = ['⇥', '(', ')', '{', '}', '[', ']', '<', '>', '=', '"', "'", ':', ';', '.', ',', '/', '#', '_', '↶', '↷'];
for (const k of KEYS) {
  const b = document.createElement('button');
  b.textContent = k;
  b.addEventListener('mousedown', (e) => e.preventDefault()); // no cerrar el teclado
  b.addEventListener('click', () => {
    if (k === '↶') return undo(view);
    if (k === '↷') return redo(view);
    const text = k === '⇥' ? '    ' : k;
    view.dispatch(view.state.replaceSelection(text));
    view.focus();
  });
  $('keybar').appendChild(b);
}

// ---------- Panel de resultado ----------
const consoleEl = $('console');
const preview = $('preview');

function print(text, kind = 'out') {
  const last = consoleEl.lastElementChild;
  if (last && last.dataset.kind === kind && last.tagName === 'PRE') {
    last.textContent += text;
  } else {
    const pre = document.createElement('pre');
    pre.dataset.kind = kind;
    pre.className = `line ${kind}`;
    pre.textContent = text;
    consoleEl.appendChild(pre);
  }
  consoleEl.scrollTop = consoleEl.scrollHeight;
}
const line = (text, kind) => print(text.endsWith('\n') ? text : text + '\n', kind);

function renderTable({ columns, rows }) {
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const t = document.createElement('table');
  const head = t.createTHead().insertRow();
  columns.forEach((c) => { const th = document.createElement('th'); th.textContent = c; head.appendChild(th); });
  const body = t.createTBody();
  rows.forEach((r) => {
    const tr = body.insertRow();
    r.forEach((v) => { tr.insertCell().textContent = v === null ? 'NULL' : v; });
  });
  wrap.appendChild(t);
  consoleEl.appendChild(wrap);
}

function clearOutput() {
  consoleEl.innerHTML = '';
}
const setStatus = (s) => { $('status').textContent = s; };

window.addEventListener('message', (e) => {
  if (e.source !== preview.contentWindow || !e.data?.__codepad) return;
  line(e.data.text, e.data.level === 'error' ? 'err' : e.data.level === 'warn' ? 'warn' : 'out');
});

// ---------- Ejecutar ----------
let running = false;

async function run() {
  if (running) return;
  running = true;
  $('btn-run').disabled = true;
  saveFiles(files);
  clearOutput();
  showView('output');
  const kind = ext(current);
  const t0 = performance.now();

  try {
    if (kind === 'py') {
      preview.hidden = true;
      setStatus('Cargando Python…');
      await new Promise((r) => setTimeout(r, 30)); // deja pintar la interfaz
      await runPython(files[current], {
        files, filename: current,
        out: (s) => line(s, 'out'),
        err: (s) => line(s, 'err'),
        info: (s) => line(s, 'info'),
      });
    } else if (kind === 'sql') {
      preview.hidden = true;
      setStatus('Ejecutando SQL…');
      const results = await runSql(files[current]);
      for (const r of results) {
        line(r.sql, 'info');
        if (r.columns) {
          r.rows.length ? renderTable(r) : line('(sin filas)', 'out');
        } else {
          line(`OK · ${r.changes} fila(s) afectada(s)`, 'out');
        }
      }
    } else if (isWebFile(current)) {
      renderWeb();
    } else {
      line(`No sé ejecutar archivos .${kind}`, 'warn');
    }
    setStatus(`Terminado en ${Math.round(performance.now() - t0)} ms`);
  } catch (e) {
    line(String(e?.message ?? e), 'err');
    setStatus('Error');
  } finally {
    running = false;
    $('btn-run').disabled = false;
  }
}

// ---------- Vista previa web y modo Live ----------
let shownHtml = null; // qué archivo .html está mostrando el iframe ahora mismo
let liveTimer;

/** Construye la página (HTML + CSS + JS del proyecto) y la carga en el iframe. */
function renderWeb() {
  clearOutput();
  const kind = ext(current);
  const htmlFile = kind === 'html' ? current : pickHtmlFor(current, files);
  if (kind === 'js' && !(htmlFile && files[htmlFile].includes(current))) {
    shownHtml = null;
    preview.hidden = true; // JS suelto: solo consola
    preview.srcdoc = buildJsOnly(files[current], current);
  } else if (htmlFile) {
    shownHtml = htmlFile;
    preview.hidden = false;
    preview.srcdoc = buildHtml(files[htmlFile], files);
  } else {
    shownHtml = null;
    line('Crea un index.html que enlace este archivo para verlo.', 'warn');
  }
  setStatus(liveOn ? '● Live' : 'Listo');
}

/** Se llama al escribir: espera a que pares un momento y actualiza. */
function scheduleLive() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    // CSS: se inyecta sin recargar, así no pierdes el estado de la página.
    if (ext(current) === 'css' && shownHtml && files[shownHtml]?.includes(current) && !preview.hidden) {
      preview.contentWindow?.postMessage({ __codepadCss: true, file: current, css: files[current] }, '*');
    } else {
      renderWeb();
    }
  }, 600);
}

/** En móvil, con Live activo y un archivo web, muestra editor y vista previa a la vez. */
function applyLayout() {
  const split = liveOn && isWebFile(current);
  $('app').classList.toggle('live-split', split);
  $('btn-live').setAttribute('aria-pressed', String(liveOn));
  $('btn-live').hidden = !isWebFile(current);
}

function toggleLive() {
  liveOn = !liveOn;
  try { localStorage.setItem('codepad.live.v1', liveOn ? 'on' : 'off'); } catch { /* noop */ }
  applyLayout();
  if (liveOn && isWebFile(current)) renderWeb();
  else setStatus('Listo');
}

// ---------- Archivos ----------
function renderFileList() {
  const ul = $('file-list');
  ul.innerHTML = '';
  for (const name of Object.keys(files).sort()) {
    const li = document.createElement('li');
    li.className = name === current ? 'active' : '';
    const open = document.createElement('button');
    open.className = 'file-open';
    open.innerHTML = `<span class="badge">${LANGS[ext(name)]?.label ?? '?'}</span>`;
    open.append(name);
    open.onclick = () => { openFile(name); toggleDrawer(false); };
    const ren = document.createElement('button');
    ren.className = 'icon-btn'; ren.textContent = '✎'; ren.title = 'Renombrar';
    ren.onclick = () => renameFile(name);
    const del = document.createElement('button');
    del.className = 'icon-btn'; del.textContent = '🗑'; del.title = 'Borrar';
    del.onclick = () => deleteFile(name);
    li.append(open, ren, del);
    ul.appendChild(li);
  }
}

function validName(name) {
  return /^[\w.\- ]+\.(py|html|css|js|sql|txt|csv|json)$/i.test(name);
}

function newFile() {
  const name = prompt('Nombre del archivo (ej. utils.py, about.html):');
  if (!name) return;
  if (!validName(name)) return alert('Usa una extensión válida: .py .html .css .js .sql .txt .csv .json');
  if (name in files) return alert('Ya existe un archivo con ese nombre.');
  files[name] = '';
  saveFiles(files);
  openFile(name);
  toggleDrawer(false);
}

function renameFile(name) {
  const to = prompt('Nuevo nombre:', name);
  if (!to || to === name) return;
  if (!validName(to)) return alert('Nombre no válido.');
  if (to in files) return alert('Ya existe.');
  files[to] = files[name];
  delete files[name];
  states.delete(name);
  saveFiles(files);
  if (current === name) current = to;
  openFile(current, { keepPrevious: false });
}

function deleteFile(name) {
  if (Object.keys(files).length === 1) return alert('Debe quedar al menos un archivo.');
  if (!confirm(`¿Borrar ${name}?`)) return;
  delete files[name];
  states.delete(name);
  saveFiles(files);
  if (current === name) { current = Object.keys(files)[0]; openFile(current, { keepPrevious: false }); }
  else renderFileList();
}

function toggleDrawer(open) {
  $('drawer').classList.toggle('open', open);
  $('scrim').classList.toggle('open', open);
  $('drawer').setAttribute('aria-hidden', String(!open));
}

// ---------- Pestañas (móvil) ----------
function showView(v) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === v));
  $('editor-pane').classList.toggle('active', v === 'editor');
  $('output-pane').classList.toggle('active', v === 'output');
}

// ---------- Eventos ----------
$('btn-run').onclick = run;
$('btn-live').onclick = toggleLive;
$('btn-files').onclick = () => toggleDrawer(true);
$('btn-close-files').onclick = () => toggleDrawer(false);
$('scrim').onclick = () => toggleDrawer(false);
$('btn-new-file').onclick = newFile;
$('btn-restore').onclick = () => {
  if (!confirm('Esto sobrescribe los archivos de ejemplo con su versión original. ¿Continuar?')) return;
  files = restoreDefaults(files);
  saveFiles(files);
  states.clear();
  openFile(current in files ? current : 'main.py', { keepPrevious: false });
};
$('btn-clear').onclick = () => { clearOutput(); preview.hidden = true; setStatus('Listo'); };
$('btn-reset-db').onclick = async () => { await resetDb(); clearOutput(); line('Base de datos reiniciada.', 'info'); };
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => showView(t.dataset.view)));
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
});

openFile(current);

// Ejecuta SQL con SQLite (sql.js, WebAssembly). La BD se guarda en localStorage.
import initSqlJs from 'sql.js';

const DB_KEY = 'codepad.sqlite.v1';
let SQL = null;
let db = null;

async function getDb() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => new URL('vendor/sqljs/sql-wasm-browser.wasm', document.baseURI).href,
    });
  }
  if (!db) {
    let data = null;
    try {
      const b64 = localStorage.getItem(DB_KEY);
      if (b64) data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch { /* noop */ }
    db = data ? new SQL.Database(data) : new SQL.Database();
  }
  return db;
}

function persist() {
  try {
    const bytes = db.export();
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    localStorage.setItem(DB_KEY, btoa(bin));
  } catch { /* BD demasiado grande para localStorage */ }
}

export async function resetDb() {
  if (db) { db.close(); db = null; }
  try { localStorage.removeItem(DB_KEY); } catch { /* noop */ }
}

/** Devuelve una lista de resultados: {sql, columns, rows} o {sql, changes}. */
export async function runSql(code) {
  const database = await getDb();
  const results = [];
  try {
    for (const stmt of database.iterateStatements(code)) {
      const sql = stmt.getSQL().replace(/^\s*(--[^\n]*\n\s*)*/, '').trim();
      const columns = stmt.getColumnNames();
      if (columns.length) {
        const rows = [];
        while (stmt.step()) rows.push(stmt.get());
        results.push({ sql, columns, rows });
      } else {
        stmt.step();
        results.push({ sql, changes: database.getRowsModified() });
      }
      stmt.free();
    }
  } finally {
    persist();
  }
  return results;
}

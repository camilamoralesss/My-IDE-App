import { DEFAULT_FILES } from './templates.js';

const FILES_KEY = 'codepad.files.v1';
const CURRENT_KEY = 'codepad.current.v1';

export function loadFiles() {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) return parsed;
    }
  } catch { /* almacenamiento no disponible */ }
  return { ...DEFAULT_FILES };
}

export function saveFiles(files) {
  try { localStorage.setItem(FILES_KEY, JSON.stringify(files)); } catch { /* sin espacio */ }
}

export function loadCurrent(files) {
  try {
    const c = localStorage.getItem(CURRENT_KEY);
    if (c && c in files) return c;
  } catch { /* noop */ }
  return 'main.py' in files ? 'main.py' : Object.keys(files)[0];
}

export function saveCurrent(name) {
  try { localStorage.setItem(CURRENT_KEY, name); } catch { /* noop */ }
}

export function restoreDefaults(files) {
  return { ...files, ...DEFAULT_FILES };
}

// Ejecuta Python con Pyodide (CPython compilado a WebAssembly), incluido en la app.
const PYODIDE_VERSION = '314.0.8';
const PACKAGE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise = null;

function vendorUrl(path) {
  return new URL(`vendor/pyodide/${path}`, document.baseURI).href;
}

export function loadPython() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import(/* @vite-ignore */ vendorUrl('pyodide.mjs'));
      return loadPyodide({
        indexURL: vendorUrl(''),
        // El núcleo y la librería estándar van dentro de la app (sin internet).
        // Paquetes extra (numpy, pandas...) se descargan bajo demanda.
        packageBaseUrl: PACKAGE_CDN,
      });
    })();
    pyodidePromise.catch(() => { pyodidePromise = null; });
  }
  return pyodidePromise;
}

export async function runPython(code, { files, out, err, info, filename = 'main.py' }) {
  const py = await loadPython();

  py.setStdout({ batched: (s) => out(s) });
  py.setStderr({ batched: (s) => err(s) });
  py.setStdin({
    stdin: () => {
      const v = window.prompt('input()');
      return v === null ? null : v + '\n';
    },
    autoEOF: true,
  });

  // Copia todos los archivos del proyecto al sistema de archivos virtual
  // para que puedas hacer `import utils` o `open("datos.csv")`.
  const cwd = '/home/pyodide';
  for (const [name, content] of Object.entries(files)) {
    try { py.FS.writeFile(`${cwd}/${name}`, content); } catch { /* noop */ }
  }
  py.runPython(`
import os, sys, importlib
os.chdir(${JSON.stringify(cwd)})
if ${JSON.stringify(cwd)} not in sys.path:
    sys.path.insert(0, ${JSON.stringify(cwd)})
importlib.invalidate_caches()
for _m in [m for m, mod in list(sys.modules.items()) if getattr(mod, "__file__", "") and str(getattr(mod, "__file__", "")).startswith(${JSON.stringify(cwd + '/')})]:
    del sys.modules[_m]
`);

  try {
    await py.loadPackagesFromImports(code, { messageCallback: (m) => info(m), errorCallback: (m) => err(m) });
  } catch (e) {
    err(`No se pudieron instalar paquetes (¿sin internet?): ${e.message}\n`);
  }

  const globals = py.toPy({ __name__: '__main__', __file__: filename });
  try {
    await py.runPythonAsync(code, { globals, filename });
  } finally {
    globals.destroy();
  }
}

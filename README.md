# CodePad

Editor de código para **Android e iOS** que ejecuta **Python, HTML, CSS, JavaScript y SQL** directamente en el teléfono, sin servidor.

| Lenguaje | Cómo se ejecuta |
|---|---|
| Python | [Pyodide](https://pyodide.org) (CPython en WebAssembly), incluido en la app: funciona sin internet. `input()` abre un cuadro de diálogo. Paquetes extra como `numpy` se descargan la primera vez que los importas. |
| HTML / CSS / JS | Vista previa en un `iframe` aislado. Los `<link href="style.css">` y `<script src="script.js">` se cargan desde tus archivos. `console.log` aparece en la consola. Con **Live** activo la vista se actualiza mientras escribes (como Live Server de VS Code); el CSS se aplica sin recargar. |
| SQL | SQLite con [sql.js](https://sql.js.org). La base de datos se guarda entre ejecuciones. |

Stack: Vite + CodeMirror 6 + Capacitor 8.

## Desarrollo

```bash
npm install
npm run dev          # abre en el navegador (también desde el móvil en la misma red)
npm run build        # genera dist/
```

## Móvil

```bash
npm run android      # build + sync + abre Android Studio
npm run ios          # build + sync + abre Xcode (solo en macOS)
```

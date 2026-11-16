// Construye un documento HTML a partir de los archivos del proyecto (HTML + CSS + JS)
// y lo muestra en un iframe aislado, capturando console.log y errores.

const CONSOLE_BRIDGE = `<script>
(function(){
  function fmt(v){
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.name + ': ' + v.message;
    try { return JSON.stringify(v, null, 2); } catch(e) { return String(v); }
  }
  function send(level, args){
    parent.postMessage({ __codepad: true, level: level, text: Array.prototype.map.call(args, fmt).join(' ') }, '*');
  }
  ['log','info','warn','error','debug'].forEach(function(l){
    var orig = console[l];
    console[l] = function(){ send(l, arguments); orig && orig.apply(console, arguments); };
  });
  window.addEventListener('error', function(e){
    send('error', [(e.error && e.error.stack) || (e.message + ' (línea ' + e.lineno + ')')]);
  });
  window.addEventListener('unhandledrejection', function(e){ send('error', ['Promesa rechazada: ' + fmt(e.reason)]); });
})();
<\/script>`;

const escapeClose = (s, tag) => s.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);
const isLocal = (url) => url && !/^([a-z]+:)?\/\//i.test(url) && !url.startsWith('data:');
const clean = (url) => url.replace(/^\.\//, '').split(/[?#]/)[0];

export function buildHtml(html, files) {
  // <link rel="stylesheet" href="style.css"> → <style>…</style>
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    const href = (tag.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (isLocal(href) && clean(href) in files) {
      return `<style data-file="${clean(href)}">\n${escapeClose(files[clean(href)], 'style')}\n</style>`;
    }
    return tag;
  });
  // <script src="script.js"></script> → <script>…</script>
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
    if (isLocal(src) && clean(src) in files) {
      return `<script${a}${b}>\n${escapeClose(files[clean(src)], 'script')}\n//# sourceURL=${clean(src)}\n</script>`;
    }
    return tag;
  });
  // Inyecta el puente de consola lo antes posible.
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + CONSOLE_BRIDGE);
  return CONSOLE_BRIDGE + html;
}

export function buildJsOnly(code, filename) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${CONSOLE_BRIDGE}</head><body>
<script>\n${escapeClose(code, 'script')}\n//# sourceURL=${filename}\n</script></body></html>`;
}

/** Elige qué HTML mostrar para un archivo .css o .js. */
export function pickHtmlFor(filename, files) {
  const htmls = Object.keys(files).filter((f) => f.endsWith('.html'));
  const linking = htmls.find((h) => files[h].includes(filename));
  return linking || (htmls.includes('index.html') ? 'index.html' : htmls[0]);
}

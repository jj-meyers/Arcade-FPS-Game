import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// An optional, self-contained browser artifact for playing without a web server.
// Keep the standard split-chunk production build for normal website hosting.
const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  root,
  configFile: false,
  base: './',
  build: {
    write: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const output = Array.isArray(result) ? result.flatMap(item => item.output) : result.output;
let html = String(output.find(item => item.fileName === 'index.html')?.source || '');
if (!html) throw new Error('Vite did not produce an HTML entry.');
const scripts = output.filter(item => item.type === 'chunk');
const styles = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css'));
if (scripts.length !== 1) throw new Error(`Expected one standalone script, received ${scripts.length}.`);

// The bundled script has no imports. A classic inline script also avoids
// file-origin module loading restrictions in browsers opening a downloaded file.
html = html.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/g,
  () => `<script defer data-unfug-standalone>${scripts[0].code.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g, '');
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>/g, '');
const css = styles.map(item => String(item.source)).join('\n').replace(/<\/style/gi, '<\\/style');
html = html.replace('</head>', () => `<style>${css}</style>\n</head>`);
// Inline scripts ignore defer, so execute after the canvas and menu roots exist.
const inline = html.match(/<script defer data-unfug-standalone>[\s\S]*?<\/script>/)?.[0];
if (!inline) throw new Error('Standalone script replacement failed.');
html = html.replace(inline, '').replace('</body>', () => `${inline.replace(' defer', '')}\n</body>`);
if (/<(?:script|link)\b[^>]*(?:src|href)="\.?\/?assets\//.test(html)) throw new Error('Unbundled asset reference remains.');
await mkdir(join(root, 'dist'), { recursive: true });
const destination = join(root, 'dist', 'unfug.html');
await writeFile(destination, html);
console.log(`Standalone game: ${destination} (${Math.round(Buffer.byteLength(html) / 1024)} KiB). Open this file in a desktop browser.`);

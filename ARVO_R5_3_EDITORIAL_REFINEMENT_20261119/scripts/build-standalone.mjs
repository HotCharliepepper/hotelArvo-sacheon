#!/usr/bin/env node
/* Build one offline HTML file from the current dist/. Requires Node 18+, no packages. */
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutput = resolve(projectRoot, '../deliverables/ARVO_R5_3_EDITORIAL_PREVIEW_20261119.html');
const args = process.argv.slice(2);
let output = defaultOutput;
let hasOutput = false;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--help' || arg === '-h') {
    console.log('Usage: node scripts/build-standalone.mjs [output.html]\n       node scripts/build-standalone.mjs --output /absolute/path/output.html\nDefault: ../deliverables/ARVO_R5_3_EDITORIAL_PREVIEW_20261119.html');
    process.exit(0);
  }
  if (arg === '--output') {
    if (!args[index + 1] || hasOutput) throw new Error('Provide one output path.');
    output = resolve(args[++index]);
    hasOutput = true;
  } else if (!arg.startsWith('-') && !hasOutput) {
    output = resolve(arg);
    hasOutput = true;
  } else throw new Error(`Unknown or duplicate argument: ${arg}`);
}

const dist = await realpath(resolve(projectRoot, 'dist'));
const sourceFile = resolve(dist, 'index.html');
if (output === sourceFile) throw new Error('Output must not overwrite dist/index.html.');
if (extname(output).toLowerCase() !== '.html') throw new Error('The output filename must end with .html.');
const mimeTypes = {
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav'
};
const assets = new Map();
const textSources = new Map();
const isEmbedded = value => /^(data:|#)/i.test(value);
const isExternal = value => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);
const escaped = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const decodeAttribute = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function localFile(url, contextFile) {
  if (isExternal(url)) throw new Error(`External asset cannot be bundled: ${url}`);
  const clean = decodeAttribute(url).split(/[?#]/, 1)[0];
  if (!clean || clean.includes('\0') || clean.includes('\\')) throw new Error(`Invalid asset path: ${url}`);
  const candidate = resolve(clean.startsWith('/') ? dist : dirname(contextFile), decodeURIComponent(clean.replace(/^\//, '')));
  const file = await realpath(candidate);
  const remainder = relative(dist, file);
  if (remainder === '..' || remainder.startsWith(`..${sep}`) || isAbsolute(remainder)) throw new Error(`Asset is outside dist/: ${url}`);
  return file;
}

async function resource(url, contextFile) {
  const file = await localFile(url, contextFile);
  if (!assets.has(file)) {
    const mime = mimeTypes[extname(file).toLowerCase()];
    if (!mime) throw new Error(`Unsupported binary asset: ${relative(dist, file)}`);
    const bytes = await readFile(file);
    assets.set(file, {
      id: `r${assets.size}`, file, bytes: bytes.length,
      dataUrl: `data:${mime};base64,${bytes.toString('base64')}`,
      domAttribute: null, dynamic: false
    });
  }
  return assets.get(file);
}

async function readText(url, contextFile) {
  const file = await localFile(url, contextFile);
  if (!textSources.has(file)) textSources.set(file, await readFile(file, 'utf8'));
  return { file, text: textSources.get(file) };
}

async function replaceAsync(value, regex, replacement) {
  let result = '';
  let lastIndex = 0;
  for (const match of value.matchAll(regex)) {
    result += value.slice(lastIndex, match.index) + await replacement(match);
    lastIndex = match.index + match[0].length;
  }
  return result + value.slice(lastIndex);
}

async function bundleCSS(text, contextFile) {
  if (/@import\s/i.test(text)) throw new Error('Inline CSS @import before building a standalone file.');
  return replaceAsync(text, /url\(\s*(["']?)([^)"']+)\1\s*\)/gi, async match => {
    const url = match[2].trim();
    if (isEmbedded(url)) return match[0];
    const asset = await resource(url, contextFile);
    const fragment = url.includes('#') ? url.slice(url.indexOf('#')) : '';
    return `url("${asset.dataUrl}${fragment}")`;
  });
}

let html = await readFile(sourceFile, 'utf8');
const scripts = [];

// Deferred external scripts move to the end of the document in their original order.
html = await replaceAsync(html, /<script\b([^>]*\bsrc\s*=\s*(["'])(.*?)\2[^>]*)>\s*<\/script\s*>/gi, async match => {
  if (/\btype\s*=\s*["']module["']/i.test(match[1])) throw new Error('Module scripts require a separate bundler.');
  const source = await readText(match[3], sourceFile);
  const transformed = await replaceAsync(source.text, /(["'`])((?:\.\/)?assets\/[^"'`\r\n]+)\1/g, async assetMatch => {
    if (assetMatch[2].includes('${')) throw new Error('Dynamic template asset paths must be resolved before bundling.');
    const asset = await resource(assetMatch[2], source.file);
    asset.dynamic = true;
    const fragment = assetMatch[2].includes('#') ? assetMatch[2].slice(assetMatch[2].indexOf('#')) : '';
    return `window.ARVO_ASSETS.${asset.id}${fragment ? ` + ${JSON.stringify(fragment)}` : ''}`;
  });
  scripts.push(`/* ${relative(dist, source.file).replace(/\*\//g, '')} */\n${transformed}`);
  return '';
});

// A preload would repeat the embedded image/font bytes without saving a request.
html = html.replace(/<link\b(?=[^>]*\brel\s*=\s*["']preload["'])[^>]*>\s*/gi, '');
html = await replaceAsync(html, /<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])[^>]*>/gi, async match => {
  const href = match[0].match(/\bhref\s*=\s*(["'])(.*?)\1/i);
  if (!href) throw new Error('Stylesheet has no href.');
  // Hosted variable fonts stay external; the offline fallbacks remain complete.
  if (isExternal(href[2])) return match[0];
  const source = await readText(href[2], sourceFile);
  const css = await bundleCSS(source.text, source.file);
  return `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
});
html = await replaceAsync(html, /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, async match => {
  return `${match[1]}${await bundleCSS(match[2], sourceFile)}${match[3]}`;
});
html = await replaceAsync(html, /\bstyle\s*=\s*(["'])(.*?)\1/gi, async match => {
  if (!/url\(/i.test(match[2])) return match[0];
  return `style="${escaped(await bundleCSS(decodeAttribute(match[2]), sourceFile))}"`;
});

// Embed every current HTML resource while leaving external navigation links intact.
html = await replaceAsync(html, /<(img|source|video|audio|input|link)\b[^>]*>/gi, async match => {
  let tag = match[0];
  let resourceId = null;
  tag = await replaceAsync(tag, /\b(src|poster|href)\s*=\s*(["'])(.*?)\2/gi, async attr => {
    const url = decodeAttribute(attr[3]);
    if (!url || isEmbedded(url) || isExternal(url)) return attr[0];
    const asset = await resource(url, sourceFile);
    const fragment = url.includes('#') ? url.slice(url.indexOf('#')) : '';
    if (!asset.domAttribute && !resourceId) {
      resourceId = asset.id;
      asset.domAttribute = attr[1].toLowerCase();
    }
    return `${attr[1]}="${escaped(asset.dataUrl + fragment)}"`;
  });
  tag = await replaceAsync(tag, /\b(srcset|imagesrcset)\s*=\s*(["'])(.*?)\2/gi, async attr => {
    if (/\bdata:/i.test(attr[3])) return attr[0];
    const entries = attr[3].split(',').map(entry => entry.trim()).filter(Boolean);
    const embedded = [];
    for (const entry of entries) {
      const [url, ...descriptor] = entry.split(/\s+/);
      const asset = await resource(decodeAttribute(url), sourceFile);
      embedded.push(`${asset.dataUrl}${descriptor.length ? ` ${descriptor.join(' ')}` : ''}`);
    }
    return `${attr[1]}="${escaped(embedded.join(', '))}"`;
  });
  if (resourceId) tag = tag.replace(/\s*\/?\s*>$/, ` data-arvo-resource="${resourceId}">`);
  return tag;
});

// Reuse HTML image data in dynamic galleries; embed dynamic-only photos once.
const dynamicAssets = [...assets.values()].filter(asset => asset.dynamic);
const mapEntries = dynamicAssets.map(asset => `${JSON.stringify(asset.id)}:${asset.domAttribute
  ? `document.querySelector('[data-arvo-resource="${asset.id}"]').getAttribute(${JSON.stringify(asset.domAttribute)})`
  : JSON.stringify(asset.dataUrl)}`);
const bundle = `window.ARVO_ASSETS = {${mapEntries.join(',')}};\n${scripts.join('\n\n')}`.replace(/<\/script/gi, '<\\/script');
if (!/<\/body\s*>/i.test(html)) throw new Error('index.html needs a closing body tag.');
html = html.replace(/<\/body\s*>/i, () => `<script>\n${bundle}\n</script>\n</body>`);
html = html.replace(/<!doctype html>/i, '<!doctype html>\n<!-- ARVO R5.3 editorial refinement study. Images and app scripts are embedded. Optional web fonts and map iframe require internet. -->');

// Fail closed if a local resource reference was missed. Navigation URLs are allowed.
const unresolved = [...html.matchAll(/\b(?:src|poster|srcset|imagesrcset)\s*=\s*(["'])(.*?)\1/gi)]
  .filter(match => match[2] && !/^(?:data:|#|https:\/\/maps\.google\.com\/maps\?)/i.test(match[2]));
if (unresolved.length) throw new Error(`Unbundled resource: ${unresolved[0][2].slice(0,180)}`);
if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
  throw new Error('External script remains in the standalone HTML.');
}
const unexpectedStylesheets = [...html.matchAll(/<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])[^>]*>/gi)]
  .filter(match => !/href=["']https:\/\/fonts\.googleapis\.com\//i.test(match[0]));
if (unexpectedStylesheets.length) throw new Error('Unexpected stylesheet remains in the standalone HTML.');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html, 'utf8');
console.log(JSON.stringify({
  output,
  bytes: Buffer.byteLength(html),
  uniqueEmbeddedAssets: assets.size,
  uniqueAssetBytes: [...assets.values()].reduce((total, asset) => total + asset.bytes, 0),
  scripts: scripts.length,
  dynamicImagesUsingMap: dynamicAssets.length
}, null, 2));

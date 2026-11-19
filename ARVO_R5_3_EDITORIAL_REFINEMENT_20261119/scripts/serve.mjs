#!/usr/bin/env node
/* Dependency-free local preview. This command never publishes the site. */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = await realpath(resolve(projectRoot, 'dist'));
const args = process.argv.slice(2);
let portValue = process.env.PORT || '5304';

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--help' || arg === '-h') {
    console.log('Usage: node scripts/serve.mjs [--port 5304]\nEnvironment: PORT=5304\nServes dist/ at http://127.0.0.1:5304. Stop with Ctrl+C.');
    process.exit(0);
  }
  if (arg === '--port') {
    if (!args[index + 1]) throw new Error('--port requires a number.');
    portValue = args[++index];
  } else if (arg.startsWith('--port=')) portValue = arg.slice(7);
  else throw new Error(`Unknown argument: ${arg}`);
}

const port = Number(portValue);
if (!/^\d+$/.test(String(portValue)) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT / --port must be an integer between 1 and 65535.');
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf'
};
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
};
const isWithinRoot = (path) => {
  const remainder = relative(root, path);
  return remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
};
const reply = (res, status, message, extra = {}) => {
  res.writeHead(status, { ...headers, 'Content-Type': 'text/plain; charset=utf-8', ...extra });
  res.end(message);
};

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    reply(res, 405, 'Method not allowed.', { Allow: 'GET, HEAD' });
    return;
  }
  try {
    // Inspect the raw path before URL normalization can erase traversal segments.
    const rawPath = (req.url || '/').split(/[?#]/, 1)[0];
    let pathname;
    try { pathname = decodeURIComponent(rawPath); }
    catch { reply(res, 400, 'Invalid path encoding.'); return; }
    if (!pathname.startsWith('/') || pathname.includes('\0') || pathname.includes('\\') ||
        pathname.split('/').some(segment => segment === '..' || (segment.startsWith('.') && segment !== '.'))) {
      reply(res, 403, 'This path is not available.');
      return;
    }
    let file = resolve(root, `.${pathname}`);
    if (!isWithinRoot(file)) { reply(res, 403, 'This path is not available.'); return; }
    let info = await stat(file);
    if (info.isDirectory()) {
      file = resolve(file, 'index.html');
      info = await stat(file);
    }
    file = await realpath(file);
    if (!isWithinRoot(file) || !info.isFile()) { reply(res, 403, 'This path is not available.'); return; }
    res.writeHead(200, {
      ...headers,
      'Content-Type': mimeTypes[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Last-Modified': info.mtime.toUTCString()
    });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch (error) {
    if (res.headersSent) { res.destroy(); return; }
    const missing = ['ENOENT', 'ENOTDIR'].includes(error.code);
    reply(res, missing ? 404 : 500, missing ? 'File not found.' : 'Unable to read this file.');
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Try: node scripts/serve.mjs --port ${port === 65535 ? 5305 : port + 1}`
    : `Local preview failed: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`ARVO R5 local preview: http://127.0.0.1:${port}\nStop with Ctrl+C.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

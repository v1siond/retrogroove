// Minimal static server for the Next.js static export (`out/`), with clean-URL
// → .html mapping. Used by the visual e2e config so the demo runs against the
// real production build (no dev compiler), making it fast and reliable.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('out');
const port = Number(process.env.PORT || 3334);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

function resolveFile(p) {
  const f = path.join(root, p);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  if (fs.existsSync(f + '.html')) return f + '.html';
  if (fs.existsSync(path.join(f, 'index.html'))) return path.join(f, 'index.html');
  return null;
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    let file = resolveFile(pathname);
    if (!file) {
      file = path.join(root, '404.html');
      res.statusCode = 404;
    }
    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`static export served on http://localhost:${port}`));

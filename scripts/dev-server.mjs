import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

async function resolveFile(pathname) {
  const safePath = normalize(join(ROOT, decodeURIComponent(pathname)));
  if (!safePath.startsWith(ROOT)) return null;
  const candidate = pathname.endsWith('/') ? join(safePath, 'index.html') : safePath;
  try {
    const info = await stat(candidate);
    return info.isDirectory() ? join(candidate, 'index.html') : candidate;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const filePath = (await resolveFile(url.pathname)) ?? join(ROOT, 'index.html');
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Cashalot dev server running at http://localhost:${PORT}`);
});

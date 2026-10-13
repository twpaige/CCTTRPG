// Development-only static server. No dependencies, writes, or application backend.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, extname, isAbsolute } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/plain' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/poc/speech.html' : pathname));
    const rel = relative(root, file);
    if (rel.startsWith('..') || isAbsolute(rel) || !types[extname(file)]) {
      response.writeHead(403).end('Forbidden'); return;
    }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] + '; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(404).end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(8765, '127.0.0.1', () => console.log('SR proof: http://127.0.0.1:8765/poc/speech.html\nTests: http://127.0.0.1:8765/tests/runner.html\nPress Ctrl+C to stop.'));

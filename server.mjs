import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const snapshot = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'events-snapshot.json'), 'utf8'));
const byId = new Map(snapshot.events.map(e => [String(e.id), e]));
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'
};

function json(res, code, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(code, {'content-type':'application/json; charset=utf-8','content-length':body.length,'cache-control':'no-store'});
  res.end(body);
}
function sendFile(res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const body = fs.readFileSync(file);
  res.writeHead(200, {'content-type':MIME[ext]||'application/octet-stream','content-length':body.length,'cache-control':'no-store'});
  res.end(body); return true;
}
function safePublicPath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const p = path.normalize(path.join(PUBLIC, clean || 'index.html'));
  return p.startsWith(PUBLIC) ? p : null;
}

const server = http.createServer((req,res) => {
  const u = new URL(req.url, `http://${req.headers.host||'localhost'}`);
  if (u.pathname === '/api/live') {
    return json(res, 200, {generatedAt:snapshot.generatedAt,events:snapshot.events,stats:snapshot.stats});
  }
  if (u.pathname === '/api/events') {
    return json(res, 200, {generatedAt:snapshot.generatedAt,events:snapshot.events,stats:snapshot.stats});
  }
  if (u.pathname === '/api/event-photos') {
    const e = byId.get(String(u.searchParams.get('id')||''));
    const imgs = [...new Set([...(e?.images||[]), e?.image||''].filter(Boolean))];
    return json(res, 200, {photos:imgs.map(x=>({url:x,src:x}))});
  }
  if (u.pathname === '/api/picture') {
    // Offline-safe fallback captured from production. Direct remote event images still load when browser network allows.
    if (sendFile(res, path.join(PUBLIC,'api','picture'))) return;
    return res.writeHead(404).end();
  }
  const p=safePublicPath(u.pathname);
  if (p && sendFile(res,p)) return;
  // SPA fallback for local navigation.
  sendFile(res,path.join(PUBLIC,'index.html')) || res.writeHead(404).end('Not found');
});
server.listen(PORT, '127.0.0.1', () => console.log(`SORTIR.BE recovered server: http://127.0.0.1:${PORT}`));

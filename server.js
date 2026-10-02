import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);
const PORT = process.env.PORT || 5173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Normalize request URL and strip leading slashes for Windows safety
  let reqPath = req.url.split('?')[0].replace(/^\/+/, '');
  if (reqPath === '' || reqPath === 'viewer' || reqPath === 'viewer/') {
    reqPath = 'viewer/viewer.html';
  }

  // Prevent path traversal
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If requested file doesn't exist directly, try resolving inside viewer/
      const fallbackPath = path.join(ROOT_DIR, 'viewer', safePath);
      fs.stat(fallbackPath, (fallbackErr, fallbackStats) => {
        if (!fallbackErr && fallbackStats.isFile()) {
          serveFile(fallbackPath, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found - Gemini Live Screen for Windows');
        }
      });
      return;
    }

    serveFile(filePath, res);
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error');
      return;
    }

    // CORS & modern security headers for local access
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(data);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[Notice] Port ${PORT} is already running.`);
    console.log(`Local URL is active: http://localhost:${PORT}/viewer/viewer.html\n`);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`  Gemini Live Screen for Windows (Local Web Server)`);
  console.log(`  Local URL: http://localhost:${PORT}/viewer/viewer.html`);
  console.log(`  Ready for Chrome & Gemini Live Tab Sharing!`);
  console.log(`======================================================\n`);
});

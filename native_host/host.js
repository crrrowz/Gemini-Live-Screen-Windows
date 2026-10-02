import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');
const PORT = 5173;

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

// 1. Start HTTP Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0].replace(/^\/+/, '');
  if (reqPath === '' || reqPath === 'viewer' || reqPath === 'viewer/') {
    reqPath = 'viewer/viewer.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackPath = path.join(ROOT_DIR, 'viewer', safePath);
      fs.stat(fallbackPath, (fallbackErr, fallbackStats) => {
        if (!fallbackErr && fallbackStats.isFile()) {
          serveFile(fallbackPath, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found - Gemini Live Screen');
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
  // If port is already in use, that's fine
});

server.listen(PORT, '127.0.0.1', () => {
  sendNativeMessage({ status: 'ready', port: PORT, url: `http://localhost:${PORT}/viewer/viewer.html` });
});

// 2. Native Messaging Protocol over STDIN / STDOUT
function sendNativeMessage(msg) {
  try {
    const buffer = Buffer.from(JSON.stringify(msg));
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buffer.length, 0);
    process.stdout.write(header);
    process.stdout.write(buffer);
  } catch {
    // Ignore stdio write errors
  }
}

// When Chrome closes the port, stdin receives 'end' / 'close' -> terminate server immediately!
process.stdin.on('end', () => {
  server.close(() => {
    process.exit(0);
  });
});

process.stdin.on('close', () => {
  process.exit(0);
});

// Handle incoming messages from extension
process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    // Keep-alive heartbeat read
  }
});

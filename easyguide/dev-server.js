'use strict';

/* Zero-dependency local server: serves the app and runs api/chat.js.
   Usage:  node dev-server.js     (reads ANTHROPIC_API_KEY from .env or the environment) */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Minimal .env loader
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env file, fine */ }

const handler = require('./api/chat.js');
const PORT = process.env.PORT || 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};
const PUBLIC = new Set(['/index.html', '/sw.js', '/manifest.json', '/icon-192.png', '/icon-512.png']);

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/chat') {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 6e6) req.destroy(); });
    req.on('end', () => {
      try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = null; }
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
      Promise.resolve(handler(req, res)).catch((e) => { console.error(e); res.status(500).json({ error: 'Server error' }); });
    });
    return;
  }

  const p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!PUBLIC.has(p)) { res.statusCode = 404; return res.end('Not found'); }
  fs.readFile(path.join(__dirname, p), (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('EasyGuide running at http://localhost:' + PORT);
  const openai = String(process.env.LLM_PROVIDER || '').toLowerCase() === 'openai';
  const ready = openai ? (process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL) : process.env.ANTHROPIC_API_KEY;
  if (!ready) console.log('Note: no API key configured (see .env.example). Quick help works, AI answers will not.');
});

/**
 * SwiftSite Publish Server
 * Serves the built editor on port 3001 and provides:
 *   POST /api/publish  — saves site HTML to shared folder, returns { id }
 *   GET  /site/:id     — serves a published site by ID
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3001;
const PUBLISHED_DIR = '/home/team/shared/published-sites';
const DIST_DIR = path.join(__dirname, '..', 'dist');

// Ensure published dir exists
if (!fs.existsSync(PUBLISHED_DIR)) {
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // POST /api/publish — save site HTML
  if (req.method === 'POST' && pathname === '/api/publish') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { html } = JSON.parse(body);
        if (!html) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing html field' }));
          return;
        }

        const id = crypto.randomUUID();
        const filePath = path.join(PUBLISHED_DIR, `${id}.html`);
        fs.writeFileSync(filePath, html, 'utf-8');

        console.log(`Published site ${id} (${html.length} bytes)`);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id, url: `/site/${id}` }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // GET /site/:id — serve a published site
  const siteMatch = pathname.match(/^\/site\/([a-f0-9-]+)$/);
  if (siteMatch && req.method === 'GET') {
    const id = siteMatch[1];
    const filePath = path.join(PUBLISHED_DIR, `${id}.html`);
    serveStatic(res, filePath);
    return;
  }

  // GET /api/sites — list published sites
  if (pathname === '/api/sites' && req.method === 'GET') {
    try {
      const files = fs.readdirSync(PUBLISHED_DIR)
        .filter(f => f.endsWith('.html'))
        .map(f => ({
          id: f.replace('.html', ''),
          url: `/site/${f.replace('.html', '')}`,
          size: fs.statSync(path.join(PUBLISHED_DIR, f)).size,
          created: fs.statSync(path.join(PUBLISHED_DIR, f)).birthtime,
        }))
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to list sites' }));
    }
    return;
  }

  // Serve static files from dist/
  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  // If file doesn't exist, serve index.html (for SPA routing)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  serveStatic(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SwiftSite server running on http://0.0.0.0:${PORT}`);
  console.log(`Published sites stored in ${PUBLISHED_DIR}`);
});
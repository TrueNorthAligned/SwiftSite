/**
 * SwiftSite Publish Server with Authentication
 * Serves the built editor on port 3001 and provides:
 *   POST /api/auth/signup  — create account (email + password)
 *   POST /api/auth/login   — authenticate, returns JWT
 *   POST /api/publish      — save site HTML (auth required)
 *   GET  /site/:id         — serve a published site
 *   GET  /api/sites        — list user's published sites (auth required)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// JWT & bcrypt — require from node_modules (installed as dependencies)
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const PORT = 3001;
const JWT_SECRET = 'swiftsite-dev-jwt-secret-change-in-production';
const PUBLISHED_DIR = '/home/team/shared/published-sites';
const USERS_DIR = path.join(__dirname, '..', '..', 'shared', 'users');
const DIST_DIR = path.join(__dirname, '..', 'dist');

// Ensure directories exist
[PUBLISHED_DIR, USERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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

// --- User persistence (simple file-based) ---
function getUserDb() {
  const dbPath = path.join(USERS_DIR, 'users.json');
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({}), 'utf-8');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveUserDb(db) {
  const dbPath = path.join(USERS_DIR, 'users.json');
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

// --- JSON body parser ---
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

// --- Auth middleware ---
function authenticate(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {
    // ---- AUTH ENDPOINTS ----

    // POST /api/auth/signup
    if (req.method === 'POST' && pathname === '/api/auth/signup') {
      const { email, password } = await parseBody(req);
      if (!email || !password) {
        return sendJson(res, 400, { error: 'Email and password required' });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: 'Password must be at least 6 characters' });
      }

      const db = getUserDb();
      const normalizedEmail = email.toLowerCase().trim();
      if (db[normalizedEmail]) {
        return sendJson(res, 409, { error: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();
      db[normalizedEmail] = { userId, email: normalizedEmail, password: hashedPassword };
      saveUserDb(db);

      const token = jwt.sign({ userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' });
      console.log(`User signed up: ${normalizedEmail}`);
      return sendJson(res, 201, { token, user: { userId, email: normalizedEmail } });
    }

    // POST /api/auth/login
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const { email, password } = await parseBody(req);
      if (!email || !password) {
        return sendJson(res, 400, { error: 'Email and password required' });
      }

      const db = getUserDb();
      const normalizedEmail = email.toLowerCase().trim();
      const user = db[normalizedEmail];
      if (!user) {
        return sendJson(res, 401, { error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return sendJson(res, 401, { error: 'Invalid email or password' });
      }

      const token = jwt.sign({ userId: user.userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' });
      console.log(`User logged in: ${normalizedEmail}`);
      return sendJson(res, 200, { token, user: { userId: user.userId, email: normalizedEmail } });
    }

    // GET /api/auth/me — verify token and return user info
    if (req.method === 'GET' && pathname === '/api/auth/me') {
      const payload = authenticate(req);
      if (!payload) return sendJson(res, 401, { error: 'Not authenticated' });
      return sendJson(res, 200, { user: { userId: payload.userId, email: payload.email } });
    }

    // ---- PUBLISH ENDPOINTS (auth required) ----

    // POST /api/publish — save site HTML
    if (req.method === 'POST' && pathname === '/api/publish') {
      const payload = authenticate(req);
      if (!payload) return sendJson(res, 401, { error: 'Authentication required' });

      const { html, name } = await parseBody(req);
      if (!html) return sendJson(res, 400, { error: 'Missing html field' });

      const siteId = crypto.randomUUID();
      const fileName = `${payload.userId}--${siteId}.html`;
      const filePath = path.join(PUBLISHED_DIR, fileName);

      // Store metadata alongside the HTML
      const siteData = JSON.stringify({
        id: siteId,
        userId: payload.userId,
        name: name || 'Untitled Site',
        createdAt: new Date().toISOString(),
        html
      });

      fs.writeFileSync(filePath, siteData, 'utf-8');
      console.log(`Published site ${siteId} by user ${payload.userId}`);

      return sendJson(res, 201, { id: siteId, url: `/site/${siteId}` });
    }

    // PUT /api/publish/:id — update an existing site
    const putMatch = pathname.match(/^\/api\/publish\/([a-f0-9-]+)$/);
    if (req.method === 'PUT' && putMatch) {
      const payload = authenticate(req);
      if (!payload) return sendJson(res, 401, { error: 'Authentication required' });

      const siteId = putMatch[1];
      const { html, name } = await parseBody(req);
      if (!html) return sendJson(res, 400, { error: 'Missing html field' });

      // Find existing file
      const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.html'));
      const existingFile = files.find(f => f.includes(siteId));
      if (!existingFile) return sendJson(res, 404, { error: 'Site not found' });

      // Verify ownership
      if (!existingFile.startsWith(payload.userId)) {
        return sendJson(res, 403, { error: 'Not your site' });
      }

      const filePath = path.join(PUBLISHED_DIR, existingFile);
      let existingData = {};
      try {
        existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {}

      const siteData = JSON.stringify({
        id: siteId,
        userId: payload.userId,
        name: name || existingData.name || 'Untitled Site',
        createdAt: existingData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        html
      });

      fs.writeFileSync(filePath, siteData, 'utf-8');
      return sendJson(res, 200, { id: siteId, url: `/site/${siteId}` });
    }

    // GET /site/:id — serve a published site
    const siteMatch = pathname.match(/^\/site\/([a-f0-9-]+)$/);
    if (siteMatch && req.method === 'GET') {
      const siteId = siteMatch[1];
      const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.html'));
      const found = files.find(f => f.includes(siteId));
      if (!found) return sendJson(res, 404, { error: 'Site not found' });

      const filePath = path.join(PUBLISHED_DIR, found);
      const content = fs.readFileSync(filePath, 'utf-8');
      try {
        const parsed = JSON.parse(content);
        // Serve the HTML content embedded in the JSON
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(parsed.html);
      } catch {
        // Fallback: serve raw file content (legacy support)
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      }
      return;
    }

    // GET /api/sites — list user's published sites (auth required)
    if (pathname === '/api/sites' && req.method === 'GET') {
      const payload = authenticate(req);
      if (!payload) return sendJson(res, 401, { error: 'Authentication required' });

      try {
        const files = fs.readdirSync(PUBLISHED_DIR)
          .filter(f => f.endsWith('.html') && f.startsWith(payload.userId))
          .map(f => {
            const filePath = path.join(PUBLISHED_DIR, f);
            let name = 'Untitled Site';
            let createdAt = fs.statSync(filePath).birthtime;
            try {
              const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
              name = parsed.name || name;
              createdAt = parsed.createdAt || createdAt;
            } catch {}
            return {
              id: f.split('--')[1].replace('.html', ''),
              name,
              url: `/site/${f.split('--')[1].replace('.html', '')}`,
              size: fs.statSync(filePath).size,
              createdAt,
            };
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return sendJson(res, 200, files);
      } catch (e) {
        return sendJson(res, 500, { error: 'Failed to list sites' });
      }
    }

    // ---- STATIC FILES ----

    // Serve static files from dist/
    let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }
    serveStatic(res, filePath);

  } catch (e) {
    console.error('Server error:', e);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SwiftSite server running on http://0.0.0.0:${PORT}`);
  console.log(`Published sites stored in ${PUBLISHED_DIR}`);
});
/**
 * SwiftSite Production Server
 * Unified server serving: marketing landing page, editor SPA, and API
 * Run: node server/production-server.cjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const PORT = 3000; // Single production port
const JWT_SECRET = process.env.JWT_SECRET || 'swiftsite-prod-jwt-secret';
const PUBLISHED_DIR = '/home/team/shared/published-sites';
const USERS_DIR = path.join(__dirname, '..', '..', 'shared', 'users');
const SUBSCRIPTIONS_DIR = path.join(__dirname, '..', '..', 'shared', 'subscriptions');
const DIST_DIR = path.join(__dirname, '..', 'dist');           // Editor built with --base=/editor/
const MARKETING_FILE = path.join(__dirname, '..', 'marketing-index.html');
const BRAND_DIR = '/home/team/shared/swiftsite-brand';       // Brand assets (images, sitemap, robots)
const PUBLIC_DIR = path.join(__dirname, '..', 'public');     // Public assets (logo SVG)

// Ensure directories exist
[PUBLISHED_DIR, USERS_DIR, SUBSCRIPTIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Pricing tiers with Stripe payment links
const TIERS = {
  starter: { id: 'starter', name: 'Starter', price: 1900, priceLabel: '$19/mo', maxPages: 5, features: ['custom domain', 'analytics'], paymentLink: 'https://buy.stripe.com/3cIeVdcXq3y2ea8dzOdEs0z' },
  business: { id: 'business', name: 'Business', price: 4900, priceLabel: '$49/mo', maxPages: 20, features: ['custom domain', 'analytics', 'SEO tools'], paymentLink: 'https://buy.stripe.com/aFa28rbTm4C62rq8fudEs0A' },
  pro: { id: 'pro', name: 'Pro', price: 9900, priceLabel: '$99/mo', maxPages: 100, features: ['custom domain', 'analytics', 'SEO tools', 'e-commerce', 'booking'], paymentLink: 'https://buy.stripe.com/9B6aEXcXqfgKd642VadEs0B' },
};

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.json': 'application/json', '.woff2': 'font/woff2',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// --- Subscription store ---
function getSubDb() {
  const dbPath = path.join(SUBSCRIPTIONS_DIR, 'subscriptions.json');
  if (!fs.existsSync(dbPath)) { fs.writeFileSync(dbPath, JSON.stringify({}), 'utf-8'); return {}; }
  try { return JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch { return {}; }
}
function saveSubDb(db) {
  const dbPath = path.join(SUBSCRIPTIONS_DIR, 'subscriptions.json');
  if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}
function defaultSubscription() { return { tier: 'free', status: 'active', maxPages: 3, features: [], updatedAt: new Date().toISOString() }; }
function getUserSubscription(userId) { const db = getSubDb(); return db[userId] || defaultSubscription(); }
function setUserSubscription(userId, subData) { const db = getSubDb(); db[userId] = { ...subData, updatedAt: new Date().toISOString() }; saveSubDb(db); }
async function activateSubscription(userId, tierId, session) { const tier = TIERS[tierId]; if (userId && tier) { setUserSubscription(userId, { tier: tier.id, status: 'active', maxPages: tier.maxPages, features: tier.features, stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription }); console.log(`Sub activated: user=${userId}, tier=${tierId}`); } }

function getUserDb() {
  const dbPath = path.join(USERS_DIR, 'users.json');
  if (!fs.existsSync(dbPath)) { fs.writeFileSync(dbPath, JSON.stringify({}), 'utf-8'); return {}; }
  try { return JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch { return {}; }
}
function saveUserDb(db) { fs.writeFileSync(path.join(USERS_DIR, 'users.json'), JSON.stringify(db, null, 2), 'utf-8'); }

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
  });
}
function authenticate(req) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET); } catch { return null; }
}
function sendJson(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {
    // === API ROUTES ===

    // Auth
    if (req.method === 'POST' && pathname === '/api/auth/signup') {
      const { email, password } = await parseBody(req);
      if (!email || !password) return sendJson(res, 400, { error: 'Email and password required' });
      if (password.length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters' });
      const db = getUserDb();
      const normalizedEmail = email.toLowerCase().trim();
      if (db[normalizedEmail]) return sendJson(res, 409, { error: 'Email already registered' });
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();
      db[normalizedEmail] = { userId, email: normalizedEmail, password: hashedPassword };
      saveUserDb(db);
      const token = jwt.sign({ userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' });
      return sendJson(res, 201, { token, user: { userId, email: normalizedEmail } });
    }
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const { email, password } = await parseBody(req);
      if (!email || !password) return sendJson(res, 400, { error: 'Email and password required' });
      const db = getUserDb();
      const normalizedEmail = email.toLowerCase().trim();
      const user = db[normalizedEmail];
      if (!user) return sendJson(res, 401, { error: 'Invalid email or password' });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return sendJson(res, 401, { error: 'Invalid email or password' });
      const token = jwt.sign({ userId: user.userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' });
      return sendJson(res, 200, { token, user: { userId: user.userId, email: normalizedEmail } });
    }
    if (req.method === 'GET' && pathname === '/api/auth/me') {
      const p = authenticate(req);
      if (!p) return sendJson(res, 401, { error: 'Not authenticated' });
      return sendJson(res, 200, { user: { userId: p.userId, email: p.email } });
    }

    // Pricing & Subscription
    if (pathname === '/api/pricing' && req.method === 'GET') {
      return sendJson(res, 200, Object.values(TIERS).map(t => ({ id: t.id, name: t.name, price: t.price, priceLabel: t.priceLabel, maxPages: t.maxPages, features: t.features, paymentLink: t.paymentLink })));
    }
    if (pathname === '/api/subscription' && req.method === 'GET') {
      const p = authenticate(req);
      if (!p) return sendJson(res, 401, { error: 'Authentication required' });
      return sendJson(res, 200, getUserSubscription(p.userId));
    }
    if (req.method === 'POST' && pathname === '/api/subscription/activate') {
      const p = authenticate(req);
      if (!p) return sendJson(res, 401, { error: 'Authentication required' });
      const { tier } = await parseBody(req);
      if (!tier || !TIERS[tier]) return sendJson(res, 400, { error: 'Invalid tier' });
      const td = TIERS[tier];
      setUserSubscription(p.userId, { tier: td.id, status: 'active', maxPages: td.maxPages, features: td.features, activatedAt: new Date().toISOString() });
      return sendJson(res, 200, { success: true, subscription: getUserSubscription(p.userId) });
    }

    // Publish
    if (req.method === 'POST' && pathname === '/api/publish') {
      const p = authenticate(req);
      if (!p) return sendJson(res, 401, { error: 'Authentication required' });
      const { html, name } = await parseBody(req);
      if (!html) return sendJson(res, 400, { error: 'Missing html field' });
      const siteId = crypto.randomUUID();
      const fileName = `${p.userId}--${siteId}.html`;
      fs.writeFileSync(path.join(PUBLISHED_DIR, fileName), JSON.stringify({ id: siteId, userId: p.userId, name: name || 'Untitled Site', createdAt: new Date().toISOString(), html }), 'utf-8');
      return sendJson(res, 201, { id: siteId, url: `/site/${siteId}` });
    }
    if (pathname === '/api/sites' && req.method === 'GET') {
      const p = authenticate(req);
      if (!p) return sendJson(res, 401, { error: 'Authentication required' });
      const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.html') && f.startsWith(p.userId)).map(f => {
        const fp = path.join(PUBLISHED_DIR, f); let name = 'Untitled Site', createdAt = fs.statSync(fp).birthtime;
        try { const d = JSON.parse(fs.readFileSync(fp, 'utf-8')); name = d.name || name; createdAt = d.createdAt || createdAt; } catch {}
        return { id: f.split('--')[1].replace('.html', ''), name, url: `/site/${f.split('--')[1].replace('.html', '')}`, size: fs.statSync(fp).size, createdAt };
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return sendJson(res, 200, files);
    }
    const siteMatch = pathname.match(/^\/site\/([a-f0-9-]+)$/);
    if (siteMatch && req.method === 'GET') {
      const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.html'));
      const found = files.find(f => f.includes(siteMatch[1]));
      if (!found) return sendJson(res, 404, { error: 'Site not found' });
      const content = fs.readFileSync(path.join(PUBLISHED_DIR, found), 'utf-8');
      try { const d = JSON.parse(content); res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d.html); return; } catch {}
      res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(content); return;
    }

    // Stripe success page
    if (req.method === 'GET' && pathname === '/api/stripe-success') {
      const tierParam = url.searchParams.get('tier') || 'starter';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(__dirname, '..', 'success-page-template.html'), 'utf-8').replace('{TIER_PLACEHOLDER}', tierParam));
      return;
    }

    // === STATIC FILES (SEO, Brand Assets) ===
    const staticFiles = {
      '/sitemap.xml': path.join(BRAND_DIR, 'sitemap.xml'),
      '/robots.txt': path.join(BRAND_DIR, 'robots.txt'),
      '/logo-icon.png': path.join(BRAND_DIR, 'logo-icon.png'),
      '/logo-icon.svg': path.join(PUBLIC_DIR, 'logo-icon.svg'),
      '/favicon.ico': path.join(PUBLIC_DIR, 'logo-icon.svg'),
    };
    if (staticFiles[pathname] && req.method === 'GET') {
      serveStatic(res, staticFiles[pathname]);
      return;
    }

    // === MARKETING LANDING PAGE ===
    if (pathname === '/' || pathname === '') {
      serveStatic(res, MARKETING_FILE);
      return;
    }

    // === EDITOR SPA (built with --base=/editor/) ===
    if (pathname.startsWith('/editor')) {
      let filePath = path.join(DIST_DIR, pathname === '/editor' ? 'index.html' : pathname.replace('/editor/', ''));
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
      }
      serveStatic(res, filePath);
      return;
    }

    // Default: serve marketing page for unknown routes
    serveStatic(res, MARKETING_FILE);

  } catch (e) {
    console.error('Server error:', e);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SwiftSite Production Server running on http://0.0.0.0:${PORT}`);
  console.log(`  Marketing: /`);
  console.log(`  Editor:    /editor`);
  console.log(`  API:       /api/*`);
});
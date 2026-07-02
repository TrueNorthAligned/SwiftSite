/**
 * SwiftSite Publish Server with Authentication & Stripe
 * Serves the built editor on port 3001 and provides:
 *   POST /api/auth/signup       — create account (email + password)
 *   POST /api/auth/login        — authenticate, returns JWT
 *   GET  /api/auth/me           — verify token, return user info
 *   POST /api/publish           — save site HTML (auth required)
 *   GET  /site/:id              — serve a published site
 *   GET  /api/sites             — list user's published sites (auth required)
 *   POST /api/stripe/create-checkout  — create Stripe Checkout session
 *   POST /api/stripe/webhook    — handle Stripe events
 *   GET  /api/subscription      — get user's subscription status
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// JWT & bcrypt
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Stripe
const Stripe = require('stripe');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
const stripe = Stripe(STRIPE_SECRET_KEY);

const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'swiftsite-dev-jwt-secret-change-in-production';
const PUBLISHED_DIR = '/home/team/shared/published-sites';
const USERS_DIR = path.join(__dirname, '..', '..', 'shared', 'users');
const SUBSCRIPTIONS_DIR = path.join(__dirname, '..', '..', 'shared', 'subscriptions');
const DIST_DIR = path.join(__dirname, '..', 'dist');

// Ensure directories exist
[PUBLISHED_DIR, USERS_DIR, SUBSCRIPTIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Pricing tiers with Stripe payment links
const TIERS = {
  starter: { id: 'starter', name: 'Starter', price: 1900, priceLabel: '$19/mo', maxPages: 5, features: ['custom domain', 'analytics'], paymentLink: 'https://buy.stripe.com/3cIeVdcXq3y2ea8dzOdEs0z' },
  business: { id: 'business', name: 'Business', price: 4900, priceLabel: '$49/mo', maxPages: 20, features: ['custom domain', 'analytics', 'SEO tools'], paymentLink: 'https://buy.stripe.com/aFa28rbTm4C62rq8fudEs0A' },
  pro: { id: 'pro', name: 'Pro', price: 9900, priceLabel: '$99/mo', maxPages: 100, features: ['custom domain', 'analytics', 'SEO tools', 'e-commerce', 'booking'], paymentLink: 'https://buy.stripe.com/9B6aEXcXqfgKd642VadEs0B' },
};

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

// --- Subscription store ---
function getSubDb() {
  const dbPath = path.join(SUBSCRIPTIONS_DIR, 'subscriptions.json');
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({}), 'utf-8');
    return {};
  }
  try { return JSON.parse(fs.readFileSync(dbPath, 'utf-8')); }
  catch { return {}; }
}

function saveSubDb(db) {
  const dbPath = path.join(SUBSCRIPTIONS_DIR, 'subscriptions.json');
  if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

function defaultSubscription() {
  return { tier: 'free', status: 'active', maxPages: 3, features: [], updatedAt: new Date().toISOString() };
}

function getUserSubscription(userId) {
  const db = getSubDb();
  return db[userId] || defaultSubscription();
}

function setUserSubscription(userId, subData) {
  const db = getSubDb();
  db[userId] = { ...subData, updatedAt: new Date().toISOString() };
  saveSubDb(db);
}

async function activateSubscription(userId, tierId, session) {
  const tier = TIERS[tierId];
  if (userId && tier) {
    setUserSubscription(userId, {
      tier: tier.id,
      status: 'active',
      maxPages: tier.maxPages,
      features: tier.features,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
    });
    console.log(`Subscription activated: user=${userId}, tier=${tierId}`);
  }
}

// --- User persistence ---
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

function getBaseUrl(req) {
  return `http://localhost:${PORT}`;
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

    // GET /api/pricing — return pricing tiers (public)
    if (pathname === '/api/pricing' && req.method === 'GET') {
      const tiers = Object.values(TIERS).map(t => ({
        id: t.id,
        name: t.name,
        price: t.price,
        priceLabel: t.priceLabel,
        maxPages: t.maxPages,
        features: t.features,
        paymentLink: t.paymentLink,
      }));
      return sendJson(res, 200, tiers);
    }

    // ---- STRIPE ENDPOINTS ----

    // POST /api/stripe/create-checkout — create Stripe Checkout session (auth required)
    if (req.method === 'POST' && pathname === '/api/stripe/create-checkout') {
      const payload = authenticate(req);
      if (!payload) return sendJson(res, 401, { error: 'Authentication required' });

      const { tierId, successUrl, cancelUrl } = await parseBody(req);
      const tier = TIERS[tierId];
      if (!tier) return sendJson(res, 400, { error: 'Invalid tier' });

      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: { name: `SwiftSite ${tier.name}` },
              unit_amount: tier.price,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          }],
          client_reference_id: payload.userId,
          metadata: { tierId: tier.id },
          success_url: successUrl || `${getBaseUrl(req)}/pricing?success=true`,
          cancel_url: cancelUrl || `${getBaseUrl(req)}/pricing?canceled=true`,
        });

        return sendJson(res, 201, { url: session.url, sessionId: session.id });
      } catch (e) {
        console.error('Stripe error:', e);
        return sendJson(res, 500, { error: 'Failed to create checkout session' });
      }
    }

    // POST /api/stripe/webhook — handle Stripe events (no auth)
    if (req.method === 'POST' && pathname === '/api/stripe/webhook') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const sig = req.headers['stripe-signature'];
        let event;
        try {
          event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
        } catch (e) {
          console.error('Webhook signature error:', e.message);
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          const userId = session.client_reference_id;
          const tierId = session.metadata?.tierId || 'starter';
          await activateSubscription(userId, tierId, session);
        }

        if (event.type === 'customer.subscription.deleted') {
          const subscription = event.data.object;
          const db = getSubDb();
          for (const [userId, sub] of Object.entries(db)) {
            if (sub.stripeSubscriptionId === subscription.id) {
              setUserSubscription(userId, defaultSubscription());
              console.log(`Subscription cancelled: user=${userId}`);
              break;
            }
          }
        }

        res.writeHead(200);
        res.end(JSON.stringify({ received: true }));
      });
      return;
    }

    // GET /api/stripe-success — called when Stripe redirects back after payment
    if (req.method === 'GET' && pathname === '/api/stripe-success') {
      const sessionId = url.searchParams.get('session_id');
      // Read tier from sessionStorage-passed query param, or URL, or default
      const tierParam = url.searchParams.get('tier') || 'starter';

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Complete — SwiftSite</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #F8FAFC; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: white; border-radius: 12px; padding: 48px; text-align: center; max-width: 480px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 28px; font-weight: 800; color: #0F172A; margin-bottom: 8px; }
    p { font-size: 16px; color: #64748B; margin-bottom: 8px; line-height: 1.5; }
    .tier-name { font-weight: 700; color: #2563EB; text-transform: capitalize; }
    .btn { display: inline-block; padding: 14px 36px; background: #2563EB; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; border: none; cursor: pointer; transition: background 0.15s; margin-top: 8px; }
    .btn:hover { background: #1D4ED8; }
    .btn:disabled { opacity: 0.5; cursor: wait; }
    .spinner { display: none; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .step { margin: 20px 0; }
    .step-number { display: inline-flex; width: 28px; height: 28px; border-radius: 50%; background: #DBEAFE; color: #2563EB; font-weight: 700; font-size: 14px; align-items: center; justify-content: center; margin-right: 8px; }
    .step-text { font-size: 14px; color: #64748B; }
    .loading .btn-text { display: none; }
    .loading .spinner { display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Payment Complete!</h1>
    <p>You've paid for <span class="tier-name" id="tierDisplay">${tierParam}</span>.</p>
    <p style="margin-bottom: 24px; font-size: 14px;">One more step — activate your plan below.</p>

    <div id="activateStep" class="step">
      <span class="step-number">1</span>
      <span class="step-text">Log in to your SwiftSite account</span>
    </div>
    <div class="step">
      <span class="step-number">2</span>
      <span class="step-text">Click the button below to activate</span>
    </div>

    <button class="btn" id="activateBtn" onclick="activate()">
      <span class="btn-text">🚀 Activate My Plan</span>
      <div class="spinner"></div>
    </button>
    <div id="statusMsg" style="margin-top: 12px; font-size: 14px; color: #64748B;"></div>
  </div>

  <script>
    const tier = sessionStorage.getItem('swiftsite-upgrade-tier') || '${tierParam}';
    document.getElementById('tierDisplay').textContent = tier;

    // Check if user is logged in by calling /api/auth/me
    let userToken = localStorage.getItem('swiftsite-auth-token');

    async function activate() {
      const btn = document.getElementById('activateBtn');
      const status = document.getElementById('statusMsg');
      btn.classList.add('loading');
      btn.disabled = true;
      status.textContent = '';

      try {
        if (!userToken) {
          status.style.color = '#EF4444';
          status.textContent = 'Please log in first. Go to the editor and log in, then come back here.';
          btn.classList.remove('loading');
          btn.disabled = false;
          return;
        }

        const res = await fetch('/api/subscription/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + userToken },
          body: JSON.stringify({ tier: tier })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          status.style.color = '#22C55E';
          status.textContent = '✅ Plan activated! Redirecting to editor...';
          setTimeout(() => { window.location.href = '/'; }, 1500);
        } else {
          throw new Error(data.error || 'Activation failed');
        }
      } catch (e) {
        status.style.color = '#EF4444';
        status.textContent = 'Error: ' + e.message + '. Try again or go to the editor.';
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    }

    // Auto-activate if token exists
    if (userToken) {
      setTimeout(activate, 500);
    }
  </script>
</body>
</html>`);
      return;
    }

    // GET /api/subscription — get user's subscription status (auth required)
    if (pathname === '/api/subscription' && req.method === 'GET') {
      const payload = authenticate(req);
      if (!payload) return sendJson(res, 401, { error: 'Authentication required' });

      const sub = getUserSubscription(payload.userId);
      return sendJson(res, 200, sub);
    }

    // POST /api/subscription/activate — activate a paid tier (auth required)
    if (req.method === 'POST' && pathname === '/api/subscription/activate') {
      const payload = authenticate(req);
      if (!payload) return sendJson(res, 401, { error: 'Authentication required' });

      const { tier } = await parseBody(req);
      if (!tier || !TIERS[tier]) return sendJson(res, 400, { error: 'Invalid tier' });

      const tierData = TIERS[tier];
      setUserSubscription(payload.userId, {
        tier: tierData.id,
        status: 'active',
        maxPages: tierData.maxPages,
        features: tierData.features,
        activatedAt: new Date().toISOString(),
      });

      console.log(`Subscription activated via direct endpoint: user=${payload.userId}, tier=${tier}`);
      return sendJson(res, 200, { success: true, subscription: getUserSubscription(payload.userId) });
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
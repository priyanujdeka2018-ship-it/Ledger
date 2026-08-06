/**
 * harness.js — shared rig for the correctness suites in this directory.
 *
 * The smoke test (../smoke-test.js) is deliberately shallow and wide: it
 * proves every screen renders. These suites are the opposite — narrow and
 * deep, each one checking that a specific piece of arithmetic or a specific
 * write is right. Run both.
 *
 * Everything is stubbed: Firestore, Identity Toolkit, Google Fonts. No suite
 * touches the live database, and React is served from ../node_modules so the
 * tests work offline.
 *
 * The clock is pinned. Rent status, arrears, occupancy and the financial year
 * are all functions of "today", so a suite that used the real date would start
 * failing on a Tuesday for no reason.
 */

const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (e) { /* try next */ }
  }
  console.error('Playwright not found. Install it: npm install -D playwright');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const HOUSE = path.join(__dirname, '..');
const APP = 'file://' + path.join(HOUSE, 'house-ledger.html');

// Resolved by path, not require.resolve: React's "exports" map hides umd/.
function localReact(pkg, file) {
  const p = path.join(HOUSE, 'node_modules', pkg, 'umd', file);
  return fs.existsSync(p) ? p : null;
}

// ── Firestore document shorthand ──────────────────────────────────────────
const s = v => ({ stringValue: v == null ? '' : String(v) });
const n = v => ({ doubleValue: v || 0 });
const arr = vs => ({ arrayValue: { values: (vs || []).map(s) } });
const docName = (coll, id) => `projects/p/databases/(default)/documents/${coll}/${id}`;

// ── Assertions ────────────────────────────────────────────────────────────
// Every suite shares one counter so `npm run test` can exit non-zero.
const state = { pass: 0, fail: 0 };

function ok(label, got, want) {
  const good = JSON.stringify(got) === JSON.stringify(want);
  good ? state.pass++ : state.fail++;
  console.log(`   ${good ? 'ok  ' : 'FAIL'} ${String(label).padEnd(44)} ${JSON.stringify(got)}` +
    (good ? '' : `   expected ${JSON.stringify(want)}`));
}

// For things worth printing but not worth pinning — a label, a phrasing.
const note = (label, value) => console.log(`   ·    ${String(label).padEnd(44)} ${value}`);
const head = t => console.log('\n' + t);

function finish(name) {
  console.log(`\n${name}: ${state.pass} passed, ${state.fail} failed`);
  process.exitCode = state.fail ? 1 : 0;
}

/**
 * Open the app with a stubbed backend.
 *
 *   docs  — { 'house-expenses': [...], 'house-rent': [...], ... }
 *           Any collection not listed answers with an empty list.
 *   today — ISO date the page should believe it is. Pinned, not advanced.
 *   mode  — 'build' | 'lease'
 *   signedIn — false to test the signed-out paths
 *
 * Returns { browser, page, writes, errors }. `writes` accumulates every
 * non-GET Firestore call as { method, url, body } so a suite can assert on
 * what was actually sent rather than on what the screen claims.
 */
async function open({ docs = {}, today = '2026-08-05', mode = 'lease', signedIn = true,
  viewport = { width: 390, height: 844 }, newExpenseId = 'exp-new' } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, hasTouch: true, acceptDownloads: true, deviceScaleFactor: 2 });

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text()); });

  const R = localReact('react', 'react.development.js');
  const RD = localReact('react-dom', 'react-dom.development.js');
  if (R) await page.route('**/react/18.2.0/umd/**', r => r.fulfill({ path: R, contentType: 'text/javascript' }));
  if (RD) await page.route('**/react-dom/18.2.0/umd/**', r => r.fulfill({ path: RD, contentType: 'text/javascript' }));
  await page.route('**fonts.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**identitytoolkit.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ idToken: 'T', refreshToken: 'R', expiresIn: '3600', email: 'j@example.com', localId: 'u1' }) }));
  await page.route('**securetoken.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ id_token: 'T2', refresh_token: 'R2', expires_in: '3600', user_id: 'u1' }) }));

  const writes = [];
  const COLLECTIONS = ['house-expenses', 'house-budgets', 'house-config', 'house-tenants', 'house-leases', 'house-rent', 'house-maintenance'];
  await page.route('**firestore.googleapis.com**', route => {
    const url = route.request().url(), method = route.request().method();
    // The change probe. One read when nothing has moved — see DEVELOPMENT.md.
    if (url.includes(':runQuery')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"readTime":"x"}]' });
    if (method === 'GET') {
      const coll = COLLECTIONS.find(c => url.includes(c)) || 'house-expenses';
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ documents: docs[coll] || [] }) });
    }
    writes.push({ method, url, auth: route.request().headers()['authorization'] || null, body: route.request().postData() });
    // A create still gets a document name back, though createEntry mints the
    // id itself (`exp-<epoch>`) and returns that rather than reading this.
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ name: docName('house-expenses', newExpenseId) }) });
  });

  // Firebase Storage (U30 receipts). Uploads/deletes are recorded in `writes`
  // like any other non-GET call; an image GET returns a 1x1 PNG so <img> loads.
  const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await page.route('**firebasestorage.googleapis.com**', route => {
    const url = route.request().url(), method = route.request().method();
    const auth = route.request().headers()['authorization'] || null;
    if (method === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1x1 });
    writes.push({ method, url, auth, body: null });
    if (method === 'POST') {
      const name = decodeURIComponent((url.match(/[?&]name=([^&]+)/) || [])[1] || 'house-receipts/x/f.jpg');
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ name, bucket: 'b', downloadTokens: 'tok-' + Math.random().toString(36).slice(2, 8) }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // expiresAt is computed against the PINNED clock, not Date.now(). The init
  // script runs before the clock is installed, so a relative expiry would look
  // long past to the page and every request would arrive on a refreshed token.
  const pinned = new Date(today + 'T10:00:00Z').getTime();
  await page.addInitScript(([m, signed, exp]) => {
    if (signed) localStorage.setItem('hl-auth', JSON.stringify({
      idToken: 'T', refreshToken: 'R', expiresAt: exp, email: 'j@example.com', name: 'Jiten' }));
    localStorage.setItem('hl-mode', m);
  }, [mode, signedIn, pinned + 3600e3]);

  // Pin the date before the app reads it. Timers still run; only Date is fixed.
  await page.clock.setFixedTime(new Date(pinned));
  await page.goto(APP);
  await page.waitForSelector('.tab-bar');

  return { browser, page, writes, errors };
}

// Every non-GET body, parsed, for one collection.
const writesTo = (writes, coll) => writes.filter(w => w.url.includes(coll));
const fields = w => JSON.parse(w.body).fields;

module.exports = { chromium, open, ok, note, head, finish, state, s, n, arr, docName, writesTo, fields, APP, HOUSE };

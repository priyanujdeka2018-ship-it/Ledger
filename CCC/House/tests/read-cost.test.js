/**
 * read-cost.test.js — the Firestore bill, and the privacy boundary.
 *
 * Two invariants this app is built around, both easy to break by accident and
 * neither visible on screen:
 *
 *   1. Sync must not get chattier. Every 60s the app runs a change probe
 *      (`:runQuery` on `updatedAt > lastSeen`) which bills ONE read when
 *      nothing has changed, against 88 for a full fetch. A full reconcile runs
 *      every 10 minutes. Adding a collection to that loop, or reverting the
 *      probe to a plain poll, blows through the 50,000/day free quota.
 *
 *   2. Expense reads must send NO token. The ledger is read-open by design;
 *      lease collections are private and use `authedFetchAll`. Attaching a
 *      token to expense reads would quietly make the public ledger depend on
 *      being signed in.
 *
 * Uses a virtual clock, so ten simulated minutes take about a second.
 *
 *   node tests/read-cost.test.js
 */

const path = require('path');
const fs = require('fs');
const { ok, note, head, finish, s, n, arr, docName } = require('./harness');

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
const umd = (pkg, file) => {
  const p = path.join(HOUSE, 'node_modules', pkg, 'umd', file);
  return fs.existsSync(p) ? p : null;
};

const EXPENSES = Array.from({ length: 88 }, (_, i) => ({
  name: docName('house-expenses', 'e' + i), fields: {
    date: s('2026-01-0' + (i % 9 + 1)), amount: n(1000 + i), vendor: s('V' + (i % 7)),
    transferTo: s('V' + (i % 7)), account: s(i % 3 ? 'Self' : 'Reemon'),
    category: s('Construction Materials'), subcategory: s('Bricks'), description: s(''),
    phase: s('Structure'), zone: s('Whole House'), expenseType: s('Contract'),
    paymentMode: s('NEFT'), invoiceRef: s(''), notes: s(''), status: s('Paid'),
    loggedBy: s('J'), updatedAt: s('2026-01-01T00:00:00.000Z') } }));

const TENANTS = [{ name: docName('house-tenants', 'ten-1'), fields: {
  name: s('Anil Bora'), phone: s(''), email: s(''), idRef: s(''), emergencyContact: s(''),
  notes: s(''), updatedAt: s(''), updatedBy: s('J') } }];

const LEASES = [{ name: docName('house-leases', 'lease-1'), fields: {
  tenantIds: arr(['ten-1']), startDate: s('2026-01-01'), endDate: s('2026-12-31'),
  rentAmount: n(20000), rentDueDay: n(5), depositAmount: n(60000), depositHolder: s('Runa'),
  depositDeducted: n(0), depositRefunded: n(0), noticePeriodDays: n(30), statusOverride: s(''),
  agreementRef: s(''), notes: s(''), previousLeaseId: s(''), updatedAt: s(''), updatedBy: s('J') } }];

// Counted separately so a new collection joining the poll loop is obvious.
const BUCKETS = ['house-budgets', 'house-tenants', 'house-leases', 'house-rent', 'house-maintenance'];

async function measure(mode) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.clock.install();
  const R = umd('react', 'react.production.min.js'), RD = umd('react-dom', 'react-dom.production.min.js');
  if (R) await page.route('**/react/18.2.0/umd/**', r => r.fulfill({ path: R, contentType: 'text/javascript' }));
  if (RD) await page.route('**/react-dom/18.2.0/umd/**', r => r.fulfill({ path: RD, contentType: 'text/javascript' }));
  await page.route('**fonts.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  const c = { expenseFull: 0, probe: 0, tokenOnExpenseRead: 0 };
  BUCKETS.forEach(b => { c[b] = 0; });

  await page.route('**firestore.googleapis.com**', route => {
    const url = route.request().url(), method = route.request().method();
    const auth = route.request().headers()['authorization'] || null;
    if (url.includes(':runQuery')) { c.probe++; return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"readTime":"x"}]' }); }
    if (method === 'GET') {
      const bucket = BUCKETS.find(b => url.includes(b));
      if (bucket) c[bucket]++;
      else { c.expenseFull++; if (auth) c.tokenOnExpenseRead++; }
      const docs = url.includes('house-tenants') ? TENANTS : url.includes('house-leases') ? LEASES
        : bucket ? [] : EXPENSES;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: docs }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.addInitScript(m => {
    localStorage.setItem('hl-auth', JSON.stringify({ idToken: 'T', refreshToken: 'R', expiresAt: Date.now() + 36e5, email: 'j@example.com', name: 'Jiten' }));
    localStorage.setItem('hl-mode', m);
  }, mode);
  await page.goto(APP);
  await page.waitForSelector('.mode-btn');
  await page.waitForTimeout(200);
  const onMount = JSON.parse(JSON.stringify(c));
  for (let i = 0; i < 10; i++) { await page.clock.runFor(60_000); await page.waitForTimeout(60); }
  await browser.close();
  return { onMount, after10min: c };
}

(async () => {
  const build = await measure('build');
  const lease = await measure('lease');
  const b = build.after10min, l = lease.after10min;

  head('1. build mode, ten minutes with nothing changing');
  note('on mount', JSON.stringify(build.onMount));
  note('after 10 min', JSON.stringify(b));
  ok('nine cheap probes', b.probe, 9);
  ok('one full reconcile in the window', b.expenseFull - build.onMount.expenseFull, 1);
  ok('budgets loaded once, never polled', b['house-budgets'], 1);
  ok('no lease collection touched at all',
    [b['house-tenants'], b['house-leases'], b['house-rent'], b['house-maintenance']], [0, 0, 0, 0]);

  head('2. lease mode');
  note('on mount', JSON.stringify(lease.onMount));
  note('after 10 min', JSON.stringify(l));
  ok('each lease collection fetched once on entry',
    [lease.onMount['house-tenants'], lease.onMount['house-leases'], lease.onMount['house-rent'], lease.onMount['house-maintenance']],
    [1, 1, 1, 1]);
  ok('and NOT joined to the 60s loop',
    [l['house-tenants'], l['house-leases'], l['house-rent'], l['house-maintenance']], [1, 1, 1, 1]);
  ok('budgets still not re-fetched', l['house-budgets'], 1);
  ok('the expense poll is unchanged by the mode', [l.probe, l.expenseFull - lease.onMount.expenseFull], [9, 1]);

  head('3. the privacy boundary');
  ok('no token ever on an expense read', [b.tokenOnExpenseRead, l.tokenOnExpenseRead], [0, 0]);

  head('4. projected cost');
  // 24h: 1440 minutes. A reconcile every 10 min = 144 of them at 88 reads;
  // the other 1296 ticks are probes at 1 read each.
  const perDay = 1296 * 1 + 144 * EXPENSES.length;
  note('reads/day per open tab', `${perDay.toLocaleString()} against a 50,000/day free quota`);
  note('a plain 60s full poll would be', (1440 * EXPENSES.length).toLocaleString());
  ok('inside quota', perDay < 50000, true);

  finish('read-cost');
})();

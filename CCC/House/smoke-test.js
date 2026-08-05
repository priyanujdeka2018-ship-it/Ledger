/**
 * smoke-test.js — walks the whole app and asserts it never dies.
 *
 * Written after a shipped regression: a component was deleted while a
 * reference to it survived, so swiping a row left threw during render and
 * React unmounted the entire tree. Every feature had its own test; nothing
 * exercised the app as a whole, so a blank page reached production.
 *
 * This is deliberately shallow and wide. It does not check that features are
 * correct — it checks that every screen renders, every control can be
 * operated, and the root element never empties. Run it before every deploy.
 *
 *   node smoke-test.js
 *
 * Firestore, Identity Toolkit and fonts are stubbed; no network calls reach
 * a real service and nothing is written to the live database.
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

// React from node_modules if it is there, otherwise let the CDN request
// through. Local copies mean the test works offline. Resolved by path rather
// than require.resolve: React's "exports" map hides the umd/ subpath.
function localReact(pkg, file) {
  const p = path.join(__dirname, 'node_modules', pkg, 'umd', file);
  return fs.existsSync(p) ? p : null;
}
const REACT_UMD = localReact('react', 'react.production.min.js');
const REACT_DOM_UMD = localReact('react-dom', 'react-dom.production.min.js');

const FILE = 'file://' + path.join(__dirname, 'house-ledger.html');

// ─── Fixture: wide enough that every screen has something to draw ───
const field = v => ({ stringValue: v });
const exp = o => ({
  name: 'projects/p/databases/(default)/documents/house-expenses/' + o.id,
  fields: Object.assign({ amount: { doubleValue: o.amount } }, ...Object.entries({
    date: o.date, vendor: o.vendor, transferTo: o.transferTo || o.vendor,
    account: o.account || 'Self', category: o.category || 'Labour & Contractors',
    subcategory: o.subcategory || 'Mason/Civil', description: '',
    phase: o.phase || 'Structure', zone: o.zone || 'Whole House',
    expenseType: o.expenseType || 'Contract', paymentMode: o.paymentMode || 'NEFT',
    status: o.status || 'Paid', invoiceRef: o.invoiceRef || '', notes: o.notes || '',
    loggedBy: 'Jiten', updatedAt: o.updatedAt || '2026-01-01T00:00:00Z',
  }).map(([k, v]) => ({ [k]: field(v) }))),
});
const budget = (phase, amount) => ({
  name: 'projects/p/databases/(default)/documents/house-budgets/bud-' + phase.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  fields: { phase: field(phase), amount: { doubleValue: amount }, notes: field(''), updatedAt: field(''), updatedBy: field('Jiten') },
});

const EXPENSES = [
  exp({ id: 'e1', date: '2026-07-11', amount: 1050000, vendor: 'Mewalal Sharma', transferTo: 'Bharti Pradhan', phase: 'Finishing', zone: 'Ground Floor', paymentMode: 'Cash' }),
  exp({ id: 'e2', date: '2026-05-02', amount: 250000, vendor: 'Mewalal Sharma', transferTo: 'Foudo Chetri', phase: 'Structure' }),
  exp({ id: 'e3', date: '2026-03-18', amount: 300000, vendor: 'Assam Hardware', account: 'Reemon', category: 'Construction Materials', subcategory: 'Bricks', paymentMode: 'IMPS' }),
  exp({ id: 'e4', date: '2026-02-09', amount: 90000, vendor: 'Architect Co', category: 'Professional Fees', subcategory: 'Architect/Consultant', expenseType: 'Fee', phase: 'Pre-Construction', paymentMode: 'GPay' }),
  exp({ id: 'e5', date: '2025-12-01', amount: 45000, vendor: 'Tiles Ltd', status: 'Pending', notes: 'balance due', invoiceRef: 'INV-42', phase: 'Finishing', zone: 'First Floor', paymentMode: 'UPI' }),
  exp({ id: 'e6', date: '2025-09-14', amount: 780000, vendor: 'Boundary Works', phase: 'Boundary & External', zone: 'Boundary Wall', status: 'Partial' }),
];
const BUDGETS = [budget('Structure', 2000000), budget('Finishing', 1000000), budget('Landscaping', 500000)];

const TENANTS = [{ name: 'projects/p/databases/(default)/documents/house-tenants/ten-1', fields: {
  name: field('Anil Bora'), phone: field('98640 11111'), email: field(''), idRef: field(''),
  emergencyContact: field(''), notes: field(''), updatedAt: field(''), updatedBy: field('Jiten') } }];
const LEASES = [{ name: 'projects/p/databases/(default)/documents/house-leases/lease-cur', fields: {
  tenantIds: { arrayValue: { values: [{ stringValue: 'ten-1' }] } },
  startDate: field('2026-01-01'), endDate: field('2026-12-31'),
  rentAmount: { doubleValue: 20000 }, rentDueDay: { doubleValue: 5 },
  depositAmount: { doubleValue: 60000 }, depositHolder: field('Runa'),
  noticePeriodDays: { doubleValue: 30 }, statusOverride: field(''), agreementRef: field(''),
  notes: field(''), previousLeaseId: field(''), updatedAt: field(''), updatedBy: field('Jiten') } }];

// One open repair and one closed-and-already-in-the-ledger repair, so both
// halves of the tab render: the open list and the closed disclosure.
const MAINT = [
  { name: 'projects/p/databases/(default)/documents/house-maintenance/mnt-1', fields: {
    leaseId: field(''), raisedDate: field('2026-07-20'), raisedBy: field('Tenant'),
    zone: field('Ground Floor'), category: field('Plumbing'), description: field('Leaking tap'),
    priority: field('Urgent'), status: field('Open'), vendor: field(''), cost: { doubleValue: 0 },
    expenseId: field(''), notes: field(''), updatedAt: field(''), updatedBy: field('Jiten') } },
  { name: 'projects/p/databases/(default)/documents/house-maintenance/mnt-2', fields: {
    leaseId: field(''), raisedDate: field('2026-06-02'), raisedBy: field('Owner'),
    zone: field('Roof & Terrace'), category: field('Structural'), description: field('Seal terrace crack'),
    priority: field('Normal'), status: field('Done'), vendor: field('Rahul'), cost: { doubleValue: 8000 },
    expenseId: field('exp-old'), notes: field(''), updatedAt: field(''), updatedBy: field('Jiten') } },
];

const SIGNED_IN = { idToken: 'T', refreshToken: 'R', expiresAt: Date.now() + 3600e3, email: 'jiten@example.com', name: 'Jiten' };

// ─── Harness ───
const results = [];
let failures = 0;

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, acceptDownloads: true });

  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) pageErrors.push(m.text()); });

  if (REACT_UMD) await page.route('**/react/18.2.0/umd/**', r => r.fulfill({ path: REACT_UMD, contentType: 'text/javascript' }));
  if (REACT_DOM_UMD) await page.route('**/react-dom/18.2.0/umd/**', r => r.fulfill({ path: REACT_DOM_UMD, contentType: 'text/javascript' }));
  await page.route('**fonts.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**identitytoolkit.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ idToken: 'T', refreshToken: 'R', expiresIn: '3600', email: 'jiten@example.com', localId: 'u1' }) }));
  await page.route('**securetoken.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ id_token: 'T2', refresh_token: 'R2', expires_in: '3600', user_id: 'u1' }) }));
  await page.route('**firestore.googleapis.com**', route => {
    const url = route.request().url();
    if (url.includes(':runQuery')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"readTime":"x"}]' });
    if (route.request().method() === 'GET') {
      const docs = url.includes('house-budgets') ? BUDGETS
        : url.includes('house-tenants') ? TENANTS
        : url.includes('house-leases') ? LEASES
        : url.includes('house-maintenance') ? MAINT
        : url.includes('house-rent') ? [] : EXPENSES;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: docs }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Short timeouts: if the app has died, every remaining step would
  // otherwise sit out the 30s default and the run would take half an hour.
  page.setDefaultTimeout(4000);

  await page.addInitScript(a => localStorage.setItem('hl-auth', JSON.stringify(a)), SIGNED_IN);
  await page.goto(FILE);
  await page.waitForSelector('.entry-row', { timeout: 15000 });

  // The assertion that matters: after every interaction the app must still
  // be mounted and must not have thrown.
  let dead = false;
  async function step(name, fn) {
    // Once the tree has unmounted nothing below is meaningful, and every
    // locator would just time out. Report the rest as skipped and stop.
    if (dead) { results.push(['skip ', name, 'app already dead']); return; }
    const before = pageErrors.length;
    try {
      await fn();
      await page.waitForTimeout(180);
      const html = await page.evaluate(() => document.getElementById('root').innerHTML.length);
      const threw = pageErrors.slice(before);
      if (html === 0) { results.push(['DEAD ', name, 'root emptied — ' + (threw.join(' / ') || 'no error captured')]); failures++; dead = true; }
      else if (threw.length) { results.push(['THREW', name, threw.join(' / ')]); failures++; }
      else results.push(['ok   ', name, html + ' bytes']);
    } catch (e) {
      results.push(['ERROR', name, e.message.split('\n')[0]]);
      failures++;
    }
  }

  const tab = t => page.locator('.tab-item', { hasText: t }).click();
  const swipe = (from, to) => page.locator('.entry-content').first().evaluate((el, [a, b]) => {
    const t = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: el.getBoundingClientRect().top + 20 });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(a)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [t(b)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
  }, [from, to]);
  const esc = async () => { if (await page.locator('.modal-overlay, .confirm-overlay, .theme-overlay').count()) await page.keyboard.press('Escape'); };

  // ── every tab renders
  for (const t of ['Entries', 'Phases', 'Zones', 'Vendors', 'Timeline'])
    await step(`tab: ${t}`, () => tab(t));

  // ── hero cards expand and collapse
  await step('tab: back to Entries', () => tab('Entries'));
  for (let i = 0; i < 3; i++) {
    await step(`hero card ${i} expand`, () => page.locator('.hero-card').nth(i).locator('.hero-front').click());
    await step(`hero card ${i} collapse`, () => page.locator('.hero-card').nth(i).locator('.hero-front').click());
  }

  // ── entries list controls
  await step('entry row expand', () => page.locator('.entry-content').first().click());
  await step('entry row collapse', () => page.locator('.entry-content').first().click());
  await step('sort by amount', () => page.locator('.sort-seg button', { hasText: 'Amount' }).click());
  await step('sort direction flip', () => page.locator('.sort-seg button', { hasText: 'Amount' }).click());
  await step('sort by date', () => page.locator('.sort-seg button', { hasText: 'Date' }).click());
  await step('status filter on', () => page.locator('.status-chip').first().click());
  await step('status filter off', () => page.locator('.status-chip').first().click());
  await step('search', () => page.locator('.search-bar input').first().fill('Mewalal'));
  await step('search cleared', () => page.locator('.search-bar input').first().fill(''));
  await step('CSV export', async () => {
    const dl = page.waitForEvent('download', { timeout: 5000 });
    await page.locator('.export-btn').click();
    await dl;
  });

  // ── swipe both ways: the direction that shipped broken had no coverage
  await step('swipe right → edit form', () => swipe(100, 240));
  await step('close edit form', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('swipe left → undo toast', () => swipe(260, 110));
  await step('undo the delete', () => page.locator('.ut-undo').click());
  await step('sub-threshold swipe is inert', () => swipe(200, 175));

  // ── entry form
  await step('open entry form', () => page.locator('.fab').click());
  await step('form: fill amount', () => page.locator('input[type=number]').first().fill('12345'));
  await step('form: pick vendor (autofill)', () => page.locator('input[list=vendors]').fill('Mewalal Sharma'));
  await step('form: toggle More details', () => page.locator('.more-toggle').click());
  await step('form: change category', () => page.locator('.modal select').first().selectOption('Construction Materials'));
  await step('form: cancel', () => page.locator('.modal button', { hasText: 'Cancel' }).click());

  // ── drill-downs
  await step('phases tab', () => tab('Phases'));
  await step('phase → zones', () => page.locator('.overview-card').first().click());
  await step('phase back', () => page.locator('.back-btn').click());
  await step('open budget editor', () => page.locator('.alloc-btn').click());
  await step('budget: type a value', () => page.locator('.bud-row input').first().fill('123456'));
  await step('budget: cancel', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('zones tab', () => tab('Zones'));
  await step('zone → phases', () => page.locator('.overview-card').first().click());
  await step('zone → entries', () => page.locator('.overview-card').first().click());
  await step('dismiss a filter chip', () => page.locator('.filter-badge').first().click());
  await step('clear remaining filters', async () => {
    while (await page.locator('.filter-badge').count()) await page.locator('.filter-badge').first().click();
  });

  // ── vendors and timeline
  await step('vendors tab', () => tab('Vendors'));
  await step('vendor search', () => page.locator('.search-bar input').first().fill('Mewalal'));
  await step('vendor search cleared', () => page.locator('.search-bar input').first().fill(''));
  await step('open vendor detail', () => page.locator('.vendor-card').first().click());
  await step('vendor: intermediary tree', () => page.locator('.tree-root').waitFor());
  await step('vendor: jump to entries', () => page.locator('.alloc-btn').first().click());
  await step('back to vendors', () => tab('Vendors'));
  await step('vendor without intermediaries', () => page.locator('.vendor-card').nth(1).click());
  await step('vendor detail back', () => page.locator('.back-btn').click());
  await step('timeline tab', () => tab('Timeline'));
  await step('timeline: by account', () => page.locator('.tl-toggle button', { hasText: 'Account' }).click());
  await step('timeline: by phase', () => page.locator('.tl-toggle button', { hasText: 'Phase' }).click());
  await step('timeline: inspect a bar', () => page.locator('.tl-bar-col').first().click());
  await step('timeline: navigate from readout', () => page.locator('.tl-readout button').click());

  // ── chrome
  await step('theme picker open', () => page.locator('.header-btn[aria-label="Choose theme"]').click());
  await step('pick a dark theme', () => page.locator('.theme-opt').nth(2).click());
  await step('theme picker again', () => page.locator('.header-btn[aria-label="Choose theme"]').click());
  await step('back to default theme', () => page.locator('.theme-opt').first().click());
  await step('account menu', () => page.locator('.header-r .header-btn').last().click());
  await step('sign out', () => page.locator('.user-opt', { hasText: 'Sign out' }).click());
  await step('signed out: view-only note', () => page.locator('.readonly-note').waitFor({ timeout: 3000 }));
  await step('signed out: FAB asks to sign in', () => page.locator('.fab').click());
  await step('sign in', async () => {
    await page.locator('input[type=email]').fill('jiten@example.com');
    await page.locator('input[type=password]').fill('pw');
    await page.locator('.confirm-box button', { hasText: 'Sign in' }).click();
  });
  await step('signed in again: form opened', () => page.locator('.modal h2').waitFor({ timeout: 3000 }));
  await step('close form', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('manual refresh', () => page.locator('.header-btn[aria-label="Refresh data"]').click());
  // ── lease mode: a whole second module behind the switch
  const toMode = m => page.locator('.mode-btn').click().then(() =>
    page.locator('.mode-opt', { hasText: m }).click());
  await step('switch to Lease mode', () => toMode('Lease'));
  await step('lease: rent tab (default)', () => page.locator('.alloc-card').first().waitFor());
  await step('lease: open this month', () => page.locator('.alloc-card').first().click());
  await step('lease: rent form outcome', () => page.locator('.modal .toggle-btn', { hasText: 'Partial' }).click());
  await step('lease: rent form waived', () => page.locator('.modal .toggle-btn', { hasText: 'Waived' }).click());
  await step('lease: close rent form', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('lease: open an arrears month', () => page.locator('.entry-row').first().click());
  await step('lease: close it', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('lease: export rent CSV', async () => {
    const dl = page.waitForEvent('download', { timeout: 5000 });
    await page.locator('button', { hasText: 'Export' }).click();
    await dl;
  });
  await step('lease: repairs tab', () => page.locator('.tab-item', { hasText: 'Repairs' }).click());
  await step('lease: open a repair', () => page.locator('.entry-row').first().click());
  await step('lease: repair cost arms the expense toggle', async () => {
    await page.locator('.modal input[type=number]').fill('4500');
    await page.locator('.modal .more-toggle').click();
  });
  await step('lease: repair delete asks first', () => page.locator('.form-actions.sticky button[aria-label="Delete this repair"]').click());
  await step('lease: cancel repair delete', () => page.locator('.confirm-box button', { hasText: 'Cancel' }).click());
  await step('lease: close repair form', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('lease: closed repairs disclosure', () => page.locator('.more-toggle').first().click());
  await step('lease: new repair form', () => page.locator('.alloc-btn', { hasText: 'Log a repair' }).click());
  await step('lease: close new repair', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('lease: reports tab', () => page.locator('.tab-item', { hasText: 'Reports' }).click());
  await step('lease: reports rendered a yield', () => page.locator('.alloc-card', { hasText: 'Yield on what it cost' }).waitFor());
  await step('lease: tax export CSV', async () => {
    const dl = page.waitForEvent('download');
    await page.locator('.alloc-btn', { hasText: 'Export' }).click();
    const f = await dl;
    if (!/^lease-\d{4}-04-01-to-\d{4}-03-31\.csv$/.test(f.suggestedFilename())) throw new Error('bad filename ' + f.suggestedFilename());
  });
  await step('lease: tenancy tab', () => page.locator('.tab-item', { hasText: 'Tenancy' }).click());
  await step('lease: open lease form', () => page.locator('.alloc-card').first().locator('button', { hasText: 'Edit' }).click());
  await step('lease: close lease form', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('lease: renew', () => page.locator('.alloc-card').first().locator('button', { hasText: 'Renew' }).click());
  await step('lease: close renewal', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('lease: open tenant', () => page.locator('.vendor-card').first().click());
  await step('lease: close tenant', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('lease: add tenant form', () => page.locator('button', { hasText: 'Add tenant' }).click());
  await step('lease: close add tenant', () => page.locator('.modal button', { hasText: 'Cancel' }).click());
  await step('lease: delete asks first', () => page.locator('.alloc-card').first().locator('button[aria-label="Delete this lease"]').click());
  await step('lease: cancel delete', () => page.locator('.confirm-box button', { hasText: 'Cancel' }).click());
  await step('lease: theme picker still works', () => page.locator('.header-btn[aria-label="Choose theme"]').click());
  await step('lease: close theme picker', () => page.locator('.theme-overlay').click({ position: { x: 5, y: 5 } }));
  await step('back to Build mode', () => toMode('Build'));
  await step('build: entries intact', () => page.locator('.entry-row').first().waitFor());

  await step('pull to refresh', () => page.evaluate(() => {
    const el = document.body;
    const t = y => new Touch({ identifier: 1, target: el, clientX: 190, clientY: y });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(100)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [t(300)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
  }));

  await browser.close();

  // ── report
  const width = Math.max(...results.map(r => r[1].length));
  for (const [status, name, detail] of results)
    console.log(`${status}  ${name.padEnd(width)}  ${detail}`);
  console.log(`\n${results.length - failures}/${results.length} steps passed`);
  if (failures) { console.error(`\n${failures} FAILED — the app broke somewhere above.`); process.exit(1); }
  console.log('App survived every screen and control.');
}

run().catch(e => { console.error(e); process.exit(1); });

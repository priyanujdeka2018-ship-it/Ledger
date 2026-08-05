/**
 * repairs.test.js — L3. The Repairs tab, and the one seam where lease mode
 * writes into build data.
 *
 * The seam is the part worth guarding. A repair cost can become a real
 * expense, but only on request, and the entry it creates must always be
 * `expenseType: Miscellaneous`, `phase: Maintenance` — a tenancy repair that
 * counted against the construction budget would quietly corrupt every phase
 * variance in build mode.
 *
 *   node tests/repairs.test.js
 */

const { open, ok, note, head, finish, s, n, docName, writesTo, fields } = require('./harness');

const TODAY = '2026-08-05';

const expense = (id, o) => ({ name: docName('house-expenses', id), fields: {
  date: s(o.date), amount: n(o.amt), vendor: s(o.vendor), transferTo: s(o.vendor),
  account: s('Self'), category: s('Labour & Contractors'), subcategory: s('Plumbing'),
  description: s(''), phase: s('Finishing'), zone: s('Ground Floor'), expenseType: s('Contract'),
  paymentMode: s('NEFT'), invoiceRef: s(''), notes: s(''), status: s('Paid'), loggedBy: s('J'),
  updatedAt: s(o.date) } });

const EXPENSES = [
  expense('e1', { date: '2026-03-01', amt: 50000, vendor: 'Rahul Plumbing' }),
  expense('e2', { date: '2026-04-01', amt: 20000, vendor: 'Bora Electricals' }),
];

const repair = (id, o) => ({ name: docName('house-maintenance', id), fields: {
  leaseId: s(''), raisedDate: s(o.on), raisedBy: s(o.by || 'Owner'), zone: s(o.zone),
  category: s(o.cat), description: s(o.desc), priority: s(o.pri || 'Normal'), status: s(o.st),
  vendor: s(o.vendor), cost: n(o.cost), expenseId: s(o.exp), notes: s(''),
  updatedAt: s(''), updatedBy: s('J') } });

const MAINT = [
  repair('mnt-1', { on: '2026-07-20', by: 'Tenant', zone: 'Ground Floor', cat: 'Plumbing',
    desc: 'Leaking tap in the bathroom', pri: 'Urgent', st: 'Open' }),
  repair('mnt-2', { on: '2026-06-02', zone: 'Roof & Terrace', cat: 'Structural',
    desc: 'Seal the terrace crack', st: 'Done', vendor: 'Rahul Plumbing', cost: 8000, exp: 'exp-old' }),
  repair('mnt-3', { on: '2026-07-01', zone: 'First Floor', cat: 'Appliance',
    desc: 'Geyser replacement', pri: 'Low', st: 'Scheduled', vendor: 'Bora Electricals', cost: 12000 }),
];

(async () => {
  const { browser, page, writes, errors } = await open({ today: TODAY, mode: 'lease',
    docs: { 'house-expenses': EXPENSES, 'house-maintenance': MAINT } });
  const flat = async loc => (await loc.textContent()).replace(/\s+/g, ' ').trim();

  head('1. the tab');
  ok('lease tabs', (await page.locator('.tab-bar button').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()),
    ['💰Rent', '🔧Repairs', '📈Reports', '🔑Tenancy']);
  await page.locator('.tab-bar button', { hasText: 'Repairs' }).click();
  await page.waitForSelector('.alloc-card');
  ok('lifetime spend', await flat(page.locator('.alloc-card .alloc-head').first()), 'Spent on repairs₹20,000');
  ok('and what is not in the ledger yet', await flat(page.locator('.alloc-card .v-meta').first()),
    '2 open · 1 closed · 1 cost not yet in the ledger');

  head('2. open sorted by priority, closed out of the way');
  (await page.locator('.entry-row').allTextContents()).forEach(t => note('', t.replace(/\s+/g, ' ').trim()));
  // Urgent outranks a newer Normal; Low sinks below both.
  ok('urgent first, low last', await page.locator('.entry-row .entry-vendor').allTextContents(),
    ['Leaking tap in the bathroom', 'Geyser replacement']);
  ok('disclosure names the count', await flat(page.locator('.more-toggle')), '1 closed▾');
  await page.locator('.more-toggle').click();
  await page.waitForTimeout(200);
  ok('a closed repair shows it reached the ledger',
    (await flat(page.locator('.more-panel .entry-row').first())).includes('in ledger'), true);

  head('3. a repair whose cost is already logged is not offered again');
  await page.locator('.more-panel .entry-row').first().click();
  await page.waitForSelector('.modal h2');
  ok('edit form', (await page.locator('.modal h2').textContent()).trim(), 'Edit Repair');
  ok('no toggle', await page.locator('.modal .more-toggle').count(), 0);
  ok('a note instead', (await page.locator('.modal .autofill-note').textContent()).trim(), 'Already logged as an expense');
  await page.locator('.modal .btn-secondary', { hasText: 'Cancel' }).click();
  await page.waitForTimeout(200);

  head('4. the seam — a new repair logged as an expense');
  await page.locator('.alloc-btn', { hasText: 'Log a repair' }).click();
  await page.waitForSelector('.modal h2');
  ok('new form', (await page.locator('.modal h2').textContent()).trim(), 'New Repair');
  await page.locator('.form-actions.sticky .btn-primary').click();
  await page.waitForTimeout(200);
  ok('an empty save is refused', (await page.locator('.modal .field-err').textContent()).trim(), 'A description is required');
  ok('and the form stays open', await page.locator('.modal h2').count(), 1);

  await page.locator('.modal textarea').first().fill('Replace the kitchen mixer tap');
  await page.locator('.modal select').nth(1).selectOption('Ground Floor');
  await page.locator('.modal input[list=repair-vendors]').fill('Rahul Plumbing');
  ok('vendor suggestions come from expenses already paid',
    await page.locator('#repair-vendors option').evaluateAll(o => o.map(x => x.value)),
    ['Bora Electricals', 'Rahul Plumbing']);
  ok('no toggle until there is a cost', await page.locator('.modal .more-toggle').count(), 0);
  await page.locator('.modal input[type=number]').fill('3500');
  await page.waitForTimeout(150);
  ok('the toggle names what it will tag', await flat(page.locator('.modal .more-toggle')),
    'Also log this as an expenseMaintenance · Ground Floor');
  await page.locator('.modal .more-toggle').click();
  await page.waitForTimeout(150);
  ok('armed', await page.locator('.modal .more-toggle').getAttribute('aria-pressed'), 'true');
  ok('and states the whole promise before you commit', await flat(page.locator('.modal .form-hint').last()),
    'Creates an entry in Build mode: ₹3,500 to Rahul Plumbing, phase Maintenance, zone Ground Floor, ' +
    'type Miscellaneous — so it never counts against the construction budget.');
  await page.locator('.form-actions.sticky .btn-primary').click();
  await page.waitForTimeout(700);

  const mw = writesTo(writes, 'house-maintenance'), ew = writesTo(writes, 'house-expenses');
  ok('two maintenance writes, one expense', [mw.length, ew.length], [2, 1]);
  const m1 = fields(mw[0]);
  ok('the repair is saved first, without an expense id',
    [m1.status.stringValue, m1.cost.doubleValue, m1.zone.stringValue, m1.expenseId.stringValue],
    ['Open', 3500, 'Ground Floor', '']);
  const e1 = fields(ew[0]);
  ok('the expense carries the repair through',
    [e1.amount.doubleValue, e1.vendor.stringValue, e1.phase.stringValue, e1.zone.stringValue],
    [3500, 'Rahul Plumbing', 'Maintenance', 'Ground Floor']);
  ok('tagged Maintenance/Repairs',
    [e1.category.stringValue, e1.subcategory.stringValue], ['Maintenance', 'Repairs']);
  ok('Miscellaneous — never against a construction budget', e1.expenseType.stringValue, 'Miscellaneous');
  ok('attributed to the signed-in account', e1.loggedBy.stringValue, 'Jiten');
  // createEntry mints the id client-side and returns it, so the assertion that
  // matters is that the repair points at the expense that was actually created.
  const createdId = new URL(ew[0].url).searchParams.get('documentId');
  ok('then patched back with that same expense id', fields(mw[1]).expenseId.stringValue, createdId);
  ok('and it is a real expense id', /^exp-\d+$/.test(createdId), true);
  ok('same document, patched twice — not two repairs', mw[0].url, mw[1].url);

  head('5. a cost with the toggle left off writes no expense');
  writes.length = 0;
  await page.locator('.alloc-btn', { hasText: 'Log a repair' }).click();
  await page.waitForSelector('.modal h2');
  await page.locator('.modal textarea').first().fill('Repaint the porch');
  await page.locator('.modal input[type=number]').fill('2000');
  await page.waitForTimeout(150);
  await page.locator('.form-actions.sticky .btn-primary').click();
  await page.waitForTimeout(600);
  ok('one repair, no expense',
    [writesTo(writes, 'house-maintenance').length, writesTo(writes, 'house-expenses').length], [1, 0]);

  head('6. deleting a repair says what it will not do');
  const disc = page.locator('.more-toggle').first();
  if (await disc.getAttribute('aria-expanded') !== 'true') await disc.click();
  await page.waitForTimeout(200);
  await page.locator('.more-panel .entry-row').first().click();
  await page.waitForSelector('.modal h2');
  await page.locator('.form-actions.sticky button[aria-label="Delete this repair"]').click();
  await page.waitForTimeout(250);
  ok('asks first', (await page.locator('.confirm-box h3').textContent()).trim(), 'Delete this repair?');
  ok('and names the consequence', (await page.locator('.confirm-box p').textContent()).trim(),
    'Seal the terrace crack — the expense it created stays in the ledger.');
  await page.locator('.confirm-box .btn-secondary').click();
  await page.locator('.modal .btn-secondary', { hasText: 'Cancel' }).click();
  await page.waitForTimeout(200);

  head('7. build mode is untouched');
  await page.locator('.mode-btn').click();
  await page.locator('.mode-opt', { hasText: 'Build' }).click();
  await page.waitForTimeout(400);
  ok('five build tabs, unchanged', (await page.locator('.tab-bar button').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()),
    ['📋Entries', '🏗️Phases', '🏠Zones', '👷Vendors', '📅Timeline']);

  ok('no page errors', errors, []);
  await browser.close();
  finish('repairs');
})();

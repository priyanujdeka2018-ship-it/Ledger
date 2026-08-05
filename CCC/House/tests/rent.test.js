/**
 * rent.test.js — L2. The computed schedule, period status, arrears, the
 * deposit ledger, and what a recorded receipt actually writes.
 *
 * The point of `house-rent` is that it is sparse: the schedule is derived
 * from the lease, and a document exists only where something happened. Three
 * stored documents must produce eight months on screen.
 *
 * Term Jan–Dec 2026 at 20,000 due on the 5th. Jan–Apr paid, May short by
 * 8,000, Jun waived, Jul nothing at all, Aug is the current month.
 *
 *   node tests/rent.test.js
 */

const { open, ok, note, head, finish, s, n, arr, docName, writesTo, fields } = require('./harness');

const TODAY = '2026-08-05';

const TENANTS = [{ name: docName('house-tenants', 'ten-1'), fields: {
  name: s('Anil Bora'), phone: s(''), email: s(''), idRef: s(''), emergencyContact: s(''),
  notes: s(''), updatedAt: s(''), updatedBy: s('J') } }];

const LEASES = [{ name: docName('house-leases', 'lease-cur'), fields: {
  tenantIds: arr(['ten-1']), startDate: s('2026-01-01'), endDate: s('2026-12-31'),
  rentAmount: n(20000), rentDueDay: n(5), depositAmount: n(60000), depositHolder: s('Runa'),
  depositDeducted: n(5000), depositRefunded: n(0), noticePeriodDays: n(30),
  statusOverride: s(''), agreementRef: s(''), notes: s(''), previousLeaseId: s(''),
  updatedAt: s(''), updatedBy: s('J') } }];

const rent = (period, o) => ({ name: docName('house-rent', 'rent-lease-cur-' + period), fields: {
  leaseId: s('lease-cur'), period: s(period), expected: n(o.expected ?? 20000),
  received: n(o.got), receivedDate: s(o.on), paymentMode: s(o.mode), status: s(o.st),
  notes: s(''), updatedAt: s(''), updatedBy: s('J') } });

const RENTS = [
  rent('2026-01', { got: 20000, on: '2026-01-05', mode: 'NEFT', st: 'Received' }),
  rent('2026-02', { got: 20000, on: '2026-02-05', mode: 'NEFT', st: 'Received' }),
  rent('2026-03', { got: 20000, on: '2026-03-06', mode: 'GPay', st: 'Received' }),
  rent('2026-04', { got: 20000, on: '2026-04-05', mode: 'NEFT', st: 'Received' }),
  rent('2026-05', { got: 12000, on: '2026-05-09', mode: 'Cash', st: 'Partial' }),
  rent('2026-06', { got: 0, st: 'Waived' }),
];

(async () => {
  const { browser, page, writes, errors } = await open({ today: TODAY, mode: 'lease',
    docs: { 'house-tenants': TENANTS, 'house-leases': LEASES, 'house-rent': RENTS } });
  const flat = async loc => (await loc.textContent()).replace(/\s+/g, ' ').trim();

  head('1. the schedule is computed, and stops at the current month');
  const sched = await page.evaluate(today => {
    const lease = { id: 'lease-cur', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 20000, rentDueDay: 5 };
    const docs = [
      { leaseId: 'lease-cur', period: '2026-01', expected: 20000, received: 20000, status: 'Received' },
      { leaseId: 'lease-cur', period: '2026-05', expected: 20000, received: 12000, status: 'Partial' },
      { leaseId: 'lease-cur', period: '2026-06', expected: 20000, received: 0, status: 'Waived' }];
    const rows = rentSchedule(lease, docs, today);
    return { months: rows.length, newestFirst: rows[0].period, oldest: rows[rows.length - 1].period,
      docs: docs.length, backedByDoc: rows.filter(r => r.rec).length,
      statuses: rows.map(r => [r.period, r.status, r.outstanding]) };
  }, TODAY);
  ok('eight months, Aug back to Jan', [sched.months, sched.newestFirst, sched.oldest], [8, '2026-08', '2026-01']);
  ok('from three stored documents', [sched.docs, sched.backedByDoc], [3, 3]);
  sched.statuses.forEach(([p, st, out]) => note(p, `${st.padEnd(9)} outstanding ${out}`));
  // Feb, Mar, Apr have no document in this inline fixture either, so they are
  // Late too — that is the whole point of a sparse collection.
  ok('every month with no document is Due or Late',
    sched.statuses.filter(([, st]) => st === 'Late' || st === 'Due').map(([p]) => p),
    ['2026-08', '2026-07', '2026-04', '2026-03', '2026-02']);

  head('2. status boundaries');
  const edges = await page.evaluate(() => {
    const L = { id: 'l', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 20000, rentDueDay: 5 };
    const aug = (rents, today) => rentSchedule(L, rents, today).find(r => r.period === '2026-08');
    const over = [{ leaseId: 'l', period: '2026-08', expected: 20000, received: 25000, status: 'Received' }];
    return {
      dayBeforeDue: aug([], '2026-08-04').status,
      onDueDay: aug([], '2026-08-05').status,
      dayAfterDue: aug([], '2026-08-06').status,
      overpaidStatus: aug(over, '2026-08-20').status,
      overpaidOutstanding: aug(over, '2026-08-20').outstanding,
      waivedOutstanding: aug([{ leaseId: 'l', period: '2026-08', expected: 20000, received: 0, status: 'Waived' }], '2026-08-20').outstanding,
      snapshotWins: aug([{ leaseId: 'l', period: '2026-08', expected: 18000, received: 18000, status: 'Received' }], '2026-08-20').expected,
      febCapped: rentSchedule({ ...L, rentDueDay: 31 }, [], '2026-02-20').find(r => r.period === '2026-02').dueDate,
      futureTerm: rentSchedule({ ...L, startDate: '2027-01-01', endDate: '2027-12-31' }, [], '2026-08-04').length,
    };
  });
  ok('before the due day', edges.dayBeforeDue, 'Due');
  ok('on the due day it is still Due', edges.onDueDay, 'Due');
  ok('the day after it is Late', edges.dayAfterDue, 'Late');
  ok('overpayment is Received', edges.overpaidStatus, 'Received');
  ok('overpayment owes nothing', edges.overpaidOutstanding, 0);
  ok('waived owes nothing', edges.waivedOutstanding, 0);
  ok('snapshot beats the lease rent', edges.snapshotWins, 18000);
  ok('due day capped at 28 so Feb has one', edges.febCapped, '2026-02-28');
  ok('a term that has not started is empty', edges.futureTerm, 0);

  head('3. the screen answers "is anything wrong?"');
  const cards = page.locator('.alloc-card');
  ok('this month first, with its status', await flat(cards.nth(0).locator('.alloc-head')), "Aug'26 — this monthDue");
  ok('rent expected, nothing in yet', await flat(cards.nth(0).locator('.entry-top')), '₹20,000—');
  ok('arrears total (Jul 20,000 + May 8,000)', await flat(cards.nth(1).locator('.alloc-head')), 'Arrears₹28,000');
  ok('oldest first', (await cards.nth(1).locator('.detail-row').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()),
    ["May'26 · due 5 May '26₹8,000", "Jul'26 · due 5 Jul '26₹20,000"]);
  ok('deposit ledger', (await cards.nth(2).locator('.detail-row').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()),
    ['Deposit held · Runa₹60,000', 'Deducted−₹5,000', 'Still held₹55,000']);
  ok('settled months collapse behind a count', (await page.locator('.more-toggle').textContent()).replace(/\s+/g, ' ').trim(), '5 settled months▾');

  head('4. recording a receipt');
  await page.locator('.entry-row').first().click();
  await page.waitForSelector('.modal h2');
  ok('form opens on the oldest arrear', (await page.locator('.modal h2').textContent()).trim(), "Jul'26 rent");
  ok('amount prefilled from the lease', await page.locator('.modal input[type=number]').inputValue(), '20000');
  await page.locator('.modal input[type=number]').fill('15000');
  await page.waitForTimeout(150);
  ok('a short payment says so', (await page.locator('.modal .field-err').textContent()).trim(), "₹5,000 short of the month's rent");
  await page.locator('.modal .toggle-btn', { hasText: 'Partial' }).click();
  await page.locator('.form-actions.sticky button', { hasText: 'Save' }).click();
  await page.waitForTimeout(500);
  const w = writesTo(writes, 'house-rent')[0];
  ok('an upsert, not a create', w.method, 'PATCH');
  ok('token attached', w.auth, 'Bearer T');
  ok('deterministic id — one document per period', w.url.split('/').pop().split('?')[0], 'rent-lease-cur-2026-07');
  const f = fields(w);
  ok('payload', [f.period.stringValue, f.expected.doubleValue, f.received.doubleValue, f.status.stringValue, f.paymentMode.stringValue],
    ['2026-07', 20000, 15000, 'Partial', 'NEFT']);

  head('5. waiving clears the money fields rather than leaving them stale');
  await page.locator('.entry-row').first().click();
  await page.waitForSelector('.modal h2');
  await page.locator('.modal .toggle-btn', { hasText: 'Waived' }).click();
  await page.waitForTimeout(150);
  ok('the amount input is withdrawn', await page.locator('.modal input[type=number]').count(), 0);
  await page.locator('.form-actions.sticky button', { hasText: 'Save' }).click();
  await page.waitForTimeout(500);
  const f2 = fields(writesTo(writes, 'house-rent').pop());
  ok('nothing stale left behind',
    [f2.received.doubleValue, f2.receivedDate.stringValue, f2.paymentMode.stringValue, f2.status.stringValue],
    [0, '', '', 'Waived']);

  head('6. CSV of the term');
  const dl = page.waitForEvent('download');
  await page.locator('button', { hasText: 'Export' }).click();
  const file = await dl;
  const csv = require('fs').readFileSync(await file.path(), 'utf8').trim().split('\r\n');
  ok('named for the term', file.suggestedFilename(), 'rent-2026-01-01-to-2026-12-31.csv');
  ok('one row per month elapsed', csv.length - 1, 8);
  ok('header', csv[0], 'period,dueDate,expected,received,outstanding,status,receivedDate,paymentMode,notes');
  ok('a month with no document still exports', csv[2], '2026-07,2026-07-05,20000,0,20000,Late,,,');

  ok('no page errors', errors, []);
  await browser.close();
  finish('rent');
})();

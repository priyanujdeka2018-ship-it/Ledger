/**
 * reports.test.js — L4. Yield, per-financial-year net position, occupancy,
 * tax export.
 *
 * The fixture is arranged so every figure has a value you can check by hand:
 *   build cost      30,00,000  (three capital entries)
 *   lease           1 Oct 2025 → 30 Sep 2026 at 25,000/month
 *   receipts        Oct–Mar (FY25) and Apr–Jul (FY26)
 *   running costs   FY25: repairs 20,000 + leasing 30,000
 *                   FY26: repairs 12,000
 *
 *   node tests/reports.test.js
 */

const { open, ok, note, head, finish, s, n, arr, docName, writesTo } = require('./harness');

const TODAY = '2026-08-05';

const expense = (id, o) => ({ name: docName('house-expenses', id), fields: {
  date: s(o.date), amount: n(o.amt), vendor: s(o.vendor || 'V'), transferTo: s(o.vendor || 'V'),
  account: s('Self'), category: s(o.cat || 'Construction Materials'), subcategory: s(o.sub || 'Bricks'),
  description: s(o.desc), phase: s(o.phase), zone: s('Whole House'),
  expenseType: s(o.type || 'Contract'), paymentMode: s('NEFT'), invoiceRef: s(''), notes: s(''),
  status: s('Paid'), loggedBy: s('J'), updatedAt: s(o.date) } });

const EXPENSES = [
  expense('c1', { date: '2024-06-01', amt: 1500000, phase: 'Structure' }),
  expense('c2', { date: '2025-02-01', amt: 1000000, phase: 'Finishing' }),
  expense('c3', { date: '2025-09-01', amt: 500000, phase: 'Furnishing' }),
  expense('r1', { date: '2025-11-10', amt: 20000, phase: 'Maintenance', cat: 'Maintenance', sub: 'Repairs', desc: 'Tap', type: 'Miscellaneous' }),
  expense('l1', { date: '2025-10-05', amt: 30000, phase: 'Leasing', cat: 'Leasing', sub: 'Agent Fee', desc: 'Agent fee', type: 'Fee' }),
  expense('r2', { date: '2026-05-20', amt: 12000, phase: 'Maintenance', cat: 'Maintenance', sub: 'Repairs', desc: 'Geyser', type: 'Miscellaneous' }),
];

const LEASES = [{ name: docName('house-leases', 'lease-1'), fields: {
  tenantIds: arr(['ten-1']), startDate: s('2025-10-01'), endDate: s('2026-09-30'),
  rentAmount: n(25000), rentDueDay: n(5), depositAmount: n(75000), depositHolder: s('Runa'),
  depositDeducted: n(0), depositRefunded: n(0), noticePeriodDays: n(30), statusOverride: s(''),
  agreementRef: s(''), notes: s(''), previousLeaseId: s(''), updatedAt: s(''), updatedBy: s('J') } }];

const TENANTS = [{ name: docName('house-tenants', 'ten-1'), fields: {
  name: s('Anil Bora'), phone: s(''), email: s(''), idRef: s(''), emergencyContact: s(''),
  notes: s(''), updatedAt: s(''), updatedBy: s('J') } }];

const RENTS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
  '2026-04', '2026-05', '2026-06', '2026-07'].map(p => ({
  name: docName('house-rent', 'rent-lease-1-' + p), fields: {
    leaseId: s('lease-1'), period: s(p), expected: n(25000), received: n(25000),
    receivedDate: s(p + '-05'), paymentMode: s('NEFT'), status: s('Received'), notes: s(''),
    updatedAt: s(''), updatedBy: s('J') } }));

(async () => {
  const { browser, page, errors } = await open({ today: TODAY, mode: 'lease',
    docs: { 'house-expenses': EXPENSES, 'house-leases': LEASES, 'house-tenants': TENANTS, 'house-rent': RENTS } });

  head('1. capital and running costs are different things');
  ok('build cost excludes running phases', await page.evaluate(() => buildCost([
    { phase: 'Structure', amount: 1500000 }, { phase: 'Finishing', amount: 1000000 },
    { phase: 'Furnishing', amount: 500000 }, { phase: 'Maintenance', amount: 20000 },
    { phase: 'Leasing', amount: 30000 }])), 3000000);

  head('2. financial year is Apr–Mar, never calendar');
  const fys = await page.evaluate(() => ['2026-03-31', '2026-04-01', '2026-08-05', '2027-01-15'].map(fyOf));
  ok('31 Mar 2026 is FY 2025', fys[0], 2025);
  ok('1 Apr 2026 is FY 2026', fys[1], 2026);
  ok('5 Aug 2026 is FY 2026', fys[2], 2026);
  ok('15 Jan 2027 is still FY 2026', fys[3], 2026);
  ok('label', await page.evaluate(() => fyLabel(2026)), 'FY 2026–27');

  head('3. per-year net position');
  const rows = await page.evaluate(today => {
    const E = [{ phase: 'Structure', amount: 1500000, date: '2024-06-01' },
      { phase: 'Finishing', amount: 1000000, date: '2025-02-01' },
      { phase: 'Furnishing', amount: 500000, date: '2025-09-01' },
      { phase: 'Maintenance', amount: 20000, date: '2025-11-10' },
      { phase: 'Leasing', amount: 30000, date: '2025-10-05' },
      { phase: 'Maintenance', amount: 12000, date: '2026-05-20' }];
    const R = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']
      .map(p => ({ leaseId: 'l1', period: p, expected: 25000, received: 25000, receivedDate: p + '-05', status: 'Received' }));
    const L = [{ id: 'l1', startDate: '2025-10-01', endDate: '2026-09-30', statusOverride: '' }];
    return fyRows(E, R, L, today);
  }, TODAY);
  const y25 = rows.find(r => r.fy === 2025), y26 = rows.find(r => r.fy === 2026);
  ok('newest year first', rows[0].fy, 2026);
  ok('FY25 rent in (Oct–Mar × 25k)', y25.rentIn, 150000);
  ok('FY25 repairs out', y25.repairs, 20000);
  ok('FY25 leasing out', y25.leasing, 30000);
  ok('FY25 net', y25.net, 100000);
  ok('FY25 days in year', y25.days, 365);
  ok('FY25 days let (1 Oct → 31 Mar)', y25.letDays, 182);
  ok('FY26 rent in (Apr–Jul × 25k)', y26.rentIn, 100000);
  ok('FY26 repairs out', y26.repairs, 12000);
  ok('FY26 net', y26.net, 88000);
  ok('FY26 measured to today, not to March', y26.days, 127);
  ok('FY26 days let so far', y26.letDays, 127);
  ok('year in progress flagged partial', y26.partial, true);

  head('4. occupancy edge cases');
  const occ = await page.evaluate(() => {
    const base = id => ({ id, startDate: '2026-04-01', endDate: '2026-06-30', statusOverride: '' });
    const win = (ls, rs) => occupiedDays(ls, rs || [], '2026-04-01', '2026-06-30');
    return {
      gap: win([{ id: 'a', startDate: '2026-04-01', endDate: '2026-04-30', statusOverride: '' },
        { id: 'b', startDate: '2026-06-01', endDate: '2026-06-30', statusOverride: '' }]),
      abutting: win([{ id: 'a', startDate: '2026-04-01', endDate: '2026-04-30', statusOverride: '' },
        { id: 'b', startDate: '2026-05-01', endDate: '2026-06-30', statusOverride: '' }]),
      overlapping: win([base('a'), { id: 'b', startDate: '2026-05-01', endDate: '2026-07-31', statusOverride: '' }]),
      draftIgnored: win([{ ...base('a'), statusOverride: 'Draft' }]),
      clipped: win([{ id: 'a', startDate: '2020-01-01', endDate: '2030-01-01', statusOverride: '' }]),
      terminatedToLastRent: win([{ ...base('a'), statusOverride: 'Terminated' }],
        [{ leaseId: 'a', period: '2026-05', received: 25000 }]),
      terminatedNoRent: win([{ ...base('a'), statusOverride: 'Terminated' }]),
    };
  });
  ok('two spells with a gap (30 + 30)', occ.gap, 60);
  ok('abutting spells merge (30 + 61)', occ.abutting, 91);
  ok('overlap counts a day once', occ.overlapping, 91);
  ok('draft lease is not occupancy', occ.draftIgnored, 0);
  ok('long lease clipped to the window', occ.clipped, 91);
  ok('terminated → end of last rented month', occ.terminatedToLastRent, 61);
  ok('terminated with no rent → nothing', occ.terminatedNoRent, 0);

  head('5. the screen');
  await page.locator('.tab-bar button', { hasText: 'Reports' }).click();
  await page.waitForSelector('.alloc-card');
  const flat = async loc => (await loc.textContent()).replace(/\s+/g, ' ').trim();
  const cards = page.locator('.alloc-card');
  // Gross 3,00,000 / 30,00,000 = 10.0%. Running costs in the 365 days before
  // 2026-08-05 are 30,000 + 20,000 + 12,000 = 62,000, so net is 7.9%.
  ok('gross yield', await flat(cards.nth(0).locator('.alloc-head')), 'Yield on what it cost10.0%');
  ok('net yield', await flat(cards.nth(0).locator('.bud-total')), 'Net yield7.9%');
  ok('running costs signed and negative',
    (await cards.nth(0).locator('.detail-row').allTextContents())[2].replace(/\s+/g, ' ').trim(),
    'Running costs, last 12 months− ₹62,000');
  ok('recovery: 2,50,000 of 30,00,000', await flat(cards.nth(1).locator('.alloc-head')), 'Recovered so far8.3%');
  note('payback projection', await flat(cards.nth(1).locator('.v-meta').last()));
  ok('FY26 card header', await flat(cards.nth(2).locator('.alloc-head')), 'FY 2026–27 · to date+ ₹88,000');
  ok('zero gets no sign',
    (await cards.nth(2).locator('.detail-row').allTextContents())[2].replace(/\s+/g, ' ').trim(),
    'Leasing costs out₹0');
  ok('FY25 occupancy', await flat(cards.nth(3).locator('.budget-labels')), '182 of 365 days let50% occupied');

  head('6. tax export');
  ok('selected year defaults to the current one', (await page.locator('.toggle-btn.active').textContent()).trim(), 'FY 2026–27');
  const dl = page.waitForEvent('download');
  await page.locator('.alloc-btn', { hasText: 'Export' }).click();
  const file = await dl;
  const csv = require('fs').readFileSync(await file.path(), 'utf8').replace(/^﻿/, '').trim().split('\r\n');
  ok('filename spans Apr–Mar', file.suggestedFilename(), 'lease-2026-04-01-to-2027-03-31.csv');
  ok('header names the direction', csv[0], 'date,direction,type,description,counterparty,amount');
  ok('four receipts and one repair', csv.length - 1, 5);
  ok('sorted oldest first, repair interleaved', csv[3], '2026-05-20,out,Repair,Geyser,V,12000');
  ok('a receipt names the tenant', csv[1], "2026-04-05,in,Rent,Rent for Apr'26,Anil Bora,25000");

  ok('no page errors', errors, []);
  await browser.close();
  finish('reports');
})();

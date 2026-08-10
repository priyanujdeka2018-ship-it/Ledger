/**
 * attachments.test.js — U30 receipt attachments (Firestore base64).
 *
 * Receipts are stored as base64 in a separate house-receipts collection,
 * fetched on demand; the expense doc carries only a {id,name,type,size} ref.
 * Verifies the write choreography that's invisible on a passing screen:
 *   1. Saving a new entry with a receipt: create the doc, write one
 *      house-receipts doc (base64 data, with a token), then patch the expense's
 *      `attachments` with a ref pointing at that receipt id.
 *   2. Removing a receipt while editing drops the ref AND deletes the
 *      house-receipts doc.
 *
 * Nothing touches a live service — the harness stubs Firestore.
 *
 *   node tests/attachments.test.js
 */

const { open, ok, head, finish, docName, writesTo, fields } = require('./harness');

const s = v => ({ stringValue: v });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const PNG_DATAURL = 'data:image/png;base64,' + PNG.toString('base64');

// A build-mode expense that already carries one receipt (ref only), plus the
// house-receipts doc it points at, for the remove test.
const withReceipt = { name: docName('house-expenses', 'e-att'), fields: {
  date: s('2026-07-01'), amount: { doubleValue: 5000 }, vendor: s('Tiles Ltd'), transferTo: s('Tiles Ltd'),
  account: s('Self'), category: s('Construction Materials'), subcategory: s('Bricks'), description: s(''),
  phase: s('Structure'), zone: s('Whole House'), expenseType: s('Contract'), paymentMode: s('NEFT'),
  invoiceRef: s(''), notes: s(''), status: s('Paid'), loggedBy: s('J'), updatedAt: s('2026-07-01T00:00:00Z'),
  attachments: { arrayValue: { values: [{ mapValue: { fields: {
    id: s('rcpt-e-att-1'), name: s('r.png'), type: s('image'), size: { integerValue: '1024' } } } }] } } } };
const receiptDoc = { name: docName('house-receipts', 'rcpt-e-att-1'), fields: {
  expId: s('e-att'), name: s('r.png'), type: s('image'), size: { integerValue: '1024' }, data: s(PNG_DATAURL) } };

const swipeRight = page => page.locator('.entry-content').first().evaluate(el => {
  const t = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: el.getBoundingClientRect().top + 20 });
  el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(90)], bubbles: true }));
  el.dispatchEvent(new TouchEvent('touchmove', { touches: [t(250)], bubbles: true }));
  el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
});

(async () => {
  // ── 1. New entry + receipt → create, write receipt doc, patch ref ────────
  {
    const { browser, page, writes, errors } = await open({ docs: {}, mode: 'build', today: '2026-08-05' });
    await page.waitForSelector('.fab');
    await page.locator('.fab').click();
    await page.locator('input[type=number]').first().fill('12345');
    await page.locator('input[list=vendors]').fill('New Vendor');
    await page.locator('.modal select').nth(0).selectOption('Construction Materials');
    await page.locator('.modal select').nth(1).selectOption('Bricks');
    await page.locator('.modal select').nth(2).selectOption('Structure');
    await page.locator('.more-toggle').click();
    await page.locator('input[type=file]').setInputFiles([{ name: 'receipt.png', mimeType: 'image/png', buffer: PNG }]);
    await page.locator('.more-panel .att-thumb, .more-panel .att-skel').first().waitFor();
    await page.locator('.modal button', { hasText: 'Save' }).first().click();
    await page.waitForTimeout(300);

    head('1. new entry with a receipt');
    const rcpt = writes.filter(w => w.url.includes('house-receipts'));
    ok('one receipt doc written', rcpt.filter(w => w.method === 'PATCH').length, 1);
    const rw = rcpt.find(w => w.method === 'PATCH');
    ok('receipt write carried a token', /^Bearer /.test(rw.auth || ''), true);
    const rf = fields(rw);
    ok('receipt stores base64 data', /^data:/.test(rf.data.stringValue), true);
    ok('receipt typed image', rf.type.stringValue, 'image');
    ok('receipt linked back to the entry', /^exp-\d+$/.test(rf.expId.stringValue), true);
    const rid = rw.url.match(/house-receipts\/([^?]+)/)[1];

    const expw = writesTo(writes, 'house-expenses');
    ok('the entry itself was created', !!expw.find(w => w.method === 'POST'), true);
    const patch = expw.find(w => w.method === 'PATCH' && /updateMask\.fieldPaths=attachments/.test(w.url));
    ok('attachments patched after the receipt', !!patch, true);
    const ref = fields(patch).attachments.arrayValue.values[0].mapValue.fields;
    ok('ref points at the receipt id', ref.id.stringValue, rid);
    ok('ref carries no bytes (just metadata)', ref.data, undefined);
    ok('no page errors', errors, []);
    await browser.close();
  }

  // ── 2. Removing a receipt deletes its house-receipts doc ─────────────────
  {
    const { browser, page, writes, errors } = await open({
      docs: { 'house-expenses': [withReceipt], 'house-receipts': [receiptDoc] }, mode: 'build', today: '2026-08-05' });
    await page.waitForSelector('.entry-row');
    await swipeRight(page);
    await page.locator('.modal h2', { hasText: 'Edit Entry' }).waitFor();
    await page.locator('.more-panel .att-thumb').first().waitFor();
    await page.locator('.more-panel .att-x').first().click();
    await page.locator('.modal button', { hasText: 'Save' }).first().click();
    await page.waitForTimeout(300);

    head('2. removing a receipt');
    const del = writes.filter(w => w.url.includes('house-receipts') && w.method === 'DELETE');
    ok('one receipt doc deleted', del.length, 1);
    ok('deleted the right id', /house-receipts\/rcpt-e-att-1/.test(del[0].url), true);
    const patch = writesTo(writes, 'house-expenses').find(w => w.method === 'PATCH');
    ok('the entry no longer lists the receipt', fields(patch).attachments.arrayValue.values || [], []);
    ok('no page errors', errors, []);
    await browser.close();
  }

  finish('attachments');
})();

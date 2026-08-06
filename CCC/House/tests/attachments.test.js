/**
 * attachments.test.js — U30 receipt attachments (Firebase Storage).
 *
 * Verifies the write choreography that is invisible on a passing screen:
 *   1. Saving a new entry with a receipt: create the doc, upload the file to
 *      Storage with a token, then patch the doc's `attachments` with the
 *      download URL + path. The upload lands under house-receipts/<id>/.
 *   2. Removing a receipt while editing drops it from the doc AND frees the
 *      Storage object (a DELETE to the Storage host).
 *
 * The Storage host is stubbed by the harness, so nothing touches a live bucket.
 *
 *   node tests/attachments.test.js
 */

const { open, ok, head, finish, docName, writesTo, fields } = require('./harness');

const s = v => ({ stringValue: v });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

// A build-mode expense that already carries one receipt, for the remove test.
const withReceipt = { name: docName('house-expenses', 'e-att'), fields: {
  date: s('2026-07-01'), amount: { doubleValue: 5000 }, vendor: s('Tiles Ltd'), transferTo: s('Tiles Ltd'),
  account: s('Self'), category: s('Construction Materials'), subcategory: s('Bricks'), description: s(''),
  phase: s('Structure'), zone: s('Whole House'), expenseType: s('Contract'), paymentMode: s('NEFT'),
  invoiceRef: s(''), notes: s(''), status: s('Paid'), loggedBy: s('J'), updatedAt: s('2026-07-01T00:00:00Z'),
  attachments: { arrayValue: { values: [{ mapValue: { fields: {
    url: s('https://firebasestorage.googleapis.com/v0/b/b/o/house-receipts%2Fe-att%2Fr.png?alt=media&token=t'),
    path: s('house-receipts/e-att/r.png'), name: s('r.png'), type: s('image'), size: { integerValue: '1024' } } } }] } } } };

// Dispatch a horizontal swipe on the first row (dx>0 → edit form opens).
const swipeRight = page => page.locator('.entry-content').first().evaluate(el => {
  const t = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: el.getBoundingClientRect().top + 20 });
  el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(90)], bubbles: true }));
  el.dispatchEvent(new TouchEvent('touchmove', { touches: [t(250)], bubbles: true }));
  el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
});

(async () => {
  // ── 1. New entry + receipt → create, upload, patch ───────────────────────
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
    await page.locator('.more-panel .att-thumb').first().waitFor();
    await page.locator('.modal button', { hasText: 'Save' }).first().click();
    await page.waitForTimeout(300);

    head('1. new entry with a receipt');
    const storage = writes.filter(w => w.url.includes('firebasestorage'));
    ok('one upload to Storage', storage.filter(w => w.method === 'POST').length, 1);
    const up = storage.find(w => w.method === 'POST');
    ok('upload path is house-receipts/<id>/', /house-receipts%2Fexp-\d+%2F/.test(up.url), true);
    ok('upload carried a bearer token', /^Bearer /.test(up.auth || ''), true);

    const expw = writesTo(writes, 'house-expenses');
    const created = expw.find(w => w.method === 'POST');
    ok('the entry itself was created', !!created, true);
    const patch = expw.find(w => w.method === 'PATCH' && /updateMask\.fieldPaths=attachments/.test(w.url));
    ok('attachments patched after upload', !!patch, true);
    const a = fields(patch).attachments.arrayValue.values[0].mapValue.fields;
    ok('patched attachment has the download URL', /alt=media&token=/.test(a.url.stringValue), true);
    ok('patched attachment stores the path', /^house-receipts\//.test(a.path.stringValue), true);
    ok('patched attachment typed image', a.type.stringValue, 'image');
    ok('no page errors', errors, []);
    await browser.close();
  }

  // ── 2. Removing a receipt while editing frees the Storage object ─────────
  {
    const { browser, page, writes, errors } = await open({ docs: { 'house-expenses': [withReceipt] }, mode: 'build', today: '2026-08-05' });
    await page.waitForSelector('.entry-row');
    await swipeRight(page);
    await page.locator('.modal h2', { hasText: 'Edit Entry' }).waitFor();
    await page.locator('.more-panel .att-thumb').first().waitFor();
    await page.locator('.more-panel .att-x').first().click();
    await page.locator('.modal button', { hasText: 'Save' }).first().click();
    await page.waitForTimeout(300);

    head('2. removing a receipt');
    const del = writes.filter(w => w.url.includes('firebasestorage') && w.method === 'DELETE');
    ok('one Storage object deleted', del.length, 1);
    ok('deleted the right path', /house-receipts%2Fe-att%2Fr\.png/.test(del[0].url), true);
    const patch = writesTo(writes, 'house-expenses').find(w => w.method === 'PATCH');
    ok('the doc no longer lists the receipt', fields(patch).attachments.arrayValue.values || [], []);
    ok('no page errors', errors, []);
    await browser.close();
  }

  finish('attachments');
})();

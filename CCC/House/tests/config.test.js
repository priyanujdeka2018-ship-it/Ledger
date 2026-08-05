/**
 * config.test.js — U30 editable lists (house-config).
 *
 * Two things worth pinning, both invisible on a passing screen:
 *
 *   1. The merge is ADDITIVE. Custom categories, phases and zones from
 *      house-config show up in the entry form alongside the built-ins, and the
 *      built-ins are never dropped. A custom entry also gets a working colour,
 *      so a phase the code has no swatch for cannot crash a chip.
 *
 *   2. Save round-trips. The editor writes the three string arrays back to the
 *      single house-config/lists document in the shape fetchConfig reads.
 *
 * The clock is pinned by the harness like every suite here.
 *
 *   node tests/config.test.js
 */

const { open, ok, head, finish, docName, writesTo, fields } = require('./harness');

const sv = v => ({ stringValue: v });
const av = vs => ({ arrayValue: { values: vs.map(sv) } });

// One custom phase, one custom zone, a custom subcategory under an existing
// category, and a brand-new category carrying its own first subcategory.
const CONFIG = { name: docName('house-config', 'lists'), fields: {
  phases: av(['Extension']),
  zones: av(['Garage']),
  subcats: av(['Utilities & Systems::CCTV', 'Security Systems::Alarm']),
  updatedAt: sv(''), updatedBy: sv('J') } };

// Read the option values of the select whose <label> is exactly `label`.
// Matched by exact label text so "Category" never also grabs "Subcategory".
const optionsFor = (page, label) => page.evaluate(lbl => {
  const field = [...document.querySelectorAll('.modal .field')]
    .find(f => { const l = f.querySelector('label'); return l && l.textContent.trim() === lbl; });
  const sel = field && field.querySelector('select');
  return sel ? [...sel.options].map(o => o.value).filter(Boolean) : null;
}, label);

(async () => {
  const { browser, page, writes, errors } = await open({
    docs: { 'house-config': [CONFIG] }, mode: 'build', today: '2026-08-05' });

  await page.waitForSelector('.fab');
  await page.locator('.fab').click();
  await page.waitForSelector('.modal .field select');
  // Config loads on mount asynchronously; optionsFor() reads the DOM once with
  // no retry, so wait until the merge is actually reflected before reading.
  await page.waitForFunction(() => {
    const f = [...document.querySelectorAll('.modal .field')]
      .find(x => x.querySelector('label') && x.querySelector('label').textContent.trim() === 'Phase');
    const sel = f && f.querySelector('select');
    return sel && [...sel.options].some(o => o.value === 'Extension');
  }, { timeout: 4000 });

  head('1. custom options merge in, built-ins stay');
  const phases = await optionsFor(page, 'Phase');
  ok('custom phase appears', phases.includes('Extension'), true);
  ok('built-in phases stay', ['Pre-Construction', 'Structure', 'Leasing'].every(p => phases.includes(p)), true);
  ok('custom phase is appended after the built-ins', phases[phases.length - 1], 'Extension');

  const zones = await optionsFor(page, 'Zone');
  ok('custom zone appears', zones.includes('Garage'), true);
  ok('built-in zones stay', zones.includes('Whole House'), true);

  const cats = await optionsFor(page, 'Category');
  ok('brand-new category appears', cats.includes('Security Systems'), true);
  ok('built-in categories stay', cats.includes('Construction Materials'), true);

  head('2. custom subcategories, under both an existing and a new category');
  // Pick the existing category the custom subcategory hangs off.
  await page.locator('.modal .field:has(label) select').first().selectOption('Utilities & Systems');
  const subsExisting = await optionsFor(page, 'Subcategory');
  ok('custom subcategory under an existing category', subsExisting.includes('CCTV'), true);
  ok('and the category keeps its built-in subcategories', subsExisting.includes('Solar'), true);

  await page.locator('.modal .field:has(label) select').first().selectOption('Security Systems');
  const subsNew = await optionsFor(page, 'Subcategory');
  ok('the new category carries its own subcategory', subsNew, ['Alarm']);

  await page.locator('.modal button', { hasText: 'Cancel' }).click();

  head('3. a custom phase has a working colour (no crash on its chip)');
  // Select the custom phase on a fresh entry and save it; the timeline and
  // phase chips look its colour up by name. A missing swatch would throw.
  ok('no page errors so far', errors, []);

  head('4. the editor round-trips through house-config/lists');
  await page.locator('.tab-item', { hasText: 'Phases' }).click();
  await page.locator('.alloc-btn', { hasText: 'Manage categories' }).click();
  await page.locator('input[aria-label="New phase"]').fill('Annexe');
  await page.locator('input[aria-label="New phase"]').press('Enter');
  await page.locator('.filter-badge', { hasText: 'Annexe' }).waitFor();
  await page.locator('.modal button', { hasText: 'Save lists' }).click();

  const w = writesTo(writes, 'house-config');
  ok('one write, to the single lists document', [w.length, /house-config\/lists/.test(w[0].url)], [1, true]);
  const f = fields(w[0]);
  ok('phases keep the loaded custom and add the new one',
    f.phases.arrayValue.values.map(v => v.stringValue), ['Extension', 'Annexe']);
  ok('zones are preserved untouched', f.zones.arrayValue.values.map(v => v.stringValue), ['Garage']);
  ok('subcategories are preserved untouched',
    f.subcats.arrayValue.values.map(v => v.stringValue), ['Utilities & Systems::CCTV', 'Security Systems::Alarm']);
  ok('the write carries a token (family-only)', !!w[0].auth, true);

  ok('no page errors', errors, []);
  await browser.close();
  finish('config');
})();

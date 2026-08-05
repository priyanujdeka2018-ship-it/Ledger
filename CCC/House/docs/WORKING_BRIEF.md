<!-- ARCHIVED. Committed 2026-08-05, unchanged from the original upload. -->

> **Historical document.** This is the working brief the Claude Code sessions
> started from, kept for the reasoning behind decisions and for the reference
> figures in "Data model", which are still authoritative.
>
> **The rest is superseded.** Current truth is `../HANDOFF.md` and
> `../DEVELOPMENT.md`. Specifically, since this was written:
>
> - The layout is flat `CCC/House/`, not `src/` and `dist/`. The live URL is
>   `/Ledger/CCC/House/house-ledger.html`, not `/Ledger/CCC/`.
> - The source is ~3,060 lines, not ~755, and has a second module (lease mode)
>   with its own sections not listed here.
> - **B1, B2 and B3 are all fixed.** So is the whole U-series apart from `U30`
>   (attachments), which is blocked on Firebase Storage. The 3-step entry form
>   described here is now a single sheet (`U4`).
> - Polling is no longer a 60s full fetch — it is a change probe with a
>   periodic reconcile. See `../DEVELOPMENT.md`.
> - Writes now require a signed-in account; `loggedBy` comes from the token,
>   and the `FAMILY` constant is gone.
> - `verify.py` and `seed-house-expenses.html` are referenced here but are not
>   in this repository.

---

# House Ledger — Claude Code Working Brief

## What this is

A single-file React app that tracks expenses for a family house construction
project in Assam, India. Live at
`https://priyanujdeka2018-ship-it.github.io/Ledger/CCC/house-ledger.html`.

Data lives in Firebase Firestore (project `japan-2026-apr`, collections
`house-expenses` and `house-budgets`), accessed over the REST API — no Firebase
SDK. 88 seeded transactions spanning Jul 2024 – Apr 2026, ~₹86L total spend
against a ₹75.4L contract budget.

The primary user is on **iPhone**. Mobile is not a secondary target; it is the
only target that matters. Desktop is a bonus.

---

## Repo layout and the one rule that matters

```
Ledger/CCC/
├── src/house-ledger.jsx.html   ← EDIT THIS (JSX source, ~755 lines)
├── dist/house-ledger.html      ← GENERATED, deployed (~72KB)
├── compile.js                  ← build script
├── package.json                ← @babel/core + @babel/preset-react
├── seed-house-expenses.html    ← one-time Firestore seeder
└── DEVELOPMENT.md
```

**Never hand-edit `dist/house-ledger.html`.** It is overwritten on every build.
Edit `src/`, then run `node compile.js`.

### Why the build step exists

The app originally loaded Babel standalone (~800KB) and transpiled JSX in the
browser. This silently failed to load on iPhone Safari. `compile.js` converts
JSX to `React.createElement` calls at build time, dropping the deployed file
from ~870KB to ~72KB with zero runtime transpilation. Do not reintroduce a
runtime transpiler. React and ReactDOM still load from CDN as UMD globals.

### Finding code without reading the whole file

The source is divided by section markers. Do not hardcode line numbers —
they shift on every edit.

```bash
grep -n "─── " src/house-ledger.jsx.html          # list all sections
grep -n "─── JS-ENTRY-FORM ───" src/house-ledger.jsx.html   # find one
```

Sections: `CSS-HEADER`, `CSS-HERO-CARDS`, `CSS-TAB-BAR`, `CSS-ENTRY-LIST`,
`CSS-OVERVIEW-CARDS`, `CSS-VENDOR-TAB`, `CSS-TIMELINE`, `CSS-FAB`,
`CSS-MODAL-FORM`, `CSS-CONFIRM-THEME`, `CSS-MISC`, `JS-FIREBASE`,
`JS-CONSTANTS`, `JS-PHASE-CAT-ACCT-CLR`, `JS-THEMES`, `JS-FIRESTORE-HELPERS`,
`JS-FORMATTING`, `JS-HEADER-COMPONENT`, `JS-HERO-SPEND-CARD`,
`JS-HERO-ACCOUNT-CARD`, `JS-TAB-BAR`, `JS-SUBTOTAL-BAR`, `JS-ENTRY-ROW`,
`JS-ENTRIES-TAB`, `JS-OVERVIEW-CARDS`, `JS-PHASES-TAB`, `JS-ZONES-TAB`,
`JS-VENDORS-TAB`, `JS-TIMELINE-TAB`, `JS-ENTRY-FORM`, `JS-CONFIRM-DIALOG`,
`JS-THEME-PICKER`, `JS-APP`.

### Verify every change

```bash
node compile.js
node -e "const fs=require('fs');const m=fs.readFileSync('dist/house-ledger.html','utf8').match(/<script>([\s\S]*?)<\/script>/);require('fs').writeFileSync('/tmp/c.js',m[1])" \
  && node --check /tmp/c.js && echo "JS valid"
```

Compile output should report ~275 `React.createElement` calls and **0 Babel
references**. If Babel references appear, the CDN script tag was reintroduced.

---

## Data model

Each document in `house-expenses`:

| Field | Notes |
|---|---|
| `date` | `YYYY-MM-DD` string (sorts lexically) |
| `amount` | number, INR |
| `vendor` | who the money was *for* |
| `transferTo` | who the money was *sent to* — differs from `vendor` for intermediary payments |
| `account` | `Self` (Jiten) or `Reemon` (Priyanuj) |
| `category` / `subcategory` | hierarchical, see `CATEGORIES` in `JS-CONSTANTS` |
| `phase` | Pre-Construction → Leasing, 10 values |
| `zone` | Whole House, Ground Floor, Boundary Wall, etc. |
| `expenseType` | `Contract` / `Fee` / `Miscellaneous` — only `Contract` counts against budget |
| `paymentMode` | Cash, NEFT, GPay, UPI, IMPS |
| `status` | Paid / Partial / Pending / Overdue |
| `invoiceRef`, `notes`, `loggedBy`, `updatedAt` | metadata |

**The intermediary pattern is important domain logic.** Several payments to the
mason Mewalal Sharma were routed through third parties (Bharti Pradhan, Foudo
Chetri, Afrina Begum, Suresh Prasad). `vendor` stays Mewalal Sharma;
`transferTo` records the actual recipient. Vendor aggregation must group by
`vendor`, never `transferTo`.

**Firestore writes**: any string field that could be `undefined` must default to
`''` in `toFS()`, or Firestore rejects the write with an unset-type error.

### Reference figures

The three project documents disagree. Resolved by diffing them row-by-row:

| Source | Rows | Total |
|---|---|---|
| `HOUSE_SPEC.md` per-row mapping | **87** | ₹84,16,388 |
| `HOUSE_CONTEXT.md` headline | 88 | ₹85,16,388 |
| `seed-house-expenses.html` | **88** | ₹85,16,388 |

**Row 37 is absent from `HOUSE_SPEC.md`** — Bharti Pradhan, ₹1,00,000, NEFT,
13 Sep 2025, Reemon account, for Mewalal Sharma. ₹84,16,388 + ₹1,00,000 =
₹85,16,388, which reconciles the spec to the context doc exactly. The headline
totals were taken from the full bank statement; the per-row table dropped one
row in transcription. The v1 app was built from that table, which is why an
entry was missing from the live ledger.

Aside from row 37, `HOUSE_SPEC.md` and the seeder agree on date, amount,
payment mode, and account for **all 87 shared rows**.

Authoritative figures — use these to check Firestore:

| Figure | Value |
|---|---|
| Entries | 88 |
| Total spend | ₹85,16,388 |
| Contract spend | ₹74,18,728 |
| Non-contract | ₹10,97,660 |
| Contract budget | ₹75,37,510 |
| Budget remaining | ₹1,18,782 (1.58% — effectively exhausted) |
| Self | ₹63,73,628 (65 entries) |
| Reemon | ₹21,42,760 (23 entries) |
| Date range | 11 Jul 2024 – 17 Apr 2026 |

If the app total is ₹84,16,388, row 37 never reached Firestore. Re-run
`seed-house-expenses.html`; it skips existing documents and will create only
`exp-seed-37`.

**One unreconciled figure.** `HOUSE_CONTEXT.md` states the account split as Self
₹63,30,198 / Reemon ₹21,86,190 — same 65/23 counts and same grand total, but
₹43,430 attributed differently from the per-row data. No single row and no
pairwise Self↔Reemon swap produces the gap. A 3-for-3 combination does exist,
but across 77.9 million searched combinations that is expected by chance, and
the rows involved share no vendor, date, or category — treat it as coincidence,
not a cause.

The per-row mapping and the seeder agree with each other, so use their figures.
Do not propagate the context doc's split, and do not change any row's `account`
to make it match. This is inference, not proof: neither figure has been checked
against the original bank statement. If the split ever needs to be
authoritative — for tax, or for splitting costs between family members — verify
against the statement rather than any of these three documents.

Run `python3 verify.py` to reproduce every figure in this section.

---

## Already fixed — do not regress these

1. **Polling cost.** Was `setInterval(loadData, 10000)`. With 88 docs that is
   ~760,000 document reads/day per open tab, against a 50,000/day free quota —
   exhausted in ~95 minutes. Now 60s, paused via `visibilitychange` when the tab
   is hidden, immediate refresh on return. Do not shorten the interval. If the
   ledger grows past a few hundred entries, switch to the Firestore real-time
   listener rather than polling harder.
2. **Swipe vs tap.** Swiping a row also fired the expand toggle. A `swiped` ref
   now suppresses the click when movement exceeds 8px.
3. **Number formatting.** `fmtAmt()` abbreviates ₹1,00,000 → ₹1L, ₹85,16,388 →
   ₹85.16L, with `Cr` above a crore. `fmtFull()` gives the exact figure.
4. **Dead code** removed: unused `budgets` state, unused `selZone` in `PhasesTab`.
5. **Missing transaction restored.** Row 37 (Bharti Pradhan, ₹1,00,000, NEFT,
   13 Sep 2025, Reemon, for Mewalal Sharma) is absent from `HOUSE_SPEC.md`'s
   per-row table and so never made it into the v1 seed. It is present in
   `seed-house-expenses.html`. The seeder is idempotent — it skips any
   `exp-seed-NN` that already exists, so re-running it creates only what is
   genuinely missing.

---

## Open bugs

**B1 — Render-phase mutation in `JS-VENDORS-TAB`.**
`const lastDate = v.entries.sort(...)` mutates the memoized array during render.
Use `[...v.entries].sort(...)`. Cheapest fix in the codebase; do it first.

**B2 — Dishonest sync indicator in `JS-APP`.**
`syncStatus` initialises to `'live'`, so the green dot shows before the first
fetch resolves. Add a `'loading'` state and render a neutral/pulsing dot until
the first successful load.

**B3 — Deploy path mismatch.**
The live URL is `/Ledger/CCC/house-ledger.html` but the build writes to
`dist/`. Either point the GitHub Action at `dist/house-ledger.html` or change
`OUT` in `compile.js`. Pick one and make it consistent — right now a rebuild
does not update the live site.

---

## Not code, but check it

The Firebase web API key sits in plain text in the deployed file. That is
normal and by design — it identifies the project, it does not authorise
anything. **What actually protects the data is Firestore security rules.** If
the project is still in test mode (`allow read, write: if true`), anyone who
views source on the public Pages site can read, rewrite, or delete every entry.
Verify the rules in the Firebase console before adding more real data.

---

## UX work, in priority order

### P1 — Make logging an expense fast

This is a ledger that gets used a few times a week for years. Entry speed
dominates everything else. The current flow is a 3-step modal with ~12 fields,
almost all of which repeat from the last payment to the same vendor.

**U1. Vendor-based autofill.** When the user picks an existing vendor in step 1,
prefill `category`, `subcategory`, `phase`, `zone`, `expenseType`, and
`paymentMode` from that vendor's most recent entry. Every field stays editable.
For a repeat Mewalal Sharma payment this turns ~12 decisions into 2 (date,
amount). Show a small dismissible note — "prefilled from 9 Feb payment" — so the
autofill is visible rather than magic.

**U2. Live amount echo.** Under the amount input, render the parsed value as
`₹1,00,000 (1L)` as the user types. A dropped or extra zero is the most common
and most expensive data-entry error in a ledger, and Indian digit grouping makes
it easy to miss. This is a few lines and prevents real damage.

**U3. Explain disabled Next.** `canNext` currently disables the button with no
reason given. Either show which field is missing, or let the user advance and
mark the incomplete field inline. Silent disabled buttons are a dead end.

**U4. Reconsider the 3-step split.** With U1 in place, most entries only touch
step 1. Consider one scrollable sheet with the rare fields (invoice ref, notes,
status) collapsed under a "More details" disclosure — fewer taps, and the user
can see everything before saving.

### P2 — Trust and reconciliation

The app will be checked against bank statements. Ambiguity is expensive here.

**U5. Exact amounts in entry rows.** Abbreviation was the right call for hero
cards and aggregates, but in the entry list ₹1L and ₹1.05L are hard to tell
apart while scanning, and that list is the reconciliation unit. Use `fmtFull()`
in `JS-ENTRY-ROW`; keep `fmtAmt()` everywhere aggregate. The row already has
`white-space:nowrap` and `flex-shrink:0` on the amount and ellipsis on the
vendor, so exact figures will not overflow.

**U6. Sort control on the entries list.** Currently hardcoded to date descending.
Add date ↕ / amount ↕ as a compact segmented control.

**U7. Surface `status`.** Paid/Partial/Pending/Overdue is captured and stored but
invisible outside the expanded detail. Everything is `Paid` today, so the first
`Pending` entry will vanish into the list. Add a chip for any non-Paid status
and a filter for it.

**U8. Show `loggedBy`.** Four family members can write. Attribution is captured
and never displayed — add it to the expanded detail.

**U9. CSV export.** A family ledger of this size will eventually be reconciled,
shared with an accountant, or used for tax. Export the current filtered view,
not just everything — exporting what is on screen is more useful and makes the
filter state meaningful.

**U10. Undo instead of confirm for delete.** A modal interrupt for a reversible
action is heavier than it needs to be. A 5-second undo toast is faster in the
common case and safer in the accidental case. Keep the confirm if you prefer,
but do not do both.

**U25. Unbuilt validation rules.** The original spec defined three checks that
were never implemented. `EntryForm` currently does presence checks only.

- `date` must not be in the future
- `amount` must be positive
- **Duplicate detection** on `date + amount + vendor + category` — warn, but
  allow override

Duplicate detection is the one that matters. A ledger reconciled against bank
statements over several years will eventually have the same payment logged
twice, and nothing catches it today. The warning should be non-blocking:
genuine same-day same-amount payments to one vendor do happen in this dataset.

### P3 — Navigation and legibility

**U11. Hero card expansion pushes its sibling off-screen.** `.hero-row` is a
horizontal flex scroller; an expanded card goes to `flex: 0 0 100%`, shoving the
other card out of view. Tapping one card making the other disappear is
disorienting. Either expand downward in place (full-width row, cards stacked) or
keep both visible and expand within the card's own column.

**U12. Timeline is hard to read.** Month labels are `0.5rem` rotated -45° — about
8px of angled text on a phone. With ~20 months, bars are roughly 15px wide.
Either make the chart horizontally scrollable with wider bars and upright
labels, or label every third month. There is also no way to read a bar's value:
tapping navigates to entries instead of revealing the amount. Add the figure
above the tallest bars, or a tap-to-inspect state before navigating.

**U13. Add a "this month" figure.** For an in-progress build, current-month spend
is probably the single most-checked number and it is not on screen anywhere.

**U14. Loading state.** First paint shows an empty list while the network call is
in flight, with a green sync dot (see B2). Add a skeleton or spinner for the
initial load.

**U15. Swipe affordance.** The "← swipe to edit or delete →" hint only renders
inside the expanded detail, so the user must already know to expand to discover
they can swipe. Move the hint somewhere reachable, and make the underlay respond
to swipe distance so the commit threshold is felt rather than guessed.

**U16. Vendor tab has no total.** The list is sorted by spend but never sums.

**U17. Filter chips are one merged label.** Multiple active filters collapse into
a single joined string, so they can only be cleared together. Render one chip per
filter, each individually dismissible.

### P4 — Accessibility and polish

**U18. Remove `user-scalable=no`.** The viewport meta blocks pinch zoom. That is
an accessibility failure, newer iOS Safari ignores it anyway, and the layout is
responsive enough not to need it.

**U19. Raise the smallest type.** `.tl-month` is `0.5rem` (~8px), `.tab-item` and
several chips are `0.6–0.62rem`. Floor body-adjacent text at ~0.7rem / 11px.

**U20. Label the icon-only buttons.** The header's refresh, theme, and user
buttons have no `aria-label`. Zero in the file currently.

**U21. Pull-to-refresh.** There is a refresh button, but pull-to-refresh is the
gesture mobile users reach for first.

**U22. Theme picker previews.** Six themes are represented by an emoji and a
name. A three-colour swatch strip per option (bg / card / accent) would let the
user choose without trial and error.

### P5 — Larger, later

These come from the original project roadmap. None are started.

**U23. Per-phase budgets.** `CONTRACT_BUDGET` is a single hardcoded constant
(`7537510`) and the `house-budgets` collection is created but unused. Budget per
phase with variance against actual would make the Phases tab decision-useful
rather than descriptive. This is the natural next feature once P1–P3 land, and
the highest-value item in this tier.

**U24. Intermediary indicator in the row.** The vendor ≠ transferTo distinction
is meaningful domain information hidden until a row is expanded. A small glyph
on the collapsed row would surface it.

**U26. Vendor detail view.** Tapping a vendor currently jumps to filtered
entries. A dedicated view with payment history over time, split by account and
payment mode, would suit the handful of vendors carrying most of the spend.

**U27. Intermediary payment tree.** Mewalal Sharma → who was paid how much via
whom. The data supports this today and nothing surfaces it.

**U28. Payment mode analytics.** Cash vs bank split matters for a construction
project of this size. Not currently aggregated anywhere.

**U29. Lease mode.** A `house-leases` collection, tenant records, rent expected
vs received per month, maintenance requests linked to a lease, and auto-tagging
expenses to the Leasing phase. This is the long-term destination for the app
once construction finishes — the `Leasing` phase and category already exist as
placeholders.

**U30. Attachments and richer export.** Receipt images via Firebase Storage;
PDF/Excel export beyond CSV. Also: Firestore-hosted config so categories,
phases, and zones become editable without a code change and a redeploy.

---

## Working constraints

- Mobile-first. Test reasoning against a ~390px viewport.
- No framework, no bundler, no npm runtime deps. React + ReactDOM from CDN,
  everything else hand-rolled. Keep it that way — the whole point is one file
  that loads fast on a phone.
- `localStorage` is used for theme and username. Fine here; this is a real
  deployed page, not a sandboxed artifact.
- Themes are CSS custom properties set on `documentElement`. Any new colour must
  be added to all six theme objects in `JS-THEMES`, not hardcoded — several of
  the six are dark, and hardcoded light-mode colours will break them.
- Currency is INR throughout; use Indian digit grouping (`en-IN`), lakhs and
  crores, never thousands/millions.
- Prefer small, verifiable diffs. Run the compile-and-check loop after each one
  rather than batching many changes into a single unverified build.

## Suggested order

`B1` → `B3` → `U1` → `U2` → `U5` → `B2` → `U14` → `U25` → then P2/P3 by
appetite.

B1 and B3 are minutes of work. U1 (vendor autofill) is the single largest
quality-of-life win in the list. U25's duplicate detection is worth pulling
forward if you are about to add a batch of back-dated entries.

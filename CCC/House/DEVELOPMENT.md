# House Ledger — Development Workflow

## File Structure

```
Ledger/CCC/House/
├── house-ledger.jsx.html   ← EDIT THIS (JSX source)
├── house-ledger.html       ← GENERATED and DEPLOYED (no Babel)
├── compile.js              ← Build script (JSX → React.createElement)
├── smoke-test.js           ← Whole-app walk; run before every deploy
├── tests/                  ← Correctness suites + shared harness
├── package.json            ← Babel + React (dev only)
├── CLAUDE.md               ← Auto-loaded by Claude Code: the rules, and a pointer
├── DEVELOPMENT.md          ← This file
├── LEASE_MODE_PLAN.md      ← Lease module design and scope decisions
├── HANDOFF.md              ← Session handoff: state, open work, traps
└── docs/                   ← Archived source documents, each with a staleness banner
    ├── WORKING_BRIEF.md        (the original brief: B1–B3, U1–U30, reference figures)
    ├── HOUSE_ARCHITECTURE.md   (data model, constants, colour systems)
    └── HOUSE_CONTEXT.md        (vendors, intermediary routes, phase history)
```

⚠ `docs/HOUSE_CONTEXT.md` carries the rejected account split — see "Data note"
below. Its banner says so, but do not let it leak into anything derived.

Both files sit in the same directory. `house-ledger.html` is what GitHub
Pages serves, at `/Ledger/CCC/House/house-ledger.html` — `compile.js` writes
it in place, so a rebuild always reaches the live site.

**Never hand-edit `house-ledger.html`.** It is overwritten on every build.

## How to Make Changes

### Setup (one-time)
```bash
npm install
```

### Edit → Compile → Verify → Deploy
```bash
# 1. Edit house-ledger.jsx.html

# 2. Compile, smoke-test and run the correctness suites
npm run check          # or: npm run verify (compile + smoke only)

# 3. Commit both files together
git add house-ledger.jsx.html house-ledger.html
git push
```

Compile output should report ~300 `React.createElement` calls and **0 Babel
references**. If Babel references appear, the babel-standalone CDN script tag
was reintroduced into the source — remove it. Runtime transpilation is what
made the page fail to load on iPhone Safari in the first place.

## Finding code without reading the whole file

The source is divided by section markers. **Do not hardcode line numbers** —
they shift on every edit.

```bash
grep -n "─── " house-ledger.jsx.html            # list all sections
grep -n "─── JS-ENTRY-FORM ───" house-ledger.jsx.html   # find one
```

| Section | Contents |
|---|---|
| `CSS-HEADER` | Header bar, sync dot |
| `CSS-HERO-CARDS` | Expandable hero cards |
| `CSS-TAB-BAR` | Bottom navigation |
| `CSS-ENTRY-LIST` | Entry rows, search, chips, swipe underlays |
| `CSS-OVERVIEW-CARDS` | Phase/Zone drill-down cards |
| `CSS-VENDOR-TAB` | Vendor list cards |
| `CSS-TIMELINE` | Timeline chart bars |
| `CSS-FAB` | Floating action button |
| `CSS-MODAL-FORM` | Entry form modal, amount echo, autofill note, field errors |
| `CSS-CONFIRM-THEME` | Dialog boxes, theme picker, user menu |
| `CSS-MISC` | Empty state, loading skeleton, undo toast |
| `JS-FIREBASE` | Project ID, API key, endpoints |
| `JS-CONSTANTS` | Phases, zones, categories, budget |
| `JS-PHASE-CAT-ACCT-CLR` | Colour lookups (hardcoded hex, not theme vars) |
| `JS-THEMES` | 6 theme definitions + `applyTheme` |
| `JS-FIRESTORE-HELPERS` | `toFS`/`fromFS`, CRUD, change probe, attachment (de)serialisers |
| `JS-STORAGE` | Firebase Storage REST: receipt upload/delete, image downscale (U30) |
| `JS-AUTH` | Identity Toolkit sign-in, token refresh |
| `JS-BUDGETS` | `house-budgets` helpers |
| `JS-CONFIG-DATA` | `house-config`: `applyConfig` (additive merge), `fetchConfig`/`saveConfig` (U30) |
| `JS-CSV-EXPORT` | CSV of the filtered view |
| `JS-PDF-EXPORT` | Printable rent & annual statements — print-to-PDF, no library (U30) |
| `JS-FORMATTING` | `fmtAmt`, `fmtFull`, date helpers |
| `JS-HEADER-COMPONENT` | Sync dot, refresh, theme, user menu |
| `JS-HERO-SPEND-CARD` | Total + contract breakdown |
| `JS-HERO-ACCOUNT-CARD` | Self/Reemon split |
| `JS-TAB-BAR` | 5-tab bottom nav |
| `JS-SUBTOTAL-BAR` | Filtered-view subtotal |
| `JS-ENTRY-ROW` | Entry row; swipe → edit / two-step reveal-Delete |
| `JS-ENTRIES-TAB` | List + search + filter chip |
| `JS-OVERVIEW-CARDS` | Shared Phases/Zones card renderer |
| `JS-PHASES-TAB` | Phase drill-down (2 levels) |
| `JS-ZONES-TAB` | Zone drill-down (2 levels) |
| `JS-PAYMENT-MODES` | Cash vs banked card, reused per vendor |
| `JS-INTERMEDIARY-TREE` | vendor → who was actually paid |
| `JS-VENDOR-DETAIL` | Per-vendor view (2nd level of Vendors tab) |
| `JS-VENDORS-TAB` | Vendor aggregation, drills into the detail |
| `JS-INSIGHTS` | Analytics tab: slice control, stat tiles, SVG spend-over-time, ranked breakdowns, `MonthlyChart` (the old timeline bars) |
| `JS-ENTRY-FORM` | Single-sheet add/edit modal, autofill, validation |
| `JS-UNDO-TOAST` | Deferred-delete toast with undo |
| `JS-BUDGET-EDITOR` | Per-phase budget editor |
| `JS-CONFIG-EDITOR` | Add custom categories/phases/zones (U30) |
| `JS-SIGN-IN` | Email/password dialog |
| `JS-LEASE-DATA` | Private (authed-read) tenant and lease collections |
| `JS-RENT-DATA` | `house-rent`, sparse, deterministic ids |
| `JS-RENT-SCHEDULE` | Computed schedule, period status, arrears |
| `JS-RENT-FORM` / `JS-RENT-TAB` | Record a receipt; this month, arrears, deposit |
| `JS-MAINT-DATA` | `house-maintenance`, and `repairToExpense` — the cross-module write |
| `JS-REPAIR-FORM` / `JS-REPAIRS-TAB` | Log a repair; open by priority, closed behind a disclosure |
| `JS-REPORTS` | Financial year (Apr–Mar), build cost, occupancy, tax CSV |
| `JS-REPORTS-TAB` | Yield, recovery, per-year net position, export |
| `JS-LEASE-LOGIC` | Derived status, overlap refusal, tenant status |
| `JS-TENANT-FORM` / `JS-LEASE-FORM` | Lease-mode add/edit sheets |
| `JS-TENANCY-TAB` | Current tenancy, tenants, previous terms |
| `CSS-LEASE-MODE` | Mode switcher, chip picker, conflict note |
| `JS-THEME-PICKER` | Theme grid |
| `JS-APP` | State, polling, routing |

## Constraints that bite

- **Mobile-first.** Reason against a ~390px viewport. The primary user is on
  iPhone; desktop is a bonus.
- **No bundler, no runtime deps.** React + ReactDOM from CDN as UMD globals,
  everything else hand-rolled.
- **Do not make sync chattier.** Every 60s the app runs a *change probe* — a
  `:runQuery` filtered on `updatedAt > lastSeen` — which bills one document
  read when nothing has changed, against 88 for a full collection fetch. A
  full reconcile runs every 10 minutes, on manual refresh, and whenever the
  tab is returned to, because a probe cannot see a deletion made on another
  device. Polling stops entirely while the tab is hidden.
  Measured: ~14,000 reads/day per open tab, against ~126,720 for a plain 60s
  full poll, on a 50,000/day free quota. Firestore's real-time listener would
  be better still but needs the SDK this app deliberately does without.
- **Any new colour goes in all six theme objects.** Three themes are dark; a
  hardcoded light-mode value will be unreadable on them.
- **`undefined` breaks Firestore writes.** Any string field that could be
  unset must default to `''` in `toFS()`.
- **Vendor aggregation groups by `vendor`, never `transferTo`** — several
  payments to Mewalal Sharma were routed through intermediaries, and grouping
  by recipient fragments one contractor across four names.
- **Abbreviate aggregates, not line items.** `fmtAmt()` for hero cards and
  totals, `fmtFull()` in the entry list, which is the reconciliation unit.

## Auth and Firestore rules

The ledger is **read-open, write-locked**: anyone with the URL can view it, and
changing it requires a signed-in family account.

Sign-in is email/password against the Identity Toolkit REST API — no Firebase
SDK, consistent with the rest of the app. `signIn()` stores `{idToken,
refreshToken, expiresAt, email, name}` in `localStorage` under `hl-auth`.
`authedFetch()` attaches `Authorization: Bearer <idToken>` to every write and,
on a 401/403, refreshes once via the Secure Token API and retries. Reads
deliberately send no token, so the app works fully signed out.

`loggedBy` now comes from the authenticated account. The old `FAMILY` constant
and its localStorage name picker are gone — attribution was self-declared and
anyone could claim to be anyone.

### Rules to paste in the Firebase console

The canonical ruleset lives in **`firestore.rules`** at the root of `CCC/House/`.
It is version-controlled but **not deployed automatically** — there is no
Firebase CLI in this project. To apply it: open the Firebase console →
Firestore Database → Rules, paste the whole file, and Publish. Before pasting,
replace the two placeholder emails in `familyMember()` with the real accounts
created under Authentication → Users (the check is on `request.auth.token.email`,
so it must match the Firebase Auth account exactly — not necessarily a contact
address).

The ruleset, reproduced here so this doc stands alone:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function familyMember() {
      return request.auth != null
        && request.auth.token.email in [
             'jiten@example.com',
             'priyanuj@example.com'
           ];
    }

    // Build ledger: read-open, write-locked.
    match /house-expenses/{doc} {
      allow read: if true;
      allow write: if familyMember();
    }
    match /house-budgets/{doc} {
      allow read: if true;
      allow write: if familyMember();
    }
    // Editable lists (custom categories/phases/zones) — read-open, write-locked.
    match /house-config/{doc} {
      allow read: if true;
      allow write: if familyMember();
    }

    // Lease module: fully private. Reads AND writes require a family account,
    // because these hold a third party's name, phone number and arrears history.
    match /house-tenants/{doc}     { allow read, write: if familyMember(); }
    match /house-leases/{doc}      { allow read, write: if familyMember(); }
    match /house-rent/{doc}        { allow read, write: if familyMember(); }
    match /house-maintenance/{doc} { allow read, write: if familyMember(); }

    // Japan trip ledger — separate app, left exactly as it was.
    // NOTE: this rule still expires and that app stops working on 2026-12-30.
    match /expenses/{doc} {
      allow read, write: if request.time < timestamp.date(2026, 12, 30);
    }
  }
}
```

The previous rule was the test-mode default, `allow read, write: if
request.time < timestamp.date(2026, 12, 30)` — unrestricted read and write by
anyone until that date, then **everything denied, reads included**. The house
collections above no longer have an expiry, and the four lease collections are
**private on read as well as write** — matching the `authedFetchAll()` read
path the code already uses, which the earlier version of this block left
unenforced. The `expenses` block still expires; that belongs to the Japan trip
app and is a separate decision.

**Reminder: writing the rules is not applying them.** Until the block above is
pasted and published in the console, lease documents fall through to the
test-mode default and are world-readable and world-writable the moment they
exist. Apply them before the first real tenant record is written.

## Per-phase budgets

`house-budgets` holds one document per budgeted phase. Phase names contain
spaces and ampersands, so the document id is a slug (`bud-boundary-external`)
and the real name lives in a `phase` field.

| Field | Notes |
|---|---|
| `phase` | Member of `PHASES` |
| `amount` | number, INR |
| `notes` | Optional, unused by the UI so far |
| `updatedAt` / `updatedBy` | Metadata; `updatedBy` is the signed-in account |

**Budgets are allocations against `CONTRACT_BUDGET`, not a replacement for
it.** The constant (`7537510`) is the real contract value, so the Phases tab
shows how much of it has been allocated and how much is still unallocated.
Deriving the overall budget by summing phase budgets was rejected: budgeting
three of ten phases would silently collapse the headline figure.

**Only `Contract` spend counts against a budget**, matching the rule the hero
card already used. A phase's card shows contract spend against its budget; the
phase detail additionally names the fee and miscellaneous spend that is
excluded, so the difference between the two figures is never a mystery.

Writing: `saveBudget()` PATCHes without an `updateMask`, which upserts, so it
covers create and update alike. Clearing a field deletes the document rather
than storing a zero. The editor only writes phases whose value actually
changed.

**Budgets are deliberately not part of the 60s poll.** There are ~10 of them
and they change perhaps monthly; polling them would add roughly 14,000
reads/day per open tab for nothing. They load on mount, on manual refresh, and
after an edit.

## Pull-to-refresh

`U21`. Engages only when the page is already scrolled to the top, no modal is
open, and the drag is more vertical than horizontal — a horizontal row swipe
wins outright. The indicator rides the finger (drag distance halved, capped at
90px) and switches to "Release to refresh" past 64px, so the threshold is seen
rather than guessed. Releasing short of it does nothing.

Listeners are passive and attached to `document`; nothing calls
`preventDefault`, so native overscroll is untouched.

## Vendor analytics

The Vendors tab is two levels. The list carries a **cash vs banked** card for
the whole ledger; tapping a vendor opens a detail view rather than jumping
straight to filtered entries, with a "View N entries →" button for that.

The detail shows totals and account split, contract spend, average payment, a
month-by-month sparkline, the **intermediary tree**, per-vendor payment modes,
a phase split, and the full payment list with `↳ recipient` on routed rows.

**The intermediary tree is the point.** `vendor` ≠ `transferTo` is real domain
information — several payments to Mewalal Sharma went through Bharti Pradhan,
Foudo Chetri, Afrina Begum and Suresh Prasad — and it was previously visible
only as a comma-joined list of names. The tree branches by recipient with
amount, count, share and last date; a "Paid directly" branch covers the rest,
and the branches sum to the vendor total. It does not render for a vendor with
no intermediaries.

`MODE_CLR` joins the other hardcoded semantic colour lookups. Cash is the
distinction that matters at this scale; everything else leaves a bank trail.

## Rent (L2)

The Rent tab is the landing tab in lease mode, and its job is to answer
**"is anything wrong?"** — rent that arrived on time is not information. This
month sits at the top, arrears next with the oldest first, and settled months
collapse behind a count.

**`house-rent` is sparse: one document per event, never per period.** The
schedule is computed by `rentSchedule()` from the lease terms; a document
exists only where something happened. Eight months of a term with three
payments recorded is three documents, not eight. The document id is
deterministic (`rent-<leaseId>-<period>`), so a write is an upsert and two
records for one month are impossible.

**The months with no document are the interesting ones** — `Due` before the
due date, `Late` after it. `expected` is snapshotted onto the document when
one is written, so editing the lease later cannot rewrite history; where no
document exists the lease's current rent is used.

`rentDueDay` is capped at 28 on both write and read, so February always has a
due date. Overpayment counts as `Received` with zero outstanding. `Waived` and
`Written-off` clear the amount, date and mode on save rather than leaving
stale values behind.

Deposit settlement lives on the lease (`depositDeducted`, `depositRefunded`)
rather than in its own collection — with one tenancy at a time there is
nothing a separate ledger would buy. Linking deductions to repair costs
arrives with L3.

## Lease mode (L0–L4 built)

A second module behind a header mode switch, persisted in `localStorage` under
`hl-mode`. Build mode keeps its five tabs; lease mode has four — Rent,
Repairs, Reports and Tenancy. Only tabs that exist are rendered; a disabled
tab teaches nothing. L5 is the deliberately-unbuilt list in
`LEASE_MODE_PLAN.md` §6.

Full design and the settled scope decisions are in `LEASE_MODE_PLAN.md`.

**Lease collections are private.** `house-tenants` and `house-leases` need a
token to *read* as well as write, because they hold a third party's name,
phone number and arrears history. `authedFetchAll()` is the read path;
`fetchAll()` (expenses, budgets) still sends no token and must stay that way.
Entering lease mode signed out prompts sign-in and resumes; a restored
`hl-mode=lease` with no valid session falls back to build.

⚠ **The Firestore rules are still the test-mode default and enforce none of
this.** They must be applied before the first real tenant record is written —
see `LEASE_MODE_PLAN.md` §3 for the block to paste.

**Derived, never stored:** lease status (except the `Draft` / `Terminated`
overrides in `statusOverride`) and tenant status. A status you have to
remember to update is a status that will be wrong.

**One tenancy at a time.** `findLeaseConflict()` compares date *ranges*, not
today's status, so a lease that clashes only in the future is still refused,
by name. Terminated leases never conflict.

**A renewal is a new document**, chained by `previousLeaseId`, pre-filled from
the previous term and starting the day after it ends. Rent is flat within a
term — that is what "renegotiated at renewal" means structurally, and it gives
a true tenancy history rather than one mutable record that forgets.

**Deposit custody uses `DEPOSIT_HOLDERS` (`Self` / `Runa`), deliberately
separate from `ACCT_CLR` (`Self` / `Reemon`).** A deposit is a liability held
by whoever holds it, not an expense account. Two similar-looking pairs, so
keep them apart.

Deleting a lease keeps an explicit confirmation rather than the undo toast —
unlike an expense row there is no undo path behind it.

### Repairs, and the one seam between the modules (L3)

`house-maintenance` holds what needs fixing: category, zone, priority, status,
vendor, cost. Vendor suggestions come from `house-expenses`, so a plumber you
already paid during the build is one tap away.

`repairToExpense()` is the only place lease mode writes into build data. It is
**opt-in per repair** — the toggle appears only once a cost is entered, and it
states what it will write before you tap Save. The entry it creates is always
`expenseType: 'Miscellaneous'`, `phase: 'Maintenance'`, zone taken from the
repair, so a tenancy repair can never eat into a construction budget.

Order matters: the repair is saved *first* so it has an id, then the expense is
created, then the repair is patched with the returned `expenseId`. Reversed,
one repair would produce two maintenance documents.

Deleting a repair leaves its expense alone — the money was still spent — and
the confirmation says so rather than leaving it to be discovered.

### Reports (L4)

The only screen that sums both modules, so every figure carries its direction:
`signed()` renders `+`/`−`, `dirClr()` colours it, and zero gets neither.

- **Financial year is Apr–Mar.** `fyOf('2026-03-31')` is 2025; `fyOf('2026-04-01')`
  is 2026. Never the calendar year.
- **Capital vs running cost.** `RUNNING_PHASES = ['Maintenance','Leasing']`.
  Those net off rent. Everything else is `buildCost()` — the denominator a
  yield is measured against, not a cost of the year.
- **Cash basis.** A receipt lands in the year the money arrived
  (`receivedDate`), falling back to the period's own month.
- **The year in progress is measured to today**, not to a March that has not
  happened, or the current year always looks like a bad one.
- **Occupancy merges lease ranges before counting**, so an overlap in old data
  cannot count a day twice. A `Terminated` lease has no stored end date, so it
  is counted only to the end of the last month rent was recorded for — and the
  screen says so rather than quietly overstating.

## Editable lists and printable statements (U30)

Two of `U30`'s three parts. The third, receipt attachments, needs Firebase
Storage and is still deferred.

### Editable lists — `house-config`

Categories, phases and zones ship as the constants in `JS-CONSTANTS` but can be
extended without a redeploy. `house-config` holds one document, `lists`, with
three string arrays: `phases`, `zones`, and `subcats` (each entry
`"Category::Subcategory"`, so a custom subcategory serialises flat — no nested
Firestore maps). `applyConfig()` merges them into the live constants **in
place**, rebuilding from a base snapshot each load so a removed custom entry
actually drops. Because it mutates the same array/object references, every
consumer that reads `PHASES`/`ZONES`/`CATEGORIES` picks the change up on its
next render with no wiring.

**Additive only, by design.** The built-ins are load-bearing —
`RUNNING_PHASES`, the repair→`Maintenance` seam, the `PHASE_CLR`/`CAT_CLR`
lookups, and every row already stored against them — so the editor extends but
never removes or renames them. A custom phase/category gets a neutral fallback
colour (`CUSTOM_CLR`), so a chip the code has no swatch for cannot crash.

Config is **public to read** (categories/phases/zones are not private) and, like
budgets, loads once on mount and on refresh — **never in the 60s poll**.
`fetchConfig()` *lists the collection* rather than GETting the single document,
because an empty collection answers `200` where a missing document answers `404`
— and a `404` shows up as a console error on every load until the first save.
The `ConfigEditor` modal is reached from the Phases and Zones tabs.

### Printable statements — print-to-PDF, no library

`JS-PDF-EXPORT`. The app carries no runtime dependencies, so "export to PDF" is
the browser's own print-to-PDF over a clean, self-contained HTML page. The
statement downloads as an `.html` file that auto-opens the print dialog; on an
iPhone it opens in Safari where Share → Print → Save as PDF does the same. Two
statements: a per-lease rent statement (Rent tab) and a per-year financial
statement (Reports tab). `taxCSV` and the annual statement share `taxRows()`, so
the CSV and the PDF cannot drift.

One trap: the statement embeds an auto-print `<script>`. Its closing tag is
assembled at runtime (`'<'+'/script>'`) so the literal never appears in the
source or the Babel-compiled output, where it would close the app's own
`<script>` block early. All interpolated data (tenant names, notes) is escaped.

## Deleting an entry

Delete is a **two-step, swipe-to-reveal** action, so a stray swipe can't
delete a row. Swiping a row left past the threshold *reveals* a persistent red
Delete button (`EntryRow`, `revealed` state); the delete only starts when that
button is tapped. A tap anywhere outside the row tucks the button away — which,
via an outside-tap capture listener, also means revealing one row dismisses any
other, so only one is ever open. Swipe-right → edit is unchanged.

Behind that tap the delete is **deferred, not performed-and-restored**: it
removes the row from the view and shows an undo toast for 5 seconds, and the
Firestore `DELETE` only fires when that window closes — so undo is purely local
and cannot fail. The pending row is filtered out of `exps` for every consumer,
so totals agree with what the toast says, and a pending delete is flushed on
tab hide, on unmount, and if a second delete starts.

## Export and analytics (build mode)

- **Export**: the Entries tab exports the current filtered/sorted view as CSV
  or as a printable **PDF expense report** (`expenseReportDoc`, `JS-PDF-EXPORT`)
  — summary, breakdowns by account/phase/category/top-vendors/payment-mode, and
  the line items. Same print-to-PDF mechanism as the lease statements.
- **Insights** (the former Timeline tab, `JS-INSIGHTS`): a slice control (range
  + account) feeds stat tiles, an SVG cumulative spend-over-time with the
  contract value as a dashed same-axis reference, the monthly bars, deep
  category/zone/phase drills, top vendors, and account/payment splits. Charts
  are hand-rolled SVG/CSS; colour follows the job (composition → ranked
  single-hue bars, two-way splits → the ACCT/MODE schemes) and reads on all six
  themes. Tap-to-inspect, not hover — the primary user is on a phone.

## Receipt attachments (U30, `JS-STORAGE`)

A build-mode expense can carry receipt files (phone photos or PDF invoices) in
**Firebase Storage**, reached over its REST API — no SDK; the same Identity
Toolkit id token that authorizes Firestore writes authorizes Storage (same GCP
project), so `authedFetch` is reused for uploads and deletes.

- **Public.** Receipts are world-readable: the download-token URL is stored on
  the expense doc (`attachments`, an array of `{url,path,name,type,size}`) and
  shown directly in an `<img>`. Storage rules gate only writes. Chosen with the
  user; a token URL is a shareable capability regardless.
- **Images are downscaled** in-browser (`downscaleImage`, `<canvas>`, ≤1600px /
  JPEG 0.82) before upload; PDFs go up as-is and show as a tile that opens in a
  new tab.
- **Save-then-patch**, like `repairToExpense`: the entry is saved first (so it
  has an id), then each file uploads to `house-receipts/<id>/…`, then
  `patchAttachments` writes the refs. An upload that fails (e.g. Storage not set
  up) never loses the entry — it saves and a toast says so.
- **Cleanup** is best-effort: removing a receipt in the form (or deleting the
  entry, via `commitDelete`) issues a Storage `DELETE`; an orphan is harmless.
- **Not polled** — attachments ride on the expense doc that's already fetched,
  so they add no reads (`read-cost.test.js` guards that Storage is never touched
  by the poll).

**Console prerequisites** (like the Firestore rules, these are done by hand and
version-controlled here): enable Storage, publish **`storage.rules`** (Storage
has its own rule file, separate from `firestore.rules`), and apply **`cors.json`**
to the bucket (`gcloud storage buckets update gs://<bucket> --cors-file=cors.json`)
so the browser can upload cross-origin. Confirm the bucket name and set it as
`FS_BUCKET` in `JS-STORAGE`. Until then uploads fail gracefully.

## Data note — the account split

Use these figures. They are what the per-row data actually sums to:

| Account | Total | Entries |
|---|---|---|
| Self | ₹63,73,628 | 65 |
| Reemon | ₹21,42,760 | 23 |
| **Total** | **₹85,16,388** | **88** |

`HOUSE_CONTEXT.md` states the split as Self ₹63,30,198 / Reemon ₹21,86,190 — a
₹43,430 difference. That figure is not reproducible from the per-row data and
is treated as an error in that summary. Entry counts and the grand total agree
across sources. **Do not change any row's `account` field to make the summary
match**, and do not reopen the reconciliation.

Caveat worth keeping: no single row equals ₹43,430 and no single Self↔Reemon
swap produces it; multi-row combinations were not exhaustively searched, so
"summary-level arithmetic error" is inference rather than proof. Neither figure
has been checked against the original bank statement. If the split ever needs
to be authoritative — for tax, or for splitting costs between family members —
verify against the statement, not against any of these documents.

## Testing

`npm run smoke` walks the whole app in headless Chromium at a 390px viewport
and asserts that the root element never empties and nothing throws. Firestore,
Identity Toolkit and fonts are stubbed — it never touches the live database.

**Run it before every deploy.** It exists because a shipped change deleted the
`ConfirmDialog` component while leaving a reference to it, so swiping a row
left threw during render, React unmounted the whole tree, and a blank page
reached production. Every feature had its own test; nothing exercised the app
as a whole. The smoke test is deliberately shallow and wide: it does not check
that features are *correct*, only that every screen renders and every control
can be operated. 107 steps, about 40 seconds.

It fails fast — once the root empties it reports the remaining steps as
skipped rather than waiting out a timeout on each.

### The correctness suites

`npm test` runs everything in `tests/` — narrow and deep, where the smoke test
is shallow and wide. 145 assertions across six suites.

| Suite | Guards |
|---|---|
| `rent.test.js` | Sparse schedule (3 documents → 8 months), Due/Late boundaries, overpayment, waiver clearing stale fields, deterministic upsert ids, deposit ledger, CSV |
| `repairs.test.js` | Priority sort, the opt-in expense seam, `Miscellaneous`/`Maintenance` tagging, save-then-patch ordering, delete leaving the expense alone |
| `reports.test.js` | Apr–Mar year boundaries, capital vs running cost, per-year net, seven occupancy edge cases, tax CSV |
| `read-cost.test.js` | Probe and reconcile counts, no collection joining the poll loop (incl. `house-config`), no token on expense reads |
| `config.test.js` | U30 editable lists: additive merge of custom categories/phases/zones, built-ins preserved, editor round-trips the three arrays back to `house-config/lists` |
| `attachments.test.js` | U30 receipts: create→upload→patch write shape (token, `house-receipts/<id>/` path, download URL), and remove-on-edit frees the Storage object |

`tests/harness.js` stubs the backend, serves React from `node_modules`, and
**pins the clock** — rent status, arrears, occupancy and the financial year are
all functions of "today", so an unpinned suite would start failing on a Tuesday
for no reason. `run-all.js` picks up any `*.test.js` automatically and exits
non-zero on failure.

`npm run check` is compile + smoke + suites, and is the gate before a deploy.

React is loaded from `node_modules` when present (a devDependency) so the test
works offline, falling back to the CDN otherwise. Playwright is resolved from
the local install or a global one.

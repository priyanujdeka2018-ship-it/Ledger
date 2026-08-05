# House Ledger — Handoff

Everything a fresh session needs to plan, build, verify and ship this app.
Written 2026-08-05, after lease mode L0–L4.

---

## 0. Read these first, in this order

| | File | Why |
|---|---|---|
| 1 | This file | State, commands, open work, the traps |
| 2 | `DEVELOPMENT.md` | The permanent reference: section index, constraints, auth, budgets, rent, lease mode, testing |
| 3 | `LEASE_MODE_PLAN.md` | Lease-mode design, the six settled scope decisions (§0), the L0–L5 breakdown (§6) |

`DEVELOPMENT.md` is the living doc — **update it when a decision changes**,
and treat this handoff as a snapshot that will go stale.

### ⚠ Two source documents are NOT in this repo

The original working brief (`CLAUDE.md`, with the B1–B3 bug list and the
U1–U30 UX list) and `HOUSE_ARCHITECTURE.md` were uploaded into a chat session,
not committed. `DEVELOPMENT.md:394` also cites a `HOUSE_CONTEXT.md` that is
not here.

A new session will not have them. Either re-upload them at the start, or —
better — commit them into `CCC/House/` so this stops recurring. Nothing below
depends on them; they are context, not specification.

---

## 1. What this is

A single-file React expense ledger for a house build in India, extended with a
second module for letting the finished house.

- **Live at** `https://priyanujdeka2018-ship-it.github.io/Ledger/CCC/House/house-ledger.html`
- **Primary user is on an iPhone.** Reason against a ~390px viewport; desktop is a bonus.
- **No bundler, no runtime dependencies.** React + ReactDOM come from a CDN as
  UMD globals. `compile.js` transforms JSX to `React.createElement` at build
  time. Babel-standalone in the browser is what made the page fail to load on
  iPhone Safari originally — **never reintroduce it**.
- **Firestore via the REST API only**, no Firebase SDK. Project `japan-2026-apr`.
  Auth is the Identity Toolkit REST API with Secure Token refresh.

### The two modes

| Mode | Tabs | Data |
|---|---|---|
| **Build** | Entries · Phases · Zones · Vendors · Timeline | `house-expenses`, `house-budgets` — **read-open**, no token on reads |
| **Lease** | Rent · Repairs · Reports · Tenancy | `house-tenants`, `house-leases`, `house-rent`, `house-maintenance` — **private**, token required to read |

Persisted in `localStorage` under `hl-mode`. Entering lease mode signed out
prompts for sign-in and resumes the action; a restored `hl-mode=lease` with no
valid session falls back to build.

---

## 2. Files

```
CCC/House/
├── house-ledger.jsx.html   ← EDIT THIS. JSX source, ~3,060 lines.
├── house-ledger.html       ← GENERATED and DEPLOYED. Never hand-edit.
├── compile.js              ← JSX → React.createElement, writes in place
├── smoke-test.js           ← 107-step whole-app walk
├── tests/
│   ├── harness.js          ← shared rig: stubbed backend, pinned clock, ok()
│   ├── rent.test.js        ← L2, 32 assertions
│   ├── repairs.test.js     ← L3, 31 assertions
│   ├── reports.test.js     ← L4, 40 assertions
│   ├── read-cost.test.js   ← Firestore bill + privacy boundary, 10 assertions
│   └── run-all.js
├── package.json
├── DEVELOPMENT.md
├── LEASE_MODE_PLAN.md
└── HANDOFF.md              ← this file
```

Both HTML files sit in the same directory; `compile.js` writes the output in
place, so a rebuild always reaches the deployed path.

### Navigating the source

The file is large. It is divided by section markers — **never hardcode line
numbers**, they shift on every edit.

```bash
grep -n "─── " house-ledger.jsx.html            # list every section
grep -n "─── JS-REPORTS-TAB ───" house-ledger.jsx.html
```

`DEVELOPMENT.md` has the full section table. Lease-mode sections:
`JS-LEASE-DATA`, `JS-LEASE-LOGIC`, `JS-RENT-DATA`, `JS-RENT-SCHEDULE`,
`JS-MAINT-DATA`, `JS-REPORTS`, then the component sections
`JS-RENT-FORM`/`JS-RENT-TAB`, `JS-REPAIR-FORM`/`JS-REPAIRS-TAB`,
`JS-REPORTS-TAB`, `JS-TENANT-FORM`/`JS-LEASE-FORM`, `JS-TENANCY-TAB`.

One exception to the "everything is in the babel block" rule: `JS-THEMES` now
lives in a plain `<script>` in `<head>` so the saved theme is applied before
first paint. `compile.js` leaves that block alone. Don't move it back.

---

## 3. The loop

```bash
cd CCC/House
npm install          # one-time

# edit house-ledger.jsx.html, then:
npm run check        # compile + smoke + all four suites   ← use this
npm run verify       # compile + smoke only (faster)
npm test             # the four suites only
```

`npm run check` is the gate. It exits non-zero on any failure.

Compile output should report **0 Babel references**. If any appear, a
babel-standalone script tag was reintroduced — remove it.

Commit both HTML files together:

```bash
cd /home/user/Ledger          # NOT CCC/House — `git add CCC/House` fails from inside it
git add CCC/House
git commit
git push -u origin <branch>
```

### Deploying

GitHub Pages is served from `main` via `.github/workflows/jekyll-docker.yml`,
which is **`workflow_dispatch` only** — it does not run on push. So:

1. Merge the branch into `main` (PR, or fast-forward).
2. Manually trigger the *Jekyll site CI* workflow.
3. Confirm the run went green before claiming the deploy landed.

---

## 4. Current state

**Branch `claude/new-session-71reme` is 6 commits ahead of `origin/main` and
has no PR open.** Everything through L4 is on it, pushed, unmerged.

```
90314da  Lease mode L4: yield, per-FY net position, occupancy, tax export
47b9a23  Lease mode L3: repairs + theme flash fix
5c534a1  Lease mode L2: rent schedule, receipts, arrears, deposit ledger
a24d2df  Lease mode L0+L1: mode switch, private collections, tenancy, leases
36087e4  Plan: lock lease-mode scope decisions
2bc1e07  Plan: lease mode architecture
─────────  origin/main is at a012744 (PR #7)
```

Merged and live on `main`: the B1–B3 bug fixes, the whole U-series except the
items blocked on Firebase Storage, per-phase budgets, the single-sheet entry
form, write lockdown behind sign-in, the undo toast, the cheap sync,
pull-to-refresh, the vendor analytics tier, and the smoke test.

**Not live:** all of lease mode.

Verified green at the time of writing: compile clean, smoke 107/107, suites
113/113.

---

## 5. Hard rules

Break one of these and something quietly goes wrong that no screen shows.

1. **Never hand-edit `house-ledger.html`.** It is overwritten every build.
2. **No Babel in the browser.** Runtime transpilation broke iPhone Safari.
3. **Do not make sync chattier.** The 60s tick is a *change probe*
   (`:runQuery` on `updatedAt > lastSeen`) — 1 read when nothing moved against
   88 for a full fetch. A full reconcile runs every 10 minutes, on manual
   refresh, and on tab return. Polling stops while the tab is hidden.
   ~13,968 reads/day/tab against a 50,000/day quota. `read-cost.test.js`
   guards this; adding a collection to the poll loop will fail it.
4. **Expense reads send no token.** The ledger is read-open by design.
   `fetchAll()` for public data, `authedFetchAll()` for lease collections.
   Also guarded by `read-cost.test.js`.
5. **`undefined` breaks Firestore writes.** Every string field in a `toFS*()`
   must default to `''`.
6. **Any new colour goes in all six theme objects.** Three are dark; a
   hardcoded light value is unreadable on them.
7. **Vendor aggregation groups by `vendor`, never `transferTo`.** Several
   payments went through intermediaries; grouping by recipient fragments one
   contractor across four names.
8. **`fmtAmt()` for aggregates, `fmtFull()` for line items.** Abbreviate
   totals, never the reconciliation unit. Indian conventions throughout
   (`en-IN`, lakhs and crores).
9. **A repair-derived expense is always `expenseType: Miscellaneous`,
   `phase: Maintenance`.** Never `Contract` — it must not touch a construction
   budget. `repairs.test.js` asserts this.
10. **Do not reopen the account-split reconciliation.** See
    `DEVELOPMENT.md` § "Data note". Do not edit any row's `account` field to
    make a summary match.

---

## 6. Open work

### Blocking, before real tenant data

**The Firestore rules are still the test-mode default** —
`allow read, write: if request.time < timestamp.date(2026, 12, 30)`. That is
unrestricted read *and write* by anyone until that date, then everything
denied including reads.

The user deferred this deliberately ("no one else is using the live app other
than me"), which is fine for build data — but lease mode stores a third
party's name, phone number and arrears history, and the rules enforce none of
the privacy the code assumes. **Apply the rules before the first real tenant
record is written.** The block to paste is in `DEVELOPMENT.md` §"Rules to
paste in the Firebase console"; replace the placeholder emails with the real
accounts.

Separately: the `expenses` collection belongs to the Japan trip app and still
carries the 2026-12-30 expiry. That app stops working on that date. Separate
decision, not this app's.

### Next features

**L5 is the deliberately-unbuilt list** (`LEASE_MODE_PLAN.md` §6). Each has a
real blocker, so don't start one without addressing it:

| | Feature | Blocker |
|---|---|---|
| L5.1 | Rent-due reminders | Needs push; a static page cannot. A tab badge is the honest version. |
| L5.2 | Agreement / receipt documents | Needs Firebase Storage — same blocker as the U-series item |
| L5.3 | Tenant-facing view | Needs per-tenant auth; genuinely separate-page territory |

### Settled, do not relitigate

From `LEASE_MODE_PLAN.md` §0, answered directly by the user:

- **One unit**, not multiple lettable units
- **No** sub-letting / multiple concurrent tenancies — one tenancy at a time
- Rent is **flat within a term**, renegotiated at renewal (a renewal is a new
  document chained by `previousLeaseId`, not an edit). No escalation fields.
- Deposit holders are **Self / Runa** — deliberately separate from the expense
  accounts `Self / Reemon`. Two similar-looking pairs; keep them apart.
- **No** tenant-facing access
- ID reference is **optional** and empty by default

### Rejected, with reasons

- **Splitting the page in two.** Measured: shared code is 47.1 KB of 195 KB
  (30%), so splitting duplicates 47 KB and *raises* total bytes. Gzip was
  31→42 KB at the time of that measurement; median time-to-first-row at 6× CPU throttle moved 1742→1844 ms,
  inside run-to-run spread. Size is not the problem. The theme flash was the
  real cold-load complaint and it is fixed.
- **A real-time listener.** Unavailable without the Firebase SDK, which this
  app deliberately does without. The change probe is the honest alternative.
- **Deriving the overall budget by summing phase budgets.** Budgeting three of
  ten phases would silently collapse the headline figure. `CONTRACT_BUDGET` is
  the real contract value; phase budgets are allocations against it.

---

## 7. Testing

Two layers, and they do different jobs.

### `npm run smoke` — shallow and wide

Walks every screen and operates every control in headless Chromium at 390px,
asserting only that the root never empties and nothing throws. 107 steps,
~40 seconds. It does **not** check that anything is correct.

It exists because a shipped change deleted the `ConfirmDialog` component while
leaving a reference to it: swiping a row left threw during render, React
unmounted the whole tree, and a blank page was live for ~18 minutes. Every
feature had its own test; nothing exercised the app as a whole.

**When you add a screen or a control, add a smoke step for it.** That is the
whole discipline. The gap that let the crash through was that no suite swiped
*left*.

### `npm test` — narrow and deep

Four suites, 113 assertions, each checking that specific arithmetic or a
specific write is right.

| Suite | Guards |
|---|---|
| `rent.test.js` | Sparse schedule (3 documents → 8 months), Due/Late boundaries, overpayment, waiver clearing stale fields, deterministic upsert ids, deposit ledger, CSV |
| `repairs.test.js` | Priority sort, the opt-in expense seam, `Miscellaneous`/`Maintenance` tagging, save-then-patch ordering, delete leaving the expense alone |
| `reports.test.js` | Apr–Mar year boundaries, capital vs running cost, per-year net, seven occupancy edge cases, tax CSV |
| `read-cost.test.js` | Probe/reconcile counts, no collection joining the poll loop, no token on expense reads |

The harness (`tests/harness.js`) stubs Firestore, Identity Toolkit and fonts —
**no suite ever touches the live database** — serves React from
`../node_modules` so it works offline, and **pins the clock**. Rent status,
arrears, occupancy and the financial year are all functions of "today"; an
unpinned suite would start failing on a Tuesday for no reason.

To add a suite: copy the shape of `reports.test.js`, `require('./harness')`,
call `open({ docs, today, mode })`, assert with `ok(label, got, want)`, end
with `finish(name)`. `run-all.js` picks up any `*.test.js` automatically.

### Writing tests that actually prove something

Three failures from this project's own history, worth not repeating:

- A pull-to-refresh guard "passed" while `scrollY` was 0 — the 3-row fixture
  could not scroll. Fixed by adding 30 filler rows so it genuinely scrolls.
- A summary line printed a hardcoded `true` for "only 3 stored docs, 8 rows
  shown". Replaced with a real measurement.
- A suite's own router had no `house-maintenance` bucket, so a new fetch fell
  into the expenses branch and the suite reported "token sent on expense
  reads". The test was wrong, not the app — **check the fixture before
  believing a failure.**

### Tooling

- Playwright resolves from the local install or `/opt/node22/lib/node_modules/playwright`.
- React UMD builds come from `CCC/House/node_modules/{react,react-dom}/umd/`.
  Resolved by path, not `require.resolve` — React's `exports` map hides the
  `umd/` subpath.
- Screenshots: `page.screenshot({ path })` at 390×844, `deviceScaleFactor: 2`.
  **Take them.** Screenshots caught a Renew button offered on ended historical
  terms, a missing delete confirmation, a duplicated month row, and a category
  strip that read as a second progress bar.
  `fullPage: true` floats the fixed header into the middle of the image — scroll
  and take viewport shots instead.

---

## 8. Things that bit

- **`git add CCC/House` fails when the working directory is already
  `CCC/House`.** `cd /home/user/Ledger` first.
- **Python heredoc edits fail on exact-whitespace mismatches.** Grep the real
  text first rather than retyping indentation from memory.
- **Running the smoke test against a broken build used to take >2 minutes**
  because each dead step waited the 30s default. It now sets a 4s default
  timeout and skips remaining steps once the root empties.
- **Section splices are how the production crash happened.** Deleting a range
  between two markers removed an intervening section that was still
  referenced. After any splice, `grep` for references to what you removed.
- **A mode switch must land on a tab that exists.** Returning to build with
  `tab='tenancy'` rendered an empty body. `switchMode` now coerces:
  `setTab(t => BUILD_TABS.some(x => x.id === t) ? t : 'entries')`. Same on the
  lease side. Adding a tab to one mode means checking both.

---

## 9. Facts you will need

| | |
|---|---|
| Firebase project | `japan-2026-apr` |
| Collections | `house-expenses`, `house-budgets`, `house-tenants`, `house-leases`, `house-rent`, `house-maintenance` |
| `localStorage` keys | `hl-auth`, `hl-mode`, `hl-theme` |
| Contract budget | `CONTRACT_BUDGET = 7537510` |
| Ledger totals | Self ₹63,73,628 (65) · Reemon ₹21,42,760 (23) · **₹85,16,388 (88)** |
| Themes | Six, three of them dark; default `blueprint` |
| Deposit holders | `Self` / `Runa` |
| Expense accounts | `Self` / `Reemon` |
| Running-cost phases | `Maintenance`, `Leasing` — everything else is capital |
| Financial year | Apr–Mar. `fyOf('2026-03-31') === 2025` |
| Compiled size | ~231 KB (~49 KB gzipped) |

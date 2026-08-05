<!-- ARCHIVED. Committed 2026-08-05, unchanged from the original upload. -->

> **Historical document**, corrected April 2026 and accurate for that point.
> Kept for the data model, the constants, the colour systems and the
> intermediary-payment rationale, which all still hold.
>
> **Superseded where it describes what is missing.** Current truth is
> `../HANDOFF.md` and `../DEVELOPMENT.md`. Since this was written:
>
> - `house-budgets` is in use — per-phase budgets with variance shipped, and
>   there is a budget editor. The "no BudgetBar or BudgetForm" note is stale.
> - The entry form is one scrollable sheet, not three steps.
> - Polling is a change probe plus a periodic reconcile, not a 60s full fetch.
> - `syncStatus` has a `'loading'` state; the dot is no longer green before
>   the first fetch resolves.
> - Auth exists: Identity Toolkit sign-in, writes locked, reads open.
> - Four more collections exist for lease mode: `house-tenants`,
>   `house-leases`, `house-rent`, `house-maintenance`.
> - Paths are `CCC/House/`, not `src/` and `dist/`.
> - Most of "Deferred Features" is now built, including lease mode.

---

# House Construction Ledger — Architecture Reference

> Technical reference for the house construction expense tracker.
> **Corrected April 2026** to match the deployed implementation. Earlier
> revisions of this document described a Babel-standalone runtime, `FlipCard`
> hero cards, a hexagon theme picker, and a budget system — none of which exist
> in the shipped app. Those descriptions have been removed. The code in
> `src/house-ledger.jsx.html` is the source of truth; if this file disagrees
> with it, the code wins.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | React 18 + ReactDOM via CDN (UMD globals) | Single-file distribution, no bundler |
| Build | `compile.js` — Babel transforms JSX → `React.createElement` **at build time** | Babel standalone (~800KB) silently failed to load on iPhone Safari. Pre-compiling drops the deployed file from ~870KB to ~72KB with zero runtime transpilation. |
| Database | Firebase Firestore, REST API only (no SDK) | Multi-device family sync, minimal payload |
| Fonts | Nunito (body) + Playfair Display (numerals/headers) | Warm, readable; serif numerals give figures weight |
| Storage | `localStorage` | Theme preference, active user name |
| Currency | INR only | Domestic project, no FX |

**There is a build step.** Edit `src/house-ledger.jsx.html`, run `node compile.js`,
deploy `dist/house-ledger.html`. Never hand-edit the compiled output — it is
overwritten on every build. Do not reintroduce a runtime transpiler.

---

## Firebase Config

```
Project ID:   japan-2026-apr
API Key:      AIzaSyD372bOo6NQR6VxB-_kkv4zfLNt4B5HaAc
```

The project ID is a static identifier named for its creation date. It does not
expire and has nothing to do with the house project timeline.

The API key is public by design — it identifies the project, it does not
authorise anything. **Firestore security rules are what actually protect the
data.** If the project is in test mode (`allow read, write: if true`), anyone
who views source on the public GitHub Pages site can read, rewrite, or delete
every entry. Verify the rules before adding more real data.

### Collections

| Collection | Purpose | Status |
|---|---|---|
| `expenses` | Japan trip ledger — **DO NOT TOUCH** | Separate app, shares the project only |
| `house-expenses` | All house entries | Primary — 88 documents, ₹85,16,388. If the app totals ₹84,16,388, row 37 is missing; re-run the seeder. |
| `house-budgets` | Reserved for per-phase budgets | **Created but unused.** Budget is currently the hardcoded `CONTRACT_BUDGET` constant. |

---

## Data Model

Each `house-expenses` document:

| Field | Type | Notes |
|---|---|---|
| `date` | string | `YYYY-MM-DD`, sorts lexically |
| `amount` | number | INR |
| `vendor` | string | Who the money was *for* |
| `transferTo` | string | Who it was *sent to* — differs for intermediary payments |
| `account` | string | `Self` (Jiten) or `Reemon` (Priyanuj) |
| `category` | string | Key of `CATEGORIES` |
| `subcategory` | string | Member of `CATEGORIES[category]` |
| `description` | string | Free text |
| `phase` | string | Member of `PHASES` |
| `zone` | string | Member of `ZONES` |
| `expenseType` | string | `Contract` / `Fee` / `Miscellaneous` — only `Contract` counts against budget |
| `paymentMode` | string | Cash, NEFT, GPay, UPI, IMPS |
| `status` | string | Paid / Partial / Pending / Overdue |
| `invoiceRef` | string | Optional |
| `notes` | string | Optional |
| `loggedBy` | string | Family member name, or `Seed` |
| `updatedAt` | string | ISO timestamp |

### Two rules that bite

**Undefined breaks writes.** Any string field that could be `undefined` must
default to `''` in `toFS()`. Firestore rejects unset types with an error that
does not name the offending field. `description`, `invoiceRef`, and `notes` all
carry `|| ''` for this reason.

**The intermediary pattern.** Several payments to the mason Mewalal Sharma were
routed through third parties — Bharti Pradhan, Foudo Chetri, Afrina Begum,
Suresh Prasad. `vendor` stays Mewalal Sharma; `transferTo` records the actual
recipient. **Vendor aggregation must group by `vendor`, never `transferTo`**, or
one contractor's spend fragments across four names.

---

## Constants

Defined in the `JS-CONSTANTS` section.

- `PHASES` — 10 values, Pre-Construction → Leasing. Ordered; drives display order.
- `ZONES` — 8 values, Whole House → Old House.
- `CATEGORIES` — object mapping 12 category keys to subcategory arrays.
- `PAYMENT_MODES` — Cash, NEFT, GPay, UPI, IMPS.
- `EXPENSE_TYPES` — Contract, Fee, Miscellaneous.
- `STATUSES` — Paid, Partial, Pending, Overdue.
- `FAMILY` — Jiten, Runa, Priyanuj, Devanuj.
- `CONTRACT_BUDGET` — `7537510`. A single hardcoded number; there is no budget UI.

---

## Colour Systems

Three lookup objects in `JS-PHASE-CAT-ACCT-CLR`, each mapping a value to
`{bg, text, dot}`:

- `PHASE_CLR` — one entry per phase
- `CAT_CLR` — one entry per category
- `ACCT_CLR` — Self (blue) / Reemon (pink)

`bg` and `text` are for chips; `dot` is the saturated version for bars and
markers.

**These are hardcoded hex values, not theme variables.** They were chosen to
read acceptably on both light and dark backgrounds. Any new semantic colour
should follow the same pattern rather than being added to the theme objects.

---

## Theme System

Six themes in `JS-THEMES`: `blueprint` (default), `sandstone`, `concrete`,
`garden`, `mahogany`, `nightwork`. Three are dark (`concrete`, `mahogany`,
`nightwork`).

Each theme is a flat object of CSS custom property values. `applyTheme(id)`
writes every string field to `documentElement.style` as `--{key}` and persists
the choice to `localStorage` under `hl-theme`.

**Any new colour must be added to all six theme objects.** A hardcoded
light-mode value will be invisible or unreadable on the three dark themes.

The picker (`ThemePicker`) is a three-column grid of cards showing an emoji and
the theme name. It is not a hexagon wheel.

---

## Component Architecture

All components live in one file, in the order listed. Find any of them with
`grep -n "─── JS-COMPONENT-NAME ───" src/house-ledger.jsx.html`.

| Component | Purpose |
|---|---|
| `Header` | Sync dot, refresh, theme button, user switcher dropdown |
| `HeroSpendCard` | Total spent. **Tap expands** to contract vs non-contract, budget bar, remaining |
| `HeroAccountCard` | Self vs Reemon totals with split bar. **Tap expands** to entry counts and navigation buttons |
| `TabBar` | Fixed bottom nav, 5 tabs |
| `SubtotalBar` | Filtered-view subtotal with breadcrumb label |
| `EntryRow` | One entry. Tap expands detail grid; horizontal swipe >60px triggers edit (right) or delete (left) |
| `EntriesTab` | List + search + active filter chip + subtotal |
| `OverviewCards` | Shared card renderer for Phases and Zones tabs |
| `PhasesTab` | **2 levels**: phase overview → zones within phase → navigates to Entries tab |
| `ZonesTab` | **2 levels**: zone overview → phases within zone → navigates to Entries tab |
| `VendorsTab` | Grouped by `vendor`. Total, count, last payment, intermediary list, payment modes |
| `TimelineTab` | Monthly stacked bars, toggle by phase / by account, quarter summary below |
| `EntryForm` | 3-step modal, add and edit |
| `ConfirmDialog` | Delete confirmation |
| `ThemePicker` | 3-column theme grid |
| `App` | State, data loading, routing |

There is **no** `SwipeRow` component — swipe handling is inline in `EntryRow`.
There is **no** `FlipCard` — hero cards expand rather than flip.
There is **no** `BudgetBar` or `BudgetForm` — the budget system was never built.

### App-level state

```js
const [exps, setExps]                      // all Firestore entries
const [tab, setTab]                        // entries|phases|zones|vendors|timeline
const [activeFilter, setActiveFilter]      // {account?, phase?, zone?, vendor?, category?, dateRange?}
const [themeId, setThemeId]                // persisted to localStorage
const [expandId, setExpandId]              // id of expanded entry row
const [showForm, setShowForm]
const [editEntry, setEditEntry]            // entry being edited, or null for new
const [deleteTarget, setDeleteTarget]      // entry pending delete confirmation
const [showThemePicker, setShowThemePicker]
const [syncStatus, setSyncStatus]          // 'live' | 'err'
const [userName, setUserName]              // persisted to localStorage
```

Form step state is local to `EntryForm`, not app-level.

### Cross-tab navigation

`navigateToEntries(filter)` sets `activeFilter`, switches to the Entries tab,
and clears `expandId`. Called from `HeroAccountCard`, `PhasesTab` level 2,
`ZonesTab` level 2, `VendorsTab`, and `TimelineTab` bar taps.

---

## Entry Form — 3-Step Flow

| Step | Fields | Gate to advance |
|---|---|---|
| 1 | date, amount, vendor (datalist of existing), transferTo, account | date + amount + vendor |
| 2 | category, subcategory (dependent), phase, zone, expenseType | category + subcategory + phase |
| 3 | paymentMode, invoiceRef, notes, status | none |

`transferTo` mirrors `vendor` as you type, until edited. Changing `category`
clears `subcategory`. Edit mode pre-fills every step from the existing entry.

The gate currently disables the Next button without explaining which field is
missing.

---

## Polling & Sync

| What | Behaviour |
|---|---|
| Firestore `house-expenses` | Polled every **60 seconds**, paused entirely while the tab is hidden |
| On tab return | Immediate refetch via `visibilitychange` |
| Manual refresh | ↻ button in header |

**Do not shorten the interval.** At the original 10 seconds, 88 documents
produced roughly 760,000 reads per day per open tab against a 50,000/day free
quota — exhausted in about 95 minutes of a single tab left open. If the ledger
grows past a few hundred entries, move to the Firestore real-time listener
rather than polling harder.

Sync indicator: pulsing green dot (live) or red dot (error). There is no
syncing/spinner state, and `syncStatus` initialises to `'live'` before the
first fetch resolves — so the dot is green while the list is still empty.

---

## Validation

Implemented in `EntryForm`: presence checks only (date, amount, vendor on step 1;
category, subcategory, phase on step 2).

**Not implemented** — specified but never built:

- `date` must not be in the future
- `amount` must be positive
- Duplicate detection on `date + amount + vendor + category`, warning the user
  but allowing override

Duplicate detection matters most: a ledger reconciled against bank statements
across years will eventually have the same payment logged twice, and nothing
currently catches it.

---

## Design Principles

- **Mobile-first, iPhone-primary.** Reason against a ~390px viewport.
- **One file, no bundler.** React from CDN, everything else hand-rolled.
- **Abbreviate aggregates, not line items.** `fmtAmt()` gives ₹86.16L for
  summaries; `fmtFull()` gives ₹86,16,388 where exactness matters.
- **Indian conventions throughout.** `en-IN` grouping, lakhs and crores, never
  thousands and millions.
- **Small verifiable diffs.** Compile and syntax-check after each change rather
  than batching unverified edits.

---

## Deferred Features

Nothing below is built. Ordered roughly by value.

**Near term**
- Vendor-based autofill: prefill classification from the vendor's most recent entry
- Live amount echo under the input (`₹1,00,000 (1L)`) to catch zero-count errors
- CSV export of the current filtered view
- Sort control on the entries list
- Surface `status` and `loggedBy` in the UI

**Per-phase budgets**
Activate the `house-budgets` collection: budget per phase with variance against
actual, replacing the single `CONTRACT_BUDGET` constant. This is the change that
makes the Phases tab decision-useful rather than descriptive.

**Analytics**
- Vendor detail view with payment history
- Intermediary payment tree (Mewalal → who paid how much via whom)
- Payment mode breakdown

**Lease mode**
New `house-leases` collection; tenant records, rent expected vs received,
maintenance requests linked to lease, auto-tagging expenses to the Leasing phase.

**Long term**
Receipt attachments via Firebase Storage, PDF/Excel export, Firestore-hosted
config so categories and phases are editable without a code change,
multi-property support.

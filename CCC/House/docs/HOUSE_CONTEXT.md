<!-- ARCHIVED. Committed 2026-08-05, unchanged from the original upload. -->

> **Historical document.** Kept for the vendor table, the intermediary payment
> routes, the phase and quarter history, and the decision rationale — all of
> which still hold and are not recorded anywhere else.
>
> ⚠ **One figure in here is wrong and must not be propagated.** The "By
> Account" split of Self ₹63,30,198 / Reemon ₹21,86,190 is not reproducible
> from the per-row data, which sums to **Self ₹63,73,628 / Reemon
> ₹21,42,760** — a ₹43,430 difference. Entry counts (65/23) and the grand
> total (₹85,16,388) agree across every source. Treat the split above as a
> summary-level error, use the per-row figures, and **do not edit any row's
> `account` field to make this table match.** See `../DEVELOPMENT.md`
> § "Data note — the account split" for the full reasoning and its limits.
>
> Also superseded: "Phase 0 — Planning (current)" is long past, the 3-step
> form is now a single sheet, and `house-leases` is no longer "future" —
> lease mode is built. Current truth is `../HANDOFF.md`.

---

# House Construction Ledger — Project Context
> Reference file for new Claude conversations in this project.

---

## The Project

**Residential house construction, furnishing, landscaping, and leasing tracker.**

Location: Dibrugarh, Assam, India
Currency: INR only (no FX conversion needed)
Timeline: July 2024 – ongoing (open-ended, multi-year)
Status as of April 2026: Structure and finishing largely complete, boundary wall done, entering furnishing/landscaping phases.

### Family Accounts

| Account | Person | Role |
|---|---|---|
| Self | Jiten Deka | Primary family account — 74.3% of spend |
| Reemon | Priyanuj Deka | Secondary family account — 25.7% of spend |

Additional family members who may log entries: Runa Deka, Devanuj Deka.

Contact: +91 9426838735 · ddevanuj@gmail.com

---

## Financial Summary (as of April 2026)

### Totals
- **Total spend:** ₹85,16,388 (~₹85.16 lakhs)
- **88 transactions** from 11 July 2024 to 17 April 2026
- **Contract spend:** ₹74,18,728 (98.4% of ₹75,37,510 contract budget)
- **Non-contract spend:** ₹10,97,660 (fees + miscellaneous)
- **Contract budget remaining:** ₹1,18,782 (1.6%)

### By Account
- Self (Jiten): ₹63,30,198 — 65 transactions
- Reemon (Priyanuj): ₹21,86,190 — 23 transactions

### By Category (top-level, mapped to new taxonomy)
| Category | Amount | % | Entries |
|---|---|---|---|
| Construction Materials | ₹27,68,275 | 32.5% | 25 |
| Labour & Contractors | ₹32,71,600 | 38.4% | 38 |
| Professional Fees | ₹1,10,290 | 1.3% | 6 |
| Fixtures & Installations | ₹5,86,800 | 6.9% | 8 |
| Site Work | ₹6,29,500 | 7.4% | 7 |
| Miscellaneous | ₹11,49,923 | 13.5% | 4 |

### By Phase
| Phase | Approx. Period | Character |
|---|---|---|
| Pre-Construction | Jul 2024 – Nov 2024 | Fees, tree cutting, land prep, filling |
| Foundation | Mar 2025 | Septic tank, plinth wall |
| Structure | Nov 2024 – Sep 2025 | Core construction — heaviest spend |
| Finishing | Sep 2025 – Apr 2026 | Tiles, electricals, painting, windows, cupboards |
| Boundary & External | Jan 2026 – Feb 2026 | Boundary wall construction |

### By Quarter (cumulative)
| Quarter | Period Spend | Cumulative | % of Contract |
|---|---|---|---|
| Q3 2024 | ₹0.70L | ₹0.70L | — |
| Q4 2024 | ₹10.36L | ₹11.06L | 11.6% |
| Q1 2025 | ₹10.85L | ₹21.91L | 24.4% |
| Q2 2025 | ₹8.28L | ₹30.19L | 31.1% |
| Q3 2025 | ₹15.96L | ₹46.15L | 50.4% |
| Q4 2025 | ₹18.77L | ₹64.92L | 72.8% |
| Q1 2026 | ₹17.24L | ₹82.16L | 88.3% |
| Q2 2026 | ₹3.00L | ₹85.16L | 98.4% |

### By Payment Mode
| Mode | Amount | % |
|---|---|---|
| NEFT | ₹55,36,118 | 65.0% |
| Cash | ₹22,72,000 | 26.7% |
| UPI | ₹2,45,800 | 2.9% |
| GPay | ₹2,37,000 | 2.8% |
| IMPS | ₹2,25,362 | 2.6% |

---

## Key Vendors

### Primary Contractors & Suppliers

| Vendor | Total Paid | Role | Notes |
|---|---|---|---|
| Mewalal Sharma | ₹24,20,000 | Primary mason/civil contractor | Paid directly and via 5 intermediaries |
| Laxmi Hardware | ₹23,07,420 | Hardware & building materials | Largest material supplier |
| Kejriwal Brothers | ₹6,16,916 | Sanitary & plumbing fittings | Includes ₹1 test transaction |
| Foudo Chetri | ₹5,00,000 | Intermediary for Mewalal | Labour payments routed through |
| A Brick Field | ₹4,94,100 | Bricks | All NEFT payments |
| Suresh Prasad | ₹3,94,500 | Labour (Mewalal intermediary + boundary wall) | Mixed: own work + intermediary |
| Ravi Kumar Sharma | ₹3,50,962 | Carpentry — cupboards & windows | First Floor focus |
| Afrina Begum | ₹2,30,000 | Intermediary for Mewalal | Labour payments routed through |
| Kavita Shah | ₹2,16,800 | Electrical fittings | |
| Agarwal Timber | ₹2,02,262 | Timber supplier | |
| Antriksh Ojha | ₹2,00,000 | Painting contractor | |
| Bharti Pradhan | ₹2,00,000 | Intermediary for Mewalal | Labour payments routed through |
| Shambhu Bhagat | ₹1,48,200 | Electrical contractor + materials | Does both work and supply |
| Chanchal | ₹75,000 | Architect/Consultant | |

### Intermediary Payment Pattern

Mewalal Sharma receives payments through multiple bank accounts. The data model uses `vendor` (ultimate payee) and `transferTo` (name on transaction) to track this:

| transferTo | vendor | Total via this route |
|---|---|---|
| Mewalal Sharma (direct) | Mewalal Sharma | ₹14,20,000 |
| Foudo Chetri | Mewalal Sharma | ₹5,00,000 |
| Afrina Begum | Mewalal Sharma | ₹2,30,000 |
| Bharti Pradhan | Mewalal Sharma | ₹2,00,000 |
| Suresh Prasad | Mewalal Sharma | ₹1,61,000 |

Delivery notes like "Through Gitika", "Through Bob", "handed to Sanu Supervisor" are captured in the `notes` field — they indicate physical delivery of cash, not separate intermediary accounts.

---

## Build History

### Phase 0 — Planning & Analysis (current)
- Analysed 88-entry transaction statement PDF
- Designed category/subcategory taxonomy (12 categories, ~40 subcategories)
- Defined data model (16 fields for expenses, separate budgets collection)
- Mapped all 88 entries to new taxonomy with confirmed category, phase, zone, vendor assignments
- Resolved all ambiguities: Sutradhar = General Labour, Kejriwal = Sanitary & Plumbing, Kavita Shah = Electrical Fittings (not tiles), Shambhu = both materials + electrical work
- Designed 5-tab layout, 2 hero cards, 3-step entry form, 6-theme system
- Decided on Firestore REST on existing `japan-2026-apr` project with new collections

---

## Key Decisions & Rationale

### INR only — no FX system
Unlike the Japan trip ledger, this project is entirely domestic. Eliminates FX fetching, conversion logic, currency flip cards, and the open.er-api.com dependency. Simplifies data model and hero cards.

### Same Firebase project, separate collections
Reuses `japan-2026-apr` project (same API key, same config). New collections: `house-expenses`, `house-budgets`, `house-leases` (future). Old `expenses` collection for Japan trip is **never touched**. Zero risk to existing data.

### vendor + transferTo dual fields
The intermediary payment pattern (Mewalal paid via Foudo, Afrina, Bharti, Suresh) requires distinguishing "who the bank transfer went to" from "who the money is actually for." Without this, vendor drill-down would show 6 separate small payees instead of one ₹24.20L contractor. The `transferTo` field defaults to `vendor` unless explicitly changed.

### Category restructuring from flat to tree
The original transaction data had flat categories that mixed scope/zone with expense type (e.g., "Boundary wall" as a category, "First floor cupboard" as a category, "Electricals" including tiles). The new tree model separates what was bought (category) from where it went (zone) and when (phase). This enables proper drill-down analytics.

### Kavita Shah = Electrical Fittings, not tiles
Original data categorized Kavita Shah as "Electricals" with remark "Tiles." User confirmed the category is Electricals — Kavita Shah supplies electrical fittings, not tiles. The "Tiles" remark was misleading in the source data.

### expenseType preserved as budget filter
The original Contract/Fee/Miscellaneous split is critical because the ₹75.37L contract budget only counts Contract entries. The budget system filters by expenseType to calculate contract utilization separately from total spend.

### Multi-step form (3 steps)
16 fields in a single form would be overwhelming on mobile. Split into: Step 1 (money: date, amount, vendor, transferTo, account), Step 2 (classification: category→subcategory, phase, zone, expenseType), Step 3 (metadata: paymentMode, invoiceRef, notes, status).

### Firestore over artifact storage
Artifact persistent storage (`window.storage`) was considered. Rejected because: no multi-device sync (critical for 4 family members), data tied to Claude environment only, no independent querying/export. Firestore gives proven multi-device sync, REST accessibility, and the family already has it working from the Japan ledger.

### Budget form in-app, not pre-seeded
No budget figures exist yet. The app provides a budget management form accessible from Phases and Zones tabs. Budgets can be set at three tiers: phase-only, zone-only, and phase+zone intersection.

### ₹1 test transaction — kept
Row 53 (Kejriwal Brothers, ₹1, 18 Nov 2025) is a NEFT test transfer. Mapped as Miscellaneous > Test Transaction. Not excluded from totals — treated like any other entry per user decision.

### Suresh Prasad row 86 — real expense
₹83,500 on 16 Apr 2026 with remark "Reemon account transfer." Confirmed as a real expense (construction material), not an inter-account transfer. Stays in totals.

---

## Working Patterns

### How Priyanuj works
- Always requests **"don't build yet"** before any code output — uses it to lock requirements first. Respect this unconditionally.
- Gives directional feedback concisely
- Plans requirements exhaustively via structured Q&A before any build step
- Provides executive summaries with pre-analysed data breakdowns
- New expense logging happens in fresh project conversations (to avoid context loss)

### When logging expenses
1. User shares receipt / transaction detail in a new project conversation
2. Claude extracts all fields, presents them clearly for confirmation
3. **Duplicate check**: fetch Firestore `house-expenses`, match on `date + amount + vendor + category`
4. If any field is uncertain — **ask**, never assume
5. Write via REST POST: `exp-{Date.now()}` as document ID
6. `loggedBy` = the person sharing in conversation (ask if unclear)
7. Map `transferTo` separately from `vendor` if intermediary payment

### When editing the HTML file
- Use `grep` to locate exact line numbers before editing
- Match whitespace and field ordering exactly for clean `str_replace`
- After any successful str_replace, re-view the file before further edits (prior view is stale)

---

## Files

| File | Purpose |
|---|---|
| `house-ledger.html` | The entire app — single self-contained file (to be built) |
| `HOUSE_ARCHITECTURE.md` | Technical reference: stack, data model, components, theme system |
| `HOUSE_CONTEXT.md` | This file — project data, build history, decisions |
| `HOUSE_SPEC.md` | Full specification: entry mapping, category tree, UI layout |

---

## Relationship to Japan Trip Ledger

This is a **separate app** sharing the same Firebase project. The design language (roomy cards, Playfair headers, swipe gestures, theme system, SubtotalBar, FlipCard) is carried over. The data model is different — more fields, different dimensions, no FX. The two apps coexist with zero interference:

| | Japan Trip Ledger | House Ledger |
|---|---|---|
| Collection | `expenses` | `house-expenses` |
| Currency | Multi (INR/JPY/AED/USD) | INR only |
| Primary axis | City → Category | Phase → Zone → Category |
| Users | 4 travellers (paidBy) | 2 accounts (Self/Reemon) |
| Timeline | 16 days | 18+ months, open-ended |
| Budget | Scrapped | Core feature |
| Vendors | N/A | First-class dimension |

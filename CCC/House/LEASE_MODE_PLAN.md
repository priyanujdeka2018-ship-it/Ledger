# Lease Mode — Architecture and Feature Plan

> Design document. **Nothing here is built.** It exists so the shape can be
> argued about before code is written, because several decisions are hard to
> reverse once there is data in Firestore.
>
> **Scope decisions are settled** (§0). The model below is the simplified one
> that follows from them, not the general case.
>
> Companion to `DEVELOPMENT.md`, which describes the app as it actually is.

---

## 0. Settled decisions

| # | Question | Answer | What it removes |
|---|---|---|---|
| 1 | One unit or several? | **One** — the whole property | The `house-units` collection, a tab, and unit selectors everywhere |
| 2 | Simultaneous tenancies? | **No** — one at a time | Concurrency in every view; "current tenancy" is a single thing |
| 3 | Escalation convention? | **Renegotiated at renewal** | The whole escalation engine; rent is flat within a lease |
| 4 | Deposit custody | Options **Self / Runa** | — (see the flag below) |
| 5 | External read access? | **No** | Any public-read design; lease mode requires sign-in |
| 6 | Store identity references? | **Optional** | Nothing, but the field stays empty by default |

### ⚠ One thing to confirm: Self / Runa vs Self / Reemon

Expense accounts throughout the app are **`Self` / `Reemon`** (`ACCT_CLR`, the
Accounts hero card, every per-account total). Answer 4 specifies **`Self` /
`Runa`** for deposit custody.

Taken at face value that is a second, different account vocabulary living
alongside the first. That is workable — a deposit is a liability held by
whoever actually holds it, and it need not be one of the expense accounts —
but two similar-looking pairs is exactly the sort of thing that causes
reconciliation pain in three years.

**Built as specified: `DEPOSIT_HOLDERS = ['Self','Runa']`, kept deliberately
separate from `ACCT_CLR`.** Say the word if it should have been `Reemon` and
it is a one-line change before any data exists.

---

## 1. Why this is a separate module, not more tabs

Construction mode and lease mode are structurally different problems, and the
difference should drive the architecture rather than be papered over.

| | Construction | Lease |
|---|---|---|
| Money direction | Outward | Inward (plus a little outward) |
| Primary object | A **transaction** that happened | A **period** with an expectation that may or may not be settled |
| Time | Finite, ~2 years, ends | Open-ended, recurring monthly, forever |
| Success measure | Spend against a fixed budget | Received against expected, and yield against build cost |
| Counterparty | Vendors you pay once or twice | A tenant you have a continuing relationship with |
| Data volume | 88 rows and stopping | ~12 events/year, growing indefinitely |

**Trap 1: modelling rent as an expense row with a negative sign.** Every
existing total silently breaks, the Phases tab reports nonsense, and
`contractSpend()` becomes a lie. **Rent must never enter `house-expenses`.**

**Trap 2: storing only receipts.** Rent is not fundamentally a list of
payments, it is a *schedule of obligations*, most of which are met and
therefore boring. The interesting states are where expectation and reality
diverge — late, partial, missing. A design that only records what arrived
cannot show you what didn't, which is the only thing you actually need.

---

## 2. Navigation

**Decision: a mode switch in the header swaps the entire tab bar.** Mode
persists in `localStorage` under `hl-mode`.

```
Build mode    │ Entries  Phases  Zones  Vendors  Timeline
Lease mode    │ Rent  Tenancy  Repairs  Reports
```

Four lease tabs, not five, because §0.1 removed Units. At 390px that is ~97px
per tab — more comfortable than the build side.

Alternatives considered and rejected:

- **A sixth tab on one bar.** Six tabs at 390px is 65px each, and lease mode
  needs four screens of its own, so it becomes nested navigation inside a tab.
  Worse on a phone.
- **A separate page (`house-lease.html`).** Total isolation, but two builds,
  duplicated auth/theme/format/sync code, and a doubled smoke test.
  **Becomes right if** a tenant-facing view is ever wanted — that needs
  per-tenant auth and a different security posture, i.e. a different
  application. Revisit then; the components lift out cleanly because none of
  them touch `house-expenses`.

---

## 3. Privacy — settled, and it has a prerequisite

Answer 5 is *no external read access*, which settles it:

```
match /house-tenants/{doc}     { allow read, write: if familyMember(); }
match /house-leases/{doc}      { allow read, write: if familyMember(); }
match /house-rent/{doc}        { allow read, write: if familyMember(); }
match /house-maintenance/{doc} { allow read, write: if familyMember(); }
```

Unlike `house-expenses`, these are **not** publicly readable. Lease mode shows
nothing at all signed out; entering it prompts sign-in, reusing the existing
guard that parks the action and resumes it after.

**Prerequisite, stated plainly.** The Firestore rules are currently the
test-mode default and enforce none of this. That was a reasonable call while
the data was your own construction spend. It stops being reasonable here: a
tenant's name, phone number and arrears history belong to someone who never
agreed to publish them, and until the rules are applied those documents are
world-readable and world-writable the moment they exist.

**The rules must be in place before the first tenant record is written.**
Not before lease mode is coded — before it holds real data.

On answer 6: `idRef` exists and stays empty unless deliberately filled. Worth
considering whether a paper agreement in a drawer is a better home for an
Aadhaar number than a Firestore collection behind one password.

---

## 4. Data model

Four collections. All money INR, all dates `YYYY-MM-DD`, matching existing
conventions.

### `house-tenants`

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `phone`, `email` | string | Private — §3 |
| `idRef` | string | Optional, empty by default |
| `emergencyContact` | string | |
| `notes` | string | |
| `status` | string | Prospective / Current / Past — **derived** from lease dates |

### `house-leases` — one agreement, one term, flat rent

A renewal is a **new lease document**, not an edit. That is what "renegotiated
at renewal" means structurally, and it gives you a true tenancy history for
free: three renewals is three documents with three rents and three date
ranges.

| Field | Type | Notes |
|---|---|---|
| `tenantIds` | array | Plural for joint tenancies of the *same* letting |
| `startDate`, `endDate` | string | |
| `rentAmount` | number | Flat for the whole term — no escalation fields |
| `rentDueDay` | number | 1–28. Never 29–31: February |
| `depositAmount` | number | |
| `depositHolder` | string | `Self` / `Runa` — see §0 flag |
| `noticePeriodDays` | number | |
| `status` | string | Draft / Active / Ending / Ended / **Terminated** |
| `agreementRef`, `notes` | string | |
| `previousLeaseId` | string | Set when created as a renewal, so history chains |

`status` is **derived from dates**, except `Draft` and `Terminated` which are
explicit overrides. A status you have to remember to update is a status that
will be wrong. `Ending` = inside the notice period before `endDate`.

**Invariant from §0.2**: at most one lease may be `Active` on any date.
Creating a lease overlapping an existing active one is refused, with the
conflict named — not silently allowed.

### `house-rent` — events, stored sparsely

**The important design decision.** One document per *actual event*, not per
period. The schedule is computed client-side from the lease; a document exists
only where something happened.

| Field | Type | Notes |
|---|---|---|
| `leaseId` | string | |
| `period` | string | `YYYY-MM`, the month the rent is *for* |
| `expected` | number | Snapshotted, so later edits to the lease don't rewrite history |
| `received` | number | Supports partial |
| `receivedDate` | string | |
| `paymentMode` | string | Reuses the existing `PAYMENT_MODES` |
| `status` | string | Received / Partial / Waived / Written-off |
| `notes` | string | |

Why sparse: a materialised schedule is 12 documents a year whether or not
anything happened, every one read on every sync. Ten years of a quiet tenancy
is 120 documents saying "yes, paid, as expected". Storing only the event keeps
the collection proportional to what occurred rather than to elapsed time — the
read-quota lesson applied before the fact rather than after.

**Periods with no document are the interesting ones**: due, or overdue.

Flat rent (§0.3) makes the computed schedule trivial: for each month from
`startDate` to `min(endDate, today)`, expect `rentAmount` on `rentDueDay`.

### `house-maintenance`

| Field | Type | Notes |
|---|---|---|
| `leaseId` | string | Optional — repairs happen when vacant too |
| `raisedDate`, `raisedBy` | string | Tenant or owner |
| `zone` | string | From the existing `ZONES`, so a created expense is tagged right |
| `category` | string | Plumbing / Electrical / Structural / Appliance / Other |
| `description` | string | |
| `priority` | string | Low / Normal / Urgent |
| `status` | string | Open / Scheduled / In Progress / Done / Declined |
| `vendor` | string | **Datalist from existing expense vendors** — free reuse |
| `cost` | number | |
| `expenseId` | string | Link to the `house-expenses` document it created |
| `notes` | string | |

---

## 5. Where the two modes touch

Deliberately narrow. Four seams, one bidirectional.

1. **Repairs create expenses.** "Record cost" writes a `house-expenses` entry
   pre-tagged phase `Maintenance`, zone from the repair, vendor from the
   repair, and stores the new id back in `expenseId`. One action, two
   records, cross-referenced.
2. **Leasing costs are already expenses.** Agent fees, legal, tenant
   improvements: phase `Leasing`, category `Leasing`. Those subcategories
   already exist and are unused. No new mechanism.
3. **Vendor names are shared.** The repair vendor datalist reads from
   `house-expenses`, so the plumber you already paid is one tap away.
4. **Reports read both.** The only place the modes are summed together, and it
   must be explicit about direction — §6, L4.

Untouched by lease data: hero cards, `CONTRACT_BUDGET`, phase budgets, and
every existing total.

---

## 6. Sub-features, in build order

### L0 — Foundations

| | Feature | Notes |
|---|---|---|
| L0.1 | Mode switch, persisted, visually distinct | `hl-mode` |
| L0.2 | Authed reads for lease collections | Must not start sending tokens on expense reads |
| L0.3 | Lease mode requires sign-in; prompts and resumes | Reuses the existing guard |
| L0.4 | Lease data loads on mode entry, joins the existing change probe | **No second poll loop** |
| L0.5 | Empty states that teach | A new lease mode is entirely empty; it must explain the first step, not show four blank tabs |

### L1 — Tenancy

| | Feature |
|---|---|
| L1.1 | Tenant records, create/edit; `idRef` optional and empty by default |
| L1.2 | Lease create/edit: dates, rent, due day, deposit + holder, notice |
| L1.3 | Overlap refusal — at most one Active lease, conflict named |
| L1.4 | Derived lease and tenant status, incl. `Ending` inside the notice period |
| L1.5 | **Renew** action: creates a new lease pre-filled from the old one, new rent, `previousLeaseId` chained |
| L1.6 | Tenancy tab: current lease, tenant, deposit position, history chain |

### L2 — Rent (the point of the module)

| | Feature | Notes |
|---|---|---|
| L2.1 | Computed schedule from lease terms | Trivial with flat rent |
| L2.2 | Record a receipt against a period; partial supported | |
| L2.3 | Period status: Due / Received / Partial / Late / Waived | Late = past `rentDueDay` with nothing recorded |
| L2.4 | **"This month"** — due, received, outstanding | The most-checked number, mirroring U13 |
| L2.5 | Arrears: cumulative outstanding, oldest first | |
| L2.6 | CSV export of receipts | Reuse `toCSV` |
| L2.7 | Deposit ledger: held, deductions, refunded, balance | Deductions link to repair costs |

*(The escalation sub-feature that was here is gone — §0.3.)*

### L3 — Repairs — **shipped**

| | Feature | Status |
|---|---|---|
| L3.1 | Request list + create, raised by tenant or owner | done |
| L3.2 | Status workflow and priority | done — Open / Scheduled / In Progress / Done / Declined, Low / Normal / Urgent |
| L3.3 | Vendor from the existing expense vendor list | done — datalist from `house-expenses` |
| L3.4 | Record cost → creates the linked expense entry (§5.1) | done — opt-in per repair, `repairToExpense` |
| L3.5 | Repair history and lifetime cost | done — open sorted by priority, closed behind a disclosure |

Decisions taken while building it:

- **The expense link is opt-in, not automatic.** The toggle only appears once a
  cost is entered, and it states what it will write before you tap Save. A
  repair whose cost you paid in cash and never want in the ledger is a real
  case; silently creating an entry would be worse than asking.
- **The created expense is `Miscellaneous`, phase `Maintenance`.** Never
  `Contract` — a repair during a tenancy must not eat into a construction
  budget. The zone comes from the repair, so zone totals stay honest.
- **The repair is saved before the expense is created**, then patched with the
  returned `expenseId`. Doing it the other way round would write two
  maintenance documents for one repair.
- **Deleting a repair leaves its expense alone.** The money was still spent.
  The confirmation says so rather than leaving it to be discovered.

### L4 — Reports

| | Feature | Notes |
|---|---|---|
| L4.1 | **Yield**: rent received against total build cost | The number that says whether the project worked |
| L4.2 | Net position per financial year | Rent in, lease-related expenses out |
| L4.3 | Occupancy over time | Vacancy is the largest hidden cost |
| L4.4 | Tax export, **Apr–Mar** financial year | India convention, not calendar |

### L5 — Later, or never

| | Feature | Blocker |
|---|---|---|
| L5.1 | Rent-due reminders | Needs push; a static page cannot. A tab badge is the honest version |
| L5.2 | Agreement/receipt documents | Needs Firebase Storage — same blocker as U30 |
| L5.3 | Tenant-facing view | Needs per-tenant auth; separate-page territory |

---

## 7. UX principles specific to this mode

Construction mode's principle was **entry speed** — a payment logged in
seconds, weekly, for years. Lease mode's is different.

**The default view answers "is anything wrong?"** Rent that arrived on time is
not information. The Rent tab opens on the current month showing what is
outstanding, with everything settled collapsed behind a count. If nothing is
wrong the screen should be nearly empty and say so.

**Never make the user maintain state the data implies.** Lease status, tenant
status and period status are all derivable. Anything hand-set will drift.

**Money direction must be unmistakable.** Rent received and repair costs sit in
the same module pointing opposite ways. Use the existing green/red variance
vocabulary from the budget bars, never a bare number readable either way.

**Reuse the vocabulary already learned.** Swipe to edit and delete, the undo
toast, sticky Save, the amount echo, the duplicate warning, `fmtFull` in lists
and `fmtAmt` in aggregates. Lease mode should feel like the same app.

---

## 8. Rough sizing

| Tier | Size | Notes |
|---|---|---|
| L0 | ~1 session | Plumbing and the authed-read change |
| L1 | ~1 session | Two CRUD surfaces plus the renewal chain |
| L2 | ~1 session | Simpler than first estimated — flat rent removed the hard part |
| L3 | ~1 session | The expense link needs care |
| L4 | ~1 session | Arithmetic easy; presenting direction clearly is not |

Down from the pre-decision estimate: one collection, one tab and the
escalation engine are gone.

The compiled file is ~141KB. Lease mode plausibly adds 30–50%. Past ~220KB,
revisit the separate-page option — "loads fast on a phone" outranks tidiness.

---

## 9. What this plan deliberately does not do

- **No rent in `house-expenses`.** Ever.
- **No second poll loop.** Lease data joins the existing change probe.
- **No new dependencies.** Same no-bundler, no-runtime-deps constraint.
- **No hand-maintained status** where the data implies the answer.
- **No tenant PII on a world-readable path** — and no tenant data at all until
  the rules are applied (§3).
- **No units, no escalation, no concurrent tenancies** — §0. If any of those
  change later, they are additive: a `unitId` defaulting to the single
  property, and a renewal that happens to raise the rent.

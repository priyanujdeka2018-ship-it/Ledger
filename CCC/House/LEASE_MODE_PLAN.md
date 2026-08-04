# Lease Mode — Architecture and Feature Plan

> Design document. **Nothing here is built.** It exists so the shape can be
> argued about before code is written, because several decisions are hard to
> reverse once there is data in Firestore.
>
> Companion to `DEVELOPMENT.md`, which describes the app as it actually is.

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
| Counterparty | Vendors you pay once or twice | Tenants you have a continuing relationship with |
| Data volume | 88 rows and stopping | ~12 rows/year/unit, growing indefinitely |

The trap is modelling rent as an expense row with a negative sign. Do that and
every existing total silently breaks, the Phases tab starts reporting
nonsense, and `contractSpend()` becomes a lie. **Rent must never enter
`house-expenses`.**

The second trap is subtler: rent is not fundamentally a list of receipts, it
is a *schedule of obligations*, most of which are met and therefore boring.
The interesting states are the ones where expectation and reality diverge —
late, partial, missing. A design that only stores receipts cannot show you
what is missing, which is the only thing you actually need to look at.

---

## 2. Recommended navigation architecture

Three options considered.

### Option A — Mode switch (recommended)

One app, two modes. A switcher in the header swaps the entire tab bar.

```
Build mode    │ Entries  Phases  Zones  Vendors  Timeline
Lease mode    │ Rent  Units  Tenants  Repairs  Reports
```

- **For**: each mode keeps a full 5-tab bar at a comfortable 78px; auth,
  theming, formatting, sync, the change probe and the smoke harness are all
  reused rather than duplicated; still one deployable file, which is the
  app's founding constraint.
- **Against**: mode is hidden state. Mitigate with a persistent visual
  difference — mode name in the header, and remember the last mode in
  `localStorage` under `hl-mode`.

### Option B — A sixth tab

- **Against**: six tabs at 390px is 65px each, and lease mode needs four or
  five screens of its own, so you end up with nested navigation inside a tab.
  Worse on a phone than a mode switch.

### Option C — A separate page (`house-lease.html`)

- **For**: total isolation; the construction app never grows.
- **Against**: two builds, duplicated auth/theme/format/sync code, a link to
  maintain between them, and the smoke test doubles.
- **Becomes right if**: lease mode ever needs a tenant-facing view. That
  requires per-tenant auth and a completely different security posture, at
  which point it is genuinely a different application. Revisit then.

**Recommendation: Option A.** It matches "effectively a separate module"
without paying to duplicate the plumbing. The mode switch is a `useState`
plus a swapped tab array; if it later needs to be Option C, the components
lift out cleanly because none of them touch `house-expenses`.

---

## 3. The privacy problem — decide this first

The house ledger is deliberately **world-readable**: `allow read: if true`.
That is a defensible choice for construction spend on your own house.

It is not defensible for tenant data. Lease mode introduces:

- Tenant names, phone numbers, email addresses
- Identity references (Aadhaar/PAN), if recorded
- Lease terms, rent amounts, arrears history
- Emergency contacts

Publishing a tenant's phone number and their arrears history to anyone who
opens the URL is a real harm to a third party who never agreed to it.

**Recommendation: lease collections require authentication to read as well as
write.** Cost: the lease side does not work signed out. Nobody needs to browse
your tenancies, so this costs nothing real.

```
// Additions to the rules in DEVELOPMENT.md
match /house-units/{doc}       { allow read, write: if familyMember(); }
match /house-tenants/{doc}     { allow read, write: if familyMember(); }
match /house-leases/{doc}      { allow read, write: if familyMember(); }
match /house-rent/{doc}        { allow read, write: if familyMember(); }
match /house-maintenance/{doc} { allow read, write: if familyMember(); }
```

Consequences to design around:

- Entering lease mode signed out must prompt sign-in, reusing the existing
  guard that parks the action and resumes it.
- `fetchAll` currently sends no `Authorization` header on reads. Lease reads
  need an authed variant. Small change, but it must not accidentally start
  sending tokens on expense reads.
- **This makes the deferred rules decision live again.** Right now nothing
  enforces any of it. Lease mode is the point at which "only I use it" stops
  being a sufficient answer, because the data stops being only about you.

Consider also whether to record identity references at all. A lease agreement
you keep on paper may be the better place for Aadhaar numbers than a Firestore
collection behind a single password.

---

## 4. Data model

Five new collections. All money in INR, all dates `YYYY-MM-DD`, matching the
existing conventions.

### `house-units` — what can be let

A thin layer so a floor can later be split without a migration. Seed with one
unit, "Whole House", if you let the whole property.

| Field | Type | Notes |
|---|---|---|
| `name` | string | "Whole House", "Ground Floor" |
| `zone` | string | Member of the existing `ZONES`, so repairs can tag expenses correctly |
| `description` | string | |
| `bedrooms`, `area` | number | Optional, for reference |
| `status` | string | Vacant / Occupied / Unavailable — **derived** from leases, not hand-set |
| `notes` | string | |

### `house-tenants` — who

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `phone`, `email` | string | PII — see §3 |
| `idRef` | string | Optional. Consider omitting entirely |
| `emergencyContact` | string | |
| `notes` | string | |
| `status` | string | Prospective / Current / Past |

### `house-leases` — the agreement

| Field | Type | Notes |
|---|---|---|
| `unitId` | string | |
| `tenantIds` | array | Plural from day one; joint tenancies are common |
| `startDate`, `endDate` | string | |
| `rentAmount` | number | Base rent at start |
| `rentDueDay` | number | 1–28. Never 29–31: February |
| `depositAmount` | number | |
| `escalationPct`, `escalationMonths` | number | e.g. 5% every 11 months |
| `noticePeriodDays` | number | |
| `status` | string | Draft / Active / Ending / Ended / **Terminated** |
| `agreementRef`, `notes` | string | |

`status` is **derived from dates** except `Draft` and `Terminated`, which are
explicit overrides. A status you have to remember to update is a status that
will be wrong.

### `house-rent` — receipts, stored sparsely

**The important design decision.** One document per *actual event*, not per
period. The full schedule is computed client-side from the lease; a document
exists only where something happened — a payment, a waiver, a note.

| Field | Type | Notes |
|---|---|---|
| `leaseId` | string | |
| `period` | string | `YYYY-MM`, the month the rent is *for* |
| `expected` | number | Snapshotted, because escalation changes it over time |
| `received` | number | Supports partial |
| `receivedDate` | string | |
| `paymentMode` | string | Reuses the existing `PAYMENT_MODES` |
| `status` | string | Received / Partial / Waived / Written-off |
| `notes` | string | |

Why sparse: a fully materialised schedule would be 12 documents per year per
unit whether or not anything happened, and every one of them would be read on
every sync. Ten years of a single tenancy is 120 documents to say "yes, paid,
as expected". Computing the expectation and storing only the exception keeps
the collection proportional to events rather than to time — which matters on a
50,000 reads/day quota that this app has already had to engineer around once.

The states with **no document** are the interesting ones: due, or overdue.

### `house-maintenance` — repairs

| Field | Type | Notes |
|---|---|---|
| `unitId`, `leaseId` | string | Lease optional — repairs happen when vacant too |
| `raisedDate`, `raisedBy` | string | Tenant or owner |
| `category` | string | Plumbing, Electrical, Structural, Appliance, Other |
| `description` | string | |
| `priority` | string | Low / Normal / Urgent |
| `status` | string | Open / Scheduled / In Progress / Done / Declined |
| `vendor` | string | **Datalist from existing expense vendors** — free reuse |
| `cost` | number | |
| `expenseId` | string | Link to the `house-expenses` document it created |
| `notes` | string | |

---

## 5. Where the two modes touch

Deliberately narrow. Four seams, all one-directional except the last.

1. **Repairs create expenses.** "Record cost" on a maintenance item creates a
   `house-expenses` entry pre-tagged phase `Maintenance`, zone from the unit,
   vendor from the repair, and writes the new expense id back to
   `expenseId`. One action, two records, cross-referenced.
2. **Leasing costs are already expenses.** Agent fees, legal, tenant
   improvements: phase `Leasing`, category `Leasing`. The subcategories
   already exist and are unused. No new mechanism needed.
3. **Vendor names are shared.** The repair vendor datalist reads from
   `house-expenses`, so the plumber you already paid is one tap away.
4. **Reports read both.** The only place the two modes are summed together,
   and it must be explicit about direction — see §6, L4.

Everything else stays separate. In particular the hero cards, `CONTRACT_BUDGET`
and every existing total remain untouched by lease data.

---

## 6. Sub-features, in build order

### L0 — Foundations
*Nothing works without these; they are also the riskiest to change later.*

| | Feature | Notes |
|---|---|---|
| L0.1 | Mode switch, persisted, visually distinct | `hl-mode` in localStorage |
| L0.2 | `house-units` + seed "Whole House" | Empty state must offer to create it |
| L0.3 | Authed reads for lease collections | Must not leak tokens onto expense reads |
| L0.4 | Lease-mode sync: load on mode entry, reuse the change probe | Do **not** add a second poll loop |
| L0.5 | Empty states that teach | A brand-new lease mode is entirely empty; it must explain the first step, not show five blank tabs |

### L1 — Lease lifecycle

| | Feature |
|---|---|
| L1.1 | Unit list + detail: status, current lease, tenancy history |
| L1.2 | Tenant records, create/edit, with the PII decision from §3 applied |
| L1.3 | Lease create/edit: dates, rent, due day, deposit, escalation, notice |
| L1.4 | Derived lease status, with `Ending soon` when inside the notice period |
| L1.5 | Lease detail: terms, rent ledger, deposit position, repair history |

### L2 — Rent (the point of the module)

| | Feature | Notes |
|---|---|---|
| L2.1 | Computed rent schedule from lease terms | Sparse storage, §4 |
| L2.2 | Record a receipt against a period, partial supported | |
| L2.3 | Period status: Due / Received / Partial / Late / Waived | Late = past `rentDueDay` with nothing recorded |
| L2.4 | **"This month" dashboard** — due, received, outstanding | The single most-checked number, mirroring U13 |
| L2.5 | Arrears view, cumulative per lease | |
| L2.6 | Escalation applied per period | The schedule must show the *right* rent for each month, not today's rent for all of them |
| L2.7 | CSV export of receipts | Mirrors U9; reuse `toCSV` |
| L2.8 | Deposit ledger: held, deductions, refunded, balance | Deductions link to repair costs |

### L3 — Repairs

| | Feature |
|---|---|
| L3.1 | Request list + create, raised by tenant or owner |
| L3.2 | Status workflow and priority |
| L3.3 | Vendor from the existing expense vendor list |
| L3.4 | Record cost → creates the linked expense entry (§5.1) |
| L3.5 | Per-unit repair history and lifetime cost |

### L4 — Reports, where the two modes finally meet

| | Feature | Notes |
|---|---|---|
| L4.1 | **Yield**: rent received against total build cost | The number that says whether the project worked |
| L4.2 | Net position per financial year | Rent in, lease-related expenses out |
| L4.3 | Occupancy over time | Vacancy is the largest hidden cost |
| L4.4 | Tax-oriented export, **Apr–Mar** financial year | India convention, not calendar year |

### L5 — Later, or never

| | Feature | Blocker |
|---|---|---|
| L5.1 | Rent-due reminders | Needs push; a static page cannot. A badge on the tab is the honest version |
| L5.2 | Agreement/receipt documents | Needs Firebase Storage — same blocker as U30 |
| L5.3 | Tenant-facing view | Needs per-tenant auth. This is Option C territory |

---

## 7. UX principles specific to this mode

Construction mode's design principle was **entry speed** — a payment logged in
seconds, a few times a week, for years. Lease mode's is different.

**The default view answers "is anything wrong?"** Rent that arrived on time is
not information. The Rent tab should open on the current month showing what is
outstanding, with everything settled collapsed behind a count. If nothing is
wrong the screen should be nearly empty and say so.

**Never make the user maintain state the data already implies.** Lease status,
unit occupancy and period status are all derivable. Anything hand-set will
drift.

**Money direction must be unmistakable.** Rent received and repair costs
appear in the same module and point opposite ways. Use the existing green/red
variance vocabulary from the budget bars, never a bare number that could be
read either way.

**Reuse the vocabulary already learned.** Swipe to edit and delete, the undo
toast, sticky Save, the amount echo, the duplicate warning, `fmtFull` in
lists and `fmtAmt` in aggregates. Lease mode should feel like the same app,
not a second one bolted on.

---

## 8. Rough sizing

Assumes the existing conventions and the smoke test being extended in step.

| Tier | Size | Notes |
|---|---|---|
| L0 | ~1 session | Mostly plumbing and the auth-read change |
| L1 | ~1 session | Three CRUD surfaces, familiar shapes |
| L2 | ~1–2 sessions | Schedule computation and escalation carry the real complexity |
| L3 | ~1 session | The expense link needs care |
| L4 | ~1 session | Arithmetic is easy; presenting direction clearly is not |

The file is currently ~141KB compiled. Lease mode plausibly adds 40–60%.
If it passes roughly 220KB, revisit Option C — the founding constraint was a
page that loads fast on a phone, and that constraint outranks tidiness.

---

## 9. Decisions needed before any code

These change the model, not just the screens. Guessing them means rebuilding.

1. **One unit or several?** Whole house to one tenant, or floors let
   separately? Determines whether units are a real concept or ceremony.
2. **Multiple simultaneous tenancies?** Affects whether the Rent tab needs a
   unit selector at every level.
3. **Escalation convention** — a percentage every N months, a fixed step, or
   renegotiated each renewal?
4. **Deposit custody** — which account (`Self` / `Reemon`) holds it, and does
   it show in the existing account split? It is a liability, not income, and
   showing it as either would be wrong.
5. **Does anyone outside the family need read access?** Drives §3, and
   possibly Option C.
6. **Do you want identity references stored at all?** See §3.

---

## 10. What this plan deliberately does not do

- **No rent in `house-expenses`.** Ever.
- **No second poll loop.** Lease data joins the existing change-probe sync or
  loads once per mode entry.
- **No new dependencies.** Same no-bundler, no-runtime-deps constraint.
- **No hand-maintained status fields** where the data implies the answer.
- **No tenant PII on a world-readable path.**

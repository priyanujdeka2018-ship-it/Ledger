# House Ledger — working brief

A single-file React expense ledger for a family house build in Dibrugarh,
Assam, extended with a second module for letting the finished house. Live at
`https://priyanujdeka2018-ship-it.github.io/Ledger/CCC/House/house-ledger.html`.

**Read `HANDOFF.md` first.** It carries current state, the build and deploy
loop, open work, and the traps. `DEVELOPMENT.md` is the permanent reference;
`LEASE_MODE_PLAN.md` holds the lease-mode design and its settled scope
decisions. Everything in `docs/` is archived and stale in stated ways.

## The loop

```bash
cd CCC/House
npm run check     # compile + 129-step smoke walk + 6 correctness suites
```

Edit `house-ledger.jsx.html`. **Never hand-edit `house-ledger.html`** — it is
generated. Find code by section marker (`grep -n "─── " house-ledger.jsx.html`);
never hardcode line numbers.

## Rules that are not negotiable

1. **No Babel in the browser.** Runtime transpilation silently broke iPhone
   Safari. `compile.js` transforms JSX at build time; keep it that way.
2. **Do not make sync chattier.** The 60s tick is a change probe (1 read when
   nothing moved, against 88 for a full fetch) with a reconcile every 10
   minutes. ~13,968 reads/day/tab against a 50,000/day quota.
3. **Expense reads send no token.** The ledger is read-open by design; only
   lease collections are private.
4. **`undefined` breaks Firestore writes.** String fields default to `''`.
5. **Any new colour goes in all six themes.** Three of them are dark.
6. **Vendor aggregation groups by `vendor`, never `transferTo`.** Several
   payments to one mason were routed through four intermediaries.
7. **`fmtAmt()` for aggregates, `fmtFull()` for line items.** Indian
   conventions throughout — `en-IN`, lakhs and crores.
8. **A repair-derived expense is `Miscellaneous`/`Maintenance`, never
   `Contract`.** It must not touch a construction budget.
9. **Do not reopen the account-split reconciliation**, and do not edit any
   row's `account` field to make a summary match.

## How the user works

- Mobile-first, iPhone-primary. Reason against a ~390px viewport.
- Requirements get locked before code. If asked not to build yet, don't.
- Small verifiable diffs; run the check loop after each rather than batching.

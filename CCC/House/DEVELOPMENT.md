# House Ledger — Development Workflow

## File Structure

```
Ledger/CCC/House/
├── house-ledger.jsx.html   ← EDIT THIS (JSX source, ~800 lines)
├── house-ledger.html       ← GENERATED and DEPLOYED (~77KB, no Babel)
├── compile.js              ← Build script (JSX → React.createElement)
├── package.json            ← @babel/core + @babel/preset-react
└── DEVELOPMENT.md          ← This file
```

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

# 2. Compile
node compile.js

# 3. Syntax-check the generated bundle
node -e "const fs=require('fs');const m=fs.readFileSync('house-ledger.html','utf8').match(/<script>([\s\S]*?)<\/script>/);fs.writeFileSync('/tmp/c.js',m[1])" \
  && node --check /tmp/c.js && echo "JS valid"

# 4. Commit both files together
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
| `JS-FIRESTORE-HELPERS` | `toFS`/`fromFS`, CRUD, change probe |
| `JS-AUTH` | Identity Toolkit sign-in, token refresh |
| `JS-BUDGETS` | `house-budgets` helpers |
| `JS-CSV-EXPORT` | CSV of the filtered view |
| `JS-FORMATTING` | `fmtAmt`, `fmtFull`, date helpers |
| `JS-HEADER-COMPONENT` | Sync dot, refresh, theme, user menu |
| `JS-HERO-SPEND-CARD` | Total + contract breakdown |
| `JS-HERO-ACCOUNT-CARD` | Self/Reemon split |
| `JS-TAB-BAR` | 5-tab bottom nav |
| `JS-SUBTOTAL-BAR` | Filtered-view subtotal |
| `JS-ENTRY-ROW` | Entry row, swipe handling, expanded detail |
| `JS-ENTRIES-TAB` | List + search + filter chip |
| `JS-OVERVIEW-CARDS` | Shared Phases/Zones card renderer |
| `JS-PHASES-TAB` | Phase drill-down (2 levels) |
| `JS-ZONES-TAB` | Zone drill-down (2 levels) |
| `JS-VENDORS-TAB` | Vendor aggregation |
| `JS-TIMELINE-TAB` | Monthly bars + quarter summary |
| `JS-ENTRY-FORM` | Single-sheet add/edit modal, autofill, validation |
| `JS-UNDO-TOAST` | Deferred-delete toast with undo |
| `JS-BUDGET-EDITOR` | Per-phase budget editor |
| `JS-SIGN-IN` | Email/password dialog |
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

Replace the placeholder emails with the real family accounts, created under
Authentication → Users.

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

    match /house-expenses/{doc} {
      allow read: if true;
      allow write: if familyMember();
    }

    match /house-budgets/{doc} {
      allow read: if true;
      allow write: if familyMember();
    }

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
collections above no longer have an expiry. The `expenses` block does; that
belongs to the Japan trip app and is a separate decision.

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

## Deleting an entry

There is no delete confirmation. Swiping a row left removes it from the view
immediately and shows an undo toast for 5 seconds; the Firestore `DELETE` only
fires when that window closes.

The delete is **deferred rather than performed-and-restored** so that undo is
purely local and cannot fail — for a ledger, "an interrupted delete left the
row alone" is the right failure direction. The pending row is filtered out of
`exps` for every consumer, so totals agree with what the toast says. A pending
delete is flushed on tab hide, on unmount, and if a second delete starts, so
it is never silently dropped.

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

There is no test suite. Changes are verified by loading the compiled file in
headless Chromium at a 390px viewport with the Firestore endpoint stubbed —
never against the live database. Playwright is available in the Claude Code
web environment with Chromium preinstalled.

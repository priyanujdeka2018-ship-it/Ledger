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
| `CSS-CONFIRM-THEME` | Confirm dialog, theme picker, user menu |
| `CSS-MISC` | Empty state, loading skeleton |
| `JS-FIREBASE` | Project ID, API key, endpoints |
| `JS-CONSTANTS` | Phases, zones, categories, budget |
| `JS-PHASE-CAT-ACCT-CLR` | Colour lookups (hardcoded hex, not theme vars) |
| `JS-THEMES` | 6 theme definitions + `applyTheme` |
| `JS-FIRESTORE-HELPERS` | `toFS`/`fromFS`, CRUD |
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
| `JS-ENTRY-FORM` | 3-step add/edit modal, autofill, validation |
| `JS-CONFIRM-DIALOG` | Delete confirmation |
| `JS-THEME-PICKER` | Theme grid |
| `JS-APP` | State, polling, routing |

## Constraints that bite

- **Mobile-first.** Reason against a ~390px viewport. The primary user is on
  iPhone; desktop is a bonus.
- **No bundler, no runtime deps.** React + ReactDOM from CDN as UMD globals,
  everything else hand-rolled.
- **Do not shorten the poll interval.** It is 60s and pauses while the tab is
  hidden. At 10s an open tab exhausted the 50,000 reads/day free quota in
  about 95 minutes. Past a few hundred entries, switch to the Firestore
  real-time listener rather than polling harder.
- **Any new colour goes in all six theme objects.** Three themes are dark; a
  hardcoded light-mode value will be unreadable on them.
- **`undefined` breaks Firestore writes.** Any string field that could be
  unset must default to `''` in `toFS()`.
- **Vendor aggregation groups by `vendor`, never `transferTo`** — several
  payments to Mewalal Sharma were routed through intermediaries, and grouping
  by recipient fragments one contractor across four names.
- **Abbreviate aggregates, not line items.** `fmtAmt()` for hero cards and
  totals, `fmtFull()` in the entry list, which is the reconciliation unit.

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

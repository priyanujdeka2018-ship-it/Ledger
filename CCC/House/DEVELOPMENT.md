# House Ledger — Development Workflow

## File Structure

```
Ledger/CCC/
├── src/
│   └── house-ledger.jsx.html    ← EDIT THIS (JSX source, ~820 lines)
├── dist/
│   └── house-ledger.html        ← DEPLOY THIS (compiled, ~70KB, no Babel)
├── seed-house-expenses.html     ← One-time seeder (88 entries)
├── compile.js                   ← Build script (JSX → React.createElement)
├── package.json
└── DEVELOPMENT.md               ← This file
```

## How to Make Changes

### Setup (one-time)
```bash
npm install @babel/core @babel/preset-react
```

### Edit → Compile → Deploy
```bash
# 1. Edit the source file
#    (or have Claude edit it via str_replace)

# 2. Compile
node compile.js

# 3. Commit & push
git add dist/house-ledger.html
git push
```

## Working with Claude — Token-Conscious Edits

The source file has section markers (e.g. `// ─── JS-HERO-SPEND-CARD ───`).

### For each change, tell Claude:
1. **What to change** (the feature/fix)
2. **Which section** (if you know it)

### Claude's workflow:
```
1. view src/house-ledger.jsx.html [specific line range]
2. str_replace the change
3. Run: node compile.js
4. Present dist/house-ledger.html
```

This reads ~20-50 lines instead of ~820, saving significant tokens.

### Section Index (line numbers in src/house-ledger.jsx.html)
```
CSS-HEADER ..............  48   Header bar styles
CSS-HERO-CARDS ..........  64   Expandable hero card styles
CSS-TAB-BAR .............  87   Bottom navigation
CSS-ENTRY-LIST ..........  93   Entry rows, search, chips
CSS-OVERVIEW-CARDS ...... 120   Phase/Zone drill-down cards
CSS-VENDOR-TAB .......... 131   Vendor list cards
CSS-TIMELINE ............ 141   Timeline chart bars
CSS-FAB ................. 152   Floating action button
CSS-MODAL-FORM .......... 155   Entry form modal
CSS-CONFIRM-THEME ....... 176   Confirm dialog + theme picker
CSS-MISC ................ 191   Empty states

JS-FIREBASE ............. 205   Project ID, API key, endpoints
JS-CONSTANTS ............ 210   Phases, zones, categories, etc.
JS-PHASE-CAT-ACCT-CLR .. 220   Colour systems
JS-THEMES ............... 225   6 theme definitions
JS-FIRESTORE-HELPERS .... 242   toFS/fromFS, CRUD operations
JS-FORMATTING ........... 262   fmtAmt, fmtDate, etc.
JS-HEADER-COMPONENT ..... 277   Header with sync dot, user menu
JS-HERO-SPEND-CARD ..... 297   Total + contract breakdown card
JS-HERO-ACCOUNT-CARD ... 330   Self/Reemon split card
JS-TAB-BAR .............. 371   5-tab bottom nav
JS-SUBTOTAL-BAR ......... 377   Filtered view subtotal
JS-ENTRY-ROW ............ 383   Individual entry with swipe
JS-ENTRIES-TAB .......... 426   Entry list + search + filters
JS-OVERVIEW-CARDS ....... 454   Reusable phase/zone card
JS-PHASES-TAB ........... 485   Phase drill-down (2 levels)
JS-ZONES-TAB ............ 500   Zone drill-down (2 levels)
JS-VENDORS-TAB .......... 515   Vendor list with aggregation
JS-TIMELINE-TAB ......... 550   Monthly bars + quarter summary
JS-ENTRY-FORM ........... 610   3-step add/edit modal
JS-CONFIRM-DIALOG ....... 660   Delete confirmation
JS-THEME-PICKER ......... 676   Theme selection grid
JS-APP .................. 695   Main App component + state
```

## Why This Works

- **Babel standalone** (~800KB) caused iPhone load failures
- **Pre-compilation** converts JSX → `React.createElement` at build time
- **Output** is ~70KB with zero runtime transpilation
- **Section markers** let Claude read only the 20-50 lines being changed
- **str_replace** makes surgical edits without regenerating the full file

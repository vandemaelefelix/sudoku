# Correction Edits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the correction screen, the player selects a cell, sets a digit 1 to 9 or clears it, and switches a filled cell between given and entry. A changed cell loses its uncertain ring. Two givens with the same digit in a unit are marked every time (QR-04). The corrected grid is kept in a form that #27 (play a scanned puzzle) can load.

**Architecture:** Pure edit functions in `src/scan/utils/correctionEdit.utils.ts` work on a copy of the cell looks (`CellLook[]`), never on the `RecogniseResult`. A hook `useCorrectionEdits(result)` holds the edits on top of the looks of the result, and derives the conflicts, the count of cells to check and the corrected grid. `CorrectionCell` becomes pressable and draws a selected fill or a conflict fill under its digit. A new `CorrectionPad` component replaces the panel content while a cell is selected. The panel keeps its height of 168 pt, so `correctionLayout` and the capture transition do not change.

**Tech Stack:** Expo 57, React Native 0.86, React 19.2, react-native-unistyles 3.5.2, react-native-reanimated (existing digit and ring styles only), Jest 29 + @testing-library/react-native 13.3, `@sudoku/core` (`ROWS`, `COLUMNS`, `BOXES`, `GRID_CELLS`, type `Digit`).

**Spec:** issue #26 (`gh issue view 26`). Its acceptance criteria are the spec. Also F-06, QR-04, SUD-03, the scan-pipeline concept "Loading the result", the scan experience design "Stage 3" (`docs/superpowers/specs/2026-10-11-scan-experience-design.md`), the capture flow design "#19" cell styles (`docs/superpowers/specs/2026-10-11-capture-flow-design.md`), and the prototype "Scan flow studies", section 3 (https://claude.ai/artifact/QcWFdfZ8nQASvLDieeEcZV).

---


## Coordinator rulings (2026-10-12, binding; they override the tasks below where they differ)

- Developer decision: option A (the edit pad in the panel). Build option A only.
- Developer decision on play gating (implemented by #27, not here): uncertain cells never block play; given conflicts, zero solutions and several solutions block it. #26 must expose the given conflicts and the uncertain cells so #27 can mark them.

- Merge order: #51 merges first. Your last task rebases on origin/develop after #51 merges and adapts to #51's `GameStart` type and routes. Until then, work on origin/develop as it is.
## Interaction design: the developer chooses (open question 1)

The issue says the interaction design is open. This plan offers three options. It plans option A in full. If the developer picks B or C, Tasks 4 to 6 change. Tasks 1 to 3 (the edit state) stay the same for every option.

Facts that limit the choice:

- `correctionLayout` fixes the panel at 168 pt. The capture transition ends on the same layout. A taller panel changes the transition end frame and makes the grid smaller on an iPhone SE (the grid is height-limited there: 343 pt wide, 40 pt of slack).
- Every button meets 44 pt (game-screen plan, developer decisions). A grid cell is the one exception.
- #41 owns `Keypad` and `NumberKey` in this wave. Its plan adds a required `complete` prop to `NumberKey` and the label "Enter N". A read-only import can break when #41 merges.

### Option A (recommended): an edit pad that replaces the panel content

Tap a cell to select it. The panel content changes to the edit pad in place: a Given / Entry switch with Done, then two rows of keys. Done, or a second tap on the selected cell, returns to the chips, Play and Retake.

```
 ┌─────────────────────────────────┐
 │         Check the scan          │
 │      Tap a cell to fix it       │
 │ ┏━━━━━━━━━━━┳━━━━━━━━━━━┳━━━━━━┓ │
 │ ┃ 5  3  ·  ┃ ·  7  ·  ┃ ·  · ┃ │
 │ ┃ 6 [▓4▓] ·┃ 1  9  5  ┃ ·  · ┃ │   ▓ = selected fill
 │ ┃ · (9) 8  ┃ ·  ·  ·  ┃ ·  6 ┃ │   ( ) = uncertain ring
 │ ┃   …      ┃   …      ┃   …  ┃ │
 │ ┗━━━━━━━━━━━┻━━━━━━━━━━━┻━━━━━━┛ │
 │ ╭─────────────────────────────╮ │
 │ │ ┌─────────┬─────────┐  Done │ │   row 1: 44 pt
 │ │ │▓ Given ▓│  Entry  │       │ │
 │ │ └─────────┴─────────┘       │ │
 │ │ [ 1 ][ 2 ][ 3 ][ 4 ][ 5 ]   │ │   row 2: 44 pt
 │ │ [ 6 ][ 7 ][ 8 ][ 9 ][Clear] │ │   row 3: 44 pt
 │ ╰─────────────────────────────╯ │   3 × 44 + 2 × 4 = 140 ≤ 144
 └─────────────────────────────────┘
```

- For: no layout change, so the transition and the iPhone SE grid stay as they are. Every control is visible and is a plain button, so VoiceOver works with no custom actions. The keys are about 66 × 44 pt. Fully inside `src/scan/`, so no file of another wave issue is touched.
- Against: Play and Retake hide while a cell is selected. The "N cells to check" chip shows again after Done, not during the edit.

### Option B: tap for a digit popover, long press to switch the kind

A tap opens a small 3 × 3 digit popover next to the cell, with a Clear key. A long press on a filled cell switches it between given and entry, with a light haptic.

```
 ┃ 5  3  ·  ┃ ·  7  · ┃
 ┃ 6 [4] ·  ┃ 1  9  5 ┃
 ┃   ╭───────────╮    ┃
 ┃   │ 1  2  3   │    ┃
 ┃   │ 4  5  6   │    ┃   long press [4] → given ⇄ entry
 ┃   │ 7  8  9  ⌫│    ┃
 ┃   ╰───────────╯    ┃
```

- For: the panel and Play stay visible. The prototype also switches the kind on the digit itself.
- Against: a long press is hard to find. VoiceOver needs `accessibilityActions` for the kind switch. The popover covers the cells next to the selected cell, which are the cells the player compares against. Keys in a popover of the grid width are about 40 pt, below 44 pt. It needs a new haptics use in `src/scan/`.

### Option C: reuse the game keypad, and a second tap switches the kind

The panel grows by about 70 pt and shows the game `NumberKey` (64 × 60 pt) in two rows, with Clear. A second tap on a selected filled cell switches given and entry (the prototype behaviour).

```
 │ ╭─────────────────────────────╮ │
 │ │ ● 2 cells to check          │ │
 │ │  [1] [2] [3] [4] [5]        │ │   60 pt keys
 │ │  [6] [7] [8] [9] [⌫]        │ │
 │ │ [     Play this puzzle    ] │ │
 │ │           Retake            │ │
 │ ╰─────────────────────────────╯ │   about 240 pt
```

- For: the same keys as the game. Play and the count stay visible.
- Against: it changes `correctionLayout` (the transition end frame and the iPhone SE grid). `NumberKey` changes under #41 in this wave. The second-tap switch cannot also deselect, and a hidden gesture for the kind fails the "clear control" spirit of the acceptance criteria.

**Recommendation:** option A. It meets every acceptance criterion with visible controls, keeps the transition untouched, and stays inside the files this issue owns.

---

## Global Constraints

- Branch `feature/26-correction-edits` from `origin/develop`. Open the PR against `develop` with `Closes #26`.
- First commit: copy this plan to `docs/superpowers/plans/2026-10-12-correction-edits.md` with `docs(plan): correction edits (#26)`. Run `just docs-check`.
- The edits never change the `RecogniseResult` object or its `cells` array. The edit functions return new objects.
- Edits run only on the finished correction screen: `clock == null` and `result.ok`. During the transition (`CameraScreen` passes `clock`), the cells are not pressable.
- `src/game/` never imports from `src/scan/` or `src/scanner/` (SUD-03). This issue does not touch `src/game/`. `src/scan/` imports nothing from `src/game/`.
- No colour value outside `src/theme/`. Themed styles live in `<Name>.styles.ts` with `StyleSheet.create((theme) => …)`. Do not spread a Unistyles style. `roleFont(...)` returns a plain object, so a spread of it is allowed (as in `NumberKey.styles.ts`).
- One style key per state, not Unistyles variants: the Jest mock of Unistyles drops variants.
- `CorrectionCell` reads no theme hook (ADR-015). Its existing test checks this.
- No theme file changes. The tokens exist: `components.cell.selected`, `components.cell.conflictFill`, `components.cell.conflict`, and the semantic colours.
- No new dependency. No change to `jest.setup.ts`, `App.tsx`, the glossary, `00-DECISIONS.md` or `09-architecture-decisions.md`.
- Import rules of `apps/mobile/AGENTS.md`: the `@/` alias, folder `index.ts` entries, no `../`, no barrels, no `export *`. A utils or constants file imports no React. A constants file imports only constants and types.
- Comments and prose: STE light and the comment rules of `AGENTS.md`. No issue numbers in code comments.
- Commits: Conventional Commits, each with `(#26)`.
- Checks before the PR: `just lint`, `just typecheck`, `just test-ts`, `just docs-check`.

## Review Focus

1. **The scanner result stays unchanged.** Test: Task 3, "never changes the scanner result". Check also that no edit function writes into an array it got.
2. **A late result during the transition.** `CameraScreen` mounts the screen with `result = null`, and the result arrives later. The hook must show the new looks, not keep stale edits. Test: Task 3, "starts new edits for a new result".
3. **Conflicts every time (QR-04).** A clash must show at once after any edit that makes one, and go after any edit that removes it. Tests: Task 2 `givenConflicts`, Task 6 "marks two givens with the same digit" and "makes a new conflict visible at once".
4. **No taps during the transition.** Test: Task 6, "keeps the cells inert during the transition".
5. **The memo of 81 cells.** `actions.select` must stay the same function between renders, so a selection renders only the cells whose props change. Test: Task 3, "keeps the actions the same between renders".
6. **A component token outside its component.** `CorrectionCell` reads `components.cell.*`, as it did before this issue. This follows the #19 precedent. The reviewer checks that no other new file reads a component token.

## Files owned

All paths are under `apps/mobile/` unless stated.

| File | Change |
| --- | --- |
| `docs/superpowers/plans/2026-10-12-correction-edits.md` (repo root) | Create: this plan |
| `src/scan/utils/correction.utils.ts` | `cellsToCheck` counts looks, not cell results |
| `src/scan/utils/correction.utils.test.ts` | The `cellsToCheck` test follows |
| `src/scan/utils/correctionEdit.utils.ts` | Create: the edit state, conflicts, the corrected grid, the cell label |
| `src/scan/utils/correctionEdit.utils.test.ts` | Create |
| `src/scan/hooks/useCorrectionEdits/useCorrectionEdits.ts`, `index.ts`, `useCorrectionEdits.test.tsx` | Create |
| `src/scan/components/CorrectionCell/CorrectionCell.tsx`, `.styles.ts`, `.test.tsx` | Pressable, selected fill, conflict fill and colour, label |
| `src/scan/components/CorrectionPad/CorrectionPad.tsx`, `.styles.ts`, `.constants.ts`, `.test.tsx`, `index.ts` | Create: the edit pad |
| `src/scan/screens/CorrectionScreen/CorrectionScreen.tsx`, `.styles.ts`, `.test.tsx` | Wire the hook, the pad and the conflict chip |
| `src/scan/README.md` | Add `CorrectionPad` and `useCorrectionEdits` to the table |

Not touched: `ScanFlow`, `CameraScreen`, `TransitionCanvas`, `transition.utils.ts`, `correction.constants.ts`, every theme file, everything in `src/game/`.

---

### Task 0: Copy the plan

- [ ] **Step 1:** `/usr/bin/git switch -c feature/26-correction-edits origin/develop`
- [ ] **Step 2:** Copy this file to `docs/superpowers/plans/2026-10-12-correction-edits.md`. Remove nothing.
- [ ] **Step 3:** `just docs-check`. Expected: pass.
- [ ] **Step 4:** Commit: `docs(plan): correction edits (#26)`

---

### Task 1: `cellsToCheck` counts looks

The edits change the looks, not the cell results. The count must follow the looks.

**Files:**
- Modify: `src/scan/utils/correction.utils.ts`, `src/scan/utils/correction.utils.test.ts`
- Modify: `src/scan/screens/CorrectionScreen/CorrectionScreen.tsx` (one line, to keep typecheck green)

- [ ] **Step 1: Change the test.** In `correction.utils.test.ts`, replace the `describe('cellsToCheck', …)` block:

```ts
describe('cellsToCheck', () => {
  it('counts the uncertain looks', () => {
    const looks = [
      cell({}),
      cell({ confidence: 0.2 }),
      cell({ validPair: false }),
      cell({ kind: 'none', digit: 0, confidence: 0.1 }),
    ].map(cellLook)
    expect(cellsToCheck(looks)).toBe(3)
    expect(cellsToCheck([])).toBe(0)
  })
})
```

- [ ] **Step 2: Run it.** `pnpm --filter mobile exec jest src/scan/utils/correction.utils.test.ts`. Expected: a type error or a failure, because `cellsToCheck` still takes `CellResult[]`.

- [ ] **Step 3: Change the function.** In `correction.utils.ts`:

```ts
export function cellsToCheck(looks: readonly CellLook[]): number {
  return looks.filter((look) => look.uncertain).length
}
```

In `CorrectionScreen.tsx`, change `const toCheck = result?.ok ? cellsToCheck(result.cells) : 0` to:

```ts
const toCheck = cellsToCheck(looks)
```

- [ ] **Step 4: Run.** `pnpm --filter mobile exec jest src/scan` and `just typecheck`. Expected: pass.
- [ ] **Step 5:** Commit: `refactor(scan): count the cells to check from the looks (#26)`

---

### Task 2: The edit functions

**Files:**
- Create: `src/scan/utils/correctionEdit.utils.ts`, `src/scan/utils/correctionEdit.utils.test.ts`

**Interfaces:**
- Consumes: `CellLook` from `@/scan/utils/correction.utils`; `BOXES`, `COLUMNS`, `ROWS`, `GRID_CELLS`, type `Digit` from `@sudoku/core`.
- Produces:
  - `type EntryKind = 'given' | 'entry'`
  - `type CorrectionEdits = { looks: readonly CellLook[]; selected: number | null }`
  - `type CorrectedGrid = { givens: number[]; entries: number[] }`
  - `startEdits(looks)`, `selectCell(edits, cell)`, `deselect(edits)`, `setDigit(edits, digit)`, `clearCell(edits)`, `setKind(edits, kind)`
  - `givenConflicts(looks): boolean[]`, `correctedGrid(looks): CorrectedGrid`, `correctionCellLabel(cell, look, conflict): string`

- [ ] **Step 1: Write the test.** `src/scan/utils/correctionEdit.utils.test.ts`:

```ts
import { GRID_CELLS } from '@sudoku/core'
import type { CellLook } from '@/scan/utils/correction.utils'
import {
  clearCell,
  correctedGrid,
  correctionCellLabel,
  deselect,
  givenConflicts,
  selectCell,
  setDigit,
  setKind,
  startEdits,
} from './correctionEdit.utils'

const EMPTY: CellLook = { digit: '', style: 'empty', uncertain: false }
const given = (digit: number, uncertain = false): CellLook => ({ digit: String(digit), style: 'given', uncertain })
const entry = (digit: number, uncertain = false): CellLook => ({ digit: String(digit), style: 'entry', uncertain })

function board(cells: { [n: number]: CellLook } = {}): CellLook[] {
  return Array.from({ length: GRID_CELLS }, (_, n) => cells[n] ?? EMPTY)
}

describe('selectCell', () => {
  it('selects a cell, and a second tap on it clears the selection', () => {
    const edits = selectCell(startEdits(board()), 4)
    expect(edits.selected).toBe(4)
    expect(selectCell(edits, 4).selected).toBeNull()
    expect(selectCell(edits, 5).selected).toBe(5)
  })

  it('deselect clears the selection', () => {
    expect(deselect(selectCell(startEdits(board()), 4)).selected).toBeNull()
  })
})

describe('setDigit', () => {
  it('changes nothing without a selected cell', () => {
    const edits = startEdits(board())
    expect(setDigit(edits, 5)).toBe(edits)
  })

  it('makes a digit in an empty cell a given', () => {
    expect(setDigit(selectCell(startEdits(board()), 0), 5).looks[0]).toEqual(given(5))
  })

  it('keeps the kind of a filled cell and removes its ring', () => {
    const edits = setDigit(selectCell(startEdits(board({ 3: entry(1, true) })), 3), 7)
    expect(edits.looks[3]).toEqual(entry(7))
  })

  it('keeps the selection, so the player can correct again', () => {
    expect(setDigit(selectCell(startEdits(board()), 0), 5).selected).toBe(0)
  })

  it('does not change the looks it got', () => {
    const looks = board({ 3: entry(1, true) })
    setDigit(selectCell(startEdits(looks), 3), 7)
    expect(looks[3]).toEqual(entry(1, true))
  })
})

describe('clearCell', () => {
  it('empties the cell and removes its ring', () => {
    const edits = clearCell(selectCell(startEdits(board({ 2: given(9, true) })), 2))
    expect(edits.looks[2]).toEqual(EMPTY)
  })
})

describe('setKind', () => {
  it('switches a given to an entry and back', () => {
    const asEntry = setKind(selectCell(startEdits(board({ 0: given(5) })), 0), 'entry')
    expect(asEntry.looks[0]).toEqual(entry(5))
    expect(setKind(asEntry, 'given').looks[0]).toEqual(given(5))
  })

  it('removes the ring also when the kind stays, because the player checked the cell', () => {
    const edits = setKind(selectCell(startEdits(board({ 0: given(5, true) })), 0), 'given')
    expect(edits.looks[0]).toEqual(given(5))
  })

  it('changes nothing in an empty cell', () => {
    const edits = selectCell(startEdits(board({ 0: { ...EMPTY, uncertain: true } })), 0)
    expect(setKind(edits, 'entry').looks[0]).toEqual({ ...EMPTY, uncertain: true })
  })
})

describe('givenConflicts', () => {
  it('marks two givens with the same digit in a row', () => {
    const marked = givenConflicts(board({ 0: given(5), 8: given(5) }))
    expect(marked[0]).toBe(true)
    expect(marked[8]).toBe(true)
    expect(marked.filter(Boolean)).toHaveLength(2)
  })

  it('marks a conflict in a column and in a box', () => {
    expect(givenConflicts(board({ 0: given(3), 72: given(3) }))[72]).toBe(true)
    expect(givenConflicts(board({ 0: given(4), 20: given(4) }))[20]).toBe(true)
  })

  it('does not mark an entry, also when it repeats a given', () => {
    expect(givenConflicts(board({ 0: given(5), 1: entry(5), 2: entry(5) })).some(Boolean)).toBe(false)
  })

  it('does not mark the same digit in different units', () => {
    expect(givenConflicts(board({ 0: given(5), 13: given(5) })).some(Boolean)).toBe(false)
  })

  it('removes the mark when the player switches one given to an entry', () => {
    const edits = setKind(selectCell(startEdits(board({ 0: given(5), 8: given(5) })), 8), 'entry')
    expect(givenConflicts(edits.looks).some(Boolean)).toBe(false)
  })
})

describe('correctedGrid', () => {
  it('splits the looks into givens and entries, with 0 for every other cell', () => {
    const grid = correctedGrid(board({ 0: given(5), 1: entry(7), 2: given(9, true) }))
    expect(grid.givens.slice(0, 3)).toEqual([5, 0, 9])
    expect(grid.entries.slice(0, 3)).toEqual([0, 7, 0])
    expect(grid.givens).toHaveLength(GRID_CELLS)
    expect(grid.entries).toHaveLength(GRID_CELLS)
    expect(grid.givens.slice(3).every((value) => value === 0)).toBe(true)
  })
})

describe('correctionCellLabel', () => {
  it('says the place, the kind and the digit', () => {
    expect(correctionCellLabel(0, given(5), false)).toBe('Row 1, column 1, given 5')
    expect(correctionCellLabel(10, entry(7), false)).toBe('Row 2, column 2, entry 7')
    expect(correctionCellLabel(80, EMPTY, false)).toBe('Row 9, column 9, empty')
  })

  it('adds the conflict and the check', () => {
    expect(correctionCellLabel(0, given(5, true), true)).toBe(
      'Row 1, column 1, given 5, same digit as another given, check this cell',
    )
  })
})
```

- [ ] **Step 2: Run it.** `pnpm --filter mobile exec jest src/scan/utils/correctionEdit.utils.test.ts`. Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the module.** `src/scan/utils/correctionEdit.utils.ts`:

```ts
import { BOXES, COLUMNS, GRID_CELLS, ROWS, type Digit } from '@sudoku/core'
import type { CellLook } from '@/scan/utils/correction.utils'

export type EntryKind = 'given' | 'entry'

/** looks: 81 cells, row-major, a copy of the scanner result. selected: a cell index, or null. */
export type CorrectionEdits = { looks: readonly CellLook[]; selected: number | null }

/** The plain grid that a game loads (SUD-03). 0 is an empty cell. A cell holds a given or an entry, never both. */
export type CorrectedGrid = { givens: number[]; entries: number[] }

const UNITS = [...ROWS, ...COLUMNS, ...BOXES]

export function startEdits(looks: readonly CellLook[]): CorrectionEdits {
  return { looks, selected: null }
}

/** A tap on the selected cell clears the selection. */
export function selectCell(edits: CorrectionEdits, cell: number): CorrectionEdits {
  return { ...edits, selected: edits.selected === cell ? null : cell }
}

export function deselect(edits: CorrectionEdits): CorrectionEdits {
  return edits.selected === null ? edits : { ...edits, selected: null }
}

function changeSelected(edits: CorrectionEdits, next: (look: CellLook) => CellLook): CorrectionEdits {
  const { selected } = edits
  if (selected === null) return edits
  return { ...edits, looks: edits.looks.map((look, cell) => (cell === selected ? next(look) : look)) }
}

/** Any edit removes the ring: the player checked the cell. A digit in an empty cell becomes a given, because a missed printed digit is the common case. */
export function setDigit(edits: CorrectionEdits, digit: Digit): CorrectionEdits {
  return changeSelected(edits, (look) => ({
    digit: String(digit),
    style: look.style === 'empty' ? 'given' : look.style,
    uncertain: false,
  }))
}

export function clearCell(edits: CorrectionEdits): CorrectionEdits {
  return changeSelected(edits, () => ({ digit: '', style: 'empty', uncertain: false }))
}

/** An empty cell has no kind, so the switch changes nothing there. */
export function setKind(edits: CorrectionEdits, kind: EntryKind): CorrectionEdits {
  return changeSelected(edits, (look) => (look.style === 'empty' ? look : { ...look, style: kind, uncertain: false }))
}

/** QR-04: true for each given that shares its digit with another given in a row, a column or a box. Entries never count. */
export function givenConflicts(looks: readonly CellLook[]): boolean[] {
  const marked = looks.map(() => false)
  for (const unit of UNITS) {
    const byDigit = new Map<string, number[]>()
    for (const cell of unit) {
      const look = looks[cell]
      if (look?.style !== 'given') continue
      byDigit.set(look.digit, [...(byDigit.get(look.digit) ?? []), cell])
    }
    for (const cells of byDigit.values()) {
      if (cells.length > 1) for (const cell of cells) marked[cell] = true
    }
  }
  return marked
}

export function correctedGrid(looks: readonly CellLook[]): CorrectedGrid {
  const givens = Array.from({ length: GRID_CELLS }, () => 0)
  const entries = Array.from({ length: GRID_CELLS }, () => 0)
  looks.forEach((look, cell) => {
    if (look.style === 'given') givens[cell] = Number(look.digit)
    if (look.style === 'entry') entries[cell] = Number(look.digit)
  })
  return { givens, entries }
}

/** The VoiceOver label of a correction cell, for example "Row 1, column 3, entry 7, check this cell". */
export function correctionCellLabel(cell: number, look: CellLook, conflict: boolean): string {
  const parts = [`Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}`]
  parts.push(look.style === 'empty' ? 'empty' : `${look.style} ${look.digit}`)
  if (conflict) parts.push('same digit as another given')
  if (look.uncertain) parts.push('check this cell')
  return parts.join(', ')
}
```

- [ ] **Step 4: Run.** The same Jest command. Expected: PASS. Then `just typecheck` and `just lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(scan): edit, conflict and grid functions for the correction screen (#26)`

---

### Task 3: `useCorrectionEdits`

**Files:**
- Create: `src/scan/hooks/useCorrectionEdits/useCorrectionEdits.ts`, `index.ts`, `useCorrectionEdits.test.tsx`

**Interfaces:**
- Produces:
  - `type CorrectionEditActions = { select(cell: number): void; deselect(): void; setDigit(digit: Digit): void; clear(): void; setKind(kind: EntryKind): void }`
  - `type CorrectionEditState = { looks: readonly CellLook[]; selected: number | null; conflicts: readonly boolean[]; toCheck: number; grid: CorrectedGrid; actions: CorrectionEditActions }`
  - `useCorrectionEdits(result: RecogniseResult | null): CorrectionEditState`
- #27 reads `grid` when it enables "Play this puzzle".

- [ ] **Step 1: Write the test.** `src/scan/hooks/useCorrectionEdits/useCorrectionEdits.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'
import type { CellResult, RecogniseResult } from '@/scanner'
import { useCorrectionEdits } from './useCorrectionEdits'

const empty = (): CellResult => ({ digit: 0, kind: 'none', confidence: 1, validPair: true })

function okResult(over: { [n: number]: Partial<CellResult> } = {}): RecogniseResult {
  const cells = Array.from({ length: 81 }, (_, n) => ({ ...empty(), ...over[n] }))
  return { ok: true, cells, quad: [] as never, corners: 'detected' as never, cornerOffset: null, timings: {} as never }
}

const printed = (digit: number, confidence = 1) => ({ digit, kind: 'printed', confidence }) as const

it('starts from the scanner result, with no cell selected', () => {
  const { result } = renderHook(() => useCorrectionEdits(okResult({ 0: printed(5) })))
  expect(result.current.looks[0]).toEqual({ digit: '5', style: 'given', uncertain: false })
  expect(result.current.selected).toBeNull()
})

it('has no looks without a result or after a failure', () => {
  expect(renderHook(() => useCorrectionEdits(null)).result.current.looks).toEqual([])
  expect(renderHook(() => useCorrectionEdits({ ok: false, reason: 'x' })).result.current.looks).toEqual([])
})

it('sets, switches and clears the selected cell', () => {
  const scan = okResult()
  const { result } = renderHook(() => useCorrectionEdits(scan))
  act(() => result.current.actions.select(4))
  act(() => result.current.actions.setDigit(8))
  expect(result.current.looks[4]).toEqual({ digit: '8', style: 'given', uncertain: false })
  act(() => result.current.actions.setKind('entry'))
  expect(result.current.looks[4]?.style).toBe('entry')
  act(() => result.current.actions.clear())
  expect(result.current.looks[4]?.style).toBe('empty')
  act(() => result.current.actions.deselect())
  expect(result.current.selected).toBeNull()
})

it('follows the count of cells to check', () => {
  const scan = okResult({ 0: printed(5, 0.2), 1: { confidence: 0.1 } })
  const { result } = renderHook(() => useCorrectionEdits(scan))
  expect(result.current.toCheck).toBe(2)
  act(() => result.current.actions.select(0))
  act(() => result.current.actions.setDigit(6))
  expect(result.current.toCheck).toBe(1)
})

it('marks the conflicts and builds the corrected grid', () => {
  const { result } = renderHook(() =>
    useCorrectionEdits(okResult({ 0: printed(5), 8: printed(5), 9: { digit: 2, kind: 'handwritten', confidence: 1 } })),
  )
  expect(result.current.conflicts[0]).toBe(true)
  expect(result.current.conflicts[8]).toBe(true)
  expect(result.current.grid.givens[0]).toBe(5)
  expect(result.current.grid.entries[9]).toBe(2)
})

it('never changes the scanner result', () => {
  const scan = okResult({ 0: printed(5, 0.2) })
  const before = JSON.parse(JSON.stringify(scan))
  const { result } = renderHook(() => useCorrectionEdits(scan))
  act(() => result.current.actions.select(0))
  act(() => result.current.actions.setKind('entry'))
  act(() => result.current.actions.setDigit(3))
  expect(scan).toEqual(before)
})

it('starts new edits for a new result', () => {
  const first = okResult({ 0: printed(5) })
  const { result, rerender } = renderHook(({ scan }: { scan: RecogniseResult | null }) => useCorrectionEdits(scan), {
    initialProps: { scan: first as RecogniseResult | null },
  })
  act(() => result.current.actions.select(0))
  act(() => result.current.actions.clear())
  rerender({ scan: okResult({ 0: printed(7) }) })
  expect(result.current.looks[0]?.digit).toBe('7')
  expect(result.current.selected).toBeNull()
})

it('keeps the actions the same between renders, so the memo of the cells holds', () => {
  const scan = okResult()
  const { result } = renderHook(() => useCorrectionEdits(scan))
  const before = result.current.actions
  act(() => result.current.actions.select(3))
  expect(result.current.actions).toBe(before)
})
```

A test that acts holds the result in a constant. A new result on each render would start new edits after each `act`.

- [ ] **Step 2: Run it.** `pnpm --filter mobile exec jest src/scan/hooks/useCorrectionEdits`. Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the hook.** `src/scan/hooks/useCorrectionEdits/useCorrectionEdits.ts`:

```ts
import { useMemo, useState } from 'react'
import type { Digit } from '@sudoku/core'
import type { RecogniseResult } from '@/scanner'
import { cellLook, cellsToCheck, type CellLook } from '@/scan/utils/correction.utils'
import {
  clearCell,
  correctedGrid,
  deselect,
  givenConflicts,
  selectCell,
  setDigit,
  setKind,
  startEdits,
  type CorrectedGrid,
  type CorrectionEdits,
  type EntryKind,
} from '@/scan/utils/correctionEdit.utils'

export type CorrectionEditActions = {
  select(cell: number): void
  deselect(): void
  setDigit(digit: Digit): void
  clear(): void
  setKind(kind: EntryKind): void
}

export type CorrectionEditState = {
  looks: readonly CellLook[]
  selected: number | null
  conflicts: readonly boolean[]
  toCheck: number
  grid: CorrectedGrid
  actions: CorrectionEditActions
}

type Own = { base: CorrectionEdits; edits: CorrectionEdits }

/** The edits of the correction screen. They copy the looks of the result and never change the result. */
export function useCorrectionEdits(result: RecogniseResult | null): CorrectionEditState {
  const base = useMemo(() => startEdits(result?.ok ? result.cells.map(cellLook) : []), [result])
  const [own, setOwn] = useState<Own | null>(null)
  // The transition mounts the screen before the result arrives. Edits of an older result do not apply to a new one.
  const edits = own?.base === base ? own.edits : base

  const actions = useMemo<CorrectionEditActions>(() => {
    const update = (step: (from: CorrectionEdits) => CorrectionEdits) =>
      setOwn((previous) => ({ base, edits: step(previous?.base === base ? previous.edits : base) }))
    return {
      select: (cell) => update((from) => selectCell(from, cell)),
      deselect: () => update(deselect),
      setDigit: (digit) => update((from) => setDigit(from, digit)),
      clear: () => update(clearCell),
      setKind: (kind) => update((from) => setKind(from, kind)),
    }
  }, [base])

  const { looks, selected } = edits
  const conflicts = useMemo(() => givenConflicts(looks), [looks])
  const grid = useMemo(() => correctedGrid(looks), [looks])
  return { looks, selected, conflicts, toCheck: cellsToCheck(looks), grid, actions }
}
```

`index.ts`:

```ts
export { type CorrectionEditActions, type CorrectionEditState, useCorrectionEdits } from './useCorrectionEdits'
```

- [ ] **Step 4: Run.** The same Jest command, `just typecheck`, `just lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(scan): hold the correction edits apart from the scanner result (#26)`

---

### Task 4: `CorrectionCell` is pressable, with a selected fill and a conflict mark

**Files:**
- Modify: `src/scan/components/CorrectionCell/CorrectionCell.tsx`, `CorrectionCell.styles.ts`, `CorrectionCell.test.tsx`

**Interfaces:**
- New optional props: `selected?: boolean` (default false), `conflict?: boolean` (default false), `onSelect?: (cell: number) => void`. Without `onSelect`, the cell is not pressable (the transition).
- New test IDs: `correction-press-${n}` (the pressable), `correction-fill-${n}` (the fill). `correction-cell-${n}` stays on the digit text, so the existing screen tests keep working.

- [ ] **Step 1: Add the tests.** Append to `CorrectionCell.test.tsx`. Add `fireEvent` to the import from `@testing-library/react-native`.

```tsx
const given = { digit: '5', style: 'given', uncertain: false } as const
const fill = (n: number) => StyleSheet.flatten(screen.getByTestId(`correction-fill-${n}`).props.style)
const at = { size: 40, left: 0, top: 0, reduceMotion: false } as const

it('fills the selected cell with the selected token, with and without its ring', () => {
  render(
    <>
      <CorrectionCell n={0} look={look} selected {...at} />
      <CorrectionCell n={1} look={given} selected {...at} />
    </>,
  )
  expect(fill(0)).toMatchObject({ backgroundColor: daylight.components.cell.selected })
  expect(screen.getByTestId('correction-ring-0')).toBeTruthy()
  expect(fill(1)).toMatchObject({ backgroundColor: daylight.components.cell.selected })
  expect(screen.queryByTestId('correction-ring-1')).toBeNull()
})

it('draws no fill on a plain cell', () => {
  render(<CorrectionCell n={0} look={given} {...at} />)
  expect(screen.queryByTestId('correction-fill-0')).toBeNull()
})

it('marks a conflict with the conflict fill and the conflict colour', () => {
  render(<CorrectionCell n={0} look={given} conflict {...at} />)
  expect(fill(0)).toMatchObject({ backgroundColor: daylight.components.cell.conflictFill })
  expect(StyleSheet.flatten(screen.getByTestId('correction-cell-0').props.style)).toMatchObject({
    color: daylight.components.cell.conflict,
    fontWeight: daylight.type.given.weight,
  })
})

it('shows the selected fill over the conflict fill', () => {
  render(<CorrectionCell n={0} look={given} conflict selected {...at} />)
  expect(fill(0)).toMatchObject({ backgroundColor: daylight.components.cell.selected })
})

it('calls onSelect with its index', () => {
  const onSelect = jest.fn()
  render(<CorrectionCell n={12} look={given} onSelect={onSelect} {...at} />)
  fireEvent.press(screen.getByTestId('correction-press-12'))
  expect(onSelect).toHaveBeenCalledWith(12)
})

it('is not pressable without onSelect, as during the transition', () => {
  render(<CorrectionCell n={0} look={given} {...at} />)
  expect(screen.getByTestId('correction-press-0').props.accessibilityState).toMatchObject({ disabled: true })
})

it('gives VoiceOver the place, the kind, the digit and the selection', () => {
  render(<CorrectionCell n={0} look={look} selected onSelect={jest.fn()} {...at} />)
  const cell = screen.getByLabelText('Row 1, column 1, entry 7, check this cell')
  expect(cell.props.accessibilityState).toMatchObject({ selected: true, disabled: false })
})
```

- [ ] **Step 2: Run.** `pnpm --filter mobile exec jest src/scan/components/CorrectionCell`. Expected: the new tests FAIL.

- [ ] **Step 3: Change the styles.** `CorrectionCell.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// One key per cell state, not Unistyles variants: the Jest mock of Unistyles drops variants.
export const styles = StyleSheet.create((theme) => ({
  cell: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFillObject },
  selected: { backgroundColor: theme.components.cell.selected },
  conflictFill: { backgroundColor: theme.components.cell.conflictFill },
  digit: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  given: { ...roleFont(theme.type.given), color: theme.components.cell.given },
  entry: { ...roleFont(theme.type.entry), color: theme.components.cell.entry },
  conflict: { color: theme.components.cell.conflict },
}))
```

Check: the Unistyles `StyleSheet` exports `absoluteFillObject` (the screen styles already use it).

- [ ] **Step 4: Change the component.** `CorrectionCell.tsx`:

```tsx
import { memo } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { CorrectionRing } from '@/scan/components/CorrectionRing'
import type { CellLook } from '@/scan/utils/correction.utils'
import { correctionCellLabel } from '@/scan/utils/correctionEdit.utils'
import { digitAlpha, shiftOf, type SweepTiming } from '@/scan/utils/transition.utils'
import { DIGIT_RISE } from './CorrectionCell.constants'
import { styles } from './CorrectionCell.styles'

type CorrectionCellProps = SweepTiming & {
  n: number
  look: CellLook
  size: number
  left: number
  top: number
  selected?: boolean
  conflict?: boolean
  /** Without it, the cell is not pressable: the transition shows the cells before the player can edit them. */
  onSelect?: (cell: number) => void
}

/** One cell of the correction screen, with a ring when it is uncertain. n: the cell index, row-major. */
export const CorrectionCell = memo(function CorrectionCell({
  n,
  look,
  size,
  left,
  top,
  selected = false,
  conflict = false,
  onSelect,
  clock,
  resultsAt,
  reduceMotion,
}: CorrectionCellProps) {
  const row = Math.floor(n / 9)
  const col = n % 9
  const digitStyle = useAnimatedStyle(() => {
    let alpha = 1
    if (clock) {
      const t = clock.value
      alpha = digitAlpha(t, row, col, reduceMotion, shiftOf(t, resultsAt, reduceMotion))
    }
    return { opacity: alpha, transform: [{ translateY: (1 - alpha) * DIGIT_RISE }] }
  })
  const entry = look.style === 'entry'
  const disabled = onSelect == null
  return (
    <>
      <Pressable
        testID={`correction-press-${n}`}
        accessibilityRole="button"
        accessibilityLabel={correctionCellLabel(n, look, conflict)}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={() => onSelect?.(n)}
        style={[styles.cell, { left, top, width: size, height: size }]}
      >
        {(selected || conflict) && (
          <View
            testID={`correction-fill-${n}`}
            style={[styles.fill, selected ? styles.selected : styles.conflictFill]}
          />
        )}
        <Animated.Text
          testID={`correction-cell-${n}`}
          style={[
            styles.digit,
            entry ? styles.entry : styles.given,
            conflict && styles.conflict,
            { width: size, height: size, lineHeight: size, fontSize: size * 0.6 },
            digitStyle,
          ]}
        >
          {look.digit}
        </Animated.Text>
      </Pressable>
      {look.uncertain && (
        <CorrectionRing
          n={n}
          size={size}
          left={left}
          top={top}
          clock={clock}
          resultsAt={resultsAt}
          reduceMotion={reduceMotion}
        />
      )}
    </>
  )
})
```

The ring stays a sibling after the pressable, so it draws over the fill. It has `pointerEvents="none"`, so a tap on the ring reaches the cell.

- [ ] **Step 5: Run.** `pnpm --filter mobile exec jest src/scan`. Expected: PASS, the existing `CorrectionScreen` tests included. `just typecheck`, `just lint`. Expected: pass.
- [ ] **Step 6:** Commit: `feat(scan): select a correction cell and mark a conflict (#26)`

---

### Task 5: `CorrectionPad`

**Files:**
- Create: `src/scan/components/CorrectionPad/CorrectionPad.tsx`, `CorrectionPad.styles.ts`, `CorrectionPad.constants.ts`, `CorrectionPad.test.tsx`, `index.ts`

**Interfaces:**
- `CorrectionPad({ look, onDigit, onClear, onKind, onDone })`. `look`: the selected cell. `onDigit(digit: Digit)`, `onClear()`, `onKind(kind: EntryKind)`, `onDone()`.
- Three rows of `theme.size.touch` (44 pt) with `theme.space.xs` (4 pt) between them: 140 pt. The panel holds 168 − 2 × 12 = 144 pt.

- [ ] **Step 1: Write the test.** `src/scan/components/CorrectionPad/CorrectionPad.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { CellLook } from '@/scan/utils/correction.utils'
import { daylight } from '@/theme/themes/daylight'
import { CorrectionPad } from './CorrectionPad'

const GIVEN_5: CellLook = { digit: '5', style: 'given', uncertain: false }
const EMPTY: CellLook = { digit: '', style: 'empty', uncertain: false }
const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)

function renderPad(look: CellLook = GIVEN_5) {
  const handlers = { onDigit: jest.fn(), onClear: jest.fn(), onKind: jest.fn(), onDone: jest.fn() }
  render(<CorrectionPad look={look} {...handlers} />)
  return handlers
}

it('sends each digit key', () => {
  const { onDigit } = renderPad()
  for (let digit = 1; digit <= 9; digit++) fireEvent.press(screen.getByLabelText(`Set ${digit}`))
  expect(onDigit.mock.calls.map(([digit]) => digit)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
})

it('puts 1 to 5 in the first row, and 6 to 9 with Clear in the second', () => {
  renderPad()
  expect(screen.getByTestId('correction-pad-row-0')).toHaveTextContent('12345')
  expect(screen.getByTestId('correction-pad-row-1')).toHaveTextContent('6789Clear')
})

it('clears the cell', () => {
  const { onClear } = renderPad()
  fireEvent.press(screen.getByLabelText('Clear the cell'))
  expect(onClear).toHaveBeenCalledTimes(1)
})

it('shows the kind of the cell and switches it', () => {
  const { onKind } = renderPad()
  expect(screen.getByTestId('correction-kind-given').props.accessibilityState).toMatchObject({ checked: true })
  expect(screen.getByTestId('correction-kind-entry').props.accessibilityState).toMatchObject({ checked: false })
  fireEvent.press(screen.getByTestId('correction-kind-entry'))
  expect(onKind).toHaveBeenCalledWith('entry')
})

it('disables the kind switch for an empty cell', () => {
  const { onKind } = renderPad(EMPTY)
  expect(screen.getByTestId('correction-kind-given').props.accessibilityState).toMatchObject({ disabled: true })
  fireEvent.press(screen.getByTestId('correction-kind-given'))
  expect(onKind).not.toHaveBeenCalled()
})

it('calls onDone', () => {
  const { onDone } = renderPad()
  fireEvent.press(screen.getByLabelText('Done'))
  expect(onDone).toHaveBeenCalledTimes(1)
})

it('makes every row one touch target high, so three rows fit in the panel', () => {
  renderPad()
  for (const row of ['correction-pad-kinds', 'correction-pad-row-0', 'correction-pad-row-1']) {
    expect(style(row).height).toBe(daylight.size.touch)
  }
  expect(3 * daylight.size.touch + 2 * daylight.space.xs).toBeLessThanOrEqual(168 - 2 * 12)
})

it('takes its colours from the semantic tokens', () => {
  renderPad()
  expect(style('correction-key-1')).toMatchObject({ backgroundColor: daylight.colors.background })
  expect(style('correction-kind-given')).toMatchObject({ backgroundColor: daylight.colors.accent })
})
```

- [ ] **Step 2: Run.** `pnpm --filter mobile exec jest src/scan/components/CorrectionPad`. Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the constants.** `CorrectionPad.constants.ts`:

```ts
import type { Digit } from '@sudoku/core'
import type { EntryKind } from '@/scan/utils/correctionEdit.utils'

/** The second row also holds Clear, so both rows have five keys of the same width. */
export const PAD_ROWS: readonly (readonly Digit[])[] = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9],
]

export const KINDS: readonly { kind: EntryKind; label: string }[] = [
  { kind: 'given', label: 'Given' },
  { kind: 'entry', label: 'Entry' },
]
```

- [ ] **Step 4: Write the styles.** `CorrectionPad.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  pad: { gap: theme.space.xs },
  row: { flexDirection: 'row', gap: theme.space.xs, height: theme.size.touch },
  kinds: {
    flex: 1,
    flexDirection: 'row',
    padding: theme.space.xs,
    borderRadius: theme.shape.radius.md,
    backgroundColor: theme.colors.background,
  },
  kind: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: theme.shape.radius.sm },
  kindOn: { backgroundColor: theme.colors.accent },
  kindText: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.textMuted },
  kindTextOn: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.onAccent },
  disabled: { opacity: theme.opacity.disabled },
  done: { justifyContent: 'center', paddingHorizontal: theme.space.lg },
  doneText: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.accent },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.md,
    backgroundColor: theme.colors.background,
  },
  keyText: { ...roleFont(theme.type.key), fontSize: theme.type.title.scale, color: theme.colors.text },
  clearText: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.text },
}))
```

`type.title.scale` (22 pt) is the digit size: the key role scale (28 pt) is for the 60 pt game keys and does not fit a 44 pt key.

- [ ] **Step 5: Write the component.** `CorrectionPad.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native'
import type { Digit } from '@sudoku/core'
import type { CellLook } from '@/scan/utils/correction.utils'
import type { EntryKind } from '@/scan/utils/correctionEdit.utils'
import { KINDS, PAD_ROWS } from './CorrectionPad.constants'
import { styles } from './CorrectionPad.styles'

type CorrectionPadProps = {
  look: CellLook
  onDigit(digit: Digit): void
  onClear(): void
  onKind(kind: EntryKind): void
  onDone(): void
}

/** The panel content while a cell is selected: the given / entry switch, Done, the digits and Clear. */
export function CorrectionPad({ look, onDigit, onClear, onKind, onDone }: CorrectionPadProps) {
  const empty = look.style === 'empty'
  return (
    <View testID="correction-pad" style={styles.pad}>
      <View testID="correction-pad-kinds" style={styles.row}>
        <View accessibilityRole="radiogroup" style={styles.kinds}>
          {KINDS.map(({ kind, label }) => {
            const on = look.style === kind
            return (
              <Pressable
                key={kind}
                testID={`correction-kind-${kind}`}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: on, disabled: empty }}
                disabled={empty}
                onPress={() => onKind(kind)}
                style={[styles.kind, on && styles.kindOn, empty && styles.disabled]}
              >
                <Text style={on ? styles.kindTextOn : styles.kindText}>{label}</Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable testID="correction-done" accessibilityRole="button" accessibilityLabel="Done" onPress={onDone} style={styles.done}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
      {PAD_ROWS.map((digits, row) => (
        <View key={digits[0]} testID={`correction-pad-row-${row}`} style={styles.row}>
          {digits.map((digit) => (
            <Pressable
              key={digit}
              testID={`correction-key-${digit}`}
              accessibilityRole="button"
              accessibilityLabel={`Set ${digit}`}
              onPress={() => onDigit(digit)}
              style={styles.key}
            >
              <Text style={styles.keyText}>{digit}</Text>
            </Pressable>
          ))}
          {row === PAD_ROWS.length - 1 && (
            <Pressable
              testID="correction-clear"
              accessibilityRole="button"
              accessibilityLabel="Clear the cell"
              onPress={onClear}
              style={styles.key}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  )
}
```

`index.ts`:

```ts
export { CorrectionPad } from './CorrectionPad'
```

- [ ] **Step 6: Run.** The same Jest command, `just typecheck`, `just lint`. Expected: pass. If oxlint flags `key={digits[0]}` as possibly undefined, use `key={digits.join('')}`.
- [ ] **Step 7:** Commit: `feat(scan): edit pad for a selected correction cell (#26)`

---

### Task 6: Wire the edits into the correction screen

**Files:**
- Modify: `src/scan/screens/CorrectionScreen/CorrectionScreen.tsx`, `CorrectionScreen.styles.ts`, `CorrectionScreen.test.tsx`

- [ ] **Step 1: Change and add the tests.** In `CorrectionScreen.test.tsx`:

1. In "shows the title and a disabled Play button", change `'Tap a digit to fix it'` to `'Tap a cell to fix it'`.
2. Append this block:

```tsx
describe('CorrectionScreen edits', () => {
  const press = (testID: string) => fireEvent.press(screen.getByTestId(testID))
  const ui = (result: RecogniseResult) => <CorrectionScreen result={result} layout={layout} onRetake={jest.fn()} />

  it('selects a cell on tap and shows the pad in place of Play and Retake', () => {
    render(ui(okResult({ 0: given })))
    expect(screen.queryByTestId('correction-pad')).toBeNull()
    press('correction-press-0')
    expect(screen.getByTestId('correction-pad')).toBeTruthy()
    expect(style('correction-fill-0')).toMatchObject({ backgroundColor: daylight.components.cell.selected })
    expect(screen.queryByTestId('play')).toBeNull()
    expect(screen.queryByTestId('retake')).toBeNull()
  })

  it('sets a digit, and Done brings back Play and Retake', () => {
    render(ui(okResult()))
    press('correction-press-2')
    press('correction-key-4')
    expect(screen.getByTestId('correction-cell-2')).toHaveTextContent('4')
    expect(style('correction-cell-2')).toMatchObject({ color: daylight.components.cell.given })
    press('correction-done')
    expect(screen.queryByTestId('correction-pad')).toBeNull()
    expect(screen.queryByTestId('correction-fill-2')).toBeNull()
    expect(screen.getByTestId('play')).toBeTruthy()
    expect(screen.getByTestId('retake')).toBeTruthy()
  })

  it('closes the pad with a second tap on the selected cell', () => {
    render(ui(okResult()))
    press('correction-press-2')
    press('correction-press-2')
    expect(screen.queryByTestId('correction-pad')).toBeNull()
  })

  it('clears a cell', () => {
    render(ui(okResult({ 0: given })))
    press('correction-press-0')
    press('correction-clear')
    expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('')
  })

  it('switches a given to an entry, and the style follows at once', () => {
    render(ui(okResult({ 0: given })))
    press('correction-press-0')
    press('correction-kind-entry')
    expect(style('correction-cell-0')).toMatchObject({
      color: daylight.components.cell.entry,
      fontWeight: daylight.type.entry.weight,
    })
    press('correction-kind-given')
    expect(style('correction-cell-0')).toMatchObject({
      color: daylight.components.cell.given,
      fontWeight: daylight.type.given.weight,
    })
  })

  it('removes the ring of a changed cell, and the count follows', () => {
    render(ui(okResult({ 0: { ...given, confidence: 0.5 }, 1: { confidence: 0.1 } })))
    expect(screen.getByText('● 2 cells to check')).toBeTruthy()
    press('correction-press-0')
    press('correction-key-5')
    expect(screen.queryByTestId('correction-ring-0')).toBeNull()
    press('correction-done')
    expect(screen.getByText('● 1 cell to check')).toBeTruthy()
  })

  it('marks two givens with the same digit, and the mark goes when one becomes an entry', () => {
    render(ui(okResult({ 0: given, 8: given })))
    expect(style('correction-fill-0')).toMatchObject({ backgroundColor: daylight.components.cell.conflictFill })
    expect(style('correction-fill-8')).toMatchObject({ backgroundColor: daylight.components.cell.conflictFill })
    expect(screen.getByText('● 2 givens in conflict')).toBeTruthy()
    press('correction-press-8')
    press('correction-kind-entry')
    press('correction-done')
    expect(screen.queryByTestId('correction-fill-0')).toBeNull()
    expect(screen.queryByTestId('correction-fill-8')).toBeNull()
    expect(screen.queryByText(/in conflict/)).toBeNull()
  })

  it('makes a new conflict visible at once', () => {
    render(ui(okResult({ 0: given })))
    press('correction-press-1')
    press('correction-key-5')
    expect(style('correction-fill-0')).toMatchObject({ backgroundColor: daylight.components.cell.conflictFill })
    expect(style('correction-fill-1')).toMatchObject({ backgroundColor: daylight.components.cell.selected })
  })

  it('does not say that all cells look sure while givens are in conflict', () => {
    render(ui(okResult({ 0: given, 8: given })))
    expect(screen.queryByText('All cells look sure')).toBeNull()
  })

  it('keeps the cells inert during the transition', () => {
    render(<CorrectionScreen result={okResult({ 0: given })} layout={layout} onRetake={jest.fn()} clock={clock(1.5)} />)
    expect(screen.getByTestId('correction-press-0').props.accessibilityState).toMatchObject({ disabled: true })
    press('correction-press-0')
    expect(screen.queryByTestId('correction-pad')).toBeNull()
  })

  it('labels each cell for VoiceOver', () => {
    render(ui(okResult({ 0: given, 1: entry })))
    expect(screen.getByLabelText('Row 1, column 1, given 5')).toBeTruthy()
    expect(screen.getByLabelText('Row 1, column 2, entry 7')).toBeTruthy()
  })

  it('does not change the result it got', () => {
    const result = okResult({ 0: given })
    const before = JSON.parse(JSON.stringify(result))
    render(ui(result))
    press('correction-press-0')
    press('correction-kind-entry')
    press('correction-key-2')
    expect(result).toEqual(before)
  })
})
```

The edits add no animation: a style changes at the press, as the tests above check without a timer. So Reduce Motion needs no new branch.

- [ ] **Step 2: Run.** `pnpm --filter mobile exec jest src/scan/screens/CorrectionScreen`. Expected: the new tests FAIL.

- [ ] **Step 3: Add the styles.** In `CorrectionScreen.styles.ts`, add these keys next to `chip`:

```ts
  chips: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  chipConflict: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: theme.shape.radius.pill,
    backgroundColor: theme.colors.dangerSurface,
  },
  chipConflictText: { fontSize: 13, fontWeight: '600', color: theme.colors.danger },
```

- [ ] **Step 4: Change the screen.** In `CorrectionScreen.tsx`:

1. Imports: remove `cellLook` and `cellsToCheck` from the `correction.utils` import. Add:

```ts
import { CorrectionPad } from '@/scan/components/CorrectionPad'
import { useCorrectionEdits } from '@/scan/hooks/useCorrectionEdits'
```

2. Replace the `looks` and `toCheck` lines with:

```ts
  const { looks, selected, conflicts, toCheck, actions } = useCorrectionEdits(result)
  // The player edits only the finished screen. During the transition the cells are not pressable.
  const editable = clock == null && result?.ok === true
  const selectedLook = editable && selected !== null ? looks[selected] : undefined
  const conflictCount = conflicts.filter(Boolean).length
```

3. Change the subtitle text to `Tap a cell to fix it`.

4. Give each `CorrectionCell` three more props:

```tsx
          selected={editable && selected === n}
          conflict={conflicts[n] ?? false}
          onSelect={editable ? actions.select : undefined}
```

5. Replace the panel content (everything inside the `correction-panel` `Animated.View`) with:

```tsx
          {failed ? (
            <View testID="correction-failure" style={styles.failure}>
              <Text style={styles.failureTitle}>The scan failed</Text>
              <Text style={styles.failureReason}>{result.reason}</Text>
            </View>
          ) : selectedLook ? (
            <CorrectionPad
              look={selectedLook}
              onDigit={actions.setDigit}
              onClear={actions.clear}
              onKind={actions.setKind}
              onDone={actions.deselect}
            />
          ) : (
            <>
              <View style={styles.chips}>
                {conflictCount > 0 && (
                  <View style={styles.chipConflict}>
                    <Text style={styles.chipConflictText}>{`● ${conflictCount} givens in conflict`}</Text>
                  </View>
                )}
                {toCheck > 0 ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{`● ${toCheck} ${toCheck === 1 ? 'cell' : 'cells'} to check`}</Text>
                  </View>
                ) : (
                  conflictCount === 0 && <Text style={styles.sure}>All cells look sure</Text>
                )}
              </View>
              <Pressable
                testID="play"
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                disabled
                style={styles.play}
              >
                <Text style={styles.playText}>Play this puzzle</Text>
              </Pressable>
            </>
          )}
          {!selectedLook && (
            <Pressable testID="retake" accessibilityRole="button" onPress={onRetake} hitSlop={8}>
              <Text style={styles.retake}>Retake</Text>
            </Pressable>
          )}
```

Keep `useMemo`: the board picture still uses it.

- [ ] **Step 5: Run.** `pnpm --filter mobile exec jest src/scan`, then `just lint`, `just typecheck`, `just test-ts`. Expected: pass.
- [ ] **Step 6:** Commit: `feat(scan): fix cells on the correction screen before playing (#26)`

---

### Task 7: README, checks and pull request

**Files:**
- Modify: `src/scan/README.md`

- [ ] **Step 1:** In the `src/scan/README.md` table, change the rows:
  - `components/`: `CameraPermission`, `TransitionCanvas`, `CorrectionCell`, `CorrectionRing`, `CorrectionPad`
  - `hooks/`: `useCapture`, `useFrameTracking`, `useCaptureTransition`, `useTransitionClock`, `useCorrectionEdits`
  - `utils/`: `tracking`, `preview`, `transition`, `correction` and `correctionEdit` helpers
- [ ] **Step 2:** `just lint`, `just typecheck`, `just test-ts`, `just docs-check`. Expected: all pass.
- [ ] **Step 3:** Commit: `docs(scan): name the correction pad and the edit hook (#26)`
- [ ] **Step 4:** Tick the acceptance criteria of #26 that the tests prove. Leave "Accessibility" open until the iPhone steps pass.
- [ ] **Step 5:** Push and open the PR against `develop`. The body holds: a summary, the chosen interaction option, the files owned, the test evidence (the result lines of the four checks), the iPhone steps below, the hand-off to #27 (`useCorrectionEdits(result).grid`), and `Closes #26`.

---

## iPhone steps for the developer

Run on a development build (`pnpm exec expo run:ios`). In a development build the app opens on the game screen. Back opens the scan flow.

1. Scan a paper sudoku. Wait for the correction screen.
2. Tap a digit with a dashed ring. Check that the fill shows clearly, and that the ring stays visible over it. Do the same on a cell with no ring.
3. Tap 1 to 9 on the pad. Check that the digit follows at once and that the ring goes.
4. Switch the cell to Entry, then back to Given. Check the blue weight 500 and the text-colour weight 600.
5. Tap Clear on a filled cell. Then set a digit in an empty cell: it becomes a given.
6. Make two givens with the same digit in one row. Check that both show the conflict fill and that the chip says "2 givens in conflict". Switch one to Entry: the mark goes.
7. Tap Done. Check that the "N cells to check" count is lower by the cells you changed.
8. Turn on VoiceOver. Swipe across cells: each says the row, the column, the kind and the digit, plus "check this cell" for a ringed cell. Check the pad keys, the Given / Entry switch, Clear and Done.
9. Turn on Reduce Motion. Scan again. Check that edits change the cells at once, with no motion.
10. On the smallest iPhone available, check that the three pad rows fit inside the panel and that no key overlaps the panel edge.
11. Switch to the Midnight theme. Check the selected fill and the conflict fill against the entry blue and the given text colour.

---

## Open questions

1. **Which interaction design?** Options A, B and C are above. Recommended: **A**, the edit pad in the panel. If the developer picks B or C, Tasks 1 to 3 stay. Tasks 4 to 6 change, and C also changes `correctionLayout` and needs #41 merged first.
2. **The kind of a digit set in an empty cell.** Recommended: **given**, because a missed printed digit is the common case. The player can switch it with one tap.
3. **Does a press on the current kind, or on the same digit, remove the ring?** Recommended: **yes**. Any edit counts as a check, so the player can confirm a correct uncertain cell without a change. The issue says "a cell the player changed"; this reads "changed" as "edited".
4. **Should an entry that repeats a given also be marked?** The acceptance criteria and QR-04 name givens only, and the scan-pipeline concept keeps a conflicting entry and flags it in the game. Recommended: **givens only** on this screen.
5. **The "N cells to check" chip hides while the pad shows.** Recommended: **accept**. The panel has no room for it, and Done shows the new count.
6. **Glossary rows (owned by #51).** Recommended rows for #51 to add:
   - `| Correction pad | The panel content of the correction screen while a cell is selected: the given / entry switch, Done, the keys 1 to 9 and Clear |`
   - `| Given conflict | Two givens with the same digit in one row, column or box. The correction screen marks both, every time (QR-04) |`
   - Amend `Correction screen`: `The screen after a scan. It shows the recognised grid, marks the uncertain cells and the given conflicts, lets the player fix cells, and offers Retake`.
7. **Hand-off to #27.** #27 enables "Play this puzzle". It reads `grid` from `useCorrectionEdits` in `CorrectionScreen` and adds an `onPlay(grid)` prop. Its route belongs to #51. Recommended: #27 also disables Play while `conflictCount > 0`, before it runs the solver. No route task is needed in this plan.

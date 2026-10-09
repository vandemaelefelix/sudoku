# Scaffold the Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the empty monorepo frame (TypeScript workspace, Expo app, Python project, boundary lint, CI) so every later issue has a place to land. GitHub issue #1.

**Architecture:** pnpm workspaces hold `apps/mobile` (Expo, blank TypeScript template) and `packages/sudoku-core` (an internal package: the app imports its TypeScript source, no build step). `ml/` is a standalone uv project. A root `justfile` is the one command list. dependency-cruiser enforces SUD-03/04/05. Three path-filtered GitHub Actions workflows run on Linux.

**Tech Stack:** Node 24, pnpm 12.10.1, Expo SDK 57 (`create-expo-app` 5.0.0), Vitest, jest-expo + React Native Testing Library, ESLint (`eslint-config-expo`), dependency-cruiser, Python 3.12 with uv, pytest, ruff, just.

**Spec:** `docs/architecture/adr/adr-001-polyglot-monorepo.md`, `adr-008-package-boundaries.md`, `adr-010-testing-and-ci.md`, `05-building-block-view.md`, `AGENTS.md`, and issue #1.

## Global Constraints

- Work on branch `chore/1-scaffold-monorepo`. Commit messages are Conventional Commits and end with `(#1)`.
- No product code. The only "logic" is `createEmptyGrid()` in core and the class lists in `ml/`, both needed to prove the wiring.
- `@sudoku/core` has **zero** runtime dependencies (SUD-04).
- `ml/` and the TypeScript side share files only (SUD-07). No script in one calls into the other.
- `ios/` and `android/` are never committed (ADR-002, Continuous Native Generation).
- PyTorch is **not** added here. It arrives with #4. Reason: a CUDA-sized wheel in every CI run for a test that does not need it. Task 7 updates the issue text to say so.
- Python is pinned to 3.12 (`ml/.python-version`). ai-edge-torch (ADR-005) lags new Python releases.
- Prose (READMEs, comments, commit messages) follows the writing rules in `AGENTS.md`.

## Review Focus

1. **Metro cannot resolve `@sudoku/core` from the app** although Jest passes (Jest and Metro resolve differently). Expected: the app bundles. Pinned by `just bundle` (`expo export`) in Task 3 and in CI (Task 7).
2. **Core quietly depends on something** (a hoisted package or `node:fs`) that works locally. Expected: the boundary check fails. Pinned by the SUD-04 rule and its violation check in Task 4.
3. **A CI path filter skips a job that the change affects**, for example a change to `pnpm-lock.yaml` or the `justfile`. Expected: the matching job runs. Pinned by the explicit root-file paths in Task 7 and the trigger check in its last step.
4. **A fresh clone does not set up** with only the documented prerequisites. Expected: `just setup && just test` works. Pinned by CI, which always runs on a fresh clone (Task 7), and the README prerequisites (Task 6).
5. **The Python version drifts** between the Mac and CI. Expected: both use 3.12. Pinned by `ml/.python-version`, read by uv locally and by `setup-uv` in CI (Tasks 5 and 7).

## File Structure

```
sudoku/
├── .nvmrc                          # Node 24
├── .npmrc                          # pnpm settings (linker decided in Task 3)
├── package.json                    # private root: packageManager, root dev tools, scripts
├── pnpm-workspace.yaml             # apps/*, packages/*
├── tsconfig.base.json              # strict TS options shared by core
├── eslint.config.mjs               # one flat ESLint config for all TS
├── .dependency-cruiser.cjs         # SUD-03, SUD-04, SUD-05 rules
├── justfile                        # the one command list
├── scripts/check_links.py          # relative-link check for Markdown
├── apps/mobile/                    # Expo app (blank-typescript template)
│   ├── App.tsx                     # shows "Sudoku" and "81 cells" from core
│   ├── App.test.tsx                # jest-expo render test
│   └── src/
│       ├── game/README.md          # game UI lives here (may not import the scanner)
│       ├── scan/README.md          # scan UI lives here (imports scanner/index.ts only)
│       └── scanner/index.ts        # the only scanner entry point (empty for now)
├── packages/sudoku-core/
│   ├── package.json                # name @sudoku/core, exports ./src/index.ts
│   ├── tsconfig.json
│   └── src/{index.ts, grid.ts, grid.test.ts}
├── ml/                             # uv project, Python 3.12
│   ├── pyproject.toml
│   ├── .python-version
│   ├── src/sudoku_ml/{__init__.py, contract.py}
│   └── tests/test_contract.py
├── contracts/README.md
├── fixtures/{scans,preprocess}/README.md
└── .github/workflows/{ci-ts.yml, ci-ml.yml, ci-docs.yml}
```

---

### Task 0: Prerequisites on the Mac

**Files:** none.

- [ ] **Step 1: Install the missing tools**

```bash
brew install just
npm install -g pnpm@12.10.1
```

- [ ] **Step 2: Verify**

Run: `just --version && pnpm --version && uv --version && node --version`
Expected: `just 1.58.x`, `12.10.1`, `uv 0.11.x`, `v24.x`.

- [ ] **Step 3: Create the branch**

```bash
cd ~/projects/sudoku
git switch -c chore/1-scaffold-monorepo
```

---

### Task 1: Root workspace

**Files:**
- Create: `.nvmrc`, `.npmrc`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`

**Interfaces:**
- Produces: a pnpm workspace that picks up `apps/*` and `packages/*`; `tsconfig.base.json` for core to extend.

- [ ] **Step 1: Write the root files**

`.nvmrc`:
```
24
```

`.npmrc` (the linker setting is decided in Task 3; start isolated, the pnpm default):
```
# Expo SDK 57 supports isolated installs. If Task 3 shows otherwise, set:
# node-linker=hoisted
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
```

`package.json`:
```json
{
  "name": "sudoku",
  "private": true,
  "packageManager": "pnpm@12.10.1",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2022",
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

- [ ] **Step 2: Verify the workspace installs**

Run: `pnpm install`
Expected: completes, creates `pnpm-lock.yaml`, reports no projects yet besides the root.

- [ ] **Step 3: Commit**

```bash
git add .nvmrc .npmrc package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: add pnpm workspace root (#1)"
```

---

### Task 2: `@sudoku/core` with Vitest

**Files:**
- Create: `packages/sudoku-core/package.json`, `packages/sudoku-core/tsconfig.json`, `packages/sudoku-core/src/index.ts`, `packages/sudoku-core/src/grid.ts`
- Test: `packages/sudoku-core/src/grid.test.ts`

**Interfaces:**
- Produces: `import { createEmptyGrid, GRID_CELLS } from '@sudoku/core'`.
  `GRID_CELLS: 81`. `createEmptyGrid(): number[]` returns 81 zeros (0 = empty, as in the model contract's digit head).

- [ ] **Step 1: Create the package files**

`packages/sudoku-core/package.json`:
```json
{
  "name": "@sudoku/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "7.0.2",
    "vitest": "5.0.3"
  }
}
```
Task 3 Step 6 aligns `typescript` with the version the Expo template installs.

`packages/sudoku-core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing test**

`packages/sudoku-core/src/grid.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createEmptyGrid, GRID_CELLS } from './index'

describe('createEmptyGrid', () => {
  it('has 81 cells', () => {
    expect(GRID_CELLS).toBe(81)
    expect(createEmptyGrid()).toHaveLength(81)
  })

  it('has only empty cells', () => {
    expect(createEmptyGrid().every((cell) => cell === 0)).toBe(true)
  })

  it('returns a new array each time', () => {
    expect(createEmptyGrid()).not.toBe(createEmptyGrid())
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm install && pnpm --filter @sudoku/core test`
Expected: FAIL, cannot resolve `./index`.

- [ ] **Step 4: Write the minimal implementation**

`packages/sudoku-core/src/grid.ts`:
```ts
/** The number of cells in a sudoku grid. */
export const GRID_CELLS = 81

/** A new grid with every cell empty. 0 means empty. */
export function createEmptyGrid(): number[] {
  return new Array<number>(GRID_CELLS).fill(0)
}
```

`packages/sudoku-core/src/index.ts`:
```ts
export { createEmptyGrid, GRID_CELLS } from './grid'
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `pnpm --filter @sudoku/core test && pnpm --filter @sudoku/core typecheck`
Expected: 3 tests PASS. Typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/sudoku-core pnpm-lock.yaml
git commit -m "chore(core): add @sudoku/core package with Vitest (#1)"
```

---

### Task 3: Expo app that uses core, with a Jest test and a bundle check

**Files:**
- Create: `apps/mobile/` (from the template), `apps/mobile/App.test.tsx`, `apps/mobile/src/game/README.md`, `apps/mobile/src/scan/README.md`, `apps/mobile/src/scanner/index.ts`
- Modify: `apps/mobile/package.json`, `apps/mobile/App.tsx`, `.npmrc` (only if needed), `docs/architecture/adr/adr-008-package-boundaries.md`

**Interfaces:**
- Consumes: `createEmptyGrid` from `@sudoku/core`.
- Produces: workspace package `mobile` with scripts `start`, `test`, `typecheck`; `apps/mobile/src/scanner/index.ts` as the scanner entry point.

- [ ] **Step 1: Generate the app**

```bash
pnpm create expo-app@5.0.0 apps/mobile --template blank-typescript --no-install
```

- [ ] **Step 2: Set the package name, scripts and the core dependency**

In `apps/mobile/package.json` set `"name": "mobile"`, and add:
```json
"scripts": {
  "start": "expo start",
  "test": "jest",
  "typecheck": "tsc --noEmit"
},
"jest": { "preset": "jest-expo" }
```
Merge these with the scripts the template created (keep `android`, `ios`, `web` if present). Then:
```bash
pnpm --filter mobile add @sudoku/core@workspace:*
pnpm --filter mobile add -D jest-expo@57.0.5 jest@30.5.2 @testing-library/react-native@14.0.1
```

- [ ] **Step 3: Write the failing test**

`apps/mobile/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native'
import App from './App'

describe('App', () => {
  it('shows the title', () => {
    render(<App />)
    expect(screen.getByText('Sudoku')).toBeTruthy()
  })

  it('reads the grid size from @sudoku/core', () => {
    render(<App />)
    expect(screen.getByText('81 cells')).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter mobile test`
Expected: FAIL, unable to find text `Sudoku`.

- [ ] **Step 5: Change `App.tsx`**

`apps/mobile/App.tsx`:
```tsx
import { createEmptyGrid } from '@sudoku/core'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

export default function App() {
  const cells = createEmptyGrid().length
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sudoku</Text>
      <Text>{`${cells} cells`}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '600' },
})
```

- [ ] **Step 6: Align TypeScript and run tests and typecheck**

Set `typescript` in `packages/sudoku-core/package.json` to the exact version in `apps/mobile/package.json`. Then:

Run: `pnpm install && pnpm --filter mobile test && pnpm -r typecheck`
Expected: 2 app tests PASS. Both typechecks exit 0.

- [ ] **Step 7: Prove that Metro bundles the workspace package**

Run: `pnpm --filter mobile exec expo export --platform ios --output-dir dist`
Expected: an iOS bundle in `apps/mobile/dist`. No "Unable to resolve module @sudoku/core".

If it fails to resolve: set `node-linker=hoisted` in `.npmrc`, run `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`, and run the export again.

- [ ] **Step 8: Run Expo's health check**

Run: `pnpm --filter mobile exec expo-doctor`
Expected: no failed checks. Fix what it reports, except advice about committing native folders (CNG, ADR-002).

- [ ] **Step 9: Record the linker result in ADR-008**

Add under Consequences in `docs/architecture/adr/adr-008-package-boundaries.md` one of:
```markdown
- Expo SDK 57 bundles `@sudoku/core` with pnpm's isolated linker. No hoisting is needed (#1).
```
or
```markdown
- Expo SDK 57 needs `node-linker=hoisted` for the workspace package (#1). The package boundary
  therefore relies on dependency-cruiser alone.
```

- [ ] **Step 10: Add the folder skeleton**

`apps/mobile/src/game/README.md`:
```markdown
# Game UI

Screens and components for playing. Code here MUST NOT import from `src/scanner/` (SUD-03).
```

`apps/mobile/src/scan/README.md`:
```markdown
# Scan UI

Camera screen, outline, transition and correction screen. Imports the scanner only through
`src/scanner/index.ts` (SUD-05).
```

`apps/mobile/src/scanner/index.ts`:
```ts
// The only entry point into the scanner (SUD-05). The interface arrives with M0 issues #3 to #6.
export {}
```

Add `dist/` to `apps/mobile/.gitignore` if the template did not.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile .npmrc pnpm-lock.yaml packages/sudoku-core/package.json docs/architecture/adr/adr-008-package-boundaries.md
git commit -m "chore(app): add Expo app that renders data from @sudoku/core (#1)"
```

---

### Task 4: ESLint and the boundary rules

**Files:**
- Create: `eslint.config.mjs`, `.dependency-cruiser.cjs`
- Modify: `package.json`

**Interfaces:**
- Produces: root scripts `lint` and `boundaries`.

- [ ] **Step 1: Install the tools at the root**

```bash
pnpm add -w -D eslint@10.12.0 eslint-config-expo@57.0.2 dependency-cruiser@18.5.0
```

- [ ] **Step 2: Write the ESLint config**

`eslint.config.mjs`:
```js
import { defineConfig } from 'eslint/config'
import expoConfig from 'eslint-config-expo/flat.js'

export default defineConfig([
  expoConfig,
  { ignores: ['**/dist/**', '**/.expo/**', 'ml/**', '**/node_modules/**'] },
])
```
If the import path differs in eslint-config-expo 57, use the one its README shows for flat config.

- [ ] **Step 3: Write the dependency-cruiser rules**

`.dependency-cruiser.cjs`:
```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'sud-04-core-has-no-dependencies',
      comment: 'SUD-04: @sudoku/core must not depend on React Native, Expo, npm packages or Node I/O.',
      severity: 'error',
      from: { path: '^packages/sudoku-core/src', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'] },
    },
    {
      name: 'sud-03-game-does-not-use-scanner',
      comment: 'SUD-03: the game must not depend on the scanner.',
      severity: 'error',
      from: { path: '^apps/mobile/src/game/' },
      to: { path: '^apps/mobile/src/scanner/' },
    },
    {
      name: 'sud-05-scanner-has-one-entry-point',
      comment: 'SUD-05: outside the scanner, import it only through src/scanner/index.ts.',
      severity: 'error',
      from: { pathNot: '^apps/mobile/src/scanner/' },
      to: { path: '^apps/mobile/src/scanner/', pathNot: '^apps/mobile/src/scanner/index\\.ts$' },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    exclude: { path: '(^|/)(node_modules|dist|\\.expo)/' },
  },
}
```

- [ ] **Step 4: Add the root scripts**

In the root `package.json` `scripts`, add:
```json
"lint": "eslint .",
"boundaries": "depcruise apps/mobile/App.tsx apps/mobile/src packages/sudoku-core/src --config .dependency-cruiser.cjs"
```

- [ ] **Step 5: Run both on the clean tree**

Run: `pnpm lint && pnpm boundaries`
Expected: ESLint reports no errors. dependency-cruiser: "no dependency violations found".

- [ ] **Step 6: Prove each boundary rule fails on a violation (do not commit these files)**

```bash
printf "import 'node:fs'\nexport {}\n" > packages/sudoku-core/src/bad.ts
mkdir -p apps/mobile/src/scanner/internal
printf "export const x = 1\n" > apps/mobile/src/scanner/internal/deep.ts
printf "import '../scanner'\nexport {}\n" > apps/mobile/src/game/bad.ts
printf "import '../scanner/internal/deep'\nexport {}\n" > apps/mobile/src/scan/bad.ts
pnpm boundaries; echo "exit: $?"
```
Expected: exit code non-zero, and the output names all three rules: `sud-04-core-has-no-dependencies`, `sud-03-game-does-not-use-scanner`, `sud-05-scanner-has-one-entry-point`.

Then remove the files:
```bash
rm -rf packages/sudoku-core/src/bad.ts apps/mobile/src/scanner/internal apps/mobile/src/game/bad.ts apps/mobile/src/scan/bad.ts
pnpm boundaries
```
Expected: no violations.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.mjs .dependency-cruiser.cjs package.json pnpm-lock.yaml
git commit -m "chore: enforce SUD-03, SUD-04 and SUD-05 with dependency-cruiser (#1)"
```

---

### Task 5: The `ml/` Python project

**Files:**
- Create: `ml/pyproject.toml`, `ml/.python-version`, `ml/src/sudoku_ml/__init__.py`, `ml/src/sudoku_ml/contract.py`, `ml/README.md`
- Test: `ml/tests/test_contract.py`

**Interfaces:**
- Produces: `from sudoku_ml.contract import CONTRACT_VERSION, DIGIT_CLASSES, KIND_CLASSES, is_valid_pair`.
  `DIGIT_CLASSES: tuple[str, ...]` = `("empty", "1", …, "9")`. `KIND_CLASSES: tuple[str, ...]` = `("none", "printed", "handwritten", "notes")`. `is_valid_pair(digit: str, kind: str) -> bool`. Issue #4 builds on these.

- [ ] **Step 1: Create the project**

```bash
uv init --package --name sudoku-ml --python 3.12 --no-workspace ml
cd ml
uv add --dev "pytest>=8.4" "ruff>=0.12"
```

Make sure `ml/.python-version` contains `3.12`. Then add to `ml/pyproject.toml`:
```toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

`ml/README.md`:
```markdown
# ml

Training, evaluation and export of the cell classifier. A standalone uv project. It shares only
files with the app: `contracts/`, `fixtures/` and the promoted model (SUD-07).

PyTorch arrives with issue #4.
```

- [ ] **Step 2: Write the failing test**

`ml/tests/test_contract.py`:
```python
from sudoku_ml.contract import CONTRACT_VERSION, DIGIT_CLASSES, KIND_CLASSES, is_valid_pair


def test_contract_version():
    assert CONTRACT_VERSION == "1.0"


def test_digit_classes_in_contract_order():
    assert DIGIT_CLASSES == ("empty", "1", "2", "3", "4", "5", "6", "7", "8", "9")


def test_kind_classes_in_contract_order():
    assert KIND_CLASSES == ("none", "printed", "handwritten", "notes")


def test_empty_goes_with_none_or_notes():
    assert is_valid_pair("empty", "none")
    assert is_valid_pair("empty", "notes")
    assert not is_valid_pair("empty", "printed")
    assert not is_valid_pair("empty", "handwritten")


def test_digit_goes_with_printed_or_handwritten():
    assert is_valid_pair("7", "printed")
    assert is_valid_pair("7", "handwritten")
    assert not is_valid_pair("7", "none")
    assert not is_valid_pair("7", "notes")


def test_unknown_class_is_invalid():
    assert not is_valid_pair("10", "printed")
    assert not is_valid_pair("7", "typed")
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `uv run --directory ml pytest -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.contract'`.

- [ ] **Step 4: Write the minimal implementation**

`ml/src/sudoku_ml/contract.py`:
```python
"""Class lists and rules from docs/architecture/00-concepts/model-contract.md."""

CONTRACT_VERSION = "1.0"

DIGIT_CLASSES: tuple[str, ...] = ("empty", "1", "2", "3", "4", "5", "6", "7", "8", "9")
KIND_CLASSES: tuple[str, ...] = ("none", "printed", "handwritten", "notes")

_EMPTY_KINDS = frozenset({"none", "notes"})
_DIGIT_KINDS = frozenset({"printed", "handwritten"})


def is_valid_pair(digit: str, kind: str) -> bool:
    """Return True if the digit and kind can occur together in one cell."""
    if digit not in DIGIT_CLASSES or kind not in KIND_CLASSES:
        return False
    if digit == "empty":
        return kind in _EMPTY_KINDS
    return kind in _DIGIT_KINDS
```

Replace the generated `ml/src/sudoku_ml/__init__.py` content with:
```python
"""Training, evaluation and export for the sudoku cell classifier."""
```

- [ ] **Step 5: Run tests and lint**

Run: `uv run --directory ml pytest -q && uv run --directory ml ruff check . && uv run --directory ml ruff format --check .`
Expected: 6 tests PASS. ruff reports no issues (run `ruff format .` once if the format check fails, then re-run).

- [ ] **Step 6: Commit**

```bash
git add ml
git commit -m "chore(ml): add uv project with model-contract class lists (#1)"
```

---

### Task 6: Shared folders, link check and the justfile

**Files:**
- Create: `contracts/README.md`, `fixtures/scans/README.md`, `fixtures/preprocess/README.md`, `scripts/check_links.py`, `justfile`
- Modify: `README.md`, `.gitignore`

**Interfaces:**
- Produces: `just` recipes `setup`, `app`, `test`, `test-ts`, `test-ml`, `lint`, `lint-ts`, `lint-ml`, `boundaries`, `typecheck`, `bundle`, `docs-check`. CI in Task 7 calls these names.

- [ ] **Step 1: Write the shared folder READMEs**

`contracts/README.md`:
```markdown
# contracts

Formats that `ml/` and the app both implement. The model contract itself is specified in
`docs/architecture/00-concepts/model-contract.md`. Machine-readable versions go here when a
change needs them.
```

`fixtures/scans/README.md`:
```markdown
# fixtures/scans

The public fixture set (ADR-007, ADR-013). Layout: `<split>/<id>/photo.jpg`, `truth.json` and
`cells/00.png … 80.png`, where `<split>` is `dev` or `holdout`. Only puzzles this project
generated. Never used for training (SUD-10).
```

`fixtures/preprocess/README.md`:
```markdown
# fixtures/preprocess

Reference pairs for preprocessing parity: `<n>.cell.png` (64 × 64) and `<n>.expected.json`
(32 × 32). `ml/` and the scanner must both reproduce every pair within 1/255. Created in issue #4.
```

- [ ] **Step 2: Write the link checker**

`scripts/check_links.py`:
```python
#!/usr/bin/env python3
"""Fail if a relative Markdown link points to a file that does not exist."""

import re
import sys
from pathlib import Path

LINK = re.compile(r"\]\(([^)#\s]+)(#[^)]*)?\)")


def broken_links(paths: list[Path]) -> list[str]:
    files: list[Path] = []
    for path in paths:
        files.extend(path.rglob("*.md") if path.is_dir() else [path])
    broken = []
    for file in files:
        for match in LINK.finditer(file.read_text(encoding="utf-8")):
            target = match.group(1)
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            if not (file.parent / target).resolve().exists():
                broken.append(f"{file}: {target}")
    return broken


if __name__ == "__main__":
    problems = broken_links([Path(arg) for arg in sys.argv[1:]])
    for problem in problems:
        print(problem)
    print(f"{len(problems)} broken link(s)")
    sys.exit(1 if problems else 0)
```

- [ ] **Step 3: Prove the link checker fails on a broken link**

```bash
tmp=$(mktemp -d)
printf "[x](missing.md)\n" > "$tmp/test.md"
python3 scripts/check_links.py "$tmp/test.md"; echo "exit: $?"
rm -r "$tmp"
python3 scripts/check_links.py docs AGENTS.md README.md
```
Expected: first run prints `1 broken link(s)` and `exit: 1`. Second run prints `0 broken link(s)`.

- [ ] **Step 4: Write the justfile**

`justfile`:
```make
set shell := ["bash", "-euo", "pipefail", "-c"]

# Show every recipe
default:
    @just --list

# Install all dependencies, TypeScript and Python
setup:
    pnpm install
    uv sync --directory ml

# Start the Expo dev server
app:
    pnpm --filter mobile start

# Run every test
test: test-ts test-ml

# Vitest (core) and Jest (app)
test-ts:
    pnpm -r test

# pytest (ml)
test-ml:
    uv run --directory ml pytest -q

# Every lint, including the boundary rules
lint: lint-ts boundaries lint-ml

# ESLint for all TypeScript
lint-ts:
    pnpm lint

# SUD-03, SUD-04 and SUD-05
boundaries:
    pnpm boundaries

# ruff for ml/
lint-ml:
    uv run --directory ml ruff check .
    uv run --directory ml ruff format --check .

# TypeScript typecheck for every package
typecheck:
    pnpm -r typecheck

# Bundle the iOS app with Metro, without Xcode
bundle:
    pnpm --filter mobile exec expo export --platform ios --output-dir dist

# Check relative links in the docs
docs-check:
    python3 scripts/check_links.py docs AGENTS.md README.md contracts fixtures ml/README.md
```

- [ ] **Step 5: Update README and .gitignore**

Replace the "Status" paragraph in `README.md` with:
```markdown
**Status:** scaffold. Start with the architecture docs below.

## Getting started

Prerequisites: Node 24, pnpm 12, uv, just. Xcode is needed from issue #2 on.

    just setup   # install TypeScript and Python dependencies
    just test    # all tests
    just lint    # ESLint, boundary rules, ruff
    just --list  # every command
```

Append to `.gitignore`:
```
coverage/
apps/mobile/dist/
```

- [ ] **Step 6: Run everything through just**

Run: `just setup && just typecheck && just lint && just test && just bundle && just docs-check`
Expected: every recipe exits 0.

- [ ] **Step 7: Commit**

```bash
git add contracts fixtures scripts justfile README.md .gitignore
git commit -m "chore: add shared folders, link check and justfile (#1)"
```

---

### Task 7: CI workflows, pull request and review

**Files:**
- Create: `.github/workflows/ci-ts.yml`, `.github/workflows/ci-ml.yml`, `.github/workflows/ci-docs.yml`

**Interfaces:**
- Consumes: the `just` recipes from Task 6.

- [ ] **Step 1: Write the TypeScript workflow**

`.github/workflows/ci-ts.yml`:
```yaml
name: ci-ts
on:
  push:
    branches: [main]
    paths: &paths
      - apps/**
      - packages/**
      - package.json
      - pnpm-lock.yaml
      - pnpm-workspace.yaml
      - .npmrc
      - .nvmrc
      - tsconfig.base.json
      - eslint.config.mjs
      - .dependency-cruiser.cjs
      - justfile
      - .github/workflows/ci-ts.yml
  pull_request:
    paths: *paths

jobs:
  ts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - uses: extractions/setup-just@v4
      - run: pnpm install --frozen-lockfile
      - run: just typecheck
      - run: just lint-ts
      - run: just boundaries
      - run: just test-ts
      - run: just bundle
```
If GitHub rejects YAML anchors in `on:`, repeat the path list under `pull_request` instead.

- [ ] **Step 2: Write the ML workflow**

`.github/workflows/ci-ml.yml`:
```yaml
name: ci-ml
on:
  push:
    branches: [main]
    paths: &paths
      - ml/**
      - contracts/**
      - fixtures/**
      - justfile
      - .github/workflows/ci-ml.yml
  pull_request:
    paths: *paths

jobs:
  ml:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v10
        with:
          working-directory: ml
      - uses: extractions/setup-just@v4
      - run: uv sync --locked --directory ml
      - run: just lint-ml
      - run: just test-ml
```

- [ ] **Step 3: Write the docs workflow**

`.github/workflows/ci-docs.yml`:
```yaml
name: ci-docs
on:
  push:
    branches: [main]
    paths: &paths
      - "**/*.md"
      - scripts/check_links.py
      - justfile
      - .github/workflows/ci-docs.yml
  pull_request:
    paths: *paths

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: extractions/setup-just@v4
      - run: just docs-check
```

- [ ] **Step 4: Commit and push the branch**

```bash
git add .github/workflows
git commit -m "ci: add path-filtered TypeScript, ML and docs workflows (#1)"
git push -u origin chore/1-scaffold-monorepo
```

- [ ] **Step 5: Open the pull request**

```bash
gh pr create --title "chore: scaffold the monorepo, toolchains and CI" --body "$(cat <<'EOF'
Closes #1

## What changed

- pnpm workspace with `apps/mobile` (Expo SDK 57) and `@sudoku/core`
- `ml/` uv project (Python 3.12) with the model-contract class lists
- dependency-cruiser rules for SUD-03, SUD-04 and SUD-05
- `justfile` as the one command list
- Path-filtered CI: `ci-ts`, `ci-ml`, `ci-docs`
- ADR-008 records the pnpm linker result

## How it was tested

- Vitest (core) and Jest (app) pass. `expo export` bundles the app with `@sudoku/core`
- Each boundary rule was shown to fail on a deliberate violation
- pytest and ruff pass for `ml/`
- All three workflows are green on this PR

## Checklist

- [ ] No SUD-xx constraint is broken, or the PR says which one and why
- [ ] ADRs and `00-DECISIONS.md` are updated if a decision changed
- [ ] A fresh-context agent reviewed this PR, and its findings are fixed or answered
EOF
)"
```

- [ ] **Step 6: Verify CI is green and each workflow ran**

Run: `gh pr checks --watch`
Expected: `ts`, `ml` and `docs` all pass. All three must run, because this PR touches files in each path filter.

- [ ] **Step 7: Update issue #1**

Edit the issue body so the ml/ criterion reads "`ml/` is a uv project (Python 3.12, pytest, ruff) with one passing test. PyTorch arrives with #4." Tick every criterion that is met:
```bash
tmp=$(mktemp -d)
gh issue view 1 --json body -q .body > "$tmp/issue1.md"
# edit "$tmp/issue1.md": tick the boxes, update the ml/ line
gh issue edit 1 --body-file "$tmp/issue1.md"
```

- [ ] **Step 8: Fresh-context review (AGENTS.md rule 8)**

A second agent, without this session's context, reviews the PR diff against this plan and the spec files listed in the header. Fix its findings or answer them in the PR. Then tick the last checklist box. The developer merges.

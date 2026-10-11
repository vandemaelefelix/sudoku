# Model on the iPhone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the exported cell classifier in the app, preprocess 81 cell images in TypeScript, and prove on the iPhone that the model gives the same answers as PyTorch within 100 ms (issue #5).

**Architecture:** The `ml/` side writes the PyTorch outputs for the 81 reference cells next to the exported model. A new `just install-model` copies the model, the outputs and a manifest into `apps/mobile/assets/models/`. The `.tflite` stays out of git. In the app, `src/scanner/` gets pure preprocessing, a classifier around fast-tflite, and a parity check that a development build runs at start.

**Tech Stack:** Python 3 (uv, pytest, PyTorch, litert-torch), TypeScript, Expo 57, React Native 0.86, `react-native-fast-tflite` 3.0.1 (Nitro), Jest (jest-expo), oxlint, dependency-cruiser.

**Spec:** `docs/superpowers/specs/2026-10-11-capture-flow-design.md`, section "#5: the model on the iPhone". Also read `docs/architecture/00-concepts/model-contract.md`.

## Global Constraints

- Branch: `feature/5-model-on-iphone`. Commits reference the issue: `feat(app): ... (#5)`.
- Git: in this worktree a hook rewrites `git` to `rtk git`, and the sandbox refuses it. Run `/usr/bin/git` instead.
- Do not push, open a pull request or edit GitHub. The developer does it, or asks for it.
- Model input: `[81, 32, 32, 1]` float32. Outputs: `digit` `[81, 10]`, `kind` `[81, 4]`, softmax probabilities, identified by the manifest index only.
- Digit classes: `empty, 1, 2, 3, 4, 5, 6, 7, 8, 9`. Kind classes: `none, printed, handwritten, notes`.
- Preprocessing: gray = `0.299 R + 0.587 G + 0.114 B`; crop rows and columns `[6, 58)`; exact area average 52 → 32; `x = 1 − gray / 255`. It matches `fixtures/preprocess/` within `1/255`.
- fast-tflite: CPU delegate only (`[]`). Copy every output buffer before the next call.
- The scanner declares `SUPPORTED_CONTRACTS = [1]`. A manifest with another contract major is refused (SUD-09).
- `apps/mobile/assets/models/cell-classifier.tflite` is git-ignored (ADR-013: the model trained on real cells may not be published). `manifest.json` and `reference-outputs.json` are in git.
- The app reaches the scanner only through `src/scanner/index.ts` (SUD-05).
- Device pass: same top class on both heads for all 81 reference cells, probabilities within `1e-3`, median of 20 batched calls ≤ 100 ms.
- Writing style and comments: root `AGENTS.md` (Simplified Technical English, light; comments give facts the code cannot show; no TODO).
- Before a task is done, run from the repository root: `just lint`, `just typecheck`, `just test-ts` (app tasks) or `just test-ml` and `just lint-ml` (ml tasks).

## Review Focus

1. **fast-tflite reuses its output buffers.** A second `classify()` must not change the results of the first one. Pinned in Task 4.
2. **A `Float32Array` view with a byte offset.** `classify()` must send exactly the 81 × 1024 floats, not the whole underlying buffer. Pinned in Task 4.
3. **A manifest that swaps the outputs** (`digit: 1, kind: 0`). The decoding must follow the manifest, not the tensor order. Pinned in Task 4.
4. **A fresh clone without the `.tflite`.** Jest, typecheck and `just boundaries` must still pass. Pinned in Task 4 (module mapper, wildcard module, depcruise exception) and checked in Task 6 on a clean tree.
5. **A malformed manifest** (`contract: "2.0"`, `"x"`, no `outputs`). The classifier must refuse it, not decode garbage. Pinned in Task 4.

---

## File structure

| File | Responsibility |
| --- | --- |
| `ml/src/sudoku_ml/export.py` (modify) | Also writes `reference-outputs.json` into the run folder |
| `ml/src/sudoku_ml/install.py` (create) | Copies an exported run into the app folder and writes `manifest.json` |
| `ml/tests/test_export.py` (modify), `ml/tests/test_install.py` (create) | Tests of the two |
| `justfile` (modify) | Recipe `install-model` |
| `.gitignore` (modify) | Ignore `apps/mobile/assets/models/*.tflite` |
| `apps/mobile/src/scanner/preprocess.ts` (create) | Cell images → model input |
| `apps/mobile/src/scanner/classifier.ts` (create) | Manifest guard, output decoding, classifier around a loaded model |
| `apps/mobile/src/scanner/model.ts` (create) | Loads the model file and the manifest through fast-tflite |
| `apps/mobile/src/scanner/parity.ts` (create) | Compares the model with the reference outputs, and times it |
| `apps/mobile/src/scanner/index.ts` (modify) | Exports the new public names |
| `apps/mobile/src/assets.d.ts` (create) | Type of a `.tflite` import |
| `apps/mobile/App.tsx` (modify) | Logs the parity report in development builds |
| `apps/mobile/package.json`, `jest.setup.ts`, `test/tfliteStub.js` (modify, create) | Dependency, Jest mapping and mock |
| `.dependency-cruiser.cjs` (modify) | The git-ignored model file may be unresolved |
| `apps/mobile/assets/models/manifest.json`, `reference-outputs.json` (create, by `just install-model`) | The installed model's data |
| Docs (modify) | Model contract, ADR-007, `00-DECISIONS.md`, `09-architecture-decisions.md`, glossary |

---

### Task 1: Export writes the reference outputs

**Files:**
- Modify: `ml/src/sudoku_ml/export.py`
- Modify: `ml/tests/test_export.py`
- Modify: `docs/architecture/00-concepts/model-contract.md` (section "Model file")

**Interfaces:**
- Produces: `<run>/reference-outputs.json` with this shape. `inputs` is the base64 of the little-endian float32 bytes of the `[81, 32, 32, 1]` batch from `load_reference_inputs`. `digit` and `kind` are the PyTorch probabilities of `ExportModel`, as lists of rows.

```json
{ "run": "20261009-210543-cell-classifier", "inputs": "<base64>", "digit": [[0.99, ...10 values], ...81 rows], "kind": [[...4 values], ...81 rows] }
```

- Produces: `write_reference_outputs(run: Path, inputs: np.ndarray, expected: dict[str, np.ndarray]) -> Path` in `export.py`.

- [ ] **Step 1: Write the failing test.** Add to `ml/tests/test_export.py` (the module fixture `exported` already trains and exports a smoke run):

```python
import base64


def test_writes_reference_outputs(exported):
    run, _ = exported
    data = json.loads((run / "reference-outputs.json").read_text())
    assert data["run"] == run.name
    inputs = np.frombuffer(base64.b64decode(data["inputs"]), dtype="<f4").reshape(81, 32, 32, 1)
    np.testing.assert_array_equal(inputs, load_reference_inputs(FIXTURES))
    digit, kind = np.array(data["digit"]), np.array(data["kind"])
    assert digit.shape == (81, 10)
    assert kind.shape == (81, 4)
    np.testing.assert_allclose(digit.sum(1), 1, atol=1e-5)
    np.testing.assert_allclose(kind.sum(1), 1, atol=1e-5)
```

- [ ] **Step 2: Run it and see it fail.**

Run: `uv run --directory ml pytest -q tests/test_export.py::test_writes_reference_outputs`
Expected: FAIL, `FileNotFoundError` for `reference-outputs.json`.

- [ ] **Step 3: Implement.** In `export.py`, add `import base64`, the function below, and one call at the end of `export()`, after `export.json` is written.

```python
def write_reference_outputs(run: Path, inputs: np.ndarray, expected: dict[str, np.ndarray]) -> Path:
    """The PyTorch probabilities for the reference cells. The app compares the phone's outputs with them."""
    target = run / "reference-outputs.json"
    payload = {
        "run": run.name,
        "inputs": base64.b64encode(inputs.astype("<f4").tobytes()).decode("ascii"),
        "digit": expected["digit"].astype(float).tolist(),
        "kind": expected["kind"].astype(float).tolist(),
    }
    target.write_text(json.dumps(payload))
    return target
```

In `export()`, after `(run / "export.json").write_text(...)`:

```python
    write_reference_outputs(run, inputs, {n: expected[n].detach().numpy() for n in index})
```

- [ ] **Step 4: Run the tests and see them pass.**

Run: `uv run --directory ml pytest -q tests/test_export.py` and `just lint-ml`
Expected: PASS, no lint errors.

- [ ] **Step 5: Update the model contract.** In `docs/architecture/00-concepts/model-contract.md`, section "Model file", add this row to the table:

```markdown
| Reference outputs | `reference-outputs.json`, written by the export next to the model. It holds the 81 reference cells as one input batch (base64, little-endian float32) and the PyTorch probabilities of both heads. The app compares the phone's outputs with it (ADR-005) |
```

- [ ] **Step 6: Commit.**

```bash
/usr/bin/git add ml/src/sudoku_ml/export.py ml/tests/test_export.py docs/architecture/00-concepts/model-contract.md
/usr/bin/git commit -m "feat(ml): write the PyTorch outputs for the reference cells at export (#5)"
```

---

### Task 2: `just install-model` and the ADR-007 amendment

**Files:**
- Create: `ml/src/sudoku_ml/install.py`
- Create: `ml/tests/test_install.py`
- Modify: `justfile`, `.gitignore`
- Modify: `docs/architecture/adr/adr-007-model-promotion.md`, `docs/architecture/00-DECISIONS.md`, `docs/architecture/09-architecture-decisions.md`, `docs/architecture/00-concepts/model-contract.md` (section "Manifest"), `docs/architecture/12-glossary.md`

**Interfaces:**
- Consumes: `<run>/export.json` (`contract`, `outputs`), `<run>/metrics.json` (`digit_accuracy`, `ece`), `<run>/cell-classifier.tflite`, `<run>/reference-outputs.json` (Task 1).
- Produces: `install(run: Path, target: Path, version: str, today: str) -> Path` (returns the manifest path). It writes `target/cell-classifier.tflite`, `target/reference-outputs.json` and `target/manifest.json`:

```json
{
  "model": "cell-classifier",
  "version": "1.0.0",
  "contract": "1.0",
  "file": "cell-classifier.tflite",
  "outputs": { "digit": 0, "kind": 1 },
  "run": "20261009-210543-cell-classifier",
  "metrics": { "digitAccuracy": 0.987097, "ece": 0.006273 },
  "installedAt": "2026-10-11"
}
```

- [ ] **Step 1: Write the failing tests.** Create `ml/tests/test_install.py`:

```python
import json
from pathlib import Path

import pytest

from sudoku_ml.install import install


def make_run(tmp_path: Path, contract: str = "1.0") -> Path:
    run = tmp_path / "20261009-210543-cell-classifier"
    run.mkdir()
    (run / "export.json").write_text(json.dumps({"contract": contract, "outputs": {"digit": 0, "kind": 1}}))
    (run / "metrics.json").write_text(json.dumps({"digit_accuracy": 0.98, "ece": 0.01}))
    (run / "cell-classifier.tflite").write_bytes(b"TFL3model")
    (run / "reference-outputs.json").write_text('{"run": "x"}')
    return run


def test_copies_the_files_and_writes_the_manifest(tmp_path):
    run = make_run(tmp_path)
    target = tmp_path / "models"
    manifest = json.loads(install(run, target, "1.0.0", "2026-10-11").read_text())
    assert (target / "cell-classifier.tflite").read_bytes() == b"TFL3model"
    assert (target / "reference-outputs.json").read_text() == '{"run": "x"}'
    assert manifest == {
        "model": "cell-classifier",
        "version": "1.0.0",
        "contract": "1.0",
        "file": "cell-classifier.tflite",
        "outputs": {"digit": 0, "kind": 1},
        "run": run.name,
        "metrics": {"digitAccuracy": 0.98, "ece": 0.01},
        "installedAt": "2026-10-11",
    }


def test_refuses_another_contract_major(tmp_path):
    with pytest.raises(ValueError, match="contract 2.0"):
        install(make_run(tmp_path, contract="2.0"), tmp_path / "models", "1.0.0", "2026-10-11")


def test_refuses_a_run_without_reference_outputs(tmp_path):
    run = make_run(tmp_path)
    (run / "reference-outputs.json").unlink()
    with pytest.raises(FileNotFoundError, match="just export"):
        install(run, tmp_path / "models", "1.0.0", "2026-10-11")
```

- [ ] **Step 2: Run them and see them fail.**

Run: `uv run --directory ml pytest -q tests/test_install.py`
Expected: FAIL, `ModuleNotFoundError: sudoku_ml.install`.

- [ ] **Step 3: Implement.** Create `ml/src/sudoku_ml/install.py`:

```python
"""Copy an exported run into the app without the promote gate. M0 only (ADR-007)."""

import datetime
import json
import shutil
import sys
from pathlib import Path

from sudoku_ml.contract import CONTRACT_VERSION

FILES = ("cell-classifier.tflite", "reference-outputs.json")


def _major(version: str) -> str:
    return version.split(".")[0]


def install(run: Path, target: Path, version: str, today: str) -> Path:
    info = json.loads((run / "export.json").read_text())
    # SUD-09: the scanner implements the same contract major as this package.
    if _major(info["contract"]) != _major(CONTRACT_VERSION):
        raise ValueError(f"the run implements contract {info['contract']}, the app {CONTRACT_VERSION}")
    for name in FILES:
        if not (run / name).exists():
            raise FileNotFoundError(f"{run / name} is missing. Run `just export` on the run first")
    metrics = json.loads((run / "metrics.json").read_text())
    target.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        shutil.copyfile(run / name, target / name)
    manifest = {
        "model": "cell-classifier",
        "version": version,
        "contract": info["contract"],
        "file": FILES[0],
        "outputs": info["outputs"],
        "run": run.name,
        "metrics": {"digitAccuracy": metrics["digit_accuracy"], "ece": metrics["ece"]},
        "installedAt": today,
    }
    path = target / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n")
    return path


if __name__ == "__main__":
    print(install(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], datetime.date.today().isoformat()))
```

- [ ] **Step 4: Run the tests and see them pass.**

Run: `uv run --directory ml pytest -q tests/test_install.py` and `just lint-ml`
Expected: PASS. If `ruff format --check` fails, run `uv run --directory ml ruff format .` and run the check again.

- [ ] **Step 5: Add the recipe and the ignore rule.** In `justfile`, after the `export` recipe:

```just
# Copy an exported run into the app, without the promote gate (M0, ADR-007). The run path is relative to ml/
install-model run version="1.0.0":
    uv run --directory ml python -m sudoku_ml.install {{run}} ../apps/mobile/assets/models {{version}}
```

In `.gitignore`, under the `# ML` block:

```gitignore
# A model trained on real cells may not be published (ADR-013). just install-model copies it in.
apps/mobile/assets/models/*.tflite
```

- [ ] **Step 6: Install the real model.** Copy the run into this worktree, export it again (this adds `reference-outputs.json`), and install it:

```bash
mkdir -p ml/artifacts
cp -R /Users/felix/projects/sudoku/ml/artifacts/20261009-210543-cell-classifier ml/artifacts/
just export artifacts/20261009-210543-cell-classifier
just install-model artifacts/20261009-210543-cell-classifier
/usr/bin/git status --short apps/mobile/assets/models
```

Expected: the export prints the `.tflite` path. `git status` lists `manifest.json` and `reference-outputs.json` only, not the `.tflite`. `manifest.json` has `"outputs": {"digit": 0, "kind": 1}` and `"contract": "1.0"`.

- [ ] **Step 7: Amend ADR-007.** In `docs/architecture/adr/adr-007-model-promotion.md`, add this section before "## Consequences":

```markdown
## Amendment: M0 install and private models (2026-10-11)

- Until `just promote-model` exists (M3), `just install-model <run>` copies an exported run into
  `apps/mobile/assets/models/` without the gate. It checks the contract major version (SUD-09)
  and writes a reduced manifest: model, version, contract, file, outputs, run, metrics and
  `installedAt`. Promote adds the fixture scores and the holdout.
- A model trained on data that may not be published stays out of git (ADR-013). The `.tflite`
  file is git-ignored. `manifest.json` and `reference-outputs.json` are in git. A clone without
  the model file does not bundle. Run `just install-model` first.
- Consequence: `git log apps/mobile/assets/models` shows the manifest history, not the model
  bytes. The run name in the manifest points to the run in `ml/artifacts/`.
```

In `docs/architecture/00-DECISIONS.md`, replace the ADR-007 decision text with:

```markdown
| ADR-007 | Gated promote step, scored on the app's own cell images per fixture, with a floor, a tolerance and a holdout split. Until M3, `just install-model` copies a run without the gate. A model trained on unpublishable data stays out of git. | Cross-concept | 2026-10-09 | Felix | [ADR-007](adr/adr-007-model-promotion.md) |
```

In `docs/architecture/09-architecture-decisions.md`, in the ADR-007 row, append to the decision text: `. M0: \`just install-model\` without the gate; a model trained on unpublishable data stays out of git (amendment 2026-10-11)`.

In `docs/architecture/00-concepts/model-contract.md`, section "Manifest", after the first paragraph, add: `Until M3, \`just install-model\` writes the manifest with the fields model, version, contract, file, outputs, run, metrics and installedAt (ADR-007, amendment).`

In `docs/architecture/12-glossary.md`, add these rows at the end of the table:

```markdown
| Install (model) | `just install-model <run>`: copies an exported run into the app without the promote gate. M0 only (ADR-007) |
| Reference outputs | `reference-outputs.json`: the PyTorch probabilities for the 81 reference cells. The phone's outputs must match them (ADR-005) |
```

- [ ] **Step 8: Check the docs and commit.**

Run: `just docs-check` and `just test-ml`
Expected: no broken links, all tests pass.

```bash
/usr/bin/git add ml/src/sudoku_ml/install.py ml/tests/test_install.py justfile .gitignore apps/mobile/assets/models/manifest.json apps/mobile/assets/models/reference-outputs.json docs/architecture
/usr/bin/git commit -m "feat(ml): install an exported run into the app without the promote gate (#5)" -m "The model trained on real cells stays out of git (ADR-013). ADR-007 gets an amendment for M0."
```

---

### Task 3: Preprocessing in TypeScript

**Files:**
- Create: `apps/mobile/src/scanner/preprocess.ts`
- Create: `apps/mobile/src/scanner/preprocess.test.ts`
- Modify: `apps/mobile/package.json` (devDependencies)

**Interfaces:**
- Produces, from `preprocess.ts`:
  - `CELL_SIZE = 64`, `INPUT_SIZE = 32`, `CELLS = 81`, `INPUT_LENGTH = 81 * 32 * 32`.
  - `preprocessCells(cells: Uint8Array): Float32Array`. `cells` holds 81 cell images of 64 × 64 RGB, one after the other, row by row (length 81 × 64 × 64 × 3). The result has length `INPUT_LENGTH`, in the layout `[81, 32, 32, 1]`. It throws a `RangeError` on another input length.

- [ ] **Step 1: Add the PNG decoder for the tests.** From `apps/mobile/`:

```bash
pnpm add -D pngjs@7.0.0 @types/pngjs@6.0.5 --save-exact
```

- [ ] **Step 2: Write the failing tests.** Create `apps/mobile/src/scanner/preprocess.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { CELL_SIZE, CELLS, INPUT_LENGTH, INPUT_SIZE, preprocessCells } from './preprocess'

const FIXTURES = join(__dirname, '../../../../fixtures/preprocess')

function readCellRgb(file: string): Uint8Array {
  const png = PNG.sync.read(readFileSync(join(FIXTURES, file)))
  const rgb = new Uint8Array(CELL_SIZE * CELL_SIZE * 3)
  for (let p = 0; p < CELL_SIZE * CELL_SIZE; p++) {
    rgb[p * 3] = png.data[p * 4]
    rgb[p * 3 + 1] = png.data[p * 4 + 1]
    rgb[p * 3 + 2] = png.data[p * 4 + 2]
  }
  return rgb
}

describe('preprocessCells', () => {
  const pngs = readdirSync(FIXTURES).filter((f) => f.endsWith('.cell.png')).sort()

  it('has all 81 reference pairs', () => {
    expect(pngs).toHaveLength(CELLS)
  })

  it('matches every reference pair within 1/255', () => {
    const cells = new Uint8Array(CELLS * CELL_SIZE * CELL_SIZE * 3)
    pngs.forEach((file, n) => cells.set(readCellRgb(file), n * CELL_SIZE * CELL_SIZE * 3))
    const input = preprocessCells(cells)
    expect(input).toHaveLength(INPUT_LENGTH)
    let worst = 0
    pngs.forEach((file, n) => {
      const expected: number[][] = JSON.parse(
        readFileSync(join(FIXTURES, file.replace('.cell.png', '.expected.json')), 'utf8'),
      ).values
      for (let y = 0; y < INPUT_SIZE; y++) {
        for (let x = 0; x < INPUT_SIZE; x++) {
          const got = input[n * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x]
          worst = Math.max(worst, Math.abs(got - expected[y][x]))
        }
      }
    })
    expect(worst).toBeLessThanOrEqual(1 / 255)
  })

  it('maps white paper to 0 and black ink to 1', () => {
    const white = preprocessCells(new Uint8Array(CELLS * CELL_SIZE * CELL_SIZE * 3).fill(255))
    const black = preprocessCells(new Uint8Array(CELLS * CELL_SIZE * CELL_SIZE * 3))
    expect(Math.max(...white.map(Math.abs))).toBeLessThan(1e-6)
    expect(Math.min(...black)).toBeGreaterThan(1 - 1e-6)
  })

  it('refuses an input of the wrong length', () => {
    expect(() => preprocessCells(new Uint8Array(10))).toThrow(RangeError)
  })
})
```

- [ ] **Step 3: Run them and see them fail.**

Run (from `apps/mobile/`): `pnpm jest src/scanner/preprocess.test.ts`
Expected: FAIL, cannot find module `./preprocess`.

- [ ] **Step 4: Implement.** Create `apps/mobile/src/scanner/preprocess.ts`:

```ts
// The input steps of the model contract (docs/architecture/00-concepts/model-contract.md).
// ml/src/sudoku_ml/preprocess.py implements the same maths. fixtures/preprocess/ pins both.

export const CELL_SIZE = 64
export const INPUT_SIZE = 32
export const CELLS = 81
export const INPUT_LENGTH = CELLS * INPUT_SIZE * INPUT_SIZE
const CROP_START = 6
const CROP_SIZE = 52
const CELL_BYTES = CELL_SIZE * CELL_SIZE * 3

/** W[i * src + j]: the share of output pixel i that source pixel j covers. A dst × src matrix, rows sum to 1. */
function areaWeights(src: number, dst: number): Float64Array {
  'worklet'
  const scale = src / dst
  const weights = new Float64Array(dst * src)
  for (let i = 0; i < dst; i++) {
    const lo = i * scale
    const hi = (i + 1) * scale
    for (let j = Math.floor(lo); j < Math.ceil(hi); j++) {
      const overlap = Math.min(hi, j + 1) - Math.max(lo, j)
      if (overlap > 0) weights[i * src + j] = overlap / scale
    }
  }
  return weights
}

/** cells: 81 cell images of 64 × 64 RGB, one after the other. Returns the [81, 32, 32, 1] model input. */
export function preprocessCells(cells: Uint8Array): Float32Array {
  'worklet'
  if (cells.length !== CELLS * CELL_BYTES) {
    throw new RangeError(`expected ${CELLS * CELL_BYTES} bytes of cell images, got ${cells.length}`)
  }
  const w = areaWeights(CROP_SIZE, INPUT_SIZE)
  const gray = new Float64Array(CROP_SIZE * CROP_SIZE)
  const rows = new Float64Array(INPUT_SIZE * CROP_SIZE)
  const out = new Float32Array(INPUT_LENGTH)
  for (let n = 0; n < CELLS; n++) {
    const base = n * CELL_BYTES
    for (let y = 0; y < CROP_SIZE; y++) {
      for (let x = 0; x < CROP_SIZE; x++) {
        const p = base + ((y + CROP_START) * CELL_SIZE + x + CROP_START) * 3
        gray[y * CROP_SIZE + x] = 0.299 * cells[p] + 0.587 * cells[p + 1] + 0.114 * cells[p + 2]
      }
    }
    // W · crop, then (W · crop) · Wᵀ.
    for (let i = 0; i < INPUT_SIZE; i++) {
      for (let x = 0; x < CROP_SIZE; x++) {
        let sum = 0
        for (let y = 0; y < CROP_SIZE; y++) sum += w[i * CROP_SIZE + y] * gray[y * CROP_SIZE + x]
        rows[i * CROP_SIZE + x] = sum
      }
    }
    const outBase = n * INPUT_SIZE * INPUT_SIZE
    for (let i = 0; i < INPUT_SIZE; i++) {
      for (let k = 0; k < INPUT_SIZE; k++) {
        let sum = 0
        for (let x = 0; x < CROP_SIZE; x++) sum += rows[i * CROP_SIZE + x] * w[k * CROP_SIZE + x]
        out[outBase + i * INPUT_SIZE + k] = 1 - sum / 255
      }
    }
  }
  return out
}
```

- [ ] **Step 5: Run the tests and see them pass.**

Run: `pnpm jest src/scanner/preprocess.test.ts`, then from the root `just lint` and `just typecheck`
Expected: PASS. Note the printed worst difference if you add a temporary log, and remove the log.

- [ ] **Step 6: Commit.**

```bash
/usr/bin/git add apps/mobile/src/scanner/preprocess.ts apps/mobile/src/scanner/preprocess.test.ts apps/mobile/package.json pnpm-lock.yaml
/usr/bin/git commit -m "feat(scanner): preprocess 81 cell images into the model input (#5)"
```

---

### Task 4: The classifier around fast-tflite

**Files:**
- Create: `apps/mobile/src/scanner/classifier.ts`, `apps/mobile/src/scanner/classifier.test.ts`
- Create: `apps/mobile/src/scanner/model.ts`, `apps/mobile/src/scanner/model.test.ts`
- Create: `apps/mobile/src/assets.d.ts`, `apps/mobile/test/tfliteStub.js`
- Modify: `apps/mobile/package.json` (dependency, `jest.moduleNameMapper`), `apps/mobile/jest.setup.ts`, `.dependency-cruiser.cjs`, `apps/mobile/src/scanner/index.ts`

**Interfaces:**
- Consumes: `INPUT_LENGTH`, `CELLS` from `preprocess.ts` (Task 3). `apps/mobile/assets/models/manifest.json` (Task 2).
- Produces, from `classifier.ts`:

```ts
export const SUPPORTED_CONTRACTS: readonly number[]   // [1]
export const DIGIT_CLASSES = 10
export const KIND_CLASSES = ['none', 'printed', 'handwritten', 'notes'] as const
export type Kind = (typeof KIND_CLASSES)[number]
/** digit: 0 means empty. confidence: the lower top probability of the two heads, 0..1. */
export type CellResult = { digit: number; kind: Kind; confidence: number; validPair: boolean }
export type ModelManifest = { model: string; version: string; contract: string; file: string; outputs: { digit: number; kind: number } }
export class ModelContractError extends Error {}
export type RawOutputs = { digit: Float32Array; kind: Float32Array }
/** The part of a fast-tflite TensorflowModel that the classifier uses. */
export type TfliteModel = { outputs: { shape: number[] }[]; runSync(inputs: ArrayBuffer[]): ArrayBuffer[] }
export type Classifier = { manifest: ModelManifest; run(input: Float32Array): RawOutputs; classify(input: Float32Array): CellResult[] }
export function checkManifest(value: unknown): ModelManifest            // throws ModelContractError
export function decodeOutputs(raw: RawOutputs): CellResult[]
export function createClassifier(model: TfliteModel, manifest: ModelManifest): Classifier   // throws ModelContractError
```

- Produces, from `model.ts`: `loadClassifier(): Promise<Classifier>`.

- [ ] **Step 1: Add the dependency and read its types.** From `apps/mobile/`:

```bash
pnpm add react-native-fast-tflite@3.0.1 --save-exact
grep -rn "runSync\|outputs\|shape\|loadTensorflowModel" node_modules/react-native-fast-tflite/src --include=*.ts | head -30
```

Check that `TensorflowModel` has `outputs` with a `shape: number[]` and `runSync(input: ArrayBuffer[]): ArrayBuffer[]`. fast-tflite 3.0.1 was built with nitrogen 0.35, and the app has `react-native-nitro-modules` 0.37.1. If the names or types differ from `TfliteModel` above, adapt `TfliteModel` and tell the controller. Do not change the nitro-modules version.

- [ ] **Step 2: Wire Jest, types and boundaries.**

`apps/mobile/test/tfliteStub.js`:

```js
// A fresh clone has no model file (ADR-007, amendment). Jest gets this asset id instead.
module.exports = 1
```

In `apps/mobile/package.json`, inside `"jest"`, add:

```json
"moduleNameMapper": { "\\.tflite$": "<rootDir>/test/tfliteStub.js" }
```

`apps/mobile/src/assets.d.ts`:

```ts
declare module '*.tflite' {
  const asset: number
  export default asset
}
```

In `apps/mobile/jest.setup.ts`, add:

```ts
jest.mock('react-native-fast-tflite', () => ({
  loadTensorflowModel: jest.fn(),
}))
```

In `.dependency-cruiser.cjs`, change the `no-unresolvable` rule's `to` to:

```js
      // The model file is git-ignored (ADR-007, amendment), so CI cannot resolve it.
      to: { couldNotResolve: true, pathNot: '\\.tflite$' },
```

- [ ] **Step 3: Write the failing classifier tests.** Create `apps/mobile/src/scanner/classifier.test.ts`:

```ts
import {
  checkManifest,
  createClassifier,
  decodeOutputs,
  ModelContractError,
  type ModelManifest,
  type TfliteModel,
} from './classifier'
import { CELLS, INPUT_LENGTH } from './preprocess'

const MANIFEST: ModelManifest = {
  model: 'cell-classifier',
  version: '1.0.0',
  contract: '1.0',
  file: 'cell-classifier.tflite',
  outputs: { digit: 0, kind: 1 },
}

/** Every cell gets the same rows. One-hot rows unless a probability is given. */
function rows(width: number, top: number, probability = 1): Float32Array {
  const out = new Float32Array(CELLS * width)
  for (let n = 0; n < CELLS; n++) {
    for (let c = 0; c < width; c++) out[n * width + c] = c === top ? probability : (1 - probability) / (width - 1)
  }
  return out
}

/** A model like fast-tflite: it writes into the same output buffers on every call. */
function fakeModel(digit: Float32Array, kind: Float32Array, order: 'digit-first' | 'kind-first' = 'digit-first') {
  const digitBuffer = new ArrayBuffer(digit.byteLength)
  const kindBuffer = new ArrayBuffer(kind.byteLength)
  const received: ArrayBuffer[] = []
  const model: TfliteModel & { received: ArrayBuffer[]; next: (d: Float32Array, k: Float32Array) => void } = {
    received,
    outputs: order === 'digit-first' ? [{ shape: [81, 10] }, { shape: [81, 4] }] : [{ shape: [81, 4] }, { shape: [81, 10] }],
    runSync: (inputs) => {
      received.push(inputs[0])
      return order === 'digit-first' ? [digitBuffer, kindBuffer] : [kindBuffer, digitBuffer]
    },
    next: (d, k) => {
      new Float32Array(digitBuffer).set(d)
      new Float32Array(kindBuffer).set(k)
    },
  }
  model.next(digit, kind)
  return model
}

describe('checkManifest', () => {
  it('accepts contract 1.x', () => {
    expect(checkManifest({ ...MANIFEST, contract: '1.3' })).toEqual({ ...MANIFEST, contract: '1.3' })
  })

  it.each([
    ['another major', { ...MANIFEST, contract: '2.0' }],
    ['a malformed version', { ...MANIFEST, contract: 'x' }],
    ['no outputs', { ...MANIFEST, outputs: undefined }],
    ['the same index twice', { ...MANIFEST, outputs: { digit: 0, kind: 0 } }],
    ['not an object', null],
  ])('refuses %s', (_name, value) => {
    expect(() => checkManifest(value)).toThrow(ModelContractError)
  })
})

describe('decodeOutputs', () => {
  it('reads the top class and the lower probability as confidence', () => {
    const [cell] = decodeOutputs({ digit: rows(10, 7, 0.9), kind: rows(4, 2, 0.8) })
    expect(cell.digit).toBe(7)
    expect(cell.kind).toBe('handwritten')
    expect(cell.confidence).toBeCloseTo(0.8)
    expect(cell.validPair).toBe(true)
  })

  it('marks a digit with kind none as an invalid pair', () => {
    expect(decodeOutputs({ digit: rows(10, 3), kind: rows(4, 0) })[0].validPair).toBe(false)
  })

  it('accepts empty with notes', () => {
    const [cell] = decodeOutputs({ digit: rows(10, 0), kind: rows(4, 3) })
    expect(cell).toMatchObject({ digit: 0, kind: 'notes', validPair: true })
  })

  it('returns 81 cells', () => {
    expect(decodeOutputs({ digit: rows(10, 1), kind: rows(4, 1) })).toHaveLength(CELLS)
  })
})

describe('createClassifier', () => {
  it('reads the outputs by the manifest index, not the tensor order', () => {
    const model = fakeModel(rows(10, 5), rows(4, 1), 'kind-first')
    const classifier = createClassifier(model, { ...MANIFEST, outputs: { digit: 1, kind: 0 } })
    expect(classifier.classify(new Float32Array(INPUT_LENGTH))[0]).toMatchObject({ digit: 5, kind: 'printed' })
  })

  it('refuses a model whose output shapes do not fit the manifest', () => {
    const model = fakeModel(rows(10, 5), rows(4, 1), 'kind-first')
    expect(() => createClassifier(model, MANIFEST)).toThrow(ModelContractError)
  })

  it('keeps the first results when the model reuses its output buffers', () => {
    const model = fakeModel(rows(10, 2), rows(4, 1))
    const classifier = createClassifier(model, MANIFEST)
    const first = classifier.run(new Float32Array(INPUT_LENGTH))
    model.next(rows(10, 9), rows(4, 2))
    classifier.run(new Float32Array(INPUT_LENGTH))
    expect(decodeOutputs(first)[0].digit).toBe(2)
  })

  it('sends exactly the input floats when the input is a view with an offset', () => {
    const model = fakeModel(rows(10, 2), rows(4, 1))
    const big = new Float32Array(INPUT_LENGTH + 8)
    big[4] = 0.5
    createClassifier(model, MANIFEST).run(big.subarray(4, 4 + INPUT_LENGTH))
    const sent = new Float32Array(model.received[0])
    expect(sent).toHaveLength(INPUT_LENGTH)
    expect(sent[0]).toBe(0.5)
  })

  it('refuses an input of the wrong length', () => {
    const classifier = createClassifier(fakeModel(rows(10, 2), rows(4, 1)), MANIFEST)
    expect(() => classifier.run(new Float32Array(10))).toThrow(RangeError)
  })

  it('refuses an output of the wrong size', () => {
    const model = fakeModel(rows(10, 2), rows(4, 1))
    model.runSync = () => [new ArrayBuffer(8), new ArrayBuffer(8)]
    expect(() => createClassifier(model, MANIFEST).run(new Float32Array(INPUT_LENGTH))).toThrow(ModelContractError)
  })
})
```

- [ ] **Step 4: Run them and see them fail.**

Run: `pnpm jest src/scanner/classifier.test.ts`
Expected: FAIL, cannot find module `./classifier`.

- [ ] **Step 5: Implement.** Create `apps/mobile/src/scanner/classifier.ts`:

```ts
import { CELLS, INPUT_LENGTH } from './preprocess'

// docs/architecture/00-concepts/model-contract.md: outputs, classes, valid pairs and versioning.

/** SUD-09: the contract major versions this scanner implements. */
export const SUPPORTED_CONTRACTS: readonly number[] = [1]
export const DIGIT_CLASSES = 10
export const KIND_CLASSES = ['none', 'printed', 'handwritten', 'notes'] as const
export type Kind = (typeof KIND_CLASSES)[number]

/** digit: 0 means empty. confidence: the lower top probability of the two heads, 0..1. */
export type CellResult = { digit: number; kind: Kind; confidence: number; validPair: boolean }

export type ModelManifest = {
  model: string
  version: string
  contract: string
  file: string
  outputs: { digit: number; kind: number }
}

export class ModelContractError extends Error {
  name = 'ModelContractError'
}

/** digit: [81, 10] probabilities, kind: [81, 4], row by row. */
export type RawOutputs = { digit: Float32Array; kind: Float32Array }

/** The part of a fast-tflite TensorflowModel that the classifier uses. */
export type TfliteModel = { outputs: { shape: number[] }[]; runSync(inputs: ArrayBuffer[]): ArrayBuffer[] }

export type Classifier = {
  manifest: ModelManifest
  run(input: Float32Array): RawOutputs
  classify(input: Float32Array): CellResult[]
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function checkManifest(value: unknown): ModelManifest {
  const m = value as Partial<ModelManifest> | null
  if (m == null || typeof m !== 'object') throw new ModelContractError('the model manifest is missing')
  const major = Number((m.contract ?? '').split('.')[0])
  if (!Number.isInteger(major) || !SUPPORTED_CONTRACTS.includes(major)) {
    throw new ModelContractError(`the scanner does not implement model contract ${String(m.contract)}`)
  }
  const outputs = m.outputs
  if (outputs == null || !isIndex(outputs.digit) || !isIndex(outputs.kind) || outputs.digit === outputs.kind) {
    throw new ModelContractError('the model manifest has no valid output indices')
  }
  return m as ModelManifest
}

function argmax(values: Float32Array, start: number, width: number): number {
  'worklet'
  let best = 0
  for (let c = 1; c < width; c++) if (values[start + c] > values[start + best]) best = c
  return best
}

export function decodeOutputs(raw: RawOutputs): CellResult[] {
  'worklet'
  const width = KIND_CLASSES.length
  const cells: CellResult[] = []
  for (let n = 0; n < CELLS; n++) {
    const digit = argmax(raw.digit, n * DIGIT_CLASSES, DIGIT_CLASSES)
    const kindIndex = argmax(raw.kind, n * width, width)
    const kind = KIND_CLASSES[kindIndex]
    const validPair = digit === 0 ? kind === 'none' || kind === 'notes' : kind === 'printed' || kind === 'handwritten'
    const confidence = Math.min(raw.digit[n * DIGIT_CLASSES + digit], raw.kind[n * width + kindIndex])
    cells.push({ digit, kind, confidence, validPair })
  }
  return cells
}

function sameShape(shape: number[] | undefined, expected: number[]): boolean {
  return shape != null && shape.length === expected.length && shape.every((v, i) => v === expected[i])
}

/** Copies an output: fast-tflite writes the next call into the same buffer. */
function copyOutput(buffer: ArrayBuffer | undefined, length: number, name: string): Float32Array {
  if (buffer == null || buffer.byteLength !== length * 4) {
    throw new ModelContractError(`the ${name} output has ${buffer?.byteLength ?? 0} bytes, expected ${length * 4}`)
  }
  return new Float32Array(buffer.slice(0))
}

export function createClassifier(model: TfliteModel, manifest: ModelManifest): Classifier {
  const { digit, kind } = manifest.outputs
  if (!sameShape(model.outputs[digit]?.shape, [CELLS, DIGIT_CLASSES])) {
    throw new ModelContractError(`output ${digit} is not the digit head [81, 10]`)
  }
  if (!sameShape(model.outputs[kind]?.shape, [CELLS, KIND_CLASSES.length])) {
    throw new ModelContractError(`output ${kind} is not the kind head [81, 4]`)
  }
  const run = (input: Float32Array): RawOutputs => {
    if (input.length !== INPUT_LENGTH) throw new RangeError(`expected ${INPUT_LENGTH} input values, got ${input.length}`)
    const exact = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
    const outputs = model.runSync([exact])
    return {
      digit: copyOutput(outputs[digit], CELLS * DIGIT_CLASSES, 'digit'),
      kind: copyOutput(outputs[kind], CELLS * KIND_CLASSES.length, 'kind'),
    }
  }
  return { manifest, run, classify: (input) => decodeOutputs(run(input)) }
}
```

Note: `run` and `copyOutput` are not worklets. They capture the fast-tflite model, a Nitro object, and #6 decides how it reaches the scanner runtime. `input.buffer.slice(...)` gives a new `ArrayBuffer` that holds only the input floats. With an input that owns its whole buffer, this is one copy of 324 KB, which is cheap next to the model call.

- [ ] **Step 6: Run the classifier tests and see them pass.**

Run: `pnpm jest src/scanner/classifier.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing loader test.** Create `apps/mobile/src/scanner/model.test.ts`:

```ts
import { loadTensorflowModel } from 'react-native-fast-tflite'
import { loadClassifier } from './model'

describe('loadClassifier', () => {
  it('loads the bundled model on the CPU and checks it against the manifest', async () => {
    jest.mocked(loadTensorflowModel).mockResolvedValue({
      outputs: [{ shape: [81, 10] }, { shape: [81, 4] }],
      runSync: jest.fn(),
    } as never)
    const classifier = await loadClassifier()
    expect(loadTensorflowModel).toHaveBeenCalledWith(1, [])
    expect(classifier.manifest.contract.startsWith('1.')).toBe(true)
  })
})
```

The asset id `1` comes from `test/tfliteStub.js`. The manifest is the real `assets/models/manifest.json` from Task 2.

- [ ] **Step 8: Run it and see it fail.**

Run: `pnpm jest src/scanner/model.test.ts`
Expected: FAIL, cannot find module `./model`.

- [ ] **Step 9: Implement.** Create `apps/mobile/src/scanner/model.ts`:

```ts
import { loadTensorflowModel } from 'react-native-fast-tflite'
import manifest from '../../assets/models/manifest.json'
// `just install-model <run>` writes this file. It is not in git (ADR-007, amendment), so a clone without it does not bundle.
import modelFile from '../../assets/models/cell-classifier.tflite'
import { checkManifest, type Classifier, createClassifier } from './classifier'

/** Loads the model on the CPU: fast-tflite 3 has no working Metal delegate (model contract). */
export async function loadClassifier(): Promise<Classifier> {
  const checked = checkManifest(manifest)
  const model = await loadTensorflowModel(modelFile, [])
  return createClassifier(model, checked)
}
```

If typecheck refuses the JSON import, check that `resolveJsonModule` is on in `expo/tsconfig.base`. If it is off, add `"resolveJsonModule": true` to `apps/mobile/tsconfig.json`.

- [ ] **Step 10: Export the public names.** In `apps/mobile/src/scanner/index.ts`, add:

```ts
export {
  type CellResult,
  type Classifier,
  type Kind,
  ModelContractError,
  type RawOutputs,
  SUPPORTED_CONTRACTS,
} from './classifier'
export { loadClassifier } from './model'
export { INPUT_LENGTH, preprocessCells } from './preprocess'
```

- [ ] **Step 11: Run every check.**

Run from the root: `just test-ts`, `just lint`, `just typecheck`
Expected: all pass. `just lint` includes `just boundaries`.

- [ ] **Step 12: Check a clone without the model.** Move the model away, run the checks, and move it back:

```bash
mv apps/mobile/assets/models/cell-classifier.tflite /private/tmp/claude-501/-Users-felix-projects-sudoku-18-dot-field/e8df444d-c5bd-409b-becd-13e677cc2cae/scratchpad/cell-classifier.tflite.bak
just test-ts && just typecheck && just boundaries
mv /private/tmp/claude-501/-Users-felix-projects-sudoku-18-dot-field/e8df444d-c5bd-409b-becd-13e677cc2cae/scratchpad/cell-classifier.tflite.bak apps/mobile/assets/models/cell-classifier.tflite
```

Expected: all three pass without the file.

- [ ] **Step 13: Commit.**

```bash
/usr/bin/git add apps/mobile/src/scanner apps/mobile/src/assets.d.ts apps/mobile/test/tfliteStub.js apps/mobile/package.json apps/mobile/jest.setup.ts apps/mobile/tsconfig.json .dependency-cruiser.cjs pnpm-lock.yaml
/usr/bin/git commit -m "feat(scanner): classify 81 cells with fast-tflite and check the model contract (#5)"
```

---

### Task 5: The parity check in development builds

**Files:**
- Create: `apps/mobile/src/scanner/parity.ts`, `apps/mobile/src/scanner/parity.test.ts`
- Modify: `apps/mobile/src/scanner/index.ts`, `apps/mobile/App.tsx`

**Interfaces:**
- Consumes: `loadClassifier`, `Classifier`, `RawOutputs` (Task 4). `INPUT_LENGTH` (Task 3). `reference-outputs.json` (Task 1).
- Produces, from `parity.ts`:

```ts
export type ReferenceOutputs = { run: string; inputs: string; digit: number[][]; kind: number[][] }
/** maxDiff: the largest absolute probability difference. Mismatches: cell indices with another top class. medianMs: of 20 calls. */
export type ParityReport = { maxDiff: number; digitMismatches: number[]; kindMismatches: number[]; medianMs: number }
export const PARITY_RUNS = 20
export function decodeInputs(base64: string): Float32Array
export function compareOutputs(raw: RawOutputs, reference: ReferenceOutputs): Omit<ParityReport, 'medianMs'>
export function measureParity(classifier: Classifier, reference: ReferenceOutputs, now?: () => number): ParityReport
export function formatParity(report: ParityReport): string
export async function checkModelParity(reference: ReferenceOutputs): Promise<ParityReport>
```

- [ ] **Step 1: Write the failing tests.** Create `apps/mobile/src/scanner/parity.test.ts`:

```ts
import type { Classifier, RawOutputs } from './classifier'
import { compareOutputs, decodeInputs, formatParity, measureParity, PARITY_RUNS, type ReferenceOutputs } from './parity'
import { INPUT_LENGTH } from './preprocess'

function oneHot(width: number, top: number): number[][] {
  return Array.from({ length: 81 }, () => Array.from({ length: width }, (_, c) => (c === top ? 1 : 0)))
}

function base64Of(values: Float32Array): string {
  return Buffer.from(values.buffer).toString('base64')
}

const REFERENCE: ReferenceOutputs = {
  run: 'test-run',
  inputs: base64Of(new Float32Array(INPUT_LENGTH).fill(0.25)),
  digit: oneHot(10, 3),
  kind: oneHot(4, 1),
}

function raw(digit: number[][], kind: number[][]): RawOutputs {
  return { digit: Float32Array.from(digit.flat()), kind: Float32Array.from(kind.flat()) }
}

describe('decodeInputs', () => {
  it('decodes little-endian float32 values', () => {
    const inputs = decodeInputs(REFERENCE.inputs)
    expect(inputs).toHaveLength(INPUT_LENGTH)
    expect(inputs[INPUT_LENGTH - 1]).toBe(0.25)
  })
})

describe('compareOutputs', () => {
  it('finds no difference for equal outputs', () => {
    expect(compareOutputs(raw(REFERENCE.digit, REFERENCE.kind), REFERENCE)).toEqual({
      maxDiff: 0,
      digitMismatches: [],
      kindMismatches: [],
    })
  })

  it('reports the largest difference and the cells with another top class', () => {
    const digit = oneHot(10, 3)
    digit[5] = digit[5].map((_, c) => (c === 8 ? 1 : 0))
    const kind = oneHot(4, 1)
    kind[2][1] = 0.9996
    const result = compareOutputs(raw(digit, kind), REFERENCE)
    expect(result.digitMismatches).toEqual([5])
    expect(result.kindMismatches).toEqual([])
    expect(result.maxDiff).toBeCloseTo(1)
  })
})

describe('measureParity', () => {
  it('sends the reference inputs and takes the median of the timed runs', () => {
    const sent: Float32Array[] = []
    const classifier: Classifier = {
      manifest: { model: 'm', version: '1.0.0', contract: '1.0', file: 'f', outputs: { digit: 0, kind: 1 } },
      run: (input) => (sent.push(input), raw(REFERENCE.digit, REFERENCE.kind)),
      classify: () => [],
    }
    let clock = 0
    let call = 0
    // Each run takes 1 ms longer than the one before it, so the median is known.
    const now = () => (call++ % 2 === 0 ? clock : (clock += Math.floor(call / 2)))
    const report = measureParity(classifier, REFERENCE, now)
    expect(sent).toHaveLength(PARITY_RUNS + 1)
    expect(sent[0][0]).toBe(0.25)
    expect(report.medianMs).toBe(10.5)
    expect(report.maxDiff).toBe(0)
  })
})

describe('formatParity', () => {
  it('says PASS when the report meets ADR-005 and the 100 ms budget', () => {
    expect(formatParity({ maxDiff: 2e-7, digitMismatches: [], kindMismatches: [], medianMs: 12 })).toMatch(/^PASS/)
  })

  it('says FAIL for a mismatch, a large difference or a slow call', () => {
    expect(formatParity({ maxDiff: 0, digitMismatches: [4], kindMismatches: [], medianMs: 12 })).toMatch(/^FAIL/)
    expect(formatParity({ maxDiff: 2e-3, digitMismatches: [], kindMismatches: [], medianMs: 12 })).toMatch(/^FAIL/)
    expect(formatParity({ maxDiff: 0, digitMismatches: [], kindMismatches: [], medianMs: 101 })).toMatch(/^FAIL/)
  })
})
```

- [ ] **Step 2: Run them and see them fail.**

Run: `pnpm jest src/scanner/parity.test.ts`
Expected: FAIL, cannot find module `./parity`.

- [ ] **Step 3: Implement.** Create `apps/mobile/src/scanner/parity.ts`:

```ts
import { type Classifier, DIGIT_CLASSES, KIND_CLASSES, type RawOutputs } from './classifier'
import { loadClassifier } from './model'

// ADR-005 and issue #5: the phone must give PyTorch's answers on the 81 reference cells, fast enough.

export type ReferenceOutputs = { run: string; inputs: string; digit: number[][]; kind: number[][] }
/** maxDiff: the largest absolute probability difference. Mismatches: cell indices with another top class. medianMs: of PARITY_RUNS calls. */
export type ParityReport = { maxDiff: number; digitMismatches: number[]; kindMismatches: number[]; medianMs: number }

export const PARITY_RUNS = 20
const MAX_DIFF = 1e-3
const MAX_MEDIAN_MS = 100

/** The export writes little-endian float32. Every iPhone is little-endian. */
export function decodeInputs(base64: string): Float32Array {
  const text = atob(base64)
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

function topIndex(row: ArrayLike<number>): number {
  let best = 0
  for (let c = 1; c < row.length; c++) if (row[c] > row[best]) best = c
  return best
}

function compareHead(got: Float32Array, expected: number[][], width: number) {
  let maxDiff = 0
  const mismatches: number[] = []
  expected.forEach((row, n) => {
    const gotRow = got.subarray(n * width, (n + 1) * width)
    for (let c = 0; c < width; c++) maxDiff = Math.max(maxDiff, Math.abs(gotRow[c] - row[c]))
    if (topIndex(gotRow) !== topIndex(row)) mismatches.push(n)
  })
  return { maxDiff, mismatches }
}

export function compareOutputs(raw: RawOutputs, reference: ReferenceOutputs): Omit<ParityReport, 'medianMs'> {
  const digit = compareHead(raw.digit, reference.digit, DIGIT_CLASSES)
  const kind = compareHead(raw.kind, reference.kind, KIND_CLASSES.length)
  return {
    maxDiff: Math.max(digit.maxDiff, kind.maxDiff),
    digitMismatches: digit.mismatches,
    kindMismatches: kind.mismatches,
  }
}

/** One untimed call first: the first call allocates the tensors. */
export function measureParity(
  classifier: Classifier,
  reference: ReferenceOutputs,
  now: () => number = () => performance.now(),
): ParityReport {
  const inputs = decodeInputs(reference.inputs)
  const result = compareOutputs(classifier.run(inputs), reference)
  const times: number[] = []
  for (let i = 0; i < PARITY_RUNS; i++) {
    const started = now()
    classifier.run(inputs)
    times.push(now() - started)
  }
  times.sort((a, b) => a - b)
  const medianMs = (times[PARITY_RUNS / 2 - 1] + times[PARITY_RUNS / 2]) / 2
  return { ...result, medianMs }
}

export function formatParity(report: ParityReport): string {
  const pass =
    report.digitMismatches.length === 0 &&
    report.kindMismatches.length === 0 &&
    report.maxDiff <= MAX_DIFF &&
    report.medianMs <= MAX_MEDIAN_MS
  return (
    `${pass ? 'PASS' : 'FAIL'}: max diff ${report.maxDiff.toExponential(2)}, ` +
    `digit mismatches [${report.digitMismatches.join(', ')}], kind mismatches [${report.kindMismatches.join(', ')}], ` +
    `median ${report.medianMs.toFixed(1)} ms over ${PARITY_RUNS} calls`
  )
}

export async function checkModelParity(reference: ReferenceOutputs): Promise<ParityReport> {
  return measureParity(await loadClassifier(), reference)
}
```

- [ ] **Step 4: Run the tests and see them pass.**

Run: `pnpm jest src/scanner/parity.test.ts`
Expected: PASS. If the median test fails, check the fake clock: call pairs give durations 1, 2, …, 20 ms, so the median is 10.5.

- [ ] **Step 5: Export and log it.** In `apps/mobile/src/scanner/index.ts`, add:

```ts
export { checkModelParity, formatParity, type ParityReport, type ReferenceOutputs } from './parity'
```

In `apps/mobile/App.tsx`, import `checkModelParity`, `formatParity` and `type ReferenceOutputs` from `./src/scanner`, and add below `logOpenCVProbe`:

```ts
/** Logs whether the model on this phone matches PyTorch (ADR-005). It never stops the app from starting. */
export function logModelParity(reference: ReferenceOutputs) {
  checkModelParity(reference)
    .then((report) => console.log(`[scanner] model parity ${formatParity(report)}`))
    .catch((error: unknown) =>
      console.log(`[scanner] model parity FAILED: ${error instanceof Error ? error.message : String(error)}`),
    )
}
```

Replace `if (__DEV__) logOpenCVProbe()` with:

```ts
if (__DEV__) {
  logOpenCVProbe()
  // Inside the __DEV__ branch, so a release bundle leaves the 450 KB reference file out.
  logModelParity(require('./assets/models/reference-outputs.json'))
}
```

If oxlint reports `no-require-imports` on this line, add above it `// oxlint-disable-next-line typescript/no-require-imports -- a static import would put the reference file into release bundles`.

- [ ] **Step 6: Run every check.**

Run from the root: `just test-ts`, `just lint`, `just typecheck`, `just bundle`
Expected: all pass. `just bundle` proves that Metro bundles the model and the JSON files.

- [ ] **Step 7: Commit.**

```bash
/usr/bin/git add apps/mobile/src/scanner apps/mobile/App.tsx
/usr/bin/git commit -m "feat(scanner): check the model against PyTorch at start in development builds (#5)"
```

---

### Task 6: Run it on the iPhone and record the numbers

This task needs the developer. Do not start the build before the developer says that the iPhone is connected.

**Files:**
- Modify: `docs/architecture/adr/adr-005-pytorch-to-tflite.md` (section "Validation")

- [ ] **Step 1: Ask the developer to connect the iPhone.** Wait for the answer.

- [ ] **Step 2: Build and run.** From `apps/mobile/`:

```bash
pnpm exec expo run:ios --device
```

Expected: the app starts on the iPhone. The Metro log shows `[scanner] fast-opencv works` and one `[scanner] model parity PASS: …` line. If the build fails strangely (Pods, signing, Nitro version), stop and ask the developer for the environment notes from the previous session.

- [ ] **Step 3: Read the numbers.** Copy the parity line. Restart the app twice. Record the three medians. A FAIL stops the task: report the line to the controller, and use superpowers:systematic-debugging.

- [ ] **Step 4: Record them in ADR-005.** In `docs/architecture/adr/adr-005-pytorch-to-tflite.md`, after the "Measured with the trained model" list, add:

```markdown
**Measured on the iPhone** (development build, fast-tflite 3.0.1, CPU delegate, run
`20261009-210543-cell-classifier`):

- The top class of both heads matches PyTorch on all 81 reference cells.
- The largest probability difference is <maxDiff from the log>.
- One batched call for 81 cells takes <median> ms (median of 20 calls, three app starts: <m1>, <m2>, <m3> ms).
```

Fill in the values from the log. Do not commit placeholder text.

- [ ] **Step 5: Run the final checks and commit.**

Run: `just lint`, `just typecheck`, `just test`, `just docs-check`

```bash
/usr/bin/git add docs/architecture/adr/adr-005-pytorch-to-tflite.md
/usr/bin/git commit -m "docs: record the model parity and speed on the iPhone (#5)"
```

- [ ] **Step 6: Report to the developer.** Give the parity line and the medians. Propose this comment for issue #5, and ask before you post it or tick the acceptance criteria:

```markdown
Measured on the iPhone (development build, fast-tflite 3.0.1, CPU): same top class on both heads for all 81 reference cells, max probability difference <maxDiff>, one batched call for 81 cells <median> ms (median of 20).
```

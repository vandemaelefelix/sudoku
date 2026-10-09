# Cell Classifier Implementation Plan (issue #4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train the two-head sudoku cell classifier (digit and kind) on synthetic and real cells, export it to a float32 TFLite file that the iPhone runtime can load, create the reference fixtures that keep Python and the app in agreement, and add the tools to find and fix wrong labels. GitHub issue #4.

**Architecture:** `ml/src/sudoku_ml/` gets one small module per job. `preprocess` implements the model contract (NumPy for files, PyTorch for training batches, identical maths). `synthetic` renders printed, notes and empty cells. `dataset` loads the real cells, groups near-identical cells, and splits by group. `augment` distorts training batches on the GPU. `model` is the global-average-pooling CNN with two heads. `train` runs a TOML config and writes a run folder. `export` writes the `.tflite`, checks it against PyTorch and against the TFLite 2.17 op table. `suspects`, `relabel` and `manifest` find, fix and record labels. Every job has a `just` recipe.

**Tech Stack:** Python 3.12, uv, PyTorch 2.13.0 (MPS on the Mac, CPU wheels on Linux), litert-torch 0.9.4, ai-edge-litert 2.2.0, NumPy, Pillow 12.3.0, OpenCV (tests only), pytest, ruff.

**Spec (read these first):**
- `AGENTS.md` (working rules, writing style, git rules)
- `docs/architecture/00-concepts/model-contract.md` (input, outputs, preprocessing, runtime)
- `docs/architecture/adr/adr-005-pytorch-to-tflite.md`, `adr-006-two-head-cell-classifier.md`, `adr-009-training-data-outside-git.md`, `adr-013-fixtures-and-data-licensing.md`
- `docs/research/2026-10-09-cell-classifier-research.md` (why the design is what it is, with measurements)
- `ml/README.md`, `ml/DATA_SOURCES.md` (the data in `ml/data/`, not in git)
- Issue #4: `gh issue view 4`

## Context for a fresh agent

- The repository is a monorepo. You work only in `ml/`, `fixtures/preprocess/`, `justfile`, `.github/workflows/ci-ml.yml` and docs.
- `ml/data/` is gitignored and exists only on the developer's Mac. It holds `cells/{empty,1..9,unlabeled}/<id16>.png` (16,277 real 71 × 71 RGB cells, labelled by folder) and `photos/`. `ml/datasets/cells.csv` (id, label) is its manifest in git. **Never commit anything from `ml/data/`.**
- `ml/src/sudoku_ml/contract.py` already has `CONTRACT_VERSION`, `DIGIT_CLASSES`, `KIND_CLASSES` and `is_valid_pair`.
- The research (see the record) measured: this network and recipe reach about 98.7 % digit accuracy on the real cells. About 0.6 % of the real labels are wrong.
- Task 11 has a **human step**: the developer checks the suspect labels. Stop there and ask.

## Global Constraints

- Branch `feature/4-cell-classifier`. The pull request targets `develop`. Commits are Conventional Commits ending with `(#4)`. Do not push to `main` or `develop`.
- Model contract: input `[81, 32, 32, 1]` float32 (static batch), ink `1.0`, paper `0.0`. Outputs `digit` `[81, 10]` (`empty, 1 … 9`) and `kind` `[81, 4]` (`none, printed, handwritten, notes`), probabilities (softmax inside the model). **float32 weights only.**
- Preprocessing: grayscale `0.299 R + 0.587 G + 0.114 B` in float32 without rounding, crop rows and columns `[6, 58)`, exact area average to 32 × 32 (`W · crop · Wᵀ`), `x = 1 − gray / 255`.
- Every op and op version in the `.tflite` must be supported by TFLite 2.17.
- Model: fewer than 100,000 parameters, `.tflite` at most 1 MB.
- Committed fixtures are synthetic only. No real cell or photo goes into git (ADR-013).
- The real cells may train models that stay private. The model card says so.
- Fonts come only from `google/fonts` under `ofl/`, committed with their `OFL.txt`.
- On Linux, torch comes from the PyTorch CPU index. CI runs a smoke config only.
- Prose follows the writing rules in `AGENTS.md`.

## Review Focus

1. **Preprocessing drifts** between files (NumPy), training batches (PyTorch) and the contract. Expected: all three agree within 1e-5, and OpenCV's `INTER_AREA` agrees within 1e-5. Pinned in Task 2.
2. **Near-identical cells leak across the split.** Expected: every group of near-identical cells is on one side only. Pinned in Task 5.
3. **Unknown kinds train the kind head**, or the kind head pulls the digit head. Expected: unknown kinds add no loss, and the kind loss has weight 0.4. Pinned in Task 8.
4. **The `.tflite` does not load on the phone runtime** (an op version above TFLite 2.17), or its outputs are read in the wrong order. Expected: export fails on an unsupported op version, and outputs are found by shape. Pinned in Task 9.
5. **Relabelling breaks the dataset** (a file moved to an unknown label, or a manifest that no longer matches the folders). Expected: relabel rejects bad input, and the manifest is rewritten from the folders. Pinned in Tasks 10 and 11.

## File Structure

```
ml/
├── pyproject.toml                      # pinned deps, CPU torch index on Linux
├── configs/
│   ├── cell-classifier.toml            # the real run
│   └── smoke.toml                      # seconds-long run for tests and CI
├── fonts/                              # 7 OFL fonts + OFL.txt each + README
├── src/sudoku_ml/
│   ├── contract.py                     # + sizes, batch, index helpers
│   ├── preprocess.py                   # area_weights, preprocess_cell, preprocess_batch, to_cell_image
│   ├── synthetic.py                    # Sample, render_cell, generate
│   ├── fixtures.py                     # write / load the 81 reference pairs
│   ├── dataset.py                      # load_cells, dhash, group_ids, split_by_group, stack
│   ├── augment.py                      # augment (PyTorch, GPU)
│   ├── model.py                        # CellClassifier, ExportModel
│   ├── train.py                        # Config, loss, evaluate, train
│   ├── tflite_2_17_ops.json            # max op version per builtin op in TFLite 2.17
│   ├── export.py                       # export, run_tflite, check_op_versions
│   ├── manifest.py                     # pixel_id, write_cells_manifest
│   ├── suspects.py                     # rank_suspects, find_suspects, contact sheets
│   └── relabel.py                      # apply_relabels
└── tests/                              # one test file per module
fixtures/preprocess/                    # 81 synthetic reference pairs
```

---

### Task 1: Dependencies and contract constants

**Files:**
- Modify: `ml/pyproject.toml`, `ml/src/sudoku_ml/contract.py`
- Test: `ml/tests/test_contract.py`

**Interfaces:**
- Produces: in `sudoku_ml.contract`: `CELL_SIZE = 64`, `INPUT_SIZE = 32`, `CROP = (6, 58)`, `BATCH = 81`, `UNKNOWN_KIND = -1`, `digit_index(label: str) -> int`, `kind_index(kind: str) -> int`.

- [ ] **Step 1: Add the dependencies**

```bash
cd ml
uv add "torch==2.13.0" "litert-torch==0.9.4" "ai-edge-litert==2.2.0" "numpy>=2.2" "pillow==12.3.0"
uv add --dev "opencv-python-headless==5.0.0.93"
```
Add to `ml/pyproject.toml`, then run `uv lock && uv sync`:
```toml
# litert-torch 0.9.4 requires torch below 2.14 (ADR-005).
# On Linux (CI), torch comes from the CPU index, so CI never downloads CUDA wheels.
[tool.uv.sources]
torch = [{ index = "pytorch-cpu", marker = "sys_platform == 'linux'" }]

[[tool.uv.index]]
name = "pytorch-cpu"
url = "https://download.pytorch.org/whl/cpu"
explicit = true
```
Run: `uv run python -c "import torch, litert_torch; print(torch.__version__, torch.backends.mps.is_available())"`
Expected: `2.13.0 True`.

- [ ] **Step 2: Write the failing tests** (append to `ml/tests/test_contract.py`)

```python
from sudoku_ml.contract import (
    BATCH, CELL_SIZE, CROP, INPUT_SIZE, UNKNOWN_KIND, digit_index, kind_index,
)


def test_sizes_follow_the_contract():
    assert (CELL_SIZE, INPUT_SIZE, CROP, BATCH) == (64, 32, (6, 58), 81)


def test_digit_index_follows_class_order():
    assert (digit_index("empty"), digit_index("9")) == (0, 9)


def test_kind_index_follows_class_order():
    assert (kind_index("none"), kind_index("notes")) == (0, 3)


def test_unknown_kind_is_negative():
    assert UNKNOWN_KIND == -1
```

- [ ] **Step 3: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_contract.py`
Expected: FAIL, `ImportError: cannot import name 'BATCH'`.

- [ ] **Step 4: Implement** (append to `ml/src/sudoku_ml/contract.py`)

```python
CELL_SIZE = 64
"""Side of the cell image that the scanner's per-cell flatten produces."""

INPUT_SIZE = 32
"""Side of the model input."""

CROP = (6, 58)
"""Rows and columns of the cell image that the model sees. The rest holds grid lines."""

BATCH = 81
"""The static batch of the exported model: the 81 cells of one grid."""

UNKNOWN_KIND = -1
"""Kind target of a cell whose kind is not known. It adds no kind loss."""


def digit_index(label: str) -> int:
    """Index of a digit class in the `digit` output."""
    return DIGIT_CLASSES.index(label)


def kind_index(kind: str) -> int:
    """Index of a kind class in the `kind` output."""
    return KIND_CLASSES.index(kind)
```

- [ ] **Step 5: Run tests and lint, commit**

Run: `just test-ml && just lint-ml` — all pass.
```bash
git add ml/pyproject.toml ml/uv.lock ml/src/sudoku_ml/contract.py ml/tests/test_contract.py
git commit -m "chore(ml): add torch, litert-torch and contract sizes (#4)"
```

---

### Task 2: Preprocessing

**Files:**
- Create: `ml/src/sudoku_ml/preprocess.py`
- Test: `ml/tests/test_preprocess.py`

**Interfaces:**
- Produces:
  - `area_weights(src: int, dst: int) -> np.ndarray` — float32 `(dst, src)`, exact overlap weights, rows sum to 1.
  - `preprocess_cell(cell: np.ndarray) -> np.ndarray` — `(64, 64, 3)` uint8 RGB → `(32, 32)` float32.
  - `preprocess_batch(cells: torch.Tensor) -> torch.Tensor` — `(B, 3, 64, 64)` float in `[0, 255]`, any device → `(B, 1, 32, 32)` float32.
  - `to_cell_image(rgb: np.ndarray) -> np.ndarray` — any `(H, W, 3)` uint8 → `(64, 64, 3)` uint8 with the same area average, rounded.

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_preprocess.py`:
```python
import cv2
import numpy as np
import pytest
import torch

from sudoku_ml.preprocess import area_weights, preprocess_batch, preprocess_cell, to_cell_image


def cell(value) -> np.ndarray:
    return np.full((64, 64, 3), value, dtype=np.uint8)


def random_cell(seed: int) -> np.ndarray:
    return np.random.default_rng(seed).integers(0, 256, (64, 64, 3), dtype=np.uint8)


def test_area_weights_rows_sum_to_one():
    w = area_weights(52, 32)
    assert w.shape == (32, 52)
    assert np.allclose(w.sum(axis=1), 1.0, atol=1e-6)


def test_output_shape_and_type():
    out = preprocess_cell(cell(255))
    assert (out.shape, out.dtype) == ((32, 32), np.float32)


def test_white_is_zero_and_black_is_one():
    assert preprocess_cell(cell(255)).max() == pytest.approx(0.0, abs=1e-6)
    assert preprocess_cell(cell(0)).min() == pytest.approx(1.0, abs=1e-6)


def test_grayscale_uses_bt601_in_float():
    assert preprocess_cell(cell((255, 0, 0)))[0, 0] == pytest.approx(1 - 0.299, abs=1e-6)


def test_border_outside_the_crop_is_ignored():
    image = cell(255)
    image[:6], image[58:], image[:, :6], image[:, 58:] = 0, 0, 0, 0
    assert preprocess_cell(image).max() == pytest.approx(0.0, abs=1e-6)


def test_no_per_cell_normalisation():
    assert preprocess_cell(cell(128)).max() == pytest.approx(1 - 128 / 255, abs=1e-6)


def test_matches_opencv_inter_area():
    image = random_cell(1)
    gray = image.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    ref = cv2.resize(np.ascontiguousarray(gray[6:58, 6:58]), (32, 32), interpolation=cv2.INTER_AREA)
    assert np.abs(preprocess_cell(image) - (1 - ref / 255)).max() < 1e-5


def test_torch_batch_matches_numpy():
    images = np.stack([random_cell(s) for s in range(4)])
    batch = torch.from_numpy(images).permute(0, 3, 1, 2).float()
    out = preprocess_batch(batch)
    assert tuple(out.shape) == (4, 1, 32, 32)
    expected = np.stack([preprocess_cell(i) for i in images])
    assert np.abs(out[:, 0].numpy() - expected).max() < 1e-5


def test_rejects_wrong_shape():
    with pytest.raises(ValueError):
        preprocess_cell(np.zeros((71, 71, 3), dtype=np.uint8))


def test_to_cell_image_resizes_71_pixel_cells():
    out = to_cell_image(np.full((71, 71, 3), 77, dtype=np.uint8))
    assert (out.shape, out.dtype, int(out[30, 30, 0])) == ((64, 64, 3), np.uint8, 77)
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_preprocess.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.preprocess'`.

- [ ] **Step 3: Implement**

`ml/src/sudoku_ml/preprocess.py`:
```python
"""The input steps of the model contract. The app implements the same maths in TypeScript."""

import numpy as np
import torch

from sudoku_ml.contract import CELL_SIZE, CROP, INPUT_SIZE

BT601 = (0.299, 0.587, 0.114)


def area_weights(src: int, dst: int) -> np.ndarray:
    """Exact area-average weights: W[i][j] is the overlap of source pixel j with output pixel i."""
    scale = src / dst
    weights = np.zeros((dst, src), dtype=np.float64)
    for i in range(dst):
        lo, hi = i * scale, (i + 1) * scale
        for j in range(int(np.floor(lo)), int(np.ceil(hi))):
            overlap = min(hi, j + 1) - max(lo, j)
            if overlap > 0:
                weights[i, j] = overlap / scale
    return weights.astype(np.float32)


_START, _END = CROP
_W = area_weights(_END - _START, INPUT_SIZE)
_W_TORCH = torch.from_numpy(_W)


def preprocess_cell(cell: np.ndarray) -> np.ndarray:
    """A (64, 64, 3) uint8 RGB cell image → the (32, 32) float32 model input."""
    if cell.shape != (CELL_SIZE, CELL_SIZE, 3) or cell.dtype != np.uint8:
        raise ValueError(f"expected a ({CELL_SIZE}, {CELL_SIZE}, 3) uint8 image, got {cell.shape}")
    gray = cell.astype(np.float32) @ np.array(BT601, dtype=np.float32)
    crop = gray[_START:_END, _START:_END]
    return (1.0 - (_W @ crop @ _W.T) / 255.0).astype(np.float32)


def preprocess_batch(cells: torch.Tensor) -> torch.Tensor:
    """(B, 3, 64, 64) float in [0, 255] → (B, 1, 32, 32) float32, on the same device."""
    r, g, b = cells[:, 0], cells[:, 1], cells[:, 2]
    gray = BT601[0] * r + BT601[1] * g + BT601[2] * b
    crop = gray[:, _START:_END, _START:_END]
    w = _W_TORCH.to(cells.device)
    resized = torch.einsum("ij,bjk,lk->bil", w, crop, w)
    return (1.0 - resized / 255.0).unsqueeze(1).float()


def to_cell_image(rgb: np.ndarray) -> np.ndarray:
    """Resize an (H, W, 3) uint8 image to a 64 × 64 cell image with the same area average."""
    if rgb.shape[:2] == (CELL_SIZE, CELL_SIZE):
        return rgb
    wy = area_weights(rgb.shape[0], CELL_SIZE)
    wx = area_weights(rgb.shape[1], CELL_SIZE)
    out = np.einsum("ij,jkc,lk->ilc", wy, rgb.astype(np.float32), wx)
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)
```

- [ ] **Step 4: Run tests and lint, commit**

Run: `just test-ml && just lint-ml` — all pass.
```bash
git add ml/src/sudoku_ml/preprocess.py ml/tests/test_preprocess.py
git commit -m "feat(ml): implement the contract preprocessing in NumPy and PyTorch (#4)"
```

---

### Task 3: Fonts and the synthetic cell generator

**Files:**
- Create: `ml/fonts/` (7 fonts, their `OFL.txt`, a README), `ml/src/sudoku_ml/synthetic.py`
- Test: `ml/tests/test_synthetic.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class Sample: image: np.ndarray; digit: int; kind: int` — image `(64, 64, 3)` uint8.
  - `font_files(fonts_dir: Path) -> list[Path]`
  - `render_cell(rng: np.random.Generator, digit: int, kind: str, fonts: list[Path]) -> np.ndarray` — kind is `"printed"` (digit 1–9), `"none"` (digit 0, empty) or `"notes"` (digit 0, small pencil digits).
  - `generate(per_class: int, seed: int, fonts: list[Path]) -> list[Sample]` — `per_class` printed cells per digit 1–9, `per_class` empty cells, `per_class // 2` notes cells, shuffled with the seed.

- [ ] **Step 1: Download the fonts**

```bash
mkdir -p ml/fonts && cd ml/fonts
base=https://raw.githubusercontent.com/google/fonts/main/ofl
for f in "notosans/NotoSans[wdth,wght].ttf" "notoserif/NotoSerif[wdth,wght].ttf" \
         "librefranklin/LibreFranklin[wght].ttf" "merriweather/Merriweather[opsz,wdth,wght].ttf" \
         "sourcesans3/SourceSans3[wght].ttf" "ibmplexsans/IBMPlexSans[wdth,wght].ttf" "oswald/Oswald[wght].ttf"; do
  dir=${f%%/*}; name=${f#*/}
  mkdir -p "$dir"
  curl -sfL "$base/$dir/$(printf %s "$name" | sed 's/\[/%5B/; s/\]/%5D/')" -o "$dir/$name"
  curl -sfL "$base/$dir/OFL.txt" -o "$dir/OFL.txt"
done
find . -name '*.ttf' | wc -l
```
Expected: `7`. Add `ml/fonts/README.md`:
```markdown
# Fonts

Fonts for synthetic digits. Each comes from `google/fonts` under `ofl/` and is licensed under the
SIL Open Font License, in the `OFL.txt` next to it (ADR-013).
```

- [ ] **Step 2: Write the failing tests**

`ml/tests/test_synthetic.py`:
```python
from collections import Counter
from pathlib import Path

import numpy as np

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES, is_valid_pair, kind_index
from sudoku_ml.synthetic import font_files, generate, render_cell

FONTS = font_files(Path(__file__).parents[1] / "fonts")


def ink(image: np.ndarray) -> float:
    return float(255 - image[8:56, 8:56].mean())


def test_seven_fonts():
    assert len(FONTS) == 7


def test_rendered_cell_is_a_cell_image():
    image = render_cell(np.random.default_rng(1), 7, "printed", FONTS)
    assert (image.shape, image.dtype) == ((64, 64, 3), np.uint8)


def test_digit_has_more_ink_than_notes_and_notes_more_than_empty():
    rng = np.random.default_rng(2)
    digit = np.mean([ink(render_cell(rng, 8, "printed", FONTS)) for _ in range(20)])
    notes = np.mean([ink(render_cell(rng, 0, "notes", FONTS)) for _ in range(20)])
    empty = np.mean([ink(render_cell(rng, 0, "none", FONTS)) for _ in range(20)])
    assert digit > notes > empty


def test_generate_counts_and_labels():
    samples = generate(per_class=4, seed=3, fonts=FONTS)
    counts = Counter((s.digit, s.kind) for s in samples)
    assert counts[(0, kind_index("none"))] == 4
    assert counts[(0, kind_index("notes"))] == 2
    assert all(counts[(d, kind_index("printed"))] == 4 for d in range(1, 10))
    assert all(is_valid_pair(DIGIT_CLASSES[s.digit], KIND_CLASSES[s.kind]) for s in samples)


def test_generate_is_deterministic():
    a, b = generate(1, 5, FONTS), generate(1, 5, FONTS)
    assert all(np.array_equal(x.image, y.image) for x, y in zip(a, b, strict=True))
```

- [ ] **Step 3: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_synthetic.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.synthetic'`.

- [ ] **Step 4: Implement**

`ml/src/sudoku_ml/synthetic.py`:
```python
"""Rendered cell images: printed digits, pencil notes and empty cells (ADR-006)."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from sudoku_ml.contract import CELL_SIZE, kind_index


@dataclass(frozen=True)
class Sample:
    image: np.ndarray  # (64, 64, 3) uint8 RGB cell image
    digit: int  # index in DIGIT_CLASSES, 0 = empty
    kind: int  # index in KIND_CLASSES, or UNKNOWN_KIND


def font_files(fonts_dir: Path) -> list[Path]:
    return sorted(fonts_dir.rglob("*.ttf"))


def _colour(rng: np.random.Generator, dark: bool) -> tuple[int, int, int]:
    if not dark:
        base = int(rng.integers(185, 256))
        return tuple(int(v) for v in np.clip(base - rng.integers(0, 25, 3), 0, 255))
    if rng.random() < 0.15:  # coloured ink: blue or red pen, coloured print
        return (int(rng.integers(0, 60)), int(rng.integers(0, 60)), int(rng.integers(90, 200)))[
            :: 1 if rng.random() < 0.5 else -1
        ]
    grey = int(rng.integers(0, 90))
    return (grey, grey, grey)


def _font(rng: np.random.Generator, fonts: list[Path], size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(fonts[int(rng.integers(len(fonts)))]), size)


def _grid_lines(draw: ImageDraw.ImageDraw, rng: np.random.Generator, ink) -> None:
    for side in range(4):
        if rng.random() < 0.7:
            offset = int(rng.integers(0, 10))  # up to 9 px: sometimes inside the crop
            width = int(rng.integers(1, 4))
            pos = offset if side < 2 else CELL_SIZE - 1 - offset
            if side % 2 == 0:
                draw.line([(0, pos), (CELL_SIZE, pos)], fill=ink, width=width)
            else:
                draw.line([(pos, 0), (pos, CELL_SIZE)], fill=ink, width=width)


def render_cell(rng: np.random.Generator, digit: int, kind: str, fonts: list[Path]) -> np.ndarray:
    """Render one 64 × 64 cell image of the given kind."""
    paper, ink = _colour(rng, dark=False), _colour(rng, dark=True)
    image = Image.new("RGB", (CELL_SIZE, CELL_SIZE), paper)
    draw = ImageDraw.Draw(image)
    if kind == "printed":
        dx, dy = np.clip(rng.normal(0, 3, 2), -8, 8)
        draw.text((32 + dx, 32 + dy), str(digit), fill=ink,
                  font=_font(rng, fonts, int(rng.integers(28, 50))), anchor="mm")
    elif kind == "notes":
        small = _font(rng, fonts, int(rng.integers(10, 17)))
        for slot in rng.choice(9, size=int(rng.integers(2, 6)), replace=False):
            x, y = 14 + (slot % 3) * 18, 14 + (slot // 3) * 18
            draw.text((x, y), str(int(slot) + 1), fill=ink, font=small, anchor="mm")
    if rng.random() < 0.2:  # part of a neighbouring digit at the edge
        x = -10 if rng.random() < 0.5 else CELL_SIZE + 10
        draw.text((x, 32), str(int(rng.integers(1, 10))), fill=ink, font=_font(rng, fonts, 40), anchor="mm")
    if kind == "printed":
        image = image.rotate(float(rng.normal(0, 3)), resample=Image.BILINEAR, fillcolor=paper)
        draw = ImageDraw.Draw(image)
    _grid_lines(draw, rng, ink)
    image = image.filter(ImageFilter.GaussianBlur(float(rng.uniform(0, 1.2))))
    noise = rng.normal(0, rng.uniform(0, 8), (CELL_SIZE, CELL_SIZE, 1))
    return np.clip(np.asarray(image, dtype=np.float32) + noise, 0, 255).astype(np.uint8)


def generate(per_class: int, seed: int, fonts: list[Path]) -> list[Sample]:
    """Printed cells for 1–9, empty cells and notes cells, shuffled with the seed."""
    rng = np.random.default_rng(seed)
    plan = [(d, "printed") for d in range(1, 10) for _ in range(per_class)]
    plan += [(0, "none")] * per_class + [(0, "notes")] * (per_class // 2)
    samples = [Sample(render_cell(rng, d, k, fonts), d, kind_index(k)) for d, k in plan]
    order = rng.permutation(len(samples))
    return [samples[i] for i in order]
```

- [ ] **Step 5: Look at the output once**

```bash
uv run --directory ml python -c "
from pathlib import Path; import numpy as np; from PIL import Image
from sudoku_ml.synthetic import font_files, generate
s = generate(3, 1, font_files(Path('fonts')))[:40]
rows = [np.concatenate([x.image for x in s[r*10:(r+1)*10]], 1) for r in range(4)]
Image.fromarray(np.concatenate(rows, 0)).resize((1280, 512)).save('synthetic-sheet.png')"
```
Open `ml/synthetic-sheet.png`. Digits are readable, sometimes off-centre, some cells hold small notes, some have lines and edge fragments. Then delete the file. If digits are clipped or unreadable, adjust sizes and record the change in the commit message.

- [ ] **Step 6: Run tests and lint, commit**

Run: `just test-ml && just lint-ml` — all pass.
```bash
git add ml/fonts ml/src/sudoku_ml/synthetic.py ml/tests/test_synthetic.py
git commit -m "feat(ml): render synthetic printed, notes and empty cells (#4)"
```

---

### Task 4: Preprocessing reference fixtures

**Files:**
- Create: `ml/src/sudoku_ml/fixtures.py`, `ml/tests/test_fixtures.py`, `fixtures/preprocess/*` (generated)
- Modify: `justfile`

**Interfaces:**
- Consumes: `generate`, `font_files`, `preprocess_cell`, `BATCH`.
- Produces: `write_preprocess_fixtures(out_dir: Path, fonts: list[Path], seed: int = 2026) -> None` writes `00.cell.png … 80.cell.png` and `00.expected.json … 80.expected.json` (`{"shape": [32, 32], "values": [[...]]}`, 6 decimals). `load_reference_inputs(fixture_dir: Path) -> np.ndarray` returns `(81, 32, 32, 1)` float32. CLI: `python -m sudoku_ml.fixtures <out_dir>`.

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_fixtures.py`:
```python
import json
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.fixtures import load_reference_inputs, write_preprocess_fixtures
from sudoku_ml.preprocess import preprocess_cell
from sudoku_ml.synthetic import font_files

ROOT = Path(__file__).parents[2]
COMMITTED = ROOT / "fixtures" / "preprocess"
FONTS = font_files(ROOT / "ml" / "fonts")


def test_writes_81_pairs(tmp_path: Path):
    write_preprocess_fixtures(tmp_path, FONTS)
    assert len(list(tmp_path.glob("*.cell.png"))) == 81
    assert len(list(tmp_path.glob("*.expected.json"))) == 81


def test_committed_fixtures_match_preprocessing():
    pngs = sorted(COMMITTED.glob("*.cell.png"))
    assert len(pngs) == 81
    for png in pngs:
        cell = np.asarray(Image.open(png).convert("RGB"))
        expected = json.loads(png.with_name(png.name.replace(".cell.png", ".expected.json")).read_text())
        assert expected["shape"] == [32, 32]
        assert np.abs(preprocess_cell(cell) - np.array(expected["values"])).max() <= 1 / 255


def test_reference_inputs_are_one_model_batch():
    inputs = load_reference_inputs(COMMITTED)
    assert (inputs.shape, inputs.dtype) == ((81, 32, 32, 1), np.float32)
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_fixtures.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.fixtures'`.

- [ ] **Step 3: Implement**

`ml/src/sudoku_ml/fixtures.py`:
```python
"""Reference pairs that pin the contract preprocessing for Python and the app. Synthetic only."""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.contract import BATCH
from sudoku_ml.preprocess import preprocess_cell
from sudoku_ml.synthetic import font_files, generate


def write_preprocess_fixtures(out_dir: Path, fonts: list[Path], seed: int = 2026) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for n, sample in enumerate(generate(per_class=9, seed=seed, fonts=fonts)[:BATCH]):
        Image.fromarray(sample.image).save(out_dir / f"{n:02d}.cell.png")
        values = np.round(preprocess_cell(sample.image), 6).tolist()
        payload = {"shape": [32, 32], "values": values}
        (out_dir / f"{n:02d}.expected.json").write_text(json.dumps(payload))


def load_reference_inputs(fixture_dir: Path) -> np.ndarray:
    """The 81 reference cells, preprocessed, as one model input batch."""
    pngs = sorted(fixture_dir.glob("*.cell.png"))
    cells = [preprocess_cell(np.asarray(Image.open(p).convert("RGB"))) for p in pngs]
    return np.stack(cells)[..., np.newaxis].astype(np.float32)


if __name__ == "__main__":
    write_preprocess_fixtures(Path(sys.argv[1]), font_files(Path(__file__).parents[2] / "fonts"))
```

- [ ] **Step 4: Generate the fixtures, add the recipe, run tests**

```bash
uv run --directory ml python -m sudoku_ml.fixtures ../fixtures/preprocess
```
Append to `justfile`:
```make
# Regenerate the preprocessing reference fixtures (synthetic only, ADR-013)
preprocess-fixtures:
    uv run --directory ml python -m sudoku_ml.fixtures ../fixtures/preprocess
```
Run: `just test-ml && just lint-ml` — all pass.

- [ ] **Step 5: Commit**

```bash
git add ml/src/sudoku_ml/fixtures.py ml/tests/test_fixtures.py fixtures/preprocess justfile
git commit -m "feat(ml): add 81 synthetic preprocessing reference pairs (#4)"
```

---

### Task 5: Dataset — real cells, near-duplicate groups, split

**Files:**
- Create: `ml/src/sudoku_ml/dataset.py`
- Test: `ml/tests/test_dataset.py`

**Interfaces:**
- Consumes: `Sample`, `to_cell_image`, `area_weights`, `digit_index`, `kind_index`, `UNKNOWN_KIND`, `DIGIT_CLASSES`.
- Produces:
  - `load_cells(cells_dir: Path) -> list[Sample]` — digit-class folders only, never `unlabeled/`; resized to 64 × 64; kind `none` for empty cells, else `UNKNOWN_KIND`. A missing folder gives `[]`.
  - `dhash(image: np.ndarray) -> int` — 64-bit difference hash of a cell image.
  - `group_ids(samples: list[Sample], max_distance: int = 4) -> np.ndarray` — one group id per sample; samples whose hashes differ in at most `max_distance` bits share a group (transitively).
  - `split_by_group(groups: np.ndarray, fractions: tuple[float, float, float], seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]` — train, validation and test indices; a group is never split.
  - `stack(samples: list[Sample]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]` — images `(N, 64, 64, 3)` uint8, digit `(N,)` long, kind `(N,)` long.

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_dataset.py`:
```python
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.contract import UNKNOWN_KIND, kind_index
from sudoku_ml.dataset import dhash, group_ids, load_cells, split_by_group, stack
from sudoku_ml.synthetic import Sample


def cell_tree(tmp_path: Path) -> Path:
    cells = tmp_path / "cells"
    for label, colour in [("3", 10), ("empty", 200), ("unlabeled", 50), ("7", 30)]:
        (cells / label).mkdir(parents=True)
        Image.new("RGB", (71, 71), (colour,) * 3).save(cells / label / f"{colour:016x}.png")
    return cells


def pattern(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.kron(rng.integers(0, 256, (8, 8, 3)), np.ones((8, 8, 1))).astype(np.uint8)


def test_cells_are_resized_and_labelled(tmp_path: Path):
    samples = load_cells(cell_tree(tmp_path))
    assert sorted(s.digit for s in samples) == [0, 3, 7]
    assert all(s.image.shape == (64, 64, 3) for s in samples)


def test_unlabeled_is_never_loaded_and_missing_folder_is_empty(tmp_path: Path):
    assert len(load_cells(cell_tree(tmp_path))) == 3
    assert load_cells(tmp_path / "nothing") == []


def test_kind_is_unknown_except_for_empty_cells(tmp_path: Path):
    kinds = {s.digit: s.kind for s in load_cells(cell_tree(tmp_path))}
    assert kinds == {0: kind_index("none"), 3: UNKNOWN_KIND, 7: UNKNOWN_KIND}


def test_near_identical_cells_share_a_group():
    a = pattern(1)
    b = a.copy()
    b[0, 0] = 255 - b[0, 0]  # one pixel changed
    c = pattern(2)
    groups = group_ids([Sample(x, 1, 1) for x in (a, b, c)])
    assert groups[0] == groups[1] != groups[2]
    assert dhash(a) == dhash(b)


def test_split_never_splits_a_group():
    groups = np.repeat(np.arange(100), 3)
    train, val, test = split_by_group(groups, (0.8, 0.1, 0.1), seed=4)
    assert len(train) + len(val) + len(test) == 300
    sides = [set(groups[train]), set(groups[val]), set(groups[test])]
    assert not (sides[0] & sides[1] or sides[0] & sides[2] or sides[1] & sides[2])
    assert 15 <= len(test) <= 45


def test_split_is_deterministic():
    groups = np.arange(50)
    assert all(np.array_equal(a, b) for a, b in zip(
        split_by_group(groups, (0.8, 0.1, 0.1), 1), split_by_group(groups, (0.8, 0.1, 0.1), 1), strict=True))


def test_stack_shapes():
    images, digit, kind = stack([Sample(np.zeros((64, 64, 3), np.uint8), 5, 1)] * 3)
    assert tuple(images.shape) == (3, 64, 64, 3)
    assert digit.tolist() == [5, 5, 5] and kind.tolist() == [1, 1, 1]
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_dataset.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.dataset'`.

- [ ] **Step 3: Implement**

`ml/src/sudoku_ml/dataset.py`:
```python
"""Real cells, near-duplicate groups and a split that keeps each group on one side."""

from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, UNKNOWN_KIND, digit_index, kind_index
from sudoku_ml.preprocess import BT601, area_weights, to_cell_image
from sudoku_ml.synthetic import Sample

_HASH_ROWS = area_weights(64, 8)
_HASH_COLS = area_weights(64, 9)


def load_cells(cells_dir: Path) -> list[Sample]:
    """The labelled real cells. Never reads `unlabeled/`."""
    samples = []
    for label in DIGIT_CLASSES:
        for path in sorted((cells_dir / label).glob("*.png")):
            image = to_cell_image(np.asarray(Image.open(path).convert("RGB")))
            kind = kind_index("none") if label == "empty" else UNKNOWN_KIND
            samples.append(Sample(image, digit_index(label), kind))
    return samples


def dhash(image: np.ndarray) -> int:
    """64-bit difference hash: is each pixel of an 8 × 9 thumbnail brighter than its left neighbour."""
    gray = image.astype(np.float32) @ np.array(BT601, dtype=np.float32)
    small = _HASH_ROWS @ gray @ _HASH_COLS.T
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return int(np.packbits(bits).view(">u8")[0])


def group_ids(samples: list[Sample], max_distance: int = 4) -> np.ndarray:
    """Group id per sample. Hashes within `max_distance` bits join one group (union-find)."""
    hashes = np.array([dhash(s.image) for s in samples], dtype=np.uint64)
    parent = np.arange(len(samples))

    def root(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(samples) - 1):
        close = np.nonzero(np.bitwise_count(hashes[i + 1 :] ^ hashes[i]) <= max_distance)[0] + i + 1
        for j in close:
            parent[root(int(j))] = root(i)
    return np.array([root(i) for i in range(len(samples))])


def split_by_group(groups: np.ndarray, fractions: tuple[float, float, float], seed: int):
    """Train, validation and test indices. A group is never split."""
    unique = np.random.default_rng(seed).permutation(np.unique(groups))
    cut1 = round(len(unique) * fractions[0])
    cut2 = cut1 + round(len(unique) * fractions[1])
    sides = [set(unique[:cut1]), set(unique[cut1:cut2]), set(unique[cut2:])]
    return tuple(np.array([i for i, g in enumerate(groups) if g in side]) for side in sides)


def stack(samples: list[Sample]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Images (N, 64, 64, 3) uint8, digit targets (N,), kind targets (N,)."""
    images = torch.from_numpy(np.stack([s.image for s in samples]))
    digit = torch.tensor([s.digit for s in samples], dtype=torch.long)
    kind = torch.tensor([s.kind for s in samples], dtype=torch.long)
    return images, digit, kind
```

- [ ] **Step 4: Check it on the real data**

```bash
uv run --directory ml python -c "
from pathlib import Path; import numpy as np, time
from sudoku_ml.dataset import load_cells, group_ids
t = time.time(); s = load_cells(Path('data/cells')); g = group_ids(s)
print(len(s), 'cells', len(np.unique(g)), 'groups', round(time.time() - t), 's')"
```
Expected: 16,206 cells, clearly fewer groups than cells, a run time under 2 minutes. Write the numbers into the pull request. If grouping takes longer than 2 minutes, record it and continue.

- [ ] **Step 5: Run tests and lint, commit**

Run: `just test-ml && just lint-ml` — all pass.
```bash
git add ml/src/sudoku_ml/dataset.py ml/tests/test_dataset.py
git commit -m "feat(ml): load real cells and split them by near-duplicate groups (#4)"
```

---

### Task 6: Augmentation

**Files:**
- Create: `ml/src/sudoku_ml/augment.py`
- Test: `ml/tests/test_augment.py`

**Interfaces:**
- Produces: `augment(images: torch.Tensor, generator: torch.Generator, strength: float = 1.0) -> torch.Tensor` — `(B, 3, 64, 64)` float in `[0, 255]` on any device → same shape and range. Random draws come from `generator` on the CPU, so a seed gives the same result. `strength = 0` returns the input unchanged.

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_augment.py`:
```python
import torch

from sudoku_ml.augment import augment


def batch() -> torch.Tensor:
    torch.manual_seed(0)
    return torch.rand(8, 3, 64, 64) * 255


def test_keeps_shape_and_range():
    out = augment(batch(), torch.Generator().manual_seed(1))
    assert out.shape == (8, 3, 64, 64)
    assert out.min() >= 0 and out.max() <= 255


def test_changes_the_images():
    x = batch()
    assert (augment(x, torch.Generator().manual_seed(1)) - x).abs().mean() > 1


def test_is_deterministic_per_seed():
    x = batch()
    a = augment(x, torch.Generator().manual_seed(2))
    b = augment(x, torch.Generator().manual_seed(2))
    assert torch.equal(a, b)


def test_zero_strength_is_identity():
    x = batch()
    assert torch.allclose(augment(x, torch.Generator().manual_seed(3), strength=0.0), x, atol=1e-3)
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_augment.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.augment'`.

- [ ] **Step 3: Implement**

`ml/src/sudoku_ml/augment.py`:
```python
"""Random distortions of 64 × 64 cell images, before preprocessing (research record §3)."""

import math

import torch
import torch.nn.functional as F

_BLUR = torch.tensor([1.0, 2.0, 1.0])
_BLUR = (_BLUR[:, None] * _BLUR[None, :] / 16).expand(3, 1, 3, 3).contiguous()


def augment(images: torch.Tensor, generator: torch.Generator, strength: float = 1.0) -> torch.Tensor:
    """Shift ±4 px, rotate ±6°, scale ±10 %, shear, blur 40 %, gamma, contrast, brightness, noise."""
    b, device = images.shape[0], images.device

    def uniform(lo: float, hi: float) -> torch.Tensor:
        return (torch.rand(b, generator=generator) * (hi - lo) + lo).to(device) * strength

    angle = uniform(-6, 6) * math.pi / 180
    scale = 1 + uniform(-0.1, 0.1)
    shear = uniform(-0.1, 0.1)
    shift_x, shift_y = uniform(-4, 4) / 32, uniform(-4, 4) / 32
    cos, sin = torch.cos(angle) / scale, torch.sin(angle) / scale
    theta = torch.stack([
        torch.stack([cos, -sin + shear, shift_x], 1),
        torch.stack([sin, cos, shift_y], 1),
    ], 1)
    grid = F.affine_grid(theta, list(images.shape), align_corners=False)
    out = F.grid_sample(images, grid, mode="bilinear", padding_mode="border", align_corners=False)

    blurred = F.conv2d(F.pad(out, (1, 1, 1, 1), mode="replicate"), _BLUR.to(device), groups=3)
    blur = (torch.rand(b, generator=generator) < 0.4 * strength).to(device)[:, None, None, None]
    out = torch.where(blur, blurred, out)

    gamma = torch.exp(uniform(-0.35, 0.35))[:, None, None, None]
    out = 255 * (out / 255).clamp(0, 1) ** gamma
    contrast = (1 + uniform(-0.3, 0.3))[:, None, None, None]
    brightness = uniform(-20, 20)[:, None, None, None]
    out = (out - 128) * contrast + 128 + brightness
    sigma = uniform(0, 6)[:, None, None, None]
    noise = torch.randn(images.shape, generator=generator).to(device)
    return (out + noise * sigma).clamp(0, 255)
```

- [ ] **Step 4: Run tests and lint, commit**

Run: `just test-ml && just lint-ml` — all pass.
```bash
git add ml/src/sudoku_ml/augment.py ml/tests/test_augment.py
git commit -m "feat(ml): augment cell images on the GPU (#4)"
```

---

### Task 7: Model

**Files:**
- Create: `ml/src/sudoku_ml/model.py`
- Test: `ml/tests/test_model.py`

**Interfaces:**
- Produces:
  - `CellClassifier(nn.Module)`: `forward(x: (N, 1, 32, 32)) -> tuple[Tensor (N, 10), Tensor (N, 4)]` (logits).
  - `ExportModel(nn.Module)`: `ExportModel(model, temperature: float = 1.0)`, `forward(x: (N, 32, 32, 1)) -> dict[str, Tensor]` with keys `"digit"` (softmax of digit logits divided by the temperature) and `"kind"` (softmax of kind logits).

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_model.py`:
```python
import torch

from sudoku_ml.model import CellClassifier, ExportModel


def test_two_heads_with_contract_sizes():
    digit, kind = CellClassifier()(torch.zeros(5, 1, 32, 32))
    assert (tuple(digit.shape), tuple(kind.shape)) == ((5, 10), (5, 4))


def test_parameter_count():
    count = sum(p.numel() for p in CellClassifier().parameters())
    assert 50_000 < count < 100_000


def test_export_model_takes_nhwc_and_returns_named_probabilities():
    out = ExportModel(CellClassifier().eval())(torch.rand(3, 32, 32, 1))
    assert set(out) == {"digit", "kind"}
    assert torch.allclose(out["digit"].sum(1), torch.ones(3), atol=1e-5)
    assert torch.allclose(out["kind"].sum(1), torch.ones(3), atol=1e-5)


def test_temperature_scales_only_the_digit_head():
    inner = CellClassifier().eval()
    x = torch.rand(2, 32, 32, 1)
    logits, kind_logits = inner(x.permute(0, 3, 1, 2))
    out = ExportModel(inner, temperature=2.0)(x)
    assert torch.allclose(out["digit"], (logits / 2.0).softmax(1), atol=1e-6)
    assert torch.allclose(out["kind"], kind_logits.softmax(1), atol=1e-6)
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_model.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.model'`.

- [ ] **Step 3: Implement**

`ml/src/sudoku_ml/model.py`:
```python
"""The cell classifier: a global-average-pooling CNN with a digit head and a kind head (ADR-006)."""

import torch
from torch import nn

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES


def _conv(c_in: int, c_out: int) -> list[nn.Module]:
    return [nn.Conv2d(c_in, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out), nn.ReLU()]


class CellClassifier(nn.Module):
    """Input (N, 1, 32, 32). Returns digit logits (N, 10) and kind logits (N, 4)."""

    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            *_conv(1, 16), *_conv(16, 16), nn.MaxPool2d(2),
            *_conv(16, 32), *_conv(32, 32), nn.MaxPool2d(2),
            *_conv(32, 64), *_conv(64, 64),
            nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(0.1),
        )
        self.digit = nn.Linear(64, len(DIGIT_CLASSES))
        self.kind = nn.Linear(64, len(KIND_CLASSES))

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        h = self.features(x)
        return self.digit(h), self.kind(h)


class ExportModel(nn.Module):
    """The contract's layout: NHWC input, named softmax outputs, the fitted temperature applied."""

    def __init__(self, model: CellClassifier, temperature: float = 1.0) -> None:
        super().__init__()
        self.model = model
        self.temperature = temperature

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        digit, kind = self.model(x.permute(0, 3, 1, 2))
        return {"digit": (digit / self.temperature).softmax(dim=1), "kind": kind.softmax(dim=1)}
```

- [ ] **Step 4: Run tests and lint, commit**

Run: `just test-ml && just lint-ml` — all pass.
```bash
git add ml/src/sudoku_ml/model.py ml/tests/test_model.py
git commit -m "feat(ml): add the global-average-pooling cell classifier (#4)"
```

---

### Task 8: Training

**Files:**
- Create: `ml/src/sudoku_ml/train.py`, `ml/configs/cell-classifier.toml`, `ml/configs/smoke.toml`
- Test: `ml/tests/test_train.py`
- Modify: `justfile`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces:
  - `Config` dataclass, `load_config(path: Path) -> Config`.
  - `loss(digit_logits, kind_logits, digit, kind, kind_weight: float, label_smoothing: float) -> Tensor`.
  - `fit_temperature(logits: Tensor, targets: Tensor) -> float`.
  - `review_accuracy(probs: Tensor, targets: Tensor, rates: tuple[float, ...]) -> dict[str, float]` — accuracy of the cells kept after the least confident share `rate` goes to review.
  - `expected_calibration_error(probs: Tensor, targets: Tensor, bins: int = 15) -> float`.
  - `train(config: Config, ml_root: Path, artifacts_dir: Path | None = None) -> Path` — returns `artifacts/<YYYYMMDD-HHMMSS>-<name>/` with `model.pt`, `metrics.json`, `model-card.md`.
  - CLI: `python -m sudoku_ml.train configs/<name>.toml`.

- [ ] **Step 1: Write the configs**

`ml/configs/cell-classifier.toml`:
```toml
# The real run (#4). Real cells may train models that stay private (ADR-013).
name = "cell-classifier"
seed = 7
epochs = 25
batch_size = 256
max_lr = 0.003
weight_decay = 0.0001
label_smoothing = 0.05
kind_weight = 0.4
synthetic_per_class = 2000
real_cells = true
split = [0.8, 0.1, 0.1]
augment = true
```

`ml/configs/smoke.toml`:
```toml
# A seconds-long run for tests and CI. No real cells.
name = "smoke"
seed = 1
epochs = 1
batch_size = 32
max_lr = 0.003
weight_decay = 0.0001
label_smoothing = 0.05
kind_weight = 0.4
synthetic_per_class = 6
real_cells = false
split = [0.8, 0.1, 0.1]
augment = true
```

- [ ] **Step 2: Write the failing tests**

`ml/tests/test_train.py`:
```python
import json
from pathlib import Path

import pytest
import torch

from sudoku_ml.contract import UNKNOWN_KIND
from sudoku_ml.train import (
    expected_calibration_error, fit_temperature, load_config, loss, review_accuracy, train,
)

ML = Path(__file__).parents[1]


def test_unknown_kind_adds_no_kind_loss():
    digit_logits, digit = torch.zeros(2, 10), torch.tensor([0, 0])
    kind_logits = torch.tensor([[9.0, 0, 0, 0], [0, 0, 0, 9.0]])
    one = loss(digit_logits, kind_logits, digit, torch.tensor([0, UNKNOWN_KIND]), 0.4, 0.0)
    only_first = loss(digit_logits[:1], kind_logits[:1], digit[:1], torch.tensor([0]), 0.4, 0.0)
    assert torch.isclose(one, only_first, atol=1e-4)


def test_all_unknown_kinds_give_a_finite_loss():
    value = loss(torch.zeros(2, 10), torch.zeros(2, 4), torch.tensor([1, 2]),
                 torch.tensor([UNKNOWN_KIND, UNKNOWN_KIND]), 0.4, 0.05)
    assert torch.isfinite(value)


def test_kind_weight_scales_the_kind_loss():
    d, k = torch.zeros(1, 10), torch.zeros(1, 4)
    base = loss(d, k, torch.tensor([0]), torch.tensor([1]), 0.0, 0.0)
    weighted = loss(d, k, torch.tensor([0]), torch.tensor([1]), 1.0, 0.0)
    assert weighted > base


def test_review_accuracy_drops_the_least_confident():
    probs = torch.tensor([[0.9, 0.1], [0.6, 0.4], [0.55, 0.45], [0.95, 0.05]])
    targets = torch.tensor([0, 0, 1, 0])
    result = review_accuracy(probs, targets, (0.0, 0.25))
    assert result == {"review_0%": 0.75, "review_25%": 1.0}


def test_temperature_and_calibration_are_finite():
    logits = torch.randn(200, 10) * 3
    targets = logits.argmax(1)
    t = fit_temperature(logits, targets)
    assert 0.05 < t < 20
    assert 0 <= expected_calibration_error((logits / t).softmax(1), targets) < 1


def test_smoke_run_writes_artifacts(tmp_path: Path):
    run = train(load_config(ML / "configs" / "smoke.toml"), ML, artifacts_dir=tmp_path)
    metrics = json.loads((run / "metrics.json").read_text())
    assert (run / "model.pt").exists()
    assert {"eval_set", "digit_accuracy", "review", "ece", "temperature", "kind_accuracy_synthetic",
            "n_train", "device"} <= metrics.keys()
    assert metrics["eval_set"] == "synthetic"
    assert "Contract: 1.0" in (run / "model-card.md").read_text()


def test_unknown_config_key_is_rejected(tmp_path: Path):
    bad = tmp_path / "bad.toml"
    bad.write_text((ML / "configs" / "smoke.toml").read_text() + "\nunknown = 1\n")
    with pytest.raises(TypeError):
        load_config(bad)
```

- [ ] **Step 3: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_train.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.train'`.

- [ ] **Step 4: Implement**

`ml/src/sudoku_ml/train.py`:
```python
"""Train the cell classifier from a TOML config. Writes one folder per run in artifacts/."""

import hashlib
import json
import sys
import time
import tomllib
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

import torch
import torch.nn.functional as F

from sudoku_ml.augment import augment
from sudoku_ml.contract import CONTRACT_VERSION, UNKNOWN_KIND
from sudoku_ml.dataset import group_ids, load_cells, split_by_group, stack
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import preprocess_batch
from sudoku_ml.synthetic import font_files, generate

REVIEW_RATES = (0.0, 0.01, 0.02, 0.05)


@dataclass(frozen=True)
class Config:
    name: str
    seed: int
    epochs: int
    batch_size: int
    max_lr: float
    weight_decay: float
    label_smoothing: float
    kind_weight: float
    synthetic_per_class: int
    real_cells: bool
    split: list[float]
    augment: bool


def load_config(path: Path) -> Config:
    return Config(**tomllib.loads(path.read_text()))


def loss(digit_logits, kind_logits, digit, kind, kind_weight: float, label_smoothing: float):
    """Digit loss plus weighted kind loss. Unknown kinds add no kind loss."""
    total = F.cross_entropy(digit_logits, digit, label_smoothing=label_smoothing)
    known = kind != UNKNOWN_KIND
    if known.any():
        total = total + kind_weight * F.cross_entropy(kind_logits[known], kind[known])
    return total


def fit_temperature(logits: torch.Tensor, targets: torch.Tensor) -> float:
    log_t = torch.zeros(1, requires_grad=True)
    optimiser = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)

    def closure():
        optimiser.zero_grad()
        value = F.cross_entropy(logits / log_t.exp(), targets)
        value.backward()
        return value

    optimiser.step(closure)
    return float(log_t.exp())


def review_accuracy(probs, targets, rates=REVIEW_RATES) -> dict[str, float]:
    confidence, prediction = probs.max(1)
    order = confidence.argsort(descending=True)
    correct = (prediction == targets)[order].float()
    result = {}
    for rate in rates:
        keep = max(1, round(len(order) * (1 - rate)))
        result[f"review_{rate:.0%}"] = round(float(correct[:keep].mean()), 6)
    return result


def expected_calibration_error(probs, targets, bins: int = 15) -> float:
    confidence, prediction = probs.max(1)
    correct = (prediction == targets).float()
    edges = torch.linspace(0, 1, bins + 1)
    error = 0.0
    for lo, hi in zip(edges[:-1], edges[1:], strict=True):
        inside = (confidence > lo) & (confidence <= hi)
        if inside.any():
            error += inside.float().mean() * (confidence[inside].mean() - correct[inside].mean()).abs()
    return float(error)


def _device() -> torch.device:
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


def _logits(model, images: torch.Tensor, device) -> tuple[torch.Tensor, torch.Tensor]:
    model.eval()
    digit_out, kind_out = [], []
    with torch.no_grad():
        for start in range(0, len(images), 1024):
            x = images[start : start + 1024].to(device).permute(0, 3, 1, 2).float()
            d, k = model(preprocess_batch(x))
            digit_out.append(d.cpu())
            kind_out.append(k.cpu())
    return torch.cat(digit_out), torch.cat(kind_out)


def train(config: Config, ml_root: Path, artifacts_dir: Path | None = None) -> Path:
    started = time.time()
    torch.manual_seed(config.seed)
    generator = torch.Generator().manual_seed(config.seed)
    fonts = font_files(ml_root / "fonts")
    synthetic = generate(config.synthetic_per_class, config.seed, fonts)
    synthetic_val = generate(max(2, config.synthetic_per_class // 10), config.seed + 1, fonts)

    real = load_cells(ml_root / "data" / "cells") if config.real_cells else []
    if real:
        train_idx, val_idx, test_idx = split_by_group(group_ids(real), tuple(config.split), config.seed)
        real_train = [real[i] for i in train_idx]
        eval_sets = {"val": [real[i] for i in val_idx], "test": [real[i] for i in test_idx]}
    else:
        real_train, eval_sets = [], {"val": synthetic_val, "test": synthetic_val}

    syn_images, syn_digit, syn_kind = stack(synthetic)
    real_images, real_digit, real_kind = stack(real_train) if real_train else (None, None, None)
    device = _device()
    model = CellClassifier().to(device)
    n_train = len(synthetic) + len(real_train)
    steps = max(1, n_train // config.batch_size)
    optimiser = torch.optim.AdamW(model.parameters(), lr=config.max_lr, weight_decay=config.weight_decay)
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimiser, config.max_lr, total_steps=steps * config.epochs)

    for _ in range(config.epochs):
        model.train()
        for _ in range(steps):
            half = config.batch_size // 2 if real_train else config.batch_size
            s = torch.randint(len(synthetic), (half,), generator=generator)
            parts = [(syn_images[s], syn_digit[s], syn_kind[s])]
            if real_train:
                r = torch.randint(len(real_train), (config.batch_size - half,), generator=generator)
                parts.append((real_images[r], real_digit[r], real_kind[r]))
            images = torch.cat([p[0] for p in parts]).to(device).permute(0, 3, 1, 2).float()
            digit = torch.cat([p[1] for p in parts]).to(device)
            kind = torch.cat([p[2] for p in parts]).to(device)
            if config.augment:
                images = augment(images, generator)
            d_logits, k_logits = model(preprocess_batch(images))
            value = loss(d_logits, k_logits, digit, kind, config.kind_weight, config.label_smoothing)
            optimiser.zero_grad()
            value.backward()
            optimiser.step()
            schedule.step()

    val_images, val_digit, _ = stack(eval_sets["val"])
    val_logits, _ = _logits(model, val_images, device)
    temperature = fit_temperature(val_logits, val_digit)
    test_images, test_digit, _ = stack(eval_sets["test"])
    test_logits, _ = _logits(model, test_images, device)
    test_probs = (test_logits / temperature).softmax(1)
    sv_images, _, sv_kind = stack(synthetic_val)
    _, sv_kind_logits = _logits(model, sv_images, device)

    metrics = {
        "eval_set": "real" if real else "synthetic",
        "digit_accuracy": round(float((test_probs.argmax(1) == test_digit).float().mean()), 6),
        "review": review_accuracy(test_probs, test_digit),
        "ece": round(expected_calibration_error(test_probs, test_digit), 6),
        "temperature": round(temperature, 4),
        "kind_accuracy_synthetic": round(float((sv_kind_logits.argmax(1) == sv_kind).float().mean()), 6),
        "n_train": n_train, "n_val": len(eval_sets["val"]), "n_test": len(eval_sets["test"]),
        "device": str(device), "seconds": round(time.time() - started, 1), "config": asdict(config),
    }
    run = (artifacts_dir or ml_root / "artifacts") / f"{datetime.now():%Y%m%d-%H%M%S}-{config.name}"
    run.mkdir(parents=True)
    torch.save(model.cpu().state_dict(), run / "model.pt")
    (run / "metrics.json").write_text(json.dumps(metrics, indent=2))
    manifest = ml_root / "datasets" / "cells.csv"
    manifest_hash = hashlib.sha256(manifest.read_bytes()).hexdigest()[:16] if manifest.exists() else "none"
    (run / "model-card.md").write_text(
        f"# {config.name}\n\n- Contract: {CONTRACT_VERSION}\n- Torch: {torch.__version__}\n"
        f"- Device: {device}\n- Real cells: {'yes, the model stays private' if real else 'no'}\n"
        f"- Cells manifest: {manifest_hash}\n- Evaluated on: {metrics['eval_set']} test cells\n"
        f"- Digit accuracy: {metrics['digit_accuracy']:.4f}\n- At review rates: {metrics['review']}\n"
        f"- Temperature: {metrics['temperature']}\n"
        f"- Kind accuracy (synthetic cells only): {metrics['kind_accuracy_synthetic']:.4f}\n"
    )
    return run


if __name__ == "__main__":
    print(train(load_config(Path(sys.argv[1])), Path(__file__).parents[2]))
```

- [ ] **Step 5: Run tests and lint**

Run: `just test-ml && just lint-ml` — all pass. The smoke test takes seconds.

- [ ] **Step 6: Add the recipe and run the real training**

Append to `justfile`:
```make
# Train a model from a config in ml/configs/ (default: the cell classifier)
train config="cell-classifier":
    uv run --directory ml python -m sudoku_ml.train configs/{{config}}.toml
```
Run: `just train`
Expected: it prints a run folder within a few minutes. `metrics.json` shows `"device": "mps"`, `"eval_set": "real"` and a digit accuracy of about 0.98 or more. Write the numbers into the pull request. If it is below 0.97, stop and investigate (compare with the research record) before you continue.

- [ ] **Step 7: Commit**

```bash
git add ml/src/sudoku_ml/train.py ml/configs ml/tests/test_train.py justfile
git commit -m "feat(ml): train with augmentation, one-cycle schedule and calibration (#4)"
```

---

### Task 9: Export with parity and runtime checks

**Files:**
- Create: `ml/src/sudoku_ml/tflite_2_17_ops.json`, `ml/src/sudoku_ml/export.py`
- Test: `ml/tests/test_export.py`
- Modify: `justfile`

**Interfaces:**
- Consumes: `CellClassifier`, `ExportModel`, `load_reference_inputs`, `train`, `load_config`, `BATCH`.
- Produces:
  - `op_versions(path: Path) -> dict[str, int]` — builtin op name → highest version used in the file.
  - `check_op_versions(path: Path, table: dict[str, int]) -> None` — raises `ValueError` naming every op that is missing from the table or above its maximum.
  - `run_tflite(path: Path, inputs: np.ndarray) -> list[np.ndarray]` — outputs in tensor order.
  - `export(run: Path, fixture_dir: Path) -> Path` — writes `run/cell-classifier.tflite` and `run/export.json`; returns the `.tflite` path.

- [ ] **Step 1: Build the TFLite 2.17 op table**

```bash
curl -sfL https://raw.githubusercontent.com/tensorflow/tensorflow/v2.17.0/tensorflow/lite/core/kernels/register.cc -o /tmp/register-2.17.cc
uv run --directory ml python - <<'EOF'
import json, re
src = open("/tmp/register-2.17.cc").read()
table = {}
for m in re.finditer(r"AddBuiltin\(\s*BuiltinOperator_(\w+)\s*,\s*Register_\w+\(\)\s*(?:,\s*/\*\s*min_version\s*=\s*\*/\s*(\d+)\s*,\s*/\*\s*max_version\s*=\s*\*/\s*(\d+))?", src):
    table[m.group(1)] = max(table.get(m.group(1), 1), int(m.group(3) or 1))
json.dump(dict(sorted(table.items())), open("src/sudoku_ml/tflite_2_17_ops.json", "w"), indent=2)
print(len(table), {k: table[k] for k in ["CONV_2D", "DEPTHWISE_CONV_2D", "FULLY_CONNECTED", "SOFTMAX", "MEAN", "MAX_POOL_2D", "RESHAPE", "TRANSPOSE"] if k in table})
EOF
rm /tmp/register-2.17.cc
```
Expected: more than 100 ops, and the eight listed ops all present. If the regex finds fewer than 100 ops, read the file's `AddBuiltin` lines and adjust the pattern. Do not guess versions.

- [ ] **Step 2: Write the failing tests**

`ml/tests/test_export.py`:
```python
import json
from pathlib import Path

import numpy as np
import pytest
import torch

from sudoku_ml.export import check_op_versions, export, op_versions, run_tflite
from sudoku_ml.fixtures import load_reference_inputs
from sudoku_ml.model import CellClassifier, ExportModel
from sudoku_ml.train import load_config, train

ROOT = Path(__file__).parents[2]
FIXTURES = ROOT / "fixtures" / "preprocess"
TABLE = json.loads((ROOT / "ml/src/sudoku_ml/tflite_2_17_ops.json").read_text())


@pytest.fixture(scope="module")
def exported(tmp_path_factory) -> tuple[Path, Path]:
    run = train(load_config(ROOT / "ml/configs/smoke.toml"), ROOT / "ml", tmp_path_factory.mktemp("run"))
    return run, export(run, FIXTURES)


def test_small_float32_file(exported):
    _, tflite = exported
    assert tflite.stat().st_size <= 1_000_000


def test_every_op_runs_on_tflite_2_17(exported):
    _, tflite = exported
    check_op_versions(tflite, TABLE)


def test_check_rejects_a_version_above_the_table(exported):
    _, tflite = exported
    too_low = {op: 0 for op in op_versions(tflite)}
    with pytest.raises(ValueError):
        check_op_versions(tflite, too_low)


def test_outputs_are_found_by_shape(exported):
    run, tflite = exported
    info = json.loads((run / "export.json").read_text())
    outputs = run_tflite(tflite, load_reference_inputs(FIXTURES))
    assert outputs[info["outputs"]["digit"]].shape == (81, 10)
    assert outputs[info["outputs"]["kind"]].shape == (81, 4)


def test_tflite_matches_pytorch(exported):
    run, tflite = exported
    info = json.loads((run / "export.json").read_text())
    inputs = load_reference_inputs(FIXTURES)
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt"))
    reference = ExportModel(model.eval(), json.loads((run / "metrics.json").read_text())["temperature"])
    expected = reference(torch.from_numpy(inputs))
    outputs = run_tflite(tflite, inputs)
    for name in ("digit", "kind"):
        got, want = outputs[info["outputs"][name]], expected[name].detach().numpy()
        assert (got.argmax(1) == want.argmax(1)).all()
        assert np.abs(got - want).max() < 1e-3
```

- [ ] **Step 3: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_export.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.export'`.

- [ ] **Step 4: Implement**

`ml/src/sudoku_ml/export.py`:
```python
"""Export a run to TFLite. Check it against PyTorch and against the TFLite 2.17 runtime."""

import json
import sys
from pathlib import Path

import litert_torch
import numpy as np
import torch
from ai_edge_litert import schema_py_generated as schema
from ai_edge_litert.interpreter import Interpreter

from sudoku_ml.contract import CONTRACT_VERSION, DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.fixtures import load_reference_inputs
from sudoku_ml.model import CellClassifier, ExportModel

_OP_NAMES = {v: k for k, v in vars(schema.BuiltinOperator).items() if not k.startswith("_")}
TABLE_PATH = Path(__file__).with_name("tflite_2_17_ops.json")


def op_versions(path: Path) -> dict[str, int]:
    model = schema.Model.GetRootAsModel(path.read_bytes(), 0)
    used: dict[str, int] = {}
    for i in range(model.OperatorCodesLength()):
        code = model.OperatorCodes(i)
        name = _OP_NAMES[max(code.BuiltinCode(), code.DeprecatedBuiltinCode())]
        used[name] = max(used.get(name, 0), code.Version())
    return used


def check_op_versions(path: Path, table: dict[str, int]) -> None:
    problems = [f"{op} v{v} (2.17 supports {table.get(op, 'none')})"
                for op, v in op_versions(path).items() if v > table.get(op, 0)]
    if problems:
        raise ValueError("not supported by TFLite 2.17: " + ", ".join(problems))


def run_tflite(path: Path, inputs: np.ndarray) -> list[np.ndarray]:
    interpreter = Interpreter(model_path=str(path))
    interpreter.allocate_tensors()
    interpreter.set_tensor(interpreter.get_input_details()[0]["index"], inputs)
    interpreter.invoke()
    return [interpreter.get_tensor(d["index"]).copy() for d in interpreter.get_output_details()]


def export(run: Path, fixture_dir: Path) -> Path:
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt"))
    temperature = json.loads((run / "metrics.json").read_text())["temperature"]
    wrapped = ExportModel(model.eval(), temperature).eval()
    inputs = load_reference_inputs(fixture_dir)
    target = run / "cell-classifier.tflite"
    litert_torch.convert(wrapped, (torch.from_numpy(inputs),)).export(str(target))
    check_op_versions(target, json.loads(TABLE_PATH.read_text()))

    outputs = run_tflite(target, inputs)
    by_width = {o.shape[1]: i for i, o in enumerate(outputs)}
    index = {"digit": by_width[len(DIGIT_CLASSES)], "kind": by_width[len(KIND_CLASSES)]}
    expected = wrapped(torch.from_numpy(inputs))
    diff = max(float(np.abs(outputs[index[n]] - expected[n].detach().numpy()).max()) for n in index)
    if diff >= 1e-3:
        raise ValueError(f"TFLite differs from PyTorch by {diff}")
    info = {"contract": CONTRACT_VERSION, "input_shape": list(inputs.shape), "outputs": index,
            "max_abs_diff": diff, "bytes": target.stat().st_size, "ops": op_versions(target)}
    (run / "export.json").write_text(json.dumps(info, indent=2))
    return target


if __name__ == "__main__":
    print(export(Path(sys.argv[1]), Path(__file__).parents[3] / "fixtures" / "preprocess"))
```

- [ ] **Step 5: Run tests, add the recipe, export the real run**

Run: `just test-ml && just lint-ml` — all pass.
Append to `justfile`:
```make
# Export a training run to TFLite and check it against PyTorch and TFLite 2.17
export run:
    uv run --directory ml python -m sudoku_ml.export {{run}}
```
Run: `just export <the run folder from Task 8>`
Expected: a `.tflite` under 1 MB and an `export.json` with `max_abs_diff` below 1e-3. Write the size, the difference and the op list into the pull request.

- [ ] **Step 6: Commit**

```bash
git add ml/src/sudoku_ml/tflite_2_17_ops.json ml/src/sudoku_ml/export.py ml/tests/test_export.py justfile
git commit -m "feat(ml): export to TFLite with parity and TFLite 2.17 op checks (#4)"
```

---

### Task 10: Cells manifest and relabelling

**Files:**
- Create: `ml/src/sudoku_ml/manifest.py`, `ml/src/sudoku_ml/relabel.py`
- Test: `ml/tests/test_manifest.py`, `ml/tests/test_relabel.py`
- Modify: `justfile`

**Interfaces:**
- Produces:
  - `pixel_id(path: Path) -> str` — SHA-256 of `<width>x<height>` followed by the RGB pixel bytes (`ml/README.md`).
  - `write_cells_manifest(cells_dir: Path, manifest: Path) -> int` — rewrites `id,label` from the folders, sorted by label then id. Raises `ValueError` when a file name is not the first 16 characters of its id.
  - `apply_relabels(cells_dir: Path, relabels: Path) -> int` — reads a CSV with columns `file,new_label` (`file` is the 16-character name without `.png`; `new_label` is empty, `empty`, `1`–`9` or `unlabeled`; an empty `new_label` means "keep"). Moves each file to its new folder. Validates every row before it moves anything. Returns the number of moved files.

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_manifest.py`:
```python
import csv
from pathlib import Path

import pytest
from PIL import Image

from sudoku_ml.manifest import pixel_id, write_cells_manifest


def add_cell(cells: Path, label: str, colour: int) -> str:
    tmp = cells / "tmp.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (71, 71), (colour,) * 3).save(tmp)
    cell_id = pixel_id(tmp)
    (cells / label).mkdir(exist_ok=True)
    tmp.rename(cells / label / f"{cell_id[:16]}.png")
    return cell_id


def rows(manifest: Path) -> list[dict[str, str]]:
    with manifest.open(newline="") as f:
        return list(csv.DictReader(f))


def test_one_row_per_cell_sorted_by_label(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    add_cell(cells, "7", 10)
    add_cell(cells, "empty", 200)
    assert write_cells_manifest(cells, manifest) == 2
    assert [r["label"] for r in rows(manifest)] == ["7", "empty"]


def test_moved_cell_gets_its_new_label(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    cell_id = add_cell(cells, "unlabeled", 30)
    (cells / "8").mkdir()
    (cells / "unlabeled" / f"{cell_id[:16]}.png").rename(cells / "8" / f"{cell_id[:16]}.png")
    write_cells_manifest(cells, manifest)
    assert rows(manifest) == [{"id": cell_id, "label": "8"}]


def test_rejects_a_misnamed_file(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    cell_id = add_cell(cells, "3", 50)
    (cells / "3" / f"{cell_id[:16]}.png").rename(cells / "3" / "0000000000000000.png")
    with pytest.raises(ValueError):
        write_cells_manifest(cells, manifest)
```

`ml/tests/test_relabel.py`:
```python
from pathlib import Path

import pytest

from sudoku_ml.relabel import apply_relabels


def tree(tmp_path: Path) -> Path:
    cells = tmp_path / "cells"
    for label, name in [("6", "aaaaaaaaaaaaaaaa"), ("4", "bbbbbbbbbbbbbbbb"), ("7", "cccccccccccccccc")]:
        (cells / label).mkdir(parents=True)
        (cells / label / f"{name}.png").write_bytes(b"x")
    return cells


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "relabels.csv"
    path.write_text("file,new_label\n" + text)
    return path


def test_moves_files_and_skips_empty_rows(tmp_path: Path):
    cells = tree(tmp_path)
    moved = apply_relabels(cells, write(tmp_path, "aaaaaaaaaaaaaaaa,3\nbbbbbbbbbbbbbbbb,\ncccccccccccccccc,unlabeled\n"))
    assert moved == 2
    assert (cells / "3" / "aaaaaaaaaaaaaaaa.png").exists()
    assert (cells / "4" / "bbbbbbbbbbbbbbbb.png").exists()
    assert (cells / "unlabeled" / "cccccccccccccccc.png").exists()


def test_rejects_an_unknown_label_and_moves_nothing(tmp_path: Path):
    cells = tree(tmp_path)
    with pytest.raises(ValueError):
        apply_relabels(cells, write(tmp_path, "aaaaaaaaaaaaaaaa,3\nbbbbbbbbbbbbbbbb,10\n"))
    assert (cells / "6" / "aaaaaaaaaaaaaaaa.png").exists()


def test_rejects_a_missing_file(tmp_path: Path):
    with pytest.raises(ValueError):
        apply_relabels(tree(tmp_path), write(tmp_path, "dddddddddddddddd,3\n"))
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_manifest.py tests/test_relabel.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.manifest'`.

- [ ] **Step 3: Implement**

`ml/src/sudoku_ml/manifest.py`:
```python
"""Write ml/datasets/cells.csv from the folders in ml/data/cells/ (ADR-009)."""

import csv
import hashlib
from pathlib import Path

from PIL import Image


def pixel_id(path: Path) -> str:
    """SHA-256 of `<width>x<height>` followed by the RGB pixel bytes (see ml/README.md)."""
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        digest = hashlib.sha256(f"{rgb.width}x{rgb.height}".encode())
        digest.update(rgb.tobytes())
    return digest.hexdigest()


def write_cells_manifest(cells_dir: Path, manifest: Path) -> int:
    """Rewrite the manifest from the folders. A cell's label is the folder it is in."""
    rows = []
    for path in sorted(cells_dir.glob("*/*.png")):
        cell_id = pixel_id(path)
        if path.stem != cell_id[:16]:
            raise ValueError(f"{path} is not named after its pixels ({cell_id[:16]})")
        rows.append([cell_id, path.parent.name])
    rows.sort(key=lambda row: (row[1], row[0]))
    with manifest.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "label"])
        writer.writerows(rows)
    return len(rows)


if __name__ == "__main__":
    ml_root = Path(__file__).parents[2]
    print(write_cells_manifest(ml_root / "data" / "cells", ml_root / "datasets" / "cells.csv"))
```

`ml/src/sudoku_ml/relabel.py`:
```python
"""Move cells to the label a person chose. Validates everything before it moves anything."""

import csv
import sys
from pathlib import Path

from sudoku_ml.contract import DIGIT_CLASSES

LABELS = (*DIGIT_CLASSES, "unlabeled")


def apply_relabels(cells_dir: Path, relabels: Path) -> int:
    current = {p.stem: p for p in cells_dir.glob("*/*.png")}
    moves = []
    with relabels.open(newline="") as handle:
        for row in csv.DictReader(handle):
            name, label = row["file"].strip(), (row["new_label"] or "").strip()
            if not label:
                continue
            if label not in LABELS:
                raise ValueError(f"{name}: unknown label {label!r}")
            if name not in current:
                raise ValueError(f"{name}: no such cell")
            if current[name].parent.name != label:
                moves.append((current[name], cells_dir / label / current[name].name))
    for source, target in moves:
        target.parent.mkdir(exist_ok=True)
        source.rename(target)
    return len(moves)


if __name__ == "__main__":
    print(apply_relabels(Path(sys.argv[1]), Path(sys.argv[2])))
```

- [ ] **Step 4: Run tests, add recipes, check the manifest on the real data**

Run: `just test-ml && just lint-ml` — all pass.
Append to `justfile`:
```make
# Rewrite ml/datasets/cells.csv from the folders in ml/data/cells/
dataset-manifest:
    uv run --directory ml python -m sudoku_ml.manifest

# Move cells to the labels in a relabel CSV, then rewrite the manifest
relabel file="data/review/relabels.csv":
    uv run --directory ml python -m sudoku_ml.relabel data/cells {{file}}
    just dataset-manifest
```
Run: `just dataset-manifest && git diff --stat ml/datasets/cells.csv`
Expected: prints `16277`, and `git diff` shows **no change**. A change means the manifest and the folders disagree: stop and report it.

- [ ] **Step 5: Commit**

```bash
git add ml/src/sudoku_ml/manifest.py ml/src/sudoku_ml/relabel.py ml/tests/test_manifest.py ml/tests/test_relabel.py justfile
git commit -m "feat(ml): rewrite the cells manifest and apply relabels (#4)"
```

---

### Task 11: Suspect labels, the human check, and the final run

**Files:**
- Create: `ml/src/sudoku_ml/suspects.py`
- Test: `ml/tests/test_suspects.py`
- Modify: `justfile`

**Interfaces:**
- Consumes: `load_cells`, `group_ids`, `split_by_group`, `stack`, `CellClassifier`, `augment`, `preprocess_batch`, `loss`, `Config`.
- Produces:
  - `rank_suspects(names: list[str], labels: list[int], probs: np.ndarray, top: int) -> list[dict]` — rows `{file, label, predicted, p_label, p_predicted}` with the lowest probability for the given label first.
  - `find_suspects(ml_root: Path, folds: int = 5, epochs: int = 12, top: int = 150) -> Path` — trains `folds` models on group folds of the real cells, predicts each held-out fold, writes `ml/data/review/suspects.csv`, `ml/data/review/relabels.csv` (columns `file,new_label`, `new_label` empty) and contact sheets `ml/data/review/sheet-NN.png` (50 cells each, numbered, with label and prediction). Returns the review folder.

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_suspects.py`:
```python
import numpy as np

from sudoku_ml.suspects import rank_suspects


def test_lowest_probability_for_the_label_comes_first():
    probs = np.array([[0.1, 0.9], [0.95, 0.05], [0.5, 0.5]])
    rows = rank_suspects(["a", "b", "c"], [1, 1, 0], probs, top=2)
    assert [r["file"] for r in rows] == ["b", "c"]
    assert rows[0]["predicted"] == "empty" and rows[0]["label"] == "1"
    assert rows[0]["p_label"] == 0.05


def test_top_limits_the_rows():
    probs = np.full((10, 10), 0.1)
    assert len(rank_suspects([str(i) for i in range(10)], [0] * 10, probs, top=3)) == 3
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run --directory ml pytest -q tests/test_suspects.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sudoku_ml.suspects'`.

- [ ] **Step 3: Implement**

`ml/src/sudoku_ml/suspects.py`:
```python
"""Find training cells whose label is probably wrong (cross-validated loss ranking, R-13)."""

import csv
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

from sudoku_ml.augment import augment
from sudoku_ml.contract import DIGIT_CLASSES, UNKNOWN_KIND
from sudoku_ml.dataset import group_ids, load_cells, stack
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import preprocess_batch
from sudoku_ml.train import _device, _logits, loss


def rank_suspects(names, labels, probs: np.ndarray, top: int) -> list[dict]:
    p_label = probs[np.arange(len(labels)), labels]
    order = np.argsort(p_label)[:top]
    return [{"file": names[i], "label": DIGIT_CLASSES[labels[i]],
             "predicted": DIGIT_CLASSES[int(probs[i].argmax())],
             "p_label": round(float(p_label[i]), 4), "p_predicted": round(float(probs[i].max()), 4)}
            for i in order]


def _fit(images, digit, kind, epochs: int, device, generator) -> CellClassifier:
    model = CellClassifier().to(device)
    steps = max(1, len(images) // 256)
    optimiser = torch.optim.AdamW(model.parameters(), lr=0.003, weight_decay=1e-4)
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimiser, 0.003, total_steps=steps * epochs)
    for _ in range(epochs):
        model.train()
        for _ in range(steps):
            i = torch.randint(len(images), (256,), generator=generator)
            x = augment(images[i].to(device).permute(0, 3, 1, 2).float(), generator)
            d, k = model(preprocess_batch(x))
            value = loss(d, k, digit[i].to(device), kind[i].to(device), 0.4, 0.05)
            optimiser.zero_grad()
            value.backward()
            optimiser.step()
            schedule.step()
    return model


def _sheets(rows: list[dict], cells_dir: Path, out: Path) -> None:
    by_name = {p.stem: p for p in cells_dir.glob("*/*.png")}
    for sheet, start in enumerate(range(0, len(rows), 50)):
        canvas = Image.new("RGB", (10 * 110, 5 * 130), "white")
        draw = ImageDraw.Draw(canvas)
        for n, row in enumerate(rows[start : start + 50]):
            x, y = (n % 10) * 110, (n // 10) * 130
            canvas.paste(Image.open(by_name[row["file"]]).convert("RGB").resize((100, 100)), (x + 5, y + 5))
            draw.text((x + 5, y + 108), f"{start + n} {row['label']}→{row['predicted']}", fill="black")
        canvas.save(out / f"sheet-{sheet:02d}.png")


def find_suspects(ml_root: Path, folds: int = 5, epochs: int = 12, top: int = 150) -> Path:
    cells_dir = ml_root / "data" / "cells"
    paths = [p for label in DIGIT_CLASSES for p in sorted((cells_dir / label).glob("*.png"))]
    samples = load_cells(cells_dir)
    images, digit, kind = stack(samples)
    groups = group_ids(samples)
    unique = np.random.default_rng(0).permutation(np.unique(groups))
    fold_of = {g: i % folds for i, g in enumerate(unique)}
    fold = np.array([fold_of[g] for g in groups])
    device, generator = _device(), torch.Generator().manual_seed(0)
    probs = np.zeros((len(samples), len(DIGIT_CLASSES)), dtype=np.float32)
    for f in range(folds):
        train_idx, held = np.nonzero(fold != f)[0], np.nonzero(fold == f)[0]
        model = _fit(images[train_idx], digit[train_idx], kind[train_idx], epochs, device, generator)
        logits, _ = _logits(model, images[held], device)
        probs[held] = logits.softmax(1).numpy()
    rows = rank_suspects([p.stem for p in paths], digit.tolist(), probs, top)
    out = ml_root / "data" / "review"
    out.mkdir(parents=True, exist_ok=True)
    with (out / "suspects.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    with (out / "relabels.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["file", "new_label"])
        writer.writerows([[r["file"], ""] for r in rows])
    _sheets(rows, cells_dir, out)
    return out


if __name__ == "__main__":
    print(find_suspects(Path(__file__).parents[2]))
```
Check that `paths` and `samples` come out in the same order: both iterate `DIGIT_CLASSES` and sort each folder. `UNKNOWN_KIND` is imported for readers of `loss`; remove it if ruff flags it as unused.

- [ ] **Step 4: Run tests, add the recipe, run it**

Run: `just test-ml && just lint-ml` — all pass.
Append to `justfile`:
```make
# List the 150 most likely wrong labels in ml/data/review/ (contact sheets + relabels.csv)
suspects:
    uv run --directory ml python -m sudoku_ml.suspects
```
Run: `just suspects`
Expected: `ml/data/review/` with `suspects.csv`, `relabels.csv` and 3 contact sheets. It takes a few minutes on MPS.

- [ ] **Step 5: Commit the tool**

```bash
git add ml/src/sudoku_ml/suspects.py ml/tests/test_suspects.py justfile
git commit -m "feat(ml): rank suspect labels with cross-validated predictions (#4)"
```

- [ ] **Step 6: STOP — the developer checks the suspects**

Tell the developer, in one message:
- the folder `ml/data/review/` and the three sheets,
- how to fill `relabels.csv`: in column `new_label`, write the correct label (`empty`, `1`–`9`) or `unlabeled` when unsure; leave it empty when the current label is right,
- then run `just relabel`.

Wait for the developer to confirm. Do not edit labels yourself.

- [ ] **Step 7: After the check — record, retrain, export**

```bash
git diff --stat ml/datasets/cells.csv       # the relabels, as rows in git
just train
just export <the new run folder>
```
Expected: digit accuracy on the real test cells at least 0.985 (issue #4). Write before and after numbers into the pull request.
```bash
git add ml/datasets/cells.csv
git commit -m "chore(ml): fix labels found by the suspects check (#4)"
```

---

### Task 12: Documentation, CI, pull request and review

**Files:**
- Modify: `ml/README.md`, `docs/architecture/adr/adr-005-pytorch-to-tflite.md`, `docs/architecture/adr/adr-006-two-head-cell-classifier.md`, `docs/architecture/10-quality-requirements.md`, `.github/workflows/ci-ml.yml`

- [ ] **Step 1: ml/README.md** — add a "Commands" section, one line each: `just train [config]`, `just export <run>`, `just preprocess-fixtures`, `just dataset-manifest`, `just suspects`, `just relabel [file]`. Add one paragraph: runs land in `ml/artifacts/` (not in git), and a model trained with `real_cells = true` stays private (ADR-013).

- [ ] **Step 2: ADRs and quality** — in ADR-005 under "Measured before M0", add the real run: file size, `max_abs_diff`, op list. In ADR-006 under Consequences, add the real accuracy and the review-rate numbers. In chapter 10, section 10.4, add a row with the numbers after the label check. Keep status `Proposed` (the phone side is #5).

- [ ] **Step 3: CI** — in `.github/workflows/ci-ml.yml`: add `timeout-minutes: 20` to the job, and `enable-cache: true` to the `astral-sh/setup-uv` step. CI runs `just test-ml`, which uses the smoke config only.

- [ ] **Step 4: Full checks and pull request**

Run: `just lint && just test && just docs-check` — all pass.
```bash
git add ml/README.md docs .github/workflows/ci-ml.yml
git commit -m "docs: record the trained model and the new ml commands (#4)"
git push -u origin feature/4-cell-classifier
gh pr create --base develop --title "feat(ml): two-head cell classifier exported to TFLite"
```
Write the body with the PR template: `Closes #4`, the real-run numbers (accuracy, review rates, temperature, size, `max_abs_diff`, op list, number of relabelled cells), and any deviation from this plan with its reason. Check that CI passes.

- [ ] **Step 5: Fresh-context review**

A second agent without this session's context reviews the pull request against this plan and the spec files (AGENTS.md rule 8). Fix its findings, or answer them in the pull request. The developer merges.

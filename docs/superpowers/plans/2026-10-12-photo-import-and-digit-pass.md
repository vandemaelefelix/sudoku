# Photo Import and Digit Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn any folder of sudoku photos into labelled cells: import the photos, check the grid of each photo on a page, cut the cells, and confirm the model's digit for each cell one digit screen at a time.

**Architecture:** A CLI (`just import-photos`) copies the photos into `ml/data/photos/` and stores a proposed grid outline per photo. The existing labelling page (`just label-cells`) gets two new screens. **Photos** shows each photo with its outline: the person accepts it, fixes the 4 corners, or rejects it. An accepted photo is cut into 64 × 64 cells in `cells/unlabeled/`, with the same flatten as the app. **Digits** shows the unlabelled cells grouped by the model's predicted digit. The person clicks the odd ones out and confirms the rest in one keypress. The existing Groups screen then labels the kind of the new cells, without changes.

**Tech Stack:** Python 3.12, uv, numpy, Pillow, opencv-python-headless, pillow-heif, PyTorch (the existing model), `http.server` (the existing label server), one HTML page with plain JavaScript, pytest, ruff, `just`.

**Spec:** There is no separate spec file. The design is in issue [#70](https://github.com/vandemaelefelix/sudoku/issues/70) (import scraped photos into cells) and in the section "Design decisions" below. Read both.

## Global Constraints

- Work in the worktree `~/projects/sudoku-70-import-photos` on branch `feature/70-import-photos`. It is based on `origin/develop`.
- Run every command from the worktree root. ml commands use `uv run --directory ml ...` or `just ...`.
- Commit after each task on this branch. Do not push. Do not open a pull request. The developer does that.
- Commit messages: Conventional Commits with the issue, for example `feat(ml): flatten photos like the app scanner (#70)`.
- Follow `AGENTS.md`: Simplified Technical English (short sentences, active voice, one word for one thing), comment rules (no TODO, FIXME, XXX or HACK; no commented-out code; comments say why, not what), every lint suppression names its rule.
- SUD-02: the server binds to 127.0.0.1 only. No image leaves the Mac.
- SUD-07: `ml/` never imports TypeScript code. Python copies the app's numbers (576, 64) as constants.
- SUD-08: never commit an image. `ml/data/` is gitignored. Files in `ml/datasets/` hold ids, words and numbers only.
- Do not change the model contract (`docs/architecture/00-concepts/model-contract.md`) or `contract.py`.
- Line length 100. Run `uv run --directory ml ruff check --fix .` and `uv run --directory ml ruff format .` before `just lint-ml`. The import order in this plan's code blocks is not final: ruff sorts it. `just lint-ml` and `just test-ml` must pass after every task. If a code block in this plan breaks a lint rule, reformat it. Do not add a suppression.
- The real data is not in this worktree (`ml/data/` is missing). Tests use `tmp_path` only. Never write to `~/projects/sudoku/ml/data/`.

## Design decisions

These are fixed. Do not change them without asking the developer.

1. **Photo id** = `pixel_id(path)` from `sudoku_ml.manifest` on the stored file, exactly as for cells. The stored file name is `<id[:16]><suffix in lower case>`.
2. **Upright photo**: every pixel coordinate (corners, preview, cut) is in the photo after `ImageOps.exif_transpose`. The id uses the raw pixels (no transpose), as the existing 253 photos do.
3. **`photos.csv`** gets two new columns: `id,file,origin,licence,attribution`. Existing rows get `licence` = `none` and an empty `attribution`.
   - Origins: `phone`, `web`, `wicht`, `openverse`, `commons`, `lexski`.
   - Licences: `none`, `own`, `unverified`, `cc0`, `pdm`, `by`, `by-sa`, `by-nc`, `by-nc-sa`, `by-nd`, `by-nc-nd`.
4. **Source of origin and licence**: a `manifest.jsonl` in the photo folder or its parent (the scraper writes one). Its `source` field before the first `/` is the origin, and its `licence` and `attribution` fields are used as they are. A photo that is not in the manifest gets the `--origin` and `--licence` from the command line. If neither exists, the import skips the photo and says why.
5. **Flatten = the app's flatten** (`apps/mobile/src/scanner/warp.ts`, `pixels.ts`): the 4 corners map to the pixel edges `-0.5` and `575.5` of a 576 × 576 image, with bilinear sampling and repeated border pixels. Cell `n` is rows `64·(n//9)` to `64·(n//9)+63` and columns `64·(n%9)` to `64·(n%9)+63`.
6. **Corners** are `[[x, y], [x, y], [x, y], [x, y]]` in the order top left, top right, bottom right, bottom left. A corner may lie outside the photo.
7. **Usable cell**: all 4 corners of the cell, mapped back into the photo, lie inside the photo. Only usable cells are cut. A photo with fewer than 10 usable cells gets the decision `too-few-cells`, and no cells are cut.
8. **New files:**

   | File | In git | Content |
   | --- | --- | --- |
   | `ml/data/import/detections.json` | No | The proposed outline per imported photo |
   | `ml/datasets/photo-checks.jsonl` | Yes | One line per photo decision: `accepted`, `rejected` or `too-few-cells`, with the corners |
   | `ml/datasets/cell-origins.csv` | Yes | `cell,photo,row,col` for each cut cell |
   | `ml/data/prelabels.json` | No | The model's digit and kind per cell in `unlabeled/` |
   | `ml/data/cells/discarded/` | No | Cells that a person discarded in the digit pass. Training ignores them |

9. **Duplicate cells**: if the pixel id of a cut cell already exists in any cell folder, the cut skips that cell and counts it as a duplicate.
10. **Digit pass**:
    - It shows only cells in `unlabeled/` that have a pre-label.
    - It shows only predicted handwritten cells by default. The K key switches to all kinds.
    - Least sure cells come first. A screen holds up to 100 cells.
    - Each change is a `digit` line in `kind-log.jsonl` with screen `digits`, so undo and rollback work.
    - The digit pass never writes a kind.
11. **Pre-labels**: `just label-cells` runs `just prelabel-cells` before the server starts. A pre-label is computed only for a cell that does not have one yet. If no model run exists, the command prints a warning and exits with 0.
12. **No undo on the Photos screen.** The person sees the flattened preview before pressing Enter.

## Review Focus

These inputs are likely in real use. Each one has a test in the task that owns the code.

1. **An iPhone HEIC photo or a photo with EXIF rotation.** The import must read it, and the corners must match the upright photo. Tests: Task 3 (`test_a_heic_photo_is_imported`, `test_a_rotated_photo_gets_upright_corners`), Task 2 (`test_load_upright_applies_exif_rotation`).
2. **The same folder imported twice, or a photo already in `photos.csv`.** No second copy and no second row. Test: Task 3 (`test_importing_the_same_folder_twice_adds_nothing`).
3. **A grid partly outside the photo.** Only the cells inside are cut. Test: Task 4 (`test_a_grid_cut_off_by_the_photo_gives_only_the_cells_inside`).
4. **New cells used in the same server session**: cut on Photos, then shown and served as images, without a restart. Test: Task 7 (`test_an_accepted_photo_serves_its_new_cells`).
5. **Undo after a digit-pass confirm** puts all cells of that screen back into `unlabeled/`. Test: Task 6 (`test_undo_puts_a_digit_screen_back`).

---

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `ml/pyproject.toml`, `ml/uv.lock` | 1 | opencv becomes a runtime dependency. Add pillow-heif |
| `ml/src/sudoku_ml/manifest.py` | 1 | Accept the `discarded` folder |
| `ml/src/sudoku_ml/kind_log.py` | 1 | Document the screen value `digits` |
| `ml/src/sudoku_ml/flatten.py` | 2 | Upright load, homography, warp, slice, usable cells |
| `ml/src/sudoku_ml/grid_detect.py` | 2 | Find the grid outline and count the grid lines |
| `ml/tests/photos.py` | 2 | Test helper: draws synthetic sudoku photos |
| `ml/src/sudoku_ml/photo_import.py` | 3 | `PhotoPaths`, `photos.csv`, the import CLI |
| `ml/src/sudoku_ml/photo_check.py` | 4 | State and rules of the Photos screen, the cut |
| `ml/src/sudoku_ml/prelabel.py` | 5 | Write `prelabels.json` |
| `ml/src/sudoku_ml/label_store.py` | 6 | Digit screen, assign, register, batched moves |
| `ml/src/sudoku_ml/label_server.py` | 7 | HTTP routes for Photos and Digits |
| `ml/src/sudoku_ml/label_page.html` | 8 | The Photos and Digits screens |
| `justfile` | 3, 5 | `import-photos`, `prelabel-cells`, `label-cells` |
| docs | 9 | ADR-009 amendment, index rows, data sources, README, glossary |

---

### Task 1: Dependencies and the `discarded` folder

**Files:**
- Modify: `ml/pyproject.toml`
- Modify: `ml/uv.lock` (generated)
- Modify: `ml/src/sudoku_ml/manifest.py`
- Modify: `ml/src/sudoku_ml/kind_log.py:17`
- Test: `ml/tests/test_manifest.py`

**Interfaces:**
- Produces: `manifest.LABELS == ("empty", "1", …, "9", "unlabeled", "discarded")`. `relabel.move_cells` accepts `discarded` through `LABELS`. In `cells.csv`, a cell in `discarded/` has the kind column `""`.

- [ ] **Step 1: Write the failing test**

Append to `ml/tests/test_manifest.py`:

```python
def test_a_discarded_cell_is_listed_without_a_kind(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    cell_id = add_cell(cells, "discarded", 40)
    write_cells_manifest(cells, manifest)
    assert rows(manifest) == [{"id": cell_id, "label": "discarded", "kind": ""}]
```

- [ ] **Step 2: Run the test to see it fail**

Run: `uv run --directory ml pytest tests/test_manifest.py::test_a_discarded_cell_is_listed_without_a_kind -v`
Expected: FAIL with `is not a known label`.

- [ ] **Step 3: Implement**

In `ml/src/sudoku_ml/manifest.py`, replace the `LABELS` line and `_kind_column`:

```python
# Training reads only DIGIT_CLASSES. `unlabeled` waits for a label. `discarded` holds cells that
# a person rejected in the digit pass: bad cuts, unreadable marks.
LABELS = (*DIGIT_CLASSES, "unlabeled", "discarded")


def _kind_column(cell_id: str, label: str, logged: str | None) -> str:
    if label == "empty":
        if logged is not None:
            raise ValueError(f"{cell_id[:16]}: an empty cell has the logged kind {logged}")
        return "none"
    if label in ("unlabeled", "discarded"):
        return ""
    return logged or ""
```

In `ml/src/sudoku_ml/kind_log.py`, change the comment of `screen` in `Line`:

```python
    screen: str  # "groups", "review", "digits" or "undo"
```

In `ml/pyproject.toml`, move `opencv-python-headless` from `[dependency-groups] dev` to `[project] dependencies`, and add pillow-heif. The two lists become:

```toml
dependencies = [
    "ai-edge-litert==2.2.0",
    "litert-torch==0.9.4",
    "numpy>=2.2",
    "opencv-python-headless==5.0.0.93",
    "pillow==12.3.0",
    "pillow-heif==1.8.0",
    "torch==2.13.0",
]
```

```toml
[dependency-groups]
dev = [
    "flatbuffers",
    "pytest>=8.4",
    "ruff>=0.12",
]
```

Then run: `uv lock --directory ml`. If `pillow-heif==1.8.0` does not resolve with `pillow==12.3.0`, use the newest pillow-heif that resolves. Do not change the pillow pin. Say in the commit message which version you used.

- [ ] **Step 4: Run the tests**

Run: `just test-ml && just lint-ml`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ml/pyproject.toml ml/uv.lock ml/src/sudoku_ml/manifest.py ml/src/sudoku_ml/kind_log.py ml/tests/test_manifest.py
git commit -m "feat(ml): discarded cell folder, opencv and pillow-heif at run time (#70)"
```

---

### Task 2: Flatten like the app, and find the grid

**Files:**
- Create: `ml/src/sudoku_ml/flatten.py`
- Create: `ml/src/sudoku_ml/grid_detect.py`
- Create: `ml/tests/photos.py` (a test helper, not a test file)
- Test: `ml/tests/test_flatten.py`, `ml/tests/test_grid_detect.py`

**Interfaces:**
- Produces in `flatten.py`:
  - `GRID_CELLS = 9`, `FLAT_SIZE = 576`, type alias `Corners = list[list[float]]`
  - `load_upright(path: Path) -> np.ndarray`: (H, W, 3) uint8 RGB
  - `homography(corners: Corners) -> np.ndarray`: 3 × 3, photo → flat
  - `warp_grid(image: np.ndarray, corners: Corners) -> np.ndarray`: (576, 576, …) same dtype and channels as `image`
  - `slice_cells(flat: np.ndarray) -> list[np.ndarray]`: 81 × (64, 64, 3)
  - `usable_cells(corners: Corners, width: int, height: int) -> list[bool]`: 81 values, row by row
  - `check_corners(corners) -> Corners`: validated copy. Raises `ValueError`
- Produces in `grid_detect.py`:
  - `MIN_LINES = 17`
  - `@dataclass(frozen=True) class Detection: corners: Corners | None; lines: int; reason: str`
  - `find_grid(rgb: np.ndarray) -> Detection`
- Produces in `ml/tests/photos.py`:
  - `grid_photo(width=1000, height=800, left=200, top=100, size=540, seed=0) -> np.ndarray`
  - `save_photo(rgb: np.ndarray, path: Path, orientation: int | None = None) -> Path`

- [ ] **Step 1: Write the test helper**

Create `ml/tests/photos.py`:

```python
"""Synthetic sudoku photos for the import tests."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def grid_photo(
    width: int = 1000,
    height: int = 800,
    left: int = 200,
    top: int = 100,
    size: int = 540,
    seed: int = 0,
) -> np.ndarray:
    """(height, width, 3) uint8: a printed 9 × 9 grid with random digits on off-white paper.
    The outer grid edge is at left, top, left + size and top + size."""
    image = Image.new("RGB", (width, height), (235, 230, 220))
    draw = ImageDraw.Draw(image)
    step = size / 9
    for k in range(10):
        line_width = 5 if k % 3 == 0 else 2
        x, y = left + k * step, top + k * step
        draw.line([(x, top), (x, top + size)], fill=(20, 20, 20), width=line_width)
        draw.line([(left, y), (left + size, y)], fill=(20, 20, 20), width=line_width)
    font = ImageFont.load_default(size=int(step * 0.6))
    rng = np.random.default_rng(seed)
    for row in range(9):
        for col in range(9):
            if rng.random() < 0.4:
                centre = (left + (col + 0.5) * step, top + (row + 0.5) * step)
                digit = str(int(rng.integers(1, 10)))
                draw.text(centre, digit, fill=(30, 30, 30), font=font, anchor="mm")
    return np.asarray(image)


def save_photo(rgb: np.ndarray, path: Path, orientation: int | None = None) -> Path:
    """Save as PNG. With `orientation`, also write that EXIF orientation tag (274)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.fromarray(rgb)
    if orientation is None:
        image.save(path)
    else:
        exif = Image.Exif()
        exif[274] = orientation
        image.save(path, exif=exif)
    return path
```

- [ ] **Step 2: Write the failing flatten tests**

Create `ml/tests/test_flatten.py`:

```python
import numpy as np
import pytest
from photos import save_photo

from sudoku_ml.flatten import (
    FLAT_SIZE,
    check_corners,
    load_upright,
    slice_cells,
    usable_cells,
    warp_grid,
)

EDGE = FLAT_SIZE - 0.5
SQUARE = [[-0.5, -0.5], [EDGE, -0.5], [EDGE, EDGE], [-0.5, EDGE]]


def test_corners_on_the_pixel_edges_give_the_same_image():
    rgb = np.random.default_rng(0).integers(0, 256, (FLAT_SIZE, FLAT_SIZE, 3), dtype=np.uint8)
    assert np.abs(warp_grid(rgb, SQUARE).astype(int) - rgb).max() <= 1


def test_slice_cells_goes_row_by_row():
    flat = np.zeros((FLAT_SIZE, FLAT_SIZE, 3), dtype=np.uint8)
    for n in range(81):
        r, c = divmod(n, 9)
        flat[r * 64 : (r + 1) * 64, c * 64 : (c + 1) * 64] = n
    cells = slice_cells(flat)
    assert len(cells) == 81
    assert all(cell.shape == (64, 64, 3) and (cell == n).all() for n, cell in enumerate(cells))


def test_every_cell_is_usable_when_the_grid_fills_the_photo():
    assert sum(usable_cells(SQUARE, FLAT_SIZE, FLAT_SIZE)) == 81


def test_a_photo_that_ends_inside_the_last_column_drops_that_column():
    usable = usable_cells(SQUARE, int(8.5 * 64), FLAT_SIZE)
    assert sum(usable) == 72
    assert not any(usable[8::9])


def test_corners_outside_the_photo_are_allowed():
    corners = [[-200.0, -0.5], [EDGE, -0.5], [EDGE, EDGE], [-200.0, EDGE]]
    assert 0 < sum(usable_cells(corners, FLAT_SIZE, FLAT_SIZE)) < 81


@pytest.mark.parametrize(
    "bad",
    [
        [[0, 0], [1, 0], [1, 1]],
        [[0, 0], [1, 0], [1, 1], [0, "x"]],
        [[0, 0], [1, 0], [1, 1], [0, float("nan")]],
        [[0, 0], [0, 0], [0, 0], [0, 0]],
    ],
)
def test_check_corners_refuses_bad_corners(bad):
    with pytest.raises(ValueError):
        check_corners(bad)


def test_load_upright_applies_exif_rotation(tmp_path):
    rgb = np.zeros((20, 40, 3), dtype=np.uint8)
    path = save_photo(rgb, tmp_path / "turned.png", orientation=6)
    assert load_upright(path).shape == (40, 20, 3)
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `uv run --directory ml pytest tests/test_flatten.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'sudoku_ml.flatten'`.

- [ ] **Step 4: Implement `flatten.py`**

Create `ml/src/sudoku_ml/flatten.py`:

```python
"""The flatten of the app's scanner, in Python: 4 corners, a 576 × 576 grid, 81 cell images.

The numbers copy apps/mobile/src/scanner/warp.ts and pixels.ts (SUD-07: files only, no imports).
"""

import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from sudoku_ml.contract import CELL_SIZE

register_heif_opener()

GRID_CELLS = 9
FLAT_SIZE = CELL_SIZE * GRID_CELLS
# Pixel centres are on integers, so the edges of the square are at -0.5 and FLAT_SIZE - 0.5, as
# in warpGrid of the app.
_EDGE = FLAT_SIZE - 0.5
_SQUARE = np.array(
    [[-0.5, -0.5], [_EDGE, -0.5], [_EDGE, _EDGE], [-0.5, _EDGE]], dtype=np.float32
)

Corners = list[list[float]]  # top left, top right, bottom right, bottom left; upright photo pixels


def load_upright(path: Path) -> np.ndarray:
    """(H, W, 3) uint8 RGB, turned by the EXIF orientation. All corners use these pixels."""
    with Image.open(path) as image:
        return np.asarray(ImageOps.exif_transpose(image).convert("RGB"))


def check_corners(corners) -> Corners:
    """A float copy of 4 finite [x, y] points that span an area. Raises ValueError."""
    try:
        points = [[float(x), float(y)] for x, y in corners]
    except (TypeError, ValueError) as error:
        raise ValueError(f"corners must be 4 [x, y] pairs: {error}") from error
    if len(points) != 4 or not all(math.isfinite(v) for p in points for v in p):
        raise ValueError("corners must be 4 [x, y] pairs of finite numbers")
    area = cv2.contourArea(np.array(points, dtype=np.float32))
    if area < 1.0:
        raise ValueError("the 4 corners do not span an area")
    return points


def homography(corners: Corners) -> np.ndarray:
    return cv2.getPerspectiveTransform(np.array(corners, dtype=np.float32), _SQUARE)


def warp_grid(image: np.ndarray, corners: Corners) -> np.ndarray:
    """FLAT_SIZE square: bilinear, border pixels repeated, as the app's warpPerspective call."""
    return cv2.warpPerspective(
        image,
        homography(corners),
        (FLAT_SIZE, FLAT_SIZE),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )


def slice_cells(flat: np.ndarray) -> list[np.ndarray]:
    """81 (CELL_SIZE, CELL_SIZE, 3) cell images, row by row, as sliceCells of the app."""
    return [
        flat[r * CELL_SIZE : (r + 1) * CELL_SIZE, c * CELL_SIZE : (c + 1) * CELL_SIZE].copy()
        for r in range(GRID_CELLS)
        for c in range(GRID_CELLS)
    ]


def usable_cells(corners: Corners, width: int, height: int) -> list[bool]:
    """Per cell, row by row: True when all 4 cell corners lie inside the photo.

    A perspective transform keeps straight lines straight, so the whole cell is then inside.
    """
    edges = np.arange(GRID_CELLS + 1) * CELL_SIZE - 0.5
    xs, ys = np.meshgrid(edges, edges)
    points = np.stack([xs.ravel(), ys.ravel()], axis=1).astype(np.float32)[None]
    inverse = np.linalg.inv(homography(corners))
    photo = cv2.perspectiveTransform(points, inverse)[0].reshape(GRID_CELLS + 1, GRID_CELLS + 1, 2)
    tolerance = 1e-3
    inside = (
        (photo[..., 0] >= -0.5 - tolerance)
        & (photo[..., 0] <= width - 0.5 + tolerance)
        & (photo[..., 1] >= -0.5 - tolerance)
        & (photo[..., 1] <= height - 0.5 + tolerance)
    )
    return [
        bool(inside[r, c] and inside[r, c + 1] and inside[r + 1, c] and inside[r + 1, c + 1])
        for r in range(GRID_CELLS)
        for c in range(GRID_CELLS)
    ]
```

- [ ] **Step 5: Run the flatten tests**

Run: `uv run --directory ml pytest tests/test_flatten.py -v`
Expected: PASS.

- [ ] **Step 6: Write the failing grid detection tests**

Create `ml/tests/test_grid_detect.py`:

```python
import numpy as np
from photos import grid_photo

from sudoku_ml.grid_detect import MIN_LINES, find_grid


def test_a_printed_grid_is_found_at_its_outer_edge():
    found = find_grid(grid_photo(left=200, top=100, size=540))
    assert found.corners is not None
    expected = [[200, 100], [740, 100], [740, 640], [200, 640]]
    assert np.abs(np.array(found.corners) - expected).max() <= 8
    assert found.lines >= MIN_LINES and found.reason == "full grid"


def test_a_blank_photo_has_no_grid():
    blank = np.full((600, 800, 3), 230, dtype=np.uint8)
    found = find_grid(blank)
    assert found.corners is None and found.lines == 0 and found.reason == "no grid outline"
```

- [ ] **Step 7: Run the tests to see them fail**

Run: `uv run --directory ml pytest tests/test_grid_detect.py -v`
Expected: FAIL with `No module named 'sudoku_ml.grid_detect'`.

- [ ] **Step 8: Implement `grid_detect.py`**

This code comes from the standalone scraper (`~/projects/sudoku-paper-scraper`, `grid.py`), with the app's flatten from Task 2. Create `ml/src/sudoku_ml/grid_detect.py`:

```python
"""Find the sudoku grid in a photo: the largest four-corner outlines, a flatten from each, then a
check that the 20 grid lines lie where a flattened grid has them. A proposal for the person on
the Photos screen, not the app's scanner."""

from dataclasses import dataclass

import cv2
import numpy as np

from sudoku_ml.contract import CELL_SIZE
from sudoku_ml.flatten import Corners, warp_grid

DETECT_SIZE = 800  # long side in pixels for the outline search
MIN_GRID_SHARE = 0.3  # mean grid edge / short side of the photo
SEARCH = CELL_SIZE // 4  # pixels around each expected line
LINE_COVERAGE = 0.5  # share of the grid width that a line must cover
MIN_LINES = 17  # of the 10 horizontal and 10 vertical lines; a curl or a pen can hide a few
LINE_CONTRAST = 0.3  # a line covers this much more of the width than the cells beside it
MAX_CANDIDATES = 6
# A low offset finds faint, blurred lines. A high offset keeps paper grain from looking like lines.
THRESHOLD_OFFSETS = (3, 10)


@dataclass(frozen=True)
class Detection:
    corners: Corners | None  # None when no four-corner outline exists
    lines: int  # grid lines found, 0 to 20
    reason: str


def _order(quad: np.ndarray) -> np.ndarray:
    s = quad.sum(axis=1)
    d = np.diff(quad, axis=1).ravel()
    return np.array(
        [quad[np.argmin(s)], quad[np.argmin(d)], quad[np.argmax(s)], quad[np.argmax(d)]],
        dtype=np.float32,
    )


def _candidate_outlines(gray: np.ndarray) -> list[np.ndarray]:
    """Convex four-corner outlines, largest first. A page outline can come before the grid."""
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 7
    )
    binary = cv2.dilate(binary, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    outlines: list[np.ndarray] = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[: MAX_CANDIDATES * 3]:
        # The hull ignores digits and text that touch the outer grid line.
        hull = cv2.convexHull(contour)
        perimeter = cv2.arcLength(hull, True)
        for epsilon in (0.02, 0.03, 0.04, 0.06):
            approx = cv2.approxPolyDP(hull, epsilon * perimeter, True)
            if len(approx) == 4:
                quad = _order(approx.reshape(4, 2).astype(np.float32))
                # The inner and outer edge of one thick line give two near-equal outlines.
                if all(np.abs(quad - known).max() > 0.02 * max(gray.shape) for known in outlines):
                    outlines.append(quad)
                break
            if len(approx) < 4:
                break
        if len(outlines) == MAX_CANDIDATES:
            break
    return outlines


def _line_profile(mask: np.ndarray) -> np.ndarray:
    """Share of each row that holds ink within 2 rows, so a slightly bent line still counts."""
    thick = cv2.dilate(mask, np.ones((5, 1), np.uint8))
    return (thick > 0).mean(axis=1)


def _count_lines_in(binary: np.ndarray) -> int:
    # Close the gaps in faint lines first. The openings with long thin kernels then keep the grid
    # lines and drop the digits.
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((1, 9), np.uint8))
    horizontal = cv2.morphologyEx(
        horizontal, cv2.MORPH_OPEN, np.ones((1, CELL_SIZE // 2), np.uint8)
    )
    vertical = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((9, 1), np.uint8))
    vertical = cv2.morphologyEx(vertical, cv2.MORPH_OPEN, np.ones((CELL_SIZE // 2, 1), np.uint8))
    found = 0
    for profile in (_line_profile(horizontal), _line_profile(vertical.T)):
        mid, band = CELL_SIZE // 2, CELL_SIZE // 6
        gaps = [
            profile[k * CELL_SIZE + mid - band : k * CELL_SIZE + mid + band].max()
            for k in range(9)
        ]
        for k in range(10):
            peak = profile[max(0, k * CELL_SIZE - SEARCH) : k * CELL_SIZE + SEARCH + 1].max()
            beside = max(gaps[k - 1] if k > 0 else 0.0, gaps[k] if k < 9 else 0.0)
            found += bool(peak >= LINE_COVERAGE and peak - beside >= LINE_CONTRAST)
    return found


def _count_lines(flat_gray: np.ndarray) -> int:
    """The expected grid lines (0 to 20) that stand out from the cells beside them."""
    blurred = cv2.GaussianBlur(flat_gray, (3, 3), 0)
    return max(
        _count_lines_in(
            cv2.adaptiveThreshold(
                blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, offset
            )
        )
        for offset in THRESHOLD_OFFSETS
    )


def find_grid(rgb: np.ndarray) -> Detection:
    """The best outline of an upright RGB photo. Never raises on odd images."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    height, width = gray.shape
    scale = min(1.0, DETECT_SIZE / max(height, width))
    small = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    best: Detection | None = None
    for outline in _candidate_outlines(small):
        corners = outline / scale
        tl, tr, br, bl = corners
        mean_edge = (np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2
        if mean_edge < MIN_GRID_SHARE * min(height, width):
            break  # the candidates are sorted by area, so the rest are smaller still
        listed = [[float(x), float(y)] for x, y in corners]
        found = _count_lines(warp_grid(gray, listed))
        if best is not None and found <= best.lines:
            continue
        reason = "full grid" if found >= MIN_LINES else f"only {found} of 20 grid lines"
        best = Detection(listed, found, reason)
        if found >= MIN_LINES:
            return best
    return best or Detection(None, 0, "no grid outline")
```

- [ ] **Step 9: Run the tests**

Run: `uv run --directory ml pytest tests/test_flatten.py tests/test_grid_detect.py -v`
Expected: PASS. If the corner test misses by more than 8 px, print `found.corners` first. The dilated outer contour can sit up to about 4 px outside the drawn 5 px line. Do not raise the tolerance above 8. Fix the detection instead.

- [ ] **Step 10: Lint and commit**

```bash
just lint-ml && just test-ml
git add ml/src/sudoku_ml/flatten.py ml/src/sudoku_ml/grid_detect.py ml/tests/photos.py ml/tests/test_flatten.py ml/tests/test_grid_detect.py
git commit -m "feat(ml): flatten photos like the app scanner and find the grid (#70)"
```

---

### Task 3: Import a folder of photos

**Files:**
- Create: `ml/src/sudoku_ml/photo_import.py`
- Modify: `justfile` (add `import-photos` after `dataset-manifest`)
- Test: `ml/tests/test_photo_import.py`

**Interfaces:**
- Consumes: `flatten.load_upright`, `grid_detect.find_grid`, `manifest.pixel_id`.
- Produces:
  - `ORIGINS`, `LICENCES` (tuples of str), `PHOTO_FIELDS = ["id", "file", "origin", "licence", "attribution"]`, `PHOTO_SUFFIXES`
  - `@dataclass(frozen=True) class PhotoPaths: photos, manifest, detections, checks, origins, cells` (all `Path`), with `PhotoPaths.under(ml_root: Path) -> PhotoPaths`
  - `read_photos(manifest: Path) -> list[dict[str, str]]`: rows with all 5 fields, old rows filled with `licence="none"` and `attribution=""`
  - `write_photos(manifest: Path, rows: list[dict[str, str]]) -> None`
  - `read_detections(path: Path) -> dict[str, dict]`: photo id → `{"corners", "lines", "reason", "width", "height"}`
  - `import_folder(folder: Path, paths: PhotoPaths, origin: str | None, licence: str | None) -> dict[str, int]`: counts with the keys `imported`, `already`, `unreadable`, `no_source`
  - CLI: `python -m sudoku_ml.photo_import <folder> [--origin O] [--licence L]`

- [ ] **Step 1: Write the failing tests**

Create `ml/tests/test_photo_import.py`:

```python
import json
from pathlib import Path

import numpy as np
import pytest
from photos import grid_photo, save_photo

from sudoku_ml.manifest import pixel_id
from sudoku_ml.photo_import import (
    PhotoPaths,
    import_folder,
    main,
    read_detections,
    read_photos,
    write_photos,
)


def paths_in(root: Path) -> PhotoPaths:
    return PhotoPaths.under(root / "ml")


def test_a_folder_of_photos_is_copied_listed_and_detected(tmp_path: Path):
    folder = tmp_path / "in"
    first = save_photo(grid_photo(seed=1), folder / "a.png")
    save_photo(grid_photo(seed=2), folder / "b.PNG")
    (folder / "notes.txt").write_text("not a photo")
    paths = paths_in(tmp_path)
    counts = import_folder(folder, paths, origin="phone", licence="own")
    assert counts == {"imported": 2, "already": 0, "unreadable": 0, "no_source": 0}
    rows = read_photos(paths.manifest)
    first_id = pixel_id(first)
    assert rows[0] == {
        "id": first_id,
        "file": f"{first_id[:16]}.png",
        "origin": "phone",
        "licence": "own",
        "attribution": "",
    }
    assert (paths.photos / f"{first_id[:16]}.png").read_bytes() == first.read_bytes()
    assert rows[1]["file"].endswith(".png")
    detection = read_detections(paths.detections)[first_id]
    assert detection["reason"] == "full grid" and len(detection["corners"]) == 4
    assert (detection["width"], detection["height"]) == (1000, 800)


def test_importing_the_same_folder_twice_adds_nothing(tmp_path: Path):
    folder = tmp_path / "in"
    save_photo(grid_photo(seed=1), folder / "a.png")
    paths = paths_in(tmp_path)
    import_folder(folder, paths, origin="phone", licence="own")
    counts = import_folder(folder, paths, origin="phone", licence="own")
    assert counts["already"] == 1 and counts["imported"] == 0
    assert len(read_photos(paths.manifest)) == 1
    assert len(list(paths.photos.iterdir())) == 1


def test_the_scraper_manifest_in_the_parent_gives_origin_licence_and_attribution(tmp_path):
    out = tmp_path / "sudoku-paper"
    save_photo(grid_photo(seed=3), out / "handwritten" / "wicht-image7.png")
    line = {
        "file": "wicht-image7.png",
        "source": "openverse/flickr",
        "licence": "by-nc",
        "attribution": "Photo by someone, CC BY-NC",
    }
    (out / "manifest.jsonl").write_text(json.dumps(line) + "\n")
    paths = paths_in(tmp_path)
    import_folder(out / "handwritten", paths, origin=None, licence=None)
    row = read_photos(paths.manifest)[0]
    assert (row["origin"], row["licence"]) == ("openverse", "by-nc")
    assert row["attribution"] == "Photo by someone, CC BY-NC"


def test_a_photo_without_origin_or_licence_is_skipped(tmp_path: Path):
    folder = tmp_path / "in"
    save_photo(grid_photo(seed=1), folder / "a.png")
    paths = paths_in(tmp_path)
    counts = import_folder(folder, paths, origin=None, licence=None)
    assert counts["no_source"] == 1
    assert not paths.photos.exists() or not any(paths.photos.iterdir())


def test_an_unreadable_file_is_counted_and_skipped(tmp_path: Path):
    folder = tmp_path / "in"
    folder.mkdir()
    (folder / "broken.jpg").write_bytes(b"not a jpeg")
    counts = import_folder(folder, paths_in(tmp_path), origin="web", licence="none")
    assert counts["unreadable"] == 1


def test_old_rows_get_licence_none_and_keep_their_order(tmp_path: Path):
    paths = paths_in(tmp_path)
    paths.manifest.parent.mkdir(parents=True)
    paths.manifest.write_text("id,file,origin\nbbb,bbb.jpg,phone\naaa,aaa.jpg,web\n")
    rows = read_photos(paths.manifest)
    assert [r["id"] for r in rows] == ["bbb", "aaa"]
    assert rows[0]["licence"] == "none" and rows[0]["attribution"] == ""
    write_photos(paths.manifest, rows)
    assert paths.manifest.read_text().splitlines()[0] == "id,file,origin,licence,attribution"


def test_a_rotated_photo_gets_upright_corners(tmp_path: Path):
    upright = grid_photo(width=800, height=1000, left=100, top=200, size=540)
    # Orientation 6 means: turn 90° clockwise to show. So store the photo turned the other way.
    stored = np.rot90(upright, k=1).copy()
    path = save_photo(stored, tmp_path / "in" / "turned.png", orientation=6)
    paths = paths_in(tmp_path)
    import_folder(tmp_path / "in", paths, origin="phone", licence="own")
    detection = read_detections(paths.detections)[pixel_id(path)]
    assert (detection["width"], detection["height"]) == (800, 1000)
    expected = [[100, 200], [640, 200], [640, 740], [100, 740]]
    assert np.abs(np.array(detection["corners"]) - expected).max() <= 8


def test_a_heic_photo_is_imported(tmp_path: Path):
    from PIL import Image

    path = tmp_path / "in" / "phone.heic"
    path.parent.mkdir(parents=True)
    try:
        Image.fromarray(grid_photo()).save(path, format="HEIF", quality=95)
    except (KeyError, OSError, ValueError) as error:
        pytest.skip(f"this pillow-heif build cannot write HEIC: {error}")
    paths = paths_in(tmp_path)
    assert import_folder(tmp_path / "in", paths, origin="phone", licence="own")["imported"] == 1
    row = read_photos(paths.manifest)[0]
    assert row["file"].endswith(".heic")
    assert read_detections(paths.detections)[row["id"]]["reason"] == "full grid"


def test_the_cli_refuses_an_unknown_origin(tmp_path: Path):
    with pytest.raises(SystemExit):
        main([str(tmp_path), "--origin", "reddit", "--licence", "none"], tmp_path / "ml")
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `uv run --directory ml pytest tests/test_photo_import.py -v`
Expected: FAIL with `No module named 'sudoku_ml.photo_import'`.

- [ ] **Step 3: Implement `photo_import.py`**

Create `ml/src/sudoku_ml/photo_import.py`:

```python
"""Copy a folder of sudoku photos into ml/data/photos/ and propose a grid outline for each
(ADR-009, amendment of 2026-10-12). The Photos screen of the labelling page then checks them."""

import argparse
import csv
import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

from sudoku_ml.flatten import load_upright
from sudoku_ml.grid_detect import find_grid
from sudoku_ml.manifest import pixel_id

ORIGINS = ("phone", "web", "wicht", "openverse", "commons", "lexski")
LICENCES = (
    "none",
    "own",
    "unverified",
    "cc0",
    "pdm",
    "by",
    "by-sa",
    "by-nc",
    "by-nc-sa",
    "by-nd",
    "by-nc-nd",
)
PHOTO_FIELDS = ["id", "file", "origin", "licence", "attribution"]
PHOTO_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp", ".heic")
ML_ROOT = Path(__file__).parents[2]


@dataclass(frozen=True)
class PhotoPaths:
    photos: Path
    manifest: Path  # photos.csv
    detections: Path
    checks: Path  # photo-checks.jsonl
    origins: Path  # cell-origins.csv
    cells: Path

    @classmethod
    def under(cls, ml_root: Path) -> "PhotoPaths":
        data, datasets = ml_root / "data", ml_root / "datasets"
        return cls(
            data / "photos",
            datasets / "photos.csv",
            data / "import" / "detections.json",
            datasets / "photo-checks.jsonl",
            datasets / "cell-origins.csv",
            data / "cells",
        )


def read_photos(manifest: Path) -> list[dict[str, str]]:
    """The rows of photos.csv in file order. Rows from before the licence column get `none`."""
    if not manifest.exists():
        return []
    with manifest.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    return [
        {
            "id": r["id"],
            "file": r["file"],
            "origin": r["origin"],
            "licence": r.get("licence") or "none",
            "attribution": r.get("attribution") or "",
        }
        for r in rows
    ]


def write_photos(manifest: Path, rows: list[dict[str, str]]) -> None:
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=PHOTO_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def read_detections(path: Path) -> dict[str, dict]:
    return json.loads(path.read_text()) if path.exists() else {}


def _scraper_sources(folder: Path) -> dict[str, dict[str, str]]:
    """File name → origin, licence and attribution, from a manifest.jsonl of the scraper."""
    for candidate in (folder / "manifest.jsonl", folder.parent / "manifest.jsonl"):
        if candidate.exists():
            sources = {}
            for text in candidate.read_text(encoding="utf-8").splitlines():
                if not text.strip():
                    continue
                entry = json.loads(text)
                if entry.get("file"):
                    sources[entry["file"]] = {
                        "origin": str(entry.get("source", "")).split("/")[0],
                        "licence": entry.get("licence") or "",
                        "attribution": entry.get("attribution") or "",
                    }
            return sources
    return {}


def import_folder(
    folder: Path, paths: PhotoPaths, origin: str | None, licence: str | None
) -> dict[str, int]:
    """Copy each new photo of `folder` (not its subfolders) and store its proposed outline."""
    sources = _scraper_sources(folder)
    rows = read_photos(paths.manifest)
    known = {r["id"] for r in rows}
    detections = read_detections(paths.detections)
    counts = dict.fromkeys(("imported", "already", "unreadable", "no_source"), 0)
    for path in sorted(folder.iterdir()):
        if not path.is_file() or path.suffix.lower() not in PHOTO_SUFFIXES:
            continue
        source = sources.get(path.name) or {
            "origin": origin or "",
            "licence": licence or "",
            "attribution": "",
        }
        if source["origin"] not in ORIGINS or source["licence"] not in LICENCES:
            print(f"skip {path.name}: no known origin and licence", file=sys.stderr)
            counts["no_source"] += 1
            continue
        try:
            photo_id = pixel_id(path)
        except (OSError, ValueError) as error:
            print(f"skip {path.name}: cannot read it ({error})", file=sys.stderr)
            counts["unreadable"] += 1
            continue
        if photo_id in known:
            counts["already"] += 1
            continue
        paths.photos.mkdir(parents=True, exist_ok=True)
        stored = paths.photos / f"{photo_id[:16]}{path.suffix.lower()}"
        shutil.copy2(path, stored)
        rgb = load_upright(stored)
        found = find_grid(rgb)
        detections[photo_id] = {
            "corners": found.corners,
            "lines": found.lines,
            "reason": found.reason,
            "width": int(rgb.shape[1]),
            "height": int(rgb.shape[0]),
        }
        rows.append({"id": photo_id, "file": stored.name, **source})
        known.add(photo_id)
        counts["imported"] += 1
        # Write after each photo: a crash then loses at most the photo in progress.
        write_photos(paths.manifest, rows)
        paths.detections.parent.mkdir(parents=True, exist_ok=True)
        paths.detections.write_text(json.dumps(detections))
    return counts


def main(argv: list[str], ml_root: Path = ML_ROOT) -> int:
    parser = argparse.ArgumentParser(prog="just import-photos")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--origin", choices=ORIGINS)
    parser.add_argument("--licence", choices=LICENCES)
    args = parser.parse_args(argv)
    counts = import_folder(args.folder, PhotoPaths.under(ml_root), args.origin, args.licence)
    print(", ".join(f"{name}: {value}" for name, value in counts.items()))
    print("Next: run just label-cells and open the Photos screen.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

- [ ] **Step 4: Add the `just` recipe**

In `justfile`, add after the `dataset-manifest` recipe:

```just
# Copy a folder of sudoku photos into ml/data/photos/ and find the grid in each. Options: --origin, --licence
import-photos folder *flags:
    uv run --directory ml python -m sudoku_ml.photo_import "$(realpath "{{folder}}")" {{flags}}
```

- [ ] **Step 5: Run the tests**

Run: `uv run --directory ml pytest tests/test_photo_import.py -v && just lint-ml`
Expected: PASS. Also run `just --list` and check that `import-photos` is listed.

- [ ] **Step 6: Commit**

```bash
git add ml/src/sudoku_ml/photo_import.py ml/tests/test_photo_import.py justfile
git commit -m "feat(ml): import a folder of sudoku photos with origin and licence (#70)"
```

---

### Task 4: Check a photo and cut its cells

**Files:**
- Create: `ml/src/sudoku_ml/photo_check.py`
- Test: `ml/tests/test_photo_check.py`

**Interfaces:**
- Consumes: `PhotoPaths`, `read_photos`, `read_detections` (Task 3). `flatten.*` (Task 2). `kind_log.read_records`, `append_records`, `format_time`. `manifest.pixel_id`.
- Produces:
  - `MIN_CELLS = 10`
  - `@dataclass(frozen=True) class PhotoDecision: t: str; session: str; photo: str; decision: str; reason: str; corners: list[list[float]] | None; cells: int`
  - `class PhotoCheck(paths: PhotoPaths, session: str, now: Callable[[], datetime])` with:
    - `pending() -> list[str]`: stems (first 16 characters of the id) of photos with a detection and no decision, in `photos.csv` order
    - `photo(stem: str) -> dict`: `{"id", "stem", "width", "height", "corners", "lines", "reason", "pending"}`. Raises `KeyError` for an unknown stem
    - `next(after: str | None = None) -> dict | None`: the first pending photo after `after`, wrapping around once
    - `display_jpeg(stem: str) -> bytes`: the upright photo, long side at most 1600 px
    - `usable(stem: str, corners) -> int`
    - `preview_png(stem: str, corners) -> bytes`: the 576 × 576 flattened grid, with grid lines and grey cells outside the photo
    - `accept(stem: str, corners) -> dict`: `{"decision": "accepted" | "too-few-cells", "cells": int, "duplicates": int, "new_cells": list[str]}`. `new_cells` holds full cell ids
    - `reject(stem: str, reason: str) -> None`
    - A decided photo raises `ValueError("… already checked")` on `accept` and `reject`

- [ ] **Step 1: Write the failing tests**

Create `ml/tests/test_photo_check.py`:

```python
import csv
import io
from datetime import UTC, datetime
from pathlib import Path

import pytest
from PIL import Image
from photos import grid_photo, save_photo

from sudoku_ml.kind_log import read_records
from sudoku_ml.photo_check import MIN_CELLS, PhotoCheck, PhotoDecision
from sudoku_ml.photo_import import PhotoPaths, import_folder

FULL = [[200, 100], [740, 100], [740, 640], [200, 640]]


def clock() -> datetime:
    return datetime(2026, 10, 12, 9, 0, 0, tzinfo=UTC)


def checked(tmp_path: Path, rgb) -> tuple[PhotoCheck, PhotoPaths, str]:
    save_photo(rgb, tmp_path / "in" / "p.png")
    paths = PhotoPaths.under(tmp_path / "ml")
    import_folder(tmp_path / "in", paths, origin="phone", licence="own")
    check = PhotoCheck(paths, "s1", clock)
    return check, paths, check.pending()[0]


def unlabeled(paths: PhotoPaths) -> list[Path]:
    return sorted((paths.cells / "unlabeled").glob("*.png"))


def test_an_imported_photo_is_pending_with_its_proposed_corners(tmp_path: Path):
    check, _, stem = checked(tmp_path, grid_photo())
    shown = check.next()
    assert shown["stem"] == stem and shown["pending"] == 1
    assert len(shown["corners"]) == 4 and shown["reason"] == "full grid"


def test_accepting_a_full_grid_cuts_81_cells_and_records_them(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    result = check.accept(stem, FULL)
    assert result["decision"] == "accepted"
    assert result["cells"] + result["duplicates"] == 81
    files = unlabeled(paths)
    assert len(files) == result["cells"] == len(result["new_cells"])
    assert all(Image.open(f).size == (64, 64) for f in files)
    with paths.origins.open(newline="") as handle:
        origins = list(csv.DictReader(handle))
    assert len(origins) == result["cells"]
    assert {o["photo"][:16] for o in origins} == {stem}
    assert all(0 <= int(o["row"]) < 9 and 0 <= int(o["col"]) < 9 for o in origins)
    decisions = read_records(paths.checks, PhotoDecision)
    assert [(d.decision, d.cells) for d in decisions] == [("accepted", result["cells"])]
    assert check.pending() == [] and check.next() is None


def test_a_photo_cannot_be_checked_twice(tmp_path: Path):
    check, _, stem = checked(tmp_path, grid_photo())
    check.accept(stem, FULL)
    with pytest.raises(ValueError, match="already checked"):
        check.reject(stem, "rejected")


def test_a_grid_cut_off_by_the_photo_gives_only_the_cells_inside(tmp_path: Path):
    step = 540 / 9
    rgb = grid_photo()[:, : int(200 + 8.5 * step)]
    check, paths, stem = checked(tmp_path, rgb)
    result = check.accept(stem, FULL)
    assert check.usable(stem, FULL) == 72
    assert result["cells"] + result["duplicates"] == 72
    with paths.origins.open(newline="") as handle:
        assert all(row["col"] != "8" for row in csv.DictReader(handle))


def test_too_few_cells_inside_the_photo_cuts_nothing(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    far = [[900, 700], [1500, 700], [1500, 1300], [900, 1300]]
    assert check.usable(stem, far) < MIN_CELLS
    assert check.accept(stem, far)["decision"] == "too-few-cells"
    assert unlabeled(paths) == []


def test_a_rejected_photo_cuts_nothing_and_leaves_the_queue(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    check.reject(stem, "rejected")
    assert unlabeled(paths) == [] and check.pending() == []
    assert read_records(paths.checks, PhotoDecision)[0].decision == "rejected"


def test_cells_that_already_exist_are_duplicates(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    first = check.accept(stem, FULL)
    # One changed pixel far from the grid: a new photo id, but the same cells.
    other = grid_photo().copy()
    other[0, 0] = (0, 0, 0)
    save_photo(other, tmp_path / "in2" / "other.png")
    import_folder(tmp_path / "in2", paths, origin="phone", licence="own")
    second = check.accept(check.pending()[0], FULL)
    assert second["cells"] == 0 and second["duplicates"] == 81
    assert len(unlabeled(paths)) == first["cells"]


def test_the_preview_is_a_576_png_and_the_display_photo_a_jpeg(tmp_path: Path):
    check, _, stem = checked(tmp_path, grid_photo())
    assert Image.open(io.BytesIO(check.preview_png(stem, FULL))).size == (576, 576)
    assert check.display_jpeg(stem)[:2] == b"\xff\xd8"


def test_an_unknown_photo_is_a_key_error(tmp_path: Path):
    check, _, _ = checked(tmp_path, grid_photo())
    with pytest.raises(KeyError):
        check.photo("0000000000000000")
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `uv run --directory ml pytest tests/test_photo_check.py -v`
Expected: FAIL with `No module named 'sudoku_ml.photo_check'`.

- [ ] **Step 3: Implement `photo_check.py`**

Create `ml/src/sudoku_ml/photo_check.py`:

```python
"""State and rules of the Photos screen: one decision per imported photo, and the cut of the
cells of an accepted photo into cells/unlabeled/ (ADR-009, amendment of 2026-10-12)."""

import csv
import io
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

import numpy as np
from PIL import Image

from sudoku_ml.contract import CELL_SIZE
from sudoku_ml.flatten import (
    GRID_CELLS,
    check_corners,
    load_upright,
    slice_cells,
    usable_cells,
    warp_grid,
)
from sudoku_ml.kind_log import append_records, format_time, read_records
from sudoku_ml.manifest import pixel_id
from sudoku_ml.photo_import import PhotoPaths, read_detections, read_photos

MIN_CELLS = 10  # fewer usable cells are not worth the labelling time
DISPLAY_SIZE = 1600
ORIGIN_FIELDS = ["cell", "photo", "row", "col"]


@dataclass(frozen=True)
class PhotoDecision:
    t: str
    session: str
    photo: str  # full photo id
    decision: str  # "accepted", "rejected" or "too-few-cells"
    reason: str
    corners: list[list[float]] | None
    cells: int  # cells cut


class PhotoCheck:
    def __init__(self, paths: PhotoPaths, session: str, now: Callable[[], datetime]):
        self.paths, self.session, self._now = paths, session, now
        self._upright: tuple[str, np.ndarray] | None = None

    def _rows(self) -> dict[str, dict[str, str]]:
        return {r["id"][:16]: r for r in read_photos(self.paths.manifest)}

    def _decided(self) -> set[str]:
        return {d.photo for d in read_records(self.paths.checks, PhotoDecision)}

    def pending(self) -> list[str]:
        detections, decided = read_detections(self.paths.detections), self._decided()
        return [
            stem
            for stem, row in self._rows().items()
            if row["id"] in detections and row["id"] not in decided
        ]

    def photo(self, stem: str) -> dict:
        row = self._rows()[stem]
        found = read_detections(self.paths.detections)[row["id"]]
        return {
            "id": row["id"],
            "stem": stem,
            "width": found["width"],
            "height": found["height"],
            "corners": found["corners"],
            "lines": found["lines"],
            "reason": found["reason"],
            "pending": len(self.pending()),
        }

    def next(self, after: str | None = None) -> dict | None:
        order = self.pending()
        if not order:
            return None
        start = order.index(after) + 1 if after in order else 0
        return self.photo((order[start:] + order[:start])[0])

    def _image(self, stem: str) -> np.ndarray:
        # The Photos screen asks for the same photo several times. Decoding a 12 MP photo is slow.
        if self._upright is None or self._upright[0] != stem:
            self._upright = (stem, load_upright(self.paths.photos / self._rows()[stem]["file"]))
        return self._upright[1]

    def display_jpeg(self, stem: str) -> bytes:
        image = Image.fromarray(self._image(stem))
        image.thumbnail((DISPLAY_SIZE, DISPLAY_SIZE))
        out = io.BytesIO()
        image.save(out, "JPEG", quality=85)
        return out.getvalue()

    def _usable(self, stem: str, corners) -> tuple[list[list[float]], list[bool]]:
        checked = check_corners(corners)
        height, width = self._image(stem).shape[:2]
        return checked, usable_cells(checked, width, height)

    def usable(self, stem: str, corners) -> int:
        return sum(self._usable(stem, corners)[1])

    def preview_png(self, stem: str, corners) -> bytes:
        checked, usable = self._usable(stem, corners)
        flat = warp_grid(self._image(stem), checked).astype(np.float32)
        for n, ok in enumerate(usable):
            if not ok:
                r, c = divmod(n, GRID_CELLS)
                rows = slice(r * CELL_SIZE, (r + 1) * CELL_SIZE)
                cols = slice(c * CELL_SIZE, (c + 1) * CELL_SIZE)
                flat[rows, cols] = flat[rows, cols] * 0.3 + 128 * 0.7
        for k in range(GRID_CELLS + 1):
            at = min(k * CELL_SIZE, flat.shape[0] - 1)
            thick = 2 if k % 3 == 0 else 1
            flat[max(0, at - thick + 1) : at + 1, :] = (255, 0, 0)
            flat[:, max(0, at - thick + 1) : at + 1] = (255, 0, 0)
        out = io.BytesIO()
        Image.fromarray(flat.astype(np.uint8)).save(out, "PNG")
        return out.getvalue()

    def _open(self, stem: str) -> dict[str, str]:
        row = self._rows()[stem]
        if row["id"] in self._decided():
            raise ValueError(f"{stem}: already checked")
        return row

    def _decide(self, photo_id, decision, reason, corners, cells) -> None:
        line = PhotoDecision(
            format_time(self._now()), self.session, photo_id, decision, reason, corners, cells
        )
        append_records(self.paths.checks, [line])

    def reject(self, stem: str, reason: str) -> None:
        row = self._open(stem)
        self._decide(row["id"], "rejected", reason, None, 0)

    def accept(self, stem: str, corners) -> dict:
        row = self._open(stem)
        checked, usable = self._usable(stem, corners)
        rounded = [[round(x, 1), round(y, 1)] for x, y in checked]
        if sum(usable) < MIN_CELLS:
            self._decide(row["id"], "too-few-cells", f"{sum(usable)} usable cells", rounded, 0)
            return {"decision": "too-few-cells", "cells": 0, "duplicates": 0, "new_cells": []}
        target = self.paths.cells / "unlabeled"
        target.mkdir(parents=True, exist_ok=True)
        existing = {p.stem for p in self.paths.cells.glob("*/*.png")}
        new_cells, origins, duplicates = [], [], 0
        cells = slice_cells(warp_grid(self._image(stem), checked))
        for n, (cell, ok) in enumerate(zip(cells, usable, strict=True)):
            if not ok:
                continue
            tmp = target / "tmp-cut.png"
            Image.fromarray(cell).save(tmp)
            cell_id = pixel_id(tmp)
            if cell_id[:16] in existing:
                tmp.unlink()
                duplicates += 1
                continue
            tmp.rename(target / f"{cell_id[:16]}.png")
            existing.add(cell_id[:16])
            new_cells.append(cell_id)
            r, c = divmod(n, GRID_CELLS)
            origins.append({"cell": cell_id, "photo": row["id"], "row": r, "col": c})
        new_file = not self.paths.origins.exists()
        self.paths.origins.parent.mkdir(parents=True, exist_ok=True)
        with self.paths.origins.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=ORIGIN_FIELDS)
            if new_file:
                writer.writeheader()
            writer.writerows(origins)
        self._decide(row["id"], "accepted", "", rounded, len(new_cells))
        return {
            "decision": "accepted",
            "cells": len(new_cells),
            "duplicates": duplicates,
            "new_cells": new_cells,
        }
```

- [ ] **Step 4: Run the tests**

Run: `uv run --directory ml pytest tests/test_photo_check.py -v && just lint-ml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ml/src/sudoku_ml/photo_check.py ml/tests/test_photo_check.py
git commit -m "feat(ml): check each imported photo and cut its usable cells (#70)"
```

---

### Task 5: Pre-label the unlabelled cells

**Files:**
- Create: `ml/src/sudoku_ml/prelabel.py`
- Modify: `justfile` (add `prelabel-cells`; `label-cells` runs it)
- Test: `ml/tests/test_prelabel.py`

**Interfaces:**
- Consumes: `model.CellClassifier`, `preprocess.preprocess_cell`, `preprocess.to_cell_image`, `manifest.pixel_id`, `grouping.default_run`, `contract.DIGIT_CLASSES`, `contract.KIND_CLASSES`.
- Produces:
  - `write_prelabels(cells_dir: Path, run: Path, out: Path) -> int`: the number of cells it newly pre-labelled
  - `prelabels.json` shape: `{"run": "<run folder name>", "cells": {"<full cell id>": {"digit": "2", "p": 0.9312, "kind": "handwritten"}}}`. `digit` is in `DIGIT_CLASSES`, `kind` in `KIND_CLASSES`, and `p` is the digit probability after the run's temperature
  - CLI: `python -m sudoku_ml.prelabel [run]`. The run path is relative to `ml/`, and the default is the app's run

- [ ] **Step 1: Write the failing tests**

Create `ml/tests/test_prelabel.py`:

```python
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.manifest import pixel_id
from sudoku_ml.model import CellClassifier
from sudoku_ml.prelabel import main, write_prelabels


def make_run(root: Path) -> Path:
    run = root / "artifacts" / "20261012-000000-test"
    run.mkdir(parents=True)
    torch.manual_seed(0)
    torch.save(CellClassifier().state_dict(), run / "model.pt")
    (run / "metrics.json").write_text(json.dumps({"temperature": 0.5}))
    return run


def add_unlabeled(cells: Path, seed: int) -> str:
    folder = cells / "unlabeled"
    folder.mkdir(parents=True, exist_ok=True)
    image = np.random.default_rng(seed).integers(0, 256, (64, 64, 3), dtype=np.uint8)
    tmp = folder / "tmp.png"
    Image.fromarray(image).save(tmp)
    cell_id = pixel_id(tmp)
    tmp.rename(folder / f"{cell_id[:16]}.png")
    return cell_id


def test_each_unlabeled_cell_gets_a_digit_a_probability_and_a_kind(tmp_path: Path):
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "prelabels.json"
    ids = [add_unlabeled(cells, s) for s in range(3)]
    assert write_prelabels(cells, make_run(tmp_path), out) == 3
    value = json.loads(out.read_text())
    assert value["run"] == "20261012-000000-test" and set(value["cells"]) == set(ids)
    for entry in value["cells"].values():
        assert entry["digit"] in DIGIT_CLASSES and entry["kind"] in KIND_CLASSES
        assert 0 < entry["p"] <= 1


def test_only_new_cells_are_computed_and_gone_cells_are_dropped(tmp_path: Path):
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "prelabels.json"
    run = make_run(tmp_path)
    first = add_unlabeled(cells, 1)
    gone = add_unlabeled(cells, 2)
    write_prelabels(cells, run, out)
    (cells / "unlabeled" / f"{gone[:16]}.png").unlink()
    newer = add_unlabeled(cells, 3)
    assert write_prelabels(cells, run, out) == 1
    assert set(json.loads(out.read_text())["cells"]) == {first, newer}


def test_without_a_model_run_the_command_warns_and_succeeds(tmp_path: Path, capsys):
    assert main(["prelabel", "artifacts/missing"], tmp_path) == 0
    assert "No model" in capsys.readouterr().err
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `uv run --directory ml pytest tests/test_prelabel.py -v`
Expected: FAIL with `No module named 'sudoku_ml.prelabel'`.

- [ ] **Step 3: Implement `prelabel.py`**

Create `ml/src/sudoku_ml/prelabel.py`:

```python
"""The model's digit and kind for each cell in cells/unlabeled/, for the Digits screen. Writes
ml/data/prelabels.json. A pre-label is a proposal: only a person's confirmation is a label."""

import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.grouping import default_run
from sudoku_ml.manifest import pixel_id
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import preprocess_cell, to_cell_image

BATCH = 1024


def _predict(run: Path, paths: list[Path]) -> list[dict]:
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt", map_location="cpu"))
    model.eval()
    temperature = json.loads((run / "metrics.json").read_text())["temperature"]
    inputs = np.stack(
        [preprocess_cell(to_cell_image(np.asarray(Image.open(p).convert("RGB")))) for p in paths]
    )
    results = []
    with torch.no_grad():
        for start in range(0, len(inputs), BATCH):
            x = torch.from_numpy(inputs[start : start + BATCH])[:, None]
            digit_logits, kind_logits = model(x)
            digit = (digit_logits / temperature).softmax(1)
            kind = kind_logits.softmax(1)
            for d, k in zip(digit, kind, strict=True):
                results.append(
                    {
                        "digit": DIGIT_CLASSES[int(d.argmax())],
                        "p": round(float(d.max()), 4),
                        "kind": KIND_CLASSES[int(k.argmax())],
                    }
                )
    return results


def write_prelabels(cells_dir: Path, run: Path, out: Path) -> int:
    """Pre-label the cells in unlabeled/ that have no pre-label of this run yet. Drop the
    pre-labels of cells that left unlabeled/. Returns the number of new pre-labels."""
    stored = json.loads(out.read_text()) if out.exists() else {}
    known = stored.get("cells", {}) if stored.get("run") == run.name else {}
    paths = sorted((cells_dir / "unlabeled").glob("*.png"))
    ids = {p: pixel_id(p) for p in paths}
    cells = {ids[p]: known[ids[p]] for p in paths if ids[p] in known}
    todo = [p for p in paths if ids[p] not in cells]
    if todo:
        for path, entry in zip(todo, _predict(run, todo), strict=True):
            cells[ids[path]] = entry
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"run": run.name, "cells": cells}))
    return len(todo)


def main(argv: list[str], ml_root: Path = Path(__file__).parents[2]) -> int:
    try:
        run = ml_root / argv[1] if len(argv) > 1 and argv[1] else default_run(ml_root)
    except FileNotFoundError:
        run = None
    if run is None or not (run / "model.pt").exists():
        print(
            "No model run found, so no pre-labels. The Digits screen stays empty. "
            "Install a model with just install-model, or pass a run: just prelabel-cells <run>",
            file=sys.stderr,
        )
        return 0
    cells, out = ml_root / "data" / "cells", ml_root / "data" / "prelabels.json"
    print(f"Pre-labelled {write_prelabels(cells, run, out)} new cells with {run.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 4: Add the `just` recipes**

In `justfile`, add after `group-cells`:

```just
# Pre-label the cells in ml/data/cells/unlabeled/ for the Digits screen. The run path is relative to ml/
prelabel-cells run="":
    uv run --directory ml python -m sudoku_ml.prelabel {{run}}
```

Change `label-cells` to:

```just
# Open the labelling page on 127.0.0.1. The manifest is rewritten before the start and at Ctrl-C
label-cells:
    just dataset-manifest
    just prelabel-cells
    uv run --directory ml python -m sudoku_ml.label_server
```

- [ ] **Step 5: Run the tests**

Run: `uv run --directory ml pytest tests/test_prelabel.py -v && just lint-ml`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ml/src/sudoku_ml/prelabel.py ml/tests/test_prelabel.py justfile
git commit -m "feat(ml): pre-label unlabelled cells with the app's model (#70)"
```

---

### Task 6: Digit screen and assign in the label store

**Files:**
- Modify: `ml/src/sudoku_ml/label_store.py`
- Test: `ml/tests/test_label_store_digits.py` (new file; it reuses `build` and `Clock` from `test_label_store.py`)

**Interfaces:**
- Consumes: `prelabels.json` shape (Task 5). `manifest.LABELS` with `discarded` (Task 1).
- Produces on `LabelStore`:
  - `Paths` gets a last field `prelabels: Path | None = None`. `Paths.under` sets it to `ml_root / "data" / "prelabels.json"`
  - `DIGIT_SCREEN_SIZE = 100`, `ASSIGNABLE = (*DIGIT_CLASSES, "discarded")`, `DIGIT_KINDS = ("handwritten", "all")`
  - `digit_screen(digit: str, kinds: str = "handwritten") -> dict`: `{"digit", "kinds", "cells": [{"id", "stem", "p"}], "left": int, "counts": {digit class: int}, "not_prelabelled": int}`
  - `assign(entries: list[dict], screen: str) -> int`: each entry is `{"id": full id, "digit": one of ASSIGNABLE}`. The cell must be in `unlabeled/`. All entries are validated before any file moves. Returns the number of lines
  - `register(cell_ids: list[str]) -> None`: makes new cells in `unlabeled/` known without a manifest rewrite
  - `_apply_digits` moves all files of one batch with one `move_cells` call

- [ ] **Step 1: Write the failing tests**

Create `ml/tests/test_label_store_digits.py`:

```python
import json
from dataclasses import replace
from pathlib import Path

import pytest
from PIL import Image
from test_label_store import Clock, add_cell, build, pattern

from sudoku_ml.kind_log import read_log
from sudoku_ml.label_store import LabelStore


def with_prelabels(tmp_path: Path, entries: dict[int, tuple[str, float, str]]):
    """Four unlabelled cells. entries: cell index → (digit, p, kind)."""
    paths, ids = build(tmp_path, {"unlabeled": 4, "3": 1}, {})
    paths = replace(paths, prelabels=tmp_path / "data" / "prelabels.json")
    cells = {
        ids["unlabeled"][i]: {"digit": d, "p": p, "kind": k} for i, (d, p, k) in entries.items()
    }
    paths.prelabels.write_text(json.dumps({"run": "test", "cells": cells}))
    return LabelStore(paths, Clock()), paths, ids["unlabeled"], ids["3"][0]


ENTRIES = {
    0: ("2", 0.9, "handwritten"),
    1: ("2", 0.5, "handwritten"),
    2: ("2", 0.7, "printed"),
    3: ("9", 0.8, "handwritten"),
}


def test_a_digit_screen_shows_handwritten_cells_least_sure_first(tmp_path: Path):
    store, _, u, _ = with_prelabels(tmp_path, ENTRIES)
    screen = store.digit_screen("2")
    assert [c["id"] for c in screen["cells"]] == [u[1], u[0]]
    assert screen["left"] == 2 and screen["counts"]["2"] == 2 and screen["counts"]["9"] == 1
    assert screen["cells"][0] == {"id": u[1], "stem": u[1][:16], "p": 0.5}


def test_all_kinds_also_shows_the_printed_cells(tmp_path: Path):
    store, _, u, _ = with_prelabels(tmp_path, ENTRIES)
    assert [c["id"] for c in store.digit_screen("2", "all")["cells"]] == [u[1], u[2], u[0]]


def test_a_cell_without_a_prelabel_is_counted_not_shown(tmp_path: Path):
    store, _, _, _ = with_prelabels(tmp_path, {0: ("2", 0.9, "handwritten")})
    screen = store.digit_screen("2")
    assert len(screen["cells"]) == 1 and screen["not_prelabelled"] == 3


def test_assign_moves_the_cells_and_logs_digit_lines(tmp_path: Path):
    store, paths, u, _ = with_prelabels(tmp_path, ENTRIES)
    entries = [
        {"id": u[0], "digit": "2"},
        {"id": u[1], "digit": "9"},
        {"id": u[3], "digit": "discarded"},
    ]
    assert store.assign(entries, "digits") == 3
    assert (paths.cells / "2" / f"{u[0][:16]}.png").exists()
    assert (paths.cells / "9" / f"{u[1][:16]}.png").exists()
    assert (paths.cells / "discarded" / f"{u[3][:16]}.png").exists()
    lines = read_log(paths.log)
    assert {(x.old, x.new, x.screen, x.field) for x in lines} == {
        ("unlabeled", "2", "digits", "digit"),
        ("unlabeled", "9", "digits", "digit"),
        ("unlabeled", "discarded", "digits", "digit"),
    }
    assert len({x.action for x in lines}) == 1
    assert store.digit_screen("2")["left"] == 0


def test_undo_puts_a_digit_screen_back(tmp_path: Path):
    store, paths, u, _ = with_prelabels(tmp_path, ENTRIES)
    store.assign([{"id": u[0], "digit": "2"}, {"id": u[1], "digit": "2"}], "digits")
    assert store.undo() == 2
    assert {p.stem for p in (paths.cells / "unlabeled").glob("*.png")} == {c[:16] for c in u}
    assert [c["id"] for c in store.digit_screen("2")["cells"]] == [u[1], u[0]]


@pytest.mark.parametrize("label", ["notes", "unlabeled", ""])
def test_an_unknown_label_moves_nothing(tmp_path: Path, label: str):
    store, paths, u, _ = with_prelabels(tmp_path, ENTRIES)
    with pytest.raises(ValueError):
        store.assign([{"id": u[0], "digit": "2"}, {"id": u[1], "digit": label}], "digits")
    assert len(list((paths.cells / "unlabeled").glob("*.png"))) == 4
    assert read_log(paths.log) == []


def test_a_cell_outside_unlabeled_cannot_be_assigned(tmp_path: Path):
    store, _, _, labelled = with_prelabels(tmp_path, ENTRIES)
    with pytest.raises(ValueError, match="not in unlabeled"):
        store.assign([{"id": labelled, "digit": "5"}], "digits")


def test_a_registered_cell_is_served_without_a_manifest_rewrite(tmp_path: Path):
    store, paths, _, _ = with_prelabels(tmp_path, ENTRIES)
    new_id = add_cell(paths.cells, "unlabeled", pattern(99))
    store.register([new_id])
    assert store.cell_file(new_id[:16]).exists()
    assert Image.open(store.cell_file(new_id[:16])).size == (64, 64)
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `uv run --directory ml pytest tests/test_label_store_digits.py -v`
Expected: FAIL. `replace(paths, prelabels=…)` raises `TypeError` because `Paths` has no `prelabels` field.

- [ ] **Step 3: Implement**

In `ml/src/sudoku_ml/label_store.py`:

1. Add constants under `SCREEN_SIZE`:

```python
DIGIT_SCREEN_SIZE = 100
ASSIGNABLE = (*DIGIT_CLASSES, "discarded")
DIGIT_KINDS = ("handwritten", "all")
```

2. Add the last field to `Paths`, after `config`:

```python
    prelabels: Path | None = None  # ml/data/prelabels.json: the Digits screen's proposals
```

In `Paths.under`, pass it as the last argument: `data / "prelabels.json",`.

3. In `__init__`, before `self._load()`, add `self._registered: dict[str, str] = {}`. In `_load`, replace the first lines so that registered cells count as known:

```python
    def _load(self) -> None:
        self._stem_ids = {**read_ids(self.paths.manifest), **self._registered}
        self.folder: dict[str, str] = {}
        for path in self.paths.cells.glob("*/*.png"):
```

Keep the rest of `_load` unchanged. In `__init__`, delete the line `self._stem_ids = read_ids(paths.manifest)`, because `_load` sets it now.

4. Replace `_apply_digits` with a batched version:

```python
    def _apply_digits(self, lines: list[Line]) -> None:
        # One move_cells call: it reads every cell folder once, and 16k cells make that slow.
        wanted = {
            line.cell[:16]: line.new
            for line in lines
            if line.field == "digit" and line.old != line.new
        }
        if wanted:
            move_cells(self.paths.cells, wanted)
        for line in lines:
            if line.field == "digit" and line.old != line.new:
                self.folder[line.cell] = line.new
```

5. Add a new section after `undo`/`rollback`:

```python
    # Digits screen

    def register(self, cell_ids: list[str]) -> None:
        """Make new cells in unlabeled/ known. Ctrl-C rewrites cells.csv with them later."""
        for cell in cell_ids:
            self._registered[cell[:16]] = cell
            self._stem_ids[cell[:16]] = cell
            self.folder[cell] = "unlabeled"

    def _prelabels(self) -> dict[str, dict]:
        if self.paths.prelabels is None or not self.paths.prelabels.exists():
            return {}
        return json.loads(self.paths.prelabels.read_text())["cells"]

    def digit_screen(self, digit: str, kinds: str = "handwritten") -> dict:
        self._refresh()
        if digit not in DIGIT_CLASSES:
            raise ValueError(f"unknown digit {digit!r}")
        if kinds not in DIGIT_KINDS:
            raise ValueError(f"unknown kinds filter {kinds!r}")
        pre = self._prelabels()
        waiting = [c for c, f in self.folder.items() if f == "unlabeled"]

        def shown(cell: str) -> bool:
            return cell in pre and (kinds == "all" or pre[cell]["kind"] == "handwritten")

        counts = Counter(pre[c]["digit"] for c in waiting if shown(c))
        members = sorted(
            (c for c in waiting if shown(c) and pre[c]["digit"] == digit),
            key=lambda c: (pre[c]["p"], c),
        )
        return {
            "digit": digit,
            "kinds": kinds,
            "cells": [
                {"id": c, "stem": c[:16], "p": pre[c]["p"]} for c in members[:DIGIT_SCREEN_SIZE]
            ],
            "left": len(members),
            "counts": {d: counts[d] for d in DIGIT_CLASSES},
            "not_prelabelled": sum(c not in pre for c in waiting),
        }

    def assign(self, entries: list[dict], screen: str) -> int:
        """Move unlabelled cells to the chosen folders as one action. Checks all entries first."""
        self._refresh()
        t, action = self._t(), self._action()
        lines = []
        for entry in entries:
            cell, label = entry["id"], entry["digit"]
            if label not in ASSIGNABLE:
                raise ValueError(f"{cell[:16]}: unknown label {label!r}")
            if self.folder.get(cell) != "unlabeled":
                raise ValueError(f"{cell[:16]}: not in unlabeled")
            lines.append(Line(t, self.session, action, cell, "digit", "unlabeled", label, screen))
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)
```

`_action()` raises the action counter even when validation fails. That is harmless: action ids only need to be unique.

- [ ] **Step 4: Run all label tests**

Run: `uv run --directory ml pytest tests/test_label_store_digits.py tests/test_label_store.py tests/test_label_server.py -v && just lint-ml`
Expected: PASS. The old tests must still pass without changes, because `prelabels` has a default.

- [ ] **Step 5: Commit**

```bash
git add ml/src/sudoku_ml/label_store.py ml/tests/test_label_store_digits.py
git commit -m "feat(ml): digit screen, assign and register in the label store (#70)"
```

---

### Task 7: Server routes for Photos and Digits

**Files:**
- Modify: `ml/src/sudoku_ml/label_server.py`
- Modify: `ml/tests/test_label_server.py`

**Interfaces:**
- Consumes: `PhotoCheck` (Task 4), `PhotoPaths` (Task 3), and `LabelStore.digit_screen`, `assign`, `register` (Task 6).
- Produces:
  - `make_server(store, check: PhotoCheck | None = None, host="127.0.0.1", port=8765)`
  - `GET /api/digits?digit=<d>&kinds=<handwritten|all>` returns the `digit_screen` dict
  - `POST /api/assign` with `{"cells": [{"id", "digit"}], "screen": "digits"}` returns `{"result": n}`
  - `GET /api/photos/next[?after=<stem>]` returns the `photo` dict or `null`
  - `GET /api/photos/usable?photo=<stem>&c=<8 numbers, comma-separated>` returns `{"usable": n}`
  - `GET /photo/<stem>.jpg` returns the JPEG, or 404
  - `GET /flat/<stem>.png?c=<8 numbers>` returns the PNG, or 404 for an unknown photo, or 400 for bad corners
  - `POST /api/photos/accept` with `{"photo": stem, "corners": [[x, y] × 4]}` returns `{"result": accept dict}`, after `store.register(new_cells)`
  - `POST /api/photos/reject` with `{"photo": stem, "reason": text}` returns `{"result": null}`
  - Without `check`, the photo routes answer 404 `{"error": "no photo check"}`
  - `main` no longer needs `groups.json`

- [ ] **Step 1: Write the failing tests**

In `ml/tests/test_label_server.py`:

1. Change the lambda in `test_stopping_the_server_with_ctrl_c_rewrites_the_manifest` to accept the new argument: `lambda store, check=None: Interrupted()`.
2. Add these imports at the top:

```python
from dataclasses import replace
from datetime import UTC, datetime

from photos import grid_photo, save_photo

from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.photo_import import PhotoPaths, import_folder
```

3. Append these tests:

```python
FULL = [[200, 100], [740, 100], [740, 640], [200, 640]]


@pytest.fixture
def served_photos(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1, "unlabeled": 2}, {"7": [[0]]})
    paths = replace(paths, prelabels=tmp_path / "data" / "prelabels.json")
    u = ids["unlabeled"]
    prelabels = {
        u[0]: {"digit": "2", "p": 0.6, "kind": "handwritten"},
        u[1]: {"digit": "2", "p": 0.9, "kind": "handwritten"},
    }
    paths.prelabels.write_text(json.dumps({"run": "test", "cells": prelabels}))
    save_photo(grid_photo(), tmp_path / "in" / "p.png")
    photo_paths = PhotoPaths.under(tmp_path)
    import_folder(tmp_path / "in", photo_paths, origin="phone", licence="own")
    store = LabelStore(paths, Clock())
    moment = datetime(2026, 10, 12, tzinfo=UTC)
    check = PhotoCheck(photo_paths, store.session, lambda: moment)
    server = make_server(store, check, port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_port, paths, u, check.pending()[0]
    server.shutdown()
    server.server_close()


def corner_query() -> str:
    return ",".join(str(v) for point in FULL for v in point)


def test_the_digit_screen_and_assign_round_trip(served_photos):
    port, paths, u, _ = served_photos
    status, data = request(port, "GET", "/api/digits?digit=2&kinds=handwritten")
    assert status == 200 and [c["id"] for c in json.loads(data)["cells"]] == [u[0], u[1]]
    body = {"screen": "digits", "cells": [{"id": u[0], "digit": "2"}]}
    status, data = request(port, "POST", "/api/assign", body)
    assert status == 200 and json.loads(data) == {"result": 1}
    assert (paths.cells / "2" / f"{u[0][:16]}.png").exists()


def test_the_photo_routes_serve_the_photo_and_the_preview(served_photos):
    port, _, _, stem = served_photos
    status, data = request(port, "GET", "/api/photos/next")
    assert status == 200 and json.loads(data)["stem"] == stem
    status, data = request(port, "GET", f"/photo/{stem}.jpg")
    assert status == 200 and data[:2] == b"\xff\xd8"
    status, data = request(port, "GET", f"/flat/{stem}.png?c={corner_query()}")
    assert status == 200 and data[:4] == b"\x89PNG"
    status, data = request(port, "GET", f"/api/photos/usable?photo={stem}&c={corner_query()}")
    assert json.loads(data) == {"usable": 81}
    status, _ = request(port, "GET", "/photo/0000000000000000.jpg")
    assert status == 404
    status, _ = request(port, "GET", f"/flat/{stem}.png?c=1,2,3")
    assert status == 400


def test_an_accepted_photo_serves_its_new_cells(served_photos):
    port, _, _, stem = served_photos
    status, data = request(port, "POST", "/api/photos/accept", {"photo": stem, "corners": FULL})
    result = json.loads(data)["result"]
    assert status == 200 and result["cells"] > 0
    new = result["new_cells"][0]
    status, data = request(port, "GET", f"/cell/{new[:16]}.png")
    assert status == 200 and data[:4] == b"\x89PNG"
    status, data = request(port, "GET", "/api/photos/next")
    assert json.loads(data) is None


def test_a_rejected_photo_leaves_the_queue(served_photos):
    port, _, _, stem = served_photos
    status, _ = request(port, "POST", "/api/photos/reject", {"photo": stem, "reason": "rejected"})
    assert status == 200
    assert json.loads(request(port, "GET", "/api/photos/next")[1]) is None


def test_the_server_starts_without_groups(tmp_path, monkeypatch):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    paths.groups.unlink()

    class Interrupted:
        server_port = 0

        def serve_forever(self):
            raise KeyboardInterrupt

        def server_close(self):
            pass

    monkeypatch.setattr(
        "sudoku_ml.label_server.make_server", lambda store, check=None: Interrupted()
    )
    monkeypatch.setattr("sudoku_ml.label_server.webbrowser.open", lambda url: None)
    assert main(["label_server"], tmp_path) == 0
```

`test_label_server.py` already imports `json`, `threading`, `Path`, `pytest`, `build`, `Clock`, `LabelStore`, `main`, `make_server` and `request`. Keep those imports. Note: `build` puts `data/` and `datasets/` under `tmp_path`, so `PhotoPaths.under(tmp_path)` and `Paths` share the same `data/cells`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `uv run --directory ml pytest tests/test_label_server.py -v`
Expected: the new tests FAIL (404 on `/api/digits`; `make_server` takes no `check`; `main` returns 1 without groups).

- [ ] **Step 3: Implement**

In `ml/src/sudoku_ml/label_server.py`:

1. Imports: add `from datetime import UTC, datetime`, `from sudoku_ml.photo_check import PhotoCheck` and `from sudoku_ml.photo_import import PhotoPaths`.

2. Add a module function under `ML_ROOT`:

```python
def parse_corners(text: str) -> list[list[float]]:
    """`x,y,x,y,x,y,x,y` → 4 [x, y] pairs. Raises ValueError."""
    values = [float(v) for v in text.split(",")]
    if len(values) != 8:
        raise ValueError("c needs 8 numbers: x,y of the 4 corners")
    return [values[i : i + 2] for i in range(0, 8, 2)]
```

3. Change the signature: `def make_server(store: LabelStore, check: PhotoCheck | None = None, host: str = "127.0.0.1", port: int = 8765) -> HTTPServer:`. Format it over several lines to stay within 100 characters.

4. In `do_GET`, inside the `try`, add these branches before the final `else`:

```python
                elif url.path == "/api/digits":
                    self._json(store.digit_screen(q["digit"], q.get("kinds", "handwritten")))
                elif url.path.startswith(("/api/photos/", "/photo/", "/flat/")) and check is None:
                    self._json({"error": "no photo check"}, 404)
                elif url.path == "/api/photos/next":
                    self._json(check.next(q.get("after")))
                elif url.path == "/api/photos/usable":
                    self._json({"usable": check.usable(q["photo"], parse_corners(q["c"]))})
                elif url.path.startswith("/photo/"):
                    stem = url.path.removeprefix("/photo/").removesuffix(".jpg")
                    try:
                        body = check.display_jpeg(stem)
                    except KeyError:
                        self._json({"error": "no such photo"}, 404)
                        return
                    self._send(200, body, "image/jpeg")
                elif url.path.startswith("/flat/"):
                    stem = url.path.removeprefix("/flat/").removesuffix(".png")
                    try:
                        check.photo(stem)
                    except KeyError:
                        self._json({"error": "no such photo"}, 404)
                        return
                    self._send(200, check.preview_png(stem, parse_corners(q["c"])), "image/png")
```

5. In `do_POST`, extend `routes`:

```python
                "/api/assign": lambda b: store.assign(b["cells"], b["screen"]),
                "/api/photos/accept": lambda b: accept(b["photo"], b["corners"]),
                "/api/photos/reject": lambda b: reject(b["photo"], b["reason"]),
```

Define these two helpers inside `make_server`, before `class Handler`:

```python
    def accept(stem: str, corners) -> dict:
        if check is None:
            raise ValueError("no photo check")
        result = check.accept(stem, corners)
        store.register(result["new_cells"])
        return result

    def reject(stem: str, reason: str) -> None:
        if check is None:
            raise ValueError("no photo check")
        check.reject(stem, reason)
```

The POST `except` already turns `KeyError` and `ValueError` into a 400.

6. In `main`, delete the `if not paths.groups.exists(): … return 1` block. After `store = LabelStore(paths)`, add:

```python
    check = PhotoCheck(PhotoPaths.under(ml_root), store.session, lambda: datetime.now(UTC))
```

Then call `server = make_server(store, check=check)`.

- [ ] **Step 4: Run the tests**

Run: `uv run --directory ml pytest tests/test_label_server.py -v && just test-ml && just lint-ml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ml/src/sudoku_ml/label_server.py ml/tests/test_label_server.py
git commit -m "feat(ml): serve the Photos and Digits screens (#70)"
```

---

### Task 8: The Photos and Digits screens on the page

**Files:**
- Modify: `ml/src/sudoku_ml/label_page.html`
- Modify: `ml/tests/test_label_server.py` (page text test)

**Interfaces:**
- Consumes: the routes of Task 7.
- Produces: two new nav modes, `photos` and `digits`. The existing modes do not change.

- [ ] **Step 1: Write the failing page test**

Append to `ml/tests/test_label_server.py`:

```python
def test_the_page_explains_the_photos_and_digits_screens(served):
    port, _, _ = served
    page = request(port, "GET", "/")[1].decode()
    for text in (
        'data-mode="photos"',
        'data-mode="digits"',
        "Click the 4 corners: top left, top right, bottom right, bottom left.",
        "Click each cell that is not this digit.",
        "Press <b>X</b> to discard the pointed-at cell",
        "Stop the server with Ctrl-C and run <code>just label-cells</code> again.",
    ):
        assert text in page
```

- [ ] **Step 2: Run the test to see it fail**

Run: `uv run --directory ml pytest tests/test_label_server.py::test_the_page_explains_the_photos_and_digits_screens -v`
Expected: FAIL.

- [ ] **Step 3: Add the markup and the styles**

In `<style>`, add before `</style>`:

```css
  .photo-row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  .wrap { position: relative; padding: 120px; background: #444; cursor: crosshair; }
  .wrap img { display: block; max-width: 640px; max-height: 70vh; }
  .wrap svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
  .flat { width: 400px; height: 400px; background: #eee; }
  .cell.skip { opacity: 0.35; }
  .cell.changed .tag { background: #d6452f; }
  .cell.discarded .tag { background: #111; }
```

In `<nav>`, add two buttons before `Groups`:

```html
    <button data-mode="photos">Photos</button>
    <button data-mode="digits">Digits</button>
```

In `<main>`, add a third container: `<main><div id="photos"></div><div id="grid"></div><div id="table"></div></main>`.

- [ ] **Step 4: Add the help texts**

In the `HELP` object, add two keys:

```js
  photos: `
    <h3>What to do</h3>
    <ol>
      <li>The left image is the photo. The green outline is the grid that the import found.</li>
      <li>The right image is the grid after the flatten, with the cell lines in red. Grey cells are outside the photo and are not cut.</li>
      <li>Do the red lines lie on the grid lines? Press <b>Enter</b>. The page cuts the cells and opens the next photo.</li>
      <li>Wrong outline? Click the 4 corners: top left, top right, bottom right, bottom left. A corner can be in the dark border outside the photo.</li>
      <li>Press <b>C</b> to go back to the found outline.</li>
      <li>Curled page, blurry digits or no sudoku? Press <b>R</b> to reject the photo.</li>
      <li>Press <b>S</b> to skip. The photo comes back after the others.</li>
    </ol>
    <p>You cannot undo a photo. Check the right image before you press Enter.</p>
    <p>After the last photo: Stop the server with Ctrl-C and run <code>just label-cells</code> again. The model then pre-labels the new cells for the Digits screen.</p>`,
  digits: `
    <h3>What to do</h3>
    <ol>
      <li>All cells on the screen are cells that the model reads as the same digit. The title names it.</li>
      <li>Click each cell that is not this digit. It fades and stays unlabelled.</li>
      <li>Know the right digit? Point at the cell and press it. <b>0</b> means empty.</li>
      <li>Press <b>X</b> to discard the pointed-at cell: a bad cut, half a digit, or an unreadable mark.</li>
      <li>Press <b>Enter</b>. Every cell that is not faded gets the digit of its tag.</li>
    </ol>
    <p>The least sure cells come first. Check them with care.</p>
    <p>Small pencil notes: click them. They stay unlabelled.</p>
    <p>Press <b>K</b> to show all kinds, not only handwritten cells. Press <b>Z</b> to undo the last Enter.</p>
    <p>The kind comes later, on the Groups screen.</p>`,
```

- [ ] **Step 5: Add the screen state and actions**

Add these globals after `let busy = false;`:

```js
let photo = null;      // the photo on the Photos screen, from /api/photos/next
let corners = null;    // [[x, y] × 4] in full-size upright photo pixels
let clicks = [];       // corners that the person clicked, in the order TL, TR, BR, BL
let kinds = "handwritten";
let digit = "1";
const PAD = 120;       // the dark border around the photo: room for corners outside it
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "empty"];
```

Extend `ACTIONS`:

```js
  photos: [["Enter · accept", () => acceptPhoto()], ["R · reject", () => rejectPhoto()],
           ["S · skip", () => skipPhoto()], ["C · clear corners", () => clearCorners()]],
  digits: [["Enter · confirm screen", () => save()], ["K · handwritten or all kinds", () => toggleKinds()],
           ["Z · undo", () => undo()]],
```

Add these functions before `function render()`:

```js
function cornerQuery() {
  return corners.flat().map((v) => v.toFixed(1)).join(",");
}

function drawQuad() {
  const img = $("photo");
  if (!img || !photo) return;
  const scale = img.clientWidth / photo.width;
  const points = clicks.length ? clicks : corners || [];
  const xy = points.map(([x, y]) => [x * scale + PAD, y * scale + PAD]);
  const colour = clicks.length ? "#f2b705" : "#3ad65a";
  const polygon = xy.length === 4
    ? `<polygon points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${colour}" stroke-width="2"/>` : "";
  $("quad").innerHTML = polygon + xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${colour}"/>`).join("");
}

async function refreshPreview() {
  $("flat").src = `/flat/${photo.stem}.png?c=${cornerQuery()}`;
  const value = await api(`/api/photos/usable?photo=${photo.stem}&c=${cornerQuery()}`);
  $("usable").textContent = `${value.usable} of 81 cells are inside the photo.`;
  drawQuad();
}

function clickCorner(event) {
  const rect = $("photo").getBoundingClientRect();
  const scale = rect.width / photo.width;
  clicks.push([(event.clientX - rect.left) / scale, (event.clientY - rect.top) / scale]);
  if (clicks.length === 4) {
    corners = clicks;
    clicks = [];
    run(refreshPreview);
  }
  drawQuad();
}

function renderPhoto() {
  $("grid").innerHTML = "";
  if (!photo) {
    $("photos").innerHTML = "";
    $("title").textContent = "No photo to check.";
    return say("Import photos with just import-photos <folder>. Or open Digits.");
  }
  $("title").textContent = `Photo ${photo.stem} · ${photo.pending} to check · ${photo.reason}`;
  $("photos").innerHTML = `<div class="photo-row">
    <div class="wrap" id="wrap"><img id="photo" alt="" src="/photo/${photo.stem}.jpg"><svg id="quad"></svg></div>
    <div><img class="flat" id="flat" alt=""><p id="usable"></p></div></div>`;
  $("photo").onload = drawQuad;
  $("wrap").onclick = clickCorner;
  if (corners) {
    run(refreshPreview);
  } else {
    $("usable").textContent = "No grid found. Click the 4 corners: top left, top right, bottom right, bottom left.";
  }
}

async function loadPhoto(after) {
  photo = await api(`/api/photos/next${after ? `?after=${after}` : ""}`);
  corners = photo && photo.corners;
  clicks = [];
  render();  // the nav, the help and the buttons of the Photos screen
  renderPhoto();
}

async function acceptPhoto() {
  if (!photo) return;
  if (!corners) return say("Click the 4 corners first.");
  const result = (await api("/api/photos/accept", { photo: photo.stem, corners })).result;
  const text = result.decision === "accepted"
    ? `Saved ${result.cells} cells. ${result.duplicates} were already known.`
    : "Too few cells are inside the photo. The photo is skipped for good.";
  await loadPhoto(photo.stem);
  say(text);
}

async function rejectPhoto() {
  if (!photo) return;
  await api("/api/photos/reject", { photo: photo.stem, reason: "rejected" });
  await loadPhoto(photo.stem);
  say("Rejected.");
}

async function skipPhoto() {
  if (!photo) return;
  await loadPhoto(photo.stem);
  say("Skipped. The photo comes back after the others.");
}

function clearCorners() {
  if (!photo) return;
  clicks = [];
  corners = photo.corners;
  renderPhoto();
}

async function loadDigits(next) {
  if (next) digit = next;
  setScreen(await api(`/api/digits?digit=${digit}&kinds=${kinds}`));
}

async function toggleKinds() {
  kinds = kinds === "handwritten" ? "all" : "handwritten";
  await loadDigits();
  say(kinds === "all" ? "All kinds are shown." : "Only handwritten cells are shown.");
}
```

- [ ] **Step 6: Wire the modes into the existing functions**

Change these existing functions exactly as shown. Keep every other branch.

`cellsOnScreen`, add before `return [];`:

```js
  if (mode === "digits") return screen.cells;
```

`title`, add a branch before the final `else`:

```js
  } else if (mode === "digits") {
    text = !screen ? "" : `Digit ${screen.digit} · ${screen.left} cells left · ` +
      `${screen.kinds === "all" ? "all kinds" : "handwritten only"}` +
      `${screen.not_prelabelled ? ` · ${screen.not_prelabelled} cells without a pre-label` : ""}`;
  } else if (mode === "photos") {
    return;
```

`renderFolders`, replace the whole function:

```js
function renderFolders() {
  if (mode === "groups") {
    $("folders").innerHTML = "Jump to folder: " + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((f) =>
      `<button data-folder="${f}" class="${screen && screen.folder === String(f) ? "on" : ""}">${f}</button>`).join(" ");
    for (const b of $("folders").querySelectorAll("button")) {
      b.onclick = () => open("groups", { folder: b.dataset.folder, group: 0 });
    }
  } else if (mode === "digits" && screen) {
    $("folders").innerHTML = "Digit: " + DIGITS.map((d) =>
      `<button data-digit="${d}" class="${screen.digit === d ? "on" : ""}">${d} (${screen.counts[d]})</button>`).join(" ");
    for (const b of $("folders").querySelectorAll("button")) {
      b.onclick = () => run(() => loadDigits(b.dataset.digit));
    }
  } else {
    $("folders").innerHTML = "";
  }
}
```

`render`, after `$("table").innerHTML = "";`, add `if (mode !== "photos") $("photos").innerHTML = "";`. In the loop, replace the lines that set `div.className` and `div.innerHTML` with:

```js
    let tagText = LETTER[kind] || "·";
    let classes = `cell ${kind || ""} ${cell.least_sure ? "least" : ""}`;
    if (mode === "digits") {
      const mark = local[cell.id];
      tagText = mark === "skip" ? "–" : mark === "discarded" ? "✕" : (mark || screen.digit);
      classes = `cell ${mark === "skip" ? "skip" : ""} ${mark === "discarded" ? "discarded" : ""} ` +
        `${mark && mark !== "skip" && mark !== "discarded" ? "changed" : ""}`;
    }
    div.className = classes;
    div.innerHTML = `<img src="/cell/${cell.stem}.png" alt=""><span class="tag">${tagText}</span>`;
```

Replace the `div.onclick` assignment with:

```js
    div.onclick = (event) => {
      if (mode === "digits") {
        local[cell.id] = local[cell.id] === "skip" ? undefined : "skip";
        return render();
      }
      if (cell.folder === "empty") return say("An empty cell has no kind. Press a digit if it shows one.");
      local[cell.id] = event.altKey ? "unsure" : (local[cell.id] === "printed" ? "handwritten" : "printed");
      render();
    };
```

`detailText`, add at the top: `if (mode === "digits") return \`The model reads ${screen.digit} (${Math.round(cell.p * 100)} %).\`;`

`setScreen` already clears `local`, so a new digit screen starts without marks. After the existing messages in `setScreen`, add:

```js
  if (mode === "digits" && screen && !screen.left) {
    const next = DIGITS.find((d) => screen.counts[d] > 0);
    say(next ? `No cells left for ${screen.digit}. Open digit ${next}.` : "No pre-labelled cells left.");
  }
```

`reload`, add before the review branch:

```js
  } else if (mode === "digits") {
    await loadDigits();
```

`save`, add a branch before the `review` branch:

```js
  } else if (mode === "digits" && screen) {
    const entries = cells.filter((c) => local[c.id] !== "skip")
      .map((c) => ({ id: c.id, digit: local[c.id] || screen.digit }));
    const result = await api("/api/assign", { screen: "digits", cells: entries });
    await loadDigits();
    say(`Saved: ${result.result} cells. ${$("message").textContent}`);
```

`open`, add two branches at the start of the `run(async () => { … })` chain:

```js
    if (mode === "photos") {
      await loadPhoto();
    } else if (mode === "digits") {
      await loadDigits();
    } else if (mode === "groups" && target) {
```

Keep the rest of the chain.

`keydown` handler, add these lines after `const key = event.key.toLowerCase();` and before the existing `if ((key === "p" …`. Each new branch ends with `return`, so the existing chain stays as it is:

```js
  if (mode === "photos") {
    if (key === "enter") run(acceptPhoto);
    else if (key === "r") run(rejectPhoto);
    else if (key === "s") run(skipPhoto);
    else if (key === "c") clearCorners();
    return;
  }
  if (mode === "digits" && (/^[0-9]$/.test(key) || key === "x")) {
    if (!hovered) return say("Point at a cell first, then press the key.");
    local[hovered.id] = key === "x" ? "discarded" : key === "0" ? "empty" : key;
    return render();
  }
  if (mode === "digits" && key === "k") return run(toggleKinds);
  if (key === "z" && mode === "digits") return run(undo);
```

The existing `enter` branch calls `run(save)` and already covers Digits.

Leave the last line `open("groups");` as it is. Groups stays the start screen.

- [ ] **Step 7: Run the tests**

Run: `uv run --directory ml pytest tests/test_label_server.py -v && just test-ml && just lint-ml`
Expected: PASS.

- [ ] **Step 8: Check the page by hand with synthetic data**

Do not use the real data. Write this script outside the repository, then run it from the worktree root:

```bash
cat > "$TMPDIR/label_scratch.py" <<'EOF'
"""Serve the labelling page on a scratch ml root. No argument: build a new root with 2 synthetic
photos. With a root: rewrite the manifest, pre-label its unlabelled cells, then serve it."""
import sys
import tempfile
import webbrowser
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, "tests")
from photos import grid_photo, save_photo
from test_prelabel import make_run

from sudoku_ml.label_server import make_server
from sudoku_ml.label_store import LabelStore, Paths
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.photo_import import PhotoPaths, import_folder
from sudoku_ml.prelabel import write_prelabels

if len(sys.argv) > 1:
    root = Path(sys.argv[1])
    run = root / "artifacts" / "20261012-000000-test"
    if not run.exists():
        run = make_run(root)
    write_prelabels(root / "data" / "cells", run, root / "data" / "prelabels.json")
else:
    root = Path(tempfile.mkdtemp())
    save_photo(grid_photo(seed=4), root / "in" / "a.png")
    save_photo(grid_photo(seed=5)[:, :700], root / "in" / "b.png")
    import_folder(root / "in", PhotoPaths.under(root), "phone", "own")
    (root / "data" / "cells" / "1").mkdir(parents=True, exist_ok=True)
(root / "datasets").mkdir(exist_ok=True)
paths = Paths.under(root)
write_cells_manifest(paths.cells, paths.manifest, paths.log)
store = LabelStore(paths)
check = PhotoCheck(PhotoPaths.under(root), store.session, lambda: datetime.now(UTC))
server = make_server(store, check, port=8799)
print(f"Scratch root: {root}")
print("Open http://127.0.0.1:8799/ . Stop with Ctrl-C.")
webbrowser.open("http://127.0.0.1:8799/")
try:
    server.serve_forever()
except KeyboardInterrupt:
    write_cells_manifest(paths.cells, paths.manifest, paths.log)
EOF
uv run --directory ml python "$TMPDIR/label_scratch.py"
```

Check each item. Fix what fails:
- Photos screen: photo 1 shows a green outline on the grid. The right image shows red lines on the grid lines and "81 of 81 cells". Enter shows "Saved N cells" and opens photo 2.
- Photo 2 is cut off on the right. Click 4 corners, with the 2 right corners in the dark border. The outline turns yellow while you click. The preview shows grey cells on the right. Enter saves fewer than 81 cells.
- On a new scratch root: C restores the found outline, S skips, and R rejects.
- Stop the server with Ctrl-C. Start it again with the printed root: `uv run --directory ml python "$TMPDIR/label_scratch.py" <root>`. This pre-labels the new cells with a random model. Open Digits:
  - The digit buttons show counts. Press K if a digit has no cells: the random model may call few cells handwritten.
  - A click fades a cell. Pointing at a cell and pressing 5 sets its tag to 5 in red. X sets ✕.
  - Enter saves, and the screen reloads with fewer cells. Z undoes it.
- The Groups and Progress screens still open. Review and Check need the training config, which the scratch root does not have. The existing tests cover them.

- [ ] **Step 9: Commit**

```bash
git add ml/src/sudoku_ml/label_page.html ml/tests/test_label_server.py
git commit -m "feat(ml): Photos and Digits screens on the labelling page (#70)"
```

---

### Task 9: Documentation

**Files:**
- Modify: `docs/architecture/adr/adr-009-training-data-outside-git.md`
- Modify: `docs/architecture/00-DECISIONS.md` (the ADR-009 row)
- Modify: `docs/architecture/09-architecture-decisions.md` (the ADR-009 row)
- Modify: `ml/DATA_SOURCES.md`
- Modify: `ml/README.md`
- Modify: `docs/architecture/12-glossary.md`

- [ ] **Step 1: Amend ADR-009**

Add this section after the existing amendment and before `## Consequences`:

```markdown
## Amendment: photo import and digit pass (2026-10-12)

- `just import-photos <folder>` copies new photos into `ml/data/photos/`. The photo id uses the
  same rule as the cell id. A photo that is already present is skipped.
- `photos.csv` gets the columns `licence` and `attribution`. Older rows have the licence `none`.
  The origins are `phone`, `web`, `wicht`, `openverse`, `commons` and `lexski`.
- The import reads the origin and licence from a `manifest.jsonl` next to the photos, or from the
  command line. A photo without both is skipped.
- A person checks each imported photo on the Photos screen of the labelling page: accept, fix the
  4 corners, or reject. `ml/datasets/photo-checks.jsonl` (in git) holds one line per decision.
- An accepted photo is cut with the flatten of the app's scanner: 576 × 576, then 64 × 64 cells
  ([scan pipeline](../00-concepts/scan-pipeline.md)). Only cells fully inside the photo are cut.
  A photo with fewer than 10 such cells gets no cells.
- `ml/datasets/cell-origins.csv` (in git) links each cut cell to its photo, row and column. The
  licence of a cell is the licence of its photo. Cells cut before this amendment have no row.
- The Digits screen groups the unlabelled cells by the digit that the model predicts. A person
  confirms each group and corrects the exceptions. Each change is a `digit` line in
  `kind-log.jsonl` with the screen `digits`. The model's proposals live in
  `ml/data/prelabels.json`, outside git.
- The cell folder `discarded/` holds cells that a person rejected: bad cuts, unreadable marks.
  Training ignores it. `cells.csv` lists these cells with the label `discarded`.
```

Also add one line to `## Consequences`: `- Training does not filter cells by licence yet. A model trained on real cells stays private (ADR-013).`

- [ ] **Step 2: Update the index rows**

In `docs/architecture/00-DECISIONS.md`, change the ADR-009 summary to: `Images outside git, a dataset manifest inside. Kind labels in an append-only log in git. Photo import with a licence per photo and a cell-to-photo link. DVC later.`

In `docs/architecture/09-architecture-decisions.md`, change the ADR-009 summary to: `Training images outside git, a versioned dataset manifest inside. Kind labels in an append-only log, amended 2026-10-11. Photo import and digit pass, amended 2026-10-12. DVC as the next step`

- [ ] **Step 3: Add the data sources**

In `ml/DATA_SOURCES.md`, replace the `photo` cells row and add photo rows. The table becomes:

```markdown
| Source | Images | Origin | Licence | May be published |
| --- | --- | --- | --- | --- |
| `photo` cells | Cells in `cells/` | Cut from the photos below. `cell-origins.csv` links a cut cell to its photo | The licence of its photo. A cell without a row in `cell-origins.csv`: as `phone` and `web` | Only if its photo may be published |
| Photos, `origin` = `phone` | Rows with this origin in `photos.csv` | Phone photos of puzzles printed in newspapers and books | The puzzles are copyrighted | No |
| Photos, `origin` = `web` | Rows with this origin in `photos.csv` | Downloaded from the web: stock-photo sites, shops, video thumbnails, forums | None | No |
| Photos, `origin` = `wicht` | Rows with this origin in `photos.csv` | [Wicht sudoku dataset v2](https://github.com/wichtounet/sudoku_dataset) | CC BY 4.0 | Yes, with the attribution in `photos.csv` |
| Photos, `origin` = `openverse` | Rows with this origin in `photos.csv` | Found through the Openverse API. The `attribution` column names the author and the page | Per photo, in `photos.csv` | Only `cc0`, `pdm`, `by` and `by-sa`, with the attribution |
| Photos, `origin` = `commons` | Rows with this origin in `photos.csv` | Wikimedia Commons | Per photo, in `photos.csv` | Only `cc0`, `pdm`, `by` and `by-sa`, with the attribution |
| Photos, `origin` = `lexski` | Rows with this origin in `photos.csv` | Hugging Face `Lexski/sudoku-image-recognition`. Tagged CC0, but the files look like Reddit uploads | `unverified` | No |
| Synthetic cells | Not stored | Rendered with the fonts in `ml/fonts/` | SIL Open Font License | Yes |
```

Under the table, add: `Training does not filter by licence yet. Until it does, every model trained on real cells stays private.`

- [ ] **Step 4: Update `ml/README.md`**

1. In `## Commands`, add:
   - `` - `just import-photos <folder> [--origin O] [--licence L]`: copy new sudoku photos into `ml/data/photos/` and find the grid in each. ``
   - `` - `just prelabel-cells [run]`: let a model propose a digit for each cell in `unlabeled/`. `just label-cells` runs it first. ``
2. In the `ml/data/` tree, add `discarded/` under `cells/` with the note `cells a person rejected; training ignores them`. Add `import/detections.json` (the proposed outline per photo) and `prelabels.json` (the model's proposals).
3. In the `ml/datasets/` tree, add `photo-checks.jsonl` (one line per photo decision) and `cell-origins.csv` (cell, photo, row, col).
4. Change the line about `origin` to: `` `origin` and `licence` in `photos.csv` say where a photo comes from and how it may be used (see DATA_SOURCES.md). ``
5. Add a section before `## Label the kind`:

```markdown
## Import photos and label their digits

1. Run `just import-photos <folder> --origin phone --licence own`. A folder from the sudoku
   paper scraper has a `manifest.jsonl`, so it needs no options.
2. Run `just label-cells`. Open the **Photos** screen. Accept each photo, fix its 4 corners or
   reject it. Accepted photos give cells in `cells/unlabeled/`.
3. Stop the server with Ctrl-C. Run `just label-cells` again. It pre-labels the new cells.
4. Open the **Digits** screen. Click the cells that are not the digit in the title. Press Enter.
5. Label the kind of the new cells on the Groups screen, as below.

Commit `ml/datasets/photos.csv`, `photo-checks.jsonl`, `cell-origins.csv`, `kind-log.jsonl` and
`cells.csv` after a session.
```

- [ ] **Step 5: Add glossary terms**

In `docs/architecture/12-glossary.md`, add these rows in the main table. Keep the existing order style:

```markdown
| Photo check | The Photos screen of the labelling page: a person accepts, corrects or rejects the grid outline of an imported photo. See ADR-009 |
| Usable cell | A cell whose 4 corners lie inside the photo after the flatten. Only usable cells are cut |
| Pre-label | The model's proposed digit and kind for an unlabelled cell. A proposal, not a label |
| Digit pass | The Digits screen: a person confirms a screen of pre-labelled cells per digit and corrects the exceptions |
| Discarded cell | A cell that a person rejected in the digit pass. It stays in `cells/discarded/`. Training ignores it |
| Cell origin | The photo, row and column that a cut cell comes from, in `cell-origins.csv` |
```

- [ ] **Step 6: Check the links and the whole repo**

Run: `just docs-check && just lint-ml && just test-ml`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add docs/architecture ml/DATA_SOURCES.md ml/README.md
git commit -m "docs(ml): photo import and digit pass in ADR-009, data sources and README (#70)"
```

---

## Done criteria

- [ ] `just test-ml`, `just lint-ml` and `just docs-check` pass.
- [ ] `git status` is clean. No image is in any commit: `git log --stat origin/develop..HEAD | grep -Ei '\.(png|jpe?g|heic|webp)'` prints nothing.
- [ ] The hand check of Task 8, Step 8 passed.
- [ ] Report to the developer: the commits, any deviation from this plan and why, and the pillow-heif version used.

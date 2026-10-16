# Kind Labelling Implementation Plan (issue #30)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the real cells a kind label (`printed` or `handwritten`) through groups of similar cells, a local labelling page and three checks, so that the kind head learns from real cells. GitHub issue #30.

**Architecture:** All code lives in `ml/src/sudoku_ml/`, one module per job. `kind_log` is the append-only log of label changes. `manifest` and `dataset` turn the log into the `kind` column of `cells.csv` and into training targets. `grouping` writes `groups.json` with k-means on model features plus ink colour. `kind_check` and `kind_review` hold the blind re-label and the Review rules. `label_store` holds all page state and rules. `label_server` is a thin standard-library HTTP layer on `127.0.0.1`, and `label_page.html` is the page. `suspects` and `train` gain the kind.

**Tech Stack:** Python 3.12, uv, PyTorch 2.13.0, NumPy, Pillow, the standard library `http.server`, plain HTML and JavaScript, pytest, ruff. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-kind-labelling-design.md`. Read it first. Also read:
- `AGENTS.md` (working rules, writing style, code comments, git)
- `docs/architecture/00-concepts/model-contract.md` (label format, kind classes, valid pairs)
- `docs/architecture/adr/adr-009-training-data-outside-git.md`, `adr-013-fixtures-and-data-licensing.md`
- `ml/README.md`, `ml/DATA_SOURCES.md`
- Issue #30: `gh issue view 30`

## Context for a fresh agent

- You work in the worktree `~/projects/sudoku-30-kind-labelling`, branch `feature/30-kind-labelling`.
- In this worktree, a hook rewrites `git` to `rtk git`, and the sandbox refuses it. Use `/usr/bin/git`, one plain command per Bash call.
- `ml/data/` is git-ignored and exists only in the main checkout `~/projects/sudoku/ml/data/`. It holds `cells/{empty,1..9,unlabeled}/<id16>.png`. Unit tests never need it: they build small cell trees in `tmp_path`. **Never commit anything from `ml/data/`.**
- A cell's id is the SHA-256 from `manifest.pixel_id`. Its file name is the first 16 characters of the id. `ml/datasets/cells.csv` maps the full id to the label.
- `contract.py` has `DIGIT_CLASSES`, `KIND_CLASSES`, `UNKNOWN_KIND`, `kind_index`.
- `dataset.py` has `load_cells`, `group_ids` (near-duplicate groups) and `split_by_group`.
- `suspects.py` already runs a 5-fold cross-validation and gets both heads' logits.
- Run the tests with `uv run --directory ml pytest tests/<file> -q` from the worktree root. Run the lint with `just lint-ml`.
- Task 13 has **human steps**: the developer labels one folder. Stop there and ask.

## Global Constraints

- Branch `feature/30-kind-labelling`. The pull request targets `develop`. Commits are Conventional Commits that end with `(#30)`. Do not push to `main` or `develop`.
- Kind values in the log: `printed`, `handwritten`, `unsure`, or `null`. The `kind` column of `cells.csv`: `printed`, `handwritten`, `unsure`, `none` or blank.
- "By look": `printed` is made by a printer or a screen. `handwritten` is written by a person with a pen or a pencil.
- The server binds to `127.0.0.1` only. It accepts a request only with `Host` `127.0.0.1:<port>` or `localhost:<port>`. It accepts a `POST` only with `Content-Type: application/json` (SUD-02, SUD-08).
- The log and the check file hold ids and words only, never an image. They are in git.
- Grouping: 30 groups per folder, seed 0, ink-colour weight 0.5, features scaled to length 1.
- A screen holds at most 50 cells. The least sure 10 % of a group get a thick border.
- The Check screen draws 200 cells, half from the test split, only labels 7 days old or older.
- The kind suspect threshold is 0.10. The digit suspects stay the 150 lowest.
- Before each lint, run `uv run --directory ml ruff format .`. Ruff selects `E501` at 100 characters: split any long line that the formatter cannot split, such as a long string.
- No new dependencies. No `TODO`, `FIXME`, `XXX` or `HACK`. Comments follow `AGENTS.md` (the reason, not the action).
- Prose follows the writing rules in `AGENTS.md`.

## Review Focus

1. **A web page in another browser tab sends a request to the label server** (cross-site request or DNS rebinding). Expected: a wrong `Host` gets 403, a `POST` without `Content-Type: application/json` gets 415, and nothing is written. Pinned in Task 9.
2. **A cell moves into a folder after `just group-cells`**, so no group of that folder holds it. Expected: the cell shows up in that folder's "ungrouped" group and can get a kind. Pinned in Task 8.
3. **A session rollback after a later session changed the same cells.** Expected: the rollback refuses and names a cell, and the log is unchanged. Pinned in Task 1.
4. **Undo after a restart reaches into yesterday's work.** Expected: undo only reverses actions of the current session. Pinned in Task 1.
5. **A Review item stays open after it was handled elsewhere**: the digit was fixed on the Groups screen, or the kind changed since the check. Expected: an item whose label no longer matches the current label disappears. Pinned in Task 7.

## File Structure

```
ml/src/sudoku_ml/
├── kind_log.py          # NEW  Line, read/append JSONL, current kinds, undo, rollback, times
├── relabel.py           # MOD  move_cells() extracted from apply_relabels()
├── manifest.py          # MOD  kind column from the log
├── dataset.py           # MOD  cell_paths, read_ids, read_kinds, load_cells(…, manifest)
├── grouping.py          # NEW  ink colour, features, k-means, sureness, groups.json
├── suspects.py          # MOD  digit + kind rows in one suspects.csv, no sheets
├── kind_check.py        # NEW  CheckLine, draw_sample, summary
├── kind_review.py       # NEW  ReviewItem, near-duplicate/model/check items, open_items
├── label_store.py       # NEW  Paths, LabelStore: screens, save, move, undo, review, check, progress
├── label_server.py      # NEW  make_server, main (serve, rollback)
├── label_page.html      # NEW  the page
└── train.py             # MOD  manifest kinds, real kind accuracy, label state in the card
ml/tests/
├── test_kind_log.py  test_grouping.py  test_kind_check.py  test_kind_review.py
├── test_label_store.py  test_label_server.py          # NEW
└── test_relabel.py  test_manifest.py  test_dataset.py  test_suspects.py  test_train.py  # MOD
justfile                 # group-cells, label-cells, label-rollback; suspects comment
docs/…                   # ADR-009 amendment, decision rows, glossary, contract, R-13, ml/README
```

---

### Task 1: The kind log

**Files:**
- Create: `ml/src/sudoku_ml/kind_log.py`
- Test: `ml/tests/test_kind_log.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `KINDS: tuple[str, ...] = ("printed", "handwritten", "unsure")`
  - `@dataclass(frozen=True) class Line: t: str; session: str; action: str; cell: str; field: str; old: str | None; new: str | None; screen: str`
  - `read_records(path: Path, cls: type[T]) -> list[T]`, `append_records(path: Path, records: list) -> None`
  - `read_log(path: Path) -> list[Line]`
  - `format_time(moment: datetime) -> str`, `parse_time(text: str) -> datetime`
  - `current_kinds(lines: list[Line]) -> dict[str, str | None]`
  - `last_kind_times(lines: list[Line]) -> dict[str, str]`
  - `undone_actions(lines: list[Line]) -> set[str]`
  - `undo_lines(lines: list[Line], t: str, session: str) -> list[Line]`
  - `rollback_lines(lines: list[Line], target: str, t: str, session: str) -> list[Line]`

- [ ] **Step 0: Install the environment in the worktree**

Run: `uv sync --directory ml`
Expected: the environment installs without errors.

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_kind_log.py`:

```python
from datetime import UTC, datetime
from pathlib import Path

import pytest

from sudoku_ml.kind_log import (
    Line,
    append_records,
    current_kinds,
    format_time,
    last_kind_times,
    parse_time,
    read_log,
    rollback_lines,
    undo_lines,
)

A, B = "a" * 64, "b" * 64
LATER = "2026-10-12T10:00:00Z"


def line(second, session, action, cell, field, old, new, screen="groups") -> Line:
    return Line(f"2026-10-12T09:00:{second:02d}Z", session, action, cell, field, old, new, screen)


def test_append_then_read_round_trips(tmp_path: Path):
    path = tmp_path / "log.jsonl"
    lines = [line(1, "s1", "s1-1", A, "kind", None, "printed")]
    append_records(path, lines)
    append_records(path, lines)
    assert read_log(path) == lines * 2


def test_a_missing_log_is_empty(tmp_path: Path):
    assert read_log(tmp_path / "none.jsonl") == []


def test_a_bad_line_names_its_line_number(tmp_path: Path):
    path = tmp_path / "log.jsonl"
    path.write_text('{"t": "x"}\n')
    with pytest.raises(ValueError, match=":1:"):
        read_log(path)


def test_the_current_kind_is_the_last_kind_line():
    lines = [
        line(1, "s1", "s1-1", A, "kind", None, "printed"),
        line(2, "s1", "s1-2", A, "kind", "printed", "handwritten"),
        line(3, "s1", "s1-3", A, "digit", "7", "1"),
    ]
    assert current_kinds(lines) == {A: "handwritten"}
    assert last_kind_times(lines) == {A: "2026-10-12T09:00:02Z"}


def test_undo_reverses_the_whole_last_action():
    lines = [
        line(1, "s1", "s1-1", A, "kind", None, "printed"),
        line(2, "s1", "s1-2", A, "kind", "printed", "handwritten"),
        line(2, "s1", "s1-2", B, "kind", None, "printed"),
    ]
    undo = undo_lines(lines, LATER, "s1")
    assert [(u.cell, u.old, u.new, u.action, u.screen) for u in undo] == [
        (B, "printed", None, "undo:s1-2", "undo"),
        (A, "handwritten", "printed", "undo:s1-2", "undo"),
    ]
    assert current_kinds(lines + undo) == {A: "printed", B: None}


def test_a_second_undo_reverses_the_action_before():
    lines = [
        line(1, "s1", "s1-1", A, "kind", None, "printed"),
        line(2, "s1", "s1-2", A, "kind", "printed", "handwritten"),
    ]
    lines += undo_lines(lines, LATER, "s1")
    lines += undo_lines(lines, LATER, "s1")
    assert current_kinds(lines) == {A: None}
    assert undo_lines(lines, LATER, "s1") == []


def test_undo_never_reaches_into_another_session():
    lines = [line(1, "s1", "s1-1", A, "kind", None, "printed")]
    assert undo_lines(lines, LATER, "s2") == []


def test_rollback_reverses_every_action_of_a_session_newest_first():
    lines = [
        line(1, "s0", "s0-1", B, "kind", None, "printed"),
        line(2, "s1", "s1-1", A, "kind", None, "printed"),
        line(3, "s1", "s1-2", A, "digit", "7", "1"),
    ]
    back = rollback_lines(lines, "s1", LATER, "s2")
    assert [(b.field, b.new) for b in back] == [("digit", "7"), ("kind", None)]
    assert current_kinds(lines + back) == {A: None, B: "printed"}


def test_rollback_refuses_when_a_later_session_changed_the_cell():
    lines = [
        line(1, "s1", "s1-1", A, "kind", None, "printed"),
        line(2, "s2", "s2-1", A, "kind", "printed", "handwritten"),
    ]
    with pytest.raises(ValueError, match=A[:16]):
        rollback_lines(lines, "s1", LATER, "s3")


def test_a_second_rollback_of_the_same_session_does_nothing():
    lines = [line(1, "s1", "s1-1", A, "kind", None, "printed")]
    lines += rollback_lines(lines, "s1", LATER, "s2")
    assert rollback_lines(lines, "s1", LATER, "s3") == []


def test_times_round_trip():
    moment = datetime(2026, 10, 12, 9, 0, 1, tzinfo=UTC)
    assert parse_time(format_time(moment)) == moment
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_kind_log.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'sudoku_ml.kind_log'`.

- [ ] **Step 3: Write the implementation**

`ml/src/sudoku_ml/kind_log.py`:

```python
"""The kind log: one JSON line per label change, append-only (ADR-009, amendment)."""

import json
import os
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import TypeVar

KINDS: tuple[str, ...] = ("printed", "handwritten", "unsure")
TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
T = TypeVar("T")


@dataclass(frozen=True)
class Line:
    t: str  # UTC, TIME_FORMAT
    session: str
    action: str  # the lines of one save or one move share it. An undo line: "undo:<action>"
    cell: str  # full SHA-256 cell id
    field: str  # "kind" or "digit"
    old: str | None
    new: str | None
    screen: str  # "groups", "review" or "undo"


def read_records(path: Path, cls: type[T]) -> list[T]:
    if not path.exists():
        return []
    records = []
    for number, text in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not text.strip():
            continue
        try:
            records.append(cls(**json.loads(text)))
        except (TypeError, json.JSONDecodeError) as error:
            raise ValueError(f"{path}:{number}: not a valid line ({error})") from error
    return records


def append_records(path: Path, records: list) -> None:
    """Append, then fsync: a line that the page reported as saved survives a crash."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(asdict(record), separators=(",", ":")) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def read_log(path: Path) -> list[Line]:
    return read_records(path, Line)


def format_time(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime(TIME_FORMAT)


def parse_time(text: str) -> datetime:
    return datetime.strptime(text, TIME_FORMAT).replace(tzinfo=UTC)


def current_kinds(lines: list[Line]) -> dict[str, str | None]:
    kinds: dict[str, str | None] = {}
    for line in lines:
        if line.field == "kind":
            kinds[line.cell] = line.new
    return kinds


def last_kind_times(lines: list[Line]) -> dict[str, str]:
    return {line.cell: line.t for line in lines if line.field == "kind"}


def undone_actions(lines: list[Line]) -> set[str]:
    return {line.action.removeprefix("undo:") for line in lines if line.screen == "undo"}


def _reverse(action_lines: list[Line], t: str, session: str) -> list[Line]:
    return [
        replace(
            line,
            t=t,
            session=session,
            action=f"undo:{line.action}",
            old=line.new,
            new=line.old,
            screen="undo",
        )
        for line in reversed(action_lines)
    ]


def undo_lines(lines: list[Line], t: str, session: str) -> list[Line]:
    """Lines that reverse the newest live action of `session`. Empty when there is none."""
    undone = undone_actions(lines)
    for line in reversed(lines):
        if line.session == session and line.screen != "undo" and line.action not in undone:
            return _reverse([x for x in lines if x.action == line.action], t, session)
    return []


def rollback_lines(lines: list[Line], target: str, t: str, session: str) -> list[Line]:
    """Lines that reverse every live action of `target`, newest first.

    Raises ValueError when a later session changed a cell of `target`: reversing would
    overwrite that later work.
    """
    undone = undone_actions(lines)
    target_actions = {x.action for x in lines if x.session == target}
    live = [x for x in lines if x.session == target and x.screen != "undo" and x.action not in undone]
    cells = {x.cell for x in live}
    last = max((i for i, x in enumerate(lines) if x.session == target), default=-1)
    later = sorted(
        {
            x.cell[:16]
            for x in lines[last + 1 :]
            if x.cell in cells and x.action.removeprefix("undo:") not in target_actions
        }
    )
    if later:
        raise ValueError(f"a later session changed {len(later)} cells of {target}, e.g. {later[0]}")
    actions = list(dict.fromkeys(x.action for x in reversed(live)))
    return [r for a in actions for r in _reverse([x for x in live if x.action == a], t, session)]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest tests/test_kind_log.py -q`
Expected: 11 passed.

- [ ] **Step 5: Lint**

Run: `just lint-ml`
Expected: no findings. If `ruff format --check` fails, run `uv run --directory ml ruff format .` and check again.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add ml/src/sudoku_ml/kind_log.py ml/tests/test_kind_log.py
/usr/bin/git commit -m "feat(ml): add the append-only kind log (#30)"
```

---

### Task 2: Single-cell moves and the `kind` column in `cells.csv`

**Files:**
- Modify: `ml/src/sudoku_ml/relabel.py`
- Modify: `ml/src/sudoku_ml/manifest.py`
- Test: `ml/tests/test_relabel.py`, `ml/tests/test_manifest.py`

**Interfaces:**
- Consumes: `kind_log.read_log`, `kind_log.current_kinds` (Task 1).
- Produces:
  - `relabel.move_cells(cells_dir: Path, wanted: dict[str, str]) -> int` (file stem → label folder; checks every move before any file moves)
  - `manifest.write_cells_manifest(cells_dir: Path, manifest: Path, log: Path | None = None) -> int`. The CSV header becomes `id,label,kind`.

- [ ] **Step 1: Write the failing tests**

Append to `ml/tests/test_relabel.py`:

```python
from sudoku_ml.relabel import move_cells


def test_move_cells_moves_one_cell(tmp_path: Path):
    cells = tree(tmp_path)
    assert move_cells(cells, {"aaaaaaaaaaaaaaaa": "empty"}) == 1
    assert (cells / "empty" / "aaaaaaaaaaaaaaaa.png").exists()


def test_move_cells_checks_everything_before_it_moves(tmp_path: Path):
    cells = tree(tmp_path)
    with pytest.raises(ValueError, match="unknown label"):
        move_cells(cells, {"aaaaaaaaaaaaaaaa": "3", "bbbbbbbbbbbbbbbb": "10"})
    assert (cells / "6" / "aaaaaaaaaaaaaaaa.png").exists()
```

In `ml/tests/test_manifest.py`, change `test_moved_cell_gets_its_new_label` so its last line reads:

```python
    assert rows(manifest) == [{"id": cell_id, "label": "8", "kind": ""}]
```

Append to `ml/tests/test_manifest.py`:

```python
from sudoku_ml.kind_log import Line, append_records


def log_kind(log: Path, cell_id: str, kind: str | None) -> None:
    append_records(log, [Line("2026-10-12T09:00:00Z", "s", "s-1", cell_id, "kind", None, kind, "groups")])


def test_kind_column_comes_from_the_log(tmp_path: Path):
    cells, manifest, log = tmp_path / "cells", tmp_path / "cells.csv", tmp_path / "log.jsonl"
    seven = add_cell(cells, "7", 10)
    three = add_cell(cells, "3", 20)
    empty = add_cell(cells, "empty", 200)
    other = add_cell(cells, "unlabeled", 90)
    log_kind(log, seven, "handwritten")
    write_cells_manifest(cells, manifest, log)
    kinds = {r["id"]: r["kind"] for r in rows(manifest)}
    assert kinds == {seven: "handwritten", three: "", empty: "none", other: ""}


def test_an_empty_cell_with_a_logged_kind_is_refused(tmp_path: Path):
    cells, manifest, log = tmp_path / "cells", tmp_path / "cells.csv", tmp_path / "log.jsonl"
    empty = add_cell(cells, "empty", 200)
    log_kind(log, empty, "printed")
    with pytest.raises(ValueError, match="empty cell"):
        write_cells_manifest(cells, manifest, log)


def test_a_cell_moved_to_empty_with_a_cleared_kind_is_accepted(tmp_path: Path):
    cells, manifest, log = tmp_path / "cells", tmp_path / "cells.csv", tmp_path / "log.jsonl"
    empty = add_cell(cells, "empty", 200)
    log_kind(log, empty, "printed")
    log_kind(log, empty, None)
    write_cells_manifest(cells, manifest, log)
    assert rows(manifest)[0]["kind"] == "none"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_relabel.py tests/test_manifest.py -q`
Expected: FAIL. `move_cells` does not exist, and the manifest has no `kind` column.

- [ ] **Step 3: Write the implementation**

In `ml/src/sudoku_ml/relabel.py`, split `apply_relabels` in two. Replace the whole function with:

```python
def move_cells(cells_dir: Path, wanted: dict[str, str]) -> int:
    """Move each cell (file stem → label folder). Check every move before any file moves."""
    current: dict[str, Path] = {}
    for path in sorted(cells_dir.glob("*/*.png")):
        if path.stem in current:
            other = current[path.stem].parent.name
            raise ValueError(f"{path.stem} is in two folders: {other} and {path.parent.name}")
        current[path.stem] = path
    moves = []
    for name, label in wanted.items():
        if label not in LABELS:
            raise ValueError(f"{name}: unknown label {label!r}")
        if name not in current:
            raise ValueError(f"{name}: no such cell")
        source = current[name]
        if source.parent.name != label:
            target = cells_dir / label / source.name
            if target.exists():
                raise ValueError(f"{name}: {target} already exists")
            moves.append((source, target))
    for source, target in moves:
        target.parent.mkdir(exist_ok=True)
        source.rename(target)
    return len(moves)


def apply_relabels(cells_dir: Path, relabels: Path) -> int:
    """Move the cells in the relabel CSV. Check every row before any file moves."""
    wanted: dict[str, str] = {}
    with relabels.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not {"file", "new_label"} <= set(reader.fieldnames or ()):
            raise ValueError("relabel CSV needs the header file,new_label")
        for row in reader:
            line = reader.line_num
            if row["file"] is None or row["new_label"] is None:
                raise ValueError(f"line {line}: short row, needs file,new_label")
            name, label = row["file"].strip(), row["new_label"].strip()
            if not label:
                continue
            if name in wanted and wanted[name] != label:
                raise ValueError(f"{name}: two different labels ({wanted[name]}, {label})")
            wanted[name] = label
    return move_cells(cells_dir, wanted)
```

The module docstring stays. Note that the "two folders" check now runs after the CSV is parsed. The existing tests still pass, because every error case moves nothing.

In `ml/src/sudoku_ml/manifest.py`:

1. Add the import `from sudoku_ml.kind_log import current_kinds, read_log`.
2. Replace `write_cells_manifest` and the `__main__` block with:

```python
def _kind_column(cell_id: str, label: str, logged: str | None) -> str:
    if label == "empty":
        if logged is not None:
            raise ValueError(f"{cell_id[:16]}: an empty cell has the logged kind {logged}")
        return "none"
    if label == "unlabeled":
        return ""
    return logged or ""


def write_cells_manifest(cells_dir: Path, manifest: Path, log: Path | None = None) -> int:
    """Rewrite the manifest from the folders and the kind log. The folder is the digit label.

    Raises ValueError on an unknown folder, a misnamed file, a duplicate id, or a logged kind
    on an empty cell.
    """
    kinds = current_kinds(read_log(log)) if log else {}
    for folder in cells_dir.iterdir():
        if folder.is_dir() and folder.name not in LABELS:
            raise ValueError(f"{folder} is not a known label")
    rows = []
    seen: set[str] = set()
    for path in sorted(cells_dir.glob("*/*.png")):
        cell_id = pixel_id(path)
        if path.stem != cell_id[:16]:
            raise ValueError(f"{path} is not named after its pixels ({cell_id[:16]})")
        if cell_id in seen:
            raise ValueError(f"{path} has the same pixels as another cell ({cell_id[:16]})")
        seen.add(cell_id)
        label = path.parent.name
        rows.append([cell_id, label, _kind_column(cell_id, label, kinds.get(cell_id))])
    rows.sort(key=lambda row: (row[1], row[0]))
    with manifest.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "label", "kind"])
        writer.writerows(rows)
    return len(rows)


if __name__ == "__main__":
    ml_root = Path(__file__).parents[2]
    datasets = ml_root / "datasets"
    print(
        write_cells_manifest(
            ml_root / "data" / "cells", datasets / "cells.csv", datasets / "kind-log.jsonl"
        )
    )
```

Change the module docstring to `"""Write ml/datasets/cells.csv from the folders in ml/data/cells/ and the kind log (ADR-009)."""`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest tests/test_relabel.py tests/test_manifest.py tests/test_suspects.py -q`
Expected: all pass.

- [ ] **Step 5: Regenerate the real manifest**

Run: `ln -s ~/projects/sudoku/ml/data ml/data && just dataset-manifest`
Expected: it prints 16277. `head -2 ml/datasets/cells.csv` shows the header `id,label,kind` and a first row that ends with `,none` (the `empty/` rows sort first). The `ml/data` symlink is git-ignored, because `.gitignore` lists `ml/data/`. Check with `/usr/bin/git status --short`: it must not list `ml/data`.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add ml/src/sudoku_ml/relabel.py ml/src/sudoku_ml/manifest.py ml/tests/test_relabel.py ml/tests/test_manifest.py ml/datasets/cells.csv
/usr/bin/git commit -m "feat(ml): add the kind column to the cells manifest (#30)"
```

---

### Task 3: Training reads the kind

**Files:**
- Modify: `ml/src/sudoku_ml/dataset.py`
- Modify: `ml/src/sudoku_ml/train.py` (the `load_cells` call only)
- Modify: `ml/src/sudoku_ml/suspects.py` (the `paths` and `load_cells` lines only)
- Test: `ml/tests/test_dataset.py`

**Interfaces:**
- Consumes: the `kind` column of `cells.csv` (Task 2).
- Produces:
  - `dataset.cell_paths(cells_dir: Path) -> list[Path]` (the labelled cell files, in `load_cells` order)
  - `dataset.read_ids(manifest: Path) -> dict[str, str]` (file stem → full id)
  - `dataset.read_kinds(manifest: Path) -> dict[str, str]` (file stem → kind column)
  - `dataset.load_cells(cells_dir: Path, manifest: Path | None = None) -> list[Sample]`

- [ ] **Step 1: Write the failing tests**

Append to `ml/tests/test_dataset.py`:

```python
from sudoku_ml.dataset import cell_paths, read_ids, read_kinds


def write_manifest(path: Path, rows: list[tuple[str, str, str]]) -> None:
    path.write_text("id,label,kind\n" + "".join(f"{i},{lab},{k}\n" for i, lab, k in rows))


def test_kinds_come_from_the_manifest(tmp_path: Path):
    cells = cell_tree(tmp_path)
    three, seven = f"{10:016x}", f"{30:016x}"
    manifest = tmp_path / "cells.csv"
    write_manifest(manifest, [(three + "0" * 48, "3", "handwritten"), (seven + "0" * 48, "7", "unsure")])
    kinds = {s.digit: s.kind for s in load_cells(cells, manifest)}
    assert kinds == {0: kind_index("none"), 3: kind_index("handwritten"), 7: UNKNOWN_KIND}


def test_a_digit_cell_missing_from_the_manifest_has_no_kind(tmp_path: Path):
    cells = cell_tree(tmp_path)
    manifest = tmp_path / "cells.csv"
    write_manifest(manifest, [])
    assert {s.digit: s.kind for s in load_cells(cells, manifest)}[3] == UNKNOWN_KIND


def test_ids_and_kinds_are_keyed_by_the_file_stem(tmp_path: Path):
    manifest = tmp_path / "cells.csv"
    write_manifest(manifest, [("ab" * 32, "3", "printed")])
    assert read_ids(manifest) == {"ab" * 8: "ab" * 32}
    assert read_kinds(manifest) == {"ab" * 8: "printed"}


def test_cell_paths_follow_the_load_order(tmp_path: Path):
    cells = cell_tree(tmp_path)
    assert [p.parent.name for p in cell_paths(cells)] == ["empty", "3", "7"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_dataset.py -q`
Expected: FAIL with `ImportError: cannot import name 'cell_paths'`.

- [ ] **Step 3: Write the implementation**

In `ml/src/sudoku_ml/dataset.py`, add `import csv` to the imports. Replace `load_cells` with:

```python
def cell_paths(cells_dir: Path) -> list[Path]:
    """The labelled cell files, in the order load_cells returns them. Never `unlabeled/`."""
    return [p for label in DIGIT_CLASSES for p in sorted((cells_dir / label).glob("*.png"))]


def _manifest_column(manifest: Path, column: str) -> dict[str, str]:
    with manifest.open(newline="") as handle:
        return {row["id"][:16]: row.get(column) or "" for row in csv.DictReader(handle)}


def read_ids(manifest: Path) -> dict[str, str]:
    """File stem → full cell id, from cells.csv."""
    with manifest.open(newline="") as handle:
        return {row["id"][:16]: row["id"] for row in csv.DictReader(handle)}


def read_kinds(manifest: Path) -> dict[str, str]:
    """File stem → the kind column of cells.csv."""
    return _manifest_column(manifest, "kind")


_DIGIT_KIND_TARGETS = {k: kind_index(k) for k in ("printed", "handwritten")}


def load_cells(cells_dir: Path, manifest: Path | None = None) -> list[Sample]:
    """The labelled real cells. An empty cell gets `none`. A digit cell gets its kind from the
    manifest, or UNKNOWN_KIND for `unsure`, blank or no manifest."""
    kinds = read_kinds(manifest) if manifest is not None and manifest.exists() else {}
    samples = []
    for path in cell_paths(cells_dir):
        label = path.parent.name
        image = to_cell_image(np.asarray(Image.open(path).convert("RGB")))
        if label == "empty":
            kind = kind_index("none")
        else:
            kind = _DIGIT_KIND_TARGETS.get(kinds.get(path.stem, ""), UNKNOWN_KIND)
        samples.append(Sample(image, digit_index(label), kind))
    return samples
```

In `ml/src/sudoku_ml/train.py`, change `real = load_cells(cells_dir)` to:

```python
        real = load_cells(cells_dir, ml_root / "datasets" / "cells.csv")
```

In `ml/src/sudoku_ml/suspects.py`, in `find_suspects`, change the `paths = …` and `samples = …` lines to:

```python
    paths = cell_paths(cells_dir)
    samples = load_cells(cells_dir, ml_root / "datasets" / "cells.csv")
```

and change the import to `from sudoku_ml.dataset import cell_paths, group_ids, load_cells, stack`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest -q`
Expected: all pass, including `test_train.py`.

- [ ] **Step 5: Lint and commit**

Run: `just lint-ml`
Expected: no findings.

```bash
/usr/bin/git add ml/src/sudoku_ml/dataset.py ml/src/sudoku_ml/train.py ml/src/sudoku_ml/suspects.py ml/tests/test_dataset.py
/usr/bin/git commit -m "feat(ml): train the kind head on labelled real cells (#30)"
```

---

### Task 4: Grouping

**Files:**
- Create: `ml/src/sudoku_ml/grouping.py`
- Modify: `justfile`
- Test: `ml/tests/test_grouping.py`

**Interfaces:**
- Consumes: `dataset.read_ids` (Task 3), `model.CellClassifier`, `preprocess.preprocess_cell`, `preprocess.to_cell_image`, `preprocess.BT601`.
- Produces:
  - `ink_colour(image: np.ndarray) -> np.ndarray` ((64, 64, 3) uint8 → (2,) float32)
  - `features(model: CellClassifier, images: np.ndarray) -> np.ndarray` ((N, 64, 64, 3) → (N, 66))
  - `kmeans(x: np.ndarray, k: int, seed: int, iters: int = 100) -> tuple[np.ndarray, np.ndarray]`
  - `sureness(x, centres, labels) -> np.ndarray`
  - `group_folder(ids: list[str], x: np.ndarray, k: int, seed: int) -> list[dict]` (each `{"cells": [id…], "sureness": [float…]}`, least sure first, largest group first)
  - `write_groups(ml_root: Path, run: Path, out: Path, k: int = 30, seed: int = 0) -> int`
  - `groups.json`: `{"run": str, "seed": int, "k": int, "folders": {"1": [group…], …}}`

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_grouping.py`:

```python
import json
from pathlib import Path

import numpy as np
import pytest
import torch
from PIL import Image

from sudoku_ml.grouping import features, group_folder, ink_colour, kmeans, write_groups
from sudoku_ml.manifest import pixel_id, write_cells_manifest
from sudoku_ml.model import CellClassifier


def cell(ink: tuple[int, int, int]) -> np.ndarray:
    image = np.full((64, 64, 3), 230, np.uint8)
    image[22:42, 22:42] = ink
    return image


def test_ink_colour_sees_red_and_blue_pen():
    red, blue, black = (ink_colour(cell(c)) for c in ((200, 30, 30), (30, 30, 200), (20, 20, 20)))
    assert red[1] > 1.0 and red[0] < 0
    assert blue[0] > 1.0 and blue[1] < 0
    assert np.all(np.abs(black) < 0.01)


def test_features_are_unit_length_plus_the_weighted_ink_colour():
    torch.manual_seed(0)
    images = np.stack([cell((200, 30, 30)), cell((20, 20, 20))])
    result = features(CellClassifier(), images)
    assert result.shape == (2, 66)
    assert np.allclose(np.linalg.norm(result[:, :64], axis=1), 1, atol=1e-4)
    assert np.allclose(result[0, 64:], 0.5 * ink_colour(images[0]))


def test_kmeans_is_deterministic_and_finds_clear_clusters():
    rng = np.random.default_rng(0)
    x = np.vstack([rng.normal(0, 0.1, (20, 3)), rng.normal(5, 0.1, (20, 3))]).astype(np.float32)
    a, _ = kmeans(x, 2, seed=0)
    b, _ = kmeans(x, 2, seed=0)
    assert np.array_equal(a, b)
    assert len(set(a[:20])) == 1 and len(set(a[20:])) == 1 and a[0] != a[20]


def test_k_never_exceeds_the_number_of_cells():
    _, centres = kmeans(np.arange(6, dtype=np.float32).reshape(3, 2), 30, seed=0)
    assert centres.shape[0] == 3


def test_the_least_sure_cell_comes_first_and_the_largest_group_first():
    x = np.array([[0, 0], [0.1, 0], [2.4, 0], [5, 0], [5.1, 0]], np.float32)
    groups = group_folder(list("abcde"), x, k=2, seed=0)
    assert groups[0]["cells"][0] == "c"
    assert sorted(groups[0]["cells"]) == ["a", "b", "c"]
    assert groups[0]["sureness"] == sorted(groups[0]["sureness"])


def ml_tree(tmp_path: Path, colours: dict[str, list[int]]) -> Path:
    cells = tmp_path / "data" / "cells"
    for folder, values in colours.items():
        (cells / folder).mkdir(parents=True)
        for value in values:
            tmp = cells / "tmp.png"
            Image.new("RGB", (71, 71), (value, 255 - value, 128)).save(tmp)
            tmp.rename(cells / folder / f"{pixel_id(tmp)[:16]}.png")
    (tmp_path / "datasets").mkdir()
    write_cells_manifest(cells, tmp_path / "datasets" / "cells.csv")
    run = tmp_path / "artifacts" / "run-1"
    run.mkdir(parents=True)
    torch.manual_seed(0)
    torch.save(CellClassifier().state_dict(), run / "model.pt")
    return run


def test_write_groups_covers_every_digit_cell(tmp_path: Path):
    run = ml_tree(tmp_path, {"7": [10, 20, 30], "empty": [200]})
    out = tmp_path / "data" / "groups.json"
    assert write_groups(tmp_path, run, out, k=30, seed=0) == 3
    groups = json.loads(out.read_text())
    assert groups["run"] == "run-1" and list(groups["folders"]) == ["7"]
    assert sum(len(g["cells"]) for g in groups["folders"]["7"]) == 3


def test_write_groups_refuses_cells_missing_from_the_manifest(tmp_path: Path):
    run = ml_tree(tmp_path, {"7": [10]})
    Image.new("RGB", (71, 71), (1, 2, 3)).save(tmp_path / "data" / "cells" / "7" / ("f" * 16 + ".png"))
    with pytest.raises(ValueError, match="just dataset-manifest"):
        write_groups(tmp_path, run, tmp_path / "groups.json")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_grouping.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'sudoku_ml.grouping'`.

- [ ] **Step 3: Write the implementation**

`ml/src/sudoku_ml/grouping.py`:

```python
"""Groups of similar cells per digit folder, for the labelling page. Writes ml/data/groups.json."""

import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.dataset import read_ids
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import BT601, preprocess_cell, to_cell_image

DIGIT_FOLDERS = tuple(str(d) for d in range(1, 10))
# The model sees grayscale. Pen colour separates handwriting from print in most real cells.
COLOUR_WEIGHT = 0.5
_LUMA = np.array(BT601, dtype=np.float32)


def ink_colour(image: np.ndarray) -> np.ndarray:
    """(64, 64, 3) uint8 → (2,): blue minus luma and red minus luma of the darkest 10 % of the
    inner pixels, divided by 64."""
    inner = image[8:56, 8:56].reshape(-1, 3).astype(np.float32)
    luma = inner @ _LUMA
    ink = inner[luma <= np.quantile(luma, 0.1)]
    ink_luma = ink @ _LUMA
    blue, red = (ink[:, 2] - ink_luma).mean(), (ink[:, 0] - ink_luma).mean()
    return np.array([blue, red], dtype=np.float32) / 64.0


def features(model: CellClassifier, images: np.ndarray) -> np.ndarray:
    """(N, 64, 64, 3) uint8 → (N, 66): the model's features at unit length, then the weighted
    ink colour."""
    inputs = torch.from_numpy(np.stack([preprocess_cell(im) for im in images]))[:, None]
    model.eval()
    with torch.no_grad():
        parts = [model.features(inputs[s : s + 1024]) for s in range(0, len(inputs), 1024)]
    feats = torch.cat(parts).numpy()
    feats /= np.linalg.norm(feats, axis=1, keepdims=True) + 1e-8
    colour = np.stack([ink_colour(im) for im in images]) * COLOUR_WEIGHT
    return np.hstack([feats, colour]).astype(np.float32)


def _distances(x: np.ndarray, centres: np.ndarray) -> np.ndarray:
    return ((x[:, None, :] - centres[None]) ** 2).sum(2)


def kmeans(x: np.ndarray, k: int, seed: int, iters: int = 100) -> tuple[np.ndarray, np.ndarray]:
    """Labels (N,) and centres (at most k, D). k-means++ start. Same input and seed, same result."""
    rng = np.random.default_rng(seed)
    centres = [x[rng.integers(len(x))]]
    for _ in range(min(k, len(x)) - 1):
        d = _distances(x, np.stack(centres)).min(1)
        if d.sum() == 0:
            break
        centres.append(x[rng.choice(len(x), p=d / d.sum())])
    c = np.stack(centres)
    for _ in range(iters):
        labels = _distances(x, c).argmin(1)
        new = np.stack(
            [x[labels == j].mean(0) if (labels == j).any() else c[j] for j in range(len(c))]
        )
        if np.allclose(new, c):
            break
        c = new
    return _distances(x, c).argmin(1), c


def sureness(x: np.ndarray, centres: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """Distance to the next centre minus distance to the own centre. Small: not sure."""
    if len(centres) < 2:
        return np.zeros(len(x), dtype=np.float32)
    d = np.sqrt(_distances(x, centres))
    own = d[np.arange(len(x)), labels]
    other = np.where(np.arange(len(centres))[None] == labels[:, None], np.inf, d).min(1)
    return other - own


def group_folder(ids: list[str], x: np.ndarray, k: int, seed: int) -> list[dict]:
    labels, centres = kmeans(x, k, seed)
    sure = sureness(x, centres, labels)
    groups = []
    for j in range(len(centres)):
        members = np.flatnonzero(labels == j)
        if len(members) == 0:
            continue
        order = members[np.argsort(sure[members], kind="stable")]
        groups.append(
            {
                "cells": [ids[i] for i in order],
                "sureness": [round(float(sure[i]), 4) for i in order],
            }
        )
    groups.sort(key=lambda g: -len(g["cells"]))
    return groups


def write_groups(ml_root: Path, run: Path, out: Path, k: int = 30, seed: int = 0) -> int:
    """Group every digit folder with the model of `run`. Returns the number of grouped cells."""
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt", map_location="cpu"))
    ids = read_ids(ml_root / "datasets" / "cells.csv")
    cells_dir = ml_root / "data" / "cells"
    folders: dict[str, list[dict]] = {}
    for folder in DIGIT_FOLDERS:
        paths = sorted((cells_dir / folder).glob("*.png"))
        if not paths:
            continue
        missing = [p.stem for p in paths if p.stem not in ids]
        if missing:
            raise ValueError(
                f"{len(missing)} cells are not in cells.csv, e.g. {missing[0]}. "
                "Run: just dataset-manifest"
            )
        images = np.stack([to_cell_image(np.asarray(Image.open(p).convert("RGB"))) for p in paths])
        folders[folder] = group_folder([ids[p.stem] for p in paths], features(model, images), k, seed)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"run": run.name, "seed": seed, "k": k, "folders": folders}))
    return sum(len(g["cells"]) for groups in folders.values() for g in groups)


def default_run(ml_root: Path) -> Path:
    """The run of the model that the app uses."""
    manifest = ml_root.parent / "apps" / "mobile" / "assets" / "models" / "manifest.json"
    return ml_root / "artifacts" / json.loads(manifest.read_text())["run"]


if __name__ == "__main__":
    root = Path(__file__).parents[2]
    chosen = root / sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else default_run(root)
    print(write_groups(root, chosen, root / "data" / "groups.json"))
```

Append to `justfile`:

```make
# Group the cells of each digit folder for the labelling page. The run path is relative to ml/
group-cells run="":
    uv run --directory ml python -m sudoku_ml.grouping {{run}}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest tests/test_grouping.py -q`
Expected: 7 passed.

- [ ] **Step 5: Lint and commit**

Run: `just lint-ml`
Expected: no findings.

```bash
/usr/bin/git add ml/src/sudoku_ml/grouping.py ml/tests/test_grouping.py justfile
/usr/bin/git commit -m "feat(ml): group similar cells per digit folder (#30)"
```

---

### Task 5: Suspects rank the kind too

**Files:**
- Modify: `ml/src/sudoku_ml/suspects.py`
- Modify: `justfile` (the `suspects` comment)
- Test: `ml/tests/test_suspects.py`

**Interfaces:**
- Consumes: kind targets from `load_cells(…, manifest)` (Task 3).
- Produces:
  - `FIELDS = ["field", "file", "label", "predicted", "p_label", "p_predicted"]`
  - `rank_suspects(names, labels, probs, top) -> list[dict]` (rows now start with `"field": "digit"`)
  - `rank_kind_suspects(names, kinds: list[int], probs: np.ndarray, threshold: float = KIND_THRESHOLD) -> list[dict]`
  - `write_suspects(rows: list[dict], path: Path) -> None`
  - `ml/data/review/suspects.csv` with the `FIELDS` columns. No sheets, no `relabels.csv`.

- [ ] **Step 1: Rewrite the tests**

Replace `ml/tests/test_suspects.py` with:

```python
from pathlib import Path

import numpy as np

from sudoku_ml.contract import UNKNOWN_KIND, kind_index
from sudoku_ml.suspects import FIELDS, rank_kind_suspects, rank_suspects, write_suspects

P, H = kind_index("printed"), kind_index("handwritten")


def test_lowest_probability_for_the_label_comes_first():
    probs = np.array([[0.1, 0.9], [0.95, 0.05], [0.5, 0.5]])
    rows = rank_suspects(["a", "b", "c"], [1, 1, 0], probs, top=2)
    assert [r["file"] for r in rows] == ["b", "c"]
    assert rows[0]["field"] == "digit"
    assert rows[0]["predicted"] == "empty" and rows[0]["label"] == "1"
    assert rows[0]["p_label"] == 0.05


def test_top_limits_the_rows():
    probs = np.full((10, 10), 0.1)
    assert len(rank_suspects([str(i) for i in range(10)], [0] * 10, probs, top=3)) == 3


def test_kind_suspects_are_labelled_cells_below_the_threshold():
    probs = np.array(
        [[0, 0.95, 0.05, 0], [0, 0.02, 0.98, 0], [0.9, 0.05, 0.05, 0], [0, 0.5, 0.5, 0]]
    )
    rows = rank_kind_suspects(["a", "b", "c", "d"], [P, P, UNKNOWN_KIND, H], probs, threshold=0.10)
    assert rows == [
        {
            "field": "kind",
            "file": "b",
            "label": "printed",
            "predicted": "handwritten",
            "p_label": 0.02,
            "p_predicted": 0.98,
        }
    ]


def test_the_none_kind_of_empty_cells_is_never_a_suspect():
    probs = np.array([[0.01, 0.99, 0, 0]])
    assert rank_kind_suspects(["a"], [kind_index("none")], probs) == []


def test_write_suspects_writes_the_header_without_rows(tmp_path: Path):
    path = tmp_path / "suspects.csv"
    write_suspects([], path)
    assert path.read_text().splitlines() == [",".join(FIELDS)]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_suspects.py -q`
Expected: FAIL with `ImportError: cannot import name 'FIELDS'`.

- [ ] **Step 3: Write the implementation**

In `ml/src/sudoku_ml/suspects.py`:

1. Delete `refuse_reviewed`, `write_relabels` and `_sheets`. Delete the `from PIL import Image, ImageDraw` import.
2. Change the imports to:

```python
from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES, kind_index
```

3. Add after the imports:

```python
FIELDS = ["field", "file", "label", "predicted", "p_label", "p_predicted"]
KIND_THRESHOLD = 0.10
_LABELLED_KINDS = (kind_index("printed"), kind_index("handwritten"))
```

4. In `rank_suspects`, add `"field": "digit",` as the first key of each row.
5. Add:

```python
def rank_kind_suspects(
    names, kinds: list[int], probs: np.ndarray, threshold: float = KIND_THRESHOLD
) -> list[dict]:
    """Cells labelled printed or handwritten whose held-out probability for that kind is below
    the threshold, lowest first."""
    rows = [
        {
            "field": "kind",
            "file": names[i],
            "label": KIND_CLASSES[k],
            "predicted": KIND_CLASSES[int(probs[i].argmax())],
            "p_label": round(float(probs[i, k]), 4),
            "p_predicted": round(float(probs[i].max()), 4),
        }
        for i, k in enumerate(kinds)
        if k in _LABELLED_KINDS and probs[i, k] < threshold
    ]
    return sorted(rows, key=lambda r: r["p_label"])


def write_suspects(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
```

6. Replace `find_suspects` with:

```python
def find_suspects(ml_root: Path, folds: int = 5, epochs: int = 12, top: int = 150) -> Path:
    """Rank digit and kind suspects with cross-validation. Writes ml/data/review/suspects.csv."""
    cells_dir = ml_root / "data" / "cells"
    paths = cell_paths(cells_dir)
    samples = load_cells(cells_dir, ml_root / "datasets" / "cells.csv")
    if len(paths) != len(samples):
        raise ValueError(f"{len(paths)} files but {len(samples)} cells")
    images, digit, kind = stack(samples)
    groups = group_ids(samples)
    unique = np.random.default_rng(0).permutation(np.unique(groups))
    fold_of = {g: i % folds for i, g in enumerate(unique)}
    fold = np.array([fold_of[g] for g in groups])
    device, generator = _device(), torch.Generator().manual_seed(0)
    digit_probs = np.zeros((len(samples), len(DIGIT_CLASSES)), dtype=np.float32)
    kind_probs = np.zeros((len(samples), len(KIND_CLASSES)), dtype=np.float32)
    for f in range(folds):
        train_idx = torch.from_numpy(np.nonzero(fold != f)[0])
        held = torch.from_numpy(np.nonzero(fold == f)[0])
        model = _fit(
            images[train_idx], digit[train_idx], kind[train_idx], epochs, device, generator
        )
        digit_logits, kind_logits = _logits(model, images[held], device)
        digit_probs[held.numpy()] = digit_logits.softmax(1).numpy()
        kind_probs[held.numpy()] = kind_logits.softmax(1).numpy()
    names = [p.stem for p in paths]
    rows = rank_suspects(names, digit.tolist(), digit_probs, top)
    rows += rank_kind_suspects(names, kind.tolist(), kind_probs)
    out = ml_root / "data" / "review" / "suspects.csv"
    write_suspects(rows, out)
    return out
```

7. Change the module docstring to `"""Find cells whose digit or kind label is probably wrong (cross-validated ranking, R-13)."""`.

In `justfile`, change the comment above `suspects:` to:

```make
# Rank the likely wrong digit and kind labels into ml/data/review/suspects.csv, for the Review screen
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest -q`
Expected: all pass.

- [ ] **Step 5: Lint and commit**

Run: `just lint-ml`
Expected: no findings.

```bash
/usr/bin/git add ml/src/sudoku_ml/suspects.py ml/tests/test_suspects.py justfile
/usr/bin/git commit -m "feat(ml): rank kind suspects next to digit suspects (#30)"
```

---

### Task 6: The blind check

**Files:**
- Create: `ml/src/sudoku_ml/kind_check.py`
- Test: `ml/tests/test_kind_check.py`

**Interfaces:**
- Consumes: `kind_log.Line`, `current_kinds`, `last_kind_times`, `parse_time` (Task 1).
- Produces:
  - `@dataclass(frozen=True) class CheckLine: t: str; session: str; cell: str; label: str; answer: str`
  - `class NotEnoughCells(ValueError)` with the attribute `count: int`
  - `MIN_AGE = timedelta(days=7)`
  - `draw_sample(lines, checks, test_ids: set[str], now: datetime, n: int = 200, seed: int = 0, min_age: timedelta = MIN_AGE) -> list[str]`
  - `summary(checks: list[CheckLine]) -> dict | None` (`{"n", "agreement", "confusion", "date"}` for the newest session)

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_kind_check.py`:

```python
from datetime import timedelta

import pytest

from sudoku_ml.kind_check import CheckLine, NotEnoughCells, draw_sample, summary
from sudoku_ml.kind_log import Line, parse_time

OLD, NEW = "2026-10-01T09:00:00Z", "2026-10-10T09:00:00Z"
NOW = parse_time("2026-10-11T09:00:00Z")


def ids(n: int, start: int = 0) -> list[str]:
    return [f"{i:064x}" for i in range(start, start + n)]


def labelled(cells: list[str], t: str = OLD, kind: str = "printed") -> list[Line]:
    return [Line(t, "s", f"s-{i}", c, "kind", None, kind, "groups") for i, c in enumerate(cells)]


def test_only_labels_seven_days_old_or_older_qualify():
    old, new = ids(10), ids(10, start=100)
    sample = draw_sample(labelled(old) + labelled(new, NEW), [], set(), NOW, n=10)
    assert sorted(sample) == old


def test_unsure_and_unlabelled_cells_never_qualify():
    cells = ids(4)
    lines = labelled(cells[:2]) + labelled(cells[2:3], kind="unsure")
    with pytest.raises(NotEnoughCells) as error:
        draw_sample(lines, [], set(), NOW, n=3)
    assert error.value.count == 2


def test_half_of_the_sample_comes_from_the_test_split():
    test, other = ids(50), ids(50, start=100)
    sample = draw_sample(labelled(test + other), [], set(test), NOW, n=20)
    assert len(set(sample) & set(test)) == 10


def test_a_small_test_split_is_filled_from_the_other_cells():
    test, other = ids(3), ids(50, start=100)
    sample = draw_sample(labelled(test + other), [], set(test), NOW, n=20)
    assert len(sample) == 20 and set(test) <= set(sample)


def test_checked_cells_are_not_drawn_again():
    cells = ids(12)
    checks = [CheckLine(OLD, "c", c, "printed", "printed") for c in cells[:2]]
    sample = draw_sample(labelled(cells), checks, set(), NOW, n=10)
    assert not set(sample) & set(cells[:2])


def test_the_draw_is_deterministic():
    lines = labelled(ids(40))
    assert draw_sample(lines, [], set(), NOW, n=10) == draw_sample(lines, [], set(), NOW, n=10)


def test_min_age_is_configurable():
    lines = labelled(ids(5), NEW)
    assert len(draw_sample(lines, [], set(), NOW, n=5, min_age=timedelta(hours=1))) == 5


def test_summary_covers_the_newest_session_only():
    checks = [
        CheckLine(OLD, "c1", "x", "printed", "handwritten"),
        CheckLine(NEW, "c2", "a", "printed", "printed"),
        CheckLine(NEW, "c2", "b", "printed", "handwritten"),
        CheckLine(NEW, "c2", "c", "handwritten", "handwritten"),
        CheckLine(NEW, "c2", "d", "handwritten", "handwritten"),
    ]
    assert summary(checks) == {
        "n": 4,
        "agreement": 0.75,
        "confusion": {"printed": {"printed": 1, "handwritten": 1}, "handwritten": {"handwritten": 2}},
        "date": "2026-10-10",
    }
    assert summary([]) is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_kind_check.py -q`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the implementation**

`ml/src/sudoku_ml/kind_check.py`:

```python
"""The blind re-label: the developer labels old cells again. Agreement estimates label quality."""

from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

from sudoku_ml.kind_log import Line, current_kinds, last_kind_times, parse_time

# Long enough that the developer no longer remembers the first answer.
MIN_AGE = timedelta(days=7)
_CHECKABLE = ("printed", "handwritten")


@dataclass(frozen=True)
class CheckLine:
    t: str
    session: str
    cell: str
    label: str  # the kind in the log when the check ran
    answer: str  # printed, handwritten or unsure


class NotEnoughCells(ValueError):
    def __init__(self, count: int, needed: int):
        super().__init__(f"only {count} cells qualify, the check needs {needed}")
        self.count = count


def draw_sample(
    lines: list[Line],
    checks: list[CheckLine],
    test_ids: set[str],
    now: datetime,
    n: int = 200,
    seed: int = 0,
    min_age: timedelta = MIN_AGE,
) -> list[str]:
    """n cell ids, half from the test split when it has enough. Raises NotEnoughCells."""
    kinds, times = current_kinds(lines), last_kind_times(lines)
    checked = {c.cell for c in checks}
    cutoff = now - min_age
    eligible = sorted(
        cell
        for cell, kind in kinds.items()
        if kind in _CHECKABLE and parse_time(times[cell]) <= cutoff and cell not in checked
    )
    if len(eligible) < n:
        raise NotEnoughCells(len(eligible), n)
    test = [c for c in eligible if c in test_ids]
    rest = [c for c in eligible if c not in test_ids]
    n_rest = min(n - min(n // 2, len(test)), len(rest))
    n_test = n - n_rest
    rng = np.random.default_rng(seed)
    picked = [str(c) for c in rng.choice(np.array(test, dtype=object), n_test, replace=False)]
    picked += [str(c) for c in rng.choice(np.array(rest, dtype=object), n_rest, replace=False)]
    return [picked[i] for i in rng.permutation(len(picked))]


def summary(checks: list[CheckLine]) -> dict | None:
    """Agreement and confusion of the newest check session. None before the first check."""
    if not checks:
        return None
    newest = [c for c in checks if c.session == checks[-1].session]
    confusion: dict[str, dict[str, int]] = {}
    for c in newest:
        row = confusion.setdefault(c.label, {})
        row[c.answer] = row.get(c.answer, 0) + 1
    agree = sum(c.label == c.answer for c in newest)
    return {
        "n": len(newest),
        "agreement": round(agree / len(newest), 4),
        "confusion": confusion,
        "date": newest[-1].t[:10],
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest tests/test_kind_check.py -q`
Expected: 8 passed.

- [ ] **Step 5: Lint and commit**

Run: `just lint-ml`

```bash
/usr/bin/git add ml/src/sudoku_ml/kind_check.py ml/tests/test_kind_check.py
/usr/bin/git commit -m "feat(ml): draw and score the blind kind check (#30)"
```

---

### Task 7: Review items

**Files:**
- Create: `ml/src/sudoku_ml/kind_review.py`
- Test: `ml/tests/test_kind_review.py`

**Interfaces:**
- Consumes: `kind_log` (Task 1), `kind_check.CheckLine` (Task 6), `suspects.csv` with `FIELDS` (Task 5).
- Produces:
  - `@dataclass(frozen=True) class ReviewItem: cell: str; field: str; reason: str; evidence: dict; since: str`
  - `reason` is `"near-duplicate"`, `"kind-model"`, `"digit-model"` or `"check"`.
  - `Current = Callable[[str, str], str | None]` ((cell id, field) → the current kind or digit folder)
  - `near_duplicate_items(dup_group: dict[str, int], lines: list[Line]) -> list[ReviewItem]`
  - `model_items(suspects_csv: Path, stem_to_id: dict[str, str], current: Current) -> list[ReviewItem]`
  - `check_items(checks: list[CheckLine], current: Current) -> list[ReviewItem]`
  - `open_items(items: list[ReviewItem], lines: list[Line]) -> list[ReviewItem]`

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_kind_review.py`:

```python
import os
from pathlib import Path

from sudoku_ml.kind_check import CheckLine
from sudoku_ml.kind_log import Line, parse_time
from sudoku_ml.kind_review import check_items, model_items, near_duplicate_items, open_items

A, B, C = "a" * 64, "b" * 64, "c" * 64


def kind(second: int, cell: str, new: str, screen: str = "groups", old=None) -> Line:
    return Line(f"2026-10-12T09:00:{second:02d}Z", "s", f"s-{second}", cell, "kind", old, new, screen)


def test_near_duplicates_with_different_kinds_both_go_to_review():
    lines = [kind(1, A, "printed"), kind(2, B, "handwritten"), kind(3, C, "printed")]
    items = near_duplicate_items({A: 1, B: 1, C: 2}, lines)
    assert sorted(i.cell for i in items) == [A, B]
    assert items[0].since == "2026-10-12T09:00:02Z"
    assert items[0].evidence["group"] == [A, B]


def test_unsure_does_not_count_as_a_disagreement():
    lines = [kind(1, A, "printed"), kind(2, B, "unsure")]
    assert near_duplicate_items({A: 1, B: 1}, lines) == []


def test_a_review_line_after_the_evidence_closes_the_item():
    lines = [kind(1, A, "printed"), kind(2, B, "handwritten")]
    items = near_duplicate_items({A: 1, B: 1}, lines)
    lines += [kind(5, A, "printed", "review", "printed")]
    assert [i.cell for i in open_items(items, lines)] == [B]


def test_a_review_line_before_the_evidence_does_not_close_the_item():
    lines = [kind(1, A, "printed", "review"), kind(2, A, "printed"), kind(3, B, "handwritten")]
    items = near_duplicate_items({A: 1, B: 1}, lines)
    assert len(open_items(items, lines)) == 2


def write_suspects(path: Path, rows: list[str]) -> None:
    path.write_text("field,file,label,predicted,p_label,p_predicted\n" + "".join(r + "\n" for r in rows))
    moment = parse_time("2026-10-12T08:00:00Z").timestamp()
    os.utime(path, (moment, moment))


def test_model_items_come_from_the_suspects_file(tmp_path: Path):
    path = tmp_path / "suspects.csv"
    write_suspects(path, [f"digit,{A[:16]},7,1,0.01,0.97", f"kind,{B[:16]},printed,handwritten,0.03,0.97"])
    current = {(A, "digit"): "7", (B, "kind"): "printed"}
    items = model_items(path, {A[:16]: A, B[:16]: B}, lambda c, f: current.get((c, f)))
    assert [(i.cell, i.field, i.reason) for i in items] == [(A, "digit", "digit-model"), (B, "kind", "kind-model")]
    assert items[0].evidence == {"label": "7", "predicted": "1", "p_label": 0.01, "p_predicted": 0.97}
    assert items[0].since == "2026-10-12T08:00:00Z"


def test_a_stale_or_unknown_suspect_is_dropped(tmp_path: Path):
    path = tmp_path / "suspects.csv"
    write_suspects(path, [f"digit,{A[:16]},7,1,0.01,0.97", f"digit,{'f' * 16},7,1,0.01,0.97"])
    items = model_items(path, {A[:16]: A}, lambda c, f: "1")
    assert items == []


def test_no_suspects_file_means_no_items(tmp_path: Path):
    assert model_items(tmp_path / "none.csv", {}, lambda c, f: None) == []


def test_check_items_are_the_disagreements_that_still_hold():
    checks = [
        CheckLine("2026-10-12T09:00:00Z", "c", A, "printed", "handwritten"),
        CheckLine("2026-10-12T09:00:00Z", "c", B, "printed", "printed"),
        CheckLine("2026-10-12T09:00:00Z", "c", C, "printed", "unsure"),
    ]
    current = {A: "printed", B: "printed", C: "handwritten"}
    items = check_items(checks, lambda c, f: current[c])
    assert [(i.cell, i.evidence) for i in items] == [(A, {"label": "printed", "answer": "handwritten"})]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_kind_review.py -q`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the implementation**

`ml/src/sudoku_ml/kind_review.py`:

```python
"""Review items: cells whose label one of the checks doubts (guards 5, 6 and 7 of the spec)."""

import csv
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sudoku_ml.kind_check import CheckLine
from sudoku_ml.kind_log import Line, current_kinds, format_time

Current = Callable[[str, str], str | None]
_LABELLED = {"printed", "handwritten"}


@dataclass(frozen=True)
class ReviewItem:
    cell: str
    field: str  # "kind" or "digit"
    reason: str  # "near-duplicate", "kind-model", "digit-model" or "check"
    evidence: dict
    since: str  # time of the evidence. A review line at or after it closes the item


def near_duplicate_items(dup_group: dict[str, int], lines: list[Line]) -> list[ReviewItem]:
    kinds = current_kinds(lines)
    changed = {x.cell: x.t for x in lines if x.field == "kind" and x.screen != "review"}
    members: dict[int, list[str]] = defaultdict(list)
    for cell, group in dup_group.items():
        members[group].append(cell)
    items = []
    for cells in members.values():
        cells.sort()
        if len({kinds.get(c) for c in cells} & _LABELLED) < 2:
            continue
        since = max(changed.get(c, "") for c in cells)
        evidence = {"group": cells, "kinds": {c: kinds.get(c) for c in cells}}
        items += [ReviewItem(c, "kind", "near-duplicate", evidence, since) for c in cells]
    return items


def model_items(suspects_csv: Path, stem_to_id: dict[str, str], current: Current) -> list[ReviewItem]:
    """Rows of suspects.csv whose label still holds. The file time is the evidence time."""
    if not suspects_csv.exists():
        return []
    since = format_time(datetime.fromtimestamp(suspects_csv.stat().st_mtime, UTC))
    items = []
    with suspects_csv.open(newline="") as handle:
        for row in csv.DictReader(handle):
            cell = stem_to_id.get(row["file"])
            if cell is None or current(cell, row["field"]) != row["label"]:
                continue
            evidence = {
                "label": row["label"],
                "predicted": row["predicted"],
                "p_label": float(row["p_label"]),
                "p_predicted": float(row["p_predicted"]),
            }
            items.append(ReviewItem(cell, row["field"], f"{row['field']}-model", evidence, since))
    return items


def check_items(checks: list[CheckLine], current: Current) -> list[ReviewItem]:
    return [
        ReviewItem(c.cell, "kind", "check", {"label": c.label, "answer": c.answer}, c.t)
        for c in checks
        if c.answer != c.label and current(c.cell, "kind") == c.label
    ]


def open_items(items: list[ReviewItem], lines: list[Line]) -> list[ReviewItem]:
    reviewed: dict[tuple[str, str], str] = {}
    for x in lines:
        if x.screen == "review":
            reviewed[(x.cell, x.field)] = max(reviewed.get((x.cell, x.field), ""), x.t)
    return [i for i in items if reviewed.get((i.cell, i.field), "") < i.since]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest tests/test_kind_review.py -q`
Expected: 8 passed.

- [ ] **Step 5: Lint and commit**

Run: `just lint-ml`

```bash
/usr/bin/git add ml/src/sudoku_ml/kind_review.py ml/tests/test_kind_review.py
/usr/bin/git commit -m "feat(ml): collect Review items from the three checks (#30)"
```

---

### Task 8: The label store

**Files:**
- Create: `ml/src/sudoku_ml/label_store.py`
- Test: `ml/tests/test_label_store.py`

**Interfaces:**
- Consumes: `kind_log` (Task 1), `relabel.move_cells` (Task 2), `dataset.cell_paths`, `read_ids`, `group_ids`, `split_by_group` (Task 3), `kind_check` (Task 6), `kind_review` (Task 7).
- Produces:
  - `SCREEN_SIZE = 50`
  - `@dataclass(frozen=True) class Paths: cells, manifest, log, checks, groups, suspects, config` (all `Path`), with `Paths.under(ml_root: Path) -> Paths`
  - `class LabelStore(paths: Paths, now: Callable[[], datetime] = …)` with:
    - `session: str`
    - `cell_file(stem: str) -> Path`
    - `screen(folder: str, group: int, page: int) -> dict`
    - `next_screen(after: tuple[str, int, int] | None = None) -> dict | None`
    - `save(entries: list[dict], screen: str, confirm_digits: list[str] = ()) -> int`
    - `move(cell: str, digit: str, screen: str) -> None`
    - `undo() -> int`
    - `rollback(session: str) -> int`
    - `review_items() -> list[dict]`, `review_screen() -> dict`
    - `check_start(n: int = 200) -> dict`, `check_answer(answers: list[dict]) -> dict`
    - `progress() -> dict`, `label_state() -> dict`
  - The screen dict: `{"folder", "group", "groups", "page", "pages", "ungrouped", "cells": [{"id", "stem", "kind", "start", "least_sure"}], "progress": {"cells", "labelled"}}`
  - A Review item dict: `{"id", "stem", "field", "folder", "kind", "reasons": [{"reason", …evidence}]}`

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_label_store.py`:

```python
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from sudoku_ml.kind_log import read_log
from sudoku_ml.label_store import LabelStore, Paths
from sudoku_ml.manifest import pixel_id, write_cells_manifest

ML = Path(__file__).parents[1]


class Clock:
    def __init__(self):
        self.moment = datetime(2026, 10, 12, 9, 0, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.moment


def pattern(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.kron(rng.integers(0, 256, (8, 8, 3)), np.ones((8, 8, 1))).astype(np.uint8)


def add_cell(cells: Path, folder: str, image: np.ndarray) -> str:
    tmp = cells / "tmp.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(image).save(tmp)
    cell_id = pixel_id(tmp)
    (cells / folder).mkdir(exist_ok=True)
    tmp.rename(cells / folder / f"{cell_id[:16]}.png")
    return cell_id


def build(tmp_path: Path, folders: dict[str, int], groups: dict[str, list[list[int]]]):
    """folders: folder → number of cells. groups: folder → groups as indices into its cells."""
    cells = tmp_path / "data" / "cells"
    ids: dict[str, list[str]] = {}
    seed = 0
    for folder, count in folders.items():
        ids[folder] = []
        for _ in range(count):
            seed += 1
            ids[folder].append(add_cell(cells, folder, pattern(seed)))
    (tmp_path / "datasets").mkdir()
    write_cells_manifest(cells, tmp_path / "datasets" / "cells.csv")
    paths = Paths(
        cells,
        tmp_path / "datasets" / "cells.csv",
        tmp_path / "datasets" / "kind-log.jsonl",
        tmp_path / "datasets" / "kind-check.jsonl",
        tmp_path / "data" / "groups.json",
        tmp_path / "data" / "review" / "suspects.csv",
        ML / "configs" / "cell-classifier.toml",
    )
    folders_json = {
        f: [{"cells": [ids[f][i] for i in g], "sureness": [float(n) for n in range(len(g))]} for g in gs]
        for f, gs in groups.items()
    }
    paths.groups.write_text(json.dumps({"run": "test", "seed": 0, "k": 2, "folders": folders_json}))
    return paths, ids


def test_a_fresh_screen_has_no_start_kind(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 3}, {"7": [[0, 1, 2]]})
    screen = LabelStore(paths, Clock()).next_screen()
    assert screen["folder"] == "7" and screen["group"] == 0
    assert [c["id"] for c in screen["cells"]] == ids["7"]
    assert all(c["start"] is None for c in screen["cells"])
    assert screen["progress"] == {"cells": 3, "labelled": 0}


def test_unlabelled_cells_start_with_the_group_majority(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 4}, {"7": [[0, 1, 2, 3]]})
    store = LabelStore(paths, Clock())
    store.save([{"id": ids["7"][0], "kind": "handwritten"}, {"id": ids["7"][1], "kind": "handwritten"}, {"id": ids["7"][2], "kind": "printed"}], "groups")
    cells = store.screen("7", 0, 0)["cells"]
    assert cells[3]["start"] == "handwritten" and cells[3]["kind"] is None
    assert cells[2]["start"] == "printed"


def test_a_save_logs_only_changed_or_new_cells(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    store = LabelStore(paths, Clock())
    store.save([{"id": ids["7"][0], "kind": "printed"}], "groups")
    written = store.save([{"id": ids["7"][0], "kind": "printed"}, {"id": ids["7"][1], "kind": "unsure"}], "groups")
    assert written == 1
    assert [(x.cell, x.new) for x in read_log(paths.log)] == [(ids["7"][0], "printed"), (ids["7"][1], "unsure")]


def test_a_review_save_logs_confirmations_too(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    store = LabelStore(paths, Clock())
    store.save([{"id": ids["7"][0], "kind": "printed"}], "groups")
    assert store.save([{"id": ids["7"][0], "kind": "printed"}], "review", [ids["7"][0]]) == 2
    last = read_log(paths.log)[-2:]
    assert [(x.field, x.old, x.new, x.screen) for x in last] == [("kind", "printed", "printed", "review"), ("digit", "7", "7", "review")]


def test_a_save_refuses_a_bad_kind_or_an_empty_cell(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1, "empty": 1}, {"7": [[0]]})
    store = LabelStore(paths, Clock())
    with pytest.raises(ValueError, match="unknown kind"):
        store.save([{"id": ids["7"][0], "kind": "notes"}], "groups")
    with pytest.raises(ValueError, match="digit folder"):
        store.save([{"id": ids["empty"][0], "kind": "printed"}], "groups")
    assert read_log(paths.log) == []


def test_a_move_to_empty_moves_the_file_and_clears_the_kind_and_undo_restores_both(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    cell = ids["7"][0]
    store = LabelStore(paths, Clock())
    store.save([{"id": cell, "kind": "printed"}], "groups")
    store.move(cell, "empty", "groups")
    assert (paths.cells / "empty" / f"{cell[:16]}.png").exists()
    assert [c["id"] for c in store.screen("7", 0, 0)["cells"]] == [ids["7"][1]]
    assert store.undo() == 2
    assert (paths.cells / "7" / f"{cell[:16]}.png").exists()
    assert store.screen("7", 0, 0)["cells"][0]["kind"] == "printed"


def test_a_cell_moved_into_a_folder_shows_up_as_ungrouped(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1, "1": 1}, {"7": [[0]], "1": [[0]]})
    store = LabelStore(paths, Clock())
    store.move(ids["7"][0], "1", "groups")
    screen = store.screen("1", 1, 0)
    assert screen["ungrouped"] is True
    assert [c["id"] for c in screen["cells"]] == [ids["7"][0]]


def test_next_screen_skips_labelled_groups_and_wraps_around(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0], [1]]})
    store = LabelStore(paths, Clock())
    store.save([{"id": ids["7"][0], "kind": "printed"}], "groups")
    assert store.next_screen()["group"] == 1
    assert store.next_screen(("7", 1, 0))["group"] == 1
    store.save([{"id": ids["7"][1], "kind": "printed"}], "groups")
    assert store.next_screen() is None


def test_a_large_group_takes_several_screens(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 60}, {"7": [list(range(60))]})
    store = LabelStore(paths, Clock())
    first, second = store.screen("7", 0, 0), store.screen("7", 0, 1)
    assert (len(first["cells"]), len(second["cells"]), first["pages"]) == (50, 10, 2)
    assert sum(c["least_sure"] for c in first["cells"]) == 6


def test_the_store_refuses_cells_missing_from_the_manifest(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    add_cell(paths.cells, "7", pattern(999))
    with pytest.raises(ValueError, match="just dataset-manifest"):
        LabelStore(paths, Clock())


def test_review_merges_the_reasons_of_one_cell(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    cell = ids["7"][0]
    store = LabelStore(paths, Clock())
    store.save([{"id": cell, "kind": "printed"}], "groups")
    paths.suspects.parent.mkdir(parents=True)
    paths.suspects.write_text(
        "field,file,label,predicted,p_label,p_predicted\n"
        f"kind,{cell[:16]},printed,handwritten,0.02,0.98\n"
        f"digit,{cell[:16]},7,1,0.01,0.99\n"
    )
    items = store.review_items()
    assert [(i["field"], [r["reason"] for r in i["reasons"]]) for i in items] == [("kind", ["kind-model"]), ("digit", ["digit-model"])]


def test_check_start_says_why_it_cannot_start(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    assert "7 days" in LabelStore(paths, Clock()).check_start()["error"]


def test_check_answers_are_logged_and_summarised(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    clock = Clock()
    store = LabelStore(paths, clock)
    store.save([{"id": c, "kind": "printed"} for c in ids["7"]], "groups")
    clock.moment += timedelta(days=8)
    sample = store.check_start(n=2)["cells"]
    result = store.check_answer([{"id": sample[0]["id"], "answer": "printed"}, {"id": sample[1]["id"], "answer": "handwritten"}])
    assert result["n"] == 2 and result["agreement"] == 0.5
    assert len(paths.checks.read_text().splitlines()) == 2


def test_rollback_moves_files_back_and_restores_kinds(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    cell = ids["7"][0]
    first = LabelStore(paths, Clock())
    first.save([{"id": cell, "kind": "printed"}], "groups")
    first.move(cell, "1", "groups")
    later = Clock()
    later.moment += timedelta(hours=1)
    second = LabelStore(paths, later)
    assert second.rollback(first.session) == 2
    assert (paths.cells / "7" / f"{cell[:16]}.png").exists()
    assert second.screen("7", 0, 0)["cells"][0]["kind"] is None


def test_progress_counts_per_folder(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 3}, {"7": [[0, 1, 2]]})
    store = LabelStore(paths, Clock())
    store.save([{"id": ids["7"][0], "kind": "printed"}, {"id": ids["7"][1], "kind": "unsure"}], "groups")
    seven = store.progress()["folders"]["7"]
    assert (seven["cells"], seven["printed"], seven["unsure"], seven["without"]) == (3, 1, 1, 1)
    assert seven["groups"] == [{"group": 0, "size": 3, "without": 1}]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_label_store.py -q`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the implementation**

`ml/src/sudoku_ml/label_store.py`:

```python
"""State and rules of the labelling page. label_server.py only translates HTTP to these calls."""

import json
import tomllib
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.dataset import cell_paths, group_ids, read_ids, split_by_group
from sudoku_ml.kind_check import CheckLine, NotEnoughCells, draw_sample, summary
from sudoku_ml.kind_log import (
    KINDS,
    Line,
    append_records,
    current_kinds,
    format_time,
    read_log,
    read_records,
    rollback_lines,
    undo_lines,
    undone_actions,
)
from sudoku_ml.kind_review import check_items, model_items, near_duplicate_items, open_items
from sudoku_ml.preprocess import to_cell_image
from sudoku_ml.relabel import move_cells
from sudoku_ml.synthetic import Sample

SCREEN_SIZE = 50
DIGIT_FOLDERS = tuple(str(d) for d in range(1, 10))
_LABELLED = ("printed", "handwritten")


@dataclass(frozen=True)
class Paths:
    cells: Path
    manifest: Path
    log: Path
    checks: Path
    groups: Path
    suspects: Path
    config: Path  # the training config: its seed and split define the test split

    @classmethod
    def under(cls, ml_root: Path) -> "Paths":
        datasets, data = ml_root / "datasets", ml_root / "data"
        return cls(
            data / "cells",
            datasets / "cells.csv",
            datasets / "kind-log.jsonl",
            datasets / "kind-check.jsonl",
            data / "groups.json",
            data / "review" / "suspects.csv",
            ml_root / "configs" / "cell-classifier.toml",
        )


class LabelStore:
    def __init__(self, paths: Paths, now: Callable[[], datetime] = lambda: datetime.now(UTC)):
        self.paths, self._now = paths, now
        self.session = now().strftime("%Y%m%d-%H%M%S")
        self._actions = 0
        self._stem_ids = read_ids(paths.manifest)
        self.folder: dict[str, str] = {}
        for path in paths.cells.glob("*/*.png"):
            if path.stem not in self._stem_ids:
                raise ValueError(f"{path} is not in {paths.manifest}. Run: just dataset-manifest")
            self.folder[self._stem_ids[path.stem]] = path.parent.name
        self.lines = read_log(paths.log)
        self.checks = read_records(paths.checks, CheckLine)
        self.groups = json.loads(paths.groups.read_text())["folders"] if paths.groups.exists() else {}
        self._dups: tuple[dict[str, int], set[str]] | None = None

    # Helpers

    def _t(self) -> str:
        return format_time(self._now())

    def _action(self) -> str:
        self._actions += 1
        return f"{self.session}-{self._actions}"

    def _write(self, lines: list[Line]) -> None:
        append_records(self.paths.log, lines)
        self.lines.extend(lines)

    def _apply_digits(self, lines: list[Line]) -> None:
        for line in lines:
            if line.field == "digit" and line.old != line.new:
                move_cells(self.paths.cells, {line.cell[:16]: line.new})
                self.folder[line.cell] = line.new

    def kinds(self) -> dict[str, str | None]:
        return current_kinds(self.lines)

    def cell_file(self, stem: str) -> Path:
        return self.paths.cells / self.folder[self._stem_ids[stem]] / f"{stem}.png"

    def _groups_of(self, folder: str) -> list[dict]:
        """The stored groups of the folder, then one group of cells that no stored group holds."""
        stored = self.groups.get(folder, [])
        grouped = {c for g in stored for c in g["cells"]}
        extra = sorted(c for c, f in self.folder.items() if f == folder and c not in grouped)
        if not extra:
            return stored
        return [*stored, {"cells": extra, "sureness": [0.0] * len(extra), "ungrouped": True}]

    def _members(self, folder: str, group: dict) -> list[str]:
        return [c for c in group["cells"] if self.folder.get(c) == folder]

    # Groups screen

    @staticmethod
    def _majority(members: list[str], kinds: dict[str, str | None]) -> str | None:
        counts = Counter(kinds.get(c) for c in members if kinds.get(c) in _LABELLED).most_common()
        if not counts or (len(counts) > 1 and counts[0][1] == counts[1][1]):
            return None
        return counts[0][0]

    def folder_progress(self, folder: str) -> dict:
        kinds = self.kinds()
        cells = [c for c, f in self.folder.items() if f == folder]
        return {"cells": len(cells), "labelled": sum(kinds.get(c) is not None for c in cells)}

    def screen(self, folder: str, group: int, page: int) -> dict:
        groups = self._groups_of(folder)
        chosen = groups[group]
        members = self._members(folder, chosen)
        sure = dict(zip(chosen["cells"], chosen["sureness"], strict=True))
        kinds = self.kinds()
        start = self._majority(members, kinds)
        pages = max(1, -(-len(members) // SCREEN_SIZE))
        page = min(page, pages - 1)
        cutoff = np.quantile([sure[c] for c in members], 0.1) if members else 0.0
        chunk = members[page * SCREEN_SIZE : (page + 1) * SCREEN_SIZE]
        return {
            "folder": folder,
            "group": group,
            "groups": len(groups),
            "page": page,
            "pages": pages,
            "ungrouped": bool(chosen.get("ungrouped")),
            "cells": [
                {
                    "id": c,
                    "stem": c[:16],
                    "kind": kinds.get(c),
                    "start": kinds.get(c) or start,
                    "least_sure": bool(sure[c] <= cutoff),
                }
                for c in chunk
            ],
            "progress": self.folder_progress(folder),
        }

    def _screens(self):
        for folder in DIGIT_FOLDERS:
            for g, group in enumerate(self._groups_of(folder)):
                members = self._members(folder, group)
                for page in range(max(1, -(-len(members) // SCREEN_SIZE))):
                    yield folder, g, page, members[page * SCREEN_SIZE : (page + 1) * SCREEN_SIZE]

    def next_screen(self, after: tuple[str, int, int] | None = None) -> dict | None:
        """The first screen after `after` with a cell without a kind. Wraps around once."""
        kinds = self.kinds()
        order = list(self._screens())
        start = 0
        if after is not None:
            start = 1 + next((i for i, s in enumerate(order) if s[:3] == after), -1)
        for folder, g, page, chunk in order[start:] + order[:start]:
            if any(kinds.get(c) is None for c in chunk):
                return self.screen(folder, g, page)
        return None

    # Changes

    def save(self, entries: list[dict], screen: str, confirm_digits: list[str] = ()) -> int:
        """Log a kind line per changed or new cell. On the Review screen, also per confirmation."""
        kinds, t, action = self.kinds(), self._t(), self._action()
        lines = []
        for entry in entries:
            cell, kind = entry["id"], entry["kind"]
            if kind not in KINDS:
                raise ValueError(f"{cell[:16]}: unknown kind {kind!r}")
            if self.folder.get(cell) not in DIGIT_FOLDERS:
                raise ValueError(f"{cell[:16]}: not in a digit folder")
            if kinds.get(cell) != kind or screen == "review":
                lines.append(Line(t, self.session, action, cell, "kind", kinds.get(cell), kind, screen))
        for cell in confirm_digits:
            folder = self.folder[cell]
            lines.append(Line(t, self.session, action, cell, "digit", folder, folder, screen))
        self._write(lines)
        return len(lines)

    def move(self, cell: str, digit: str, screen: str) -> None:
        if digit not in DIGIT_CLASSES:
            raise ValueError(f"unknown digit folder {digit!r}")
        old = self.folder[cell]
        if old == digit:
            return
        t, action = self._t(), self._action()
        lines = [Line(t, self.session, action, cell, "digit", old, digit, screen)]
        kind = self.kinds().get(cell)
        if digit == "empty" and kind is not None:
            lines.append(Line(t, self.session, action, cell, "kind", kind, None, screen))
        self._apply_digits(lines)
        self._write(lines)

    def undo(self) -> int:
        lines = undo_lines(self.lines, self._t(), self.session)
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)

    def rollback(self, session: str) -> int:
        lines = rollback_lines(self.lines, session, self._t(), self.session)
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)

    # Review screen

    def _near_duplicates(self) -> tuple[dict[str, int], set[str]]:
        """Near-duplicate group per cell id, and the ids in the test split. Slow: reads every
        cell once, then caches."""
        if self._dups is None:
            paths = cell_paths(self.paths.cells)
            samples = [
                Sample(to_cell_image(np.asarray(Image.open(p).convert("RGB"))), 0, 0)
                for p in paths
            ]
            groups = group_ids(samples)
            config = tomllib.loads(self.paths.config.read_text())
            _, _, test = split_by_group(groups, tuple(config["split"]), config["seed"])
            ids = [self._stem_ids[p.stem] for p in paths]
            self._dups = (
                {c: int(g) for c, g in zip(ids, groups, strict=True)},
                {ids[i] for i in test},
            )
        return self._dups

    def review_items(self) -> list[dict]:
        kinds = self.kinds()

        def current(cell: str, field: str) -> str | None:
            return kinds.get(cell) if field == "kind" else self.folder.get(cell)

        items = (
            near_duplicate_items(self._near_duplicates()[0], self.lines)
            + model_items(self.paths.suspects, self._stem_ids, current)
            + check_items(self.checks, current)
        )
        merged: dict[tuple[str, str], dict] = {}
        for item in open_items(items, self.lines):
            if item.cell not in self.folder:
                continue
            entry = merged.setdefault(
                (item.cell, item.field),
                {
                    "id": item.cell,
                    "stem": item.cell[:16],
                    "field": item.field,
                    "folder": self.folder[item.cell],
                    "kind": kinds.get(item.cell),
                    "reasons": [],
                },
            )
            entry["reasons"].append({"reason": item.reason, **item.evidence})
        return list(merged.values())

    def review_screen(self) -> dict:
        items = self.review_items()
        return {"items": items[:SCREEN_SIZE], "open": len(items)}

    # Check screen

    def check_start(self, n: int = 200) -> dict:
        try:
            cells = draw_sample(self.lines, self.checks, self._near_duplicates()[1], self._now(), n)
        except NotEnoughCells as error:
            return {
                "error": f"Only {error.count} cells have a label that is 7 days old or older. "
                f"The check needs {n}."
            }
        return {"cells": [{"id": c, "stem": c[:16]} for c in cells]}

    def check_answer(self, answers: list[dict]) -> dict:
        kinds, t = self.kinds(), self._t()
        records = []
        for answer in answers:
            cell, value = answer["id"], answer["answer"]
            if value not in KINDS:
                raise ValueError(f"{cell[:16]}: unknown kind {value!r}")
            if kinds.get(cell) not in _LABELLED:
                raise ValueError(f"{cell[:16]}: has no printed or handwritten label")
            records.append(CheckLine(t, self.session, cell, kinds[cell], value))
        append_records(self.paths.checks, records)
        self.checks.extend(records)
        return summary(self.checks)

    # Progress

    def progress(self) -> dict:
        kinds = self.kinds()
        undone = undone_actions(self.lines)
        moved_out = Counter(
            x.old
            for x in self.lines
            if x.field == "digit" and x.old != x.new and x.screen != "undo" and x.action not in undone
        )
        folders = {}
        for folder in DIGIT_FOLDERS:
            cells = [c for c, f in self.folder.items() if f == folder]
            counts = Counter(kinds.get(c) for c in cells)
            groups = []
            for g, group in enumerate(self._groups_of(folder)):
                members = self._members(folder, group)
                without = sum(kinds.get(c) is None for c in members)
                groups.append({"group": g, "size": len(members), "without": without})
            folders[folder] = {
                "cells": len(cells),
                "printed": counts["printed"],
                "handwritten": counts["handwritten"],
                "unsure": counts["unsure"],
                "without": counts[None],
                "moved_out": moved_out[folder],
                "groups": groups,
            }
        return {"folders": folders, "review_open": len(self.review_items()), "check": summary(self.checks)}

    def label_state(self) -> dict:
        kinds = self.kinds()
        counts = Counter(kinds.get(c) for c, f in self.folder.items() if f in DIGIT_FOLDERS)
        return {
            "printed": counts["printed"],
            "handwritten": counts["handwritten"],
            "unsure": counts["unsure"],
            "review_open": len(self.review_items()),
            "check": summary(self.checks),
        }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest tests/test_label_store.py -q`
Expected: 15 passed.

- [ ] **Step 5: Lint and commit**

Run: `just lint-ml`

```bash
/usr/bin/git add ml/src/sudoku_ml/label_store.py ml/tests/test_label_store.py
/usr/bin/git commit -m "feat(ml): add the state and rules of the labelling page (#30)"
```

---

### Task 9: The label server

**Files:**
- Create: `ml/src/sudoku_ml/label_server.py`
- Modify: `justfile`
- Test: `ml/tests/test_label_server.py`

**Interfaces:**
- Consumes: `LabelStore`, `Paths` (Task 8).
- Produces:
  - `make_server(store: LabelStore, host: str = "127.0.0.1", port: int = 8765) -> HTTPServer`
  - Routes: `GET /`, `GET /cell/<stem>.png`, `GET /api/next[?folder&group&page]`, `GET /api/screen?folder&group&page`, `GET /api/review`, `GET /api/check`, `GET /api/progress`, `POST /api/save`, `POST /api/move`, `POST /api/undo`, `POST /api/check`. Errors: `{"error": str}` with 400, 403, 404 or 415.
  - `main(argv: list[str]) -> int` (`rollback <session>` or serve)

- [ ] **Step 1: Write the failing tests**

`ml/tests/test_label_server.py`:

```python
import http.client
import json
import threading
from pathlib import Path

import pytest

from sudoku_ml.kind_log import read_log
from sudoku_ml.label_server import make_server
from sudoku_ml.label_store import LabelStore

from test_label_store import Clock, build


@pytest.fixture
def served(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    server = make_server(LabelStore(paths, Clock()), port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_port, paths, ids
    server.shutdown()
    server.server_close()


def request(port, method, path, body=None, host=None, content_type="application/json"):
    connection = http.client.HTTPConnection("127.0.0.1", port)
    headers = {"Host": host or f"127.0.0.1:{port}"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = content_type
    connection.request(method, path, body=data, headers=headers)
    response = connection.getresponse()
    return response.status, response.read()


def test_the_server_refuses_any_address_but_localhost(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    with pytest.raises(ValueError, match="127.0.0.1"):
        make_server(LabelStore(paths, Clock()), host="0.0.0.0", port=0)


def test_a_foreign_host_header_is_refused(served):
    port, _, _ = served
    status, _ = request(port, "GET", "/api/next", host="evil.example:80")
    assert status == 403


def test_a_post_without_json_content_type_is_refused_and_writes_nothing(served):
    port, paths, ids = served
    body = {"screen": "groups", "cells": [{"id": ids["7"][0], "kind": "printed"}]}
    status, _ = request(port, "POST", "/api/save", body, content_type="text/plain")
    assert status == 415
    assert read_log(paths.log) == []


def test_a_save_round_trips(served):
    port, paths, ids = served
    body = {"screen": "groups", "cells": [{"id": ids["7"][0], "kind": "printed"}]}
    status, data = request(port, "POST", "/api/save", body)
    assert status == 200 and json.loads(data) == {"result": 1}
    assert [x.new for x in read_log(paths.log)] == ["printed"]
    status, data = request(port, "GET", "/api/screen?folder=7&group=0&page=0")
    assert json.loads(data)["cells"][0]["kind"] == "printed"


def test_cell_images_are_served_and_unknown_cells_are_not(served):
    port, _, ids = served
    status, data = request(port, "GET", f"/cell/{ids['7'][0][:16]}.png")
    assert status == 200 and data[:4] == b"\x89PNG"
    status, _ = request(port, "GET", "/cell/../../etc/passwd")
    assert status == 404


def test_a_bad_request_gets_a_400_with_a_reason(served):
    port, _, ids = served
    body = {"screen": "groups", "cells": [{"id": ids["7"][0], "kind": "notes"}]}
    status, data = request(port, "POST", "/api/save", body)
    assert status == 400 and "unknown kind" in json.loads(data)["error"]
```

`ml/tests/` has no `__init__.py`, so pytest puts the folder on `sys.path` and `from test_label_store import …` works. Do not add an `__init__.py`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_label_server.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'sudoku_ml.label_server'`.

- [ ] **Step 3: Write the implementation**

`ml/src/sudoku_ml/label_server.py`:

```python
"""HTTP front of the label store, on 127.0.0.1 only: cell images never leave the Mac (SUD-02,
SUD-08)."""

import json
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from sudoku_ml.label_store import LabelStore, Paths

PAGE = Path(__file__).with_name("label_page.html")
LOCAL_HOSTS = ("127.0.0.1", "localhost")


def make_server(store: LabelStore, host: str = "127.0.0.1", port: int = 8765) -> HTTPServer:
    if host not in LOCAL_HOSTS:
        raise ValueError(f"refusing to serve on {host}: the page binds to 127.0.0.1 only")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, value, status: int = 200) -> None:
            self._send(status, json.dumps(value).encode(), "application/json")

        def _local(self) -> bool:
            # Another site can point a name at 127.0.0.1 (DNS rebinding). Its requests carry
            # that name in Host, so only our own host and port pass.
            port = self.server.server_port
            allowed = {f"{name}:{port}" for name in LOCAL_HOSTS}
            if self.headers.get("Host") in allowed:
                return True
            self._json({"error": "forbidden host"}, 403)
            return False

        def do_GET(self):
            if not self._local():
                return
            url = urlparse(self.path)
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            try:
                if url.path == "/":
                    self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
                elif url.path.startswith("/cell/"):
                    stem = url.path.removeprefix("/cell/").removesuffix(".png")
                    try:
                        path = store.cell_file(stem)
                    except KeyError:
                        self._json({"error": "no such cell"}, 404)
                        return
                    self._send(200, path.read_bytes(), "image/png")
                elif url.path == "/api/next":
                    after = (q["folder"], int(q["group"]), int(q["page"])) if "folder" in q else None
                    self._json(store.next_screen(after))
                elif url.path == "/api/screen":
                    self._json(store.screen(q["folder"], int(q["group"]), int(q["page"])))
                elif url.path == "/api/review":
                    self._json(store.review_screen())
                elif url.path == "/api/check":
                    self._json(store.check_start())
                elif url.path == "/api/progress":
                    self._json(store.progress())
                else:
                    self._json({"error": "not found"}, 404)
            except (KeyError, ValueError, IndexError) as error:
                self._json({"error": str(error)}, 400)

        def do_POST(self):
            if not self._local():
                return
            # A cross-site form or fetch without a preflight cannot set this content type.
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                self._json({"error": "Content-Type must be application/json"}, 415)
                return
            routes = {
                "/api/save": lambda b: store.save(b["cells"], b["screen"], b.get("confirm_digits", [])),
                "/api/move": lambda b: store.move(b["id"], b["digit"], b["screen"]),
                "/api/undo": lambda b: store.undo(),
                "/api/check": lambda b: store.check_answer(b["answers"]),
            }
            route = routes.get(urlparse(self.path).path)
            if route is None:
                self._json({"error": "not found"}, 404)
                return
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                self._json({"result": route(body)})
            except (KeyError, ValueError, IndexError, TypeError) as error:
                self._json({"error": str(error)}, 400)

    return HTTPServer((host, port), Handler)


def main(argv: list[str]) -> int:
    paths = Paths.under(Path(__file__).parents[2])
    if not paths.groups.exists():
        print(f"{paths.groups} is missing. Run: just group-cells", file=sys.stderr)
        return 1
    store = LabelStore(paths)
    if argv[1:2] == ["rollback"]:
        print(f"Reversed {store.rollback(argv[2])} lines.")
        return 0
    server = make_server(store)
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Session {store.session}. Open {url}. Stop with Ctrl-C.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

Append to `justfile`:

```make
# Open the labelling page on 127.0.0.1. The manifest is rewritten before and after
label-cells:
    just dataset-manifest
    uv run --directory ml python -m sudoku_ml.label_server
    just dataset-manifest

# Reverse every change of one labelling session
label-rollback session:
    uv run --directory ml python -m sudoku_ml.label_server rollback {{session}}
    just dataset-manifest
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest tests/test_label_server.py tests/test_label_store.py -q`
Expected: all pass.

- [ ] **Step 5: Lint and commit**

Run: `just lint-ml`

```bash
/usr/bin/git add ml/src/sudoku_ml/label_server.py ml/tests/test_label_server.py justfile
/usr/bin/git commit -m "feat(ml): serve the labelling page on localhost only (#30)"
```

---

### Task 10: The labelling page

**Files:**
- Create: `ml/src/sudoku_ml/label_page.html`
- Test: `ml/tests/test_label_server.py` (one more test)

**Interfaces:**
- Consumes: the routes of Task 9 and the screen and Review dicts of Task 8.
- Produces: the page. No other code depends on it.

- [ ] **Step 1: Write the failing test**

Append to `ml/tests/test_label_server.py`:

```python
def test_the_page_is_served(served):
    port, _, _ = served
    status, data = request(port, "GET", "/")
    assert status == 200 and b"<title>Cell labels</title>" in data
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `uv run --directory ml pytest tests/test_label_server.py::test_the_page_is_served -q`
Expected: FAIL. The handler raises `FileNotFoundError`, and the connection closes without an answer.

- [ ] **Step 3: Write the page**

`ml/src/sudoku_ml/label_page.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cell labels</title>
<style>
  :root { --printed: #2f6fd6; --handwritten: #d6452f; --unsure: #7a7a7a; --none: #cfcfcf; }
  body { font: 14px system-ui, sans-serif; margin: 0; display: grid;
         grid-template-columns: 1fr 290px; grid-template-rows: auto 1fr auto; height: 100vh; }
  header { grid-column: 1 / 3; display: flex; gap: 16px; align-items: center;
           padding: 8px 16px; border-bottom: 1px solid #ddd; }
  nav button { margin-right: 4px; }
  nav button.on { font-weight: bold; }
  #message { color: #b00020; }
  main { overflow: auto; padding: 16px; }
  aside { border-left: 1px solid #ddd; padding: 16px; overflow: auto; }
  aside img.big { width: 256px; height: 256px; background: #eee; }
  aside img.small { width: 64px; height: 64px; margin: 2px; }
  footer { padding: 8px 16px; color: #555; border-top: 1px solid #ddd; }
  #grid { display: grid; grid-template-columns: repeat(auto-fill, 100px); gap: 6px; }
  .cell { position: relative; width: 96px; height: 96px; border: 2px solid var(--none); cursor: pointer; }
  .cell img { width: 96px; height: 96px; display: block; }
  .cell.least { outline: 3px solid #111; outline-offset: 1px; }
  .cell .tag { position: absolute; right: 2px; bottom: 2px; padding: 0 4px; color: #fff;
               font-weight: bold; background: var(--none); }
  .cell .reason { position: absolute; left: 2px; top: 2px; padding: 0 2px; font-size: 11px;
                  background: rgba(255, 255, 255, 0.85); }
  .printed { border-color: var(--printed); } .printed .tag { background: var(--printed); }
  .handwritten { border-color: var(--handwritten); } .handwritten .tag { background: var(--handwritten); }
  .unsure { border-color: var(--unsure); } .unsure .tag { background: var(--unsure); }
  table { border-collapse: collapse; }
  th, td { padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right; }
  td.groups { text-align: left; }
</style>
</head>
<body>
<header>
  <nav>
    <button data-mode="groups">Groups</button>
    <button data-mode="review">Review</button>
    <button data-mode="check">Check</button>
    <button data-mode="progress">Progress</button>
  </nav>
  <span id="title"></span>
  <span id="message" role="status"></span>
</header>
<main><div id="grid"></div><div id="table"></div></main>
<aside><img class="big" id="preview" alt=""><p id="detail"></p><div id="related"></div></aside>
<footer id="keys"></footer>
<script>
const LETTER = { printed: "P", handwritten: "H", unsure: "?" };
const KEYS = {
  groups: "P all printed · H all handwritten · click switch · ⌥-click unsure · 0–9 move (0 = empty) · Enter save · S skip · Z undo",
  review: "click switch · ⌥-click unsure · 0–9 move (0 = empty) · Enter confirm the screen · Z undo",
  check: "P all printed · H all handwritten · click switch · ⌥-click unsure · Enter save",
  progress: "Click a group to open it",
};
const PAGE = 50;
let mode = "groups";
let screen = null;
let local = {};
let hovered = null;
let checkPage = 0;

const $ = (id) => document.getElementById(id);
const say = (text) => { $("message").textContent = text || ""; };

async function api(path, body) {
  const options = body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  };
  const response = await fetch(path, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || response.statusText);
  return value;
}

function cellsOnScreen() {
  if (!screen) return [];
  if (mode === "groups") return screen.cells;
  if (mode === "review") return screen.items;
  if (mode === "check") return screen.cells.slice(checkPage * PAGE, (checkPage + 1) * PAGE);
  return [];
}

function reasonText(cell) {
  return cell.reasons.map((r) => r.reason).join(", ");
}

function detailText(cell) {
  if (mode !== "review") return "";
  return cell.reasons.map((r) => {
    if (r.reason === "check") return `Check answer: ${r.answer}. Label: ${r.label}.`;
    if (r.reason === "near-duplicate") return `Near-duplicates: ${Object.values(r.kinds).join(", ")}.`;
    return `Model: ${r.predicted} (${Math.round(r.p_predicted * 100)} %). Label: ${r.label}.`;
  }).join(" ");
}

function showDetail(cell) {
  hovered = cell;
  $("preview").src = `/cell/${cell.stem}.png`;
  $("detail").textContent = detailText(cell);
  const near = mode === "review" ? cell.reasons.find((r) => r.reason === "near-duplicate") : null;
  $("related").innerHTML = near
    ? near.group.map((id) => `<img class="small" alt="" src="/cell/${id.slice(0, 16)}.png">`).join("")
    : "";
}

function title() {
  let text = "";
  if (mode === "groups") {
    text = !screen ? "Every grouped cell has a kind." :
      `Digit ${screen.folder} · ${screen.ungrouped ? "ungrouped" : `group ${screen.group + 1} of ${screen.groups}`}` +
      `${screen.pages > 1 ? ` · screen ${screen.page + 1} of ${screen.pages}` : ""}` +
      ` · ${screen.cells.length} cells · folder ${screen.folder}/: ${screen.progress.labelled} of ${screen.progress.cells} labelled`;
  } else if (mode === "review") {
    text = screen ? `${screen.open} open Review items` : "";
  } else if (mode === "check") {
    text = screen ? `Check · screen ${checkPage + 1} of ${Math.ceil(screen.cells.length / PAGE)}` : "";
  }
  $("title").textContent = text;
}

function render() {
  for (const b of document.querySelectorAll("nav button")) b.classList.toggle("on", b.dataset.mode === mode);
  $("keys").textContent = KEYS[mode];
  $("table").innerHTML = "";
  const grid = $("grid");
  grid.innerHTML = "";
  for (const cell of cellsOnScreen()) {
    const kind = local[cell.id];
    const div = document.createElement("div");
    div.className = `cell ${kind || ""} ${cell.least_sure ? "least" : ""}`;
    div.innerHTML = `<img src="/cell/${cell.stem}.png" alt=""><span class="tag">${LETTER[kind] || "·"}</span>`;
    if (mode === "review") {
      const reason = document.createElement("span");
      reason.className = "reason";
      reason.textContent = reasonText(cell);
      div.append(reason);
    }
    div.onclick = (event) => {
      local[cell.id] = event.altKey ? "unsure" : (local[cell.id] === "printed" ? "handwritten" : "printed");
      render();
    };
    div.onmouseenter = () => showDetail(cell);
    grid.append(div);
  }
  title();
}

function setScreen(value) {
  screen = value;
  local = {};
  hovered = null;
  if (mode === "groups" && screen) for (const c of screen.cells) local[c.id] = c.start;
  if (mode === "review" && screen) for (const c of screen.items) local[c.id] = c.kind;
  render();
}

async function loadGroups(after) {
  const query = after ? `?folder=${after.folder}&group=${after.group}&page=${after.page}` : "";
  setScreen(await api(`/api/next${query}`));
}

async function reload() {
  if (mode === "groups" && screen) {
    setScreen(await api(`/api/screen?folder=${screen.folder}&group=${screen.group}&page=${screen.page}`));
  } else if (mode === "groups") {
    await loadGroups();
  } else if (mode === "review") {
    setScreen(await api("/api/review"));
  }
}

async function move(cell, digit) {
  await api("/api/move", { id: cell.id, digit, screen: mode === "review" ? "review" : "groups" });
  const unsaved = local;
  await reload();
  for (const id in unsaved) if (id in local) local[id] = unsaved[id];
  render();
  say(`Moved to ${digit}.`);
}

async function save() {
  const cells = cellsOnScreen();
  if (mode === "groups" && screen) {
    if (cells.some((c) => !local[c.id])) return say("Every cell needs a kind. Press P or H first.");
    const result = await api("/api/save", { screen: "groups", cells: cells.map((c) => ({ id: c.id, kind: local[c.id] })) });
    say(`Saved: ${result.result} changes.`);
    await loadGroups(screen);
  } else if (mode === "review" && screen) {
    const kindCells = cells.filter((c) => c.field === "kind" || (local[c.id] && local[c.id] !== c.kind));
    const result = await api("/api/save", {
      screen: "review",
      cells: kindCells.map((c) => ({ id: c.id, kind: local[c.id] })),
      confirm_digits: cells.filter((c) => c.field === "digit").map((c) => c.id),
    });
    say(`Confirmed: ${result.result} lines.`);
    setScreen(await api("/api/review"));
  } else if (mode === "check" && screen) {
    if (cells.some((c) => !local[c.id])) return say("Every cell needs an answer.");
    const result = (await api("/api/check", { answers: cells.map((c) => ({ id: c.id, answer: local[c.id] })) })).result;
    checkPage += 1;
    local = {};
    if (checkPage * PAGE < screen.cells.length) return render();
    screen = null;
    render();
    $("title").textContent = `Check done: ${(result.agreement * 100).toFixed(1)} % agreement on ${result.n} cells.`;
    renderConfusion(result.confusion);
  }
}

function renderConfusion(confusion) {
  const answers = ["printed", "handwritten", "unsure"];
  const rows = Object.entries(confusion).map(([label, row]) =>
    `<tr><th>${label}</th>${answers.map((a) => `<td>${row[a] || 0}</td>`).join("")}</tr>`);
  $("table").innerHTML = `<table><tr><th>Label \\ answer</th>${answers.map((a) => `<th>${a}</th>`).join("")}</tr>${rows.join("")}</table>`;
}

function renderProgress(value) {
  const check = value.check
    ? `${(value.check.agreement * 100).toFixed(1)} % on ${value.check.n} cells (${value.check.date})`
    : "none yet";
  $("title").textContent = `Open Review items: ${value.review_open} · last check: ${check}`;
  const rows = Object.entries(value.folders).map(([folder, f]) =>
    `<tr><th>${folder}/</th><td>${f.cells}</td><td>${f.printed}</td><td>${f.handwritten}</td>` +
    `<td>${f.unsure}</td><td>${f.without}</td><td>${f.moved_out}</td><td class="groups">` +
    f.groups.map((g) => `<a href="#" data-folder="${folder}" data-group="${g.group}">${g.group + 1}` +
      `${g.without ? ` (${g.without})` : ""}</a>`).join(" · ") + "</td></tr>");
  $("table").innerHTML = "<table><tr><th>Folder</th><th>Cells</th><th>Printed</th><th>Handwritten</th>" +
    "<th>Unsure</th><th>No kind</th><th>Moved out</th><th>Groups (cells without a kind)</th></tr>" +
    rows.join("") + "</table>";
  for (const a of $("table").querySelectorAll("a")) {
    a.onclick = (event) => {
      event.preventDefault();
      open("groups", { folder: a.dataset.folder, group: Number(a.dataset.group) });
    };
  }
}

async function open(next, target) {
  mode = next;
  screen = null;
  local = {};
  hovered = null;
  say("");
  try {
    if (mode === "groups" && target) {
      setScreen(await api(`/api/screen?folder=${target.folder}&group=${target.group}&page=0`));
    } else if (mode === "groups") {
      await loadGroups();
    } else if (mode === "review" || mode === "check") {
      render();
      say("Loading. The first time takes a while: the server reads every cell to find near-duplicates.");
      if (mode === "review") {
        setScreen(await api("/api/review"));
      } else {
        const value = await api("/api/check");
        if (value.error) { render(); return say(value.error); }
        checkPage = 0;
        setScreen(value);
      }
      say("");
    } else {
      render();
      renderProgress(await api("/api/progress"));
    }
  } catch (error) {
    say(error.message);
  }
}

document.addEventListener("keydown", async (event) => {
  if (event.metaKey || event.ctrlKey) return;
  const key = event.key.toLowerCase();
  try {
    if ((key === "p" || key === "h") && (mode === "groups" || mode === "check")) {
      for (const c of cellsOnScreen()) local[c.id] = key === "p" ? "printed" : "handwritten";
      render();
    } else if (/^[0-9]$/.test(key) && hovered && (mode === "groups" || mode === "review")) {
      await move(hovered, key === "0" ? "empty" : key);
    } else if (key === "enter") {
      await save();
    } else if (key === "s" && mode === "groups" && screen) {
      await loadGroups(screen);
    } else if (key === "z" && (mode === "groups" || mode === "review")) {
      const result = await api("/api/undo", {});
      await reload();
      say(result.result ? `Undone: ${result.result} lines.` : "Nothing to undo in this session.");
    }
  } catch (error) {
    say(error.message);
  }
});

for (const b of document.querySelectorAll("nav button")) b.onclick = () => open(b.dataset.mode);
open("groups");
</script>
</body>
</html>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest tests/test_label_server.py -q`
Expected: all pass.

- [ ] **Step 5: Smoke-test the page on a small tree**

Run: `uv run --directory ml python - <<'EOF'` with this script, then open the printed URL in a browser:

```python
import sys, tempfile, threading, webbrowser
from pathlib import Path
sys.path.insert(0, "tests")
from test_label_store import Clock, build
from sudoku_ml.label_server import make_server
from sudoku_ml.label_store import LabelStore
paths, _ = build(Path(tempfile.mkdtemp()), {"7": 60, "1": 5}, {"7": [list(range(40)), list(range(40, 60))], "1": [list(range(5))]})
server = make_server(LabelStore(paths, Clock()), port=0)
print(f"http://127.0.0.1:{server.server_port}/")
server.serve_forever()
```

Check by hand:
- P then Enter saves the first screen. The next screen opens.
- A click switches one cell. ⌥-click shows `?`.
- Hovering a cell and pressing 1 moves it. It leaves the screen.
- Z undoes. The message says how many lines it reversed.
- Progress shows the counts. A group link opens that group.

Stop the script with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add ml/src/sudoku_ml/label_page.html ml/tests/test_label_server.py
/usr/bin/git commit -m "feat(ml): add the labelling page (#30)"
```

---

### Task 11: The training report states the label quality

**Files:**
- Modify: `ml/src/sudoku_ml/train.py`
- Test: `ml/tests/test_train.py`

**Interfaces:**
- Consumes: `LabelStore.label_state()` (Task 8), kind targets (Task 3).
- Produces:
  - `label_state_lines(state: dict, kind_accuracy_real: float | None, n_kind_test: int) -> str`
  - `metrics.json` gains `kind_accuracy_real`, `n_kind_test` and `label_state` when `real_cells` is true.

- [ ] **Step 1: Write the failing tests**

Append to `ml/tests/test_train.py`:

```python
from sudoku_ml.train import label_state_lines


def test_label_state_lines_report_labels_review_and_check():
    state = {
        "printed": 1160,
        "handwritten": 375,
        "unsure": 12,
        "review_open": 4,
        "check": {"n": 200, "agreement": 0.975, "confusion": {}, "date": "2026-10-20"},
    }
    assert label_state_lines(state, 0.9812, 160) == (
        "- Kind labels: 1160 printed, 375 handwritten, 12 unsure\n"
        "- Open Review items: 4\n"
        "- Last check: 97.5% agreement on 200 cells, 2026-10-20\n"
        "- Kind accuracy (real test cells): 0.9812 on 160 cells\n"
    )


def test_label_state_lines_when_the_state_is_unknown():
    assert label_state_lines({"error": "cells.csv is out of date"}, None, 0) == (
        "- Kind labels: unknown (cells.csv is out of date)\n"
        "- Kind accuracy (real test cells): no labelled test cells\n"
    )
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --directory ml pytest tests/test_train.py -q -k label_state`
Expected: FAIL with `ImportError: cannot import name 'label_state_lines'`.

- [ ] **Step 3: Write the implementation**

In `ml/src/sudoku_ml/train.py`:

1. Change the contract import to `from sudoku_ml.contract import CONTRACT_VERSION, DIGIT_CLASSES, UNKNOWN_KIND, kind_index`.
2. Add `from sudoku_ml.label_store import LabelStore, Paths`.
3. Add after `review_accuracy`:

```python
def label_state_lines(state: dict, kind_accuracy_real: float | None, n_kind_test: int) -> str:
    """The model card lines that say how far the kind labels can be trusted."""
    if "error" in state:
        lines = [f"- Kind labels: unknown ({state['error']})"]
    else:
        check = state["check"]
        lines = [
            f"- Kind labels: {state['printed']} printed, {state['handwritten']} handwritten, "
            f"{state['unsure']} unsure",
            f"- Open Review items: {state['review_open']}",
            f"- Last check: {check['agreement']:.1%} agreement on {check['n']} cells, {check['date']}"
            if check
            else "- Last check: none yet",
        ]
    if kind_accuracy_real is None:
        lines.append("- Kind accuracy (real test cells): no labelled test cells")
    else:
        lines.append(f"- Kind accuracy (real test cells): {kind_accuracy_real:.4f} on {n_kind_test} cells")
    return "".join(line + "\n" for line in lines)


def _label_state(ml_root: Path) -> dict:
    # A stale cells.csv must not stop a run. The card then says the state is unknown.
    try:
        return LabelStore(Paths.under(ml_root)).label_state()
    except (ValueError, OSError) as error:
        return {"error": str(error)}
```

4. In `train`, replace the two lines

```python
    test_images, test_digit, _ = stack(eval_sets["test"])
    test_logits, _ = _logits(model, test_images, device)
```

with

```python
    test_images, test_digit, test_kind = stack(eval_sets["test"])
    test_logits, test_kind_logits = _logits(model, test_images, device)
    labelled = (test_kind == kind_index("printed")) | (test_kind == kind_index("handwritten"))
    n_kind_test = int(labelled.sum())
    kind_accuracy_real = (
        round(float((test_kind_logits.argmax(1)[labelled] == test_kind[labelled]).float().mean()), 6)
        if real and n_kind_test
        else None
    )
```

5. In the `metrics` dict, add after `"kind_accuracy_synthetic": …,`:

```python
        "kind_accuracy_real": kind_accuracy_real,
        "n_kind_test": n_kind_test,
        "label_state": _label_state(ml_root) if real else None,
```

6. In the model card f-string, replace the line

```python
        f"{'- Labels: not reviewed by the suspects check' + chr(10) if real else ''}"
```

with

```python
        f"{label_state_lines(metrics['label_state'], kind_accuracy_real, n_kind_test) if real else ''}"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --directory ml pytest -q`
Expected: all pass. The smoke training test has `real_cells = false`, so it never builds a `LabelStore`.

- [ ] **Step 5: Lint and commit**

Run: `just lint-ml`

```bash
/usr/bin/git add ml/src/sudoku_ml/train.py ml/tests/test_train.py
/usr/bin/git commit -m "feat(ml): report kind label quality in the model card (#30)"
```

---

### Task 12: Documentation

**Files:**
- Modify: `docs/architecture/adr/adr-009-training-data-outside-git.md`
- Modify: `docs/architecture/00-DECISIONS.md`, `docs/architecture/09-architecture-decisions.md`
- Modify: `docs/architecture/12-glossary.md`
- Modify: `docs/architecture/00-concepts/model-contract.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `ml/README.md`

**Interfaces:** none.

- [ ] **Step 1: Amend ADR-009**

Insert this section before `## Consequences` in `adr-009-training-data-outside-git.md`:

```markdown
## Amendment: kind labels in an append-only log (2026-10-11)

- The kind of a real cell lives in `ml/datasets/kind-log.jsonl`, in git. Each line is one change:
  time, session, action, cell id, field, old value, new value and screen. Lines are never
  deleted. An undo or a rollback appends lines that reverse earlier lines.
- `cells.csv` gets a `kind` column: `printed`, `handwritten`, `unsure`, `none` or blank.
  `just dataset-manifest` computes it from the folders and the log. The folders stay the source
  of truth for the digit.
- The kind means how the mark was made: `printed` by a printer or a screen, `handwritten` by a
  person with a pen or a pencil. A typed player entry in an app screenshot is therefore
  `printed`.
- The blind check answers live in `ml/datasets/kind-check.jsonl`, in git. They never change a
  label.
- The log holds ids and words only, never an image (SUD-08).
- Design: `docs/superpowers/specs/2026-10-11-kind-labelling-design.md`.
```

- [ ] **Step 2: Update the decision rows**

In `00-DECISIONS.md`, change the ADR-009 row text to:

```markdown
| ADR-009 | Images outside git, a dataset manifest inside. Kind labels in an append-only log in git. DVC later. | Concept | 2026-10-09 | Felix | [ADR-009](adr/adr-009-training-data-outside-git.md) |
```

In `09-architecture-decisions.md`, change the ADR-009 row text to:

```markdown
| ADR-009 | Training images outside git, a versioned dataset manifest inside. Kind labels in an append-only log, amended 2026-10-11. DVC as the next step | Proposed | 2026-10-09 | [ADR-009](./adr/adr-009-training-data-outside-git.md) |
```

- [ ] **Step 3: Update the glossary**

In `12-glossary.md`:

- Change the "Kind head" row to: `| Kind head | The classifier output that says `none`, `printed`, `handwritten` or `notes`. The kind says how the mark was made: `printed` by a printer or a screen, `handwritten` by a person (ADR-009, amendment) |`
- Change the "Contact sheet" row to: `| Contact sheet | An image of numbered cells with their labels. Replaced by the Review screen of the labelling page |`
- Add these rows at the end of the table:

```markdown
| Kind log | `ml/datasets/kind-log.jsonl`: one line per label change, append-only. The source of truth for the kind of a real cell (ADR-009, amendment) |
| Labelling page | The local page of `just label-cells`, on 127.0.0.1 only. Screens: Groups, Review, Check and Progress |
| Review item | A cell whose label one of the checks doubts: near-duplicates disagree, the model disagrees, or the blind check disagrees |
| Check agreement | The share of blind check answers that match the label in the kind log. It estimates the label quality |
| Sureness | How much closer a cell is to its own group centre than to the next one. The Groups screen shows the least sure cells first |
| Unsure | The kind label for a cell that the developer cannot decide. Training ignores it |
```

- [ ] **Step 4: Update the model contract**

In `model-contract.md`, in the "Label format" section, replace the bullet that starts with `` `photo` means a cell cut from a sudoku photo`` with:

```markdown
- `photo` means a cell cut from a sudoku photo in `ml/data/`. Its kind comes from the kind log
  (`ml/datasets/kind-log.jsonl`, ADR-009 amendment), set on the labelling page. Cells in
  `ml/data/cells/unlabeled/` get a label by hand: `notes`, `empty` or a digit.
```

- [ ] **Step 5: Update R-13**

In `11-risks-and-technical-debt.md`, replace the last cell of the R-13 row with:

```markdown
The `just suspects` tool ranks the likely wrong digit and kind labels. The Review screen of the labelling page (`just label-cells`) is the label check. The retrain is still open.
```

- [ ] **Step 6: Update `ml/README.md`**

1. In "Commands", replace the `just suspects` and `just relabel` bullets with:

```markdown
- `just suspects`: rank the cells whose digit or kind label the model doubts most. The Review screen shows them.
- `just group-cells [run]`: group similar cells per digit folder for the labelling page.
- `just label-cells`: open the labelling page on 127.0.0.1.
- `just label-rollback <session>`: reverse every change of one labelling session.
- `just relabel [file]`: apply the labels from a relabel CSV to the cells.
```

2. In the tree under "Data", change `cells.csv                  id, label` to `cells.csv                  id, label, kind` and add the lines:

```
├── kind-log.jsonl             every kind and digit change, append-only
└── kind-check.jsonl           blind check answers
```

(Change the `└──` before `photos.csv` to `├──`.)

3. Replace the bullet "Cells carry a digit label only. The kind (printed, handwritten, notes) gets a label later (ADR-006)." with:

```markdown
- The kind of a cell comes from `kind-log.jsonl` (ADR-009, amendment). `printed` means made by
  a printer or a screen. `handwritten` means written by a person. Undecidable cells are `unsure`.
```

4. Replace the whole "Review suspect labels" section with:

```markdown
## Label the kind

1. Run `just group-cells`. It groups the cells of each digit folder.
2. Run `just label-cells`. The page opens in the browser.
3. On the Groups screen, press P or H for the whole screen. Click the exceptions. Press Enter.
4. After a labelling pass, run `just suspects`. Then work through the Review screen.
5. At least 7 days later, run the Check screen. It shows how often you agree with your labels.

Stop the server with Ctrl-C. `just label-cells` rewrites `cells.csv` before and after.
Commit `ml/datasets/kind-log.jsonl`, `kind-check.jsonl` and `cells.csv` after a session.
```

- [ ] **Step 7: Check the links**

Run: `just docs-check`
Expected: no broken links.

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add docs ml/README.md
/usr/bin/git commit -m "docs: record kind labels in an append-only log (#30)"
```

---

### Task 13: One folder end to end, then the pull request

**Files:**
- Modify: `ml/datasets/kind-log.jsonl`, `ml/datasets/cells.csv` (created by the developer's labelling)

**Interfaces:** none.

- [ ] **Step 1: Prepare the real data**

The `ml/data` symlink from Task 2 must exist. Copy the model run:

```bash
mkdir -p ml/artifacts && cp -r ~/projects/sudoku/ml/artifacts/20261009-210543-cell-classifier ml/artifacts/
```

Run: `just group-cells`
Expected: it prints about 14,045 (all cells in `1/` to `9/`). `ml/data/groups.json` exists.

- [ ] **Step 2: HUMAN STEP — label one folder**

Stop here. Ask the developer to run `just label-cells` and label the folder `7/` on the Groups screen. Ask them to report:
- the time it took
- whether 30 groups per folder felt right (open question in the spec)
- anything on the page that slowed them down

Wait for the answer. Fix page problems they report before you continue.

- [ ] **Step 3: Run the kind suspects**

Run: `just suspects`
Expected: `ml/data/review/suspects.csv` has digit rows and, for `7/`, kind rows below 0.10. Count the kind rows: `grep -c '^kind,' ml/data/review/suspects.csv`.

- [ ] **Step 4: HUMAN STEP — review**

Ask the developer to work through the Review screen. Ask whether the 0.10 threshold gave a sensible number of kind rows (open question in the spec).

- [ ] **Step 5: Run everything**

Run: `just test-ml && just lint-ml && just docs-check`
Expected: all pass.

- [ ] **Step 6: Commit the labels**

```bash
/usr/bin/git add ml/datasets/kind-log.jsonl ml/datasets/cells.csv
/usr/bin/git commit -m "chore(ml): kind labels for the 7 folder (#30)"
```

Check with `/usr/bin/git status --short` that nothing under `ml/data/` or `ml/artifacts/` is staged.

- [ ] **Step 7: Update the issue**

Tick the acceptance criteria of #30 that are met: `gh issue view 30`, then edit the body with `gh issue edit 30 --body-file <file>`. Answer the two open questions of the spec in the spec's "Open questions" table, with the developer's answers.

- [ ] **Step 8: Pull request and review**

Ask the developer before you push. Then push the branch and open a pull request against `develop` with `Closes #30` in the body. A second agent reviews the pull request without this session's context (`AGENTS.md`, work tracking rule 8). Fix its findings, or answer them in the pull request.

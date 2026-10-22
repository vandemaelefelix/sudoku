"""The doubt score of each open app cell (ADR-030, amendment 2026-10-22). A person checks every
uploaded cell. The score only sets the order of the Check cells screen, so the errors come first.
Writes ml/dataset/work/doubt.json. Each signal is stored on its own, so the page can say why."""

import json
import sys
from collections.abc import Callable
from pathlib import Path

import numpy as np

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.data_paths import ML_ROOT, DataPaths
from sudoku_ml.flatten import GRID_CELLS
from sudoku_ml.manifest import warn_unreadable
from sudoku_ml.tables import stem_of, write_atomic

# The weight of each signal. The score is the sum of the weights of the signals that fire.
WEIGHTS = {
    "edited": 1.0,
    "model-digit": 1.0,
    "model-kind": 0.5,
    "rule-break": 1.0,
    "not-unique": 0.5,
    "no-solution": 0.5,
}
LOW_CONFIDENCE = 0.9  # below this probability of its digit, a cell gets 1 - p
BOX = 3
# A grid with few givens and a deep contradiction can make the search exponential. The count
# then gives up, and the scan gets no solution signal.
MAX_STEPS = 200_000

# Cell files → (digit probabilities (N, 10), kind probabilities (N, 4)).
Predict = Callable[[list[Path]], tuple[np.ndarray, np.ndarray]]


def _units() -> list[list[int]]:
    rows = [[r * GRID_CELLS + c for c in range(GRID_CELLS)] for r in range(GRID_CELLS)]
    cols = [[r * GRID_CELLS + c for r in range(GRID_CELLS)] for c in range(GRID_CELLS)]
    boxes = [
        [(br + r) * GRID_CELLS + bc + c for r in range(BOX) for c in range(BOX)]
        for br in range(0, GRID_CELLS, BOX)
        for bc in range(0, GRID_CELLS, BOX)
    ]
    return rows + cols + boxes


UNITS = _units()
PEERS = [sorted({p for u in UNITS if i in u for p in u} - {i}) for i in range(81)]


def clashes(grid: list[int]) -> set[int]:
    """The places (0-80) whose digit (1-9) is twice in a row, a column or a box. 0 is empty."""
    found = set()
    for unit in UNITS:
        seen: dict[int, int] = {}
        for place in unit:
            digit = grid[place]
            if digit and digit in seen:
                found |= {place, seen[digit]}
            elif digit:
                seen[digit] = place
    return found


class TooHard(Exception):
    pass


def count_solutions(grid: list[int], limit: int = 2, max_steps: int = MAX_STEPS) -> int | None:
    """The number of solutions of a 9×9 grid (0 is empty), up to `limit`. A grid with a clash
    has 0. None when the search takes more than `max_steps` steps. Backtracking on the place
    with the fewest options."""
    if clashes(grid):
        return 0
    cells = list(grid)
    full = (1 << 10) - 2  # bits 1-9
    steps = [0]

    def options(place: int) -> int:
        used = 0
        for peer in PEERS[place]:
            used |= 1 << cells[peer]
        return full & ~used

    def solve() -> int:
        steps[0] += 1
        if steps[0] > max_steps:
            raise TooHard
        best, best_options = -1, 0
        for place in range(81):
            if cells[place] == 0:
                found = options(place)
                if found == 0:
                    return 0
                if best < 0 or found.bit_count() < best_options.bit_count():
                    best, best_options = place, found
                    if found.bit_count() == 1:
                        break
        if best < 0:
            return 1
        total = 0
        for digit in range(1, 10):
            if best_options >> digit & 1:
                cells[best] = digit
                total += solve()
                cells[best] = 0
                if total >= limit:
                    break
        return total

    try:
        return solve()
    except TooHard:
        return None


def _number(digit: str | None) -> int:
    return 0 if digit in (None, "empty") else int(digit)


def scan_signals(places: list[dict | None]) -> dict[int, list[dict]]:
    """The sudoku signals of one scan. `places` holds 81 entries in grid order: None for a
    place without a cell, else {"digit", "kind"}. Returns place → reasons."""
    grid = [_number(p["digit"]) if p else 0 for p in places]
    found: dict[int, list[dict]] = {}
    for place in clashes(grid):
        found.setdefault(place, []).append({"signal": "rule-break", "digit": str(grid[place])})
    givens = [_number(p["digit"]) if p and p["kind"] == "printed" else 0 for p in places]
    solutions = count_solutions(givens)
    if solutions is not None and solutions != 1:
        signal = "no-solution" if solutions == 0 else "not-unique"
        for place, entry in enumerate(places):
            # A missed digit hides in an empty place. A clash hides in a digit.
            if entry and (entry["digit"] == "empty") == (signal == "not-unique"):
                found.setdefault(place, []).append({"signal": signal})
    return found


def model_signals(digit: str, kind: str | None, digit_p: np.ndarray, kind_p: np.ndarray):
    """The model signals of one cell from its digit and kind probabilities."""
    found = []
    label = DIGIT_CLASSES.index(digit)
    read = int(digit_p.argmax())
    if read != label:
        found.append(
            {
                "signal": "model-digit",
                "predicted": DIGIT_CLASSES[read],
                "p": round(float(digit_p[read]), 4),
            }
        )
    p_label = float(digit_p[label])
    if p_label < LOW_CONFIDENCE:
        found.append({"signal": "low-confidence", "p": round(p_label, 4)})
    model_kind = KIND_CLASSES[int(kind_p.argmax())]
    if kind in ("printed", "handwritten") and model_kind in ("printed", "handwritten"):
        if model_kind != kind:
            found.append({"signal": "model-kind", "predicted": model_kind})
    return found


def score(reasons: list[dict]) -> float:
    total = 0.0
    for reason in reasons:
        if reason["signal"] == "low-confidence":
            total += 1 - reason["p"]
        else:
            total += WEIGHTS[reason["signal"]]
    return round(total, 4)


def score_cells(store, predict: Predict | None = None, run: str | None = None) -> dict:
    """The doubt of each open app cell of `store` (a LabelStore). Without `predict`, the model
    signals are left out. Returns the content of doubt.json."""
    open_cells = store.open_app_cells()
    reasons: dict[str, list[dict]] = {cell: [] for cell in open_cells}
    label_sources, kinds = store.label_sources(), store.kinds()
    for cell in open_cells:
        if label_sources.get(cell) == "app-edited":
            reasons[cell].append({"signal": "edited"})
    for photo, places in store.scan_grids().items():
        for place, found in scan_signals(places).items():
            cell = places[place]["id"]
            if cell not in reasons:
                continue
            known = {r["signal"] for r in reasons[cell]}
            for reason in found:
                if reason["signal"] not in known:
                    reasons[cell].append({**reason, "scan": stem_of(photo)})
                    known.add(reason["signal"])
    if predict is not None and open_cells:
        digit_p, kind_p = predict([store.cell_file(stem_of(c)) for c in open_cells])
        for i, cell in enumerate(open_cells):
            reasons[cell] += model_signals(
                store.folder[cell], kinds.get(cell), digit_p[i], kind_p[i]
            )
    return {
        "run": run,
        "cells": {c: {"score": score(found), "reasons": found} for c, found in reasons.items()},
    }


def read_doubt(path: Path) -> dict:
    """The content of doubt.json, or an empty one. A broken file is derived, so it is empty."""
    if not path.exists():
        return {"run": None, "cells": {}}
    try:
        value = json.loads(path.read_text())
        if isinstance(value.get("cells"), dict):
            return value
        raise ValueError("no cells")
    except (OSError, ValueError, AttributeError) as error:
        warn_unreadable(path, error)
        return {"run": None, "cells": {}}


def write_doubt(store, run_path: Path | None) -> int:
    """Score every open app cell and write doubt.json. Returns the number of scored cells."""
    predict = None
    if run_path is not None and (run_path / "model.pt").exists():
        from sudoku_ml.prelabel import predict_probs

        def predict(paths):
            return predict_probs(run_path, paths)

    value = score_cells(store, predict, run_path.name if predict else None)
    write_atomic(store.paths.doubt, json.dumps(value))
    return len(value["cells"])


def current_run(ml_root: Path = ML_ROOT) -> Path | None:
    """The run of the model that the app uses, or None without one."""
    from sudoku_ml.grouping import default_run

    try:
        run = default_run(ml_root)
    except (OSError, KeyError, ValueError):
        return None
    return run if (run / "model.pt").exists() else None


def main(argv: list[str], paths: DataPaths | None = None, ml_root: Path = ML_ROOT) -> int:
    from sudoku_ml.label_store import LabelStore

    run = ml_root / argv[1] if len(argv) > 1 and argv[1] else current_run(ml_root)
    try:
        store = LabelStore(paths or DataPaths.under())
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    count = write_doubt(store, run)
    model = run.name if run is not None and (run / "model.pt").exists() else "no model"
    print(f"Scored {count} open app cells ({model}).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

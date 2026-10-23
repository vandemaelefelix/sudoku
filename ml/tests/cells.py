"""Cell stores and journal lines for the label tests."""

import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.journal import Line
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.tables import pixel_id

Guess = tuple[str, float, str, float]  # digit, p of the digit, kind, p of the kind


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


def build(tmp_path: Path, folders: dict[str, int]):
    """folders: folder → number of cells."""
    paths = DataPaths.under(tmp_path / "data", tmp_path / "images")
    cells = paths.cells
    ids: dict[str, list[str]] = {}
    seed = 0
    for folder, count in folders.items():
        ids[folder] = []
        for _ in range(count):
            seed += 1
            ids[folder].append(add_cell(cells, folder, pattern(seed)))
    write_cells_manifest(paths)
    paths.work.mkdir(parents=True)
    return paths, ids


def kinds_of(ids: list[str], kind: str) -> list[dict]:
    return [{"id": c, "kind": kind} for c in ids]


def save_kinds(store: LabelStore, entries: list[dict], screen: str = "groups") -> int:
    """Kind lines of a screen: a line per changed or new kind. The Kind step and the Groups
    screen of older journals write them like this."""
    kinds, t, action = store.kinds(), store._t(), store._action()
    lines = [
        Line(t, store.session, action, e["id"], "kind", kinds.get(e["id"]), e["kind"], screen)
        for e in entries
        if kinds.get(e["id"]) != e["kind"]
    ]
    store._write(lines)
    return len(lines)


def settle_kinds(store: LabelStore) -> int:
    """Confirm every open kind cell, as the Kind step does before a Finish."""
    cells = [{"id": c["id"], "kind": c["kind"] or "printed"} for c in store.open_kind_cells()]
    return store.confirm_kinds(cells) if cells else 0


def move_digit(store: LabelStore, cell: str, digit: str, screen: str) -> None:
    """A digit line of a screen that no step writes any more. A move to `empty` also clears
    the kind, as the old Groups screen did."""
    store._refresh()
    old = store.folder[cell]
    if old == digit:
        return
    t, action = store._t(), store._action()
    lines = [Line(t, store.session, action, cell, "digit", old, digit, screen)]
    kind = store.kinds().get(cell)
    if digit == "empty" and kind is not None:
        lines.append(Line(t, store.session, action, cell, "kind", kind, None, screen))
    store._apply_digits(lines)
    store._write(lines)


def probs(label: str, p: float, kind: str = "printed", kp: float = 0.9) -> dict:
    digit = [(1 - p) / 9] * 10
    digit[DIGIT_CLASSES.index(label)] = p
    printed, handwritten = (kp, 1 - kp) if kind == "printed" else (1 - kp, kp)
    return {"digit": digit, "kind": [0.0, printed, handwritten, 0.0]}


def prelabel(paths: DataPaths, guesses: dict[str, Guess]) -> None:
    """Write prelabels.json as the model run `test` would."""
    cells = {
        cell: {"digit": d, "p": p, "kind": k, "kp": kp, "probs": probs(d, p, k, kp)}
        for cell, (d, p, k, kp) in guesses.items()
    }
    paths.prelabels.write_text(json.dumps({"run": "test", "cells": cells}))

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.journal import Line
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.tables import pixel_id


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
    folders_json = {
        f: [
            {"cells": [ids[f][i] for i in g], "sureness": [float(n) for n in range(len(g))]}
            for g in gs
        ]
        for f, gs in groups.items()
    }
    groups_json = {"run": "test", "seed": 0, "k": 2, "folders": folders_json}
    paths.groups.write_text(json.dumps(groups_json))
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


def test_a_move_to_empty_clears_the_kind_and_undo_restores_it(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    cell = ids["7"][0]
    store = LabelStore(paths, Clock())
    save_kinds(store, kinds_of([cell], "printed"))
    store.move(cell, "empty", "groups")
    assert (paths.cells / "empty" / f"{cell[:16]}.png").exists()
    assert store.folder[cell] == "empty" and store.kinds()[cell] is None
    assert store.undo() == 2
    assert (paths.cells / "7" / f"{cell[:16]}.png").exists()
    assert store.kinds()[cell] == "printed"


def test_the_store_reads_cells_missing_from_the_manifest(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    cell_id = add_cell(paths.cells, "7", pattern(999))
    assert LabelStore(paths, Clock()).folder[cell_id] == "7"


def test_the_store_refuses_a_misnamed_cell(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    stray = paths.cells / "7" / ("f" * 16 + ".png")
    Image.fromarray(pattern(998)).save(stray)
    with pytest.raises(ValueError, match="not named after its pixels"):
        LabelStore(paths, Clock())


def test_review_merges_the_reasons_of_one_cell(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    cell = ids["7"][0]
    store = LabelStore(paths, Clock())
    save_kinds(store, kinds_of([cell], "printed"))
    paths.suspects.parent.mkdir(parents=True, exist_ok=True)
    paths.suspects.write_text(
        "field,file,label,predicted,p_label,p_predicted\n"
        f"kind,{cell[:16]},printed,handwritten,0.02,0.98\n"
        f"digit,{cell[:16]},7,1,0.01,0.99\n"
    )
    items = store.review_items()
    assert [(i["field"], [r["reason"] for r in i["reasons"]]) for i in items] == [
        ("kind", ["kind-model"]),
        ("digit", ["digit-model"]),
    ]


def test_rollback_moves_files_back_and_restores_kinds(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    cell = ids["7"][0]
    first = LabelStore(paths, Clock())
    save_kinds(first, kinds_of([cell], "printed"))
    first.move(cell, "1", "groups")
    later = Clock()
    later.moment += timedelta(hours=1)
    second = LabelStore(paths, later)
    assert second.rollback(first.session) == 2
    assert (paths.cells / "7" / f"{cell[:16]}.png").exists()
    assert second.kinds().get(cell) is None


def test_a_rollback_from_another_process_reaches_the_running_store(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    cell = ids["7"][0]
    first = LabelStore(paths, Clock())
    save_kinds(first, kinds_of([cell], "printed"))
    first.move(cell, "1", "groups")
    later = Clock()
    later.moment += timedelta(hours=1)
    running = LabelStore(paths, later)
    assert running.folder[cell] == "1" and running.kinds()[cell] == "printed"
    other = Clock()
    other.moment += timedelta(hours=2)
    LabelStore(paths, other).rollback(first.session)
    running.status()
    assert running.folder[cell] == "7" and running.kinds().get(cell) is None
    assert running.cell_file(cell[:16]).exists()
    assert save_kinds(running, kinds_of([cell], "printed")) == 1


@pytest.mark.parametrize(("other", "expected"), [("7", 2), ("1", 0)])
def test_near_duplicates_count_only_inside_one_folder(tmp_path: Path, other: str, expected: int):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    twin = pattern(1)
    twin[0, 0, 0] ^= 1
    twin_id = add_cell(paths.cells, other, twin)
    write_cells_manifest(paths)
    store = LabelStore(paths, Clock())
    save_kinds(store, kinds_of(ids["7"], "printed") + kinds_of([twin_id], "handwritten"))
    reasons = [r["reason"] for i in store.review_items() for r in i["reasons"]]
    assert reasons == ["near-duplicate"] * expected

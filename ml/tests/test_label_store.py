import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.journal import read_journal
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
    store.save(kinds_of(ids["7"][:2], "handwritten") + kinds_of(ids["7"][2:3], "printed"), "groups")
    cells = store.screen("7", 0, 0)["cells"]
    assert [c["id"] for c in cells] == ids["7"][3:]
    assert cells[0]["start"] == "handwritten" and cells[0]["kind"] is None


def test_a_screen_shows_only_cells_without_a_kind_until_every_cell_has_one(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 3}, {"7": [[0, 1, 2]]})
    store = LabelStore(paths, Clock())
    store.save(kinds_of(ids["7"][:2], "printed"), "groups")
    assert [c["id"] for c in store.screen("7", 0, 0)["cells"]] == ids["7"][2:]
    store.save(kinds_of(ids["7"][2:], "printed"), "groups")
    assert [c["id"] for c in store.screen("7", 0, 0)["cells"]] == ids["7"]
    assert store.next_screen() is None


def test_a_save_logs_only_changed_or_new_cells(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    store = LabelStore(paths, Clock())
    store.save(kinds_of(ids["7"][:1], "printed"), "groups")
    entries = kinds_of(ids["7"][:1], "printed") + kinds_of(ids["7"][1:], "unsure")
    assert store.save(entries, "groups") == 1
    assert [(x.cell, x.new) for x in read_journal(paths.journal)] == [
        (ids["7"][0], "printed"),
        (ids["7"][1], "unsure"),
    ]


def test_a_review_save_logs_confirmations_too(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    store = LabelStore(paths, Clock())
    store.save(kinds_of(ids["7"], "printed"), "groups")
    assert store.save(kinds_of(ids["7"], "printed"), "review", [ids["7"][0]]) == 2
    last = read_journal(paths.journal)[-2:]
    assert [(x.field, x.old, x.new, x.screen) for x in last] == [
        ("kind", "printed", "printed", "review"),
        ("digit", "7", "7", "review"),
    ]


def test_a_save_refuses_a_bad_kind_or_an_empty_cell(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1, "empty": 1}, {"7": [[0]]})
    store = LabelStore(paths, Clock())
    with pytest.raises(ValueError, match="unknown kind"):
        store.save(kinds_of(ids["7"], "notes"), "groups")
    with pytest.raises(ValueError, match="digit folder"):
        store.save(kinds_of(ids["empty"], "printed"), "groups")
    assert read_journal(paths.journal) == []


def test_a_move_to_empty_clears_the_kind_and_undo_restores_it(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    cell = ids["7"][0]
    store = LabelStore(paths, Clock())
    store.save(kinds_of([cell], "printed"), "groups")
    store.move(cell, "empty", "groups")
    assert (paths.cells / "empty" / f"{cell[:16]}.png").exists()
    assert [c["id"] for c in store.screen("7", 0, 0)["cells"]] == [ids["7"][1]]
    assert store.undo() == 2
    assert (paths.cells / "7" / f"{cell[:16]}.png").exists()
    assert store.kinds()[cell] == "printed"


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
    store.save(kinds_of(ids["7"][:1], "printed"), "groups")
    assert store.next_screen()["group"] == 1
    assert store.next_screen(("7", 1, 0))["group"] == 1
    store.save(kinds_of(ids["7"][1:], "printed"), "groups")
    assert store.next_screen() is None


def test_a_large_group_takes_several_screens(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 60}, {"7": [list(range(60))]})
    store = LabelStore(paths, Clock())
    first, second = store.screen("7", 0, 0), store.screen("7", 0, 1)
    assert (len(first["cells"]), len(second["cells"]), first["pages"]) == (50, 10, 2)
    assert sum(c["least_sure"] for c in first["cells"]) == 6


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
    store.save(kinds_of([cell], "printed"), "groups")
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
    first.save(kinds_of([cell], "printed"), "groups")
    first.move(cell, "1", "groups")
    later = Clock()
    later.moment += timedelta(hours=1)
    second = LabelStore(paths, later)
    assert second.rollback(first.session) == 2
    assert (paths.cells / "7" / f"{cell[:16]}.png").exists()
    assert second.screen("7", 0, 0)["cells"][0]["kind"] is None


def test_a_rollback_from_another_process_reaches_the_running_store(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    cell = ids["7"][0]
    first = LabelStore(paths, Clock())
    first.save(kinds_of([cell], "printed"), "groups")
    first.move(cell, "1", "groups")
    later = Clock()
    later.moment += timedelta(hours=1)
    running = LabelStore(paths, later)
    assert running.next_screen() is None
    other = Clock()
    other.moment += timedelta(hours=2)
    LabelStore(paths, other).rollback(first.session)
    screen = running.next_screen()
    assert screen["folder"] == "7" and screen["cells"][0]["kind"] is None
    assert running.cell_file(cell[:16]).exists()
    assert running.save(kinds_of([cell], "printed"), "groups") == 1


@pytest.mark.parametrize(("other", "expected"), [("7", 2), ("1", 0)])
def test_near_duplicates_count_only_inside_one_folder(tmp_path: Path, other: str, expected: int):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    twin = pattern(1)
    twin[0, 0, 0] ^= 1
    twin_id = add_cell(paths.cells, other, twin)
    write_cells_manifest(paths)
    store = LabelStore(paths, Clock())
    store.save(kinds_of(ids["7"], "printed") + kinds_of([twin_id], "handwritten"), "groups")
    reasons = [r["reason"] for i in store.review_items() for r in i["reasons"]]
    assert reasons == ["near-duplicate"] * expected

from datetime import timedelta
from pathlib import Path

import pytest
from cells import Clock, add_cell, build, kinds_of, move_digit, pattern, save_kinds
from PIL import Image

from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest


def test_a_move_to_empty_clears_the_kind_and_undo_restores_it(tmp_path: Path, make_store):
    paths, ids = build(tmp_path, {"7": 2})
    cell = ids["7"][0]
    store = make_store(paths)
    save_kinds(store, kinds_of([cell], "printed"))
    move_digit(store, cell, "empty", "groups")
    assert (paths.cells / "empty" / f"{cell[:16]}.png").exists()
    assert store.folder[cell] == "empty" and store.kinds()[cell] is None
    assert store.undo() == 2
    assert (paths.cells / "7" / f"{cell[:16]}.png").exists()
    assert store.kinds()[cell] == "printed"


def test_the_store_reads_cells_missing_from_the_manifest(tmp_path: Path, make_store):
    paths, _ = build(tmp_path, {"7": 1})
    cell_id = add_cell(paths.cells, "7", pattern(999))
    assert make_store(paths).folder[cell_id] == "7"


def test_the_store_refuses_a_misnamed_cell(tmp_path: Path, make_store):
    paths, _ = build(tmp_path, {"7": 1})
    stray = paths.cells / "7" / ("f" * 16 + ".png")
    Image.fromarray(pattern(998)).save(stray)
    with pytest.raises(ValueError, match="not named after its pixels"):
        make_store(paths)


def test_review_merges_the_reasons_of_one_cell(tmp_path: Path, make_store):
    paths, ids = build(tmp_path, {"7": 2})
    cell = ids["7"][0]
    store = make_store(paths)
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


def test_rollback_moves_files_back_and_restores_kinds(tmp_path: Path, make_store):
    paths, ids = build(tmp_path, {"7": 1})
    cell = ids["7"][0]
    first = make_store(paths)
    save_kinds(first, kinds_of([cell], "printed"))
    move_digit(first, cell, "1", "groups")
    later = Clock()
    later.moment += timedelta(hours=1)
    second = LabelStore(paths, later)
    assert second.rollback(first.session) == 2
    assert (paths.cells / "7" / f"{cell[:16]}.png").exists()
    assert second.kinds().get(cell) is None


def test_a_rollback_from_another_process_reaches_the_running_store(tmp_path: Path, make_store):
    paths, ids = build(tmp_path, {"7": 1})
    cell = ids["7"][0]
    first = make_store(paths)
    save_kinds(first, kinds_of([cell], "printed"))
    move_digit(first, cell, "1", "groups")
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
def test_near_duplicates_count_only_inside_one_folder(
    tmp_path: Path, other: str, expected: int, make_store
):
    paths, ids = build(tmp_path, {"7": 1})
    twin = pattern(1)
    twin[0, 0, 0] ^= 1
    twin_id = add_cell(paths.cells, other, twin)
    write_cells_manifest(paths)
    store = make_store(paths)
    save_kinds(store, kinds_of(ids["7"], "printed") + kinds_of([twin_id], "handwritten"))
    reasons = [r["reason"] for i in store.review_items() for r in i["reasons"]]
    assert reasons == ["near-duplicate"] * expected

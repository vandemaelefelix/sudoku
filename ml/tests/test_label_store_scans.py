from pathlib import Path

import pytest
from cells import Clock, settle_kinds
from scans import CORNERS, places, pulled, shared_cells

from sudoku_ml.data_check import check_data
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.dataset import load_cells
from sudoku_ml.finish import finish
from sudoku_ml.journal import read_journal
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import confirmed_cells
from sudoku_ml.scan_outlines import main as reset_main
from sudoku_ml.scan_outlines import read_scores
from sudoku_ml.tables import read_cells, read_photos, stem_of, write_photos

# Half a cell too far right and down: every cell of the scan is cut wrong.
OFF = [[x + 0.03, y + 0.035] for x, y in CORNERS]
PHOTO_SIZE = (1000, 800)  # of grid_photo
GOOD_PIXELS = [[x * PHOTO_SIZE[0], y * PHOTO_SIZE[1]] for x, y in CORNERS]


def labels_of(store: LabelStore, cells: list[str]) -> list[tuple[str, str | None]]:
    """The folder (the digit) and the kind of each cell."""
    kinds = store.kinds()
    return [(store.folder[c], kinds.get(c)) for c in cells]


def edited_of(store: LabelStore, cells: list[str]) -> list[bool]:
    sources = store.label_sources()
    return [sources.get(c) == "app-edited" for c in cells]


def confirm_open_digits(store: LabelStore) -> None:
    """Confirm every open digit cell as it is, as the Digits step does."""
    store.confirm_digits([{"id": c["id"], "digit": c["digit"]} for c in store.open_cells()])


def statuses(paths: DataPaths) -> list[tuple[str, bool]]:
    return [(p.status, bool(p.corners)) for p in read_photos(paths.photos_csv)]


def test_a_pull_leaves_the_outline_unchecked_and_the_data_check_accepts_it(tmp_path: Path):
    store, paths, photos = pulled(tmp_path)
    assert statuses(paths) == [("unchecked", True), ("unchecked", True)]
    assert check_data(paths)["problems"] == []
    screen = store.outline_screen()
    assert screen["open"] == 2 and {s["photo"] for s in screen["scans"]} == set(photos)
    assert store.status()["outlines"] == 2


def test_the_most_doubtful_outline_comes_first_and_its_score_is_stored(tmp_path: Path):
    store, paths, photos = pulled(tmp_path, corners=(CORNERS, OFF))
    scans = store.outline_screen()["scans"]
    assert [s["photo"] for s in scans] == [photos[1], photos[0]]
    assert scans[0]["fit"] < scans[1]["fit"]
    assert {stem_of(p) for p in read_scores(paths.outline_scores)} == set(photos)


def test_the_large_view_and_the_thumbnail(tmp_path: Path):
    store, _, photos = pulled(tmp_path)
    one = store.outline(photos[0])
    assert (one["width"], one["height"]) == PHOTO_SIZE and one["status"] == "unchecked"
    assert store.photo_jpeg(photos[0])[:2] == b"\xff\xd8"


def test_approve_is_one_action_and_finish_writes_accepted(tmp_path: Path):
    store, paths, photos = pulled(tmp_path)
    assert store.approve_outlines(photos) == 2
    lines = read_journal(paths.journal)
    assert {(x.field, x.screen) for x in lines} == {("outline", "outlines")}
    assert len({x.action for x in lines}) == 1
    assert store.outline_screen()["open"] == 0
    assert check_data(paths)["problems"] == []
    assert finish(store)["report"]["problems"] == []
    assert statuses(paths) == [("accepted", True), ("accepted", True)]
    assert store.outline_screen()["open"] == 0


def test_an_approved_scan_cannot_be_approved_again(tmp_path: Path):
    store, paths, photos = pulled(tmp_path)
    store.approve_outlines(photos[:1])
    with pytest.raises(ValueError, match="already checked"):
        store.approve_outlines(photos)
    assert len(read_journal(paths.journal)) == 1


def test_a_fix_cuts_the_cells_again_with_the_labels_of_their_places(tmp_path: Path):
    store, paths, photos = pulled(tmp_path, corners=(OFF,))
    before = places(store, photos[0])
    labels, edited = labels_of(store, before), edited_of(store, before)
    result = store.fix_outline(photos[0], GOOD_PIXELS)
    assert result["cells"] + result["kept"] == 81 and result["cells"] > 0
    assert result["discarded"] == result["cells"]
    outline = store.outline(photos[0])
    assert outline["status"] == "accepted" and outline["corners"] == GOOD_PIXELS
    after = places(store, photos[0])
    assert labels_of(store, after) == labels
    for old, new in zip(before, after, strict=True):
        if new != old:
            assert store.folder[old] == "discarded"
            assert (paths.cells / store.folder[new] / f"{stem_of(new)}.png").exists()
    assert store.outline_screen()["open"] == 0
    # A cut again moves files. No person looked at the cells, so none of them is reviewed.
    assert not set(after) & confirmed_cells(store.lines)
    assert "verified" not in {store.label_sources().get(c) for c in after}
    assert edited_of(store, after) == edited
    assert finish(store)["report"]["problems"] == []
    rows = read_cells(paths.cells_csv)
    assert {rows[c].label_source for c in after} == {"app-edited", "app-unedited"}
    [photo] = read_photos(paths.photos_csv)
    assert photo.status == "accepted"
    assert photo.corners == "200.0 100.0 740.0 100.0 740.0 640.0 200.0 640.0"


def test_undo_of_a_fix_puts_every_file_back(tmp_path: Path):
    store, paths, photos = pulled(tmp_path, corners=(OFF,))
    files = sorted(str(p.relative_to(paths.cells)) for p in paths.cells.glob("*/*.png"))
    result = store.fix_outline(photos[0], GOOD_PIXELS)
    store.undo()
    here = sorted(str(p.relative_to(paths.cells)) for p in paths.cells.glob("*/*.png"))
    new_files = [p for p in here if p not in files]
    assert len(new_files) == result["cells"] and all(p.startswith("discarded/") for p in new_files)
    assert set(files) <= set(here)
    assert store.outline(photos[0])["status"] == "unchecked"
    assert finish(store)["report"]["problems"] == []
    assert statuses(paths) == [("unchecked", True)]


def test_a_fix_after_an_undone_fix_brings_the_cells_back(tmp_path: Path):
    store, paths, photos = pulled(tmp_path, corners=(OFF,))
    labels = labels_of(store, places(store, photos[0]))
    store.fix_outline(photos[0], GOOD_PIXELS)
    store.undo()
    result = store.fix_outline(photos[0], GOOD_PIXELS)
    assert result["cells"] == 81 and result["kept"] == 0
    cells = places(store, photos[0])
    assert all(store.folder[c] != "discarded" for c in cells)
    assert labels_of(store, cells) == labels
    assert finish(store)["report"]["problems"] == []
    assert load_cells(paths) == []


def test_a_discarded_cell_of_another_scan_stays_discarded_after_a_fix(tmp_path: Path):
    store, _, photos = pulled(tmp_path, corners=(CORNERS, CORNERS))
    shared = shared_cells(store, photos[1])
    store.reject_outline(photos[0])
    result = store.fix_outline(photos[1], GOOD_PIXELS)
    assert result["kept"] >= len(shared)
    assert all(store.folder[cell] == "discarded" for cell in shared)


def test_reject_moves_the_cells_out_of_training(tmp_path: Path):
    store, paths, photos = pulled(tmp_path, corners=(OFF,))
    store.reject_outline(photos[0])
    assert len(list((paths.cells / "discarded").glob("*.png"))) == 81
    assert store.outline_screen()["open"] == 0
    assert finish(store)["report"]["problems"] == []
    assert statuses(paths) == [("rejected", False)]
    assert load_cells(paths) == []
    assert "verified" not in {r.label_source for r in read_cells(paths.cells_csv).values()}


def test_undo_of_a_reject_shows_the_scan_again(tmp_path: Path):
    store, paths, photos = pulled(tmp_path)
    store.reject_outline(photos[0])
    store.undo()
    assert not list((paths.cells / "discarded").glob("*.png"))
    assert store.outline_screen()["open"] == 2


def test_a_scan_cell_trains_only_after_its_outline_and_its_label_are_checked(tmp_path: Path):
    store, paths, photos = pulled(tmp_path, corners=(CORNERS,))
    assert load_cells(paths) == []
    store.approve_outlines(photos)
    finish(store)
    assert load_cells(paths) == []
    confirm_open_digits(store)
    settle_kinds(store)
    finish(store)
    assert len(load_cells(paths)) == 81


def test_a_stop_keeps_the_saved_outline_checks(tmp_path: Path):
    store, paths, photos = pulled(tmp_path)
    store.approve_outlines(photos[:1])
    assert LabelStore(paths, Clock()).outline_screen()["open"] == 1


def test_the_reset_sets_the_accepted_scans_of_the_first_pull_to_unchecked(tmp_path: Path):
    _, paths, _ = pulled(tmp_path)
    rows = read_photos(paths.photos_csv)
    write_photos(
        paths.photos_csv, [r.__class__(**{**r.__dict__, "status": "accepted"}) for r in rows]
    )
    assert reset_main([], paths) == 0
    assert statuses(paths) == [("unchecked", True), ("unchecked", True)]


def test_the_reset_refuses_while_outline_checks_are_unfinished(tmp_path: Path):
    store, paths, photos = pulled(tmp_path)
    store.approve_outlines(photos[:1])
    assert reset_main([], paths) == 1


def test_a_new_start_reads_approved_scans_from_an_unfinished_journal(tmp_path: Path):
    # The developer's journal holds outline approvals without a Finish. A new start reads it as is.
    store, paths, photos = pulled(tmp_path)
    store.approve_outlines(photos)
    journal = paths.journal.read_bytes()
    again = LabelStore(paths, Clock())
    assert paths.journal.read_bytes() == journal
    open_cells = again.open_cells()
    first = [c for c in open_cells if c["photo"] == photos[0]]
    second = [c for c in open_cells if c["photo"] == photos[1]]
    assert len(first) == 81 and sum(c["edited"] for c in first) == 1
    assert 0 < len(second) < 81  # the shared cells belong to the first scan
    assert again.status()["digit_cells"] == len(open_cells)
    confirm_open_digits(again)
    assert again.open_cells() == []
    settle_kinds(again)
    assert finish(again)["report"]["problems"] == []
    assert again.open_cells() == []


def test_unchecked_and_rejected_scans_hold_no_open_cell(tmp_path: Path):
    store, _, photos = pulled(tmp_path)
    assert store.open_cells() == []
    store.reject_outline(photos[0])
    assert store.open_cells() == []


def test_confirmed_cells_leave_the_open_cells_and_undo_brings_them_back(tmp_path: Path):
    store, _, photos = pulled(tmp_path)
    store.approve_outlines(photos)
    open_before = {c["id"] for c in store.open_cells()}
    confirm_open_digits(store)
    assert store.open_cells() == [] and store.status()["digit_cells"] == 0
    store.undo()
    assert {c["id"] for c in store.open_cells()} == open_before

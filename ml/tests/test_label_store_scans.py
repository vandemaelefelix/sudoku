from decimal import Decimal
from pathlib import Path

import pytest
from test_label_store import Clock, settle_kinds
from test_pull_scans import CORNERS, SCAN_A, SCAN_B, FakeBucket, FakeTable, jpeg, record

from sudoku_ml.data_check import check_data
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.dataset import load_cells
from sudoku_ml.finish import finish
from sudoku_ml.journal import read_journal
from sudoku_ml.label_store import LabelStore
from sudoku_ml.pull_scans import pull_scans
from sudoku_ml.relabel import move_cells
from sudoku_ml.scan_outlines import main as reset_main
from sudoku_ml.scan_outlines import read_scores
from sudoku_ml.tables import read_cells, read_photos, stem_of, write_photos

# Half a cell too far right and down: every cell of the scan is cut wrong.
OFF = [[x + 0.03, y + 0.035] for x, y in CORNERS]
PHOTO_SIZE = (1000, 800)  # of grid_photo
GOOD_PIXELS = [[x * PHOTO_SIZE[0], y * PHOTO_SIZE[1]] for x, y in CORNERS]


def pulled(tmp_path: Path, corners=(CORNERS, CORNERS)) -> tuple[LabelStore, DataPaths, list[str]]:
    """A temporary dataset with one pulled scan per entry of `corners`, oldest first. Cell 2 of
    each scan is `app-edited`."""
    paths = DataPaths.under(tmp_path / "data", tmp_path / "images")
    paths.cells.mkdir(parents=True)
    ids = [SCAN_A, SCAN_B][: len(corners)]
    items = [
        record(
            scan,
            edited_cells=(2,),
            scanId=scan,
            corners=[[Decimal(str(v)) for v in point] for point in quad],
        )
        for scan, quad in zip(ids, corners, strict=True)
    ]
    bucket = FakeBucket({f"scans/{scan}.jpg": jpeg(n + 1) for n, scan in enumerate(ids)})
    pull_scans(paths, FakeTable(items), bucket)
    photos = [stem_of(p.photo_id) for p in read_photos(paths.photos_csv)]
    return LabelStore(paths, Clock()), paths, photos


def statuses(paths: DataPaths) -> list[tuple[str, bool]]:
    return [(p.status, bool(p.corners)) for p in read_photos(paths.photos_csv)]


def entries(screen: dict, **changes: tuple[str, str | None]) -> list[dict]:
    """The own cells of a scan view as the page sends them. changes: `c<index>` → (digit, kind)."""
    found = []
    for index, cell in enumerate(screen["cells"]):
        if "id" not in cell or cell["shared"] or cell["locked"]:
            continue
        digit, kind = changes.get(f"c{index}", (cell["digit"], cell["kind"]))
        found.append({"id": cell["id"], "digit": digit, "kind": kind})
    return found


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
    before = store.scan_screen(photos[0])["cells"]
    result = store.fix_outline(photos[0], GOOD_PIXELS)
    assert result["cells"] + result["kept"] == 81 and result["cells"] > 0
    assert result["discarded"] == result["cells"]
    after = store.scan_screen(photos[0])
    assert after["status"] == "accepted" and after["corners"] == GOOD_PIXELS
    for old, new in zip(before, after["cells"], strict=True):
        assert (new["digit"], new["kind"]) == (old["digit"], old["kind"])
        if new["id"] != old["id"]:
            assert store.folder[old["id"]] == "discarded"
            assert (paths.cells / new["digit"] / f"{new['stem']}.png").exists()
    assert store.outline_screen()["open"] == 0
    # A cut again moves files. No person looked at the cells, so none of them is reviewed.
    assert not any(c["reviewed"] for c in after["cells"])
    assert [c["edited"] for c in after["cells"]] == [c["edited"] for c in before]
    assert finish(store)["report"]["problems"] == []
    rows = read_cells(paths.cells_csv)
    assert {rows[c["id"]].label_source for c in after["cells"]} == {"app-edited", "app-unedited"}
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
    before = store.scan_screen(photos[0])["cells"]
    store.fix_outline(photos[0], GOOD_PIXELS)
    store.undo()
    result = store.fix_outline(photos[0], GOOD_PIXELS)
    assert result["cells"] == 81 and result["kept"] == 0
    cells = store.scan_screen(photos[0])["cells"]
    assert all(store.folder[c["id"]] != "discarded" for c in cells)
    assert [(c["digit"], c["kind"]) for c in cells] == [(c["digit"], c["kind"]) for c in before]
    assert finish(store)["report"]["problems"] == []
    assert load_cells(paths) == []


def test_a_discarded_cell_of_another_scan_stays_discarded_after_a_fix(tmp_path: Path):
    store, _, photos = pulled(tmp_path, corners=(CORNERS, CORNERS))
    shared = [c["id"] for c in store.scan_screen(photos[1])["cells"] if c["shared"]]
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
    store.confirm_scan(photos[0], entries(store.scan_screen(photos[0])))
    settle_kinds(store)
    finish(store)
    assert len(load_cells(paths)) == 81


def test_a_shared_cell_shows_with_its_existing_label_not_as_a_gap(tmp_path: Path):
    store, _, photos = pulled(tmp_path)
    cells = store.scan_screen(photos[1])["cells"]
    assert len(cells) == 81 and not any(c.get("missing") for c in cells)
    shared = [c for c in cells if c["shared"]]
    assert shared and all(c["shared"] == photos[0] for c in shared)
    assert all(store.folder[c["id"]] == c["digit"] for c in shared)


def test_confirm_needs_an_approved_outline_and_skips_shared_cells(tmp_path: Path):
    store, _, photos = pulled(tmp_path)
    screen = store.scan_screen(photos[1])
    with pytest.raises(ValueError, match="approve the outline first"):
        store.confirm_scan(photos[1], entries(screen))
    store.approve_outlines(photos)
    own = entries(screen)
    assert store.confirm_scan(photos[1], own) == len(own) < 81
    assert all(c["reviewed"] for c in store.scan_screen(photos[1])["cells"] if not c["shared"])


def test_confirm_moves_a_changed_digit_and_logs_a_changed_kind(tmp_path: Path):
    store, paths, photos = pulled(tmp_path, corners=(CORNERS,))
    store.approve_outlines(photos)
    screen = store.scan_screen(photos[0])
    cell = screen["cells"][0]["id"]
    store.confirm_scan(photos[0], entries(screen, c0=("7", "handwritten")))
    assert (paths.cells / "7" / f"{stem_of(cell)}.png").exists()
    assert store.kinds()[cell] == "handwritten"
    settle_kinds(store)
    finish(store)
    assert read_cells(paths.cells_csv)[cell].label_source == "verified"


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
    assert reset_main(paths) == 0
    assert statuses(paths) == [("unchecked", True), ("unchecked", True)]


def test_the_reset_refuses_while_outline_checks_are_unfinished(tmp_path: Path):
    store, paths, photos = pulled(tmp_path)
    store.approve_outlines(photos[:1])
    assert reset_main(paths) == 1


def test_the_scan_list_reads_approved_scans_from_an_unfinished_journal(tmp_path: Path):
    # The developer's journal holds outline approvals without a Finish. A new start reads it as is.
    store, paths, photos = pulled(tmp_path)
    store.approve_outlines(photos)
    journal = paths.journal.read_bytes()
    again = LabelStore(paths, Clock())
    assert paths.journal.read_bytes() == journal
    listed = again.scan_list()["scans"]
    assert [s["photo"] for s in listed] == photos
    assert listed[0]["open"] == 81 and listed[0]["edited"] == 1
    assert listed[1]["open"] < 81  # the shared cells belong to the first scan
    assert again.status()["digit_cells"] == 81 + listed[1]["open"]
    again.confirm_scan(photos[0], entries(again.scan_screen(photos[0])))
    assert [s["photo"] for s in again.scan_list()["scans"]] == photos[1:]
    settle_kinds(again)
    assert finish(again)["report"]["problems"] == []
    assert [s["photo"] for s in again.scan_list()["scans"]] == photos[1:]


def test_the_cells_screen_leaves_out_unchecked_and_rejected_scans(tmp_path: Path):
    store, _, photos = pulled(tmp_path)
    assert store.scan_list()["scans"] == []
    store.reject_outline(photos[0])
    assert store.scan_list()["scans"] == []


def test_a_confirmed_scan_leaves_the_cells_list_and_undo_brings_it_back(tmp_path: Path):
    store, _, photos = pulled(tmp_path)
    store.approve_outlines(photos)
    for photo in photos:
        store.confirm_scan(photo, entries(store.scan_screen(photo)))
        assert photo not in [s["photo"] for s in store.scan_list()["scans"]]
    assert store.scan_list()["scans"] == [] and store.status()["digit_cells"] == 0
    store.undo()
    assert [s["photo"] for s in store.scan_list()["scans"]] == photos[1:]


def test_a_cell_outside_the_digit_folders_is_locked_and_not_confirmed(tmp_path: Path):
    store, paths, photos = pulled(tmp_path, corners=(CORNERS,))
    store.approve_outlines(photos)
    first = store.scan_screen(photos[0])["cells"][0]["id"]
    move_cells(paths.cells, {stem_of(first): "discarded"})  # as `just relabel` does
    again = LabelStore(paths, Clock())
    cells = again.scan_screen(photos[0])["cells"]
    assert cells[0]["locked"] and not any(c["locked"] for c in cells[1:])
    again.confirm_scan(photos[0], entries(again.scan_screen(photos[0])))
    assert again.scan_list()["scans"] == []

import io
import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pytest
from photos import grid_photo, save_photo
from PIL import Image

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.flatten import load_upright, warp_grid
from sudoku_ml.journal import current_sources, read_journal
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_check import MIN_CELLS, PhotoCheck, clear_temp
from sudoku_ml.photo_import import import_folder, read_photos

FULL = [[200, 100], [740, 100], [740, 640], [200, 640]]


def clock() -> datetime:
    return datetime(2026, 10, 12, 9, 0, 0, tzinfo=UTC)


def checked(tmp_path: Path, rgb) -> tuple[PhotoCheck, DataPaths, str]:
    save_photo(rgb, tmp_path / "in" / "p.png")
    paths = DataPaths.under(tmp_path / "data")
    import_folder(tmp_path / "in", paths, source="phone", licence="own")
    check = PhotoCheck(paths, "s1", clock)
    return check, paths, check.pending()[0]


def unlabeled(paths: DataPaths) -> list[Path]:
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
    lines = read_journal(paths.journal)
    assert {(x.field, x.screen, x.session) for x in lines} == {("source", "photos", "s1")}
    sources = current_sources(lines)
    assert sorted(sources) == sorted(result["new_cells"])
    assert {s[0][:16] for s in sources.values()} == {stem}
    assert all(0 <= r < 9 and 0 <= c < 9 for _, r, c in sources.values())
    row = read_photos(paths.photos_csv)[0]
    assert row["status"] == "accepted"
    assert row["corners"] == "200.0 100.0 740.0 100.0 740.0 640.0 200.0 640.0"
    assert check.pending() == [] and check.next() is None


def test_a_photo_cannot_be_checked_twice(tmp_path: Path):
    check, _, stem = checked(tmp_path, grid_photo())
    check.accept(stem, FULL)
    with pytest.raises(ValueError, match="already checked"):
        check.reject(stem)


def test_a_grid_cut_off_by_the_photo_gives_only_the_cells_inside(tmp_path: Path):
    step = 540 / 9
    rgb = grid_photo()[:, : int(200 + 8.5 * step)]
    check, paths, stem = checked(tmp_path, rgb)
    result = check.accept(stem, FULL)
    assert check.usable(stem, FULL) == 72
    assert result["cells"] + result["duplicates"] == 72
    assert all(c != 8 for _, _, c in current_sources(read_journal(paths.journal)).values())


def test_too_few_cells_inside_the_photo_cuts_nothing(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    far = [[900, 700], [1500, 700], [1500, 1300], [900, 1300]]
    assert check.usable(stem, far) < MIN_CELLS
    assert check.accept(stem, far)["decision"] == "too-few-cells"
    assert unlabeled(paths) == []
    assert [(r["status"], r["corners"]) for r in read_photos(paths.photos_csv)] == [
        ("too-few-cells", "")
    ]


def test_a_rejected_photo_cuts_nothing_and_leaves_the_queue(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    check.reject(stem)
    assert unlabeled(paths) == [] and check.pending() == []
    assert read_photos(paths.photos_csv)[0]["status"] == "rejected"
    assert not paths.journal.exists()


def test_cells_that_already_exist_are_duplicates(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    first = check.accept(stem, FULL)
    # One changed pixel far from the grid: a new photo id, but the same cells.
    other = grid_photo().copy()
    other[0, 0] = (0, 0, 0)
    save_photo(other, tmp_path / "in2" / "other.png")
    import_folder(tmp_path / "in2", paths, source="phone", licence="own")
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


def test_corners_that_give_no_valid_grid_are_a_value_error(tmp_path: Path):
    check, _, stem = checked(tmp_path, grid_photo())
    bow_tie = [[200, 100], [740, 640], [740, 100], [200, 640]]
    collinear = [[200, 100], [400, 100], [600, 100], [740, 100]]
    for corners in (bow_tie, collinear):
        with pytest.raises(ValueError):
            check.usable(stem, corners)


def test_a_cell_knows_its_photo_row_and_column(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    result = check.accept(stem, FULL)
    _, row, col = current_sources(read_journal(paths.journal))[result["new_cells"][5]]
    found = check.source(result["new_cells"][5][:16])
    assert found == {"photo": stem, "row": row, "col": col, "source": "phone", "licence": "own"}
    assert check.source("0" * 16) is None


def test_the_source_survives_the_fold_into_cells_csv(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    cell = check.accept(stem, FULL)["new_cells"][0]
    before = check.source(cell[:16])
    write_cells_manifest(paths)
    paths.journal.unlink()
    assert check.source(cell[:16]) == before
    assert check.link_line([cell]).startswith("Linked 1 of 1 cells.")


def test_a_legacy_photo_is_never_offered(tmp_path: Path):
    check, paths, _ = checked(tmp_path, grid_photo())
    text = paths.photos_csv.read_text().replace(",pending,", ",legacy,")
    paths.photos_csv.write_text(text)
    assert check.pending() == [] and check.total() == 1


def test_the_source_picture_outlines_the_cell_on_the_flat_grid(tmp_path: Path):
    check, _, stem = checked(tmp_path, grid_photo())
    result = check.accept(stem, FULL)
    cell = result["new_cells"][0][:16]
    found = check.source(cell)
    picture = np.asarray(Image.open(io.BytesIO(check.source_png(cell))).convert("RGB"))
    assert picture.shape == (576, 576, 3)
    plain = warp_grid(load_upright(paths_photo(tmp_path)), FULL)
    x, y = found["col"] * 64, found["row"] * 64
    assert tuple(picture[y + 30, x + 1]) == (255, 215, 0)
    assert not np.array_equal(picture[y + 30, x + 1], plain[y + 30, x + 1])
    assert check.source_png("0" * 16) is None


def paths_photo(tmp_path: Path) -> Path:
    return next(DataPaths.under(tmp_path / "data").photos.iterdir())


def test_the_sources_are_read_again_after_a_second_accept(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    first = check.accept(stem, FULL)["new_cells"][0][:16]
    assert check.source(first)["photo"] == stem
    save_photo(grid_photo(seed=3), tmp_path / "in2" / "q.png")
    import_folder(tmp_path / "in2", paths, source="phone", licence="own")
    second_stem = check.pending()[0]
    second = check.accept(second_stem, FULL)["new_cells"][0][:16]
    assert check.source(second)["photo"] == second_stem
    assert check.source(first)["photo"] == stem


def test_a_decision_drops_the_detection_of_that_photo(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    assert len(json.loads(paths.detections.read_text())) == 1
    check.reject(stem)
    assert json.loads(paths.detections.read_text()) == {}


def test_a_missing_detections_file_is_computed_again_for_a_pending_photo(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    paths.detections.unlink()
    shown = check.next()
    assert shown["stem"] == stem and len(shown["corners"]) == 4
    assert len(json.loads(paths.detections.read_text())) == 1
    assert check.accept(stem, FULL)["decision"] == "accepted"


def test_the_cut_leaves_no_temporary_file_and_never_one_in_a_cell_folder(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    check.accept(stem, FULL)
    assert list(paths.tmp.glob("*")) == []
    assert all(len(p.stem) == 16 for p in paths.cells.glob("*/*.png"))


def test_clear_temp_deletes_the_leftovers_of_a_stopped_cut(tmp_path: Path):
    paths = DataPaths.under(tmp_path / "data")
    paths.tmp.mkdir(parents=True)
    (paths.tmp / "half.png").write_bytes(b"x")
    old = paths.cells / "unlabeled"
    old.mkdir(parents=True)
    (old / "tmp-cut.png").write_bytes(b"x")
    assert clear_temp(paths) == 2
    assert list(paths.tmp.glob("*")) == [] and list(old.glob("*")) == []
    assert clear_temp(paths) == 0


def test_a_pending_photo_whose_file_is_missing_is_skipped(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    next(paths.photos.iterdir()).unlink()
    assert check.pending() == [] and check.next() is None

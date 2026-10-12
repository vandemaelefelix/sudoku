import csv
import io
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pytest
from photos import grid_photo, save_photo
from PIL import Image

from sudoku_ml.flatten import load_upright, warp_grid
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


def test_corners_that_give_no_valid_grid_are_a_value_error(tmp_path: Path):
    check, _, stem = checked(tmp_path, grid_photo())
    bow_tie = [[200, 100], [740, 640], [740, 100], [200, 640]]
    collinear = [[200, 100], [400, 100], [600, 100], [740, 100]]
    for corners in (bow_tie, collinear):
        with pytest.raises(ValueError):
            check.usable(stem, corners)


def origin_rows(paths: PhotoPaths) -> list[dict[str, str]]:
    with paths.origins.open(newline="") as handle:
        return list(csv.DictReader(handle))


def test_a_cell_knows_its_photo_row_and_column(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    result = check.accept(stem, FULL)
    row = {o["cell"]: o for o in origin_rows(paths)}[result["new_cells"][5]]
    found = check.origin(result["new_cells"][5][:16])
    assert found == {
        "photo": stem,
        "row": int(row["row"]),
        "col": int(row["col"]),
        "origin": "phone",
        "licence": "own",
    }
    assert check.origin("0" * 16) is None


def test_the_origin_picture_outlines_the_cell_on_the_flat_grid(tmp_path: Path):
    check, _, stem = checked(tmp_path, grid_photo())
    result = check.accept(stem, FULL)
    cell = result["new_cells"][0][:16]
    found = check.origin(cell)
    picture = np.asarray(Image.open(io.BytesIO(check.origin_png(cell))).convert("RGB"))
    assert picture.shape == (576, 576, 3)
    plain = warp_grid(load_upright(paths_photo(tmp_path)), FULL)
    x, y = found["col"] * 64, found["row"] * 64
    assert tuple(picture[y + 30, x + 1]) == (255, 215, 0)
    assert not np.array_equal(picture[y + 30, x + 1], plain[y + 30, x + 1])
    assert check.origin_png("0" * 16) is None


def paths_photo(tmp_path: Path) -> Path:
    return next((tmp_path / "ml" / "data" / "photos").iterdir())


def test_the_origins_file_is_read_again_after_a_second_accept(tmp_path: Path):
    check, paths, stem = checked(tmp_path, grid_photo())
    first = check.accept(stem, FULL)["new_cells"][0][:16]
    assert check.origin(first)["photo"] == stem
    save_photo(grid_photo(seed=3), tmp_path / "in2" / "q.png")
    import_folder(tmp_path / "in2", paths, origin="phone", licence="own")
    second_stem = check.pending()[0]
    second = check.accept(second_stem, FULL)["new_cells"][0][:16]
    assert check.origin(second)["photo"] == second_stem
    assert check.origin(first)["photo"] == stem

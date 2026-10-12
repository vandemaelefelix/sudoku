import csv
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

import pytest
from photos import grid_photo, save_photo
from PIL import Image

from sudoku_ml.data_check import check_data, format_report, main
from sudoku_ml.label_store import Paths
from sudoku_ml.manifest import pixel_id, write_cells_manifest
from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.photo_import import PhotoPaths, import_folder

FULL = [[200, 100], [740, 100], [740, 640], [200, 640]]


def clock() -> datetime:
    return datetime(2026, 10, 12, 9, 0, 0, tzinfo=UTC)


def valid_root(tmp_path: Path) -> Path:
    """An ml root with 3 photos: one accepted (cells cut and linked), one rejected, one pending.
    One older cell has no origin."""
    root = tmp_path / "ml"
    for n in range(3):
        save_photo(grid_photo(seed=n), tmp_path / "in" / f"p{n}.png")
    photo_paths = PhotoPaths.under(root)
    import_folder(tmp_path / "in", photo_paths, origin="phone", licence="own")
    check = PhotoCheck(photo_paths, "s1", clock)
    first, second, _ = check.pending()
    check.accept(first, FULL)
    check.reject(second, "blurred")
    old = photo_paths.cells / "empty"
    old.mkdir(parents=True)
    Image.new("RGB", (64, 64), (9, 9, 9)).save(old / "tmp.png")
    paths = Paths.under(root)
    bin_ = photo_paths.cells / "discarded"
    bin_.mkdir()
    Image.new("RGB", (64, 64), (7, 7, 7)).save(bin_ / "tmp.png")
    binned = pixel_id(bin_ / "tmp.png")
    (bin_ / "tmp.png").rename(bin_ / f"{binned[:16]}.png")
    # Rows from before the licence columns have only these three.
    rows = list(csv.DictReader(photo_paths.manifest.open()))
    with photo_paths.manifest.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", "file", "origin"])
        writer.writeheader()
        writer.writerows({k: r[k] for k in ("id", "file", "origin")} for r in rows)
    cell_id = pixel_id(old / "tmp.png")
    (old / "tmp.png").rename(old / f"{cell_id[:16]}.png")
    write_cells_manifest(paths.cells, paths.manifest, paths.log)
    return root


def run(root: Path) -> dict:
    return check_data(Paths.under(root), PhotoPaths.under(root))


def test_a_valid_root_has_no_problems_and_a_report(tmp_path: Path):
    report = run(valid_root(tmp_path))
    assert report["problems"] == []
    assert report["photos"] == {"accepted": 1, "rejected": 1, "pending": 1}
    assert report["waiting_cells"] > 0 and report["pending_photos"] == 1
    assert report["linked"] == report["total_cells"] - 2
    assert report["cells"]["discarded"] == 1
    text = format_report(report)
    assert f"Linked {report['linked']} of {report['total_cells']} cells. Cells without" in text
    assert "Waiting:" in text


def test_main_exits_with_1_on_a_problem(tmp_path: Path, capsys: pytest.CaptureFixture):
    root = valid_root(tmp_path)
    assert main(root) == 0
    next((root / "data" / "photos").iterdir()).unlink()
    assert main(root) == 1
    assert "does not exist" in capsys.readouterr().out


def corrupt_name(root: Path):
    path = next((root / "data" / "cells" / "unlabeled").glob("*.png"))
    path.rename(path.with_name("0" * 16 + ".png"))


def duplicate_cell(root: Path):
    path = next((root / "data" / "cells" / "unlabeled").glob("*.png"))
    other = root / "data" / "cells" / "1"
    other.mkdir()
    shutil.copy(path, other / path.name)


def stale_manifest(root: Path):
    paths = Paths.under(root)
    rows = paths.manifest.read_text().splitlines()
    paths.manifest.write_text("\n".join(rows[:-1]) + "\n")


def duplicate_photo_row(root: Path):
    manifest = PhotoPaths.under(root).manifest
    lines = manifest.read_text().splitlines()
    manifest.write_text("\n".join([*lines, lines[1]]) + "\n")


def wrong_photo_file(root: Path):
    photo = next((root / "data" / "photos").iterdir())
    save_photo(grid_photo(seed=99), photo)


def origin_of_missing_cell(root: Path):
    origins = PhotoPaths.under(root).origins
    with origins.open("a", newline="") as handle:
        row = next(csv.DictReader(origins.open()))
        csv.writer(handle).writerow(["a" * 64, row["photo"], 0, 0])


def two_origins(root: Path):
    origins = PhotoPaths.under(root).origins
    rows = origins.read_text().splitlines()
    origins.write_text("\n".join([*rows, rows[1]]) + "\n")


def decision_of_unknown_photo(root: Path):
    checks = PhotoPaths.under(root).checks
    with checks.open("a") as handle:
        handle.write(json.dumps({"photo": "b" * 64, "decision": "rejected"}) + "\n")


def unknown_folder(root: Path):
    (root / "data" / "cells" / "extra").mkdir()


def log_line(cell: str) -> str:
    fields = ["t", "session", "action", "cell", "field", "old", "new", "screen"]
    values = ["2026-10-12T09:00:00Z", "s", "s-1", cell, "kind", None, "printed", "groups"]
    return json.dumps(dict(zip(fields, values, strict=True))) + "\n"


def log_with_short_id(root: Path):
    with Paths.under(root).log.open("a") as handle:
        handle.write(log_line("a" * 30))


def log_with_missing_cell(root: Path):
    with Paths.under(root).log.open("a") as handle:
        handle.write(log_line("a" * 64))


@pytest.mark.parametrize(
    ("corrupt", "message"),
    [
        (corrupt_name, "not named after its pixels"),
        (duplicate_cell, "has the same pixels"),
        (stale_manifest, "just dataset-manifest"),
        (duplicate_photo_row, "is twice in"),
        (wrong_photo_file, "has the id"),
        (origin_of_missing_cell, "the cell does not exist"),
        (two_origins, "has two origins"),
        (decision_of_unknown_photo, "is not in photos.csv"),
        (unknown_folder, "not a known label folder"),
        (log_with_short_id, "are not full ids"),
        (log_with_missing_cell, "match no cell"),
    ],
)
def test_one_corrupt_thing_is_one_reported_problem(tmp_path: Path, corrupt, message):
    root = valid_root(tmp_path)
    corrupt(root)
    problems = run(root)["problems"]
    assert any(message in p for p in problems), problems
    if corrupt is duplicate_cell:
        assert any("rows of cells.csv with another folder" in p for p in problems), problems

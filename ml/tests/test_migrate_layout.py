import csv
import json
from pathlib import Path

import pytest
from photos import grid_photo, save_photo
from PIL import Image

from sudoku_ml.data_check import check_data
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.manifest import pixel_id, read_cells_table
from sudoku_ml.migrate_layout import main
from sudoku_ml.photo_import import read_photos

CORNERS = [[200.04, 100.0], [740.0, 100.0], [740.0, 640.0], [200.0, 640.0]]


def add_cell(folder: Path, grey: int) -> str:
    folder.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (64, 64), (grey, grey, 255 - grey)).save(folder / "tmp.png")
    cell_id = pixel_id(folder / "tmp.png")
    (folder / "tmp.png").rename(folder / f"{cell_id[:16]}.png")
    return cell_id


def write_csv(path: Path, fields: list[str], rows: list[list]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)  # the old files have \r\n line ends
        writer.writerow(fields)
        writer.writerows(rows)


def old_layout(tmp_path: Path) -> tuple[Path, dict[str, str]]:
    old = tmp_path / "old-ml"
    cells, photos, datasets = old / "data" / "cells", old / "data" / "photos", old / "datasets"
    ids = {
        "seven": add_cell(cells / "7", 10),
        "empty": add_cell(cells / "empty", 200),
        "waiting": add_cell(cells / "unlabeled", 90),
        "binned": add_cell(cells / "discarded", 40),
    }
    for name, seed in (("accepted", 1), ("legacy", 2)):
        path = save_photo(grid_photo(seed=seed), photos / "tmp.png")
        ids[name] = pixel_id(path)
        path.rename(photos / f"{ids[name][:16]}.png")
    write_csv(
        datasets / "cells.csv",
        ["id", "label", "kind"],
        [
            [ids["seven"], "7", "handwritten"],
            [ids["binned"], "discarded", ""],
            [ids["empty"], "empty", "none"],
            [ids["waiting"], "unlabeled", ""],
        ],
    )
    write_csv(
        datasets / "photos.csv",
        ["id", "file", "origin", "licence", "attribution"],
        [
            [ids["legacy"], f"{ids['legacy'][:16]}.png", "web", "", ""],
            [ids["accepted"], f"{ids['accepted'][:16]}.png", "openverse", "by", "Someone"],
        ],
    )
    write_csv(
        datasets / "cell-origins.csv",
        ["cell", "photo", "row", "col"],
        [[ids["seven"], ids["accepted"], 2, 8], [ids["waiting"], ids["accepted"], 0, 0]],
    )
    decisions = [
        {"photo": ids["accepted"], "decision": "rejected", "corners": None},
        {"photo": ids["accepted"], "decision": "accepted", "corners": CORNERS},
    ]
    (datasets / "photo-checks.jsonl").write_text("".join(json.dumps(d) + "\n" for d in decisions))
    log = {"t": "x", "session": "s", "action": "a", "cell": ids["seven"], "field": "kind"}
    (datasets / "kind-log.jsonl").write_text(json.dumps(log) + "\n")
    return old, ids


def snapshot(root: Path) -> dict[str, tuple[bytes, int]]:
    return {
        str(p.relative_to(root)): (p.read_bytes(), p.stat().st_mtime_ns)
        for p in sorted(root.rglob("*"))
        if p.is_file()
    }


@pytest.fixture
def new(tmp_path: Path) -> DataPaths:
    return DataPaths.under(tmp_path / "repo" / "data", tmp_path / "store")


def test_a_dry_run_writes_nothing(tmp_path: Path, new: DataPaths, capsys):
    old, _ = old_layout(tmp_path)
    assert main([str(old)], new) == 0
    assert "Dry run" in capsys.readouterr().out
    assert not new.root.exists() and not new.images.exists()


def test_apply_builds_the_two_tables_and_copies_the_images(tmp_path: Path, new: DataPaths):
    old, ids = old_layout(tmp_path)
    before = snapshot(old)
    assert main([str(old), "--apply"], new) == 0
    assert snapshot(old) == before
    table = read_cells_table(new.cells_csv)
    assert {c: (r.digit, r.kind, r.source) for c, r in table.items()} == {
        ids["seven"]: ("7", "handwritten", (ids["accepted"], 2, 8)),
        ids["binned"]: ("discarded", None, None),
        ids["empty"]: ("empty", None, None),
        ids["waiting"]: ("unlabeled", None, (ids["accepted"], 0, 0)),
    }
    assert [r.digit for r in table.values()] == ["7", "discarded", "empty", "unlabeled"]
    assert b"\r" not in new.cells_csv.read_bytes()
    assert read_photos(new.photos_csv) == [
        {
            "photo_id": ids["legacy"],
            "file": f"{ids['legacy'][:16]}.png",
            "source": "web",
            "licence": "none",
            "attribution": "",
            "status": "legacy",
            "corners": "",
        },
        {
            "photo_id": ids["accepted"],
            "file": f"{ids['accepted'][:16]}.png",
            "source": "openverse",
            "licence": "by",
            "attribution": "Someone",
            "status": "accepted",
            "corners": "200.0 100.0 740.0 100.0 740.0 640.0 200.0 640.0",
        },
    ]
    for old_file in (old / "data" / "cells").glob("*/*.png"):
        copy = new.cells / old_file.relative_to(old / "data" / "cells")
        assert copy.read_bytes() == old_file.read_bytes()
    assert len(list(new.photos.iterdir())) == 2
    assert check_data(new)["problems"] == []
    assert not new.journal.exists()


def test_a_second_apply_refuses_unless_forced(tmp_path: Path, new: DataPaths, capsys):
    old, _ = old_layout(tmp_path)
    assert main([str(old), "--apply"], new) == 0
    tables = new.cells_csv.read_text()
    assert main([str(old), "--apply"], new) == 1
    assert "Refused" in capsys.readouterr().err
    assert main([str(old), "--apply", "--force"], new) == 0
    assert new.cells_csv.read_text() == tables
    assert check_data(new)["problems"] == []


def test_a_problem_in_the_old_data_exits_with_1(tmp_path: Path, new: DataPaths, capsys):
    old, ids = old_layout(tmp_path)
    (old / "data" / "cells" / "7" / f"{ids['seven'][:16]}.png").unlink()
    assert main([str(old), "--apply"], new) == 1
    assert "without a cell on disk" in capsys.readouterr().out


def test_two_different_sources_of_one_cell_are_refused(tmp_path: Path, new: DataPaths):
    old, ids = old_layout(tmp_path)
    with (old / "datasets" / "cell-origins.csv").open("a", newline="") as handle:
        csv.writer(handle).writerow([ids["seven"], ids["accepted"], 3, 3])
    assert main([str(old), "--apply"], new) == 1
    assert not new.root.exists()


def test_targets_inside_the_old_tree_are_refused(tmp_path: Path):
    old, _ = old_layout(tmp_path)
    inside = DataPaths.under(tmp_path / "repo" / "data", old / "data" / "new-images")
    assert main([str(old), "--apply"], inside) == 1
    assert not (old / "data" / "new-images").exists()


def test_without_clones_the_copy_falls_back_to_a_plain_copy(tmp_path: Path, new, monkeypatch):
    old, _ = old_layout(tmp_path)
    monkeypatch.setattr("sudoku_ml.migrate_layout.sys.platform", "linux")
    assert main([str(old), "--apply"], new) == 0
    assert check_data(new)["problems"] == []

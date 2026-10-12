import csv
import json
from pathlib import Path

import pytest
from photos import grid_photo, save_photo
from PIL import Image

from sudoku_ml.data_check import check_data
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.manifest import pixel_id, read_cells_table
from sudoku_ml.migrate_layout import REVIEW_NOTE, logged_kind, main, replay_kinds
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
    for name, seed in (("accepted", 1), ("legacy", 2), ("pending", 3)):
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
            [ids["pending"], f"{ids['pending'][:16]}.png", "phone", "own", ""],
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
        {"photo": ids["legacy"], "decision": "legacy", "corners": None},
    ]
    write_lines(datasets / "photo-checks.jsonl", decisions)
    write_lines(
        datasets / "kind-log.jsonl",
        [
            kind_line(ids["seven"], None, "printed", "s1-1"),
            kind_line(ids["seven"], "printed", "handwritten", "s1-2"),
            kind_line(ids["empty"], None, "printed", "s1-3"),
            kind_line(ids["empty"], "printed", None, "s1-4"),
            {**kind_line(ids["waiting"], None, "unlabeled", "s1-5"), "field": "digit"},
        ],
    )
    return old, ids


def write_lines(path: Path, entries: list[dict]) -> None:
    path.write_text("".join(json.dumps(e) + "\n" for e in entries))


def kind_line(cell: str, old, new, action: str, screen: str = "groups") -> dict:
    return {
        "t": "2026-10-12T09:00:00Z",
        "session": "s1",
        "action": action,
        "cell": cell,
        "field": "kind",
        "old": old,
        "new": new,
        "screen": screen,
    }


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
    out = capsys.readouterr().out
    assert "Dry run" in out and REVIEW_NOTE in out
    assert "kinds: 4 cells checked, 0 mismatches" in out
    assert "1 sudoku photos have no decision. They stay pending." in out
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
        {
            "photo_id": ids["pending"],
            "file": f"{ids['pending'][:16]}.png",
            "source": "phone",
            "licence": "own",
            "attribution": "",
            "status": "pending",
            "corners": "",
        },
    ]
    for old_file in (old / "data" / "cells").glob("*/*.png"):
        copy = new.cells / old_file.relative_to(old / "data" / "cells")
        assert copy.read_bytes() == old_file.read_bytes()
    assert len(list(new.photos.iterdir())) == 3
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


def test_the_replay_follows_the_old_rule_with_undo_lines(tmp_path: Path):
    a, b = "a" * 64, "b" * 64
    path = tmp_path / "log.jsonl"
    write_lines(
        path,
        [
            kind_line(a, None, "printed", "s-1"),
            kind_line(a, "printed", "handwritten", "s-2"),
            kind_line(a, "handwritten", "printed", "undo:s-2", "undo"),
            kind_line(b, None, "unsure", "s-3"),
            {**kind_line(b, "7", "1", "s-4"), "field": "digit"},
        ],
    )
    assert replay_kinds(path) == {a: "printed", b: "unsure"}
    assert logged_kind("7", "printed") == "printed"
    assert [logged_kind(d, "printed") for d in ("empty", "unlabeled", "discarded")] == [""] * 3
    assert logged_kind("7", None) == ""


def test_a_log_newer_than_the_table_is_refused_unless_preferred(tmp_path, new, capsys):
    old, ids = old_layout(tmp_path)
    log = old / "datasets" / "kind-log.jsonl"
    with log.open("a") as handle:
        handle.write(json.dumps(kind_line(ids["seven"], "handwritten", "unsure", "s2-1")) + "\n")
    assert main([str(old), "--apply"], new) == 1
    err = capsys.readouterr().err
    assert "1 kinds of cells.csv differ" in err and "table handwritten, log unsure" in err
    assert not new.root.exists()
    assert main([str(old), "--apply", "--prefer-log"], new) == 0
    assert "kinds: 4 cells checked, 1 mismatches (the log wins)" in capsys.readouterr().out
    assert read_cells_table(new.cells_csv)[ids["seven"]].kind == "unsure"


def test_an_accepted_photo_without_corners_is_refused(tmp_path: Path, new, capsys):
    old, ids = old_layout(tmp_path)
    checks = old / "datasets" / "photo-checks.jsonl"
    with checks.open("a") as handle:
        handle.write(json.dumps({"photo": ids["pending"], "decision": "accepted"}) + "\n")
    assert main([str(old)], new) == 1
    assert f"have no 4 corners in photo-checks.jsonl: {ids['pending'][:16]}" in (
        capsys.readouterr().err
    )


def test_missing_optional_old_files_give_notes(tmp_path: Path, new, capsys):
    old, ids = old_layout(tmp_path)
    for name in ("photo-checks.jsonl", "cell-origins.csv", "kind-log.jsonl", "photos.csv"):
        (old / "datasets" / name).unlink()
    for photo in (old / "data" / "photos").iterdir():
        photo.unlink()
    assert main([str(old), "--apply"], new) == 0
    out = capsys.readouterr().out
    assert "Note: no datasets/cell-origins.csv" in out and "Note: no datasets/kind-log" in out
    assert "WARNING: no datasets/photos.csv" in out
    assert read_cells_table(new.cells_csv)[ids["seven"]].source is None


def test_a_missing_old_cells_table_is_an_error(tmp_path: Path, new):
    old, _ = old_layout(tmp_path)
    (old / "datasets" / "cells.csv").unlink()
    assert main([str(old)], new) == 1


def test_the_old_blind_check_file_is_copied_once(tmp_path: Path, new):
    old, ids = old_layout(tmp_path)
    line = {"t": "x", "session": "c", "cell": ids["seven"], "label": "printed", "answer": "p"}
    write_lines(old / "datasets" / "kind-check.jsonl", [line])
    assert main([str(old), "--apply"], new) == 0
    assert new.kind_checks.read_text() == json.dumps(line) + "\n"
    new.kind_checks.write_text("mine\n")
    assert main([str(old), "--apply", "--force"], new) == 0
    assert new.kind_checks.read_text() == "mine\n"


def test_an_empty_path_is_refused(new, capsys):
    assert main([""], new) == 2
    assert "Give the old ml/ folder" in capsys.readouterr().err


def symlinked_old(tmp_path: Path) -> tuple[Path, dict[str, str], Path]:
    """The old data/ is a symlink, like ml/data in a worktree. Its cells/ is one too."""
    old, ids = old_layout(tmp_path)
    real = tmp_path / "elsewhere" / "data"
    real.parent.mkdir()
    (old / "data").rename(real)
    (real / "cells").rename(tmp_path / "elsewhere" / "cells")
    (real / "cells").symlink_to(tmp_path / "elsewhere" / "cells")
    (old / "data").symlink_to(real)
    return old, ids, real


def test_a_target_inside_a_symlinked_old_data_folder_is_refused(tmp_path: Path, capsys):
    old, _, real = symlinked_old(tmp_path)
    inside = DataPaths.under(tmp_path / "repo" / "data", real / "new-images")
    assert main([str(old), "--apply"], inside) == 1
    assert "overlap" in capsys.readouterr().err
    assert not (real / "new-images").exists()


def test_symlinked_sources_are_copied_as_files(tmp_path: Path, new: DataPaths):
    old, _, _ = symlinked_old(tmp_path)
    assert main([str(old), "--apply"], new) == 0
    assert not new.cells.is_symlink() and not new.photos.is_symlink()
    assert not [p for p in new.images.rglob("*") if p.is_symlink()]
    assert check_data(new)["problems"] == []


def test_force_refuses_to_delete_images_that_the_old_tree_lacks(tmp_path, new, capsys):
    old, _ = old_layout(tmp_path)
    assert main([str(old), "--apply"], new) == 0
    stray = add_cell(new.cells / "3", 33)
    assert main([str(old), "--apply", "--force"], new) == 1
    err = capsys.readouterr().err
    assert "holds 1 images that the old tree does not hold" in err and stray[:16] in err
    assert (new.cells / "3" / f"{stray[:16]}.png").exists()

from dataclasses import replace
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.contract import UNKNOWN_KIND, kind_index
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.dataset import (
    SAME_PAGE_MIN_DIGITS,
    cell_paths,
    dhash,
    group_ids,
    load_cells,
    page_keys,
    read_real_cells,
    side_of,
    split_by_group,
    split_cells,
    stack,
)
from sudoku_ml.synthetic import Sample
from sudoku_ml.tables import TRUSTED_LABEL_SOURCES, CellRow, PhotoRow, write_cells, write_photos


def cell_tree(tmp_path: Path) -> DataPaths:
    data = DataPaths.under(tmp_path / "data", tmp_path)
    for label, colour in [("3", 10), ("empty", 200), ("unlabeled", 50), ("7", 30)]:
        (data.cells / label).mkdir(parents=True)
        Image.new("RGB", (71, 71), (colour,) * 3).save(data.cells / label / f"{colour:016x}.png")
    return data


def pattern(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.kron(rng.integers(0, 256, (8, 8, 3)), np.ones((8, 8, 1))).astype(np.uint8)


def test_cells_are_resized_and_labelled(tmp_path: Path):
    samples = load_cells(cell_tree(tmp_path))
    assert sorted(s.digit for s in samples) == [0, 3, 7]
    assert all(s.image.shape == (64, 64, 3) for s in samples)


def test_unlabeled_is_never_loaded_and_missing_folder_is_empty(tmp_path: Path):
    assert len(load_cells(cell_tree(tmp_path))) == 3
    assert load_cells(DataPaths.under(tmp_path / "x", tmp_path / "nothing")) == []


def test_kind_is_unknown_except_for_empty_cells(tmp_path: Path):
    kinds = {s.digit: s.kind for s in load_cells(cell_tree(tmp_path))}
    assert kinds == {0: kind_index("none"), 3: UNKNOWN_KIND, 7: UNKNOWN_KIND}


def test_near_identical_cells_share_a_group():
    a = pattern(1)
    b = a.copy()
    b[0, 0] = 255 - b[0, 0]  # one pixel changed
    c = pattern(2)
    groups = group_ids([Sample(x, 1, 1) for x in (a, b, c)])
    assert groups[0] == groups[1] != groups[2]
    assert dhash(a) == dhash(b)


def test_split_never_splits_a_group():
    groups = np.repeat(np.arange(100), 3)
    keys = [f"cell-{i}" for i in range(300)]
    train, val, test = split_by_group(groups, keys, (0.8, 0.1, 0.1), seed=4)
    assert len(train) + len(val) + len(test) == 300
    sides = [set(groups[train]), set(groups[val]), set(groups[test])]
    assert not (sides[0] & sides[1] or sides[0] & sides[2] or sides[1] & sides[2])
    assert 15 <= len(test) <= 45


def test_split_is_deterministic():
    groups = np.arange(50)
    keys = [f"cell-{i}" for i in range(50)]
    assert all(
        np.array_equal(a, b)
        for a, b in zip(
            split_by_group(groups, keys, (0.8, 0.1, 0.1), 1),
            split_by_group(groups, keys, (0.8, 0.1, 0.1), 1),
            strict=True,
        )
    )


def test_new_groups_never_move_the_old_ones():
    keys = [f"cell-{i}" for i in range(200)]
    before = [side_of(k, (0.8, 0.1, 0.1), 7) for k in keys]
    more = keys + [f"new-{i}" for i in range(500)]
    groups = np.arange(len(more))
    sides = split_by_group(groups, more, (0.8, 0.1, 0.1), 7)
    after = {int(i): side for side, indices in enumerate(sides) for i in indices}
    assert [after[i] for i in range(200)] == before


def test_a_group_takes_the_side_of_its_smallest_key():
    groups = np.array([0, 0, 0])
    train, val, test = split_by_group(groups, ["c", "a", "b"], (0.5, 0.25, 0.25), 3)
    side = side_of("a", (0.5, 0.25, 0.25), 3)
    assert [len(train), len(val), len(test)][side] == 3


def test_stack_shapes():
    images, digit, kind = stack([Sample(np.zeros((64, 64, 3), np.uint8), 5, 1)] * 3)
    assert tuple(images.shape) == (3, 64, 64, 3)
    assert digit.tolist() == [5, 5, 5] and kind.tolist() == [1, 1, 1]


def write_manifest(path: Path, rows: list[tuple[str, str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "cell_id,digit,kind,photo_id,row,col,label_source\n"
        + "".join(f"{i},{lab},{k},,,,\n" for i, lab, k in rows)
    )


def test_kinds_come_from_the_manifest(tmp_path: Path):
    data = cell_tree(tmp_path)
    three, seven = f"{10:016x}" + "0" * 48, f"{30:016x}" + "0" * 48
    write_manifest(data.cells_csv, [(three, "3", "handwritten"), (seven, "7", "unsure")])
    kinds = {s.digit: s.kind for s in load_cells(data)}
    assert kinds == {0: kind_index("none"), 3: kind_index("handwritten"), 7: UNKNOWN_KIND}


def test_a_digit_cell_missing_from_the_manifest_has_no_kind(tmp_path: Path):
    data = cell_tree(tmp_path)
    write_manifest(data.cells_csv, [])
    assert {s.digit: s.kind for s in load_cells(data)}[3] == UNKNOWN_KIND


def test_cell_paths_follow_the_load_order(tmp_path: Path):
    data = cell_tree(tmp_path)
    assert [p.parent.name for p in cell_paths(data.cells)] == ["empty", "3", "7"]


def test_training_uses_only_legacy_and_verified_cells(tmp_path: Path):
    data = cell_tree(tmp_path)
    rows = [
        CellRow(f"{colour:016x}" + "0" * 48, folder, None, (PHOTO, 0, 0), source)
        for (folder, colour), source in zip(
            [("3", 10), ("empty", 200), ("7", 30)],
            ["app-edited", "app-unedited", "verified"],
            strict=True,
        )
    ]
    write_cells(data.cells_csv, rows)
    write_photos(data.photos_csv, [accepted_scan()])
    assert [s.digit for s in load_cells(data)] == [7]
    write_cells(data.cells_csv, [replace(r, label_source="") for r in rows])
    assert sorted(s.digit for s in load_cells(data)) == [0, 3, 7]
    assert TRUSTED_LABEL_SOURCES == ("", "verified")


PHOTO = "a" * 64


def accepted_scan() -> PhotoRow:
    return PhotoRow(
        PHOTO, "a.jpg", "app-scan", "player-contributed", "", "accepted", "1 2 3 4 5 6 7 8"
    )


def photo_id(n: int) -> str:
    return f"{n:02x}" * 32


def digit_rows(photo: str, digits: dict[tuple[int, int], str]) -> list[CellRow]:
    return [
        CellRow(f"{photo[:4]}{r}{c}" + "0" * 58, d, "printed", (photo, r, c))
        for (r, c), d in digits.items()
    ]


def test_photos_of_the_same_page_get_one_key():
    page = {
        (r, c): str((r * 3 + r // 3 + c) % 9 + 1)
        for r in range(9)
        for c in range(9)
        if (r + c) % 3 == 0
    }
    other = {k: str(int(v) % 9 + 1) for k, v in page.items()}
    one_wrong = dict(page) | {(0, 0): "5" if page[(0, 0)] != "5" else "6"}
    rows = (
        digit_rows(photo_id(3), page)
        + digit_rows(photo_id(1), one_wrong)
        + digit_rows(photo_id(2), other)
        + digit_rows(photo_id(4), dict(list(page.items())[: SAME_PAGE_MIN_DIGITS - 1]))
    )
    keys = page_keys(rows)
    assert keys[photo_id(3)] == keys[photo_id(1)] == photo_id(1)
    assert keys[photo_id(2)] == photo_id(2)
    assert keys[photo_id(4)] == photo_id(4)


def test_the_cells_of_an_imported_photo_stay_on_one_side(tmp_path: Path):
    data = DataPaths.under(tmp_path / "data", tmp_path)
    rows = []
    for n in range(40):
        photo = photo_id(n + 1)
        for c in range(3):
            stem = f"{n:08x}{c:08x}"
            folder = str(c + 1)
            (data.cells / folder).mkdir(parents=True, exist_ok=True)
            Image.fromarray(pattern(n * 3 + c)).save(data.cells / folder / f"{stem}.png")
            rows.append(CellRow(stem + "0" * 48, folder, "printed", (photo, 0, c)))
    write_cells(data.cells_csv, rows)
    write_photos(data.photos_csv, [])
    sides = split_cells(read_real_cells(data), (0.5, 0.25, 0.25), seed=2)
    owners: dict[str, set[int]] = {}
    for side, cells in enumerate(sides):
        for cell in cells:
            owners.setdefault(cell.sample.photo, set()).add(side)
    assert len(owners) == 40 and all(len(s) == 1 for s in owners.values())

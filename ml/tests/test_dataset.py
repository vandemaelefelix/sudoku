from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.contract import UNKNOWN_KIND, kind_index
from sudoku_ml.dataset import dhash, group_ids, load_cells, split_by_group, stack
from sudoku_ml.synthetic import Sample


def cell_tree(tmp_path: Path) -> Path:
    cells = tmp_path / "cells"
    for label, colour in [("3", 10), ("empty", 200), ("unlabeled", 50), ("7", 30)]:
        (cells / label).mkdir(parents=True)
        Image.new("RGB", (71, 71), (colour,) * 3).save(cells / label / f"{colour:016x}.png")
    return cells


def pattern(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.kron(rng.integers(0, 256, (8, 8, 3)), np.ones((8, 8, 1))).astype(np.uint8)


def test_cells_are_resized_and_labelled(tmp_path: Path):
    samples = load_cells(cell_tree(tmp_path))
    assert sorted(s.digit for s in samples) == [0, 3, 7]
    assert all(s.image.shape == (64, 64, 3) for s in samples)


def test_unlabeled_is_never_loaded_and_missing_folder_is_empty(tmp_path: Path):
    assert len(load_cells(cell_tree(tmp_path))) == 3
    assert load_cells(tmp_path / "nothing") == []


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
    train, val, test = split_by_group(groups, (0.8, 0.1, 0.1), seed=4)
    assert len(train) + len(val) + len(test) == 300
    sides = [set(groups[train]), set(groups[val]), set(groups[test])]
    assert not (sides[0] & sides[1] or sides[0] & sides[2] or sides[1] & sides[2])
    assert 15 <= len(test) <= 45


def test_split_is_deterministic():
    groups = np.arange(50)
    assert all(
        np.array_equal(a, b)
        for a, b in zip(
            split_by_group(groups, (0.8, 0.1, 0.1), 1),
            split_by_group(groups, (0.8, 0.1, 0.1), 1),
            strict=True,
        )
    )


def test_stack_shapes():
    images, digit, kind = stack([Sample(np.zeros((64, 64, 3), np.uint8), 5, 1)] * 3)
    assert tuple(images.shape) == (3, 64, 64, 3)
    assert digit.tolist() == [5, 5, 5] and kind.tolist() == [1, 1, 1]

"""Training and the Check screen must put the same cells in the test split."""

from dataclasses import replace
from pathlib import Path

import numpy as np
from PIL import Image
from test_label_store import Clock
from test_train import smoke_config

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.dataset import read_real_cells, split_cells
from sudoku_ml.label_store import LabelStore
from sudoku_ml.tables import CellRow, PhotoRow, pixel_id, write_cells, write_photos

PHOTOS = 12
SPLIT = [0.5, 0.25, 0.25]


def add_cell(paths: DataPaths, digit: str, seed: int) -> str:
    pixels = np.random.default_rng(seed).integers(0, 256, (64, 64, 3), dtype=np.uint8)
    tmp = paths.cells / "tmp.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels).save(tmp)
    cell_id = pixel_id(tmp)
    (paths.cells / digit).mkdir(exist_ok=True)
    tmp.rename(paths.cells / digit / f"{cell_id[:16]}.png")
    return cell_id


def scan_dataset(tmp_path: Path, config: Path) -> DataPaths:
    """Twelve scan photos with three cells each, a third of them unedited, and ten plain cells."""
    paths = replace(DataPaths.under(tmp_path / "data", tmp_path / "images"), config=config)
    for digit in DIGIT_CLASSES:
        (paths.cells / digit).mkdir(parents=True, exist_ok=True)
    rows, photos, seed = [], [], 0
    for n in range(PHOTOS):
        photo_id = f"{n:02x}" * 32
        photos.append(
            PhotoRow(photo_id, f"{n}.jpg", "app-scan", "player-contributed", "", "accepted", "")
        )
        for row in range(3):
            seed += 1
            digit = DIGIT_CLASSES[1 + seed % 9]
            label = "app-unedited" if seed % 3 == 0 else "app-edited"
            rows.append(
                CellRow(add_cell(paths, digit, seed), digit, None, (photo_id, row, 0), label)
            )
    for _ in range(10):
        seed += 1
        digit = DIGIT_CLASSES[seed % 10]
        rows.append(CellRow(add_cell(paths, digit, seed), digit, None, None, "verified"))
    write_cells(paths.cells_csv, rows)
    write_photos(paths.photos_csv, photos)
    return paths


def test_training_and_the_check_screen_have_the_same_test_split(tmp_path: Path):
    from sudoku_ml.train import load_config, train

    config = smoke_config(tmp_path, real_cells=True, split=SPLIT)
    paths = scan_dataset(tmp_path, config)
    store = LabelStore(paths, Clock())
    _, check_screen_test = store._near_duplicates()
    run = train(load_config(config), paths, artifacts_dir=tmp_path / "out")
    trained = split_cells(read_real_cells(paths), tuple(SPLIT), load_config(config).seed)[2]
    assert {c.path.stem for c in trained} == {cell[:16] for cell in check_screen_test}
    assert check_screen_test and len(check_screen_test) < 36
    import json

    assert json.loads((run / "metrics.json").read_text())["n_test"] == len(check_screen_test)


def test_the_test_split_leaves_out_unedited_scan_cells_and_keeps_a_photo_together(tmp_path: Path):
    config = smoke_config(tmp_path, real_cells=True, split=SPLIT)
    paths = scan_dataset(tmp_path, config)
    cells = read_real_cells(paths)
    train_side, val_side, test_side = split_cells(cells, tuple(SPLIT), seed=3)
    chosen = [*train_side, *val_side, *test_side]
    assert len(chosen) == sum(c.trusted for c in cells) < len(cells)
    owners: dict[str, set[int]] = {}
    for side, side_cells in enumerate((train_side, val_side, test_side)):
        for c in side_cells:
            if c.sample.photo:
                owners.setdefault(c.sample.photo, set()).add(side)
    assert owners and all(len(sides) == 1 for sides in owners.values())

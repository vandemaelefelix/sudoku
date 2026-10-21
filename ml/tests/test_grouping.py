import json
from pathlib import Path

import numpy as np
import pytest
import torch
from PIL import Image

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.grouping import features, group_folder, ink_colour, kmeans, write_groups
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.model import CellClassifier
from sudoku_ml.tables import pixel_id


def cell(ink: tuple[int, int, int]) -> np.ndarray:
    image = np.full((64, 64, 3), 230, np.uint8)
    image[22:42, 22:42] = ink
    return image


def test_ink_colour_sees_red_and_blue_pen():
    red, blue, black = (ink_colour(cell(c)) for c in ((200, 30, 30), (30, 30, 200), (20, 20, 20)))
    assert red[1] > 1.0 and red[0] < 0
    assert blue[0] > 1.0 and blue[1] < 0
    assert np.all(np.abs(black) < 0.01)


def test_features_are_unit_length_plus_the_weighted_ink_colour():
    torch.manual_seed(0)
    images = np.stack([cell((200, 30, 30)), cell((20, 20, 20))])
    result = features(CellClassifier(), images)
    assert result.shape == (2, 66)
    assert np.allclose(np.linalg.norm(result[:, :64], axis=1), 1, atol=1e-4)
    assert np.allclose(result[0, 64:], 0.5 * ink_colour(images[0]))


def test_kmeans_is_deterministic_and_finds_clear_clusters():
    rng = np.random.default_rng(0)
    x = np.vstack([rng.normal(0, 0.1, (20, 3)), rng.normal(5, 0.1, (20, 3))]).astype(np.float32)
    a, _ = kmeans(x, 2, seed=0)
    b, _ = kmeans(x, 2, seed=0)
    assert np.array_equal(a, b)
    assert len(set(a[:20])) == 1 and len(set(a[20:])) == 1 and a[0] != a[20]


def test_k_never_exceeds_the_number_of_cells():
    _, centres = kmeans(np.arange(6, dtype=np.float32).reshape(3, 2), 30, seed=0)
    assert centres.shape[0] == 3


def test_the_least_sure_cell_comes_first_and_the_largest_group_first():
    x = np.array([[0, 0], [0.1, 0], [2.4, 0], [5, 0], [5.1, 0]], np.float32)
    groups = group_folder(list("abcde"), x, k=2, seed=0)
    assert groups[0]["cells"][0] == "c"
    assert sorted(groups[0]["cells"]) == ["a", "b", "c"]
    assert groups[0]["sureness"] == sorted(groups[0]["sureness"])


def ml_tree(tmp_path: Path, colours: dict[str, list[int]]) -> Path:
    paths = DataPaths.under(tmp_path / "data")
    cells = paths.cells
    for folder, values in colours.items():
        (cells / folder).mkdir(parents=True)
        for value in values:
            tmp = cells / "tmp.png"
            Image.new("RGB", (71, 71), (value, 255 - value, 128)).save(tmp)
            tmp.rename(cells / folder / f"{pixel_id(tmp)[:16]}.png")
    write_cells_manifest(paths)
    run = tmp_path / "artifacts" / "run-1"
    run.mkdir(parents=True)
    torch.manual_seed(0)
    torch.save(CellClassifier().state_dict(), run / "model.pt")
    return run


def test_write_groups_covers_every_digit_cell(tmp_path: Path):
    run = ml_tree(tmp_path, {"7": [10, 20, 30], "empty": [200]})
    paths = DataPaths.under(tmp_path / "data")
    out = paths.groups
    assert write_groups(paths, run, k=30, seed=0) == 3
    groups = json.loads(out.read_text())
    assert groups["run"] == "run-1" and list(groups["folders"]) == ["7"]
    assert sum(len(g["cells"]) for g in groups["folders"]["7"]) == 3


def test_write_groups_refuses_cells_missing_from_the_manifest(tmp_path: Path):
    run = ml_tree(tmp_path, {"7": [10]})
    paths = DataPaths.under(tmp_path / "data")
    stray = paths.cells / "7" / ("f" * 16 + ".png")
    Image.new("RGB", (71, 71), (1, 2, 3)).save(stray)
    with pytest.raises(ValueError, match="just dataset-manifest"):
        write_groups(paths, run)

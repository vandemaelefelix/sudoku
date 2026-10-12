import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.manifest import pixel_id
from sudoku_ml.model import CellClassifier
from sudoku_ml.prelabel import main, write_prelabels


def make_run(root: Path) -> Path:
    run = root / "artifacts" / "20261012-000000-test"
    run.mkdir(parents=True)
    torch.manual_seed(0)
    torch.save(CellClassifier().state_dict(), run / "model.pt")
    (run / "metrics.json").write_text(json.dumps({"temperature": 0.5}))
    return run


def add_unlabeled(cells: Path, seed: int) -> str:
    folder = cells / "unlabeled"
    folder.mkdir(parents=True, exist_ok=True)
    image = np.random.default_rng(seed).integers(0, 256, (64, 64, 3), dtype=np.uint8)
    tmp = folder / "tmp.png"
    Image.fromarray(image).save(tmp)
    cell_id = pixel_id(tmp)
    tmp.rename(folder / f"{cell_id[:16]}.png")
    return cell_id


def test_each_unlabeled_cell_gets_a_digit_a_probability_and_a_kind(tmp_path: Path):
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "prelabels.json"
    ids = [add_unlabeled(cells, s) for s in range(3)]
    assert write_prelabels(cells, make_run(tmp_path), out) == 3
    value = json.loads(out.read_text())
    assert value["run"] == "20261012-000000-test" and set(value["cells"]) == set(ids)
    for entry in value["cells"].values():
        assert entry["digit"] in DIGIT_CLASSES and entry["kind"] in KIND_CLASSES
        assert 0 < entry["p"] <= 1


def test_only_new_cells_are_computed_and_gone_cells_are_dropped(tmp_path: Path):
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "prelabels.json"
    run = make_run(tmp_path)
    first = add_unlabeled(cells, 1)
    gone = add_unlabeled(cells, 2)
    write_prelabels(cells, run, out)
    (cells / "unlabeled" / f"{gone[:16]}.png").unlink()
    newer = add_unlabeled(cells, 3)
    assert write_prelabels(cells, run, out) == 1
    assert set(json.loads(out.read_text())["cells"]) == {first, newer}


def test_without_a_model_run_the_command_warns_and_succeeds(tmp_path: Path, capsys):
    assert main(["prelabel", "artifacts/missing"], tmp_path) == 0
    assert "No model" in capsys.readouterr().err

import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.model import CellClassifier
from sudoku_ml.prelabel import main, write_prelabels
from sudoku_ml.tables import pixel_id


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
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "work" / "prelabels.json"
    ids = [add_unlabeled(cells, s) for s in range(3)]
    assert write_prelabels(cells, make_run(tmp_path), out) == 3
    value = json.loads(out.read_text())
    assert value["run"] == "20261012-000000-test" and set(value["cells"]) == set(ids)
    for entry in value["cells"].values():
        assert entry["digit"] in DIGIT_CLASSES and entry["kind"] in KIND_CLASSES
        assert 0 < entry["p"] <= 1


def test_only_new_cells_are_computed_and_gone_cells_are_dropped(tmp_path: Path):
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "work" / "prelabels.json"
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


def add_cell_in(cells: Path, folder: str, seed: int) -> str:
    cell_id = add_unlabeled(cells, seed)
    (cells / folder).mkdir(parents=True, exist_ok=True)
    (cells / "unlabeled" / f"{cell_id[:16]}.png").rename(cells / folder / f"{cell_id[:16]}.png")
    return cell_id


def test_each_prelabel_keeps_the_full_probabilities(tmp_path: Path):
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "work" / "prelabels.json"
    add_unlabeled(cells, 1)
    write_prelabels(cells, make_run(tmp_path), out)
    for entry in json.loads(out.read_text())["cells"].values():
        probs = entry["probs"]
        assert len(probs["digit"]) == len(DIGIT_CLASSES) and len(probs["kind"]) == len(KIND_CLASSES)
        assert abs(sum(probs["digit"]) - 1) < 1e-3 and abs(sum(probs["kind"]) - 1) < 1e-3
        assert entry["digit"] == DIGIT_CLASSES[probs["digit"].index(max(probs["digit"]))]
        assert 0 < entry["kp"] <= 1


def test_an_old_entry_without_probs_is_computed_again(tmp_path: Path):
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "work" / "prelabels.json"
    run = make_run(tmp_path)
    cell = add_unlabeled(cells, 1)
    other = add_unlabeled(cells, 2)
    write_prelabels(cells, run, out)
    stored = json.loads(out.read_text())
    del stored["cells"][cell]["probs"]
    out.write_text(json.dumps(stored))
    assert write_prelabels(cells, run, out) == 1
    value = json.loads(out.read_text())["cells"]
    assert "probs" in value[cell] and "probs" in value[other]


def test_wanted_limits_the_cells_that_the_model_reads(tmp_path: Path):
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "work" / "prelabels.json"
    run = make_run(tmp_path)
    waiting = add_unlabeled(cells, 1)
    in_empty = add_cell_in(cells, "empty", 2)
    add_cell_in(cells, "3", 3)
    assert write_prelabels(cells, run, out, {waiting, in_empty}) == 2
    assert set(json.loads(out.read_text())["cells"]) == {waiting, in_empty}


def test_cells_in_digit_folders_get_pre_labels_and_cells_that_left_are_dropped(tmp_path: Path):
    cells, out = tmp_path / "data" / "cells", tmp_path / "data" / "work" / "prelabels.json"
    run = make_run(tmp_path)
    waiting = add_unlabeled(cells, 1)
    seven = add_cell_in(cells, "7", 2)
    moved = add_cell_in(cells, "3", 3)
    assert write_prelabels(cells, run, out) == 3
    assert set(json.loads(out.read_text())["cells"]) == {waiting, seven, moved}
    (cells / "discarded").mkdir()
    (cells / "3" / f"{moved[:16]}.png").rename(cells / "discarded" / f"{moved[:16]}.png")
    assert write_prelabels(cells, run, out) == 0
    assert set(json.loads(out.read_text())["cells"]) == {waiting, seven}

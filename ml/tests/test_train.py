import json
import tomllib
from pathlib import Path

import numpy as np
import pytest
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, UNKNOWN_KIND, kind_index
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.dataset import load_cells, read_kinds
from sudoku_ml.fixtures import FIXTURE_SEED
from sudoku_ml.journal import Line, append_records
from sudoku_ml.manifest import pixel_id, write_cells_manifest
from sudoku_ml.train import (
    expected_calibration_error,
    fit_temperature,
    label_state_lines,
    load_config,
    loss,
    review_accuracy,
    train,
)

ML = Path(__file__).parents[1]


def test_unknown_kind_adds_no_kind_loss():
    digit_logits, digit = torch.zeros(2, 10), torch.tensor([0, 0])
    kind_logits = torch.tensor([[9.0, 0, 0, 0], [0, 0, 0, 9.0]])
    one = loss(digit_logits, kind_logits, digit, torch.tensor([0, UNKNOWN_KIND]), 0.4, 0.0)
    only_first = loss(digit_logits[:1], kind_logits[:1], digit[:1], torch.tensor([0]), 0.4, 0.0)
    assert torch.isclose(one, only_first, atol=1e-4)


def test_all_unknown_kinds_give_a_finite_loss():
    value = loss(
        torch.zeros(2, 10),
        torch.zeros(2, 4),
        torch.tensor([1, 2]),
        torch.tensor([UNKNOWN_KIND, UNKNOWN_KIND]),
        0.4,
        0.05,
    )
    assert torch.isfinite(value)


def test_kind_weight_scales_the_kind_loss():
    d, k = torch.zeros(1, 10), torch.zeros(1, 4)
    base = loss(d, k, torch.tensor([0]), torch.tensor([1]), 0.0, 0.0)
    weighted = loss(d, k, torch.tensor([0]), torch.tensor([1]), 1.0, 0.0)
    assert weighted > base


def test_review_accuracy_drops_the_least_confident():
    probs = torch.tensor([[0.9, 0.1], [0.6, 0.4], [0.55, 0.45], [0.95, 0.05]])
    targets = torch.tensor([0, 0, 1, 0])
    result = review_accuracy(probs, targets, (0.0, 0.25))
    assert result == {"review_0%": 0.75, "review_25%": 1.0}


def test_temperature_and_calibration_are_finite():
    torch.manual_seed(0)
    logits = torch.randn(200, 10) * 3
    flip = torch.rand(200) < 0.2
    targets = torch.where(flip, torch.randint(0, 10, (200,)), logits.argmax(1))
    t = fit_temperature(logits, targets)
    assert 0.05 < t < 20
    assert 0 <= expected_calibration_error((logits / t).softmax(1), targets) < 1


def test_smoke_run_writes_artifacts(tmp_path: Path):
    run = train(load_config(ML / "configs" / "smoke.toml"), artifacts_dir=tmp_path)
    metrics = json.loads((run / "metrics.json").read_text())
    assert (run / "model.pt").exists()
    assert {
        "eval_set",
        "digit_accuracy",
        "review",
        "ece",
        "temperature",
        "kind_accuracy_synthetic",
        "n_train",
        "device",
    } <= metrics.keys()
    assert metrics["eval_set"] == "synthetic"
    assert "Contract: 1.0" in (run / "model-card.md").read_text()


def test_unknown_config_key_is_rejected(tmp_path: Path):
    bad = tmp_path / "bad.toml"
    bad.write_text((ML / "configs" / "smoke.toml").read_text() + "\nunknown = 1\n")
    with pytest.raises(TypeError):
        load_config(bad)


def smoke_config(tmp_path: Path, **changes) -> Path:
    values = tomllib.loads((ML / "configs" / "smoke.toml").read_text()) | changes
    path = tmp_path / "config.toml"
    path.write_text("\n".join(f"{k} = {json.dumps(v)}" for k, v in values.items()))
    return path


def test_real_cells_without_data_raise(tmp_path: Path):
    config = load_config(smoke_config(tmp_path, real_cells=True))
    data = DataPaths.under(tmp_path / "data")
    with pytest.raises(ValueError, match="real data is not present"):
        train(config, data, artifacts_dir=tmp_path / "out")


def test_real_cells_with_empty_folders_raise(tmp_path: Path):
    data = DataPaths.under(tmp_path / "data")
    for label in DIGIT_CLASSES:
        (data.cells / label).mkdir(parents=True)
    config = load_config(smoke_config(tmp_path, real_cells=True))
    with pytest.raises(ValueError, match="real data is not present"):
        train(config, data, artifacts_dir=tmp_path / "out")


@pytest.mark.parametrize("seed", [FIXTURE_SEED, FIXTURE_SEED - 1])
def test_seed_that_reaches_the_fixture_seed_is_rejected(tmp_path: Path, seed: int):
    with pytest.raises(ValueError, match="fixture seed"):
        load_config(smoke_config(tmp_path, seed=seed))


def test_model_card_has_ece_and_test_size(tmp_path: Path):
    run = train(load_config(ML / "configs" / "smoke.toml"), artifacts_dir=tmp_path)
    card = (run / "model-card.md").read_text()
    assert "ECE:" in card and "Test cells:" in card
    assert "Kind labels" not in card  # only real-cell runs carry the label state


def real_tree(tmp_path: Path) -> DataPaths:
    data = DataPaths.under(tmp_path / "data")
    rng = np.random.default_rng(0)
    for label in DIGIT_CLASSES:
        (data.cells / label).mkdir(parents=True)
        for _ in range(12):
            pixels = rng.integers(0, 256, (64, 64, 3), dtype=np.uint8)
            tmp = data.cells / label / "tmp.png"
            Image.fromarray(pixels).save(tmp)
            tmp.rename(tmp.with_name(f"{pixel_id(tmp)[:16]}.png"))
    return data


def test_real_run_reads_the_cells_table_in_the_new_format(tmp_path: Path):
    data = real_tree(tmp_path)
    sevens = sorted(pixel_id(p) for p in (data.cells / "7").glob("*.png"))
    line = "2026-10-12T09:00:00Z"
    append_records(
        data.journal,
        [Line(line, "s", "s-1", cell, "kind", None, "printed", "groups") for cell in sevens],
    )
    write_cells_manifest(data)
    data.journal.unlink()
    assert read_kinds(data.cells_csv)[sevens[0][:16]] == "printed"
    samples = load_cells(data.cells, data.cells_csv)
    assert sum(s.kind == kind_index("printed") for s in samples) == 12
    config = load_config(smoke_config(tmp_path, real_cells=True))
    run = train(config, data, artifacts_dir=tmp_path / "out")
    card = (run / "model-card.md").read_text()
    assert "- Kind labels: 12 printed, 0 handwritten, 0 unsure" in card
    assert "- Cells manifest: none" not in card
    metrics = json.loads((run / "metrics.json").read_text())
    assert metrics["eval_set"] == "real" and metrics["n_test"] > 0


def test_label_state_lines_report_labels_review_and_check():
    state = {
        "printed": 1160,
        "handwritten": 375,
        "unsure": 12,
        "review_open": 4,
        "check": {"n": 200, "agreement": 0.975, "confusion": {}, "date": "2026-10-20"},
    }
    assert label_state_lines(state, 0.9812, 160) == (
        "- Kind labels: 1160 printed, 375 handwritten, 12 unsure\n"
        "- Open Review items: 4\n"
        "- Last check: 97.5% agreement on 200 cells, 2026-10-20\n"
        "- Kind accuracy (real test cells): 0.9812 on 160 cells\n"
    )


def test_label_state_lines_when_the_state_is_unknown():
    assert label_state_lines({"error": "cells.csv is out of date"}, None, 0) == (
        "- Kind labels: unknown (cells.csv is out of date)\n"
        "- Kind accuracy (real test cells): no labelled test cells\n"
    )

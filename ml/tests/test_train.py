import json
from pathlib import Path

import pytest
import torch

from sudoku_ml.contract import UNKNOWN_KIND
from sudoku_ml.train import (
    expected_calibration_error,
    fit_temperature,
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
    run = train(load_config(ML / "configs" / "smoke.toml"), ML, artifacts_dir=tmp_path)
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

import torch

from sudoku_ml.model import CellClassifier, ExportModel


def test_two_heads_with_contract_sizes():
    digit, kind = CellClassifier()(torch.zeros(5, 1, 32, 32))
    assert (tuple(digit.shape), tuple(kind.shape)) == ((5, 10), (5, 4))


def test_parameter_count():
    count = sum(p.numel() for p in CellClassifier().parameters())
    assert 50_000 < count < 100_000


def test_export_model_takes_nhwc_and_returns_named_probabilities():
    out = ExportModel(CellClassifier().eval())(torch.rand(3, 32, 32, 1))
    assert set(out) == {"digit", "kind"}
    assert torch.allclose(out["digit"].sum(1), torch.ones(3), atol=1e-5)
    assert torch.allclose(out["kind"].sum(1), torch.ones(3), atol=1e-5)


def test_temperature_scales_only_the_digit_head():
    inner = CellClassifier().eval()
    x = torch.rand(2, 32, 32, 1)
    logits, kind_logits = inner(x.permute(0, 3, 1, 2))
    out = ExportModel(inner, temperature=2.0)(x)
    assert torch.allclose(out["digit"], (logits / 2.0).softmax(1), atol=1e-6)
    assert torch.allclose(out["kind"], kind_logits.softmax(1), atol=1e-6)


def test_load_run_returns_the_eval_model_and_the_temperature(tmp_path):
    import json

    from sudoku_ml.model import load_run

    torch.save(CellClassifier().state_dict(), tmp_path / "model.pt")
    (tmp_path / "metrics.json").write_text(json.dumps({"temperature": 1.5}))
    model, temperature = load_run(tmp_path)
    assert not model.training and temperature == 1.5

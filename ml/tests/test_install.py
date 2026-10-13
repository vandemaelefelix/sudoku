import json
from pathlib import Path

import pytest

from sudoku_ml.install import install


def make_run(tmp_path: Path, contract: str = "2.0") -> Path:
    run = tmp_path / "20261009-210543-cell-classifier"
    run.mkdir()
    (run / "export.json").write_text(
        json.dumps({"contract": contract, "outputs": {"digit": 0, "kind": 1}})
    )
    (run / "metrics.json").write_text(json.dumps({"digit_accuracy": 0.98, "ece": 0.01}))
    (run / "cell-classifier.tflite").write_bytes(b"TFL3model")
    (run / "reference-outputs.json").write_text('{"run": "x"}')
    return run


def test_copies_the_files_and_writes_the_manifest(tmp_path):
    run = make_run(tmp_path)
    target = tmp_path / "models"
    manifest = json.loads(install(run, target, "1.0.0", "2026-10-11").read_text())
    assert (target / "cell-classifier.tflite").read_bytes() == b"TFL3model"
    assert (target / "reference-outputs.json").read_text() == '{"run": "x"}'
    assert manifest == {
        "model": "cell-classifier",
        "version": "1.0.0",
        "contract": "2.0",
        "file": "cell-classifier.tflite",
        "outputs": {"digit": 0, "kind": 1},
        "run": run.name,
        "metrics": {"digitAccuracy": 0.98, "ece": 0.01},
        "installedAt": "2026-10-11",
    }


def test_refuses_another_contract_major(tmp_path):
    with pytest.raises(ValueError, match="contract 1.0"):
        install(make_run(tmp_path, contract="1.0"), tmp_path / "models", "1.0.0", "2026-10-11")


def test_refuses_a_run_without_reference_outputs(tmp_path):
    run = make_run(tmp_path)
    (run / "reference-outputs.json").unlink()
    with pytest.raises(FileNotFoundError, match="just export"):
        install(run, tmp_path / "models", "1.0.0", "2026-10-11")

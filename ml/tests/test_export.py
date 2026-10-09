import json
from pathlib import Path

import flatbuffers
import numpy as np
import pytest
import torch
from ai_edge_litert import schema_py_generated as schema

from sudoku_ml.export import (
    check_float32,
    check_op_versions,
    check_same_argmax,
    export,
    non_float32_constants,
    op_versions,
    run_tflite,
)
from sudoku_ml.fixtures import load_reference_inputs
from sudoku_ml.model import CellClassifier, ExportModel
from sudoku_ml.train import load_config, train

ROOT = Path(__file__).parents[2]
FIXTURES = ROOT / "fixtures" / "preprocess"
TABLE = json.loads((ROOT / "ml/src/sudoku_ml/tflite_2_17_ops.json").read_text())


@pytest.fixture(scope="module")
def exported(tmp_path_factory) -> tuple[Path, Path]:
    run = train(
        load_config(ROOT / "ml/configs/smoke.toml"), ROOT / "ml", tmp_path_factory.mktemp("run")
    )
    return run, export(run, FIXTURES)


def test_small_float32_file(exported):
    _, tflite = exported
    assert tflite.stat().st_size <= 1_000_000
    check_float32(tflite)


def test_check_float32_rejects_other_types(exported, tmp_path):
    _, tflite = exported
    model = schema.ModelT.InitFromObj(schema.Model.GetRootAsModel(tflite.read_bytes(), 0))
    for tensor in model.subgraphs[0].tensors:
        if model.buffers[tensor.buffer].data is not None and len(model.buffers[tensor.buffer].data):
            tensor.type = schema.TensorType.FLOAT16
            break
    builder = flatbuffers.Builder(1024)
    builder.Finish(model.Pack(builder), b"TFL3")
    half = tmp_path / "half.tflite"
    half.write_bytes(bytes(builder.Output()))
    assert non_float32_constants(half)
    with pytest.raises(ValueError, match="not float32"):
        check_float32(half)


def test_every_op_runs_on_tflite_2_17(exported):
    _, tflite = exported
    check_op_versions(tflite, TABLE)


def test_check_rejects_a_version_above_the_table(exported):
    _, tflite = exported
    too_low = {op: 0 for op in op_versions(tflite)}
    with pytest.raises(ValueError):
        check_op_versions(tflite, too_low)


def test_outputs_are_found_by_shape(exported):
    run, tflite = exported
    info = json.loads((run / "export.json").read_text())
    outputs = run_tflite(tflite, load_reference_inputs(FIXTURES))
    assert outputs[info["outputs"]["digit"]].shape == (81, 10)
    assert outputs[info["outputs"]["kind"]].shape == (81, 4)


def test_tflite_matches_pytorch(exported):
    run, tflite = exported
    info = json.loads((run / "export.json").read_text())
    inputs = load_reference_inputs(FIXTURES)
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt"))
    reference = ExportModel(
        model.eval(), json.loads((run / "metrics.json").read_text())["temperature"]
    )
    expected = reference(torch.from_numpy(inputs))
    outputs = run_tflite(tflite, inputs)
    for name in ("digit", "kind"):
        got, want = outputs[info["outputs"][name]], expected[name].detach().numpy()
        assert (got.argmax(1) == want.argmax(1)).all()
        assert np.abs(got - want).max() < 1e-3


def test_check_same_argmax_rejects_a_different_digit():
    same = {"digit": np.eye(10)[:3], "kind": np.eye(4)[:3]}
    check_same_argmax(same, same)
    other = {"digit": np.eye(10)[[0, 1, 9]], "kind": np.eye(4)[:3]}
    with pytest.raises(ValueError, match="digit of cells \\[2\\]"):
        check_same_argmax(other, same)
    with pytest.raises(ValueError, match="kind"):
        check_same_argmax(same, {"digit": same["digit"], "kind": np.eye(4)[[3, 1, 2]]})

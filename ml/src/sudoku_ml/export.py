"""Export a run to TFLite. Check it against PyTorch and against the TFLite 2.17 runtime."""

import argparse
import base64
import json
import sys
from pathlib import Path

import litert_torch
import numpy as np
import torch
from ai_edge_litert import schema_py_generated as schema
from ai_edge_litert.interpreter import Interpreter

from sudoku_ml.contract import CONTRACT_VERSION, DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.data_paths import REPO_ROOT
from sudoku_ml.fixtures import load_reference_inputs
from sudoku_ml.model import ExportModel, load_run

_OP_NAMES = {v: k for k, v in vars(schema.BuiltinOperator).items() if not k.startswith("_")}
_TENSOR_NAMES = {v: k for k, v in vars(schema.TensorType).items() if not k.startswith("_")}
_ALLOWED_CONSTANTS = {schema.TensorType.FLOAT32, schema.TensorType.INT32, schema.TensorType.INT64}
TABLE_PATH = Path(__file__).with_name("tflite_2_17_ops.json")
MAX_BYTES = 1_000_000
PREPROCESS_FIXTURES = REPO_ROOT / "shared" / "fixtures" / "preprocess"


def op_versions(path: Path) -> dict[str, int]:
    model = schema.Model.GetRootAsModel(path.read_bytes(), 0)
    used: dict[str, int] = {}
    for i in range(model.OperatorCodesLength()):
        code = model.OperatorCodes(i)
        name = _OP_NAMES[max(code.BuiltinCode(), code.DeprecatedBuiltinCode())]
        used[name] = max(used.get(name, 0), code.Version())
    return used


def check_op_versions(path: Path, table: dict[str, int]) -> None:
    problems = [
        f"{op} v{v} (2.17 supports {table.get(op, 'none')})"
        for op, v in op_versions(path).items()
        if v > table.get(op, 0)
    ]
    if problems:
        raise ValueError("not supported by TFLite 2.17: " + ", ".join(problems))


def non_float32_constants(path: Path) -> list[str]:
    """List each constant tensor that is not float32 (int32 and int64 shape constants are fine)."""
    model = schema.Model.GetRootAsModel(path.read_bytes(), 0)
    found = []
    for s in range(model.SubgraphsLength()):
        subgraph = model.Subgraphs(s)
        for t in range(subgraph.TensorsLength()):
            tensor = subgraph.Tensors(t)
            if (
                model.Buffers(tensor.Buffer()).DataLength() == 0
                or tensor.Type() in _ALLOWED_CONSTANTS
            ):
                continue
            name = (tensor.Name() or b"").decode()
            found.append(f"{name or t} ({_TENSOR_NAMES[tensor.Type()]})")
    return found


def check_float32(path: Path) -> None:
    found = non_float32_constants(path)
    if found:
        raise ValueError("not float32: " + ", ".join(found))


def run_tflite(path: Path, inputs: np.ndarray) -> list[np.ndarray]:
    interpreter = Interpreter(model_path=str(path))
    interpreter.allocate_tensors()
    interpreter.set_tensor(interpreter.get_input_details()[0]["index"], inputs)
    interpreter.invoke()
    return [interpreter.get_tensor(d["index"]).copy() for d in interpreter.get_output_details()]


def check_same_argmax(outputs: dict[str, np.ndarray], expected: dict[str, np.ndarray]) -> None:
    """ADR-005: the digit and kind argmax must agree on every reference cell."""
    for name in ("digit", "kind"):
        wrong = np.nonzero(outputs[name].argmax(1) != expected[name].argmax(1))[0]
        if len(wrong):
            raise ValueError(f"TFLite and PyTorch disagree on the {name} of cells {wrong.tolist()}")


def write_reference_outputs(run: Path, inputs: np.ndarray, expected: dict[str, np.ndarray]) -> Path:
    """The PyTorch probabilities for the reference cells.

    The app compares the phone's outputs with them.
    """
    target = run / "reference-outputs.json"
    payload = {
        "run": run.name,
        "inputs": base64.b64encode(inputs.astype("<f4").tobytes()).decode("ascii"),
        "digit": expected["digit"].astype(float).tolist(),
        "kind": expected["kind"].astype(float).tolist(),
    }
    target.write_text(json.dumps(payload))
    return target


def export(run: Path, fixture_dir: Path) -> Path:
    model, temperature = load_run(run)
    wrapped = ExportModel(model, temperature).eval()
    inputs = load_reference_inputs(fixture_dir)
    target = run / "cell-classifier.tflite"
    litert_torch.convert(wrapped, (torch.from_numpy(inputs),)).export(str(target))
    check_op_versions(target, json.loads(TABLE_PATH.read_text()))
    check_float32(target)
    if target.stat().st_size > MAX_BYTES:
        raise ValueError(f"{target.stat().st_size} bytes is above the {MAX_BYTES} byte limit")

    outputs = run_tflite(target, inputs)
    by_width = {o.shape[1]: i for i, o in enumerate(outputs)}
    index = {"digit": by_width[len(DIGIT_CLASSES)], "kind": by_width[len(KIND_CLASSES)]}
    expected = wrapped(torch.from_numpy(inputs))
    diff = max(float(np.abs(outputs[index[n]] - expected[n].detach().numpy()).max()) for n in index)
    if diff >= 1e-3:
        raise ValueError(f"TFLite differs from PyTorch by {diff}")
    check_same_argmax(
        {n: outputs[index[n]] for n in index}, {n: expected[n].detach().numpy() for n in index}
    )
    info = {
        "contract": CONTRACT_VERSION,
        "input_shape": list(inputs.shape),
        "outputs": index,
        "max_abs_diff": diff,
        "bytes": target.stat().st_size,
        "ops": op_versions(target),
    }
    (run / "export.json").write_text(json.dumps(info, indent=2))
    write_reference_outputs(run, inputs, {n: expected[n].detach().numpy() for n in index})
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="just export")
    parser.add_argument("run", type=Path)
    args = parser.parse_args(argv)
    try:
        print(export(args.run, PREPROCESS_FIXTURES))
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

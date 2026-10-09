"""Export a run to TFLite. Check it against PyTorch and against the TFLite 2.17 runtime."""

import json
import sys
from pathlib import Path

import litert_torch
import numpy as np
import torch
from ai_edge_litert import schema_py_generated as schema
from ai_edge_litert.interpreter import Interpreter

from sudoku_ml.contract import CONTRACT_VERSION, DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.fixtures import load_reference_inputs
from sudoku_ml.model import CellClassifier, ExportModel

_OP_NAMES = {v: k for k, v in vars(schema.BuiltinOperator).items() if not k.startswith("_")}
TABLE_PATH = Path(__file__).with_name("tflite_2_17_ops.json")


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


def run_tflite(path: Path, inputs: np.ndarray) -> list[np.ndarray]:
    interpreter = Interpreter(model_path=str(path))
    interpreter.allocate_tensors()
    interpreter.set_tensor(interpreter.get_input_details()[0]["index"], inputs)
    interpreter.invoke()
    return [interpreter.get_tensor(d["index"]).copy() for d in interpreter.get_output_details()]


def export(run: Path, fixture_dir: Path) -> Path:
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt"))
    temperature = json.loads((run / "metrics.json").read_text())["temperature"]
    wrapped = ExportModel(model.eval(), temperature).eval()
    inputs = load_reference_inputs(fixture_dir)
    target = run / "cell-classifier.tflite"
    litert_torch.convert(wrapped, (torch.from_numpy(inputs),)).export(str(target))
    check_op_versions(target, json.loads(TABLE_PATH.read_text()))

    outputs = run_tflite(target, inputs)
    by_width = {o.shape[1]: i for i, o in enumerate(outputs)}
    index = {"digit": by_width[len(DIGIT_CLASSES)], "kind": by_width[len(KIND_CLASSES)]}
    expected = wrapped(torch.from_numpy(inputs))
    diff = max(float(np.abs(outputs[index[n]] - expected[n].detach().numpy()).max()) for n in index)
    if diff >= 1e-3:
        raise ValueError(f"TFLite differs from PyTorch by {diff}")
    info = {
        "contract": CONTRACT_VERSION,
        "input_shape": list(inputs.shape),
        "outputs": index,
        "max_abs_diff": diff,
        "bytes": target.stat().st_size,
        "ops": op_versions(target),
    }
    (run / "export.json").write_text(json.dumps(info, indent=2))
    return target


if __name__ == "__main__":
    print(export(Path(sys.argv[1]), Path(__file__).parents[3] / "fixtures" / "preprocess"))

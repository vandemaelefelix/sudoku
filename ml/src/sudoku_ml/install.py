"""Copy an exported run into the app without the promote gate. M0 only (ADR-007)."""

import datetime
import json
import shutil
import sys
from pathlib import Path

from sudoku_ml.contract import CONTRACT_VERSION

FILES = ("cell-classifier.tflite", "reference-outputs.json")


def _major(version: str) -> str:
    return version.split(".")[0]


def install(run: Path, target: Path, version: str, today: str) -> Path:
    info = json.loads((run / "export.json").read_text())
    # SUD-09: the scanner implements the same contract major as this package.
    if _major(info["contract"]) != _major(CONTRACT_VERSION):
        raise ValueError(
            f"the run implements contract {info['contract']}, the app {CONTRACT_VERSION}"
        )
    for name in FILES:
        if not (run / name).exists():
            raise FileNotFoundError(f"{run / name} is missing. Run `just export` on the run first")
    metrics = json.loads((run / "metrics.json").read_text())
    target.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        shutil.copyfile(run / name, target / name)
    manifest = {
        "model": "cell-classifier",
        "version": version,
        "contract": info["contract"],
        "file": FILES[0],
        "outputs": info["outputs"],
        "run": run.name,
        "metrics": {"digitAccuracy": metrics["digit_accuracy"], "ece": metrics["ece"]},
        "installedAt": today,
    }
    path = target / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n")
    return path


if __name__ == "__main__":
    print(
        install(
            Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], datetime.date.today().isoformat()
        )
    )

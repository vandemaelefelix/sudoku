"""Train the cell classifier from a TOML config. Writes one folder per run in artifacts/."""

import argparse
import hashlib
import json
import sys
import time
import tomllib
from dataclasses import asdict, dataclass, replace
from datetime import datetime
from pathlib import Path

import torch
import torch.nn.functional as F

from sudoku_ml.augment import augment
from sudoku_ml.contract import CONTRACT_VERSION, DIGIT_CLASSES, UNKNOWN_KIND, kind_index
from sudoku_ml.data_paths import ARTIFACTS, ML_ROOT, DataPaths
from sudoku_ml.dataset import read_real_cells, split_cells, stack, training_cells
from sudoku_ml.fixtures import FIXTURE_SEED
from sudoku_ml.label_store import LabelStore
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import preprocess_batch
from sudoku_ml.synthetic import font_files, generate

REVIEW_RATES = (0.0, 0.01, 0.02, 0.05)


@dataclass(frozen=True)
class Config:
    name: str
    seed: int
    epochs: int
    batch_size: int
    max_lr: float
    weight_decay: float
    label_smoothing: float
    kind_weight: float
    synthetic_per_class: int
    real_cells: bool
    split: list[float]
    augment: bool
    app_unedited: bool = False  # also train on scan cells that the player left unedited


def load_config(path: Path) -> Config:
    config = Config(**tomllib.loads(path.read_text()))
    # train() draws synthetic cells with seed and seed + 1 (SUD-10).
    if FIXTURE_SEED in (config.seed, config.seed + 1):
        raise ValueError(f"seed {config.seed} collides with the fixture seed {FIXTURE_SEED}")
    return config


def loss(digit_logits, kind_logits, digit, kind, kind_weight: float, label_smoothing: float):
    """Digit loss plus weighted kind loss. Unknown kinds add no kind loss."""
    total = F.cross_entropy(digit_logits, digit, label_smoothing=label_smoothing)
    known = kind != UNKNOWN_KIND
    if known.any():
        total = total + kind_weight * F.cross_entropy(kind_logits[known], kind[known])
    return total


def fit_temperature(logits: torch.Tensor, targets: torch.Tensor) -> float:
    log_t = torch.zeros(1, requires_grad=True)
    optimiser = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)

    def closure():
        optimiser.zero_grad()
        value = F.cross_entropy(logits / log_t.exp(), targets)
        value.backward()
        return value

    optimiser.step(closure)
    return float(log_t.detach().exp())


def review_accuracy(probs, targets, rates=REVIEW_RATES) -> dict[str, float]:
    confidence, prediction = probs.max(1)
    order = confidence.argsort(descending=True)
    correct = (prediction == targets)[order].float()
    result = {}
    for rate in rates:
        keep = max(1, round(len(order) * (1 - rate)))
        result[f"review_{rate:.0%}"] = round(float(correct[:keep].mean()), 6)
    return result


def label_state_lines(state: dict, kind_accuracy_real: float | None, n_kind_test: int) -> str:
    """The model card lines that say how far the kind labels can be trusted."""
    if "error" in state:
        lines = [f"- Kind labels: unknown ({state['error']})"]
    else:
        check = state["check"]
        lines = [
            f"- Kind labels: {state['printed']} printed, {state['handwritten']} handwritten, "
            f"{state['unsure']} unsure",
            f"- Open Review items: {state['review_open']}",
            f"- Last check: {check['agreement']:.1%} agreement on {check['n']} cells, "
            f"{check['date']}"
            if check
            else "- Last check: none yet",
        ]
    if kind_accuracy_real is None:
        lines.append("- Kind accuracy (real test cells): no labelled test cells")
    else:
        lines.append(
            f"- Kind accuracy (real test cells): {kind_accuracy_real:.4f} on {n_kind_test} cells"
        )
    return "".join(line + "\n" for line in lines)


def _label_state(data: DataPaths) -> dict:
    # A stale cells.csv must not stop a run. The card then says the state is unknown.
    try:
        return LabelStore(data).label_state()
    except (ValueError, OSError) as error:
        return {"error": str(error)}


def expected_calibration_error(probs, targets, bins: int = 15) -> float:
    confidence, prediction = probs.max(1)
    correct = (prediction == targets).float()
    edges = torch.linspace(0, 1, bins + 1)
    error = 0.0
    for lo, hi in zip(edges[:-1], edges[1:], strict=True):
        inside = (confidence > lo) & (confidence <= hi)
        if inside.any():
            error += (
                inside.float().mean() * (confidence[inside].mean() - correct[inside].mean()).abs()
            )
    return float(error)


def _device() -> torch.device:
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


def _logits(model, images: torch.Tensor, device) -> tuple[torch.Tensor, torch.Tensor]:
    model.eval()
    digit_out, kind_out = [], []
    with torch.no_grad():
        for start in range(0, len(images), 1024):
            x = images[start : start + 1024].to(device).permute(0, 3, 1, 2).float()
            d, k = model(preprocess_batch(x))
            digit_out.append(d.cpu())
            kind_out.append(k.cpu())
    return torch.cat(digit_out), torch.cat(kind_out)


def train(
    config: Config,
    data: DataPaths | None = None,
    artifacts_dir: Path = ARTIFACTS,
    ml_root: Path = ML_ROOT,
) -> Path:
    """`data` holds the real cells (default: `ml/dataset/`). `ml_root` holds fonts/."""
    started = time.time()
    data = data or DataPaths.under()
    real = []
    if config.real_cells:
        cells_dir = data.cells
        missing = [c for c in DIGIT_CLASSES if not (cells_dir / c).is_dir()]
        if missing:
            raise ValueError(f"the real data is not present: no folders {missing} in {cells_dir}")
        cells = read_real_cells(data)
        real = [c.sample for c in training_cells(cells, config.app_unedited)]
        if not real:
            raise ValueError(f"the real data is not present: no cells in {cells_dir}")
    torch.manual_seed(config.seed)
    generator = torch.Generator().manual_seed(config.seed)
    fonts = font_files(ml_root / "fonts")
    synthetic = generate(config.synthetic_per_class, config.seed, fonts)
    synthetic_val = generate(max(2, config.synthetic_per_class // 10), config.seed + 1, fonts)

    if real:
        train_cells, val_cells, test_cells = split_cells(
            cells, tuple(config.split), config.seed, config.app_unedited
        )
        real_train = [c.sample for c in train_cells]
        eval_sets = {
            "val": [c.sample for c in val_cells],
            "test": [c.sample for c in test_cells],
        }
    else:
        real_train, eval_sets = [], {"val": synthetic_val, "test": synthetic_val}

    syn_images, syn_digit, syn_kind = stack(synthetic)
    real_images, real_digit, real_kind = stack(real_train) if real_train else (None, None, None)
    device = _device()
    model = CellClassifier().to(device)
    n_train = len(synthetic) + len(real_train)
    steps = max(1, n_train // config.batch_size)
    optimiser = torch.optim.AdamW(
        model.parameters(), lr=config.max_lr, weight_decay=config.weight_decay
    )
    schedule = torch.optim.lr_scheduler.OneCycleLR(
        optimiser, config.max_lr, total_steps=steps * config.epochs
    )

    for _ in range(config.epochs):
        model.train()
        for _ in range(steps):
            half = config.batch_size // 2 if real_train else config.batch_size
            s = torch.randint(len(synthetic), (half,), generator=generator)
            parts = [(syn_images[s], syn_digit[s], syn_kind[s])]
            if real_train:
                r = torch.randint(len(real_train), (config.batch_size - half,), generator=generator)
                parts.append((real_images[r], real_digit[r], real_kind[r]))
            images = torch.cat([p[0] for p in parts]).to(device).permute(0, 3, 1, 2).float()
            digit = torch.cat([p[1] for p in parts]).to(device)
            kind = torch.cat([p[2] for p in parts]).to(device)
            if config.augment:
                images = augment(images, generator)
            d_logits, k_logits = model(preprocess_batch(images))
            value = loss(
                d_logits, k_logits, digit, kind, config.kind_weight, config.label_smoothing
            )
            optimiser.zero_grad()
            value.backward()
            optimiser.step()
            schedule.step()

    val_images, val_digit, _ = stack(eval_sets["val"])
    val_logits, _ = _logits(model, val_images, device)
    temperature = fit_temperature(val_logits, val_digit)
    test_images, test_digit, test_kind = stack(eval_sets["test"])
    test_logits, test_kind_logits = _logits(model, test_images, device)
    labelled = (test_kind == kind_index("printed")) | (test_kind == kind_index("handwritten"))
    n_kind_test = int(labelled.sum())
    kind_accuracy_real = (
        round(
            float((test_kind_logits.argmax(1)[labelled] == test_kind[labelled]).float().mean()), 6
        )
        if real and n_kind_test
        else None
    )
    test_probs = (test_logits / temperature).softmax(1)
    sv_images, _, sv_kind = stack(synthetic_val)
    _, sv_kind_logits = _logits(model, sv_images, device)

    metrics = {
        "eval_set": "real" if real else "synthetic",
        "digit_accuracy": round(float((test_probs.argmax(1) == test_digit).float().mean()), 6),
        "review": review_accuracy(test_probs, test_digit),
        "ece": round(expected_calibration_error(test_probs, test_digit), 6),
        "temperature": round(temperature, 4),
        "kind_accuracy_synthetic": round(
            float((sv_kind_logits.argmax(1) == sv_kind).float().mean()), 6
        ),
        "kind_accuracy_real": kind_accuracy_real,
        "n_kind_test": n_kind_test,
        "label_state": _label_state(data) if real else None,
        "n_train": n_train,
        "n_val": len(eval_sets["val"]),
        "n_test": len(eval_sets["test"]),
        "device": str(device),
        "seconds": round(time.time() - started, 1),
        "config": asdict(config),
    }
    run = artifacts_dir / f"{datetime.now():%Y%m%d-%H%M%S}-{config.name}"
    run.mkdir(parents=True)
    torch.save(model.cpu().state_dict(), run / "model.pt")
    (run / "metrics.json").write_text(json.dumps(metrics, indent=2))
    manifest = data.cells_csv
    manifest_hash = (
        hashlib.sha256(manifest.read_bytes()).hexdigest()[:16]
        if real and manifest.exists()
        else "none"
    )
    label_lines = (
        label_state_lines(metrics["label_state"], kind_accuracy_real, n_kind_test) if real else ""
    )
    (run / "model-card.md").write_text(
        f"# {config.name}\n\n- Contract: {CONTRACT_VERSION}\n- Torch: {torch.__version__}\n"
        f"- Device: {device}\n- Real cells: {'yes, the model stays private' if real else 'no'}\n"
        f"- Cells manifest: {manifest_hash}\n- Evaluated on: {metrics['eval_set']} test cells\n"
        f"- Digit accuracy: {metrics['digit_accuracy']:.4f}\n"
        f"- At review rates: {metrics['review']}\n"
        f"- Temperature: {metrics['temperature']}\n"
        f"- ECE: {metrics['ece']:.4f}\n"
        f"- Test cells: {metrics['n_test']}\n"
        f"{label_lines}"
        f"- Kind accuracy (synthetic cells only): {metrics['kind_accuracy_synthetic']:.4f}\n"
    )
    return run


def main(argv: list[str]) -> Path:
    parser = argparse.ArgumentParser(prog="just train")
    parser.add_argument("config", type=Path)
    parser.add_argument(
        "--app-unedited",
        action="store_true",
        help="also train on scan cells that the player left as the model answered",
    )
    args = parser.parse_args(argv)
    config = load_config(args.config)
    if args.app_unedited:
        config = replace(config, app_unedited=True)
    return train(config)


if __name__ == "__main__":
    print(main(sys.argv[1:]))

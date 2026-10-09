"""Find training cells whose label is probably wrong (cross-validated loss ranking, R-13)."""

import csv
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

from sudoku_ml.augment import augment
from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.dataset import group_ids, load_cells, stack
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import preprocess_batch
from sudoku_ml.train import _device, _logits, loss


def rank_suspects(names, labels, probs: np.ndarray, top: int) -> list[dict]:
    p_label = probs[np.arange(len(labels)), labels]
    order = np.argsort(p_label)[:top]
    return [
        {
            "file": names[i],
            "label": DIGIT_CLASSES[labels[i]],
            "predicted": DIGIT_CLASSES[int(probs[i].argmax())],
            "p_label": round(float(p_label[i]), 4),
            "p_predicted": round(float(probs[i].max()), 4),
        }
        for i in order
    ]


def refuse_reviewed(path: Path) -> None:
    """Raise when the file has a chosen new_label. A rerun would destroy that work."""
    if not path.exists():
        return
    with path.open(newline="", encoding="utf-8-sig") as handle:
        if any((r.get("new_label") or "").strip() for r in csv.DictReader(handle)):
            raise ValueError(f"{path} has reviewed labels. Move the file first.")


def write_relabels(rows: list[dict], path: Path) -> None:
    """Write the review file. Refuse to overwrite a file with a chosen new_label."""
    refuse_reviewed(path)
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["file", "label", "predicted", "new_label"])
        writer.writerows([[r["file"], r["label"], r["predicted"], ""] for r in rows])


def _fit(images, digit, kind, epochs: int, device, generator) -> CellClassifier:
    model = CellClassifier().to(device)
    steps = max(1, len(images) // 256)
    optimiser = torch.optim.AdamW(model.parameters(), lr=0.003, weight_decay=1e-4)
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimiser, 0.003, total_steps=steps * epochs)
    for _ in range(epochs):
        model.train()
        for _ in range(steps):
            i = torch.randint(len(images), (256,), generator=generator)
            x = augment(images[i].to(device).permute(0, 3, 1, 2).float(), generator)
            d, k = model(preprocess_batch(x))
            value = loss(d, k, digit[i].to(device), kind[i].to(device), 0.4, 0.05)
            optimiser.zero_grad()
            value.backward()
            optimiser.step()
            schedule.step()
    return model


def _sheets(rows: list[dict], cells_dir: Path, out: Path) -> None:
    by_name = {p.stem: p for p in cells_dir.glob("*/*.png")}
    for sheet, start in enumerate(range(0, len(rows), 50)):
        canvas = Image.new("RGB", (10 * 110, 5 * 130), "white")
        draw = ImageDraw.Draw(canvas)
        for n, row in enumerate(rows[start : start + 50]):
            x, y = (n % 10) * 110, (n // 10) * 130
            cell = Image.open(by_name[row["file"]]).convert("RGB").resize((100, 100))
            canvas.paste(cell, (x + 5, y + 5))
            caption = f"{start + n} {row['label']}->{row['predicted']}"
            draw.text((x + 5, y + 108), caption, fill="black")
        canvas.save(out / f"sheet-{sheet:02d}.png")


def find_suspects(ml_root: Path, folds: int = 5, epochs: int = 12, top: int = 150) -> Path:
    cells_dir = ml_root / "data" / "cells"
    out = ml_root / "data" / "review"
    refuse_reviewed(out / "relabels.csv")  # fail before the slow cross-validation
    paths = [p for label in DIGIT_CLASSES for p in sorted((cells_dir / label).glob("*.png"))]
    samples = load_cells(cells_dir)
    if len(paths) != len(samples):
        raise ValueError(f"{len(paths)} files but {len(samples)} cells")
    images, digit, kind = stack(samples)
    groups = group_ids(samples)
    unique = np.random.default_rng(0).permutation(np.unique(groups))
    fold_of = {g: i % folds for i, g in enumerate(unique)}
    fold = np.array([fold_of[g] for g in groups])
    device, generator = _device(), torch.Generator().manual_seed(0)
    probs = np.zeros((len(samples), len(DIGIT_CLASSES)), dtype=np.float32)
    for f in range(folds):
        train_idx = torch.from_numpy(np.nonzero(fold != f)[0])
        held = torch.from_numpy(np.nonzero(fold == f)[0])
        model = _fit(
            images[train_idx], digit[train_idx], kind[train_idx], epochs, device, generator
        )
        logits, _ = _logits(model, images[held], device)
        probs[held.numpy()] = logits.softmax(1).numpy()
    rows = rank_suspects([p.stem for p in paths], digit.tolist(), probs, top)
    out.mkdir(parents=True, exist_ok=True)
    with (out / "suspects.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    write_relabels(rows, out / "relabels.csv")
    _sheets(rows, cells_dir, out)
    return out


if __name__ == "__main__":
    print(find_suspects(Path(__file__).parents[2]))

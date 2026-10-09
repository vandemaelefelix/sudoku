"""Reference pairs that pin the contract preprocessing for Python and the app. Synthetic only."""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.contract import BATCH
from sudoku_ml.preprocess import preprocess_cell
from sudoku_ml.synthetic import font_files, generate

# SUD-10: training must never draw synthetic cells with this seed.
FIXTURE_SEED = 2026


def write_preprocess_fixtures(out_dir: Path, fonts: list[Path], seed: int = FIXTURE_SEED) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for n, sample in enumerate(generate(per_class=9, seed=seed, fonts=fonts)[:BATCH]):
        Image.fromarray(sample.image).save(out_dir / f"{n:02d}.cell.png")
        values = np.round(preprocess_cell(sample.image).astype(np.float64), 6).tolist()
        payload = {"shape": [32, 32], "values": values}
        (out_dir / f"{n:02d}.expected.json").write_text(json.dumps(payload))


def load_reference_inputs(fixture_dir: Path) -> np.ndarray:
    """The 81 reference cells, preprocessed, as one model input batch."""
    pngs = sorted(fixture_dir.glob("*.cell.png"))
    cells = [preprocess_cell(np.asarray(Image.open(p).convert("RGB"))) for p in pngs]
    return np.stack(cells)[..., np.newaxis].astype(np.float32)


if __name__ == "__main__":
    write_preprocess_fixtures(Path(sys.argv[1]), font_files(Path(__file__).parents[2] / "fonts"))

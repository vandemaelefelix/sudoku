import json
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.fixtures import load_reference_inputs, write_preprocess_fixtures
from sudoku_ml.preprocess import preprocess_cell
from sudoku_ml.synthetic import font_files

ROOT = Path(__file__).parents[2]
COMMITTED = ROOT / "shared" / "fixtures" / "preprocess"
FONTS = font_files(ROOT / "ml" / "fonts")


def test_writes_81_pairs(tmp_path: Path):
    write_preprocess_fixtures(tmp_path, FONTS)
    assert len(list(tmp_path.glob("*.cell.png"))) == 81
    assert len(list(tmp_path.glob("*.expected.json"))) == 81


def test_committed_fixtures_match_preprocessing():
    pngs = sorted(COMMITTED.glob("*.cell.png"))
    assert len(pngs) == 81
    for png in pngs:
        cell = np.asarray(Image.open(png).convert("RGB"))
        expected = json.loads(
            png.with_name(png.name.replace(".cell.png", ".expected.json")).read_text()
        )
        assert expected["shape"] == [32, 32]
        assert np.abs(preprocess_cell(cell) - np.array(expected["values"])).max() <= 1e-5


def test_reference_inputs_are_one_model_batch():
    inputs = load_reference_inputs(COMMITTED)
    assert (inputs.shape, inputs.dtype) == ((81, 32, 32, 1), np.float32)

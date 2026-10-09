from collections import Counter
from pathlib import Path

import numpy as np

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES, is_valid_pair, kind_index
from sudoku_ml.synthetic import font_files, generate, render_cell

FONTS = font_files(Path(__file__).parents[1] / "fonts")


def ink(image: np.ndarray) -> float:
    return float(255 - image[8:56, 8:56].mean())


def test_seven_fonts():
    assert len(FONTS) == 7


def test_rendered_cell_is_a_cell_image():
    image = render_cell(np.random.default_rng(1), 7, "printed", FONTS)
    assert (image.shape, image.dtype) == ((64, 64, 3), np.uint8)


def test_digit_has_more_ink_than_notes_and_notes_more_than_empty():
    rng = np.random.default_rng(2)
    digit = np.mean([ink(render_cell(rng, 8, "printed", FONTS)) for _ in range(20)])
    notes = np.mean([ink(render_cell(rng, 0, "notes", FONTS)) for _ in range(20)])
    empty = np.mean([ink(render_cell(rng, 0, "none", FONTS)) for _ in range(20)])
    assert digit > notes > empty


def test_generate_counts_and_labels():
    samples = generate(per_class=4, seed=3, fonts=FONTS)
    counts = Counter((s.digit, s.kind) for s in samples)
    assert counts[(0, kind_index("none"))] == 4
    assert counts[(0, kind_index("notes"))] == 2
    assert all(counts[(d, kind_index("printed"))] == 4 for d in range(1, 10))
    assert all(is_valid_pair(DIGIT_CLASSES[s.digit], KIND_CLASSES[s.kind]) for s in samples)


def test_generate_is_deterministic():
    a, b = generate(1, 5, FONTS), generate(1, 5, FONTS)
    assert all(np.array_equal(x.image, y.image) for x, y in zip(a, b, strict=True))


def test_every_font_has_its_own_licence():
    fonts = list((Path(__file__).parents[1] / "fonts").glob("*/*.ttf"))
    assert fonts
    assert all((f.parent / "OFL.txt").is_file() for f in fonts)

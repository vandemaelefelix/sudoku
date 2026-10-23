import io

import numpy as np
import pytest
from PIL import Image

from sudoku_ml.scan_render import OUTLINE_COLOUR, grid_png, outline_jpeg

PHOTO = np.full((400, 600, 3), 200, dtype=np.uint8)
SQUARE = [[100.0, 50.0], [500.0, 50.0], [500.0, 350.0], [100.0, 350.0]]
CORNERS = "100.0 50.0 500.0 50.0 500.0 350.0 100.0 350.0"


def decode(data: bytes) -> np.ndarray:
    return np.array(Image.open(io.BytesIO(data)).convert("RGB"))


def test_the_outline_picture_is_a_jpeg_with_the_long_side_at_the_size():
    data = outline_jpeg(PHOTO, CORNERS, 300)
    image = Image.open(io.BytesIO(data))
    assert image.format == "JPEG" and image.size == (300, 200)


def test_a_small_photo_is_not_enlarged():
    assert Image.open(io.BytesIO(outline_jpeg(PHOTO, "", 2000))).size == (600, 400)


def test_the_outline_is_drawn_only_with_corners():
    plain, drawn = decode(outline_jpeg(PHOTO, "", 600)), decode(outline_jpeg(PHOTO, CORNERS, 600))
    assert (plain == 200).all() and not (drawn == 200).all()


def test_the_grid_picture_has_cell_lines_only_on_request():
    bare, lined = decode(grid_png(PHOTO, SQUARE, False)), decode(grid_png(PHOTO, SQUARE, True))
    green = (lined == OUTLINE_COLOUR).all(axis=2)
    assert not (bare == OUTLINE_COLOUR).all(axis=2).any() and green.any()
    assert bare.shape == lined.shape and bare.shape[0] == bare.shape[1]


def test_corners_that_do_not_form_a_grid_raise_a_value_error():
    with pytest.raises(ValueError):
        grid_png(PHOTO, [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [0.0, 0.0]], False)

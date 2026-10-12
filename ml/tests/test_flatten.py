import numpy as np
import pytest
from photos import save_photo

from sudoku_ml.flatten import (
    FLAT_SIZE,
    check_corners,
    load_upright,
    slice_cells,
    usable_cells,
    warp_grid,
)

EDGE = FLAT_SIZE - 0.5
SQUARE = [[-0.5, -0.5], [EDGE, -0.5], [EDGE, EDGE], [-0.5, EDGE]]


def test_corners_on_the_pixel_edges_give_the_same_image():
    rgb = np.random.default_rng(0).integers(0, 256, (FLAT_SIZE, FLAT_SIZE, 3), dtype=np.uint8)
    assert np.abs(warp_grid(rgb, SQUARE).astype(int) - rgb).max() <= 1


def test_slice_cells_goes_row_by_row():
    flat = np.zeros((FLAT_SIZE, FLAT_SIZE, 3), dtype=np.uint8)
    for n in range(81):
        r, c = divmod(n, 9)
        flat[r * 64 : (r + 1) * 64, c * 64 : (c + 1) * 64] = n
    cells = slice_cells(flat)
    assert len(cells) == 81
    assert all(cell.shape == (64, 64, 3) and (cell == n).all() for n, cell in enumerate(cells))


def test_every_cell_is_usable_when_the_grid_fills_the_photo():
    assert sum(usable_cells(SQUARE, FLAT_SIZE, FLAT_SIZE)) == 81


def test_a_photo_that_ends_inside_the_last_column_drops_that_column():
    usable = usable_cells(SQUARE, int(8.5 * 64), FLAT_SIZE)
    assert sum(usable) == 72
    assert not any(usable[8::9])


def test_corners_outside_the_photo_are_allowed():
    corners = [[-200.0, -0.5], [EDGE, -0.5], [EDGE, EDGE], [-200.0, EDGE]]
    assert 0 < sum(usable_cells(corners, FLAT_SIZE, FLAT_SIZE)) < 81


@pytest.mark.parametrize(
    "bad",
    [
        [[0, 0], [1, 0], [1, 1]],
        [[0, 0], [1, 0], [1, 1], [0, "x"]],
        [[0, 0], [1, 0], [1, 1], [0, float("nan")]],
        [[0, 0], [0, 0], [0, 0], [0, 0]],
    ],
)
def test_check_corners_refuses_bad_corners(bad):
    with pytest.raises(ValueError):
        check_corners(bad)


def test_load_upright_applies_exif_rotation(tmp_path):
    rgb = np.zeros((20, 40, 3), dtype=np.uint8)
    path = save_photo(rgb, tmp_path / "turned.png", orientation=6)
    assert load_upright(path).shape == (40, 20, 3)

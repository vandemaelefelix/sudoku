import numpy as np
from photos import grid_photo

from sudoku_ml.grid_detect import MIN_LINES, find_grid


def test_a_printed_grid_is_found_at_its_outer_edge():
    found = find_grid(grid_photo(left=200, top=100, size=540))
    assert found.corners is not None
    expected = [[200, 100], [740, 100], [740, 640], [200, 640]]
    assert np.abs(np.array(found.corners) - expected).max() <= 8
    assert found.lines >= MIN_LINES and found.reason == "full grid"


def test_a_blank_photo_has_no_grid():
    blank = np.full((600, 800, 3), 230, dtype=np.uint8)
    found = find_grid(blank)
    assert found.corners is None and found.lines == 0 and found.reason == "no grid outline"

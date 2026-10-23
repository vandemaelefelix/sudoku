"""The pictures of the Outlines step: a scan with its outline, and the grid that a cut makes.
Pure: each function takes an RGB image and returns the bytes of a picture."""

import io

import cv2
import numpy as np
from PIL import Image

from sudoku_ml.flatten import GRID_CELLS, check_corners, warp_grid
from sudoku_ml.tables import parse_corners

OUTLINE_COLOUR = (58, 214, 90)


def _encode(image: np.ndarray, fmt: str, **options) -> bytes:
    out = io.BytesIO()
    Image.fromarray(image).save(out, fmt, **options)
    return out.getvalue()


def outline_jpeg(rgb: np.ndarray, corners: str, size: int) -> bytes:
    """The scan at `size` pixels on the long side. With `corners` (format_corners text), the
    outline is drawn in green."""
    scale = min(1.0, size / max(rgb.shape[:2]))
    small = cv2.resize(rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    if corners:
        quad = np.array(parse_corners(corners), dtype=np.float32) * scale
        width = max(2, round(max(small.shape[:2]) / 160))
        cv2.polylines(small, [quad.round().astype(np.int32)], True, OUTLINE_COLOUR, width)
    return _encode(small, "JPEG", quality=85)


def grid_png(rgb: np.ndarray, corners: list[list[float]], lines: bool) -> bytes:
    """The grid that `corners` cut from the scan, square. With `lines`, the cell lines are drawn:
    the preview of a fix. Without them, place (row, col) sits at the same 1/9 of each side.
    Raises ValueError when the corners do not form a grid."""
    try:
        flat = warp_grid(rgb, check_corners(corners))
    except (np.linalg.LinAlgError, cv2.error) as error:
        raise ValueError("these corners do not form a grid") from error
    if lines:
        step = flat.shape[0] / GRID_CELLS
        for k in range(GRID_CELLS + 1):
            at = min(round(k * step), flat.shape[0] - 1)
            thick = 2 if k % 3 == 0 else 1
            flat[max(0, at - thick + 1) : at + 1, :] = OUTLINE_COLOUR
            flat[:, max(0, at - thick + 1) : at + 1] = OUTLINE_COLOUR
    return _encode(flat, "PNG")

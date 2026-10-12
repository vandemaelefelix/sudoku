"""The flatten of the app's scanner, in Python: 4 corners, a 576 × 576 grid, 81 cell images.

The numbers copy apps/mobile/src/scanner/warp.ts and pixels.ts (SUD-07: files only, no imports).
"""

import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from sudoku_ml.contract import CELL_SIZE

register_heif_opener()

GRID_CELLS = 9
FLAT_SIZE = CELL_SIZE * GRID_CELLS
# Pixel centres are on integers, so the edges of the square are at -0.5 and FLAT_SIZE - 0.5, as
# in warpGrid of the app.
_EDGE = FLAT_SIZE - 0.5
_SQUARE = np.array([[-0.5, -0.5], [_EDGE, -0.5], [_EDGE, _EDGE], [-0.5, _EDGE]], dtype=np.float32)

Corners = list[list[float]]  # top left, top right, bottom right, bottom left; upright photo pixels


def load_upright(path: Path) -> np.ndarray:
    """(H, W, 3) uint8 RGB, turned by the EXIF orientation. All corners use these pixels."""
    with Image.open(path) as image:
        return np.asarray(ImageOps.exif_transpose(image).convert("RGB"))


def check_corners(corners) -> Corners:
    """A float copy of 4 finite [x, y] points of a convex quad. Raises ValueError."""
    try:
        points = [[float(x), float(y)] for x, y in corners]
    except (TypeError, ValueError) as error:
        raise ValueError(f"corners must be 4 [x, y] pairs: {error}") from error
    if len(points) != 4 or not all(math.isfinite(v) for p in points for v in p):
        raise ValueError("corners must be 4 [x, y] pairs of finite numbers")
    quad = np.array(points, dtype=np.float32)
    if cv2.contourArea(quad) < 1.0:
        raise ValueError("the 4 corners do not span an area")
    # A bow-tie or a quad with 3 collinear corners has an area but no valid homography.
    if not cv2.isContourConvex(quad):
        raise ValueError("the 4 corners must form a convex quad")
    return points


def homography(corners: Corners) -> np.ndarray:
    return cv2.getPerspectiveTransform(np.array(corners, dtype=np.float32), _SQUARE)


def warp_grid(image: np.ndarray, corners: Corners) -> np.ndarray:
    """FLAT_SIZE square: bilinear, border pixels repeated, as the app's warpPerspective call."""
    return cv2.warpPerspective(
        image,
        homography(corners),
        (FLAT_SIZE, FLAT_SIZE),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )


def slice_cells(flat: np.ndarray) -> list[np.ndarray]:
    """81 (CELL_SIZE, CELL_SIZE, 3) cell images, row by row, as sliceCells of the app."""
    return [
        flat[r * CELL_SIZE : (r + 1) * CELL_SIZE, c * CELL_SIZE : (c + 1) * CELL_SIZE].copy()
        for r in range(GRID_CELLS)
        for c in range(GRID_CELLS)
    ]


def usable_cells(corners: Corners, width: int, height: int) -> list[bool]:
    """Per cell, row by row: True when all 4 cell corners lie inside the photo.

    A perspective transform keeps straight lines straight, so the whole cell is then inside.
    """
    edges = np.arange(GRID_CELLS + 1) * CELL_SIZE - 0.5
    xs, ys = np.meshgrid(edges, edges)
    points = np.stack([xs.ravel(), ys.ravel()], axis=1).astype(np.float32)[None]
    inverse = np.linalg.inv(homography(corners))
    photo = cv2.perspectiveTransform(points, inverse)[0].reshape(GRID_CELLS + 1, GRID_CELLS + 1, 2)
    tolerance = 1e-3
    inside = (
        (photo[..., 0] >= -0.5 - tolerance)
        & (photo[..., 0] <= width - 0.5 + tolerance)
        & (photo[..., 1] >= -0.5 - tolerance)
        & (photo[..., 1] <= height - 0.5 + tolerance)
    )
    return [
        bool(inside[r, c] and inside[r, c + 1] and inside[r + 1, c] and inside[r + 1, c + 1])
        for r in range(GRID_CELLS)
        for c in range(GRID_CELLS)
    ]

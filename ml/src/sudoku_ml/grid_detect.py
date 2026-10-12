"""Find the sudoku grid in a photo: the largest four-corner outlines, a flatten from each, then a
check that the 20 grid lines lie where a flattened grid has them. A proposal for the person on
the Photos screen, not the app's scanner."""

from dataclasses import dataclass

import cv2
import numpy as np

from sudoku_ml.contract import CELL_SIZE
from sudoku_ml.flatten import Corners, warp_grid

DETECT_SIZE = 800  # long side in pixels for the outline search
MIN_GRID_SHARE = 0.3  # mean grid edge / short side of the photo
SEARCH = CELL_SIZE // 4  # pixels around each expected line
LINE_COVERAGE = 0.5  # share of the grid width that a line must cover
MIN_LINES = 17  # of the 10 horizontal and 10 vertical lines; a curl or a pen can hide a few
LINE_CONTRAST = 0.3  # a line covers this much more of the width than the cells beside it
MAX_CANDIDATES = 6
# A low offset finds faint, blurred lines. A high offset keeps paper grain from looking like lines.
THRESHOLD_OFFSETS = (3, 10)


@dataclass(frozen=True)
class Detection:
    corners: Corners | None  # None when no four-corner outline exists
    lines: int  # grid lines found, 0 to 20
    reason: str


def _order(quad: np.ndarray) -> np.ndarray:
    s = quad.sum(axis=1)
    d = np.diff(quad, axis=1).ravel()
    return np.array(
        [quad[np.argmin(s)], quad[np.argmin(d)], quad[np.argmax(s)], quad[np.argmax(d)]],
        dtype=np.float32,
    )


def _candidate_outlines(gray: np.ndarray) -> list[np.ndarray]:
    """Convex four-corner outlines, largest first. A page outline can come before the grid."""
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 7
    )
    binary = cv2.dilate(binary, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    outlines: list[np.ndarray] = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[: MAX_CANDIDATES * 3]:
        # The hull ignores digits and text that touch the outer grid line.
        hull = cv2.convexHull(contour)
        perimeter = cv2.arcLength(hull, True)
        for epsilon in (0.02, 0.03, 0.04, 0.06):
            approx = cv2.approxPolyDP(hull, epsilon * perimeter, True)
            if len(approx) == 4:
                quad = _order(approx.reshape(4, 2).astype(np.float32))
                # The inner and outer edge of one thick line give two near-equal outlines.
                if all(np.abs(quad - known).max() > 0.02 * max(gray.shape) for known in outlines):
                    outlines.append(quad)
                break
            if len(approx) < 4:
                break
        if len(outlines) == MAX_CANDIDATES:
            break
    return outlines


def _line_profile(mask: np.ndarray) -> np.ndarray:
    """Share of each row that holds ink within 2 rows, so a slightly bent line still counts."""
    thick = cv2.dilate(mask, np.ones((5, 1), np.uint8))
    return (thick > 0).mean(axis=1)


def _count_lines_in(binary: np.ndarray) -> int:
    # Close the gaps in faint lines first. The openings with long thin kernels then keep the grid
    # lines and drop the digits.
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((1, 9), np.uint8))
    horizontal = cv2.morphologyEx(
        horizontal, cv2.MORPH_OPEN, np.ones((1, CELL_SIZE // 2), np.uint8)
    )
    vertical = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((9, 1), np.uint8))
    vertical = cv2.morphologyEx(vertical, cv2.MORPH_OPEN, np.ones((CELL_SIZE // 2, 1), np.uint8))
    found = 0
    for profile in (_line_profile(horizontal), _line_profile(vertical.T)):
        mid, band = CELL_SIZE // 2, CELL_SIZE // 6
        gaps = [
            profile[k * CELL_SIZE + mid - band : k * CELL_SIZE + mid + band].max() for k in range(9)
        ]
        for k in range(10):
            peak = profile[max(0, k * CELL_SIZE - SEARCH) : k * CELL_SIZE + SEARCH + 1].max()
            beside = max(gaps[k - 1] if k > 0 else 0.0, gaps[k] if k < 9 else 0.0)
            found += bool(peak >= LINE_COVERAGE and peak - beside >= LINE_CONTRAST)
    return found


def _count_lines(flat_gray: np.ndarray) -> int:
    """The expected grid lines (0 to 20) that stand out from the cells beside them."""
    blurred = cv2.GaussianBlur(flat_gray, (3, 3), 0)
    return max(
        _count_lines_in(
            cv2.adaptiveThreshold(
                blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, offset
            )
        )
        for offset in THRESHOLD_OFFSETS
    )


def find_grid(rgb: np.ndarray) -> Detection:
    """The best outline of an upright RGB photo. Never raises on odd images."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    height, width = gray.shape
    scale = min(1.0, DETECT_SIZE / max(height, width))
    small = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    best: Detection | None = None
    for outline in _candidate_outlines(small):
        corners = outline / scale
        tl, tr, br, bl = corners
        mean_edge = (np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2
        if mean_edge < MIN_GRID_SHARE * min(height, width):
            break  # the candidates are sorted by area, so the rest are smaller still
        listed = [[float(x), float(y)] for x, y in corners]
        found = _count_lines(warp_grid(gray, listed))
        if best is not None and found <= best.lines:
            continue
        reason = "full grid" if found >= MIN_LINES else f"only {found} of 20 grid lines"
        best = Detection(listed, found, reason)
        if found >= MIN_LINES:
            return best
    return best or Detection(None, 0, "no grid outline")

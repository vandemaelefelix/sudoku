"""Synthetic sudoku photos for the import tests."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def grid_photo(
    width: int = 1000,
    height: int = 800,
    left: int = 200,
    top: int = 100,
    size: int = 540,
    seed: int = 0,
) -> np.ndarray:
    """(height, width, 3) uint8: a printed 9 × 9 grid with random digits on off-white paper.
    The outer grid edge is at left, top, left + size and top + size."""
    image = Image.new("RGB", (width, height), (235, 230, 220))
    draw = ImageDraw.Draw(image)
    step = size / 9
    for k in range(10):
        line_width = 5 if k % 3 == 0 else 2
        x, y = left + k * step, top + k * step
        draw.line([(x, top), (x, top + size)], fill=(20, 20, 20), width=line_width)
        draw.line([(left, y), (left + size, y)], fill=(20, 20, 20), width=line_width)
    font = ImageFont.load_default(size=int(step * 0.6))
    rng = np.random.default_rng(seed)
    for row in range(9):
        for col in range(9):
            if rng.random() < 0.4:
                centre = (left + (col + 0.5) * step, top + (row + 0.5) * step)
                digit = str(int(rng.integers(1, 10)))
                draw.text(centre, digit, fill=(30, 30, 30), font=font, anchor="mm")
    return np.asarray(image)


def save_photo(rgb: np.ndarray, path: Path, orientation: int | None = None) -> Path:
    """Save as PNG. With `orientation`, also write that EXIF orientation tag (274)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.fromarray(rgb)
    if orientation is None:
        image.save(path)
    else:
        exif = Image.Exif()
        exif[274] = orientation
        image.save(path, exif=exif)
    return path

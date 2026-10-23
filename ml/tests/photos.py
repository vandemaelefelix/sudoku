"""Synthetic sudoku photos for the import tests."""

from pathlib import Path

import numpy as np
from cells import Clock
from PIL import Image, ImageDraw, ImageFont

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.photo_import import import_folder
from sudoku_ml.tables import pixel_id

FULL = [[200, 100], [740, 100], [740, 640], [200, 640]]  # the grid of grid_photo()


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


def add_plain_cell(folder: Path, grey: int) -> str:
    folder.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (64, 64), (grey,) * 3).save(folder / "tmp.png")
    cell_id = pixel_id(folder / "tmp.png")
    (folder / "tmp.png").rename(folder / f"{cell_id[:16]}.png")
    return cell_id


def valid_root(tmp_path: Path) -> DataPaths:
    """3 sudoku photos: one accepted (cells cut and linked), one rejected, one pending. One
    older cell in empty/ and one in discarded/ have no source."""
    paths = DataPaths.under(tmp_path / "data")
    for n in range(3):
        save_photo(grid_photo(seed=n), tmp_path / "in" / f"p{n}.png")
    import_folder(tmp_path / "in", paths, source="phone", licence="own")
    check = PhotoCheck(paths, "s1", Clock())
    first, second, _ = check.pending()
    check.accept(first, FULL)
    check.reject(second)
    add_plain_cell(paths.cells / "empty", 9)
    add_plain_cell(paths.cells / "discarded", 7)
    write_cells_manifest(paths)
    return paths

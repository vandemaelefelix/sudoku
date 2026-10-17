"""Rendered cell images: printed digits, pencil notes and empty cells (ADR-006)."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from sudoku_ml.contract import CELL_SIZE, kind_index


@dataclass(frozen=True)
class Sample:
    image: np.ndarray  # (64, 64, 3) uint8 RGB cell image
    digit: int  # index in DIGIT_CLASSES, 0 = empty
    kind: int  # index in KIND_CLASSES, or UNKNOWN_KIND
    photo: str = ""  # id of the scan photo that the cell came from, or empty


def font_files(fonts_dir: Path) -> list[Path]:
    return sorted(fonts_dir.rglob("*.ttf"))


def _colour(rng: np.random.Generator, dark: bool) -> tuple[int, int, int]:
    if not dark:
        base = int(rng.integers(185, 256))
        return tuple(int(v) for v in np.clip(base - rng.integers(0, 25, 3), 0, 255))
    if rng.random() < 0.15:  # coloured ink: blue or red pen, coloured print
        return (int(rng.integers(0, 60)), int(rng.integers(0, 60)), int(rng.integers(90, 200)))[
            :: 1 if rng.random() < 0.5 else -1
        ]
    grey = int(rng.integers(0, 90))
    return (grey, grey, grey)


def _font(rng: np.random.Generator, fonts: list[Path], size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(fonts[int(rng.integers(len(fonts)))]), size)


def _grid_lines(draw: ImageDraw.ImageDraw, rng: np.random.Generator, ink) -> None:
    for side in range(4):
        if rng.random() < 0.7:
            offset = int(rng.integers(0, 10))  # up to 9 px: sometimes inside the crop
            width = int(rng.integers(1, 4))
            pos = offset if side < 2 else CELL_SIZE - 1 - offset
            if side % 2 == 0:
                draw.line([(0, pos), (CELL_SIZE, pos)], fill=ink, width=width)
            else:
                draw.line([(pos, 0), (pos, CELL_SIZE)], fill=ink, width=width)


def render_cell(rng: np.random.Generator, digit: int, kind: str, fonts: list[Path]) -> np.ndarray:
    paper, ink = _colour(rng, dark=False), _colour(rng, dark=True)
    image = Image.new("RGB", (CELL_SIZE, CELL_SIZE), paper)
    draw = ImageDraw.Draw(image)
    if kind == "printed":
        dx, dy = np.clip(rng.normal(0, 3, 2), -8, 8)
        draw.text(
            (32 + dx, 32 + dy),
            str(digit),
            fill=ink,
            font=_font(rng, fonts, int(rng.integers(28, 50))),
            anchor="mm",
        )
    elif kind == "notes":
        small = _font(rng, fonts, int(rng.integers(10, 17)))
        for slot in rng.choice(9, size=int(rng.integers(2, 6)), replace=False):
            x, y = 14 + (slot % 3) * 18, 14 + (slot // 3) * 18
            draw.text((x, y), str(int(slot) + 1), fill=ink, font=small, anchor="mm")
    if rng.random() < 0.2:  # part of a neighbouring digit at the edge
        x = -10 if rng.random() < 0.5 else CELL_SIZE + 10
        neighbour = str(int(rng.integers(1, 10)))
        draw.text((x, 32), neighbour, fill=ink, font=_font(rng, fonts, 40), anchor="mm")
    if kind == "printed":
        image = image.rotate(float(rng.normal(0, 3)), resample=Image.BILINEAR, fillcolor=paper)
        draw = ImageDraw.Draw(image)
    _grid_lines(draw, rng, ink)
    image = image.filter(ImageFilter.GaussianBlur(float(rng.uniform(0, 1.2))))
    noise = rng.normal(0, rng.uniform(0, 8), (CELL_SIZE, CELL_SIZE, 1))
    return np.clip(np.asarray(image, dtype=np.float32) + noise, 0, 255).astype(np.uint8)


def generate(per_class: int, seed: int, fonts: list[Path]) -> list[Sample]:
    """Printed cells for 1–9, empty cells and notes cells, shuffled with the seed."""
    rng = np.random.default_rng(seed)
    plan = [(d, "printed") for d in range(1, 10) for _ in range(per_class)]
    plan += [(0, "none")] * per_class + [(0, "notes")] * (per_class // 2)
    samples = [Sample(render_cell(rng, d, k, fonts), d, kind_index(k)) for d, k in plan]
    order = rng.permutation(len(samples))
    return [samples[i] for i in order]

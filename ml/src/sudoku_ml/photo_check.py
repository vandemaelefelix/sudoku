"""State and rules of the Photos screen: one decision per imported photo, and the cut of the
cells of an accepted photo into cells/unlabeled/ (ADR-009, amendment of 2026-10-12)."""

import csv
import io
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

import cv2
import numpy as np
from PIL import Image

from sudoku_ml.contract import CELL_SIZE
from sudoku_ml.flatten import (
    GRID_CELLS,
    check_corners,
    load_upright,
    slice_cells,
    usable_cells,
    warp_grid,
)
from sudoku_ml.kind_log import append_records, format_time, read_records
from sudoku_ml.manifest import pixel_id
from sudoku_ml.photo_import import PhotoPaths, read_detections, read_photos

MIN_CELLS = 10  # fewer usable cells are not worth the labelling time
DISPLAY_SIZE = 1600
ORIGIN_FIELDS = ["cell", "photo", "row", "col"]


@dataclass(frozen=True)
class PhotoDecision:
    t: str
    session: str
    photo: str  # full photo id
    decision: str  # "accepted", "rejected" or "too-few-cells"
    reason: str
    corners: list[list[float]] | None
    cells: int  # cells cut


class PhotoCheck:
    def __init__(self, paths: PhotoPaths, session: str, now: Callable[[], datetime]):
        self.paths, self.session, self._now = paths, session, now
        self._upright: tuple[str, np.ndarray] | None = None

    def _rows(self) -> dict[str, dict[str, str]]:
        return {r["id"][:16]: r for r in read_photos(self.paths.manifest)}

    def _decided(self) -> set[str]:
        return {d.photo for d in read_records(self.paths.checks, PhotoDecision)}

    def pending(self) -> list[str]:
        detections, decided = read_detections(self.paths.detections), self._decided()
        return [
            stem
            for stem, row in self._rows().items()
            if row["id"] in detections and row["id"] not in decided
        ]

    def photo(self, stem: str) -> dict:
        row = self._rows()[stem]
        found = read_detections(self.paths.detections)[row["id"]]
        return {
            "id": row["id"],
            "stem": stem,
            "width": found["width"],
            "height": found["height"],
            "corners": found["corners"],
            "lines": found["lines"],
            "reason": found["reason"],
            "pending": len(self.pending()),
        }

    def next(self, after: str | None = None) -> dict | None:
        order = self.pending()
        if not order:
            return None
        start = order.index(after) + 1 if after in order else 0
        return self.photo((order[start:] + order[:start])[0])

    def _image(self, stem: str) -> np.ndarray:
        # The Photos screen asks for the same photo several times. Decoding a 12 MP photo is slow.
        if self._upright is None or self._upright[0] != stem:
            self._upright = (stem, load_upright(self.paths.photos / self._rows()[stem]["file"]))
        return self._upright[1]

    def display_jpeg(self, stem: str) -> bytes:
        image = Image.fromarray(self._image(stem))
        image.thumbnail((DISPLAY_SIZE, DISPLAY_SIZE))
        out = io.BytesIO()
        image.save(out, "JPEG", quality=85)
        return out.getvalue()

    def _usable(self, stem: str, corners) -> tuple[list[list[float]], list[bool]]:
        checked = check_corners(corners)
        height, width = self._image(stem).shape[:2]
        # A bow-tie or a thin quad can pass check_corners and still have a singular homography.
        # The server maps only ValueError to a client error.
        try:
            return checked, usable_cells(checked, width, height)
        except (np.linalg.LinAlgError, cv2.error) as error:
            raise ValueError("corners do not give a valid grid") from error

    def usable(self, stem: str, corners) -> int:
        return sum(self._usable(stem, corners)[1])

    def preview_png(self, stem: str, corners) -> bytes:
        checked, usable = self._usable(stem, corners)
        flat = warp_grid(self._image(stem), checked).astype(np.float32)
        for n, ok in enumerate(usable):
            if not ok:
                r, c = divmod(n, GRID_CELLS)
                rows = slice(r * CELL_SIZE, (r + 1) * CELL_SIZE)
                cols = slice(c * CELL_SIZE, (c + 1) * CELL_SIZE)
                flat[rows, cols] = flat[rows, cols] * 0.3 + 128 * 0.7
        for k in range(GRID_CELLS + 1):
            at = min(k * CELL_SIZE, flat.shape[0] - 1)
            thick = 2 if k % 3 == 0 else 1
            flat[max(0, at - thick + 1) : at + 1, :] = (255, 0, 0)
            flat[:, max(0, at - thick + 1) : at + 1] = (255, 0, 0)
        out = io.BytesIO()
        Image.fromarray(flat.astype(np.uint8)).save(out, "PNG")
        return out.getvalue()

    def _open(self, stem: str) -> dict[str, str]:
        row = self._rows()[stem]
        if row["id"] in self._decided():
            raise ValueError(f"{stem}: already checked")
        return row

    def _decide(self, photo_id, decision, reason, corners, cells) -> None:
        line = PhotoDecision(
            format_time(self._now()), self.session, photo_id, decision, reason, corners, cells
        )
        append_records(self.paths.checks, [line])

    def reject(self, stem: str, reason: str) -> None:
        row = self._open(stem)
        self._decide(row["id"], "rejected", reason, None, 0)

    def accept(self, stem: str, corners) -> dict:
        row = self._open(stem)
        checked, usable = self._usable(stem, corners)
        rounded = [[round(x, 1), round(y, 1)] for x, y in checked]
        if sum(usable) < MIN_CELLS:
            self._decide(row["id"], "too-few-cells", f"{sum(usable)} usable cells", rounded, 0)
            return {"decision": "too-few-cells", "cells": 0, "duplicates": 0, "new_cells": []}
        target = self.paths.cells / "unlabeled"
        target.mkdir(parents=True, exist_ok=True)
        existing = {p.stem for p in self.paths.cells.glob("*/*.png")}
        new_cells, origins, duplicates = [], [], 0
        cells = slice_cells(warp_grid(self._image(stem), checked))
        for n, (cell, ok) in enumerate(zip(cells, usable, strict=True)):
            if not ok:
                continue
            tmp = target / "tmp-cut.png"
            Image.fromarray(cell).save(tmp)
            cell_id = pixel_id(tmp)
            if cell_id[:16] in existing:
                tmp.unlink()
                duplicates += 1
                continue
            tmp.rename(target / f"{cell_id[:16]}.png")
            existing.add(cell_id[:16])
            new_cells.append(cell_id)
            r, c = divmod(n, GRID_CELLS)
            origins.append({"cell": cell_id, "photo": row["id"], "row": r, "col": c})
        new_file = not self.paths.origins.exists()
        self.paths.origins.parent.mkdir(parents=True, exist_ok=True)
        with self.paths.origins.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=ORIGIN_FIELDS)
            if new_file:
                writer.writeheader()
            writer.writerows(origins)
        self._decide(row["id"], "accepted", "", rounded, len(new_cells))
        return {
            "decision": "accepted",
            "cells": len(new_cells),
            "duplicates": duplicates,
            "new_cells": new_cells,
        }

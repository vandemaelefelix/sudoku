"""The decision on an imported sudoku photo, and the cut of the cells of an accepted sudoku photo
into cells/unlabeled/ (ADR-018). The Outlines step of the labelling app calls it through the label
store. The decision is the `status` column of sudoku-photos.csv. The cut adds a `source` line to
the journal per new cell."""

import sys
from collections.abc import Callable
from dataclasses import replace
from datetime import datetime

import cv2
import numpy as np

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.flatten import (
    GRID_CELLS,
    check_corners,
    load_upright,
    slice_cells,
    usable_cells,
    warp_grid,
)
from sudoku_ml.journal import (
    Screen,
    append_records,
    format_time,
)
from sudoku_ml.label_lines import Action
from sudoku_ml.photo_import import read_detections, write_detections
from sudoku_ml.tables import (
    PhotoRow,
    format_corners,
    pixel_id_of,
    read_photos,
    stem_of,
    write_cell_image,
    write_photos,
)

MIN_CELLS = 10  # fewer usable cells are not worth the labelling time


def clear_temp(paths: DataPaths) -> int:
    """Delete the cells that a stopped cut left behind. `unlabeled/tmp-cut.png` is the name of
    the earlier cut. Returns the number of files deleted."""
    leftovers = [*paths.tmp.glob("*"), paths.cells / "unlabeled" / "tmp-cut.png"]
    found = [p for p in leftovers if p.is_file()]
    for path in found:
        path.unlink()
    if found:
        print(f"Deleted {len(found)} leftover files of a stopped cut.", file=sys.stderr)
    return len(found)


class PhotoCheck:
    def __init__(self, paths: DataPaths, session: str, now: Callable[[], datetime]):
        self.paths, self.session, self._now = paths, session, now
        self._upright: tuple[str, np.ndarray] | None = None
        self._cuts = 0

    def _rows(self) -> dict[str, PhotoRow]:
        return {stem_of(r.photo_id): r for r in read_photos(self.paths.photos_csv)}

    def pending(self) -> list[str]:
        """The stems of the imported photos that wait for a decision and still have a file."""
        return [
            stem
            for stem, row in self._rows().items()
            if row.status == "pending" and (self.paths.photos / row.file).exists()
        ]

    def _image(self, stem: str) -> np.ndarray:
        # An accept asks for the photo twice. Decoding a 12 MP photo is slow.
        if self._upright is None or self._upright[0] != stem:
            self._upright = (stem, load_upright(self.paths.photos / self._rows()[stem].file))
        return self._upright[1]

    def _usable(self, stem: str, corners) -> tuple[list[list[float]], list[bool]]:
        checked = check_corners(corners)
        height, width = self._image(stem).shape[:2]
        # Defensive guard: the server maps only ValueError to a client error (400), so an error
        # from cv2 or numpy must not reach it as another type.
        try:
            return checked, usable_cells(checked, width, height)
        except (np.linalg.LinAlgError, cv2.error) as error:
            raise ValueError("corners do not give a valid grid") from error

    def usable(self, stem: str, corners) -> int:
        return sum(self._usable(stem, corners)[1])

    def _open(self, stem: str) -> PhotoRow:
        row = self._rows()[stem]
        if row.status != "pending":
            raise ValueError(f"{stem}: already checked")
        return row

    def _decide(self, photo_id: str, status: str, corners: str) -> None:
        rows = [
            replace(row, status=status, corners=corners) if row.photo_id == photo_id else row
            for row in read_photos(self.paths.photos_csv)
        ]
        write_photos(self.paths.photos_csv, rows)
        detections = read_detections(self.paths.detections)
        if detections.pop(photo_id, None) is not None:
            write_detections(self.paths.detections, detections)

    def reject(self, stem: str) -> None:
        row = self._open(stem)
        self._decide(row.photo_id, "rejected", "")

    def accept(self, stem: str, corners) -> dict:
        row = self._open(stem)
        checked, usable = self._usable(stem, corners)
        if sum(usable) < MIN_CELLS:
            self._decide(row.photo_id, "too-few-cells", "")
            return {"decision": "too-few-cells", "cells": 0, "duplicates": 0, "new_cells": []}
        target = self.paths.cells / "unlabeled"
        target.mkdir(parents=True, exist_ok=True)
        existing = {p.stem for p in self.paths.cells.glob("*/*.png")}
        new_cells, links, duplicates = [], [], 0
        self._cuts += 1
        action = Action(format_time(self._now()), self.session, f"{self.session}-cut-{self._cuts}")
        cells = slice_cells(warp_grid(self._image(stem), checked))
        for n, (cell, ok) in enumerate(zip(cells, usable, strict=True)):
            if not ok:
                continue
            cell_id = pixel_id_of(cell)
            if stem_of(cell_id) in existing:
                duplicates += 1
                continue
            write_cell_image(cell, target, stem_of(cell_id), self.paths.tmp)
            existing.add(stem_of(cell_id))
            new_cells.append(cell_id)
            source = (row.photo_id, *divmod(n, GRID_CELLS))
            links.append(action.source(cell_id, source, Screen.PHOTOS))
        # The links before the status: a stop between the two leaves the sudoku photo pending,
        # and its next cut skips the cells that exist.
        if links:
            append_records(self.paths.journal, links)
        rounded = [[round(x, 1), round(y, 1)] for x, y in checked]
        self._decide(row.photo_id, "accepted", format_corners(rounded))
        return {
            "decision": "accepted",
            "cells": len(new_cells),
            "duplicates": duplicates,
            "new_cells": new_cells,
        }

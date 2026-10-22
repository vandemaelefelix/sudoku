"""State and rules of the Photos screen: one decision per imported sudoku photo, and the cut of
the cells of an accepted sudoku photo into cells/unlabeled/ (ADR-018). The decision is the
`status` column of sudoku-photos.csv. The cut adds a `source` line to the journal per new cell."""

import io
import sys
import uuid
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import replace
from datetime import datetime

import cv2
import numpy as np
from PIL import Image

from sudoku_ml.contract import CELL_SIZE
from sudoku_ml.data_check import link_line
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
    Line,
    Source,
    append_records,
    current_sources,
    format_source,
    format_time,
    read_journal,
)
from sudoku_ml.manifest import base_sources
from sudoku_ml.photo_import import detect_outline, read_detections, write_detections
from sudoku_ml.tables import (
    PhotoRow,
    format_corners,
    parse_corners,
    pixel_id,
    read_cells,
    read_photos,
    stem_of,
    write_photos,
)

MIN_CELLS = 10  # fewer usable cells are not worth the labelling time
DISPLAY_SIZE = 1600
FLAT_CACHE = 16  # flattened grids: the person moves across the cells of several photos


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
        self._sources: tuple[tuple[int, int], dict[str, Source]] | None = None
        self._flats: OrderedDict[str, np.ndarray] = OrderedDict()
        self._cuts = 0

    def _rows(self) -> dict[str, PhotoRow]:
        return {stem_of(r.photo_id): r for r in read_photos(self.paths.photos_csv)}

    def known(self, stem: str) -> bool:
        return stem in self._rows()

    def total(self) -> int:
        return len(self._rows())

    def pending(self) -> list[str]:
        # A missing file would fail the Photos screen. The data check reports it. A `legacy`
        # sudoku photo was cut before checks existed: it is never offered.
        return [
            stem
            for stem, row in self._rows().items()
            if row.status == "pending" and (self.paths.photos / row.file).exists()
        ]

    def _outline(self, stem: str, photo_id: str) -> dict:
        # The file holds pending photos only. A missing entry is computed again and stored.
        detections = read_detections(self.paths.detections)
        if photo_id not in detections:
            detections[photo_id] = detect_outline(self._image(stem))
            write_detections(self.paths.detections, detections)
        return detections[photo_id]

    def photo(self, stem: str) -> dict:
        row = self._rows()[stem]
        found = self._outline(stem, row.photo_id)
        return {
            "id": row.photo_id,
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
            self._upright = (stem, load_upright(self.paths.photos / self._rows()[stem].file))
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
        # Defensive guard: the server maps only ValueError to a client error (400), so an error
        # from cv2 or numpy must not reach it as another type.
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

    def _source_of(self) -> dict[str, Source]:
        """Cell stem → source: cells.csv with the journal on top. A cut appends to the journal
        and Finish rewrites cells.csv, so a change of either means a reload."""
        journal, table = self.paths.journal, self.paths.cells_csv
        stamp = (
            journal.stat().st_size if journal.exists() else 0,
            table.stat().st_mtime_ns if table.exists() else 0,
        )
        if self._sources is None or self._sources[0] != stamp:
            found = current_sources(read_journal(journal), base_sources(read_cells(table)))
            self._sources = (stamp, {stem_of(cell): source for cell, source in found.items()})
        return self._sources[1]

    def link_line(self, cells: list[str]) -> str:
        """How many of `cells` (full ids) have a source. Cheap, for the Progress page."""
        sources = self._source_of()
        linked = sum(stem_of(cell) in sources for cell in cells)
        return link_line(linked, len(cells))

    def _accepted(self, photo_id: str) -> PhotoRow | None:
        row = self._rows().get(stem_of(photo_id))
        if row is None or row.photo_id != photo_id or row.status != "accepted":
            return None
        return row

    def source(self, cell_stem: str) -> dict | None:
        """The sudoku photo, row and column (0-based) that a cell was cut from. None if unknown
        or if the sudoku photo has no accepted corners."""
        found = self._source_of().get(cell_stem)
        if found is None:
            return None
        photo_id, row, col = found
        accepted = self._accepted(photo_id)
        if accepted is None:
            return None
        return {
            "photo": stem_of(photo_id),
            "row": row,
            "col": col,
            "source": accepted.source,
            "licence": accepted.licence,
        }

    def source_png(self, cell_stem: str) -> bytes | None:
        """The flattened grid of the cell's sudoku photo with the cell outlined. None if
        unknown."""
        found = self.source(cell_stem)
        if found is None:
            return None
        stem = found["photo"]
        if stem not in self._flats:
            row = self._rows()[stem]
            image = load_upright(self.paths.photos / row.file)
            self._flats[stem] = warp_grid(image, check_corners(parse_corners(row.corners)))
            while len(self._flats) > FLAT_CACHE:
                self._flats.popitem(last=False)
        flat = self._flats[stem].copy()
        x, y = found["col"] * CELL_SIZE, found["row"] * CELL_SIZE
        far = (x + CELL_SIZE - 1, y + CELL_SIZE - 1)
        cv2.rectangle(flat, (x, y), far, (0, 0, 0), 5)
        cv2.rectangle(flat, (x, y), far, (255, 215, 0), 3)
        out = io.BytesIO()
        Image.fromarray(flat).save(out, "PNG")
        return out.getvalue()

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
        # A cut outside cells/ that is renamed in: a stop never leaves a misnamed cell in a
        # cell folder (ADR-009).
        self.paths.tmp.mkdir(parents=True, exist_ok=True)
        existing = {p.stem for p in self.paths.cells.glob("*/*.png")}
        new_cells, links, duplicates = [], [], 0
        self._cuts += 1
        t, action = format_time(self._now()), f"{self.session}-cut-{self._cuts}"
        cells = slice_cells(warp_grid(self._image(stem), checked))
        for n, (cell, ok) in enumerate(zip(cells, usable, strict=True)):
            if not ok:
                continue
            tmp = self.paths.tmp / f"{uuid.uuid4().hex}.png"
            Image.fromarray(cell).save(tmp)
            cell_id = pixel_id(tmp)
            if stem_of(cell_id) in existing:
                tmp.unlink()
                duplicates += 1
                continue
            tmp.replace(target / f"{stem_of(cell_id)}.png")
            existing.add(stem_of(cell_id))
            new_cells.append(cell_id)
            source = format_source((row.photo_id, *divmod(n, GRID_CELLS)))
            links.append(Line(t, self.session, action, cell_id, "source", None, source, "photos"))
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

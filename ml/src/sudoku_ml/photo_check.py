"""State and rules of the Photos screen: one decision per imported photo, and the cut of the
cells of an accepted photo into cells/unlabeled/ (ADR-009, amendment of 2026-10-12)."""

import csv
import io
import sys
import uuid
from collections import OrderedDict
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
from sudoku_ml.photo_import import (
    PhotoPaths,
    detect_outline,
    read_detections,
    read_photos,
    write_detections,
)

MIN_CELLS = 10  # fewer usable cells are not worth the labelling time
DISPLAY_SIZE = 1600
ORIGIN_FIELDS = ["cell", "photo", "row", "col"]
LINK_LINE = "linked {linked} of {total} cells; the others come from before the link existed"
FLAT_CACHE = 16  # flattened grids: the person moves across the cells of several photos


@dataclass(frozen=True)
class PhotoDecision:
    t: str
    session: str
    photo: str  # full photo id
    decision: str  # "accepted", "rejected" or "too-few-cells"
    reason: str
    corners: list[list[float]] | None
    cells: int  # cells cut


def clear_temp(paths: PhotoPaths) -> int:
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
    def __init__(self, paths: PhotoPaths, session: str, now: Callable[[], datetime]):
        self.paths, self.session, self._now = paths, session, now
        self._upright: tuple[str, np.ndarray] | None = None
        self._origins: tuple[tuple[int, int], dict[str, tuple[str, int, int]]] | None = None
        self._flats: OrderedDict[str, np.ndarray] = OrderedDict()

    def _rows(self) -> dict[str, dict[str, str]]:
        return {r["id"][:16]: r for r in read_photos(self.paths.manifest)}

    def _decided(self) -> set[str]:
        return {d.photo for d in read_records(self.paths.checks, PhotoDecision)}

    def total(self) -> int:
        return len(self._rows())

    def pending(self) -> list[str]:
        decided = self._decided()
        return [stem for stem, row in self._rows().items() if row["id"] not in decided]

    def _outline(self, stem: str, photo_id: str) -> dict:
        # The file holds pending photos only. A missing entry is computed again and stored.
        detections = read_detections(self.paths.detections)
        if photo_id not in detections:
            detections[photo_id] = detect_outline(self._image(stem))
            write_detections(self.paths.detections, detections)
        return detections[photo_id]

    def photo(self, stem: str) -> dict:
        row = self._rows()[stem]
        found = self._outline(stem, row["id"])
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

    def _origin_rows(self) -> dict[str, tuple[str, int, int]]:
        # Accept appends to the file in the same session, so a new mtime means a reload.
        if not self.paths.origins.exists():
            return {}
        info = self.paths.origins.stat()
        mtime = (info.st_mtime_ns, info.st_size)
        if self._origins is None or self._origins[0] != mtime:
            with self.paths.origins.open(newline="", encoding="utf-8") as handle:
                rows = {
                    r["cell"][:16]: (r["photo"], int(r["row"]), int(r["col"]))
                    for r in csv.DictReader(handle)
                }
            self._origins = (mtime, rows)
        return self._origins[1]

    def link_line(self, cells: list[str]) -> str:
        """How many of `cells` (full ids) have an origin row. Cheap, for the Progress page."""
        rows = self._origin_rows()
        linked = sum(cell[:16] in rows for cell in cells)
        return LINK_LINE.format(linked=linked, total=len(cells))

    def _accepted_corners(self, photo_id: str) -> list[list[float]] | None:
        found = None
        for d in read_records(self.paths.checks, PhotoDecision):
            if d.photo == photo_id and d.decision == "accepted":
                found = d.corners
        return found

    def origin(self, cell_stem: str) -> dict | None:
        """The photo, row and column (0-based) that a cell was cut from. None if unknown."""
        found = self._origin_rows().get(cell_stem)
        if found is None or self._accepted_corners(found[0]) is None:
            return None
        photo_id, row, col = found
        manifest = next((r for r in self._rows().values() if r["id"] == photo_id), None)
        if manifest is None:
            return None
        return {
            "photo": photo_id[:16],
            "row": row,
            "col": col,
            "origin": manifest["origin"],
            "licence": manifest["licence"],
        }

    def origin_png(self, cell_stem: str) -> bytes | None:
        """The flattened grid of the cell's photo with the cell outlined. None if unknown."""
        found = self.origin(cell_stem)
        if found is None:
            return None
        stem = found["photo"]
        if stem not in self._flats:
            row = self._rows()[stem]
            corners = self._accepted_corners(row["id"])
            image = load_upright(self.paths.photos / row["file"])
            self._flats[stem] = warp_grid(image, check_corners(corners))
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
        detections = read_detections(self.paths.detections)
        if detections.pop(photo_id, None) is not None:
            write_detections(self.paths.detections, detections)

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
        # A cut outside cells/ that is renamed in: a stop never leaves a misnamed cell in a
        # cell folder (ADR-009).
        self.paths.tmp.mkdir(parents=True, exist_ok=True)
        existing = {p.stem for p in self.paths.cells.glob("*/*.png")}
        new_cells, origins, duplicates = [], [], 0
        cells = slice_cells(warp_grid(self._image(stem), checked))
        for n, (cell, ok) in enumerate(zip(cells, usable, strict=True)):
            if not ok:
                continue
            tmp = self.paths.tmp / f"{uuid.uuid4().hex}.png"
            Image.fromarray(cell).save(tmp)
            cell_id = pixel_id(tmp)
            if cell_id[:16] in existing:
                tmp.unlink()
                duplicates += 1
                continue
            tmp.replace(target / f"{cell_id[:16]}.png")
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

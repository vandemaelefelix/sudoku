"""The scans and imported photos of the Outlines step: the state of each outline, the cut of the
cells, and the decisions to approve, reject or fix an outline (ADR-018, ADR-034)."""

from collections import OrderedDict
from dataclasses import dataclass

import numpy as np

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.flatten import GRID_CELLS, check_corners, load_upright
from sudoku_ml.journal import Line, Screen, current_outlines, format_outline, parse_outline
from sudoku_ml.label_lines import Action
from sudoku_ml.label_state import LabelState
from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.photo_import import detect_outline, read_detections, write_detections
from sudoku_ml.scan_outlines import cut as scan_cut
from sudoku_ml.scan_outlines import outline_fit, read_scores, write_scores
from sudoku_ml.scan_render import grid_png, outline_jpeg
from sudoku_ml.tables import (
    APP_SCAN,
    PhotoRow,
    format_corners,
    parse_corners,
    read_photos,
    stem_of,
    write_cell_image,
)

OUTLINE_SCREEN_SIZE = 48
THUMBNAIL_SIZE = 320  # long side in pixels
PHOTO_CACHE = 8  # decoded scan photos


@dataclass(frozen=True)
class ScanState:
    row: PhotoRow
    status: str  # "unchecked", "accepted" or "rejected"
    corners: str  # format_corners text. Empty for a rejected scan


def source_of(row: PhotoRow) -> str:
    """`app` for an uploaded scan, `photo` for an imported photo."""
    return "app" if row.source == APP_SCAN else "photo"


class ScanBook:
    def __init__(self, state: LabelState, check: PhotoCheck):
        self._state, self._check = state, check
        self._photos: OrderedDict[str, np.ndarray] = OrderedDict()

    def states(self) -> list[ScanState]:
        """Each scan in the order of sudoku-photos.csv, which is the pull and import order.

        An uploaded scan takes its outline from sudoku-photos.csv with the journal on top. An
        imported photo takes its status from sudoku-photos.csv only: `pending` is an open outline
        without corners (see corners). A `legacy` photo and a missing file are never offered."""
        self._state.refresh()
        paths = self._state.paths
        rows = read_photos(paths.photos_csv)
        now = current_outlines(
            self._state.lines,
            {r.photo_id: format_outline(r.status, r.corners) for r in rows if r.source == APP_SCAN},
        )
        states = []
        for row in rows:
            if row.source == APP_SCAN:
                states.append(ScanState(row, *parse_outline(now[row.photo_id])))
            elif row.status == "pending" and (paths.photos / row.file).exists():
                states.append(ScanState(row, "unchecked", ""))
            elif row.status == "accepted":
                states.append(ScanState(row, "accepted", row.corners))
            elif row.status in ("rejected", "too-few-cells"):
                states.append(ScanState(row, "rejected", ""))
        return states

    def state(self, photo: str) -> ScanState:
        for state in self.states():
            if stem_of(state.row.photo_id) == photo:
                return state
        raise ValueError(f"{photo}: not a scan or photo to check")

    def _unchecked(self, photo: str) -> ScanState:
        state = self.state(photo)
        if state.status != "unchecked":
            raise ValueError(f"{photo}: the outline is already checked ({state.status})")
        return state

    def upright(self, row: PhotoRow) -> np.ndarray:
        # The Outlines step asks for the same few photos many times. A decode is slow.
        if row.photo_id not in self._photos:
            self._photos[row.photo_id] = load_upright(self._state.paths.photos / row.file)
            while len(self._photos) > PHOTO_CACHE:
                self._photos.popitem(last=False)
        return self._photos[row.photo_id]

    def corners(self, state: ScanState) -> str:
        """The outline to show: the stored corners, or the detected grid of a pending imported
        photo. Empty when the detection found no grid. The detection is stored in detections.json
        (ADR-018)."""
        if state.corners or state.status != "unchecked" or state.row.source == APP_SCAN:
            return state.corners
        path = self._state.paths.detections
        detections = read_detections(path)
        if state.row.photo_id not in detections:
            detections[state.row.photo_id] = detect_outline(self.upright(state.row))
            write_detections(path, detections)
        found = detections[state.row.photo_id]["corners"]
        return format_corners(found) if found else ""

    def _fits(self, states: list[ScanState]) -> dict[str, float]:
        """Photo id → outline_fit, or -1 without an outline. Computes and stores each score that
        the file lacks for the current corners."""
        path = self._state.paths.outline_scores
        scores = read_scores(path)
        corners = {s.row.photo_id: self.corners(s) for s in states}
        missing = [
            s
            for s in states
            if scores.get(s.row.photo_id, {}).get("corners") != corners[s.row.photo_id]
        ]
        for state in missing:
            text = corners[state.row.photo_id]
            fit = outline_fit(self.upright(state.row), text) if text else -1.0
            scores[state.row.photo_id] = {"corners": text, "fit": round(fit, 4)}
        if missing:
            write_scores(path, scores)
        return {s.row.photo_id: scores[s.row.photo_id]["fit"] for s in states}

    def outline_screen(self, page: int = 0) -> dict:
        """One page of the scans and photos with an unchecked outline, the lowest fit first."""
        states = [s for s in self.states() if s.status == "unchecked"]
        fits = self._fits(states)
        order = sorted(range(len(states)), key=lambda i: (fits[states[i].row.photo_id], i))
        pages = max(1, -(-len(order) // OUTLINE_SCREEN_SIZE))
        page = min(page, pages - 1)
        chunk = order[page * OUTLINE_SCREEN_SIZE : (page + 1) * OUTLINE_SCREEN_SIZE]
        scans = []
        for i in chunk:
            corners = self.corners(states[i])
            scans.append(
                {
                    "photo": stem_of(states[i].row.photo_id),
                    "source": source_of(states[i].row),
                    "fit": fits[states[i].row.photo_id],
                    "corners": parse_corners(corners) if corners else None,
                }
            )
        return {"scans": scans, "open": len(states), "page": page, "pages": pages}

    def outline(self, photo: str) -> dict:
        """One scan for the large view. Corners, width and height are in upright photo pixels."""
        state = self.state(photo)
        height, width = self.upright(state.row).shape[:2]
        corners = self.corners(state)
        return {
            "photo": photo,
            "source": source_of(state.row),
            "status": state.status,
            "width": width,
            "height": height,
            "corners": parse_corners(corners) if corners else None,
        }

    def photo_jpeg(self, photo: str, size: int = THUMBNAIL_SIZE, outline: bool = True) -> bytes:
        """The scan at `size` pixels on the long side. With `outline`, its current outline in
        green."""
        state = self.state(photo)
        corners = self.corners(state) if outline else ""
        return outline_jpeg(self.upright(state.row), corners, size)

    def flat_png(self, photo: str, corners=None) -> bytes:
        """The grid that `corners` cut from the scan, with the cell lines drawn: the preview of a
        fix. Without `corners`: the grid of the current outline, without lines, square, with
        place (row, col) at the same 1/9 of each side."""
        state = self.state(photo)
        if corners is None and not state.corners:
            raise ValueError(f"{photo}: no outline yet")
        chosen = parse_corners(state.corners) if corners is None else corners
        return grid_png(self.upright(state.row), chosen, lines=corners is not None)

    def own_cells(self, photo_id: str) -> dict[int, str]:
        """Position 0-80 → the cell of this scan outside discarded/. A cell of another scan
        with the same pixels belongs to that scan."""
        sources = self._state.sources()
        folder = self._state.folder
        return {
            row * GRID_CELLS + col: cell
            for cell, (source, row, col) in sources.items()
            if source == photo_id and folder.get(cell, "discarded") != "discarded"
        }

    def own_places(self) -> dict[str, dict[int, str]]:
        """Photo id → place (0-80) → the first cell of the sources that sits in a folder."""
        found: dict[str, dict[int, str]] = {}
        for cell, (photo, row, col) in self._state.sources().items():
            if cell in self._state.folder:
                found.setdefault(photo, {}).setdefault(row * GRID_CELLS + col, cell)
        return found

    def places(
        self,
        state: ScanState,
        cut: list[str | None] | None = None,
        own: dict[int, str] | None = None,
    ) -> list[str | None]:
        """The cell at each of the 81 places of the scan, or None. The cut of the current corners
        finds a cell of another scan with the same pixels. A place where the cut finds no cell
        takes the own cell of that place from the sources: an imported photo was cut from
        corners before their rounding. `cut` and `own` skip the work when the caller has them."""
        if not state.corners:
            return []
        if cut is None:
            cut = [cell for _, cell in scan_cut(self.upright(state.row), state.corners)]
        if own is None:
            own = self.own_places().get(state.row.photo_id, {})
        return [cell if cell in self._state.folder else own.get(n) for n, cell in enumerate(cut)]

    def _outline_line(self, state: ScanState, status: str, corners: str, action: Action) -> Line:
        old = format_outline(state.status, state.corners)
        return action.outline(state.row.photo_id, old, format_outline(status, corners))

    def _discard(self, cells, kinds: dict[str, str | None], action: Action) -> list[Line]:
        lines = []
        for cell in cells:
            lines += action.digit_and_kind(
                cell,
                self._state.folder[cell],
                "discarded",
                kinds.get(cell),
                kinds.get(cell),
                Screen.OUTLINES,
            )
        return lines

    def _cut_photo(self, state: ScanState, corners) -> dict:
        """Accept an imported photo: PhotoCheck cuts its cells into unlabeled/. This writes
        sudoku-photos.csv at once, so undo cannot reverse it (ADR-018)."""
        result = self._check.accept(stem_of(state.row.photo_id), corners)
        self._state.register(result["new_cells"])
        self._photos.pop(state.row.photo_id, None)
        return result

    def approve_outlines(self, photos: list[str]) -> int:
        """Approve the outline of each scan. The uploaded scans are one action. An imported
        photo needs a detected outline: its cells are cut. Checks all scans first."""
        states = [self._unchecked(photo) for photo in photos]
        corners = {s.row.photo_id: self.corners(s) for s in states}
        blind = [s for s in states if not corners[s.row.photo_id]]
        if blind:
            raise ValueError(f"{stem_of(blind[0].row.photo_id)}: no outline found. Set its corners")
        for state in states:
            # The cut of a photo can still refuse its corners. Check before any line is written.
            if state.row.source != APP_SCAN:
                stem = stem_of(state.row.photo_id)
                try:
                    self._check.usable(stem, parse_corners(corners[state.row.photo_id]))
                except ValueError as error:
                    raise ValueError(f"{stem}: {error}. Open it and set its corners") from error
        action = self._state.action()
        lines = [
            self._outline_line(s, "accepted", s.corners, action)
            for s in states
            if s.row.source == APP_SCAN
        ]
        self._state.write(lines)
        for state in states:
            if state.row.source != APP_SCAN:
                self._cut_photo(state, parse_corners(corners[state.row.photo_id]))
        return len(states)

    def reject_outline(self, photo: str) -> int:
        """Reject the scan. An uploaded scan is one action: its cells move to discarded/, so
        training leaves them out, and Finish writes `rejected`. An imported photo is rejected in
        sudoku-photos.csv at once, without cells."""
        state = self._unchecked(photo)
        if state.row.source != APP_SCAN:
            self._check.reject(photo)
            return 1
        action = self._state.action()
        own = self.own_cells(state.row.photo_id)
        lines = [self._outline_line(state, "rejected", "", action)]
        lines += self._discard(own.values(), self._state.kinds(), action)
        self._state.apply_digits(lines)
        self._state.write(lines)
        return len(lines)

    def fix_outline(self, photo: str, corners) -> dict:
        """Cut the scan again from new corners, and approve them. An imported photo gets its
        first cut (see _cut_photo).

        For an uploaded scan this is one action. A new cell takes the digit and kind of the old
        cell at its place: the label from the app. Its file lands in discarded/ first and a digit
        line moves it, so an undo puts it back there. A cell that exists already keeps its file
        and its label, except a cell of this scan in discarded/ from an undone cut: it comes back
        like a new cell. The old cells of the scan that the new cut lacks move to discarded/. A
        place without an old label gets no cell, as in `just pull-scans`."""
        state = self._unchecked(photo)
        if state.row.source != APP_SCAN:
            result = self._cut_photo(state, corners)
            return {"cells": result["cells"], "kept": result["duplicates"], "discarded": 0}
        text = format_corners(check_corners(corners))
        rgb = self.upright(state.row)
        old_cut = [cell for _, cell in scan_cut(rgb, state.corners)]
        new_cut = scan_cut(rgb, text)
        kinds, label_sources = self._state.kinds(), self._state.label_sources()
        action = self._state.action()
        lines = [self._outline_line(state, "accepted", text, action)]
        new_cells, kept = [], 0
        paths = self._state.paths
        target = paths.cells / "discarded"
        sources = self._state.sources()
        folder = self._state.folder
        for position, (image, cell) in enumerate(new_cut):
            where = folder.get(cell)
            own_discarded = (
                where == "discarded" and sources.get(cell, ("",))[0] == state.row.photo_id
            )
            if where is not None and not own_discarded:
                kept += 1
                continue
            label = folder.get(old_cut[position])
            if label not in DIGIT_CLASSES:
                continue
            if where is None:
                write_cell_image(image, target, stem_of(cell), paths.tmp)
                self._state.register([cell], "discarded")
                source = (state.row.photo_id, *divmod(position, GRID_CELLS))
                lines.append(action.source(cell, source, Screen.OUTLINES))
                provenance = label_sources.get(old_cut[position], "")
                if provenance:
                    lines.append(action.label_source(cell, provenance, Screen.OUTLINES))
            lines += action.digit_and_kind(
                cell, "discarded", label, None, kinds.get(old_cut[position]), Screen.OUTLINES
            )
            new_cells.append(cell)
        wanted = {cell for _, cell in new_cut}
        gone = [c for c in self.own_cells(state.row.photo_id).values() if c not in wanted]
        lines += self._discard(gone, kinds, action)
        self._state.apply_digits(lines)
        self._state.write(lines)
        return {"cells": len(new_cells), "kept": kept, "discarded": len(gone)}

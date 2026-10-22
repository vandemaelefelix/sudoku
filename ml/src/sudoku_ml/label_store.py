"""State and rules of the labelling app. label_server.py only translates HTTP to these calls."""

import csv
import io
import json
import tomllib
from collections import Counter, OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.dataset import dhash, read_real_cells, split_cells
from sudoku_ml.doubt import (
    DIGIT_THRESHOLD,
    KIND_THRESHOLD,
    clamp_doubt,
    digit_doubt_raw,
    is_sure_digit,
    is_sure_kind,
    kind_doubt_raw,
    labels_key,
    scan_signals,
)
from sudoku_ml.flatten import GRID_CELLS, check_corners, load_upright, warp_grid
from sudoku_ml.journal import (
    KINDS,
    Line,
    Source,
    append_records,
    current_kinds,
    current_label_sources,
    current_outlines,
    current_sources,
    format_outline,
    format_source,
    format_time,
    parse_outline,
    read_journal,
    read_records,
    rollback_lines,
    undo_lines,
    undone_actions,
)
from sudoku_ml.kind_check import CheckLine, summary
from sudoku_ml.kind_review import check_items, model_items, near_duplicate_items, open_items
from sudoku_ml.manifest import (
    base_kinds,
    base_sources,
    check_image_store,
    confirmed_cells,
    repair_lines,
    warn_unreadable,
)
from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.photo_import import detect_outline, read_detections, write_detections
from sudoku_ml.relabel import move_cells
from sudoku_ml.scan_outlines import cut as scan_cut
from sudoku_ml.scan_outlines import outline_fit, read_scores, write_scores
from sudoku_ml.status import read_last_finish
from sudoku_ml.tables import (
    APP_SCAN,
    DIGIT_FOLDERS,
    NO_KIND_FOLDERS,
    PhotoRow,
    format_corners,
    parse_corners,
    pixel_id,
    read_cells,
    read_photos,
    stem_of,
    write_atomic,
)

SCREEN_SIZE = 50
CHECK_SIZE = 240  # a full screen of 64 px cells
ASSIGNABLE = (*DIGIT_CLASSES, "discarded")
DIGIT_TABS = (*DIGIT_CLASSES, "unknown")
# The screens whose digit line a person made, and whose kind line a person made.
DIGIT_SCREENS = ("digits", "scans")
KIND_SCREENS = ("kinds", "scans", "groups", "review")
NEAR_DUPLICATE_BITS = 4  # the same limit as group_ids, which keeps the split leak-free
OUTLINE_SCREEN_SIZE = 48
THUMBNAIL_SIZE = 320  # long side in pixels
PHOTO_CACHE = 8  # decoded scan photos


@dataclass(frozen=True)
class ScanState:
    row: PhotoRow
    status: str  # "unchecked", "accepted" or "rejected"
    corners: str  # format_corners text. Empty for a rejected scan


def _source(row: PhotoRow) -> str:
    """`app` for an uploaded scan, `photo` for an imported photo."""
    return "app" if row.source == APP_SCAN else "photo"


class LabelStore:
    def __init__(self, paths: DataPaths, now: Callable[[], datetime] = lambda: datetime.now(UTC)):
        self.paths, self._now = paths, now
        self.session = now().strftime("%Y%m%d-%H%M%S")
        self._actions = 0
        self._registered: dict[str, str] = {}
        self._load()
        self._dups: tuple[list[tuple[str, str]], set[str]] | None = None
        self._suspects_ok = True
        self._pre_cache: tuple[tuple[int, int], str | None, dict[str, dict]] | None = None
        self._sudoku_cache: dict[str, dict] | None = None
        self._photos: OrderedDict[str, np.ndarray] = OrderedDict()
        self.check = PhotoCheck(paths, self.session, now)

    def _stamp(self) -> tuple[int, int]:
        journal, table = self.paths.journal, self.paths.cells_csv
        return (
            journal.stat().st_size if journal.exists() else 0,
            table.stat().st_mtime_ns if table.exists() else 0,
        )

    def _load(self) -> None:
        """Raises ValueError when cells.csv does not parse, or when the image store is missing
        or wrong: cells.csv holds the finished kinds and sources, so the store refuses to start
        without it (ADR-018)."""
        table = read_cells(self.paths.cells_csv)
        check_image_store(self.paths, table)
        self._base_kinds, self._base_sources = base_kinds(table), base_sources(table)
        self._base_label_sources = {c: r.label_source for c, r in table.items()}
        listed = {stem_of(cell): cell for cell in table}
        self._stem_ids = {**listed, **self._registered}
        self.folder: dict[str, str] = {}
        for path in self.paths.cells.glob("*/*.png"):
            if path.stem not in self._stem_ids:
                # A stop before the manifest rewrite leaves cells that cells.csv does not list.
                cell_id = pixel_id(path)
                if stem_of(cell_id) != path.stem:
                    raise ValueError(f"{path} is not named after its pixels ({stem_of(cell_id)})")
                self._stem_ids[path.stem] = cell_id
            self.folder[self._stem_ids[path.stem]] = path.parent.name
        self.lines = read_journal(self.paths.journal)
        self.checks = read_records(self.paths.kind_checks, CheckLine)
        self._seen = self._stamp()

    def repair(self) -> int:
        """Drop the kind of each cell in empty/, unlabeled/ or discarded/ (see repair_lines)."""
        self._refresh()
        lines = repair_lines(self.folder, self.kinds(), self._t(), f"{self.session}-repair")
        self._write(lines)
        return len(lines)

    def _refresh(self) -> None:
        # `just label-rollback` in another terminal appends to the journal and moves files. A cut
        # appends source lines. Finish deletes the journal and rewrites cells.csv.
        if self._stamp() != self._seen:
            self._load()

    def now(self) -> datetime:
        return self._now()

    def _t(self) -> str:
        return format_time(self._now())

    def _action(self) -> str:
        self._actions += 1
        return f"{self.session}-{self._actions}"

    def _write(self, lines: list[Line]) -> None:
        if not lines:
            return
        append_records(self.paths.journal, lines)
        self.lines.extend(lines)
        self._seen = self._stamp()

    def _apply_digits(self, lines: list[Line]) -> None:
        # One move_cells call: it reads every cell folder once, and 16k cells make that slow.
        wanted = {
            stem_of(line.cell): line.new
            for line in lines
            if line.field == "digit" and line.old != line.new
        }
        if wanted:
            move_cells(self.paths.cells, wanted)
        for line in lines:
            if line.field == "digit" and line.old != line.new:
                self.folder[line.cell] = line.new

    def label_sources(self) -> dict[str, str]:
        return current_label_sources(self.lines, self._base_label_sources)

    def kinds(self) -> dict[str, str | None]:
        return current_kinds(self.lines, self._base_kinds)

    def sources(self) -> dict[str, Source]:
        """Full cell id → the sudoku photo, row and col (0-8) it was cut from."""
        self._refresh()
        return current_sources(self.lines, self._base_sources)

    def cell_file(self, stem: str) -> Path:
        self._refresh()
        return self.paths.cells / self.folder[self._stem_ids[stem]] / f"{stem}.png"

    def move(self, cell: str, digit: str, screen: str) -> None:
        self._refresh()
        if digit not in DIGIT_CLASSES:
            raise ValueError(f"unknown digit folder {digit!r}")
        old = self.folder[cell]
        if old == digit:
            return
        t, action = self._t(), self._action()
        lines = [Line(t, self.session, action, cell, "digit", old, digit, screen)]
        kind = self.kinds().get(cell)
        if digit == "empty" and kind is not None:
            lines.append(Line(t, self.session, action, cell, "kind", kind, None, screen))
        self._apply_digits(lines)
        self._write(lines)

    def undo_target(self) -> str | None:
        """The screen of the action that undo would reverse, or None when there is none. An
        imported photo's outline check is not in the journal, so undo never reaches it."""
        self._refresh()
        lines = undo_lines(self.lines, self._t(), self.session)
        if not lines:
            return None
        action = lines[0].action.removeprefix("undo:")
        return next(x.screen for x in self.lines if x.action == action)

    def undo(self) -> int:
        self._refresh()
        lines = undo_lines(self.lines, self._t(), self.session)
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)

    def rollback(self, session: str) -> int:
        self._refresh()
        lines = rollback_lines(self.lines, session, self._t(), self.session)
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)

    def register(self, cell_ids: list[str], folder: str = "unlabeled") -> None:
        """Make new cells in `folder` known. Ctrl-C rewrites cells.csv with them later."""
        for cell in cell_ids:
            self._registered[stem_of(cell)] = cell
            self._stem_ids[stem_of(cell)] = cell
            self.folder[cell] = folder

    def _read_prelabels(self) -> tuple[str | None, dict[str, dict]]:
        # The file has one entry per cell. A screen change reads it again and again.
        if self.paths.prelabels is None or not self.paths.prelabels.exists():
            return None, {}
        stat = self.paths.prelabels.stat()
        key = (stat.st_mtime_ns, stat.st_size)
        if self._pre_cache is None or self._pre_cache[0] != key:
            try:
                value = json.loads(self.paths.prelabels.read_text())
                self._pre_cache = (key, value.get("run"), value["cells"])
            except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
                warn_unreadable(self.paths.prelabels, error)
                self._pre_cache = (key, None, {})
        return self._pre_cache[1], self._pre_cache[2]

    def _prelabels(self) -> dict[str, dict]:
        return self._read_prelabels()[1]

    # Doubtful labels step

    def _near_duplicates(self) -> tuple[list[tuple[str, str]], set[str]]:
        """Near-duplicate pairs inside one folder, and the ids in the test split. Slow: reads
        every cell once, then caches."""
        if self._dups is None:
            cells = read_real_cells(self.paths)
            ids = [self._stem_ids[c.path.stem] for c in cells]
            folders = np.array([c.path.parent.name for c in cells])
            hashes = np.array([dhash(c.sample.image) for c in cells], dtype=np.uint64)
            pairs = []
            for i in range(len(ids) - 1):
                distance = np.bitwise_count(hashes[i + 1 :] ^ hashes[i])
                close = (distance <= NEAR_DUPLICATE_BITS) & (folders[i + 1 :] == folders[i])
                pairs += [(ids[i], ids[j]) for j in np.nonzero(close)[0] + i + 1]
            config = tomllib.loads(self.paths.config.read_text())
            _, _, test = split_cells(cells, tuple(config["split"]), config["seed"])
            test_ids = {self._stem_ids[c.path.stem] for c in test}
            self._dups = (pairs, test_ids)
        return self._dups

    def _model_items(self, current) -> list:
        self._suspects_ok = True
        try:
            return model_items(self.paths.suspects, self._stem_ids, current)
        except (OSError, ValueError, KeyError, TypeError, csv.Error) as error:
            warn_unreadable(self.paths.suspects, error)
            self._suspects_ok = False
            return []

    def review_items(self) -> list[dict]:
        self._refresh()
        kinds = self.kinds()

        def current(cell: str, field: str) -> str | None:
            return kinds.get(cell) if field == "kind" else self.folder.get(cell)

        items = (
            near_duplicate_items(self._near_duplicates()[0], kinds, self.lines)
            + self._model_items(current)
            + check_items(self.checks, current)
        )
        merged: dict[tuple[str, str], dict] = {}
        for item in open_items(items, self.lines, read_last_finish(self.paths.status)):
            if item.cell not in self.folder:
                continue
            entry = merged.setdefault(
                (item.cell, item.field),
                {
                    "id": item.cell,
                    "stem": stem_of(item.cell),
                    "field": item.field,
                    "folder": self.folder[item.cell],
                    "kind": kinds.get(item.cell),
                    "reasons": [],
                },
            )
            entry["reasons"].append({"reason": item.reason, **item.evidence})
        return list(merged.values())

    def open_review_count(self) -> int | None:
        """The number of open Review items, or None when the near-duplicates are not cached yet:
        they read every cell, and Finish must stay quick."""
        if self._dups is None:
            return None
        return len(self.review_items())

    def review_screen(self) -> dict:
        items = self.review_items()
        # The page tells "never ran just suspects" from "nothing is flagged".
        return {
            "items": items[:SCREEN_SIZE],
            "open": len(items),
            "suspects": self.paths.suspects.exists() and self._suspects_ok,
        }

    def review_save(self, entries: list[dict]) -> int:
        """Settle the doubtful cells of one page as one action: a digit line per cell, also an
        unchanged one, and a kind line per cell with a kind. The review lines close the items.
        Checks all entries first."""
        self._refresh()
        kinds, t, action = self.kinds(), self._t(), self._action()
        lines = []
        for entry in entries:
            cell, digit, kind = entry["id"], entry["digit"], entry.get("kind")
            if self.folder.get(cell) not in DIGIT_CLASSES:
                raise ValueError(f"{stem_of(cell)}: not in a digit folder")
            if digit not in ASSIGNABLE:
                raise ValueError(f"{stem_of(cell)}: unknown digit {digit!r}")
            if digit in NO_KIND_FOLDERS:
                kind = None
            elif kind not in KINDS:
                raise ValueError(f"{stem_of(cell)}: the digit {digit} needs a kind")
            old = self.folder[cell]
            lines.append(Line(t, self.session, action, cell, "digit", old, digit, "review"))
            if kind is not None or kinds.get(cell) is not None:
                lines.append(
                    Line(t, self.session, action, cell, "kind", kinds.get(cell), kind, "review")
                )
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)

    # Outlines and the cells of each scan, for uploaded scans and imported photos

    def _scan_states(self) -> list[ScanState]:
        """Each scan in the order of sudoku-photos.csv, which is the pull and import order.

        An uploaded scan takes its outline from sudoku-photos.csv with the journal on top. An
        imported photo takes its status from sudoku-photos.csv only: `pending` is an open outline
        without corners (see _corners). A `legacy` photo and a missing file are never offered."""
        self._refresh()
        rows = read_photos(self.paths.photos_csv)
        now = current_outlines(
            self.lines,
            {r.photo_id: format_outline(r.status, r.corners) for r in rows if r.source == APP_SCAN},
        )
        states = []
        for row in rows:
            if row.source == APP_SCAN:
                states.append(ScanState(row, *parse_outline(now[row.photo_id])))
            elif row.status == "pending" and (self.paths.photos / row.file).exists():
                states.append(ScanState(row, "unchecked", ""))
            elif row.status == "accepted":
                states.append(ScanState(row, "accepted", row.corners))
            elif row.status in ("rejected", "too-few-cells"):
                states.append(ScanState(row, "rejected", ""))
        return states

    def _scan_state(self, photo: str) -> ScanState:
        for state in self._scan_states():
            if stem_of(state.row.photo_id) == photo:
                return state
        raise ValueError(f"{photo}: not a scan or photo to check")

    def _upright(self, row: PhotoRow) -> np.ndarray:
        # The Outlines step asks for the same few photos many times. A decode is slow.
        if row.photo_id not in self._photos:
            self._photos[row.photo_id] = load_upright(self.paths.photos / row.file)
            while len(self._photos) > PHOTO_CACHE:
                self._photos.popitem(last=False)
        return self._photos[row.photo_id]

    def _corners(self, state: ScanState) -> str:
        """The outline to show: the stored corners, or the detected grid of a pending imported
        photo. Empty when the detection found no grid. The detection is stored in detections.json
        (ADR-018)."""
        if state.corners or state.status != "unchecked" or state.row.source == APP_SCAN:
            return state.corners
        detections = read_detections(self.paths.detections)
        if state.row.photo_id not in detections:
            detections[state.row.photo_id] = detect_outline(self._upright(state.row))
            write_detections(self.paths.detections, detections)
        found = detections[state.row.photo_id]["corners"]
        return format_corners(found) if found else ""

    def _fits(self, states: list[ScanState]) -> dict[str, float]:
        """Photo id → outline_fit, or -1 without an outline. Computes and stores each score that
        the file lacks for the current corners."""
        scores = read_scores(self.paths.outline_scores)
        corners = {s.row.photo_id: self._corners(s) for s in states}
        missing = [
            s
            for s in states
            if scores.get(s.row.photo_id, {}).get("corners") != corners[s.row.photo_id]
        ]
        for state in missing:
            text = corners[state.row.photo_id]
            fit = outline_fit(self._upright(state.row), text) if text else -1.0
            scores[state.row.photo_id] = {"corners": text, "fit": round(fit, 4)}
        if missing:
            write_scores(self.paths.outline_scores, scores)
        return {s.row.photo_id: scores[s.row.photo_id]["fit"] for s in states}

    def outline_screen(self, page: int = 0) -> dict:
        """One page of the scans and photos with an unchecked outline, the lowest fit first."""
        states = [s for s in self._scan_states() if s.status == "unchecked"]
        fits = self._fits(states)
        order = sorted(range(len(states)), key=lambda i: (fits[states[i].row.photo_id], i))
        pages = max(1, -(-len(order) // OUTLINE_SCREEN_SIZE))
        page = min(page, pages - 1)
        chunk = order[page * OUTLINE_SCREEN_SIZE : (page + 1) * OUTLINE_SCREEN_SIZE]
        scans = []
        for i in chunk:
            corners = self._corners(states[i])
            scans.append(
                {
                    "photo": stem_of(states[i].row.photo_id),
                    "source": _source(states[i].row),
                    "fit": fits[states[i].row.photo_id],
                    "corners": parse_corners(corners) if corners else None,
                }
            )
        return {"scans": scans, "open": len(states), "page": page, "pages": pages}

    def outline(self, photo: str) -> dict:
        """One scan for the large view. Corners, width and height are in upright photo pixels."""
        state = self._scan_state(photo)
        height, width = self._upright(state.row).shape[:2]
        corners = self._corners(state)
        return {
            "photo": photo,
            "source": _source(state.row),
            "status": state.status,
            "width": width,
            "height": height,
            "corners": parse_corners(corners) if corners else None,
        }

    def photo_jpeg(self, photo: str, size: int = THUMBNAIL_SIZE, outline: bool = True) -> bytes:
        """The scan at `size` pixels on the long side. With `outline`, its current outline in
        green."""
        state = self._scan_state(photo)
        rgb = self._upright(state.row)
        scale = min(1.0, size / max(rgb.shape[:2]))
        small = cv2.resize(rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        corners = self._corners(state) if outline else ""
        if corners:
            quad = np.array(parse_corners(corners), dtype=np.float32) * scale
            width = max(2, round(max(small.shape[:2]) / 160))
            cv2.polylines(small, [quad.round().astype(np.int32)], True, (58, 214, 90), width)
        out = io.BytesIO()
        Image.fromarray(small).save(out, "JPEG", quality=85)
        return out.getvalue()

    def flat_png(self, photo: str, corners=None) -> bytes:
        """The grid that `corners` cut from the scan, with the cell lines drawn: the preview of a
        fix. Without `corners`: the grid of the current outline, without lines, square, with
        place (row, col) at the same 1/9 of each side."""
        state = self._scan_state(photo)
        if corners is None and not state.corners:
            raise ValueError(f"{photo}: no outline yet")
        try:
            chosen = parse_corners(state.corners) if corners is None else corners
            flat = warp_grid(self._upright(state.row), check_corners(chosen))
        except (np.linalg.LinAlgError, cv2.error) as error:
            raise ValueError("these corners do not form a grid") from error
        if corners is None:
            out = io.BytesIO()
            Image.fromarray(flat).save(out, "PNG")
            return out.getvalue()
        step = flat.shape[0] / GRID_CELLS
        for k in range(GRID_CELLS + 1):
            at = min(round(k * step), flat.shape[0] - 1)
            thick = 2 if k % 3 == 0 else 1
            flat[max(0, at - thick + 1) : at + 1, :] = (58, 214, 90)
            flat[:, max(0, at - thick + 1) : at + 1] = (58, 214, 90)
        out = io.BytesIO()
        Image.fromarray(flat).save(out, "PNG")
        return out.getvalue()

    def _unchecked(self, photo: str) -> ScanState:
        state = self._scan_state(photo)
        if state.status != "unchecked":
            raise ValueError(f"{photo}: the outline is already checked ({state.status})")
        return state

    def _outline_line(self, state: ScanState, status: str, corners: str, t: str, action: str):
        old = format_outline(state.status, state.corners)
        new = format_outline(status, corners)
        return Line(t, self.session, action, state.row.photo_id, "outline", old, new, "outlines")

    def _own_cells(self, photo_id: str) -> dict[int, str]:
        """Position 0-80 → the cell of this scan outside discarded/. A cell of another scan
        with the same pixels belongs to that scan."""
        return {
            row * GRID_CELLS + col: cell
            for cell, (source, row, col) in self.sources().items()
            if source == photo_id and self.folder.get(cell, "discarded") != "discarded"
        }

    def _discard(self, cells, kinds, t: str, action: str) -> list[Line]:
        lines = []
        for cell in cells:
            lines.append(
                Line(
                    t,
                    self.session,
                    action,
                    cell,
                    "digit",
                    self.folder[cell],
                    "discarded",
                    "outlines",
                )
            )
            if kinds.get(cell) is not None:
                lines.append(
                    Line(t, self.session, action, cell, "kind", kinds[cell], None, "outlines")
                )
        return lines

    def _cut_photo(self, state: ScanState, corners) -> dict:
        """Accept an imported photo: PhotoCheck cuts its cells into unlabeled/. This writes
        sudoku-photos.csv at once, so undo cannot reverse it (ADR-018)."""
        result = self.check.accept(stem_of(state.row.photo_id), corners)
        self.register(result["new_cells"])
        self._photos.pop(state.row.photo_id, None)
        return result

    def approve_outlines(self, photos: list[str]) -> int:
        """Approve the outline of each scan. The uploaded scans are one action. An imported
        photo needs a detected outline: its cells are cut. Checks all scans first."""
        states = [self._unchecked(photo) for photo in photos]
        corners = {s.row.photo_id: self._corners(s) for s in states}
        blind = [s for s in states if not corners[s.row.photo_id]]
        if blind:
            raise ValueError(f"{stem_of(blind[0].row.photo_id)}: no outline found. Set its corners")
        for state in states:
            # The cut of a photo can still refuse its corners. Check before any line is written.
            if state.row.source != APP_SCAN:
                stem = stem_of(state.row.photo_id)
                try:
                    self.check.usable(stem, parse_corners(corners[state.row.photo_id]))
                except ValueError as error:
                    raise ValueError(f"{stem}: {error}. Open it and set its corners") from error
        t, action = self._t(), self._action()
        lines = [
            self._outline_line(s, "accepted", s.corners, t, action)
            for s in states
            if s.row.source == APP_SCAN
        ]
        self._write(lines)
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
            self.check.reject(photo)
            return 1
        t, action = self._t(), self._action()
        own = self._own_cells(state.row.photo_id)
        lines = [self._outline_line(state, "rejected", "", t, action)]
        lines += self._discard(own.values(), self.kinds(), t, action)
        self._apply_digits(lines)
        self._write(lines)
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
        rgb = self._upright(state.row)
        old_cut = [cell for _, cell in scan_cut(rgb, state.corners)]
        new_cut = scan_cut(rgb, text)
        kinds, label_sources = self.kinds(), self.label_sources()
        t, action = self._t(), self._action()
        lines = [self._outline_line(state, "accepted", text, t, action)]
        new_cells, kept = [], 0
        target = self.paths.cells / "discarded"
        sources = self.sources()
        for position, (image, cell) in enumerate(new_cut):
            where = self.folder.get(cell)
            own_discarded = (
                where == "discarded" and sources.get(cell, ("",))[0] == state.row.photo_id
            )
            if where is not None and not own_discarded:
                kept += 1
                continue
            label = self.folder.get(old_cut[position])
            if label not in DIGIT_CLASSES:
                continue
            if where is None:
                # Cut outside cells/, then rename: a stop never leaves a misnamed cell (ADR-009).
                self.paths.tmp.mkdir(parents=True, exist_ok=True)
                tmp = self.paths.tmp / f"{stem_of(cell)}.png"
                Image.fromarray(image).save(tmp, "PNG")
                target.mkdir(parents=True, exist_ok=True)
                tmp.replace(target / f"{stem_of(cell)}.png")
                self.register([cell], "discarded")
                source = format_source((state.row.photo_id, *divmod(position, GRID_CELLS)))
                lines.append(
                    Line(t, self.session, action, cell, "source", None, source, "outlines")
                )
                provenance = label_sources.get(old_cut[position], "")
                if provenance:
                    lines.append(
                        Line(
                            t,
                            self.session,
                            action,
                            cell,
                            "label_source",
                            None,
                            provenance,
                            "outlines",
                        )
                    )
            lines.append(
                Line(t, self.session, action, cell, "digit", "discarded", label, "outlines")
            )
            kind = kinds.get(old_cut[position])
            if label not in NO_KIND_FOLDERS and kind is not None:
                lines.append(Line(t, self.session, action, cell, "kind", None, kind, "outlines"))
            new_cells.append(cell)
        wanted = {cell for _, cell in new_cut}
        gone = [c for c in self._own_cells(state.row.photo_id).values() if c not in wanted]
        lines += self._discard(gone, kinds, t, action)
        self._apply_digits(lines)
        self._write(lines)
        return {"cells": len(new_cells), "kept": kept, "discarded": len(gone)}

    def _own_places(self) -> dict[str, dict[int, str]]:
        """Photo id → place (0-80) → the first cell of the sources that sits in a folder."""
        found: dict[str, dict[int, str]] = {}
        for cell, (photo, row, col) in self.sources().items():
            if cell in self.folder:
                found.setdefault(photo, {}).setdefault(row * GRID_CELLS + col, cell)
        return found

    def _places(
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
            cut = [cell for _, cell in scan_cut(self._upright(state.row), state.corners)]
        if own is None:
            own = self._own_places().get(state.row.photo_id, {})
        return [cell if cell in self.folder else own.get(n) for n, cell in enumerate(cut)]

    def _suggestion(self, cell: str, pre: dict[str, dict]) -> tuple[str | None, str | None]:
        """The digit and kind that a cell in unlabeled/ starts with: the model's pre-label."""
        guess = pre.get(cell)
        if guess is None:
            return None, None
        if guess["digit"] == "empty":
            return "empty", None
        return guess["digit"], guess["kind"] if guess["kind"] in KINDS else None

    def scan_screen(self, photo: str) -> dict:
        """The scan view: the 81 places of the scan. A place shows the cell there and its label.
        A cell in unlabeled/ shows the model's pre-label with `suggested`. A cell of another scan
        is marked `shared`, and so is a second place with the same pixels as an earlier place."""
        state = self._scan_state(photo)
        rgb = self._upright(state.row)
        sources, kinds, label_sources = self.sources(), self.kinds(), self.label_sources()
        labelled = confirmed_cells(self.lines)
        pre = self._prelabels()
        cells, seen = [], set()
        for position, cell in enumerate(self._places(state)):
            place = {"row": position // GRID_CELLS, "col": position % GRID_CELLS}
            if cell is None:
                cells.append({**place, "missing": True})
                continue
            owner = sources.get(cell, (state.row.photo_id,))[0]
            shared = owner != state.row.photo_id or cell in seen
            seen.add(cell)
            folder = self.folder[cell]
            digit, kind = folder, kinds.get(cell)
            if folder == "unlabeled":
                digit, kind = self._suggestion(cell, pre)
            cells.append(
                {
                    **place,
                    "id": cell,
                    "stem": stem_of(cell),
                    "digit": digit,
                    "kind": kind,
                    "suggested": folder == "unlabeled",
                    "edited": label_sources.get(cell) == "app-edited",
                    "reviewed": label_sources.get(cell) == "verified" or cell in labelled,
                    "shared": stem_of(owner) if shared else None,
                    "locked": folder == "discarded",
                }
            )
        height, width = rgb.shape[:2]
        return {
            "photo": photo,
            "source": _source(state.row),
            "status": state.status,
            "width": width,
            "height": height,
            "corners": parse_corners(state.corners) if state.corners else None,
            "cells": cells,
        }

    def _unconfirmed(self, states: list[ScanState] | None = None) -> dict[str, list[str]]:
        """Photo id → the open cells of each scan with an accepted outline, in pull order. A cell
        is open in unlabeled/, or as an `app-*` cell in a digit folder that no person labelled.
        A scan without an open cell is left out."""
        states = self._scan_states() if states is None else states
        accepted = [s.row.photo_id for s in states if s.status == "accepted"]
        label_sources, labelled = self.label_sources(), confirmed_cells(self.lines)
        found: dict[str, list[str]] = {photo: [] for photo in accepted}
        for cell, (photo, _, _) in self.sources().items():
            if photo not in found:
                continue
            folder = self.folder.get(cell)
            if folder == "unlabeled" or (
                folder in DIGIT_CLASSES
                and label_sources.get(cell, "").startswith("app-")
                and cell not in labelled
            ):
                found[photo].append(cell)
        return {photo: cells for photo, cells in found.items() if cells}

    def scan_list(self) -> dict:
        """`open`: the cells to confirm. `edited`: those that the player changed. Pull order."""
        label_sources = self.label_sources()
        sources = {s.row.photo_id: _source(s.row) for s in self._scan_states()}
        return {
            "scans": [
                {
                    "photo": stem_of(photo),
                    "source": sources[photo],
                    "open": len(cells),
                    "edited": sum(label_sources.get(c) == "app-edited" for c in cells),
                }
                for photo, cells in self._unconfirmed().items()
            ],
        }

    def confirm_scan(self, photo: str, cells: list[dict]) -> int:
        """Label every own cell of a scan with an approved outline as one action: a digit line
        per cell, also an unchanged one, and a kind line per changed kind. A shared cell belongs
        to its own scan. Checks all entries before it writes."""
        state = self._scan_state(photo)
        if state.status != "accepted":
            raise ValueError(f"{photo}: approve the outline first")
        members = sorted(
            c["id"]
            for c in self.scan_screen(photo)["cells"]
            if "id" in c and not c["shared"] and not c["locked"]
        )
        if sorted(e["id"] for e in cells) != members:
            stray = next((e["id"] for e in cells if e["id"] not in members), None)
            if stray is not None:
                raise ValueError(f"{stem_of(stray)}: not a cell of {photo}")
            raise ValueError(f"{photo}: send each of its {len(members)} cells once")
        kinds, t, action = self.kinds(), self._t(), self._action()
        lines = []
        for entry in cells:
            cell, digit, kind = entry["id"], entry["digit"], entry.get("kind")
            if digit not in DIGIT_CLASSES:
                raise ValueError(f"{stem_of(cell)}: unknown digit {digit!r}")
            if digit == "empty":
                kind = None
            elif kind is None:
                raise ValueError(f"{stem_of(cell)}: the digit {digit} has no kind")
            elif kind not in KINDS:
                raise ValueError(f"{stem_of(cell)}: unknown kind {kind!r}")
            old = self.folder[cell]
            lines.append(Line(t, self.session, action, cell, "digit", old, digit, "scans"))
            if kinds.get(cell) != kind:
                lines.append(
                    Line(t, self.session, action, cell, "kind", kinds.get(cell), kind, "scans")
                )
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)

    # Digits and Kind steps (ADR-034)

    def loose_cells(self, states: list[ScanState] | None = None) -> list[str]:
        """The cells in unlabeled/ that no scan with an accepted outline holds. They have no
        photo."""
        self._refresh()
        states = self._scan_states() if states is None else states
        accepted = {s.row.photo_id for s in states if s.status == "accepted"}
        sources = self.sources()
        return [
            c
            for c, f in self.folder.items()
            if f == "unlabeled" and sources.get(c, ("",))[0] not in accepted
        ]

    def _context(self) -> dict:
        states = self._scan_states()
        return {
            "states": states,
            "pre": self._prelabels(),
            "kinds": self.kinds(),
            "label_sources": self.label_sources(),
            "sources": self.sources(),
            "scans": {s.row.photo_id: _source(s.row) for s in states if s.status == "accepted"},
        }

    def _label_of(self, cell: str, pre: dict, kinds: dict) -> tuple[str | None, str | None]:
        """The digit and kind that a cell starts with: its folder and kind, or for a cell in
        unlabeled/ the model's guess."""
        folder = self.folder.get(cell)
        if folder == "unlabeled":
            return self._suggestion(cell, pre)
        return folder, kinds.get(cell)

    def _item(self, cell: str, ctx: dict, digit: str | None, kind: str | None) -> dict:
        found = ctx["sources"].get(cell)
        photo = found[0] if found and found[0] in ctx["scans"] else None
        guess = ctx["pre"].get(cell)
        return {
            "id": cell,
            "stem": stem_of(cell),
            "photo": stem_of(photo) if photo else None,
            "source": ctx["scans"][photo] if photo else "loose",
            "row": found[1] if photo else None,
            "col": found[2] if photo else None,
            "digit": digit,
            "kind": kind,
            "edited": ctx["label_sources"].get(cell) == "app-edited",
            "probs": guess.get("probs") if guess else None,
        }

    def _open_digit_cells(self, ctx: dict) -> list[dict]:
        """Open digit cell: an open cell of a scan with an accepted outline, or a loose cell. A
        scan cell is open in unlabeled/, or as an `app-*` cell in a digit folder that no person
        labelled. Each cell is one item, also when the scans share its pixels."""
        waiting = self._unconfirmed(ctx["states"])
        ids = [c for cells in waiting.values() for c in cells] + self.loose_cells(ctx["states"])
        found = []
        for cell in ids:
            digit, kind = self._label_of(cell, ctx["pre"], ctx["kinds"])
            found.append(self._item(cell, ctx, digit, kind))
        return found

    def _awaiting_kind(self) -> set[str]:
        """The cells whose digit a person confirmed in this journal and that have no person
        kind line after it. An undone action does not count."""
        undone = undone_actions(self.lines)
        waiting: set[str] = set()
        for line in self.lines:
            if line.action in undone or line.screen == "undo":
                continue
            if line.field == "digit" and line.screen in DIGIT_SCREENS:
                waiting.add(line.cell)
            elif line.field == "kind" and line.screen in KIND_SCREENS:
                waiting.discard(line.cell)
        return waiting

    def _open_kind_cells(self, ctx: dict, open_digits: set[str]) -> list[dict]:
        """Open kind cell: a cell in 1-9 whose digit a person confirmed and that has no person
        kind line after it, or that has no kind at all. A cell that still waits for its digit
        is left out: the Digits step comes first. A cell without a kind starts with the model's
        kind."""
        awaiting = self._awaiting_kind()
        found = []
        for cell, folder in sorted(self.folder.items()):
            if folder not in DIGIT_FOLDERS or cell in open_digits:
                continue
            kind = ctx["kinds"].get(cell)
            if kind is not None and cell not in awaiting:
                continue
            guess = ctx["pre"].get(cell)
            if kind is None and guess and guess.get("kind") in KINDS:
                kind = guess["kind"]
            found.append(self._item(cell, ctx, folder, kind))
        return found

    def open_cells(self) -> list[dict]:
        """Every open digit cell with the label it starts with. `digit` is None for a cell in
        unlabeled/ without a guess."""
        self._refresh()
        return self._open_digit_cells(self._context())

    def open_kind_cells(self) -> list[dict]:
        self._refresh()
        ctx = self._context()
        return self._open_kind_cells(ctx, {c["id"] for c in self._open_digit_cells(ctx)})

    def prelabel_targets(self) -> set[str]:
        """The cells that the model must guess: every open digit cell and open kind cell."""
        self._refresh()
        ctx = self._context()
        digits = self._open_digit_cells(ctx)
        kinds = self._open_kind_cells(ctx, {c["id"] for c in digits})
        return {c["id"] for c in digits + kinds}

    def _read_sudoku_cache(self) -> dict[str, dict]:
        if self._sudoku_cache is None:
            try:
                self._sudoku_cache = json.loads(self.paths.doubt_scans.read_text())["scans"]
            except (OSError, ValueError, KeyError, TypeError):
                self._sudoku_cache = {}  # derived: a broken file only costs a new cut
        return self._sudoku_cache

    def sudoku_reasons(self) -> dict[str, list[dict]]:
        """Cell id → its `rule-break` and `not-unique` reasons, from every scan with an accepted
        outline that holds the cell. A rule break is a digit twice in a row, a column or a box.
        `not-unique` marks the empty cells of a scan whose printed givens have more than one
        solution: a given that the scan missed hides in one of them.

        The cut of a scan is the slow part. The cut and the signals are cached per scan in
        doubt-sudoku.json, keyed by the corners and by the labels."""
        cache = self._read_sudoku_cache()
        ctx = self._context()
        own, found, changed = self._own_places(), {}, False
        for state in ctx["states"]:
            if state.status != "accepted" or not state.corners:
                continue
            photo = state.row.photo_id
            entry = cache.get(photo)
            if entry is None or entry["corners"] != state.corners:
                try:
                    cut = [stem_of(c) for _, c in scan_cut(self._upright(state.row), state.corners)]
                except (OSError, ValueError, cv2.error, np.linalg.LinAlgError):
                    continue
                entry = cache[photo] = {"corners": state.corners, "cut": cut}
                changed = True
            full = [self._stem_ids.get(stem) for stem in entry["cut"]]
            places = self._places(state, full, own.get(photo, {}))
            labels = [
                self._label_of(cell, ctx["pre"], ctx["kinds"]) if cell else (None, None)
                for cell in places
            ]
            numbers = [int(d) if d in DIGIT_FOLDERS else 0 for d, _ in labels]
            is_printed = [k == "printed" for _, k in labels]
            printed = [n if p else 0 for n, p in zip(numbers, is_printed, strict=True)]
            key = labels_key(list(zip(numbers, is_printed, strict=True)))
            if entry.get("key") != key:
                signals = scan_signals(numbers, printed)
                rule = signals["rule"]
                entry.update(
                    key=key,
                    rule=[[p, u, i] for p, units in rule.items() for u, i in units],
                    not_unique=signals["not_unique"],
                )
                changed = True
            for place, unit, index in entry["rule"]:
                reason = {"signal": "rule-break", "unit": unit, "index": index}
                if places[place] and reason not in found.setdefault(places[place], []):
                    found[places[place]].append(reason)
            if entry["not_unique"]:
                for cell, (digit, _) in zip(places, labels, strict=True):
                    reason = {"signal": "not-unique"}
                    if cell and digit == "empty" and reason not in found.setdefault(cell, []):
                        found[cell].append(reason)
        if changed:
            write_atomic(self.paths.doubt_scans, json.dumps({"scans": cache}))
        return found

    def _confirmed(self, field: str, screens: tuple[str, ...]) -> set[str]:
        undone = undone_actions(self.lines)
        return {
            x.cell
            for x in self.lines
            if x.field == field and x.screen in screens and x.action not in undone
        }

    @staticmethod
    def _threshold(value: float) -> float:
        if not 0 < value <= 1:
            raise ValueError(f"the threshold {value} is not in 0 to 1")
        return value

    def _scored_digits(self, digit: str, threshold: float):
        """Counts of the open digit cells per tab, the cells of tab `digit` with their doubt
        (the highest first), and the ids that `sure` would confirm."""
        if digit not in DIGIT_TABS:
            raise ValueError(f"unknown digit {digit!r}")
        threshold = self._threshold(threshold)
        items = self.open_cells()
        counts = Counter(c["digit"] or "unknown" for c in items)
        sudoku = self.sudoku_reasons()
        scored, sure = [], []
        for cell in items:
            if (cell["digit"] or "unknown") != digit:
                continue
            extra = sudoku.get(cell["id"], [])
            raw, reasons = digit_doubt_raw(cell["digit"], cell["probs"], cell["edited"], extra)
            scored.append({**cell, "doubt": clamp_doubt(raw), "raw": raw, "reasons": reasons})
            if is_sure_digit(cell["digit"], cell["probs"], cell["edited"], extra, threshold):
                sure.append(cell["id"])
        scored.sort(key=lambda c: (-c["raw"], c["id"]))
        return counts, scored, sure

    def _scored_kinds(self, digit: str, threshold: float, kind: str | None = None):
        """Like `_scored_digits` for the Kind step. `kind` keeps the cells whose current kind
        label is that kind. The last value is the open count of `digit` per kind, with "all"."""
        if digit not in DIGIT_FOLDERS:
            raise ValueError(f"unknown digit {digit!r}: the Kind step has the digits 1 to 9")
        if kind is not None and kind not in KINDS:
            raise ValueError(f"unknown kind {kind!r}: use one of {', '.join(KINDS)}")
        threshold = self._threshold(threshold)
        items = self.open_kind_cells()
        counts = Counter(c["digit"] for c in items)
        here = [c for c in items if c["digit"] == digit]
        kind_counts = {"all": len(here), **{k: sum(c["kind"] == k for c in here) for k in KINDS}}
        scored, sure = [], []
        for cell in here:
            if kind is not None and cell["kind"] != kind:
                continue
            raw, reasons = kind_doubt_raw(cell["kind"], cell["probs"])
            scored.append({**cell, "doubt": clamp_doubt(raw), "raw": raw, "reasons": reasons})
            if is_sure_kind(cell["kind"], cell["probs"], threshold):
                sure.append(cell["id"])
        scored.sort(key=lambda c: (-c["raw"], c["id"]))
        return counts, scored, sure, kind_counts

    def _check(self, digit, tabs, counts, scored, sure, done, threshold) -> dict:
        return {
            "digit": digit,
            "cells": [{k: v for k, v in c.items() if k != "raw"} for c in scored[:CHECK_SIZE]],
            "left": len(scored),
            "counts": {t: counts[t] for t in tabs},
            "done": {t: done[t] for t in tabs},
            "sure": len(sure),
            "threshold": threshold,
        }

    def check_digits(self, digit: str, threshold: float = DIGIT_THRESHOLD) -> dict:
        """The Digits step: the open digit cells of one tab, the highest doubt first."""
        counts, scored, sure = self._scored_digits(digit, threshold)
        done = Counter(
            self.folder[c] for c in self._confirmed("digit", DIGIT_SCREENS) if c in self.folder
        )
        return self._check(digit, DIGIT_TABS, counts, scored, sure, done, threshold)

    def check_kinds(
        self, digit: str, threshold: float = KIND_THRESHOLD, kind: str | None = None
    ) -> dict:
        """The Kind step: the open kind cells of one digit, the highest doubt first. `kind`
        shows one kind only. `left` and `sure` count the shown cells, `kind_counts` all of the
        digit."""
        counts, scored, sure, kind_counts = self._scored_kinds(digit, threshold, kind)
        done = Counter(
            self.folder[c]
            for c in self._confirmed("kind", KIND_SCREENS)
            if self.folder.get(c) in DIGIT_FOLDERS
        )
        page = self._check(digit, DIGIT_FOLDERS, counts, scored, sure, done, threshold)
        return {**page, "kind_counts": kind_counts}

    def _confirm_digit_lines(self, entries: list[dict]) -> int:
        open_ids = {c["id"] for c in self.open_cells()}
        kinds, t, action = self.kinds(), self._t(), self._action()
        lines, seen = [], set()
        for entry in entries:
            cell, digit = entry["id"], entry["digit"]
            if cell not in open_ids or cell in seen:
                raise ValueError(f"{stem_of(cell)}: not an open digit cell")
            if digit not in ASSIGNABLE:
                raise ValueError(f"{stem_of(cell)}: unknown digit {digit!r}")
            seen.add(cell)
            lines.append(
                Line(t, self.session, action, cell, "digit", self.folder[cell], digit, "digits")
            )
            if digit in NO_KIND_FOLDERS or digit == "discarded":
                if kinds.get(cell) is not None:
                    lines.append(
                        Line(t, self.session, action, cell, "kind", kinds[cell], None, "digits")
                    )
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)

    def confirm_digits(self, entries: list[dict]) -> int:
        """Confirm open digit cells as one action: a digit line per cell, also an unchanged one.
        A move to `empty` or `discarded` drops the kind. Checks all entries first. Finish writes
        `verified` for the cells."""
        self._refresh()
        return self._confirm_digit_lines(entries)

    def sure_digits(self, digit: str, threshold: float = DIGIT_THRESHOLD) -> int:
        """Confirm every sure cell of the tab as one action. Returns the number of cells."""
        self._refresh()
        _, scored, sure = self._scored_digits(digit, threshold)
        label = {c["id"]: c["digit"] for c in scored}
        self._confirm_digit_lines([{"id": c, "digit": label[c]} for c in sure])
        return len(sure)

    def _confirm_kind_lines(self, entries: list[dict]) -> int:
        open_ids = {c["id"] for c in self.open_kind_cells()}
        kinds, t, action = self.kinds(), self._t(), self._action()
        lines, seen = [], set()
        for entry in entries:
            cell, kind = entry["id"], entry["kind"]
            if cell not in open_ids or cell in seen:
                raise ValueError(f"{stem_of(cell)}: not an open kind cell")
            if kind not in KINDS:
                raise ValueError(f"{stem_of(cell)}: unknown kind {kind!r}")
            seen.add(cell)
            lines.append(
                Line(t, self.session, action, cell, "kind", kinds.get(cell), kind, "kinds")
            )
        self._write(lines)
        return len(lines)

    def confirm_kinds(self, entries: list[dict]) -> int:
        """Confirm open kind cells as one action: a kind line per cell, also an unchanged one.
        Checks all entries first."""
        self._refresh()
        return self._confirm_kind_lines(entries)

    def sure_kinds(
        self, digit: str, threshold: float = KIND_THRESHOLD, kind: str | None = None
    ) -> int:
        """Confirm every sure cell of the tab, of one kind if `kind` is set, as one action.
        Returns the number of cells."""
        self._refresh()
        _, scored, sure, _ = self._scored_kinds(digit, threshold, kind)
        label = {c["id"]: c["kind"] for c in scored}
        self._confirm_kind_lines([{"id": c, "kind": label[c]} for c in sure])
        return len(sure)

    # Start page

    def status(self) -> dict:
        """The counts of the start page. It reads no cell image and runs no model."""
        self._refresh()
        ctx = self._context()
        digits = self._open_digit_cells(ctx)
        kinds = self._open_kind_cells(ctx, {c["id"] for c in digits})
        return {
            "outlines": sum(s.status == "unchecked" for s in ctx["states"]),
            "digit_cells": len(digits),
            "kind_cells": len(kinds),
            "not_prelabelled": sum(c["probs"] is None for c in digits + kinds),
            "model": self._read_prelabels()[0],
            "doubtful": self.open_review_count(),
            "suspects": self.paths.suspects.exists(),
            "changes": len(self.lines),
        }

    def label_state(self) -> dict:
        self._refresh()
        kinds = self.kinds()
        counts = Counter(kinds.get(c) for c, f in self.folder.items() if f in DIGIT_FOLDERS)
        return {
            "printed": counts["printed"],
            "handwritten": counts["handwritten"],
            "unsure": counts["unsure"],
            "review_open": len(self.review_items()),
            "check": summary(self.checks),
        }

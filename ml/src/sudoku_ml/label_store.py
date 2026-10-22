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
)

SCREEN_SIZE = 50
DIGIT_SCREEN_SIZE = 100
ASSIGNABLE = (*DIGIT_CLASSES, "discarded")
DIGIT_KINDS = ("handwritten", "all")
NEAR_DUPLICATE_BITS = 4  # the same limit as group_ids, which keeps the split leak-free
_LABELLED = ("printed", "handwritten")
PREDICTED = ("printed", "handwritten", "other")
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


def _predicted(kind: str) -> str:
    return kind if kind in _LABELLED else "other"


def _pages(count: int) -> int:
    return max(1, -(-count // SCREEN_SIZE))


class LabelStore:
    def __init__(self, paths: DataPaths, now: Callable[[], datetime] = lambda: datetime.now(UTC)):
        self.paths, self._now = paths, now
        self.session = now().strftime("%Y%m%d-%H%M%S")
        self._actions = 0
        self._registered: dict[str, str] = {}
        self._load()
        self.groups = self._read_groups()
        self._dups: tuple[list[tuple[str, str]], set[str]] | None = None
        self._suspects_ok = True
        self._pre_cache: tuple[tuple[int, int], dict[str, dict]] | None = None
        self._photos: OrderedDict[str, np.ndarray] = OrderedDict()
        self.check = PhotoCheck(paths, self.session, now)

    def _read_groups(self) -> dict:
        if not self.paths.groups.exists():
            return {}
        try:
            return json.loads(self.paths.groups.read_text())["folders"]
        except (OSError, ValueError, KeyError, TypeError) as error:
            warn_unreadable(self.paths.groups, error)
            return {}

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

    def _groups_of(self, folder: str) -> list[dict]:
        """The stored groups of the folder. Then the cells that no stored group holds: grouped
        by the model's kind guess (printed, handwritten, other), least sure first. Cells without
        a guess come last, in one plain group."""
        stored = self.groups.get(folder, [])
        grouped = {c for g in stored for c in g["cells"]}
        extra = sorted(c for c, f in self.folder.items() if f == folder and c not in grouped)
        pre = self._prelabels()
        guessed: dict[str, list[tuple[float, str]]] = {name: [] for name in PREDICTED}
        plain = []
        for cell in extra:
            if "kp" in pre.get(cell, {}):
                guessed[_predicted(pre[cell]["kind"])].append((pre[cell]["kp"], cell))
            else:
                plain.append(cell)
        groups = [
            {
                "cells": [c for _, c in ordered],
                "sureness": [kp for kp, _ in ordered],
                "ungrouped": True,
                "predicted": name,
            }
            for name in PREDICTED
            if (ordered := sorted(guessed[name]))
        ]
        if plain:
            groups.append({"cells": plain, "sureness": [0.0] * len(plain), "ungrouped": True})
        return [*stored, *groups]

    def _members(self, folder: str, group: dict) -> list[str]:
        return [c for c in group["cells"] if self.folder.get(c) == folder]

    @staticmethod
    def _open(members: list[str], kinds: dict[str, str | None]) -> list[str]:
        """The cells without a kind. All the cells when every one has a kind (Look again)."""
        return [c for c in members if kinds.get(c) is None] or members

    # Kind step (Flow B)

    @staticmethod
    def _majority(members: list[str], kinds: dict[str, str | None]) -> str | None:
        counts = Counter(kinds.get(c) for c in members if kinds.get(c) in _LABELLED).most_common()
        if not counts or (len(counts) > 1 and counts[0][1] == counts[1][1]):
            return None
        return counts[0][0]

    @staticmethod
    def _guess(entry: dict) -> str | None:
        return entry["kind"] if entry["kind"] in _LABELLED else None

    def folder_progress(self, folder: str) -> dict:
        kinds = self.kinds()
        cells = [c for c, f in self.folder.items() if f == folder]
        return {"cells": len(cells), "labelled": sum(kinds.get(c) is not None for c in cells)}

    def screen(self, folder: str, group: int, page: int) -> dict:
        self._refresh()
        groups = self._groups_of(folder)
        chosen = groups[group]
        members = self._members(folder, chosen)
        sure = dict(zip(chosen["cells"], chosen["sureness"], strict=True))
        kinds = self.kinds()
        predicted = chosen.get("predicted")
        pre = self._prelabels() if predicted else {}
        start = self._majority(members, kinds)
        members = self._open(members, kinds)
        pages = _pages(len(members))
        page = min(page, pages - 1)
        cutoff = np.quantile([sure[c] for c in members], 0.1) if members else 0.0
        chunk = members[page * SCREEN_SIZE : (page + 1) * SCREEN_SIZE]
        return {
            "folder": folder,
            "group": group,
            "groups": len(groups),
            "page": page,
            "pages": pages,
            "ungrouped": bool(chosen.get("ungrouped")),
            "predicted": predicted,
            "cells": [
                {
                    "id": c,
                    "stem": stem_of(c),
                    "kind": kinds.get(c),
                    "start": kinds.get(c) or (self._guess(pre[c]) if predicted else start),
                    "least_sure": bool(sure[c] <= cutoff),
                    **({"kp": pre[c]["kp"], "model_kind": pre[c]["kind"]} if predicted else {}),
                }
                for c in chunk
            ],
            "progress": self.folder_progress(folder),
        }

    def _screens(self):
        kinds = self.kinds()
        for folder in DIGIT_FOLDERS:
            for g, group in enumerate(self._groups_of(folder)):
                members = self._open(self._members(folder, group), kinds)
                for page in range(_pages(len(members))):
                    yield folder, g, page, members[page * SCREEN_SIZE : (page + 1) * SCREEN_SIZE]

    def next_screen(self, after: tuple[str, int, int] | None = None) -> dict | None:
        """The first screen after `after` with a cell without a kind. Wraps around once."""
        self._refresh()
        kinds = self.kinds()
        order = list(self._screens())
        start = 0
        if after is not None:
            start = 1 + next((i for i, s in enumerate(order) if s[:3] == after), -1)
        for folder, g, page, chunk in order[start:] + order[:start]:
            if any(kinds.get(c) is None for c in chunk):
                return self.screen(folder, g, page)
        return None

    # Changes

    def save(self, entries: list[dict], screen: str, confirm_digits: list[str] = ()) -> int:
        """Log a kind line per changed or new cell. On the Doubtful labels step, also per
        confirmation."""
        self._refresh()
        kinds, t, action = self.kinds(), self._t(), self._action()
        lines = []
        for entry in entries:
            cell, kind = entry["id"], entry["kind"]
            if kind not in KINDS:
                raise ValueError(f"{stem_of(cell)}: unknown kind {kind!r}")
            if self.folder.get(cell) not in DIGIT_FOLDERS:
                raise ValueError(f"{stem_of(cell)}: not in a digit folder")
            old = kinds.get(cell)
            if old != kind or screen == "review":
                lines.append(Line(t, self.session, action, cell, "kind", old, kind, screen))
        for cell in confirm_digits:
            folder = self.folder[cell]
            lines.append(Line(t, self.session, action, cell, "digit", folder, folder, screen))
        self._write(lines)
        return len(lines)

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

    # Digits step (Flow B)

    def register(self, cell_ids: list[str], folder: str = "unlabeled") -> None:
        """Make new cells in `folder` known. Ctrl-C rewrites cells.csv with them later."""
        for cell in cell_ids:
            self._registered[stem_of(cell)] = cell
            self._stem_ids[stem_of(cell)] = cell
            self.folder[cell] = folder

    def _prelabels(self) -> dict[str, dict]:
        # The file has one entry per cell. One screen change reads it for nine folders.
        if self.paths.prelabels is None or not self.paths.prelabels.exists():
            return {}
        stat = self.paths.prelabels.stat()
        key = (stat.st_mtime_ns, stat.st_size)
        if self._pre_cache is None or self._pre_cache[0] != key:
            try:
                cells = json.loads(self.paths.prelabels.read_text())["cells"]
            except (OSError, ValueError, KeyError, TypeError) as error:
                warn_unreadable(self.paths.prelabels, error)
                cells = {}
            self._pre_cache = (key, cells)
        return self._pre_cache[1]

    def digit_screen(self, digit: str, kinds: str = "handwritten") -> dict:
        self._refresh()
        if digit not in DIGIT_CLASSES:
            raise ValueError(f"unknown digit {digit!r}")
        if kinds not in DIGIT_KINDS:
            raise ValueError(f"unknown kinds filter {kinds!r}")
        pre = self._prelabels()
        waiting = self.loose_cells()

        def shown(cell: str) -> bool:
            return cell in pre and (kinds == "all" or pre[cell]["kind"] == "handwritten")

        counts = Counter(pre[c]["digit"] for c in waiting if shown(c))
        members = sorted(
            (c for c in waiting if shown(c) and pre[c]["digit"] == digit),
            key=lambda c: (pre[c]["p"], c),
        )
        return {
            "digit": digit,
            "kinds": kinds,
            "cells": [
                {"id": c, "stem": stem_of(c), "p": pre[c]["p"]} for c in members[:DIGIT_SCREEN_SIZE]
            ],
            "left": len(members),
            "counts": {d: counts[d] for d in DIGIT_CLASSES},
            "not_prelabelled": sum(c not in pre for c in waiting),
        }

    def assign(self, entries: list[dict], screen: str) -> int:
        """Move unlabelled cells to the chosen folders as one action. Checks all entries first."""
        self._refresh()
        t, action = self._t(), self._action()
        lines = []
        for entry in entries:
            cell, label = entry["id"], entry["digit"]
            if label not in ASSIGNABLE:
                raise ValueError(f"{stem_of(cell)}: unknown label {label!r}")
            if self.folder.get(cell) != "unlabeled":
                raise ValueError(f"{stem_of(cell)}: not in unlabeled")
            lines.append(Line(t, self.session, action, cell, "digit", "unlabeled", label, screen))
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)

    # Doubtful labels step (Flow B)

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

    # Flow A: outlines and the cells of each scan, for uploaded scans and imported photos

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

    def source_of(self, photo: str) -> str:
        return _source(self._scan_state(photo).row)

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

    def flat_png(self, photo: str, corners) -> bytes:
        """The grid that `corners` cut from the scan, with the cell lines drawn: the preview of a
        fix."""
        state = self._scan_state(photo)
        try:
            flat = warp_grid(self._upright(state.row), check_corners(corners))
        except (np.linalg.LinAlgError, cv2.error) as error:
            raise ValueError("these corners do not form a grid") from error
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

    def _places(self, state: ScanState) -> list[str | None]:
        """The cell at each of the 81 places of the scan, or None. The cut of the current corners
        finds a cell of another scan with the same pixels. A place where the cut finds no cell
        takes the own cell of that place from the sources: an imported photo was cut from
        corners before their rounding."""
        if not state.corners:
            return []
        cut = [cell for _, cell in scan_cut(self._upright(state.row), state.corners)]
        own = {}
        for cell, (photo, row, col) in self.sources().items():
            if photo == state.row.photo_id and cell in self.folder:
                own.setdefault(row * GRID_CELLS + col, cell)
        return [cell if cell in self.folder else own.get(n) for n, cell in enumerate(cut)]

    def _suggestion(self, cell: str, pre: dict[str, dict]) -> tuple[str | None, str | None]:
        """The digit and kind that a cell in unlabeled/ starts with: the model's pre-label."""
        guess = pre.get(cell)
        if guess is None:
            return None, None
        if guess["digit"] == "empty":
            return "empty", None
        return guess["digit"], guess["kind"] if guess["kind"] in KINDS else "unsure"

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

    # Start page

    def loose_cells(self) -> list[str]:
        """The cells in unlabeled/ that no scan with an accepted outline holds: Flow B. The
        others wait in the scan view of Flow A."""
        self._refresh()
        accepted = {s.row.photo_id for s in self._scan_states() if s.status == "accepted"}
        sources = self.sources()
        return [
            c
            for c, f in self.folder.items()
            if f == "unlabeled" and sources.get(c, ("",))[0] not in accepted
        ]

    def status(self) -> dict:
        """The counts of the start page. It reads no cell image and runs no model."""
        self._refresh()
        kinds = self.kinds()
        pre = self._prelabels()
        loose = self.loose_cells()
        scans = self._scan_states()
        waiting = self._unconfirmed(scans)
        return {
            "outlines": sum(s.status == "unchecked" for s in scans),
            "scans": len(waiting),
            "scan_cells": sum(len(cells) for cells in waiting.values()),
            "not_prelabelled": sum(c not in pre for c in loose),
            "digits": sum(c in pre for c in loose),
            "kind": sum(kinds.get(c) is None for c, f in self.folder.items() if f in DIGIT_FOLDERS),
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

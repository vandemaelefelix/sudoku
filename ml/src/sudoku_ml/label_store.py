"""State and rules of the labelling app. label_server.py only translates HTTP to these calls."""

import csv
import tomllib
from collections import Counter
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

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
)
from sudoku_ml.journal import KINDS, Line, Screen, Source, undone_actions
from sudoku_ml.kind_check import summary
from sudoku_ml.kind_review import check_items, model_items, near_duplicate_items, open_items
from sudoku_ml.label_lines import (
    DIGIT_SCREENS,
    KIND_SCREENS,
    check_digit,
    check_kind,
)
from sudoku_ml.label_state import LabelState
from sudoku_ml.open_cells import OpenCell, OpenCells, open_cells_of
from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.scan_book import ScanBook
from sudoku_ml.status import read_last_finish
from sudoku_ml.sudoku_signals import SudokuSignals
from sudoku_ml.tables import DIGIT_FOLDERS, NO_KIND_FOLDERS, stem_of, warn_unreadable

SCREEN_SIZE = 50
CHECK_SIZE = 240  # a full screen of 64 px cells
DIGIT_TABS = (*DIGIT_CLASSES, "unknown")
NEAR_DUPLICATE_BITS = 4  # the same limit as group_ids, which keeps the split leak-free


class LabelStore:
    def __init__(self, paths: DataPaths, now: Callable[[], datetime] = lambda: datetime.now(UTC)):
        self.state = LabelState(paths, now)
        self.paths, self.session = paths, self.state.session
        self.check = PhotoCheck(paths, self.session, now)
        self.book = ScanBook(self.state, self.check)
        self._opens = OpenCells(self.state, self.book)
        self._signals = SudokuSignals(self.state, self.book)
        self._dups: tuple[list[tuple[str, str]], set[str]] | None = None
        self._suspects_ok = True

    @property
    def folder(self) -> dict[str, str]:
        return self.state.folder

    @property
    def lines(self) -> list[Line]:
        return self.state.lines

    def now(self) -> datetime:
        return self.state.now()

    def repair(self) -> int:
        return self.state.repair()

    def label_sources(self) -> dict[str, str]:
        return self.state.label_sources()

    def kinds(self) -> dict[str, str | None]:
        return self.state.kinds()

    def sources(self) -> dict[str, Source]:
        return self.state.sources()

    def cell_file(self, stem: str) -> Path:
        return self.state.cell_file(stem)

    def undo_target(self) -> str | None:
        return self.state.undo_target()

    def undo(self) -> int:
        return self.state.undo()

    def rollback(self, session: str) -> int:
        return self.state.rollback(session)

    def register(self, cell_ids: list[str], folder: str = "unlabeled") -> None:
        self.state.register(cell_ids, folder)

    def outline_screen(self, page: int = 0) -> dict:
        return self.book.outline_screen(page)

    def outline(self, photo: str) -> dict:
        return self.book.outline(photo)

    def photo_jpeg(self, photo: str, size: int = 320, outline: bool = True) -> bytes:
        return self.book.photo_jpeg(photo, size, outline)

    def flat_png(self, photo: str, corners=None) -> bytes:
        return self.book.flat_png(photo, corners)

    def approve_outlines(self, photos: list[str]) -> int:
        return self.book.approve_outlines(photos)

    def reject_outline(self, photo: str) -> int:
        return self.book.reject_outline(photo)

    def fix_outline(self, photo: str, corners) -> dict:
        return self.book.fix_outline(photo, corners)

    def loose_cells(self) -> list[str]:
        return self._opens.loose_cells()

    def open_cells(self) -> list[OpenCell]:
        """Every open digit cell with the label it starts with. `digit` is None for a cell in
        unlabeled/ without a guess."""
        return self._opens.digit_cells()

    def open_kind_cells(self) -> list[OpenCell]:
        return self._opens.kind_cells()

    def prelabel_targets(self) -> set[str]:
        return self._opens.targets()

    def sudoku_reasons(self) -> dict[str, list[dict]]:
        return self._signals.reasons(self._opens.work())

    # Doubtful labels step

    def _near_duplicates(self) -> tuple[list[tuple[str, str]], set[str]]:
        """Near-duplicate pairs inside one folder, and the ids in the test split. Slow: reads
        every cell once, then caches."""
        if self._dups is None:
            cells = read_real_cells(self.paths)
            ids = [self.state.stem_ids[c.path.stem] for c in cells]
            folders = np.array([c.path.parent.name for c in cells])
            hashes = np.array([dhash(c.sample.image) for c in cells], dtype=np.uint64)
            pairs = []
            for i in range(len(ids) - 1):
                distance = np.bitwise_count(hashes[i + 1 :] ^ hashes[i])
                close = (distance <= NEAR_DUPLICATE_BITS) & (folders[i + 1 :] == folders[i])
                pairs += [(ids[i], ids[j]) for j in np.nonzero(close)[0] + i + 1]
            config = tomllib.loads(self.paths.config.read_text())
            _, _, test = split_cells(cells, tuple(config["split"]), config["seed"])
            test_ids = {self.state.stem_ids[c.path.stem] for c in test}
            self._dups = (pairs, test_ids)
        return self._dups

    def _model_items(self, current) -> list:
        self._suspects_ok = True
        try:
            return model_items(self.paths.suspects, self.state.stem_ids, current)
        except (OSError, ValueError, KeyError, TypeError, csv.Error) as error:
            warn_unreadable(self.paths.suspects, error)
            self._suspects_ok = False
            return []

    def review_items(self) -> list[dict]:
        self.state.refresh()
        kinds = self.state.kinds()

        def current(cell: str, field: str) -> str | None:
            return kinds.get(cell) if field == "kind" else self.state.folder.get(cell)

        items = (
            near_duplicate_items(self._near_duplicates()[0], kinds, self.state.lines)
            + self._model_items(current)
            + check_items(self.state.checks, current)
        )
        merged: dict[tuple[str, str], dict] = {}
        for item in open_items(items, self.state.lines, read_last_finish(self.paths.status)):
            if item.cell not in self.state.folder:
                continue
            entry = merged.setdefault(
                (item.cell, item.field),
                {
                    "id": item.cell,
                    "stem": stem_of(item.cell),
                    "field": item.field,
                    "folder": self.state.folder[item.cell],
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
        self.state.refresh()
        kinds, action = self.state.kinds(), self.state.action()
        lines = []
        for entry in entries:
            cell, digit, kind = entry["id"], entry["digit"], entry.get("kind")
            if self.state.folder.get(cell) not in DIGIT_CLASSES:
                raise ValueError(f"{stem_of(cell)}: not in a digit folder")
            check_digit(cell, digit)
            if digit not in NO_KIND_FOLDERS:
                check_kind(cell, kind, digit)
            lines += action.digit_and_kind(
                cell,
                self.state.folder[cell],
                digit,
                kinds.get(cell),
                kind,
                Screen.REVIEW,
                record_same_kind=True,
            )
        self.state.apply_digits(lines)
        self.state.write(lines)
        return len(lines)

    def _confirmed(self, field: str, screens: tuple[str, ...]) -> set[str]:
        undone = undone_actions(self.state.lines)
        return {
            x.cell
            for x in self.state.lines
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
            self.state.folder[c]
            for c in self._confirmed("digit", DIGIT_SCREENS)
            if c in self.state.folder
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
            self.state.folder[c]
            for c in self._confirmed("kind", KIND_SCREENS)
            if self.state.folder.get(c) in DIGIT_FOLDERS
        )
        page = self._check(digit, DIGIT_FOLDERS, counts, scored, sure, done, threshold)
        return {**page, "kind_counts": kind_counts}

    def _confirm_digit_lines(self, entries: list[dict]) -> int:
        open_ids = {c["id"] for c in self.open_cells()}
        kinds, action = self.state.kinds(), self.state.action()
        lines, seen = [], set()
        for entry in entries:
            cell, digit = entry["id"], entry["digit"]
            if cell not in open_ids or cell in seen:
                raise ValueError(f"{stem_of(cell)}: not an open digit cell")
            check_digit(cell, digit)
            seen.add(cell)
            lines += action.digit_and_kind(
                cell,
                self.state.folder[cell],
                digit,
                kinds.get(cell),
                kinds.get(cell),
                Screen.DIGITS,
            )
        self.state.apply_digits(lines)
        self.state.write(lines)
        return len(lines)

    def confirm_digits(self, entries: list[dict]) -> int:
        """Confirm open digit cells as one action: a digit line per cell, also an unchanged one.
        A move to `empty` or `discarded` drops the kind. Checks all entries first. Finish writes
        `verified` for the cells."""
        self.state.refresh()
        return self._confirm_digit_lines(entries)

    def sure_digits(self, digit: str, threshold: float = DIGIT_THRESHOLD) -> int:
        """Confirm every sure cell of the tab as one action. Returns the number of cells."""
        self.state.refresh()
        _, scored, sure = self._scored_digits(digit, threshold)
        label = {c["id"]: c["digit"] for c in scored}
        self._confirm_digit_lines([{"id": c, "digit": label[c]} for c in sure])
        return len(sure)

    def _confirm_kind_lines(self, entries: list[dict]) -> int:
        open_ids = {c["id"] for c in self.open_kind_cells()}
        kinds, action = self.state.kinds(), self.state.action()
        lines, seen = [], set()
        for entry in entries:
            cell, kind = entry["id"], entry["kind"]
            if cell not in open_ids or cell in seen:
                raise ValueError(f"{stem_of(cell)}: not an open kind cell")
            check_kind(cell, kind)
            seen.add(cell)
            lines.append(action.kind(cell, kinds.get(cell), kind, Screen.KINDS))
        self.state.write(lines)
        return len(lines)

    def confirm_kinds(self, entries: list[dict]) -> int:
        """Confirm open kind cells as one action: a kind line per cell, also an unchanged one.
        Checks all entries first."""
        self.state.refresh()
        return self._confirm_kind_lines(entries)

    def sure_kinds(
        self, digit: str, threshold: float = KIND_THRESHOLD, kind: str | None = None
    ) -> int:
        """Confirm every sure cell of the tab, of one kind if `kind` is set, as one action.
        Returns the number of cells."""
        self.state.refresh()
        _, scored, sure, _ = self._scored_kinds(digit, threshold, kind)
        label = {c["id"]: c["kind"] for c in scored}
        self._confirm_kind_lines([{"id": c, "kind": label[c]} for c in sure])
        return len(sure)

    # Start page

    def status(self) -> dict:
        """The counts of the start page. It reads no cell image and runs no model."""
        self.state.refresh()
        work = self._opens.work()
        digits, kinds = open_cells_of(work)
        return {
            "outlines": sum(s.status == "unchecked" for s in work.states),
            "digit_cells": len(digits),
            "kind_cells": len(kinds),
            "not_prelabelled": sum(c["probs"] is None for c in digits + kinds),
            "model": work.model,
            "doubtful": self.open_review_count(),
            "suspects": self.paths.suspects.exists(),
            "changes": len(self.state.lines),
        }

    def label_state(self) -> dict:
        self.state.refresh()
        kinds = self.state.kinds()
        counts = Counter(kinds.get(c) for c, f in self.state.folder.items() if f in DIGIT_FOLDERS)
        return {
            "printed": counts["printed"],
            "handwritten": counts["handwritten"],
            "unsure": counts["unsure"],
            "review_open": len(self.review_items()),
            "check": summary(self.state.checks),
        }

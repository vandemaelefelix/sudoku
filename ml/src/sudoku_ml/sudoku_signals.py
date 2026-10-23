"""The sudoku signals of the Digits step (ADR-030): a rule break, or a scan that is not unique.
The cut of a scan is the slow part, so the cut and the signals are cached per scan in
doubt-sudoku.json, keyed by the corners and by the labels."""

import json

import cv2
import numpy as np

from sudoku_ml.doubt import labels_key, scan_signals
from sudoku_ml.label_state import LabelState
from sudoku_ml.open_cells import OpenWork, label_of
from sudoku_ml.scan_book import ScanBook, ScanState
from sudoku_ml.scan_outlines import cut as scan_cut
from sudoku_ml.tables import DIGIT_FOLDERS, read_derived, stem_of, write_atomic

Labels = list[tuple[str | None, str | None]]  # the digit and kind at each of the 81 places


def add_reason(found: dict[str, list[dict]], cell: str, reason: dict) -> None:
    reasons = found.setdefault(cell, [])
    if reason not in reasons:
        reasons.append(reason)


def signal_entry(entry: dict, labels: Labels) -> bool:
    """Set the `rule` and `not_unique` signals of a cache entry from the labels. Returns False
    when the key of the labels shows that the entry is current."""
    numbers = [int(d) if d in DIGIT_FOLDERS else 0 for d, _ in labels]
    is_printed = [k == "printed" for _, k in labels]
    key = labels_key(list(zip(numbers, is_printed, strict=True)))
    if entry.get("key") == key:
        return False
    printed = [n if p else 0 for n, p in zip(numbers, is_printed, strict=True)]
    signals = scan_signals(numbers, printed)
    entry.update(
        key=key,
        rule=[[p, u, i] for p, units in signals["rule"].items() for u, i in units],
        not_unique=signals["not_unique"],
    )
    return True


def reasons_of(
    entry: dict, places: list[str | None], labels: Labels, found: dict[str, list[dict]]
) -> None:
    """Add the reasons of one scan to `found`: `rule-break` for the cells of the rule breaks,
    and `not-unique` for the empty cells when the givens have more than one solution."""
    for place, unit, index in entry["rule"]:
        if places[place]:
            add_reason(found, places[place], {"signal": "rule-break", "unit": unit, "index": index})
    if entry["not_unique"]:
        for cell, (digit, _) in zip(places, labels, strict=True):
            if cell and digit == "empty":
                add_reason(found, cell, {"signal": "not-unique"})


class SudokuSignals:
    def __init__(self, state: LabelState, book: ScanBook):
        self._state, self._book = state, book
        self._cache: dict[str, dict] | None = None

    def _read_cache(self) -> dict[str, dict]:
        if self._cache is None:
            try:
                self._cache = read_derived(self._state.paths.doubt_scans)["scans"]
            except (KeyError, TypeError):
                self._cache = {}  # derived: a broken file only costs a new cut
        return self._cache

    def _cut(self, scan: ScanState) -> list[str] | None:
        """The stems of the 81 cells of the cut, or None when the photo does not cut."""
        try:
            return [stem_of(c) for _, c in scan_cut(self._book.upright(scan.row), scan.corners)]
        except (OSError, ValueError, cv2.error, np.linalg.LinAlgError):
            return None

    def reasons(self, work: OpenWork) -> dict[str, list[dict]]:
        """Cell id → its `rule-break` and `not-unique` reasons, from every scan with an accepted
        outline that holds the cell. A rule break is a digit twice in a row, a column or a box.
        `not-unique` marks the empty cells of a scan whose printed givens have more than one
        solution: a given that the scan missed hides in one of them."""
        cache = self._read_cache()
        own, found, changed = self._book.own_places(), {}, False
        for scan in work.states:
            if scan.status != "accepted" or not scan.corners:
                continue
            photo = scan.row.photo_id
            entry = cache.get(photo)
            if entry is None or entry["corners"] != scan.corners:
                cut = self._cut(scan)
                if cut is None:
                    continue
                entry = cache[photo] = {"corners": scan.corners, "cut": cut}
                changed = True
            full = [self._state.stem_ids.get(stem) for stem in entry["cut"]]
            places = self._book.places(scan, full, own.get(photo, {}))
            labels = [label_of(cell, work) if cell else (None, None) for cell in places]
            changed |= signal_entry(entry, labels)
            reasons_of(entry, places, labels, found)
        if changed:
            write_atomic(self._state.paths.doubt_scans, json.dumps({"scans": cache}))
        return found

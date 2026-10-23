"""The Review screen (ADR-034): the cells whose label a check doubts, and the page that settles
them."""

import csv
import tomllib

import numpy as np

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.dataset import dhash, read_real_cells, split_cells
from sudoku_ml.journal import Screen
from sudoku_ml.kind_review import (
    Current,
    ReviewItem,
    check_items,
    model_items,
    near_duplicate_items,
    open_items,
)
from sudoku_ml.label_lines import check_digit, check_kind
from sudoku_ml.label_state import LabelState
from sudoku_ml.status import read_last_finish
from sudoku_ml.tables import NO_KIND_FOLDERS, stem_of, warn_unreadable

SCREEN_SIZE = 50
NEAR_DUPLICATE_BITS = 4  # the same limit as group_ids, which keeps the split leak-free


def merge_items(items: list[ReviewItem], folder: dict[str, str], kinds: dict) -> list[dict]:
    """One entry per cell and field, with the reason of each item. An item of a cell that no
    folder holds is left out."""
    merged: dict[tuple[str, str], dict] = {}
    for item in items:
        if item.cell not in folder:
            continue
        entry = merged.setdefault(
            (item.cell, item.field),
            {
                "id": item.cell,
                "stem": stem_of(item.cell),
                "field": item.field,
                "folder": folder[item.cell],
                "kind": kinds.get(item.cell),
                "reasons": [],
            },
        )
        entry["reasons"].append({"reason": item.reason, **item.evidence})
    return list(merged.values())


class Review:
    def __init__(self, state: LabelState):
        self._state = state
        self._dups: tuple[list[tuple[str, str]], set[str]] | None = None
        self._suspects_ok = True

    def near_duplicates(self) -> tuple[list[tuple[str, str]], set[str]]:
        """Near-duplicate pairs inside one folder, and the ids in the test split. Slow: reads
        every cell once, then caches."""
        if self._dups is None:
            paths, stem_ids = self._state.paths, self._state.stem_ids
            cells = read_real_cells(paths)
            ids = [stem_ids[c.path.stem] for c in cells]
            folders = np.array([c.path.parent.name for c in cells])
            hashes = np.array([dhash(c.sample.image) for c in cells], dtype=np.uint64)
            pairs = []
            for i in range(len(ids) - 1):
                distance = np.bitwise_count(hashes[i + 1 :] ^ hashes[i])
                close = (distance <= NEAR_DUPLICATE_BITS) & (folders[i + 1 :] == folders[i])
                pairs += [(ids[i], ids[j]) for j in np.nonzero(close)[0] + i + 1]
            config = tomllib.loads(paths.config.read_text())
            _, _, test = split_cells(cells, tuple(config["split"]), config["seed"])
            self._dups = (pairs, {stem_ids[c.path.stem] for c in test})
        return self._dups

    def _model_items(self, current: Current) -> list[ReviewItem]:
        self._suspects_ok = True
        paths = self._state.paths
        try:
            return model_items(paths.suspects, self._state.stem_ids, current)
        except (OSError, ValueError, KeyError, TypeError, csv.Error) as error:
            warn_unreadable(paths.suspects, error)
            self._suspects_ok = False
            return []

    def items(self) -> list[dict]:
        self._state.refresh()
        kinds, folder = self._state.kinds(), self._state.folder

        def current(cell: str, field: str) -> str | None:
            return kinds.get(cell) if field == "kind" else folder.get(cell)

        found = (
            near_duplicate_items(self.near_duplicates()[0], kinds, self._state.lines)
            + self._model_items(current)
            + check_items(self._state.checks, current)
        )
        last_finish = read_last_finish(self._state.paths.status)
        return merge_items(open_items(found, self._state.lines, last_finish), folder, kinds)

    def open_count(self) -> int | None:
        """The number of open Review items, or None when the near-duplicates are not cached yet:
        they read every cell, and Finish must stay quick."""
        if self._dups is None:
            return None
        return len(self.items())

    def screen(self) -> dict:
        items = self.items()
        # The page tells "never ran just suspects" from "nothing is flagged".
        return {
            "items": items[:SCREEN_SIZE],
            "open": len(items),
            "suspects": self._state.paths.suspects.exists() and self._suspects_ok,
        }

    def save(self, entries: list[dict]) -> int:
        """Settle the doubtful cells of one page as one action: a digit line per cell, also an
        unchanged one, and a kind line per cell with a kind. The review lines close the items.
        Checks all entries first."""
        self._state.refresh()
        kinds, action = self._state.kinds(), self._state.action()
        lines = []
        for entry in entries:
            cell, digit, kind = entry["id"], entry["digit"], entry.get("kind")
            if self._state.folder.get(cell) not in DIGIT_CLASSES:
                raise ValueError(f"{stem_of(cell)}: not in a digit folder")
            check_digit(cell, digit)
            if digit not in NO_KIND_FOLDERS:
                check_kind(cell, kind, digit)
            lines += action.digit_and_kind(
                cell,
                self._state.folder[cell],
                digit,
                kinds.get(cell),
                kind,
                Screen.REVIEW,
                record_same_kind=True,
            )
        self._state.apply_digits(lines)
        self._state.write(lines)
        return len(lines)

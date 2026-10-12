"""State and rules of the labelling page. label_server.py only translates HTTP to these calls."""

import csv
import json
import tomllib
from collections import Counter
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.dataset import cell_paths, dhash, group_ids, split_by_group
from sudoku_ml.journal import (
    KINDS,
    Line,
    Source,
    append_records,
    current_kinds,
    current_sources,
    format_time,
    last_kind_times,
    read_journal,
    read_records,
    rollback_lines,
    undo_lines,
    undone_actions,
)
from sudoku_ml.kind_check import CheckLine, NotEnoughCells, draw_sample, summary
from sudoku_ml.kind_review import check_items, model_items, near_duplicate_items, open_items
from sudoku_ml.manifest import (
    base_kinds,
    base_sources,
    check_image_store,
    pixel_id,
    read_cells_table,
    repair_lines,
    warn_unreadable,
)
from sudoku_ml.preprocess import to_cell_image
from sudoku_ml.relabel import move_cells
from sudoku_ml.status import read_last_finish
from sudoku_ml.synthetic import Sample

SCREEN_SIZE = 50
DIGIT_SCREEN_SIZE = 100
ASSIGNABLE = (*DIGIT_CLASSES, "discarded")
DIGIT_KINDS = ("handwritten", "all")
NEAR_DUPLICATE_BITS = 4  # the same limit as group_ids, which keeps the split leak-free
DIGIT_FOLDERS = tuple(str(d) for d in range(1, 10))
_LABELLED = ("printed", "handwritten")
PREDICTED = ("printed", "handwritten", "other")


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
        table = read_cells_table(self.paths.cells_csv)
        check_image_store(self.paths, table)
        self._base_kinds, self._base_sources = base_kinds(table), base_sources(table)
        listed = {cell[:16]: cell for cell in table}
        self._stem_ids = {**listed, **self._registered}
        self.folder: dict[str, str] = {}
        for path in self.paths.cells.glob("*/*.png"):
            if path.stem not in self._stem_ids:
                # A stop before the manifest rewrite leaves cells that cells.csv does not list.
                cell_id = pixel_id(path)
                if cell_id[:16] != path.stem:
                    raise ValueError(f"{path} is not named after its pixels ({cell_id[:16]})")
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
            line.cell[:16]: line.new
            for line in lines
            if line.field == "digit" and line.old != line.new
        }
        if wanted:
            move_cells(self.paths.cells, wanted)
        for line in lines:
            if line.field == "digit" and line.old != line.new:
                self.folder[line.cell] = line.new

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

    # Groups screen

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
                    "stem": c[:16],
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
        for folder in DIGIT_FOLDERS:
            for g, group in enumerate(self._groups_of(folder)):
                members = self._members(folder, group)
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
        """Log a kind line per changed or new cell. On the Review screen, also per confirmation."""
        self._refresh()
        kinds, t, action = self.kinds(), self._t(), self._action()
        lines = []
        for entry in entries:
            cell, kind = entry["id"], entry["kind"]
            if kind not in KINDS:
                raise ValueError(f"{cell[:16]}: unknown kind {kind!r}")
            if self.folder.get(cell) not in DIGIT_FOLDERS:
                raise ValueError(f"{cell[:16]}: not in a digit folder")
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

    # Digits screen

    def register(self, cell_ids: list[str]) -> None:
        """Make new cells in unlabeled/ known. Ctrl-C rewrites cells.csv with them later."""
        for cell in cell_ids:
            self._registered[cell[:16]] = cell
            self._stem_ids[cell[:16]] = cell
            self.folder[cell] = "unlabeled"

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
        waiting = [c for c, f in self.folder.items() if f == "unlabeled"]

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
                {"id": c, "stem": c[:16], "p": pre[c]["p"]} for c in members[:DIGIT_SCREEN_SIZE]
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
                raise ValueError(f"{cell[:16]}: unknown label {label!r}")
            if self.folder.get(cell) != "unlabeled":
                raise ValueError(f"{cell[:16]}: not in unlabeled")
            lines.append(Line(t, self.session, action, cell, "digit", "unlabeled", label, screen))
        self._apply_digits(lines)
        self._write(lines)
        return len(lines)

    # Review screen

    def _near_duplicates(self) -> tuple[list[tuple[str, str]], set[str]]:
        """Near-duplicate pairs inside one folder, and the ids in the test split. Slow: reads
        every cell once, then caches."""
        if self._dups is None:
            paths = cell_paths(self.paths.cells)
            images = [to_cell_image(np.asarray(Image.open(p).convert("RGB"))) for p in paths]
            ids = [self._stem_ids[p.stem] for p in paths]
            folders = np.array([p.parent.name for p in paths])
            hashes = np.array([dhash(image) for image in images], dtype=np.uint64)
            pairs = []
            for i in range(len(ids) - 1):
                distance = np.bitwise_count(hashes[i + 1 :] ^ hashes[i])
                close = (distance <= NEAR_DUPLICATE_BITS) & (folders[i + 1 :] == folders[i])
                pairs += [(ids[i], ids[j]) for j in np.nonzero(close)[0] + i + 1]
            groups = group_ids([Sample(image, 0, 0) for image in images])
            config = tomllib.loads(self.paths.config.read_text())
            _, _, test = split_by_group(groups, tuple(config["split"]), config["seed"])
            self._dups = (pairs, {ids[i] for i in test})
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
                    "stem": item.cell[:16],
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

    # Check screen

    def check_start(self, n: int = 200) -> dict:
        self._refresh()
        test_ids = self._near_duplicates()[1]
        try:
            cells = draw_sample(
                self.kinds(), last_kind_times(self.lines), self.checks, test_ids, self._now(), n
            )
        except NotEnoughCells as error:
            return {
                "error": f"Only {error.count} cells have a label that is 7 days old or older. "
                f"The check needs {n}. A finished kind counts as old enough."
            }
        return {"cells": [{"id": c, "stem": c[:16]} for c in cells]}

    def check_answer(self, answers: list[dict]) -> dict:
        self._refresh()
        kinds, t = self.kinds(), self._t()
        checked = {c.cell for c in self.checks}
        records = []
        for answer in answers:
            cell, value = answer["id"], answer["answer"]
            if cell in checked:
                raise ValueError(f"{cell[:16]}: already checked")
            checked.add(cell)
            if value not in KINDS:
                raise ValueError(f"{cell[:16]}: unknown kind {value!r}")
            if kinds.get(cell) not in _LABELLED:
                raise ValueError(f"{cell[:16]}: has no printed or handwritten label")
            records.append(CheckLine(t, self.session, cell, kinds[cell], value))
        append_records(self.paths.kind_checks, records)
        self.checks.extend(records)
        return summary(self.checks)

    # Progress

    def progress(self) -> dict:
        self._refresh()
        kinds = self.kinds()
        undone = undone_actions(self.lines)
        moved_out = Counter(
            x.old
            for x in self.lines
            if x.field == "digit"
            and x.old != x.new
            and x.screen != "undo"
            and x.action not in undone
        )
        folders = {}
        for folder in DIGIT_FOLDERS:
            cells = [c for c, f in self.folder.items() if f == folder]
            counts = Counter(kinds.get(c) for c in cells)
            groups = []
            for g, group in enumerate(self._groups_of(folder)):
                members = self._members(folder, group)
                without = sum(kinds.get(c) is None for c in members)
                groups.append({"group": g, "size": len(members), "without": without})
            folders[folder] = {
                "cells": len(cells),
                "printed": counts["printed"],
                "handwritten": counts["handwritten"],
                "unsure": counts["unsure"],
                "without": counts[None],
                "moved_out": moved_out[folder],
                "groups": groups,
            }
        return {
            "folders": folders,
            "review_open": len(self.review_items()),
            "check": summary(self.checks),
        }

    def status(self) -> dict:
        """Counts for the steps bar. Cheap: it does not read the cells, unlike progress."""
        self._refresh()
        kinds = self.kinds()
        pre = self._prelabels()
        waiting = [c for c, f in self.folder.items() if f == "unlabeled"]
        return {
            "digits": sum(c in pre for c in waiting),
            "not_prelabelled": sum(c not in pre for c in waiting),
            "kind_not_prelabelled": sum(
                kinds.get(c) is None and "kp" not in pre.get(c, {})
                for c, f in self.folder.items()
                if f in DIGIT_FOLDERS
            ),
            "digit_cells": sum(f in DIGIT_FOLDERS for f in self.folder.values()),
            "kind": sum(kinds.get(c) is None for c, f in self.folder.items() if f in DIGIT_FOLDERS),
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

"""The journal state of the labelling app: cells.csv with the journal on top, and the folder of
each cell. Every other label module reads it, and every write goes through it (ADR-018)."""

from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.journal import (
    Field,
    Line,
    Source,
    append_records,
    current_kinds,
    current_label_sources,
    current_sources,
    format_time,
    read_journal,
    read_records,
    rollback_lines,
    undo_lines,
)
from sudoku_ml.kind_check import CheckLine
from sudoku_ml.label_lines import Action
from sudoku_ml.manifest import (
    base_kinds,
    base_sources,
    check_image_store,
    repair_lines,
)
from sudoku_ml.relabel import move_cells
from sudoku_ml.tables import pixel_id, read_cells, stem_of


class LabelState:
    def __init__(self, paths: DataPaths, now: Callable[[], datetime]):
        self.paths, self.now = paths, now
        self.session = now().strftime("%Y%m%d-%H%M%S")
        self._actions = 0
        self._registered: dict[str, str] = {}
        self._load()

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
        self.stem_ids = {**listed, **self._registered}
        self.folder: dict[str, str] = {}
        for path in self.paths.cells.glob("*/*.png"):
            if path.stem not in self.stem_ids:
                # A stop before the manifest rewrite leaves cells that cells.csv does not list.
                cell_id = pixel_id(path)
                if stem_of(cell_id) != path.stem:
                    raise ValueError(f"{path} is not named after its pixels ({stem_of(cell_id)})")
                self.stem_ids[path.stem] = cell_id
            self.folder[self.stem_ids[path.stem]] = path.parent.name
        self.lines = read_journal(self.paths.journal)
        self.checks = read_records(self.paths.kind_checks, CheckLine)
        self._seen = self._stamp()

    def refresh(self) -> None:
        # `just label-rollback` in another terminal appends to the journal and moves files. A cut
        # appends source lines. Finish deletes the journal and rewrites cells.csv.
        if self._stamp() != self._seen:
            self._load()

    def t(self) -> str:
        return format_time(self.now())

    def action(self) -> Action:
        self._actions += 1
        return Action(self.t(), self.session, f"{self.session}-{self._actions}")

    def write(self, lines: list[Line]) -> None:
        if not lines:
            return
        append_records(self.paths.journal, lines)
        self.lines.extend(lines)
        self._seen = self._stamp()

    def apply_digits(self, lines: list[Line]) -> None:
        # One move_cells call: it reads every cell folder once, and 16k cells make that slow.
        wanted = {
            stem_of(line.cell): line.new
            for line in lines
            if line.field == Field.DIGIT and line.old != line.new
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
        self.refresh()
        return current_sources(self.lines, self._base_sources)

    def cell_file(self, stem: str) -> Path:
        self.refresh()
        return self.paths.cells / self.folder[self.stem_ids[stem]] / f"{stem}.png"

    def register(self, cell_ids: list[str], folder: str = "unlabeled") -> None:
        """Make new cells in `folder` known. Ctrl-C rewrites cells.csv with them later."""
        for cell in cell_ids:
            self._registered[stem_of(cell)] = cell
            self.stem_ids[stem_of(cell)] = cell
            self.folder[cell] = folder

    def repair(self) -> int:
        """Drop the kind of each cell in empty/, unlabeled/ or discarded/ (see repair_lines)."""
        self.refresh()
        lines = repair_lines(self.folder, self.kinds(), self.t(), f"{self.session}-repair")
        self.write(lines)
        return len(lines)

    def undo_target(self) -> str | None:
        """The screen of the action that undo would reverse, or None when there is none. An
        imported photo's outline check is not in the journal, so undo never reaches it."""
        self.refresh()
        lines = undo_lines(self.lines, self.t(), self.session)
        if not lines:
            return None
        action = lines[0].action.removeprefix("undo:")
        return next(x.screen for x in self.lines if x.action == action)

    def undo(self) -> int:
        self.refresh()
        lines = undo_lines(self.lines, self.t(), self.session)
        self.apply_digits(lines)
        self.write(lines)
        return len(lines)

    def rollback(self, session: str) -> int:
        self.refresh()
        lines = rollback_lines(self.lines, session, self.t(), self.session)
        self.apply_digits(lines)
        self.write(lines)
        return len(lines)

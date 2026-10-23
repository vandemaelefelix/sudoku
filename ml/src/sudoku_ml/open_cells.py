"""The open cells of the Digits and Kind steps (ADR-034): the cells that wait for a person, each
with the digit and kind that it starts with."""

from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.doubt import Probs
from sudoku_ml.journal import KINDS, Field, Line, Screen, Source, undone_actions
from sudoku_ml.label_lines import DIGIT_SCREENS, KIND_SCREENS
from sudoku_ml.label_state import LabelState
from sudoku_ml.manifest import confirmed_cells
from sudoku_ml.scan_book import ScanBook, ScanState, source_of
from sudoku_ml.tables import DIGIT_FOLDERS, read_derived, stem_of, warn_unreadable


class OpenCell(TypedDict):
    id: str
    stem: str
    photo: str | None  # the stem of the scan. None for a loose cell
    source: str  # "app", "photo" or "loose"
    row: int | None  # 0-8. None for a loose cell
    col: int | None  # 0-8. None for a loose cell
    digit: str | None  # None for a cell in unlabeled/ without a guess
    kind: str | None
    edited: bool  # a person edited the label in the app
    probs: Probs | None  # None without a pre-label


@dataclass(frozen=True)
class OpenWork:
    """What one request reads to find the open cells. The request builds it once."""

    states: list[ScanState]
    model: str | None  # the model run of prelabels.json
    pre: dict[str, dict]  # full cell id → the model's guess
    kinds: dict[str, str | None]
    label_sources: dict[str, str]
    sources: dict[str, Source]
    scans: dict[str, str]  # photo id of each accepted scan → "app" or "photo"
    folder: dict[str, str]
    lines: list[Line]


class Prelabels:
    """The pre-labels of prelabels.json. The file has one entry per cell, and a screen change
    reads it again and again: the parsed file is cached by its time and size."""

    def __init__(self, path: Path):
        self._path = path
        self._cache: tuple[tuple[int, int], str | None, dict[str, dict]] | None = None

    def read(self) -> tuple[str | None, dict[str, dict]]:
        """The model run and the guess of each cell. Empty when the file is missing or broken."""
        if not self._path.exists():
            return None, {}
        stat = self._path.stat()
        key = (stat.st_mtime_ns, stat.st_size)
        if self._cache is None or self._cache[0] != key:
            self._cache = (key, *self._parse())
        return self._cache[1], self._cache[2]

    def _parse(self) -> tuple[str | None, dict[str, dict]]:
        value = read_derived(self._path, warn=True)
        if value is None:
            return None, {}
        try:
            return value.get("run"), value["cells"]
        except (KeyError, TypeError, AttributeError) as error:
            warn_unreadable(self._path, error)
            return None, {}


def suggestion(cell: str, pre: dict[str, dict]) -> tuple[str | None, str | None]:
    """The digit and kind that a cell in unlabeled/ starts with: the model's pre-label."""
    guess = pre.get(cell)
    if guess is None:
        return None, None
    if guess["digit"] == "empty":
        return "empty", None
    return guess["digit"], guess["kind"] if guess["kind"] in KINDS else None


def label_of(cell: str, work: OpenWork) -> tuple[str | None, str | None]:
    """The digit and kind that a cell starts with: its folder and kind, or for a cell in
    unlabeled/ the model's guess."""
    folder = work.folder.get(cell)
    if folder == "unlabeled":
        return suggestion(cell, work.pre)
    return folder, work.kinds.get(cell)


def loose_cells(work: OpenWork) -> list[str]:
    """The cells in unlabeled/ that no scan with an accepted outline holds. They have no photo."""
    accepted = {s.row.photo_id for s in work.states if s.status == "accepted"}
    return [
        c
        for c, f in work.folder.items()
        if f == "unlabeled" and work.sources.get(c, ("",))[0] not in accepted
    ]


def unconfirmed(work: OpenWork) -> dict[str, list[str]]:
    """Photo id → the open cells of each scan with an accepted outline, in pull order. A cell
    is open in unlabeled/, or as an `app-*` cell in a digit folder that no person labelled.
    A scan without an open cell is left out."""
    labelled = confirmed_cells(work.lines)
    found: dict[str, list[str]] = {
        s.row.photo_id: [] for s in work.states if s.status == "accepted"
    }
    for cell, (photo, _, _) in work.sources.items():
        if photo not in found:
            continue
        folder = work.folder.get(cell)
        if folder == "unlabeled" or (
            folder in DIGIT_CLASSES
            and work.label_sources.get(cell, "").startswith("app-")
            and cell not in labelled
        ):
            found[photo].append(cell)
    return {photo: cells for photo, cells in found.items() if cells}


def awaiting_kind(lines: list[Line]) -> set[str]:
    """The cells whose digit a person confirmed in this journal and that have no person
    kind line after it. An undone action does not count."""
    undone = undone_actions(lines)
    waiting: set[str] = set()
    for line in lines:
        if line.action in undone or line.screen == Screen.UNDO:
            continue
        if line.field == Field.DIGIT and line.screen in DIGIT_SCREENS:
            waiting.add(line.cell)
        elif line.field == Field.KIND and line.screen in KIND_SCREENS:
            waiting.discard(line.cell)
    return waiting


def _item(cell: str, work: OpenWork, digit: str | None, kind: str | None) -> OpenCell:
    found = work.sources.get(cell)
    photo = found[0] if found and found[0] in work.scans else None
    guess = work.pre.get(cell)
    return {
        "id": cell,
        "stem": stem_of(cell),
        "photo": stem_of(photo) if photo else None,
        "source": work.scans[photo] if photo else "loose",
        "row": found[1] if found and photo else None,
        "col": found[2] if found and photo else None,
        "digit": digit,
        "kind": kind,
        "edited": work.label_sources.get(cell) == "app-edited",
        "probs": guess.get("probs") if guess else None,
    }


def open_digit_cells(work: OpenWork) -> list[OpenCell]:
    """Open digit cell: an open cell of a scan with an accepted outline, or a loose cell. Each
    cell is one item, also when the scans share its pixels."""
    ids = [c for cells in unconfirmed(work).values() for c in cells] + loose_cells(work)
    return [_item(cell, work, *label_of(cell, work)) for cell in ids]


def open_kind_cells(work: OpenWork, open_digits: set[str]) -> list[OpenCell]:
    """Open kind cell: a cell in 1-9 whose digit a person confirmed and that has no person
    kind line after it, or that has no kind at all. A cell that still waits for its digit
    is left out: the Digits step comes first. A cell without a kind starts with the model's
    kind."""
    awaiting = awaiting_kind(work.lines)
    found = []
    for cell, folder in sorted(work.folder.items()):
        if folder not in DIGIT_FOLDERS or cell in open_digits:
            continue
        kind = work.kinds.get(cell)
        if kind is not None and cell not in awaiting:
            continue
        guess = work.pre.get(cell)
        if kind is None and guess and guess.get("kind") in KINDS:
            kind = guess["kind"]
        found.append(_item(cell, work, folder, kind))
    return found


def open_cells_of(work: OpenWork) -> tuple[list[OpenCell], list[OpenCell]]:
    """The open digit cells and the open kind cells."""
    digits = open_digit_cells(work)
    return digits, open_kind_cells(work, {c["id"] for c in digits})


class OpenCells:
    def __init__(self, state: LabelState, book: ScanBook):
        self._state, self._book = state, book
        self._prelabels = Prelabels(state.paths.prelabels)

    def work(self) -> OpenWork:
        states = self._book.states()
        model, pre = self._prelabels.read()
        kinds, label_sources = self._state.kinds(), self._state.label_sources()
        sources = self._state.sources()
        scans = {s.row.photo_id: source_of(s.row) for s in states if s.status == "accepted"}
        return OpenWork(
            states,
            model,
            pre,
            kinds,
            label_sources,
            sources,
            scans,
            self._state.folder,
            self._state.lines,
        )

    def loose_cells(self) -> list[str]:
        return loose_cells(self.work())

    def digit_cells(self) -> list[OpenCell]:
        """Every open digit cell with the label it starts with."""
        return open_digit_cells(self.work())

    def kind_cells(self) -> list[OpenCell]:
        return open_cells_of(self.work())[1]

    def targets(self) -> set[str]:
        """The cells that the model must guess: every open digit cell and open kind cell."""
        digits, kinds = open_cells_of(self.work())
        return {c["id"] for c in digits + kinds}

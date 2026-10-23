"""The front of the labelling app: one object that label_server.py, finish.py and train.py call.
Each method hands the work to the module that owns it (ADR-034)."""

from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from sudoku_ml.check_steps import CheckSteps
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.doubt import DIGIT_THRESHOLD, KIND_THRESHOLD
from sudoku_ml.journal import Line, Source
from sudoku_ml.label_state import LabelState
from sudoku_ml.open_cells import OpenCell, OpenCells
from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.review import Review
from sudoku_ml.scan_book import THUMBNAIL_SIZE, ScanBook
from sudoku_ml.start_page import label_summary, start_status
from sudoku_ml.sudoku_signals import SudokuSignals


class LabelStore:
    def __init__(self, paths: DataPaths, now: Callable[[], datetime] = lambda: datetime.now(UTC)):
        self.state = LabelState(paths, now)
        self.paths, self.session = paths, self.state.session
        self.check = PhotoCheck(paths, self.session, now)
        self.book = ScanBook(self.state, self.check)
        self.review = Review(self.state)
        self._opens = OpenCells(self.state, self.book)
        self._signals = SudokuSignals(self.state, self.book)
        self._steps = CheckSteps(self.state, self._opens, self._signals)

    @property
    def folder(self) -> dict[str, str]:
        return self.state.folder

    @property
    def lines(self) -> list[Line]:
        return self.state.lines

    def now(self) -> datetime:
        return self.state.now()

    # Journal state

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

    # Outlines step

    def outline_screen(self, page: int = 0) -> dict:
        return self.book.outline_screen(page)

    def outline(self, photo: str) -> dict:
        return self.book.outline(photo)

    def photo_jpeg(self, photo: str, size: int = THUMBNAIL_SIZE, outline: bool = True) -> bytes:
        return self.book.photo_jpeg(photo, size, outline)

    def flat_png(self, photo: str, corners=None) -> bytes:
        return self.book.flat_png(photo, corners)

    def approve_outlines(self, photos: list[str]) -> int:
        return self.book.approve_outlines(photos)

    def reject_outline(self, photo: str) -> int:
        return self.book.reject_outline(photo)

    def fix_outline(self, photo: str, corners) -> dict:
        return self.book.fix_outline(photo, corners)

    # Open cells

    def loose_cells(self) -> list[str]:
        return self._opens.loose_cells()

    def open_cells(self) -> list[OpenCell]:
        return self._opens.digit_cells()

    def open_kind_cells(self) -> list[OpenCell]:
        return self._opens.kind_cells()

    def prelabel_targets(self) -> set[str]:
        return self._opens.targets()

    def sudoku_reasons(self) -> dict[str, list[dict]]:
        return self._signals.reasons(self._opens.work())

    # Digits and Kind steps

    def check_digits(self, digit: str, threshold: float = DIGIT_THRESHOLD) -> dict:
        return self._steps.check_digits(digit, threshold)

    def check_kinds(
        self, digit: str, threshold: float = KIND_THRESHOLD, kind: str | None = None
    ) -> dict:
        return self._steps.check_kinds(digit, threshold, kind)

    def confirm_digits(self, entries: list[dict]) -> int:
        return self._steps.confirm_digits(entries)

    def sure_digits(self, digit: str, threshold: float = DIGIT_THRESHOLD) -> int:
        return self._steps.sure_digits(digit, threshold)

    def confirm_kinds(self, entries: list[dict]) -> int:
        return self._steps.confirm_kinds(entries)

    def sure_kinds(
        self, digit: str, threshold: float = KIND_THRESHOLD, kind: str | None = None
    ) -> int:
        return self._steps.sure_kinds(digit, threshold, kind)

    # Review

    def review_items(self) -> list[dict]:
        return self.review.items()

    def open_review_count(self) -> int | None:
        return self.review.open_count()

    def review_screen(self) -> dict:
        return self.review.screen()

    def review_save(self, entries: list[dict]) -> int:
        return self.review.save(entries)

    # Start page

    def status(self) -> dict:
        return start_status(self.state, self._opens, self.review)

    def label_state(self) -> dict:
        return label_summary(self.state, self.review)

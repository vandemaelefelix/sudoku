"""Journal lines of the labelling app, and the rule for a digit and its kind. Pure: no file is
read or written (ADR-018)."""

from dataclasses import dataclass

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.journal import KINDS, Field, Line, Screen, Source, format_source
from sudoku_ml.tables import NO_KIND_FOLDERS, stem_of

# The digits that a person can give a cell. `unlabeled` is a folder, not a digit.
ASSIGNABLE = (*DIGIT_CLASSES, "discarded")


@dataclass(frozen=True)
class Action:
    """One save or one move. Its lines share the time, the session and the action id."""

    t: str
    session: str
    id: str

    def line(
        self, cell: str, field: Field, old: str | None, new: str | None, screen: Screen
    ) -> Line:
        return Line(self.t, self.session, self.id, cell, field, old, new, screen)

    def digit(self, cell: str, old: str, new: str, screen: Screen) -> Line:
        return self.line(cell, Field.DIGIT, old, new, screen)

    def kind(self, cell: str, old: str | None, new: str | None, screen: Screen) -> Line:
        return self.line(cell, Field.KIND, old, new, screen)

    def source(self, cell: str, source: Source, screen: Screen) -> Line:
        return self.line(cell, Field.SOURCE, None, format_source(source), screen)

    def label_source(self, cell: str, label_source: str, screen: Screen) -> Line:
        return self.line(cell, Field.LABEL_SOURCE, None, label_source, screen)

    def outline(self, photo_id: str, old: str, new: str) -> Line:
        """`old` and `new` are format_outline texts."""
        return self.line(photo_id, Field.OUTLINE, old, new, Screen.OUTLINES)

    def digit_and_kind(
        self,
        cell: str,
        old_digit: str,
        digit: str,
        old_kind: str | None,
        kind: str | None,
        screen: Screen,
        record_same_kind: bool = False,
    ) -> list[Line]:
        """A digit line, also an unchanged one, and a kind line when the kind changes under
        kind_for. With `record_same_kind`, a kept kind also gets a line: a person settled it."""
        lines = [self.digit(cell, old_digit, digit, screen)]
        new_kind = kind_for(digit, kind)
        if new_kind != old_kind or (record_same_kind and new_kind is not None):
            lines.append(self.kind(cell, old_kind, new_kind, screen))
        return lines


def kind_for(digit: str, kind: str | None) -> str | None:
    """The kind that a cell with this digit keeps. A cell of empty/, unlabeled/ or discarded/
    has none."""
    return None if digit in NO_KIND_FOLDERS else kind


def check_digit(cell: str, digit: str) -> None:
    """Raises ValueError unless a person can give the cell this digit."""
    if digit not in ASSIGNABLE:
        raise ValueError(f"{stem_of(cell)}: unknown digit {digit!r}")


def check_kind(cell: str, kind: str | None, digit: str | None = None) -> None:
    """Raises ValueError unless `kind` is a kind. With `digit`, the message says that the digit
    needs the kind."""
    if kind in KINDS:
        return
    if digit is None:
        raise ValueError(f"{stem_of(cell)}: unknown kind {kind!r}")
    raise ValueError(f"{stem_of(cell)}: the digit {digit} needs a kind")

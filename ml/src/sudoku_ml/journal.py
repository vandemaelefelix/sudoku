"""The session journal `ml/dataset/work/journal.jsonl`: one JSON line per change of the unfinished
work, append-only (ADR-018). The labels at runtime are the kinds and sources of cells.csv with
the journal lines applied on top, in order. Finish folds the journal into cells.csv and deletes
it."""

import json
import os
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime
from pathlib import Path

KINDS: tuple[str, ...] = ("printed", "handwritten", "unsure")
TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


@dataclass(frozen=True)
class Line:
    t: str  # UTC, TIME_FORMAT
    session: str
    action: str  # the lines of one save or one move share it. An undo line: "undo:<action>"
    cell: str  # full SHA-256 cell id. For an outline line: the full photo id
    field: str  # "kind", "digit", "source", "label_source" or "outline"
    old: str | None
    new: (
        str | None
    )  # a source: "<photo_id> <row> <col>", row and col 0-8. An outline: see format_outline
    screen: str  # "groups", "review", "digits", "undo", "repair", "photos", "outlines" or "scans"


Source = tuple[str, int, int]  # full photo id, row, col (0-8)
# A source line records a cut, and a label_source line the label provenance of a new cell. They are
# facts, not labels: undo and rollback skip them.
FACT_FIELDS = ("source", "label_source")
FINISHED = "This session is finished. Use git to go back."


def read_records[T](path: Path, cls: type[T]) -> list[T]:
    if not path.exists():
        return []
    records = []
    for number, text in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not text.strip():
            continue
        try:
            records.append(cls(**json.loads(text)))
        except (TypeError, json.JSONDecodeError) as error:
            raise ValueError(f"{path}:{number}: not a valid line ({error})") from error
    return records


def append_records(path: Path, records: list) -> None:
    """Append, then fsync: a line that the page reported as saved survives a crash."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(asdict(record), separators=(",", ":")) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def read_journal(path: Path) -> list[Line]:
    return read_records(path, Line)


def format_source(source: Source) -> str:
    photo_id, row, col = source
    return f"{photo_id} {row} {col}"


def parse_source(text: str) -> Source:
    photo_id, row, col = text.split(" ")
    return photo_id, int(row), int(col)


def format_outline(status: str, corners: str) -> str:
    """The outline state of a sudoku photo: `<status> x1 y1 ... x4 y4`, or only the status."""
    return f"{status} {corners}".strip()


def parse_outline(text: str) -> tuple[str, str]:
    """The inverse of format_outline: (status, corners). The corners are empty without any."""
    status, _, corners = text.partition(" ")
    return status, corners


def current_outlines(lines: list[Line], base: dict[str, str]) -> dict[str, str]:
    """`base` (photo id → format_outline of sudoku-photos.csv) with the outline lines on top."""
    outlines = dict(base)
    for line in lines:
        if line.field == "outline" and line.new is not None:
            outlines[line.cell] = line.new
    return outlines


def format_time(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime(TIME_FORMAT)


def parse_time(text: str) -> datetime:
    return datetime.strptime(text, TIME_FORMAT).replace(tzinfo=UTC)


def current_kinds(
    lines: list[Line], base: dict[str, str | None] | None = None
) -> dict[str, str | None]:
    """`base` (the kinds of cells.csv) with the kind lines applied on top."""
    kinds: dict[str, str | None] = dict(base or {})
    for line in lines:
        if line.field == "kind":
            kinds[line.cell] = line.new
    return kinds


def current_sources(lines: list[Line], base: dict[str, Source] | None = None) -> dict[str, Source]:
    """`base` (the sources of cells.csv) with the source lines applied on top."""
    sources = dict(base or {})
    for line in lines:
        if line.field == "source":
            if line.new is None:
                sources.pop(line.cell, None)
            else:
                sources[line.cell] = parse_source(line.new)
    return sources


def current_label_sources(lines: list[Line], base: dict[str, str]) -> dict[str, str]:
    """`base` (the label_source column of cells.csv) with the label_source lines applied on top."""
    found = dict(base)
    for line in lines:
        if line.field == "label_source" and line.new is not None:
            found[line.cell] = line.new
    return found


def last_kind_times(lines: list[Line]) -> dict[str, str]:
    return {line.cell: line.t for line in lines if line.field == "kind"}


def _label(line: Line) -> bool:
    return line.field not in FACT_FIELDS and line.screen != "undo"


def undone_actions(lines: list[Line]) -> set[str]:
    return {line.action.removeprefix("undo:") for line in lines if line.screen == "undo"}


def _reverse(action_lines: list[Line], t: str, session: str) -> list[Line]:
    return [
        replace(
            line,
            t=t,
            session=session,
            action=f"undo:{line.action}",
            old=line.new,
            new=line.old,
            screen="undo",
        )
        for line in reversed(action_lines)
    ]


def undo_lines(lines: list[Line], t: str, session: str) -> list[Line]:
    """Lines that reverse the newest live action of `session`. Empty when there is none."""
    undone = undone_actions(lines)
    for line in reversed(lines):
        if line.session == session and _label(line) and line.action not in undone:
            return _reverse([x for x in lines if x.action == line.action and _label(x)], t, session)
    return []


def rollback_lines(lines: list[Line], target: str, t: str, session: str) -> list[Line]:
    """Lines that reverse every live action of `target`, newest first.

    Raises ValueError when the journal has no line of `target` (Finish deleted it), or when a
    later session changed a cell of `target`: reversing would overwrite that later work.
    """
    if not any(x.session == target for x in lines):
        raise ValueError(FINISHED)
    undone = undone_actions(lines)
    target_actions = {x.action for x in lines if x.session == target}
    live = [x for x in lines if x.session == target and _label(x) and x.action not in undone]
    cells = {x.cell for x in live}
    last = max((i for i, x in enumerate(lines) if x.session == target), default=-1)
    later = sorted(
        {
            x.cell[:16]
            for x in lines[last + 1 :]
            if x.cell in cells
            and x.field not in FACT_FIELDS
            and x.action.removeprefix("undo:") not in target_actions
        }
    )
    if later:
        raise ValueError(f"a later session changed {len(later)} cells of {target}, e.g. {later[0]}")
    actions = list(dict.fromkeys(x.action for x in reversed(live)))
    return [r for a in actions for r in _reverse([x for x in live if x.action == a], t, session)]

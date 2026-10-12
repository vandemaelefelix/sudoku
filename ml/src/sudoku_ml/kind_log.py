"""The kind log: one JSON line per label change, append-only (ADR-009, amendment)."""

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
    cell: str  # full SHA-256 cell id
    field: str  # "kind" or "digit"
    old: str | None
    new: str | None
    screen: str  # "groups", "review", "digits", "undo" or "repair"


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


def read_log(path: Path) -> list[Line]:
    return read_records(path, Line)


def format_time(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime(TIME_FORMAT)


def parse_time(text: str) -> datetime:
    return datetime.strptime(text, TIME_FORMAT).replace(tzinfo=UTC)


def current_kinds(lines: list[Line]) -> dict[str, str | None]:
    kinds: dict[str, str | None] = {}
    for line in lines:
        if line.field == "kind":
            kinds[line.cell] = line.new
    return kinds


def last_kind_times(lines: list[Line]) -> dict[str, str]:
    return {line.cell: line.t for line in lines if line.field == "kind"}


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
        if line.session == session and line.screen != "undo" and line.action not in undone:
            return _reverse([x for x in lines if x.action == line.action], t, session)
    return []


def rollback_lines(lines: list[Line], target: str, t: str, session: str) -> list[Line]:
    """Lines that reverse every live action of `target`, newest first.

    Raises ValueError when a later session changed a cell of `target`: reversing would
    overwrite that later work.
    """
    undone = undone_actions(lines)
    target_actions = {x.action for x in lines if x.session == target}
    live = [
        x for x in lines if x.session == target and x.screen != "undo" and x.action not in undone
    ]
    cells = {x.cell for x in live}
    last = max((i for i, x in enumerate(lines) if x.session == target), default=-1)
    later = sorted(
        {
            x.cell[:16]
            for x in lines[last + 1 :]
            if x.cell in cells and x.action.removeprefix("undo:") not in target_actions
        }
    )
    if later:
        raise ValueError(f"a later session changed {len(later)} cells of {target}, e.g. {later[0]}")
    actions = list(dict.fromkeys(x.action for x in reversed(live)))
    return [r for a in actions for r in _reverse([x for x in live if x.action == a], t, session)]

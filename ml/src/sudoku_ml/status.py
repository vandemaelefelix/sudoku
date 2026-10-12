"""`data/STATUS.md`: a short summary of the dataset that only Finish writes (ADR-018). The line
`Last finish:` is the one fact that the tool reads back: Review evidence older than it is
closed."""

import re
from datetime import UTC, datetime
from pathlib import Path

from sudoku_ml.journal import TIME_FORMAT, format_time
from sudoku_ml.manifest import CELL_FOLDERS, write_atomic
from sudoku_ml.photo_import import PHOTO_STATUSES

KIND_COLUMNS = ("printed", "handwritten", "unsure", "without")
_LAST_FINISH = re.compile(r"^Last finish: (\S+)$", re.MULTILINE)


def read_last_finish(path: Path) -> str:
    """The UTC time of the last Finish in TIME_FORMAT, or "" for never (also for a missing or
    bad line). The time format sorts as text, like the journal times."""
    try:
        found = _LAST_FINISH.search(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError):
        return ""
    if found is None:
        return ""
    try:
        datetime.strptime(found.group(1), TIME_FORMAT)
    except ValueError:
        return ""
    return found.group(1)


def _table(header: tuple[str, str], counts: dict[str, int], names) -> list[str]:
    return [
        f"| {header[0]} | {header[1]} |",
        "| --- | ---: |",
        *(f"| {name} | {counts.get(name, 0)} |" for name in names),
    ]


def status_text(report: dict, finished: datetime, prelabel_run: str | None) -> str:
    """`report` is a passed data check (data_check.check_data)."""
    lines = [
        "# Dataset status",
        "",
        "Finish on the labelling page writes this file. Do not edit it.",
        "",
        f"Date: {finished.astimezone(UTC):%Y-%m-%d}",
        f"Last finish: {format_time(finished)}",
        "",
        "## Cells",
        "",
        *_table(("Folder", "Cells"), report["cells"], CELL_FOLDERS),
        "",
        "## Kinds of the digit cells",
        "",
        *_table(("Kind", "Cells"), report["kinds"], KIND_COLUMNS),
        "",
        "## Sudoku photos",
        "",
        *_table(("Status", "Photos"), report["photos"], PHOTO_STATUSES),
        "",
        "## Other",
        "",
        f"- Linked cells: {report['linked']} of {report['total_cells']}",
        f"- Cells waiting in `unlabeled/`: {report['waiting_cells']}",
        f"- Sudoku photos pending: {report['pending_photos']}",
        f"- Model run of the pre-labels: {prelabel_run or 'none'}",
    ]
    return "\n".join(lines) + "\n"


def write_status(path: Path, report: dict, finished: datetime, prelabel_run: str | None) -> None:
    write_atomic(path, status_text(report, finished, prelabel_run))

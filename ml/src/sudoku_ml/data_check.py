"""The data check: the images agree with the two tables, and the tables follow their rules
(ADR-018). It prints a short report. It reads files only. It never changes a file."""

import sys
from collections import Counter
from pathlib import Path

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.journal import read_journal
from sudoku_ml.tables import (
    CELL_FOLDERS,
    DIGIT_FOLDERS,
    FULL_ID,
    PHOTO_STATUSES,
    PHOTO_SUFFIXES,
    PhotoRow,
    audit_cells,
    photo_row_problems,
    pixel_id,
    read_photos,
    stem_of,
)

MAX_PROBLEMS = 20
_LINK_NOTE = (
    "Cells without a link come from before links existed, or from a cut that stopped part-way."
)


def link_line(linked: int, total: int) -> str:
    return f"Linked {linked} of {total} cells. {_LINK_NOTE}"


def _cells(paths: DataPaths, problems: list[str]) -> dict[str, str]:
    """Full cell id → folder. Reports misnamed files and ids that appear twice."""
    found: dict[str, str] = {}
    where: dict[str, Path] = {}
    if paths.cells.exists():
        for folder in sorted(paths.cells.iterdir()):
            if folder.is_dir() and folder.name not in CELL_FOLDERS:
                problems.append(f"{folder} is not a known cell folder")
    for path in sorted(paths.cells.glob("*/*.png")):
        try:
            cell_id = pixel_id(path)
        except (OSError, ValueError) as error:
            problems.append(f"{path} cannot be read: {error}")
            continue
        if path.stem != stem_of(cell_id):
            problems.append(f"{path} is not named after its pixels ({stem_of(cell_id)})")
        if cell_id in found:
            problems.append(f"{path} has the same pixels as {where[cell_id]}")
            continue
        found[cell_id], where[cell_id] = path.parent.name, path
    return found


def _photo_row(row: PhotoRow, problems: list[str]) -> None:
    for found in photo_row_problems(row):
        problems.append(f"sudoku photo {stem_of(row.photo_id)}: {found} in sudoku-photos.csv")


def _photos(paths: DataPaths, problems: list[str]) -> dict[str, str]:
    """Photo id → status. Checks each row and that each file exists and has its id."""
    statuses: dict[str, str] = {}
    try:
        rows = read_photos(paths.photos_csv)
    except ValueError as error:
        problems.append(str(error))
        rows = []
    for row in rows:
        if not FULL_ID.fullmatch(row.photo_id):
            problems.append(f"{row.photo_id!r} in sudoku-photos.csv is not a photo id")
            continue
        if row.photo_id in statuses:
            problems.append(f"sudoku photo {stem_of(row.photo_id)} is twice in sudoku-photos.csv")
            continue
        statuses[row.photo_id] = row.status
        _photo_row(row, problems)
        path = paths.photos / row.file
        if not row.file or not path.is_file():
            problems.append(f"sudoku photo file {path} does not exist")
            continue
        try:
            actual = pixel_id(path)
        except (OSError, ValueError) as error:
            problems.append(f"sudoku photo file {path} cannot be read: {error}")
            continue
        if actual != row.photo_id:
            problems.append(
                f"sudoku photo file {path} has the id {stem_of(actual)}, "
                f"not {stem_of(row.photo_id)}"
            )
    listed = {row.file for row in rows}
    extra = sorted(
        p.name
        for p in (paths.photos.glob("*") if paths.photos.is_dir() else [])
        if p.suffix.lower() in PHOTO_SUFFIXES and p.name not in listed
    )
    _report_ids(problems, "sudoku photo files that sudoku-photos.csv does not list", extra)
    return statuses


def _report_ids(problems: list[str], what: str, ids: list[str], hint: str = "") -> None:
    if ids:
        problems.append(f"{len(ids)} {what}, e.g. {stem_of(ids[0])}.{hint}")


def _cell_rows(
    paths: DataPaths, cells: dict[str, str], photos: dict[str, str], problems: list[str]
) -> tuple[Counter, set[str]]:
    """Checks every row of cells.csv. Returns the kinds of the digit cells and the linked
    cells."""
    audit = audit_cells(paths.cells_csv)
    if audit.unreadable:
        problems.append(audit.unreadable)
    problems += [f"{cell!r} in cells.csv is not a cell id" for cell in audit.bad_id]
    listed = audit.rows
    no_photo = [c for c, row in listed.items() if row.source and row.source[0] not in photos]
    hint = " Run: just dataset-manifest"
    _report_ids(problems, "cells are twice in cells.csv", audit.twice)
    _report_ids(
        problems,
        "cells on disk that cells.csv does not list",
        sorted(set(cells) - set(listed)),
        hint,
    )
    _report_ids(
        problems, "rows of cells.csv without a cell on disk", sorted(set(listed) - set(cells)), hint
    )
    wrong = sorted(c for c in set(cells) & set(listed) if cells[c] != listed[c].digit)
    _report_ids(
        problems, "rows of cells.csv with another digit than the folder of the cell", wrong, hint
    )
    _report_ids(
        problems, "rows of cells.csv with a kind that is not allowed for the digit", audit.bad_kind
    )
    _report_ids(
        problems, "rows of cells.csv with a bad source (photo_id, row, col)", audit.bad_source
    )
    _report_ids(
        problems,
        "rows of cells.csv with a label_source that is not allowed",
        audit.bad_label_source,
    )
    _report_ids(
        problems, "rows of cells.csv with a photo_id that sudoku-photos.csv does not list", no_photo
    )
    kinds = Counter(
        row.kind or "without"
        for cell, row in listed.items()
        if cell in cells and cells[cell] in DIGIT_FOLDERS
    )
    linked = {c for c, row in listed.items() if c in cells and row.source}
    return kinds, linked


def _journal(paths: DataPaths, cells: dict[str, str], problems: list[str]) -> None:
    """Every cell id in the journal is a full id of a cell that exists in some folder."""
    try:
        lines = read_journal(paths.journal)
    except (ValueError, KeyError, TypeError) as error:
        problems.append(f"{paths.journal.name} cannot be read: {error}")
        return
    bad = sorted({x.cell for x in lines if not FULL_ID.fullmatch(x.cell)})
    gone = sorted({x.cell for x in lines if FULL_ID.fullmatch(x.cell) and x.cell not in cells})
    if bad:
        problems.append(f"{len(bad)} ids in {paths.journal.name} are not full ids, e.g. {bad[0]}")
    _report_ids(problems, f"ids in {paths.journal.name} match no cell", gone)


def check_data(paths: DataPaths) -> dict:
    """Returns `problems` (empty when the data is sound) and the counts of the report."""
    problems: list[str] = []
    cells = _cells(paths, problems)
    photos = _photos(paths, problems)
    kinds, linked = _cell_rows(paths, cells, photos, problems)
    _journal(paths, cells, problems)
    per_folder = Counter(cells.values())
    per_status = Counter(photos.values())
    return {
        "problems": problems,
        "cells": {folder: per_folder[folder] for folder in CELL_FOLDERS if per_folder[folder]},
        "kinds": {k: kinds[k] for k in ("printed", "handwritten", "unsure", "without")},
        "photos": {s: per_status[s] for s in PHOTO_STATUSES if per_status[s]},
        "linked": len(linked),
        "total_cells": len(cells),
        "link_line": link_line(len(linked), len(cells)),
        "waiting_cells": per_folder["unlabeled"],
        "pending_photos": per_status["pending"],
    }


def format_report(report: dict) -> str:
    lines = []
    if report["problems"]:
        lines.append(f"{len(report['problems'])} problems:")
        lines += [f"- {p}" for p in report["problems"][:MAX_PROBLEMS]]
        if len(report["problems"]) > MAX_PROBLEMS:
            lines.append(f"- and {len(report['problems']) - MAX_PROBLEMS} more")
    else:
        lines.append("No problems.")
    lines.append("Cells: " + ", ".join(f"{k} {v}" for k, v in report["cells"].items()))
    lines.append("Kinds: " + ", ".join(f"{k} {v}" for k, v in report["kinds"].items()))
    lines.append("Sudoku photos: " + ", ".join(f"{k} {v}" for k, v in report["photos"].items()))
    lines.append(report["link_line"])
    lines.append(
        f"Waiting: {report['waiting_cells']} cells in unlabeled/, "
        f"{report['pending_photos']} sudoku photos pending."
    )
    return "\n".join(lines)


def main(paths: DataPaths | None = None) -> int:
    report = check_data(paths or DataPaths.under())
    print(format_report(report))
    return 1 if report["problems"] else 0


if __name__ == "__main__":
    sys.exit(main())

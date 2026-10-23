"""The cells table `ml/dataset/cells.csv` (ADR-018): one row per cell image, with its digit, its
kind and its source. The folder of a cell is its digit. The kinds and the sources come from the
table itself with the journal applied on top."""

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.journal import (
    Field,
    Line,
    Screen,
    Source,
    append_records,
    current_kinds,
    current_label_sources,
    current_sources,
    format_time,
    read_journal,
    undone_actions,
)
from sudoku_ml.label_lines import Action
from sudoku_ml.tables import (
    CELL_FOLDERS,
    NO_KIND_FOLDERS,
    CellRow,
    pixel_id,
    read_cells,
    stem_of,
    write_cells,
)

UNCHANGED = "Check SUDOKU_IMAGES or restore the images. The table was not changed."


def warn_unreadable(path: Path, error: Exception) -> None:
    print(f"{path.name} cannot be read ({error}). Treated as missing.", file=sys.stderr)


def base_kinds(table: dict[str, CellRow]) -> dict[str, str | None]:
    return {c: r.kind for c, r in table.items() if r.kind is not None}


def base_sources(table: dict[str, CellRow]) -> dict[str, Source]:
    return {c: r.source for c, r in table.items() if r.source is not None}


def confirmed_cells(lines: list[Line]) -> set[str]:
    """Cells that a person labelled in the labelling app in the unfinished session: a digit or
    kind line of the Digits step, the Kind step or an older screen. Undone actions, source lines
    and repair lines do not count. Nor do the moves of the Outlines
    screen: a cut again or a reject moves files, and no person looked at the cells."""
    undone = undone_actions(lines)
    return {
        x.cell
        for x in lines
        if x.field in (Field.DIGIT, Field.KIND)
        and x.screen not in (Screen.UNDO, Screen.REPAIR, Screen.OUTLINES)
        and x.action not in undone
    }


def _kind_column(cell_id: str, digit: str, kind: str | None) -> str | None:
    if digit == "empty" and kind is not None:
        raise ValueError(f"{stem_of(cell_id)}: an empty cell has the kind {kind}")
    return None if digit in NO_KIND_FOLDERS else kind


def check_image_store(
    paths: DataPaths, table: dict[str, CellRow], forget_missing: bool = False
) -> None:
    """Raises ValueError when the cell folder is missing, or when a row of the table has no file
    any more. The tool never deletes a cell file, so a vanished cell means a wrong image store: a
    worktree without .env, a typo in SUDOKU_IMAGES or a disk that is not mounted. A fold against
    it would wipe the table. `forget_missing` accepts the missing cells (a CLI flag only)."""
    if not paths.cells.is_dir():
        raise ValueError(
            f"The cell folder {paths.cells} does not exist, and {paths.cells_csv.name} has "
            f"{len(table)} rows. {UNCHANGED}"
        )
    if forget_missing or not table:
        return
    on_disk = {p.stem for p in paths.cells.glob("*/*.png")}
    gone = sorted(c for c in table if stem_of(c) not in on_disk)
    if gone:
        raise ValueError(
            f"{len(gone)} of {len(table)} rows of {paths.cells_csv.name} have no file in "
            f"{paths.cells}, e.g. {stem_of(gone[0])}. {UNCHANGED} To drop these rows, run: "
            "just dataset-manifest --forget-missing"
        )


def write_cells_manifest(paths: DataPaths, forget_missing: bool = False) -> int:
    """Fold the journal into cells.csv: one row per cell file. The folder is the digit.

    Raises ValueError on a missing or wrong image store (see check_image_store), an unknown
    folder, a misnamed file, a duplicate id, a kind on an empty cell, or a cells.csv that does
    not parse."""
    table = read_cells(paths.cells_csv)
    check_image_store(paths, table, forget_missing)
    lines = read_journal(paths.journal)
    kinds = current_kinds(lines, base_kinds(table))
    sources = current_sources(lines, base_sources(table))
    confirmed = confirmed_cells(lines)
    label_sources = current_label_sources(lines, {c: r.label_source for c, r in table.items()})
    if paths.cells.exists():
        for folder in paths.cells.iterdir():
            if folder.is_dir() and folder.name not in CELL_FOLDERS:
                raise ValueError(f"{folder} is not a known cell folder")
    rows = []
    seen: set[str] = set()
    for path in sorted(paths.cells.glob("*/*.png")):
        cell_id = pixel_id(path)
        if path.stem != stem_of(cell_id):
            raise ValueError(f"{path} is not named after its pixels ({stem_of(cell_id)})")
        if cell_id in seen:
            raise ValueError(f"{path} has the same pixels as another cell ({stem_of(cell_id)})")
        seen.add(cell_id)
        digit = path.parent.name
        rows.append(
            CellRow(
                cell_id,
                digit,
                _kind_column(cell_id, digit, kinds.get(cell_id)),
                sources.get(cell_id),
                "verified" if cell_id in confirmed else label_sources.get(cell_id, ""),
            )
        )
    write_cells(paths.cells_csv, rows)
    return len(rows)


def repair_lines(
    folder: dict[str, str], kinds: dict[str, str | None], t: str, session: str
) -> list[Line]:
    """Lines that drop the kind of each cell in empty/, unlabeled/ or discarded/. A stop between
    the file move and the journal line leaves one, and so does `just relabel`. The folder is the
    truth for the digit. The lines carry their own session, so undo and rollback never reverse
    them."""
    action = Action(t, session, f"{session}-1")
    return [
        action.kind(cell, kinds[cell], None, Screen.REPAIR)
        for cell, where in sorted(folder.items())
        if where in NO_KIND_FOLDERS and kinds.get(cell) is not None
    ]


def repair_and_write(
    paths: DataPaths, now: datetime | None = None, forget_missing: bool = False
) -> int:
    """`just dataset-manifest`: repair the kinds of moved cells, then fold the journal."""
    moment = now or datetime.now(UTC)
    table = read_cells(paths.cells_csv)
    check_image_store(paths, table, forget_missing)
    kinds = current_kinds(read_journal(paths.journal), base_kinds(table))
    folder = {pixel_id(p): p.parent.name for p in paths.cells.glob("*/*.png")}
    session = f"{moment.astimezone(UTC):%Y%m%d-%H%M%S}-repair"
    lines = repair_lines(folder, kinds, format_time(moment), session)
    if lines:
        append_records(paths.journal, lines)
    return write_cells_manifest(paths, forget_missing)


def main(argv: list[str], paths: DataPaths | None = None) -> int:
    parser = argparse.ArgumentParser(prog="just dataset-manifest")
    parser.add_argument(
        "--forget-missing",
        action="store_true",
        help="drop the rows of cells whose file is gone. The page and Finish never do this.",
    )
    args = parser.parse_args(argv)
    try:
        print(repair_and_write(paths or DataPaths.under(), forget_missing=args.forget_missing))
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

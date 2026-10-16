"""The cells table `ml/dataset/cells.csv` (ADR-018): one row per cell image, with its digit, its
kind and its source. The folder of a cell is its digit. The kinds and the sources come from the
table itself with the journal applied on top."""

import argparse
import csv
import hashlib
import io
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.dataset import FULL_ID, RESTORE
from sudoku_ml.journal import (
    KINDS,
    Line,
    Source,
    append_records,
    current_kinds,
    current_sources,
    format_time,
    read_journal,
)

# Training reads only DIGIT_CLASSES. `unlabeled` waits for a digit. `discarded` holds cells that
# a person rejected in the digit pass: bad cuts, unreadable marks.
CELL_FOLDERS = (*DIGIT_CLASSES, "unlabeled", "discarded")
NO_KIND_FOLDERS = ("empty", "unlabeled", "discarded")
CELL_FIELDS = ["cell_id", "digit", "kind", "photo_id", "row", "col"]
UNCHANGED = "Check SUDOKU_IMAGES or restore the images. The table was not changed."


@dataclass(frozen=True)
class CellRow:
    cell_id: str
    digit: str
    kind: str | None
    source: Source | None


def pixel_id(path: Path) -> str:
    """SHA-256 of `<width>x<height>` followed by the RGB pixel bytes (see ml/README.md)."""
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        digest = hashlib.sha256(f"{rgb.width}x{rgb.height}".encode())
        digest.update(rgb.tobytes())
    return digest.hexdigest()


def write_atomic(path: Path, text: str) -> None:
    """Write beside the target, then replace it. A stop never leaves half a file (ADR-009)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_name(path.name + ".part")
    with part.open("w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    part.replace(path)


def csv_text(fields: list[str], rows: list) -> str:
    """CSV with a header row and `\\n` line ends, so that diffs stay small on every system.
    `rows` holds lists, or dicts with the keys of `fields`."""
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(fields)
    for row in rows:
        writer.writerow([row[f] for f in fields] if isinstance(row, dict) else row)
    return buffer.getvalue()


def warn_unreadable(path: Path, error: Exception) -> None:
    print(f"{path.name} cannot be read ({error}). Treated as missing.", file=sys.stderr)


def parse_cell_source(photo_id: str, row: str, col: str) -> Source | None:
    """The source columns of one row. Raises ValueError unless all three are set or all three
    are empty, and row and col are 0-8."""
    if not (photo_id or row or col):
        return None
    if not (photo_id and row and col):
        raise ValueError("photo_id, row and col must all be set or all be empty")
    if not FULL_ID.fullmatch(photo_id):
        raise ValueError(f"{photo_id!r} is not a photo id")
    source = (photo_id, int(row), int(col))
    if not (0 <= source[1] <= 8 and 0 <= source[2] <= 8):
        raise ValueError("row and col must be 0-8")
    return source


def read_cells_table(path: Path) -> dict[str, CellRow]:
    """Full cell id → its row. A missing file is empty.

    Raises ValueError when the file does not parse: it is the base of the kinds and the sources,
    so a rebuild from the folders would lose them."""
    if not path.exists():
        return {}
    found: dict[str, CellRow] = {}
    try:
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle, strict=True)
            if reader.fieldnames != CELL_FIELDS:
                raise ValueError(f"the header is not {','.join(CELL_FIELDS)}")
            for row in reader:
                try:
                    if not FULL_ID.fullmatch(row["cell_id"] or ""):
                        raise ValueError(f"{row['cell_id']!r} is not a cell id")
                    if row["kind"] and row["kind"] not in KINDS:
                        raise ValueError(f"unknown kind {row['kind']!r}")
                    source = parse_cell_source(row["photo_id"], row["row"], row["col"])
                except (ValueError, TypeError) as error:
                    raise ValueError(f"line {reader.line_num}: {error}") from error
                found[row["cell_id"]] = CellRow(
                    row["cell_id"], row["digit"], row["kind"] or None, source
                )
    except (OSError, csv.Error, UnicodeDecodeError, ValueError) as error:
        raise ValueError(f"{path.name} cannot be read ({error}). {RESTORE}") from error
    return found


def base_kinds(table: dict[str, CellRow]) -> dict[str, str | None]:
    return {c: r.kind for c, r in table.items() if r.kind is not None}


def base_sources(table: dict[str, CellRow]) -> dict[str, Source]:
    return {c: r.source for c, r in table.items() if r.source is not None}


def _kind_column(cell_id: str, digit: str, kind: str | None) -> str:
    if digit == "empty" and kind is not None:
        raise ValueError(f"{cell_id[:16]}: an empty cell has the kind {kind}")
    if digit in NO_KIND_FOLDERS:
        return ""
    return kind or ""


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
    gone = sorted(c for c in table if c[:16] not in on_disk)
    if gone:
        raise ValueError(
            f"{len(gone)} of {len(table)} rows of {paths.cells_csv.name} have no file in "
            f"{paths.cells}, e.g. {gone[0][:16]}. {UNCHANGED} To drop these rows, run: "
            "just dataset-manifest --forget-missing"
        )


def write_cells_manifest(paths: DataPaths, forget_missing: bool = False) -> int:
    """Fold the journal into cells.csv: one row per cell file. The folder is the digit.

    Raises ValueError on a missing or wrong image store (see check_image_store), an unknown
    folder, a misnamed file, a duplicate id, a kind on an empty cell, or a cells.csv that does
    not parse."""
    table = read_cells_table(paths.cells_csv)
    check_image_store(paths, table, forget_missing)
    lines = read_journal(paths.journal)
    kinds = current_kinds(lines, base_kinds(table))
    sources = current_sources(lines, base_sources(table))
    if paths.cells.exists():
        for folder in paths.cells.iterdir():
            if folder.is_dir() and folder.name not in CELL_FOLDERS:
                raise ValueError(f"{folder} is not a known cell folder")
    rows = []
    seen: set[str] = set()
    for path in sorted(paths.cells.glob("*/*.png")):
        cell_id = pixel_id(path)
        if path.stem != cell_id[:16]:
            raise ValueError(f"{path} is not named after its pixels ({cell_id[:16]})")
        if cell_id in seen:
            raise ValueError(f"{path} has the same pixels as another cell ({cell_id[:16]})")
        seen.add(cell_id)
        digit = path.parent.name
        source = sources.get(cell_id)
        rows.append(
            [
                cell_id,
                digit,
                _kind_column(cell_id, digit, kinds.get(cell_id)),
                *(source if source else ("", "", "")),
            ]
        )
    rows.sort(key=lambda row: (row[1], row[0]))
    write_atomic(paths.cells_csv, csv_text(CELL_FIELDS, rows))
    return len(rows)


def repair_lines(
    folder: dict[str, str], kinds: dict[str, str | None], t: str, session: str
) -> list[Line]:
    """Lines that drop the kind of each cell in empty/, unlabeled/ or discarded/. A stop between
    the file move and the journal line leaves one, and so does `just relabel`. The folder is the
    truth for the digit. The lines carry their own session, so undo and rollback never reverse
    them."""
    return [
        Line(t, session, f"{session}-1", cell, "kind", kinds[cell], None, "repair")
        for cell, where in sorted(folder.items())
        if where in NO_KIND_FOLDERS and kinds.get(cell) is not None
    ]


def repair_and_write(
    paths: DataPaths, now: datetime | None = None, forget_missing: bool = False
) -> int:
    """`just dataset-manifest`: repair the kinds of moved cells, then fold the journal."""
    moment = now or datetime.now(UTC)
    table = read_cells_table(paths.cells_csv)
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

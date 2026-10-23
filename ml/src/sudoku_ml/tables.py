"""The two tables of the real dataset (ADR-018): `ml/dataset/cells.csv` and
`ml/dataset/sudoku-photos.csv`. This module is the only one that opens them. It owns the typed rows,
the validated readers and writers, the cell id rule and the atomic write. Column order and file
format never change here without an ADR."""

import csv
import hashlib
import io
import json
import re
import sys
from collections.abc import Callable, Iterable
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from pillow_heif import register_heif_opener

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.journal import KINDS, Source

# A sudoku photo can be HEIC, and its id is the pixel id of the decoded image.
register_heif_opener()

FULL_ID = re.compile(r"[0-9a-f]{64}")
STEM_LENGTH = 16  # a file is named after the first 16 characters of its id
RESTORE = "Restore it from git."

# Training reads only DIGIT_CLASSES. `unlabeled` waits for a digit. `discarded` holds cells that
# a person rejected in the digit pass: bad cuts, unreadable marks.
CELL_FOLDERS = (*DIGIT_CLASSES, "unlabeled", "discarded")
DIGIT_FOLDERS = tuple(str(d) for d in range(1, 10))
NO_KIND_FOLDERS = ("empty", "unlabeled", "discarded")

CELL_FIELDS = ["cell_id", "digit", "kind", "photo_id", "row", "col", "label_source"]
# Empty for a cell that predates the column: it counts as trusted, like `verified`.
LABEL_SOURCES = ("app-edited", "app-unedited", "verified")
# The labels that training uses: a person checked them. Empty is a legacy cell without a scan.
TRUSTED_LABEL_SOURCES = ("", "verified")

PHOTO_SOURCES = ("phone", "web", "wicht", "openverse", "commons", "lexski", "app-scan")
APP_SCAN = "app-scan"
LICENCES = (
    "none",
    "own",
    "unverified",
    "cc0",
    "pdm",
    "by",
    "by-sa",
    "by-nc",
    "by-nc-sa",
    "by-nd",
    "by-nc-nd",
    "player-contributed",
)
# `unchecked`: an uploaded scan whose outline no person has checked. It has corners, as `accepted`.
PHOTO_STATUSES = ("pending", "accepted", "rejected", "too-few-cells", "legacy", "unchecked")
CORNER_STATUSES = ("accepted", "unchecked")
PHOTO_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp", ".heic")


@dataclass(frozen=True)
class CellRow:
    cell_id: str  # full pixel id
    digit: str  # the folder of the cell
    kind: str | None  # one of KINDS. None for a cell without a kind
    source: Source | None
    label_source: str = ""  # one of LABEL_SOURCES, or empty


@dataclass(frozen=True)
class PhotoRow:
    photo_id: str
    file: str
    source: str
    licence: str
    attribution: str
    status: str
    corners: str  # `x1 y1 ... x4 y4`, see format_corners. Empty unless in CORNER_STATUSES


PHOTO_FIELDS = [f.name for f in fields(PhotoRow)]


def stem_of(cell_id: str) -> str:
    return cell_id[:STEM_LENGTH]


def _digest(width: int, height: int, pixels: bytes) -> str:
    digest = hashlib.sha256(f"{width}x{height}".encode())
    digest.update(pixels)
    return digest.hexdigest()


def pixel_id(path: Path) -> str:
    """SHA-256 of `<width>x<height>` followed by the RGB pixel bytes (see ml/README.md)."""
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        return _digest(rgb.width, rgb.height, rgb.tobytes())


def pixel_id_of(image: np.ndarray) -> str:
    """The pixel id of an (H, W, 3) uint8 RGB array: the same as `pixel_id` of its PNG."""
    return _digest(image.shape[1], image.shape[0], image.tobytes())


def format_corners(corners: list[list[float]]) -> str:
    """4 [x, y] pairs (TL, TR, BR, BL) → `x1 y1 x2 y2 x3 y3 x4 y4`, one decimal."""
    return " ".join(f"{value:.1f}" for point in corners for value in point)


def parse_corners(text: str) -> list[list[float]]:
    """The inverse of format_corners. Raises ValueError unless there are 8 numbers."""
    values = [float(v) for v in text.split()]
    if len(values) != 8:
        raise ValueError(f"corners need 8 numbers, not {len(values)}")
    return [values[i : i + 2] for i in range(0, 8, 2)]


def write_atomic(path: Path, text: str) -> None:
    """Write beside the target, then replace it. A stop never leaves half a file (ADR-009)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_name(path.name + ".part")
    with part.open("w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    part.replace(path)


def write_cell_image(image: np.ndarray, folder: Path, stem: str, tmp_dir: Path) -> None:
    """Save the cell as `folder/<stem>.png`. The picture lands in `tmp_dir` first and a rename
    moves it in: a stop never leaves a misnamed cell in a cell folder (ADR-009)."""
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp = tmp_dir / f"{stem}.png"
    Image.fromarray(image).save(tmp, "PNG")
    folder.mkdir(parents=True, exist_ok=True)
    tmp.replace(folder / f"{stem}.png")


def warn_unreadable(path: Path, error: Exception) -> None:
    print(f"{path.name} cannot be read ({error}). Treated as missing.", file=sys.stderr)


def read_derived(path: Path, warn: bool = False) -> Any | None:
    """The JSON of a derived file, or None when the file is missing or does not parse. A derived
    file is safe to delete: a broken one only costs a new computation. With `warn`, a broken
    file prints a note. A missing file is silent."""
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as error:
        if warn:
            warn_unreadable(path, error)
        return None


def _csv_text(header: list[str], rows: Iterable[list[str]]) -> str:
    """CSV with a header row and `\\n` line ends, so that diffs stay small on every system."""
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


def _read[T](path: Path, header: list[str], parse: Callable[[dict[str, str]], T]) -> list[T]:
    """The rows of a table in file order. A missing file is empty. Raises ValueError when the file
    does not parse: a table is the base of the labels, so a rebuild from the images would lose
    them."""
    if not path.exists():
        return []
    rows = []
    try:
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle, strict=True)
            if reader.fieldnames != header:
                raise ValueError(f"the header is not {','.join(header)}")
            for record in reader:
                try:
                    rows.append(parse({f: record[f] or "" for f in header}))
                except (ValueError, TypeError) as error:
                    raise ValueError(f"line {reader.line_num}: {error}") from error
    except (OSError, csv.Error, UnicodeDecodeError, ValueError) as error:
        raise ValueError(f"{path.name} cannot be read ({error}). {RESTORE}") from error
    return rows


def _check_cell_id(cell_id: str) -> None:
    if not FULL_ID.fullmatch(cell_id):
        raise ValueError(f"{cell_id!r} is not a cell id")


def _check_kind(kind: str) -> None:
    if kind and kind not in KINDS:
        raise ValueError(f"unknown kind {kind!r}")


def _check_label_source(label_source: str) -> None:
    if label_source and label_source not in LABEL_SOURCES:
        raise ValueError(f"unknown label_source {label_source!r}")


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


def _cell_row(record: dict[str, str]) -> CellRow:
    _check_cell_id(record["cell_id"])
    _check_kind(record["kind"])
    source = parse_cell_source(record["photo_id"], record["row"], record["col"])
    _check_label_source(record["label_source"])
    return CellRow(
        record["cell_id"], record["digit"], record["kind"] or None, source, record["label_source"]
    )


def read_cells(path: Path) -> dict[str, CellRow]:
    """Full cell id → its row, in file order. A missing file is empty. Raises ValueError when
    the file does not parse, a row breaks the rules of the columns or an id is twice."""
    found: dict[str, CellRow] = {}
    for row in _read(path, CELL_FIELDS, _cell_row):
        if row.cell_id in found:
            raise ValueError(
                f"{path.name} cannot be read ({stem_of(row.cell_id)} is twice). {RESTORE}"
            )
        found[row.cell_id] = row
    return found


def write_cells(path: Path, rows: Iterable[CellRow]) -> None:
    """Replace the file in one step. The rows are sorted by digit, then id. Raises ValueError,
    before it writes, for a row that the reader would refuse or an id that is twice."""
    columns = []
    seen: set[str] = set()
    for row in rows:
        _check_cell_id(row.cell_id)
        if row.cell_id in seen:
            raise ValueError(f"{stem_of(row.cell_id)} is twice in the rows of cells.csv")
        seen.add(row.cell_id)
        _check_kind(row.kind or "")
        _check_label_source(row.label_source)
        source = ("", "", "")
        if row.source is not None:
            source = (row.source[0], str(row.source[1]), str(row.source[2]))
            parse_cell_source(*source)
        columns.append([row.cell_id, row.digit, row.kind or "", *source, row.label_source])
    columns.sort(key=lambda c: (c[1], c[0]))
    write_atomic(path, _csv_text(CELL_FIELDS, columns))


@dataclass(frozen=True)
class CellsAudit:
    """What the data check needs from cells.csv. Every list holds cell ids, except `bad_id`."""

    rows: dict[str, CellRow]  # the first row of each valid id. A bad kind or source is None
    bad_id: list[str]  # the values that are not a cell id
    twice: list[str]
    bad_kind: list[str]  # unknown kind, or a kind on a cell in `NO_KIND_FOLDERS`
    bad_source: list[str]
    bad_label_source: list[str]
    unreadable: str | None = None  # the header or the file does not parse


def audit_cells(path: Path) -> CellsAudit:
    """Read cells.csv without stopping at the first bad row, for the data check. It applies the
    rules of `read_cells`, and one more: an empty, waiting or discarded cell has no kind."""
    try:
        records = _read(path, CELL_FIELDS, dict)
    except ValueError as error:
        return CellsAudit({}, [], [], [], [], [], str(error))
    rows: dict[str, CellRow] = {}
    bad_id, twice, bad_kind, bad_source, bad_label_source = [], [], [], [], []
    for record in records:
        cell = record["cell_id"]
        if not FULL_ID.fullmatch(cell):
            bad_id.append(cell)
            continue
        if cell in rows:
            twice.append(cell)
            continue
        kind, label_source = record["kind"] or None, record["label_source"]
        if (kind and kind not in KINDS) or (kind and record["digit"] in NO_KIND_FOLDERS):
            bad_kind.append(cell)
            kind = None
        if label_source and label_source not in LABEL_SOURCES:
            bad_label_source.append(cell)
            label_source = ""
        try:
            source = parse_cell_source(record["photo_id"], record["row"], record["col"])
        except ValueError:
            bad_source.append(cell)
            source = None
        rows[cell] = CellRow(cell, record["digit"], kind, source, label_source)
    return CellsAudit(rows, bad_id, twice, bad_kind, bad_source, bad_label_source)


def read_photos(path: Path) -> list[PhotoRow]:
    """The rows of sudoku-photos.csv in file order: the import order. A missing file is empty.
    Raises ValueError when the file does not parse. The values are not checked: the data check
    reports them, with `photo_row_problems`."""
    return _read(path, PHOTO_FIELDS, lambda record: PhotoRow(**record))


def write_photos(path: Path, rows: Iterable[PhotoRow]) -> None:
    """Replace the file in one step. The rows keep their order, so an import appends rows."""
    write_atomic(
        path, _csv_text(PHOTO_FIELDS, ([getattr(r, f) for f in PHOTO_FIELDS] for r in rows))
    )


def photo_row_problems(row: PhotoRow) -> list[str]:
    """The rules of the value columns of one photo row. Empty when the row is sound."""
    found = []
    if row.source not in PHOTO_SOURCES:
        found.append(f"unknown source {row.source!r}")
    if row.licence not in LICENCES:
        found.append(f"unknown licence {row.licence!r}")
    if row.status not in PHOTO_STATUSES:
        found.append(f"unknown status {row.status!r}")
    if row.status in CORNER_STATUSES:
        try:
            parse_corners(row.corners)
        except ValueError:
            found.append(f"{row.status} without 4 corners")
    elif row.corners:
        found.append(f"corners on a {row.status} photo")
    return found

"""Copy a folder of sudoku photos into `<images>/sudoku-photos/` and propose a grid outline for
each (ADR-018). The import adds a `pending` row to `data/sudoku-photos.csv`. The Photos screen of
the labelling page then checks each sudoku photo."""

import argparse
import csv
import json
import shutil
import sys
from pathlib import Path

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.flatten import load_upright
from sudoku_ml.grid_detect import find_grid
from sudoku_ml.manifest import RESTORE, csv_text, pixel_id, warn_unreadable, write_atomic

SOURCES = ("phone", "web", "wicht", "openverse", "commons", "lexski")
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
)
PHOTO_FIELDS = ["photo_id", "file", "source", "licence", "attribution", "status", "corners"]
PHOTO_STATUSES = ("pending", "accepted", "rejected", "too-few-cells", "legacy")
PHOTO_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp", ".heic")


def format_corners(corners: list[list[float]]) -> str:
    """4 [x, y] pairs (TL, TR, BR, BL) → `x1 y1 x2 y2 x3 y3 x4 y4`, one decimal."""
    return " ".join(f"{value:.1f}" for point in corners for value in point)


def parse_corners(text: str) -> list[list[float]]:
    """The inverse of format_corners. Raises ValueError unless there are 8 numbers."""
    values = [float(v) for v in text.split()]
    if len(values) != 8:
        raise ValueError(f"corners need 8 numbers, not {len(values)}")
    return [values[i : i + 2] for i in range(0, 8, 2)]


def read_photos(path: Path) -> list[dict[str, str]]:
    """The rows of sudoku-photos.csv in file order: the import order. Raises ValueError when the
    file does not parse."""
    if not path.exists():
        return []
    try:
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle, strict=True)
            if reader.fieldnames != PHOTO_FIELDS:
                raise ValueError(f"the header is not {','.join(PHOTO_FIELDS)}")
            return [{f: row[f] or "" for f in PHOTO_FIELDS} for row in reader]
    except (OSError, csv.Error, UnicodeDecodeError, ValueError) as error:
        raise ValueError(f"{path.name} cannot be read ({error}). {RESTORE}") from error


def write_photos(path: Path, rows: list[dict[str, str]]) -> None:
    """Replace the file in one step. The rows keep their order, so an import appends rows."""
    write_atomic(path, csv_text(PHOTO_FIELDS, rows))


def read_detections(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    try:
        found = json.loads(path.read_text())
    except (OSError, ValueError) as error:
        warn_unreadable(path, error)
        return {}
    return found if isinstance(found, dict) else {}


def write_detections(path: Path, detections: dict[str, dict]) -> None:
    """Replace the file in one step: a stop in the middle must not leave half a file."""
    write_atomic(path, json.dumps(detections))


def detect_outline(rgb) -> dict:
    found = find_grid(rgb)
    return {
        "corners": found.corners,
        "lines": found.lines,
        "reason": found.reason,
        "width": int(rgb.shape[1]),
        "height": int(rgb.shape[0]),
    }


def _scraper_sources(folder: Path) -> dict[str, dict[str, str]]:
    """File name → source, licence and attribution, from a manifest.jsonl of the scraper."""
    for candidate in (folder / "manifest.jsonl", folder.parent / "manifest.jsonl"):
        if candidate.exists():
            sources = {}
            for text in candidate.read_text(encoding="utf-8").splitlines():
                if not text.strip():
                    continue
                entry = json.loads(text)
                if entry.get("file"):
                    sources[entry["file"]] = {
                        "source": str(entry.get("source", "")).split("/")[0],
                        "licence": entry.get("licence") or "",
                        "attribution": entry.get("attribution") or "",
                    }
            return sources
    return {}


def import_folder(
    folder: Path, paths: DataPaths, source: str | None, licence: str | None
) -> dict[str, int]:
    """Copy each new photo of `folder` (not its subfolders) and store its proposed outline."""
    sources = _scraper_sources(folder)
    rows = read_photos(paths.photos_csv)
    known = {r["photo_id"] for r in rows}
    detections = read_detections(paths.detections)
    counts = dict.fromkeys(("imported", "already", "unreadable", "no_source"), 0)
    for path in sorted(folder.iterdir()):
        if not path.is_file() or path.suffix.lower() not in PHOTO_SUFFIXES:
            continue
        found = sources.get(path.name) or {
            "source": source or "",
            "licence": licence or "",
            "attribution": "",
        }
        if found["source"] not in SOURCES or found["licence"] not in LICENCES:
            print(f"skip {path.name}: no known source and licence", file=sys.stderr)
            counts["no_source"] += 1
            continue
        try:
            photo_id = pixel_id(path)
        except (OSError, ValueError) as error:
            print(f"skip {path.name}: cannot read it ({error})", file=sys.stderr)
            counts["unreadable"] += 1
            continue
        if photo_id in known:
            counts["already"] += 1
            continue
        paths.photos.mkdir(parents=True, exist_ok=True)
        stored = paths.photos / f"{photo_id[:16]}{path.suffix.lower()}"
        shutil.copy2(path, stored)
        rgb = load_upright(stored)
        detections[photo_id] = detect_outline(rgb)
        rows.append(
            {"photo_id": photo_id, "file": stored.name, **found, "status": "pending", "corners": ""}
        )
        known.add(photo_id)
        counts["imported"] += 1
        # Write after each photo: a crash then loses at most the photo in progress.
        write_photos(paths.photos_csv, rows)
        write_detections(paths.detections, detections)
    return counts


def main(argv: list[str], paths: DataPaths | None = None) -> int:
    parser = argparse.ArgumentParser(prog="just import-photos")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--source", choices=SOURCES)
    parser.add_argument("--licence", choices=LICENCES)
    args = parser.parse_args(argv)
    paths = paths or DataPaths.under()
    counts = import_folder(args.folder, paths, args.source, args.licence)
    print(", ".join(f"{name}: {value}" for name, value in counts.items()))
    print("Next: run just label-cells and check the sudoku photos on the Photos screen.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

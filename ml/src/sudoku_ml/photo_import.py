"""Copy a folder of sudoku photos into ml/data/photos/ and propose a grid outline for each
(ADR-009, amendment of 2026-10-12). The Photos screen of the labelling page then checks them."""

import argparse
import csv
import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

from sudoku_ml.flatten import load_upright
from sudoku_ml.grid_detect import find_grid
from sudoku_ml.manifest import pixel_id

ORIGINS = ("phone", "web", "wicht", "openverse", "commons", "lexski")
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
PHOTO_FIELDS = ["id", "file", "origin", "licence", "attribution"]
PHOTO_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp", ".heic")
ML_ROOT = Path(__file__).parents[2]


@dataclass(frozen=True)
class PhotoPaths:
    photos: Path
    manifest: Path  # photos.csv
    detections: Path
    checks: Path  # photo-checks.jsonl
    origins: Path  # cell-origins.csv
    cells: Path

    @classmethod
    def under(cls, ml_root: Path) -> "PhotoPaths":
        data, datasets = ml_root / "data", ml_root / "datasets"
        return cls(
            data / "photos",
            datasets / "photos.csv",
            data / "import" / "detections.json",
            datasets / "photo-checks.jsonl",
            datasets / "cell-origins.csv",
            data / "cells",
        )


def read_photos(manifest: Path) -> list[dict[str, str]]:
    """The rows of photos.csv in file order. Rows from before the licence column get `none`."""
    if not manifest.exists():
        return []
    with manifest.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    return [
        {
            "id": r["id"],
            "file": r["file"],
            "origin": r["origin"],
            "licence": r.get("licence") or "none",
            "attribution": r.get("attribution") or "",
        }
        for r in rows
    ]


def write_photos(manifest: Path, rows: list[dict[str, str]]) -> None:
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=PHOTO_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def read_detections(path: Path) -> dict[str, dict]:
    return json.loads(path.read_text()) if path.exists() else {}


def _scraper_sources(folder: Path) -> dict[str, dict[str, str]]:
    """File name → origin, licence and attribution, from a manifest.jsonl of the scraper."""
    for candidate in (folder / "manifest.jsonl", folder.parent / "manifest.jsonl"):
        if candidate.exists():
            sources = {}
            for text in candidate.read_text(encoding="utf-8").splitlines():
                if not text.strip():
                    continue
                entry = json.loads(text)
                if entry.get("file"):
                    sources[entry["file"]] = {
                        "origin": str(entry.get("source", "")).split("/")[0],
                        "licence": entry.get("licence") or "",
                        "attribution": entry.get("attribution") or "",
                    }
            return sources
    return {}


def import_folder(
    folder: Path, paths: PhotoPaths, origin: str | None, licence: str | None
) -> dict[str, int]:
    """Copy each new photo of `folder` (not its subfolders) and store its proposed outline."""
    sources = _scraper_sources(folder)
    rows = read_photos(paths.manifest)
    known = {r["id"] for r in rows}
    detections = read_detections(paths.detections)
    counts = dict.fromkeys(("imported", "already", "unreadable", "no_source"), 0)
    for path in sorted(folder.iterdir()):
        if not path.is_file() or path.suffix.lower() not in PHOTO_SUFFIXES:
            continue
        source = sources.get(path.name) or {
            "origin": origin or "",
            "licence": licence or "",
            "attribution": "",
        }
        if source["origin"] not in ORIGINS or source["licence"] not in LICENCES:
            print(f"skip {path.name}: no known origin and licence", file=sys.stderr)
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
        found = find_grid(rgb)
        detections[photo_id] = {
            "corners": found.corners,
            "lines": found.lines,
            "reason": found.reason,
            "width": int(rgb.shape[1]),
            "height": int(rgb.shape[0]),
        }
        rows.append({"id": photo_id, "file": stored.name, **source})
        known.add(photo_id)
        counts["imported"] += 1
        # Write after each photo: a crash then loses at most the photo in progress.
        write_photos(paths.manifest, rows)
        paths.detections.parent.mkdir(parents=True, exist_ok=True)
        paths.detections.write_text(json.dumps(detections))
    return counts


def main(argv: list[str], ml_root: Path = ML_ROOT) -> int:
    parser = argparse.ArgumentParser(prog="just import-photos")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--origin", choices=ORIGINS)
    parser.add_argument("--licence", choices=LICENCES)
    args = parser.parse_args(argv)
    counts = import_folder(args.folder, PhotoPaths.under(ml_root), args.origin, args.licence)
    print(", ".join(f"{name}: {value}" for name, value in counts.items()))
    print("Next: run just label-cells and open the Photos screen.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

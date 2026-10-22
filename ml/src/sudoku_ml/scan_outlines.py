"""The outline check of uploaded scans (ADR-030, amendment 2026-10-22): the fit score of an
outline, its cache in `ml/dataset/work/outline-scores.json`, the cut of a scan, and the one-time
reset of the scans that a pull stored as `accepted`."""

import json
import sys
from dataclasses import replace
from pathlib import Path

import cv2
import numpy as np

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.flatten import check_corners, slice_cells, warp_grid
from sudoku_ml.grid_detect import line_fit
from sudoku_ml.journal import read_journal
from sudoku_ml.tables import (
    APP_SCAN,
    parse_corners,
    pixel_id_of,
    read_photos,
    write_atomic,
    write_photos,
)


def outline_fit(rgb: np.ndarray, corners: str) -> float:
    """line_fit of the grid that `corners` (format_corners text) cut from an upright photo."""
    flat = warp_grid(rgb, check_corners(parse_corners(corners)))
    return line_fit(cv2.cvtColor(flat, cv2.COLOR_RGB2GRAY))


def cut(rgb: np.ndarray, corners: str) -> list[tuple[np.ndarray, str]]:
    """The 81 cells of an upright photo, row by row: (image, full pixel id). The same cut as
    `just pull-scans`."""
    flat = warp_grid(rgb, check_corners(parse_corners(corners)))
    return [(image, pixel_id_of(image)) for image in slice_cells(flat)]


def read_scores(path: Path) -> dict[str, dict]:
    """Photo id → {"corners", "fit"}. A missing or broken file is empty: it is derived."""
    try:
        return json.loads(path.read_text())["photos"]
    except (OSError, ValueError, KeyError, TypeError):
        return {}


def write_scores(path: Path, scores: dict[str, dict]) -> None:
    write_atomic(path, json.dumps({"photos": scores}, indent=1, sort_keys=True))


def reset_outlines(paths: DataPaths) -> int:
    """Set each `app-scan` photo with the status `accepted` back to `unchecked`. Returns the number
    of rows changed. Raises ValueError while the journal holds an outline line: the reset would
    undo that unfinished check."""
    if any(line.field == "outline" for line in read_journal(paths.journal)):
        raise ValueError("The journal holds unfinished outline checks. Press Finish first.")
    rows = read_photos(paths.photos_csv)
    changed = [r.source == APP_SCAN and r.status == "accepted" for r in rows]
    if any(changed):
        write_photos(
            paths.photos_csv,
            [
                replace(r, status="unchecked") if c else r
                for r, c in zip(rows, changed, strict=True)
            ],
        )
    return sum(changed)


def main(paths: DataPaths | None = None) -> int:
    try:
        count = reset_outlines(paths or DataPaths.under())
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    print(
        f"Set {count} uploaded scans to unchecked. Check them in the Outlines step of "
        "just label-cells."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

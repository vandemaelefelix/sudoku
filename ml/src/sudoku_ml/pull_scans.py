"""Pull the scans that players uploaded (ADR-030). Each scan with `gsiPending` becomes one photo
row in `sudoku-photos.csv` with the status `unchecked`, and 81 cell images in `<images>/cells/`,
with the label provenance `app-edited` or `app-unedited`. The record is checked against
shared/scan-contract/ (SUD-07)."""

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path
from typing import Protocol

import jsonschema
import numpy as np
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES, is_valid_pair
from sudoku_ml.data_paths import REPO_ROOT, DataPaths
from sudoku_ml.flatten import GRID_CELLS, check_corners, load_upright, slice_cells, warp_grid
from sudoku_ml.tables import (
    APP_SCAN,
    NO_KIND_FOLDERS,
    CellRow,
    PhotoRow,
    format_corners,
    pixel_id,
    pixel_id_of,
    read_cells,
    read_photos,
    stem_of,
    write_cells,
    write_photos,
)

SCHEMA = REPO_ROOT / "shared" / "scan-contract" / "scan-record.schema.json"
FIXTURE_RECORDS = REPO_ROOT / "shared" / "fixtures" / "scan-records"
PROFILE = "sudoku"  # the personal AWS account only (ADR-027)
LICENCE = "player-contributed"
SUM_TOLERANCE = 1e-3


class ScanTable(Protocol):
    def pending(self) -> list[dict]:
        """The items with gsiPending, oldest first."""

    def clear_pending(self, pk: str, sk: str) -> None:
        """Remove gsiPending from one item."""


class ScanBucket(Protocol):
    def get(self, key: str) -> bytes | None:
        """The object, or None when it does not exist."""


def _plain(value):
    """DynamoDB numbers arrive as Decimal. JSON Schema and numpy need float and int."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    return value


def check_record(item: dict) -> dict:
    """The scan record of a table item. Raises ValueError when it breaks the contract."""
    keys = json.loads(SCHEMA.read_text())["required"]
    record = _plain({k: item[k] for k in keys if k in item})
    try:
        jsonschema.validate(record, json.loads(SCHEMA.read_text()))
    except jsonschema.ValidationError as error:
        raise ValueError(error.message) from error
    for cell in record["cells"]:
        for probs in (cell["digitProbs"], cell["kindProbs"]):
            if abs(sum(probs) - 1) > SUM_TOLERANCE:
                raise ValueError("a probability list does not sum to 1")
    return record


def fixture_scan_ids() -> set[str]:
    """SUD-10: the ids of the fixture records must never become training cells."""
    if not FIXTURE_RECORDS.is_dir():
        return set()
    ids = set()
    for path in FIXTURE_RECORDS.glob("*.json"):
        found = json.loads(path.read_text()).get("scanId")
        if isinstance(found, str):
            ids.add(found.lower())
    return ids


def _write_image(image: np.ndarray, path: Path, tmp: Path) -> None:
    """Cut outside cells/, then rename: a stop never leaves a misnamed cell (ADR-009)."""
    tmp.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(image).save(tmp, "PNG")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp.replace(path)


def _store_photo(jpeg: bytes, paths: DataPaths, scan_id: str) -> tuple[str, Path]:
    paths.tmp.mkdir(parents=True, exist_ok=True)
    part = paths.tmp / f"{scan_id}.jpg"
    part.write_bytes(jpeg)
    try:
        photo_id = pixel_id(part)
    except (OSError, ValueError) as error:
        part.unlink(missing_ok=True)
        raise ValueError(f"the photo cannot be read ({error})") from error
    paths.photos.mkdir(parents=True, exist_ok=True)
    stored = paths.photos / f"{stem_of(photo_id)}.jpg"
    part.replace(stored)
    return photo_id, stored


def _cell_rows(
    record: dict, photo_id: str, flat_cells: list[np.ndarray]
) -> list[tuple[CellRow, np.ndarray]]:
    """The new cells of one scan: (row of cells.csv, image). A cell with an impossible digit and
    kind pair is left out."""
    rows = []
    for index, (cell, image) in enumerate(zip(record["cells"], flat_cells, strict=True)):
        digit, kind = DIGIT_CLASSES[cell["finalDigit"]], KIND_CLASSES[cell["finalKind"]]
        if not is_valid_pair(digit, kind):
            continue
        row = CellRow(
            pixel_id_of(image),
            digit,
            None if digit in NO_KIND_FOLDERS else kind,
            (photo_id, index // GRID_CELLS, index % GRID_CELLS),
            "app-edited" if cell["edited"] else "app-unedited",
        )
        rows.append((row, image))
    return rows


def _add_cells(paths: DataPaths, rows: list[tuple[CellRow, np.ndarray]]) -> int:
    """Write the images, then add the rows to cells.csv. Returns the number of new rows."""
    table = read_cells(paths.cells_csv)
    on_disk = {p.stem for p in paths.cells.glob("*/*.png")}
    added = 0
    for row, image in rows:
        if row.cell_id in table:
            continue
        name = stem_of(row.cell_id)
        if name not in on_disk:
            target = paths.cells / row.digit / f"{name}.png"
            _write_image(image, target, paths.tmp / f"{name}.png")
        table[row.cell_id] = row
        added += 1
    write_cells(paths.cells_csv, table.values())
    return added


def _pull_one(item: dict, paths: DataPaths, bucket: ScanBucket, report: dict) -> bool:
    """Returns True when the item may lose gsiPending."""
    scan_id = str(item.get("scanId", ""))
    try:
        record = check_record(item)
    except ValueError as error:
        print(f"skip {scan_id}: {error}", file=sys.stderr)
        report["invalid"].append(scan_id)
        return False
    if scan_id.lower() in fixture_scan_ids():
        report["fixture"].append(scan_id)
        return False
    jpeg = bucket.get(f"scans/{scan_id}.jpg")
    if jpeg is None:
        report["missing_photo"].append(scan_id)
        return False
    try:
        photo_id, stored = _store_photo(jpeg, paths, scan_id)
        rgb = load_upright(stored)
        height, width = rgb.shape[:2]
        pixels = check_corners([[x * width, y * height] for x, y in record["corners"]])
    except (OSError, ValueError) as error:
        print(f"skip {scan_id}: {error}", file=sys.stderr)
        report["invalid"].append(scan_id)
        return False
    photos = read_photos(paths.photos_csv)
    cells = _cell_rows(record, photo_id, slice_cells(warp_grid(rgb, pixels)))
    report["cells"] += _add_cells(paths, cells)
    if any(p.photo_id == photo_id for p in photos):
        report["already_pulled"] += 1
        return True
    photos.append(
        PhotoRow(photo_id, stored.name, APP_SCAN, LICENCE, "", "unchecked", format_corners(pixels))
    )
    write_photos(paths.photos_csv, photos)
    report["pulled"] += 1
    return True


def pull_scans(paths: DataPaths, table: ScanTable, bucket: ScanBucket) -> dict:
    """Pull every pending scan. The row of cells.csv and the photo row come before the clear of
    gsiPending, so a stopped run repeats safely: the next run finds the photo and only clears."""
    report: dict = {"pulled": 0, "already_pulled": 0, "cells": 0}
    for name in ("invalid", "fixture", "missing_photo"):
        report[name] = []
    for item in table.pending():
        if _pull_one(item, paths, bucket, report):
            table.clear_pending(item["pk"], item["sk"])
    return report


class DynamoScans:
    def __init__(self, table):
        self._table = table

    def pending(self) -> list[dict]:
        from boto3.dynamodb.conditions import Key

        items, start = [], {}
        while True:
            page = self._table.query(
                IndexName="byPending",
                KeyConditionExpression=Key("gsiPending").eq("PENDING"),
                **start,
            )
            items += page["Items"]
            if "LastEvaluatedKey" not in page:
                return items
            start = {"ExclusiveStartKey": page["LastEvaluatedKey"]}

    def clear_pending(self, pk: str, sk: str) -> None:
        self._table.update_item(Key={"pk": pk, "sk": sk}, UpdateExpression="REMOVE gsiPending")


class S3Scans:
    def __init__(self, client, bucket: str):
        self._client, self._bucket = client, bucket

    def get(self, key: str) -> bytes | None:
        try:
            return self._client.get_object(Bucket=self._bucket, Key=key)["Body"].read()
        except self._client.exceptions.NoSuchKey:
            return None


def aws_clients(table_name: str, bucket_name: str) -> tuple[ScanTable, ScanBucket]:
    """Clients of the personal account. An explicit profile makes boto3 ignore AWS_* variables."""
    import boto3

    session = boto3.Session(profile_name=PROFILE)
    return (
        DynamoScans(session.resource("dynamodb").Table(table_name)),
        S3Scans(session.client("s3"), bucket_name),
    )


def main(argv: list[str], paths: DataPaths | None = None) -> int:
    parser = argparse.ArgumentParser(prog="just pull-scans")
    parser.add_argument("--table", required=True, help="the DynamoDB table of the stage")
    parser.add_argument("--bucket", required=True, help="the S3 bucket of the scans")
    args = parser.parse_args(argv)
    table, bucket = aws_clients(args.table, args.bucket)
    report = pull_scans(paths or DataPaths.under(), table, bucket)
    print(
        f"pulled: {report['pulled']}, cells: {report['cells']}, "
        f"already pulled: {report['already_pulled']}"
    )
    for name, label in (
        ("missing_photo", "no photo yet (stays pending)"),
        ("invalid", "invalid (stays pending)"),
        ("fixture", "fixture ids (SUD-10)"),
    ):
        if report[name]:
            print(f"{label}: {len(report[name])}, e.g. {report[name][0]}", file=sys.stderr)
    print(
        "Next: run just label-cells. Check each outline on the Outlines screen. Then press Finish."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

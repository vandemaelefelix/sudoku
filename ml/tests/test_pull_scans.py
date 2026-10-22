import hashlib
import io
import json
from dataclasses import replace
from decimal import Decimal
from pathlib import Path

import pytest
from photos import grid_photo
from PIL import Image

from sudoku_ml.data_check import check_data
from sudoku_ml.data_paths import REPO_ROOT, DataPaths
from sudoku_ml.dataset import load_cells, read_real_cells, split_cells
from sudoku_ml.pull_scans import main, pull_scans
from sudoku_ml.tables import read_cells, read_photos, write_photos

FIXTURES = REPO_ROOT / "shared" / "fixtures" / "scan-records"
SCAN_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SCAN_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
CONTRIBUTOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
CORNERS = [[0.2, 0.125], [0.74, 0.125], [0.74, 0.8], [0.2, 0.8]]


def jpeg(seed: int) -> bytes:
    out = io.BytesIO()
    Image.fromarray(grid_photo(seed=seed)).save(out, "JPEG", quality=95)
    return out.getvalue()


def record(scan_id: str, edited_cells: tuple[int, ...] = (), **changes) -> dict:
    """A scan record in DynamoDB form: numbers are Decimal, and the item has its keys."""
    cells = []
    for index in range(81):
        digit, kind = (0, 0) if index % 2 else (1 + index % 9, 1)
        digit_probs = [Decimal("0.01")] * 10
        digit_probs[digit] = Decimal("0.91")
        kind_probs = [Decimal("0.1")] * 4
        kind_probs[kind] = Decimal("0.7")
        cells.append(
            {
                "digitProbs": digit_probs,
                "kindProbs": kind_probs,
                "finalDigit": digit,
                "finalKind": kind,
                "edited": index in edited_cells,
            }
        )
    item = {
        "pk": f"CONTRIB#{CONTRIBUTOR}",
        "sk": f"SCAN#{scan_id}",
        "schemaVersion": 1,
        "scanId": scan_id,
        "contributorId": CONTRIBUTOR,
        "appVersion": "1.4.0",
        "modelVersion": "1.2.0",
        "corners": [[Decimal(str(v)) for v in point] for point in CORNERS],
        "cells": cells,
        "gsiPending": "PENDING",
        "createdAt": "2026-10-16T10:00:00.000Z",
        "expiresAt": 1792000000,
    }
    return {**item, **changes}


class FakeBucket:
    def __init__(self, objects: dict[str, bytes]):
        self.objects = objects
        self.asked: list[str] = []

    def get(self, key: str) -> bytes | None:
        self.asked.append(key)
        return self.objects.get(key)


class FakeTable:
    def __init__(self, items: list[dict]):
        self.items = items

    def pending(self) -> list[dict]:
        return [dict(i) for i in self.items if "gsiPending" in i]

    def clear_pending(self, pk: str, sk: str) -> None:
        for item in self.items:
            if (item["pk"], item["sk"]) == (pk, sk):
                item.pop("gsiPending", None)


@pytest.fixture
def paths(tmp_path: Path) -> DataPaths:
    data = DataPaths.under(tmp_path / "data")
    data.cells.mkdir(parents=True)
    data.root.mkdir(exist_ok=True)
    return data


def test_one_scan_makes_one_photo_row_and_81_cells(paths: DataPaths):
    table = FakeTable([record(SCAN_A, edited_cells=(2,))])
    bucket = FakeBucket({f"scans/{SCAN_A}.jpg": jpeg(1)})
    report = pull_scans(paths, table, bucket)
    assert report["pulled"] == 1 and report["cells"] == 81
    [photo] = read_photos(paths.photos_csv)
    assert (photo.source, photo.licence, photo.status) == (
        "app-scan",
        "player-contributed",
        "unchecked",
    )
    assert len(photo.corners.split()) == 8
    assert (paths.photos / photo.file).is_file()
    rows = read_cells(paths.cells_csv)
    assert len(rows) == 81 == len(list(paths.cells.glob("*/*.png")))
    sources = {r.label_source for r in rows.values()}
    assert sources == {"app-edited", "app-unedited"}
    assert sum(r.label_source == "app-edited" for r in rows.values()) == 1
    assert all(r.source and r.source[0] == photo.photo_id for r in rows.values())
    assert table.pending() == []
    assert check_data(paths)["problems"] == []


def test_the_folder_and_kind_of_a_cell_are_the_final_answer(paths: DataPaths):
    changed = record(SCAN_A)
    changed["cells"][0] = {**changed["cells"][0], "finalDigit": 7, "finalKind": 2, "edited": True}
    pull_scans(paths, FakeTable([changed]), FakeBucket({f"scans/{SCAN_A}.jpg": jpeg(1)}))
    rows = read_cells(paths.cells_csv)
    first = next(r for r in rows.values() if r.source[1:] == (0, 0))
    assert (first.digit, first.kind, first.label_source) == ("7", "handwritten", "app-edited")
    empties = [r for r in rows.values() if r.digit == "empty"]
    assert empties and all(r.kind is None for r in empties)


def test_a_missing_jpeg_is_skipped_and_reported(paths: DataPaths):
    table = FakeTable([record(SCAN_A), record(SCAN_B)])
    bucket = FakeBucket({f"scans/{SCAN_B}.jpg": jpeg(2)})
    report = pull_scans(paths, table, bucket)
    assert report["pulled"] == 1
    assert report["missing_photo"] == [SCAN_A]
    assert [i["scanId"] for i in table.pending()] == [SCAN_A]
    assert len(read_photos(paths.photos_csv)) == 1


def test_a_repeat_run_pulls_nothing(paths: DataPaths):
    table = FakeTable([record(SCAN_A)])
    bucket = FakeBucket({f"scans/{SCAN_A}.jpg": jpeg(1)})
    pull_scans(paths, table, bucket)
    before = paths.cells_csv.read_bytes()
    bucket.asked.clear()
    report = pull_scans(paths, table, bucket)
    assert report["pulled"] == 0 and bucket.asked == []
    assert paths.cells_csv.read_bytes() == before


def test_a_stopped_run_is_finished_by_the_next_one(paths: DataPaths):
    class Stops(FakeTable):
        def clear_pending(self, pk: str, sk: str) -> None:
            raise KeyboardInterrupt

    table = Stops([record(SCAN_A)])
    bucket = FakeBucket({f"scans/{SCAN_A}.jpg": jpeg(1)})
    with pytest.raises(KeyboardInterrupt):
        pull_scans(paths, table, bucket)
    report = pull_scans(paths, FakeTable(table.items), bucket)
    assert report["already_pulled"] == 1 and report["pulled"] == 0
    assert len(read_photos(paths.photos_csv)) == 1
    assert len(read_cells(paths.cells_csv)) == 81


def test_an_invalid_record_is_reported_and_left_pending(paths: DataPaths):
    bad = record(SCAN_A, schemaVersion=2)
    table = FakeTable([bad])
    report = pull_scans(paths, table, FakeBucket({f"scans/{SCAN_A}.jpg": jpeg(1)}))
    assert report["invalid"] == [SCAN_A]
    assert len(table.pending()) == 1 and not paths.photos_csv.exists()


def test_the_fixture_records_never_become_cells(paths: DataPaths):
    # SUD-10: the ids of shared/fixtures/scan-records/ are test data, not scans.
    fixture = json.loads((FIXTURES / "good-1.json").read_text())
    item = record(fixture["scanId"])
    table = FakeTable([item])
    report = pull_scans(paths, table, FakeBucket({f"scans/{fixture['scanId']}.jpg": jpeg(1)}))
    assert report["fixture"] == [fixture["scanId"]] and report["pulled"] == 0
    assert not list(paths.cells.glob("*/*.png"))


def test_the_pull_never_writes_under_shared_fixtures(paths: DataPaths):
    def digest() -> str:
        sha = hashlib.sha256()
        for path in sorted((REPO_ROOT / "shared" / "fixtures").rglob("*")):
            if path.is_file():
                sha.update(path.read_bytes())
        return sha.hexdigest()

    before = digest()
    pull_scans(paths, FakeTable([record(SCAN_A)]), FakeBucket({f"scans/{SCAN_A}.jpg": jpeg(1)}))
    assert digest() == before


def approve_all(paths: DataPaths) -> None:
    """Approve every outline, as the Outlines screen and Finish do."""
    rows = read_photos(paths.photos_csv)
    write_photos(paths.photos_csv, [replace(r, status="accepted") for r in rows])


def test_unedited_scan_cells_are_left_out_of_training_by_default(paths: DataPaths):
    pull_scans(
        paths,
        FakeTable([record(SCAN_A, edited_cells=(0, 1))]),
        FakeBucket({f"scans/{SCAN_A}.jpg": jpeg(1)}),
    )
    approve_all(paths)
    assert len(load_cells(paths)) == 2
    assert len(load_cells(paths, include_unedited=True)) == 81


def test_the_cells_of_one_scan_stay_on_one_side_of_the_split(paths: DataPaths):
    items = [record(SCAN_A), record(SCAN_B, scanId=SCAN_B)]
    bucket = FakeBucket({f"scans/{SCAN_A}.jpg": jpeg(1), f"scans/{SCAN_B}.jpg": jpeg(2)})
    pull_scans(paths, FakeTable(items), bucket)
    approve_all(paths)
    cells = read_real_cells(paths)
    assert len(cells) > 81
    sides = split_cells(cells, (0.5, 0.25, 0.25), seed=3, include_unedited=True)
    for photo in {c.sample.photo for c in cells}:
        owners = {k for k, side in enumerate(sides) for c in side if c.sample.photo == photo}
        assert len(owners) == 1


def test_main_reads_the_table_and_bucket_names(paths: DataPaths, monkeypatch, capsys):
    seen = {}

    def fake_pull(paths_, table, bucket, **kwargs):
        seen.update(table=table, bucket=bucket)
        return {
            "pulled": 0,
            "cells": 0,
            "already_pulled": 0,
            "invalid": [],
            "fixture": [],
            "missing_photo": [],
        }

    monkeypatch.setattr("sudoku_ml.pull_scans.pull_scans", fake_pull)
    monkeypatch.setattr("sudoku_ml.pull_scans.aws_clients", lambda t, b: (f"T:{t}", f"B:{b}"))
    assert main(["--table", "tbl", "--bucket", "bkt"], paths) == 0
    assert seen == {"table": "T:tbl", "bucket": "B:bkt"}
    assert "the Outlines screen" in capsys.readouterr().out

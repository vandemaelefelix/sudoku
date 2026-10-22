from pathlib import Path

import pytest
from botocore.exceptions import ClientError, CredentialRetrievalError
from test_pull_scans import SCAN_A, FakeBucket, FakeTable, jpeg, record

from sudoku_ml import fetch_scans
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.fetch_scans import SignInNeeded, fetch
from sudoku_ml.tables import read_photos

TABLES = [
    "sudoku-dev-SyncTableTable-wawwckso",
    "sudoku-production-SyncTableTable-caoxewwc",
]
BUCKETS = [
    "sst-asset-fsukxmarmhvk",
    "sudoku-dev-scansbucketbucket-oxszmfkm",
    "sudoku-production-scansbucketbucket-bafhwbds",
]


class FakeAws:
    def __init__(self, tables=TABLES, buckets=BUCKETS, error: Exception | None = None):
        self.tables, self.buckets, self.error = tables, buckets, error
        self.asked: list[tuple[str, str]] = []
        self.table = FakeTable([record(SCAN_A)])

    def table_names(self) -> list[str]:
        if self.error is not None:
            raise self.error
        return self.tables

    def bucket_names(self) -> list[str]:
        return self.buckets

    def clients(self, table: str, bucket: str):
        self.asked.append((table, bucket))
        return self.table, FakeBucket({f"scans/{SCAN_A}.jpg": jpeg(1)})


def data(tmp_path: Path) -> DataPaths:
    paths = DataPaths.under(tmp_path / "data", tmp_path / "images")
    paths.cells.mkdir(parents=True, exist_ok=True)
    return paths


def test_fetch_finds_the_table_and_bucket_of_the_stage_and_pulls(tmp_path: Path):
    paths, aws = data(tmp_path), FakeAws()
    report = fetch(paths, "production", aws)
    assert aws.asked == [(TABLES[1], BUCKETS[2])]
    assert (report["stage"], report["pulled"], report["cells"]) == ("production", 1, 81)
    assert [p.status for p in read_photos(paths.photos_csv)] == ["unchecked"]
    assert aws.table.pending() == []


def test_fetch_refuses_a_stage_without_exactly_one_table(tmp_path: Path):
    with pytest.raises(ValueError, match="Found 0 tables of the stage felix"):
        fetch(data(tmp_path), "felix", FakeAws())
    with pytest.raises(ValueError, match="unknown stage"):
        fetch(data(tmp_path), "staging", FakeAws())


@pytest.mark.parametrize(
    "error",
    [
        CredentialRetrievalError(provider="process", error_msg="the session expired"),
        ClientError({"Error": {"Code": "ExpiredTokenException"}}, "ListTables"),
    ],
)
def test_an_expired_session_asks_for_a_sign_in(tmp_path: Path, error):
    with pytest.raises(SignInNeeded):
        fetch(data(tmp_path), "dev", FakeAws(error=error))


def test_another_aws_error_stays_an_error(tmp_path: Path):
    denied = ClientError({"Error": {"Code": "AccessDeniedException"}}, "ListTables")
    with pytest.raises(ClientError):
        fetch(data(tmp_path), "dev", FakeAws(error=denied))


def test_the_sign_in_runs_the_login_of_the_profile_without_other_aws_variables(monkeypatch):
    started = []
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "other-account")
    monkeypatch.setenv("AWS_PROFILE", "other")
    monkeypatch.setenv("AWS_REGION", "eu-west-1")

    class Running:
        def __init__(self, cmd, **kw):
            started.append((cmd, kw))

        def poll(self):
            return None

    monkeypatch.setattr(fetch_scans.subprocess, "Popen", Running)
    monkeypatch.setattr(fetch_scans, "_signing_in", [])
    fetch_scans.start_sign_in()
    fetch_scans.start_sign_in()
    [(command, options)] = started
    assert command == ("aws", "login", "--profile", "sudoku-login")
    assert "AWS_ACCESS_KEY_ID" not in options["env"] and "AWS_PROFILE" not in options["env"]
    assert options["env"]["AWS_REGION"] == "eu-west-1"

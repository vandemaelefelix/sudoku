"""The Fetch step of the labelling app (ADR-030, ADR-034): find the table and the scan bucket of a
stage in the personal account, then pull its new scans with `pull_scans`."""

import os
import subprocess
from typing import Protocol

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.pull_scans import PROFILE, ScanBucket, ScanTable, pull_scans

STAGES = ("production", "dev", "felix")
# SST names a resource `<app>-<stage>-<name><type>-<random>`. S3 names are lower case.
TABLE_PREFIX = "sudoku-{stage}-SyncTableTable-"
BUCKET_PREFIX = "sudoku-{stage}-scansbucketbucket-"
SIGN_IN = ("aws", "login", "--profile", "sudoku-login")  # the command of `just aws-login`
# The `sudoku_aws` variables of the justfile: another account must not reach the sign-in.
CLEARED = ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_PROFILE")
# A ClientError with one of these codes means an expired or missing session, not a broken call.
EXPIRED_CODES = {
    "ExpiredToken",
    "ExpiredTokenException",
    "InvalidClientTokenId",
    "UnrecognizedClientException",
}


class SignInNeeded(Exception):
    pass


class Aws(Protocol):
    def table_names(self) -> list[str]: ...

    def bucket_names(self) -> list[str]: ...

    def clients(self, table: str, bucket: str) -> tuple[ScanTable, ScanBucket]: ...


class BotoAws:
    """The profile `sudoku` only. An explicit profile makes boto3 ignore AWS_* variables."""

    def __init__(self):
        import boto3

        self._session = boto3.Session(profile_name=PROFILE)

    def table_names(self) -> list[str]:
        names, start = [], {}
        while True:
            page = self._session.client("dynamodb").list_tables(**start)
            names += page["TableNames"]
            if "LastEvaluatedTableName" not in page:
                return names
            start = {"ExclusiveStartTableName": page["LastEvaluatedTableName"]}

    def bucket_names(self) -> list[str]:
        return [b["Name"] for b in self._session.client("s3").list_buckets()["Buckets"]]

    def clients(self, table: str, bucket: str) -> tuple[ScanTable, ScanBucket]:
        from sudoku_ml.pull_scans import DynamoScans, S3Scans

        return (
            DynamoScans(self._session.resource("dynamodb").Table(table)),
            S3Scans(self._session.client("s3"), bucket),
        )


def needs_sign_in(error: Exception) -> bool:
    try:
        from botocore import exceptions
    except ImportError:
        return False
    signed_out = (
        exceptions.NoCredentialsError,
        exceptions.CredentialRetrievalError,
        exceptions.TokenRetrievalError,
        exceptions.SSOError,
        exceptions.UnauthorizedSSOTokenError,
    )
    if isinstance(error, signed_out):
        return True
    if isinstance(error, exceptions.ClientError):
        return error.response.get("Error", {}).get("Code") in EXPIRED_CODES
    return False


def _one(names: list[str], prefix: str, what: str, stage: str) -> str:
    found = [n for n in names if n.startswith(prefix)]
    if len(found) != 1:
        raise ValueError(
            f"Found {len(found)} {what}s of the stage {stage}, not 1. "
            f"Deploy the stage with just deploy-api {stage}, or pick another stage."
        )
    return found[0]


def fetch(paths: DataPaths, stage: str, aws: Aws) -> dict:
    """The pull report, with the stage, the table and the bucket. Raises SignInNeeded when the
    AWS session is expired or missing, and ValueError for an unknown stage."""
    if stage not in STAGES:
        raise ValueError(f"unknown stage {stage!r}")
    try:
        table = _one(aws.table_names(), TABLE_PREFIX.format(stage=stage), "table", stage)
        bucket = _one(aws.bucket_names(), BUCKET_PREFIX.format(stage=stage), "scan bucket", stage)
        report = pull_scans(paths, *aws.clients(table, bucket))
    except Exception as error:
        if needs_sign_in(error):
            raise SignInNeeded(str(error)) from error
        raise
    return {**report, "stage": stage, "table": table, "bucket": bucket}


_signing_in: list[subprocess.Popen] = []


def start_sign_in() -> None:
    """Start `just aws-login` without waiting: it opens the browser and ends after the sign-in.
    A second click while one sign-in runs starts no second one."""
    if _signing_in and _signing_in[0].poll() is None:
        return
    env = {k: v for k, v in os.environ.items() if k not in CLEARED}
    process = subprocess.Popen(
        SIGN_IN, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    _signing_in[:] = [process]

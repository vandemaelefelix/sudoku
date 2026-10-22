import http.client
import json
import threading
from pathlib import Path

import api_schemas as schema
import jsonschema
import pytest
from photos import grid_photo, save_photo
from test_label_store import Clock, build
from test_label_store_scans import entries, pulled

from sudoku_ml.fetch_scans import SignInNeeded
from sudoku_ml.journal import read_journal
from sudoku_ml.label_server import main, make_server, prelabel_new_cells
from sudoku_ml.label_store import LabelStore
from sudoku_ml.photo_import import import_folder
from sudoku_ml.prelabel import NO_MODEL


class Served:
    """A label server on a free port, in a thread."""

    def __init__(self, store: LabelStore, **options):
        self.server = make_server(store, port=0, **options)
        self.port = self.server.server_port
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def get(self, path: str, shape: dict | None = None, status: int = 200):
        code, data = request(self.port, "GET", path)
        assert code == status, data
        value = json.loads(data)
        if shape is not None:
            jsonschema.validate(value, shape)
        return value

    def post(self, path: str, body: dict, shape: dict | None = None, status: int = 200):
        code, data = request(self.port, "POST", path, body)
        assert code == status, data
        value = json.loads(data)
        if shape is not None:
            jsonschema.validate(value, schema.result(shape) if status == 200 else shape)
        return value["result"] if status == 200 else value

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def served(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    app = tmp_path / "app"
    (app / "assets").mkdir(parents=True)
    (app / "index.html").write_text("<title>Labels</title>")
    (app / "assets" / "main.js").write_text("export {}")
    one = Served(LabelStore(paths, Clock()), app_dir=app)
    yield one, paths, ids
    one.close()


def request(port, method, path, body=None, host=None, content_type="application/json"):
    connection = http.client.HTTPConnection("127.0.0.1", port)
    headers = {"Host": host or f"127.0.0.1:{port}"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = content_type
    connection.request(method, path, body=data, headers=headers)
    response = connection.getresponse()
    return response.status, response.read()


def test_the_server_refuses_any_address_but_localhost(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    with pytest.raises(ValueError, match="127.0.0.1"):
        make_server(LabelStore(paths, Clock()), host="0.0.0.0", port=0)


def test_a_foreign_host_header_is_refused(served):
    one, _, _ = served
    status, _ = request(one.port, "GET", "/api/start", host="evil.example:80")
    assert status == 403


def test_a_post_without_json_content_type_is_refused_and_writes_nothing(served):
    one, paths, ids = served
    body = {"cells": [{"id": ids["7"][0], "kind": "printed"}]}
    status, _ = request(one.port, "POST", "/api/kinds/save", body, content_type="text/plain")
    assert status == 415
    assert read_journal(paths.journal) == []


def test_the_built_app_is_served_and_nothing_outside_it(served):
    one, _, _ = served
    status, data = request(one.port, "GET", "/")
    assert status == 200 and data == b"<title>Labels</title>"
    status, data = request(one.port, "GET", "/assets/main.js")
    assert status == 200 and data == b"export {}"
    # An unknown path and a path out of the folder get the app, never another file.
    for path in ("/flow-a/outlines", "/assets/%2e%2e/%2e%2e/x"):
        assert request(one.port, "GET", path) == (200, b"<title>Labels</title>")
    for path in ("/../../data/cells.csv", "/assets/gone.js"):
        assert request(one.port, "GET", path)[0] == 404


def test_a_missing_build_says_how_to_build(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    one = Served(LabelStore(paths, Clock()), app_dir=tmp_path / "none")
    try:
        status, data = request(one.port, "GET", "/")
        assert status == 503 and b"just label-cells" in data
    finally:
        one.close()


def test_an_unknown_api_route_is_a_404(served):
    one, _, _ = served
    one.get("/api/progress", status=404)
    assert one.post("/api/save", {}, status=404) == {"error": "not found"}


def test_the_start_counts(served):
    one, _, _ = served
    counts = one.get("/api/start", schema.START)
    assert (counts["kind"], counts["outlines"], counts["changes"]) == (2, 0, 0)
    assert counts["doubtful"] is None and not counts["suspects"]


def test_a_kind_save_round_trips(served):
    one, paths, ids = served
    screen = one.get("/api/kinds", schema.KINDS)
    assert [c["id"] for c in screen["cells"]] == ids["7"]
    body = {"cells": [{"id": ids["7"][0], "kind": "printed"}]}
    assert one.post("/api/kinds/save", body) == 1
    assert [x.new for x in read_journal(paths.journal)] == ["printed"]
    after = one.get("/api/kinds?folder=7&group=0&page=0", schema.KINDS)
    assert ids["7"][0] not in [c["id"] for c in after["cells"]]
    assert one.post("/api/undo", {}) == {"lines": 1, "what": "groups"}
    assert one.post("/api/undo", {}) == {"lines": 0, "what": None}
    assert one.get("/api/start")["kind"] == 2


def test_cell_images_are_served_and_unknown_cells_are_not(served):
    one, _, ids = served
    status, data = request(one.port, "GET", f"/cell/{ids['7'][0][:16]}.png")
    assert status == 200 and data[:4] == b"\x89PNG"
    status, _ = request(one.port, "GET", "/cell/../../etc/passwd")
    assert status == 404


def test_a_bad_request_gets_a_400_with_a_reason(served):
    one, _, ids = served
    body = {"cells": [{"id": ids["7"][0], "kind": "notes"}]}
    error = one.post("/api/kinds/save", body, schema.ERROR, status=400)
    assert "unknown kind" in error["error"]


def test_the_doubtful_step_lists_and_settles_the_suspects(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    store = LabelStore(paths, Clock())
    store.save([{"id": c, "kind": "printed"} for c in ids["7"]], "groups")
    cell = ids["7"][0]

    def rank() -> None:
        paths.suspects.write_text(
            f"field,file,label,predicted,p_label,p_predicted\ndigit,{cell[:16]},7,1,0.02,0.97\n"
        )

    store._dups = ([], set())  # no cell reads: the test has no near-duplicates
    one = Served(store, suspects=rank)
    try:
        assert one.post("/api/suspects", {}) == {"open": 1}
        screen = one.get("/api/doubtful", schema.DOUBTFUL)
        assert [(i["id"], i["field"]) for i in screen["items"]] == [(cell, "digit")]
        body = {"cells": [{"id": cell, "digit": "1", "kind": "handwritten"}]}
        assert one.post("/api/doubtful/save", body) == 2
        assert one.get("/api/doubtful")["open"] == 0
        assert store.folder[cell] == "1" and store.kinds()[cell] == "handwritten"
        assert one.get("/api/start")["doubtful"] == 0
    finally:
        one.close()


FULL = [[200, 100], [740, 100], [740, 640], [200, 640]]


@pytest.fixture
def served_photos(tmp_path: Path):
    """Two loose cells with pre-labels and one imported photo that waits for its outline."""
    paths, ids = build(tmp_path, {"7": 1, "unlabeled": 2}, {"7": [[0]]})
    u = ids["unlabeled"]
    prelabels = {
        u[0]: {"digit": "2", "p": 0.6, "kind": "handwritten", "kp": 0.9},
        u[1]: {"digit": "2", "p": 0.9, "kind": "handwritten", "kp": 0.9},
    }
    paths.prelabels.write_text(json.dumps({"run": "test", "cells": prelabels}))
    save_photo(grid_photo(), tmp_path / "in" / "p.png")
    import_folder(tmp_path / "in", paths, source="phone", licence="own")
    store = LabelStore(paths, Clock())
    prelabelled = []
    one = Served(store, prelabel=lambda: prelabelled.append(1) or 0)
    yield one, paths, u, store.check.pending()[0], prelabelled
    one.close()


def test_the_digit_step_and_assign_round_trip(served_photos):
    one, paths, u, _, _ = served_photos
    screen = one.get("/api/digits?digit=2", schema.DIGITS)
    assert [c["id"] for c in screen["cells"]] == [u[0], u[1]]
    body = {"cells": [{"id": u[0], "digit": "2"}, {"id": u[1], "digit": "discarded"}]}
    assert one.post("/api/digits/assign", body) == 2
    assert (paths.cells / "2" / f"{u[0][:16]}.png").exists()
    assert one.get("/api/start")["digits"] == 0


def test_an_imported_photo_goes_through_flow_a(served_photos):
    one, paths, u, stem, prelabelled = served_photos
    gallery = one.get("/api/outlines", schema.OUTLINES)
    assert [(s["photo"], s["source"]) for s in gallery["scans"]] == [(stem, "photo")]
    one.get(f"/api/outline?photo={stem}", schema.OUTLINE)
    for path, magic in ((f"/outline/{stem}.jpg", b"\xff\xd8"), (f"/photo/{stem}.jpg", b"\xff\xd8")):
        status, data = request(one.port, "GET", path)
        assert status == 200 and data[:2] == magic
    query = ",".join(str(v) for point in FULL for v in point)
    status, data = request(one.port, "GET", f"/flat/{stem}.png?c={query}")
    assert status == 200 and data[:4] == b"\x89PNG"
    assert request(one.port, "GET", f"/flat/{stem}.png?c=1,2,3")[0] == 400
    result = one.post("/api/outlines/fix", {"photo": stem, "corners": FULL}, schema.FIX)
    assert result["cells"] > 0 and prelabelled == [1]
    # The cells of the photo wait in Flow A, so Flow B still counts only its own 2 cells.
    assert one.get("/api/start")["digits"] + one.get("/api/start")["not_prelabelled"] == 2
    gallery = one.get("/api/cells?digit=unknown", schema.CELLS)
    assert gallery["counts"]["unknown"] == result["cells"] == len(gallery["cells"])
    assert {(c["photo"], c["source"], c["digit"]) for c in gallery["cells"]} == {
        (stem, "photo", None)
    }
    status, data = request(one.port, "GET", f"/flat/{stem}.png")
    assert status == 200 and data[:4] == b"\x89PNG"
    cells = [{"id": c["id"], "digit": "5", "kind": "printed"} for c in gallery["cells"]]
    assert one.post("/api/cells/verify", {"cells": cells}) == 2 * len(cells)
    assert one.get("/api/start")["scan_cells"] == 0
    assert len(list((paths.cells / "5").glob("*.png"))) == len(cells)


def test_the_outline_and_scan_routes_of_uploaded_scans_round_trip(tmp_path: Path):
    store, paths, photos = pulled(tmp_path)
    one = Served(store)
    try:
        gallery = one.get("/api/outlines", schema.OUTLINES)
        assert gallery["open"] == 2 and {s["source"] for s in gallery["scans"]} == {"app"}
        large = one.get(f"/api/outline?photo={photos[0]}", schema.OUTLINE)
        assert large["status"] == "unchecked" and len(large["corners"]) == 4
        assert one.post("/api/outlines/approve", {"photos": photos[:1]}) == 1
        body = {"photo": photos[1], "corners": large["corners"]}
        one.post("/api/outlines/fix", body, schema.FIX)
        assert one.get("/api/start", schema.START)["outlines"] == 0
        assert one.get("/api/start")["scans"] == 2
        verify_every_cell(one)
        assert one.get("/api/start")["scan_cells"] == 0
        error = one.post("/api/outlines/reject", {"photo": photos[0]}, schema.ERROR, 400)
        assert "already checked" in error["error"]
        one.get("/api/outline?photo=0000000000000000", schema.ERROR, status=400)
        assert not paths.detections.exists()
    finally:
        one.close()


def test_a_journal_of_the_old_page_loads_with_no_finish(tmp_path: Path):
    """The old page wrote these lines: outline approvals, a confirmed scan and a kind of the
    Groups screen. The app reads them as they are."""
    store, paths, photos = pulled(tmp_path)
    store.approve_outlines(photos)
    store.confirm_scan(photos[0], entries(store.scan_screen(photos[0])))
    cell = next(c for c in store.folder if store.folder[c] not in ("empty", "discarded"))
    old_line = {
        "t": "2026-10-21T18:00:00Z",
        "session": "20261021-170000",
        "action": "20261021-170000-1",
        "cell": cell,
        "field": "kind",
        "old": store.kinds().get(cell),
        "new": "handwritten",
        "screen": "groups",
    }
    with paths.journal.open("a") as journal:
        journal.write(json.dumps(old_line) + "\n")
    before = paths.journal.read_bytes()
    one = Served(LabelStore(paths, Clock()))
    try:
        counts = one.get("/api/start", schema.START)
        assert (counts["outlines"], counts["scans"]) == (0, 1)
        assert counts["changes"] == len(read_journal(paths.journal))
        waiting = {c["photo"] for c in one.get("/api/cells?digit=empty")["cells"]}
        assert waiting == set(photos[1:])
        verify_every_cell(one)
        assert paths.journal.read_bytes().startswith(before)
        assert one.get("/api/start")["scans"] == 0
    finally:
        one.close()


def verify_every_cell(one: Served) -> None:
    """Confirm each open cell of Flow A as it is, digit by digit, as the app does."""
    for digit in ("empty", *map(str, range(1, 10))):
        cells = one.get(f"/api/cells?digit={digit}", schema.CELLS)["cells"]
        body = [{"id": c["id"], "digit": c["digit"], "kind": c["kind"]} for c in cells]
        if body:
            one.post("/api/cells/verify", {"cells": body})


class FakeFetch:
    def __init__(self, answers: list):
        self.answers, self.stages = answers, []

    def __call__(self, stage: str) -> dict:
        self.stages.append(stage)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


REPORT = {
    "pulled": 2,
    "already_pulled": 0,
    "cells": 160,
    "invalid": [],
    "fixture": [],
    "missing_photo": [],
    "stage": "production",
    "table": "sudoku-production-SyncTableTable-x",
    "bucket": "sudoku-production-scansbucketbucket-x",
}


def test_fetch_reports_the_pull_and_asks_for_a_sign_in_when_the_session_expired(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    fake = FakeFetch([REPORT, SignInNeeded("Token has expired")])
    signed_in = []
    one = Served(LabelStore(paths, Clock()), fetch=fake, sign_in=lambda: signed_in.append(1))
    try:
        assert one.post("/api/fetch", {"stage": "production"}, schema.FETCH) == REPORT
        error = one.post("/api/fetch", {"stage": "dev"}, schema.ERROR, status=401)
        assert error["sign_in"] and fake.stages == ["production", "dev"]
        assert one.post("/api/aws-login", {}) is None and signed_in == [1]
    finally:
        one.close()


@pytest.mark.parametrize("route", ["prelabel", "finish", "fetch", "aws-login", "suspects"])
def test_a_route_without_its_function_answers_404(served, route):
    one, _, _ = served
    assert one.post(f"/api/{route}", {"stage": "dev"}, status=404) == {"error": f"no {route}"}


def test_stopping_the_server_with_ctrl_c_rewrites_the_manifest(tmp_path, monkeypatch):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})

    class Interrupted:
        server_port = 0

        def serve_forever(self):
            LabelStore(paths, Clock()).save([{"id": ids["7"][0], "kind": "handwritten"}], "groups")
            raise KeyboardInterrupt

        def server_close(self):
            pass

    monkeypatch.setattr("sudoku_ml.label_server.make_server", lambda store, **_: Interrupted())
    monkeypatch.setattr("sudoku_ml.label_server.webbrowser.open", lambda url: None)
    assert main(["label_server"], paths) == 0
    assert paths.cells_csv.read_text().splitlines()[1].endswith(",handwritten,,,,verified")


def test_the_server_starts_without_groups_and_on_the_port_given(tmp_path, monkeypatch):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    paths.groups.unlink()
    ports = []

    class Interrupted:
        server_port = 0

        def serve_forever(self):
            raise KeyboardInterrupt

        def server_close(self):
            pass

    def fake(store, **options):
        ports.append(options["port"])
        return Interrupted()

    monkeypatch.setattr("sudoku_ml.label_server.make_server", fake)
    monkeypatch.setattr("sudoku_ml.label_server.webbrowser.open", lambda url: None)
    assert main(["label_server", "--port", "8799"], paths) == 0
    assert ports == [8799]


def serve_with(tmp_path: Path, prelabel) -> Served:
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    return Served(LabelStore(paths, Clock()), prelabel=prelabel)


def test_prelabel_returns_the_number_from_the_stub(tmp_path: Path):
    one = serve_with(tmp_path, lambda: 5)
    try:
        assert one.post("/api/prelabel", {}) == 5
    finally:
        one.close()


def test_a_missing_model_gets_a_400_with_the_message(tmp_path: Path):
    def refuse() -> int:
        raise ValueError(NO_MODEL)

    one = serve_with(tmp_path, refuse)
    try:
        assert one.post("/api/prelabel", {}, schema.ERROR, status=400)["error"] == NO_MODEL
    finally:
        one.close()


def test_a_corrupt_model_file_gets_a_400_with_a_message(tmp_path: Path):
    root = tmp_path / "ml"
    paths, _ = build(root, {"unlabeled": 1}, {})
    manifest = tmp_path / "mobile" / "assets" / "models" / "manifest.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(json.dumps({"run": "r1"}))
    run = root / "artifacts" / "r1"
    run.mkdir(parents=True)
    (run / "model.pt").write_bytes(b"not a model")
    (run / "metrics.json").write_text(json.dumps({"temperature": 1.0}))
    one = serve_with(
        tmp_path / "other",
        lambda: prelabel_new_cells(paths, root, root / "artifacts"),
    )
    try:
        error = one.post("/api/prelabel", {}, status=400)["error"]
        assert error.startswith("The pre-label failed")
    finally:
        one.close()


def test_an_unexpected_error_gets_a_500_with_a_message_and_the_server_keeps_serving(tmp_path: Path):
    def crash() -> int:
        raise RuntimeError("boom")

    one = serve_with(tmp_path, crash)
    try:
        error = one.post("/api/prelabel", {}, status=500)
        assert error == {"error": "The server failed: boom"}
        one.get("/api/start")
    finally:
        one.close()


def test_the_finish_route_answers_with_the_result_or_a_plain_error(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    answers = [{"removed": ["groups.json"]}, ValueError("Finish stopped and deleted nothing.")]

    def finish() -> dict:
        answer = answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer

    one = Served(LabelStore(paths, Clock()), finish=finish)
    try:
        assert one.post("/api/finish", {}) == {"removed": ["groups.json"]}
        assert "deleted nothing" in one.post("/api/finish", {}, status=400)["error"]
    finally:
        one.close()


def test_a_rollback_of_a_finished_session_says_to_use_git(tmp_path: Path, capsys):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    assert main(["label_server", "rollback", "20200101-000000"], paths) == 1
    assert "This session is finished. Use git to go back." in capsys.readouterr().err


def test_the_start_refuses_a_table_that_does_not_parse(tmp_path: Path, capsys):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    paths.cells_csv.write_text("id,label,kind\n")
    assert main(["label_server"], paths) == 1
    assert "Restore it from git." in capsys.readouterr().err
    assert paths.cells_csv.read_text() == "id,label,kind\n"

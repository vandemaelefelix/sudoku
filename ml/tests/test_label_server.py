import http.client
import json
import threading
from pathlib import Path

import api_schemas as schema
import jsonschema
import pytest
from cells import Clock, build, prelabel, save_kinds
from photos import FULL, grid_photo, save_photo
from scans import old_page_confirm, pulled

from sudoku_ml.fetch_scans import SignInNeeded
from sudoku_ml.journal import read_journal
from sudoku_ml.label_jobs import prelabel_new_cells
from sudoku_ml.label_server import Fields, corners_of, main, make_server, threshold_of
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
    paths, ids = build(tmp_path, {"7": 2})
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
    paths, _ = build(tmp_path, {"7": 1})
    with pytest.raises(ValueError, match="127.0.0.1"):
        make_server(LabelStore(paths, Clock()), host="0.0.0.0", port=0)


def test_a_foreign_host_header_is_refused(served):
    one, _, _ = served
    status, _ = request(one.port, "GET", "/api/start", host="evil.example:80")
    assert status == 403


def test_a_post_without_json_content_type_is_refused_and_writes_nothing(served):
    one, paths, ids = served
    body = {"cells": [{"id": ids["7"][0], "kind": "printed"}]}
    status, _ = request(
        one.port, "POST", "/api/check/kinds/confirm", body, content_type="text/plain"
    )
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
    paths, _ = build(tmp_path, {"7": 1})
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
    assert (counts["kind_cells"], counts["digit_cells"], counts["outlines"]) == (2, 0, 0)
    assert (counts["changes"], counts["model"], counts["not_prelabelled"]) == (0, None, 2)
    assert counts["doubtful"] is None and not counts["suspects"]


def test_the_kind_step_round_trips(served):
    one, paths, ids = served
    screen = one.get("/api/check/kinds?digit=7", schema.CHECK_KINDS)
    assert sorted(c["id"] for c in screen["cells"]) == sorted(ids["7"])
    assert (screen["left"], screen["threshold"], screen["sure"]) == (2, 0.95, 0)
    assert set(screen["counts"]) == set(screen["done"]) == {str(d) for d in range(1, 10)}
    body = {"cells": [{"id": ids["7"][0], "kind": "printed"}]}
    assert one.post("/api/check/kinds/confirm", body) == 1
    assert [(x.new, x.screen) for x in read_journal(paths.journal)] == [("printed", "kinds")]
    after = one.get("/api/check/kinds?digit=7&threshold=0.9", schema.CHECK_KINDS)
    assert [c["id"] for c in after["cells"]] == ids["7"][1:] and after["threshold"] == 0.9
    assert one.get("/api/check/kinds?digit=7")["done"]["7"] == 1
    shown = one.get("/api/check/kinds?digit=7&kind=handwritten", schema.CHECK_KINDS)
    assert (shown["cells"], shown["left"]) == ([], 0)
    assert shown["kind_counts"]["all"] == 1
    assert one.post("/api/check/kinds/sure", {"digit": "7", "kind": "handwritten"}) == {"cells": 0}
    assert one.post("/api/undo", {}) == {"lines": 1, "what": "kinds"}
    assert one.post("/api/undo", {}) == {"lines": 0, "what": None}
    assert one.get("/api/start")["kind_cells"] == 2


def test_cell_images_are_served_and_unknown_cells_are_not(served):
    one, _, ids = served
    status, data = request(one.port, "GET", f"/cell/{ids['7'][0][:16]}.png")
    assert status == 200 and data[:4] == b"\x89PNG"
    status, _ = request(one.port, "GET", "/cell/../../etc/passwd")
    assert status == 404


def test_a_bad_request_gets_a_400_with_a_reason(served):
    one, _, ids = served
    body = {"cells": [{"id": ids["7"][0], "kind": "notes"}]}
    error = one.post("/api/check/kinds/confirm", body, schema.ERROR, status=400)
    assert "unknown kind" in error["error"]
    one.get("/api/check/kinds?digit=empty", schema.ERROR, status=400)
    one.get("/api/check/kinds?digit=7&kind=notes", schema.ERROR, status=400)
    one.post("/api/check/kinds/sure", {"digit": "7", "kind": "all"}, schema.ERROR, 400)
    one.get("/api/check/digits?digit=7&threshold=2", schema.ERROR, status=400)
    one.get("/api/check/digits?digit=7&threshold=high", schema.ERROR, status=400)
    one.get("/api/check/digits", schema.ERROR, status=400)


def test_the_doubtful_step_lists_and_settles_the_suspects(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2})
    store = LabelStore(paths, Clock())
    save_kinds(store, [{"id": c, "kind": "printed"} for c in ids["7"]])
    cell = ids["7"][0]

    def rank() -> None:
        paths.suspects.write_text(
            f"field,file,label,predicted,p_label,p_predicted\ndigit,{cell[:16]},7,1,0.02,0.97\n"
        )

    store.review._dups = ([], set())  # no cell reads: the test has no near-duplicates
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


@pytest.fixture
def served_photos(tmp_path: Path):
    """Two loose cells with guesses and one imported photo that waits for its outline."""
    paths, ids = build(tmp_path, {"7": 1, "unlabeled": 2})
    u = ids["unlabeled"]
    prelabel(paths, {u[0]: ("2", 0.6, "handwritten", 0.9), u[1]: ("2", 0.99, "handwritten", 0.9)})
    save_photo(grid_photo(), tmp_path / "in" / "p.png")
    import_folder(tmp_path / "in", paths, source="phone", licence="own")
    store = LabelStore(paths, Clock())
    prelabelled = []
    one = Served(store, prelabel=lambda: prelabelled.append(1) or 0)
    yield one, paths, u, store.check.pending()[0], prelabelled
    one.close()


def test_the_digit_step_and_confirm_round_trip(served_photos):
    one, paths, u, _, _ = served_photos
    screen = one.get("/api/check/digits?digit=2", schema.CHECK)
    assert [c["id"] for c in screen["cells"]] == [u[0], u[1]]
    assert (screen["sure"], screen["counts"]["2"], screen["done"]["2"]) == (1, 2, 0)
    assert {(c["source"], c["photo"], c["row"]) for c in screen["cells"]} == {("loose", None, None)}
    body = {"cells": [{"id": u[0], "digit": "2"}, {"id": u[1], "digit": "discarded"}]}
    assert one.post("/api/check/digits/confirm", body) == 2
    assert (paths.cells / "2" / f"{u[0][:16]}.png").exists()
    assert one.get("/api/start", schema.START)["digit_cells"] == 0
    assert one.post("/api/undo", {}) == {"lines": 2, "what": "digits"}


def test_the_sure_routes_confirm_the_sure_cells_of_one_tab(served_photos):
    one, paths, u, _, _ = served_photos
    assert one.get("/api/check/digits?digit=2&threshold=0.5")["sure"] == 2
    assert one.post("/api/check/digits/sure", {"digit": "2", "threshold": 0.98}, schema.SURE) == {
        "cells": 1
    }
    assert [c["id"] for c in one.get("/api/check/digits?digit=2")["cells"]] == [u[0]]
    assert (paths.cells / "2" / f"{u[1][:16]}.png").exists()
    # The kind of the confirmed cell is the model's guess: 0.9 is below the default 0.95.
    assert one.post("/api/check/kinds/sure", {"digit": "2"}, schema.SURE) == {"cells": 0}
    assert one.post("/api/check/kinds/sure", {"digit": "2", "threshold": 0.9}) == {"cells": 1}
    assert one.get("/api/check/kinds?digit=2")["cells"] == []
    error = one.post("/api/check/digits/sure", {"digit": "7", "threshold": 0}, schema.ERROR, 400)
    assert "threshold" in error["error"]


@pytest.mark.parametrize(
    ("method", "path", "field"),
    [
        ("GET", "/api/check/digits", "digit"),
        ("GET", "/api/check/kinds?threshold=0.5", "digit"),
        ("GET", "/api/outline", "photo"),
        ("POST", "/api/check/digits/sure", "digit"),
        ("POST", "/api/check/digits/confirm", "cells"),
        ("POST", "/api/outlines/reject", "photo"),
        ("POST", "/api/doubtful/save", "cells"),
    ],
)
def test_a_missing_field_is_named_in_the_error(served, method, path, field):
    one, _, _ = served
    status, data = request(one.port, method, path, {} if method == "POST" else None)
    assert status == 400
    assert json.loads(data) == {"error": f"missing field '{field}'"}


def test_a_body_that_is_not_an_object_gets_a_400(served):
    one, _, _ = served
    status, data = request(one.port, "POST", "/api/undo", [1, 2])
    assert status == 400 and "JSON object" in json.loads(data)["error"]


@pytest.mark.parametrize("corners", ["1,2,3", "a,b,c,d,e,f,g,h", "1,2,3,4,5,6,7,8,9"])
def test_corners_of_the_flat_preview_are_checked(served, corners):
    one, _, _ = served
    status, data = request(one.port, "GET", f"/flat/abc.png?c={corners}")
    assert status == 400 and "error" in json.loads(data)


def test_the_threshold_forms_and_the_corners_parse():
    assert threshold_of(Fields({"threshold": "0.9"})) == threshold_of(Fields({"threshold": 0.9}))
    assert threshold_of(Fields()) == ()
    assert corners_of(Fields({"c": "1,2,3,4,5,6,7,8"})) == [[1, 2], [3, 4], [5, 6], [7, 8]]
    assert corners_of(Fields()) is None


@pytest.mark.parametrize("corners", ["1,,2,3,4,5,6,7,8", "1+2+3+4+5+6+7+8", "1 2 3 4 5 6 7 8"])
def test_the_corners_query_takes_commas_only(corners):
    with pytest.raises(ValueError):
        corners_of(Fields({"c": corners}))
    with pytest.raises(ValueError, match="c needs 8 numbers"):
        corners_of(Fields({"c": "1,2,3"}))


def test_a_type_error_in_a_read_is_a_500_and_in_a_write_a_400(served, monkeypatch):
    one, _, _ = served

    def broken(self, *args):
        raise TypeError("bug")

    monkeypatch.setattr(LabelStore, "status", broken)
    monkeypatch.setattr(LabelStore, "reject_outline", broken)
    status, data = request(one.port, "GET", "/api/start")
    assert status == 500 and "The server failed" in json.loads(data)["error"]
    status, _ = request(one.port, "POST", "/api/outlines/reject", {"photo": "x"})
    assert status == 400


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/cells?digit=1"),
        ("GET", "/api/digits?digit=1"),
        ("GET", "/api/kinds"),
        ("POST", "/api/cells/verify"),
        ("POST", "/api/digits/assign"),
        ("POST", "/api/kinds/save"),
    ],
)
def test_the_routes_of_the_old_screens_are_gone(served, method, path):
    one, _, _ = served
    status, _ = request(one.port, method, path, {} if method == "POST" else None)
    assert status == 404


def test_an_imported_photo_goes_through_the_one_flow(served_photos):
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
    start = one.get("/api/start", schema.START)
    assert start["digit_cells"] == 2 + result["cells"]
    assert start["not_prelabelled"] == result["cells"] + 1  # and the legacy cell of 7
    gallery = one.get("/api/check/digits?digit=unknown", schema.CHECK)
    assert gallery["counts"]["unknown"] == result["cells"] == len(gallery["cells"])
    assert {(c["photo"], c["source"], c["digit"]) for c in gallery["cells"]} == {
        (stem, "photo", None)
    }
    status, data = request(one.port, "GET", f"/flat/{stem}.png")
    assert status == 200 and data[:4] == b"\x89PNG"
    cells = [{"id": c["id"], "digit": "5"} for c in gallery["cells"]]
    assert one.post("/api/check/digits/confirm", {"cells": cells}) == len(cells)
    assert one.get("/api/start")["digit_cells"] == 2
    assert len(list((paths.cells / "5").glob("*.png"))) == len(cells)
    kinds = one.get("/api/check/kinds?digit=5", schema.CHECK_KINDS)
    assert kinds["left"] == len(cells) and {c["photo"] for c in kinds["cells"]} == {stem}
    body = [{"id": c["id"], "kind": "printed"} for c in kinds["cells"]]
    assert one.post("/api/check/kinds/confirm", {"cells": body}) == len(cells)
    assert one.get("/api/start")["kind_cells"] == 1  # the legacy cell of 7 has no kind


def test_the_outline_and_check_routes_of_uploaded_scans_round_trip(tmp_path: Path):
    store, paths, photos = pulled(tmp_path)
    prelabelled = []
    one = Served(store, prelabel=lambda: prelabelled.append(1) or 0)
    try:
        gallery = one.get("/api/outlines", schema.OUTLINES)
        assert gallery["open"] == 2 and {s["source"] for s in gallery["scans"]} == {"app"}
        large = one.get(f"/api/outline?photo={photos[0]}", schema.OUTLINE)
        assert large["status"] == "unchecked" and len(large["corners"]) == 4
        assert one.post("/api/outlines/approve", {"photos": photos[:1]}) == 1
        assert prelabelled == [1]  # an uploaded scan is guessed after its approval too
        body = {"photo": photos[1], "corners": large["corners"]}
        one.post("/api/outlines/fix", body, schema.FIX)
        assert prelabelled == [1, 1]
        assert one.get("/api/start", schema.START)["outlines"] == 0
        assert one.get("/api/start")["digit_cells"] > 81
        verify_every_cell(one)
        assert one.get("/api/start")["digit_cells"] == 0
        assert one.get("/api/start")["kind_cells"] == 0
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
    old_page_confirm(store, photos[0])
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
        assert counts["outlines"] == 0
        assert counts["changes"] == len(read_journal(paths.journal))
        waiting = {c["photo"] for c in one.get("/api/check/digits?digit=empty")["cells"]}
        assert waiting == set(photos[1:])
        verify_every_cell(one)
        assert paths.journal.read_bytes().startswith(before)
        assert one.get("/api/start")["digit_cells"] == 0
    finally:
        one.close()


def verify_every_cell(one: Served) -> None:
    """Confirm each open cell as it is, tab by tab, as the app does: the digits, then the kinds."""
    for digit in ("empty", *map(str, range(1, 10))):
        cells = one.get(f"/api/check/digits?digit={digit}", schema.CHECK)["cells"]
        if cells:
            one.post(
                "/api/check/digits/confirm",
                {"cells": [{"id": c["id"], "digit": c["digit"]} for c in cells]},
            )
    for digit in map(str, range(1, 10)):
        cells = one.get(f"/api/check/kinds?digit={digit}", schema.CHECK_KINDS)["cells"]
        if cells:
            body = [{"id": c["id"], "kind": c["kind"] or "printed"} for c in cells]
            one.post("/api/check/kinds/confirm", {"cells": body})


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
    paths, _ = build(tmp_path, {"7": 1})
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
    paths, ids = build(tmp_path, {"7": 1})

    class Interrupted:
        server_port = 0

        def serve_forever(self):
            save_kinds(LabelStore(paths, Clock()), [{"id": ids["7"][0], "kind": "handwritten"}])
            raise KeyboardInterrupt

        def server_close(self):
            pass

    monkeypatch.setattr("sudoku_ml.label_server.make_server", lambda store, **_: Interrupted())
    monkeypatch.setattr("sudoku_ml.label_server.webbrowser.open", lambda url: None)
    assert main(["label_server"], paths) == 0
    assert paths.cells_csv.read_text().splitlines()[1].endswith(",handwritten,,,,verified")


def test_the_server_starts_on_the_port_given(tmp_path, monkeypatch):
    paths, _ = build(tmp_path, {"7": 1})
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
    paths, _ = build(tmp_path, {"7": 1})
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
    paths, _ = build(root, {"unlabeled": 1})
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
    paths, _ = build(tmp_path, {"7": 1})
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
    paths, _ = build(tmp_path, {"7": 1})
    assert main(["label_server", "rollback", "20200101-000000"], paths) == 1
    assert "This session is finished. Use git to go back." in capsys.readouterr().err


def test_the_start_refuses_a_table_that_does_not_parse(tmp_path: Path, capsys):
    paths, _ = build(tmp_path, {"7": 1})
    paths.cells_csv.write_text("id,label,kind\n")
    assert main(["label_server"], paths) == 1
    assert "Restore it from git." in capsys.readouterr().err
    assert paths.cells_csv.read_text() == "id,label,kind\n"

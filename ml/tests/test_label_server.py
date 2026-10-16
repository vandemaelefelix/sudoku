import http.client
import json
import threading
from datetime import UTC, datetime
from pathlib import Path

import pytest
from photos import grid_photo, save_photo
from test_label_store import Clock, build

from sudoku_ml.journal import read_journal
from sudoku_ml.label_server import main, make_server, prelabel_new_cells
from sudoku_ml.label_store import LabelStore
from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.photo_import import import_folder
from sudoku_ml.prelabel import NO_MODEL


@pytest.fixture
def served(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    server = make_server(LabelStore(paths, Clock()), port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_port, paths, ids
    server.shutdown()
    server.server_close()


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
    port, _, _ = served
    status, _ = request(port, "GET", "/api/next", host="evil.example:80")
    assert status == 403


def test_a_post_without_json_content_type_is_refused_and_writes_nothing(served):
    port, paths, ids = served
    body = {"screen": "groups", "cells": [{"id": ids["7"][0], "kind": "printed"}]}
    status, _ = request(port, "POST", "/api/save", body, content_type="text/plain")
    assert status == 415
    assert read_journal(paths.journal) == []


def test_a_save_round_trips(served):
    port, paths, ids = served
    body = {"screen": "groups", "cells": [{"id": ids["7"][0], "kind": "printed"}]}
    status, data = request(port, "POST", "/api/save", body)
    assert status == 200 and json.loads(data) == {"result": 1}
    assert [x.new for x in read_journal(paths.journal)] == ["printed"]
    status, data = request(port, "GET", "/api/screen?folder=7&group=0&page=0")
    assert ids["7"][0] not in [c["id"] for c in json.loads(data)["cells"]]


def test_cell_images_are_served_and_unknown_cells_are_not(served):
    port, _, ids = served
    status, data = request(port, "GET", f"/cell/{ids['7'][0][:16]}.png")
    assert status == 200 and data[:4] == b"\x89PNG"
    status, _ = request(port, "GET", "/cell/../../etc/passwd")
    assert status == 404


def test_a_bad_request_gets_a_400_with_a_reason(served):
    port, _, ids = served
    body = {"screen": "groups", "cells": [{"id": ids["7"][0], "kind": "notes"}]}
    status, data = request(port, "POST", "/api/save", body)
    assert status == 400 and "unknown kind" in json.loads(data)["error"]


def test_the_page_is_served(served):
    port, _, _ = served
    status, data = request(port, "GET", "/")
    assert status == 200 and b"<title>Cell labels</title>" in data


def test_the_page_explains_each_screen_and_the_kinds(served):
    port, _, _ = served
    _, data = request(port, "GET", "/")
    page = data.decode()
    for text in (
        "What to do",
        "Made by a printer or a screen.",
        "Written by a person with a pen or a pencil.",
        "You cannot decide. Training ignores it.",
        "Run <code>just suspects</code>",
        "This cell is in folder",
        "An empty cell has no kind.",
        "The model thinks these cells are printed. Click each cell that is not. Then press Enter.",
        "The model thinks these cells are handwritten.",
        "The model sees no printed or handwritten digit in these cells. Press P or H, click",
        "none or notes",
        "cells still need a kind. Press a button in the To do column.",
        "Every cell has a kind. ✓ Next: Review.",
        "Loading…",
        "This takes about 30 seconds the first time.",
        "No sudoku photos yet. Run just import-photos <folder>, then restart the server.",
        "All sudoku photos are checked. ✓ Next: Confirm digits.",
        "Z can no longer undo these changes. Git keeps the old tables.",
        "Finish closed the open Review items.",
        "open Review items.`",
        "Commit the tables: git add ml/dataset, then commit.",
        "Finish sets it back to 0.",
        "No cells to confirm yet. Check photos first.",
        "All digits are confirmed. ✓ Next: Label kind.",
        "No cells to label yet. Confirm digits first.",
        "Nothing to review. ✓ All labels look fine.",
        "Not enough labels to test yet.",
        "Cannot reach the server. Start it again with just label-cells. ",
        "Something went wrong in the page. Reload the page.",
        "Wait for the current action to finish.",
        "Not enough labels to test yet. Label more cells first.",
        "Open Progress",
        "The server did not answer in time. Press Try again.",
        "Try again",
        "Without a kind",
        "Digit corrected",
        "Look again",
        "Check: not done yet. Do it after 7 days.",
        "Read the sentence above the table.",
        "Nothing to review yet. Stop the server. Run just suspects. Start the server again.",
        "The model reads ${cell.model_kind} (",
        "no model guess yet.",
    ):
        assert text in page


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


FULL = [[200, 100], [740, 100], [740, 640], [200, 640]]


@pytest.fixture
def served_photos(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1, "unlabeled": 2}, {"7": [[0]]})
    u = ids["unlabeled"]
    prelabels = {
        u[0]: {"digit": "2", "p": 0.6, "kind": "handwritten"},
        u[1]: {"digit": "2", "p": 0.9, "kind": "handwritten"},
    }
    paths.prelabels.write_text(json.dumps({"run": "test", "cells": prelabels}))
    save_photo(grid_photo(), tmp_path / "in" / "p.png")
    import_folder(tmp_path / "in", paths, source="phone", licence="own")
    store = LabelStore(paths, Clock())
    moment = datetime(2026, 10, 12, tzinfo=UTC)
    check = PhotoCheck(paths, store.session, lambda: moment)
    server = make_server(store, check, port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_port, paths, u, check.pending()[0]
    server.shutdown()
    server.server_close()


def corner_query() -> str:
    return ",".join(str(v) for point in FULL for v in point)


def test_the_digit_screen_and_assign_round_trip(served_photos):
    port, paths, u, _ = served_photos
    status, data = request(port, "GET", "/api/digits?digit=2&kinds=handwritten")
    assert status == 200 and [c["id"] for c in json.loads(data)["cells"]] == [u[0], u[1]]
    body = {"screen": "digits", "cells": [{"id": u[0], "digit": "2"}]}
    status, data = request(port, "POST", "/api/assign", body)
    assert status == 200 and json.loads(data) == {"result": 1}
    assert (paths.cells / "2" / f"{u[0][:16]}.png").exists()


def test_the_photo_routes_serve_the_photo_and_the_preview(served_photos):
    port, _, _, stem = served_photos
    status, data = request(port, "GET", "/api/photos/next")
    assert status == 200 and json.loads(data)["stem"] == stem
    status, data = request(port, "GET", f"/photo/{stem}.jpg")
    assert status == 200 and data[:2] == b"\xff\xd8"
    status, data = request(port, "GET", f"/flat/{stem}.png?c={corner_query()}")
    assert status == 200 and data[:4] == b"\x89PNG"
    status, data = request(port, "GET", f"/api/photos/usable?photo={stem}&c={corner_query()}")
    assert json.loads(data) == {"usable": 81}
    status, _ = request(port, "GET", "/photo/0000000000000000.jpg")
    assert status == 404
    status, _ = request(port, "GET", f"/flat/{stem}.png?c=1,2,3")
    assert status == 400
    status, _ = request(port, "GET", f"/api/photos/usable?photo={stem}&c=1,2,3")
    assert status == 400


def test_an_accepted_photo_serves_its_new_cells(served_photos):
    port, _, _, stem = served_photos
    status, data = request(port, "POST", "/api/photos/accept", {"photo": stem, "corners": FULL})
    result = json.loads(data)["result"]
    assert status == 200 and result["cells"] > 0
    new = result["new_cells"][0]
    status, data = request(port, "GET", f"/cell/{new[:16]}.png")
    assert status == 200 and data[:4] == b"\x89PNG"
    status, data = request(port, "GET", "/api/photos/next")
    assert json.loads(data) is None


def test_a_rejected_photo_leaves_the_queue(served_photos):
    port, _, _, stem = served_photos
    status, _ = request(port, "POST", "/api/photos/reject", {"photo": stem})
    assert status == 200
    assert json.loads(request(port, "GET", "/api/photos/next")[1]) is None


def test_the_server_starts_without_groups(tmp_path, monkeypatch):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    paths.groups.unlink()

    class Interrupted:
        server_port = 0

        def serve_forever(self):
            raise KeyboardInterrupt

        def server_close(self):
            pass

    monkeypatch.setattr("sudoku_ml.label_server.make_server", lambda store, **_: Interrupted())
    monkeypatch.setattr("sudoku_ml.label_server.webbrowser.open", lambda url: None)
    assert main(["label_server"], paths) == 0


def test_the_status_counts_photos_cells_and_missing_kinds(served_photos):
    port, _, u, _ = served_photos
    status, data = request(port, "GET", "/api/status")
    assert status == 200
    assert json.loads(data) == {
        "photos": 1,
        "photos_total": 1,
        "digits": 2,
        "not_prelabelled": 0,
        "kind_not_prelabelled": 1,
        "digit_cells": 1,
        "kind": 1,
    }
    request(port, "POST", "/api/photos/reject", {"photo": served_photos[3]})
    assert json.loads(request(port, "GET", "/api/status")[1])["photos"] == 0


def test_the_status_counts_cells_without_a_pre_label_apart(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1, "unlabeled": 2}, {"7": [[0]]})
    server = make_server(LabelStore(paths, Clock()), port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        data = json.loads(request(server.server_port, "GET", "/api/status")[1])
        assert data["digits"] == 0 and data["not_prelabelled"] == 2
    finally:
        server.shutdown()
        server.server_close()


def test_the_status_without_a_photo_check_counts_zero_photos(served):
    port, _, _ = served
    status, data = request(port, "GET", "/api/status")
    assert status == 200 and json.loads(data)["photos"] == 0


def serve_with(tmp_path: Path, prelabel):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    server = make_server(LabelStore(paths, Clock()), prelabel=prelabel, port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def test_prelabel_returns_the_number_from_the_stub(tmp_path: Path):
    server = serve_with(tmp_path, lambda: 5)
    try:
        status, data = request(server.server_port, "POST", "/api/prelabel", {})
        assert status == 200 and json.loads(data) == {"result": 5}
    finally:
        server.shutdown()
        server.server_close()


def test_prelabel_without_a_function_answers_404(served):
    port, _, _ = served
    status, data = request(port, "POST", "/api/prelabel", {})
    assert status == 404 and json.loads(data) == {"error": "no prelabel"}


def test_a_missing_model_gets_a_400_with_the_message(tmp_path: Path):
    def refuse() -> int:
        raise ValueError(NO_MODEL)

    server = serve_with(tmp_path, refuse)
    try:
        status, data = request(server.server_port, "POST", "/api/prelabel", {})
        assert status == 400 and json.loads(data)["error"] == NO_MODEL
    finally:
        server.shutdown()
        server.server_close()


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
    server = serve_with(
        tmp_path / "other",
        lambda: prelabel_new_cells(paths, root, root / "artifacts"),
    )
    try:
        status, data = request(server.server_port, "POST", "/api/prelabel", {})
        assert status == 400 and json.loads(data)["error"].startswith("The pre-label failed")
    finally:
        server.shutdown()
        server.server_close()


def test_a_prelabel_error_gets_a_400_with_the_reason(tmp_path: Path):
    def refuse() -> int:
        raise ValueError("No model run found")

    server = serve_with(tmp_path, refuse)
    try:
        status, data = request(server.server_port, "POST", "/api/prelabel", {})
        assert status == 400 and "No model run" in json.loads(data)["error"]
    finally:
        server.shutdown()
        server.server_close()


def test_the_page_explains_the_photos_and_digits_screens(served):
    port, _, _ = served
    page = request(port, "GET", "/")[1].decode()
    for text in (
        'data-mode="photos"',
        'data-mode="digits"',
        "Click the 4 corners: top left, top right, bottom right, bottom left.",
        "Click each cell that is not this digit.",
        "Press <b>X</b> to discard the pointed-at cell",
        "Press <b>Pre-label new cells</b>",
        "Stop the server with Ctrl-C.",
        "1 Check photos",
        "T · Turn grid 90°",
        "Digits sideways? Press T.",
        "From sudoku photo ${found.photo}, row ${found.row + 1}, ",
        "Press T after the 4 corners to turn the grid.",
        "Click the 4 corners first. Then press T to turn the grid.",
        "Finish the 4 corners first. Then press T.",
        "Do the red lines follow the grid?",
    ):
        assert text in page


def test_a_cell_of_an_accepted_photo_serves_its_source(served_photos):
    port, _, _, stem = served_photos
    status, data = request(port, "POST", "/api/photos/accept", {"photo": stem, "corners": FULL})
    cell = json.loads(data)["result"]["new_cells"][0][:16]
    status, data = request(port, "GET", f"/api/source?cell={cell}")
    assert status == 200 and json.loads(data)["photo"] == stem
    status, data = request(port, "GET", f"/source/{cell}.png")
    assert status == 200 and data[:4] == b"\x89PNG"
    assert request(port, "GET", f"/source/{'0' * 16}.png")[0] == 404
    assert json.loads(request(port, "GET", f"/api/source?cell={'0' * 16}")[1]) is None


def test_the_source_routes_answer_404_without_a_photo_check(served):
    port, _, _ = served
    for path in ("/api/source?cell=abc", "/source/abc.png"):
        status, data = request(port, "GET", path)
        assert status == 404 and json.loads(data) == {"error": "no photo check"}


def test_an_unexpected_error_gets_a_500_with_a_message_and_the_server_keeps_serving(tmp_path: Path):
    def crash() -> int:
        raise RuntimeError("boom")

    server = serve_with(tmp_path, crash)
    try:
        port = server.server_port
        status, data = request(port, "POST", "/api/prelabel", {})
        assert status == 500 and json.loads(data)["error"] == "The server failed: boom"
        assert request(port, "GET", "/api/status")[0] == 200
    finally:
        server.shutdown()
        server.server_close()


def test_the_finish_route_answers_with_the_result_or_a_plain_error(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    answers = [{"removed": ["groups.json"]}, ValueError("Finish stopped and deleted nothing.")]

    def finish() -> dict:
        answer = answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer

    server = make_server(LabelStore(paths, Clock()), finish=finish, port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        status, data = request(server.server_port, "POST", "/api/finish", {})
        assert status == 200 and json.loads(data) == {"result": {"removed": ["groups.json"]}}
        status, data = request(server.server_port, "POST", "/api/finish", {})
        assert status == 400 and "deleted nothing" in json.loads(data)["error"]
    finally:
        server.shutdown()
        server.server_close()


def test_the_finish_route_is_missing_without_a_finish_function(served):
    port, _, _ = served
    status, data = request(port, "POST", "/api/finish", {})
    assert status == 404 and json.loads(data) == {"error": "no finish"}


def test_the_progress_route_says_how_many_cells_are_linked(served_photos):
    port, _, _, stem = served_photos
    _, data = request(port, "GET", "/api/progress")
    assert json.loads(data)["link_line"].startswith("Linked 0 of 3 cells. Cells without a link")
    request(port, "POST", "/api/photos/accept", {"photo": stem, "corners": FULL})
    _, data = request(port, "GET", "/api/progress")
    assert json.loads(data)["link_line"].startswith("Linked 35 of 38 cells.")


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

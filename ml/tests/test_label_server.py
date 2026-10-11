import http.client
import json
import threading
from pathlib import Path

import pytest
from test_label_store import Clock, build

from sudoku_ml.kind_log import read_log
from sudoku_ml.label_server import make_server
from sudoku_ml.label_store import LabelStore


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
    assert read_log(paths.log) == []


def test_a_save_round_trips(served):
    port, paths, ids = served
    body = {"screen": "groups", "cells": [{"id": ids["7"][0], "kind": "printed"}]}
    status, data = request(port, "POST", "/api/save", body)
    assert status == 200 and json.loads(data) == {"result": 1}
    assert [x.new for x in read_log(paths.log)] == ["printed"]
    status, data = request(port, "GET", "/api/screen?folder=7&group=0&page=0")
    assert json.loads(data)["cells"][0]["kind"] == "printed"


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
    ):
        assert text in page

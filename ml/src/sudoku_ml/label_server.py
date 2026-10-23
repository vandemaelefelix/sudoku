"""HTTP front of the label store, on 127.0.0.1 only: cell images never leave the Mac (SUD-02,
SUD-08). It serves the built labelling app of `tools/label-app/` and its JSON API (ADR-034)."""

import json
import mimetypes
import sys
import traceback
import webbrowser
from collections.abc import Callable
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from sudoku_ml.data_paths import REPO_ROOT, DataPaths
from sudoku_ml.fetch_scans import BotoAws, SignInNeeded, fetch, start_sign_in
from sudoku_ml.finish import finish
from sudoku_ml.label_jobs import find_suspects, prelabel_new_cells
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_check import clear_temp

APP_DIR = REPO_ROOT / "tools" / "label-app" / "dist"
NO_APP = b"The labelling app is not built. Run just label-cells: it builds the app first."
LARGE_PHOTO = 1600  # long side in pixels of the photo in the large views
LOCAL_HOSTS = ("127.0.0.1", "localhost")


class Fields(dict):
    """The values of a request: the query of a GET, or the JSON body of a POST. A missing field
    raises a ValueError that names it."""

    def __missing__(self, key):
        raise ValueError(f"missing field {key!r}")


class NotFound(Exception):
    pass


@dataclass(frozen=True)
class Picture:
    body: bytes
    content_type: str


def threshold_of(fields: Fields) -> tuple[float, ...]:
    """The optional `threshold` of a request, as arguments for the store."""
    return (float(fields["threshold"]),) if "threshold" in fields else ()


def corners_of(fields: Fields) -> list[list[float]] | None:
    """The optional `c` of a request: `x,y,x,y,x,y,x,y`. Raises ValueError."""
    if "c" not in fields:
        return None
    values = [float(v) for v in fields["c"].split(",")]
    if len(values) != 8:
        raise ValueError("c needs 8 numbers: x,y of the 4 corners")
    return [values[i : i + 2] for i in range(0, 8, 2)]


def make_server(
    store: LabelStore,
    prelabel: Callable[[], int] | None = None,
    finish: Callable[[], dict] | None = None,
    fetch: Callable[[str], dict] | None = None,
    sign_in: Callable[[], None] | None = None,
    suspects: Callable[[], None] | None = None,
    app_dir: Path = APP_DIR,
    host: str = "127.0.0.1",
    port: int = 8765,
) -> HTTPServer:
    if host not in LOCAL_HOSTS:
        raise ValueError(f"refusing to serve on {host}: the page binds to 127.0.0.1 only")
    jobs = {
        "prelabel": prelabel,
        "finish": finish,
        "fetch": fetch,
        "aws-login": sign_in,
        "suspects": suspects,
    }

    def prelabel_quietly() -> None:
        # An approved outline makes its cells open. Without probabilities they have no order.
        if prelabel is not None:
            try:
                prelabel()
            except ValueError as error:
                print(error, file=sys.stderr)

    def after_cut(decide: Callable[[], object]):
        result = decide()
        prelabel_quietly()
        return result

    def undo() -> dict:
        what = store.undo_target()
        return {"lines": store.undo(), "what": what}

    def run_suspects() -> dict:
        suspects()
        return {"open": len(store.review_items())}

    def cell_png(name: str, fields: Fields) -> bytes:
        try:
            return store.cell_file(name).read_bytes()
        except KeyError:
            raise NotFound("no such cell") from None

    reads: dict[str, Callable[[Fields], object]] = {
        "/api/start": lambda a: store.status(),
        "/api/outlines": lambda a: store.outline_screen(int(a.get("page", 0))),
        "/api/outline": lambda a: store.outline(a["photo"]),
        "/api/check/digits": lambda a: store.check_digits(a["digit"], *threshold_of(a)),
        "/api/check/kinds": lambda a: store.check_kinds(
            a["digit"], *threshold_of(a), kind=a.get("kind")
        ),
        "/api/doubtful": lambda a: store.review_screen(),
    }
    # Prefix → suffix, content type and the picture of the name between them.
    pictures: dict[str, tuple[str, str, Callable[[str, Fields], bytes]]] = {
        "/cell/": (".png", "image/png", cell_png),
        "/outline/": (".jpg", "image/jpeg", lambda n, a: store.photo_jpeg(n)),
        "/photo/": (".jpg", "image/jpeg", lambda n, a: store.photo_jpeg(n, LARGE_PHOTO, False)),
        "/flat/": (".png", "image/png", lambda n, a: store.flat_png(n, corners_of(a))),
    }
    writes: dict[str, Callable[[Fields], object]] = {
        "/api/outlines/approve": lambda b: after_cut(lambda: store.approve_outlines(b["photos"])),
        "/api/outlines/fix": lambda b: after_cut(
            lambda: store.fix_outline(b["photo"], b["corners"])
        ),
        "/api/outlines/reject": lambda b: store.reject_outline(b["photo"]),
        "/api/check/digits/confirm": lambda b: store.confirm_digits(b["cells"]),
        "/api/check/kinds/confirm": lambda b: store.confirm_kinds(b["cells"]),
        "/api/check/digits/sure": lambda b: {
            "cells": store.sure_digits(b["digit"], *threshold_of(b))
        },
        "/api/check/kinds/sure": lambda b: {
            "cells": store.sure_kinds(b["digit"], *threshold_of(b), kind=b.get("kind"))
        },
        "/api/doubtful/save": lambda b: store.review_save(b["cells"]),
        "/api/undo": lambda b: undo(),
        "/api/prelabel": lambda b: prelabel(),
        "/api/finish": lambda b: finish(),
        "/api/fetch": lambda b: fetch(b["stage"]),
        "/api/aws-login": lambda b: sign_in(),
        "/api/suspects": lambda b: run_suspects(),
    }

    def find(method: str, path: str) -> Callable[[Fields], object] | None:
        if method == "POST":
            return writes.get(path)
        if path in reads:
            return reads[path]
        for prefix, (suffix, content_type, make) in pictures.items():
            if path.startswith(prefix):
                name = path.removeprefix(prefix).removesuffix(suffix)
                return lambda fields: Picture(make(name, fields), content_type)
        return None

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _failed(self, error: Exception) -> None:
            # Without this the connection drops and the app shows only "Failed to fetch".
            traceback.print_exc(file=sys.stderr)
            self._json({"error": f"The server failed: {error}"}, 500)

        def _json(self, value, status: int = 200) -> None:
            self._send(status, json.dumps(value).encode(), "application/json")

        def _local(self) -> bool:
            # Another site can point a name at 127.0.0.1 (DNS rebinding). Its requests carry
            # that name in Host, so only our own host and port pass.
            port = self.server.server_port
            allowed = {f"{name}:{port}" for name in LOCAL_HOSTS}
            if self.headers.get("Host") in allowed:
                return True
            self._json({"error": "forbidden host"}, 403)
            return False

        def _static(self, path: str) -> None:
            root = app_dir.resolve()
            target = (root / (path.lstrip("/") or "index.html")).resolve()
            if not target.is_relative_to(root) or not target.is_file():
                if "." in Path(path).name:
                    # A missing script or image: a 404, not the app as HTML.
                    self._json({"error": "not found"}, 404)
                    return
                target = root / "index.html"
            if not target.is_file():
                self._send(503, NO_APP, "text/plain; charset=utf-8")
                return
            kind = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            if kind.startswith("text/") or kind == "application/javascript":
                kind += "; charset=utf-8"
            self._send(200, target.read_bytes(), kind)

        def _fields(self, method: str) -> Fields:
            if method == "GET":
                query = parse_qs(urlparse(self.path).query)
                return Fields({k: v[0] for k, v in query.items()})
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise ValueError("the body must be a JSON object")
            return Fields(body)

        def _answer(self, method: str, run: Callable[[Fields], object]) -> None:
            try:
                value = run(self._fields(method))
                if isinstance(value, Picture):
                    self._send(200, value.body, value.content_type)
                else:
                    self._json({"result": value} if method == "POST" else value)
            except SignInNeeded as error:
                self._json(
                    {"error": "The AWS session expired.", "sign_in": True, "detail": str(error)},
                    401,
                )
            except NotFound as error:
                self._json({"error": str(error)}, 404)
            except (KeyError, ValueError, IndexError) as error:
                self._json({"error": str(error)}, 400)
            except TypeError as error:
                # A TypeError in a read handler is a bug: it must reach the log as a 500.
                if method == "POST":
                    self._json({"error": str(error)}, 400)
                else:
                    self._failed(error)
            except Exception as error:
                self._failed(error)

        def _route(self, method: str) -> None:
            if not self._local():
                return
            # A cross-site form or fetch without a preflight cannot set this content type.
            if (
                method == "POST"
                and self.headers.get("Content-Type", "").split(";")[0] != "application/json"
            ):
                self._json({"error": "Content-Type must be application/json"}, 415)
                return
            path = urlparse(self.path).path
            run = find(method, path)
            if run is None:
                if method == "GET" and not path.startswith("/api/"):
                    self._static(path)
                else:
                    self._json({"error": "not found"}, 404)
                return
            job = path.removeprefix("/api/")
            if method == "POST" and job in jobs and jobs[job] is None:
                self._json({"error": f"no {job}"}, 404)
                return
            self._answer(method, run)

        def do_GET(self):
            self._route("GET")

        def do_POST(self):
            self._route("POST")

    return HTTPServer((host, port), Handler)


def main(argv: list[str], paths: DataPaths | None = None) -> int:
    paths = paths or DataPaths.under()
    if argv[1:2] == ["rollback"]:
        try:
            store = LabelStore(paths)
            print(f"Reversed {store.rollback(argv[2])} lines.")
        except ValueError as error:
            print(error, file=sys.stderr)
            return 1
        return 0
    port = int(argv[argv.index("--port") + 1]) if "--port" in argv else 8765
    # Only after the rollback branch: a rollback in a second terminal must not delete the
    # temporary file of a cut that runs in the server. A stopped cut leaves one (ADR-009).
    clear_temp(paths)
    try:
        store = LabelStore(paths)
        repaired = store.repair()
        write_cells_manifest(paths)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    if repaired:
        print(f"Repaired {repaired} kinds of cells outside the digit folders after a stop.")

    def prelabel_open_cells() -> int:
        try:
            return prelabel_new_cells(paths, wanted=store.prelabel_targets())
        finally:
            # The sudoku signals need the guesses, and their first cut is slow: do it here.
            store.sudoku_reasons()

    try:
        print(f"Pre-labelled {prelabel_open_cells()} new cells.")
    except ValueError as error:
        print(error)
    server = make_server(
        store,
        prelabel=prelabel_open_cells,
        finish=lambda: finish(store),
        fetch=lambda stage: fetch(paths, stage, BotoAws()),
        sign_in=start_sign_in,
        suspects=lambda: find_suspects(paths),
        port=port,
    )
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Session {store.session}. Open {url}. Stop with Ctrl-C.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        # Ctrl-C also stops `just`, so a recipe line after this one never runs.
        write_cells_manifest(paths)
        print(f"Rewrote {paths.cells_csv}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

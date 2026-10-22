"""HTTP front of the label store, on 127.0.0.1 only: cell images never leave the Mac (SUD-02,
SUD-08). It serves the built labelling app of `tools/label-app/` and its JSON API (ADR-034)."""

import json
import mimetypes
import pickle
import sys
import traceback
import webbrowser
from collections.abc import Callable, Collection
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from sudoku_ml.data_paths import ARTIFACTS, ML_ROOT, REPO_ROOT, DataPaths
from sudoku_ml.fetch_scans import BotoAws, SignInNeeded, fetch, start_sign_in
from sudoku_ml.finish import finish
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_check import clear_temp

APP_DIR = REPO_ROOT / "tools" / "label-app" / "dist"
NO_APP = b"The labelling app is not built. Run just label-cells: it builds the app first."
LARGE_PHOTO = 1600  # long side in pixels of the photo in the large views
LOCAL_HOSTS = ("127.0.0.1", "localhost")


def parse_corners(text: str) -> list[list[float]]:
    """`x,y,x,y,x,y,x,y` → 4 [x, y] pairs. Raises ValueError."""
    values = [float(v) for v in text.split(",")]
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

    def cut(photos: list[str], decide: Callable[[], object]):
        result = decide()
        prelabel_quietly()
        return result

    def sure_threshold(body: dict) -> tuple[float, ...]:
        return (float(body["threshold"]),) if "threshold" in body else ()

    def undo() -> dict:
        what = store.undo_target()
        return {"lines": store.undo(), "what": what}

    def run_suspects() -> dict:
        suspects()
        return {"open": len(store.review_items())}

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

        @staticmethod
        def _threshold(q: dict) -> tuple[float, ...]:
            return (float(q["threshold"]),) if "threshold" in q else ()

        def _image(self, prefix: str, suffix: str) -> str:
            return urlparse(self.path).path.removeprefix(prefix).removesuffix(suffix)

        def do_GET(self):
            if not self._local():
                return
            url = urlparse(self.path)
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            try:
                if url.path.startswith("/cell/"):
                    try:
                        path = store.cell_file(self._image("/cell/", ".png"))
                    except KeyError:
                        self._json({"error": "no such cell"}, 404)
                        return
                    self._send(200, path.read_bytes(), "image/png")
                elif url.path.startswith("/outline/"):
                    self._send(
                        200, store.photo_jpeg(self._image("/outline/", ".jpg")), "image/jpeg"
                    )
                elif url.path.startswith("/photo/"):
                    body = store.photo_jpeg(self._image("/photo/", ".jpg"), LARGE_PHOTO, False)
                    self._send(200, body, "image/jpeg")
                elif url.path.startswith("/flat/"):
                    corners = parse_corners(q["c"]) if "c" in q else None
                    body = store.flat_png(self._image("/flat/", ".png"), corners)
                    self._send(200, body, "image/png")
                elif url.path == "/api/start":
                    self._json(store.status())
                elif url.path == "/api/outlines":
                    self._json(store.outline_screen(int(q.get("page", 0))))
                elif url.path == "/api/outline":
                    self._json(store.outline(q["photo"]))
                elif url.path == "/api/check/digits":
                    self._json(store.check_digits(q["digit"], *self._threshold(q)))
                elif url.path == "/api/check/kinds":
                    self._json(store.check_kinds(q["digit"], *self._threshold(q)))
                elif url.path == "/api/doubtful":
                    self._json(store.review_screen())
                elif url.path.startswith("/api/"):
                    self._json({"error": "not found"}, 404)
                else:
                    self._static(url.path)
            except (KeyError, ValueError, IndexError) as error:
                self._json({"error": str(error)}, 400)
            except Exception as error:
                self._failed(error)

        def do_POST(self):
            if not self._local():
                return
            # A cross-site form or fetch without a preflight cannot set this content type.
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                self._json({"error": "Content-Type must be application/json"}, 415)
                return
            routes = {
                "/api/outlines/approve": lambda b: cut(
                    b["photos"], lambda: store.approve_outlines(b["photos"])
                ),
                "/api/outlines/fix": lambda b: cut(
                    [b["photo"]], lambda: store.fix_outline(b["photo"], b["corners"])
                ),
                "/api/outlines/reject": lambda b: store.reject_outline(b["photo"]),
                "/api/check/digits/confirm": lambda b: store.confirm_digits(b["cells"]),
                "/api/check/kinds/confirm": lambda b: store.confirm_kinds(b["cells"]),
                "/api/check/digits/sure": lambda b: {
                    "cells": store.sure_digits(b["digit"], *sure_threshold(b))
                },
                "/api/check/kinds/sure": lambda b: {
                    "cells": store.sure_kinds(b["digit"], *sure_threshold(b))
                },
                "/api/doubtful/save": lambda b: store.review_save(b["cells"]),
                "/api/undo": lambda b: undo(),
                "/api/prelabel": lambda b: prelabel(),
                "/api/finish": lambda b: finish(),
                "/api/fetch": lambda b: fetch(b["stage"]),
                "/api/aws-login": lambda b: sign_in(),
                "/api/suspects": lambda b: run_suspects(),
            }
            name = urlparse(self.path).path
            route = routes.get(name)
            if route is None:
                self._json({"error": "not found"}, 404)
                return
            job = name.removeprefix("/api/")
            if job in jobs and jobs[job] is None:
                self._json({"error": f"no {job}"}, 404)
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                self._json({"result": route(body)})
            except SignInNeeded as error:
                self._json(
                    {"error": "The AWS session expired.", "sign_in": True, "detail": str(error)},
                    401,
                )
            except (KeyError, ValueError, IndexError, TypeError) as error:
                self._json({"error": str(error)}, 400)
            except Exception as error:
                self._failed(error)

    return HTTPServer((host, port), Handler)


def prelabel_new_cells(
    paths: DataPaths,
    ml_root: Path = ML_ROOT,
    artifacts: Path = ARTIFACTS,
    wanted: Collection[str] | None = None,
) -> int:
    """Guess the `wanted` cells (full ids) with the latest model. Without `wanted`: all cells
    of unlabeled/ and the digit folders. Raises ValueError without a model or when it fails."""
    # torch loads slowly. Import it here so the server starts fast and the tests need no model.
    from sudoku_ml.grouping import default_run
    from sudoku_ml.prelabel import NO_MODEL, write_prelabels

    try:
        run = default_run(ml_root, artifacts)
    except (OSError, KeyError):
        run = None
    if run is None or not (run / "model.pt").exists():
        raise ValueError(NO_MODEL)
    try:
        return write_prelabels(paths.cells, run, paths.prelabels, wanted)
    except (OSError, RuntimeError, KeyError, EOFError, pickle.UnpicklingError) as error:
        raise ValueError(f"The pre-label failed: {error}") from error


def find_suspects(paths: DataPaths) -> None:
    # torch loads slowly, as in prelabel_new_cells.
    from sudoku_ml.suspects import find_suspects as rank

    rank(paths)


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

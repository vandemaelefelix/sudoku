"""HTTP front of the label store, on 127.0.0.1 only: cell images never leave the Mac (SUD-02,
SUD-08)."""

import json
import sys
import webbrowser
from collections.abc import Callable
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from sudoku_ml.label_store import LabelStore, Paths
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_check import PhotoCheck
from sudoku_ml.photo_import import PhotoPaths

PAGE = Path(__file__).with_name("label_page.html")
LOCAL_HOSTS = ("127.0.0.1", "localhost")
ML_ROOT = Path(__file__).parents[2]


def parse_corners(text: str) -> list[list[float]]:
    """`x,y,x,y,x,y,x,y` → 4 [x, y] pairs. Raises ValueError."""
    values = [float(v) for v in text.split(",")]
    if len(values) != 8:
        raise ValueError("c needs 8 numbers: x,y of the 4 corners")
    return [values[i : i + 2] for i in range(0, 8, 2)]


def make_server(
    store: LabelStore,
    check: PhotoCheck | None = None,
    prelabel: Callable[[], int] | None = None,
    host: str = "127.0.0.1",
    port: int = 8765,
) -> HTTPServer:
    if host not in LOCAL_HOSTS:
        raise ValueError(f"refusing to serve on {host}: the page binds to 127.0.0.1 only")

    def accept(stem: str, corners) -> dict:
        if check is None:
            raise ValueError("no photo check")
        result = check.accept(stem, corners)
        store.register(result["new_cells"])
        return result

    def reject(stem: str, reason: str) -> None:
        if check is None:
            raise ValueError("no photo check")
        check.reject(stem, reason)

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

        def do_GET(self):
            if not self._local():
                return
            url = urlparse(self.path)
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            try:
                if url.path == "/":
                    self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
                elif url.path.startswith("/cell/"):
                    stem = url.path.removeprefix("/cell/").removesuffix(".png")
                    try:
                        path = store.cell_file(stem)
                    except KeyError:
                        self._json({"error": "no such cell"}, 404)
                        return
                    self._send(200, path.read_bytes(), "image/png")
                elif url.path == "/api/next":
                    after = (
                        (q["folder"], int(q["group"]), int(q["page"])) if "folder" in q else None
                    )
                    self._json(store.next_screen(after))
                elif url.path == "/api/screen":
                    self._json(store.screen(q["folder"], int(q["group"]), int(q["page"])))
                elif url.path == "/api/review":
                    self._json(store.review_screen())
                elif url.path == "/api/check":
                    self._json(store.check_start())
                elif url.path == "/api/status":
                    self._json({"photos": len(check.pending()) if check else 0, **store.status()})
                elif url.path == "/api/progress":
                    self._json(store.progress())
                elif url.path == "/api/digits":
                    self._json(store.digit_screen(q["digit"], q.get("kinds", "handwritten")))
                elif url.path.startswith(("/api/photos/", "/photo/", "/flat/")) and check is None:
                    self._json({"error": "no photo check"}, 404)
                elif url.path == "/api/photos/next":
                    self._json(check.next(q.get("after")))
                elif url.path == "/api/photos/usable":
                    self._json({"usable": check.usable(q["photo"], parse_corners(q["c"]))})
                elif url.path.startswith("/photo/"):
                    stem = url.path.removeprefix("/photo/").removesuffix(".jpg")
                    try:
                        body = check.display_jpeg(stem)
                    except KeyError:
                        self._json({"error": "no such photo"}, 404)
                        return
                    self._send(200, body, "image/jpeg")
                elif url.path.startswith("/flat/"):
                    stem = url.path.removeprefix("/flat/").removesuffix(".png")
                    try:
                        check.photo(stem)
                    except KeyError:
                        self._json({"error": "no such photo"}, 404)
                        return
                    self._send(200, check.preview_png(stem, parse_corners(q["c"])), "image/png")
                else:
                    self._json({"error": "not found"}, 404)
            except (KeyError, ValueError, IndexError) as error:
                self._json({"error": str(error)}, 400)

        def do_POST(self):
            if not self._local():
                return
            # A cross-site form or fetch without a preflight cannot set this content type.
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                self._json({"error": "Content-Type must be application/json"}, 415)
                return
            routes = {
                "/api/save": lambda b: store.save(
                    b["cells"], b["screen"], b.get("confirm_digits", [])
                ),
                "/api/move": lambda b: store.move(b["id"], b["digit"], b["screen"]),
                "/api/undo": lambda b: store.undo(),
                "/api/check": lambda b: store.check_answer(b["answers"]),
                "/api/assign": lambda b: store.assign(b["cells"], b["screen"]),
                "/api/prelabel": lambda b: prelabel(),
                "/api/photos/accept": lambda b: accept(b["photo"], b["corners"]),
                "/api/photos/reject": lambda b: reject(b["photo"], b["reason"]),
            }
            route = routes.get(urlparse(self.path).path)
            if route is None:
                self._json({"error": "not found"}, 404)
                return
            if prelabel is None and urlparse(self.path).path == "/api/prelabel":
                self._json({"error": "no prelabel"}, 404)
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                self._json({"result": route(body)})
            except (KeyError, ValueError, IndexError, TypeError) as error:
                self._json({"error": str(error)}, 400)

    return HTTPServer((host, port), Handler)


def prelabel_new_cells(ml_root: Path) -> int:
    # torch loads slowly. Import it here so the server starts fast and the tests need no model.
    from sudoku_ml.grouping import default_run
    from sudoku_ml.prelabel import NO_MODEL, write_prelabels

    try:
        run = default_run(ml_root)
    except FileNotFoundError:
        run = None
    if run is None or not (run / "model.pt").exists():
        raise ValueError(NO_MODEL)
    return write_prelabels(ml_root / "data" / "cells", run, ml_root / "data" / "prelabels.json")


def main(argv: list[str], ml_root: Path = ML_ROOT) -> int:
    paths = Paths.under(ml_root)
    store = LabelStore(paths)
    check = PhotoCheck(PhotoPaths.under(ml_root), store.session, lambda: datetime.now(UTC))
    if argv[1:2] == ["rollback"]:
        print(f"Reversed {store.rollback(argv[2])} lines.")
        return 0
    server = make_server(store, check=check, prelabel=lambda: prelabel_new_cells(ml_root))
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
        write_cells_manifest(paths.cells, paths.manifest, paths.log)
        print(f"Rewrote {paths.manifest}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

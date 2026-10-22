"""HTTP front of the label store, on 127.0.0.1 only: cell images never leave the Mac (SUD-02,
SUD-08)."""

import json
import pickle
import sys
import traceback
import webbrowser
from collections.abc import Callable
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from sudoku_ml.data_paths import ARTIFACTS, ML_ROOT, DataPaths
from sudoku_ml.finish import finish
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_check import PhotoCheck, clear_temp

PAGE = Path(__file__).with_name("label_page.html")
PHOTO_ROUTES = ("/api/photos/", "/photo/", "/flat/", "/api/source", "/source/")
OUTLINE_PREFIX = "/outline/"
LOCAL_HOSTS = ("127.0.0.1", "localhost")


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
    finish: Callable[[], dict] | None = None,
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

    def reject(stem: str) -> None:
        if check is None:
            raise ValueError("no photo check")
        check.reject(stem)

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
            # Without this the connection drops and the page shows only "Failed to fetch".
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
                elif url.path == "/api/outlines":
                    self._json(store.outline_screen(int(q.get("page", 0))))
                elif url.path == "/api/outline":
                    self._json(store.outline(q["photo"]))
                elif url.path.startswith(OUTLINE_PREFIX):
                    stem = url.path.removeprefix(OUTLINE_PREFIX).removesuffix(".jpg")
                    self._send(200, store.outline_jpeg(stem), "image/jpeg")
                elif url.path == "/api/scan-list":
                    self._json(store.scan_list())
                elif url.path == "/api/scans":
                    self._json(store.scan_screen(q["photo"]))
                elif url.path == "/api/status":
                    self._json(
                        {
                            "photos": len(check.pending()) if check is not None else 0,
                            "photos_total": check.total() if check is not None else 0,
                            **store.status(),
                        }
                    )
                elif url.path == "/api/progress":
                    progress = store.progress()
                    if check is not None:
                        progress["link_line"] = check.link_line(list(store.folder))
                    self._json(progress)
                elif url.path == "/api/digits":
                    self._json(store.digit_screen(q["digit"], q.get("kinds", "handwritten")))
                elif check is None and url.path.startswith(PHOTO_ROUTES):
                    self._json({"error": "no photo check"}, 404)
                elif url.path == "/api/source":
                    self._json(check.source(q["cell"]))
                elif url.path.startswith("/source/"):
                    body = check.source_png(url.path.removeprefix("/source/").removesuffix(".png"))
                    if body is None:
                        self._json({"error": "no source"}, 404)
                        return
                    self._send(200, body, "image/png")
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
                    if not check.known(stem):
                        self._json({"error": "no such photo"}, 404)
                        return
                    self._send(200, check.preview_png(stem, parse_corners(q["c"])), "image/png")
                else:
                    self._json({"error": "not found"}, 404)
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
                "/api/save": lambda b: store.save(
                    b["cells"], b["screen"], b.get("confirm_digits", [])
                ),
                "/api/move": lambda b: store.move(b["id"], b["digit"], b["screen"]),
                "/api/undo": lambda b: store.undo(),
                "/api/check": lambda b: store.check_answer(b["answers"]),
                "/api/assign": lambda b: store.assign(b["cells"], b["screen"]),
                "/api/scans/confirm": lambda b: store.confirm_scan(b["photo"], b["cells"]),
                "/api/outlines/approve": lambda b: store.approve_outlines(b["photos"]),
                "/api/outlines/fix": lambda b: store.fix_outline(b["photo"], b["corners"]),
                "/api/outlines/reject": lambda b: store.reject_outline(b["photo"]),
                "/api/prelabel": lambda b: prelabel(),
                "/api/finish": lambda b: finish(),
                "/api/photos/accept": lambda b: accept(b["photo"], b["corners"]),
                "/api/photos/reject": lambda b: reject(b["photo"]),
            }
            route = routes.get(urlparse(self.path).path)
            if route is None:
                self._json({"error": "not found"}, 404)
                return
            name = urlparse(self.path).path
            if (name, None) in (("/api/prelabel", prelabel), ("/api/finish", finish)):
                self._json({"error": f"no {name.removeprefix('/api/')}"}, 404)
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                self._json({"result": route(body)})
            except (KeyError, ValueError, IndexError, TypeError) as error:
                self._json({"error": str(error)}, 400)
            except Exception as error:
                self._failed(error)

    return HTTPServer((host, port), Handler)


def prelabel_new_cells(
    paths: DataPaths, ml_root: Path = ML_ROOT, artifacts: Path = ARTIFACTS
) -> int:
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
        return write_prelabels(paths.cells, run, paths.prelabels)
    except (OSError, RuntimeError, KeyError, EOFError, pickle.UnpicklingError) as error:
        raise ValueError(f"The pre-label failed: {error}") from error


def waiting_line(store: LabelStore, check: PhotoCheck) -> str:
    cells = sum(folder == "unlabeled" for folder in store.folder.values())
    return f"Waiting: {cells} cells in unlabeled/, {len(check.pending())} sudoku photos pending."


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
    check = PhotoCheck(paths, store.session, lambda: datetime.now(UTC))
    try:
        print(f"Pre-labelled {prelabel_new_cells(paths)} new cells.")
    except ValueError as error:
        print(error)
    print(waiting_line(store, check))
    server = make_server(
        store,
        check=check,
        prelabel=lambda: prelabel_new_cells(paths),
        finish=lambda: finish(store),
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

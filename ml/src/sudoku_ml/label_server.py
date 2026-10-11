"""HTTP front of the label store, on 127.0.0.1 only: cell images never leave the Mac (SUD-02,
SUD-08)."""

import json
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from sudoku_ml.label_store import LabelStore, Paths

PAGE = Path(__file__).with_name("label_page.html")
LOCAL_HOSTS = ("127.0.0.1", "localhost")


def make_server(store: LabelStore, host: str = "127.0.0.1", port: int = 8765) -> HTTPServer:
    if host not in LOCAL_HOSTS:
        raise ValueError(f"refusing to serve on {host}: the page binds to 127.0.0.1 only")

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
                elif url.path == "/api/progress":
                    self._json(store.progress())
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
            }
            route = routes.get(urlparse(self.path).path)
            if route is None:
                self._json({"error": "not found"}, 404)
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                self._json({"result": route(body)})
            except (KeyError, ValueError, IndexError, TypeError) as error:
                self._json({"error": str(error)}, 400)

    return HTTPServer((host, port), Handler)


def main(argv: list[str]) -> int:
    paths = Paths.under(Path(__file__).parents[2])
    if not paths.groups.exists():
        print(f"{paths.groups} is missing. Run: just group-cells", file=sys.stderr)
        return 1
    store = LabelStore(paths)
    if argv[1:2] == ["rollback"]:
        print(f"Reversed {store.rollback(argv[2])} lines.")
        return 0
    server = make_server(store)
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Session {store.session}. Open {url}. Stop with Ctrl-C.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

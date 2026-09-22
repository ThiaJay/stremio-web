#!/usr/bin/env python3
import http.server
import json
import os
import socketserver
import urllib.parse
from pathlib import Path

ROOT = Path(os.environ.get("ACCEPTANCE_ROOT", "build")).resolve()
RECEIPT = Path(os.environ.get("ACCEPTANCE_RECEIPT", "native-desktop-receipt/fixture-receipt.json")).resolve()
PORT = int(os.environ.get("ACCEPTANCE_PORT", "4173"))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/__receipt":
            data = {key: values[-1] for key, values in urllib.parse.parse_qs(parsed.query).items()}
            RECEIPT.parent.mkdir(parents=True, exist_ok=True)
            RECEIPT.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
            body = b"ok\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

with Server(("127.0.0.1", PORT), Handler) as server:
    server.serve_forever()

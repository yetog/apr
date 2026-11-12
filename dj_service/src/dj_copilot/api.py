"""Opt-in localhost-only JSON API used by the APR browser UI."""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from urllib.parse import parse_qs, urlsplit

from . import __version__
from .library import get_track_features, list_tracks, track_count

ALLOWED_ORIGINS = {
    "http://localhost:8000", "http://127.0.0.1:8000",
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        params = parse_qs(parsed.query)
        try:
            if parsed.path == "/api/health":
                status, result = 200, {"name": "APR DJ Copilot", "version": __version__,
                                       "track_count": track_count(), "read_only": True}
            elif parsed.path == "/api/tracks":
                status, result = 200, {"tracks": list_tracks(query=params.get("q", [""])[0],
                                         limit=int(params.get("limit", ["30"])[0]))}
            elif parsed.path.startswith("/api/tracks/"):
                track_id = parsed.path.split("/")[-1]
                result = get_track_features(track_id)
                status = 200 if result else 404
                result = result or {"error": "track_not_found"}
            else:
                status, result = 404, {"error": "not_found"}
        except (ValueError, TypeError):
            status, result = 400, {"error": "invalid_request"}
        self.respond(status, result)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.cors_headers()
        self.end_headers()

    def cors_headers(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def respond(self, status: int, data: dict) -> None:
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)


def serve(port: int = 8765) -> None:
    if port < 1024 or port > 65535:
        raise ValueError("port must be between 1024 and 65535")
    address = ("127.0.0.1", port)
    with ThreadingHTTPServer(address, Handler) as server:
        print(f"APR DJ API on http://127.0.0.1:{port}", flush=True)
        server.serve_forever()

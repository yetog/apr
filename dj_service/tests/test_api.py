"""HTTP adapter regression tests using an isolated temporary database."""
from contextlib import contextmanager
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

from dj_copilot.api import Handler
from dj_copilot.library import scan_directory


@contextmanager
def running_api():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


class APITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_db = os.environ.get("APR_DJ_DB")
        os.environ["APR_DJ_DB"] = str(Path(self.temp.name) / "index.sqlite3")
        music = Path(self.temp.name) / "music"
        music.mkdir()
        (music / "My Sample.wav").write_bytes(b"fixture")
        scan_directory(music)

    def tearDown(self):
        if self.old_db is None:
            os.environ.pop("APR_DJ_DB", None)
        else:
            os.environ["APR_DJ_DB"] = self.old_db
        self.temp.cleanup()

    def test_health_tracks_search_and_missing(self):
        with running_api() as base:
            with urlopen(base + "/api/health") as response:
                data = json.load(response)
                self.assertEqual(response.status, 200)
                self.assertTrue(data["read_only"])
                self.assertEqual(data["track_count"], 1)
            with urlopen(base + "/api/tracks?q=Sample") as response:
                tracks = json.load(response)["tracks"]
                self.assertEqual(len(tracks), 1)
                self.assertEqual(tracks[0]["title"], "My Sample")
                self.assertNotIn("path", tracks[0])
            with urlopen(base + "/api/tracks?q=not-present") as response:
                self.assertEqual(json.load(response)["tracks"], [])
            with urlopen(base + "/api/tracks/" + tracks[0]["id"]) as response:
                self.assertEqual(json.load(response)["id"], tracks[0]["id"])
            with self.assertRaises(HTTPError) as ctx:
                urlopen(base + "/api/tracks/missing")
            self.assertEqual(ctx.exception.code, 404)

    def test_invalid_limit(self):
        with running_api() as base:
            with self.assertRaises(HTTPError) as ctx:
                urlopen(base + "/api/tracks?limit=abc")
            self.assertEqual(ctx.exception.code, 400)


if __name__ == "__main__":
    unittest.main()

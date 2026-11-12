import tempfile
import unittest
from pathlib import Path

from dj_copilot.library import connect, get_track_features, list_tracks, scan_directory, track_count


class LibraryTests(unittest.TestCase):
    def test_index_is_read_only_and_queryable(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            music = root / "music"
            music.mkdir()
            sample = music / "Test Beat.wav"
            original = b"test fixture: not real audio"
            sample.write_bytes(original)
            (music / "ignore.txt").write_text("other")
            db = root / "index.sqlite3"
            stats = scan_directory(music, db)
            self.assertEqual(stats["indexed"], 1)
            self.assertEqual(track_count(db), 1)
            self.assertEqual(sample.read_bytes(), original)
            items = list_tracks("Test Beat", database=db)
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["title"], "Test Beat")
            self.assertNotIn("path", items[0])
            track = get_track_features(items[0]["id"], db)
            self.assertEqual(track["id"], items[0]["id"])
            self.assertIsNone(get_track_features("missing", db))
            self.assertEqual(scan_directory(music, db)["indexed"], 1)
            self.assertEqual(track_count(db), 1)

    def test_empty_index(self):
        with tempfile.TemporaryDirectory() as temp:
            db = Path(temp) / "index.sqlite3"
            self.assertEqual(list_tracks(database=db), [])
            self.assertEqual(track_count(db), 0)


if __name__ == "__main__":
    unittest.main()

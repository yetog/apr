"""Local music index. Never writes to original music or Serato data."""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import sqlite3
from typing import Any

EXTENSIONS = {".mp3", ".m4a", ".flac", ".wav", ".aiff", ".aif", ".ogg"}
SCHEMA = """
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    album TEXT NOT NULL DEFAULT '',
    duration_seconds REAL,
    bpm REAL,
    musical_key TEXT,
    file_size INTEGER NOT NULL,
    modified_ns INTEGER NOT NULL
);
"""


def db_path() -> Path:
    return Path(os.environ.get("APR_DJ_DB", str(Path.home() / ".apr-dj" / "library.sqlite3"))).expanduser()


def connect(database: Path | None = None) -> sqlite3.Connection:
    target = database or db_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(target)
    connection.row_factory = sqlite3.Row
    connection.execute(SCHEMA)
    connection.commit()
    return connection


def _first(tag: Any) -> str:
    if tag is None:
        return ""
    if isinstance(tag, (list, tuple)):
        return str(tag[0]) if tag else ""
    return str(tag)


def _metadata(path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {"title": path.stem, "artist": "", "album": "", "duration_seconds": None, "bpm": None, "musical_key": None}
    try:
        from mutagen import File
        audio = File(path, easy=True)
        if audio is None:
            return result
        if audio.info and getattr(audio.info, "length", None) is not None:
            result["duration_seconds"] = round(float(audio.info.length), 3)
        tags = audio.tags or {}
        result["title"] = _first(tags.get("title")) or path.stem
        result["artist"] = _first(tags.get("artist"))
        result["album"] = _first(tags.get("album"))
        raw_bpm = _first(tags.get("bpm"))
        if raw_bpm:
            try:
                bpm = float(raw_bpm)
                if 20 <= bpm <= 300:
                    result["bpm"] = bpm
            except ValueError:
                pass
        result["musical_key"] = _first(tags.get("initialkey") or tags.get("key")) or None
    except (OSError, ValueError, TypeError):
        pass
    return result


def scan_directory(folder: Path, database: Path | None = None) -> dict[str, int]:
    """Index user-selected folder. Does not delete or alter tracks."""
    folder = folder.expanduser().resolve(strict=True)
    if not folder.is_dir():
        raise ValueError("Music path must be a directory")
    scanned = indexed = errors = 0
    with connect(database) as con:
        for root, dirs, files in os.walk(folder, followlinks=False):
            dirs[:] = [d for d in dirs if not (Path(root) / d).is_symlink()]
            for filename in files:
                path = Path(root) / filename
                if path.suffix.lower() not in EXTENSIONS or path.is_symlink():
                    continue
                scanned += 1
                try:
                    stat = path.stat()
                    resolved = str(path.resolve(strict=True))
                    track_id = hashlib.sha256(resolved.encode("utf-8")).hexdigest()[:24]
                    meta = _metadata(path)
                    con.execute(
                        """INSERT INTO tracks
                           (id,path,title,artist,album,duration_seconds,bpm,musical_key,file_size,modified_ns)
                           VALUES (?,?,?,?,?,?,?,?,?,?)
                           ON CONFLICT(id) DO UPDATE SET
                           title=excluded.title,artist=excluded.artist,album=excluded.album,
                           duration_seconds=excluded.duration_seconds,bpm=excluded.bpm,
                           musical_key=excluded.musical_key,file_size=excluded.file_size,
                           modified_ns=excluded.modified_ns""",
                        (track_id, resolved, meta["title"], meta["artist"], meta["album"],
                         meta["duration_seconds"], meta["bpm"], meta["musical_key"], stat.st_size, stat.st_mtime_ns),
                    )
                    indexed += 1
                except (OSError, sqlite3.Error):
                    errors += 1
        con.commit()
    return {"scanned": scanned, "indexed": indexed, "errors": errors}


PUBLIC_COLUMNS = "id,title,artist,album,duration_seconds,bpm,musical_key"


def list_tracks(query: str = "", limit: int = 30, database: Path | None = None) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 100))
    with connect(database) as con:
        term = f"%{query.strip()}%"
        rows = con.execute(
            f"SELECT {PUBLIC_COLUMNS} FROM tracks WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? ORDER BY artist,title LIMIT ?",
            (term, term, term, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def get_track_features(track_id: str, database: Path | None = None) -> dict[str, Any] | None:
    with connect(database) as con:
        row = con.execute(f"SELECT {PUBLIC_COLUMNS} FROM tracks WHERE id=?", (track_id,)).fetchone()
    return dict(row) if row else None


def track_count(database: Path | None = None) -> int:
    with connect(database) as con:
        return int(con.execute("SELECT COUNT(*) FROM tracks").fetchone()[0])

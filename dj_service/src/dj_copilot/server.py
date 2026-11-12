"""MCP entrypoint. The audio index is shared with the APR loopback API."""
from mcp.server.fastmcp import FastMCP

from . import __version__
from .library import get_track_features as lookup, list_tracks as search, track_count

mcp = FastMCP("APR DJ Copilot")


@mcp.tool()
def health_check() -> dict:
    """Check local DJ Copilot status and read-only capabilities."""
    return {"name": "APR DJ Copilot", "version": __version__, "track_count": track_count(),
            "capabilities": ["list_tracks", "get_track_features"], "read_only": True}


@mcp.tool()
def list_tracks(query: str = "", limit: int = 30) -> list[dict]:
    """Search indexed tracks by title, artist or album. Returns metadata only."""
    return search(query=query, limit=limit)


@mcp.tool()
def get_track_features(track_id: str) -> dict:
    """Look up indexed metadata. BPM/key may be null until analysis is added."""
    return lookup(track_id) or {"error": "track_not_found", "track_id": track_id}


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()

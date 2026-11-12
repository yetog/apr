"""Local CLI: index music, run MCP, or run opt-in HTTP API."""
import argparse
from pathlib import Path

from .library import scan_directory


def main() -> None:
    parser = argparse.ArgumentParser(prog="apr-dj")
    subs = parser.add_subparsers(dest="command", required=True)
    scan = subs.add_parser("scan", help="Index a selected music folder without modifying files")
    scan.add_argument("folder", type=Path)
    subs.add_parser("mcp", help="Run MCP server over stdio")
    api = subs.add_parser("api", help="Start loopback-only read-only API")
    api.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    if args.command == "scan":
        print(scan_directory(args.folder))
    elif args.command == "mcp":
        from .server import main as run_mcp
        run_mcp()
    else:
        from .api import serve
        serve(args.port)


if __name__ == "__main__":
    main()

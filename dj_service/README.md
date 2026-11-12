# APR DJ Copilot — Sprint 1

A **read-only** music index with two adapters:
- **MCP over stdio**, for compatible AI clients.
- **HTTP on 127.0.0.1:8765**, for the existing APR browser UI.

The actual Serato integration, beat detection, hot cues, track pairing and dual-deck preview are **not implemented yet**. Existing APR gesture playback stays untouched.

## First run (macOS)

From repository root:

```bash
cd dj_service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[test]"
python -m unittest discover -s tests -v
```

Choose a **small folder of local audio you own**; do not select Serato's internal database:

```bash
apr-dj scan "$HOME/Music/DJ-Test"
apr-dj api
```

In a new terminal:

```bash
curl http://127.0.0.1:8765/api/health
curl "http://127.0.0.1:8765/api/tracks?q=beat"
```

To run the existing APR site in another terminal, from the repository root:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. A new small **DJ Copilot** status panel shows availability and indexed tracks. It is informational only and does not change audio playback.

For MCP, stop the API process only if you want, and run:

```bash
apr-dj mcp
```

MCP is a stdio protocol; it won't show a website or readable terminal chat. To inspect tool calls, use the MCP Inspector (requires Node.js):

```bash
npx @modelcontextprotocol/inspector .venv/bin/apr-dj mcp
```

Inspect and invoke `health_check`, `list_tracks`, and `get_track_features`. The Inspector launches its own web UI.

## Under the hood

`library.py` is the **shared service** backed by SQLite. `server.py` translates requests from AI clients into Python calls; `api.py` translates localhost browser requests into the same Python calls. The browser does not directly connect to the MCP stdio server.

The index is created at `~/.apr-dj/library.sqlite3` unless `APR_DJ_DB` is set. File paths are stored locally but **not included** in API/MCP track responses. No original audio files are written or moved. Re-scanning updates index entries, but doesn't purge entries whose files went missing.

## Security

This feature is opt-in. Do not expose port 8765 to a public network or reverse proxy. The API binds to localhost and only allows browser CORS origins on port 8000. It accepts GET/OPTIONS only. Keep private music files and SQLite indexes out of Git. Do not index arbitrary paths from remote inputs.

## Learning exercises

1. Compare `health_check` called through MCP Inspector with `GET /api/health`.
2. Add a new local test track and re-run `apr-dj scan`; watch the count change.
3. Read `server.py` and observe how the `@mcp.tool()` decorator exposes an ordinary Python function.
4. Add one metadata field to `library.py`, update tests, and inspect its output.

## Next sprint

See [the full DJ Copilot plan](../docs/DJ_COPILOT_PLAN.md): beat grids, phrase segmentation, cue proposals, and eventually mashup suggestions and Serato export.

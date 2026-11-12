# DJ Copilot — Third-Party Integration Decision Record

Status: **researched, not integrated** · 2026-11-12

## Goal

Favor mature, testable components for Serato interoperability and cue analysis. Keep APR's own tool contracts small, versioned and independently testable. **Working upstream != validated on our machine.**

## What is verified from public documentation

| Project | Repo | Upstream description | Integration recommendation | Caveat |
| --- | --- | --- | --- | --- |
| Serato DJ MCP | https://github.com/Venut-Technologies/serato-dj-mcp | TypeScript MCP server for macOS Serato 4.x library/crates/search. Snapshot reads; staged writes enabled by explicit flag. MIT. | **Run as independent MCP server first**, with read-only credentials/mode; evaluate adapter after local smoke tests. | Experimental and reverse-engineered Serato DB. Serato version/build must be tested. |
| Serato Cue Writer | https://github.com/prfalken/serato-cue-writer | Python waveform/drop analysis and MP3 Serato ID3 GEOB cue writing; dry-run and backups. MIT. | **Prototype only on copied test MP3 files**. Normalize its cue proposals to APR's schema before any writer integration. | House/techno heuristics; no guarantee on other genres, files, or Serato builds. |
| CueIt | https://github.com/CurePortal/Cueit | Rust cue engine and multi-platform exporters, alpha status. MIT. | Benchmark separately against manually annotated test tracks; optional future engine. | Alpha; additional Rust/FFI operational complexity. |
| Official MCP Python SDK | https://github.com/modelcontextprotocol/python-sdk | MCP server/client, latest stable v2, Python 3.11+. MIT. | **Direct dependency for APR**. Use `MCPServer` v2 API and pin compatible range. | Breaking API from v1 FastMCP; tests must verify current v2 integration. |

Source repositories may change; pin commit/version during integration. This is an evaluation, not a security audit.

## Why not just copy all the code?

- There are **two distinct concerns**: a Serato-library MCP server and a Serato MP3 hot-cue writer. Neither solves multi-track sample discovery or APR dual-deck preview.
- We can **run the existing Serato MCP as a second server** in the same AI client. We don't need to turn a TypeScript server into Python before learning whether its read-only tools work.
- A Python cue engine can be run as an optional subprocess or library later. We should first compare output contracts and confirm source licenses/attribution, dependencies, and performance.
- All write operations must be separately gated by human approval and backups. In particular, don't execute a third-party cue writer against your real music collection.

## Target integration topology

```text
AI MCP client (e.g. local desktop coding assistant)
    ├── APR DJ Copilot (Python MCP v2; our library index + future cue/mashup tools)
    └── Serato DJ MCP (existing TypeScript server; read-only Serato 4.x browsing)

APR browser UI
    └── 127.0.0.1:8765 local API
         └── APR DJ service (same Python domain logic)
              ├── metadata index
              ├── future cue proposal adapter (Serato Cue Writer or CueIt)
              └── future pairing analysis
```

A host can call both MCP servers, but **one MCP server does not implicitly call another**. To surface Serato data directly inside APR UI, implement a separate explicit, scoped adapter / client layer later.

## Current Sprint 1 focus (MCP reliability)

1. **Build:** Python 3.11+ and `mcp>=2,<3`, check imports and compile; correct CI before adding integrations.
2. **Inspect:** Register/discover `health_check`, `list_tracks`, `get_track_features` with MCP Inspector, ensure correct argument/result schemas and error behavior.
3. **Data:** Index an explicit *test* folder, confirm stable IDs and no changes to source audio.
4. **UI:** Run APR and verify optional browser panel never blocks gestures or Tone.js playback when service is offline.
5. **Serato research spike:** Independently install/run Venut's read-only server, verify `list_libraries`, `list_crates`, and track search on the actual macOS/Serato version. Do not enable `--allow-writes` or raw SQL.
6. **Safety:** Avoid code injection, network access beyond localhost, credential/audio upload, and unreviewed repository merges.

### Acceptance matrix

| Test | Expected | Status |
| --- | --- | --- |
| APR Python compile + unit tests in CI | Green | Pending new run |
| `health_check` via MCP Inspector | Valid structured output | Pending local |
| `list_tracks` via MCP Inspector | Return indexed metadata | Pending local |
| `get_track_features` via MCP Inspector | Return one record or not-found | Pending local |
| Read-only Serato MCP on user's Mac | Library and crates visible | Pending local |
| APR gesture playback and UI | No regression | Pending local |
| Cue writer on copied MP3 | Verified backup + audible audio unchanged | Future |

## Next specific action after both MCP servers pass

Introduce a **canonical track metadata adapter** with a known Serato track ID ↔ APR track ID mapping and explicit provenance fields. Then prototype `propose_hot_cues` using a dry-run source adapter and evaluation fixtures.

## Sources (upstream, to independently verify)

- https://github.com/Venut-Technologies/serato-dj-mcp
- https://github.com/prfalken/serato-cue-writer
- https://github.com/CurePortal/Cueit
- https://github.com/modelcontextprotocol/python-sdk

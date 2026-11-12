# APR — DJ Copilot: Product, Architecture & MCP Development Plan

> Status: Planning / discovery. Updated: 2026-11-12  
> Target repository: `yetog/apr`  
> Working platform: macOS, current Serato DJ Pro (exact installed build to verify)  
> Scope: Extend APR, **not** build a new DJ app or repository.  
> Delivery: No audio modifications or Serato writes in this planning phase.

## 1. Executive summary

APR (Gesture DJ Controller) will evolve into a local-first DJ practice, track-analysis and mashup-discovery tool, while retaining its gesture-controlled visualizer. Its two flagship outcomes are:

1. **Automatic hot-cue proposals**: Identify DJ-relevant sections (first usable beat, intro, verse/vocal entry, build, drop, breakdown, outro, mix-out); snap candidate timestamps to a validated beat/bar grid; preview and approve them; eventually export to Serato where compatible.
2. **Sampling and mashup suggestions**: Recommend *specific time ranges* of songs to layer (e.g., Track B vocal bars 17–25 over Track A instrumental bars 33–41), with BPM/key/phrase/energy/conflict explanations and an in-app A/B preview.

An MCP server makes these capabilities callable from compatible AI clients. The **analysis engine must also work without MCP or any LLM**. Start with offline batch analysis; live performance support is a later feasibility study.

## 2. Existing code audit (verified by reviewing repository files)

**Repository**: https://github.com/yetog/apr — public MIT-licensed web application. Do not upload copyrighted audio, personal library data, Serato databases, API keys or cached stems to this public repository.

| File | Current role | Planned extension |
| --- | --- | --- |
| `MusicManager.js` | Tone.js player, local/URL track list, effect chain, playback callbacks | Add read-only track ID/metadata bridge; later dual-deck preview |
| `WaveformVisualizer.js` | Three.js reactive waveform and DJ indicators | Add cue markers, phrase overlays, proposed-layer timeline |
| `UIManager.js` | Import, playlist, sidebar and controls | Add analysis panel, cue review, matched-track panel |
| `main.js` | Wires MusicManager, UIManager and Game; adds demo tracks | Add opt-in local API client when available |
| `game.js` | MediaPipe gesture interactions | Preserve existing gestures; add new ones only after regression tests |
| `package.json` | Minimal static web app; CDN dependencies | Keep the UI independent of Python server runtime |

**Important findings:** Current `MusicManager.js` explicitly uses a single Tone.Player and labels crossfader movement as **visual-only**. The reactive waveform is not yet a deterministic, time-indexed song overview; cue-marker positioning needs a separate offline waveform/timeline representation. Do not claim live Serato deck control or stems already exist.

## 3. User stories and UX

### Automatic hot cues
- Import a local track; click **Analyze**.
- See detected BPM, beat/downbeat grid, musical sections and confidence levels.
- Show up to eight *proposed* cue labels/colors on a seekable waveform.
- Play 8/16/32-beat loops around each proposal; drag, relabel, delete, or lock cues.
- Save cue decisions in app-owned storage, independently of Serato.
- Export only after supported format/version tests, backups and explicit approval.

### Mashup/sampling discovery
- Select anchor track and context: vocals-over-instrumental, percussion overlay, transition, sample loop, or open-format blend.
- Rank candidates by BPM/stretch ratio, estimated key compatibility, phrase length, downbeats, energy and spectral/vocal conflict.
- Show **why** a pair was recommended and *where* to mix: source timestamps, bars, suggested pitch/tempo adjustments.
- Preview aligned snippets in two decks with per-deck volume/EQ; then rate/save a pairing.
- Optional future stem separation for vocals/drums/bass/other when locally available.
- Do not assume key/BPM matching alone guarantees a musically good mashup. Mark source separation, vocal activity and compatibility as estimates.

### Example output contract
```json
{
  "anchor_track_id": "track_a",
  "candidate_track_id": "track_b",
  "anchor_section": {"start_seconds": 72.0, "end_seconds": 88.0, "role": "instrumental"},
  "candidate_section": {"start_seconds": 35.0, "end_seconds": 51.0, "role": "vocal"},
  "tempo": {"target_bpm": 122, "stretch_ratio": 1.025},
  "recommendation": "Align phrase starts; audition vocals over the instrumental bed",
  "reason_codes": ["phrase_alignment", "tempo_proximity", "vocal_instrumental_complement"],
  "confidence": 0.72,
  "warnings": ["Manual listening required", "Key is estimated"]
}
```
Values above are illustrative test fixtures, not measurements of real tracks.

## 4. Architecture

```text
APR web UI (Three.js / Tone.js / MediaPipe)
  ├─ Visualizer + cue preview + mashup preview
  └─ Opt-in local API client (HTTP localhost, explicit CORS)
                           │
                   Local DJ service (Python)
                     ├─ REST adapter for APR UI
                     ├─ MCP server (stdio for local AI clients)
                     ├─ Shared domain services
                     │   ├─ library index (SQLite)
                     │   ├─ audio features / beat grid / sections
                     │   ├─ hot-cue proposal engine
                     │   ├─ mashup recommendation engine
                     │   └─ export / adapters
                     └─ Serato reader / optional future writer
                           │
                    User-owned audio files
```

**Separation of concerns**: MCP is a tool protocol, **not** the waveform/DSP engine and not a direct Serato API. A local UI-to-backend API and the MCP server call the *same* Python services. Start Python + official MCP SDK, Mutagen, NumPy/librosa, SQLite; benchmark Essentia and optional stem separation later. Use pinned dependencies and inspect licenses before adopting third-party code. APR can remain static when the service is offline.

**Privacy/security**: Bind the local API to `127.0.0.1`; restrict origins, paths and file size; validate local-file access, protect against path traversal and arbitrary URL fetches; no automatic shell or Serato write permissions. Avoid remote audio upload by default. Use test copies, independent backups, audit logging and human confirmation before any cue/crate writing. Never commit audio/library dumps or stems.

## 5. Candidate open-source research (evaluate, not yet integrated)

- [Serato DJ MCP](https://github.com/Venut-Technologies/serato-dj-mcp): reference for Serato library/crate discovery and MCP conventions. Check version, maintenance, permissions and license.
- [Serato Cue Writer](https://github.com/prfalken/serato-cue-writer): potential cue-analysis/metadata writer reference. Validate cue formats, limitations, safety and license against owned test MP3s.
- [CueIt](https://github.com/CurePortal/Cueit): reference for beat grids, structure and cue workflows. Evaluate maturity and export compatibility.
- [DJ Crate](https://github.com/hacksics/dj-crate): reference for match ranking / crates.
- [Official Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk): server/tool development.

**Do not paste or merge source just because it is publicly available.** Review dependencies, licensing, code quality and capabilities; choose dependency, fork or clean reimplementation accordingly. Confirm actual installed Serato build and format on macOS before planning a writable adapter.

## 6. Proposed MCP tool contracts

| Tool | Input | Output | Stage |
| --- | --- | --- | --- |
| `health_check` | none | server/version/capabilities | S1 |
| `list_tracks` | limit/filters | track metadata (not raw audio) | S1 |
| `get_track_features` | track_id | BPM/key/confidence/sections | S1–2 |
| `analyze_track` | track_id | analysis job/result | S2 |
| `propose_hot_cues` | track_id, cue_count, policy | numbered cue candidates + evidence | S2 |
| `recommend_mashups` | anchor_track_id, goals, limit | ranked compatible section pairs | S3 |
| `explain_pairing` | two IDs + sections | musical rationale and warnings | S3 |
| `save_cue_proposal` | track_id + edited cues | app-owned proposal version | S2 |
| `preview_alignment` | pair + bars | preview plan, **not** sound streamed through MCP | S3 |
| `export_serato_cues` | track_id + confirmation token | dry-run/backup/export receipt | S4 (gated) |

All tools return structured, inspectable JSON; use stable IDs and schema/version fields. Analysis jobs report progress/errors. Read-only tools are the default; all write tools require explicit opt-in and scoped permissions.

## 7. Implementation milestones and acceptance criteria

### Sprint 0 — Audit and environment (no production edits)
- [ ] Confirm macOS version, Serato version/build, installed Python and local MCP client.
- [ ] Run APR locally, capture baseline gesture/playback/visualizer behavior.
- [ ] Inspect full code paths and determine integration seam.
- [ ] Check licenses, maintenance and exact features of candidate repos.
- [ ] Gather **three user-owned test tracks** with varying tempo/structure; keep them outside Git.
- **Done when:** APR baseline is reproducible and architecture decisions are recorded.

### Sprint 1 — First real MCP server (learn by doing)
- [ ] `dj_service/` Python package inside **existing APR repository**.
- [ ] SQLite track index + deterministic fixture mode; read-only local-file scanner.
- [ ] `health_check`, `list_tracks`, `get_track_features` implemented and unit tested.
- [ ] Run MCP Inspector; use a compatible client to invoke tools; document each request/response.
- [ ] Add opt-in local API for APR UI and graceful offline fallback.
- **Done when:** APR can display indexed metadata and a local AI client can successfully call the same data via MCP.

### Sprint 2 — Auto hot cues
- [ ] Offline BPM, beat/downbeat and section estimation; confidence and manual overrides.
- [ ] Proposed color-coded intro/vocal/build/drop/breakdown/outro cue semantics.
- [ ] Beat/bar quantization, no duplicate timestamps, max 8 cues configurable.
- [ ] APR seekable overview waveform with cue preview/editor; save in app database only.
- [ ] Compare cue timing to manually annotated tracks; document failure cases.
- **Done when:** DJ can load owned test tracks, approve/edit cues, save them, and reopen unchanged.

### Sprint 3 — Mashup intelligence + preview
- [ ] Feature cache, BPM/key candidate filtering and section-pair scoring.
- [ ] Vocal-vs-instrumental occupancy / spectral overlap heuristics.
- [ ] Time-aligned 2-deck Tone.js preview (real audio paths, separate levels and seek positions).
- [ ] Explainable pairing list with timestamps, bars, confidence and saved favorites.
- **Done when:** User can audition at least three recommended pairs and compare their scores to blind listening ratings. Recommendations need not always be correct.

### Sprint 4 — Serato interoperability (separate approval gate)
- [ ] Confirm library format and test on **copies**, with known-good tracks and backups.
- [ ] Validate read-only Serato metadata/crate import.
- [ ] Prototype dry-run cue export; document unsupported file types/formats.
- [ ] Explicit backup, per-track preview, manual approval, rollback and post-write Serato verification.
- **Done when:** A limited verified cue-export workflow survives reopen in the installed Serato version without corrupting test tracks. Otherwise remain read-only.

### Future / out of MVP
Live Serato deck telemetry, hardware/DDJ-FLX4 MIDI control, auto-playing blends, automatic sample extraction, advanced stem separation, performance history and self-tuning preference models. These require separate feasibility/security/performance work.

## 8. MCP learning curriculum (each lesson ships a working artifact)

1. **Protocol mental model**: client vs server vs tools/resources/prompts; local stdio; inspect requests.
2. **Hello-world tool**: register `health_check`, call via MCP Inspector, trace JSON.
3. **Typed inputs/results**: implement `list_tracks`, argument validation, errors, fixtures.
4. **Shared service layer**: expose a Python service in both MCP and local HTTP API.
5. **Deterministic analysis**: separate expensive background DSP jobs from instant tool calls.
6. **Write safety**: permission boundaries, dry-run vs commit, backups, test fixtures.
7. **Portability**: make tools usable by multiple compatible MCP clients; document config.

For each lesson: why it works, source code walkthrough, terminal commands, expected JSON, one experiment and one regression test. Do not replace learning objectives with unexplained automation.

## 9. Open technical decisions / risks
- **Serato format**: current macOS Serato build and source-file types must be observed before promising metadata writes; do not rely on an unsupported private API.
- **Dual deck**: current one-player architecture and visual-only crossfader must be redesigned for *auditioning*, not confused with live Serato control.
- **Waveform semantics**: live reactive waveform is not a seekable full-track waveform; add a precomputed overview.
- **Key/structure accuracy**: report confidence; allow correction; evaluation based on actual listening.
- **Latency**: offline analyze/cache first; target responsive UI even during long analyses.
- **Licensing**: repo APR is public MIT; do not imply candidate third-party code is MIT or permissioned until reviewed.
- **Copyright**: only analyze audio the user has rights to access; keep private audio local and do not distribute derived stems.
- **Deployment**: browser cannot arbitrarily scan the Mac file system; local service requires explicit user-scoped folder selection / permission.

## 10. Recommended next engineering PR
**PR title**: `feat(dj-copilot): add read-only local MCP skeleton and fixture-backed track index`

**Files (proposed)**:
```text
docs/DJ_COPILOT_PLAN.md
dj_service/pyproject.toml
dj_service/src/dj_copilot/{server.py,library.py,models.py,api.py}
dj_service/tests/{test_server.py,test_library.py}
dj_service/README.md
```
Begin with an isolated branch, preserve existing baseline and keep all new functionality opt-in. This document is a living spec: record decisions and evidence, update acceptance criteria as implementation changes.

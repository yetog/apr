# APR DJ Copilot — Sprint 1 QA Checklist

**Status:** Ready for macOS local validation  
**Branch:** `feature/dj-copilot-sprint-1` · **PR:** [#1](https://github.com/yetog/apr/pull/1)  
**Owner:** Local tester · **Date:** __________ · **macOS:** __________ · **Python:** __________ · **Node:** __________  
**Serato version/build:** __________ (informational; **do not write to Serato**)

> Goal: Prove the local MCP tools can be discovered and called, the library index works, the APR browser UI remains usable, and no original audio or Serato data is changed. This is **not** a hot-cue or mashup acceptance test.
>
> Check each box only after observing the expected result. Record **PASS / FAIL / BLOCKED**, actual output and screenshots/errors below. Keep audio files and SQLite databases out of GitHub.

## 0. Preparation / terminal map

Use **four terminal tabs** when needed:
- **A — Setup/indexing:** virtualenv, tests and `apr-dj scan`
- **B — Local API:** `apr-dj api` (stays running)
- **C — APR UI:** `python3 -m http.server 8000` from repository root (stays running)
- **D — MCP Inspector:** Inspector command from `dj_service`

Commands below assume a **fresh clone**. If the repo is already cloned, use `git fetch origin && git switch feature/dj-copilot-sprint-1 && git pull --ff-only origin feature/dj-copilot-sprint-1` instead of cloning again.

## 1. Repository & environment

- [ ] **1.1** Clone the correct branch:
  ```bash
  git clone -b feature/dj-copilot-sprint-1 https://github.com/yetog/apr.git
  cd apr
  ```
  **Expected:** Working tree is on `feature/dj-copilot-sprint-1`.
- [ ] **1.2** Confirm `git branch --show-current` prints `feature/dj-copilot-sprint-1`.
- [ ] **1.3** Run `python3 --version`. **Expected:** Python **3.11+**.
- [ ] **1.4** Run `node --version && npm --version`. **Expected:** both available for Inspector.
- [ ] **1.5** Confirm `dj_service/README.md`, `dj_service/src/dj_copilot/server.py` and `DJCopilotClient.js` exist.

## 2. Install & unit tests (Terminal A)

```bash
cd dj_service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[test]"
python -m compileall -q src tests
python -m unittest discover -s tests -v
```

- [ ] **2.1** Editable install completes without errors.
- [ ] **2.2** Compilation completes without errors.
- [ ] **2.3** Unit tests report `OK` and no failures.
- [ ] **2.4** `apr-dj --help` shows `scan`, `mcp`, `api`.

**If failing:** Paste the exact terminal traceback into the QA report. Check `which python` and `python --version` after activating `.venv`.

## 3. Local music index (Terminal A)

Create a small test folder and **manually copy 3–5 tracks you own** into it. Include multiple formats if available. Do not point the scanner at Serato's internal databases.

```bash
mkdir -p "$HOME/Music/DJ-Test"
apr-dj scan "$HOME/Music/DJ-Test"
```

- [ ] **3.1** Scan returns `scanned`, `indexed`, `errors`; `indexed` equals number of supported, readable audio files.
- [ ] **3.2** `errors` is zero.
- [ ] **3.3** Scan the same folder again; indexed records do **not** duplicate.
- [ ] **3.4** Verify original files are still in place and playable. Scanner must not move/rename/modify them.
- [ ] **3.5** Remember: BPM/key may be `null` unless embedded metadata is present. No audio feature estimation exists in Sprint 1.

## 4. Local HTTP API (Terminal B)

From `apr/dj_service`, activate `.venv` and run `apr-dj api`. Keep this tab running.

In a **new** terminal tab:
```bash
curl -s http://127.0.0.1:8765/api/health
curl -s "http://127.0.0.1:8765/api/tracks?limit=5"
curl -s "http://127.0.0.1:8765/api/tracks?q=test"
```

- [ ] **4.1** Health returns `name`, `version`, `track_count` and `read_only: true`.
- [ ] **4.2** Track list contains the indexed tracks, with `id`, `title`, `artist` and optional metadata.
- [ ] **4.3** Search filters by title, artist or album.
- [ ] **4.4** Responses **do not expose absolute audio file paths**.
- [ ] **4.5** Unknown ID returns HTTP 404: `curl -i http://127.0.0.1:8765/api/tracks/does-not-exist`.
- [ ] **4.6** API listens on localhost only. Do not expose or port-forward it.

## 5. MCP Inspector — highest priority (Terminal D)

From `apr/dj_service`:
```bash
source .venv/bin/activate
npx @modelcontextprotocol/inspector .venv/bin/apr-dj mcp
```
Open the Inspector URL printed in Terminal. Select/connect to the local stdio server if prompted. Inspector may install an npm package on first use.

- [ ] **5.1** Inspector launches and connects without a transport/protocol error.
- [ ] **5.2** **Tools discovery:** `health_check`, `list_tracks`, `get_track_features` appear.
- [ ] **5.3** Invoke `health_check`; check `read_only: true` and count.
- [ ] **5.4** Invoke `list_tracks` with `query=""`, `limit=5`; verify results.
- [ ] **5.5** Invoke `list_tracks` with an actual track title; verify filtering.
- [ ] **5.6** Copy an ID from the list into `get_track_features`; verify metadata matches.
- [ ] **5.7** Invoke `get_track_features` with `track_id="missing"`; verify structured not-found response.
- [ ] **5.8** Invoke `list_tracks` with `limit=10000`; verify bounded output (max 100).
- [ ] **5.9** No Serato database is modified and no track audio is uploaded.

**Example health payload (track count is illustrative):**
```json
{
  "name": "APR DJ Copilot",
  "version": "0.1.0",
  "track_count": 5,
  "capabilities": ["list_tracks", "get_track_features"],
  "read_only": true
}
```

## 6. APR browser UI / regression (Terminal C)

From **repository root** (not `dj_service`):
```bash
python3 -m http.server 8000
```
Open http://localhost:8000.

- [ ] **6.1** Existing APR page renders.
- [ ] **6.2** DJ Copilot panel displays connected status and track count when API is running.
- [ ] **6.3** Imported/demo tracks still play and pause normally.
- [ ] **6.4** Existing waveform/visualizer still reacts.
- [ ] **6.5** Camera/gesture interactions still work after permissions are granted.
- [ ] **6.6** Stop `apr-dj api`, refresh APR. Panel should report offline without breaking playback.
- [ ] **6.7** Browser developer console contains no unexpected uncaught errors (network connection refusal while API is intentionally stopped is expected).

## 7. Safety & readiness

- [ ] **7.1** No original audio files have been changed.
- [ ] **7.2** No Serato crate/hot-cue/database changes have occurred.
- [ ] **7.3** No personal music files or `~/.apr-dj/library.sqlite3` have been committed.
- [ ] **7.4** Tests 5.1–5.7 pass before calling MCP integration complete.
- [ ] **7.5** Existing APR UI remains functional with service online and offline.
- [ ] **7.6** All failures are captured with exact command, terminal output and reproduction steps.

## Results & bug report template

**Tester:**  
**Date / macOS / Python / Node:**  
**Branch and commit (`git rev-parse --short HEAD`):**  
**Tracks indexed:**  
**Unit tests:** PASS / FAIL / BLOCKED  
**MCP discovery + calls:** PASS / FAIL / BLOCKED  
**Local API:** PASS / FAIL / BLOCKED  
**APR playback / gesture regression:** PASS / FAIL / BLOCKED  
**No Serato/audio modifications:** CONFIRMED / NOT CONFIRMED

### Bugs
| ID | Test ID | Severity | Expected | Actual | Repro steps | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| QA-001 | | | | | | |

### Follow-up decisions
- [ ] Resolve blockers and rerun failed checks.
- [ ] Review CI status and approve PR #1 only after local validation.
- [ ] Start separate read-only Serato MCP compatibility spike.
- [ ] Plan Sprint 2 cue analysis after MCP reliability is proven.

**Reference:** [Sprint 1 service README](../dj_service/README.md) · [Integration decision record](EXTERNAL_MCP_INTEGRATION.md) · [Product plan](DJ_COPILOT_PLAN.md)

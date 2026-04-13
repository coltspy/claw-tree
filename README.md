# claw-tree

A visual workflow builder and chat interface for the **claw** agent CLI
(a Rust reimplementation of Claude Code). Talk to the agent in a terminal
or in your browser, design multi-step workflows as graphs, run them end-to-end,
and let nodes share memory via session continuity.

claw-tree is a monorepo containing:

- A **customized fork of claw-code** (in `rust/`) — the agent binary that
  actually talks to Anthropic / OpenAI. See [`UPSTREAM.md`](./UPSTREAM.md)
  for the upstream project's own docs.
- A **SvelteKit web app** (in `apps/web/`) — a visual canvas where you drag
  nodes, connect them, configure prompts per step, and click Run. Also
  includes a chat panel for direct conversations.

The Rust binary is patched to emit `[claw-tree-session]` and
`[claw-tree-usage]` markers on stderr so the web side can capture session IDs
and cost data per invocation. It also accepts `-p` + `--resume` together,
which upstream claw does not — that's what makes cross-node session
continuity possible.

## Quickstart

Prerequisites: **Node.js 20+**, **Rust 1.80+**, and **git**.

```bash
# From the repo root:
./setup.sh                  # macOS / Linux    (normal setup)
./setup.sh --global         # same, plus install `claw` on your PATH
.\setup.ps1                 # Windows PowerShell
.\setup.ps1 -Global         # same, plus install `claw` on your PATH

# Then launch everything with one command:
./claw-tree.sh              # macOS / Linux
.\claw-tree.ps1             # Windows
# OR start manually:
cd apps/web && npm run dev
# Open http://localhost:5173
```

> **`--global` installs `claw` via `cargo install --path` into `~/.cargo/bin`.**
> After that, you can type `claw` from any terminal (terminal mode) without
> specifying the full path to the binary. The web UI always uses the debug
> build at `rust/target/debug/claw.exe` regardless of whether you installed
> globally, so both paths always work.

On first launch, click the **gear icon** in the top-right of the toolbar
and paste your Anthropic API key. It's stored in browser localStorage and
sent from your browser to the local SvelteKit server, which passes it to
the claw subprocess as an environment variable. Nothing leaves your machine
except the API call to Anthropic.

## The three modes

claw-tree is designed around a simple idea: **one agent, three interfaces.**
Everything runs against the same `claw` binary, and sessions are portable
between them.

### 1. Web workflow mode

Open the browser, drag nodes from the left sidebar onto the canvas, connect
them, and click Run. Each node is a claw invocation — configure its prompt,
model, permission mode, failure policy, and whether it continues the
upstream node's session. The engine topologically sorts the graph, runs
nodes in parallel where possible, streams output live, and surfaces cost +
token counts per node.

Features:

- Five node types plus a Pause node for human approval
- Conditional edges (`output.includes('ERROR')` gates a branch)
- Parallel execution by depth group
- Retry with exponential backoff
- Run history panel (localStorage, 50 runs)
- Output drawer with the full stream of the focused node
- Undo/redo + keyboard shortcuts (`Ctrl+Enter`, `Ctrl+S`, `Ctrl+Z`, `Del`)
- Save/Load workflows as `.clawtree.json`
- Per-node permission mode + allowed-tools whitelist
- Per-node output compression (off / lite / full) to reduce token cost on
  intermediate nodes — inspired by [Caveman](https://github.com/JuliusBrussee/caveman)

### 2. Chat mode (in-browser)

Click the **Chat** button in the toolbar. A right-side panel opens with a
normal conversation UI. Messages stream live. Each chat has its own session,
and the session ID is visible in the header. Cost + tokens shown per
message.

### 3. Terminal mode (no UI)

For quick one-off agent tasks, run `claw` from a terminal:

```bash
./rust/target/debug/claw                                # interactive REPL
./rust/target/debug/claw -p "refactor my tests" --print # one-shot
./rust/target/debug/claw --resume latest                # continue last session
```

### Cross-mode session continuity

This is the key thing. Every claw invocation writes its session to
`.claw/sessions/<id>.jsonl`. Three consequences:

1. A chat you start in the **terminal** can be continued from a workflow
   node: toggle "Continue session" on the node, and it will resume the
   upstream node's session (or the latest).
2. A workflow node's session can be continued in the **web chat panel**:
   new chat messages can reuse a session ID from any prior claw invocation.
3. A web chat session is visible to the terminal: `claw --resume <id>`
   picks it up.

One agent, portable memory, three UIs.

## Architecture

```
Browser
  ├── Canvas (Svelte Flow) ──────┐
  ├── Chat panel ────────────────┤
  └── Settings / runs / history ─┤
                                 │  HTTP (fetch, streamed body)
                                 ▼
SvelteKit dev server (Node)
  ├── /api/run      spawns `claw -p <prompt> [--resume <id>]`
  └── /api/health   spawns `claw --version`
                                 │  child_process.spawn
                                 ▼
claw.exe  (Rust, built from rust/crates/rusty-claude-cli)
  ├── Session state → .claw/sessions/<id>.jsonl
  └── HTTPS → Anthropic / OpenAI API
```

The whole stack is localhost. Your API key and session data stay on your
machine. The only outbound call is claw → the LLM provider.

## Fork patches

Three patches to `rust/crates/rusty-claude-cli/src/main.rs` vs. upstream
claw-code:

1. **`-p` + `--resume` combo** — the one-shot flag originally returned
   before `--resume` was parsed. We pre-scan the args in the `-p` branch
   and thread the resume reference into the Prompt dispatch, and added
   `LiveCli::resumed()` that loads an existing session via the existing
   `resolve_session_reference` + `Session::load_from_path` helpers.
2. **Session ID marker** — `eprintln!("[claw-tree-session] {id}")` fires
   right after the session handle is created, so the web side can capture
   it from stderr.
3. **Usage marker** — `eprintln!("[claw-tree-usage] cost_usd=… input=… output=…")`
   fires at the end of every completion path (text, compact, JSON). Gives
   cost tracking without requiring JSON output mode.

Upstream claw can still be merged in via `git remote add upstream
https://github.com/ultraworkers/claw-code.git` + `git merge upstream/main`.

## Docker

```bash
docker compose up
# open http://localhost:5173
```

The Dockerfile is multi-stage: Rust release build for `claw`, Node slim
image for the web runtime. A `./workspace` volume is mounted into the
container so claw can operate on real files. API keys can be set via the
`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` environment variables OR pasted
into the settings page at runtime.

## Example workflows

Three starter workflows live in [`examples/`](./examples). Open the web UI,
click **Load** in the toolbar, and pick one:

- **`hello-world.clawtree.json`** — a single Custom node that says hi.
  Use this to verify your API key works end-to-end.
- **`plan-then-audit.clawtree.json`** — Plan → Security (read-only) →
  Summarize → Pause. Demonstrates chain-of-thought, session continuity
  between plan and audit, and human sign-off.
- **`test-gate.clawtree.json`** — Test → Review → **conditional branch**:
  if failures, summarize them; if green, confirm with a second model →
  Pause. Demonstrates conditional edges and parallel-capable fanout.

## Development

```bash
# Web
cd apps/web
npm run dev             # Vite dev server
npm run check           # Type check
npm run test:unit       # Vitest unit tests (engine)
npm run lint
npm run format

# Rust
cd rust
cargo build -p rusty-claude-cli
cargo test -p rusty-claude-cli
cargo fmt
cargo clippy
```

## Acknowledgments

- **[claw-code](https://github.com/ultraworkers/claw-code)** — the upstream
  Rust agent binary that claw-tree forks and extends.
- **[Caveman](https://github.com/JuliusBrussee/caveman)** — the output
  compression technique used in claw-tree's per-node compression feature is
  inspired by Caveman's approach to token reduction via prompt engineering.

## License

The Rust portion inherits its license from upstream claw-code — see
[`UPSTREAM.md`](./UPSTREAM.md) and `rust/` for details. The Svelte UI and
tooling in this repo are MIT unless noted otherwise.

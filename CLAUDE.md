# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this is

claw-tree is a visual workflow builder + chat interface for the claw agent CLI.
It is a monorepo with two main parts:

- `rust/` — a forked Rust workspace from claw-code (the agent binary)
- `apps/web/` — a SvelteKit web app (the visual UI)

The web app spawns `claw` as a child process per workflow node. Sessions are
shared across all interfaces (web canvas, chat panel, terminal) via
`.claw/sessions/<id>.jsonl` files.

## Stack

- **Rust** (agent binary): Tokio, reqwest, serde, crossterm
- **TypeScript/Svelte** (web UI): SvelteKit, Svelte 5, Svelte Flow, Tailwind v4, Vitest

## Verification

### Web (from `apps/web/`)
```
npm run check          # svelte-check (TypeScript + Svelte)
npm run test:unit      # Vitest engine tests (toposort, validate, interpolate, conditions)
npm run lint           # ESLint + Prettier
```

### Rust (from `rust/`)
```
cargo fmt
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build -p rusty-claude-cli
```

## Repository shape

- `rust/crates/rusty-claude-cli/` — the `claw` binary (3 fork patches in `src/main.rs`)
- `rust/crates/api/` — Anthropic/OpenAI HTTP client (1 fork patch in `providers/anthropic.rs`)
- `apps/web/src/lib/stores/` — Svelte 5 rune stores (workflow, execution, runs, settings, chat, cache, library, history, ui, canvas)
- `apps/web/src/lib/engine/` — pure TS execution logic (toposort, validate, interpolate, conditions) with unit tests
- `apps/web/src/lib/components/` — UI components
- `apps/web/src/routes/api/` — SvelteKit server endpoints (`/api/run`, `/api/health`)
- `examples/` — example `.clawtree.json` workflow files (also in `apps/web/static/examples/`)
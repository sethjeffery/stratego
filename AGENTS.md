# AGENTS.md — Stratego Pulse Arena

## Overview

Stratego Pulse Arena is a browser-based, two-player Stratego-inspired game.

- Frontend: React + Vite
- Realtime and persistence: Supabase direct mode
- Rules and pieces are data-driven from `config/rules/default.json` and `config/pieces/classic.json`

This file exists to preserve project intent, deployment assumptions, and working constraints for future agents.

## Core Product Intent

### 1. Hidden-information board game first

The game should feel like a real hidden-information board game, not an arcade tactics game.

- Enemy pieces remain hidden until revealed by game state.
- Local player identity matters because visibility depends on ownership.
- Refresh/rejoin/resume flows must preserve which side the device is playing.

Any change that weakens identity continuity or information hiding is probably wrong.

### 2. Supabase mode is the primary hosted path

Vercel deployments should work without a custom game backend.

- Client-side Supabase envs are supported.
- Session identity is persisted locally per device.
- The active session is mirrored into the URL as `?session=CODE`.
- `?debugBoard=1` is a local visual-debug route and must not depend on Supabase.

When changing session flow, treat Supabase direct mode as the primary production path.

### 3. Visual clarity beats visual novelty

The board can be stylized, but interaction and game readability remain the priority.

- Pieces must remain legible on desktop and mobile.
- Hidden pieces must still read as hidden.
- Projected/perspective board changes must keep click targets accurate.
- Lake cells and blocked cells must remain obvious.

If a visual change makes ownership, selection, or board geometry harder to read, it is a regression.

## Important Current Behaviors

### Session persistence

- Device-local session memberships default to `localStorage`, but can be switched via `VITE_SESSION_STORAGE_MODE` to `sessionStorage` or in-memory storage.
- The dashboard of resumable sessions is local to the current device, not account-wide.
- Loading a session by code or URL without a saved local membership should not silently assign control.
- Fixture debug flows can intentionally impersonate a seat using URL params (`fixture` + `as`) for deterministic testing.

Avoid reintroducing any flow where knowing a session code alone grants player identity.

### Board rendering

- The main board is rendered with an SVG surface plus absolutely positioned interactive hit targets.
- Piece depth/perspective is driven by projection math in `src/App.tsx`.
- `?debugBoard=1` provides a deterministic local board state for visual tuning.

When adjusting the board renderer, visually inspect it in a browser rather than relying on code alone.

## Working Rules For Agents

1. Prefer small, testable changes over broad rewrites.
2. When touching the board renderer, use the local debug route and capture screenshots through the Playwright MCP server when available.
3. When changing session logic, test refresh/resume behavior and local player identity.
4. Prefer in-memory game service + fixtures when validating session UX locally (`VITE_GAME_SERVICE_MODE=memory` and `src/fixtures/sessionRows.ts`).
5. Preserve data-driven configuration instead of hardcoding piece or ruleset logic into UI code.
6. Do not expose Supabase secret/service keys to client code.

## Code Organization & Quality Standards

- Keep boundaries explicit:
  - `src/screens/*` orchestrates user flows and routing-level decisions.
  - `src/components/*` owns reusable UI primitives and visuals.
  - `src/lib/*` owns gameplay/service logic and external adapters.
  - `src/app/*` owns app-wide constants and routing helpers.
  - `src/types/*` owns shared UI-only TypeScript types/helpers.
- Prefer CSS Modules per component/screen for new or touched UI.
- Keep global styles limited to design tokens, resets, and shared primitives (`card`, button variants, etc.).
- Reuse existing utilities (`clsx`, data-driven configs) before adding new dependencies.
- Maintain lint/format hygiene before handoff:
  - `npm run lint`
  - `npm run format` (or `npm run format:write` to fix)

## Useful Local Commands

```bash
npm install
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Then open:

```bash
http://127.0.0.1:4173/?debugBoard=1
```

For deterministic session-state testing without Supabase:

```bash
VITE_GAME_SERVICE_MODE=memory VITE_SESSION_STORAGE_MODE=memory npm run preview -- --host 127.0.0.1 --port 4173
http://127.0.0.1:4173/game?fixture=battle_preview&as=initiator
```

For browser-based visual inspection, use Playwright against the local preview server. Prefer the Playwright MCP server for navigation, interaction, and screenshots; keep direct `playwright` scripts as fallback only.

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

- Device-local session memberships are stored in `localStorage`.
- The dashboard of resumable sessions is local to the current device, not account-wide.
- Loading a session by code or URL without a saved local membership should not silently assign control.

Avoid reintroducing any flow where knowing a session code alone grants player identity.

### Board rendering

- The main board is rendered with an SVG surface plus absolutely positioned interactive hit targets.
- Piece depth/perspective is driven by projection math in `src/App.tsx`.
- `?debugBoard=1` provides a deterministic local board state for visual tuning.

When adjusting the board renderer, visually inspect it in a browser rather than relying on code alone.

## Working Rules For Agents

1. Prefer small, testable changes over broad rewrites.
2. When touching the board renderer, use the local debug route and capture screenshots.
3. When changing session logic, test refresh/resume behavior and local player identity.
4. Preserve data-driven configuration instead of hardcoding piece or ruleset logic into UI code.
5. Do not expose Supabase secret/service keys to client code.

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

For browser-based visual inspection, use Playwright against the local preview server.

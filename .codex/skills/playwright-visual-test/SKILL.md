---
name: playwright-visual-test
description: Use when visually testing Stratego Pulse Arena in a browser, especially for board rendering, SVG perspective, piece layout, or UI regressions. This skill explains how to run the local preview, inspect it with the Playwright MCP server first, and fall back to local Playwright scripts only when MCP is unavailable.
---

# Playwright Visual Test

Use this skill when the task requires seeing the app instead of inferring visuals from code.

## When to use

- Board geometry looks wrong
- SVG surface or perspective math needs tuning
- Piece scaling, masking, or alignment needs verification
- A UI change should be checked in a real browser before concluding

## Preferred workflow

1. Install dependencies if needed:

```bash
npm install
```

2. Build the app:

```bash
npm run build
```

3. Start a local preview server:

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

4. Use the app for board work:

```bash
http://127.0.0.1:4173
```

This route bypasses Supabase/socket setup and renders a stable board state for inspection.

5. Use the Playwright MCP server as the default browser driver.

Preferred MCP actions:

- Open the preview URL in the Playwright MCP browser session.
- Capture screenshots through MCP instead of writing one-off local scripts.
- Use MCP interactions for click-target validation, hover checks, and responsive viewport passes.

Adjust viewport and URL if the task is not board-specific. Treat this as fallback infrastructure, not the first choice.

If the Playwright MCP server fails to create its own working directory, work around it by interacting with the browser manually.

## What to inspect

- Board proportions: top width vs bottom width, overall foreshortening
- Piece anchoring: pieces should feel seated on the board, not floating
- Hit-target alignment: piece positions should match visible cells
- Bevel/base shape: lower edge should read as a physical board edge
- Hidden-information behavior: masked enemy pieces should still render correctly

## Cleanup

- Stop the preview server when done.
- Remove temporary screenshots if they were only used for inspection.
- Close the MCP browser session when inspection is complete.

## Notes for this repo

- `playwright` is installed as a dev dependency.
- Codex should prefer the Playwright MCP server for future browser inspection work in this repo.
- The board projection math currently lives in `src/App.tsx`.

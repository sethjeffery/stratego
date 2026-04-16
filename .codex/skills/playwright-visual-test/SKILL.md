---
name: playwright-visual-test
description: Use when visually testing Stratego Pulse Arena in a browser, especially for board rendering, SVG perspective, piece layout, or UI regressions. This skill explains how to run the local preview, use the deterministic `?debugBoard=1` route, capture screenshots with Playwright, and clean up preview processes afterward.
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

4. Use the deterministic debug route for board work:

```bash
http://127.0.0.1:4173/?debugBoard=1
```

This route bypasses Supabase/socket setup and renders a stable board state for inspection.

## Playwright screenshot command

Use Playwright to capture a screenshot after the preview server is running:

```bash
node -e "const { chromium } = require('playwright'); (async()=>{ const browser = await chromium.launch({headless:true}); const page = await browser.newPage({ viewport: { width: 1440, height: 1600 }, deviceScaleFactor: 1 }); await page.goto('http://127.0.0.1:4173/?debugBoard=1', { waitUntil: 'networkidle' }); await page.screenshot({ path: '/tmp/stratego-debug.png', fullPage: true }); await browser.close(); })().catch(err=>{ console.error(err); process.exit(1); });"
```

Adjust viewport and URL if the task is not board-specific.

## What to inspect

- Board proportions: top width vs bottom width, overall foreshortening
- Piece anchoring: pieces should feel seated on the board, not floating
- Hit-target alignment: piece positions should match visible cells
- Bevel/base shape: lower edge should read as a physical board edge
- Hidden-information behavior: masked enemy pieces should still render correctly

## Cleanup

- Stop the preview server when done.
- Remove temporary screenshots if they were only used for inspection.

## Notes for this repo

- `playwright` is installed as a dev dependency.
- The board projection math currently lives in `src/App.tsx`.
- The deterministic debug state lives in `src/lib/debugBoardState.ts`.

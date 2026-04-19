# Stratego Pulse Arena

A real-time multiplayer Stratego-inspired web game with animated battles, configurable rulesets, and room-based hosting/joining across devices.

## Stack

- TypeScript
- React + Vite
- Supabase Realtime + Postgres
- Zod schema validation for rule/piece config files

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, host on one device, and join using room code from another device on the same network (pointing both to the same server).

## Board debug preview

For local renderer tuning and fixture-driven session testing, run the app in memory mode:

```bash
VITE_GAME_SERVICE_MODE=memory VITE_PLAYER_SESSION_STORAGE=memory npm run dev
```

Then open the app with a fixture route:

```bash
http://localhost:5173/?fixture=opening-skirmish&as=initiator
```

This bypasses Supabase, seeds an in-memory `SessionRow` fixture, and impersonates the selected player role so you can inspect board geometry, hidden information, and interaction state in the browser.

Available fixture ids currently include:

- `waiting-for-challenger`
- `setup-duel`
- `opening-skirmish`
- `finished-flag`

## Architecture options

### Supabase direct mode

- No custom Node server required for gameplay.
- Session storage is persistent in Postgres.
- Realtime updates come from Supabase Realtime.
- Flow is **initiator + challenger** (tokenized session id), not host/client.
- The current session is mirrored into the URL as `?session=CODE`.
- This device stores its player identity in a configurable browser-backed store so refresh/reopen can resume the same side of the game.

### In-memory debug mode

- Set `VITE_GAME_SERVICE_MODE=memory` to keep sessions and player profiles in local memory.
- Set `VITE_PLAYER_SESSION_STORAGE=memory` or `sessionStorage` if you want identity persistence to be non-persistent or tab-scoped while testing.
- Use `?fixture=...&as=initiator|challenger` to seed a named fixture and impersonate a player without Supabase.
- `?debugBoard=1` is still accepted as a legacy alias, but it is no longer required for fixture routes.
- The in-memory backend is intended for local testing and Playwright flows; it resets on full page reload.

Set either of these client env pairs:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Or, if you are using the Vercel Supabase integration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is also accepted as a fallback client key.

Then run the SQL in `supabase/schema.sql` in your Supabase project.

### Supabase setup checklist (required)

If you are asking “is there anything I need to do?” — **yes, these steps are required once per project**:

1. **Create a Supabase project** in your preferred region.
2. In Supabase dashboard, go to **SQL Editor** and run `supabase/schema.sql`.
3. In dashboard, confirm **Database → Replication** includes `public.game_sessions` (required for realtime updates).
4. In dashboard, copy:
   - **Project URL** → `VITE_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon public key** → `VITE_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Put those keys in your frontend environment:
   - local `.env`
   - Vercel Project Settings → Environment Variables
6. Redeploy frontend.

### Local `.env` example for Supabase mode

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### Vercel env vars for Supabase mode

Any one of these client-safe configurations works:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Or Vercel Supabase integration defaults:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional fallback:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

You also do **not** need to expose `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, or `SUPABASE_JWT_SECRET` to the browser.

### Quick validation steps

After deployment:

1. Open app on device A and click **Create Session**.
2. Copy the session link or session code.
3. Open app on device B and **Join as Challenger** with same code.
4. Move a piece on one device; verify board updates on the other in realtime.
5. Refresh either browser tab; verify it restores the same game and same player perspective.
6. Click **Leave Session**, then resume it from the **Your Active Sessions** dashboard.

If this fails:

- Check browser console for missing env vars.
- Check Supabase table `public.game_sessions` contains rows.
- Check realtime replication includes `game_sessions`.
- Confirm your app URL is using the same Supabase project whose keys you configured.

## Configuration

- Piece definitions: `config/pieces/classic.json`
- Rules/board setup: `config/rules/default.json`
- Schemas: `src/shared/schema.ts`

You can add alternate config files and wire selection into the session flow later if needed.

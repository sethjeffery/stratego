# Stratego Pulse Arena

A real-time multiplayer Stratego-inspired web game with animated battles, configurable rulesets, and room-based hosting/joining across devices.

## Stack
- TypeScript
- React + Vite
- Node + Express + Socket.IO
- Zod schema validation for rule/piece config files

## Run
```bash
npm install
npm run dev
```

Open `http://localhost:5173`, host on one device, and join using room code from another device on the same network (pointing both to the same server).

## Architecture options
### 1) Supabase direct mode (recommended for Vercel)
- No custom Node server required for gameplay.
- Session storage is persistent in Postgres.
- Realtime updates come from Supabase Realtime.
- Flow is **initiator + challenger** (tokenized session id), not host/client.

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

You do **not** need `VITE_BACKEND_ORIGIN` if using Supabase mode only.
You also do **not** need to expose `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, or `SUPABASE_JWT_SECRET` to the browser.

### Quick validation steps
After deployment:
1. Open app on device A and click **Create Session**.
2. Copy session code.
3. Open app on device B and **Join as Challenger** with same code.
4. Move a piece on one device; verify board updates on the other in realtime.

If this fails:
- Check browser console for missing env vars.
- Check Supabase table `public.game_sessions` contains rows.
- Check realtime replication includes `game_sessions`.
- Confirm your app URL is using the same Supabase project whose keys you configured.

### 2) Socket backend mode
Uses the Node Socket.IO server in `server/index.ts`.

Vercel static deployments do **not** run the Socket.IO server, so you must deploy the backend separately.

Recommended setup:
1. Deploy `server/index.ts` on a long-running Node host (Railway, Render, Fly.io, VPS, etc).
2. Set `CLIENT_ORIGIN=https://your-vercel-app.vercel.app` on that backend.
3. In Vercel project settings, set:
   - `VITE_BACKEND_ORIGIN=https://your-backend-domain.com`
4. Redeploy the Vercel frontend.

The client uses `VITE_BACKEND_ORIGIN` for both:
- `GET /api/config`
- Socket.IO connection (`/socket.io`)

## Configuration
- Piece definitions: `config/pieces/classic.json`
- Rules/board setup: `config/rules/default.json`
- Schemas: `src/shared/schema.ts`

You can add alternate config files and wire selection per room in the server handshake.

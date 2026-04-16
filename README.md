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

## Configuration
- Piece definitions: `config/pieces/classic.json`
- Rules/board setup: `config/rules/default.json`
- Schemas: `src/shared/schema.ts`

You can add alternate config files and wire selection per room in the server handshake.

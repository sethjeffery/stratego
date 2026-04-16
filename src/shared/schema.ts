import { z } from 'zod';

export const pieceDefinitionSchema = z.object({
  id: z.string(),
  label: z.string(),
  rank: z.number().int(),
  count: z.number().int().positive(),
  immovable: z.boolean().default(false),
  canDefuseBomb: z.boolean().default(false),
  canTraverseMany: z.boolean().default(false),
});

export const piecesConfigSchema = z.object({
  setName: z.string(),
  pieces: z.array(pieceDefinitionSchema),
});

export const boardSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blockedCells: z.array(z.object({ x: z.number().int(), y: z.number().int() })),
});

export const rulesSchema = z.object({
  gameName: z.string(),
  board: boardSchema,
  hiddenInformation: z.boolean(),
  attack: z.object({
    bombId: z.string(),
    flagId: z.string(),
    spyId: z.string(),
    marshalId: z.string(),
  }),
  setupRowsPerPlayer: z.number().int().positive(),
});

export type PieceDefinition = z.infer<typeof pieceDefinitionSchema>;
export type PiecesConfig = z.infer<typeof piecesConfigSchema>;
export type RulesConfig = z.infer<typeof rulesSchema>;

export type Position = { x: number; y: number };

export type Unit = {
  id: string;
  ownerId: string;
  pieceId: string;
  revealedTo: string[];
  x: number;
  y: number;
};

export type PlayerState = {
  id: string;
  name: string;
  connected: boolean;
};

export type GameState = {
  roomCode: string;
  turnPlayerId: string | null;
  winnerId: string | null;
  players: PlayerState[];
  units: Unit[];
  moveCount: number;
  lastBattle?: {
    at: Position;
    attackerPieceId: string;
    defenderPieceId: string;
    winner: 'attacker' | 'defender' | 'both';
  };
};

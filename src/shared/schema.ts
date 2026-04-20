import { z } from "zod";

export const pieceDefinitionSchema = z.object({
  canDefuseBomb: z.boolean().default(false),
  canKillMarshal: z.boolean().default(false),
  canTraverseMany: z.boolean().default(false),
  count: z.number().int().positive(),
  id: z.string(),
  immovable: z.boolean().default(false),
  label: z.string(),
  rank: z.number().int(),
  setup: z
    .object({
      fixedPositions: z
        .array(
          z.object({
            x: z.number().int(),
            y: z.number().int(),
          }),
        )
        .default([]),
      playerCanReposition: z.boolean().default(true),
    })
    .default({}),
});

export const piecesConfigSchema = z.object({
  pieces: z.array(pieceDefinitionSchema),
  setName: z.string(),
});

export const boardSchema = z.object({
  blockedCells: z.array(z.object({ x: z.number().int(), y: z.number().int() })),
  height: z.number().int().positive(),
  width: z.number().int().positive(),
});

export const rulesSchema = z.object({
  attack: z.object({
    bombId: z.string(),
    flagId: z.string(),
    marshalId: z.string(),
    spyId: z.string(),
  }),
  board: boardSchema,
  gameName: z.string(),
  hiddenInformation: z.boolean(),
  setupRowsPerPlayer: z.number().int().positive(),
});

export type BattleChatMessage = {
  attackerOwnerId: string;
  attackerPieceId: string;
  defenderOwnerId: string;
  defenderPieceId: string;
  winner: "attacker" | "both" | "defender";
};
export type GameChatMessage = {
  battle?: BattleChatMessage;
  id: string;
  playerId?: string;
  senderName?: string;
  sentAt: string;
  text?: string;
  type?: "battle" | "player";
};
export type GameState = {
  chatMessages: GameChatMessage[];
  completionReason?: "flag_capture" | "surrender";
  finishedAt: null | string;
  lastBattle?: {
    at: Position;
    attackerPieceId: string;
    defenderPieceId: string;
    winner: "attacker" | "both" | "defender";
    winnerOwnerId: null | string;
  };
  moveCount: number;
  phase: "battle" | "closed" | "finished" | "setup";
  players: PlayerState[];
  roomCode: string;
  setupReadyPlayerIds: string[];
  startedAt: null | string;
  surrenderedById?: null | string;
  turnPlayerId: null | string;
  units: Unit[];
  winnerId: null | string;
};

export type PieceDefinition = z.infer<typeof pieceDefinitionSchema>;

export type PiecesConfig = z.infer<typeof piecesConfigSchema>;

export type PlayerState = {
  connected: boolean;
  id: string;
};

export type Position = { x: number; y: number };

export type RulesConfig = z.infer<typeof rulesSchema>;

export type Unit = {
  id: string;
  ownerId: string;
  pieceId: string;
  revealedTo: string[];
  x: number;
  y: number;
};

export const getChatMessages = (state: GameState) => {
  const maybeMessages = (state as GameState & { chatMessages?: GameChatMessage[] })
    .chatMessages;
  return Array.isArray(maybeMessages) ? maybeMessages : [];
};

export const sortAndLimitChatMessages = (
  messages: GameChatMessage[],
  maxMessages = 12,
) => {
  const uniqueById = new Map(messages.map((message) => [message.id, message]));
  return [...uniqueById.values()]
    .sort((left, right) => left.sentAt.localeCompare(right.sentAt))
    .slice(-maxMessages);
};

export const appendChatMessage = (
  state: GameState,
  message: GameChatMessage,
  maxMessages = 12,
): GameState => ({
  ...state,
  chatMessages: sortAndLimitChatMessages(
    [...getChatMessages(state), message],
    maxMessages,
  ),
});

export const removeChatMessage = (state: GameState, messageId: string): GameState => ({
  ...state,
  chatMessages: getChatMessages(state).filter((message) => message.id !== messageId),
});

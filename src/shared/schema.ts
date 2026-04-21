import { z } from "zod";

export const pieceDefinitionSchema = z.object({
  canKill: z.string().optional(),
  canTraverseMany: z.boolean().default(false),
  count: z.number().int().positive(),
  explodes: z.boolean().optional().describe("Explodes when attacking"),
  goal: z.boolean().optional().describe("Wins the game when captured"),
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

export const boardSchema = z.object({
  blockedCells: z.array(z.object({ x: z.number().int(), y: z.number().int() })),
  height: z.number().int().positive(),
  width: z.number().int().positive(),
});

export const rulesSchema = z.object({
  board: boardSchema,
  gameName: z.string(),
  setupRowsPerPlayer: z.number().int().positive(),
});

export const gameSetupSchema = z.object({
  description: z.string(),
  id: z.string(),
  name: z.string(),
  pieces: z.array(pieceDefinitionSchema),
  rules: rulesSchema,
});

export const gameSetupCatalogSchema = z.object({
  defaultSetupId: z.string(),
  setups: z.array(gameSetupSchema),
});

export type AiPlayerConfig = {
  intelligence: number;
};
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

export type GameSetup = z.infer<typeof gameSetupSchema>;
export type GameSetupCatalog = z.infer<typeof gameSetupCatalogSchema>;

export type GameState = {
  chatMessages: GameChatMessage[];
  completionReason?: "draw" | "elimination" | "flag_capture" | "surrender";
  finishedAt: null | string;
  gameSetupId: string;
  lastBattle?: {
    at: Position;
    attackerFrom: Position;
    attackerPieceId: string;
    defenderPieceId: string;
    winner: "attacker" | "both" | "defender";
    winnerOwnerId: null | string;
  };
  moveCount: number;
  phase: "battle" | "closed" | "finished" | "open" | "setup";
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

export type PlayerController = "ai" | "human";

export type PlayerState = {
  aiConfig?: AiPlayerConfig;
  avatarId?: string;
  connected: boolean;
  controller?: PlayerController;
  displayName?: string;
  id: string;
};

export type Position = { x: number; y: number };

export type RulesConfig = z.infer<typeof rulesSchema>;

export type Unit = {
  id: string;
  ownerId: string;
  pieceId: string;
  revealedTo: string[];
  status?: "alive" | "captured";
  x: number;
  y: number;
};

export type UnitStatus = NonNullable<Unit["status"]>;

export const isUnitAlive = (unit: Unit) => unit.status !== "captured";
export const getPlayerController = (player: Pick<PlayerState, "controller">) =>
  player.controller ?? "human";
export const isAiPlayer = (player: Pick<PlayerState, "controller">) =>
  getPlayerController(player) === "ai";

export const getAliveUnits = (state: Pick<GameState, "units">) =>
  state.units.filter(isUnitAlive);

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

import { nanoid } from "nanoid";

import type {
  AiPlayerConfig,
  GameSetup,
  GameState,
  PieceDefinition,
  PlayerController,
  PlayerState,
  Position,
  RulesConfig,
  Unit,
} from "../shared/schema";
import type { UserProfile } from "./supabaseGameService";

import { appendChatMessage, getAliveUnits, isUnitAlive } from "../shared/schema";

const buildPieceMap = (pieces: PieceDefinition[]) =>
  new Map(pieces.map((piece) => [piece.id, piece]));

const inBounds = (p: Position, rules: RulesConfig) =>
  p.x >= 0 && p.x < rules.board.width && p.y >= 0 && p.y < rules.board.height;

const blockedSet = (rules: RulesConfig) =>
  new Set(rules.board.blockedCells.map((c) => `${c.x},${c.y}`));
const revealUnitToPlayers = (unit: Unit, players: PlayerState[]) => {
  unit.revealedTo = Array.from(
    new Set([...unit.revealedTo, ...players.map((player) => player.id)]),
  );
};

const moveDistance = (from: Position, to: Position) =>
  Math.abs(from.x - to.x) + Math.abs(from.y - to.y);

const directions: Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const toAbsoluteSetupPosition = (
  position: Position,
  fromTop: boolean,
  rules: RulesConfig,
): Position => ({
  x: position.x,
  y: fromTop ? position.y : rules.board.height - 1 - position.y,
});

const getSetupSlots = (rules: RulesConfig, fromTop: boolean): Position[] => {
  const blocked = blockedSet(rules);
  const startY = fromTop ? 0 : rules.board.height - rules.setupRowsPerPlayer;
  const rows = Array.from({ length: rules.setupRowsPerPlayer }, (_, i) => startY + i);
  const slots: Position[] = [];

  for (const y of rows) {
    for (let x = 0; x < rules.board.width; x += 1) {
      if (!blocked.has(`${x},${y}`)) slots.push({ x, y });
    }
  }

  return slots;
};

const createLineup = (
  ownerId: string,
  fromTop: boolean,
  rules: RulesConfig,
  pieces: PieceDefinition[],
): Unit[] => {
  const slots = getSetupSlots(rules, fromTop);
  const availableSlots = new Set(slots.map((slot) => `${slot.x},${slot.y}`));
  const claimed = new Set<string>();
  const units: Unit[] = [];
  const bag: PieceDefinition[] = [];
  const nextIndexByPiece = new Map<string, number>();

  const allocateUnitId = (pieceId: string) => {
    const nextIndex = nextIndexByPiece.get(pieceId) ?? 0;
    nextIndexByPiece.set(pieceId, nextIndex + 1);
    return `${ownerId}-${pieceId}-${nextIndex}`;
  };

  pieces.forEach((piece) => {
    const fixedPositions = piece.setup.fixedPositions;
    if (fixedPositions.length > piece.count) {
      throw new Error(`Piece '${piece.id}' defines more fixed positions than count.`);
    }

    fixedPositions.forEach((relativePosition) => {
      const absolutePosition = toAbsoluteSetupPosition(
        relativePosition,
        fromTop,
        rules,
      );
      const key = `${absolutePosition.x},${absolutePosition.y}`;
      if (!availableSlots.has(key)) {
        throw new Error(
          `Piece '${piece.id}' fixed position (${absolutePosition.x},${absolutePosition.y}) is invalid.`,
        );
      }
      if (claimed.has(key)) {
        throw new Error(
          `Two pieces are configured to use setup position (${absolutePosition.x},${absolutePosition.y}).`,
        );
      }
      claimed.add(key);
      units.push({
        id: allocateUnitId(piece.id),
        ownerId,
        pieceId: piece.id,
        revealedTo: [ownerId],
        status: "alive",
        x: absolutePosition.x,
        y: absolutePosition.y,
      });
    });

    const remainingCount = piece.count - fixedPositions.length;
    for (let i = 0; i < remainingCount; i += 1) bag.push(piece);
  });

  const freeSlots = slots.filter((slot) => !claimed.has(`${slot.x},${slot.y}`));
  if (bag.length > freeSlots.length) {
    throw new Error("Piece counts exceed available setup cells.");
  }

  const shuffledSlots = [...freeSlots].sort(() => Math.random() - 0.5);

  const randomUnits: Unit[] = bag.map((piece, index) => ({
    id: allocateUnitId(piece.id),
    ownerId,
    pieceId: piece.id,
    revealedTo: [ownerId],
    status: "alive",
    x: shuffledSlots[index].x,
    y: shuffledSlots[index].y,
  }));

  return [...units, ...randomUnits];
};

const resolveBattle = (
  attacker: Unit,
  defender: Unit,
  pieceById: Map<string, PieceDefinition>,
): "attacker" | "both" | "defender" => {
  const a = pieceById.get(attacker.pieceId)!;
  const d = pieceById.get(defender.pieceId)!;

  if (a.canKill === d.id) return "attacker";
  if (a.explodes && a.rank > d.rank) return "both";
  if (a.rank > d.rank) return "attacker";
  if (a.rank < d.rank) return "defender";
  return "both";
};

const createBattleChatMessage = (
  state: GameState,
  attacker: Unit,
  defender: Unit,
  winner: "attacker" | "both" | "defender",
) => ({
  battle: {
    attackerOwnerId: attacker.ownerId,
    attackerPieceId: attacker.pieceId,
    defenderOwnerId: defender.ownerId,
    defenderPieceId: defender.pieceId,
    winner,
  },
  id: `system-battle-${state.moveCount + 1}`,
  sentAt: new Date().toISOString(),
  type: "battle" as const,
});

export const createSessionGame = (
  initiatorPlayer: {
    aiConfig?: AiPlayerConfig;
    controller: PlayerController;
    profile: UserProfile;
  },
  challengerPlayer: {
    aiConfig?: AiPlayerConfig;
    controller: PlayerController;
    profile: UserProfile;
  },
  gameSetup: GameSetup,
  playerIds?: { challengerId: string; initiatorId: string },
): { challengerId: string; initiatorId: string; state: GameState } => {
  const { pieces, rules } = gameSetup;
  const initiatorId = playerIds?.initiatorId ?? nanoid(10);
  const challengerId = playerIds?.challengerId ?? nanoid(10);

  const players: PlayerState[] = [
    {
      aiConfig: initiatorPlayer.aiConfig,
      avatarId: initiatorPlayer.profile.avatar_id,
      connected: true,
      controller: initiatorPlayer.controller,
      displayName: initiatorPlayer.profile.player_name,
      id: initiatorId,
    },
    {
      aiConfig: challengerPlayer.aiConfig,
      avatarId: challengerPlayer.profile.avatar_id,
      connected: true,
      controller: challengerPlayer.controller,
      displayName: challengerPlayer.profile.player_name,
      id: challengerId,
    },
  ];

  return {
    challengerId,
    initiatorId,
    state: {
      chatMessages: [],
      completionReason: "flag_capture",
      finishedAt: null,
      gameSetupId: gameSetup.id,
      moveCount: 0,
      phase: "setup",
      players,
      roomCode: "",
      setupReadyPlayerIds: [],
      startedAt: null,
      surrenderedById: null,
      turnPlayerId: null,
      units: [
        ...createLineup(players[0].id, false, rules, pieces),
        ...createLineup(players[1].id, true, rules, pieces),
      ],
      winnerId: null,
    },
  };
};

export const createOpenSessionState = (
  sessionId: string,
  gameSetupId: string,
): GameState => ({
  chatMessages: [],
  completionReason: "flag_capture",
  finishedAt: null,
  gameSetupId,
  moveCount: 0,
  phase: "open",
  players: [],
  roomCode: sessionId,
  setupReadyPlayerIds: [],
  startedAt: null,
  surrenderedById: null,
  turnPlayerId: null,
  units: [],
  winnerId: null,
});

const getSetupRowsForPlayer = (
  playerId: string,
  state: GameState,
  rules: RulesConfig,
) => {
  const isTop = state.players[1]?.id === playerId;
  const startY = isTop ? 0 : rules.board.height - rules.setupRowsPerPlayer;
  return new Set(
    Array.from({ length: rules.setupRowsPerPlayer }, (_, index) => startY + index),
  );
};

const getUnitSequenceNumber = (unitId: string) => {
  const match = unitId.match(/-(\d+)$/);
  return match ? Number(match[1]) : null;
};

const isSetupUnitLocked = (unit: Unit, piece: PieceDefinition) => {
  if (!piece.setup.playerCanReposition) return true;
  if (piece.setup.fixedPositions.length === 0) return false;

  const sequenceNumber = getUnitSequenceNumber(unit.id);
  return sequenceNumber !== null && sequenceNumber < piece.setup.fixedPositions.length;
};

export const getSetupSwapTargets = (
  state: GameState,
  playerId: string,
  from: Position,
  rules: RulesConfig,
  pieces: PieceDefinition[],
): Position[] => {
  if (state.phase !== "setup" || state.winnerId) return [];
  if (state.setupReadyPlayerIds.includes(playerId)) return [];

  const pieceById = buildPieceMap(pieces);
  const setupRows = getSetupRowsForPlayer(playerId, state, rules);
  const sourceUnit = state.units.find(
    (unit) =>
      isUnitAlive(unit) &&
      unit.ownerId === playerId &&
      unit.x === from.x &&
      unit.y === from.y,
  );
  if (!sourceUnit) return [];

  const sourcePiece = pieceById.get(sourceUnit.pieceId);
  if (!sourcePiece || isSetupUnitLocked(sourceUnit, sourcePiece)) return [];

  return state.units
    .filter((unit) => isUnitAlive(unit) && unit.ownerId === playerId)
    .filter((unit) => setupRows.has(unit.y))
    .filter((unit) => unit.id !== sourceUnit.id)
    .filter((unit) => {
      const piece = pieceById.get(unit.pieceId);
      return piece ? !isSetupUnitLocked(unit, piece) : false;
    })
    .map((unit) => ({ x: unit.x, y: unit.y }));
};

export const applySetupSwapToState = (
  state: GameState,
  playerId: string,
  from: Position,
  to: Position,
  rules: RulesConfig,
  pieces: PieceDefinition[],
): { error?: string; nextState?: GameState } => {
  if (state.phase !== "setup") return { error: "Setup is complete." };
  if (state.setupReadyPlayerIds.includes(playerId))
    return { error: "You are already marked ready." };

  const legalTargets = getSetupSwapTargets(state, playerId, from, rules, pieces);
  if (!legalTargets.some((target) => target.x === to.x && target.y === to.y)) {
    return { error: "Invalid setup swap." };
  }

  const source = state.units.find(
    (unit) =>
      isUnitAlive(unit) &&
      unit.ownerId === playerId &&
      unit.x === from.x &&
      unit.y === from.y,
  )!;
  const destination = state.units.find(
    (unit) =>
      isUnitAlive(unit) &&
      unit.ownerId === playerId &&
      unit.x === to.x &&
      unit.y === to.y,
  )!;
  const nextUnits = state.units.map((unit) => ({
    ...unit,
    revealedTo: [...unit.revealedTo],
  }));
  const nextSource = nextUnits.find((unit) => unit.id === source.id)!;
  const nextDestination = nextUnits.find((unit) => unit.id === destination.id)!;

  nextSource.x = destination.x;
  nextSource.y = destination.y;
  nextDestination.x = from.x;
  nextDestination.y = from.y;

  return {
    nextState: {
      ...state,
      players: state.players.map((player) => ({ ...player })),
      units: nextUnits,
    },
  };
};

export const markPlayerSetupReady = (
  state: GameState,
  playerId: string,
): { error?: string; nextState?: GameState } => {
  if (state.phase !== "setup") return { error: "Setup is complete." };
  if (!state.players.some((player) => player.id === playerId))
    return { error: "Unknown player." };
  if (state.setupReadyPlayerIds.includes(playerId)) return { nextState: state };

  const nextReady = [...state.setupReadyPlayerIds, playerId];
  const everyoneReady =
    state.players.length > 0 &&
    state.players.every((player) => nextReady.includes(player.id));

  return {
    nextState: {
      ...state,
      finishedAt: everyoneReady ? null : state.finishedAt,
      phase: everyoneReady ? "battle" : "setup",
      setupReadyPlayerIds: nextReady,
      startedAt: everyoneReady ? new Date().toISOString() : state.startedAt,
      turnPlayerId: everyoneReady
        ? (state.players[Math.floor(Math.random() * state.players.length)]?.id ?? null)
        : null,
    },
  };
};

export const applyMoveToState = (
  state: GameState,
  playerId: string,
  from: Position,
  to: Position,
  rules: RulesConfig,
  pieces: PieceDefinition[],
): { error?: string; nextState?: GameState } => {
  if (state.phase !== "battle") return { error: "Battle has not started yet." };
  if (state.winnerId) return { error: "Game already finished." };
  if (state.turnPlayerId !== playerId) return { error: "Not your turn." };

  const blocked = blockedSet(rules);
  if (
    !inBounds(from, rules) ||
    !inBounds(to, rules) ||
    blocked.has(`${to.x},${to.y}`)
  ) {
    return { error: "Invalid target cell." };
  }

  const nextState: GameState = {
    ...state,
    completionReason: state.completionReason ?? "flag_capture",
    phase: state.phase,
    players: state.players.map((p) => ({ ...p })),
    setupReadyPlayerIds: [...state.setupReadyPlayerIds],
    surrenderedById: state.surrenderedById ?? null,
    units: state.units.map((u) => ({ ...u, revealedTo: [...u.revealedTo] })),
  };

  const pieceById = buildPieceMap(pieces);
  const moving = nextState.units.find(
    (u) => isUnitAlive(u) && u.x === from.x && u.y === from.y && u.ownerId === playerId,
  );
  if (!moving) return { error: "No controllable unit at source." };

  const movingPiece = pieceById.get(moving.pieceId)!;
  if (movingPiece.immovable) return { error: `${movingPiece.label} cannot move.` };
  const legalMoves = getLegalMovesForUnit(state, playerId, from, rules, pieces);
  if (!legalMoves.some((move) => move.x === to.x && move.y === to.y)) {
    return { error: "Illegal movement vector." };
  }

  const defender = nextState.units.find(
    (u) => isUnitAlive(u) && u.x === to.x && u.y === to.y && u.ownerId !== playerId,
  );
  const movementProvesIdentity =
    movingPiece.canTraverseMany && moveDistance(from, to) > 1;

  if (!defender) {
    if (movementProvesIdentity) revealUnitToPlayers(moving, nextState.players);
    moving.x = to.x;
    moving.y = to.y;
    nextState.lastBattle = undefined;
  } else {
    revealUnitToPlayers(moving, nextState.players);
    revealUnitToPlayers(defender, nextState.players);
    const winner = resolveBattle(moving, defender, pieceById);
    moving.x = to.x;
    moving.y = to.y;

    if (winner === "attacker") {
      defender.status = "captured";
    } else if (winner === "defender") {
      moving.status = "captured";
    } else {
      moving.status = "captured";
      defender.status = "captured";
    }

    for (const piece of [defender, moving]) {
      if (piece.status === "captured" && pieceById.get(piece.pieceId)?.goal) {
        nextState.winnerId = playerId;
      }
    }

    nextState.lastBattle = {
      at: to,
      attackerPieceId: moving.pieceId,
      defenderPieceId: defender.pieceId,
      winner,
      winnerOwnerId:
        winner === "attacker"
          ? playerId
          : winner === "defender"
            ? defender.ownerId
            : null,
    };
    Object.assign(
      nextState,
      appendChatMessage(
        nextState,
        createBattleChatMessage(state, moving, defender, winner),
      ),
    );
  }

  nextState.moveCount += 1;
  const alivePlayers = nextState.players.filter((player) =>
    getAliveUnits(nextState).some((u) => u.ownerId === player.id),
  );

  const nextPlayer = nextState.players.find((p) => p.id !== playerId);
  if (!nextState.winnerId) {
    if (alivePlayers.length === 0) {
      nextState.completionReason = "draw";
      nextState.turnPlayerId = null;
    } else if (alivePlayers.length === 1) {
      nextState.completionReason = "elimination";
      nextState.winnerId = alivePlayers[0].id;
      nextState.turnPlayerId = null;
    } else {
      nextState.turnPlayerId = nextPlayer?.id ?? null;
    }
  } else {
    nextState.turnPlayerId = null;
  }

  if (nextState.winnerId || nextState.completionReason === "draw") {
    nextState.phase = "finished";
    nextState.surrenderedById = null;
    nextState.finishedAt = new Date().toISOString();
  }

  return { nextState };
};

export const createRematchState = (
  state: GameState,
  gameSetup: GameSetup,
): GameState => {
  if (state.players.length < 2) {
    throw new Error("Cannot reset without both players.");
  }

  const initiatorProfile = {
    avatar_id: state.players[0].avatarId ?? "",
    player_name: state.players[0].displayName ?? "Commander Red",
  };
  const challengerProfile = {
    avatar_id: state.players[1].avatarId ?? "",
    player_name: state.players[1].displayName ?? "Commander Blue",
  };

  const next = createSessionGame(
    {
      aiConfig: state.players[0].aiConfig,
      controller: state.players[0].controller ?? "human",
      profile: initiatorProfile,
    },
    {
      aiConfig: state.players[1].aiConfig,
      controller: state.players[1].controller ?? "human",
      profile: challengerProfile,
    },
    gameSetup,
    {
    challengerId: state.players[1].id,
    initiatorId: state.players[0].id,
    },
  ).state;
  next.roomCode = state.roomCode;
  return next;
};

export const getLegalMovesForUnit = (
  state: GameState,
  playerId: string,
  from: Position,
  rules: RulesConfig,
  pieces: PieceDefinition[],
): Position[] => {
  if (state.phase !== "battle") return [];
  if (state.winnerId) return [];

  const blocked = blockedSet(rules);
  if (!inBounds(from, rules) || blocked.has(`${from.x},${from.y}`)) return [];

  const pieceById = buildPieceMap(pieces);
  const moving = state.units.find(
    (u) => isUnitAlive(u) && u.x === from.x && u.y === from.y && u.ownerId === playerId,
  );
  if (!moving) return [];

  const movingPiece = pieceById.get(moving.pieceId);
  if (!movingPiece || movingPiece.immovable) return [];

  const occupiedBySelf = new Set(
    getAliveUnits(state)
      .filter((u) => u.ownerId === playerId)
      .map((u) => `${u.x},${u.y}`),
  );
  const occupiedByEnemy = new Set(
    getAliveUnits(state)
      .filter((u) => u.ownerId !== playerId)
      .map((u) => `${u.x},${u.y}`),
  );

  if (!movingPiece.canTraverseMany) {
    return directions
      .map((direction) => ({ x: from.x + direction.x, y: from.y + direction.y }))
      .filter(
        (target) =>
          inBounds(target, rules) &&
          !blocked.has(`${target.x},${target.y}`) &&
          !occupiedBySelf.has(`${target.x},${target.y}`),
      );
  }

  const legalMoves: Position[] = [];

  for (const direction of directions) {
    let x = from.x + direction.x;
    let y = from.y + direction.y;

    while (inBounds({ x, y }, rules) && !blocked.has(`${x},${y}`)) {
      const key = `${x},${y}`;
      if (occupiedBySelf.has(key)) break;

      legalMoves.push({ x, y });
      if (occupiedByEnemy.has(key)) break;

      x += direction.x;
      y += direction.y;
    }
  }

  return legalMoves;
};

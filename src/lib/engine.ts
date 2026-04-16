import { nanoid } from 'nanoid';
import { GameState, PieceDefinition, PlayerState, Position, RulesConfig, Unit } from '../shared/schema';

const buildPieceMap = (pieces: PieceDefinition[]) => new Map(pieces.map((piece) => [piece.id, piece]));

const inBounds = (p: Position, rules: RulesConfig) =>
  p.x >= 0 && p.x < rules.board.width && p.y >= 0 && p.y < rules.board.height;

const blockedSet = (rules: RulesConfig) => new Set(rules.board.blockedCells.map((c) => `${c.x},${c.y}`));
const directions: Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const createLineup = (
  ownerId: string,
  fromTop: boolean,
  rules: RulesConfig,
  pieces: PieceDefinition[],
): Unit[] => {
  const blocked = blockedSet(rules);
  const startY = fromTop ? 0 : rules.board.height - rules.setupRowsPerPlayer;
  const rows = Array.from({ length: rules.setupRowsPerPlayer }, (_, i) => startY + i);
  const slots: Position[] = [];

  for (const y of rows) {
    for (let x = 0; x < rules.board.width; x += 1) {
      if (!blocked.has(`${x},${y}`)) slots.push({ x, y });
    }
  }

  const bag: PieceDefinition[] = [];
  pieces.forEach((piece) => {
    for (let i = 0; i < piece.count; i += 1) bag.push(piece);
  });

  const shuffledSlots = [...slots].sort(() => Math.random() - 0.5);

  return bag.map((piece, index) => ({
    id: `${ownerId}-${piece.id}-${index}`,
    ownerId,
    pieceId: piece.id,
    revealedTo: [ownerId],
    x: shuffledSlots[index].x,
    y: shuffledSlots[index].y,
  }));
};

const resolveBattle = (
  attacker: Unit,
  defender: Unit,
  pieceById: Map<string, PieceDefinition>,
  rules: RulesConfig,
): 'attacker' | 'defender' | 'both' => {
  const a = pieceById.get(attacker.pieceId)!;
  const d = pieceById.get(defender.pieceId)!;

  if (d.id === rules.attack.flagId) return 'attacker';
  if (d.id === rules.attack.bombId) return a.canDefuseBomb ? 'attacker' : 'defender';
  if (a.id === rules.attack.spyId && d.id === rules.attack.marshalId) return 'attacker';

  if (a.rank > d.rank) return 'attacker';
  if (a.rank < d.rank) return 'defender';
  return 'both';
};

export const createSessionGame = (
  initiatorName: string,
  challengerName: string,
  rules: RulesConfig,
  pieces: PieceDefinition[],
  playerIds?: { initiatorId: string; challengerId: string },
): { state: GameState; initiatorId: string; challengerId: string } => {
  const initiatorId = playerIds?.initiatorId ?? nanoid(10);
  const challengerId = playerIds?.challengerId ?? nanoid(10);

  const players: PlayerState[] = [
    { id: initiatorId, name: initiatorName, connected: true },
    { id: challengerId, name: challengerName, connected: true },
  ];

  return {
    initiatorId,
    challengerId,
    state: {
      roomCode: '',
      turnPlayerId: players[Math.floor(Math.random() * 2)].id,
      winnerId: null,
      players,
      units: [...createLineup(players[0].id, false, rules, pieces), ...createLineup(players[1].id, true, rules, pieces)],
      moveCount: 0,
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
): { nextState?: GameState; error?: string } => {
  if (state.winnerId) return { error: 'Game already finished.' };
  if (state.turnPlayerId !== playerId) return { error: 'Not your turn.' };

  const blocked = blockedSet(rules);
  if (!inBounds(from, rules) || !inBounds(to, rules) || blocked.has(`${to.x},${to.y}`)) {
    return { error: 'Invalid target cell.' };
  }

  const nextState: GameState = {
    ...state,
    units: state.units.map((u) => ({ ...u, revealedTo: [...u.revealedTo] })),
    players: state.players.map((p) => ({ ...p })),
  };

  const pieceById = buildPieceMap(pieces);
  const moving = nextState.units.find((u) => u.x === from.x && u.y === from.y && u.ownerId === playerId);
  if (!moving) return { error: 'No controllable unit at source.' };

  const movingPiece = pieceById.get(moving.pieceId)!;
  if (movingPiece.immovable) return { error: `${movingPiece.label} cannot move.` };
  const legalMoves = getLegalMovesForUnit(state, playerId, from, rules, pieces);
  if (!legalMoves.some((move) => move.x === to.x && move.y === to.y)) {
    return { error: 'Illegal movement vector.' };
  }

  const defender = nextState.units.find((u) => u.x === to.x && u.y === to.y && u.ownerId !== playerId);
  moving.revealedTo = Array.from(new Set([...moving.revealedTo, ...nextState.players.map((p) => p.id)]));

  if (!defender) {
    moving.x = to.x;
    moving.y = to.y;
    nextState.lastBattle = undefined;
  } else {
    defender.revealedTo = Array.from(new Set([...defender.revealedTo, ...nextState.players.map((p) => p.id)]));
    const winner = resolveBattle(moving, defender, pieceById, rules);

    if (winner === 'attacker') {
      if (defender.pieceId === rules.attack.flagId) nextState.winnerId = playerId;
      nextState.units = nextState.units.filter((u) => u.id !== defender.id);
      moving.x = to.x;
      moving.y = to.y;
    } else if (winner === 'defender') {
      nextState.units = nextState.units.filter((u) => u.id !== moving.id);
    } else {
      nextState.units = nextState.units.filter((u) => u.id !== moving.id && u.id !== defender.id);
    }

    nextState.lastBattle = {
      at: to,
      attackerPieceId: moving.pieceId,
      defenderPieceId: defender.pieceId,
      winner,
    };
  }

  nextState.moveCount += 1;
  const alivePlayers = nextState.players.filter((player) => nextState.units.some((u) => u.ownerId === player.id));
  if (alivePlayers.length === 1) nextState.winnerId = alivePlayers[0].id;

  const nextPlayer = nextState.players.find((p) => p.id !== playerId);
  nextState.turnPlayerId = nextState.winnerId ? null : nextPlayer?.id ?? null;

  return { nextState };
};

export const getLegalMovesForUnit = (
  state: GameState,
  playerId: string,
  from: Position,
  rules: RulesConfig,
  pieces: PieceDefinition[],
): Position[] => {
  if (state.winnerId) return [];

  const blocked = blockedSet(rules);
  if (!inBounds(from, rules) || blocked.has(`${from.x},${from.y}`)) return [];

  const pieceById = buildPieceMap(pieces);
  const moving = state.units.find((u) => u.x === from.x && u.y === from.y && u.ownerId === playerId);
  if (!moving) return [];

  const movingPiece = pieceById.get(moving.pieceId);
  if (!movingPiece || movingPiece.immovable) return [];

  const occupiedBySelf = new Set(
    state.units.filter((u) => u.ownerId === playerId).map((u) => `${u.x},${u.y}`),
  );
  const occupiedByEnemy = new Set(
    state.units.filter((u) => u.ownerId !== playerId).map((u) => `${u.x},${u.y}`),
  );

  if (!movingPiece.canTraverseMany) {
    return directions
      .map((direction) => ({ x: from.x + direction.x, y: from.y + direction.y }))
      .filter((target) => (
        inBounds(target, rules)
        && !blocked.has(`${target.x},${target.y}`)
        && !occupiedBySelf.has(`${target.x},${target.y}`)
      ));
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

import piecesJson from '../config/pieces/classic.json' with { type: 'json' };
import rulesJson from '../config/rules/default.json' with { type: 'json' };
import {
  GameState,
  PieceDefinition,
  PiecesConfig,
  PlayerState,
  Position,
  RulesConfig,
  Unit,
  piecesConfigSchema,
  rulesSchema,
} from '../src/shared/schema.js';

const piecesConfig: PiecesConfig = piecesConfigSchema.parse(piecesJson);
const rulesConfig: RulesConfig = rulesSchema.parse(rulesJson);

const pieceById = new Map(piecesConfig.pieces.map((piece) => [piece.id, piece]));

const rooms = new Map<string, GameState>();

const inBounds = (p: Position) =>
  p.x >= 0 && p.x < rulesConfig.board.width && p.y >= 0 && p.y < rulesConfig.board.height;

const blocked = new Set(rulesConfig.board.blockedCells.map((c) => `${c.x},${c.y}`));

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const createLineup = (ownerId: string, fromTop: boolean): Unit[] => {
  const startY = fromTop ? 0 : rulesConfig.board.height - rulesConfig.setupRowsPerPlayer;
  const rows = Array.from({ length: rulesConfig.setupRowsPerPlayer }, (_, i) => startY + i);
  const slots: Position[] = [];

  for (const y of rows) {
    for (let x = 0; x < rulesConfig.board.width; x += 1) {
      if (!blocked.has(`${x},${y}`)) slots.push({ x, y });
    }
  }

  const bag: PieceDefinition[] = [];
  piecesConfig.pieces.forEach((piece) => {
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

const resolveBattle = (attacker: Unit, defender: Unit): 'attacker' | 'defender' | 'both' => {
  const a = pieceById.get(attacker.pieceId)!;
  const d = pieceById.get(defender.pieceId)!;

  if (d.id === rulesConfig.attack.flagId) return 'attacker';
  if (d.id === rulesConfig.attack.bombId) {
    return a.canDefuseBomb ? 'attacker' : 'defender';
  }
  if (a.id === rulesConfig.attack.spyId && d.id === rulesConfig.attack.marshalId) return 'attacker';

  if (a.rank > d.rank) return 'attacker';
  if (a.rank < d.rank) return 'defender';
  return 'both';
};

export const createRoom = (host: PlayerState) => {
  const roomCode = randomCode();
  rooms.set(roomCode, {
    roomCode,
    turnPlayerId: null,
    winnerId: null,
    players: [host],
    units: [],
    moveCount: 0,
  });
  return rooms.get(roomCode)!;
};

export const joinRoom = (roomCode: string, challenger: PlayerState) => {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.players.length >= 2) return { error: 'Room already full.' };

  room.players.push(challenger);
  room.units = [
    ...createLineup(room.players[0].id, false),
    ...createLineup(room.players[1].id, true),
  ];
  room.turnPlayerId = room.players[Math.floor(Math.random() * room.players.length)].id;
  return { room };
};

export const getRoom = (roomCode: string) => rooms.get(roomCode);

export const applyMove = (roomCode: string, playerId: string, from: Position, to: Position) => {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Game room vanished.' };
  if (room.winnerId) return { error: 'Game already finished.' };
  if (room.turnPlayerId !== playerId) return { error: 'Not your turn.' };

  if (!inBounds(from) || !inBounds(to) || blocked.has(`${to.x},${to.y}`)) return { error: 'Invalid target cell.' };
  const moving = room.units.find((u) => u.x === from.x && u.y === from.y && u.ownerId === playerId);
  if (!moving) return { error: 'No controllable unit at source.' };

  const piece = pieceById.get(moving.pieceId)!;
  if (piece.immovable) return { error: `${piece.label} cannot move.` };

  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  const legalStep = piece.canTraverseMany ? dx === 0 || dy === 0 : dx + dy === 1;
  if (!legalStep) return { error: 'Illegal movement vector.' };

  const occupiedBySelf = room.units.some((u) => u.ownerId === playerId && u.x === to.x && u.y === to.y);
  if (occupiedBySelf) return { error: 'Cell occupied by ally.' };

  const defender = room.units.find((u) => u.x === to.x && u.y === to.y && u.ownerId !== playerId);
  moving.revealedTo = Array.from(new Set([...moving.revealedTo, ...room.players.map((p) => p.id)]));

  if (!defender) {
    moving.x = to.x;
    moving.y = to.y;
    room.lastBattle = undefined;
  } else {
    defender.revealedTo = Array.from(new Set([...defender.revealedTo, ...room.players.map((p) => p.id)]));
    const winner = resolveBattle(moving, defender);

    if (winner === 'attacker') {
      if (defender.pieceId === rulesConfig.attack.flagId) room.winnerId = playerId;
      room.units = room.units.filter((u) => u.id !== defender.id);
      moving.x = to.x;
      moving.y = to.y;
    } else if (winner === 'defender') {
      room.units = room.units.filter((u) => u.id !== moving.id);
    } else {
      room.units = room.units.filter((u) => u.id !== moving.id && u.id !== defender.id);
    }

    room.lastBattle = {
      at: to,
      attackerPieceId: moving.pieceId,
      defenderPieceId: defender.pieceId,
      winner,
    };
  }

  room.moveCount += 1;
  const alivePlayers = room.players.filter((player) => room.units.some((u) => u.ownerId === player.id));
  if (alivePlayers.length === 1) room.winnerId = alivePlayers[0].id;

  const nextPlayer = room.players.find((p) => p.id !== playerId);
  room.turnPlayerId = room.winnerId ? null : nextPlayer?.id ?? null;

  return { room };
};

export const getRuleset = () => ({ piecesConfig, rulesConfig });

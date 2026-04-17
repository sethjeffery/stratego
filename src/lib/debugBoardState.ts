import { GameState, PieceDefinition, PlayerState, Position, RulesConfig, Unit } from '../shared/schema';

export const DEBUG_PLAYER_NEAR_ID = 'debug-near';
export const DEBUG_PLAYER_FAR_ID = 'debug-far';

const createSlots = (rules: RulesConfig, fromTop: boolean): Position[] => {
  const blocked = new Set(rules.board.blockedCells.map((cell) => `${cell.x},${cell.y}`));
  const startY = fromTop ? 0 : rules.board.height - rules.setupRowsPerPlayer;
  const rows = Array.from({ length: rules.setupRowsPerPlayer }, (_, index) => startY + index);

  return rows.flatMap((y) =>
    Array.from({ length: rules.board.width }, (_, x) => ({ x, y })).filter((slot) => !blocked.has(`${slot.x},${slot.y}`)),
  );
};

const createBag = (pieces: PieceDefinition[]) =>
  pieces.flatMap((piece) => Array.from({ length: piece.count }, (_, index) => ({ pieceId: piece.id, index })));

const createUnits = (
  ownerId: string,
  rules: RulesConfig,
  pieces: PieceDefinition[],
  fromTop: boolean,
  revealedTo: string[],
): Unit[] => {
  const slots = createSlots(rules, fromTop);
  const bag = fromTop ? [...createBag(pieces)].reverse() : createBag(pieces);

  return bag.map((entry, index) => ({
    id: `${ownerId}-${entry.pieceId}-${entry.index}`,
    ownerId,
    pieceId: entry.pieceId,
    revealedTo,
    x: slots[index].x,
    y: slots[index].y,
  }));
};

export const createDebugBoardState = (rules: RulesConfig, pieces: PieceDefinition[]): { myId: string; state: GameState } => {
  const players: PlayerState[] = [
    {
      id: DEBUG_PLAYER_NEAR_ID,
      name: 'Commander Depth',
      avatarId: 'char08',
      connected: true,
    },
    {
      id: DEBUG_PLAYER_FAR_ID,
      name: 'Commander Horizon',
      avatarId: 'char33',
      connected: true,
    },
  ];
  const revealedTo = players.map((player) => player.id);
  const nearUnits = createUnits(DEBUG_PLAYER_NEAR_ID, rules, pieces, false, revealedTo);
  const farUnits = createUnits(DEBUG_PLAYER_FAR_ID, rules, pieces, true, revealedTo);

  return {
    myId: DEBUG_PLAYER_NEAR_ID,
    state: {
      roomCode: 'DEBUGBRD',
      phase: 'battle',
      setupReadyPlayerIds: players.map((player) => player.id),
      turnPlayerId: DEBUG_PLAYER_NEAR_ID,
      winnerId: null,
      players,
      units: [...farUnits, ...nearUnits],
      moveCount: 12,
    },
  };
};

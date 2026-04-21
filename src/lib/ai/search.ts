import type {
  GameSetup,
  GameState,
  PieceDefinition,
  Position,
} from "../../shared/schema";

import { getAliveUnits } from "../../shared/schema";
import { applyMoveToState, getLegalMovesForUnit } from "../engine";

type SearchMove = {
  from: Position;
  to: Position;
};

const POSITION_WEIGHT = 6;
const REVEAL_WEIGHT = 18;
const MOBILITY_WEIGHT = 8;
const TERMINAL_SCORE = 1_000_000;

export const buildPieceMap = (pieces: PieceDefinition[]) =>
  new Map(pieces.map((piece) => [piece.id, piece]));

const getPieceValue = (piece: PieceDefinition) => {
  if (piece.goal) return 12_000;
  if (piece.immovable) return piece.explodes ? 500 : 200;

  return (
    piece.rank * 110 +
    (piece.canTraverseMany ? 45 : 0) +
    (piece.canKill ? 75 : 0) +
    (piece.explodes ? 40 : 0)
  );
};

const getPositionScore = (
  position: Position,
  boardWidth: number,
  boardHeight: number,
) => {
  const centerX = (boardWidth - 1) / 2;
  const centerY = (boardHeight - 1) / 2;

  return (
    boardWidth +
    boardHeight -
    Math.abs(position.x - centerX) -
    Math.abs(position.y - centerY)
  );
};

export const getAllLegalMoves = (
  state: GameState,
  playerId: string,
  gameSetup: GameSetup,
): SearchMove[] => {
  return getAliveUnits(state)
    .filter((unit) => unit.ownerId === playerId)
    .flatMap((unit) =>
      getLegalMovesForUnit(
        state,
        playerId,
        { x: unit.x, y: unit.y },
        gameSetup.rules,
        gameSetup.pieces,
      ).map((target) => ({
        from: { x: unit.x, y: unit.y },
        to: target,
      })),
    );
};

const scoreState = (
  state: GameState,
  maximizingPlayerId: string,
  gameSetup: GameSetup,
  pieceById: Map<string, PieceDefinition>,
) => {
  if (state.winnerId === maximizingPlayerId) {
    return TERMINAL_SCORE - state.moveCount;
  }
  if (state.winnerId && state.winnerId !== maximizingPlayerId) {
    return -TERMINAL_SCORE + state.moveCount;
  }
  if (state.phase === "finished" && !state.winnerId) {
    return 0;
  }

  const aliveUnits = getAliveUnits(state);
  let score = 0;

  for (const unit of aliveUnits) {
    const piece = pieceById.get(unit.pieceId);
    if (!piece) continue;

    const side = unit.ownerId === maximizingPlayerId ? 1 : -1;
    score += side * getPieceValue(piece);
    score +=
      side *
      getPositionScore(
        unit,
        gameSetup.rules.board.width,
        gameSetup.rules.board.height,
      ) *
      POSITION_WEIGHT;

    const revealedToEnemy = unit.revealedTo.some(
      (revealedPlayerId) =>
        revealedPlayerId !== unit.ownerId && revealedPlayerId !== maximizingPlayerId,
    );
    if (revealedToEnemy) {
      score -= side * REVEAL_WEIGHT;
    }
  }

  const opponentId =
    state.players.find((player) => player.id !== maximizingPlayerId)?.id ?? null;
  const mobility =
    getAllLegalMoves(state, maximizingPlayerId, gameSetup).length -
    (opponentId ? getAllLegalMoves(state, opponentId, gameSetup).length : 0);

  return score + mobility * MOBILITY_WEIGHT;
};

export const minimax = (
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayerId: string,
  gameSetup: GameSetup,
  pieceById: Map<string, PieceDefinition>,
): number => {
  if (
    depth === 0 ||
    state.phase !== "battle" ||
    state.winnerId ||
    !state.turnPlayerId
  ) {
    return scoreState(state, maximizingPlayerId, gameSetup, pieceById);
  }

  const currentPlayerId = state.turnPlayerId;
  const legalMoves = getAllLegalMoves(state, currentPlayerId, gameSetup);
  if (legalMoves.length === 0) {
    return scoreState(state, maximizingPlayerId, gameSetup, pieceById);
  }

  const isMaximizingTurn = currentPlayerId === maximizingPlayerId;
  let bestScore = isMaximizingTurn ? -Infinity : Infinity;

  for (const move of legalMoves) {
    const result = applyMoveToState(
      state,
      currentPlayerId,
      move.from,
      move.to,
      gameSetup.rules,
      gameSetup.pieces,
    );
    if (!result.nextState) continue;

    const nextScore = minimax(
      result.nextState,
      depth - 1,
      alpha,
      beta,
      maximizingPlayerId,
      gameSetup,
      pieceById,
    );

    if (isMaximizingTurn) {
      bestScore = Math.max(bestScore, nextScore);
      alpha = Math.max(alpha, nextScore);
    } else {
      bestScore = Math.min(bestScore, nextScore);
      beta = Math.min(beta, nextScore);
    }

    if (beta <= alpha) break;
  }

  return bestScore;
};

import type { GameSetup, GameState, Position } from "../../shared/schema";
import type { AiChosenMove } from "./types";

import { applyMoveToState } from "../engine";
import { getAiBestMoveProbability, getAiScoreMargin, getAiSearchDepth } from "./config";
import { buildPieceMap, getAllLegalMoves, minimax } from "./search";

type CandidateMove = {
  from: Position;
  score: number;
  to: Position;
};

export const chooseAiMove = (
  state: GameState,
  playerId: string,
  gameSetup: GameSetup,
): AiChosenMove | null => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || state.phase !== "battle" || state.turnPlayerId !== playerId) {
    return null;
  }

  const candidateMoves = getAllLegalMoves(state, playerId, gameSetup);
  if (candidateMoves.length === 0) {
    return null;
  }

  const pieceById = buildPieceMap(gameSetup.pieces);
  const depth = getAiSearchDepth(player.aiConfig);
  const scoredMoves: CandidateMove[] = candidateMoves
    .map((move) => {
      const result = applyMoveToState(
        state,
        playerId,
        move.from,
        move.to,
        gameSetup.rules,
        gameSetup.pieces,
      );

      return {
        from: move.from,
        score: result.nextState
          ? minimax(
              result.nextState,
              Math.max(0, depth - 1),
              -Infinity,
              Infinity,
              playerId,
              gameSetup,
              pieceById,
            )
          : -Infinity,
        to: move.to,
      };
    })
    .sort((left, right) => right.score - left.score);

  const bestScore = scoredMoves[0]?.score ?? -Infinity;
  const similarMoves = scoredMoves.filter(
    (move) => bestScore - move.score <= getAiScoreMargin(player.aiConfig),
  );
  const shouldPickBest =
    similarMoves.length === 1 ||
    Math.random() <= getAiBestMoveProbability(player.aiConfig);
  const chosenMove = shouldPickBest
    ? similarMoves[0]
    : similarMoves[Math.floor(Math.random() * similarMoves.length)];

  if (!chosenMove) return null;

  return {
    ...chosenMove.to,
    from: chosenMove.from,
    score: chosenMove.score,
  };
};

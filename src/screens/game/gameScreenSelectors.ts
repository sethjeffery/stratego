import type { GameDisplayPlayer } from "../../lib/gamePlayers";
import type {
  GameChatMessage,
  GameState,
  PieceDefinition,
  Position,
} from "../../shared/schema";

import { gamePieces } from "../../lib/gameConfig";
import { getAliveUnits } from "../../shared/schema";

export const pieceById = new Map(gamePieces.map((piece) => [piece.id, piece]));

export const getPlayerColorClass = (playerId: string, playerOneId: null | string) =>
  playerId === playerOneId ? "player-one" : "player-two";

export const getPieceTraits = (piece: PieceDefinition) =>
  [
    piece.id === "flag" ? "Capturing it wins the game." : null,
    piece.canTraverseMany ? "Moves multiple spaces in a line." : null,
    piece.immovable ? "Cannot move once deployed." : null,
    piece.canKill
      ? `Kills the ${pieceById.get(piece.canKill)?.label} if attacking.`
      : null,
  ].filter((trait): trait is string => Boolean(trait));

export const getInspectedPieceState = (
  state: GameState,
  selected: null | Position,
  myId: null | string,
) => {
  const inspectedUnit = selected
    ? (getAliveUnits(state).find(
        (unit) => unit.x === selected.x && unit.y === selected.y,
      ) ?? null)
    : null;
  const inspectedPiece = inspectedUnit
    ? (pieceById.get(inspectedUnit.pieceId) ?? null)
    : null;
  const inspectedVisible = inspectedUnit
    ? inspectedUnit.ownerId === myId || inspectedUnit.revealedTo.includes(myId ?? "")
    : false;

  return {
    inspectedPiece,
    inspectedPieceTraits:
      inspectedVisible && inspectedPiece ? getPieceTraits(inspectedPiece) : [],
    inspectedUnit,
    inspectedVisible,
  };
};

export type MainStatus =
  | "active"
  | "archived"
  | "loser"
  | "setup"
  | "waiting"
  | "winner";
export const getMainStatus = ({
  archived,
  isMyTurn,
  isReady,
  myId,
  state,
}: {
  archived: boolean;
  isMyTurn: boolean;
  isReady: boolean;
  myId: null | string;
  state: GameState;
}): MainStatus => {
  if (archived) return "archived";

  if (state.winnerId) {
    return state.winnerId === myId ? "winner" : "loser";
  }

  if (state.phase === "setup") {
    return isReady ? "waiting" : "setup";
  }

  return isMyTurn ? "active" : "waiting";
};

export const getCompletionStats = (state: GameState) => {
  const battleMessages = state.chatMessages.filter(
    (message) => message.type === "battle" && message.battle,
  );

  const killsByPiece = new Map<
    string,
    { kills: number; ownerId: string; pieceId: string; score: number; value: number }
  >();

  battleMessages.forEach((message) => {
    const battle = message.battle;
    if (!battle || battle.winner === "both") return;

    const killerPieceId =
      battle.winner === "attacker" ? battle.attackerPieceId : battle.defenderPieceId;
    const killerOwnerId =
      battle.winner === "attacker" ? battle.attackerOwnerId : battle.defenderOwnerId;
    const defeatedPieceId =
      battle.winner === "attacker" ? battle.defenderPieceId : battle.attackerPieceId;
    const killer = pieceById.get(killerPieceId);
    const defeated = pieceById.get(defeatedPieceId);
    if (!killer || !defeated || killer.rank <= 0) return;

    const key = `${killerOwnerId}::${killerPieceId}`;
    const current = killsByPiece.get(key) ?? {
      kills: 0,
      ownerId: killerOwnerId,
      pieceId: killerPieceId,
      score: 0,
      value: 0,
    };
    current.kills += 1;
    current.value += defeated.rank;
    current.score = current.value / killer.rank;
    killsByPiece.set(key, current);
  });

  const mvp =
    [...killsByPiece.values()].sort(
      (left, right) => right.score - left.score || right.value - left.value,
    )[0] ?? null;
  const startTime = state.startedAt ? new Date(state.startedAt) : null;
  const endTime = state.finishedAt ? new Date(state.finishedAt) : null;
  const matchTimeMs =
    startTime && endTime ? Math.max(0, endTime.getTime() - startTime.getTime()) : null;

  return {
    battleCount: battleMessages.length,
    matchTimeMs,
    mvp,
  };
};

export type CompletionOutcomeIcon = "flag" | "medal" | "skull";
export type GameCompletionStats = ReturnType<typeof getCompletionStats>;

export const formatDuration = (durationMs: null | number) => {
  if (durationMs === null) return "Unknown";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const getCompletionCopy = (
  state: GameState,
  players: GameDisplayPlayer[],
  myId: null | string,
) => {
  const winner = players.find((player) => player.id === state.winnerId) ?? null;
  const surrenderedPlayer =
    players.find((player) => player.id === state.surrenderedById) ?? null;
  const didISurrender = state.surrenderedById === myId;
  const didIWin = Boolean(myId) && state.winnerId === myId;

  let completionDescription = "Flag secured. Match complete.";
  let completionIcon: CompletionOutcomeIcon = didIWin ? "medal" : "skull";
  let completionTitle = didIWin ? "You won" : "You lost";

  if (state.completionReason === "surrender") {
    completionIcon = "flag";
    completionDescription = didISurrender
      ? "You surrendered."
      : `${surrenderedPlayer?.name ?? "A player"} surrendered.`;
    completionTitle = didISurrender
      ? "You surrendered"
      : `${surrenderedPlayer?.name ?? "A player"} surrendered`;
  }

  return {
    completionDescription,
    completionIcon,
    completionTitle,
    surrenderedPlayer,
    winner,
  };
};

export const getBattleMessageDisplay = (
  message: GameChatMessage,
  myId: null | string,
) => {
  const battle = message.battle;
  if (!battle) return null;

  const attackerPiece = pieceById.get(battle.attackerPieceId);
  const defenderPiece = pieceById.get(battle.defenderPieceId);
  const didAttackerWin = battle.winner === "attacker";
  const didDefenderWin = battle.winner === "defender";
  const isLossForViewer =
    (didAttackerWin && myId === battle.defenderOwnerId) ||
    (didDefenderWin && myId === battle.attackerOwnerId);

  const firstPieceId = isLossForViewer
    ? didAttackerWin
      ? battle.defenderPieceId
      : battle.attackerPieceId
    : didAttackerWin
      ? battle.attackerPieceId
      : battle.defenderPieceId;
  const firstOwnerId = isLossForViewer
    ? didAttackerWin
      ? battle.defenderOwnerId
      : battle.attackerOwnerId
    : didAttackerWin
      ? battle.attackerOwnerId
      : battle.defenderOwnerId;
  const secondPieceId = isLossForViewer
    ? didAttackerWin
      ? battle.attackerPieceId
      : battle.defenderPieceId
    : didAttackerWin
      ? battle.defenderPieceId
      : battle.attackerPieceId;
  const secondOwnerId = isLossForViewer
    ? didAttackerWin
      ? battle.attackerOwnerId
      : battle.defenderOwnerId
    : didAttackerWin
      ? battle.defenderOwnerId
      : battle.attackerOwnerId;

  return {
    articleLabel:
      battle.winner === "both"
        ? `${attackerPiece?.label ?? "Unknown unit"} and ${defenderPiece?.label ?? "Unknown unit"} died`
        : isLossForViewer
          ? `${pieceById.get(firstPieceId)?.label ?? "Unknown unit"} killed by ${pieceById.get(secondPieceId)?.label ?? "Unknown unit"}`
          : `${pieceById.get(firstPieceId)?.label ?? "Unknown unit"} killed ${pieceById.get(secondPieceId)?.label ?? "Unknown unit"}`,
    battle,
    firstOwnerId,
    firstPieceId,
    isLossForViewer,
    secondOwnerId,
    secondPieceId,
  };
};

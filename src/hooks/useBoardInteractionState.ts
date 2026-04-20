import { useMemo } from "react";

import type { GameState, Position } from "../shared/schema";
import type { PendingBoardAction } from "../types/ui";

import { getLegalMovesForUnit, getSetupSwapTargets } from "../lib/engine";
import { gamePieces, gameRules } from "../lib/gameConfig";

type UseBoardInteractionStateArgs = {
  isCurrentSessionArchived: boolean;
  myId: null | string;
  pendingBoardAction: null | PendingBoardAction;
  selected: null | Position;
  state: GameState | null;
};

export function useBoardInteractionState({
  isCurrentSessionArchived,
  myId,
  pendingBoardAction,
  selected,
  state,
}: UseBoardInteractionStateArgs) {
  const isSetupPhase = Boolean(state && state.phase === "setup");

  const disabled =
    !state ||
    !myId ||
    isCurrentSessionArchived ||
    Boolean(pendingBoardAction) ||
    (isSetupPhase
      ? state.setupReadyPlayerIds.includes(myId)
      : state.turnPlayerId !== myId);

  const legalTargets = useMemo(() => {
    if (!state || !myId || !selected || disabled) return [];
    if (state.phase === "setup") {
      return getSetupSwapTargets(state, myId, selected, gameRules, gamePieces);
    }
    return getLegalMovesForUnit(state, myId, selected, gameRules, gamePieces);
  }, [disabled, myId, selected, state]);

  const selectablePieceKeys = useMemo(() => {
    if (!state || !myId || disabled) return new Set<string>();

    const keys =
      state.phase === "setup"
        ? state.units
            .filter((unit) => unit.ownerId === myId)
            .filter(
              (unit) =>
                getSetupSwapTargets(
                  state,
                  myId,
                  { x: unit.x, y: unit.y },
                  gameRules,
                  gamePieces,
                ).length > 0,
            )
            .map((unit) => `${unit.x}-${unit.y}`)
        : state.units
            .filter((unit) => unit.ownerId === myId)
            .filter(
              (unit) =>
                getLegalMovesForUnit(
                  state,
                  myId,
                  { x: unit.x, y: unit.y },
                  gameRules,
                  gamePieces,
                ).length > 0,
            )
            .map((unit) => `${unit.x}-${unit.y}`);

    return new Set(keys);
  }, [disabled, myId, state]);

  return {
    disabled,
    isSetupPhase,
    legalTargets,
    selectablePieceKeys,
  };
}

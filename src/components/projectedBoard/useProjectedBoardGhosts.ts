import { useLayoutEffect, useRef, useState } from "react";

import type { GameState, Position, Unit } from "../../shared/schema";
import type { PendingBoardAction } from "../../types/ui";
import type { GhostUnitState } from "./types";

type UseProjectedBoardGhostsArgs = {
  isUnitVisibleToViewer: (unit: Unit) => boolean;
  pendingBoardAction: PendingBoardAction | null;
  state: GameState;
  toDisplayPosition: (position: Position) => Position;
};

export function useProjectedBoardGhosts({
  isUnitVisibleToViewer,
  pendingBoardAction,
  state,
  toDisplayPosition,
}: UseProjectedBoardGhostsArgs) {
  const [ghostUnit, setGhostUnit] = useState<GhostUnitState | null>(null);
  const [ghostResolving, setGhostResolving] = useState(false);
  const animatedActionKeyRef = useRef<string | null>(null);
  const previousStateRef = useRef(state);

  useLayoutEffect(() => {
    if (!pendingBoardAction || !state.lastBattle) return;
    if (animatedActionKeyRef.current === pendingBoardAction.optimisticStateKey) {
      return;
    }

    const attacker = pendingBoardAction.previousState.units.find(
      (unit) =>
        unit.x === pendingBoardAction.previousSelection.x &&
        unit.y === pendingBoardAction.previousSelection.y,
    );
    if (!attacker || state.units.some((unit) => unit.id === attacker.id)) return;

    animatedActionKeyRef.current = pendingBoardAction.optimisticStateKey;
    setGhostResolving(false);
    setGhostUnit({
      endDisplay: toDisplayPosition(state.lastBattle.at),
      key: pendingBoardAction.optimisticStateKey,
      startDisplay: toDisplayPosition(pendingBoardAction.previousSelection),
      unit: attacker,
    });

    const frameId = window.requestAnimationFrame(() => {
      setGhostResolving(true);
    });
    const timeoutId = window.setTimeout(() => {
      setGhostUnit((current) =>
        current?.key === pendingBoardAction.optimisticStateKey ? null : current,
      );
      setGhostResolving(false);
    }, 420);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [pendingBoardAction, state.lastBattle, state.units, toDisplayPosition]);

  useLayoutEffect(() => {
    const previousState = previousStateRef.current;
    previousStateRef.current = state;

    if (
      previousState === state ||
      state.lastBattle ||
      state.moveCount === previousState.moveCount
    ) {
      return;
    }

    const previousUnitById = new Map(
      previousState.units.map((unit) => [unit.id, unit]),
    );
    const movedHiddenUnit = state.units.find((unit) => {
      const previousUnit = previousUnitById.get(unit.id);
      if (!previousUnit) return false;
      if (previousUnit.x === unit.x && previousUnit.y === unit.y) return false;

      return !isUnitVisibleToViewer(previousUnit) && !isUnitVisibleToViewer(unit);
    });

    if (!movedHiddenUnit) return;

    const previousUnit = previousUnitById.get(movedHiddenUnit.id)!;
    const animationKey = `hidden-move-${state.moveCount}-${movedHiddenUnit.id}`;
    if (animatedActionKeyRef.current === animationKey) return;

    animatedActionKeyRef.current = animationKey;
    setGhostResolving(false);
    setGhostUnit({
      endDisplay: toDisplayPosition(movedHiddenUnit),
      hideLiveUnitId: movedHiddenUnit.id,
      key: animationKey,
      startDisplay: toDisplayPosition(previousUnit),
      unit: movedHiddenUnit,
    });

    const frameId = window.requestAnimationFrame(() => {
      setGhostResolving(true);
    });
    const timeoutId = window.setTimeout(() => {
      setGhostUnit((current) => (current?.key === animationKey ? null : current));
      setGhostResolving(false);
    }, 320);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [isUnitVisibleToViewer, state, toDisplayPosition]);

  return {
    ghostResolving,
    ghostUnit,
  };
}

import {
  type MutableRefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { BattleChatMessage, GameState, Position, Unit } from "../../shared/schema";

import { isUnitAlive } from "../../shared/schema";

const BOARD_MOVE_TO_BATTLE_MS = 340;
const ATTACK_ANIMATION_DURATION_MS = 3000;

const clearAnimationFrame = (frameRef: MutableRefObject<null | number>) => {
  if (frameRef.current === null) return;

  window.cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
};

const clearTimeoutRef = (timeoutRef: MutableRefObject<null | number>) => {
  if (timeoutRef.current === null) return;

  window.clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
};

const cloneUnit = (unit: Unit): Unit => ({
  ...unit,
  revealedTo: [...unit.revealedTo],
});

const stripDisplayedBattleState = (state: GameState): GameState => ({
  ...state,
  lastBattle: undefined,
});

const findAliveUnitAt = (units: Unit[], position: Position) =>
  units.find(
    (unit) => isUnitAlive(unit) && unit.x === position.x && unit.y === position.y,
  ) ?? null;

const createBattleMovementState = (
  previousState: GameState,
  state: GameState,
): GameState => {
  const lastBattle = state.lastBattle;
  if (!lastBattle) return state;

  const units = previousState.units.map(cloneUnit);
  const attacker = findAliveUnitAt(units, lastBattle.attackerFrom);

  if (!attacker) {
    return stripDisplayedBattleState(previousState);
  }

  attacker.x = lastBattle.at.x;
  attacker.y = lastBattle.at.y;

  return {
    ...previousState,
    lastBattle: undefined,
    units,
  };
};

const getLatestBattleChat = (state: GameState) =>
  [...state.chatMessages]
    .reverse()
    .find((message) => message.type === "battle" && message.battle)?.battle ?? null;

const deriveBattleChatFromStates = (
  previousState: GameState,
  state: GameState,
): BattleChatMessage | null => {
  const lastBattle = state.lastBattle;
  if (!lastBattle) return null;

  const attacker = findAliveUnitAt(previousState.units, lastBattle.attackerFrom);
  const defender = previousState.units.find(
    (unit) =>
      isUnitAlive(unit) &&
      unit.x === lastBattle.at.x &&
      unit.y === lastBattle.at.y &&
      unit.id !== attacker?.id,
  );

  if (!attacker || !defender) return null;

  return {
    attackerOwnerId: attacker.ownerId,
    attackerPieceId: lastBattle.attackerPieceId,
    defenderOwnerId: defender.ownerId,
    defenderPieceId: lastBattle.defenderPieceId,
    winner: lastBattle.winner,
  };
};

const getPlaybackBattle = (previousState: GameState, state: GameState) =>
  getLatestBattleChat(state) ?? deriveBattleChatFromStates(previousState, state);

export function useAttackAnimationPlayback(state: GameState | null) {
  const [attackAnimationBattle, setAttackAnimationBattle] =
    useState<BattleChatMessage | null>(null);
  const [attackAnimationKey, setAttackAnimationKey] = useState<null | string>(null);
  const [boardState, setBoardState] = useState<GameState | null>(state);
  const [isAttackAnimationActive, setIsAttackAnimationActive] = useState(false);
  const previousStateRef = useRef<GameState | null>(state);
  const latestStateRef = useRef<GameState | null>(state);
  const playbackIdRef = useRef(0);
  const frameRef = useRef<null | number>(null);
  const battleStartTimeoutRef = useRef<null | number>(null);
  const battleFinishTimeoutRef = useRef<null | number>(null);

  useLayoutEffect(() => {
    latestStateRef.current = state;

    if (!state) {
      previousStateRef.current = state;
      setAttackAnimationBattle(null);
      setAttackAnimationKey(null);
      setBoardState(state);
      setIsAttackAnimationActive(false);
      clearAnimationFrame(frameRef);
      clearTimeoutRef(battleStartTimeoutRef);
      clearTimeoutRef(battleFinishTimeoutRef);
      return;
    }

    const previousState = previousStateRef.current;
    const isNewBattleMove = Boolean(
      previousState && previousState.moveCount !== state.moveCount && state.lastBattle,
    );

    if (!previousState || !isNewBattleMove) {
      previousStateRef.current = state;

      if (playbackIdRef.current === 0) {
        setBoardState(state);
      }

      return;
    }

    const playbackBattle = getPlaybackBattle(previousState, state);
    if (!playbackBattle) {
      previousStateRef.current = state;
      setBoardState(state);
      setAttackAnimationBattle(null);
      setAttackAnimationKey(null);
      setIsAttackAnimationActive(false);
      playbackIdRef.current = 0;
      clearAnimationFrame(frameRef);
      clearTimeoutRef(battleStartTimeoutRef);
      clearTimeoutRef(battleFinishTimeoutRef);
      return;
    }

    const playbackId = playbackIdRef.current + 1;
    const startBoardState = stripDisplayedBattleState(previousState);
    const movementBoardState = createBattleMovementState(previousState, state);

    playbackIdRef.current = playbackId;
    previousStateRef.current = state;
    setAttackAnimationBattle(null);
    setAttackAnimationKey(`battle-${state.moveCount}`);
    setBoardState(startBoardState);
    setIsAttackAnimationActive(true);
    clearAnimationFrame(frameRef);
    clearTimeoutRef(battleStartTimeoutRef);
    clearTimeoutRef(battleFinishTimeoutRef);

    frameRef.current = window.requestAnimationFrame(() => {
      if (playbackIdRef.current !== playbackId) return;

      setBoardState(movementBoardState);
      frameRef.current = null;
    });

    battleStartTimeoutRef.current = window.setTimeout(() => {
      if (playbackIdRef.current !== playbackId) return;

      setAttackAnimationBattle(playbackBattle);
      battleStartTimeoutRef.current = null;
    }, BOARD_MOVE_TO_BATTLE_MS);

    battleFinishTimeoutRef.current = window.setTimeout(() => {
      if (playbackIdRef.current !== playbackId) return;

      playbackIdRef.current = 0;
      setAttackAnimationBattle(null);
      setAttackAnimationKey(null);
      setBoardState(latestStateRef.current);
      setIsAttackAnimationActive(false);
      battleFinishTimeoutRef.current = null;
    }, BOARD_MOVE_TO_BATTLE_MS + ATTACK_ANIMATION_DURATION_MS);
  }, [state]);

  useEffect(
    () => () => {
      clearAnimationFrame(frameRef);
      clearTimeoutRef(battleStartTimeoutRef);
      clearTimeoutRef(battleFinishTimeoutRef);
    },
    [],
  );

  return {
    attackAnimationBattle,
    attackAnimationKey,
    boardState,
    isAttackAnimationActive,
  };
}

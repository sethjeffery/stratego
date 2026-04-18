import { useEffect, useRef, useState } from "react";

import {
  applyMoveToState,
  applySetupSwapToState,
  createRematchState,
  markPlayerSetupReady,
} from "../lib/engine";
import { gamePieces, gameRules } from "../lib/gameConfig";
import {
  applyMove as applySupabaseMove,
  applySetupSwap as applySupabaseSetupSwap,
  closeFinishedGame as closeSupabaseFinishedGame,
  markSetupReady as markSupabaseSetupReady,
  resetFinishedGame as resetSupabaseFinishedGame,
  sendChatMessage as sendSupabaseChatMessage,
  type SessionAccess,
  surrenderGame as surrenderSupabaseGame,
} from "../lib/supabaseGameService";
import type { GameState, Position } from "../shared/schema";
import { appendChatMessage } from "../shared/schema";
import type { PendingBoardAction } from "../types/ui";
import { serializeBoardActionState } from "../types/ui";
import { useBoardInteractionState } from "./useBoardInteractionState";
import { useTouchSessionMembership } from "./useGameService";

type UseSessionGameStateArgs = {
  debugBoardEnabled: boolean;
  routeSessionId: string;
  sessionAccess?: SessionAccess;
  setError: (message: string | null) => void;
};

export function useSessionGameState({
  debugBoardEnabled,
  routeSessionId,
  sessionAccess,
  setError,
}: UseSessionGameStateArgs) {
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<Position | null>(null);
  const [pendingBoardAction, setPendingBoardAction] =
    useState<PendingBoardAction | null>(null);
  const committedOptimisticStateKey = useRef<string | null>(null);
  const touchSessionMembershipMutation = useTouchSessionMembership();
  const myId = sessionAccess?.membership?.player_id ?? null;
  const isCurrentSessionArchived = Boolean(sessionAccess?.membership?.archived_at);
  const currentMoveCount = state?.moveCount ?? null;

  const { disabled, isSetupPhase, legalTargets, selectablePieceKeys } =
    useBoardInteractionState({
      state,
      myId,
      selected,
      pendingBoardAction,
      isCurrentSessionArchived,
    });

  useEffect(() => {
    if (!state || !selected) return;

    const stillExists = state.units.some(
      (unit) => unit.x === selected.x && unit.y === selected.y,
    );
    if (!stillExists) {
      setSelected(null);
    }
  }, [selected, state]);

  useEffect(() => {
    if (debugBoardEnabled || !routeSessionId) return;

    const nextState = sessionAccess?.session.state ?? null;
    if (
      pendingBoardAction &&
      nextState &&
      serializeBoardActionState(nextState) === pendingBoardAction.optimisticStateKey
    ) {
      committedOptimisticStateKey.current = pendingBoardAction.optimisticStateKey;
      setPendingBoardAction(null);
    }

    setState(nextState);
  }, [
    debugBoardEnabled,
    pendingBoardAction,
    routeSessionId,
    sessionAccess?.session.state,
  ]);

  useEffect(() => {
    if (
      debugBoardEnabled ||
      !routeSessionId ||
      !sessionAccess?.membership ||
      currentMoveCount === null
    ) {
      return;
    }

    void touchSessionMembershipMutation.trigger(routeSessionId).catch(() => undefined);
  }, [
    currentMoveCount,
    debugBoardEnabled,
    routeSessionId,
    sessionAccess?.membership,
    touchSessionMembershipMutation,
  ]);

  const reset = () => {
    committedOptimisticStateKey.current = null;
    setState(null);
    setPendingBoardAction(null);
    setSelected(null);
  };

  const onCellClick = async (target: Position) => {
    if (!state) return;

    const clickedUnit = state.units.find(
      (unit) => unit.x === target.x && unit.y === target.y,
    );
    const targetKey = `${target.x}-${target.y}`;

    if (!myId || disabled) {
      if (clickedUnit) {
        setSelected((current) =>
          current?.x === target.x && current.y === target.y ? null : target,
        );
      } else if (selected) {
        setSelected(null);
      }
      setError(null);
      return;
    }

    if (!selected) {
      if (selectablePieceKeys.has(targetKey) || clickedUnit) {
        setSelected(target);
        setError(null);
      }
      return;
    }

    if (selected.x === target.x && selected.y === target.y) {
      setSelected(null);
      return;
    }

    const mine = clickedUnit?.ownerId === myId ? clickedUnit : null;
    if (mine) {
      const isLegalSetupSwapTarget = legalTargets.some(
        (move) => move.x === target.x && move.y === target.y,
      );

      if (!isSetupPhase || !isLegalSetupSwapTarget) {
        setSelected(target);
        setError(null);
        return;
      }
    }

    if (!legalTargets.some((move) => move.x === target.x && move.y === target.y)) {
      setSelected(null);
      setError(null);
      return;
    }

    const previousState = state;
    const previousSelection = selected;
    const result = isSetupPhase
      ? applySetupSwapToState(
          previousState,
          myId,
          previousSelection,
          target,
          gameRules,
          gamePieces,
        )
      : applyMoveToState(
          previousState,
          myId,
          previousSelection,
          target,
          gameRules,
          gamePieces,
        );

    if (result.error || !result.nextState) {
      setError(result.error ?? "Action rejected.");
      return;
    }

    if (debugBoardEnabled) {
      setState(result.nextState);
      setSelected(null);
      setError("Debug board preview mode.");
      return;
    }

    const optimisticStateKey = serializeBoardActionState(result.nextState);
    committedOptimisticStateKey.current = null;
    setPendingBoardAction({
      optimisticStateKey,
      previousSelection,
      previousState,
    });
    setState(result.nextState);
    setSelected(null);
    setError(null);

    try {
      if (isSetupPhase) {
        await applySupabaseSetupSwap(
          previousState.roomCode,
          myId,
          previousSelection,
          target,
        );
      } else {
        await applySupabaseMove(
          previousState.roomCode,
          myId,
          previousSelection,
          target,
        );
      }
      setPendingBoardAction(null);
      committedOptimisticStateKey.current = null;
    } catch (err) {
      if (committedOptimisticStateKey.current === optimisticStateKey) {
        committedOptimisticStateKey.current = null;
        return;
      }
      committedOptimisticStateKey.current = null;
      setPendingBoardAction(null);
      setState(previousState);
      setSelected(previousSelection);
      setError((err as Error).message);
    }
  };

  const markReady = async () => {
    if (!state || !myId || state.phase !== "setup" || pendingBoardAction) return;

    if (debugBoardEnabled) {
      const result = markPlayerSetupReady(state, myId);
      if (result.error || !result.nextState) {
        setError(result.error ?? "Could not mark ready.");
      } else {
        setState(result.nextState);
        setSelected(null);
        setError("Debug board preview mode.");
      }
      return;
    }

    try {
      await markSupabaseSetupReady(state.roomCode, myId);
      setSelected(null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const playAgain = async () => {
    if (!state || !myId || state.phase !== "finished") return;

    if (debugBoardEnabled) {
      setState(createRematchState(state, gameRules, gamePieces));
      setSelected(null);
      setError("Debug board preview mode.");
      return;
    }

    try {
      await resetSupabaseFinishedGame(state.roomCode, myId);
      setSelected(null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const finishGame = async () => {
    if (!state || !myId || state.phase !== "finished") return;

    if (debugBoardEnabled) {
      setState({
        ...state,
        phase: "closed",
        turnPlayerId: null,
      });
      setSelected(null);
      setError("Debug board preview mode.");
      return;
    }

    try {
      await closeSupabaseFinishedGame(state.roomCode, myId);
      setSelected(null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const surrenderGame = async () => {
    if (!state || !myId || pendingBoardAction) return;
    if (state.phase === "finished" || state.phase === "closed") return;

    if (debugBoardEnabled) {
      const winner = state.players.find((player) => player.id !== myId);
      setState({
        ...state,
        phase: "finished",
        turnPlayerId: null,
        winnerId: winner?.id ?? null,
        completionReason: "surrender",
        surrenderedById: myId,
        finishedAt: new Date().toISOString(),
      });
      setSelected(null);
      setError("Debug board preview mode.");
      return;
    }

    try {
      await surrenderSupabaseGame(state.roomCode, myId);
      setSelected(null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const sendChatMessage = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !state || !myId) return;

    const sender = state.players.find((player) => player.id === myId);
    if (!sender) {
      const nextError = "Unknown player.";
      setError(nextError);
      throw new Error(nextError);
    }

    const messageId = `${myId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sentAt = new Date().toISOString();

    if (debugBoardEnabled) {
      setState((current) =>
        current
          ? appendChatMessage(current, {
              id: messageId,
              type: "player",
              playerId: myId,
              senderName: sender.name,
              text: trimmedMessage,
              sentAt,
            })
          : current,
      );
      setError("Debug board preview mode.");
      return;
    }

    setState((current) =>
      current
        ? appendChatMessage(current, {
            id: messageId,
            type: "player",
            playerId: myId,
            senderName: sender.name,
            text: trimmedMessage,
            sentAt,
          })
        : current,
    );

    try {
      await sendSupabaseChatMessage(state.roomCode, myId, trimmedMessage, {
        messageId,
        sentAt,
      });
      setError(null);
    } catch (err) {
      setState((current) =>
        current
          ? {
              ...current,
              chatMessages: current.chatMessages.filter(
                (chatMessage) => chatMessage.id !== messageId,
              ),
            }
          : current,
      );
      setError((err as Error).message);
      throw err;
    }
  };

  return {
    disabled,
    isCurrentSessionArchived,
    isSetupPhase,
    legalTargets,
    markReady,
    myId,
    onCellClick,
    pendingBoardAction,
    playAgain,
    reset,
    selectablePieceKeys,
    selected,
    sendChatMessage,
    setSelected,
    state,
    surrenderGame,
    finishGame,
  };
}

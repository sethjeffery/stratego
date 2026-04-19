import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSWRConfig } from "swr";

import { useBoardInteractionState } from "../../hooks/useBoardInteractionState";
import { getSessionCacheKey } from "../../hooks/useGameService";
import { useCurrentUser } from "../../hooks/useProfile";
import {
  applyMoveToState,
  applySetupSwapToState,
  createRematchState,
  markPlayerSetupReady,
} from "../../lib/engine";
import { gamePieces, gameRules } from "../../lib/gameConfig";
import {
  applyMove as applySessionMove,
  applySetupSwap as applySessionSetupSwap,
  closeFinishedGame as closeSessionFinishedGame,
  markSetupReady as markSessionSetupReady,
  resetFinishedGame as resetSessionFinishedGame,
  sendChatMessage as sendSessionChatMessage,
  type SessionRow,
  surrenderGame as surrenderSessionGame,
} from "../../lib/supabaseGameService";
import type { GameState, Position } from "../../shared/schema";
import type { PendingBoardAction } from "../../types/ui";
import { serializeBoardActionState } from "../../types/ui";

export function useGameScreenController(session: SessionRow) {
  const navigate = useNavigate();
  const { mutate: mutateCache } = useSWRConfig();
  const { data: currentUser } = useCurrentUser();
  const [selected, setSelected] = useState<Position | null>(null);
  const [pendingBoardAction, setPendingBoardAction] =
    useState<PendingBoardAction | null>(null);

  const myMembership =
    session.memberships?.find(
      (membership) => membership.device_id === currentUser?.device_id,
    ) ?? null;
  const myId = myMembership?.device_id ?? null;
  const archived = Boolean(myMembership?.archived_at);
  const state = session.state;
  const sessionCacheKey = getSessionCacheKey(session.session_id);

  const { disabled, isSetupPhase, legalTargets, selectablePieceKeys } =
    useBoardInteractionState({
      state,
      myId,
      selected,
      pendingBoardAction,
      isCurrentSessionArchived: archived,
    });

  useEffect(() => {
    setSelected(null);
    setPendingBoardAction(null);
  }, [session.session_id]);

  useEffect(() => {
    if (!state || !selected) return;

    const stillExists = state.units.some(
      (unit) => unit.x === selected.x && unit.y === selected.y,
    );
    if (!stillExists) {
      setSelected(null);
    }
  }, [selected, state]);

  const leaveCurrentSession = () => {
    navigate("/");
  };

  const mutateSessionState = async (
    optimisticState: GameState,
    commit: () => Promise<GameState>,
  ) => {
    const optimisticUpdatedAt = new Date().toISOString();

    await mutateCache(
      sessionCacheKey,
      async (currentSession?: SessionRow) => {
        const nextState = await commit();
        const baseSession = currentSession ?? session;
        return {
          ...baseSession,
          state: nextState,
          updated_at: new Date().toISOString(),
        };
      },
      {
        optimisticData: (currentSession?: SessionRow) => {
          const baseSession = currentSession ?? session;
          return {
            ...baseSession,
            state: optimisticState,
            updated_at: optimisticUpdatedAt,
          };
        },
        populateCache: true,
        revalidate: false,
        rollbackOnError: true,
      },
    );
  };

  const canMarkReady =
    Boolean(myId) &&
    state?.phase === "setup" &&
    !pendingBoardAction &&
    !archived &&
    !state?.setupReadyPlayerIds.includes(myId ?? "");
  const isMyTurn = Boolean(myId && state?.turnPlayerId === myId);
  const canSendChat = Boolean(myId) && !archived && !state?.winnerId;

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
      return;
    }

    if (!selected) {
      if (selectablePieceKeys.has(targetKey) || clickedUnit) {
        setSelected(target);
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
        return;
      }
    }

    if (!legalTargets.some((move) => move.x === target.x && move.y === target.y)) {
      setSelected(null);
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
      return;
    }

    const optimisticStateKey = serializeBoardActionState(result.nextState);
    setPendingBoardAction({
      optimisticStateKey,
      previousSelection,
      previousState,
    });
    setSelected(null);

    try {
      await mutateSessionState(result.nextState, () =>
        isSetupPhase
          ? applySessionSetupSwap(
              previousState.roomCode,
              myId,
              previousSelection,
              target,
            )
          : applySessionMove(
              previousState.roomCode,
              myId,
              previousSelection,
              target,
            ),
      );
      setPendingBoardAction(null);
    } catch {
      // SWR rolls back the optimistic session cache automatically.
      setPendingBoardAction(null);
      setSelected(previousSelection);
    }
  };

  const markReady = async () => {
    if (!state || !canMarkReady || !myId) return;

    const result = markPlayerSetupReady(state, myId);
    if (!result.nextState) return;

    setSelected(null);

    try {
      await mutateSessionState(result.nextState, () =>
        markSessionSetupReady(state.roomCode, myId),
      );
    } catch {
      // SWR rolls back the optimistic session cache automatically.
    }
  };

  const playAgain = async () => {
    if (!state || !myId || state.phase !== "finished") return;

    const nextState = createRematchState(state, gameRules, gamePieces);
    setSelected(null);

    try {
      await mutateSessionState(nextState, () =>
        resetSessionFinishedGame(state.roomCode, myId),
      );
    } catch {
      // SWR rolls back the optimistic session cache automatically.
    }
  };

  const finishGame = async () => {
    if (!state || !myId || state.phase !== "finished") return;

    const nextState = {
      ...state,
      phase: "closed" as const,
      turnPlayerId: null,
    };
    setSelected(null);

    try {
      await mutateSessionState(nextState, () =>
        closeSessionFinishedGame(state.roomCode, myId),
      );
    } catch {
      // SWR rolls back the optimistic session cache automatically.
    }
  };

  const surrenderGame = async () => {
    if (!state || !myId || pendingBoardAction) return;
    if (state.phase === "finished" || state.phase === "closed") return;

    const winnerAfterSurrender = state.players.find((player) => player.id !== myId);
    const nextState = {
      ...state,
      phase: "finished" as const,
      turnPlayerId: null,
      winnerId: winnerAfterSurrender?.id ?? null,
      completionReason: "surrender" as const,
      surrenderedById: myId,
      finishedAt: new Date().toISOString(),
    };
    setSelected(null);

    try {
      await mutateSessionState(nextState, () =>
        surrenderSessionGame(state.roomCode, myId),
      );
    } catch {
      // SWR rolls back the optimistic session cache automatically.
    }
  };

  const sendChatMessage = async (message: string) => {
    if (!state || !myId) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const sender = state.players.find((player) => player.id === myId);
    if (!sender) return;

    const messageId = `${myId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sentAt = new Date().toISOString();
    const optimisticState = {
      ...state,
      chatMessages: [
        ...state.chatMessages,
        {
          id: messageId,
          type: "player" as const,
          playerId: myId,
          senderName: sender.name,
          text: trimmedMessage,
          sentAt,
        },
      ],
    };

    try {
      await mutateSessionState(optimisticState, () =>
        sendSessionChatMessage(state.roomCode, myId, trimmedMessage, {
          messageId,
          sentAt,
        }),
      );
    } catch {
      throw new Error("Could not send message.");
    }
  };

  return {
    archived,
    canMarkReady,
    canSendChat,
    disabled,
    finishGame,
    isMyTurn,
    legalTargets,
    leaveCurrentSession,
    markReady,
    myId,
    onCellClick,
    pendingBoardAction,
    playAgain,
    selectablePieceKeys,
    selected,
    sendChatMessage,
    state,
    surrenderGame,
  };
}

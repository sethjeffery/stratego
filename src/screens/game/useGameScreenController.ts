import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSWRConfig } from "swr";

import type { AiWorkerResponse } from "../../lib/aiWorker";
import type { GameSessionDetails } from "../../lib/supabaseGameService";
import type { GameState, Position } from "../../shared/schema";
import type { PendingBoardAction } from "../../types/ui";

import { useBoardInteractionState } from "../../hooks/useBoardInteractionState";
import { useCurrentUser } from "../../hooks/useProfile";
import { getAiThinkingDelayMs } from "../../lib/aiConfig";
import { chooseAiMove } from "../../lib/aiPlayer";
import {
  applyMoveToState,
  applySetupSwapToState,
  createRematchState,
  markPlayerSetupReady,
} from "../../lib/engine";
import { getGameSetupForState } from "../../lib/gameConfig";
import { getDisplayPlayerById, getGameDisplayPlayers } from "../../lib/gamePlayers";
import { getSessionCacheKey } from "../../lib/gameServiceCache";
import { getMemberById } from "../../lib/playerProfile";
import {
  applyMove as applySessionMove,
  applySetupSwap as applySessionSetupSwap,
  closeFinishedGame as closeSessionFinishedGame,
  markSetupReady as markSessionSetupReady,
  resetFinishedGame as resetSessionFinishedGame,
  sendChatMessage as sendSessionChatMessage,
  surrenderGame as surrenderSessionGame,
} from "../../lib/supabaseGameService";
import { getAliveUnits, isAiPlayer } from "../../shared/schema";
import { serializeBoardActionState } from "../../types/ui";

export function useGameScreenController(session: GameSessionDetails) {
  const navigate = useNavigate();
  const { mutate: mutateCache } = useSWRConfig();
  const { data: currentUser } = useCurrentUser();
  const [selected, setSelected] = useState<null | Position>(null);
  const [pendingBoardAction, setPendingBoardAction] =
    useState<null | PendingBoardAction>(null);
  const aiWorkerRef = useRef<null | Worker>(null);
  const pendingAiActionKeyRef = useRef<null | string>(null);
  const pendingAiJobRef = useRef<null | { actionKey: string; jobId: string }>(null);

  const state = session.state;
  const myMembership =
    getMemberById(session.memberships, currentUser?.device_id) ?? null;
  const myId = myMembership?.device_id ?? null;
  const myPlayer = state?.players.find((player) => player.id === myId) ?? null;
  const canControlPieces = Boolean(myPlayer && !isAiPlayer(myPlayer));
  const archived = Boolean(myMembership?.archived_at);
  const gameSetup = getGameSetupForState(state);
  const sessionCacheKey = getSessionCacheKey(session.session_id);
  const displayPlayers = getGameDisplayPlayers(state, session.memberships);
  const controllablePlayerId = canControlPieces ? myId : null;

  const { disabled, isSetupPhase, legalTargets, selectablePieceKeys } =
    useBoardInteractionState({
      isCurrentSessionArchived: archived,
      myId: controllablePlayerId,
      pendingBoardAction,
      selected,
      state,
    });

  useEffect(() => {
    setSelected(null);
    setPendingBoardAction(null);
    pendingAiJobRef.current = null;
    pendingAiActionKeyRef.current = null;
  }, [session.session_id]);

  useEffect(() => {
    if (!state || !selected) return;

    const stillExists = getAliveUnits(state).some(
      (unit) => unit.x === selected.x && unit.y === selected.y,
    );
    if (!stillExists) {
      setSelected(null);
    }
  }, [selected, state]);

  const leaveCurrentSession = () => {
    navigate("/");
  };

  const mutateSessionState = useCallback(
    async (optimisticState: GameState, commit: () => Promise<GameState>) => {
      const optimisticUpdatedAt = new Date().toISOString();

      await mutateCache(
        sessionCacheKey,
        async (currentSession?: GameSessionDetails) => {
          const nextState = await commit();
          const baseSession = currentSession ?? session;
          return {
            ...baseSession,
            state: nextState,
            updated_at: new Date().toISOString(),
          };
        },
        {
          optimisticData: (currentSession?: GameSessionDetails) => {
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
    },
    [mutateCache, session, sessionCacheKey],
  );
  const commitAiMove = useCallback(
    async (response: AiWorkerResponse) => {
      await mutateCache(
        sessionCacheKey,
        async (currentSession?: GameSessionDetails) => {
          const baseSession = currentSession ?? session;
          const currentState = baseSession.state;

          if (
            !currentState ||
            !response.move ||
            currentState.roomCode !== response.roomCode ||
            currentState.moveCount !== response.moveCount ||
            currentState.turnPlayerId !== response.playerId
          ) {
            return baseSession;
          }

          const currentGameSetup = getGameSetupForState(currentState);
          const result = applyMoveToState(
            currentState,
            response.playerId,
            response.move.from,
            response.move,
            currentGameSetup.rules,
            currentGameSetup.pieces,
          );
          if (!result.nextState) {
            return baseSession;
          }

          const nextState = await applySessionMove(
            response.roomCode,
            response.playerId,
            response.move.from,
            response.move,
          );

          return {
            ...baseSession,
            state: nextState,
            updated_at: new Date().toISOString(),
          };
        },
        {
          optimisticData: (currentSession?: GameSessionDetails) => {
            const baseSession = currentSession ?? session;
            const currentState = baseSession.state;

            if (
              !currentState ||
              !response.move ||
              currentState.roomCode !== response.roomCode ||
              currentState.moveCount !== response.moveCount ||
              currentState.turnPlayerId !== response.playerId
            ) {
              return baseSession;
            }

            const currentGameSetup = getGameSetupForState(currentState);
            const result = applyMoveToState(
              currentState,
              response.playerId,
              response.move.from,
              response.move,
              currentGameSetup.rules,
              currentGameSetup.pieces,
            );

            if (!result.nextState) {
              return baseSession;
            }

            return {
              ...baseSession,
              state: result.nextState,
              updated_at: new Date().toISOString(),
            };
          },
          populateCache: true,
          revalidate: false,
          rollbackOnError: true,
        },
      );
    },
    [mutateCache, session, sessionCacheKey],
  );

  const canMarkReady =
    Boolean(controllablePlayerId) &&
    state?.phase === "setup" &&
    !pendingBoardAction &&
    !archived &&
    !state?.setupReadyPlayerIds.includes(controllablePlayerId ?? "");
  const isMyTurn = Boolean(myId && state?.turnPlayerId === myId);
  const canSendChat = Boolean(controllablePlayerId) && !archived && !state?.winnerId;

  const onCellClick = async (target: Position) => {
    if (!state) return;

    const clickedUnit = getAliveUnits(state).find(
      (unit) => unit.x === target.x && unit.y === target.y,
    );
    const targetKey = `${target.x}-${target.y}`;

    if (!controllablePlayerId || disabled) {
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

    const mine = clickedUnit?.ownerId === controllablePlayerId ? clickedUnit : null;
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
          controllablePlayerId,
          previousSelection,
          target,
          gameSetup.rules,
          gameSetup.pieces,
        )
      : applyMoveToState(
          previousState,
          controllablePlayerId,
          previousSelection,
          target,
          gameSetup.rules,
          gameSetup.pieces,
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
              controllablePlayerId,
              previousSelection,
              target,
            )
          : applySessionMove(
              previousState.roomCode,
              controllablePlayerId,
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
    if (!state || !canMarkReady || !controllablePlayerId) return;

    const result = markPlayerSetupReady(state, controllablePlayerId);
    if (!result.nextState) return;

    setSelected(null);

    try {
      await mutateSessionState(result.nextState, () =>
        markSessionSetupReady(state.roomCode, controllablePlayerId),
      );
    } catch {
      // SWR rolls back the optimistic session cache automatically.
    }
  };

  const playAgain = async () => {
    if (!state || !myId || state.phase !== "finished") return;
    const nextState = createRematchState(state, gameSetup);
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
      navigate("/");
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
      completionReason: "surrender" as const,
      finishedAt: new Date().toISOString(),
      phase: "finished" as const,
      surrenderedById: myId,
      turnPlayerId: null,
      winnerId: winnerAfterSurrender?.id ?? null,
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
    if (!state || !controllablePlayerId) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const senderName =
      currentUser?.player_name ??
      getDisplayPlayerById(displayPlayers, controllablePlayerId)?.name ??
      "Commander";

    const messageId = `${controllablePlayerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sentAt = new Date().toISOString();
    const optimisticState = {
      ...state,
      chatMessages: [
        ...state.chatMessages,
        {
          id: messageId,
          playerId: controllablePlayerId,
          senderName,
          sentAt,
          text: trimmedMessage,
          type: "player" as const,
        },
      ],
    };

    try {
      await mutateSessionState(optimisticState, () =>
        sendSessionChatMessage(state.roomCode, controllablePlayerId, trimmedMessage, {
          messageId,
          sentAt,
        }),
      );
    } catch {
      throw new Error("Could not send message.");
    }
  };

  useEffect(() => {
    if (typeof Worker === "undefined") return;

    const worker = new Worker(new URL("../../lib/aiWorker.ts", import.meta.url), {
      type: "module",
    });
    aiWorkerRef.current = worker;

    const handleMessage = (event: MessageEvent<AiWorkerResponse>) => {
      const pendingJob = pendingAiJobRef.current;
      if (!pendingJob || pendingJob.jobId !== event.data.jobId) return;

      pendingAiJobRef.current = null;
      void commitAiMove(event.data).finally(() => {
        if (pendingAiActionKeyRef.current === pendingJob.actionKey) {
          pendingAiActionKeyRef.current = null;
        }
      });
    };

    worker.addEventListener("message", handleMessage);

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
      aiWorkerRef.current = null;
      pendingAiJobRef.current = null;
    };
  }, [commitAiMove]);

  useEffect(() => {
    if (!state || archived || myMembership?.role !== "initiator") return;
    if (
      pendingBoardAction ||
      pendingAiActionKeyRef.current ||
      pendingAiJobRef.current
    ) {
      return;
    }

    const aiReadyPlayer =
      state.phase === "setup"
        ? state.players.find(
            (player) =>
              isAiPlayer(player) && !state.setupReadyPlayerIds.includes(player.id),
          ) ?? null
        : null;

    if (aiReadyPlayer) {
      const actionKey = `ready:${state.roomCode}:${aiReadyPlayer.id}:${state.setupReadyPlayerIds.length}`;
      pendingAiActionKeyRef.current = actionKey;
      const timeout = window.setTimeout(() => {
        const result = markPlayerSetupReady(state, aiReadyPlayer.id);

        if (!result.nextState) {
          pendingAiActionKeyRef.current = null;
          return;
        }

        void mutateSessionState(result.nextState, () =>
          markSessionSetupReady(state.roomCode, aiReadyPlayer.id),
        ).finally(() => {
          if (pendingAiActionKeyRef.current === actionKey) {
            pendingAiActionKeyRef.current = null;
          }
        });
      }, getAiThinkingDelayMs(aiReadyPlayer.aiConfig));

      return () => {
        window.clearTimeout(timeout);
        if (pendingAiActionKeyRef.current === actionKey) {
          pendingAiActionKeyRef.current = null;
        }
      };
    }

    const activeAiPlayer =
      state.phase === "battle"
        ? state.players.find(
            (player) => player.id === state.turnPlayerId && isAiPlayer(player),
          ) ?? null
        : null;

    if (!activeAiPlayer) return;

    const actionKey = `move:${state.roomCode}:${state.moveCount}:${activeAiPlayer.id}`;
    const thinkDelayMs = Math.max(1000, getAiThinkingDelayMs(activeAiPlayer.aiConfig));
    pendingAiActionKeyRef.current = actionKey;
    const timeout = window.setTimeout(() => {
      const worker = aiWorkerRef.current;

      if (worker) {
        const jobId = `${actionKey}:${Date.now()}`;
        pendingAiJobRef.current = {
          actionKey,
          jobId,
        };
        worker.postMessage({
          gameSetup,
          jobId,
          moveCount: state.moveCount,
          playerId: activeAiPlayer.id,
          roomCode: state.roomCode,
          state,
        });
        return;
      }

      const fallbackMove = chooseAiMove(state, activeAiPlayer.id, gameSetup);
      if (!fallbackMove) {
        if (pendingAiActionKeyRef.current === actionKey) {
          pendingAiActionKeyRef.current = null;
        }
        return;
      }

      const result = applyMoveToState(
        state,
        activeAiPlayer.id,
        fallbackMove.from,
        fallbackMove,
        gameSetup.rules,
        gameSetup.pieces,
      );
      if (!result.nextState) {
        if (pendingAiActionKeyRef.current === actionKey) {
          pendingAiActionKeyRef.current = null;
        }
        return;
      }

      void mutateSessionState(result.nextState, () =>
        applySessionMove(
          state.roomCode,
          activeAiPlayer.id,
          fallbackMove.from,
          fallbackMove,
        ),
      ).finally(() => {
        if (pendingAiActionKeyRef.current === actionKey) {
          pendingAiActionKeyRef.current = null;
        }
      });
    }, thinkDelayMs);

    return () => {
      window.clearTimeout(timeout);
      if (
        pendingAiActionKeyRef.current === actionKey &&
        pendingAiJobRef.current?.actionKey !== actionKey
      ) {
        pendingAiActionKeyRef.current = null;
      }
    };
  }, [
    archived,
    gameSetup,
    mutateSessionState,
    myMembership?.role,
    pendingBoardAction,
    state,
  ]);

  return {
    archived,
    canMarkReady,
    canSendChat,
    disabled,
    finishGame,
    isMyTurn,
    leaveCurrentSession,
    legalTargets,
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

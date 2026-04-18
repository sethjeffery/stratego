import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Avatar from "../components/Avatar";
import { pieceIconById } from "../components/board/pieceIcons";
import { ProjectedBoard } from "../components/ProjectedBoard";
import { useBoardInteractionState } from "../hooks/useBoardInteractionState";
import { useTouchSessionMembership } from "../hooks/useGameService";
import { useCurrentUser } from "../hooks/useProfile";
import {
  applyMoveToState,
  applySetupSwapToState,
  createRematchState,
  markPlayerSetupReady,
} from "../lib/engine";
import { gamePieces, gameRules } from "../lib/gameConfig";
import { resolveAvatarUrl } from "../lib/playerProfile";
import {
  applyMove as applySessionMove,
  applySetupSwap as applySessionSetupSwap,
  closeFinishedGame as closeSessionFinishedGame,
  markSetupReady as markSessionSetupReady,
  resetFinishedGame as resetSessionFinishedGame,
  sendChatMessage as sendSessionChatMessage,
  type SessionRow,
  surrenderGame as surrenderSessionGame,
} from "../lib/supabaseGameService";
import type { GameChatMessage, GameState, Position } from "../shared/schema";
import type { PendingBoardAction } from "../types/ui";
import { serializeBoardActionState } from "../types/ui";

const pieceById = new Map(gamePieces.map((piece) => [piece.id, piece]));

const getPlayerColorClass = (playerId: string, playerOneId: string | null) =>
  playerId === playerOneId ? "player-one" : "player-two";

export function GameScreen({ session }: { session: SessionRow }) {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const { trigger: touchSessionMembership } = useTouchSessionMembership();
  const [state, setState] = useState<GameState | null>(session.state);
  const [selected, setSelected] = useState<Position | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [completionActionPending, setCompletionActionPending] = useState(false);
  const [pendingBoardAction, setPendingBoardAction] =
    useState<PendingBoardAction | null>(null);
  const [surrenderConfirmVisible, setSurrenderConfirmVisible] = useState(false);
  const [surrenderActionPending, setSurrenderActionPending] = useState(false);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const chatStackRef = useRef<HTMLDivElement | null>(null);
  const committedOptimisticStateKey = useRef<string | null>(null);

  const myMembership =
    session.memberships?.find(
      (membership) => membership.device_id === currentUser?.device_id,
    ) ?? null;
  const myId = myMembership?.device_id ?? null;
  const archived = Boolean(myMembership?.archived_at);
  const currentMoveCount = state?.moveCount ?? null;

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
    committedOptimisticStateKey.current = null;
    setState(session.state);
  }, [session.session_id, session.state]);

  useEffect(() => {
    if (!session.state) {
      if (!pendingBoardAction) {
        setState(null);
      }
      return;
    }

    if (
      pendingBoardAction &&
      serializeBoardActionState(session.state) ===
        pendingBoardAction.optimisticStateKey
    ) {
      committedOptimisticStateKey.current = pendingBoardAction.optimisticStateKey;
      setPendingBoardAction(null);
    }

    if (!pendingBoardAction) {
      setState(session.state);
    }
  }, [pendingBoardAction, session.state, session.updated_at]);

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
    if (!session.session_id || !myMembership || currentMoveCount === null) return;
    void touchSessionMembership(session.session_id).catch(() => undefined);
  }, [currentMoveCount, myMembership, session.session_id, touchSessionMembership]);

  const leaveCurrentSession = () => {
    navigate("/");
  };

  const canMarkReady =
    Boolean(myId) &&
    state?.phase === "setup" &&
    !pendingBoardAction &&
    !archived &&
    !state?.setupReadyPlayerIds.includes(myId ?? "");
  const otherPlayerName =
    state?.players.find((player) => player.id !== myId)?.name ?? "the opponent";
  const isMyTurn = Boolean(myId && state?.turnPlayerId === myId);
  const selectedUnit = selected
    ? (state?.units.find((unit) => unit.x === selected.x && unit.y === selected.y) ??
      null)
    : null;
  const inspectedUnit = selectedUnit;
  const inspectedPiece = inspectedUnit
    ? (pieceById.get(inspectedUnit.pieceId) ?? null)
    : null;
  const inspectedVisible = inspectedUnit
    ? inspectedUnit.ownerId === myId || inspectedUnit.revealedTo.includes(myId ?? "")
    : false;
  const inspectedPieceTraits =
    inspectedVisible && inspectedPiece
      ? [
          inspectedPiece.canTraverseMany ? "Moves multiple spaces in a line." : null,
          inspectedPiece.canDefuseBomb ? "Defuses bombs when attacking." : null,
          inspectedPiece.immovable ? "Cannot move once deployed." : null,
          inspectedPiece.canKillMarshal ? "Kills the Marshal if attacking." : null,
        ].filter(Boolean)
      : [];
  const mainStatus = archived
    ? "This game is archived"
    : state?.winnerId
      ? `${state.players.find((player) => player.id === state.winnerId)?.name ?? "Commander"} wins`
      : state?.phase === "setup"
        ? canMarkReady
          ? "Organize your army"
          : `Waiting on ${otherPlayerName}...`
        : isMyTurn
          ? "Your turn..."
          : `Waiting on ${otherPlayerName}...`;
  const playerOneId = state?.players[0]?.id ?? null;
  const visibleChatMessages = useMemo(() => state?.chatMessages ?? [], [state?.chatMessages]);
  const canSendChat = Boolean(myId) && !archived && !state?.winnerId;
  const winner =
    state?.players.find((player) => player.id === state.winnerId) ?? null;
  const completionVisible = state?.phase === "finished" && Boolean(winner);
  const isClosed = state?.phase === "closed";
  const surrenderedPlayer =
    state?.players.find((player) => player.id === state.surrenderedById) ?? null;

  const completionStats = useMemo(() => {
    const battleMessages = (state?.chatMessages ?? []).filter(
      (message) => message.type === "battle" && message.battle,
    );

    const killsByPiece = new Map<
      string,
      { pieceId: string; ownerId: string; kills: number; value: number; score: number }
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
        pieceId: killerPieceId,
        ownerId: killerOwnerId,
        kills: 0,
        value: 0,
        score: 0,
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
    const startTime = state?.startedAt ? new Date(state.startedAt) : null;
    const endTime = state?.finishedAt ? new Date(state.finishedAt) : null;
    const matchTimeMs =
      startTime && endTime
        ? Math.max(0, endTime.getTime() - startTime.getTime())
        : null;

    return {
      mvp,
      battleCount: battleMessages.length,
      matchTimeMs,
    };
  }, [state?.chatMessages, state?.finishedAt, state?.startedAt]);

  const formatDuration = (durationMs: number | null) => {
    if (durationMs === null) return "Unknown";
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const completionTitle =
    state?.completionReason === "surrender" && surrenderedPlayer
      ? `${surrenderedPlayer.name} surrendered`
      : `${winner?.name ?? "Commander"} wins!`;

  const completionDescription =
    state?.completionReason === "surrender"
      ? `${surrenderedPlayer?.name ?? "A player"} surrendered.`
      : "Flag secured. Match complete.";

  useEffect(() => {
    setChatDraft("");
  }, [state?.roomCode]);

  useEffect(() => {
    const chatStack = chatStackRef.current;
    if (!chatStack) return;

    chatStack.scrollTop = chatStack.scrollHeight;
  }, [visibleChatMessages]);

  if (!state) {
    return (
      <main className="session-access">
        <section className="session-status-card card">
          <p className="eyebrow">Preparing Match</p>
          <h1>Session {session.session_id}</h1>
          <p>Waiting for both players to be ready.</p>
          <button className="secondary-button" onClick={leaveCurrentSession}>
            Back To Dashboard
          </button>
        </section>
      </main>
    );
  }

  const onCellClick = async (target: Position) => {
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
    committedOptimisticStateKey.current = null;
    setPendingBoardAction({
      optimisticStateKey,
      previousSelection,
      previousState,
    });
    setState(result.nextState);
    setSelected(null);

    try {
      const nextState = isSetupPhase
        ? await applySessionSetupSwap(
            previousState.roomCode,
            myId,
            previousSelection,
            target,
          )
        : await applySessionMove(previousState.roomCode, myId, previousSelection, target);

      setPendingBoardAction(null);
      committedOptimisticStateKey.current = null;
      setState(nextState);
    } catch {
      if (committedOptimisticStateKey.current === optimisticStateKey) {
        committedOptimisticStateKey.current = null;
        return;
      }
      committedOptimisticStateKey.current = null;
      setPendingBoardAction(null);
      setState(previousState);
      setSelected(previousSelection);
    }
  };

  const markReady = async () => {
    if (!canMarkReady || !myId) return;

    const result = markPlayerSetupReady(state, myId);
    if (result.nextState) {
      setState(result.nextState);
      setSelected(null);
    }

    try {
      const nextState = await markSessionSetupReady(state.roomCode, myId);
      setState(nextState);
      setSelected(null);
    } catch {
      setState(state);
    }
  };

  const onPlayAgain = async () => {
    if (!myId || state.phase !== "finished") return;

    const nextState = createRematchState(state, gameRules, gamePieces);
    setState(nextState);
    setSelected(null);

    try {
      const serverState = await resetSessionFinishedGame(state.roomCode, myId);
      setState(serverState);
    } catch {
      setState(state);
    }
  };

  const onFinish = async () => {
    if (!myId || state.phase !== "finished") return;

    const nextState = {
      ...state,
      phase: "closed" as const,
      turnPlayerId: null,
    };
    setState(nextState);
    setSelected(null);

    try {
      const serverState = await closeSessionFinishedGame(state.roomCode, myId);
      setState(serverState);
    } catch {
      setState(state);
    }
  };

  const onSurrender = async () => {
    if (!myId || pendingBoardAction) return;
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
    setState(nextState);
    setSelected(null);

    try {
      const serverState = await surrenderSessionGame(state.roomCode, myId);
      setState(serverState);
    } catch {
      setState(state);
    }
  };

  const sendChatMessage = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !myId) return;

    const sender = state.players.find((player) => player.id === myId);
    if (!sender) return;

    const messageId = `${myId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sentAt = new Date().toISOString();

    setState((current) =>
      current
        ? {
            ...current,
            chatMessages: [
              ...current.chatMessages,
              {
                id: messageId,
                type: "player",
                playerId: myId,
                senderName: sender.name,
                text: trimmedMessage,
                sentAt,
              },
            ],
          }
        : current,
    );

    try {
      await sendSessionChatMessage(state.roomCode, myId, trimmedMessage, {
        messageId,
        sentAt,
      });
    } catch {
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
      throw new Error("Could not send message.");
    }
  };

  const handleChatSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDraft = chatDraft.trim();
    if (!trimmedDraft || !canSendChat) return;

    setChatDraft("");
    chatInputRef.current?.focus();

    void (async () => {
      try {
        await sendChatMessage(trimmedDraft);
        chatInputRef.current?.focus();
      } catch {
        setChatDraft((current) =>
          current.trim().length === 0 ? trimmedDraft : current,
        );
        chatInputRef.current?.focus();
      }
    })();
  };

  const renderBattlePieceBadge = (pieceId: string, ownerId: string) => {
    const piece = pieceById.get(pieceId);
    const pieceIcon = pieceIconById[pieceId];
    const colorClass = getPlayerColorClass(ownerId, playerOneId);

    return (
      <span className={`game-chat-piece-badge ${colorClass}`} aria-hidden="true">
        {pieceIcon ? (
          <img src={pieceIcon} alt="" />
        ) : (
          <span>{piece?.label.slice(0, 2) ?? "?"}</span>
        )}
      </span>
    );
  };

  const renderBattleMessage = (message: GameChatMessage) => {
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

    const articleLabel =
      battle.winner === "both"
        ? `${attackerPiece?.label ?? "Unknown unit"} and ${defenderPiece?.label ?? "Unknown unit"} died`
        : isLossForViewer
          ? `${pieceById.get(firstPieceId)?.label ?? "Unknown unit"} killed by ${pieceById.get(secondPieceId)?.label ?? "Unknown unit"}`
          : `${pieceById.get(firstPieceId)?.label ?? "Unknown unit"} killed ${pieceById.get(secondPieceId)?.label ?? "Unknown unit"}`;

    return (
      <article
        key={message.id}
        className="game-chat-message is-battle"
        aria-label={articleLabel}
      >
        <p className="game-chat-battle">
          {battle.winner === "both" ? (
            <>
              {renderBattlePieceBadge(battle.attackerPieceId, battle.attackerOwnerId)}
              <span>and</span>
              {renderBattlePieceBadge(battle.defenderPieceId, battle.defenderOwnerId)}
              <span>died</span>
            </>
          ) : (
            <>
              {renderBattlePieceBadge(firstPieceId, firstOwnerId)}
              <span>{isLossForViewer ? "killed by" : "killed"}</span>
              {renderBattlePieceBadge(secondPieceId, secondOwnerId)}
            </>
          )}
        </p>
      </article>
    );
  };

  return (
    <main className="arena-shell">
      <section className="arena-main">
        <div className="arena-toolbar">
          <button
            className="icon-button exit-button"
            onClick={leaveCurrentSession}
            aria-label="Leave session"
            title="Leave session"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 6l-6 6 6 6M21 12H9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className={`game-status-lozenge ${isMyTurn ? "is-active" : ""}`}>
            {mainStatus}
          </div>
          <div className="toolbar-actions">
            <button
              className="icon-button surrender-button"
              onClick={() => setSurrenderConfirmVisible(true)}
              aria-label="Surrender"
              title="Surrender"
              disabled={archived || state.phase === "finished" || state.phase === "closed"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M7 4v16M7 5c5.5-2.3 8.4 1.8 12 0v9c-3.6 1.8-6.5-2.3-12 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {archived && (
          <section className="archived-banner card">
            <p>This game is archived and disabled on this device.</p>
            <button className="secondary-button" onClick={leaveCurrentSession}>
              Return to lobby
            </button>
          </section>
        )}

        <section className="board">
          <ProjectedBoard
            state={state}
            rules={gameRules}
            pieces={gamePieces}
            myId={myId}
            pendingBoardAction={pendingBoardAction}
            selected={selected}
            legalTargets={legalTargets}
            selectablePieceKeys={selectablePieceKeys}
            disabled={disabled}
            onCellClick={(target) => void onCellClick(target)}
            interactive
            visibilityMode="player"
          />
        </section>
      </section>

      <aside className="game-sidebar">
        <div className="game-sidebar-main">
          <div className="game-faceoff">
            {state.players.slice(0, 2).map((player, index) => (
              <div key={player.id} className="game-faceoff-slot">
                {index === 1 && <div className="game-versus">vs</div>}
                <div className="game-player">
                  <Avatar
                    avatarUrl={resolveAvatarUrl(player.avatarId)}
                    alt={player.name}
                    title={player.name}
                    pulsing={player.id === state.turnPlayerId}
                    color={index === 0 ? "red" : "blue"}
                    className="game-player-avatar"
                  />
                  <div className="game-player-name">{player.name}</div>
                </div>
              </div>
            ))}
          </div>

          <section className="game-piece-panel">
            {inspectedUnit ? (
              <div className="game-piece-hero">
                <div className="game-piece-icon" aria-hidden="true">
                  {inspectedVisible && inspectedPiece ? (
                    pieceIconById[inspectedPiece.id] ? (
                      <img src={pieceIconById[inspectedPiece.id]} alt="" />
                    ) : (
                      inspectedPiece.label.slice(0, 2)
                    )
                  ) : (
                    "?"
                  )}
                </div>
                <div className="game-piece-copy">
                  <strong>
                    {inspectedVisible && inspectedPiece
                      ? inspectedPiece.label
                      : "Unknown unit"}
                  </strong>
                  {inspectedVisible && inspectedPiece && (
                    <>
                      <p>Rank {inspectedPiece.rank}</p>
                      {inspectedPieceTraits.map((trait) => (
                        <div className="game-piece-trait" key={trait}>
                          {trait}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          {canMarkReady && (
            <button className="game-ready-button" onClick={() => void markReady()}>
              Ready
            </button>
          )}
        </div>

        <section className="game-chat-dock" aria-label="Match chat">
          <div ref={chatStackRef} className="game-chat-stack" aria-live="polite">
            {visibleChatMessages.length === 0 ? (
              <p className="game-chat-placeholder">
                Open channel. Keep it brief and tactical.
              </p>
            ) : (
              visibleChatMessages.map((message) => {
                if (message.type === "battle") {
                  return renderBattleMessage(message);
                }

                const isOwnMessage = message.playerId === myId;

                return (
                  <article
                    key={message.id}
                    className={`game-chat-message ${isOwnMessage ? "is-own" : ""}`}
                  >
                    <span className="game-chat-author">
                      {isOwnMessage ? "You" : message.senderName}
                    </span>
                    <p>{message.text}</p>
                  </article>
                );
              })
            )}
          </div>

          <form className="game-chat-form" onSubmit={handleChatSubmit}>
            <input
              ref={chatInputRef}
              className="game-chat-input"
              type="text"
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder={canSendChat ? "Send a message…" : "Join a seat to chat"}
              autoComplete="off"
              maxLength={180}
              disabled={!myId}
            />
          </form>
        </section>
      </aside>

      {completionVisible && winner && (
        <div className="completion-modal-backdrop" role="presentation">
          <section
            className="completion-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-modal-title"
          >
            <Avatar
              avatarUrl={resolveAvatarUrl(winner.avatarId)}
              alt={winner.name}
              title={winner.name}
              color={winner.id === playerOneId ? "red" : "blue"}
              className="completion-avatar"
            />
            <h2 id="completion-modal-title">{completionTitle}</h2>
            <p>{completionDescription}</p>
            <div className="completion-stats">
              <p>
                <strong>Match Time:</strong>{" "}
                {formatDuration(completionStats.matchTimeMs)}
              </p>
              <p>
                <strong>Battles:</strong> {completionStats.battleCount}
              </p>
              <p className="completion-mvp">
                <strong>Most Valuable Piece:</strong>
                {completionStats.mvp ? (
                  <>
                    {renderBattlePieceBadge(
                      completionStats.mvp.pieceId,
                      completionStats.mvp.ownerId,
                    )}
                    <span>
                      {pieceById.get(completionStats.mvp.pieceId)?.label ??
                        "Unknown unit"}{" "}
                      · {completionStats.mvp.kills} kills
                    </span>
                  </>
                ) : (
                  <span>No qualifying kills</span>
                )}
              </p>
            </div>

            <div className="completion-actions">
              <button
                className="primary-cta"
                onClick={() => {
                  if (completionActionPending) return;
                  setCompletionActionPending(true);
                  void onPlayAgain().finally(() => setCompletionActionPending(false));
                }}
                disabled={completionActionPending || isClosed}
              >
                Play Again
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  if (completionActionPending) return;
                  setCompletionActionPending(true);
                  void onFinish().finally(() => setCompletionActionPending(false));
                }}
                disabled={completionActionPending || isClosed}
              >
                Finish
              </button>
            </div>
          </section>
        </div>
      )}

      {surrenderConfirmVisible && (
        <div className="completion-modal-backdrop" role="presentation">
          <section className="completion-modal" role="dialog" aria-modal="true">
            <h2>Surrender match?</h2>
            <p>This ends the game immediately for both players.</p>
            <div className="completion-actions">
              <button
                className="secondary-button"
                onClick={() => setSurrenderConfirmVisible(false)}
                disabled={surrenderActionPending}
              >
                Cancel
              </button>
              <button
                className="primary-cta"
                onClick={() => {
                  if (surrenderActionPending) return;
                  setSurrenderActionPending(true);
                  void onSurrender()
                    .then(() => setSurrenderConfirmVisible(false))
                    .finally(() => setSurrenderActionPending(false));
                }}
                disabled={surrenderActionPending}
              >
                Surrender
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

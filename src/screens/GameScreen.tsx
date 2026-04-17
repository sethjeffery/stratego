import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectedBoard } from "../components/ProjectedBoard";
import { gamePieces, gameRules } from "../lib/gameConfig";
import { resolveAvatarUrl } from "../lib/playerProfile";
import { GameChatMessage, GameState, Position } from "../shared/schema";

const pieceIconModules = import.meta.glob("../assets/pieces/*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const pieceIconById = Object.fromEntries(
  Object.entries(pieceIconModules).flatMap(([path, url]) => {
    const match = path.match(/stratego-([a-z]+)\.svg$/);
    return match ? [[match[1], url]] : [];
  }),
) as Record<string, string>;
const pieceById = new Map(gamePieces.map((piece) => [piece.id, piece]));
const getPlayerColorClass = (
  playerId: string,
  playerOneId: string | null,
) => (playerId === playerOneId ? "player-one" : "player-two");

type GameScreenProps = {
  canMarkReady: boolean;
  debugBoardEnabled: boolean;
  disabled: boolean;
  legalTargets: Position[];
  markReady: () => Promise<void>;
  myId: string | null;
  pendingBoardAction?: {
    optimisticStateKey: string;
    previousSelection: Position;
    previousState: GameState;
  } | null;
  selectablePieceKeys: Set<string>;
  selected: Position | null;
  state: GameState;
  leaveCurrentSession: () => void;
  onCellClick: (target: Position) => Promise<void>;
  sendChatMessage: (message: string) => Promise<void>;
};

export function GameScreen({
  canMarkReady,
  debugBoardEnabled,
  disabled,
  leaveCurrentSession,
  legalTargets,
  markReady,
  myId,
  onCellClick,
  pendingBoardAction = null,
  selectablePieceKeys,
  selected,
  sendChatMessage,
  state,
}: GameScreenProps) {
  const [chatDraft, setChatDraft] = useState("");
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const chatStackRef = useRef<HTMLDivElement | null>(null);
  const otherPlayerName =
    state.players.find((player) => player.id !== myId)?.name ?? "the opponent";
  const isMyTurn = Boolean(myId && state.turnPlayerId === myId);
  const selectedUnit = selected
    ? (state.units.find(
        (unit) => unit.x === selected.x && unit.y === selected.y,
      ) ?? null)
    : null;
  const inspectedUnit = selectedUnit;
  const inspectedPiece = inspectedUnit
    ? (pieceById.get(inspectedUnit.pieceId) ?? null)
    : null;
  const inspectedVisible =
    Boolean(inspectedUnit) &&
    (debugBoardEnabled ||
      inspectedUnit?.ownerId === myId ||
      inspectedUnit?.revealedTo.includes(myId ?? ""));
  const inspectedPieceTraits =
    inspectedVisible && inspectedPiece
      ? [
          inspectedPiece.canTraverseMany
            ? "Can move multiple open squares in a straight line."
            : null,
          inspectedPiece.canDefuseBomb ? "Defuses bombs when attacking." : null,
          inspectedPiece.immovable ? "Cannot move once deployed." : null,
        ].filter(Boolean)
      : [];
  const mainStatus = state.winnerId
    ? `${state.players.find((player) => player.id === state.winnerId)?.name ?? "Commander"} wins`
    : state.phase === "setup"
      ? canMarkReady
        ? "Organize your army"
        : `Waiting on ${otherPlayerName}...`
      : isMyTurn
        ? "Your turn..."
        : `Waiting on ${otherPlayerName}...`;
  const playerOneId = state.players[0]?.id ?? null;
  const visibleChatMessages = useMemo(() => state.chatMessages, [state]);
  const canSendChat = Boolean(myId);

  useEffect(() => {
    setChatDraft("");
  }, [state.roomCode]);

  useEffect(() => {
    const chatStack = chatStackRef.current;
    if (!chatStack) return;

    chatStack.scrollTop = chatStack.scrollHeight;
  }, [visibleChatMessages]);

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
      <span
        className={`game-chat-piece-badge ${colorClass}`}
        aria-hidden="true"
      >
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
              {renderBattlePieceBadge(
                battle.attackerPieceId,
                battle.attackerOwnerId,
              )}
              <span>and</span>
              {renderBattlePieceBadge(
                battle.defenderPieceId,
                battle.defenderOwnerId,
              )}
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
          <span className="toolbar-spacer" aria-hidden="true" />
        </div>

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
                  <div className="game-player-avatar-frame">
                    <img
                      className="game-player-avatar"
                      src={resolveAvatarUrl(player.avatarId)}
                      alt={player.name}
                    />
                    <span
                      className={`player-presence ${player.connected ? "is-online" : "is-away"} ${player.id === state.turnPlayerId ? "is-pulsing" : ""}`}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="game-player-name">{player.name}</div>
                </div>
              </div>
            ))}
          </div>

          <section className="game-piece-panel">
            {inspectedUnit ? (
              <>
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
                      <p>Rank {inspectedPiece.rank}</p>
                    )}
                  </div>
                </div>
                {inspectedVisible && inspectedPieceTraits.length > 0 && (
                  <ul className="game-piece-traits">
                    {inspectedPieceTraits.map((trait) => (
                      <li key={trait}>{trait}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </section>

          {canMarkReady && !debugBoardEnabled && (
            <button
              className="game-ready-button"
              onClick={() => void markReady()}
            >
              Ready
            </button>
          )}
        </div>

        <section className="game-chat-dock" aria-label="Match chat">
          <div
            ref={chatStackRef}
            className="game-chat-stack"
            aria-live="polite"
          >
            {visibleChatMessages.length === 0 ? (
              <p className="game-chat-placeholder">
                Open channel. Keep it brief and tactical.
              </p>
            ) : (
              visibleChatMessages.map((message, index) => {
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
              placeholder={
                canSendChat ? "Send a message…" : "Join a seat to chat"
              }
              autoComplete="off"
              maxLength={180}
              disabled={!myId}
            />
          </form>
        </section>
      </aside>
    </main>
  );
}

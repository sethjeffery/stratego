import { ProjectedBoard } from "../components/ProjectedBoard";
import { gamePieces, gameRules } from "../lib/gameConfig";
import { resolveAvatarUrl } from "../lib/playerProfile";
import { GameState, Position } from "../shared/schema";

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

type GameScreenProps = {
  canMarkReady: boolean;
  debugBoardEnabled: boolean;
  disabled: boolean;
  legalTargets: Position[];
  markReady: () => Promise<void>;
  myId: string | null;
  selectablePieceKeys: Set<string>;
  selected: Position | null;
  state: GameState;
  leaveCurrentSession: () => void;
  onCellClick: (target: Position) => Promise<void>;
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
  selectablePieceKeys,
  selected,
  state,
}: GameScreenProps) {
  const otherPlayerName =
    state.players.find((player) => player.id !== myId)?.name ?? "the opponent";
  const isMyTurn = Boolean(myId && state.turnPlayerId === myId);
  const selectedUnit =
    selected
      ? state.units.find((unit) => unit.x === selected.x && unit.y === selected.y) ??
        null
      : null;
  const inspectedUnit = selectedUnit;
  const inspectedPiece = inspectedUnit
    ? pieceById.get(inspectedUnit.pieceId) ?? null
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
          inspectedPiece.canDefuseBomb
            ? "Defuses bombs when attacking."
            : null,
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
          ) : (
            <p className="game-piece-placeholder">Select a piece to inspect it.</p>
          )}
        </section>

        {canMarkReady && !debugBoardEnabled && (
          <button className="game-ready-button" onClick={() => void markReady()}>
            Ready
          </button>
        )}
      </aside>
    </main>
  );
}

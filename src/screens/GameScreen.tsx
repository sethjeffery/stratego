import { ProjectedBoard } from "../components/ProjectedBoard";
import { gamePieces, gameRules } from "../lib/gameConfig";
import { resolveAvatarUrl } from "../lib/playerProfile";
import { GameState, Position } from "../shared/schema";

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
  statusText: string;
  copySessionLink: (sessionId: string) => Promise<void>;
  leaveCurrentSession: () => void;
  onCellClick: (target: Position) => Promise<void>;
};

export function GameScreen({
  canMarkReady,
  copySessionLink,
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
  statusText,
}: GameScreenProps) {
  const phaseLabel =
    state.phase === "setup"
      ? "Tactical setup"
      : state.phase === "battle"
        ? "Battle"
        : "Complete";
  const turnLabel =
    state.players.find((player) => player.id === state.turnPlayerId)?.name ??
    (state.phase === "setup" ? "Pending setup" : "Complete");

  return (
    <main className="arena-layout">
      <aside className="hud card">
        <h2>Session {state.roomCode}</h2>
        <p>
          Phase: <strong>{phaseLabel}</strong>
        </p>
        <p>
          Turn: <strong>{turnLabel}</strong>
        </p>
        {state.phase === "setup" && (
          <p>
            Ready:{" "}
            {state.players
              .map((player) =>
                state.setupReadyPlayerIds.includes(player.id)
                  ? `${player.name} OK`
                  : `${player.name} ...`,
              )
              .join(" • ")}
          </p>
        )}
        <p>{statusText}</p>
        {state.winnerId && (
          <p className="winner">
            {state.players.find((player) => player.id === state.winnerId)?.name}{" "}
            wins.
          </p>
        )}
        <ul className="hud-player-list">
          {state.players.map((player) => (
            <li key={player.id}>
              <img
                className="player-avatar"
                src={resolveAvatarUrl(player.avatarId)}
                alt={player.name}
              />
              <span>
                {player.name} {player.connected ? "Online" : "Offline"}
              </span>
            </li>
          ))}
        </ul>
        {!debugBoardEnabled && (
          <div className="hud-actions">
            {canMarkReady && <button onClick={() => void markReady()}>Ready</button>}
            <button
              className="secondary-button"
              onClick={() => void copySessionLink(state.roomCode)}
            >
              Copy Session Link
            </button>
            <button className="secondary-button" onClick={leaveCurrentSession}>
              Leave Session
            </button>
          </div>
        )}
      </aside>

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
    </main>
  );
}

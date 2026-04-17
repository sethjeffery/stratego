import { ProjectedBoard } from "../components/ProjectedBoard";
import { gamePieces, gameRules } from "../lib/gameConfig";
import { DEFAULT_AVATAR_ID, resolveAvatarUrl } from "../lib/playerProfile";
import { StoredSessionMembership } from "../lib/localSessionStore";
import { SessionRow } from "../lib/supabaseGameService";
import { PlayerState, GameState } from "../shared/schema";
import Avatar from "../components/Avatar";
import background from "../assets/battle-bg.webp";

const formatSessionTimestamp = (timestamp?: string | number) => {
  if (!timestamp) return "Unknown activity";
  return new Date(timestamp).toLocaleString();
};

const sessionStatusLabel = (row?: SessionRow) => {
  if (!row) return "Saved locally";
  if (!row.state) return "Waiting for challenger";
  if (row.state.winnerId) return "Completed";
  return "In progress";
};

const getSessionPlayers = (
  row?: SessionRow,
  membership?: StoredSessionMembership,
): PlayerState[] => {
  if (row?.state?.players.length) {
    return row.state.players;
  }

  if (row) {
    return [
      {
        id: row.initiator_id,
        name: row.initiator_name,
        avatarId: row.initiator_avatar ?? DEFAULT_AVATAR_ID,
        connected: true,
      },
      ...(row.challenger_id && row.challenger_name
        ? [
            {
              id: row.challenger_id,
              name: row.challenger_name,
              avatarId: row.challenger_avatar ?? DEFAULT_AVATAR_ID,
              connected: true,
            },
          ]
        : []),
    ];
  }

  if (!membership) return [];

  return [
    {
      id: membership.playerId,
      name: membership.playerName,
      avatarId: membership.avatarId,
      connected: true,
    },
  ];
};

type DashboardScreenProps = {
  avatarUrl: string;
  debugBoardEnabled: boolean;
  demoState: GameState;
  playerName: string;
  roomCode: string;
  savedSessionRows: Record<string, SessionRow>;
  trimmedPlayerName: string;
  visibleSavedSessions: StoredSessionMembership[];
  buildSessionUrl: (sessionId: string) => string;
  copySessionLink: (sessionId: string) => Promise<void>;
  createSession: () => Promise<void>;
  joinSession: () => Promise<void>;
  loadExisting: () => Promise<void>;
  onPlayerNameBlur: () => void;
  onPlayerNameChange: (value: string) => void;
  onResumeSavedSession: (membership: StoredSessionMembership) => Promise<void>;
  onRoomCodeChange: (value: string) => void;
  randomizeAvatar: () => void;
  randomizeName: () => void;
};

export function DashboardScreen({
  avatarUrl,
  buildSessionUrl,
  copySessionLink,
  createSession,
  debugBoardEnabled,
  demoState,
  joinSession,
  loadExisting,
  onPlayerNameBlur,
  onPlayerNameChange,
  onResumeSavedSession,
  onRoomCodeChange,
  playerName,
  randomizeAvatar,
  randomizeName,
  roomCode,
  savedSessionRows,
  trimmedPlayerName,
  visibleSavedSessions,
}: DashboardScreenProps) {
  return (
    <>
      <header className="hero hero-grid">
        <section className="hero-copy">
          <p className="eyebrow">Welcome briefing</p>
          <h1>Stratego Online</h1>
          <p className="hero-intro">
            A classic hidden-information battlefield where each move is a risk,
            each reveal matters, and each session is easy to resume from this
            device.
          </p>
          <p className="hero-subtitle">
            {debugBoardEnabled
              ? "Local debug board • deterministic preview state"
              : "Customize a local commander identity, host or join quickly, and keep ongoing matches tied to this device."}
          </p>
        </section>

        <aside className="profile-card card">
          <div className="profile-card-header">
            <div>
              <h2>Your Identity</h2>
            </div>
          </div>
          <div className="profile-card-body">
            <Avatar
              className="avatar-button"
              onClick={randomizeAvatar}
              avatarUrl={avatarUrl}
              alt={trimmedPlayerName}
              title="Randomize avatar"
            />
            <div className="profile-fields">
              <label>
                Callsign
                <input
                  value={playerName}
                  onBlur={onPlayerNameBlur}
                  onChange={(event) => onPlayerNameChange(event.target.value)}
                  placeholder="Commander Name"
                />
              </label>
              <div className="inline-actions">
                <button className="secondary-button" onClick={randomizeName}>
                  New Codename
                </button>
              </div>
            </div>
          </div>
        </aside>
      </header>

      <div className="lobby-stack">
        <section className="session-launcher card">
          <div className="launcher-header">
            <div>
              <p className="eyebrow">Deployment</p>
              <h2>Join Or Host</h2>
            </div>
          </div>

          <div className="launcher-row">
            <div className="join-control">
              <input
                placeholder="Paste session code"
                maxLength={8}
                value={roomCode}
                onChange={(event) =>
                  onRoomCodeChange(event.target.value.trim().toUpperCase())
                }
              />
              <button
                className="primary-cta"
                onClick={() => void joinSession()}
              >
                Join
              </button>
            </div>
            <span className="action-divider">or</span>
            <button
              className="primary-cta host-cta"
              onClick={() => void createSession()}
            >
              Host
            </button>
          </div>

          {roomCode && (
            <div className="inline-actions launcher-footnote">
              <small>Current session URL: {buildSessionUrl(roomCode)}</small>
              <button
                className="secondary-button"
                onClick={() => void loadExisting()}
              >
                Load From URL/Code
              </button>
              <button
                className="secondary-button"
                onClick={() => void copySessionLink(roomCode)}
              >
                Copy Session Link
              </button>
            </div>
          )}

          <small>
            Config-loaded ruleset: {gameRules.gameName} ({gameRules.board.width}
            x{gameRules.board.height})
          </small>
        </section>

        {!debugBoardEnabled && visibleSavedSessions.length > 0 && (
          <section className="session-dashboard card">
            <h2>Your Active Sessions</h2>
            <div className="saved-session-list">
              {visibleSavedSessions.map((membership) => {
                const row = savedSessionRows[membership.sessionId];
                const players = getSessionPlayers(row, membership);

                return (
                  <article
                    key={membership.sessionId}
                    className="saved-session-card"
                  >
                    <div className="saved-session-summary">
                      <div className="player-strip">
                        {players.map((player, index) => (
                          <Avatar
                            key={`${membership.sessionId}-${player.id}`}
                            className="player-avatar"
                            avatarUrl={resolveAvatarUrl(player.avatarId)}
                            alt={player.name}
                            title={player.name}
                            color={index === 0 ? "red" : "blue"}
                          />
                        ))}
                      </div>
                      <div>
                        <strong>{membership.sessionId}</strong>
                        <p>
                          {sessionStatusLabel(row)} • {membership.role}
                        </p>
                        <small>
                          <strong>{players[0]?.name}</strong>
                          {players[1] ? (
                            <>
                              {" "}
                              vs <strong>{players[1].name}</strong>
                            </>
                          ) : null}
                          {" • "}
                          Updated{" "}
                          {formatSessionTimestamp(
                            row?.updated_at ?? membership.lastOpenedAt,
                          )}
                        </small>
                      </div>
                    </div>
                    <div className="inline-actions">
                      <button
                        className="secondary-button"
                        onClick={() => void onResumeSavedSession(membership)}
                      >
                        Resume
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          void copySessionLink(membership.sessionId)
                        }
                      >
                        Copy Link
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="welcome-board preview-panel">
          <div className="board demo-board">
            <ProjectedBoard
              state={demoState}
              rules={gameRules}
              pieces={gamePieces}
              myId={null}
              interactive={false}
              visibilityMode="all"
            />
          </div>
        </section>
      </div>
      <img
        src={background}
        alt="Battle background"
        className="background-image"
      />
    </>
  );
}

import { DEFAULT_AVATAR_ID, resolveAvatarUrl } from "../lib/playerProfile";
import { StoredSessionMembership } from "../lib/localSessionStore";
import { SessionRow } from "../lib/supabaseGameService";
import { PlayerState } from "../shared/schema";
import Avatar from "../components/Avatar";
import background from "../assets/battle-bg.webp";

const formatSessionTimestamp = (timestamp?: string | number) => {
  if (!timestamp) return "Unknown activity";
  return new Date(timestamp).toLocaleString();
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

const getCompletionLabel = (
  row: SessionRow,
  membership: StoredSessionMembership,
  players: PlayerState[],
) => {
  const winner = players.find((player) => player.id === row.state?.winnerId);
  if (!winner) return "Completed";

  const surrenderedById = row.state?.surrenderedById;
  if (surrenderedById) {
    if (surrenderedById === membership.playerId) {
      return "You surrendered";
    }
    return `${winner.name} won by surrender`;
  }

  return `${winner.name} won`;
};

type DashboardScreenProps = {
  avatarUrl: string;
  openSessions: SessionRow[];
  playerName: string;
  roomCode: string;
  savedSessionRows: Record<string, SessionRow>;
  trimmedPlayerName: string;
  visibleSavedSessions: StoredSessionMembership[];
  createSession: () => Promise<void>;
  joinSession: () => Promise<void>;
  onArchiveSavedSession: (membership: StoredSessionMembership) => void;
  onJoinOpenSession: (sessionId: string) => Promise<void>;
  onPlayerNameBlur: () => void;
  onPlayerNameChange: (value: string) => void;
  onResumeSavedSession: (membership: StoredSessionMembership) => Promise<void>;
  onRoomCodeChange: (value: string) => void;
  randomizeAvatar: () => void;
  randomizeName: () => void;
};

export function DashboardScreen({
  avatarUrl,
  createSession,
  joinSession,
  onArchiveSavedSession,
  onJoinOpenSession,
  onPlayerNameBlur,
  onPlayerNameChange,
  onResumeSavedSession,
  onRoomCodeChange,
  openSessions,
  playerName,
  randomizeAvatar,
  randomizeName,
  roomCode,
  savedSessionRows,
  trimmedPlayerName,
  visibleSavedSessions,
}: DashboardScreenProps) {
  const latestOpenSessions = openSessions.slice(0, 5);
  const latestSavedSessions = visibleSavedSessions.slice(0, 5);

  return (
    <>
      <header className="lobby-topbar card">
        <div className="identity-hero">
          <Avatar
            className="avatar-button"
            onClick={randomizeAvatar}
            avatarUrl={avatarUrl}
            alt={trimmedPlayerName}
            title="Randomize avatar"
          />
          <div className="identity-copy">
            <p className="eyebrow">Commander profile</p>
            <input
              className="identity-name-input"
              value={playerName}
              onBlur={onPlayerNameBlur}
              onChange={(event) => onPlayerNameChange(event.target.value)}
              placeholder="Commander Name"
              aria-label="Player name"
            />
            <button className="secondary-button" onClick={randomizeName}>
              New Codename
            </button>
          </div>
        </div>
        <div className="lobby-topbar-actions">
          <div className="join-control">
            <input
              placeholder="Session code"
              maxLength={8}
              value={roomCode}
              onChange={(event) =>
                onRoomCodeChange(event.target.value.trim().toUpperCase())
              }
            />
            <button className="secondary-button" onClick={() => void joinSession()}>
              Join
            </button>
          </div>
          <button className="primary-cta host-topbar-cta" onClick={() => void createSession()}>
            Host
          </button>
        </div>
      </header>

      <main className="lobby-columns">
        <section className="session-dashboard card">
          <div className="launcher-header">
            <h2>Looking For Opponent</h2>
          </div>
          <div className="saved-session-list">
            {latestOpenSessions.length === 0 ? (
              <p className="lobby-empty-state">No open games right now.</p>
            ) : (
              latestOpenSessions.map((row) => {
                const players = getSessionPlayers(row);

                return (
                  <article key={row.session_id} className="saved-session-card">
                    <div className="saved-session-summary">
                      <div className="player-strip">
                        {players.map((player, index) => (
                          <Avatar
                            key={`${row.session_id}-${player.id}`}
                            className="player-avatar"
                            avatarUrl={resolveAvatarUrl(player.avatarId)}
                            alt={player.name}
                            title={player.name}
                            color={index === 0 ? "red" : "blue"}
                          />
                        ))}
                      </div>
                      <div>
                        <strong>{row.session_id}</strong>
                        <p>Waiting for challenger</p>
                        <small>
                          Hosted by <strong>{row.initiator_name}</strong> • Updated{" "}
                          {formatSessionTimestamp(row.updated_at)}
                        </small>
                      </div>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => void onJoinOpenSession(row.session_id)}
                    >
                      Join
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="session-dashboard card">
          <div className="launcher-header">
            <h2>Your Recent Games</h2>
          </div>
          <div className="saved-session-list">
            {latestSavedSessions.length === 0 ? (
              <p className="lobby-empty-state">No recent games yet.</p>
            ) : (
              latestSavedSessions.map((membership) => {
                const row = savedSessionRows[membership.sessionId];
                const players = getSessionPlayers(row, membership);
                const isFinished = row?.state?.phase === "finished" || row?.state?.phase === "closed";
                const isWaitingForChallenger = row && !row.state;
                const completionLabel = row
                  ? getCompletionLabel(row, membership, players)
                  : "Saved locally";

                return (
                  <article key={membership.sessionId} className="saved-session-card">
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
                          {isFinished
                            ? completionLabel
                            : isWaitingForChallenger
                              ? "Waiting for challenger"
                              : "In progress"}
                        </p>
                        <small>
                          Updated{" "}
                          {formatSessionTimestamp(row?.updated_at ?? membership.lastOpenedAt)}
                        </small>
                      </div>
                    </div>
                    <div className="inline-actions">
                      {isFinished ? (
                        <span className="status-pill">{completionLabel}</span>
                      ) : (
                        <button
                          className="secondary-button"
                          onClick={() => void onResumeSavedSession(membership)}
                        >
                          Continue
                        </button>
                      )}
                      <button
                        className="secondary-button"
                        onClick={() => onArchiveSavedSession(membership)}
                      >
                        Archive
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>

      <img
        src={background}
        alt="Battle background"
        className="background-image"
      />
    </>
  );
}

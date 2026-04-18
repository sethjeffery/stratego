import Avatar from "../components/Avatar";
import background from "../assets/battle-bg.webp";
import { StoredSessionMembership } from "../lib/localSessionStore";
import { DEFAULT_AVATAR_ID, resolveAvatarUrl } from "../lib/playerProfile";
import { SessionRow } from "../lib/supabaseGameService";
import { PlayerState } from "../shared/schema";
import styles from "./DashboardScreen.module.css";

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
      <header className={`${styles.topbar} card`}>
        <div className={styles.identityHero}>
          <Avatar
            className={styles.avatarButton}
            onClick={randomizeAvatar}
            avatarUrl={avatarUrl}
            alt={trimmedPlayerName}
            title="Randomize avatar"
          />
          <div className={styles.identityCopy}>
            <p className="eyebrow">Commander profile</p>
            <input
              className={styles.nameInput}
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
        <div className={styles.topbarActions}>
          <div className={styles.joinControl}>
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
          <button
            className={`primary-cta ${styles.hostButton}`}
            onClick={() => void createSession()}
          >
            Host
          </button>
        </div>
      </header>

      <main className={styles.columns}>
        <section className={`${styles.panel} card`}>
          <div className="launcher-header">
            <h2>Looking For Opponent</h2>
          </div>
          <div className={styles.list}>
            {latestOpenSessions.length === 0 ? (
              <p className={styles.emptyState}>No open games right now.</p>
            ) : (
              latestOpenSessions.map((row) => {
                const players = getSessionPlayers(row);

                return (
                  <article key={row.session_id} className={styles.sessionCard}>
                    <div className={styles.sessionSummary}>
                      <div className={styles.playerStrip}>
                        {players.map((player, index) => (
                          <Avatar
                            key={`${row.session_id}-${player.id}`}
                            className={styles.playerAvatar}
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

        <section className={`${styles.panel} card`}>
          <div className="launcher-header">
            <h2>Your Recent Games</h2>
          </div>
          <div className={styles.list}>
            {latestSavedSessions.length === 0 ? (
              <p className={styles.emptyState}>No recent games yet.</p>
            ) : (
              latestSavedSessions.map((membership) => {
                const row = savedSessionRows[membership.sessionId];
                const players = getSessionPlayers(row, membership);
                const isFinished =
                  row?.state?.phase === "finished" || row?.state?.phase === "closed";
                const isWaitingForChallenger = row && !row.state;
                const completionLabel = row
                  ? getCompletionLabel(row, membership, players)
                  : "Saved locally";

                return (
                  <article key={membership.sessionId} className={styles.sessionCard}>
                    <div className={styles.sessionSummary}>
                      <div className={styles.playerStrip}>
                        {players.map((player, index) => (
                          <Avatar
                            key={`${membership.sessionId}-${player.id}`}
                            className={styles.playerAvatar}
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
                          {formatSessionTimestamp(
                            row?.updated_at ?? membership.lastOpenedAt,
                          )}
                        </small>
                      </div>
                    </div>
                    <div className={styles.inlineActions}>
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
        className={styles.backgroundImage}
      />
    </>
  );
}

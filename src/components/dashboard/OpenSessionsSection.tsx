import Avatar from "../../components/Avatar";
import { resolveAvatarUrl } from "../../lib/playerProfile";
import { SessionRow } from "../../lib/supabaseGameService";
import styles from "../../screens/DashboardScreen.module.css";
import { formatSessionTimestamp, getSessionPlayers } from "./sessionHelpers";

type OpenSessionsSectionProps = {
  onJoinOpenSession: (sessionId: string) => Promise<void>;
  openSessions: SessionRow[];
};

export function OpenSessionsSection({
  onJoinOpenSession,
  openSessions,
}: OpenSessionsSectionProps) {
  const latestOpenSessions = openSessions.slice(0, 5);

  return (
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
  );
}

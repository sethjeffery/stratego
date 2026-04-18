import Avatar from "../../components/Avatar";
import { StoredSessionMembership } from "../../lib/localSessionStore";
import { resolveAvatarUrl } from "../../lib/playerProfile";
import { SessionRow } from "../../lib/supabaseGameService";
import styles from "../../screens/DashboardScreen.module.css";
import {
  formatSessionTimestamp,
  getCompletionLabel,
  getSessionPlayers,
} from "./sessionHelpers";

type RecentSessionsSectionProps = {
  onArchiveSavedSession: (membership: StoredSessionMembership) => void;
  onResumeSavedSession: (membership: StoredSessionMembership) => Promise<void>;
  savedSessionRows: Record<string, SessionRow>;
  visibleSavedSessions: StoredSessionMembership[];
};

export function RecentSessionsSection({
  onArchiveSavedSession,
  onResumeSavedSession,
  savedSessionRows,
  visibleSavedSessions,
}: RecentSessionsSectionProps) {
  const latestSavedSessions = visibleSavedSessions.slice(0, 5);

  return (
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
  );
}

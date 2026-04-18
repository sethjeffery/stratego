import { useCurrentUser } from "../../hooks/useProfile";
import { resolveAvatarUrl } from "../../lib/playerProfile";
import type { SessionRow } from "../../lib/supabaseGameService";
import Avatar from "../Avatar";
import { getCompletionLabel } from "./sessionHelpers";
import styles from "./SessionsList.module.css";

export default function SessionsList({
  sessions,
  onArchiveSession,
  onJoinSession,
  onResumeSession,
}: {
  sessions: SessionRow[];
  onResumeSession?: (sessionId: string) => void;
  onJoinSession?: (sessionId: string) => void;
  onArchiveSession?: (sessionId: string) => void;
}) {
  const { data: currentUser } = useCurrentUser();
  if (!currentUser || !sessions || sessions.length === 0) {
    return null;
  }

  return (
    <div className={styles.list}>
      {sessions.map((session) => {
        const isFinished =
          session.state?.phase === "finished" || session.state?.phase === "closed";
        const isWaitingForChallenger = !session.state;
        const hasOpenSeat = !session.challenger;
        const isArchived = Boolean(
          session.memberships?.some((membership) => membership.archived_at),
        );
        const completionLabel = getCompletionLabel(session, currentUser);
        const isCurrentHost = session.initiator?.device_id === currentUser.device_id;

        return (
          <article key={session.session_id} className={styles.sessionCard}>
            <div className={styles.sessionSummary}>
              <div className={styles.playerStrip}>
                {session.memberships?.map((membership, index) => (
                  <Avatar
                    key={`${session.session_id}-${membership.device_id}`}
                    className={styles.playerAvatar}
                    avatarUrl={resolveAvatarUrl(membership.player.avatar_id)}
                    alt={membership.player.player_name}
                    title={membership.player.player_name}
                    color={index === 0 ? "red" : "blue"}
                  />
                ))}
              </div>
              <div>
                <strong>{session.session_id}</strong>
                <p>
                  {isArchived
                    ? "Archived"
                    : isFinished
                      ? completionLabel
                      : isWaitingForChallenger
                        ? "Waiting for challenger"
                        : "In progress"}
                </p>
              </div>
            </div>
            <div className={styles.inlineActions}>
              {!isArchived && onResumeSession && (
                <button
                  className="secondary-button"
                  onClick={() => void onResumeSession(session.session_id)}
                >
                  Continue
                </button>
              )}
              {hasOpenSeat && !isCurrentHost && onJoinSession && (
                <button
                  className="secondary-button"
                  onClick={() => void onJoinSession(session.session_id)}
                >
                  Join
                </button>
              )}
              {onArchiveSession && !isArchived && (
                <button
                  className="secondary-button"
                  onClick={() => void onArchiveSession(session.session_id)}
                >
                  Archive
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

import type { SessionSummary } from "../../lib/supabaseGameService";

import { buildGamePath } from "../../app/sessionRouting";
import styles from "./SessionsList.module.css";
import { SessionsListItem } from "./SessionsListItem";

export default function SessionsList({
  onArchiveSession,
  sessions,
}: {
  onArchiveSession?: (sessionId: string) => Promise<void>;
  sessions: SessionSummary[];
}) {
  if (!sessions || sessions.length === 0) {
    return null;
  }

  return (
    <div className={styles.list}>
      {sessions.map((session) => (
        <SessionsListItem
          key={session.session_id}
          onArchive={onArchiveSession && (() => onArchiveSession(session.session_id))}
          openPath={
            !session.challenger ||
            session.state?.phase === "open" ||
            session.state?.phase === "battle" ||
            session.state?.phase === "setup"
              ? buildGamePath(session.session_id)
              : null
          }
          session={session}
        />
      ))}
    </div>
  );
}

import type { GameSession } from "../../lib/supabaseGameService";

import { useCurrentUser } from "../../hooks/useProfile";
import styles from "./SessionsList.module.css";
import { SessionsListItem } from "./SessionsListItem";

export default function SessionsList({
  onArchiveSession,
  onJoinSession,
  onResumeSession,
  sessions,
}: {
  onArchiveSession?: (sessionId: string) => void;
  onJoinSession?: (sessionId: string) => void;
  onResumeSession?: (sessionId: string) => void;
  sessions: GameSession[];
}) {
  const { data: currentUser } = useCurrentUser();
  if (!currentUser || !sessions || sessions.length === 0) {
    return null;
  }

  return (
    <div className={styles.list}>
      {sessions.map((session) => (
        <SessionsListItem
          key={session.session_id}
          onArchive={onArchiveSession && (() => onArchiveSession(session.session_id))}
          onJoin={onJoinSession && (() => onJoinSession(session.session_id))}
          onResume={onResumeSession && (() => onResumeSession(session.session_id))}
          session={session}
        />
      ))}
    </div>
  );
}

import { useNavigate } from "react-router-dom";

import { buildGamePath } from "../app/sessionRouting";
import background from "../assets/battle-bg.webp";
import { DashboardTopbar } from "../components/dashboard/DashboardTopbar";
import SessionsList from "../components/dashboard/SessionsList";
import {
  useArchiveSession,
  useCreateSession,
  useMySessions,
  useOpenSessions,
} from "../hooks/useGameService";
import { useCurrentUser } from "../hooks/useProfile";
import {} from "../lib/playerProfile";
import styles from "./DashboardScreen.module.css";

export function DashboardScreen() {
  const { data: currentUser, updateProfile } = useCurrentUser();
  const { data: mySessions } = useMySessions();
  const { data: openSessions } = useOpenSessions();
  const { trigger: createSession } = useCreateSession();
  const { trigger: archiveSession } = useArchiveSession();
  const navigate = useNavigate();

  const handleResumeSession = async (sessionId: string) => {
    sessionId = sessionId.trim().toUpperCase();
    navigate(buildGamePath(sessionId));
  };

  const handleCreateSession = async () => {
    const newSession = await createSession();
    navigate(buildGamePath(newSession.session_id));
  };

  const handleArchiveSession = async (sessionId: string) => {
    await archiveSession({ sessionId });
  };

  if (!currentUser) {
    return null;
  }

  return (
    <>
      <DashboardTopbar
        avatarId={currentUser.avatar_id}
        createSession={handleCreateSession}
        onPlayerNameChange={(value) => {
          void updateProfile({ ...currentUser, player_name: value });
        }}
        onPlayerAvatarChange={(value) => {
          void updateProfile({ ...currentUser, avatar_id: value });
        }}
        playerName={currentUser.player_name}
      />

      <main className={styles.columns}>
        {openSessions?.length ? (
          <section className={`${styles.panel} card`}>
            <div className="launcher-header">
              <h2>Open Sessions</h2>
            </div>
            <SessionsList sessions={openSessions} />
          </section>
        ) : null}
        {mySessions?.length ? (
          <section className={`${styles.panel} card`}>
            <div className="launcher-header">
              <h2>Your Recent Games</h2>
            </div>
            <SessionsList
              sessions={mySessions}
              onResumeSession={handleResumeSession}
              onArchiveSession={handleArchiveSession}
            />
          </section>
        ) : null}
      </main>

      <img
        src={background}
        alt="Battle background"
        className={styles.backgroundImage}
      />
    </>
  );
}

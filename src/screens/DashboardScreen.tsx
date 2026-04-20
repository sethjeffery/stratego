import { useNavigate } from "react-router-dom";

import { buildGamePath } from "../app/sessionRouting";
import { DashboardTopbar } from "../components/dashboard/DashboardTopbar";
import SessionsList from "../components/dashboard/SessionsList";
import {
  useArchiveSession,
  useCreateSession,
  useMySessions,
  useOpenSessions,
} from "../hooks/useGameService";
import { useCurrentUser } from "../hooks/useProfile";
import styles from "./DashboardScreen.module.css";

export function DashboardScreen() {
  const { data: currentUser, updateProfile } = useCurrentUser();
  const { data: mySessions } = useMySessions();
  const { data: openSessions } = useOpenSessions();
  const { trigger: createSession } = useCreateSession();
  const { trigger: archiveSession } = useArchiveSession();
  const navigate = useNavigate();

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
    <div className={styles.container}>
      <div className={styles.dashboardCard}>
        <h1 className={styles.title} title="Stratego">
          Stratego
        </h1>
        <DashboardTopbar
          avatarId={currentUser.avatar_id}
          createSession={handleCreateSession}
          onPlayerAvatarChange={(value) => {
            void updateProfile({ ...currentUser, avatar_id: value });
          }}
          onPlayerNameChange={(value) => {
            void updateProfile({ ...currentUser, player_name: value });
          }}
          playerName={currentUser.player_name}
        />

        {openSessions?.length ? (
          <section className={`${styles.panel} card`}>
            <div className={styles.sectionHeader}>
              <h2>Open Sessions</h2>
            </div>
            <SessionsList sessions={openSessions} />
          </section>
        ) : null}
        {mySessions?.length ? (
          <section className={`${styles.panel} card`}>
            <div className={styles.sectionHeader}>
              <h2>Your Recent Games</h2>
            </div>
            <SessionsList
              onArchiveSession={handleArchiveSession}
              sessions={mySessions}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

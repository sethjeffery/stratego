import background from "../assets/battle-bg.webp";
import { DashboardTopbar } from "../components/dashboard/DashboardTopbar";
import { OpenSessionsSection } from "../components/dashboard/OpenSessionsSection";
import { RecentSessionsSection } from "../components/dashboard/RecentSessionsSection";
import { StoredSessionMembership } from "../lib/localSessionStore";
import { SessionRow } from "../lib/supabaseGameService";
import styles from "./DashboardScreen.module.css";

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
  return (
    <>
      <DashboardTopbar
        avatarUrl={avatarUrl}
        createSession={createSession}
        joinSession={joinSession}
        onPlayerNameBlur={onPlayerNameBlur}
        onPlayerNameChange={onPlayerNameChange}
        onRoomCodeChange={onRoomCodeChange}
        playerName={playerName}
        randomizeAvatar={randomizeAvatar}
        randomizeName={randomizeName}
        roomCode={roomCode}
        trimmedPlayerName={trimmedPlayerName}
      />

      <main className={styles.columns}>
        <OpenSessionsSection
          openSessions={openSessions}
          onJoinOpenSession={onJoinOpenSession}
        />
        <RecentSessionsSection
          onArchiveSavedSession={onArchiveSavedSession}
          onResumeSavedSession={onResumeSavedSession}
          savedSessionRows={savedSessionRows}
          visibleSavedSessions={visibleSavedSessions}
        />
      </main>

      <img
        src={background}
        alt="Battle background"
        className={styles.backgroundImage}
      />
    </>
  );
}

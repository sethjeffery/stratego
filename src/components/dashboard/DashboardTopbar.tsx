import Avatar from "../../components/Avatar";
import styles from "../../screens/DashboardScreen.module.css";

type DashboardTopbarProps = {
  avatarUrl: string;
  createSession: () => Promise<void>;
  joinSession: () => Promise<void>;
  onPlayerNameBlur: () => void;
  onPlayerNameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  playerName: string;
  randomizeAvatar: () => void;
  randomizeName: () => void;
  roomCode: string;
  trimmedPlayerName: string;
};

export function DashboardTopbar({
  avatarUrl,
  createSession,
  joinSession,
  onPlayerNameBlur,
  onPlayerNameChange,
  onRoomCodeChange,
  playerName,
  randomizeAvatar,
  randomizeName,
  roomCode,
  trimmedPlayerName,
}: DashboardTopbarProps) {
  return (
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
  );
}

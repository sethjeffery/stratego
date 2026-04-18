import { useState } from "react";

import Avatar from "../../components/Avatar";
import {
  generatePlayerName,
  pickRandomAvatarId,
  resolveAvatarUrl,
} from "../../lib/playerProfile";
import styles from "../../screens/DashboardScreen.module.css";

type DashboardTopbarProps = {
  avatarId: string;
  createSession: () => Promise<void>;
  onPlayerAvatarChange: (value: string) => void;
  onPlayerNameChange: (value: string) => void;
  playerName: string;
};

export function DashboardTopbar({
  avatarId,
  createSession,
  onPlayerNameChange,
  onPlayerAvatarChange,
  playerName,
}: DashboardTopbarProps) {
  const [name, setName] = useState(playerName);

  const randomizeName = () => {
    const name = generatePlayerName(playerName);
    setName(name);
    onPlayerNameChange(name);
  };

  const randomizeAvatar = () => {
    onPlayerAvatarChange(pickRandomAvatarId(avatarId));
  };

  return (
    <header className={`${styles.topbar} card`}>
      <div className={styles.identityHero}>
        <Avatar
          className={styles.avatarButton}
          onClick={randomizeAvatar}
          avatarUrl={resolveAvatarUrl(avatarId)}
          alt={playerName}
          title="Randomize avatar"
        />
        <div className={styles.identityCopy}>
          <p className="eyebrow">Commander profile</p>
          <input
            className={styles.nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onPlayerNameChange(name)}
            placeholder="Commander Name"
            aria-label="Player name"
          />
          <button className="secondary-button" onClick={randomizeName}>
            New Codename
          </button>
        </div>
      </div>
      <div className={styles.topbarActions}>
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

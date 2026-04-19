import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useState } from "react";

import Avatar from "../../components/Avatar";
import {
  generatePlayerName,
  pickRandomAvatarId,
  resolveAvatarUrl,
} from "../../lib/playerProfile";
import styles from "../../screens/DashboardScreen.module.css";
import { Button } from "../Button";

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
          <div className={styles.intro}>What do they call you?</div>
          <input
            className={styles.nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onPlayerNameChange(name)}
            placeholder="Commander Name"
            aria-label="Player name"
          />
          <Button variant="secondary" onClick={randomizeName}>
            <ArrowClockwiseIcon size={32} weight="bold" />
          </Button>
        </div>
      </div>
      <div className={styles.topbarActions}>
        <Button variant="primary" onClick={() => void createSession()}>
          Host new game
        </Button>
      </div>
    </header>
  );
}

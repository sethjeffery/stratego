import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { Avatar } from "../../components/ui";
import { Sunburst } from "../../components/ui";
import {
  generatePlayerName,
  pickRandomAvatarId,
  resolveAvatarUrl,
} from "../../lib/playerProfile";
import styles from "../../screens/DashboardScreen.module.css";
import { Button } from "../ui";

type DashboardTopbarProps = {
  avatarId: string;
  onHostGame: () => void;
  onPlayerAvatarChange: (value: string) => void;
  onPlayerNameChange: (value: string) => void;
  playerName: string;
};

export function DashboardTopbar({
  avatarId,
  onHostGame,
  onPlayerAvatarChange,
  onPlayerNameChange,
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
    <div className={styles.topbarContainer}>
      <Sunburst />
      <header className={`${styles.topbar} card`}>
        <div className={styles.identityHero}>
          <Avatar
            alt={playerName}
            avatarUrl={resolveAvatarUrl(avatarId)}
            className={styles.avatarButton}
            onClick={randomizeAvatar}
            shadow
            title="Randomize avatar"
          />
          <div className={styles.identityCopy}>
            <div className={styles.intro}>What do they call you?</div>
            <input
              aria-label="Player name"
              className={styles.nameInput}
              onBlur={() => onPlayerNameChange(name)}
              onChange={(e) => setName(e.target.value)}
              placeholder="Commander Name"
              value={name}
            />
            <Button
              className={styles.randomButton}
              onClick={randomizeName}
              variant="secondary"
            >
              <ArrowClockwiseIcon size={32} weight="bold" />
            </Button>
          </div>
        </div>
        <div className={styles.topbarActions}>
          <Button onClick={onHostGame} variant="primary">
            Host new game
          </Button>
        </div>
      </header>
    </div>
  );
}

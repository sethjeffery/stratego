import { ArrowLeftIcon, FlagIcon } from "@phosphor-icons/react";

import type { MainStatus } from "./gameScreenSelectors";

import { IconButton } from "../../components/IconButton";
import { GameStatus } from "./GameStatus";
import styles from "./GameSurface.module.css";

type GameToolbarProps = {
  canSurrender: boolean;
  mainStatus: MainStatus;
  onLeave: () => void;
  onRequestSurrender: () => void;
  otherPlayerName: string;
};

export function GameToolbar({
  canSurrender,
  mainStatus,
  onLeave,
  onRequestSurrender,
  otherPlayerName,
}: GameToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <IconButton
        aria-label="Leave session"
        className={styles.exitButton}
        onClick={onLeave}
        title="Leave session"
      >
        <ArrowLeftIcon />
      </IconButton>
      <div className={styles.toolbarStatus}>
        <GameStatus otherPlayerName={otherPlayerName} status={mainStatus} />
      </div>
      <div className={styles.toolbarActions}>
        <IconButton
          aria-label="Surrender"
          className={styles.surrenderButton}
          disabled={!canSurrender}
          onClick={onRequestSurrender}
          title="Surrender"
        >
          <FlagIcon />
        </IconButton>
      </div>
    </div>
  );
}

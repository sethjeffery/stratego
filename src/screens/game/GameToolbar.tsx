import { ArrowLeftIcon, FlagIcon } from "@phosphor-icons/react";

import { IconButton } from "../../components/IconButton";
import type { SessionRow } from "../../lib/supabaseGameService";
import type { MainStatus } from "./gameScreenSelectors";
import { GameStatus } from "./GameStatus";
import styles from "./GameSurface.module.css";

type GameToolbarProps = {
  canSurrender: boolean;
  mainStatus: MainStatus;
  session: SessionRow;
  onLeave: () => void;
  onRequestSurrender: () => void;
};

export function GameToolbar({
  canSurrender,
  mainStatus,
  session,
  onLeave,
  onRequestSurrender,
}: GameToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <IconButton
        className={styles.exitButton}
        onClick={onLeave}
        aria-label="Leave session"
        title="Leave session"
      >
        <ArrowLeftIcon />
      </IconButton>
      <GameStatus status={mainStatus} session={session} />
      <div className={styles.toolbarActions}>
        <IconButton
          className={styles.surrenderButton}
          onClick={onRequestSurrender}
          aria-label="Surrender"
          title="Surrender"
          disabled={!canSurrender}
        >
          <FlagIcon />
        </IconButton>
      </div>
    </div>
  );
}

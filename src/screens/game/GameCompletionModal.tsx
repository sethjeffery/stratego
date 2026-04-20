import { FlagIcon, MedalIcon, SkullIcon } from "@phosphor-icons/react";
import { useState } from "react";

import type { GameDisplayPlayer } from "../../lib/gamePlayers";
import type { CompletionOutcomeIcon, GameCompletionStats } from "./gameScreenSelectors";

import victoryBlue from "../../assets/victory-blue.png";
import victoryRed from "../../assets/victory-red.png";
import { Button } from "../../components/Button";
import { GameBattlePieceBadge } from "./GameBattlePieceBadge";
import styles from "./GameCompletionModal.module.css";
import { pieceById } from "./gameScreenSelectors";
import { Modal } from "./Modal";

type GameCompletionModalProps = {
  completionDescription: string;
  completionIcon: CompletionOutcomeIcon;
  completionStats: GameCompletionStats;
  completionTitle: string;
  isClosed: boolean;
  onFinish: () => Promise<void>;
  onPlayAgain: () => Promise<void>;
  playerOneId: null | string;
  winner: GameDisplayPlayer | null;
  winnerColor: "blue" | "red";
};

const renderCompletionIcon = (icon: CompletionOutcomeIcon) => {
  switch (icon) {
    case "flag":
      return <FlagIcon size={22} weight="fill" />;
    case "medal":
      return <MedalIcon size={22} weight="fill" />;
    case "skull":
      return <SkullIcon size={22} weight="fill" />;
  }
};

export function GameCompletionModal({
  completionDescription,
  completionIcon,
  completionStats,
  completionTitle,
  isClosed,
  onFinish,
  onPlayAgain,
  playerOneId,
  winner,
  winnerColor,
}: GameCompletionModalProps) {
  const [actionPending, setActionPending] = useState(false);

  if (!winner) return null;

  return (
    <Modal
      actions={
        <>
          <Button
            disabled={actionPending || isClosed}
            onClick={() => {
              if (actionPending) return;
              setActionPending(true);
              void onPlayAgain().finally(() => setActionPending(false));
            }}
            variant="primary"
          >
            Play Again
          </Button>
          <Button
            disabled={actionPending || isClosed}
            onClick={() => {
              if (actionPending) return;
              setActionPending(true);
              void onFinish().finally(() => setActionPending(false));
            }}
            variant="secondary"
          >
            Finish
          </Button>
        </>
      }
      description={completionDescription}
      sunburst
      title={
        <span className={styles.completionTitle}>
          <span className={styles.completionTitleIcon}>
            {renderCompletionIcon(completionIcon)}
          </span>
          <span>{completionTitle}</span>
        </span>
      }
      titleText={completionTitle}
    >
      <img
        alt="Victory soldier"
        className={styles.victoryImage}
        src={winnerColor === "red" ? victoryRed : victoryBlue}
      />
      <div className={styles.completionStats}>
        <div className={styles.completionMvp}>
          {completionStats.mvp ? (
            <>
              <GameBattlePieceBadge
                ownerId={completionStats.mvp.ownerId}
                pieceId={completionStats.mvp.pieceId}
                playerOneId={playerOneId}
              />
              <strong>Most Valuable Piece</strong>
              <span>
                {pieceById.get(completionStats.mvp.pieceId)?.label ?? "Unknown unit"} ·{" "}
                {completionStats.mvp.kills} kills
              </span>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

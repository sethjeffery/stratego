import { useState } from "react";

import type { GameCompletionStats } from "./gameScreenSelectors";

import deadImage from "../../assets/dead.png";
import victoryBlue from "../../assets/victory-blue.png";
import victoryRed from "../../assets/victory-red.png";
import { Button } from "../../components/Button";
import { GameBattlePieceBadge } from "./GameBattlePieceBadge";
import styles from "./GameCompletionModal.module.css";
import { pieceById } from "./gameScreenSelectors";
import { Modal } from "./Modal";

type GameCompletionModalProps = {
  completionDescription: string;
  completionStats: GameCompletionStats;
  completionTitle: string;
  isClosed: boolean;
  isDraw: boolean;
  onFinish: () => Promise<void>;
  onPlayAgain: () => Promise<void>;
  playerOneId: null | string;
  winnerColor?: "blue" | "red";
};

export function GameCompletionModal({
  completionDescription,
  completionStats,
  completionTitle,
  isClosed,
  isDraw,
  onFinish,
  onPlayAgain,
  playerOneId,
  winnerColor,
}: GameCompletionModalProps) {
  const [actionPending, setActionPending] = useState(false);
  const illustration = isDraw
    ? deadImage
    : winnerColor === "red"
      ? victoryRed
      : victoryBlue;
  const illustrationAlt = isDraw ? "Dead soldier" : "Victory soldier";

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
      title={<span className={styles.completionTitle}>{completionTitle}</span>}
      titleText={completionTitle}
    >
      <img alt={illustrationAlt} className={styles.victoryImage} src={illustration} />
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

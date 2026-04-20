import { useState } from "react";

import type { GameDisplayPlayer } from "../../lib/gamePlayers";
import type { GameCompletionStats } from "./gameScreenSelectors";

import Avatar from "../../components/Avatar";
import { Button } from "../../components/Button";
import { resolveAvatarUrl } from "../../lib/playerProfile";
import { GameBattlePieceBadge } from "./GameBattlePieceBadge";
import { formatDuration, pieceById } from "./gameScreenSelectors";
import styles from "./GameSurface.module.css";

type GameCompletionModalProps = {
  completionDescription: string;
  completionStats: GameCompletionStats;
  completionTitle: string;
  isClosed: boolean;
  onFinish: () => Promise<void>;
  onPlayAgain: () => Promise<void>;
  playerOneId: null | string;
  winner: GameDisplayPlayer | null;
};

export function GameCompletionModal({
  completionDescription,
  completionStats,
  completionTitle,
  isClosed,
  onFinish,
  onPlayAgain,
  playerOneId,
  winner,
}: GameCompletionModalProps) {
  const [actionPending, setActionPending] = useState(false);

  if (!winner) return null;

  return (
    <div className={styles.completionModalBackdrop} role="presentation">
      <section
        aria-labelledby="completion-modal-title"
        aria-modal="true"
        className={styles.completionModal}
        role="dialog"
      >
        <Avatar
          alt={winner.name}
          avatarUrl={resolveAvatarUrl(winner.avatarId)}
          className={styles.completionAvatar}
          color={winner.id === playerOneId ? "red" : "blue"}
          title={winner.name}
        />
        <h2 id="completion-modal-title">{completionTitle}</h2>
        <p>{completionDescription}</p>
        <div className={styles.completionStats}>
          <p>
            <strong>Match Time:</strong> {formatDuration(completionStats.matchTimeMs)}
          </p>
          <p>
            <strong>Battles:</strong> {completionStats.battleCount}
          </p>
          <p className={styles.completionMvp}>
            <strong>Most Valuable Piece:</strong>
            {completionStats.mvp ? (
              <>
                <GameBattlePieceBadge
                  ownerId={completionStats.mvp.ownerId}
                  pieceId={completionStats.mvp.pieceId}
                  playerOneId={playerOneId}
                />
                <span>
                  {pieceById.get(completionStats.mvp.pieceId)?.label ?? "Unknown unit"}{" "}
                  · {completionStats.mvp.kills} kills
                </span>
              </>
            ) : (
              <span>No qualifying kills</span>
            )}
          </p>
        </div>

        <div className={styles.completionActions}>
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
        </div>
      </section>
    </div>
  );
}

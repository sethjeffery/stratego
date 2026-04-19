import { useState } from "react";

import Avatar from "../../components/Avatar";
import { Button } from "../../components/Button";
import { resolveAvatarUrl } from "../../lib/playerProfile";
import type { GameState } from "../../shared/schema";
import { GameBattlePieceBadge } from "./GameBattlePieceBadge";
import type { GameCompletionStats } from "./gameScreenSelectors";
import { formatDuration, pieceById } from "./gameScreenSelectors";
import styles from "./GameSurface.module.css";

type GameCompletionModalProps = {
  completionDescription: string;
  completionStats: GameCompletionStats;
  completionTitle: string;
  isClosed: boolean;
  onFinish: () => Promise<void>;
  onPlayAgain: () => Promise<void>;
  playerOneId: string | null;
  winner: GameState["players"][number] | null;
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
        className={styles.completionModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-modal-title"
      >
        <Avatar
          avatarUrl={resolveAvatarUrl(winner.avatarId)}
          alt={winner.name}
          title={winner.name}
          color={winner.id === playerOneId ? "red" : "blue"}
          className={styles.completionAvatar}
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
                  pieceId={completionStats.mvp.pieceId}
                  ownerId={completionStats.mvp.ownerId}
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
            variant="primary"
            onClick={() => {
              if (actionPending) return;
              setActionPending(true);
              void onPlayAgain().finally(() => setActionPending(false));
            }}
            disabled={actionPending || isClosed}
          >
            Play Again
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (actionPending) return;
              setActionPending(true);
              void onFinish().finally(() => setActionPending(false));
            }}
            disabled={actionPending || isClosed}
          >
            Finish
          </Button>
        </div>
      </section>
    </div>
  );
}

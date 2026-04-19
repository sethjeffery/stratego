import { useState } from "react";

import Avatar from "../../components/Avatar";
import { resolveAvatarUrl } from "../../lib/playerProfile";
import type { GameState } from "../../shared/schema";
import { GameBattlePieceBadge } from "./GameBattlePieceBadge";
import type { GameCompletionStats } from "./gameScreenSelectors";
import { formatDuration, pieceById } from "./gameScreenSelectors";

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
    <div className="completion-modal-backdrop" role="presentation">
      <section
        className="completion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-modal-title"
      >
        <Avatar
          avatarUrl={resolveAvatarUrl(winner.avatarId)}
          alt={winner.name}
          title={winner.name}
          color={winner.id === playerOneId ? "red" : "blue"}
          className="completion-avatar"
        />
        <h2 id="completion-modal-title">{completionTitle}</h2>
        <p>{completionDescription}</p>
        <div className="completion-stats">
          <p>
            <strong>Match Time:</strong> {formatDuration(completionStats.matchTimeMs)}
          </p>
          <p>
            <strong>Battles:</strong> {completionStats.battleCount}
          </p>
          <p className="completion-mvp">
            <strong>Most Valuable Piece:</strong>
            {completionStats.mvp ? (
              <>
                <GameBattlePieceBadge
                  pieceId={completionStats.mvp.pieceId}
                  ownerId={completionStats.mvp.ownerId}
                  playerOneId={playerOneId}
                />
                <span>
                  {pieceById.get(completionStats.mvp.pieceId)?.label ?? "Unknown unit"} ·{" "}
                  {completionStats.mvp.kills} kills
                </span>
              </>
            ) : (
              <span>No qualifying kills</span>
            )}
          </p>
        </div>

        <div className="completion-actions">
          <button
            className="primary-cta"
            onClick={() => {
              if (actionPending) return;
              setActionPending(true);
              void onPlayAgain().finally(() => setActionPending(false));
            }}
            disabled={actionPending || isClosed}
          >
            Play Again
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              if (actionPending) return;
              setActionPending(true);
              void onFinish().finally(() => setActionPending(false));
            }}
            disabled={actionPending || isClosed}
          >
            Finish
          </button>
        </div>
      </section>
    </div>
  );
}

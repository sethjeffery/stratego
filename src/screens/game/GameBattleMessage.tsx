import clsx from "clsx";

import type { GameChatMessage } from "../../shared/schema";
import { GameBattlePieceBadge } from "./GameBattlePieceBadge";
import { getBattleMessageDisplay } from "./gameScreenSelectors";
import styles from "./GameSurface.module.css";

type GameBattleMessageProps = {
  message: GameChatMessage;
  myId: string | null;
  playerOneId: string | null;
};

export function GameBattleMessage({
  message,
  myId,
  playerOneId,
}: GameBattleMessageProps) {
  const display = getBattleMessageDisplay(message, myId);
  if (!display) return null;

  return (
    <article
      key={message.id}
      className={clsx(styles.gameChatMessage, styles.gameChatMessageBattle)}
      aria-label={display.articleLabel}
    >
      <p className={styles.gameChatBattle}>
        {display.battle.winner === "both" ? (
          <>
            <GameBattlePieceBadge
              pieceId={display.battle.attackerPieceId}
              ownerId={display.battle.attackerOwnerId}
              playerOneId={playerOneId}
            />
            <span>and</span>
            <GameBattlePieceBadge
              pieceId={display.battle.defenderPieceId}
              ownerId={display.battle.defenderOwnerId}
              playerOneId={playerOneId}
            />
            <span>died</span>
          </>
        ) : (
          <>
            <GameBattlePieceBadge
              pieceId={display.firstPieceId}
              ownerId={display.firstOwnerId}
              playerOneId={playerOneId}
            />
            <span>{display.isLossForViewer ? "killed by" : "killed"}</span>
            <GameBattlePieceBadge
              pieceId={display.secondPieceId}
              ownerId={display.secondOwnerId}
              playerOneId={playerOneId}
            />
          </>
        )}
      </p>
    </article>
  );
}

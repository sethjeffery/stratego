import clsx from "clsx";

import type { GameChatMessage } from "../../shared/schema";

import { GameBattlePieceBadge } from "./GameBattlePieceBadge";
import { getBattleMessageDisplay } from "./gameScreenSelectors";
import styles from "./GameSurface.module.css";

type GameBattleMessageProps = {
  message: GameChatMessage;
  myId: null | string;
  playerOneId: null | string;
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
      aria-label={display.articleLabel}
      className={clsx(styles.gameChatMessage, styles.gameChatMessageBattle)}
      key={message.id}
    >
      <p className={styles.gameChatBattle}>
        {display.battle.winner === "both" ? (
          <>
            <GameBattlePieceBadge
              ownerId={display.battle.attackerOwnerId}
              pieceId={display.battle.attackerPieceId}
              playerOneId={playerOneId}
            />
            <span>and</span>
            <GameBattlePieceBadge
              ownerId={display.battle.defenderOwnerId}
              pieceId={display.battle.defenderPieceId}
              playerOneId={playerOneId}
            />
            <span>died</span>
          </>
        ) : (
          <>
            <GameBattlePieceBadge
              ownerId={display.firstOwnerId}
              pieceId={display.firstPieceId}
              playerOneId={playerOneId}
            />
            <span>{display.isLossForViewer ? "killed by" : "killed"}</span>
            <GameBattlePieceBadge
              ownerId={display.secondOwnerId}
              pieceId={display.secondPieceId}
              playerOneId={playerOneId}
            />
          </>
        )}
      </p>
    </article>
  );
}

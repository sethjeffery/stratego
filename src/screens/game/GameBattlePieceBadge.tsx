import clsx from "clsx";

import { pieceIconById } from "../../components/board/pieceIcons";
import { getPlayerColorClass, pieceById } from "./gameScreenSelectors";
import styles from "./GameSurface.module.css";

type GameBattlePieceBadgeProps = {
  ownerId: string;
  pieceId: string;
  playerOneId: null | string;
};

export function GameBattlePieceBadge({
  ownerId,
  pieceId,
  playerOneId,
}: GameBattlePieceBadgeProps) {
  const piece = pieceById.get(pieceId);
  const pieceIcon = pieceIconById[pieceId];
  const colorClass = getPlayerColorClass(ownerId, playerOneId);

  return (
    <span
      aria-hidden="true"
      className={clsx(
        styles.gameChatPieceBadge,
        colorClass === "player-one" ? styles.playerOne : styles.playerTwo,
      )}
    >
      {pieceIcon ? (
        <img alt="" src={pieceIcon} />
      ) : (
        <span>{piece?.label.slice(0, 2) ?? "?"}</span>
      )}
    </span>
  );
}

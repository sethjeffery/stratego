import clsx from "clsx";

import { pieceIconById } from "../../components/board/pieceIcons";
import { getPlayerColorClass, pieceById } from "./gameScreenSelectors";
import styles from "./GameSurface.module.css";

type GameBattlePieceBadgeProps = {
  ownerId: string;
  pieceId: string;
  playerOneId: string | null;
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
      className={clsx(
        styles.gameChatPieceBadge,
        colorClass === "player-one" ? styles.playerOne : styles.playerTwo,
      )}
      aria-hidden="true"
    >
      {pieceIcon ? (
        <img src={pieceIcon} alt="" />
      ) : (
        <span>{piece?.label.slice(0, 2) ?? "?"}</span>
      )}
    </span>
  );
}

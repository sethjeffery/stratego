import { pieceIconById } from "../../components/board/pieceIcons";
import { getPlayerColorClass, pieceById } from "./gameScreenSelectors";

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
    <span className={`game-chat-piece-badge ${colorClass}`} aria-hidden="true">
      {pieceIcon ? <img src={pieceIcon} alt="" /> : <span>{piece?.label.slice(0, 2) ?? "?"}</span>}
    </span>
  );
}

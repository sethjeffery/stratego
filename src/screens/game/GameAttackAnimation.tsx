import clsx from "clsx";

import type { BattleChatMessage } from "../../shared/schema";

import { ProjectedBoardPieceVisual } from "../../components/projectedBoard/ProjectedBoardPieceVisual";
import styles from "./GameAttackAnimation.module.css";
import { pieceById } from "./gameScreenSelectors";

type GameAttackAnimationProps = {
  battle: BattleChatMessage;
  playerOneId: null | string;
};

const getPieceColorClass = (ownerId: string, playerOneId: null | string) =>
  ownerId === playerOneId ? styles.playerOne : styles.playerTwo;

export function GameAttackAnimation({ battle, playerOneId }: GameAttackAnimationProps) {
  const attackerPiece = pieceById.get(battle.attackerPieceId);
  const defenderPiece = pieceById.get(battle.defenderPieceId);
  const isBombBattle = pieceById.get(battle.defenderPieceId)?.explodes;

  return (
    <div aria-hidden="true" className={styles.backdrop}>
      <div
        className={clsx(
          styles.stage,
          battle.winner === "attacker" && styles.attackerWins,
          battle.winner === "defender" && styles.defenderWins,
          battle.winner === "both" && styles.draw,
          isBombBattle && styles.bombImpact,
        )}
      >
        {attackerPiece ? (
          <ProjectedBoardPieceVisual
            className={clsx(
              styles.piece,
              styles.attacker,
              getPieceColorClass(battle.attackerOwnerId, playerOneId),
            )}
            piece={attackerPiece}
            pieceColor={
              playerOneId === battle.attackerOwnerId ? "player-one" : "player-two"
            }
            pieceId={battle.attackerPieceId}
            shadow={false}
          />
        ) : null}
        {defenderPiece ? (
          <ProjectedBoardPieceVisual
            className={clsx(
              styles.piece,
              styles.defender,
              getPieceColorClass(battle.defenderOwnerId, playerOneId),
            )}
            piece={defenderPiece}
            pieceColor={
              playerOneId === battle.attackerOwnerId ? "player-two" : "player-one"
            }
            pieceId={battle.defenderPieceId}
            shadow={false}
          />
        ) : null}
      </div>
    </div>
  );
}

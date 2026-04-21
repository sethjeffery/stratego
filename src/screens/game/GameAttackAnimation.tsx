import clsx from "clsx";

import type { BattleChatMessage } from "../../shared/schema";

import { pieceIconById } from "../../components/board/pieceIcons";
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
  const attackerIcon = pieceIconById[battle.attackerPieceId];
  const defenderIcon = pieceIconById[battle.defenderPieceId];
  const isBombBattle = battle.defenderPieceId === "bomb";

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
        <div className={styles.lane}>
          <div
            className={clsx(
              styles.piece,
              styles.attacker,
              getPieceColorClass(battle.attackerOwnerId, playerOneId),
            )}
          >
            {attackerIcon ? <img alt="" src={attackerIcon} /> : <span>⚔️</span>}
            <strong>{attackerPiece?.label ?? "Unknown"}</strong>
          </div>
          <div
            className={clsx(
              styles.piece,
              styles.defender,
              getPieceColorClass(battle.defenderOwnerId, playerOneId),
            )}
          >
            {defenderIcon ? <img alt="" src={defenderIcon} /> : <span>🛡️</span>}
            <strong>{defenderPiece?.label ?? "Unknown"}</strong>
          </div>
          <span className={styles.impact}>
            <span className={styles.ring} />
            <span className={styles.ring} />
            <span className={styles.flash} />
          </span>
        </div>
      </div>
    </div>
  );
}

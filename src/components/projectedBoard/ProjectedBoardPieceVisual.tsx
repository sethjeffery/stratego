import clsx from "clsx";
import { type CSSProperties } from "react";

import type { PieceDefinition } from "../../shared/schema";
import type { PieceColor } from "./types";

import Piece from "../../assets/pieces/piece.svg?react";
import { pieceIconById } from "../board/pieceIcons";
import styles from "./ProjectedBoard.module.css";
import { impactParticles } from "./projectedBoardConstants";
import { shouldShowRank } from "./projectedBoardHelpers";

type ProjectedBoardPieceVisualProps = {
  className?: string;
  isWinningBattlePiece?: boolean;
  piece: PieceDefinition;
  pieceColor: PieceColor;
  pieceId: string;
  pieceKey?: string;
  shadow?: boolean;
  visible?: boolean;
};

export function ProjectedBoardPieceVisual({
  className,
  isWinningBattlePiece = false,
  piece,
  pieceColor,
  pieceId,
  pieceKey = pieceId,
  shadow = true,
  visible = true,
}: ProjectedBoardPieceVisualProps) {
  const pieceIcon = pieceIconById[pieceId];
  const pieceImpactColorClass =
    pieceColor === "player-one" ? styles.impactPlayerOne : styles.impactPlayerTwo;

  return (
    <span
      className={clsx(
        styles.piece,
        className,
        isWinningBattlePiece && styles.impact,
        shadow && styles.shadow,
      )}
    >
      <Piece
        className={clsx(
          styles.pieceShell,
          pieceColor === "player-one" ? styles.playerOne : styles.playerTwo,
        )}
        data-bomb={visible ? piece.explodes : null}
        data-goal={visible ? piece.goal : null}
        data-rank={piece.rank}
      />
      <span className={styles.pieceFace}>
        {visible && pieceIcon ? (
          <>
            {piece.rank !== undefined && shouldShowRank(pieceId) && (
              <span aria-hidden="true" className={styles.pieceRank}>
                {piece.rank}
              </span>
            )}
            {pieceIcon ? (
              <img
                alt={piece?.label ?? pieceId}
                className={styles.pieceIcon}
                src={pieceIcon}
              />
            ) : (
              piece?.label.slice(0, 2)
            )}
          </>
        ) : (
          <span className={styles.pieceMask}>?</span>
        )}
      </span>
      {isWinningBattlePiece && (
        <span
          aria-hidden="true"
          className={clsx(styles.pieceImpactBurst, pieceImpactColorClass)}
        >
          <span className={styles.pieceImpactFlash} />
          {impactParticles.map((particle, index) => (
            <span
              className={styles.pieceImpactParticle}
              key={`${pieceKey}-impact-${index}`}
              style={
                {
                  "--impact-angle": `${particle.angle}deg`,
                  "--impact-delay": `${particle.delay}ms`,
                  "--impact-distance": `${particle.distance}px`,
                  "--impact-size": `${particle.size}px`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}
    </span>
  );
}

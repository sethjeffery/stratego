import type { CSSProperties } from "react";

import clsx from "clsx";

import type { PieceDefinition } from "../../shared/schema";
import type { PieceColor } from "./types";

import bluePieceUrl from "../../assets/pieces/blue-piece.svg";
import redPieceUrl from "../../assets/pieces/red-piece.svg";
import { pieceIconById } from "../board/pieceIcons";
import styles from "./ProjectedBoard.module.css";
import { impactParticles } from "./projectedBoardConstants";
import { shouldShowRank } from "./projectedBoardHelpers";

type ProjectedBoardPieceVisualProps = {
  className?: string;
  decorative?: boolean;
  isWinningBattlePiece?: boolean;
  piece: null | PieceDefinition;
  pieceColor: PieceColor;
  pieceId: string;
  pieceKey?: string;
  shadow?: boolean;
  visible?: boolean;
};

export function ProjectedBoardPieceVisual({
  className,
  decorative = false,
  isWinningBattlePiece = false,
  piece,
  pieceColor,
  pieceId,
  pieceKey = pieceId,
  shadow = true,
  visible = true,
}: ProjectedBoardPieceVisualProps) {
  const pieceIcon = pieceIconById[pieceId];
  const pieceShellUrl = pieceColor === "player-one" ? redPieceUrl : bluePieceUrl;
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
      <img
        alt=""
        aria-hidden="true"
        className={styles.pieceShell}
        src={pieceShellUrl}
      />
      <span className={styles.pieceFace}>
        {visible ? (
          <>
            {piece?.rank !== undefined && shouldShowRank(pieceId) && (
              <span aria-hidden="true" className={styles.pieceRank}>
                {piece.rank}
              </span>
            )}
            {pieceIcon ? (
              <img
                alt={decorative ? "" : (piece?.label ?? pieceId)}
                aria-hidden={decorative}
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

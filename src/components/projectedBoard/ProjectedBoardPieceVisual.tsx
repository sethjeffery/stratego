import clsx from "clsx";
import type { CSSProperties } from "react";

import bluePieceUrl from "../../assets/pieces/blue-piece.svg";
import redPieceUrl from "../../assets/pieces/red-piece.svg";
import type { PieceDefinition } from "../../shared/schema";
import { pieceIconById } from "../board/pieceIcons";
import styles from "./ProjectedBoard.module.css";
import { impactParticles } from "./projectedBoardConstants";
import { shouldShowRank } from "./projectedBoardHelpers";
import type { PieceColor } from "./types";

type ProjectedBoardPieceVisualProps = {
  decorative?: boolean;
  isWinningBattlePiece?: boolean;
  piece: PieceDefinition | null;
  pieceColor: PieceColor;
  pieceId: string;
  pieceKey: string;
  visible: boolean;
};

export function ProjectedBoardPieceVisual({
  decorative = false,
  isWinningBattlePiece = false,
  piece,
  pieceColor,
  pieceId,
  pieceKey,
  visible,
}: ProjectedBoardPieceVisualProps) {
  const pieceIcon = pieceIconById[pieceId];
  const pieceShellUrl =
    pieceColor === "player-one" ? redPieceUrl : bluePieceUrl;
  const pieceImpactColorClass =
    pieceColor === "player-one" ? styles.impactPlayerOne : styles.impactPlayerTwo;

  return (
    <span
      className={clsx(styles.piece, isWinningBattlePiece && styles.impact)}
    >
      <img
        className={styles.pieceShell}
        src={pieceShellUrl}
        alt=""
        aria-hidden="true"
      />
      <span className={styles.pieceFace}>
        {visible ? (
          <>
            {piece?.rank !== undefined && shouldShowRank(pieceId) && (
              <span className={styles.pieceRank} aria-hidden="true">
                {piece.rank}
              </span>
            )}
            {pieceIcon ? (
              <img
                className={styles.pieceIcon}
                src={pieceIcon}
                alt={decorative ? "" : piece?.label ?? pieceId}
                aria-hidden={decorative}
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
          className={clsx(styles.pieceImpactBurst, pieceImpactColorClass)}
          aria-hidden="true"
        >
          <span className={styles.pieceImpactFlash} />
          {impactParticles.map((particle, index) => (
            <span
              key={`${pieceKey}-impact-${index}`}
              className={styles.pieceImpactParticle}
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

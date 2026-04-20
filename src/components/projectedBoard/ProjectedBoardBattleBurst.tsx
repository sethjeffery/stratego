import type { CSSProperties } from "react";

import clsx from "clsx";

import type { Position } from "../../shared/schema";

import styles from "./ProjectedBoard.module.css";
import { impactParticles } from "./projectedBoardConstants";
import { getBattleBurstZIndex, getPieceStyle } from "./projectedBoardHelpers";

type ProjectedBoardBattleBurstProps = {
  at: Position;
  boardColumns: number;
  boardRows: number;
  moveCount: number;
  toDisplayPosition: (position: Position) => Position;
};

export function ProjectedBoardBattleBurst({
  at,
  boardColumns,
  boardRows,
  moveCount,
  toDisplayPosition,
}: ProjectedBoardBattleBurstProps) {
  const display = toDisplayPosition(at);

  return (
    <span
      aria-hidden="true"
      className={clsx(styles.pieceHit, styles.battleBurst)}
      key={`battle-burst-${moveCount}`}
      style={getPieceStyle(
        display.x,
        display.y,
        boardColumns,
        boardRows,
        getBattleBurstZIndex(display.y),
      )}
    >
      <span className={clsx(styles.pieceImpactBurst, styles.impactBoth)}>
        <span className={styles.pieceImpactFlash} />
        {impactParticles.map((particle, index) => (
          <span
            className={styles.pieceImpactParticle}
            key={`battle-burst-particle-${moveCount}-${index}`}
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
    </span>
  );
}

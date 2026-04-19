import clsx from "clsx";
import type { CSSProperties } from "react";

import type { Position } from "../../shared/schema";
import styles from "./ProjectedBoard.module.css";
import { impactParticles } from "./projectedBoardConstants";
import { getPieceStyle } from "./projectedBoardHelpers";

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
      key={`battle-burst-${moveCount}`}
      className={clsx(styles.pieceHit, styles.battleBurst)}
      style={getPieceStyle(display.x, display.y, boardColumns, boardRows, 14 + display.y)}
      aria-hidden="true"
    >
      <span className={clsx(styles.pieceImpactBurst, styles.impactBoth)}>
        <span className={styles.pieceImpactFlash} />
        {impactParticles.map((particle, index) => (
          <span
            key={`battle-burst-particle-${moveCount}-${index}`}
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
    </span>
  );
}

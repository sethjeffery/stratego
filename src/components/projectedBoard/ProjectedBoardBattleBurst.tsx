import type { CSSProperties } from "react";

import type { Position } from "../../shared/schema";
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
      className="piece-hit is-battle-burst"
      style={getPieceStyle(display.x, display.y, boardColumns, boardRows, 14 + display.y)}
      aria-hidden="true"
    >
      <span className="piece-impact-burst is-both">
        <span className="piece-impact-flash" />
        {impactParticles.map((particle, index) => (
          <span
            key={`battle-burst-particle-${moveCount}-${index}`}
            className="piece-impact-particle"
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

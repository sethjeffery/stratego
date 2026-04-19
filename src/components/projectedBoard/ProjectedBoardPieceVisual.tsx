import type { CSSProperties } from "react";

import bluePieceUrl from "../../assets/pieces/blue-piece.svg";
import redPieceUrl from "../../assets/pieces/red-piece.svg";
import type { PieceDefinition } from "../../shared/schema";
import { pieceIconById } from "../board/pieceIcons";
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

  return (
    <span
      className={`piece ${pieceColor} ${isWinningBattlePiece ? "impact" : ""}`}
    >
      <img
        className="piece-shell"
        src={pieceShellUrl}
        alt=""
        aria-hidden="true"
      />
      <span className="piece-face">
        {visible ? (
          <>
            {piece?.rank !== undefined && shouldShowRank(pieceId) && (
              <span className="piece-rank" aria-hidden="true">
                {piece.rank}
              </span>
            )}
            {pieceIcon ? (
              <img
                className="piece-icon"
                src={pieceIcon}
                alt={decorative ? "" : piece?.label ?? pieceId}
                aria-hidden={decorative}
              />
            ) : (
              piece?.label.slice(0, 2)
            )}
          </>
        ) : (
          <span className="piece-mask">?</span>
        )}
      </span>
      {isWinningBattlePiece && (
        <span className={`piece-impact-burst ${pieceColor}`} aria-hidden="true">
          <span className="piece-impact-flash" />
          {impactParticles.map((particle, index) => (
            <span
              key={`${pieceKey}-impact-${index}`}
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
      )}
    </span>
  );
}

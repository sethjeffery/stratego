import { pieceIconById } from "../../components/board/pieceIcons";
import type { PieceDefinition, Unit } from "../../shared/schema";

type GamePiecePanelProps = {
  inspectedPiece: PieceDefinition | null;
  inspectedPieceTraits: string[];
  inspectedUnit: Unit | null;
  inspectedVisible: boolean;
};

export function GamePiecePanel({
  inspectedPiece,
  inspectedPieceTraits,
  inspectedUnit,
  inspectedVisible,
}: GamePiecePanelProps) {
  return (
    <section className="game-piece-panel">
      {inspectedUnit ? (
        <div className="game-piece-hero">
          <div className="game-piece-icon" aria-hidden="true">
            {inspectedVisible && inspectedPiece ? (
              pieceIconById[inspectedPiece.id] ? (
                <img src={pieceIconById[inspectedPiece.id]} alt="" />
              ) : (
                inspectedPiece.label.slice(0, 2)
              )
            ) : (
              "?"
            )}
          </div>
          <div className="game-piece-copy">
            <strong>
              {inspectedVisible && inspectedPiece ? inspectedPiece.label : "Unknown unit"}
            </strong>
            {inspectedVisible && inspectedPiece && (
              <>
                <p>Rank {inspectedPiece.rank}</p>
                {inspectedPieceTraits.map((trait) => (
                  <div className="game-piece-trait" key={trait}>
                    {trait}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

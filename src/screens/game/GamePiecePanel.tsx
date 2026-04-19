import { pieceIconById } from "../../components/board/pieceIcons";
import type { PieceDefinition, Unit } from "../../shared/schema";
import styles from "./GameSurface.module.css";

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
    <section className={styles.gamePiecePanel}>
      {inspectedUnit ? (
        <div className={styles.gamePieceHero}>
          <div className={styles.gamePieceIcon} aria-hidden="true">
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
          <div className={styles.gamePieceCopy}>
            <strong>
              {inspectedVisible && inspectedPiece ? inspectedPiece.label : "Unknown unit"}
            </strong>
            {inspectedVisible && inspectedPiece && (
              <>
                <p>Rank {inspectedPiece.rank}</p>
                {inspectedPieceTraits.map((trait) => (
                  <div className={styles.gamePieceTrait} key={trait}>
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

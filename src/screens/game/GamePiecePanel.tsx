import type { PieceDefinition, Unit } from "../../shared/schema";

import { pieceIconById } from "../../components/board/pieceIcons";
import styles from "./GameSurface.module.css";

type GamePiecePanelProps = {
  inspectedPiece: null | PieceDefinition;
  inspectedPieceTraits: string[];
  inspectedUnit: null | Unit;
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
          <div aria-hidden="true" className={styles.gamePieceIcon}>
            {inspectedVisible && inspectedPiece ? (
              pieceIconById[inspectedPiece.id] ? (
                <img alt="" src={pieceIconById[inspectedPiece.id]} />
              ) : (
                inspectedPiece.label.slice(0, 2)
              )
            ) : (
              "?"
            )}
          </div>
          <div className={styles.gamePieceCopy}>
            <strong>
              {inspectedVisible && inspectedPiece
                ? inspectedPiece.label
                : "Unknown unit"}
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

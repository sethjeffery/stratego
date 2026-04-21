import clsx from "clsx";

import type { GameState, PieceDefinition, Position, Unit } from "../../shared/schema";

import { isUnitAlive } from "../../shared/schema";
import styles from "./ProjectedBoard.module.css";
import { ProjectedBoardBattleBurst } from "./ProjectedBoardBattleBurst";
import { colorForOwner, getPieceStyle, getPieceZIndex } from "./projectedBoardHelpers";
import { ProjectedBoardPieceVisual } from "./ProjectedBoardPieceVisual";

type ProjectedBoardPiecesProps = {
  boardColumns: number;
  boardRows: number;
  disabled: boolean;
  interactive: boolean;
  isUnitVisibleToViewer: (unit: Unit) => boolean;
  legalTargetKeys: Set<string>;
  myId: null | string;
  onCellClick?: (target: Position) => Promise<void> | void;
  onPieceHover?: (position: null | Position) => void;
  pieceById: Map<string, PieceDefinition>;
  playerOneId: null | string;
  selectablePieceKeys: Set<string>;
  selected: null | Position;
  state: GameState;
  toDisplayPosition: (position: Position) => Position;
};

export function ProjectedBoardPieces({
  boardColumns,
  boardRows,
  disabled,
  interactive,
  isUnitVisibleToViewer,
  legalTargetKeys,
  myId,
  onCellClick,
  onPieceHover,
  pieceById,
  playerOneId,
  selectablePieceKeys,
  selected,
  state,
  toDisplayPosition,
}: ProjectedBoardPiecesProps) {
  const positionedUnits = state.units.map((unit) => ({
    display: toDisplayPosition(unit),
    isAlive: isUnitAlive(unit),
    unit,
  }));

  return (
    <>
      {positionedUnits.map(({ display, isAlive, unit }) => {
        const isSelected = selected?.x === unit.x && selected?.y === unit.y;
        const isPicked =
          isAlive &&
          isSelected &&
          !disabled &&
          unit.ownerId === myId &&
          selectablePieceKeys.has(`${unit.x}-${unit.y}`);
        const isSelectable =
          isAlive &&
          !disabled &&
          unit.ownerId === myId &&
          (selected
            ? isSelected || legalTargetKeys.has(`${unit.x}-${unit.y}`)
            : selectablePieceKeys.has(`${unit.x}-${unit.y}`));
        const isFriendlyClickable = isAlive && !disabled && unit.ownerId === myId;
        const isAttackTarget =
          isAlive && !disabled && legalTargetKeys.has(`${unit.x}-${unit.y}`);
        const isPieceActionable =
          interactive && (isFriendlyClickable || isAttackTarget);
        const isWinningBattlePiece =
          isAlive &&
          state.lastBattle?.winnerOwnerId === unit.ownerId &&
          state.lastBattle?.at.x === unit.x &&
          state.lastBattle?.at.y === unit.y;
        const piece = pieceById.get(unit.pieceId) ?? null;
        const pieceColor = colorForOwner(unit.ownerId, playerOneId);

        if (!piece) return null;

        return (
          <button
            aria-hidden={!isAlive || undefined}
            aria-label={piece?.label ?? unit.pieceId}
            className={clsx(
              styles.pieceHit,
              !isAlive && styles.captured,
              interactive && styles.canHover,
              isPieceActionable && styles.interactive,
              isSelectable && styles.selectable,
              isSelected && styles.selectedPiece,
              isPicked && styles.picked,
            )}
            disabled={!interactive || !isAlive}
            key={unit.id}
            onBlur={() => isAlive && onPieceHover?.(null)}
            onClick={() =>
              isAlive && interactive && onCellClick?.({ x: unit.x, y: unit.y })
            }
            onFocus={() => isAlive && onPieceHover?.({ x: unit.x, y: unit.y })}
            onMouseEnter={() => isAlive && onPieceHover?.({ x: unit.x, y: unit.y })}
            onMouseLeave={() => isAlive && onPieceHover?.(null)}
            style={getPieceStyle(
              display.x,
              display.y,
              boardColumns,
              boardRows,
              getPieceZIndex(display.y),
            )}
            tabIndex={isAlive ? undefined : -1}
          >
            <ProjectedBoardPieceVisual
              isWinningBattlePiece={isWinningBattlePiece}
              piece={piece}
              pieceColor={pieceColor}
              pieceId={unit.pieceId}
              pieceKey={unit.id}
              visible={isAlive && isUnitVisibleToViewer(unit)}
            />
          </button>
        );
      })}

      {state.lastBattle?.winner === "both" && (
        <ProjectedBoardBattleBurst
          at={state.lastBattle.at}
          boardColumns={boardColumns}
          boardRows={boardRows}
          moveCount={state.moveCount}
          toDisplayPosition={toDisplayPosition}
        />
      )}
    </>
  );
}

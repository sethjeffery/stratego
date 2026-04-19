import type { GameState, PieceDefinition, Position, Unit } from "../../shared/schema";
import { ProjectedBoardBattleBurst } from "./ProjectedBoardBattleBurst";
import { colorForOwner, getPieceStyle } from "./projectedBoardHelpers";
import { ProjectedBoardPieceVisual } from "./ProjectedBoardPieceVisual";
import type { GhostUnitState } from "./types";

type ProjectedBoardPiecesProps = {
  boardColumns: number;
  boardRows: number;
  disabled: boolean;
  ghostResolving: boolean;
  ghostUnit: GhostUnitState | null;
  interactive: boolean;
  isUnitVisibleToViewer: (unit: Unit) => boolean;
  legalTargetKeys: Set<string>;
  myId: string | null;
  onCellClick?: (target: Position) => void | Promise<void>;
  onPieceHover?: (position: Position | null) => void;
  pieceById: Map<string, PieceDefinition>;
  playerOneId: string | null;
  selectablePieceKeys: Set<string>;
  selected: Position | null;
  state: GameState;
  toDisplayPosition: (position: Position) => Position;
};

export function ProjectedBoardPieces({
  boardColumns,
  boardRows,
  disabled,
  ghostResolving,
  ghostUnit,
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
  const positionedUnits = state.units
    .filter((unit) => unit.id !== ghostUnit?.hideLiveUnitId)
    .map((unit) => ({
      display: toDisplayPosition(unit),
      unit,
    }))
    .sort((left, right) => left.display.y - right.display.y);

  return (
    <>
      {positionedUnits.map(({ unit, display }) => {
        const isSelected = selected?.x === unit.x && selected?.y === unit.y;
        const isPicked =
          isSelected &&
          !disabled &&
          unit.ownerId === myId &&
          selectablePieceKeys.has(`${unit.x}-${unit.y}`);
        const isSelectable =
          !disabled &&
          unit.ownerId === myId &&
          (selected
            ? isSelected || legalTargetKeys.has(`${unit.x}-${unit.y}`)
            : selectablePieceKeys.has(`${unit.x}-${unit.y}`));
        const isFriendlyClickable = !disabled && unit.ownerId === myId;
        const isAttackTarget =
          !disabled && legalTargetKeys.has(`${unit.x}-${unit.y}`);
        const isPieceActionable =
          interactive && (isFriendlyClickable || isAttackTarget);
        const isWinningBattlePiece =
          state.lastBattle?.winnerOwnerId === unit.ownerId &&
          state.lastBattle?.at.x === unit.x &&
          state.lastBattle?.at.y === unit.y;
        const piece = pieceById.get(unit.pieceId) ?? null;
        const pieceColor = colorForOwner(unit.ownerId, playerOneId);

        return (
          <button
            key={unit.id}
            className={`piece-hit ${interactive ? "can-hover" : ""} ${isPieceActionable ? "is-interactive" : ""} ${isSelectable ? "is-selectable" : ""} ${isSelected ? "is-selected" : ""} ${isPicked ? "is-picked" : ""}`}
            style={getPieceStyle(
              display.x,
              display.y,
              boardColumns,
              boardRows,
              10 + display.y,
            )}
            onClick={() => interactive && onCellClick?.({ x: unit.x, y: unit.y })}
            onMouseEnter={() => onPieceHover?.({ x: unit.x, y: unit.y })}
            onMouseLeave={() => onPieceHover?.(null)}
            onFocus={() => onPieceHover?.({ x: unit.x, y: unit.y })}
            onBlur={() => onPieceHover?.(null)}
            disabled={!interactive}
            aria-label={piece?.label ?? unit.pieceId}
          >
            <ProjectedBoardPieceVisual
              isWinningBattlePiece={isWinningBattlePiece}
              piece={piece}
              pieceColor={pieceColor}
              pieceId={unit.pieceId}
              pieceKey={unit.id}
              visible={isUnitVisibleToViewer(unit)}
            />
          </button>
        );
      })}

      {ghostUnit && (
        <span
          key={ghostUnit.key}
          className={`piece-hit is-ghost ${ghostResolving ? "is-resolving" : ""}`}
          style={getPieceStyle(
            (ghostResolving ? ghostUnit.endDisplay : ghostUnit.startDisplay).x,
            (ghostResolving ? ghostUnit.endDisplay : ghostUnit.startDisplay).y,
            boardColumns,
            boardRows,
            10 + ghostUnit.endDisplay.y,
          )}
          aria-hidden="true"
        >
          <ProjectedBoardPieceVisual
            decorative
            piece={pieceById.get(ghostUnit.unit.pieceId) ?? null}
            pieceColor={colorForOwner(ghostUnit.unit.ownerId, playerOneId)}
            pieceId={ghostUnit.unit.pieceId}
            pieceKey={ghostUnit.key}
            visible={isUnitVisibleToViewer(ghostUnit.unit)}
          />
        </span>
      )}

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

import type { Position } from "../../shared/schema";
import { getCellStyle } from "./projectedBoardHelpers";
import type { BoardCell } from "./types";

type ProjectedBoardCellsProps = {
  boardColumns: number;
  boardRows: number;
  cells: BoardCell[];
  interactive: boolean;
  legalTargetKeys: Set<string>;
  onCellClick?: (target: Position) => void | Promise<void>;
  selected: Position | null;
  toDisplayPosition: (position: Position) => Position;
};

export function ProjectedBoardCells({
  boardColumns,
  boardRows,
  cells,
  interactive,
  legalTargetKeys,
  onCellClick,
  selected,
  toDisplayPosition,
}: ProjectedBoardCellsProps) {
  return (
    <>
      {cells.map((cell) => {
        const isSelected = selected?.x === cell.x && selected?.y === cell.y;
        const isLegalTarget = legalTargetKeys.has(cell.key);
        const display = toDisplayPosition(cell);

        return (
          <button
            key={cell.key}
            className={`board-cell-hit ${isLegalTarget ? "is-target" : ""} ${isSelected ? "is-selected" : ""}`}
            style={getCellStyle(display.x, display.y, boardColumns, boardRows)}
            onClick={() => interactive && onCellClick?.({ x: cell.x, y: cell.y })}
            disabled={!interactive}
            data-x={cell.x}
            data-y={cell.y}
            aria-label={`Board cell ${cell.x + 1}, ${cell.y + 1}`}
          >
            <span className="board-cell-highlight" />
          </button>
        );
      })}
    </>
  );
}

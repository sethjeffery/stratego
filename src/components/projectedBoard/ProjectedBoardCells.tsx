import clsx from "clsx";

import type { Position } from "../../shared/schema";
import type { BoardCell } from "./types";

import styles from "./ProjectedBoard.module.css";
import { getCellStyle } from "./projectedBoardHelpers";

type ProjectedBoardCellsProps = {
  boardColumns: number;
  boardRows: number;
  cells: BoardCell[];
  interactive: boolean;
  legalTargetKeys: Set<string>;
  onCellClick?: (target: Position) => Promise<void> | void;
  selected: null | Position;
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
            aria-label={`Board cell ${cell.x + 1}, ${cell.y + 1}`}
            className={clsx(
              styles.boardCellHit,
              isLegalTarget && styles.target,
              isSelected && styles.selected,
            )}
            data-x={display.x}
            data-y={display.y}
            disabled={!interactive}
            key={cell.key}
            onClick={() => interactive && onCellClick?.({ x: cell.x, y: cell.y })}
            style={getCellStyle(display.x, display.y, boardColumns, boardRows)}
          >
            <span className={styles.boardCellHighlight} />
          </button>
        );
      })}
    </>
  );
}

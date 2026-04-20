import clsx from "clsx";

import type { ProjectedBoardProps } from "./projectedBoard/types";

import boardMapUrl from "../assets/map.png";
import styles from "./projectedBoard/ProjectedBoard.module.css";
import { ProjectedBoardCells } from "./projectedBoard/ProjectedBoardCells";
import { ProjectedBoardPieces } from "./projectedBoard/ProjectedBoardPieces";
import { useProjectedBoardGhosts } from "./projectedBoard/useProjectedBoardGhosts";
import { useProjectedBoardViewModel } from "./projectedBoard/useProjectedBoardViewModel";

export function ProjectedBoard({
  disabled = false,
  interactive = true,
  legalTargets = [],
  myId,
  onCellClick,
  onPieceHover,
  pendingBoardAction = null,
  pieces,
  rules,
  selectablePieceKeys = new Set<string>(),
  selected = null,
  state,
  visibilityMode = "player",
}: ProjectedBoardProps) {
  const {
    boardColumns,
    boardRows,
    cells,
    isPerspectiveFlipped,
    isUnitVisibleToViewer,
    legalTargetKeys,
    pieceById,
    playerOneId,
    toDisplayPosition,
  } = useProjectedBoardViewModel({
    legalTargets,
    myId,
    pieces,
    rules,
    state,
    visibilityMode,
  });
  const { ghostResolving, ghostUnit } = useProjectedBoardGhosts({
    isUnitVisibleToViewer,
    pendingBoardAction,
    state,
    toDisplayPosition,
  });

  return (
    <div className={styles.boardStage}>
      <div className={styles.boardPlane}>
        <img
          alt=""
          className={clsx(
            styles.boardMap,
            isPerspectiveFlipped && styles.boardMapRotated,
          )}
          src={boardMapUrl}
        />
        <div className={styles.boardOverlay}>
          <ProjectedBoardCells
            boardColumns={boardColumns}
            boardRows={boardRows}
            cells={cells}
            interactive={interactive}
            legalTargetKeys={legalTargetKeys}
            onCellClick={onCellClick}
            selected={selected}
            toDisplayPosition={toDisplayPosition}
          />
          <ProjectedBoardPieces
            boardColumns={boardColumns}
            boardRows={boardRows}
            disabled={disabled}
            ghostResolving={ghostResolving}
            ghostUnit={ghostUnit}
            interactive={interactive}
            isUnitVisibleToViewer={isUnitVisibleToViewer}
            legalTargetKeys={legalTargetKeys}
            myId={myId}
            onCellClick={onCellClick}
            onPieceHover={onPieceHover}
            pieceById={pieceById}
            playerOneId={playerOneId}
            selectablePieceKeys={selectablePieceKeys}
            selected={selected}
            state={state}
            toDisplayPosition={toDisplayPosition}
          />
        </div>
      </div>
    </div>
  );
}

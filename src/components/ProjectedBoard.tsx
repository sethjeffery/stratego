import boardMapUrl from "../assets/map.png";
import { ProjectedBoardCells } from "./projectedBoard/ProjectedBoardCells";
import { ProjectedBoardPieces } from "./projectedBoard/ProjectedBoardPieces";
import type { ProjectedBoardProps } from "./projectedBoard/types";
import { useProjectedBoardGhosts } from "./projectedBoard/useProjectedBoardGhosts";
import { useProjectedBoardViewModel } from "./projectedBoard/useProjectedBoardViewModel";

export function ProjectedBoard({
  state,
  rules,
  pieces,
  myId,
  pendingBoardAction = null,
  selected = null,
  legalTargets = [],
  selectablePieceKeys = new Set<string>(),
  disabled = false,
  onCellClick,
  onPieceHover,
  interactive = true,
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
    <div className="board-stage">
      <div className="board-plane">
        <img
          src={boardMapUrl}
          className={`board-map ${isPerspectiveFlipped ? "board-map-rotated" : ""}`}
          alt=""
        />
        <div className="board-overlay">
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

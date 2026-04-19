import { useCallback, useMemo } from "react";

import type { Position, Unit } from "../../shared/schema";
import type { BoardCell, ProjectedBoardProps } from "./types";

type UseProjectedBoardViewModelArgs = Pick<
  ProjectedBoardProps,
  "legalTargets" | "myId" | "pieces" | "rules" | "state" | "visibilityMode"
>;

export function useProjectedBoardViewModel({
  legalTargets = [],
  myId,
  pieces,
  rules,
  state,
  visibilityMode = "player",
}: UseProjectedBoardViewModelArgs) {
  const pieceById = useMemo(
    () => new Map(pieces.map((piece) => [piece.id, piece])),
    [pieces],
  );
  const cells = useMemo<BoardCell[]>(() => {
    return Array.from(
      { length: rules.board.width * rules.board.height },
      (_, index) => {
        const x = index % rules.board.width;
        const y = Math.floor(index / rules.board.width);

        return {
          key: `${x}-${y}`,
          x,
          y,
        };
      },
    );
  }, [rules.board.height, rules.board.width]);
  const boardColumns = rules.board.width;
  const boardRows = rules.board.height;
  const playerOneId = state.players[0]?.id ?? null;
  const isPerspectiveFlipped = myId !== null && state.players[1]?.id === myId;
  const legalTargetKeys = useMemo(
    () => new Set(legalTargets.map((target) => `${target.x}-${target.y}`)),
    [legalTargets],
  );

  const toDisplayPosition = useCallback(
    (position: Position) => ({
      x: isPerspectiveFlipped ? boardColumns - position.x - 1 : position.x,
      y: isPerspectiveFlipped ? boardRows - position.y - 1 : position.y,
    }),
    [boardColumns, boardRows, isPerspectiveFlipped],
  );

  const isUnitVisibleToViewer = useCallback(
    (unit: Unit) =>
      visibilityMode === "all" ||
      unit.ownerId === myId ||
      unit.revealedTo.includes(myId || ""),
    [myId, visibilityMode],
  );

  return {
    boardColumns,
    boardRows,
    cells,
    isPerspectiveFlipped,
    isUnitVisibleToViewer,
    legalTargetKeys,
    pieceById,
    playerOneId,
    toDisplayPosition,
  };
}

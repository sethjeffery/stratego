import type { GameState, Position } from "../../shared/schema";
import type { PendingBoardAction } from "../../types/ui";

import { ProjectedBoard } from "../../components/ProjectedBoard";
import boardStyles from "../../components/projectedBoard/ProjectedBoard.module.css";
import { gamePieces, gameRules } from "../../lib/gameConfig";

type GameBoardSectionProps = {
  disabled: boolean;
  legalTargets: Position[];
  myId: null | string;
  onCellClick: (target: Position) => Promise<void> | void;
  pendingBoardAction: null | PendingBoardAction;
  selectablePieceKeys: Set<string>;
  selected: null | Position;
  state: GameState;
};

export function GameBoardSection({
  disabled,
  legalTargets,
  myId,
  onCellClick,
  pendingBoardAction,
  selectablePieceKeys,
  selected,
  state,
}: GameBoardSectionProps) {
  return (
    <section className={boardStyles.boardSection}>
      <ProjectedBoard
        disabled={disabled}
        interactive
        legalTargets={legalTargets}
        myId={myId}
        onCellClick={(target) => void onCellClick(target)}
        pendingBoardAction={pendingBoardAction}
        pieces={gamePieces}
        rules={gameRules}
        selectablePieceKeys={selectablePieceKeys}
        selected={selected}
        state={state}
        visibilityMode="player"
      />
    </section>
  );
}

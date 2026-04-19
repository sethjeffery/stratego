import { ProjectedBoard } from "../../components/ProjectedBoard";
import { gamePieces, gameRules } from "../../lib/gameConfig";
import type { GameState, Position } from "../../shared/schema";
import type { PendingBoardAction } from "../../types/ui";

type GameBoardSectionProps = {
  disabled: boolean;
  legalTargets: Position[];
  myId: string | null;
  onCellClick: (target: Position) => void | Promise<void>;
  pendingBoardAction: PendingBoardAction | null;
  selectablePieceKeys: Set<string>;
  selected: Position | null;
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
    <section className="board">
      <ProjectedBoard
        state={state}
        rules={gameRules}
        pieces={gamePieces}
        myId={myId}
        pendingBoardAction={pendingBoardAction}
        selected={selected}
        legalTargets={legalTargets}
        selectablePieceKeys={selectablePieceKeys}
        disabled={disabled}
        onCellClick={(target) => void onCellClick(target)}
        interactive
        visibilityMode="player"
      />
    </section>
  );
}

import type { GameState, Position } from "../../shared/schema";

import { ProjectedBoard } from "../../components/ProjectedBoard";
import boardStyles from "../../components/projectedBoard/ProjectedBoard.module.css";
import { getGameSetupForState } from "../../lib/gameConfig";

type GameBoardSectionProps = {
  disabled: boolean;
  legalTargets: Position[];
  myId: null | string;
  onCellClick: (target: Position) => Promise<void> | void;
  selectablePieceKeys: Set<string>;
  selected: null | Position;
  state: GameState;
};

export function GameBoardSection({
  disabled,
  legalTargets,
  myId,
  onCellClick,
  selectablePieceKeys,
  selected,
  state,
}: GameBoardSectionProps) {
  const gameSetup = getGameSetupForState(state);

  return (
    <section className={boardStyles.boardSection}>
      <ProjectedBoard
        disabled={disabled}
        interactive
        legalTargets={legalTargets}
        myId={myId}
        onCellClick={(target) => void onCellClick(target)}
        pieces={gameSetup.pieces}
        rules={gameSetup.rules}
        selectablePieceKeys={selectablePieceKeys}
        selected={selected}
        state={state}
        visibilityMode="player"
      />
    </section>
  );
}

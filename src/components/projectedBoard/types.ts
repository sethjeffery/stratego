import type {
  GameState,
  PieceDefinition,
  Position,
  RulesConfig,
  Unit,
} from "../../shared/schema";
import type { PendingBoardAction } from "../../types/ui";

export type BoardCell = {
  key: string;
  x: number;
  y: number;
};

export type GhostUnitState = {
  endDisplay: Position;
  hideLiveUnitId?: string;
  key: string;
  startDisplay: Position;
  unit: Unit;
};

export type PieceColor = "player-one" | "player-two";

export type ProjectedBoardProps = {
  disabled?: boolean;
  interactive?: boolean;
  legalTargets?: Position[];
  myId: null | string;
  onCellClick?: (target: Position) => Promise<void> | void;
  onPieceHover?: (position: null | Position) => void;
  pendingBoardAction?: null | PendingBoardAction;
  pieces: PieceDefinition[];
  rules: RulesConfig;
  selectablePieceKeys?: Set<string>;
  selected?: null | Position;
  state: GameState;
  visibilityMode?: "all" | "player";
};

import type {
  GameState,
  PieceDefinition,
  Position,
  RulesConfig,
  Unit,
} from "../../shared/schema";
import type { PendingBoardAction } from "../../types/ui";

export type ProjectedBoardProps = {
  state: GameState;
  rules: RulesConfig;
  pieces: PieceDefinition[];
  myId: string | null;
  pendingBoardAction?: PendingBoardAction | null;
  selected?: Position | null;
  legalTargets?: Position[];
  selectablePieceKeys?: Set<string>;
  disabled?: boolean;
  onCellClick?: (target: Position) => void | Promise<void>;
  onPieceHover?: (position: Position | null) => void;
  interactive?: boolean;
  visibilityMode?: "player" | "all";
};

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

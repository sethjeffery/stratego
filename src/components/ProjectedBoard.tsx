import { CSSProperties, useMemo } from "react";
import boardMapUrl from "../assets/map.png";
import bluePieceUrl from "../assets/pieces/blue-piece.svg";
import redPieceUrl from "../assets/pieces/red-piece.svg";
import {
  GameState,
  PieceDefinition,
  Position,
  RulesConfig,
} from "../shared/schema";

type BoardCell = {
  key: string;
  x: number;
  y: number;
  blocked: boolean;
};

const pieceIconModules = import.meta.glob("../assets/pieces/*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const pieceIconById = Object.fromEntries(
  Object.entries(pieceIconModules).flatMap(([path, url]) => {
    const match = path.match(/stratego-([a-z]+)\.svg$/);
    return match ? [[match[1], url]] : [];
  }),
) as Record<string, string>;

const colorForOwner = (ownerId: string, playerOneId: string | null) =>
  ownerId === playerOneId ? "player-one" : "player-two";

type ProjectedBoardProps = {
  state: GameState;
  rules: RulesConfig;
  pieces: PieceDefinition[];
  myId: string | null;
  selected?: Position | null;
  legalTargets?: Position[];
  selectablePieceKeys?: Set<string>;
  disabled?: boolean;
  onCellClick?: (target: Position) => void | Promise<void>;
  interactive?: boolean;
  visibilityMode?: "player" | "all";
};

export function ProjectedBoard({
  state,
  rules,
  pieces,
  myId,
  selected = null,
  legalTargets = [],
  selectablePieceKeys = new Set<string>(),
  disabled = false,
  onCellClick,
  interactive = true,
  visibilityMode = "player",
}: ProjectedBoardProps) {
  const unitByPosition = useMemo(
    () => new Map(state.units.map((unit) => [`${unit.x}-${unit.y}`, unit])),
    [state.units],
  );
  const pieceById = useMemo(
    () => new Map(pieces.map((piece) => [piece.id, piece])),
    [pieces],
  );
  const cells = useMemo<BoardCell[]>(() => {
    const blockedCells = new Set(
      rules.board.blockedCells.map((cell) => `${cell.x}-${cell.y}`),
    );

    return Array.from(
      { length: rules.board.width * rules.board.height },
      (_, index) => {
        const x = index % rules.board.width;
        const y = Math.floor(index / rules.board.width);

        return {
          key: `${x}-${y}`,
          x,
          y,
          blocked: blockedCells.has(`${x}-${y}`),
        };
      },
    );
  }, [rules]);

  const boardColumns = rules.board.width;
  const boardRows = rules.board.height;
  const playerOneId = state.players[0]?.id ?? null;
  const isPerspectiveFlipped = myId !== null && state.players[1]?.id === myId;
  const shouldShowRank = (pieceId: string) =>
    pieceId !== "flag" && pieceId !== "bomb";
  const legalTargetKeys = useMemo(
    () => new Set(legalTargets.map((target) => `${target.x}-${target.y}`)),
    [legalTargets],
  );
  const toDisplayPosition = (position: Position) => ({
    x: isPerspectiveFlipped ? boardColumns - position.x - 1 : position.x,
    y: isPerspectiveFlipped ? boardRows - position.y - 1 : position.y,
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
          {cells.map((cell) => {
            const isSelected = selected?.x === cell.x && selected?.y === cell.y;
            const isLegalTarget = legalTargetKeys.has(cell.key);
            const display = toDisplayPosition(cell);
            const buttonStyle: CSSProperties = {
              left: `${(display.x / boardColumns) * 100}%`,
              top: `${(display.y / boardRows) * 100}%`,
              width: `${(1 / boardColumns) * 100}%`,
              height: `${(1 / boardRows) * 100}%`,
              zIndex: 1,
            };

            return (
              <button
                key={cell.key}
                className={`board-cell-hit ${isLegalTarget ? "is-target" : ""} ${isSelected ? "is-selected" : ""}`}
                style={buttonStyle}
                onClick={() =>
                  interactive &&
                  isLegalTarget &&
                  onCellClick?.({ x: cell.x, y: cell.y })
                }
                disabled={!interactive || !isLegalTarget}
                aria-label={`Board cell ${cell.x + 1}, ${cell.y + 1}`}
              >
                <span className="board-cell-highlight" />
              </button>
            );
          })}
          {state.units
            .map((unit) => {
              const display = toDisplayPosition(unit);

              return { unit, display };
            })
            .sort((left, right) => left.display.y - right.display.y)
            .map(({ unit, display }) => {
              const isSelected =
                selected?.x === unit.x && selected?.y === unit.y;
              const visible =
                visibilityMode === "all" ||
                unit.ownerId === myId ||
                unit.revealedTo.includes(myId || "");
              const piece = pieceById.get(unit.pieceId);
              const pieceIcon = pieceIconById[unit.pieceId];
              const pieceColor = colorForOwner(unit.ownerId, playerOneId);
              const isSelectable =
                !disabled &&
                unit.ownerId === myId &&
                (selected
                  ? isSelected
                  : selectablePieceKeys.has(`${unit.x}-${unit.y}`));
              const pieceShellUrl =
                pieceColor === "player-one" ? redPieceUrl : bluePieceUrl;
              const buttonStyle: CSSProperties = {
                left: `${((display.x + 0.5) / boardColumns) * 100}%`,
                top: `${((display.y + 1) / boardRows) * 100}%`,
                width: `${(0.76 / boardColumns) * 100}%`,
                height: `${(1 / boardRows) * 100}%`,
                zIndex: 10 + display.y,
              };
              return (
                <button
                  key={unit.id}
                  className={`piece-hit ${isSelectable ? "is-selectable" : ""} ${isSelected ? "is-selected" : ""}`}
                  style={buttonStyle}
                  onClick={() =>
                    interactive &&
                    isSelectable &&
                    onCellClick?.({ x: unit.x, y: unit.y })
                  }
                  disabled={!interactive || !isSelectable}
                  aria-label={piece?.label ?? unit.pieceId}
                >
                  <span
                    className={`piece ${pieceColor} ${state.lastBattle?.at.x === unit.x && state.lastBattle?.at.y === unit.y ? "impact" : ""}`}
                  >
                    <img
                      className="piece-shell"
                      src={pieceShellUrl}
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="piece-face">
                      {visible ? (
                        <>
                          {piece?.rank !== undefined &&
                            shouldShowRank(unit.pieceId) && (
                              <span className="piece-rank" aria-hidden="true">
                                {piece.rank}
                              </span>
                            )}
                          {pieceIcon ? (
                            <img
                              className="piece-icon"
                              src={pieceIcon}
                              alt={piece?.label ?? unit.pieceId}
                            />
                          ) : (
                            piece?.label.slice(0, 2)
                          )}
                        </>
                      ) : (
                        <span className="piece-mask">?</span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

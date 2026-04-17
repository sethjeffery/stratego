import {
  CSSProperties,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import boardMapUrl from "../assets/map.png";
import bluePieceUrl from "../assets/pieces/blue-piece.svg";
import redPieceUrl from "../assets/pieces/red-piece.svg";
import {
  GameState,
  PieceDefinition,
  Position,
  RulesConfig,
  Unit,
} from "../shared/schema";

type BoardCell = {
  key: string;
  x: number;
  y: number;
  blocked: boolean;
};

const impactParticles = [
  { angle: -78, distance: 46, delay: 0, size: 7 },
  { angle: -42, distance: 38, delay: 28, size: 6 },
  { angle: -14, distance: 34, delay: 12, size: 5 },
  { angle: 18, distance: 40, delay: 24, size: 7 },
  { angle: 52, distance: 48, delay: 8, size: 6 },
  { angle: 96, distance: 36, delay: 18, size: 5 },
  { angle: 138, distance: 42, delay: 4, size: 6 },
  { angle: 174, distance: 32, delay: 16, size: 5 },
  { angle: -58, distance: 52, delay: 96, size: 5 },
  { angle: -8, distance: 44, delay: 118, size: 4 },
  { angle: 34, distance: 50, delay: 142, size: 5 },
  { angle: 82, distance: 42, delay: 164, size: 4 },
  { angle: 126, distance: 48, delay: 188, size: 5 },
  { angle: 164, distance: 40, delay: 212, size: 4 },
] as const;

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
  pendingBoardAction?: {
    optimisticStateKey: string;
    previousSelection: Position;
    previousState: GameState;
  } | null;
  selected?: Position | null;
  legalTargets?: Position[];
  selectablePieceKeys?: Set<string>;
  disabled?: boolean;
  onCellClick?: (target: Position) => void | Promise<void>;
  onPieceHover?: (position: Position | null) => void;
  interactive?: boolean;
  visibilityMode?: "player" | "all";
};

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
  const isUnitVisibleToViewer = (unit: Unit) =>
    visibilityMode === "all" ||
    unit.ownerId === myId ||
    unit.revealedTo.includes(myId || "");
  const [ghostUnit, setGhostUnit] = useState<{
    endDisplay: Position;
    hideLiveUnitId?: string;
    key: string;
    startDisplay: Position;
    unit: Unit;
  } | null>(null);
  const [ghostResolving, setGhostResolving] = useState(false);
  const animatedActionKeyRef = useRef<string | null>(null);
  const previousStateRef = useRef(state);

  useLayoutEffect(() => {
    if (!pendingBoardAction || !state.lastBattle) return;
    if (
      animatedActionKeyRef.current === pendingBoardAction.optimisticStateKey
    ) {
      return;
    }

    const attacker = pendingBoardAction.previousState.units.find(
      (unit) =>
        unit.x === pendingBoardAction.previousSelection.x &&
        unit.y === pendingBoardAction.previousSelection.y,
    );
    if (!attacker || state.units.some((unit) => unit.id === attacker.id))
      return;

    animatedActionKeyRef.current = pendingBoardAction.optimisticStateKey;
    setGhostResolving(false);
    setGhostUnit({
      endDisplay: toDisplayPosition(state.lastBattle.at),
      key: pendingBoardAction.optimisticStateKey,
      startDisplay: toDisplayPosition(pendingBoardAction.previousSelection),
      unit: attacker,
    });

    let frameId = window.requestAnimationFrame(() => {
      setGhostResolving(true);
    });
    const timeoutId = window.setTimeout(() => {
      setGhostUnit((current) =>
        current?.key === pendingBoardAction.optimisticStateKey ? null : current,
      );
      setGhostResolving(false);
    }, 420);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [pendingBoardAction, state.lastBattle, state.units]);

  useLayoutEffect(() => {
    const previousState = previousStateRef.current;
    previousStateRef.current = state;

    if (
      previousState === state ||
      state.lastBattle ||
      state.moveCount === previousState.moveCount
    ) {
      return;
    }

    const previousUnitById = new Map(
      previousState.units.map((unit) => [unit.id, unit]),
    );
    const movedHiddenUnit = state.units.find((unit) => {
      const previousUnit = previousUnitById.get(unit.id);
      if (!previousUnit) return false;
      if (previousUnit.x === unit.x && previousUnit.y === unit.y) return false;

      return (
        !isUnitVisibleToViewer(previousUnit) && !isUnitVisibleToViewer(unit)
      );
    });

    if (!movedHiddenUnit) return;

    const previousUnit = previousUnitById.get(movedHiddenUnit.id)!;
    const animationKey = `hidden-move-${state.moveCount}-${movedHiddenUnit.id}`;
    if (animatedActionKeyRef.current === animationKey) return;

    animatedActionKeyRef.current = animationKey;
    setGhostResolving(false);
    setGhostUnit({
      endDisplay: toDisplayPosition(movedHiddenUnit),
      hideLiveUnitId: movedHiddenUnit.id,
      key: animationKey,
      startDisplay: toDisplayPosition(previousUnit),
      unit: movedHiddenUnit,
    });

    const frameId = window.requestAnimationFrame(() => {
      setGhostResolving(true);
    });
    const timeoutId = window.setTimeout(() => {
      setGhostUnit((current) =>
        current?.key === animationKey ? null : current,
      );
      setGhostResolving(false);
    }, 320);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [myId, state, visibilityMode]);

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
                  interactive && onCellClick?.({ x: cell.x, y: cell.y })
                }
                disabled={!interactive}
                data-x={cell.x}
                data-y={cell.y}
                aria-label={`Board cell ${cell.x + 1}, ${cell.y + 1}`}
              >
                <span className="board-cell-highlight" />
              </button>
            );
          })}
          {state.units
            .filter((unit) => unit.id !== ghostUnit?.hideLiveUnitId)
            .map((unit) => {
              const display = toDisplayPosition(unit);

              return { unit, display };
            })
            .sort((left, right) => left.display.y - right.display.y)
            .map(({ unit, display }) => {
              const isSelected =
                selected?.x === unit.x && selected?.y === unit.y;
              const isPicked =
                isSelected &&
                !disabled &&
                unit.ownerId === myId &&
                selectablePieceKeys.has(`${unit.x}-${unit.y}`);
              const visible = isUnitVisibleToViewer(unit);
              const piece = pieceById.get(unit.pieceId);
              const pieceIcon = pieceIconById[unit.pieceId];
              const pieceColor = colorForOwner(unit.ownerId, playerOneId);
              const isSelectable =
                !disabled &&
                unit.ownerId === myId &&
                (selected
                  ? isSelected || legalTargetKeys.has(`${unit.x}-${unit.y}`)
                  : selectablePieceKeys.has(`${unit.x}-${unit.y}`));
              const isFriendlyClickable = !disabled && unit.ownerId === myId;
              const isAttackTarget =
                !disabled && legalTargetKeys.has(`${unit.x}-${unit.y}`);
              const isPieceInteractive = interactive;
              const isPieceActionable =
                interactive && (isFriendlyClickable || isAttackTarget);
              const pieceShellUrl =
                pieceColor === "player-one" ? redPieceUrl : bluePieceUrl;
              const isWinningBattlePiece =
                state.lastBattle?.winnerOwnerId === unit.ownerId &&
                state.lastBattle?.at.x === unit.x &&
                state.lastBattle?.at.y === unit.y;
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
                  className={`piece-hit ${interactive ? "can-hover" : ""} ${isPieceActionable ? "is-interactive" : ""} ${isSelectable ? "is-selectable" : ""} ${isSelected ? "is-selected" : ""} ${isPicked ? "is-picked" : ""}`}
                  style={buttonStyle}
                  onClick={() =>
                    isPieceInteractive &&
                    onCellClick?.({ x: unit.x, y: unit.y })
                  }
                  onMouseEnter={() => onPieceHover?.({ x: unit.x, y: unit.y })}
                  onMouseLeave={() => onPieceHover?.(null)}
                  onFocus={() => onPieceHover?.({ x: unit.x, y: unit.y })}
                  onBlur={() => onPieceHover?.(null)}
                  disabled={!interactive}
                  aria-label={piece?.label ?? unit.pieceId}
                >
                  <span
                    className={`piece ${pieceColor} ${isWinningBattlePiece ? "impact" : ""}`}
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
                    {isWinningBattlePiece && (
                      <span
                        className={`piece-impact-burst ${pieceColor}`}
                        aria-hidden="true"
                      >
                        <span className="piece-impact-flash" />
                        {impactParticles.map((particle, index) => (
                          <span
                            key={`${unit.id}-impact-${index}`}
                            className="piece-impact-particle"
                            style={
                              {
                                "--impact-angle": `${particle.angle}deg`,
                                "--impact-delay": `${particle.delay}ms`,
                                "--impact-distance": `${particle.distance}px`,
                                "--impact-size": `${particle.size}px`,
                              } as CSSProperties
                            }
                          />
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          {ghostUnit &&
            (() => {
              const piece = pieceById.get(ghostUnit.unit.pieceId);
              const pieceIcon = pieceIconById[ghostUnit.unit.pieceId];
              const pieceColor = colorForOwner(
                ghostUnit.unit.ownerId,
                playerOneId,
              );
              const pieceShellUrl =
                pieceColor === "player-one" ? redPieceUrl : bluePieceUrl;
              const visible = isUnitVisibleToViewer(ghostUnit.unit);
              const display = ghostResolving
                ? ghostUnit.endDisplay
                : ghostUnit.startDisplay;
              const buttonStyle: CSSProperties = {
                left: `${((display.x + 0.5) / boardColumns) * 100}%`,
                top: `${((display.y + 1) / boardRows) * 100}%`,
                width: `${(0.76 / boardColumns) * 100}%`,
                height: `${(1 / boardRows) * 100}%`,
                zIndex: 10 + ghostUnit.endDisplay.y,
              };

              return (
                <span
                  key={ghostUnit.key}
                  className={`piece-hit is-ghost ${ghostResolving ? "is-resolving" : ""}`}
                  style={buttonStyle}
                  aria-hidden="true"
                >
                  <span className={`piece ${pieceColor}`}>
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
                            shouldShowRank(ghostUnit.unit.pieceId) && (
                              <span className="piece-rank" aria-hidden="true">
                                {piece.rank}
                              </span>
                            )}
                          {pieceIcon ? (
                            <img
                              className="piece-icon"
                              src={pieceIcon}
                              alt=""
                              aria-hidden="true"
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
                </span>
              );
            })()}
          {state.lastBattle?.winner === "both" &&
            (() => {
              const display = toDisplayPosition(state.lastBattle.at);
              const burstStyle: CSSProperties = {
                left: `${((display.x + 0.5) / boardColumns) * 100}%`,
                top: `${((display.y + 1) / boardRows) * 100}%`,
                width: `${(0.76 / boardColumns) * 100}%`,
                height: `${(1 / boardRows) * 100}%`,
                zIndex: 14 + display.y,
              };

              return (
                <span
                  key={`battle-burst-${state.moveCount}`}
                  className="piece-hit is-battle-burst"
                  style={burstStyle}
                  aria-hidden="true"
                >
                  <span className="piece-impact-burst is-both">
                    <span className="piece-impact-flash" />
                    {impactParticles.map((particle, index) => (
                      <span
                        key={`battle-burst-particle-${state.moveCount}-${index}`}
                        className="piece-impact-particle"
                        style={
                          {
                            "--impact-angle": `${particle.angle}deg`,
                            "--impact-delay": `${particle.delay}ms`,
                            "--impact-distance": `${particle.distance}px`,
                            "--impact-size": `${particle.size}px`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </span>
                </span>
              );
            })()}
        </div>
      </div>
    </div>
  );
}

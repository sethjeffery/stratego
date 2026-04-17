import { useEffect, useMemo, useState } from "react";
import { GameState, Position } from "./shared/schema";
import {
  applyMove as applySupabaseMove,
  createInitiatedSession,
  getSession,
  isSupabaseMode,
  joinAsChallenger,
  listOpenSessions,
  listSessions,
  SessionRow,
  subscribeToSession,
} from "./lib/supabaseGameService";
import {
  getOrCreateStoredProfile,
  getStoredSessionMembership,
  listStoredSessions,
  setStoredPlayerName,
  StoredSessionMembership,
  touchStoredSessionMembership,
  upsertStoredSessionMembership,
} from "./lib/localSessionStore";
import { createDebugBoardState } from "./lib/debugBoardState";
import { applyMoveToState, getLegalMovesForUnit } from "./lib/engine";
import { gamePieces, gameRules } from "./lib/gameConfig";
import { ProjectedBoard } from "./components/ProjectedBoard";

const DEFAULT_PLAYER_NAME = "Commander Nova";
const SESSION_QUERY_PARAM = "session";
const DEBUG_BOARD_PARAM = "debugBoard";

const getSessionIdFromUrl = () => {
  if (typeof window === "undefined") return "";
  return (
    new URL(window.location.href).searchParams
      .get(SESSION_QUERY_PARAM)
      ?.toUpperCase() ?? ""
  );
};

const isDebugBoardEnabled = () => {
  if (typeof window === "undefined") return false;
  const value = new URL(window.location.href).searchParams.get(
    DEBUG_BOARD_PARAM,
  );
  return value === "1" || value === "true";
};

const setSessionIdInUrl = (sessionId: string | null) => {
  if (typeof window === "undefined") return;

  const nextUrl = new URL(window.location.href);
  if (sessionId) nextUrl.searchParams.set(SESSION_QUERY_PARAM, sessionId);
  else nextUrl.searchParams.delete(SESSION_QUERY_PARAM);

  window.history.replaceState({}, "", nextUrl);
};

const buildSessionUrl = (sessionId: string) => {
  if (typeof window === "undefined")
    return `?${SESSION_QUERY_PARAM}=${sessionId}`;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(SESSION_QUERY_PARAM, sessionId);
  return nextUrl.toString();
};

const formatSessionTimestamp = (timestamp?: string | number) => {
  if (!timestamp) return "Unknown activity";
  return new Date(timestamp).toLocaleString();
};

const sessionStatusLabel = (row?: SessionRow) => {
  if (!row) return "Saved locally";
  if (!row.state) return "Waiting for challenger";
  if (row.state.winnerId) return "Completed";
  return "In progress";
};

export function App() {
  const [playerName, setPlayerName] = useState(DEFAULT_PLAYER_NAME);
  const [roomCode, setRoomCode] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<Position | null>(null);
  const [hoveredPiecePosition, setHoveredPiecePosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMemberships, setSavedMemberships] = useState<
    StoredSessionMembership[]
  >([]);
  const [savedSessionRows, setSavedSessionRows] = useState<
    Record<string, SessionRow>
  >({});
  const [profileReady, setProfileReady] = useState(false);
  const [openSessions, setOpenSessions] = useState<SessionRow[]>([]);
  const debugBoardEnabled = useMemo(() => isDebugBoardEnabled(), []);
  const demoState = useMemo(
    () => createDebugBoardState(gameRules, gamePieces).state,
    [],
  );
  const pieceById = useMemo(
    () => new Map(gamePieces.map((piece) => [piece.id, piece])),
    [],
  );
  const pieceIconById = useMemo(() => {
    const pieceIconModules = import.meta.glob("./assets/pieces/*.svg", {
      eager: true,
      import: "default",
    }) as Record<string, string>;

    return Object.fromEntries(
      Object.entries(pieceIconModules).flatMap(([path, url]) => {
        const match = path.match(/stratego-([a-z]+)\.svg$/);
        return match ? [[match[1], url]] : [];
      }),
    ) as Record<string, string>;
  }, []);
  const disabled = !state || !myId || state.turnPlayerId !== myId;
  const legalTargets = useMemo(() => {
    if (!selected || disabled) return [];
    return getLegalMovesForUnit(state, myId, selected, gameRules, gamePieces);
  }, [disabled, myId, selected, state]);
  const selectablePieceKeys = useMemo(() => {
    if (!state || !myId || disabled) return new Set<string>();

    return new Set(
      state.units
        .filter((unit) => unit.ownerId === myId)
        .filter(
          (unit) =>
            getLegalMovesForUnit(
              state,
              myId,
              { x: unit.x, y: unit.y },
              gameRules,
              gamePieces,
            ).length > 0,
        )
        .map((unit) => `${unit.x}-${unit.y}`),
    );
  }, [disabled, myId, state]);

  useEffect(() => {
    if (!state || !myId || !selected) return;
    const stillExists = state.units.some(
      (unit) =>
        unit.x === selected.x && unit.y === selected.y && unit.ownerId === myId,
    );
    if (disabled || !stillExists) {
      setSelected(null);
      setHoveredPiecePosition(null);
    }
  }, [disabled, myId, selected, state]);

  const refreshSavedSessions = async () => {
    const memberships = listStoredSessions();
    setSavedMemberships(memberships);
    const savedSessionIds = new Set(
      memberships.map((membership) => membership.sessionId),
    );

    if (isSupabaseMode && !debugBoardEnabled) {
      try {
        const rows = await listOpenSessions(15);
        setOpenSessions(
          rows
            .filter(
              (row) =>
                !savedSessionIds.has(row.session_id) &&
                row.initiator_name !== playerName,
            )
            .slice(0, 5),
        );
      } catch (err) {
        setError((err as Error).message);
      }
    } else {
      setOpenSessions([]);
    }

    if (!isSupabaseMode || debugBoardEnabled || memberships.length === 0) {
      setSavedSessionRows({});
      return;
    }

    try {
      const rows = await listSessions([
        ...new Set(memberships.map((membership) => membership.sessionId)),
      ]);
      setSavedSessionRows(
        Object.fromEntries(rows.map((row) => [row.session_id, row])),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const resumeSavedSession = async (membership: StoredSessionMembership) => {
    if (!isSupabaseMode) return;

    try {
      const session = await getSession(membership.sessionId);
      setRoomCode(session.session_id);
      setMyId(membership.playerId);
      setPlayerName(membership.playerName);
      setState(session.state ?? null);
      setSelected(null);
      setSessionIdInUrl(session.session_id);
      touchStoredSessionMembership(session.session_id);
      setSavedMemberships(listStoredSessions());
      await refreshSavedSessions();
      setError(
        session.state
          ? null
          : "Session restored. Waiting for challenger to join.",
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const leaveCurrentSession = () => {
    setState(null);
    setRoomCode("");
    setMyId(null);
    setSelected(null);
    setHoveredPiecePosition(null);
    setError(null);
    setSessionIdInUrl(null);
  };

  const copySessionLink = async (sessionId: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setError(`Share this link: ${buildSessionUrl(sessionId)}`);
      return;
    }

    try {
      await navigator.clipboard.writeText(buildSessionUrl(sessionId));
      setError("Session link copied.");
    } catch {
      setError(`Share this link: ${buildSessionUrl(sessionId)}`);
    }
  };

  useEffect(() => {
    const profile = getOrCreateStoredProfile(DEFAULT_PLAYER_NAME);
    setPlayerName(profile.playerName);
    setSavedMemberships(listStoredSessions());

    const urlSessionId = getSessionIdFromUrl();
    if (urlSessionId) setRoomCode(urlSessionId);
    setProfileReady(true);
  }, []);

  useEffect(() => {
    if (!profileReady || debugBoardEnabled) return;
    setStoredPlayerName(playerName);
  }, [debugBoardEnabled, playerName, profileReady]);

  useEffect(() => {
    if (debugBoardEnabled) {
      const debugState = createDebugBoardState(gameRules, gamePieces);
      setMyId(debugState.myId);
      setRoomCode(debugState.state.roomCode);
      setState(debugState.state);
      setError("Debug board preview mode.");
      return;
    }

    if (!isSupabaseMode) {
      setError(
        "Supabase client env vars are missing. Configure Supabase or open ?debugBoard=1 for local board inspection.",
      );
      return;
    }

    void refreshSavedSessions();

    const membership = getStoredSessionMembership(getSessionIdFromUrl());
    if (membership) void resumeSavedSession(membership);
  }, [debugBoardEnabled]);

  useEffect(() => {
    if (debugBoardEnabled || !isSupabaseMode || !roomCode) return;

    const unsubscribe = subscribeToSession(roomCode, (next) => {
      if (!next) return;

      setState(next);
      setSavedSessionRows((current) => {
        const existing = current[roomCode];
        if (!existing) return current;

        return {
          ...current,
          [roomCode]: {
            ...existing,
            state: next,
            updated_at: new Date().toISOString(),
          },
        };
      });
    });

    return unsubscribe;
  }, [debugBoardEnabled, roomCode]);

  useEffect(() => {
    if (debugBoardEnabled || !isSupabaseMode || !roomCode || !myId) return;

    const membership = getStoredSessionMembership(roomCode);
    if (!membership || membership.playerId !== myId) return;

    touchStoredSessionMembership(roomCode);
    setSavedMemberships(listStoredSessions());
  }, [debugBoardEnabled, myId, roomCode, state?.moveCount]);

  const visibleSavedSessions = savedMemberships.filter((membership) => {
    const row = savedSessionRows[membership.sessionId];
    return !row?.state?.winnerId;
  });

  const createSession = async () => {
    if (!isSupabaseMode) {
      setError("Supabase client env vars are missing.");
      return;
    }

    try {
      const session = await createInitiatedSession(playerName);
      upsertStoredSessionMembership({
        sessionId: session.session_id,
        playerId: session.initiator_id,
        playerName,
        role: "initiator",
      });
      setRoomCode(session.session_id);
      setMyId(session.initiator_id);
      setState(null);
      setSelected(null);
      setHoveredPiecePosition(null);
      setSessionIdInUrl(session.session_id);
      await refreshSavedSessions();
      setError(
        "Session created. Share the link or code and wait for challenger to join.",
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const joinSession = async () => {
    if (!isSupabaseMode) {
      setError("Supabase client env vars are missing.");
      return;
    }

    const savedMembership = getStoredSessionMembership(roomCode);
    if (savedMembership) {
      await resumeSavedSession(savedMembership);
      return;
    }

    try {
      const joined = await joinAsChallenger(roomCode, playerName);
      upsertStoredSessionMembership({
        sessionId: joined.row.session_id,
        playerId: joined.playerId,
        playerName,
        role: "challenger",
      });
      setRoomCode(joined.row.session_id);
      setMyId(joined.playerId);
      setState(joined.row.state);
      setSelected(null);
      setHoveredPiecePosition(null);
      setSessionIdInUrl(joined.row.session_id);
      await refreshSavedSessions();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onCellClick = async (target: Position) => {
    if (!state || !myId || disabled) return;

    if (!selected) {
      if (selectablePieceKeys.has(`${target.x}-${target.y}`)) {
        setSelected(target);
        setError(null);
      }
      return;
    }

    if (selected.x === target.x && selected.y === target.y) {
      setSelected(null);
      return;
    }

    const mine = state.units.find(
      (unit) =>
        unit.x === target.x && unit.y === target.y && unit.ownerId === myId,
    );
    if (mine) {
      setSelected(target);
      setError(null);
      return;
    }

    if (
      !legalTargets.some((move) => move.x === target.x && move.y === target.y)
    ) {
      return;
    }

    if (debugBoardEnabled) {
      const result = applyMoveToState(
        state,
        myId,
        selected,
        target,
        gameRules,
        gamePieces,
      );
      if (result.error || !result.nextState) {
        setError(result.error ?? "Move rejected.");
      } else {
        setState(result.nextState);
        setError("Debug board preview mode.");
      }
    } else {
      try {
        await applySupabaseMove(state.roomCode, myId, selected, target);
      } catch (err) {
        setError((err as Error).message);
      }
    }

    setSelected(null);
    setHoveredPiecePosition(null);
  };

  const loadExisting = async () => {
    if (!isSupabaseMode) {
      setError("Supabase client env vars are missing.");
      return;
    }

    const membership = getStoredSessionMembership(roomCode);
    if (membership) {
      await resumeSavedSession(membership);
      return;
    }

    try {
      const session = await getSession(roomCode);
      setRoomCode(session.session_id);
      setState(session.state);
      setMyId(null);
      setSelected(null);
      setHoveredPiecePosition(null);
      setSessionIdInUrl(session.session_id);
      setError(
        "Session loaded in read-only mode. Resume from a saved device session or join as challenger to take control.",
      );
      await refreshSavedSessions();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const battleText = state?.lastBattle
    ? `${pieceById.get(state.lastBattle.attackerPieceId)?.label ?? "Attacker"} vs ${pieceById.get(state.lastBattle.defenderPieceId)?.label ?? "Defender"} • ${state.lastBattle.winner.toUpperCase()}!`
    : "Awaiting clash...";
  const turnPlayerName =
    state?.players.find((player) => player.id === state.turnPlayerId)?.name ??
    "Commander";
  const otherPlayerName =
    state?.players.find((player) => player.id !== myId)?.name ?? "other player";
  const isMyTurn = Boolean(state && myId && state.turnPlayerId === myId);
  const statusText = isMyTurn ? "Your turn" : `Waiting for ${otherPlayerName}…`;
  const hoveredUnit =
    state && hoveredPiecePosition
      ? state.units.find(
          (unit) =>
            unit.x === hoveredPiecePosition.x &&
            unit.y === hoveredPiecePosition.y,
        )
      : null;
  const selectedUnit =
    state && selected
      ? state.units.find((unit) => unit.x === selected.x && unit.y === selected.y)
      : null;
  const inspectedUnit = hoveredUnit ?? selectedUnit;
  const inspectedPiece = inspectedUnit
    ? pieceById.get(inspectedUnit.pieceId)
    : null;
  const inspectedVisible =
    Boolean(inspectedUnit) &&
    (debugBoardEnabled ||
      inspectedUnit?.ownerId === myId ||
      inspectedUnit?.revealedTo.includes(myId ?? ""));
  const inspectedPieceTraits = inspectedVisible && inspectedPiece
    ? [
        inspectedPiece.canTraverseMany
          ? "Can move multiple open squares in a straight line."
          : null,
        inspectedPiece.canDefuseBomb
          ? "Defuses bombs when attacking."
          : null,
        inspectedPiece.immovable ? "Cannot move once deployed." : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Welcome briefing</p>
        <h1>Stratego Online</h1>
        <p className="hero-intro">
          A classic hidden-information battlefield where each move is a risk,
          each reveal matters, and each session is easy to resume from this
          device.
        </p>
        <p className="hero-subtitle">
          {debugBoardEnabled
            ? "Local debug board • deterministic preview state"
            : "Create or join hosted sessions, challenge a second commander in real-time, and keep your matches tied to this device."}
        </p>
      </header>

      {!state && (
        <div className="lobby-stack">
          <section className="welcome-board">
            <div className="board demo-board">
              <ProjectedBoard
                state={demoState}
                rules={gameRules}
                pieces={gamePieces}
                myId={null}
                interactive={false}
                visibilityMode="all"
              />
            </div>
          </section>

          <section className="lobby card">
            <h2>Start Playing</h2>
            <label>
              Callsign
              <input
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
              />
            </label>
            <div className="lobby-actions">
              <button onClick={createSession}>Create Session</button>
              <input
                placeholder="SESSION"
                maxLength={8}
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(event.target.value.toUpperCase())
                }
              />
              <button onClick={joinSession}>Join or Resume</button>
              <button className="secondary-button" onClick={loadExisting}>
                Load From URL/Code
              </button>
            </div>
            {roomCode && (
              <div className="inline-actions">
                <small>Current session URL: {buildSessionUrl(roomCode)}</small>
                <button
                  className="secondary-button"
                  onClick={() => copySessionLink(roomCode)}
                >
                  Copy Session Link
                </button>
              </div>
            )}
            <small>
              Config-loaded ruleset: {gameRules.gameName} (
              {gameRules.board.width}x{gameRules.board.height})
            </small>
          </section>

          {!debugBoardEnabled && openSessions.length > 0 && (
            <section className="open-session-feed card">
              <h2>Open Hosted Sessions</h2>
              <p>
                Looking for a quick match? These sessions are waiting for a
                second player.
              </p>
              <ul>
                {openSessions.map((sessionRow) => (
                  <li key={sessionRow.session_id}>
                    <strong>{sessionRow.session_id}</strong> • Hosted by{" "}
                    {sessionRow.initiator_name} • Updated{" "}
                    {formatSessionTimestamp(sessionRow.updated_at)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!debugBoardEnabled && visibleSavedSessions.length > 0 && (
            <section className="session-dashboard card">
              <h2>Your Active Sessions</h2>
              <div className="saved-session-list">
                {visibleSavedSessions.map((membership) => {
                  const row = savedSessionRows[membership.sessionId];

                  return (
                    <article
                      key={membership.sessionId}
                      className="saved-session-card"
                    >
                      <div>
                        <strong>{membership.sessionId}</strong>
                        <p>
                          {sessionStatusLabel(row)} • {membership.role}
                        </p>
                        <small>
                          {row?.state?.players
                            .map((player) => player.name)
                            .join(" vs ") ?? membership.playerName}
                          {" • "}
                          Updated{" "}
                          {formatSessionTimestamp(
                            row?.updated_at ?? membership.lastOpenedAt,
                          )}
                        </small>
                      </div>
                      <div className="inline-actions">
                        <button
                          className="secondary-button"
                          onClick={() => void resumeSavedSession(membership)}
                        >
                          Resume
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            void copySessionLink(membership.sessionId)
                          }
                        >
                          Copy Link
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {state && (
        <main className="arena-layout">
          <section className="board">
            <ProjectedBoard
              state={state}
              rules={gameRules}
              pieces={gamePieces}
              myId={myId}
              selected={selected}
              legalTargets={legalTargets}
              selectablePieceKeys={selectablePieceKeys}
              disabled={disabled}
              onCellClick={onCellClick}
              onPieceHover={setHoveredPiecePosition}
              interactive
              visibilityMode="player"
            />
          </section>

          <aside className="hud card">
            <p className={`turn-status ${isMyTurn ? "is-active" : ""}`}>{statusText}</p>
            <h2>Session {state.roomCode}</h2>
            <p>
              Turn:{" "}
              <strong>{turnPlayerName}</strong>
            </p>
            <p>{battleText}</p>
            {state.winnerId && (
              <p className="winner">
                🏆{" "}
                {
                  state.players.find((player) => player.id === state.winnerId)
                    ?.name
                }{" "}
                wins!
              </p>
            )}
            <ul>
              {state.players.map((player) => (
                <li key={player.id}>
                  {player.name} {player.connected ? "🟢" : "🔴"}
                </li>
              ))}
            </ul>
            <section className="piece-intel">
              <h3>Piece Intel</h3>
              {inspectedUnit ? (
                <>
                  <div className="piece-intel-header">
                    <div className="piece-intel-icon" aria-hidden="true">
                      {inspectedVisible && inspectedPiece ? (
                        pieceIconById[inspectedPiece.id] ? (
                          <img
                            src={pieceIconById[inspectedPiece.id]}
                            alt=""
                          />
                        ) : (
                          inspectedPiece.label.slice(0, 2)
                        )
                      ) : (
                        "?"
                      )}
                    </div>
                    <div>
                      <strong>
                        {inspectedVisible && inspectedPiece
                          ? inspectedPiece.label
                          : "Unknown enemy unit"}
                      </strong>
                      {inspectedVisible && inspectedPiece && (
                        <p>Rank {inspectedPiece.rank}</p>
                      )}
                    </div>
                  </div>
                  {inspectedVisible && inspectedPiece ? (
                    inspectedPieceTraits.length > 0 ? (
                      <ul>
                        {inspectedPieceTraits.map((trait) => (
                          <li key={trait}>{trait}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No special abilities or restrictions.</p>
                    )
                  ) : (
                    <p>Identity remains hidden until revealed in battle.</p>
                  )}
                </>
              ) : (
                <p>Hover over or select a piece to inspect it.</p>
              )}
            </section>
            {!debugBoardEnabled && (
              <div className="hud-actions">
                <button
                  className="secondary-button"
                  onClick={() => void copySessionLink(state.roomCode)}
                >
                  Copy Session Link
                </button>
                <button
                  className="secondary-button"
                  onClick={leaveCurrentSession}
                >
                  Leave Session
                </button>
              </div>
            )}
          </aside>
        </main>
      )}

      {error && <div className="error card">{error}</div>}
    </div>
  );
}

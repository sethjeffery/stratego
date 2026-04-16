import { useEffect, useMemo, useState } from "react";
import { GameState, Position } from "./shared/schema";
import {
  applyMove as applySupabaseMove,
  createInitiatedSession,
  getSession,
  isSupabaseMode,
  joinAsChallenger,
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
  const [error, setError] = useState<string | null>(null);
  const [savedMemberships, setSavedMemberships] = useState<
    StoredSessionMembership[]
  >([]);
  const [savedSessionRows, setSavedSessionRows] = useState<
    Record<string, SessionRow>
  >({});
  const [profileReady, setProfileReady] = useState(false);
  const debugBoardEnabled = useMemo(() => isDebugBoardEnabled(), []);
  const pieceById = useMemo(
    () => new Map(gamePieces.map((piece) => [piece.id, piece])),
    [],
  );
  const canAct = !!state && !!myId && state.turnPlayerId === myId;
  const legalTargets = useMemo(() => {
    if (!state || !myId || !selected || !canAct) return [];
    return getLegalMovesForUnit(state, myId, selected, gameRules, gamePieces);
  }, [canAct, myId, selected, state]);
  const selectablePieceKeys = useMemo(() => {
    if (!state || !myId || !canAct) return new Set<string>();

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
  }, [canAct, myId, state]);

  useEffect(() => {
    if (!state || !myId || !selected) return;
    const stillExists = state.units.some(
      (unit) =>
        unit.x === selected.x && unit.y === selected.y && unit.ownerId === myId,
    );
    if (!canAct || !stillExists) {
      setSelected(null);
    }
  }, [canAct, myId, selected, state]);

  const refreshSavedSessions = async () => {
    const memberships = listStoredSessions();
    setSavedMemberships(memberships);

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
      setSessionIdInUrl(joined.row.session_id);
      await refreshSavedSessions();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onCellClick = async (target: Position) => {
    if (!state || !myId) return;
    if (!canAct) return;

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

    if (!legalTargets.some((move) => move.x === target.x && move.y === target.y)) {
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

  return (
    <div className="app-shell">
      <header>
        <h1>Stratego Pulse Arena</h1>
        <p>
          {debugBoardEnabled
            ? "Local debug board • deterministic preview state"
            : "Supabase direct mode • resumable session flow"}
        </p>
      </header>

      {!state && (
        <div className="lobby-stack">
          <section className="lobby card">
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
          <aside className="hud card">
            <h2>Session {state.roomCode}</h2>
            <p>
              Turn:{" "}
              <strong>
                {state.players.find(
                  (player) => player.id === state.turnPlayerId,
                )?.name ?? "Complete"}
              </strong>
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

          <section className="board">
            <ProjectedBoard
              state={state}
              rules={gameRules}
              pieces={gamePieces}
              myId={myId}
              selected={selected}
              legalTargets={legalTargets}
              selectablePieceKeys={selectablePieceKeys}
              canAct={canAct}
              onCellClick={onCellClick}
            />
          </section>
        </main>
      )}

      {error && <div className="error card">{error}</div>}
    </div>
  );
}

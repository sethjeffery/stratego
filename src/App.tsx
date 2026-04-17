import { useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardScreen } from "./screens/DashboardScreen";
import { GameScreen } from "./screens/GameScreen";
import { SessionAccessScreen } from "./screens/SessionAccessScreen";
import { createDebugBoardState } from "./lib/debugBoardState";
import {
  applyMoveToState,
  applySetupSwapToState,
  getLegalMovesForUnit,
  getSetupSwapTargets,
  markPlayerSetupReady,
} from "./lib/engine";
import { gamePieces, gameRules } from "./lib/gameConfig";
import {
  getOrCreateStoredProfile,
  getStoredSessionMembership,
  listStoredSessions,
  setStoredProfile,
  StoredSessionMembership,
  touchStoredSessionMembership,
  updateStoredSessionMembershipProfile,
  upsertStoredSessionMembership,
} from "./lib/localSessionStore";
import {
  avatarCatalog,
  createRandomPlayerProfile,
  DEFAULT_AVATAR_ID,
  generatePlayerName,
  pickRandomAvatarId,
  resolveAvatarUrl,
} from "./lib/playerProfile";
import {
  applyMove as applySupabaseMove,
  applySetupSwap as applySupabaseSetupSwap,
  createInitiatedSession,
  getSession,
  isSupabaseMode,
  joinAsChallenger,
  listSessions,
  markSetupReady as markSupabaseSetupReady,
  SessionRow,
  subscribeToSession,
  updateSessionPlayerProfile,
} from "./lib/supabaseGameService";
import { GameState, Position } from "./shared/schema";

const DEFAULT_PLAYER_NAME = "Commander Nova";
const SESSION_QUERY_PARAM = "session";
const DEBUG_BOARD_PARAM = "debugBoard";
const DASHBOARD_ROUTE = "/";
const GAME_ROUTE = "/game";

const normalizeSessionId = (sessionId: string) => sessionId.trim().toUpperCase();

const getSessionIdFromSearch = (search: string) => {
  const value = new URLSearchParams(search).get(SESSION_QUERY_PARAM);
  return value ? normalizeSessionId(value) : "";
};

const buildSearchWithoutLegacySession = (search: string) => {
  const nextParams = new URLSearchParams(search);
  nextParams.delete(SESSION_QUERY_PARAM);
  return nextParams.toString() ? `?${nextParams.toString()}` : "";
};

const isDebugBoardEnabled = (search: string) => {
  const value = new URLSearchParams(search).get(DEBUG_BOARD_PARAM);
  return value === "1" || value === "true";
};

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const gameMatch = useMatch("/game/:sessionId");
  const routeSessionId = normalizeSessionId(gameMatch?.params.sessionId ?? "");
  const routeSearch = useMemo(
    () => buildSearchWithoutLegacySession(location.search),
    [location.search],
  );
  const legacySessionId = useMemo(
    () => getSessionIdFromSearch(location.search),
    [location.search],
  );
  const defaultProfile = useMemo(
    () => createRandomPlayerProfile({ playerName: DEFAULT_PLAYER_NAME }),
    [],
  );
  const [playerName, setPlayerName] = useState(DEFAULT_PLAYER_NAME);
  const [avatarId, setAvatarId] = useState(
    avatarCatalog[0]?.id ?? DEFAULT_AVATAR_ID,
  );
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
  const [routeSessionRow, setRouteSessionRow] = useState<SessionRow | null>(null);
  const [routeSessionLoading, setRouteSessionLoading] = useState(false);
  const [routeSessionMissing, setRouteSessionMissing] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  const debugBoardEnabled = useMemo(
    () => isDebugBoardEnabled(location.search),
    [location.search],
  );
  const demoState = useMemo(
    () => createDebugBoardState(gameRules, gamePieces).state,
    [],
  );
  const pieceById = useMemo(
    () => new Map(gamePieces.map((piece) => [piece.id, piece])),
    [],
  );
  const lastSyncedProfileKey = useRef<string | null>(null);
  const trimmedPlayerName = playerName.trim();
  const currentProfile = trimmedPlayerName
    ? { playerName: trimmedPlayerName, avatarId }
    : null;
  const profileKey = currentProfile
    ? `${currentProfile.playerName}::${currentProfile.avatarId}`
    : "";
  const profileAvatarUrl = resolveAvatarUrl(avatarId);
  const routeMembership = useMemo(
    () =>
      routeSessionId
        ? savedMemberships.find(
            (membership) => membership.sessionId === routeSessionId,
          ) ?? null
        : null,
    [routeSessionId, savedMemberships],
  );

  const isSetupPhase = Boolean(state && state.phase === "setup");
  const disabled =
    !state ||
    !myId ||
    (isSetupPhase
      ? state.setupReadyPlayerIds.includes(myId)
      : state.turnPlayerId !== myId);

  const legalTargets = useMemo(() => {
    if (!state || !myId || !selected || disabled) return [];
    if (state.phase === "setup") {
      return getSetupSwapTargets(state, myId, selected, gameRules, gamePieces);
    }
    return getLegalMovesForUnit(state, myId, selected, gameRules, gamePieces);
  }, [disabled, myId, selected, state]);

  const selectablePieceKeys = useMemo(() => {
    if (!state || !myId || disabled) return new Set<string>();

    const keys =
      state.phase === "setup"
        ? state.units
            .filter((unit) => unit.ownerId === myId)
            .filter(
              (unit) =>
                getSetupSwapTargets(
                  state,
                  myId,
                  { x: unit.x, y: unit.y },
                  gameRules,
                  gamePieces,
                ).length > 0,
            )
            .map((unit) => `${unit.x}-${unit.y}`)
        : state.units
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
            .map((unit) => `${unit.x}-${unit.y}`);

    return new Set(keys);
  }, [disabled, myId, state]);

  const buildGamePath = (sessionId: string) =>
    `/game/${normalizeSessionId(sessionId)}`;

  const navigateToSession = (sessionId: string, replace = false) => {
    navigate(
      {
        pathname: buildGamePath(sessionId),
        search: routeSearch,
      },
      { replace },
    );
  };

  const buildSessionUrl = (sessionId: string) => {
    if (typeof window === "undefined") {
      return `${buildGamePath(sessionId)}${routeSearch}`;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = buildGamePath(sessionId);
    nextUrl.search = routeSearch;
    return nextUrl.toString();
  };

  const goToDashboard = () => {
    setRouteSessionRow(null);
    setRouteSessionLoading(false);
    setRouteSessionMissing(false);
    setState(null);
    setMyId(null);
    setRoomCode("");
    setSelected(null);
    setError(null);
    navigate({ pathname: DASHBOARD_ROUTE, search: "" });
  };

  useEffect(() => {
    if (!gameMatch?.params.sessionId) return;

    const rawSessionId = gameMatch.params.sessionId;
    if (rawSessionId === routeSessionId) return;

    navigate(
      {
        pathname: buildGamePath(routeSessionId),
        search: routeSearch,
      },
      { replace: true },
    );
  }, [gameMatch?.params.sessionId, navigate, routeSearch, routeSessionId]);

  useEffect(() => {
    if (routeSessionId || !legacySessionId) return;
    navigate(
      {
        pathname: buildGamePath(legacySessionId),
        search: routeSearch,
      },
      { replace: true },
    );
  }, [legacySessionId, navigate, routeSearch, routeSessionId]);

  useEffect(() => {
    if (!state || !myId || !selected) return;

    const stillExists = state.units.some(
      (unit) =>
        unit.x === selected.x && unit.y === selected.y && unit.ownerId === myId,
    );
    if (disabled || !stillExists) {
      setSelected(null);
    }
  }, [disabled, myId, selected, state]);

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
      setState(session.state ?? null);
      setRouteSessionRow(session);
      setRouteSessionMissing(false);
      setSelected(null);
      navigateToSession(session.session_id, true);
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
    setMyId(null);
    setRoomCode("");
    setSelected(null);
    setRouteSessionRow(null);
    setRouteSessionMissing(false);
    setRouteSessionLoading(false);
    setError(null);
    navigate({ pathname: DASHBOARD_ROUTE, search: "" });
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
    const profile = getOrCreateStoredProfile(defaultProfile);
    setPlayerName(profile.playerName);
    setAvatarId(profile.avatarId);
    setSavedMemberships(listStoredSessions());
    lastSyncedProfileKey.current = `${profile.playerName}::${profile.avatarId}`;
    setProfileReady(true);
  }, [defaultProfile]);

  useEffect(() => {
    if (!profileReady || debugBoardEnabled || !trimmedPlayerName) return;

    const nextProfile = { playerName: trimmedPlayerName, avatarId };
    setStoredProfile(nextProfile);
    const nextMemberships = updateStoredSessionMembershipProfile(nextProfile);
    setSavedMemberships(nextMemberships);

    if (
      !isSupabaseMode ||
      nextMemberships.length === 0 ||
      lastSyncedProfileKey.current === profileKey
    ) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const updates = await Promise.allSettled(
          nextMemberships.map((membership) =>
            updateSessionPlayerProfile(
              membership.sessionId,
              membership.playerId,
              membership.role,
              nextProfile,
            ),
          ),
        );

        if (cancelled) return;

        const successfulRows = updates
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<SessionRow> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value);

        if (successfulRows.length > 0) {
          setSavedSessionRows((current) => ({
            ...current,
            ...Object.fromEntries(
              successfulRows.map((row) => [row.session_id, row]),
            ),
          }));
          setRouteSessionRow((current) => {
            if (!current) return current;
            return (
              successfulRows.find((row) => row.session_id === current.session_id) ??
              current
            );
          });
        }

        const failures = updates.filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (failures.length > 0) {
          setError(failures[0].reason?.message ?? "Could not sync profile.");
          return;
        }

        lastSyncedProfileKey.current = profileKey;
      })();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [avatarId, debugBoardEnabled, profileKey, profileReady, trimmedPlayerName]);

  useEffect(() => {
    if (!profileReady) return;

    if (debugBoardEnabled) {
      const debugState = createDebugBoardState(gameRules, gamePieces);
      setMyId(debugState.myId);
      setRoomCode(debugState.state.roomCode);
      setState(debugState.state);
      setRouteSessionRow(null);
      setRouteSessionLoading(false);
      setRouteSessionMissing(false);
      setError("Debug board preview mode.");
      return;
    }

    if (!isSupabaseMode) {
      setRouteSessionLoading(false);
      setRouteSessionMissing(false);
      setError(
        "Supabase client env vars are missing. Configure Supabase or open ?debugBoard=1 for local board inspection.",
      );
      return;
    }

    void refreshSavedSessions();
  }, [debugBoardEnabled, profileReady]);

  useEffect(() => {
    if (!profileReady || debugBoardEnabled || !isSupabaseMode) return;

    if (!routeSessionId) {
      setRouteSessionRow(null);
      setRouteSessionLoading(false);
      setRouteSessionMissing(false);
      return;
    }

    let cancelled = false;
    const savedMembership = getStoredSessionMembership(routeSessionId);

    setRoomCode(routeSessionId);
    setSelected(null);
    setRouteSessionLoading(true);
    setRouteSessionMissing(false);

    if (savedMembership) {
      void (async () => {
        await resumeSavedSession(savedMembership);
        if (!cancelled) setRouteSessionLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }

    setState(null);
    setMyId(null);

    void (async () => {
      try {
        const session = await getSession(routeSessionId);
        if (cancelled) return;
        setRouteSessionRow(session);
        setRouteSessionMissing(false);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setRouteSessionRow(null);
        setRouteSessionMissing(true);
        setError((err as Error).message);
      } finally {
        if (!cancelled) setRouteSessionLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debugBoardEnabled, profileReady, routeSessionId]);

  useEffect(() => {
    if (debugBoardEnabled || !isSupabaseMode || !routeSessionId) return;

    const unsubscribe = subscribeToSession(routeSessionId, (nextRow) => {
      setRouteSessionRow(nextRow);
      setSavedSessionRows((current) => ({
        ...current,
        [routeSessionId]: nextRow,
      }));

      const membership = getStoredSessionMembership(routeSessionId);
      if (membership) {
        setMyId(membership.playerId);
        setState(nextRow.state ?? null);
      } else {
        setMyId(null);
        setState(null);
      }
    });

    return unsubscribe;
  }, [debugBoardEnabled, routeSessionId]);

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

    if (!currentProfile) {
      setError("Enter a callsign before hosting a session.");
      return;
    }

    try {
      const session = await createInitiatedSession(currentProfile);
      upsertStoredSessionMembership({
        sessionId: session.session_id,
        playerId: session.initiator_id,
        playerName: currentProfile.playerName,
        avatarId: currentProfile.avatarId,
        role: "initiator",
      });
      setSavedMemberships(listStoredSessions());
      setRoomCode(session.session_id);
      setMyId(session.initiator_id);
      setState(null);
      setRouteSessionRow(session);
      setRouteSessionMissing(false);
      setSelected(null);
      navigateToSession(session.session_id);
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

    if (!currentProfile) {
      setError("Enter a callsign before joining a session.");
      return;
    }

    const targetSessionId = normalizeSessionId(routeSessionId || roomCode);
    if (!targetSessionId) {
      setError("Enter a session code first.");
      return;
    }

    const savedMembership = getStoredSessionMembership(targetSessionId);
    if (savedMembership) {
      await resumeSavedSession(savedMembership);
      return;
    }

    try {
      const joined = await joinAsChallenger(targetSessionId, currentProfile);
      upsertStoredSessionMembership({
        sessionId: joined.row.session_id,
        playerId: joined.playerId,
        playerName: currentProfile.playerName,
        avatarId: currentProfile.avatarId,
        role: "challenger",
      });
      setSavedMemberships(listStoredSessions());
      setRoomCode(joined.row.session_id);
      setMyId(joined.playerId);
      setState(joined.row.state ?? null);
      setRouteSessionRow(joined.row);
      setRouteSessionMissing(false);
      setSelected(null);
      navigateToSession(joined.row.session_id, true);
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
      const isLegalSetupSwapTarget = legalTargets.some(
        (move) => move.x === target.x && move.y === target.y,
      );

      if (!isSetupPhase || !isLegalSetupSwapTarget) {
        setSelected(target);
        setError(null);
        return;
      }
    }

    if (!legalTargets.some((move) => move.x === target.x && move.y === target.y)) {
      return;
    }

    if (debugBoardEnabled) {
      const result = isSetupPhase
        ? applySetupSwapToState(
            state,
            myId,
            selected,
            target,
            gameRules,
            gamePieces,
          )
        : applyMoveToState(
            state,
            myId,
            selected,
            target,
            gameRules,
            gamePieces,
          );

      if (result.error || !result.nextState) {
        setError(result.error ?? "Action rejected.");
      } else {
        setState(result.nextState);
        setError("Debug board preview mode.");
      }
    } else {
      try {
        if (isSetupPhase) {
          await applySupabaseSetupSwap(state.roomCode, myId, selected, target);
        } else {
          await applySupabaseMove(state.roomCode, myId, selected, target);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    }

    setSelected(null);
  };

  const markReady = async () => {
    if (!state || !myId || state.phase !== "setup") return;

    if (debugBoardEnabled) {
      const result = markPlayerSetupReady(state, myId);
      if (result.error || !result.nextState) {
        setError(result.error ?? "Could not mark ready.");
      } else {
        setState(result.nextState);
        setSelected(null);
        setError("Debug board preview mode.");
      }
      return;
    }

    try {
      await markSupabaseSetupReady(state.roomCode, myId);
      setSelected(null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadExisting = async () => {
    if (!isSupabaseMode) {
      setError("Supabase client env vars are missing.");
      return;
    }

    const targetSessionId = normalizeSessionId(roomCode);
    if (!targetSessionId) {
      setError("Enter a session code first.");
      return;
    }

    navigateToSession(targetSessionId);
  };

  const randomizeAvatar = () => {
    setAvatarId((current) => pickRandomAvatarId(current));
  };

  const randomizeName = () => {
    setPlayerName((current) => generatePlayerName(current.trim() || undefined));
  };

  const statusText =
    state?.phase === "setup"
      ? myId && state.setupReadyPlayerIds.includes(myId)
        ? "Your deployment is locked in. Waiting for the opposing commander."
        : `Swap pieces within your first ${gameRules.setupRowsPerPlayer} rows, then mark ready.`
      : state?.lastBattle
        ? `${pieceById.get(state.lastBattle.attackerPieceId)?.label ?? "Attacker"} vs ${pieceById.get(state.lastBattle.defenderPieceId)?.label ?? "Defender"} • ${state.lastBattle.winner.toUpperCase()}!`
        : "Awaiting clash...";

  const showLiveGame =
    Boolean(routeSessionId) &&
    Boolean(routeMembership) &&
    roomCode === routeSessionId &&
    Boolean(state);

  return (
    <AppLayout error={error}>
      <Routes>
        <Route
          path={DASHBOARD_ROUTE}
          element={
            debugBoardEnabled ? (
              <Navigate
                to={{
                  pathname: GAME_ROUTE,
                  search: routeSearch,
                }}
                replace
              />
            ) : (
              <DashboardScreen
                avatarUrl={profileAvatarUrl}
                debugBoardEnabled={debugBoardEnabled}
                demoState={demoState}
                playerName={playerName}
                roomCode={roomCode}
                savedSessionRows={savedSessionRows}
                trimmedPlayerName={trimmedPlayerName}
                visibleSavedSessions={visibleSavedSessions}
                buildSessionUrl={buildSessionUrl}
                copySessionLink={copySessionLink}
                createSession={createSession}
                joinSession={joinSession}
                loadExisting={loadExisting}
                onPlayerNameBlur={() =>
                  setPlayerName(
                    (current) => current.trim() || DEFAULT_PLAYER_NAME,
                  )
                }
                onPlayerNameChange={setPlayerName}
                onResumeSavedSession={resumeSavedSession}
                onRoomCodeChange={setRoomCode}
                randomizeAvatar={randomizeAvatar}
                randomizeName={randomizeName}
              />
            )
          }
        />
        <Route
          path={GAME_ROUTE}
          element={
            debugBoardEnabled ? (
              state ? (
                <GameScreen
                  canMarkReady={
                    Boolean(myId) &&
                    state.phase === "setup" &&
                    !state.setupReadyPlayerIds.includes(myId ?? "")
                  }
                  debugBoardEnabled={debugBoardEnabled}
                  disabled={disabled}
                  legalTargets={legalTargets}
                  markReady={markReady}
                  myId={myId}
                  selectablePieceKeys={selectablePieceKeys}
                  selected={selected}
                  state={state}
                  statusText={statusText}
                  copySessionLink={copySessionLink}
                  leaveCurrentSession={leaveCurrentSession}
                  onCellClick={onCellClick}
                />
              ) : (
                <main className="session-access">
                  <section className="session-status-card card">
                    <p className="eyebrow">Debug Board</p>
                    <h1>Preparing local preview</h1>
                  </section>
                </main>
              )
            ) : legacySessionId ? (
              <main className="session-access">
                <section className="session-status-card card">
                  <p className="eyebrow">Redirecting</p>
                  <h1>Opening session {legacySessionId}</h1>
                </section>
              </main>
            ) : (
              <Navigate to={DASHBOARD_ROUTE} replace />
            )
          }
        />
        <Route
          path="/game/:sessionId"
          element={
            showLiveGame ? (
              <GameScreen
                canMarkReady={
                  Boolean(myId) &&
                  state?.phase === "setup" &&
                  !state.setupReadyPlayerIds.includes(myId ?? "")
                }
                debugBoardEnabled={debugBoardEnabled}
                disabled={disabled}
                legalTargets={legalTargets}
                markReady={markReady}
                myId={myId}
                selectablePieceKeys={selectablePieceKeys}
                selected={selected}
                state={state!}
                statusText={statusText}
                copySessionLink={copySessionLink}
                leaveCurrentSession={leaveCurrentSession}
                onCellClick={onCellClick}
              />
            ) : (
              <SessionAccessScreen
                isLoading={routeSessionLoading}
                isMissing={routeSessionMissing}
                isMember={Boolean(routeMembership)}
                isHost={routeMembership?.role === "initiator"}
                sessionId={routeSessionId}
                sessionRow={routeSessionRow}
                buildSessionUrl={buildSessionUrl}
                copySessionLink={copySessionLink}
                goToDashboard={goToDashboard}
                joinSession={joinSession}
              />
            )
          }
        />
        <Route path="*" element={<Navigate to={DASHBOARD_ROUTE} replace />} />
      </Routes>
    </AppLayout>
  );
}

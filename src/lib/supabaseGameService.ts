import { createClient } from "@supabase/supabase-js";
import { customAlphabet, nanoid } from "nanoid";

import {
  getConfiguredPlayerSessionStorageMode,
  getDebugSessionSelection,
  getRequestedGameServiceMode,
} from "../app/runtimeConfig";
import { getFixturePlayerForRole } from "../fixtures/sessionFixtures";
import type { GameState, Position } from "../shared/schema";
import { appendChatMessage, normalizeGameState } from "../shared/schema";
import type { Database } from "../types/database.types";
import {
  applyMoveToState,
  applySetupSwapToState,
  createRematchState,
  createSessionGame,
  markPlayerSetupReady,
} from "./engine";
import { gamePieces, gameRules } from "./gameConfig";
import { getOrCreateStoredDeviceIdentity } from "./localSessionStore";
import {
  ensureMemoryFixtureSession,
  memoryApplyMove,
  memoryApplySetupSwap,
  memoryArchiveSession,
  memoryCloseFinishedGame,
  memoryCreateInitiatedSession,
  memoryGetCurrentUser,
  memoryGetSession,
  memoryJoinSessionAsCurrentUser,
  memoryListMySessions,
  memoryListOpenSessions,
  memoryListSessions,
  memoryMarkSetupReady,
  memoryResetFinishedGame,
  memorySendChatMessage,
  memorySubscribeToSession,
  memorySurrenderGame,
  memoryUpdateCurrentUserProfile,
} from "./memoryGameService";
import { generatePlayerName, pickRandomAvatarId } from "./playerProfile";

export type SessionRole = "initiator" | "challenger";

export type SessionRow = Omit<
  Database["public"]["Tables"]["game_sessions"]["Row"],
  "state"
> & {
  initiator?: UserDeviceProfile | null;
  challenger?: UserDeviceProfile | null;
  memberships?: (Database["public"]["Tables"]["session_memberships"]["Row"] & {
    player: UserDeviceProfile;
  })[];
  state: GameState | null;
};

export type CurrentUser = Database["public"]["Tables"]["player_profiles"]["Row"];

export type UserProfile = Pick<CurrentUser, "player_name" | "avatar_id">;
export type UserDeviceProfile = Pick<
  CurrentUser,
  "player_name" | "avatar_id" | "device_id"
>;

type SessionMembershipRow = {
  session_id: string;
  device_id: string;
  role: SessionRole;
  player_id: string;
  archived_at: string | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionParticipant = SessionMembershipRow & {
  player_name: string;
  avatar_id: string;
};

export type SessionSummary = SessionRow & {
  memberships: SessionParticipant[];
  initiator: SessionParticipant | null;
  challenger: SessionParticipant | null;
  currentMembership: SessionParticipant | null;
};

export type SessionAccess = {
  session: SessionSummary;
  membership: SessionParticipant | null;
};

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined);

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined);

export const isSupabaseMode = Boolean(supabaseUrl && supabaseAnonKey);

const client = isSupabaseMode
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!)
  : null;

const TABLE = "game_sessions";
const MEMBERSHIP_TABLE = "session_memberships";
const PROFILE_TABLE = "player_profiles";
const SESSION_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const createSessionCode = customAlphabet(SESSION_CODE_ALPHABET, 8);
const MAX_SESSION_UPDATE_ATTEMPTS = 4;

const normalizeSessionRow = (row: SessionRow): SessionRow => ({
  ...row,
  state: normalizeGameState(row.state),
});

const shouldUseMemoryGameService = () => {
  const debugSelection = getDebugSessionSelection();
  if (debugSelection?.fixtureId) return true;

  const requestedMode = getRequestedGameServiceMode();
  if (requestedMode) return requestedMode === "memory";

  return !isSupabaseMode;
};

export const getGameServiceCacheScope = () => {
  const debugSelection = getDebugSessionSelection();

  return [
    shouldUseMemoryGameService() ? "memory" : "supabase",
    getConfiguredPlayerSessionStorageMode(),
    debugSelection?.fixtureId ?? "-",
    debugSelection?.role ?? "-",
  ].join(":");
};

const getCurrentDeviceId = () => {
  const debugSelection = getDebugSessionSelection();
  if (debugSelection?.fixtureId) {
    ensureMemoryFixtureSession(debugSelection.fixtureId);
    const fixturePlayer = getFixturePlayerForRole(
      debugSelection.fixtureId,
      debugSelection.role,
    );
    if (fixturePlayer) {
      return fixturePlayer.device_id;
    }
  }

  return getOrCreateStoredDeviceIdentity().deviceId;
};

const getNowIsoString = () => new Date().toISOString();

const buildInitialSessionState = (session: SessionRow) => {
  if (!session.initiator || !session.challenger) return null;

  const initialized = createSessionGame(
    session.initiator,
    session.challenger,
    gameRules,
    gamePieces,
    {
      initiatorId: session.initiator.device_id,
      challengerId: session.challenger.device_id,
    },
  );
  initialized.state.roomCode = session.session_id;
  return initialized.state;
};

const upsertMembership = async (membership: {
  session_id: string;
  device_id: string;
  role: SessionRole;
  archived_at?: string | null;
  last_opened_at?: string | null;
}) => {
  if (!client) throw new Error("Supabase is not configured.");

  const { error } = await client.from(MEMBERSHIP_TABLE).upsert(
    {
      ...membership,
      archived_at: membership.archived_at ?? null,
      last_opened_at: membership.last_opened_at ?? getNowIsoString(),
    },
    {
      onConflict: "session_id,role",
    },
  );

  if (error) throw error;
};

const updateSessionState = async (
  sessionId: string,
  buildNextState: (row: SessionRow) => { nextState?: GameState; error?: string },
) => {
  if (!client) throw new Error("Supabase is not configured.");

  for (let attempt = 0; attempt < MAX_SESSION_UPDATE_ATTEMPTS; attempt += 1) {
    const row = await getSession(sessionId);
    const result = buildNextState(row);
    if (result.error || !result.nextState) {
      throw new Error(result.error ?? "Could not update session state.");
    }

    const { data, error } = await client
      .from(TABLE)
      .update({ state: result.nextState })
      .eq("session_id", sessionId)
      .eq("updated_at", row.updated_at)
      .select("*")
      .maybeSingle<SessionRow>();

    if (error) throw error;
    if (data) return normalizeSessionRow(data);
  }

  throw new Error("Session changed before the update could be saved. Try again.");
};

export const getCurrentUser = async () => {
  const deviceId = getCurrentDeviceId();
  if (shouldUseMemoryGameService()) {
    return await memoryGetCurrentUser(deviceId);
  }
  if (!client) throw new Error("Supabase is not configured.");

  const { data, error } = await client
    .from(PROFILE_TABLE)
    .select("*")
    .eq("device_id", deviceId)
    .maybeSingle<CurrentUser>();

  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await client
    .from(PROFILE_TABLE)
    .insert({
      device_id: deviceId,
      player_name: generatePlayerName(),
      avatar_id: pickRandomAvatarId(),
    })
    .select("*")
    .single<CurrentUser>();

  if (createError || !created) {
    throw createError ?? new Error("Could not create player profile.");
  }

  return created;
};

export const updateCurrentUserProfile = async (profile: UserProfile) => {
  const deviceId = getCurrentDeviceId();
  if (shouldUseMemoryGameService()) {
    return await memoryUpdateCurrentUserProfile(deviceId, profile);
  }
  if (!client) throw new Error("Supabase is not configured.");

  const currentUser = await getCurrentUser();
  const nextUser = {
    device_id: currentUser.device_id,
    player_name: profile.player_name,
    avatar_id: profile.avatar_id,
  };

  const { data, error } = await client
    .from(PROFILE_TABLE)
    .upsert(nextUser, {
      onConflict: "device_id",
    })
    .select("*")
    .single<CurrentUser>();

  if (error || !data) {
    throw error ?? new Error("Could not update player profile.");
  }

  return data;
};

export const createInitiatedSession = async (initiator: CurrentUser) => {
  if (shouldUseMemoryGameService()) {
    return await memoryCreateInitiatedSession(initiator);
  }
  if (!client) throw new Error("Supabase is not configured.");

  const sessionId = createSessionCode();
  const { data, error } = await client
    .from("game_sessions")
    .insert({
      session_id: sessionId,
      state: null,
    })
    .select("*")
    .single<SessionRow>();

  if (error || !data) throw error ?? new Error("Could not create session.");

  await upsertMembership({
    session_id: sessionId,
    device_id: initiator.device_id,
    role: "initiator",
  });

  return {
    ...data,
    initiator: {
      device_id: initiator.device_id,
      player_name: initiator.player_name,
      avatar_id: initiator.avatar_id,
    },
    session_memberships: [
      {
        archived_at: null,
        created_at: "",
        last_opened_at: "",
        updated_at: "",
        session_id: sessionId,
        device_id: initiator.device_id,
        role: "initiator",
        player: {
          device_id: initiator.device_id,
          player_name: initiator.player_name,
          avatar_id: initiator.avatar_id,
        },
      },
    ],
  } as SessionRow;
};

export const joinSessionAsCurrentUser = async (sessionId: string) => {
  const deviceId = getCurrentDeviceId();
  if (shouldUseMemoryGameService()) {
    return await memoryJoinSessionAsCurrentUser(sessionId, deviceId);
  }
  if (!client) throw new Error("Supabase is not configured.");

  const currentUser = await getCurrentUser();
  const existingAccess = await getSession(sessionId);
  if (existingAccess.memberships?.some(({ archived_at }) => archived_at)) {
    throw new Error("Cannot join archived session");
  }

  if (
    existingAccess.initiator?.device_id === currentUser.device_id ||
    existingAccess.challenger?.device_id === currentUser.device_id
  ) {
    const role =
      existingAccess.initiator?.device_id === currentUser.device_id
        ? "initiator"
        : "challenger";

    await upsertMembership({
      session_id: sessionId,
      device_id: currentUser.device_id,
      role,
      archived_at: null,
    });
    return getSession(sessionId);
  }

  if (
    existingAccess.challenger &&
    existingAccess.challenger.device_id !== currentUser.device_id
  ) {
    throw new Error("Session is already full.");
  }

  if (!existingAccess.initiator) {
    throw new Error("Host of session not found.");
  }

  await upsertMembership({
    session_id: sessionId,
    device_id: currentUser.device_id,
    role: "challenger",
  });

  return getSession(sessionId);
};

export const archiveSession = async (
  sessionId: string,
  deviceId = getCurrentDeviceId(),
) => {
  if (shouldUseMemoryGameService()) {
    return await memoryArchiveSession(sessionId, deviceId);
  }
  if (!client) throw new Error("Supabase is not configured.");

  const { error } = await client
    .from(MEMBERSHIP_TABLE)
    .update({
      archived_at: getNowIsoString(),
    })
    .eq("session_id", sessionId)
    .eq("device_id", deviceId)
    .is("archived_at", null);

  if (error) throw error;

  return await getSession(sessionId);
};

export const getSession = async (sessionId: string): Promise<SessionRow> => {
  if (shouldUseMemoryGameService()) {
    return await memoryGetSession(sessionId);
  }
  if (!client) throw new Error("Supabase is not configured.");
  const { data } = await client
    .from(TABLE)
    .select("*, memberships:session_memberships(*, player:player_profiles(*))")
    .eq("session_id", sessionId)
    .single()
    .throwOnError();

  const hydrated = hydrateSessionData(data);
  if (hydrated.state || !hydrated.initiator || !hydrated.challenger) {
    return hydrated;
  }

  const initialState = buildInitialSessionState(hydrated);
  if (!initialState) return hydrated;

  await client
    .from(TABLE)
    .update({
      state: initialState,
    })
    .eq("session_id", sessionId)
    .throwOnError();

  return {
    ...hydrated,
    state: initialState,
  };
};

export const hydrateSessionData = (
  data: Database["public"]["Tables"]["game_sessions"]["Row"] & {
    memberships: (Database["public"]["Tables"]["session_memberships"]["Row"] & {
      player: Database["public"]["Tables"]["player_profiles"]["Row"];
    })[];
  },
) => {
  return {
    ...data,
    initiator: data.memberships.find((membership) => membership.role === "initiator")
      ?.player,
    challenger: data.memberships.find((membership) => membership.role === "challenger")
      ?.player,
    state: data.state as GameState | null,
  } as SessionRow;
};

export const listSessions = async (sessionIds: string[]) => {
  if (shouldUseMemoryGameService()) {
    return await memoryListSessions(sessionIds);
  }
  if (!client) throw new Error("Supabase is not configured.");
  if (sessionIds.length === 0) return [] as SessionRow[];

  const { data } = await client
    .from(TABLE)
    .select("*, memberships:session_memberships(*, player:player_profiles(*))")
    .in("session_id", sessionIds)
    .order("updated_at", { ascending: false })
    .throwOnError();

  return data.map(hydrateSessionData);
};

export const listMySessions = async (deviceId = getCurrentDeviceId()) => {
  if (shouldUseMemoryGameService()) {
    return await memoryListMySessions(deviceId);
  }
  if (!client) throw new Error("Supabase is not configured.");

  const { data } = await client
    .from(TABLE)
    .select(
      "*, memberships:session_memberships!inner(*, player:player_profiles!inner(*))",
    )
    .eq("session_memberships.device_id", deviceId)
    .order("updated_at", { ascending: false })
    .throwOnError();

  return data
    .map(hydrateSessionData)
    .filter(
      (value) =>
        !value.memberships?.some(
          (membership) => membership.archived_at && membership.device_id === deviceId,
        ),
    );
};

export const listOpenSessions = async (limit = 5) => {
  if (shouldUseMemoryGameService()) {
    return await memoryListOpenSessions(limit);
  }
  if (!client) throw new Error("Supabase is not configured.");

  const { data } = await client
    .from(TABLE)
    .select("*, memberships:session_memberships(*, player:player_profiles(*))")
    .is("memberships(challenger_id)", null)
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit * 3, limit))
    .throwOnError();

  return data.map(hydrateSessionData);
};

export const applyMove = async (
  sessionId: string,
  playerId: string,
  from: Position,
  to: Position,
) => {
  if (shouldUseMemoryGameService()) {
    return await memoryApplyMove(sessionId, playerId, from, to);
  }
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };
    return applyMoveToState(
      currentRow.state,
      playerId,
      from,
      to,
      gameRules,
      gamePieces,
    );
  });

  return row.state!;
};

export const applySetupSwap = async (
  sessionId: string,
  playerId: string,
  from: Position,
  to: Position,
) => {
  if (shouldUseMemoryGameService()) {
    return await memoryApplySetupSwap(sessionId, playerId, from, to);
  }
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };

    return applySetupSwapToState(
      currentRow.state,
      playerId,
      from,
      to,
      gameRules,
      gamePieces,
    );
  });

  return row.state!;
};

export const markSetupReady = async (sessionId: string, playerId: string) => {
  if (shouldUseMemoryGameService()) {
    return await memoryMarkSetupReady(sessionId, playerId);
  }
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };
    return markPlayerSetupReady(currentRow.state, playerId);
  });

  return row.state!;
};

export const resetFinishedGame = async (sessionId: string, playerId: string) => {
  if (shouldUseMemoryGameService()) {
    return await memoryResetFinishedGame(sessionId, playerId);
  }
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };
    if (!currentRow.state.players.some((player) => player.id === playerId)) {
      return { error: "Unknown player." };
    }
    if (currentRow.state.phase !== "finished") {
      return { error: "Game is not in completion phase." };
    }

    return {
      nextState: createRematchState(currentRow.state, gameRules, gamePieces),
    };
  });

  return row.state!;
};

export const closeFinishedGame = async (sessionId: string, playerId: string) => {
  if (shouldUseMemoryGameService()) {
    return await memoryCloseFinishedGame(sessionId, playerId);
  }
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };
    if (!currentRow.state.players.some((player) => player.id === playerId)) {
      return { error: "Unknown player." };
    }
    if (currentRow.state.phase !== "finished") {
      return { error: "Game is not in completion phase." };
    }

    return {
      nextState: {
        ...currentRow.state,
        phase: "closed",
        turnPlayerId: null,
      },
    };
  });

  return row.state!;
};

export const surrenderGame = async (sessionId: string, playerId: string) => {
  if (shouldUseMemoryGameService()) {
    return await memorySurrenderGame(sessionId, playerId);
  }
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };
    if (!currentRow.state.players.some((player) => player.id === playerId)) {
      return { error: "Unknown player." };
    }
    if (currentRow.state.phase === "finished" || currentRow.state.phase === "closed") {
      return { error: "Game is already over." };
    }

    const winner = currentRow.state.players.find((player) => player.id !== playerId);
    return {
      nextState: {
        ...currentRow.state,
        phase: "finished",
        turnPlayerId: null,
        winnerId: winner?.id ?? null,
        completionReason: "surrender",
        surrenderedById: playerId,
        finishedAt: getNowIsoString(),
      },
    };
  });

  return row.state!;
};

export const sendChatMessage = async (
  sessionId: string,
  playerId: string,
  text: string,
  options?: {
    messageId?: string;
    sentAt?: string;
  },
) => {
  if (shouldUseMemoryGameService()) {
    return await memorySendChatMessage(sessionId, playerId, text, options);
  }
  const trimmedText = text.trim();
  if (!trimmedText) throw new Error("Enter a message first.");

  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };

    const sender = currentRow.state.players.find((player) => player.id === playerId);
    if (!sender) return { error: "Unknown player." };

    return {
      nextState: appendChatMessage(currentRow.state, {
        id: options?.messageId ?? nanoid(10),
        type: "player",
        playerId,
        senderName: sender.name,
        text: trimmedText,
        sentAt: options?.sentAt ?? getNowIsoString(),
      }),
    };
  });

  return row.state!;
};

export const subscribeToSession = (
  sessionId: string,
  onSession: (next: SessionRow) => void,
) => {
  if (shouldUseMemoryGameService()) {
    return memorySubscribeToSession(sessionId, onSession);
  }
  if (!client) return () => undefined;

  const channel = client
    .channel(`session:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABLE,
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const next = normalizeSessionRow(payload.new as SessionRow);
        onSession(next);
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
};

export const subscribeToSessionDetails = (
  sessionId: string,
  onSession: (next: SessionRow) => void,
) => {
  if (shouldUseMemoryGameService()) {
    return memorySubscribeToSession(sessionId, onSession);
  }
  if (!client) return () => undefined;

  const publishLatestSession = () => {
    void getSession(sessionId).then(onSession).catch(() => undefined);
  };

  const membershipChannel = client
    .channel(`session-memberships:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: MEMBERSHIP_TABLE,
        filter: `session_id=eq.${sessionId}`,
      },
      publishLatestSession,
    )
    .subscribe();

  const profileChannel = client
    .channel(`session-profiles:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: PROFILE_TABLE,
      },
      publishLatestSession,
    )
    .subscribe();

  return () => {
    client.removeChannel(membershipChannel);
    client.removeChannel(profileChannel);
  };
};

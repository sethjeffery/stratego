import {
  createClient,
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { customAlphabet, nanoid } from "nanoid";

import type { GameState, Position } from "../shared/schema";
import type { Database } from "../types/database.types";

import { appendChatMessage } from "../shared/schema";
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
  generatePlayerName,
  getMemberByRole,
  pickRandomAvatarId,
} from "./playerProfile";

export type CurrentUser = Database["public"]["Tables"]["player_profiles"]["Row"];
export type GameSession = Omit<
  Database["public"]["Tables"]["game_sessions"]["Row"],
  "state"
> & { state: GameState | null };
export type GameSessionDetails = Omit<
  Database["public"]["Tables"]["game_sessions"]["Row"],
  "state"
> & {
  challenger?: null | UserDeviceProfile;
  initiator?: null | UserDeviceProfile;
  memberships?:
    | (Database["public"]["Tables"]["session_memberships"]["Row"] & {
        profile?: null | UserDeviceProfile;
      })[]
    | null;
  state: GameState | null;
};
export type PlayerProfile = Database["public"]["Tables"]["player_profiles"]["Row"];

export type SessionMembership =
  Database["public"]["Tables"]["session_memberships"]["Row"];

export type SessionRole = Database["public"]["Enums"]["session_role"];

export type UserDeviceProfile = Pick<
  CurrentUser,
  "avatar_id" | "device_id" | "player_name"
>;
export type UserProfile = Pick<CurrentUser, "avatar_id" | "player_name">;

type Entry<T extends Record<string, any>> = {
  channel: RealtimeChannel;
  listeners: Set<Listener<T>>;
};

type Listener<T extends Record<string, any>> = (
  payload: RealtimePostgresChangesPayload<T>,
) => void;

const sessionMembershipRegistry = new Map<string, Entry<SessionMembership>>();
const profileRegistry = new Map<string, Entry<PlayerProfile>>();
const gameSessionRegistry = new Map<string, Entry<GameSession>>();

export type SessionAccess = {
  membership: null | SessionParticipant;
  session: SessionSummary;
};

export type SessionParticipant = SessionMembershipRow & {
  avatar_id: string;
  player_name: string;
};

export type SessionSummary = GameSessionDetails & {
  challenger: null | SessionParticipant;
  currentMembership: null | SessionParticipant;
  initiator: null | SessionParticipant;
  memberships: SessionParticipant[];
};

type SessionMembershipRow = {
  archived_at: null | string;
  created_at: string;
  device_id: string;
  last_opened_at: null | string;
  player_id: string;
  role: SessionRole;
  session_id: string;
  updated_at: string;
};

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined);

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined);

const client = createClient<Database>(supabaseUrl!, supabaseAnonKey!);

const TABLE = "game_sessions";
const UNARCHIVED_TABLE = "unarchived_game_sessions";
const OPEN_TABLE = "open_game_sessions";
const MEMBERSHIP_TABLE = "session_memberships";
const PROFILE_TABLE = "player_profiles";
const SESSION_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const createSessionCode = customAlphabet(SESSION_CODE_ALPHABET, 8);
const MAX_SESSION_UPDATE_ATTEMPTS = 4;

const getCurrentDeviceId = () => {
  return getOrCreateStoredDeviceIdentity().deviceId;
};

const getNowIsoString = () => new Date().toISOString();

const upsertMembership = async (membership: {
  archived_at?: null | string;
  device_id: string;
  last_opened_at?: null | string;
  role: SessionRole;
  session_id: string;
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
  buildNextState: (row: GameSession) => {
    error?: string;
    nextState?: GameState;
  },
): Promise<GameSession> => {
  if (!client) throw new Error("Supabase is not configured.");

  for (let attempt = 0; attempt < MAX_SESSION_UPDATE_ATTEMPTS; attempt += 1) {
    const row = await requireSession(sessionId);
    const result = buildNextState(row);
    if (result.error || !result.nextState) {
      throw new Error(result.error ?? "Could not update session state.");
    }

    const { data } = await client
      .from(TABLE)
      .update({ state: result.nextState })
      .eq("session_id", sessionId)
      .eq("updated_at", row.updated_at)
      .select("*")
      .single()
      .throwOnError();

    return data as GameSession;
  }

  throw new Error("Session changed before the update could be saved. Try again.");
};

export const getCurrentUser = async () => {
  const deviceId = getCurrentDeviceId();
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
      avatar_id: pickRandomAvatarId(),
      device_id: deviceId,
      player_name: generatePlayerName(),
    })
    .select("*")
    .single<CurrentUser>();

  if (createError || !created) {
    throw createError ?? new Error("Could not create player profile.");
  }

  return created;
};

export const updateCurrentUserProfile = async (profile: UserProfile) => {
  if (!client) throw new Error("Supabase is not configured.");

  const currentUser = await getCurrentUser();
  const nextUser = {
    avatar_id: profile.avatar_id,
    device_id: currentUser.device_id,
    player_name: profile.player_name,
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
  if (!client) throw new Error("Supabase is not configured.");

  const sessionId = createSessionCode();
  const { data, error } = await client
    .from("game_sessions")
    .insert({
      session_id: sessionId,
      state: null,
    })
    .select("*")
    .single<GameSessionDetails>();

  if (error || !data) throw error ?? new Error("Could not create session.");

  await upsertMembership({
    device_id: initiator.device_id,
    role: "initiator",
    session_id: sessionId,
  });

  return {
    ...data,
    initiator: {
      avatar_id: initiator.avatar_id,
      device_id: initiator.device_id,
      player_name: initiator.player_name,
    },
    session_memberships: [
      {
        archived_at: null,
        created_at: "",
        device_id: initiator.device_id,
        last_opened_at: "",
        player: {
          avatar_id: initiator.avatar_id,
          device_id: initiator.device_id,
          player_name: initiator.player_name,
        },
        role: "initiator",
        session_id: sessionId,
        updated_at: "",
      },
    ],
  } as GameSessionDetails;
};

export const joinSessionAsCurrentUser = async (sessionId: string) => {
  if (!client) throw new Error("Supabase is not configured.");

  const currentUser = await getCurrentUser();
  const existingAccess = await getSession(sessionId);
  if (!existingAccess) {
    throw new Error("Session not found");
  }

  const memberships = await getSessionMemberships(sessionId);
  if (memberships?.some(({ archived_at }) => archived_at)) {
    throw new Error("Cannot join archived session");
  }

  const initiator = await getProfile(
    getMemberByRole(memberships, "initiator")?.device_id,
  );
  const challenger = await getProfile(
    getMemberByRole(memberships, "challenger")?.device_id,
  );

  if (
    initiator?.device_id === currentUser.device_id ||
    challenger?.device_id === currentUser.device_id
  ) {
    const role =
      initiator?.device_id === currentUser.device_id ? "initiator" : "challenger";

    await upsertMembership({
      archived_at: null,
      device_id: currentUser.device_id,
      role,
      session_id: sessionId,
    });
    return getSession(sessionId);
  }

  if (challenger && challenger.device_id !== currentUser.device_id) {
    throw new Error("Session is already full.");
  }

  if (!initiator) {
    throw new Error("Host of session not found.");
  }

  await upsertMembership({
    device_id: currentUser.device_id,
    role: "challenger",
    session_id: sessionId,
  });

  const initialized = createSessionGame(initiator, currentUser, gameRules, gamePieces, {
    challengerId: currentUser.device_id,
    initiatorId: initiator.device_id,
  });
  initialized.state.roomCode = sessionId;
  await updateSessionState(sessionId, () => ({ nextState: initialized.state }));

  return getSession(sessionId);
};

export const archiveSession = async (
  sessionId: string,
  deviceId = getCurrentDeviceId(),
) => {
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

export const getSessionMemberships = async (sessionId: string) => {
  if (!client) throw new Error("Supabase is not configured.");
  const { data } = await client
    .from(MEMBERSHIP_TABLE)
    .select("*")
    .eq("session_id", sessionId)
    .throwOnError();

  return data;
};

export const getProfile = async (
  deviceId: string | undefined,
  createIfEmpty?: boolean,
) => {
  if (!deviceId) return null;

  if (!client) throw new Error("Supabase is not configured.");
  const { data } = await client
    .from(PROFILE_TABLE)
    .select("*")
    .eq("device_id", deviceId)
    .maybeSingle()
    .throwOnError();

  if (data || !createIfEmpty) return data;

  const { data: created, error: createError } = await client
    .from(PROFILE_TABLE)
    .insert({
      avatar_id: pickRandomAvatarId(),
      device_id: deviceId,
      player_name: generatePlayerName(),
    })
    .select("*")
    .single<CurrentUser>();

  if (createError || !created) {
    throw createError ?? new Error("Could not create player profile.");
  }

  return created;
};

export const getSession = async (sessionId: string): Promise<GameSession> => {
  if (!client) throw new Error("Supabase is not configured.");

  const { data } = await client
    .from(TABLE)
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle()
    .throwOnError();
  return data as GameSession;
};

export const requireSession = async (sessionId: string) => {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Session could not be found.");
  }
  return session;
};

export const listMySessions = async (
  deviceId = getCurrentDeviceId(),
): Promise<GameSession[]> => {
  if (!client) throw new Error("Supabase is not configured.");

  const { data } = await client
    .from(UNARCHIVED_TABLE)
    .select("*, memberships:session_memberships(device_id,archived_at)")
    .eq("session_memberships.device_id", deviceId)
    .order("updated_at", { ascending: false })
    .throwOnError();

  return data as GameSession[];
};

export const listOpenSessions = async (limit = 5): Promise<GameSession[]> => {
  if (!client) throw new Error("Supabase is not configured.");

  const { data } = await client
    .from(OPEN_TABLE)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit * 3, limit))
    .throwOnError();

  return data as GameSession[];
};

export const applyMove = async (
  sessionId: string,
  playerId: string,
  from: Position,
  to: Position,
) => {
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
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };
    return markPlayerSetupReady(currentRow.state, playerId);
  });

  return row.state!;
};

export const resetFinishedGame = async (sessionId: string, playerId: string) => {
  const memberships = await getSessionMemberships(sessionId);
  const initiator = await getProfile(
    getMemberByRole(memberships, "initiator")?.device_id,
  );
  const challenger = await getProfile(
    getMemberByRole(memberships, "challenger")?.device_id,
  );

  if (!initiator || !challenger) {
    throw new Error("Both player profiles are required to start a rematch.");
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
      nextState: createRematchState(
        currentRow.state,
        [initiator, challenger],
        gameRules,
        gamePieces,
      ),
    };
  });

  return row.state!;
};

export const closeFinishedGame = async (sessionId: string, playerId: string) => {
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
        ...(currentRow.state ?? {}),
        phase: "closed",
        turnPlayerId: null,
      },
    };
  });

  return row.state!;
};

export const surrenderGame = async (sessionId: string, playerId: string) => {
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
        completionReason: "surrender",
        finishedAt: getNowIsoString(),
        phase: "finished",
        surrenderedById: playerId,
        turnPlayerId: null,
        winnerId: winner?.id ?? null,
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
  if (!client) throw new Error("Supabase is not configured.");
  const trimmedText = text.trim();
  if (!trimmedText) throw new Error("Enter a message first.");

  const session = await requireSession(sessionId);
  if (!session.state) throw new Error("Waiting for challenger to join.");
  if (!session.state.players.some((player) => player.id === playerId)) {
    throw new Error("Unknown player.");
  }
  const sender = await getProfile(playerId);
  const senderName = sender?.player_name ?? "Commander";

  const messageId = options?.messageId ?? nanoid(10);
  const sentAt = options?.sentAt ?? getNowIsoString();
  const { error } = await client.from("session_chat_messages").insert({
    id: messageId,
    player_id: playerId,
    sender_name: senderName,
    sent_at: sentAt,
    session_id: sessionId,
    text: trimmedText,
  });
  if (error) throw error;

  return appendChatMessage(session.state, {
    id: messageId,
    playerId,
    senderName,
    sentAt,
    text: trimmedText,
    type: "player",
  });
};

export const subscribeToSession = (
  sessionId: string,
  onUpdate: (params: RealtimePostgresChangesPayload<GameSession>) => void,
) => {
  return withRegistry(
    `session:${sessionId}`,
    gameSessionRegistry,
    (handler) =>
      client
        .channel(`session:${sessionId}`)
        .on<GameSession>(
          "postgres_changes",
          {
            event: "*",
            filter: `session_id=eq.${sessionId}`,
            schema: "public",
            table: "game_sessions",
          },
          handler,
        )
        .subscribe(),
    onUpdate,
  );
};

export const subscribeToSessionMemberships = (
  sessionId: string,
  onUpdate: Listener<SessionMembership>,
) => {
  return withRegistry(
    `session-memberships:${sessionId}`,
    sessionMembershipRegistry,
    (handler) =>
      client
        .channel(`session-memberships:${sessionId}`)
        .on<SessionMembership>(
          "postgres_changes",
          {
            event: "*",
            filter: `session_id=eq.${sessionId}`,
            schema: "public",
            table: MEMBERSHIP_TABLE,
          },
          handler,
        )
        .subscribe(),
    onUpdate,
  );
};

function withRegistry<T extends Record<string, any>>(
  key: string,
  registry: Map<string, Entry<T>>,
  callback: (handler: Listener<T>) => RealtimeChannel,
  onUpdate: Listener<T>,
) {
  if (!client) return () => undefined;
  let entry = registry.get(key);

  if (!entry) {
    const listeners = new Set<Listener<T>>();
    entry = {
      channel: callback((payload) => {
        for (const listener of listeners) {
          listener(payload);
        }
      }),
      listeners,
    };

    registry.set(key, entry);
  }

  entry.listeners.add(onUpdate);

  return () => {
    const current = registry.get(key);
    if (!current) return;

    current.listeners.delete(onUpdate);

    if (current.listeners.size === 0) {
      client.removeChannel(current.channel);
      registry.delete(key);
    }
  };
}

export const subscribeToProfile = (
  deviceId: string,
  onUpdate: Listener<PlayerProfile>,
) => {
  return withRegistry<PlayerProfile>(
    `player-profiles:${deviceId}`,
    profileRegistry,
    (handler) =>
      client
        .channel(`player-profiles:${deviceId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            filter: `device_id=eq.${deviceId}`,
            schema: "public",
            table: PROFILE_TABLE,
          },
          handler,
        )
        .subscribe(),
    onUpdate,
  );
};

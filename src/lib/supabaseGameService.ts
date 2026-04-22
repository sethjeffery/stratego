import {
  createClient,
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { customAlphabet, nanoid } from "nanoid";

import type { GameChatMessage, GameState, Position } from "../shared/schema";
import type { Database } from "../types/database.types";

import {
  appendChatMessage,
  getChatMessages,
  removeChatMessage,
  sortAndLimitChatMessages,
} from "../shared/schema";
import {
  createAiPlayerConfig,
  createAiProfile,
  type CreateSessionOptions,
} from "./ai/config";
import {
  applyMoveToState,
  applySetupSwapToState,
  createOpenSessionState,
  createRematchState,
  createSessionGame,
  markPlayerSetupReady,
} from "./engine";
import { defaultGameSetupId, getGameSetup } from "./gameConfig";
import { getOrCreateStoredDeviceIdentity } from "./localSessionStore";
import {
  generatePlayerName,
  getMemberByRole,
  pickRandomAvatarId,
} from "./playerProfile";
import {
  resolveSessionParticipants,
  type SessionParticipant,
} from "./sessionParticipants";

export type CurrentUser = Database["public"]["Tables"]["player_profiles"]["Row"];
export type GameSession = Omit<
  Database["public"]["Tables"]["game_sessions"]["Row"],
  "state"
> & { state: GameState | null };
export type GameSessionDetails = Omit<
  Database["public"]["Tables"]["game_sessions"]["Row"],
  "state"
> & {
  challenger?: null | SessionParticipant;
  initiator?: null | SessionParticipant;
  memberships?: null | SessionParticipant[];
  state: GameState | null;
};
export type PlayerProfile = Database["public"]["Tables"]["player_profiles"]["Row"];

export type SessionChatMessage =
  Database["public"]["Tables"]["session_chat_messages"]["Row"];
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
const sessionChatRegistry = new Map<string, Entry<SessionChatMessage>>();

export type SessionAccess = {
  membership: null | SessionParticipant;
  session: SessionSummary;
};

export type SessionSummary = Omit<
  GameSessionDetails,
  "challenger" | "initiator" | "memberships"
> & {
  challenger: null | SessionParticipant;
  currentMembership: null | SessionParticipant;
  initiator: null | SessionParticipant;
  memberships: SessionParticipant[];
};

type SessionMembershipRow = {
  archived_at: null | string;
  device_id: string;
  role: SessionRole;
};

const SESSION_ROLE_ORDER: Record<SessionRole, number> = {
  challenger: 1,
  initiator: 0,
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
const OPEN_TABLE = "open_game_sessions";
const MEMBERSHIP_TABLE = "session_memberships";
const PROFILE_TABLE = "player_profiles";
const SESSION_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const createSessionCode = customAlphabet(SESSION_CODE_ALPHABET, 8);
const MAX_SESSION_UPDATE_ATTEMPTS = 4;
const MAX_SESSION_CHAT_MESSAGES = 12;

const getCurrentDeviceId = () => {
  return getOrCreateStoredDeviceIdentity().deviceId;
};

const getNowIsoString = () => new Date().toISOString();

const toPlayerChatMessage = (
  row: Pick<
    SessionChatMessage,
    "id" | "player_id" | "sender_name" | "sent_at" | "text"
  >,
): GameChatMessage => ({
  id: row.id,
  playerId: row.player_id,
  senderName: row.sender_name,
  sentAt: row.sent_at,
  text: row.text,
  type: "player",
});

const getBattleChatMessages = (state: GameState) =>
  getChatMessages(state).filter((message) => message.type === "battle");

const mergeSessionChatMessages = (
  session: GameSession,
  playerMessages: SessionChatMessage[],
): GameSession => {
  if (!session.state) return session;

  return {
    ...session,
    state: {
      ...session.state,
      chatMessages: sortAndLimitChatMessages(
        [
          ...getBattleChatMessages(session.state),
          ...playerMessages.map((message) => toPlayerChatMessage(message)),
        ],
        MAX_SESSION_CHAT_MESSAGES,
      ),
    },
  };
};

export const mergeCachedChatMessagesIntoSession = (
  session: GameSession,
  cachedSession?: GameSession | null,
): GameSession => {
  if (!session.state || !cachedSession?.state) return session;

  const cachedPlayerMessages = getChatMessages(cachedSession.state).filter(
    (message) => message.type === "player",
  );

  return {
    ...session,
    state: {
      ...session.state,
      chatMessages: sortAndLimitChatMessages(
        [...getBattleChatMessages(session.state), ...cachedPlayerMessages],
        MAX_SESSION_CHAT_MESSAGES,
      ),
    },
  };
};

export const applyChatMessageToSession = (
  session: GameSession,
  message: SessionChatMessage,
): GameSession => {
  if (!session.state) return session;

  return {
    ...session,
    state: appendChatMessage(
      session.state,
      toPlayerChatMessage(message),
      MAX_SESSION_CHAT_MESSAGES,
    ),
  };
};

export const removeChatMessageFromSession = (
  session: GameSession,
  messageId: string,
): GameSession => {
  if (!session.state) return session;

  return {
    ...session,
    state: removeChatMessage(session.state, messageId),
  };
};

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

export const createInitiatedSession = async (
  initiator: CurrentUser,
  options: CreateSessionOptions = {
    matchup: "human_vs_human",
    setupId: defaultGameSetupId,
  },
) => {
  if (!client) throw new Error("Supabase is not configured.");

  const sessionId = createSessionCode();
  const setupId = options.setupId ?? defaultGameSetupId;
  const shouldOpenLobby = options.matchup === "human_vs_human";
  const initialState = shouldOpenLobby
    ? createOpenSessionState(sessionId, setupId)
    : createSessionGame(
        {
          aiConfig:
            options.matchup === "ai_vs_ai"
              ? createAiPlayerConfig(options.initiatorAiIntelligence)
              : undefined,
          controller: options.matchup === "ai_vs_ai" ? "ai" : "human",
          profile:
            options.matchup === "ai_vs_ai"
              ? createAiProfile("initiator", options.initiatorAiIntelligence)
              : initiator,
        },
        {
          aiConfig:
            options.matchup === "human_vs_ai" || options.matchup === "ai_vs_ai"
              ? createAiPlayerConfig(options.challengerAiIntelligence)
              : undefined,
          controller:
            options.matchup === "human_vs_ai" || options.matchup === "ai_vs_ai"
              ? "ai"
              : "human",
          profile:
            options.matchup === "human_vs_ai" || options.matchup === "ai_vs_ai"
              ? createAiProfile("challenger", options.challengerAiIntelligence)
              : initiator,
        },
        getGameSetup(setupId),
        {
          challengerId: `challenger-${sessionId}`,
          initiatorId: initiator.device_id,
        },
      ).state;
  const state =
    options.matchup === "human_vs_ai"
      ? (markPlayerSetupReady(initialState, initialState.players[1]?.id ?? "")
          .nextState ?? initialState)
      : options.matchup === "ai_vs_ai"
        ? initialState.players.reduce(
            (nextState, player) =>
              markPlayerSetupReady(nextState, player.id).nextState ?? nextState,
            initialState,
          )
        : initialState;
  state.roomCode = sessionId;

  const { data, error } = await client
    .from("game_sessions")
    .insert({
      session_id: sessionId,
      state,
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
    challenger:
      resolveSessionParticipants({
        memberships: [
          {
            archived_at: null,
            device_id: initiator.device_id,
            role: "initiator",
          },
        ],
        profiles: [initiator],
        state,
      }).find(({ role }) => role === "challenger") ?? null,
    initiator:
      resolveSessionParticipants({
        memberships: [
          {
            archived_at: null,
            device_id: initiator.device_id,
            role: "initiator",
          },
        ],
        profiles: [initiator],
        state,
      }).find(({ role }) => role === "initiator") ?? null,
    memberships: resolveSessionParticipants({
      memberships: [
        {
          archived_at: null,
          device_id: initiator.device_id,
          role: "initiator",
        },
      ],
      profiles: [initiator],
      state,
    }),
  } as GameSessionDetails;
};

export const joinSessionAsCurrentUser = async (sessionId: string) => {
  if (!client) throw new Error("Supabase is not configured.");

  const currentUser = await getCurrentUser();
  const existingAccess = await getSession(sessionId);
  if (!existingAccess) {
    throw new Error("Session not found");
  }
  if (existingAccess.state?.phase !== "open") {
    throw new Error("Session is not open to new players.");
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

  const gameSetup = getGameSetup(existingAccess.state?.gameSetupId);
  const initialized = createSessionGame(
    {
      controller: "human",
      profile: initiator,
    },
    {
      controller: "human",
      profile: currentUser,
    },
    gameSetup,
    {
      challengerId: currentUser.device_id,
      initiatorId: initiator.device_id,
    },
  );
  initialized.state.roomCode = sessionId;
  await updateSessionState(sessionId, () => ({ nextState: initialized.state }));

  return getSession(sessionId);
};

export const archiveSession = async (
  sessionId: string,
  deviceId = getCurrentDeviceId(),
) => {
  if (!client) throw new Error("Supabase is not configured.");
  const session = await requireSession(sessionId);

  if (
    session.state &&
    session.state.phase !== "open" &&
    session.state.phase !== "finished" &&
    session.state.phase !== "closed"
  ) {
    throw new Error("You can only archive games that are complete or not started.");
  }

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

export const getSessionChatMessages = async (sessionId: string) => {
  if (!client) throw new Error("Supabase is not configured.");

  const { data } = await client
    .from("session_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("sent_at", { ascending: true })
    .throwOnError();

  return data as SessionChatMessage[];
};

export const getSession = async (sessionId: string): Promise<GameSession> => {
  if (!client) throw new Error("Supabase is not configured.");

  const [{ data: session }, chatMessages] = await Promise.all([
    client
      .from(TABLE)
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle()
      .throwOnError(),
    getSessionChatMessages(sessionId),
  ]);

  const nextSession = session as GameSession | null;
  if (!nextSession?.state) return nextSession as GameSession;

  return mergeSessionChatMessages(nextSession, chatMessages);
};

const hydrateSessionSummaries = async (
  sessions: GameSession[],
  currentDeviceId = getCurrentDeviceId(),
): Promise<SessionSummary[]> => {
  if (!client) throw new Error("Supabase is not configured.");
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map(({ session_id }) => session_id);
  const { data: memberships } = await client
    .from(MEMBERSHIP_TABLE)
    .select("*")
    .in("session_id", sessionIds)
    .throwOnError();

  const deviceIds = [...new Set((memberships ?? []).map(({ device_id }) => device_id))];
  const profiles =
    deviceIds.length === 0
      ? []
      : (
          await client
            .from(PROFILE_TABLE)
            .select("*")
            .in("device_id", deviceIds)
            .throwOnError()
        ).data;

  const membershipsBySessionId = new Map<string, SessionMembershipRow[]>();

  for (const membership of memberships ?? []) {
    const sessionMemberships = membershipsBySessionId.get(membership.session_id) ?? [];
    sessionMemberships.push({
      archived_at: membership.archived_at,
      device_id: membership.device_id,
      role: membership.role,
    });
    membershipsBySessionId.set(membership.session_id, sessionMemberships);
  }

  return sessions.map((session) => {
    const sessionMemberships = resolveSessionParticipants({
      memberships: membershipsBySessionId.get(session.session_id) ?? [],
      profiles: profiles ?? [],
      state: session.state,
    }).sort(
      (left, right) => SESSION_ROLE_ORDER[left.role] - SESSION_ROLE_ORDER[right.role],
    );

    return {
      ...session,
      challenger: sessionMemberships.find(({ role }) => role === "challenger") ?? null,
      currentMembership:
        sessionMemberships.find(({ device_id }) => device_id === currentDeviceId) ??
        null,
      initiator: sessionMemberships.find(({ role }) => role === "initiator") ?? null,
      memberships: sessionMemberships,
    };
  });
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
): Promise<SessionSummary[]> => {
  if (!client) throw new Error("Supabase is not configured.");

  const { data: memberships } = await client
    .from(MEMBERSHIP_TABLE)
    .select("session_id")
    .eq("device_id", deviceId)
    .is("archived_at", null)
    .throwOnError();

  const sessionIds = [
    ...new Set((memberships ?? []).map(({ session_id }) => session_id)),
  ];
  if (sessionIds.length === 0) {
    return [];
  }

  const { data } = await client
    .from(TABLE)
    .select("*")
    .in("session_id", sessionIds)
    .order("updated_at", { ascending: false })
    .throwOnError();

  return hydrateSessionSummaries((data ?? []) as GameSession[], deviceId);
};

export const listOpenSessions = async (
  limit = 5,
  deviceId = getCurrentDeviceId(),
): Promise<SessionSummary[]> => {
  if (!client) throw new Error("Supabase is not configured.");

  const { data: memberships } = await client
    .from(MEMBERSHIP_TABLE)
    .select("session_id")
    .eq("device_id", deviceId)
    .is("archived_at", null)
    .throwOnError();

  const sessionIds = [
    ...new Set((memberships ?? []).map(({ session_id }) => session_id)),
  ];

  const { data } = await client
    .from(OPEN_TABLE)
    .select("*")
    .notIn("session_id", sessionIds)
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit * 3, limit))
    .throwOnError();

  return hydrateSessionSummaries(
    ((data ?? []) as GameSession[]).filter(
      (session) => session.state?.phase === "open",
    ),
  );
};

export const applyMove = async (
  sessionId: string,
  playerId: string,
  from: Position,
  to: Position,
) => {
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };
    const gameSetup = getGameSetup(currentRow.state.gameSetupId);
    return applyMoveToState(
      currentRow.state,
      playerId,
      from,
      to,
      gameSetup.rules,
      gameSetup.pieces,
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
    const gameSetup = getGameSetup(currentRow.state.gameSetupId);

    return applySetupSwapToState(
      currentRow.state,
      playerId,
      from,
      to,
      gameSetup.rules,
      gameSetup.pieces,
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
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };
    if (!currentRow.state.players.some((player) => player.id === playerId)) {
      return { error: "Unknown player." };
    }
    if (currentRow.state.phase !== "finished") {
      return { error: "Game is not in completion phase." };
    }
    const gameSetup = getGameSetup(currentRow.state.gameSetupId);

    return {
      nextState: createRematchState(currentRow.state, gameSetup),
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

export const subscribeToSessions = (onUpdate: Listener<GameSession>) => {
  return withRegistry(
    "sessions",
    gameSessionRegistry,
    (handler) =>
      client
        .channel("sessions")
        .on<GameSession>(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: TABLE,
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

export const subscribeToMemberships = (onUpdate: Listener<SessionMembership>) => {
  return withRegistry(
    "session-memberships",
    sessionMembershipRegistry,
    (handler) =>
      client
        .channel("session-memberships")
        .on<SessionMembership>(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: MEMBERSHIP_TABLE,
          },
          handler,
        )
        .subscribe(),
    onUpdate,
  );
};

export const subscribeToSessionChatMessages = (
  sessionId: string,
  onUpdate: Listener<SessionChatMessage>,
) => {
  return withRegistry(
    `session-chat:${sessionId}`,
    sessionChatRegistry,
    (handler) =>
      client
        .channel(`session-chat:${sessionId}`)
        .on<SessionChatMessage>(
          "postgres_changes",
          {
            event: "*",
            filter: `session_id=eq.${sessionId}`,
            schema: "public",
            table: "session_chat_messages",
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

export const subscribeToProfiles = (onUpdate: Listener<PlayerProfile>) => {
  return withRegistry<PlayerProfile>(
    "player-profiles",
    profileRegistry,
    (handler) =>
      client
        .channel("player-profiles")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: PROFILE_TABLE,
          },
          handler,
        )
        .subscribe(),
    onUpdate,
  );
};

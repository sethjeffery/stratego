import { customAlphabet, nanoid } from "nanoid";

import { getSessionFixture } from "../fixtures/sessionFixtures";
import type { GameState, Position } from "../shared/schema";
import { appendChatMessage, normalizeGameState } from "../shared/schema";
import {
  applyMoveToState,
  applySetupSwapToState,
  createRematchState,
  createSessionGame,
  markPlayerSetupReady,
} from "./engine";
import { gamePieces, gameRules } from "./gameConfig";
import { generatePlayerName, pickRandomAvatarId } from "./playerProfile";
import type {
  CurrentUser,
  SessionRole,
  SessionRow,
  UserProfile,
} from "./supabaseGameService";

type MemorySessionSubscriber = (session: SessionRow) => void;

const SESSION_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const createSessionCode = customAlphabet(SESSION_CODE_ALPHABET, 8);

const memoryProfiles = new Map<string, CurrentUser>();
const memorySessions = new Map<string, SessionRow>();
const memorySubscribers = new Map<string, Set<MemorySessionSubscriber>>();

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const getNowIsoString = () => new Date().toISOString();

const toCurrentUser = (
  deviceId: string,
  profile: UserProfile,
  timestamp = getNowIsoString(),
): CurrentUser => ({
  avatar_id: profile.avatar_id,
  created_at: timestamp,
  device_id: deviceId,
  player_name: profile.player_name,
  updated_at: timestamp,
});

const sortSessionsByUpdatedAtDesc = (sessions: SessionRow[]) =>
  sessions.sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );

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

const notifySubscribers = (sessionId: string, session: SessionRow) => {
  const subscribers = memorySubscribers.get(sessionId);
  if (!subscribers?.size) return;

  const snapshot = cloneValue(session);
  subscribers.forEach((subscriber) => {
    subscriber(snapshot);
  });
};

const seedProfile = (
  deviceId: string,
  profile: UserProfile,
  timestamp = getNowIsoString(),
) => {
  const existing = memoryProfiles.get(deviceId);
  const next = existing
    ? {
        ...existing,
        avatar_id: profile.avatar_id,
        player_name: profile.player_name,
        updated_at: timestamp,
      }
    : toCurrentUser(deviceId, profile, timestamp);

  memoryProfiles.set(deviceId, next);
  return next;
};

const normalizeSession = (session: SessionRow): SessionRow => {
  const memberships = (session.memberships ?? []).map((membership) => ({
    ...membership,
    player: { ...membership.player },
  }));
  const initiator =
    memberships.find((membership) => membership.role === "initiator")?.player ??
    session.initiator ??
    null;
  const challenger =
    memberships.find((membership) => membership.role === "challenger")?.player ??
    session.challenger ??
    null;

  return {
    ...session,
    challenger,
    initiator,
    memberships,
    state: normalizeGameState(session.state),
  };
};

const commitSession = (session: SessionRow) => {
  const normalized = normalizeSession(session);

  normalized.memberships?.forEach((membership) => {
    seedProfile(membership.device_id, {
      avatar_id: membership.player.avatar_id,
      player_name: membership.player.player_name,
    });
  });

  if (normalized.initiator) {
    seedProfile(normalized.initiator.device_id, normalized.initiator);
  }
  if (normalized.challenger) {
    seedProfile(normalized.challenger.device_id, normalized.challenger);
  }

  memorySessions.set(normalized.session_id, normalized);
  notifySubscribers(normalized.session_id, normalized);
  return cloneValue(normalized);
};

const ensureCurrentUser = async (deviceId: string) => {
  const existing = memoryProfiles.get(deviceId);
  if (existing) return cloneValue(existing);

  const created = toCurrentUser(
    deviceId,
    {
      avatar_id: pickRandomAvatarId(),
      player_name: generatePlayerName(),
    },
    getNowIsoString(),
  );
  memoryProfiles.set(deviceId, created);
  return cloneValue(created);
};

const ensureInitializedSession = (session: SessionRow) => {
  if (session.state || !session.initiator || !session.challenger) {
    return session;
  }

  return {
    ...session,
    state: buildInitialSessionState(session),
    updated_at: getNowIsoString(),
  };
};

const updateMembership = (
  session: SessionRow,
  membership: {
    archived_at?: string | null;
    device_id: string;
    last_opened_at?: string | null;
    role: SessionRole;
  },
) => {
  const timestamp = getNowIsoString();
  const currentUser = memoryProfiles.get(membership.device_id);
  if (!currentUser) {
    throw new Error("Current player profile is not ready.");
  }

  const nextMembership = {
    archived_at: membership.archived_at ?? null,
    created_at:
      session.memberships?.find((entry) => entry.role === membership.role)
        ?.created_at ?? timestamp,
    device_id: membership.device_id,
    last_opened_at: membership.last_opened_at ?? timestamp,
    player: {
      avatar_id: currentUser.avatar_id,
      device_id: currentUser.device_id,
      player_name: currentUser.player_name,
    },
    role: membership.role,
    session_id: session.session_id,
    updated_at: timestamp,
  };

  const remainingMemberships = (session.memberships ?? []).filter(
    (entry) => entry.role !== membership.role,
  );

  return ensureInitializedSession({
    ...session,
    memberships: [...remainingMemberships, nextMembership],
    updated_at: timestamp,
  });
};

const updateSessionState = async (
  sessionId: string,
  buildNextState: (row: SessionRow) => { nextState?: GameState; error?: string },
) => {
  const current = await memoryGetSession(sessionId);
  const result = buildNextState(current);
  if (result.error || !result.nextState) {
    throw new Error(result.error ?? "Could not update session state.");
  }

  const next = commitSession({
    ...current,
    state: result.nextState,
    updated_at: getNowIsoString(),
  });

  return next;
};

export const ensureMemoryFixtureSession = (fixtureId: string) => {
  const fixture = getSessionFixture(fixtureId);
  if (!fixture) return null;

  const existing = memorySessions.get(fixture.session_id);
  if (existing) {
    return cloneValue(existing);
  }

  return commitSession(fixture);
};

export const memoryGetCurrentUser = async (deviceId: string) =>
  await ensureCurrentUser(deviceId);

export const memoryUpdateCurrentUserProfile = async (
  deviceId: string,
  profile: UserProfile,
) => {
  const timestamp = getNowIsoString();
  const currentUser = await ensureCurrentUser(deviceId);
  const next = {
    ...currentUser,
    avatar_id: profile.avatar_id,
    player_name: profile.player_name,
    updated_at: timestamp,
  };

  memoryProfiles.set(deviceId, next);
  return cloneValue(next);
};

export const memoryCreateInitiatedSession = async (initiator: CurrentUser) => {
  const sessionId = createSessionCode();
  const baseSession: SessionRow = {
    challenger: null,
    created_at: getNowIsoString(),
    initiator: {
      avatar_id: initiator.avatar_id,
      device_id: initiator.device_id,
      player_name: initiator.player_name,
    },
    memberships: [],
    session_id: sessionId,
    state: null,
    updated_at: getNowIsoString(),
  };

  const session = updateMembership(baseSession, {
    device_id: initiator.device_id,
    role: "initiator",
  });

  return commitSession(session);
};

export const memoryJoinSessionAsCurrentUser = async (
  sessionId: string,
  deviceId: string,
) => {
  const currentUser = await ensureCurrentUser(deviceId);
  const session = await memoryGetSession(sessionId);

  if (session.memberships?.some(({ archived_at }) => archived_at)) {
    throw new Error("Cannot join archived session");
  }

  const existingMembership = session.memberships?.find(
    (membership) => membership.device_id === currentUser.device_id,
  );
  if (existingMembership) {
    const reopened = updateMembership(session, {
      archived_at: null,
      device_id: currentUser.device_id,
      role: existingMembership.role,
    });
    return commitSession(reopened);
  }

  if (session.challenger && session.challenger.device_id !== currentUser.device_id) {
    throw new Error("Session is already full.");
  }

  if (!session.initiator) {
    throw new Error("Host of session not found.");
  }

  const joined = updateMembership(session, {
    device_id: currentUser.device_id,
    role: "challenger",
  });
  return commitSession(joined);
};

export const memoryArchiveSession = async (sessionId: string, deviceId: string) => {
  const session = await memoryGetSession(sessionId);
  const membership = session.memberships?.find((entry) => entry.device_id === deviceId);

  if (!membership) {
    throw new Error("Session membership not found.");
  }

  const archived = {
    ...session,
    memberships: session.memberships?.map((entry) =>
      entry.device_id === deviceId
        ? {
            ...entry,
            archived_at: getNowIsoString(),
            updated_at: getNowIsoString(),
          }
        : entry,
    ),
    updated_at: getNowIsoString(),
  };

  return commitSession(archived);
};

export const memoryGetSession = async (sessionId: string): Promise<SessionRow> => {
  const session = memorySessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }

  const initialized = ensureInitializedSession(session);
  if (initialized !== session) {
    return commitSession(initialized);
  }

  return cloneValue(session);
};

export const memoryListSessions = async (sessionIds: string[]) => {
  const sessions = await Promise.all(
    sessionIds.map(async (sessionId) => {
      try {
        return await memoryGetSession(sessionId);
      } catch {
        return null;
      }
    }),
  );

  return sortSessionsByUpdatedAtDesc(
    sessions.filter((session): session is SessionRow => Boolean(session)),
  );
};

export const memoryListMySessions = async (deviceId: string) =>
  sortSessionsByUpdatedAtDesc(
    Array.from(memorySessions.values())
      .filter((session) =>
        session.memberships?.some((membership) => membership.device_id === deviceId),
      )
      .map((session) => cloneValue(ensureInitializedSession(session))),
  );

export const memoryListOpenSessions = async (limit = 5) =>
  sortSessionsByUpdatedAtDesc(
    Array.from(memorySessions.values())
      .filter((session) => !session.challenger)
      .map((session) => cloneValue(ensureInitializedSession(session))),
  ).slice(0, limit);

export const memoryApplyMove = async (
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

export const memoryApplySetupSwap = async (
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

export const memoryMarkSetupReady = async (sessionId: string, playerId: string) => {
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };
    return markPlayerSetupReady(currentRow.state, playerId);
  });

  return row.state!;
};

export const memoryResetFinishedGame = async (sessionId: string, playerId: string) => {
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

export const memoryCloseFinishedGame = async (sessionId: string, playerId: string) => {
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

export const memorySurrenderGame = async (sessionId: string, playerId: string) => {
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

export const memorySendChatMessage = async (
  sessionId: string,
  playerId: string,
  text: string,
  options?: {
    messageId?: string;
    sentAt?: string;
  },
) => {
  const trimmedText = text.trim();
  if (!trimmedText) throw new Error("Enter a message first.");

  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: "Waiting for challenger to join." };

    const sender = currentRow.state.players.find((player) => player.id === playerId);
    if (!sender) return { error: "Unknown player." };

    return {
      nextState: appendChatMessage(currentRow.state, {
        id: options?.messageId ?? nanoid(10),
        playerId,
        senderName: sender.name,
        sentAt: options?.sentAt ?? getNowIsoString(),
        text: trimmedText,
        type: "player",
      }),
    };
  });

  return row.state!;
};

export const memorySubscribeToSession = (
  sessionId: string,
  onSession: (next: SessionRow) => void,
) => {
  const subscribers = memorySubscribers.get(sessionId) ?? new Set();
  subscribers.add(onSession);
  memorySubscribers.set(sessionId, subscribers);

  return () => {
    const currentSubscribers = memorySubscribers.get(sessionId);
    currentSubscribers?.delete(onSession);
    if (!currentSubscribers?.size) {
      memorySubscribers.delete(sessionId);
    }
  };
};

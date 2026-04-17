import { nanoid } from "nanoid";
import { DEFAULT_AVATAR_ID, PlayerProfile } from "./playerProfile";

export type StoredProfile = {
  deviceId: string;
  playerName: string;
  avatarId: string;
};

export type StoredSessionMembership = {
  sessionId: string;
  playerId: string;
  playerName: string;
  avatarId: string;
  role: "initiator" | "challenger";
  lastOpenedAt: number;
};

const PROFILE_KEY = "stratego:profile:v1";
const SESSIONS_KEY = "stratego:sessions:v1";

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const parseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const repairStoredProfile = (
  profile: Partial<StoredProfile> | null,
  defaults: PlayerProfile,
): StoredProfile | null => {
  if (!profile?.deviceId) return null;

  return {
    deviceId: profile.deviceId,
    playerName: profile.playerName || defaults.playerName,
    avatarId: profile.avatarId || defaults.avatarId,
  };
};

const repairStoredMembership = (
  membership: Partial<StoredSessionMembership>,
): StoredSessionMembership | null => {
  if (
    !membership.sessionId ||
    !membership.playerId ||
    !membership.playerName ||
    !membership.role
  ) {
    return null;
  }

  return {
    sessionId: membership.sessionId,
    playerId: membership.playerId,
    playerName: membership.playerName,
    avatarId: membership.avatarId || DEFAULT_AVATAR_ID,
    role: membership.role,
    lastOpenedAt: membership.lastOpenedAt ?? Date.now(),
  };
};

export const getOrCreateStoredProfile = (defaults: PlayerProfile): StoredProfile => {
  if (!canUseStorage()) {
    return { deviceId: nanoid(), ...defaults };
  }

  const existing = parseJson<StoredProfile | null>(
    window.localStorage.getItem(PROFILE_KEY),
    null,
  );
  const repaired = repairStoredProfile(existing, defaults);
  if (repaired) {
    if (
      repaired.playerName !== existing?.playerName ||
      repaired.avatarId !== existing?.avatarId
    ) {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(repaired));
    }
    return repaired;
  }

  const profile = { deviceId: nanoid(), ...defaults };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
};

export const setStoredProfile = (profile: PlayerProfile) => {
  if (!canUseStorage()) return;
  const existing = getOrCreateStoredProfile(profile);
  window.localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ ...existing, ...profile }),
  );
};

export const listStoredSessions = (): StoredSessionMembership[] => {
  if (!canUseStorage()) return [];

  const sessions = parseJson<Partial<StoredSessionMembership>[]>(
    window.localStorage.getItem(SESSIONS_KEY),
    [],
  )
    .map((session) => repairStoredMembership(session))
    .filter((session): session is StoredSessionMembership => Boolean(session));

  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  return sessions.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
};

export const updateStoredSessionMembershipProfile = (profile: PlayerProfile) => {
  if (!canUseStorage()) return [] as StoredSessionMembership[];

  const nextSessions = listStoredSessions().map((session) => ({
    ...session,
    playerName: profile.playerName,
    avatarId: profile.avatarId,
  }));

  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(nextSessions));
  return nextSessions;
};

export const getStoredSessionMembership = (
  sessionId: string,
): StoredSessionMembership | null =>
  listStoredSessions().find((session) => session.sessionId === sessionId) ??
  null;

export const upsertStoredSessionMembership = (
  membership: Omit<StoredSessionMembership, "lastOpenedAt"> & {
    lastOpenedAt?: number;
  },
) => {
  if (!canUseStorage()) return;

  const nextMembership: StoredSessionMembership = {
    ...membership,
    avatarId: membership.avatarId || DEFAULT_AVATAR_ID,
    lastOpenedAt: membership.lastOpenedAt ?? Date.now(),
  };

  const sessions = listStoredSessions().filter(
    (session) => session.sessionId !== membership.sessionId,
  );
  window.localStorage.setItem(
    SESSIONS_KEY,
    JSON.stringify([nextMembership, ...sessions].slice(0, 20)),
  );
};

export const touchStoredSessionMembership = (sessionId: string) => {
  const membership = getStoredSessionMembership(sessionId);
  if (!membership) return;
  upsertStoredSessionMembership({ ...membership, lastOpenedAt: Date.now() });
};

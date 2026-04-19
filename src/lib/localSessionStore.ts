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
  archivedAt?: number | null;
};

const PROFILE_KEY = "stratego:profile:v1";
const SESSIONS_KEY = "stratego:sessions:v1";

export type SessionStorageMode = "local" | "session" | "memory";

const storageModeFromEnv = (
  import.meta.env.VITE_SESSION_STORAGE_MODE as string | undefined
)?.toLowerCase();
export const sessionStorageMode: SessionStorageMode =
  storageModeFromEnv === "session"
    ? "session"
    : storageModeFromEnv === "memory"
      ? "memory"
      : "local";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const inMemoryStorage = new Map<string, string>();

const memoryStorage: StorageLike = {
  getItem: (key: string) => inMemoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    inMemoryStorage.set(key, value);
  },
};

const getStorage = (): StorageLike => {
  if (typeof window === "undefined") return memoryStorage;
  if (sessionStorageMode === "memory") return memoryStorage;
  if (sessionStorageMode === "session" && window.sessionStorage) {
    return window.sessionStorage;
  }
  return window.localStorage ?? memoryStorage;
};

const parseJson = <T>(raw: string | null, fallback: T): T => {
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
    archivedAt: membership.archivedAt ?? null,
  };
};

export const getOrCreateStoredProfile = (defaults: PlayerProfile): StoredProfile => {
  const storage = getStorage();

  const existing = parseJson<StoredProfile | null>(storage.getItem(PROFILE_KEY), null);
  const repaired = repairStoredProfile(existing, defaults);
  if (repaired) {
    if (
      repaired.playerName !== existing?.playerName ||
      repaired.avatarId !== existing?.avatarId
    ) {
      storage.setItem(PROFILE_KEY, JSON.stringify(repaired));
    }
    return repaired;
  }

  const profile = { deviceId: nanoid(), ...defaults };
  storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
};

export const setStoredProfile = (profile: PlayerProfile) => {
  const storage = getStorage();
  const existing = getOrCreateStoredProfile(profile);
  storage.setItem(PROFILE_KEY, JSON.stringify({ ...existing, ...profile }));
};

export const listStoredSessions = (): StoredSessionMembership[] => {
  const storage = getStorage();

  const sessions = parseJson<Partial<StoredSessionMembership>[]>(
    storage.getItem(SESSIONS_KEY),
    [],
  )
    .map((session) => repairStoredMembership(session))
    .filter((session): session is StoredSessionMembership => Boolean(session));

  storage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  return sessions.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
};

export const updateStoredSessionMembershipProfile = (profile: PlayerProfile) => {
  const storage = getStorage();

  const nextSessions = listStoredSessions().map((session) => ({
    ...session,
    playerName: profile.playerName,
    avatarId: profile.avatarId,
  }));

  storage.setItem(SESSIONS_KEY, JSON.stringify(nextSessions));
  return nextSessions;
};

export const getStoredSessionMembership = (
  sessionId: string,
): StoredSessionMembership | null =>
  listStoredSessions().find((session) => session.sessionId === sessionId) ?? null;

export const upsertStoredSessionMembership = (
  membership: Omit<StoredSessionMembership, "lastOpenedAt"> & {
    lastOpenedAt?: number;
  },
) => {
  const storage = getStorage();

  const nextMembership: StoredSessionMembership = {
    ...membership,
    avatarId: membership.avatarId || DEFAULT_AVATAR_ID,
    lastOpenedAt: membership.lastOpenedAt ?? Date.now(),
    archivedAt: membership.archivedAt ?? null,
  };

  const sessions = listStoredSessions().filter(
    (session) => session.sessionId !== membership.sessionId,
  );
  storage.setItem(
    SESSIONS_KEY,
    JSON.stringify([nextMembership, ...sessions].slice(0, 20)),
  );
};

export const touchStoredSessionMembership = (sessionId: string) => {
  const membership = getStoredSessionMembership(sessionId);
  if (!membership) return;
  upsertStoredSessionMembership({ ...membership, lastOpenedAt: Date.now() });
};

export const archiveStoredSessionMembership = (sessionId: string) => {
  const membership = getStoredSessionMembership(sessionId);
  if (!membership) return;
  upsertStoredSessionMembership({
    ...membership,
    archivedAt: Date.now(),
  });
};

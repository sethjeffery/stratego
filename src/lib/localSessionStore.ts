import { nanoid } from 'nanoid';

export type StoredProfile = {
  deviceId: string;
  playerName: string;
};

export type StoredSessionMembership = {
  sessionId: string;
  playerId: string;
  playerName: string;
  role: 'initiator' | 'challenger';
  lastOpenedAt: number;
};

const PROFILE_KEY = 'stratego:profile:v1';
const SESSIONS_KEY = 'stratego:sessions:v1';

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const getOrCreateStoredProfile = (defaultPlayerName: string): StoredProfile => {
  if (!canUseStorage()) {
    return { deviceId: nanoid(), playerName: defaultPlayerName };
  }

  const existing = parseJson<StoredProfile | null>(window.localStorage.getItem(PROFILE_KEY), null);
  if (existing?.deviceId) {
    if (existing.playerName) return existing;
    const repaired = { ...existing, playerName: defaultPlayerName };
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(repaired));
    return repaired;
  }

  const profile = { deviceId: nanoid(), playerName: defaultPlayerName };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
};

export const setStoredPlayerName = (playerName: string) => {
  if (!canUseStorage()) return;
  const profile = getOrCreateStoredProfile(playerName);
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, playerName }));
};

export const listStoredSessions = (): StoredSessionMembership[] => {
  if (!canUseStorage()) return [];

  const sessions = parseJson<StoredSessionMembership[]>(window.localStorage.getItem(SESSIONS_KEY), []);
  return sessions.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
};

export const getStoredSessionMembership = (sessionId: string): StoredSessionMembership | null =>
  listStoredSessions().find((session) => session.sessionId === sessionId) ?? null;

export const upsertStoredSessionMembership = (
  membership: Omit<StoredSessionMembership, 'lastOpenedAt'> & { lastOpenedAt?: number },
) => {
  if (!canUseStorage()) return;

  const nextMembership: StoredSessionMembership = {
    ...membership,
    lastOpenedAt: membership.lastOpenedAt ?? Date.now(),
  };

  const sessions = listStoredSessions().filter((session) => session.sessionId !== membership.sessionId);
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify([nextMembership, ...sessions].slice(0, 20)));
};

export const touchStoredSessionMembership = (sessionId: string) => {
  const membership = getStoredSessionMembership(sessionId);
  if (!membership) return;
  upsertStoredSessionMembership({ ...membership, lastOpenedAt: Date.now() });
};

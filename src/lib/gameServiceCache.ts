import { getConfiguredPlayerSessionStorageMode } from "../app/runtimeConfig";

const SESSION_KEY = "/api/session";
const SESSION_MEMBERSHIPS_KEY = "/api/session-memberships";
const PROFILE_KEY = "/api/profile";

export const getGameServiceCacheScope = () => {
  return [getConfiguredPlayerSessionStorageMode()].join(":");
};

export const getSessionCacheKey = (sessionId: null | string, cacheScope?: string) =>
  sessionId &&
  ([SESSION_KEY, cacheScope ?? getGameServiceCacheScope(), sessionId] as const);

export const getSessionMembershipsCacheKey = (
  sessionId: null | string,
  cacheScope?: string,
) =>
  sessionId &&
  ([
    SESSION_MEMBERSHIPS_KEY,
    cacheScope ?? getGameServiceCacheScope(),
    sessionId,
  ] as const);

export const getProfileCacheKey = (deviceId?: null | string, cacheScope?: string) =>
  deviceId
    ? ([PROFILE_KEY, cacheScope ?? getGameServiceCacheScope(), deviceId] as const)
    : null;

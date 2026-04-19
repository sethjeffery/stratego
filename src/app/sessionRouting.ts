import { SESSION_QUERY_PARAM } from "./constants";

export { isDebugBoardEnabled } from "./runtimeConfig";

export const normalizeSessionId = (sessionId: string) => sessionId.trim().toUpperCase();

export const buildSearchWithoutLegacySession = (search: string) => {
  const nextParams = new URLSearchParams(search);
  nextParams.delete(SESSION_QUERY_PARAM);
  return nextParams.toString() ? `?${nextParams.toString()}` : "";
};

export const buildGamePath = (sessionId: string) =>
  `/game/${normalizeSessionId(sessionId)}`;

export const buildSessionUrl = (sessionId: string) => {
  if (typeof window === "undefined") {
    return `${buildGamePath(sessionId)}`;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = buildGamePath(sessionId);
  return nextUrl.toString();
};

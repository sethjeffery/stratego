import { DEBUG_BOARD_PARAM, SESSION_QUERY_PARAM } from "./constants";

export const normalizeSessionId = (sessionId: string) => sessionId.trim().toUpperCase();

export const getSessionIdFromSearch = (search: string) => {
  const value = new URLSearchParams(search).get(SESSION_QUERY_PARAM);
  return value ? normalizeSessionId(value) : "";
};

export const buildSearchWithoutLegacySession = (search: string) => {
  const nextParams = new URLSearchParams(search);
  nextParams.delete(SESSION_QUERY_PARAM);
  return nextParams.toString() ? `?${nextParams.toString()}` : "";
};

export const isDebugBoardEnabled = (search: string) => {
  const value = new URLSearchParams(search).get(DEBUG_BOARD_PARAM);
  return value === "1" || value === "true";
};

export const buildGamePath = (sessionId: string) =>
  `/game/${normalizeSessionId(sessionId)}`;

import {
  DEBUG_BOARD_PARAM,
  DEBUG_FIXTURE_PARAM,
  DEBUG_PLAYER_ROLE_PARAM,
  SESSION_QUERY_PARAM,
} from "./constants";

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

export const getSessionFixtureIdFromSearch = (search: string) =>
  new URLSearchParams(search).get(DEBUG_FIXTURE_PARAM)?.trim() ?? "";

export const getSessionFixtureRoleFromSearch = (
  search: string,
): "initiator" | "challenger" => {
  const role = new URLSearchParams(search).get(DEBUG_PLAYER_ROLE_PARAM);
  return role === "challenger" ? "challenger" : "initiator";
};

export const buildGamePath = (sessionId: string) =>
  `/game/${normalizeSessionId(sessionId)}`;

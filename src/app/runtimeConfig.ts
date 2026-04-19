import { DEFAULT_SESSION_FIXTURE_ID } from "../fixtures/sessionFixtures";
import type { SessionRole } from "../lib/supabaseGameService";
import {
  DEBUG_BOARD_PARAM,
  DEBUG_SESSION_FIXTURE_PARAM,
  DEBUG_SESSION_ROLE_PARAM,
} from "./constants";

export type PlayerSessionStorageMode = "localStorage" | "sessionStorage" | "memory";

export type GameServiceMode = "supabase" | "memory";

const STORAGE_MODE_ALIASES: Record<string, PlayerSessionStorageMode> = {
  local: "localStorage",
  localstorage: "localStorage",
  memory: "memory",
  session: "sessionStorage",
  sessionstorage: "sessionStorage",
};

const GAME_SERVICE_MODE_ALIASES: Record<string, GameServiceMode> = {
  memory: "memory",
  supabase: "supabase",
};

const getNormalizedValue = (value: string | undefined | null) =>
  value?.trim().toLowerCase() ?? "";

const getWindowSearch = () =>
  typeof window === "undefined" ? "" : window.location.search;

const hasDebugFixtureParam = (search = getWindowSearch()) =>
  Boolean(new URLSearchParams(search).get(DEBUG_SESSION_FIXTURE_PARAM)?.trim());

export const isDebugBoardEnabled = (search = getWindowSearch()) => {
  const value = new URLSearchParams(search).get(DEBUG_BOARD_PARAM);
  return value === "1" || value === "true";
};

export const getConfiguredPlayerSessionStorageMode = (): PlayerSessionStorageMode => {
  const rawValue = getNormalizedValue(import.meta.env.VITE_PLAYER_SESSION_STORAGE);
  return STORAGE_MODE_ALIASES[rawValue] ?? "localStorage";
};

export const getRequestedGameServiceMode = (): GameServiceMode | null => {
  const rawValue = getNormalizedValue(import.meta.env.VITE_GAME_SERVICE_MODE);
  return GAME_SERVICE_MODE_ALIASES[rawValue] ?? null;
};

export const getDebugSessionRole = (search = getWindowSearch()): SessionRole => {
  const rawValue = getNormalizedValue(
    new URLSearchParams(search).get(DEBUG_SESSION_ROLE_PARAM),
  );
  return rawValue === "challenger" ? "challenger" : "initiator";
};

export const getDebugSessionFixtureId = (search = getWindowSearch()) =>
  new URLSearchParams(search).get(DEBUG_SESSION_FIXTURE_PARAM)?.trim() ??
  DEFAULT_SESSION_FIXTURE_ID;

export const getDebugSessionSelection = (search = getWindowSearch()) => {
  if (!isDebugBoardEnabled(search) && !hasDebugFixtureParam(search)) return null;

  return {
    fixtureId: getDebugSessionFixtureId(search),
    role: getDebugSessionRole(search),
  };
};

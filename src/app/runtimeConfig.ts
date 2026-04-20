export type GameServiceMode = "memory" | "supabase";

export type PlayerSessionStorageMode = "localStorage" | "memory" | "sessionStorage";

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

const getNormalizedValue = (value: null | string | undefined) =>
  value?.trim().toLowerCase() ?? "";

export const getConfiguredPlayerSessionStorageMode = (): PlayerSessionStorageMode => {
  const rawValue = getNormalizedValue(import.meta.env.VITE_PLAYER_SESSION_STORAGE);
  return STORAGE_MODE_ALIASES[rawValue] ?? "localStorage";
};

export const getRequestedGameServiceMode = (): GameServiceMode | null => {
  const rawValue = getNormalizedValue(import.meta.env.VITE_GAME_SERVICE_MODE);
  return GAME_SERVICE_MODE_ALIASES[rawValue] ?? null;
};

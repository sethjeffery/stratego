/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAME_SERVICE_MODE?: "memory" | "supabase";
  readonly VITE_PLAYER_SESSION_STORAGE?:
    | "local"
    | "localStorage"
    | "memory"
    | "session"
    | "sessionStorage";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

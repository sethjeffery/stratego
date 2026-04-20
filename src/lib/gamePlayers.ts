import type { GameState } from "../shared/schema";
import type { GameSessionDetails } from "./supabaseGameService";

import { getMemberByRole } from "./playerProfile";

export type GameDisplayPlayer = {
  avatarId?: string;
  connected: boolean;
  id: string;
  name: string;
};

const getFallbackName = (index: number) =>
  index === 0 ? "Commander Red" : "Commander Blue";

export const getGameDisplayPlayers = (
  state: GameState | null,
  memberships?: GameSessionDetails["memberships"],
): GameDisplayPlayer[] => {
  if (!state) return [];

  return state.players.map((player, index) => {
    const membership =
      memberships?.find((item) => item.device_id === player.id) ??
      (index === 0
        ? getMemberByRole(memberships, "initiator")
        : getMemberByRole(memberships, "challenger")) ??
      null;
    const profile = membership?.profile ?? null;

    return {
      avatarId: profile?.avatar_id,
      connected: player.connected,
      id: player.id,
      name: profile?.player_name ?? getFallbackName(index),
    };
  });
};

export const getDisplayPlayerById = (
  players: GameDisplayPlayer[],
  playerId?: null | string,
) => players.find((player) => player.id === playerId) ?? null;

export const getOtherDisplayPlayer = (
  players: GameDisplayPlayer[],
  myId?: null | string,
) => players.find((player) => player.id !== myId) ?? null;

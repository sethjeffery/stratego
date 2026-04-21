import type { GameState } from "../shared/schema";
import type { SessionParticipant } from "./sessionParticipants";

import { getPlayerController } from "../shared/schema";
import { getMemberByRole } from "./playerProfile";

export type GameDisplayPlayer = {
  avatarId?: string;
  connected: boolean;
  controller: "ai" | "human";
  id: string;
  isAi: boolean;
  name: string;
};

const getFallbackName = (index: number) =>
  index === 0 ? "Commander Red" : "Commander Blue";

export const getGameDisplayPlayers = (
  state: GameState | null,
  memberships?: null | SessionParticipant[],
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
    const controller = getPlayerController(player);

    return {
      avatarId: profile?.avatar_id ?? membership?.avatar_id ?? player.avatarId,
      connected: player.connected,
      controller,
      id: player.id,
      isAi: controller === "ai",
      name:
        profile?.player_name ??
        membership?.player_name ??
        player.displayName ??
        getFallbackName(index),
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

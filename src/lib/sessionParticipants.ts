import type { GameState, PlayerState } from "../shared/schema";
import type { Database } from "../types/database.types";

import { getPlayerController } from "../shared/schema";

type SessionRole = Database["public"]["Enums"]["session_role"];
const SESSION_ROLE_ORDER: Record<SessionRole, number> = {
  challenger: 1,
  initiator: 0,
};

export type SessionParticipant = {
  archived_at: null | string;
  avatar_id: string;
  controller: "ai" | "human";
  device_id: string;
  is_ai: boolean;
  player_name: string;
  profile?: null | PlayerProfileLike;
  role: SessionRole;
};

type PlayerProfileLike = {
  avatar_id: string;
  device_id: string;
  player_name: string;
};

type SessionMembershipLike = {
  archived_at: null | string;
  device_id: string;
  role: SessionRole;
};

const roleByIndex = (index: number): SessionRole =>
  index === 0 ? "initiator" : "challenger";

const fallbackName = (index: number) =>
  index === 0 ? "Commander Red" : "Commander Blue";

const toParticipantFromPlayer = (
  player: PlayerState,
  index: number,
  membership?: SessionMembershipLike,
  profile?: PlayerProfileLike,
): SessionParticipant => {
  const controller = getPlayerController(player);
  const resolvedProfile = controller === "human" ? profile : null;

  return {
    archived_at: membership?.archived_at ?? null,
    avatar_id: resolvedProfile?.avatar_id ?? player.avatarId ?? "",
    controller,
    device_id: player.id,
    is_ai: controller === "ai",
    player_name:
      resolvedProfile?.player_name ?? player.displayName ?? fallbackName(index),
    profile: resolvedProfile ?? null,
    role: membership?.role ?? roleByIndex(index),
  };
};

const toParticipantFromMembership = (
  membership: SessionMembershipLike,
  profile?: PlayerProfileLike,
): SessionParticipant => ({
  archived_at: membership.archived_at,
  avatar_id: profile?.avatar_id ?? "",
  controller: "human",
  device_id: membership.device_id,
  is_ai: false,
  player_name: profile?.player_name ?? "Unknown player",
  profile: profile ?? null,
  role: membership.role,
});

export const resolveSessionParticipants = ({
  memberships,
  profiles,
  state,
}: {
  memberships?: null | SessionMembershipLike[];
  profiles?: null | PlayerProfileLike[];
  state?: GameState | null;
}): SessionParticipant[] => {
  const profileByDeviceId = new Map(
    (profiles ?? []).map((profile) => [profile.device_id, profile]),
  );
  const membershipByRole = new Map(
    (memberships ?? []).map((membership) => [membership.role, membership]),
  );

  if (state?.players?.length) {
    return state.players.slice(0, 2).map((player, index) =>
      toParticipantFromPlayer(
        player,
        index,
        membershipByRole.get(roleByIndex(index)),
        profileByDeviceId.get(player.id),
      ),
    );
  }

  return [...(memberships ?? [])]
    .sort((left, right) => SESSION_ROLE_ORDER[left.role] - SESSION_ROLE_ORDER[right.role])
    .map((membership) =>
      toParticipantFromMembership(
        membership,
        profileByDeviceId.get(membership.device_id),
      ),
    );
};

export const getSessionParticipantById = (
  participants?: null | SessionParticipant[],
  playerId?: null | string,
) => participants?.find((participant) => participant.device_id === playerId) ?? null;

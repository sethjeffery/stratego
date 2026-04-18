import { StoredSessionMembership } from "../../lib/localSessionStore";
import { DEFAULT_AVATAR_ID } from "../../lib/playerProfile";
import { SessionRow } from "../../lib/supabaseGameService";
import { PlayerState } from "../../shared/schema";

export const formatSessionTimestamp = (timestamp?: string | number) => {
  if (!timestamp) return "Unknown activity";
  return new Date(timestamp).toLocaleString();
};

export const getSessionPlayers = (
  row?: SessionRow,
  membership?: StoredSessionMembership,
): PlayerState[] => {
  if (row?.state?.players.length) {
    return row.state.players;
  }

  if (row) {
    return [
      {
        id: row.initiator_id,
        name: row.initiator_name,
        avatarId: row.initiator_avatar ?? DEFAULT_AVATAR_ID,
        connected: true,
      },
      ...(row.challenger_id && row.challenger_name
        ? [
            {
              id: row.challenger_id,
              name: row.challenger_name,
              avatarId: row.challenger_avatar ?? DEFAULT_AVATAR_ID,
              connected: true,
            },
          ]
        : []),
    ];
  }

  if (!membership) return [];

  return [
    {
      id: membership.playerId,
      name: membership.playerName,
      avatarId: membership.avatarId,
      connected: true,
    },
  ];
};

export const getCompletionLabel = (
  row: SessionRow,
  membership: StoredSessionMembership,
  players: PlayerState[],
) => {
  const winner = players.find((player) => player.id === row.state?.winnerId);
  if (!winner) return "Completed";

  const surrenderedById = row.state?.surrenderedById;
  if (surrenderedById) {
    if (surrenderedById === membership.playerId) {
      return "You surrendered";
    }
    return `${winner.name} won by surrender`;
  }

  return `${winner.name} won`;
};

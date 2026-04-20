import type { CurrentUser, GameSessionDetails } from "../../lib/supabaseGameService";

import { getMemberById } from "../../lib/playerProfile";

export const formatSessionTimestamp = (timestamp?: number | string) => {
  if (!timestamp) return "Unknown activity";
  return new Date(timestamp).toLocaleString();
};

export const getCompletionLabel = (
  row: GameSessionDetails,
  currentUser: CurrentUser,
) => {
  const winner = getMemberById(row.memberships, row.state?.winnerId);
  if (!winner) return "Completed";

  const surrenderedById = row.state?.surrenderedById;
  if (surrenderedById) {
    if (surrenderedById === currentUser.device_id) {
      return "You surrendered";
    }
    return `${winner.profile?.player_name} won by surrender`;
  }

  return currentUser.device_id === winner.device_id
    ? "You won"
    : `${winner.profile?.player_name} won`;
};

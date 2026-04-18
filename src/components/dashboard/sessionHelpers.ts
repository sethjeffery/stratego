import type { CurrentUser, SessionRow } from "../../lib/supabaseGameService";

export const formatSessionTimestamp = (timestamp?: string | number) => {
  if (!timestamp) return "Unknown activity";
  return new Date(timestamp).toLocaleString();
};

export const getCompletionLabel = (row: SessionRow, currentUser: CurrentUser) => {
  const winner = row.memberships?.find(
    (player) => player.device_id === row.state?.winnerId,
  );
  if (!winner) return "Completed";

  const surrenderedById = row.state?.surrenderedById;
  if (surrenderedById) {
    if (surrenderedById === currentUser.device_id) {
      return "You surrendered";
    }
    return `${winner.player.player_name} won by surrender`;
  }

  return currentUser.device_id === winner.device_id
    ? "You won"
    : `${winner.player.player_name} won`;
};

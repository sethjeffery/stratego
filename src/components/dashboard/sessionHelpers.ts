import type { GameSessionDetails, SessionSummary } from "../../lib/supabaseGameService";

import { getMemberById } from "../../lib/playerProfile";

export type SessionOutcomeIcon = "active" | "flag" | "medal" | "skull";

export const formatSessionTimestamp = (timestamp?: number | string) => {
  if (!timestamp) return "Unknown activity";
  return new Date(timestamp).toLocaleString();
};

export const getSessionPlayerName = (
  participant?: null | {
    player_name?: null | string;
    profile?: null | {
      player_name?: null | string;
    };
  },
) => participant?.profile?.player_name ?? participant?.player_name ?? "Unknown player";

export const canArchiveSession = (
  row: Pick<GameSessionDetails | SessionSummary, "state">,
) =>
  !row.state ||
  row.state.phase === "open" ||
  row.state.phase === "finished" ||
  row.state.phase === "closed";

export const getCompletionSummary = (
  row: GameSessionDetails | SessionSummary,
  currentDeviceId?: null | string,
): { icon: null | SessionOutcomeIcon; text: string } => {
  if (row.state?.phase === "finished" && !row.state.winnerId) {
    return {
      icon: "skull",
      text: "Draw",
    };
  }

  const winner = getMemberById(row.memberships, row.state?.winnerId);
  if (!winner) {
    return {
      icon: null,
      text: "Completed",
    };
  }
  const winnerName = getSessionPlayerName(winner);

  const surrenderedById = row.state?.surrenderedById;
  if (surrenderedById) {
    if (surrenderedById === currentDeviceId) {
      return {
        icon: "flag",
        text: "You surrendered",
      };
    }
    const surrenderedPlayer = getMemberById(row.memberships, surrenderedById);

    return {
      icon: "flag",
      text: `${getSessionPlayerName(surrenderedPlayer) ?? winnerName} surrendered`,
    };
  }

  return currentDeviceId === winner.device_id
    ? {
        icon: "medal",
        text: "You won",
      }
    : {
        icon: "skull",
        text: "You lost",
      };
};

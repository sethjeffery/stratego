import { HourglassIcon, PlayIcon, SmileySadIcon } from "@phosphor-icons/react";
import clsx from "clsx";

import { useCurrentUser } from "../../hooks/useProfile";
import type { SessionRow } from "../../lib/supabaseGameService";
import type { MainStatus } from "./gameScreenSelectors";
import styles from "./GameStatus.module.css";

const statusMessage = ({
  status,
  otherPlayerName,
}: {
  status: MainStatus;
  otherPlayerName: string;
}) => {
  switch (status) {
    case "active":
      return (
        <>
          <PlayIcon size={14} />
          Your turn
        </>
      );
    case "archived":
      return "Game is archived";
    case "loser":
      return (
        <>
          <SmileySadIcon size={16} />
          You lost
        </>
      );
    case "setup":
      return (
        <>
          <PlayIcon size={14} />
          Set up your pieces
        </>
      );
    case "waiting":
      return (
        <>
          <HourglassIcon size={16} />
          Waiting for {otherPlayerName}...
        </>
      );
    case "winner":
      return "You won";
  }
};

export function GameStatus({
  status,
  session,
}: {
  status: MainStatus;
  session: SessionRow;
}) {
  const { data: currentUser } = useCurrentUser();
  const otherPlayerName =
    session.memberships?.find(
      (membership) => membership.device_id !== currentUser?.device_id,
    )?.player.player_name ?? "";

  return (
    <div className={clsx(styles.statusLozenge, styles[status])}>
      {statusMessage({ status, otherPlayerName })}
    </div>
  );
}

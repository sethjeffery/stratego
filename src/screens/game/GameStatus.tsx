import {
  ArchiveIcon,
  HandPointingIcon,
  HourglassIcon,
  MedalIcon,
  PlayIcon,
  SkullIcon,
} from "@phosphor-icons/react";
import clsx from "clsx";

import type { MainStatus } from "./gameScreenSelectors";

import styles from "./GameStatus.module.css";

const statusMessage = ({
  otherPlayerName,
  status,
}: {
  otherPlayerName: string;
  status: MainStatus;
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
      return (
        <>
          <ArchiveIcon size={16} />
          Game is archived
        </>
      );
    case "draw":
      return (
        <>
          <SkullIcon size={16} />
          Draw
        </>
      );
    case "loser":
      return (
        <>
          <SkullIcon size={16} />
          You lost
        </>
      );
    case "setup":
      return (
        <>
          <HandPointingIcon size={16} />
          Set up your pieces
        </>
      );
    case "thinking":
      return (
        <>
          <HourglassIcon size={16} />
          AI is thinking
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
      return (
        <>
          <MedalIcon size={16} />
          You won
        </>
      );
  }
};

export function GameStatus({
  otherPlayerName,
  status,
}: {
  otherPlayerName: string;
  status: MainStatus;
}) {
  return (
    <div className={clsx(styles.statusLozenge, styles[status])}>
      {statusMessage({ otherPlayerName, status })}
    </div>
  );
}

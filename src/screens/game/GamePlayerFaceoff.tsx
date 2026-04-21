import type { GameDisplayPlayer } from "../../lib/gamePlayers";

import { Avatar } from "../../components/ui";
import { resolveAvatarUrl } from "../../lib/playerProfile";
import styles from "./GameSurface.module.css";

type GamePlayerFaceoffProps = {
  players: GameDisplayPlayer[];
  turnPlayerId: null | string;
};

export function GamePlayerFaceoff({ players, turnPlayerId }: GamePlayerFaceoffProps) {
  return (
    <div className={styles.gameFaceoff}>
      {players.slice(0, 2).map((player, index) => (
        <div className={styles.gameFaceoffSlot} key={player.id}>
          {index === 1 && <div className={styles.gameVersus}>vs</div>}
          <div className={styles.gamePlayer}>
            <Avatar
              alt={player.name}
              avatarUrl={resolveAvatarUrl(player.avatarId)}
              className={styles.gamePlayerAvatar}
              color={index === 0 ? "red" : "blue"}
              pulsing={player.id === turnPlayerId}
              title={player.name}
            />
            <div className={styles.gamePlayerName}>{player.name}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

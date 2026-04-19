import Avatar from "../../components/Avatar";
import { resolveAvatarUrl } from "../../lib/playerProfile";
import type { GameState } from "../../shared/schema";
import styles from "./GameSurface.module.css";

type GamePlayerFaceoffProps = {
  players: GameState["players"];
  turnPlayerId: string | null;
};

export function GamePlayerFaceoff({
  players,
  turnPlayerId,
}: GamePlayerFaceoffProps) {
  return (
    <div className={styles.gameFaceoff}>
      {players.slice(0, 2).map((player, index) => (
        <div key={player.id} className={styles.gameFaceoffSlot}>
          {index === 1 && <div className={styles.gameVersus}>vs</div>}
          <div className={styles.gamePlayer}>
            <Avatar
              avatarUrl={resolveAvatarUrl(player.avatarId)}
              alt={player.name}
              title={player.name}
              pulsing={player.id === turnPlayerId}
              color={index === 0 ? "red" : "blue"}
              className={styles.gamePlayerAvatar}
            />
            <div className={styles.gamePlayerName}>{player.name}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

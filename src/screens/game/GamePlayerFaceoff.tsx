import Avatar from "../../components/Avatar";
import { resolveAvatarUrl } from "../../lib/playerProfile";
import type { GameState } from "../../shared/schema";

type GamePlayerFaceoffProps = {
  players: GameState["players"];
  turnPlayerId: string | null;
};

export function GamePlayerFaceoff({
  players,
  turnPlayerId,
}: GamePlayerFaceoffProps) {
  return (
    <div className="game-faceoff">
      {players.slice(0, 2).map((player, index) => (
        <div key={player.id} className="game-faceoff-slot">
          {index === 1 && <div className="game-versus">vs</div>}
          <div className="game-player">
            <Avatar
              avatarUrl={resolveAvatarUrl(player.avatarId)}
              alt={player.name}
              title={player.name}
              pulsing={player.id === turnPlayerId}
              color={index === 0 ? "red" : "blue"}
              className="game-player-avatar"
            />
            <div className="game-player-name">{player.name}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

import type { GameDisplayPlayer } from "../../lib/gamePlayers";
import type {
  GameChatMessage,
  GameState,
  PieceDefinition,
  Unit,
} from "../../shared/schema";

import { GameChatDock } from "./GameChatDock";
import { GamePiecePanel } from "./GamePiecePanel";
import { GamePlayerFaceoff } from "./GamePlayerFaceoff";
import { GameSetupActions } from "./GameSetupActions";
import styles from "./GameSurface.module.css";

type GameSidebarProps = {
  canMarkReady: boolean;
  canSendChat: boolean;
  inspectedPiece: null | PieceDefinition;
  inspectedPieceTraits: string[];
  inspectedUnit: null | Unit;
  inspectedVisible: boolean;
  messages: GameChatMessage[];
  myId: null | string;
  onMarkReady: () => Promise<void> | void;
  onSendMessage: (message: string) => Promise<void>;
  players: GameDisplayPlayer[];
  state: GameState;
};

export function GameSidebar({
  canMarkReady,
  canSendChat,
  inspectedPiece,
  inspectedPieceTraits,
  inspectedUnit,
  inspectedVisible,
  messages,
  myId,
  onMarkReady,
  onSendMessage,
  players,
  state,
}: GameSidebarProps) {
  const playerOneId = state.players[0]?.id ?? null;

  return (
    <aside className={styles.gameSidebar}>
      <div className={styles.gameSidebarMain}>
        <GamePlayerFaceoff players={players} turnPlayerId={state.turnPlayerId} />

        <GamePiecePanel
          inspectedPiece={inspectedPiece}
          inspectedPieceTraits={inspectedPieceTraits}
          inspectedUnit={inspectedUnit}
          inspectedVisible={inspectedVisible}
        />

        <GameSetupActions canMarkReady={canMarkReady} onMarkReady={onMarkReady} />
      </div>

      <GameChatDock
        canSendChat={canSendChat}
        messages={messages}
        myId={myId}
        onSendMessage={onSendMessage}
        playerOneId={playerOneId}
        roomCode={state.roomCode}
      />
    </aside>
  );
}

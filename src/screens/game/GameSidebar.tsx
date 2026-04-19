import type { GameChatMessage, GameState, PieceDefinition, Unit } from "../../shared/schema";
import { GameChatDock } from "./GameChatDock";
import { GamePiecePanel } from "./GamePiecePanel";
import { GamePlayerFaceoff } from "./GamePlayerFaceoff";
import { GameSetupActions } from "./GameSetupActions";

type GameSidebarProps = {
  canMarkReady: boolean;
  canSendChat: boolean;
  inspectedPiece: PieceDefinition | null;
  inspectedPieceTraits: string[];
  inspectedUnit: Unit | null;
  inspectedVisible: boolean;
  messages: GameChatMessage[];
  myId: string | null;
  onMarkReady: () => void | Promise<void>;
  onSendMessage: (message: string) => Promise<void>;
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
  state,
}: GameSidebarProps) {
  const playerOneId = state.players[0]?.id ?? null;

  return (
    <aside className="game-sidebar">
      <div className="game-sidebar-main">
        <GamePlayerFaceoff
          players={state.players}
          turnPlayerId={state.turnPlayerId}
        />

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

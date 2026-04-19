import clsx from "clsx";
import { useState } from "react";

import { Button } from "../components/Button";
import type { SessionRow } from "../lib/supabaseGameService";
import { GameBoardSection } from "./game/GameBoardSection";
import { GameCompletionModal } from "./game/GameCompletionModal";
import { GameLoadingState } from "./game/GameLoadingState";
import {
  getCompletionCopy,
  getCompletionStats,
  getInspectedPieceState,
  getMainStatus,
} from "./game/gameScreenSelectors";
import { GameSidebar } from "./game/GameSidebar";
import styles from "./game/GameSurface.module.css";
import { GameSurrenderModal } from "./game/GameSurrenderModal";
import { GameToolbar } from "./game/GameToolbar";
import { useGameScreenController } from "./game/useGameScreenController";

export function GameScreen({ session }: { session: SessionRow }) {
  const [surrenderConfirmVisible, setSurrenderConfirmVisible] = useState(false);
  const {
    archived,
    canMarkReady,
    canSendChat,
    disabled,
    finishGame,
    isMyTurn,
    legalTargets,
    leaveCurrentSession,
    markReady,
    myId,
    onCellClick,
    pendingBoardAction,
    playAgain,
    selectablePieceKeys,
    selected,
    sendChatMessage,
    state,
    surrenderGame,
  } = useGameScreenController(session);

  if (!state) {
    return (
      <GameLoadingState onLeave={leaveCurrentSession} sessionId={session.session_id} />
    );
  }

  const { inspectedPiece, inspectedPieceTraits, inspectedUnit, inspectedVisible } =
    getInspectedPieceState(state, selected, myId);
  const { completionDescription, completionTitle, winner } = getCompletionCopy(state);
  const completionStats = getCompletionStats(state);
  const mainStatus = getMainStatus({
    archived,
    canMarkReady,
    isMyTurn,
    myId,
    state,
  });
  const completionVisible = state.phase === "finished" && Boolean(winner);
  const isClosed = state.phase === "closed";
  const playerOneId = state.players[0]?.id ?? null;
  const canSurrender =
    !archived && state.phase !== "finished" && state.phase !== "closed";

  return (
    <main className={styles.arenaShell}>
      <section className={styles.arenaMain}>
        <GameToolbar
          canSurrender={canSurrender}
          session={session}
          mainStatus={mainStatus}
          onLeave={leaveCurrentSession}
          onRequestSurrender={() => setSurrenderConfirmVisible(true)}
        />

        {archived && (
          <section className={clsx("card", styles.archivedBanner)}>
            <p>This game is archived and disabled on this device.</p>
            <Button variant="secondary" onClick={leaveCurrentSession}>
              Return to lobby
            </Button>
          </section>
        )}

        <GameBoardSection
          disabled={disabled}
          legalTargets={legalTargets}
          myId={myId}
          onCellClick={onCellClick}
          pendingBoardAction={pendingBoardAction}
          selectablePieceKeys={selectablePieceKeys}
          selected={selected}
          state={state}
        />
      </section>

      <GameSidebar
        canMarkReady={canMarkReady}
        canSendChat={canSendChat}
        inspectedPiece={inspectedPiece}
        inspectedPieceTraits={inspectedPieceTraits}
        inspectedUnit={inspectedUnit}
        inspectedVisible={inspectedVisible}
        messages={state.chatMessages}
        myId={myId}
        onMarkReady={markReady}
        onSendMessage={sendChatMessage}
        state={state}
      />

      {completionVisible && (
        <GameCompletionModal
          completionDescription={completionDescription}
          completionStats={completionStats}
          completionTitle={completionTitle}
          isClosed={isClosed}
          onFinish={finishGame}
          onPlayAgain={playAgain}
          playerOneId={playerOneId}
          winner={winner}
        />
      )}

      {surrenderConfirmVisible && (
        <GameSurrenderModal
          onCancel={() => setSurrenderConfirmVisible(false)}
          onConfirm={() =>
            surrenderGame().then(() => {
              setSurrenderConfirmVisible(false);
            })
          }
        />
      )}
    </main>
  );
}

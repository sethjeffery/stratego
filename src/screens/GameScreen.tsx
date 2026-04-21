import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import type { GameSessionDetails } from "../lib/supabaseGameService";
import type { BattleChatMessage } from "../shared/schema";

import { Button } from "../components/ui";
import { getGameDisplayPlayers, getOtherDisplayPlayer } from "../lib/gamePlayers";
import { GameAttackAnimation } from "./game/GameAttackAnimation";
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

export function GameScreen({ session }: { session: GameSessionDetails }) {
  const [surrenderConfirmVisible, setSurrenderConfirmVisible] = useState(false);
  const [attackAnimationBattle, setAttackAnimationBattle] =
    useState<BattleChatMessage | null>(null);
  const animatedMoveCountRef = useRef<null | number>(null);
  const attackAnimationTimeoutRef = useRef<null | number>(null);
  const {
    archived,
    canMarkReady,
    canSendChat,
    disabled,
    finishGame,
    isMyTurn,
    leaveCurrentSession,
    legalTargets,
    markReady,
    myId,
    onCellClick,
    playAgain,
    selectablePieceKeys,
    selected,
    sendChatMessage,
    state,
    surrenderGame,
  } = useGameScreenController(session);

  useEffect(() => {
    if (!state?.lastBattle) return;

    if (animatedMoveCountRef.current === null) {
      animatedMoveCountRef.current = state.moveCount;
      return;
    }

    if (animatedMoveCountRef.current === state.moveCount) return;

    const latestBattleMessage =
      [...state.chatMessages]
        .reverse()
        .find((message) => message.type === "battle" && message.battle)?.battle ?? null;

    if (!latestBattleMessage) {
      animatedMoveCountRef.current = state.moveCount;
      return;
    }

    animatedMoveCountRef.current = state.moveCount;
    setAttackAnimationBattle(latestBattleMessage);

    if (attackAnimationTimeoutRef.current !== null) {
      window.clearTimeout(attackAnimationTimeoutRef.current);
    }

    attackAnimationTimeoutRef.current = window.setTimeout(() => {
      setAttackAnimationBattle(null);
      attackAnimationTimeoutRef.current = null;
    }, 2400);
  }, [state]);

  useEffect(
    () => () => {
      if (attackAnimationTimeoutRef.current !== null) {
        window.clearTimeout(attackAnimationTimeoutRef.current);
      }
    },
    [],
  );

  if (!state) {
    return (
      <GameLoadingState onLeave={leaveCurrentSession} sessionId={session.session_id} />
    );
  }

  const { inspectedPiece, inspectedPieceTraits, inspectedUnit, inspectedVisible } =
    getInspectedPieceState(state, selected, myId);
  const displayPlayers = getGameDisplayPlayers(state, session.memberships);
  const otherPlayerName =
    getOtherDisplayPlayer(displayPlayers, myId)?.name ?? "the opponent";
  const { completionDescription, completionTitle, isDraw, winner } = getCompletionCopy(
    state,
    displayPlayers,
    myId,
  );
  const completionStats = getCompletionStats(state);
  const mainStatus = getMainStatus({
    archived,
    isAiTurn: Boolean(
      state.turnPlayerId &&
      state.players.find((player) => player.id === state.turnPlayerId)?.controller ===
        "ai",
    ),
    isMyTurn,
    isReady: state?.setupReadyPlayerIds.includes(myId ?? ""),
    myId,
    state,
  });
  const completionVisible = state.phase === "finished";
  const isClosed = state.phase === "closed";
  const playerOneId = state.players[0]?.id ?? null;
  const canSurrender =
    !archived && state.phase !== "finished" && state.phase !== "closed";

  return (
    <main className={styles.arenaShell}>
      <section className={styles.arenaMain}>
        <GameToolbar
          canSurrender={canSurrender}
          mainStatus={mainStatus}
          onLeave={leaveCurrentSession}
          onRequestSurrender={() => setSurrenderConfirmVisible(true)}
          otherPlayerName={otherPlayerName}
        />

        {archived && (
          <section className={clsx("card", styles.archivedBanner)}>
            <p>This game is archived and disabled on this device.</p>
            <Button onClick={leaveCurrentSession} variant="secondary">
              Return to lobby
            </Button>
          </section>
        )}

        <GameBoardSection
          disabled={disabled}
          legalTargets={legalTargets}
          myId={myId}
          onCellClick={onCellClick}
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
        players={displayPlayers}
        state={state}
      />

      {attackAnimationBattle && (
        <GameAttackAnimation battle={attackAnimationBattle} playerOneId={playerOneId} />
      )}

      {completionVisible && (
        <GameCompletionModal
          completionDescription={completionDescription}
          completionStats={completionStats}
          completionTitle={completionTitle}
          isClosed={isClosed}
          isDraw={isDraw}
          onFinish={finishGame}
          onPlayAgain={playAgain}
          playerOneId={playerOneId}
          winnerColor={
            winner ? (state.players[0].id === winner.id ? "red" : "blue") : undefined
          }
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

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { SessionRole } from "../../lib/supabaseGameService";
import type { Position } from "../../shared/schema";

import { Button } from "../../components/Button";
import {
  getDefaultSessionFixture,
  getFixturePlayerForRole,
  getSessionFixture,
} from "../../fixtures/sessionFixtures";
import { getGameDisplayPlayers, getOtherDisplayPlayer } from "../../lib/gamePlayers";
import { GameBoardSection } from "./GameBoardSection";
import { getInspectedPieceState, getMainStatus } from "./gameScreenSelectors";
import { GameSidebar } from "./GameSidebar";
import styles from "./GameSurface.module.css";
import { GameToolbar } from "./GameToolbar";

type FixtureDebugGameScreenProps = {
  fixtureId: null | string;
  role: SessionRole;
};

export function FixtureDebugGameScreen({
  fixtureId,
  role,
}: FixtureDebugGameScreenProps) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<null | Position>(null);
  const session = useMemo(
    () => (fixtureId ? getSessionFixture(fixtureId) : getDefaultSessionFixture()),
    [fixtureId],
  );

  if (!session?.state) {
    return (
      <main className={styles.arenaShell}>
        <section className={styles.arenaMain}>
          <section className={`${styles.archivedBanner} card`}>
            <p>Fixture `{fixtureId ?? "default"}` could not be loaded.</p>
            <Button onClick={() => navigate("/")}>Return to lobby</Button>
          </section>
        </section>
      </main>
    );
  }

  const myId = getFixturePlayerForRole(fixtureId ?? "", role)?.device_id ?? null;
  const displayPlayers = getGameDisplayPlayers(session.state, session.memberships);
  const otherPlayerName =
    getOtherDisplayPlayer(displayPlayers, myId)?.name ?? "the opponent";
  const mainStatus = getMainStatus({
    archived: false,
    isMyTurn: session.state.turnPlayerId === myId,
    isReady: session.state.setupReadyPlayerIds.includes(myId ?? ""),
    myId,
    state: session.state,
  });
  const { inspectedPiece, inspectedPieceTraits, inspectedUnit, inspectedVisible } =
    getInspectedPieceState(session.state, selected, myId);

  const onCellClick = (target: Position) => {
    const nextUnit = session.state?.units.find(
      (unit) => unit.x === target.x && unit.y === target.y,
    );

    setSelected((current) => {
      if (!nextUnit) {
        return null;
      }

      if (current?.x === target.x && current.y === target.y) {
        return null;
      }

      return target;
    });
  };

  return (
    <main className={styles.arenaShell}>
      <section className={styles.arenaMain}>
        <GameToolbar
          canSurrender={false}
          mainStatus={mainStatus}
          onLeave={() => navigate("/")}
          onRequestSurrender={() => undefined}
          otherPlayerName={otherPlayerName}
        />

        <GameBoardSection
          disabled
          legalTargets={[]}
          myId={myId}
          onCellClick={onCellClick}
          selectablePieceKeys={new Set<string>()}
          selected={selected}
          state={session.state}
        />
      </section>

      <GameSidebar
        canMarkReady={false}
        canSendChat={false}
        inspectedPiece={inspectedPiece}
        inspectedPieceTraits={inspectedPieceTraits}
        inspectedUnit={inspectedUnit}
        inspectedVisible={inspectedVisible}
        messages={session.state.chatMessages}
        myId={myId}
        onMarkReady={() => undefined}
        onSendMessage={async () => undefined}
        players={displayPlayers}
        state={session.state}
      />
    </main>
  );
}

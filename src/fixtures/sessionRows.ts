import { createSessionGame } from "../lib/engine";
import { gamePieces, gameRules } from "../lib/gameConfig";
import type { SessionRow } from "../lib/supabaseGameService";

export type SessionFixture = {
  id: string;
  label: string;
  description: string;
  session: SessionRow;
};

const NOW = "2026-01-01T00:00:00.000Z";

const createBaseFixture = (
  sessionId: string,
  initiatorId: string,
  challengerId: string,
): SessionRow => {
  const seeded = createSessionGame(
    { playerName: "Commander Vega", avatarId: "char03" },
    { playerName: "Marshal Rook", avatarId: "char09" },
    gameRules,
    gamePieces,
    {
      initiatorId,
      challengerId,
    },
  );

  return {
    session_id: sessionId,
    state: {
      ...seeded.state,
      roomCode: sessionId,
    },
    initiator_name: "Commander Vega",
    initiator_avatar: "char03",
    challenger_name: "Marshal Rook",
    challenger_avatar: "char09",
    initiator_id: initiatorId,
    challenger_id: challengerId,
    created_at: NOW,
    updated_at: NOW,
  };
};

const setupSkirmish = createBaseFixture("FIXSETUP", "fx-init-001", "fx-chal-001");
const setupSkirmishState = setupSkirmish.state!;
setupSkirmish.state = {
  ...setupSkirmishState,
  phase: "setup",
  setupReadyPlayerIds: [setupSkirmish.initiator_id],
  turnPlayerId: null,
  moveCount: 0,
};

const battlePreview = createBaseFixture("FIXBATTLE", "fx-init-002", "fx-chal-002");
const battlePreviewState = battlePreview.state!;
battlePreview.state = {
  ...battlePreviewState,
  phase: "battle",
  setupReadyPlayerIds: [battlePreview.initiator_id, battlePreview.challenger_id!],
  turnPlayerId: battlePreview.initiator_id,
  startedAt: "2026-01-01T00:02:00.000Z",
  moveCount: 6,
};

const finishedSurrender = createBaseFixture("FIXEND01", "fx-init-003", "fx-chal-003");
const finishedSurrenderState = finishedSurrender.state!;
finishedSurrender.state = {
  ...finishedSurrenderState,
  phase: "finished",
  setupReadyPlayerIds: [
    finishedSurrender.initiator_id,
    finishedSurrender.challenger_id!,
  ],
  turnPlayerId: null,
  moveCount: 14,
  startedAt: "2026-01-01T00:02:00.000Z",
  finishedAt: "2026-01-01T00:11:00.000Z",
  winnerId: finishedSurrender.initiator_id,
  completionReason: "surrender",
  surrenderedById: finishedSurrender.challenger_id,
};

export const sessionFixtures: SessionFixture[] = [
  {
    id: "setup_skirmish",
    label: "Setup Skirmish",
    description: "Setup phase with initiator already marked ready.",
    session: setupSkirmish,
  },
  {
    id: "battle_preview",
    label: "Battle Preview",
    description: "Battle phase with both players ready and active turn state.",
    session: battlePreview,
  },
  {
    id: "finished_surrender",
    label: "Finished Surrender",
    description: "Finished game where challenger surrendered.",
    session: finishedSurrender,
  },
];

export const getSessionFixture = (fixtureId: string) =>
  sessionFixtures.find((fixture) => fixture.id === fixtureId) ?? null;

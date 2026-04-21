import type { SessionParticipant } from "../lib/sessionParticipants";
import type {
  CurrentUser,
  GameSessionDetails,
  SessionRole,
  UserDeviceProfile,
} from "../lib/supabaseGameService";
import type { GameState } from "../shared/schema";

const DEFAULT_TIMESTAMP = "2026-04-19T09:00:00.000Z";

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const createProfile = (
  deviceId: string,
  playerName: string,
  avatarId: string,
): CurrentUser => ({
  avatar_id: avatarId,
  created_at: DEFAULT_TIMESTAMP,
  device_id: deviceId,
  player_name: playerName,
  updated_at: DEFAULT_TIMESTAMP,
});

const fixtureProfiles = {
  aurora: createProfile("fixture-aurora", "Scout Aurora", "char08"),
  ember: createProfile("fixture-ember", "Commander Ember", "char01"),
  grove: createProfile("fixture-grove", "Captain Grove", "char16"),
  slate: createProfile("fixture-slate", "Marshal Slate", "char20"),
} as const;

const createMembership = (
  sessionId: string,
  role: SessionRole,
  player: UserDeviceProfile,
  options?: {
    archivedAt?: null | string;
    createdAt?: string;
    lastOpenedAt?: string;
    updatedAt?: string;
  },
): SessionParticipant => ({
  archived_at: options?.archivedAt ?? null,
  avatar_id: player.avatar_id,
  controller: "human",
  device_id: player.device_id,
  is_ai: false,
  player_name: player.player_name,
  profile: {
    avatar_id: player.avatar_id,
    device_id: player.device_id,
    player_name: player.player_name,
  },
  role,
});

const createSessionState = (
  roomCode: string,
  players: [UserDeviceProfile, UserDeviceProfile],
  state: Omit<GameState, "gameSetupId" | "players" | "roomCode">,
): GameState => ({
  ...state,
  gameSetupId: "quick-game",
  players: players.map((player) => ({
    avatarId: player.avatar_id,
    connected: true,
    controller: "human",
    displayName: player.player_name,
    id: player.device_id,
  })),
  roomCode,
});

const waitingForChallengerSessionId = "FXOPEN01";
const setupDuelSessionId = "FXSETUP1";
const openingSkirmishSessionId = "FXSKRM01";
const finishedFlagSessionId = "FXDONE01";

const waitingForChallenger = {
  challenger: null,
  created_at: DEFAULT_TIMESTAMP,
  initiator: createMembership(
    waitingForChallengerSessionId,
    "initiator",
    fixtureProfiles.ember,
  ),
  memberships: [
    createMembership(waitingForChallengerSessionId, "initiator", fixtureProfiles.ember),
  ],
  session_id: waitingForChallengerSessionId,
  state: null,
  updated_at: "2026-04-19T09:05:00.000Z",
} satisfies GameSessionDetails;

const setupDuel = {
  challenger: createMembership(
    setupDuelSessionId,
    "challenger",
    fixtureProfiles.slate,
  ),
  created_at: DEFAULT_TIMESTAMP,
  initiator: createMembership(
    setupDuelSessionId,
    "initiator",
    fixtureProfiles.ember,
  ),
  memberships: [
    createMembership(setupDuelSessionId, "initiator", fixtureProfiles.ember),
    createMembership(setupDuelSessionId, "challenger", fixtureProfiles.slate),
  ],
  session_id: setupDuelSessionId,
  state: createSessionState(
    setupDuelSessionId,
    [fixtureProfiles.ember, fixtureProfiles.slate],
    {
      chatMessages: [
        {
          id: "setup-chat-1",
          playerId: fixtureProfiles.ember.device_id,
          senderName: fixtureProfiles.ember.player_name,
          sentAt: "2026-04-19T09:09:00.000Z",
          text: "Ready when you are.",
          type: "player",
        },
      ],
      completionReason: "flag_capture",
      finishedAt: null,
      moveCount: 0,
      phase: "setup",
      setupReadyPlayerIds: [fixtureProfiles.ember.device_id],
      startedAt: null,
      surrenderedById: null,
      turnPlayerId: null,
      units: [
        {
          id: "ember-flag-0",
          ownerId: fixtureProfiles.ember.device_id,
          pieceId: "flag",
          revealedTo: [fixtureProfiles.ember.device_id],
          x: 0,
          y: 9,
        },
        {
          id: "ember-bomb-0",
          ownerId: fixtureProfiles.ember.device_id,
          pieceId: "bomb",
          revealedTo: [fixtureProfiles.ember.device_id],
          x: 1,
          y: 9,
        },
        {
          id: "ember-captain-0",
          ownerId: fixtureProfiles.ember.device_id,
          pieceId: "captain",
          revealedTo: [fixtureProfiles.ember.device_id],
          x: 2,
          y: 8,
        },
        {
          id: "ember-scout-0",
          ownerId: fixtureProfiles.ember.device_id,
          pieceId: "scout",
          revealedTo: [fixtureProfiles.ember.device_id],
          x: 3,
          y: 8,
        },
        {
          id: "slate-flag-0",
          ownerId: fixtureProfiles.slate.device_id,
          pieceId: "flag",
          revealedTo: [fixtureProfiles.slate.device_id],
          x: 9,
          y: 0,
        },
        {
          id: "slate-bomb-0",
          ownerId: fixtureProfiles.slate.device_id,
          pieceId: "bomb",
          revealedTo: [fixtureProfiles.slate.device_id],
          x: 8,
          y: 0,
        },
        {
          id: "slate-major-0",
          ownerId: fixtureProfiles.slate.device_id,
          pieceId: "major",
          revealedTo: [fixtureProfiles.slate.device_id],
          x: 7,
          y: 1,
        },
        {
          id: "slate-scout-0",
          ownerId: fixtureProfiles.slate.device_id,
          pieceId: "scout",
          revealedTo: [fixtureProfiles.slate.device_id],
          x: 6,
          y: 1,
        },
      ],
      winnerId: null,
    },
  ),
  updated_at: "2026-04-19T09:10:00.000Z",
} satisfies GameSessionDetails;

const openingSkirmish = {
  challenger: createMembership(
    openingSkirmishSessionId,
    "challenger",
    fixtureProfiles.grove,
  ),
  created_at: DEFAULT_TIMESTAMP,
  initiator: createMembership(
    openingSkirmishSessionId,
    "initiator",
    fixtureProfiles.aurora,
  ),
  memberships: [
    createMembership(openingSkirmishSessionId, "initiator", fixtureProfiles.aurora),
    createMembership(openingSkirmishSessionId, "challenger", fixtureProfiles.grove),
  ],
  session_id: openingSkirmishSessionId,
  state: createSessionState(
    openingSkirmishSessionId,
    [fixtureProfiles.aurora, fixtureProfiles.grove],
    {
      chatMessages: [
        {
          battle: {
            attackerOwnerId: fixtureProfiles.aurora.device_id,
            attackerPieceId: "miner",
            defenderOwnerId: fixtureProfiles.grove.device_id,
            defenderPieceId: "sergeant",
            winner: "attacker",
          },
          id: "battle-1",
          sentAt: "2026-04-19T09:14:00.000Z",
          type: "battle",
        },
        {
          id: "chat-1",
          playerId: fixtureProfiles.grove.device_id,
          senderName: fixtureProfiles.grove.player_name,
          sentAt: "2026-04-19T09:15:00.000Z",
          text: "Center lane is open.",
          type: "player",
        },
      ],
      completionReason: "flag_capture",
      finishedAt: null,
      lastBattle: {
        at: { x: 5, y: 6 },
        attackerPieceId: "miner",
        defenderPieceId: "sergeant",
        winner: "attacker",
        winnerOwnerId: fixtureProfiles.aurora.device_id,
      },
      moveCount: 7,
      phase: "battle",
      setupReadyPlayerIds: [
        fixtureProfiles.aurora.device_id,
        fixtureProfiles.grove.device_id,
      ],
      startedAt: "2026-04-19T09:12:00.000Z",
      surrenderedById: null,
      turnPlayerId: fixtureProfiles.grove.device_id,
      units: [
        {
          id: "aurora-flag-0",
          ownerId: fixtureProfiles.aurora.device_id,
          pieceId: "flag",
          revealedTo: [fixtureProfiles.aurora.device_id],
          x: 0,
          y: 9,
        },
        {
          id: "aurora-miner-0",
          ownerId: fixtureProfiles.aurora.device_id,
          pieceId: "miner",
          revealedTo: [
            fixtureProfiles.aurora.device_id,
            fixtureProfiles.grove.device_id,
          ],
          x: 5,
          y: 6,
        },
        {
          id: "aurora-scout-0",
          ownerId: fixtureProfiles.aurora.device_id,
          pieceId: "scout",
          revealedTo: [fixtureProfiles.aurora.device_id],
          x: 4,
          y: 7,
        },
        {
          id: "aurora-captain-0",
          ownerId: fixtureProfiles.aurora.device_id,
          pieceId: "captain",
          revealedTo: [fixtureProfiles.aurora.device_id],
          x: 3,
          y: 8,
        },
        {
          id: "grove-flag-0",
          ownerId: fixtureProfiles.grove.device_id,
          pieceId: "flag",
          revealedTo: [fixtureProfiles.grove.device_id],
          x: 9,
          y: 0,
        },
        {
          id: "grove-major-0",
          ownerId: fixtureProfiles.grove.device_id,
          pieceId: "major",
          revealedTo: [fixtureProfiles.grove.device_id],
          x: 5,
          y: 3,
        },
        {
          id: "grove-scout-0",
          ownerId: fixtureProfiles.grove.device_id,
          pieceId: "scout",
          revealedTo: [fixtureProfiles.grove.device_id],
          x: 8,
          y: 2,
        },
        {
          id: "grove-bomb-0",
          ownerId: fixtureProfiles.grove.device_id,
          pieceId: "bomb",
          revealedTo: [fixtureProfiles.grove.device_id],
          x: 7,
          y: 1,
        },
      ],
      winnerId: null,
    },
  ),
  updated_at: "2026-04-19T09:16:00.000Z",
} satisfies GameSessionDetails;

const finishedFlag = {
  challenger: createMembership(
    finishedFlagSessionId,
    "challenger",
    fixtureProfiles.slate,
  ),
  created_at: DEFAULT_TIMESTAMP,
  initiator: createMembership(
    finishedFlagSessionId,
    "initiator",
    fixtureProfiles.ember,
  ),
  memberships: [
    createMembership(finishedFlagSessionId, "initiator", fixtureProfiles.ember),
    createMembership(finishedFlagSessionId, "challenger", fixtureProfiles.slate),
  ],
  session_id: finishedFlagSessionId,
  state: createSessionState(
    finishedFlagSessionId,
    [fixtureProfiles.ember, fixtureProfiles.slate],
    {
      chatMessages: [
        {
          id: "finish-chat-1",
          playerId: fixtureProfiles.slate.device_id,
          senderName: fixtureProfiles.slate.player_name,
          sentAt: "2026-04-19T09:24:00.000Z",
          text: "Good game.",
          type: "player",
        },
      ],
      completionReason: "flag_capture",
      finishedAt: "2026-04-19T09:23:30.000Z",
      moveCount: 18,
      phase: "finished",
      setupReadyPlayerIds: [
        fixtureProfiles.ember.device_id,
        fixtureProfiles.slate.device_id,
      ],
      startedAt: "2026-04-19T09:18:00.000Z",
      surrenderedById: null,
      turnPlayerId: null,
      units: [
        {
          id: "ember-marshal-0",
          ownerId: fixtureProfiles.ember.device_id,
          pieceId: "marshal",
          revealedTo: [
            fixtureProfiles.ember.device_id,
            fixtureProfiles.slate.device_id,
          ],
          x: 8,
          y: 0,
        },
      ],
      winnerId: fixtureProfiles.ember.device_id,
    },
  ),
  updated_at: "2026-04-19T09:24:00.000Z",
} satisfies GameSessionDetails;

export const DEFAULT_SESSION_FIXTURE_ID = "opening-skirmish";

const sessionFixtures = {
  "finished-flag": finishedFlag,
  "opening-skirmish": openingSkirmish,
  "setup-duel": setupDuel,
  "waiting-for-challenger": waitingForChallenger,
} as const satisfies Record<string, GameSessionDetails>;

export type SessionFixtureId = keyof typeof sessionFixtures;

export const listSessionFixtureIds = () => Object.keys(sessionFixtures);

export const getSessionFixture = (fixtureId: string) => {
  const normalizedFixtureId = fixtureId.trim().toLowerCase() as SessionFixtureId;
  const fixture = sessionFixtures[normalizedFixtureId];
  return fixture ? cloneValue(fixture) : null;
};

export const getDefaultSessionFixture = () =>
  getSessionFixture(DEFAULT_SESSION_FIXTURE_ID);

export const getFixturePlayerForRole = (
  fixtureId: string,
  role: SessionRole,
): null | UserDeviceProfile => {
  const fixture = getSessionFixture(fixtureId);
  if (!fixture) return null;

  return role === "challenger"
    ? (fixture.challenger ?? null)
    : (fixture.initiator ?? null);
};

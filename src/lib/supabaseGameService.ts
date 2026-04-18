import { createClient } from '@supabase/supabase-js';
import { customAlphabet, nanoid } from 'nanoid';
import {
  appendChatMessage,
  GameState,
  normalizeGameState,
  Position,
} from '../shared/schema';
import {
  applyMoveToState,
  applySetupSwapToState,
  createRematchState,
  createSessionGame,
  markPlayerSetupReady,
} from './engine';
import { gamePieces, gameRules } from './gameConfig';
import { DEFAULT_AVATAR_ID, PlayerProfile } from './playerProfile';

export type SessionRow = {
  session_id: string;
  state: GameState | null;
  initiator_name: string;
  initiator_avatar?: string | null;
  challenger_name: string | null;
  challenger_avatar?: string | null;
  initiator_id: string;
  challenger_id: string | null;
  created_at: string;
  updated_at: string;
};

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined);

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined);

export const isSupabaseMode = Boolean(supabaseUrl && supabaseAnonKey);

const client = isSupabaseMode ? createClient(supabaseUrl!, supabaseAnonKey!) : null;

const TABLE = 'game_sessions';
const SESSION_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const createSessionCode = customAlphabet(SESSION_CODE_ALPHABET, 8);
const MAX_SESSION_UPDATE_ATTEMPTS = 4;

const normalizeSessionRow = (row: SessionRow): SessionRow => ({
  ...row,
  state: normalizeGameState(row.state),
});

const withUpdatedPlayerState = (
  state: GameState | null,
  playerId: string,
  profile: PlayerProfile,
) => {
  if (!state) return null;

  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            name: profile.playerName,
            avatarId: profile.avatarId,
          }
        : player,
    ),
  };
};

const updateSessionState = async (
  sessionId: string,
  buildNextState: (
    row: SessionRow,
  ) => { nextState?: GameState; error?: string },
) => {
  if (!client) throw new Error('Supabase is not configured.');

  for (let attempt = 0; attempt < MAX_SESSION_UPDATE_ATTEMPTS; attempt += 1) {
    const row = await getSession(sessionId);
    const result = buildNextState(row);
    if (result.error || !result.nextState) {
      throw new Error(result.error ?? 'Could not update session state.');
    }

    const { data, error } = await client
      .from(TABLE)
      .update({ state: result.nextState })
      .eq('session_id', sessionId)
      .eq('updated_at', row.updated_at)
      .select('*')
      .maybeSingle<SessionRow>();

    if (error) throw error;
    if (data) return normalizeSessionRow(data);
  }

  throw new Error('Session changed before the update could be saved. Try again.');
};

export const createInitiatedSession = async (initiatorProfile: PlayerProfile) => {
  if (!client) throw new Error('Supabase is not configured.');

  const sessionId = createSessionCode();
  const { data, error } = await client
    .from(TABLE)
    .insert({
      session_id: sessionId,
      initiator_name: initiatorProfile.playerName,
      initiator_avatar: initiatorProfile.avatarId,
      state: null,
      initiator_id: nanoid(10),
      challenger_name: null,
      challenger_avatar: null,
      challenger_id: null,
    })
    .select()
    .single<SessionRow>();

  if (error) throw error;
  return normalizeSessionRow(data);
};

export const joinAsChallenger = async (
  sessionId: string,
  challengerProfile: PlayerProfile,
) => {
  if (!client) throw new Error('Supabase is not configured.');

  const { data: existing, error: getErr } = await client
    .from(TABLE)
    .select('*')
    .eq('session_id', sessionId)
    .single<SessionRow>();

  if (getErr || !existing) throw new Error('Session not found.');
  if (existing.challenger_name) throw new Error('Session already full.');

  const challengerId = nanoid(10);
  const initialized = createSessionGame(
    {
      playerName: existing.initiator_name,
      avatarId: existing.initiator_avatar ?? DEFAULT_AVATAR_ID,
    },
    challengerProfile,
    gameRules,
    gamePieces,
    {
      initiatorId: existing.initiator_id,
      challengerId,
    },
  );
  initialized.state.roomCode = sessionId;

  const { data, error } = await client
    .from(TABLE)
    .update({
      challenger_name: challengerProfile.playerName,
      challenger_avatar: challengerProfile.avatarId,
      challenger_id: challengerId,
      state: initialized.state,
    })
    .eq('session_id', sessionId)
    .is('challenger_id', null)
    .select()
    .single<SessionRow>();

  if (error || !data) throw new Error('Could not join session.');
  return { row: normalizeSessionRow(data), playerId: challengerId };
};

export const updateSessionPlayerProfile = async (
  sessionId: string,
  playerId: string,
  role: 'initiator' | 'challenger',
  profile: PlayerProfile,
) => {
  if (!client) throw new Error('Supabase is not configured.');

  const row = await getSession(sessionId);
  const updates =
    role === 'initiator'
      ? {
          initiator_name: profile.playerName,
          initiator_avatar: profile.avatarId,
        }
      : {
          challenger_name: profile.playerName,
          challenger_avatar: profile.avatarId,
        };

  const playerIdColumn = role === 'initiator' ? 'initiator_id' : 'challenger_id';
  const { data, error } = await client
    .from(TABLE)
    .update({
      ...updates,
      state: withUpdatedPlayerState(row.state, playerId, profile),
    })
    .eq('session_id', sessionId)
    .eq(playerIdColumn, playerId)
    .select()
    .single<SessionRow>();

  if (error || !data) throw error ?? new Error('Could not update player profile.');
  return normalizeSessionRow(data);
};

export const getSession = async (sessionId: string) => {
  if (!client) throw new Error('Supabase is not configured.');
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('session_id', sessionId)
    .single<SessionRow>();

  if (error || !data) throw new Error('Session not found.');
  return normalizeSessionRow(data);
};

export const listSessions = async (sessionIds: string[]) => {
  if (!client) throw new Error('Supabase is not configured.');
  if (sessionIds.length === 0) return [] as SessionRow[];

  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .in('session_id', sessionIds)
    .order('updated_at', { ascending: false });

  if (error || !data) throw error ?? new Error('Could not load sessions.');
  return (data as SessionRow[]).map(normalizeSessionRow);
};

export const listOpenSessions = async (limit = 5) => {
  if (!client) throw new Error('Supabase is not configured.');

  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .is('challenger_id', null)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !data) throw error ?? new Error('Could not load open sessions.');
  return (data as SessionRow[]).map(normalizeSessionRow);
};

export const applyMove = async (
  sessionId: string,
  playerId: string,
  from: Position,
  to: Position,
) => {
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: 'Waiting for challenger to join.' };
    return applyMoveToState(
      currentRow.state,
      playerId,
      from,
      to,
      gameRules,
      gamePieces,
    );
  });

  return row.state!;
};

export const applySetupSwap = async (
  sessionId: string,
  playerId: string,
  from: Position,
  to: Position,
) => {
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: 'Waiting for challenger to join.' };

    return applySetupSwapToState(
      currentRow.state,
      playerId,
      from,
      to,
      gameRules,
      gamePieces,
    );
  });

  return row.state!;
};

export const markSetupReady = async (sessionId: string, playerId: string) => {
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: 'Waiting for challenger to join.' };
    return markPlayerSetupReady(currentRow.state, playerId);
  });

  return row.state!;
};

export const resetFinishedGame = async (sessionId: string, playerId: string) => {
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: 'Waiting for challenger to join.' };
    if (!currentRow.state.players.some((player) => player.id === playerId)) {
      return { error: 'Unknown player.' };
    }
    if (currentRow.state.phase !== 'finished') {
      return { error: 'Game is not in completion phase.' };
    }

    return {
      nextState: createRematchState(currentRow.state, gameRules, gamePieces),
    };
  });

  return row.state!;
};

export const closeFinishedGame = async (sessionId: string, playerId: string) => {
  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: 'Waiting for challenger to join.' };
    if (!currentRow.state.players.some((player) => player.id === playerId)) {
      return { error: 'Unknown player.' };
    }
    if (currentRow.state.phase !== 'finished') {
      return { error: 'Game is not in completion phase.' };
    }

    return {
      nextState: {
        ...currentRow.state,
        phase: 'closed',
        turnPlayerId: null,
      },
    };
  });

  return row.state!;
};

export const sendChatMessage = async (
  sessionId: string,
  playerId: string,
  text: string,
  options?: {
    messageId?: string;
    sentAt?: string;
  },
) => {
  const trimmedText = text.trim();
  if (!trimmedText) throw new Error('Enter a message first.');

  const row = await updateSessionState(sessionId, (currentRow) => {
    if (!currentRow.state) return { error: 'Waiting for challenger to join.' };

    const sender = currentRow.state.players.find((player) => player.id === playerId);
    if (!sender) return { error: 'Unknown player.' };

    return {
      nextState: appendChatMessage(currentRow.state, {
        id: options?.messageId ?? nanoid(10),
        type: 'player',
        playerId,
        senderName: sender.name,
        text: trimmedText,
        sentAt: options?.sentAt ?? new Date().toISOString(),
      }),
    };
  });

  return row.state!;
};

export const subscribeToSession = (
  sessionId: string,
  onSession: (next: SessionRow) => void,
) => {
  if (!client) return () => undefined;

  const channel = client
    .channel(`session:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const next = normalizeSessionRow(payload.new as SessionRow);
        onSession(next);
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
};

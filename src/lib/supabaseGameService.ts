import { createClient } from '@supabase/supabase-js';
import { customAlphabet, nanoid } from 'nanoid';
import { GameState, Position } from '../shared/schema';
import { applyMoveToState, createSessionGame } from './engine';
import { gamePieces, gameRules } from './gameConfig';

export type SessionRow = {
  session_id: string;
  state: GameState | null;
  initiator_name: string;
  challenger_name: string | null;
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

export const createInitiatedSession = async (initiatorName: string) => {
  if (!client) throw new Error('Supabase is not configured.');

  const sessionId = createSessionCode();
  const { data, error } = await client
    .from(TABLE)
    .insert({
      session_id: sessionId,
      initiator_name: initiatorName,
      state: null,
      initiator_id: nanoid(10),
      challenger_name: null,
      challenger_id: null,
    })
    .select()
    .single<SessionRow>();

  if (error) throw error;
  return data;
};

export const joinAsChallenger = async (sessionId: string, challengerName: string) => {
  if (!client) throw new Error('Supabase is not configured.');

  const { data: existing, error: getErr } = await client
    .from(TABLE)
    .select('*')
    .eq('session_id', sessionId)
    .single<SessionRow>();

  if (getErr || !existing) throw new Error('Session not found.');
  if (existing.challenger_name) throw new Error('Session already full.');

  const challengerId = nanoid(10);
  const initialized = createSessionGame(existing.initiator_name, challengerName, gameRules, gamePieces, {
    initiatorId: existing.initiator_id,
    challengerId,
  });
  initialized.state.roomCode = sessionId;

  const { data, error } = await client
    .from(TABLE)
    .update({
      challenger_name: challengerName,
      challenger_id: challengerId,
      state: initialized.state,
    })
    .eq('session_id', sessionId)
    .is('challenger_id', null)
    .select()
    .single<SessionRow>();

  if (error || !data) throw new Error('Could not join session.');
  return { row: data, playerId: challengerId };
};

export const getSession = async (sessionId: string) => {
  if (!client) throw new Error('Supabase is not configured.');
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('session_id', sessionId)
    .single<SessionRow>();

  if (error || !data) throw new Error('Session not found.');
  return data;
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
  return data as SessionRow[];
};

export const applyMove = async (sessionId: string, playerId: string, from: Position, to: Position) => {
  if (!client) throw new Error('Supabase is not configured.');
  const row = await getSession(sessionId);
  if (!row.state) throw new Error('Waiting for challenger to join.');

  const result = applyMoveToState(row.state, playerId, from, to, gameRules, gamePieces);
  if (result.error || !result.nextState) throw new Error(result.error ?? 'Move rejected.');

  const { error } = await client.from(TABLE).update({ state: result.nextState }).eq('session_id', sessionId);
  if (error) throw error;
  return result.nextState;
};

export const subscribeToSession = (sessionId: string, onState: (next: GameState | null) => void) => {
  if (!client) return () => undefined;

  const channel = client
    .channel(`session:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const state = (payload.new as SessionRow).state ?? null;
        onState(state);
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
};

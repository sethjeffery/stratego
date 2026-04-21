import type { GameSetup, GameState, Position } from "../../shared/schema";

export type AiChosenMove = Position & {
  from: Position;
  score: number;
};

export type AiWorkerRequest = {
  gameSetup: GameSetup;
  jobId: string;
  moveCount: number;
  playerId: string;
  roomCode: string;
  state: GameState;
};

export type AiWorkerResponse = {
  jobId: string;
  move: AiChosenMove | null;
  moveCount: number;
  playerId: string;
  roomCode: string;
};

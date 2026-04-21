/// <reference lib="webworker" />

import type { GameSetup, GameState } from "../shared/schema";
import type { AiChosenMove } from "./aiPlayer";

import { chooseAiMove } from "./aiPlayer";

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

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<AiWorkerRequest>) => {
  const { gameSetup, jobId, moveCount, playerId, roomCode, state } = event.data;

  workerScope.postMessage({
    jobId,
    move: chooseAiMove(state, playerId, gameSetup),
    moveCount,
    playerId,
    roomCode,
  } satisfies AiWorkerResponse);
});

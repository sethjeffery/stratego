/// <reference lib="webworker" />

import type { AiWorkerRequest, AiWorkerResponse } from "./types";

import { chooseAiMove } from "./chooseMove";

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

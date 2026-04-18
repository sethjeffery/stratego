import type { GameState, Position } from "../shared/schema";

export type PendingBoardAction = {
  optimisticStateKey: string;
  previousSelection: Position;
  previousState: GameState;
};

export const serializeGameState = (state: GameState) => JSON.stringify(state);

export const serializeBoardActionState = (state: GameState) =>
  serializeGameState({
    ...state,
    chatMessages: [],
  });

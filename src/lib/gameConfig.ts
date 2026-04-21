import gameSetupsJson from "../../config/game-setups.json";
import {
  type GameSetup,
  gameSetupCatalogSchema,
  type GameState,
} from "../shared/schema";

const gameSetupCatalog = gameSetupCatalogSchema.parse(gameSetupsJson);

export const gameSetups = gameSetupCatalog.setups;
export const defaultGameSetupId = gameSetupCatalog.defaultSetupId;

const gameSetupById = new Map(gameSetups.map((setup) => [setup.id, setup]));

export const getGameSetup = (setupId?: null | string): GameSetup =>
  (setupId ? gameSetupById.get(setupId) : null) ??
  gameSetupById.get(defaultGameSetupId)!;

export const getGameSetupForState = (
  state?: null | Pick<GameState, "gameSetupId">,
): GameSetup => getGameSetup(state?.gameSetupId);

export const allGamePieces = [
  ...new Map(
    gameSetups
      .flatMap((setup) => setup.pieces)
      .map((piece) => [piece.id, piece] as const),
  ).values(),
];

export const gamePieces = getGameSetup(defaultGameSetupId).pieces;
export const gameRules = getGameSetup(defaultGameSetupId).rules;

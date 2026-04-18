import piecesJson from "../../config/pieces/classic.json";
import rulesJson from "../../config/rules/default.json";
import { piecesConfigSchema, rulesSchema } from "../shared/schema";

export const gamePieces = piecesConfigSchema.parse(piecesJson).pieces;
export const gameRules = rulesSchema.parse(rulesJson);

import type { AiPlayerConfig } from "../../shared/schema";
import type { Database } from "../../types/database.types";

export type CreateSessionOptions = {
  challengerAiIntelligence?: number;
  initiatorAiIntelligence?: number;
  matchup: HostedGameMode;
  setupId: string;
};
export type HostedGameMode = "ai_vs_ai" | "human_vs_ai" | "human_vs_human";
export type PlayerProfile = {
  avatar_id: string;
  player_name: string;
};

export type SessionRole = Database["public"]["Enums"]["session_role"];

export const AI_INTELLIGENCE_OPTIONS = [1, 2, 3, 4, 5] as const;
export const DEFAULT_AI_INTELLIGENCE = 3;

export const normalizeAiIntelligence = (value?: number) => {
  const rounded = Math.round(value ?? DEFAULT_AI_INTELLIGENCE);
  return Math.min(5, Math.max(1, rounded));
};

export const createAiPlayerConfig = (intelligence?: number): AiPlayerConfig => ({
  intelligence: normalizeAiIntelligence(intelligence),
});

export const createAiProfile = (
  _role: SessionRole,
  intelligence = DEFAULT_AI_INTELLIGENCE,
): PlayerProfile => {
  const level = normalizeAiIntelligence(intelligence);

  return {
    avatar_id: `robo${String(level).padStart(2, "0")}`,
    player_name: `Arena AI Lv.${level}`,
  };
};

export const getAiSearchDepth = (config?: AiPlayerConfig) => {
  const intelligence = normalizeAiIntelligence(config?.intelligence);

  if (intelligence <= 2) return 1;
  if (intelligence <= 4) return 2;
  return 3;
};

export const getAiThinkingDelayMs = (config?: AiPlayerConfig) => {
  const intelligence = normalizeAiIntelligence(config?.intelligence);
  return 450 + intelligence * 180;
};

export const getAiScoreMargin = (config?: AiPlayerConfig) => {
  const intelligence = normalizeAiIntelligence(config?.intelligence);
  return 200 - intelligence * 30;
};

export const getAiBestMoveProbability = (config?: AiPlayerConfig) => {
  const intelligence = normalizeAiIntelligence(config?.intelligence);
  return 0.45 + intelligence * 0.1;
};

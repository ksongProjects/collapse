import { DIFFICULTY_PRESETS, type DifficultyId } from "@/lib/difficulty";

export const MAX_PLAYER_NAME_LENGTH = 10;

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  difficulty: DifficultyId;
  score: number;
  completionTimeMs: number;
  createdAt: string;
}

export function sanitizePlayerNameInput(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function computeScore(difficulty: DifficultyId, completionTimeMs: number): number {
  const preset = DIFFICULTY_PRESETS[difficulty];
  const boardFactor = preset.size.columns * preset.size.rows * preset.colorCount;
  const safeDuration = Math.max(1000, completionTimeMs);

  return Math.max(1, Math.round((boardFactor * 100000) / safeDuration));
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

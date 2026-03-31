import { type DifficultyId } from "@/lib/difficulty";

export const MAX_PLAYER_NAME_LENGTH = 10;

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  difficulty: DifficultyId;
  clickCount: number;
  completionTimeMs: number;
  createdAt: string;
}

export function sanitizePlayerNameInput(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatClickCount(clickCount: number): string {
  return `${clickCount} click${clickCount === 1 ? "" : "s"}`;
}

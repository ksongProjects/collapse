import { normalizeBoardSize, type BoardSize } from "@/lib/game";

export type DifficultyId = "easy" | "medium" | "hard";

export interface DifficultyPreset {
  label: string;
  size: BoardSize;
  colorCount: number;
}

export const DIFFICULTY_ORDER: readonly DifficultyId[] = [
  "easy",
  "medium",
  "hard",
];

export const DIFFICULTY_PRESETS: Record<DifficultyId, DifficultyPreset> = {
  easy: {
    label: "Easy",
    size: normalizeBoardSize({ columns: 12, rows: 12 }),
    colorCount: 4,
  },
  medium: {
    label: "Medium",
    size: normalizeBoardSize({ columns: 20, rows: 20 }),
    colorCount: 5,
  },
  hard: {
    label: "Hard",
    size: normalizeBoardSize({ columns: 25, rows: 30 }),
    colorCount: 6,
  }
};

export function isDifficultyId(value: string): value is DifficultyId {
  return DIFFICULTY_ORDER.some((difficulty) => difficulty === value);
}

export function getDifficultyLabel(difficulty: DifficultyId): string {
  return DIFFICULTY_PRESETS[difficulty].label;
}

export function getDifficultyDescription(difficulty: DifficultyId): string {
  const preset = DIFFICULTY_PRESETS[difficulty];
  return `${preset.size.columns} x ${preset.size.rows} | ${preset.colorCount} colors`;
}

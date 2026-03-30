import { normalizeBoardSize, type BoardSize } from "@/lib/game";

export type DifficultyId = "very-easy" | "easy" | "medium" | "hard" | "very-hard";

export interface DifficultyPreset {
  label: string;
  size: BoardSize;
  colorCount: number;
}

export const DIFFICULTY_ORDER: readonly DifficultyId[] = [
  "very-easy",
  "easy",
  "medium",
  "hard",
  "very-hard",
];

export const DIFFICULTY_PRESETS: Record<DifficultyId, DifficultyPreset> = {
  "very-easy": {
    label: "Very Easy",
    size: normalizeBoardSize({ columns: 15, rows: 15 }),
    colorCount: 4,
  },
  easy: {
    label: "Easy",
    size: normalizeBoardSize({ columns: 20, rows: 20 }),
    colorCount: 5,
  },
  medium: {
    label: "Medium",
    size: normalizeBoardSize({ columns: 25, rows: 30 }),
    colorCount: 6,
  },
  hard: {
    label: "Hard",
    size: normalizeBoardSize({ columns: 35, rows: 40 }),
    colorCount: 7,
  },
  "very-hard": {
    label: "Very Hard",
    size: normalizeBoardSize({ columns: 50, rows: 60 }),
    colorCount: 8,
  },
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

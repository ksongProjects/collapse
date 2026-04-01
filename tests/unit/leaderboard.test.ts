import {
  formatClickCount,
  formatDuration,
  sanitizePlayerNameInput,
} from "@/lib/leaderboard";

describe("leaderboard helpers", () => {
  it("normalizes whitespace and truncates player names", () => {
    expect(sanitizePlayerNameInput("   Ada   Lovelace   ")).toBe("Ada Lovela");
  });

  it("formats durations as mm:ss", () => {
    expect(formatDuration(65_000)).toBe("01:05");
  });

  it("formats click counts with pluralization", () => {
    expect(formatClickCount(1)).toBe("1 click");
    expect(formatClickCount(7)).toBe("7 clicks");
  });
});

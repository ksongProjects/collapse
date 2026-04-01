import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GameShell } from "@/components/game-shell";
import type { LeaderboardEntry } from "@/lib/leaderboard";

function buildRecord(
  id: string,
  playerName: string,
  difficulty: LeaderboardEntry["difficulty"],
  clickCount: number,
  completionTimeMs: number,
): LeaderboardEntry {
  return {
    id,
    playerName,
    difficulty,
    clickCount,
    completionTimeMs,
    createdAt: "2026-03-31T00:00:00.000Z",
  };
}

describe("GameShell", () => {
  it("loads leaderboard entries, pages them, and applies a new difficulty", async () => {
    const user = userEvent.setup();
    const recordsByDifficulty: Record<string, LeaderboardEntry[]> = {
      "very-easy": [
        buildRecord("1", "Ada", "very-easy", 12, 32_000),
        buildRecord("2", "Bea", "very-easy", 13, 35_000),
        buildRecord("3", "Cy", "very-easy", 14, 36_000),
        buildRecord("4", "Dee", "very-easy", 15, 38_000),
        buildRecord("5", "Eli", "very-easy", 16, 40_000),
        buildRecord("6", "Flynn", "very-easy", 17, 42_000),
      ],
      hard: [buildRecord("7", "Harper", "hard", 99, 91_000)],
    };

    const fetchMock = jest.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const difficulty = new URL(url, "http://localhost").searchParams.get("difficulty") ?? "";

      return {
        ok: true,
        json: async () => ({
          records: recordsByDifficulty[difficulty] ?? [],
        }),
      } as Response;
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    render(<GameShell />);

    expect(screen.getByText("Loading leaderboard...")).toBeInTheDocument();
    expect(await screen.findByText("#1 Ada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show next 5" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show next 5" }));

    expect(await screen.findByText("#6 Flynn")).toBeInTheDocument();
    expect(screen.queryByText("#1 Ada")).not.toBeInTheDocument();

    const difficultyTrigger = screen.getByRole("combobox", { name: "Difficulty" });
    const applyButton = screen.getByRole("button", { name: "Apply" });

    expect(applyButton).toBeDisabled();

    await user.click(difficultyTrigger);
    await user.click(await screen.findByRole("option", { name: "Hard" }));

    expect(applyButton).toBeEnabled();

    await user.click(applyButton);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([request]) =>
          String(
            typeof request === "string"
              ? request
              : request instanceof URL
                ? request.toString()
                : request.url,
          ).includes("difficulty=hard"),
        ),
      ).toBe(true);
    });

    expect(await screen.findByRole("heading", { name: "Hard wins" })).toBeInTheDocument();
    expect(await screen.findByText("#1 Harper")).toBeInTheDocument();
  });
});

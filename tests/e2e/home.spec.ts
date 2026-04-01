import { expect, test } from "@playwright/test";

test("shows leaderboard data and lets the player apply a harder difficulty", async ({
  page,
}) => {
  await page.route("**/api/leaderboard?difficulty=very-easy", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        records: [
          {
            id: "1",
            playerName: "Ada",
            difficulty: "very-easy",
            clickCount: 12,
            completionTimeMs: 32_000,
            createdAt: "2026-03-31T00:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/api/leaderboard?difficulty=hard", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        records: [
          {
            id: "2",
            playerName: "Harper",
            difficulty: "hard",
            clickCount: 88,
            completionTimeMs: 90_000,
            createdAt: "2026-03-31T00:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Collapse Game" })).toBeVisible();
  await expect(page.getByText("#1 Ada")).toBeVisible();

  await page.getByRole("combobox", { name: "Difficulty" }).click();
  await page.getByRole("option", { name: "Hard" }).click();
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByRole("heading", { name: "Hard wins" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Hard \| 35 x 40 \| 7 colors/ }),
  ).toBeVisible();
  await expect(page.getByText("#1 Harper")).toBeVisible();
});

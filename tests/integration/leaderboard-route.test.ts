/** @jest-environment node */

jest.mock("@/lib/mongodb", () => ({
  getLeaderboardCollection: jest.fn(),
  isMongoConfigured: jest.fn(),
  mapLeaderboardDocument: jest.fn((document: {
    _id: { toString(): string };
    playerName: string;
    difficulty: string;
    clickCount: number;
    completionTimeMs: number;
    createdAt: Date;
  }) => ({
    id: document._id.toString(),
    playerName: document.playerName,
    difficulty: document.difficulty,
    clickCount: document.clickCount,
    completionTimeMs: document.completionTimeMs,
    createdAt: document.createdAt.toISOString(),
  })),
}));

import { GET, POST } from "@/app/api/leaderboard/route";
import {
  getLeaderboardCollection,
  isMongoConfigured,
} from "@/lib/mongodb";

describe("/api/leaderboard", () => {
  const queryChain = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
  };

  const collection = {
    find: jest.fn().mockReturnValue(queryChain),
    insertOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryChain.sort.mockReturnThis();
    queryChain.limit.mockReturnThis();
    (isMongoConfigured as jest.Mock).mockReturnValue(true);
    (getLeaderboardCollection as jest.Mock).mockResolvedValue(collection);
  });

  it("rejects requests without a valid difficulty", async () => {
    const response = await GET(new Request("http://localhost/api/leaderboard"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "A valid difficulty is required.",
    });
    expect(getLeaderboardCollection).not.toHaveBeenCalled();
  });

  it("returns leaderboard rows for a valid difficulty", async () => {
    queryChain.toArray.mockResolvedValue([
      {
        _id: {
          toString: () => "entry-1",
        },
        playerName: "Ada",
        difficulty: "easy",
        clickCount: 14,
        completionTimeMs: 42_000,
        createdAt: new Date("2026-03-31T00:00:00.000Z"),
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/leaderboard?difficulty=easy"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      records: [
        {
          id: "entry-1",
          playerName: "Ada",
          difficulty: "easy",
          clickCount: 14,
          completionTimeMs: 42_000,
          createdAt: "2026-03-31T00:00:00.000Z",
        },
      ],
    });
    expect(collection.find).toHaveBeenCalledWith({
      difficulty: "easy",
      clickCount: { $gte: 1 },
    });
  });

  it("stores a sanitized winning run", async () => {
    collection.insertOne.mockResolvedValue({
      insertedId: {
        toString: () => "entry-2",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/leaderboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          difficulty: "medium",
          playerName: "  Ada   Lovelace  ",
          clickCount: 23,
          completionTimeMs: 55_000,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        playerName: "Ada Lovela",
        difficulty: "medium",
        clickCount: 23,
        completionTimeMs: 55_000,
        createdAt: expect.any(Date),
      }),
    );
    await expect(response.json()).resolves.toEqual({
      record: expect.objectContaining({
        id: "entry-2",
        playerName: "Ada Lovela",
        difficulty: "medium",
      }),
    });
  });
});

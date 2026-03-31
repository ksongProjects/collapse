import { NextResponse } from "next/server";

import { sanitizePlayerNameInput } from "@/lib/leaderboard";
import { getLeaderboardCollection, isMongoConfigured, mapLeaderboardDocument } from "@/lib/mongodb";
import { isDifficultyId } from "@/lib/difficulty";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty");

  if (!difficulty || !isDifficultyId(difficulty)) {
    return NextResponse.json({ error: "A valid difficulty is required." }, { status: 400 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI and MONGODB_DB." },
      { status: 503 },
    );
  }

  try {
    const collection = await getLeaderboardCollection();
    const records = await collection
      .find({
        difficulty,
        clickCount: { $gte: 1 },
      })
      .sort({ clickCount: 1, completionTimeMs: 1, createdAt: 1 })
      .limit(10)
      .toArray();

    return NextResponse.json({
      records: records.map(mapLeaderboardDocument),
    });
  } catch (error) {
    console.error("Failed to load leaderboard records.", error);

    return NextResponse.json({ error: "Could not load the leaderboard." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "MongoDB is not configured. Set MONGODB_URI and MONGODB_DB." },
      { status: 503 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const body =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const difficulty = body.difficulty;
  const rawPlayerName = body.playerName ?? "";
  const rawClickCount = body.clickCount ?? 0;
  const rawCompletionTimeMs = body.completionTimeMs ?? 0;

  if (typeof difficulty !== "string" || !isDifficultyId(difficulty)) {
    return NextResponse.json({ error: "A valid difficulty is required." }, { status: 400 });
  }

  const playerName = sanitizePlayerNameInput(String(rawPlayerName ?? ""));

  if (!playerName) {
    return NextResponse.json({ error: "Enter a name up to 10 characters long." }, { status: 400 });
  }

  const completionTimeMs = Number(rawCompletionTimeMs);
  const clickCount = Number(rawClickCount);

  if (!Number.isInteger(completionTimeMs) || completionTimeMs <= 0) {
    return NextResponse.json({ error: "A valid completion time is required." }, { status: 400 });
  }

  if (!Number.isInteger(clickCount) || clickCount <= 0) {
    return NextResponse.json({ error: "A valid click count is required." }, { status: 400 });
  }

  try {
    const collection = await getLeaderboardCollection();
    const document = {
      playerName,
      difficulty,
      clickCount,
      completionTimeMs,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(document);

    return NextResponse.json(
      {
        record: mapLeaderboardDocument({
          _id: result.insertedId,
          ...document,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to save leaderboard record.", error);

    return NextResponse.json({ error: "Could not save the leaderboard record." }, { status: 500 });
  }
}

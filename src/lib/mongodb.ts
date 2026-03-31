import { MongoClient, ServerApiVersion, type Collection, type WithId } from "mongodb";

import { type DifficultyId } from "@/lib/difficulty";

export interface LeaderboardDocument {
  playerName: string;
  difficulty: DifficultyId;
  clickCount: number;
  completionTimeMs: number;
  createdAt: Date;
}

interface GlobalMongoCache {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
  indexesReady: Promise<void> | null;
}

declare global {
  var __mongoCache__: GlobalMongoCache | undefined;
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

const cache =
  global.__mongoCache__ ??
  (global.__mongoCache__ = {
    client: null,
    promise: null,
    indexesReady: null,
  });

export function isMongoConfigured(): boolean {
  return Boolean(uri && dbName);
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("Missing MONGODB_URI.");
  }

  if (cache.client) {
    return cache.client;
  }

  if (!cache.promise) {
    cache.promise = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    }).connect();
  }

  cache.client = await cache.promise;
  return cache.client;
}

export async function getLeaderboardCollection(): Promise<Collection<LeaderboardDocument>> {
  if (!dbName) {
    throw new Error("Missing MONGODB_DB.");
  }

  const client = await getMongoClient();
  const collection = client.db(dbName).collection<LeaderboardDocument>("leaderboard_entries");

  if (!cache.indexesReady) {
    cache.indexesReady = collection
      .createIndexes([
        {
          key: {
            difficulty: 1,
            clickCount: 1,
            completionTimeMs: 1,
            createdAt: 1,
          },
          name: "difficulty_clicks_time_createdAt",
        },
      ])
      .then(() => undefined);
  }

  await cache.indexesReady;

  return collection;
}

export function mapLeaderboardDocument(document: WithId<LeaderboardDocument>) {
  return {
    id: document._id.toString(),
    playerName: document.playerName,
    difficulty: document.difficulty,
    clickCount:
      typeof document.clickCount === "number" && Number.isFinite(document.clickCount)
        ? document.clickCount
        : Number.MAX_SAFE_INTEGER,
    completionTimeMs: document.completionTimeMs,
    createdAt: document.createdAt.toISOString(),
  };
}

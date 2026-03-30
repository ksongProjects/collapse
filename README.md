# Chromatic Collapse Next

Next.js 16 rebuild of the Chromatic Collapse puzzle game with MongoDB Atlas-backed leaderboards for Vercel.

## What’s Included

- Next.js 16 App Router app in `C:\ksong\Projects\blocks\blocks-next`
- Win-only name submission flow with a 10-character max
- Per-difficulty leaderboards backed by MongoDB Atlas
- Top 10 leaderboard section in the right sidebar
- Server route at `/api/leaderboard` for loading and saving scores

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in:
   - `MONGODB_URI`
   - `MONGODB_DB`
3. Run the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## MongoDB Notes

- The app stores leaderboard rows in a `leaderboard_entries` collection.
- The required leaderboard index is created automatically on first request.
- Scores are derived from the winning completion time and the active board preset, since the game itself is time-based.

## Leaderboard Shape

Each saved record includes:

- `playerName`
- `difficulty`
- `score`
- `completionTimeMs`
- `createdAt`

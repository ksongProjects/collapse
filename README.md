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

## Testing

The repo now has three test layers:

- `npm test` runs the Jest suite.
- `npm run test:unit` runs fast unit tests for pure game and leaderboard helpers.
- `npm run test:integration` runs integration tests for the App Router leaderboard route and the `GameShell` UI with React Testing Library.
- `npm run test:e2e` runs Playwright against a local Next server on `http://127.0.0.1:3000`.
- `npm run test:e2e:install` installs the Playwright Chromium browser used by the default config.
- `npm run test:selenium` runs a Selenium smoke test against the same local app.

Notes:

- Jest is configured with `next/jest`, matching the Next.js 16 guidance bundled in `node_modules/next/dist/docs/`.
- The React Testing Library setup stubs browser APIs used by the canvas board and Radix select components, including `ResizeObserver`, `matchMedia`, and `canvas.getContext`.
- The Playwright test mocks `/api/leaderboard` responses so E2E runs do not require MongoDB.
- The Selenium smoke test defaults to Edge on Windows and Chrome elsewhere. Override that with `SELENIUM_BROWSER=edge` or `SELENIUM_BROWSER=chrome`.

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

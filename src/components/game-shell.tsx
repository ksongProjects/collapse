"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";

import { DifficultySelect } from "@/components/difficulty-select";
import {
  DIFFICULTY_ORDER,
  DIFFICULTY_PRESETS,
  getDifficultyDescription,
  getDifficultyLabel,
  isDifficultyId,
  type DifficultyId,
} from "@/lib/difficulty";
import {
  createBoardData,
  getStatus,
  playGroup,
  type Board,
  type BoardSize,
  type GameStatus,
  type PaletteColor,
} from "@/lib/game";
import {
  formatClickCount,
  formatDuration,
  MAX_PLAYER_NAME_LENGTH,
  sanitizePlayerNameInput,
  type LeaderboardEntry,
} from "@/lib/leaderboard";

const DEFAULT_DIFFICULTY: DifficultyId = "easy";
const DEFAULT_PRESET = DIFFICULTY_PRESETS[DEFAULT_DIFFICULTY];
const REMOVAL_ANIMATION_MS = 100;
const MOVEMENT_ANIMATION_MS = 200;
const LEADERBOARD_PAGE_SIZE = 5;
const BOARD_VIEWPORT_PADDING = 16;

interface BoardAnimation {
  baseBoard: Board;
  nextBoard: Board;
  removed: Array<{
    color: number;
    row: number;
    col: number;
  }>;
  moved: Array<{
    color: number;
    from: {
      row: number;
      col: number;
    };
    to: {
      row: number;
      col: number;
    };
  }>;
  startedAt: number;
  nextStatus: GameStatus;
}

function createEmptyBoard(size: BoardSize): Board {
  return Array.from({ length: size.rows }, () => Array<number | null>(size.columns).fill(null));
}

function getApiError(payload: unknown, fallbackMessage: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallbackMessage;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function easeInCubic(value: number): number {
  return value * value * value;
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function toCellKey(row: number, col: number, columns: number): number {
  return row * columns + col;
}

export function GameShell() {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const timerHandleRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const animationRef = useRef<BoardAnimation | null>(null);
  const drawBoardRef = useRef<(() => void) | null>(null);
  const runStartedAtRef = useRef(0);
  const nameInputId = useId();

  const [difficulty, setDifficulty] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  const [boardSeed, setBoardSeed] = useState(0);
  const [board, setBoard] = useState<Board>(createEmptyBoard(DEFAULT_PRESET.size));
  const [palette, setPalette] = useState<readonly PaletteColor[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [clickCount, setClickCount] = useState(0);

  const [leaderboardRecords, setLeaderboardRecords] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardReloadToken, setLeaderboardReloadToken] = useState(0);
  const [leaderboardPage, setLeaderboardPage] = useState(0);

  const [playerName, setPlayerName] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [hasSubmittedWin, setHasSubmittedWin] = useState(false);

  const activePreset = DIFFICULTY_PRESETS[difficulty];

  useEffect(() => {
    const boardData = createBoardData(activePreset.size, activePreset.colorCount);
    const nextStatus = getStatus(boardData.metrics).status;

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    animationRef.current = null;

    setBoard(boardData.board);
    setPalette(boardData.palette);
    setStatus(nextStatus);
    setElapsedMs(0);
    setClickCount(0);
    setPlayerName("");
    setSubmitError(null);
    setSubmitSuccess(null);
    setHasSubmittedWin(false);

    if (timerHandleRef.current !== null) {
      window.clearInterval(timerHandleRef.current);
      timerHandleRef.current = null;
    }

    if (nextStatus === "playing") {
      const startedAt = performance.now();
      runStartedAtRef.current = startedAt;

      timerHandleRef.current = window.setInterval(() => {
        setElapsedMs(Math.floor(performance.now() - startedAt));
      }, 250);
    }

    return () => {
      if (timerHandleRef.current !== null) {
        window.clearInterval(timerHandleRef.current);
        timerHandleRef.current = null;
      }
    };
  }, [activePreset.colorCount, activePreset.size, boardSeed]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      setLeaderboardError(null);

      try {
        const response = await fetch(`/api/leaderboard?difficulty=${difficulty}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          throw new Error(getApiError(payload, "Could not load the leaderboard."));
        }

        if (!isActive) {
          return;
        }

        const records =
          typeof payload === "object" &&
          payload !== null &&
          "records" in payload &&
          Array.isArray(payload.records)
            ? (payload.records as LeaderboardEntry[])
            : [];

        setLeaderboardRecords(records);
        setLeaderboardLoading(false);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLeaderboardRecords([]);
        setLeaderboardError(
          error instanceof Error ? error.message : "Could not load the leaderboard.",
        );
        setLeaderboardLoading(false);
      }
    }

    void loadLeaderboard();

    return () => {
      isActive = false;
    };
  }, [difficulty, leaderboardReloadToken]);

  useEffect(() => {
    setLeaderboardPage(0);
  }, [difficulty]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const boardScroll = boardScrollRef.current;

    if (!canvas || !boardScroll || palette.length === 0) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const canvasElement = canvas;
    const shellElement = shellRef.current;
    const boardScrollElement = boardScroll;
    const boardPanelElement = boardScrollElement.closest(".board-panel");
    const drawingContext = context;
    const viewport = window.visualViewport;

    function drawBoard() {
      const boardScrollStyles = window.getComputedStyle(boardScrollElement);
      const horizontalPadding =
        Number.parseFloat(boardScrollStyles.paddingLeft) +
        Number.parseFloat(boardScrollStyles.paddingRight);
      const verticalPadding =
        Number.parseFloat(boardScrollStyles.paddingTop) +
        Number.parseFloat(boardScrollStyles.paddingBottom);
      const viewportHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight);
      const boardTop = Math.floor(boardScrollElement.getBoundingClientRect().top);
      const availableWidth = Math.max(
        activePreset.size.columns,
        Math.floor(boardScrollElement.clientWidth - horizontalPadding),
      );
      const availableHeight = Math.max(
        activePreset.size.rows,
        Math.floor(viewportHeight - boardTop - BOARD_VIEWPORT_PADDING - verticalPadding),
      );
      const cellSize = Math.max(
        1,
        Math.floor(
          Math.min(
            availableWidth / activePreset.size.columns,
            availableHeight / activePreset.size.rows,
          ),
        ),
      );
      const boardWidth = activePreset.size.columns * cellSize;
      const boardHeight = activePreset.size.rows * cellSize;
      const dpr = window.devicePixelRatio || 1;

      canvasElement.width = boardWidth * dpr;
      canvasElement.height = boardHeight * dpr;
      canvasElement.style.width = `${boardWidth}px`;
      canvasElement.style.height = `${boardHeight}px`;
      drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawingContext.imageSmoothingEnabled = false;

      const backdrop = drawingContext.createLinearGradient(0, 0, boardWidth, boardHeight);
      backdrop.addColorStop(0, "#0f172a");
      backdrop.addColorStop(1, "#020617");
      drawingContext.fillStyle = backdrop;
      drawingContext.fillRect(0, 0, boardWidth, boardHeight);

      for (let row = 0; row < activePreset.size.rows; row += 1) {
        for (let col = 0; col < activePreset.size.columns; col += 1) {
          drawingContext.fillStyle = "#111827";
          drawingContext.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }

      function drawTile(
        row: number,
        col: number,
        colorIndex: number,
        options?: {
          offsetX?: number;
          offsetY?: number;
          alpha?: number;
          scale?: number;
        },
      ) {
        const color = palette[colorIndex];

        if (!color) {
          return;
        }

        const offsetX = options?.offsetX ?? 0;
        const offsetY = options?.offsetY ?? 0;
        const alpha = options?.alpha ?? 1;
        const scale = options?.scale ?? 1;
        const inset = Math.min(1, Math.max(cellSize / 6, 1));
        const tileSize = Math.max(1, cellSize - inset * 2);
        const scaledSize = Math.max(1, tileSize * scale);
        const x = col * cellSize + inset + offsetX + (tileSize - scaledSize) / 2;
        const y = row * cellSize + inset + offsetY + (tileSize - scaledSize) / 2;

        drawingContext.save();
        drawingContext.globalAlpha = alpha;
        drawingContext.fillStyle = color.hex;
        drawingContext.fillRect(x, y, scaledSize, scaledSize);
        drawingContext.restore();
      }

      function drawStaticBoard(currentBoard: Board, omittedKeys?: Set<number>) {
        for (let row = 0; row < activePreset.size.rows; row += 1) {
          for (let col = 0; col < activePreset.size.columns; col += 1) {
            if (omittedKeys?.has(toCellKey(row, col, activePreset.size.columns))) {
              continue;
            }

            const cell = currentBoard[row]?.[col] ?? null;

            if (cell === null) {
              continue;
            }

            drawTile(row, col, cell);
          }
        }
      }

      const animation = animationRef.current;

      if (!animation) {
        drawStaticBoard(board);
        return;
      }

      const elapsed = performance.now() - animation.startedAt;

      if (elapsed < REMOVAL_ANIMATION_MS) {
        const removalProgress = clamp01(elapsed / REMOVAL_ANIMATION_MS);
        const removedKeys = new Set(
          animation.removed.map((cell) => toCellKey(cell.row, cell.col, activePreset.size.columns)),
        );

        drawStaticBoard(animation.baseBoard, removedKeys);

        for (const cell of animation.removed) {
          drawTile(cell.row, cell.col, cell.color, {
            alpha: 1 - easeOutCubic(removalProgress),
            scale: 1 - 0.28 * easeInCubic(removalProgress),
          });
        }

        return;
      }

      const movementProgress = clamp01(
        (elapsed - REMOVAL_ANIMATION_MS) / MOVEMENT_ANIMATION_MS,
      );
      const settledBoard = animation.nextBoard;
      const movingDestinationKeys = new Set(
        animation.moved.map((cell) => toCellKey(cell.to.row, cell.to.col, activePreset.size.columns)),
      );

      drawStaticBoard(settledBoard, movingDestinationKeys);

      for (const cell of animation.moved) {
        const easedProgress = easeOutCubic(movementProgress);
        const travelX = (cell.to.col - cell.from.col) * cellSize * easedProgress;
        const travelY = (cell.to.row - cell.from.row) * cellSize * easedProgress;

        drawTile(cell.from.row, cell.from.col, cell.color, {
          offsetX: travelX,
          offsetY: travelY,
        });
      }

    }

    function scheduleBoardDraw() {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        drawBoard();
      });
    }

    drawBoardRef.current = drawBoard;
    scheduleBoardDraw();

    const resizeObserver = new ResizeObserver(scheduleBoardDraw);
    resizeObserver.observe(boardScrollElement);

    if (shellElement instanceof HTMLElement) {
      resizeObserver.observe(shellElement);
    }

    if (boardPanelElement instanceof HTMLElement) {
      resizeObserver.observe(boardPanelElement);
    }

    window.addEventListener("resize", scheduleBoardDraw);
    viewport?.addEventListener("resize", scheduleBoardDraw);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleBoardDraw);
      viewport?.removeEventListener("resize", scheduleBoardDraw);

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [activePreset.size.columns, activePreset.size.rows, board, palette]);

  function stopTimerAndFreeze(): number {
    const finalElapsed = Math.max(0, Math.floor(performance.now() - runStartedAtRef.current));

    if (timerHandleRef.current !== null) {
      window.clearInterval(timerHandleRef.current);
      timerHandleRef.current = null;
    }

    setElapsedMs(finalElapsed);

    return finalElapsed;
  }

  function startBoardAnimation(nextAnimation: BoardAnimation) {
    const totalDuration = REMOVAL_ANIMATION_MS + MOVEMENT_ANIMATION_MS;

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    animationRef.current = nextAnimation;
    drawBoardRef.current?.();

    const tick = () => {
      const activeAnimation = animationRef.current;

      if (!activeAnimation) {
        animationFrameRef.current = null;
        drawBoardRef.current?.();
        return;
      }

      drawBoardRef.current?.();

      if (performance.now() - activeAnimation.startedAt >= totalDuration) {
        animationRef.current = null;
        animationFrameRef.current = null;
        drawBoardRef.current?.();
        setStatus(activeAnimation.nextStatus);
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
  }

  function handleApplyDifficulty() {
    if (selectedDifficulty === difficulty) {
      return;
    }

    setDifficulty(selectedDifficulty);
  }

  function handleNewBoard() {
    setBoardSeed((current) => current + 1);
  }

  function handleBoardClick(event: MouseEvent<HTMLCanvasElement>) {
    if (status !== "playing" || animationRef.current !== null) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const relativeX = (event.clientX - rect.left) / rect.width;
    const relativeY = (event.clientY - rect.top) / rect.height;

    if (relativeX < 0 || relativeX > 1 || relativeY < 0 || relativeY > 1) {
      return;
    }

    const col = Math.floor(relativeX * activePreset.size.columns);
    const row = Math.floor(relativeY * activePreset.size.rows);

    if (
      col < 0 ||
      col >= activePreset.size.columns ||
      row < 0 ||
      row >= activePreset.size.rows
    ) {
      return;
    }

    const move = playGroup(board, row, col);

    if (!move) {
      return;
    }

    const nextStatus = getStatus(move.metrics).status;

    setBoard(move.board);
    setClickCount((current) => current + 1);

    if (nextStatus !== "playing") {
      stopTimerAndFreeze();
      setSubmitError(null);
      setSubmitSuccess(null);
    }

    startBoardAnimation({
      baseBoard: board,
      nextBoard: move.board,
      removed: move.transition.removed,
      moved: move.transition.moved,
      startedAt: performance.now(),
      nextStatus,
    });
  }

  async function handleSubmitWin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status !== "board-cleared" || submitPending || hasSubmittedWin) {
      return;
    }

    const sanitizedName = sanitizePlayerNameInput(playerName);

    if (!sanitizedName) {
      setSubmitError("Enter a name up to 10 characters long.");
      return;
    }

    setSubmitPending(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          difficulty,
          playerName: sanitizedName,
          clickCount,
          completionTimeMs: elapsedMs,
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        throw new Error(getApiError(payload, "Could not save your win."));
      }

      setPlayerName(sanitizedName);
      setHasSubmittedWin(true);
      setSubmitSuccess(
        `Saved ${sanitizedName} to the ${getDifficultyLabel(difficulty)} leaderboard.`,
      );
      setLeaderboardReloadToken((current) => current + 1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save your win.");
    } finally {
      setSubmitPending(false);
    }
  }

  function handlePlayerNameChange(event: ChangeEvent<HTMLInputElement>) {
    setPlayerName(sanitizePlayerNameInput(event.target.value));
  }

  function handleDifficultyValueChange(value: string) {
    if (!isDifficultyId(value)) {
      return;
    }

    setSelectedDifficulty(value);
  }

  function getStatusLabel(nextStatus: GameStatus): string {
    switch (nextStatus) {
      case "board-cleared":
        return "Cleared";
      case "stuck":
        return "Stuck";
      default:
        return "In Play";
    }
  }

  const visibleLeaderboardRecords = leaderboardRecords.slice(
    leaderboardPage * LEADERBOARD_PAGE_SIZE,
    (leaderboardPage + 1) * LEADERBOARD_PAGE_SIZE,
  );
  const hasLeaderboardSecondPage = leaderboardRecords.length > LEADERBOARD_PAGE_SIZE;
  const leaderboardStartRank = leaderboardPage * LEADERBOARD_PAGE_SIZE;

  return (
    <div ref={shellRef} className="page-stack">
      <section className="panel hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Puzzle Game</p>
          <h1>Collapse Game</h1>
          <p className="intro">
            Clear every connected color group, beat the timer, and submit winning runs to the leaderboard.
          </p>
        </div>
      </section>

      <div className="game-layout">
        <section className="panel board-panel">
          <div className="section-top">
            <div className="section-top-copy">
              <p className="eyebrow">Board</p>
              <h2>
                {getDifficultyLabel(difficulty)} | {activePreset.size.columns} x{" "}
                {activePreset.size.rows} | {activePreset.colorCount} colors
              </h2>
            </div>
            <div className="status-cluster">
              <button className="button button-primary" type="button" onClick={handleNewBoard}>
                New Game
              </button>
              <div className="status-chip" data-status={status}>
                {getStatusLabel(status)}
              </div>
              <div className="board-stat">{formatClickCount(clickCount)}</div>
              <div className="board-timer">{formatDuration(elapsedMs)}</div>
            </div>
          </div>

          <div className="board-stage">
            <div ref={boardScrollRef} className="board-scroll">
              <div className="board-scroll-inner">
                <canvas
                  ref={canvasRef}
                  className="board-canvas"
                  aria-label="Puzzle board"
                  onClick={handleBoardClick}
                />
              </div>
            </div>

            {status !== "playing" ? (
              <div className="board-overlay">
                <div className="board-overlay-card">
                  {status === "board-cleared" ? (
                    <>
                      <p className="overlay-kicker">Board Complete</p>
                      <h3 className="overlay-title">You Win</h3>
                      <p className="overlay-text">
                        Difficulty: {getDifficultyLabel(difficulty)}. Final time:{" "}
                        {formatDuration(elapsedMs)}. Final clicks: {formatClickCount(clickCount)}.
                      </p>

                      <form className="winner-form" onSubmit={handleSubmitWin}>
                        <label className="field-label" htmlFor={nameInputId}>
                          Submit your win
                        </label>
                        <div className="winner-row">
                          <input
                            id={nameInputId}
                            className="winner-input"
                            type="text"
                            maxLength={MAX_PLAYER_NAME_LENGTH}
                            placeholder="Your name"
                            value={playerName}
                            onChange={handlePlayerNameChange}
                            disabled={submitPending || hasSubmittedWin}
                          />
                          <button
                            className="button button-primary winner-submit"
                            type="submit"
                            disabled={submitPending || hasSubmittedWin}
                          >
                            {submitPending ? "Saving..." : "Save Win"}
                          </button>
                        </div>
                        <p className="winner-note">Names are limited to 10 characters.</p>
                        {submitError ? <p className="form-error">{submitError}</p> : null}
                        {submitSuccess ? <p className="form-success">{submitSuccess}</p> : null}
                      </form>
                    </>
                  ) : (
                    <>
                      <p className="overlay-kicker">No Moves Left</p>
                      <h3 className="overlay-title">Game Over</h3>
                      <p className="overlay-text">
                        Difficulty: {getDifficultyLabel(difficulty)}. Final time:{" "}
                        {formatDuration(elapsedMs)}. No connected group of 2 or more remains.
                      </p>
                    </>
                  )}

                  <div className="overlay-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={handleNewBoard}
                    >
                      New Game
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="sidebar">
          <section className="panel setup-panel">
            <p className="eyebrow">Setup</p>
            <h2>Choose difficulty</h2>
            <p className="note-text">Each difficulty locks its own board size and color count.</p>

            <DifficultySelect
              label="Difficulty"
              value={selectedDifficulty}
              summary={getDifficultyDescription(selectedDifficulty)}
              options={DIFFICULTY_ORDER.map((nextDifficulty) => ({
                value: nextDifficulty,
                label: getDifficultyLabel(nextDifficulty),
              }))}
              onValueChange={handleDifficultyValueChange}
              onApply={handleApplyDifficulty}
              applyDisabled={selectedDifficulty === difficulty}
            />
          </section>

          <section className="panel leaderboard-panel">
            <p className="eyebrow">Leaderboard</p>
            <h2>{getDifficultyLabel(difficulty)} wins</h2>
            <p className="note-text">Faster time ranks higher. Fewer clicks break ties.</p>

            <div className="leaderboard-body">
              {leaderboardLoading ? <p className="leaderboard-empty">Loading leaderboard...</p> : null}
              {!leaderboardLoading && leaderboardError ? (
                <p className="leaderboard-empty">{leaderboardError}</p>
              ) : null}
              {!leaderboardLoading && !leaderboardError && leaderboardRecords.length === 0 ? (
                <p className="leaderboard-empty">No wins saved for this difficulty yet.</p>
              ) : null}

              {!leaderboardLoading && !leaderboardError && leaderboardRecords.length > 0 ? (
                <>
                  <div className="leaderboard-list">
                    {visibleLeaderboardRecords.map((entry, index) => (
                      <article className="leaderboard-item" key={entry.id}>
                        <div className="leaderboard-copy">
                          <p className="leaderboard-rank">
                            #{leaderboardStartRank + index + 1} {entry.playerName}
                          </p>
                          <p className="leaderboard-meta">
                            {formatDuration(entry.completionTimeMs)} |{" "}
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="leaderboard-score">{formatClickCount(entry.clickCount)}</p>
                      </article>
                    ))}
                  </div>

                  {hasLeaderboardSecondPage ? (
                    <button
                      className="button leaderboard-page-button"
                      type="button"
                      onClick={() => setLeaderboardPage((current) => (current === 0 ? 1 : 0))}
                    >
                      {leaderboardPage === 0 ? "Show next 5" : "Show first 5"}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

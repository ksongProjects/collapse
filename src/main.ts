import './style.css'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { DifficultySelect } from './components/difficulty-select'
import {
  analyzeBoard,
  createBoardData,
  getStatus,
  normalizeBoardSize,
  playGroup,
  type Board,
  type BoardMetrics,
  type BoardSize,
  type GameStatus,
  type PaletteColor,
} from './game'

type DifficultyId = 'very-easy' | 'easy' | 'medium' | 'hard' | 'very-hard'

interface RuntimeState {
  difficulty: DifficultyId
  size: BoardSize
  colorCount: number
  board: Board
  metrics: BoardMetrics
  palette: readonly PaletteColor[]
  status: GameStatus
  elapsedMs: number
  history: HistoryEntry[]
}

interface HistoryEntry {
  id: number
  difficulty: DifficultyId
  outcome: 'Won' | 'Game Over'
  durationMs: number
  size: BoardSize
  colorCount: number
}

const DIFFICULTY_PRESETS: Record<
  DifficultyId,
  {
    label: string
    size: BoardSize
    colorCount: number
  }
> = {
  'very-easy': {
    label: 'Very Easy',
    size: normalizeBoardSize({ columns: 10, rows: 10 }),
    colorCount: 4,
  },
  easy: {
    label: 'Easy',
    size: normalizeBoardSize({ columns: 20, rows: 20 }),
    colorCount: 5,
  },
  medium: {
    label: 'Medium',
    size: normalizeBoardSize({ columns: 25, rows: 30 }),
    colorCount: 6,
  },
  hard: {
    label: 'Hard',
    size: normalizeBoardSize({ columns: 35, rows: 40 }),
    colorCount: 7,
  },
  'very-hard': {
    label: 'Very Hard',
    size: normalizeBoardSize({ columns: 50, rows: 60 }),
    colorCount: 10,
  },
}

const defaultDifficulty: DifficultyId = 'very-easy'
const defaultSize = DIFFICULTY_PRESETS[defaultDifficulty].size
const defaultColorCount = DIFFICULTY_PRESETS[defaultDifficulty].colorCount
const HISTORY_LIMIT = 10
const DIFFICULTY_ORDER: readonly DifficultyId[] = ['very-easy', 'easy', 'medium', 'hard', 'very-hard']

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <div class="shell">
    <section class="panel hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">TypeScript Web Game Prototype</p>
        <h1>Chromatic Collapse</h1>
        <p class="intro">
          Pick a difficulty and clear every tile before the board locks up.
        </p>
      </div>
      <div class="hero-actions">
        <button id="new-board" class="button button-primary" type="button">New Game</button>
      </div>
    </section>

    <div class="game-layout">
      <section class="panel board-panel">
        <div class="section-top">
          <div>
            <p class="eyebrow">Board</p>
            <h2 id="board-title">Loading board</h2>
          </div>
          <div class="status-cluster">
            <div id="status-chip" class="status-chip">Loading</div>
            <div id="board-timer" class="board-timer">00:00</div>
          </div>
        </div>

        <div class="board-stage">
          <div class="board-scroll">
            <canvas id="game-board" class="board-canvas" aria-label="Puzzle board"></canvas>
          </div>
          <div id="board-overlay" class="board-overlay" hidden>
            <div class="board-overlay-card">
              <p id="overlay-kicker" class="overlay-kicker">Board Complete</p>
              <h3 id="overlay-title" class="overlay-title">You Win</h3>
              <p id="overlay-text" class="overlay-text"></p>
              <div class="overlay-actions">
                <button id="overlay-new-board" class="button button-primary" type="button">New Game</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="sidebar">
        <section class="panel setup-panel">
          <p class="eyebrow">Setup</p>
          <h2>Choose difficulty</h2>
          <p class="note-text">Each difficulty locks its own board size and color count.</p>

          <div id="difficulty-select-root"></div>
        </section>

        <section class="panel history-panel">
          <p class="eyebrow">History</p>
          <h2>Finished games</h2>
          <div id="history-list" class="history-list"></div>
        </section>
      </aside>
    </div>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#game-board')!
const boardScroll = document.querySelector<HTMLDivElement>('.board-scroll')!
const boardTitle = document.querySelector<HTMLHeadingElement>('#board-title')!
const boardTimer = document.querySelector<HTMLDivElement>('#board-timer')!
const difficultySelectHost = document.querySelector<HTMLDivElement>('#difficulty-select-root')!
const newBoardButton = document.querySelector<HTMLButtonElement>('#new-board')!
const statusChip = document.querySelector<HTMLDivElement>('#status-chip')!
const boardOverlay = document.querySelector<HTMLDivElement>('#board-overlay')!
const overlayKicker = document.querySelector<HTMLParagraphElement>('#overlay-kicker')!
const overlayTitle = document.querySelector<HTMLHeadingElement>('#overlay-title')!
const overlayText = document.querySelector<HTMLParagraphElement>('#overlay-text')!
const overlayNewBoardButton = document.querySelector<HTMLButtonElement>('#overlay-new-board')!
const historyList = document.querySelector<HTMLDivElement>('#history-list')!
const ctx = canvas.getContext('2d')!
const difficultySelectRoot = createRoot(difficultySelectHost)

const state: RuntimeState = {
  difficulty: defaultDifficulty,
  size: defaultSize,
  colorCount: defaultColorCount,
  board: createEmptyBoard(defaultSize),
  metrics: analyzeBoard(createEmptyBoard(defaultSize)),
  palette: [],
  status: 'playing',
  elapsedMs: 0,
  history: [],
}

let runStartedAt = 0
let timerHandle: number | null = null
let nextHistoryId = 1
let selectedDifficulty: DifficultyId = defaultDifficulty
let renderCellSize = 12

function createEmptyBoard(size: BoardSize): Board {
  return Array.from({ length: size.rows }, () => Array<number | null>(size.columns).fill(null))
}

function getBoardWidth(): number {
  return state.size.columns * renderCellSize
}

function getBoardHeight(): number {
  return state.size.rows * renderCellSize
}

function configureCanvas(): void {
  const boardScrollStyles = window.getComputedStyle(boardScroll)
  const horizontalPadding =
    Number.parseFloat(boardScrollStyles.paddingLeft) + Number.parseFloat(boardScrollStyles.paddingRight)
  const availableWidth = Math.max(
    state.size.columns,
    Math.floor(boardScroll.clientWidth - horizontalPadding),
  )

  renderCellSize = Math.max(1, Math.floor(availableWidth / state.size.columns))

  const boardWidth = getBoardWidth()
  const boardHeight = getBoardHeight()
  const dpr = window.devicePixelRatio || 1
  canvas.width = boardWidth * dpr
  canvas.height = boardHeight * dpr
  canvas.style.width = `${boardWidth}px`
  canvas.style.height = `${boardHeight}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false
}

function getDifficultySize(difficulty: DifficultyId): BoardSize {
  return DIFFICULTY_PRESETS[difficulty].size
}

function getDifficultyColorCount(difficulty: DifficultyId): number {
  return DIFFICULTY_PRESETS[difficulty].colorCount
}

function getDifficultyLabel(difficulty: DifficultyId): string {
  return DIFFICULTY_PRESETS[difficulty].label
}

function getDifficultyDescription(difficulty: DifficultyId): string {
  const preset = DIFFICULTY_PRESETS[difficulty]
  return `${preset.size.columns} x ${preset.size.rows} | ${preset.colorCount} colors`
}

function isDifficultyId(value: string): value is DifficultyId {
  return DIFFICULTY_ORDER.some((difficulty) => difficulty === value)
}

function readSelectedDifficulty(): DifficultyId {
  return selectedDifficulty
}

function isSetupDirty(): boolean {
  return readSelectedDifficulty() !== state.difficulty
}

function setDifficultySelection(difficulty: DifficultyId): void {
  selectedDifficulty = difficulty
}

function handleDifficultySelection(value: string): void {
  if (!isDifficultyId(value)) {
    return
  }

  selectedDifficulty = value
  render()
}

function renderDifficultyControl(): void {
  difficultySelectRoot.render(
    createElement(DifficultySelect, {
      label: 'Difficulty',
      value: selectedDifficulty,
      summary: getDifficultyDescription(selectedDifficulty),
      options: DIFFICULTY_ORDER.map((difficulty) => ({
        value: difficulty,
        label: getDifficultyLabel(difficulty),
      })),
      onValueChange: handleDifficultySelection,
      onApply: applySetup,
      applyDisabled: !isSetupDirty(),
    }),
  )
}

function loadBoard(): void {
  stopTimer()
  state.size = getDifficultySize(state.difficulty)
  state.colorCount = getDifficultyColorCount(state.difficulty)

  const boardData = createBoardData(state.size, state.colorCount)

  state.size = boardData.size
  state.colorCount = boardData.colorCount
  state.board = boardData.board
  state.metrics = boardData.metrics
  state.palette = boardData.palette
  state.status = getStatus(state.metrics).status
  state.elapsedMs = 0

  setDifficultySelection(state.difficulty)
  configureCanvas()
  startTimer()
  render()
}

function startNewBoard(): void {
  loadBoard()
}

function applySetup(): void {
  const selectedDifficulty = readSelectedDifficulty()

  if (selectedDifficulty === state.difficulty) {
    return
  }

  state.difficulty = selectedDifficulty
  startNewBoard()
}

function handleBoardClick(event: MouseEvent): void {
  if (state.status !== 'playing') {
    return
  }

  const cell = getCellFromEvent(event)

  if (!cell) {
    return
  }

  const move = playGroup(state.board, cell.row, cell.col)

  if (!move) {
    return
  }

  state.board = move.board
  state.metrics = move.metrics
  state.status = getStatus(state.metrics).status

  if (state.status === 'board-cleared') {
    finishRun('Won')
  } else if (state.status === 'stuck') {
    finishRun('Game Over')
  }

  render()
}

function getCellFromEvent(event: MouseEvent): { row: number; col: number } | null {
  const rect = canvas.getBoundingClientRect()

  if (rect.width === 0 || rect.height === 0) {
    return null
  }

  const relativeX = (event.clientX - rect.left) / rect.width
  const relativeY = (event.clientY - rect.top) / rect.height

  if (relativeX < 0 || relativeX > 1 || relativeY < 0 || relativeY > 1) {
    return null
  }

  const col = Math.floor(relativeX * state.size.columns)
  const row = Math.floor(relativeY * state.size.rows)

  if (col < 0 || col >= state.size.columns || row < 0 || row >= state.size.rows) {
    return null
  }

  return { row, col }
}

function render(): void {
  boardTitle.textContent = `${getDifficultyLabel(state.difficulty)} | ${state.size.columns} x ${state.size.rows} | ${state.colorCount} colors`
  statusChip.textContent = getStatusLabel(state.status)
  statusChip.dataset.status = state.status

  renderDifficultyControl()
  renderTimer()
  renderHistory()
  renderOverlay()
  renderBoard()
}

function renderOverlay(): void {
  const isVisible = state.status !== 'playing'
  boardOverlay.hidden = !isVisible

  if (!isVisible) {
    return
  }

  if (state.status === 'board-cleared') {
    overlayKicker.textContent = 'Board Complete'
    overlayTitle.textContent = 'You Win'
    overlayText.textContent = `Difficulty: ${getDifficultyLabel(state.difficulty)}. Final time: ${formatDuration(state.elapsedMs)}.`
    return
  }

  overlayKicker.textContent = 'No Moves Left'
  overlayTitle.textContent = 'Game Over'
  overlayText.textContent =
    `Difficulty: ${getDifficultyLabel(state.difficulty)}. Final time: ${formatDuration(state.elapsedMs)}. No connected group of 2 or more remains.`
}

function renderBoard(): void {
  const boardWidth = getBoardWidth()
  const boardHeight = getBoardHeight()

  const backdrop = ctx.createLinearGradient(0, 0, boardWidth, boardHeight)
  backdrop.addColorStop(0, '#0f172a')
  backdrop.addColorStop(1, '#020617')
  ctx.fillStyle = backdrop
  ctx.fillRect(0, 0, boardWidth, boardHeight)

  for (let row = 0; row < state.size.rows; row += 1) {
    for (let col = 0; col < state.size.columns; col += 1) {
      const x = col * renderCellSize
      const y = row * renderCellSize
      const cell = state.board[row][col]

      ctx.fillStyle = '#111827'
      ctx.fillRect(x, y, renderCellSize, renderCellSize)

      if (cell === null) {
        continue
      }

      const inset = 1
      const innerSize = Math.max(1, renderCellSize - inset * 2)

      ctx.fillStyle = state.palette[cell].hex
      ctx.fillRect(x + inset, y + inset, innerSize, innerSize)
    }
  }
}

function getStatusLabel(status: GameStatus): string {
  switch (status) {
    case 'board-cleared':
      return 'Cleared'
    case 'stuck':
      return 'Stuck'
    default:
      return 'In Play'
  }
}

function startTimer(): void {
  runStartedAt = performance.now()
  state.elapsedMs = 0
  renderTimer()
  timerHandle = window.setInterval(() => {
    state.elapsedMs = Math.floor(performance.now() - runStartedAt)
    renderTimer()
  }, 250)
}

function stopTimer(): void {
  if (timerHandle !== null) {
    window.clearInterval(timerHandle)
    timerHandle = null
  }
}

function finishRun(outcome: HistoryEntry['outcome']): void {
  state.elapsedMs = Math.floor(performance.now() - runStartedAt)
  stopTimer()
  state.history.unshift({
    id: nextHistoryId,
    difficulty: state.difficulty,
    outcome,
    durationMs: state.elapsedMs,
    size: { ...state.size },
    colorCount: state.colorCount,
  })
  nextHistoryId += 1
  state.history = state.history.slice(0, HISTORY_LIMIT)
}

function renderTimer(): void {
  boardTimer.textContent = formatDuration(state.elapsedMs)
}

function renderHistory(): void {
  if (state.history.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No finished games yet.</p>'
    return
  }

  historyList.innerHTML = state.history
    .map(
      (entry) => `
        <article class="history-item" data-outcome="${entry.outcome}">
          <div class="history-copy">
            <p class="history-outcome">${entry.outcome}</p>
            <p class="history-meta">${getDifficultyLabel(entry.difficulty)} | ${entry.size.columns} x ${entry.size.rows} | ${entry.colorCount} colors</p>
          </div>
          <p class="history-time">${formatDuration(entry.durationMs)}</p>
        </article>
      `,
    )
    .join('')
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

newBoardButton.addEventListener('click', startNewBoard)
overlayNewBoardButton.addEventListener('click', startNewBoard)
canvas.addEventListener('click', handleBoardClick)
window.addEventListener('resize', () => {
  configureCanvas()
  renderBoard()
})

configureCanvas()
startNewBoard()

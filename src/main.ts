import './style.css'
import {
  analyzeBoard,
  CELL_SIZE,
  createBoardData,
  DEFAULT_COLORS,
  getStatus,
  MAX_COLORS,
  MIN_COLORS,
  normalizeBoardSize,
  normalizeColorCount,
  playGroup,
  type Board,
  type BoardMetrics,
  type BoardSize,
  type GameStatus,
  type PaletteColor,
} from './game'

type DifficultyId = 'easy' | 'medium' | 'hard'

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
  }
> = {
  easy: {
    label: 'Easy',
    size: normalizeBoardSize({ columns: 15, rows: 20 }),
  },
  medium: {
    label: 'Medium',
    size: normalizeBoardSize({ columns: 25, rows: 30 }),
  },
  hard: {
    label: 'Hard',
    size: normalizeBoardSize({ columns: 35, rows: 40 }),
  },
}

const defaultDifficulty: DifficultyId = 'easy'
const defaultSize = DIFFICULTY_PRESETS[defaultDifficulty].size
const defaultColorCount = normalizeColorCount(DEFAULT_COLORS)
const HISTORY_LIMIT = 10

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
          Pick a difficulty, set the number of colors, and clear every tile before the board locks up.
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
          <div id="status-chip" class="status-chip">Loading</div>
        </div>

        <div class="board-stage">
          <div id="board-timer" class="board-timer">00:00</div>
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
          <h2>Difficulty and colors</h2>
          <p class="note-text">Difficulty presets control board size. Color count changes how crowded the board feels.</p>

          <div class="difficulty-grid">
            <label class="difficulty-option">
              <input class="difficulty-input" type="radio" name="difficulty" value="easy" checked />
              <span class="difficulty-content">
                <span class="difficulty-copy">
                  <span class="difficulty-name">Easy</span>
                  <span class="difficulty-size">15 x 20</span>
                </span>
              </span>
            </label>

            <label class="difficulty-option">
              <input class="difficulty-input" type="radio" name="difficulty" value="medium" />
              <span class="difficulty-content">
                <span class="difficulty-copy">
                  <span class="difficulty-name">Medium</span>
                  <span class="difficulty-size">25 x 30</span>
                </span>
              </span>
            </label>

            <label class="difficulty-option">
              <input class="difficulty-input" type="radio" name="difficulty" value="hard" />
              <span class="difficulty-content">
                <span class="difficulty-copy">
                  <span class="difficulty-name">Hard</span>
                  <span class="difficulty-size">35 x 40</span>
                </span>
              </span>
            </label>
          </div>

          <label class="field" for="colors-input">
            <span class="field-head">
              <span>Colors</span>
              <output id="colors-output" class="range-value">${defaultColorCount}</output>
            </span>
            <input
              id="colors-input"
              class="range-input"
              type="range"
              min="${MIN_COLORS}"
              max="${MAX_COLORS}"
              step="1"
              value="${defaultColorCount}"
            />
          </label>

          <button id="apply-setup" class="button" type="button">Apply Setup</button>
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
const boardTitle = document.querySelector<HTMLHeadingElement>('#board-title')!
const boardTimer = document.querySelector<HTMLDivElement>('#board-timer')!
const difficultyInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="difficulty"]'))
const colorsInput = document.querySelector<HTMLInputElement>('#colors-input')!
const colorsOutput = document.querySelector<HTMLOutputElement>('#colors-output')!
const applySetupButton = document.querySelector<HTMLButtonElement>('#apply-setup')!
const newBoardButton = document.querySelector<HTMLButtonElement>('#new-board')!
const statusChip = document.querySelector<HTMLDivElement>('#status-chip')!
const boardOverlay = document.querySelector<HTMLDivElement>('#board-overlay')!
const overlayKicker = document.querySelector<HTMLParagraphElement>('#overlay-kicker')!
const overlayTitle = document.querySelector<HTMLHeadingElement>('#overlay-title')!
const overlayText = document.querySelector<HTMLParagraphElement>('#overlay-text')!
const overlayNewBoardButton = document.querySelector<HTMLButtonElement>('#overlay-new-board')!
const historyList = document.querySelector<HTMLDivElement>('#history-list')!
const ctx = canvas.getContext('2d')!

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

function createEmptyBoard(size: BoardSize): Board {
  return Array.from({ length: size.rows }, () => Array<number | null>(size.columns).fill(null))
}

function getBoardWidth(): number {
  return state.size.columns * CELL_SIZE
}

function getBoardHeight(): number {
  return state.size.rows * CELL_SIZE
}

function configureCanvas(): void {
  const dpr = window.devicePixelRatio || 1
  canvas.width = getBoardWidth() * dpr
  canvas.height = getBoardHeight() * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function getDifficultySize(difficulty: DifficultyId): BoardSize {
  return DIFFICULTY_PRESETS[difficulty].size
}

function getDifficultyLabel(difficulty: DifficultyId): string {
  return DIFFICULTY_PRESETS[difficulty].label
}

function readSelectedDifficulty(): DifficultyId {
  const selected = difficultyInputs.find((input) => input.checked)?.value

  if (selected === 'medium' || selected === 'hard') {
    return selected
  }

  return 'easy'
}

function readSelectedColorCount(): number {
  return normalizeColorCount(Number(colorsInput.value))
}

function syncSetupControls(): void {
  const selectedDifficulty = readSelectedDifficulty()
  const selectedColorCount = readSelectedColorCount()

  colorsOutput.value = String(selectedColorCount)
  applySetupButton.disabled =
    selectedDifficulty === state.difficulty && selectedColorCount === state.colorCount
}

function setDifficultySelection(difficulty: DifficultyId): void {
  for (const input of difficultyInputs) {
    input.checked = input.value === difficulty
  }
}

function loadBoard(): void {
  stopTimer()
  state.size = getDifficultySize(state.difficulty)

  const boardData = createBoardData(state.size, state.colorCount)

  state.size = boardData.size
  state.colorCount = boardData.colorCount
  state.board = boardData.board
  state.metrics = boardData.metrics
  state.palette = boardData.palette
  state.status = getStatus(state.metrics).status
  state.elapsedMs = 0

  setDifficultySelection(state.difficulty)
  colorsInput.value = String(state.colorCount)
  configureCanvas()
  startTimer()
  render()
}

function startNewBoard(): void {
  loadBoard()
}

function applySetup(): void {
  const selectedDifficulty = readSelectedDifficulty()
  const selectedColorCount = readSelectedColorCount()

  if (selectedDifficulty === state.difficulty && selectedColorCount === state.colorCount) {
    return
  }

  state.difficulty = selectedDifficulty
  state.colorCount = selectedColorCount
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
  boardTitle.textContent =
    `${getDifficultyLabel(state.difficulty)} | ${state.size.columns} x ${state.size.rows} | ${state.colorCount} colors`
  statusChip.textContent = getStatusLabel(state.status)
  statusChip.dataset.status = state.status

  syncSetupControls()
  renderTimer()
  renderHistory()
  renderOverlay()
  renderBoard()
}

function renderOverlay(): void {
  const isVisible = state.status !== 'playing'
  boardOverlay.hidden = !isVisible
  boardOverlay.dataset.status = state.status

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

  ctx.clearRect(0, 0, boardWidth, boardHeight)

  const backdrop = ctx.createLinearGradient(0, 0, boardWidth, boardHeight)
  backdrop.addColorStop(0, '#0f172a')
  backdrop.addColorStop(1, '#020617')
  ctx.fillStyle = backdrop
  ctx.fillRect(0, 0, boardWidth, boardHeight)

  for (let row = 0; row < state.size.rows; row += 1) {
    for (let col = 0; col < state.size.columns; col += 1) {
      const x = col * CELL_SIZE
      const y = row * CELL_SIZE
      const cell = state.board[row][col]

      ctx.fillStyle = 'rgba(148, 163, 184, 0.06)'
      ctx.fillRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)

      if (cell === null) {
        continue
      }

      const inset = 0.35
      const innerSize = CELL_SIZE - inset * 2

      ctx.fillStyle = state.palette[cell].hex
      ctx.fillRect(x + inset, y + inset, innerSize, innerSize)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.fillRect(x + inset + 0.45, y + inset + 0.45, innerSize - 0.9, Math.max(1, innerSize * 0.18))

      ctx.strokeStyle = 'rgba(2, 6, 23, 0.28)'
      ctx.lineWidth = 0.3
      ctx.strokeRect(x + inset, y + inset, innerSize, innerSize)
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

for (const input of difficultyInputs) {
  input.addEventListener('change', syncSetupControls)
}

colorsInput.addEventListener('input', syncSetupControls)
applySetupButton.addEventListener('click', applySetup)
newBoardButton.addEventListener('click', startNewBoard)
overlayNewBoardButton.addEventListener('click', startNewBoard)
canvas.addEventListener('click', handleBoardClick)
window.addEventListener('resize', () => {
  configureCanvas()
  renderBoard()
})

configureCanvas()
syncSetupControls()
startNewBoard()

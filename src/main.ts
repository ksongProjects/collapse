import './style.css'
import {
  analyzeBoard,
  CELL_SIZE,
  createBoardData,
  DEFAULT_COLORS,
  getStatus,
  MAX_COLUMNS,
  MAX_COLORS,
  MAX_ROWS,
  MIN_COLORS,
  MIN_COLUMNS,
  MIN_ROWS,
  normalizeBoardSize,
  normalizeColorCount,
  playGroup,
  type Board,
  type BoardMetrics,
  type BoardSize,
  type GameStatus,
  type PaletteColor,
} from './game'

interface RuntimeState {
  size: BoardSize
  colorCount: number
  board: Board
  metrics: BoardMetrics
  palette: readonly PaletteColor[]
  status: GameStatus
  message: string
}

const defaultSize = normalizeBoardSize({
  columns: 15,
  rows: 20,
})
const defaultColorCount = normalizeColorCount(DEFAULT_COLORS)

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <div class="shell">
    <section class="panel hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">TypeScript web game prototype</p>
        <h2>Chromatic Collapse</h2>
      </div>
      <div class="hero-actions">
        <button id="new-board" class="button button-ghost" type="button">New Board</button>
        <button id="restart-board" class="button" type="button">Restart Board</button>
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
          <div class="board-scroll">
            <canvas id="game-board" class="board-canvas" aria-label="Puzzle board"></canvas>
          </div>
          <div id="board-overlay" class="board-overlay" hidden>
            <div class="board-overlay-card">
              <p id="overlay-kicker" class="overlay-kicker">Board Complete</p>
              <h3 id="overlay-title" class="overlay-title">You Win</h3>
              <p id="overlay-text" class="overlay-text"></p>
              <div class="overlay-actions">
                <button id="overlay-new-board" class="button button-ghost" type="button">New Board</button>
                <button id="overlay-restart-board" class="button" type="button">Restart Board</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="sidebar">
        <section class="panel size-panel">
          <p class="eyebrow">Setup</p>
          <h2>Choose your grid and colors</h2>

          <div class="size-controls">
            <label class="field" for="columns-input">
              <span class="field-head">
                <span>Columns</span>
                <output id="columns-output" class="range-value">${defaultSize.columns}</output>
              </span>
              <input
                id="columns-input"
                class="range-input"
                type="range"
                min="${MIN_COLUMNS}"
                max="${MAX_COLUMNS}"
                step="5"
                value="${defaultSize.columns}"
              />
            </label>

            <label class="field" for="rows-input">
              <span class="field-head">
                <span>Rows</span>
                <output id="rows-output" class="range-value">${defaultSize.rows}</output>
              </span>
              <input
                id="rows-input"
                class="range-input"
                type="range"
                min="${MIN_ROWS}"
                max="${MAX_ROWS}"
                step="5"
                value="${defaultSize.rows}"
              />
            </label>

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
          </div>

          <button id="apply-setup" class="button" type="button">Apply Setup</button>
        </section>
      </aside>
    </div>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#game-board')!
const boardTitle = document.querySelector<HTMLHeadingElement>('#board-title')!
const columnsInput = document.querySelector<HTMLInputElement>('#columns-input')!
const rowsInput = document.querySelector<HTMLInputElement>('#rows-input')!
const colorsInput = document.querySelector<HTMLInputElement>('#colors-input')!
const columnsOutput = document.querySelector<HTMLOutputElement>('#columns-output')!
const rowsOutput = document.querySelector<HTMLOutputElement>('#rows-output')!
const colorsOutput = document.querySelector<HTMLOutputElement>('#colors-output')!
const applySetupButton = document.querySelector<HTMLButtonElement>('#apply-setup')!
const newBoardButton = document.querySelector<HTMLButtonElement>('#new-board')!
const restartBoardButton = document.querySelector<HTMLButtonElement>('#restart-board')!
const statusChip = document.querySelector<HTMLDivElement>('#status-chip')!
const boardOverlay = document.querySelector<HTMLDivElement>('#board-overlay')!
const overlayKicker = document.querySelector<HTMLParagraphElement>('#overlay-kicker')!
const overlayTitle = document.querySelector<HTMLHeadingElement>('#overlay-title')!
const overlayText = document.querySelector<HTMLParagraphElement>('#overlay-text')!
const overlayNewBoardButton = document.querySelector<HTMLButtonElement>('#overlay-new-board')!
const overlayRestartBoardButton = document.querySelector<HTMLButtonElement>('#overlay-restart-board')!
const ctx = canvas.getContext('2d')!

const state: RuntimeState = {
  size: defaultSize,
  colorCount: defaultColorCount,
  board: createEmptyBoard(defaultSize),
  metrics: analyzeBoard(createEmptyBoard(defaultSize)),
  palette: [],
  status: 'playing',
  message: '',
}

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

function readSelectedSize(): BoardSize {
  return normalizeBoardSize({
    columns: Number(columnsInput.value),
    rows: Number(rowsInput.value),
  })
}

function readSelectedColorCount(): number {
  return normalizeColorCount(Number(colorsInput.value))
}

function syncSetupControls(): void {
  const selectedSize = readSelectedSize()
  const selectedColorCount = readSelectedColorCount()
  columnsOutput.value = String(selectedSize.columns)
  rowsOutput.value = String(selectedSize.rows)
  colorsOutput.value = String(selectedColorCount)
  applySetupButton.disabled =
    selectedSize.columns === state.size.columns &&
    selectedSize.rows === state.size.rows &&
    selectedColorCount === state.colorCount
}

function loadBoard(message: string): void {
  const boardData = createBoardData(state.size, state.colorCount)

  state.size = boardData.size
  state.colorCount = boardData.colorCount
  state.board = boardData.board
  state.metrics = boardData.metrics
  state.palette = boardData.palette
  state.status = getStatus(state.metrics).status
  state.message = message

  columnsInput.value = String(state.size.columns)
  rowsInput.value = String(state.size.rows)
  colorsInput.value = String(state.colorCount)
  configureCanvas()
  render()
}

function startNewBoard(
  message = 'Fresh board ready. Remove every tile to win.',
): void {
  loadBoard(message)
}

function restartBoard(): void {
  loadBoard('Board restarted. Remove every tile to win.')
}

function applySetup(): void {
  const selectedSize = readSelectedSize()
  const selectedColorCount = readSelectedColorCount()

  if (
    selectedSize.columns === state.size.columns &&
    selectedSize.rows === state.size.rows &&
    selectedColorCount === state.colorCount
  ) {
    return
  }

  state.size = selectedSize
  state.colorCount = selectedColorCount
  startNewBoard(`Board set to ${selectedSize.columns} x ${selectedSize.rows} with ${selectedColorCount} colors.`)
}

function handleBoardClick(event: MouseEvent): void {
  const cell = getCellFromEvent(event)

  if (!cell) {
    return
  }

  const move = playGroup(state.board, cell.row, cell.col)

  if (!move) {
    syncStatus('That square is stranded for now. Only connected groups of 2 or more can be cleared.')
    render()
    return
  }

  state.board = move.board
  state.metrics = move.metrics

  const statusInfo = getStatus(state.metrics)
  state.status = statusInfo.status

  if (state.status === 'board-cleared') {
    state.message = 'Board cleared. You win.'
  } else if (state.status === 'stuck') {
    state.message = `Removed ${move.group.size} squares. No removable groups remain, so this board cannot be completed.`
  } else {
    state.message = `Removed ${move.group.size} squares. Keep clearing until the board is empty.`
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
  boardTitle.textContent = `${state.size.columns} x ${state.size.rows} field with ${state.colorCount} colors`
  statusChip.textContent = getStatusLabel(state.status)
  statusChip.dataset.status = state.status

  syncSetupControls()
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
    overlayText.textContent = 'Every tile is gone. Start another board or replay this setup.'
    return
  }

  overlayKicker.textContent = 'No Moves Left'
  overlayTitle.textContent = 'Game Over'
  overlayText.textContent = 'The remaining tiles cannot be removed because no connected group of 2 or more is left.'
}

function renderBoard(): void {
  const boardWidth = getBoardWidth()
  const boardHeight = getBoardHeight()

  ctx.clearRect(0, 0, boardWidth, boardHeight)

  const backdrop = ctx.createLinearGradient(0, 0, boardWidth, boardHeight)
  backdrop.addColorStop(0, '#0f2b46')
  backdrop.addColorStop(1, '#061727')
  ctx.fillStyle = backdrop
  ctx.fillRect(0, 0, boardWidth, boardHeight)

  for (let row = 0; row < state.size.rows; row += 1) {
    for (let col = 0; col < state.size.columns; col += 1) {
      const x = col * CELL_SIZE
      const y = row * CELL_SIZE
      const cell = state.board[row][col]

      ctx.fillStyle = 'rgba(255, 255, 255, 0.028)'
      ctx.fillRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)

      if (cell === null) {
        continue
      }

      const inset = 0.35
      const innerSize = CELL_SIZE - inset * 2

      ctx.fillStyle = state.palette[cell].hex
      ctx.fillRect(x + inset, y + inset, innerSize, innerSize)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
      ctx.fillRect(x + inset + 0.45, y + inset + 0.45, innerSize - 0.9, Math.max(1, innerSize * 0.22))

      ctx.strokeStyle = 'rgba(2, 16, 29, 0.22)'
      ctx.lineWidth = 0.35
      ctx.strokeRect(x + inset, y + inset, innerSize, innerSize)
    }
  }
}

function syncStatus(message: string): void {
  state.status = getStatus(state.metrics).status
  state.message = message
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

columnsInput.addEventListener('input', syncSetupControls)
rowsInput.addEventListener('input', syncSetupControls)
colorsInput.addEventListener('input', syncSetupControls)
applySetupButton.addEventListener('click', applySetup)
newBoardButton.addEventListener('click', () => startNewBoard())
restartBoardButton.addEventListener('click', restartBoard)
overlayNewBoardButton.addEventListener('click', () => startNewBoard())
overlayRestartBoardButton.addEventListener('click', restartBoard)
canvas.addEventListener('click', handleBoardClick)
window.addEventListener('resize', () => {
  configureCanvas()
  renderBoard()
})

configureCanvas()
syncSetupControls()
startNewBoard()

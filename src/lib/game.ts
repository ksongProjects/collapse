export const MIN_COLUMNS = 10;
export const MAX_COLUMNS = 50;
export const MIN_ROWS = 10;
export const MAX_ROWS = 60;
export const MIN_COLORS = 3;
export const MAX_COLORS = 10;

export interface BoardSize {
  columns: number;
  rows: number;
}

export interface PaletteColor {
  name: string;
  hex: string;
}

export type Cell = number | null;
export type Board = Cell[][];

export interface Position {
  row: number;
  col: number;
}

export interface Group {
  color: number;
  cells: Position[];
  size: number;
}

export interface AnimatedCell {
  color: number;
  row: number;
  col: number;
}

export interface MovedCell {
  color: number;
  from: Position;
  to: Position;
}

export interface BoardTransition {
  removed: AnimatedCell[];
  moved: MovedCell[];
}

export interface BoardMetrics {
  remainingCells: number;
  removableGroups: number;
  solitaryCells: number;
  largestGroup: number;
  emptyColumns: number;
}

export interface BoardData {
  board: Board;
  metrics: BoardMetrics;
  palette: readonly PaletteColor[];
  size: BoardSize;
  colorCount: number;
}

export interface MoveResult {
  board: Board;
  metrics: BoardMetrics;
  group: Group;
  transition: BoardTransition;
}

export type GameStatus = "playing" | "board-cleared" | "stuck";

const COLOR_LIBRARY: readonly PaletteColor[] = [
  { name: "Coral", hex: "#d78888" },
  { name: "Peach", hex: "#d79b74" },
  { name: "Gold", hex: "#c9ae68" },
  { name: "Olive", hex: "#a7b868" },
  { name: "Sage", hex: "#8fad70" },
  { name: "Mint", hex: "#74b38d" },
  { name: "Teal", hex: "#65b1a1" },
  { name: "Aqua", hex: "#6eafbf" },
  { name: "Sky", hex: "#779fd0" },
  { name: "Periwinkle", hex: "#8d97d7" },
  { name: "Lavender", hex: "#ab92d5" },
  { name: "Mauve", hex: "#c287be" },
] as const;

export function normalizeBoardSize(size: BoardSize): BoardSize {
  return {
    columns: clamp(Math.round(size.columns), MIN_COLUMNS, MAX_COLUMNS),
    rows: clamp(Math.round(size.rows), MIN_ROWS, MAX_ROWS),
  };
}

export function normalizeColorCount(colorCount: number): number {
  return clamp(Math.round(colorCount), MIN_COLORS, MAX_COLORS);
}

export function createBoardData(size: BoardSize, colorCount: number): BoardData {
  const normalizedSize = normalizeBoardSize(size);
  const normalizedColorCount = normalizeColorCount(colorCount);
  const palette = getPalette(normalizedColorCount);
  const minRemovableGroups = Math.max(10, Math.floor(getArea(normalizedSize) / 20));
  let board = generateBoard(palette.length, normalizedSize);
  let metrics = analyzeBoard(board);
  let attempts = 0;

  while (
    (metrics.removableGroups < minRemovableGroups || metrics.largestGroup < 5) &&
    attempts < 10
  ) {
    board = generateBoard(palette.length, normalizedSize);
    metrics = analyzeBoard(board);
    attempts += 1;
  }

  return {
    board,
    metrics,
    palette,
    size: normalizedSize,
    colorCount: normalizedColorCount,
  };
}

export function getPalette(colorCount: number): readonly PaletteColor[] {
  const targetCount = Math.min(normalizeColorCount(colorCount), COLOR_LIBRARY.length);
  const candidates = [...COLOR_LIBRARY];
  shuffle(candidates);

  const selected: PaletteColor[] = [candidates.shift()!];

  while (selected.length < targetCount && candidates.length > 0) {
    let bestIndex = 0;
    let bestDistance = -1;

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const nearestDistance = selected.reduce((smallest, current) => {
        return Math.min(smallest, getHueDistance(candidate.hex, current.hex));
      }, 180);

      if (nearestDistance > bestDistance) {
        bestDistance = nearestDistance;
        bestIndex = index;
      }
    }

    selected.push(candidates.splice(bestIndex, 1)[0]);
  }

  shuffle(selected);
  return selected;
}

export function getGroupAt(board: Board, row: number, col: number): Group | null {
  const size = getBoardSize(board);

  if (!isInside(row, col, size)) {
    return null;
  }

  const color = board[row][col];

  if (color === null) {
    return null;
  }

  const queue: Position[] = [{ row, col }];
  const visited = new Set<number>([toIndex(row, col, size.columns)]);
  const cells: Position[] = [];

  while (queue.length > 0) {
    const current = queue.pop()!;
    cells.push(current);

    for (const neighbor of getNeighbors(current.row, current.col, size)) {
      const key = toIndex(neighbor.row, neighbor.col, size.columns);

      if (visited.has(key) || board[neighbor.row][neighbor.col] !== color) {
        continue;
      }

      visited.add(key);
      queue.push(neighbor);
    }
  }

  return {
    color,
    cells,
    size: cells.length,
  };
}

export function playGroup(board: Board, row: number, col: number): MoveResult | null {
  const group = getGroupAt(board, row, col);

  if (!group || group.size <= 1) {
    return null;
  }

  const nextBoard = cloneBoard(board);
  const transition = buildBoardTransition(board, group);

  for (const cell of group.cells) {
    nextBoard[cell.row][cell.col] = null;
  }

  collapseBoard(nextBoard);

  return {
    board: nextBoard,
    metrics: analyzeBoard(nextBoard),
    group,
    transition,
  };
}

export function analyzeBoard(board: Board): BoardMetrics {
  const size = getBoardSize(board);
  const visited = Array.from({ length: size.rows }, () => Array(size.columns).fill(false));
  let remainingCells = 0;
  let removableGroups = 0;
  let solitaryCells = 0;
  let largestGroup = 0;

  for (let row = 0; row < size.rows; row += 1) {
    for (let col = 0; col < size.columns; col += 1) {
      if (board[row][col] === null) {
        continue;
      }

      remainingCells += 1;

      if (visited[row][col]) {
        continue;
      }

      const group = floodGroup(board, row, col, visited);
      largestGroup = Math.max(largestGroup, group.size);

      if (group.size > 1) {
        removableGroups += 1;
      } else {
        solitaryCells += 1;
      }
    }
  }

  let emptyColumns = 0;

  for (let col = 0; col < size.columns; col += 1) {
    let hasCell = false;

    for (let row = 0; row < size.rows; row += 1) {
      if (board[row][col] !== null) {
        hasCell = true;
        break;
      }
    }

    if (!hasCell) {
      emptyColumns += 1;
    }
  }

  return {
    remainingCells,
    removableGroups,
    solitaryCells,
    largestGroup,
    emptyColumns,
  };
}

export function getStatus(metrics: BoardMetrics): {
  status: GameStatus;
  message: string;
} {
  if (metrics.remainingCells === 0) {
    return {
      status: "board-cleared",
      message: "Board cleared. You win.",
    };
  }

  if (metrics.removableGroups === 0) {
    return {
      status: "stuck",
      message: "No removable groups remain. Start a new board or change the setup to try again.",
    };
  }

  return {
    status: "playing",
    message: "Clear every tile to win. Only connected groups of 2 or more squares can be removed.",
  };
}

function generateBoard(colorCount: number, size: BoardSize): Board {
  const board = createEmptyBoard(size.rows, size.columns);
  const seeds = createAllPositions(size);
  shuffle(seeds);

  for (const seed of seeds) {
    if (board[seed.row][seed.col] !== null) {
      continue;
    }

    const cluster = growCluster(board, seed, chooseShapeSize());
    const color = chooseColor(board, cluster, colorCount);

    for (const cell of cluster) {
      board[cell.row][cell.col] = color;
    }
  }

  return board;
}

function growCluster(board: Board, seed: Position, targetSize: number): Position[] {
  const size = getBoardSize(board);
  const cluster: Position[] = [seed];
  const clusterSet = new Set<number>([toIndex(seed.row, seed.col, size.columns)]);

  while (cluster.length < targetSize) {
    const candidateMap = new Map<number, { cell: Position; weight: number }>();

    for (const cell of cluster) {
      for (const neighbor of getNeighbors(cell.row, cell.col, size)) {
        const key = toIndex(neighbor.row, neighbor.col, size.columns);

        if (clusterSet.has(key) || board[neighbor.row][neighbor.col] !== null) {
          continue;
        }

        const touchingCluster = countTouchingCluster(neighbor, clusterSet, size);
        const towardBottomBias = neighbor.row >= seed.row ? 1.15 : 1;
        const edgePenalty =
          neighbor.row === 0 ||
          neighbor.col === 0 ||
          neighbor.row === size.rows - 1 ||
          neighbor.col === size.columns - 1
            ? 0.92
            : 1;

        candidateMap.set(key, {
          cell: neighbor,
          weight: touchingCluster * towardBottomBias * edgePenalty,
        });
      }
    }

    if (candidateMap.size === 0) {
      break;
    }

    const choice = pickWeighted([...candidateMap.values()]);
    cluster.push(choice.cell);
    clusterSet.add(toIndex(choice.cell.row, choice.cell.col, size.columns));
  }

  return cluster;
}

function chooseColor(board: Board, cluster: Position[], colorCount: number): number {
  const size = getBoardSize(board);
  const contactCounts = Array.from({ length: colorCount }, () => 0);
  const clusterSet = new Set<number>(
    cluster.map((cell) => toIndex(cell.row, cell.col, size.columns)),
  );

  for (const cell of cluster) {
    for (const neighbor of getNeighbors(cell.row, cell.col, size)) {
      const neighborKey = toIndex(neighbor.row, neighbor.col, size.columns);
      const neighborColor = board[neighbor.row][neighbor.col];

      if (neighborColor === null || clusterSet.has(neighborKey)) {
        continue;
      }

      contactCounts[neighborColor] += 1;
    }
  }

  const safestContact = Math.min(...contactCounts);
  const safestColors = contactCounts
    .map((count, index) => ({ count, index }))
    .filter((entry) => entry.count === safestContact)
    .map((entry) => entry.index);

  return safestColors[Math.floor(Math.random() * safestColors.length)];
}

function chooseShapeSize(): number {
  const weights = [12, 20, 24, 16, 10, 6, 3];

  return pickWeighted(
    weights.map((weight, index) => ({
      cell: { row: 0, col: index + 1 },
      weight,
    })),
  ).cell.col;
}

function collapseBoard(board: Board): void {
  collapseGrid(board);
}

function buildBoardTransition(board: Board, group: Group): BoardTransition {
  const size = getBoardSize(board);
  const removedKeys = new Set(group.cells.map((cell) => toIndex(cell.row, cell.col, size.columns)));
  const tokenBoard = board.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      if (cell === null || removedKeys.has(toIndex(rowIndex, colIndex, size.columns))) {
        return null;
      }

      return {
        id: toIndex(rowIndex, colIndex, size.columns),
        color: cell,
      };
    }),
  );
  const removed = group.cells.map((cell) => ({
    color: group.color,
    row: cell.row,
    col: cell.col,
  }));

  collapseGrid(tokenBoard);

  const moved: MovedCell[] = [];

  for (let row = 0; row < size.rows; row += 1) {
    for (let col = 0; col < size.columns; col += 1) {
      const token = tokenBoard[row][col];

      if (token === null) {
        continue;
      }

      const from = {
        row: Math.floor(token.id / size.columns),
        col: token.id % size.columns,
      };

      if (from.row === row && from.col === col) {
        continue;
      }

      moved.push({
        color: token.color,
        from,
        to: { row, col },
      });
    }
  }

  return {
    removed,
    moved,
  };
}

function collapseGrid<T>(board: (T | null)[][]): void {
  const size = getBoardSize(board);

  for (let col = 0; col < size.columns; col += 1) {
    let writeRow = size.rows - 1;

    for (let row = size.rows - 1; row >= 0; row -= 1) {
      const value = board[row][col];

      if (value === null) {
        continue;
      }

      if (writeRow !== row) {
        board[writeRow][col] = value;
        board[row][col] = null;
      }

      writeRow -= 1;
    }

    for (let row = writeRow; row >= 0; row -= 1) {
      board[row][col] = null;
    }
  }

  let writeCol = 0;

  for (let col = 0; col < size.columns; col += 1) {
    let hasCell = false;

    for (let row = 0; row < size.rows; row += 1) {
      if (board[row][col] !== null) {
        hasCell = true;
        break;
      }
    }

    if (!hasCell) {
      continue;
    }

    if (writeCol !== col) {
      for (let row = 0; row < size.rows; row += 1) {
        board[row][writeCol] = board[row][col];
        board[row][col] = null;
      }
    }

    writeCol += 1;
  }

  for (let col = writeCol; col < size.columns; col += 1) {
    for (let row = 0; row < size.rows; row += 1) {
      board[row][col] = null;
    }
  }
}

function floodGroup(board: Board, row: number, col: number, visited?: boolean[][]): Group {
  const size = getBoardSize(board);
  const color = board[row][col];

  if (color === null) {
    return {
      color: -1,
      cells: [],
      size: 0,
    };
  }

  const queue: Position[] = [{ row, col }];
  const cells: Position[] = [];
  const seen = new Set<number>([toIndex(row, col, size.columns)]);

  if (visited) {
    visited[row][col] = true;
  }

  while (queue.length > 0) {
    const current = queue.pop()!;
    cells.push(current);

    for (const neighbor of getNeighbors(current.row, current.col, size)) {
      const key = toIndex(neighbor.row, neighbor.col, size.columns);

      if (seen.has(key) || board[neighbor.row][neighbor.col] !== color) {
        continue;
      }

      seen.add(key);

      if (visited) {
        visited[neighbor.row][neighbor.col] = true;
      }

      queue.push(neighbor);
    }
  }

  return {
    color,
    cells,
    size: cells.length,
  };
}

function createEmptyBoard(rows: number, columns: number): Board {
  return Array.from({ length: rows }, () => Array<Cell>(columns).fill(null));
}

function createAllPositions(size: BoardSize): Position[] {
  const positions: Position[] = [];

  for (let row = 0; row < size.rows; row += 1) {
    for (let col = 0; col < size.columns; col += 1) {
      positions.push({ row, col });
    }
  }

  return positions;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function countTouchingCluster(cell: Position, clusterSet: Set<number>, size: BoardSize): number {
  let touching = 0;

  for (const neighbor of getNeighbors(cell.row, cell.col, size)) {
    if (clusterSet.has(toIndex(neighbor.row, neighbor.col, size.columns))) {
      touching += 1;
    }
  }

  return Math.max(1, touching);
}

function getNeighbors(row: number, col: number, size: BoardSize): Position[] {
  const neighbors: Position[] = [];

  if (row > 0) {
    neighbors.push({ row: row - 1, col });
  }

  if (row < size.rows - 1) {
    neighbors.push({ row: row + 1, col });
  }

  if (col > 0) {
    neighbors.push({ row, col: col - 1 });
  }

  if (col < size.columns - 1) {
    neighbors.push({ row, col: col + 1 });
  }

  return neighbors;
}

function getBoardSize(board: Array<Array<unknown>>): BoardSize {
  return {
    rows: board.length,
    columns: board[0]?.length ?? 0,
  };
}

function getArea(size: BoardSize): number {
  return size.columns * size.rows;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let threshold = Math.random() * totalWeight;

  for (const item of items) {
    threshold -= item.weight;

    if (threshold <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function shuffle<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function getHueDistance(leftHex: string, rightHex: string): number {
  const leftHue = getHue(leftHex);
  const rightHue = getHue(rightHex);
  const rawDistance = Math.abs(leftHue - rightHue);

  return Math.min(rawDistance, 360 - rawDistance);
}

function getHue(hex: string): number {
  const { red, green, blue } = hexToRgb(hex);
  const redChannel = red / 255;
  const greenChannel = green / 255;
  const blueChannel = blue / 255;
  const maxChannel = Math.max(redChannel, greenChannel, blueChannel);
  const minChannel = Math.min(redChannel, greenChannel, blueChannel);
  const delta = maxChannel - minChannel;

  if (delta === 0) {
    return 0;
  }

  let hue = 0;

  if (maxChannel === redChannel) {
    hue = ((greenChannel - blueChannel) / delta) % 6;
  } else if (maxChannel === greenChannel) {
    hue = (blueChannel - redChannel) / delta + 2;
  } else {
    hue = (redChannel - greenChannel) / delta + 4;
  }

  return (hue * 60 + 360) % 360;
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return { red, green, blue };
}

function isInside(row: number, col: number, size: BoardSize): boolean {
  return row >= 0 && row < size.rows && col >= 0 && col < size.columns;
}

function toIndex(row: number, col: number, columns: number): number {
  return row * columns + col;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

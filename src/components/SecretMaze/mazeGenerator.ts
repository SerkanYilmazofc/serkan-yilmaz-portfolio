/** 0 = wall, 1 = path */
export type Cell = 0 | 1;

export type MazeData = {
  cols: number;
  rows: number;
  grid: Cell[][];
  start: { c: number; r: number };
  end: { c: number; r: number };
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Recursive backtracking maze — always solvable. */
export function generateMaze(cols = 31, rows = 21): MazeData {
  // Ensure odd dimensions for proper carving
  const C = cols % 2 === 0 ? cols + 1 : cols;
  const R = rows % 2 === 0 ? rows + 1 : rows;

  const grid: Cell[][] = Array.from({ length: R }, () =>
    Array.from({ length: C }, () => 0 as Cell),
  );

  const inBounds = (c: number, r: number) => c > 0 && r > 0 && c < C - 1 && r < R - 1;

  const carve = (c: number, r: number) => {
    grid[r][c] = 1;
    const dirs = shuffle([
      [0, -2],
      [0, 2],
      [-2, 0],
      [2, 0],
    ] as const);

    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (!inBounds(nc, nr)) continue;
      if (grid[nr][nc] === 1) continue;
      grid[r + dr / 2][c + dc / 2] = 1;
      carve(nc, nr);
    }
  };

  carve(1, 1);

  // Start near top-left path, end near bottom-right path
  const start = { c: 1, r: 1 };
  let end = { c: C - 2, r: R - 2 };
  if (grid[end.r][end.c] !== 1) {
    // find nearest path cell
    outer: for (let r = R - 2; r >= 1; r--) {
      for (let c = C - 2; c >= 1; c--) {
        if (grid[r][c] === 1) {
          end = { c, r };
          break outer;
        }
      }
    }
  }

  grid[start.r][start.c] = 1;
  grid[end.r][end.c] = 1;

  return { cols: C, rows: R, grid, start, end };
}

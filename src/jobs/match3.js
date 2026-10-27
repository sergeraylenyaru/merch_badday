export const BOARD_SIZE = 6;
export const PRODUCT_NAMES = ['ЧАЙ', 'СОК', 'КРУПА', 'ВОДА', 'КОФЕ'];
export const PLANOGRAM_GOALS = [6, 6, 6];

function random(game, max) {
  game.seed = (Math.imul(game.seed, 1664525) + 1013904223) >>> 0;
  return Math.floor(game.seed / 4294967296 * max);
}
export function findMatches(board) {
  const result = new Set();
  for (let row = 0; row < BOARD_SIZE; row++) for (let col = 0; col < BOARD_SIZE; col++) {
    const index = row * BOARD_SIZE + col, value = board[index];
    if (value === null || value === undefined) continue;
    if (col <= BOARD_SIZE - 3 && board[index + 1] === value && board[index + 2] === value) {
      for (let x = col; x < BOARD_SIZE && board[row * BOARD_SIZE + x] === value; x++) result.add(row * BOARD_SIZE + x);
    }
    if (row <= BOARD_SIZE - 3 && board[index + BOARD_SIZE] === value && board[index + BOARD_SIZE * 2] === value) {
      for (let y = row; y < BOARD_SIZE && board[y * BOARD_SIZE + col] === value; y++) result.add(y * BOARD_SIZE + col);
    }
  }
  return [...result];
}
export function adjacent(a, b) {
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < 36 && b < 36
    && Math.abs(Math.floor(a / 6) - Math.floor(b / 6)) + Math.abs(a % 6 - b % 6) === 1;
}
export function possibleSwaps(board) {
  const swaps = [];
  for (let a = 0; a < 36; a++) for (const b of [a + 1, a + 6]) {
    if (!adjacent(a, b) || board[a] === board[b]) continue;
    const copy = [...board];
    [copy[a], copy[b]] = [copy[b], copy[a]];
    if (findMatches(copy).length) swaps.push([a, b]);
  }
  return swaps;
}
function freshBoard(game) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const board = [];
    for (let i = 0; i < 36; i++) {
      const allowed = [0, 1, 2, 3, 4].filter((value) => !(i % 6 >= 2 && board[i - 1] === value && board[i - 2] === value)
        && !(i >= 12 && board[i - 6] === value && board[i - 12] === value));
      board.push(allowed[random(game, allowed.length)]);
    }
    if (possibleSwaps(board).length) return board;
  }
  throw new Error('Could not prepare a playable planogram');
}
export function newPlanogram(seed = 19071) {
  const game = { seed: seed >>> 0, board: [], moves: 18, collected: [0, 0, 0, 0, 0], score: 0 };
  game.board = freshBoard(game);
  return game;
}
export function planogramWon(game) {
  return PLANOGRAM_GOALS.every((goal, product) => game.collected[product] >= goal);
}
export function swapProducts(game, a, b) {
  if (!adjacent(a, b) || game.moves <= 0 || planogramWon(game)) return { valid: false, reason: 'Выберите два соседних товара.' };
  const swapped = [...game.board];
  [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
  let matches = findMatches(swapped);
  if (!matches.length) return { valid: false, reason: 'Нужен ряд хотя бы из трёх одинаковых товаров. Ход не потрачен.' };
  game.moves--;
  game.board = swapped;
  const events = [];
  for (let cascade = 0; matches.length && cascade < 100; cascade++) {
    const before = [...game.board];
    for (const index of matches) game.collected[game.board[index]]++;
    game.score += matches.length * 10 * (cascade + 1);
    const removed = new Set(matches);
    for (let col = 0; col < 6; col++) {
      const column = [];
      for (let row = 5; row >= 0; row--) if (!removed.has(row * 6 + col)) column.push(game.board[row * 6 + col]);
      for (let row = 5; row >= 0; row--) game.board[row * 6 + col] = column[5 - row] ?? random(game, 5);
    }
    events.push({ before, cleared: matches, after: [...game.board] });
    matches = findMatches(game.board);
  }
  let shuffled = false;
  if (matches.length || (!possibleSwaps(game.board).length && !planogramWon(game))) {
    game.board = freshBoard(game);
    shuffled = true;
  }
  return { valid: true, events, shuffled, won: planogramWon(game) };
}

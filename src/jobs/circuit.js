// Clockwise port bits: north, east, south, west. A tile has two contacts.
export const CIRCUIT_SOLUTION = [6, 10, 12, 9, 6, 3, 3, 10, 9];
export const newCircuit = () => CIRCUIT_SOLUTION.map((mask, i) => rotatePort(mask, (i % 3) + 1));
export function rotatePort(mask, turns = 1) {
  for (let i = 0; i < turns; i++) mask = ((mask << 1) & 15) | ((mask >> 3) & 1);
  return mask;
}
export function poweredContacts(board) {
  if (!Array.isArray(board) || board.length !== 9 || !(board[3] & 8)) return [];
  const visited = new Set([3]), queue = [3];
  const directions = [[-1, 0, 1, 4], [0, 1, 2, 8], [1, 0, 4, 1], [0, -1, 8, 2]];
  for (let n = 0; n < queue.length; n++) {
    const index = queue[n], row = Math.floor(index / 3), col = index % 3;
    for (const [dy, dx, from, to] of directions) {
      const y = row + dy, x = col + dx, next = y * 3 + x;
      if (x >= 0 && x < 3 && y >= 0 && y < 3 && (board[index] & from) && (board[next] & to) && !visited.has(next)) {
        visited.add(next); queue.push(next);
      }
    }
  }
  return [...visited];
}
export function circuitConnected(board) {
  return !!(board?.[5] & 2) && poweredContacts(board).includes(5);
}

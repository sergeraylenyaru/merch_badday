import { possibleSwaps, findMatches, swapProducts, planogramWon } from '../src/jobs/match3.js';
import { CIRCUIT_SOLUTION } from '../src/jobs/circuit.js';
import { PRICE_ITEMS, payParking } from '../src/jobs/catalog.js';
export function bestVisibleSwap(game) {
  return possibleSwaps(game.board).map((pair) => {
    const board = [...game.board]; [board[pair[0]], board[pair[1]]] = [board[pair[1]], board[pair[0]]];
    const score = findMatches(board).reduce((value, index) => value + (board[index] < 3 ? Math.max(0.1, 6 - game.collected[board[index]]) : 0.05), 0);
    return { pair, score };
  }).sort((a, b) => b.score - a.score)[0]?.pair;
}
export function finishPrimary(state, id) {
  const job = state.shops[id].job;
  switch (id) {
    case 0: payParking(state, 0); break;
    case 1:
      while (!planogramWon(job.match) && job.match.moves > 0) swapProducts(job.match, ...bestVisibleSwap(job.match));
      break;
    case 2: job.delivered = [5, 6]; break;
    case 3: job.circuit = [...CIRCUIT_SOLUTION]; job.repaired = true; break;
    case 4: job.delivered = [0, 1, 2]; break;
    case 5: job.removed = [0, 2, 4]; break;
    case 6: job.labels = PRICE_ITEMS.map((item) => item.price); break;
    case 8: job.collected = true; break;
    case 7: job.scannerFound = job.scannerReturned = true; break;
  }
}

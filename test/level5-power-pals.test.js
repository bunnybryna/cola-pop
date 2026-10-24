import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { LEVELS, TILE_TYPES } from '../src/config/level.js';
import {
  applyGravityAndRefill,
  findMatches,
  getCatCreatingSwapOptions,
  getCatCreationPlans,
  getCatPowerActivations,
  makeInitialBoard,
  placeCatTiles,
} from '../src/game/match3.js';
import { getPrimaryReward } from '../src/game/rewards.js';

const level5 = LEVELS.find((level) => level.level === 5);
const types = TILE_TYPES.map((tile) => tile.id);

test('Level 5 allows enough planning moves for four Cat Powers', () => {
  assert.equal(level5.moveLimit, 25);
  assert.equal(level5.objective.targetCount, 4);
  assert.equal(level5.completionImage.image, '/assets/level5complete.png');
  assert.equal(level5.failureImage.image, '/assets/level5fail.png');
  assert.deepEqual(level5.catPower.timing, {
    transformDelay: 270,
    creationResolve: 680,
    activationResolve: 600,
  });
  assert.ok(existsSync(new URL('../public/assets/level5complete.png', import.meta.url)));
  assert.ok(existsSync(new URL('../public/assets/level5fail.png', import.meta.url)));
});

test('Level 5 goal UI uses both rainbow Cat category icons with shared progress', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.deepEqual(level5.catPower.goalAssets, {
    tuxedo: '/assets/ui/goal-cat-tuxedo-rainbow.png',
    tabby: '/assets/ui/goal-cat-tabby-rainbow.png',
  });
  assert.ok(existsSync(new URL('../public/assets/ui/goal-cat-tuxedo-rainbow.png', import.meta.url)));
  assert.ok(existsSync(new URL('../public/assets/ui/goal-cat-tabby-rainbow.png', import.meta.url)));
  assert.match(appSource, /levelConfig\.catPower\.goalAssets\.tuxedo/);
  assert.match(appSource, /levelConfig\.catPower\.goalAssets\.tabby/);
  assert.match(appSource, /Any Tuxedo or Tabby Cat Power counts/);
});

test('a pure horizontal exact-four creates a Tabby Cat at the player destination', () => {
  const board = makeBoard();
  setRun(board, [{ row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }], types[0]);
  const matches = findMatches(board, level5);
  const plans = getCatCreationPlans(matches, board, level5, {
    swapEndpoints: [{ row: 3, col: 4 }, { row: 2, col: 4 }],
  });

  assert.deepEqual(plans, [{ cell: { row: 3, col: 4 }, type: types[0], special: 'tabby-column', orientation: 'horizontal' }]);
  const withCat = placeCatTiles(board, plans);
  assert.equal(withCat[3][4].tile.special, 'tabby-column');
  assert.equal(withCat[3][4].tile.type, types[0]);
});

test('a pure vertical exact-four creates a Tuxedo Cat at the player destination and later clears its row', () => {
  const board = makeBoard();
  setRun(board, [{ row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 3 }, { row: 4, col: 3 }], types[1]);
  let matches = findMatches(board, level5);
  const plans = getCatCreationPlans(matches, board, level5, {
    swapEndpoints: [{ row: 4, col: 3 }, { row: 4, col: 2 }],
  });

  assert.deepEqual(plans, [{ cell: { row: 4, col: 3 }, type: types[1], special: 'tuxedo-row', orientation: 'vertical' }]);
  const withCat = placeCatTiles(board, plans);

  withCat[4][2].tile = tile(types[1], 'left');
  withCat[4][4].tile = tile(types[1], 'right');
  matches = findMatches(withCat, level5);
  const power = getCatPowerActivations(matches, withCat, level5);

  assert.deepEqual(power.cells, [{ row: 4, col: 3 }]);
  assert.equal(power.clearCells.filter((cell) => cell.row === 4).length, 8);
});

test('a cascade-created horizontal exact-five creates a Tabby Cat at its true center and keeps its color', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4, 5].map((col) => ({ row: 2, col })), types[2]);

  const plans = getCatCreationPlans(findMatches(board, level5), board, level5);

  assert.deepEqual(plans, [{ cell: { row: 2, col: 3 }, type: types[2], special: 'tabby-column', orientation: 'horizontal' }]);
  assert.equal(placeCatTiles(board, plans)[2][3].tile.type, types[2]);
});

test('a cascade-created exact-four uses the deterministic center fallback', () => {
  const horizontal = makeBoard();
  setRun(horizontal, [1, 2, 3, 4].map((col) => ({ row: 2, col })), types[3]);
  assert.deepEqual(getCatCreationPlans(findMatches(horizontal, level5), horizontal, level5), [
    { cell: { row: 2, col: 2 }, type: types[3], special: 'tabby-column', orientation: 'horizontal' },
  ]);

  const vertical = makeBoard();
  setRun(vertical, [1, 2, 3, 4].map((row) => ({ row, col: 5 })), types[4]);
  assert.deepEqual(getCatCreationPlans(findMatches(vertical, level5), vertical, level5), [
    { cell: { row: 2, col: 5 }, type: types[4], special: 'tuxedo-row', orientation: 'vertical' },
  ]);
});

test('a cascade-created vertical exact-five creates a Tuxedo Cat at its true center', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4, 5].map((row) => ({ row, col: 4 })), types[2]);

  const plans = getCatCreationPlans(findMatches(board, level5), board, level5);

  assert.deepEqual(plans, [{ cell: { row: 3, col: 4 }, type: types[2], special: 'tuxedo-row', orientation: 'vertical' }]);
});

test('a player-created exact-five uses the swap destination instead of the center', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4, 5].map((col) => ({ row: 5, col })), types[4]);

  const plans = getCatCreationPlans(findMatches(board, level5), board, level5, {
    swapEndpoints: [{ row: 5, col: 5 }, { row: 4, col: 5 }],
  });

  assert.deepEqual(plans, [{ cell: { row: 5, col: 5 }, type: types[4], special: 'tabby-column', orientation: 'horizontal' }]);
});

test('a player-created vertical exact-five uses the swap destination instead of the center', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4, 5].map((row) => ({ row, col: 6 })), types[5]);

  const plans = getCatCreationPlans(findMatches(board, level5), board, level5, {
    swapEndpoints: [{ row: 5, col: 6 }, { row: 5, col: 5 }],
  });

  assert.deepEqual(plans, [{ cell: { row: 5, col: 6 }, type: types[5], special: 'tuxedo-row', orientation: 'vertical' }]);
});

test('the tile moving from to to from creates a horizontal exact-four at from', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4].map((col) => ({ row: 2, col })), types[0]);

  const plans = getCatCreationPlans(findMatches(board, level5), board, level5, {
    swapEndpoints: [{ row: 2, col: 5 }, { row: 2, col: 4 }],
  });

  assert.deepEqual(plans, [{ cell: { row: 2, col: 4 }, type: types[0], special: 'tabby-column', orientation: 'horizontal' }]);
});

test('the tile moving from to to from creates a vertical exact-four at from', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4].map((row) => ({ row, col: 2 })), types[1]);

  const plans = getCatCreationPlans(findMatches(board, level5), board, level5, {
    swapEndpoints: [{ row: 5, col: 2 }, { row: 4, col: 2 }],
  });

  assert.deepEqual(plans, [{ cell: { row: 4, col: 2 }, type: types[1], special: 'tuxedo-row', orientation: 'vertical' }]);
});

test('the tile moving from to to from creates a horizontal exact-five at from', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4, 5].map((col) => ({ row: 3, col })), types[2]);

  const plans = getCatCreationPlans(findMatches(board, level5), board, level5, {
    swapEndpoints: [{ row: 3, col: 6 }, { row: 3, col: 5 }],
  });

  assert.deepEqual(plans, [{ cell: { row: 3, col: 5 }, type: types[2], special: 'tabby-column', orientation: 'horizontal' }]);
});

test('the tile moving from to to from creates a vertical exact-five at from', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4, 5].map((row) => ({ row, col: 3 })), types[3]);

  const plans = getCatCreationPlans(findMatches(board, level5), board, level5, {
    swapEndpoints: [{ row: 6, col: 3 }, { row: 5, col: 3 }],
  });

  assert.deepEqual(plans, [{ cell: { row: 5, col: 3 }, type: types[3], special: 'tuxedo-row', orientation: 'vertical' }]);
});

test('a player-created multi-match ignores unrelated groups but keeps groups at both endpoints', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4].map((col) => ({ row: 1, col })), types[0]);
  setRun(board, [2, 3, 4, 5].map((col) => ({ row: 6, col })), types[1]);
  setRun(board, [0, 1, 2, 3].map((col) => ({ row: 4, col })), types[2]);

  const plans = getCatCreationPlans(findMatches(board, level5), board, level5, {
    swapEndpoints: [{ row: 1, col: 4 }, { row: 6, col: 5 }],
  });

  assert.deepEqual(plans, [
    { cell: { row: 1, col: 4 }, type: types[0], special: 'tabby-column', orientation: 'horizontal' },
    { cell: { row: 6, col: 5 }, type: types[1], special: 'tabby-column', orientation: 'horizontal' },
  ]);
});

test('gravity can move a newly created Cat after its creation cell is chosen', () => {
  const board = makeBoard();
  const plan = { cell: { row: 3, col: 3 }, type: types[2], special: 'tabby-column', orientation: 'horizontal' };
  const withCat = placeCatTiles(board, [plan]);
  withCat[4][3].tile = null;
  withCat[5][3].tile = null;
  withCat[6][3].tile = null;
  withCat[7][3].tile = null;

  const afterGravity = applyGravityAndRefill(withCat, level5, TILE_TYPES);

  assert.equal(withCat[3][3].tile.special, 'tabby-column');
  assert.equal(afterGravity[7][3].tile.special, 'tabby-column');
});

test('an exact-five-created Cat activates with the same directional behavior as an exact-four Cat', () => {
  const board = makeBoard();
  setRun(board, [1, 2, 3, 4, 5].map((col) => ({ row: 4, col })), types[5]);
  const plans = getCatCreationPlans(findMatches(board, level5), board, level5);
  const withCat = placeCatTiles(board, plans);

  withCat[3][3].tile = tile(types[5], 'above');
  withCat[5][3].tile = tile(types[5], 'below');
  const power = getCatPowerActivations(findMatches(withCat, level5), withCat, level5);

  assert.deepEqual(power.cells, [{ row: 4, col: 3 }]);
  assert.equal(power.clearCells.filter((cell) => cell.col === 3).length, 8);
});

test('only pure exact-fours and exact-fives create Cats in V1', () => {
  const six = makeBoard();
  setRun(six, [0, 1, 2, 3, 4, 5].map((col) => ({ row: 2, col })), types[2]);
  assert.equal(getCatCreationPlans(findMatches(six, level5), six, level5).length, 0);

  const tee = makeBoard();
  setRun(tee, [1, 2, 3, 4].map((col) => ({ row: 3, col })), types[3]);
  setRun(tee, [2, 3, 4].map((row) => ({ row, col: 2 })), types[3]);
  assert.equal(getCatCreationPlans(findMatches(tee, level5), tee, level5).length, 0);

  const elbow = makeBoard();
  setRun(elbow, [1, 2, 3, 4].map((col) => ({ row: 5, col })), types[4]);
  setRun(elbow, [5, 6, 7].map((row) => ({ row, col: 1 })), types[4]);
  assert.equal(getCatCreationPlans(findMatches(elbow, level5), elbow, level5).length, 0);

  const cross = makeBoard();
  setRun(cross, [1, 2, 3, 4].map((col) => ({ row: 3, col })), types[3]);
  setRun(cross, [2, 3, 4].map((row) => ({ row, col: 2 })), types[3]);
  assert.equal(getCatCreationPlans(findMatches(cross, level5), cross, level5).length, 0);
});

test('a Cat swept by another Cat does not activate in V1', () => {
  const board = makeBoard();
  board[3][3].tile = tile(types[0], 'tuxedo', 'tuxedo-row');
  board[3][6].tile = tile(types[1], 'tabby', 'tabby-column');
  board[3][2].tile = tile(types[0], 'left');
  board[3][4].tile = tile(types[0], 'right');
  const power = getCatPowerActivations(findMatches(board, level5), board, level5);

  assert.deepEqual(power.cells, [{ row: 3, col: 3 }]);
  assert.ok(power.clearCells.some((cell) => cell.row === 3 && cell.col === 6));
});

test('Level 5 starts without automatic matches and offers two Cat-creating swaps across both axes', () => {
  const board = makeInitialBoard(level5, TILE_TYPES);
  const options = getCatCreatingSwapOptions(board, level5);
  const axes = new Set(options.flatMap((option) => option.plans.map((plan) => plan.orientation)));

  assert.equal(findMatches(board, level5).cells.length, 0);
  assert.ok(options.length >= 2);
  assert.deepEqual(axes, new Set(['horizontal', 'vertical']));
});

test('Cat activation is objective feedback and creation is a special-match candidate', () => {
  const activation = getPrimaryReward({
    cascadeIndex: 0,
    matchPower: 3,
    objectiveCount: 1,
    isTreatGoal: false,
    isMudGoal: false,
    isCatPowerGoal: true,
    catCreated: false,
    catPowerSound: level5.catPower.sound,
    completesObjective: false,
  });
  const creation = getPrimaryReward({
    cascadeIndex: 0,
    matchPower: 4,
    objectiveCount: 0,
    isTreatGoal: false,
    isMudGoal: false,
    isCatPowerGoal: true,
    catCreated: true,
    catPowerSound: level5.catPower.sound,
    completesObjective: false,
  });

  assert.deepEqual(activation.feedback, { text: 'CAT POWER!', tone: 'cat-power' });
  assert.equal(activation.sound, 'cat-power');
  assert.deepEqual(creation.feedback, { text: 'POWER PAL!', tone: 'cat-power' });
  assert.equal(creation.sound, 'cat-power');
});

test('Cat effects are board-relative and keep creation and activation events distinct', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const soundSource = readFileSync(new URL('../src/audio/sounds.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(appSource, /const \[catEffects, setCatEffects\] = useState\(\[\]\)/);
  assert.match(appSource, /kind: 'cat-create'/);
  assert.match(appSource, /kind: 'cat-activate'/);
  assert.match(appSource, /className="cat-effects"/);
  assert.match(soundSource, /playCatPower\(kind\)/);
  assert.match(soundSource, /CAT_POWER_POOL_SIZE = 2/);
  assert.match(soundSource, /ensureCatPowerPlayers\(\)\.find/);
  assert.match(soundSource, /initializeGameplayAudio/);
  assert.match(appSource, /initializeGameplayAudio\(\)/);
  assert.doesNotMatch(soundSource, /PRIMARY_SOUNDS = new Set\(\[[^\]]*'cat-power'/);
  assert.match(appSource, /showCatEffects\(catCreations\.map[\s\S]*?playCatPower\('cat-create'\)/);
  assert.doesNotMatch(appSource, /canPlayCatEffectSound/);
  assert.match(styles, /\.cat-effect\.row \.cat-effect-sweep::before/);
  assert.match(styles, /\.cat-effect\.column \.cat-effect-sweep::before/);
  assert.match(styles, /\.cat-power-flash/);
  assert.match(styles, /\.cat-effect\.cat-create \.cat-effect-label/);
  assert.match(styles, /\.match-callout\.cat-power/);
  assert.match(styles, /cat-power-create 380ms/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

function makeBoard() {
  return Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => ({ tile: tile(types[(row * 2 + col * 3) % types.length], `${row}-${col}`), object: null, terrain: null })),
  );
}

function tile(type, key, special = undefined) {
  return { key, type, state: 'idle', ...(special ? { special } : {}) };
}

function setRun(board, cells, type) {
  for (const cell of cells) {
    board[cell.row][cell.col].tile = tile(type, `${cell.row}-${cell.col}`);
  }

  const isHorizontal = cells.every((cell) => cell.row === cells[0].row);
  const before = isHorizontal
    ? { row: cells[0].row, col: cells[0].col - 1 }
    : { row: cells[0].row - 1, col: cells[0].col };
  const after = isHorizontal
    ? { row: cells.at(-1).row, col: cells.at(-1).col + 1 }
    : { row: cells.at(-1).row + 1, col: cells.at(-1).col };
  const blocker = types.find((candidate) => candidate !== type);

  for (const cell of [before, after]) {
    if (board[cell.row]?.[cell.col]) {
      board[cell.row][cell.col].tile = tile(blocker, `${cell.row}-${cell.col}-blocker`);
    }
  }
}

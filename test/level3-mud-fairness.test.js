import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LEVELS, TILE_TYPES } from '../src/config/level.js';
import {
  findMatches,
  getTerrainPositions,
  hasUsefulMoveForTerrainClean,
  repairStuckTerrainClean,
} from '../src/game/match3.js';

const level3 = LEVELS.find((level) => level.level === 3);
const level1 = LEVELS.find((level) => level.level === 1);
const level2 = LEVELS.find((level) => level.level === 2);
const level4 = LEVELS.find((level) => level.level === 4);
const tileIds = TILE_TYPES.map((tile) => tile.id);
const terrainType = level3.objective.terrainType;

test('repairs final mud with no useful swap after the stall threshold', () => {
  const board = makeBoardWithoutUsefulMud([{ row: 4, col: 3 }]);
  const repaired = repairStuckTerrainClean(board, level3, terrainType);

  assert.ok(repaired.board, repaired.reason);
  assertNoAutomaticMatch(repaired.board);
  assertSameTerrainPositions(board, repaired.board);
  assert.equal(hasUsefulMoveForTerrainClean(repaired.board, level3, terrainType), true);
});

test('does not repair when a useful mud-cleaning swap already exists', () => {
  const board = makeBoardWithUsefulMud({ row: 4, col: 3 });
  const repaired = repairStuckTerrainClean(board, level3, terrainType);

  assert.equal(hasUsefulMoveForTerrainClean(board, level3, terrainType), true);
  assert.equal(repaired.board, undefined);
});

test('repairs when two muddy cells remain and at least one can be made cleanable', () => {
  const board = makeBoardWithoutUsefulMud([
    { row: 4, col: 3 },
    { row: 2, col: 5 },
  ]);
  const repaired = repairStuckTerrainClean(board, level3, terrainType);

  assert.ok(repaired.board, repaired.reason);
  assertNoAutomaticMatch(repaired.board);
  assertSameTerrainPositions(board, repaired.board);
  assert.equal(hasUsefulMoveForTerrainClean(repaired.board, level3, terrainType), true);
});

test('mud repair does not auto-clean mud or create free matches', () => {
  const board = makeBoardWithoutUsefulMud([{ row: 4, col: 3 }]);
  const repaired = repairStuckTerrainClean(board, level3, terrainType);

  assert.ok(repaired.board, repaired.reason);
  assert.equal(getTerrainPositions(repaired.board, terrainType).length, 1);
  assertNoAutomaticMatch(repaired.board);
  assertSameTerrainPositions(board, repaired.board);
});

test('maximum one repair and restart reset state are represented in game state', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(appSource, /mudStallMoves: 0/);
  assert.match(appSource, /mudRepairUsed: false/);
  assert.match(appSource, /currentMudRepairUsed/);
  assert.match(appSource, /repairStuckTerrainClean/);
});

test('existing level settings remain unchanged', () => {
  assert.equal(level1.objective.targetCount, 24);
  assert.equal(level2.objective.treatCount, 8);
  assert.equal(level3.objective.targetCount, 8);
  assert.equal(level3.moveLimit, 20);
  assert.equal(level4.objective.targetCount, 2);
  assert.equal(level4.moveLimit, 30);
  assert.equal(level4.objective.spawnAfterMovesUsed, 5);
});

function makeBoardWithoutUsefulMud(terrainCells) {
  for (let rowWeight = 1; rowWeight <= 5; rowWeight += 1) {
    for (let colWeight = 1; colWeight <= 5; colWeight += 1) {
      for (let offset = 0; offset < tileIds.length; offset += 1) {
        const board = makeBoard(terrainCells, rowWeight, colWeight, offset);

        if (findMatches(board, level3).cells.length === 0 && !hasUsefulMoveForTerrainClean(board, level3, terrainType)) {
          return board;
        }
      }
    }
  }

  throw new Error('Could not build a deterministic no-useful-mud board.');
}

function makeBoardWithUsefulMud(terrainCell) {
  for (let rowWeight = 1; rowWeight <= 5; rowWeight += 1) {
    for (let colWeight = 1; colWeight <= 5; colWeight += 1) {
      for (let offset = 0; offset < tileIds.length; offset += 1) {
        const board = makeBoard([terrainCell], rowWeight, colWeight, offset);
        forceUsefulMudPattern(board, terrainCell, tileIds[0], tileIds[1]);

        if (findMatches(board, level3).cells.length === 0 && hasUsefulMoveForTerrainClean(board, level3, terrainType)) {
          return board;
        }
      }
    }
  }

  throw new Error('Could not build a deterministic useful-mud board.');
}

function makeBoard(terrainCells, rowWeight = 2, colWeight = 1, offset = 0) {
  const terrainKeys = new Set(terrainCells.map((cell) => `${cell.row}:${cell.col}`));

  return Array.from({ length: level3.height }, (_, row) =>
    Array.from({ length: level3.width }, (_, col) => ({
      tile: makeTile(tileIds[(row * rowWeight + col * colWeight + offset) % tileIds.length], `${row}-${col}`),
      object: null,
      terrain: terrainKeys.has(`${row}:${col}`) ? { type: terrainType, state: 'dirty' } : null,
    })),
  );
}

function forceUsefulMudPattern(board, terrainCell, targetType, blockerType) {
  const side = { row: terrainCell.row, col: terrainCell.col - 1 };
  const swapTo = { row: terrainCell.row, col: terrainCell.col + 1 };
  const swapFrom = { row: terrainCell.row - 1, col: terrainCell.col + 1 };

  board[terrainCell.row][terrainCell.col].tile = makeTile(targetType, 'forced-mud');
  board[side.row][side.col].tile = makeTile(targetType, 'forced-side');
  board[swapFrom.row][swapFrom.col].tile = makeTile(targetType, 'forced-swap-from');
  board[swapTo.row][swapTo.col].tile = makeTile(blockerType, 'forced-swap-to');
}

function makeTile(type, key) {
  return {
    key,
    type,
    state: 'idle',
  };
}

function assertNoAutomaticMatch(board) {
  assert.equal(findMatches(board, level3).cells.length, 0);
}

function assertSameTerrainPositions(before, after) {
  assert.deepEqual(
    getTerrainPositions(after, terrainType).map((cell) => `${cell.row}:${cell.col}`).sort(),
    getTerrainPositions(before, terrainType).map((cell) => `${cell.row}:${cell.col}`).sort(),
  );
}

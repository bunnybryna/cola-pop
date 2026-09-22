import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, TILE_TYPES } from '../src/config/level.js';
import {
  findBottomEntities,
  findMatches,
  getBottomEntityCollectionStep,
  getEntityPositions,
  getNextEntityStallCounts,
  hasUsefulMoveForEntityProgress,
  repairStuckEntityProgress,
} from '../src/game/match3.js';

const level4 = LEVELS.find((level) => level.level === 4);
const entityType = level4.objective.entityType;
const tileIds = TILE_TYPES.map((tile) => tile.id);

test('repairs a row 5 stuck ball with a verified progress swap', () => {
  const board = makeBoardWithoutUsefulMove([{ row: 5, col: 3, key: 'ball-a' }], 'ball-a');
  const repaired = repairStuckEntityProgress(board, level4, entityType, { targetEntityKey: 'ball-a' });

  assert.ok(repaired.board, repaired.reason);
  assertNoAutomaticMatch(repaired.board);
  assertEntityPosition(repaired.board, 'ball-a', 5, 3);
  assert.equal(findBottomEntities(repaired.board, level4, entityType).length, 0);
  assert.equal(hasUsefulMoveForEntityProgress(repaired.board, level4, entityType, 'ball-a'), true);
});

test('repairs a row 6 stuck ball with a verified progress swap', () => {
  const board = makeBoardWithoutUsefulMove([{ row: 6, col: 3, key: 'ball-a' }], 'ball-a');
  const repaired = repairStuckEntityProgress(board, level4, entityType, { targetEntityKey: 'ball-a' });

  assert.ok(repaired.board, repaired.reason);
  assertNoAutomaticMatch(repaired.board);
  assertEntityPosition(repaired.board, 'ball-a', 6, 3);
  assert.equal(findBottomEntities(repaired.board, level4, entityType).length, 0);
  assert.equal(hasUsefulMoveForEntityProgress(repaired.board, level4, entityType, 'ball-a'), true);
});

test('bottom-row entity collection settles newly landed balls in the same resolution', () => {
  let board = makeBoard([
    { row: 6, col: 3, key: 'ball-a' },
    { row: 7, col: 3, key: 'ball-b' },
  ]);
  let collected = 0;
  let spawnedEntities = 2;
  let step = getBottomEntityCollectionStep(board, level4, TILE_TYPES, entityType, {
    targetCount: 2,
    collected,
    spawnedEntities,
  });

  assert.ok(step);
  assert.deepEqual(step.cells, [{ row: 7, col: 3 }]);
  board = step.board;
  collected = step.collected;
  spawnedEntities = step.spawnedEntities;
  assert.equal(collected, 1);
  assert.equal(findBottomEntities(board, level4, entityType).length, 1);

  step = getBottomEntityCollectionStep(board, level4, TILE_TYPES, entityType, {
    targetCount: 2,
    collected,
    spawnedEntities,
  });

  assert.ok(step);
  assert.deepEqual(step.cells, [{ row: 7, col: 3 }]);
  assert.equal(step.collected, 2);
  assert.equal(findBottomEntities(step.board, level4, entityType).length, 0);
});

test('repairs only the stalled ball while preserving another ball useful move when feasible', () => {
  const board = makeBoardWithoutUsefulMove(
    [
      { row: 6, col: 2, key: 'stuck-ball' },
      { row: 6, col: 5, key: 'ready-ball' },
    ],
    'stuck-ball',
    (candidate) => forceUsefulPattern(candidate, { row: 6, col: 5 }, tileIds[0], tileIds[1]),
  );

  assert.equal(hasUsefulMoveForEntityProgress(board, level4, entityType, 'stuck-ball'), false);
  assert.equal(hasUsefulMoveForEntityProgress(board, level4, entityType, 'ready-ball'), true);

  const repaired = repairStuckEntityProgress(board, level4, entityType, { targetEntityKey: 'stuck-ball' });

  assert.ok(repaired.board, repaired.reason);
  assertEntityPosition(repaired.board, 'stuck-ball', 6, 2);
  assertEntityPosition(repaired.board, 'ready-ball', 6, 5);
  assert.equal(hasUsefulMoveForEntityProgress(repaired.board, level4, entityType, 'stuck-ball'), true);
  assert.equal(hasUsefulMoveForEntityProgress(repaired.board, level4, entityType, 'ready-ball'), true);
});

test('does not repair when the targeted ball already has an immediately useful swap', () => {
  const board = makeBoardWithUsefulMove({ row: 6, col: 3, key: 'ball-a' });

  assert.equal(hasUsefulMoveForEntityProgress(board, level4, entityType, 'ball-a'), true);

  const repaired = repairStuckEntityProgress(board, level4, entityType, { targetEntityKey: 'ball-a' });

  assert.equal(repaired.board, undefined);
});

test('stall counter reaches the assist threshold after three non-progress moves', () => {
  const entity = { row: 6, col: 3, key: 'ball-a' };
  let stalled = {};

  for (let move = 0; move < 3; move += 1) {
    stalled = getNextEntityStallCounts({
      entities: [entity],
      progressedEntityKeys: new Set(),
      previousStalledMoves: stalled,
      config: level4,
    });
  }

  assert.equal(stalled['ball-a'], 3);
});

test('progress by another ball does not reset the stalled ball counter', () => {
  const stalled = getNextEntityStallCounts({
    entities: [
      { row: 6, col: 2, key: 'stuck-ball' },
      { row: 6, col: 5, key: 'moving-ball' },
    ],
    progressedEntityKeys: new Set(['moving-ball']),
    previousStalledMoves: { 'stuck-ball': 2, 'moving-ball': 2 },
    config: level4,
  });

  assert.deepEqual(stalled, { 'stuck-ball': 3 });
});

function makeBoardWithoutUsefulMove(entities, targetEntityKey, mutate = null) {
  for (let rowWeight = 1; rowWeight <= 5; rowWeight += 1) {
    for (let colWeight = 1; colWeight <= 5; colWeight += 1) {
      for (let offset = 0; offset < tileIds.length; offset += 1) {
        const board = makeBoard(entities, rowWeight, colWeight, offset);

        if (mutate) {
          mutate(board);
        }

        if (
          findMatches(board, level4).cells.length === 0 &&
          !hasUsefulMoveForEntityProgress(board, level4, entityType, targetEntityKey)
        ) {
          return board;
        }
      }
    }
  }

  throw new Error(`Could not build a deterministic no-useful-move board for ${targetEntityKey}.`);
}

function makeBoardWithUsefulMove(entity) {
  for (let rowWeight = 1; rowWeight <= 5; rowWeight += 1) {
    for (let colWeight = 1; colWeight <= 5; colWeight += 1) {
      for (let offset = 0; offset < tileIds.length; offset += 1) {
        const board = makeBoard([entity], rowWeight, colWeight, offset);
        forceUsefulPattern(board, entity, tileIds[0], tileIds[1]);

        if (
          findMatches(board, level4).cells.length === 0 &&
          hasUsefulMoveForEntityProgress(board, level4, entityType, entity.key)
        ) {
          return board;
        }
      }
    }
  }

  throw new Error(`Could not build a deterministic useful-move board for ${entity.key}.`);
}

function makeBoard(entities, rowWeight = 2, colWeight = 1, offset = 0) {
  const entityByCell = new Map(entities.map((entity) => [`${entity.row}:${entity.col}`, entity]));

  return Array.from({ length: level4.height }, (_, row) =>
    Array.from({ length: level4.width }, (_, col) => {
      const entity = entityByCell.get(`${row}:${col}`);

      if (entity) {
        return {
          tile: {
            key: entity.key,
            type: entityType,
            entity: entityType,
            state: 'idle',
            matchable: false,
            swappable: false,
          },
          object: null,
          terrain: null,
        };
      }

      return {
        tile: makeTile(tileIds[(row * rowWeight + col * colWeight + offset) % tileIds.length], `${row}-${col}`),
        object: null,
        terrain: null,
      };
    }),
  );
}

function forceUsefulPattern(board, entityCell, targetType, blockerType) {
  const below = { row: entityCell.row + 1, col: entityCell.col };
  const side = { row: below.row, col: below.col - 1 };
  const swapTo = { row: below.row, col: below.col + 1 };
  const swapFrom = { row: below.row - 1, col: below.col + 1 };

  board[below.row][below.col].tile = makeTile(targetType, 'forced-below');
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
  assert.equal(findMatches(board, level4).cells.length, 0);
}

function assertEntityPosition(board, key, row, col) {
  const entity = getEntityPositions(board, entityType).find((cell) => cell.key === key);

  assert.deepEqual(entity, { row, col, key });
}

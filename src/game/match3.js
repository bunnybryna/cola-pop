export function makeInitialBoard(config, tileTypes) {
  let fallback;

  for (let attempts = 0; attempts < 200; attempts += 1) {
    const board = createBoardWithoutMatches(config, tileTypes);

    if (!board) {
      continue;
    }

    fallback = board;

    if (
      findMatches(board, config).cells.length === 0 &&
      hasPossibleMove(board, config) &&
      isWithinAllObjectPlacementGoals(board, config) &&
      isWithinAllTerrainPlacementGoals(board, config) &&
      isFairInitialBoard(board, config)
    ) {
      return board;
    }
  }

  return fallback;
}

export function createBoardWithoutMatches(config, tileTypes) {
  const board = [];

  for (let row = 0; row < config.height; row += 1) {
    const boardRow = [];

    for (let col = 0; col < config.width; col += 1) {
      const blocked = new Set();

      if (col >= 2 && getCellTile(boardRow[col - 1])?.type === getCellTile(boardRow[col - 2])?.type) {
        blocked.add(getCellTile(boardRow[col - 1]).type);
      }

      if (row >= 2 && getCellTile(board[row - 1][col])?.type === getCellTile(board[row - 2][col])?.type) {
        blocked.add(getCellTile(board[row - 1][col]).type);
      }

      boardRow.push(createCell(createRandomTile(tileTypes, blocked)));
    }

    board.push(boardRow);
  }

  const boardWithObjects = placeBoardObjects(board, config);

  if (!boardWithObjects) {
    return null;
  }

  const boardWithGravityEntities = placeGravityEntities(boardWithObjects, config);

  if (!boardWithGravityEntities) {
    return null;
  }

  return placeTerrain(boardWithGravityEntities, config);
}

export function createRandomTile(tileTypes, blocked = new Set()) {
  const choices = tileTypes.filter((tile) => !blocked.has(tile.id));
  const source = choices[Math.floor(Math.random() * choices.length)] ?? tileTypes[0];

  return {
    key: crypto.randomUUID(),
    type: source.id,
    state: 'idle',
  };
}

export function areAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function swapTiles(board, a, b) {
  const next = cloneBoard(board);
  const holding = next[a.row][a.col].tile;
  next[a.row][a.col].tile = next[b.row][b.col].tile;
  next[b.row][b.col].tile = holding;
  return next;
}

export function canSwapCells(board, a, b) {
  return Boolean(isSwappableTile(getCellTile(board[a.row]?.[a.col])) && isSwappableTile(getCellTile(board[b.row]?.[b.col])));
}

export function findMatches(board, config) {
  const matched = new Set();
  const groups = [];

  for (let row = 0; row < config.height; row += 1) {
    let run = [{ row, col: 0 }];

    for (let col = 1; col <= config.width; col += 1) {
      const current = getMatchableTile(board[row][col]);
      const previous = getMatchableTile(board[row][col - 1]);

      if (current && previous && current.type === previous.type) {
        run.push({ row, col });
      } else {
        pushMatch(run, board, matched, groups);
        run = current ? [{ row, col }] : [];
      }
    }
  }

  for (let col = 0; col < config.width; col += 1) {
    let run = [{ row: 0, col }];

    for (let row = 1; row <= config.height; row += 1) {
      const current = getMatchableTile(board[row]?.[col]);
      const previous = getMatchableTile(board[row - 1]?.[col]);

      if (current && previous && current.type === previous.type) {
        run.push({ row, col });
      } else {
        pushMatch(run, board, matched, groups);
        run = current ? [{ row, col }] : [];
      }
    }
  }

  return {
    cells: [...matched].map(parseCellKey),
    groups,
  };
}

export function markCells(board, cells, state, extra = {}) {
  const marked = cloneBoard(board);

  for (const cell of cells) {
    if (getCellTile(marked[cell.row]?.[cell.col])) {
      marked[cell.row][cell.col].tile = {
        ...marked[cell.row][cell.col].tile,
        state,
        ...extra,
      };
    }
  }

  return marked;
}

export function clearCells(board, cells) {
  const next = cloneBoard(board);

  for (const cell of cells) {
    next[cell.row][cell.col].tile = null;
  }

  return next;
}

export function markObjects(board, cells, state, extra = {}) {
  const marked = cloneBoard(board);

  for (const cell of cells) {
    if (marked[cell.row]?.[cell.col]?.object) {
      marked[cell.row][cell.col].object = {
        ...marked[cell.row][cell.col].object,
        state,
        ...extra,
      };
    }
  }

  return marked;
}

export function clearObjects(board, cells) {
  const next = cloneBoard(board);

  for (const cell of cells) {
    if (next[cell.row]?.[cell.col]) {
      next[cell.row][cell.col].object = null;
    }
  }

  return next;
}

export function findAdjacentObjects(matches, board, config, objectType) {
  const found = new Map();

  for (const cell of matches.cells) {
    for (const neighbor of getOrthogonalNeighbors(cell)) {
      if (!isInsideBoard(neighbor, config)) {
        continue;
      }

      const object = board[neighbor.row]?.[neighbor.col]?.object;

      if (object?.type === objectType && object.state !== 'collected') {
        found.set(makeCellKey(neighbor), neighbor);
      }
    }
  }

  return [...found.values()];
}

export function findMatchedTerrain(matches, board, terrainType) {
  const found = new Map();

  for (const cell of matches.cells) {
    const terrain = board[cell.row]?.[cell.col]?.terrain;

    if (terrain?.type === terrainType && terrain.state !== 'clean') {
      found.set(makeCellKey(cell), cell);
    }
  }

  return [...found.values()];
}

export function markTerrain(board, cells, state, extra = {}) {
  const marked = cloneBoard(board);

  for (const cell of cells) {
    if (marked[cell.row]?.[cell.col]?.terrain) {
      marked[cell.row][cell.col].terrain = {
        ...marked[cell.row][cell.col].terrain,
        state,
        ...extra,
      };
    }
  }

  return marked;
}

export function clearTerrain(board, cells) {
  const next = cloneBoard(board);

  for (const cell of cells) {
    if (next[cell.row]?.[cell.col]) {
      next[cell.row][cell.col].terrain = null;
    }
  }

  return next;
}

export function findBottomEntities(board, config, entityType) {
  const bottomRow = config.height - 1;
  const found = [];

  for (let col = 0; col < config.width; col += 1) {
    const tile = getCellTile(board[bottomRow]?.[col]);

    if (tile?.entity === entityType && tile.state !== 'collecting') {
      found.push({ row: bottomRow, col });
    }
  }

  return found;
}

export function getBottomEntityCollectionStep(board, config, tileTypes, entityType, options = {}) {
  const targetCount = options.targetCount ?? config.objective?.targetCount ?? Infinity;
  const collected = options.collected ?? 0;
  const spawnedEntities = options.spawnedEntities ?? countEntities(board, entityType);
  const remainingNeeded = Math.max(0, targetCount - collected);
  const entityCells = findBottomEntities(board, config, entityType).slice(0, remainingNeeded);

  if (entityCells.length === 0) {
    return null;
  }

  let nextBoard = clearTileEntities(board, entityCells);
  nextBoard = applyGravityAndRefill(nextBoard, config, tileTypes);

  let nextSpawnedEntities = spawnedEntities;
  const nextCollected = Math.min(targetCount, collected + entityCells.length);

  if (
    nextCollected >= (config.objective?.spawnAfterCollected ?? Infinity) &&
    nextSpawnedEntities < targetCount &&
    countEntities(nextBoard, entityType) < targetCount - nextCollected
  ) {
    nextBoard = spawnGravityEntity(nextBoard, config, entityType);
    nextSpawnedEntities += 1;
  }

  return {
    board: nextBoard,
    cells: entityCells,
    collected: nextCollected,
    spawnedEntities: nextSpawnedEntities,
  };
}

export function countEntities(board, entityType) {
  let count = 0;

  for (const row of board) {
    for (const cell of row) {
      if (getCellTile(cell)?.entity === entityType) {
        count += 1;
      }
    }
  }

  return count;
}

export function getEntityPositions(board, entityType) {
  return getEntityCells(board, entityType);
}

export function getTerrainPositions(board, terrainType) {
  return getTerrainCells(board, terrainType);
}

export function getNextEntityStallCounts({ entities, progressedEntityKeys, previousStalledMoves = {}, config }) {
  const nextStalledMoves = {};

  for (const entity of entities) {
    if (!isEntityInProgressZone(entity, config) || progressedEntityKeys.has(entity.key)) {
      continue;
    }

    nextStalledMoves[entity.key] = Math.min(3, (previousStalledMoves[entity.key] ?? 0) + 1);
  }

  return nextStalledMoves;
}

export function markTileEntities(board, cells, state, extra = {}) {
  const marked = cloneBoard(board);

  for (const cell of cells) {
    const tile = getCellTile(marked[cell.row]?.[cell.col]);

    if (tile?.entity) {
      marked[cell.row][cell.col].tile = {
        ...tile,
        state,
        ...extra,
      };
    }
  }

  return marked;
}

export function clearTileEntities(board, cells) {
  const next = cloneBoard(board);

  for (const cell of cells) {
    const tile = getCellTile(next[cell.row]?.[cell.col]);

    if (tile?.entity) {
      next[cell.row][cell.col].tile = null;
    }
  }

  return next;
}

export function spawnGravityEntity(board, config, entityType) {
  const entityConfig = (config.gravityEntities ?? []).find((entity) => entity.id === entityType);

  if (!entityConfig) {
    return board;
  }

  const next = cloneBoard(board);
  const candidates = getGravityEntityPlacementCandidates(next, config, entityConfig, true);
  const existingEntities = getEntityCells(next, entityType);
  const spacedCandidates = candidates.filter((cell) =>
    existingEntities.every((existing) => existing.col !== cell.col && getManhattanDistance(cell, existing) > 1),
  );
  const candidatePool = spacedCandidates.length > 0 ? spacedCandidates : candidates;

  if (candidatePool.length === 0) {
    return board;
  }

  const { row, col } = pickWeightedGravityEntityCandidate(candidatePool, config, entityConfig);
  next[row][col].tile = createGravityEntityTile(entityConfig, 'new-ball');
  return next;
}

export function applyGravityAndRefill(board, config, tileTypes) {
  const next = board.map((row) => row.map((cell) => createCell(null, cell.object, cell.terrain)));

  for (let col = 0; col < config.width; col += 1) {
    let segmentBottom = config.height - 1;

    for (let row = config.height - 1; row >= -1; row -= 1) {
      const isBlocked = row < 0 || Boolean(board[row][col].object);

      if (!isBlocked) {
        continue;
      }

      fillColumnSegment(board, next, col, row + 1, segmentBottom, tileTypes);
      segmentBottom = row - 1;
    }
  }

  return next;
}

export function resetTileStates(board) {
  return board.map((row) =>
    row.map((cell) =>
      getCellTile(cell)
        ? {
            ...cell,
            tile: {
              ...cell.tile,
              state: 'idle',
              matchPower: undefined,
            },
          }
        : cell,
    ),
  );
}

export function hasPossibleMove(board, config) {
  for (let row = 0; row < config.height; row += 1) {
    for (let col = 0; col < config.width; col += 1) {
      const current = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const target of candidates) {
        if (target.row >= config.height || target.col >= config.width) {
          continue;
        }

        if (!canSwapCells(board, current, target)) {
          continue;
        }

        const swapped = swapTiles(board, current, target);
        if (findMatches(swapped, config).cells.length > 0) {
          return true;
        }
      }
    }
  }

  return false;
}

export function reshuffleBoard(board, config, tileTypes) {
  const counts = new Map();

  for (const row of board) {
    for (const cell of row) {
      const tile = getCellTile(cell);

      if (!tile || tile.entity) {
        continue;
      }

      counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1);
    }
  }

  let attempts = 0;
  let shuffled;

  do {
    const pool = [...counts.entries()].flatMap(([type, count]) =>
      Array.from({ length: count }, () => ({
        key: crypto.randomUUID(),
        type,
        state: 'entering',
      })),
    );

    shuffled = board.map((row) =>
      row.map((cell) =>
        getCellTile(cell)?.entity
          ? createCell({ ...cell.tile, state: 'idle' }, cell.object, cell.terrain)
          : getCellTile(cell)
          ? createCell(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], cell.object, cell.terrain)
          : createCell(null, cell.object, cell.terrain),
      ),
    );

    attempts += 1;
  } while ((findMatches(shuffled, config).cells.length > 0 || !hasPossibleMove(shuffled, config)) && attempts < 100);

  if (!shuffled || !hasPossibleMove(shuffled, config)) {
    return makeBoardFromObjectLayout(board, config, tileTypes);
  }

  return shuffled;
}

export function hasUsefulMoveForEntityProgress(board, config, entityType, targetEntityKey = null) {
  return getEntityCells(board, entityType).some(
    (entityCell) =>
      (!targetEntityKey || entityCell.key === targetEntityKey) &&
      isEntityInProgressZone(entityCell, config) &&
      hasUsefulMoveForEntity(board, config, entityCell),
  );
}

export function hasUsefulMoveForTerrainClean(board, config, terrainType) {
  return getUsefulTerrainCleanOptions(board, config, terrainType).length > 0;
}

export function repairStuckTerrainClean(board, config, terrainType) {
  const terrainCells = getTerrainCells(board, terrainType);

  if (terrainCells.length === 0) {
    return { reason: 'No muddy cells remain.' };
  }

  if (hasUsefulMoveForTerrainClean(board, config, terrainType)) {
    return { reason: 'A useful mud-cleaning swap already exists.' };
  }

  const candidates = terrainCells
    .filter((terrainCell) => isSwappableTile(getCellTile(board[terrainCell.row]?.[terrainCell.col])))
    .sort((a, b) => a.row - b.row || a.col - b.col);

  for (const terrainCell of candidates) {
    const repair = tryBuildTargetedTerrainRepair(board, config, terrainType, terrainCell);

    if (repair) {
      return repair;
    }
  }

  return { reason: 'Could not build a verified mud-cleaning swap without automatic matches.' };
}

export function repairStuckEntityProgress(board, config, entityType, options = {}) {
  const targetEntityKey = options.targetEntityKey ?? null;
  const candidates = getEntityCells(board, entityType)
    .filter(
      (entityCell) =>
        (!targetEntityKey || entityCell.key === targetEntityKey) &&
        isEntityInProgressZone(entityCell, config) &&
        entityCell.row < config.height - 1,
    )
    .sort((a, b) => b.row - a.row);

  if (candidates.length === 0) {
    return { reason: 'No eligible stuck ball in rows 5-6.' };
  }

  for (const entityCell of candidates) {
    if (hasUsefulMoveForEntity(board, config, entityCell)) {
      continue;
    }

    const preservedUsefulKeys = getUsefulEntityKeys(board, config, entityType, entityCell.key);
    const preservedRepair = tryBuildTargetedEntityRepair(board, config, entityType, entityCell, preservedUsefulKeys);

    if (preservedRepair) {
      return preservedRepair;
    }

    const repair = tryBuildTargetedEntityRepair(board, config, entityType, entityCell, null);

    if (repair) {
      return repair;
    }
  }

  return { reason: 'Could not build a verified ball-progress swap without automatic matches.' };
}

export function getCollection(matches, board) {
  const collected = new Map();

  for (const cell of matches.cells) {
    const tile = getCellTile(board[cell.row]?.[cell.col]);
    if (tile) {
      collected.set(tile.type, (collected.get(tile.type) ?? 0) + 1);
    }
  }

  return collected;
}

export function scoreMatches(matches, scoring, cascadeIndex) {
  const uniqueTileScore = matches.cells.length * scoring.basePerTile;
  const shapeBonus = matches.groups.reduce((total, group) => {
    const extraTiles = Math.max(0, group.cells.length - 3);
    return total + extraTiles * scoring.extraMatchTileBonus;
  }, 0);
  const cascadeScore = cascadeIndex > 0 ? scoring.cascadeBonus * cascadeIndex : 0;

  return uniqueTileScore + shapeBonus + cascadeScore;
}

function placeBoardObjects(board, config) {
  const objects = config.boardObjects ?? [];

  if (objects.length === 0) {
    return board;
  }

  const attempts = Math.max(1, Math.max(...objects.map((objectConfig) => objectConfig.placement?.layoutAttempts ?? 1)));
  let fallback = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const placed = placeBoardObjectLayout(board, config, objects);

    if (!placed) {
      continue;
    }

    fallback = fallback ?? placed;

    if (isWithinAllObjectPlacementGoals(placed, config)) {
      return placed;
    }
  }

  return fallback;
}

function placeBoardObjectLayout(board, config, objects) {
  const next = cloneBoard(board);
  const occupied = new Set();
  const placedCells = [];

  for (const objectConfig of objects) {
    let candidates = getObjectPlacementCandidates(config, objectConfig);
    let placedForObject = 0;
    const requiredTopRowCount = objectConfig.placement?.topRowCount ?? 0;

    for (let index = 0; index < requiredTopRowCount && candidates.length > 0; index += 1) {
      const topRowCandidates = candidates.filter(
        (cell) =>
          isObjectTopRowCandidate(cell, objectConfig) &&
          !occupied.has(makeCellKey(cell)) &&
          isFarEnoughFromPlacedObjects(cell, placedCells, config, objectConfig),
      );

      if (topRowCandidates.length === 0) {
        break;
      }

      const placedCell = topRowCandidates[Math.floor(Math.random() * topRowCandidates.length)];
      placeObjectCell(next, placedCell, objectConfig, occupied, placedCells);
      candidates = candidates.filter((cell) => makeCellKey(cell) !== makeCellKey(placedCell));
      placedForObject += 1;
    }

    for (let index = 0; index < objectConfig.count && candidates.length > 0; index += 1) {
      if (placedForObject >= objectConfig.count) {
        break;
      }

      const validCandidates = candidates.filter(
        (cell) =>
          !occupied.has(makeCellKey(cell)) &&
          !isObjectTopRowCandidate(cell, objectConfig) &&
          isFarEnoughFromPlacedObjects(cell, placedCells, config, objectConfig),
      );

      if (validCandidates.length === 0) {
        break;
      }

      candidates = validCandidates;
      const candidateIndex = Math.floor(Math.random() * candidates.length);
      const placedCell = candidates.splice(candidateIndex, 1)[0];
      placeObjectCell(next, placedCell, objectConfig, occupied, placedCells);
      placedForObject += 1;
    }

    if (placedForObject < objectConfig.count) {
      return null;
    }
  }

  return next;
}

function placeObjectCell(board, cell, objectConfig, occupied, placedCells) {
  const placedCell = { row: cell.row, col: cell.col };
  occupied.add(makeCellKey(placedCell));
  placedCells.push(placedCell);

  board[cell.row][cell.col] = createCell(null, {
    key: crypto.randomUUID(),
    type: objectConfig.id,
    state: 'active',
  });
}

function placeGravityEntities(board, config) {
  const entities = config.gravityEntities ?? [];

  if (entities.length === 0) {
    return board;
  }

  const next = cloneBoard(board);
  const placedCells = [];
  const occupiedColumns = new Set();

  for (const entityConfig of entities) {
    let candidates = getGravityEntityPlacementCandidates(next, config, entityConfig, false);
    let placedForEntity = 0;

    for (let index = 0; index < entityConfig.count && candidates.length > 0; index += 1) {
      const validCandidates = candidates.filter(
        (cell) =>
          !occupiedColumns.has(cell.col) &&
          placedCells.every((placedCell) => getManhattanDistance(cell, placedCell) > 1),
      );

      if (validCandidates.length === 0) {
        break;
      }

      const picked = pickWeightedGravityEntityCandidate(validCandidates, config, entityConfig);
      next[picked.row][picked.col].tile = createGravityEntityTile(entityConfig);
      placedCells.push(picked);
      occupiedColumns.add(picked.col);
      candidates = candidates.filter((cell) => makeCellKey(cell) !== makeCellKey(picked));
      placedForEntity += 1;
    }

    if (placedForEntity < entityConfig.count) {
      return null;
    }
  }

  return next;
}

function placeTerrain(board, config) {
  const terrainConfigs = config.terrain ?? [];

  if (terrainConfigs.length === 0) {
    return board;
  }

  const attempts = Math.max(1, Math.max(...terrainConfigs.map((terrainConfig) => terrainConfig.placement?.layoutAttempts ?? 1)));
  let fallback = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const placed = placeTerrainLayout(board, config, terrainConfigs);

    if (!placed) {
      continue;
    }

    fallback = fallback ?? placed;

    if (isWithinAllTerrainPlacementGoals(placed, config)) {
      return placed;
    }
  }

  return fallback;
}

function placeTerrainLayout(board, config, terrainConfigs) {
  const next = cloneBoard(board);

  for (const terrainConfig of terrainConfigs) {
    const occupied = getOccupiedTerrainKeys(next);
    const rowCounts = getTerrainRowCounts(next, terrainConfig.id);
    const colCounts = getTerrainColumnCounts(next, terrainConfig.id);
    const placedCells = getTerrainCells(next, terrainConfig.id);
    const pairAnchors = [];
    let candidates = getTerrainPlacementCandidates(next, config, terrainConfig);
    let placedForTerrain = 0;
    const adjacentPairCount = getAdjacentPairCount(terrainConfig);

    for (
      let pairIndex = 0;
      pairIndex < adjacentPairCount && placedForTerrain + 1 < terrainConfig.count;
      pairIndex += 1
    ) {
      const pairCandidates = getTerrainPairCandidates(candidates, next, terrainConfig).filter((pair) =>
        isValidTerrainPair(pair, config, terrainConfig, occupied, rowCounts, colCounts, placedCells, pairAnchors),
      );

      if (pairCandidates.length === 0) {
        break;
      }

      const pair = pickWeightedTerrainCandidate(pairCandidates, config, terrainConfig);
      const anchor = getPairAnchor(pair);

      for (const cell of pair) {
        placeTerrainCell(next, cell, terrainConfig, occupied, rowCounts, colCounts);
        placedCells.push(cell);
        placedForTerrain += 1;
      }

      pairAnchors.push(anchor);
      candidates = candidates.filter((cell) => !occupied.has(makeCellKey(cell)));
    }

    while (placedForTerrain < terrainConfig.count && candidates.length > 0) {
      const validCandidates = candidates.filter(
        (cell) =>
          !occupied.has(makeCellKey(cell)) &&
          isWithinTerrainSpreadLimits(cell, config, terrainConfig, rowCounts, colCounts) &&
          isWithinTerrainClusterLimit(cell, config, terrainConfig, placedCells),
      );

      if (validCandidates.length === 0) {
        break;
      }

      candidates = validCandidates;
      const placedCell = pickWeightedTerrainCandidate(candidates, config, terrainConfig);
      candidates = candidates.filter((cell) => makeCellKey(cell) !== makeCellKey(placedCell));
      placeTerrainCell(next, placedCell, terrainConfig, occupied, rowCounts, colCounts);
      placedCells.push(placedCell);
      placedForTerrain += 1;
    }

    if (placedForTerrain < terrainConfig.count) {
      return null;
    }
  }

  return next;
}

function placeTerrainCell(board, cell, terrainConfig, occupied, rowCounts, colCounts) {
  occupied.add(makeCellKey(cell));
  rowCounts.set(cell.row, (rowCounts.get(cell.row) ?? 0) + 1);
  colCounts.set(cell.col, (colCounts.get(cell.col) ?? 0) + 1);

  board[cell.row][cell.col].terrain = {
    type: terrainConfig.id,
    state: 'dirty',
  };
}

function makeBoardFromObjectLayout(sourceBoard, config, tileTypes) {
  let fallback;

  for (let attempts = 0; attempts < 200; attempts += 1) {
    const board = [];

    for (let row = 0; row < config.height; row += 1) {
      const boardRow = [];

      for (let col = 0; col < config.width; col += 1) {
        const object = sourceBoard[row]?.[col]?.object;
        const terrain = sourceBoard[row]?.[col]?.terrain;

        if (object) {
          boardRow.push(createCell(null, { ...object }, terrain ? { ...terrain } : null));
          continue;
        }

        const sourceTile = sourceBoard[row]?.[col]?.tile;

        if (sourceTile?.entity) {
          boardRow.push(createCell({ ...sourceTile, state: 'idle' }, null, terrain ? { ...terrain } : null));
          continue;
        }

        const blocked = new Set();
        const leftOne = getCellTile(boardRow[col - 1]);
        const leftTwo = getCellTile(boardRow[col - 2]);
        const aboveOne = getCellTile(board[row - 1]?.[col]);
        const aboveTwo = getCellTile(board[row - 2]?.[col]);

        if (leftOne?.type && leftOne.type === leftTwo?.type) {
          blocked.add(leftOne.type);
        }

        if (aboveOne?.type && aboveOne.type === aboveTwo?.type) {
          blocked.add(aboveOne.type);
        }

        boardRow.push(createCell(createRandomTile(tileTypes, blocked), null, terrain ? { ...terrain } : null));
      }

      board.push(boardRow);
    }

    fallback = board;

    if (findMatches(board, config).cells.length === 0 && hasPossibleMove(board, config)) {
      return board;
    }
  }

  return fallback;
}

function fillColumnSegment(board, next, col, segmentTop, segmentBottom, tileTypes) {
  if (segmentTop > segmentBottom) {
    return;
  }

  const existing = [];

  for (let row = segmentBottom; row >= segmentTop; row -= 1) {
    const tile = getCellTile(board[row][col]);

    if (tile) {
      existing.push({ ...tile, state: 'falling' });
    }
  }

  for (let row = segmentBottom; row >= segmentTop; row -= 1) {
    next[row][col].tile = existing.shift() ?? {
      ...createRandomTile(tileTypes),
      state: 'entering',
    };
  }
}

function getGravityEntityPlacementCandidates(board, config, entityConfig, forSpawn) {
  const candidates = [];

  for (let row = 0; row < config.height; row += 1) {
    for (let col = 0; col < config.width; col += 1) {
      const cell = { row, col };

      if (isGravityEntityPlacementCell(board, cell, config, entityConfig, forSpawn)) {
        candidates.push(cell);
      }
    }
  }

  return candidates;
}

function isGravityEntityPlacementCell(board, cell, config, entityConfig, forSpawn) {
  const placement = entityConfig.placement ?? {};
  const minRow = forSpawn ? (placement.spawnMinRow ?? 0) : (placement.minRow ?? 0);
  const maxRow = forSpawn
    ? (placement.spawnMaxRow ?? Math.min(2, config.height - 3))
    : (placement.maxRow ?? config.height - 3);
  const boardCell = board[cell.row]?.[cell.col];

  return (
    cell.row >= minRow &&
    cell.row <= maxRow &&
    cell.row < config.height - (placement.minRowsBelow ?? 2) &&
    cell.col >= (placement.minCol ?? 0) &&
    cell.col <= (placement.maxCol ?? config.width - 1) &&
    !isForbiddenGravityEntityCell(cell, config, entityConfig) &&
    Boolean(boardCell?.tile) &&
    isMatchableTile(boardCell.tile) &&
    !boardCell.object
  );
}

function isForbiddenGravityEntityCell(cell, config, entityConfig) {
  if (!entityConfig.placement?.avoidCorners) {
    return false;
  }

  const isTopOrBottom = cell.row === 0 || cell.row === config.height - 1;
  const isLeftOrRight = cell.col === 0 || cell.col === config.width - 1;

  return isTopOrBottom && isLeftOrRight;
}

function pickWeightedGravityEntityCandidate(candidates, config, entityConfig) {
  const preferredRows = entityConfig.placement?.preferredRows ?? [];
  const weights = candidates.map((candidate) => (preferredRows.includes(candidate.row) ? 4 : 1));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let threshold = Math.random() * totalWeight;

  for (let index = 0; index < candidates.length; index += 1) {
    threshold -= weights[index];

    if (threshold <= 0) {
      return candidates[index];
    }
  }

  return candidates[candidates.length - 1];
}

function createGravityEntityTile(entityConfig, state = 'idle') {
  return {
    key: crypto.randomUUID(),
    type: entityConfig.id,
    entity: entityConfig.entity ?? entityConfig.id,
    state,
    matchable: false,
    swappable: false,
  };
}

function getObjectPlacementCandidates(config, objectConfig) {
  const candidates = [];

  for (let row = 0; row < config.height; row += 1) {
    for (let col = 0; col < config.width; col += 1) {
      const cell = { row, col };

      if (isObjectPlacementCell(cell, config, objectConfig)) {
        candidates.push(cell);
      }
    }
  }

  return candidates;
}

function isObjectPlacementCell(cell, config, objectConfig) {
  const borderPadding = objectConfig.placement?.borderPadding ?? 0;
  const placement = objectConfig.placement ?? {};
  const topRow = placement.topRow ?? 0;
  const isInsidePaddedArea =
    cell.row >= borderPadding &&
    cell.row <= config.height - borderPadding - 1 &&
    cell.col >= borderPadding &&
    cell.col <= config.width - borderPadding - 1;

  if ((placement.topRowCount ?? 0) > 0 && cell.row === topRow && !isObjectTopRowCandidate(cell, objectConfig)) {
    return false;
  }

  return (isInsidePaddedArea || isObjectTopRowCandidate(cell, objectConfig)) && !isForbiddenObjectCell(cell, objectConfig);
}

function isObjectTopRowCandidate(cell, objectConfig) {
  const placement = objectConfig.placement ?? {};
  const topRowCount = placement.topRowCount ?? 0;

  if (topRowCount <= 0) {
    return false;
  }

  const topRow = placement.topRow ?? 0;
  const allowedColumns = placement.topRowColumns;

  return cell.row === topRow && (!allowedColumns || allowedColumns.includes(cell.col));
}

function isForbiddenObjectCell(cell, objectConfig) {
  return (objectConfig.placement?.forbiddenCells ?? []).some(
    (forbidden) => forbidden.row === cell.row && forbidden.col === cell.col,
  );
}

function isFarEnoughFromPlacedObjects(cell, placedCells, config, objectConfig) {
  const minDistance = getMinimumObjectDistance(config, objectConfig);

  return placedCells.every((placedCell) => getObjectDistance(cell, placedCell, objectConfig) >= minDistance);
}

function getMinimumObjectDistance(config, objectConfig) {
  const ratio = objectConfig.placement?.minDistanceRatio ?? 0;
  const borderPadding = objectConfig.placement?.borderPadding ?? 0;
  const gridWidth =
    objectConfig.placement?.distanceBasis === 'spawnArea'
      ? Math.max(1, config.width - borderPadding * 2)
      : config.width;
  const gridHeight =
    objectConfig.placement?.distanceBasis === 'spawnArea'
      ? Math.max(1, config.height - borderPadding * 2)
      : config.height;
  const gridSize = Math.min(gridWidth, gridHeight);

  return Math.ceil(gridSize * ratio);
}

function getObjectDistance(a, b, objectConfig) {
  if (objectConfig.placement?.distanceMetric === 'euclidean') {
    return Math.hypot(a.row - b.row, a.col - b.col);
  }

  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function getTerrainPlacementCandidates(board, config, terrainConfig) {
  const candidates = [];

  for (let row = 0; row < config.height; row += 1) {
    for (let col = 0; col < config.width; col += 1) {
      const cell = { row, col };

      if (isTerrainPlacementCell(board, cell, config, terrainConfig)) {
        candidates.push(cell);
      }
    }
  }

  return candidates;
}

function getTerrainPairCandidates(candidates, board, terrainConfig) {
  const candidateKeys = new Set(candidates.map(makeCellKey));
  const direction = terrainConfig.placement?.adjacentPairDirection ?? 'horizontal';
  const offsets =
    direction === 'vertical'
      ? [{ row: 1, col: 0 }]
      : direction === 'either'
        ? [
            { row: 0, col: 1 },
            { row: 1, col: 0 },
          ]
        : [{ row: 0, col: 1 }];

  const pairs = [];

  for (const cell of candidates) {
    for (const offset of offsets) {
      const pairedCell = {
        row: cell.row + offset.row,
        col: cell.col + offset.col,
      };

      if (!candidateKeys.has(makeCellKey(pairedCell))) {
        continue;
      }

      pairs.push([cell, pairedCell]);
    }
  }

  if (!terrainConfig.placement?.preferSameTilePair) {
    return pairs;
  }

  const sameTilePairs = pairs.filter(([first, second]) => {
    const firstType = board[first.row]?.[first.col]?.tile?.type;
    const secondType = board[second.row]?.[second.col]?.tile?.type;

    return firstType && firstType === secondType;
  });

  return sameTilePairs.length > 0 ? sameTilePairs : pairs;
}

function getAdjacentPairCount(terrainConfig) {
  const { adjacentPairCount, adjacentPairCountRange } = terrainConfig.placement ?? {};

  if (!adjacentPairCountRange) {
    return adjacentPairCount ?? 0;
  }

  const [min, max] = adjacentPairCountRange;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function isValidTerrainPair(pair, config, terrainConfig, occupied, rowCounts, colCounts, placedCells, pairAnchors) {
  return (
    pair.every(
      (cell) =>
        !occupied.has(makeCellKey(cell)) &&
        isWithinTerrainSpreadLimits(cell, config, terrainConfig, rowCounts, colCounts) &&
        isWithinTerrainClusterLimit(cell, config, terrainConfig, placedCells),
    ) &&
    isPairSpreadOut(pair, terrainConfig, pairAnchors) &&
    getExternalTerrainNeighborCount(pair, config, placedCells) <= (terrainConfig.placement?.maxPairExternalNeighbors ?? 1)
  );
}

function pickWeightedTerrainCandidate(candidates, config, terrainConfig) {
  const weights = candidates.map((candidate) => getTerrainCandidateWeight(candidate, config, terrainConfig));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let threshold = Math.random() * totalWeight;

  for (let index = 0; index < candidates.length; index += 1) {
    threshold -= weights[index];

    if (threshold <= 0) {
      return candidates[index];
    }
  }

  return candidates[candidates.length - 1];
}

function getTerrainCandidateWeight(cell, config, terrainConfig) {
  if (Array.isArray(cell)) {
    return cell.reduce((total, pairCell) => total + getTerrainCandidateWeight(pairCell, config, terrainConfig), 0);
  }

  const middleRows = terrainConfig.placement?.preferredRows;

  if (middleRows?.includes(cell.row)) {
    return terrainConfig.placement?.preferredRowWeight ?? 4;
  }

  if (cell.row >= config.height - 2) {
    return terrainConfig.placement?.bottomRowWeight ?? 0.35;
  }

  return 1;
}

function isTerrainPlacementCell(board, cell, config, terrainConfig) {
  const borderPadding = terrainConfig.placement?.borderPadding ?? 0;
  const boardCell = board[cell.row]?.[cell.col];

  return (
    cell.row >= borderPadding &&
    cell.row <= config.height - borderPadding - 1 &&
    cell.col >= borderPadding &&
    cell.col <= config.width - borderPadding - 1 &&
    !isForbiddenTerrainCell(cell, config, terrainConfig) &&
    Boolean(boardCell?.tile) &&
    !boardCell.object &&
    !boardCell.terrain
  );
}

function isForbiddenTerrainCell(cell, config, terrainConfig) {
  if (!terrainConfig.placement?.avoidCorners) {
    return false;
  }

  const isTopOrBottom = cell.row === 0 || cell.row === config.height - 1;
  const isLeftOrRight = cell.col === 0 || cell.col === config.width - 1;

  return isTopOrBottom && isLeftOrRight;
}

function isWithinTerrainSpreadLimits(cell, config, terrainConfig, rowCounts, colCounts) {
  const maxPerRow = terrainConfig.placement?.maxPerRow ?? Infinity;
  const maxPerColumn = terrainConfig.placement?.maxPerColumn ?? Infinity;
  const maxBottomRow = terrainConfig.placement?.maxBottomRow ?? Infinity;
  const maxSecondBottomRow = terrainConfig.placement?.maxSecondBottomRow ?? Infinity;
  const maxBottomTwoRows = terrainConfig.placement?.maxBottomTwoRows ?? Infinity;
  const nextRowCount = (rowCounts.get(cell.row) ?? 0) + 1;
  const nextColCount = (colCounts.get(cell.col) ?? 0) + 1;
  const bottomRow = config.height - 1;
  const secondBottomRow = config.height - 2;
  const bottomTwoCount =
    (rowCounts.get(bottomRow) ?? 0) + (rowCounts.get(secondBottomRow) ?? 0) + (cell.row >= secondBottomRow ? 1 : 0);

  if (nextRowCount > maxPerRow || nextColCount > maxPerColumn || bottomTwoCount > maxBottomTwoRows) {
    return false;
  }

  if (cell.row === bottomRow && nextRowCount > maxBottomRow) {
    return false;
  }

  if (cell.row === secondBottomRow && nextRowCount > maxSecondBottomRow) {
    return false;
  }

  return true;
}

function isWithinTerrainClusterLimit(cell, config, terrainConfig, placedCells) {
  const maxNeighbors = terrainConfig.placement?.maxOrthogonalTerrainNeighbors ?? Infinity;
  const placedKeys = new Set(placedCells.map(makeCellKey));
  const neighborCount = getOrthogonalNeighbors(cell).filter(
    (neighbor) => isInsideBoard(neighbor, config) && placedKeys.has(makeCellKey(neighbor)),
  ).length;

  return neighborCount <= maxNeighbors;
}

function isPairSpreadOut(pair, terrainConfig, pairAnchors) {
  const minDistance = terrainConfig.placement?.minPairAnchorDistance ?? 0;

  if (minDistance <= 0) {
    return true;
  }

  const anchor = getPairAnchor(pair);

  return pairAnchors.every((placedAnchor) => getManhattanDistance(anchor, placedAnchor) >= minDistance);
}

function getPairAnchor(pair) {
  return {
    row: pair.reduce((total, cell) => total + cell.row, 0) / pair.length,
    col: pair.reduce((total, cell) => total + cell.col, 0) / pair.length,
  };
}

function getExternalTerrainNeighborCount(pair, config, placedCells) {
  const pairKeys = new Set(pair.map(makeCellKey));
  const placedKeys = new Set(placedCells.map(makeCellKey));
  let count = 0;

  for (const cell of pair) {
    for (const neighbor of getOrthogonalNeighbors(cell)) {
      if (isInsideBoard(neighbor, config) && !pairKeys.has(makeCellKey(neighbor)) && placedKeys.has(makeCellKey(neighbor))) {
        count += 1;
      }
    }
  }

  return count;
}

function isWithinAllTerrainPlacementGoals(board, config) {
  return (config.terrain ?? []).every((terrainConfig) => isWithinTerrainPlacementGoals(board, config, terrainConfig));
}

function isWithinAllObjectPlacementGoals(board, config) {
  return (config.boardObjects ?? []).every((objectConfig) => isWithinObjectPlacementGoals(board, config, objectConfig));
}

function isWithinObjectPlacementGoals(board, config, objectConfig) {
  const cells = getObjectCells(board, objectConfig.id);
  const placement = objectConfig.placement ?? {};
  const topRow = placement.topRow ?? 0;
  const topRowCount = cells.filter((cell) => cell.row === topRow).length;
  const requiredTopRowCount = placement.topRowCount;
  const maxAdditionalBorderCount = placement.maxAdditionalBorderCount ?? Infinity;
  const additionalBorderCount = Math.max(0, countBorderObjectCells(cells, config) - topRowCount);
  const requiredCollectible = placement.minImmediatelyCollectible ?? 0;
  const maxImmediateCollection = placement.maxImmediateCollection ?? Infinity;

  return (
    cells.length === objectConfig.count &&
    cells.every((cell) => !isForbiddenObjectCell(cell, objectConfig)) &&
    (requiredTopRowCount === undefined || topRowCount === requiredTopRowCount) &&
    additionalBorderCount <= maxAdditionalBorderCount &&
    countImmediatelyCollectibleObjects(board, config, objectConfig.id) >= requiredCollectible &&
    getMaxImmediateObjectCollection(board, config, objectConfig.id) <= maxImmediateCollection
  );
}

function countBorderObjectCells(cells, config) {
  return cells.filter(
    (cell) => cell.row === 0 || cell.row === config.height - 1 || cell.col === 0 || cell.col === config.width - 1,
  ).length;
}

function isWithinTerrainPlacementGoals(board, config, terrainConfig) {
  const cells = getTerrainCells(board, terrainConfig.id);
  const rowCounts = getTerrainRowCounts(board, terrainConfig.id);
  const colCounts = getTerrainColumnCounts(board, terrainConfig.id);
  const placement = terrainConfig.placement ?? {};
  const bottomRow = config.height - 1;
  const secondBottomRow = config.height - 2;
  const bottomTwoCount = (rowCounts.get(bottomRow) ?? 0) + (rowCounts.get(secondBottomRow) ?? 0);
  const adjacentPairCount = countAdjacentTerrainPairs(cells, config);
  const preferredRowCount = cells.filter((cell) => placement.preferredRows?.includes(cell.row)).length;

  return (
    cells.length === terrainConfig.count &&
    cells.every((cell) => !isForbiddenTerrainCell(cell, config, terrainConfig)) &&
    Math.max(0, ...rowCounts.values()) <= (placement.maxPerRow ?? Infinity) &&
    Math.max(0, ...colCounts.values()) <= (placement.maxPerColumn ?? Infinity) &&
    (rowCounts.get(bottomRow) ?? 0) <= (placement.maxBottomRow ?? Infinity) &&
    (rowCounts.get(secondBottomRow) ?? 0) <= (placement.maxSecondBottomRow ?? Infinity) &&
    bottomTwoCount <= (placement.maxBottomTwoRows ?? Infinity) &&
    preferredRowCount >= (placement.minPreferredRowCount ?? 0) &&
    adjacentPairCount >= (placement.minAdjacentPairs ?? 0) &&
    adjacentPairCount <= (placement.maxAdjacentPairs ?? Infinity)
  );
}

function isFairInitialBoard(board, config) {
  return (
    (config.terrain ?? []).every((terrainConfig) => {
      const requiredCleanable = terrainConfig.placement?.minImmediatelyCleanable ?? 0;

      if (requiredCleanable === 0) {
        return true;
      }

      return countImmediatelyCleanableTerrainCells(board, config, terrainConfig.id) >= requiredCleanable;
    }) &&
    (config.boardObjects ?? []).every((objectConfig) => {
      const requiredCollectible = objectConfig.placement?.minImmediatelyCollectible ?? 0;

      if (requiredCollectible === 0) {
        return true;
      }

      return countImmediatelyCollectibleObjects(board, config, objectConfig.id) >= requiredCollectible;
    })
  );
}

function countImmediatelyCollectibleObjects(board, config, objectType) {
  const collectible = new Set();

  for (const collectableCells of getImmediateObjectCollectionOptions(board, config, objectType)) {
    for (const cell of collectableCells) {
      collectible.add(makeCellKey(cell));
    }
  }

  return collectible.size;
}

function getMaxImmediateObjectCollection(board, config, objectType) {
  return Math.max(0, ...getImmediateObjectCollectionOptions(board, config, objectType).map((cells) => cells.length));
}

function getImmediateObjectCollectionOptions(board, config, objectType) {
  const options = [];

  for (let row = 0; row < config.height; row += 1) {
    for (let col = 0; col < config.width; col += 1) {
      const current = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const target of candidates) {
        if (target.row >= config.height || target.col >= config.width || !canSwapCells(board, current, target)) {
          continue;
        }

        const swapped = swapTiles(board, current, target);
        const matches = findMatches(swapped, config);

        if (matches.cells.length === 0) {
          continue;
        }

        const collected = findAdjacentObjects(matches, swapped, config, objectType);

        if (collected.length > 0) {
          options.push(collected);
        }
      }
    }
  }

  return options;
}

function countImmediatelyCleanableTerrainCells(board, config, terrainType) {
  const cleanable = new Set();

  for (let row = 0; row < config.height; row += 1) {
    for (let col = 0; col < config.width; col += 1) {
      const current = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const target of candidates) {
        if (target.row >= config.height || target.col >= config.width || !canSwapCells(board, current, target)) {
          continue;
        }

        const matches = findMatches(swapTiles(board, current, target), config);

        for (const cell of findMatchedTerrain(matches, board, terrainType)) {
          cleanable.add(makeCellKey(cell));
        }
      }
    }
  }

  return cleanable.size;
}

function countAdjacentTerrainPairs(cells, config) {
  const keys = new Set(cells.map(makeCellKey));
  let count = 0;

  for (const cell of cells) {
    const neighbors = [
      { row: cell.row, col: cell.col + 1 },
      { row: cell.row + 1, col: cell.col },
    ];

    for (const neighbor of neighbors) {
      if (isInsideBoard(neighbor, config) && keys.has(makeCellKey(neighbor))) {
        count += 1;
      }
    }
  }

  return count;
}

function getTerrainCells(board, terrainType) {
  const cells = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col].terrain?.type === terrainType) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

function getObjectCells(board, objectType) {
  const cells = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col].object?.type === objectType) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

function getUsefulTerrainCleanOptions(board, config, terrainType) {
  const options = [];

  for (let row = 0; row < config.height; row += 1) {
    for (let col = 0; col < config.width; col += 1) {
      const current = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const target of candidates) {
        if (target.row >= config.height || target.col >= config.width || !canSwapCells(board, current, target)) {
          continue;
        }

        const swapped = swapTiles(board, current, target);
        const matches = findMatches(swapped, config);
        const cleaned = findMatchedTerrain(matches, swapped, terrainType);

        if (cleaned.length > 0) {
          options.push({
            from: current,
            to: target,
            cleaned,
          });
        }
      }
    }
  }

  return options;
}

function tryBuildTargetedTerrainRepair(board, config, terrainType, terrainCell) {
  const patterns = getTerrainCleanRepairPatterns(board, config, terrainCell);
  const scopeCells = getTerrainRepairScopeCells(board, config, terrainCell, 2, 3);
  const swappableScope = scopeCells.filter((cell) => isSwappableTile(getCellTile(board[cell.row]?.[cell.col])));
  const typeCounts = getTileTypeCounts(swappableScope, board);
  const candidateTypes = [...typeCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([type]) => type)
    .sort();

  for (const pattern of patterns) {
    for (const targetType of candidateTypes) {
      const targetSources = swappableScope
        .filter((cell) => getCellTile(board[cell.row][cell.col])?.type === targetType)
        .sort(compareCellsByDistance(pattern.center, terrainCell));

      if (targetSources.length < 3) {
        continue;
      }

      const blockerSources = swappableScope
        .filter((cell) => getCellTile(board[cell.row][cell.col])?.type !== targetType)
        .sort(compareCellsByDistance(pattern.swapTo, terrainCell));
      const targetSourceGroups = getSourceGroups(targetSources, 3, 24);

      for (const targetSourceGroup of targetSourceGroups) {
        for (const blockerSource of blockerSources) {
          const repair = buildTerrainRepairCandidate(
            board,
            config,
            terrainType,
            terrainCell,
            pattern,
            targetSourceGroup,
            blockerSource,
          );

          if (repair) {
            return repair;
          }
        }
      }
    }
  }

  return null;
}

function buildTerrainRepairCandidate(board, config, terrainType, terrainCell, pattern, targetSources, blockerSource) {
  const targetDestinations = [pattern.center, pattern.side, pattern.swapFrom];
  const assignments = new Map();
  const usedSourceKeys = new Set();

  for (const destination of targetDestinations) {
    const source = targetSources.find(
      (cell) => !usedSourceKeys.has(makeCellKey(cell)) && isSameCell(cell, destination),
    ) ?? targetSources.find((cell) => !usedSourceKeys.has(makeCellKey(cell)));

    if (!source) {
      return null;
    }

    assignments.set(makeCellKey(destination), { ...getCellTile(board[source.row][source.col]), state: 'paw-shuffle' });
    usedSourceKeys.add(makeCellKey(source));
  }

  if (usedSourceKeys.has(makeCellKey(blockerSource))) {
    return null;
  }

  assignments.set(makeCellKey(pattern.swapTo), { ...getCellTile(board[blockerSource.row][blockerSource.col]), state: 'paw-shuffle' });
  usedSourceKeys.add(makeCellKey(blockerSource));

  const affectedCells = getUniqueCells([
    ...targetDestinations,
    pattern.swapTo,
    ...targetSources.filter((cell) => usedSourceKeys.has(makeCellKey(cell))),
    blockerSource,
  ]);
  const assignedKeys = new Set(assignments.keys());
  const remainingTiles = affectedCells
    .filter((cell) => !usedSourceKeys.has(makeCellKey(cell)))
    .map((cell) => ({ ...getCellTile(board[cell.row][cell.col]), state: 'paw-shuffle' }));
  const remainingCells = affectedCells.filter((cell) => !assignedKeys.has(makeCellKey(cell)));

  if (remainingTiles.length !== remainingCells.length) {
    return null;
  }

  const candidate = cloneBoard(board);

  for (const cell of remainingCells) {
    assignments.set(makeCellKey(cell), remainingTiles.shift());
  }

  for (const cell of affectedCells) {
    const tile = assignments.get(makeCellKey(cell));

    if (!tile) {
      return null;
    }

    candidate[cell.row][cell.col].tile = tile;
  }

  if (!isValidTerrainRepair(candidate, board, config, terrainType, terrainCell)) {
    return null;
  }

  return {
    board: candidate,
    cells: affectedCells,
  };
}

function isValidTerrainRepair(candidate, originalBoard, config, terrainType, terrainCell) {
  if (findMatches(candidate, config).cells.length > 0 || !hasPossibleMove(candidate, config)) {
    return false;
  }

  if (!hasUsefulMoveForTerrainClean(candidate, config, terrainType)) {
    return false;
  }

  const originalTerrainKeys = new Set(getTerrainCells(originalBoard, terrainType).map(makeCellKey));
  const candidateTerrainKeys = new Set(getTerrainCells(candidate, terrainType).map(makeCellKey));

  if (originalTerrainKeys.size !== candidateTerrainKeys.size) {
    return false;
  }

  for (const key of originalTerrainKeys) {
    if (!candidateTerrainKeys.has(key)) {
      return false;
    }
  }

  return getUsefulTerrainCleanOptions(candidate, config, terrainType).some((option) =>
    option.cleaned.some((cell) => isSameCell(cell, terrainCell)),
  );
}

function getTerrainCleanRepairPatterns(board, config, terrainCell) {
  const directions = [
    {
      side: { row: terrainCell.row, col: terrainCell.col - 1 },
      swapTo: { row: terrainCell.row, col: terrainCell.col + 1 },
      swapSources: [
        { row: terrainCell.row - 1, col: terrainCell.col + 1 },
        { row: terrainCell.row + 1, col: terrainCell.col + 1 },
      ],
    },
    {
      side: { row: terrainCell.row, col: terrainCell.col + 1 },
      swapTo: { row: terrainCell.row, col: terrainCell.col - 1 },
      swapSources: [
        { row: terrainCell.row - 1, col: terrainCell.col - 1 },
        { row: terrainCell.row + 1, col: terrainCell.col - 1 },
      ],
    },
    {
      side: { row: terrainCell.row - 1, col: terrainCell.col },
      swapTo: { row: terrainCell.row + 1, col: terrainCell.col },
      swapSources: [
        { row: terrainCell.row + 1, col: terrainCell.col - 1 },
        { row: terrainCell.row + 1, col: terrainCell.col + 1 },
      ],
    },
    {
      side: { row: terrainCell.row + 1, col: terrainCell.col },
      swapTo: { row: terrainCell.row - 1, col: terrainCell.col },
      swapSources: [
        { row: terrainCell.row - 1, col: terrainCell.col - 1 },
        { row: terrainCell.row - 1, col: terrainCell.col + 1 },
      ],
    },
  ];

  return directions.flatMap((pattern) =>
    pattern.swapSources
      .map((swapFrom) => ({
        center: terrainCell,
        side: pattern.side,
        swapTo: pattern.swapTo,
        swapFrom,
      }))
      .filter((candidate) =>
        [candidate.center, candidate.side, candidate.swapTo, candidate.swapFrom].every(
          (cell) => isInsideBoard(cell, config) && isSwappableTile(getCellTile(board[cell.row]?.[cell.col])),
        ),
      ),
  );
}

function getTerrainRepairScopeCells(board, config, terrainCell, rowRadius, colRadius) {
  const cells = [];
  const minRow = Math.max(0, terrainCell.row - rowRadius);
  const maxRow = Math.min(config.height - 1, terrainCell.row + rowRadius);
  const minCol = Math.max(0, terrainCell.col - colRadius);
  const maxCol = Math.min(config.width - 1, terrainCell.col + colRadius);

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      cells.push({ row, col });
    }
  }

  return cells;
}

function tryBuildTargetedEntityRepair(board, config, entityType, entityCell, preservedUsefulKeys) {
  const patterns = getEntityProgressRepairPatterns(board, config, entityCell);
  const scopeCells = getEntityRepairScopeCells(board, config, entityCell, 3, 3);
  const swappableScope = scopeCells.filter((cell) => isSwappableTile(getCellTile(board[cell.row]?.[cell.col])));
  const typeCounts = getTileTypeCounts(swappableScope, board);
  const candidateTypes = [...typeCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([type]) => type)
    .sort();

  for (const pattern of patterns) {
    for (const targetType of candidateTypes) {
      const targetSources = swappableScope
        .filter((cell) => getCellTile(board[cell.row][cell.col])?.type === targetType)
        .sort(compareCellsByDistance(pattern.below, entityCell));

      if (targetSources.length < 3) {
        continue;
      }

      const blockerSources = swappableScope
        .filter((cell) => getCellTile(board[cell.row][cell.col])?.type !== targetType)
        .sort(compareCellsByDistance(pattern.swapTo, entityCell));
      const targetSourceGroups = getSourceGroups(targetSources, 3, 20);

      for (const targetSourceGroup of targetSourceGroups) {
        for (const blockerSource of blockerSources) {
          const repair = buildEntityRepairCandidate(
            board,
            config,
            entityType,
            entityCell,
            pattern,
            targetSourceGroup,
            blockerSource,
            preservedUsefulKeys,
          );

          if (repair) {
            return repair;
          }
        }
      }
    }
  }

  return null;
}

function buildEntityRepairCandidate(
  board,
  config,
  entityType,
  entityCell,
  pattern,
  targetSources,
  blockerSource,
  preservedUsefulKeys,
) {
  const targetDestinations = [pattern.below, pattern.side, pattern.swapFrom];
  const assignments = new Map();
  const usedSourceKeys = new Set();

  for (const destination of targetDestinations) {
    const source = targetSources.find(
      (cell) => !usedSourceKeys.has(makeCellKey(cell)) && isSameCell(cell, destination),
    ) ?? targetSources.find((cell) => !usedSourceKeys.has(makeCellKey(cell)));

    if (!source) {
      return null;
    }

    assignments.set(makeCellKey(destination), { ...getCellTile(board[source.row][source.col]), state: 'paw-shuffle' });
    usedSourceKeys.add(makeCellKey(source));
  }

  if (usedSourceKeys.has(makeCellKey(blockerSource))) {
    return null;
  }

  assignments.set(makeCellKey(pattern.swapTo), { ...getCellTile(board[blockerSource.row][blockerSource.col]), state: 'paw-shuffle' });
  usedSourceKeys.add(makeCellKey(blockerSource));

  const affectedCells = getUniqueCells([
    ...targetDestinations,
    pattern.swapTo,
    ...targetSources.filter((cell) => usedSourceKeys.has(makeCellKey(cell))),
    blockerSource,
  ]);
  const assignedKeys = new Set(assignments.keys());
  const remainingTiles = affectedCells
    .filter((cell) => !usedSourceKeys.has(makeCellKey(cell)))
    .map((cell) => ({ ...getCellTile(board[cell.row][cell.col]), state: 'paw-shuffle' }));
  const remainingCells = affectedCells.filter((cell) => !assignedKeys.has(makeCellKey(cell)));

  if (remainingTiles.length !== remainingCells.length) {
    return null;
  }

  const candidate = cloneBoard(board);

  for (const cell of remainingCells) {
    assignments.set(makeCellKey(cell), remainingTiles.shift());
  }

  for (const cell of affectedCells) {
    const tile = assignments.get(makeCellKey(cell));

    if (!tile) {
      return null;
    }

    candidate[cell.row][cell.col].tile = tile;
  }

  if (!isValidEntityRepair(candidate, config, entityType, entityCell.key, preservedUsefulKeys)) {
    return null;
  }

  return {
    board: candidate,
    cells: affectedCells,
  };
}

function isValidEntityRepair(candidate, config, entityType, targetEntityKey, preservedUsefulKeys) {
  if (findMatches(candidate, config).cells.length > 0 || !hasPossibleMove(candidate, config)) {
    return false;
  }

  if (!hasUsefulMoveForEntityProgress(candidate, config, entityType, targetEntityKey)) {
    return false;
  }

  if (!preservedUsefulKeys || preservedUsefulKeys.size === 0) {
    return true;
  }

  const nextUsefulKeys = getUsefulEntityKeys(candidate, config, entityType, targetEntityKey);

  for (const key of preservedUsefulKeys) {
    if (!nextUsefulKeys.has(key)) {
      return false;
    }
  }

  return true;
}

function getEntityProgressRepairPatterns(board, config, entityCell) {
  const below = { row: entityCell.row + 1, col: entityCell.col };

  if (below.row >= config.height) {
    return [];
  }

  return [
    {
      below,
      side: { row: below.row, col: below.col - 1 },
      swapTo: { row: below.row, col: below.col + 1 },
      swapFrom: { row: below.row - 1, col: below.col + 1 },
    },
    {
      below,
      side: { row: below.row, col: below.col + 1 },
      swapTo: { row: below.row, col: below.col - 1 },
      swapFrom: { row: below.row - 1, col: below.col - 1 },
    },
  ].filter((pattern) =>
    [pattern.below, pattern.side, pattern.swapTo, pattern.swapFrom].every(
      (cell) => isInsideBoard(cell, config) && isSwappableTile(getCellTile(board[cell.row]?.[cell.col])),
    ),
  );
}

function getEntityRepairScopeCells(board, config, entityCell, rowRadius, colRadius) {
  const cells = [];
  const minRow = Math.max(0, entityCell.row - rowRadius);
  const maxRow = config.height - 1;
  const minCol = Math.max(0, entityCell.col - colRadius);
  const maxCol = Math.min(config.width - 1, entityCell.col + colRadius);

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      cells.push({ row, col });
    }
  }

  return cells;
}

function getUsefulEntityKeys(board, config, entityType, excludedKey = null) {
  return new Set(
    getEntityCells(board, entityType)
      .filter((entityCell) => entityCell.key !== excludedKey && hasUsefulMoveForEntity(board, config, entityCell))
      .map((entityCell) => entityCell.key),
  );
}

function getTileTypeCounts(cells, board) {
  const counts = new Map();

  for (const cell of cells) {
    const tile = getCellTile(board[cell.row]?.[cell.col]);

    if (tile) {
      counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1);
    }
  }

  return counts;
}

function getSourceGroups(sources, groupSize, limit) {
  const groups = [];

  function visit(startIndex, group) {
    if (groups.length >= limit) {
      return;
    }

    if (group.length === groupSize) {
      groups.push(group);
      return;
    }

    for (let index = startIndex; index < sources.length; index += 1) {
      visit(index + 1, [...group, sources[index]]);
    }
  }

  visit(0, []);
  return groups;
}

function getUniqueCells(cells) {
  const seen = new Set();
  const unique = [];

  for (const cell of cells) {
    const key = makeCellKey(cell);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(cell);
  }

  return unique;
}

function compareCellsByDistance(anchor, entityCell) {
  return (a, b) =>
    getManhattanDistance(a, anchor) - getManhattanDistance(b, anchor) ||
    getManhattanDistance(a, entityCell) - getManhattanDistance(b, entityCell) ||
    a.row - b.row ||
    a.col - b.col;
}

function isSameCell(a, b) {
  return a.row === b.row && a.col === b.col;
}

export function isEntityInProgressZone(entityCell, config) {
  return entityCell.row >= config.height - 3 && entityCell.row < config.height;
}

function hasUsefulMoveForEntity(board, config, entityCell) {
  for (let row = 0; row < config.height; row += 1) {
    for (let col = 0; col < config.width; col += 1) {
      const current = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const target of candidates) {
        if (target.row >= config.height || target.col >= config.width || !canSwapCells(board, current, target)) {
          continue;
        }

        const matches = findMatches(swapTiles(board, current, target), config);

        if (matches.cells.some((cell) => isUsefulEntityProgressCell(cell, config, entityCell))) {
          return true;
        }
      }
    }
  }

  return false;
}

function isUsefulEntityProgressCell(cell, config, entityCell) {
  return cell.row > entityCell.row && cell.col === entityCell.col && cell.row < config.height;
}

function getEntityCells(board, entityType) {
  const cells = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const tile = getCellTile(board[row][col]);

      if (tile?.entity === entityType) {
        cells.push({ row, col, key: tile.key });
      }
    }
  }

  return cells;
}

function getTerrainRowCounts(board, terrainType) {
  const counts = new Map();

  for (const cell of getTerrainCells(board, terrainType)) {
    counts.set(cell.row, (counts.get(cell.row) ?? 0) + 1);
  }

  return counts;
}

function getTerrainColumnCounts(board, terrainType) {
  const counts = new Map();

  for (const cell of getTerrainCells(board, terrainType)) {
    counts.set(cell.col, (counts.get(cell.col) ?? 0) + 1);
  }

  return counts;
}

function getOccupiedTerrainKeys(board) {
  const keys = new Set();

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col].terrain) {
        keys.add(makeCellKey({ row, col }));
      }
    }
  }

  return keys;
}

function getManhattanDistance(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function pushMatch(run, board, matched, groups) {
  if (run.length < 3) {
    return;
  }

  const cells = run.filter((cell) => getMatchableTile(board[cell.row]?.[cell.col]));

  for (const cell of cells) {
    matched.add(makeCellKey(cell));
  }

  groups.push({
    type: getMatchableTile(board[cells[0].row][cells[0].col]).type,
    cells,
  });
}

function makeCellKey(cell) {
  return `${cell.row}:${cell.col}`;
}

function getOrthogonalNeighbors(cell) {
  return [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ];
}

function isInsideBoard(cell, config) {
  return cell.row >= 0 && cell.row < config.height && cell.col >= 0 && cell.col < config.width;
}

function parseCellKey(key) {
  const [row, col] = key.split(':').map(Number);
  return { row, col };
}

function cloneBoard(board) {
  return board.map((row) =>
    row.map((cell) =>
      createCell(
        cell.tile ? { ...cell.tile } : null,
        cell.object ? { ...cell.object } : null,
        cell.terrain ? { ...cell.terrain } : null,
      ),
    ),
  );
}

function createCell(tile = null, object = null, terrain = null) {
  return {
    tile,
    object,
    terrain,
  };
}

function getCellTile(cell) {
  return cell?.tile ?? null;
}

function getMatchableTile(cell) {
  const tile = getCellTile(cell);
  return isMatchableTile(tile) ? tile : null;
}

function isMatchableTile(tile) {
  return Boolean(tile && tile.matchable !== false && !tile.entity);
}

function isSwappableTile(tile) {
  return Boolean(isMatchableTile(tile) && tile.swappable !== false);
}

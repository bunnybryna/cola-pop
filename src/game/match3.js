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

  return placeTerrain(boardWithObjects, config);
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
  return Boolean(getCellTile(board[a.row]?.[a.col]) && getCellTile(board[b.row]?.[b.col]));
}

export function findMatches(board, config) {
  const matched = new Set();
  const groups = [];

  for (let row = 0; row < config.height; row += 1) {
    let run = [{ row, col: 0 }];

    for (let col = 1; col <= config.width; col += 1) {
      const current = getCellTile(board[row][col]);
      const previous = getCellTile(board[row][col - 1]);

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
      const current = getCellTile(board[row]?.[col]);
      const previous = getCellTile(board[row - 1]?.[col]);

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

      if (!tile) {
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
        getCellTile(cell)
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

  const next = cloneBoard(board);
  const occupied = new Set();
  const placedCells = [];

  for (const objectConfig of objects) {
    let candidates = getObjectPlacementCandidates(config, objectConfig);
    let placedForObject = 0;

    for (let index = 0; index < objectConfig.count && candidates.length > 0; index += 1) {
      const validCandidates = candidates.filter(
        (cell) =>
          !occupied.has(makeCellKey(cell)) &&
          isFarEnoughFromPlacedObjects(cell, placedCells, config, objectConfig),
      );

      if (validCandidates.length === 0) {
        break;
      }

      candidates = validCandidates;
      const candidateIndex = Math.floor(Math.random() * candidates.length);
      const { row, col } = candidates.splice(candidateIndex, 1)[0];
      const placedCell = { row, col };
      occupied.add(makeCellKey(placedCell));
      placedCells.push(placedCell);

      next[row][col] = createCell(null, {
        key: crypto.randomUUID(),
        type: objectConfig.id,
        state: 'active',
      });
      placedForObject += 1;
    }

    if (placedForObject < objectConfig.count) {
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

  return (
    cell.row >= borderPadding &&
    cell.row <= config.height - borderPadding - 1 &&
    cell.col >= borderPadding &&
    cell.col <= config.width - borderPadding - 1
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
  return (config.terrain ?? []).every((terrainConfig) => {
    const requiredCleanable = terrainConfig.placement?.minImmediatelyCleanable ?? 0;

    if (requiredCleanable === 0) {
      return true;
    }

    return countImmediatelyCleanableTerrainCells(board, config, terrainConfig.id) >= requiredCleanable;
  });
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

  const cells = run.filter((cell) => getCellTile(board[cell.row]?.[cell.col]));

  for (const cell of cells) {
    matched.add(makeCellKey(cell));
  }

  groups.push({
    type: getCellTile(board[cells[0].row][cells[0].col]).type,
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

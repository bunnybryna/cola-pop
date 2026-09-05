export function makeInitialBoard(config, tileTypes) {
  let fallback;

  for (let attempts = 0; attempts < 200; attempts += 1) {
    const board = createBoardWithoutMatches(config, tileTypes);

    fallback = board;

    if (findMatches(board, config).cells.length === 0 && hasPossibleMove(board, config)) {
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

  return placeBoardObjects(board, config);
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

export function applyGravityAndRefill(board, config, tileTypes) {
  const next = board.map((row) => row.map((cell) => createCell(null, cell.object)));

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
          ? createCell(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], cell.object)
          : createCell(null, cell.object),
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

  for (const objectConfig of objects) {
    const candidates = getObjectPlacementCandidates(config, objectConfig).filter(
      (cell) => !occupied.has(makeCellKey(cell)),
    );

    for (let index = 0; index < objectConfig.count && candidates.length > 0; index += 1) {
      const candidateIndex = Math.floor(Math.random() * candidates.length);
      const { row, col } = candidates.splice(candidateIndex, 1)[0];
      occupied.add(makeCellKey({ row, col }));

      next[row][col] = createCell(null, {
        key: crypto.randomUUID(),
        type: objectConfig.id,
        state: 'active',
      });
    }
  }

  return next;
}

function makeBoardFromObjectLayout(sourceBoard, config, tileTypes) {
  let fallback;

  for (let attempts = 0; attempts < 200; attempts += 1) {
    const board = [];

    for (let row = 0; row < config.height; row += 1) {
      const boardRow = [];

      for (let col = 0; col < config.width; col += 1) {
        const object = sourceBoard[row]?.[col]?.object;

        if (object) {
          boardRow.push(createCell(null, { ...object }));
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

        boardRow.push(createCell(createRandomTile(tileTypes, blocked)));
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
  if (objectConfig.placement?.area === 'inner') {
    return cell.row > 0 && cell.row < config.height - 1 && cell.col > 0 && cell.col < config.width - 1;
  }

  return true;
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
      ),
    ),
  );
}

function createCell(tile = null, object = null) {
  return {
    tile,
    object,
  };
}

function getCellTile(cell) {
  return cell?.tile ?? null;
}

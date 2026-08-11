export function makeInitialBoard(config, tileTypes) {
  let board;
  let attempts = 0;

  do {
    board = createBoardWithoutMatches(config, tileTypes);
    attempts += 1;
  } while (!hasPossibleMove(board, config) && attempts < 100);

  return board;
}

export function createBoardWithoutMatches(config, tileTypes) {
  const board = [];

  for (let row = 0; row < config.height; row += 1) {
    const boardRow = [];

    for (let col = 0; col < config.width; col += 1) {
      const blocked = new Set();

      if (col >= 2 && boardRow[col - 1].type === boardRow[col - 2].type) {
        blocked.add(boardRow[col - 1].type);
      }

      if (row >= 2 && board[row - 1][col].type === board[row - 2][col].type) {
        blocked.add(board[row - 1][col].type);
      }

      boardRow.push(createRandomTile(tileTypes, blocked));
    }

    board.push(boardRow);
  }

  return board;
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
  const holding = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = holding;
  return next;
}

export function findMatches(board, config) {
  const matched = new Set();
  const groups = [];

  for (let row = 0; row < config.height; row += 1) {
    let run = [{ row, col: 0 }];

    for (let col = 1; col <= config.width; col += 1) {
      const current = board[row][col];
      const previous = board[row][col - 1];

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
      const current = board[row]?.[col];
      const previous = board[row - 1]?.[col];

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
    if (marked[cell.row]?.[cell.col]) {
      marked[cell.row][cell.col] = {
        ...marked[cell.row][cell.col],
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
    next[cell.row][cell.col] = null;
  }

  return next;
}

export function applyGravityAndRefill(board, config, tileTypes) {
  const next = Array.from({ length: config.height }, () => Array(config.width).fill(null));

  for (let col = 0; col < config.width; col += 1) {
    const existing = [];

    for (let row = config.height - 1; row >= 0; row -= 1) {
      if (board[row][col]) {
        existing.push({ ...board[row][col], state: 'falling' });
      }
    }

    for (let row = config.height - 1; row >= 0; row -= 1) {
      next[row][col] = existing.shift() ?? {
        ...createRandomTile(tileTypes),
        state: 'entering',
      };
    }
  }

  return next;
}

export function resetTileStates(board) {
  return board.map((row) =>
    row.map((tile) =>
      tile
        ? {
            ...tile,
            state: 'idle',
            matchPower: undefined,
          }
        : tile,
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
    for (const tile of row) {
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

    shuffled = Array.from({ length: config.height }, () =>
      Array.from({ length: config.width }, () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]),
    );

    attempts += 1;
  } while ((findMatches(shuffled, config).cells.length > 0 || !hasPossibleMove(shuffled, config)) && attempts < 100);

  if (!shuffled || !hasPossibleMove(shuffled, config)) {
    return makeInitialBoard(config, tileTypes);
  }

  return shuffled;
}

export function getCollection(matches, board) {
  const collected = new Map();

  for (const cell of matches.cells) {
    const tile = board[cell.row]?.[cell.col];
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

function pushMatch(run, board, matched, groups) {
  if (run.length < 3) {
    return;
  }

  const cells = run.filter((cell) => board[cell.row]?.[cell.col]);

  for (const cell of cells) {
    matched.add(makeCellKey(cell));
  }

  groups.push({
    type: board[cells[0].row][cells[0].col].type,
    cells,
  });
}

function makeCellKey(cell) {
  return `${cell.row}:${cell.col}`;
}

function parseCellKey(key) {
  const [row, col] = key.split(':').map(Number);
  return { row, col };
}

function cloneBoard(board) {
  return board.map((row) => row.map((tile) => (tile ? { ...tile } : tile)));
}

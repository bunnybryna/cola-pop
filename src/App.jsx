import { RotateCcw, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { playSound } from './audio/sounds.js';
import { LEVEL_CONFIG, TILE_TYPES } from './config/level.js';
import {
  applyGravityAndRefill,
  areAdjacent,
  clearCells,
  findMatches,
  getCollection,
  hasPossibleMove,
  makeInitialBoard,
  markCells,
  resetTileStates,
  reshuffleBoard,
  scoreMatches,
  swapTiles,
} from './game/match3.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createGame() {
  return {
    board: makeInitialBoard(LEVEL_CONFIG, TILE_TYPES),
    targetTiles: pickRandomTargetTiles(TILE_TYPES, LEVEL_CONFIG.objective.targetTileCount),
    moves: LEVEL_CONFIG.moveLimit,
    score: 0,
    collected: 0,
    status: 'playing',
    message: '',
  };
}

export default function App() {
  const [game, setGame] = useState(createGame);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [matchFeedback, setMatchFeedback] = useState(null);

  const tileLookup = useMemo(() => new Map(TILE_TYPES.map((tile) => [tile.id, tile])), []);
  const objectiveTiles = game.targetTiles.map((tileId) => tileLookup.get(tileId)).filter(Boolean);
  const objectiveTileSet = useMemo(() => new Set(game.targetTiles), [game.targetTiles]);
  const objectiveComplete = game.collected >= LEVEL_CONFIG.objective.targetCount;
  const progress = Math.min(100, (game.collected / LEVEL_CONFIG.objective.targetCount) * 100);

  async function handleTileClick(row, col) {
    if (busy || game.status !== 'playing') {
      return;
    }

    const target = { row, col };

    if (!selected) {
      setSelected(target);
      return;
    }

    if (selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }

    if (!areAdjacent(selected, target)) {
      setSelected(target);
      return;
    }

    await attemptSwap(selected, target);
  }

  async function attemptSwap(from, to) {
    setBusy(true);
    setSelected(null);

    const swapped = swapTiles(game.board, from, to);
    setGame((current) => ({ ...current, board: swapped }));
    await sleep(LEVEL_CONFIG.timing.swap);

    const matches = findMatches(swapped, LEVEL_CONFIG);

    if (matches.cells.length === 0) {
      playSound('invalid');
      setGame((current) => ({
        ...current,
        board: markCells(swapped, [from, to], 'invalid'),
      }));
      await sleep(LEVEL_CONFIG.timing.invalidSwap);
      setGame((current) => ({
        ...current,
        board: resetTileStates(swapTiles(swapped, from, to)),
      }));
      setBusy(false);
      return;
    }

    const nextMoves = game.moves - 1;
    const resolved = await resolveMatches(swapped, {
      moves: nextMoves,
      score: game.score,
      collected: game.collected,
    });

    const status = getStatus(resolved.collected, nextMoves);
    if (status === 'won') {
      playSound('victory');
    }
    setGame((current) => ({
      ...current,
      ...resolved,
      moves: nextMoves,
      status,
      message: getEndMessage(status),
    }));
    setBusy(false);
  }

  async function resolveMatches(startBoard, initialState) {
    let board = startBoard;
    let score = initialState.score;
    let collected = initialState.collected;
    let cascadeIndex = 0;

    while (true) {
      const matches = findMatches(board, LEVEL_CONFIG);

      if (matches.cells.length === 0) {
        break;
      }

      const collection = getCollection(matches, board);
      const targetCollectionCount = getTargetCollectionCount(collection, objectiveTileSet);
      collected += targetCollectionCount;
      score += scoreMatches(matches, LEVEL_CONFIG.scoring, cascadeIndex);
      const matchPower = getMatchPower(matches);
      const feedback = getMatchFeedback(matchPower, cascadeIndex);

      playSound(matchPower >= 4 || cascadeIndex > 0 ? 'special' : 'pop');
      if (targetCollectionCount > 0) {
        window.setTimeout(() => playSound('goal'), 110);
      }

      if (feedback) {
        setMatchFeedback({ ...feedback, key: `${Date.now()}-${cascadeIndex}` });
      }

      setGame((current) => ({
        ...current,
        board: markCells(board, matches.cells, 'clearing', { matchPower }),
        score,
        collected,
      }));
      await sleep(LEVEL_CONFIG.timing.clear);

      board = applyGravityAndRefill(clearCells(board, matches.cells), LEVEL_CONFIG, TILE_TYPES);
      playSound('fall');
      setGame((current) => ({ ...current, board, score, collected }));
      await sleep(LEVEL_CONFIG.timing.fall);

      board = resetTileStates(board);
      setGame((current) => ({ ...current, board, score, collected }));
      await sleep(LEVEL_CONFIG.timing.cascadePause);
      cascadeIndex += 1;
    }

    if (!hasPossibleMove(board, LEVEL_CONFIG)) {
      setNotice('Shuffled');
      board = reshuffleBoard(board, LEVEL_CONFIG, TILE_TYPES);
      setGame((current) => ({ ...current, board }));
      await sleep(LEVEL_CONFIG.timing.fall);
      setNotice('');
    }

    return {
      board: resetTileStates(board),
      score,
      collected,
    };
  }

  function restart() {
    setGame(createGame());
    setSelected(null);
    setBusy(false);
    setNotice('');
    setMatchFeedback(null);
  }

  return (
    <main className="game-shell">
      <section className="topbar" aria-label="Level status">
        <div>
          <p className="eyebrow">Level {LEVEL_CONFIG.level}</p>
          <h1 className="game-title" aria-label="COLA POP!">
            <span>COLA</span>
            <span className="pop-word">
              P<span className="paw-o" aria-hidden="true">
                <span className="paw-pad" />
                <span className="paw-toe toe-one" />
                <span className="paw-toe toe-two" />
                <span className="paw-toe toe-three" />
              </span>
              P!
            </span>
          </h1>
        </div>
        <button className="icon-button" type="button" onClick={restart} aria-label="Restart level" title="Restart">
          <RotateCcw size={22} />
        </button>
      </section>

      <section className="game-layout">
        <aside className="status-panel" aria-label="Moves and objective">
          <div className="stat-row">
            <span>Moves</span>
            <strong>{game.moves}</strong>
          </div>

          <div className="objective">
            <div className="objective-heading">
              <span>Goal</span>
            </div>
            <div className="goal-progress">
              <div className="goal-tiles" aria-label="Target Cola tiles">
                {objectiveTiles.map((tile) => (
                  <div className="goal-tile" key={tile.id}>
                    <img src={tile.image} alt={`${tile.label} Cola`} />
                  </div>
                ))}
              </div>
              <strong>
                {game.collected} / {LEVEL_CONFIG.objective.targetCount}
              </strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {notice && <div className="notice">{notice}</div>}
        </aside>

        <section className="board-wrap" aria-label="Cola Match board">
          <div className="board" style={{ '--board-size': LEVEL_CONFIG.width }}>
            {game.board.map((row, rowIndex) =>
              row.map((tile, colIndex) => {
                const meta = tileLookup.get(tile.type);
                const isSelected = selected?.row === rowIndex && selected?.col === colIndex;

                return (
                  <button
                    className={`tile ${isSelected ? 'selected' : ''} ${tile.state} ${
                      tile.matchPower ? `match-${tile.matchPower}` : ''
                    }`}
                    key={tile.key}
                    type="button"
                    onClick={() => handleTileClick(rowIndex, colIndex)}
                    style={{ '--tile-color': meta.color }}
                    aria-label={`${meta.label} tile at row ${rowIndex + 1}, column ${colIndex + 1}`}
                  >
                    <img src={meta.image} alt="" draggable="false" />
                    {tile.state === 'clearing' && (
                      <span className="paw-burst" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </section>
      </section>

      {game.status !== 'playing' && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="result-card">
            <Trophy size={42} aria-hidden="true" />
            <p className="eyebrow">{game.status === 'won' ? 'Sweet victory' : 'Try again'}</p>
            <h2 id="result-title">{game.message}</h2>
            <button className="primary-button" type="button" onClick={restart}>
              Play Again
            </button>
          </div>
        </div>
      )}

      {matchFeedback && (
        <div className={`match-callout ${matchFeedback.tone}`} key={matchFeedback.key} aria-live="polite">
          {matchFeedback.text}
        </div>
      )}

      <div className={`completion-spark ${objectiveComplete ? 'show' : ''}`}>Goal complete</div>
    </main>
  );
}

function getStatus(collected, moves) {
  if (collected >= LEVEL_CONFIG.objective.targetCount) {
    return 'won';
  }

  if (moves <= 0) {
    return 'lost';
  }

  return 'playing';
}

function pickRandomTargetTiles(tileTypes, count) {
  const pool = tileTypes.map((tile) => tile.id);
  const picked = [];

  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

function getMatchPower(matches) {
  return Math.max(...matches.groups.map((group) => group.cells.length), 3);
}

function getMatchFeedback(matchPower, cascadeIndex) {
  if (cascadeIndex >= 3) {
    return { text: 'WOOF-TASTIC!', tone: 'combo-max' };
  }

  if (cascadeIndex === 2) {
    return { text: 'COLA COMBO!', tone: 'combo' };
  }

  if (cascadeIndex === 1) {
    return { text: 'AGAIN!', tone: 'cascade' };
  }

  if (matchPower >= 5) {
    return { text: 'PAWSOME!', tone: 'pawsome' };
  }

  if (matchPower >= 4) {
    return { text: 'NICE!', tone: 'nice' };
  }

  return null;
}

function getTargetCollectionCount(collection, targetTiles) {
  let count = 0;

  for (const tileId of targetTiles) {
    count += collection.get(tileId) ?? 0;
  }

  return count;
}

function getEndMessage(status) {
  if (status === 'won') {
    return 'Cola is delighted';
  }

  if (status === 'lost') {
    return 'Almost had it';
  }

  return '';
}

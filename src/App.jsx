import { PawPrint, RotateCcw } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { playSound } from './audio/sounds.js';
import { LEVEL_CONFIG, MASCOT_STATES, TILE_TYPES } from './config/level.js';
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
  const [collectFlyers, setCollectFlyers] = useState([]);
  const [progressPulseKey, setProgressPulseKey] = useState(0);
  const [movesCallout, setMovesCallout] = useState(null);
  const [mascotReaction, setMascotReaction] = useState(null);
  const [victoryCelebration, setVictoryCelebration] = useState(false);
  const [pawTaps, setPawTaps] = useState([]);
  const tileRefs = useRef(new Map());
  const goalTargetRef = useRef(null);
  const mascotTimerRef = useRef(null);

  const tileLookup = useMemo(() => new Map(TILE_TYPES.map((tile) => [tile.id, tile])), []);
  const objectiveTiles = game.targetTiles.map((tileId) => tileLookup.get(tileId)).filter(Boolean);
  const objectiveTileSet = useMemo(() => new Set(game.targetTiles), [game.targetTiles]);
  const objectiveComplete = game.collected >= LEVEL_CONFIG.objective.targetCount;
  const mascotState = getMascotState(game, mascotReaction);
  const displayedCollected = Math.min(game.collected, LEVEL_CONFIG.objective.targetCount);
  const progress = Math.min(100, (displayedCollected / LEVEL_CONFIG.objective.targetCount) * 100);

  async function handleTileClick(row, col) {
    if (busy || game.status !== 'playing') {
      return;
    }

    const target = { row, col };
    launchPawTap(target);

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
    const nextMoves = game.moves - 1;
    if (nextMoves === 3) {
      setMovesCallout({ key: Date.now(), text: '3 MOVES LEFT!' });
    }

    if (matches.cells.length === 0) {
      playSound('invalid');
      reactMascot('invalidSwap', 900);
      setGame((current) => ({
        ...current,
        moves: nextMoves,
        board: markCells(swapped, [from, to], 'invalid'),
      }));
      await sleep(LEVEL_CONFIG.timing.invalidSwap);
      const status = getStatus(game.collected, nextMoves);
      setGame((current) => ({
        ...current,
        board: resetTileStates(swapTiles(swapped, from, to)),
        status,
        message: getEndMessage(status),
      }));
      setBusy(false);
      return;
    }

    const resolved = await resolveMatches(swapped, {
      moves: nextMoves,
      score: game.score,
      collected: game.collected,
    });

    const status = getStatus(resolved.collected, nextMoves);
    if (status === 'won') {
      playSound('victory');
      window.clearTimeout(mascotTimerRef.current);
      setMascotReaction(null);
      setVictoryCelebration(true);
      setGame((current) => ({
        ...current,
        ...resolved,
        moves: nextMoves,
        status: 'celebrating',
        message: getEndMessage(status),
      }));
      await sleep(LEVEL_CONFIG.timing.victoryPause);
      setGame((current) => ({
        ...current,
        status,
        message: getEndMessage(status),
      }));
      setBusy(false);
      return;
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
      const nextCollected = collected + targetCollectionCount;
      const targetCells = getTargetMatchedCells(matches, board, objectiveTileSet);
      score += scoreMatches(matches, LEVEL_CONFIG.scoring, cascadeIndex);
      const matchPower = getMatchPower(matches);
      const feedback = getMatchFeedback(matchPower, cascadeIndex);

      playSound(matchPower >= 4 || cascadeIndex > 0 ? 'special' : 'pop');
      reactMascot(matchPower >= 4 || cascadeIndex > 0 ? 'bigCombo' : 'goodMatch', matchPower >= 4 ? 1200 : 850);

      if (feedback) {
        setMatchFeedback({ ...feedback, key: `${Date.now()}-${cascadeIndex}` });
      }

      setGame((current) => ({
        ...current,
        board: markCells(board, matches.cells, 'clearing', { matchPower }),
        score,
      }));

      if (targetCollectionCount > 0) {
        launchCollectFlyers(targetCells, board);
        await sleep(LEVEL_CONFIG.timing.collectFly);
        collected = nextCollected;
        playSound('goal');
        setProgressPulseKey(Date.now());
        setGame((current) => ({ ...current, collected }));
        await sleep(Math.max(0, LEVEL_CONFIG.timing.clear - LEVEL_CONFIG.timing.collectFly));
      } else {
        await sleep(LEVEL_CONFIG.timing.clear);
      }

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
    setCollectFlyers([]);
    setProgressPulseKey(0);
    setMovesCallout(null);
    setMascotReaction(null);
    setVictoryCelebration(false);
    setPawTaps([]);
    window.clearTimeout(mascotTimerRef.current);
    tileRefs.current.clear();
  }

  function launchPawTap(cell) {
    const sourceRect = tileRefs.current.get(`${cell.row}:${cell.col}`)?.getBoundingClientRect();

    if (!sourceRect) {
      return;
    }

    const tap = {
      id: `${Date.now()}-${cell.row}-${cell.col}`,
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top + sourceRect.height / 2,
    };

    setPawTaps((current) => [...current.slice(-5), tap]);
    window.setTimeout(() => {
      setPawTaps((current) => current.filter((item) => item.id !== tap.id));
    }, 920);
  }

  function reactMascot(reaction, duration) {
    window.clearTimeout(mascotTimerRef.current);
    setMascotReaction(reaction);
    mascotTimerRef.current = window.setTimeout(() => setMascotReaction(null), duration);
  }

  function launchCollectFlyers(cells, boardSnapshot) {
    const targetRect = goalTargetRef.current?.getBoundingClientRect();

    if (!targetRect) {
      return;
    }

    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const flyers = cells
      .map((cell, index) => {
        const sourceRect = tileRefs.current.get(`${cell.row}:${cell.col}`)?.getBoundingClientRect();
        const tile = boardSnapshot[cell.row]?.[cell.col];
        const meta = tileLookup.get(tile?.type);

        if (!sourceRect || !meta) {
          return null;
        }

        const fromX = sourceRect.left + sourceRect.width / 2;
        const fromY = sourceRect.top + sourceRect.height / 2;

        return {
          id: `${tile.key}-fly-${index}`,
          image: meta.image,
          label: meta.label,
          fromX,
          fromY,
          dx: targetX - fromX,
          dy: targetY - fromY,
          delay: Math.min(index * 45, 180),
        };
      })
      .filter(Boolean);

    setCollectFlyers(flyers);
    window.setTimeout(() => setCollectFlyers([]), LEVEL_CONFIG.timing.collectFly + 180);
  }

  return (
    <main className="game-shell">
      <section className="topbar" aria-label="Level status">
        <div className="brand-lockup">
          <div>
          <p className="eyebrow">Level {LEVEL_CONFIG.level}</p>
          <h1 className="game-title" aria-label="COLA POP!">
            <span className="cola-word">
              <span>C</span>
              <span>O</span>
              <span>L</span>
              <span>A</span>
            </span>
            <span className="pop-word">
              <span>P</span>
              <span className="paw-o" aria-hidden="true">
                <span className="paw-pad" />
                <span className="paw-toe toe-one" />
                <span className="paw-toe toe-two" />
                <span className="paw-toe toe-three" />
              </span>
              <span>P</span>
              <span>!</span>
            </span>
          </h1>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={restart} aria-label="Restart level" title="Restart">
          <RotateCcw size={22} />
        </button>
      </section>

      <section className="game-layout">
        <aside className="status-panel" aria-label="Moves and objective">
          <div className={`stat-row moves-card ${getMovesTone(game.moves)}`} key={`moves-${game.moves}`}>
            <span className="panel-label">
              <PawPrint size={16} aria-hidden="true" />
              Moves
            </span>
            <strong>{game.moves}</strong>
          </div>

          <div className="objective">
            <div className="objective-heading">
              <span className="panel-label">
                <PawPrint size={16} aria-hidden="true" />
                Cola's Favorites
              </span>
            </div>
            <div className="goal-progress" ref={goalTargetRef}>
              <div className="goal-tiles" aria-label="Target Cola tiles">
                {objectiveTiles.map((tile) => (
                  <div className="goal-tile" key={tile.id}>
                    <img src={tile.image} alt={`${tile.label} Cola`} />
                  </div>
                ))}
              </div>
              <strong>
                {displayedCollected} / {LEVEL_CONFIG.objective.targetCount}
                {objectiveComplete && (
                  <span className="goal-check" aria-label="complete">
                    ✓
                  </span>
                )}
              </strong>
            </div>
            <div className={`progress-track ${progressPulseKey ? 'pulse' : ''}`} key={progressPulseKey} aria-hidden="true">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mascot-panel" aria-live="polite">
            <div className={`mascot mascot-${mascotState.key}`} key={mascotState.key}>
              <img src={mascotState.image} alt={mascotState.label} />
            </div>
          </div>

          {notice && <div className="notice">{notice}</div>}
        </aside>

        <section className={`board-wrap ${victoryCelebration ? 'victory-board' : ''}`} aria-label="Cola Match board">
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
                    ref={(node) => {
                      const cellKey = `${rowIndex}:${colIndex}`;
                      if (node) {
                        tileRefs.current.set(cellKey, node);
                      } else {
                        tileRefs.current.delete(cellKey);
                      }
                    }}
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

      {(game.status === 'won' || game.status === 'lost') && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
          {game.status === 'won' ? (
            <div className="result-card victory-card">
              <p className="victory-kicker" aria-hidden="true">
                🎉
              </p>
              <h2 id="result-title">PAWSOME!</h2>
              <p>Cola is very happy!</p>
              <img className="victory-mascot" src={MASCOT_STATES.victory.image} alt={MASCOT_STATES.victory.label} />
              <p>You completed Level {LEVEL_CONFIG.level}</p>
              <p className="moves-left">Moves left: {game.moves}</p>
              <button className="primary-button" type="button" onClick={restart}>
                Play Again
              </button>
            </div>
          ) : (
            <div className="result-card lose-card">
              <PawPrint size={34} aria-hidden="true" />
              <h2 id="result-title">SO CLOSE!</h2>
              <p>Cola wants to try again.</p>
              <img
                className="lose-mascot"
                src="/assets/tiles/sleepy.png"
                alt="Sleepy Cola"
              />
              <p className="collected-summary">
                {displayedCollected} / {LEVEL_CONFIG.objective.targetCount} collected
              </p>
              <button className="primary-button" type="button" onClick={restart}>
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {victoryCelebration && <VictoryBurst />}

      {matchFeedback && (
        <div className={`match-callout ${matchFeedback.tone}`} key={matchFeedback.key} aria-live="polite">
          {matchFeedback.text}
        </div>
      )}

      {movesCallout && (
        <div className="moves-callout" key={movesCallout.key} aria-live="polite">
          {movesCallout.text}
        </div>
      )}

      {collectFlyers.map((flyer) => (
        <img
          className="collect-flyer"
          key={flyer.id}
          src={flyer.image}
          alt=""
          style={{
            left: `${flyer.fromX}px`,
            top: `${flyer.fromY}px`,
            '--fly-x': `${flyer.dx}px`,
            '--fly-y': `${flyer.dy}px`,
            '--fly-mid-x': `${flyer.dx * 0.88}px`,
            '--fly-mid-y': `${flyer.dy * 0.88 - 20}px`,
            animationDelay: `${flyer.delay}ms`,
          }}
        />
      ))}

      {pawTaps.map((tap) => (
        <span
          className="paw-tap"
          key={tap.id}
          aria-hidden="true"
          style={{
            left: `${tap.x}px`,
            top: `${tap.y}px`,
          }}
        />
      ))}

      <div className={`completion-spark ${objectiveComplete ? 'show' : ''}`}>Goal complete</div>
    </main>
  );
}

function VictoryBurst() {
  return (
    <div className="victory-burst" aria-hidden="true">
      {Array.from({ length: 24 }, (_, index) => (
        <span
          className={index % 3 === 0 ? 'victory-paw' : 'victory-confetti'}
          key={index}
          style={{
            '--x': `${8 + ((index * 37) % 86)}vw`,
            '--delay': `${(index % 8) * 95}ms`,
            '--drift': `${index % 2 === 0 ? -18 : 18}px`,
            '--spin': `${index % 2 === 0 ? -18 : 18}deg`,
          }}
        />
      ))}
    </div>
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

function getMovesTone(moves) {
  if (moves <= 1) {
    return 'moves-critical';
  }

  if (moves <= 12) {
    return 'moves-low';
  }

  return '';
}

function getMascotState(game, reaction) {
  if (game.status === 'won' || game.status === 'celebrating') {
    return { key: 'victory', ...MASCOT_STATES.victory };
  }

  if (reaction) {
    return { key: reaction, ...MASCOT_STATES[reaction] };
  }

  if (isAlmostWinning(game.collected)) {
    return { key: 'almostWinning', ...MASCOT_STATES.almostWinning };
  }

  return { key: 'default', ...MASCOT_STATES.default };
}

function isAlmostWinning(collected) {
  return collected >= Math.ceil(LEVEL_CONFIG.objective.targetCount * 0.75);
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

function getTargetMatchedCells(matches, board, targetTiles) {
  return matches.cells.filter((cell) => {
    const tile = board[cell.row]?.[cell.col];
    return tile && targetTiles.has(tile.type);
  });
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

import { PawPrint, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playPrimarySound, playSound, stopPrimarySounds } from './audio/sounds.js';
import { LEVELS, MASCOT_STATES, TILE_TYPES } from './config/level.js';
import { getPrimaryReward } from './game/rewards.js';
import {
  applyGravityAndRefill,
  areAdjacent,
  canSwapCells,
  clearCells,
  clearObjects,
  clearTerrain,
  countEntities,
  findAdjacentObjects,
  findMatchedTerrain,
  findMatches,
  getEntityPositions,
  hasUsefulMoveForEntityProgress,
  getCollection,
  getBottomEntityCollectionStep,
  getNextEntityStallCounts,
  getTerrainPositions,
  hasUsefulMoveForTerrainClean,
  hasPossibleMove,
  isEntityInProgressZone,
  makeInitialBoard,
  markCells,
  markObjects,
  markTileEntities,
  markTerrain,
  resetTileStates,
  repairStuckEntityProgress,
  repairStuckTerrainClean,
  reshuffleBoard,
  scoreMatches,
  spawnGravityEntity,
  swapTiles,
} from './game/match3.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createGame(levelConfig) {
  return {
    board: makeInitialBoard(levelConfig, TILE_TYPES),
    targetTiles:
      levelConfig.goalType === 'collectTiles'
        ? pickRandomTargetTiles(TILE_TYPES, levelConfig.objective.targetTileCount)
        : [],
    moves: levelConfig.moveLimit,
    score: 0,
    collected: 0,
    spawnedEntities: getInitialSpawnedEntityCount(levelConfig),
    stalledEntityMoves: {},
    assistedShuffleUsed: false,
    mudStallMoves: 0,
    mudRepairUsed: false,
    status: 'playing',
    message: '',
  };
}

export default function App() {
  const [activeLevelIndex, setActiveLevelIndex] = useState(0);
  const levelConfig = LEVELS[activeLevelIndex] ?? LEVELS[0];
  const [game, setGame] = useState(() => createGame(LEVELS[0]));
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [matchFeedback, setMatchFeedback] = useState(null);
  const [shuffleFeedback, setShuffleFeedback] = useState(null);
  const [ballEntranceFeedback, setBallEntranceFeedback] = useState(null);
  const [collectFlyers, setCollectFlyers] = useState([]);
  const [progressPulseKey, setProgressPulseKey] = useState(0);
  const [movesCallout, setMovesCallout] = useState(null);
  const [mascotReaction, setMascotReaction] = useState(null);
  const [victoryCelebration, setVictoryCelebration] = useState(false);
  const tileRefs = useRef(new Map());
  const goalTargetRef = useRef(null);
  const mascotTimerRef = useRef(null);
  const matchFeedbackTimerRef = useRef(null);
  const shuffleFeedbackTimerRef = useRef(null);
  const ballEntranceTimerRef = useRef(null);
  const movesCalloutTimerRef = useRef(null);
  const collectFlyersTimerRef = useRef(null);
  const primaryRewardTokenRef = useRef(0);
  const inputLockedRef = useRef(false);

  const tileLookup = useMemo(() => new Map(TILE_TYPES.map((tile) => [tile.id, tile])), []);
  const objectLookup = useMemo(
    () => new Map((levelConfig.boardObjects ?? []).map((object) => [object.id, object])),
    [levelConfig],
  );
  const isTreatGoal = levelConfig.goalType === 'collectTreats';
  const isMudGoal = levelConfig.goalType === 'clearMud';
  const isDropGoal = levelConfig.goalType === 'dropEntities';
  const objectiveObject = isTreatGoal ? objectLookup.get(levelConfig.objective.treatType) : null;
  const objectiveTerrain = isMudGoal
    ? (levelConfig.terrain ?? []).find((terrain) => terrain.id === levelConfig.objective.terrainType)
    : null;
  const objectiveEntity = isDropGoal ? levelConfig.objective.asset : null;
  const objectiveTiles = game.targetTiles.map((tileId) => tileLookup.get(tileId)).filter(Boolean);
  const objectiveTileSet = useMemo(() => new Set(game.targetTiles), [game.targetTiles]);
  const objectiveTarget = getObjectiveTarget(levelConfig);
  const objectiveNoun = getObjectiveNoun(levelConfig);
  const objectiveVerb = getObjectiveVerb(levelConfig);
  const objectiveComplete = game.collected >= objectiveTarget;
  const resultArtwork = getResultArtwork(levelConfig, game.status);
  const mascotState = getMascotState(game, mascotReaction, levelConfig);
  const displayedCollected = Math.min(game.collected, objectiveTarget);
  const progress = Math.min(100, (displayedCollected / objectiveTarget) * 100);
  const hasNextLevel = activeLevelIndex < LEVELS.length - 1;
  const storyPrompt =
    levelConfig.goalType === 'collectTiles' ? (
      <>
        {levelConfig.story.prompt} <strong>{objectiveTarget}</strong>.
      </>
    ) : levelConfig.goalType === 'clearMud' ? (
      <>
        Match <strong>on muddy spots</strong> to clean them.
      </>
    ) : (
      levelConfig.story.prompt
    );

  useEffect(() => {
    return () => {
      window.clearTimeout(matchFeedbackTimerRef.current);
      window.clearTimeout(shuffleFeedbackTimerRef.current);
      window.clearTimeout(ballEntranceTimerRef.current);
      window.clearTimeout(movesCalloutTimerRef.current);
      window.clearTimeout(collectFlyersTimerRef.current);
      window.clearTimeout(mascotTimerRef.current);
      stopPrimarySounds();
    };
  }, []);

  async function handleTileClick(row, col) {
    if (inputLockedRef.current || busy || game.status !== 'playing') {
      return;
    }

    if (await maybeApplyPreMoveEmergencyShuffle()) {
      return;
    }

    const target = { row, col };

    if (!canSwapCells(game.board, target, target)) {
      return;
    }

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

  async function maybeApplyPreMoveEmergencyShuffle() {
    if (!isDropGoal || game.moves > 2 || game.assistedShuffleUsed) {
      return false;
    }

    inputLockedRef.current = true;
    setBusy(true);
    setSelected(null);

    const resolved = await maybeApplyAssistedShuffle(
      {
        board: game.board,
        score: game.score,
        collected: game.collected,
        spawnedEntities: game.spawnedEntities,
        stalledEntityMoves: game.stalledEntityMoves,
        assistedShuffleUsed: game.assistedShuffleUsed,
      },
      game.moves,
      { forceEmergency: true, previousBoard: game.board },
    );
    const didShuffle = resolved.assistedShuffleUsed && !game.assistedShuffleUsed;

    inputLockedRef.current = false;
    setBusy(false);
    return didShuffle;
  }

  async function attemptSwap(from, to) {
    if (inputLockedRef.current) {
      return;
    }

    inputLockedRef.current = true;
    setBusy(true);
    setSelected(null);

    const swapped = swapTiles(game.board, from, to);
    setGame((current) => ({ ...current, board: swapped }));
    await sleep(levelConfig.timing.swap);

    const matches = findMatches(swapped, levelConfig);
    const nextMoves = game.moves - 1;

    if (matches.cells.length === 0) {
      playSound('invalid');
      reactMascot('invalidSwap', 900);
      setGame((current) => ({
        ...current,
        board: markCells(swapped, [from, to], 'invalid'),
      }));
      await sleep(levelConfig.timing.invalidSwap);
      setGame((current) => ({
        ...current,
        board: resetTileStates(swapTiles(swapped, from, to)),
      }));
      inputLockedRef.current = false;
      setBusy(false);
      return;
    }

    clearPrimaryRewardFeedback();
    stopPrimarySounds();

    if (nextMoves === 3) {
      showMovesCallout('3 MOVES LEFT!');
    }

    let resolved = await resolveMatches(swapped, {
      moves: nextMoves,
      score: game.score,
      collected: game.collected,
      spawnedEntities: game.spawnedEntities,
    });
    const spawnedBeforeTimedDrop = resolved.spawnedEntities;
    resolved = spawnTimedDropEntityIfNeeded(resolved, nextMoves);
    if ((resolved.spawnedEntities ?? 0) > (spawnedBeforeTimedDrop ?? 0)) {
      showBallEntranceFeedback();
    }

    const status = getStatus(resolved.collected, nextMoves, levelConfig);
    if (status === 'won') {
      playPrimarySound('victory');
      window.clearTimeout(mascotTimerRef.current);
      setMascotReaction(null);
      clearTransientFeedback();
      setVictoryCelebration(true);
      setGame((current) => ({
        ...current,
        ...resolved,
        moves: nextMoves,
        status,
        message: getEndMessage(status),
      }));
      await playVictoryBarks(levelConfig);
      inputLockedRef.current = false;
      setBusy(false);
      return;
    }
    if (status === 'lost') {
      playSound('wah-wah-sad');
      setGame((current) => ({
        ...current,
        ...resolved,
        moves: nextMoves,
        status,
        message: getEndMessage(status),
      }));
      setBusy(false);
      return;
    }
    resolved = await maybeApplyAssistedShuffle(resolved, nextMoves);
    setGame((current) => ({
      ...current,
      ...resolved,
      moves: nextMoves,
      status,
      message: getEndMessage(status),
    }));
    inputLockedRef.current = false;
    setBusy(false);
  }

  async function resolveMatches(startBoard, initialState) {
    let board = startBoard;
    let score = initialState.score;
    let collected = initialState.collected;
    let spawnedEntities = initialState.spawnedEntities ?? getInitialSpawnedEntityCount(levelConfig);
    let mudCleanedThisMove = false;
    let cascadeIndex = 0;

    while (true) {
      const matches = findMatches(board, levelConfig);

      if (matches.cells.length === 0) {
        break;
      }

      const collection = getCollection(matches, board);
      const treatCells =
        isTreatGoal
          ? findAdjacentObjects(matches, board, levelConfig, levelConfig.objective.treatType)
          : [];
      const mudCells = isMudGoal ? findMatchedTerrain(matches, board, levelConfig.objective.terrainType) : [];
      const targetCollectionCount =
        isTreatGoal
          ? treatCells.length
          : isMudGoal
            ? mudCells.length
            : getTargetCollectionCount(collection, objectiveTileSet);
      mudCleanedThisMove = mudCleanedThisMove || (isMudGoal && targetCollectionCount > 0);
      const nextCollected = collected + targetCollectionCount;
      const completesObjective = nextCollected >= objectiveTarget;
      if (completesObjective && targetCollectionCount > 0) {
        lockTerminalObjectiveResolution();
      }
      const targetCells =
        isTreatGoal
          ? treatCells
          : isMudGoal
            ? mudCells
            : getTargetMatchedCells(matches, board, objectiveTileSet);
      score += scoreMatches(matches, levelConfig.scoring, cascadeIndex);
      const matchPower = getMatchPower(matches);
      const reward = getPrimaryReward({
        cascadeIndex,
        matchPower,
        objectiveCount: targetCollectionCount,
        isTreatGoal,
        isMudGoal,
        completesObjective,
      });

      if (isTreatGoal) {
        if (targetCollectionCount > 1 || (targetCollectionCount > 0 && cascadeIndex > 0)) {
          reactMascot('bigCombo', 1200);
        } else if (targetCollectionCount === 1) {
          reactMascot('almostWinning', 1050);
        }
      } else if (isMudGoal) {
        if (nextCollected >= objectiveTarget) {
          reactMascot('victory', levelConfig.timing.victoryPause);
        } else if (nextCollected >= objectiveTarget - 1 && targetCollectionCount > 0) {
          reactMascot('almostWinning', 1200);
        } else if (targetCollectionCount > 1 || (targetCollectionCount > 0 && cascadeIndex > 0)) {
          reactMascot('bigCombo', 1200);
        } else if (targetCollectionCount === 1) {
          reactMascot('goodMatch', 900);
        }
      } else {
        reactMascot(matchPower >= 4 || cascadeIndex > 0 ? 'bigCombo' : 'goodMatch', matchPower >= 4 ? 1200 : 850);
      }

      if (reward.feedback) {
        showMatchFeedback({ ...reward.feedback, key: `${Date.now()}-${cascadeIndex}` });
      }

      if (reward.sound) {
        playPrimarySound(reward.sound);
      }

      const markedBoard = markCells(
        getMarkedObjectiveBoard(board, {
          isTreatGoal,
          isMudGoal,
          targetCollectionCount,
          treatCells,
          mudCells,
        }),
        matches.cells,
        'clearing',
        { matchPower },
      );

      setGame((current) => ({
        ...current,
        board: markedBoard,
        score,
      }));

      if (targetCollectionCount > 0) {
        if (isTreatGoal) {
          await sleep(180);
        }

        launchCollectFlyers(targetCells, board, { kind: isMudGoal ? 'mud-clean' : 'collectible' });

        await sleep(isMudGoal ? Math.min(420, levelConfig.timing.clear) : levelConfig.timing.collectFly);
        collected = nextCollected;
        setProgressPulseKey(Date.now());
        setGame((current) => ({ ...current, collected }));
        await sleep(isMudGoal ? 80 : Math.max(0, levelConfig.timing.clear - levelConfig.timing.collectFly));
      } else {
        await sleep(levelConfig.timing.clear);
      }

      const clearedBoard = clearCells(
        getClearedObjectiveBoard(board, {
          isTreatGoal,
          isMudGoal,
          treatCells,
          mudCells,
        }),
        matches.cells,
      );
      board = applyGravityAndRefill(clearedBoard, levelConfig, TILE_TYPES);
      if (!reward.suppressFall) {
        playSound('fall');
      }
      setGame((current) => ({ ...current, board, score, collected }));
      await sleep(levelConfig.timing.fall);

      if (isDropGoal) {
        let collectionStep = getBottomEntityCollectionStep(board, levelConfig, TILE_TYPES, levelConfig.objective.entityType, {
          targetCount: objectiveTarget,
          collected,
          spawnedEntities,
        });

        while (collectionStep) {
          const entityCells = collectionStep.cells;
          const completesDropObjective = collected + entityCells.length >= objectiveTarget;
          if (!completesDropObjective) {
            showMatchFeedback({ text: 'FETCH!', tone: 'nice', key: `${Date.now()}-${cascadeIndex}-fetch` });
            playPrimarySound('goal');
          }
          reactMascot(collected + entityCells.length >= objectiveTarget ? 'victory' : 'goodMatch', 950);

          const collectingBoard = markTileEntities(board, entityCells, 'collecting');
          setGame((current) => ({ ...current, board: collectingBoard, score, collected }));
          await sleep(220);
          launchCollectFlyers(entityCells, board, { kind: 'entity', entityMeta: objectiveEntity });
          await sleep(levelConfig.timing.collectFly);

          collected = collectionStep.collected;
          if (collected >= objectiveTarget) {
            lockTerminalObjectiveResolution();
          }
          setProgressPulseKey(Date.now());
          const spawnedDuringCollection = collectionStep.spawnedEntities > spawnedEntities;
          board = collectionStep.board;
          spawnedEntities = collectionStep.spawnedEntities;
          if (spawnedDuringCollection) {
            showBallEntranceFeedback();
          }

          setGame((current) => ({ ...current, board, score, collected, spawnedEntities }));
          await sleep(levelConfig.timing.fall);

          collectionStep = getBottomEntityCollectionStep(board, levelConfig, TILE_TYPES, levelConfig.objective.entityType, {
            targetCount: objectiveTarget,
            collected,
            spawnedEntities,
          });
        }
      }

      board = resetTileStates(board);
      setGame((current) => ({ ...current, board, score, collected, spawnedEntities }));
      await sleep(levelConfig.timing.cascadePause);
      cascadeIndex += 1;
    }

    if (!hasPossibleMove(board, levelConfig)) {
      setNotice('Shuffled');
      board = reshuffleBoard(board, levelConfig, TILE_TYPES);
      setGame((current) => ({ ...current, board }));
      await sleep(levelConfig.timing.fall);
      setNotice('');
    }

    const mudAssist = await maybeApplyMudAssistedRepair(board, collected, mudCleanedThisMove);
    board = mudAssist.board;

    return {
      board: resetTileStates(board),
      score,
      collected,
      spawnedEntities,
      mudStallMoves: mudAssist.mudStallMoves,
      mudRepairUsed: mudAssist.mudRepairUsed,
    };
  }

  function spawnTimedDropEntityIfNeeded(resolvedState, nextMoves) {
    if (!isDropGoal) {
      return resolvedState;
    }

    const spawnAfterMovesUsed = levelConfig.objective.spawnAfterMovesUsed;

    if (!spawnAfterMovesUsed) {
      return resolvedState;
    }

    const movesUsed = levelConfig.moveLimit - nextMoves;
    const spawnedEntities = resolvedState.spawnedEntities ?? getInitialSpawnedEntityCount(levelConfig);

    if (
      movesUsed < spawnAfterMovesUsed ||
      resolvedState.collected >= objectiveTarget ||
      spawnedEntities >= objectiveTarget
    ) {
      return resolvedState;
    }

    const activeEntities = countEntities(resolvedState.board, levelConfig.objective.entityType);

    if (activeEntities >= objectiveTarget - resolvedState.collected) {
      return resolvedState;
    }

    const boardWithTimedSpawn = spawnGravityEntity(resolvedState.board, levelConfig, levelConfig.objective.entityType);

    if (boardWithTimedSpawn === resolvedState.board) {
      return resolvedState;
    }

    return {
      ...resolvedState,
      board: boardWithTimedSpawn,
      spawnedEntities: spawnedEntities + 1,
    };
  }

  async function maybeApplyMudAssistedRepair(board, collected, mudCleanedThisMove) {
    const currentMudStallMoves = game.mudStallMoves ?? 0;
    const currentMudRepairUsed = Boolean(game.mudRepairUsed);

    if (!isMudGoal) {
      return {
        board,
        mudStallMoves: 0,
        mudRepairUsed: currentMudRepairUsed,
      };
    }

    if (mudCleanedThisMove) {
      return {
        board,
        mudStallMoves: 0,
        mudRepairUsed: currentMudRepairUsed,
      };
    }

    const remainingMud = getTerrainPositions(board, levelConfig.objective.terrainType).length;

    if (remainingMud < 1 || remainingMud > 2) {
      return {
        board,
        mudStallMoves: 0,
        mudRepairUsed: currentMudRepairUsed,
      };
    }

    const nextMudStallMoves = Math.min(2, currentMudStallMoves + 1);

    if (
      nextMudStallMoves < 2 ||
      currentMudRepairUsed ||
      hasUsefulMoveForTerrainClean(board, levelConfig, levelConfig.objective.terrainType)
    ) {
      return {
        board,
        mudStallMoves: nextMudStallMoves,
        mudRepairUsed: currentMudRepairUsed,
      };
    }

    const repaired = repairStuckTerrainClean(board, levelConfig, levelConfig.objective.terrainType);

    if (!repaired.board) {
      console.warn(`Level 3 mud assist skipped: ${repaired.reason ?? 'unverified repair'}`);
      return {
        board,
        mudStallMoves: nextMudStallMoves,
        mudRepairUsed: false,
      };
    }

    showShuffleFeedback({
      key: Date.now(),
      title: 'PAW-SHUFFLE! 🐾',
      message: 'Cola mixed things up! Try a new match.',
    });
    setGame((current) => ({
      ...current,
      board: repaired.board,
      collected,
      mudStallMoves: 0,
      mudRepairUsed: true,
    }));
    await sleep(620);

    return {
      board: resetTileStates(repaired.board),
      mudStallMoves: 0,
      mudRepairUsed: true,
    };
  }

  async function maybeApplyAssistedShuffle(resolvedState, nextMoves, options = {}) {
    if (!isDropGoal || game.assistedShuffleUsed) {
      return {
        ...resolvedState,
        stalledEntityMoves: {},
        assistedShuffleUsed: game.assistedShuffleUsed,
      };
    }

    const entityType = levelConfig.objective.entityType;
    const previousBoard = options.previousBoard ?? game.board;
    const progressedEntityKeys = getProgressedEntityKeys(previousBoard, resolvedState.board, entityType);
    const currentEntities = getEntityPositions(resolvedState.board, entityType);
    const stalledEntityMoves = getNextEntityStallCounts({
      entities: currentEntities,
      progressedEntityKeys,
      previousStalledMoves: game.stalledEntityMoves,
      config: levelConfig,
    });
    const shouldEmergencyCheck = options.forceEmergency || nextMoves <= 2;
    const targetEntity = currentEntities
      .filter(
        (cell) =>
          isEntityInProgressZone(cell, levelConfig) &&
          (shouldEmergencyCheck || (stalledEntityMoves[cell.key] ?? 0) >= 3) &&
          !hasUsefulMoveForEntityProgress(resolvedState.board, levelConfig, entityType, cell.key),
      )
      .sort((a, b) => b.row - a.row || (stalledEntityMoves[b.key] ?? 0) - (stalledEntityMoves[a.key] ?? 0))[0];

    if (!targetEntity) {
      return {
        ...resolvedState,
        stalledEntityMoves,
        assistedShuffleUsed: false,
      };
    }

    const assistedShuffle = repairStuckEntityProgress(resolvedState.board, levelConfig, entityType, {
      targetEntityKey: targetEntity.key,
    });

    if (!assistedShuffle.board) {
      console.warn(`Level 4 assisted reshuffle skipped: ${assistedShuffle.reason ?? 'unverified repair'}`);
      return {
        ...resolvedState,
        stalledEntityMoves,
        assistedShuffleUsed: false,
      };
    }

    showShuffleFeedback({
      key: Date.now(),
      title: 'PAW-SHUFFLE! 🐾',
      message: 'Cola mixed things up! Try a new match.',
    });
    playSound('paw-shuffle');
    setGame((current) => ({
      ...current,
      ...resolvedState,
      board: assistedShuffle.board,
      stalledEntityMoves: {},
      assistedShuffleUsed: true,
    }));
    await sleep(620);

    return {
      ...resolvedState,
      board: resetTileStates(assistedShuffle.board),
      stalledEntityMoves: {},
      assistedShuffleUsed: true,
    };
  }

  function showMatchFeedback(feedback, duration = 1650) {
    const token = primaryRewardTokenRef.current + 1;
    primaryRewardTokenRef.current = token;
    window.clearTimeout(matchFeedbackTimerRef.current);
    setMatchFeedback(feedback);
    matchFeedbackTimerRef.current = window.setTimeout(() => {
      if (primaryRewardTokenRef.current === token) {
        setMatchFeedback(null);
      }
    }, duration);
  }

  function clearPrimaryRewardFeedback() {
    primaryRewardTokenRef.current += 1;
    window.clearTimeout(matchFeedbackTimerRef.current);
    setMatchFeedback(null);
  }

  function showMovesCallout(text) {
    window.clearTimeout(movesCalloutTimerRef.current);
    setMovesCallout({ key: Date.now(), text });
    movesCalloutTimerRef.current = window.setTimeout(() => setMovesCallout(null), 1850);
  }

  function showShuffleFeedback(feedback) {
    window.clearTimeout(shuffleFeedbackTimerRef.current);
    setShuffleFeedback(feedback);
    shuffleFeedbackTimerRef.current = window.setTimeout(() => setShuffleFeedback(null), 3000);
  }

  function showBallEntranceFeedback() {
    window.clearTimeout(ballEntranceTimerRef.current);
    setBallEntranceFeedback({ key: Date.now(), text: 'NEW BALL! 🎾' });
    ballEntranceTimerRef.current = window.setTimeout(() => setBallEntranceFeedback(null), 1300);
  }

  function clearTransientFeedback() {
    clearPrimaryRewardFeedback();
    window.clearTimeout(shuffleFeedbackTimerRef.current);
    window.clearTimeout(ballEntranceTimerRef.current);
    window.clearTimeout(movesCalloutTimerRef.current);
    window.clearTimeout(collectFlyersTimerRef.current);
    setShuffleFeedback(null);
    setBallEntranceFeedback(null);
    setMovesCallout(null);
    setCollectFlyers([]);
  }

  async function playVictoryBarks(config) {
    const timing = config.timing.victoryBarks ?? { firstDelay: 900, secondDelay: 520 };

    await sleep(timing.firstDelay);
    playSound('bark-happy');
    await sleep(timing.secondDelay);
    playSound('bark-happy');
  }

  function lockTerminalObjectiveResolution() {
    inputLockedRef.current = true;
    setGame((current) => ({
      ...current,
      status: current.status === 'playing' ? 'resolving' : current.status,
    }));
  }

  function restart() {
    startLevel(activeLevelIndex);
  }

  function startNextLevel() {
    if (!hasNextLevel) {
      return;
    }

    startLevel(activeLevelIndex + 1);
  }

  function startLevel(levelIndex) {
    const nextLevel = LEVELS[levelIndex] ?? LEVELS[0];
    stopPrimarySounds();
    inputLockedRef.current = false;
    setActiveLevelIndex(levelIndex);
    setGame(createGame(nextLevel));
    setSelected(null);
    setBusy(false);
    setNotice('');
    clearTransientFeedback();
    setProgressPulseKey(0);
    setMascotReaction(null);
    setVictoryCelebration(false);
    window.clearTimeout(mascotTimerRef.current);
    tileRefs.current.clear();
  }

  function reactMascot(reaction, duration) {
    window.clearTimeout(mascotTimerRef.current);
    setMascotReaction(reaction);
    mascotTimerRef.current = window.setTimeout(() => setMascotReaction(null), duration);
  }

  function launchCollectFlyers(cells, boardSnapshot, options = {}) {
    const targetRect = goalTargetRef.current?.getBoundingClientRect();
    const kind = options.kind ?? 'collectible';
    const entityMeta = options.entityMeta;

    if (!targetRect) {
      return;
    }

    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const flyers = cells
      .map((cell, index) => {
        const sourceRect = tileRefs.current.get(`${cell.row}:${cell.col}`)?.getBoundingClientRect();
        const boardCell = boardSnapshot[cell.row]?.[cell.col];
        const tile = boardCell?.tile;
        const object = boardCell?.object;
        const meta = kind === 'entity' ? entityMeta : tile ? tileLookup.get(tile.type) : objectLookup.get(object?.type);

        if (!sourceRect || (kind !== 'mud-clean' && !meta)) {
          return null;
        }

        const fromX = sourceRect.left + sourceRect.width / 2;
        const fromY = sourceRect.top + sourceRect.height / 2;

        return {
          id: `${kind}-${tile?.key ?? object?.key ?? `${cell.row}-${cell.col}`}-fly-${index}`,
          kind,
          image: meta?.image,
          label: kind === 'mud-clean' ? 'Cleaned mud progress' : meta.label,
          fromX,
          fromY,
          dx: targetX - fromX,
          dy: targetY - fromY,
          delay: Math.min(index * 45, 180),
        };
      })
      .filter(Boolean);

    window.clearTimeout(collectFlyersTimerRef.current);
    setCollectFlyers(flyers);
    collectFlyersTimerRef.current = window.setTimeout(() => setCollectFlyers([]), levelConfig.timing.collectFly + 180);
  }

  return (
    <main className="game-shell">
      <section className="topbar" aria-label="Level status">
        <div className="brand-lockup">
          <div>
          <h1 className="game-title" aria-label="COLA & CO.">
            <span className="cola-word">
              <span>C</span>
              <span>O</span>
              <span>L</span>
              <span>A</span>
            </span>
            <span className="pop-word co-word">
              <span>&amp;</span>
              <span>C</span>
              <span>O</span>
              <span>.</span>
            </span>
          </h1>
          <p className="game-tagline">Match. Play. Wag.</p>
          </div>
        </div>
        <button className="icon-button mobile-header-reset" type="button" onClick={restart} aria-label="Restart level" title="Restart level">
          <RotateCcw size={20} />
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

          <div className="level-card">
            <p className="level-kicker">Level {levelConfig.level}</p>
            <h2>{levelConfig.name}</h2>
            <p>
              <strong>{levelConfig.story.headline}</strong>
            </p>
            <p>
              {storyPrompt}
            </p>
            <p className="level-tip">
              <span aria-hidden="true">💡</span>
              <span>
                <strong>{levelConfig.story.favoriteLead}</strong> {levelConfig.story.favoriteDetail}
              </span>
            </p>
          </div>

          <div className="objective">
            <div className="objective-heading">
              <span className="panel-label">
                <PawPrint size={16} aria-hidden="true" />
                {isTreatGoal || isMudGoal || isDropGoal ? 'Goal' : "Cola's Favorites"}
              </span>
            </div>
            <div className={`goal-progress ${isTreatGoal || isMudGoal || isDropGoal ? 'treat-goal-progress' : ''}`} ref={goalTargetRef}>
              {isTreatGoal ? (
                objectiveObject && (
                  <div className="goal-tiles" aria-label="Target treat">
                    <div className="goal-tile treat-goal-tile">
                      <img src={objectiveObject.image} alt={objectiveObject.label} />
                    </div>
                  </div>
                )
              ) : isMudGoal ? (
                objectiveTerrain && (
                  <div className="goal-tiles" aria-label="Target muddy spots">
                    <div className="goal-tile treat-goal-tile">
                      <img src={objectiveTerrain.identityImage} alt={objectiveTerrain.label} />
                    </div>
                  </div>
                )
              ) : isDropGoal ? (
                objectiveEntity && (
                  <div className="goal-tiles" aria-label="Target ball">
                    <div className="goal-tile treat-goal-tile ball-goal-tile">
                      <img src={objectiveEntity.image} alt={objectiveEntity.label} />
                    </div>
                  </div>
                )
              ) : (
                <div className="goal-tiles" aria-label="Target Cola tiles">
                  {objectiveTiles.map((tile) => (
                    <div className="goal-tile" key={tile.id}>
                      <img src={tile.image} alt={`${tile.label} Cola`} />
                    </div>
                  ))}
                </div>
              )}
              <strong>
                {displayedCollected} / {objectiveTarget}
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
          <button className="icon-button board-reset" type="button" onClick={restart} aria-label="Restart level" title="Restart level">
            <RotateCcw size={22} />
          </button>
          {shuffleFeedback && (
            <div className="shuffle-callout" key={shuffleFeedback.key} aria-live="polite">
              <strong>{shuffleFeedback.title}</strong>
              <span>{shuffleFeedback.message}</span>
            </div>
          )}
          {ballEntranceFeedback && (
            <div className="ball-entrance-callout" key={ballEntranceFeedback.key} aria-live="polite">
              {ballEntranceFeedback.text}
            </div>
          )}
          <div className="board" style={{ '--board-size': levelConfig.width }}>
            {game.board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const tile = cell.tile;
                const object = cell.object;
                const objectMeta = objectLookup.get(object?.type);

                if (!tile && object && objectMeta) {
                  return (
                    <button
                      className={`tile object-cell object-${object.type} ${object.state}`}
                      key={object.key}
                      ref={(node) => {
                        const cellKey = `${rowIndex}:${colIndex}`;
                        if (node) {
                          tileRefs.current.set(cellKey, node);
                        } else {
                          tileRefs.current.delete(cellKey);
                        }
                      }}
                      type="button"
                      disabled
                      aria-label={`${objectMeta.label} at row ${rowIndex + 1}, column ${colIndex + 1}`}
                    >
                      <img src={objectMeta.image} alt="" draggable="false" />
                      {object.state === 'collecting' && (
                        <span className="treat-sparkles" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                          <span />
                        </span>
                      )}
                    </button>
                  );
                }

                if (!tile) {
                  return <div className="tile empty-cell" key={`${rowIndex}:${colIndex}`} aria-hidden="true" />;
                }

                const meta = getTileMeta(tile, tileLookup, levelConfig);
                const terrain = cell.terrain;
                const isSelected = selected?.row === rowIndex && selected?.col === colIndex;
                const isEntityTile = Boolean(tile.entity);

                return (
                  <button
                    className={`tile ${isEntityTile ? `entity-tile entity-${tile.entity}` : ''} ${
                      terrain ? `terrain-${terrain.type} ${terrain.state}` : ''
                    } ${
                      isSelected ? 'selected' : ''
                    } ${tile.state} ${
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
                    disabled={isEntityTile || busy || game.status !== 'playing'}
                    style={{ '--tile-color': meta.color }}
                    aria-label={`${meta.label} ${isEntityTile ? 'at' : 'tile at'} row ${rowIndex + 1}, column ${colIndex + 1}${
                      terrain?.type === 'mud' ? ', on mud' : ''
                    }`}
                  >
                    {terrain?.type === 'mud' && (
                      <span className="mud-layer" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
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
              <img className="victory-mascot" src={resultArtwork.image} alt={resultArtwork.label} />
              <p>You completed Level {levelConfig.level}: {levelConfig.name}</p>
              <p className="collected-summary">
                {displayedCollected} / {objectiveTarget} {objectiveNoun} {objectiveVerb}
              </p>
              <p className="moves-left">Moves left: {game.moves}</p>
              <div className="result-actions">
                {hasNextLevel && (
                  <button className="primary-button" type="button" onClick={startNextLevel}>
                    Next Level
                  </button>
                )}
                <button className="primary-button" type="button" onClick={restart}>
                  Play Again
                </button>
              </div>
            </div>
          ) : (
            <div className="result-card lose-card">
              <h2 id="result-title">SO CLOSE!</h2>
              <p>Cola wants to try again.</p>
              <img className="lose-mascot" src={resultArtwork.image} alt={resultArtwork.label} />
              <p className="collected-summary">
                {displayedCollected} / {objectiveTarget} {objectiveNoun} {objectiveVerb}
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

      {collectFlyers.map((flyer) => {
        const flyerStyle = {
          left: `${flyer.fromX}px`,
          top: `${flyer.fromY}px`,
          '--fly-x': `${flyer.dx}px`,
          '--fly-y': `${flyer.dy}px`,
          '--fly-mid-x': `${flyer.dx * 0.88}px`,
          '--fly-mid-y': `${flyer.dy * 0.88 - 20}px`,
          animationDelay: `${flyer.delay}ms`,
        };

        if (flyer.kind === 'mud-clean') {
          return (
            <span className="collect-flyer clean-flyer" key={flyer.id} style={flyerStyle} aria-label={flyer.label}>
              <span />
              <span />
              <span />
            </span>
          );
        }

        return (
          <img
            className={`collect-flyer ${flyer.kind === 'entity' ? 'entity-flyer' : ''}`}
            key={flyer.id}
            src={flyer.image}
            alt=""
            style={flyerStyle}
          />
        );
      })}

      {objectiveComplete && <div className="completion-spark show">Goal complete</div>}
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

function getStatus(collected, moves, levelConfig) {
  if (collected >= getObjectiveTarget(levelConfig)) {
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

function getMascotState(game, reaction, levelConfig) {
  if (game.status === 'won' || game.status === 'celebrating') {
    return { key: 'victory', ...MASCOT_STATES.victory };
  }

  if (reaction) {
    return { key: reaction, ...MASCOT_STATES[reaction] };
  }

  if (isAlmostWinning(game.collected, levelConfig)) {
    return { key: 'almostWinning', ...MASCOT_STATES.almostWinning };
  }

  return { key: 'default', ...MASCOT_STATES.default };
}

function isAlmostWinning(collected, levelConfig) {
  return collected >= Math.ceil(getObjectiveTarget(levelConfig) * 0.75);
}

function getObjectiveTarget(levelConfig) {
  if (levelConfig.goalType === 'collectTreats') {
    return levelConfig.objective.treatCount;
  }

  return levelConfig.objective.targetCount;
}

function getObjectiveNoun(levelConfig) {
  if (levelConfig.goalType === 'collectTreats') {
    return 'treats';
  }

  if (levelConfig.goalType === 'clearMud') {
    return 'muddy spots';
  }

  if (levelConfig.goalType === 'dropEntities') {
    return 'balls';
  }

  return 'Colas';
}

function getObjectiveVerb(levelConfig) {
  if (levelConfig.goalType === 'clearMud') {
    return 'cleaned';
  }

  return 'collected';
}

function getInitialSpawnedEntityCount(levelConfig) {
  return (levelConfig.gravityEntities ?? []).reduce((total, entity) => total + (entity.count ?? 0), 0);
}

function getProgressedEntityKeys(previousBoard, nextBoard, entityType) {
  const previousEntities = getEntityPositions(previousBoard, entityType);
  const nextEntities = new Map(getEntityPositions(nextBoard, entityType).map((cell) => [cell.key, cell]));
  const progressed = new Set();

  for (const previous of previousEntities) {
    const next = nextEntities.get(previous.key);

    if (!next || next.row > previous.row) {
      progressed.add(previous.key);
    }
  }

  return progressed;
}

function getTileMeta(tile, tileLookup, levelConfig) {
  if (tile?.entity && levelConfig.objective?.entityType === tile.entity) {
    return levelConfig.objective.asset;
  }

  return tileLookup.get(tile.type);
}

function getResultArtwork(levelConfig, status) {
  if (status === 'won') {
    return levelConfig.completionImage ?? MASCOT_STATES.victory;
  }

  if (status === 'lost') {
    return levelConfig.failureImage ?? MASCOT_STATES.invalidSwap;
  }

  return MASCOT_STATES.default;
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

function getMarkedObjectiveBoard(board, objectiveState) {
  if (objectiveState.targetCollectionCount <= 0) {
    return board;
  }

  if (objectiveState.isTreatGoal) {
    return markObjects(board, objectiveState.treatCells, 'collecting');
  }

  if (objectiveState.isMudGoal) {
    return markTerrain(board, objectiveState.mudCells, 'cleaning');
  }

  return board;
}

function getClearedObjectiveBoard(board, objectiveState) {
  if (objectiveState.isTreatGoal) {
    return clearObjects(board, objectiveState.treatCells);
  }

  if (objectiveState.isMudGoal) {
    return clearTerrain(board, objectiveState.mudCells);
  }

  return board;
}

function getTargetMatchedCells(matches, board, targetTiles) {
  return matches.cells.filter((cell) => {
    const tile = board[cell.row]?.[cell.col]?.tile;
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

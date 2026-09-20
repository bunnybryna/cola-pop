export const TILE_TYPES = [
  {
    id: 'focus_green',
    label: 'Green Focus',
    image: '/assets/tiles/focus.png',
    color: '#f8c65b',
  },
  {
    id: 'smile_pink',
    label: 'Pink Smile',
    image: '/assets/tiles/smile.png',
    color: '#9bdc7d',
  },
  {
    id: 'naughty_yellow',
    label: 'Yellow Naughty',
    image: '/assets/tiles/naughty.png',
    color: '#ff9fb2',
  },
  {
    id: 'lick_blue',
    label: 'Blue Lick',
    image: '/assets/tiles/lick.png',
    color: '#7fc9ff',
  },
  {
    id: 'bigsmile_orange',
    label: 'Orange Big Smile',
    image: '/assets/tiles/bigsmile.png',
    color: '#c6a2ff',
  },
  {
    id: 'sleepy_purple',
    label: 'Purple Sleepy',
    image: '/assets/tiles/sleepy.png',
    color: '#ffb66e',
  },
];

export const MASCOT_STATES = {
  default: {
    image: '/assets/mascot/default.png',
    label: 'Cola sitting',
  },
  goodMatch: {
    image: '/assets/mascot/good-match.png',
    label: 'Cola excited',
  },
  bigCombo: {
    image: '/assets/mascot/big-combo.png',
    label: 'Cola jumping',
  },
  invalidSwap: {
    image: '/assets/mascot/invalid-swap.png',
    label: 'Cola tilting his head',
  },
  almostWinning: {
    image: '/assets/mascot/almost-winning.png',
    label: 'Cola ready to win',
  },
  victory: {
    image: '/assets/mascot/victory.png',
    label: 'Cola celebrating',
  },
};

const SHARED_SCORING = {
  basePerTile: 10,
  extraMatchTileBonus: 15,
  cascadeBonus: 40,
};

const SHARED_TIMING = {
  swap: 170,
  invalidSwap: 260,
  clear: 700,
  collectFly: 620,
  victoryPause: 1350,
  victoryBarks: {
    firstDelay: 900,
    secondDelay: 520,
  },
  fall: 320,
  cascadePause: 90,
};

// Set to null for normal progression. Set to a level number to make earlier goals quick for testing.
const TEST_FAST_FORWARD_TO_LEVEL = 4;
const TEST_PREVIOUS_LEVEL_TARGET = 1;

const BASE_LEVELS = [
  {
  level: 1,
  name: 'A Walk in the Park',
  goalType: 'collectTiles',
  width: 8,
  height: 8,
  moveLimit: 20,
  objective: {
    targetTileCount: 3,
      targetCount: 24,
  },
  story: {
    headline: 'The park is in bloom! 🌸',
    prompt: "Match Cola's favorite colors and collect",
    favoriteLead: 'Only the three colors shown below count!',
    favoriteDetail: '',
  },
  completionImage: {
    image: '/assets/level1complete.png',
    label: 'Cola sitting happily among flowers',
  },
  boardObjects: [],
  scoring: SHARED_SCORING,
  timing: SHARED_TIMING,
  },
  {
    level: 2,
    name: 'Treat Time 🦴',
    goalType: 'collectTreats',
    width: 8,
    height: 8,
    moveLimit: 20,
    objective: {
      treatType: 'bone',
      treatCount: 8,
    },
    story: {
      headline: 'Cola is hungry! 🦴',
      prompt: 'Match next to treats to collect them.',
      favoriteLead: 'One match can grab multiple treats!',
      favoriteDetail: '',
    },
    completionImage: {
      image: '/assets/level2complete.png',
      label: 'Cola receiving a bone treat',
    },
    failureImage: {
      image: '/assets/level2fail.png',
      label: 'Cola still waiting for a bone treat',
    },
    boardObjects: [
      {
        id: 'bone',
        label: 'Bone Treat',
        image: '/assets/tiles/bone.png',
        count: 8,
        placement: {
          borderPadding: 0,
          layoutAttempts: 80,
          topRowCount: 1,
          topRow: 0,
          topRowColumns: [1, 2, 3, 4, 5, 6],
          maxAdditionalBorderCount: 1,
          forbiddenCells: [
            { row: 7, col: 0 },
            { row: 7, col: 7 },
          ],
          minImmediatelyCollectible: 1,
          maxImmediateCollection: 3,
          minDistanceRatio: 0.2,
          distanceBasis: 'spawnArea',
          distanceMetric: 'manhattan',
        },
      },
    ],
    scoring: SHARED_SCORING,
    timing: SHARED_TIMING,
  },
  {
    level: 3,
    name: 'Muddy Paws 🐾',
    goalType: 'clearMud',
    width: 8,
    height: 8,
    moveLimit: 20,
    objective: {
      terrainType: 'mud',
      targetCount: 8,
    },
    story: {
      headline: 'Uh-oh... Cola found a muddy puddle!',
      prompt: 'Match on muddy spots to clean them.',
      favoriteLead: 'Clean multiple spots with one match!',
      favoriteDetail: '',
    },
    completionImage: {
      image: '/assets/level3complete.png',
      label: 'Cola sparkling clean after the mud is gone',
    },
    failureImage: {
      image: '/assets/level3fail.png',
      label: 'Cola still muddy',
    },
    terrain: [
      {
        id: 'mud',
        label: 'Muddy Spot',
        identityImage: '/assets/tiles/muddycola.png',
        count: 8,
        placement: {
          strategy: 'controlledRandom',
          layoutAttempts: 60,
          borderPadding: 0,
          avoidCorners: true,
          adjacentPairCountRange: [2, 3],
          minAdjacentPairs: 2,
          maxAdjacentPairs: 3,
          adjacentPairDirection: 'either',
          preferSameTilePair: true,
          minPairAnchorDistance: 3,
          maxPairExternalNeighbors: 0,
          maxOrthogonalTerrainNeighbors: 0,
          preferredRows: [2, 3, 4, 5],
          minPreferredRowCount: 6,
          preferredRowWeight: 5,
          bottomRowWeight: 0.25,
          maxBottomRow: 1,
          maxSecondBottomRow: 1,
          maxBottomTwoRows: 2,
          minImmediatelyCleanable: 2,
          maxPerRow: 3,
          maxPerColumn: 3,
        },
      },
    ],
    boardObjects: [],
    scoring: SHARED_SCORING,
    timing: SHARED_TIMING,
  },
  {
    level: 4,
    name: 'Fetch!',
    goalType: 'dropEntities',
    width: 8,
    height: 8,
    moveLimit: 20,
    objective: {
      entityType: 'fetch_ball',
      targetCount: 2,
      spawnAfterCollected: 1,
      spawnAfterMovesUsed: 5,
      asset: {
        id: 'fetch_ball',
        label: 'Play On! Ball',
        image: '/assets/tiles/ball.png',
        color: '#ff9f43',
      },
    },
    story: {
      headline: 'Cola wants to play fetch!',
      prompt: 'Clear the way and drop the balls to the bottom.',
      favoriteLead: 'Match below a ball to help it fall!',
      favoriteDetail: '',
    },
    completionImage: {
      image: '/assets/level4complete.png',
      label: 'Cola celebrating after fetch',
    },
    failureImage: {
      image: '/assets/level4fail.png',
      label: 'Cola still waiting to fetch the ball',
    },
    gravityEntities: [
      {
        id: 'fetch_ball',
        entity: 'fetch_ball',
        label: 'Play On! Ball',
        image: '/assets/tiles/ball.png',
        count: 1,
        placement: {
          avoidCorners: true,
          minRowsBelow: 2,
          minCol: 2,
          maxCol: 5,
          minRow: 0,
          maxRow: 0,
          preferredRows: [0],
          spawnMinRow: 1,
          spawnMaxRow: 1,
          spawnPreferredRows: [1],
        },
      },
    ],
    boardObjects: [],
    scoring: SHARED_SCORING,
    timing: SHARED_TIMING,
  },
];

export const LEVELS = applyTestGoalOverrides(BASE_LEVELS);
export const LEVEL_CONFIG = LEVELS[0];

function applyTestGoalOverrides(levels) {
  if (!TEST_FAST_FORWARD_TO_LEVEL) {
    return levels;
  }

  return levels.map((level) => {
    if (level.level >= TEST_FAST_FORWARD_TO_LEVEL) {
      return level;
    }

    return {
      ...level,
      objective: getTestObjective(level),
    };
  });
}

function getTestObjective(level) {
  if (level.goalType === 'collectTiles') {
    return {
      ...level.objective,
      targetTileCount: 1,
      targetCount: TEST_PREVIOUS_LEVEL_TARGET,
    };
  }

  if (level.goalType === 'collectTreats') {
    return {
      ...level.objective,
      treatCount: TEST_PREVIOUS_LEVEL_TARGET,
    };
  }

  if (level.goalType === 'clearMud') {
    return {
      ...level.objective,
      targetCount: TEST_PREVIOUS_LEVEL_TARGET,
    };
  }

  return level.objective;
}

export const TILE_TYPES = [
  {
    id: 'focus_green',
    label: 'Green Focus',
    image: '/assets/tiles/focus.png',
    color: '#f8c65b',
    catColor: 'green',
  },
  {
    id: 'smile_pink',
    label: 'Pink Smile',
    image: '/assets/tiles/smile.png',
    color: '#9bdc7d',
    catColor: 'pink',
  },
  {
    id: 'naughty_yellow',
    label: 'Yellow Naughty',
    image: '/assets/tiles/naughty.png',
    color: '#ff9fb2',
    catColor: 'yellow',
  },
  {
    id: 'lick_blue',
    label: 'Blue Lick',
    image: '/assets/tiles/lick.png',
    color: '#7fc9ff',
    catColor: 'blue',
  },
  {
    id: 'bigsmile_orange',
    label: 'Orange Big Smile',
    image: '/assets/tiles/bigsmile.png',
    color: '#c6a2ff',
    catColor: 'orange',
  },
  {
    id: 'sleepy_purple',
    label: 'Purple Sleepy',
    image: '/assets/tiles/sleepy.png',
    color: '#ffb66e',
    catColor: 'purple',
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
  clear: 530,
  collectFly: 620,
  victoryPause: 1350,
  victoryBarks: {
    firstDelay: 900,
    secondDelay: 520,
  },
  fall: 320,
  cascadePause: 90,
};

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
    moveLimit: 30,
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
  {
    level: 5,
    name: 'Power Pals! 🐾',
    goalType: 'activateCatPowers',
    width: 8,
    height: 8,
    // Playtest value: four powers need setup plus activation, with room to plan.
    moveLimit: 25,
    objective: {
      targetCount: 4,
    },
    story: {
      headline: '',
      prompt: 'Match 4 or 5 to make a Cat Power!',
      followUp: 'Match the cat again to unleash it.',
      catRules: [
        { icon: '↕', label: 'Tuxedo', text: 'clears a row' },
        { icon: '↔', label: 'Tabby', text: 'clears a column' },
      ],
      favoriteLead: '',
      favoriteDetail: '',
    },
    completionImage: {
      image: '/assets/level5complete.png',
      label: 'Cola celebrating Level 5 with both kitty friends',
    },
    failureImage: {
      image: '/assets/level5fail.png',
      label: 'Cola and the kitty friends ready to try Level 5 again',
    },
    catPower: {
      enabled: true,
      sound: 'cat-power',
      timing: {
        transformDelay: 270,
        creationResolve: 680,
        activationResolve: 600,
      },
      goalAssets: {
        tuxedo: '/assets/ui/goal-cat-tuxedo-rainbow.png',
        tabby: '/assets/ui/goal-cat-tabby-rainbow.png',
      },
      initialBoard: {
        minimumImmediateCreations: 2,
        preferBothAxes: true,
        preferNearFour: true,
        minimumSpread: 3,
        layoutAttempts: 320,
      },
      assets: {
        'tabby-column': {
          orange: '/assets/tiles/cat-tabby-orange.png',
          blue: '/assets/tiles/cat-tabby-blue.png',
          yellow: '/assets/tiles/cat-tabby-yellow.png',
          purple: '/assets/tiles/cat-tabby-purple.png',
          green: '/assets/tiles/cat-tabby-green.png',
          pink: '/assets/tiles/cat-tabby-pink.png',
        },
        'tuxedo-row': {
          orange: '/assets/tiles/cat-tuxedo-orange.png',
          blue: '/assets/tiles/cat-tuxedo-blue.png',
          yellow: '/assets/tiles/cat-tuxedo-yellow.png',
          purple: '/assets/tiles/cat-tuxedo-purple.png',
          green: '/assets/tiles/cat-tuxedo-green.png',
          pink: '/assets/tiles/cat-tuxedo-pink.png',
        },
      },
    },
    boardObjects: [],
    scoring: SHARED_SCORING,
    timing: SHARED_TIMING,
  },
];

export const LEVELS = BASE_LEVELS;
export const LEVEL_CONFIG = LEVELS[0];

export function getNextLevelIndex(activeLevelIndex) {
  return activeLevelIndex + 1;
}

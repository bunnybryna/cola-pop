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

export const LEVELS = [
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
    prompt: 'Match the three flower-colored Colas and collect',
    favoriteLead: 'Cola has favorites!',
    favoriteDetail: 'Match any color you like, but only these three count.',
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
    moveLimit: 3,
    objective: {
      treatType: 'bone',
      treatCount: 6,
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
        count: 6,
        placement: {
          borderPadding: 2,
          minDistanceRatio: 0.3,
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
      targetCount: 10,
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
        count: 10,
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
];

export const LEVEL_CONFIG = LEVELS[0];

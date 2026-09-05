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
  moveLimit: 24,
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
      treatCount: 6,
    },
    story: {
      headline: 'Cola is getting hungry! 🦴',
      prompt: 'Make matches next to treats to collect them all.',
      favoriteLead: 'One match can grab more than one treat!',
      favoriteDetail: '',
    },
    boardObjects: [
      {
        id: 'bone',
        label: 'Bone Treat',
        image: '/assets/tiles/bone.png',
        count: 6,
        placement: {
          area: 'inner',
        },
      },
    ],
    scoring: SHARED_SCORING,
    timing: SHARED_TIMING,
  },
];

export const LEVEL_CONFIG = LEVELS[0];

const SOUND_PATHS = {
  pop: '/assets/sounds/pop.ogg',
  fall: '/assets/sounds/fall.ogg',
  special: '/assets/sounds/special.ogg',
  'cat-power': '/assets/sounds/mixkit-sweet-kitty-meow-93.wav',
  'paw-shuffle': '/assets/sounds/special.ogg',
  epic: '/assets/sounds/epic.mp3',
  amazing: '/assets/sounds/amazing.mp3',
  legendary: '/assets/sounds/legendary.mp3',
  goal: '/assets/sounds/goal.ogg',
  'bark-happy': '/assets/sounds/bark-happy.ogg',
  invalid: '/assets/sounds/invalid.ogg',
  victory: '/assets/sounds/victory.mp3',
  'wah-wah-sad': '/assets/sounds/wah-wah-sad.mp3',
};

const VOLUMES = {
  pop: 0.38,
  fall: 0.18,
  special: 0.42,
  'cat-power': 0.4,
  'paw-shuffle': 0.34,
  epic: 0.45,
  amazing: 0.48,
  legendary: 0.52,
  goal: 0.38,
  'bark-happy': 0.42,
  invalid: 0.28,
  victory: 0.5,
  'wah-wah-sad': 0.48,
};

const players = new Map();
const stopTimers = new Map();
const PRIMARY_SOUNDS = new Set(['pop', 'special', 'goal', 'epic', 'amazing', 'legendary', 'victory']);
const CAT_POWER_POOL_SIZE = 2;
const catPowerPlayers = [];
let gameplayAudioInitialized = false;

export function initializeGameplayAudio() {
  if (gameplayAudioInitialized) {
    return;
  }

  gameplayAudioInitialized = true;

  for (const name of Object.keys(SOUND_PATHS)) {
    if (name === 'cat-power') {
      continue;
    }

    getAudioPlayer(name).load();
  }

  ensureCatPowerPlayers().forEach((audio) => audio.load());
}

export function playSound(name) {
  playSoundEffect(name);
}

export function playPrimarySound(name) {
  stopPrimarySounds();
  playSoundEffect(name);
}

export function playCatPower(kind) {
  if (kind !== 'cat-create' && kind !== 'cat-activate') {
    return;
  }

  // Cat sounds are local mechanic cues, so they must not interrupt a cascade voice.
  const audio = ensureCatPowerPlayers().find((player) => player.paused || player.ended);

  if (!audio) {
    return;
  }

  restartAudio(audio, 'cat-power');
}

export function stopPrimarySounds() {
  for (const name of PRIMARY_SOUNDS) {
    const audio = players.get(name);

    if (!audio) {
      continue;
    }

    window.clearTimeout(stopTimers.get(name));
    audio.pause();
    audio.currentTime = 0;
  }
}

function playSoundEffect(name) {
  const audio = getAudioPlayer(name);

  if (!audio) {
    return;
  }

  restartAudio(audio, name);
}

function getAudioPlayer(name) {
  const source = SOUND_PATHS[name];

  if (!source) {
    return null;
  }

  let audio = players.get(name);

  if (!audio) {
    audio = new Audio(source);
    audio.preload = 'auto';
    players.set(name, audio);
  }

  return audio;
}

function ensureCatPowerPlayers() {
  while (catPowerPlayers.length < CAT_POWER_POOL_SIZE) {
    const audio = new Audio(SOUND_PATHS['cat-power']);
    audio.preload = 'auto';
    catPowerPlayers.push(audio);
  }

  return catPowerPlayers;
}

function restartAudio(audio, name) {
  window.clearTimeout(stopTimers.get(name));
  audio.pause();
  audio.currentTime = 0;
  audio.volume = VOLUMES[name] ?? 0.35;
  audio.play().catch(() => {
    // Browsers can block audio until the first user gesture; gameplay should continue silently.
  });
}

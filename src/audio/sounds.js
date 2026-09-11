const SOUND_PATHS = {
  pop: '/assets/sounds/pop.ogg',
  fall: '/assets/sounds/fall.ogg',
  special: '/assets/sounds/special.ogg',
  epic: '/assets/sounds/epic.mp3',
  amazing: '/assets/sounds/amazing.mp3',
  unbelievable: '/assets/sounds/unbelievable.mp3',
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
  epic: 0.45,
  amazing: 0.48,
  unbelievable: 0.52,
  goal: 0.38,
  'bark-happy': 0.42,
  invalid: 0.28,
  victory: 0.5,
  'wah-wah-sad': 0.48,
};

const players = new Map();
const stopTimers = new Map();

export function playSound(name) {
  const source = SOUND_PATHS[name];

  if (!source) {
    return;
  }

  let audio = players.get(name);

  if (!audio) {
    audio = new Audio(source);
    audio.preload = 'auto';
    players.set(name, audio);
  }

  window.clearTimeout(stopTimers.get(name));
  audio.pause();
  audio.currentTime = 0;
  audio.volume = VOLUMES[name] ?? 0.35;
  audio.play().catch(() => {
    // Browsers can block audio until the first user gesture; gameplay should continue silently.
  });

}

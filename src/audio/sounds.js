const SOUND_PATHS = {
  pop: '/assets/sounds/pop.ogg',
  fall: '/assets/sounds/fall.ogg',
  special: '/assets/sounds/special.ogg',
  goal: '/assets/sounds/goal.ogg',
  invalid: '/assets/sounds/invalid.ogg',
  victory: '/assets/sounds/victory.ogg',
};

const VOLUMES = {
  pop: 0.38,
  fall: 0.18,
  special: 0.42,
  goal: 0.38,
  invalid: 0.28,
  victory: 0.5,
};

const players = new Map();

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

  audio.pause();
  audio.currentTime = 0;
  audio.volume = VOLUMES[name] ?? 0.35;
  audio.play().catch(() => {
    // Browsers can block audio until the first user gesture; gameplay should continue silently.
  });
}

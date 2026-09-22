import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LEVELS } from '../src/config/level.js';

test('Level 4 keeps the approved two-ball timing configuration', () => {
  const level4 = LEVELS.find((level) => level.level === 4);

  assert.equal(level4.moveLimit, 30);
  assert.equal(level4.objective.targetCount, 2);
  assert.equal(level4.objective.spawnAfterMovesUsed, 5);
});

test('Goal complete text is only rendered behind the objectiveComplete condition', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(appSource, /\{objectiveComplete && <div className="completion-spark show">Goal complete<\/div>\}/);
  assert.doesNotMatch(appSource, /className=\{`completion-spark \$\{objectiveComplete \? 'show' : ''\}`\}/);
});

test('Level 4 second-ball entrance feedback is present without a new audio cue', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const match3Source = readFileSync(new URL('../src/game/match3.js', import.meta.url), 'utf8');
  const soundSource = readFileSync(new URL('../src/audio/sounds.js', import.meta.url), 'utf8');

  assert.match(appSource, /NEW BALL! 🎾/);
  assert.match(match3Source, /createGravityEntityTile\(entityConfig, 'new-ball'\)/);
  assert.doesNotMatch(soundSource, /new-ball/i);
});

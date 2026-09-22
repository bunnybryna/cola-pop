import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrimaryReward } from '../src/game/rewards.js';

test('normal three-tile match uses pop with no text', () => {
  assert.deepEqual(
    getPrimaryReward({
      cascadeIndex: 0,
      matchPower: 3,
      objectiveCount: 0,
      isTreatGoal: false,
      isMudGoal: false,
      completesObjective: false,
    }),
    {
      priority: 'normal',
      sound: 'pop',
      feedback: null,
      suppressFall: false,
    },
  );
});

test('four-or-more match uses the special reward label and sound', () => {
  assert.deepEqual(
    getPrimaryReward({
      cascadeIndex: 0,
      matchPower: 4,
      objectiveCount: 0,
      isTreatGoal: false,
      isMudGoal: false,
      completesObjective: false,
    }),
    {
      priority: 'special',
      sound: 'special',
      feedback: { text: 'NICE!', tone: 'nice' },
      suppressFall: false,
    },
  );
});

test('cascade stages escalate with synchronized text and sound', () => {
  assert.deepEqual(getCascadeReward(1), {
    priority: 'cascade',
    sound: 'epic',
    feedback: { text: 'EPIC!', tone: 'cascade' },
    suppressFall: false,
  });
  assert.deepEqual(getCascadeReward(2), {
    priority: 'cascade',
    sound: 'amazing',
    feedback: { text: 'AMAZING!', tone: 'combo' },
    suppressFall: false,
  });
  assert.deepEqual(getCascadeReward(3), {
    priority: 'cascade',
    sound: 'legendary',
    feedback: { text: 'LEGENDARY!', tone: 'combo-max' },
    suppressFall: false,
  });
});

test('objective collection without a cascade uses objective feedback', () => {
  assert.deepEqual(
    getPrimaryReward({
      cascadeIndex: 0,
      matchPower: 3,
      objectiveCount: 1,
      isTreatGoal: true,
      isMudGoal: false,
      completesObjective: false,
    }),
    {
      priority: 'objective',
      sound: 'goal',
      feedback: { text: 'TREAT!', tone: 'nice' },
      suppressFall: false,
    },
  );
});

test('cascade reward outranks objective feedback during a cascade', () => {
  assert.deepEqual(
    getPrimaryReward({
      cascadeIndex: 1,
      matchPower: 3,
      objectiveCount: 1,
      isTreatGoal: false,
      isMudGoal: true,
      completesObjective: false,
    }),
    {
      priority: 'cascade',
      sound: 'epic',
      feedback: { text: 'EPIC!', tone: 'cascade' },
      suppressFall: false,
    },
  );
});

test('victory suppresses pending lower-priority rewards', () => {
  assert.deepEqual(
    getPrimaryReward({
      cascadeIndex: 2,
      matchPower: 5,
      objectiveCount: 2,
      isTreatGoal: true,
      isMudGoal: false,
      completesObjective: true,
    }),
    {
      priority: 'victory',
      sound: null,
      feedback: null,
      suppressFall: false,
    },
  );
});

function getCascadeReward(cascadeIndex) {
  return getPrimaryReward({
    cascadeIndex,
    matchPower: 3,
    objectiveCount: 0,
    isTreatGoal: false,
    isMudGoal: false,
    completesObjective: false,
  });
}

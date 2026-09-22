export function getPrimaryReward({ cascadeIndex, matchPower, objectiveCount, isTreatGoal, isMudGoal, completesObjective }) {
  if (completesObjective) {
    return {
      priority: 'victory',
      sound: null,
      feedback: null,
      suppressFall: false,
    };
  }

  if (cascadeIndex > 0) {
    return {
      priority: 'cascade',
      sound: getCascadeSound(cascadeIndex),
      feedback: getCascadeFeedback(cascadeIndex),
      suppressFall: false,
    };
  }

  if (objectiveCount > 0) {
    return {
      priority: 'objective',
      sound: 'goal',
      feedback: getObjectiveFeedback({ objectiveCount, isTreatGoal, isMudGoal }),
      suppressFall: false,
    };
  }

  if (matchPower >= 4) {
    return {
      priority: 'special',
      sound: 'special',
      feedback: getMatchFeedback(matchPower),
      suppressFall: false,
    };
  }

  return {
    priority: 'normal',
    sound: 'pop',
    feedback: null,
    suppressFall: false,
  };
}

export function getCascadeSound(cascadeIndex) {
  if (cascadeIndex >= 3) {
    return 'legendary';
  }

  if (cascadeIndex === 2) {
    return 'amazing';
  }

  return 'epic';
}

export function getCascadeFeedback(cascadeIndex) {
  if (cascadeIndex >= 3) {
    return { text: 'LEGENDARY!', tone: 'combo-max' };
  }

  if (cascadeIndex === 2) {
    return { text: 'AMAZING!', tone: 'combo' };
  }

  return { text: 'EPIC!', tone: 'cascade' };
}

export function getMatchFeedback(matchPower) {
  if (matchPower >= 5) {
    return { text: 'PAWSOME!', tone: 'pawsome' };
  }

  if (matchPower >= 4) {
    return { text: 'NICE!', tone: 'nice' };
  }

  return null;
}

export function getObjectiveFeedback({ objectiveCount, isTreatGoal, isMudGoal }) {
  if (isTreatGoal) {
    return objectiveCount > 1
      ? { text: 'TREAT TIME!', tone: 'pawsome' }
      : { text: 'TREAT!', tone: 'nice' };
  }

  if (isMudGoal) {
    return objectiveCount > 1
      ? { text: 'SQUEAKY CLEAN!', tone: 'pawsome' }
      : { text: 'CLEAN!', tone: 'nice' };
  }

  return null;
}

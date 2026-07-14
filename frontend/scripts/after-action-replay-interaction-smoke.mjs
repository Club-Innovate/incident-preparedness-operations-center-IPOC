import assert from 'node:assert/strict';

function createReplayMoments() {
  return [
    { id: 'replay-capture-baseline', label: 'Evidence capture baseline', readiness: 56, recommendedMode: 'evidence' },
    { id: 'replay-closure-evaluation', label: 'Closure posture checkpoint', readiness: 62, recommendedMode: 'closure' },
    { id: 'replay-corrective-readiness', label: 'Corrective pipeline checkpoint', readiness: 48, recommendedMode: 'improvement' },
    { id: 'replay-governance-check', label: 'AAR/HVA governance gate', readiness: 75, recommendedMode: 'closure' },
    { id: 'replay-lessons-harvest', label: 'Lessons-learned harvest checkpoint', readiness: 100, recommendedMode: 'improvement' },
  ];
}

function clampReplayIndex(index, momentsLength) {
  if (momentsLength <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), momentsLength - 1);
}

function moveReplayTimeline(currentIndex, direction, momentsLength) {
  return clampReplayIndex(currentIndex + direction, momentsLength);
}

function scrubReplayTimeline(nextIndex, momentsLength) {
  return clampReplayIndex(nextIndex, momentsLength);
}

function resolveReplayIntervalMs(speed) {
  const normalizedSpeed = speed === 4 || speed === 2 ? speed : 1;
  return Math.max(500, Math.floor(2200 / normalizedSpeed));
}

function advanceReplayTick(currentIndex, momentsLength) {
  if (momentsLength <= 0) {
    return {
      nextIndex: 0,
      reachedEnd: true,
      shouldStop: true,
    };
  }

  if (currentIndex >= momentsLength - 1) {
    return {
      nextIndex: currentIndex,
      reachedEnd: true,
      shouldStop: true,
    };
  }

  return {
    nextIndex: currentIndex + 1,
    reachedEnd: false,
    shouldStop: false,
  };
}

function applyReplayMomentContext(moment) {
  if (!moment) {
    return null;
  }

  return moment.recommendedMode;
}

function runAfterActionReplayInteractionSmoke() {
  const moments = createReplayMoments();

  assert.equal(moments.length, 5, 'Expected replay harness to include five timeline checkpoints.');
  assert.equal(moments[0].recommendedMode, 'evidence', 'Expected first replay checkpoint to map to evidence mode.');

  const movedForward = moveReplayTimeline(0, 1, moments.length);
  assert.equal(movedForward, 1, 'Expected next-step navigation to increment replay index.');

  const movedBackward = moveReplayTimeline(movedForward, -1, moments.length);
  assert.equal(movedBackward, 0, 'Expected previous-step navigation to decrement replay index.');

  const boundedBackward = moveReplayTimeline(0, -1, moments.length);
  assert.equal(boundedBackward, 0, 'Expected replay index to remain at zero when moving previous from first checkpoint.');

  const boundedForward = moveReplayTimeline(moments.length - 1, 1, moments.length);
  assert.equal(boundedForward, moments.length - 1, 'Expected replay index to remain at last checkpoint when moving next from end.');

  const scrubMid = scrubReplayTimeline(3, moments.length);
  assert.equal(scrubMid, 3, 'Expected scrubber to set replay index to requested in-range checkpoint.');

  const scrubBeyond = scrubReplayTimeline(99, moments.length);
  assert.equal(scrubBeyond, moments.length - 1, 'Expected scrubber to clamp replay index at upper bound.');

  const intervalDefault = resolveReplayIntervalMs(1);
  const intervalFast = resolveReplayIntervalMs(4);
  assert.equal(intervalDefault, 2200, 'Expected 1x replay speed to use 2200ms tick interval.');
  assert.equal(intervalFast, 550, 'Expected 4x replay speed to reduce interval to 550ms.');

  const tickAdvance = advanceReplayTick(2, moments.length);
  assert.equal(tickAdvance.nextIndex, 3, 'Expected replay tick to advance to next checkpoint before end.');
  assert.equal(tickAdvance.shouldStop, false, 'Expected replay tick to continue when not at end checkpoint.');

  const tickEnd = advanceReplayTick(moments.length - 1, moments.length);
  assert.equal(tickEnd.nextIndex, moments.length - 1, 'Expected replay tick to remain at end checkpoint.');
  assert.equal(tickEnd.reachedEnd, true, 'Expected replay tick to flag end-of-timeline condition.');
  assert.equal(tickEnd.shouldStop, true, 'Expected replay tick to stop playback at end-of-timeline condition.');

  const mappedMode = applyReplayMomentContext(moments[3]);
  assert.equal(mappedMode, 'closure', 'Expected replay context apply action to map governance checkpoint to closure mode.');

  const nullMode = applyReplayMomentContext(null);
  assert.equal(nullMode, null, 'Expected replay context apply action to no-op on null checkpoint.');
}

runAfterActionReplayInteractionSmoke();
console.log('[PASS ] After Action replay interaction workflow smoke checks passed.');

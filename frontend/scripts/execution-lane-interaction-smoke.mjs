import assert from 'node:assert/strict';

function applyDirectivePatch(directives, id, patch) {
  const existing = directives.find((item) => item.id === id);
  if (!existing) {
    return [
      ...directives,
      {
        id,
        status: patch.status ?? 'planned',
        owner: patch.owner ?? '',
        dueDate: patch.dueDate ?? '',
        blockedByDirectiveId: patch.blockedByDirectiveId ?? '',
      },
    ];
  }

  return directives.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function applyDirectivePatchBatch(directives, patches) {
  return patches.reduce((current, item) => applyDirectivePatch(current, item.id, item.patch), directives);
}

function countUnresolvedDependencies(directives) {
  const directivesById = new Map(directives.map((directive) => [directive.id, directive]));

  return directives.reduce((count, directive) => {
    if (!directive.blockedByDirectiveId) {
      return count;
    }

    const blocker = directivesById.get(directive.blockedByDirectiveId);
    if (!blocker) {
      return count;
    }

    return blocker.status === 'completed' ? count : count + 1;
  }, 0);
}

function resolveDependencyBlockers(directives) {
  const nextById = new Map(directives.map((directive) => [directive.id, { ...directive }]));

  nextById.forEach((directive) => {
    if (!directive.blockedByDirectiveId) {
      return;
    }

    const blocker = nextById.get(directive.blockedByDirectiveId);
    if (!blocker || blocker.status === 'completed') {
      return;
    }

    nextById.set(blocker.id, {
      ...blocker,
      status: 'completed',
    });
  });

  nextById.forEach((directive) => {
    if (!directive.blockedByDirectiveId) {
      return;
    }

    const blocker = nextById.get(directive.blockedByDirectiveId);
    if (!blocker || blocker.status !== 'completed') {
      return;
    }

    nextById.set(directive.id, {
      ...directive,
      blockedByDirectiveId: '',
      status: directive.owner.trim().length > 0 ? 'in-progress' : 'planned',
    });
  });

  return Array.from(nextById.values());
}

function runExecutionLaneInteractionSmoke() {
  const todayIso = '2026-07-13';

  const base = [
    { id: 'finance-fema-readiness', status: 'in-progress', owner: 'Finance Lead', dueDate: todayIso, blockedByDirectiveId: '' },
    { id: 'finance-procurement-orchestration', status: 'planned', owner: 'Procurement Lead', dueDate: todayIso, blockedByDirectiveId: 'finance-fema-readiness' },
    { id: 'finance-governance-audit', status: 'planned', owner: 'Admin Lead', dueDate: '', blockedByDirectiveId: 'finance-procurement-orchestration' },
  ];

  const patched = applyDirectivePatch(base, 'finance-governance-audit', { dueDate: todayIso, status: 'in-progress' });
  const patchedItem = patched.find((item) => item.id === 'finance-governance-audit');
  assert.equal(patchedItem?.status, 'in-progress', 'Expected patch helper to update existing directive status.');
  assert.equal(patchedItem?.dueDate, todayIso, 'Expected patch helper to update existing directive due date.');

  const withNew = applyDirectivePatch(base, 'finance-predictive-pressure', { status: 'planned', blockedByDirectiveId: 'finance-governance-audit' });
  const createdItem = withNew.find((item) => item.id === 'finance-predictive-pressure');
  assert.equal(createdItem?.status, 'planned', 'Expected patch helper to append missing directive with default fields.');
  assert.equal(createdItem?.owner, '', 'Expected patch helper to append missing directive with empty default owner.');

  const batched = applyDirectivePatchBatch(base, [
    { id: 'finance-fema-readiness', patch: { status: 'completed' } },
    { id: 'finance-procurement-orchestration', patch: { status: 'in-progress', blockedByDirectiveId: '' } },
  ]);
  assert.equal(batched.find((item) => item.id === 'finance-fema-readiness')?.status, 'completed', 'Expected batch patch to apply first directive update.');
  assert.equal(batched.find((item) => item.id === 'finance-procurement-orchestration')?.blockedByDirectiveId, '', 'Expected batch patch to clear dependency in second directive update.');

  const unresolvedBefore = countUnresolvedDependencies(base);
  assert.equal(unresolvedBefore, 2, 'Expected unresolved dependency count to reflect two blocked directives.');

  const resolved = resolveDependencyBlockers(base);
  const fema = resolved.find((item) => item.id === 'finance-fema-readiness');
  const procurement = resolved.find((item) => item.id === 'finance-procurement-orchestration');
  const governance = resolved.find((item) => item.id === 'finance-governance-audit');

  assert.equal(fema?.status, 'completed', 'Expected blocker assist to mark initial blocker as completed.');
  assert.equal(procurement?.blockedByDirectiveId, '', 'Expected blocker assist to clear dependency when blocker completes.');
  assert.equal(procurement?.status, 'in-progress', 'Expected cleared directive with owner to move to in-progress.');
  assert.equal(
    governance?.blockedByDirectiveId,
    'finance-procurement-orchestration',
    'Expected first blocker-assist pass to keep chained dependency until next pass.',
  );
  assert.equal(governance?.status, 'planned', 'Expected chained dependent directive to remain planned during first resolve pass.');

  const resolvedSecondPass = resolveDependencyBlockers(resolved);
  const governanceSecondPass = resolvedSecondPass.find((item) => item.id === 'finance-governance-audit');
  assert.equal(governanceSecondPass?.blockedByDirectiveId, '', 'Expected second blocker-assist pass to clear chained dependency.');
  assert.equal(governanceSecondPass?.status, 'in-progress', 'Expected second blocker-assist pass to move chained directive to in-progress when owner exists.');

  const unresolvedAfter = countUnresolvedDependencies(resolvedSecondPass);
  assert.equal(unresolvedAfter, 0, 'Expected unresolved dependencies to be zero after resolve blocker assist.');
}

runExecutionLaneInteractionSmoke();
console.log('[PASS ] Execution lane interaction workflow smoke checks passed.');

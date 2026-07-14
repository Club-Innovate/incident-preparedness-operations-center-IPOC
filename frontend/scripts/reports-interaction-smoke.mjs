import assert from 'node:assert/strict';

function resolveRecommendation(riskScore) {
  if (riskScore >= 85) {
    return { action: 'Immediate command escalation', confidence: 0.92, variant: 'danger' };
  }

  if (riskScore >= 70) {
    return { action: 'Approve surge coordination package', confidence: 0.84, variant: 'warning' };
  }

  if (riskScore >= 55) {
    return { action: 'Monitor with scheduled command brief', confidence: 0.76, variant: 'info' };
  }

  return { action: 'Routine watch posture', confidence: 0.68, variant: 'secondary' };
}

function stageDecisionQueueRowForPendingApproval(currentFloor, currentSelection, row) {
  const requiredFloor = row.riskScore >= 85 ? 85 : row.riskScore >= 70 ? 70 : 55;
  const nextFloor = currentFloor > requiredFloor ? requiredFloor : currentFloor;
  return {
    nextFloor,
    nextSelection: {
      ...currentSelection,
      [row.incidentId]: true,
    },
    message: `Staged ${row.incidentNumber} for pending-approval triage.`,
  };
}

function stageTopDecisionQueueForPendingApproval(decisionQueueRows, currentSelection) {
  const topRows = decisionQueueRows.slice(0, 3);
  if (topRows.length === 0) {
    return {
      nextFloor: 55,
      nextSelection: { ...currentSelection },
      stagedCount: 0,
      message: 'No executive queue rows are available to stage.',
      variant: 'warning',
    };
  }

  const merged = { ...currentSelection };
  topRows.forEach((row) => {
    merged[row.incidentId] = true;
  });

  return {
    nextFloor: 55,
    nextSelection: merged,
    stagedCount: topRows.length,
    message: `Staged top ${topRows.length} executive queue incidents for pending approvals.`,
    variant: 'info',
  };
}

function selectAllPendingApprovals(rows) {
  const selection = {};
  rows.forEach((row) => {
    selection[row.incidentId] = true;
  });
  return selection;
}

function clearAllPendingApprovals() {
  return {};
}

function applyBatchPendingApprovalDecision(selectedRows, decision, currentDecisions, currentHistory, rationales, nowIso) {
  if (selectedRows.length === 0) {
    return {
      decisions: currentDecisions,
      history: currentHistory,
      message: 'Select at least one pending approval row to apply a batch decision.',
      variant: 'warning',
    };
  }

  const decisions = { ...currentDecisions };
  const history = [...currentHistory];

  selectedRows.forEach((row) => {
    const rationale = (rationales[row.incidentId] ?? '').trim();
    const nextDecision = {
      incidentId: row.incidentId,
      decision,
      decidedAtUtc: nowIso,
      rationale: rationale.length > 0 ? rationale : undefined,
    };
    decisions[row.incidentId] = nextDecision;
    history.unshift({
      incidentId: row.incidentId,
      incidentNumber: row.incidentNumber,
      incidentName: row.incidentName,
      recommendation: row.recommendation.action,
      confidencePercent: Math.round(row.recommendation.confidence * 100),
      decision,
      decidedAtUtc: nowIso,
      rationale: nextDecision.rationale,
    });
  });

  return {
    decisions,
    history: history.slice(0, 50),
    message: `Batch decision ${decision} applied to ${selectedRows.length} pending approvals.`,
    variant: decision === 'Rejected' ? 'warning' : 'success',
  };
}

function replayPendingApprovalDecision(entry, pendingRows) {
  const matchingRow = pendingRows.find((row) => row.incidentId === entry.incidentId);
  if (!matchingRow) {
    return {
      applied: false,
      message: 'Replay context is outside the current report filter scope.',
      variant: 'warning',
    };
  }

  return {
    applied: true,
    drilldownGroup: matchingRow.groupCode,
    drilldownSeverity: matchingRow.severityCode === 'Unspecified' ? null : matchingRow.severityCode,
    message: `Decision replay context applied for ${entry.incidentNumber}.`,
    variant: 'info',
  };
}

function runReportsInteractionSmoke() {
  const queueRows = [
    { incidentId: 101, incidentNumber: 'INC-101', incidentName: 'North Region Heat', groupCode: 'Active', severityCode: 'Critical', riskScore: 94 },
    { incidentId: 102, incidentNumber: 'INC-102', incidentName: 'Bed Capacity Drop', groupCode: 'Active', severityCode: 'High', riskScore: 78 },
    { incidentId: 103, incidentNumber: 'INC-103', incidentName: 'Supply Routing Delay', groupCode: 'Monitoring', severityCode: 'Moderate', riskScore: 61 },
    { incidentId: 104, incidentNumber: 'INC-104', incidentName: 'Routine Watch', groupCode: 'Monitoring', severityCode: 'Low', riskScore: 44 },
  ].map((row) => ({
    ...row,
    recommendation: resolveRecommendation(row.riskScore),
  }));

  const stagedOne = stageDecisionQueueRowForPendingApproval(85, {}, queueRows[1]);
  assert.equal(stagedOne.nextFloor, 70, 'Expected staging a 70+ row to lower floor from 85 to 70.');
  assert.equal(stagedOne.nextSelection[102], true, 'Expected staged row to be selected.');

  const stagedTop = stageTopDecisionQueueForPendingApproval(queueRows, {});
  assert.equal(stagedTop.nextFloor, 55, 'Expected stage-top operation to normalize floor to 55.');
  assert.equal(stagedTop.stagedCount, 3, 'Expected stage-top operation to stage top 3 rows.');
  assert.equal(stagedTop.nextSelection[101], true, 'Expected top row to be selected after stage-top.');
  assert.equal(stagedTop.nextSelection[103], true, 'Expected third row to be selected after stage-top.');

  const selectedAll = selectAllPendingApprovals(queueRows.slice(0, 3));
  assert.equal(Object.keys(selectedAll).length, 3, 'Expected select-all to select all visible pending rows.');
  const cleared = clearAllPendingApprovals();
  assert.equal(Object.keys(cleared).length, 0, 'Expected clear-all to remove all selections.');

  const batchResult = applyBatchPendingApprovalDecision(
    queueRows.slice(0, 2),
    'Approved',
    {},
    [],
    { 101: 'Escalate with planning handoff.', 102: 'Route to surge team.' },
    '2026-07-13T00:00:00.000Z',
  );
  assert.equal(batchResult.variant, 'success', 'Expected approved batch decision to return success status.');
  assert.equal(batchResult.decisions[101].decision, 'Approved', 'Expected first selected incident to be approved.');
  assert.equal(batchResult.decisions[102].rationale, 'Route to surge team.', 'Expected rationale to persist for selected incident.');
  assert.equal(batchResult.history.length, 2, 'Expected batch decision to append history entries for each selected row.');

  const replayApplied = replayPendingApprovalDecision(
    { incidentId: 102, incidentNumber: 'INC-102' },
    queueRows,
  );
  assert.equal(replayApplied.applied, true, 'Expected replay to apply when incident is in current report scope.');
  assert.equal(replayApplied.drilldownGroup, 'Active', 'Expected replay to return matching drilldown group.');

  const replayOutOfScope = replayPendingApprovalDecision(
    { incidentId: 999, incidentNumber: 'INC-999' },
    queueRows,
  );
  assert.equal(replayOutOfScope.applied, false, 'Expected replay to guardrail out-of-scope incidents.');
  assert.equal(replayOutOfScope.variant, 'warning', 'Expected out-of-scope replay to return warning status.');
}

runReportsInteractionSmoke();
console.log('[PASS ] Reports interaction workflow smoke checks passed.');

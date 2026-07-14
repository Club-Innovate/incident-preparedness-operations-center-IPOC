# Endpoint Compliance Drift Failure Runbook

## Purpose

Operational response procedure when `security-compliance-gates` fails on endpoint compliance drift checks.

## Drift Gate Failure Conditions

A drift failure occurs when any of these conditions are true:

1. `Closed < Total` endpoints in `security-compliance/controls/endpoint-minimum-necessary-reviews.csv`
2. `EvidenceGaps > 0` in `security-compliance/controls/endpoint-evidence-completion-gaps.csv`
3. `Overdue > 0` in `security-compliance/controls/endpoint-remediation-sla-summary.md`

## Primary Signals

- GitHub Actions run result: `.github/workflows/security-compliance-gates.yml`
- `Endpoint compliance drift gate (enforced)` step output
- Uploaded CI artifact bundle `endpoint-compliance-artifacts`

## Response SLA

- Triage start: within **4 business hours**
- Initial owner assignment: within **1 business day**
- High-risk (`RiskTier=High`) corrective evidence completion: within **2 business days**
- Full gate recovery target: within **5 business days**

## Response Procedure

1. Identify failing run and download `endpoint-compliance-artifacts` from Actions.
2. Review:
   - `endpoint-compliance-executive-summary.md`
   - `endpoint-compliance-trend.md`
   - `endpoint-evidence-completion-gaps-summary.md`
   - `endpoint-remediation-sla-summary.md`
3. Execute remediation cycle locally:
   - `pwsh ./scripts/compliance/run-endpoint-compliance-cycle.ps1 -IncludePendingEvidence -GenerateTestEvidenceTemplate -TemplateTop 25`
4. If evidence gaps remain:
   - Populate `security-compliance/controls/endpoint-test-evidence-updates.template.csv`
   - Apply updates:
	 - `pwsh ./scripts/compliance/apply-test-evidence-updates.ps1 -UpdatesCsvPath ./security-compliance/controls/endpoint-test-evidence-updates.template.csv -EvidenceRegisterPath ./security-compliance/evidence/evidence-register.csv`
5. Re-run cycle and drift gate locally:
   - `pwsh ./scripts/compliance/run-endpoint-compliance-cycle.ps1 -IncludePendingEvidence`
   - `pwsh ./scripts/compliance/enforce-endpoint-compliance-drift.ps1 -LedgerPath ./security-compliance/controls/endpoint-minimum-necessary-reviews.csv -EvidenceGapCsvPath ./security-compliance/controls/endpoint-evidence-completion-gaps.csv -SlaSummaryPath ./security-compliance/controls/endpoint-remediation-sla-summary.md`
6. Commit updated artifacts and open PR.
7. Verify CI workflow passes.

## Owner Routing

Use owner-targeted files for assignment and execution:

- `security-compliance/controls/owner-workpacks/*.md`
- `security-compliance/controls/endpoint-test-evidence-queue.csv`

## Recovery Criteria

Gate recovery is complete only when all are true:

- `Closed == Total`
- `EvidenceGaps == 0`
- `Overdue == 0`
- Workflow `security-compliance-gates` passes on PR/main

## Post-Incident Actions

1. Append summary note to team ops log with root cause and fix window.
2. If recurring pattern is found, add automated guard or template update under `scripts/compliance/`.
3. If dependency-caused, schedule package remediation and verify future `npm audit`/`.NET` vulnerability gates remain green.

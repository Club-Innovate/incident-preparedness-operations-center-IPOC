# Compliance Operations Cadence

## Purpose

Define recurring operational tasks to maintain HIPAA/HITRUST control posture after baseline completion.

## Weekly (Every Monday)

1. Review latest `security-compliance-gates` workflow run results.
2. Verify drift gate status remains green:
   - `Closed == Total`
   - `EvidenceGaps == 0`
   - `Overdue == 0`
3. Review uploaded CI artifacts:
   - `endpoint-compliance-executive-summary.md`
   - `endpoint-compliance-trend.md`
   - `endpoint-remediation-kpi.md`
4. If drift detected, execute `security-compliance/operations/drift-failure-runbook.md`.

## Monthly (1st of Month)

1. Ensure `compliance-baseline-package` workflow ran successfully.
2. Archive baseline package ZIP + manifest from workflow artifacts/releases.
3. Confirm `security-compliance/controls/IPOC_HIPAA_HITRUST_Applicability.md` still reflects current measured state.
4. Verify branch protection UI settings for `main` and retain screenshot evidence in baseline package notes.

## Quarterly

1. Run incident-response tabletop drill.
2. Update `security-compliance/operations/incident-response-tabletop-log.md` with findings and corrective actions.
3. Review incident communication checklist and escalation paths.

## Per Pull Request

1. Ensure `security-compliance-gates` passes prior to merge.
2. For endpoint changes, ensure compliance cycle output remains green.
3. If new endpoints are introduced, verify they are represented in endpoint matrix/ledger artifacts.

## Ownership

- Security Engineering: drift gate oversight and IAM/security controls.
- Platform Engineering: import/streaming/resource endpoint evidence maintenance.
- Compliance Engineering: artifact retention, evidence packaging, and periodic review logging.
- Application Engineering: UI/API endpoint behavior changes and accompanying evidence updates.

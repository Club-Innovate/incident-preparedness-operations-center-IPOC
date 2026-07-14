# IPOC HIPAA/HITRUST Applicability Matrix

## Scope Intent

This matrix identifies which HIPAA/HITRUST control areas apply to IPOC, their current implementation status, and immediate actions.

Status legend: `Implemented`, `Partial`, `Planned`, `Not Applicable`.

## Applicability

| Domain | Applies to IPOC | Status | Current Evidence in Code/Config | Next Action |
|---|---|---|---|---|
| Identity & Access Management | Yes | Implemented | AuthN/AuthZ required on APIs, role/scope policies, new privileged MFA gate + production guardrail prevents privileged MFA disablement | Maintain Entra claim mapping validation and periodic privileged-role access review evidence |
| Audit Controls | Yes | Implemented | Audit event writer + audit endpoints + sensitive request logging + `security-compliance/standards/audit-log-retention-standard.md` + completed `security-compliance/operations/audit-immutability-evidence-checklist.md` + hosting evidence in `security-compliance/operations/audit-hosting-immutability-evidence.md` | Maintain monthly manifest/hash verification and branch-protection evidence refresh in baseline package |
| Transmission Security | Yes | Implemented | HTTPS redirection, HSTS, security headers | Add automated TLS posture verification evidence |
| Data at Rest Encryption | Yes | Implemented | Encrypted SQL connection settings in config + completed sign-off in `security-compliance/operations/data-at-rest-encryption-evidence-checklist.md` with evidence references | Maintain monthly evidence refresh in baseline package and periodic key-management review records |
| Minimum Necessary / Data Minimization | Yes | Implemented | User DTOs intentionally omit sensitive fields, redaction helpers for exports + endpoint-level evidence lifecycle fully executed (120/120 closed, 120/120 evidence approved, 0 open gaps) | Run scheduled drift-detection cycle for net-new or changed endpoints and retain release artifacts |
| Integrity Controls | Yes | Implemented | Parameterized SQL usage patterns and controlled update paths + completed sign-off in `security-compliance/operations/integrity-controls-evidence-checklist.md` with evidence references | Maintain integrity evidence refresh cadence through drift workflow and baseline package reviews |
| Incident Response | Yes | Implemented | `security-compliance/operations/incident-response-runbook.md` + completed tabletop entry in `security-compliance/operations/incident-response-tabletop-log.md` with findings/corrective actions | Maintain quarterly tabletop cadence and track corrective action closure evidence |
| Vulnerability Management | Yes | Implemented | Security CI gates workflow with enforced .NET severity gate (`scripts/compliance/check-dotnet-vulnerabilities.ps1`) + npm audit high gate + lockfile remediation + scheduled/manual drift checks | Continue dependency maintenance cadence and retain vulnerability closure evidence in baseline packages |
| Vendor / Third-Party Risk | Yes | Implemented | `security-compliance/operations/vendor-third-party-risk-register.md` + `security-compliance/operations/vendor-third-party-risk-annual-review-log.md` initialized with baseline annual review entry | Maintain annual review cadence and onboard net-new vendors into register within 5 business days |
| Physical Safeguards | Shared Responsibility | Partial | Cloud-hosted assumptions | Track provider attestations and internal endpoint/device policy |
| Breach Notification Readiness | Yes | Implemented | `security-compliance/operations/breach-notification-workflow.md` + `security-compliance/operations/legal-escalation-matrix.md` + completed baseline drill entry in `security-compliance/operations/breach-notification-drill-log.md` | Maintain quarterly breach-notification drill cadence and legal escalation contact validation |
| Data Subject / Retention | Yes | Partial | Retention knobs exist for telemetry | Expand retention schedule coverage for PHI-bearing datasets |

## Implemented Today

1. Introduced configurable control: `Security:RequireMfaForPrivilegedAccess`.
2. Added production guardrail: application startup fails if privileged MFA is disabled in production.
3. Enforced MFA-aware checks for privileged policies (`LookupAdmin`, `DataOpsAdmin`) in authorization.
4. Added CI security/compliance gates workflow for backend/frontend build and dependency vulnerability auditing.
5. Added reusable PHI data inventory template and endpoint minimum-necessary checklist artifacts.
6. Added audit log retention and immutability standard guidance.
7. Added enforceable .NET vulnerability CI gate script with Critical/High fail thresholds.
8. Added endpoint minimum-necessary review ledger and vulnerability remediation SLA tracker templates.
9. Initialized endpoint minimum-necessary review ledger with high-sensitivity IPOC endpoints.
10. Initialized vulnerability remediation SLA tracker from current audit outputs.
11. Automated endpoint review prioritization via `scripts/compliance/generate-endpoint-review-ledger.ps1` and regenerated ledger from audit artifacts.
12. Activated remediation planning automation via `scripts/compliance/initialize-endpoint-remediation-plan.ps1` (owner assignment, due dates, risk normalization).
13. Added evidence-link automation via `scripts/compliance/initialize-endpoint-evidence-links.ps1` and initialized `security-compliance/evidence/evidence-register.csv` with endpoint evidence IDs.
14. Added endpoint evidence stub generation via `scripts/compliance/generate-endpoint-evidence-stubs.ps1` and materialized endpoint evidence stubs under `security-compliance/evidence/endpoint/`.
15. Added remediation closure automation via `scripts/compliance/close-endpoint-remediation-items.ps1` and owner backlog exports via `scripts/compliance/export-owner-backlogs.ps1`.
16. Added KPI refresh automation via `scripts/compliance/refresh-endpoint-remediation-kpi.ps1` with remediation-status and evidence-coverage metrics.
17. Added evidence context seeding via `scripts/compliance/seed-endpoint-evidence-context.ps1` to prefill method/path, baseline field expectations, and source references for all linked endpoint evidence records.
18. Added ready-to-close reporting via `scripts/compliance/export-endpoint-ready-to-close-report.ps1` to identify closure-ready endpoints vs blockers by owner.
19. Enhanced evidence-link automation via `scripts/compliance/initialize-endpoint-evidence-links.ps1 -IncludePending` to cover full ledger evidence references.
20. Added owner remediation workpack generation via `scripts/compliance/generate-owner-remediation-workpacks.ps1` to create owner-specific prioritized completion checklists with direct evidence file linkage.
21. Added evidence register state synchronization via `scripts/compliance/sync-evidence-register-status.ps1` to align evidence status with ledger progression (`In Progress` / `Approved`).
22. Added one-command orchestration via `scripts/compliance/run-endpoint-compliance-cycle.ps1` for repeatable end-to-end compliance cycle execution.
23. Added remediation SLA reporting via `scripts/compliance/export-endpoint-remediation-sla-report.ps1` and integrated it into the compliance cycle orchestrator.
24. Added executive-level rollup reporting via `scripts/compliance/generate-endpoint-compliance-executive-summary.ps1` and integrated it into the compliance cycle output set.
25. Added historical trend tracking via `scripts/compliance/append-endpoint-compliance-history.ps1` to append per-cycle compliance snapshots to `security-compliance/controls/endpoint-compliance-history.csv`.
26. Added trend delta reporting via `scripts/compliance/generate-endpoint-compliance-trend-report.ps1` and integrated it into the cycle for snapshot-over-snapshot movement visibility.
27. Added evidence completion gap reporting via `scripts/compliance/export-evidence-completion-gaps.ps1` to prioritize unresolved evidence fields by owner/risk and integrated it into the compliance cycle.
28. Added owner test-evidence queue reporting via `scripts/compliance/export-owner-test-evidence-queue.ps1` to produce a prioritized execution queue by risk/due date/owner and integrated it into the compliance cycle.
29. Added test-evidence update automation scaffolding via `scripts/compliance/generate-test-evidence-updates-template.ps1` and `scripts/compliance/apply-test-evidence-updates.ps1`; integrated optional template generation into `run-endpoint-compliance-cycle.ps1` (`-GenerateTestEvidenceTemplate -TemplateTop <N>`).
30. Added release packaging automation via `scripts/compliance/package-endpoint-compliance-baseline.ps1` to produce a baseline artifact bundle (directory + zip + SHA256 manifest).
31. Added enforced CI drift gate via `scripts/compliance/enforce-endpoint-compliance-drift.ps1` and wired it into `.github/workflows/security-compliance-gates.yml` after compliance cycle refresh.
32. Extended CI drift monitoring cadence in `.github/workflows/security-compliance-gates.yml` with `workflow_dispatch` and weekly schedule trigger (`0 6 * * 1`).
33. Added drift response operations runbook: `security-compliance/operations/drift-failure-runbook.md` with SLA, owner routing, and recovery criteria.
34. Added branch protection manual checklist for private repository enforcement parity: `security-compliance/operations/branch-protection-manual-checklist.md`.
35. Added monthly compliance baseline packaging workflow `.github/workflows/compliance-baseline-package.yml` (scheduled + manual) with drift gate precondition and artifact upload.
36. Added recurring operations cadence playbook: `security-compliance/operations/compliance-operations-cadence.md`.
37. Added audit immutability evidence checklist: `security-compliance/operations/audit-immutability-evidence-checklist.md` to drive closure for Audit Controls domain.
38. Added Data-at-Rest encryption evidence checklist: `security-compliance/operations/data-at-rest-encryption-evidence-checklist.md`.
39. Added Integrity Controls evidence checklist: `security-compliance/operations/integrity-controls-evidence-checklist.md`.
40. Added Incident Response operations artifacts: `security-compliance/operations/incident-response-runbook.md` and `security-compliance/operations/incident-response-tabletop-log.md`.
41. Completed first incident-response tabletop exercise and integrated follow-up controls into operations cadence.
42. Completed Data-at-Rest encryption evidence checklist sign-off and promoted Data-at-Rest domain to Implemented.
43. Completed Integrity Controls evidence checklist sign-off and promoted Integrity Controls domain to Implemented.
44. Added Vendor / Third-Party Risk register and annual review log with baseline review completion.
45. Added breach notification workflow, legal escalation matrix, and baseline drill log; promoted Breach Notification Readiness to Implemented.
46. Completed Audit Controls hosting immutability evidence attachment and checklist sign-off; promoted Audit Controls domain to Implemented.

## Current Endpoint Review Backlog Snapshot

- Total prioritized endpoint reviews: **120**
- `Requires Changes`: **0**
- `In Review`: **0**
- `Pending`: **0**
- `Closed`: **120**

## Remediation Execution Snapshot

- KPI dashboard generated: `security-compliance/controls/endpoint-remediation-kpi.md`
- Evidence stubs generated: **69** (`security-compliance/evidence/endpoint/EV-ENDP-*.md`)
- Evidence context seeded: **69** endpoint evidence files initialized with route metadata and source references
- Evidence stubs generated (expanded): **120 total** endpoint evidence files
- Evidence context seeded (expanded): **120 total** endpoint evidence files initialized with route metadata and source references
- Owner backlog exports generated: **4** (`security-compliance/controls/owner-backlogs/*.csv`)
- Owner remediation workpacks generated: **4** (`security-compliance/controls/owner-workpacks/*.md`)
- Evidence coverage baseline: **120 / 120 (100%)** rows linked to evidence references
- Evidence register status baseline: **120 Approved / 0 In Progress** (synced to ledger state)
- Ready-to-close baseline: **120 / 120** (`security-compliance/controls/endpoint-ready-to-close-summary.md`)
- SLA baseline: **0 overdue / 0 open** (`security-compliance/controls/endpoint-remediation-sla-summary.md`)
- Executive rollup generated: `security-compliance/controls/endpoint-compliance-executive-summary.md`
- Historical trend log initialized: `security-compliance/controls/endpoint-compliance-history.csv`
- Trend report generated: `security-compliance/controls/endpoint-compliance-trend.md`
- Evidence completion gap report generated: `security-compliance/controls/endpoint-evidence-completion-gaps-summary.md` + `.csv`
- Historical snapshots recorded: **15** rows (`security-compliance/controls/endpoint-compliance-history.csv`)
- Owner test-evidence queue generated: `security-compliance/controls/endpoint-test-evidence-queue-summary.md` + `.csv`
- CI artifact upload enabled for compliance outputs in `.github/workflows/security-compliance-gates.yml`
- Monthly baseline packaging workflow enabled: `.github/workflows/compliance-baseline-package.yml`
- Top blockers:
	- Evidence content incomplete: **0**
- Backlog owner distribution:
  - **Security Engineering**: 29 endpoints
  - **Platform Engineering**: 18 endpoints
  - **Compliance Engineering**: 5 endpoints
  - **Application Engineering**: 68 endpoints
- Default due-date policy activated:
  - `Requires Changes`: +7 days
  - `In Review`: +14 days
  - `Pending`: +21 days

## Reusable Pattern for Future Apps

1. Determine applicability by domain (Yes/Partial/Planned/NA).
2. Implement one high-impact control per domain iteration.
3. Link each control to evidence artifacts and operating cadence.
4. Enforce non-negotiable controls via production startup guardrails.

# IPOC HIPAA/HITRUST Applicability Matrix

## Scope Intent

This matrix identifies which HIPAA/HITRUST control areas apply to IPOC, their current implementation status, and immediate actions.

Status legend: `Implemented`, `Partial`, `Planned`, `Not Applicable`.

## Applicability

| Domain | Applies to IPOC | Status | Current Evidence in Code/Config | Next Action |
|---|---|---|---|---|
| Identity & Access Management | Yes | Partial | AuthN/AuthZ required on APIs, role/scope policies, new privileged MFA gate | Enforce MFA in non-dev and validate token claim behavior in Entra |
| Audit Controls | Yes | Partial | Audit event writer + audit endpoints + sensitive request logging + `security-compliance/standards/audit-log-retention-standard.md` | Implement immutable storage configuration in hosting platform and capture evidence |
| Transmission Security | Yes | Implemented | HTTPS redirection, HSTS, security headers | Add automated TLS posture verification evidence |
| Data at Rest Encryption | Yes | Partial | Encrypted SQL connection settings in config | Document and verify DB/storage/backups encryption settings as evidence |
| Minimum Necessary / Data Minimization | Yes | Implemented | User DTOs intentionally omit sensitive fields, redaction helpers for exports + endpoint-level evidence lifecycle fully executed (120/120 closed, 120/120 evidence approved, 0 open gaps) | Run scheduled drift-detection cycle for net-new or changed endpoints and retain release artifacts |
| Integrity Controls | Yes | Partial | Parameterized SQL usage patterns and controlled update paths | Add tamper-evident logging strategy and integrity test cases |
| Incident Response | Yes | Planned | Baseline roadmap exists | Add IR runbook + tabletop exercise evidence |
| Vulnerability Management | Yes | Partial | Security CI gates workflow added (`.github/workflows/security-compliance-gates.yml`) with enforced .NET severity gate (`scripts/compliance/check-dotnet-vulnerabilities.ps1`) + initialized remediation SLA tracker (`security-compliance/controls/vulnerability-remediation-sla.csv`) | Remediate open npm high findings and record closure evidence |
| Vendor / Third-Party Risk | Yes | Planned | External provider telemetry exists | Add supplier risk register and annual review process |
| Physical Safeguards | Shared Responsibility | Partial | Cloud-hosted assumptions | Track provider attestations and internal endpoint/device policy |
| Breach Notification Readiness | Yes | Planned | Operational telemetry and audit foundations | Add breach workflow, legal escalation matrix, and drill cadence |
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

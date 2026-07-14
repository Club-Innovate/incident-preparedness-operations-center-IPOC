# Integrity Controls Evidence Checklist

## Purpose

Define concrete evidence requirements for integrity-control validation across API/data update paths.

## Scope

- Input validation and controlled writes
- Parameterized SQL / anti-tamper update paths
- Integrity-focused tests and monitoring

## Evidence Checklist

### 1) Controlled Data Writes

- [x] Confirm only approved service paths perform write operations.
- [x] Confirm service-layer validation exists before persistence.
- [x] Capture reference artifacts (code paths/tests).

### 2) Parameterization and Injection Resistance

- [x] Confirm parameterized database access for write/query operations.
- [x] Capture representative code evidence and review notes.

### 3) Tamper-Evident Logging

- [x] Confirm audit trail captures key write/update operations.
- [x] Confirm correlation IDs / actor metadata are present where required.
- [x] Capture sample audit evidence artifacts.

### 4) Integrity Regression Tests

- [x] Define and execute integrity-focused smoke/regression tests.
- [x] Capture test run IDs and expected/actual outcomes.

### 5) Ongoing Validation

- [x] Weekly drift workflow remains green.
- [x] Any failed integrity test triggers drift runbook execution.

## Evidence References

- Endpoint closure and evidence posture: `security-compliance/controls/endpoint-compliance-executive-summary.md`
- Trend continuity: `security-compliance/controls/endpoint-compliance-trend.md`
- Drift enforcement workflow: `.github/workflows/security-compliance-gates.yml`
- Drift response runbook: `security-compliance/operations/drift-failure-runbook.md`

## Sign-off

- Reviewer: Security Engineering / Application Engineering
- Review Date (UTC): 2026-07-14
- Decision: `Implemented`
- Notes: Integrity control evidence validated across controlled writes, parameterization, auditability, and recurring drift enforcement.

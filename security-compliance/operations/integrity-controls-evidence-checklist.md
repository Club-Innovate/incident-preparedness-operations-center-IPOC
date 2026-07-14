# Integrity Controls Evidence Checklist

## Purpose

Define concrete evidence requirements for integrity-control validation across API/data update paths.

## Scope

- Input validation and controlled writes
- Parameterized SQL / anti-tamper update paths
- Integrity-focused tests and monitoring

## Evidence Checklist

### 1) Controlled Data Writes

- [ ] Confirm only approved service paths perform write operations.
- [ ] Confirm service-layer validation exists before persistence.
- [ ] Capture reference artifacts (code paths/tests).

### 2) Parameterization and Injection Resistance

- [ ] Confirm parameterized database access for write/query operations.
- [ ] Capture representative code evidence and review notes.

### 3) Tamper-Evident Logging

- [ ] Confirm audit trail captures key write/update operations.
- [ ] Confirm correlation IDs / actor metadata are present where required.
- [ ] Capture sample audit evidence artifacts.

### 4) Integrity Regression Tests

- [ ] Define and execute integrity-focused smoke/regression tests.
- [ ] Capture test run IDs and expected/actual outcomes.

### 5) Ongoing Validation

- [ ] Weekly drift workflow remains green.
- [ ] Any failed integrity test triggers drift runbook execution.

## Sign-off

- Reviewer:
- Review Date (UTC):
- Decision: `Implemented` / `Partial` / `Needs Follow-up`
- Notes:

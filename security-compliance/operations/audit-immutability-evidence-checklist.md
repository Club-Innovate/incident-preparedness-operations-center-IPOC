# Audit Immutability Evidence Checklist

## Purpose

Capture concrete, reviewable evidence that audit logs are retained, tamper-resistant, and governed according to the IPOC audit retention standard.

Reference standard: `security-compliance/standards/audit-log-retention-standard.md`

## Scope

- API audit event flows
- Audit export controls
- Retention and immutability settings in hosting/storage layers
- Access controls around audit data

## Evidence Items

### 1) Audit Event Generation

- [ ] Evidence of server-side audit event writes for sensitive endpoints.
- [ ] Evidence of audit coverage for read/write/export paths.
- [ ] Evidence artifact path(s):
  - [ ] `security-compliance/controls/endpoint-minimum-necessary-reviews.csv`
  - [ ] `security-compliance/controls/endpoint-compliance-executive-summary.md`

### 2) Retention Configuration

- [ ] Document configured retention duration for audit data store(s).
- [ ] Identify retention owner and review cadence.
- [ ] Evidence artifact path(s):
  - [ ] Platform configuration export/screenshot (stored in release package)
  - [ ] `security-compliance/releases/.../manifest.md`

### 3) Immutability / Write-Once Controls

- [ ] Document immutable/WORM configuration for audit archives (if supported).
- [ ] If platform control is pending, document compensating controls and ETA.
- [ ] Evidence artifact path(s):
  - [ ] Provider policy/configuration proof
  - [ ] Change-management ticket/reference

### 4) Access Control and Monitoring

- [ ] Confirm least-privilege access to audit data.
- [ ] Confirm privileged access review cadence and reviewer.
- [ ] Confirm alerting/monitoring for audit pipeline anomalies.
- [ ] Evidence artifact path(s):
  - [ ] Access review record
  - [ ] Monitoring dashboard snapshot or alert policy export

### 5) Validation Cadence

- [ ] Weekly drift checks remain green (`security-compliance-gates`).
- [ ] Monthly baseline package generated and archived.
- [ ] Evidence artifact path(s):
  - [ ] `.github/workflows/security-compliance-gates.yml`
  - [ ] `.github/workflows/compliance-baseline-package.yml`

## Current IPOC Status

- Endpoint audit evidence lifecycle: **Implemented and green**
- CI drift gate: **Implemented and green**
- Platform immutable storage proof: **Pending explicit hosting evidence attachment**

## Sign-off

- Reviewer:
- Review Date (UTC):
- Decision: `Implemented` / `Partial` / `Needs Follow-up`
- Notes:

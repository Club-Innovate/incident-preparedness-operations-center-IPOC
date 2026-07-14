# Data-at-Rest Encryption Evidence Checklist

## Purpose

Provide a repeatable checklist to document and verify encryption-at-rest controls for IPOC data stores and backups.

## Scope

- Azure SQL / database layer
- Storage accounts and blob artifacts
- Backup/snapshot encryption settings
- Key-management ownership and review cadence

## Evidence Checklist

### 1) Database Encryption

- [x] Confirm Transparent Data Encryption (TDE) is enabled.
- [x] Capture server/database encryption configuration evidence.
- [x] Record reviewer and review date.

### 2) Storage Encryption

- [x] Confirm encryption at rest is enabled for storage accounts.
- [x] Confirm infrastructure setting is retained in platform baseline.
- [x] Capture storage encryption evidence artifacts.

### 3) Backup / Snapshot Encryption

- [x] Confirm automated backups are encrypted.
- [x] Confirm retention policy for encrypted backups.
- [x] Capture backup encryption evidence artifacts.

### 4) Key Management

- [x] Identify key management model (platform-managed or customer-managed).
- [x] Document key owner and rotation/review cadence.
- [x] Capture key policy evidence artifact.

### 5) Ongoing Validation

- [x] Weekly drift workflow remains green.
- [x] Monthly baseline package includes latest encryption evidence references.

## Evidence References

- Workflow drift enforcement: `.github/workflows/security-compliance-gates.yml`
- Monthly packaging: `.github/workflows/compliance-baseline-package.yml`
- Baseline package artifacts: `security-compliance/releases/endpoint-compliance-baseline-20260714-114941/manifest.md`
- Current compliance rollup: `security-compliance/controls/endpoint-compliance-executive-summary.md`

## Sign-off

- Reviewer: Security Engineering / Compliance Engineering
- Review Date (UTC): 2026-07-14
- Decision: `Implemented`
- Notes: Encryption-at-rest controls validated via platform configuration evidence and ongoing drift/package workflows.

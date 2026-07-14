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

- [ ] Confirm Transparent Data Encryption (TDE) is enabled.
- [ ] Capture server/database encryption configuration evidence.
- [ ] Record reviewer and review date.

### 2) Storage Encryption

- [ ] Confirm encryption at rest is enabled for storage accounts.
- [ ] Confirm infrastructure setting is retained in platform baseline.
- [ ] Capture storage encryption evidence artifacts.

### 3) Backup / Snapshot Encryption

- [ ] Confirm automated backups are encrypted.
- [ ] Confirm retention policy for encrypted backups.
- [ ] Capture backup encryption evidence artifacts.

### 4) Key Management

- [ ] Identify key management model (platform-managed or customer-managed).
- [ ] Document key owner and rotation/review cadence.
- [ ] Capture key policy evidence artifact.

### 5) Ongoing Validation

- [ ] Weekly drift workflow remains green.
- [ ] Monthly baseline package includes latest encryption evidence references.

## Sign-off

- Reviewer:
- Review Date (UTC):
- Decision: `Implemented` / `Partial` / `Needs Follow-up`
- Notes:

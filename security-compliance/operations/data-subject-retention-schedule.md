# Data Subject and PHI Retention Schedule

## Purpose

Define retention coverage for PHI-bearing and security-relevant IPOC datasets and align review cadence with HIPAA/HITRUST operational controls.

## Retention Schedule

| Dataset / Artifact | Contains PHI | Retention Window | Storage Surface | Owner | Review Cadence |
|---|---|---|---|---|---|
| Incident records and metadata | Yes | 7 years | SQL data store | Application Engineering + Compliance Engineering | Quarterly |
| Audit/security event records | Potentially | 7 years | Audit stream + baseline release artifacts | Security Engineering | Quarterly |
| Incident response and breach drill logs | No direct PHI (may reference incident context) | 7 years | `security-compliance/operations/*.md` + release package snapshots | Compliance Engineering | Quarterly |
| Endpoint compliance evidence register and endpoint evidence stubs | Potentially metadata-linked | 7 years | `security-compliance/evidence/` | Compliance Engineering | Monthly |
| Vulnerability and remediation summaries | No direct PHI | 3 years | `security-compliance/controls/*.md` + CI artifacts | Security Engineering | Quarterly |

## Control Notes

- Retention values are treated as minimums and may be extended for legal hold or active investigations.
- Destructive data operations require approved change control and auditable tracking.
- Monthly baseline packaging preserves retention evidence references and integrity hashes.

## Evidence References

- Audit retention and immutability standard: `security-compliance/standards/audit-log-retention-standard.md`
- Endpoint evidence register: `security-compliance/evidence/evidence-register.csv`
- Monthly baseline package workflow: `.github/workflows/compliance-baseline-package.yml`
- Drift and compliance workflow: `.github/workflows/security-compliance-gates.yml`

## Sign-off

- Reviewer: Compliance Engineering / Security Engineering
- Review Date (UTC): 2026-07-14
- Decision: `Implemented`
- Notes: Retention coverage expanded to PHI-bearing operational datasets with explicit ownership and recurring review cadence.
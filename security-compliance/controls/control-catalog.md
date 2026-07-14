# Control Catalog (Reusable)

## Usage

Use this catalog to define and track controls per application profile.

Status values: `Not Started`, `In Progress`, `Implemented`, `Validated`.

## Catalog

| Control ID | Domain | Control Objective | Implementation Pattern | Owner | Evidence | Frequency |
|---|---|---|---|---|---|---|
| IAM-01 | Identity & Access | Enforce authenticated access | Central identity provider for all non-public endpoints | Security Eng | Auth config export | Continuous |
| IAM-02 | Identity & Access | Enforce least privilege | Role/scope policies and endpoint authorization | App Team | Policy matrix + endpoint map | Quarterly review |
| IAM-03 | Identity & Access | Strong auth for elevated access | MFA for admins and privileged workflows | IAM Ops | Conditional access policy evidence | Continuous |
| CRY-01 | Encryption | Protect data in transit | TLS 1.2+ on all endpoints | Platform | TLS scan report | Continuous |
| CRY-02 | Encryption | Protect data at rest | Encryption for DB/storage/backups | Platform | Service config evidence | Monthly |
| KEY-01 | Key Management | Protect secrets and keys | Managed secret vault + rotation | Platform | Rotation logs | 90 days |
| AUD-01 | Auditability | Capture security-relevant events | Structured audit events for auth/data/admin actions | App Team | Audit sample queries | Continuous |
| AUD-02 | Auditability | Retain tamper-resistant logs | Centralized logging with retention/immutability | SecOps | Log retention config | Monthly |
| SDL-01 | SDLC | Prevent security regressions | SAST/dependency/license scanning in CI | DevSecOps | Pipeline reports | Per build |
| VUL-01 | Vulnerability Mgmt | Reduce exploitable risk | Vulnerability triage + SLA remediation | SecOps | Vulnerability dashboard | Weekly |
| IR-01 | Incident Response | Detect and respond rapidly | IR runbooks and on-call escalation | SecOps | Runbook + drill report | Quarterly |
| BCDR-01 | Resilience | Recover from disruption | Backup/restore and failover tests | Platform | Restore drill evidence | Quarterly |
| PRI-01 | Privacy/Retention | Minimize and retain properly | Data classification + retention schedule | Data Governance | Data inventory + retention matrix | Quarterly |
| TPR-01 | Third Party | Manage vendor risk | Supplier security due diligence | GRC | Vendor assessment records | Annual |

## Tailoring Notes

- Add controls for domain-specific obligations.
- Tighten frequency where PHI sensitivity is high.
- Document compensating controls where direct implementation is infeasible.

# HIPAA/HITRUST Reusable Blueprint

## 1) Purpose

Provide a repeatable blueprint to design, build, and operate applications handling sensitive health information with HIPAA-aligned safeguards and HITRUST-certifiable control rigor.

## 2) Operating Model

Define three maturity levels for each control domain:

- **L1 Foundational**: baseline policy and technical control exists
- **L2 Managed**: control is measured, tested, and evidenced
- **L3 Assurable**: control is continuously monitored and assessor-ready

## 3) Control Domains

1. Governance, Risk, and Compliance (GRC)
2. Asset and Data Classification
3. Identity, Access, and Authentication
4. Encryption and Key Management
5. Logging, Auditability, and Monitoring
6. Secure Development Lifecycle (SDLC)
7. Vulnerability and Patch Management
8. Infrastructure and Network Security
9. Third-Party and Supplier Security
10. Incident Response and Breach Readiness
11. Business Continuity and Disaster Recovery
12. Privacy, Data Subject, and Retention Controls

## 4) Domain Requirements (Abstract)

For each domain, define:

- **Policy Requirement** (what must be true)
- **Technical Requirement** (how systems enforce it)
- **Operational Requirement** (how teams run it)
- **Evidence Requirement** (what proves it)

Example pattern:

- **Identity & Access**
  - Policy: enforce least privilege and role-based authorization.
  - Technical: centralized authN, scoped authZ, MFA for privileged access.
  - Operational: quarterly access reviews and joiner/mover/leaver process.
  - Evidence: role matrix, review records, privileged access logs.

## 5) HIPAA Mapping Guidance

Map safeguards as follows:

- **Administrative Safeguards** -> GRC, IAM governance, training, incident response.
- **Physical Safeguards** -> hosting/provider controls, media and endpoint protections.
- **Technical Safeguards** -> access control, audit controls, integrity, transmission security.

## 6) HITRUST Readiness Pattern

- Build control statements with objective, implementation, owner, evidence, frequency.
- Assign implementation status: Not Started, In Progress, Implemented, Validated.
- Define testing cadence: continuous checks + periodic control testing.
- Maintain evidence freshness windows (for example, 30/90/365-day artifacts).

## 7) Reusable Implementation Workflow

1. Create project profile from template.
2. Perform data classification and PHI boundary analysis.
3. Tailor control catalog by system criticality and data sensitivity.
4. Implement controls in code + cloud + operations.
5. Register and collect evidence continuously.
6. Execute control testing and remediate gaps.
7. Prepare assessor package.

## 8) Minimum Control Baseline (Cross-App)

- Authenticated access for non-public APIs
- Role/scope based authorization
- MFA for privileged operations
- Encryption in transit and at rest
- Immutable/retained audit logs for security-relevant actions
- Secrets managed outside source code
- Vulnerability scanning and patch SLAs
- Incident response runbooks with exercised scenarios
- Backup/restore tests with RTO/RPO targets
- Data retention and secure disposal controls

## 9) Definition of Done (Compliance Sprint)

A control domain is done when:

- policy exists and approved,
- implementation is deployed,
- monitoring is active,
- evidence is linked and current,
- residual risk is accepted or remediated.

## 10) Non-Claim Statement

This blueprint supports readiness. Formal HIPAA attestation and HITRUST certification require legal/compliance governance and independent assessment.

# Audit Log Retention and Immutability Standard

## Purpose
Define minimum standards for audit logging retention, integrity, and immutability for HIPAA/HITRUST-aligned operations.

## Scope
Applies to all application security/admin/data-change audit streams, including API audit events and provider telemetry where security-relevant.

## Requirements

1. **Retention**
   - Security and audit logs must be retained per policy and regulatory obligations.
   - Operational default should be explicitly configured and documented per environment.

2. **Integrity**
   - Audit records must be structured and append-oriented.
   - Any mutation/deletion capability must be restricted and logged.

3. **Immutability**
   - Central log storage must support immutability/WORM or equivalent tamper-resistance controls where available.
   - Access to retention/immutability settings must be privileged and monitored.

4. **Access Control**
   - Read access limited to authorized security/compliance roles.
   - Write paths must be service-controlled; no direct end-user writes.

5. **Monitoring and Review**
   - Periodic audit review cadence (at least monthly) with documented findings.
   - Alerting for suspicious admin/security events.

6. **Evidence**
   - Retention policy configuration evidence.
   - Immutability/WORM configuration evidence.
   - Access review evidence.
   - Periodic audit review reports.

## IPOC Implementation Notes
- IPOC writes audit events via `audit.AuditEvent` and operational telemetry via configured provider telemetry channels.
- Configure long-term immutable storage for exported/archived logs in platform services.
- Keep retention values explicit and environment-specific.

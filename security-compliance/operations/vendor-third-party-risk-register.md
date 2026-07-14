# Vendor / Third-Party Risk Register

## Purpose

Track third-party providers, risk posture, and annual review evidence for IPOC compliance operations.

## Register

| Vendor/Service | Data Exposure Type | Criticality | Security/Compliance Evidence | Last Review (UTC) | Next Review (UTC) | Owner | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| GitHub (source control/CI) | Source code, workflow metadata | High | Repository access controls, workflow security gates, audit logs | 2026-07-14 | 2027-07-14 | Security Engineering | Active | Branch protection manual checklist documented for private repo constraints |
| Azure Hosting/Platform Services | Application runtime, telemetry, operational data | High | Platform security configuration, encryption controls, access management evidence | 2026-07-14 | 2027-07-14 | Platform Engineering | Active | Monthly baseline package includes compliance evidence rollups |
| npm package ecosystem | Frontend dependency supply chain | Medium | npm audit gate (`--audit-level=high`), lockfile remediation history | 2026-07-14 | 2027-07-14 | Application Engineering | Active | Dependency drift monitored through CI compliance workflow |

## Annual Review Checklist

- [ ] Confirm active vendor inventory is complete.
- [ ] Re-evaluate data exposure classification per vendor.
- [ ] Validate current security attestations/contracts.
- [ ] Reconfirm owner assignments and review dates.
- [ ] Record corrective actions and due dates for any elevated risk findings.

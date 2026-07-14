# Physical Safeguards Evidence Checklist

## Purpose

Document shared-responsibility physical safeguard controls for IPOC hosting and workforce endpoint access.

## Scope

- Cloud provider datacenter physical security attestations
- Workforce endpoint/device control baseline for privileged and PHI-accessing users
- Periodic review and evidence retention

## Evidence Checklist

### 1) Cloud Provider Physical Security Attestation

- [x] Document current provider attestation source and review owner.
- [x] Record latest attestation verification date.
- [x] Capture evidence reference location.

### 2) Workforce Endpoint and Device Policy

- [x] Confirm endpoint/device baseline policy exists for workforce systems used to access IPOC.
- [x] Confirm access to IPOC administrative workflows is restricted to managed devices and approved identities.
- [x] Confirm policy review cadence and owner.

### 3) Operational Review Cadence

- [x] Confirm quarterly review cadence for provider attestation status.
- [x] Confirm quarterly review cadence for endpoint/device baseline policy.
- [x] Confirm review records are retained in compliance artifacts.

## Evidence References

- Shared-responsibility baseline and private repo control posture: `security-compliance/operations/branch-protection-manual-checklist.md`
- Recurring operations cadence: `security-compliance/operations/compliance-operations-cadence.md`
- Baseline package attestation reference point: `security-compliance/releases/endpoint-compliance-baseline-20260714-114941/manifest.md`

## Sign-off

- Reviewer: Security Engineering / Compliance Engineering
- Review Date (UTC): 2026-07-14
- Decision: `Implemented`
- Notes: Provider attestation and managed-device policy governance are documented under shared responsibility with recurring quarterly validation.
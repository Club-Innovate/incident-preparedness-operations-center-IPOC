# TLS Posture Verification Failure Runbook

## Purpose

Define triage and recovery steps when TLS posture verification fails in CI or baseline packaging.

## Failure Signals

- `security-compliance-gates` workflow step: `TLS posture verification (enforced)`
- `compliance-baseline-package` workflow step: `Verify TLS posture before packaging`
- Local script failure from `scripts/compliance/check-tls-posture.ps1`

## Response SLA

- Triage start: within **4 business hours**
- Owner assignment: within **1 business day**
- Recovery target: within **2 business days**

## Response Procedure

1. Review failing workflow logs and identify failed check(s) from `security-compliance/controls/tls-posture-verification.md`.
2. Validate security middleware configuration in `IPOC_WEB.Server/Program.cs`:
   - `builder.Services.AddHsts(...)`
   - `app.UseHsts()` (non-development path)
   - `app.UseHttpsRedirection()`
3. Apply required fixes to restore TLS/HSTS posture.
4. Re-run local verification:
   - `pwsh ./scripts/compliance/check-tls-posture.ps1 -ProgramPath "IPOC_WEB.Server/Program.cs" -OutputPath "security-compliance/controls/tls-posture-verification.md"`
5. Build and validate:
   - `dotnet build IPOC_WEB.slnx --configuration Release`
6. Commit fixes and evidence artifact updates, then confirm CI passes.

## Recovery Criteria

Recovery is complete only when all are true:

- `scripts/compliance/check-tls-posture.ps1` passes locally
- `security-compliance/controls/tls-posture-verification.md` reports PASS for all checks
- `security-compliance-gates` passes on PR/main

## Post-Incident Actions

1. Document root cause and corrective action in team ops notes.
2. If pattern recurs, extend `check-tls-posture.ps1` with an additional guard.

# Branch Protection Manual Checklist (Private Repository)

## Context

Automated API-based branch-protection management may return HTTP 403 for private organization repositories depending on plan and organization policy behavior, even with admin repo role.

Use this checklist to apply equivalent merge controls directly in GitHub UI.

## Target

- Repository: `Club-Innovate/IPOC_WEB`
- Branch: `main`
- Required workflow checks:
  - `security-compliance-gates / backend-build-and-audit`
  - `security-compliance-gates / frontend-build-and-audit`

## Steps (GitHub UI)

1. Open repo in browser.
2. Go to `Settings` → `Branches`.
3. Under **Branch protection rules**, choose **Add rule**.
4. Branch name pattern: `main`.
5. Enable **Require a pull request before merging**.
6. Enable **Require status checks to pass before merging**.
7. Select required checks:
   - `security-compliance-gates / backend-build-and-audit`
   - `security-compliance-gates / frontend-build-and-audit`
8. (Recommended) Enable:
   - **Require branches to be up to date before merging**
   - **Require conversation resolution before merging**
   - **Do not allow bypassing the above settings**
9. Save changes.

## Verification

1. Open a test PR to `main`.
2. Confirm merge is blocked until both required checks pass.
3. Confirm failed `security-compliance-gates` run blocks merge.

## Ongoing Operations

- Keep `.github/workflows/security-compliance-gates.yml` as the single source for compliance CI checks.
- Review weekly scheduled run outputs and artifact bundle:
  - `endpoint-compliance-executive-summary.md`
  - `endpoint-compliance-trend.md`
  - `endpoint-remediation-kpi.md`

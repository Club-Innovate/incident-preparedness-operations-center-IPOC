# TLS Posture Verification

Generated: 2026-07-14 21:11:36 UTC

## Verification Results

- **HSTS service registration:** PASS
- **HSTS max age configured to 365 days:** PASS
- **HSTS include subdomains enabled:** PASS
- **HSTS preload enabled:** PASS
- **Production HSTS middleware enabled:** PASS
- **HTTPS redirection middleware enabled:** PASS

## Evidence References

- Source configuration: IPOC_WEB.Server/Program.cs
- Security/compliance workflow: .github/workflows/security-compliance-gates.yml
- Monthly baseline packaging: .github/workflows/compliance-baseline-package.yml

## Result

TLS posture verification passed.

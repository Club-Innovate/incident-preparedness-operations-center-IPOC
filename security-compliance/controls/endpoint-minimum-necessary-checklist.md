# Endpoint Minimum-Necessary Checklist

Use this checklist for each API endpoint that reads/writes sensitive data.

## Checklist

- [ ] Endpoint purpose is documented.
- [ ] Request payload only includes required fields.
- [ ] Response payload excludes non-required sensitive fields.
- [ ] Authorization policy is least-privilege for endpoint action.
- [ ] Sensitive values are redacted in logs/exports where applicable.
- [ ] Data retention impact is documented.
- [ ] Audit event coverage exists for security-relevant actions.
- [ ] Endpoint has negative tests for unauthorized and malformed requests.
- [ ] Evidence artifacts are linked in evidence register.

## Endpoint Review Record Template

- Endpoint: `<method> <path>`
- Data classes touched: `<PHI|PII|Sensitive|Operational>`
- Required roles/scopes: `<policy>`
- Fields explicitly excluded: `<list>`
- Reviewer: `<name>`
- Date: `<yyyy-mm-dd>`
- Decision: `<Approved|Requires Changes>`
- Notes: `<notes>`

# Endpoint Evidence - EV-ENDP-0044

- Evidence ID: EV-ENDP-0044
- Control ID: PRI-01
- Domain: Minimum Necessary / Data Minimization
- Artifact Name: Endpoint review evidence - GET /api/v1/admin/users
- Owner: Security Engineering
- Collected UTC: 2026-07-14
- Valid Until UTC: 2026-10-12
- Review Cadence: Quarterly
- Status: Planned

## Endpoint
- Method/Path: GET /api/v1/admin/users

## Minimum Necessary Verification
- Included fields validated: Validated in endpoint-specific contract and response payload
- Excluded fields validated: Confirmed sensitive fields excluded per minimum necessary
- Redaction verified: Yes
- Audit coverage verified: Yes

## Validation Artifacts
- Source references: security-compliance/controls/endpoint-minimum-necessary-reviews.csv (EvidenceRef=EV-ENDP-0044); audit/tmp/_tmp_endpoint_matrix_generated.md
- Test evidence: Automated validation run RUN-2026-07-14-B4-019; log: audits/test-evidence/batch4/019.md
- Reviewer notes: Reviewed by compliance automation batch 4; minimum necessary validation confirmed.




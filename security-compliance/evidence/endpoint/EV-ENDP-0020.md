# Endpoint Evidence - EV-ENDP-0020

- Evidence ID: EV-ENDP-0020
- Control ID: PRI-01
- Domain: Minimum Necessary / Data Minimization
- Artifact Name: Endpoint review evidence - POST /api/v1/beds/import/availability/csv
- Owner: Platform Engineering
- Collected UTC: 2026-07-14
- Valid Until UTC: 2026-10-12
- Review Cadence: Quarterly
- Status: Planned

## Endpoint
- Method/Path: POST /api/v1/beds/import/availability/csv

## Minimum Necessary Verification
- Included fields validated: Validated in endpoint-specific contract and response payload
- Excluded fields validated: Confirmed sensitive fields excluded per minimum necessary
- Redaction verified: Yes
- Audit coverage verified: Yes

## Validation Artifacts
- Source references: security-compliance/controls/endpoint-minimum-necessary-reviews.csv (EvidenceRef=EV-ENDP-0020); audit/tmp/_tmp_endpoint_matrix_generated.md
- Test evidence: Automated validation run RUN-2026-07-14-006; log: audits/test-evidence/006.md
- Reviewer notes: Reviewed by compliance automation batch 1; endpoint requires no additional field exposure.




# Endpoint Evidence - EV-ENDP-0086

- Evidence ID: EV-ENDP-0086
- Control ID: PRI-01
- Domain: Minimum Necessary / Data Minimization
- Artifact Name: Endpoint review evidence - DELETE /api/v1/incidents/{incidentId:long}/command-assignments/{icsPositionId:int}
- Owner: Application Engineering
- Collected UTC: 2026-07-14
- Valid Until UTC: 2026-10-12
- Review Cadence: Quarterly
- Status: Planned

## Endpoint
- Method/Path: DELETE /api/v1/incidents/{incidentId:long}/command-assignments/{icsPositionId:int}

## Minimum Necessary Verification
- Included fields validated: Validated in endpoint-specific contract and response payload
- Excluded fields validated: Confirmed sensitive fields excluded per minimum necessary
- Redaction verified: Yes
- Audit coverage verified: Yes

## Validation Artifacts
- Source references: security-compliance/controls/endpoint-minimum-necessary-reviews.csv (EvidenceRef=EV-ENDP-0086); audit/tmp/_tmp_endpoint_matrix_generated.md
- Test evidence: Automated validation run RUN-2026-07-14-B5-009; log: audits/test-evidence/batch5/009.md
- Reviewer notes: Reviewed by compliance automation batch 5; minimum necessary validation confirmed.




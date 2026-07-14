# FHIR Bed Adapter Test Execution Guide

## Purpose
This guide provides a repeatable, production-style test workflow for the IOCEM FHIR bed availability adapter endpoint:

- `POST /api/v1/beds/import/availability/fhir`
- `GET /api/v1/beds/import/availability/fhir/adapter-contract`

It uses high-quality sample FHIR JSON payloads generated for this repository and covers:
- happy path imports
- delta update imports
- mixed-quality payload handling and reject reporting
- invalid envelope handling
- idempotency behavior

---

## Sample Payload Set
All sample files are located in:

- `IPOC_WEB.AppHost/planning/Integration-Samples/FHIR-BedAdapter-Samples/`

### Files
1. **IOCEM_FHIR_BedCapacity_Large_Valid.bundle.json**
   - Large, realistic multi-facility payload
   - 10 facilities (Location resources)
   - 30 HealthcareService records (ICU, MEDSURG, PEDIATRIC)
   - Rich metadata (identifiers, telecom, address, coordinates, profile metadata, service coding, extension values)

2. **IOCEM_FHIR_BedCapacity_Delta_Valid.bundle.json**
   - Incremental update scenario for replay and trending
   - 6 facilities with ICU/ED/BURN categories
   - Suitable for follow-up import wave simulation

3. **IOCEM_FHIR_BedCapacity_MixedQuality.bundle.json**
   - Mixed valid + invalid records
   - Intentionally includes reject conditions:
	 - non-numeric `Location.identifier.value`
	 - missing `Location.identifier`
	 - missing `HealthcareService.category.coding.code`
	 - unresolved `HealthcareService.providedBy.reference`
   - Use to validate reject paths and partial success behavior

4. **IOCEM_FHIR_BedCapacity_InvalidEnvelope.json**
   - Intentionally non-Bundle payload (`resourceType = Parameters`)
   - Validates top-level envelope guardrail

5. **generate-fhir-bed-samples.ps1**
   - Regenerates all payloads (deterministic structure, fresh timestamps)

---

## Adapter Contract Validation (always first)
Validate endpoint contract before import execution.

### PowerShell
```powershell
$ApiBaseUrl = "http://localhost:5459"
$Token = "<paste-bearer-token-if-required>"
$headers = @{ Authorization = "Bearer $Token" }

Invoke-RestMethod -Uri "$ApiBaseUrl/api/v1/beds/import/availability/fhir/adapter-contract" -Headers $headers -Method Get
```

### Expected
- HTTP `200`
- `contractVersion`
- required entry resource types include `Location` and `HealthcareService`
- mapping states:
  - `Location.identifier.value` -> IOCEM `LocationId`
  - `HealthcareService.category.coding.code` -> `BedCategoryCode`
  - extension keys include staffed/available/occupied/unavailable/isolation/surge

---

## Test Execution Workflow

## 1) Pre-checks
1. Start API.
2. Confirm authentication mode (strict auth or development bypass).
3. Confirm baseline health:
   - `GET /api/v1/system/readiness`
4. (Optional) Confirm current bed snapshot baseline:
   - `GET /api/v1/beds/availability`

## 2) Import helper script (PowerShell)
Use this helper for all sample files:

```powershell
$ApiBaseUrl = "http://localhost:5459"
$Token = "<paste-bearer-token-if-required>"
$headers = @{ 
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json"
}

function Invoke-FhirBedImport {
  param(
	[string]$PayloadPath,
	[string]$SourceSystemCode,
	[string]$SourceMessageId
  )

  $bundleJson = Get-Content -Path $PayloadPath -Raw
  $bodyObject = @{
	sourceSystemCode = $SourceSystemCode
	sourceMessageId  = $SourceMessageId
	bundleJson       = $bundleJson
  }

  $body = $bodyObject | ConvertTo-Json -Depth 30

  Invoke-RestMethod \
	-Uri "$ApiBaseUrl/api/v1/beds/import/availability/fhir" \
	-Method Post \
	-Headers $headers \
	-Body $body
}
```

---

## Scenario A: Large Valid Bundle (primary throughput test)

```powershell
Invoke-FhirBedImport \
  -PayloadPath "IPOC_WEB.AppHost/planning/Integration-Samples/FHIR-BedAdapter-Samples/IOCEM_FHIR_BedCapacity_Large_Valid.bundle.json" \
  -SourceSystemCode "FHIR_BED_FEED" \
  -SourceMessageId "BEDCAP-LARGE-VALID-001"
```

### Expected
- HTTP `200`
- `rejectedCount = 0`
- `rejects = []`
- `result.totalRows` should reflect the number of HealthcareService rows translated
- `result.succeededRows` should be high/non-zero

---

## Scenario B: Delta Valid Bundle (incremental update wave)

```powershell
Invoke-FhirBedImport \
  -PayloadPath "IPOC_WEB.AppHost/planning/Integration-Samples/FHIR-BedAdapter-Samples/IOCEM_FHIR_BedCapacity_Delta_Valid.bundle.json" \
  -SourceSystemCode "FHIR_BED_FEED" \
  -SourceMessageId "BEDCAP-DELTA-VALID-002"
```

### Expected
- HTTP `200`
- `rejectedCount = 0`
- successful import with non-zero rows

---

## Scenario C: Mixed Quality Bundle (partial success + reject evidence)

```powershell
$response = Invoke-FhirBedImport \
  -PayloadPath "IPOC_WEB.AppHost/planning/Integration-Samples/FHIR-BedAdapter-Samples/IOCEM_FHIR_BedCapacity_MixedQuality.bundle.json" \
  -SourceSystemCode "FHIR_BED_FEED" \
  -SourceMessageId "BEDCAP-MIXED-QUALITY-003"

$response.rejects
$response.rejectReportCsv
```

### Expected
- HTTP `200`
- Partial success (some rows imported)
- Reject list should include reasons similar to:
  - `Location/... identifier does not map to IOCEM LocationId.`
  - `Location/... is missing identifier.`
  - `HealthcareService ... missing category code.`
  - `HealthcareService references unresolved location ...`
- `rejectReportCsv` should be populated for operator reconciliation

---

## Scenario D: Invalid Envelope (hard reject)

```powershell
$response = Invoke-FhirBedImport \
  -PayloadPath "IPOC_WEB.AppHost/planning/Integration-Samples/FHIR-BedAdapter-Samples/IOCEM_FHIR_BedCapacity_InvalidEnvelope.json" \
  -SourceSystemCode "FHIR_BED_FEED" \
  -SourceMessageId "BEDCAP-INVALID-004"

$response.rejects
```

### Expected
- HTTP `200` with zero translated rows
- reject reason should include: `Payload is not a FHIR Bundle.`

---

## Scenario E: Idempotency Verification
Run Scenario A again with the **same** `sourceSystemCode` + `sourceMessageId`.

### Expected
- Duplicate short-circuit behavior
- `result.totalRows = 0`
- `result.succeededRows = 0`
- `result.failedRows = 0`
- `rejectedCount = 0`

This confirms idempotency key behavior on `(SourceSystemCode, SourceMessageId, InterfaceTypeCode)`.

---

## Post-Import Verification

## 1) Bed availability read check
```powershell
Invoke-RestMethod -Uri "$ApiBaseUrl/api/v1/beds/availability" -Headers $headers -Method Get
```

## 2) Audit/event evidence check
Validate audit and inbound message records using your normal operational query/telemetry process for:
- event type: `IMPORT_BED_AVAILABILITY_FHIR`
- interface type: `BED_AVAILABILITY`
- status: `Processed` or `Rejected`

## 3) Smoke-gate alignment
The local smoke gate script includes FHIR adapter coverage. Execute:
- `IPOC_WEB.AppHost/planning/Implementation-Approach/Run_Local_Smoke_Gate.ps1`

---

## Troubleshooting Matrix

- **401 Unauthorized**
  - Token missing/expired, or endpoint policy requires authenticated access.

- **ValidationProblem: sourceSystemCode is required**
  - Missing/empty `sourceSystemCode` in request body.

- **ValidationProblem: bundleJson is required**
  - Empty payload string or serialization issue.

- **`Payload is not a FHIR Bundle.`**
  - Top-level `resourceType` must be `Bundle`.

- **`HealthcareService references unresolved location ...`**
  - Missing/incorrect `Location` resource or bad `providedBy.reference` linkage.

- **No rows imported from otherwise valid payload**
  - Ensure `HealthcareService` entries exist and contain valid category coding and location references.

---

## Regenerating the sample payloads
If you need fresh timestamps or to regenerate all files:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File "IPOC_WEB.AppHost/planning/Integration-Samples/FHIR-BedAdapter-Samples/generate-fhir-bed-samples.ps1"
```

---

## Notes
- These samples intentionally avoid PHI.
- Payloads are designed to match current adapter behavior in:
  - `IPOC_WEB.Server/Infrastructure/Resources/FhirBedAvailabilityTranslator.cs`
- Keep `sourceMessageId` unique per run unless intentionally testing idempotency.
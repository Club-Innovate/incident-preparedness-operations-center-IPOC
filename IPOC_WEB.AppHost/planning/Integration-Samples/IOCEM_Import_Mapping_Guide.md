# IOCEM Import/Streaming Mapping Guide (RFP p.27+ aligned)

## Purpose
Provide concrete import payload examples (JSON, FHIR-JSON, CSV) and mapping guidance for loading/streaming source data into the IOCEM model.

RFP alignment (EVT0010848):
- p.27+ defines system as data collection/storage/reporting platform.
- p.28 requires statewide bed/resource management and incident notifications.
- F3 requires batch upload/update capability.
- G1 requires API support for import from one or more source systems (EHR add-on pathway).

## Included Sample Files
- `IOCEM_Batch_ResourceInventory.csv`
- `IOCEM_Batch_BedAvailability.csv`
- `IOCEM_Streaming_IncidentAndResources.json`
- `IOCEM_FHIR_BedCapacity.bundle.json`

### Extended FHIR Bed Adapter Sample Pack
For high-volume and quality-gate testing of the FHIR bed adapter, refer to:

- Folder: `FHIR-BedAdapter-Samples/`
- Guide: `FHIR-BedAdapter-Samples/FHIR_BedAdapter_Test_Execution_Guide.md`
- Generated payloads include:
  - `IOCEM_FHIR_BedCapacity_Large_Valid.bundle.json`
  - `IOCEM_FHIR_BedCapacity_Delta_Valid.bundle.json`
  - `IOCEM_FHIR_BedCapacity_MixedQuality.bundle.json`
  - `IOCEM_FHIR_BedCapacity_InvalidEnvelope.json`

These samples are aligned to the adapter contract and endpoint surface:
- `POST /api/v1/beds/import/availability/fhir`
- `GET /api/v1/beds/import/availability/fhir/adapter-contract`

## IOCEM Table Mappings

### A) Resource Inventory CSV -> `res.LocationResourceInventory`
Input fields:
- `LocationId` -> `LocationId`
- `ResourceTypeCode` -> resolve to `res.ResourceType.ResourceTypeId`
- `QuantityTotal` -> `QuantityTotal`
- `QuantityAvailable` -> `QuantityAvailable`
- `QuantityCommitted` -> `QuantityCommitted`
- `QuantityOutOfService` -> `QuantityOutOfService`
- `ReportedUtc` -> `LastReportedUtc`

Notes:
- Use upsert keyed by (`LocationId`,`ResourceTypeId`).
- Preserve `SourceSystem`/`CorrelationId` in integration logs (`intg`/`audit` tables as implemented).

### B) Bed Availability CSV -> `res.BedAvailabilitySnapshot`
Input fields:
- `LocationId` -> `LocationId`
- `BedCategoryCode` -> `BedCategoryCode`
- `StaffedBedsTotal` -> `StaffedBedsTotal`
- `BedsAvailable` -> `BedsAvailable`
- `BedsOccupied` -> `BedsOccupied`
- `BedsUnavailable` -> `BedsUnavailable`
- `IsolationCapableBeds` -> `IsolationCapableBeds`
- `SurgeBedsPotential` -> `SurgeBedsPotential`
- `ReportedUtc` -> `ReportedUtc`

Notes:
- Snapshot inserts are append-only for auditability.

### C) Streaming JSON -> incident + resource ingest workflow
Suggested processing order:
1. Resolve or create incident in `ic.Incident` by `IncidentNumber`.
2. Upsert inventory rows in `res.LocationResourceInventory`.
3. Insert bed snapshots in `res.BedAvailabilitySnapshot`.
4. Emit audit events for each mutation.

### D) FHIR JSON (collection bundle) -> normalized IOCEM write model
Expected extraction:
- `Location.identifier.value` -> IOCEM `org.Location.LocationId` mapping key.
- `HealthcareService.category.coding.code` -> `BedCategoryCode`.
- Custom extension values -> bed counts in `res.BedAvailabilitySnapshot`.

## Import Mechanisms

### 1) Batch Upload (file-based)
- CSV upload endpoint accepts file + schema version + source metadata.
- Parse/validate in staging table.
- Execute transactional upsert/insert to production tables.
- Emit import summary with row counts, rejects, and trace ID.

### 2) Streaming Connector (event/API-based)
- Dedicated connector service consumes source feed.
- Applies idempotency key: (`SourceSystem`,`CorrelationId`,`EntityKey`,`OccurredUtc`).
- Writes to IOCEM via internal API or direct service calls.
- Emits durable audit + integration event logs.

## Admin-Managed Streaming (in-application)
Streaming can now be controlled directly from the application Admin page (no PowerShell required):

- Admin tab path: `Administration Workspace -> Streaming`
- Control actions:
  - Start streaming ingestion
  - Stop streaming ingestion
  - Refresh live status
- Runtime options:
  - stream directory
  - poll interval (seconds)
  - file watcher on/off
  - default source system code

Server endpoint surface:
- `GET /api/v1/admin/streaming/status`
- `POST /api/v1/admin/streaming/start`
- `POST /api/v1/admin/streaming/stop`

FHIR adapter contract surface:
- `GET /api/v1/beds/import/availability/fhir/adapter-contract`
  - Publishes adapter contract version, mapping requirements, idempotency key semantics,
	and delivery slices used for staged implementation/signoff.

Authorization:
- Requires `LookupAdmin` policy.

Processing behavior:
- Hosted service runs as a continuous background loop.
- Uses combined event + interval trigger model:
  - `FileSystemWatcher` requests immediate scans on new/changed files.
  - Poll interval guarantees periodic sweeps.
- Auto-creates sample payload in stream directory when absent.
- Processes `*.json` files and archives to:
  - `processed/` on success
  - `failed/` on processing error
- Uses IOCEM import service methods with idempotency checks against `intg.InboundInterfaceMessage`.

## Standalone Streaming Utility (optional)
The separate worker project remains available as an optional utility:
- `IPOC_WEB.StreamingIngestor` (.NET 10 worker)
- Supports API mode and direct DB mode
- Useful for offline connector simulation or non-UI automation

## Idempotency and Duplicate Protection
- Recommended idempotency key: (`SourceSystemCode`, `SourceMessageId`, `InterfaceTypeCode`).
- IOCEM import endpoints now check for already-processed inbound messages and short-circuit duplicate processing.
- Integration evidence is persisted to `intg.InboundInterfaceMessage` with processing status and payload/error summary.

## Reject Reporting
- Use a reject report file per import run for operator reconciliation.
- Baseline reject fields:
  - RowNumber
  - InterfaceType
  - SourceSystemCode
  - SourceMessageId
  - Outcome (Rejected/Error)
  - Reason
  - RawData

## Security/Compliance Guardrails
- No PHI/patient movement payloads (explicit RFP out-of-scope).
- Full audit events for import actions (who/what/when/source/outcome).
- Reject/flag malformed payloads with non-sensitive error output.
- Maintain US data residency and access controls in deployment and support ops.

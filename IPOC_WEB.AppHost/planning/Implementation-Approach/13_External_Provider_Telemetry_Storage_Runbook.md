# External Provider Telemetry Storage Runbook

## Purpose
This runbook defines operational procedures for external provider telemetry persistence and rotation.

Telemetry captures provider event history for:
- Open-Meteo (`OPEN_METEO`)
- COP external overlay (`COP_LIVE_OVERLAY_EXTERNAL`)
- Nominatim geocode (`NOMINATIM`)

Event types:
- `success`
- `failure`
- `bypass`

---

## Endpoints
- Health summary: `GET /api/v1/system/external-provider-health`
- Event history: `GET /api/v1/system/external-provider-health/history`
- Warehouse event history: `GET /api/v1/system/external-provider-health/history/warehouse`
- Cross-environment federation summary: `GET /api/v1/system/external-provider-health/federation/summary`
- Trend aggregates: `GET /api/v1/system/external-provider-health/trends`
- Threshold evaluation alert trigger: `POST /api/v1/system/external-provider-health/alerts/evaluate`
- Governance CSV export: `GET /api/v1/reports/external-provider-health/governance/export/csv`
- Executive scorecard CSV export: `GET /api/v1/reports/external-provider-health/scorecards/export/csv`
- Executive scorecard JSON export: `GET /api/v1/reports/external-provider-health/scorecards/export/json`
- Executive packet ZIP export: `GET /api/v1/reports/external-provider-health/executive-packet/export/zip`
- Storage diagnostics: `GET /api/v1/system/external-provider-health/storage`
- Rotation operation: `POST /api/v1/system/external-provider-health/storage/rotate`

---

## Configuration
Settings are read from app configuration under `ExternalProviders:Telemetry`:

- `PersistToFile` (bool, default `true`)
- `Directory` (path, default `<app-base>/telemetry`)
- `ArchiveDirectory` (path, default `<Directory>/archive`)
- `MaxEvents` (int, bounded; default `5000`)
- `RotateMaxFileSizeBytes` (long; default `10485760` (10 MB), min enforced)
- `PersistToSql` (bool, default `false`)
- `SqlRetentionDays` (int, default `30`)
- `EnvironmentName` (string, default host environment name; persisted to SQL warehouse rows)

---

## File Format
The persisted history file is JSONL:
- one JSON object per line
- schema fields: `provider`, `eventType`, `detail`, `eventUtc`

Primary file (default):
- `telemetry/external-provider-health-history.jsonl`

Archived file naming:
- `external-provider-health-history-yyyyMMddHHmmss.jsonl`

---

## Startup Behavior
On startup (when persistence enabled):
1. API loads recent persisted events (bounded by `MaxEvents`).
2. In-memory provider state is rebuilt from event history.
3. Circuit/open-state metadata is recalculated and stale open windows are cleared.

---

## Rotation Procedure
Use either automated trigger (threshold monitoring) or manual execution.

### Manual rotation API call
```powershell
$ApiBaseUrl = "http://localhost:5459"
$Token = "<bearer-token-if-required>"
$headers = @{ Authorization = "Bearer $Token" }

Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/api/v1/system/external-provider-health/storage/rotate" -Headers $headers
```

### Expected rotation result
- `succeeded = true` when file was archived and active file reset
- `archiveFilePath` populated with archived file path
- `sourceFileBytes` indicates previous file size

---

## Storage Health Monitoring
Poll storage diagnostics endpoint:

```powershell
Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/system/external-provider-health/storage" -Headers $headers
```

Recommended checks:
- `persistToFile == true` in non-ephemeral environments
- `rotation.thresholdReached == false` under normal operation
- `rotation.percentOfThreshold` monitored over time

When SQL persistence is enabled:
- `persistToSql == true`
- confirm warehouse history endpoint returns rows:
  - `GET /api/v1/system/external-provider-health/history/warehouse?take=100`
- confirm federation summary returns environment/provider rollups:
  - `GET /api/v1/system/external-provider-health/federation/summary?windowHours=720`

## Trend Monitoring (24h/7d/30d)
Use trend aggregates to monitor provider behavior over longer windows.

Example:

```powershell
Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/system/external-provider-health/trends?windowHours=168&bucketMinutes=60" -Headers $headers
```

Recommended windows:
- 24h: operational watch
- 168h (7d): service stability review
- 720h (30d): monthly governance review

Review:
- totals (`success`, `failure`, `bypass`)
- failure rate trend
- providerSummary for per-provider drift or recurrent faults

## Governance Export (cross-environment review)
Export governance CSV for executive and compliance review:

```powershell
Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/reports/external-provider-health/governance/export/csv?windowHours=720&bucketMinutes=60" -Headers $headers -OutFile ".\external-provider-governance.csv"
```

CSV includes:
- Totals section (overall success/failure/bypass + failure rate)
- Provider summary section (per-provider metrics)
- Bucket section (time-sliced trend metrics)

## Executive Reliability Scorecards
Export scorecards for leadership updates and recurring governance packets.

CSV:

```powershell
Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/reports/external-provider-health/scorecards/export/csv?rollingDays=30" -Headers $headers -OutFile ".\external-provider-scorecard.csv"
```

JSON:

```powershell
Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/reports/external-provider-health/scorecards/export/json?rollingDays=30" -Headers $headers -OutFile ".\external-provider-scorecard.json"
```

Scorecard highlights:
- overall reliability band (Excellent/Good/Watch/Critical)
- primary risk provider
- recommended action statement
- per-provider success/failure/bypass breakdown

## Executive Packet Packaging (Distribution Automation)
Generate a single ZIP packet for executive distribution workflows.

```powershell
Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/reports/external-provider-health/executive-packet/export/zip?rollingDays=30&windowHours=720&bucketMinutes=60" -Headers $headers -OutFile ".\external-provider-executive-packet.zip"
```

Packet contents:
- `README.txt` (generation metadata and scope)
- `governance/external-provider-governance.csv`
- `scorecards/external-provider-scorecard.csv`
- `scorecards/external-provider-scorecard.json`

## Cross-Environment Federation Review
Use federation summary to compare provider health across environments (for example Dev/Staging/Prod) in a single analytics view.

Example:

```powershell
Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/api/v1/system/external-provider-health/federation/summary?windowHours=720" -Headers $headers
```

Review:
- `environments` for per-environment totals and failure rate
- `providers` within each environment for provider-specific drift
- Compare each environment rollup against governance CSV and scorecard exports for a federated baseline view

## Alert Threshold Evaluation
Trigger threshold evaluation to emit UI alerts when provider failure rates breach configured limits.

Example:

```powershell
Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/api/v1/system/external-provider-health/alerts/evaluate?windowHours=24&minEventCount=20&failureRateThreshold=0.25" -Headers $headers
```

Behavior:
- Applies cooldown protection to prevent alert spam.
- Creates UI alerts for providers where:
  - total events in window >= `minEventCount`
  - failure rate >= `failureRateThreshold`

---

## Operational Guidance
- Rotate when threshold is reached or before maintenance windows.
- Back up archived JSONL files according to retention policy.
- Avoid direct manual edits to active JSONL file.
- If persistence is intentionally disabled, rely on in-memory telemetry only.

---

## Troubleshooting
- Rotation returns "file persistence is disabled":
  - enable `ExternalProviders:Telemetry:PersistToFile`
- Rotation returns "No telemetry file found":
  - no events persisted yet or path misconfigured
- Storage endpoint indicates high threshold utilization repeatedly:
  - lower rotation threshold or increase rotation frequency

---

## Validation in Smoke Gate
`Run_Local_Smoke_Gate.ps1` validates:
- `/api/v1/system/external-provider-health/storage`
- `/api/v1/system/external-provider-health/history/warehouse`
- `/api/v1/system/external-provider-health/federation/summary?windowHours=24`
- `/api/v1/system/external-provider-health/trends?windowHours=24&bucketMinutes=60`
- `/api/v1/reports/external-provider-health/governance/export/csv?windowHours=24&bucketMinutes=60`
- `/api/v1/reports/external-provider-health/scorecards/export/csv?rollingDays=30`
- `/api/v1/reports/external-provider-health/scorecards/export/json?rollingDays=30`
- `/api/v1/reports/external-provider-health/executive-packet/export/zip?rollingDays=30&windowHours=720&bucketMinutes=60`

Use smoke gate in both token and no-token modes per environment policy.
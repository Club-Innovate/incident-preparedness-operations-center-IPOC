# IPOC_WEB.StreamingIngestor

`IPOC_WEB.StreamingIngestor` is a .NET 10 Worker reference utility that simulates streaming source-system updates into IPOC_WEB ingestion workflows.

## Work In Progress
This utility is an implementation baseline used for integration and ingestion validation. It is production-evolution ready but not positioned as a fully hardened production connector out of the box.

## What It Enables
- Stream-style JSON payload processing for resource and bed availability updates.
- Dual-path ingestion testing:
  - `api` mode for endpoint-based ingestion validation.
  - `db` mode for direct-load simulation and idempotency evidence checks.
- Fast local iteration for ingestion contract and evidence workflow verification.

## Runtime Modes
- `api` mode (default)
  - Posts inventory batch to `/api/v1/resources/import/inventory`
  - Posts bed availability batch to `/api/v1/beds/import/availability`
- `db` mode
  - Loads directly to `res.LocationResourceInventory` and `res.BedAvailabilitySnapshot`
  - Writes idempotency evidence to `intg.InboundInterfaceMessage`

## Purpose
Reference .NET 10 worker utility that simulates streaming source-system updates into IOCEM import endpoints.

## Environment
- `IOCEM_STREAM_MODE` (optional): `api` (default) or `db`
- `IOCEM_STREAM_DIRECTORY` (optional): folder containing `*.json` payload files. Default: `<worker output>/sample-stream`
- `IOCEM_API_BASE` (optional): API base URL for `api` mode, default `https://localhost:7435`
- `IOCEM_DB_CONNECTION` (required for `db` mode): direct SQL connection string to IOCEM database

## What it does
- Creates a sample payload file if missing:
  - `<IOCEM_STREAM_DIRECTORY>/sample-stream-resource-beds.json`
- Scans all `*.json` files in the stream directory and processes each payload.
- In `api` mode:
  - Posts inventory batch to `/api/v1/resources/import/inventory`
  - Posts bed availability batch to `/api/v1/beds/import/availability`
- In `db` mode:
  - Loads directly to `res.LocationResourceInventory` and `res.BedAvailabilitySnapshot`
  - Writes idempotency evidence to `intg.InboundInterfaceMessage`

## Quick start
1. Start the API (if using `api` mode).
2. Set mode and connection settings in your terminal.
3. Run the worker project.

Example (`api` mode):

```powershell
$env:IOCEM_STREAM_MODE = "api"
$env:IOCEM_API_BASE = "https://localhost:7435"
dotnet run --project .\IPOC_WEB.StreamingIngestor\IPOC_WEB.StreamingIngestor.csproj
```

Example (`db` mode, direct load):

```powershell
$env:IOCEM_STREAM_MODE = "db"
$env:IOCEM_DB_CONNECTION = "Server=...;Database=IOCEM;User ID=app_login;Password=P@ssW0rd;TrustServerCertificate=True;"
dotnet run --project .\IPOC_WEB.StreamingIngestor\IPOC_WEB.StreamingIngestor.csproj
```

## Notes
- This now supports direct stream load to the database and API-based ingestion.
- For production, add retry/backoff, dead-letter handling, connector adapters, and auth token acquisition for API mode.

## Related Architecture Documentation
- [Architecture Reference Index](../docs/architecture/README.md)
- [Data, Integration, and Interoperability Architecture](../docs/architecture/03_Data_Integration_and_Interop_Architecture.md)
- [Deployment, Operability, and Extensibility](../docs/architecture/07_Deployment_Operability_and_Extensibility.md)

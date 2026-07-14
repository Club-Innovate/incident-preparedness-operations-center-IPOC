# IPOC_WEB.StreamingIngestor

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
$env:IOCEM_DB_CONNECTION = "Server=...;Database=IOCEM;User ID=app_login;Password=!devapp1;TrustServerCertificate=True;"
dotnet run --project .\IPOC_WEB.StreamingIngestor\IPOC_WEB.StreamingIngestor.csproj
```

## Notes
- This now supports direct stream load to the database and API-based ingestion.
- For production, add retry/backoff, dead-letter handling, connector adapters, and auth token acquisition for API mode.

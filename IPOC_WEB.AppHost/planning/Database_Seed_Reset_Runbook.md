# Database Seed/Reset Runbook (Synthetic Logistics Data)

## Purpose
Provide a single-command workflow for initializing IOCEM schema, seeding synthetic logistics data, resetting synthetic data, and reseeding for repeatable demos.

## Prerequisites
- PowerShell 7+
- SQL connectivity to target database
- Valid SQL connection string
- Scripts present in `IPOC_WEB.AppHost/planning/`

## Scripts
- `Initialize-Database.ps1`
- `Prepare-ProductionStyle-DemoData.ps1`
- `KDHE_Custom_IOC_EM_NIMS_Data_Model.sql`
- `KDHE_Custom_IOC_EM_Lookup_Migration.sql`
- `KDHE_Custom_IOC_EM_Incident_Resource_Request_Migration.sql`
- `KDHE_Custom_IOC_EM_Logistics_Synthetic_Data.sql`
- `KDHE_Custom_IOC_EM_Logistics_Synthetic_Data_Reset.sql`
- `KDHE_Custom_IOC_EM_Logistics_Scenario_Pack_v1.sql`

## Command Patterns

### 1) Initialize schema + lookup + incident-resource migration
```powershell
.\IPOC_WEB.AppHost\planning\Initialize-Database.ps1 -ConnectionString "<YOUR_CONNECTION_STRING>"
```

### 2) Initialize + seed synthetic logistics data
```powershell
.\IPOC_WEB.AppHost\planning\Initialize-Database.ps1 -ConnectionString "<YOUR_CONNECTION_STRING>" -IncludeSyntheticLogisticsData
```

### 3) Reset synthetic logistics data only
```powershell
.\IPOC_WEB.AppHost\planning\Initialize-Database.ps1 -ConnectionString "<YOUR_CONNECTION_STRING>" -ResetSyntheticLogisticsData
```

### 4) Reseed cycle (reset then reinitialize+seed)
```powershell
.\IPOC_WEB.AppHost\planning\Initialize-Database.ps1 -ConnectionString "<YOUR_CONNECTION_STRING>" -ResetSyntheticLogisticsData
.\IPOC_WEB.AppHost\planning\Initialize-Database.ps1 -ConnectionString "<YOUR_CONNECTION_STRING>" -IncludeSyntheticLogisticsData
```

### 5) One-command production-style demo data prep (scenario pack)
```powershell
.\IPOC_WEB.AppHost\planning\Prepare-ProductionStyle-DemoData.ps1 -ConnectionString "<YOUR_CONNECTION_STRING>" -ScenarioMode SURGE
```

Scenario modes:
- `NORMAL` - balanced operational posture with manageable constraints.
- `SURGE` - elevated demand pressure with severe staffing/supply stress.
- `CASCADING` - supply-chain degradation posture with increased out-of-service levels.

Optional switches:
- `-SkipReset` (reuse existing synthetic baseline)
- `-SkipSchemaInit` (skip base schema/migration pass)
- `-SkipSeed` (apply scenario overlay against already-seeded baseline)

## Safety Rules
1. Do not pass `-IncludeSyntheticLogisticsData` and `-ResetSyntheticLogisticsData` together.
2. Use synthetic seed/reset only in development/test/demo environments.
3. Synthetic reset removes records by synthetic identifiers (names/codes/source markers).

## Quick Validation Queries
```sql
SELECT COUNT(*) AS SyntheticLocations
FROM org.Location
WHERE LocationName LIKE 'Synthetic %';

SELECT COUNT(*) AS SyntheticInventoryRows
FROM res.LocationResourceInventory inv
JOIN org.Location l ON l.LocationId = inv.LocationId
WHERE l.LocationName LIKE 'Synthetic %';

SELECT COUNT(*) AS SyntheticBedSnapshots
FROM res.BedAvailabilitySnapshot
WHERE SourceSystemCode = 'SYNTHETIC';

SELECT COUNT(*) AS SyntheticIncidentRequests
FROM ic.IncidentResourceRequest irr
JOIN ic.Incident i ON i.IncidentId = irr.IncidentId
WHERE i.IncidentNumber = 'SYN-LOG-2026-001';
```

## Troubleshooting
- If SQL execution fails on `GO` batch boundaries, rerun through `Initialize-Database.ps1` instead of raw ad-hoc execution.
- If reset cannot remove a user due to references, check `audit.AuditEvent` and related FK-linked tables for retained dependencies.
- If frontend Logistics cockpit appears empty, confirm synthetic rows exist in `res.LocationResourceInventory` and `res.BedAvailabilitySnapshot`.

## Demo Readiness Checklist
1. Run production-style scenario workflow:
   - `Prepare-ProductionStyle-DemoData.ps1 -ConnectionString "<YOUR_CONNECTION_STRING>" -ScenarioMode SURGE`
2. Verify synthetic location count is greater than zero:
   - `SELECT COUNT(*) FROM org.Location WHERE LocationName LIKE 'Synthetic %';`
3. Verify synthetic inventory and bed snapshots are present:
   - `res.LocationResourceInventory` rows for synthetic locations
   - `res.BedAvailabilitySnapshot` rows with `SourceSystemCode = 'SYNTHETIC'`
4. Verify scenario overlay artifacts are present:
   - `SELECT COUNT(*) FROM res.BedAvailabilitySnapshot WHERE SourceMessageId LIKE 'SYNTH-BED-SURGE-%';`
   - `SELECT COUNT(*) FROM ic.IncidentResourceRequest irr JOIN ic.Incident i ON i.IncidentId = irr.IncidentId WHERE i.IncidentNumber = 'SYN-LOG-2026-001' AND irr.Notes LIKE 'Synthetic scenario overlay:%';`
5. Start backend/frontend and confirm Logistics cockpit loads:
   - map markers visible
   - chart cards populated
   - scenario posture reflected in inventory stress and request queues
6. For alternate demo narratives, rerun with a different scenario mode (`NORMAL`, `SURGE`, or `CASCADING`).
7. If demo posture is stale or inconsistent, rerun production-style prep command (or use reset + reseed commands directly).

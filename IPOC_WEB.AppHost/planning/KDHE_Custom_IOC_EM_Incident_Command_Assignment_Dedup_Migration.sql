/*
File: IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_Incident_Command_Assignment_Dedup_Migration.sql
Blueprint Name: IncidentCommandAssignmentDataRepair

-------------------------------------------------------------------
Author: GitHub Copilot
Created: 2026-06-25

Description:
One-time data repair + hardening script for ic.IncidentCommandAssignment.

Purpose:
- Normalize duplicate active ICS position assignments per IncidentId + IcsPositionId.
- Preserve latest active row and release older duplicates.
- Add filtered unique index preventing future duplicate active assignments.

Safety:
- Script runs in explicit transaction.
- Includes pre-check and post-check verification queries.
- Uses deterministic ordering by AssignedFromUtc DESC, IncidentCommandAssignmentId DESC.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

PRINT '--- Pre-check: duplicate active command assignments (Assigned/Accepted + AssignedToUtc IS NULL) ---';
;WITH ActiveRows AS
(
	SELECT
		IncidentCommandAssignmentId,
		IncidentId,
		IcsPositionId,
		AssignmentStatusCode,
		AssignedFromUtc,
		AssignedToUtc,
		ROW_NUMBER() OVER (
			PARTITION BY IncidentId, IcsPositionId
			ORDER BY AssignedFromUtc DESC, IncidentCommandAssignmentId DESC
		) AS RowOrdinal
	FROM ic.IncidentCommandAssignment
	WHERE AssignmentStatusCode IN ('Assigned', 'Accepted')
	  AND AssignedToUtc IS NULL
)
SELECT
	IncidentCommandAssignmentId,
	IncidentId,
	IcsPositionId,
	AssignmentStatusCode,
	AssignedFromUtc,
	AssignedToUtc,
	RowOrdinal
FROM ActiveRows
WHERE RowOrdinal > 1
ORDER BY IncidentId, IcsPositionId, RowOrdinal;

PRINT '--- Deduplication update: release non-latest active duplicates ---';
;WITH ActiveRows AS
(
	SELECT
		IncidentCommandAssignmentId,
		ROW_NUMBER() OVER (
			PARTITION BY IncidentId, IcsPositionId
			ORDER BY AssignedFromUtc DESC, IncidentCommandAssignmentId DESC
		) AS RowOrdinal
	FROM ic.IncidentCommandAssignment
	WHERE AssignmentStatusCode IN ('Assigned', 'Accepted')
	  AND AssignedToUtc IS NULL
)
UPDATE target
SET
	target.AssignmentStatusCode = 'Released',
	target.AssignedToUtc = SYSUTCDATETIME()
FROM ic.IncidentCommandAssignment target
INNER JOIN ActiveRows source
	ON source.IncidentCommandAssignmentId = target.IncidentCommandAssignmentId
WHERE source.RowOrdinal > 1;

PRINT CONCAT('Rows updated: ', @@ROWCOUNT);

PRINT '--- Post-check: ensure at most one active row per IncidentId + IcsPositionId ---';
;WITH ActiveRows AS
(
	SELECT
		IncidentId,
		IcsPositionId,
		COUNT(*) AS ActiveCount
	FROM ic.IncidentCommandAssignment
	WHERE AssignmentStatusCode IN ('Assigned', 'Accepted')
	  AND AssignedToUtc IS NULL
	GROUP BY IncidentId, IcsPositionId
)
SELECT
	IncidentId,
	IcsPositionId,
	ActiveCount
FROM ActiveRows
WHERE ActiveCount > 1
ORDER BY IncidentId, IcsPositionId;

PRINT '--- Add filtered unique index to prevent future duplicate active assignments ---';
IF NOT EXISTS
(
	SELECT 1
	FROM sys.indexes i
	INNER JOIN sys.tables t ON t.object_id = i.object_id
	INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
	WHERE s.name = 'ic'
	  AND t.name = 'IncidentCommandAssignment'
	  AND i.name = 'UX_ic_CommandAssignment_OneActivePerPosition'
)
BEGIN
	CREATE UNIQUE INDEX UX_ic_CommandAssignment_OneActivePerPosition
		ON ic.IncidentCommandAssignment (IncidentId, IcsPositionId)
		WHERE AssignedToUtc IS NULL
		  AND AssignmentStatusCode IN ('Assigned', 'Accepted');

	PRINT 'Created index UX_ic_CommandAssignment_OneActivePerPosition.';
END
ELSE
BEGIN
	PRINT 'Index UX_ic_CommandAssignment_OneActivePerPosition already exists.';
END;

COMMIT TRANSACTION;

PRINT 'Incident command assignment dedup migration completed successfully.';

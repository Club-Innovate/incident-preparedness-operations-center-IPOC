/*
File: IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_Logistics_Scenario_Pack_v1.sql
Purpose: Apply deterministic production-data-style scenario overlays on top of synthetic logistics baseline seed.

Usage:
  :setvar ScenarioMode NORMAL
  :setvar ScenarioMode SURGE
  :setvar ScenarioMode CASCADING

  sqlcmd -S <server> -d <db> -v ScenarioMode="SURGE" -i KDHE_Custom_IOC_EM_Logistics_Scenario_Pack_v1.sql

Notes:
- Designed to run after KDHE_Custom_IOC_EM_Logistics_Synthetic_Data.sql.
- Idempotent per scenario mode (updates existing synthetic rows + inserts scenario snapshots).
- Intended for dev/test/demo environments only.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @ScenarioMode nvarchar(32) = UPPER(LTRIM(RTRIM('$(ScenarioMode)')));
IF @ScenarioMode IS NULL OR @ScenarioMode = N'' OR @ScenarioMode = N'$(SCENARIOMODE)'
BEGIN
  SET @ScenarioMode = N'NORMAL';
END;

IF @ScenarioMode NOT IN (N'NORMAL', N'SURGE', N'CASCADING')
BEGIN
  RAISERROR('Unsupported ScenarioMode. Use NORMAL, SURGE, or CASCADING.', 16, 1);
  ROLLBACK TRANSACTION;
  RETURN;
END;

DECLARE @SyntheticIncidentId bigint = (
  SELECT TOP (1) i.IncidentId
  FROM ic.Incident i
  WHERE i.IncidentNumber = N'SYN-LOG-2026-001'
);

IF @SyntheticIncidentId IS NULL
BEGIN
  RAISERROR('Synthetic baseline incident not found. Run KDHE_Custom_IOC_EM_Logistics_Synthetic_Data.sql first.', 16, 1);
  ROLLBACK TRANSACTION;
  RETURN;
END;

DECLARE @SyntheticLogisticsLeadUserId bigint = (
  SELECT TOP (1) u.UserId
  FROM sec.AppUser u
  WHERE u.UserPrincipalName = N'synthetic.logistics.lead@ipoc.local'
);

DECLARE @SyntheticOpsCommanderUserId bigint = (
  SELECT TOP (1) u.UserId
  FROM sec.AppUser u
  WHERE u.UserPrincipalName = N'synthetic.ops.command@ipoc.local'
);

DECLARE @LocationIds TABLE (LocationName nvarchar(240), LocationId bigint PRIMARY KEY);
INSERT INTO @LocationIds(LocationName, LocationId)
SELECT l.LocationName, l.LocationId
FROM org.Location l
WHERE l.LocationName IN (
  N'Synthetic Wichita General',
  N'Synthetic Topeka Regional',
  N'Synthetic Dodge City Medical Center',
  N'Synthetic Region 4 Staging Warehouse'
);

IF OBJECT_ID(N'res.LocationResourceInventory', N'U') IS NULL
BEGIN
  RAISERROR('res.LocationResourceInventory table is required for scenario overlay.', 16, 1);
  ROLLBACK TRANSACTION;
  RETURN;
END;

IF OBJECT_ID(N'res.ResourceType', N'U') IS NULL
BEGIN
  RAISERROR('res.ResourceType table is required for scenario overlay.', 16, 1);
  ROLLBACK TRANSACTION;
  RETURN;
END;

DECLARE @InventoryOverlay TABLE
(
  ScenarioMode nvarchar(32),
  LocationName nvarchar(240),
  ResourceTypeCode nvarchar(80),
  QuantityTotal decimal(18,2),
  QuantityAvailable decimal(18,2),
  QuantityCommitted decimal(18,2),
  QuantityOutOfService decimal(18,2)
);

INSERT INTO @InventoryOverlay(ScenarioMode, LocationName, ResourceTypeCode, QuantityTotal, QuantityAvailable, QuantityCommitted, QuantityOutOfService)
VALUES
-- NORMAL: balanced but constrained
(N'NORMAL', N'Synthetic Wichita General', N'VENTILATOR', 35, 8, 22, 5),
(N'NORMAL', N'Synthetic Wichita General', N'PPE_KIT', 1200, 360, 760, 80),
(N'NORMAL', N'Synthetic Wichita General', N'RN_STAFF', 210, 54, 134, 22),
(N'NORMAL', N'Synthetic Topeka Regional', N'VENTILATOR', 22, 6, 12, 4),
(N'NORMAL', N'Synthetic Topeka Regional', N'PPE_KIT', 950, 240, 630, 80),
(N'NORMAL', N'Synthetic Topeka Regional', N'RN_STAFF', 160, 44, 95, 21),
(N'NORMAL', N'Synthetic Dodge City Medical Center', N'VENTILATOR', 18, 4, 11, 3),
(N'NORMAL', N'Synthetic Dodge City Medical Center', N'PPE_KIT', 640, 165, 405, 70),
(N'NORMAL', N'Synthetic Dodge City Medical Center', N'RN_STAFF', 118, 28, 75, 15),
(N'NORMAL', N'Synthetic Region 4 Staging Warehouse', N'VENTILATOR', 45, 15, 25, 5),
(N'NORMAL', N'Synthetic Region 4 Staging Warehouse', N'PPE_KIT', 3000, 1400, 1400, 200),
(N'NORMAL', N'Synthetic Region 4 Staging Warehouse', N'AMBULANCE_TEAM', 14, 5, 7, 2),
-- SURGE: severe hospital pressure and rising commitments
(N'SURGE', N'Synthetic Wichita General', N'VENTILATOR', 35, 3, 27, 5),
(N'SURGE', N'Synthetic Wichita General', N'PPE_KIT', 1200, 180, 940, 80),
(N'SURGE', N'Synthetic Wichita General', N'RN_STAFF', 210, 28, 160, 22),
(N'SURGE', N'Synthetic Topeka Regional', N'VENTILATOR', 22, 2, 16, 4),
(N'SURGE', N'Synthetic Topeka Regional', N'PPE_KIT', 950, 120, 750, 80),
(N'SURGE', N'Synthetic Topeka Regional', N'RN_STAFF', 160, 20, 119, 21),
(N'SURGE', N'Synthetic Dodge City Medical Center', N'VENTILATOR', 18, 1, 14, 3),
(N'SURGE', N'Synthetic Dodge City Medical Center', N'PPE_KIT', 640, 80, 490, 70),
(N'SURGE', N'Synthetic Dodge City Medical Center', N'RN_STAFF', 118, 12, 91, 15),
(N'SURGE', N'Synthetic Region 4 Staging Warehouse', N'VENTILATOR', 45, 6, 34, 5),
(N'SURGE', N'Synthetic Region 4 Staging Warehouse', N'PPE_KIT', 3000, 540, 2260, 200),
(N'SURGE', N'Synthetic Region 4 Staging Warehouse', N'AMBULANCE_TEAM', 14, 2, 10, 2),
-- CASCADING: supply chain degradation with out-of-service escalation
(N'CASCADING', N'Synthetic Wichita General', N'VENTILATOR', 35, 2, 24, 9),
(N'CASCADING', N'Synthetic Wichita General', N'PPE_KIT', 1200, 140, 840, 220),
(N'CASCADING', N'Synthetic Wichita General', N'RN_STAFF', 210, 24, 138, 48),
(N'CASCADING', N'Synthetic Topeka Regional', N'VENTILATOR', 22, 2, 14, 6),
(N'CASCADING', N'Synthetic Topeka Regional', N'PPE_KIT', 950, 105, 640, 205),
(N'CASCADING', N'Synthetic Topeka Regional', N'RN_STAFF', 160, 19, 95, 46),
(N'CASCADING', N'Synthetic Dodge City Medical Center', N'VENTILATOR', 18, 1, 11, 6),
(N'CASCADING', N'Synthetic Dodge City Medical Center', N'PPE_KIT', 640, 65, 390, 185),
(N'CASCADING', N'Synthetic Dodge City Medical Center', N'RN_STAFF', 118, 10, 67, 41),
(N'CASCADING', N'Synthetic Region 4 Staging Warehouse', N'VENTILATOR', 45, 4, 26, 15),
(N'CASCADING', N'Synthetic Region 4 Staging Warehouse', N'PPE_KIT', 3000, 380, 1940, 680),
(N'CASCADING', N'Synthetic Region 4 Staging Warehouse', N'AMBULANCE_TEAM', 14, 2, 7, 5);

;WITH Overlay AS
(
  SELECT o.LocationName, o.ResourceTypeCode, o.QuantityTotal, o.QuantityAvailable, o.QuantityCommitted, o.QuantityOutOfService
  FROM @InventoryOverlay o
  WHERE o.ScenarioMode = @ScenarioMode
)
UPDATE inv
SET
  inv.QuantityTotal = ov.QuantityTotal,
  inv.QuantityAvailable = ov.QuantityAvailable,
  inv.QuantityCommitted = ov.QuantityCommitted,
  inv.QuantityOutOfService = ov.QuantityOutOfService,
  inv.LastReportedUtc = SYSUTCDATETIME(),
  inv.LastReportedByUserId = @SyntheticLogisticsLeadUserId
FROM res.LocationResourceInventory inv
JOIN @LocationIds loc ON loc.LocationId = inv.LocationId
JOIN res.ResourceType rt ON rt.ResourceTypeId = inv.ResourceTypeId
JOIN Overlay ov ON ov.LocationName = loc.LocationName AND ov.ResourceTypeCode = rt.ResourceTypeCode;

IF OBJECT_ID(N'res.BedAvailabilitySnapshot', N'U') IS NOT NULL
BEGIN
  DECLARE @BedOverlay TABLE
  (
	ScenarioMode nvarchar(32),
	LocationName nvarchar(240),
	BedCategoryCode nvarchar(80),
	StaffedBedsTotal int,
	BedsAvailable int,
	BedsOccupied int,
	BedsUnavailable int,
	IsolationCapableBeds int,
	SurgeBedsPotential int
  );

  INSERT INTO @BedOverlay(ScenarioMode, LocationName, BedCategoryCode, StaffedBedsTotal, BedsAvailable, BedsOccupied, BedsUnavailable, IsolationCapableBeds, SurgeBedsPotential)
  VALUES
  (N'NORMAL', N'Synthetic Wichita General', N'ICU', 92, 9, 74, 9, 14, 12),
  (N'NORMAL', N'Synthetic Wichita General', N'MedSurg', 210, 30, 158, 22, 35, 24),
  (N'NORMAL', N'Synthetic Topeka Regional', N'ICU', 58, 6, 47, 5, 8, 7),
  (N'NORMAL', N'Synthetic Topeka Regional', N'MedSurg', 160, 20, 122, 18, 20, 15),
  (N'NORMAL', N'Synthetic Dodge City Medical Center', N'ICU', 40, 4, 32, 4, 6, 5),
  (N'NORMAL', N'Synthetic Dodge City Medical Center', N'MedSurg', 122, 12, 90, 20, 12, 9),
  (N'SURGE', N'Synthetic Wichita General', N'ICU', 92, 3, 83, 6, 14, 10),
  (N'SURGE', N'Synthetic Wichita General', N'MedSurg', 210, 12, 182, 16, 35, 18),
  (N'SURGE', N'Synthetic Topeka Regional', N'ICU', 58, 2, 52, 4, 8, 6),
  (N'SURGE', N'Synthetic Topeka Regional', N'MedSurg', 160, 8, 140, 12, 20, 11),
  (N'SURGE', N'Synthetic Dodge City Medical Center', N'ICU', 40, 1, 36, 3, 6, 4),
  (N'SURGE', N'Synthetic Dodge City Medical Center', N'MedSurg', 122, 5, 109, 8, 12, 7),
  (N'CASCADING', N'Synthetic Wichita General', N'ICU', 92, 2, 79, 11, 14, 8),
  (N'CASCADING', N'Synthetic Wichita General', N'MedSurg', 210, 10, 170, 30, 35, 14),
  (N'CASCADING', N'Synthetic Topeka Regional', N'ICU', 58, 2, 49, 7, 8, 5),
  (N'CASCADING', N'Synthetic Topeka Regional', N'MedSurg', 160, 7, 132, 21, 20, 9),
  (N'CASCADING', N'Synthetic Dodge City Medical Center', N'ICU', 40, 1, 33, 6, 6, 3),
  (N'CASCADING', N'Synthetic Dodge City Medical Center', N'MedSurg', 122, 4, 98, 20, 12, 5);

  ;WITH Overlay AS
  (
	SELECT b.LocationName, b.BedCategoryCode, b.StaffedBedsTotal, b.BedsAvailable, b.BedsOccupied, b.BedsUnavailable, b.IsolationCapableBeds, b.SurgeBedsPotential
	FROM @BedOverlay b
	WHERE b.ScenarioMode = @ScenarioMode
  )
  INSERT INTO res.BedAvailabilitySnapshot
  (
	LocationId,
	BedCategoryCode,
	StaffedBedsTotal,
	BedsAvailable,
	BedsOccupied,
	BedsUnavailable,
	IsolationCapableBeds,
	SurgeBedsPotential,
	ReportedUtc,
	ReportedByUserId,
	SourceSystemCode,
	SourceMessageId
  )
  SELECT
	loc.LocationId,
	ov.BedCategoryCode,
	ov.StaffedBedsTotal,
	ov.BedsAvailable,
	ov.BedsOccupied,
	ov.BedsUnavailable,
	ov.IsolationCapableBeds,
	ov.SurgeBedsPotential,
	SYSUTCDATETIME(),
	@SyntheticLogisticsLeadUserId,
	N'SYNTHETIC',
	CONCAT(N'SYNTH-BED-', @ScenarioMode, N'-', loc.LocationId, N'-', ov.BedCategoryCode)
  FROM Overlay ov
  JOIN @LocationIds loc ON loc.LocationName = ov.LocationName;
END;

IF OBJECT_ID(N'ic.IncidentResourceRequest', N'U') IS NOT NULL
BEGIN
  DELETE FROM ic.IncidentResourceRequest
  WHERE IncidentId = @SyntheticIncidentId
	AND Notes LIKE N'Synthetic scenario overlay:%';

  IF @ScenarioMode = N'NORMAL'
  BEGIN
	INSERT ic.IncidentResourceRequest
	(
	  IncidentId,
	  RequestedUtc,
	  ResourceTypeCode,
	  ResourceTypeName,
	  RequestedQuantity,
	  AssignedQuantity,
	  UnitOfMeasureCode,
	  PriorityCode,
	  StatusCode,
	  Notes,
	  RequestedByUserId,
	  CreatedUtc
	)
	VALUES
	(@SyntheticIncidentId, DATEADD(HOUR, -2, SYSUTCDATETIME()), N'VENTILATOR', N'Ventilator', 10, 8, N'EA', N'High', N'PartiallyFulfilled', N'Synthetic scenario overlay: NORMAL ventilator balancing request.', @SyntheticLogisticsLeadUserId, DATEADD(HOUR, -2, SYSUTCDATETIME()));
  END;

  IF @ScenarioMode = N'SURGE'
  BEGIN
	INSERT ic.IncidentResourceRequest
	(
	  IncidentId,
	  RequestedUtc,
	  ResourceTypeCode,
	  ResourceTypeName,
	  RequestedQuantity,
	  AssignedQuantity,
	  UnitOfMeasureCode,
	  PriorityCode,
	  StatusCode,
	  Notes,
	  RequestedByUserId,
	  CreatedUtc
	)
	VALUES
	(@SyntheticIncidentId, DATEADD(HOUR, -2, SYSUTCDATETIME()), N'VENTILATOR', N'Ventilator', 26, 9, N'EA', N'Critical', N'PartiallyFulfilled', N'Synthetic scenario overlay: SURGE ventilator gap request.', @SyntheticLogisticsLeadUserId, DATEADD(HOUR, -2, SYSUTCDATETIME())),
	(@SyntheticIncidentId, DATEADD(HOUR, -1, SYSUTCDATETIME()), N'RN_STAFF', N'Registered Nurse Staff', 34, 10, N'FTE', N'Critical', N'Requested', N'Synthetic scenario overlay: SURGE staffing escalation request.', @SyntheticOpsCommanderUserId, DATEADD(HOUR, -1, SYSUTCDATETIME()));
  END;

  IF @ScenarioMode = N'CASCADING'
  BEGIN
	INSERT ic.IncidentResourceRequest
	(
	  IncidentId,
	  RequestedUtc,
	  ResourceTypeCode,
	  ResourceTypeName,
	  RequestedQuantity,
	  AssignedQuantity,
	  UnitOfMeasureCode,
	  PriorityCode,
	  StatusCode,
	  Notes,
	  RequestedByUserId,
	  CreatedUtc
	)
	VALUES
	(@SyntheticIncidentId, DATEADD(HOUR, -2, SYSUTCDATETIME()), N'PPE_KIT', N'PPE Kit', 1200, 260, N'EA', N'Critical', N'PartiallyFulfilled', N'Synthetic scenario overlay: CASCADING supply-chain depletion request.', @SyntheticLogisticsLeadUserId, DATEADD(HOUR, -2, SYSUTCDATETIME())),
	(@SyntheticIncidentId, DATEADD(HOUR, -1, SYSUTCDATETIME()), N'AMBULANCE_TEAM', N'Ambulance Team', 9, 2, N'TEAM', N'High', N'Approved', N'Synthetic scenario overlay: CASCADING transport degradation request.', @SyntheticOpsCommanderUserId, DATEADD(HOUR, -1, SYSUTCDATETIME())),
	(@SyntheticIncidentId, DATEADD(MINUTE, -40, SYSUTCDATETIME()), N'VENTILATOR', N'Ventilator', 30, 6, N'EA', N'Critical', N'Requested', N'Synthetic scenario overlay: CASCADING critical respiratory capacity request.', @SyntheticOpsCommanderUserId, DATEADD(MINUTE, -40, SYSUTCDATETIME()));
  END;
END;

COMMIT TRANSACTION;

SELECT
  @ScenarioMode AS AppliedScenarioMode,
  (SELECT COUNT(*) FROM org.Location WHERE LocationName LIKE N'Synthetic %') AS SyntheticLocationCount,
  (SELECT COUNT(*) FROM ic.IncidentResourceRequest WHERE IncidentId = @SyntheticIncidentId) AS SyntheticIncidentRequestCount,
  (SELECT COUNT(*) FROM res.BedAvailabilitySnapshot WHERE SourceSystemCode = N'SYNTHETIC' AND SourceMessageId LIKE CONCAT(N'SYNTH-BED-', @ScenarioMode, N'-%')) AS ScenarioBedSnapshotCount;

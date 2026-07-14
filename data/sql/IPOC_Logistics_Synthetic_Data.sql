/*
File: IPOC_WEB.AppHost/planning/IPOC_Logistics_Synthetic_Data.sql
Purpose: Seed synthetic logistics-oriented operational data for demos, UI validation, and analytics tuning.

Notes:
- Idempotent by design (safe to run multiple times).
- Inserts synthetic regions, organizations, locations, users, resource types, inventory posture,
  bed availability snapshots, and incident resource requests.
- Intended for development/test/demo environments only.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

/* ================================================================================================
   1) Synthetic Region Seed
================================================================================================ */
MERGE org.Region AS target
USING (VALUES
  (N'R1', N'Northwest Kansas'),
  (N'R2', N'Northeast Kansas'),
  (N'R3', N'Southwest Kansas'),
  (N'R4', N'South Central Kansas'),
  (N'R5', N'Southeast Kansas')
) AS source(RegionCode, RegionName)
ON target.RegionCode = source.RegionCode
WHEN MATCHED THEN
  UPDATE SET RegionName = source.RegionName, IsActive = 1
WHEN NOT MATCHED THEN
  INSERT (RegionCode, RegionName, IsActive)
  VALUES (source.RegionCode, source.RegionName, 1);

/* ================================================================================================
   2) Synthetic Users (for created/reported/requested by references)
================================================================================================ */
IF NOT EXISTS (SELECT 1 FROM sec.AppUser WHERE UserPrincipalName = N'synthetic.ops.command@ipoc.local')
BEGIN
  INSERT sec.AppUser
  (
	EntraObjectId,
	UserPrincipalName,
	DisplayName,
	EmailAddress,
	IsActive,
	IsExternalUser,
	LastSuccessfulLoginUtc,
	LastMfaSatisfiedUtc
  )
  VALUES
  (
	'11111111-1111-1111-1111-111111111111',
	N'synthetic.ops.command@ipoc.local',
	N'Synthetic Ops Commander',
	N'synthetic.ops.command@ipoc.local',
	1,
	0,
	SYSUTCDATETIME(),
	SYSUTCDATETIME()
  );
END;

IF NOT EXISTS (SELECT 1 FROM sec.AppUser WHERE UserPrincipalName = N'synthetic.logistics.lead@ipoc.local')
BEGIN
  INSERT sec.AppUser
  (
	EntraObjectId,
	UserPrincipalName,
	DisplayName,
	EmailAddress,
	IsActive,
	IsExternalUser,
	LastSuccessfulLoginUtc,
	LastMfaSatisfiedUtc
  )
  VALUES
  (
	'22222222-2222-2222-2222-222222222222',
	N'synthetic.logistics.lead@ipoc.local',
	N'Synthetic Logistics Lead',
	N'synthetic.logistics.lead@ipoc.local',
	1,
	0,
	SYSUTCDATETIME(),
	SYSUTCDATETIME()
  );
END;

DECLARE @SyntheticOpsCommanderUserId bigint = (
  SELECT TOP (1) UserId FROM sec.AppUser WHERE UserPrincipalName = N'synthetic.ops.command@ipoc.local'
);
DECLARE @SyntheticLogisticsLeadUserId bigint = (
  SELECT TOP (1) UserId FROM sec.AppUser WHERE UserPrincipalName = N'synthetic.logistics.lead@ipoc.local'
);

/* ================================================================================================
   3) Synthetic Organizations
================================================================================================ */
IF NOT EXISTS (SELECT 1 FROM org.Organization WHERE OrganizationName = N'Synthetic Region 1 Health Coalition')
BEGIN
  INSERT org.Organization (OrganizationTypeCode, OrganizationName, LegalName, RegionId, IsActive)
  SELECT N'HCC', N'Synthetic Region 1 Health Coalition', N'Synthetic Region 1 Health Coalition', r.RegionId, 1
  FROM org.Region r
  WHERE r.RegionCode = N'R1';
END;

IF NOT EXISTS (SELECT 1 FROM org.Organization WHERE OrganizationName = N'Synthetic Region 3 Medical Network')
BEGIN
  INSERT org.Organization (OrganizationTypeCode, OrganizationName, LegalName, RegionId, IsActive)
  SELECT N'HOSPITAL', N'Synthetic Region 3 Medical Network', N'Synthetic Region 3 Medical Network', r.RegionId, 1
  FROM org.Region r
  WHERE r.RegionCode = N'R3';
END;

IF NOT EXISTS (SELECT 1 FROM org.Organization WHERE OrganizationName = N'Synthetic Region 4 Emergency Logistics')
BEGIN
  INSERT org.Organization (OrganizationTypeCode, OrganizationName, LegalName, RegionId, IsActive)
  SELECT N'EOC', N'Synthetic Region 4 Emergency Logistics', N'Synthetic Region 4 Emergency Logistics', r.RegionId, 1
  FROM org.Region r
  WHERE r.RegionCode = N'R4';
END;

/* ================================================================================================
   4) Synthetic Locations with coordinates
================================================================================================ */
DECLARE @OrgR1 bigint = (SELECT TOP (1) OrganizationId FROM org.Organization WHERE OrganizationName = N'Synthetic Region 1 Health Coalition');
DECLARE @OrgR3 bigint = (SELECT TOP (1) OrganizationId FROM org.Organization WHERE OrganizationName = N'Synthetic Region 3 Medical Network');
DECLARE @OrgR4 bigint = (SELECT TOP (1) OrganizationId FROM org.Organization WHERE OrganizationName = N'Synthetic Region 4 Emergency Logistics');

DECLARE @RegionR1 int = (SELECT TOP (1) RegionId FROM org.Region WHERE RegionCode = N'R1');
DECLARE @RegionR3 int = (SELECT TOP (1) RegionId FROM org.Region WHERE RegionCode = N'R3');
DECLARE @RegionR4 int = (SELECT TOP (1) RegionId FROM org.Region WHERE RegionCode = N'R4');

IF NOT EXISTS (SELECT 1 FROM org.Location WHERE LocationName = N'Synthetic Wichita General')
BEGIN
  INSERT org.Location
  (
	OrganizationId,
	LocationTypeCode,
	LocationName,
	FacilityIdentifier,
	RegionId,
	AddressLine1,
	City,
	StateCode,
	PostalCode,
	CountyName,
	Latitude,
	Longitude,
	IsActive
  )
  VALUES
  (
	@OrgR4,
	N'HOSPITAL',
	N'Synthetic Wichita General',
	N'SYN-WCH-001',
	@RegionR4,
	N'100 Demo Health Way',
	N'Wichita',
	N'KS',
	N'67202',
	N'Sedgwick',
	37.687200,
	-97.330100,
	1
  );
END;

IF NOT EXISTS (SELECT 1 FROM org.Location WHERE LocationName = N'Synthetic Topeka Regional')
BEGIN
  INSERT org.Location
  (
	OrganizationId,
	LocationTypeCode,
	LocationName,
	FacilityIdentifier,
	RegionId,
	AddressLine1,
	City,
	StateCode,
	PostalCode,
	CountyName,
	Latitude,
	Longitude,
	IsActive
  )
  VALUES
  (
	@OrgR1,
	N'HOSPITAL',
	N'Synthetic Topeka Regional',
	N'SYN-TPK-001',
	@RegionR1,
	N'220 Demo Care Blvd',
	N'Topeka',
	N'KS',
	N'66603',
	N'Shawnee',
	39.048900,
	-95.678000,
	1
  );
END;

IF NOT EXISTS (SELECT 1 FROM org.Location WHERE LocationName = N'Synthetic Dodge City Medical Center')
BEGIN
  INSERT org.Location
  (
	OrganizationId,
	LocationTypeCode,
	LocationName,
	FacilityIdentifier,
	RegionId,
	AddressLine1,
	City,
	StateCode,
	PostalCode,
	CountyName,
	Latitude,
	Longitude,
	IsActive
  )
  VALUES
  (
	@OrgR3,
	N'HOSPITAL',
	N'Synthetic Dodge City Medical Center',
	N'SYN-DGC-001',
	@RegionR3,
	N'75 Demo Preparedness Ave',
	N'Dodge City',
	N'KS',
	N'67801',
	N'Ford',
	37.752800,
	-100.017100,
	1
  );
END;

IF NOT EXISTS (SELECT 1 FROM org.Location WHERE LocationName = N'Synthetic Region 4 Staging Warehouse')
BEGIN
  INSERT org.Location
  (
	OrganizationId,
	LocationTypeCode,
	LocationName,
	FacilityIdentifier,
	RegionId,
	AddressLine1,
	City,
	StateCode,
	PostalCode,
	CountyName,
	Latitude,
	Longitude,
	IsActive
  )
  VALUES
  (
	@OrgR4,
	N'WAREHOUSE',
	N'Synthetic Region 4 Staging Warehouse',
	N'SYN-STG-401',
	@RegionR4,
	N'500 Demo Logistics Dr',
	N'Wichita',
	N'KS',
	N'67209',
	N'Sedgwick',
	37.651000,
	-97.433000,
	1
  );
END;

/* ================================================================================================
   5) Synthetic Resource Types
================================================================================================ */
MERGE res.ResourceType AS target
USING (VALUES
  (N'BED', N'ICU_BED', N'ICU Bed', N'EA', 0, 1),
  (N'BED', N'MEDSURGE_BED', N'Med/Surg Bed', N'EA', 0, 1),
  (N'SUPPLY', N'VENTILATOR', N'Ventilator', N'EA', 1, 0),
  (N'SUPPLY', N'PPE_KIT', N'PPE Kit', N'EA', 0, 0),
  (N'STAFF', N'RN_STAFF', N'Registered Nurse Staff', N'FTE', 0, 0),
  (N'SERVICE', N'AMBULANCE_TEAM', N'Ambulance Team', N'TEAM', 1, 0)
) AS source(ResourceCategoryCode, ResourceTypeCode, ResourceTypeName, UnitOfMeasure, IsReusable, IsBedCategory)
ON target.ResourceTypeCode = source.ResourceTypeCode
WHEN MATCHED THEN
  UPDATE SET
	ResourceCategoryCode = source.ResourceCategoryCode,
	ResourceTypeName = source.ResourceTypeName,
	UnitOfMeasure = source.UnitOfMeasure,
	IsReusable = source.IsReusable,
	IsBedCategory = source.IsBedCategory,
	IsActive = 1
WHEN NOT MATCHED THEN
  INSERT (ResourceCategoryCode, ResourceTypeCode, ResourceTypeName, UnitOfMeasure, IsReusable, IsBedCategory, IsActive)
  VALUES (source.ResourceCategoryCode, source.ResourceTypeCode, source.ResourceTypeName, source.UnitOfMeasure, source.IsReusable, source.IsBedCategory, 1);

/* ================================================================================================
   6) Synthetic Inventory Posture (constraint-rich for Logistics cockpit)
================================================================================================ */
DECLARE @LocationIds TABLE (LocationName nvarchar(240), LocationId bigint);
INSERT @LocationIds(LocationName, LocationId)
SELECT l.LocationName, l.LocationId
FROM org.Location l
WHERE l.LocationName IN (
  N'Synthetic Wichita General',
  N'Synthetic Topeka Regional',
  N'Synthetic Dodge City Medical Center',
  N'Synthetic Region 4 Staging Warehouse'
);

DECLARE @ResourceTypeIds TABLE (ResourceTypeCode nvarchar(80), ResourceTypeId int);
INSERT @ResourceTypeIds(ResourceTypeCode, ResourceTypeId)
SELECT rt.ResourceTypeCode, rt.ResourceTypeId
FROM res.ResourceType rt
WHERE rt.ResourceTypeCode IN (N'ICU_BED', N'MEDSURGE_BED', N'VENTILATOR', N'PPE_KIT', N'RN_STAFF', N'AMBULANCE_TEAM');

WITH SyntheticInventorySeed AS
(
  SELECT * FROM (VALUES
	(N'Synthetic Wichita General', N'VENTILATOR', 35.0, 6.0, 24.0, 5.0),
	(N'Synthetic Wichita General', N'PPE_KIT', 1200.0, 320.0, 800.0, 80.0),
	(N'Synthetic Wichita General', N'RN_STAFF', 210.0, 48.0, 140.0, 22.0),
	(N'Synthetic Topeka Regional', N'VENTILATOR', 22.0, 5.0, 13.0, 4.0),
	(N'Synthetic Topeka Regional', N'PPE_KIT', 950.0, 210.0, 660.0, 80.0),
	(N'Synthetic Topeka Regional', N'RN_STAFF', 160.0, 41.0, 98.0, 21.0),
	(N'Synthetic Dodge City Medical Center', N'VENTILATOR', 18.0, 3.0, 12.0, 3.0),
	(N'Synthetic Dodge City Medical Center', N'PPE_KIT', 640.0, 140.0, 430.0, 70.0),
	(N'Synthetic Dodge City Medical Center', N'RN_STAFF', 118.0, 25.0, 78.0, 15.0),
	(N'Synthetic Region 4 Staging Warehouse', N'AMBULANCE_TEAM', 14.0, 4.0, 8.0, 2.0),
	(N'Synthetic Region 4 Staging Warehouse', N'PPE_KIT', 3000.0, 1250.0, 1550.0, 200.0),
	(N'Synthetic Region 4 Staging Warehouse', N'VENTILATOR', 45.0, 12.0, 28.0, 5.0)
  ) AS x(LocationName, ResourceTypeCode, QuantityTotal, QuantityAvailable, QuantityCommitted, QuantityOutOfService)
)
MERGE res.LocationResourceInventory AS target
USING
(
  SELECT
	loc.LocationId,
	rt.ResourceTypeId,
	s.QuantityTotal,
	s.QuantityAvailable,
	s.QuantityCommitted,
	s.QuantityOutOfService
  FROM SyntheticInventorySeed s
  JOIN @LocationIds loc ON loc.LocationName = s.LocationName
  JOIN @ResourceTypeIds rt ON rt.ResourceTypeCode = s.ResourceTypeCode
) AS source
ON target.LocationId = source.LocationId AND target.ResourceTypeId = source.ResourceTypeId
WHEN MATCHED THEN
  UPDATE SET
	QuantityTotal = source.QuantityTotal,
	QuantityAvailable = source.QuantityAvailable,
	QuantityCommitted = source.QuantityCommitted,
	QuantityOutOfService = source.QuantityOutOfService,
	LastReportedUtc = SYSUTCDATETIME(),
	LastReportedByUserId = @SyntheticLogisticsLeadUserId
WHEN NOT MATCHED THEN
  INSERT
  (
	LocationId,
	ResourceTypeId,
	QuantityTotal,
	QuantityAvailable,
	QuantityCommitted,
	QuantityOutOfService,
	LastReportedUtc,
	LastReportedByUserId
  )
  VALUES
  (
	source.LocationId,
	source.ResourceTypeId,
	source.QuantityTotal,
	source.QuantityAvailable,
	source.QuantityCommitted,
	source.QuantityOutOfService,
	SYSUTCDATETIME(),
	@SyntheticLogisticsLeadUserId
  );

/* ================================================================================================
   7) Synthetic Bed Availability Snapshots
================================================================================================ */
WITH SyntheticBedSeed AS
(
  SELECT * FROM (VALUES
	(N'Synthetic Wichita General', N'ICU', 92, 8, 76, 8, 14, 12),
	(N'Synthetic Wichita General', N'MedSurg', 210, 28, 160, 22, 35, 24),
	(N'Synthetic Topeka Regional', N'ICU', 58, 5, 48, 5, 8, 7),
	(N'Synthetic Topeka Regional', N'MedSurg', 160, 18, 124, 18, 20, 15),
	(N'Synthetic Dodge City Medical Center', N'ICU', 40, 3, 33, 4, 6, 5),
	(N'Synthetic Dodge City Medical Center', N'MedSurg', 122, 10, 92, 20, 12, 9)
  ) AS x(LocationName, BedCategoryCode, StaffedBedsTotal, BedsAvailable, BedsOccupied, BedsUnavailable, IsolationCapableBeds, SurgeBedsPotential)
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
  seed.BedCategoryCode,
  seed.StaffedBedsTotal,
  seed.BedsAvailable,
  seed.BedsOccupied,
  seed.BedsUnavailable,
  seed.IsolationCapableBeds,
  seed.SurgeBedsPotential,
  DATEADD(MINUTE, -ABS(CHECKSUM(NEWID())) % 90, SYSUTCDATETIME()),
  @SyntheticLogisticsLeadUserId,
  N'SYNTHETIC',
  CONCAT(N'SYNTH-BED-', loc.LocationId, N'-', seed.BedCategoryCode)
FROM SyntheticBedSeed seed
JOIN @LocationIds loc ON loc.LocationName = seed.LocationName;

/* ================================================================================================
   8) Synthetic Incident and Resource Requests (for lifecycle visualization)
================================================================================================ */
DECLARE @SyntheticIncidentId bigint = (
  SELECT TOP (1) IncidentId
  FROM ic.Incident
  WHERE IncidentNumber = N'SYN-LOG-2026-001'
);

IF @SyntheticIncidentId IS NULL
BEGIN
  INSERT ic.Incident
  (
	IncidentNumber,
	IncidentName,
	IncidentTypeCode,
	IncidentStatusCode,
	SeverityCode,
	PrimaryLocationId,
	IsPlannedEvent,
	ActivatedUtc,
	InitialSummary,
	SituationSummary,
	CreatedByUserId,
	CreatedUtc
  )
  VALUES
  (
	N'SYN-LOG-2026-001',
	N'Synthetic Regional Logistics Surge',
	N'PublicHealthEmergency',
	N'Active',
	N'High',
	(SELECT TOP (1) LocationId FROM @LocationIds WHERE LocationName = N'Synthetic Wichita General'),
	0,
	DATEADD(HOUR, -8, SYSUTCDATETIME()),
	N'Synthetic incident for logistics cockpit validation.',
	N'Multi-region supply and bed pressure scenario for UI and workflow testing.',
	@SyntheticOpsCommanderUserId,
	DATEADD(HOUR, -9, SYSUTCDATETIME())
  );

  SET @SyntheticIncidentId = SCOPE_IDENTITY();
END;

IF OBJECT_ID(N'ic.IncidentResourceRequest', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
	SELECT 1
	FROM ic.IncidentResourceRequest
	WHERE IncidentId = @SyntheticIncidentId
	  AND ResourceTypeCode = N'VENTILATOR'
	  AND Notes LIKE N'%synthetic logistics seed%'
  )
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
	(@SyntheticIncidentId, DATEADD(HOUR, -5, SYSUTCDATETIME()), N'VENTILATOR', N'Ventilator', 18, 10, N'EA', N'Critical', N'PartiallyFulfilled', N'Synthetic logistics seed: ventilator surge transfer.', @SyntheticLogisticsLeadUserId, DATEADD(HOUR, -5, SYSUTCDATETIME())),
	(@SyntheticIncidentId, DATEADD(HOUR, -4, SYSUTCDATETIME()), N'PPE_KIT', N'PPE Kit', 750, 0, N'EA', N'High', N'Requested', N'Synthetic logistics seed: PPE replenishment request.', @SyntheticLogisticsLeadUserId, DATEADD(HOUR, -4, SYSUTCDATETIME())),
	(@SyntheticIncidentId, DATEADD(HOUR, -3, SYSUTCDATETIME()), N'RN_STAFF', N'Registered Nurse Staff', 24, 12, N'FTE', N'High', N'Approved', N'Synthetic logistics seed: staffing support in-progress.', @SyntheticLogisticsLeadUserId, DATEADD(HOUR, -3, SYSUTCDATETIME()));
  END;
END;

COMMIT TRANSACTION;

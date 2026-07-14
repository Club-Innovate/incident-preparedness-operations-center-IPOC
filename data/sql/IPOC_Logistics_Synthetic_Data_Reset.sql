/*
File: IPOC_WEB.AppHost/planning/IPOC_Logistics_Synthetic_Data_Reset.sql
Purpose: Remove synthetic logistics seed data inserted by IPOC_Logistics_Synthetic_Data.sql.

Notes:
- Idempotent and safe to run multiple times.
- Targets synthetic records by known identifiers (names/codes/source markers).
- Intended for development/test/demo reset only.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @SyntheticIncidentNumber nvarchar(40) = N'SYN-LOG-2026-001';

DECLARE @SyntheticLocationNames TABLE (LocationName nvarchar(240) PRIMARY KEY);
INSERT INTO @SyntheticLocationNames(LocationName)
VALUES
  (N'Synthetic Wichita General'),
  (N'Synthetic Topeka Regional'),
  (N'Synthetic Dodge City Medical Center'),
  (N'Synthetic Region 4 Staging Warehouse');

DECLARE @SyntheticOrganizationNames TABLE (OrganizationName nvarchar(240) PRIMARY KEY);
INSERT INTO @SyntheticOrganizationNames(OrganizationName)
VALUES
  (N'Synthetic Region 1 Health Coalition'),
  (N'Synthetic Region 3 Medical Network'),
  (N'Synthetic Region 4 Emergency Logistics');

DECLARE @SyntheticRegionCodes TABLE (RegionCode nvarchar(40) PRIMARY KEY);
INSERT INTO @SyntheticRegionCodes(RegionCode)
VALUES
  (N'R1'),
  (N'R2'),
  (N'R3'),
  (N'R4'),
  (N'R5');

DECLARE @SyntheticResourceTypeCodes TABLE (ResourceTypeCode nvarchar(80) PRIMARY KEY);
INSERT INTO @SyntheticResourceTypeCodes(ResourceTypeCode)
VALUES
  (N'ICU_BED'),
  (N'MEDSURGE_BED'),
  (N'VENTILATOR'),
  (N'PPE_KIT'),
  (N'RN_STAFF'),
  (N'AMBULANCE_TEAM');

DECLARE @SyntheticLocationIds TABLE (LocationId bigint PRIMARY KEY);
INSERT INTO @SyntheticLocationIds(LocationId)
SELECT l.LocationId
FROM org.Location l
JOIN @SyntheticLocationNames s ON s.LocationName = l.LocationName;

DECLARE @SyntheticIncidentId bigint = (
  SELECT TOP (1) i.IncidentId
  FROM ic.Incident i
  WHERE i.IncidentNumber = @SyntheticIncidentNumber
);

IF OBJECT_ID(N'audit.AuditEvent', N'U') IS NOT NULL AND @SyntheticIncidentId IS NOT NULL
BEGIN
  DELETE FROM audit.AuditEvent
  WHERE IncidentId = @SyntheticIncidentId;
END;

IF OBJECT_ID(N'ic.IncidentResourceRequest', N'U') IS NOT NULL AND @SyntheticIncidentId IS NOT NULL
BEGIN
  DELETE FROM ic.IncidentResourceRequest
  WHERE IncidentId = @SyntheticIncidentId;
END;

IF OBJECT_ID(N'ic.ResourceAssignment', N'U') IS NOT NULL
BEGIN
  DELETE ra
  FROM ic.ResourceAssignment ra
  JOIN ic.ResourceRequest rr ON rr.ResourceRequestId = ra.ResourceRequestId
  WHERE rr.IncidentId = @SyntheticIncidentId;
END;

IF OBJECT_ID(N'ic.ResourceRequest', N'U') IS NOT NULL AND @SyntheticIncidentId IS NOT NULL
BEGIN
  DELETE FROM ic.ResourceRequest
  WHERE IncidentId = @SyntheticIncidentId;
END;

IF OBJECT_ID(N'ic.IncidentLocation', N'U') IS NOT NULL AND @SyntheticIncidentId IS NOT NULL
BEGIN
  DELETE FROM ic.IncidentLocation
  WHERE IncidentId = @SyntheticIncidentId;
END;

IF @SyntheticIncidentId IS NOT NULL
BEGIN
  DELETE FROM ic.Incident
  WHERE IncidentId = @SyntheticIncidentId;
END;

IF OBJECT_ID(N'res.BedAvailabilitySnapshot', N'U') IS NOT NULL
BEGIN
  DELETE FROM res.BedAvailabilitySnapshot
  WHERE (SourceSystemCode = N'SYNTHETIC' AND SourceMessageId LIKE N'SYNTH-BED-%')
	 OR LocationId IN (SELECT LocationId FROM @SyntheticLocationIds);
END;

IF OBJECT_ID(N'res.LocationResourceInventory', N'U') IS NOT NULL
BEGIN
  DELETE inv
  FROM res.LocationResourceInventory inv
  JOIN res.ResourceType rt ON rt.ResourceTypeId = inv.ResourceTypeId
  WHERE inv.LocationId IN (SELECT LocationId FROM @SyntheticLocationIds)
	AND rt.ResourceTypeCode IN (SELECT ResourceTypeCode FROM @SyntheticResourceTypeCodes);
END;

IF OBJECT_ID(N'res.ResourceType', N'U') IS NOT NULL
BEGIN
  DELETE FROM res.ResourceType
  WHERE ResourceTypeCode IN (SELECT ResourceTypeCode FROM @SyntheticResourceTypeCodes)
	AND NOT EXISTS (SELECT 1 FROM res.LocationResourceInventory inv WHERE inv.ResourceTypeId = res.ResourceType.ResourceTypeId)
	AND NOT EXISTS (SELECT 1 FROM ic.ResourceRequest rr WHERE rr.ResourceTypeId = res.ResourceType.ResourceTypeId)
	AND NOT EXISTS (SELECT 1 FROM ic.ResourceAssignment ra WHERE ra.AssignedResourceTypeId = res.ResourceType.ResourceTypeId)
	AND NOT EXISTS (SELECT 1 FROM res.ResourceStatusUpdate rsu WHERE rsu.ResourceTypeId = res.ResourceType.ResourceTypeId);
END;

IF OBJECT_ID(N'org.LocationContact', N'U') IS NOT NULL
BEGIN
  DELETE lc
  FROM org.LocationContact lc
  JOIN @SyntheticLocationIds s ON s.LocationId = lc.LocationId;
END;

DELETE l
FROM org.Location l
JOIN @SyntheticLocationNames s ON s.LocationName = l.LocationName;

DELETE o
FROM org.Organization o
JOIN @SyntheticOrganizationNames s ON s.OrganizationName = o.OrganizationName
WHERE NOT EXISTS (SELECT 1 FROM org.Location l WHERE l.OrganizationId = o.OrganizationId);

DELETE r
FROM org.Region r
JOIN @SyntheticRegionCodes s ON s.RegionCode = r.RegionCode
WHERE NOT EXISTS (SELECT 1 FROM org.Organization o WHERE o.RegionId = r.RegionId)
  AND NOT EXISTS (SELECT 1 FROM org.Location l WHERE l.RegionId = r.RegionId);

IF OBJECT_ID(N'sec.UserRoleAssignment', N'U') IS NOT NULL
BEGIN
  DELETE FROM sec.UserRoleAssignment
  WHERE UserId IN (
	SELECT u.UserId
	FROM sec.AppUser u
	WHERE u.UserPrincipalName IN (N'synthetic.ops.command@ipoc.local', N'synthetic.logistics.lead@ipoc.local')
  );
END;

IF OBJECT_ID(N'sec.UserSession', N'U') IS NOT NULL
BEGIN
  DELETE FROM sec.UserSession
  WHERE UserId IN (
	SELECT u.UserId
	FROM sec.AppUser u
	WHERE u.UserPrincipalName IN (N'synthetic.ops.command@ipoc.local', N'synthetic.logistics.lead@ipoc.local')
  );
END;

DELETE FROM sec.AppUser
WHERE UserPrincipalName IN (N'synthetic.ops.command@ipoc.local', N'synthetic.logistics.lead@ipoc.local')
  AND NOT EXISTS (SELECT 1 FROM res.LocationResourceInventory inv WHERE inv.LastReportedByUserId = sec.AppUser.UserId)
  AND NOT EXISTS (SELECT 1 FROM res.BedAvailabilitySnapshot bas WHERE bas.ReportedByUserId = sec.AppUser.UserId)
  AND NOT EXISTS (SELECT 1 FROM ic.Incident i WHERE i.CreatedByUserId = sec.AppUser.UserId)
  AND NOT EXISTS (SELECT 1 FROM ic.ResourceRequest rr WHERE rr.RequestedByUserId = sec.AppUser.UserId)
  AND NOT EXISTS (SELECT 1 FROM ic.IncidentResourceRequest irr WHERE irr.RequestedByUserId = sec.AppUser.UserId)
  AND NOT EXISTS (SELECT 1 FROM audit.AuditEvent ae WHERE ae.ActorUserId = sec.AppUser.UserId);

COMMIT TRANSACTION;

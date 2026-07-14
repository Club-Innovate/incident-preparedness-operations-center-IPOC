/*
File: IPOC_WEB.AppHost/planning/IPOC_Lookup_Migration.sql
Blueprint Name: LookupRuntimeMigration

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2026-06-23

Description:
Idempotent migration to establish runtime lookup code sets, seed values,
and lookup contributor/admin authorization mappings.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ================================================================================================
   1. Lookup Code Sets
================================================================================================ */
MERGE ref.CodeSet AS t
USING (VALUES
('IncidentType','Incident and planned event classification values'),
('Severity','Operational severity values'),
('IncidentStatus','Incident lifecycle status values'),
('TaskPriority','Incident task priority values'),
('TaskStatus','Incident task status values'),
('TimelineEventType','Incident timeline event type values'),
('ResourceType','Incident resource request type values')
) AS s(CodeSetName, Description)
ON t.CodeSetName = s.CodeSetName
WHEN MATCHED THEN
	UPDATE SET t.Description = s.Description
WHEN NOT MATCHED THEN
	INSERT(CodeSetName, Description, IsSystem)
	VALUES(s.CodeSetName, s.Description, 1);
GO

/* ================================================================================================
   2. Lookup Code Values
================================================================================================ */
;WITH seed AS
(
	SELECT *
	FROM (VALUES
		('IncidentType','PublicHealth','Public Health',10,'Public health incident'),
		('IncidentType','SevereWeather','Severe Weather',20,'Severe weather incident'),
		('IncidentType','Hazmat','Hazmat',30,'Hazardous materials incident'),
		('IncidentType','MassCasualty','Mass Casualty',40,'Mass casualty incident'),
		('IncidentType','Cybersecurity','Cybersecurity',50,'Cybersecurity incident'),
		('IncidentType','InfrastructureFailure','Infrastructure Failure',60,'Critical infrastructure failure'),

		('Severity','Low','Low',10,'Low operational severity'),
		('Severity','Moderate','Moderate',20,'Moderate operational severity'),
		('Severity','High','High',30,'High operational severity'),
		('Severity','Critical','Critical',40,'Critical operational severity'),
		('Severity','Catastrophic','Catastrophic',50,'Catastrophic operational severity'),

		('IncidentStatus','Draft','Draft',10,'Draft incident status'),
		('IncidentStatus','Active','Active',20,'Active incident status'),
		('IncidentStatus','Monitoring','Monitoring',30,'Monitoring incident status'),
		('IncidentStatus','Demobilizing','Demobilizing',40,'Demobilizing incident status'),
		('IncidentStatus','Closed','Closed',50,'Closed incident status'),
		('IncidentStatus','Archived','Archived',60,'Archived incident status'),

		('TaskPriority','Low','Low',10,'Low priority task'),
		('TaskPriority','Normal','Normal',20,'Normal priority task'),
		('TaskPriority','High','High',30,'High priority task'),
		('TaskPriority','Critical','Critical',40,'Critical priority task'),

		('TaskStatus','Open','Open',10,'Open task status'),
		('TaskStatus','Assigned','Assigned',20,'Assigned task status'),
		('TaskStatus','InProgress','In Progress',30,'Task in progress status'),
		('TaskStatus','Blocked','Blocked',40,'Blocked task status'),
		('TaskStatus','Completed','Completed',50,'Completed task status'),
		('TaskStatus','Cancelled','Cancelled',60,'Cancelled task status'),

		('TimelineEventType','OperationalUpdate','Operational Update',10,'Operational update timeline event'),
		('TimelineEventType','CommandDecision','Command Decision',20,'Command decision timeline event'),
		('TimelineEventType','ResourceDeployment','Resource Deployment',30,'Resource deployment timeline event'),
		('TimelineEventType','PublicInformation','Public Information',40,'Public information timeline event'),
		('TimelineEventType','SituationReport','Situation Report',50,'Situation report timeline event'),

		('ResourceType','Personnel','Personnel',10,'Personnel resources'),
		('ResourceType','Equipment','Equipment',20,'Equipment resources'),
		('ResourceType','Teams','Teams',30,'Team resources'),
		('ResourceType','MutualAidRequests','Mutual Aid Requests',40,'Mutual aid request resources'),
		('ResourceType','ResourceRequests_ICS213RR','Resource Requests (ICS-213RR)',50,'ICS-213RR resource request resources')
	) AS v(CodeSetName, Code, DisplayName, SortOrder, Description)
),
resolved AS
(
	SELECT
		cs.CodeSetId,
		s.Code,
		s.DisplayName,
		s.SortOrder,
		s.Description
	FROM seed s
	INNER JOIN ref.CodeSet cs ON cs.CodeSetName = s.CodeSetName
)
MERGE ref.CodeValue AS t
USING resolved AS s
ON t.CodeSetId = s.CodeSetId
AND t.Code = s.Code
WHEN MATCHED THEN
	UPDATE SET
		t.DisplayName = s.DisplayName,
		t.SortOrder = s.SortOrder,
		t.Description = s.Description,
		t.IsActive = 1
WHEN NOT MATCHED THEN
	INSERT(CodeSetId, Code, DisplayName, SortOrder, IsActive, Description)
	VALUES(s.CodeSetId, s.Code, s.DisplayName, s.SortOrder, 1, s.Description);
GO

/* ================================================================================================
   3. Lookup Permissions
================================================================================================ */
MERGE sec.Permission AS t
USING (VALUES
('lookup.view','View lookup values','Lookup','Read lookup values and active locations'),
('lookup.contribute','Manage lookup values','Lookup','Create and update lookup values including active flags'),
('lookup.admin','Administer lookup sets','Lookup','Administer lookup code sets and governance operations')
) AS s(PermissionCode, PermissionName, PermissionCategory, Description)
ON t.PermissionCode = s.PermissionCode
WHEN MATCHED THEN
	UPDATE SET
		t.PermissionName = s.PermissionName,
		t.PermissionCategory = s.PermissionCategory,
		t.Description = s.Description
WHEN NOT MATCHED THEN
	INSERT(PermissionCode, PermissionName, PermissionCategory, Description)
	VALUES(s.PermissionCode, s.PermissionName, s.PermissionCategory, s.Description);
GO

/* ================================================================================================
   4. Lookup Roles
================================================================================================ */
MERGE sec.Role AS t
USING (VALUES
('LOOKUP_CONTRIBUTOR','Lookup Contributor','STATE',0,'Can create and update lookup values'),
('LOOKUP_ADMIN','Lookup Administrator','STATE',1,'Can fully administer lookup values and governance')
) AS s(RoleCode, RoleName, RoleScopeType, IsPrivileged, Description)
ON t.RoleCode = s.RoleCode
WHEN MATCHED THEN
	UPDATE SET
		t.RoleName = s.RoleName,
		t.RoleScopeType = s.RoleScopeType,
		t.IsPrivileged = s.IsPrivileged,
		t.Description = s.Description,
		t.IsActive = 1
WHEN NOT MATCHED THEN
	INSERT(RoleCode, RoleName, RoleScopeType, Description, IsPrivileged, IsActive)
	VALUES(s.RoleCode, s.RoleName, s.RoleScopeType, s.Description, s.IsPrivileged, 1);
GO

/* ================================================================================================
   5. Role-Permission Mapping
================================================================================================ */
;WITH rolePermSeed AS
(
	SELECT *
	FROM (VALUES
		('SYSTEM_ADMIN','lookup.view'),
		('SYSTEM_ADMIN','lookup.contribute'),
		('SYSTEM_ADMIN','lookup.admin'),

		('KDHE_ADMIN','lookup.view'),
		('KDHE_ADMIN','lookup.contribute'),
		('KDHE_ADMIN','lookup.admin'),

		('INCIDENT_COMMANDER','lookup.view'),
		('INCIDENT_COMMANDER','lookup.contribute'),

		('LOOKUP_CONTRIBUTOR','lookup.view'),
		('LOOKUP_CONTRIBUTOR','lookup.contribute'),

		('LOOKUP_ADMIN','lookup.view'),
		('LOOKUP_ADMIN','lookup.contribute'),
		('LOOKUP_ADMIN','lookup.admin')
	) AS v(RoleCode, PermissionCode)
),
resolved AS
(
	SELECT r.RoleId, p.PermissionId
	FROM rolePermSeed s
	INNER JOIN sec.Role r ON r.RoleCode = s.RoleCode
	INNER JOIN sec.Permission p ON p.PermissionCode = s.PermissionCode
)
INSERT INTO sec.RolePermission(RoleId, PermissionId)
SELECT r.RoleId, r.PermissionId
FROM resolved r
WHERE NOT EXISTS
(
	SELECT 1
	FROM sec.RolePermission rp
	WHERE rp.RoleId = r.RoleId
	  AND rp.PermissionId = r.PermissionId
);
GO

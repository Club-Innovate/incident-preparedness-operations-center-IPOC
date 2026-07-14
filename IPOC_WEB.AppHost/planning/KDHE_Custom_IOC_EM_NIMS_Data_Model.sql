
/***************************************************************************************************
KDHE Custom IOC for EM - NIMS/ICS-Aligned Data Model
Target Platform: Microsoft Azure SQL Database / SQL Server 2022+
Purpose: Production-grade relational foundation for a scalable electronic Incident Command System
         and Bed Availability / Resource Management platform.

Design Principles
- NIMS/ICS aligned: Incident, Operational Period, ICS role assignment, objectives, IAP, SITREP,
  resource requests/status changes, incident check-in, AAR/IP, HVA, and common operating picture.
- Public health / healthcare adapted: locations/facilities, bed/resource availability, contacts,
  EEI prompts/responses, regional/statewide views, and no patient-level / patient movement records.
- Security by design: RBAC, auditability, unique user identity, MFA context, impersonation controls,
  export audit, immutable append-oriented operational log tables, and U.S. data residency metadata.
- Scalability: normalized operational core, JSON for configurable EEI payloads, filtered indexes for
  active incident operations, rowversion for concurrency, and partition-ready audit/message tables.
- Integration-ready: API client registry, inbound interface messages, outbox events for Service Bus,
  and reconciliation/error tracking for EHR/HL7/FHIR-style bed availability imports.

IMPORTANT
- This script creates schemas, core tables, constraints, indexes, seed reference data, and representative
  stored procedures. It intentionally avoids sample/mock operational records.
- Review data retention, encryption key strategy, and environment-specific options with KDHE DBAs before
  production deployment.
***************************************************************************************************/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ================================================================================================
   1. Schemas
================================================================================================ */
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ref') EXEC('CREATE SCHEMA ref');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'sec') EXEC('CREATE SCHEMA sec');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'org') EXEC('CREATE SCHEMA org');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ic') EXEC('CREATE SCHEMA ic');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'res') EXEC('CREATE SCHEMA res');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'eei') EXEC('CREATE SCHEMA eei');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'comm') EXEC('CREATE SCHEMA comm');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'doc') EXEC('CREATE SCHEMA doc');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'assessment') EXEC('CREATE SCHEMA assessment');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'audit') EXEC('CREATE SCHEMA audit');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'intg') EXEC('CREATE SCHEMA intg');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'app') EXEC('CREATE SCHEMA app');
GO

/* ================================================================================================
   2. Reference Data
================================================================================================ */
CREATE TABLE ref.CodeSet (
    CodeSetId           int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ref_CodeSet PRIMARY KEY,
    CodeSetName         sysname NOT NULL CONSTRAINT UQ_ref_CodeSet_CodeSetName UNIQUE,
    Description         nvarchar(500) NULL,
    IsSystem            bit NOT NULL CONSTRAINT DF_ref_CodeSet_IsSystem DEFAULT (1)
);
GO

CREATE TABLE ref.CodeValue (
    CodeValueId         int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ref_CodeValue PRIMARY KEY,
    CodeSetId           int NOT NULL CONSTRAINT FK_ref_CodeValue_CodeSet FOREIGN KEY REFERENCES ref.CodeSet(CodeSetId),
    Code                nvarchar(80) NOT NULL,
    DisplayName         nvarchar(200) NOT NULL,
    SortOrder           int NOT NULL CONSTRAINT DF_ref_CodeValue_SortOrder DEFAULT (100),
    IsActive            bit NOT NULL CONSTRAINT DF_ref_CodeValue_IsActive DEFAULT (1),
    Description         nvarchar(1000) NULL,
    CONSTRAINT UQ_ref_CodeValue_CodeSet_Code UNIQUE (CodeSetId, Code)
);
GO

CREATE TABLE ref.IcsPosition (
    IcsPositionId       int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ref_IcsPosition PRIMARY KEY,
    PositionCode        nvarchar(40) NOT NULL CONSTRAINT UQ_ref_IcsPosition_Code UNIQUE,
    PositionName        nvarchar(160) NOT NULL,
    IcsSection          nvarchar(80) NOT NULL,
    ParentPositionCode  nvarchar(40) NULL,
    SortOrder           int NOT NULL CONSTRAINT DF_ref_IcsPosition_SortOrder DEFAULT (100),
    IsNimsStandard      bit NOT NULL CONSTRAINT DF_ref_IcsPosition_IsNimsStandard DEFAULT (1),
    Description         nvarchar(1000) NULL
);
GO

/* ================================================================================================
   3. Security / Identity / RBAC
================================================================================================ */
CREATE TABLE sec.AppUser (
    UserId              bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_sec_AppUser PRIMARY KEY,
    EntraObjectId       uniqueidentifier NOT NULL CONSTRAINT UQ_sec_AppUser_EntraObjectId UNIQUE,
    UserPrincipalName   nvarchar(320) NOT NULL CONSTRAINT UQ_sec_AppUser_UPN UNIQUE,
    DisplayName         nvarchar(200) NOT NULL,
    EmailAddress        nvarchar(320) NULL,
    PhoneNumber         nvarchar(50) NULL,
    IsActive            bit NOT NULL CONSTRAINT DF_sec_AppUser_IsActive DEFAULT (1),
    IsExternalUser      bit NOT NULL CONSTRAINT DF_sec_AppUser_IsExternalUser DEFAULT (0),
    LastSuccessfulLoginUtc datetime2(3) NULL,
    LastMfaSatisfiedUtc datetime2(3) NULL,
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_sec_AppUser_CreatedUtc DEFAULT SYSUTCDATETIME(),
    UpdatedUtc          datetime2(3) NULL,
    RowVer              rowversion NOT NULL
);
GO

CREATE TABLE sec.Role (
    RoleId              int IDENTITY(1,1) NOT NULL CONSTRAINT PK_sec_Role PRIMARY KEY,
    RoleCode            nvarchar(80) NOT NULL CONSTRAINT UQ_sec_Role_RoleCode UNIQUE,
    RoleName            nvarchar(160) NOT NULL,
    RoleScopeType       nvarchar(40) NOT NULL, -- STATE, REGION, ORGANIZATION, LOCATION, INCIDENT
    Description         nvarchar(1000) NULL,
    IsPrivileged        bit NOT NULL CONSTRAINT DF_sec_Role_IsPrivileged DEFAULT (0),
    IsActive            bit NOT NULL CONSTRAINT DF_sec_Role_IsActive DEFAULT (1),
    CONSTRAINT CK_sec_Role_Scope CHECK (RoleScopeType IN ('STATE','REGION','ORGANIZATION','LOCATION','INCIDENT'))
);
GO

CREATE TABLE sec.Permission (
    PermissionId        int IDENTITY(1,1) NOT NULL CONSTRAINT PK_sec_Permission PRIMARY KEY,
    PermissionCode      nvarchar(120) NOT NULL CONSTRAINT UQ_sec_Permission_Code UNIQUE,
    PermissionName      nvarchar(200) NOT NULL,
    PermissionCategory  nvarchar(80) NOT NULL,
    Description         nvarchar(1000) NULL
);
GO

CREATE TABLE sec.RolePermission (
    RoleId              int NOT NULL CONSTRAINT FK_sec_RolePermission_Role FOREIGN KEY REFERENCES sec.Role(RoleId),
    PermissionId        int NOT NULL CONSTRAINT FK_sec_RolePermission_Permission FOREIGN KEY REFERENCES sec.Permission(PermissionId),
    CONSTRAINT PK_sec_RolePermission PRIMARY KEY (RoleId, PermissionId)
);
GO

CREATE TABLE sec.UserRoleAssignment (
    UserRoleAssignmentId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_sec_UserRoleAssignment PRIMARY KEY,
    UserId              bigint NOT NULL CONSTRAINT FK_sec_UserRoleAssignment_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    RoleId              int NOT NULL CONSTRAINT FK_sec_UserRoleAssignment_Role FOREIGN KEY REFERENCES sec.Role(RoleId),
    OrganizationId      bigint NULL,
    LocationId          bigint NULL,
    RegionId            int NULL,
    IncidentId          bigint NULL,
    EffectiveFromUtc    datetime2(3) NOT NULL CONSTRAINT DF_sec_UserRoleAssignment_From DEFAULT SYSUTCDATETIME(),
    EffectiveToUtc      datetime2(3) NULL,
    AssignedByUserId    bigint NULL CONSTRAINT FK_sec_UserRoleAssignment_AssignedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    AssignmentReason    nvarchar(500) NULL,
    IsActive            AS (CONVERT(bit, CASE WHEN EffectiveToUtc IS NULL OR EffectiveToUtc > SYSUTCDATETIME() THEN 1 ELSE 0 END)),
    CONSTRAINT CK_sec_UserRoleAssignment_Scope CHECK (
        (OrganizationId IS NOT NULL) OR (LocationId IS NOT NULL) OR (RegionId IS NOT NULL) OR (IncidentId IS NOT NULL) OR
        (OrganizationId IS NULL AND LocationId IS NULL AND RegionId IS NULL AND IncidentId IS NULL)
    )
);
GO

CREATE TABLE sec.UserSession (
    UserSessionId       bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_sec_UserSession PRIMARY KEY,
    UserId              bigint NOT NULL CONSTRAINT FK_sec_UserSession_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    EntraSessionId      nvarchar(200) NULL,
    LoginUtc            datetime2(3) NOT NULL CONSTRAINT DF_sec_UserSession_Login DEFAULT SYSUTCDATETIME(),
    LastSeenUtc         datetime2(3) NULL,
    LogoutUtc           datetime2(3) NULL,
    MfaSatisfied        bit NOT NULL CONSTRAINT DF_sec_UserSession_Mfa DEFAULT (0),
    ClientIpAddress     varchar(45) NULL,
    UserAgentHash       varbinary(32) NULL,
    SessionStatus       nvarchar(30) NOT NULL CONSTRAINT DF_sec_UserSession_Status DEFAULT ('Active'),
    TerminatedByUserId  bigint NULL CONSTRAINT FK_sec_UserSession_TerminatedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    TerminationReason   nvarchar(500) NULL,
    CONSTRAINT CK_sec_UserSession_Status CHECK (SessionStatus IN ('Active','Expired','Terminated','Revoked'))
);
GO

CREATE TABLE sec.AdminImpersonationSession (
    ImpersonationSessionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_sec_AdminImpersonationSession PRIMARY KEY,
    AdminUserId         bigint NOT NULL CONSTRAINT FK_sec_Impersonation_Admin FOREIGN KEY REFERENCES sec.AppUser(UserId),
    TargetUserId        bigint NOT NULL CONSTRAINT FK_sec_Impersonation_Target FOREIGN KEY REFERENCES sec.AppUser(UserId),
    StartedUtc          datetime2(3) NOT NULL CONSTRAINT DF_sec_Impersonation_Started DEFAULT SYSUTCDATETIME(),
    EndedUtc            datetime2(3) NULL,
    Justification       nvarchar(1000) NOT NULL,
    ApprovedByUserId    bigint NULL CONSTRAINT FK_sec_Impersonation_ApprovedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    CONSTRAINT CK_sec_Impersonation_DifferentUsers CHECK (AdminUserId <> TargetUserId)
);
GO

/* ================================================================================================
   4. Organization, Region, Location, Facility, Contacts
================================================================================================ */
CREATE TABLE org.Region (
    RegionId            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_org_Region PRIMARY KEY,
    RegionCode          nvarchar(40) NOT NULL CONSTRAINT UQ_org_Region_Code UNIQUE,
    RegionName          nvarchar(160) NOT NULL,
    IsActive            bit NOT NULL CONSTRAINT DF_org_Region_IsActive DEFAULT (1)
);
GO

CREATE TABLE org.Organization (
    OrganizationId      bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_org_Organization PRIMARY KEY,
    OrganizationTypeCode nvarchar(60) NOT NULL, -- KDHE, LHD, HOSPITAL, HCC, EMS, EOC, VENDOR, PARTNER
    OrganizationName    nvarchar(240) NOT NULL,
    LegalName           nvarchar(300) NULL,
    RegionId            int NULL CONSTRAINT FK_org_Organization_Region FOREIGN KEY REFERENCES org.Region(RegionId),
    ParentOrganizationId bigint NULL CONSTRAINT FK_org_Organization_Parent FOREIGN KEY REFERENCES org.Organization(OrganizationId),
    ExternalIdentifier  nvarchar(120) NULL,
    IsActive            bit NOT NULL CONSTRAINT DF_org_Organization_IsActive DEFAULT (1),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_org_Organization_Created DEFAULT SYSUTCDATETIME(),
    UpdatedUtc          datetime2(3) NULL,
    RowVer              rowversion NOT NULL
);
GO

CREATE TABLE org.Location (
    LocationId          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_org_Location PRIMARY KEY,
    OrganizationId      bigint NOT NULL CONSTRAINT FK_org_Location_Organization FOREIGN KEY REFERENCES org.Organization(OrganizationId),
    LocationTypeCode    nvarchar(60) NOT NULL, -- HOSPITAL, CLINIC, LHD, EOC, WAREHOUSE, ALTERNATE_CARE, OTHER
    LocationName        nvarchar(240) NOT NULL,
    FacilityIdentifier  nvarchar(120) NULL,
    RegionId            int NULL CONSTRAINT FK_org_Location_Region FOREIGN KEY REFERENCES org.Region(RegionId),
    AddressLine1        nvarchar(200) NULL,
    AddressLine2        nvarchar(200) NULL,
    City                nvarchar(120) NULL,
    StateCode           char(2) NOT NULL CONSTRAINT DF_org_Location_State DEFAULT ('KS'),
    PostalCode          nvarchar(20) NULL,
    CountyName          nvarchar(120) NULL,
    Latitude            decimal(9,6) NULL,
    Longitude           decimal(9,6) NULL,
    TimeZoneName        nvarchar(80) NOT NULL CONSTRAINT DF_org_Location_TZ DEFAULT ('Central Standard Time'),
    IsActive            bit NOT NULL CONSTRAINT DF_org_Location_IsActive DEFAULT (1),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_org_Location_Created DEFAULT SYSUTCDATETIME(),
    UpdatedUtc          datetime2(3) NULL,
    RowVer              rowversion NOT NULL,
    CONSTRAINT CK_org_Location_LatLong CHECK ((Latitude IS NULL AND Longitude IS NULL) OR (Latitude BETWEEN -90 AND 90 AND Longitude BETWEEN -180 AND 180))
);
GO

CREATE TABLE org.Contact (
    ContactId           bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_org_Contact PRIMARY KEY,
    DisplayName         nvarchar(200) NOT NULL,
    Title               nvarchar(160) NULL,
    EmailAddress        nvarchar(320) NULL,
    MobilePhone         nvarchar(50) NULL,
    OfficePhone         nvarchar(50) NULL,
    IsEmergencyContact  bit NOT NULL CONSTRAINT DF_org_Contact_Emergency DEFAULT (0),
    IsActive            bit NOT NULL CONSTRAINT DF_org_Contact_IsActive DEFAULT (1),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_org_Contact_Created DEFAULT SYSUTCDATETIME(),
    UpdatedUtc          datetime2(3) NULL
);
GO

CREATE TABLE org.LocationContact (
    LocationContactId   bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_org_LocationContact PRIMARY KEY,
    LocationId          bigint NOT NULL CONSTRAINT FK_org_LocationContact_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    ContactId           bigint NOT NULL CONSTRAINT FK_org_LocationContact_Contact FOREIGN KEY REFERENCES org.Contact(ContactId),
    ContactRoleCode     nvarchar(80) NOT NULL, -- ADMIN, FACILITY_LEAD, RESOURCE_CONTACT, INCIDENT_CONTACT, PUBLIC_INFO, OTHER
    PriorityOrder       int NOT NULL CONSTRAINT DF_org_LocationContact_Priority DEFAULT (100),
    IsActive            bit NOT NULL CONSTRAINT DF_org_LocationContact_IsActive DEFAULT (1),
    CONSTRAINT UQ_org_LocationContact UNIQUE (LocationId, ContactId, ContactRoleCode)
);
GO

/* ================================================================================================
   5. Resource Catalog, Inventory, Bed Availability
================================================================================================ */
CREATE TABLE res.ResourceType (
    ResourceTypeId      int IDENTITY(1,1) NOT NULL CONSTRAINT PK_res_ResourceType PRIMARY KEY,
    ResourceCategoryCode nvarchar(80) NOT NULL, -- BED, STAFF, SUPPLY, EQUIPMENT, SERVICE, SPACE, VEHICLE
    ResourceTypeCode    nvarchar(80) NOT NULL CONSTRAINT UQ_res_ResourceType_Code UNIQUE,
    ResourceTypeName    nvarchar(200) NOT NULL,
    UnitOfMeasure       nvarchar(40) NOT NULL CONSTRAINT DF_res_ResourceType_UOM DEFAULT ('EA'),
    IsReusable          bit NOT NULL CONSTRAINT DF_res_ResourceType_Reusable DEFAULT (1),
    IsBedCategory       bit NOT NULL CONSTRAINT DF_res_ResourceType_Bed DEFAULT (0),
    IsActive            bit NOT NULL CONSTRAINT DF_res_ResourceType_Active DEFAULT (1)
);
GO

CREATE TABLE res.LocationResourceInventory (
    LocationResourceInventoryId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_res_LocationResourceInventory PRIMARY KEY,
    LocationId          bigint NOT NULL CONSTRAINT FK_res_LocationResourceInventory_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    ResourceTypeId      int NOT NULL CONSTRAINT FK_res_LocationResourceInventory_Type FOREIGN KEY REFERENCES res.ResourceType(ResourceTypeId),
    QuantityTotal       decimal(18,4) NOT NULL CONSTRAINT DF_res_LocationResourceInventory_Total DEFAULT (0),
    QuantityAvailable   decimal(18,4) NOT NULL CONSTRAINT DF_res_LocationResourceInventory_Available DEFAULT (0),
    QuantityCommitted   decimal(18,4) NOT NULL CONSTRAINT DF_res_LocationResourceInventory_Committed DEFAULT (0),
    QuantityOutOfService decimal(18,4) NOT NULL CONSTRAINT DF_res_LocationResourceInventory_OOS DEFAULT (0),
    LastReportedUtc     datetime2(3) NULL,
    LastReportedByUserId bigint NULL CONSTRAINT FK_res_LocationResourceInventory_ReportedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    RowVer              rowversion NOT NULL,
    CONSTRAINT CK_res_LocationResourceInventory_Qty CHECK (QuantityTotal >= 0 AND QuantityAvailable >= 0 AND QuantityCommitted >= 0 AND QuantityOutOfService >= 0),
    CONSTRAINT UQ_res_LocationResourceInventory UNIQUE(LocationId, ResourceTypeId)
);
GO

CREATE TABLE res.ResourceStatusUpdate (
    ResourceStatusUpdateId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_res_ResourceStatusUpdate PRIMARY KEY,
    LocationId          bigint NOT NULL CONSTRAINT FK_res_StatusUpdate_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    ResourceTypeId      int NOT NULL CONSTRAINT FK_res_StatusUpdate_Type FOREIGN KEY REFERENCES res.ResourceType(ResourceTypeId),
    IncidentId          bigint NULL,
    PromptId            bigint NULL,
    QuantityTotal       decimal(18,4) NULL,
    QuantityAvailable   decimal(18,4) NULL,
    StatusCode          nvarchar(60) NOT NULL CONSTRAINT DF_res_StatusUpdate_Status DEFAULT ('Reported'),
    StatusNotes         nvarchar(2000) NULL,
    ReportedUtc         datetime2(3) NOT NULL CONSTRAINT DF_res_StatusUpdate_Reported DEFAULT SYSUTCDATETIME(),
    ReportedByUserId    bigint NULL CONSTRAINT FK_res_StatusUpdate_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    SourceSystemCode    nvarchar(80) NULL,
    SourceMessageId     nvarchar(200) NULL,
    PayloadJson         nvarchar(max) NULL,
    CONSTRAINT CK_res_StatusUpdate_PayloadJson CHECK (PayloadJson IS NULL OR ISJSON(PayloadJson) = 1)
);
GO

CREATE TABLE res.BedAvailabilitySnapshot (
    BedAvailabilitySnapshotId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_res_BedAvailabilitySnapshot PRIMARY KEY,
    LocationId          bigint NOT NULL CONSTRAINT FK_res_BedSnapshot_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    IncidentId          bigint NULL,
    PromptId            bigint NULL,
    BedCategoryCode     nvarchar(80) NOT NULL,
    StaffedBedsTotal    int NULL,
    BedsAvailable       int NULL,
    BedsOccupied        int NULL,
    BedsUnavailable     int NULL,
    IsolationCapableBeds int NULL,
    SurgeBedsPotential  int NULL,
    ReportedUtc         datetime2(3) NOT NULL CONSTRAINT DF_res_BedSnapshot_Reported DEFAULT SYSUTCDATETIME(),
    ReportedByUserId    bigint NULL CONSTRAINT FK_res_BedSnapshot_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    SourceSystemCode    nvarchar(80) NULL,
    SourceMessageId     nvarchar(200) NULL,
    CONSTRAINT CK_res_BedSnapshot_NonNegative CHECK (
        (StaffedBedsTotal IS NULL OR StaffedBedsTotal >= 0) AND
        (BedsAvailable IS NULL OR BedsAvailable >= 0) AND
        (BedsOccupied IS NULL OR BedsOccupied >= 0) AND
        (BedsUnavailable IS NULL OR BedsUnavailable >= 0) AND
        (IsolationCapableBeds IS NULL OR IsolationCapableBeds >= 0) AND
        (SurgeBedsPotential IS NULL OR SurgeBedsPotential >= 0)
    )
);
GO

/* ================================================================================================
   6. Incident Command System Core
================================================================================================ */
CREATE TABLE ic.Incident (
    IncidentId          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_Incident PRIMARY KEY,
    IncidentNumber      nvarchar(40) NOT NULL CONSTRAINT UQ_ic_Incident_Number UNIQUE,
    IncidentName        nvarchar(240) NOT NULL,
    IncidentTypeCode    nvarchar(80) NOT NULL,
    IncidentStatusCode  nvarchar(60) NOT NULL CONSTRAINT DF_ic_Incident_Status DEFAULT ('Draft'),
    SeverityCode        nvarchar(60) NULL,
    LeadOrganizationId  bigint NULL CONSTRAINT FK_ic_Incident_LeadOrg FOREIGN KEY REFERENCES org.Organization(OrganizationId),
    LeadRegionId        int NULL CONSTRAINT FK_ic_Incident_LeadRegion FOREIGN KEY REFERENCES org.Region(RegionId),
    PrimaryLocationId   bigint NULL CONSTRAINT FK_ic_Incident_PrimaryLocation FOREIGN KEY REFERENCES org.Location(LocationId),
    IsPlannedEvent      bit NOT NULL CONSTRAINT DF_ic_Incident_IsPlannedEvent DEFAULT (0),
    StartedUtc          datetime2(3) NULL,
    ActivatedUtc        datetime2(3) NULL,
    ClosedUtc           datetime2(3) NULL,
    InitialSummary      nvarchar(max) NULL,
    SituationSummary    nvarchar(max) NULL,
    CreatedByUserId     bigint NOT NULL CONSTRAINT FK_ic_Incident_CreatedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_ic_Incident_Created DEFAULT SYSUTCDATETIME(),
    UpdatedUtc          datetime2(3) NULL,
    RowVer              rowversion NOT NULL,
    CONSTRAINT CK_ic_Incident_Status CHECK (IncidentStatusCode IN ('Draft','Active','Monitoring','Demobilizing','Closed','Archived'))
);
GO

CREATE TABLE ic.IncidentLocation (
    IncidentLocationId  bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_IncidentLocation PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_IncidentLocation_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    LocationId          bigint NOT NULL CONSTRAINT FK_ic_IncidentLocation_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    RelationshipCode    nvarchar(80) NOT NULL, -- AFFECTED, RESPONDING, RESOURCE_SOURCE, RESOURCE_DESTINATION, SHELTER, EOC
    ImpactStatusCode    nvarchar(80) NULL,
    IsPrimary           bit NOT NULL CONSTRAINT DF_ic_IncidentLocation_IsPrimary DEFAULT (0),
    AddedUtc            datetime2(3) NOT NULL CONSTRAINT DF_ic_IncidentLocation_Added DEFAULT SYSUTCDATETIME(),
    AddedByUserId       bigint NULL CONSTRAINT FK_ic_IncidentLocation_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    CONSTRAINT UQ_ic_IncidentLocation UNIQUE (IncidentId, LocationId, RelationshipCode)
);
GO

CREATE TABLE ic.IncidentOperationalPeriod (
    OperationalPeriodId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_OperationalPeriod PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_OperationalPeriod_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    PeriodNumber        int NOT NULL,
    PeriodName          nvarchar(120) NULL,
    StartUtc            datetime2(3) NOT NULL,
    EndUtc              datetime2(3) NOT NULL,
    StatusCode          nvarchar(40) NOT NULL CONSTRAINT DF_ic_OperationalPeriod_Status DEFAULT ('Planned'),
    PlanningMeetingUtc  datetime2(3) NULL,
    ApprovedByUserId    bigint NULL CONSTRAINT FK_ic_OperationalPeriod_ApprovedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ApprovedUtc         datetime2(3) NULL,
    CONSTRAINT UQ_ic_OperationalPeriod UNIQUE(IncidentId, PeriodNumber),
    CONSTRAINT CK_ic_OperationalPeriod_Dates CHECK (EndUtc > StartUtc),
    CONSTRAINT CK_ic_OperationalPeriod_Status CHECK (StatusCode IN ('Planned','Active','Closed','Cancelled'))
);
GO

CREATE TABLE ic.IncidentCommandAssignment (
    IncidentCommandAssignmentId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_CommandAssignment PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_CommandAssignment_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    OperationalPeriodId bigint NULL CONSTRAINT FK_ic_CommandAssignment_Period FOREIGN KEY REFERENCES ic.IncidentOperationalPeriod(OperationalPeriodId),
    IcsPositionId       int NOT NULL CONSTRAINT FK_ic_CommandAssignment_Position FOREIGN KEY REFERENCES ref.IcsPosition(IcsPositionId),
    AssignedUserId      bigint NULL CONSTRAINT FK_ic_CommandAssignment_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    AssignedContactId   bigint NULL CONSTRAINT FK_ic_CommandAssignment_Contact FOREIGN KEY REFERENCES org.Contact(ContactId),
    AgencyOrganizationId bigint NULL CONSTRAINT FK_ic_CommandAssignment_Org FOREIGN KEY REFERENCES org.Organization(OrganizationId),
    AssignedFromUtc     datetime2(3) NOT NULL CONSTRAINT DF_ic_CommandAssignment_From DEFAULT SYSUTCDATETIME(),
    AssignedToUtc       datetime2(3) NULL,
    AssignmentStatusCode nvarchar(40) NOT NULL CONSTRAINT DF_ic_CommandAssignment_Status DEFAULT ('Assigned'),
    Notes               nvarchar(1000) NULL,
    CONSTRAINT CK_ic_CommandAssignment_Assignee CHECK (AssignedUserId IS NOT NULL OR AssignedContactId IS NOT NULL),
    CONSTRAINT CK_ic_CommandAssignment_Status CHECK (AssignmentStatusCode IN ('Assigned','Accepted','Released','Declined'))
);
GO

CREATE TABLE ic.IncidentObjective (
    IncidentObjectiveId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_IncidentObjective PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_Objective_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    OperationalPeriodId bigint NULL CONSTRAINT FK_ic_Objective_Period FOREIGN KEY REFERENCES ic.IncidentOperationalPeriod(OperationalPeriodId),
    ObjectiveNumber     int NOT NULL,
    ObjectiveText       nvarchar(2000) NOT NULL,
    PriorityCode        nvarchar(40) NOT NULL CONSTRAINT DF_ic_Objective_Priority DEFAULT ('Normal'),
    StatusCode          nvarchar(40) NOT NULL CONSTRAINT DF_ic_Objective_Status DEFAULT ('Open'),
    OwnerUserId         bigint NULL CONSTRAINT FK_ic_Objective_Owner FOREIGN KEY REFERENCES sec.AppUser(UserId),
    DueUtc              datetime2(3) NULL,
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_ic_Objective_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_ic_Objective UNIQUE(IncidentId, OperationalPeriodId, ObjectiveNumber),
    CONSTRAINT CK_ic_Objective_Status CHECK (StatusCode IN ('Open','InProgress','Completed','Cancelled'))
);
GO

CREATE TABLE ic.IncidentTask (
    IncidentTaskId      bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_IncidentTask PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_Task_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    OperationalPeriodId bigint NULL CONSTRAINT FK_ic_Task_Period FOREIGN KEY REFERENCES ic.IncidentOperationalPeriod(OperationalPeriodId),
    IncidentObjectiveId bigint NULL CONSTRAINT FK_ic_Task_Objective FOREIGN KEY REFERENCES ic.IncidentObjective(IncidentObjectiveId),
    TaskNumber          nvarchar(50) NULL,
    TaskTitle           nvarchar(240) NOT NULL,
    TaskDescription     nvarchar(max) NULL,
    AssignedToUserId    bigint NULL CONSTRAINT FK_ic_Task_AssignedUser FOREIGN KEY REFERENCES sec.AppUser(UserId),
    AssignedToLocationId bigint NULL CONSTRAINT FK_ic_Task_AssignedLocation FOREIGN KEY REFERENCES org.Location(LocationId),
    PriorityCode        nvarchar(40) NOT NULL CONSTRAINT DF_ic_Task_Priority DEFAULT ('Normal'),
    StatusCode          nvarchar(40) NOT NULL CONSTRAINT DF_ic_Task_Status DEFAULT ('Open'),
    DueUtc              datetime2(3) NULL,
    CompletedUtc        datetime2(3) NULL,
    CreatedByUserId     bigint NOT NULL CONSTRAINT FK_ic_Task_CreatedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_ic_Task_Created DEFAULT SYSUTCDATETIME(),
    UpdatedUtc          datetime2(3) NULL,
    RowVer              rowversion NOT NULL,
    CONSTRAINT CK_ic_Task_Status CHECK (StatusCode IN ('Open','Assigned','InProgress','Blocked','Completed','Cancelled'))
);
GO

CREATE TABLE ic.IncidentActionPlan (
    IncidentActionPlanId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_IAP PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_IAP_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    OperationalPeriodId bigint NOT NULL CONSTRAINT FK_ic_IAP_Period FOREIGN KEY REFERENCES ic.IncidentOperationalPeriod(OperationalPeriodId),
    IapVersion          int NOT NULL CONSTRAINT DF_ic_IAP_Version DEFAULT (1),
    IapStatusCode       nvarchar(40) NOT NULL CONSTRAINT DF_ic_IAP_Status DEFAULT ('Draft'),
    PreparedByUserId    bigint NOT NULL CONSTRAINT FK_ic_IAP_PreparedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ApprovedByUserId    bigint NULL CONSTRAINT FK_ic_IAP_ApprovedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ApprovedUtc         datetime2(3) NULL,
    PublishedUtc        datetime2(3) NULL,
    IapSummary          nvarchar(max) NULL,
    CONSTRAINT UQ_ic_IAP UNIQUE(IncidentId, OperationalPeriodId, IapVersion),
    CONSTRAINT CK_ic_IAP_Status CHECK (IapStatusCode IN ('Draft','Submitted','Approved','Published','Superseded','Cancelled'))
);
GO

CREATE TABLE ic.IcsFormInstance (
    IcsFormInstanceId   bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_IcsFormInstance PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_IcsForm_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    OperationalPeriodId bigint NULL CONSTRAINT FK_ic_IcsForm_Period FOREIGN KEY REFERENCES ic.IncidentOperationalPeriod(OperationalPeriodId),
    IncidentActionPlanId bigint NULL CONSTRAINT FK_ic_IcsForm_IAP FOREIGN KEY REFERENCES ic.IncidentActionPlan(IncidentActionPlanId),
    IcsFormCode         nvarchar(20) NOT NULL, -- ICS201, ICS202, ICS203, ICS204, ICS205, ICS205A, ICS206, ICS207, ICS208, ICS209, ICS210, ICS211, ICS213, ICS214, ICS215, ICS215A, ICS221, AARIP, HVA
    FormStatusCode      nvarchar(40) NOT NULL CONSTRAINT DF_ic_IcsForm_Status DEFAULT ('Draft'),
    FormPayloadJson     nvarchar(max) NOT NULL,
    PreparedByUserId    bigint NOT NULL CONSTRAINT FK_ic_IcsForm_PreparedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    PreparedUtc         datetime2(3) NOT NULL CONSTRAINT DF_ic_IcsForm_Prepared DEFAULT SYSUTCDATETIME(),
    ApprovedByUserId    bigint NULL CONSTRAINT FK_ic_IcsForm_ApprovedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ApprovedUtc         datetime2(3) NULL,
    RowVer              rowversion NOT NULL,
    CONSTRAINT CK_ic_IcsForm_FormPayloadJson CHECK (ISJSON(FormPayloadJson) = 1),
    CONSTRAINT CK_ic_IcsForm_Status CHECK (FormStatusCode IN ('Draft','Submitted','Approved','Published','Archived'))
);
GO

CREATE TABLE ic.SituationReport (
    SituationReportId   bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_SituationReport PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_SitRep_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    OperationalPeriodId bigint NULL CONSTRAINT FK_ic_SitRep_Period FOREIGN KEY REFERENCES ic.IncidentOperationalPeriod(OperationalPeriodId),
    ReportNumber        int NOT NULL,
    ReportedUtc         datetime2(3) NOT NULL CONSTRAINT DF_ic_SitRep_Reported DEFAULT SYSUTCDATETIME(),
    ReportedByUserId    bigint NOT NULL CONSTRAINT FK_ic_SitRep_ReportedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    Summary             nvarchar(max) NOT NULL,
    CurrentActions      nvarchar(max) NULL,
    PlannedActions      nvarchar(max) NULL,
    UnmetNeeds          nvarchar(max) NULL,
    StatusCode          nvarchar(40) NOT NULL CONSTRAINT DF_ic_SitRep_Status DEFAULT ('Draft'),
    CONSTRAINT UQ_ic_SitRep UNIQUE(IncidentId, ReportNumber)
);
GO

CREATE TABLE ic.IncidentTimelineEvent (
    IncidentTimelineEventId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_Timeline PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_Timeline_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    EventUtc            datetime2(3) NOT NULL,
    EventTypeCode       nvarchar(80) NOT NULL,
    EventTitle          nvarchar(240) NOT NULL,
    EventDescription    nvarchar(max) NULL,
    LocationId          bigint NULL CONSTRAINT FK_ic_Timeline_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    CreatedByUserId     bigint NOT NULL CONSTRAINT FK_ic_Timeline_CreatedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_ic_Timeline_Created DEFAULT SYSUTCDATETIME()
);
GO

/* ================================================================================================
   7. Incident Resource Requests, Allocations, Communications
================================================================================================ */
CREATE TABLE ic.ResourceRequest (
    ResourceRequestId   bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_ResourceRequest PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_ic_ResourceRequest_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    OperationalPeriodId bigint NULL CONSTRAINT FK_ic_ResourceRequest_Period FOREIGN KEY REFERENCES ic.IncidentOperationalPeriod(OperationalPeriodId),
    RequestNumber       nvarchar(60) NOT NULL,
    RequestingLocationId bigint NULL CONSTRAINT FK_ic_ResourceRequest_RequestingLocation FOREIGN KEY REFERENCES org.Location(LocationId),
    DestinationLocationId bigint NULL CONSTRAINT FK_ic_ResourceRequest_DestinationLocation FOREIGN KEY REFERENCES org.Location(LocationId),
    ResourceTypeId      int NOT NULL CONSTRAINT FK_ic_ResourceRequest_ResourceType FOREIGN KEY REFERENCES res.ResourceType(ResourceTypeId),
    QuantityRequested   decimal(18,4) NOT NULL,
    QuantityApproved    decimal(18,4) NULL,
    PriorityCode        nvarchar(40) NOT NULL CONSTRAINT DF_ic_ResourceRequest_Priority DEFAULT ('Normal'),
    NeedByUtc           datetime2(3) NULL,
    RequestStatusCode   nvarchar(40) NOT NULL CONSTRAINT DF_ic_ResourceRequest_Status DEFAULT ('Submitted'),
    RequestNotes        nvarchar(max) NULL,
    RequestedByUserId   bigint NOT NULL CONSTRAINT FK_ic_ResourceRequest_RequestedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    RequestedUtc        datetime2(3) NOT NULL CONSTRAINT DF_ic_ResourceRequest_Requested DEFAULT SYSUTCDATETIME(),
    ApprovedByUserId    bigint NULL CONSTRAINT FK_ic_ResourceRequest_ApprovedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ApprovedUtc         datetime2(3) NULL,
    RowVer              rowversion NOT NULL,
    CONSTRAINT UQ_ic_ResourceRequest UNIQUE(IncidentId, RequestNumber),
    CONSTRAINT CK_ic_ResourceRequest_Qty CHECK (QuantityRequested > 0 AND (QuantityApproved IS NULL OR QuantityApproved >= 0)),
    CONSTRAINT CK_ic_ResourceRequest_Status CHECK (RequestStatusCode IN ('Submitted','UnderReview','Approved','PartiallyFilled','Filled','Denied','Cancelled','Closed'))
);
GO

CREATE TABLE ic.ResourceAssignment (
    ResourceAssignmentId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ic_ResourceAssignment PRIMARY KEY,
    ResourceRequestId   bigint NOT NULL CONSTRAINT FK_ic_ResourceAssignment_Request FOREIGN KEY REFERENCES ic.ResourceRequest(ResourceRequestId),
    SourceLocationId    bigint NULL CONSTRAINT FK_ic_ResourceAssignment_SourceLocation FOREIGN KEY REFERENCES org.Location(LocationId),
    AssignedResourceTypeId int NOT NULL CONSTRAINT FK_ic_ResourceAssignment_Type FOREIGN KEY REFERENCES res.ResourceType(ResourceTypeId),
    QuantityAssigned    decimal(18,4) NOT NULL,
    AssignmentStatusCode nvarchar(40) NOT NULL CONSTRAINT DF_ic_ResourceAssignment_Status DEFAULT ('Assigned'),
    ETAUtc              datetime2(3) NULL,
    DeliveredUtc        datetime2(3) NULL,
    ReleasedUtc         datetime2(3) NULL,
    AssignedByUserId    bigint NOT NULL CONSTRAINT FK_ic_ResourceAssignment_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    AssignedUtc         datetime2(3) NOT NULL CONSTRAINT DF_ic_ResourceAssignment_Assigned DEFAULT SYSUTCDATETIME(),
    Notes               nvarchar(max) NULL,
    RowVer              rowversion NOT NULL,
    CONSTRAINT CK_ic_ResourceAssignment_Qty CHECK (QuantityAssigned > 0),
    CONSTRAINT CK_ic_ResourceAssignment_Status CHECK (AssignmentStatusCode IN ('Assigned','InTransit','Delivered','Released','Cancelled'))
);
GO

CREATE TABLE comm.Notification (
    NotificationId      bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_comm_Notification PRIMARY KEY,
    IncidentId          bigint NULL CONSTRAINT FK_comm_Notification_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    PromptId            bigint NULL,
    NotificationTypeCode nvarchar(80) NOT NULL, -- INCIDENT_ACTIVATION, STATUS_PROMPT, RESOURCE_REQUEST, ESCALATION, REPORT_PUBLISHED
    Subject             nvarchar(300) NOT NULL,
    MessageBody         nvarchar(max) NOT NULL,
    PriorityCode        nvarchar(40) NOT NULL CONSTRAINT DF_comm_Notification_Priority DEFAULT ('Normal'),
    CreatedByUserId     bigint NOT NULL CONSTRAINT FK_comm_Notification_CreatedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_comm_Notification_Created DEFAULT SYSUTCDATETIME(),
    ScheduledSendUtc    datetime2(3) NULL,
    NotificationStatusCode nvarchar(40) NOT NULL CONSTRAINT DF_comm_Notification_Status DEFAULT ('Draft'),
    CONSTRAINT CK_comm_Notification_Status CHECK (NotificationStatusCode IN ('Draft','Queued','Sending','Sent','PartiallyFailed','Failed','Cancelled'))
);
GO

CREATE TABLE comm.NotificationRecipient (
    NotificationRecipientId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_comm_NotificationRecipient PRIMARY KEY,
    NotificationId      bigint NOT NULL CONSTRAINT FK_comm_Recipient_Notification FOREIGN KEY REFERENCES comm.Notification(NotificationId),
    UserId              bigint NULL CONSTRAINT FK_comm_Recipient_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ContactId           bigint NULL CONSTRAINT FK_comm_Recipient_Contact FOREIGN KEY REFERENCES org.Contact(ContactId),
    LocationId          bigint NULL CONSTRAINT FK_comm_Recipient_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    ChannelCode         nvarchar(40) NOT NULL, -- EMAIL, SMS
    DestinationAddress  nvarchar(320) NOT NULL,
    DeliveryStatusCode  nvarchar(40) NOT NULL CONSTRAINT DF_comm_Recipient_Status DEFAULT ('Queued'),
    SentUtc             datetime2(3) NULL,
    ProviderMessageId   nvarchar(200) NULL,
    FailureReason       nvarchar(1000) NULL,
    CONSTRAINT CK_comm_Recipient_OnePrincipal CHECK (UserId IS NOT NULL OR ContactId IS NOT NULL OR LocationId IS NOT NULL),
    CONSTRAINT CK_comm_Recipient_Channel CHECK (ChannelCode IN ('EMAIL','SMS')),
    CONSTRAINT CK_comm_Recipient_Status CHECK (DeliveryStatusCode IN ('Queued','Sent','Failed','Suppressed','Cancelled'))
);
GO

/* ================================================================================================
   8. EEI Prompting and Configurable Resource/Status Views
================================================================================================ */
CREATE TABLE eei.EeiTemplate (
    EeiTemplateId       bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_eei_Template PRIMARY KEY,
    TemplateCode        nvarchar(80) NOT NULL CONSTRAINT UQ_eei_Template_Code UNIQUE,
    TemplateName        nvarchar(240) NOT NULL,
    TemplateDescription nvarchar(1000) NULL,
    AppliesToCode       nvarchar(80) NOT NULL, -- LOCATION, INCIDENT, RESOURCE, HVA
    TemplateSchemaJson  nvarchar(max) NOT NULL,
    IsActive            bit NOT NULL CONSTRAINT DF_eei_Template_IsActive DEFAULT (1),
    VersionNumber       int NOT NULL CONSTRAINT DF_eei_Template_Version DEFAULT (1),
    CreatedByUserId     bigint NULL CONSTRAINT FK_eei_Template_CreatedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_eei_Template_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_eei_Template_SchemaJson CHECK (ISJSON(TemplateSchemaJson) = 1)
);
GO

CREATE TABLE eei.Prompt (
    PromptId            bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_eei_Prompt PRIMARY KEY,
    EeiTemplateId       bigint NOT NULL CONSTRAINT FK_eei_Prompt_Template FOREIGN KEY REFERENCES eei.EeiTemplate(EeiTemplateId),
    IncidentId          bigint NULL CONSTRAINT FK_eei_Prompt_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    PromptName          nvarchar(240) NOT NULL,
    PromptDescription   nvarchar(1000) NULL,
    PromptStatusCode    nvarchar(40) NOT NULL CONSTRAINT DF_eei_Prompt_Status DEFAULT ('Draft'),
    OpenUtc             datetime2(3) NULL,
    DueUtc              datetime2(3) NULL,
    CloseUtc            datetime2(3) NULL,
    CreatedByUserId     bigint NOT NULL CONSTRAINT FK_eei_Prompt_CreatedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_eei_Prompt_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_eei_Prompt_Status CHECK (PromptStatusCode IN ('Draft','Open','Closed','Cancelled','Archived'))
);
GO

CREATE TABLE eei.PromptTarget (
    PromptTargetId      bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_eei_PromptTarget PRIMARY KEY,
    PromptId            bigint NOT NULL CONSTRAINT FK_eei_PromptTarget_Prompt FOREIGN KEY REFERENCES eei.Prompt(PromptId),
    LocationId          bigint NULL CONSTRAINT FK_eei_PromptTarget_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    OrganizationId      bigint NULL CONSTRAINT FK_eei_PromptTarget_Organization FOREIGN KEY REFERENCES org.Organization(OrganizationId),
    RegionId            int NULL CONSTRAINT FK_eei_PromptTarget_Region FOREIGN KEY REFERENCES org.Region(RegionId),
    TargetStatusCode    nvarchar(40) NOT NULL CONSTRAINT DF_eei_PromptTarget_Status DEFAULT ('Pending'),
    LastReminderUtc     datetime2(3) NULL,
    CONSTRAINT CK_eei_PromptTarget_Target CHECK (LocationId IS NOT NULL OR OrganizationId IS NOT NULL OR RegionId IS NOT NULL)
);
GO

CREATE TABLE eei.PromptResponse (
    PromptResponseId    bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_eei_PromptResponse PRIMARY KEY,
    PromptTargetId      bigint NOT NULL CONSTRAINT FK_eei_PromptResponse_Target FOREIGN KEY REFERENCES eei.PromptTarget(PromptTargetId),
    LocationId          bigint NULL CONSTRAINT FK_eei_PromptResponse_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    ResponseStatusCode  nvarchar(40) NOT NULL CONSTRAINT DF_eei_Response_Status DEFAULT ('Draft'),
    ResponsePayloadJson nvarchar(max) NOT NULL,
    SubmittedByUserId   bigint NULL CONSTRAINT FK_eei_Response_SubmittedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    SubmittedUtc        datetime2(3) NULL,
    ReviewedByUserId    bigint NULL CONSTRAINT FK_eei_Response_ReviewedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ReviewedUtc         datetime2(3) NULL,
    RowVer              rowversion NOT NULL,
    CONSTRAINT CK_eei_Response_PayloadJson CHECK (ISJSON(ResponsePayloadJson) = 1),
    CONSTRAINT CK_eei_Response_Status CHECK (ResponseStatusCode IN ('Draft','Submitted','Accepted','Returned','Superseded'))
);
GO

CREATE TABLE eei.UserViewDefinition (
    UserViewDefinitionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_eei_UserView PRIMARY KEY,
    ViewOwnerUserId     bigint NULL CONSTRAINT FK_eei_UserView_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ViewOwnerRoleId     int NULL CONSTRAINT FK_eei_UserView_Role FOREIGN KEY REFERENCES sec.Role(RoleId),
    ViewName            nvarchar(240) NOT NULL,
    ViewTypeCode        nvarchar(80) NOT NULL, -- RESOURCE_STATUS, BED_AVAILABILITY, INCIDENT_STATUS, PROMPT_RESULT
    FilterDefinitionJson nvarchar(max) NOT NULL,
    ColumnDefinitionJson nvarchar(max) NOT NULL,
    IsSystemView        bit NOT NULL CONSTRAINT DF_eei_UserView_System DEFAULT (0),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_eei_UserView_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_eei_UserView_FilterJson CHECK (ISJSON(FilterDefinitionJson) = 1),
    CONSTRAINT CK_eei_UserView_ColumnJson CHECK (ISJSON(ColumnDefinitionJson) = 1)
);
GO

/* ================================================================================================
   9. Documents, Exports, AAR/IP, HVA
================================================================================================ */
CREATE TABLE doc.Document (
    DocumentId          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_doc_Document PRIMARY KEY,
    IncidentId          bigint NULL CONSTRAINT FK_doc_Document_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    LocationId          bigint NULL CONSTRAINT FK_doc_Document_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    DocumentTypeCode    nvarchar(80) NOT NULL,
    DocumentTitle       nvarchar(300) NOT NULL,
    BlobContainerName   nvarchar(120) NOT NULL,
    BlobName            nvarchar(500) NOT NULL,
    FileName            nvarchar(260) NOT NULL,
    ContentType         nvarchar(120) NULL,
    FileSizeBytes       bigint NULL,
    Sha256Hash          varbinary(32) NULL,
    RetentionClassCode  nvarchar(80) NULL,
    UploadedByUserId    bigint NOT NULL CONSTRAINT FK_doc_Document_UploadedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    UploadedUtc         datetime2(3) NOT NULL CONSTRAINT DF_doc_Document_Uploaded DEFAULT SYSUTCDATETIME(),
    IsDeleted           bit NOT NULL CONSTRAINT DF_doc_Document_Deleted DEFAULT (0),
    RowVer              rowversion NOT NULL,
    CONSTRAINT UQ_doc_Document_Blob UNIQUE(BlobContainerName, BlobName)
);
GO

CREATE TABLE doc.ExportJob (
    ExportJobId         bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_doc_ExportJob PRIMARY KEY,
    RequestedByUserId   bigint NOT NULL CONSTRAINT FK_doc_ExportJob_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ExportTypeCode      nvarchar(80) NOT NULL, -- CSV, XLSX, PDF, DOCX
    ExportSubjectCode   nvarchar(80) NOT NULL, -- INCIDENT, RESOURCE_STATUS, PROMPT_RESPONSE, AAR, HVA
    IncidentId          bigint NULL CONSTRAINT FK_doc_ExportJob_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    FilterJson          nvarchar(max) NULL,
    ExportStatusCode    nvarchar(40) NOT NULL CONSTRAINT DF_doc_ExportJob_Status DEFAULT ('Queued'),
    RequestedUtc        datetime2(3) NOT NULL CONSTRAINT DF_doc_ExportJob_Requested DEFAULT SYSUTCDATETIME(),
    CompletedUtc        datetime2(3) NULL,
    DocumentId          bigint NULL CONSTRAINT FK_doc_ExportJob_Document FOREIGN KEY REFERENCES doc.Document(DocumentId),
    CONSTRAINT CK_doc_ExportJob_FilterJson CHECK (FilterJson IS NULL OR ISJSON(FilterJson) = 1)
);
GO

CREATE TABLE assessment.AfterActionReport (
    AfterActionReportId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_assessment_AAR PRIMARY KEY,
    IncidentId          bigint NOT NULL CONSTRAINT FK_assessment_AAR_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    ReportStatusCode    nvarchar(40) NOT NULL CONSTRAINT DF_assessment_AAR_Status DEFAULT ('Draft'),
    ExecutiveSummary    nvarchar(max) NULL,
    PreparedByUserId    bigint NOT NULL CONSTRAINT FK_assessment_AAR_PreparedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    PreparedUtc         datetime2(3) NOT NULL CONSTRAINT DF_assessment_AAR_Prepared DEFAULT SYSUTCDATETIME(),
    ApprovedByUserId    bigint NULL CONSTRAINT FK_assessment_AAR_ApprovedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ApprovedUtc         datetime2(3) NULL,
    DocumentId          bigint NULL CONSTRAINT FK_assessment_AAR_Document FOREIGN KEY REFERENCES doc.Document(DocumentId)
);
GO

CREATE TABLE assessment.AarObservation (
    AarObservationId    bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_assessment_AarObservation PRIMARY KEY,
    AfterActionReportId bigint NOT NULL CONSTRAINT FK_assessment_AarObservation_AAR FOREIGN KEY REFERENCES assessment.AfterActionReport(AfterActionReportId),
    ObservationTypeCode nvarchar(80) NOT NULL, -- STRENGTH, AREA_FOR_IMPROVEMENT, GAP, LESSON_LEARNED
    CapabilityAreaCode  nvarchar(120) NULL,
    ObservationText     nvarchar(max) NOT NULL,
    RecommendationText  nvarchar(max) NULL,
    SortOrder           int NOT NULL CONSTRAINT DF_assessment_AarObservation_Sort DEFAULT (100)
);
GO

CREATE TABLE assessment.CorrectiveAction (
    CorrectiveActionId  bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_assessment_CorrectiveAction PRIMARY KEY,
    IncidentId          bigint NULL CONSTRAINT FK_assessment_CA_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    AarObservationId    bigint NULL CONSTRAINT FK_assessment_CA_AarObservation FOREIGN KEY REFERENCES assessment.AarObservation(AarObservationId),
    LocationId          bigint NULL CONSTRAINT FK_assessment_CA_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    ActionTitle         nvarchar(240) NOT NULL,
    ActionDescription   nvarchar(max) NOT NULL,
    OwnerUserId         bigint NULL CONSTRAINT FK_assessment_CA_OwnerUser FOREIGN KEY REFERENCES sec.AppUser(UserId),
    OwnerOrganizationId bigint NULL CONSTRAINT FK_assessment_CA_OwnerOrg FOREIGN KEY REFERENCES org.Organization(OrganizationId),
    DueUtc              datetime2(3) NULL,
    StatusCode          nvarchar(40) NOT NULL CONSTRAINT DF_assessment_CA_Status DEFAULT ('Open'),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_assessment_CA_Created DEFAULT SYSUTCDATETIME(),
    ClosedUtc           datetime2(3) NULL,
    CONSTRAINT CK_assessment_CA_Status CHECK (StatusCode IN ('Open','InProgress','Completed','Cancelled','Deferred'))
);
GO

CREATE TABLE assessment.HazardVulnerabilityAssessment (
    HvaId               bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_assessment_HVA PRIMARY KEY,
    LocationId          bigint NULL CONSTRAINT FK_assessment_HVA_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    OrganizationId      bigint NULL CONSTRAINT FK_assessment_HVA_Org FOREIGN KEY REFERENCES org.Organization(OrganizationId),
    AssessmentName      nvarchar(240) NOT NULL,
    AssessmentYear      smallint NOT NULL,
    StatusCode          nvarchar(40) NOT NULL CONSTRAINT DF_assessment_HVA_Status DEFAULT ('Draft'),
    PreparedByUserId    bigint NOT NULL CONSTRAINT FK_assessment_HVA_PreparedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    PreparedUtc         datetime2(3) NOT NULL CONSTRAINT DF_assessment_HVA_Prepared DEFAULT SYSUTCDATETIME(),
    ApprovedByUserId    bigint NULL CONSTRAINT FK_assessment_HVA_ApprovedBy FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ApprovedUtc         datetime2(3) NULL,
    DocumentId          bigint NULL CONSTRAINT FK_assessment_HVA_Document FOREIGN KEY REFERENCES doc.Document(DocumentId),
    CONSTRAINT CK_assessment_HVA_Target CHECK (LocationId IS NOT NULL OR OrganizationId IS NOT NULL)
);
GO

CREATE TABLE assessment.HvaHazardScore (
    HvaHazardScoreId    bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_assessment_HvaScore PRIMARY KEY,
    HvaId               bigint NOT NULL CONSTRAINT FK_assessment_HvaScore_HVA FOREIGN KEY REFERENCES assessment.HazardVulnerabilityAssessment(HvaId),
    HazardCode          nvarchar(120) NOT NULL,
    ProbabilityScore    decimal(5,2) NOT NULL,
    HumanImpactScore    decimal(5,2) NOT NULL,
    PropertyImpactScore decimal(5,2) NOT NULL,
    BusinessImpactScore decimal(5,2) NOT NULL,
    PreparednessScore   decimal(5,2) NOT NULL,
    RiskScore           AS ((ProbabilityScore * (HumanImpactScore + PropertyImpactScore + BusinessImpactScore)) / NULLIF(PreparednessScore,0)) PERSISTED,
    Notes               nvarchar(max) NULL,
    CONSTRAINT UQ_assessment_HvaScore UNIQUE(HvaId, HazardCode),
    CONSTRAINT CK_assessment_HvaScore_Positive CHECK (ProbabilityScore >= 0 AND HumanImpactScore >= 0 AND PropertyImpactScore >= 0 AND BusinessImpactScore >= 0 AND PreparednessScore > 0)
);
GO

/* ================================================================================================
   10. Integration, Audit, Outbox
================================================================================================ */
CREATE TABLE intg.ApiClient (
    ApiClientId         int IDENTITY(1,1) NOT NULL CONSTRAINT PK_intg_ApiClient PRIMARY KEY,
    ClientName          nvarchar(200) NOT NULL,
    ClientIdentifier    nvarchar(160) NOT NULL CONSTRAINT UQ_intg_ApiClient_Identifier UNIQUE,
    OwningOrganizationId bigint NULL CONSTRAINT FK_intg_ApiClient_Org FOREIGN KEY REFERENCES org.Organization(OrganizationId),
    IsActive            bit NOT NULL CONSTRAINT DF_intg_ApiClient_Active DEFAULT (1),
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_intg_ApiClient_Created DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE intg.InboundInterfaceMessage (
    InboundInterfaceMessageId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_intg_InboundMessage PRIMARY KEY,
    ApiClientId         int NULL CONSTRAINT FK_intg_InboundMessage_Client FOREIGN KEY REFERENCES intg.ApiClient(ApiClientId),
    SourceSystemCode    nvarchar(80) NOT NULL,
    SourceMessageId     nvarchar(200) NULL,
    InterfaceTypeCode   nvarchar(80) NOT NULL, -- BED_AVAILABILITY, RESOURCE_STATUS, FACILITY_CONTACT, OTHER
    ReceivedUtc         datetime2(3) NOT NULL CONSTRAINT DF_intg_InboundMessage_Received DEFAULT SYSUTCDATETIME(),
    ProcessingStatusCode nvarchar(40) NOT NULL CONSTRAINT DF_intg_InboundMessage_Status DEFAULT ('Received'),
    PayloadJson         nvarchar(max) NOT NULL,
    ErrorMessage        nvarchar(max) NULL,
    RelatedLocationId   bigint NULL CONSTRAINT FK_intg_InboundMessage_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    RelatedIncidentId   bigint NULL CONSTRAINT FK_intg_InboundMessage_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    CONSTRAINT CK_intg_InboundMessage_PayloadJson CHECK (ISJSON(PayloadJson)=1),
    CONSTRAINT CK_intg_InboundMessage_Status CHECK (ProcessingStatusCode IN ('Received','Validated','Processed','Rejected','Error','Reconciled'))
);
GO

CREATE TABLE audit.AuditEvent (
    AuditEventId        bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_audit_AuditEvent PRIMARY KEY,
    EventUtc            datetime2(3) NOT NULL CONSTRAINT DF_audit_AuditEvent_EventUtc DEFAULT SYSUTCDATETIME(),
    ActorUserId         bigint NULL CONSTRAINT FK_audit_AuditEvent_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
    ImpersonationSessionId bigint NULL CONSTRAINT FK_audit_AuditEvent_Impersonation FOREIGN KEY REFERENCES sec.AdminImpersonationSession(ImpersonationSessionId),
    EventCategory       nvarchar(80) NOT NULL, -- AUTH, DATA_ACCESS, DATA_CHANGE, ADMIN, EXPORT, NOTIFICATION, SECURITY
    EventAction         nvarchar(120) NOT NULL,
    EntitySchemaName    sysname NULL,
    EntityTableName     sysname NULL,
    EntityPrimaryKey    nvarchar(120) NULL,
    IncidentId          bigint NULL CONSTRAINT FK_audit_AuditEvent_Incident FOREIGN KEY REFERENCES ic.Incident(IncidentId),
    LocationId          bigint NULL CONSTRAINT FK_audit_AuditEvent_Location FOREIGN KEY REFERENCES org.Location(LocationId),
    ClientIpAddress     varchar(45) NULL,
    UserAgentHash       varbinary(32) NULL,
    OutcomeCode         nvarchar(40) NOT NULL CONSTRAINT DF_audit_AuditEvent_Outcome DEFAULT ('Success'),
    DetailJson          nvarchar(max) NULL,
    CONSTRAINT CK_audit_AuditEvent_DetailJson CHECK (DetailJson IS NULL OR ISJSON(DetailJson)=1)
);
GO

CREATE TABLE app.OutboxEvent (
    OutboxEventId       bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_OutboxEvent PRIMARY KEY,
    EventTypeCode       nvarchar(120) NOT NULL,
    AggregateTypeCode   nvarchar(120) NOT NULL,
    AggregateId         nvarchar(120) NOT NULL,
    PayloadJson         nvarchar(max) NOT NULL,
    CreatedUtc          datetime2(3) NOT NULL CONSTRAINT DF_app_OutboxEvent_Created DEFAULT SYSUTCDATETIME(),
    PublishedUtc        datetime2(3) NULL,
    PublishAttemptCount int NOT NULL CONSTRAINT DF_app_OutboxEvent_Attempts DEFAULT (0),
    LastErrorMessage    nvarchar(max) NULL,
    CONSTRAINT CK_app_OutboxEvent_PayloadJson CHECK (ISJSON(PayloadJson)=1)
);
GO

/* ================================================================================================
   11. Foreign Keys that require tables created later
================================================================================================ */
ALTER TABLE res.ResourceStatusUpdate
    ADD CONSTRAINT FK_res_StatusUpdate_Incident FOREIGN KEY (IncidentId) REFERENCES ic.Incident(IncidentId),
        CONSTRAINT FK_res_StatusUpdate_Prompt FOREIGN KEY (PromptId) REFERENCES eei.Prompt(PromptId);
GO
ALTER TABLE res.BedAvailabilitySnapshot
    ADD CONSTRAINT FK_res_BedSnapshot_Incident FOREIGN KEY (IncidentId) REFERENCES ic.Incident(IncidentId),
        CONSTRAINT FK_res_BedSnapshot_Prompt FOREIGN KEY (PromptId) REFERENCES eei.Prompt(PromptId);
GO
ALTER TABLE comm.Notification
    ADD CONSTRAINT FK_comm_Notification_Prompt FOREIGN KEY (PromptId) REFERENCES eei.Prompt(PromptId);
GO

/* ================================================================================================
   12. Performance Indexes
================================================================================================ */
CREATE INDEX IX_org_Location_Region_Type ON org.Location(RegionId, LocationTypeCode) INCLUDE(LocationName, IsActive);
CREATE INDEX IX_org_Location_Org ON org.Location(OrganizationId) INCLUDE(LocationName, RegionId, IsActive);
CREATE INDEX IX_org_LocationContact_Location ON org.LocationContact(LocationId, IsActive) INCLUDE(ContactId, ContactRoleCode, PriorityOrder);

CREATE INDEX IX_sec_UserRoleAssignment_User_Active ON sec.UserRoleAssignment(UserId, EffectiveToUtc) INCLUDE(RoleId, OrganizationId, LocationId, RegionId, IncidentId);
CREATE INDEX IX_sec_UserSession_User_Status ON sec.UserSession(UserId, SessionStatus, LoginUtc DESC);

CREATE INDEX IX_ic_Incident_Status_Started ON ic.Incident(IncidentStatusCode, StartedUtc DESC) INCLUDE(IncidentNumber, IncidentName, LeadRegionId, PrimaryLocationId);
CREATE INDEX IX_ic_IncidentLocation_Incident ON ic.IncidentLocation(IncidentId) INCLUDE(LocationId, RelationshipCode, ImpactStatusCode);
CREATE INDEX IX_ic_OperationalPeriod_Incident_Status ON ic.IncidentOperationalPeriod(IncidentId, StatusCode, StartUtc, EndUtc);
CREATE INDEX IX_ic_CommandAssignment_Incident_Position ON ic.IncidentCommandAssignment(IncidentId, IcsPositionId, AssignmentStatusCode);
CREATE INDEX IX_ic_Task_Incident_Status_Due ON ic.IncidentTask(IncidentId, StatusCode, DueUtc) INCLUDE(TaskTitle, AssignedToUserId, AssignedToLocationId);
CREATE INDEX IX_ic_ResourceRequest_Incident_Status ON ic.ResourceRequest(IncidentId, RequestStatusCode, PriorityCode, NeedByUtc);
CREATE INDEX IX_ic_Timeline_Incident_EventUtc ON ic.IncidentTimelineEvent(IncidentId, EventUtc DESC);

CREATE INDEX IX_res_Inventory_Location ON res.LocationResourceInventory(LocationId) INCLUDE(ResourceTypeId, QuantityAvailable, QuantityCommitted, LastReportedUtc);
CREATE INDEX IX_res_StatusUpdate_Location_Reported ON res.ResourceStatusUpdate(LocationId, ReportedUtc DESC) INCLUDE(ResourceTypeId, IncidentId, PromptId, StatusCode);
CREATE INDEX IX_res_BedSnapshot_Location_Reported ON res.BedAvailabilitySnapshot(LocationId, ReportedUtc DESC) INCLUDE(BedCategoryCode, BedsAvailable, BedsOccupied, IncidentId, PromptId);

CREATE INDEX IX_eei_Prompt_Incident_Status ON eei.Prompt(IncidentId, PromptStatusCode, DueUtc);
CREATE INDEX IX_eei_PromptTarget_Prompt_Status ON eei.PromptTarget(PromptId, TargetStatusCode) INCLUDE(LocationId, OrganizationId, RegionId);
CREATE INDEX IX_eei_Response_Target_Status ON eei.PromptResponse(PromptTargetId, ResponseStatusCode, SubmittedUtc DESC);

CREATE INDEX IX_comm_Recipient_Status ON comm.NotificationRecipient(DeliveryStatusCode, NotificationId) INCLUDE(ChannelCode, DestinationAddress);
CREATE INDEX IX_doc_Document_Incident_Type ON doc.Document(IncidentId, DocumentTypeCode, UploadedUtc DESC);

CREATE INDEX IX_audit_AuditEvent_EventUtc ON audit.AuditEvent(EventUtc DESC);
CREATE INDEX IX_audit_AuditEvent_Actor ON audit.AuditEvent(ActorUserId, EventUtc DESC);
CREATE INDEX IX_audit_AuditEvent_Entity ON audit.AuditEvent(EntitySchemaName, EntityTableName, EntityPrimaryKey, EventUtc DESC);
CREATE INDEX IX_intg_InboundMessage_Status ON intg.InboundInterfaceMessage(ProcessingStatusCode, ReceivedUtc) INCLUDE(SourceSystemCode, InterfaceTypeCode);
CREATE INDEX IX_app_OutboxEvent_Unpublished ON app.OutboxEvent(PublishedUtc, CreatedUtc) INCLUDE(EventTypeCode, AggregateTypeCode, AggregateId) WHERE PublishedUtc IS NULL;
GO

/* ================================================================================================
   13. Seed Reference Data
================================================================================================ */
MERGE ref.CodeSet AS t
USING (VALUES
('IncidentType','Incident and planned event types'),
('IncidentStatus','Incident lifecycle status'),
('ResourceStatus','Resource status values'),
('Priority','Priority values'),
('DocumentType','Document and generated export categories'),
('NotificationType','Notification categories')
) AS s(CodeSetName, Description)
ON t.CodeSetName = s.CodeSetName
WHEN NOT MATCHED THEN INSERT(CodeSetName, Description) VALUES(s.CodeSetName, s.Description);
GO

MERGE ref.IcsPosition AS t
USING (VALUES
('IC','Incident Commander','Command',NULL,10),
('DIC','Deputy Incident Commander','Command','IC',20),
('PIO','Public Information Officer','Command','IC',30),
('SOFR','Safety Officer','Command','IC',40),
('LOFR','Liaison Officer','Command','IC',50),
('OSC','Operations Section Chief','Operations','IC',100),
('PSC','Planning Section Chief','Planning','IC',200),
('LSC','Logistics Section Chief','Logistics','IC',300),
('FSC','Finance/Admin Section Chief','Finance/Admin','IC',400),
('RESL','Resources Unit Leader','Planning','PSC',210),
('SITL','Situation Unit Leader','Planning','PSC',220),
('DOCL','Documentation Unit Leader','Planning','PSC',230),
('COML','Communications Unit Leader','Logistics','LSC',310),
('MEDL','Medical Unit Leader','Logistics','LSC',320)
) AS s(PositionCode, PositionName, IcsSection, ParentPositionCode, SortOrder)
ON t.PositionCode = s.PositionCode
WHEN NOT MATCHED THEN INSERT(PositionCode, PositionName, IcsSection, ParentPositionCode, SortOrder)
VALUES(s.PositionCode, s.PositionName, s.IcsSection, s.ParentPositionCode, s.SortOrder);
GO

MERGE sec.Role AS t
USING (VALUES
('SYSTEM_ADMIN','System Administrator','STATE',1),
('KDHE_ADMIN','KDHE Administrator','STATE',1),
('REGIONAL_COORDINATOR','Regional Coordinator','REGION',0),
('FACILITY_ADMIN','Facility Administrator','LOCATION',0),
('FACILITY_USER','Facility User','LOCATION',0),
('INCIDENT_COMMANDER','Incident Commander','INCIDENT',1),
('INCIDENT_STAFF','Incident Staff','INCIDENT',0),
('REPORT_VIEWER','Report Viewer','STATE',0)
) AS s(RoleCode, RoleName, RoleScopeType, IsPrivileged)
ON t.RoleCode = s.RoleCode
WHEN NOT MATCHED THEN INSERT(RoleCode, RoleName, RoleScopeType, IsPrivileged)
VALUES(s.RoleCode, s.RoleName, s.RoleScopeType, s.IsPrivileged);
GO

MERGE sec.Permission AS t
USING (VALUES
('incident.create','Create Incident','Incident'),
('incident.activate','Activate Incident','Incident'),
('incident.close','Close Incident','Incident'),
('incident.view','View Incident','Incident'),
('incident.manage_ics','Manage ICS Roles','Incident'),
('incident.manage_iap','Manage IAP and ICS Forms','Incident'),
('resource.submit_status','Submit Resource Status','Resource'),
('resource.manage_request','Manage Resource Requests','Resource'),
('eei.manage_prompt','Manage EEI Prompts','EEI'),
('report.export','Export Reports','Reporting'),
('admin.manage_users','Manage Users','Administration'),
('admin.impersonate','Switch to User View','Administration'),
('audit.view','View Audit Logs','Audit')
) AS s(PermissionCode, PermissionName, PermissionCategory)
ON t.PermissionCode = s.PermissionCode
WHEN NOT MATCHED THEN INSERT(PermissionCode, PermissionName, PermissionCategory)
VALUES(s.PermissionCode, s.PermissionName, s.PermissionCategory);
GO

/* ================================================================================================
   14. Production-Oriented Stored Procedures
================================================================================================ */
CREATE OR ALTER PROCEDURE ic.usp_CreateIncident
    @IncidentNumber        nvarchar(40),
    @IncidentName          nvarchar(240),
    @IncidentTypeCode      nvarchar(80),
    @LeadOrganizationId    bigint = NULL,
    @LeadRegionId          int = NULL,
    @PrimaryLocationId     bigint = NULL,
    @InitialSummary        nvarchar(max) = NULL,
    @CreatedByUserId       bigint,
    @IncidentId            bigint OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    INSERT ic.Incident
        (IncidentNumber, IncidentName, IncidentTypeCode, IncidentStatusCode, LeadOrganizationId, LeadRegionId,
         PrimaryLocationId, InitialSummary, CreatedByUserId)
    VALUES
        (@IncidentNumber, @IncidentName, @IncidentTypeCode, 'Draft', @LeadOrganizationId, @LeadRegionId,
         @PrimaryLocationId, @InitialSummary, @CreatedByUserId);

    SET @IncidentId = SCOPE_IDENTITY();

    IF @PrimaryLocationId IS NOT NULL
    BEGIN
        INSERT ic.IncidentLocation(IncidentId, LocationId, RelationshipCode, IsPrimary, AddedByUserId)
        VALUES(@IncidentId, @PrimaryLocationId, 'AFFECTED', 1, @CreatedByUserId);
    END

    INSERT app.OutboxEvent(EventTypeCode, AggregateTypeCode, AggregateId, PayloadJson)
    VALUES('Incident.Created', 'Incident', CONVERT(nvarchar(120), @IncidentId),
           JSON_OBJECT('IncidentId': @IncidentId, 'IncidentNumber': @IncidentNumber, 'IncidentName': @IncidentName));

    INSERT audit.AuditEvent(ActorUserId, EventCategory, EventAction, EntitySchemaName, EntityTableName, EntityPrimaryKey, IncidentId, DetailJson)
    VALUES(@CreatedByUserId, 'DATA_CHANGE', 'CREATE', 'ic', 'Incident', CONVERT(nvarchar(120), @IncidentId), @IncidentId,
           JSON_OBJECT('IncidentNumber': @IncidentNumber, 'IncidentTypeCode': @IncidentTypeCode));

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE ic.usp_ActivateIncident
    @IncidentId            bigint,
    @ActivatedByUserId     bigint,
    @OperationalPeriodStartUtc datetime2(3),
    @OperationalPeriodEndUtc   datetime2(3)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @OperationalPeriodEndUtc <= @OperationalPeriodStartUtc
        THROW 51000, 'Operational period end must be greater than start.', 1;

    BEGIN TRANSACTION;

    UPDATE ic.Incident
       SET IncidentStatusCode = 'Active',
           ActivatedUtc = COALESCE(ActivatedUtc, SYSUTCDATETIME()),
           StartedUtc = COALESCE(StartedUtc, @OperationalPeriodStartUtc),
           UpdatedUtc = SYSUTCDATETIME()
     WHERE IncidentId = @IncidentId
       AND IncidentStatusCode IN ('Draft','Monitoring');

    IF @@ROWCOUNT = 0
        THROW 51001, 'Incident was not found or is not eligible for activation.', 1;

    IF NOT EXISTS (SELECT 1 FROM ic.IncidentOperationalPeriod WHERE IncidentId = @IncidentId AND PeriodNumber = 1)
    BEGIN
        INSERT ic.IncidentOperationalPeriod(IncidentId, PeriodNumber, PeriodName, StartUtc, EndUtc, StatusCode)
        VALUES(@IncidentId, 1, 'Operational Period 1', @OperationalPeriodStartUtc, @OperationalPeriodEndUtc, 'Active');
    END

    INSERT app.OutboxEvent(EventTypeCode, AggregateTypeCode, AggregateId, PayloadJson)
    VALUES('Incident.Activated', 'Incident', CONVERT(nvarchar(120), @IncidentId),
           JSON_OBJECT('IncidentId': @IncidentId, 'ActivatedByUserId': @ActivatedByUserId));

    INSERT audit.AuditEvent(ActorUserId, EventCategory, EventAction, EntitySchemaName, EntityTableName, EntityPrimaryKey, IncidentId)
    VALUES(@ActivatedByUserId, 'DATA_CHANGE', 'ACTIVATE', 'ic', 'Incident', CONVERT(nvarchar(120), @IncidentId), @IncidentId);

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE ic.usp_SubmitResourceRequest
    @IncidentId            bigint,
    @OperationalPeriodId   bigint = NULL,
    @RequestNumber         nvarchar(60),
    @RequestingLocationId  bigint = NULL,
    @DestinationLocationId bigint = NULL,
    @ResourceTypeId        int,
    @QuantityRequested     decimal(18,4),
    @PriorityCode          nvarchar(40) = 'Normal',
    @NeedByUtc             datetime2(3) = NULL,
    @RequestNotes          nvarchar(max) = NULL,
    @RequestedByUserId     bigint,
    @ResourceRequestId     bigint OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @QuantityRequested <= 0
        THROW 51010, 'Quantity requested must be greater than zero.', 1;

    BEGIN TRANSACTION;

    INSERT ic.ResourceRequest
        (IncidentId, OperationalPeriodId, RequestNumber, RequestingLocationId, DestinationLocationId,
         ResourceTypeId, QuantityRequested, PriorityCode, NeedByUtc, RequestNotes, RequestedByUserId)
    VALUES
        (@IncidentId, @OperationalPeriodId, @RequestNumber, @RequestingLocationId, @DestinationLocationId,
         @ResourceTypeId, @QuantityRequested, @PriorityCode, @NeedByUtc, @RequestNotes, @RequestedByUserId);

    SET @ResourceRequestId = SCOPE_IDENTITY();

    INSERT app.OutboxEvent(EventTypeCode, AggregateTypeCode, AggregateId, PayloadJson)
    VALUES('ResourceRequest.Submitted', 'ResourceRequest', CONVERT(nvarchar(120), @ResourceRequestId),
           JSON_OBJECT('IncidentId': @IncidentId, 'ResourceRequestId': @ResourceRequestId, 'PriorityCode': @PriorityCode));

    INSERT audit.AuditEvent(ActorUserId, EventCategory, EventAction, EntitySchemaName, EntityTableName, EntityPrimaryKey, IncidentId, LocationId, DetailJson)
    VALUES(@RequestedByUserId, 'DATA_CHANGE', 'SUBMIT', 'ic', 'ResourceRequest', CONVERT(nvarchar(120), @ResourceRequestId), @IncidentId, @RequestingLocationId,
           JSON_OBJECT('ResourceTypeId': @ResourceTypeId, 'QuantityRequested': @QuantityRequested));

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE eei.usp_SubmitPromptResponse
    @PromptTargetId        bigint,
    @LocationId            bigint = NULL,
    @ResponsePayloadJson   nvarchar(max),
    @SubmittedByUserId     bigint
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISJSON(@ResponsePayloadJson) <> 1
        THROW 51020, 'ResponsePayloadJson must be valid JSON.', 1;

    BEGIN TRANSACTION;

    INSERT eei.PromptResponse(PromptTargetId, LocationId, ResponseStatusCode, ResponsePayloadJson, SubmittedByUserId, SubmittedUtc)
    VALUES(@PromptTargetId, @LocationId, 'Submitted', @ResponsePayloadJson, @SubmittedByUserId, SYSUTCDATETIME());

    UPDATE eei.PromptTarget
       SET TargetStatusCode = 'Submitted'
     WHERE PromptTargetId = @PromptTargetId;

    INSERT audit.AuditEvent(ActorUserId, EventCategory, EventAction, EntitySchemaName, EntityTableName, EntityPrimaryKey, LocationId, DetailJson)
    VALUES(@SubmittedByUserId, 'DATA_CHANGE', 'SUBMIT', 'eei', 'PromptResponse', CONVERT(nvarchar(120), SCOPE_IDENTITY()), @LocationId,
           JSON_OBJECT('PromptTargetId': @PromptTargetId));

    COMMIT TRANSACTION;
END;
GO

/* ================================================================================================
   15. Operational Views
================================================================================================ */
CREATE OR ALTER VIEW ic.vw_ActiveIncidentDashboard
AS
SELECT
    i.IncidentId,
    i.IncidentNumber,
    i.IncidentName,
    i.IncidentTypeCode,
    i.IncidentStatusCode,
    i.SeverityCode,
    i.StartedUtc,
    i.ActivatedUtc,
    r.RegionName AS LeadRegionName,
    l.LocationName AS PrimaryLocationName,
    COUNT(DISTINCT il.LocationId) AS RelatedLocationCount,
    COUNT(DISTINCT t.IncidentTaskId) AS TaskCount,
    SUM(CASE WHEN t.StatusCode IN ('Open','Assigned','InProgress','Blocked') THEN 1 ELSE 0 END) AS OpenTaskCount,
    COUNT(DISTINCT rr.ResourceRequestId) AS ResourceRequestCount
FROM ic.Incident i
LEFT JOIN org.Region r ON i.LeadRegionId = r.RegionId
LEFT JOIN org.Location l ON i.PrimaryLocationId = l.LocationId
LEFT JOIN ic.IncidentLocation il ON i.IncidentId = il.IncidentId
LEFT JOIN ic.IncidentTask t ON i.IncidentId = t.IncidentId
LEFT JOIN ic.ResourceRequest rr ON i.IncidentId = rr.IncidentId
WHERE i.IncidentStatusCode IN ('Active','Monitoring','Demobilizing')
GROUP BY i.IncidentId, i.IncidentNumber, i.IncidentName, i.IncidentTypeCode, i.IncidentStatusCode,
         i.SeverityCode, i.StartedUtc, i.ActivatedUtc, r.RegionName, l.LocationName;
GO

CREATE OR ALTER VIEW res.vw_CurrentLocationResourcePosture
AS
SELECT
    l.LocationId,
    l.LocationName,
    l.LocationTypeCode,
    rg.RegionName,
    rt.ResourceCategoryCode,
    rt.ResourceTypeCode,
    rt.ResourceTypeName,
    inv.QuantityTotal,
    inv.QuantityAvailable,
    inv.QuantityCommitted,
    inv.QuantityOutOfService,
    inv.LastReportedUtc
FROM org.Location l
LEFT JOIN org.Region rg ON l.RegionId = rg.RegionId
JOIN res.LocationResourceInventory inv ON l.LocationId = inv.LocationId
JOIN res.ResourceType rt ON inv.ResourceTypeId = rt.ResourceTypeId
WHERE l.IsActive = 1;
GO

CREATE OR ALTER VIEW audit.vw_RecentSecurityRelevantEvents
AS
SELECT TOP (1000)
    ae.AuditEventId,
    ae.EventUtc,
    u.UserPrincipalName,
    ae.EventCategory,
    ae.EventAction,
    ae.EntitySchemaName,
    ae.EntityTableName,
    ae.EntityPrimaryKey,
    ae.OutcomeCode,
    ae.ClientIpAddress,
    ae.DetailJson
FROM audit.AuditEvent ae
LEFT JOIN sec.AppUser u ON ae.ActorUserId = u.UserId
WHERE ae.EventCategory IN ('AUTH','ADMIN','EXPORT','SECURITY','DATA_ACCESS')
ORDER BY ae.EventUtc DESC;
GO

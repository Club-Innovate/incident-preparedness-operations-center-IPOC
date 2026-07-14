/*
File: IPOC_WEB.AppHost/planning/IPOC_Incident_Resource_Request_Migration.sql
Purpose: Adds incident resource request persistence for render/create/edit/archive workflows.
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'ic.IncidentResourceRequest', N'U') IS NULL
BEGIN
	CREATE TABLE ic.IncidentResourceRequest
	(
		IncidentResourceRequestId BIGINT IDENTITY(1,1) NOT NULL,
		IncidentId BIGINT NOT NULL,
		RequestedUtc DATETIME2(0) NOT NULL CONSTRAINT DF_IncidentResourceRequest_RequestedUtc DEFAULT (SYSUTCDATETIME()),
		ResourceTypeCode NVARCHAR(80) NOT NULL,
		ResourceTypeName NVARCHAR(240) NOT NULL,
		RequestedQuantity DECIMAL(18,4) NOT NULL,
		AssignedQuantity DECIMAL(18,4) NULL,
		UnitOfMeasureCode NVARCHAR(40) NOT NULL,
		PriorityCode NVARCHAR(40) NOT NULL,
		StatusCode NVARCHAR(40) NOT NULL CONSTRAINT DF_IncidentResourceRequest_StatusCode DEFAULT (N'Requested'),
		Notes NVARCHAR(MAX) NULL,
		RequestedByUserId BIGINT NOT NULL,
		CreatedUtc DATETIME2(0) NOT NULL CONSTRAINT DF_IncidentResourceRequest_CreatedUtc DEFAULT (SYSUTCDATETIME()),
		UpdatedUtc DATETIME2(0) NULL,
		RowVer ROWVERSION NOT NULL,
		CONSTRAINT PK_IncidentResourceRequest PRIMARY KEY CLUSTERED (IncidentResourceRequestId),
		CONSTRAINT FK_IncidentResourceRequest_Incident FOREIGN KEY (IncidentId) REFERENCES ic.Incident(IncidentId),
		CONSTRAINT FK_IncidentResourceRequest_RequestedByUser FOREIGN KEY (RequestedByUserId) REFERENCES sec.AppUser(UserId),
		CONSTRAINT CK_IncidentResourceRequest_RequestedQuantity CHECK (RequestedQuantity > 0),
		CONSTRAINT CK_IncidentResourceRequest_AssignedQuantity CHECK (AssignedQuantity IS NULL OR AssignedQuantity >= 0),
		CONSTRAINT CK_IncidentResourceRequest_PriorityCode CHECK (PriorityCode IN (N'Low', N'Normal', N'High', N'Critical')),
		CONSTRAINT CK_IncidentResourceRequest_StatusCode CHECK (StatusCode IN (N'Requested', N'Approved', N'PartiallyFulfilled', N'Fulfilled', N'Denied', N'Cancelled', N'Archived'))
	);
END;
GO

IF NOT EXISTS (
	SELECT 1
	FROM sys.indexes
	WHERE name = N'IX_IncidentResourceRequest_Incident_RequestedUtc'
	  AND object_id = OBJECT_ID(N'ic.IncidentResourceRequest', N'U')
)
BEGIN
	CREATE NONCLUSTERED INDEX IX_IncidentResourceRequest_Incident_RequestedUtc
		ON ic.IncidentResourceRequest (IncidentId, RequestedUtc DESC, IncidentResourceRequestId DESC)
		INCLUDE (StatusCode, PriorityCode, ResourceTypeCode, ResourceTypeName, RequestedQuantity, AssignedQuantity, UnitOfMeasureCode, RequestedByUserId, CreatedUtc, UpdatedUtc);
END;
GO

IF NOT EXISTS (
	SELECT 1
	FROM sys.indexes
	WHERE name = N'IX_IncidentResourceRequest_StatusCode'
	  AND object_id = OBJECT_ID(N'ic.IncidentResourceRequest', N'U')
)
BEGIN
	CREATE NONCLUSTERED INDEX IX_IncidentResourceRequest_StatusCode
		ON ic.IncidentResourceRequest (StatusCode, IncidentId, RequestedUtc DESC);
END;
GO

/*
File: IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_Incident_Communication_Migration.sql
Purpose: Adds incident communication log table for render/create/edit/archive workflows.
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'ic.IncidentCommunication', N'U') IS NULL
BEGIN
	CREATE TABLE ic.IncidentCommunication
	(
		IncidentCommunicationId BIGINT IDENTITY(1,1) NOT NULL,
		IncidentId BIGINT NOT NULL,
		LoggedUtc DATETIME2(0) NOT NULL CONSTRAINT DF_IncidentCommunication_LoggedUtc DEFAULT (SYSUTCDATETIME()),
		ChannelCode NVARCHAR(40) NOT NULL,
		DirectionCode NVARCHAR(40) NOT NULL,
		Subject NVARCHAR(240) NOT NULL,
		Message NVARCHAR(MAX) NOT NULL,
		StatusCode NVARCHAR(40) NOT NULL CONSTRAINT DF_IncidentCommunication_StatusCode DEFAULT (N'Active'),
		CreatedByUserId BIGINT NOT NULL,
		CreatedUtc DATETIME2(0) NOT NULL CONSTRAINT DF_IncidentCommunication_CreatedUtc DEFAULT (SYSUTCDATETIME()),
		UpdatedUtc DATETIME2(0) NULL,
		RowVer ROWVERSION NOT NULL,
		CONSTRAINT PK_IncidentCommunication PRIMARY KEY CLUSTERED (IncidentCommunicationId),
		CONSTRAINT FK_IncidentCommunication_Incident FOREIGN KEY (IncidentId) REFERENCES ic.Incident(IncidentId),
		CONSTRAINT FK_IncidentCommunication_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES sec.AppUser(UserId),
		CONSTRAINT CK_IncidentCommunication_StatusCode CHECK (StatusCode IN (N'Active', N'Archived')),
		CONSTRAINT CK_IncidentCommunication_ChannelCode CHECK (ChannelCode IN (N'Phone', N'Radio', N'Email', N'WebEoc', N'InPerson', N'Other')),
		CONSTRAINT CK_IncidentCommunication_DirectionCode CHECK (DirectionCode IN (N'Inbound', N'Outbound', N'Internal'))
	);
END;
GO

IF NOT EXISTS (
	SELECT 1
	FROM sys.indexes
	WHERE name = N'IX_IncidentCommunication_Incident_LoggedUtc'
	  AND object_id = OBJECT_ID(N'ic.IncidentCommunication', N'U')
)
BEGIN
	CREATE NONCLUSTERED INDEX IX_IncidentCommunication_Incident_LoggedUtc
		ON ic.IncidentCommunication (IncidentId, LoggedUtc DESC, IncidentCommunicationId DESC)
		INCLUDE (StatusCode, ChannelCode, DirectionCode, Subject, CreatedByUserId, CreatedUtc, UpdatedUtc);
END;
GO

IF NOT EXISTS (
	SELECT 1
	FROM sys.indexes
	WHERE name = N'IX_IncidentCommunication_StatusCode'
	  AND object_id = OBJECT_ID(N'ic.IncidentCommunication', N'U')
)
BEGIN
	CREATE NONCLUSTERED INDEX IX_IncidentCommunication_StatusCode
		ON ic.IncidentCommunication (StatusCode, IncidentId, LoggedUtc DESC);
END;
GO

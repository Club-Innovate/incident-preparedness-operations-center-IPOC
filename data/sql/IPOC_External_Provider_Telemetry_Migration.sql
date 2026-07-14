SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'ops')
BEGIN
	EXEC(N'CREATE SCHEMA ops AUTHORIZATION dbo;');
END
GO

IF OBJECT_ID(N'ops.ExternalProviderTelemetryEvent', N'U') IS NULL
BEGIN
	CREATE TABLE ops.ExternalProviderTelemetryEvent
	(
		ExternalProviderTelemetryEventId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ExternalProviderTelemetryEvent PRIMARY KEY,
		Provider NVARCHAR(120) NOT NULL,
		EventType NVARCHAR(40) NOT NULL,
		Detail NVARCHAR(1000) NULL,
		EventUtc DATETIMEOFFSET(0) NOT NULL,
		RecordedUtc DATETIMEOFFSET(0) NOT NULL CONSTRAINT DF_ExternalProviderTelemetryEvent_RecordedUtc DEFAULT (SYSUTCDATETIME())
	);
END
GO

IF NOT EXISTS (
	SELECT 1
	FROM sys.indexes
	WHERE object_id = OBJECT_ID(N'ops.ExternalProviderTelemetryEvent', N'U')
	  AND name = N'IX_ExternalProviderTelemetryEvent_Provider_EventUtc')
BEGIN
	CREATE INDEX IX_ExternalProviderTelemetryEvent_Provider_EventUtc
		ON ops.ExternalProviderTelemetryEvent (Provider, EventUtc DESC)
		INCLUDE (EventType, Detail, RecordedUtc);
END
GO

IF NOT EXISTS (
	SELECT 1
	FROM sys.indexes
	WHERE object_id = OBJECT_ID(N'ops.ExternalProviderTelemetryEvent', N'U')
	  AND name = N'IX_ExternalProviderTelemetryEvent_EventUtc')
BEGIN
	CREATE INDEX IX_ExternalProviderTelemetryEvent_EventUtc
		ON ops.ExternalProviderTelemetryEvent (EventUtc DESC)
		INCLUDE (Provider, EventType, Detail, RecordedUtc);
END
GO

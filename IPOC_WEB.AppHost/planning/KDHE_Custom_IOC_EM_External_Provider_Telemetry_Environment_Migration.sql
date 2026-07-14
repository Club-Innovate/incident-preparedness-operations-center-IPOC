SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

IF COL_LENGTH('ops.ExternalProviderTelemetryEvent', 'EnvironmentName') IS NULL
BEGIN
	ALTER TABLE ops.ExternalProviderTelemetryEvent
	ADD EnvironmentName NVARCHAR(80) NULL;
END
GO

UPDATE ops.ExternalProviderTelemetryEvent
SET EnvironmentName = ISNULL(NULLIF(EnvironmentName, N''), N'Unknown')
WHERE EnvironmentName IS NULL OR EnvironmentName = N'';
GO

IF NOT EXISTS (
	SELECT 1
	FROM sys.indexes
	WHERE object_id = OBJECT_ID(N'ops.ExternalProviderTelemetryEvent', N'U')
	  AND name = N'IX_ExternalProviderTelemetryEvent_Environment_EventUtc')
BEGIN
	CREATE INDEX IX_ExternalProviderTelemetryEvent_Environment_EventUtc
		ON ops.ExternalProviderTelemetryEvent (EnvironmentName, EventUtc DESC)
		INCLUDE (Provider, EventType, Detail, RecordedUtc);
END
GO

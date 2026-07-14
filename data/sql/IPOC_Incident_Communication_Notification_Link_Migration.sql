/*
File: IPOC_WEB.AppHost/planning/IPOC_Incident_Communication_Notification_Link_Migration.sql
Purpose: Adds durable link from ic.IncidentCommunication to comm.Notification for communication notification traceability.
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'ic.IncidentCommunication', N'U') IS NOT NULL
BEGIN
	IF COL_LENGTH(N'ic.IncidentCommunication', N'NotificationId') IS NULL
	BEGIN
		EXEC sp_executesql N'ALTER TABLE ic.IncidentCommunication ADD NotificationId BIGINT NULL;';
	END;

	IF NOT EXISTS
	(
		SELECT 1
		FROM sys.foreign_keys
		WHERE name = N'FK_IncidentCommunication_Notification'
		  AND parent_object_id = OBJECT_ID(N'ic.IncidentCommunication', N'U')
	)
	BEGIN
		EXEC sp_executesql N'
			ALTER TABLE ic.IncidentCommunication
			ADD CONSTRAINT FK_IncidentCommunication_Notification
				FOREIGN KEY (NotificationId) REFERENCES comm.Notification(NotificationId);';
	END;

	IF NOT EXISTS
	(
		SELECT 1
		FROM sys.indexes
		WHERE name = N'IX_IncidentCommunication_NotificationId'
		  AND object_id = OBJECT_ID(N'ic.IncidentCommunication', N'U')
	)
	BEGIN
		EXEC sp_executesql N'
			CREATE NONCLUSTERED INDEX IX_IncidentCommunication_NotificationId
				ON ic.IncidentCommunication(NotificationId)
				WHERE NotificationId IS NOT NULL;';
	END;
END;
GO

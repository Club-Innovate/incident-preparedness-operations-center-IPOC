/*
File: IPOC_WEB.AppHost/planning/IPOC_Notification_Recipient_Ack_Migration.sql
Purpose:
  Add durable recipient acknowledgment evidence for communications orchestration.
*/

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS
(
	SELECT 1
	FROM sys.tables t
	INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
	WHERE s.name = 'comm'
	  AND t.name = 'NotificationRecipientAcknowledgment'
)
BEGIN
	CREATE TABLE comm.NotificationRecipientAcknowledgment
	(
		NotificationRecipientAcknowledgmentId bigint IDENTITY(1,1) NOT NULL
			CONSTRAINT PK_comm_NotificationRecipientAcknowledgment PRIMARY KEY,
		NotificationRecipientId bigint NOT NULL
			CONSTRAINT FK_comm_RecipientAck_Recipient FOREIGN KEY REFERENCES comm.NotificationRecipient(NotificationRecipientId),
		NotificationId bigint NOT NULL
			CONSTRAINT FK_comm_RecipientAck_Notification FOREIGN KEY REFERENCES comm.Notification(NotificationId),
		AcknowledgedByUserId bigint NOT NULL
			CONSTRAINT FK_comm_RecipientAck_User FOREIGN KEY REFERENCES sec.AppUser(UserId),
		AcknowledgedUtc datetime2(3) NOT NULL
			CONSTRAINT DF_comm_RecipientAck_AcknowledgedUtc DEFAULT SYSUTCDATETIME(),
		AcknowledgmentNote nvarchar(1000) NULL,
		CONSTRAINT UQ_comm_RecipientAck_Recipient UNIQUE(NotificationRecipientId)
	);

	CREATE INDEX IX_comm_RecipientAck_Notification
		ON comm.NotificationRecipientAcknowledgment(NotificationId, AcknowledgedUtc DESC)
		INCLUDE(NotificationRecipientId, AcknowledgedByUserId);
END
GO

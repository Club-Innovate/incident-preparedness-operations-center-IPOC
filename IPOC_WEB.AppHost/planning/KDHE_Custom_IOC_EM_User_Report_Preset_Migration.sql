/*
File: IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_User_Report_Preset_Migration.sql
Purpose: Add table for per-user report preset persistence
*/

USE [IOCEM];
GO

IF OBJECT_ID('app.UserReportPreset', 'U') IS NULL
BEGIN
	CREATE TABLE app.UserReportPreset
	(
		UserReportPresetId bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
		UserId bigint NOT NULL,
		PresetScope nvarchar(80) NOT NULL,
		PresetName nvarchar(140) NOT NULL,
		PresetJson nvarchar(max) NOT NULL,
		CreatedUtc datetime2(7) NOT NULL CONSTRAINT DF_UserReportPreset_CreatedUtc DEFAULT SYSUTCDATETIME(),
		UpdatedUtc datetime2(7) NOT NULL CONSTRAINT DF_UserReportPreset_UpdatedUtc DEFAULT SYSUTCDATETIME(),
		RowVer rowversion NOT NULL,
		CONSTRAINT FK_UserReportPreset_AppUser_UserId FOREIGN KEY (UserId) REFERENCES sec.AppUser(UserId)
	);

	CREATE UNIQUE INDEX UX_UserReportPreset_User_Scope_Name
		ON app.UserReportPreset(UserId, PresetScope, PresetName);

	CREATE INDEX IX_UserReportPreset_User_Scope_UpdatedUtc
		ON app.UserReportPreset(UserId, PresetScope, UpdatedUtc DESC);
END
GO

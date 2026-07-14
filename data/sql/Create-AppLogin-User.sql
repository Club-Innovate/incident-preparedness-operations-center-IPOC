/*
File: Create-AppLogin-User.sql
Purpose: Create app_login SQL user with appropriate permissions for IOCEM database

Instructions:
1. Open SQL Server Management Studio (SSMS)
2. Connect to (local) with your admin account (e.g., sa or Windows Authentication)
3. Execute this script
4. Then run Initialize-Database.ps1
*/

USE [master];
GO

-- Create login at server level
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'app_login')
BEGIN
	CREATE LOGIN [app_login] WITH PASSWORD = '!devapp1', CHECK_POLICY = OFF;
	PRINT 'Created login: app_login';
END
ELSE
BEGIN
	PRINT 'Login app_login already exists.';
END
GO

-- Switch to IOCEM database
USE [IOCEM];
GO

-- Create user in IOCEM database
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'app_login')
BEGIN
	CREATE USER [app_login] FOR LOGIN [app_login];
	PRINT 'Created user: app_login in IOCEM database';
END
ELSE
BEGIN
	PRINT 'User app_login already exists in IOCEM database.';
END
GO

-- Grant permissions
ALTER ROLE db_owner ADD MEMBER [app_login];
GO

PRINT 'Granted db_owner role to app_login in IOCEM database.';
PRINT '';
PRINT 'Setup complete! You can now run Initialize-Database.ps1';
GO

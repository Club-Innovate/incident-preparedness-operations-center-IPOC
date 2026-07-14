-- Quick Database Status Check for IOCEM
-- Run this in SSMS to see what already exists

USE IOCEM;
GO

PRINT 'Checking schemas...';
SELECT name AS SchemaName
FROM sys.schemas
WHERE name IN ('ic', 'ref', 'sec', 'org', 'res', 'eei', 'comm', 'doc', 'assessment', 'audit', 'intg', 'app')
ORDER BY name;

PRINT '';
PRINT 'Checking ref schema tables...';
SELECT name AS TableName
FROM sys.tables
WHERE schema_id = SCHEMA_ID('ref')
ORDER BY name;

PRINT '';
PRINT 'Checking ic schema tables...';
SELECT name AS TableName
FROM sys.tables
WHERE schema_id = SCHEMA_ID('ic')
ORDER BY name;

PRINT '';
PRINT 'Checking lookup data...';
IF OBJECT_ID('ref.CodeSet') IS NOT NULL
BEGIN
	SELECT 'CodeSet' AS TableName, COUNT(*) AS RecordCount FROM ref.CodeSet;
	SELECT 'CodeValue' AS TableName, COUNT(*) AS RecordCount FROM ref.CodeValue;

	PRINT '';
	PRINT 'CodeSet values:';
	SELECT CodeSetId, CodeSetName, Description FROM ref.CodeSet ORDER BY CodeSetName;

	PRINT '';
	PRINT 'CodeValue counts by CodeSet:';
	SELECT cs.CodeSetName, COUNT(cv.CodeValueId) AS ValueCount
	FROM ref.CodeSet cs
	LEFT JOIN ref.CodeValue cv ON cv.CodeSetId = cs.CodeSetId
	GROUP BY cs.CodeSetName
	ORDER BY cs.CodeSetName;
END
ELSE
BEGIN
	PRINT 'ref.CodeSet table does not exist yet.';
END

PRINT '';
PRINT 'Status check complete.';
GO

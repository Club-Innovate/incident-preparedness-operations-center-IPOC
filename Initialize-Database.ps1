<#
.SYNOPSIS
	Initializes KPP_WEB database with schema and lookup seed data.

.DESCRIPTION
	Executes the NIMS data model and lookup migration SQL scripts against the configured IOCEM database.
	Uses the existing database connection configuration from appsettings.Development.json.

.PARAMETER ServerInstance
	SQL Server instance name (default: "(local)" to match appsettings.Development.json)

.PARAMETER Database
	Target database name (default: "IOCEM" - the existing database)

.PARAMETER IntegratedSecurity
	Use Windows Authentication (default: false). Uses SQL Authentication with app_login account by default.

.PARAMETER Username
	SQL Server username (default: "app_login" from appsettings.Development.json)

.PARAMETER Password
	SQL Server password (default: "!devapp1" from appsettings.Development.json)

.EXAMPLE
	.\Initialize-Database.ps1

	Uses defaults from appsettings.Development.json:
	- Server: (local)
	- Database: IOCEM
	- User: app_login
	- Password: !devapp1

.EXAMPLE
	.\Initialize-Database.ps1 -ServerInstance "localhost" -IntegratedSecurity $true

	Uses Windows Authentication instead of SQL Authentication

.NOTES
	Author: Hans Esquivel
	Created: 2026-06-22
	Purpose: One-step database initialization for KPP_WEB development and deployment
#>

param(
	[Parameter(Mandatory=$false)]
	[string]$ServerInstance = "(local)",

	[Parameter(Mandatory=$false)]
	[string]$Database = "IOCEM",

	[Parameter(Mandatory=$false)]
	[bool]$IntegratedSecurity = $false,

	[Parameter(Mandatory=$false)]
	[string]$Username = "app_login",

	[Parameter(Mandatory=$false)]
	[string]$Password = "!devapp1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "KPP_WEB Database Initialization Script"  -ForegroundColor Cyan
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host ""

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$planningDir = Join-Path $scriptRoot "KPP_WEB.AppHost" "planning"

$dataModelScript = Join-Path $planningDir "KDHE_Custom_IOC_EM_NIMS_Data_Model.sql"
$lookupMigrationScript = Join-Path $planningDir "KDHE_Custom_IOC_EM_Lookup_Migration.sql"

# Validate script files exist
if (-not (Test-Path $dataModelScript)) {
	Write-Error "Data model script not found: $dataModelScript"
	exit 1
}

if (-not (Test-Path $lookupMigrationScript)) {
	Write-Error "Lookup migration script not found: $lookupMigrationScript"
	exit 1
}

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Server Instance: $ServerInstance" -ForegroundColor White
Write-Host "  Database: $Database" -ForegroundColor White
Write-Host "  Integrated Security: $IntegratedSecurity" -ForegroundColor White
Write-Host ""

# Build connection string
if ($IntegratedSecurity) {
	$connectionString = "Server=$ServerInstance;Database=$Database;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=30;"
} else {
	# Use provided credentials (defaults from appsettings.Development.json)
	$connectionString = "Server=$ServerInstance;Database=$Database;User Id=$Username;Password=$Password;TrustServerCertificate=True;Encrypt=True;Connection Timeout=30;"
}

Write-Host "Testing database connection..." -ForegroundColor Yellow
try {
	$connection = New-Object System.Data.SqlClient.SqlConnection
	$connection.ConnectionString = $connectionString
	$connection.Open()
	Write-Host "✓ Connection successful!" -ForegroundColor Green
	$connection.Close()
} catch {
	Write-Error "Failed to connect to database: $_"
	exit 1
}

Write-Host ""
Write-Host "Step 1: Executing NIMS Data Model script..." -ForegroundColor Yellow
try {
	$dataModelSql = Get-Content $dataModelScript -Raw
	$connection = New-Object System.Data.SqlClient.SqlConnection
	$connection.ConnectionString = $connectionString
	$connection.Open()

	# Split by GO statements and execute each batch
	$batches = $dataModelSql -split '\r?\nGO\r?\n'
	$batchCount = 0
	foreach ($batch in $batches) {
		$batch = $batch.Trim()
		if ($batch.Length -gt 0 -and -not $batch.StartsWith('/*') -and -not $batch.StartsWith('--')) {
			$command = New-Object System.Data.SqlClient.SqlCommand
			$command.Connection = $connection
			$command.CommandText = $batch
			$command.CommandTimeout = 300
			$command.ExecuteNonQuery() | Out-Null
			$batchCount++
		}
	}

	$connection.Close()
	Write-Host "✓ Data model script executed successfully! ($batchCount batches)" -ForegroundColor Green
} catch {
	Write-Error "Failed to execute data model script: $_"
	exit 1
}

Write-Host ""
Write-Host "Step 2: Executing Lookup Migration script..." -ForegroundColor Yellow
try {
	$lookupSql = Get-Content $lookupMigrationScript -Raw
	$connection = New-Object System.Data.SqlClient.SqlConnection
	$connection.ConnectionString = $connectionString
	$connection.Open()

	# Split by GO statements and execute each batch
	$batches = $lookupSql -split '\r?\nGO\r?\n'
	$batchCount = 0
	foreach ($batch in $batches) {
		$batch = $batch.Trim()
		if ($batch.Length -gt 0 -and -not $batch.StartsWith('/*') -and -not $batch.StartsWith('--')) {
			$command = New-Object System.Data.SqlClient.SqlCommand
			$command.Connection = $connection
			$command.CommandText = $batch
			$command.CommandTimeout = 300
			$command.ExecuteNonQuery() | Out-Null
			$batchCount++
		}
	}

	$connection.Close()
	Write-Host "✓ Lookup migration script executed successfully! ($batchCount batches)" -ForegroundColor Green
} catch {
	Write-Error "Failed to execute lookup migration script: $_"
	exit 1
}

Write-Host ""
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "Database initialization complete!"  -ForegroundColor Green
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Start the backend: dotnet run --project KPP_WEB.AppHost" -ForegroundColor White
Write-Host "  2. Start the frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host "  3. Sign in with your Azure AD account" -ForegroundColor White
Write-Host "  4. Navigate to Incidents view and create your first incident!" -ForegroundColor White
Write-Host ""
Write-Host "For detailed workflow guidance, see:" -ForegroundColor Yellow
Write-Host "  KPP_WEB.AppHost/planning/Frontend_Incident_Workflow_Guide.md" -ForegroundColor White
Write-Host ""

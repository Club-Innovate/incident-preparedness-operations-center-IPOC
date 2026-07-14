[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionString,

  [ValidateSet('NORMAL', 'SURGE', 'CASCADING')]
  [string]$ScenarioMode = 'SURGE',

  [switch]$SkipReset,
  [switch]$SkipSchemaInit,
  [switch]$SkipSeed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-SqlConnection {
  param(
	[Parameter(Mandatory = $true)]
	[string]$ConnectionString
  )

  try {
	Add-Type -AssemblyName 'Microsoft.Data.SqlClient' -ErrorAction Stop
	return [Microsoft.Data.SqlClient.SqlConnection]::new($ConnectionString)
  }
  catch {
	if ($ConnectionString -match '(?i)\bauthentication\s*=\s*active\s+directory\s+default') {
	  if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
		throw "Connection string uses Authentication=Active Directory Default, Microsoft.Data.SqlClient is unavailable, and Azure CLI (az) is not installed. Install az or use SQL auth connection string for this script run."
	  }

	  $token = (& az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv 2>$null)
	  if ([string]::IsNullOrWhiteSpace($token)) {
		throw "Unable to acquire Azure SQL access token from Azure CLI. Run 'az login' and retry."
	  }

	  $sqlAuthlessConnectionString = ($ConnectionString -replace '(?i)(^|;)\s*Authentication\s*=\s*[^;]*;?', ';') -replace ';{2,}', ';'
	  $sqlAuthlessConnectionString = $sqlAuthlessConnectionString.Trim(';')

	  $fallbackConnection = [System.Data.SqlClient.SqlConnection]::new($sqlAuthlessConnectionString)
	  $fallbackConnection.AccessToken = $token
	  return $fallbackConnection
	}

	return [System.Data.SqlClient.SqlConnection]::new($ConnectionString)
  }
}

function Invoke-SqlBatchScript {
  param(
	[Parameter(Mandatory = $true)]
	[string]$ScriptPath,

	[Parameter(Mandatory = $true)]
	[string]$ConnectionString,

	[hashtable]$SqlVariables = @{}
  )

  if (-not (Test-Path $ScriptPath)) {
	throw "SQL script not found: $ScriptPath"
  }

  Write-Host "[DEMO] Executing SQL script: $ScriptPath" -ForegroundColor Cyan
  $rawSql = Get-Content -Path $ScriptPath -Raw

  foreach ($key in $SqlVariables.Keys) {
	$token = "`$($($key))"
	$rawSql = $rawSql.Replace($token, [string]$SqlVariables[$key])
  }

	$connection = New-SqlConnection -ConnectionString $ConnectionString
  $connection.Open()

  try {
	$command = $connection.CreateCommand()
	$command.CommandTimeout = 600

	$batches = $rawSql -split "(?im)^\s*GO\s*$"
	foreach ($batch in $batches) {
	  $trimmed = $batch.Trim()
	  if ([string]::IsNullOrWhiteSpace($trimmed)) {
		continue
	  }

	  $command.CommandText = $trimmed
	  [void]$command.ExecuteNonQuery()
	}
  }
  finally {
	$connection.Dispose()
  }
}

function Invoke-SqlScalar {
  param(
	[Parameter(Mandatory = $true)]
	[string]$ConnectionString,

	[Parameter(Mandatory = $true)]
	[string]$Sql
  )

	$connection = New-SqlConnection -ConnectionString $ConnectionString
  $connection.Open()

  try {
	$command = $connection.CreateCommand()
	$command.CommandTimeout = 120
	$command.CommandText = $Sql
	return $command.ExecuteScalar()
  }
  finally {
	$connection.Dispose()
  }
}

try {
  $basePath = Split-Path -Parent $MyInvocation.MyCommand.Path
  $initScriptPath = Join-Path $basePath 'Initialize-Database.ps1'
	$syntheticSeedScriptPath = Join-Path $basePath 'KDHE_Custom_IOC_EM_Logistics_Synthetic_Data.sql'
  $scenarioScriptPath = Join-Path $basePath 'KDHE_Custom_IOC_EM_Logistics_Scenario_Pack_v1.sql'

  if (-not (Test-Path $initScriptPath)) {
	throw "Initialize script not found at expected path: $initScriptPath"
  }

  if (-not (Test-Path $syntheticSeedScriptPath)) {
	throw "Synthetic seed script not found at expected path: $syntheticSeedScriptPath"
  }

  $schemaAlreadyInitialized = [int](Invoke-SqlScalar -ConnectionString $ConnectionString -Sql @"
SELECT COUNT(*)
FROM sys.objects
WHERE type = 'U'
  AND name = 'CodeSet';
"@) -gt 0

  if (-not $SkipReset) {
	Write-Host '[DEMO] Resetting synthetic baseline data...' -ForegroundColor Yellow
	& $initScriptPath -ConnectionString $ConnectionString -ResetSyntheticLogisticsData
  }
  else {
	Write-Host '[DEMO] SkipReset enabled. Existing synthetic data will be reused.' -ForegroundColor Yellow
  }

	if (-not $SkipSchemaInit -and -not $schemaAlreadyInitialized) {
	Write-Host '[DEMO] Ensuring schema/migrations are applied...' -ForegroundColor Yellow
	& $initScriptPath -ConnectionString $ConnectionString
  }
	elseif (-not $SkipSchemaInit -and $schemaAlreadyInitialized) {
	Write-Host '[DEMO] Schema appears initialized already (CodeSet table found). Skipping schema init pass.' -ForegroundColor Yellow
  }
  else {
	Write-Host '[DEMO] SkipSchemaInit enabled. Schema init step skipped.' -ForegroundColor Yellow
  }

  if (-not $SkipSeed) {
	Write-Host '[DEMO] Seeding synthetic logistics baseline data...' -ForegroundColor Yellow
	Invoke-SqlBatchScript -ScriptPath $syntheticSeedScriptPath -ConnectionString $ConnectionString
  }
  else {
	Write-Host '[DEMO] SkipSeed enabled. Synthetic baseline seed step skipped.' -ForegroundColor Yellow
  }

  Write-Host "[DEMO] Applying scenario overlay: $ScenarioMode" -ForegroundColor Yellow
  Invoke-SqlBatchScript -ScriptPath $scenarioScriptPath -ConnectionString $ConnectionString -SqlVariables @{ ScenarioMode = $ScenarioMode }

  $syntheticLocationCount = Invoke-SqlScalar -ConnectionString $ConnectionString -Sql @"
SELECT COUNT(*)
FROM org.Location
WHERE LocationName LIKE 'Synthetic %';
"@

  $syntheticInventoryCount = Invoke-SqlScalar -ConnectionString $ConnectionString -Sql @"
SELECT COUNT(*)
FROM res.LocationResourceInventory inv
JOIN org.Location l ON l.LocationId = inv.LocationId
WHERE l.LocationName LIKE 'Synthetic %';
"@

  $scenarioSnapshotCount = Invoke-SqlScalar -ConnectionString $ConnectionString -Sql @"
SELECT COUNT(*)
FROM res.BedAvailabilitySnapshot
WHERE SourceSystemCode = 'SYNTHETIC'
  AND SourceMessageId LIKE 'SYNTH-BED-$ScenarioMode-%';
"@

  $scenarioRequestCount = Invoke-SqlScalar -ConnectionString $ConnectionString -Sql @"
SELECT COUNT(*)
FROM ic.IncidentResourceRequest irr
JOIN ic.Incident i ON i.IncidentId = irr.IncidentId
WHERE i.IncidentNumber = 'SYN-LOG-2026-001'
  AND irr.Notes LIKE 'Synthetic scenario overlay:%';
"@

  Write-Host ''
  Write-Host '=== Production-Style Demo Data Preparation Summary ===' -ForegroundColor Green
  Write-Host ("Scenario Mode Applied       : {0}" -f $ScenarioMode)
  Write-Host ("Synthetic Locations         : {0}" -f $syntheticLocationCount)
  Write-Host ("Synthetic Inventory Rows    : {0}" -f $syntheticInventoryCount)
  Write-Host ("Scenario Bed Snapshots      : {0}" -f $scenarioSnapshotCount)
  Write-Host ("Scenario Overlay Requests   : {0}" -f $scenarioRequestCount)
  Write-Host '=====================================================' -ForegroundColor Green
}
catch {
  Write-Host "[DEMO] Production-style demo data preparation failed: $($_.Exception.Message)" -ForegroundColor Red
  throw
}

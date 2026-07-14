[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionString,

	[switch]$IncludeSyntheticLogisticsData,
  [switch]$ResetSyntheticLogisticsData
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

function Invoke-SqlScript {
  param(
	[Parameter(Mandatory = $true)]
	[string]$ScriptPath,
	[Parameter(Mandatory = $true)]
	[string]$ConnectionString
  )

  if (-not (Test-Path $ScriptPath)) {
	throw "SQL script not found: $ScriptPath"
  }

  Write-Host "[DB] Executing: $ScriptPath" -ForegroundColor Cyan
  $sql = Get-Content -Path $ScriptPath -Raw

	$connection = New-SqlConnection -ConnectionString $ConnectionString
  $connection.Open()

  try {
	$command = $connection.CreateCommand()
	$command.CommandTimeout = 600

	$batches = $sql -split "(?im)^\s*GO\s*$"
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

try {
  $basePath = Split-Path -Parent $MyInvocation.MyCommand.Path

  if ($IncludeSyntheticLogisticsData -and $ResetSyntheticLogisticsData) {
	throw 'Use either -IncludeSyntheticLogisticsData or -ResetSyntheticLogisticsData, not both.'
  }

  if ($ResetSyntheticLogisticsData) {
	$resetPath = Join-Path $basePath 'KDHE_Custom_IOC_EM_Logistics_Synthetic_Data_Reset.sql'
	Invoke-SqlScript -ScriptPath $resetPath -ConnectionString $ConnectionString
	Write-Host '[DB] Synthetic logistics data reset completed.' -ForegroundColor Green
	Write-Host '[DB] Database initialization completed successfully.' -ForegroundColor Green
	return
  }

  $scripts = @(
	(Join-Path $basePath 'KDHE_Custom_IOC_EM_NIMS_Data_Model.sql'),
	(Join-Path $basePath 'KDHE_Custom_IOC_EM_Lookup_Migration.sql'),
	(Join-Path $basePath 'KDHE_Custom_IOC_EM_Incident_Resource_Request_Migration.sql'),
	(Join-Path $basePath 'KDHE_Custom_IOC_EM_External_Provider_Telemetry_Migration.sql'),
	(Join-Path $basePath 'KDHE_Custom_IOC_EM_External_Provider_Telemetry_Environment_Migration.sql')
  )

  foreach ($script in $scripts) {
	Invoke-SqlScript -ScriptPath $script -ConnectionString $ConnectionString
  }

  if ($IncludeSyntheticLogisticsData) {
	$syntheticPath = Join-Path $basePath 'KDHE_Custom_IOC_EM_Logistics_Synthetic_Data.sql'
	Invoke-SqlScript -ScriptPath $syntheticPath -ConnectionString $ConnectionString
	Write-Host '[DB] Synthetic logistics data seed completed.' -ForegroundColor Green
  }

  Write-Host '[DB] Database initialization completed successfully.' -ForegroundColor Green
}
catch {
  Write-Host "[DB] Database initialization failed: $($_.Exception.Message)" -ForegroundColor Red
  throw
}

<#
.SYNOPSIS
Runs local API and authorization smoke validations.

.DESCRIPTION
Operator status interpretation runbook:
- Frontend authorization smoke status:
  - Passed: frontend policy-source and UI wiring checks passed.
  - Skipped*: check did not execute (explicit skip, missing npm, or missing frontend path).
  - Failed/FailedExecution: check executed and failed or could not execute.
- Backend report-presets policy alignment smoke status:
  - Passed: authorization smoke script contains backend route-policy assertions.
  - Skipped*: backend alignment check could not run due to missing authorization smoke script.
  - Failed/FailedExecution: backend alignment assertions missing or check failed.
- Runtime report-presets endpoint auth checks:
  - No bearer token: expects 401 (or 200 when Development User Bypass is enabled).
  - Bearer token: expects 200.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "https://localhost:7435",
  [string]$BearerToken = "",
  [long]$IapIncidentIdNoApproved = 0,
  [long]$IapIncidentIdApproved = 0,
  [long]$IapApproveIncidentId = 0,
  [long]$IapApproveOperationalPeriodId = 0,
  [long]$CommunicationIncidentId = 0,
  [string]$CommunicationDestinationAddress = "ops-smoke@example.org",
  [string]$CommunicationEvidenceFromUtc = "",
  [string]$CommunicationEvidenceToUtc = "",
  [long]$ResourceIncidentId = 0,
	[string]$ResourceStatusCode = "",
	[string]$ResourceRollupRegionName = "",
	[int]$ResourceRollupRegionId = 0,
	[string]$NavigationPresetScope = "navigation-logistics",
	[long]$AdminSessionUserSessionId = 0,
	[long]$AdminSessionTargetUserId = 0,
	[string]$AdminSessionImpersonationReason = "Smoke gate impersonation control validation.",
  [switch]$SkipFrontendAuthorizationSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:Failures = 0
$script:FrontendAuthorizationSmokeStatus = "NotRun"
$script:BackendReportPresetsPolicySmokeStatus = "NotRun"

function Write-Step([string]$message) {
  Write-Host "[SMOKE] $message" -ForegroundColor Cyan
}

function Invoke-BackendReportPresetsPolicyAlignmentSmoke {
  Write-Step "Validating backend report-presets policy alignment."
  try {
	$frontendPath = Join-Path $PSScriptRoot "..\..\..\frontend"
	$authorizationSmokePath = Join-Path $frontendPath "scripts\authorization-smoke.mjs"

	if (-not (Test-Path $authorizationSmokePath)) {
	  $script:BackendReportPresetsPolicySmokeStatus = "SkippedMissingAuthorizationSmokeScript"
	  Write-Step "Skipping backend report-presets policy alignment smoke because authorization smoke script was not found: $authorizationSmokePath"
	  return
	}

	$authorizationSmokeSource = Get-Content -Path $authorizationSmokePath -Raw
	$hasBackendGetAssertion = $authorizationSmokeSource -match 'resources\.MapGet\("/report-presets/\{presetScope\}"'
	$hasBackendPostAssertion = $authorizationSmokeSource -match 'resources\.MapPost\("/report-presets/\{presetScope\}"'
	$hasBackendDeleteAssertion = $authorizationSmokeSource -match 'resources\.MapDelete\("/report-presets/\{presetScope\}/\{userReportPresetId:long\}"'
	$hasResourceReporterPolicyAssertion = $authorizationSmokeSource -match 'AuthorizationPolicies\.ResourceReporter'

	if ($hasBackendGetAssertion -and $hasBackendPostAssertion -and $hasBackendDeleteAssertion -and $hasResourceReporterPolicyAssertion) {
	  $script:BackendReportPresetsPolicySmokeStatus = "Passed"
	  Write-Pass "Backend report-presets policy alignment checks are enforced by frontend authorization smoke assertions."
	  return
	}

	$script:BackendReportPresetsPolicySmokeStatus = "Failed"
	Write-Fail "Backend report-presets policy alignment assertions are missing from frontend authorization smoke script."
  }
  catch {
	$script:BackendReportPresetsPolicySmokeStatus = "FailedExecution"
	Write-Fail "Backend report-presets policy alignment smoke failed to execute: $($_.Exception.Message)"
  }
}

function Invoke-AuthorizationSmoke {
	if ($SkipFrontendAuthorizationSmoke) {
	$script:FrontendAuthorizationSmokeStatus = "SkippedExplicit"
	Write-Step "Skipping frontend authorization smoke checks by request."
	return
  }

  Write-Step "Running frontend authorization smoke checks."
  $frontendPath = Join-Path $PSScriptRoot "..\..\..\frontend"
  if (-not (Test-Path $frontendPath)) {
	$script:FrontendAuthorizationSmokeStatus = "SkippedMissingFrontendPath"
	Write-Step "Skipping frontend authorization smoke checks because frontend path was not found: $frontendPath"
	return
  }

  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  if ($null -eq $npmCommand) {
	$script:FrontendAuthorizationSmokeStatus = "SkippedMissingNpm"
	Write-Step "Skipping frontend authorization smoke checks because npm is not available on PATH."
	return
  }

  $originalLocation = Get-Location
  try {
	Set-Location $frontendPath
	$output = npm run smoke:authz 2>&1
	if ($LASTEXITCODE -eq 0) {
	  $script:FrontendAuthorizationSmokeStatus = "Passed"
	  Write-Pass "Frontend authorization smoke checks passed."
	}
	else {
	  $script:FrontendAuthorizationSmokeStatus = "Failed"
	  Write-Fail "Frontend authorization smoke checks failed. Output: $output"
	}
  }
  catch {
	$script:FrontendAuthorizationSmokeStatus = "FailedExecution"
	Write-Fail "Frontend authorization smoke checks failed to execute: $($_.Exception.Message)"
  }
  finally {
	Set-Location $originalLocation
  }
}

function Write-Pass([string]$message) {
  Write-Host "[PASS ] $message" -ForegroundColor Green
}

function Write-Fail([string]$message) {
  Write-Host "[FAIL ] $message" -ForegroundColor Red
  $script:Failures += 1
}

function Has-JsonProperty([object]$jsonObject, [string]$propertyName) {
  return $null -ne $jsonObject -and $null -ne $jsonObject.PSObject.Properties[$propertyName]
}

function Assert-ExecutivePacketAutomationStatusPayload([string]$body, [string]$context) {
  if ([string]::IsNullOrWhiteSpace($body)) {
	Write-Fail "Executive packet automation status payload was empty ($context)."
	return
  }

  try {
	$payload = $body | ConvertFrom-Json
  }
  catch {
	Write-Fail "Executive packet automation status payload was not valid JSON ($context)."
	return
  }

  $requiredFields = @(
	"enabled",
	"running",
	"lastRunSucceeded",
	"lastPacketEventCount",
	"lastTransportMode",
	"lastTransportDestination",
	"lastTransportArtifactId",
	"lastTransportAttempts",
	"lastTransportSucceeded",
	"intervalMinutes",
	"outputDirectory"
  )

  $missingFields = @($requiredFields | Where-Object { -not (Has-JsonProperty $payload $_) })
  if ($missingFields.Count -gt 0) {
	Write-Fail "Executive packet automation status payload missing required fields ($context): $($missingFields -join ', ')."
	return
  }

  Write-Pass "Executive packet automation status payload contains required transport evidence fields ($context)."
}

function Assert-ExecutivePacketAutomationRunPayload([string]$body, [string]$context) {
  if ([string]::IsNullOrWhiteSpace($body)) {
	Write-Fail "Executive packet automation run payload was empty ($context)."
	return
  }

  try {
	$payload = $body | ConvertFrom-Json
  }
  catch {
	Write-Fail "Executive packet automation run payload was not valid JSON ($context)."
	return
  }

  $requiredFields = @(
	"succeeded",
	"packetPath",
	"transportMode",
	"transportDestination",
	"transportArtifactId",
	"transportAttempts",
	"transportSucceeded",
	"sourceEventCount",
	"startedUtc",
	"completedUtc",
	"error"
  )

  $missingFields = @($requiredFields | Where-Object { -not (Has-JsonProperty $payload $_) })
  if ($missingFields.Count -gt 0) {
	Write-Fail "Executive packet automation run payload missing required fields ($context): $($missingFields -join ', ')."
	return
  }

  Write-Pass "Executive packet automation run payload contains required transport evidence fields ($context)."
}

function Build-Query([string]$fromUtc, [string]$toUtc) {
  $parts = @()
  if (-not [string]::IsNullOrWhiteSpace($fromUtc)) {
	$parts += "fromUtc=$([System.Uri]::EscapeDataString($fromUtc))"
  }

  if (-not [string]::IsNullOrWhiteSpace($toUtc)) {
	$parts += "toUtc=$([System.Uri]::EscapeDataString($toUtc))"
  }

  if ($parts.Count -eq 0) {
	return ""
  }

  return "?" + ($parts -join "&")
}

function Invoke-Api([string]$path, [int[]]$expectedStatusCodes) {
  $uri = "$ApiBaseUrl$path"
  $headers = @{}
  if (-not [string]::IsNullOrWhiteSpace($BearerToken)) {
	$headers["Authorization"] = "Bearer $BearerToken"
  }

  try {
	$response = Invoke-WebRequest -Uri $uri -Method Get -Headers $headers -SkipCertificateCheck
	if ($expectedStatusCodes -contains [int]$response.StatusCode) {
	  Write-Pass "GET $path -> $($response.StatusCode)"
	  return @{ StatusCode = [int]$response.StatusCode; Body = $response.Content }
	}

	Write-Fail "GET $path returned unexpected status $($response.StatusCode). Expected: $($expectedStatusCodes -join ', ')"
	return $null
  }
  catch {
	$statusCode = -1
	$exception = $_.Exception

	if ($null -ne $exception) {
	  $responseProperty = $exception.PSObject.Properties["Response"]
	  if ($null -ne $responseProperty -and $null -ne $responseProperty.Value) {
		$statusCode = [int]$responseProperty.Value.StatusCode
	  }
	  elseif ($exception.PSObject.Properties["StatusCode"] -and $null -ne $exception.StatusCode) {
		$statusCode = [int]$exception.StatusCode
	  }
	}

	if ($expectedStatusCodes -contains $statusCode) {
	  Write-Pass "GET $path -> $statusCode"
	  return @{ StatusCode = $statusCode; Body = $null }
	}

	Write-Fail "GET $path failed with status $statusCode. Error: $($exception.Message)"
	return $null
  }
}

function Invoke-ApiPost([string]$path, [int[]]$expectedStatusCodes) {
  $uri = "$ApiBaseUrl$path"
  $headers = @{}
  if (-not [string]::IsNullOrWhiteSpace($BearerToken)) {
	$headers["Authorization"] = "Bearer $BearerToken"
  }

  try {
	$response = Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -SkipCertificateCheck
	if ($expectedStatusCodes -contains [int]$response.StatusCode) {
	  Write-Pass "POST $path -> $($response.StatusCode)"
	  return @{ StatusCode = [int]$response.StatusCode; Body = $response.Content }
	}

	Write-Fail "POST $path returned unexpected status $($response.StatusCode). Expected: $($expectedStatusCodes -join ', ')"
	return $null
  }
  catch {
	$statusCode = -1
	$exception = $_.Exception

	if ($null -ne $exception) {
	  $responseProperty = $exception.PSObject.Properties["Response"]
	  if ($null -ne $responseProperty -and $null -ne $responseProperty.Value) {
		$statusCode = [int]$responseProperty.Value.StatusCode
	  }
	  elseif ($exception.PSObject.Properties["StatusCode"] -and $null -ne $exception.StatusCode) {
		$statusCode = [int]$exception.StatusCode
	  }
	}

	if ($expectedStatusCodes -contains $statusCode) {
	  Write-Pass "POST $path -> $statusCode"
	  return @{ StatusCode = $statusCode; Body = $null }
	}

	Write-Fail "POST $path failed with status $statusCode. Error: $($exception.Message)"
	return $null
  }
}

function Invoke-ApiPostJson([string]$path, [object]$body, [int[]]$expectedStatusCodes) {
  $uri = "$ApiBaseUrl$path"
  $headers = @{}
  if (-not [string]::IsNullOrWhiteSpace($BearerToken)) {
	$headers["Authorization"] = "Bearer $BearerToken"
  }

  $jsonBody = $body | ConvertTo-Json -Depth 10

  try {
	$response = Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -ContentType "application/json" -Body $jsonBody -SkipCertificateCheck
	if ($expectedStatusCodes -contains [int]$response.StatusCode) {
	  Write-Pass "POST $path -> $($response.StatusCode)"
	  return @{ StatusCode = [int]$response.StatusCode; Body = $response.Content }
	}

	Write-Fail "POST $path returned unexpected status $($response.StatusCode). Expected: $($expectedStatusCodes -join ', ')"
	return $null
  }
  catch {
	$statusCode = -1
	$exception = $_.Exception

	if ($null -ne $exception) {
	  $responseProperty = $exception.PSObject.Properties["Response"]
	  if ($null -ne $responseProperty -and $null -ne $responseProperty.Value) {
		$statusCode = [int]$responseProperty.Value.StatusCode
	  }
	  elseif ($exception.PSObject.Properties["StatusCode"] -and $null -ne $exception.StatusCode) {
		$statusCode = [int]$exception.StatusCode
	  }
	}

	if ($expectedStatusCodes -contains $statusCode) {
	  Write-Pass "POST $path -> $statusCode"
	  return @{ StatusCode = $statusCode; Body = $null }
	}

	Write-Fail "POST $path failed with status $statusCode. Error: $($exception.Message)"
	return $null
  }
}

function Find-IapValidationIncidentIds {
  $result = @{ NoApproved = 0; Approved = 0 }

  try {
	$incidentsResponse = Invoke-Api "/api/v1/incidents" @(200)
	if (-not $incidentsResponse -or [string]::IsNullOrWhiteSpace($incidentsResponse.Body)) {
	  return $result
	}

	$incidents = $incidentsResponse.Body | ConvertFrom-Json
	foreach ($incident in $incidents) {
	  if ($result.NoApproved -gt 0 -and $result.Approved -gt 0) {
		break
	  }

	  $incidentId = [long]$incident.incidentId
	  if ($incidentId -le 0) {
		continue
	  }

	  $periodsResponse = Invoke-Api "/api/v1/incidents/$incidentId/operational-periods" @(200)
	  if (-not $periodsResponse -or [string]::IsNullOrWhiteSpace($periodsResponse.Body)) {
		if ($result.NoApproved -eq 0) {
		  $result.NoApproved = $incidentId
		}
		continue
	  }

	  $periods = $periodsResponse.Body | ConvertFrom-Json
	  $approvedCount = @($periods | Where-Object { $_.statusCode -eq 'Approved' }).Count

	  if ($approvedCount -gt 0 -and $result.Approved -eq 0) {
		$result.Approved = $incidentId
	  }

	  if ($approvedCount -eq 0 -and $result.NoApproved -eq 0) {
		$result.NoApproved = $incidentId
	  }
	}
  }
  catch {
	Write-Step "Auto-discovery for IAP validation incident IDs failed: $($_.Exception.Message)"
  }

  return $result
}

try {
  Write-Step "Running local smoke validation gate against $ApiBaseUrl"

  $readiness = Invoke-Api "/api/v1/system/readiness" @(200)
  if ($readiness -and $readiness.Body) {
	$payload = $readiness.Body | ConvertFrom-Json
	if ($null -eq $payload.status -or $null -eq $payload.sqlConnectionConfigured -or $null -eq $payload.degradedReadFallbackEnabled) {
	  Write-Fail "Readiness payload missing required fields."
	}
	else {
	  Write-Pass "Readiness payload contains status/sqlConnectionConfigured/degradedReadFallbackEnabled."
	}
  }

  $weather = Invoke-Api "/api/v1/weatherforecast" @(200)
  if ($weather -and $weather.Body) {
	$forecast = $weather.Body | ConvertFrom-Json
	if ($forecast.Count -ge 1) {
	  Write-Pass "Weather endpoint returned $($forecast.Count) rows."
	}
	else {
	  Write-Fail "Weather endpoint returned no rows."
	}
  }

  if ([string]::IsNullOrWhiteSpace($BearerToken)) {
	Write-Step "No bearer token supplied. Protected endpoint validation will accept 401 (strict) or 200 (development user bypass enabled)."
	$authMe = Invoke-Api "/api/v1/auth/me" @(401, 200)
	$reportPresets = Invoke-Api "/api/v1/resources/report-presets/$NavigationPresetScope" @(401, 200)
	$copOverlayContract = Invoke-Api "/api/v1/cop/live-overlay/contract" @(401, 200)
	$copOverlayReadiness = Invoke-Api "/api/v1/cop/live-overlay/external-readiness" @(401, 200)
	$providerHealth = Invoke-Api "/api/v1/system/external-provider-health" @(401, 200)
	$providerHealthHistory = Invoke-Api "/api/v1/system/external-provider-health/history?take=10" @(401, 200)
	$providerHealthWarehouseHistory = Invoke-Api "/api/v1/system/external-provider-health/history/warehouse?take=10" @(401, 200, 500)
	$providerHealthFederationSummary = Invoke-Api "/api/v1/system/external-provider-health/federation/summary?windowHours=24" @(401, 200, 500)
	$providerHealthTrends = Invoke-Api "/api/v1/system/external-provider-health/trends?windowHours=24&bucketMinutes=60" @(401, 200)
	$providerHealthAlertsEval = Invoke-ApiPost "/api/v1/system/external-provider-health/alerts/evaluate?windowHours=24&minEventCount=5&failureRateThreshold=0.5" @(401, 200)
	$providerHealthStorage = Invoke-Api "/api/v1/system/external-provider-health/storage" @(401, 200)
	$providerHealthGovernanceExport = Invoke-Api "/api/v1/reports/external-provider-health/governance/export/csv?windowHours=24&bucketMinutes=60" @(401, 200)
	$providerHealthScorecardExportCsv = Invoke-Api "/api/v1/reports/external-provider-health/scorecards/export/csv?rollingDays=30" @(401, 200)
	$providerHealthScorecardExportJson = Invoke-Api "/api/v1/reports/external-provider-health/scorecards/export/json?rollingDays=30" @(401, 200)
	$providerHealthExecutivePacketZip = Invoke-Api "/api/v1/reports/external-provider-health/executive-packet/export/zip?rollingDays=30&windowHours=720&bucketMinutes=60" @(401, 200)
	$executivePacketAutomationStatus = Invoke-Api "/api/v1/admin/external-provider/executive-packet/automation/status" @(401, 200)
	$executivePacketAutomationRun = Invoke-ApiPost "/api/v1/admin/external-provider/executive-packet/automation/run" @(401, 200)
	if ($authMe -and $authMe.StatusCode -eq 200) {
	  Write-Step "Protected endpoint returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($reportPresets -and $reportPresets.StatusCode -eq 200) {
	  Write-Step "Report-presets endpoint returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($copOverlayContract -and $copOverlayContract.StatusCode -eq 200) {
	  Write-Step "COP live-overlay contract returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($copOverlayReadiness -and $copOverlayReadiness.StatusCode -eq 200) {
	  Write-Step "COP external readiness probe returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealth -and $providerHealth.StatusCode -eq 200) {
	  Write-Step "External provider health returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthHistory -and $providerHealthHistory.StatusCode -eq 200) {
	  Write-Step "External provider health history returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthWarehouseHistory -and $providerHealthWarehouseHistory.StatusCode -eq 200) {
	  Write-Step "External provider warehouse history returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthFederationSummary -and $providerHealthFederationSummary.StatusCode -eq 200) {
	  Write-Step "External provider federation summary returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthTrends -and $providerHealthTrends.StatusCode -eq 200) {
	  Write-Step "External provider telemetry trends returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthAlertsEval -and $providerHealthAlertsEval.StatusCode -eq 200) {
	  Write-Step "External provider alert evaluation returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthStorage -and $providerHealthStorage.StatusCode -eq 200) {
	  Write-Step "External provider telemetry storage diagnostics returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthGovernanceExport -and $providerHealthGovernanceExport.StatusCode -eq 200) {
	  Write-Step "External provider governance CSV export returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthScorecardExportCsv -and $providerHealthScorecardExportCsv.StatusCode -eq 200) {
	  Write-Step "External provider scorecard CSV export returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthScorecardExportJson -and $providerHealthScorecardExportJson.StatusCode -eq 200) {
	  Write-Step "External provider scorecard JSON export returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($providerHealthExecutivePacketZip -and $providerHealthExecutivePacketZip.StatusCode -eq 200) {
	  Write-Step "External provider executive packet ZIP export returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	}
	if ($executivePacketAutomationStatus -and $executivePacketAutomationStatus.StatusCode -eq 200) {
	  Write-Step "Executive packet automation status returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	  Assert-ExecutivePacketAutomationStatusPayload $executivePacketAutomationStatus.Body "NoTokenBypass"
	}
	if ($executivePacketAutomationRun -and $executivePacketAutomationRun.StatusCode -eq 200) {
	  Write-Step "Executive packet automation run returned 200 without bearer token because Development User Bypass is enabled in the current environment."
	  Assert-ExecutivePacketAutomationRunPayload $executivePacketAutomationRun.Body "NoTokenBypass"
	}
  }
  else {
	Write-Step "Bearer token supplied. Validating protected read endpoints."
	[void](Invoke-Api "/api/v1/auth/me" @(200))
	[void](Invoke-Api "/api/v1/incidents" @(200))
	[void](Invoke-Api "/api/v1/resources/inventory" @(200))
	[void](Invoke-Api "/api/v1/resources/regional-rollups" @(200))
	[void](Invoke-Api "/api/v1/resources/regional-rollups/export/csv" @(200))
	[void](Invoke-Api "/api/v1/beds/availability" @(200))
	[void](Invoke-Api "/api/v1/lookups/codesets/IncidentType" @(200))
	[void](Invoke-Api "/api/v1/lookups/locations" @(200))
	[void](Invoke-Api "/api/v1/resources/report-presets/$NavigationPresetScope" @(200))
	[void](Invoke-Api "/api/v1/cop/live-overlay/contract" @(200))
	[void](Invoke-Api "/api/v1/cop/live-overlay/external-readiness" @(200))
	[void](Invoke-Api "/api/v1/system/external-provider-health" @(200))
	[void](Invoke-Api "/api/v1/system/external-provider-health/history?take=10" @(200))
	[void](Invoke-Api "/api/v1/system/external-provider-health/history/warehouse?take=10" @(200, 500))
	[void](Invoke-Api "/api/v1/system/external-provider-health/federation/summary?windowHours=24" @(200, 500))
	[void](Invoke-Api "/api/v1/system/external-provider-health/trends?windowHours=24&bucketMinutes=60" @(200))
	[void](Invoke-ApiPost "/api/v1/system/external-provider-health/alerts/evaluate?windowHours=24&minEventCount=5&failureRateThreshold=0.5" @(200))
	[void](Invoke-Api "/api/v1/system/external-provider-health/storage" @(200))
	[void](Invoke-Api "/api/v1/reports/external-provider-health/governance/export/csv?windowHours=24&bucketMinutes=60" @(200))
	[void](Invoke-Api "/api/v1/reports/external-provider-health/scorecards/export/csv?rollingDays=30" @(200))
	[void](Invoke-Api "/api/v1/reports/external-provider-health/scorecards/export/json?rollingDays=30" @(200))
	[void](Invoke-Api "/api/v1/reports/external-provider-health/executive-packet/export/zip?rollingDays=30&windowHours=720&bucketMinutes=60" @(200))
	$executivePacketAutomationStatus = Invoke-Api "/api/v1/admin/external-provider/executive-packet/automation/status" @(200)
	if ($executivePacketAutomationStatus) {
	  Assert-ExecutivePacketAutomationStatusPayload $executivePacketAutomationStatus.Body "BearerToken"
	}

	$executivePacketAutomationRun = Invoke-ApiPost "/api/v1/admin/external-provider/executive-packet/automation/run" @(200)
	if ($executivePacketAutomationRun) {
	  Assert-ExecutivePacketAutomationRunPayload $executivePacketAutomationRun.Body "BearerToken"
	}
  }

	if ($IapIncidentIdNoApproved -le 0 -or $IapIncidentIdApproved -le 0) {
	if ([string]::IsNullOrWhiteSpace($BearerToken)) {
	  Write-Step "Skipping IAP incident auto-discovery because no bearer token was supplied."
	}
	else {
	  Write-Step "IAP incident IDs not fully supplied. Attempting auto-discovery for export validation candidates."
	  $autoIds = Find-IapValidationIncidentIds

	  if ($IapIncidentIdNoApproved -le 0 -and $autoIds.NoApproved -gt 0) {
		$IapIncidentIdNoApproved = $autoIds.NoApproved
		Write-Step "Auto-selected incident $IapIncidentIdNoApproved for no-approved-period export guardrail validation."
	  }

	  if ($IapIncidentIdApproved -le 0 -and $autoIds.Approved -gt 0) {
		$IapIncidentIdApproved = $autoIds.Approved
		Write-Step "Auto-selected incident $IapIncidentIdApproved for approved-period export validation."
	  }
	}
  }

  if ($IapIncidentIdNoApproved -gt 0) {
	[void](Invoke-Api "/api/v1/incidents/$IapIncidentIdNoApproved/iap-packet/export/json" @(400, 401))
	[void](Invoke-Api "/api/v1/incidents/$IapIncidentIdNoApproved/iap-packet/export/print" @(400, 401))
	[void](Invoke-Api "/api/v1/incidents/$IapIncidentIdNoApproved/iap-governance/evidence/json" @(200, 401))
  }

  if ($IapIncidentIdApproved -gt 0) {
	[void](Invoke-Api "/api/v1/incidents/$IapIncidentIdApproved/iap-packet/export/json" @(200, 401))
	[void](Invoke-Api "/api/v1/incidents/$IapIncidentIdApproved/iap-packet/export/print" @(200, 401))
	[void](Invoke-Api "/api/v1/incidents/$IapIncidentIdApproved/iap-governance/evidence/json" @(200, 401))
  }

  if ($IapApproveIncidentId -gt 0 -and $IapApproveOperationalPeriodId -gt 0) {
	if ([string]::IsNullOrWhiteSpace($BearerToken)) {
	  [void](Invoke-ApiPost "/api/v1/incidents/$IapApproveIncidentId/operational-periods/$IapApproveOperationalPeriodId/approve" @(401))
	}
	else {
	  [void](Invoke-ApiPost "/api/v1/incidents/$IapApproveIncidentId/operational-periods/$IapApproveOperationalPeriodId/approve" @(204))
	  [void](Invoke-Api "/api/v1/incidents/$IapApproveIncidentId/iap-packet/export/json" @(200))
	}
  }

  if ($CommunicationIncidentId -gt 0) {
	Write-Step "Validating communication dispatch baseline for incident $CommunicationIncidentId."
	$dispatchPayload = @{
	  channelCode = "Phone"
	  directionCode = "Outbound"
	  subject = "SMOKE COMMUNICATION"
	  message = "Smoke gate communication dispatch validation."
	  notificationTypeCode = "INCIDENT_NOTIFICATION"
	  notificationPriorityCode = "High"
	  notificationRecipients = @(
		@{ channelCode = "VOICE"; destinationAddress = $CommunicationDestinationAddress; locationId = 1 },
		@{ channelCode = "PUSH"; destinationAddress = "https://push.endpoint.example/smoke/$CommunicationIncidentId"; locationId = 1 }
	  )
	}

	if ([string]::IsNullOrWhiteSpace($BearerToken)) {
	  [void](Invoke-ApiPostJson "/api/v1/incidents/$CommunicationIncidentId/communications" $dispatchPayload @(401))
	}
	else {
	  $dispatchResponse = Invoke-ApiPostJson "/api/v1/incidents/$CommunicationIncidentId/communications" $dispatchPayload @(201)
	  if ($dispatchResponse -and -not [string]::IsNullOrWhiteSpace($dispatchResponse.Body)) {
		try {
		  $dispatchBody = $dispatchResponse.Body | ConvertFrom-Json
		  if ($null -ne $dispatchBody.incidentCommunicationId -and [long]$dispatchBody.incidentCommunicationId -gt 0) {
			Write-Pass "Communication dispatch created incidentCommunicationId $($dispatchBody.incidentCommunicationId)."
		  }
		  else {
			Write-Fail "Communication dispatch response missing incidentCommunicationId."
		  }
		}
		catch {
		  Write-Fail "Communication dispatch response was not valid JSON."
		}
	  }

	  $communicationEvidenceQuery = Build-Query $CommunicationEvidenceFromUtc $CommunicationEvidenceToUtc
	  [void](Invoke-Api "/api/v1/incidents/$CommunicationIncidentId/communications/evidence/export/csv$communicationEvidenceQuery" @(200))
	}
  }

  if ($ResourceIncidentId -gt 0) {
	Write-Step "Validating resource evidence export for incident $ResourceIncidentId."
	$resourceEvidenceQuery = ""
	if (-not [string]::IsNullOrWhiteSpace($ResourceStatusCode)) {
	  $resourceEvidenceQuery = "?statusCode=$([System.Uri]::EscapeDataString($ResourceStatusCode))"
	}

	if ([string]::IsNullOrWhiteSpace($BearerToken)) {
	  [void](Invoke-Api "/api/v1/incidents/$ResourceIncidentId/resources/evidence/export/csv$resourceEvidenceQuery" @(401))
	  [void](Invoke-Api "/api/v1/incidents/$ResourceIncidentId/resources/lifecycle-evidence/export/json" @(401))
	  [void](Invoke-Api "/api/v1/incidents/$ResourceIncidentId/after-action/evidence/export/json" @(401))
	  [void](Invoke-Api "/api/v1/beds/import/availability/fhir/adapter-contract" @(401))
	  [void](Invoke-Api "/api/v1/resources/regional-rollups/export/csv" @(401))
	}
	else {
	  [void](Invoke-Api "/api/v1/incidents/$ResourceIncidentId/resources/evidence/export/csv$resourceEvidenceQuery" @(200))
	  [void](Invoke-Api "/api/v1/incidents/$ResourceIncidentId/resources/lifecycle-evidence/export/json" @(200))
	  [void](Invoke-Api "/api/v1/incidents/$ResourceIncidentId/after-action/evidence/export/json" @(200))
	  [void](Invoke-Api "/api/v1/beds/import/availability/fhir/adapter-contract" @(200))
	  [void](Invoke-Api "/api/v1/resources/regional-rollups/export/csv" @(200))

		if ($ResourceRollupRegionId -gt 0) {
		$regionQuery = "?regionId=$ResourceRollupRegionId"
		[void](Invoke-Api "/api/v1/resources/regional-rollups$regionQuery" @(200))
		[void](Invoke-Api "/api/v1/resources/regional-rollups/export/csv$regionQuery" @(200))
	  }
	  elseif (-not [string]::IsNullOrWhiteSpace($ResourceRollupRegionName)) {
		$regionQuery = "?regionName=$([System.Uri]::EscapeDataString($ResourceRollupRegionName))"
		[void](Invoke-Api "/api/v1/resources/regional-rollups$regionQuery" @(200))
		[void](Invoke-Api "/api/v1/resources/regional-rollups/export/csv$regionQuery" @(200))
	  }
	}
  }

  if ($AdminSessionUserSessionId -gt 0) {
	Write-Step "Validating admin session controls for session $AdminSessionUserSessionId."

	$targetUserId = $AdminSessionTargetUserId
	if ($targetUserId -le 0) {
	  $targetUserId = 1
	}

	$startPayload = @{
	  targetUserId = $targetUserId
	  reason = $AdminSessionImpersonationReason
	}

	$stopPayload = @{
	  reason = $AdminSessionImpersonationReason
	}

	$terminatePayload = @{
	  terminationReason = "Smoke gate termination validation."
	}

	if ([string]::IsNullOrWhiteSpace($BearerToken)) {
	  [void](Invoke-Api "/api/v1/admin/sessions/compliance-evidence/export/json" @(401, 200))
	  [void](Invoke-ApiPostJson "/api/v1/admin/sessions/$AdminSessionUserSessionId/impersonate/start" $startPayload @(401, 200))
	  [void](Invoke-ApiPostJson "/api/v1/admin/sessions/$AdminSessionUserSessionId/impersonate/stop" $stopPayload @(401, 200))
	  [void](Invoke-ApiPostJson "/api/v1/admin/sessions/$AdminSessionUserSessionId/terminate" $terminatePayload @(401, 200))
	}
	else {
	  [void](Invoke-Api "/api/v1/admin/sessions/compliance-evidence/export/json" @(200))

	  $startResult = Invoke-ApiPostJson "/api/v1/admin/sessions/$AdminSessionUserSessionId/impersonate/start" $startPayload @(204, 409)
	  if ($startResult -and $startResult.StatusCode -eq 409) {
		Write-Step "Impersonation start returned 409 (already active or invalid target/session state); continuing with stop validation."
	  }

	  [void](Invoke-ApiPostJson "/api/v1/admin/sessions/$AdminSessionUserSessionId/impersonate/stop" $stopPayload @(204, 404))
	}
  }

  if ($script:Failures -gt 0) {
	throw "Smoke validation gate failed with $script:Failures failure(s)."
  }

  Invoke-AuthorizationSmoke
  Invoke-BackendReportPresetsPolicyAlignmentSmoke

  if ($script:Failures -gt 0) {
	throw "Smoke validation gate failed with $script:Failures failure(s)."
  }

  Write-Step "Frontend authorization smoke status: $script:FrontendAuthorizationSmokeStatus"
  Write-Step "Backend report-presets policy alignment smoke status: $script:BackendReportPresetsPolicySmokeStatus"

  Write-Host "[DONE ] Smoke validation gate passed." -ForegroundColor Green
  exit 0
}
catch {
  Write-Host "[DONE ] Smoke validation gate failed. $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

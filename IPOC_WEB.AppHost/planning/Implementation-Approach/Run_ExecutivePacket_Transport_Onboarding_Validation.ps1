<#
.SYNOPSIS
Validates executive packet transport onboarding scenarios and captures evidence.

.DESCRIPTION
Runs targeted validation for transport onboarding using the executive packet automation admin endpoints:
- DirectoryCopy: expects manual run success and verifies destination artifact presence.
- WebhookSuccess: expects manual run success with webhook transport metadata.
- WebhookFailure: expects manual run failure (HTTP 500) for forced retry/failure-path evidence.

Prerequisites:
- API is running.
- Transport mode/destination is configured in server settings for the selected scenario.
- Valid bearer token with admin authorization is provided.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "https://localhost:7435",
  [Parameter(Mandatory = $true)]
  [string]$BearerToken,
  [ValidateSet("DirectoryCopy", "WebhookSuccess", "WebhookFailure")]
  [string]$ValidationMode = "DirectoryCopy",
  [string]$ExpectedDistributionDirectory = "",
  [string]$EvidenceOutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$message) { Write-Host "[TRANSPORT-VALIDATION] $message" -ForegroundColor Cyan }
function Write-Pass([string]$message) { Write-Host "[PASS ] $message" -ForegroundColor Green }
function Write-Fail([string]$message) { Write-Host "[FAIL ] $message" -ForegroundColor Red; throw $message }

function Has-JsonProperty([object]$jsonObject, [string]$propertyName) {
  return $null -ne $jsonObject -and $null -ne $jsonObject.PSObject.Properties[$propertyName]
}

function Invoke-Api([string]$path, [string]$method, [int[]]$expectedStatusCodes) {
  $uri = "$ApiBaseUrl$path"
  $headers = @{ Authorization = "Bearer $BearerToken" }

  try {
	$response = Invoke-WebRequest -Uri $uri -Method $method -Headers $headers -SkipCertificateCheck
	if ($expectedStatusCodes -contains [int]$response.StatusCode) {
	  return @{ StatusCode = [int]$response.StatusCode; Body = $response.Content }
	}

	Write-Fail "$method $path returned unexpected status $($response.StatusCode). Expected: $($expectedStatusCodes -join ', ')."
	return $null
  }
  catch {
	$statusCode = -1
	$exception = $_.Exception
	if ($null -ne $exception -and $exception.PSObject.Properties["Response"] -and $null -ne $exception.Response) {
	  $statusCode = [int]$exception.Response.StatusCode
	  $reader = New-Object System.IO.StreamReader($exception.Response.GetResponseStream())
	  $body = $reader.ReadToEnd()
	  if ($expectedStatusCodes -contains $statusCode) {
		return @{ StatusCode = $statusCode; Body = $body }
	  }
	}

	Write-Fail "$method $path failed with status $statusCode. Error: $($exception.Message)"
	return $null
  }
}

function Assert-RunPayloadFields([object]$payload) {
  $required = @(
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

  $missing = @($required | Where-Object { -not (Has-JsonProperty $payload $_) })
  if ($missing.Count -gt 0) {
	Write-Fail "Run payload missing fields: $($missing -join ', ')."
  }

  Write-Pass "Run payload includes required transport evidence fields."
}

try {
  Write-Step "Checking automation status endpoint."
  $statusResponse = Invoke-Api "/api/v1/admin/external-provider/executive-packet/automation/status" "GET" @(200)
  $statusPayload = $statusResponse.Body | ConvertFrom-Json

  $statusRequired = @("lastTransportMode", "lastTransportDestination", "lastTransportArtifactId", "lastTransportAttempts", "lastTransportSucceeded")
  $statusMissing = @($statusRequired | Where-Object { -not (Has-JsonProperty $statusPayload $_) })
  if ($statusMissing.Count -gt 0) {
	Write-Fail "Status payload missing transport fields: $($statusMissing -join ', ')."
  }

  Write-Pass "Status payload includes required transport fields."

  $expectedRunStatus = if ($ValidationMode -eq "WebhookFailure") { @(500) } else { @(200) }
  Write-Step "Executing manual run for mode $ValidationMode."
  $runResponse = Invoke-Api "/api/v1/admin/external-provider/executive-packet/automation/run" "POST" $expectedRunStatus

  $runPayload = $null
  if ($runResponse.Body) {
	try {
	  $runPayload = $runResponse.Body | ConvertFrom-Json
	}
	catch {
	  if ($ValidationMode -eq "WebhookFailure") {
		Write-Step "Failure-mode response was ProblemDetails text/json; payload field assertions skipped as expected for HTTP 500."
	  }
	  else {
		Write-Fail "Run response payload was not valid JSON."
	  }
	}
  }

  if ($ValidationMode -ne "WebhookFailure") {
	if ($null -eq $runPayload) {
	  Write-Fail "Run payload missing for success-mode validation."
	}

	Assert-RunPayloadFields $runPayload

	if (-not [bool]$runPayload.succeeded) {
	  Write-Fail "Run payload indicates failure in success-mode validation."
	}

	if ($ValidationMode -eq "DirectoryCopy") {
	  $destination = [string]$runPayload.transportDestination
	  if ([string]::IsNullOrWhiteSpace($destination)) {
		Write-Fail "DirectoryCopy validation expected transportDestination to be populated."
	  }

	  $verificationPath = $destination
	  if (-not [string]::IsNullOrWhiteSpace($ExpectedDistributionDirectory)) {
		$artifactId = [string]$runPayload.transportArtifactId
		$verificationPath = Join-Path $ExpectedDistributionDirectory $artifactId
	  }

	  if (-not (Test-Path $verificationPath)) {
		Write-Fail "DirectoryCopy destination artifact was not found at: $verificationPath"
	  }

	  Write-Pass "DirectoryCopy artifact verified at: $verificationPath"
	}

	if ($ValidationMode -eq "WebhookSuccess") {
	  if (-not [bool]$runPayload.transportSucceeded) {
		Write-Fail "WebhookSuccess validation expected transportSucceeded=true."
	  }

	  Write-Pass "Webhook success path validated."
	}
  }
  else {
	Write-Pass "Webhook failure path validated with expected HTTP 500 response."
  }

  if ([string]::IsNullOrWhiteSpace($EvidenceOutputDirectory)) {
	$EvidenceOutputDirectory = Join-Path $PSScriptRoot "evidence"
  }

  if (-not (Test-Path $EvidenceOutputDirectory)) {
	New-Item -Path $EvidenceOutputDirectory -ItemType Directory | Out-Null
  }

  $artifactName = "executive-packet-transport-onboarding-{0}-{1:yyyyMMdd-HHmmss}.json" -f $ValidationMode.ToLowerInvariant(), (Get-Date)
  $artifactPath = Join-Path $EvidenceOutputDirectory $artifactName

  $evidence = [ordered]@{
	validatedUtc = (Get-Date).ToUniversalTime().ToString("O")
	apiBaseUrl = $ApiBaseUrl
	validationMode = $ValidationMode
	statusEndpoint = [ordered]@{
	  statusCode = $statusResponse.StatusCode
	  payload = $statusPayload
	}
	runEndpoint = [ordered]@{
	  statusCode = $runResponse.StatusCode
	  payload = $runPayload
	  rawBody = $runResponse.Body
	}
  }

  $evidence | ConvertTo-Json -Depth 20 | Set-Content -Path $artifactPath -Encoding UTF8
  Write-Pass "Transport onboarding validation completed."
  Write-Step "Evidence artifact: $artifactPath"
  exit 0
}
catch {
  Write-Host "[DONE ] Transport onboarding validation failed. $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

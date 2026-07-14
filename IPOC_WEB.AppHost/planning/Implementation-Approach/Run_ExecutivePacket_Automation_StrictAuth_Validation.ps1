<#
.SYNOPSIS
Validates executive packet automation admin endpoints under strict-auth with bearer token.

.DESCRIPTION
- Validates status endpoint returns 200 and contains required transport evidence fields.
- Validates manual run endpoint returns 200 and contains required transport evidence fields.
- Writes JSON evidence artifact with response payloads and validation metadata.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "https://localhost:7435",
  [string]$BearerToken = "",
  [string]$Audience = "api://7a7111a7-26d8-424c-bcc5-7ae31dae3f1f",
  [switch]$SkipRunEndpoint
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$message) {
  Write-Host "[STRICT-AUTH] $message" -ForegroundColor Cyan
}

function Write-Pass([string]$message) {
  Write-Host "[PASS ] $message" -ForegroundColor Green
}

function Write-Fail([string]$message) {
  Write-Host "[FAIL ] $message" -ForegroundColor Red
  throw $message
}

function Has-JsonProperty([object]$jsonObject, [string]$propertyName) {
  return $null -ne $jsonObject -and $null -ne $jsonObject.PSObject.Properties[$propertyName]
}

function Invoke-Api([string]$path, [string]$method) {
  $uri = "$ApiBaseUrl$path"
  $headers = @{ Authorization = "Bearer $BearerToken" }

  try {
	return Invoke-WebRequest -Uri $uri -Method $method -Headers $headers -SkipCertificateCheck
  }
  catch {
	$statusCode = -1
	$exception = $_.Exception
	if ($null -ne $exception -and $exception.PSObject.Properties["Response"] -and $null -ne $exception.Response) {
	  $statusCode = [int]$exception.Response.StatusCode
	}

	Write-Fail "$method $path failed with status $statusCode. Error: $($exception.Message)"
	return $null
  }
}

function Assert-Fields([object]$payload, [string[]]$requiredFields, [string]$context) {
  $missing = @($requiredFields | Where-Object { -not (Has-JsonProperty $payload $_) })
  if ($missing.Count -gt 0) {
	Write-Fail "$context payload missing required fields: $($missing -join ', ')"
  }

  Write-Pass "$context payload contains required fields."
}

try {
  if ([string]::IsNullOrWhiteSpace($BearerToken)) {
	Write-Step "Bearer token not provided. Attempting Azure CLI token acquisition for audience: $Audience"
	$BearerToken = az account get-access-token --resource $Audience --query accessToken -o tsv
  }

  if ([string]::IsNullOrWhiteSpace($BearerToken)) {
	Write-Fail "Bearer token is required. Provide -BearerToken or configure Azure CLI token acquisition for this API audience."
  }

  Write-Step "Validating status endpoint."
  $statusResponse = Invoke-Api "/api/v1/admin/external-provider/executive-packet/automation/status" "Get"
  if ([int]$statusResponse.StatusCode -ne 200) {
	Write-Fail "Status endpoint returned $($statusResponse.StatusCode), expected 200."
  }

  $statusPayload = $statusResponse.Content | ConvertFrom-Json
  Assert-Fields $statusPayload @(
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
  ) "Status"

  $runResponse = $null
  $runPayload = $null

  if (-not $SkipRunEndpoint) {
	Write-Step "Validating manual run endpoint."
	$runResponse = Invoke-Api "/api/v1/admin/external-provider/executive-packet/automation/run" "Post"
	if ([int]$runResponse.StatusCode -ne 200) {
	  Write-Fail "Manual run endpoint returned $($runResponse.StatusCode), expected 200."
	}

	$runPayload = $runResponse.Content | ConvertFrom-Json
	Assert-Fields $runPayload @(
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
	) "Run"
  }

  $artifactDirectory = Join-Path $PSScriptRoot "evidence"
  if (-not (Test-Path $artifactDirectory)) {
	New-Item -Path $artifactDirectory -ItemType Directory | Out-Null
  }

  $artifactName = "executive-packet-strict-auth-validation-{0:yyyyMMdd-HHmmss}.json" -f (Get-Date)
  $artifactPath = Join-Path $artifactDirectory $artifactName

  $evidence = [ordered]@{
	validatedUtc = (Get-Date).ToUniversalTime().ToString("O")
	apiBaseUrl = $ApiBaseUrl
	audience = $Audience
	status = [ordered]@{
	  statusCode = [int]$statusResponse.StatusCode
	  payload = $statusPayload
	}
	run = if ($null -eq $runResponse) {
	  [ordered]@{
		skipped = $true
	  }
	}
	else {
	  [ordered]@{
		skipped = $false
		statusCode = [int]$runResponse.StatusCode
		payload = $runPayload
	  }
	}
  }

  $evidence | ConvertTo-Json -Depth 12 | Set-Content -Path $artifactPath -Encoding UTF8

  Write-Pass "Strict-auth executive packet automation validation passed."
  Write-Step "Evidence artifact: $artifactPath"
  exit 0
}
catch {
  Write-Host "[DONE ] Strict-auth validation failed. $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

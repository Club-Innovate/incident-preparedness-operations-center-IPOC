param(
	[Parameter(Mandatory = $false)]
	[string]$ProgramPath = "IPOC_WEB.Server/Program.cs",

	[Parameter(Mandatory = $false)]
	[string]$OutputPath = "security-compliance/controls/tls-posture-verification.md"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ProgramPath)) {
	Write-Error "Program file not found: $ProgramPath"
}

$programText = Get-Content -LiteralPath $ProgramPath -Raw

$checks = @(
	[pscustomobject]@{ Name = "HSTS service registration"; Pattern = "builder\.Services\.AddHsts\(" },
	[pscustomobject]@{ Name = "HSTS max age configured to 365 days"; Pattern = "options\.MaxAge\s*=\s*TimeSpan\.FromDays\(365\)" },
	[pscustomobject]@{ Name = "HSTS include subdomains enabled"; Pattern = "options\.IncludeSubDomains\s*=\s*true" },
	[pscustomobject]@{ Name = "HSTS preload enabled"; Pattern = "options\.Preload\s*=\s*true" },
	[pscustomobject]@{ Name = "Production HSTS middleware enabled"; Pattern = "app\.UseHsts\(\);" },
	[pscustomobject]@{ Name = "HTTPS redirection middleware enabled"; Pattern = "app\.UseHttpsRedirection\(\);" }
)

$results = foreach ($check in $checks) {
	$isPresent = [regex]::IsMatch($programText, $check.Pattern)
	[pscustomobject]@{
		Check = $check.Name
		Passed = $isPresent
	}
}

$failed = $results | Where-Object { -not $_.Passed }
$timestampUtc = [DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")

$outputDir = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
	New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$lines = @(
	"# TLS Posture Verification",
	"",
	"Generated: $timestampUtc",
	"",
	"## Verification Results",
	""
)

foreach ($result in $results) {
	$status = if ($result.Passed) { "PASS" } else { "FAIL" }
	$lines += "- **$($result.Check):** $status"
}

$lines += ""
$lines += "## Evidence References"
$lines += ""
$lines += "- Source configuration: $ProgramPath"
$lines += "- Security/compliance workflow: .github/workflows/security-compliance-gates.yml"
$lines += "- Monthly baseline packaging: .github/workflows/compliance-baseline-package.yml"

if ($failed.Count -gt 0) {
	$failedList = ($failed | ForEach-Object { $_.Check }) -join "; "
	$lines += ""
	$lines += "## Result"
	$lines += ""
	$lines += "TLS posture verification failed. Missing or non-compliant controls: $failedList"
	Set-Content -LiteralPath $OutputPath -Value $lines -Encoding UTF8
	Write-Error "TLS posture verification failed: $failedList"
}

$lines += ""
$lines += "## Result"
$lines += ""
$lines += "TLS posture verification passed."

Set-Content -LiteralPath $OutputPath -Value $lines -Encoding UTF8
Write-Host "[compliance] TLS posture verification passed. Evidence written to $OutputPath"
exit 0

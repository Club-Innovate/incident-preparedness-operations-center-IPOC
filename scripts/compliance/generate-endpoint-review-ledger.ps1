param(
	[Parameter(Mandatory = $false)]
	[string]$MatrixPath = "audit/tmp/_tmp_endpoint_matrix_generated.md",

	[Parameter(Mandatory = $false)]
	[string]$OutputPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[int]$MaxRows = 250
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $MatrixPath)) {
	throw "Matrix file not found: $MatrixPath"
}

$lines = Get-Content -LiteralPath $MatrixPath

function Get-RiskScore {
	param(
		[string]$Endpoint,
		[string]$Method,
		[string]$PolicyBaseline,
		[string]$Status
	)

	$score = 0
	$e = $Endpoint.ToLowerInvariant()
	$m = $Method.ToUpperInvariant()
	$p = $PolicyBaseline.ToLowerInvariant()
	$s = $Status.ToLowerInvariant()

	if ($e.Contains('/admin/')) { $score += 4 }
	if ($e.Contains('/export/')) { $score += 4 }
	if ($m -in @('POST', 'PUT', 'DELETE', 'PATCH')) { $score += 3 }
	if ($e.Contains('/import/')) { $score += 3 }
	if ($e.Contains('/auth/')) { $score += 2 }
	if ($e.Contains('token-debug')) { $score += 2 }
	if ($e.Contains('/personalization')) { $score += 2 }
	if ($e.Contains('/streaming')) { $score += 2 }
	if ($p.Contains('endpoint-specific review required')) { $score += 1 }
	if ($p.Contains('requireauthorization()')) { $score += 1 }
	if ($s.Contains('pending')) { $score += 1 }

	return $score
}

function Get-RiskTier {
	param([int]$Score)

	if ($Score -ge 8) { return 'High' }
	if ($Score -ge 5) { return 'Medium' }
	return 'Low'
}

function Get-DataClasses {
	param([string]$Endpoint)

	$e = $Endpoint.ToLowerInvariant()

	if ($e.Contains('/auth/') -or $e.Contains('/sessions') -or $e.Contains('/users')) {
		return 'Sensitive'
	}

	if ($e.Contains('/import/') -or $e.Contains('/beds/')) {
		return 'Operational|Potential-PHI'
	}

	if ($e.Contains('/reports/') -or $e.Contains('/audit-events')) {
		return 'Sensitive'
	}

	if ($e.Contains('/incidents/')) {
		return 'Sensitive|Operational'
	}

	return 'Operational'
}

$rows = New-Object System.Collections.Generic.List[object]

foreach ($line in $lines) {
	$trim = $line.Trim()

	if (-not $trim.StartsWith('| /api/')) {
		continue
	}

	$parts = $trim.Split('|') | ForEach-Object { $_.Trim() }
	if ($parts.Count -lt 9) {
		continue
	}

	$endpoint = $parts[1]
	$method = $parts[2]
	$policyBaseline = $parts[3]
	$audited = $parts[4]
	$redaction = $parts[6]
	$status = $parts[7]
	$notes = $parts[8]

	$score = Get-RiskScore -Endpoint $endpoint -Method $method -PolicyBaseline $policyBaseline -Status $status
	$tier = Get-RiskTier -Score $score

	$decision = if ($tier -eq 'High') { 'Requires Changes' } elseif ($tier -eq 'Medium') { 'In Review' } else { 'Pending' }

	$auditCoverageVerified = if ($audited -match '^(?i)yes$') { 'Yes' } elseif ($audited -match '^(?i)tbd$') { 'Partial' } else { 'Partial' }
	$redactionVerified = if ($redaction -match '^(?i)yes$') { 'Yes' } elseif ($redaction -match '^(?i)tbd$') { 'Partial' } else { 'Partial' }

	$rows.Add([PSCustomObject]@{
		Endpoint = $endpoint
		Method = $method
		DataClasses = (Get-DataClasses -Endpoint $endpoint)
		AuthorizationPolicy = $policyBaseline
		IncludedSensitiveFields = '<to-validate>'
		ExcludedSensitiveFields = '<to-validate>'
		RedactionVerified = $redactionVerified
		AuditCoverageVerified = $auditCoverageVerified
		Reviewer = 'Auto-Prioritized'
		ReviewDateUtc = (Get-Date).ToString('yyyy-MM-dd')
		Decision = $decision
		EvidenceRef = '<EV-ID>'
		Notes = "RiskTier=$tier; RiskScore=$score; MatrixStatus=$status; $notes"
	})
}

$final = $rows |
	Sort-Object @{ Expression = { [int]([regex]::Match($_.Notes, 'RiskScore=(\d+)').Groups[1].Value) }; Descending = $true }, Endpoint |
	Select-Object -First $MaxRows

$targetDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $targetDir)) {
	New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$final | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding UTF8

Write-Host "Generated endpoint review ledger: $OutputPath"
Write-Host "Rows: $($final.Count)"

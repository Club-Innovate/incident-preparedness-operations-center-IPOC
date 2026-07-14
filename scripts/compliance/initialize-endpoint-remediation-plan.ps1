param(
	[Parameter(Mandatory = $false)]
	[string]$InputPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$OutputPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$KpiOutputPath = "security-compliance/controls/endpoint-remediation-kpi.md"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputPath)) {
	throw "Endpoint review ledger not found: $InputPath"
}

$today = Get-Date
$rows = Import-Csv -LiteralPath $InputPath

function Get-Owner([string]$endpoint) {
	$e = $endpoint.ToLowerInvariant()
	if ($e.Contains('/admin/') -or $e.Contains('/auth/')) { return 'Security Engineering' }
	if ($e.Contains('/reports/') -or $e.Contains('/audit-events')) { return 'Compliance Engineering' }
	if ($e.Contains('/beds/') -or $e.Contains('/resources/') -or $e.Contains('/streaming')) { return 'Platform Engineering' }
	if ($e.Contains('/agent/')) { return 'Application Engineering' }
	return 'Application Engineering'
}

function Get-RiskScore([string]$notes, [string]$decision) {
	$m = [regex]::Match($notes ?? '', 'RiskScore=(\d+)')
	if ($m.Success) { return [int]$m.Groups[1].Value }
	switch ($decision) {
		'Requires Changes' { return 8 }
		'In Review' { return 6 }
		default { return 4 }
	}
}

function Get-RiskTier([int]$score) {
	if ($score -ge 8) { return 'High' }
	if ($score -ge 5) { return 'Medium' }
	return 'Low'
}

function Get-DueDate([string]$decision, [datetime]$baseDate) {
	switch ($decision) {
		'Requires Changes' { return $baseDate.AddDays(7).ToString('yyyy-MM-dd') }
		'In Review' { return $baseDate.AddDays(14).ToString('yyyy-MM-dd') }
		default { return $baseDate.AddDays(21).ToString('yyyy-MM-dd') }
	}
}

$enriched = foreach ($row in $rows) {
	$score = Get-RiskScore -notes $row.Notes -decision $row.Decision
	$tier = Get-RiskTier -score $score
	$owner = Get-Owner -endpoint $row.Endpoint
	$dueDate = Get-DueDate -decision $row.Decision -baseDate $today
	$status = if ($row.Decision -eq 'Requires Changes') { 'Open-Remediation' } elseif ($row.Decision -eq 'In Review') { 'Open-Review' } else { 'Open-Queued' }

	[PSCustomObject]@{
		Endpoint = $row.Endpoint
		Method = $row.Method
		DataClasses = $row.DataClasses
		AuthorizationPolicy = $row.AuthorizationPolicy
		IncludedSensitiveFields = $row.IncludedSensitiveFields
		ExcludedSensitiveFields = $row.ExcludedSensitiveFields
		RedactionVerified = $row.RedactionVerified
		AuditCoverageVerified = $row.AuditCoverageVerified
		Reviewer = $row.Reviewer
		ReviewDateUtc = $row.ReviewDateUtc
		Decision = $row.Decision
		RiskTier = $tier
		RiskScore = $score
		Owner = $owner
		DueDateUtc = $dueDate
		RemediationStatus = $status
		EvidenceRef = $row.EvidenceRef
		Notes = $row.Notes
	}
}

$sorted = $enriched | Sort-Object @{Expression='RiskScore';Descending=$true}, Endpoint

$targetDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $targetDir)) {
	New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}
$sorted | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding UTF8

$total = $sorted.Count
$requiresChanges = ($sorted | Where-Object { $_.Decision -eq 'Requires Changes' }).Count
$inReview = ($sorted | Where-Object { $_.Decision -eq 'In Review' }).Count
$pending = ($sorted | Where-Object { $_.Decision -eq 'Pending' }).Count
$highRisk = ($sorted | Where-Object { $_.RiskTier -eq 'High' }).Count
$mediumRisk = ($sorted | Where-Object { $_.RiskTier -eq 'Medium' }).Count
$lowRisk = ($sorted | Where-Object { $_.RiskTier -eq 'Low' }).Count

$ownerSummary = $sorted | Group-Object Owner | Sort-Object Name
$ownerLines = $ownerSummary | ForEach-Object { "- **$($_.Name)**: $($_.Count) endpoint(s)" }

$kpi = @(
	'# Endpoint Remediation KPI Snapshot',
	'',
	"Generated: $($today.ToString('yyyy-MM-dd HH:mm:ss'))",
	'',
	'## Backlog',
	"- Total endpoints: **$total**",
	"- Requires Changes: **$requiresChanges**",
	"- In Review: **$inReview**",
	"- Pending: **$pending**",
	'',
	'## Risk Distribution',
	"- High: **$highRisk**",
	"- Medium: **$mediumRisk**",
	"- Low: **$lowRisk**",
	'',
	'## Owner Distribution'
)
$kpi += $ownerLines

$kpiDir = Split-Path -Parent $KpiOutputPath
if (-not (Test-Path -LiteralPath $kpiDir)) {
	New-Item -ItemType Directory -Path $kpiDir -Force | Out-Null
}
$kpi | Set-Content -LiteralPath $KpiOutputPath -Encoding UTF8

Write-Host "Enriched remediation ledger written to: $OutputPath"
Write-Host "KPI summary written to: $KpiOutputPath"
Write-Host "Totals => Total=$total; RequiresChanges=$requiresChanges; InReview=$inReview; Pending=$pending"

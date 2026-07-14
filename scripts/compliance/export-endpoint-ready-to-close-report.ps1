param(
	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$EvidenceRegisterPath = "security-compliance/evidence/evidence-register.csv",

	[Parameter(Mandatory = $false)]
	[string]$OutputDirectory = "security-compliance/controls"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LedgerPath)) {
	throw "Ledger not found: $LedgerPath"
}

if (-not (Test-Path -LiteralPath $EvidenceRegisterPath)) {
	throw "Evidence register not found: $EvidenceRegisterPath"
}

$ledger = Import-Csv -LiteralPath $LedgerPath
$evidence = Import-Csv -LiteralPath $EvidenceRegisterPath

$evidenceById = @{}
foreach ($ev in $evidence) {
	if (-not [string]::IsNullOrWhiteSpace($ev.EvidenceId)) {
		$evidenceById[$ev.EvidenceId] = $ev
	}
}

$ready = New-Object System.Collections.Generic.List[object]
$blocked = New-Object System.Collections.Generic.List[object]

foreach ($row in $ledger) {
	$evidenceRef = $row.EvidenceRef

	if ([string]::IsNullOrWhiteSpace($evidenceRef) -or $evidenceRef -eq '<EV-ID>' -or -not $evidenceById.ContainsKey($evidenceRef)) {
		$blocked.Add([PSCustomObject]@{
			Endpoint = $row.Endpoint
			Method = $row.Method
			Owner = $row.Owner
			Decision = $row.Decision
			RemediationStatus = $row.RemediationStatus
			EvidenceRef = $row.EvidenceRef
			Blocker = 'Missing or unresolved EvidenceRef'
		})
		continue
	}

	$ev = $evidenceById[$evidenceRef]
	$artifactPath = $ev.ArtifactLocation

	if ([string]::IsNullOrWhiteSpace($artifactPath)) {
		$blocked.Add([PSCustomObject]@{
			Endpoint = $row.Endpoint
			Method = $row.Method
			Owner = $row.Owner
			Decision = $row.Decision
			RemediationStatus = $row.RemediationStatus
			EvidenceRef = $row.EvidenceRef
			Blocker = 'Evidence artifact path missing'
		})
		continue
	}

	$normalized = $artifactPath.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\\', [IO.Path]::DirectorySeparatorChar)
	$fullPath = Join-Path (Get-Location) $normalized

	if (-not (Test-Path -LiteralPath $fullPath)) {
		$blocked.Add([PSCustomObject]@{
			Endpoint = $row.Endpoint
			Method = $row.Method
			Owner = $row.Owner
			Decision = $row.Decision
			RemediationStatus = $row.RemediationStatus
			EvidenceRef = $row.EvidenceRef
			Blocker = 'Evidence file not found'
		})
		continue
	}

	$fileContent = Get-Content -LiteralPath $fullPath -Raw
	$hasMethodPath = $fileContent -notmatch 'Method/Path: <fill>'
	$hasIncluded = $fileContent -notmatch 'Included fields validated: <fill>'
	$hasIncluded = $hasIncluded -and $fileContent -notmatch 'Included fields validated: <to-validate>'
	$hasIncluded = $hasIncluded -and $fileContent -notmatch 'Included fields validated: Pending reviewer validation'
	$hasExcluded = $fileContent -notmatch 'Excluded fields validated: <fill>'
	$hasExcluded = $hasExcluded -and $fileContent -notmatch 'Excluded fields validated: <to-validate>'
	$hasExcluded = $hasExcluded -and $fileContent -notmatch 'Excluded fields validated: Pending reviewer validation'
	$hasRedaction = $fileContent -notmatch 'Redaction verified: <Yes\|No\|N/A>'
	$hasRedaction = $hasRedaction -and $fileContent -notmatch 'Redaction verified: Partial'
	$hasAuditCoverage = $fileContent -notmatch 'Audit coverage verified: <Yes\|No\|N/A>'
	$hasAuditCoverage = $hasAuditCoverage -and $fileContent -notmatch 'Audit coverage verified: Partial'
	$hasSources = $fileContent -notmatch 'Source references: <fill>'
	$hasManualFieldReview = $fileContent -notmatch 'Auto-seeded; reviewer must replace'
	$hasManualTests = $fileContent -notmatch 'Test evidence: Pending'
	$hasManualTests = $hasManualTests -and $fileContent -notmatch 'Test evidence: <fill>'
	$hasManualTests = $hasManualTests -and $fileContent -notmatch 'Test evidence: TBD'
	$hasManualTests = $hasManualTests -and $fileContent -notmatch 'Test evidence: N/A'
	$hasReviewerNotes = $fileContent -notmatch 'Reviewer notes: <fill>'
	$hasReviewerNotes = $hasReviewerNotes -and $fileContent -notmatch 'Reviewer notes: TBD'
	$hasReviewerNotes = $hasReviewerNotes -and $fileContent -notmatch 'Reviewer notes: N/A'

	if ($hasMethodPath -and $hasIncluded -and $hasExcluded -and $hasRedaction -and $hasAuditCoverage -and $hasSources -and $hasManualFieldReview -and $hasManualTests -and $hasReviewerNotes) {
		$ready.Add([PSCustomObject]@{
			Endpoint = $row.Endpoint
			Method = $row.Method
			Owner = $row.Owner
			Decision = $row.Decision
			RemediationStatus = $row.RemediationStatus
			EvidenceRef = $row.EvidenceRef
			EvidencePath = $artifactPath
		})
	}
	else {
		$blocked.Add([PSCustomObject]@{
			Endpoint = $row.Endpoint
			Method = $row.Method
			Owner = $row.Owner
			Decision = $row.Decision
			RemediationStatus = $row.RemediationStatus
			EvidenceRef = $row.EvidenceRef
			Blocker = 'Evidence content incomplete (placeholders or seeded notes remain)'
		})
	}
}

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
	New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$readyPath = Join-Path $OutputDirectory 'endpoint-ready-to-close.csv'
$blockedPath = Join-Path $OutputDirectory 'endpoint-not-ready-to-close.csv'
$summaryPath = Join-Path $OutputDirectory 'endpoint-ready-to-close-summary.md'

$ready | Sort-Object Owner, Endpoint | Export-Csv -LiteralPath $readyPath -NoTypeInformation -Encoding UTF8
$blocked | Sort-Object Owner, Endpoint | Export-Csv -LiteralPath $blockedPath -NoTypeInformation -Encoding UTF8

$summary = @(
	'# Endpoint Ready-to-Close Summary',
	'',
	"Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
	'',
	"- Ready to close: **$($ready.Count)**",
	"- Not ready: **$($blocked.Count)**",
	''
)

$summary += '## Ready by Owner'
$readyByOwner = $ready | Group-Object Owner | Sort-Object Name
if ($readyByOwner.Count -eq 0) {
	$summary += '- None'
}
else {
	$summary += ($readyByOwner | ForEach-Object { "- **$($_.Name)**: $($_.Count)" })
}

$summary += ''
$summary += '## Top Blockers'
$blockers = $blocked | Group-Object Blocker | Sort-Object Count -Descending
if ($blockers.Count -eq 0) {
	$summary += '- None'
}
else {
	$summary += ($blockers | ForEach-Object { "- $($_.Name): **$($_.Count)**" })
}

$summary | Set-Content -LiteralPath $summaryPath -Encoding UTF8

Write-Host "Ready report written: $readyPath"
Write-Host "Not-ready report written: $blockedPath"
Write-Host "Summary written: $summaryPath"
Write-Host "Totals => Ready=$($ready.Count); NotReady=$($blocked.Count)"

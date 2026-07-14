param(
	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$EvidenceRegisterPath = "security-compliance/evidence/evidence-register.csv"
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

$now = Get-Date
$closed = 0

$updated = foreach ($row in $ledger) {
	$canClose = $false
	$evidenceRef = $row.EvidenceRef

	if (-not [string]::IsNullOrWhiteSpace($evidenceRef) -and $evidenceById.ContainsKey($evidenceRef)) {
		$ev = $evidenceById[$evidenceRef]
		$artifactPath = $ev.ArtifactLocation
		if (-not [string]::IsNullOrWhiteSpace($artifactPath)) {
			$normalized = $artifactPath.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\\', [IO.Path]::DirectorySeparatorChar)
			$fullPath = Join-Path (Get-Location) $normalized
			if (Test-Path -LiteralPath $fullPath) {
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
					$canClose = $true
				}
			}
		}
	}

	if ($canClose) {
		$row.Decision = 'Closed'
		$row.RemediationStatus = 'Closed'
		$row.ReviewDateUtc = $now.ToString('yyyy-MM-dd')
		$closed++
	}

	$row
}

$updated | Export-Csv -LiteralPath $LedgerPath -NoTypeInformation -Encoding UTF8

Write-Host "Ledger closure pass complete. Closed=$closed; Total=$($updated.Count)"

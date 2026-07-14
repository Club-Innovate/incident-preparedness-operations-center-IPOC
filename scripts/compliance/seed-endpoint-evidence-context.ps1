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

$ledgerByEvidence = @{}
foreach ($row in $ledger) {
	if (-not [string]::IsNullOrWhiteSpace($row.EvidenceRef) -and $row.EvidenceRef -ne '<EV-ID>') {
		$ledgerByEvidence[$row.EvidenceRef] = $row
	}
}

$updatedFiles = 0
$skippedFiles = 0

foreach ($ev in $evidence) {
	$evidenceId = $ev.EvidenceId
	if ([string]::IsNullOrWhiteSpace($evidenceId) -or -not $ledgerByEvidence.ContainsKey($evidenceId)) {
		continue
	}

	$artifactLocation = $ev.ArtifactLocation
	if ([string]::IsNullOrWhiteSpace($artifactLocation)) {
		continue
	}

	$normalized = $artifactLocation.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\\', [IO.Path]::DirectorySeparatorChar)
	$fullPath = Join-Path (Get-Location) $normalized

	if (-not (Test-Path -LiteralPath $fullPath)) {
		$skippedFiles++
		continue
	}

	$row = $ledgerByEvidence[$evidenceId]
	$raw = Get-Content -LiteralPath $fullPath -Raw

	if ($raw -notmatch 'Method/Path: <fill>' -or $raw -match 'Auto-seeded by script') {
		$skippedFiles++
		continue
	}

	$included = if ([string]::IsNullOrWhiteSpace($row.IncludedSensitiveFields)) { 'Pending reviewer validation' } else { $row.IncludedSensitiveFields }
	$excluded = if ([string]::IsNullOrWhiteSpace($row.ExcludedSensitiveFields)) { 'Pending reviewer validation' } else { $row.ExcludedSensitiveFields }

	$sourceRefs = @(
		"security-compliance/controls/endpoint-minimum-necessary-reviews.csv (EvidenceRef=$evidenceId)",
		"audit/tmp/_tmp_endpoint_matrix_generated.md"
	) -join '; '

	$seeded = $raw
	$seeded = $seeded -replace 'Method/Path: <fill>', ("Method/Path: {0} {1}" -f $row.Method, $row.Endpoint)
	$seeded = $seeded -replace 'Included fields validated: <fill>', ("Included fields validated: {0}" -f $included)
	$seeded = $seeded -replace 'Excluded fields validated: <fill>', ("Excluded fields validated: {0}" -f $excluded)
	$seeded = $seeded -replace 'Redaction verified: <Yes\|No\|N/A>', ("Redaction verified: {0}" -f $row.RedactionVerified)
	$seeded = $seeded -replace 'Audit coverage verified: <Yes\|No\|N/A>', ("Audit coverage verified: {0}" -f $row.AuditCoverageVerified)
	$seeded = $seeded -replace 'Source references: <fill>', ("Source references: {0}" -f $sourceRefs)
	$seeded = $seeded -replace 'Test evidence: <fill>', 'Test evidence: Pending (attach test run ID / log link)'
	$seeded = $seeded -replace 'Reviewer notes: <fill>', 'Reviewer notes: Auto-seeded by script; reviewer must replace with endpoint-specific findings.'

	Set-Content -LiteralPath $fullPath -Value $seeded -Encoding UTF8
	$updatedFiles++
}

Write-Host "Evidence context seeding complete. Updated=$updatedFiles; Skipped=$skippedFiles"

param(
	[Parameter(Mandatory = $false)]
	[string]$UpdatesCsvPath = "security-compliance/controls/endpoint-test-evidence-updates.template.csv",

	[Parameter(Mandatory = $false)]
	[string]$EvidenceRegisterPath = "security-compliance/evidence/evidence-register.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $UpdatesCsvPath)) {
	throw "Updates CSV not found: $UpdatesCsvPath"
}

if (-not (Test-Path -LiteralPath $EvidenceRegisterPath)) {
	throw "Evidence register not found: $EvidenceRegisterPath"
}

$updates = Import-Csv -LiteralPath $UpdatesCsvPath
$evidence = Import-Csv -LiteralPath $EvidenceRegisterPath

$evidenceById = @{}
foreach ($ev in $evidence) {
	if (-not [string]::IsNullOrWhiteSpace($ev.EvidenceId)) {
		$evidenceById[$ev.EvidenceId] = $ev
	}
}

$updatedFiles = 0
$skippedRows = 0

foreach ($u in $updates) {
	if ([string]::IsNullOrWhiteSpace($u.EvidenceRef)) {
		$skippedRows++
		continue
	}

	if (-not $evidenceById.ContainsKey($u.EvidenceRef)) {
		$skippedRows++
		continue
	}

	$artifactPath = $evidenceById[$u.EvidenceRef].ArtifactLocation
	if ([string]::IsNullOrWhiteSpace($artifactPath)) {
		$skippedRows++
		continue
	}

	$normalized = $artifactPath.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\\', [IO.Path]::DirectorySeparatorChar)
	$fullPath = Join-Path (Get-Location) $normalized

	if (-not (Test-Path -LiteralPath $fullPath)) {
		$skippedRows++
		continue
	}

	$raw = Get-Content -LiteralPath $fullPath -Raw
	$changed = $false

	if (-not [string]::IsNullOrWhiteSpace($u.TestEvidence)) {
		$escaped = [regex]::Escape($u.TestEvidence)
		if ($raw -notmatch "Test evidence: $escaped") {
			$raw = $raw -replace 'Test evidence: <fill>', ("Test evidence: {0}" -f $u.TestEvidence)
			$raw = $raw -replace 'Test evidence: Pending \(attach test run ID / log link\)', ("Test evidence: {0}" -f $u.TestEvidence)
			$changed = $true
		}
	}

	if (-not [string]::IsNullOrWhiteSpace($u.ReviewerNotes)) {
		$escaped = [regex]::Escape($u.ReviewerNotes)
		if ($raw -notmatch "Reviewer notes: $escaped") {
			$raw = $raw -replace 'Reviewer notes: <fill>', ("Reviewer notes: {0}" -f $u.ReviewerNotes)
			$raw = $raw -replace 'Reviewer notes: Auto-seeded by script; reviewer must replace with endpoint-specific findings\.', ("Reviewer notes: {0}" -f $u.ReviewerNotes)
			$changed = $true
		}
	}

	if (-not [string]::IsNullOrWhiteSpace($u.IncludedFieldsValidated)) {
		$raw = $raw -replace 'Included fields validated: <fill>', ("Included fields validated: {0}" -f $u.IncludedFieldsValidated)
		$raw = $raw -replace 'Included fields validated: <to-validate>', ("Included fields validated: {0}" -f $u.IncludedFieldsValidated)
		$changed = $true
	}

	if (-not [string]::IsNullOrWhiteSpace($u.ExcludedFieldsValidated)) {
		$raw = $raw -replace 'Excluded fields validated: <fill>', ("Excluded fields validated: {0}" -f $u.ExcludedFieldsValidated)
		$raw = $raw -replace 'Excluded fields validated: <to-validate>', ("Excluded fields validated: {0}" -f $u.ExcludedFieldsValidated)
		$changed = $true
	}

	if (-not [string]::IsNullOrWhiteSpace($u.RedactionVerified)) {
		$raw = $raw -replace 'Redaction verified: <Yes\|No\|N/A>', ("Redaction verified: {0}" -f $u.RedactionVerified)
		$raw = $raw -replace 'Redaction verified: Partial', ("Redaction verified: {0}" -f $u.RedactionVerified)
		$changed = $true
	}

	if (-not [string]::IsNullOrWhiteSpace($u.AuditCoverageVerified)) {
		$raw = $raw -replace 'Audit coverage verified: <Yes\|No\|N/A>', ("Audit coverage verified: {0}" -f $u.AuditCoverageVerified)
		$raw = $raw -replace 'Audit coverage verified: Partial', ("Audit coverage verified: {0}" -f $u.AuditCoverageVerified)
		$changed = $true
	}

	if ($changed) {
		Set-Content -LiteralPath $fullPath -Value $raw -Encoding UTF8
		$updatedFiles++
	}
}

Write-Host "Evidence updates applied. UpdatedFiles=$updatedFiles; SkippedRows=$skippedRows"

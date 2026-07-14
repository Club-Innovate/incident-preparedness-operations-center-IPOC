param(
	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$EvidenceRegisterPath = "security-compliance/evidence/evidence-register.csv",

	[Parameter(Mandatory = $false)]
	[string]$OutputDirectory = "security-compliance/controls/owner-workpacks"
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

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
	New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$active = $ledger | Where-Object { $_.Decision -ne 'Closed' }
$groups = $active | Group-Object Owner | Sort-Object Name

$generated = 0
foreach ($g in $groups) {
	$owner = if ([string]::IsNullOrWhiteSpace($g.Name)) { 'Unassigned' } else { $g.Name }
	$safeName = ($owner -replace '[^a-zA-Z0-9\-]+', '-').Trim('-').ToLowerInvariant()
	if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = 'unassigned' }

	$ownerRows = $g.Group | Sort-Object @{Expression='RiskScore';Descending=$true}, DueDateUtc, Endpoint
	$countRequires = ($ownerRows | Where-Object { $_.Decision -eq 'Requires Changes' }).Count
	$countReview = ($ownerRows | Where-Object { $_.Decision -eq 'In Review' }).Count
	$countPending = ($ownerRows | Where-Object { $_.Decision -eq 'Pending' }).Count

	$lines = New-Object System.Collections.Generic.List[string]
	$lines.Add("# Owner Remediation Workpack - $owner")
	$lines.Add('')
	$lines.Add("Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))")
	$lines.Add('')
	$lines.Add('## Queue Summary')
	$lines.Add("- Total open items: **$($ownerRows.Count)**")
	$lines.Add("- Requires Changes: **$countRequires**")
	$lines.Add("- In Review: **$countReview**")
	$lines.Add("- Pending: **$countPending**")
	$lines.Add('')
	$lines.Add('## Priority Actions')

	foreach ($row in $ownerRows) {
		$evidenceRef = $row.EvidenceRef
		$evidencePath = 'N/A'
		if (-not [string]::IsNullOrWhiteSpace($evidenceRef) -and $evidenceById.ContainsKey($evidenceRef)) {
			$evidencePath = $evidenceById[$evidenceRef].ArtifactLocation
		}

		$lines.Add("### [$($row.Decision)] $($row.Method) $($row.Endpoint)")
		$lines.Add("- Risk: **$($row.RiskTier)** (Score: $($row.RiskScore))")
		$lines.Add("- Due: **$($row.DueDateUtc)**")
		$lines.Add("- Remediation Status: $($row.RemediationStatus)")
		$lines.Add("- EvidenceRef: $evidenceRef")
		$lines.Add("- Evidence File: $evidencePath")
		$lines.Add('- Completion checklist:')
		$lines.Add('  - [ ] Replace Included fields validated with reviewed endpoint-specific values')
		$lines.Add('  - [ ] Replace Excluded fields validated with reviewed endpoint-specific values')
		$lines.Add('  - [ ] Confirm redaction and audit coverage status with code/test evidence')
		$lines.Add('  - [ ] Replace test evidence with concrete run/log reference')
		$lines.Add('  - [ ] Replace reviewer notes with findings and sign-off')
		$lines.Add('')
	}

	$outPath = Join-Path $OutputDirectory ("{0}.md" -f $safeName)
	$lines | Set-Content -LiteralPath $outPath -Encoding UTF8
	$generated++
}

Write-Host "Owner workpacks generated: $generated"
Write-Host "Output directory: $OutputDirectory"

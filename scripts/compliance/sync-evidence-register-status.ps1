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

$changed = 0
$updated = foreach ($ev in $evidence) {
	$newStatus = 'Planned'

	if (-not [string]::IsNullOrWhiteSpace($ev.EvidenceId) -and $ledgerByEvidence.ContainsKey($ev.EvidenceId)) {
		$row = $ledgerByEvidence[$ev.EvidenceId]
		$newStatus = if ($row.Decision -eq 'Closed' -or $row.RemediationStatus -eq 'Closed') { 'Approved' } else { 'In Progress' }
	}

	if ($ev.Status -ne $newStatus) {
		$ev.Status = $newStatus
		$changed++
	}

	$ev
}

$updated | Export-Csv -LiteralPath $EvidenceRegisterPath -NoTypeInformation -Encoding UTF8

$counts = $updated | Group-Object Status | Sort-Object Name | ForEach-Object { "{0}={1}" -f $_.Name,$_.Count }
Write-Host "Evidence register status synchronized. Changed=$changed"
Write-Host ("StatusCounts: " + ($counts -join '; '))

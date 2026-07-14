param(
	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$EvidenceRegisterPath = "security-compliance/evidence/evidence-register.csv",

	[Parameter(Mandatory = $false)]
	[switch]$IncludePending
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LedgerPath)) {
	throw "Endpoint ledger not found: $LedgerPath"
}

$rows = Import-Csv -LiteralPath $LedgerPath

$evidenceDir = Split-Path -Parent $EvidenceRegisterPath
if (-not (Test-Path -LiteralPath $evidenceDir)) {
	New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
}

$evidenceColumns = @(
	'EvidenceId','ControlId','Domain','ArtifactName','ArtifactLocation','Owner','CollectedUtc','ValidUntilUtc','ReviewCadence','Status','Notes'
)

$evidence = @()
if (Test-Path -LiteralPath $EvidenceRegisterPath) {
	$evidence = Import-Csv -LiteralPath $EvidenceRegisterPath
}

$existingIds = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
foreach ($ev in $evidence) {
	if ($ev.EvidenceId) { [void]$existingIds.Add($ev.EvidenceId) }
}

function New-EvidenceId {
	param([int]$Index)
	return ('EV-ENDP-{0:D4}' -f $Index)
}

function Is-PlaceholderEvidenceRef {
	param([string]$Ref)
	if ([string]::IsNullOrWhiteSpace($Ref)) { return $true }
	$r = $Ref.Trim()
	return $r -eq '<EV-ID>' -or $r -eq '<EV-ID>' -or $r -eq 'TBD'
}

$counter = 1
while ($existingIds.Contains((New-EvidenceId -Index $counter))) {
	$counter++
}

$today = Get-Date
$collected = $today.ToString('yyyy-MM-dd')
$validUntil = $today.AddDays(90).ToString('yyyy-MM-dd')

$updatedRows = foreach ($row in $rows) {
	$decision = $row.Decision
	$needsEvidence = $decision -eq 'Requires Changes' -or $decision -eq 'In Review' -or ($IncludePending -and $decision -eq 'Pending')
	$evidenceRef = $row.EvidenceRef

	if ($needsEvidence -and (Is-PlaceholderEvidenceRef -Ref $evidenceRef)) {
		$newId = New-EvidenceId -Index $counter
		$counter++
		[void]$existingIds.Add($newId)

		$owner = if ([string]::IsNullOrWhiteSpace($row.Owner)) { 'Compliance-Working-Session' } else { $row.Owner }

		$evidence += [PSCustomObject]@{
			EvidenceId = $newId
			ControlId = 'PRI-01'
			Domain = 'Minimum Necessary / Data Minimization'
			ArtifactName = "Endpoint review evidence - $($row.Method) $($row.Endpoint)"
			ArtifactLocation = "security-compliance/evidence/endpoint/$($newId).md"
			Owner = $owner
			CollectedUtc = $collected
			ValidUntilUtc = $validUntil
			ReviewCadence = 'Quarterly'
			Status = 'Planned'
			Notes = "Auto-linked from endpoint remediation ledger. Decision=$decision"
		}

		$row.EvidenceRef = $newId
	}

	$row
}

$updatedRows | Export-Csv -LiteralPath $LedgerPath -NoTypeInformation -Encoding UTF8

$evidence | Select-Object $evidenceColumns | Export-Csv -LiteralPath $EvidenceRegisterPath -NoTypeInformation -Encoding UTF8

$linkedCount = ($updatedRows | Where-Object { -not (Is-PlaceholderEvidenceRef -Ref $_.EvidenceRef) }).Count
Write-Host "Endpoint ledger updated: $LedgerPath"
Write-Host "Evidence register updated: $EvidenceRegisterPath"
Write-Host "Rows linked with concrete evidence refs: $linkedCount"

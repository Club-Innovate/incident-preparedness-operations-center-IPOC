param(
	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$OutputDirectory = "security-compliance/controls/owner-backlogs"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LedgerPath)) {
	throw "Ledger not found: $LedgerPath"
}

$rows = Import-Csv -LiteralPath $LedgerPath

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
	New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$groups = $rows | Group-Object Owner

$exported = 0
foreach ($g in $groups) {
	$owner = if ([string]::IsNullOrWhiteSpace($g.Name)) { 'Unassigned' } else { $g.Name }
	$safeName = ($owner -replace '[^a-zA-Z0-9\-]+','-').Trim('-').ToLowerInvariant()
	if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = 'unassigned' }

	$path = Join-Path $OutputDirectory ("{0}.csv" -f $safeName)
	$g.Group | Sort-Object @{Expression='RiskScore';Descending=$true}, Endpoint | Export-Csv -LiteralPath $path -NoTypeInformation -Encoding UTF8
	$exported++
}

Write-Host "Exported owner backlog files: $exported"
Write-Host "Output directory: $OutputDirectory"

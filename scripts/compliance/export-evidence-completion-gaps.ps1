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

$gaps = New-Object System.Collections.Generic.List[object]

foreach ($row in $ledger) {
	if ($row.Decision -eq 'Closed' -or $row.RemediationStatus -eq 'Closed') {
		continue
	}

	$ref = $row.EvidenceRef
	if ([string]::IsNullOrWhiteSpace($ref) -or $ref -eq '<EV-ID>' -or -not $evidenceById.ContainsKey($ref)) {
		$gaps.Add([PSCustomObject]@{
			Owner = $row.Owner
			RiskTier = $row.RiskTier
			RiskScore = $row.RiskScore
			Decision = $row.Decision
			Endpoint = $row.Endpoint
			Method = $row.Method
			EvidenceRef = $row.EvidenceRef
			MissingCount = 99
			MissingItems = 'EvidenceRef unresolved'
			EvidencePath = ''
		})
		continue
	}

	$artifactPath = $evidenceById[$ref].ArtifactLocation
	$normalized = $artifactPath.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\\', [IO.Path]::DirectorySeparatorChar)
	$fullPath = Join-Path (Get-Location) $normalized

	if (-not (Test-Path -LiteralPath $fullPath)) {
		$gaps.Add([PSCustomObject]@{
			Owner = $row.Owner
			RiskTier = $row.RiskTier
			RiskScore = $row.RiskScore
			Decision = $row.Decision
			Endpoint = $row.Endpoint
			Method = $row.Method
			EvidenceRef = $row.EvidenceRef
			MissingCount = 98
			MissingItems = 'Evidence file missing'
			EvidencePath = $artifactPath
		})
		continue
	}

	$content = Get-Content -LiteralPath $fullPath -Raw
	$missing = New-Object System.Collections.Generic.List[string]

	if ($content -match 'Method/Path: <fill>') { [void]$missing.Add('Method/Path') }
	if ($content -match 'Included fields validated: <fill>') { [void]$missing.Add('Included fields') }
	if ($content -match 'Included fields validated: <to-validate>') { [void]$missing.Add('Included fields') }
	if ($content -match 'Included fields validated: Pending reviewer validation') { [void]$missing.Add('Included fields') }
	if ($content -match 'Excluded fields validated: <fill>') { [void]$missing.Add('Excluded fields') }
	if ($content -match 'Excluded fields validated: <to-validate>') { [void]$missing.Add('Excluded fields') }
	if ($content -match 'Excluded fields validated: Pending reviewer validation') { [void]$missing.Add('Excluded fields') }
	if ($content -match 'Redaction verified: <Yes\|No\|N/A>') { [void]$missing.Add('Redaction verification') }
	if ($content -match 'Redaction verified: Partial') { [void]$missing.Add('Redaction verification') }
	if ($content -match 'Audit coverage verified: <Yes\|No\|N/A>') { [void]$missing.Add('Audit coverage verification') }
	if ($content -match 'Audit coverage verified: Partial') { [void]$missing.Add('Audit coverage verification') }
	if ($content -match 'Source references: <fill>') { [void]$missing.Add('Source references') }
	if ($content -match 'Test evidence: Pending') { [void]$missing.Add('Test evidence') }
	if ($content -match 'Test evidence: <fill>') { [void]$missing.Add('Test evidence') }
	if ($content -match 'Test evidence: TBD') { [void]$missing.Add('Test evidence') }
	if ($content -match 'Test evidence: N/A') { [void]$missing.Add('Test evidence') }
	if ($content -match 'Auto-seeded; reviewer must replace') { [void]$missing.Add('Reviewer notes') }
	if ($content -match 'Reviewer notes: <fill>') { [void]$missing.Add('Reviewer notes') }
	if ($content -match 'Reviewer notes: TBD') { [void]$missing.Add('Reviewer notes') }
	if ($content -match 'Reviewer notes: N/A') { [void]$missing.Add('Reviewer notes') }

	if ($missing.Count -gt 0) {
		$gaps.Add([PSCustomObject]@{
			Owner = $row.Owner
			RiskTier = $row.RiskTier
			RiskScore = $row.RiskScore
			Decision = $row.Decision
			Endpoint = $row.Endpoint
			Method = $row.Method
			EvidenceRef = $row.EvidenceRef
			MissingCount = $missing.Count
			MissingItems = ($missing -join '; ')
			EvidencePath = $artifactPath
		})
	}
}

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
	New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$csvPath = Join-Path $OutputDirectory 'endpoint-evidence-completion-gaps.csv'
$mdPath = Join-Path $OutputDirectory 'endpoint-evidence-completion-gaps-summary.md'

$sorted = $gaps | Sort-Object @{Expression='MissingCount';Descending=$true}, @{Expression='RiskScore';Descending=$true}, Owner, Endpoint
$sorted | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8

$ownerLines = $sorted | Group-Object Owner | Sort-Object Count -Descending | ForEach-Object { "- **$($_.Name)**: $($_.Count)" }
$riskLines = $sorted | Group-Object RiskTier | Sort-Object Name | ForEach-Object { "- **$($_.Name)**: $($_.Count)" }

$lines = @(
	'# Endpoint Evidence Completion Gaps Summary',
	'',
	"Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
	'',
	"- Open endpoints with evidence gaps: **$($sorted.Count)**",
	"- CSV export: $csvPath",
	''
)

$lines += '## Gaps by Owner'
if ($ownerLines.Count -eq 0) { $lines += '- None' } else { $lines += $ownerLines }

$lines += ''
$lines += '## Gaps by RiskTier'
if ($riskLines.Count -eq 0) { $lines += '- None' } else { $lines += $riskLines }

$lines += ''
$lines += '## Top 10 Priority Gaps'
if ($sorted.Count -eq 0) {
	$lines += '- None'
}
else {
	$top = $sorted | Select-Object -First 10
	foreach ($item in $top) {
		$lines += "- [$($item.Decision)] $($item.Method) $($item.Endpoint) | Owner=$($item.Owner) | Missing=$($item.MissingCount) | $($item.MissingItems)"
	}
}

$lines | Set-Content -LiteralPath $mdPath -Encoding UTF8

Write-Host "Evidence gap summary written: $mdPath"
Write-Host "Evidence gap export written: $csvPath"
Write-Host "Total gap rows: $($sorted.Count)"

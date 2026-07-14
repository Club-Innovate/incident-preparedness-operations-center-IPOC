param(
	[Parameter(Mandatory = $false)]
	[string]$EvidenceRegisterPath = "security-compliance/evidence/evidence-register.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EvidenceRegisterPath)) {
	throw "Evidence register not found: $EvidenceRegisterPath"
}

$rows = Import-Csv -LiteralPath $EvidenceRegisterPath
$created = 0
$skipped = 0

foreach ($row in $rows) {
	$artifactLocation = $row.ArtifactLocation
	if ([string]::IsNullOrWhiteSpace($artifactLocation)) {
		$skipped++
		continue
	}

	$normalized = $artifactLocation.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\\', [IO.Path]::DirectorySeparatorChar)
	$fullPath = Join-Path (Get-Location) $normalized

	$dir = Split-Path -Parent $fullPath
	if (-not (Test-Path -LiteralPath $dir)) {
		New-Item -ItemType Directory -Path $dir -Force | Out-Null
	}

	if (Test-Path -LiteralPath $fullPath) {
		$skipped++
		continue
	}

	$content = @(
		"# Endpoint Evidence - $($row.EvidenceId)",
		"",
		"- Evidence ID: $($row.EvidenceId)",
		"- Control ID: $($row.ControlId)",
		"- Domain: $($row.Domain)",
		"- Artifact Name: $($row.ArtifactName)",
		"- Owner: $($row.Owner)",
		"- Collected UTC: $($row.CollectedUtc)",
		"- Valid Until UTC: $($row.ValidUntilUtc)",
		"- Review Cadence: $($row.ReviewCadence)",
		"- Status: $($row.Status)",
		"",
		"## Endpoint",
		"- Method/Path: <fill>",
		"",
		"## Minimum Necessary Verification",
		"- Included fields validated: <fill>",
		"- Excluded fields validated: <fill>",
		"- Redaction verified: <Yes|No|N/A>",
		"- Audit coverage verified: <Yes|No|N/A>",
		"",
		"## Validation Artifacts",
		"- Source references: <fill>",
		"- Test evidence: <fill>",
		"- Reviewer notes: <fill>",
		""
	)

	$content | Set-Content -LiteralPath $fullPath -Encoding UTF8
	$created++
}

Write-Host "Evidence stubs generated. Created=$created; Skipped=$skipped"

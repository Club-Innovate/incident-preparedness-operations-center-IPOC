param(
	[Parameter(Mandatory = $false)]
	[string]$QueueCsvPath = "security-compliance/controls/endpoint-test-evidence-queue.csv",

	[Parameter(Mandatory = $false)]
	[string]$OutputPath = "security-compliance/controls/endpoint-test-evidence-updates.template.csv",

	[Parameter(Mandatory = $false)]
	[int]$Top = 25
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $QueueCsvPath)) {
	throw "Queue CSV not found: $QueueCsvPath"
}

$rows = Import-Csv -LiteralPath $QueueCsvPath | Select-Object -First $Top

$template = foreach ($row in $rows) {
	[PSCustomObject]@{
		EvidenceRef = $row.EvidenceRef
		Endpoint = $row.Endpoint
		Method = $row.Method
		Owner = $row.Owner
		DueDateUtc = $row.DueDateUtc
		TestEvidence = ''
		ReviewerNotes = ''
		IncludedFieldsValidated = ''
		ExcludedFieldsValidated = ''
		RedactionVerified = ''
		AuditCoverageVerified = ''
	}
}

$targetDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $targetDir)) {
	New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$template | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding UTF8

Write-Host "Test evidence update template generated: $OutputPath"
Write-Host "Rows: $($template.Count)"

param(
	[Parameter(Mandatory = $false)]
	[string]$ProjectPath = "IPOC_WEB.Server/IPOC_WEB.Server.csproj",

	[Parameter(Mandatory = $false)]
	[string[]]$FailOnSeverities = @("Critical", "High")
)

$ErrorActionPreference = "Stop"

Write-Host "[compliance] Checking vulnerable NuGet packages for project: $ProjectPath"

if (-not (Test-Path -LiteralPath $ProjectPath)) {
	Write-Error "Project not found: $ProjectPath"
}

$cmdOutput = & dotnet list $ProjectPath package --vulnerable --include-transitive 2>&1
$exitCode = $LASTEXITCODE

$outputText = ($cmdOutput | Out-String)
Write-Host $outputText

if ($exitCode -ne 0) {
	Write-Error "dotnet list package command failed with exit code $exitCode"
}

$failSeveritiesNormalized = $FailOnSeverities | ForEach-Object { $_.Trim().ToLowerInvariant() }

$severityRegex = [regex]'(?im)\b(critical|high|moderate|low)\b'
$matches = $severityRegex.Matches($outputText)

if ($matches.Count -eq 0) {
	Write-Host "[compliance] No vulnerability severity markers were found in command output."
	exit 0
}

$found = @{}
foreach ($m in $matches) {
	$s = $m.Groups[1].Value.ToLowerInvariant()
	if (-not $found.ContainsKey($s)) {
		$found[$s] = 0
	}
	$found[$s]++
}

$shouldFail = $false
foreach ($severity in $failSeveritiesNormalized) {
	if ($found.ContainsKey($severity) -and $found[$severity] -gt 0) {
		$shouldFail = $true
	}
}

$summary = ($found.GetEnumerator() | Sort-Object Name | ForEach-Object { "{0}:{1}" -f $_.Name, $_.Value }) -join ", "
Write-Host "[compliance] Vulnerability severity summary => $summary"

if ($shouldFail) {
	$threshold = ($FailOnSeverities -join ", ")
	Write-Error "Compliance gate failed: vulnerable packages detected at configured severity threshold ($threshold)."
}

Write-Host "[compliance] Vulnerability gate passed for threshold: $($FailOnSeverities -join ', ')"
exit 0

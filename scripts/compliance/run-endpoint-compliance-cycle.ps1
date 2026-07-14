param(
	[Parameter(Mandatory = $false)]
	[switch]$IncludePendingEvidence,

	[Parameter(Mandatory = $false)]
	[switch]$GenerateTestEvidenceTemplate,

	[Parameter(Mandatory = $false)]
	[int]$TemplateTop = 25
)

$ErrorActionPreference = "Stop"

$scripts = @(
	@{ Name = 'Initialize evidence links'; Path = '.\scripts\compliance\initialize-endpoint-evidence-links.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv') },
	@{ Name = 'Generate evidence stubs'; Path = '.\scripts\compliance\generate-endpoint-evidence-stubs.ps1'; Args = @('-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv') },
	@{ Name = 'Seed evidence context'; Path = '.\scripts\compliance\seed-endpoint-evidence-context.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv') },
	@{ Name = 'Export ready-to-close report'; Path = '.\scripts\compliance\export-endpoint-ready-to-close-report.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv','-OutputDirectory','.\security-compliance\controls') },
	@{ Name = 'Close remediation items'; Path = '.\scripts\compliance\close-endpoint-remediation-items.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv') },
	@{ Name = 'Sync evidence register status'; Path = '.\scripts\compliance\sync-evidence-register-status.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv') },
	@{ Name = 'Refresh KPI'; Path = '.\scripts\compliance\refresh-endpoint-remediation-kpi.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv','-OutputPath','.\security-compliance\controls\endpoint-remediation-kpi.md') },
	@{ Name = 'Generate owner workpacks'; Path = '.\scripts\compliance\generate-owner-remediation-workpacks.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv','-OutputDirectory','.\security-compliance\controls\owner-workpacks') },
	@{ Name = 'Export remediation SLA report'; Path = '.\scripts\compliance\export-endpoint-remediation-sla-report.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-OutputDirectory','.\security-compliance\controls') },
	@{ Name = 'Generate executive summary'; Path = '.\scripts\compliance\generate-endpoint-compliance-executive-summary.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv','-ReadySummaryPath','.\security-compliance\controls\endpoint-ready-to-close-summary.md','-SlaSummaryPath','.\security-compliance\controls\endpoint-remediation-sla-summary.md','-OutputPath','.\security-compliance\controls\endpoint-compliance-executive-summary.md') },
	@{ Name = 'Export evidence completion gaps'; Path = '.\scripts\compliance\export-evidence-completion-gaps.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv','-OutputDirectory','.\security-compliance\controls') },
	@{ Name = 'Regenerate executive summary'; Path = '.\scripts\compliance\generate-endpoint-compliance-executive-summary.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv','-ReadySummaryPath','.\security-compliance\controls\endpoint-ready-to-close-summary.md','-SlaSummaryPath','.\security-compliance\controls\endpoint-remediation-sla-summary.md','-OutputPath','.\security-compliance\controls\endpoint-compliance-executive-summary.md') },
	@{ Name = 'Export owner test evidence queue'; Path = '.\scripts\compliance\export-owner-test-evidence-queue.ps1'; Args = @('-GapCsvPath','.\security-compliance\controls\endpoint-evidence-completion-gaps.csv','-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-OutputDirectory','.\security-compliance\controls') },
	@{ Name = 'Append compliance history'; Path = '.\scripts\compliance\append-endpoint-compliance-history.ps1'; Args = @('-LedgerPath','.\security-compliance\controls\endpoint-minimum-necessary-reviews.csv','-EvidenceRegisterPath','.\security-compliance\evidence\evidence-register.csv','-ReadySummaryPath','.\security-compliance\controls\endpoint-ready-to-close-summary.md','-SlaSummaryPath','.\security-compliance\controls\endpoint-remediation-sla-summary.md','-EvidenceGapCsvPath','.\security-compliance\controls\endpoint-evidence-completion-gaps.csv','-HistoryCsvPath','.\security-compliance\controls\endpoint-compliance-history.csv') },
	@{ Name = 'Generate compliance trend report'; Path = '.\scripts\compliance\generate-endpoint-compliance-trend-report.ps1'; Args = @('-HistoryCsvPath','.\security-compliance\controls\endpoint-compliance-history.csv','-OutputPath','.\security-compliance\controls\endpoint-compliance-trend.md') }
)

if ($IncludePendingEvidence) {
	$scripts[0].Args += '-IncludePending'
}

foreach ($step in $scripts) {
	Write-Host ("==> {0}" -f $step.Name)
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $step.Path @($step.Args)
	if ($LASTEXITCODE -ne 0) {
		throw "Step failed: $($step.Name)"
	}
}

if ($GenerateTestEvidenceTemplate) {
	Write-Host '==> Generate test evidence update template'
	& pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\compliance\generate-test-evidence-updates-template.ps1 -QueueCsvPath .\security-compliance\controls\endpoint-test-evidence-queue.csv -OutputPath .\security-compliance\controls\endpoint-test-evidence-updates.template.csv -Top $TemplateTop
	if ($LASTEXITCODE -ne 0) {
		throw 'Step failed: Generate test evidence update template'
	}
}

Write-Host 'Endpoint compliance cycle completed successfully.'

/*
File: IPOC_WEB.Server/Infrastructure/Configuration/PredictivePlanningOptions.cs
Blueprint Name: Configuration

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2026-07-10
Updated: 2026-07-10

Description:
Strongly typed predictive planning configuration options.

Features:
  - Feature toggle for predictive planning endpoint availability.
  - Operational model metadata settings.
  - Confidence interval and drift posture settings.

Security & Compliance:
  - Supports environment-specific model governance controls.
  - Keeps model metadata externalized from code.
*/

using System.ComponentModel.DataAnnotations;

namespace IPOC_WEB.Server.Infrastructure.Configuration;

public sealed class PredictivePlanningOptions
{
    public const string SectionName = "Agent:PredictivePlanning";

    public bool Enabled { get; set; }

    [Required]
    [MinLength(3)]
    public string ModelId { get; set; } = "predictive-demand-supply-primary";

    [Required]
    [MinLength(2)]
    public string ModelVersion { get; set; } = "1.0.0";

    public DateTimeOffset TrainedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [Range(0, 1)]
    public decimal ConfidenceIntervalLower { get; set; } = 0.80m;

    [Range(0, 1)]
    public decimal ConfidenceIntervalUpper { get; set; } = 0.95m;

    [Range(0, 1)]
    public decimal MinOperationalConfidenceLower { get; set; } = 0.75m;

    public IReadOnlyList<string> AllowedOperationalDriftStatuses { get; set; } = ["stable", "watch"];

    public bool EnforceOperationalGovernance { get; set; } = true;

    [Required]
    public string DriftStatus { get; set; } = "stable";
}

/*
File: IPOC_WEB.Server/Infrastructure/Configuration/ExternalProviderExecutivePacketAutomationOptions.cs
Blueprint Name: Configuration

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2026-07-10
Updated: 2026-07-12

Description:
Strongly typed recurring external-provider executive packet automation options.

Features:
  - Enables/disables recurring executive packet generation.
  - Controls schedule cadence and packet scope parameters.
  - Defines filesystem handoff settings for downstream transport workflows.

Security & Compliance:
  - Keeps automation scope and delivery paths externalized from code.
*/

using System.ComponentModel.DataAnnotations;

namespace IPOC_WEB.Server.Infrastructure.Configuration;

public sealed class ExternalProviderExecutivePacketAutomationOptions
{
    public const string SectionName = "Reporting:ExternalProviderExecutivePacketAutomation";

    public bool Enabled { get; set; }

    public bool RunOnStartup { get; set; } = true;

    [Range(5, 24 * 60)]
    public int IntervalMinutes { get; set; } = 60;

    [Range(1, 180)]
    public int RollingDays { get; set; } = 30;

    [Range(1, 24 * 90)]
    public int WindowHours { get; set; } = 24 * 30;

    [Range(5, 24 * 60)]
    public int BucketMinutes { get; set; } = 60;

    [Range(1, 2000)]
    public int MaxRetainedFiles { get; set; } = 180;

    public string? Provider { get; set; }

    [Required]
    public string OutputDirectory { get; set; } = Path.Combine(AppContext.BaseDirectory, "executive-packets");

    [Required]
    public ExternalProviderExecutivePacketTransportOptions Transport { get; set; } = new();

    [Required]
    public ExternalProviderExecutivePacketRetryOptions Retry { get; set; } = new();
}

public sealed class ExternalProviderExecutivePacketTransportOptions
{
    [Required]
    public string Mode { get; set; } = "None";

    public string? DistributionDirectory { get; set; }

    public string? WebhookEndpoint { get; set; }

    public string? WebhookAuthorizationHeader { get; set; }
}

public sealed class ExternalProviderExecutivePacketRetryOptions
{
    [Range(1, 10)]
    public int MaxAttempts { get; set; } = 3;

    [Range(1, 600)]
    public int InitialDelaySeconds { get; set; } = 30;

    [Range(1, 3600)]
    public int MaxDelaySeconds { get; set; } = 180;
}

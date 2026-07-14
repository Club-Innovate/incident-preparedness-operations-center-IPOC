/*
File: IPOC_WEB.Server/Infrastructure/Configuration/AzureOpenAiOptions.cs
Blueprint Name: Configuration

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2026-07-06
Updated: 2026-07-12

Description:
Strongly typed Azure OpenAI configuration options.

Features:
  - Feature toggle for Azure OpenAI integration.
  - Endpoint/model/deployment configuration placeholders.

Security & Compliance:
  - Supports externalized secret management and environment-specific configuration.
*/

using System.ComponentModel.DataAnnotations;

namespace IPOC_WEB.Server.Infrastructure.Configuration;

public sealed class AzureOpenAiOptions
{
    public const string SectionName = "AzureOpenAI";

    public bool Enabled { get; set; }

    [Url]
    public string Endpoint { get; set; } = string.Empty;

    public string Deployment { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public string ApiVersion { get; set; } = "2026-05-01";

    public string ApiKey { get; set; } = string.Empty;

    public bool UseManagedIdentity { get; set; } = true;
}

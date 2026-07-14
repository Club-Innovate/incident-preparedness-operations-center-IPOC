/*
File: IPOC_WEB.Server/Infrastructure/Configuration/AzureAiSearchOptions.cs
Blueprint Name: Configuration

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2026-07-07
Updated: 2026-07-07

Description:
Strongly typed Azure AI Search configuration options for RAG retrieval.

Features:
  - Feature toggle for Azure AI Search integration.
  - Endpoint/index/query configuration placeholders.

Security & Compliance:
  - Supports externalized secret management and environment-specific configuration.
*/

using System.ComponentModel.DataAnnotations;

namespace IPOC_WEB.Server.Infrastructure.Configuration;

public sealed class AzureAiSearchOptions
{
    public const string SectionName = "AzureAISearch";

    public bool Enabled { get; set; }

    [Url]
    public string Endpoint { get; set; } = string.Empty;

    public string ApiKey { get; set; } = string.Empty;

    public string IndexName { get; set; } = string.Empty;

    public string SemanticConfiguration { get; set; } = string.Empty;

    public string QueryType { get; set; } = "vectorSemanticHybrid";

    public bool UseManagedIdentity { get; set; } = true;

    public string DataSourceType { get; set; } = "AzureSql";
}

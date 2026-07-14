/*
File: IPOC_WEB.Server/Infrastructure/Configuration/SqlDataOptions.cs
Blueprint Name: Configuration

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-06-22

Description:
Strongly typed SQL configuration options with validation attributes.

Features:
  - Connection string reference and database naming options.
  - Data annotation validation for startup safety.

Security & Compliance:
  - Prevents missing configuration drift through fail-fast validation.
  - Supports secure externalized configuration and secret management patterns.
*/

using System.ComponentModel.DataAnnotations;

namespace IPOC_WEB.Server.Infrastructure.Configuration;

public sealed class SqlDataOptions
{
    public const string SectionName = "SqlData";

    [Required]
    public string ConnectionStringName { get; set; } = "IocEm";

    [Required]
    public string DatabaseName { get; set; } = "IOCEM";

    [Required]
    public string ConnectionMode { get; set; } = "ActiveDirectoryDefault";
}

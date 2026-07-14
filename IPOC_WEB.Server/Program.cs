/*
File: IPOC_WEB.Server/Program.cs
Blueprint Name: ApiHost

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-14

Description:
Main API composition root for IPOC_WEB server.
Configures authentication, authorization, endpoint routing, and dependency services.

Features:
  - Versioned API route groups and protected endpoint mappings.
  - JWT bearer authentication with Entra configuration support.
  - Incident and resource/bed operational API endpoints.

Security & Compliance:
  - Enforces authenticated access policies on operational endpoints.
  - Uses parameterized data-layer operations via infrastructure services.
  - Integrates with service defaults for monitoring and operational visibility.
*/

using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Collections.Concurrent;
using System.Data;
using System.Net.Mail;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.RateLimiting;
using System.Text;
using System.Text.RegularExpressions;
using Azure.Core;
using Azure.Identity;
using IPOC_WEB.Server.Infrastructure.Agent;
using IPOC_WEB.Server.Infrastructure.Configuration;
using IPOC_WEB.Server.Infrastructure.Incidents;
using IPOC_WEB.Server.Infrastructure.Alerts;
using IPOC_WEB.Server.Infrastructure.Lookups;
using IPOC_WEB.Server.Infrastructure.Security;
using IPOC_WEB.Server.Infrastructure.Resources;
using IPOC_WEB.Server.Infrastructure.Users;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();

var useRedis = builder.Configuration.GetValue("Cache:UseRedis", false);
if (useRedis)
{
    builder.AddRedisClientBuilder("cache")
        .WithOutputCache();
}
else
{
    builder.Services.AddOutputCache();
}

var startupOpenAiOptions = builder.Configuration.GetSection(AzureOpenAiOptions.SectionName).Get<AzureOpenAiOptions>() ?? new AzureOpenAiOptions();
var startupSearchOptions = builder.Configuration.GetSection(AzureAiSearchOptions.SectionName).Get<AzureAiSearchOptions>() ?? new AzureAiSearchOptions();
var startupOpenAiAuthMode = ResolveAzureAuthMode(startupOpenAiOptions.UseManagedIdentity, !string.IsNullOrWhiteSpace(startupOpenAiOptions.ApiKey), builder.Environment.IsProduction());
var startupSearchAuthMode = ResolveAzureAuthMode(startupSearchOptions.UseManagedIdentity, !string.IsNullOrWhiteSpace(startupSearchOptions.ApiKey), builder.Environment.IsProduction());
var relaxTokenValidationFlag = builder.Configuration.GetValue("AzureAd:RelaxTokenValidationForDevelopment", true);
var authorityConfigured = !string.IsNullOrWhiteSpace(builder.Configuration["AzureAd:Authority"]);
var audienceConfigured = !string.IsNullOrWhiteSpace(builder.Configuration["AzureAd:Audience"]);
var includeExceptionDetailsFlag = builder.Configuration.GetValue("Diagnostics:IncludeExceptionDetails", false);
var telemetryExporterConfigured = !string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"])
    || !string.IsNullOrWhiteSpace(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]);

if (builder.Environment.IsProduction() && !telemetryExporterConfigured)
{
    throw new InvalidOperationException("Production telemetry exporter is not configured. Set OTEL_EXPORTER_OTLP_ENDPOINT or APPLICATIONINSIGHTS_CONNECTION_STRING.");
}

if (builder.Environment.IsProduction() && relaxTokenValidationFlag)
{
    throw new InvalidOperationException("AzureAd:RelaxTokenValidationForDevelopment must be false in production.");
}

if (builder.Environment.IsProduction() && (!authorityConfigured || !audienceConfigured))
{
    throw new InvalidOperationException("AzureAd:Authority and AzureAd:Audience must be configured in production.");
}

if (builder.Environment.IsProduction() && includeExceptionDetailsFlag)
{
    throw new InvalidOperationException("Diagnostics:IncludeExceptionDetails must be false in production.");
}

builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});

static string BuildIapPrintHtml(IncidentIapPacketDto packet)
{
    static string EscapeHtml(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        return value
            .Replace("&", "&amp;", StringComparison.Ordinal)
            .Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal)
            .Replace("\"", "&quot;", StringComparison.Ordinal)
            .Replace("'", "&#39;", StringComparison.Ordinal);
    }

    static string FormatUtc(DateTimeOffset? value)
    {
        return value.HasValue
            ? value.Value.ToString("yyyy-MM-dd HH:mm:ss 'UTC'", CultureInfo.InvariantCulture)
            : "—";
    }

    var incidentNumber = EscapeHtml(packet.Ics201?.IncidentDetail.IncidentNumber ?? packet.IncidentId.ToString(CultureInfo.InvariantCulture));
    var incidentName = EscapeHtml(packet.Ics201?.IncidentDetail.IncidentName ?? "Incident");
    var objectivesHtml = packet.Ics202?.Objectives.Count > 0
        ? string.Join(string.Empty, packet.Ics202.Objectives.Select(objective => $"<li><strong>#{objective.ObjectiveNumber}</strong> {EscapeHtml(objective.ObjectiveText)} ({EscapeHtml(objective.StatusCode)})</li>"))
        : "<li>No objectives recorded.</li>";

    var assignmentsHtml = packet.Ics203?.Assignments.Count > 0
        ? string.Join(string.Empty, packet.Ics203.Assignments.Select(assignment =>
            $"<tr><td>{EscapeHtml(assignment.IcsSection)}</td><td>{EscapeHtml(assignment.PositionName)}</td><td>{EscapeHtml(assignment.AssignedUserDisplayName ?? assignment.AssignedContactName ?? "—")}</td></tr>"))
        : "<tr><td colspan=\"3\">No assignments recorded.</td></tr>";

    var commsHtml = packet.Ics205?.ActiveCommunications.Count > 0
        ? string.Join(string.Empty, packet.Ics205.ActiveCommunications.Take(50).Select(comm =>
            $"<tr><td>{EscapeHtml(FormatUtc(comm.LoggedUtc))}</td><td>{EscapeHtml(comm.ChannelCode)}</td><td>{EscapeHtml(comm.DirectionCode)}</td><td>{EscapeHtml(comm.Subject)}</td></tr>"))
        : "<tr><td colspan=\"4\">No active communications logged.</td></tr>";

    var sitrepsHtml = packet.SituationReports.Count > 0
        ? string.Join(string.Empty, packet.SituationReports.Take(25).Select(report =>
            $"<tr><td>#{report.ReportNumber}</td><td>{EscapeHtml(FormatUtc(report.ReportedUtc))}</td><td>{EscapeHtml(report.ReportedByUserDisplayName)}</td><td>{EscapeHtml(report.Summary)}</td></tr>"))
        : "<tr><td colspan=\"4\">No situation reports recorded.</td></tr>";

    var openTasks = packet.Ics209?.OpenTaskCount ?? 0;
    var activeObjectives = packet.Ics209?.ActiveObjectiveCount ?? 0;
    var activeResources = packet.Ics209?.ActiveResourceRequestCount ?? 0;
    var activeComms = packet.Ics209?.ActiveCommunicationCount ?? 0;
    var generatedUtc = EscapeHtml(FormatUtc(packet.GeneratedUtc));

    return $$"""
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>IAP Packet - {{incidentNumber}}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    h1, h2 { margin: 0 0 12px 0; }
    h2 { margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 12px; }
    .meta { font-size: 12px; color: #555; margin-bottom: 12px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:12px;"><button onclick="window.print()">Print</button></div>
  <h1>Incident Action Plan Packet</h1>
  <div class="meta">Incident: {{incidentNumber}} — {{incidentName}}</div>
  <div class="meta">Generated: {{generatedUtc}}</div>

  <h2>ICS-202 Objectives</h2>
  <ul>{{objectivesHtml}}</ul>

  <h2>ICS-203 Organization Assignments</h2>
  <table><thead><tr><th>Section</th><th>Position</th><th>Assigned To</th></tr></thead><tbody>{{assignmentsHtml}}</tbody></table>

  <h2>ICS-205 Communications Plan</h2>
  <table><thead><tr><th>Logged</th><th>Channel</th><th>Direction</th><th>Subject</th></tr></thead><tbody>{{commsHtml}}</tbody></table>

  <h2>ICS-209 Status Summary</h2>
  <div class="meta">Open Tasks: {{openTasks}} | Active Objectives: {{activeObjectives}} | Active Resources: {{activeResources}} | Active Comms: {{activeComms}}</div>

  <h2>Recent Situation Reports</h2>
  <table><thead><tr><th>Report</th><th>Reported</th><th>By</th><th>Summary</th></tr></thead><tbody>{{sitrepsHtml}}</tbody></table>
</body>
</html>
""";
}

// Add services to the container.
builder.Services.AddProblemDetails();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var authority = builder.Configuration["AzureAd:Authority"];
        var audience = builder.Configuration["AzureAd:Audience"];
        var relaxTokenValidationForDevelopment = builder.Environment.IsDevelopment()
            && builder.Configuration.GetValue("AzureAd:RelaxTokenValidationForDevelopment", true);

        if (!string.IsNullOrWhiteSpace(authority))
        {
            options.Authority = authority;

            if (TryGetTenantIdFromAuthority(authority, out var tenantId))
            {
                options.TokenValidationParameters.ValidIssuers =
                [
                    $"https://login.microsoftonline.com/{tenantId}/v2.0",
                    $"https://login.microsoftonline.com/{tenantId}/",
                    $"https://sts.windows.net/{tenantId}/"
                ];
            }
        }

        if (!string.IsNullOrWhiteSpace(audience))
        {
            var validAudiences = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                audience,
            };

            if (audience.StartsWith("api://", StringComparison.OrdinalIgnoreCase))
            {
                validAudiences.Add(audience["api://".Length..]);
            }
            else
            {
                validAudiences.Add($"api://{audience}");
            }

            options.TokenValidationParameters.ValidAudiences = validAudiences;
        }

        if (relaxTokenValidationForDevelopment)
        {
            options.TokenValidationParameters.ValidateIssuer = false;
            options.TokenValidationParameters.ValidateAudience = false;
            options.TokenValidationParameters.ValidateLifetime = false;
            options.TokenValidationParameters.ValidateIssuerSigningKey = false;
        }
        else
        {
            options.TokenValidationParameters.ValidateIssuer = true;
            options.TokenValidationParameters.ValidateAudience = true;
            options.TokenValidationParameters.ValidateLifetime = true;
            options.TokenValidationParameters.ValidateIssuerSigningKey = true;
        }

        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                var loggerFactory = context.HttpContext.RequestServices.GetService(typeof(ILoggerFactory)) as ILoggerFactory;
                loggerFactory?.CreateLogger("Security.Auth").LogWarning(
                    context.Exception,
                    "JWT authentication failed. Method={Method}; Path={Path}; TraceId={TraceId}",
                    context.Request.Method,
                    context.Request.Path,
                    context.HttpContext.TraceIdentifier);

                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                var loggerFactory = context.HttpContext.RequestServices.GetService(typeof(ILoggerFactory)) as ILoggerFactory;
                loggerFactory?.CreateLogger("Security.Auth").LogWarning(
                    "JWT challenge issued. Method={Method}; Path={Path}; Error={Error}; Description={Description}; TraceId={TraceId}",
                    context.Request.Method,
                    context.Request.Path,
                    context.Error,
                    context.ErrorDescription,
                    context.HttpContext.TraceIdentifier);

                return Task.CompletedTask;
            },
            OnForbidden = context =>
            {
                var loggerFactory = context.HttpContext.RequestServices.GetService(typeof(ILoggerFactory)) as ILoggerFactory;
                loggerFactory?.CreateLogger("Security.Auth").LogWarning(
                    "Authorization forbidden. Method={Method}; Path={Path}; TraceId={TraceId}",
                    context.Request.Method,
                    context.Request.Path,
                    context.HttpContext.TraceIdentifier);

                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization(options => AuthorizationPolicies.Configure(options));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, _) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter = Math.Ceiling(retryAfter.TotalSeconds)
                .ToString(CultureInfo.InvariantCulture);
        }

        await Results.Problem(
            title: "Too many requests.",
            detail: "Request rate limit exceeded. Please retry after a short delay.",
            statusCode: StatusCodes.Status429TooManyRequests).ExecuteAsync(context.HttpContext);
    };

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var partitionKey = context.User.Identity?.IsAuthenticated == true
            ? context.User.Identity?.Name
            : context.Connection.RemoteIpAddress?.ToString();

        partitionKey ??= "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 240,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });

    options.AddPolicy("SensitiveExportLimiter", context =>
    {
        var partitionKey = context.User.Identity?.IsAuthenticated == true
            ? context.User.Identity?.Name
            : context.Connection.RemoteIpAddress?.ToString();

        partitionKey ??= "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            $"sensitive-export:{partitionKey}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 12,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });
});
builder.Services.AddOptions<SqlDataOptions>()
    .Bind(builder.Configuration.GetSection(SqlDataOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddOptions<AzureOpenAiOptions>()
    .Bind(builder.Configuration.GetSection(AzureOpenAiOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(options => !builder.Environment.IsProduction() || !options.Enabled || options.UseManagedIdentity,
        "Azure OpenAI must use managed identity in production when enabled.")
    .Validate(options => !builder.Environment.IsProduction() || !options.Enabled || string.IsNullOrWhiteSpace(options.ApiKey),
        "Azure OpenAI API keys are not permitted in production configuration.")
    .ValidateOnStart();
builder.Services.AddOptions<AzureAiSearchOptions>()
    .Bind(builder.Configuration.GetSection(AzureAiSearchOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(options => !builder.Environment.IsProduction() || !options.Enabled || options.UseManagedIdentity,
        "Azure AI Search must use managed identity in production when enabled.")
    .Validate(options => !builder.Environment.IsProduction() || !options.Enabled || string.IsNullOrWhiteSpace(options.ApiKey),
        "Azure AI Search API keys are not permitted in production configuration.")
    .ValidateOnStart();
builder.Services.AddOptions<PredictivePlanningOptions>()
    .Bind(builder.Configuration.GetSection(PredictivePlanningOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(options => options.ConfidenceIntervalLower <= options.ConfidenceIntervalUpper, "Confidence interval lower bound must be less than or equal to upper bound.")
    .Validate(options => options.MinOperationalConfidenceLower <= options.ConfidenceIntervalLower, "Minimum operational confidence must be less than or equal to confidence interval lower bound.")
    .Validate(options => options.AllowedOperationalDriftStatuses is not null && options.AllowedOperationalDriftStatuses.Count > 0, "At least one allowed operational drift status is required.")
    .ValidateOnStart();
builder.Services.AddOptions<ExternalProviderExecutivePacketAutomationOptions>()
    .Bind(builder.Configuration.GetSection(ExternalProviderExecutivePacketAutomationOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(options => !string.IsNullOrWhiteSpace(options.OutputDirectory), "Output directory is required for executive packet automation.")
    .ValidateOnStart();
builder.Services.AddScoped<IIncidentQueryService, IncidentQueryService>();
builder.Services.AddScoped<IResourceQueryService, ResourceQueryService>();
builder.Services.AddScoped<IPredictivePlanningModelService, PredictivePlanningModelService>();
builder.Services.AddSingleton<IFhirBedAvailabilityTranslator, FhirBedAvailabilityTranslator>();
builder.Services.AddSingleton<StreamingIngestionHostedService>();
builder.Services.AddSingleton<IHostedService>(sp => sp.GetRequiredService<StreamingIngestionHostedService>());
builder.Services.AddSingleton<IStreamingIngestionControlService>(sp => sp.GetRequiredService<StreamingIngestionHostedService>());
builder.Services.AddSingleton<ExternalProviderExecutivePacketAutomationHostedService>();
builder.Services.AddSingleton<IHostedService>(sp => sp.GetRequiredService<ExternalProviderExecutivePacketAutomationHostedService>());
builder.Services.AddSingleton<IExternalProviderExecutivePacketAutomationService>(sp => sp.GetRequiredService<ExternalProviderExecutivePacketAutomationHostedService>());
builder.Services.AddScoped<ILookupQueryService, LookupQueryService>();
builder.Services.AddScoped<IUserQueryService, UserQueryService>();
builder.Services.AddScoped<IAuditEventWriter, AuditEventWriter>();
builder.Services.AddScoped<IAuditEventQueryService, AuditEventQueryService>();
builder.Services.AddScoped<IAlertQueryService, AlertQueryService>();
builder.Services.AddHttpClient();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();
var includeExceptionDetails = app.Environment.IsDevelopment()
    || (app.Environment.IsStaging() && builder.Configuration.GetValue("Diagnostics:IncludeExceptionDetails", false));

// Configure the HTTP request pipeline.
app.UseExceptionHandler(exceptionHandlerApp =>
{
    exceptionHandlerApp.Run(async context =>
    {
        var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;

        if (exception is null)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await Results.Problem(
                title: "Unexpected server error.",
                detail: "The request could not be completed.",
                statusCode: StatusCodes.Status500InternalServerError,
                extensions: new Dictionary<string, object?>
                {
                    ["traceId"] = context.TraceIdentifier,
                }).ExecuteAsync(context);
            return;
        }

        app.Logger.LogError(exception, "Unhandled exception for {Method} {Path}. TraceId: {TraceId}", context.Request.Method, context.Request.Path, context.TraceIdentifier);

        var extensions = new Dictionary<string, object?>
        {
            ["traceId"] = context.TraceIdentifier,
        };

        if (includeExceptionDetails)
        {
            extensions["exceptionType"] = exception.GetType().FullName;
            extensions["exceptionMessage"] = exception.Message;
            extensions["stackTrace"] = exception.StackTrace;
        }

        if (exception is SqlException sqlException)
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await Results.Problem(
                title: "Data service temporarily unavailable.",
                detail: includeExceptionDetails
                    ? $"SQL operation failed: {sqlException.Message}"
                    : "A required data operation could not be completed.",
                statusCode: StatusCodes.Status503ServiceUnavailable,
                extensions: extensions).ExecuteAsync(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await Results.Problem(
            title: "Unexpected server error.",
            detail: includeExceptionDetails
                ? exception.Message
                : "The request could not be completed.",
            statusCode: StatusCodes.Status500InternalServerError,
            extensions: extensions).ExecuteAsync(context);
    });
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();

app.Use(async (context, next) =>
{
    var isSensitivePath = context.Request.Path.StartsWithSegments("/api/v1/auth", StringComparison.OrdinalIgnoreCase)
        || context.Request.Path.StartsWithSegments("/api/v1/admin", StringComparison.OrdinalIgnoreCase)
        || (context.Request.Path.StartsWithSegments("/api/v1/reports", StringComparison.OrdinalIgnoreCase)
            && context.Request.Path.Value?.Contains("/export/", StringComparison.OrdinalIgnoreCase) == true)
        || context.Request.Path.Value?.Contains("/evidence/export/", StringComparison.OrdinalIgnoreCase) == true;

    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
    context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
    context.Response.Headers["Cross-Origin-Resource-Policy"] = "same-site";

    if (isSensitivePath)
    {
        context.Response.Headers["Cache-Control"] = "no-store, no-cache, max-age=0";
        context.Response.Headers["Pragma"] = "no-cache";
        context.Response.Headers["Expires"] = "0";
    }

    await next();
});

app.Use(async (context, next) =>
{
    var startedUtc = DateTimeOffset.UtcNow;
    var isSensitivePath = context.Request.Path.StartsWithSegments("/api/v1/auth", StringComparison.OrdinalIgnoreCase)
        || context.Request.Path.StartsWithSegments("/api/v1/admin", StringComparison.OrdinalIgnoreCase)
        || (context.Request.Path.StartsWithSegments("/api/v1/reports", StringComparison.OrdinalIgnoreCase)
            && context.Request.Path.Value?.Contains("/export/", StringComparison.OrdinalIgnoreCase) == true)
        || context.Request.Path.Value?.Contains("/evidence/export/", StringComparison.OrdinalIgnoreCase) == true;

    try
    {
        await next();

        if (isSensitivePath)
        {
            app.Logger.LogWarning(
                "Sensitive API request completed. Method: {Method}; Path: {Path}; StatusCode: {StatusCode}; StartedUtc: {StartedUtc}; TraceId: {TraceId}",
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                startedUtc,
                context.TraceIdentifier);
        }
        else
        {
            app.Logger.LogInformation(
                "API request completed. Method: {Method}; Path: {Path}; StatusCode: {StatusCode}; StartedUtc: {StartedUtc}; TraceId: {TraceId}",
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                startedUtc,
                context.TraceIdentifier);
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogError(
            ex,
            "API request failed. Method: {Method}; Path: {Path}; StartedUtc: {StartedUtc}; TraceId: {TraceId}",
            context.Request.Method,
            context.Request.Path,
            startedUtc,
            context.TraceIdentifier);

        throw;
    }
});

app.UseOutputCache();
app.UseRateLimiter();
app.UseAuthentication();

app.UseAuthorization();

app.Logger.LogInformation(
    "Azure AI auth mode selected. OpenAI: {OpenAiAuthMode}; Search: {SearchAuthMode}; Environment: {EnvironmentName}; ProductionMIOverride: {ProductionMIOverride}",
    startupOpenAiAuthMode,
    startupSearchAuthMode,
    app.Environment.EnvironmentName,
    app.Environment.IsProduction());

var apiV1 = app.MapGroup("/api/v1");
var generatedVisualizationSpecMeter = new Meter("IPOC_WEB.Server.GeneratedVisualizationSpec", "1.0.0");
var generatedVisualizationSpecNormalizedCounter = generatedVisualizationSpecMeter.CreateCounter<long>(
    "generated_visualization_spec_normalized_total",
    unit: "count",
    description: "Number of generated visualization preset payloads normalized by injecting missing version fields.");
var dataOpsCooldownByOperation = new ConcurrentDictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);
var providerCooldownByOperation = new ConcurrentDictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);
var providerTelemetryByName = new ConcurrentDictionary<string, ExternalProviderTelemetry>(StringComparer.OrdinalIgnoreCase);
var providerTelemetryHistory = new ConcurrentQueue<ExternalProviderTelemetryEvent>();
var externalProviderTelemetryHistoryMax = Math.Clamp(
    app.Configuration.GetValue("ExternalProviders:Telemetry:MaxEvents", 5000),
    250,
    50000);
var externalProviderTelemetryPersistToFile = app.Configuration.GetValue("ExternalProviders:Telemetry:PersistToFile", true);
var externalProviderTelemetryDirectory = app.Configuration.GetValue(
    "ExternalProviders:Telemetry:Directory",
    Path.Combine(AppContext.BaseDirectory, "telemetry"));
var externalProviderTelemetryFilePath = Path.Combine(externalProviderTelemetryDirectory, "external-provider-health-history.jsonl");
var externalProviderTelemetryFileLock = new object();
var externalProviderTelemetryArchiveDirectory = app.Configuration.GetValue(
    "ExternalProviders:Telemetry:ArchiveDirectory",
    Path.Combine(externalProviderTelemetryDirectory, "archive"));
var externalProviderTelemetryRotateMaxBytes = Math.Max(
    app.Configuration.GetValue("ExternalProviders:Telemetry:RotateMaxFileSizeBytes", 10 * 1024 * 1024),
    1_024 * 1_024);
var externalProviderTelemetryPersistToSql = app.Configuration.GetValue("ExternalProviders:Telemetry:PersistToSql", false);
var externalProviderTelemetrySqlRetentionDays = Math.Clamp(
    app.Configuration.GetValue("ExternalProviders:Telemetry:SqlRetentionDays", 30),
    1,
    3650);
var predictivePlanningOptions = app.Configuration.GetSection(PredictivePlanningOptions.SectionName).Get<PredictivePlanningOptions>() ?? new PredictivePlanningOptions();
var predictivePlanningEnabled = predictivePlanningOptions.Enabled;
var externalProviderTelemetrySqlConnectionString = externalProviderTelemetryPersistToSql
    ? app.Configuration.GetConnectionString("IocEm")
    : null;
var externalProviderTelemetryEnvironmentName = app.Configuration.GetValue("ExternalProviders:Telemetry:EnvironmentName", app.Environment.EnvironmentName ?? "Unknown");
var externalProviderCircuitFailureThreshold = Math.Clamp(
    app.Configuration.GetValue("ExternalProviders:CircuitBreaker:FailureThreshold", 3),
    1,
    20);
var externalProviderCircuitDurationSeconds = Math.Clamp(
    app.Configuration.GetValue("ExternalProviders:CircuitBreaker:OpenDurationSeconds", 60),
    5,
    600);
var externalProviderCircuitDuration = TimeSpan.FromSeconds(externalProviderCircuitDurationSeconds);
var copLiveOverlayProvider = app.Configuration.GetValue("CopLiveOverlay:Provider", "Simulated");

if (externalProviderTelemetryPersistToFile)
{
    var persistedProviderEvents = LoadPersistedProviderTelemetryEvents(externalProviderTelemetryFilePath, externalProviderTelemetryHistoryMax);
    foreach (var persistedProviderEvent in persistedProviderEvents)
    {
        providerTelemetryHistory.Enqueue(persistedProviderEvent);
    }

    RebuildProviderTelemetryState(
        providerTelemetryByName,
        providerTelemetryHistory,
        externalProviderCircuitFailureThreshold,
        externalProviderCircuitDuration,
        DateTimeOffset.UtcNow);

    app.Logger.LogInformation(
        "Loaded {PersistedEventCount} persisted external provider telemetry events from {TelemetryPath}.",
        persistedProviderEvents.Count,
        externalProviderTelemetryFilePath);
}

apiV1.MapGet("system/readiness", (IConfiguration configuration, IHostEnvironment environment) =>
{
    var hasSqlConnection = !string.IsNullOrWhiteSpace(configuration.GetConnectionString("IocEm"));
    var degradedReadFallbackEnabled = environment.IsDevelopment()
        && configuration.GetValue("SqlData:EnableDegradedReadFallback", true);
    var cacheUseRedis = configuration.GetValue("Cache:UseRedis", false);
    var adminDataOpsScriptExecutionEnabled = environment.IsDevelopment()
        && configuration.GetValue("AdminDataOps:EnableScriptExecution", false);

    return Results.Ok(new SystemReadiness(
        "Healthy",
        environment.EnvironmentName,
        hasSqlConnection,
        degradedReadFallbackEnabled,
        cacheUseRedis,
        adminDataOpsScriptExecutionEnabled,
        DateTimeOffset.UtcNow));
})
.WithName("GetSystemReadiness");

apiV1.MapGet("system/external-provider-health", () =>
{
    var now = DateTimeOffset.UtcNow;
    var providers = providerTelemetryByName
        .OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
        .Select(item => new
        {
            provider = item.Key,
            circuitState = GetProviderCircuitState(item.Value, externalProviderCircuitFailureThreshold, now),
            item.Value.CircuitOpenedUntilUtc,
            retryAfterSeconds = item.Value.CircuitOpenedUntilUtc.HasValue && item.Value.CircuitOpenedUntilUtc.Value > now
                ? Math.Max(0, (int)Math.Ceiling((item.Value.CircuitOpenedUntilUtc.Value - now).TotalSeconds))
                : 0,
            item.Value.SuccessCount,
            item.Value.FailureCount,
            item.Value.ConsecutiveFailures,
            item.Value.LastSuccessUtc,
            item.Value.LastFailureUtc,
            item.Value.LastError
        })
        .ToArray();

    return Results.Ok(new
    {
        status = providers.Any(provider => provider.circuitState is "open" or "half-open") ? "Degraded" : "Healthy",
        policy = new
        {
            failureThreshold = externalProviderCircuitFailureThreshold,
            openDurationSeconds = externalProviderCircuitDurationSeconds
        },
        providers,
        checkedUtc = now
    });
})
.WithName("GetExternalProviderHealth");

apiV1.MapGet("system/external-provider-health/history", (string? provider, int? take) =>
{
    var normalizedTake = Math.Clamp(take ?? 50, 1, 200);
    var filtered = providerTelemetryHistory
        .Where(item => string.IsNullOrWhiteSpace(provider) || string.Equals(item.Provider, provider, StringComparison.OrdinalIgnoreCase))
        .OrderByDescending(item => item.EventUtc)
        .Take(normalizedTake)
        .ToArray();

    return Results.Ok(new
    {
        provider = string.IsNullOrWhiteSpace(provider) ? null : provider,
        take = normalizedTake,
        total = filtered.Length,
        events = filtered
    });
})
.WithName("GetExternalProviderHealthHistory");

apiV1.MapGet("system/external-provider-health/history/warehouse", async (
    IConfiguration configuration,
    string? environment,
    string? provider,
    int? take,
    CancellationToken cancellationToken) =>
{
    var normalizedTake = Math.Clamp(take ?? 200, 1, 5000);
    var connectionString = configuration.GetConnectionString("IocEm");

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            title: "Telemetry warehouse is not configured.",
            detail: "Connection string 'IocEm' is missing.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    const string sql = """
        SELECT TOP (@take)
            Provider,
            EventType,
            Detail,
            EventUtc,
            RecordedUtc,
            ISNULL(NULLIF(EnvironmentName, N''), N'Unknown') AS EnvironmentName
        FROM ops.ExternalProviderTelemetryEvent
        WHERE (@environment IS NULL OR ISNULL(NULLIF(EnvironmentName, N''), N'Unknown') = @environment)
          AND (@provider IS NULL OR Provider = @provider)
        ORDER BY EventUtc DESC, ExternalProviderTelemetryEventId DESC;
        """;

    var events = new List<object>(normalizedTake);

    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);

    await using var command = new SqlCommand(sql, connection)
    {
        CommandType = CommandType.Text,
        CommandTimeout = 30,
    };

    command.Parameters.Add(new SqlParameter("@take", SqlDbType.Int) { Value = normalizedTake });
    command.Parameters.Add(new SqlParameter("@environment", SqlDbType.NVarChar, 80)
    {
        Value = string.IsNullOrWhiteSpace(environment) ? DBNull.Value : environment.Trim()
    });
    command.Parameters.Add(new SqlParameter("@provider", SqlDbType.NVarChar, 120)
    {
        Value = string.IsNullOrWhiteSpace(provider) ? DBNull.Value : provider.Trim()
    });

    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
    {
        events.Add(new
        {
            provider = reader.GetString(0),
            eventType = reader.GetString(1),
            detail = reader.IsDBNull(2) ? null : reader.GetString(2),
            eventUtc = reader.GetFieldValue<DateTimeOffset>(3),
            recordedUtc = reader.GetFieldValue<DateTimeOffset>(4),
            environment = reader.IsDBNull(5) ? "Unknown" : reader.GetString(5)
        });
    }

    return Results.Ok(new
    {
        environment = string.IsNullOrWhiteSpace(environment) ? null : environment.Trim(),
        provider = string.IsNullOrWhiteSpace(provider) ? null : provider.Trim(),
        take = normalizedTake,
        total = events.Count,
        events
    });
})
.WithName("GetExternalProviderHealthHistoryWarehouse");

apiV1.MapGet("system/external-provider-health/federation/summary", async (
    IConfiguration configuration,
    int? windowHours,
    CancellationToken cancellationToken) =>
{
    var normalizedWindowHours = Math.Clamp(windowHours ?? 24 * 30, 1, 24 * 365);
    var connectionString = configuration.GetConnectionString("IocEm");

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            title: "Telemetry federation is not configured.",
            detail: "Connection string 'IocEm' is missing.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    const string sql = """
        SELECT
            ISNULL(NULLIF(EnvironmentName, N''), N'Unknown') AS EnvironmentName,
            Provider,
            EventType,
            EventUtc
        FROM ops.ExternalProviderTelemetryEvent
        WHERE EventUtc >= DATEADD(HOUR, -@windowHours, SYSUTCDATETIME());
        """;

    var rows = new List<(string EnvironmentName, string Provider, string EventType, DateTimeOffset EventUtc)>();

    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);

    await using var command = new SqlCommand(sql, connection)
    {
        CommandType = CommandType.Text,
        CommandTimeout = 30,
    };
    command.Parameters.Add(new SqlParameter("@windowHours", SqlDbType.Int) { Value = normalizedWindowHours });

    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
    {
        rows.Add((
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetFieldValue<DateTimeOffset>(3)));
    }

    var environmentSummary = rows
        .GroupBy(item => item.EnvironmentName, StringComparer.OrdinalIgnoreCase)
        .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)
        .Select(group =>
        {
            var success = group.Count(item => string.Equals(item.EventType, "success", StringComparison.OrdinalIgnoreCase));
            var failure = group.Count(item => string.Equals(item.EventType, "failure", StringComparison.OrdinalIgnoreCase));
            var bypass = group.Count(item => string.Equals(item.EventType, "bypass", StringComparison.OrdinalIgnoreCase));
            var total = success + failure + bypass;
            var failureRate = total == 0 ? 0m : Math.Round((decimal)failure / total, 4);

            var providers = group
                .GroupBy(item => item.Provider, StringComparer.OrdinalIgnoreCase)
                .OrderBy(providerGroup => providerGroup.Key, StringComparer.OrdinalIgnoreCase)
                .Select(providerGroup =>
                {
                    var providerSuccess = providerGroup.Count(item => string.Equals(item.EventType, "success", StringComparison.OrdinalIgnoreCase));
                    var providerFailure = providerGroup.Count(item => string.Equals(item.EventType, "failure", StringComparison.OrdinalIgnoreCase));
                    var providerBypass = providerGroup.Count(item => string.Equals(item.EventType, "bypass", StringComparison.OrdinalIgnoreCase));
                    var providerTotal = providerSuccess + providerFailure + providerBypass;
                    var providerFailureRate = providerTotal == 0 ? 0m : Math.Round((decimal)providerFailure / providerTotal, 4);

                    return new
                    {
                        provider = providerGroup.Key,
                        successCount = providerSuccess,
                        failureCount = providerFailure,
                        bypassCount = providerBypass,
                        totalCount = providerTotal,
                        failureRate = providerFailureRate,
                        lastEventUtc = providerGroup.Max(item => item.EventUtc)
                    };
                })
                .ToArray();

            return new
            {
                environment = group.Key,
                successCount = success,
                failureCount = failure,
                bypassCount = bypass,
                totalCount = total,
                failureRate,
                providerCount = providers.Length,
                providers
            };
        })
        .ToArray();

    return Results.Ok(new
    {
        windowHours = normalizedWindowHours,
        environmentCount = environmentSummary.Length,
        environments = environmentSummary,
        checkedUtc = DateTimeOffset.UtcNow
    });
})
.WithName("GetExternalProviderHealthFederationSummary");

apiV1.MapGet("system/external-provider-health/trends", (string? provider, int? windowHours, int? bucketMinutes) =>
{
    var now = DateTimeOffset.UtcNow;
    var normalizedWindowHours = Math.Clamp(windowHours ?? 24, 1, 24 * 30);
    var normalizedBucketMinutes = Math.Clamp(bucketMinutes ?? 60, 5, 24 * 60);
    var windowStartUtc = now.AddHours(-normalizedWindowHours);
    var bucketSpan = TimeSpan.FromMinutes(normalizedBucketMinutes);

    var events = providerTelemetryHistory
        .Where(item => item.EventUtc >= windowStartUtc
            && (string.IsNullOrWhiteSpace(provider) || string.Equals(item.Provider, provider, StringComparison.OrdinalIgnoreCase)))
        .OrderBy(item => item.EventUtc)
        .ToArray();

    var bucketCount = Math.Max(1, (int)Math.Ceiling(TimeSpan.FromHours(normalizedWindowHours).TotalMinutes / normalizedBucketMinutes));
    var bucketIndexMap = new Dictionary<int, List<ExternalProviderTelemetryEvent>>();

    foreach (var item in events)
    {
        var rawIndex = (int)Math.Floor((item.EventUtc - windowStartUtc).TotalMinutes / normalizedBucketMinutes);
        var index = Math.Clamp(rawIndex, 0, bucketCount - 1);
        if (!bucketIndexMap.TryGetValue(index, out var list))
        {
            list = [];
            bucketIndexMap[index] = list;
        }

        list.Add(item);
    }

    var buckets = Enumerable.Range(0, bucketCount)
        .Select(index =>
        {
            var bucketStartUtc = windowStartUtc.AddMinutes(index * normalizedBucketMinutes);
            var bucketEndUtc = bucketStartUtc.Add(bucketSpan);
            if (bucketEndUtc > now)
            {
                bucketEndUtc = now;
            }

            bucketIndexMap.TryGetValue(index, out var bucketEvents);
            bucketEvents ??= [];

            var successCount = bucketEvents.Count(item => string.Equals(item.EventType, "success", StringComparison.OrdinalIgnoreCase));
            var failureCount = bucketEvents.Count(item => string.Equals(item.EventType, "failure", StringComparison.OrdinalIgnoreCase));
            var bypassCount = bucketEvents.Count(item => string.Equals(item.EventType, "bypass", StringComparison.OrdinalIgnoreCase));
            var total = successCount + failureCount + bypassCount;
            var failureRate = total == 0 ? 0m : Math.Round((decimal)failureCount / total, 4);

            return new
            {
                bucketStartUtc,
                bucketEndUtc,
                successCount,
                failureCount,
                bypassCount,
                total,
                failureRate
            };
        })
        .ToArray();

    var providerSummary = events
        .GroupBy(item => item.Provider, StringComparer.OrdinalIgnoreCase)
        .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)
        .Select(group =>
        {
            var successCount = group.Count(item => string.Equals(item.EventType, "success", StringComparison.OrdinalIgnoreCase));
            var failureCount = group.Count(item => string.Equals(item.EventType, "failure", StringComparison.OrdinalIgnoreCase));
            var bypassCount = group.Count(item => string.Equals(item.EventType, "bypass", StringComparison.OrdinalIgnoreCase));
            var total = successCount + failureCount + bypassCount;
            var failureRate = total == 0 ? 0m : Math.Round((decimal)failureCount / total, 4);

            return new
            {
                provider = group.Key,
                successCount,
                failureCount,
                bypassCount,
                total,
                failureRate,
                lastEventUtc = group.Max(item => item.EventUtc)
            };
        })
        .ToArray();

    var totalSuccess = providerSummary.Sum(item => item.successCount);
    var totalFailure = providerSummary.Sum(item => item.failureCount);
    var totalBypass = providerSummary.Sum(item => item.bypassCount);
    var totalEvents = totalSuccess + totalFailure + totalBypass;

    return Results.Ok(new
    {
        provider = string.IsNullOrWhiteSpace(provider) ? null : provider,
        window = new
        {
            hours = normalizedWindowHours,
            bucketMinutes = normalizedBucketMinutes,
            startUtc = windowStartUtc,
            endUtc = now,
        },
        totals = new
        {
            success = totalSuccess,
            failure = totalFailure,
            bypass = totalBypass,
            events = totalEvents,
            failureRate = totalEvents == 0 ? 0m : Math.Round((decimal)totalFailure / totalEvents, 4),
        },
        providerSummary,
        buckets,
        checkedUtc = now,
    });
})
.WithName("GetExternalProviderHealthTrends");

apiV1.MapPost("system/external-provider-health/alerts/evaluate", async (
    ClaimsPrincipal user,
    IAlertQueryService alertQueryService,
    IUserQueryService userQueryService,
    string? provider,
    int? windowHours,
    int? minEventCount,
    decimal? failureRateThreshold,
    CancellationToken cancellationToken) =>
{
    var resolvedUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (resolvedUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var alertEvaluationCooldown = TryAcquireDataOpsCooldown(
        providerCooldownByOperation,
        "EXTERNAL_PROVIDER_ALERT_EVALUATION",
        TimeSpan.FromSeconds(30));

    if (!alertEvaluationCooldown.Allowed)
    {
        return Results.Ok(new
        {
            evaluated = false,
            reason = "CooldownActive",
            retryAfterSeconds = alertEvaluationCooldown.RetryAfterSeconds,
            createdAlertIds = Array.Empty<long>()
        });
    }

    var normalizedWindowHours = Math.Clamp(windowHours ?? app.Configuration.GetValue("ExternalProviders:Alerts:DefaultWindowHours", 24), 1, 24 * 30);
    var normalizedMinEventCount = Math.Clamp(minEventCount ?? app.Configuration.GetValue("ExternalProviders:Alerts:MinEventCount", 20), 1, 5000);
    var normalizedFailureRateThreshold = Math.Clamp(failureRateThreshold ?? app.Configuration.GetValue("ExternalProviders:Alerts:FailureRateThreshold", 0.25m), 0.01m, 1m);
    var windowStartUtc = DateTimeOffset.UtcNow.AddHours(-normalizedWindowHours);

    var candidates = providerTelemetryHistory
        .Where(item => item.EventUtc >= windowStartUtc
            && (string.IsNullOrWhiteSpace(provider) || string.Equals(item.Provider, provider, StringComparison.OrdinalIgnoreCase)))
        .GroupBy(item => item.Provider, StringComparer.OrdinalIgnoreCase)
        .Select(group =>
        {
            var successCount = group.Count(item => string.Equals(item.EventType, "success", StringComparison.OrdinalIgnoreCase));
            var failureCount = group.Count(item => string.Equals(item.EventType, "failure", StringComparison.OrdinalIgnoreCase));
            var bypassCount = group.Count(item => string.Equals(item.EventType, "bypass", StringComparison.OrdinalIgnoreCase));
            var total = successCount + failureCount + bypassCount;
            var failureRate = total == 0 ? 0m : Math.Round((decimal)failureCount / total, 4);

            return new
            {
                provider = group.Key,
                successCount,
                failureCount,
                bypassCount,
                total,
                failureRate,
                breached = total >= normalizedMinEventCount && failureRate >= normalizedFailureRateThreshold
            };
        })
        .Where(item => item.breached)
        .OrderByDescending(item => item.failureRate)
        .ToArray();

    var createdAlertIds = new List<long>();

    foreach (var breach in candidates)
    {
        var alertId = await alertQueryService.CreateUiAlertAsync(
            resolvedUserId.Value,
            new CreateUiAlertRequestDto(
                Message: $"External provider {breach.provider} breached failure threshold ({(breach.failureRate * 100m):0.##}% failures over {breach.total} events in last {normalizedWindowHours}h; threshold {(normalizedFailureRateThreshold * 100m):0.##}% / min events {normalizedMinEventCount}).",
                Variant: "warning",
                Source: "system",
                Status: "new"),
            cancellationToken);

        createdAlertIds.Add(alertId);
    }

    return Results.Ok(new
    {
        evaluated = true,
        provider = string.IsNullOrWhiteSpace(provider) ? null : provider,
        windowHours = normalizedWindowHours,
        minEventCount = normalizedMinEventCount,
        failureRateThreshold = normalizedFailureRateThreshold,
        breaches = candidates,
        createdAlertIds,
        checkedUtc = DateTimeOffset.UtcNow
    });
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("EvaluateExternalProviderHealthAlerts");

apiV1.MapGet("system/external-provider-health/storage", () =>
{
    var fileExists = File.Exists(externalProviderTelemetryFilePath);
    var fileSizeBytes = fileExists ? new FileInfo(externalProviderTelemetryFilePath).Length : 0;
    var rotationThresholdReached = fileExists && fileSizeBytes >= externalProviderTelemetryRotateMaxBytes;
    var percentOfThreshold = externalProviderTelemetryRotateMaxBytes <= 0
        ? 0m
        : Math.Round((decimal)fileSizeBytes / externalProviderTelemetryRotateMaxBytes * 100m, 2);

    return Results.Ok(new
    {
        persistToFile = externalProviderTelemetryPersistToFile,
        filePath = externalProviderTelemetryFilePath,
        fileExists,
        fileSizeBytes,
        persistToSql = externalProviderTelemetryPersistToSql,
        sqlRetentionDays = externalProviderTelemetrySqlRetentionDays,
        inMemoryEventCount = providerTelemetryHistory.Count,
        inMemoryMaxEvents = externalProviderTelemetryHistoryMax,
        rotation = new
        {
            archiveDirectory = externalProviderTelemetryArchiveDirectory,
            maxFileSizeBytes = externalProviderTelemetryRotateMaxBytes,
            percentOfThreshold,
            thresholdReached = rotationThresholdReached,
            status = rotationThresholdReached ? "RotateRecommended" : "Healthy"
        },
        checkedUtc = DateTimeOffset.UtcNow
    });
})
.WithName("GetExternalProviderHealthStorageStatus");

apiV1.MapPost("system/external-provider-health/storage/rotate", () =>
{
    if (!externalProviderTelemetryPersistToFile)
    {
        return Results.Ok(new TelemetryRotationResult(
            Succeeded: false,
            Attempted: false,
            ArchiveFilePath: null,
            SourceFileBytes: 0,
            Message: "File persistence is disabled; rotation is not applicable.",
            ExecutedUtc: DateTimeOffset.UtcNow));
    }

    var rotation = RotatePersistedProviderTelemetryFile(
        externalProviderTelemetryFilePath,
        externalProviderTelemetryArchiveDirectory,
        externalProviderTelemetryRotateMaxBytes,
        externalProviderTelemetryFileLock);

    return Results.Ok(rotation);
})
.WithName("RotateExternalProviderHealthStorage");

apiV1.MapGet("agent/config/health", (
    IHostEnvironment environment,
    Microsoft.Extensions.Options.IOptions<AzureOpenAiOptions> azureOpenAiOptions,
    Microsoft.Extensions.Options.IOptions<AzureAiSearchOptions> azureAiSearchOptions) =>
{
    var openAi = azureOpenAiOptions.Value;
    var search = azureAiSearchOptions.Value;
    var openAiAuthMode = ResolveAzureAuthMode(openAi.UseManagedIdentity, !string.IsNullOrWhiteSpace(openAi.ApiKey), environment.IsProduction());
    var searchAuthMode = ResolveAzureAuthMode(search.UseManagedIdentity, !string.IsNullOrWhiteSpace(search.ApiKey), environment.IsProduction());

    var openAiConfigured = openAi.Enabled
        && !string.IsNullOrWhiteSpace(openAi.Endpoint)
        && !string.IsNullOrWhiteSpace(openAi.Deployment)
        && openAiAuthMode != AzureServiceAuthMode.None;

    var searchConfigured = search.Enabled
        && !string.IsNullOrWhiteSpace(search.Endpoint)
        && !string.IsNullOrWhiteSpace(search.IndexName)
        && searchAuthMode != AzureServiceAuthMode.None;

    var overallStatus = openAiConfigured && searchConfigured
        ? "Healthy"
        : "ConfigurationRequired";

    return Results.Ok(new AgentConfigHealth(
        overallStatus,
        environment.EnvironmentName,
        openAi.Enabled,
        openAiConfigured,
        openAi.Endpoint,
        openAi.Deployment,
        openAi.ApiVersion,
        openAi.UseManagedIdentity,
        search.Enabled,
        searchConfigured,
        search.Endpoint,
        search.IndexName,
        search.SemanticConfiguration,
        search.QueryType,
        search.DataSourceType,
        search.UseManagedIdentity,
        openAiAuthMode.ToString(),
        searchAuthMode.ToString(),
        DateTimeOffset.UtcNow));
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("GetAgentConfigHealth");

var connectivityEndpoint = apiV1.MapGet("agent/config/connectivity", async (
    IHostEnvironment environment,
    Microsoft.Extensions.Options.IOptions<AzureOpenAiOptions> azureOpenAiOptions,
    Microsoft.Extensions.Options.IOptions<AzureAiSearchOptions> azureAiSearchOptions,
    IHttpClientFactory httpClientFactory,
    CancellationToken cancellationToken) =>
{
    var openAi = azureOpenAiOptions.Value;
    var search = azureAiSearchOptions.Value;
    var openAiAuthMode = ResolveAzureAuthMode(openAi.UseManagedIdentity, !string.IsNullOrWhiteSpace(openAi.ApiKey), environment.IsProduction());
    var searchAuthMode = ResolveAzureAuthMode(search.UseManagedIdentity, !string.IsNullOrWhiteSpace(search.ApiKey), environment.IsProduction());

    var searchConnected = false;
    var searchError = string.Empty;
    var openAiConnected = false;
    var openAiError = string.Empty;
    string? openAiActiveDeployment = null;

    var client = httpClientFactory.CreateClient();

    if (search.Enabled)
    {
        try
        {
            await ProbeAzureSearchConnectivityAsync(client, search, searchAuthMode, cancellationToken);
            searchConnected = true;
        }
        catch (Exception ex)
        {
            searchError = ex.Message;
        }
    }
    else
    {
        searchError = "Azure AI Search is disabled in configuration.";
    }

    if (openAi.Enabled)
    {
        try
        {
            openAiActiveDeployment = await ProbeAzureOpenAiConnectivityAsync(client, openAi, openAiAuthMode, cancellationToken);
            openAiConnected = true;
        }
        catch (Exception ex)
        {
            openAiError = ex.Message;
        }
    }
    else
    {
        openAiError = "Azure OpenAI is disabled in configuration.";
    }

    var status = searchConnected && openAiConnected
        ? "Healthy"
        : "ConnectivityFailure";

    return Results.Ok(new AgentConnectivityHealth(
        status,
        environment.EnvironmentName,
        openAiConnected,
        openAiError,
        openAiAuthMode.ToString(),
        openAiActiveDeployment,
        searchConnected,
        searchError,
        searchAuthMode.ToString(),
        DateTimeOffset.UtcNow));
})
.WithName("GetAgentConnectivityHealth");

if (app.Environment.IsDevelopment())
{
    connectivityEndpoint.AllowAnonymous();
}
else
{
    connectivityEndpoint.RequireAuthorization(AuthorizationPolicies.ResourceReporter);
}

var ragSmokeEndpoint = apiV1.MapPost("agent/debug/rag-smoke", async (
    AgentRagSmokeRequestDto? request,
    IHostEnvironment environment,
    Microsoft.Extensions.Options.IOptions<AzureOpenAiOptions> azureOpenAiOptions,
    Microsoft.Extensions.Options.IOptions<AzureAiSearchOptions> azureAiSearchOptions,
    IHttpClientFactory httpClientFactory,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    var prompt = string.IsNullOrWhiteSpace(request?.Prompt)
        ? "Based on our indexed data, what are the top 5 open items right now?"
        : request!.Prompt.Trim();

    var openAi = azureOpenAiOptions.Value;
    var search = azureAiSearchOptions.Value;
    var openAiAuthMode = ResolveAzureAuthMode(openAi.UseManagedIdentity, !string.IsNullOrWhiteSpace(openAi.ApiKey), environment.IsProduction());
    var searchAuthMode = ResolveAzureAuthMode(search.UseManagedIdentity, !string.IsNullOrWhiteSpace(search.ApiKey), environment.IsProduction());

    var openAiConfigured = openAi.Enabled
        && !string.IsNullOrWhiteSpace(openAi.Endpoint)
        && !string.IsNullOrWhiteSpace(openAi.Deployment)
        && openAiAuthMode != AzureServiceAuthMode.None;

    var searchConfigured = search.Enabled
        && !string.IsNullOrWhiteSpace(search.Endpoint)
        && !string.IsNullOrWhiteSpace(search.IndexName)
        && searchAuthMode != AzureServiceAuthMode.None;

    logger.LogInformation(
        "RAG smoke test started. PromptLength={PromptLength}, OpenAiConfigured={OpenAiConfigured}, SearchConfigured={SearchConfigured}, OpenAiDeployment={OpenAiDeployment}, SearchIndex={SearchIndex}",
        prompt.Length,
        openAiConfigured,
        searchConfigured,
        openAi.Deployment,
        search.IndexName);

    var searchConnected = false;
    var openAiConnected = false;
    string searchError = string.Empty;
    string openAiError = string.Empty;
    string contextBlock = string.Empty;
    IReadOnlyList<string> groundedSources = [];
    IReadOnlyList<AgentCitationDto> citations = [];
    string generatedText = string.Empty;

    var client = httpClientFactory.CreateClient();

    if (!searchConfigured)
    {
        searchError = "Azure AI Search configuration is incomplete.";
        logger.LogWarning("RAG smoke test: {Error}", searchError);
    }
    else
    {
        try
        {
            var searchResult = await QueryAzureAiSearchAsync(client, search, prompt, searchAuthMode, cancellationToken);
            searchConnected = true;
            contextBlock = searchResult.ContextBlock;
            groundedSources = searchResult.Sources;
            citations = searchResult.Citations;

            logger.LogInformation(
                "RAG smoke test search succeeded. ContextLength={ContextLength}, SourceCount={SourceCount}, CitationCount={CitationCount}",
                contextBlock.Length,
                groundedSources.Count,
                citations.Count);
        }
        catch (Exception ex)
        {
            searchError = ex.ToString();
            logger.LogError(ex, "RAG smoke test search failed.");
            searchError = "Search request failed. Check server logs with traceId for details.";
        }
    }

    if (!openAiConfigured)
    {
        openAiError = "Azure OpenAI configuration is incomplete.";
        logger.LogWarning("RAG smoke test: {Error}", openAiError);
    }
    else
    {
        try
        {
            generatedText = await GenerateAzureOpenAiChatCompletionAsync(client, openAi, prompt, contextBlock, openAiAuthMode, cancellationToken);
            openAiConnected = true;

            logger.LogInformation(
                "RAG smoke test OpenAI succeeded. ResponseLength={ResponseLength}, UsedContext={UsedContext}",
                generatedText.Length,
                !string.IsNullOrWhiteSpace(contextBlock));
        }
        catch (Exception ex)
        {
            openAiError = ex.ToString();
            logger.LogError(ex, "RAG smoke test OpenAI failed.");
            openAiError = "OpenAI request failed. Check server logs with traceId for details.";
        }
    }

    var status = searchConnected && openAiConnected && !string.IsNullOrWhiteSpace(contextBlock)
        ? "Grounded"
        : searchConnected && openAiConnected
            ? "ConnectedNoContext"
            : "Failure";

    var responsePreview = string.IsNullOrWhiteSpace(generatedText)
        ? string.Empty
        : generatedText[..Math.Min(generatedText.Length, 600)];

    return Results.Ok(new
    {
        status,
        prompt,
        environment = environment.EnvironmentName,
        search = new
        {
            configured = searchConfigured,
            connected = searchConnected,
            authMode = searchAuthMode.ToString(),
            endpoint = search.Endpoint,
            indexName = search.IndexName,
            sourceCount = groundedSources.Count,
            citationCount = citations.Count,
            contextLength = contextBlock.Length,
            error = searchError
        },
        openAi = new
        {
            configured = openAiConfigured,
            connected = openAiConnected,
            authMode = openAiAuthMode.ToString(),
            endpoint = openAi.Endpoint,
            deployment = openAi.Deployment,
            apiVersion = openAi.ApiVersion,
            model = openAi.Model,
            responseLength = generatedText.Length,
            responsePreview,
            error = openAiError
        },
        checkedUtc = DateTimeOffset.UtcNow
    });
})
.WithName("RunAgentRagSmokeTest");

if (app.Environment.IsDevelopment())
{
    ragSmokeEndpoint.AllowAnonymous();
}
else
{
    ragSmokeEndpoint.RequireAuthorization(AuthorizationPolicies.ResourceReporter);
}

apiV1.MapGet("weatherforecast", async (
    long? incidentId,
    long? locationId,
    long? defaultLocationId,
    string? city,
    string? state,
    string? postalCode,
    string? defaultCity,
    string? defaultState,
    string? defaultPostalCode,
    IHttpClientFactory httpClientFactory,
    IIncidentQueryService incidentQueryService,
    ILookupQueryService lookupQueryService,
    CancellationToken cancellationToken) =>
{
    static string? NormalizeWeatherText(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    WeatherLocationResolution weatherContext;
    try
    {
        weatherContext = await ResolveWeatherLocationContextAsync(
            incidentId,
            locationId,
            defaultLocationId,
            city,
            state,
            postalCode,
            defaultCity,
            defaultState,
            defaultPostalCode,
            incidentQueryService,
            lookupQueryService,
            cancellationToken);
    }
    catch
    {
        weatherContext = new WeatherLocationResolution(
            incidentId,
            locationId ?? defaultLocationId,
            null,
            NormalizeWeatherText(city) ?? NormalizeWeatherText(defaultCity),
            NormalizeWeatherText(state) ?? NormalizeWeatherText(defaultState),
            NormalizeWeatherText(postalCode) ?? NormalizeWeatherText(defaultPostalCode),
            null,
            null);
    }

    var effectiveLatitude = weatherContext.Latitude;
    var effectiveLongitude = weatherContext.Longitude;

    if ((!effectiveLatitude.HasValue || !effectiveLongitude.HasValue)
        && (!string.IsNullOrWhiteSpace(weatherContext.LocationName)
            || !string.IsNullOrWhiteSpace(weatherContext.City)
            || !string.IsNullOrWhiteSpace(weatherContext.State)
            || !string.IsNullOrWhiteSpace(weatherContext.PostalCode)))
    {
        var geocodeResult = await TryGeocodeWithNominatimAsync(
            httpClientFactory,
            providerTelemetryByName,
            providerTelemetryHistory,
            externalProviderTelemetryHistoryMax,
            externalProviderTelemetryPersistToFile,
            externalProviderTelemetryFilePath,
            externalProviderTelemetryFileLock,
            externalProviderTelemetryPersistToSql,
            externalProviderTelemetrySqlRetentionDays,
            externalProviderTelemetrySqlConnectionString,
            externalProviderTelemetryEnvironmentName,
            weatherContext.LocationName,
            weatherContext.City,
            weatherContext.State,
            weatherContext.PostalCode,
            cancellationToken,
            externalProviderCircuitFailureThreshold,
            externalProviderCircuitDuration);

        if (geocodeResult is not null)
        {
            effectiveLatitude = geocodeResult.Latitude;
            effectiveLongitude = geocodeResult.Longitude;
        }
    }

    if (effectiveLatitude.HasValue && effectiveLongitude.HasValue)
    {
        var weatherLocationLabel = BuildWeatherLocationLabel(weatherContext);
        if (!IsProviderCircuitOpen(providerTelemetryByName, "OPEN_METEO"))
        {
            var providerForecast = await TryGetOpenMeteoForecastAsync(
                httpClientFactory,
                providerTelemetryByName,
                providerTelemetryHistory,
                externalProviderTelemetryHistoryMax,
                externalProviderTelemetryPersistToFile,
                externalProviderTelemetryFilePath,
                externalProviderTelemetryFileLock,
                externalProviderTelemetryPersistToSql,
                externalProviderTelemetrySqlRetentionDays,
                externalProviderTelemetrySqlConnectionString,
                externalProviderTelemetryEnvironmentName,
                effectiveLatitude.Value,
                effectiveLongitude.Value,
                weatherLocationLabel,
                cancellationToken,
                externalProviderCircuitFailureThreshold,
                externalProviderCircuitDuration);
            if (providerForecast is { Length: > 0 })
            {
                return Results.Ok(providerForecast);
            }
        }
        else
        {
            MarkProviderBypass(
                providerTelemetryByName,
                providerTelemetryHistory,
                externalProviderTelemetryHistoryMax,
                externalProviderTelemetryPersistToFile,
                externalProviderTelemetryFilePath,
                externalProviderTelemetryFileLock,
                externalProviderTelemetryPersistToSql,
                externalProviderTelemetrySqlRetentionDays,
                externalProviderTelemetrySqlConnectionString,
                externalProviderTelemetryEnvironmentName,
                "OPEN_METEO");
        }
    }

    var contextLabel = BuildWeatherLocationLabel(weatherContext) ?? "unresolved";
    if (!effectiveLatitude.HasValue || !effectiveLongitude.HasValue)
    {
        app.Logger.LogWarning(
            "Weather context unresolved for live forecast. IncidentId: {IncidentId}; LocationId: {LocationId}; Context: {ContextLabel}",
            weatherContext.IncidentId,
            weatherContext.LocationId,
            contextLabel);
        return Results.Ok(Array.Empty<WeatherForecast>());
    }

    app.Logger.LogWarning(
        "Open-Meteo live forecast unavailable. IncidentId: {IncidentId}; LocationId: {LocationId}; Context: {ContextLabel}",
        weatherContext.IncidentId,
        weatherContext.LocationId,
        contextLabel);
    return Results.Ok(Array.Empty<WeatherForecast>());
})
.CacheOutput(p => p.Expire(TimeSpan.FromSeconds(5)))
.WithName("GetWeatherForecast");

apiV1.MapGet("cop/live-overlay", async (ILookupQueryService lookupQueryService, IHttpClientFactory httpClientFactory, CancellationToken cancellationToken) =>
{
    (DateTimeOffset? LastExternalAttemptUtc, string? LastExternalFailureReason) GetExternalDiagnostics()
    {
        providerTelemetryByName.TryGetValue("COP_LIVE_OVERLAY_EXTERNAL", out var telemetry);
        var lastExternalFailureReason = string.Equals(telemetry?.LastEventType, "failure", StringComparison.OrdinalIgnoreCase)
            ? telemetry?.LastEventDetail ?? telemetry?.LastError
            : null;
        return (telemetry?.LastEventUtc, lastExternalFailureReason);
    }

    var useExternalProvider = string.Equals(copLiveOverlayProvider, "External", StringComparison.OrdinalIgnoreCase);
    var providerCooldown = TryAcquireDataOpsCooldown(providerCooldownByOperation, "COP_LIVE_OVERLAY_EXTERNAL", TimeSpan.FromSeconds(5));
    var canTryExternal = useExternalProvider && providerCooldown.Allowed && !IsProviderCircuitOpen(providerTelemetryByName, "COP_LIVE_OVERLAY_EXTERNAL");
    var generatedUtc = DateTimeOffset.UtcNow;
    var activeLocations = await lookupQueryService.GetActiveLocationsAsync(cancellationToken);

    if (activeLocations.Count == 0)
    {
        var diagnostics = GetExternalDiagnostics();
        return Results.Ok(new CopLiveOverlayFeedDto(
            "none",
            "inactive",
            false,
            "No active locations available for COP overlay feed.",
            diagnostics.LastExternalAttemptUtc,
            diagnostics.LastExternalFailureReason,
            generatedUtc,
            []));
    }

    if (canTryExternal)
    {
        var externalPoints = await TryGetCopLiveOverlayExternalFeedAsync(
            httpClientFactory,
            providerTelemetryByName,
            providerTelemetryHistory,
            externalProviderTelemetryHistoryMax,
            externalProviderTelemetryPersistToFile,
            externalProviderTelemetryFilePath,
            externalProviderTelemetryFileLock,
            externalProviderTelemetryPersistToSql,
            externalProviderTelemetrySqlRetentionDays,
            externalProviderTelemetrySqlConnectionString,
            externalProviderTelemetryEnvironmentName,
            activeLocations,
            cancellationToken,
            externalProviderCircuitFailureThreshold,
            externalProviderCircuitDuration);

        if (externalPoints is { Length: > 0 })
        {
            var diagnostics = GetExternalDiagnostics();
            return Results.Ok(new CopLiveOverlayFeedDto(
                "external",
                "healthy",
                false,
                null,
                diagnostics.LastExternalAttemptUtc,
                diagnostics.LastExternalFailureReason,
                generatedUtc,
                externalPoints));
        }
    }
    else if (useExternalProvider)
    {
        MarkProviderBypass(
            providerTelemetryByName,
            providerTelemetryHistory,
            externalProviderTelemetryHistoryMax,
            externalProviderTelemetryPersistToFile,
            externalProviderTelemetryFilePath,
            externalProviderTelemetryFileLock,
            externalProviderTelemetryPersistToSql,
            externalProviderTelemetrySqlRetentionDays,
            externalProviderTelemetrySqlConnectionString,
            externalProviderTelemetryEnvironmentName,
            "COP_LIVE_OVERLAY_EXTERNAL");
    }

    var fallbackPoints = BuildSimulatedCopLiveOverlayFeedPoints(activeLocations, generatedUtc, useExternalProvider ? "external-fallback-simulated" : "simulated-feed");
    var fallbackDiagnostics = GetExternalDiagnostics();
    return Results.Ok(new CopLiveOverlayFeedDto(
        useExternalProvider ? "external" : "simulated",
        useExternalProvider ? "degraded" : "healthy",
        useExternalProvider,
        useExternalProvider ? "External feed unavailable or constrained; simulated fallback active." : null,
        fallbackDiagnostics.LastExternalAttemptUtc,
        fallbackDiagnostics.LastExternalFailureReason,
        generatedUtc,
        fallbackPoints));
})
.CacheOutput(p => p.Expire(TimeSpan.FromSeconds(10)))
.WithName("GetCopLiveOverlayFeed");

apiV1.MapGet("cop/live-overlay/contract", () =>
{
    return Results.Ok(new
    {
        providerMode = copLiveOverlayProvider,
        externalUrlEnvironmentVariable = "IPOC_COP_LIVE_OVERLAY_EXTERNAL_URL",
        acceptedPayloadSchema = JsonDocument.Parse(GetCopLiveOverlayExternalPayloadContractJsonSchema()).RootElement,
        samplePayload = JsonDocument.Parse(GetCopLiveOverlayExternalPayloadSampleJson()).RootElement,
        responseShape = new
        {
            provider = "external|simulated|none",
            status = "healthy|degraded|inactive",
            fallbackUsed = "boolean",
            detail = "string|null",
            lastExternalAttemptUtc = "ISO-8601 UTC|null",
            lastExternalFailureReason = "string|null",
            generatedUtc = "ISO-8601 UTC",
            points = "[{ locationId, stressDelta, source, updatedUtc }]"
        }
    });
})
.WithName("GetCopLiveOverlayContract");

apiV1.MapGet("cop/live-overlay/external-readiness", async (ILookupQueryService lookupQueryService, IHttpClientFactory httpClientFactory, CancellationToken cancellationToken) =>
{
    var checkedUtc = DateTimeOffset.UtcNow;
    var providerMode = copLiveOverlayProvider;
    var activeLocations = await lookupQueryService.GetActiveLocationsAsync(cancellationToken);
    var activeLocationIds = activeLocations.Select(item => item.LocationId).ToHashSet();
    var probe = await ProbeCopLiveOverlayExternalReadinessAsync(httpClientFactory, activeLocationIds, cancellationToken);

    return Results.Ok(new CopLiveOverlayExternalReadinessDto(
        providerMode,
        probe.UrlConfigured,
        probe.Status,
        probe.HttpStatusCode,
        probe.RawPointCount,
        probe.ValidPointCount,
        probe.ActiveLocationMatchCount,
        probe.InvalidPointCount,
        probe.Detail,
        checkedUtc));
})
.WithName("GetCopLiveOverlayExternalReadiness");

var auth = apiV1.MapGroup("/auth").RequireAuthorization();

auth.MapGet("/me", async (ClaimsPrincipal user, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var scopeClaim = user.FindFirst("scp")?.Value
        ?? user.FindFirst("http://schemas.microsoft.com/identity/claims/scope")?.Value
        ?? string.Empty;

    var scopes = string.IsNullOrWhiteSpace(scopeClaim)
        ? []
        : scopeClaim.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    var roles = user.FindAll("roles")
        .Concat(user.FindAll("role"))
        .Concat(user.FindAll(ClaimTypes.Role))
        .Select(c => c.Value)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "AUTH",
            "PROFILE_VIEW",
            "sec",
            "AppUser",
            httpContext.TryGetActorUserId()?.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new
    {
        isAuthenticated = user.Identity?.IsAuthenticated ?? false,
        authenticationType = user.Identity?.AuthenticationType,
        name = user.Identity?.Name ?? user.FindFirst("name")?.Value,
        username = user.FindFirst("preferred_username")?.Value ?? user.FindFirst(ClaimTypes.Upn)?.Value,
        scopes,
        roles
    });
})
.WithName("GetCurrentUser");

auth.MapPost("/audit/login", async (HttpContext httpContext, IAuditEventWriter auditWriter, CancellationToken cancellationToken) =>
{
    var actorUserId = httpContext.TryGetActorUserId();
    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            actorUserId,
            "AUTH",
            "LOGIN_SUCCESS",
            "sec",
            "AppUser",
            actorUserId?.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new { traceId = httpContext.TraceIdentifier })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("WriteLoginAudit");

auth.MapPost("/audit/logout", async (HttpContext httpContext, IAuditEventWriter auditWriter, CancellationToken cancellationToken) =>
{
    var actorUserId = httpContext.TryGetActorUserId();
    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            actorUserId,
            "AUTH",
            "LOGOUT",
            "sec",
            "AppUser",
            actorUserId?.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new { traceId = httpContext.TraceIdentifier })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("WriteLogoutAudit");

auth.MapGet("/token-debug", async (
    ClaimsPrincipal user,
    IConfiguration configuration,
    IHostEnvironment environment,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (!environment.IsDevelopment())
    {
        return Results.NotFound();
    }

    var scopeClaim = user.FindFirst("scp")?.Value
        ?? user.FindFirst("http://schemas.microsoft.com/identity/claims/scope")?.Value
        ?? string.Empty;

    var scopes = string.IsNullOrWhiteSpace(scopeClaim)
        ? []
        : scopeClaim.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    var roles = user.FindAll("roles")
        .Concat(user.FindAll("role"))
        .Concat(user.FindAll(ClaimTypes.Role))
        .Select(c => c.Value)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    var audience = user.FindFirst("aud")?.Value;
    var issuer = user.FindFirst("iss")?.Value;

    var configuredAudience = configuration["AzureAd:Audience"];
    var configuredAuthority = configuration["AzureAd:Authority"];

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "AUTH",
            "TOKEN_DEBUG_VIEW",
            "sec",
            "AccessToken",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new
    {
        isAuthenticated = user.Identity?.IsAuthenticated ?? false,
        authenticationType = user.Identity?.AuthenticationType,
        name = user.Identity?.Name ?? user.FindFirst("name")?.Value,
        username = user.FindFirst("preferred_username")?.Value ?? user.FindFirst(ClaimTypes.Upn)?.Value,
        audience,
        issuer,
        scopes,
        roles,
        configuredAudience,
        configuredAuthority,
        allClaims = user.Claims
            .Select(c => new { c.Type, c.Value })
            .OrderBy(c => c.Type)
            .ToArray()
    });
})
.RequireAuthorization(AuthorizationPolicies.LookupAdmin)
.WithName("GetTokenDebug");

const string AgentHistoryScope = "agent-assistant-history";
const string AgentPersonalizationScope = "agent-assistant-personalization";
const string AgentAnalyticsScope = "agent-assistant-analytics-events";
const string AgentDefaultPresetName = "default";
const string AgentGlobalPolicyScope = "agent-assistant-policy-global";
const string AgentGlobalPolicyPresetName = "global";

var globalAgentPersonalizationPolicy = CreateDefaultAgentPersonalizationPolicy();
var hasGlobalAgentPersonalizationPolicy = false;
var globalAgentPersonalizationPolicySync = new object();

var agent = apiV1.MapGroup("/agent").RequireAuthorization(AuthorizationPolicies.ResourceReporter);

try
{
    using var startupScope = app.Services.CreateScope();
    var startupResourceQueryService = startupScope.ServiceProvider.GetRequiredService<IResourceQueryService>();

    var persistedGlobalPolicyJson = await startupResourceQueryService.GetGlobalReportPresetJsonAsync(
        AgentGlobalPolicyScope,
        AgentGlobalPolicyPresetName,
        app.Lifetime.ApplicationStopping);

    if (!string.IsNullOrWhiteSpace(persistedGlobalPolicyJson))
    {
        var parsedGlobalPolicy = JsonSerializer.Deserialize<AgentPersonalizationPolicyDto>(persistedGlobalPolicyJson);
        if (parsedGlobalPolicy is not null)
        {
            lock (globalAgentPersonalizationPolicySync)
            {
                globalAgentPersonalizationPolicy = NormalizeAgentPersonalizationPolicy(parsedGlobalPolicy);
                hasGlobalAgentPersonalizationPolicy = true;
            }
        }
    }
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Unable to load persisted global agent personalization policy. In-memory defaults will be used.");
}

agent.MapGet("/history", async (ClaimsPrincipal user, IResourceQueryService resourceQueryService, IUserQueryService userQueryService, IAuditEventWriter auditEventWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for agent history operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var presets = await resourceQueryService.GetUserReportPresetsAsync(userId.Value, AgentHistoryScope, cancellationToken);
    var preset = presets.FirstOrDefault(item => string.Equals(item.PresetName, AgentDefaultPresetName, StringComparison.OrdinalIgnoreCase))
        ?? presets.FirstOrDefault();

    if (preset is null || string.IsNullOrWhiteSpace(preset.PresetJson))
    {
        return Results.Ok(Array.Empty<AgentConversationSessionDto>());
    }

    try
    {
        var sessions = JsonSerializer.Deserialize<List<AgentConversationSessionDto>>(preset.PresetJson) ?? [];

        await auditEventWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                userId.Value,
                "AGENT",
                "CONVERSATION_HISTORY_VIEW",
                "agent",
                "UserReportPreset",
                preset.UserReportPresetId.ToString(CultureInfo.InvariantCulture),
                null,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    sessionCount = sessions.Count,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);

        return Results.Ok(sessions);
    }
    catch
    {
        return Results.Ok(Array.Empty<AgentConversationSessionDto>());
    }
})
.WithName("GetAgentConversationHistory");

agent.MapPost("/chat/completions", async (
    AgentChatCompletionRequestDto request,
    ClaimsPrincipal user,
    IResourceQueryService resourceQueryService,
    IUserQueryService userQueryService,
    Microsoft.Extensions.Options.IOptions<AzureOpenAiOptions> azureOpenAiOptions,
    Microsoft.Extensions.Options.IOptions<AzureAiSearchOptions> azureAiSearchOptions,
    IHttpClientFactory httpClientFactory,
    IAuditEventWriter auditEventWriter,
    HttpContext httpContext,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.SessionId) || string.IsNullOrWhiteSpace(request.Prompt))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sessionId"] = ["sessionId is required."],
            ["prompt"] = ["prompt is required."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for agent completion operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var openAi = azureOpenAiOptions.Value;
    var search = azureAiSearchOptions.Value;
    var openAiAuthMode = ResolveAzureAuthMode(openAi.UseManagedIdentity, !string.IsNullOrWhiteSpace(openAi.ApiKey), app.Environment.IsProduction());
    var searchAuthMode = ResolveAzureAuthMode(search.UseManagedIdentity, !string.IsNullOrWhiteSpace(search.ApiKey), app.Environment.IsProduction());

    var openAiConfigured = openAi.Enabled
        && !string.IsNullOrWhiteSpace(openAi.Endpoint)
        && !string.IsNullOrWhiteSpace(openAi.Deployment)
        && openAiAuthMode != AzureServiceAuthMode.None;

    var searchConfigured = search.Enabled
        && !string.IsNullOrWhiteSpace(search.Endpoint)
        && !string.IsNullOrWhiteSpace(search.IndexName)
        && searchAuthMode != AzureServiceAuthMode.None;

    string generatedText;
    List<string> groundedSources;
    List<AgentCitationDto> citations;
    decimal confidenceScore;
    bool fallbackUsed;
    string retrievalStatus;
    var modelName = string.IsNullOrWhiteSpace(openAi.Model) ? openAi.Deployment : openAi.Model;

    if (openAiConfigured && searchConfigured)
    {
        try
        {
            var client = httpClientFactory.CreateClient();
            var ragContext = await QueryAzureAiSearchAsync(client, search, request.Prompt, searchAuthMode, cancellationToken);
            groundedSources = ragContext.Sources;
            citations = ragContext.Citations;
            generatedText = await GenerateAzureOpenAiChatCompletionAsync(client, openAi, request.Prompt, ragContext.ContextBlock, openAiAuthMode, cancellationToken);
            fallbackUsed = false;
            retrievalStatus = string.IsNullOrWhiteSpace(ragContext.ContextBlock) ? "NoContext" : "Grounded";
            confidenceScore = string.IsNullOrWhiteSpace(ragContext.ContextBlock) ? 0.68m : 0.86m;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "RAG completion failed; falling back to deterministic local response.");
            groundedSources = [];
            citations = [];
            generatedText = "I’m having trouble reaching the knowledge service right now. Please try again in a moment.";
            fallbackUsed = true;
            retrievalStatus = "Fallback";
            confidenceScore = 0.42m;
        }
    }
    else
    {
        groundedSources = [];
        citations = [];
        generatedText = "I’m not fully configured for grounded responses yet. Please try again shortly.";
        fallbackUsed = true;
        retrievalStatus = "Fallback";
        confidenceScore = 0.50m;
    }

    groundedSources = groundedSources
        .Where(source => !string.IsNullOrWhiteSpace(source))
        .Select(source => source.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();

    if (groundedSources.Count == 0)
    {
        groundedSources = fallbackUsed
            ? []
            : ["Azure AI Search result set"];
    }

    citations = citations
        .Where(item => !string.IsNullOrWhiteSpace(item.Label))
        .GroupBy(item => item.Label.Trim(), StringComparer.OrdinalIgnoreCase)
        .Select(group => group
            .OrderByDescending(item => item.Score ?? decimal.MinValue)
            .First() with { Label = group.First().Label.Trim() })
        .ToList();

    if (citations.Count == 0)
    {
        citations = fallbackUsed
            ? []
            : groundedSources
            .Select(source => new AgentCitationDto(source, null, null, null))
            .ToList();
    }

    var now = DateTimeOffset.UtcNow;
    var responseMessage = new AgentConversationMessageDto(
        $"assistant-{Guid.NewGuid():N}",
        "assistant",
        generatedText,
        now);

    await auditEventWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "AGENT",
            "CHAT_COMPLETION",
            "agent",
            "AgentConversationSession",
            request.SessionId.Trim(),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                sessionId = request.SessionId.Trim(),
                promptLength = request.Prompt.Length,
                fallbackUsed,
                retrievalStatus,
                groundedSourceCount = groundedSources.Count,
                citationCount = citations.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new AgentChatCompletionResponseDto(
        request.SessionId.Trim(),
        responseMessage,
        groundedSources,
        citations,
        modelName,
        confidenceScore,
        fallbackUsed,
        retrievalStatus));
})
.WithName("CompleteAgentChat");

agent.MapGet("/planning/predictive-demand-supply", async (
    long? incidentId,
    int? horizonHours,
    IIncidentQueryService incidentQueryService,
    IResourceQueryService resourceQueryService,
    IPredictivePlanningModelService predictivePlanningModelService,
    IAuditEventWriter auditEventWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (!predictivePlanningEnabled)
    {
        return Results.Problem(
            title: "Predictive planning is disabled.",
            detail: "Enable Agent:PredictivePlanning:Enabled to use predictive demand/supply endpoints.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    if (incidentId is null || incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var normalizedHorizonHours = Math.Clamp(horizonHours ?? 24, 6, 168);
    var incident = await incidentQueryService.GetIncidentByIdAsync(incidentId.Value, cancellationToken);
    if (incident is null)
    {
        return Results.NotFound();
    }

    var incidentTasks = await incidentQueryService.GetIncidentTasksAsync(incidentId.Value, cancellationToken);
    var incidentObjectives = await incidentQueryService.GetIncidentObjectivesAsync(incidentId.Value, cancellationToken);
    var incidentResourceRequests = await incidentQueryService.GetIncidentResourceRequestsAsync(incidentId.Value, cancellationToken);
    var resourceInventory = await resourceQueryService.GetResourceInventoryAsync(cancellationToken);
    var bedAvailability = await resourceQueryService.GetBedAvailabilityAsync(cancellationToken);

    var prediction = await predictivePlanningModelService.PredictDemandSupplyAsync(
        new PredictivePlanningRequestDto(
            incident.IncidentId,
            incident.IncidentNumber,
            incident.IncidentName,
            normalizedHorizonHours,
            incidentTasks.Select(item => new IncidentPredictiveTaskFeatureDto(item.PriorityCode, item.StatusCode)).ToArray(),
            incidentObjectives.Select(item => new IncidentPredictiveObjectiveFeatureDto(item.StatusCode)).ToArray(),
            incidentResourceRequests.Select(item => new IncidentPredictiveResourceRequestFeatureDto(
                item.ResourceTypeCode,
                item.RequestedQuantity,
                item.AssignedQuantity,
                item.StatusCode)).ToArray(),
            resourceInventory.Select(item => new PredictiveResourceInventoryFeatureDto(item.ResourceTypeCode, item.QuantityAvailable)).ToArray(),
            bedAvailability.Select(item => new PredictiveBedAvailabilityFeatureDto(item.BedsAvailable)).ToArray()),
        cancellationToken);

    await auditEventWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "AGENT",
            "PREDICTIVE_DEMAND_SUPPLY_VIEW",
            "agent",
            "Incident",
            incident.IncidentId.ToString(CultureInfo.InvariantCulture),
            incident.IncidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId = incident.IncidentId,
                normalizedHorizonHours,
                prediction.ModelId,
                prediction.ModelVersion,
                prediction.DriftStatus,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new AgentPredictiveDemandSupplyResponseDto(
        incident.IncidentId,
        incident.IncidentNumber,
        incident.IncidentName,
        normalizedHorizonHours,
        prediction.ModelId,
        prediction.ModelVersion,
        prediction.TrainedAtUtc,
        new AgentPredictiveDemandSupplyConfidenceIntervalDto(
            prediction.ConfidenceInterval.Lower,
            prediction.ConfidenceInterval.Upper),
        prediction.DriftStatus,
        prediction.DemandPressureIndex,
        prediction.SupplyReadinessIndex,
        prediction.RiskLevel,
        prediction.ProjectedDemandQuantity,
        prediction.ProjectedSupplyQuantity,
        prediction.PredictedShortfallQuantity,
        prediction.ShortageByResourceType
            .Select(item => new AgentPredictiveDemandSupplyResourceGapDto(
                item.ResourceTypeCode,
                item.RequestedOutstandingQuantity,
                item.AvailableQuantity,
                item.PredictedGapQuantity))
            .ToArray(),
        prediction.Recommendations,
        prediction.Assumptions,
        prediction.GeneratedUtc));
})
.WithName("GetAgentPredictiveDemandSupply");

agent.MapGet("/planning/predictive-demand-supply/operational-acceptance", async (
    long? incidentId,
    int? horizonHours,
    IIncidentQueryService incidentQueryService,
    IResourceQueryService resourceQueryService,
    IPredictivePlanningModelService predictivePlanningModelService,
    IAuditEventWriter auditEventWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (!predictivePlanningEnabled)
    {
        return Results.Problem(
            title: "Predictive planning is disabled.",
            detail: "Enable Agent:PredictivePlanning:Enabled to use predictive demand/supply endpoints.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    if (incidentId is null || incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var normalizedHorizonHours = Math.Clamp(horizonHours ?? 24, 6, 168);
    var incident = await incidentQueryService.GetIncidentByIdAsync(incidentId.Value, cancellationToken);
    if (incident is null)
    {
        return Results.NotFound();
    }

    var incidentTasks = await incidentQueryService.GetIncidentTasksAsync(incidentId.Value, cancellationToken);
    var incidentObjectives = await incidentQueryService.GetIncidentObjectivesAsync(incidentId.Value, cancellationToken);
    var incidentResourceRequests = await incidentQueryService.GetIncidentResourceRequestsAsync(incidentId.Value, cancellationToken);
    var resourceInventory = await resourceQueryService.GetResourceInventoryAsync(cancellationToken);
    var bedAvailability = await resourceQueryService.GetBedAvailabilityAsync(cancellationToken);

    var prediction = await predictivePlanningModelService.PredictDemandSupplyAsync(
        new PredictivePlanningRequestDto(
            incident.IncidentId,
            incident.IncidentNumber,
            incident.IncidentName,
            normalizedHorizonHours,
            incidentTasks.Select(item => new IncidentPredictiveTaskFeatureDto(item.PriorityCode, item.StatusCode)).ToArray(),
            incidentObjectives.Select(item => new IncidentPredictiveObjectiveFeatureDto(item.StatusCode)).ToArray(),
            incidentResourceRequests.Select(item => new IncidentPredictiveResourceRequestFeatureDto(
                item.ResourceTypeCode,
                item.RequestedQuantity,
                item.AssignedQuantity,
                item.StatusCode)).ToArray(),
            resourceInventory.Select(item => new PredictiveResourceInventoryFeatureDto(item.ResourceTypeCode, item.QuantityAvailable)).ToArray(),
            bedAvailability.Select(item => new PredictiveBedAvailabilityFeatureDto(item.BedsAvailable)).ToArray()),
        cancellationToken);

    var acceptance = predictivePlanningModelService.EvaluateOperationalAcceptance(prediction);

    await auditEventWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "AGENT",
            "PREDICTIVE_OPERATIONAL_ACCEPTANCE_VIEW",
            "agent",
            "Incident",
            incident.IncidentId.ToString(CultureInfo.InvariantCulture),
            incident.IncidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId = incident.IncidentId,
                normalizedHorizonHours,
                acceptance.Allowed,
                violationCount = acceptance.Violations.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new AgentPredictiveDemandSupplyOperationalAcceptanceResponseDto(
        incident.IncidentId,
        incident.IncidentNumber,
        incident.IncidentName,
        normalizedHorizonHours,
        prediction.ModelId,
        prediction.ModelVersion,
        acceptance.Allowed,
        acceptance.Reason,
        acceptance.Violations,
        acceptance.EvaluatedUtc));
})
.WithName("GetAgentPredictiveDemandSupplyOperationalAcceptance");

agent.MapGet("/personalization/policy", async (
    ClaimsPrincipal user,
    IResourceQueryService resourceQueryService,
    IAuditEventWriter auditEventWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (!hasGlobalAgentPersonalizationPolicy)
    {
        try
        {
            var persistedGlobalPolicyJson = await resourceQueryService.GetGlobalReportPresetJsonAsync(
                AgentGlobalPolicyScope,
                AgentGlobalPolicyPresetName,
                cancellationToken);

            if (!string.IsNullOrWhiteSpace(persistedGlobalPolicyJson))
            {
                var parsed = JsonSerializer.Deserialize<AgentPersonalizationPolicyDto>(persistedGlobalPolicyJson);
                if (parsed is not null)
                {
                    lock (globalAgentPersonalizationPolicySync)
                    {
                        globalAgentPersonalizationPolicy = NormalizeAgentPersonalizationPolicy(parsed);
                        hasGlobalAgentPersonalizationPolicy = true;
                    }
                }
            }
        }
        catch
        {
            // continue with in-memory fallback
        }
    }

    AgentPersonalizationPolicyDto policy;
    bool hasGlobalPolicy;

    lock (globalAgentPersonalizationPolicySync)
    {
        policy = globalAgentPersonalizationPolicy;
        hasGlobalPolicy = hasGlobalAgentPersonalizationPolicy;
    }

    var canManagePolicy = CanManageAgentPersonalizationPolicy(user);

    await auditEventWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "AGENT_POLICY",
            "PERSONALIZATION_POLICY_VIEW",
            "agent",
            "AgentPersonalizationPolicy",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                hasGlobalPolicy,
                canManagePolicy,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new AgentPersonalizationPolicyStateDto(
        hasGlobalPolicy,
        canManagePolicy,
        policy,
        DateTimeOffset.UtcNow));
})
.WithName("GetAgentPersonalizationPolicy");

agent.MapGet("/personalization/policy/history", async (
    int? pageNumber,
    int? pageSize,
    IAuditEventQueryService auditEventQueryService,
    IAuditEventWriter auditEventWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var normalizedPageNumber = Math.Max(1, pageNumber ?? 1);
    var normalizedPageSize = Math.Clamp(pageSize ?? 10, 1, 50);

    var (items, totalCount) = await auditEventQueryService.GetAuditEventsAsync(
        incidentId: null,
        eventCategory: "AGENT_POLICY",
        outcomeCode: null,
        fromUtc: null,
        toUtc: null,
        pageNumber: normalizedPageNumber,
        pageSize: normalizedPageSize,
        eventAction: "PERSONALIZATION_POLICY_UPDATED",
        cancellationToken: cancellationToken);

    var historyItems = items
        .Select(item => new AgentPersonalizationPolicyAuditItemDto(
            item.AuditEventId,
            item.EventUtc,
            item.ActorUserId,
            item.ActorDisplayName,
            item.OutcomeCode,
            item.DetailJson))
        .ToArray();

    await auditEventWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "AGENT_POLICY",
            "PERSONALIZATION_POLICY_HISTORY_VIEW",
            "agent",
            "AgentPersonalizationPolicy",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                pageNumber = normalizedPageNumber,
                pageSize = normalizedPageSize,
                itemCount = historyItems.Length,
                totalCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new
    {
        items = historyItems,
        totalCount,
        pageNumber = normalizedPageNumber,
        pageSize = normalizedPageSize
    });
})
.WithName("GetAgentPersonalizationPolicyHistory");

agent.MapPut("/personalization/policy", async (
    AgentPersonalizationPolicyDto request,
    ClaimsPrincipal user,
    IResourceQueryService resourceQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditEventWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (!CanManageAgentPersonalizationPolicy(user))
    {
        return Results.Forbid();
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for policy management operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var normalized = NormalizeAgentPersonalizationPolicy(request);
    AgentPersonalizationPolicyDto previousPolicy;

    lock (globalAgentPersonalizationPolicySync)
    {
        previousPolicy = globalAgentPersonalizationPolicy;
        globalAgentPersonalizationPolicy = normalized;
        hasGlobalAgentPersonalizationPolicy = true;
    }

    var upsertRequest = new UpsertUserReportPresetRequestDto(
        AgentGlobalPolicyPresetName,
        JsonSerializer.Serialize(normalized));

    var userReportPresetId = await resourceQueryService.UpsertGlobalReportPresetAsync(userId.Value, AgentGlobalPolicyScope, upsertRequest, cancellationToken);

    await auditEventWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "AGENT_POLICY",
            "PERSONALIZATION_POLICY_UPDATED",
            "app",
            "UserReportPreset",
            userReportPresetId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                previousPolicy,
                updatedPolicy = normalized,
                traceId = httpContext.TraceIdentifier,
                updatedUtc = DateTimeOffset.UtcNow
            })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("SaveAgentPersonalizationPolicy");

agent.MapPost("/personalization", async (AgentPersonalizationRequestDto request, ClaimsPrincipal user, IResourceQueryService resourceQueryService, IUserQueryService userQueryService, IAuditEventWriter auditEventWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Avatar) || string.IsNullOrWhiteSpace(request.Theme))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["avatar"] = ["avatar is required."],
            ["theme"] = ["theme is required."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for personalization operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    DateTimeOffset? expectedUpdatedUtc = null;
    DateTimeOffset parsedExpectedUpdatedUtc = default;
    if (!string.IsNullOrWhiteSpace(request.ExpectedUpdatedUtc)
        && !DateTimeOffset.TryParse(request.ExpectedUpdatedUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out parsedExpectedUpdatedUtc))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["expectedUpdatedUtc"] = ["expectedUpdatedUtc must be an ISO-8601 datetime when provided."]
        });
    }

    if (!string.IsNullOrWhiteSpace(request.ExpectedUpdatedUtc))
    {
        expectedUpdatedUtc = parsedExpectedUpdatedUtc;
    }

    var existingPersonalizationPresets = await resourceQueryService.GetUserReportPresetsAsync(userId.Value, AgentPersonalizationScope, cancellationToken);
    var existingPersonalizationPreset = existingPersonalizationPresets.FirstOrDefault(item => string.Equals(item.PresetName, AgentDefaultPresetName, StringComparison.OrdinalIgnoreCase))
        ?? existingPersonalizationPresets.FirstOrDefault();

    if (expectedUpdatedUtc.HasValue && existingPersonalizationPreset is not null)
    {
        var normalizedExpectedUtc = expectedUpdatedUtc.Value.ToUniversalTime();
        var normalizedCurrentUtc = existingPersonalizationPreset.UpdatedUtc.ToUniversalTime();
        if (normalizedExpectedUtc != normalizedCurrentUtc)
        {
            return Results.Conflict(new
            {
                message = "Personalization settings were updated elsewhere. Refresh and retry with the latest version.",
                currentUpdatedUtc = normalizedCurrentUtc
            });
        }
    }

    var upsertRequest = new UpsertUserReportPresetRequestDto(
        AgentDefaultPresetName,
        JsonSerializer.Serialize(request));

    var userReportPresetId = await resourceQueryService.UpsertUserReportPresetAsync(userId.Value, AgentPersonalizationScope, upsertRequest, cancellationToken);

    await auditEventWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "AGENT_POLICY",
            "PERSONALIZATION_PREFERENCES_UPDATED",
            "app",
            "UserReportPreset",
            userReportPresetId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                request.Avatar,
                request.Theme,
                request.ExpectedUpdatedUtc,
                traceId = httpContext.TraceIdentifier,
                updatedUtc = DateTimeOffset.UtcNow
            })),
        cancellationToken);

    var persistedPersonalizationPresets = await resourceQueryService.GetUserReportPresetsAsync(userId.Value, AgentPersonalizationScope, cancellationToken);
    var persistedPersonalizationPreset = persistedPersonalizationPresets.FirstOrDefault(item => string.Equals(item.PresetName, AgentDefaultPresetName, StringComparison.OrdinalIgnoreCase))
        ?? persistedPersonalizationPresets.FirstOrDefault();

    return Results.Ok(new
    {
        userReportPresetId,
        updatedUtc = persistedPersonalizationPreset?.UpdatedUtc
    });
})
.WithName("SaveAgentPersonalization");

agent.MapPost("/analytics/events", async (AgentAnalyticsEventRequestDto request, ClaimsPrincipal user, IResourceQueryService resourceQueryService, IUserQueryService userQueryService, IAuditEventWriter auditEventWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.EventName))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["eventName"] = ["eventName is required."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for analytics event operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var presets = await resourceQueryService.GetUserReportPresetsAsync(userId.Value, AgentAnalyticsScope, cancellationToken);
    var preset = presets.FirstOrDefault(item => string.Equals(item.PresetName, AgentDefaultPresetName, StringComparison.OrdinalIgnoreCase))
        ?? presets.FirstOrDefault();

    List<AgentAnalyticsEventRequestDto> events = [];
    if (preset is not null && !string.IsNullOrWhiteSpace(preset.PresetJson))
    {
        try
        {
            events = JsonSerializer.Deserialize<List<AgentAnalyticsEventRequestDto>>(preset.PresetJson) ?? [];
        }
        catch
        {
            events = [];
        }
    }

    events.Add(request with
    {
        OccurredAt = request.OccurredAt == default ? DateTimeOffset.UtcNow : request.OccurredAt,
    });

    const int maxEventHistory = 250;
    if (events.Count > maxEventHistory)
    {
        events = events[^maxEventHistory..];
    }

    var upsertRequest = new UpsertUserReportPresetRequestDto(
        AgentDefaultPresetName,
        JsonSerializer.Serialize(events));

    var userReportPresetId = await resourceQueryService.UpsertUserReportPresetAsync(userId.Value, AgentAnalyticsScope, upsertRequest, cancellationToken);

    await auditEventWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "AGENT_ANALYTICS",
            "ANALYTICS_EVENT_RECORDED",
            "app",
            "UserReportPreset",
            userReportPresetId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                request.EventName,
                request.OccurredAt,
                retainedEventCount = events.Count,
                traceId = httpContext.TraceIdentifier,
                updatedUtc = DateTimeOffset.UtcNow
            })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("CreateAgentAnalyticsEvent");

var incidents = apiV1.MapGroup("/incidents");

var alerts = apiV1.MapGroup("/alerts").RequireAuthorization(AuthorizationPolicies.IncidentViewer);

alerts.MapGet("/", async (ClaimsPrincipal user, IAlertQueryService alertQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var alerts = await alertQueryService.GetUiAlertsAsync(userId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "COMMUNICATION",
            "UI_ALERTS_VIEW",
            "comm",
            "UiAlert",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                alertCount = alerts.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(alerts);
})
.WithName("GetUiAlerts");

alerts.MapPost("/", async (CreateUiAlertRequestDto request, ClaimsPrincipal user, IAlertQueryService alertQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Message))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["message"] = ["Message is required."]
        });
    }

    var normalizedVariant = request.Variant.Trim().ToLowerInvariant();
    if (normalizedVariant is not ("success" or "danger" or "warning" or "info"))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["variant"] = ["Variant must be one of: success, danger, warning, info."]
        });
    }

    var normalizedStatus = request.Status.Trim().ToLowerInvariant();
    if (normalizedStatus is not ("new" or "acknowledged"))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["status"] = ["Status must be one of: new, acknowledged."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var alertId = await alertQueryService.CreateUiAlertAsync(
        userId.Value,
        request with
        {
            Variant = normalizedVariant,
            Status = normalizedStatus,
        },
        cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "COMMUNICATION",
            "UI_ALERT_CREATE",
            "comm",
            "UiAlert",
            alertId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                alertId,
                variant = normalizedVariant,
                status = normalizedStatus,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new { alertId });
})
.WithName("CreateUiAlert");

alerts.MapPost("/{alertId:long}/acknowledge", async (long alertId, ClaimsPrincipal user, IAlertQueryService alertQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (alertId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["alertId"] = ["alertId must be greater than zero."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var acknowledged = await alertQueryService.AcknowledgeUiAlertAsync(userId.Value, alertId, cancellationToken);

    if (acknowledged)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                userId.Value,
                "COMMUNICATION",
                "UI_ALERT_ACKNOWLEDGE",
                "comm",
                "UiAlert",
                alertId.ToString(CultureInfo.InvariantCulture),
                null,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    alertId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return acknowledged ? Results.NoContent() : Results.NotFound();
})
.WithName("AcknowledgeUiAlert");

alerts.MapDelete("/{alertId:long}", async (long alertId, ClaimsPrincipal user, IAlertQueryService alertQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (alertId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["alertId"] = ["alertId must be greater than zero."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var deleted = await alertQueryService.DeleteUiAlertAsync(userId.Value, alertId, cancellationToken);

    if (deleted)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                userId.Value,
                "COMMUNICATION",
                "UI_ALERT_DELETE",
                "comm",
                "UiAlert",
                alertId.ToString(CultureInfo.InvariantCulture),
                null,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    alertId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return deleted ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteUiAlert");

alerts.MapDelete("/", async (ClaimsPrincipal user, IAlertQueryService alertQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var removedCount = await alertQueryService.ClearUiAlertsAsync(userId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "COMMUNICATION",
            "UI_ALERT_CLEAR",
            "comm",
            "UiAlert",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                removedCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new { removedCount });
})
.WithName("ClearUiAlerts");

alerts.MapPost("/dispatch", async (
    CreateCommunicationDispatchRequestDto request,
    ClaimsPrincipal user,
    IAlertQueryService alertQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.NotificationTypeCode))
    {
        errors["notificationTypeCode"] = ["Notification type code is required."];
    }

    if (string.IsNullOrWhiteSpace(request.Subject))
    {
        errors["subject"] = ["Subject is required."];
    }

    if (string.IsNullOrWhiteSpace(request.MessageBody))
    {
        errors["messageBody"] = ["Message body is required."];
    }

    var normalizedPriorityCode = request.PriorityCode.Trim();
    if (normalizedPriorityCode is not ("Low" or "Normal" or "High" or "Critical"))
    {
        errors["priorityCode"] = ["Priority code must be one of: Low, Normal, High, Critical."];
    }

    if (request.Recipients.Count == 0)
    {
        errors["recipients"] = ["At least one recipient is required."];
    }
    else
    {
        for (var index = 0; index < request.Recipients.Count; index += 1)
        {
            var recipient = request.Recipients[index];
            var recipientPath = $"recipients[{index}]";
            var principalCount = (recipient.UserId is > 0 ? 1 : 0) + (recipient.ContactId is > 0 ? 1 : 0) + (recipient.LocationId is > 0 ? 1 : 0);

            if (principalCount == 0)
            {
                errors[$"{recipientPath}.principal"] = ["At least one principal identifier (userId, contactId, or locationId) is required."];
            }

            var normalizedChannelCode = recipient.ChannelCode.Trim().ToUpperInvariant();
            if (!AlertChannelCodes.Supported.Contains(normalizedChannelCode))
            {
                errors[$"{recipientPath}.channelCode"] = ["Channel code must be one of: EMAIL, SMS, VOICE, PUSH."];
            }

            if (string.IsNullOrWhiteSpace(recipient.DestinationAddress))
            {
                errors[$"{recipientPath}.destinationAddress"] = ["Destination address is required."];
            }
            else
            {
                var destinationError = ValidateNotificationDestinationAddress(normalizedChannelCode, recipient.DestinationAddress);
                if (destinationError is not null)
                {
                    errors[$"{recipientPath}.destinationAddress"] = [destinationError];
                }
            }
        }
    }

    if (errors.Count > 0)
    {
        return Results.ValidationProblem(errors);
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var normalizedRequest = request with
    {
        NotificationTypeCode = request.NotificationTypeCode.Trim().ToUpperInvariant(),
        Subject = request.Subject.Trim(),
        MessageBody = request.MessageBody.Trim(),
        PriorityCode = normalizedPriorityCode,
        Recipients = request.Recipients
            .Select(recipient => recipient with
            {
                ChannelCode = recipient.ChannelCode.Trim().ToUpperInvariant(),
                DestinationAddress = recipient.DestinationAddress.Trim(),
            })
            .ToArray(),
    };

    var result = await alertQueryService.CreateCommunicationDispatchAsync(userId.Value, normalizedRequest, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId,
            "COMMUNICATION",
            "DISPATCH_CREATE",
            "comm",
            "Notification",
            result.NotificationId.ToString(CultureInfo.InvariantCulture),
            request.IncidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                notificationTypeCode = normalizedRequest.NotificationTypeCode,
                recipientCount = result.RecipientCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CreateCommunicationDispatch");

alerts.MapGet("/{notificationId:long}/recipients", async (
    long notificationId,
    ClaimsPrincipal user,
    IAlertQueryService alertQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (notificationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["notificationId"] = ["notificationId must be greater than zero."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var recipients = await alertQueryService.GetNotificationRecipientsAsync(userId.Value, notificationId, cancellationToken);
    var sanitizedRecipients = recipients
        .Select(recipient => recipient with
        {
            DestinationAddress = RedactNotificationDestinationAddress(recipient.DestinationAddress),
            FailureReason = RedactNarrativeTextForExport(recipient.FailureReason)
        })
        .ToArray();

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "COMMUNICATION",
            "NOTIFICATION_RECIPIENTS_VIEW",
            "comm",
            "NotificationRecipient",
            notificationId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                notificationId,
                recipientCount = recipients.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(sanitizedRecipients);
})
.WithName("GetNotificationRecipients");

alerts.MapPost("/{notificationId:long}/recipients/{notificationRecipientId:long}/status", async (
    long notificationId,
    long notificationRecipientId,
    UpdateRecipientDeliveryStatusRequestDto request,
    ClaimsPrincipal user,
    IAlertQueryService alertQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (notificationId <= 0 || notificationRecipientId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["notification"] = ["notificationId and notificationRecipientId must be greater than zero."]
        });
    }

    var normalizedStatusCode = request.DeliveryStatusCode.Trim();
    if (normalizedStatusCode is not ("Queued" or "Sent" or "Failed" or "Suppressed" or "Cancelled"))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["deliveryStatusCode"] = ["Delivery status must be one of: Queued, Sent, Failed, Suppressed, Cancelled."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var updated = await alertQueryService.UpdateNotificationRecipientDeliveryStatusAsync(
        userId.Value,
        notificationId,
        notificationRecipientId,
        request with { DeliveryStatusCode = normalizedStatusCode },
        cancellationToken);

    if (!updated)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId,
            "COMMUNICATION",
            "RECIPIENT_STATUS_UPDATE",
            "comm",
            "NotificationRecipient",
            notificationRecipientId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                notificationId,
                deliveryStatusCode = normalizedStatusCode,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("UpdateNotificationRecipientDeliveryStatus");

alerts.MapPost("/{notificationId:long}/recipients/{notificationRecipientId:long}/acknowledge", async (
    long notificationId,
    long notificationRecipientId,
    AcknowledgeRecipientRequestDto request,
    ClaimsPrincipal user,
    IAlertQueryService alertQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (notificationId <= 0 || notificationRecipientId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["notification"] = ["notificationId and notificationRecipientId must be greater than zero."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var acknowledged = await alertQueryService.AcknowledgeNotificationRecipientAsync(
        userId.Value,
        notificationId,
        notificationRecipientId,
        request.AcknowledgmentNote,
        cancellationToken);

    if (!acknowledged)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId,
            "COMMUNICATION",
            "RECIPIENT_ACKNOWLEDGE",
            "comm",
            "NotificationRecipientAcknowledgment",
            notificationRecipientId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                notificationId,
                notificationRecipientId,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("AcknowledgeNotificationRecipient");

alerts.MapPost("/{notificationId:long}/escalate", async (
    long notificationId,
    EscalateNotificationRequestDto request,
    ClaimsPrincipal user,
    IAlertQueryService alertQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (notificationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["notificationId"] = ["notificationId must be greater than zero."]
        });
    }

    if (string.IsNullOrWhiteSpace(request.EscalationReason)
        || string.IsNullOrWhiteSpace(request.EscalationChannelCode)
        || string.IsNullOrWhiteSpace(request.EscalationDestinationAddress))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["escalation"] = ["Escalation reason, channel code, and destination address are required."]
        });
    }

    var normalizedEscalationChannelCode = request.EscalationChannelCode.Trim().ToUpperInvariant();
    if (!AlertChannelCodes.Supported.Contains(normalizedEscalationChannelCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["escalationChannelCode"] = ["Escalation channel code must be one of: EMAIL, SMS, VOICE, PUSH."]
        });
    }

    var escalationDestinationError = ValidateNotificationDestinationAddress(normalizedEscalationChannelCode, request.EscalationDestinationAddress);
    if (escalationDestinationError is not null)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["escalationDestinationAddress"] = [escalationDestinationError]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var result = await alertQueryService.EscalateNotificationAsync(
        userId.Value,
        notificationId,
        request with
        {
            EscalationReason = request.EscalationReason.Trim(),
            EscalationChannelCode = normalizedEscalationChannelCode,
            EscalationDestinationAddress = request.EscalationDestinationAddress.Trim(),
        },
        cancellationToken);

    if (result is null)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId,
            "COMMUNICATION",
            "NOTIFICATION_ESCALATE",
            "comm",
            "Notification",
            result.EscalatedNotificationId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                sourceNotificationId = result.SourceNotificationId,
                escalatedNotificationId = result.EscalatedNotificationId,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("EscalateNotification");

incidents.MapGet("/dashboard-summary", async (IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var result = await incidentQueryService.GetDashboardSummaryAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "DASHBOARD_SUMMARY_VIEW",
            "ic",
            "Incident",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentDashboardSummary");

incidents.MapGet("/", async (IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var result = await incidentQueryService.GetIncidentsAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "INCIDENT_LIST_VIEW",
            "ic",
            "Incident",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentCount = result.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidents");

incidents.MapGet("/{incidentId:long}", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var result = await incidentQueryService.GetIncidentByIdAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "INCIDENT_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            result is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = result is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentById");

incidents.MapPost("/", async (CreateIncidentRequestDto request, ClaimsPrincipal user, IIncidentQueryService incidentQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var requestErrors = ValidateCreateIncidentRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var createdByUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (createdByUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for incident write operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var createdIncidentId = await incidentQueryService.CreateIncidentAsync(request, createdByUserId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            createdByUserId.Value,
            "INCIDENT",
            "INCIDENT_CREATE",
            "ic",
            "Incident",
            createdIncidentId.ToString(CultureInfo.InvariantCulture),
            createdIncidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId = createdIncidentId,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Created($"/api/v1/incidents/{createdIncidentId}", new { incidentId = createdIncidentId });
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CreateIncident");

incidents.MapPost("/{incidentId:long}", async (long incidentId, UpdateIncidentRequestDto request, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var requestErrors = ValidateUpdateIncidentRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var success = await incidentQueryService.UpdateIncidentAsync(incidentId, request, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "INCIDENT",
                "INCIDENT_UPDATE",
                "ic",
                "Incident",
                incidentId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("UpdateIncident");

incidents.MapPost("/{incidentId:long}/activate", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var success = await incidentQueryService.ActivateIncidentAsync(incidentId, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "INCIDENT",
                "INCIDENT_ACTIVATE",
                "ic",
                "Incident",
                incidentId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.BadRequest("Incident cannot be activated from its current status.");
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("ActivateIncident");

incidents.MapPost("/{incidentId:long}/close", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var success = await incidentQueryService.CloseIncidentAsync(incidentId, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "INCIDENT",
                "INCIDENT_CLOSE",
                "ic",
                "Incident",
                incidentId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.BadRequest("Incident cannot be closed from its current status.");
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CloseIncident");

incidents.MapGet("/{incidentId:long}/tasks", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var tasks = await incidentQueryService.GetIncidentTasksAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "INCIDENT_TASKS_VIEW",
            "ic",
            "IncidentTask",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                taskCount = tasks.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(tasks);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentTasks");

incidents.MapPost("/{incidentId:long}/tasks", async (long incidentId, CreateIncidentTaskRequestDto request, ClaimsPrincipal user, IIncidentQueryService incidentQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var requestErrors = ValidateCreateIncidentTaskRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var createdByUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (createdByUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for task write operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var createdTaskId = await incidentQueryService.CreateIncidentTaskAsync(incidentId, request, createdByUserId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            createdByUserId.Value,
            "INCIDENT",
            "INCIDENT_TASK_CREATE",
            "ic",
            "IncidentTask",
            createdTaskId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                incidentTaskId = createdTaskId,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Created($"/api/v1/incidents/{incidentId}/tasks/{createdTaskId}", new { incidentTaskId = createdTaskId });
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CreateIncidentTask");

incidents.MapPost("/{incidentId:long}/tasks/{incidentTaskId:long}/status", async (long incidentId, long incidentTaskId, UpdateIncidentTaskStatusRequestDto request, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (incidentTaskId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentTaskId"] = ["incidentTaskId must be greater than zero."]
        });
    }

    var requestErrors = ValidateUpdateIncidentTaskStatusRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var success = await incidentQueryService.UpdateIncidentTaskStatusAsync(incidentId, incidentTaskId, request, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "INCIDENT",
                "INCIDENT_TASK_STATUS_UPDATE",
                "ic",
                "IncidentTask",
                incidentTaskId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    incidentTaskId,
                    request.StatusCode,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("UpdateIncidentTaskStatus");

incidents.MapPost("/{incidentId:long}/tasks/{incidentTaskId:long}/assignment", async (long incidentId, long incidentTaskId, UpdateIncidentTaskAssignmentRequestDto request, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (incidentTaskId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentTaskId"] = ["incidentTaskId must be greater than zero."]
        });
    }

    if (request.AssignedToUserId is <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["assignedToUserId"] = ["AssignedToUserId must be greater than zero when provided."]
        });
    }

    var success = await incidentQueryService.UpdateIncidentTaskAssignmentAsync(incidentId, incidentTaskId, request.AssignedToUserId, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "INCIDENT",
                "INCIDENT_TASK_ASSIGNMENT_UPDATE",
                "ic",
                "IncidentTask",
                incidentTaskId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    incidentTaskId,
                    request.AssignedToUserId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("UpdateIncidentTaskAssignment");

incidents.MapGet("/{incidentId:long}/timeline", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var events = await incidentQueryService.GetIncidentTimelineEventsAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "INCIDENT_TIMELINE_VIEW",
            "ic",
            "IncidentTimelineEvent",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                eventCount = events.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(events);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentTimeline");

incidents.MapPost("/{incidentId:long}/timeline", async (long incidentId, CreateIncidentTimelineEventRequestDto request, ClaimsPrincipal user, IIncidentQueryService incidentQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var requestErrors = ValidateCreateIncidentTimelineEventRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var createdByUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (createdByUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for timeline write operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var createdEventId = await incidentQueryService.CreateIncidentTimelineEventAsync(incidentId, request, createdByUserId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            createdByUserId.Value,
            "INCIDENT",
            "INCIDENT_TIMELINE_EVENT_CREATE",
            "ic",
            "IncidentTimelineEvent",
            createdEventId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                incidentTimelineEventId = createdEventId,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Created($"/api/v1/incidents/{incidentId}/timeline/{createdEventId}", new { incidentTimelineEventId = createdEventId });
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CreateIncidentTimelineEvent");

incidents.MapGet("/{incidentId:long}/communications", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var items = await incidentQueryService.GetIncidentCommunicationsAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "COMMUNICATION",
            "INCIDENT_COMMUNICATIONS_VIEW",
            "ic",
            "IncidentCommunication",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                communicationCount = items.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(items);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentCommunications");

incidents.MapGet("/{incidentId:long}/communications/lifecycle-summary", async (
    long incidentId,
    DateTimeOffset? fromUtc,
    DateTimeOffset? toUtc,
    IIncidentQueryService incidentQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (fromUtc.HasValue && toUtc.HasValue && fromUtc.Value > toUtc.Value)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["dateRange"] = ["fromUtc cannot be greater than toUtc."]
        });
    }

    var summary = await incidentQueryService.GetIncidentCommunicationLifecycleSummaryAsync(incidentId, fromUtc, toUtc, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "COMMUNICATION",
            "INCIDENT_COMMUNICATION_LIFECYCLE_SUMMARY_VIEW",
            "ic",
            "IncidentCommunication",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                fromUtc,
                toUtc,
                summary.TotalCommunications,
                summary.TotalNotifications,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(summary);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentCommunicationLifecycleSummary");

incidents.MapGet("/{incidentId:long}/communications/evidence/export/csv", async (
    long incidentId,
    DateTimeOffset? fromUtc,
    DateTimeOffset? toUtc,
    ClaimsPrincipal user,
    HttpContext httpContext,
    IIncidentQueryService incidentQueryService,
    IAlertQueryService alertQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (fromUtc.HasValue && toUtc.HasValue && fromUtc.Value > toUtc.Value)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["dateRange"] = ["fromUtc cannot be greater than toUtc."]
        });
    }

    var resolvedUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (resolvedUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var summary = await incidentQueryService.GetIncidentCommunicationLifecycleSummaryAsync(incidentId, fromUtc, toUtc, cancellationToken);
    var communications = await incidentQueryService.GetIncidentCommunicationsAsync(incidentId, cancellationToken);

    var filteredCommunications = communications
        .Where(item => (!fromUtc.HasValue || item.LoggedUtc >= fromUtc.Value) && (!toUtc.HasValue || item.LoggedUtc <= toUtc.Value))
        .OrderBy(item => item.LoggedUtc)
        .ToArray();

    var notificationIds = filteredCommunications
        .Where(item => item.NotificationId.HasValue && item.NotificationId.Value > 0)
        .Select(item => item.NotificationId!.Value)
        .Distinct()
        .OrderBy(value => value)
        .ToArray();

    var recipientRows = new List<(long NotificationId, NotificationRecipientDto Recipient)>();

    static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        return value.Replace("\"", "\"\"");
    }

    foreach (var notificationId in notificationIds)
    {
        var recipients = await alertQueryService.GetNotificationRecipientsAsync(resolvedUserId.Value, notificationId, cancellationToken);
        foreach (var recipient in recipients)
        {
            recipientRows.Add((notificationId, recipient));
        }
    }

    var lines = new List<string>
    {
        "Section,Metric,Value",
        $"\"RANGE\",\"GeneratedUtc\",\"{DateTimeOffset.UtcNow:O}\"",
        $"\"RANGE\",\"IncidentId\",\"{incidentId}\"",
        $"\"RANGE\",\"FromUtc\",\"{(fromUtc.HasValue ? fromUtc.Value.ToString("O") : string.Empty)}\"",
        $"\"RANGE\",\"ToUtc\",\"{(toUtc.HasValue ? toUtc.Value.ToString("O") : string.Empty)}\"",
        $"\"RANGE\",\"CommunicationRows\",\"{filteredCommunications.Length}\"",
        "",
        "Section,Metric,Value",
        $"\"SUMMARY\",\"TotalCommunications\",\"{summary.TotalCommunications}\"",
        $"\"SUMMARY\",\"CommunicationsWithNotifications\",\"{summary.CommunicationsWithNotifications}\"",
        $"\"SUMMARY\",\"TotalNotifications\",\"{summary.TotalNotifications}\"",
        $"\"SUMMARY\",\"TotalRecipients\",\"{summary.TotalRecipients}\"",
        $"\"SUMMARY\",\"SentRecipients\",\"{summary.SentRecipients}\"",
        $"\"SUMMARY\",\"FailedRecipients\",\"{summary.FailedRecipients}\"",
        $"\"SUMMARY\",\"AcknowledgedRecipients\",\"{summary.AcknowledgedRecipients}\"",
        "",
        "Channel,Recipients,Sent,Failed",
        $"\"EMAIL\",\"{summary.EmailRecipients}\",\"{summary.EmailSentRecipients}\",\"{summary.EmailFailedRecipients}\"",
        $"\"SMS\",\"{summary.SmsRecipients}\",\"{summary.SmsSentRecipients}\",\"{summary.SmsFailedRecipients}\"",
        $"\"VOICE\",\"{summary.VoiceRecipients}\",\"{summary.VoiceSentRecipients}\",\"{summary.VoiceFailedRecipients}\"",
        $"\"PUSH\",\"{summary.PushRecipients}\",\"{summary.PushSentRecipients}\",\"{summary.PushFailedRecipients}\"",
        "",
        "LoggedUtc,Channel,Direction,Subject,Message,Status,NotificationId,CreatedBy,CreatedUtc,UpdatedUtc"
    };

    foreach (var item in filteredCommunications)
    {
        lines.Add($"\"{item.LoggedUtc:O}\",\"{EscapeCsv(item.ChannelCode)}\",\"{EscapeCsv(item.DirectionCode)}\",\"{EscapeCsv(RedactNarrativeTextForExport(item.Subject))}\",\"{EscapeCsv(RedactNarrativeTextForExport(item.Message))}\",\"{EscapeCsv(item.StatusCode)}\",\"{(item.NotificationId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty)}\",\"{EscapeCsv(item.CreatedByUserDisplayName)}\",\"{item.CreatedUtc:O}\",\"{(item.UpdatedUtc.HasValue ? item.UpdatedUtc.Value.ToString("O") : string.Empty)}\"");
    }

    lines.Add(string.Empty);
    lines.Add("NotificationId,NotificationRecipientId,Channel,DestinationAddress,DeliveryStatus,AcknowledgedUtc,FailureReason,UserId,ContactId,LocationId");

    foreach (var row in recipientRows.OrderBy(item => item.NotificationId).ThenBy(item => item.Recipient.NotificationRecipientId))
    {
        var recipient = row.Recipient;
        lines.Add($"\"{row.NotificationId}\",\"{recipient.NotificationRecipientId}\",\"{EscapeCsv(recipient.ChannelCode)}\",\"{EscapeCsv(RedactNotificationDestinationAddress(recipient.DestinationAddress))}\",\"{EscapeCsv(recipient.DeliveryStatusCode)}\",\"{(recipient.AcknowledgedUtc.HasValue ? recipient.AcknowledgedUtc.Value.ToString("O") : string.Empty)}\",\"{EscapeCsv(RedactNarrativeTextForExport(recipient.FailureReason))}\",\"{(recipient.UserId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty)}\",\"{(recipient.ContactId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty)}\",\"{(recipient.LocationId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty)}\"");
    }

    var fileContent = string.Join("\n", lines);
    var fileBytes = Encoding.UTF8.GetBytes(fileContent);
    var fileName = $"incident-communication-evidence-{incidentId}-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}.csv";

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            resolvedUserId,
            "COMMUNICATION",
            "COMMUNICATION_EVIDENCE_EXPORT_CSV",
            "ic",
            "IncidentCommunication",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                fromUtc,
                toUtc,
                communicationRows = filteredCommunications.Length,
                recipientRows = recipientRows.Count,
                fileName,
                traceId = httpContext.TraceIdentifier,
            })),
        cancellationToken);

    return Results.File(fileBytes, "text/csv", fileName);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.RequireRateLimiting("SensitiveExportLimiter")
.WithName("ExportIncidentCommunicationEvidenceCsv");

incidents.MapPost("/{incidentId:long}/communications", async (long incidentId, CreateIncidentCommunicationRequestDto request, ClaimsPrincipal user, IIncidentQueryService incidentQueryService, IAlertQueryService alertQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var requestErrors = ValidateCreateIncidentCommunicationRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var createdByUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (createdByUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for communication write operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var normalizedRequest = request;
    if (request.NotificationRecipients is { Count: > 0 }
        && string.IsNullOrWhiteSpace(request.NotificationTypeCode) is false
        && string.IsNullOrWhiteSpace(request.NotificationPriorityCode) is false)
    {
        var dispatchRequest = new CreateCommunicationDispatchRequestDto(
            incidentId,
            request.NotificationTypeCode.Trim().ToUpperInvariant(),
            request.Subject.Trim(),
            request.Message.Trim(),
            request.NotificationPriorityCode.Trim(),
            request.NotificationRecipients
                .Select(recipient => new CommunicationRecipientRequestDto(
                    recipient.UserId,
                    recipient.ContactId,
                    recipient.LocationId,
                    recipient.ChannelCode.Trim().ToUpperInvariant(),
                    recipient.DestinationAddress.Trim()))
                .ToArray());

        var notificationDispatch = await alertQueryService.CreateCommunicationDispatchAsync(
            createdByUserId.Value,
            dispatchRequest,
            cancellationToken);

        normalizedRequest = request with { NotificationId = notificationDispatch.NotificationId };
    }

    var incidentCommunicationId = await incidentQueryService.CreateIncidentCommunicationAsync(incidentId, normalizedRequest, createdByUserId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            createdByUserId.Value,
            "COMMUNICATION",
            "INCIDENT_COMMUNICATION_CREATE",
            "ic",
            "IncidentCommunication",
            incidentCommunicationId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                incidentCommunicationId,
                notificationId = normalizedRequest.NotificationId,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Created($"/api/v1/incidents/{incidentId}/communications/{incidentCommunicationId}", new { incidentCommunicationId });
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CreateIncidentCommunication");

incidents.MapPost("/{incidentId:long}/communications/{incidentCommunicationId:long}", async (long incidentId, long incidentCommunicationId, UpdateIncidentCommunicationRequestDto request, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (incidentCommunicationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentCommunicationId"] = ["incidentCommunicationId must be greater than zero."]
        });
    }

    var requestErrors = ValidateUpdateIncidentCommunicationRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var success = await incidentQueryService.UpdateIncidentCommunicationAsync(incidentId, incidentCommunicationId, request, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "COMMUNICATION",
                "INCIDENT_COMMUNICATION_UPDATE",
                "ic",
                "IncidentCommunication",
                incidentCommunicationId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    incidentCommunicationId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("UpdateIncidentCommunication");

incidents.MapGet("/{incidentId:long}/resources", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var items = await incidentQueryService.GetIncidentResourceRequestsAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "RESOURCE",
            "INCIDENT_RESOURCE_REQUESTS_VIEW",
            "ic",
            "IncidentResourceRequest",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                requestCount = items.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(items);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentResourceRequests");

incidents.MapGet("/{incidentId:long}/resources/lifecycle-summary", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var summary = await incidentQueryService.GetIncidentResourceLifecycleSummaryAsync(incidentId, cancellationToken);
    return Results.Ok(summary);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentResourceLifecycleSummary");

incidents.MapGet("/{incidentId:long}/resources/evidence/export/csv", async (
    long incidentId,
    string? statusCode,
    ClaimsPrincipal user,
    HttpContext httpContext,
    IIncidentQueryService incidentQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var resolvedUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (resolvedUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var summary = await incidentQueryService.GetIncidentResourceLifecycleSummaryAsync(incidentId, cancellationToken);
    var requests = await incidentQueryService.GetIncidentResourceRequestsAsync(incidentId, cancellationToken);
    var normalizedStatusCode = string.IsNullOrWhiteSpace(statusCode) ? null : statusCode.Trim();

    var filteredRequests = normalizedStatusCode is null
        ? requests
        : requests.Where(item => string.Equals(item.StatusCode, normalizedStatusCode, StringComparison.OrdinalIgnoreCase)).ToArray();

    static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        return value.Replace("\"", "\"\"");
    }

    static string DecimalToCsv(decimal value) => value.ToString(CultureInfo.InvariantCulture);

    var lines = new List<string>
    {
        "Section,Metric,Value",
        $"\"RANGE\",\"GeneratedUtc\",\"{DateTimeOffset.UtcNow:O}\"",
        $"\"RANGE\",\"IncidentId\",\"{incidentId}\"",
        $"\"RANGE\",\"StatusFilter\",\"{EscapeCsv(normalizedStatusCode)}\"",
        $"\"RANGE\",\"ResourceRows\",\"{filteredRequests.Count}\"",
        "",
        "Section,Metric,Value",
        $"\"SUMMARY\",\"TotalRequests\",\"{summary.TotalRequests}\"",
        $"\"SUMMARY\",\"RequestedRequests\",\"{summary.RequestedRequests}\"",
        $"\"SUMMARY\",\"ApprovedRequests\",\"{summary.ApprovedRequests}\"",
        $"\"SUMMARY\",\"PartiallyFulfilledRequests\",\"{summary.PartiallyFulfilledRequests}\"",
        $"\"SUMMARY\",\"FulfilledRequests\",\"{summary.FulfilledRequests}\"",
        $"\"SUMMARY\",\"DeniedRequests\",\"{summary.DeniedRequests}\"",
        $"\"SUMMARY\",\"CancelledRequests\",\"{summary.CancelledRequests}\"",
        $"\"SUMMARY\",\"ArchivedRequests\",\"{summary.ArchivedRequests}\"",
        $"\"SUMMARY\",\"OpenUnassignedRequests\",\"{summary.OpenUnassignedRequests}\"",
        $"\"SUMMARY\",\"TotalRequestedQuantity\",\"{DecimalToCsv(summary.TotalRequestedQuantity)}\"",
        $"\"SUMMARY\",\"TotalAssignedQuantity\",\"{DecimalToCsv(summary.TotalAssignedQuantity)}\"",
        "",
        "RequestedUtc,ResourceTypeCode,ResourceTypeName,RequestedQuantity,AssignedQuantity,UnitOfMeasure,Priority,Status,RequestedBy,Notes,CreatedUtc,UpdatedUtc"
    };

    foreach (var item in filteredRequests.OrderByDescending(item => item.RequestedUtc))
    {
        lines.Add($"\"{item.RequestedUtc:O}\",\"{EscapeCsv(item.ResourceTypeCode)}\",\"{EscapeCsv(item.ResourceTypeName)}\",\"{DecimalToCsv(item.RequestedQuantity)}\",\"{(item.AssignedQuantity.HasValue ? DecimalToCsv(item.AssignedQuantity.Value) : string.Empty)}\",\"{EscapeCsv(item.UnitOfMeasureCode)}\",\"{EscapeCsv(item.PriorityCode)}\",\"{EscapeCsv(item.StatusCode)}\",\"{EscapeCsv(item.RequestedByUserDisplayName)}\",\"{EscapeCsv(RedactNarrativeTextForExport(item.Notes))}\",\"{item.CreatedUtc:O}\",\"{(item.UpdatedUtc.HasValue ? item.UpdatedUtc.Value.ToString("O") : string.Empty)}\"");
    }

    var fileContent = string.Join("\n", lines);
    var fileBytes = Encoding.UTF8.GetBytes(fileContent);
    var fileName = $"incident-resource-evidence-{incidentId}-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}.csv";

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            resolvedUserId,
            "RESOURCE",
            "RESOURCE_EVIDENCE_EXPORT_CSV",
            "ic",
            "IncidentResourceRequest",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                statusCode = normalizedStatusCode,
                resourceRows = filteredRequests.Count,
                fileName,
                traceId = httpContext.TraceIdentifier,
            })),
        cancellationToken);

    return Results.File(fileBytes, "text/csv", fileName);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.RequireRateLimiting("SensitiveExportLimiter")
.WithName("ExportIncidentResourceEvidenceCsv");

incidents.MapGet("/{incidentId:long}/resources/lifecycle-evidence/export/json", async (
    long incidentId,
    ClaimsPrincipal user,
    HttpContext httpContext,
    IIncidentQueryService incidentQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var resolvedUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (resolvedUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var summary = await incidentQueryService.GetIncidentResourceLifecycleSummaryAsync(incidentId, cancellationToken);
    var requests = await incidentQueryService.GetIncidentResourceRequestsAsync(incidentId, cancellationToken);
    var nowUtc = DateTimeOffset.UtcNow;

    var statuses = requests
        .Select(item => item.StatusCode?.Trim() ?? string.Empty)
        .Where(item => item.Length > 0)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    var transitionCoverage = new
    {
        requestedToApproved = statuses.Contains("Requested") && statuses.Contains("Approved"),
        approvedToFulfillment = statuses.Contains("Approved") && (statuses.Contains("PartiallyFulfilled") || statuses.Contains("Fulfilled")),
        terminalDispositionObserved = statuses.Contains("Denied") || statuses.Contains("Cancelled") || statuses.Contains("Archived")
    };

    var blockedReasons = new List<string>();
    if (summary.TotalRequests == 0)
    {
        blockedReasons.Add("No incident resource requests recorded.");
    }

    if (summary.OpenUnassignedRequests > 0)
    {
        blockedReasons.Add($"{summary.OpenUnassignedRequests} request(s) remain open and unassigned.");
    }

    if (!transitionCoverage.requestedToApproved)
    {
        blockedReasons.Add("Requested→Approved transition evidence not yet observed.");
    }

    if (!transitionCoverage.approvedToFulfillment)
    {
        blockedReasons.Add("Approved→Fulfillment transition evidence not yet observed.");
    }

    var payload = new
    {
        incidentId,
        generatedUtc = nowUtc,
        lifecycleSummary = summary,
        transitionCoverage,
        routingLaneBreakdown = new
        {
            requested = requests.Count(item => string.Equals(item.StatusCode, "Requested", StringComparison.OrdinalIgnoreCase)),
            approved = requests.Count(item => string.Equals(item.StatusCode, "Approved", StringComparison.OrdinalIgnoreCase)),
            partiallyFulfilled = requests.Count(item => string.Equals(item.StatusCode, "PartiallyFulfilled", StringComparison.OrdinalIgnoreCase)),
            fulfilled = requests.Count(item => string.Equals(item.StatusCode, "Fulfilled", StringComparison.OrdinalIgnoreCase)),
            denied = requests.Count(item => string.Equals(item.StatusCode, "Denied", StringComparison.OrdinalIgnoreCase)),
            cancelled = requests.Count(item => string.Equals(item.StatusCode, "Cancelled", StringComparison.OrdinalIgnoreCase)),
            archived = requests.Count(item => string.Equals(item.StatusCode, "Archived", StringComparison.OrdinalIgnoreCase)),
        },
        blockedReasons,
        acceptanceChecklist = new[]
        {
            new
            {
                check = "Request intake and approval flow observed",
                status = transitionCoverage.requestedToApproved ? "Pass" : "Pending",
                evidence = transitionCoverage.requestedToApproved
                    ? "Requested and Approved statuses are present in lifecycle data."
                    : "Requested and Approved status sequence has not both been observed."
            },
            new
            {
                check = "Routing to assignment/fulfillment flow observed",
                status = transitionCoverage.approvedToFulfillment ? "Pass" : "Pending",
                evidence = transitionCoverage.approvedToFulfillment
                    ? "Approved and fulfillment statuses are present in lifecycle data."
                    : "Approved-to-fulfillment sequence has not yet been observed."
            },
            new
            {
                check = "Open assignment gap controlled",
                status = summary.OpenUnassignedRequests == 0 ? "Pass" : "Pending",
                evidence = summary.OpenUnassignedRequests == 0
                    ? "No open unassigned requests remain."
                    : $"Open unassigned requests remaining: {summary.OpenUnassignedRequests}."
            }
        }
    };

    var content = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
    var fileName = $"incident-resource-lifecycle-evidence-{incidentId}-{nowUtc:yyyyMMddHHmmss}.json";

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            resolvedUserId,
            "RESOURCE",
            "RESOURCE_LIFECYCLE_EVIDENCE_EXPORT_JSON",
            "ic",
            "IncidentResourceRequest",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                summary.TotalRequests,
                summary.OpenUnassignedRequests,
                blockedReasonCount = blockedReasons.Count,
                fileName,
                traceId = httpContext.TraceIdentifier,
            })),
        cancellationToken);

    return Results.File(Encoding.UTF8.GetBytes(content), "application/json", fileName);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.RequireRateLimiting("SensitiveExportLimiter")
.WithName("ExportIncidentResourceLifecycleEvidenceJson");

incidents.MapPost("/{incidentId:long}/resources", async (long incidentId, CreateIncidentResourceRequestDto request, ClaimsPrincipal user, IIncidentQueryService incidentQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var requestErrors = ValidateCreateIncidentResourceRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var requestedByUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (requestedByUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for resource request write operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var incidentResourceRequestId = await incidentQueryService.CreateIncidentResourceRequestAsync(incidentId, request, requestedByUserId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            requestedByUserId.Value,
            "RESOURCE",
            "RESOURCE_REQUEST_CREATE",
            "ic",
            "IncidentResourceRequest",
            incidentResourceRequestId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                incidentResourceRequestId,
                request.ResourceTypeCode,
                request.RequestedQuantity,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Created($"/api/v1/incidents/{incidentId}/resources/{incidentResourceRequestId}", new { incidentResourceRequestId });
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CreateIncidentResourceRequest");

incidents.MapPost("/{incidentId:long}/resources/{incidentResourceRequestId:long}", async (
    long incidentId,
    long incidentResourceRequestId,
    UpdateIncidentResourceRequestDto request,
    ClaimsPrincipal user,
    IIncidentQueryService incidentQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (incidentResourceRequestId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentResourceRequestId"] = ["incidentResourceRequestId must be greater than zero."]
        });
    }

    var requestErrors = ValidateUpdateIncidentResourceRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var actorUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (actorUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for resource request update operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var existingRequests = await incidentQueryService.GetIncidentResourceRequestsAsync(incidentId, cancellationToken);
    var existingRequest = existingRequests.FirstOrDefault(item => item.IncidentResourceRequestId == incidentResourceRequestId);
    if (existingRequest is null)
    {
        return Results.NotFound();
    }

    if (!IsResourceStatusTransitionAllowed(existingRequest.StatusCode, request.StatusCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["statusCode"] = [$"Status transition from {existingRequest.StatusCode} to {request.StatusCode.Trim()} is not allowed."]
        });
    }

    var success = await incidentQueryService.UpdateIncidentResourceRequestAsync(incidentId, incidentResourceRequestId, request, cancellationToken);
    if (!success)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            actorUserId,
            "RESOURCE",
            "RESOURCE_REQUEST_STATUS_TRANSITION",
            "ic",
            "IncidentResourceRequest",
            incidentResourceRequestId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                incidentResourceRequestId,
                previousStatusCode = existingRequest.StatusCode,
                targetStatusCode = request.StatusCode.Trim(),
                requestedQuantity = request.RequestedQuantity,
                assignedQuantity = request.AssignedQuantity,
                traceId = httpContext.TraceIdentifier,
            })),
        cancellationToken);

    return Results.NoContent();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("UpdateIncidentResourceRequest");

incidents.MapGet("/{incidentId:long}/operational-periods", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var periods = await incidentQueryService.GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "INCIDENT_OPERATIONAL_PERIODS_VIEW",
            "ic",
            "IncidentOperationalPeriod",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                periodCount = periods.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(periods);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentOperationalPeriods");

incidents.MapPost("/{incidentId:long}/operational-periods", async (long incidentId, CreateIncidentOperationalPeriodRequestDto request, ClaimsPrincipal user, IIncidentQueryService incidentQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var requestErrors = ValidateCreateIncidentOperationalPeriodRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var createdByUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (createdByUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for operational period write operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var createdOperationalPeriodId = await incidentQueryService.CreateIncidentOperationalPeriodAsync(incidentId, request, createdByUserId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            createdByUserId.Value,
            "INCIDENT",
            "INCIDENT_OPERATIONAL_PERIOD_CREATE",
            "ic",
            "IncidentOperationalPeriod",
            createdOperationalPeriodId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                operationalPeriodId = createdOperationalPeriodId,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Created($"/api/v1/incidents/{incidentId}/operational-periods/{createdOperationalPeriodId}", new { operationalPeriodId = createdOperationalPeriodId });
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CreateIncidentOperationalPeriod");

incidents.MapPost("/{incidentId:long}/operational-periods/{operationalPeriodId:long}", async (long incidentId, long operationalPeriodId, UpdateIncidentOperationalPeriodRequestDto request, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (operationalPeriodId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["operationalPeriodId"] = ["operationalPeriodId must be greater than zero."]
        });
    }

    var periods = await incidentQueryService.GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
    var targetPeriod = periods.FirstOrDefault(period => period.OperationalPeriodId == operationalPeriodId);
    if (targetPeriod is null)
    {
        return Results.NotFound();
    }

    if (!string.Equals(targetPeriod.StatusCode, "Planned", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(targetPeriod.StatusCode, "Active", StringComparison.OrdinalIgnoreCase))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["operationalPeriod"] = ["Only Planned or Active operational periods can be updated."]
        });
    }

    var requestErrors = ValidateUpdateIncidentOperationalPeriodRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var success = await incidentQueryService.UpdateIncidentOperationalPeriodAsync(incidentId, operationalPeriodId, request, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "INCIDENT",
                "INCIDENT_OPERATIONAL_PERIOD_UPDATE",
                "ic",
                "IncidentOperationalPeriod",
                operationalPeriodId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    operationalPeriodId,
                    request.StatusCode,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    if (!success)
    {
        return Results.Problem(
            title: "Operational period update could not be completed.",
            detail: "Operational period state changed before update completed. Refresh and retry.",
            statusCode: StatusCodes.Status409Conflict);
    }

    return Results.NoContent();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("UpdateIncidentOperationalPeriod");

incidents.MapPost("/{incidentId:long}/operational-periods/{operationalPeriodId:long}/approve", async (
    long incidentId,
    long operationalPeriodId,
    ClaimsPrincipal user,
    IIncidentQueryService incidentQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (operationalPeriodId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["operationalPeriodId"] = ["operationalPeriodId must be greater than zero."]
        });
    }

    var approvedByUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (approvedByUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for operational period approval.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var approvedUtc = DateTimeOffset.UtcNow;
    var success = await incidentQueryService.ApproveIncidentOperationalPeriodAsync(
        incidentId,
        operationalPeriodId,
        approvedByUserId.Value,
        approvedUtc,
        cancellationToken);

    if (!success)
    {
        return Results.Problem(
            title: "Operational period approval could not be completed.",
            detail: "Operational period state changed before approval completed. Refresh and retry.",
            statusCode: StatusCodes.Status409Conflict);
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            approvedByUserId,
            "DATA_CHANGE",
            "INCIDENT_OPERATIONAL_PERIOD_APPROVE",
            "ic",
            "IncidentOperationalPeriod",
            operationalPeriodId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                operationalPeriodId,
                approvedByUserId,
                approvedUtc,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("ApproveIncidentOperationalPeriod");

incidents.MapPost("/{incidentId:long}/operational-periods/{operationalPeriodId:long}/reopen", async (
    long incidentId,
    long operationalPeriodId,
    ClaimsPrincipal user,
    IIncidentQueryService incidentQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (operationalPeriodId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["operationalPeriodId"] = ["operationalPeriodId must be greater than zero."]
        });
    }

    var periods = await incidentQueryService.GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
    var targetPeriod = periods.FirstOrDefault(period => period.OperationalPeriodId == operationalPeriodId);
    if (targetPeriod is null)
    {
        return Results.NotFound();
    }

    if (!string.Equals(targetPeriod.StatusCode, "Approved", StringComparison.OrdinalIgnoreCase))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["operationalPeriod"] = ["Only Approved operational periods can be reopened."]
        });
    }

    var actorUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (actorUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for operational period reopen operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var reopenedUtc = DateTimeOffset.UtcNow;
    var success = await incidentQueryService.ReopenIncidentOperationalPeriodAsync(
        incidentId,
        operationalPeriodId,
        cancellationToken);

    if (!success)
    {
        return Results.Problem(
            title: "Operational period reopen could not be completed.",
            detail: "Operational period state changed before reopen completed. Refresh and retry.",
            statusCode: StatusCodes.Status409Conflict);
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            actorUserId,
            "DATA_CHANGE",
            "INCIDENT_OPERATIONAL_PERIOD_REOPEN",
            "ic",
            "IncidentOperationalPeriod",
            operationalPeriodId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                operationalPeriodId,
                actorUserId,
                reopenedUtc,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("ReopenIncidentOperationalPeriod");

incidents.MapGet("/{incidentId:long}/objectives", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var objectives = await incidentQueryService.GetIncidentObjectivesAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "INCIDENT_OBJECTIVES_VIEW",
            "ic",
            "IncidentObjective",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                objectiveCount = objectives.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(objectives);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentObjectives");

incidents.MapPost("/{incidentId:long}/objectives", async (long incidentId, CreateIncidentObjectiveRequestDto request, ClaimsPrincipal user, IIncidentQueryService incidentQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var requestErrors = ValidateCreateIncidentObjectiveRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var createdByUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (createdByUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for objective write operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var createdIncidentObjectiveId = await incidentQueryService.CreateIncidentObjectiveAsync(incidentId, request, createdByUserId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            createdByUserId.Value,
            "INCIDENT",
            "INCIDENT_OBJECTIVE_CREATE",
            "ic",
            "IncidentObjective",
            createdIncidentObjectiveId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                incidentObjectiveId = createdIncidentObjectiveId,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Created($"/api/v1/incidents/{incidentId}/objectives/{createdIncidentObjectiveId}", new { incidentObjectiveId = createdIncidentObjectiveId });
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CreateIncidentObjective");

incidents.MapPost("/{incidentId:long}/objectives/{incidentObjectiveId:long}", async (long incidentId, long incidentObjectiveId, UpdateIncidentObjectiveRequestDto request, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (incidentObjectiveId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentObjectiveId"] = ["incidentObjectiveId must be greater than zero."]
        });
    }

    var requestErrors = ValidateUpdateIncidentObjectiveRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var success = await incidentQueryService.UpdateIncidentObjectiveAsync(incidentId, incidentObjectiveId, request, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "INCIDENT",
                "INCIDENT_OBJECTIVE_UPDATE",
                "ic",
                "IncidentObjective",
                incidentObjectiveId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    incidentObjectiveId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("UpdateIncidentObjective");

incidents.MapGet("/{incidentId:long}/command-assignments", async (long incidentId, IIncidentQueryService incidentQueryService, ILogger<Program> logger, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    logger.LogInformation("[ICS-DIAG] GET /incidents/{IncidentId}/command-assignments requested.", incidentId);

    try
    {
        var assignments = await incidentQueryService.GetIncidentCommandAssignmentsAsync(incidentId, cancellationToken);

        logger.LogInformation("[ICS-DIAG] IncidentId {IncidentId} returned {AssignmentCount} assignment rows.", incidentId, assignments.Count);

        if (assignments.Count > 0)
        {
            var assignmentSnapshot = string.Join(" | ", assignments
                .Take(25)
                .Select(a => $"AssignmentId={a.IncidentCommandAssignmentId},PosId={a.IcsPositionId},Code={a.PositionCode},UserId={(a.AssignedUserId.HasValue ? a.AssignedUserId.Value.ToString() : "null")},User={a.AssignedUserDisplayName ?? "null"},Status={a.AssignmentStatusCode}"));

            logger.LogDebug("[ICS-DIAG] IncidentId {IncidentId} assignment snapshot: {AssignmentSnapshot}", incidentId, assignmentSnapshot);
        }

        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "INCIDENT",
                "INCIDENT_COMMAND_ASSIGNMENTS_VIEW",
                "ic",
                "IncidentCommandAssignment",
                incidentId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    assignmentCount = assignments.Count,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);

        return Results.Ok(assignments);
    }
    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
    {
        logger.LogWarning("[ICS-DIAG] GET command-assignments canceled for IncidentId {IncidentId}.", incidentId);
        return Results.StatusCode(StatusCodes.Status499ClientClosedRequest);
    }
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentCommandAssignments");

incidents.MapPut("/{incidentId:long}/command-assignments", async (long incidentId, UpsertIncidentCommandAssignmentRequestDto request, ClaimsPrincipal user, IIncidentQueryService incidentQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var requestErrors = ValidateUpsertCommandAssignmentRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var assignedByUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (assignedByUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for command assignment updates.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    await incidentQueryService.UpsertIncidentCommandAssignmentAsync(incidentId, request, assignedByUserId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            assignedByUserId.Value,
            "INCIDENT",
            "INCIDENT_COMMAND_ASSIGNMENT_UPSERT",
            "ic",
            "IncidentCommandAssignment",
            request.IcsPositionId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                request.IcsPositionId,
                request.AssignedUserId,
                request.AssignedContactId,
                request.AgencyOrganizationId,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("UpsertIncidentCommandAssignment");

incidents.MapDelete("/{incidentId:long}/command-assignments/{icsPositionId:int}", async (long incidentId, int icsPositionId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (icsPositionId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["icsPositionId"] = ["icsPositionId must be greater than zero."]
        });
    }

    var success = await incidentQueryService.RemoveIncidentCommandAssignmentAsync(incidentId, icsPositionId, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "INCIDENT",
                "INCIDENT_COMMAND_ASSIGNMENT_REMOVE",
                "ic",
                "IncidentCommandAssignment",
                icsPositionId.ToString(CultureInfo.InvariantCulture),
                incidentId,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    incidentId,
                    icsPositionId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("RemoveIncidentCommandAssignment");

incidents.MapGet("/{incidentId:long}/ics-201", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var ics201Data = await incidentQueryService.GetIcs201DataAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "ICS_201_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            ics201Data is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = ics201Data is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return ics201Data is not null ? Results.Ok(ics201Data) : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIcs201Data");

incidents.MapGet("/{incidentId:long}/ics-202", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var ics202Data = await incidentQueryService.GetIcs202DataAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "ICS_202_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            ics202Data is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = ics202Data is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return ics202Data is not null ? Results.Ok(ics202Data) : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIcs202Data");

incidents.MapGet("/{incidentId:long}/ics-203", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var ics203Data = await incidentQueryService.GetIcs203DataAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "ICS_203_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            ics203Data is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = ics203Data is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return ics203Data is not null ? Results.Ok(ics203Data) : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIcs203Data");

incidents.MapGet("/{incidentId:long}/ics-204", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var ics204Data = await incidentQueryService.GetIcs204DataAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "ICS_204_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            ics204Data is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = ics204Data is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return ics204Data is not null ? Results.Ok(ics204Data) : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIcs204Data");

incidents.MapGet("/{incidentId:long}/ics-205", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var ics205Data = await incidentQueryService.GetIcs205DataAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "ICS_205_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            ics205Data is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = ics205Data is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return ics205Data is not null ? Results.Ok(ics205Data) : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIcs205Data");

incidents.MapGet("/{incidentId:long}/ics-209", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var ics209Data = await incidentQueryService.GetIcs209DataAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "ICS_209_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            ics209Data is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = ics209Data is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return ics209Data is not null ? Results.Ok(ics209Data) : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIcs209Data");

incidents.MapGet("/{incidentId:long}/ics-214", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var ics214Data = await incidentQueryService.GetIcs214DataAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "ICS_214_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            ics214Data is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = ics214Data is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return ics214Data is not null ? Results.Ok(ics214Data) : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIcs214Data");

incidents.MapGet("/{incidentId:long}/ics-215", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var ics215Data = await incidentQueryService.GetIcs215DataAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "ICS_215_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            ics215Data is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = ics215Data is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return ics215Data is not null ? Results.Ok(ics215Data) : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIcs215Data");

incidents.MapGet("/{incidentId:long}/iap-packet", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var packet = await incidentQueryService.GetIncidentIapPacketAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "IAP_PACKET_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            packet is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = packet is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return packet is not null ? Results.Ok(packet) : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentIapPacket");

incidents.MapGet("/{incidentId:long}/iap-packet/print", async (long incidentId, IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var packet = await incidentQueryService.GetIncidentIapPacketAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "IAP_PACKET_PRINT_VIEW",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            packet is null ? "NotFound" : "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                found = packet is not null,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    if (packet is null)
    {
        return Results.NotFound();
    }

    var html = BuildIapPrintHtml(packet);
    return Results.Content(html, "text/html; charset=utf-8");
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetIncidentIapPacketPrintHtml");

incidents.MapGet("/{incidentId:long}/iap-packet/export/json", async (
    long incidentId,
    IIncidentQueryService incidentQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var periods = await incidentQueryService.GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
    var approvedPeriod = periods
        .Where(period => string.Equals(period.StatusCode, "Approved", StringComparison.OrdinalIgnoreCase))
        .OrderByDescending(period => period.StartUtc)
        .FirstOrDefault();

    if (approvedPeriod is null)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["operationalPeriod"] = ["At least one Approved operational period is required before exporting the IAP packet."]
        });
    }

    var packet = await incidentQueryService.GetIncidentIapPacketAsync(incidentId, cancellationToken);
    if (packet is null)
    {
        return Results.NotFound();
    }

    var payload = new
    {
        incidentId,
        exportUtc = DateTimeOffset.UtcNow,
        lockedOperationalPeriod = new
        {
            approvedPeriod.OperationalPeriodId,
            approvedPeriod.PeriodNumber,
            approvedPeriod.PeriodName,
            approvedPeriod.StartUtc,
            approvedPeriod.EndUtc,
            approvedPeriod.StatusCode,
            approvedPeriod.ApprovedUtc,
            approvedPeriod.ApprovedByUserId,
        },
        packet
    };

    var content = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
    var fileName = $"incident-{incidentId}-iap-packet.json";

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "IAP_PACKET_EXPORT_JSON",
            "ic",
            "IncidentOperationalPeriod",
            approvedPeriod.OperationalPeriodId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                approvedPeriod.OperationalPeriodId,
                approvedPeriod.PeriodNumber,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(Encoding.UTF8.GetBytes(content), "application/json", fileName);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("ExportIncidentIapPacketJson");

incidents.MapGet("/{incidentId:long}/iap-packet/export/print", async (
    long incidentId,
    IIncidentQueryService incidentQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var periods = await incidentQueryService.GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
    var approvedPeriod = periods
        .Where(period => string.Equals(period.StatusCode, "Approved", StringComparison.OrdinalIgnoreCase))
        .OrderByDescending(period => period.StartUtc)
        .FirstOrDefault();

    if (approvedPeriod is null)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["operationalPeriod"] = ["At least one Approved operational period is required before printing the IAP packet."]
        });
    }

    var packet = await incidentQueryService.GetIncidentIapPacketAsync(incidentId, cancellationToken);
    if (packet is null)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "IAP_PACKET_EXPORT_PRINT",
            "ic",
            "IncidentOperationalPeriod",
            approvedPeriod.OperationalPeriodId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                approvedPeriod.OperationalPeriodId,
                approvedPeriod.PeriodNumber,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    var html = BuildIapPrintHtml(packet);
    return Results.Content(html, "text/html; charset=utf-8");
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("ExportIncidentIapPacketPrintHtml");

incidents.MapGet("/{incidentId:long}/iap-governance/evidence/json", async (
    long incidentId,
    IIncidentQueryService incidentQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var periods = await incidentQueryService.GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
    var approvedPeriods = periods
        .Where(period => string.Equals(period.StatusCode, "Approved", StringComparison.OrdinalIgnoreCase))
        .OrderByDescending(period => period.StartUtc)
        .ToArray();
    var latestApprovedPeriod = approvedPeriods.FirstOrDefault();
    var packet = await incidentQueryService.GetIncidentIapPacketAsync(incidentId, cancellationToken);

    var blockedReasons = new List<string>();
    if (periods.Count == 0)
    {
        blockedReasons.Add("No operational periods recorded.");
    }

    if (latestApprovedPeriod is null)
    {
        blockedReasons.Add("At least one Approved operational period is required for IAP export/print.");
    }

    if (packet is null)
    {
        blockedReasons.Add("IAP packet payload is not currently available for export.");
    }

    var payload = new
    {
        incidentId,
        generatedUtc = DateTimeOffset.UtcNow,
        governance = new
        {
            operationalPeriodCount = periods.Count,
            approvedOperationalPeriodCount = approvedPeriods.Length,
            hasApprovedOperationalPeriod = latestApprovedPeriod is not null,
            hasIapPacketPayload = packet is not null,
            exportEligible = latestApprovedPeriod is not null && packet is not null,
            blockedReasons,
        },
        latestApprovedOperationalPeriod = latestApprovedPeriod is null
            ? null
            : new
            {
                latestApprovedPeriod.OperationalPeriodId,
                latestApprovedPeriod.PeriodNumber,
                latestApprovedPeriod.PeriodName,
                latestApprovedPeriod.StartUtc,
                latestApprovedPeriod.EndUtc,
                latestApprovedPeriod.ApprovedByUserId,
                latestApprovedPeriod.ApprovedUtc,
            },
        operationalPeriodStatusBreakdown = periods
            .GroupBy(period => period.StatusCode ?? "Unknown", StringComparer.OrdinalIgnoreCase)
            .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)
            .Select(group => new
            {
                statusCode = group.Key,
                count = group.Count()
            })
            .ToArray(),
        acceptanceChecklist = new[]
        {
            new
            {
                check = "Draft to approve transition",
                status = approvedPeriods.Length > 0 ? "Pass" : "Pending",
                evidence = approvedPeriods.Length > 0 ? "Approved operational period exists." : "No approved operational period found."
            },
            new
            {
                check = "Approve to reopen transition",
                status = periods.Any(period => string.Equals(period.StatusCode, "Active", StringComparison.OrdinalIgnoreCase)) && approvedPeriods.Length > 0 ? "Pass" : "Pending",
                evidence = periods.Any(period => string.Equals(period.StatusCode, "Active", StringComparison.OrdinalIgnoreCase)) && approvedPeriods.Length > 0
                    ? "Active and Approved period states both observed."
                    : "Observed data does not yet show both Approved and Active states."
            },
            new
            {
                check = "Export governance enforcement",
                status = latestApprovedPeriod is not null ? "Pass" : "Pending",
                evidence = latestApprovedPeriod is not null
                    ? "Export precondition satisfied by approved operational period."
                    : "Export precondition not yet met."
            }
        }
    };

    var content = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
    var fileName = $"incident-{incidentId}-iap-governance-evidence.json";

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "IAP_GOVERNANCE_EVIDENCE_EXPORT_JSON",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                approvedOperationalPeriodCount = approvedPeriods.Length,
                blockedReasonCount = blockedReasons.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(Encoding.UTF8.GetBytes(content), "application/json", fileName);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("ExportIncidentIapGovernanceEvidenceJson");

incidents.MapGet("/{incidentId:long}/situation-reports", async (
    long incidentId,
    IIncidentQueryService incidentQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var reports = await incidentQueryService.GetSituationReportsAsync(incidentId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "INCIDENT",
            "SITUATION_REPORTS_VIEW",
            "ic",
            "SituationReport",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                reportCount = reports.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(reports);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("GetSituationReports");

incidents.MapGet("/{incidentId:long}/after-action/evidence/export/json", async (
    long incidentId,
    ClaimsPrincipal user,
    HttpContext httpContext,
    IIncidentQueryService incidentQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    var resolvedUserId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (resolvedUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var timeline = await incidentQueryService.GetIncidentTimelineEventsAsync(incidentId, cancellationToken);
    var communications = await incidentQueryService.GetIncidentCommunicationsAsync(incidentId, cancellationToken);
    var resources = await incidentQueryService.GetIncidentResourceRequestsAsync(incidentId, cancellationToken);
    var situationReports = await incidentQueryService.GetSituationReportsAsync(incidentId, cancellationToken);

    var generatedUtc = DateTimeOffset.UtcNow;
    var latestTimelineUtc = timeline.OrderByDescending(item => item.EventUtc).FirstOrDefault()?.EventUtc;
    var latestCommunicationUtc = communications.OrderByDescending(item => item.LoggedUtc).FirstOrDefault()?.LoggedUtc;
    var latestResourceUtc = resources.OrderByDescending(item => item.RequestedUtc).FirstOrDefault()?.RequestedUtc;
    var latestSitrepUtc = situationReports.OrderByDescending(item => item.ReportedUtc).FirstOrDefault()?.ReportedUtc;

    var replayReadiness = timeline.Count > 0 && communications.Count > 0 && situationReports.Count > 0;
    var hvaReadiness = resources.Count > 0 && situationReports.Count > 0;

    var blockedReasons = new List<string>();
    if (timeline.Count == 0)
    {
        blockedReasons.Add("No incident timeline events available for replay packaging.");
    }

    if (communications.Count == 0)
    {
        blockedReasons.Add("No incident communications available for AAR communication traceability.");
    }

    if (resources.Count == 0)
    {
        blockedReasons.Add("No incident resource requests available for HVA demand/supply profiling.");
    }

    if (situationReports.Count == 0)
    {
        blockedReasons.Add("No situation reports available for retrospective narrative alignment.");
    }

    var payload = new
    {
        incidentId,
        generatedUtc,
        readiness = new
        {
            replayReady = replayReadiness,
            hvaReady = hvaReadiness,
            communicationTraceReady = communications.Count > 0,
            timelineReady = timeline.Count > 0,
            situationReportReady = situationReports.Count > 0,
        },
        evidenceSummary = new
        {
            timelineCount = timeline.Count,
            communicationCount = communications.Count,
            resourceRequestCount = resources.Count,
            situationReportCount = situationReports.Count,
            latestTimelineUtc,
            latestCommunicationUtc,
            latestResourceUtc,
            latestSituationReportUtc = latestSitrepUtc,
        },
        blockedReasons,
        acceptanceChecklist = new[]
        {
            new
            {
                check = "Incident replay baseline",
                status = replayReadiness ? "Pass" : "Pending",
                evidence = replayReadiness
                    ? "Timeline, communications, and SITREP evidence signals are present."
                    : "Replay evidence baseline is incomplete."
            },
            new
            {
                check = "AAR package evidence baseline",
                status = situationReports.Count > 0 && communications.Count > 0 ? "Pass" : "Pending",
                evidence = situationReports.Count > 0 && communications.Count > 0
                    ? "Situation reports and communications evidence are present."
                    : "Situation report and communication evidence pairing is incomplete."
            },
            new
            {
                check = "HVA starter evidence baseline",
                status = hvaReadiness ? "Pass" : "Pending",
                evidence = hvaReadiness
                    ? "Resource and SITREP evidence signals support HVA starter generation."
                    : "Resource/SITREP evidence coverage is insufficient for HVA starter generation."
            }
        }
    };

    var content = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
    var fileName = $"incident-after-action-evidence-{incidentId}-{generatedUtc:yyyyMMddHHmmss}.json";

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            resolvedUserId,
            "REPORTING",
            "AFTER_ACTION_EVIDENCE_EXPORT_JSON",
            "ic",
            "Incident",
            incidentId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                timelineCount = timeline.Count,
                communicationCount = communications.Count,
                resourceCount = resources.Count,
                sitrepCount = situationReports.Count,
                blockedReasonCount = blockedReasons.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(Encoding.UTF8.GetBytes(content), "application/json", fileName);
})
.RequireAuthorization(AuthorizationPolicies.IncidentViewer)
.WithName("ExportIncidentAfterActionEvidenceJson");

incidents.MapPost("/{incidentId:long}/situation-reports", async (
    long incidentId,
    GenerateSituationReportRequestDto request,
    ClaimsPrincipal user,
    IIncidentQueryService incidentQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero."]
        });
    }

    if (string.IsNullOrWhiteSpace(request.Summary))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["Summary"] = ["Summary is required."]
        });
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for situation report generation.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var situationReportId = await incidentQueryService.CreateSituationReportAsync(incidentId, request, userId.Value, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "INCIDENT",
            "SITUATION_REPORT_CREATE",
            "ic",
            "SituationReport",
            situationReportId.ToString(CultureInfo.InvariantCulture),
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                situationReportId,
                summaryLength = request.Summary.Length,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Created($"/api/v1/incidents/{incidentId}/situation-reports/{situationReportId}", new { situationReportId });
})
.RequireAuthorization(AuthorizationPolicies.IncidentCommander)
.WithName("CreateSituationReport");

var lookups = apiV1.MapGroup("/lookups");

lookups.MapGet("/ics-positions", async (IIncidentQueryService incidentQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var positions = await incidentQueryService.GetIcsPositionsAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "LOOKUP",
            "ICS_POSITIONS_VIEW",
            "ref",
            "IcsPosition",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                count = positions.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(positions);
})
.CacheOutput(p => p.Expire(TimeSpan.FromHours(1)))
.RequireAuthorization(AuthorizationPolicies.LookupViewer)
.WithName("GetIcsPositions");

var users = apiV1.MapGroup("/users");

var reports = apiV1.MapGroup("/reports").RequireAuthorization(AuthorizationPolicies.IncidentViewer);

reports.MapGet("/audit-events", async (
    long? incidentId,
    string? eventCategory,
    string? outcomeCode,
    DateTimeOffset? fromUtc,
    DateTimeOffset? toUtc,
    int? pageNumber,
    int? pageSize,
    IAuditEventQueryService auditEventQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId is <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero when provided."]
        });
    }

    if (fromUtc.HasValue && toUtc.HasValue && fromUtc.Value > toUtc.Value)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["dateRange"] = ["fromUtc cannot be greater than toUtc."]
        });
    }

    var normalizedPageNumber = Math.Max(1, pageNumber ?? 1);
    var normalizedPageSize = Math.Clamp(pageSize ?? 50, 1, 200);
    var (items, totalCount) = await auditEventQueryService.GetAuditEventsAsync(
        incidentId,
        eventCategory,
        outcomeCode,
        fromUtc,
        toUtc,
        normalizedPageNumber,
        normalizedPageSize,
        eventAction: null,
        cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "AUDIT_EVIDENCE_VIEW",
            "audit",
            "AuditEvent",
            null,
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                eventCategory,
                outcomeCode,
                fromUtc,
                toUtc,
                pageNumber = normalizedPageNumber,
                pageSize = normalizedPageSize,
                itemCount = items.Count,
                totalCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new
    {
        items,
        totalCount,
        pageNumber = normalizedPageNumber,
        pageSize = normalizedPageSize
    });
})
.WithName("GetAuditEvents");

reports.MapGet("/audit-events/export/csv", async (
    long? incidentId,
    string? eventCategory,
    string? outcomeCode,
    DateTimeOffset? fromUtc,
    DateTimeOffset? toUtc,
    int? pageNumber,
    int? pageSize,
    IAuditEventQueryService auditEventQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (incidentId is <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["incidentId"] = ["incidentId must be greater than zero when provided."]
        });
    }

    if (fromUtc.HasValue && toUtc.HasValue && fromUtc.Value > toUtc.Value)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["dateRange"] = ["fromUtc cannot be greater than toUtc."]
        });
    }

    var normalizedPageNumber = Math.Max(1, pageNumber ?? 1);
    var normalizedPageSize = Math.Clamp(pageSize ?? 50, 1, 200);
    var (items, totalCount) = await auditEventQueryService.GetAuditEventsAsync(
        incidentId,
        eventCategory,
        outcomeCode,
        fromUtc,
        toUtc,
        normalizedPageNumber,
        normalizedPageSize,
        eventAction: null,
        cancellationToken);

    var csv = BuildAuditEventExportCsv(items);
    var exportUtc = DateTimeOffset.UtcNow;
    var fileName = $"audit-evidence-{exportUtc:yyyyMMdd-HHmmss}.csv";
    var reportBytes = Encoding.UTF8.GetBytes(csv);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "AUDIT_EVIDENCE_EXPORT_CSV",
            "audit",
            "AuditEvent",
            null,
            incidentId,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                incidentId,
                eventCategory,
                outcomeCode,
                fromUtc,
                toUtc,
                pageNumber = normalizedPageNumber,
                pageSize = normalizedPageSize,
                exportedRowCount = items.Count,
                totalCount,
                fileName,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    app.Logger.LogWarning(
        "Audit evidence exported to CSV. ActorUserId={ActorUserId}, IncidentId={IncidentId}, EventCategory={EventCategory}, OutcomeCode={OutcomeCode}, ExportedRowCount={ExportedRowCount}, TraceId={TraceId}",
        httpContext.TryGetActorUserId(),
        incidentId,
        eventCategory,
        outcomeCode,
        items.Count,
        httpContext.TraceIdentifier);

    return Results.File(reportBytes, "text/csv", fileName);
})
.RequireRateLimiting("SensitiveExportLimiter")
.WithName("ExportAuditEventsCsv");

reports.MapGet("/external-provider-health/governance/export/csv", async (
    string? provider,
    int? windowHours,
    int? bucketMinutes,
    IConfiguration configuration,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var normalizedWindowHours = Math.Clamp(windowHours ?? 24 * 30, 1, 24 * 90);
    var normalizedBucketMinutes = Math.Clamp(bucketMinutes ?? 60, 5, 24 * 60);
    var normalizedProvider = string.IsNullOrWhiteSpace(provider) ? null : provider.Trim();
    var windowStartUtc = DateTimeOffset.UtcNow.AddHours(-normalizedWindowHours);

    IReadOnlyList<ExternalProviderTelemetryEvent> sourceEvents;

    if (externalProviderTelemetryPersistToSql && !string.IsNullOrWhiteSpace(configuration.GetConnectionString("IocEm")))
    {
        sourceEvents = await ReadProviderTelemetryEventsFromWarehouseAsync(
            configuration.GetConnectionString("IocEm")!,
            null,
            normalizedProvider,
            windowStartUtc,
            cancellationToken);
    }
    else
    {
        sourceEvents = providerTelemetryHistory
            .Where(item => item.EventUtc >= windowStartUtc
                && (normalizedProvider is null || string.Equals(item.Provider, normalizedProvider, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(item => item.EventUtc)
            .ToArray();
    }

    var csv = BuildExternalProviderGovernanceExportCsv(
        sourceEvents,
        normalizedProvider,
        normalizedWindowHours,
        normalizedBucketMinutes,
        DateTimeOffset.UtcNow);

    var exportUtc = DateTimeOffset.UtcNow;
    var fileName = $"external-provider-governance-{exportUtc:yyyyMMdd-HHmmss}.csv";
    var fileBytes = Encoding.UTF8.GetBytes(csv);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "EXTERNAL_PROVIDER_GOVERNANCE_EXPORT_CSV",
            "ops",
            "ExternalProviderTelemetryEvent",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                provider = normalizedProvider,
                windowHours = normalizedWindowHours,
                bucketMinutes = normalizedBucketMinutes,
                sourceEventCount = sourceEvents.Count,
                persistedToSql = externalProviderTelemetryPersistToSql,
                fileName,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(fileBytes, "text/csv", fileName);
})
.RequireRateLimiting("SensitiveExportLimiter")
.WithName("ExportExternalProviderHealthGovernanceCsv");

reports.MapGet("/external-provider-health/scorecards/export/csv", async (
    string? provider,
    int? rollingDays,
    IConfiguration configuration,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var normalizedRollingDays = Math.Clamp(rollingDays ?? 30, 1, 180);
    var normalizedProvider = string.IsNullOrWhiteSpace(provider) ? null : provider.Trim();
    var now = DateTimeOffset.UtcNow;
    var windowStartUtc = now.AddDays(-normalizedRollingDays);

    IReadOnlyList<ExternalProviderTelemetryEvent> sourceEvents;
    if (externalProviderTelemetryPersistToSql && !string.IsNullOrWhiteSpace(configuration.GetConnectionString("IocEm")))
    {
        sourceEvents = await ReadProviderTelemetryEventsFromWarehouseAsync(
            configuration.GetConnectionString("IocEm")!,
            null,
            normalizedProvider,
            windowStartUtc,
            cancellationToken);
    }
    else
    {
        sourceEvents = providerTelemetryHistory
            .Where(item => item.EventUtc >= windowStartUtc
                && (normalizedProvider is null || string.Equals(item.Provider, normalizedProvider, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(item => item.EventUtc)
            .ToArray();
    }

    var csv = BuildExternalProviderExecutiveScorecardCsv(sourceEvents, normalizedProvider, normalizedRollingDays, now);
    var fileName = $"external-provider-scorecard-{now:yyyyMMdd-HHmmss}.csv";
    var fileBytes = Encoding.UTF8.GetBytes(csv);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "EXTERNAL_PROVIDER_SCORECARD_EXPORT_CSV",
            "ops",
            "ExternalProviderTelemetryEvent",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                provider = normalizedProvider,
                rollingDays = normalizedRollingDays,
                sourceEventCount = sourceEvents.Count,
                persistedToSql = externalProviderTelemetryPersistToSql,
                fileName,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(fileBytes, "text/csv", fileName);
})
.RequireRateLimiting("SensitiveExportLimiter")
.WithName("ExportExternalProviderHealthScorecardCsv");

reports.MapGet("/external-provider-health/scorecards/export/json", async (
    string? provider,
    int? rollingDays,
    IConfiguration configuration,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var normalizedRollingDays = Math.Clamp(rollingDays ?? 30, 1, 180);
    var normalizedProvider = string.IsNullOrWhiteSpace(provider) ? null : provider.Trim();
    var now = DateTimeOffset.UtcNow;
    var windowStartUtc = now.AddDays(-normalizedRollingDays);

    IReadOnlyList<ExternalProviderTelemetryEvent> sourceEvents;
    if (externalProviderTelemetryPersistToSql && !string.IsNullOrWhiteSpace(configuration.GetConnectionString("IocEm")))
    {
        sourceEvents = await ReadProviderTelemetryEventsFromWarehouseAsync(
            configuration.GetConnectionString("IocEm")!,
            null,
            normalizedProvider,
            windowStartUtc,
            cancellationToken);
    }
    else
    {
        sourceEvents = providerTelemetryHistory
            .Where(item => item.EventUtc >= windowStartUtc
                && (normalizedProvider is null || string.Equals(item.Provider, normalizedProvider, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(item => item.EventUtc)
            .ToArray();
    }

    var payload = BuildExternalProviderExecutiveScorecardDocument(sourceEvents, normalizedProvider, normalizedRollingDays, now);
    var content = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
    var fileName = $"external-provider-scorecard-{now:yyyyMMdd-HHmmss}.json";

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "EXTERNAL_PROVIDER_SCORECARD_EXPORT_JSON",
            "ops",
            "ExternalProviderTelemetryEvent",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                provider = normalizedProvider,
                rollingDays = normalizedRollingDays,
                sourceEventCount = sourceEvents.Count,
                persistedToSql = externalProviderTelemetryPersistToSql,
                fileName,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(Encoding.UTF8.GetBytes(content), "application/json", fileName);
})
.RequireRateLimiting("SensitiveExportLimiter")
.WithName("ExportExternalProviderHealthScorecardJson");

reports.MapGet("/external-provider-health/executive-packet/export/zip", async (
    string? provider,
    int? rollingDays,
    int? windowHours,
    int? bucketMinutes,
    IConfiguration configuration,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var normalizedRollingDays = Math.Clamp(rollingDays ?? 30, 1, 180);
    var normalizedWindowHours = Math.Clamp(windowHours ?? 24 * 30, 1, 24 * 90);
    var normalizedBucketMinutes = Math.Clamp(bucketMinutes ?? 60, 5, 24 * 60);
    var normalizedProvider = string.IsNullOrWhiteSpace(provider) ? null : provider.Trim();
    var now = DateTimeOffset.UtcNow;
    var sourceWindowStartUtc = now.AddHours(-Math.Max(normalizedWindowHours, normalizedRollingDays * 24));

    IReadOnlyList<ExternalProviderTelemetryEvent> sourceEvents;
    if (externalProviderTelemetryPersistToSql && !string.IsNullOrWhiteSpace(configuration.GetConnectionString("IocEm")))
    {
        sourceEvents = await ReadProviderTelemetryEventsFromWarehouseAsync(
            configuration.GetConnectionString("IocEm")!,
            null,
            normalizedProvider,
            sourceWindowStartUtc,
            cancellationToken);
    }
    else
    {
        sourceEvents = providerTelemetryHistory
            .Where(item => item.EventUtc >= sourceWindowStartUtc
                && (normalizedProvider is null || string.Equals(item.Provider, normalizedProvider, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(item => item.EventUtc)
            .ToArray();
    }

    var governanceCsv = BuildExternalProviderGovernanceExportCsv(
        sourceEvents.Where(item => item.EventUtc >= now.AddHours(-normalizedWindowHours)).OrderBy(item => item.EventUtc).ToArray(),
        normalizedProvider,
        normalizedWindowHours,
        normalizedBucketMinutes,
        now);
    var scorecardCsv = BuildExternalProviderExecutiveScorecardCsv(
        sourceEvents.Where(item => item.EventUtc >= now.AddDays(-normalizedRollingDays)).OrderBy(item => item.EventUtc).ToArray(),
        normalizedProvider,
        normalizedRollingDays,
        now);
    var scorecardDocument = BuildExternalProviderExecutiveScorecardDocument(
        sourceEvents.Where(item => item.EventUtc >= now.AddDays(-normalizedRollingDays)).OrderBy(item => item.EventUtc).ToArray(),
        normalizedProvider,
        normalizedRollingDays,
        now);
    var scorecardJson = JsonSerializer.Serialize(scorecardDocument, new JsonSerializerOptions { WriteIndented = true });

    await using var zipStream = new MemoryStream();
    using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
    {
        AddTextArchiveEntry(archive, "README.txt", BuildExternalProviderExecutivePacketReadme(normalizedProvider, normalizedRollingDays, normalizedWindowHours, normalizedBucketMinutes, now));
        AddTextArchiveEntry(archive, "governance/external-provider-governance.csv", governanceCsv);
        AddTextArchiveEntry(archive, "scorecards/external-provider-scorecard.csv", scorecardCsv);
        AddTextArchiveEntry(archive, "scorecards/external-provider-scorecard.json", scorecardJson);
    }

    var fileName = $"external-provider-executive-packet-{now:yyyyMMdd-HHmmss}.zip";
    var packetBytes = zipStream.ToArray();

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "EXTERNAL_PROVIDER_EXECUTIVE_PACKET_EXPORT_ZIP",
            "ops",
            "ExternalProviderTelemetryEvent",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                provider = normalizedProvider,
                rollingDays = normalizedRollingDays,
                windowHours = normalizedWindowHours,
                bucketMinutes = normalizedBucketMinutes,
                sourceEventCount = sourceEvents.Count,
                persistedToSql = externalProviderTelemetryPersistToSql,
                fileName,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(packetBytes, "application/zip", fileName);
})
.WithName("ExportExternalProviderHealthExecutivePacketZip");

var admin = apiV1.MapGroup("/admin").RequireAuthorization(AuthorizationPolicies.LookupAdmin);

const string AdminRuntimePreferencesScope = "admin-runtime-preferences-global";
const string AdminRuntimePreferencesPresetName = "default";

admin.MapGet("/cache/mode", async (
    IConfiguration configuration,
    IResourceQueryService resourceQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var cacheUseRedisEffective = configuration.GetValue("Cache:UseRedis", false);
    var cacheUseRedisRequested = cacheUseRedisEffective;
    var source = "configuration";

    try
    {
        var persistedPreferencesJson = await resourceQueryService.GetGlobalReportPresetJsonAsync(
            AdminRuntimePreferencesScope,
            AdminRuntimePreferencesPresetName,
            cancellationToken);

        if (!string.IsNullOrWhiteSpace(persistedPreferencesJson))
        {
            var persistedPreferences = JsonSerializer.Deserialize<AdminRuntimeCachePreferenceDto>(persistedPreferencesJson);
            if (persistedPreferences is not null)
            {
                cacheUseRedisRequested = persistedPreferences.CacheUseRedisRequested;
                source = "persisted";
            }
        }
    }
    catch
    {
        // fallback to effective config signal
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "ADMIN_CONFIG",
            "CACHE_MODE_VIEW",
            "app",
            "UserReportPreset",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                cacheUseRedisRequested,
                cacheUseRedisEffective,
                source,
                requiresRestart = cacheUseRedisRequested != cacheUseRedisEffective,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new AdminCacheModeStateDto(
        cacheUseRedisRequested,
        cacheUseRedisEffective,
        cacheUseRedisRequested != cacheUseRedisEffective,
        source,
        false,
        false,
        null,
        DateTimeOffset.UtcNow));
})
.WithName("GetAdminCacheMode");

admin.MapPut("/cache/mode", async (
    UpdateAdminCacheModeRequestDto request,
    ClaimsPrincipal user,
    IConfiguration configuration,
    IResourceQueryService resourceQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for admin cache operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var preference = new AdminRuntimeCachePreferenceDto(
        request.CacheUseRedisRequested,
        DateTimeOffset.UtcNow);

    var upsertRequest = new UpsertUserReportPresetRequestDto(
        AdminRuntimePreferencesPresetName,
        JsonSerializer.Serialize(preference));

    var userReportPresetId = await resourceQueryService.UpsertGlobalReportPresetAsync(
        userId.Value,
        AdminRuntimePreferencesScope,
        upsertRequest,
        cancellationToken);

    var cacheUseRedisEffective = configuration.GetValue("Cache:UseRedis", false);
    var dockerRedisStartAttempted = false;
    var dockerRedisStartSucceeded = false;
    string? dockerRedisStartMessage = null;

    if (request.CacheUseRedisRequested && !cacheUseRedisEffective)
    {
        var dockerStartResult = await TryEnsureRedisContainerRunningAsync(configuration, cancellationToken);
        dockerRedisStartAttempted = dockerStartResult.Attempted;
        dockerRedisStartSucceeded = dockerStartResult.Succeeded;
        dockerRedisStartMessage = dockerStartResult.Message;
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "ADMIN_CONFIG",
            "CACHE_MODE_UPDATED",
            "app",
            "UserReportPreset",
            userReportPresetId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                request.CacheUseRedisRequested,
                cacheUseRedisEffective,
                requiresRestart = request.CacheUseRedisRequested != cacheUseRedisEffective,
                dockerRedisStartAttempted,
                dockerRedisStartSucceeded,
                dockerRedisStartMessage,
                traceId = httpContext.TraceIdentifier,
                updatedUtc = preference.UpdatedUtc
            })),
        cancellationToken);

    return Results.Ok(new AdminCacheModeStateDto(
        request.CacheUseRedisRequested,
        cacheUseRedisEffective,
        request.CacheUseRedisRequested != cacheUseRedisEffective,
        "persisted",
        dockerRedisStartAttempted,
        dockerRedisStartSucceeded,
        dockerRedisStartMessage,
        preference.UpdatedUtc));
})
.WithName("SaveAdminCacheMode");

admin.MapGet("/streaming/status", async (IStreamingIngestionControlService streamingControlService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var status = await streamingControlService.GetStatusAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "STREAMING_INGESTION_STATUS_VIEW",
            "intg",
            "InboundInterfaceMessage",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(status);
})
.WithName("GetStreamingIngestionStatus");

admin.MapPost("/streaming/start", async (StartStreamingIngestionRequestDto request, IStreamingIngestionControlService streamingControlService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    await streamingControlService.StartIngestionAsync(request, cancellationToken);
    var status = await streamingControlService.GetStatusAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "STREAMING_INGESTION_START",
            "intg",
            "InboundInterfaceMessage",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                request.StreamDirectory,
                request.PollIntervalSeconds,
                request.EnableFileWatcher,
                request.DefaultSourceSystemCode,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(status);
})
.WithName("StartStreamingIngestion");

admin.MapPost("/streaming/stop", async (IStreamingIngestionControlService streamingControlService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    await streamingControlService.StopIngestionAsync(cancellationToken);
    var status = await streamingControlService.GetStatusAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "STREAMING_INGESTION_STOP",
            "intg",
            "InboundInterfaceMessage",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new { traceId = httpContext.TraceIdentifier })),
        cancellationToken);

    return Results.Ok(status);
})
.WithName("StopStreamingIngestion");

admin.MapGet("/external-provider/executive-packet/automation/status", async (
    IExternalProviderExecutivePacketAutomationService automationService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var status = await automationService.GetStatusAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "EXTERNAL_PROVIDER_EXECUTIVE_PACKET_AUTOMATION_STATUS_VIEW",
            "ops",
            "ExternalProviderTelemetryEvent",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(status);
})
.WithName("GetExternalProviderExecutivePacketAutomationStatus");

admin.MapPost("/external-provider/executive-packet/automation/run", async (
    IExternalProviderExecutivePacketAutomationService automationService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var result = await automationService.RunNowAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "EXTERNAL_PROVIDER_EXECUTIVE_PACKET_AUTOMATION_RUN_MANUAL",
            "ops",
            "ExternalProviderTelemetryEvent",
            null,
            null,
            null,
            result.Succeeded ? "Success" : "Failure",
            JsonSerializer.Serialize(new
            {
                result.PacketPath,
                result.TransportMode,
                result.TransportDestination,
                result.TransportArtifactId,
                result.TransportAttempts,
                result.TransportSucceeded,
                result.SourceEventCount,
                result.StartedUtc,
                result.CompletedUtc,
                result.Error,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    if (!result.Succeeded)
    {
        return Results.Problem(
            title: "Executive packet automation run failed.",
            detail: result.Error,
            statusCode: StatusCodes.Status500InternalServerError);
    }

    return Results.Ok(result);
})
.WithName("RunExternalProviderExecutivePacketAutomation");

admin.MapPost("/streaming/upload", async (HttpRequest httpRequest, IStreamingIngestionControlService streamingControlService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (!httpRequest.HasFormContentType)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["contentType"] = ["multipart/form-data is required."]
        });
    }

    var form = await httpRequest.ReadFormAsync(cancellationToken);
    var file = form.Files.GetFile("file");

    if (file is null || file.Length == 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["file"] = ["JSON stream payload file is required."]
        });
    }

    await using var stream = file.OpenReadStream();
    using var reader = new StreamReader(stream);
    var payloadJson = await reader.ReadToEndAsync(cancellationToken);

    if (string.IsNullOrWhiteSpace(payloadJson))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["file"] = ["Uploaded file content is empty."]
        });
    }

    var savedPath = await streamingControlService.SaveStreamPayloadFileAsync(file.FileName, payloadJson, cancellationToken);
    var status = await streamingControlService.GetStatusAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "STREAMING_INGESTION_UPLOAD",
            "intg",
            "InboundInterfaceMessage",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                file.FileName,
                savedPath,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new
    {
        fileName = file.FileName,
        savedPath,
        status
    });
})
.WithName("UploadStreamingPayload");

admin.MapPost("/data/synthetic/reset", async (IConfiguration configuration, IHostEnvironment environment, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (!environment.IsDevelopment())
    {
        return Results.Problem(
            title: "Synthetic data reset is restricted.",
            detail: "Synthetic data reset endpoint is only available in Development environments.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var scriptExecutionEnabled = configuration.GetValue("AdminDataOps:EnableScriptExecution", false);
    if (!scriptExecutionEnabled)
    {
        return Results.Problem(
            title: "Synthetic data reset is disabled.",
            detail: "Enable AdminDataOps:EnableScriptExecution to allow runtime synthetic reset operations.",
            statusCode: StatusCodes.Status409Conflict);
    }

    var scriptRelativePath = configuration.GetValue<string>("AdminDataOps:InitializeDatabaseScriptPath")
        ?? Path.Combine("..", "..", "..", "..", "Initialize-Database.ps1");

    var scriptPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, scriptRelativePath));
    if (!File.Exists(scriptPath))
    {
        return Results.Problem(
            title: "Synthetic data reset script not found.",
            detail: $"Initialize-Database.ps1 was not found at '{scriptPath}'.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    var connectionString = configuration.GetConnectionString("IocEm");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            title: "Synthetic data reset unavailable.",
            detail: "ConnectionStrings:IocEm is not configured.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    const string operationCode = "reset";
    var cooldownResult = TryAcquireDataOpsCooldown(dataOpsCooldownByOperation, operationCode, TimeSpan.FromSeconds(30));
    if (!cooldownResult.Allowed)
    {
        return Results.Problem(
            title: "Synthetic data reset is cooling down.",
            detail: $"Try again in about {cooldownResult.RetryAfterSeconds} second(s).",
            statusCode: StatusCodes.Status429TooManyRequests);
    }

    var startInfo = new ProcessStartInfo("pwsh")
    {
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
    };

    startInfo.ArgumentList.Add("-NoProfile");
    startInfo.ArgumentList.Add("-ExecutionPolicy");
    startInfo.ArgumentList.Add("Bypass");
    startInfo.ArgumentList.Add("-File");
    startInfo.ArgumentList.Add(scriptPath);
    startInfo.ArgumentList.Add("-ConnectionString");
    startInfo.ArgumentList.Add(connectionString);
    startInfo.ArgumentList.Add("-ResetSyntheticLogisticsData");

    using var process = new Process { StartInfo = startInfo };

    try
    {
        process.Start();
        var standardOutputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var standardErrorTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        var standardOutput = await standardOutputTask;
        var standardError = await standardErrorTask;
        var succeeded = process.ExitCode == 0;

        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "SYNTHETIC_DATA_RESET",
                "app",
                "UserReportPreset",
                null,
                null,
                null,
                succeeded ? "Success" : "Failure",
                JsonSerializer.Serialize(new
                {
                    succeeded,
                    process.ExitCode,
                    scriptPath,
                    operationCode,
                    traceId = httpContext.TraceIdentifier,
                    output = TruncateForAudit(standardOutput),
                    error = TruncateForAudit(standardError),
                })),
            cancellationToken);

        if (!succeeded)
        {
            return Results.Problem(
                title: "Synthetic data reset failed.",
                detail: string.IsNullOrWhiteSpace(standardError) ? "Initialize-Database script returned a non-zero exit code." : TruncateForAudit(standardError),
                statusCode: StatusCodes.Status500InternalServerError);
        }

        return Results.Ok(new SyntheticDataResetResultDto(
            true,
            "Synthetic logistics data reset completed.",
            process.ExitCode,
            operationCode,
            httpContext.TraceIdentifier,
            "Success",
            httpContext.TryGetActorUserId(),
            DateTimeOffset.UtcNow));
    }
    catch (Exception ex)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "SYNTHETIC_DATA_RESET",
                "app",
                "UserReportPreset",
                null,
                null,
                null,
                "Failure",
                JsonSerializer.Serialize(new
                {
                    scriptPath,
                    operationCode,
                    exception = ex.Message,
                    traceId = httpContext.TraceIdentifier,
                })),
            cancellationToken);

        return Results.Problem(
            title: "Synthetic data reset failed.",
            detail: ex.Message,
            statusCode: StatusCodes.Status500InternalServerError);
    }

})
.RequireAuthorization(AuthorizationPolicies.DataOpsAdmin)
.WithName("ResetSyntheticLogisticsData");

admin.MapPost("/data/synthetic/seed", async (IConfiguration configuration, IHostEnvironment environment, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (!environment.IsDevelopment())
    {
        return Results.Problem(
            title: "Synthetic data seed is restricted.",
            detail: "Synthetic data seed endpoint is only available in Development environments.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var scriptExecutionEnabled = configuration.GetValue("AdminDataOps:EnableScriptExecution", false);
    if (!scriptExecutionEnabled)
    {
        return Results.Problem(
            title: "Synthetic data seed is disabled.",
            detail: "Enable AdminDataOps:EnableScriptExecution to allow runtime synthetic seed operations.",
            statusCode: StatusCodes.Status409Conflict);
    }

    var scriptRelativePath = configuration.GetValue<string>("AdminDataOps:InitializeDatabaseScriptPath")
        ?? Path.Combine("..", "..", "..", "..", "Initialize-Database.ps1");

    var scriptPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, scriptRelativePath));
    if (!File.Exists(scriptPath))
    {
        return Results.Problem(
            title: "Synthetic data seed script not found.",
            detail: $"Initialize-Database.ps1 was not found at '{scriptPath}'.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    var connectionString = configuration.GetConnectionString("IocEm");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem(
            title: "Synthetic data seed unavailable.",
            detail: "ConnectionStrings:IocEm is not configured.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    const string operationCode = "seed";
    var cooldownResult = TryAcquireDataOpsCooldown(dataOpsCooldownByOperation, operationCode, TimeSpan.FromSeconds(30));
    if (!cooldownResult.Allowed)
    {
        return Results.Problem(
            title: "Synthetic data seed is cooling down.",
            detail: $"Try again in about {cooldownResult.RetryAfterSeconds} second(s).",
            statusCode: StatusCodes.Status429TooManyRequests);
    }

    var startInfo = new ProcessStartInfo("pwsh")
    {
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
    };

    startInfo.ArgumentList.Add("-NoProfile");
    startInfo.ArgumentList.Add("-ExecutionPolicy");
    startInfo.ArgumentList.Add("Bypass");
    startInfo.ArgumentList.Add("-File");
    startInfo.ArgumentList.Add(scriptPath);
    startInfo.ArgumentList.Add("-ConnectionString");
    startInfo.ArgumentList.Add(connectionString);
    startInfo.ArgumentList.Add("-IncludeSyntheticLogisticsData");

    using var process = new Process { StartInfo = startInfo };

    try
    {
        process.Start();
        var standardOutputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var standardErrorTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        var standardOutput = await standardOutputTask;
        var standardError = await standardErrorTask;
        var succeeded = process.ExitCode == 0;

        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "SYNTHETIC_DATA_SEED",
                "app",
                "UserReportPreset",
                null,
                null,
                null,
                succeeded ? "Success" : "Failure",
                JsonSerializer.Serialize(new
                {
                    succeeded,
                    process.ExitCode,
                    scriptPath,
                    operationCode,
                    traceId = httpContext.TraceIdentifier,
                    output = TruncateForAudit(standardOutput),
                    error = TruncateForAudit(standardError),
                })),
            cancellationToken);

        if (!succeeded)
        {
            return Results.Problem(
                title: "Synthetic data seed failed.",
                detail: string.IsNullOrWhiteSpace(standardError) ? "Initialize-Database script returned a non-zero exit code." : TruncateForAudit(standardError),
                statusCode: StatusCodes.Status500InternalServerError);
        }

        return Results.Ok(new SyntheticDataResetResultDto(
            true,
            "Synthetic logistics data seed completed.",
            process.ExitCode,
            operationCode,
            httpContext.TraceIdentifier,
            "Success",
            httpContext.TryGetActorUserId(),
            DateTimeOffset.UtcNow));
    }
    catch (Exception ex)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "SYNTHETIC_DATA_SEED",
                "app",
                "UserReportPreset",
                null,
                null,
                null,
                "Failure",
                JsonSerializer.Serialize(new
                {
                    scriptPath,
                    operationCode,
                    exception = ex.Message,
                    traceId = httpContext.TraceIdentifier,
                })),
            cancellationToken);

        return Results.Problem(
            title: "Synthetic data seed failed.",
            detail: ex.Message,
            statusCode: StatusCodes.Status500InternalServerError);
    }
})
.RequireAuthorization(AuthorizationPolicies.DataOpsAdmin)
.WithName("SeedSyntheticLogisticsData");

admin.MapGet("/data/synthetic/preview", async (IConfiguration configuration, IHostEnvironment environment, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var enabled = environment.IsDevelopment() && configuration.GetValue("AdminDataOps:EnableScriptExecution", false);

    var connectionString = configuration.GetConnectionString("IocEm");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Ok(new SyntheticDataPreviewDto(false, environment.EnvironmentName, false, 0, 0, 0, 0, DateTimeOffset.UtcNow));
    }

    const string sql = """
        SELECT
            (SELECT COUNT_BIG(*) FROM org.Location WHERE LocationName LIKE N'Synthetic %') AS SyntheticLocationCount,
            (SELECT COUNT_BIG(*)
               FROM res.LocationResourceInventory inv
               INNER JOIN org.Location l ON l.LocationId = inv.LocationId
              WHERE l.LocationName LIKE N'Synthetic %') AS SyntheticInventoryCount,
            (SELECT COUNT_BIG(*) FROM res.BedAvailabilitySnapshot WHERE SourceSystemCode = N'SYNTHETIC') AS SyntheticBedSnapshotCount,
            (SELECT COUNT_BIG(*)
               FROM ic.IncidentResourceRequest irr
               INNER JOIN ic.Incident i ON i.IncidentId = irr.IncidentId
              WHERE i.IncidentNumber = N'SYN-LOG-2026-001') AS SyntheticIncidentRequestCount;
        """;

    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);

    await using var command = new SqlCommand(sql, connection)
    {
        CommandType = System.Data.CommandType.Text,
        CommandTimeout = 30,
    };

    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    if (!await reader.ReadAsync(cancellationToken))
    {
        return Results.Ok(new SyntheticDataPreviewDto(enabled, environment.EnvironmentName, false, 0, 0, 0, 0, DateTimeOffset.UtcNow));
    }

    var syntheticLocationCount = Convert.ToInt32(reader.GetInt64(0), CultureInfo.InvariantCulture);
    var syntheticInventoryCount = Convert.ToInt32(reader.GetInt64(1), CultureInfo.InvariantCulture);
    var syntheticBedSnapshotCount = Convert.ToInt32(reader.GetInt64(2), CultureInfo.InvariantCulture);
    var syntheticIncidentRequestCount = Convert.ToInt32(reader.GetInt64(3), CultureInfo.InvariantCulture);

    var preview = new SyntheticDataPreviewDto(
        enabled,
        environment.EnvironmentName,
        true,
        syntheticLocationCount,
        syntheticInventoryCount,
        syntheticBedSnapshotCount,
        syntheticIncidentRequestCount,
        DateTimeOffset.UtcNow);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "SYNTHETIC_DATA_PREVIEW_VIEW",
            "app",
            "UserReportPreset",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                preview.Enabled,
                preview.Environment,
                preview.SyntheticLocationCount,
                preview.SyntheticInventoryCount,
                preview.SyntheticBedSnapshotCount,
                preview.SyntheticIncidentRequestCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(preview);
})
.RequireAuthorization(AuthorizationPolicies.DataOpsAdmin)
.WithName("GetSyntheticDataPreview");

static string TruncateForAudit(string value)
{
    const int maxLength = 2000;
    if (string.IsNullOrEmpty(value))
    {
        return string.Empty;
    }

    return value.Length <= maxLength ? value : value[..maxLength];
}

static DataOpsCooldownResult TryAcquireDataOpsCooldown(ConcurrentDictionary<string, DateTimeOffset> lastRunByOperation, string operationCode, TimeSpan cooldown)
{
    var now = DateTimeOffset.UtcNow;
    var previous = lastRunByOperation.GetOrAdd(operationCode, now - cooldown - TimeSpan.FromSeconds(1));
    var elapsed = now - previous;

    if (elapsed < cooldown)
    {
        var retryAfterSeconds = (int)Math.Ceiling((cooldown - elapsed).TotalSeconds);
        return new DataOpsCooldownResult(false, Math.Max(1, retryAfterSeconds));
    }

    lastRunByOperation[operationCode] = now;
    return new DataOpsCooldownResult(true, 0);
}

static async Task<AdminDockerComposeStartResult> TryEnsureRedisContainerRunningAsync(IConfiguration configuration, CancellationToken cancellationToken)
{
    var composeWorkingDirectory = configuration.GetValue<string>("AdminRuntime:Redis:ComposeWorkingDirectory");
    if (string.IsNullOrWhiteSpace(composeWorkingDirectory))
    {
        composeWorkingDirectory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
    }

    var composeFilePath = configuration.GetValue<string>("AdminRuntime:Redis:ComposeFilePath");
    var redisServiceName = configuration.GetValue<string>("AdminRuntime:Redis:ServiceName") ?? "redis";

    var startInfo = new ProcessStartInfo("docker")
    {
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
        WorkingDirectory = composeWorkingDirectory,
    };

    startInfo.ArgumentList.Add("compose");
    if (!string.IsNullOrWhiteSpace(composeFilePath))
    {
        startInfo.ArgumentList.Add("-f");
        startInfo.ArgumentList.Add(composeFilePath);
    }

    startInfo.ArgumentList.Add("up");
    startInfo.ArgumentList.Add("-d");
    startInfo.ArgumentList.Add(redisServiceName);

    try
    {
        using var process = new Process { StartInfo = startInfo };
        process.Start();
        var standardOutputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var standardErrorTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        var standardOutput = await standardOutputTask;
        var standardError = await standardErrorTask;
        var succeeded = process.ExitCode == 0;
        var message = succeeded
            ? string.IsNullOrWhiteSpace(standardOutput)
                ? "Redis container startup command executed."
                : standardOutput.Trim()
            : string.IsNullOrWhiteSpace(standardError)
                ? $"docker compose returned exit code {process.ExitCode}."
                : standardError.Trim();

        return new AdminDockerComposeStartResult(true, succeeded, message);
    }
    catch (Exception ex)
    {
        return new AdminDockerComposeStartResult(true, false, ex.Message);
    }
}

admin.MapGet("/users", async (string? search, bool? isActive, int? pageNumber, int? pageSize, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var normalizedPageNumber = Math.Max(1, pageNumber ?? 1);
    var normalizedPageSize = Math.Clamp(pageSize ?? 25, 1, 200);
    var (items, totalCount) = await userQueryService.GetAdminUsersAsync(search, isActive, normalizedPageNumber, normalizedPageSize, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "ADMIN_USERS_VIEW",
            "sec",
            "AppUser",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                search,
                isActive,
                pageNumber = normalizedPageNumber,
                pageSize = normalizedPageSize,
                itemCount = items.Count,
                totalCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new
    {
        items,
        totalCount,
        pageNumber = normalizedPageNumber,
        pageSize = normalizedPageSize
    });
})
.WithName("GetAdminUsers");

admin.MapPost("/users", async (CreateAdminUserRequestDto request, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var normalizedDisplayName = request.DisplayName?.Trim() ?? string.Empty;
    var normalizedEmail = string.IsNullOrWhiteSpace(request.EmailAddress)
        ? null
        : request.EmailAddress.Trim();
    var normalizedUserPrincipalName = string.IsNullOrWhiteSpace(request.UserPrincipalName)
        ? null
        : request.UserPrincipalName.Trim();

    if (string.IsNullOrWhiteSpace(normalizedDisplayName))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["displayName"] = ["Display name is required."]
        });
    }

    if (normalizedUserPrincipalName is not null && normalizedUserPrincipalName.Length > 320)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["userPrincipalName"] = ["User principal name must be 320 characters or fewer."]
        });
    }

    if (normalizedEmail is not null && normalizedEmail.Length > 320)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["emailAddress"] = ["Email address must be 320 characters or fewer."]
        });
    }

    if (normalizedDisplayName.Length > 200)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["displayName"] = ["Display name must be 200 characters or fewer."]
        });
    }

    try
    {
        var createdUserId = await userQueryService.CreateAdminUserAsync(
            new CreateAdminUserRequestDto(normalizedDisplayName, normalizedEmail, request.IsActive, normalizedUserPrincipalName, request.EntraObjectId),
            cancellationToken);

        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "USER_CREATE",
                "sec",
                "AppUser",
                createdUserId.ToString(CultureInfo.InvariantCulture),
                null,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    userId = createdUserId,
                    request.DisplayName,
                    request.EmailAddress,
                    request.IsActive,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);

        return Results.Created($"/api/v1/admin/users/{createdUserId}", new { userId = createdUserId });
    }
    catch (SqlException sqlEx) when (sqlEx.Number is 2601 or 2627)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["emailAddress"] = ["A user with this email/UPN already exists."]
        });
    }
})
.WithName("CreateAdminUser");

admin.MapPost("/users/import/csv", async (HttpRequest httpRequest, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (!httpRequest.HasFormContentType)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["contentType"] = ["multipart/form-data is required."]
        });
    }

    var form = await httpRequest.ReadFormAsync(cancellationToken);
    var sourceSystemCode = form["sourceSystemCode"].ToString();
    var sourceMessageId = form["sourceMessageId"].ToString();
    var file = form.Files.GetFile("file");

    if (string.IsNullOrWhiteSpace(sourceSystemCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode is required."]
        });
    }

    if (file is null || file.Length == 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["file"] = ["CSV file is required."]
        });
    }

    var normalizedSourceSystemCode = sourceSystemCode.Trim();
    var normalizedSourceMessageId = string.IsNullOrWhiteSpace(sourceMessageId) ? null : sourceMessageId.Trim();
    var updateExisting = form.TryGetValue("updateExisting", out var updateExistingRaw)
        && bool.TryParse(updateExistingRaw.ToString(), out var parsedUpdateExisting)
        && parsedUpdateExisting;

    await using var adminUserCsvStream = file.OpenReadStream();
    var (rows, rejects) = await ParseAdminUsersCsvAsync(adminUserCsvStream, normalizedSourceSystemCode, normalizedSourceMessageId, cancellationToken);

    var activeRoleCodes = (await userQueryService.GetActiveAdminRolesAsync(cancellationToken))
        .Select(role => role.RoleCode)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    var createdRows = 0;
    var updatedRows = 0;
    foreach (var row in rows)
    {
        var invalidRoleCodes = row.RoleCodes
            .Where(roleCode => !activeRoleCodes.Contains(roleCode))
            .ToArray();

        if (invalidRoleCodes.Length > 0)
        {
            rejects.Add(new ImportRejectDto(
                row.RowNumber,
                "ADMIN_USER",
                normalizedSourceSystemCode,
                normalizedSourceMessageId,
                $"Unknown or inactive role code(s): {string.Join(", ", invalidRoleCodes)}.",
                row.RawData));
            continue;
        }

        try
        {
            var existingUserId = await userQueryService.FindAdminUserIdByEmailOrUpnAsync(
                row.EmailAddress,
                row.UserPrincipalName,
                cancellationToken);

            long userId;
            if (existingUserId.HasValue)
            {
                if (!updateExisting)
                {
                    rejects.Add(new ImportRejectDto(
                        row.RowNumber,
                        "ADMIN_USER",
                        normalizedSourceSystemCode,
                        normalizedSourceMessageId,
                        "A user with this email/UPN already exists. Enable Update Existing to update matching users.",
                        row.RawData));
                    continue;
                }

                var updated = await userQueryService.UpdateAdminUserAsync(
                    existingUserId.Value,
                    new CreateAdminUserRequestDto(
                        row.DisplayName,
                        row.EmailAddress,
                        row.IsActive,
                        row.UserPrincipalName,
                        row.EntraObjectId),
                    cancellationToken);

                if (!updated)
                {
                    rejects.Add(new ImportRejectDto(
                        row.RowNumber,
                        "ADMIN_USER",
                        normalizedSourceSystemCode,
                        normalizedSourceMessageId,
                        "Matching user could not be updated.",
                        row.RawData));
                    continue;
                }

                userId = existingUserId.Value;
                updatedRows++;
            }
            else
            {
                userId = await userQueryService.CreateAdminUserAsync(
                    new CreateAdminUserRequestDto(
                        row.DisplayName,
                        row.EmailAddress,
                        row.IsActive,
                        row.UserPrincipalName,
                        row.EntraObjectId),
                    cancellationToken);
                createdRows++;
            }

            if (row.RoleCodes.Count > 0)
            {
                await userQueryService.UpsertAdminUserRoleAssignmentsAsync(
                    userId,
                    row.RoleCodes,
                    httpContext.TryGetActorUserId(),
                    updateExisting ? "Bulk CSV import role assignment/upsert" : "Bulk CSV import assignment",
                    cancellationToken);
            }
        }
        catch (SqlException sqlEx) when (sqlEx.Number is 2601 or 2627)
        {
            rejects.Add(new ImportRejectDto(
                row.RowNumber,
                "ADMIN_USER",
                normalizedSourceSystemCode,
                normalizedSourceMessageId,
                "A user with this email/UPN already exists.",
                row.RawData));
        }
        catch (Exception ex)
        {
            rejects.Add(new ImportRejectDto(
                row.RowNumber,
                "ADMIN_USER",
                normalizedSourceSystemCode,
                normalizedSourceMessageId,
                ex.Message,
                row.RawData));
        }
    }

    var totalRows = rows.Count + rejects.Count;
    var failedRows = rejects.Count;
    var succeededRows = createdRows + updatedRows;
    var result = new ImportBatchResultDto(totalRows, succeededRows, failedRows, DateTimeOffset.UtcNow);
    var rejectReportCsv = BuildRejectReportCsv(rejects);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "IMPORT_ADMIN_USERS_CSV",
            "sec",
            "AppUser",
            null,
            null,
            null,
            failedRows == 0 ? "Success" : "PartialSuccess",
            JsonSerializer.Serialize(new
            {
                file.FileName,
                sourceSystemCode = normalizedSourceSystemCode,
                sourceMessageId = normalizedSourceMessageId,
                updateExisting,
                result.TotalRows,
                result.SucceededRows,
                createdRows,
                updatedRows,
                result.FailedRows,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new DetailedImportBatchResultDto(result, rejects, rejectReportCsv, createdRows, updatedRows));
})
.WithName("ImportAdminUsersCsv");

admin.MapPost("/users/import/csv/reject-report", async (HttpRequest httpRequest, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (!httpRequest.HasFormContentType)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["contentType"] = ["multipart/form-data is required."]
        });
    }

    var form = await httpRequest.ReadFormAsync(cancellationToken);
    var sourceSystemCode = form["sourceSystemCode"].ToString();
    var sourceMessageId = form["sourceMessageId"].ToString();
    var file = form.Files.GetFile("file");

    if (string.IsNullOrWhiteSpace(sourceSystemCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode is required."]
        });
    }

    if (file is null || file.Length == 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["file"] = ["CSV file is required."]
        });
    }

    var normalizedSourceSystemCode = sourceSystemCode.Trim();
    var normalizedSourceMessageId = string.IsNullOrWhiteSpace(sourceMessageId) ? null : sourceMessageId.Trim();

    await using var stream = file.OpenReadStream();
    var (_, rejects) = await ParseAdminUsersCsvAsync(stream, normalizedSourceSystemCode, normalizedSourceMessageId, cancellationToken);
    var rejectReportCsv = BuildRejectReportCsv(rejects);
    var reportBytes = Encoding.UTF8.GetBytes(rejectReportCsv);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "IMPORT_ADMIN_USERS_REJECT_REPORT_DOWNLOAD",
            "sec",
            "AppUser",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                sourceSystemCode = normalizedSourceSystemCode,
                sourceMessageId = normalizedSourceMessageId,
                rejectCount = rejects.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(reportBytes, "text/csv", "admin-user-import-reject-report.csv");
})
.WithName("DownloadAdminUsersCsvRejectReport");

admin.MapPost("/users/{userId:long}/active", async (long userId, UpdateUserActiveStatusRequestDto request, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (userId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["userId"] = ["userId must be greater than zero."]
        });
    }

    var success = await userQueryService.UpdateUserActiveStatusAsync(userId, request.IsActive, cancellationToken);
    if (!success)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            request.IsActive ? "USER_ACTIVATE" : "USER_DEACTIVATE",
            "sec",
            "AppUser",
            userId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                userId,
                request.IsActive,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("UpdateAdminUserActiveStatus");

admin.MapGet("/roles", async (IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var roles = await userQueryService.GetActiveAdminRolesAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "ADMIN_ROLES_VIEW",
            "sec",
            "Role",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                roleCount = roles.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(roles);
})
.WithName("GetAdminRoles");

admin.MapGet("/users/{userId:long}/roles", async (long userId, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (userId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["userId"] = ["userId must be greater than zero."]
        });
    }

    var assignments = await userQueryService.GetAdminUserRoleAssignmentsAsync(userId, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "ADMIN_USER_ROLES_VIEW",
            "sec",
            "UserRoleAssignment",
            userId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                userId,
                assignmentCount = assignments.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(assignments);
})
.WithName("GetAdminUserRoles");

admin.MapPost("/users/{userId:long}/roles", async (long userId, UpsertAdminUserRolesRequestDto request, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (userId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["userId"] = ["userId must be greater than zero."]
        });
    }

    var normalizedRoleCodes = (request.RoleCodes ?? Array.Empty<string>())
        .Where(code => !string.IsNullOrWhiteSpace(code))
        .Select(code => code.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    var success = await userQueryService.UpsertAdminUserRoleAssignmentsAsync(
        userId,
        normalizedRoleCodes,
        httpContext.TryGetActorUserId(),
        request.AssignmentReason,
        cancellationToken);

    if (!success)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "ADMIN_USER_ROLES_UPSERT",
            "sec",
            "UserRoleAssignment",
            userId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                userId,
                roleCodes = normalizedRoleCodes,
                request.AssignmentReason,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new { userId, roleCodes = normalizedRoleCodes });
})
.WithName("UpsertAdminUserRoles");

admin.MapGet("/locations", async (string? search, bool? isActive, int? pageNumber, int? pageSize, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var normalizedPageNumber = Math.Max(1, pageNumber ?? 1);
    var normalizedPageSize = Math.Clamp(pageSize ?? 25, 1, 200);
    var (items, totalCount) = await lookupQueryService.GetAdminLocationsAsync(search, isActive, normalizedPageNumber, normalizedPageSize, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "ADMIN_LOCATIONS_VIEW",
            "org",
            "Location",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                search,
                isActive,
                pageNumber = normalizedPageNumber,
                pageSize = normalizedPageSize,
                itemCount = items.Count,
                totalCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new
    {
        items,
        totalCount,
        pageNumber = normalizedPageNumber,
        pageSize = normalizedPageSize
    });
})
.WithName("GetAdminLocations");

admin.MapPost("/locations/{locationId:long}/active", async (long locationId, UpdateLocationActiveStatusRequestDto request, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (locationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["locationId"] = ["locationId must be greater than zero."]
        });
    }

    var success = await lookupQueryService.UpdateLocationActiveStatusAsync(locationId, request.IsActive, cancellationToken);
    if (!success)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            request.IsActive ? "LOCATION_ACTIVATE" : "LOCATION_DEACTIVATE",
            "org",
            "Location",
            locationId.ToString(CultureInfo.InvariantCulture),
            null,
            locationId,
            "Success",
            JsonSerializer.Serialize(new
            {
                locationId,
                request.IsActive,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("UpdateAdminLocationActiveStatus");

admin.MapPost("/locations/{locationId:long}/geo", async (long locationId, UpdateAdminLocationGeoRequestDto request, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (locationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["locationId"] = ["locationId must be greater than zero."]
        });
    }

    var requestErrors = ValidateUpdateAdminLocationGeoRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var normalizedRequest = request with
    {
        CityName = string.IsNullOrWhiteSpace(request.CityName) ? null : request.CityName.Trim(),
        StateCode = string.IsNullOrWhiteSpace(request.StateCode) ? null : request.StateCode.Trim().ToUpperInvariant(),
        PostalCode = string.IsNullOrWhiteSpace(request.PostalCode) ? null : request.PostalCode.Trim(),
    };

    var success = await lookupQueryService.UpdateAdminLocationGeoAsync(locationId, normalizedRequest, cancellationToken);
    if (!success)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "LOCATION_GEO_UPDATE",
            "org",
            "Location",
            locationId.ToString(CultureInfo.InvariantCulture),
            null,
            locationId,
            "Success",
            JsonSerializer.Serialize(new
            {
                locationId,
                normalizedRequest.Latitude,
                normalizedRequest.Longitude,
                normalizedRequest.CityName,
                normalizedRequest.StateCode,
                normalizedRequest.PostalCode,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    var updated = await lookupQueryService.GetAdminLocationByIdAsync(locationId, cancellationToken);
    return updated is null ? Results.NotFound() : Results.Ok(updated);
})
.WithName("UpdateAdminLocationGeo");

admin.MapPost("/locations/{locationId:long}/geocode", async (long locationId, AdminLocationGeocodeRequestDto request, IHttpClientFactory httpClientFactory, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (locationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["locationId"] = ["locationId must be greater than zero."]
        });
    }

    var normalizedCity = string.IsNullOrWhiteSpace(request.CityName) ? null : request.CityName.Trim();
    var normalizedState = string.IsNullOrWhiteSpace(request.StateCode) ? null : request.StateCode.Trim().ToUpperInvariant();
    var normalizedPostalCode = string.IsNullOrWhiteSpace(request.PostalCode) ? null : request.PostalCode.Trim();
    var normalizedLocationName = string.IsNullOrWhiteSpace(request.LocationName) ? null : request.LocationName.Trim();

    AdminLocationGeocodeResultDto? providerResult = null;
    var providerCooldown = TryAcquireDataOpsCooldown(providerCooldownByOperation, "NOMINATIM_GEOCODE", TimeSpan.FromSeconds(2));
    if (providerCooldown.Allowed && !IsProviderCircuitOpen(providerTelemetryByName, "NOMINATIM"))
    {
        providerResult = await TryGeocodeWithNominatimAsync(
            httpClientFactory,
            providerTelemetryByName,
            providerTelemetryHistory,
            externalProviderTelemetryHistoryMax,
            externalProviderTelemetryPersistToFile,
            externalProviderTelemetryFilePath,
            externalProviderTelemetryFileLock,
            externalProviderTelemetryPersistToSql,
            externalProviderTelemetrySqlRetentionDays,
            externalProviderTelemetrySqlConnectionString,
            externalProviderTelemetryEnvironmentName,
            normalizedLocationName,
            normalizedCity,
            normalizedState,
            normalizedPostalCode,
            cancellationToken,
            externalProviderCircuitFailureThreshold,
            externalProviderCircuitDuration);
    }
    else if (providerCooldown.Allowed)
    {
        MarkProviderBypass(
            providerTelemetryByName,
            providerTelemetryHistory,
            externalProviderTelemetryHistoryMax,
            externalProviderTelemetryPersistToFile,
            externalProviderTelemetryFilePath,
            externalProviderTelemetryFileLock,
            externalProviderTelemetryPersistToSql,
            externalProviderTelemetrySqlRetentionDays,
            externalProviderTelemetrySqlConnectionString,
            externalProviderTelemetryEnvironmentName,
            "NOMINATIM");
    }

    if (providerResult is not null)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "LOCATION_GEOCODE",
                "org",
                "Location",
                locationId.ToString(CultureInfo.InvariantCulture),
                null,
                locationId,
                "Success",
                JsonSerializer.Serialize(new
                {
                    locationId,
                    geocodeSource = providerResult.GeocodeSource,
                    providerResult.ConfidenceScore,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);

        return Results.Ok(providerResult with { ConfidenceScore = Math.Max(providerResult.ConfidenceScore, 0.80m) });
    }

    var seed = HashCode.Combine(
        locationId,
        normalizedCity ?? string.Empty,
        normalizedState ?? string.Empty,
        normalizedPostalCode ?? string.Empty,
        normalizedLocationName ?? string.Empty);

    var random = new Random(seed);
    var latitude = Math.Round((decimal)(37.0 + (random.NextDouble() * 2.7)), 6);
    var longitude = Math.Round((decimal)(-100.8 + (random.NextDouble() * 6.1)), 6);
    var normalizedQuery = string.Join(", ",
        new[] { normalizedLocationName, normalizedCity, normalizedState, normalizedPostalCode }
            .Where(part => !string.IsNullOrWhiteSpace(part)));

    var fallbackResult = new AdminLocationGeocodeResultDto(
        latitude,
        longitude,
        string.IsNullOrWhiteSpace(normalizedQuery) ? $"location:{locationId}" : normalizedQuery,
        "IPOC_HEURISTIC_GEOCODER",
        0.62m);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "LOCATION_GEOCODE",
            "org",
            "Location",
            locationId.ToString(CultureInfo.InvariantCulture),
            null,
            locationId,
            "Success",
            JsonSerializer.Serialize(new
            {
                locationId,
                geocodeSource = fallbackResult.GeocodeSource,
                fallbackResult.ConfidenceScore,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(fallbackResult);
})
.WithName("GeocodeAdminLocation");

admin.MapGet("/locations/{locationId:long}/snapshot", async (long locationId, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (locationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["locationId"] = ["locationId must be greater than zero."]
        });
    }

    var snapshot = await lookupQueryService.GetAdminLocationSnapshotAsync(locationId, cancellationToken);
    if (snapshot is null)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "ADMIN_LOCATION_SNAPSHOT_VIEW",
            "org",
            "Location",
            locationId.ToString(CultureInfo.InvariantCulture),
            null,
            locationId,
            "Success",
            JsonSerializer.Serialize(new
            {
                locationId,
                snapshot.ResourceInventoryRowCount,
                snapshot.BedSnapshotRowCount,
                snapshot.TotalQuantityAvailable,
                snapshot.TotalBedsAvailable,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(snapshot);
})
.WithName("GetAdminLocationSnapshot");

admin.MapGet("/locations/{locationId:long}/snapshot/export/csv", async (long locationId, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (locationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["locationId"] = ["locationId must be greater than zero."]
        });
    }

    var snapshot = await lookupQueryService.GetAdminLocationSnapshotAsync(locationId, cancellationToken);
    if (snapshot is null)
    {
        return Results.NotFound();
    }

    var lines = new List<string>
    {
        "Metric,Value",
        $"\"LocationId\",\"{snapshot.LocationId.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"LocationName\",\"{snapshot.LocationName.Replace("\"", "\"\"")}\"",
        $"\"OrganizationName\",\"{(snapshot.OrganizationName ?? string.Empty).Replace("\"", "\"\"")}\"",
        $"\"RegionName\",\"{(snapshot.RegionName ?? string.Empty).Replace("\"", "\"\"")}\"",
        $"\"CityName\",\"{(snapshot.CityName ?? string.Empty).Replace("\"", "\"\"")}\"",
        $"\"StateCode\",\"{(snapshot.StateCode ?? string.Empty).Replace("\"", "\"\"")}\"",
        $"\"PostalCode\",\"{(snapshot.PostalCode ?? string.Empty).Replace("\"", "\"\"")}\"",
        $"\"IsActive\",\"{snapshot.IsActive.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"ResourceInventoryRowCount\",\"{snapshot.ResourceInventoryRowCount.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"TotalQuantityAvailable\",\"{snapshot.TotalQuantityAvailable.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"TotalQuantityCommitted\",\"{snapshot.TotalQuantityCommitted.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"TotalQuantityOutOfService\",\"{snapshot.TotalQuantityOutOfService.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"LastResourceReportedUtc\",\"{(snapshot.LastResourceReportedUtc.HasValue ? snapshot.LastResourceReportedUtc.Value.ToString("O", CultureInfo.InvariantCulture) : string.Empty)}\"",
        $"\"BedSnapshotRowCount\",\"{snapshot.BedSnapshotRowCount.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"TotalBedsAvailable\",\"{snapshot.TotalBedsAvailable.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"TotalBedsOccupied\",\"{snapshot.TotalBedsOccupied.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"TotalBedsUnavailable\",\"{snapshot.TotalBedsUnavailable.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"LastBedReportedUtc\",\"{(snapshot.LastBedReportedUtc.HasValue ? snapshot.LastBedReportedUtc.Value.ToString("O", CultureInfo.InvariantCulture) : string.Empty)}\"",
        $"\"ComputedBedOccupancyPercent\",\"{(snapshot.TotalBedsAvailable + snapshot.TotalBedsOccupied > 0 ? ((snapshot.TotalBedsOccupied / (double)(snapshot.TotalBedsAvailable + snapshot.TotalBedsOccupied)) * 100d).ToString("0.##", CultureInfo.InvariantCulture) : "0")}\"",
        $"\"ComputedResourceCommitmentVsAvailablePercent\",\"{(snapshot.TotalQuantityAvailable > 0 ? ((double)(snapshot.TotalQuantityCommitted / snapshot.TotalQuantityAvailable) * 100d).ToString("0.##", CultureInfo.InvariantCulture) : "0")}\""
    };

    var exportUtc = DateTimeOffset.UtcNow;
    var fileName = $"admin-location-snapshot-{locationId}-{exportUtc:yyyyMMdd-HHmmss}.csv";
    var fileBytes = Encoding.UTF8.GetBytes(string.Join(Environment.NewLine, lines));

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "ADMIN_LOCATION_SNAPSHOT_EXPORT_CSV",
            "org",
            "Location",
            locationId.ToString(CultureInfo.InvariantCulture),
            null,
            locationId,
            "Success",
            JsonSerializer.Serialize(new
            {
                locationId,
                fileName,
                exportedUtc = exportUtc,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(fileBytes, "text/csv", fileName);
})
.WithName("ExportAdminLocationSnapshotCsv");

admin.MapGet("/locations/{locationId:long}/snapshot/export/json", async (long locationId, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (locationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["locationId"] = ["locationId must be greater than zero."]
        });
    }

    var snapshot = await lookupQueryService.GetAdminLocationSnapshotAsync(locationId, cancellationToken);
    if (snapshot is null)
    {
        return Results.NotFound();
    }

    var exportUtc = DateTimeOffset.UtcNow;
    var fileName = $"admin-location-snapshot-{locationId}-{exportUtc:yyyyMMdd-HHmmss}.json";
    var jsonBytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(snapshot, new JsonSerializerOptions
    {
        WriteIndented = true,
    }));

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "ADMIN_LOCATION_SNAPSHOT_EXPORT_JSON",
            "org",
            "Location",
            locationId.ToString(CultureInfo.InvariantCulture),
            null,
            locationId,
            "Success",
            JsonSerializer.Serialize(new
            {
                locationId,
                fileName,
                exportedUtc = exportUtc,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(jsonBytes, "application/json", fileName);
})
.WithName("ExportAdminLocationSnapshotJson");

admin.MapGet("/ics-positions", async (string? search, bool? isNimsStandard, int? pageNumber, int? pageSize, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var normalizedPageNumber = Math.Max(1, pageNumber ?? 1);
    var normalizedPageSize = Math.Clamp(pageSize ?? 25, 1, 200);
    var (items, totalCount) = await lookupQueryService.GetAdminIcsPositionsAsync(search, isNimsStandard, normalizedPageNumber, normalizedPageSize, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "ADMIN_ICS_POSITIONS_VIEW",
            "ref",
            "IcsPosition",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                search,
                isNimsStandard,
                pageNumber = normalizedPageNumber,
                pageSize = normalizedPageSize,
                itemCount = items.Count,
                totalCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new
    {
        items,
        totalCount,
        pageNumber = normalizedPageNumber,
        pageSize = normalizedPageSize
    });
})
.WithName("GetAdminIcsPositions");

admin.MapPost("/ics-positions", async (CreateAdminIcsPositionRequestDto request, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var requestErrors = ValidateCreateAdminIcsPositionRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var normalizedRequest = request with
    {
        PositionCode = request.PositionCode.Trim(),
        PositionName = request.PositionName.Trim(),
        IcsSection = request.IcsSection.Trim(),
        ParentPositionCode = string.IsNullOrWhiteSpace(request.ParentPositionCode) ? null : request.ParentPositionCode.Trim(),
        Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim()
    };

    int icsPositionId;
    try
    {
        icsPositionId = await lookupQueryService.CreateAdminIcsPositionAsync(normalizedRequest, cancellationToken);
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("PositionCode already exists.", StringComparison.Ordinal))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["positionCode"] = ["PositionCode already exists."]
        });
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("ParentPositionCode was not found.", StringComparison.Ordinal))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["parentPositionCode"] = ["ParentPositionCode was not found."]
        });
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("ParentPositionCode chain contains a cycle.", StringComparison.Ordinal))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["parentPositionCode"] = ["ParentPositionCode chain contains a cycle."]
        });
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "ICS_POSITION_CREATE",
            "ref",
            "IcsPosition",
            icsPositionId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                icsPositionId,
                normalizedRequest.PositionCode,
                normalizedRequest.PositionName,
                normalizedRequest.IcsSection,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Created($"/api/v1/admin/ics-positions/{icsPositionId}", new { icsPositionId });
})
.WithName("CreateAdminIcsPosition");

admin.MapPost("/ics-positions/{icsPositionId:int}", async (int icsPositionId, UpdateAdminIcsPositionRequestDto request, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (icsPositionId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["icsPositionId"] = ["icsPositionId must be greater than zero."]
        });
    }

    var requestErrors = ValidateUpdateAdminIcsPositionRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var normalizedRequest = request with
    {
        PositionName = request.PositionName.Trim(),
        IcsSection = request.IcsSection.Trim(),
        ParentPositionCode = string.IsNullOrWhiteSpace(request.ParentPositionCode) ? null : request.ParentPositionCode.Trim(),
        Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim()
    };

    bool success;
    try
    {
        success = await lookupQueryService.UpdateAdminIcsPositionAsync(icsPositionId, normalizedRequest, cancellationToken);
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("ParentPositionCode was not found.", StringComparison.Ordinal))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["parentPositionCode"] = ["ParentPositionCode was not found."]
        });
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("ParentPositionCode cannot reference the same position.", StringComparison.Ordinal))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["parentPositionCode"] = ["ParentPositionCode cannot reference the same position."]
        });
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("ParentPositionCode chain contains a cycle.", StringComparison.Ordinal))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["parentPositionCode"] = ["ParentPositionCode chain contains a cycle."]
        });
    }
    if (!success)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "ICS_POSITION_UPDATE",
            "ref",
            "IcsPosition",
            icsPositionId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                icsPositionId,
                normalizedRequest.PositionName,
                normalizedRequest.IcsSection,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("UpdateAdminIcsPosition");

admin.MapPost("/ics-positions/{icsPositionId:int}/nims-standard", async (int icsPositionId, UpdateAdminIcsPositionStandardStatusRequestDto request, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (icsPositionId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["icsPositionId"] = ["icsPositionId must be greater than zero."]
        });
    }

    var success = await lookupQueryService.UpdateAdminIcsPositionStandardStatusAsync(icsPositionId, request.IsNimsStandard, cancellationToken);
    if (!success)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            request.IsNimsStandard ? "ICS_POSITION_STANDARD_ENABLE" : "ICS_POSITION_STANDARD_DISABLE",
            "ref",
            "IcsPosition",
            icsPositionId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                icsPositionId,
                request.IsNimsStandard,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("UpdateAdminIcsPositionStandardStatus");

admin.MapGet("/sessions", async (string? search, int? pageNumber, int? pageSize, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var normalizedPageNumber = Math.Max(1, pageNumber ?? 1);
    var normalizedPageSize = Math.Clamp(pageSize ?? 25, 1, 200);
    var (items, totalCount) = await userQueryService.GetActiveUserSessionsAsync(search, normalizedPageNumber, normalizedPageSize, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "ADMIN_SESSIONS_VIEW",
            "sec",
            "UserSession",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                search,
                pageNumber = normalizedPageNumber,
                pageSize = normalizedPageSize,
                itemCount = items.Count,
                totalCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new
    {
        items,
        totalCount,
        pageNumber = normalizedPageNumber,
        pageSize = normalizedPageSize
    });
})
.WithName("GetAdminActiveSessions");

admin.MapPost("/sessions/{userSessionId:long}/terminate", async (long userSessionId, TerminateUserSessionRequestDto request, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (userSessionId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["userSessionId"] = ["userSessionId must be greater than zero."]
        });
    }

    var success = await userQueryService.TerminateUserSessionAsync(userSessionId, httpContext.TryGetActorUserId(), request.TerminationReason, cancellationToken);
    if (!success)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "SESSION_TERMINATE",
            "sec",
            "UserSession",
            userSessionId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                userSessionId,
                request.TerminationReason,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("TerminateAdminSession");

admin.MapPost("/sessions/{userSessionId:long}/impersonate/start", async (
    long userSessionId,
    StartUserImpersonationRequestDto request,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (userSessionId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["userSessionId"] = ["userSessionId must be greater than zero."]
        });
    }

    if (request.TargetUserId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["targetUserId"] = ["targetUserId must be greater than zero."]
        });
    }

    var actorUserId = httpContext.TryGetActorUserId();
    if (actorUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve actor user.",
            detail: "The authenticated admin user could not be resolved.",
            statusCode: StatusCodes.Status401Unauthorized);
    }

    var reason = string.IsNullOrWhiteSpace(request.Reason)
        ? "Admin impersonation initiated from session administration controls."
        : request.Reason.Trim();

    var success = await userQueryService.StartUserSessionImpersonationAsync(
        userSessionId,
        actorUserId.Value,
        request.TargetUserId,
        reason,
        cancellationToken);

    if (!success)
    {
        return Results.Conflict(new
        {
            message = "Unable to start impersonation. Session may be inactive, target user may be invalid, or impersonation is already active."
        });
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            actorUserId,
            "DATA_CHANGE",
            "SESSION_IMPERSONATION_START",
            "sec",
            "AdminImpersonationSession",
            userSessionId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                userSessionId,
                targetUserId = request.TargetUserId,
                reason,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("StartAdminSessionImpersonation");

admin.MapPost("/sessions/{userSessionId:long}/impersonate/stop", async (
    long userSessionId,
    StopUserImpersonationRequestDto request,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (userSessionId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["userSessionId"] = ["userSessionId must be greater than zero."]
        });
    }

    var actorUserId = httpContext.TryGetActorUserId();
    if (actorUserId is null)
    {
        return Results.Problem(
            title: "Unable to resolve actor user.",
            detail: "The authenticated admin user could not be resolved.",
            statusCode: StatusCodes.Status401Unauthorized);
    }

    var reason = string.IsNullOrWhiteSpace(request.Reason)
        ? null
        : request.Reason.Trim();

    var success = await userQueryService.StopUserSessionImpersonationAsync(
        userSessionId,
        actorUserId.Value,
        reason,
        cancellationToken);

    if (!success)
    {
        return Results.NotFound();
    }

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            actorUserId,
            "DATA_CHANGE",
            "SESSION_IMPERSONATION_STOP",
            "sec",
            "AdminImpersonationSession",
            userSessionId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                userSessionId,
                reason,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.NoContent();
})
.WithName("StopAdminSessionImpersonation");

admin.MapGet("/sessions/compliance-evidence/export/json", async (
    IUserQueryService userQueryService,
    IAuditEventQueryService auditEventQueryService,
    IAuditEventWriter auditWriter,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var generatedUtc = DateTimeOffset.UtcNow;
    var (activeSessions, totalActiveSessionCount) = await userQueryService.GetActiveUserSessionsAsync(
        search: null,
        pageNumber: 1,
        pageSize: 200,
        cancellationToken);

    var (terminationEvents, totalTerminationEventCount) = await auditEventQueryService.GetAuditEventsAsync(
        incidentId: null,
        eventCategory: "DATA_CHANGE",
        outcomeCode: null,
        fromUtc: generatedUtc.AddDays(-30),
        toUtc: generatedUtc,
        pageNumber: 1,
        pageSize: 200,
        eventAction: "SESSION_TERMINATE",
        cancellationToken);

    var payload = new
    {
        generatedUtc,
        scope = "Admin Session Controls Compliance Evidence",
        activeSessionSnapshot = new
        {
            totalActiveSessionCount,
            sampledSessionCount = activeSessions.Count,
            items = activeSessions
                .Select(item => new
                {
                    item.UserSessionId,
                    item.UserId,
                    item.DisplayName,
                    item.EmailAddress,
                    item.LoginUtc,
                    item.LastSeenUtc,
                    item.MfaSatisfied,
                    item.ClientIpAddress,
                    item.SessionStatus,
                })
                .ToArray()
        },
        recentTerminationAudit = new
        {
            windowDays = 30,
            totalTerminationEventCount,
            sampledEventCount = terminationEvents.Count,
            events = terminationEvents
                .Select(item => new
                {
                    item.AuditEventId,
                    item.EventUtc,
                    item.ActorUserId,
                    item.ActorDisplayName,
                    item.OutcomeCode,
                    item.ClientIpAddress,
                    item.DetailJson,
                })
                .ToArray()
        },
        activeImpersonationSnapshot = new
        {
            totalActiveImpersonationCount = activeSessions.Count(item => item.IsImpersonationActive),
            items = activeSessions
                .Where(item => item.IsImpersonationActive)
                .Select(item => new
                {
                    item.UserSessionId,
                    item.UserId,
                    item.DisplayName,
                    item.ImpersonatingAdminUserId,
                    item.ImpersonatingAdminDisplayName,
                    item.ImpersonationStartedUtc
                })
                .ToArray()
        },
        complianceChecklist = new[]
        {
            new
            {
                check = "Active session inventory available",
                status = totalActiveSessionCount >= 0 ? "Pass" : "Pending",
                evidence = $"Active sessions captured: {totalActiveSessionCount}."
            },
            new
            {
                check = "Session termination actions auditable",
                status = totalTerminationEventCount > 0 ? "Pass" : "Pending",
                evidence = totalTerminationEventCount > 0
                    ? $"Termination audit events in last 30 days: {totalTerminationEventCount}."
                    : "No termination audit events found in last 30 days."
            },
            new
            {
                check = "Impersonation controls visible and auditable",
                status = "Pass",
                evidence = $"Active impersonation sessions at export time: {activeSessions.Count(item => item.IsImpersonationActive)}."
            }
        }
    };

    var content = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
    var fileName = $"admin-session-compliance-evidence-{generatedUtc:yyyyMMdd-HHmmss}.json";

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "SESSION_COMPLIANCE_EVIDENCE_EXPORT_JSON",
            "sec",
            "UserSession",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                generatedUtc,
                totalActiveSessionCount,
                totalTerminationEventCount,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(Encoding.UTF8.GetBytes(content), "application/json", fileName);
})
.WithName("ExportAdminSessionComplianceEvidenceJson");

users.MapGet("/active", async (IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var activeUsers = await userQueryService.GetActiveUsersAsync();

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "LOOKUP",
            "ACTIVE_USERS_VIEW",
            "sec",
            "AppUser",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                count = activeUsers.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(activeUsers);
})
.CacheOutput(p => p.Expire(TimeSpan.FromMinutes(5)))
.RequireAuthorization(AuthorizationPolicies.LookupViewer)
.WithName("GetActiveUsers");

users.MapGet("/contacts", async (IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var activeContacts = await userQueryService.GetActiveContactsAsync();

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "LOOKUP",
            "ACTIVE_CONTACTS_VIEW",
            "sec",
            "UserContact",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                count = activeContacts.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(activeContacts);
})
.CacheOutput(p => p.Expire(TimeSpan.FromMinutes(5)))
.RequireAuthorization(AuthorizationPolicies.LookupViewer)
.WithName("GetActiveContacts");

lookups.MapGet("/codesets/{codeSetName}", async (string codeSetName, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var normalizedCodeSetName = codeSetName.Trim();
    if (string.IsNullOrWhiteSpace(normalizedCodeSetName))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["codeSetName"] = ["codeSetName is required."]
        });
    }

    var result = await lookupQueryService.GetLookupValuesAsync(normalizedCodeSetName, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "LOOKUP",
            "CODESET_VALUES_VIEW",
            "ref",
            "LookupValue",
            normalizedCodeSetName,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                codeSetName = normalizedCodeSetName,
                count = result.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.CacheOutput(p => p.Expire(TimeSpan.FromMinutes(5)))
.RequireAuthorization(AuthorizationPolicies.LookupViewer)
.WithName("GetLookupValuesByCodeSet");

lookups.MapGet("/codesets/{codeSetName}/search", async (string codeSetName, string? q, int? maxResults, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var normalizedCodeSetName = codeSetName.Trim();
    if (string.IsNullOrWhiteSpace(normalizedCodeSetName))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["codeSetName"] = ["codeSetName is required."]
        });
    }

    var query = q?.Trim();
    if (string.IsNullOrWhiteSpace(query))
    {
        return Results.Ok(Array.Empty<LookupValueDto>());
    }

    var boundedMaxResults = Math.Clamp(maxResults ?? 10, 1, 25);
    var result = await lookupQueryService.SearchLookupValuesAsync(normalizedCodeSetName, query, boundedMaxResults, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "LOOKUP",
            "CODESET_VALUES_SEARCH",
            "ref",
            "LookupValue",
            normalizedCodeSetName,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                codeSetName = normalizedCodeSetName,
                query,
                maxResults = boundedMaxResults,
                count = result.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.LookupViewer)
.WithName("SearchLookupValuesByCodeSet");

lookups.MapGet("/locations", async (ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var result = await lookupQueryService.GetActiveLocationsAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "LOOKUP",
            "ACTIVE_LOCATIONS_VIEW",
            "org",
            "Location",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                count = result.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.CacheOutput(p => p.Expire(TimeSpan.FromMinutes(5)))
.RequireAuthorization(AuthorizationPolicies.LookupViewer)
.WithName("GetActiveLocationLookups");

lookups.MapPost("/codesets/{codeSetName}", async (string codeSetName, CreateLookupValueRequestDto request, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var normalizedCodeSetName = codeSetName.Trim();
    if (string.IsNullOrWhiteSpace(normalizedCodeSetName))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["codeSetName"] = ["codeSetName is required."]
        });
    }

    var requestErrors = ValidateCreateLookupValueRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    try
    {
        var codeValueId = await lookupQueryService.CreateLookupValueAsync(normalizedCodeSetName, request, cancellationToken);

        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "LOOKUP_VALUE_CREATE",
                "ref",
                "LookupValue",
                codeValueId.ToString(CultureInfo.InvariantCulture),
                null,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    codeSetName = normalizedCodeSetName,
                    codeValueId,
                    request.Code,
                    request.DisplayName,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);

        return Results.Created($"/api/v1/lookups/codesets/{normalizedCodeSetName}/{codeValueId}", new { codeValueId });
    }
    catch (SqlException ex) when (ex.Number is 2627 or 2601)
    {
        return Results.Conflict(new
        {
            title = "Lookup value already exists.",
            detail = "A lookup value with the same code or display name already exists in this code set."
        });
    }
})
.RequireAuthorization(AuthorizationPolicies.LookupContributor)
.WithName("CreateLookupValue");

lookups.MapPost("/codesets/{codeSetName}/{codeValueId:int}", async (string codeSetName, int codeValueId, UpdateLookupValueRequestDto request, ILookupQueryService lookupQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var normalizedCodeSetName = codeSetName.Trim();
    if (string.IsNullOrWhiteSpace(normalizedCodeSetName))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["codeSetName"] = ["codeSetName is required."]
        });
    }

    if (codeValueId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["codeValueId"] = ["codeValueId must be greater than zero."]
        });
    }

    var requestErrors = ValidateUpdateLookupValueRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var success = await lookupQueryService.UpdateLookupValueAsync(normalizedCodeSetName, codeValueId, request, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "LOOKUP_VALUE_UPDATE",
                "ref",
                "LookupValue",
                codeValueId.ToString(CultureInfo.InvariantCulture),
                null,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    codeSetName = normalizedCodeSetName,
                    codeValueId,
                    request.DisplayName,
                    request.IsActive,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.LookupContributor)
.WithName("UpdateLookupValue");

var resources = apiV1.MapGroup("/resources");

resources.MapPost("/import/inventory", async (ResourceInventoryImportBatchRequestDto request, IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.SourceSystemCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode is required."]
        });
    }

    if (request.Rows is null || request.Rows.Count == 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["rows"] = ["At least one inventory row is required."]
        });
    }

    if (await resourceQueryService.IsInboundMessageAlreadyProcessedAsync(request.SourceSystemCode, request.SourceMessageId, "RESOURCE_STATUS", cancellationToken))
    {
        return Results.Ok(new ImportBatchResultDto(0, 0, 0, DateTimeOffset.UtcNow));
    }

    var result = await resourceQueryService.ImportResourceInventoryBatchAsync(request, cancellationToken);

    await resourceQueryService.RecordInboundMessageAsync(
        request.SourceSystemCode,
        request.SourceMessageId,
        "RESOURCE_STATUS",
        result.FailedRows == 0 ? "Processed" : "Error",
        JsonSerializer.Serialize(request),
        result.FailedRows == 0 ? null : $"{result.FailedRows} rows failed.",
        cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "IMPORT_RESOURCE_INVENTORY_BATCH",
            "res",
            "LocationResourceInventory",
            null,
            null,
            null,
            result.FailedRows == 0 ? "Success" : "PartialSuccess",
            JsonSerializer.Serialize(new
            {
                request.SourceSystemCode,
                request.SourceMessageId,
                result.TotalRows,
                result.SucceededRows,
                result.FailedRows,
                traceId = httpContext.TraceIdentifier,
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("ImportResourceInventoryBatch");

resources.MapPost("/import/inventory/csv", async (HttpRequest httpRequest, IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (!httpRequest.HasFormContentType)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["contentType"] = ["multipart/form-data is required."]
        });
    }

    var form = await httpRequest.ReadFormAsync(cancellationToken);
    var sourceSystemCode = form["sourceSystemCode"].ToString();
    var sourceMessageId = form["sourceMessageId"].ToString();
    var file = form.Files.GetFile("file");

    if (string.IsNullOrWhiteSpace(sourceSystemCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode is required."]
        });
    }

    if (file is null || file.Length == 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["file"] = ["CSV file is required."]
        });
    }

    await using var resourceCsvStream = file.OpenReadStream();
    var (rows, rejects) = await ParseResourceInventoryCsvAsync(resourceCsvStream, sourceSystemCode, sourceMessageId, cancellationToken);

    var normalizedSourceMessageId = string.IsNullOrWhiteSpace(sourceMessageId) ? null : sourceMessageId.Trim();
    if (await resourceQueryService.IsInboundMessageAlreadyProcessedAsync(sourceSystemCode, normalizedSourceMessageId, "RESOURCE_STATUS", cancellationToken))
    {
        return Results.Ok(new ImportBatchResultDto(0, 0, 0, DateTimeOffset.UtcNow));
    }

    var request = new ResourceInventoryImportBatchRequestDto(sourceSystemCode.Trim(), normalizedSourceMessageId, rows);
    var result = await resourceQueryService.ImportResourceInventoryBatchAsync(
        request,
        cancellationToken);

    var rejectReportCsv = BuildRejectReportCsv(rejects);

    await resourceQueryService.RecordInboundMessageAsync(
        sourceSystemCode,
        normalizedSourceMessageId,
        "RESOURCE_STATUS",
        result.FailedRows == 0 ? "Processed" : "Error",
        JsonSerializer.Serialize(request),
        result.FailedRows == 0 ? null : $"{result.FailedRows} rows failed.",
        cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "IMPORT_RESOURCE_INVENTORY_CSV",
            "res",
            "LocationResourceInventory",
            null,
            null,
            null,
            result.FailedRows == 0 ? "Success" : "PartialSuccess",
            JsonSerializer.Serialize(new { file.FileName, sourceSystemCode, result.TotalRows, result.SucceededRows, result.FailedRows, traceId = httpContext.TraceIdentifier })),
        cancellationToken);

    return Results.Ok(new DetailedImportBatchResultDto(result, rejects, rejectReportCsv));
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("ImportResourceInventoryCsv");

resources.MapPost("/import/inventory/csv/reject-report", async (HttpRequest httpRequest, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (!httpRequest.HasFormContentType)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["contentType"] = ["multipart/form-data is required."]
        });
    }

    var form = await httpRequest.ReadFormAsync(cancellationToken);
    var sourceSystemCode = form["sourceSystemCode"].ToString();
    var sourceMessageId = form["sourceMessageId"].ToString();
    var file = form.Files.GetFile("file");

    if (string.IsNullOrWhiteSpace(sourceSystemCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode is required."]
        });
    }

    if (file is null || file.Length == 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["file"] = ["CSV file is required."]
        });
    }

    await using var stream = file.OpenReadStream();
    var (_, rejects) = await ParseResourceInventoryCsvAsync(stream, sourceSystemCode, sourceMessageId, cancellationToken);
    var rejectReportCsv = BuildRejectReportCsv(rejects);
    var reportBytes = Encoding.UTF8.GetBytes(rejectReportCsv);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "IMPORT_RESOURCE_INVENTORY_REJECT_REPORT_DOWNLOAD",
            "res",
            "LocationResourceInventory",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                sourceSystemCode,
                sourceMessageId,
                rejectCount = rejects.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(reportBytes, "text/csv", "resource-import-reject-report.csv");
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("DownloadResourceInventoryCsvRejectReport");

resources.MapGet("/inventory", async (IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var result = await resourceQueryService.GetResourceInventoryAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "RESOURCE",
            "RESOURCE_INVENTORY_VIEW",
            "res",
            "LocationResourceInventory",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                count = result.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("GetResourceInventory");

resources.MapGet("/regional-rollups", async (int? regionId, string? regionName, IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var filter = new ResourceRegionalRollupFilterDto(regionId, regionName);
    var result = await resourceQueryService.GetResourceRegionalRollupsAsync(filter, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "RESOURCE",
            "RESOURCE_REGIONAL_ROLLUPS_VIEW",
            "res",
            "LocationResourceInventory",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                regionId,
                regionName,
                count = result.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("GetResourceRegionalRollups");

resources.MapGet("/regional-rollups/export/csv", async (
    int? regionId,
    string? regionName,
    IResourceQueryService resourceQueryService,
    IUserQueryService userQueryService,
    IAuditEventWriter auditWriter,
    ClaimsPrincipal user,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active user context is available for this request.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var filter = new ResourceRegionalRollupFilterDto(regionId, regionName);
    var snapshot = await resourceQueryService.GetResourceRegionalRollupSnapshotAsync(filter, cancellationToken);

    static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        return value.Replace("\"", "\"\"");
    }

    var lines = new List<string>
    {
        "Section,Metric,Value",
        $"\"RANGE\",\"GeneratedUtc\",\"{snapshot.GeneratedUtc:O}\"",
        $"\"SUMMARY\",\"StatewideResourceAvailable\",\"{snapshot.StatewideResourceAvailable.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"SUMMARY\",\"StatewideResourceCommitted\",\"{snapshot.StatewideResourceCommitted.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"SUMMARY\",\"StatewideResourceOutOfService\",\"{snapshot.StatewideResourceOutOfService.ToString(CultureInfo.InvariantCulture)}\"",
        $"\"SUMMARY\",\"StatewideBedsAvailable\",\"{snapshot.StatewideBedsAvailable}\"",
        $"\"SUMMARY\",\"StatewideBedsOccupied\",\"{snapshot.StatewideBedsOccupied}\"",
        $"\"SUMMARY\",\"StatewideBedsUnavailable\",\"{snapshot.StatewideBedsUnavailable}\"",
        string.Empty,
        "RegionId,RegionName,ResourceAvailable,ResourceCommitted,ResourceOutOfService,BedsAvailable,BedsOccupied,BedsUnavailable",
    };

    foreach (var row in snapshot.Regions)
    {
        lines.Add($"\"{(row.RegionId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty)}\",\"{EscapeCsv(row.RegionName)}\",\"{row.ResourceAvailable.ToString(CultureInfo.InvariantCulture)}\",\"{row.ResourceCommitted.ToString(CultureInfo.InvariantCulture)}\",\"{row.ResourceOutOfService.ToString(CultureInfo.InvariantCulture)}\",\"{row.BedsAvailable}\",\"{row.BedsOccupied}\",\"{row.BedsUnavailable}\"");
    }

    var fileName = $"resource-regional-rollup-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}.csv";

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId,
            "RESOURCE",
            "RESOURCE_REGIONAL_ROLLUP_EXPORT_CSV",
            "res",
            "LocationResourceInventory",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                regionalRows = snapshot.Regions.Count,
                regionId,
                regionName,
                fileName,
                traceId = httpContext.TraceIdentifier,
            })),
        cancellationToken);

    var fileBytes = Encoding.UTF8.GetBytes(string.Join("\n", lines));
    return Results.File(fileBytes, "text/csv", fileName);
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("ExportResourceRegionalRollupsCsv");

resources.MapPost("/inventory/{locationResourceInventoryId:long}", async (long locationResourceInventoryId, UpdateResourceInventoryRequestDto request, IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (locationResourceInventoryId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["locationResourceInventoryId"] = ["locationResourceInventoryId must be greater than zero."]
        });
    }

    var requestErrors = ValidateResourceInventoryRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var success = await resourceQueryService.UpdateResourceInventoryAsync(locationResourceInventoryId, request, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "RESOURCE_INVENTORY_UPDATE",
                "res",
                "LocationResourceInventory",
                locationResourceInventoryId.ToString(CultureInfo.InvariantCulture),
                null,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    locationResourceInventoryId,
                    request.QuantityAvailable,
                    request.QuantityCommitted,
                    request.QuantityOutOfService,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("UpdateResourceInventory");

resources.MapGet("/report-presets/{presetScope}", async (string presetScope, ClaimsPrincipal user, IResourceQueryService resourceQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(presetScope))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["presetScope"] = ["presetScope is required."]
        });
    }

    var trimmedScope = presetScope.Trim();

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for report preset operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    var results = await resourceQueryService.GetUserReportPresetsAsync(userId.Value, trimmedScope, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "RESOURCE",
            "REPORT_PRESETS_VIEW",
            "res",
            "UserReportPreset",
            trimmedScope,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                presetScope = trimmedScope,
                count = results.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(results);
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("GetUserReportPresets");

resources.MapPost("/report-presets/{presetScope}", async (string presetScope, UpsertUserReportPresetRequestDto request, ClaimsPrincipal user, IResourceQueryService resourceQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(presetScope))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["presetScope"] = ["presetScope is required."]
        });
    }

    if (string.IsNullOrWhiteSpace(request.PresetName) || request.PresetName.Trim().Length > 140)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["presetName"] = ["presetName is required and must be 140 characters or fewer."]
        });
    }

    if (string.IsNullOrWhiteSpace(request.PresetJson))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["presetJson"] = ["presetJson is required."]
        });
    }

    var trimmedScope = presetScope.Trim();

    if (string.Equals(trimmedScope, "dashboard-generated-visualization-specs-v1", StringComparison.Ordinal)
        || string.Equals(trimmedScope, "reports-generated-visualization-specs-v1", StringComparison.Ordinal))
    {
        var normalizedPresetJson = NormalizeGeneratedVisualizationSpecPresetJson(request.PresetJson);
        if (normalizedPresetJson is not null)
        {
            request = request with { PresetJson = normalizedPresetJson };
            generatedVisualizationSpecNormalizedCounter.Add(
                1,
                new KeyValuePair<string, object?>("preset_scope", trimmedScope));
            logger.LogInformation(
                "Normalized generated visualization preset payload by injecting missing version fields. Scope: {PresetScope}",
                trimmedScope);
        }

        var generatedSpecValidationErrors = ValidateGeneratedVisualizationSpecPresetJson(request.PresetJson, trimmedScope);
        if (generatedSpecValidationErrors is not null)
        {
            return Results.ValidationProblem(generatedSpecValidationErrors);
        }
    }

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for report preset operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    var userReportPresetId = await resourceQueryService.UpsertUserReportPresetAsync(userId.Value, trimmedScope, request, cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            userId.Value,
            "DATA_CHANGE",
            "REPORT_PRESET_UPSERT",
            "res",
            "UserReportPreset",
            userReportPresetId.ToString(CultureInfo.InvariantCulture),
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                presetScope = trimmedScope,
                userReportPresetId,
                request.PresetName,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(new { userReportPresetId });
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("UpsertUserReportPreset");

resources.MapDelete("/report-presets/{presetScope}/{userReportPresetId:long}", async (string presetScope, long userReportPresetId, ClaimsPrincipal user, IResourceQueryService resourceQueryService, IUserQueryService userQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(presetScope))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["presetScope"] = ["presetScope is required."]
        });
    }

    if (userReportPresetId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["userReportPresetId"] = ["userReportPresetId must be greater than zero."]
        });
    }

    var trimmedScope = presetScope.Trim();

    var userId = await ResolveEffectiveUserIdAsync(user, userQueryService);
    if (userId is null)
    {
        return Results.Problem(
            title: "Unable to resolve request user.",
            detail: "No active application user is available for report preset operations.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    var deleted = await resourceQueryService.DeleteUserReportPresetAsync(userId.Value, trimmedScope, userReportPresetId, cancellationToken);

    if (deleted)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                userId.Value,
                "DATA_CHANGE",
                "REPORT_PRESET_DELETE",
                "res",
                "UserReportPreset",
                userReportPresetId.ToString(CultureInfo.InvariantCulture),
                null,
                null,
                "Success",
                JsonSerializer.Serialize(new
                {
                    presetScope = trimmedScope,
                    userReportPresetId,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return deleted ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("DeleteUserReportPreset");

static string? NormalizeGeneratedVisualizationSpecPresetJson(string presetJson)
{
    try
    {
        if (JsonNode.Parse(presetJson) is not JsonObject root)
        {
            return null;
        }

        var changed = false;
        if (!root.TryGetPropertyValue("schemaVersion", out _))
        {
            root["schemaVersion"] = 1;
            changed = true;
        }

        if (!root.TryGetPropertyValue("specVersion", out _))
        {
            root["specVersion"] = 1;
            changed = true;
        }

        return changed
            ? root.ToJsonString(new JsonSerializerOptions { WriteIndented = false })
            : null;
    }
    catch (JsonException)
    {
        return null;
    }
}

static Dictionary<string, string[]>? ValidateGeneratedVisualizationSpecPresetJson(string presetJson, string presetScope)
{
    try
    {
        if (presetJson.Length > 64 * 1024)
        {
            return new Dictionary<string, string[]>
            {
                ["presetJson"] = ["Generated visualization spec payload exceeds the 64KB size limit."]
            };
        }

        using var jsonDocument = JsonDocument.Parse(presetJson);
        var root = jsonDocument.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
        {
            return new Dictionary<string, string[]>
            {
                ["presetJson"] = ["Generated visualization spec payload must be a JSON object."]
            };
        }

        if (!root.TryGetProperty("schemaVersion", out var schemaVersionElement)
            || schemaVersionElement.ValueKind != JsonValueKind.Number
            || !schemaVersionElement.TryGetInt32(out var schemaVersion)
            || schemaVersion <= 0)
        {
            return new Dictionary<string, string[]>
            {
                ["presetJson.schemaVersion"] = ["schemaVersion is required and must be a positive integer."]
            };
        }

        if (!root.TryGetProperty("specVersion", out var specVersionElement)
            || specVersionElement.ValueKind != JsonValueKind.Number
            || !specVersionElement.TryGetInt32(out var specVersion)
            || specVersion <= 0)
        {
            return new Dictionary<string, string[]>
            {
                ["presetJson.specVersion"] = ["specVersion is required and must be a positive integer."]
            };
        }

        if (!root.TryGetProperty("widgetIds", out var widgetIdsElement)
            || widgetIdsElement.ValueKind != JsonValueKind.Array)
        {
            return new Dictionary<string, string[]>
            {
                ["presetJson.widgetIds"] = ["widgetIds is required and must be an array."]
            };
        }

        var validWidgetIdCount = 0;
        foreach (var item in widgetIdsElement.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(item.GetString()))
            {
                validWidgetIdCount += 1;
            }
        }

        if (validWidgetIdCount == 0)
        {
            return new Dictionary<string, string[]>
            {
                ["presetJson.widgetIds"] = ["widgetIds must contain at least one non-empty widget identifier."]
            };
        }

        if (!root.TryGetProperty("target", out var targetElement)
            || targetElement.ValueKind != JsonValueKind.String)
        {
            return new Dictionary<string, string[]>
            {
                ["presetJson.target"] = ["target is required for generated visualization specs."]
            };
        }

        var target = targetElement.GetString()?.Trim();
        if (string.IsNullOrWhiteSpace(target))
        {
            return new Dictionary<string, string[]>
            {
                ["presetJson.target"] = ["target is required for generated visualization specs."]
            };
        }

        var expectedTarget = string.Equals(presetScope, "dashboard-generated-visualization-specs-v1", StringComparison.Ordinal)
            ? "dashboard"
            : "reports";

        if (!string.Equals(target, expectedTarget, StringComparison.OrdinalIgnoreCase))
        {
            return new Dictionary<string, string[]>
            {
                ["presetJson.target"] = [$"target must be '{expectedTarget}' for scope '{presetScope}'."]
            };
        }

        return null;
    }
    catch (JsonException)
    {
        return new Dictionary<string, string[]>
        {
            ["presetJson"] = ["presetJson must be valid JSON for generated visualization specs."]
        };
    }
}

var beds = apiV1.MapGroup("/beds");

beds.MapPost("/import/availability", async (BedAvailabilityImportBatchRequestDto request, IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.SourceSystemCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode is required."]
        });
    }

    if (request.Rows is null || request.Rows.Count == 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["rows"] = ["At least one bed availability row is required."]
        });
    }

    if (await resourceQueryService.IsInboundMessageAlreadyProcessedAsync(request.SourceSystemCode, request.SourceMessageId, "BED_AVAILABILITY", cancellationToken))
    {
        return Results.Ok(new ImportBatchResultDto(0, 0, 0, DateTimeOffset.UtcNow));
    }

    var result = await resourceQueryService.ImportBedAvailabilityBatchAsync(request, cancellationToken);

    await resourceQueryService.RecordInboundMessageAsync(
        request.SourceSystemCode,
        request.SourceMessageId,
        "BED_AVAILABILITY",
        result.FailedRows == 0 ? "Processed" : "Error",
        JsonSerializer.Serialize(request),
        result.FailedRows == 0 ? null : $"{result.FailedRows} rows failed.",
        cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "IMPORT_BED_AVAILABILITY_BATCH",
            "res",
            "BedAvailabilitySnapshot",
            null,
            null,
            null,
            result.FailedRows == 0 ? "Success" : "PartialSuccess",
            JsonSerializer.Serialize(new
            {
                request.SourceSystemCode,
                request.SourceMessageId,
                result.TotalRows,
                result.SucceededRows,
                result.FailedRows,
                traceId = httpContext.TraceIdentifier,
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("ImportBedAvailabilityBatch");

beds.MapPost("/import/availability/csv", async (HttpRequest httpRequest, IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (!httpRequest.HasFormContentType)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["contentType"] = ["multipart/form-data is required."]
        });
    }

    var form = await httpRequest.ReadFormAsync(cancellationToken);
    var sourceSystemCode = form["sourceSystemCode"].ToString();
    var sourceMessageId = form["sourceMessageId"].ToString();
    var file = form.Files.GetFile("file");

    if (string.IsNullOrWhiteSpace(sourceSystemCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode is required."]
        });
    }

    if (file is null || file.Length == 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["file"] = ["CSV file is required."]
        });
    }

    await using var bedCsvStream = file.OpenReadStream();
    var (rows, rejects) = await ParseBedAvailabilityCsvAsync(bedCsvStream, sourceSystemCode, sourceMessageId, cancellationToken);

    var normalizedSourceMessageId = string.IsNullOrWhiteSpace(sourceMessageId) ? null : sourceMessageId.Trim();
    if (await resourceQueryService.IsInboundMessageAlreadyProcessedAsync(sourceSystemCode, normalizedSourceMessageId, "BED_AVAILABILITY", cancellationToken))
    {
        return Results.Ok(new ImportBatchResultDto(0, 0, 0, DateTimeOffset.UtcNow));
    }

    var request = new BedAvailabilityImportBatchRequestDto(sourceSystemCode.Trim(), normalizedSourceMessageId, rows);
    var result = await resourceQueryService.ImportBedAvailabilityBatchAsync(
        request,
        cancellationToken);

    var rejectReportCsv = BuildRejectReportCsv(rejects);

    await resourceQueryService.RecordInboundMessageAsync(
        sourceSystemCode,
        normalizedSourceMessageId,
        "BED_AVAILABILITY",
        result.FailedRows == 0 ? "Processed" : "Error",
        JsonSerializer.Serialize(request),
        result.FailedRows == 0 ? null : $"{result.FailedRows} rows failed.",
        cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "IMPORT_BED_AVAILABILITY_CSV",
            "res",
            "BedAvailabilitySnapshot",
            null,
            null,
            null,
            result.FailedRows == 0 ? "Success" : "PartialSuccess",
            JsonSerializer.Serialize(new { file.FileName, sourceSystemCode, result.TotalRows, result.SucceededRows, result.FailedRows, traceId = httpContext.TraceIdentifier })),
        cancellationToken);

    return Results.Ok(new DetailedImportBatchResultDto(result, rejects, rejectReportCsv));
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("ImportBedAvailabilityCsv");

beds.MapPost("/import/availability/csv/reject-report", async (HttpRequest httpRequest, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (!httpRequest.HasFormContentType)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["contentType"] = ["multipart/form-data is required."]
        });
    }

    var form = await httpRequest.ReadFormAsync(cancellationToken);
    var sourceSystemCode = form["sourceSystemCode"].ToString();
    var sourceMessageId = form["sourceMessageId"].ToString();
    var file = form.Files.GetFile("file");

    if (string.IsNullOrWhiteSpace(sourceSystemCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode is required."]
        });
    }

    if (file is null || file.Length == 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["file"] = ["CSV file is required."]
        });
    }

    await using var stream = file.OpenReadStream();
    var (_, rejects) = await ParseBedAvailabilityCsvAsync(stream, sourceSystemCode, sourceMessageId, cancellationToken);
    var rejectReportCsv = BuildRejectReportCsv(rejects);
    var reportBytes = Encoding.UTF8.GetBytes(rejectReportCsv);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "REPORTING",
            "IMPORT_BED_AVAILABILITY_REJECT_REPORT_DOWNLOAD",
            "res",
            "BedAvailabilitySnapshot",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                sourceSystemCode,
                sourceMessageId,
                rejectCount = rejects.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.File(reportBytes, "text/csv", "bed-import-reject-report.csv");
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("DownloadBedAvailabilityCsvRejectReport");

beds.MapPost("/import/availability/fhir", async (FhirBedAvailabilityImportRequestDto request, IFhirBedAvailabilityTranslator translator, IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.SourceSystemCode))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode is required."]
        });
    }

    if (string.IsNullOrWhiteSpace(request.BundleJson))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["bundleJson"] = ["FHIR bundle JSON is required."]
        });
    }

    var normalizedSourceSystemCode = request.SourceSystemCode.Trim();
    var normalizedSourceMessageId = string.IsNullOrWhiteSpace(request.SourceMessageId)
        ? null
        : request.SourceMessageId.Trim();

    if (normalizedSourceSystemCode.Length > 80)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceSystemCode"] = ["sourceSystemCode cannot exceed 80 characters."]
        });
    }

    if (normalizedSourceMessageId is not null && normalizedSourceMessageId.Length > 200)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["sourceMessageId"] = ["sourceMessageId cannot exceed 200 characters when provided."]
        });
    }

    if (await resourceQueryService.IsInboundMessageAlreadyProcessedAsync(normalizedSourceSystemCode, normalizedSourceMessageId, "BED_AVAILABILITY", cancellationToken))
    {
        return Results.Ok(new
        {
            result = new ImportBatchResultDto(0, 0, 0, DateTimeOffset.UtcNow),
            rejectedCount = 0,
            rejects = Array.Empty<string>(),
        });
    }

    (BedAvailabilityImportBatchRequestDto batch, IReadOnlyList<string> rejects) translated;
    try
    {
        translated = translator.Translate(normalizedSourceSystemCode, normalizedSourceMessageId, request.BundleJson);
    }
    catch (JsonException)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["bundleJson"] = ["FHIR bundle JSON is invalid and could not be parsed."]
        });
    }

    var (batch, rejects) = translated;
    var result = await resourceQueryService.ImportBedAvailabilityBatchAsync(batch, cancellationToken);

    await resourceQueryService.RecordInboundMessageAsync(
        normalizedSourceSystemCode,
        normalizedSourceMessageId,
        "BED_AVAILABILITY",
        result.FailedRows == 0 && rejects.Count == 0 ? "Processed" : "Rejected",
        request.BundleJson,
        rejects.Count == 0 ? null : string.Join(" | ", rejects.Take(10)),
        cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "DATA_CHANGE",
            "IMPORT_BED_AVAILABILITY_FHIR",
            "res",
            "BedAvailabilitySnapshot",
            null,
            null,
            null,
            result.FailedRows == 0 && rejects.Count == 0 ? "Success" : "PartialSuccess",
            JsonSerializer.Serialize(new { sourceSystemCode = normalizedSourceSystemCode, sourceMessageId = normalizedSourceMessageId, result.TotalRows, result.SucceededRows, result.FailedRows, rejectedCount = rejects.Count, traceId = httpContext.TraceIdentifier })),
        cancellationToken);

    var fhirRejects = rejects
        .Select((reason, index) => new ImportRejectDto(index + 1, "BED_AVAILABILITY", normalizedSourceSystemCode, normalizedSourceMessageId, reason, string.Empty))
        .ToList();

    var rejectReportCsv = BuildRejectReportCsv(fhirRejects);

    return Results.Ok(new
    {
        result,
        rejectedCount = rejects.Count,
        rejects,
        rejectReportCsv,
    });
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("ImportBedAvailabilityFhir");

beds.MapGet("/import/availability/fhir/adapter-contract", async (IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var payload = new
    {
        contractVersion = "1.0",
        adapterName = "IOCEM FHIR Bed Availability Adapter",
        interfaceTypeCode = "BED_AVAILABILITY",
        supportedFhir = new
        {
            bundleResourceType = "Bundle",
            requiredEntryResourceTypes = new[] { "Location", "HealthcareService" },
            locationReferencePattern = "HealthcareService.providedBy.reference -> Location/{id}",
            locationIdentityMapping = "Location.identifier.value must map to IOCEM LocationId (long).",
        },
        bedCategoryMapping = new
        {
            source = "HealthcareService.category.coding.code",
            target = "BedCategoryCode",
            requirement = "At least one category coding code is required.",
        },
        extensionMapping = new[]
        {
            new { urlKey = "staffedBedsTotal", targetField = "StaffedBedsTotal", valueType = "valueInteger", required = false },
            new { urlKey = "bedsAvailable", targetField = "BedsAvailable", valueType = "valueInteger", required = false },
            new { urlKey = "bedsOccupied", targetField = "BedsOccupied", valueType = "valueInteger", required = false },
            new { urlKey = "bedsUnavailable", targetField = "BedsUnavailable", valueType = "valueInteger", required = false },
            new { urlKey = "isolationCapableBeds", targetField = "IsolationCapableBeds", valueType = "valueInteger", required = false },
            new { urlKey = "surgeBedsPotential", targetField = "SurgeBedsPotential", valueType = "valueInteger", required = false },
        },
        idempotency = new
        {
            key = "(SourceSystemCode, SourceMessageId, InterfaceTypeCode)",
            duplicateBehavior = "Already-processed messages short-circuit with zero-row import result."
        },
        endpoint = new
        {
            method = "POST",
            path = "/api/v1/beds/import/availability/fhir",
            requiredRequestFields = new[] { "sourceSystemCode", "bundleJson" },
            optionalRequestFields = new[] { "sourceMessageId" }
        },
        deliverySlices = new[]
        {
            new
            {
                slice = "Slice 1",
                goal = "Adapter contract lock + payload conformance",
                includes = new[] { "Contract publication", "Bundle resource validation", "Location/HealthcareService correlation checks" }
            },
            new
            {
                slice = "Slice 2",
                goal = "Production ingest reliability",
                includes = new[] { "Idempotency enforcement", "Inbound interface persistence", "Reject report generation" }
            },
            new
            {
                slice = "Slice 3",
                goal = "Facility parity and reconciliation",
                includes = new[] { "Point-in-time facility parity checks", "Operational evidence exports", "Staging acceptance execution" }
            }
        }
    };

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "LOOKUP",
            "BED_AVAILABILITY_FHIR_ADAPTER_CONTRACT_VIEW",
            "res",
            "BedAvailabilitySnapshot",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                payload.contractVersion,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(payload);
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("GetFhirBedAvailabilityAdapterContract");

beds.MapGet("/availability", async (IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    var result = await resourceQueryService.GetBedAvailabilityAsync(cancellationToken);

    await auditWriter.WriteAsync(
        httpContext,
        new AuditEventWriteModel(
            httpContext.TryGetActorUserId(),
            "RESOURCE",
            "BED_AVAILABILITY_VIEW",
            "res",
            "BedAvailabilitySnapshot",
            null,
            null,
            null,
            "Success",
            JsonSerializer.Serialize(new
            {
                count = result.Count,
                traceId = httpContext.TraceIdentifier
            })),
        cancellationToken);

    return Results.Ok(result);
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("GetBedAvailability");

beds.MapPost("/availability/{locationId:long}", async (long locationId, UpdateBedAvailabilityRequestDto request, IResourceQueryService resourceQueryService, IAuditEventWriter auditWriter, HttpContext httpContext, CancellationToken cancellationToken) =>
{
    if (locationId <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["locationId"] = ["locationId must be greater than zero."]
        });
    }

    var requestErrors = ValidateBedAvailabilityRequest(request);
    if (requestErrors is not null)
    {
        return Results.ValidationProblem(requestErrors);
    }

    var success = await resourceQueryService.AddBedAvailabilitySnapshotAsync(locationId, request, cancellationToken);

    if (success)
    {
        await auditWriter.WriteAsync(
            httpContext,
            new AuditEventWriteModel(
                httpContext.TryGetActorUserId(),
                "DATA_CHANGE",
                "BED_AVAILABILITY_SNAPSHOT_ADD",
                "res",
                "BedAvailabilitySnapshot",
                locationId.ToString(CultureInfo.InvariantCulture),
                null,
                locationId,
                "Success",
                JsonSerializer.Serialize(new
                {
                    locationId,
                    request.StaffedBedsTotal,
                    request.BedsAvailable,
                    request.BedsOccupied,
                    request.BedsUnavailable,
                    traceId = httpContext.TraceIdentifier
                })),
            cancellationToken);
    }

    return success ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization(AuthorizationPolicies.ResourceReporter)
.WithName("AddBedAvailabilitySnapshot");

app.MapDefaultEndpoints();

app.UseFileServer();

app.Run();

static Dictionary<string, string[]>? ValidateCreateLookupValueRequest(CreateLookupValueRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.Code))
    {
        errors["code"] = ["Code is required."];
    }
    else if (request.Code.Trim().Length > 80)
    {
        errors["code"] = ["Code cannot exceed 80 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.DisplayName))
    {
        errors["displayName"] = ["DisplayName is required."];
    }
    else if (request.DisplayName.Trim().Length > 200)
    {
        errors["displayName"] = ["DisplayName cannot exceed 200 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 1000)
    {
        errors["description"] = ["Description cannot exceed 1000 characters."];
    }

    if (request.SortOrder is < 0)
    {
        errors["sortOrder"] = ["SortOrder cannot be negative."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateUpdateAdminLocationGeoRequest(UpdateAdminLocationGeoRequestDto request)
{
    var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

    if (request.Latitude.HasValue && (request.Latitude < -90m || request.Latitude > 90m))
    {
        errors["latitude"] = ["Latitude must be between -90 and 90."];
    }

    if (request.Longitude.HasValue && (request.Longitude < -180m || request.Longitude > 180m))
    {
        errors["longitude"] = ["Longitude must be between -180 and 180."];
    }

    if (!string.IsNullOrWhiteSpace(request.StateCode) && request.StateCode.Trim().Length > 2)
    {
        errors["stateCode"] = ["StateCode must be a 2-character code."];
    }

    if (!string.IsNullOrWhiteSpace(request.CityName) && request.CityName.Trim().Length > 120)
    {
        errors["cityName"] = ["CityName cannot exceed 120 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.PostalCode) && request.PostalCode.Trim().Length > 20)
    {
        errors["postalCode"] = ["PostalCode cannot exceed 20 characters."];
    }

    return errors.Count > 0 ? errors : null;
}

static Dictionary<string, string[]>? ValidateUpdateIncidentOperationalPeriodRequest(UpdateIncidentOperationalPeriodRequestDto request)
{
    var errors = ValidateCreateIncidentOperationalPeriodRequest(new CreateIncidentOperationalPeriodRequestDto(
        request.PeriodNumber,
        request.PeriodName,
        request.StartUtc,
        request.EndUtc,
        request.StatusCode,
        request.PlanningMeetingUtc)) ?? new Dictionary<string, string[]>();

    var normalizedStatus = request.StatusCode?.Trim();
    if (!string.Equals(normalizedStatus, "Planned", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(normalizedStatus, "Active", StringComparison.OrdinalIgnoreCase))
    {
        errors["statusCode"] = ["StatusCode must be Planned or Active for update operations. Use the approve endpoint to transition to Approved state."];
    }

    if (request.ApprovedByUserId.HasValue)
    {
        errors["approvedByUserId"] = ["ApprovedByUserId cannot be set through update operations. Use the approve endpoint."];
    }

    if (request.ApprovedUtc.HasValue)
    {
        errors["approvedUtc"] = ["ApprovedUtc cannot be set through update operations. Use the approve endpoint."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateUpdateLookupValueRequest(UpdateLookupValueRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.DisplayName))
    {
        errors["displayName"] = ["DisplayName is required."];
    }
    else if (request.DisplayName.Trim().Length > 200)
    {
        errors["displayName"] = ["DisplayName cannot exceed 200 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 1000)
    {
        errors["description"] = ["Description cannot exceed 1000 characters."];
    }

    if (request.SortOrder is < 0)
    {
        errors["sortOrder"] = ["SortOrder cannot be negative."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateUpdateIncidentObjectiveRequest(UpdateIncidentObjectiveRequestDto request)
{
    return ValidateCreateIncidentObjectiveRequest(new CreateIncidentObjectiveRequestDto(
        request.OperationalPeriodId,
        request.ObjectiveNumber,
        request.ObjectiveText,
        request.PriorityCode,
        request.StatusCode,
        request.OwnerUserId,
        request.DueUtc));
}

static Dictionary<string, string[]>? ValidateCreateAdminIcsPositionRequest(CreateAdminIcsPositionRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.PositionCode))
    {
        errors["positionCode"] = ["PositionCode is required."];
    }
    else if (request.PositionCode.Trim().Length > 40)
    {
        errors["positionCode"] = ["PositionCode cannot exceed 40 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.PositionName))
    {
        errors["positionName"] = ["PositionName is required."];
    }
    else if (request.PositionName.Trim().Length > 160)
    {
        errors["positionName"] = ["PositionName cannot exceed 160 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.IcsSection))
    {
        errors["icsSection"] = ["IcsSection is required."];
    }
    else if (request.IcsSection.Trim().Length > 80)
    {
        errors["icsSection"] = ["IcsSection cannot exceed 80 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.ParentPositionCode) && request.ParentPositionCode.Trim().Length > 40)
    {
        errors["parentPositionCode"] = ["ParentPositionCode cannot exceed 40 characters."];
    }

    if (request.SortOrder is < 0)
    {
        errors["sortOrder"] = ["SortOrder cannot be negative."];
    }

    if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 1000)
    {
        errors["description"] = ["Description cannot exceed 1000 characters."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateUpdateAdminIcsPositionRequest(UpdateAdminIcsPositionRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.PositionName))
    {
        errors["positionName"] = ["PositionName is required."];
    }
    else if (request.PositionName.Trim().Length > 160)
    {
        errors["positionName"] = ["PositionName cannot exceed 160 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.IcsSection))
    {
        errors["icsSection"] = ["IcsSection is required."];
    }
    else if (request.IcsSection.Trim().Length > 80)
    {
        errors["icsSection"] = ["IcsSection cannot exceed 80 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.ParentPositionCode) && request.ParentPositionCode.Trim().Length > 40)
    {
        errors["parentPositionCode"] = ["ParentPositionCode cannot exceed 40 characters."];
    }

    if (request.SortOrder is < 0)
    {
        errors["sortOrder"] = ["SortOrder cannot be negative."];
    }

    if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 1000)
    {
        errors["description"] = ["Description cannot exceed 1000 characters."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateCreateIncidentRequest(CreateIncidentRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.IncidentNumber))
    {
        errors["incidentNumber"] = ["IncidentNumber is required."];
    }
    else if (request.IncidentNumber.Trim().Length > 40)
    {
        errors["incidentNumber"] = ["IncidentNumber cannot exceed 40 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.IncidentName))
    {
        errors["incidentName"] = ["IncidentName is required."];
    }
    else if (request.IncidentName.Trim().Length > 240)
    {
        errors["incidentName"] = ["IncidentName cannot exceed 240 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.IncidentTypeCode))
    {
        errors["incidentTypeCode"] = ["IncidentTypeCode is required."];
    }
    else if (request.IncidentTypeCode.Trim().Length > 80)
    {
        errors["incidentTypeCode"] = ["IncidentTypeCode cannot exceed 80 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.SeverityCode) && request.SeverityCode.Trim().Length > 60)
    {
        errors["severityCode"] = ["SeverityCode cannot exceed 60 characters."];
    }

    if (request.LeadOrganizationId is <= 0)
    {
        errors["leadOrganizationId"] = ["LeadOrganizationId must be greater than zero when provided."];
    }

    if (request.LeadRegionId is <= 0)
    {
        errors["leadRegionId"] = ["LeadRegionId must be greater than zero when provided."];
    }

    if (request.PrimaryLocationId is <= 0)
    {
        errors["primaryLocationId"] = ["PrimaryLocationId must be greater than zero when provided."];
    }

    if (!string.IsNullOrWhiteSpace(request.InitialSummary) && request.InitialSummary.Trim().Length > 4000)
    {
        errors["initialSummary"] = ["InitialSummary cannot exceed 4000 characters."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateUpdateIncidentRequest(UpdateIncidentRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.IncidentName))
    {
        errors["incidentName"] = ["IncidentName is required."];
    }
    else if (request.IncidentName.Trim().Length > 240)
    {
        errors["incidentName"] = ["IncidentName cannot exceed 240 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.IncidentTypeCode))
    {
        errors["incidentTypeCode"] = ["IncidentTypeCode is required."];
    }
    else if (request.IncidentTypeCode.Trim().Length > 80)
    {
        errors["incidentTypeCode"] = ["IncidentTypeCode cannot exceed 80 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.SeverityCode) && request.SeverityCode.Trim().Length > 60)
    {
        errors["severityCode"] = ["SeverityCode cannot exceed 60 characters."];
    }

    if (request.LeadOrganizationId is <= 0)
    {
        errors["leadOrganizationId"] = ["LeadOrganizationId must be greater than zero when provided."];
    }

    if (request.LeadRegionId is <= 0)
    {
        errors["leadRegionId"] = ["LeadRegionId must be greater than zero when provided."];
    }

    if (request.PrimaryLocationId is <= 0)
    {
        errors["primaryLocationId"] = ["PrimaryLocationId must be greater than zero when provided."];
    }

    if (!string.IsNullOrWhiteSpace(request.InitialSummary) && request.InitialSummary.Trim().Length > 4000)
    {
        errors["initialSummary"] = ["InitialSummary cannot exceed 4000 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.SituationSummary) && request.SituationSummary.Trim().Length > 4000)
    {
        errors["situationSummary"] = ["SituationSummary cannot exceed 4000 characters."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateCreateIncidentTaskRequest(CreateIncidentTaskRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.TaskTitle))
    {
        errors["taskTitle"] = ["TaskTitle is required."];
    }
    else if (request.TaskTitle.Trim().Length > 240)
    {
        errors["taskTitle"] = ["TaskTitle cannot exceed 240 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.TaskDescription) && request.TaskDescription.Trim().Length > 4000)
    {
        errors["taskDescription"] = ["TaskDescription cannot exceed 4000 characters."];
    }

    var allowedPriorities = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Low",
        "Normal",
        "High",
        "Critical",
    };

    if (string.IsNullOrWhiteSpace(request.PriorityCode))
    {
        errors["priorityCode"] = ["PriorityCode is required."];
    }
    else if (!allowedPriorities.Contains(request.PriorityCode.Trim()))
    {
        errors["priorityCode"] = ["PriorityCode must be one of: Low, Normal, High, Critical."];
    }

    if (request.AssignedToUserId is <= 0)
    {
        errors["assignedToUserId"] = ["AssignedToUserId must be greater than zero when provided."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateUpdateIncidentTaskStatusRequest(UpdateIncidentTaskStatusRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    var allowedStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Open",
        "Assigned",
        "InProgress",
        "Blocked",
        "Completed",
        "Cancelled",
    };

    if (string.IsNullOrWhiteSpace(request.StatusCode))
    {
        errors["statusCode"] = ["StatusCode is required."];
    }
    else if (!allowedStatuses.Contains(request.StatusCode.Trim()))
    {
        errors["statusCode"] = ["StatusCode must be one of: Open, Assigned, InProgress, Blocked, Completed, Cancelled."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateCreateIncidentTimelineEventRequest(CreateIncidentTimelineEventRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.EventTypeCode))
    {
        errors["eventTypeCode"] = ["EventTypeCode is required."];
    }
    else if (request.EventTypeCode.Trim().Length > 80)
    {
        errors["eventTypeCode"] = ["EventTypeCode cannot exceed 80 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.EventTitle))
    {
        errors["eventTitle"] = ["EventTitle is required."];
    }
    else if (request.EventTitle.Trim().Length > 240)
    {
        errors["eventTitle"] = ["EventTitle cannot exceed 240 characters."];
    }

    if (!string.IsNullOrWhiteSpace(request.EventDescription) && request.EventDescription.Trim().Length > 4000)
    {
        errors["eventDescription"] = ["EventDescription cannot exceed 4000 characters."];
    }

    if (request.LocationId is <= 0)
    {
        errors["locationId"] = ["LocationId must be greater than zero when provided."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateCreateIncidentCommunicationRequest(CreateIncidentCommunicationRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    var allowedChannels = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Phone",
        "Radio",
        "Email",
        "WebEoc",
        "InPerson",
        "Other",
    };

    var allowedDirections = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Inbound",
        "Outbound",
        "Internal",
    };

    var allowedNotificationPriorities = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Low",
        "Normal",
        "High",
        "Critical",
    };

    var allowedNotificationChannels = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "EMAIL",
        "SMS",
    };

    if (request.NotificationId is not null)
    {
        errors["notificationId"] = ["NotificationId is server-managed and cannot be provided by clients."];
    }

    if (string.IsNullOrWhiteSpace(request.ChannelCode))
    {
        errors["channelCode"] = ["ChannelCode is required."];
    }
    else if (!allowedChannels.Contains(request.ChannelCode.Trim()))
    {
        errors["channelCode"] = ["ChannelCode must be one of: Phone, Radio, Email, WebEoc, InPerson, Other."];
    }

    if (string.IsNullOrWhiteSpace(request.DirectionCode))
    {
        errors["directionCode"] = ["DirectionCode is required."];
    }
    else if (!allowedDirections.Contains(request.DirectionCode.Trim()))
    {
        errors["directionCode"] = ["DirectionCode must be one of: Inbound, Outbound, Internal."];
    }

    if (string.IsNullOrWhiteSpace(request.Subject))
    {
        errors["subject"] = ["Subject is required."];
    }
    else if (request.Subject.Trim().Length > 240)
    {
        errors["subject"] = ["Subject cannot exceed 240 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.Message))
    {
        errors["message"] = ["Message is required."];
    }
    else if (request.Message.Trim().Length > 4000)
    {
        errors["message"] = ["Message cannot exceed 4000 characters."];
    }

    var hasNotificationTypeCode = string.IsNullOrWhiteSpace(request.NotificationTypeCode) is false;
    var hasNotificationPriorityCode = string.IsNullOrWhiteSpace(request.NotificationPriorityCode) is false;
    var hasNotificationRecipients = request.NotificationRecipients is { Count: > 0 };
    var hasNotificationDispatchInputs = hasNotificationTypeCode || hasNotificationPriorityCode || hasNotificationRecipients;

    if (hasNotificationDispatchInputs)
    {
        if (!hasNotificationTypeCode)
        {
            errors["notificationTypeCode"] = ["NotificationTypeCode is required when notification recipients are supplied."];
        }
        else if (request.NotificationTypeCode!.Trim().Length > 80)
        {
            errors["notificationTypeCode"] = ["NotificationTypeCode cannot exceed 80 characters."];
        }

        if (!hasNotificationPriorityCode)
        {
            errors["notificationPriorityCode"] = ["NotificationPriorityCode is required when notification recipients are supplied."];
        }
        else if (!allowedNotificationPriorities.Contains(request.NotificationPriorityCode!.Trim()))
        {
            errors["notificationPriorityCode"] = ["NotificationPriorityCode must be one of: Low, Normal, High, Critical."];
        }

        if (!hasNotificationRecipients)
        {
            errors["notificationRecipients"] = ["At least one notification recipient is required when notification dispatch fields are supplied."];
        }
        else
        {
            for (var index = 0; index < request.NotificationRecipients!.Count; index += 1)
            {
                var recipient = request.NotificationRecipients[index];
                var recipientPath = $"notificationRecipients[{index}]";
                var principalCount = (recipient.UserId is > 0 ? 1 : 0) + (recipient.ContactId is > 0 ? 1 : 0) + (recipient.LocationId is > 0 ? 1 : 0);

                if (principalCount == 0)
                {
                    errors[$"{recipientPath}.principal"] = ["At least one principal identifier (userId, contactId, or locationId) is required."];
                }

                if (string.IsNullOrWhiteSpace(recipient.ChannelCode))
                {
                    errors[$"{recipientPath}.channelCode"] = ["ChannelCode is required."];
                }
                else if (!AlertChannelCodes.Supported.Contains(recipient.ChannelCode.Trim()))
                {
                    errors[$"{recipientPath}.channelCode"] = ["ChannelCode must be one of: EMAIL, SMS, VOICE, PUSH."];
                }

                if (string.IsNullOrWhiteSpace(recipient.DestinationAddress))
                {
                    errors[$"{recipientPath}.destinationAddress"] = ["DestinationAddress is required."];
                }
                else
                {
                    var destinationError = ValidateNotificationDestinationAddress(recipient.ChannelCode.Trim(), recipient.DestinationAddress);
                    if (destinationError is not null)
                    {
                        errors[$"{recipientPath}.destinationAddress"] = [destinationError];
                    }
                }
            }
        }
    }

    return errors.Count == 0 ? null : errors;
}

static string? ValidateNotificationDestinationAddress(string channelCode, string destinationAddress)
{
    var normalizedChannelCode = channelCode.Trim().ToUpperInvariant();
    var normalizedDestination = destinationAddress.Trim();

    if (string.IsNullOrWhiteSpace(normalizedDestination))
    {
        return "DestinationAddress is required.";
    }

    return normalizedChannelCode switch
    {
        "EMAIL" => IsValidEmailDestination(normalizedDestination)
            ? null
            : "DestinationAddress must be a valid email address for EMAIL channel.",
        "SMS" or "VOICE" => IsValidPhoneDestination(normalizedDestination)
            ? null
            : "DestinationAddress must be a valid phone number for SMS/VOICE channel (E.164 or 7-15 digits).",
        "PUSH" => IsValidPushDestination(normalizedDestination)
            ? null
            : "DestinationAddress must be a push token or HTTPS endpoint for PUSH channel.",
        _ => null,
    };
}

static bool IsValidEmailDestination(string value)
{
    try
    {
        var mailAddress = new MailAddress(value);
        return string.Equals(mailAddress.Address, value, StringComparison.OrdinalIgnoreCase);
    }
    catch
    {
        return false;
    }
}

static bool IsValidPhoneDestination(string value)
{
    var sanitized = new string(value.Where(ch => char.IsDigit(ch) || ch == '+').ToArray());
    if (sanitized.Length == 0)
    {
        return false;
    }

    if (sanitized[0] == '+')
    {
        sanitized = sanitized[1..];
    }

    if (sanitized.Length is < 7 or > 15)
    {
        return false;
    }

    return sanitized.All(char.IsDigit);
}

static bool IsValidPushDestination(string value)
{
    if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
    {
        return string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
    }

    return value.Length >= 16 && value.All(ch => !char.IsWhiteSpace(ch));
}

static Dictionary<string, string[]>? ValidateUpdateIncidentCommunicationRequest(UpdateIncidentCommunicationRequestDto request)
{
    var errors = ValidateCreateIncidentCommunicationRequest(new CreateIncidentCommunicationRequestDto(
        request.ChannelCode,
        request.DirectionCode,
        request.Subject,
        request.Message,
        null,
        null,
        null,
        null)) ?? new Dictionary<string, string[]>();

    var allowedStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Active",
        "NeedsFollowUp",
        "Escalated",
        "Archived",
    };

    if (string.IsNullOrWhiteSpace(request.StatusCode))
    {
        errors["statusCode"] = ["StatusCode is required."];
    }
    else if (!allowedStatuses.Contains(request.StatusCode.Trim()))
    {
        errors["statusCode"] = ["StatusCode must be one of: Active, NeedsFollowUp, Escalated, Archived."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateCreateIncidentResourceRequest(CreateIncidentResourceRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    var allowedPriorities = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Low",
        "Normal",
        "High",
        "Critical",
    };

    if (string.IsNullOrWhiteSpace(request.ResourceTypeCode))
    {
        errors["resourceTypeCode"] = ["ResourceTypeCode is required."];
    }
    else if (request.ResourceTypeCode.Trim().Length > 80)
    {
        errors["resourceTypeCode"] = ["ResourceTypeCode cannot exceed 80 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.ResourceTypeName))
    {
        errors["resourceTypeName"] = ["ResourceTypeName is required."];
    }
    else if (request.ResourceTypeName.Trim().Length > 240)
    {
        errors["resourceTypeName"] = ["ResourceTypeName cannot exceed 240 characters."];
    }

    if (request.RequestedQuantity <= 0)
    {
        errors["requestedQuantity"] = ["RequestedQuantity must be greater than zero."];
    }

    if (string.IsNullOrWhiteSpace(request.UnitOfMeasureCode))
    {
        errors["unitOfMeasureCode"] = ["UnitOfMeasureCode is required."];
    }
    else if (request.UnitOfMeasureCode.Trim().Length > 40)
    {
        errors["unitOfMeasureCode"] = ["UnitOfMeasureCode cannot exceed 40 characters."];
    }

    if (string.IsNullOrWhiteSpace(request.PriorityCode))
    {
        errors["priorityCode"] = ["PriorityCode is required."];
    }
    else if (!allowedPriorities.Contains(request.PriorityCode.Trim()))
    {
        errors["priorityCode"] = ["PriorityCode must be one of: Low, Normal, High, Critical."];
    }

    if (!string.IsNullOrWhiteSpace(request.Notes) && request.Notes.Trim().Length > 4000)
    {
        errors["notes"] = ["Notes cannot exceed 4000 characters."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateUpdateIncidentResourceRequest(UpdateIncidentResourceRequestDto request)
{
    var errors = ValidateCreateIncidentResourceRequest(new CreateIncidentResourceRequestDto(
        request.ResourceTypeCode,
        request.ResourceTypeName,
        request.RequestedQuantity,
        request.UnitOfMeasureCode,
        request.PriorityCode,
        request.Notes)) ?? new Dictionary<string, string[]>();

    var allowedStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Requested",
        "Approved",
        "PartiallyFulfilled",
        "Fulfilled",
        "Denied",
        "Cancelled",
        "Archived",
    };

    if (request.AssignedQuantity is < 0)
    {
        errors["assignedQuantity"] = ["AssignedQuantity cannot be negative."];
    }

    if (string.IsNullOrWhiteSpace(request.StatusCode))
    {
        errors["statusCode"] = ["StatusCode is required."];
    }
    else if (!allowedStatuses.Contains(request.StatusCode.Trim()))
    {
        errors["statusCode"] = ["StatusCode must be one of: Requested, Approved, PartiallyFulfilled, Fulfilled, Denied, Cancelled, Archived."];
    }

    var normalizedStatus = request.StatusCode?.Trim();
    var hasAssignedQuantity = request.AssignedQuantity is > 0;

    if (string.Equals(normalizedStatus, "Fulfilled", StringComparison.OrdinalIgnoreCase) && !hasAssignedQuantity)
    {
        errors["assignedQuantity"] = ["AssignedQuantity must be greater than zero when StatusCode is Fulfilled."];
    }

    if (string.Equals(normalizedStatus, "Fulfilled", StringComparison.OrdinalIgnoreCase)
        && request.AssignedQuantity.HasValue
        && request.AssignedQuantity.Value < request.RequestedQuantity)
    {
        errors["assignedQuantity"] = ["AssignedQuantity must equal RequestedQuantity when StatusCode is Fulfilled."];
    }

    if (string.Equals(normalizedStatus, "PartiallyFulfilled", StringComparison.OrdinalIgnoreCase)
        && (!request.AssignedQuantity.HasValue || request.AssignedQuantity.Value <= 0))
    {
        errors["assignedQuantity"] = ["AssignedQuantity must be greater than zero when StatusCode is PartiallyFulfilled."];
    }

    if (string.Equals(normalizedStatus, "PartiallyFulfilled", StringComparison.OrdinalIgnoreCase)
        && request.AssignedQuantity.HasValue
        && request.AssignedQuantity.Value >= request.RequestedQuantity)
    {
        errors["assignedQuantity"] = ["AssignedQuantity must be less than RequestedQuantity when StatusCode is PartiallyFulfilled."];
    }

    if (string.Equals(normalizedStatus, "Requested", StringComparison.OrdinalIgnoreCase) && request.AssignedQuantity is > 0)
    {
        errors["assignedQuantity"] = ["AssignedQuantity must be empty or zero when StatusCode is Requested."];
    }

    if (string.Equals(normalizedStatus, "Denied", StringComparison.OrdinalIgnoreCase) && request.AssignedQuantity is > 0)
    {
        errors["assignedQuantity"] = ["AssignedQuantity must be empty or zero when StatusCode is Denied."];
    }

    if (string.Equals(normalizedStatus, "Cancelled", StringComparison.OrdinalIgnoreCase) && request.AssignedQuantity is > 0)
    {
        errors["assignedQuantity"] = ["AssignedQuantity must be empty or zero when StatusCode is Cancelled."];
    }

    if (string.Equals(normalizedStatus, "Archived", StringComparison.OrdinalIgnoreCase) && request.AssignedQuantity is > 0)
    {
        errors["assignedQuantity"] = ["AssignedQuantity must be empty or zero when StatusCode is Archived."];
    }

    if (request.AssignedQuantity.HasValue && request.AssignedQuantity.Value > request.RequestedQuantity)
    {
        errors["assignedQuantity"] = ["AssignedQuantity cannot exceed RequestedQuantity."];
    }

    return errors.Count == 0 ? null : errors;
}

static bool IsResourceStatusTransitionAllowed(string currentStatusCode, string targetStatusCode)
{
    var current = currentStatusCode.Trim();
    var target = targetStatusCode.Trim();
    var normalizedTarget = target.ToUpperInvariant();

    if (string.Equals(current, target, StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    return current.ToUpperInvariant() switch
    {
        "REQUESTED" => normalizedTarget is "APPROVED" or "DENIED" or "CANCELLED" or "ARCHIVED",
        "APPROVED" => normalizedTarget is "PARTIALLYFULFILLED" or "FULFILLED" or "DENIED" or "CANCELLED" or "ARCHIVED",
        "PARTIALLYFULFILLED" => normalizedTarget is "FULFILLED" or "CANCELLED" or "ARCHIVED",
        "FULFILLED" => normalizedTarget is "ARCHIVED",
        "DENIED" => normalizedTarget is "ARCHIVED",
        "CANCELLED" => normalizedTarget is "ARCHIVED",
        "ARCHIVED" => normalizedTarget is "REQUESTED",
        _ => false,
    };
}

static Dictionary<string, string[]>? ValidateCreateIncidentOperationalPeriodRequest(CreateIncidentOperationalPeriodRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (request.PeriodNumber <= 0)
    {
        errors["periodNumber"] = ["PeriodNumber must be greater than zero."];
    }

    if (!string.IsNullOrWhiteSpace(request.PeriodName) && request.PeriodName.Trim().Length > 200)
    {
        errors["periodName"] = ["PeriodName cannot exceed 200 characters."];
    }

    if (request.EndUtc <= request.StartUtc)
    {
        errors["endUtc"] = ["EndUtc must be greater than StartUtc."];
    }

    var allowedStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Planned",
        "Active",
    };

    if (string.IsNullOrWhiteSpace(request.StatusCode))
    {
        errors["statusCode"] = ["StatusCode is required."];
    }
    else if (!allowedStatuses.Contains(request.StatusCode.Trim()))
    {
        errors["statusCode"] = ["StatusCode must be one of: Planned, Active."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateCreateIncidentObjectiveRequest(CreateIncidentObjectiveRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (request.OperationalPeriodId is <= 0)
    {
        errors["operationalPeriodId"] = ["OperationalPeriodId must be greater than zero when provided."];
    }

    if (request.ObjectiveNumber <= 0)
    {
        errors["objectiveNumber"] = ["ObjectiveNumber must be greater than zero."];
    }

    if (string.IsNullOrWhiteSpace(request.ObjectiveText))
    {
        errors["objectiveText"] = ["ObjectiveText is required."];
    }
    else if (request.ObjectiveText.Trim().Length > 4000)
    {
        errors["objectiveText"] = ["ObjectiveText cannot exceed 4000 characters."];
    }

    var allowedPriorities = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Low",
        "Normal",
        "High",
        "Critical",
    };

    if (string.IsNullOrWhiteSpace(request.PriorityCode))
    {
        errors["priorityCode"] = ["PriorityCode is required."];
    }
    else if (!allowedPriorities.Contains(request.PriorityCode.Trim()))
    {
        errors["priorityCode"] = ["PriorityCode must be one of: Low, Normal, High, Critical."];
    }

    var allowedStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Open",
        "InProgress",
        "Completed",
        "Cancelled",
    };

    if (string.IsNullOrWhiteSpace(request.StatusCode))
    {
        errors["statusCode"] = ["StatusCode is required."];
    }
    else if (!allowedStatuses.Contains(request.StatusCode.Trim()))
    {
        errors["statusCode"] = ["StatusCode must be one of: Open, InProgress, Completed, Cancelled."];
    }

    if (request.OwnerUserId is <= 0)
    {
        errors["ownerUserId"] = ["OwnerUserId must be greater than zero when provided."];
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateResourceInventoryRequest(UpdateResourceInventoryRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    var noFieldsProvided = request.QuantityTotal is null
        && request.QuantityAvailable is null
        && request.QuantityCommitted is null
        && request.QuantityOutOfService is null;

    if (noFieldsProvided)
    {
        errors["request"] = ["At least one quantity field must be provided."];
    }

    if (request.QuantityTotal is < 0)
    {
        errors["quantityTotal"] = ["QuantityTotal cannot be negative."];
    }

    if (request.QuantityAvailable is < 0)
    {
        errors["quantityAvailable"] = ["QuantityAvailable cannot be negative."];
    }

    if (request.QuantityCommitted is < 0)
    {
        errors["quantityCommitted"] = ["QuantityCommitted cannot be negative."];
    }

    if (request.QuantityOutOfService is < 0)
    {
        errors["quantityOutOfService"] = ["QuantityOutOfService cannot be negative."];
    }

    if (HasMoreThanFourDecimalPlaces(request.QuantityTotal))
    {
        errors["quantityTotal"] = ["QuantityTotal supports up to 4 decimal places."];
    }

    if (HasMoreThanFourDecimalPlaces(request.QuantityAvailable))
    {
        errors["quantityAvailable"] = ["QuantityAvailable supports up to 4 decimal places."];
    }

    if (HasMoreThanFourDecimalPlaces(request.QuantityCommitted))
    {
        errors["quantityCommitted"] = ["QuantityCommitted supports up to 4 decimal places."];
    }

    if (HasMoreThanFourDecimalPlaces(request.QuantityOutOfService))
    {
        errors["quantityOutOfService"] = ["QuantityOutOfService supports up to 4 decimal places."];
    }

    if (request.QuantityTotal is { } quantityTotal)
    {
        if (request.QuantityAvailable is { } quantityAvailable && quantityAvailable > quantityTotal)
        {
            errors["quantityAvailable"] = ["QuantityAvailable cannot exceed QuantityTotal."];
        }

        if (request.QuantityCommitted is { } quantityCommitted && quantityCommitted > quantityTotal)
        {
            errors["quantityCommitted"] = ["QuantityCommitted cannot exceed QuantityTotal."];
        }

        if (request.QuantityOutOfService is { } quantityOutOfService && quantityOutOfService > quantityTotal)
        {
            errors["quantityOutOfService"] = ["QuantityOutOfService cannot exceed QuantityTotal."];
        }

        if (request.QuantityAvailable is { } available
            && request.QuantityCommitted is { } committed
            && request.QuantityOutOfService is { } outOfService
            && available + committed + outOfService > quantityTotal)
        {
            errors["request"] = ["The sum of available, committed, and out-of-service quantities cannot exceed QuantityTotal."];
        }
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateBedAvailabilityRequest(UpdateBedAvailabilityRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    var noFieldsProvided = request.StaffedBedsTotal is null
        && request.BedsAvailable is null
        && request.BedsOccupied is null
        && request.BedsUnavailable is null
        && request.IsolationCapableBeds is null
        && request.SurgeBedsPotential is null;

    if (noFieldsProvided)
    {
        errors["request"] = ["At least one bed availability field must be provided."];
    }

    if (request.StaffedBedsTotal is < 0)
    {
        errors["staffedBedsTotal"] = ["StaffedBedsTotal cannot be negative."];
    }

    if (request.BedsAvailable is < 0)
    {
        errors["bedsAvailable"] = ["BedsAvailable cannot be negative."];
    }

    if (request.BedsOccupied is < 0)
    {
        errors["bedsOccupied"] = ["BedsOccupied cannot be negative."];
    }

    if (request.BedsUnavailable is < 0)
    {
        errors["bedsUnavailable"] = ["BedsUnavailable cannot be negative."];
    }

    if (request.IsolationCapableBeds is < 0)
    {
        errors["isolationCapableBeds"] = ["IsolationCapableBeds cannot be negative."];
    }

    if (request.SurgeBedsPotential is < 0)
    {
        errors["surgeBedsPotential"] = ["SurgeBedsPotential cannot be negative."];
    }

    if (request.StaffedBedsTotal is { } staffedBedsTotal)
    {
        if (request.BedsAvailable is { } bedsAvailable && bedsAvailable > staffedBedsTotal)
        {
            errors["bedsAvailable"] = ["BedsAvailable cannot exceed StaffedBedsTotal."];
        }

        if (request.BedsOccupied is { } bedsOccupied && bedsOccupied > staffedBedsTotal)
        {
            errors["bedsOccupied"] = ["BedsOccupied cannot exceed StaffedBedsTotal."];
        }

        if (request.BedsUnavailable is { } bedsUnavailable && bedsUnavailable > staffedBedsTotal)
        {
            errors["bedsUnavailable"] = ["BedsUnavailable cannot exceed StaffedBedsTotal."];
        }

        if (request.BedsAvailable is { } available
            && request.BedsOccupied is { } occupied
            && request.BedsUnavailable is { } unavailable
            && available + occupied + unavailable > staffedBedsTotal)
        {
            errors["request"] = ["The sum of available, occupied, and unavailable beds cannot exceed StaffedBedsTotal."];
        }
    }

    return errors.Count == 0 ? null : errors;
}

static Dictionary<string, string[]>? ValidateUpsertCommandAssignmentRequest(UpsertIncidentCommandAssignmentRequestDto request)
{
    var errors = new Dictionary<string, string[]>();

    if (request.IcsPositionId <= 0)
    {
        errors["icsPositionId"] = ["IcsPositionId must be greater than zero."];
    }

    if (request.AssignedUserId is null && request.AssignedContactId is null)
    {
        errors["request"] = ["Either AssignedUserId or AssignedContactId must be provided."];
    }

    if (request.AssignedUserId is not null && request.AssignedUserId <= 0)
    {
        errors["assignedUserId"] = ["AssignedUserId must be greater than zero when provided."];
    }

    if (request.AssignedContactId is not null && request.AssignedContactId <= 0)
    {
        errors["assignedContactId"] = ["AssignedContactId must be greater than zero when provided."];
    }

    if (request.AgencyOrganizationId is not null && request.AgencyOrganizationId <= 0)
    {
        errors["agencyOrganizationId"] = ["AgencyOrganizationId must be greater than zero when provided."];
    }

    if (!string.IsNullOrWhiteSpace(request.Notes) && request.Notes.Trim().Length > 1000)
    {
        errors["notes"] = ["Notes cannot exceed 1000 characters."];
    }

    return errors.Count == 0 ? null : errors;
}

static bool HasMoreThanFourDecimalPlaces(decimal? value)
{
    if (!value.HasValue)
    {
        return false;
    }

    return decimal.Round(value.Value, 4) != value.Value;
}

static IReadOnlyList<string> ParseCsvLine(string line)
{
    var values = new List<string>();
    var current = new StringBuilder();
    var inQuotes = false;

    for (var i = 0; i < line.Length; i++)
    {
        var ch = line[i];

        if (ch == '"')
        {
            if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
            {
                current.Append('"');
                i++;
                continue;
            }

            inQuotes = !inQuotes;
            continue;
        }

        if (ch == ',' && !inQuotes)
        {
            values.Add(current.ToString());
            current.Clear();
            continue;
        }

        current.Append(ch);
    }

    values.Add(current.ToString());
    return values;
}

static Dictionary<string, int> BuildCsvHeaderMap(string headerLine)
{
    var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    var headerColumns = ParseCsvLine(headerLine);

    for (var index = 0; index < headerColumns.Count; index++)
    {
        var normalized = headerColumns[index].Trim();
        if (string.IsNullOrWhiteSpace(normalized) || headerMap.ContainsKey(normalized))
        {
            continue;
        }

        headerMap[normalized] = index;
    }

    return headerMap;
}

static string[] ValidateRequiredColumns(IReadOnlyDictionary<string, int> headerMap, IEnumerable<string> requiredColumns)
{
    return requiredColumns
        .Where(column => !headerMap.ContainsKey(column))
        .ToArray();
}

static async Task<long?> ResolveEffectiveUserIdAsync(ClaimsPrincipal user, IUserQueryService userQueryService)
{
    static long? TryParsePositiveLong(string? value)
    {
        return long.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) && parsed > 0
            ? parsed
            : null;
    }

    string[] candidateClaimTypes =
    [
        "user_id",
        "app_user_id",
        ClaimTypes.NameIdentifier,
        "nameidentifier"
    ];

    foreach (var claimType in candidateClaimTypes)
    {
        var parsedUserId = TryParsePositiveLong(user.FindFirst(claimType)?.Value);
        if (parsedUserId is not null)
        {
            return parsedUserId.Value;
        }
    }

    var activeUsers = await userQueryService.GetActiveUsersAsync();
    return activeUsers
        .Select(activeUser => (long?)activeUser.UserId)
        .FirstOrDefault();
}

static string? GetCsvValue(IReadOnlyList<string> values, IReadOnlyDictionary<string, int> headerMap, string columnName)
{
    if (!headerMap.TryGetValue(columnName, out var index) || index < 0 || index >= values.Count)
    {
        return null;
    }

    return values[index].Trim();
}

static bool TryParseRequiredLong(IReadOnlyList<string> values, IReadOnlyDictionary<string, int> headerMap, string columnName, out long parsed)
{
    parsed = default;
    var value = GetCsvValue(values, headerMap, columnName);
    return !string.IsNullOrWhiteSpace(value)
        && long.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out parsed);
}

static bool TryParseRequiredDecimal(IReadOnlyList<string> values, IReadOnlyDictionary<string, int> headerMap, string columnName, out decimal parsed)
{
    parsed = default;
    var value = GetCsvValue(values, headerMap, columnName);
    return !string.IsNullOrWhiteSpace(value)
        && decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out parsed);
}

static int? ParseNullableInt(IReadOnlyList<string> values, IReadOnlyDictionary<string, int> headerMap, string columnName)
{
    var value = GetCsvValue(values, headerMap, columnName);
    if (string.IsNullOrWhiteSpace(value))
    {
        return null;
    }

    return int.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed)
        ? parsed
        : null;
}

static DateTimeOffset? ParseNullableDateTimeOffset(IReadOnlyList<string> values, IReadOnlyDictionary<string, int> headerMap, string columnName)
{
    var value = GetCsvValue(values, headerMap, columnName);
    if (string.IsNullOrWhiteSpace(value))
    {
        return null;
    }

    return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed)
        ? parsed
        : null;
}

static async Task<(List<ResourceInventoryImportRowDto> Rows, List<ImportRejectDto> Rejects)> ParseResourceInventoryCsvAsync(Stream csvStream, string sourceSystemCode, string? sourceMessageId, CancellationToken cancellationToken)
{
    string[] requiredColumns =
    [
        "LocationId",
        "ResourceTypeCode",
        "QuantityTotal",
        "QuantityAvailable",
        "QuantityCommitted",
        "QuantityOutOfService",
        "ReportedUtc"
    ];

    var rows = new List<ResourceInventoryImportRowDto>();
    var rejects = new List<ImportRejectDto>();

    using var reader = new StreamReader(csvStream);
    var headerLine = await reader.ReadLineAsync(cancellationToken);
    if (string.IsNullOrWhiteSpace(headerLine))
    {
        rejects.Add(new ImportRejectDto(1, "RESOURCE_STATUS", sourceSystemCode, sourceMessageId, "CSV header is required.", string.Empty));
        return (rows, rejects);
    }

    var headerMap = BuildCsvHeaderMap(headerLine);
    var missingColumns = ValidateRequiredColumns(headerMap, requiredColumns);
    if (missingColumns.Length > 0)
    {
        rejects.Add(new ImportRejectDto(1, "RESOURCE_STATUS", sourceSystemCode, sourceMessageId, $"Missing required columns: {string.Join(", ", missingColumns)}", headerLine));
        return (rows, rejects);
    }

    var rowNumber = 1;
    while (true)
    {
        var line = await reader.ReadLineAsync(cancellationToken);
        if (line is null)
        {
            break;
        }

        rowNumber++;
        if (string.IsNullOrWhiteSpace(line))
        {
            continue;
        }

        var values = ParseCsvLine(line);

        if (!TryParseRequiredLong(values, headerMap, "LocationId", out var locationId))
        {
            rejects.Add(new ImportRejectDto(rowNumber, "RESOURCE_STATUS", sourceSystemCode, sourceMessageId, "LocationId is required and must be a valid integer.", line));
            continue;
        }

        var resourceTypeCode = GetCsvValue(values, headerMap, "ResourceTypeCode");
        if (string.IsNullOrWhiteSpace(resourceTypeCode))
        {
            rejects.Add(new ImportRejectDto(rowNumber, "RESOURCE_STATUS", sourceSystemCode, sourceMessageId, "ResourceTypeCode is required.", line));
            continue;
        }

        if (!TryParseRequiredDecimal(values, headerMap, "QuantityTotal", out var quantityTotal)
            || !TryParseRequiredDecimal(values, headerMap, "QuantityAvailable", out var quantityAvailable)
            || !TryParseRequiredDecimal(values, headerMap, "QuantityCommitted", out var quantityCommitted)
            || !TryParseRequiredDecimal(values, headerMap, "QuantityOutOfService", out var quantityOutOfService))
        {
            rejects.Add(new ImportRejectDto(rowNumber, "RESOURCE_STATUS", sourceSystemCode, sourceMessageId, "Quantity columns are required and must be valid decimal values.", line));
            continue;
        }

        rows.Add(new ResourceInventoryImportRowDto(
            locationId,
            resourceTypeCode,
            quantityTotal,
            quantityAvailable,
            quantityCommitted,
            quantityOutOfService,
            ParseNullableDateTimeOffset(values, headerMap, "ReportedUtc")));
    }

    return (rows, rejects);
}

static async Task<(List<BedAvailabilityImportRowDto> Rows, List<ImportRejectDto> Rejects)> ParseBedAvailabilityCsvAsync(Stream csvStream, string sourceSystemCode, string? sourceMessageId, CancellationToken cancellationToken)
{
    string[] requiredColumns =
    [
        "LocationId",
        "BedCategoryCode",
        "StaffedBedsTotal",
        "BedsAvailable",
        "BedsOccupied",
        "BedsUnavailable",
        "IsolationCapableBeds",
        "SurgeBedsPotential",
        "ReportedUtc"
    ];

    var rows = new List<BedAvailabilityImportRowDto>();
    var rejects = new List<ImportRejectDto>();

    using var reader = new StreamReader(csvStream);
    var headerLine = await reader.ReadLineAsync(cancellationToken);
    if (string.IsNullOrWhiteSpace(headerLine))
    {
        rejects.Add(new ImportRejectDto(1, "BED_AVAILABILITY", sourceSystemCode, sourceMessageId, "CSV header is required.", string.Empty));
        return (rows, rejects);
    }

    var headerMap = BuildCsvHeaderMap(headerLine);
    var missingColumns = ValidateRequiredColumns(headerMap, requiredColumns);
    if (missingColumns.Length > 0)
    {
        rejects.Add(new ImportRejectDto(1, "BED_AVAILABILITY", sourceSystemCode, sourceMessageId, $"Missing required columns: {string.Join(", ", missingColumns)}", headerLine));
        return (rows, rejects);
    }

    var rowNumber = 1;
    while (true)
    {
        var line = await reader.ReadLineAsync(cancellationToken);
        if (line is null)
        {
            break;
        }

        rowNumber++;
        if (string.IsNullOrWhiteSpace(line))
        {
            continue;
        }

        var values = ParseCsvLine(line);
        if (!TryParseRequiredLong(values, headerMap, "LocationId", out var locationId))
        {
            rejects.Add(new ImportRejectDto(rowNumber, "BED_AVAILABILITY", sourceSystemCode, sourceMessageId, "LocationId is required and must be a valid integer.", line));
            continue;
        }

        var bedCategoryCode = GetCsvValue(values, headerMap, "BedCategoryCode");
        if (string.IsNullOrWhiteSpace(bedCategoryCode))
        {
            rejects.Add(new ImportRejectDto(rowNumber, "BED_AVAILABILITY", sourceSystemCode, sourceMessageId, "BedCategoryCode is required.", line));
            continue;
        }

        rows.Add(new BedAvailabilityImportRowDto(
            locationId,
            bedCategoryCode,
            ParseNullableInt(values, headerMap, "StaffedBedsTotal"),
            ParseNullableInt(values, headerMap, "BedsAvailable"),
            ParseNullableInt(values, headerMap, "BedsOccupied"),
            ParseNullableInt(values, headerMap, "BedsUnavailable"),
            ParseNullableInt(values, headerMap, "IsolationCapableBeds"),
            ParseNullableInt(values, headerMap, "SurgeBedsPotential"),
            ParseNullableDateTimeOffset(values, headerMap, "ReportedUtc")));
    }

    return (rows, rejects);
}

static string BuildRejectReportCsv(IEnumerable<ImportRejectDto> rejects)
{
    var lines = new List<string>
    {
        "RowNumber,InterfaceType,SourceSystemCode,SourceMessageId,Outcome,Reason,RawData"
    };

    foreach (var reject in rejects)
    {
        var safeReason = RedactSensitiveData(reject.Reason).Replace("\"", "\"\"");
        var safeRawData = RedactSensitiveData(reject.RawData).Replace("\"", "\"\"");
        var safeSourceMessageId = RedactSensitiveData(reject.SourceMessageId ?? string.Empty).Replace("\"", "\"\"");
        lines.Add($"{reject.RowNumber},\"{reject.InterfaceTypeCode}\",\"{reject.SourceSystemCode}\",\"{safeSourceMessageId}\",\"Rejected\",\"{safeReason}\",\"{safeRawData}\"");
    }

    return string.Join('\n', lines);
}

static async Task<(List<(int RowNumber, string DisplayName, string? EmailAddress, string? UserPrincipalName, Guid? EntraObjectId, bool IsActive, IReadOnlyList<string> RoleCodes, string RawData)> Rows, List<ImportRejectDto> Rejects)> ParseAdminUsersCsvAsync(Stream csvStream, string sourceSystemCode, string? sourceMessageId, CancellationToken cancellationToken)
{
    string[] requiredColumns =
    [
        "DisplayName"
    ];

    var rows = new List<(int RowNumber, string DisplayName, string? EmailAddress, string? UserPrincipalName, Guid? EntraObjectId, bool IsActive, IReadOnlyList<string> RoleCodes, string RawData)>();
    var rejects = new List<ImportRejectDto>();

    using var reader = new StreamReader(csvStream);
    var headerLine = await reader.ReadLineAsync(cancellationToken);
    if (string.IsNullOrWhiteSpace(headerLine))
    {
        rejects.Add(new ImportRejectDto(1, "ADMIN_USER", sourceSystemCode, sourceMessageId, "CSV header is required.", string.Empty));
        return (rows, rejects);
    }

    var headerMap = BuildCsvHeaderMap(headerLine);
    var missingColumns = ValidateRequiredColumns(headerMap, requiredColumns);
    if (missingColumns.Length > 0)
    {
        rejects.Add(new ImportRejectDto(1, "ADMIN_USER", sourceSystemCode, sourceMessageId, $"Missing required columns: {string.Join(", ", missingColumns)}", headerLine));
        return (rows, rejects);
    }

    var rowNumber = 1;
    while (true)
    {
        var line = await reader.ReadLineAsync(cancellationToken);
        if (line is null)
        {
            break;
        }

        rowNumber++;
        if (string.IsNullOrWhiteSpace(line))
        {
            continue;
        }

        var values = ParseCsvLine(line);

        var displayName = GetCsvValue(values, headerMap, "DisplayName");
        if (string.IsNullOrWhiteSpace(displayName))
        {
            rejects.Add(new ImportRejectDto(rowNumber, "ADMIN_USER", sourceSystemCode, sourceMessageId, "DisplayName is required.", line));
            continue;
        }

        if (displayName.Length > 200)
        {
            rejects.Add(new ImportRejectDto(rowNumber, "ADMIN_USER", sourceSystemCode, sourceMessageId, "DisplayName must be 200 characters or fewer.", line));
            continue;
        }

        var emailAddress = GetCsvValue(values, headerMap, "EmailAddress");
        if (!string.IsNullOrWhiteSpace(emailAddress) && emailAddress.Length > 320)
        {
            rejects.Add(new ImportRejectDto(rowNumber, "ADMIN_USER", sourceSystemCode, sourceMessageId, "EmailAddress must be 320 characters or fewer.", line));
            continue;
        }

        var userPrincipalName = GetCsvValue(values, headerMap, "UserPrincipalName");
        if (!string.IsNullOrWhiteSpace(userPrincipalName) && userPrincipalName.Length > 320)
        {
            rejects.Add(new ImportRejectDto(rowNumber, "ADMIN_USER", sourceSystemCode, sourceMessageId, "UserPrincipalName must be 320 characters or fewer.", line));
            continue;
        }

        var entraObjectIdRaw = GetCsvValue(values, headerMap, "EntraObjectId");
        Guid? entraObjectId = null;
        if (!string.IsNullOrWhiteSpace(entraObjectIdRaw))
        {
            if (!Guid.TryParse(entraObjectIdRaw, out var parsedEntraObjectId))
            {
                rejects.Add(new ImportRejectDto(rowNumber, "ADMIN_USER", sourceSystemCode, sourceMessageId, "EntraObjectId must be a valid GUID.", line));
                continue;
            }

            entraObjectId = parsedEntraObjectId;
        }

        var isActiveRaw = GetCsvValue(values, headerMap, "IsActive");
        var isActive = true;
        if (!string.IsNullOrWhiteSpace(isActiveRaw))
        {
            if (isActiveRaw.Equals("true", StringComparison.OrdinalIgnoreCase)
                || isActiveRaw.Equals("1", StringComparison.OrdinalIgnoreCase)
                || isActiveRaw.Equals("yes", StringComparison.OrdinalIgnoreCase))
            {
                isActive = true;
            }
            else if (isActiveRaw.Equals("false", StringComparison.OrdinalIgnoreCase)
                || isActiveRaw.Equals("0", StringComparison.OrdinalIgnoreCase)
                || isActiveRaw.Equals("no", StringComparison.OrdinalIgnoreCase))
            {
                isActive = false;
            }
            else
            {
                rejects.Add(new ImportRejectDto(rowNumber, "ADMIN_USER", sourceSystemCode, sourceMessageId, "IsActive must be true/false, 1/0, or yes/no.", line));
                continue;
            }
        }

        var roleCodesRaw = GetCsvValue(values, headerMap, "RoleCodes");
        var roleCodes = string.IsNullOrWhiteSpace(roleCodesRaw)
            ? Array.Empty<string>()
            : roleCodesRaw
                .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

        rows.Add((
            rowNumber,
            displayName.Trim(),
            string.IsNullOrWhiteSpace(emailAddress) ? null : emailAddress.Trim(),
            string.IsNullOrWhiteSpace(userPrincipalName) ? null : userPrincipalName.Trim(),
            entraObjectId,
            isActive,
            roleCodes,
            line));
    }

    return (rows, rejects);
}

static async Task<(string ContextBlock, List<string> Sources, List<AgentCitationDto> Citations)> QueryAzureAiSearchAsync(HttpClient client, AzureAiSearchOptions searchOptions, string prompt, AzureServiceAuthMode authMode, CancellationToken cancellationToken)
{
    static string? GetStringByCandidateNames(JsonElement item, params string[] candidateNames)
    {
        foreach (var name in candidateNames)
        {
            if (item.TryGetProperty(name, out var property)
                && property.ValueKind == JsonValueKind.String)
            {
                var value = property.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }
        }

        return null;
    }

    static string? GetFallbackChunk(JsonElement item)
    {
        static bool IsMetadataField(string fieldName)
        {
            return fieldName.StartsWith("@search.", StringComparison.OrdinalIgnoreCase)
                || fieldName.Contains("url", StringComparison.OrdinalIgnoreCase)
                || fieldName.Contains("source", StringComparison.OrdinalIgnoreCase)
                || fieldName.Contains("id", StringComparison.OrdinalIgnoreCase)
                || fieldName.Contains("key", StringComparison.OrdinalIgnoreCase)
                || fieldName.Contains("path", StringComparison.OrdinalIgnoreCase)
                || fieldName.Contains("name", StringComparison.OrdinalIgnoreCase);
        }

        static string? FlattenValue(JsonElement value)
        {
            if (value.ValueKind == JsonValueKind.String)
            {
                var text = value.GetString()?.Trim();
                return string.IsNullOrWhiteSpace(text)
                    ? null
                    : text;
            }

            if (value.ValueKind == JsonValueKind.Number
                || value.ValueKind == JsonValueKind.True
                || value.ValueKind == JsonValueKind.False)
            {
                return value.ToString();
            }

            if (value.ValueKind == JsonValueKind.Array)
            {
                var list = value.EnumerateArray()
                    .Select(FlattenValue)
                    .Where(static text => !string.IsNullOrWhiteSpace(text))
                    .Take(3)
                    .ToArray();

                return list.Length == 0 ? null : string.Join(", ", list);
            }

            return null;
        }

        var prioritizedFieldNames = new[]
        {
            "status",
            "state",
            "priority",
            "severity",
            "title",
            "description",
            "summary",
            "content",
            "text"
        };

        var prioritizedParts = new List<string>();
        foreach (var fieldName in prioritizedFieldNames)
        {
            if (!item.TryGetProperty(fieldName, out var candidate))
            {
                continue;
            }

            var valueText = FlattenValue(candidate);
            if (!string.IsNullOrWhiteSpace(valueText))
            {
                prioritizedParts.Add($"{fieldName}: {valueText}");
            }
        }

        if (prioritizedParts.Count > 0)
        {
            return string.Join(" | ", prioritizedParts)
                .Trim();
        }

        var parts = new List<string>();
        foreach (var property in item.EnumerateObject())
        {
            if (IsMetadataField(property.Name))
            {
                continue;
            }

            var valueText = FlattenValue(property.Value);
            if (string.IsNullOrWhiteSpace(valueText))
            {
                continue;
            }

            parts.Add($"{property.Name}: {valueText}");
            if (parts.Count >= 8)
            {
                break;
            }
        }

        return parts.Count == 0 ? null : string.Join(" | ", parts);
    }

    var endpoint = searchOptions.Endpoint.TrimEnd('/');
    var searchUrl = $"{endpoint}/indexes/{Uri.EscapeDataString(searchOptions.IndexName)}/docs/search?api-version=2024-07-01";

    using var request = new HttpRequestMessage(HttpMethod.Post, searchUrl);
    await ApplyAzureSearchAuthAsync(request, searchOptions, authMode, cancellationToken);

    using var response = await SendSearchRequestAsync(
        client,
        request,
        prompt,
        searchOptions.QueryType,
        searchOptions.SemanticConfiguration,
        cancellationToken);

    await using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
    using var document = await JsonDocument.ParseAsync(responseStream, cancellationToken: cancellationToken);

    var contextChunks = new List<string>();
    var sources = new List<string>();
    var citations = new List<AgentCitationDto>();
    var seenChunks = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var seenSources = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    static void MergeSearchResults(
        JsonElement root,
        HashSet<string> seenChunks,
        HashSet<string> seenSources,
        List<string> contextChunks,
        List<string> sources,
        List<AgentCitationDto> citations)
    {
        if (!root.TryGetProperty("value", out var results) || results.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        foreach (var item in results.EnumerateArray())
        {
            var chunk = GetStringByCandidateNames(item,
                "content",
                "chunk",
                "text",
                "body",
                "summary",
                "description",
                "caption",
                "merged_content",
                "metadata_storage_content")
                ?? GetFallbackChunk(item);

            if (!string.IsNullOrWhiteSpace(chunk))
            {
                var normalizedChunk = chunk.Trim();
                if (seenChunks.Add(normalizedChunk))
                {
                    contextChunks.Add(normalizedChunk);
                }
            }

            decimal? score = null;
            if (item.TryGetProperty("@search.score", out var scoreElement)
                && scoreElement.ValueKind == JsonValueKind.Number
                && scoreElement.TryGetDecimal(out var parsedScore))
            {
                score = parsedScore;
            }

            var id = GetStringByCandidateNames(item,
                "id",
                "key",
                "documentId",
                "document_id",
                "metadata_storage_path",
                "metadata_storage_name");

            var title = GetStringByCandidateNames(item,
                "title",
                "name",
                "fileName",
                "filename",
                "metadata_storage_name",
                "documentTitle",
                "document_title");

            var url = GetStringByCandidateNames(item,
                "url",
                "sourceUrl",
                "source_url",
                "metadata_storage_path",
                "documentUrl",
                "document_url");

            var source = GetStringByCandidateNames(item,
                "source",
                "sourceId",
                "source_id",
                "metadata_storage_path",
                "SearchKey")
                ?? id;

            if (!string.IsNullOrWhiteSpace(source))
            {
                var sourceId = source.StartsWith("search-doc:", StringComparison.OrdinalIgnoreCase)
                    ? source
                    : $"search-doc:{source}";

                if (seenSources.Add(sourceId))
                {
                    sources.Add(sourceId);
                    citations.Add(new AgentCitationDto(
                        title ?? sourceId,
                        sourceId,
                        id,
                        score,
                        string.IsNullOrWhiteSpace(url) ? null : url));
                }
            }
        }
    }

    MergeSearchResults(document.RootElement, seenChunks, seenSources, contextChunks, sources, citations);

    var hasPrioritySignal = contextChunks.Any(chunk =>
        chunk.Contains("priority", StringComparison.OrdinalIgnoreCase));

    if (!hasPrioritySignal)
    {
        using var supplementalRequest = new HttpRequestMessage(HttpMethod.Post, searchUrl);
        await ApplyAzureSearchAuthAsync(supplementalRequest, searchOptions, authMode, cancellationToken);

        using var supplementalResponse = await SendSearchRequestAsync(
            client,
            supplementalRequest,
            $"{prompt} priority status objective task resource request",
            searchOptions.QueryType,
            searchOptions.SemanticConfiguration,
            cancellationToken);

        await using var supplementalResponseStream = await supplementalResponse.Content.ReadAsStreamAsync(cancellationToken);
        using var supplementalDocument = await JsonDocument.ParseAsync(supplementalResponseStream, cancellationToken: cancellationToken);
        MergeSearchResults(supplementalDocument.RootElement, seenChunks, seenSources, contextChunks, sources, citations);
    }

    if (sources.Count == 0)
    {
        sources.Add("Azure AI Search result set");
    }

    return (
        string.Join("\n\n", contextChunks),
        sources.Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
        citations);
}

static async Task<HttpResponseMessage> SendSearchRequestAsync(
    HttpClient client,
    HttpRequestMessage request,
    string prompt,
    string configuredQueryType,
    string configuredSemanticConfiguration,
    CancellationToken cancellationToken)
{
    static string BuildBody(string promptText, string queryType, string semanticConfiguration)
    {
        var includeSemantic = string.Equals(queryType, "semantic", StringComparison.OrdinalIgnoreCase)
            || string.Equals(queryType, "semanticHybrid", StringComparison.OrdinalIgnoreCase)
            || string.Equals(queryType, "vectorSemanticHybrid", StringComparison.OrdinalIgnoreCase);

        return JsonSerializer.Serialize(new
        {
            search = promptText,
            queryType,
            top = 5,
            semanticConfiguration = includeSemantic && !string.IsNullOrWhiteSpace(semanticConfiguration)
                ? semanticConfiguration
                : null,
        });
    }

    request.Content = new StringContent(
        BuildBody(prompt, configuredQueryType, configuredSemanticConfiguration),
        Encoding.UTF8,
        "application/json");

    var response = await client.SendAsync(request, cancellationToken);
    if (response.IsSuccessStatusCode)
    {
        return response;
    }

    var shouldRetryWithSimpleQuery = response.StatusCode == System.Net.HttpStatusCode.BadRequest;
    if (!shouldRetryWithSimpleQuery)
    {
        response.EnsureSuccessStatusCode();
        return response;
    }

    response.Dispose();

    request.Content = new StringContent(
        BuildBody(prompt, "simple", string.Empty),
        Encoding.UTF8,
        "application/json");

    var fallbackResponse = await client.SendAsync(request, cancellationToken);
    fallbackResponse.EnsureSuccessStatusCode();
    return fallbackResponse;
}

static async Task ProbeAzureSearchConnectivityAsync(HttpClient client, AzureAiSearchOptions searchOptions, AzureServiceAuthMode authMode, CancellationToken cancellationToken)
{
    var endpoint = searchOptions.Endpoint.TrimEnd('/');
    var searchUrl = $"{endpoint}/indexes/{Uri.EscapeDataString(searchOptions.IndexName)}/docs/search?api-version=2024-07-01";

    using var request = new HttpRequestMessage(HttpMethod.Post, searchUrl);
    await ApplyAzureSearchAuthAsync(request, searchOptions, authMode, cancellationToken);

    using var response = await SendSearchRequestAsync(
        client,
        request,
        "health check",
        searchOptions.QueryType,
        searchOptions.SemanticConfiguration,
        cancellationToken);

    response.EnsureSuccessStatusCode();
}

static async Task<string> ProbeAzureOpenAiConnectivityAsync(HttpClient client, AzureOpenAiOptions openAiOptions, AzureServiceAuthMode authMode, CancellationToken cancellationToken)
{
    var endpoint = openAiOptions.Endpoint.TrimEnd('/');
    var deploymentCandidates = new[]
    {
        openAiOptions.Deployment,
        openAiOptions.Model,
    }
    .Where(candidate => !string.IsNullOrWhiteSpace(candidate))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

    var body = JsonSerializer.Serialize(new
    {
        messages = new object[]
        {
            new { role = "user", content = "Reply with OK." }
        },
        temperature = 0.0,
        max_completion_tokens = 16,
    });

    Exception? lastException = null;
    foreach (var deployment in deploymentCandidates)
    {
        try
        {
            var completionUrl = $"{endpoint}/openai/deployments/{Uri.EscapeDataString(deployment)}/chat/completions?api-version={Uri.EscapeDataString(openAiOptions.ApiVersion)}";
            using var request = new HttpRequestMessage(HttpMethod.Post, completionUrl);
            await ApplyAzureOpenAiAuthAsync(request, openAiOptions, authMode, cancellationToken);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");

            using var response = await client.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();
            return deployment;
        }
        catch (Exception ex)
        {
            lastException = ex;
        }
    }

    throw lastException ?? new InvalidOperationException("Azure OpenAI probe failed for all configured deployment candidates.");
}

static async Task<string> GenerateAzureOpenAiChatCompletionAsync(HttpClient client, AzureOpenAiOptions openAiOptions, string prompt, string contextBlock, AzureServiceAuthMode authMode, CancellationToken cancellationToken)
{
    var endpoint = openAiOptions.Endpoint.TrimEnd('/');
    var systemPrompt = "You are an incident operations AI copilot. Answer using only grounded context. If context is missing, say what is missing and recommend a human review checkpoint.";
    var userPrompt = string.IsNullOrWhiteSpace(contextBlock)
        ? $"User question:\n{prompt}\n\nNo retrieved context was available."
        : $"Grounded context:\n{contextBlock}\n\nUser question:\n{prompt}";

    var body = JsonSerializer.Serialize(new
    {
        messages = new object[]
        {
            new { role = "system", content = systemPrompt },
            new { role = "user", content = userPrompt }
        },
        temperature = 0.2,
        top_p = 0.95,
        max_completion_tokens = 550,
    });

    async Task<string> SendCompletionAsync(string deploymentName)
    {
        var completionUrl = $"{endpoint}/openai/deployments/{Uri.EscapeDataString(deploymentName)}/chat/completions?api-version={Uri.EscapeDataString(openAiOptions.ApiVersion)}";
        using var request = new HttpRequestMessage(HttpMethod.Post, completionUrl);
        await ApplyAzureOpenAiAuthAsync(request, openAiOptions, authMode, cancellationToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Content = new StringContent(body, Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(responseStream, cancellationToken: cancellationToken);

        var content = document.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        return string.IsNullOrWhiteSpace(content)
            ? "No model output was returned. Human review is required."
            : content.Trim();
    }

    try
    {
        return await SendCompletionAsync(openAiOptions.Deployment);
    }
    catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound
        && !string.IsNullOrWhiteSpace(openAiOptions.Model)
        && !string.Equals(openAiOptions.Model, openAiOptions.Deployment, StringComparison.OrdinalIgnoreCase))
    {
        return await SendCompletionAsync(openAiOptions.Model);
    }
}

static async Task ApplyAzureSearchAuthAsync(HttpRequestMessage request, AzureAiSearchOptions searchOptions, AzureServiceAuthMode authMode, CancellationToken cancellationToken)
{
    if (authMode == AzureServiceAuthMode.ApiKey)
    {
        request.Headers.Add("api-key", searchOptions.ApiKey);
        return;
    }

    if (authMode != AzureServiceAuthMode.ManagedIdentity)
    {
        throw new InvalidOperationException("AzureAISearch configuration does not contain a usable auth mode.");
    }

    TokenCredential credential = new DefaultAzureCredential();
    var tokenRequestContext = new TokenRequestContext(["https://search.azure.com/.default"]);
    var accessToken = await credential.GetTokenAsync(tokenRequestContext, cancellationToken);
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken.Token);
}

static async Task ApplyAzureOpenAiAuthAsync(HttpRequestMessage request, AzureOpenAiOptions openAiOptions, AzureServiceAuthMode authMode, CancellationToken cancellationToken)
{
    if (authMode == AzureServiceAuthMode.ApiKey)
    {
        request.Headers.Add("api-key", openAiOptions.ApiKey);
        return;
    }

    if (authMode != AzureServiceAuthMode.ManagedIdentity)
    {
        throw new InvalidOperationException("AzureOpenAI configuration does not contain a usable auth mode.");
    }

    TokenCredential credential = new DefaultAzureCredential();
    var tokenRequestContext = new TokenRequestContext(["https://cognitiveservices.azure.com/.default"]);
    var accessToken = await credential.GetTokenAsync(tokenRequestContext, cancellationToken);
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken.Token);
}

static AzureServiceAuthMode ResolveAzureAuthMode(bool useManagedIdentity, bool hasApiKey, bool isProduction)
{
    if (isProduction && useManagedIdentity)
    {
        return AzureServiceAuthMode.ManagedIdentity;
    }

    if (hasApiKey)
    {
        return AzureServiceAuthMode.ApiKey;
    }

    if (useManagedIdentity)
    {
        return AzureServiceAuthMode.ManagedIdentity;
    }

    return AzureServiceAuthMode.None;
}

static string RedactSensitiveData(string? input)
{
    if (string.IsNullOrWhiteSpace(input))
    {
        return string.Empty;
    }

    var redacted = input;
    redacted = Regex.Replace(redacted, @"(?i)(api[_-]?key""?\s*[:=]\s*""?)([^""\s,}]+)", "$1[REDACTED]");
    redacted = Regex.Replace(redacted, @"(?i)(authorization""?\s*[:=]\s*""?bearer\s+)([^""\s,}]+)", "$1[REDACTED]");
    redacted = Regex.Replace(redacted, @"(?i)(access[_-]?token""?\s*[:=]\s*""?)([^""\s,}]+)", "$1[REDACTED]");
    redacted = Regex.Replace(redacted, @"(?i)(client[_-]?secret""?\s*[:=]\s*""?)([^""\s,}]+)", "$1[REDACTED]");
    redacted = Regex.Replace(redacted, @"(?i)(password""?\s*[:=]\s*""?)([^""\s,}]+)", "$1[REDACTED]");
    redacted = Regex.Replace(redacted, @"(?i)(refresh[_-]?token""?\s*[:=]\s*""?)([^""\s,}]+)", "$1[REDACTED]");
    redacted = Regex.Replace(redacted, @"(?i)(connection[_-]?string""?\s*[:=]\s*""?)([^""\r\n]+)", "$1[REDACTED]");

    return redacted;
}

static string RedactNarrativeTextForExport(string? value)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return string.Empty;
    }

    return "[REDACTED]";
}

static string RedactNotificationDestinationAddress(string? destinationAddress)
{
    if (string.IsNullOrWhiteSpace(destinationAddress))
    {
        return string.Empty;
    }

    var normalized = destinationAddress.Trim();

    if (Uri.TryCreate(normalized, UriKind.Absolute, out _))
    {
        return "[REDACTED_ENDPOINT]";
    }

    var atIndex = normalized.IndexOf('@');
    if (atIndex > 0 && atIndex < normalized.Length - 1)
    {
        var local = normalized[..atIndex];
        var domain = normalized[(atIndex + 1)..];
        var localPrefix = local.Length > 0 ? local[0].ToString() : string.Empty;
        return $"{localPrefix}***@{domain}";
    }

    var digits = new string(normalized.Where(char.IsDigit).ToArray());
    if (digits.Length >= 7)
    {
        var suffix = digits.Length > 4 ? digits[^4..] : digits;
        return $"***{suffix}";
    }

    return "[REDACTED]";
}

static string BuildAuditEventExportCsv(IEnumerable<AuditEventListItemDto> items)
{
    static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        return value.Replace("\"", "\"\"");
    }

    var lines = new List<string>
    {
        "EventUtc,Category,Action,Outcome,Actor,IncidentId,LocationId,ClientIp,Entity,EntityKey,DetailJson"
    };

    foreach (var item in items)
    {
        var entity = $"{item.EntitySchemaName ?? string.Empty}.{item.EntityTableName ?? string.Empty}".Trim('.');
        lines.Add($"\"{item.EventUtc:O}\",\"{EscapeCsv(item.EventCategory)}\",\"{EscapeCsv(item.EventAction)}\",\"{EscapeCsv(item.OutcomeCode)}\",\"{EscapeCsv(item.ActorDisplayName)}\",\"{item.IncidentId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty}\",\"{item.LocationId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty}\",\"{EscapeCsv(item.ClientIpAddress)}\",\"{EscapeCsv(entity)}\",\"{EscapeCsv(item.EntityPrimaryKey)}\",\"{EscapeCsv(RedactSensitiveData(item.DetailJson))}\"");
    }

    return string.Join('\n', lines);
}

static async Task<IReadOnlyList<ExternalProviderTelemetryEvent>> ReadProviderTelemetryEventsFromWarehouseAsync(
    string connectionString,
    string? environment,
    string? provider,
    DateTimeOffset fromUtc,
    CancellationToken cancellationToken)
{
    const string sql = """
        SELECT
            Provider,
            EventType,
            Detail,
            EventUtc
        FROM ops.ExternalProviderTelemetryEvent
        WHERE EventUtc >= @fromUtc
          AND (@environment IS NULL OR ISNULL(NULLIF(EnvironmentName, N''), N'Unknown') = @environment)
          AND (@provider IS NULL OR Provider = @provider)
        ORDER BY EventUtc ASC, ExternalProviderTelemetryEventId ASC;
        """;

    var events = new List<ExternalProviderTelemetryEvent>();

    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);

    await using var command = new SqlCommand(sql, connection)
    {
        CommandType = CommandType.Text,
        CommandTimeout = 30,
    };

    command.Parameters.Add(new SqlParameter("@fromUtc", SqlDbType.DateTimeOffset) { Value = fromUtc });
    command.Parameters.Add(new SqlParameter("@environment", SqlDbType.NVarChar, 80)
    {
        Value = string.IsNullOrWhiteSpace(environment) ? DBNull.Value : environment.Trim()
    });
    command.Parameters.Add(new SqlParameter("@provider", SqlDbType.NVarChar, 120)
    {
        Value = string.IsNullOrWhiteSpace(provider) ? DBNull.Value : provider.Trim()
    });

    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
    {
        events.Add(new ExternalProviderTelemetryEvent(
            reader.GetString(0),
            reader.GetString(1),
            reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
            reader.GetFieldValue<DateTimeOffset>(3)));
    }

    return events;
}

static string BuildExternalProviderGovernanceExportCsv(
    IReadOnlyList<ExternalProviderTelemetryEvent> events,
    string? provider,
    int windowHours,
    int bucketMinutes,
    DateTimeOffset generatedUtc)
{
    var now = generatedUtc;
    var windowStartUtc = now.AddHours(-windowHours);
    var bucketCount = Math.Max(1, (int)Math.Ceiling(TimeSpan.FromHours(windowHours).TotalMinutes / bucketMinutes));

    var bucketMap = new Dictionary<int, List<ExternalProviderTelemetryEvent>>();
    foreach (var item in events)
    {
        var rawIndex = (int)Math.Floor((item.EventUtc - windowStartUtc).TotalMinutes / bucketMinutes);
        var index = Math.Clamp(rawIndex, 0, bucketCount - 1);
        if (!bucketMap.TryGetValue(index, out var list))
        {
            list = [];
            bucketMap[index] = list;
        }

        list.Add(item);
    }

    var providerSummary = events
        .GroupBy(item => item.Provider, StringComparer.OrdinalIgnoreCase)
        .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)
        .Select(group =>
        {
            var success = group.Count(item => string.Equals(item.EventType, "success", StringComparison.OrdinalIgnoreCase));
            var failure = group.Count(item => string.Equals(item.EventType, "failure", StringComparison.OrdinalIgnoreCase));
            var bypass = group.Count(item => string.Equals(item.EventType, "bypass", StringComparison.OrdinalIgnoreCase));
            var total = success + failure + bypass;
            var failureRate = total == 0 ? 0m : (decimal)failure / total;
            return new { Provider = group.Key, Success = success, Failure = failure, Bypass = bypass, Total = total, FailureRate = failureRate };
        })
        .ToArray();

    var builder = new StringBuilder();
    builder.AppendLine("Section,Provider,WindowHours,BucketMinutes,MetricKey,MetricValue,MetricValueNumeric,BucketStartUtc,BucketEndUtc,GeneratedUtc");

    var overallSuccess = providerSummary.Sum(item => item.Success);
    var overallFailure = providerSummary.Sum(item => item.Failure);
    var overallBypass = providerSummary.Sum(item => item.Bypass);
    var overallTotal = overallSuccess + overallFailure + overallBypass;
    var overallFailureRate = overallTotal == 0 ? 0m : (decimal)overallFailure / overallTotal;

    AppendGovernanceCsvRow(builder, "Totals", provider, windowHours, bucketMinutes, "SuccessCount", overallSuccess.ToString(CultureInfo.InvariantCulture), overallSuccess, null, null, generatedUtc);
    AppendGovernanceCsvRow(builder, "Totals", provider, windowHours, bucketMinutes, "FailureCount", overallFailure.ToString(CultureInfo.InvariantCulture), overallFailure, null, null, generatedUtc);
    AppendGovernanceCsvRow(builder, "Totals", provider, windowHours, bucketMinutes, "BypassCount", overallBypass.ToString(CultureInfo.InvariantCulture), overallBypass, null, null, generatedUtc);
    AppendGovernanceCsvRow(builder, "Totals", provider, windowHours, bucketMinutes, "FailureRate", overallFailureRate.ToString("P2", CultureInfo.InvariantCulture), overallFailureRate, null, null, generatedUtc);

    foreach (var item in providerSummary)
    {
        AppendGovernanceCsvRow(builder, "ProviderSummary", item.Provider, windowHours, bucketMinutes, "SuccessCount", item.Success.ToString(CultureInfo.InvariantCulture), item.Success, null, null, generatedUtc);
        AppendGovernanceCsvRow(builder, "ProviderSummary", item.Provider, windowHours, bucketMinutes, "FailureCount", item.Failure.ToString(CultureInfo.InvariantCulture), item.Failure, null, null, generatedUtc);
        AppendGovernanceCsvRow(builder, "ProviderSummary", item.Provider, windowHours, bucketMinutes, "BypassCount", item.Bypass.ToString(CultureInfo.InvariantCulture), item.Bypass, null, null, generatedUtc);
        AppendGovernanceCsvRow(builder, "ProviderSummary", item.Provider, windowHours, bucketMinutes, "FailureRate", item.FailureRate.ToString("P2", CultureInfo.InvariantCulture), item.FailureRate, null, null, generatedUtc);
    }

    for (var index = 0; index < bucketCount; index += 1)
    {
        var bucketStartUtc = windowStartUtc.AddMinutes(index * bucketMinutes);
        var bucketEndUtc = bucketStartUtc.AddMinutes(bucketMinutes);
        if (bucketEndUtc > now)
        {
            bucketEndUtc = now;
        }

        bucketMap.TryGetValue(index, out var bucketEvents);
        bucketEvents ??= [];

        var success = bucketEvents.Count(item => string.Equals(item.EventType, "success", StringComparison.OrdinalIgnoreCase));
        var failure = bucketEvents.Count(item => string.Equals(item.EventType, "failure", StringComparison.OrdinalIgnoreCase));
        var bypass = bucketEvents.Count(item => string.Equals(item.EventType, "bypass", StringComparison.OrdinalIgnoreCase));
        var total = success + failure + bypass;
        var failureRate = total == 0 ? 0m : (decimal)failure / total;

        AppendGovernanceCsvRow(builder, "Bucket", provider, windowHours, bucketMinutes, "SuccessCount", success.ToString(CultureInfo.InvariantCulture), success, bucketStartUtc, bucketEndUtc, generatedUtc);
        AppendGovernanceCsvRow(builder, "Bucket", provider, windowHours, bucketMinutes, "FailureCount", failure.ToString(CultureInfo.InvariantCulture), failure, bucketStartUtc, bucketEndUtc, generatedUtc);
        AppendGovernanceCsvRow(builder, "Bucket", provider, windowHours, bucketMinutes, "BypassCount", bypass.ToString(CultureInfo.InvariantCulture), bypass, bucketStartUtc, bucketEndUtc, generatedUtc);
        AppendGovernanceCsvRow(builder, "Bucket", provider, windowHours, bucketMinutes, "FailureRate", failureRate.ToString("P2", CultureInfo.InvariantCulture), failureRate, bucketStartUtc, bucketEndUtc, generatedUtc);
    }

    return builder.ToString();
}

static string EscapeCsvValue(string? value)
{
    if (string.IsNullOrEmpty(value))
    {
        return "\"\"";
    }

    return $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
}

static void AppendGovernanceCsvRow(
    StringBuilder builder,
    string section,
    string? provider,
    int windowHours,
    int bucketMinutes,
    string metricKey,
    string metricValue,
    decimal metricValueNumeric,
    DateTimeOffset? bucketStartUtc,
    DateTimeOffset? bucketEndUtc,
    DateTimeOffset generatedUtc)
{
    builder.Append(EscapeCsvValue(section)).Append(',')
        .Append(EscapeCsvValue(provider ?? string.Empty)).Append(',')
        .Append(windowHours.ToString(CultureInfo.InvariantCulture)).Append(',')
        .Append(bucketMinutes.ToString(CultureInfo.InvariantCulture)).Append(',')
        .Append(EscapeCsvValue(metricKey)).Append(',')
        .Append(EscapeCsvValue(metricValue)).Append(',')
        .Append(metricValueNumeric.ToString(CultureInfo.InvariantCulture)).Append(',')
        .Append(EscapeCsvValue(bucketStartUtc?.ToString("O", CultureInfo.InvariantCulture) ?? string.Empty)).Append(',')
        .Append(EscapeCsvValue(bucketEndUtc?.ToString("O", CultureInfo.InvariantCulture) ?? string.Empty)).Append(',')
        .Append(EscapeCsvValue(generatedUtc.ToString("O", CultureInfo.InvariantCulture)))
        .AppendLine();
}

static object BuildExternalProviderExecutiveScorecardDocument(
    IReadOnlyList<ExternalProviderTelemetryEvent> events,
    string? provider,
    int rollingDays,
    DateTimeOffset generatedUtc)
{
    var providerSummaries = events
        .GroupBy(item => item.Provider, StringComparer.OrdinalIgnoreCase)
        .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)
        .Select(group =>
        {
            var successCount = group.Count(item => string.Equals(item.EventType, "success", StringComparison.OrdinalIgnoreCase));
            var failureCount = group.Count(item => string.Equals(item.EventType, "failure", StringComparison.OrdinalIgnoreCase));
            var bypassCount = group.Count(item => string.Equals(item.EventType, "bypass", StringComparison.OrdinalIgnoreCase));
            var totalCount = successCount + failureCount + bypassCount;
            var failureRate = totalCount == 0 ? 0m : Math.Round((decimal)failureCount / totalCount, 4);
            var lastEventUtc = group.Max(item => item.EventUtc);

            return new
            {
                provider = group.Key,
                successCount,
                failureCount,
                bypassCount,
                totalCount,
                failureRate,
                lastEventUtc
            };
        })
        .ToArray();

    var overallSuccess = providerSummaries.Sum(item => item.successCount);
    var overallFailure = providerSummaries.Sum(item => item.failureCount);
    var overallBypass = providerSummaries.Sum(item => item.bypassCount);
    var overallEvents = overallSuccess + overallFailure + overallBypass;
    var overallFailureRate = overallEvents == 0 ? 0m : Math.Round((decimal)overallFailure / overallEvents, 4);

    return new
    {
        generatedUtc,
        scope = new
        {
            provider,
            rollingDays,
            windowStartUtc = generatedUtc.AddDays(-rollingDays),
            windowEndUtc = generatedUtc,
        },
        overall = new
        {
            successCount = overallSuccess,
            failureCount = overallFailure,
            bypassCount = overallBypass,
            totalCount = overallEvents,
            failureRate = overallFailureRate,
        },
        providerSummaries,
        scorecard = new
        {
            reliabilityBand = overallFailureRate switch
            {
                <= 0.05m => "Excellent",
                <= 0.10m => "Good",
                <= 0.20m => "Watch",
                _ => "Critical"
            },
            primaryRiskProvider = providerSummaries
                .OrderByDescending(item => item.failureRate)
                .ThenByDescending(item => item.totalCount)
                .FirstOrDefault()?.provider,
            recommendedAction = overallFailureRate > 0.20m
                ? "Escalate provider remediation and tighten circuit-breaker review cadence."
                : overallFailureRate > 0.10m
                    ? "Maintain active watch and validate threshold alerts daily."
                    : "Continue normal operations with weekly governance review."
        }
    };
}

static string BuildExternalProviderExecutiveScorecardCsv(
    IReadOnlyList<ExternalProviderTelemetryEvent> events,
    string? provider,
    int rollingDays,
    DateTimeOffset generatedUtc)
{
    var document = BuildExternalProviderExecutiveScorecardDocument(events, provider, rollingDays, generatedUtc);
    var jsonElement = JsonSerializer.SerializeToElement(document);

    var providerSummaries = jsonElement
        .GetProperty("providerSummaries")
        .EnumerateArray()
        .ToArray();

    var overall = jsonElement.GetProperty("overall");
    var scorecard = jsonElement.GetProperty("scorecard");

    var builder = new StringBuilder();
    builder.AppendLine("Section,Provider,RollingDays,MetricKey,MetricValue,MetricValueNumeric,GeneratedUtc");

    AppendScorecardCsvRow(builder, "Overall", provider, rollingDays, "SuccessCount", overall.GetProperty("successCount").GetInt32().ToString(CultureInfo.InvariantCulture), overall.GetProperty("successCount").GetDecimal(), generatedUtc);
    AppendScorecardCsvRow(builder, "Overall", provider, rollingDays, "FailureCount", overall.GetProperty("failureCount").GetInt32().ToString(CultureInfo.InvariantCulture), overall.GetProperty("failureCount").GetDecimal(), generatedUtc);
    AppendScorecardCsvRow(builder, "Overall", provider, rollingDays, "BypassCount", overall.GetProperty("bypassCount").GetInt32().ToString(CultureInfo.InvariantCulture), overall.GetProperty("bypassCount").GetDecimal(), generatedUtc);
    AppendScorecardCsvRow(builder, "Overall", provider, rollingDays, "FailureRate", overall.GetProperty("failureRate").GetDecimal().ToString("P2", CultureInfo.InvariantCulture), overall.GetProperty("failureRate").GetDecimal(), generatedUtc);

    foreach (var summary in providerSummaries)
    {
        var providerName = summary.GetProperty("provider").GetString() ?? string.Empty;
        AppendScorecardCsvRow(builder, "ProviderSummary", providerName, rollingDays, "SuccessCount", summary.GetProperty("successCount").GetInt32().ToString(CultureInfo.InvariantCulture), summary.GetProperty("successCount").GetDecimal(), generatedUtc);
        AppendScorecardCsvRow(builder, "ProviderSummary", providerName, rollingDays, "FailureCount", summary.GetProperty("failureCount").GetInt32().ToString(CultureInfo.InvariantCulture), summary.GetProperty("failureCount").GetDecimal(), generatedUtc);
        AppendScorecardCsvRow(builder, "ProviderSummary", providerName, rollingDays, "BypassCount", summary.GetProperty("bypassCount").GetInt32().ToString(CultureInfo.InvariantCulture), summary.GetProperty("bypassCount").GetDecimal(), generatedUtc);
        AppendScorecardCsvRow(builder, "ProviderSummary", providerName, rollingDays, "FailureRate", summary.GetProperty("failureRate").GetDecimal().ToString("P2", CultureInfo.InvariantCulture), summary.GetProperty("failureRate").GetDecimal(), generatedUtc);
    }

    AppendScorecardCsvRow(builder, "Scorecard", provider, rollingDays, "ReliabilityBand", scorecard.GetProperty("reliabilityBand").GetString() ?? string.Empty, 0m, generatedUtc);
    AppendScorecardCsvRow(builder, "Scorecard", provider, rollingDays, "PrimaryRiskProvider", scorecard.GetProperty("primaryRiskProvider").GetString() ?? string.Empty, 0m, generatedUtc);
    AppendScorecardCsvRow(builder, "Scorecard", provider, rollingDays, "RecommendedAction", scorecard.GetProperty("recommendedAction").GetString() ?? string.Empty, 0m, generatedUtc);

    return builder.ToString();
}

static string BuildExternalProviderExecutivePacketReadme(
    string? provider,
    int rollingDays,
    int windowHours,
    int bucketMinutes,
    DateTimeOffset generatedUtc)
{
    var providerScope = string.IsNullOrWhiteSpace(provider) ? "All providers" : provider;

    return $"""
External Provider Executive Packet

Generated UTC: {generatedUtc:O}
Provider scope: {providerScope}
Scorecard rolling days: {rollingDays}
Governance window hours: {windowHours}
Governance bucket minutes: {bucketMinutes}

Package contents:
- governance/external-provider-governance.csv
- scorecards/external-provider-scorecard.csv
- scorecards/external-provider-scorecard.json

Intended use:
- Executive governance packet distribution
- Multi-environment reliability review baseline
- Compliance evidence attachment for review cycles
""";
}

static void AddTextArchiveEntry(ZipArchive archive, string entryName, string content)
{
    var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
    using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
    writer.Write(content);
}

static void AppendScorecardCsvRow(
    StringBuilder builder,
    string section,
    string? provider,
    int rollingDays,
    string metricKey,
    string metricValue,
    decimal metricValueNumeric,
    DateTimeOffset generatedUtc)
{
    builder.Append(EscapeCsvValue(section)).Append(',')
        .Append(EscapeCsvValue(provider ?? string.Empty)).Append(',')
        .Append(rollingDays.ToString(CultureInfo.InvariantCulture)).Append(',')
        .Append(EscapeCsvValue(metricKey)).Append(',')
        .Append(EscapeCsvValue(metricValue)).Append(',')
        .Append(metricValueNumeric.ToString(CultureInfo.InvariantCulture)).Append(',')
        .Append(EscapeCsvValue(generatedUtc.ToString("O", CultureInfo.InvariantCulture)))
        .AppendLine();
}

static bool TryGetTenantIdFromAuthority(string authority, out string tenantId)
{
    tenantId = string.Empty;

    if (!Uri.TryCreate(authority, UriKind.Absolute, out var authorityUri))
    {
        return false;
    }

    var pathSegments = authorityUri.AbsolutePath
        .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    if (pathSegments.Length == 0)
    {
        return false;
    }

    tenantId = pathSegments[0];
    return !string.IsNullOrWhiteSpace(tenantId);
}

static bool CanManageAgentPersonalizationPolicy(ClaimsPrincipal user)
{
    var roles = user.FindAll("roles")
        .Concat(user.FindAll("role"))
        .Concat(user.FindAll(ClaimTypes.Role))
        .Select(claim => claim.Value)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    return roles.Contains("SYSTEM_ADMIN")
        || roles.Contains("KDHE_ADMIN")
        || roles.Contains("INCIDENT_COMMANDER")
        || roles.Contains("LOOKUP_ADMIN");
}

static AgentPersonalizationPolicyDto CreateDefaultAgentPersonalizationPolicy()
{
    return new AgentPersonalizationPolicyDto(
        ShowDiagnostics: false,
        RequireApprovalForAll: false,
        LockGovernanceToggles: true,
        EnforceGlobalStyle: false,
        AllowedThemes: ["auto", "light", "dark", "midnight", "violet"],
        AllowedAvatars: ["copilot", "radar", "spark", "shield", "analyst", "custom"],
        AllowedFontScaleMin: 90,
        AllowedFontScaleMax: 120,
        AllowedAccentColors: ["#6d28d9", "#9333ea", "#0d6efd", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"]);
}

static AgentPersonalizationPolicyDto NormalizeAgentPersonalizationPolicy(AgentPersonalizationPolicyDto policy)
{
    var fallback = CreateDefaultAgentPersonalizationPolicy();

    var themes = policy.AllowedThemes
        .Where(theme => !string.IsNullOrWhiteSpace(theme))
        .Select(theme => theme.Trim().ToLowerInvariant())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    if (themes.Length == 0)
    {
        themes = fallback.AllowedThemes.ToArray();
    }

    var avatars = policy.AllowedAvatars
        .Where(avatar => !string.IsNullOrWhiteSpace(avatar))
        .Select(avatar => avatar.Trim().ToLowerInvariant())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    if (avatars.Length == 0)
    {
        avatars = fallback.AllowedAvatars.ToArray();
    }

    var colors = policy.AllowedAccentColors
        .Where(color => !string.IsNullOrWhiteSpace(color))
        .Select(color => color.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    if (colors.Length == 0)
    {
        colors = fallback.AllowedAccentColors.ToArray();
    }

    var minScale = Math.Clamp(policy.AllowedFontScaleMin, 75, 150);
    var maxScale = Math.Clamp(policy.AllowedFontScaleMax, minScale, 160);

    return new AgentPersonalizationPolicyDto(
        policy.ShowDiagnostics,
        policy.RequireApprovalForAll,
        policy.LockGovernanceToggles,
        policy.EnforceGlobalStyle,
        themes,
        avatars,
        minScale,
        maxScale,
        colors);
}

static async Task<WeatherLocationResolution> ResolveWeatherLocationContextAsync(
    long? incidentId,
    long? locationId,
    long? defaultLocationId,
    string? city,
    string? state,
    string? postalCode,
    string? defaultCity,
    string? defaultState,
    string? defaultPostalCode,
    IIncidentQueryService incidentQueryService,
    ILookupQueryService lookupQueryService,
    CancellationToken cancellationToken)
{
    var normalizedCity = string.IsNullOrWhiteSpace(city) ? null : city.Trim();
    var normalizedState = string.IsNullOrWhiteSpace(state) ? null : state.Trim();
    var normalizedPostalCode = string.IsNullOrWhiteSpace(postalCode) ? null : postalCode.Trim();
    var normalizedDefaultCity = string.IsNullOrWhiteSpace(defaultCity) ? null : defaultCity.Trim();
    var normalizedDefaultState = string.IsNullOrWhiteSpace(defaultState) ? null : defaultState.Trim();
    var normalizedDefaultPostalCode = string.IsNullOrWhiteSpace(defaultPostalCode) ? null : defaultPostalCode.Trim();

    long? incidentLocationId = null;
    if (incidentId is > 0)
    {
        var incident = await incidentQueryService.GetIncidentByIdAsync(incidentId.Value, cancellationToken);
        incidentLocationId = incident?.PrimaryLocationId;
    }

    // Priority: selected incident location -> explicit location -> admin/default configured location.
    long? resolvedLocationId = incidentLocationId ?? locationId ?? defaultLocationId;

    var activeLocations = await lookupQueryService.GetActiveLocationsAsync(cancellationToken);
    var resolvedLocation = resolvedLocationId.HasValue
        ? activeLocations.FirstOrDefault(item => item.LocationId == resolvedLocationId.Value)
        : null;

    var resolvedCity = normalizedCity ?? resolvedLocation?.CityName ?? normalizedDefaultCity;
    var resolvedState = normalizedState ?? resolvedLocation?.StateCode ?? normalizedDefaultState;
    var resolvedPostalCode = normalizedPostalCode ?? resolvedLocation?.PostalCode ?? normalizedDefaultPostalCode;

    return new WeatherLocationResolution(
        incidentId,
        resolvedLocation?.LocationId ?? resolvedLocationId,
        resolvedLocation?.LocationName,
        resolvedCity,
        resolvedState,
        resolvedPostalCode,
        resolvedLocation?.Latitude,
        resolvedLocation?.Longitude);
}

static async Task<WeatherForecast[]?> TryGetOpenMeteoForecastAsync(
    IHttpClientFactory httpClientFactory,
    ConcurrentDictionary<string, ExternalProviderTelemetry> providerTelemetryByName,
    ConcurrentQueue<ExternalProviderTelemetryEvent> providerTelemetryHistory,
    int telemetryHistoryMax,
    bool persistTelemetryToFile,
    string telemetryFilePath,
    object telemetryFileLock,
    bool persistTelemetryToSql,
    int sqlRetentionDays,
    string? sqlConnectionString,
    string? environmentName,
    decimal latitude,
    decimal longitude,
    string? locationLabel,
    CancellationToken cancellationToken,
    int circuitFailureThreshold,
    TimeSpan circuitDuration)
{
    var client = httpClientFactory.CreateClient();
    var requestUri = $"https://api.open-meteo.com/v1/forecast?latitude={latitude.ToString(CultureInfo.InvariantCulture)}&longitude={longitude.ToString(CultureInfo.InvariantCulture)}&daily=weathercode,temperature_2m_max,temperature_2m_min&temperature_unit=celsius&timezone=UTC&forecast_days=5";

    using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
    using var response = await client.SendAsync(request, cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "OPEN_METEO",
            $"HTTP {(int)response.StatusCode}",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
    using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

    if (!document.RootElement.TryGetProperty("daily", out var dailyElement))
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "OPEN_METEO",
            "Missing 'daily' payload.",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    if (!dailyElement.TryGetProperty("time", out var timeElement)
        || !dailyElement.TryGetProperty("temperature_2m_max", out var maxTempElement)
        || !dailyElement.TryGetProperty("temperature_2m_min", out var minTempElement)
        || !dailyElement.TryGetProperty("weathercode", out var weatherCodeElement))
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "OPEN_METEO",
            "Incomplete daily forecast payload.",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    var result = new List<WeatherForecast>();
    var count = Math.Min(5, timeElement.GetArrayLength());
    for (var i = 0; i < count; i++)
    {
        if (!DateOnly.TryParse(timeElement[i].GetString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            continue;
        }

        var max = maxTempElement[i].GetDouble();
        var min = minTempElement[i].GetDouble();
        var avgC = (int)Math.Round((max + min) / 2d);
        var weatherCode = weatherCodeElement[i].GetInt32();

        result.Add(new WeatherForecast(
            date,
            avgC,
            MapOpenMeteoWeatherCodeToSummary(weatherCode),
            locationLabel,
            "OPEN_METEO"));
    }

    if (result.Count == 0)
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "OPEN_METEO",
            "No valid forecast points parsed.",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    MarkProviderSuccess(
        providerTelemetryByName,
        providerTelemetryHistory,
        telemetryHistoryMax,
        persistTelemetryToFile,
        telemetryFilePath,
        telemetryFileLock,
        persistTelemetryToSql,
        sqlRetentionDays,
        sqlConnectionString,
        environmentName,
        "OPEN_METEO",
        "Provider call succeeded.");
    return [.. result];
}

static string? BuildWeatherLocationLabel(WeatherLocationResolution weatherContext)
{
    var locationName = string.IsNullOrWhiteSpace(weatherContext.LocationName) ? null : weatherContext.LocationName.Trim();
    var city = string.IsNullOrWhiteSpace(weatherContext.City) ? null : weatherContext.City.Trim();
    var state = string.IsNullOrWhiteSpace(weatherContext.State) ? null : weatherContext.State.Trim().ToUpperInvariant();
    var postal = string.IsNullOrWhiteSpace(weatherContext.PostalCode) ? null : weatherContext.PostalCode.Trim();

    var cityState = string.Join(", ", new[] { city, state }.Where(static part => !string.IsNullOrWhiteSpace(part)));

    if (!string.IsNullOrWhiteSpace(cityState) && !string.IsNullOrWhiteSpace(postal))
    {
        return $"{cityState} {postal}";
    }

    if (!string.IsNullOrWhiteSpace(cityState))
    {
        return cityState;
    }

    if (!string.IsNullOrWhiteSpace(postal))
    {
        return postal;
    }

    return weatherContext.LocationId is > 0
        ? $"Location #{weatherContext.LocationId.Value.ToString(CultureInfo.InvariantCulture)}"
        : null;
}

static CopLiveOverlayFeedPointDto[] BuildSimulatedCopLiveOverlayFeedPoints(
    IReadOnlyList<LocationLookupDto> activeLocations,
    DateTimeOffset generatedUtc,
    string source)
{
    return activeLocations
        .Take(12)
        .Select((location, index) =>
        {
            var seed = HashCode.Combine(location.LocationId, generatedUtc.UtcDateTime.Minute / 5, index);
            var delta = (seed % 11) - 5;
            var boundedDelta = Math.Clamp(delta, -8, 8);

            return new CopLiveOverlayFeedPointDto(
                location.LocationId,
                boundedDelta,
                source,
                generatedUtc);
        })
        .ToArray();
}

static async Task<CopLiveOverlayFeedPointDto[]?> TryGetCopLiveOverlayExternalFeedAsync(
    IHttpClientFactory httpClientFactory,
    ConcurrentDictionary<string, ExternalProviderTelemetry> providerTelemetryByName,
    ConcurrentQueue<ExternalProviderTelemetryEvent> providerTelemetryHistory,
    int telemetryHistoryMax,
    bool persistTelemetryToFile,
    string telemetryFilePath,
    object telemetryFileLock,
    bool persistTelemetryToSql,
    int sqlRetentionDays,
    string? sqlConnectionString,
    string? environmentName,
    IReadOnlyList<LocationLookupDto> activeLocations,
    CancellationToken cancellationToken,
    int circuitFailureThreshold,
    TimeSpan circuitDuration)
{
    var externalUrl = Environment.GetEnvironmentVariable("IPOC_COP_LIVE_OVERLAY_EXTERNAL_URL");
    if (string.IsNullOrWhiteSpace(externalUrl))
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "COP_LIVE_OVERLAY_EXTERNAL",
            "Missing IPOC_COP_LIVE_OVERLAY_EXTERNAL_URL.",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    if (!Uri.TryCreate(externalUrl, UriKind.Absolute, out var requestUri))
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "COP_LIVE_OVERLAY_EXTERNAL",
            "Invalid IPOC_COP_LIVE_OVERLAY_EXTERNAL_URL format.",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    var client = httpClientFactory.CreateClient();
    using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
    using var response = await client.SendAsync(request, cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "COP_LIVE_OVERLAY_EXTERNAL",
            $"HTTP {(int)response.StatusCode}",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
    using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

    JsonElement pointsElement;
    if (document.RootElement.ValueKind == JsonValueKind.Array)
    {
        pointsElement = document.RootElement;
    }
    else if (document.RootElement.ValueKind == JsonValueKind.Object
             && document.RootElement.TryGetProperty("points", out var embeddedPoints)
             && embeddedPoints.ValueKind == JsonValueKind.Array)
    {
        pointsElement = embeddedPoints;
    }
    else
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "COP_LIVE_OVERLAY_EXTERNAL",
            "Expected JSON array payload or object.points array payload.",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    var activeLocationIds = activeLocations.Select(item => item.LocationId).ToHashSet();
    var points = new List<CopLiveOverlayFeedPointDto>();

    foreach (var item in pointsElement.EnumerateArray())
    {
        if (!item.TryGetProperty("locationId", out var locationIdElement)
            || !item.TryGetProperty("stressDelta", out var stressDeltaElement)
            || !locationIdElement.TryGetInt64(out var locationId)
            || !TryGetOverlayStressDelta(stressDeltaElement, out var stressDelta))
        {
            continue;
        }

        if (!activeLocationIds.Contains(locationId))
        {
            continue;
        }

        var source = item.TryGetProperty("source", out var sourceElement)
            ? sourceElement.GetString() ?? "external-feed"
            : "external-feed";

        var updatedUtc = DateTimeOffset.UtcNow;
        if (item.TryGetProperty("updatedUtc", out var updatedUtcElement)
            && DateTimeOffset.TryParse(updatedUtcElement.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsedUpdatedUtc))
        {
            updatedUtc = parsedUpdatedUtc;
        }

        points.Add(new CopLiveOverlayFeedPointDto(
            locationId,
            Math.Clamp(stressDelta, -8, 8),
            source,
            updatedUtc));
    }

    if (points.Count == 0)
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "COP_LIVE_OVERLAY_EXTERNAL",
            "No valid overlay points parsed.",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    MarkProviderSuccess(
        providerTelemetryByName,
        providerTelemetryHistory,
        telemetryHistoryMax,
        persistTelemetryToFile,
        telemetryFilePath,
        telemetryFileLock,
        persistTelemetryToSql,
        sqlRetentionDays,
        sqlConnectionString,
        environmentName,
        "COP_LIVE_OVERLAY_EXTERNAL",
        "Provider call succeeded.");
    return [.. points];
}

static async Task<CopLiveOverlayExternalReadinessProbeResult> ProbeCopLiveOverlayExternalReadinessAsync(
    IHttpClientFactory httpClientFactory,
    IReadOnlySet<long> activeLocationIds,
    CancellationToken cancellationToken)
{
    var externalUrl = Environment.GetEnvironmentVariable("IPOC_COP_LIVE_OVERLAY_EXTERNAL_URL");
    if (string.IsNullOrWhiteSpace(externalUrl))
    {
        return new CopLiveOverlayExternalReadinessProbeResult(
            UrlConfigured: false,
            Status: "NotConfigured",
            HttpStatusCode: null,
            RawPointCount: 0,
            ValidPointCount: 0,
            ActiveLocationMatchCount: 0,
            InvalidPointCount: 0,
            Detail: "Missing IPOC_COP_LIVE_OVERLAY_EXTERNAL_URL.");
    }

    if (!Uri.TryCreate(externalUrl, UriKind.Absolute, out var requestUri))
    {
        return new CopLiveOverlayExternalReadinessProbeResult(
            UrlConfigured: true,
            Status: "InvalidConfiguration",
            HttpStatusCode: null,
            RawPointCount: 0,
            ValidPointCount: 0,
            ActiveLocationMatchCount: 0,
            InvalidPointCount: 0,
            Detail: "IPOC_COP_LIVE_OVERLAY_EXTERNAL_URL is not a valid absolute URI.");
    }

    try
    {
        var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        using var response = await client.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            return new CopLiveOverlayExternalReadinessProbeResult(
                UrlConfigured: true,
                Status: "Unavailable",
                HttpStatusCode: (int)response.StatusCode,
                RawPointCount: 0,
                ValidPointCount: 0,
                ActiveLocationMatchCount: 0,
                InvalidPointCount: 0,
                Detail: $"External provider returned HTTP {(int)response.StatusCode}.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        JsonElement pointsElement;
        if (document.RootElement.ValueKind == JsonValueKind.Array)
        {
            pointsElement = document.RootElement;
        }
        else if (document.RootElement.ValueKind == JsonValueKind.Object
                 && document.RootElement.TryGetProperty("points", out var embeddedPoints)
                 && embeddedPoints.ValueKind == JsonValueKind.Array)
        {
            pointsElement = embeddedPoints;
        }
        else
        {
            return new CopLiveOverlayExternalReadinessProbeResult(
                UrlConfigured: true,
                Status: "SchemaMismatch",
                HttpStatusCode: (int)response.StatusCode,
                RawPointCount: 0,
                ValidPointCount: 0,
                ActiveLocationMatchCount: 0,
                InvalidPointCount: 0,
                Detail: "Expected JSON array payload or object.points array payload.");
        }

        var rawPointCount = 0;
        var validPointCount = 0;
        var activeLocationMatchCount = 0;
        var invalidPointCount = 0;

        foreach (var item in pointsElement.EnumerateArray())
        {
            rawPointCount += 1;
            if (!item.TryGetProperty("locationId", out var locationIdElement)
                || !item.TryGetProperty("stressDelta", out var stressDeltaElement)
                || !locationIdElement.TryGetInt64(out var locationId)
                || !TryGetOverlayStressDelta(stressDeltaElement, out _))
            {
                invalidPointCount += 1;
                continue;
            }

            validPointCount += 1;
            if (activeLocationIds.Contains(locationId))
            {
                activeLocationMatchCount += 1;
            }
        }

        var status = validPointCount > 0 && activeLocationMatchCount > 0
            ? "Ready"
            : validPointCount > 0
                ? "NoActiveLocationMatch"
                : rawPointCount > 0
                    ? "NoValidPoints"
                    : "NoPoints";

        return new CopLiveOverlayExternalReadinessProbeResult(
            UrlConfigured: true,
            Status: status,
            HttpStatusCode: (int)response.StatusCode,
            RawPointCount: rawPointCount,
            ValidPointCount: validPointCount,
            ActiveLocationMatchCount: activeLocationMatchCount,
            InvalidPointCount: invalidPointCount,
            Detail: status switch
            {
                "Ready" => "External feed is configured and has valid points mapped to active locations.",
                "NoActiveLocationMatch" => "External feed points are valid but do not map to active locations.",
                "NoValidPoints" => "External feed returned points but none passed required field/type checks.",
                "NoPoints" => "External feed returned zero points.",
                _ => "External feed readiness could not be established."
            });
    }
    catch (OperationCanceledException)
    {
        throw;
    }
    catch (Exception ex)
    {
        return new CopLiveOverlayExternalReadinessProbeResult(
            UrlConfigured: true,
            Status: "ProbeError",
            HttpStatusCode: null,
            RawPointCount: 0,
            ValidPointCount: 0,
            ActiveLocationMatchCount: 0,
            InvalidPointCount: 0,
            Detail: $"External readiness probe failed: {ex.Message}");
    }
}

static bool TryGetOverlayStressDelta(JsonElement element, out int stressDelta)
{
    stressDelta = 0;

    if (element.ValueKind == JsonValueKind.Number)
    {
        if (element.TryGetInt32(out var asInt))
        {
            stressDelta = asInt;
            return true;
        }

        if (element.TryGetDouble(out var asDouble))
        {
            stressDelta = (int)Math.Round(asDouble);
            return true;
        }
    }

    if (element.ValueKind == JsonValueKind.String
        && int.TryParse(element.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
    {
        stressDelta = parsed;
        return true;
    }

    return false;
}

static string GetCopLiveOverlayExternalPayloadContractJsonSchema()
{
    return
        """
        {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "title": "CopLiveOverlayExternalFeed",
          "oneOf": [
            {
              "type": "array",
              "items": { "$ref": "#/$defs/point" }
            },
            {
              "type": "object",
              "required": ["points"],
              "properties": {
                "points": {
                  "type": "array",
                  "items": { "$ref": "#/$defs/point" }
                }
              },
              "additionalProperties": true
            }
          ],
          "$defs": {
            "point": {
              "type": "object",
              "required": ["locationId", "stressDelta"],
              "properties": {
                "locationId": { "type": "integer", "minimum": 1 },
                "stressDelta": { "type": ["integer", "number", "string"] },
                "source": { "type": "string" },
                "updatedUtc": { "type": "string", "format": "date-time" }
              },
              "additionalProperties": true
            }
          }
        }
        """;
}

static string GetCopLiveOverlayExternalPayloadSampleJson()
{
    return
        """
        {
          "points": [
            {
              "locationId": 8101,
              "stressDelta": 4,
              "source": "external-feed",
              "updatedUtc": "2026-01-15T14:20:00Z"
            },
            {
              "locationId": 8102,
              "stressDelta": -2,
              "source": "external-feed",
              "updatedUtc": "2026-01-15T14:20:00Z"
            }
          ]
        }
        """;
}

static string MapOpenMeteoWeatherCodeToSummary(int weatherCode)
{
    return weatherCode switch
    {
        0 => "Clear",
        1 or 2 => "Partly cloudy",
        3 => "Overcast",
        45 or 48 => "Fog",
        51 or 53 or 55 or 56 or 57 => "Drizzle",
        61 or 63 or 65 or 66 or 67 => "Rain",
        71 or 73 or 75 or 77 => "Snow",
        80 or 81 or 82 => "Rain showers",
        85 or 86 => "Snow showers",
        95 or 96 or 99 => "Thunderstorm",
        _ => "Variable"
    };
}

static async Task<AdminLocationGeocodeResultDto?> TryGeocodeWithNominatimAsync(
    IHttpClientFactory httpClientFactory,
    ConcurrentDictionary<string, ExternalProviderTelemetry> providerTelemetryByName,
    ConcurrentQueue<ExternalProviderTelemetryEvent> providerTelemetryHistory,
    int telemetryHistoryMax,
    bool persistTelemetryToFile,
    string telemetryFilePath,
    object telemetryFileLock,
    bool persistTelemetryToSql,
    int sqlRetentionDays,
    string? sqlConnectionString,
    string? environmentName,
    string? locationName,
    string? city,
    string? state,
    string? postalCode,
    CancellationToken cancellationToken,
    int circuitFailureThreshold,
    TimeSpan circuitDuration)
{
    var query = string.Join(", ", new[] { locationName, city, state, postalCode }.Where(part => !string.IsNullOrWhiteSpace(part)));
    if (string.IsNullOrWhiteSpace(query))
    {
        return null;
    }

    var client = httpClientFactory.CreateClient();
    using var request = new HttpRequestMessage(HttpMethod.Get, $"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(query)}&format=jsonv2&limit=1");
    request.Headers.UserAgent.ParseAdd("IPOC_WEB/1.0 (operations-platform)");
    request.Headers.AcceptLanguage.ParseAdd("en-US");

    using var response = await client.SendAsync(request, cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "NOMINATIM",
            $"HTTP {(int)response.StatusCode}",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
    using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

    if (document.RootElement.ValueKind != JsonValueKind.Array || document.RootElement.GetArrayLength() == 0)
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "NOMINATIM",
            "No geocode result returned.",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    var first = document.RootElement[0];
    if (!first.TryGetProperty("lat", out var latElement)
        || !first.TryGetProperty("lon", out var lonElement)
        || !decimal.TryParse(latElement.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var latitude)
        || !decimal.TryParse(lonElement.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var longitude))
    {
        MarkProviderFailure(
            providerTelemetryByName,
            providerTelemetryHistory,
            telemetryHistoryMax,
            persistTelemetryToFile,
            telemetryFilePath,
            telemetryFileLock,
            persistTelemetryToSql,
            sqlRetentionDays,
            sqlConnectionString,
            environmentName,
            "NOMINATIM",
            "Invalid geocode coordinate payload.",
            circuitFailureThreshold,
            circuitDuration);
        return null;
    }

    var displayName = first.TryGetProperty("display_name", out var displayNameElement)
        ? displayNameElement.GetString() ?? query
        : query;

    MarkProviderSuccess(
        providerTelemetryByName,
        providerTelemetryHistory,
        telemetryHistoryMax,
        persistTelemetryToFile,
        telemetryFilePath,
        telemetryFileLock,
        persistTelemetryToSql,
        sqlRetentionDays,
        sqlConnectionString,
        environmentName,
        "NOMINATIM",
        "Provider call succeeded.");
    return new AdminLocationGeocodeResultDto(
        Math.Round(latitude, 6),
        Math.Round(longitude, 6),
        displayName,
        "NOMINATIM",
        0.86m);
}

static void MarkProviderSuccess(
    ConcurrentDictionary<string, ExternalProviderTelemetry> providerTelemetryByName,
    ConcurrentQueue<ExternalProviderTelemetryEvent> providerTelemetryHistory,
    int telemetryHistoryMax,
    bool persistTelemetryToFile,
    string telemetryFilePath,
    object telemetryFileLock,
    bool persistTelemetryToSql,
    int sqlRetentionDays,
    string? sqlConnectionString,
    string? environmentName,
    string providerName,
    string detail)
{
    var now = DateTimeOffset.UtcNow;
    var state = providerTelemetryByName.GetOrAdd(providerName, _ => new ExternalProviderTelemetry());
    state.SuccessCount += 1;
    state.ConsecutiveFailures = 0;
    state.CircuitOpenedUntilUtc = null;
    state.LastSuccessUtc = now;
    state.LastEventType = "success";
    state.LastEventUtc = now;
    state.LastEventDetail = detail;
    state.LastError = null;

    RecordProviderTelemetryEvent(
        providerTelemetryHistory,
        telemetryHistoryMax,
        persistTelemetryToFile,
        telemetryFilePath,
        telemetryFileLock,
        persistTelemetryToSql,
        sqlRetentionDays,
        sqlConnectionString,
        environmentName,
        new ExternalProviderTelemetryEvent(providerName, "success", detail, now));
}

static void MarkProviderBypass(
    ConcurrentDictionary<string, ExternalProviderTelemetry> providerTelemetryByName,
    ConcurrentQueue<ExternalProviderTelemetryEvent> providerTelemetryHistory,
    int telemetryHistoryMax,
    bool persistTelemetryToFile,
    string telemetryFilePath,
    object telemetryFileLock,
    bool persistTelemetryToSql,
    int sqlRetentionDays,
    string? sqlConnectionString,
    string? environmentName,
    string providerName)
{
    var now = DateTimeOffset.UtcNow;
    var state = providerTelemetryByName.GetOrAdd(providerName, _ => new ExternalProviderTelemetry());
    state.CircuitBypassCount += 1;
    state.LastBypassUtc = now;
    state.LastEventType = "bypass";
    state.LastEventUtc = now;
    state.LastEventDetail = "Circuit open";
    RecordProviderTelemetryEvent(
        providerTelemetryHistory,
        telemetryHistoryMax,
        persistTelemetryToFile,
        telemetryFilePath,
        telemetryFileLock,
        persistTelemetryToSql,
        sqlRetentionDays,
        sqlConnectionString,
        environmentName,
        new ExternalProviderTelemetryEvent(providerName, "bypass", "Circuit open", now));
}

static void MarkProviderFailure(
    ConcurrentDictionary<string, ExternalProviderTelemetry> providerTelemetryByName,
    ConcurrentQueue<ExternalProviderTelemetryEvent> providerTelemetryHistory,
    int telemetryHistoryMax,
    bool persistTelemetryToFile,
    string telemetryFilePath,
    object telemetryFileLock,
    bool persistTelemetryToSql,
    int sqlRetentionDays,
    string? sqlConnectionString,
    string? environmentName,
    string providerName,
    string error,
    int circuitFailureThreshold,
    TimeSpan circuitDuration)
{
    var now = DateTimeOffset.UtcNow;
    var state = providerTelemetryByName.GetOrAdd(providerName, _ => new ExternalProviderTelemetry());
    state.FailureCount += 1;
    state.ConsecutiveFailures += 1;
    if (state.ConsecutiveFailures >= circuitFailureThreshold)
    {
        state.CircuitOpenedUntilUtc = now.Add(circuitDuration);
    }
    state.LastFailureUtc = now;
    state.LastEventType = "failure";
    state.LastEventUtc = now;
    state.LastEventDetail = error;
    state.LastError = error;
    RecordProviderTelemetryEvent(
        providerTelemetryHistory,
        telemetryHistoryMax,
        persistTelemetryToFile,
        telemetryFilePath,
        telemetryFileLock,
        persistTelemetryToSql,
        sqlRetentionDays,
        sqlConnectionString,
        environmentName,
        new ExternalProviderTelemetryEvent(providerName, "failure", error, now));
}

static void RecordProviderTelemetryEvent(
    ConcurrentQueue<ExternalProviderTelemetryEvent> providerTelemetryHistory,
    int telemetryHistoryMax,
    bool persistTelemetryToFile,
    string telemetryFilePath,
    object telemetryFileLock,
    bool persistTelemetryToSql,
    int sqlRetentionDays,
    string? sqlConnectionString,
    string? environmentName,
    ExternalProviderTelemetryEvent telemetryEvent)
{
    providerTelemetryHistory.Enqueue(telemetryEvent);
    while (providerTelemetryHistory.Count > telemetryHistoryMax && providerTelemetryHistory.TryDequeue(out _))
    {
    }

    if (persistTelemetryToFile)
    {
        AppendPersistedProviderTelemetryEvent(telemetryFilePath, telemetryFileLock, telemetryEvent);
    }

    if (persistTelemetryToSql && !string.IsNullOrWhiteSpace(sqlConnectionString))
    {
        PersistProviderTelemetryEventToSql(sqlConnectionString, sqlRetentionDays, environmentName, telemetryEvent);
    }
}

static IReadOnlyList<ExternalProviderTelemetryEvent> LoadPersistedProviderTelemetryEvents(string telemetryFilePath, int maxEvents)
{
    if (!File.Exists(telemetryFilePath))
    {
        return [];
    }

    try
    {
        var lines = File.ReadLines(telemetryFilePath)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();

        var window = lines.Count > maxEvents
            ? lines[^maxEvents..]
            : lines;

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        var events = new List<ExternalProviderTelemetryEvent>(window.Count);
        foreach (var line in window)
        {
            var parsed = JsonSerializer.Deserialize<ExternalProviderTelemetryEvent>(line, options);
            if (parsed is not null)
            {
                events.Add(parsed);
            }
        }

        return events;
    }
    catch
    {
        return [];
    }
}

static void PersistProviderTelemetryEventToSql(string connectionString, int retentionDays, string? environmentName, ExternalProviderTelemetryEvent telemetryEvent)
{
    try
    {
        using var connection = new SqlConnection(connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandType = CommandType.Text;
        command.CommandTimeout = 15;
        command.CommandText = """
            INSERT INTO ops.ExternalProviderTelemetryEvent
            (
                Provider,
                EventType,
                Detail,
                EventUtc,
                EnvironmentName
            )
            VALUES
            (
                @provider,
                @eventType,
                @detail,
                @eventUtc,
                @environment
            );

            DELETE FROM ops.ExternalProviderTelemetryEvent
            WHERE EventUtc < DATEADD(DAY, -@retentionDays, SYSUTCDATETIME());
            """;

        command.Parameters.Add(new SqlParameter("@provider", SqlDbType.NVarChar, 120) { Value = telemetryEvent.Provider });
        command.Parameters.Add(new SqlParameter("@eventType", SqlDbType.NVarChar, 40) { Value = telemetryEvent.EventType });
        command.Parameters.Add(new SqlParameter("@detail", SqlDbType.NVarChar, 1000)
        {
            Value = string.IsNullOrWhiteSpace(telemetryEvent.Detail) ? DBNull.Value : telemetryEvent.Detail
        });
        command.Parameters.Add(new SqlParameter("@eventUtc", SqlDbType.DateTimeOffset) { Value = telemetryEvent.EventUtc });
        command.Parameters.Add(new SqlParameter("@environment", SqlDbType.NVarChar, 80)
        {
            Value = string.IsNullOrWhiteSpace(environmentName) ? "Unknown" : environmentName.Trim()
        });
        command.Parameters.Add(new SqlParameter("@retentionDays", SqlDbType.Int) { Value = retentionDays });

        _ = command.ExecuteNonQuery();
    }
    catch
    {
        // Non-fatal SQL telemetry persistence failure.
    }
}

static void AppendPersistedProviderTelemetryEvent(
    string telemetryFilePath,
    object telemetryFileLock,
    ExternalProviderTelemetryEvent telemetryEvent)
{
    try
    {
        var directory = Path.GetDirectoryName(telemetryFilePath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var line = JsonSerializer.Serialize(telemetryEvent);
        lock (telemetryFileLock)
        {
            File.AppendAllText(telemetryFilePath, line + Environment.NewLine, Encoding.UTF8);
        }
    }
    catch
    {
        // Non-fatal telemetry persistence failure.
    }
}

static TelemetryRotationResult RotatePersistedProviderTelemetryFile(
    string telemetryFilePath,
    string archiveDirectory,
    long maxFileSizeBytes,
    object telemetryFileLock)
{
    if (maxFileSizeBytes <= 0)
    {
        return new TelemetryRotationResult(false, false, null, 0, "Rotation threshold disabled.", DateTimeOffset.UtcNow);
    }

    lock (telemetryFileLock)
    {
        try
        {
            if (!File.Exists(telemetryFilePath))
            {
                return new TelemetryRotationResult(false, false, null, 0, "No telemetry file found.", DateTimeOffset.UtcNow);
            }

            var sourceFile = new FileInfo(telemetryFilePath);
            if (sourceFile.Length < maxFileSizeBytes)
            {
                return new TelemetryRotationResult(false, false, null, sourceFile.Length, "Telemetry file is below rotation threshold.", DateTimeOffset.UtcNow);
            }

            Directory.CreateDirectory(archiveDirectory);
            var archivePath = Path.Combine(archiveDirectory, $"external-provider-health-history-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}.jsonl");
            File.Copy(telemetryFilePath, archivePath, overwrite: false);
            File.WriteAllText(telemetryFilePath, string.Empty, Encoding.UTF8);

            return new TelemetryRotationResult(true, true, archivePath, sourceFile.Length, "Telemetry file rotated successfully.", DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            return new TelemetryRotationResult(false, true, null, 0, $"Telemetry rotation failed: {ex.Message}", DateTimeOffset.UtcNow);
        }
    }
}

static void RebuildProviderTelemetryState(
    ConcurrentDictionary<string, ExternalProviderTelemetry> providerTelemetryByName,
    IEnumerable<ExternalProviderTelemetryEvent> events,
    int circuitFailureThreshold,
    TimeSpan circuitDuration,
    DateTimeOffset now)
{
    foreach (var telemetryEvent in events.OrderBy(item => item.EventUtc))
    {
        var state = providerTelemetryByName.GetOrAdd(telemetryEvent.Provider, _ => new ExternalProviderTelemetry());
        state.LastEventType = telemetryEvent.EventType;
        state.LastEventUtc = telemetryEvent.EventUtc;
        state.LastEventDetail = telemetryEvent.Detail;

        if (string.Equals(telemetryEvent.EventType, "success", StringComparison.OrdinalIgnoreCase))
        {
            state.SuccessCount += 1;
            state.ConsecutiveFailures = 0;
            state.CircuitOpenedUntilUtc = null;
            state.LastSuccessUtc = telemetryEvent.EventUtc;
            state.LastError = null;
            continue;
        }

        if (string.Equals(telemetryEvent.EventType, "failure", StringComparison.OrdinalIgnoreCase))
        {
            state.FailureCount += 1;
            state.ConsecutiveFailures += 1;
            if (state.ConsecutiveFailures >= circuitFailureThreshold)
            {
                state.CircuitOpenedUntilUtc = telemetryEvent.EventUtc.Add(circuitDuration);
            }

            state.LastFailureUtc = telemetryEvent.EventUtc;
            state.LastError = telemetryEvent.Detail;
            continue;
        }

        if (string.Equals(telemetryEvent.EventType, "bypass", StringComparison.OrdinalIgnoreCase))
        {
            state.CircuitBypassCount += 1;
            state.LastBypassUtc = telemetryEvent.EventUtc;
        }
    }

    foreach (var item in providerTelemetryByName)
    {
        if (item.Value.CircuitOpenedUntilUtc.HasValue && item.Value.CircuitOpenedUntilUtc.Value <= now)
        {
            item.Value.CircuitOpenedUntilUtc = null;
        }
    }
}

static bool IsProviderCircuitOpen(ConcurrentDictionary<string, ExternalProviderTelemetry> providerTelemetryByName, string providerName)
{
    if (!providerTelemetryByName.TryGetValue(providerName, out var state) || !state.CircuitOpenedUntilUtc.HasValue)
    {
        return false;
    }

    if (state.CircuitOpenedUntilUtc.Value <= DateTimeOffset.UtcNow)
    {
        state.CircuitOpenedUntilUtc = null;
        return false;
    }

    return true;
}

static string GetProviderCircuitState(ExternalProviderTelemetry telemetry, int circuitFailureThreshold, DateTimeOffset now)
{
    if (telemetry.CircuitOpenedUntilUtc.HasValue && telemetry.CircuitOpenedUntilUtc.Value > now)
    {
        return "open";
    }

    return telemetry.ConsecutiveFailures >= circuitFailureThreshold ? "half-open" : "closed";
}

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary, string? LocationLabel = null, string? Source = null)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

record CopLiveOverlayFeedPointDto(long LocationId, int StressDelta, string Source, DateTimeOffset UpdatedUtc);
record CopLiveOverlayFeedDto(string Provider, string Status, bool FallbackUsed, string? Detail, DateTimeOffset? LastExternalAttemptUtc, string? LastExternalFailureReason, DateTimeOffset GeneratedUtc, IReadOnlyList<CopLiveOverlayFeedPointDto> Points);

record SystemReadiness(string Status, string Environment, bool SqlConnectionConfigured, bool DegradedReadFallbackEnabled, bool CacheUseRedis, bool AdminDataOpsScriptExecutionEnabled, DateTimeOffset CheckedUtc);
record UpdateAdminCacheModeRequestDto(bool CacheUseRedisRequested);
record AdminRuntimeCachePreferenceDto(bool CacheUseRedisRequested, DateTimeOffset UpdatedUtc);
record AdminCacheModeStateDto(
    bool CacheUseRedisRequested,
    bool CacheUseRedisEffective,
    bool RequiresRestart,
    string Source,
    bool DockerRedisStartAttempted,
    bool DockerRedisStartSucceeded,
    string? DockerRedisStartMessage,
    DateTimeOffset UpdatedUtc);
record AgentConfigHealth(
    string Status,
    string Environment,
    bool AzureOpenAiEnabled,
    bool AzureOpenAiConfigured,
    string AzureOpenAiEndpoint,
    string AzureOpenAiDeployment,
    string AzureOpenAiApiVersion,
    bool AzureOpenAiUseManagedIdentity,
    bool AzureAiSearchEnabled,
    bool AzureAiSearchConfigured,
    string AzureAiSearchEndpoint,
    string AzureAiSearchIndexName,
    string AzureAiSearchSemanticConfiguration,
    string AzureAiSearchQueryType,
    string AzureAiSearchDataSourceType,
    bool AzureAiSearchUseManagedIdentity,
    string AzureOpenAiAuthMode,
    string AzureAiSearchAuthMode,
    DateTimeOffset CheckedUtc);

record AgentConnectivityHealth(
    string Status,
    string Environment,
    bool AzureOpenAiConnected,
    string AzureOpenAiError,
    string AzureOpenAiAuthMode,
    string? AzureOpenAiActiveDeployment,
    bool AzureAiSearchConnected,
    string AzureAiSearchError,
    string AzureAiSearchAuthMode,
    DateTimeOffset CheckedUtc);

record AgentConversationMessageDto(string Id, string Role, string Text, DateTimeOffset CreatedAt);
record AgentConversationSessionDto(string Id, string Title, IReadOnlyList<AgentConversationMessageDto> Messages, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
record AgentRagSmokeRequestDto(string Prompt);
record AgentChatCompletionRequestDto(string SessionId, string Prompt, bool IncludeHistory = true, decimal? TopP = null, decimal? Temperature = null);
record AgentPredictiveDemandSupplyConfidenceIntervalDto(decimal Lower, decimal Upper);
record AgentPredictiveDemandSupplyResourceGapDto(string ResourceTypeCode, decimal RequestedOutstandingQuantity, decimal AvailableQuantity, decimal PredictedGapQuantity);
record AgentPredictiveDemandSupplyResponseDto(
    long IncidentId,
    string IncidentNumber,
    string IncidentName,
    int HorizonHours,
    string ModelId,
    string ModelVersion,
    DateTimeOffset TrainedAtUtc,
    AgentPredictiveDemandSupplyConfidenceIntervalDto ConfidenceInterval,
    string DriftStatus,
    int DemandPressureIndex,
    int SupplyReadinessIndex,
    string RiskLevel,
    decimal ProjectedDemandQuantity,
    decimal ProjectedSupplyQuantity,
    decimal PredictedShortfallQuantity,
    IReadOnlyList<AgentPredictiveDemandSupplyResourceGapDto> ShortageByResourceType,
    IReadOnlyList<string> Recommendations,
    IReadOnlyList<string> Assumptions,
    DateTimeOffset GeneratedUtc);
record AgentPredictiveDemandSupplyOperationalAcceptanceResponseDto(
    long IncidentId,
    string IncidentNumber,
    string IncidentName,
    int HorizonHours,
    string ModelId,
    string ModelVersion,
    bool Allowed,
    string Reason,
    IReadOnlyList<string> Violations,
    DateTimeOffset EvaluatedUtc);
record AgentCitationDto(string Label, string? Source, string? SourceId, decimal? Score, string? Url = null);
record AgentChatCompletionResponseDto(string SessionId, AgentConversationMessageDto Message, IReadOnlyList<string> GroundedSources, IReadOnlyList<AgentCitationDto> Citations, string ModelName, decimal ConfidenceScore, bool FallbackUsed, string RetrievalStatus);
record AgentPersonalizationPolicyDto(
    bool ShowDiagnostics,
    bool RequireApprovalForAll,
    bool LockGovernanceToggles,
    bool EnforceGlobalStyle,
    IReadOnlyList<string> AllowedThemes,
    IReadOnlyList<string> AllowedAvatars,
    int AllowedFontScaleMin,
    int AllowedFontScaleMax,
    IReadOnlyList<string> AllowedAccentColors);
record AgentPersonalizationPolicyStateDto(
    bool HasGlobalPolicy,
    bool CanManagePolicy,
    AgentPersonalizationPolicyDto Policy,
    DateTimeOffset CheckedUtc);
record AgentPersonalizationPolicyAuditItemDto(
    long AuditEventId,
    DateTimeOffset EventUtc,
    long? ActorUserId,
    string? ActorDisplayName,
    string OutcomeCode,
    string? DetailJson);
record AgentPersonalizationRequestDto(string Avatar, string Theme, int FontScale, string? ExpectedUpdatedUtc = null);
record AgentAnalyticsEventRequestDto(string EventName, string? SessionId, DateTimeOffset OccurredAt, string? MetadataJson);
record SyntheticDataResetResultDto(bool Succeeded, string Message, int ExitCode, string OperationCode, string TraceId, string Outcome, long? ActorUserId, DateTimeOffset ExecutedUtc);
record SyntheticDataPreviewDto(bool Enabled, string Environment, bool SqlConnected, int SyntheticLocationCount, int SyntheticInventoryCount, int SyntheticBedSnapshotCount, int SyntheticIncidentRequestCount, DateTimeOffset CheckedUtc);
record CopLiveOverlayExternalReadinessDto(string ProviderMode, bool UrlConfigured, string Status, int? HttpStatusCode, int RawPointCount, int ValidPointCount, int ActiveLocationMatchCount, int InvalidPointCount, string Detail, DateTimeOffset CheckedUtc);
record CopLiveOverlayExternalReadinessProbeResult(bool UrlConfigured, string Status, int? HttpStatusCode, int RawPointCount, int ValidPointCount, int ActiveLocationMatchCount, int InvalidPointCount, string Detail);
record DataOpsCooldownResult(bool Allowed, int RetryAfterSeconds);
readonly record struct AdminDockerComposeStartResult(bool Attempted, bool Succeeded, string? Message);
sealed class ExternalProviderTelemetry
{
    public long SuccessCount { get; set; }
    public long FailureCount { get; set; }
    public long CircuitBypassCount { get; set; }
    public int ConsecutiveFailures { get; set; }
    public DateTimeOffset? CircuitOpenedUntilUtc { get; set; }
    public DateTimeOffset? LastSuccessUtc { get; set; }
    public DateTimeOffset? LastFailureUtc { get; set; }
    public DateTimeOffset? LastBypassUtc { get; set; }
    public string? LastEventType { get; set; }
    public DateTimeOffset? LastEventUtc { get; set; }
    public string? LastEventDetail { get; set; }
    public string? LastError { get; set; }
}
record ExternalProviderTelemetryEvent(string Provider, string EventType, string Detail, DateTimeOffset EventUtc);
record TelemetryRotationResult(bool Succeeded, bool Attempted, string? ArchiveFilePath, long SourceFileBytes, string Message, DateTimeOffset ExecutedUtc);
record WeatherLocationResolution(
    long? IncidentId,
    long? LocationId,
    string? LocationName,
    string? City,
    string? State,
    string? PostalCode,
    decimal? Latitude,
    decimal? Longitude);

enum AzureServiceAuthMode
{
    None = 0,
    ApiKey = 1,
    ManagedIdentity = 2,
}

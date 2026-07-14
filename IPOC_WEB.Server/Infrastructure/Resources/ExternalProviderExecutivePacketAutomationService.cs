using System.Collections.Concurrent;
using System.Data;
using System.Globalization;
using System.IO.Compression;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using IPOC_WEB.Server.Infrastructure.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace IPOC_WEB.Server.Infrastructure.Resources;

public interface IExternalProviderExecutivePacketAutomationService
{
    Task<ExternalProviderExecutivePacketAutomationStatusDto> GetStatusAsync(CancellationToken cancellationToken);
    Task<ExternalProviderExecutivePacketAutomationRunResultDto> RunNowAsync(CancellationToken cancellationToken);
}

public sealed record ExternalProviderExecutivePacketAutomationStatusDto(
    bool Enabled,
    bool Running,
    DateTimeOffset? LastRunStartedUtc,
    DateTimeOffset? LastRunCompletedUtc,
    bool LastRunSucceeded,
    int LastPacketEventCount,
    string? LastPacketPath,
    string? LastError,
    string? LastTransportMode,
    string? LastTransportDestination,
    string? LastTransportArtifactId,
    int LastTransportAttempts,
    bool LastTransportSucceeded,
    DateTimeOffset? NextRunUtc,
    int IntervalMinutes,
    string OutputDirectory,
    string? Provider,
    int RollingDays,
    int WindowHours,
    int BucketMinutes,
    int MaxRetainedFiles);

public sealed record ExternalProviderExecutivePacketAutomationRunResultDto(
    bool Succeeded,
    string? PacketPath,
    string? TransportMode,
    string? TransportDestination,
    string? TransportArtifactId,
    int TransportAttempts,
    bool TransportSucceeded,
    int SourceEventCount,
    DateTimeOffset StartedUtc,
    DateTimeOffset CompletedUtc,
    string? Error);

internal sealed record ExternalProviderExecutivePacketTransportResult(
    bool Succeeded,
    string Mode,
    string? Destination,
    string? ArtifactId,
    int Attempts,
    string? Error);

public sealed class ExternalProviderExecutivePacketAutomationHostedService : BackgroundService, IExternalProviderExecutivePacketAutomationService
{
    private readonly ILogger<ExternalProviderExecutivePacketAutomationHostedService> _logger;
    private readonly string? _warehouseConnectionString;
    private readonly bool _persistToSql;
    private readonly ExternalProviderExecutivePacketAutomationOptions _options;
    private readonly HttpClient _httpClient = new();

    private readonly SemaphoreSlim _runLock = new(1, 1);
    private readonly object _stateGate = new();

    private bool _running;
    private DateTimeOffset? _lastRunStartedUtc;
    private DateTimeOffset? _lastRunCompletedUtc;
    private bool _lastRunSucceeded;
    private int _lastPacketEventCount;
    private string? _lastPacketPath;
    private string? _lastError;
    private string? _lastTransportMode;
    private string? _lastTransportDestination;
    private string? _lastTransportArtifactId;
    private int _lastTransportAttempts;
    private bool _lastTransportSucceeded;
    private DateTimeOffset? _nextRunUtc;

    public ExternalProviderExecutivePacketAutomationHostedService(
        IConfiguration configuration,
        IOptions<ExternalProviderExecutivePacketAutomationOptions> options,
        ILogger<ExternalProviderExecutivePacketAutomationHostedService> logger)
    {
        _logger = logger;
        _options = options.Value;
        _persistToSql = configuration.GetValue("ExternalProviders:Telemetry:PersistToSql", false);
        _warehouseConnectionString = _persistToSql ? configuration.GetConnectionString("IocEm") : null;
    }

    public Task<ExternalProviderExecutivePacketAutomationStatusDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_stateGate)
        {
            return Task.FromResult(new ExternalProviderExecutivePacketAutomationStatusDto(
                _options.Enabled,
                _running,
                _lastRunStartedUtc,
                _lastRunCompletedUtc,
                _lastRunSucceeded,
                _lastPacketEventCount,
                _lastPacketPath,
                _lastError,
                _lastTransportMode,
                _lastTransportDestination,
                _lastTransportArtifactId,
                _lastTransportAttempts,
                _lastTransportSucceeded,
                _nextRunUtc,
                _options.IntervalMinutes,
                _options.OutputDirectory,
                string.IsNullOrWhiteSpace(_options.Provider) ? null : _options.Provider.Trim(),
                _options.RollingDays,
                _options.WindowHours,
                _options.BucketMinutes,
                _options.MaxRetainedFiles));
        }
    }

    public async Task<ExternalProviderExecutivePacketAutomationRunResultDto> RunNowAsync(CancellationToken cancellationToken)
    {
        return await RunCoreAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("External provider executive packet automation is disabled.");
            return;
        }

        if (_options.RunOnStartup)
        {
            await RunCoreAsync(stoppingToken);
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = TimeSpan.FromMinutes(_options.IntervalMinutes);
            lock (_stateGate)
            {
                _nextRunUtc = DateTimeOffset.UtcNow.Add(delay);
            }

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            if (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            await RunCoreAsync(stoppingToken);
        }
    }

    private async Task<ExternalProviderExecutivePacketAutomationRunResultDto> RunCoreAsync(CancellationToken cancellationToken)
    {
        await _runLock.WaitAsync(cancellationToken);
        try
        {
            var startedUtc = DateTimeOffset.UtcNow;
            lock (_stateGate)
            {
                _running = true;
                _lastRunStartedUtc = startedUtc;
                _lastError = null;
            }

            try
            {
                var result = await BuildAndPersistPacketAsync(startedUtc, cancellationToken);

                lock (_stateGate)
                {
                    _running = false;
                    _lastRunCompletedUtc = result.CompletedUtc;
                    _lastRunSucceeded = result.Succeeded;
                    _lastPacketEventCount = result.SourceEventCount;
                    _lastPacketPath = result.PacketPath;
                    _lastError = result.Error;
                    _lastTransportMode = result.TransportMode;
                    _lastTransportDestination = result.TransportDestination;
                    _lastTransportArtifactId = result.TransportArtifactId;
                    _lastTransportAttempts = result.TransportAttempts;
                    _lastTransportSucceeded = result.TransportSucceeded;
                }

                return result;
            }
            catch (Exception ex)
            {
                var completedUtc = DateTimeOffset.UtcNow;
                lock (_stateGate)
                {
                    _running = false;
                    _lastRunCompletedUtc = completedUtc;
                    _lastRunSucceeded = false;
                    _lastError = ex.Message;
                    _lastTransportSucceeded = false;
                }

                _logger.LogError(ex, "External provider executive packet automation run failed.");
                return new ExternalProviderExecutivePacketAutomationRunResultDto(
                    false,
                    null,
                    null,
                    null,
                    null,
                    0,
                    false,
                    0,
                    startedUtc,
                    completedUtc,
                    ex.Message);
            }
        }
        finally
        {
            _runLock.Release();
        }
    }

    private async Task<ExternalProviderExecutivePacketAutomationRunResultDto> BuildAndPersistPacketAsync(DateTimeOffset startedUtc, CancellationToken cancellationToken)
    {
        var normalizedProvider = string.IsNullOrWhiteSpace(_options.Provider) ? null : _options.Provider.Trim();
        var now = DateTimeOffset.UtcNow;
        var sourceWindowStartUtc = now.AddHours(-Math.Max(_options.WindowHours, _options.RollingDays * 24));

        IReadOnlyList<ExternalProviderTelemetryEventRecord> sourceEvents;
        if (_persistToSql && !string.IsNullOrWhiteSpace(_warehouseConnectionString))
        {
            sourceEvents = await ReadProviderTelemetryEventsFromWarehouseAsync(
                _warehouseConnectionString,
                normalizedProvider,
                sourceWindowStartUtc,
                cancellationToken);
        }
        else
        {
            _logger.LogWarning("External provider executive packet automation fallback to in-memory telemetry is unavailable in hosted worker mode when SQL persistence is disabled.");
            sourceEvents = [];
        }

        var governanceCsv = BuildExternalProviderGovernanceExportCsv(
            sourceEvents.Where(item => item.EventUtc >= now.AddHours(-_options.WindowHours)).OrderBy(item => item.EventUtc).ToArray(),
            normalizedProvider,
            _options.WindowHours,
            _options.BucketMinutes,
            now);
        var scorecardCsv = BuildExternalProviderExecutiveScorecardCsv(
            sourceEvents.Where(item => item.EventUtc >= now.AddDays(-_options.RollingDays)).OrderBy(item => item.EventUtc).ToArray(),
            normalizedProvider,
            _options.RollingDays,
            now);
        var scorecardDocument = BuildExternalProviderExecutiveScorecardDocument(
            sourceEvents.Where(item => item.EventUtc >= now.AddDays(-_options.RollingDays)).OrderBy(item => item.EventUtc).ToArray(),
            normalizedProvider,
            _options.RollingDays,
            now);
        var scorecardJson = JsonSerializer.Serialize(scorecardDocument, new JsonSerializerOptions { WriteIndented = true });

        var outputDirectory = _options.OutputDirectory;
        Directory.CreateDirectory(outputDirectory);

        var fileName = $"external-provider-executive-packet-{now:yyyyMMdd-HHmmss}.zip";
        var fullPath = Path.Combine(outputDirectory, fileName);

        await using (var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None))
        await using (var archive = new ZipArchive(fileStream, ZipArchiveMode.Create, leaveOpen: false))
        {
            AddTextArchiveEntry(archive, "README.txt", BuildExternalProviderExecutivePacketReadme(normalizedProvider, _options.RollingDays, _options.WindowHours, _options.BucketMinutes, now));
            AddTextArchiveEntry(archive, "governance/external-provider-governance.csv", governanceCsv);
            AddTextArchiveEntry(archive, "scorecards/external-provider-scorecard.csv", scorecardCsv);
            AddTextArchiveEntry(archive, "scorecards/external-provider-scorecard.json", scorecardJson);
        }

        PruneRetainedFiles(outputDirectory, _options.MaxRetainedFiles);

        var transportResult = await ExecuteTransportWithRetryAsync(
            fullPath,
            now,
            normalizedProvider,
            sourceEvents.Count,
            cancellationToken);

        var completedUtc = DateTimeOffset.UtcNow;
        if (!transportResult.Succeeded)
        {
            return new ExternalProviderExecutivePacketAutomationRunResultDto(
                false,
                fullPath,
                transportResult.Mode,
                transportResult.Destination,
                transportResult.ArtifactId,
                transportResult.Attempts,
                transportResult.Succeeded,
                sourceEvents.Count,
                startedUtc,
                completedUtc,
                transportResult.Error ?? "Executive packet transport failed.");
        }

        return new ExternalProviderExecutivePacketAutomationRunResultDto(
            true,
            fullPath,
            transportResult.Mode,
            transportResult.Destination,
            transportResult.ArtifactId,
            transportResult.Attempts,
            transportResult.Succeeded,
            sourceEvents.Count,
            startedUtc,
            completedUtc,
            null);
    }

    private async Task<ExternalProviderExecutivePacketTransportResult> ExecuteTransportWithRetryAsync(
        string packetPath,
        DateTimeOffset generatedUtc,
        string? provider,
        int sourceEventCount,
        CancellationToken cancellationToken)
    {
        var mode = string.IsNullOrWhiteSpace(_options.Transport.Mode)
            ? "None"
            : _options.Transport.Mode.Trim();

        if (string.Equals(mode, "None", StringComparison.OrdinalIgnoreCase))
        {
            return new ExternalProviderExecutivePacketTransportResult(
                true,
                "None",
                null,
                Path.GetFileName(packetPath),
                0,
                null);
        }

        var maxAttempts = Math.Max(1, _options.Retry.MaxAttempts);
        Exception? lastError = null;

        for (var attempt = 1; attempt <= maxAttempts; attempt += 1)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var result = await ExecuteTransportCoreAsync(
                    mode,
                    packetPath,
                    generatedUtc,
                    provider,
                    sourceEventCount,
                    cancellationToken);

                return result with { Attempts = attempt };
            }
            catch (Exception ex)
            {
                lastError = ex;
                _logger.LogWarning(ex, "Executive packet transport attempt {Attempt}/{MaxAttempts} failed for mode {Mode}.", attempt, maxAttempts, mode);

                if (attempt >= maxAttempts)
                {
                    break;
                }

                var nextDelay = ComputeRetryDelay(attempt);
                if (nextDelay > TimeSpan.Zero)
                {
                    await Task.Delay(nextDelay, cancellationToken);
                }
            }
        }

        return new ExternalProviderExecutivePacketTransportResult(
            false,
            mode,
            null,
            Path.GetFileName(packetPath),
            maxAttempts,
            lastError?.Message ?? "Transport failed.");
    }

    private async Task<ExternalProviderExecutivePacketTransportResult> ExecuteTransportCoreAsync(
        string mode,
        string packetPath,
        DateTimeOffset generatedUtc,
        string? provider,
        int sourceEventCount,
        CancellationToken cancellationToken)
    {
        if (string.Equals(mode, "DirectoryCopy", StringComparison.OrdinalIgnoreCase))
        {
            var distributionDirectory = _options.Transport.DistributionDirectory;
            if (string.IsNullOrWhiteSpace(distributionDirectory))
            {
                throw new InvalidOperationException("Transport mode DirectoryCopy requires Reporting:ExternalProviderExecutivePacketAutomation:Transport:DistributionDirectory.");
            }

            var destinationRoot = Path.GetFullPath(distributionDirectory);
            Directory.CreateDirectory(destinationRoot);

            var destinationPath = Path.Combine(destinationRoot, Path.GetFileName(packetPath));
            File.Copy(packetPath, destinationPath, overwrite: true);

            return new ExternalProviderExecutivePacketTransportResult(
                true,
                mode,
                destinationPath,
                Path.GetFileName(destinationPath),
                1,
                null);
        }

        if (string.Equals(mode, "Webhook", StringComparison.OrdinalIgnoreCase))
        {
            var endpoint = _options.Transport.WebhookEndpoint;
            if (string.IsNullOrWhiteSpace(endpoint))
            {
                throw new InvalidOperationException("Transport mode Webhook requires Reporting:ExternalProviderExecutivePacketAutomation:Transport:WebhookEndpoint.");
            }

            var packetInfo = new FileInfo(packetPath);
            var payload = new
            {
                generatedUtc,
                provider,
                sourceEventCount,
                packet = new
                {
                    name = packetInfo.Name,
                    fullPath = packetInfo.FullName,
                    sizeBytes = packetInfo.Length,
                    createdUtc = packetInfo.CreationTimeUtc,
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };

            if (!string.IsNullOrWhiteSpace(_options.Transport.WebhookAuthorizationHeader))
            {
                var authValue = _options.Transport.WebhookAuthorizationHeader.Trim();
                request.Headers.Authorization = AuthenticationHeaderValue.TryParse(authValue, out var authHeader)
                    ? authHeader
                    : null;

                if (request.Headers.Authorization is null)
                {
                    request.Headers.TryAddWithoutValidation("Authorization", authValue);
                }
            }

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            return new ExternalProviderExecutivePacketTransportResult(
                true,
                mode,
                endpoint,
                packetInfo.Name,
                1,
                null);
        }

        throw new InvalidOperationException($"Unsupported executive packet transport mode '{mode}'. Supported modes: None, DirectoryCopy, Webhook.");
    }

    private TimeSpan ComputeRetryDelay(int attempt)
    {
        var baseSeconds = Math.Max(1, _options.Retry.InitialDelaySeconds);
        var maxSeconds = Math.Max(baseSeconds, _options.Retry.MaxDelaySeconds);

        var exponent = Math.Max(0, attempt - 1);
        var exponentialSeconds = baseSeconds * Math.Pow(3, exponent);
        var boundedSeconds = Math.Min(maxSeconds, exponentialSeconds);
        var jitterSeconds = Random.Shared.NextDouble() * Math.Min(5d, boundedSeconds * 0.20d);

        return TimeSpan.FromSeconds(boundedSeconds + jitterSeconds);
    }

    private static void PruneRetainedFiles(string outputDirectory, int maxRetainedFiles)
    {
        if (maxRetainedFiles <= 0)
        {
            return;
        }

        var files = new DirectoryInfo(outputDirectory)
            .GetFiles("external-provider-executive-packet-*.zip", SearchOption.TopDirectoryOnly)
            .OrderByDescending(item => item.CreationTimeUtc)
            .ToArray();

        if (files.Length <= maxRetainedFiles)
        {
            return;
        }

        foreach (var file in files.Skip(maxRetainedFiles))
        {
            try
            {
                file.Delete();
            }
            catch
            {
                // Keep retention prune non-blocking.
            }
        }
    }

    private static async Task<IReadOnlyList<ExternalProviderTelemetryEventRecord>> ReadProviderTelemetryEventsFromWarehouseAsync(
        string connectionString,
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
              AND (@provider IS NULL OR Provider = @provider)
            ORDER BY EventUtc ASC, ExternalProviderTelemetryEventId ASC;
            """;

        var events = new List<ExternalProviderTelemetryEventRecord>();

        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@fromUtc", SqlDbType.DateTimeOffset) { Value = fromUtc });
        command.Parameters.Add(new SqlParameter("@provider", SqlDbType.NVarChar, 120)
        {
            Value = string.IsNullOrWhiteSpace(provider) ? DBNull.Value : provider.Trim()
        });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            events.Add(new ExternalProviderTelemetryEventRecord(
                reader.GetString(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                reader.GetFieldValue<DateTimeOffset>(3)));
        }

        return events;
    }

    private static string BuildExternalProviderGovernanceExportCsv(
        IReadOnlyList<ExternalProviderTelemetryEventRecord> events,
        string? provider,
        int windowHours,
        int bucketMinutes,
        DateTimeOffset generatedUtc)
    {
        var now = generatedUtc;
        var windowStartUtc = now.AddHours(-windowHours);
        var bucketCount = Math.Max(1, (int)Math.Ceiling(TimeSpan.FromHours(windowHours).TotalMinutes / bucketMinutes));

        var bucketMap = new Dictionary<int, List<ExternalProviderTelemetryEventRecord>>();
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

    private static string BuildExternalProviderExecutiveScorecardCsv(
        IReadOnlyList<ExternalProviderTelemetryEventRecord> events,
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

    private static object BuildExternalProviderExecutiveScorecardDocument(
        IReadOnlyList<ExternalProviderTelemetryEventRecord> events,
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

    private static string BuildExternalProviderExecutivePacketReadme(
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

    private static void AddTextArchiveEntry(ZipArchive archive, string entryName, string content)
    {
        var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        writer.Write(content);
    }

    private static string EscapeCsvValue(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "\"\"";
        }

        return $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
    }

    private static void AppendGovernanceCsvRow(
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

    private static void AppendScorecardCsvRow(
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
}

public sealed record ExternalProviderTelemetryEventRecord(string Provider, string EventType, string Detail, DateTimeOffset EventUtc);

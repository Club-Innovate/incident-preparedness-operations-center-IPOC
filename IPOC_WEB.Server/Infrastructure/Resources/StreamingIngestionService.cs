using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IPOC_WEB.Server.Infrastructure.Resources;

public interface IStreamingIngestionControlService
{
    Task<StreamingIngestionStatusDto> GetStatusAsync(CancellationToken cancellationToken);
    Task StartIngestionAsync(StartStreamingIngestionRequestDto? request, CancellationToken cancellationToken);
    Task StopIngestionAsync(CancellationToken cancellationToken);
    Task<string> SaveStreamPayloadFileAsync(string fileName, string payloadJson, CancellationToken cancellationToken);
}

public sealed class StreamingIngestionHostedService : BackgroundService, IStreamingIngestionControlService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly ILogger<StreamingIngestionHostedService> _logger;

    private readonly object _gate = new();
    private bool _isRunning;
    private string _streamDirectory;
    private int _pollIntervalSeconds;
    private bool _fileWatcherEnabled;
    private string _defaultSourceSystemCode;
    private DateTimeOffset? _lastStartedUtc;
    private DateTimeOffset? _lastScanUtc;
    private string? _lastError;
    private int _processedFileCount;
    private int _failedFileCount;
    private bool _scanRequested;
    private DateTimeOffset _nextPollUtc;
    private FileSystemWatcher? _watcher;

    public StreamingIngestionHostedService(IConfiguration configuration, IServiceScopeFactory serviceScopeFactory, ILogger<StreamingIngestionHostedService> logger)
    {
        _serviceScopeFactory = serviceScopeFactory;
        _logger = logger;

        var configuredDirectory = configuration["StreamingIngestion:Directory"];
        _streamDirectory = string.IsNullOrWhiteSpace(configuredDirectory)
            ? Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data", "Integration-Samples"))
            : configuredDirectory.Trim();

        var configuredPoll = configuration.GetValue("StreamingIngestion:PollIntervalSeconds", 15);
        _pollIntervalSeconds = Math.Clamp(configuredPoll, 5, 300);
        _fileWatcherEnabled = configuration.GetValue("StreamingIngestion:EnableFileWatcher", true);
        _defaultSourceSystemCode = configuration["StreamingIngestion:DefaultSourceSystemCode"] ?? "SIM_STREAM";

        _nextPollUtc = DateTimeOffset.UtcNow;
    }

    public Task<StreamingIngestionStatusDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_gate)
        {
            var pendingFiles = Directory.Exists(_streamDirectory)
                ? Directory.GetFiles(_streamDirectory, "*.json", SearchOption.TopDirectoryOnly).Length
                : 0;

            return Task.FromResult(new StreamingIngestionStatusDto(
                _isRunning,
                _streamDirectory,
                _pollIntervalSeconds,
                _fileWatcherEnabled,
                _defaultSourceSystemCode,
                pendingFiles,
                _processedFileCount,
                _failedFileCount,
                _lastStartedUtc,
                _lastScanUtc,
                _lastError));
        }
    }

    public Task StartIngestionAsync(StartStreamingIngestionRequestDto? request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        lock (_gate)
        {
            if (request is not null)
            {
                if (!string.IsNullOrWhiteSpace(request.StreamDirectory))
                {
                    _streamDirectory = request.StreamDirectory.Trim();
                }

                if (request.PollIntervalSeconds.HasValue)
                {
                    _pollIntervalSeconds = Math.Clamp(request.PollIntervalSeconds.Value, 5, 300);
                }

                if (request.EnableFileWatcher.HasValue)
                {
                    _fileWatcherEnabled = request.EnableFileWatcher.Value;
                }

                if (!string.IsNullOrWhiteSpace(request.DefaultSourceSystemCode))
                {
                    _defaultSourceSystemCode = request.DefaultSourceSystemCode.Trim();
                }
            }

            _isRunning = true;
            _lastStartedUtc = DateTimeOffset.UtcNow;
            _scanRequested = true;
            _nextPollUtc = DateTimeOffset.UtcNow;
            _lastError = null;
            EnsureDirectories();
            ConfigureWatcherUnsafe();
        }

        _logger.LogInformation("Streaming ingestion started. Directory={Directory}; PollIntervalSeconds={PollIntervalSeconds}; FileWatcher={FileWatcherEnabled}; DefaultSourceSystem={DefaultSourceSystemCode}",
            _streamDirectory,
            _pollIntervalSeconds,
            _fileWatcherEnabled,
            _defaultSourceSystemCode);

        return Task.CompletedTask;
    }

    public Task<string> SaveStreamPayloadFileAsync(string fileName, string payloadJson, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var safeName = string.IsNullOrWhiteSpace(fileName)
            ? $"stream-{DateTime.UtcNow:yyyyMMddHHmmssfff}.json"
            : Path.GetFileName(fileName.Trim());

        if (!safeName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
        {
            safeName = $"{safeName}.json";
        }

        EnsureDirectories();

        string fullPath;
        lock (_gate)
        {
            fullPath = Path.Combine(_streamDirectory, safeName);
            _scanRequested = true;
        }

        File.WriteAllText(fullPath, payloadJson);
        return Task.FromResult(fullPath);
    }

    public Task StopIngestionAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        lock (_gate)
        {
            _isRunning = false;
            _scanRequested = false;
            DisposeWatcherUnsafe();
        }

        _logger.LogInformation("Streaming ingestion stopped.");
        return Task.CompletedTask;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var shouldProcess = false;

            lock (_gate)
            {
                if (_isRunning)
                {
                    var nowUtc = DateTimeOffset.UtcNow;
                    shouldProcess = _scanRequested || nowUtc >= _nextPollUtc;
                    if (shouldProcess)
                    {
                        _scanRequested = false;
                        _nextPollUtc = nowUtc.AddSeconds(_pollIntervalSeconds);
                    }
                }
            }

            if (shouldProcess)
            {
                try
                {
                    await ProcessAvailableFilesAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    lock (_gate)
                    {
                        _lastError = ex.Message;
                    }

                    _logger.LogError(ex, "Streaming ingestion polling cycle failed.");
                }
            }

            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            DisposeWatcherUnsafe();
            _isRunning = false;
        }

        return base.StopAsync(cancellationToken);
    }

    private async Task ProcessAvailableFilesAsync(CancellationToken cancellationToken)
    {
        string directory;
        string defaultSourceSystemCode;

        lock (_gate)
        {
            directory = _streamDirectory;
            defaultSourceSystemCode = _defaultSourceSystemCode;
            _lastScanUtc = DateTimeOffset.UtcNow;
        }

        EnsureDirectories();
        EnsureSamplePayloadExists(defaultSourceSystemCode);

        var files = Directory.GetFiles(directory, "*.json", SearchOption.TopDirectoryOnly)
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        foreach (var file in files)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                await ProcessFileAsync(file, defaultSourceSystemCode, cancellationToken);
                MoveToSubdirectory(file, "processed");

                lock (_gate)
                {
                    _processedFileCount++;
                    _lastError = null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed processing streaming payload file {FilePath}.", file);

                lock (_gate)
                {
                    _failedFileCount++;
                    _lastError = ex.Message;
                }

                TryMoveToSubdirectory(file, "failed");
            }
        }
    }

    private async Task ProcessFileAsync(string filePath, string defaultSourceSystemCode, CancellationToken cancellationToken)
    {
        await using var stream = File.OpenRead(filePath);
        var payload = await JsonSerializer.DeserializeAsync<StreamPayloadDto>(stream, JsonOptions, cancellationToken);
        if (payload is null)
        {
            throw new InvalidOperationException($"Unable to deserialize stream payload: {filePath}");
        }

        using var scope = _serviceScopeFactory.CreateScope();
        var resourceQueryService = scope.ServiceProvider.GetRequiredService<IResourceQueryService>();

        if (payload.InventoryBatch?.Rows?.Count > 0)
        {
            var normalizedInventory = NormalizeInventoryBatch(payload.InventoryBatch, defaultSourceSystemCode);

            var duplicate = await resourceQueryService.IsInboundMessageAlreadyProcessedAsync(
                normalizedInventory.SourceSystemCode,
                normalizedInventory.SourceMessageId,
                "RESOURCE_STATUS",
                cancellationToken);

            if (!duplicate)
            {
                var result = await resourceQueryService.ImportResourceInventoryBatchAsync(normalizedInventory, cancellationToken);
                await resourceQueryService.RecordInboundMessageAsync(
                    normalizedInventory.SourceSystemCode,
                    normalizedInventory.SourceMessageId,
                    "RESOURCE_STATUS",
                    result.FailedRows == 0 ? "Processed" : "Error",
                    JsonSerializer.Serialize(normalizedInventory, JsonOptions),
                    result.FailedRows == 0 ? null : $"{result.FailedRows} rows failed.",
                    cancellationToken);
            }
        }

        if (payload.BedBatch?.Rows?.Count > 0)
        {
            var normalizedBeds = NormalizeBedBatch(payload.BedBatch, defaultSourceSystemCode);

            var duplicate = await resourceQueryService.IsInboundMessageAlreadyProcessedAsync(
                normalizedBeds.SourceSystemCode,
                normalizedBeds.SourceMessageId,
                "BED_AVAILABILITY",
                cancellationToken);

            if (!duplicate)
            {
                var result = await resourceQueryService.ImportBedAvailabilityBatchAsync(normalizedBeds, cancellationToken);
                await resourceQueryService.RecordInboundMessageAsync(
                    normalizedBeds.SourceSystemCode,
                    normalizedBeds.SourceMessageId,
                    "BED_AVAILABILITY",
                    result.FailedRows == 0 ? "Processed" : "Error",
                    JsonSerializer.Serialize(normalizedBeds, JsonOptions),
                    result.FailedRows == 0 ? null : $"{result.FailedRows} rows failed.",
                    cancellationToken);
            }
        }
    }

    private ResourceInventoryImportBatchRequestDto NormalizeInventoryBatch(ResourceInventoryImportBatchRequestDto batch, string defaultSourceSystemCode)
    {
        var sourceSystemCode = string.IsNullOrWhiteSpace(batch.SourceSystemCode)
            ? defaultSourceSystemCode
            : batch.SourceSystemCode.Trim();

        var sourceMessageId = string.IsNullOrWhiteSpace(batch.SourceMessageId)
            ? null
            : batch.SourceMessageId.Trim();

        return new ResourceInventoryImportBatchRequestDto(sourceSystemCode, sourceMessageId, batch.Rows);
    }

    private BedAvailabilityImportBatchRequestDto NormalizeBedBatch(BedAvailabilityImportBatchRequestDto batch, string defaultSourceSystemCode)
    {
        var sourceSystemCode = string.IsNullOrWhiteSpace(batch.SourceSystemCode)
            ? defaultSourceSystemCode
            : batch.SourceSystemCode.Trim();

        var sourceMessageId = string.IsNullOrWhiteSpace(batch.SourceMessageId)
            ? null
            : batch.SourceMessageId.Trim();

        return new BedAvailabilityImportBatchRequestDto(sourceSystemCode, sourceMessageId, batch.Rows);
    }

    private void EnsureDirectories()
    {
        var directory = _streamDirectory;
        if (!Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var processedPath = Path.Combine(directory, "processed");
        if (!Directory.Exists(processedPath))
        {
            Directory.CreateDirectory(processedPath);
        }

        var failedPath = Path.Combine(directory, "failed");
        if (!Directory.Exists(failedPath))
        {
            Directory.CreateDirectory(failedPath);
        }
    }

    private void EnsureSamplePayloadExists(string defaultSourceSystemCode)
    {
        var sampleFilePath = Path.Combine(_streamDirectory, "sample-stream-resource-beds.json");
        if (File.Exists(sampleFilePath))
        {
            return;
        }

        var payload = new StreamPayloadDto(
            new ResourceInventoryImportBatchRequestDto(
                defaultSourceSystemCode,
                $"stream-{DateTime.UtcNow:yyyyMMddHHmmss}-inv",
                [
                    new ResourceInventoryImportRowDto(101, "VENT", 40, 16, 22, 2, DateTimeOffset.UtcNow)
                ]),
            new BedAvailabilityImportBatchRequestDto(
                defaultSourceSystemCode,
                $"stream-{DateTime.UtcNow:yyyyMMddHHmmss}-bed",
                [
                    new BedAvailabilityImportRowDto(101, "ICU", 42, 6, 32, 4, 12, 8, DateTimeOffset.UtcNow)
                ]));

        File.WriteAllText(sampleFilePath, JsonSerializer.Serialize(payload, JsonOptions));
    }

    private void ConfigureWatcherUnsafe()
    {
        DisposeWatcherUnsafe();

        if (!_isRunning || !_fileWatcherEnabled)
        {
            return;
        }

        _watcher = new FileSystemWatcher(_streamDirectory, "*.json")
        {
            IncludeSubdirectories = false,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.CreationTime | NotifyFilters.LastWrite,
            EnableRaisingEvents = true,
        };

        _watcher.Created += OnWatcherChange;
        _watcher.Changed += OnWatcherChange;
        _watcher.Renamed += OnWatcherRename;
    }

    private void OnWatcherChange(object sender, FileSystemEventArgs e)
    {
        if (e.ChangeType is WatcherChangeTypes.Created or WatcherChangeTypes.Changed)
        {
            lock (_gate)
            {
                _scanRequested = true;
            }
        }
    }

    private void OnWatcherRename(object sender, RenamedEventArgs e)
    {
        lock (_gate)
        {
            _scanRequested = true;
        }
    }

    private void DisposeWatcherUnsafe()
    {
        if (_watcher is null)
        {
            return;
        }

        _watcher.Created -= OnWatcherChange;
        _watcher.Changed -= OnWatcherChange;
        _watcher.Renamed -= OnWatcherRename;
        _watcher.Dispose();
        _watcher = null;
    }

    private void MoveToSubdirectory(string filePath, string subdirectory)
    {
        var directory = Path.GetDirectoryName(filePath) ?? _streamDirectory;
        var destinationDirectory = Path.Combine(directory, subdirectory);
        if (!Directory.Exists(destinationDirectory))
        {
            Directory.CreateDirectory(destinationDirectory);
        }

        var destination = Path.Combine(destinationDirectory, BuildDestinationFileName(filePath));
        File.Move(filePath, destination, overwrite: true);
    }

    private void TryMoveToSubdirectory(string filePath, string subdirectory)
    {
        try
        {
            if (File.Exists(filePath))
            {
                MoveToSubdirectory(filePath, subdirectory);
            }
        }
        catch
        {
            // no-op best effort move for failed payloads
        }
    }

    private static string BuildDestinationFileName(string sourcePath)
    {
        var name = Path.GetFileNameWithoutExtension(sourcePath);
        var extension = Path.GetExtension(sourcePath);
        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmssfff");
        return $"{name}-{timestamp}{extension}";
    }

    private sealed record StreamPayloadDto(
        ResourceInventoryImportBatchRequestDto? InventoryBatch,
        BedAvailabilityImportBatchRequestDto? BedBatch);
}

using System.Data;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(args);

var streamDirectory = Environment.GetEnvironmentVariable("IOCEM_STREAM_DIRECTORY")
    ?? Path.Combine(AppContext.BaseDirectory, "sample-stream");

var sampleFilePath = Path.Combine(streamDirectory, "sample-stream-resource-beds.json");

builder.Services.AddHttpClient("iocem-api", client =>
{
    client.BaseAddress = new Uri(Environment.GetEnvironmentVariable("IOCEM_API_BASE") ?? "https://localhost:7435");
});

builder.Services.AddSingleton(new StreamingIngestorOptions
(
    Mode: Environment.GetEnvironmentVariable("IOCEM_STREAM_MODE") ?? "api",
    DirectoryPath: streamDirectory,
    SampleFilePath: sampleFilePath,
    ApiBaseUrl: Environment.GetEnvironmentVariable("IOCEM_API_BASE") ?? "https://localhost:7435",
    SqlConnectionString: Environment.GetEnvironmentVariable("IOCEM_DB_CONNECTION")
));

builder.Services.AddHostedService<StreamingWorker>();

await builder.Build().RunAsync();

public sealed class StreamingWorker : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly StreamingIngestorOptions _options;
    private readonly ILogger<StreamingWorker> _logger;

    public StreamingWorker(IHttpClientFactory httpClientFactory, StreamingIngestorOptions options, ILogger<StreamingWorker> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        EnsureSamplePayloadExists(_options.SampleFilePath);
        EnsureLegacySampleCopy(_options.SampleFilePath);

        if (!Directory.Exists(_options.DirectoryPath))
        {
            Directory.CreateDirectory(_options.DirectoryPath);
        }

        var files = Directory.GetFiles(_options.DirectoryPath, "*.json", SearchOption.TopDirectoryOnly)
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (files.Length == 0)
        {
            _logger.LogWarning("No stream payload files found in {DirectoryPath}. Worker idle.", _options.DirectoryPath);
            return;
        }

        _logger.LogInformation("Streaming worker started in '{Mode}' mode. Processing {FileCount} payload file(s) from {DirectoryPath}.",
            _options.Mode,
            files.Length,
            _options.DirectoryPath);

        foreach (var file in files)
        {
            if (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            try
            {
                await using var stream = File.OpenRead(file);
                var payload = await JsonSerializer.DeserializeAsync<StreamPayload>(stream, JsonOptions, stoppingToken);
                if (payload is null)
                {
                    _logger.LogWarning("Unable to deserialize stream payload file {File}.", file);
                    continue;
                }

                if (string.Equals(_options.Mode, "db", StringComparison.OrdinalIgnoreCase))
                {
                    await ProcessDirectToDatabaseAsync(payload, file, stoppingToken);
                }
                else
                {
                    await ProcessViaApiAsync(payload, file, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed processing stream payload file {File}.", file);
            }
        }
    }

    private async Task ProcessViaApiAsync(StreamPayload payload, string sourcePath, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("iocem-api");

        var inventoryResponse = await client.PostAsJsonAsync("/api/v1/resources/import/inventory", payload.InventoryBatch, cancellationToken);
        var bedsResponse = await client.PostAsJsonAsync("/api/v1/beds/import/availability", payload.BedBatch, cancellationToken);

        _logger.LogInformation("API ingest complete for {SourcePath}. Inventory={InventoryStatus} Beds={BedsStatus}",
            sourcePath,
            (int)inventoryResponse.StatusCode,
            (int)bedsResponse.StatusCode);
    }

    private async Task ProcessDirectToDatabaseAsync(StreamPayload payload, string sourcePath, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.SqlConnectionString))
        {
            throw new InvalidOperationException("IOCEM_DB_CONNECTION is required when IOCEM_STREAM_MODE=db.");
        }

        await using var connection = new SqlConnection(_options.SqlConnectionString);
        await connection.OpenAsync(cancellationToken);

        var inventorySourceMessageId = payload.InventoryBatch.SourceMessageId;
        var bedSourceMessageId = payload.BedBatch.SourceMessageId;

        var inventoryAlreadyProcessed = await IsInboundAlreadyProcessedAsync(connection, payload.InventoryBatch.SourceSystemCode, inventorySourceMessageId, "ResourceInventory", cancellationToken);
        if (!inventoryAlreadyProcessed)
        {
            var inventoryResult = await ImportInventoryRowsAsync(connection, payload.InventoryBatch, cancellationToken);
            await RecordInboundAsync(connection, payload.InventoryBatch.SourceSystemCode, inventorySourceMessageId, "ResourceInventory", "Processed", JsonSerializer.Serialize(payload.InventoryBatch, JsonOptions), null, cancellationToken);
            _logger.LogInformation("DB inventory ingest complete for {SourcePath}. Succeeded={Succeeded} Failed={Failed}", sourcePath, inventoryResult.succeeded, inventoryResult.failed);
        }
        else
        {
            _logger.LogInformation("Skipped duplicate DB inventory ingest for {SourcePath}. SourceMessageId={SourceMessageId}", sourcePath, inventorySourceMessageId);
        }

        var bedsAlreadyProcessed = await IsInboundAlreadyProcessedAsync(connection, payload.BedBatch.SourceSystemCode, bedSourceMessageId, "BedAvailability", cancellationToken);
        if (!bedsAlreadyProcessed)
        {
            var bedsResult = await ImportBedRowsAsync(connection, payload.BedBatch, cancellationToken);
            await RecordInboundAsync(connection, payload.BedBatch.SourceSystemCode, bedSourceMessageId, "BedAvailability", "Processed", JsonSerializer.Serialize(payload.BedBatch, JsonOptions), null, cancellationToken);
            _logger.LogInformation("DB bed ingest complete for {SourcePath}. Succeeded={Succeeded} Failed={Failed}", sourcePath, bedsResult.succeeded, bedsResult.failed);
        }
        else
        {
            _logger.LogInformation("Skipped duplicate DB bed ingest for {SourcePath}. SourceMessageId={SourceMessageId}", sourcePath, bedSourceMessageId);
        }
    }

    private static void EnsureSamplePayloadExists(string sampleFilePath)
    {
        var directory = Path.GetDirectoryName(sampleFilePath);
        if (!string.IsNullOrWhiteSpace(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        if (File.Exists(sampleFilePath))
        {
            return;
        }

        var samplePayload = new StreamPayload(
            new ResourceInventoryImportBatch(
                SourceSystemCode: "SIM_STREAM",
                SourceMessageId: $"stream-{DateTime.UtcNow:yyyyMMddHHmmss}-inv",
                Rows:
                [
                    new ResourceInventoryImportRow(
                        LocationId: 101,
                        ResourceTypeCode: "VENT",
                        QuantityTotal: 40,
                        QuantityAvailable: 16,
                        QuantityCommitted: 22,
                        QuantityOutOfService: 2,
                        ReportedUtc: DateTimeOffset.UtcNow)
                ]),
            new BedAvailabilityImportBatch(
                SourceSystemCode: "SIM_STREAM",
                SourceMessageId: $"stream-{DateTime.UtcNow:yyyyMMddHHmmss}-bed",
                Rows:
                [
                    new BedAvailabilityImportRow(
                        LocationId: 101,
                        BedCategoryCode: "ICU",
                        StaffedBedsTotal: 42,
                        BedsAvailable: 6,
                        BedsOccupied: 32,
                        BedsUnavailable: 4,
                        IsolationCapableBeds: 12,
                        SurgeBedsPotential: 8,
                        ReportedUtc: DateTimeOffset.UtcNow)
                ]));

        File.WriteAllText(sampleFilePath, JsonSerializer.Serialize(samplePayload, JsonOptions));
    }

    private static void EnsureLegacySampleCopy(string sampleFilePath)
    {
        var legacyPath = Path.Combine(AppContext.BaseDirectory, "sample-stream-resource-beds.json");
        if (string.Equals(legacyPath, sampleFilePath, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (!File.Exists(legacyPath) && File.Exists(sampleFilePath))
        {
            File.Copy(sampleFilePath, legacyPath);
        }
    }

    private static async Task<bool> IsInboundAlreadyProcessedAsync(SqlConnection connection, string sourceSystemCode, string? sourceMessageId, string interfaceTypeCode, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sourceMessageId))
        {
            return false;
        }

        const string sql = """
            SELECT TOP (1) 1
            FROM intg.InboundInterfaceMessage
            WHERE SourceSystemCode = @sourceSystemCode
              AND SourceMessageId = @sourceMessageId
              AND InterfaceTypeCode = @interfaceTypeCode
              AND ProcessingStatusCode IN ('Processed', 'Reconciled');
            """;

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30
        };

        command.Parameters.Add(new SqlParameter("@sourceSystemCode", SqlDbType.NVarChar, 80) { Value = sourceSystemCode.Trim() });
        command.Parameters.Add(new SqlParameter("@sourceMessageId", SqlDbType.NVarChar, 200) { Value = sourceMessageId.Trim() });
        command.Parameters.Add(new SqlParameter("@interfaceTypeCode", SqlDbType.NVarChar, 80) { Value = interfaceTypeCode.Trim() });

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is not null;
    }

    private static async Task RecordInboundAsync(SqlConnection connection, string sourceSystemCode, string? sourceMessageId, string interfaceTypeCode, string statusCode, string payloadJson, string? errorMessage, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO intg.InboundInterfaceMessage
            (
                SourceSystemCode,
                SourceMessageId,
                InterfaceTypeCode,
                ProcessingStatusCode,
                PayloadJson,
                ErrorMessage
            )
            VALUES
            (
                @sourceSystemCode,
                @sourceMessageId,
                @interfaceTypeCode,
                @processingStatusCode,
                @payloadJson,
                @errorMessage
            );
            """;

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30
        };

        command.Parameters.Add(new SqlParameter("@sourceSystemCode", SqlDbType.NVarChar, 80) { Value = sourceSystemCode.Trim() });
        command.Parameters.Add(new SqlParameter("@sourceMessageId", SqlDbType.NVarChar, 200) { Value = (object?)sourceMessageId?.Trim() ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@interfaceTypeCode", SqlDbType.NVarChar, 80) { Value = interfaceTypeCode.Trim() });
        command.Parameters.Add(new SqlParameter("@processingStatusCode", SqlDbType.NVarChar, 40) { Value = statusCode.Trim() });
        command.Parameters.Add(new SqlParameter("@payloadJson", SqlDbType.NVarChar, -1) { Value = payloadJson });
        command.Parameters.Add(new SqlParameter("@errorMessage", SqlDbType.NVarChar, -1) { Value = (object?)errorMessage ?? DBNull.Value });

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<(int succeeded, int failed)> ImportInventoryRowsAsync(SqlConnection connection, ResourceInventoryImportBatch batch, CancellationToken cancellationToken)
    {
        const string sql = """
            DECLARE @resourceTypeId int;
            SELECT @resourceTypeId = rt.ResourceTypeId
            FROM res.ResourceType rt
            WHERE rt.ResourceTypeCode = @resourceTypeCode;

            IF @resourceTypeId IS NULL
            BEGIN
                SELECT CAST(0 AS int);
                RETURN;
            END

            IF EXISTS (
                SELECT 1
                FROM res.LocationResourceInventory lri
                WHERE lri.LocationId = @locationId
                  AND lri.ResourceTypeId = @resourceTypeId
            )
            BEGIN
                UPDATE res.LocationResourceInventory
                SET QuantityTotal = @quantityTotal,
                    QuantityAvailable = @quantityAvailable,
                    QuantityCommitted = @quantityCommitted,
                    QuantityOutOfService = @quantityOutOfService,
                    LastReportedUtc = COALESCE(@reportedUtc, SYSUTCDATETIME())
                WHERE LocationId = @locationId
                  AND ResourceTypeId = @resourceTypeId;

                SELECT CAST(1 AS int);
                RETURN;
            END

            INSERT INTO res.LocationResourceInventory
            (
                LocationId,
                ResourceTypeId,
                QuantityTotal,
                QuantityAvailable,
                QuantityCommitted,
                QuantityOutOfService,
                LastReportedUtc
            )
            VALUES
            (
                @locationId,
                @resourceTypeId,
                @quantityTotal,
                @quantityAvailable,
                @quantityCommitted,
                @quantityOutOfService,
                COALESCE(@reportedUtc, SYSUTCDATETIME())
            );

            SELECT CAST(1 AS int);
            """;

        var succeeded = 0;
        var failed = 0;

        foreach (var row in batch.Rows)
        {
            try
            {
                await using var command = new SqlCommand(sql, connection)
                {
                    CommandType = CommandType.Text,
                    CommandTimeout = 30
                };

                command.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = row.LocationId });
                command.Parameters.Add(new SqlParameter("@resourceTypeCode", SqlDbType.NVarChar, 80) { Value = row.ResourceTypeCode.Trim() });
                command.Parameters.Add(new SqlParameter("@quantityTotal", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = row.QuantityTotal });
                command.Parameters.Add(new SqlParameter("@quantityAvailable", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = row.QuantityAvailable });
                command.Parameters.Add(new SqlParameter("@quantityCommitted", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = row.QuantityCommitted });
                command.Parameters.Add(new SqlParameter("@quantityOutOfService", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = row.QuantityOutOfService });
                command.Parameters.Add(new SqlParameter("@reportedUtc", SqlDbType.DateTime2) { Value = row.ReportedUtc.HasValue ? row.ReportedUtc.Value.UtcDateTime : DBNull.Value });

                var result = await command.ExecuteScalarAsync(cancellationToken);
                var success = result is int intValue && intValue == 1;
                if (success)
                {
                    succeeded++;
                }
                else
                {
                    failed++;
                }
            }
            catch
            {
                failed++;
            }
        }

        return (succeeded, failed);
    }

    private static async Task<(int succeeded, int failed)> ImportBedRowsAsync(SqlConnection connection, BedAvailabilityImportBatch batch, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO res.BedAvailabilitySnapshot
            (
                LocationId,
                BedCategoryCode,
                StaffedBedsTotal,
                BedsAvailable,
                BedsOccupied,
                BedsUnavailable,
                IsolationCapableBeds,
                SurgeBedsPotential,
                ReportedUtc,
                SourceSystemCode,
                SourceMessageId
            )
            VALUES
            (
                @locationId,
                @bedCategoryCode,
                @staffedBedsTotal,
                @bedsAvailable,
                @bedsOccupied,
                @bedsUnavailable,
                @isolationCapableBeds,
                @surgeBedsPotential,
                COALESCE(@reportedUtc, SYSUTCDATETIME()),
                @sourceSystemCode,
                @sourceMessageId
            );
            """;

        var succeeded = 0;
        var failed = 0;

        foreach (var row in batch.Rows)
        {
            try
            {
                await using var command = new SqlCommand(sql, connection)
                {
                    CommandType = CommandType.Text,
                    CommandTimeout = 30
                };

                command.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = row.LocationId });
                command.Parameters.Add(new SqlParameter("@bedCategoryCode", SqlDbType.NVarChar, 80) { Value = row.BedCategoryCode.Trim() });
                command.Parameters.Add(new SqlParameter("@staffedBedsTotal", SqlDbType.Int) { Value = (object?)row.StaffedBedsTotal ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@bedsAvailable", SqlDbType.Int) { Value = (object?)row.BedsAvailable ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@bedsOccupied", SqlDbType.Int) { Value = (object?)row.BedsOccupied ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@bedsUnavailable", SqlDbType.Int) { Value = (object?)row.BedsUnavailable ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@isolationCapableBeds", SqlDbType.Int) { Value = (object?)row.IsolationCapableBeds ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@surgeBedsPotential", SqlDbType.Int) { Value = (object?)row.SurgeBedsPotential ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@reportedUtc", SqlDbType.DateTime2) { Value = row.ReportedUtc.HasValue ? row.ReportedUtc.Value.UtcDateTime : DBNull.Value });
                command.Parameters.Add(new SqlParameter("@sourceSystemCode", SqlDbType.NVarChar, 80) { Value = batch.SourceSystemCode.Trim() });
                command.Parameters.Add(new SqlParameter("@sourceMessageId", SqlDbType.NVarChar, 200) { Value = (object?)batch.SourceMessageId ?? DBNull.Value });

                await command.ExecuteNonQueryAsync(cancellationToken);
                succeeded++;
            }
            catch
            {
                failed++;
            }
        }

        return (succeeded, failed);
    }
}

public sealed record StreamingIngestorOptions(
    string Mode,
    string DirectoryPath,
    string SampleFilePath,
    string ApiBaseUrl,
    string? SqlConnectionString);

public sealed record StreamPayload(
    ResourceInventoryImportBatch InventoryBatch,
    BedAvailabilityImportBatch BedBatch);

public sealed record ResourceInventoryImportBatch(
    string SourceSystemCode,
    string? SourceMessageId,
    IReadOnlyList<ResourceInventoryImportRow> Rows);

public sealed record ResourceInventoryImportRow(
    long LocationId,
    string ResourceTypeCode,
    decimal QuantityTotal,
    decimal QuantityAvailable,
    decimal QuantityCommitted,
    decimal QuantityOutOfService,
    DateTimeOffset? ReportedUtc);

public sealed record BedAvailabilityImportBatch(
    string SourceSystemCode,
    string? SourceMessageId,
    IReadOnlyList<BedAvailabilityImportRow> Rows);

public sealed record BedAvailabilityImportRow(
    long LocationId,
    string BedCategoryCode,
    int? StaffedBedsTotal,
    int? BedsAvailable,
    int? BedsOccupied,
    int? BedsUnavailable,
    int? IsolationCapableBeds,
    int? SurgeBedsPotential,
    DateTimeOffset? ReportedUtc);

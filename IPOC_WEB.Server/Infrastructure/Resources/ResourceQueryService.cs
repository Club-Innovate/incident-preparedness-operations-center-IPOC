/*
File: IPOC_WEB.Server/Infrastructure/Resources/ResourceQueryService.cs
Blueprint Name: ResourceDataAccess

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-06-22

Description:
Resource and bed data-access service for inventory and availability operations.

Features:
  - Inventory and bed snapshot retrieval.
  - Resource quantity update command handling.
  - Bed availability snapshot insert command handling.

Security & Compliance:
  - Uses parameterized SQL and typed parameters for safer data operations.
  - Restricts writes to defined operational command paths.
  - Supports auditable operational posture updates.
*/

using System.Data;
using System.Globalization;
using System.Text.Json;
using IPOC_WEB.Server.Infrastructure.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IPOC_WEB.Server.Infrastructure.Resources;

public interface IResourceQueryService
{
    Task<IReadOnlyList<ResourceInventoryDto>> GetResourceInventoryAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<BedAvailabilityDto>> GetBedAvailabilityAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<ResourceRegionalRollupDto>> GetResourceRegionalRollupsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<ResourceRegionalRollupDto>> GetResourceRegionalRollupsAsync(ResourceRegionalRollupFilterDto filter, CancellationToken cancellationToken);
    Task<ResourceRegionalRollupSnapshotDto> GetResourceRegionalRollupSnapshotAsync(CancellationToken cancellationToken);
    Task<ResourceRegionalRollupSnapshotDto> GetResourceRegionalRollupSnapshotAsync(ResourceRegionalRollupFilterDto filter, CancellationToken cancellationToken);
    Task<bool> UpdateResourceInventoryAsync(long locationResourceInventoryId, UpdateResourceInventoryRequestDto request, CancellationToken cancellationToken);
    Task<bool> AddBedAvailabilitySnapshotAsync(long locationId, UpdateBedAvailabilityRequestDto request, CancellationToken cancellationToken);
    Task<IReadOnlyList<UserReportPresetDto>> GetUserReportPresetsAsync(long userId, string presetScope, CancellationToken cancellationToken);
    Task<long> UpsertUserReportPresetAsync(long userId, string presetScope, UpsertUserReportPresetRequestDto request, CancellationToken cancellationToken);
    Task<string?> GetGlobalReportPresetJsonAsync(string presetScope, string presetName, CancellationToken cancellationToken);
    Task<long> UpsertGlobalReportPresetAsync(long userId, string presetScope, UpsertUserReportPresetRequestDto request, CancellationToken cancellationToken);
    Task<bool> DeleteUserReportPresetAsync(long userId, string presetScope, long userReportPresetId, CancellationToken cancellationToken);
    Task<ImportBatchResultDto> ImportResourceInventoryBatchAsync(ResourceInventoryImportBatchRequestDto request, CancellationToken cancellationToken);
    Task<ImportBatchResultDto> ImportBedAvailabilityBatchAsync(BedAvailabilityImportBatchRequestDto request, CancellationToken cancellationToken);
    Task<bool> IsInboundMessageAlreadyProcessedAsync(string sourceSystemCode, string? sourceMessageId, string interfaceTypeCode, CancellationToken cancellationToken);
    Task RecordInboundMessageAsync(string sourceSystemCode, string? sourceMessageId, string interfaceTypeCode, string processingStatusCode, string payloadJson, string? errorMessage, CancellationToken cancellationToken);
}

public sealed class ResourceQueryService : IResourceQueryService
{
    private readonly string _connectionString;
    private readonly ILogger<ResourceQueryService> _logger;
    private readonly bool _degradedReadFallbackEnabled;

    private static DateTimeOffset ReadDateTimeOffset(SqlDataReader reader, int ordinal)
    {
        var rawValue = reader.GetValue(ordinal);

        return rawValue switch
        {
            DateTimeOffset dto => dto,
            DateTime dt => new DateTimeOffset(DateTime.SpecifyKind(dt, DateTimeKind.Utc)),
            _ => throw new InvalidCastException($"Column ordinal {ordinal} cannot be converted to DateTimeOffset.")
        };
    }

    private static DateTimeOffset? ReadNullableDateTimeOffset(SqlDataReader reader, int ordinal)
    {
        return reader.IsDBNull(ordinal) ? null : ReadDateTimeOffset(reader, ordinal);
    }

    public ResourceQueryService(IConfiguration configuration, IHostEnvironment hostEnvironment, IOptions<SqlDataOptions> sqlOptions, ILogger<ResourceQueryService> logger)
    {
        _logger = logger;

        var configuredConnectionName = sqlOptions.Value.ConnectionStringName;
        _connectionString = configuration.GetConnectionString(configuredConnectionName)
            ?? throw new InvalidOperationException($"Connection string '{configuredConnectionName}' is not configured.");

        _degradedReadFallbackEnabled = hostEnvironment.IsDevelopment()
            && configuration.GetValue("SqlData:EnableDegradedReadFallback", true);
    }

    public async Task<IReadOnlyList<ResourceInventoryDto>> GetResourceInventoryAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (300)
                lri.LocationResourceInventoryId,
                lri.LocationId,
                l.LocationName,
                rt.ResourceTypeCode,
                rt.ResourceTypeName,
                lri.QuantityTotal,
                lri.QuantityAvailable,
                lri.QuantityCommitted,
                lri.QuantityOutOfService,
                lri.LastReportedUtc
            FROM res.LocationResourceInventory lri
            INNER JOIN org.Location l ON l.LocationId = lri.LocationId
            INNER JOIN res.ResourceType rt ON rt.ResourceTypeId = lri.ResourceTypeId
            ORDER BY lri.LastReportedUtc DESC, l.LocationName, rt.ResourceTypeName;
            """;

        var items = new List<ResourceInventoryDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new ResourceInventoryDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetString(4),
                    reader.GetDecimal(5),
                    reader.GetDecimal(6),
                    reader.GetDecimal(7),
                    reader.GetDecimal(8),
                    ReadNullableDateTimeOffset(reader, 9)));
            }

            _logger.LogInformation("Retrieved {ResourceCount} resource inventory records.", items.Count);
            return items;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving resource inventory. Returning empty resource inventory due to degraded read fallback.");
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving resource inventory.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving resource inventory.");
            throw;
        }
    }

    public async Task<IReadOnlyList<BedAvailabilityDto>> GetBedAvailabilityAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (300)
                bas.BedAvailabilitySnapshotId,
                bas.LocationId,
                l.LocationName,
                bas.BedCategoryCode,
                bas.StaffedBedsTotal,
                bas.BedsAvailable,
                bas.BedsOccupied,
                bas.BedsUnavailable,
                bas.IsolationCapableBeds,
                bas.SurgeBedsPotential,
                bas.ReportedUtc
            FROM res.BedAvailabilitySnapshot bas
            INNER JOIN org.Location l ON l.LocationId = bas.LocationId
            ORDER BY bas.ReportedUtc DESC, l.LocationName, bas.BedCategoryCode;
            """;

        var items = new List<BedAvailabilityDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new BedAvailabilityDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetInt32(4),
                    reader.IsDBNull(5) ? null : reader.GetInt32(5),
                    reader.IsDBNull(6) ? null : reader.GetInt32(6),
                    reader.IsDBNull(7) ? null : reader.GetInt32(7),
                    reader.IsDBNull(8) ? null : reader.GetInt32(8),
                    reader.IsDBNull(9) ? null : reader.GetInt32(9),
                    ReadDateTimeOffset(reader, 10)));
            }

            _logger.LogInformation("Retrieved {BedSnapshotCount} bed availability records.", items.Count);
            return items;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving bed availability records. Returning empty bed availability list due to degraded read fallback.");
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving bed availability records.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving bed availability records.");
            throw;
        }
    }

    public async Task<IReadOnlyList<ResourceRegionalRollupDto>> GetResourceRegionalRollupsAsync(CancellationToken cancellationToken)
    {
        return await GetResourceRegionalRollupsAsync(new ResourceRegionalRollupFilterDto(null, null), cancellationToken);
    }

    public async Task<IReadOnlyList<ResourceRegionalRollupDto>> GetResourceRegionalRollupsAsync(ResourceRegionalRollupFilterDto filter, CancellationToken cancellationToken)
    {
        const string sql = """
            WITH InventoryRollup AS
            (
                SELECT
                    l.RegionId,
                    COALESCE(r.RegionName, 'Unassigned') AS RegionName,
                    SUM(COALESCE(lri.QuantityAvailable, 0)) AS ResourceAvailable,
                    SUM(COALESCE(lri.QuantityCommitted, 0)) AS ResourceCommitted,
                    SUM(COALESCE(lri.QuantityOutOfService, 0)) AS ResourceOutOfService
                FROM res.LocationResourceInventory lri
                INNER JOIN org.Location l ON l.LocationId = lri.LocationId
                LEFT JOIN org.Region r ON r.RegionId = l.RegionId
                GROUP BY l.RegionId, COALESCE(r.RegionName, 'Unassigned')
            ),
            BedRollup AS
            (
                SELECT
                    l.RegionId,
                    COALESCE(r.RegionName, 'Unassigned') AS RegionName,
                    SUM(COALESCE(bas.BedsAvailable, 0)) AS BedsAvailable,
                    SUM(COALESCE(bas.BedsOccupied, 0)) AS BedsOccupied,
                    SUM(COALESCE(bas.BedsUnavailable, 0)) AS BedsUnavailable
                FROM res.BedAvailabilitySnapshot bas
                INNER JOIN org.Location l ON l.LocationId = bas.LocationId
                LEFT JOIN org.Region r ON r.RegionId = l.RegionId
                GROUP BY l.RegionId, COALESCE(r.RegionName, 'Unassigned')
            )
            SELECT
                COALESCE(i.RegionId, b.RegionId) AS RegionId,
                COALESCE(i.RegionName, b.RegionName) AS RegionName,
                COALESCE(i.ResourceAvailable, 0) AS ResourceAvailable,
                COALESCE(i.ResourceCommitted, 0) AS ResourceCommitted,
                COALESCE(i.ResourceOutOfService, 0) AS ResourceOutOfService,
                COALESCE(b.BedsAvailable, 0) AS BedsAvailable,
                COALESCE(b.BedsOccupied, 0) AS BedsOccupied,
                COALESCE(b.BedsUnavailable, 0) AS BedsUnavailable
            FROM InventoryRollup i
            FULL OUTER JOIN BedRollup b
                ON ISNULL(i.RegionId, -1) = ISNULL(b.RegionId, -1)
            WHERE
                (@regionId IS NULL OR COALESCE(i.RegionId, b.RegionId) = @regionId)
                AND (@regionName IS NULL OR COALESCE(i.RegionName, b.RegionName) LIKE @regionName)
            ORDER BY COALESCE(i.RegionName, b.RegionName);
            """;

        var items = new List<ResourceRegionalRollupDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };
            var normalizedRegionName = string.IsNullOrWhiteSpace(filter.RegionName) ? null : $"%{filter.RegionName.Trim()}%";
            command.Parameters.Add(new SqlParameter("@regionId", SqlDbType.Int) { Value = (object?)filter.RegionId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@regionName", SqlDbType.NVarChar, 200) { Value = (object?)normalizedRegionName ?? DBNull.Value });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new ResourceRegionalRollupDto(
                    reader.IsDBNull(0) ? null : reader.GetInt32(0),
                    reader.GetString(1),
                    reader.GetDecimal(2),
                    reader.GetDecimal(3),
                    reader.GetDecimal(4),
                    reader.GetInt64(5),
                    reader.GetInt64(6),
                    reader.GetInt64(7)));
            }

            _logger.LogInformation("Retrieved {RollupCount} regional resource rollup records.", items.Count);
            return items;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving regional resource rollups. Returning empty rollup list due to degraded read fallback.");
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving regional resource rollups.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving regional resource rollups.");
            throw;
        }
    }

    public async Task<ResourceRegionalRollupSnapshotDto> GetResourceRegionalRollupSnapshotAsync(CancellationToken cancellationToken)
    {
        return await GetResourceRegionalRollupSnapshotAsync(new ResourceRegionalRollupFilterDto(null, null), cancellationToken);
    }

    public async Task<ResourceRegionalRollupSnapshotDto> GetResourceRegionalRollupSnapshotAsync(ResourceRegionalRollupFilterDto filter, CancellationToken cancellationToken)
    {
        var regions = await GetResourceRegionalRollupsAsync(filter, cancellationToken);

        var statewideResourceAvailable = regions.Sum(item => item.ResourceAvailable);
        var statewideResourceCommitted = regions.Sum(item => item.ResourceCommitted);
        var statewideResourceOutOfService = regions.Sum(item => item.ResourceOutOfService);
        var statewideBedsAvailable = regions.Sum(item => item.BedsAvailable);
        var statewideBedsOccupied = regions.Sum(item => item.BedsOccupied);
        var statewideBedsUnavailable = regions.Sum(item => item.BedsUnavailable);

        return new ResourceRegionalRollupSnapshotDto(
            DateTimeOffset.UtcNow,
            statewideResourceAvailable,
            statewideResourceCommitted,
            statewideResourceOutOfService,
            statewideBedsAvailable,
            statewideBedsOccupied,
            statewideBedsUnavailable,
            regions);
    }

    public async Task<bool> UpdateResourceInventoryAsync(long locationResourceInventoryId, UpdateResourceInventoryRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE res.LocationResourceInventory
            SET QuantityTotal = COALESCE(@quantityTotal, QuantityTotal),
                QuantityAvailable = COALESCE(@quantityAvailable, QuantityAvailable),
                QuantityCommitted = COALESCE(@quantityCommitted, QuantityCommitted),
                QuantityOutOfService = COALESCE(@quantityOutOfService, QuantityOutOfService),
                LastReportedUtc = SYSUTCDATETIME()
            WHERE LocationResourceInventoryId = @locationResourceInventoryId;
            """;

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@locationResourceInventoryId", SqlDbType.BigInt) { Value = locationResourceInventoryId });
            command.Parameters.Add(new SqlParameter("@quantityTotal", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = (object?)request.QuantityTotal ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@quantityAvailable", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = (object?)request.QuantityAvailable ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@quantityCommitted", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = (object?)request.QuantityCommitted ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@quantityOutOfService", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = (object?)request.QuantityOutOfService ?? DBNull.Value });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Resource inventory update executed for LocationResourceInventoryId {LocationResourceInventoryId}. Rows affected: {RowsAffected}.", locationResourceInventoryId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while updating resource inventory for LocationResourceInventoryId {LocationResourceInventoryId}.", locationResourceInventoryId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while updating resource inventory for LocationResourceInventoryId {LocationResourceInventoryId}.", locationResourceInventoryId);
            throw;
        }
    }

    public async Task<bool> AddBedAvailabilitySnapshotAsync(long locationId, UpdateBedAvailabilityRequestDto request, CancellationToken cancellationToken)
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
                SourceSystemCode
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
                SYSUTCDATETIME(),
                'IPOC_WEB'
            );
            """;

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = locationId });
            command.Parameters.Add(new SqlParameter("@bedCategoryCode", SqlDbType.NVarChar, 80) { Value = "General" });
            command.Parameters.Add(new SqlParameter("@staffedBedsTotal", SqlDbType.Int) { Value = (object?)request.StaffedBedsTotal ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@bedsAvailable", SqlDbType.Int) { Value = (object?)request.BedsAvailable ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@bedsOccupied", SqlDbType.Int) { Value = (object?)request.BedsOccupied ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@bedsUnavailable", SqlDbType.Int) { Value = (object?)request.BedsUnavailable ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@isolationCapableBeds", SqlDbType.Int) { Value = (object?)request.IsolationCapableBeds ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@surgeBedsPotential", SqlDbType.Int) { Value = (object?)request.SurgeBedsPotential ?? DBNull.Value });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Bed availability snapshot insert executed for LocationId {LocationId}. Rows affected: {RowsAffected}.", locationId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while adding bed availability snapshot for LocationId {LocationId}.", locationId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while adding bed availability snapshot for LocationId {LocationId}.", locationId);
            throw;
        }
    }

    public async Task<IReadOnlyList<UserReportPresetDto>> GetUserReportPresetsAsync(long userId, string presetScope, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                UserReportPresetId,
                PresetScope,
                PresetName,
                PresetJson,
                UpdatedUtc
            FROM app.UserReportPreset
            WHERE UserId = @userId
              AND PresetScope = @presetScope
            ORDER BY UpdatedUtc DESC, UserReportPresetId DESC;
            """;

        var items = new List<UserReportPresetDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@presetScope", SqlDbType.NVarChar, 80) { Value = presetScope });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new UserReportPresetDto(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                ReadDateTimeOffset(reader, 4)));
        }

        return items;
    }

    public async Task<long> UpsertUserReportPresetAsync(long userId, string presetScope, UpsertUserReportPresetRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            DECLARE @existingId bigint;

            SELECT TOP (1) @existingId = UserReportPresetId
            FROM app.UserReportPreset
            WHERE UserId = @userId
              AND PresetScope = @presetScope
              AND PresetName = @presetName;

            IF @existingId IS NULL
            BEGIN
                INSERT INTO app.UserReportPreset (UserId, PresetScope, PresetName, PresetJson, CreatedUtc, UpdatedUtc)
                VALUES (@userId, @presetScope, @presetName, @presetJson, SYSUTCDATETIME(), SYSUTCDATETIME());

                SELECT CAST(SCOPE_IDENTITY() AS bigint);
            END
            ELSE
            BEGIN
                UPDATE app.UserReportPreset
                SET PresetJson = @presetJson,
                    UpdatedUtc = SYSUTCDATETIME()
                WHERE UserReportPresetId = @existingId;

                SELECT @existingId;
            END
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@presetScope", SqlDbType.NVarChar, 80) { Value = presetScope });
        command.Parameters.Add(new SqlParameter("@presetName", SqlDbType.NVarChar, 140) { Value = request.PresetName.Trim() });
        command.Parameters.Add(new SqlParameter("@presetJson", SqlDbType.NVarChar, -1) { Value = request.PresetJson });

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is long id ? id : Convert.ToInt64(result, CultureInfo.InvariantCulture);
    }

    public async Task<string?> GetGlobalReportPresetJsonAsync(string presetScope, string presetName, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1) PresetJson
            FROM app.UserReportPreset
            WHERE PresetScope = @presetScope
              AND PresetName = @presetName
            ORDER BY UpdatedUtc DESC, UserReportPresetId DESC;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@presetScope", SqlDbType.NVarChar, 80) { Value = presetScope });
        command.Parameters.Add(new SqlParameter("@presetName", SqlDbType.NVarChar, 140) { Value = presetName });

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is null || result == DBNull.Value
            ? null
            : Convert.ToString(result, CultureInfo.InvariantCulture);
    }

    public async Task<long> UpsertGlobalReportPresetAsync(long userId, string presetScope, UpsertUserReportPresetRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            DECLARE @existingId bigint;

            SELECT TOP (1) @existingId = UserReportPresetId
            FROM app.UserReportPreset
            WHERE PresetScope = @presetScope
              AND PresetName = @presetName
            ORDER BY UpdatedUtc DESC, UserReportPresetId DESC;

            IF @existingId IS NULL
            BEGIN
                INSERT INTO app.UserReportPreset (UserId, PresetScope, PresetName, PresetJson, CreatedUtc, UpdatedUtc)
                VALUES (@userId, @presetScope, @presetName, @presetJson, SYSUTCDATETIME(), SYSUTCDATETIME());

                SELECT CAST(SCOPE_IDENTITY() AS bigint);
            END
            ELSE
            BEGIN
                UPDATE app.UserReportPreset
                SET PresetJson = @presetJson,
                    UpdatedUtc = SYSUTCDATETIME()
                WHERE UserReportPresetId = @existingId;

                SELECT @existingId;
            END
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@presetScope", SqlDbType.NVarChar, 80) { Value = presetScope });
        command.Parameters.Add(new SqlParameter("@presetName", SqlDbType.NVarChar, 140) { Value = request.PresetName.Trim() });
        command.Parameters.Add(new SqlParameter("@presetJson", SqlDbType.NVarChar, -1) { Value = request.PresetJson });

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is long id ? id : Convert.ToInt64(result, CultureInfo.InvariantCulture);
    }

    public async Task<bool> DeleteUserReportPresetAsync(long userId, string presetScope, long userReportPresetId, CancellationToken cancellationToken)
    {
        const string sql = """
            DELETE FROM app.UserReportPreset
            WHERE UserReportPresetId = @userReportPresetId
              AND UserId = @userId
              AND PresetScope = @presetScope;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userReportPresetId", SqlDbType.BigInt) { Value = userReportPresetId });
        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@presetScope", SqlDbType.NVarChar, 80) { Value = presetScope });

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    public async Task<ImportBatchResultDto> ImportResourceInventoryBatchAsync(ResourceInventoryImportBatchRequestDto request, CancellationToken cancellationToken)
    {
        if (request.Rows.Count == 0)
        {
            return new ImportBatchResultDto(0, 0, 0, DateTimeOffset.UtcNow);
        }

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

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        foreach (var row in request.Rows)
        {
            try
            {
                await using var command = new SqlCommand(sql, connection)
                {
                    CommandType = CommandType.Text,
                    CommandTimeout = 30,
                };

                command.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = row.LocationId });
                command.Parameters.Add(new SqlParameter("@resourceTypeCode", SqlDbType.NVarChar, 80) { Value = row.ResourceTypeCode.Trim() });
                command.Parameters.Add(new SqlParameter("@quantityTotal", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = row.QuantityTotal });
                command.Parameters.Add(new SqlParameter("@quantityAvailable", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = row.QuantityAvailable });
                command.Parameters.Add(new SqlParameter("@quantityCommitted", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = row.QuantityCommitted });
                command.Parameters.Add(new SqlParameter("@quantityOutOfService", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = row.QuantityOutOfService });
                command.Parameters.Add(new SqlParameter("@reportedUtc", SqlDbType.DateTime2) { Value = row.ReportedUtc.HasValue ? row.ReportedUtc.Value.UtcDateTime : DBNull.Value });

                var result = await command.ExecuteScalarAsync(cancellationToken);
                var success = result is int value && value == 1;
                if (success)
                {
                    succeeded++;
                }
                else
                {
                    failed++;
                }
            }
            catch (Exception ex)
            {
                failed++;
                _logger.LogWarning(ex, "Resource inventory import row failed. LocationId: {LocationId}; ResourceTypeCode: {ResourceTypeCode}", row.LocationId, row.ResourceTypeCode);
            }
        }

        return new ImportBatchResultDto(request.Rows.Count, succeeded, failed, DateTimeOffset.UtcNow);
    }

    public async Task<ImportBatchResultDto> ImportBedAvailabilityBatchAsync(BedAvailabilityImportBatchRequestDto request, CancellationToken cancellationToken)
    {
        if (request.Rows.Count == 0)
        {
            return new ImportBatchResultDto(0, 0, 0, DateTimeOffset.UtcNow);
        }

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

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        foreach (var row in request.Rows)
        {
            try
            {
                await using var command = new SqlCommand(sql, connection)
                {
                    CommandType = CommandType.Text,
                    CommandTimeout = 30,
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
                command.Parameters.Add(new SqlParameter("@sourceSystemCode", SqlDbType.NVarChar, 80) { Value = request.SourceSystemCode.Trim() });
                command.Parameters.Add(new SqlParameter("@sourceMessageId", SqlDbType.NVarChar, 200) { Value = (object?)request.SourceMessageId ?? DBNull.Value });

                await command.ExecuteNonQueryAsync(cancellationToken);
                succeeded++;
            }
            catch (Exception ex)
            {
                failed++;
                _logger.LogWarning(ex, "Bed availability import row failed. LocationId: {LocationId}; BedCategoryCode: {BedCategoryCode}", row.LocationId, row.BedCategoryCode);
            }
        }

        return new ImportBatchResultDto(request.Rows.Count, succeeded, failed, DateTimeOffset.UtcNow);
    }

    public async Task<bool> IsInboundMessageAlreadyProcessedAsync(string sourceSystemCode, string? sourceMessageId, string interfaceTypeCode, CancellationToken cancellationToken)
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

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@sourceSystemCode", SqlDbType.NVarChar, 80) { Value = sourceSystemCode.Trim() });
        command.Parameters.Add(new SqlParameter("@sourceMessageId", SqlDbType.NVarChar, 200) { Value = sourceMessageId.Trim() });
        command.Parameters.Add(new SqlParameter("@interfaceTypeCode", SqlDbType.NVarChar, 80) { Value = interfaceTypeCode.Trim() });

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is not null;
    }

    public async Task RecordInboundMessageAsync(string sourceSystemCode, string? sourceMessageId, string interfaceTypeCode, string processingStatusCode, string payloadJson, string? errorMessage, CancellationToken cancellationToken)
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

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@sourceSystemCode", SqlDbType.NVarChar, 80) { Value = sourceSystemCode.Trim() });
        command.Parameters.Add(new SqlParameter("@sourceMessageId", SqlDbType.NVarChar, 200) { Value = (object?)sourceMessageId?.Trim() ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@interfaceTypeCode", SqlDbType.NVarChar, 80) { Value = interfaceTypeCode.Trim() });
        command.Parameters.Add(new SqlParameter("@processingStatusCode", SqlDbType.NVarChar, 40) { Value = processingStatusCode.Trim() });
        command.Parameters.Add(new SqlParameter("@payloadJson", SqlDbType.NVarChar, -1) { Value = payloadJson });
        command.Parameters.Add(new SqlParameter("@errorMessage", SqlDbType.NVarChar, -1) { Value = (object?)errorMessage ?? DBNull.Value });

        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}

/*
File: IPOC_WEB.Server/Infrastructure/Lookups/LookupQueryService.cs
Blueprint Name: LookupDataAccess

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2026-06-23
Updated: 2026-06-23

Description:
Lookup query and admin command service for runtime dropdown/reference data.

Features:
  - Code set lookup retrieval from ref.CodeSet/ref.CodeValue.
  - Active location lookup retrieval with organization and region context.
  - Admin create/update/deactivate support for lookup values.

Security & Compliance:
  - Uses parameterized SQL to reduce injection risk.
  - Uses soft-delete semantics via IsActive for lookup lifecycle management.
  - Emits structured logs for lookup administration operations.
*/

using System.Data;
using IPOC_WEB.Server.Infrastructure.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IPOC_WEB.Server.Infrastructure.Lookups;

public interface ILookupQueryService
{
    Task<IReadOnlyList<LookupValueDto>> GetLookupValuesAsync(string codeSetName, CancellationToken cancellationToken);
    Task<IReadOnlyList<LookupValueDto>> SearchLookupValuesAsync(string codeSetName, string query, int maxResults, CancellationToken cancellationToken);
    Task<IReadOnlyList<LocationLookupDto>> GetActiveLocationsAsync(CancellationToken cancellationToken);
    Task<(IReadOnlyList<AdminLocationDto> Items, int TotalCount)> GetAdminLocationsAsync(string? search, bool? isActive, int pageNumber, int pageSize, CancellationToken cancellationToken);
    Task<bool> UpdateLocationActiveStatusAsync(long locationId, bool isActive, CancellationToken cancellationToken);
    Task<bool> UpdateAdminLocationGeoAsync(long locationId, UpdateAdminLocationGeoRequestDto request, CancellationToken cancellationToken);
    Task<AdminLocationDto?> GetAdminLocationByIdAsync(long locationId, CancellationToken cancellationToken);
    Task<AdminLocationSnapshotDto?> GetAdminLocationSnapshotAsync(long locationId, CancellationToken cancellationToken);
    Task<(IReadOnlyList<AdminIcsPositionDto> Items, int TotalCount)> GetAdminIcsPositionsAsync(string? search, bool? isNimsStandard, int pageNumber, int pageSize, CancellationToken cancellationToken);
    Task<int> CreateAdminIcsPositionAsync(CreateAdminIcsPositionRequestDto request, CancellationToken cancellationToken);
    Task<bool> UpdateAdminIcsPositionAsync(int icsPositionId, UpdateAdminIcsPositionRequestDto request, CancellationToken cancellationToken);
    Task<bool> UpdateAdminIcsPositionStandardStatusAsync(int icsPositionId, bool isNimsStandard, CancellationToken cancellationToken);
    Task<int> CreateLookupValueAsync(string codeSetName, CreateLookupValueRequestDto request, CancellationToken cancellationToken);
    Task<bool> UpdateLookupValueAsync(string codeSetName, int codeValueId, UpdateLookupValueRequestDto request, CancellationToken cancellationToken);
}

public sealed class LookupQueryService : ILookupQueryService
{
    private readonly string _connectionString;
    private readonly ILogger<LookupQueryService> _logger;
    private readonly bool _degradedReadFallbackEnabled;
    private bool? _locationAddressColumnsAvailable;

    public LookupQueryService(IConfiguration configuration, IHostEnvironment hostEnvironment, IOptions<SqlDataOptions> sqlOptions, ILogger<LookupQueryService> logger)
    {
        _logger = logger;

        var configuredConnectionName = sqlOptions.Value.ConnectionStringName;
        _connectionString = configuration.GetConnectionString(configuredConnectionName)
            ?? throw new InvalidOperationException($"Connection string '{configuredConnectionName}' is not configured.");

        _degradedReadFallbackEnabled = hostEnvironment.IsDevelopment()
            && configuration.GetValue("SqlData:EnableDegradedReadFallback", true);
    }

    public async Task<IReadOnlyList<LookupValueDto>> SearchLookupValuesAsync(string codeSetName, string query, int maxResults, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (@maxResults)
                cv.CodeValueId,
                cs.CodeSetName,
                cv.Code,
                cv.DisplayName,
                cv.SortOrder,
                cv.IsActive,
                cv.Description
            FROM ref.CodeValue cv
            INNER JOIN ref.CodeSet cs ON cs.CodeSetId = cv.CodeSetId
            WHERE cs.CodeSetName = @codeSetName
              AND cv.IsActive = 1
              AND (
                  cv.DisplayName LIKE @containsQuery
                  OR cv.Code LIKE @containsQuery
              )
            ORDER BY
                CASE
                    WHEN cv.DisplayName = @query OR cv.Code = @query THEN 0
                    WHEN cv.DisplayName LIKE @prefixQuery OR cv.Code LIKE @prefixQuery THEN 1
                    ELSE 2
                END,
                cv.SortOrder,
                cv.DisplayName;
            """;

        var values = new List<LookupValueDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@codeSetName", SqlDbType.NVarChar, 128) { Value = codeSetName });
            command.Parameters.Add(new SqlParameter("@query", SqlDbType.NVarChar, 200) { Value = query });
            command.Parameters.Add(new SqlParameter("@containsQuery", SqlDbType.NVarChar, 220) { Value = $"%{query}%" });
            command.Parameters.Add(new SqlParameter("@prefixQuery", SqlDbType.NVarChar, 220) { Value = $"{query}%" });
            command.Parameters.Add(new SqlParameter("@maxResults", SqlDbType.Int) { Value = maxResults });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                values.Add(new LookupValueDto(
                    reader.GetInt32(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetInt32(4),
                    reader.GetBoolean(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6)));
            }

            return values;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while searching lookup values for code set {CodeSetName}. Returning empty lookup set due to degraded read fallback.", codeSetName);
                return [];
            }

            _logger.LogError(ex, "Database error while searching lookup values for code set {CodeSetName}.", codeSetName);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while searching lookup values for code set {CodeSetName}.", codeSetName);
            throw;
        }
    }

    public async Task<IReadOnlyList<LookupValueDto>> GetLookupValuesAsync(string codeSetName, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                cv.CodeValueId,
                cs.CodeSetName,
                cv.Code,
                cv.DisplayName,
                cv.SortOrder,
                cv.IsActive,
                cv.Description
            FROM ref.CodeValue cv
            INNER JOIN ref.CodeSet cs ON cs.CodeSetId = cv.CodeSetId
            WHERE cs.CodeSetName = @codeSetName
            ORDER BY cv.SortOrder, cv.DisplayName;
            """;

        var values = new List<LookupValueDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@codeSetName", SqlDbType.NVarChar, 128) { Value = codeSetName });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                values.Add(new LookupValueDto(
                    reader.GetInt32(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetInt32(4),
                    reader.GetBoolean(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6)));
            }

            _logger.LogInformation("Retrieved {LookupCount} lookup values for code set {CodeSetName}.", values.Count, codeSetName);
            return values;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable for lookup code set {CodeSetName}. Returning empty lookup set due to degraded read fallback.", codeSetName);
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving lookup values for code set {CodeSetName}.", codeSetName);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving lookup values for code set {CodeSetName}.", codeSetName);
            throw;
        }
    }

    public async Task<IReadOnlyList<LocationLookupDto>> GetActiveLocationsAsync(CancellationToken cancellationToken)
    {
        const string sqlWithoutAddressColumns = """
            SELECT TOP (1000)
                l.LocationId,
                l.LocationName,
                l.OrganizationId,
                o.OrganizationName,
                l.RegionId,
                r.RegionName,
                TRY_CAST(l.Latitude AS decimal(9,6)) AS Latitude,
                TRY_CAST(l.Longitude AS decimal(9,6)) AS Longitude,
                CAST(NULL AS nvarchar(120)) AS CityName,
                CAST(NULL AS nvarchar(2)) AS StateCode,
                CAST(NULL AS nvarchar(20)) AS PostalCode,
                CONCAT(
                    l.LocationName,
                    CASE WHEN o.OrganizationName IS NULL THEN '' ELSE CONCAT(' (', o.OrganizationName, ')') END,
                    CASE WHEN r.RegionName IS NULL THEN '' ELSE CONCAT(' - ', r.RegionName) END
                ) AS DisplayText
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE l.IsActive = 1
            ORDER BY l.LocationName;
            """;

        const string sqlWithAddressColumns = """
            SELECT TOP (1000)
                l.LocationId,
                l.LocationName,
                l.OrganizationId,
                o.OrganizationName,
                l.RegionId,
                r.RegionName,
                TRY_CAST(l.Latitude AS decimal(9,6)) AS Latitude,
                TRY_CAST(l.Longitude AS decimal(9,6)) AS Longitude,
                CAST(l.CityName AS nvarchar(120)) AS CityName,
                CAST(l.StateCode AS nvarchar(2)) AS StateCode,
                CAST(l.PostalCode AS nvarchar(20)) AS PostalCode,
                CONCAT(
                    l.LocationName,
                    CASE WHEN o.OrganizationName IS NULL THEN '' ELSE CONCAT(' (', o.OrganizationName, ')') END,
                    CASE WHEN r.RegionName IS NULL THEN '' ELSE CONCAT(' - ', r.RegionName) END
                ) AS DisplayText
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE l.IsActive = 1
            ORDER BY l.LocationName;
            """;

        var values = new List<LocationLookupDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            var locationAddressColumnsAvailable = await IsLocationAddressColumnsAvailableAsync(connection, cancellationToken);
            var sql = locationAddressColumnsAvailable ? sqlWithAddressColumns : sqlWithoutAddressColumns;

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                values.Add(new LocationLookupDto(
                    reader.GetInt64(0),
                    reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetInt64(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetInt32(4),
                    reader.IsDBNull(5) ? null : reader.GetString(5),
                    reader.IsDBNull(6) ? null : reader.GetDecimal(6),
                    reader.IsDBNull(7) ? null : reader.GetDecimal(7),
                    reader.IsDBNull(8) ? null : reader.GetString(8),
                    reader.IsDBNull(9) ? null : reader.GetString(9),
                    reader.IsDBNull(10) ? null : reader.GetString(10),
                    reader.GetString(11)));
            }

            _logger.LogInformation("Retrieved {LocationCount} active locations for lookup rendering.", values.Count);
            return values;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable for active locations lookup. Returning empty location set due to degraded read fallback.");
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving active location lookup values.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving active location lookup values.");
            throw;
        }
    }

    public async Task<(IReadOnlyList<AdminLocationDto> Items, int TotalCount)> GetAdminLocationsAsync(string? search, bool? isActive, int pageNumber, int pageSize, CancellationToken cancellationToken)
    {
        const string sqlWithoutAddressColumns = """
            SELECT COUNT(1)
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE (@search IS NULL OR l.LocationName LIKE @search OR o.OrganizationName LIKE @search OR r.RegionName LIKE @search)
              AND (@isActive IS NULL OR l.IsActive = @isActive);

            SELECT
                l.LocationId,
                l.LocationName,
                o.OrganizationName,
                r.RegionName,
                TRY_CAST(l.Latitude AS decimal(9,6)) AS Latitude,
                TRY_CAST(l.Longitude AS decimal(9,6)) AS Longitude,
                CAST(NULL AS nvarchar(120)) AS CityName,
                CAST(NULL AS nvarchar(2)) AS StateCode,
                CAST(NULL AS nvarchar(20)) AS PostalCode,
                l.IsActive,
                CONCAT(
                    l.LocationName,
                    CASE WHEN o.OrganizationName IS NULL THEN '' ELSE CONCAT(' (', o.OrganizationName, ')') END,
                    CASE WHEN r.RegionName IS NULL THEN '' ELSE CONCAT(' - ', r.RegionName) END
                ) AS DisplayText
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE (@search IS NULL OR l.LocationName LIKE @search OR o.OrganizationName LIKE @search OR r.RegionName LIKE @search)
              AND (@isActive IS NULL OR l.IsActive = @isActive)
            ORDER BY l.LocationName
            OFFSET @offset ROWS
            FETCH NEXT @pageSize ROWS ONLY;
            """;

        const string sqlWithAddressColumns = """
            SELECT COUNT(1)
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE (@search IS NULL OR l.LocationName LIKE @search OR o.OrganizationName LIKE @search OR r.RegionName LIKE @search)
              AND (@isActive IS NULL OR l.IsActive = @isActive);

            SELECT
                l.LocationId,
                l.LocationName,
                o.OrganizationName,
                r.RegionName,
                TRY_CAST(l.Latitude AS decimal(9,6)) AS Latitude,
                TRY_CAST(l.Longitude AS decimal(9,6)) AS Longitude,
                CAST(l.CityName AS nvarchar(120)) AS CityName,
                CAST(l.StateCode AS nvarchar(2)) AS StateCode,
                CAST(l.PostalCode AS nvarchar(20)) AS PostalCode,
                l.IsActive,
                CONCAT(
                    l.LocationName,
                    CASE WHEN o.OrganizationName IS NULL THEN '' ELSE CONCAT(' (', o.OrganizationName, ')') END,
                    CASE WHEN r.RegionName IS NULL THEN '' ELSE CONCAT(' - ', r.RegionName) END
                ) AS DisplayText
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE (@search IS NULL OR l.LocationName LIKE @search OR o.OrganizationName LIKE @search OR r.RegionName LIKE @search)
              AND (@isActive IS NULL OR l.IsActive = @isActive)
            ORDER BY l.LocationName
            OFFSET @offset ROWS
            FETCH NEXT @pageSize ROWS ONLY;
            """;

        var values = new List<AdminLocationDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        var locationAddressColumnsAvailable = await IsLocationAddressColumnsAvailableAsync(connection, cancellationToken);
        var sql = locationAddressColumnsAvailable ? sqlWithAddressColumns : sqlWithoutAddressColumns;

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        var normalizedSearch = string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%";
        var normalizedPageNumber = Math.Max(1, pageNumber);
        var normalizedPageSize = Math.Max(1, pageSize);
        var offset = (normalizedPageNumber - 1) * normalizedPageSize;
        command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, 200) { Value = (object?)normalizedSearch ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@isActive", SqlDbType.Bit) { Value = (object?)isActive ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@offset", SqlDbType.Int) { Value = offset });
        command.Parameters.Add(new SqlParameter("@pageSize", SqlDbType.Int) { Value = normalizedPageSize });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var totalCount = 0;

        if (await reader.ReadAsync(cancellationToken))
        {
            totalCount = reader.GetInt32(0);
        }

        await reader.NextResultAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            values.Add(new AdminLocationDto(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetDecimal(4),
                reader.IsDBNull(5) ? null : reader.GetDecimal(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.IsDBNull(8) ? null : reader.GetString(8),
                reader.GetBoolean(9),
                reader.GetString(10)));
        }

        return (values, totalCount);
    }

    public async Task<bool> UpdateLocationActiveStatusAsync(long locationId, bool isActive, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE org.Location
            SET IsActive = @isActive
            WHERE LocationId = @locationId;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = locationId });
        command.Parameters.Add(new SqlParameter("@isActive", SqlDbType.Bit) { Value = isActive });

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    public async Task<bool> UpdateAdminLocationGeoAsync(long locationId, UpdateAdminLocationGeoRequestDto request, CancellationToken cancellationToken)
    {
        const string sqlWithoutAddressColumns = """
            UPDATE org.Location
            SET Latitude = @latitude,
                Longitude = @longitude
            WHERE LocationId = @locationId;
            """;

        const string sqlWithAddressColumns = """
            UPDATE org.Location
            SET Latitude = @latitude,
                Longitude = @longitude,
                CityName = @cityName,
                StateCode = @stateCode,
                PostalCode = @postalCode
            WHERE LocationId = @locationId;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        var locationAddressColumnsAvailable = await IsLocationAddressColumnsAvailableAsync(connection, cancellationToken);
        var sql = locationAddressColumnsAvailable ? sqlWithAddressColumns : sqlWithoutAddressColumns;

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = locationId });
        command.Parameters.Add(new SqlParameter("@latitude", SqlDbType.Decimal)
        {
            Precision = 9,
            Scale = 6,
            Value = request.Latitude.HasValue ? request.Latitude.Value : DBNull.Value,
        });
        command.Parameters.Add(new SqlParameter("@longitude", SqlDbType.Decimal)
        {
            Precision = 9,
            Scale = 6,
            Value = request.Longitude.HasValue ? request.Longitude.Value : DBNull.Value,
        });
        if (locationAddressColumnsAvailable)
        {
            command.Parameters.Add(new SqlParameter("@cityName", SqlDbType.NVarChar, 120)
            {
                Value = string.IsNullOrWhiteSpace(request.CityName) ? DBNull.Value : request.CityName.Trim(),
            });
            command.Parameters.Add(new SqlParameter("@stateCode", SqlDbType.NVarChar, 2)
            {
                Value = string.IsNullOrWhiteSpace(request.StateCode) ? DBNull.Value : request.StateCode.Trim().ToUpperInvariant(),
            });
            command.Parameters.Add(new SqlParameter("@postalCode", SqlDbType.NVarChar, 20)
            {
                Value = string.IsNullOrWhiteSpace(request.PostalCode) ? DBNull.Value : request.PostalCode.Trim(),
            });
        }

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    public async Task<AdminLocationDto?> GetAdminLocationByIdAsync(long locationId, CancellationToken cancellationToken)
    {
        const string sqlWithoutAddressColumns = """
            SELECT
                l.LocationId,
                l.LocationName,
                o.OrganizationName,
                r.RegionName,
                TRY_CAST(l.Latitude AS decimal(9,6)) AS Latitude,
                TRY_CAST(l.Longitude AS decimal(9,6)) AS Longitude,
                CAST(NULL AS nvarchar(120)) AS CityName,
                CAST(NULL AS nvarchar(2)) AS StateCode,
                CAST(NULL AS nvarchar(20)) AS PostalCode,
                l.IsActive,
                CONCAT(
                    l.LocationName,
                    CASE WHEN o.OrganizationName IS NULL THEN '' ELSE CONCAT(' (', o.OrganizationName, ')') END,
                    CASE WHEN r.RegionName IS NULL THEN '' ELSE CONCAT(' - ', r.RegionName) END
                ) AS DisplayText
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE l.LocationId = @locationId;
            """;

        const string sqlWithAddressColumns = """
            SELECT
                l.LocationId,
                l.LocationName,
                o.OrganizationName,
                r.RegionName,
                TRY_CAST(l.Latitude AS decimal(9,6)) AS Latitude,
                TRY_CAST(l.Longitude AS decimal(9,6)) AS Longitude,
                CAST(l.CityName AS nvarchar(120)) AS CityName,
                CAST(l.StateCode AS nvarchar(2)) AS StateCode,
                CAST(l.PostalCode AS nvarchar(20)) AS PostalCode,
                l.IsActive,
                CONCAT(
                    l.LocationName,
                    CASE WHEN o.OrganizationName IS NULL THEN '' ELSE CONCAT(' (', o.OrganizationName, ')') END,
                    CASE WHEN r.RegionName IS NULL THEN '' ELSE CONCAT(' - ', r.RegionName) END
                ) AS DisplayText
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE l.LocationId = @locationId;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        var locationAddressColumnsAvailable = await IsLocationAddressColumnsAvailableAsync(connection, cancellationToken);
        var sql = locationAddressColumnsAvailable ? sqlWithAddressColumns : sqlWithoutAddressColumns;

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = locationId });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new AdminLocationDto(
            reader.GetInt64(0),
            reader.GetString(1),
            reader.IsDBNull(2) ? null : reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetDecimal(4),
            reader.IsDBNull(5) ? null : reader.GetDecimal(5),
            reader.IsDBNull(6) ? null : reader.GetString(6),
            reader.IsDBNull(7) ? null : reader.GetString(7),
            reader.IsDBNull(8) ? null : reader.GetString(8),
            reader.GetBoolean(9),
            reader.GetString(10));
    }

    public async Task<AdminLocationSnapshotDto?> GetAdminLocationSnapshotAsync(long locationId, CancellationToken cancellationToken)
    {
        const string sqlWithoutAddressColumns = """
            IF NOT EXISTS (SELECT 1 FROM org.Location WHERE LocationId = @locationId)
            BEGIN
                SELECT CAST(0 AS bit) AS ExistsLocation;
                RETURN;
            END;

            SELECT CAST(1 AS bit) AS ExistsLocation;

            SELECT
                l.LocationName,
                o.OrganizationName,
                r.RegionName,
                CAST(NULL AS nvarchar(120)) AS CityName,
                CAST(NULL AS nvarchar(2)) AS StateCode,
                CAST(NULL AS nvarchar(20)) AS PostalCode,
                l.IsActive
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE l.LocationId = @locationId;

            SELECT
                ResourceInventoryRowCount = COUNT_BIG(1),
                TotalQuantityAvailable = COALESCE(SUM(lri.QuantityAvailable), 0),
                TotalQuantityCommitted = COALESCE(SUM(lri.QuantityCommitted), 0),
                TotalQuantityOutOfService = COALESCE(SUM(lri.QuantityOutOfService), 0),
                LastResourceReportedUtc = MAX(lri.LastReportedUtc)
            FROM res.LocationResourceInventory lri
            WHERE lri.LocationId = @locationId;

            SELECT
                BedSnapshotRowCount = COUNT_BIG(1),
                TotalBedsAvailable = COALESCE(SUM(CAST(bas.BedsAvailable AS bigint)), 0),
                TotalBedsOccupied = COALESCE(SUM(CAST(bas.BedsOccupied AS bigint)), 0),
                TotalBedsUnavailable = COALESCE(SUM(CAST(bas.BedsUnavailable AS bigint)), 0),
                LastBedReportedUtc = MAX(bas.ReportedUtc)
            FROM res.BedAvailabilitySnapshot bas
            WHERE bas.LocationId = @locationId;
            """;

        const string sqlWithAddressColumns = """
            IF NOT EXISTS (SELECT 1 FROM org.Location WHERE LocationId = @locationId)
            BEGIN
                SELECT CAST(0 AS bit) AS ExistsLocation;
                RETURN;
            END;

            SELECT CAST(1 AS bit) AS ExistsLocation;

            SELECT
                l.LocationName,
                o.OrganizationName,
                r.RegionName,
                CAST(l.CityName AS nvarchar(120)) AS CityName,
                CAST(l.StateCode AS nvarchar(2)) AS StateCode,
                CAST(l.PostalCode AS nvarchar(20)) AS PostalCode,
                l.IsActive
            FROM org.Location l
            LEFT JOIN org.Organization o ON o.OrganizationId = l.OrganizationId
            LEFT JOIN org.Region r ON r.RegionId = l.RegionId
            WHERE l.LocationId = @locationId;

            SELECT
                ResourceInventoryRowCount = COUNT_BIG(1),
                TotalQuantityAvailable = COALESCE(SUM(lri.QuantityAvailable), 0),
                TotalQuantityCommitted = COALESCE(SUM(lri.QuantityCommitted), 0),
                TotalQuantityOutOfService = COALESCE(SUM(lri.QuantityOutOfService), 0),
                LastResourceReportedUtc = MAX(lri.LastReportedUtc)
            FROM res.LocationResourceInventory lri
            WHERE lri.LocationId = @locationId;

            SELECT
                BedSnapshotRowCount = COUNT_BIG(1),
                TotalBedsAvailable = COALESCE(SUM(CAST(bas.BedsAvailable AS bigint)), 0),
                TotalBedsOccupied = COALESCE(SUM(CAST(bas.BedsOccupied AS bigint)), 0),
                TotalBedsUnavailable = COALESCE(SUM(CAST(bas.BedsUnavailable AS bigint)), 0),
                LastBedReportedUtc = MAX(bas.ReportedUtc)
            FROM res.BedAvailabilitySnapshot bas
            WHERE bas.LocationId = @locationId;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        var locationAddressColumnsAvailable = await IsLocationAddressColumnsAvailableAsync(connection, cancellationToken);
        var sql = locationAddressColumnsAvailable ? sqlWithAddressColumns : sqlWithoutAddressColumns;

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = locationId });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var exists = !reader.IsDBNull(0) && reader.GetBoolean(0);
        if (!exists)
        {
            return null;
        }

        await reader.NextResultAsync(cancellationToken);
        var locationName = string.Empty;
        string? organizationName = null;
        string? regionName = null;
        string? cityName = null;
        string? stateCode = null;
        string? postalCode = null;
        var isActive = true;

        if (await reader.ReadAsync(cancellationToken))
        {
            locationName = reader.IsDBNull(0) ? string.Empty : reader.GetString(0);
            organizationName = reader.IsDBNull(1) ? null : reader.GetString(1);
            regionName = reader.IsDBNull(2) ? null : reader.GetString(2);
            cityName = reader.IsDBNull(3) ? null : reader.GetString(3);
            stateCode = reader.IsDBNull(4) ? null : reader.GetString(4);
            postalCode = reader.IsDBNull(5) ? null : reader.GetString(5);
            isActive = !reader.IsDBNull(6) && reader.GetBoolean(6);
        }

        await reader.NextResultAsync(cancellationToken);
        long resourceRowCount = 0;
        decimal totalAvailable = 0;
        decimal totalCommitted = 0;
        decimal totalOutOfService = 0;
        DateTimeOffset? lastResourceReportedUtc = null;

        if (await reader.ReadAsync(cancellationToken))
        {
            resourceRowCount = reader.IsDBNull(0) ? 0 : reader.GetInt64(0);
            totalAvailable = reader.IsDBNull(1) ? 0 : reader.GetDecimal(1);
            totalCommitted = reader.IsDBNull(2) ? 0 : reader.GetDecimal(2);
            totalOutOfService = reader.IsDBNull(3) ? 0 : reader.GetDecimal(3);
            lastResourceReportedUtc = ReadNullableDateTimeOffset(reader, 4);
        }

        await reader.NextResultAsync(cancellationToken);
        long bedRowCount = 0;
        long totalBedsAvailable = 0;
        long totalBedsOccupied = 0;
        long totalBedsUnavailable = 0;
        DateTimeOffset? lastBedReportedUtc = null;

        if (await reader.ReadAsync(cancellationToken))
        {
            bedRowCount = reader.IsDBNull(0) ? 0 : reader.GetInt64(0);
            totalBedsAvailable = reader.IsDBNull(1) ? 0 : reader.GetInt64(1);
            totalBedsOccupied = reader.IsDBNull(2) ? 0 : reader.GetInt64(2);
            totalBedsUnavailable = reader.IsDBNull(3) ? 0 : reader.GetInt64(3);
            lastBedReportedUtc = ReadNullableDateTimeOffset(reader, 4);
        }

        return new AdminLocationSnapshotDto(
            locationId,
            locationName,
            organizationName,
            regionName,
            cityName,
            stateCode,
            postalCode,
            isActive,
            Convert.ToInt32(resourceRowCount),
            totalAvailable,
            totalCommitted,
            totalOutOfService,
            lastResourceReportedUtc,
            Convert.ToInt32(bedRowCount),
            Convert.ToInt32(totalBedsAvailable),
            Convert.ToInt32(totalBedsOccupied),
            Convert.ToInt32(totalBedsUnavailable),
            lastBedReportedUtc);
    }

    public async Task<(IReadOnlyList<AdminIcsPositionDto> Items, int TotalCount)> GetAdminIcsPositionsAsync(string? search, bool? isNimsStandard, int pageNumber, int pageSize, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT COUNT(1)
            FROM ref.IcsPosition p
            WHERE (@search IS NULL OR p.PositionCode LIKE @search OR p.PositionName LIKE @search OR p.IcsSection LIKE @search)
              AND (@isNimsStandard IS NULL OR p.IsNimsStandard = @isNimsStandard);

            SELECT
                p.IcsPositionId,
                p.PositionCode,
                p.PositionName,
                p.IcsSection,
                p.ParentPositionCode,
                p.SortOrder,
                p.IsNimsStandard,
                p.Description
            FROM ref.IcsPosition p
            WHERE (@search IS NULL OR p.PositionCode LIKE @search OR p.PositionName LIKE @search OR p.IcsSection LIKE @search)
              AND (@isNimsStandard IS NULL OR p.IsNimsStandard = @isNimsStandard)
            ORDER BY p.SortOrder, p.PositionName
            OFFSET @offset ROWS
            FETCH NEXT @pageSize ROWS ONLY;
            """;

        var values = new List<AdminIcsPositionDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        var normalizedSearch = string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%";
        var normalizedPageNumber = Math.Max(1, pageNumber);
        var normalizedPageSize = Math.Max(1, pageSize);
        var offset = (normalizedPageNumber - 1) * normalizedPageSize;

        command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, 200) { Value = (object?)normalizedSearch ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@isNimsStandard", SqlDbType.Bit) { Value = (object?)isNimsStandard ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@offset", SqlDbType.Int) { Value = offset });
        command.Parameters.Add(new SqlParameter("@pageSize", SqlDbType.Int) { Value = normalizedPageSize });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var totalCount = 0;

        if (await reader.ReadAsync(cancellationToken))
        {
            totalCount = reader.GetInt32(0);
        }

        await reader.NextResultAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            values.Add(new AdminIcsPositionDto(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.GetInt32(5),
                reader.GetBoolean(6),
                reader.IsDBNull(7) ? null : reader.GetString(7)));
        }

        return (values, totalCount);
    }

    public async Task<int> CreateAdminIcsPositionAsync(CreateAdminIcsPositionRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            IF @parentPositionCode IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM ref.IcsPosition WHERE PositionCode = @parentPositionCode)
            BEGIN
                THROW 51041, 'ParentPositionCode was not found.', 1;
            END;

            IF @parentPositionCode IS NOT NULL
            BEGIN
                WITH ParentChain AS
                (
                    SELECT
                        p.PositionCode,
                        p.ParentPositionCode,
                        CAST(CONCAT('|', p.PositionCode, '|') AS nvarchar(max)) AS PathTrace
                    FROM ref.IcsPosition p
                    WHERE p.PositionCode = @parentPositionCode

                    UNION ALL

                    SELECT
                        parent.PositionCode,
                        parent.ParentPositionCode,
                        CAST(CONCAT(chain.PathTrace, parent.PositionCode, '|') AS nvarchar(max))
                    FROM ParentChain chain
                    INNER JOIN ref.IcsPosition parent ON parent.PositionCode = chain.ParentPositionCode
                    WHERE chain.PathTrace NOT LIKE CONCAT('%|', parent.PositionCode, '|%')
                )
                SELECT TOP (1) 1
                FROM ParentChain
                WHERE ParentPositionCode IS NOT NULL
                  AND PathTrace LIKE CONCAT('%|', ParentPositionCode, '|%');

                IF @@ROWCOUNT > 0
                BEGIN
                    THROW 51043, 'ParentPositionCode chain contains a cycle.', 1;
                END;
            END;

            INSERT INTO ref.IcsPosition
            (
                PositionCode,
                PositionName,
                IcsSection,
                ParentPositionCode,
                SortOrder,
                IsNimsStandard,
                Description
            )
            OUTPUT INSERTED.IcsPositionId
            VALUES
            (
                @positionCode,
                @positionName,
                @icsSection,
                @parentPositionCode,
                COALESCE(@sortOrder, 100),
                COALESCE(@isNimsStandard, 1),
                @description
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

            command.Parameters.Add(new SqlParameter("@positionCode", SqlDbType.NVarChar, 40) { Value = request.PositionCode });
            command.Parameters.Add(new SqlParameter("@positionName", SqlDbType.NVarChar, 160) { Value = request.PositionName });
            command.Parameters.Add(new SqlParameter("@icsSection", SqlDbType.NVarChar, 80) { Value = request.IcsSection });
            command.Parameters.Add(new SqlParameter("@parentPositionCode", SqlDbType.NVarChar, 40) { Value = (object?)request.ParentPositionCode ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@sortOrder", SqlDbType.Int) { Value = (object?)request.SortOrder ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@isNimsStandard", SqlDbType.Bit) { Value = (object?)request.IsNimsStandard ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@description", SqlDbType.NVarChar, 1000) { Value = (object?)request.Description ?? DBNull.Value });

            var icsPositionId = (int)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("ICS position creation did not return an identifier."));

            _logger.LogInformation("Created ICS position {IcsPositionId} ({PositionCode}).", icsPositionId, request.PositionCode);
            return icsPositionId;
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            _logger.LogWarning(ex, "Duplicate PositionCode detected while creating ICS position {PositionCode}.", request.PositionCode);
            throw new InvalidOperationException("PositionCode already exists.");
        }
        catch (SqlException ex) when (ex.Number == 51041)
        {
            _logger.LogWarning(ex, "ParentPositionCode {ParentPositionCode} was not found while creating ICS position {PositionCode}.", request.ParentPositionCode, request.PositionCode);
            throw new InvalidOperationException("ParentPositionCode was not found.");
        }
        catch (SqlException ex) when (ex.Number == 51043)
        {
            _logger.LogWarning(ex, "ParentPositionCode chain contains a cycle while creating ICS position {PositionCode}.", request.PositionCode);
            throw new InvalidOperationException("ParentPositionCode chain contains a cycle.");
        }
    }

    public async Task<bool> UpdateAdminIcsPositionAsync(int icsPositionId, UpdateAdminIcsPositionRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            DECLARE @positionCode nvarchar(40);
            SELECT @positionCode = PositionCode
            FROM ref.IcsPosition
            WHERE IcsPositionId = @icsPositionId;

            IF @positionCode IS NULL
            BEGIN
                SELECT 0;
                RETURN;
            END;

            IF @parentPositionCode IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM ref.IcsPosition WHERE PositionCode = @parentPositionCode)
            BEGIN
                THROW 51041, 'ParentPositionCode was not found.', 1;
            END;

            IF @parentPositionCode IS NOT NULL
               AND @parentPositionCode = @positionCode
            BEGIN
                THROW 51042, 'ParentPositionCode cannot reference the same position code.', 1;
            END;

            IF @parentPositionCode IS NOT NULL
            BEGIN
                WITH ParentChain AS
                (
                    SELECT
                        p.PositionCode,
                        p.ParentPositionCode,
                        CAST(CONCAT('|', p.PositionCode, '|') AS nvarchar(max)) AS PathTrace
                    FROM ref.IcsPosition p
                    WHERE p.PositionCode = @parentPositionCode

                    UNION ALL

                    SELECT
                        parent.PositionCode,
                        parent.ParentPositionCode,
                        CAST(CONCAT(chain.PathTrace, parent.PositionCode, '|') AS nvarchar(max))
                    FROM ParentChain chain
                    INNER JOIN ref.IcsPosition parent ON parent.PositionCode = chain.ParentPositionCode
                    WHERE chain.PathTrace NOT LIKE CONCAT('%|', parent.PositionCode, '|%')
                )
                SELECT TOP (1) 1
                FROM ParentChain
                WHERE PositionCode = @positionCode;

                IF @@ROWCOUNT > 0
                BEGIN
                    THROW 51043, 'ParentPositionCode chain contains a cycle.', 1;
                END;

                SELECT TOP (1) 1
                FROM ParentChain
                WHERE ParentPositionCode IS NOT NULL
                  AND PathTrace LIKE CONCAT('%|', ParentPositionCode, '|%');

                IF @@ROWCOUNT > 0
                BEGIN
                    THROW 51043, 'ParentPositionCode chain contains a cycle.', 1;
                END;
            END;

            UPDATE ref.IcsPosition
            SET PositionName = @positionName,
                IcsSection = @icsSection,
                ParentPositionCode = @parentPositionCode,
                SortOrder = COALESCE(@sortOrder, SortOrder),
                IsNimsStandard = COALESCE(@isNimsStandard, IsNimsStandard),
                Description = @description
            WHERE IcsPositionId = @icsPositionId;

            SELECT @@ROWCOUNT;
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

            command.Parameters.Add(new SqlParameter("@icsPositionId", SqlDbType.Int) { Value = icsPositionId });
            command.Parameters.Add(new SqlParameter("@positionName", SqlDbType.NVarChar, 160) { Value = request.PositionName });
            command.Parameters.Add(new SqlParameter("@icsSection", SqlDbType.NVarChar, 80) { Value = request.IcsSection });
            command.Parameters.Add(new SqlParameter("@parentPositionCode", SqlDbType.NVarChar, 40) { Value = (object?)request.ParentPositionCode ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@sortOrder", SqlDbType.Int) { Value = (object?)request.SortOrder ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@isNimsStandard", SqlDbType.Bit) { Value = (object?)request.IsNimsStandard ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@description", SqlDbType.NVarChar, 1000) { Value = (object?)request.Description ?? DBNull.Value });

            var rowsAffectedObject = await command.ExecuteScalarAsync(cancellationToken);
            var rowsAffected = rowsAffectedObject is int value ? value : 0;
            _logger.LogInformation("Updated ICS position {IcsPositionId}. Rows affected: {RowsAffected}.", icsPositionId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex) when (ex.Number == 51041)
        {
            _logger.LogWarning(ex, "ParentPositionCode {ParentPositionCode} was not found while updating ICS position {IcsPositionId}.", request.ParentPositionCode, icsPositionId);
            throw new InvalidOperationException("ParentPositionCode was not found.");
        }
        catch (SqlException ex) when (ex.Number == 51042)
        {
            _logger.LogWarning(ex, "ParentPositionCode attempted to self-reference for ICS position {IcsPositionId}.", icsPositionId);
            throw new InvalidOperationException("ParentPositionCode cannot reference the same position.");
        }
        catch (SqlException ex) when (ex.Number == 51043)
        {
            _logger.LogWarning(ex, "ParentPositionCode chain contains a cycle while updating ICS position {IcsPositionId}.", icsPositionId);
            throw new InvalidOperationException("ParentPositionCode chain contains a cycle.");
        }
    }

    public async Task<bool> UpdateAdminIcsPositionStandardStatusAsync(int icsPositionId, bool isNimsStandard, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ref.IcsPosition
            SET IsNimsStandard = @isNimsStandard
            WHERE IcsPositionId = @icsPositionId;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@icsPositionId", SqlDbType.Int) { Value = icsPositionId });
        command.Parameters.Add(new SqlParameter("@isNimsStandard", SqlDbType.Bit) { Value = isNimsStandard });

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    public async Task<int> CreateLookupValueAsync(string codeSetName, CreateLookupValueRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            DECLARE @codeSetId int;
            SELECT @codeSetId = cs.CodeSetId
            FROM ref.CodeSet cs
            WHERE cs.CodeSetName = @codeSetName;

            IF @codeSetId IS NULL
            BEGIN
                THROW 51040, 'Lookup code set was not found.', 1;
            END;

            INSERT INTO ref.CodeValue
            (
                CodeSetId,
                Code,
                DisplayName,
                SortOrder,
                IsActive,
                Description
            )
            OUTPUT INSERTED.CodeValueId
            VALUES
            (
                @codeSetId,
                @code,
                @displayName,
                COALESCE(@sortOrder, 100),
                1,
                @description
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

            command.Parameters.Add(new SqlParameter("@codeSetName", SqlDbType.NVarChar, 128) { Value = codeSetName });
            command.Parameters.Add(new SqlParameter("@code", SqlDbType.NVarChar, 80) { Value = request.Code });
            command.Parameters.Add(new SqlParameter("@displayName", SqlDbType.NVarChar, 200) { Value = request.DisplayName });
            command.Parameters.Add(new SqlParameter("@sortOrder", SqlDbType.Int) { Value = (object?)request.SortOrder ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@description", SqlDbType.NVarChar, 1000) { Value = (object?)request.Description ?? DBNull.Value });

            var codeValueId = (int)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("Lookup value creation did not return a code value identifier."));

            _logger.LogInformation("Created lookup value {CodeValueId} in code set {CodeSetName}.", codeValueId, codeSetName);
            return codeValueId;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while creating lookup value in code set {CodeSetName}.", codeSetName);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating lookup value in code set {CodeSetName}.", codeSetName);
            throw;
        }
    }

    public async Task<bool> UpdateLookupValueAsync(string codeSetName, int codeValueId, UpdateLookupValueRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE cv
            SET DisplayName = @displayName,
                SortOrder = COALESCE(@sortOrder, cv.SortOrder),
                Description = @description,
                IsActive = COALESCE(@isActive, cv.IsActive)
            FROM ref.CodeValue cv
            INNER JOIN ref.CodeSet cs ON cs.CodeSetId = cv.CodeSetId
            WHERE cs.CodeSetName = @codeSetName
              AND cv.CodeValueId = @codeValueId;
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

            command.Parameters.Add(new SqlParameter("@codeSetName", SqlDbType.NVarChar, 128) { Value = codeSetName });
            command.Parameters.Add(new SqlParameter("@codeValueId", SqlDbType.Int) { Value = codeValueId });
            command.Parameters.Add(new SqlParameter("@displayName", SqlDbType.NVarChar, 200) { Value = request.DisplayName });
            command.Parameters.Add(new SqlParameter("@sortOrder", SqlDbType.Int) { Value = (object?)request.SortOrder ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@description", SqlDbType.NVarChar, 1000) { Value = (object?)request.Description ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@isActive", SqlDbType.Bit) { Value = (object?)request.IsActive ?? DBNull.Value });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Updated lookup value {CodeValueId} in code set {CodeSetName}. Rows affected: {RowsAffected}.", codeValueId, codeSetName, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while updating lookup value {CodeValueId} in code set {CodeSetName}.", codeValueId, codeSetName);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while updating lookup value {CodeValueId} in code set {CodeSetName}.", codeValueId, codeSetName);
            throw;
        }
    }

    private static DateTimeOffset? ReadNullableDateTimeOffset(SqlDataReader reader, int ordinal)
    {
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        var rawValue = reader.GetValue(ordinal);
        return rawValue switch
        {
            DateTimeOffset dto => dto,
            DateTime dt => new DateTimeOffset(DateTime.SpecifyKind(dt, DateTimeKind.Utc)),
            _ => null,
        };
    }

    private async Task<bool> IsLocationAddressColumnsAvailableAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        if (_locationAddressColumnsAvailable.HasValue)
        {
            return _locationAddressColumnsAvailable.Value;
        }

        const string sql = """
            SELECT CASE
                WHEN COL_LENGTH('org.Location', 'CityName') IS NOT NULL
                 AND COL_LENGTH('org.Location', 'StateCode') IS NOT NULL
                 AND COL_LENGTH('org.Location', 'PostalCode') IS NOT NULL
                THEN 1
                ELSE 0
            END;
            """;

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        var value = await command.ExecuteScalarAsync(cancellationToken);
        var available = value is int intValue && intValue == 1;

        _locationAddressColumnsAvailable = available;
        if (!available)
        {
            _logger.LogWarning("org.Location address columns (CityName/StateCode/PostalCode) are unavailable. Falling back to legacy location query/update behavior.");
        }

        return available;
    }
}

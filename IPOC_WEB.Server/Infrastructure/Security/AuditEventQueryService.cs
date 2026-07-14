using System.Data;
using IPOC_WEB.Server.Infrastructure.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace IPOC_WEB.Server.Infrastructure.Security;

public sealed record AuditEventListItemDto(
    long AuditEventId,
    DateTimeOffset EventUtc,
    long? ActorUserId,
    string? ActorDisplayName,
    string EventCategory,
    string EventAction,
    string? EntitySchemaName,
    string? EntityTableName,
    string? EntityPrimaryKey,
    long? IncidentId,
    long? LocationId,
    string? ClientIpAddress,
    string OutcomeCode,
    string? DetailJson);

public interface IAuditEventQueryService
{
    Task<(IReadOnlyList<AuditEventListItemDto> Items, int TotalCount)> GetAuditEventsAsync(
        long? incidentId,
        string? eventCategory,
        string? outcomeCode,
        DateTimeOffset? fromUtc,
        DateTimeOffset? toUtc,
        int pageNumber,
        int pageSize,
        string? eventAction,
        CancellationToken cancellationToken);
}

public sealed class AuditEventQueryService : IAuditEventQueryService
{
    private readonly string _connectionString;
    private readonly ILogger<AuditEventQueryService> _logger;
    private readonly bool _degradedReadFallbackEnabled;

    public AuditEventQueryService(IConfiguration configuration, IHostEnvironment hostEnvironment, IOptions<SqlDataOptions> sqlOptions, ILogger<AuditEventQueryService> logger)
    {
        _logger = logger;

        var configuredConnectionName = sqlOptions.Value.ConnectionStringName;
        _connectionString = configuration.GetConnectionString(configuredConnectionName)
            ?? throw new InvalidOperationException($"Connection string '{configuredConnectionName}' is not configured.");

        _degradedReadFallbackEnabled = hostEnvironment.IsDevelopment()
            && configuration.GetValue("SqlData:EnableDegradedReadFallback", true);
    }

    public async Task<(IReadOnlyList<AuditEventListItemDto> Items, int TotalCount)> GetAuditEventsAsync(
        long? incidentId,
        string? eventCategory,
        string? outcomeCode,
        DateTimeOffset? fromUtc,
        DateTimeOffset? toUtc,
        int pageNumber,
        int pageSize,
        string? eventAction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT COUNT(1)
            FROM audit.AuditEvent ae
            WHERE (@incidentId IS NULL OR ae.IncidentId = @incidentId)
              AND (@eventCategory IS NULL OR ae.EventCategory = @eventCategory)
              AND (@eventAction IS NULL OR ae.EventAction = @eventAction)
              AND (@outcomeCode IS NULL OR ae.OutcomeCode = @outcomeCode)
              AND (@fromUtc IS NULL OR ae.EventUtc >= @fromUtc)
              AND (@toUtc IS NULL OR ae.EventUtc <= @toUtc);

            SELECT
                ae.AuditEventId,
                ae.EventUtc,
                ae.ActorUserId,
                u.DisplayName,
                ae.EventCategory,
                ae.EventAction,
                ae.EntitySchemaName,
                ae.EntityTableName,
                ae.EntityPrimaryKey,
                ae.IncidentId,
                ae.LocationId,
                ae.ClientIpAddress,
                ae.OutcomeCode,
                ae.DetailJson
            FROM audit.AuditEvent ae
            LEFT JOIN sec.AppUser u ON u.UserId = ae.ActorUserId
            WHERE (@incidentId IS NULL OR ae.IncidentId = @incidentId)
              AND (@eventCategory IS NULL OR ae.EventCategory = @eventCategory)
              AND (@eventAction IS NULL OR ae.EventAction = @eventAction)
              AND (@outcomeCode IS NULL OR ae.OutcomeCode = @outcomeCode)
              AND (@fromUtc IS NULL OR ae.EventUtc >= @fromUtc)
              AND (@toUtc IS NULL OR ae.EventUtc <= @toUtc)
            ORDER BY ae.EventUtc DESC, ae.AuditEventId DESC
            OFFSET @offset ROWS
            FETCH NEXT @pageSize ROWS ONLY;
            """;

        var events = new List<AuditEventListItemDto>();

        var normalizedPageNumber = Math.Max(1, pageNumber);
        var normalizedPageSize = Math.Clamp(pageSize, 1, 200);
        var offset = (normalizedPageNumber - 1) * normalizedPageSize;

        var normalizedEventCategory = string.IsNullOrWhiteSpace(eventCategory) ? null : eventCategory.Trim();
        var normalizedEventAction = string.IsNullOrWhiteSpace(eventAction) ? null : eventAction.Trim();
        var normalizedOutcomeCode = string.IsNullOrWhiteSpace(outcomeCode) ? null : outcomeCode.Trim();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = (object?)incidentId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@eventCategory", SqlDbType.NVarChar, 80) { Value = (object?)normalizedEventCategory ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@eventAction", SqlDbType.NVarChar, 120) { Value = (object?)normalizedEventAction ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@outcomeCode", SqlDbType.NVarChar, 40) { Value = (object?)normalizedOutcomeCode ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@fromUtc", SqlDbType.DateTime2) { Value = (object?)fromUtc?.UtcDateTime ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@toUtc", SqlDbType.DateTime2) { Value = (object?)toUtc?.UtcDateTime ?? DBNull.Value });
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
                events.Add(new AuditEventListItemDto(
                    AuditEventId: reader.GetInt64(0),
                    EventUtc: new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(1), DateTimeKind.Utc)),
                    ActorUserId: reader.IsDBNull(2) ? null : reader.GetInt64(2),
                    ActorDisplayName: reader.IsDBNull(3) ? null : reader.GetString(3),
                    EventCategory: reader.GetString(4),
                    EventAction: reader.GetString(5),
                    EntitySchemaName: reader.IsDBNull(6) ? null : reader.GetString(6),
                    EntityTableName: reader.IsDBNull(7) ? null : reader.GetString(7),
                    EntityPrimaryKey: reader.IsDBNull(8) ? null : reader.GetString(8),
                    IncidentId: reader.IsDBNull(9) ? null : reader.GetInt64(9),
                    LocationId: reader.IsDBNull(10) ? null : reader.GetInt64(10),
                    ClientIpAddress: reader.IsDBNull(11) ? null : reader.GetString(11),
                    OutcomeCode: reader.GetString(12),
                    DetailJson: reader.IsDBNull(13) ? null : reader.GetString(13)));
            }

            return (events, totalCount);
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving audit events. Returning empty list due to degraded read fallback.");
                return ([], 0);
            }

            _logger.LogError(ex, "Database error while retrieving audit events.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving audit events.");
            throw;
        }
    }
}

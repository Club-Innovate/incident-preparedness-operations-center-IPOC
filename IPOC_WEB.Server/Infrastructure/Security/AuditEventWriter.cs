using System.Data;
using System.Security.Claims;
using IPOC_WEB.Server.Infrastructure.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace IPOC_WEB.Server.Infrastructure.Security;

public sealed record AuditEventWriteModel(
    long? ActorUserId,
    string EventCategory,
    string EventAction,
    string? EntitySchemaName,
    string? EntityTableName,
    string? EntityPrimaryKey,
    long? IncidentId,
    long? LocationId,
    string OutcomeCode,
    string? DetailJson);

public interface IAuditEventWriter
{
    Task WriteAsync(HttpContext httpContext, AuditEventWriteModel model, CancellationToken cancellationToken);
}

public sealed class AuditEventWriter : IAuditEventWriter
{
    private readonly string _connectionString;
    private readonly ILogger<AuditEventWriter> _logger;

    public AuditEventWriter(IConfiguration configuration, IOptions<SqlDataOptions> sqlOptions, ILogger<AuditEventWriter> logger)
    {
        _logger = logger;
        _connectionString = configuration.GetConnectionString(sqlOptions.Value.ConnectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{sqlOptions.Value.ConnectionStringName}' is not configured.");
    }

    public async Task WriteAsync(HttpContext httpContext, AuditEventWriteModel model, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO audit.AuditEvent
            (
                ActorUserId,
                EventCategory,
                EventAction,
                EntitySchemaName,
                EntityTableName,
                EntityPrimaryKey,
                IncidentId,
                LocationId,
                ClientIpAddress,
                OutcomeCode,
                DetailJson
            )
            VALUES
            (
                @ActorUserId,
                @EventCategory,
                @EventAction,
                @EntitySchemaName,
                @EntityTableName,
                @EntityPrimaryKey,
                @IncidentId,
                @LocationId,
                @ClientIpAddress,
                @OutcomeCode,
                @DetailJson
            );
            """;

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection);
            command.Parameters.Add(new SqlParameter("@ActorUserId", SqlDbType.BigInt) { Value = model.ActorUserId is null ? DBNull.Value : model.ActorUserId.Value });
            command.Parameters.Add(new SqlParameter("@EventCategory", SqlDbType.NVarChar, 80) { Value = model.EventCategory });
            command.Parameters.Add(new SqlParameter("@EventAction", SqlDbType.NVarChar, 120) { Value = model.EventAction });
            command.Parameters.Add(new SqlParameter("@EntitySchemaName", SqlDbType.NVarChar, 128) { Value = model.EntitySchemaName is null ? DBNull.Value : model.EntitySchemaName });
            command.Parameters.Add(new SqlParameter("@EntityTableName", SqlDbType.NVarChar, 128) { Value = model.EntityTableName is null ? DBNull.Value : model.EntityTableName });
            command.Parameters.Add(new SqlParameter("@EntityPrimaryKey", SqlDbType.NVarChar, 120) { Value = model.EntityPrimaryKey is null ? DBNull.Value : model.EntityPrimaryKey });
            command.Parameters.Add(new SqlParameter("@IncidentId", SqlDbType.BigInt) { Value = model.IncidentId is null ? DBNull.Value : model.IncidentId.Value });
            command.Parameters.Add(new SqlParameter("@LocationId", SqlDbType.BigInt) { Value = model.LocationId is null ? DBNull.Value : model.LocationId.Value });
            command.Parameters.Add(new SqlParameter("@ClientIpAddress", SqlDbType.VarChar, 45)
            {
                Value = httpContext.Connection.RemoteIpAddress?.ToString() is { Length: > 0 } ip ? ip : DBNull.Value
            });
            command.Parameters.Add(new SqlParameter("@OutcomeCode", SqlDbType.NVarChar, 40) { Value = model.OutcomeCode });
            command.Parameters.Add(new SqlParameter("@DetailJson", SqlDbType.NVarChar) { Value = model.DetailJson is null ? DBNull.Value : model.DetailJson });

            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Audit event write failed. Category: {Category}; Action: {Action}; TraceId: {TraceId}", model.EventCategory, model.EventAction, httpContext.TraceIdentifier);
        }
    }
}

public static class AuditHttpContextExtensions
{
    public static long? TryGetActorUserId(this HttpContext httpContext)
    {
        if (long.TryParse(httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var parsedUserId) && parsedUserId > 0)
        {
            return parsedUserId;
        }

        if (long.TryParse(httpContext.User.FindFirstValue("user_id"), out var fallbackUserId) && fallbackUserId > 0)
        {
            return fallbackUserId;
        }

        return null;
    }
}

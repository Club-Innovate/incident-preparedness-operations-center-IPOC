/*
File: IPOC_WEB.Server/Infrastructure/Incidents/IncidentQueryService.cs
Blueprint Name: IncidentDataAccess

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-14

Description:
Incident query and command data-access service using parameterized SQL operations.

Features:
  - Incident list and detail retrieval.
  - Incident activation and closure command handling.
  - Async database access with cancellation support.

Security & Compliance:
  - Uses parameterized SQL to reduce injection risk.
  - Limits returned fields to operationally necessary values.
  - Supports traceable operational changes via explicit state transitions.
*/

using System.Data;
using IPOC_WEB.Server.Infrastructure.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IPOC_WEB.Server.Infrastructure.Incidents;

public interface IIncidentQueryService
{
    Task<IReadOnlyList<IncidentSummaryDto>> GetIncidentsAsync(CancellationToken cancellationToken);
    Task<DashboardSummaryDto> GetDashboardSummaryAsync(CancellationToken cancellationToken);
    Task<IncidentDetailDto?> GetIncidentByIdAsync(long incidentId, CancellationToken cancellationToken);
    Task<long> CreateIncidentAsync(CreateIncidentRequestDto request, long createdByUserId, CancellationToken cancellationToken);
    Task<bool> UpdateIncidentAsync(long incidentId, UpdateIncidentRequestDto request, CancellationToken cancellationToken);
    Task<IReadOnlyList<IncidentTaskDto>> GetIncidentTasksAsync(long incidentId, CancellationToken cancellationToken);
    Task<long> CreateIncidentTaskAsync(long incidentId, CreateIncidentTaskRequestDto request, long createdByUserId, CancellationToken cancellationToken);
    Task<bool> UpdateIncidentTaskStatusAsync(long incidentId, long incidentTaskId, UpdateIncidentTaskStatusRequestDto request, CancellationToken cancellationToken);
    Task<bool> UpdateIncidentTaskAssignmentAsync(long incidentId, long incidentTaskId, long? assignedToUserId, CancellationToken cancellationToken);
    Task<IReadOnlyList<IncidentTimelineEventDto>> GetIncidentTimelineEventsAsync(long incidentId, CancellationToken cancellationToken);
    Task<long> CreateIncidentTimelineEventAsync(long incidentId, CreateIncidentTimelineEventRequestDto request, long createdByUserId, CancellationToken cancellationToken);
    Task<IReadOnlyList<IncidentCommunicationDto>> GetIncidentCommunicationsAsync(long incidentId, CancellationToken cancellationToken);
    Task<IncidentCommunicationLifecycleSummaryDto> GetIncidentCommunicationLifecycleSummaryAsync(long incidentId, DateTimeOffset? fromUtc, DateTimeOffset? toUtc, CancellationToken cancellationToken);
    Task<long> CreateIncidentCommunicationAsync(long incidentId, CreateIncidentCommunicationRequestDto request, long createdByUserId, CancellationToken cancellationToken);
    Task<bool> UpdateIncidentCommunicationAsync(long incidentId, long incidentCommunicationId, UpdateIncidentCommunicationRequestDto request, CancellationToken cancellationToken);
    Task<IReadOnlyList<IncidentResourceRequestDto>> GetIncidentResourceRequestsAsync(long incidentId, CancellationToken cancellationToken);
    Task<IncidentResourceLifecycleSummaryDto> GetIncidentResourceLifecycleSummaryAsync(long incidentId, CancellationToken cancellationToken);
    Task<long> CreateIncidentResourceRequestAsync(long incidentId, CreateIncidentResourceRequestDto request, long requestedByUserId, CancellationToken cancellationToken);
    Task<bool> UpdateIncidentResourceRequestAsync(long incidentId, long incidentResourceRequestId, UpdateIncidentResourceRequestDto request, CancellationToken cancellationToken);
    Task<IReadOnlyList<IncidentOperationalPeriodDto>> GetIncidentOperationalPeriodsAsync(long incidentId, CancellationToken cancellationToken);
    Task<long> CreateIncidentOperationalPeriodAsync(long incidentId, CreateIncidentOperationalPeriodRequestDto request, long createdByUserId, CancellationToken cancellationToken);
    Task<bool> UpdateIncidentOperationalPeriodAsync(long incidentId, long operationalPeriodId, UpdateIncidentOperationalPeriodRequestDto request, CancellationToken cancellationToken);
    Task<bool> ApproveIncidentOperationalPeriodAsync(long incidentId, long operationalPeriodId, long approvedByUserId, DateTimeOffset approvedUtc, CancellationToken cancellationToken);
    Task<bool> ReopenIncidentOperationalPeriodAsync(long incidentId, long operationalPeriodId, CancellationToken cancellationToken);
    Task<IReadOnlyList<IncidentObjectiveDto>> GetIncidentObjectivesAsync(long incidentId, CancellationToken cancellationToken);
    Task<long> CreateIncidentObjectiveAsync(long incidentId, CreateIncidentObjectiveRequestDto request, long createdByUserId, CancellationToken cancellationToken);
    Task<bool> UpdateIncidentObjectiveAsync(long incidentId, long incidentObjectiveId, UpdateIncidentObjectiveRequestDto request, CancellationToken cancellationToken);
    Task<IReadOnlyList<IcsPositionDto>> GetIcsPositionsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<IncidentCommandAssignmentDto>> GetIncidentCommandAssignmentsAsync(long incidentId, CancellationToken cancellationToken);
    Task<IReadOnlyList<IncidentCommandTransferLogEntryDto>> GetIncidentCommandTransferLogAsync(long incidentId, CancellationToken cancellationToken);
    Task UpsertIncidentCommandAssignmentAsync(long incidentId, UpsertIncidentCommandAssignmentRequestDto request, long assignedByUserId, CancellationToken cancellationToken);
    Task UpsertIncidentCommandTransferAsync(long incidentId, CreateIncidentCommandTransferRequestDto request, long assignedByUserId, CancellationToken cancellationToken);
    Task<bool> RemoveIncidentCommandAssignmentAsync(long incidentId, int icsPositionId, CancellationToken cancellationToken);
    Task<bool> ActivateIncidentAsync(long incidentId, CancellationToken cancellationToken);
    Task<bool> CloseIncidentAsync(long incidentId, CancellationToken cancellationToken);
    Task<Ics201DataDto?> GetIcs201DataAsync(long incidentId, CancellationToken cancellationToken);
    Task<Ics202IncidentObjectivesDto?> GetIcs202DataAsync(long incidentId, CancellationToken cancellationToken);
    Task<Ics203OrganizationAssignmentListDto?> GetIcs203DataAsync(long incidentId, CancellationToken cancellationToken);
    Task<Ics204AssignmentListDto?> GetIcs204DataAsync(long incidentId, CancellationToken cancellationToken);
    Task<Ics205CommunicationsPlanDto?> GetIcs205DataAsync(long incidentId, CancellationToken cancellationToken);
    Task<Ics214ActivityLogDto?> GetIcs214DataAsync(long incidentId, CancellationToken cancellationToken);
    Task<Ics215IncidentActionPlanSafetyAnalysisDto?> GetIcs215DataAsync(long incidentId, CancellationToken cancellationToken);
    Task<Ics209IncidentStatusSummaryDto?> GetIcs209DataAsync(long incidentId, CancellationToken cancellationToken);
    Task<IncidentIapPacketDto?> GetIncidentIapPacketAsync(long incidentId, CancellationToken cancellationToken);
    Task<IReadOnlyList<SituationReportDto>> GetSituationReportsAsync(long incidentId, CancellationToken cancellationToken);
    Task<long> CreateSituationReportAsync(long incidentId, GenerateSituationReportRequestDto request, long reportedByUserId, CancellationToken cancellationToken);
}

public sealed class IncidentQueryService : IIncidentQueryService
{
    private readonly string _connectionString;
    private readonly ILogger<IncidentQueryService> _logger;
    private readonly bool _degradedReadFallbackEnabled;

    private static bool IsOperationalPeriodStatusTransitionAllowed(string currentStatus, string nextStatus)
    {
        if (string.Equals(currentStatus, nextStatus, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.Equals(currentStatus, "Planned", StringComparison.OrdinalIgnoreCase))
        {
            return string.Equals(nextStatus, "Active", StringComparison.OrdinalIgnoreCase)
                || string.Equals(nextStatus, "Approved", StringComparison.OrdinalIgnoreCase)
                || string.Equals(nextStatus, "Cancelled", StringComparison.OrdinalIgnoreCase);
        }

        if (string.Equals(currentStatus, "Active", StringComparison.OrdinalIgnoreCase))
        {
            return string.Equals(nextStatus, "Approved", StringComparison.OrdinalIgnoreCase)
                || string.Equals(nextStatus, "Closed", StringComparison.OrdinalIgnoreCase)
                || string.Equals(nextStatus, "Cancelled", StringComparison.OrdinalIgnoreCase);
        }

        if (string.Equals(currentStatus, "Approved", StringComparison.OrdinalIgnoreCase))
        {
            return string.Equals(nextStatus, "Active", StringComparison.OrdinalIgnoreCase)
                || string.Equals(nextStatus, "Closed", StringComparison.OrdinalIgnoreCase)
                || string.Equals(nextStatus, "Cancelled", StringComparison.OrdinalIgnoreCase);
        }

        if (string.Equals(currentStatus, "Closed", StringComparison.OrdinalIgnoreCase)
            || string.Equals(currentStatus, "Cancelled", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return false;
    }

    private static bool IsOperationalPeriodEditableStatus(string status)
    {
        return string.Equals(status, "Planned", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase);
    }

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

    private static long ReadInt64Flexible(SqlDataReader reader, int ordinal)
    {
        var rawValue = reader.GetValue(ordinal);

        return rawValue switch
        {
            long value => value,
            int value => value,
            short value => value,
            byte value => value,
            decimal value => decimal.ToInt64(value),
            double value => Convert.ToInt64(value, System.Globalization.CultureInfo.InvariantCulture),
            float value => Convert.ToInt64(value, System.Globalization.CultureInfo.InvariantCulture),
            _ => Convert.ToInt64(rawValue, System.Globalization.CultureInfo.InvariantCulture),
        };
    }

    public IncidentQueryService(IConfiguration configuration, IHostEnvironment hostEnvironment, IOptions<SqlDataOptions> sqlOptions, ILogger<IncidentQueryService> logger)
    {
        _logger = logger;

        var configuredConnectionName = sqlOptions.Value.ConnectionStringName;
        _connectionString = configuration.GetConnectionString(configuredConnectionName)
            ?? throw new InvalidOperationException($"Connection string '{configuredConnectionName}' is not configured.");

        _degradedReadFallbackEnabled = hostEnvironment.IsDevelopment()
            && configuration.GetValue("SqlData:EnableDegradedReadFallback", true);
    }

    public async Task<DashboardSummaryDto> GetDashboardSummaryAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                (SELECT COUNT_BIG(*) FROM ic.Incident) AS TotalIncidentCount,
                (SELECT COUNT_BIG(*) FROM ic.Incident WHERE IncidentStatusCode <> 'Closed') AS ActiveIncidentCount,
                (SELECT COUNT_BIG(*) FROM ic.IncidentTask WHERE StatusCode <> 'Completed') AS OpenTaskCount,
                (SELECT COUNT_BIG(*) FROM ic.IncidentTask
                 WHERE StatusCode <> 'Completed'
                   AND DueUtc IS NOT NULL
                   AND DueUtc < SYSUTCDATETIME()) AS OverdueTaskCount,
                (SELECT COUNT_BIG(*) FROM ic.IncidentObjective WHERE StatusCode <> 'Completed') AS OpenObjectiveCount,
                (SELECT MAX(ReportedUtc) FROM ic.SituationReport) AS LatestSitrepUtc,
                (SELECT COUNT_BIG(*) FROM ic.SituationReport WHERE ReportedUtc >= DATEADD(HOUR, -24, SYSUTCDATETIME())) AS SitrepsLast24HoursCount;
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

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            if (!await reader.ReadAsync(cancellationToken))
            {
                return new DashboardSummaryDto(0, 0, 0, 0, 0, null, 0);
            }

            return new DashboardSummaryDto(
                reader.GetInt64(0),
                reader.GetInt64(1),
                reader.GetInt64(2),
                reader.GetInt64(3),
                reader.GetInt64(4),
                ReadNullableDateTimeOffset(reader, 5),
                reader.GetInt64(6));
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving dashboard summary. Returning zeroed summary due to degraded read fallback.");
                return new DashboardSummaryDto(0, 0, 0, 0, 0, null, 0);
            }

            _logger.LogError(ex, "Database error while retrieving dashboard summary.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving dashboard summary.");
            throw;
        }
    }

    public async Task<Ics204AssignmentListDto?> GetIcs204DataAsync(long incidentId, CancellationToken cancellationToken)
    {
        try
        {
            var incidentDetail = await GetIncidentByIdAsync(incidentId, cancellationToken);
            if (incidentDetail is null)
            {
                return null;
            }

            var periods = await GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
            var currentPeriod = periods
                .Where(p => p.StartUtc <= DateTimeOffset.UtcNow && (p.EndUtc >= DateTimeOffset.UtcNow || p.StatusCode == "Active"))
                .OrderByDescending(p => p.StartUtc)
                .FirstOrDefault();

            var objectives = await GetIncidentObjectivesAsync(incidentId, cancellationToken);
            var objectiveByPeriod = objectives
                .Where(o => o.OperationalPeriodId.HasValue)
                .GroupBy(o => o.OperationalPeriodId!.Value)
                .ToDictionary(
                    group => group.Key,
                    group => group.OrderBy(o => o.ObjectiveNumber).FirstOrDefault());
            var defaultObjective = objectives
                .Where(o => o.OperationalPeriodId is null)
                .OrderBy(o => o.ObjectiveNumber)
                .FirstOrDefault();

            var tasks = await GetIncidentTasksAsync(incidentId, cancellationToken);
            var orderedTasks = tasks
                .OrderBy(t => t.DueUtc ?? DateTimeOffset.MaxValue)
                .ThenByDescending(t => string.Equals(t.PriorityCode, "Critical", StringComparison.OrdinalIgnoreCase))
                .ThenByDescending(t => string.Equals(t.PriorityCode, "High", StringComparison.OrdinalIgnoreCase))
                .ThenBy(t => t.CreatedUtc)
                .Take(100)
                .ToList();

            var assignments = orderedTasks
                .Select(task =>
                {
                    var objective = currentPeriod is not null
                        && objectiveByPeriod.TryGetValue(currentPeriod.OperationalPeriodId, out var periodObjective)
                            ? periodObjective
                            : defaultObjective;

                    var objectiveReference = objective is not null
                        ? $"#{objective.ObjectiveNumber} {objective.ObjectiveText}"
                        : null;

                    return new Ics204AssignmentItemDto(
                        task.IncidentTaskId,
                        task.TaskNumber,
                        task.TaskTitle,
                        task.PriorityCode,
                        task.StatusCode,
                        task.AssignedToUserDisplayName,
                        task.DueUtc,
                        objectiveReference);
                })
                .ToList();

            return new Ics204AssignmentListDto(
                incidentDetail,
                currentPeriod,
                assignments,
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while retrieving ICS-204 data for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<bool> UpdateIncidentOperationalPeriodAsync(long incidentId, long operationalPeriodId, UpdateIncidentOperationalPeriodRequestDto request, CancellationToken cancellationToken)
    {
        const string getStatusSql = """
            SELECT p.StatusCode
            FROM ic.IncidentOperationalPeriod p
            WHERE p.IncidentId = @incidentId
              AND p.OperationalPeriodId = @operationalPeriodId;
            """;

        const string sql = """
            UPDATE ic.IncidentOperationalPeriod
            SET PeriodNumber = @periodNumber,
                PeriodName = @periodName,
                StartUtc = @startUtc,
                EndUtc = @endUtc,
                StatusCode = @statusCode,
                PlanningMeetingUtc = @planningMeetingUtc,
                ApprovedByUserId = @approvedByUserId,
                ApprovedUtc = @approvedUtc
            WHERE IncidentId = @incidentId
              AND OperationalPeriodId = @operationalPeriodId;
            """;

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using (var statusCommand = new SqlCommand(getStatusSql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            })
            {
                statusCommand.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
                statusCommand.Parameters.Add(new SqlParameter("@operationalPeriodId", SqlDbType.BigInt) { Value = operationalPeriodId });

                var statusValue = await statusCommand.ExecuteScalarAsync(cancellationToken);
                if (statusValue is null || statusValue is DBNull)
                {
                    return false;
                }

                var currentStatus = Convert.ToString(statusValue, System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty;
                if (!IsOperationalPeriodStatusTransitionAllowed(currentStatus, request.StatusCode))
                {
                    _logger.LogWarning("Blocked invalid operational period transition for IncidentId {IncidentId}, OperationalPeriodId {OperationalPeriodId}: {CurrentStatus} -> {NextStatus}.", incidentId, operationalPeriodId, currentStatus, request.StatusCode);
                    return false;
                }
            }

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@operationalPeriodId", SqlDbType.BigInt) { Value = operationalPeriodId });
            command.Parameters.Add(new SqlParameter("@periodNumber", SqlDbType.Int) { Value = request.PeriodNumber });
            command.Parameters.Add(new SqlParameter("@periodName", SqlDbType.NVarChar, 200) { Value = (object?)request.PeriodName ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@startUtc", SqlDbType.DateTimeOffset) { Value = request.StartUtc });
            command.Parameters.Add(new SqlParameter("@endUtc", SqlDbType.DateTimeOffset) { Value = request.EndUtc });
            command.Parameters.Add(new SqlParameter("@statusCode", SqlDbType.NVarChar, 40) { Value = request.StatusCode });
            command.Parameters.Add(new SqlParameter("@planningMeetingUtc", SqlDbType.DateTimeOffset) { Value = (object?)request.PlanningMeetingUtc ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@approvedByUserId", SqlDbType.BigInt) { Value = (object?)request.ApprovedByUserId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@approvedUtc", SqlDbType.DateTimeOffset) { Value = (object?)request.ApprovedUtc ?? DBNull.Value });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Updated operational period {OperationalPeriodId} for IncidentId {IncidentId}. Rows affected: {RowsAffected}.", operationalPeriodId, incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while updating operational period {OperationalPeriodId} for IncidentId {IncidentId}.", operationalPeriodId, incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while updating operational period {OperationalPeriodId} for IncidentId {IncidentId}.", operationalPeriodId, incidentId);
            throw;
        }
    }

    public async Task<bool> ApproveIncidentOperationalPeriodAsync(long incidentId, long operationalPeriodId, long approvedByUserId, DateTimeOffset approvedUtc, CancellationToken cancellationToken)
    {
        const string getStatusSql = """
            SELECT p.StatusCode
            FROM ic.IncidentOperationalPeriod p
            WHERE p.IncidentId = @incidentId
              AND p.OperationalPeriodId = @operationalPeriodId;
            """;

        const string sql = """
            UPDATE ic.IncidentOperationalPeriod
            SET StatusCode = @statusCode,
                ApprovedByUserId = @approvedByUserId,
                ApprovedUtc = @approvedUtc
            WHERE IncidentId = @incidentId
              AND OperationalPeriodId = @operationalPeriodId
              AND StatusCode <> 'Closed'
              AND StatusCode <> 'Cancelled';
            """;

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using (var statusCommand = new SqlCommand(getStatusSql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            })
            {
                statusCommand.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
                statusCommand.Parameters.Add(new SqlParameter("@operationalPeriodId", SqlDbType.BigInt) { Value = operationalPeriodId });

                var statusValue = await statusCommand.ExecuteScalarAsync(cancellationToken);
                if (statusValue is null || statusValue is DBNull)
                {
                    return false;
                }

                var currentStatus = Convert.ToString(statusValue, System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty;
                if (!IsOperationalPeriodStatusTransitionAllowed(currentStatus, "Approved"))
                {
                    _logger.LogWarning("Blocked invalid operational period approval transition for IncidentId {IncidentId}, OperationalPeriodId {OperationalPeriodId}: {CurrentStatus} -> Approved.", incidentId, operationalPeriodId, currentStatus);
                    return false;
                }
            }

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@operationalPeriodId", SqlDbType.BigInt) { Value = operationalPeriodId });
            command.Parameters.Add(new SqlParameter("@statusCode", SqlDbType.NVarChar, 40) { Value = "Approved" });
            command.Parameters.Add(new SqlParameter("@approvedByUserId", SqlDbType.BigInt) { Value = approvedByUserId });
            command.Parameters.Add(new SqlParameter("@approvedUtc", SqlDbType.DateTimeOffset) { Value = approvedUtc });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Approved operational period {OperationalPeriodId} for IncidentId {IncidentId} by user {ApprovedByUserId}. Rows affected: {RowsAffected}.", operationalPeriodId, incidentId, approvedByUserId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while approving operational period {OperationalPeriodId} for IncidentId {IncidentId}.", operationalPeriodId, incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while approving operational period {OperationalPeriodId} for IncidentId {IncidentId}.", operationalPeriodId, incidentId);
            throw;
        }
    }

    public async Task<bool> ReopenIncidentOperationalPeriodAsync(long incidentId, long operationalPeriodId, CancellationToken cancellationToken)
    {
        const string getStatusSql = """
            SELECT p.StatusCode
            FROM ic.IncidentOperationalPeriod p
            WHERE p.IncidentId = @incidentId
              AND p.OperationalPeriodId = @operationalPeriodId;
            """;

        const string sql = """
            UPDATE ic.IncidentOperationalPeriod
            SET StatusCode = @statusCode,
                ApprovedByUserId = NULL,
                ApprovedUtc = NULL
            WHERE IncidentId = @incidentId
              AND OperationalPeriodId = @operationalPeriodId
              AND StatusCode = 'Approved';
            """;

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using (var statusCommand = new SqlCommand(getStatusSql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            })
            {
                statusCommand.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
                statusCommand.Parameters.Add(new SqlParameter("@operationalPeriodId", SqlDbType.BigInt) { Value = operationalPeriodId });

                var statusValue = await statusCommand.ExecuteScalarAsync(cancellationToken);
                if (statusValue is null || statusValue is DBNull)
                {
                    return false;
                }

                var currentStatus = Convert.ToString(statusValue, System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty;
                if (!IsOperationalPeriodStatusTransitionAllowed(currentStatus, "Active"))
                {
                    _logger.LogWarning("Blocked invalid operational period reopen transition for IncidentId {IncidentId}, OperationalPeriodId {OperationalPeriodId}: {CurrentStatus} -> Active.", incidentId, operationalPeriodId, currentStatus);
                    return false;
                }
            }

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@operationalPeriodId", SqlDbType.BigInt) { Value = operationalPeriodId });
            command.Parameters.Add(new SqlParameter("@statusCode", SqlDbType.NVarChar, 40) { Value = "Active" });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Reopened operational period {OperationalPeriodId} for IncidentId {IncidentId}. Rows affected: {RowsAffected}.", operationalPeriodId, incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while reopening operational period {OperationalPeriodId} for IncidentId {IncidentId}.", operationalPeriodId, incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while reopening operational period {OperationalPeriodId} for IncidentId {IncidentId}.", operationalPeriodId, incidentId);
            throw;
        }
    }

    public async Task<Ics214ActivityLogDto?> GetIcs214DataAsync(long incidentId, CancellationToken cancellationToken)
    {
        try
        {
            var incidentDetail = await GetIncidentByIdAsync(incidentId, cancellationToken);
            if (incidentDetail is null)
            {
                return null;
            }

            var periods = await GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
            var currentPeriod = periods
                .Where(p => p.StartUtc <= DateTimeOffset.UtcNow && (p.EndUtc >= DateTimeOffset.UtcNow || p.StatusCode == "Active"))
                .OrderByDescending(p => p.StartUtc)
                .FirstOrDefault();

            var timelineEvents = await GetIncidentTimelineEventsAsync(incidentId, cancellationToken);
            var communications = await GetIncidentCommunicationsAsync(incidentId, cancellationToken);

            var timelineEntries = timelineEvents.Select(item =>
                new Ics214ActivityLogEntryDto(
                    item.EventUtc,
                    "Timeline",
                    item.EventTitle,
                    item.EventDescription,
                    null));

            var communicationEntries = communications.Select(item =>
                new Ics214ActivityLogEntryDto(
                    item.LoggedUtc,
                    "Communication",
                    item.Subject,
                    item.Message,
                    item.CreatedByUserDisplayName));

            var entries = timelineEntries
                .Concat(communicationEntries)
                .OrderByDescending(item => item.ActivityUtc)
                .Take(150)
                .ToList();

            return new Ics214ActivityLogDto(
                incidentDetail,
                currentPeriod,
                entries,
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while retrieving ICS-214 data for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<Ics215IncidentActionPlanSafetyAnalysisDto?> GetIcs215DataAsync(long incidentId, CancellationToken cancellationToken)
    {
        try
        {
            var incidentDetail = await GetIncidentByIdAsync(incidentId, cancellationToken);
            if (incidentDetail is null)
            {
                return null;
            }

            var periods = await GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
            var currentPeriod = periods
                .Where(p => p.StartUtc <= DateTimeOffset.UtcNow && (p.EndUtc >= DateTimeOffset.UtcNow || p.StatusCode == "Active"))
                .OrderByDescending(p => p.StartUtc)
                .FirstOrDefault();

            var objectives = await GetIncidentObjectivesAsync(incidentId, cancellationToken);
            var openHighRiskObjectives = objectives
                .Where(o => !string.Equals(o.StatusCode, "Completed", StringComparison.OrdinalIgnoreCase)
                    && (string.Equals(o.PriorityCode, "High", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(o.PriorityCode, "Critical", StringComparison.OrdinalIgnoreCase)))
                .OrderBy(o => o.ObjectiveNumber)
                .Take(25)
                .ToList();

            var tasks = await GetIncidentTasksAsync(incidentId, cancellationToken);
            var overdueTasks = tasks
                .Where(t => !string.Equals(t.StatusCode, "Completed", StringComparison.OrdinalIgnoreCase)
                    && t.DueUtc.HasValue
                    && t.DueUtc.Value < DateTimeOffset.UtcNow)
                .OrderBy(t => t.DueUtc)
                .Take(25)
                .ToList();

            var resources = await GetIncidentResourceRequestsAsync(incidentId, cancellationToken);
            var unassignedCriticalResources = resources
                .Where(r => !string.Equals(r.StatusCode, "Fulfilled", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(r.StatusCode, "Cancelled", StringComparison.OrdinalIgnoreCase)
                    && (string.Equals(r.PriorityCode, "High", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(r.PriorityCode, "Critical", StringComparison.OrdinalIgnoreCase))
                    && (r.AssignedQuantity ?? 0m) < r.RequestedQuantity)
                .OrderByDescending(r => r.RequestedQuantity - (r.AssignedQuantity ?? 0m))
                .Take(25)
                .ToList();

            var safetyItems = new List<Ics215SafetyAnalysisItemDto>();

            safetyItems.AddRange(openHighRiskObjectives.Select(objective => new Ics215SafetyAnalysisItemDto(
                "Objective",
                $"Objective #{objective.ObjectiveNumber}: {objective.ObjectiveText}",
                objective.PriorityCode,
                "Track objective in current operational period and assign mitigation owner.",
                objective.OwnerUserId is > 0 ? $"User #{objective.OwnerUserId.Value}" : null)));

            safetyItems.AddRange(overdueTasks.Select(task => new Ics215SafetyAnalysisItemDto(
                "Task",
                $"Overdue task: {task.TaskTitle}",
                "High",
                "Expedite completion or reassign task owner with immediate follow-up.",
                task.AssignedToUserDisplayName)));

            safetyItems.AddRange(unassignedCriticalResources.Select(resource => new Ics215SafetyAnalysisItemDto(
                "Resource",
                $"Resource gap: {resource.ResourceTypeName} ({resource.AssignedQuantity ?? 0m:0.##}/{resource.RequestedQuantity:0.##} {resource.UnitOfMeasureCode} assigned)",
                resource.PriorityCode,
                "Escalate sourcing and update staging/assignment status.",
                null)));

            return new Ics215IncidentActionPlanSafetyAnalysisDto(
                incidentDetail,
                currentPeriod,
                safetyItems.Take(100).ToList(),
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while retrieving ICS-215 data for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<IReadOnlyList<IncidentSummaryDto>> GetIncidentsAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (200)
                i.IncidentId,
                i.IncidentNumber,
                i.IncidentName,
                i.IncidentTypeCode,
                i.IncidentStatusCode,
                i.SeverityCode,
                i.ActivatedUtc,
                i.CreatedUtc
            FROM ic.Incident i
            ORDER BY i.CreatedUtc DESC;
            """;

        var incidents = new List<IncidentSummaryDto>();

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
                incidents.Add(new IncidentSummaryDto(
                    reader.GetInt64(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetString(4),
                    reader.IsDBNull(5) ? null : reader.GetString(5),
                    ReadNullableDateTimeOffset(reader, 6),
                    ReadDateTimeOffset(reader, 7)));
            }

            _logger.LogInformation("Retrieved {IncidentCount} incidents from database.", incidents.Count);
            return incidents;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving incident summaries. Returning empty incident list due to degraded read fallback.");
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving incident summaries.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving incident summaries.");
            throw;
        }
    }

    public async Task<bool> UpdateIncidentObjectiveAsync(long incidentId, long incidentObjectiveId, UpdateIncidentObjectiveRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ic.IncidentObjective
            SET OperationalPeriodId = @operationalPeriodId,
                ObjectiveNumber = @objectiveNumber,
                ObjectiveText = @objectiveText,
                PriorityCode = @priorityCode,
                StatusCode = @statusCode,
                OwnerUserId = @ownerUserId,
                DueUtc = @dueUtc
            WHERE IncidentId = @incidentId
              AND IncidentObjectiveId = @incidentObjectiveId;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@incidentObjectiveId", SqlDbType.BigInt) { Value = incidentObjectiveId });
            command.Parameters.Add(new SqlParameter("@operationalPeriodId", SqlDbType.BigInt) { Value = (object?)request.OperationalPeriodId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@objectiveNumber", SqlDbType.Int) { Value = request.ObjectiveNumber });
            command.Parameters.Add(new SqlParameter("@objectiveText", SqlDbType.NVarChar, -1) { Value = request.ObjectiveText });
            command.Parameters.Add(new SqlParameter("@priorityCode", SqlDbType.NVarChar, 40) { Value = request.PriorityCode });
            command.Parameters.Add(new SqlParameter("@statusCode", SqlDbType.NVarChar, 40) { Value = request.StatusCode });
            command.Parameters.Add(new SqlParameter("@ownerUserId", SqlDbType.BigInt) { Value = (object?)request.OwnerUserId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@dueUtc", SqlDbType.DateTimeOffset) { Value = (object?)request.DueUtc ?? DBNull.Value });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Updated objective {IncidentObjectiveId} for IncidentId {IncidentId}. Rows affected: {RowsAffected}.", incidentObjectiveId, incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while updating objective {IncidentObjectiveId} for IncidentId {IncidentId}.", incidentObjectiveId, incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while updating objective {IncidentObjectiveId} for IncidentId {IncidentId}.", incidentObjectiveId, incidentId);
            throw;
        }
    }

    public async Task<IncidentDetailDto?> GetIncidentByIdAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                i.IncidentId,
                i.IncidentNumber,
                i.IncidentName,
                i.IncidentTypeCode,
                i.IncidentStatusCode,
                i.SeverityCode,
                i.LeadOrganizationId,
                i.LeadRegionId,
                i.PrimaryLocationId,
                i.IsPlannedEvent,
                i.StartedUtc,
                i.ActivatedUtc,
                i.ClosedUtc,
                i.InitialSummary,
                i.SituationSummary,
                i.CreatedByUserId,
                i.CreatedUtc,
                i.UpdatedUtc
            FROM ic.Incident i
            WHERE i.IncidentId = @incidentId;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            if (!await reader.ReadAsync(cancellationToken))
            {
                _logger.LogInformation("Incident detail not found for IncidentId {IncidentId}.", incidentId);
                return null;
            }

            return new IncidentDetailDto(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetInt64(6),
                reader.IsDBNull(7) ? null : reader.GetInt32(7),
                reader.IsDBNull(8) ? null : reader.GetInt64(8),
                reader.GetBoolean(9),
                ReadNullableDateTimeOffset(reader, 10),
                ReadNullableDateTimeOffset(reader, 11),
                ReadNullableDateTimeOffset(reader, 12),
                reader.IsDBNull(13) ? null : reader.GetString(13),
                reader.IsDBNull(14) ? null : reader.GetString(14),
                reader.GetInt64(15),
                ReadDateTimeOffset(reader, 16),
                ReadNullableDateTimeOffset(reader, 17));
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while retrieving incident detail for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving incident detail for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<long> CreateIncidentAsync(CreateIncidentRequestDto request, long createdByUserId, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO ic.Incident
            (
                IncidentNumber,
                IncidentName,
                IncidentTypeCode,
                IncidentStatusCode,
                SeverityCode,
                LeadOrganizationId,
                LeadRegionId,
                PrimaryLocationId,
                IsPlannedEvent,
                InitialSummary,
                CreatedByUserId
            )
            OUTPUT INSERTED.IncidentId
            VALUES
            (
                @incidentNumber,
                @incidentName,
                @incidentTypeCode,
                'Draft',
                @severityCode,
                @leadOrganizationId,
                @leadRegionId,
                @primaryLocationId,
                @isPlannedEvent,
                @initialSummary,
                @createdByUserId
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

            command.Parameters.Add(new SqlParameter("@incidentNumber", SqlDbType.NVarChar, 40) { Value = request.IncidentNumber });
            command.Parameters.Add(new SqlParameter("@incidentName", SqlDbType.NVarChar, 240) { Value = request.IncidentName });
            command.Parameters.Add(new SqlParameter("@incidentTypeCode", SqlDbType.NVarChar, 80) { Value = request.IncidentTypeCode });
            command.Parameters.Add(new SqlParameter("@severityCode", SqlDbType.NVarChar, 60) { Value = (object?)request.SeverityCode ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@leadOrganizationId", SqlDbType.BigInt) { Value = (object?)request.LeadOrganizationId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@leadRegionId", SqlDbType.Int) { Value = (object?)request.LeadRegionId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@primaryLocationId", SqlDbType.BigInt) { Value = (object?)request.PrimaryLocationId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@isPlannedEvent", SqlDbType.Bit) { Value = request.IsPlannedEvent });
            command.Parameters.Add(new SqlParameter("@initialSummary", SqlDbType.NVarChar, -1) { Value = (object?)request.InitialSummary ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@createdByUserId", SqlDbType.BigInt) { Value = createdByUserId });

            var createdIncidentId = (long)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("Incident creation did not return an incident identifier."));

            _logger.LogInformation("Created incident {IncidentId} ({IncidentNumber}) by user {CreatedByUserId}.", createdIncidentId, request.IncidentNumber, createdByUserId);
            return createdIncidentId;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while creating incident {IncidentNumber}.", request.IncidentNumber);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating incident {IncidentNumber}.", request.IncidentNumber);
            throw;
        }
    }

    public async Task<bool> UpdateIncidentAsync(long incidentId, UpdateIncidentRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ic.Incident
            SET IncidentName = @incidentName,
                IncidentTypeCode = @incidentTypeCode,
                SeverityCode = @severityCode,
                LeadOrganizationId = @leadOrganizationId,
                LeadRegionId = @leadRegionId,
                PrimaryLocationId = @primaryLocationId,
                IsPlannedEvent = @isPlannedEvent,
                InitialSummary = @initialSummary,
                SituationSummary = @situationSummary,
                UpdatedUtc = SYSUTCDATETIME()
            WHERE IncidentId = @incidentId;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@incidentName", SqlDbType.NVarChar, 240) { Value = request.IncidentName });
            command.Parameters.Add(new SqlParameter("@incidentTypeCode", SqlDbType.NVarChar, 80) { Value = request.IncidentTypeCode });
            command.Parameters.Add(new SqlParameter("@severityCode", SqlDbType.NVarChar, 60) { Value = (object?)request.SeverityCode ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@leadOrganizationId", SqlDbType.BigInt) { Value = (object?)request.LeadOrganizationId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@leadRegionId", SqlDbType.Int) { Value = (object?)request.LeadRegionId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@primaryLocationId", SqlDbType.BigInt) { Value = (object?)request.PrimaryLocationId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@isPlannedEvent", SqlDbType.Bit) { Value = request.IsPlannedEvent });
            command.Parameters.Add(new SqlParameter("@initialSummary", SqlDbType.NVarChar, -1) { Value = (object?)request.InitialSummary ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@situationSummary", SqlDbType.NVarChar, -1) { Value = (object?)request.SituationSummary ?? DBNull.Value });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Update incident command executed for IncidentId {IncidentId}. Rows affected: {RowsAffected}.", incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while updating IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while updating IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<IReadOnlyList<IncidentTaskDto>> GetIncidentTasksAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (200)
                t.IncidentTaskId,
                t.IncidentId,
                t.TaskNumber,
                t.TaskTitle,
                t.TaskDescription,
                t.AssignedToUserId,
                u.DisplayName AS AssignedToUserDisplayName,
                t.PriorityCode,
                t.StatusCode,
                t.DueUtc,
                t.CompletedUtc,
                t.CreatedUtc,
                t.UpdatedUtc
            FROM ic.IncidentTask t
            LEFT JOIN sec.AppUser u ON u.UserId = t.AssignedToUserId
            WHERE t.IncidentId = @incidentId
            ORDER BY t.CreatedUtc DESC;
            """;

        var tasks = new List<IncidentTaskDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                tasks.Add(new IncidentTaskDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetString(4),
                    reader.IsDBNull(5) ? null : reader.GetInt64(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.GetString(7),
                    reader.GetString(8),
                    ReadNullableDateTimeOffset(reader, 9),
                    ReadNullableDateTimeOffset(reader, 10),
                    ReadDateTimeOffset(reader, 11),
                    ReadNullableDateTimeOffset(reader, 12)));
            }

            _logger.LogInformation("Retrieved {TaskCount} tasks for IncidentId {IncidentId}.", tasks.Count, incidentId);
            return tasks;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving tasks for IncidentId {IncidentId}. Returning empty task list due to degraded read fallback.", incidentId);
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving tasks for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving tasks for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<long> CreateIncidentTaskAsync(long incidentId, CreateIncidentTaskRequestDto request, long createdByUserId, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO ic.IncidentTask
            (
                IncidentId,
                TaskTitle,
                TaskDescription,
                AssignedToUserId,
                PriorityCode,
                StatusCode,
                DueUtc,
                CreatedByUserId
            )
            OUTPUT INSERTED.IncidentTaskId
            VALUES
            (
                @incidentId,
                @taskTitle,
                @taskDescription,
                @assignedToUserId,
                @priorityCode,
                'Open',
                @dueUtc,
                @createdByUserId
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@taskTitle", SqlDbType.NVarChar, 240) { Value = request.TaskTitle });
            command.Parameters.Add(new SqlParameter("@taskDescription", SqlDbType.NVarChar, -1) { Value = (object?)request.TaskDescription ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@assignedToUserId", SqlDbType.BigInt) { Value = (object?)request.AssignedToUserId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@priorityCode", SqlDbType.NVarChar, 40) { Value = request.PriorityCode });
            command.Parameters.Add(new SqlParameter("@dueUtc", SqlDbType.DateTimeOffset) { Value = (object?)request.DueUtc ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@createdByUserId", SqlDbType.BigInt) { Value = createdByUserId });

            var createdTaskId = (long)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("Task creation did not return a task identifier."));

            _logger.LogInformation("Created incident task {IncidentTaskId} for IncidentId {IncidentId}.", createdTaskId, incidentId);
            return createdTaskId;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while creating task for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating task for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<bool> UpdateIncidentTaskAssignmentAsync(long incidentId, long incidentTaskId, long? assignedToUserId, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ic.IncidentTask
            SET AssignedToUserId = @assignedToUserId,
                StatusCode = CASE
                    WHEN @assignedToUserId IS NOT NULL AND StatusCode = 'Open' THEN 'Assigned'
                    WHEN @assignedToUserId IS NULL AND StatusCode = 'Assigned' THEN 'Open'
                    ELSE StatusCode
                END,
                UpdatedUtc = SYSUTCDATETIME()
            WHERE IncidentTaskId = @incidentTaskId
              AND IncidentId = @incidentId;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@incidentTaskId", SqlDbType.BigInt) { Value = incidentTaskId });
            command.Parameters.Add(new SqlParameter("@assignedToUserId", SqlDbType.BigInt) { Value = (object?)assignedToUserId ?? DBNull.Value });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Updated assignment for IncidentTaskId {IncidentTaskId} in IncidentId {IncidentId}. Rows affected: {RowsAffected}.", incidentTaskId, incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while updating task assignment for IncidentTaskId {IncidentTaskId} in IncidentId {IncidentId}.", incidentTaskId, incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while updating task assignment for IncidentTaskId {IncidentTaskId} in IncidentId {IncidentId}.", incidentTaskId, incidentId);
            throw;
        }
    }

    public async Task<bool> UpdateIncidentTaskStatusAsync(long incidentId, long incidentTaskId, UpdateIncidentTaskStatusRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ic.IncidentTask
            SET StatusCode = @statusCode,
                CompletedUtc = CASE
                    WHEN @statusCode = 'Completed' THEN COALESCE(CompletedUtc, SYSUTCDATETIME())
                    ELSE NULL
                END,
                UpdatedUtc = SYSUTCDATETIME()
            WHERE IncidentTaskId = @incidentTaskId
              AND IncidentId = @incidentId;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@incidentTaskId", SqlDbType.BigInt) { Value = incidentTaskId });
            command.Parameters.Add(new SqlParameter("@statusCode", SqlDbType.NVarChar, 40) { Value = request.StatusCode });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Updated status for IncidentTaskId {IncidentTaskId} in IncidentId {IncidentId}. Rows affected: {RowsAffected}.", incidentTaskId, incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while updating task status for IncidentTaskId {IncidentTaskId} in IncidentId {IncidentId}.", incidentTaskId, incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while updating task status for IncidentTaskId {IncidentTaskId} in IncidentId {IncidentId}.", incidentTaskId, incidentId);
            throw;
        }
    }

    public async Task<IReadOnlyList<IncidentTimelineEventDto>> GetIncidentTimelineEventsAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (200)
                e.IncidentTimelineEventId,
                e.IncidentId,
                e.EventUtc,
                e.EventTypeCode,
                e.EventTitle,
                e.EventDescription,
                e.LocationId,
                e.CreatedUtc
            FROM ic.IncidentTimelineEvent e
            WHERE e.IncidentId = @incidentId
            ORDER BY e.EventUtc DESC, e.IncidentTimelineEventId DESC;
            """;

        var events = new List<IncidentTimelineEventDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                events.Add(new IncidentTimelineEventDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    ReadDateTimeOffset(reader, 2),
                    reader.GetString(3),
                    reader.GetString(4),
                    reader.IsDBNull(5) ? null : reader.GetString(5),
                    reader.IsDBNull(6) ? null : reader.GetInt64(6),
                    ReadDateTimeOffset(reader, 7)));
            }

            _logger.LogInformation("Retrieved {EventCount} timeline events for IncidentId {IncidentId}.", events.Count, incidentId);
            return events;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving timeline events for IncidentId {IncidentId}. Returning empty timeline list due to degraded read fallback.", incidentId);
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving timeline events for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving timeline events for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<long> CreateIncidentTimelineEventAsync(long incidentId, CreateIncidentTimelineEventRequestDto request, long createdByUserId, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO ic.IncidentTimelineEvent
            (
                IncidentId,
                EventUtc,
                EventTypeCode,
                EventTitle,
                EventDescription,
                LocationId,
                CreatedByUserId
            )
            OUTPUT INSERTED.IncidentTimelineEventId
            VALUES
            (
                @incidentId,
                @eventUtc,
                @eventTypeCode,
                @eventTitle,
                @eventDescription,
                @locationId,
                @createdByUserId
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@eventUtc", SqlDbType.DateTimeOffset) { Value = (object?)request.EventUtc ?? DateTimeOffset.UtcNow });
            command.Parameters.Add(new SqlParameter("@eventTypeCode", SqlDbType.NVarChar, 80) { Value = request.EventTypeCode });
            command.Parameters.Add(new SqlParameter("@eventTitle", SqlDbType.NVarChar, 240) { Value = request.EventTitle });
            command.Parameters.Add(new SqlParameter("@eventDescription", SqlDbType.NVarChar, -1) { Value = (object?)request.EventDescription ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = (object?)request.LocationId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@createdByUserId", SqlDbType.BigInt) { Value = createdByUserId });

            var createdEventId = (long)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("Timeline event creation did not return an identifier."));

            _logger.LogInformation("Created timeline event {IncidentTimelineEventId} for IncidentId {IncidentId}.", createdEventId, incidentId);
            return createdEventId;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while creating timeline event for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating timeline event for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<IReadOnlyList<IncidentCommunicationDto>> GetIncidentCommunicationsAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (300)
                c.IncidentCommunicationId,
                c.IncidentId,
                c.NotificationId,
                c.LoggedUtc,
                c.ChannelCode,
                c.DirectionCode,
                c.Subject,
                c.Message,
                c.StatusCode,
                c.CreatedByUserId,
                u.DisplayName,
                c.CreatedUtc,
                c.UpdatedUtc
            FROM ic.IncidentCommunication c
            INNER JOIN sec.AppUser u ON c.CreatedByUserId = u.UserId
            WHERE c.IncidentId = @incidentId
            ORDER BY c.LoggedUtc DESC, c.IncidentCommunicationId DESC;
            """;

        var items = new List<IncidentCommunicationDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new IncidentCommunicationDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    reader.IsDBNull(2) ? null : reader.GetInt64(2),
                    ReadDateTimeOffset(reader, 3),
                    reader.GetString(4),
                    reader.GetString(5),
                    reader.GetString(6),
                    reader.GetString(7),
                    reader.GetString(8),
                    reader.GetInt64(9),
                    reader.GetString(10),
                    ReadDateTimeOffset(reader, 11),
                    ReadNullableDateTimeOffset(reader, 12)));
            }

            _logger.LogInformation("Retrieved {CommunicationCount} communications for IncidentId {IncidentId}.", items.Count, incidentId);
            return items;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving communications for IncidentId {IncidentId}. Returning empty communication list due to degraded read fallback.", incidentId);
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving communications for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving communications for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<IncidentCommunicationLifecycleSummaryDto> GetIncidentCommunicationLifecycleSummaryAsync(long incidentId, DateTimeOffset? fromUtc, DateTimeOffset? toUtc, CancellationToken cancellationToken)
    {
        const string sql = """
            WITH FilteredCommunications AS
            (
                SELECT
                    c.IncidentCommunicationId,
                    c.NotificationId
                FROM ic.IncidentCommunication c
                WHERE c.IncidentId = @incidentId
                  AND (@fromUtc IS NULL OR c.LoggedUtc >= @fromUtc)
                  AND (@toUtc IS NULL OR c.LoggedUtc <= @toUtc)
            ),
            DistinctNotifications AS
            (
                SELECT DISTINCT
                    fc.NotificationId
                FROM FilteredCommunications fc
                WHERE fc.NotificationId IS NOT NULL
            )
            SELECT
                (SELECT COUNT_BIG(1) FROM FilteredCommunications) AS TotalCommunications,
                (SELECT COUNT_BIG(1) FROM FilteredCommunications WHERE NotificationId IS NOT NULL) AS CommunicationsWithNotifications,
                (SELECT COUNT_BIG(1) FROM DistinctNotifications) AS TotalNotifications,
                COALESCE(COUNT_BIG(r.NotificationRecipientId), 0) AS TotalRecipients,
                COALESCE(SUM(CASE WHEN r.DeliveryStatusCode = 'Queued' THEN 1 ELSE 0 END), 0) AS QueuedRecipients,
                COALESCE(SUM(CASE WHEN r.DeliveryStatusCode = 'Sent' THEN 1 ELSE 0 END), 0) AS SentRecipients,
                COALESCE(SUM(CASE WHEN r.DeliveryStatusCode = 'Failed' THEN 1 ELSE 0 END), 0) AS FailedRecipients,
                COALESCE(SUM(CASE WHEN r.DeliveryStatusCode = 'Suppressed' THEN 1 ELSE 0 END), 0) AS SuppressedRecipients,
                COALESCE(SUM(CASE WHEN r.DeliveryStatusCode = 'Cancelled' THEN 1 ELSE 0 END), 0) AS CancelledRecipients,
                COALESCE(SUM(CASE WHEN ack.NotificationRecipientId IS NOT NULL THEN 1 ELSE 0 END), 0) AS AcknowledgedRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'EMAIL' THEN 1 ELSE 0 END), 0) AS EmailRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'SMS' THEN 1 ELSE 0 END), 0) AS SmsRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'VOICE' THEN 1 ELSE 0 END), 0) AS VoiceRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'PUSH' THEN 1 ELSE 0 END), 0) AS PushRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'EMAIL' AND r.DeliveryStatusCode = 'Failed' THEN 1 ELSE 0 END), 0) AS EmailFailedRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'SMS' AND r.DeliveryStatusCode = 'Failed' THEN 1 ELSE 0 END), 0) AS SmsFailedRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'VOICE' AND r.DeliveryStatusCode = 'Failed' THEN 1 ELSE 0 END), 0) AS VoiceFailedRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'PUSH' AND r.DeliveryStatusCode = 'Failed' THEN 1 ELSE 0 END), 0) AS PushFailedRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'EMAIL' AND r.DeliveryStatusCode = 'Sent' THEN 1 ELSE 0 END), 0) AS EmailSentRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'SMS' AND r.DeliveryStatusCode = 'Sent' THEN 1 ELSE 0 END), 0) AS SmsSentRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'VOICE' AND r.DeliveryStatusCode = 'Sent' THEN 1 ELSE 0 END), 0) AS VoiceSentRecipients,
                COALESCE(SUM(CASE WHEN r.ChannelCode = 'PUSH' AND r.DeliveryStatusCode = 'Sent' THEN 1 ELSE 0 END), 0) AS PushSentRecipients
            FROM DistinctNotifications dn
            LEFT JOIN comm.NotificationRecipient r ON r.NotificationId = dn.NotificationId
            LEFT JOIN comm.NotificationRecipientAcknowledgment ack ON ack.NotificationRecipientId = r.NotificationRecipientId;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@fromUtc", SqlDbType.DateTimeOffset) { Value = (object?)fromUtc ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@toUtc", SqlDbType.DateTimeOffset) { Value = (object?)toUtc ?? DBNull.Value });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return new IncidentCommunicationLifecycleSummaryDto(
                    TotalCommunications: 0,
                    CommunicationsWithNotifications: 0,
                    TotalNotifications: 0,
                    TotalRecipients: 0,
                    QueuedRecipients: 0,
                    SentRecipients: 0,
                    FailedRecipients: 0,
                    SuppressedRecipients: 0,
                    CancelledRecipients: 0,
                    AcknowledgedRecipients: 0,
                    EmailRecipients: 0,
                    SmsRecipients: 0,
                    VoiceRecipients: 0,
                    PushRecipients: 0,
                    EmailFailedRecipients: 0,
                    SmsFailedRecipients: 0,
                    VoiceFailedRecipients: 0,
                    PushFailedRecipients: 0,
                    EmailSentRecipients: 0,
                    SmsSentRecipients: 0,
                    VoiceSentRecipients: 0,
                    PushSentRecipients: 0);
            }

            return new IncidentCommunicationLifecycleSummaryDto(
                TotalCommunications: reader.GetInt64(0),
                CommunicationsWithNotifications: reader.GetInt64(1),
                TotalNotifications: reader.GetInt64(2),
                TotalRecipients: reader.GetInt64(3),
                QueuedRecipients: reader.GetInt64(4),
                SentRecipients: reader.GetInt64(5),
                FailedRecipients: reader.GetInt64(6),
                SuppressedRecipients: reader.GetInt64(7),
                CancelledRecipients: reader.GetInt64(8),
                AcknowledgedRecipients: reader.GetInt64(9),
                EmailRecipients: reader.GetInt64(10),
                SmsRecipients: reader.GetInt64(11),
                VoiceRecipients: reader.GetInt64(12),
                PushRecipients: reader.GetInt64(13),
                EmailFailedRecipients: reader.GetInt64(14),
                SmsFailedRecipients: reader.GetInt64(15),
                VoiceFailedRecipients: reader.GetInt64(16),
                PushFailedRecipients: reader.GetInt64(17),
                EmailSentRecipients: reader.GetInt64(18),
                SmsSentRecipients: reader.GetInt64(19),
                VoiceSentRecipients: reader.GetInt64(20),
                PushSentRecipients: reader.GetInt64(21));
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving communication lifecycle summary for IncidentId {IncidentId}. Returning empty summary due to degraded read fallback.", incidentId);
                return new IncidentCommunicationLifecycleSummaryDto(
                    TotalCommunications: 0,
                    CommunicationsWithNotifications: 0,
                    TotalNotifications: 0,
                    TotalRecipients: 0,
                    QueuedRecipients: 0,
                    SentRecipients: 0,
                    FailedRecipients: 0,
                    SuppressedRecipients: 0,
                    CancelledRecipients: 0,
                    AcknowledgedRecipients: 0,
                    EmailRecipients: 0,
                    SmsRecipients: 0,
                    VoiceRecipients: 0,
                    PushRecipients: 0,
                    EmailFailedRecipients: 0,
                    SmsFailedRecipients: 0,
                    VoiceFailedRecipients: 0,
                    PushFailedRecipients: 0,
                    EmailSentRecipients: 0,
                    SmsSentRecipients: 0,
                    VoiceSentRecipients: 0,
                    PushSentRecipients: 0);
            }

            _logger.LogError(ex, "Database error while retrieving communication lifecycle summary for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving communication lifecycle summary for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<long> CreateIncidentCommunicationAsync(long incidentId, CreateIncidentCommunicationRequestDto request, long createdByUserId, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO ic.IncidentCommunication
            (
                IncidentId,
                LoggedUtc,
                ChannelCode,
                DirectionCode,
                Subject,
                Message,
                StatusCode,
                NotificationId,
                CreatedByUserId
            )
            OUTPUT INSERTED.IncidentCommunicationId
            VALUES
            (
                @incidentId,
                SYSUTCDATETIME(),
                @channelCode,
                @directionCode,
                @subject,
                @message,
                'Active',
                @notificationId,
                @createdByUserId
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@channelCode", SqlDbType.NVarChar, 40) { Value = request.ChannelCode.Trim() });
            command.Parameters.Add(new SqlParameter("@directionCode", SqlDbType.NVarChar, 40) { Value = request.DirectionCode.Trim() });
            command.Parameters.Add(new SqlParameter("@subject", SqlDbType.NVarChar, 240) { Value = request.Subject.Trim() });
            command.Parameters.Add(new SqlParameter("@message", SqlDbType.NVarChar, -1) { Value = request.Message.Trim() });
            command.Parameters.Add(new SqlParameter("@notificationId", SqlDbType.BigInt) { Value = request.NotificationId is > 0 ? request.NotificationId.Value : DBNull.Value });
            command.Parameters.Add(new SqlParameter("@createdByUserId", SqlDbType.BigInt) { Value = createdByUserId });

            var createdCommunicationId = (long)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("Communication creation did not return an identifier."));

            _logger.LogInformation("Created incident communication {IncidentCommunicationId} for IncidentId {IncidentId}.", createdCommunicationId, incidentId);
            return createdCommunicationId;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while creating communication for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating communication for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<bool> UpdateIncidentCommunicationAsync(long incidentId, long incidentCommunicationId, UpdateIncidentCommunicationRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ic.IncidentCommunication
            SET ChannelCode = @channelCode,
                DirectionCode = @directionCode,
                Subject = @subject,
                Message = @message,
                StatusCode = @statusCode,
                UpdatedUtc = SYSUTCDATETIME()
            WHERE IncidentId = @incidentId
              AND IncidentCommunicationId = @incidentCommunicationId;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@incidentCommunicationId", SqlDbType.BigInt) { Value = incidentCommunicationId });
            command.Parameters.Add(new SqlParameter("@channelCode", SqlDbType.NVarChar, 40) { Value = request.ChannelCode.Trim() });
            command.Parameters.Add(new SqlParameter("@directionCode", SqlDbType.NVarChar, 40) { Value = request.DirectionCode.Trim() });
            command.Parameters.Add(new SqlParameter("@subject", SqlDbType.NVarChar, 240) { Value = request.Subject.Trim() });
            command.Parameters.Add(new SqlParameter("@message", SqlDbType.NVarChar, -1) { Value = request.Message.Trim() });
            command.Parameters.Add(new SqlParameter("@statusCode", SqlDbType.NVarChar, 40) { Value = request.StatusCode.Trim() });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Updated communication {IncidentCommunicationId} for IncidentId {IncidentId}. Rows affected: {RowsAffected}.", incidentCommunicationId, incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while updating communication {IncidentCommunicationId} for IncidentId {IncidentId}.", incidentCommunicationId, incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while updating communication {IncidentCommunicationId} for IncidentId {IncidentId}.", incidentCommunicationId, incidentId);
            throw;
        }
    }

    public async Task<IReadOnlyList<IncidentResourceRequestDto>> GetIncidentResourceRequestsAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (300)
                r.IncidentResourceRequestId,
                r.IncidentId,
                r.RequestedUtc,
                r.ResourceTypeCode,
                r.ResourceTypeName,
                r.RequestedQuantity,
                r.AssignedQuantity,
                r.UnitOfMeasureCode,
                r.PriorityCode,
                r.StatusCode,
                r.Notes,
                r.RequestedByUserId,
                u.DisplayName,
                r.CreatedUtc,
                r.UpdatedUtc
            FROM ic.IncidentResourceRequest r
            INNER JOIN sec.AppUser u ON r.RequestedByUserId = u.UserId
            WHERE r.IncidentId = @incidentId
            ORDER BY r.RequestedUtc DESC, r.IncidentResourceRequestId DESC;
            """;

        var items = new List<IncidentResourceRequestDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new IncidentResourceRequestDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    ReadDateTimeOffset(reader, 2),
                    reader.GetString(3),
                    reader.GetString(4),
                    reader.GetDecimal(5),
                    reader.IsDBNull(6) ? null : reader.GetDecimal(6),
                    reader.GetString(7),
                    reader.GetString(8),
                    reader.GetString(9),
                    reader.IsDBNull(10) ? null : reader.GetString(10),
                    reader.GetInt64(11),
                    reader.GetString(12),
                    ReadDateTimeOffset(reader, 13),
                    ReadNullableDateTimeOffset(reader, 14)));
            }

            _logger.LogInformation("Retrieved {RequestCount} incident resource requests for IncidentId {IncidentId}.", items.Count, incidentId);
            return items;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving incident resource requests for IncidentId {IncidentId}. Returning empty list due to degraded read fallback.", incidentId);
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving incident resource requests for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving incident resource requests for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<IncidentResourceLifecycleSummaryDto> GetIncidentResourceLifecycleSummaryAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                COUNT_BIG(1) AS TotalRequests,
                COALESCE(SUM(CASE WHEN r.StatusCode = 'Requested' THEN 1 ELSE 0 END), 0) AS RequestedRequests,
                COALESCE(SUM(CASE WHEN r.StatusCode = 'Approved' THEN 1 ELSE 0 END), 0) AS ApprovedRequests,
                COALESCE(SUM(CASE WHEN r.StatusCode = 'PartiallyFulfilled' THEN 1 ELSE 0 END), 0) AS PartiallyFulfilledRequests,
                COALESCE(SUM(CASE WHEN r.StatusCode = 'Fulfilled' THEN 1 ELSE 0 END), 0) AS FulfilledRequests,
                COALESCE(SUM(CASE WHEN r.StatusCode = 'Denied' THEN 1 ELSE 0 END), 0) AS DeniedRequests,
                COALESCE(SUM(CASE WHEN r.StatusCode = 'Cancelled' THEN 1 ELSE 0 END), 0) AS CancelledRequests,
                COALESCE(SUM(CASE WHEN r.StatusCode = 'Archived' THEN 1 ELSE 0 END), 0) AS ArchivedRequests,
                COALESCE(SUM(r.RequestedQuantity), 0) AS TotalRequestedQuantity,
                COALESCE(SUM(r.AssignedQuantity), 0) AS TotalAssignedQuantity,
                COALESCE(SUM(CASE
                    WHEN r.StatusCode IN ('Requested', 'Approved', 'PartiallyFulfilled')
                     AND (r.AssignedQuantity IS NULL OR r.AssignedQuantity = 0)
                    THEN 1 ELSE 0 END), 0) AS OpenUnassignedRequests
            FROM ic.IncidentResourceRequest r
            WHERE r.IncidentId = @incidentId;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return new IncidentResourceLifecycleSummaryDto(
                    TotalRequests: 0,
                    RequestedRequests: 0,
                    ApprovedRequests: 0,
                    PartiallyFulfilledRequests: 0,
                    FulfilledRequests: 0,
                    DeniedRequests: 0,
                    CancelledRequests: 0,
                    ArchivedRequests: 0,
                    TotalRequestedQuantity: 0,
                    TotalAssignedQuantity: 0,
                    OpenUnassignedRequests: 0);
            }

            return new IncidentResourceLifecycleSummaryDto(
                TotalRequests: ReadInt64Flexible(reader, 0),
                RequestedRequests: ReadInt64Flexible(reader, 1),
                ApprovedRequests: ReadInt64Flexible(reader, 2),
                PartiallyFulfilledRequests: ReadInt64Flexible(reader, 3),
                FulfilledRequests: ReadInt64Flexible(reader, 4),
                DeniedRequests: ReadInt64Flexible(reader, 5),
                CancelledRequests: ReadInt64Flexible(reader, 6),
                ArchivedRequests: ReadInt64Flexible(reader, 7),
                TotalRequestedQuantity: reader.GetDecimal(8),
                TotalAssignedQuantity: reader.GetDecimal(9),
                OpenUnassignedRequests: ReadInt64Flexible(reader, 10));
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving resource lifecycle summary for IncidentId {IncidentId}. Returning empty summary due to degraded read fallback.", incidentId);
                return new IncidentResourceLifecycleSummaryDto(
                    TotalRequests: 0,
                    RequestedRequests: 0,
                    ApprovedRequests: 0,
                    PartiallyFulfilledRequests: 0,
                    FulfilledRequests: 0,
                    DeniedRequests: 0,
                    CancelledRequests: 0,
                    ArchivedRequests: 0,
                    TotalRequestedQuantity: 0,
                    TotalAssignedQuantity: 0,
                    OpenUnassignedRequests: 0);
            }

            _logger.LogError(ex, "Database error while retrieving resource lifecycle summary for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving resource lifecycle summary for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<long> CreateIncidentResourceRequestAsync(long incidentId, CreateIncidentResourceRequestDto request, long requestedByUserId, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO ic.IncidentResourceRequest
            (
                IncidentId,
                RequestedUtc,
                ResourceTypeCode,
                ResourceTypeName,
                RequestedQuantity,
                AssignedQuantity,
                UnitOfMeasureCode,
                PriorityCode,
                StatusCode,
                Notes,
                RequestedByUserId
            )
            OUTPUT INSERTED.IncidentResourceRequestId
            VALUES
            (
                @incidentId,
                SYSUTCDATETIME(),
                @resourceTypeCode,
                @resourceTypeName,
                @requestedQuantity,
                NULL,
                @unitOfMeasureCode,
                @priorityCode,
                'Requested',
                @notes,
                @requestedByUserId
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@resourceTypeCode", SqlDbType.NVarChar, 80) { Value = request.ResourceTypeCode.Trim() });
            command.Parameters.Add(new SqlParameter("@resourceTypeName", SqlDbType.NVarChar, 240) { Value = request.ResourceTypeName.Trim() });
            command.Parameters.Add(new SqlParameter("@requestedQuantity", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = request.RequestedQuantity });
            command.Parameters.Add(new SqlParameter("@unitOfMeasureCode", SqlDbType.NVarChar, 40) { Value = request.UnitOfMeasureCode.Trim() });
            command.Parameters.Add(new SqlParameter("@priorityCode", SqlDbType.NVarChar, 40) { Value = request.PriorityCode.Trim() });
            command.Parameters.Add(new SqlParameter("@notes", SqlDbType.NVarChar, -1) { Value = (object?)request.Notes ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@requestedByUserId", SqlDbType.BigInt) { Value = requestedByUserId });

            var incidentResourceRequestId = (long)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("Incident resource request creation did not return an identifier."));

            _logger.LogInformation("Created incident resource request {IncidentResourceRequestId} for IncidentId {IncidentId}.", incidentResourceRequestId, incidentId);
            return incidentResourceRequestId;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while creating incident resource request for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating incident resource request for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<bool> UpdateIncidentResourceRequestAsync(long incidentId, long incidentResourceRequestId, UpdateIncidentResourceRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ic.IncidentResourceRequest
            SET ResourceTypeCode = @resourceTypeCode,
                ResourceTypeName = @resourceTypeName,
                RequestedQuantity = @requestedQuantity,
                AssignedQuantity = @assignedQuantity,
                UnitOfMeasureCode = @unitOfMeasureCode,
                PriorityCode = @priorityCode,
                StatusCode = @statusCode,
                Notes = @notes,
                UpdatedUtc = SYSUTCDATETIME()
            WHERE IncidentId = @incidentId
              AND IncidentResourceRequestId = @incidentResourceRequestId;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@incidentResourceRequestId", SqlDbType.BigInt) { Value = incidentResourceRequestId });
            command.Parameters.Add(new SqlParameter("@resourceTypeCode", SqlDbType.NVarChar, 80) { Value = request.ResourceTypeCode.Trim() });
            command.Parameters.Add(new SqlParameter("@resourceTypeName", SqlDbType.NVarChar, 240) { Value = request.ResourceTypeName.Trim() });
            command.Parameters.Add(new SqlParameter("@requestedQuantity", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = request.RequestedQuantity });
            command.Parameters.Add(new SqlParameter("@assignedQuantity", SqlDbType.Decimal) { Precision = 18, Scale = 4, Value = (object?)request.AssignedQuantity ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@unitOfMeasureCode", SqlDbType.NVarChar, 40) { Value = request.UnitOfMeasureCode.Trim() });
            command.Parameters.Add(new SqlParameter("@priorityCode", SqlDbType.NVarChar, 40) { Value = request.PriorityCode.Trim() });
            command.Parameters.Add(new SqlParameter("@statusCode", SqlDbType.NVarChar, 40) { Value = request.StatusCode.Trim() });
            command.Parameters.Add(new SqlParameter("@notes", SqlDbType.NVarChar, -1) { Value = (object?)request.Notes ?? DBNull.Value });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Updated incident resource request {IncidentResourceRequestId} for IncidentId {IncidentId}. Rows affected: {RowsAffected}.", incidentResourceRequestId, incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while updating incident resource request {IncidentResourceRequestId} for IncidentId {IncidentId}.", incidentResourceRequestId, incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while updating incident resource request {IncidentResourceRequestId} for IncidentId {IncidentId}.", incidentResourceRequestId, incidentId);
            throw;
        }
    }

    public async Task<IReadOnlyList<IncidentOperationalPeriodDto>> GetIncidentOperationalPeriodsAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (50)
                p.OperationalPeriodId,
                p.IncidentId,
                p.PeriodNumber,
                p.PeriodName,
                p.StartUtc,
                p.EndUtc,
                p.StatusCode,
                p.PlanningMeetingUtc,
                p.ApprovedByUserId,
                p.ApprovedUtc
            FROM ic.IncidentOperationalPeriod p
            WHERE p.IncidentId = @incidentId
            ORDER BY p.StartUtc DESC, p.OperationalPeriodId DESC;
            """;

        var periods = new List<IncidentOperationalPeriodDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                periods.Add(new IncidentOperationalPeriodDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    reader.GetInt32(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    ReadDateTimeOffset(reader, 4),
                    ReadDateTimeOffset(reader, 5),
                    reader.GetString(6),
                    ReadNullableDateTimeOffset(reader, 7),
                    reader.IsDBNull(8) ? null : reader.GetInt64(8),
                    ReadNullableDateTimeOffset(reader, 9)));
            }

            _logger.LogInformation("Retrieved {OperationalPeriodCount} operational periods for IncidentId {IncidentId}.", periods.Count, incidentId);
            return periods;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving operational periods for IncidentId {IncidentId}. Returning empty list due to degraded read fallback.", incidentId);
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving operational periods for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving operational periods for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<long> CreateIncidentOperationalPeriodAsync(long incidentId, CreateIncidentOperationalPeriodRequestDto request, long createdByUserId, CancellationToken cancellationToken)
    {
        if (!IsOperationalPeriodEditableStatus(request.StatusCode))
        {
            throw new InvalidOperationException("Operational period creation only supports Planned or Active status. Use approve endpoint for approval transitions.");
        }

        const string sql = """
            INSERT INTO ic.IncidentOperationalPeriod
            (
                IncidentId,
                PeriodNumber,
                PeriodName,
                StartUtc,
                EndUtc,
                StatusCode,
                PlanningMeetingUtc
            )
            OUTPUT INSERTED.OperationalPeriodId
            VALUES
            (
                @incidentId,
                @periodNumber,
                @periodName,
                @startUtc,
                @endUtc,
                @statusCode,
                @planningMeetingUtc
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@periodNumber", SqlDbType.Int) { Value = request.PeriodNumber });
            command.Parameters.Add(new SqlParameter("@periodName", SqlDbType.NVarChar, 200) { Value = (object?)request.PeriodName ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@startUtc", SqlDbType.DateTimeOffset) { Value = request.StartUtc });
            command.Parameters.Add(new SqlParameter("@endUtc", SqlDbType.DateTimeOffset) { Value = request.EndUtc });
            command.Parameters.Add(new SqlParameter("@statusCode", SqlDbType.NVarChar, 40) { Value = request.StatusCode });
            command.Parameters.Add(new SqlParameter("@planningMeetingUtc", SqlDbType.DateTimeOffset) { Value = (object?)request.PlanningMeetingUtc ?? DBNull.Value });

            var createdOperationalPeriodId = (long)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("Operational period creation did not return an identifier."));

            _logger.LogInformation("Created operational period {OperationalPeriodId} for IncidentId {IncidentId} by user {CreatedByUserId}.", createdOperationalPeriodId, incidentId, createdByUserId);
            return createdOperationalPeriodId;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while creating operational period for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating operational period for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<IReadOnlyList<IncidentObjectiveDto>> GetIncidentObjectivesAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (200)
                o.IncidentObjectiveId,
                o.IncidentId,
                o.OperationalPeriodId,
                o.ObjectiveNumber,
                o.ObjectiveText,
                o.PriorityCode,
                o.StatusCode,
                o.OwnerUserId,
                o.DueUtc,
                o.CreatedUtc
            FROM ic.IncidentObjective o
            WHERE o.IncidentId = @incidentId
            ORDER BY o.ObjectiveNumber ASC, o.IncidentObjectiveId ASC;
            """;

        var objectives = new List<IncidentObjectiveDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                objectives.Add(new IncidentObjectiveDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    reader.IsDBNull(2) ? null : reader.GetInt64(2),
                    reader.GetInt32(3),
                    reader.GetString(4),
                    reader.GetString(5),
                    reader.GetString(6),
                    reader.IsDBNull(7) ? null : reader.GetInt64(7),
                    ReadNullableDateTimeOffset(reader, 8),
                    ReadDateTimeOffset(reader, 9)));
            }

            _logger.LogInformation("Retrieved {ObjectiveCount} objectives for IncidentId {IncidentId}.", objectives.Count, incidentId);
            return objectives;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving objectives for IncidentId {IncidentId}. Returning empty list due to degraded read fallback.", incidentId);
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving objectives for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving objectives for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<long> CreateIncidentObjectiveAsync(long incidentId, CreateIncidentObjectiveRequestDto request, long createdByUserId, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO ic.IncidentObjective
            (
                IncidentId,
                OperationalPeriodId,
                ObjectiveNumber,
                ObjectiveText,
                PriorityCode,
                StatusCode,
                OwnerUserId,
                DueUtc
            )
            OUTPUT INSERTED.IncidentObjectiveId
            VALUES
            (
                @incidentId,
                @operationalPeriodId,
                @objectiveNumber,
                @objectiveText,
                @priorityCode,
                @statusCode,
                @ownerUserId,
                @dueUtc
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@operationalPeriodId", SqlDbType.BigInt) { Value = (object?)request.OperationalPeriodId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@objectiveNumber", SqlDbType.Int) { Value = request.ObjectiveNumber });
            command.Parameters.Add(new SqlParameter("@objectiveText", SqlDbType.NVarChar, -1) { Value = request.ObjectiveText });
            command.Parameters.Add(new SqlParameter("@priorityCode", SqlDbType.NVarChar, 40) { Value = request.PriorityCode });
            command.Parameters.Add(new SqlParameter("@statusCode", SqlDbType.NVarChar, 40) { Value = request.StatusCode });
            command.Parameters.Add(new SqlParameter("@ownerUserId", SqlDbType.BigInt) { Value = (object?)request.OwnerUserId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@dueUtc", SqlDbType.DateTimeOffset) { Value = (object?)request.DueUtc ?? DBNull.Value });

            var createdIncidentObjectiveId = (long)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("Objective creation did not return an identifier."));

            _logger.LogInformation("Created objective {IncidentObjectiveId} for IncidentId {IncidentId} by user {CreatedByUserId}.", createdIncidentObjectiveId, incidentId, createdByUserId);
            return createdIncidentObjectiveId;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while creating objective for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating objective for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<bool> ActivateIncidentAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ic.Incident
            SET IncidentStatusCode = 'Active',
                ActivatedUtc = COALESCE(ActivatedUtc, SYSUTCDATETIME()),
                StartedUtc = COALESCE(StartedUtc, SYSUTCDATETIME()),
                UpdatedUtc = SYSUTCDATETIME()
            WHERE IncidentId = @incidentId
              AND IncidentStatusCode IN ('Draft','Monitoring');
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Activate incident command executed for IncidentId {IncidentId}. Rows affected: {RowsAffected}.", incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while activating IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while activating IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<bool> CloseIncidentAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ic.Incident
            SET IncidentStatusCode = 'Closed',
                ClosedUtc = COALESCE(ClosedUtc, SYSUTCDATETIME()),
                UpdatedUtc = SYSUTCDATETIME()
            WHERE IncidentId = @incidentId
              AND IncidentStatusCode IN ('Active','Monitoring','Demobilizing');
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Close incident command executed for IncidentId {IncidentId}. Rows affected: {RowsAffected}.", incidentId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while closing IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while closing IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<IReadOnlyList<IcsPositionDto>> GetIcsPositionsAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                p.IcsPositionId,
                p.PositionCode,
                p.PositionName,
                p.IcsSection,
                p.SortOrder
            FROM ref.IcsPosition p
            ORDER BY p.SortOrder, p.PositionName;
            """;

        var positions = new List<IcsPositionDto>();

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
                positions.Add(new IcsPositionDto(
                    reader.GetInt32(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetInt32(4)));
            }

            _logger.LogInformation("Retrieved {PositionCount} ICS positions from database.", positions.Count);
            return positions;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving ICS positions. Returning empty list due to degraded read fallback.");
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving ICS positions.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving ICS positions.");
            throw;
        }
    }

    public async Task<IReadOnlyList<IncidentCommandAssignmentDto>> GetIncidentCommandAssignmentsAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            ;WITH CurrentAssignment AS
            (
                SELECT
                    a.IncidentCommandAssignmentId,
                    a.IncidentId,
                    a.IcsPositionId,
                    a.AssignedUserId,
                    a.AssignedContactId,
                    a.AgencyOrganizationId,
                    a.AssignedFromUtc,
                    a.AssignedToUtc,
                    a.AssignmentStatusCode,
                    a.Notes,
                    ROW_NUMBER() OVER (
                        PARTITION BY a.IcsPositionId
                        ORDER BY a.AssignedFromUtc DESC, a.IncidentCommandAssignmentId DESC) AS RowOrdinal
                FROM ic.IncidentCommandAssignment a
                WHERE a.IncidentId = @incidentId
                  AND a.AssignmentStatusCode NOT IN ('Released', 'Declined')
            )
            SELECT
                a.IncidentCommandAssignmentId,
                a.IncidentId,
                a.IcsPositionId,
                COALESCE(p.PositionCode, CONCAT('ICS-', CONVERT(varchar(16), a.IcsPositionId))) AS PositionCode,
                COALESCE(p.PositionName, CONCAT('Position ', CONVERT(varchar(16), a.IcsPositionId))) AS PositionName,
                COALESCE(p.IcsSection, 'Unassigned') AS IcsSection,
                a.AssignedUserId,
                u.DisplayName AS AssignedUserDisplayName,
                a.AssignedContactId,
                c.DisplayName AS AssignedContactName,
                a.AgencyOrganizationId,
                o.OrganizationName AS AgencyOrganizationName,
                a.AssignedFromUtc,
                a.AssignedToUtc,
                a.AssignmentStatusCode,
                a.Notes
            FROM CurrentAssignment a
            LEFT JOIN ref.IcsPosition p ON p.IcsPositionId = a.IcsPositionId
            LEFT JOIN sec.AppUser u ON u.UserId = a.AssignedUserId
            LEFT JOIN org.Contact c ON c.ContactId = a.AssignedContactId
            LEFT JOIN org.Organization o ON o.OrganizationId = a.AgencyOrganizationId
            WHERE a.RowOrdinal = 1
            ORDER BY COALESCE(p.SortOrder, 2147483647), COALESCE(p.PositionName, CONCAT('Position ', CONVERT(varchar(16), a.IcsPositionId)));
            """;

        var assignments = new List<IncidentCommandAssignmentDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                assignments.Add(new IncidentCommandAssignmentDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    reader.GetInt32(2),
                    reader.GetString(3),
                    reader.GetString(4),
                    reader.GetString(5),
                    reader.IsDBNull(6) ? null : reader.GetInt64(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7),
                    reader.IsDBNull(8) ? null : reader.GetInt64(8),
                    reader.IsDBNull(9) ? null : reader.GetString(9),
                    reader.IsDBNull(10) ? null : reader.GetInt64(10),
                    reader.IsDBNull(11) ? null : reader.GetString(11),
                    ReadDateTimeOffset(reader, 12),
                    ReadNullableDateTimeOffset(reader, 13),
                    reader.GetString(14),
                    reader.IsDBNull(15) ? null : reader.GetString(15)));
            }

            _logger.LogInformation("Retrieved {AssignmentCount} command assignments for IncidentId {IncidentId}.", assignments.Count, incidentId);
            _logger.LogDebug(
                "Command assignment hydration detail for IncidentId {IncidentId}: DistinctIcsPositionCount={DistinctIcsPositionCount}, WithAssignedUserCount={WithAssignedUserCount}, WithAssignedContactCount={WithAssignedContactCount}.",
                incidentId,
                assignments.Select(a => a.IcsPositionId).Distinct().Count(),
                assignments.Count(a => a.AssignedUserId.HasValue),
                assignments.Count(a => a.AssignedContactId.HasValue));
            return assignments;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving command assignments for IncidentId {IncidentId}. Returning empty list due to degraded read fallback.", incidentId);
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving command assignments for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving command assignments for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<IReadOnlyList<IncidentCommandTransferLogEntryDto>> GetIncidentCommandTransferLogAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                a.IncidentCommandAssignmentId,
                a.IncidentId,
                a.IcsPositionId,
                COALESCE(p.PositionCode, CONCAT('ICS-', CONVERT(varchar(16), a.IcsPositionId))) AS PositionCode,
                COALESCE(p.PositionName, CONCAT('Position ', CONVERT(varchar(16), a.IcsPositionId))) AS PositionName,
                COALESCE(p.IcsSection, 'Unassigned') AS IcsSection,
                a.AssignedUserId,
                u.DisplayName AS AssignedUserDisplayName,
                a.AssignedContactId,
                c.DisplayName AS AssignedContactName,
                a.AgencyOrganizationId,
                o.OrganizationName AS AgencyOrganizationName,
                a.AssignedFromUtc,
                a.AssignedToUtc,
                a.AssignmentStatusCode,
                a.Notes
            FROM ic.IncidentCommandAssignment a
            LEFT JOIN ref.IcsPosition p ON p.IcsPositionId = a.IcsPositionId
            LEFT JOIN sec.AppUser u ON u.UserId = a.AssignedUserId
            LEFT JOIN org.Contact c ON c.ContactId = a.AssignedContactId
            LEFT JOIN org.Organization o ON o.OrganizationId = a.AgencyOrganizationId
            WHERE a.IncidentId = @incidentId
            ORDER BY a.AssignedFromUtc DESC, a.IncidentCommandAssignmentId DESC;
            """;

        var assignments = new List<IncidentCommandTransferLogEntryDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                assignments.Add(new IncidentCommandTransferLogEntryDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    reader.GetInt32(2),
                    reader.GetString(3),
                    reader.GetString(4),
                    reader.GetString(5),
                    reader.IsDBNull(6) ? null : reader.GetInt64(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7),
                    reader.IsDBNull(8) ? null : reader.GetInt64(8),
                    reader.IsDBNull(9) ? null : reader.GetString(9),
                    reader.IsDBNull(10) ? null : reader.GetInt64(10),
                    reader.IsDBNull(11) ? null : reader.GetString(11),
                    ReadDateTimeOffset(reader, 12),
                    ReadNullableDateTimeOffset(reader, 13),
                    reader.GetString(14),
                    reader.IsDBNull(15) ? null : reader.GetString(15)));
            }

            _logger.LogInformation("Retrieved {TransferCount} command transfer log rows for IncidentId {IncidentId}.", assignments.Count, incidentId);
            return assignments;
        }
        catch (SqlException ex)
        {
            if (_degradedReadFallbackEnabled)
            {
                _logger.LogWarning(ex, "Database unavailable while retrieving command transfer log for IncidentId {IncidentId}. Returning empty list due to degraded read fallback.", incidentId);
                return [];
            }

            _logger.LogError(ex, "Database error while retrieving command transfer log for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving command transfer log for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task UpsertIncidentCommandAssignmentAsync(long incidentId, UpsertIncidentCommandAssignmentRequestDto request, long assignedByUserId, CancellationToken cancellationToken)
    {
        const string sql = """
            DECLARE @operationalPeriodId bigint;

            SELECT TOP (1)
                @operationalPeriodId = p.OperationalPeriodId
            FROM ic.IncidentOperationalPeriod p
            WHERE p.IncidentId = @incidentId
            ORDER BY
                CASE p.StatusCode
                    WHEN 'Active' THEN 0
                    WHEN 'Planned' THEN 1
                    WHEN 'Closed' THEN 2
                    WHEN 'Cancelled' THEN 3
                    ELSE 4
                END,
                p.StartUtc DESC,
                p.OperationalPeriodId DESC;

            BEGIN TRANSACTION;

            -- Release any currently active assignment rows for this position.
            UPDATE ic.IncidentCommandAssignment
            SET AssignedToUtc = COALESCE(AssignedToUtc, SYSUTCDATETIME()),
                AssignmentStatusCode = CASE
                    WHEN AssignmentStatusCode IN ('Assigned', 'Accepted') THEN 'Released'
                    ELSE AssignmentStatusCode
                END
            WHERE IncidentId = @incidentId
              AND IcsPositionId = @icsPositionId
              AND AssignmentStatusCode IN ('Assigned', 'Accepted')
              AND AssignedToUtc IS NULL;

            -- Insert the new active assignment row.
            INSERT INTO ic.IncidentCommandAssignment
            (IncidentId, OperationalPeriodId, IcsPositionId, AssignedUserId, AssignedContactId, AgencyOrganizationId, AssignedFromUtc, AssignedToUtc, AssignmentStatusCode, Notes)
            VALUES
            (@incidentId, @operationalPeriodId, @icsPositionId, @assignedUserId, @assignedContactId, @agencyOrganizationId, SYSUTCDATETIME(), NULL, 'Assigned', @notes);

            COMMIT TRANSACTION;
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@icsPositionId", SqlDbType.Int) { Value = request.IcsPositionId });
            command.Parameters.Add(new SqlParameter("@assignedUserId", SqlDbType.BigInt) { Value = (object?)request.AssignedUserId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@assignedContactId", SqlDbType.BigInt) { Value = (object?)request.AssignedContactId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@agencyOrganizationId", SqlDbType.BigInt) { Value = (object?)request.AgencyOrganizationId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@notes", SqlDbType.NVarChar, 1000) { Value = (object?)request.Notes ?? DBNull.Value });

            await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Upserted command assignment for IncidentId {IncidentId}, IcsPositionId {IcsPositionId} by UserId {AssignedByUserId}.", incidentId, request.IcsPositionId, assignedByUserId);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while upserting command assignment for IncidentId {IncidentId}, IcsPositionId {IcsPositionId}.", incidentId, request.IcsPositionId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while upserting command assignment for IncidentId {IncidentId}, IcsPositionId {IcsPositionId}.", incidentId, request.IcsPositionId);
            throw;
        }
    }

    public async Task UpsertIncidentCommandTransferAsync(long incidentId, CreateIncidentCommandTransferRequestDto request, long assignedByUserId, CancellationToken cancellationToken)
    {
        var notes = string.Join(" | ", new[]
        {
            string.IsNullOrWhiteSpace(request.TransferSummary) ? null : $"Transfer: {request.TransferSummary.Trim()}",
            string.IsNullOrWhiteSpace(request.CommandPostLocation) ? null : $"CommandPost: {request.CommandPostLocation.Trim()}"
        }.Where(value => !string.IsNullOrWhiteSpace(value)));

        await UpsertIncidentCommandAssignmentAsync(
            incidentId,
            new UpsertIncidentCommandAssignmentRequestDto(
                request.IcsPositionId,
                request.AssignedUserId,
                request.AssignedContactId,
                request.AgencyOrganizationId,
                string.IsNullOrWhiteSpace(notes) ? null : notes),
            assignedByUserId,
            cancellationToken);
    }

    public async Task<bool> RemoveIncidentCommandAssignmentAsync(long incidentId, int icsPositionId, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE ic.IncidentCommandAssignment
            SET AssignedToUtc = SYSUTCDATETIME(),
                AssignmentStatusCode = 'Released'
            WHERE IncidentId = @incidentId
              AND IcsPositionId = @icsPositionId
              AND AssignmentStatusCode = 'Assigned'
              AND (AssignedToUtc IS NULL OR AssignedToUtc > SYSUTCDATETIME());
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

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            command.Parameters.Add(new SqlParameter("@icsPositionId", SqlDbType.Int) { Value = icsPositionId });

            var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Removed command assignment for IncidentId {IncidentId}, IcsPositionId {IcsPositionId}. Rows affected: {RowsAffected}.", incidentId, icsPositionId, rowsAffected);
            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while removing command assignment for IncidentId {IncidentId}, IcsPositionId {IcsPositionId}.", incidentId, icsPositionId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while removing command assignment for IncidentId {IncidentId}, IcsPositionId {IcsPositionId}.", incidentId, icsPositionId);
            throw;
        }
    }

    public async Task<Ics201DataDto?> GetIcs201DataAsync(long incidentId, CancellationToken cancellationToken)
    {
        try
        {
            var incidentDetail = await GetIncidentByIdAsync(incidentId, cancellationToken);
            if (incidentDetail is null)
            {
                return null;
            }

            var periods = await GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
            var currentPeriod = periods
                .Where(p => p.StartUtc <= DateTimeOffset.UtcNow && (p.EndUtc >= DateTimeOffset.UtcNow || p.StatusCode == "Active"))
                .OrderByDescending(p => p.StartUtc)
                .FirstOrDefault();

            var objectives = await GetIncidentObjectivesAsync(incidentId, cancellationToken);
            var activeObjectives = objectives
                .Where(o => o.StatusCode is "Active" or "InProgress" or "Planned")
                .OrderBy(o => o.ObjectiveNumber)
                .ToList();

            var commandAssignments = await GetIncidentCommandAssignmentsAsync(incidentId, cancellationToken);
            var resources = await GetIncidentResourceRequestsAsync(incidentId, cancellationToken);

            var totalRequestedQuantity = resources.Sum(r => r.RequestedQuantity);
            var totalAssignedQuantity = resources.Sum(r => r.AssignedQuantity ?? 0m);
            var openRequestCount = resources.Count(r => !string.Equals(r.StatusCode, "Fulfilled", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(r.StatusCode, "Cancelled", StringComparison.OrdinalIgnoreCase));
            var highPriorityOpenCount = resources.Count(r =>
                !string.Equals(r.StatusCode, "Fulfilled", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(r.StatusCode, "Cancelled", StringComparison.OrdinalIgnoreCase)
                && (string.Equals(r.PriorityCode, "High", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(r.PriorityCode, "Critical", StringComparison.OrdinalIgnoreCase)));

            var resourceStatusSummary = resources.Count == 0
                ? "No incident resource requests recorded."
                : $"{resources.Count} request(s), {openRequestCount} open, {highPriorityOpenCount} high-priority open, assigned {totalAssignedQuantity:0.##} of {totalRequestedQuantity:0.##} requested.";

            return new Ics201DataDto(
                incidentDetail,
                currentPeriod,
                activeObjectives,
                commandAssignments.ToList(),
                resourceStatusSummary);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while retrieving ICS-201 data for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<Ics202IncidentObjectivesDto?> GetIcs202DataAsync(long incidentId, CancellationToken cancellationToken)
    {
        try
        {
            var incidentDetail = await GetIncidentByIdAsync(incidentId, cancellationToken);
            if (incidentDetail is null)
            {
                return null;
            }

            var periods = await GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
            var currentPeriod = periods
                .Where(p => p.StartUtc <= DateTimeOffset.UtcNow && (p.EndUtc >= DateTimeOffset.UtcNow || p.StatusCode == "Active"))
                .OrderByDescending(p => p.StartUtc)
                .FirstOrDefault();

            var objectives = await GetIncidentObjectivesAsync(incidentId, cancellationToken);
            var periodScopedObjectives = currentPeriod is null
                ? objectives
                : objectives.Where(o => o.OperationalPeriodId == currentPeriod.OperationalPeriodId || o.OperationalPeriodId is null).ToList();

            var orderedObjectives = periodScopedObjectives
                .OrderBy(o => o.ObjectiveNumber)
                .ToList();

            return new Ics202IncidentObjectivesDto(
                incidentDetail,
                currentPeriod,
                orderedObjectives,
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while retrieving ICS-202 data for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<Ics203OrganizationAssignmentListDto?> GetIcs203DataAsync(long incidentId, CancellationToken cancellationToken)
    {
        try
        {
            var incidentDetail = await GetIncidentByIdAsync(incidentId, cancellationToken);
            if (incidentDetail is null)
            {
                return null;
            }

            var periods = await GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
            var currentPeriod = periods
                .Where(p => p.StartUtc <= DateTimeOffset.UtcNow && (p.EndUtc >= DateTimeOffset.UtcNow || p.StatusCode == "Active"))
                .OrderByDescending(p => p.StartUtc)
                .FirstOrDefault();

            var assignments = await GetIncidentCommandAssignmentsAsync(incidentId, cancellationToken);
            var orderedAssignments = assignments
                .OrderBy(a => a.IcsSection)
                .ThenBy(a => a.PositionName)
                .ToList();

            return new Ics203OrganizationAssignmentListDto(
                incidentDetail,
                currentPeriod,
                orderedAssignments,
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while retrieving ICS-203 data for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<Ics205CommunicationsPlanDto?> GetIcs205DataAsync(long incidentId, CancellationToken cancellationToken)
    {
        try
        {
            var incidentDetail = await GetIncidentByIdAsync(incidentId, cancellationToken);
            if (incidentDetail is null)
            {
                return null;
            }

            var periods = await GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
            var currentPeriod = periods
                .Where(p => p.StartUtc <= DateTimeOffset.UtcNow && (p.EndUtc >= DateTimeOffset.UtcNow || p.StatusCode == "Active"))
                .OrderByDescending(p => p.StartUtc)
                .FirstOrDefault();

            var communications = await GetIncidentCommunicationsAsync(incidentId, cancellationToken);
            var activeCommunications = communications
                .Where(c => !string.Equals(c.StatusCode, "Archived", StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(c => c.LoggedUtc)
                .ToList();

            var commandAssignments = await GetIncidentCommandAssignmentsAsync(incidentId, cancellationToken);

            return new Ics205CommunicationsPlanDto(
                incidentDetail,
                currentPeriod,
                activeCommunications,
                commandAssignments.ToList(),
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while retrieving ICS-205 data for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<Ics209IncidentStatusSummaryDto?> GetIcs209DataAsync(long incidentId, CancellationToken cancellationToken)
    {
        try
        {
            var incidentDetail = await GetIncidentByIdAsync(incidentId, cancellationToken);
            if (incidentDetail is null)
            {
                return null;
            }

            var periods = await GetIncidentOperationalPeriodsAsync(incidentId, cancellationToken);
            var currentPeriod = periods
                .Where(p => p.StartUtc <= DateTimeOffset.UtcNow && (p.EndUtc >= DateTimeOffset.UtcNow || p.StatusCode == "Active"))
                .OrderByDescending(p => p.StartUtc)
                .FirstOrDefault();

            var tasks = await GetIncidentTasksAsync(incidentId, cancellationToken);
            var openTaskCount = tasks.Count(t => !string.Equals(t.StatusCode, "Completed", StringComparison.OrdinalIgnoreCase));

            var objectives = await GetIncidentObjectivesAsync(incidentId, cancellationToken);
            var activeObjectiveCount = objectives.Count(o => o.StatusCode is "Active" or "InProgress" or "Planned");

            var resources = await GetIncidentResourceRequestsAsync(incidentId, cancellationToken);
            var activeResourceRequestCount = resources.Count(r => !string.Equals(r.StatusCode, "Archived", StringComparison.OrdinalIgnoreCase));

            var communications = await GetIncidentCommunicationsAsync(incidentId, cancellationToken);
            var activeCommunicationCount = communications.Count(c => !string.Equals(c.StatusCode, "Archived", StringComparison.OrdinalIgnoreCase));

            return new Ics209IncidentStatusSummaryDto(
                incidentDetail,
                currentPeriod,
                openTaskCount,
                activeObjectiveCount,
                activeResourceRequestCount,
                activeCommunicationCount,
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while retrieving ICS-209 data for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<IncidentIapPacketDto?> GetIncidentIapPacketAsync(long incidentId, CancellationToken cancellationToken)
    {
        var ics201 = await GetIcs201DataAsync(incidentId, cancellationToken);
        if (ics201 is null)
        {
            return null;
        }

        var ics202 = await GetIcs202DataAsync(incidentId, cancellationToken);
        var ics203 = await GetIcs203DataAsync(incidentId, cancellationToken);
        var ics204 = await GetIcs204DataAsync(incidentId, cancellationToken);
        var ics205 = await GetIcs205DataAsync(incidentId, cancellationToken);
        var ics214 = await GetIcs214DataAsync(incidentId, cancellationToken);
        var ics215 = await GetIcs215DataAsync(incidentId, cancellationToken);
        var ics209 = await GetIcs209DataAsync(incidentId, cancellationToken);
        var situationReports = await GetSituationReportsAsync(incidentId, cancellationToken);

        return new IncidentIapPacketDto(
            incidentId,
            DateTimeOffset.UtcNow,
            ics201,
            ics202,
            ics203,
            ics204,
            ics205,
            ics214,
            ics215,
            ics209,
            situationReports.ToList());
    }

    public async Task<IReadOnlyList<SituationReportDto>> GetSituationReportsAsync(long incidentId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                sr.SituationReportId,
                sr.IncidentId,
                sr.OperationalPeriodId,
                sr.ReportNumber,
                sr.ReportedUtc,
                sr.ReportedByUserId,
                u.DisplayName AS ReportedByUserDisplayName,
                sr.Summary,
                sr.CurrentActions,
                sr.PlannedActions,
                sr.UnmetNeeds,
                sr.StatusCode
            FROM ic.SituationReport sr
            INNER JOIN sec.AppUser u ON sr.ReportedByUserId = u.UserId
            WHERE sr.IncidentId = @incidentId
            ORDER BY sr.ReportNumber DESC;
            """;

        var reports = new List<SituationReportDto>();

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(sql, connection)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                reports.Add(new SituationReportDto(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    reader.IsDBNull(2) ? null : reader.GetInt64(2),
                    reader.GetInt32(3),
                    reader.GetDateTime(4),
                    reader.GetInt64(5),
                    reader.GetString(6),
                    reader.GetString(7),
                    reader.IsDBNull(8) ? null : reader.GetString(8),
                    reader.IsDBNull(9) ? null : reader.GetString(9),
                    reader.IsDBNull(10) ? null : reader.GetString(10),
                    reader.GetString(11)));
            }

            _logger.LogInformation("Retrieved {ReportCount} situation reports for IncidentId {IncidentId}.", reports.Count, incidentId);
            return reports;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while retrieving situation reports for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while retrieving situation reports for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }

    public async Task<long> CreateSituationReportAsync(long incidentId, GenerateSituationReportRequestDto request, long reportedByUserId, CancellationToken cancellationToken)
    {
        const string getNextReportNumberSql = """
            SELECT ISNULL(MAX(ReportNumber), 0) + 1
            FROM ic.SituationReport
            WHERE IncidentId = @incidentId;
            """;

        const string insertSql = """
            INSERT INTO ic.SituationReport (IncidentId, OperationalPeriodId, ReportNumber, ReportedByUserId, Summary, CurrentActions, PlannedActions, UnmetNeeds, StatusCode)
            OUTPUT INSERTED.SituationReportId
            VALUES (@incidentId, @operationalPeriodId, @reportNumber, @reportedByUserId, @summary, @currentActions, @plannedActions, @unmetNeeds, 'Published');
            """;

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var transaction = connection.BeginTransaction();

            // Get next report number
            await using var getNumberCommand = new SqlCommand(getNextReportNumberSql, connection, transaction)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };
            getNumberCommand.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });

            var nextReportNumber = (int)(await getNumberCommand.ExecuteScalarAsync(cancellationToken) ?? 1);

            // Insert new situation report
            await using var insertCommand = new SqlCommand(insertSql, connection, transaction)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            insertCommand.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId });
            insertCommand.Parameters.Add(new SqlParameter("@operationalPeriodId", SqlDbType.BigInt) { Value = (object?)request.OperationalPeriodId ?? DBNull.Value });
            insertCommand.Parameters.Add(new SqlParameter("@reportNumber", SqlDbType.Int) { Value = nextReportNumber });
            insertCommand.Parameters.Add(new SqlParameter("@reportedByUserId", SqlDbType.BigInt) { Value = reportedByUserId });
            insertCommand.Parameters.Add(new SqlParameter("@summary", SqlDbType.NVarChar, -1) { Value = request.Summary });
            insertCommand.Parameters.Add(new SqlParameter("@currentActions", SqlDbType.NVarChar, -1) { Value = (object?)request.CurrentActions ?? DBNull.Value });
            insertCommand.Parameters.Add(new SqlParameter("@plannedActions", SqlDbType.NVarChar, -1) { Value = (object?)request.PlannedActions ?? DBNull.Value });
            insertCommand.Parameters.Add(new SqlParameter("@unmetNeeds", SqlDbType.NVarChar, -1) { Value = (object?)request.UnmetNeeds ?? DBNull.Value });

            var situationReportId = (long)(await insertCommand.ExecuteScalarAsync(cancellationToken) ?? 0);

            transaction.Commit();

            _logger.LogInformation("Created situation report {SituationReportId} (Report #{ReportNumber}) for IncidentId {IncidentId}.", situationReportId, nextReportNumber, incidentId);
            return situationReportId;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Database error while creating situation report for IncidentId {IncidentId}.", incidentId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while creating situation report for IncidentId {IncidentId}.", incidentId);
            throw;
        }
    }
}

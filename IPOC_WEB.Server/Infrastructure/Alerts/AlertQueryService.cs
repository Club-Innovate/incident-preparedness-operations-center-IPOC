using System.Data;
using IPOC_WEB.Server.Infrastructure.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace IPOC_WEB.Server.Infrastructure.Alerts;

public interface IAlertQueryService
{
    Task<IReadOnlyList<UiAlertDto>> GetUiAlertsAsync(long userId, CancellationToken cancellationToken);
    Task<long> CreateUiAlertAsync(long userId, CreateUiAlertRequestDto request, CancellationToken cancellationToken);
    Task<bool> AcknowledgeUiAlertAsync(long userId, long alertId, CancellationToken cancellationToken);
    Task<bool> DeleteUiAlertAsync(long userId, long alertId, CancellationToken cancellationToken);
    Task<int> ClearUiAlertsAsync(long userId, CancellationToken cancellationToken);
    Task<CommunicationDispatchResultDto> CreateCommunicationDispatchAsync(long userId, CreateCommunicationDispatchRequestDto request, CancellationToken cancellationToken);
    Task<IReadOnlyList<NotificationRecipientDto>> GetNotificationRecipientsAsync(long userId, long notificationId, CancellationToken cancellationToken);
    Task<bool> UpdateNotificationRecipientDeliveryStatusAsync(long userId, long notificationId, long notificationRecipientId, UpdateRecipientDeliveryStatusRequestDto request, CancellationToken cancellationToken);
    Task<bool> AcknowledgeNotificationRecipientAsync(long userId, long notificationId, long notificationRecipientId, string? acknowledgmentNote, CancellationToken cancellationToken);
    Task<EscalationResultDto?> EscalateNotificationAsync(long userId, long sourceNotificationId, EscalateNotificationRequestDto request, CancellationToken cancellationToken);
}

public sealed class AlertQueryService : IAlertQueryService
{
    private const string UiTypeCode = "UI_ALERT";
    private const string NormalPriority = "Normal";
    private const string EscalationTypeCode = "ESCALATION";
    private const string QueuedStatusCode = "Queued";
    private readonly string _connectionString;
    private readonly ILogger<AlertQueryService> _logger;

    public AlertQueryService(IConfiguration configuration, IOptions<SqlDataOptions> sqlOptions, ILogger<AlertQueryService> logger)
    {
        _logger = logger;
        _connectionString = configuration.GetConnectionString(sqlOptions.Value.ConnectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{sqlOptions.Value.ConnectionStringName}' is not configured.");
    }

    public async Task<IReadOnlyList<UiAlertDto>> GetUiAlertsAsync(long userId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (300)
                n.NotificationId,
                n.MessageBody,
                CASE n.PriorityCode
                    WHEN 'High' THEN 'danger'
                    WHEN 'Critical' THEN 'danger'
                    WHEN 'Normal' THEN 'info'
                    WHEN 'Low' THEN 'success'
                    ELSE 'info'
                END AS Variant,
                CASE
                    WHEN n.NotificationTypeCode = @uiAlertTypeCode THEN 'system'
                    WHEN n.NotificationTypeCode LIKE 'INCIDENT_%' THEN 'incident'
                    WHEN n.NotificationTypeCode LIKE 'RESOURCE_%' THEN 'facilities'
                    WHEN n.NotificationTypeCode LIKE 'SECURITY_%' THEN 'security'
                    ELSE 'system'
                END AS Source,
                n.CreatedUtc,
                CASE
                    WHEN n.NotificationStatusCode = 'Acknowledged' THEN 'acknowledged'
                    ELSE 'new'
                END AS AlertStatus
            FROM comm.Notification n
            WHERE n.CreatedByUserId = @userId
              AND (n.NotificationTypeCode = @uiAlertTypeCode OR n.NotificationTypeCode LIKE 'UI_ALERT_%')
            ORDER BY n.CreatedUtc DESC, n.NotificationId DESC;
            """;

        var alerts = new List<UiAlertDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@uiAlertTypeCode", SqlDbType.NVarChar, 80) { Value = UiTypeCode });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            alerts.Add(new UiAlertDto(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetDateTime(4),
                reader.GetString(5)));
        }

        _logger.LogInformation("Retrieved {AlertCount} UI alerts for UserId {UserId}.", alerts.Count, userId);
        return alerts;
    }

    public async Task<long> CreateUiAlertAsync(long userId, CreateUiAlertRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO comm.Notification
            (
                IncidentId,
                PromptId,
                NotificationTypeCode,
                Subject,
                MessageBody,
                PriorityCode,
                CreatedByUserId,
                ScheduledSendUtc,
                NotificationStatusCode
            )
            OUTPUT INSERTED.NotificationId
            VALUES
            (
                NULL,
                NULL,
                @notificationTypeCode,
                @subject,
                @messageBody,
                @priorityCode,
                @createdByUserId,
                NULL,
                @notificationStatusCode
            );
            """;

        var priorityCode = request.Variant switch
        {
            "danger" => "High",
            "warning" => "High",
            "success" => "Low",
            _ => NormalPriority,
        };

        var statusCode = string.Equals(request.Status, "acknowledged", StringComparison.OrdinalIgnoreCase)
            ? "Acknowledged"
            : QueuedStatusCode;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@notificationTypeCode", SqlDbType.NVarChar, 80) { Value = UiTypeCode });
        command.Parameters.Add(new SqlParameter("@subject", SqlDbType.NVarChar, 300) { Value = request.Source.Trim().Length == 0 ? "UI Alert" : $"UI Alert - {request.Source.Trim()}" });
        command.Parameters.Add(new SqlParameter("@messageBody", SqlDbType.NVarChar, -1) { Value = request.Message });
        command.Parameters.Add(new SqlParameter("@priorityCode", SqlDbType.NVarChar, 80) { Value = priorityCode });
        command.Parameters.Add(new SqlParameter("@createdByUserId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@notificationStatusCode", SqlDbType.NVarChar, 80) { Value = statusCode });

        var alertId = (long)(await command.ExecuteScalarAsync(cancellationToken) ?? 0L);
        _logger.LogInformation("Created UI alert {AlertId} for UserId {UserId}.", alertId, userId);
        return alertId;
    }

    public async Task<bool> AcknowledgeUiAlertAsync(long userId, long alertId, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE comm.Notification
            SET NotificationStatusCode = 'Acknowledged'
            WHERE NotificationId = @alertId
              AND CreatedByUserId = @userId
              AND (NotificationTypeCode = @uiAlertTypeCode OR NotificationTypeCode LIKE 'UI_ALERT_%');
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@alertId", SqlDbType.BigInt) { Value = alertId });
        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@uiAlertTypeCode", SqlDbType.NVarChar, 80) { Value = UiTypeCode });

        var affected = await command.ExecuteNonQueryAsync(cancellationToken);
        return affected > 0;
    }

    public async Task<bool> DeleteUiAlertAsync(long userId, long alertId, CancellationToken cancellationToken)
    {
        const string sql = """
            DELETE FROM comm.Notification
            WHERE NotificationId = @alertId
              AND CreatedByUserId = @userId
              AND (NotificationTypeCode = @uiAlertTypeCode OR NotificationTypeCode LIKE 'UI_ALERT_%');
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@alertId", SqlDbType.BigInt) { Value = alertId });
        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@uiAlertTypeCode", SqlDbType.NVarChar, 80) { Value = UiTypeCode });

        var affected = await command.ExecuteNonQueryAsync(cancellationToken);
        return affected > 0;
    }

    public async Task<int> ClearUiAlertsAsync(long userId, CancellationToken cancellationToken)
    {
        const string sql = """
            DELETE FROM comm.Notification
            WHERE CreatedByUserId = @userId
              AND (NotificationTypeCode = @uiAlertTypeCode OR NotificationTypeCode LIKE 'UI_ALERT_%');
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@uiAlertTypeCode", SqlDbType.NVarChar, 80) { Value = UiTypeCode });

        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<CommunicationDispatchResultDto> CreateCommunicationDispatchAsync(long userId, CreateCommunicationDispatchRequestDto request, CancellationToken cancellationToken)
    {
        const string insertNotificationSql = """
            INSERT INTO comm.Notification
            (
                IncidentId,
                PromptId,
                NotificationTypeCode,
                Subject,
                MessageBody,
                PriorityCode,
                CreatedByUserId,
                ScheduledSendUtc,
                NotificationStatusCode
            )
            OUTPUT INSERTED.NotificationId
            VALUES
            (
                @incidentId,
                NULL,
                @notificationTypeCode,
                @subject,
                @messageBody,
                @priorityCode,
                @createdByUserId,
                NULL,
                @notificationStatusCode
            );
            """;

        const string insertRecipientSql = """
            INSERT INTO comm.NotificationRecipient
            (
                NotificationId,
                UserId,
                ContactId,
                LocationId,
                ChannelCode,
                DestinationAddress,
                DeliveryStatusCode
            )
            VALUES
            (
                @notificationId,
                @userId,
                @contactId,
                @locationId,
                @channelCode,
                @destinationAddress,
                'Queued'
            );
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            long notificationId;
            await using (var insertNotificationCommand = new SqlCommand(insertNotificationSql, connection, (SqlTransaction)transaction)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            })
            {
                insertNotificationCommand.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = request.IncidentId is > 0 ? request.IncidentId.Value : DBNull.Value });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@notificationTypeCode", SqlDbType.NVarChar, 80) { Value = request.NotificationTypeCode });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@subject", SqlDbType.NVarChar, 300) { Value = request.Subject });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@messageBody", SqlDbType.NVarChar, -1) { Value = request.MessageBody });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@priorityCode", SqlDbType.NVarChar, 40) { Value = request.PriorityCode });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@createdByUserId", SqlDbType.BigInt) { Value = userId });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@notificationStatusCode", SqlDbType.NVarChar, 40) { Value = QueuedStatusCode });

                notificationId = (long)(await insertNotificationCommand.ExecuteScalarAsync(cancellationToken) ?? 0L);
            }

            var recipientCount = 0;
            foreach (var recipient in request.Recipients)
            {
                await using var insertRecipientCommand = new SqlCommand(insertRecipientSql, connection, (SqlTransaction)transaction)
                {
                    CommandType = CommandType.Text,
                    CommandTimeout = 30,
                };

                insertRecipientCommand.Parameters.Add(new SqlParameter("@notificationId", SqlDbType.BigInt) { Value = notificationId });
                insertRecipientCommand.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = recipient.UserId is > 0 ? recipient.UserId.Value : DBNull.Value });
                insertRecipientCommand.Parameters.Add(new SqlParameter("@contactId", SqlDbType.BigInt) { Value = recipient.ContactId is > 0 ? recipient.ContactId.Value : DBNull.Value });
                insertRecipientCommand.Parameters.Add(new SqlParameter("@locationId", SqlDbType.BigInt) { Value = recipient.LocationId is > 0 ? recipient.LocationId.Value : DBNull.Value });
                insertRecipientCommand.Parameters.Add(new SqlParameter("@channelCode", SqlDbType.NVarChar, 40) { Value = recipient.ChannelCode });
                insertRecipientCommand.Parameters.Add(new SqlParameter("@destinationAddress", SqlDbType.NVarChar, 320) { Value = recipient.DestinationAddress });

                recipientCount += await insertRecipientCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            _logger.LogInformation("Created communication dispatch NotificationId {NotificationId} with {RecipientCount} recipient(s).", notificationId, recipientCount);
            return new CommunicationDispatchResultDto(notificationId, recipientCount, QueuedStatusCode);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<IReadOnlyList<NotificationRecipientDto>> GetNotificationRecipientsAsync(long userId, long notificationId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                r.NotificationRecipientId,
                r.NotificationId,
                r.UserId,
                r.ContactId,
                r.LocationId,
                r.ChannelCode,
                r.DestinationAddress,
                r.DeliveryStatusCode,
                r.SentUtc,
                r.FailureReason,
                ack.AcknowledgedUtc,
                ack.AcknowledgedByUserId
            FROM comm.NotificationRecipient r
            INNER JOIN comm.Notification n
                ON n.NotificationId = r.NotificationId
            LEFT JOIN comm.NotificationRecipientAcknowledgment ack
                ON ack.NotificationRecipientId = r.NotificationRecipientId
            WHERE r.NotificationId = @notificationId
              AND n.CreatedByUserId = @userId
            ORDER BY r.NotificationRecipientId;
            """;

        var recipients = new List<NotificationRecipientDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@notificationId", SqlDbType.BigInt) { Value = notificationId });
        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            recipients.Add(new NotificationRecipientDto(
                NotificationRecipientId: reader.GetInt64(0),
                NotificationId: reader.GetInt64(1),
                UserId: reader.IsDBNull(2) ? null : reader.GetInt64(2),
                ContactId: reader.IsDBNull(3) ? null : reader.GetInt64(3),
                LocationId: reader.IsDBNull(4) ? null : reader.GetInt64(4),
                ChannelCode: reader.GetString(5),
                DestinationAddress: reader.GetString(6),
                DeliveryStatusCode: reader.GetString(7),
                SentUtc: reader.IsDBNull(8) ? null : reader.GetDateTime(8),
                FailureReason: reader.IsDBNull(9) ? null : reader.GetString(9),
                AcknowledgedUtc: reader.IsDBNull(10) ? null : reader.GetDateTime(10),
                AcknowledgedByUserId: reader.IsDBNull(11) ? null : reader.GetInt64(11)));
        }

        return recipients;
    }

    public async Task<bool> UpdateNotificationRecipientDeliveryStatusAsync(long userId, long notificationId, long notificationRecipientId, UpdateRecipientDeliveryStatusRequestDto request, CancellationToken cancellationToken)
    {
        const string updateSql = """
            UPDATE r
            SET
                r.DeliveryStatusCode = @deliveryStatusCode,
                r.FailureReason = CASE WHEN @deliveryStatusCode = 'Failed' THEN @failureReason ELSE NULL END,
                r.SentUtc = CASE
                    WHEN @deliveryStatusCode = 'Sent' THEN COALESCE(r.SentUtc, SYSUTCDATETIME())
                    ELSE r.SentUtc
                END
            FROM comm.NotificationRecipient r
            INNER JOIN comm.Notification n
                ON n.NotificationId = r.NotificationId
            WHERE r.NotificationRecipientId = @notificationRecipientId
              AND r.NotificationId = @notificationId
              AND n.CreatedByUserId = @userId;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            await using var command = new SqlCommand(updateSql, connection, (SqlTransaction)transaction)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            };

            command.Parameters.Add(new SqlParameter("@deliveryStatusCode", SqlDbType.NVarChar, 40) { Value = request.DeliveryStatusCode });
            command.Parameters.Add(new SqlParameter("@failureReason", SqlDbType.NVarChar, 1000) { Value = string.IsNullOrWhiteSpace(request.FailureReason) ? DBNull.Value : request.FailureReason.Trim() });
            command.Parameters.Add(new SqlParameter("@notificationRecipientId", SqlDbType.BigInt) { Value = notificationRecipientId });
            command.Parameters.Add(new SqlParameter("@notificationId", SqlDbType.BigInt) { Value = notificationId });
            command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });

            var affected = await command.ExecuteNonQueryAsync(cancellationToken);
            if (affected <= 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }

            await RecalculateNotificationStatusAsync(connection, (SqlTransaction)transaction, notificationId, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return true;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<bool> AcknowledgeNotificationRecipientAsync(long userId, long notificationId, long notificationRecipientId, string? acknowledgmentNote, CancellationToken cancellationToken)
    {
        const string sql = """
            MERGE comm.NotificationRecipientAcknowledgment AS target
            USING
            (
                SELECT
                    r.NotificationRecipientId AS NotificationRecipientId,
                    r.NotificationId AS NotificationId
                FROM comm.NotificationRecipient r
                INNER JOIN comm.Notification n ON n.NotificationId = r.NotificationId
                WHERE r.NotificationRecipientId = @notificationRecipientId
                  AND r.NotificationId = @notificationId
                  AND n.CreatedByUserId = @userId
            ) AS src
                ON target.NotificationRecipientId = src.NotificationRecipientId
            WHEN MATCHED THEN
                UPDATE SET
                    target.AcknowledgedByUserId = @acknowledgedByUserId,
                    target.AcknowledgedUtc = SYSUTCDATETIME(),
                    target.AcknowledgmentNote = @acknowledgmentNote
            WHEN NOT MATCHED THEN
                INSERT
                (
                    NotificationRecipientId,
                    NotificationId,
                    AcknowledgedByUserId,
                    AcknowledgedUtc,
                    AcknowledgmentNote
                )
                VALUES
                (
                    src.NotificationRecipientId,
                    src.NotificationId,
                    @acknowledgedByUserId,
                    SYSUTCDATETIME(),
                    @acknowledgmentNote
                );
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@notificationRecipientId", SqlDbType.BigInt) { Value = notificationRecipientId });
        command.Parameters.Add(new SqlParameter("@notificationId", SqlDbType.BigInt) { Value = notificationId });
        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@acknowledgedByUserId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@acknowledgmentNote", SqlDbType.NVarChar, 1000) { Value = string.IsNullOrWhiteSpace(acknowledgmentNote) ? DBNull.Value : acknowledgmentNote.Trim() });

        var affected = await command.ExecuteNonQueryAsync(cancellationToken);
        return affected > 0;
    }

    public async Task<EscalationResultDto?> EscalateNotificationAsync(long userId, long sourceNotificationId, EscalateNotificationRequestDto request, CancellationToken cancellationToken)
    {
        const string sourceSql = """
            SELECT IncidentId, Subject, MessageBody, PriorityCode
            FROM comm.Notification
            WHERE NotificationId = @sourceNotificationId
              AND CreatedByUserId = @userId;
            """;

        const string insertNotificationSql = """
            INSERT INTO comm.Notification
            (
                IncidentId,
                PromptId,
                NotificationTypeCode,
                Subject,
                MessageBody,
                PriorityCode,
                CreatedByUserId,
                ScheduledSendUtc,
                NotificationStatusCode
            )
            OUTPUT INSERTED.NotificationId
            VALUES
            (
                @incidentId,
                NULL,
                @notificationTypeCode,
                @subject,
                @messageBody,
                @priorityCode,
                @createdByUserId,
                NULL,
                @notificationStatusCode
            );
            """;

        const string insertRecipientSql = """
            INSERT INTO comm.NotificationRecipient
            (
                NotificationId,
                UserId,
                ContactId,
                LocationId,
                ChannelCode,
                DestinationAddress,
                DeliveryStatusCode
            )
            VALUES
            (
                @notificationId,
                @userId,
                NULL,
                NULL,
                @channelCode,
                @destinationAddress,
                'Queued'
            );
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            long? incidentId = null;
            string sourceSubject;
            string sourceMessageBody;
            string sourcePriorityCode;

            await using (var sourceCommand = new SqlCommand(sourceSql, connection, (SqlTransaction)transaction)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            })
            {
                sourceCommand.Parameters.Add(new SqlParameter("@sourceNotificationId", SqlDbType.BigInt) { Value = sourceNotificationId });
                sourceCommand.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });

                await using var reader = await sourceCommand.ExecuteReaderAsync(cancellationToken);
                if (!await reader.ReadAsync(cancellationToken))
                {
                    return null;
                }

                incidentId = reader.IsDBNull(0) ? null : reader.GetInt64(0);
                sourceSubject = reader.GetString(1);
                sourceMessageBody = reader.GetString(2);
                sourcePriorityCode = reader.GetString(3);
            }

            long escalatedNotificationId;
            await using (var insertNotificationCommand = new SqlCommand(insertNotificationSql, connection, (SqlTransaction)transaction)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            })
            {
                insertNotificationCommand.Parameters.Add(new SqlParameter("@incidentId", SqlDbType.BigInt) { Value = incidentId is > 0 ? incidentId.Value : DBNull.Value });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@notificationTypeCode", SqlDbType.NVarChar, 80) { Value = EscalationTypeCode });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@subject", SqlDbType.NVarChar, 300) { Value = $"ESCALATION: {sourceSubject}" });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@messageBody", SqlDbType.NVarChar, -1) { Value = $"{sourceMessageBody}\n\nEscalation Reason: {request.EscalationReason}" });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@priorityCode", SqlDbType.NVarChar, 40) { Value = "Critical" });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@createdByUserId", SqlDbType.BigInt) { Value = userId });
                insertNotificationCommand.Parameters.Add(new SqlParameter("@notificationStatusCode", SqlDbType.NVarChar, 40) { Value = QueuedStatusCode });

                escalatedNotificationId = (long)(await insertNotificationCommand.ExecuteScalarAsync(cancellationToken) ?? 0L);
            }

            await using (var insertRecipientCommand = new SqlCommand(insertRecipientSql, connection, (SqlTransaction)transaction)
            {
                CommandType = CommandType.Text,
                CommandTimeout = 30,
            })
            {
                insertRecipientCommand.Parameters.Add(new SqlParameter("@notificationId", SqlDbType.BigInt) { Value = escalatedNotificationId });
                insertRecipientCommand.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
                insertRecipientCommand.Parameters.Add(new SqlParameter("@channelCode", SqlDbType.NVarChar, 40) { Value = request.EscalationChannelCode });
                insertRecipientCommand.Parameters.Add(new SqlParameter("@destinationAddress", SqlDbType.NVarChar, 320) { Value = request.EscalationDestinationAddress });
                await insertRecipientCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            _logger.LogInformation("Escalated notification {SourceNotificationId} to {EscalatedNotificationId}.", sourceNotificationId, escalatedNotificationId);
            _ = sourcePriorityCode;
            return new EscalationResultDto(sourceNotificationId, escalatedNotificationId, 1);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static async Task RecalculateNotificationStatusAsync(SqlConnection connection, SqlTransaction transaction, long notificationId, CancellationToken cancellationToken)
    {
        const string aggregateSql = """
            SELECT
                COUNT(1) AS TotalCount,
                SUM(CASE WHEN DeliveryStatusCode = 'Sent' THEN 1 ELSE 0 END) AS SentCount,
                SUM(CASE WHEN DeliveryStatusCode = 'Failed' THEN 1 ELSE 0 END) AS FailedCount,
                SUM(CASE WHEN DeliveryStatusCode = 'Queued' THEN 1 ELSE 0 END) AS QueuedCount,
                SUM(CASE WHEN DeliveryStatusCode = 'Cancelled' THEN 1 ELSE 0 END) AS CancelledCount
            FROM comm.NotificationRecipient
            WHERE NotificationId = @notificationId;
            """;

        const string updateSql = """
            UPDATE comm.Notification
            SET NotificationStatusCode = @notificationStatusCode
            WHERE NotificationId = @notificationId;
            """;

        await using var aggregateCommand = new SqlCommand(aggregateSql, connection, transaction)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };
        aggregateCommand.Parameters.Add(new SqlParameter("@notificationId", SqlDbType.BigInt) { Value = notificationId });

        await using var reader = await aggregateCommand.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return;
        }

        var totalCount = reader.IsDBNull(0) ? 0 : reader.GetInt32(0);
        var sentCount = reader.IsDBNull(1) ? 0 : reader.GetInt32(1);
        var failedCount = reader.IsDBNull(2) ? 0 : reader.GetInt32(2);
        var queuedCount = reader.IsDBNull(3) ? 0 : reader.GetInt32(3);
        var cancelledCount = reader.IsDBNull(4) ? 0 : reader.GetInt32(4);
        await reader.CloseAsync();

        var computedStatus = totalCount switch
        {
            0 => "Draft",
            _ when failedCount > 0 && sentCount > 0 => "PartiallyFailed",
            _ when failedCount > 0 => "Failed",
            _ when sentCount == totalCount => "Sent",
            _ when cancelledCount == totalCount => "Cancelled",
            _ when queuedCount == totalCount => "Queued",
            _ => "Sending"
        };

        await using var updateCommand = new SqlCommand(updateSql, connection, transaction)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };
        updateCommand.Parameters.Add(new SqlParameter("@notificationStatusCode", SqlDbType.NVarChar, 40) { Value = computedStatus });
        updateCommand.Parameters.Add(new SqlParameter("@notificationId", SqlDbType.BigInt) { Value = notificationId });
        await updateCommand.ExecuteNonQueryAsync(cancellationToken);
    }
}

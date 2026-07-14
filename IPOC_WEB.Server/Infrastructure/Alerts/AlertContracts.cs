namespace IPOC_WEB.Server.Infrastructure.Alerts;

public sealed record UiAlertDto(
    long AlertId,
    string Message,
    string Variant,
    string Source,
    DateTimeOffset OccurredAt,
    string Status);

public sealed record CreateUiAlertRequestDto(
    string Message,
    string Variant,
    string Source,
    string Status);

public sealed record CommunicationRecipientRequestDto(
    long? UserId,
    long? ContactId,
    long? LocationId,
    string ChannelCode,
    string DestinationAddress);

public sealed record CreateCommunicationDispatchRequestDto(
    long? IncidentId,
    string NotificationTypeCode,
    string Subject,
    string MessageBody,
    string PriorityCode,
    IReadOnlyList<CommunicationRecipientRequestDto> Recipients);

public sealed record CommunicationDispatchResultDto(
    long NotificationId,
    int RecipientCount,
    string NotificationStatusCode);

public sealed record NotificationRecipientDto(
    long NotificationRecipientId,
    long NotificationId,
    long? UserId,
    long? ContactId,
    long? LocationId,
    string ChannelCode,
    string DestinationAddress,
    string DeliveryStatusCode,
    DateTimeOffset? SentUtc,
    string? FailureReason,
    DateTimeOffset? AcknowledgedUtc,
    long? AcknowledgedByUserId);

public sealed record UpdateRecipientDeliveryStatusRequestDto(
    string DeliveryStatusCode,
    string? FailureReason);

public sealed record AcknowledgeRecipientRequestDto(
    string? AcknowledgmentNote);

public sealed record EscalateNotificationRequestDto(
    string EscalationReason,
    string EscalationChannelCode,
    string EscalationDestinationAddress);

public sealed record EscalationResultDto(
    long SourceNotificationId,
    long EscalatedNotificationId,
    int RecipientCount);

public static class AlertChannelCodes
{
    public const string Email = "EMAIL";
    public const string Sms = "SMS";
    public const string Voice = "VOICE";
    public const string Push = "PUSH";

    public static readonly HashSet<string> Supported = new(StringComparer.OrdinalIgnoreCase)
    {
        Email,
        Sms,
        Voice,
        Push,
    };
}

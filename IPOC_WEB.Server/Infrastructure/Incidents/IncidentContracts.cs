/*
File: IPOC_WEB.Server/Infrastructure/Incidents/IncidentContracts.cs
Blueprint Name: IncidentContracts

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-12

Description:
Data transfer contracts for incident list/detail API responses.

Features:
  - Immutable record-based DTO definitions.
  - Clear API payload shape for incident operations.

Security & Compliance:
  - Restricts payloads to operational metadata only.
  - Helps avoid overexposure of internal or sensitive fields.
*/

namespace IPOC_WEB.Server.Infrastructure.Incidents;

public sealed record IncidentSummaryDto(
    long IncidentId,
    string IncidentNumber,
    string IncidentName,
    string IncidentTypeCode,
    string IncidentStatusCode,
    string? SeverityCode,
    DateTimeOffset? ActivatedUtc,
    DateTimeOffset CreatedUtc);

public sealed record DashboardSummaryDto(
    long TotalIncidentCount,
    long ActiveIncidentCount,
    long OpenTaskCount,
    long OverdueTaskCount,
    long OpenObjectiveCount,
    DateTimeOffset? LatestSitrepUtc,
    long SitrepsLast24HoursCount);

public sealed record IncidentDetailDto(
    long IncidentId,
    string IncidentNumber,
    string IncidentName,
    string IncidentTypeCode,
    string IncidentStatusCode,
    string? SeverityCode,
    long? LeadOrganizationId,
    int? LeadRegionId,
    long? PrimaryLocationId,
    bool IsPlannedEvent,
    DateTimeOffset? StartedUtc,
    DateTimeOffset? ActivatedUtc,
    DateTimeOffset? ClosedUtc,
    string? InitialSummary,
    string? SituationSummary,
    long CreatedByUserId,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? UpdatedUtc);

public sealed record IncidentResourceLifecycleSummaryDto(
    long TotalRequests,
    long RequestedRequests,
    long ApprovedRequests,
    long PartiallyFulfilledRequests,
    long FulfilledRequests,
    long DeniedRequests,
    long CancelledRequests,
    long ArchivedRequests,
    decimal TotalRequestedQuantity,
    decimal TotalAssignedQuantity,
    long OpenUnassignedRequests);

public sealed record CreateIncidentRequestDto(
    string IncidentNumber,
    string IncidentName,
    string IncidentTypeCode,
    string? SeverityCode,
    long? LeadOrganizationId,
    int? LeadRegionId,
    long? PrimaryLocationId,
    bool IsPlannedEvent,
    string? InitialSummary);

public sealed record UpdateIncidentRequestDto(
    string IncidentName,
    string IncidentTypeCode,
    string? SeverityCode,
    long? LeadOrganizationId,
    int? LeadRegionId,
    long? PrimaryLocationId,
    bool IsPlannedEvent,
    string? InitialSummary,
    string? SituationSummary);

public sealed record IncidentTaskDto(
    long IncidentTaskId,
    long IncidentId,
    string? TaskNumber,
    string TaskTitle,
    string? TaskDescription,
    long? AssignedToUserId,
    string? AssignedToUserDisplayName,
    string PriorityCode,
    string StatusCode,
    DateTimeOffset? DueUtc,
    DateTimeOffset? CompletedUtc,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? UpdatedUtc);

public sealed record CreateIncidentTaskRequestDto(
    string TaskTitle,
    string? TaskDescription,
    string PriorityCode,
    long? AssignedToUserId,
    DateTimeOffset? DueUtc);

public sealed record UpdateIncidentTaskStatusRequestDto(
    string StatusCode);

public sealed record UpdateIncidentTaskAssignmentRequestDto(
    long? AssignedToUserId);

public sealed record IncidentTimelineEventDto(
    long IncidentTimelineEventId,
    long IncidentId,
    DateTimeOffset EventUtc,
    string EventTypeCode,
    string EventTitle,
    string? EventDescription,
    long? LocationId,
    DateTimeOffset CreatedUtc);

public sealed record CreateIncidentTimelineEventRequestDto(
    DateTimeOffset? EventUtc,
    string EventTypeCode,
    string EventTitle,
    string? EventDescription,
    long? LocationId);

public sealed record IncidentCommunicationDto(
    long IncidentCommunicationId,
    long IncidentId,
    long? NotificationId,
    DateTimeOffset LoggedUtc,
    string ChannelCode,
    string DirectionCode,
    string Subject,
    string Message,
    string StatusCode,
    long CreatedByUserId,
    string CreatedByUserDisplayName,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? UpdatedUtc);

public sealed record IncidentCommunicationLifecycleSummaryDto(
    long TotalCommunications,
    long CommunicationsWithNotifications,
    long TotalNotifications,
    long TotalRecipients,
    long QueuedRecipients,
    long SentRecipients,
    long FailedRecipients,
    long SuppressedRecipients,
    long CancelledRecipients,
    long AcknowledgedRecipients,
    long EmailRecipients,
    long SmsRecipients,
    long VoiceRecipients,
    long PushRecipients,
    long EmailFailedRecipients,
    long SmsFailedRecipients,
    long VoiceFailedRecipients,
    long PushFailedRecipients,
    long EmailSentRecipients,
    long SmsSentRecipients,
    long VoiceSentRecipients,
    long PushSentRecipients);

public sealed record CreateIncidentCommunicationRequestDto(
    string ChannelCode,
    string DirectionCode,
    string Subject,
    string Message,
    long? NotificationId,
    string? NotificationTypeCode,
    string? NotificationPriorityCode,
    IReadOnlyList<IncidentCommunicationRecipientRequestDto>? NotificationRecipients);

public sealed record IncidentCommunicationRecipientRequestDto(
    long? UserId,
    long? ContactId,
    long? LocationId,
    string ChannelCode,
    string DestinationAddress);

public sealed record IncidentCommunicationNotificationDispatchResultDto(
    long NotificationId,
    int RecipientCount,
    string NotificationStatusCode);

public sealed record UpdateIncidentCommunicationRequestDto(
    string ChannelCode,
    string DirectionCode,
    string Subject,
    string Message,
    string StatusCode);

public sealed record IncidentResourceRequestDto(
    long IncidentResourceRequestId,
    long IncidentId,
    DateTimeOffset RequestedUtc,
    string ResourceTypeCode,
    string ResourceTypeName,
    decimal RequestedQuantity,
    decimal? AssignedQuantity,
    string UnitOfMeasureCode,
    string PriorityCode,
    string StatusCode,
    string? Notes,
    long RequestedByUserId,
    string RequestedByUserDisplayName,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? UpdatedUtc);

public sealed record CreateIncidentResourceRequestDto(
    string ResourceTypeCode,
    string ResourceTypeName,
    decimal RequestedQuantity,
    string UnitOfMeasureCode,
    string PriorityCode,
    string? Notes);

public sealed record UpdateIncidentResourceRequestDto(
    string ResourceTypeCode,
    string ResourceTypeName,
    decimal RequestedQuantity,
    decimal? AssignedQuantity,
    string UnitOfMeasureCode,
    string PriorityCode,
    string StatusCode,
    string? Notes);

public sealed record IncidentOperationalPeriodDto(
    long OperationalPeriodId,
    long IncidentId,
    int PeriodNumber,
    string? PeriodName,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    string StatusCode,
    DateTimeOffset? PlanningMeetingUtc,
    long? ApprovedByUserId,
    DateTimeOffset? ApprovedUtc);

public sealed record CreateIncidentOperationalPeriodRequestDto(
    int PeriodNumber,
    string? PeriodName,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    string StatusCode,
    DateTimeOffset? PlanningMeetingUtc);

public sealed record UpdateIncidentOperationalPeriodRequestDto(
    int PeriodNumber,
    string? PeriodName,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    string StatusCode,
    DateTimeOffset? PlanningMeetingUtc,
    long? ApprovedByUserId,
    DateTimeOffset? ApprovedUtc);

public sealed record IncidentObjectiveDto(
    long IncidentObjectiveId,
    long IncidentId,
    long? OperationalPeriodId,
    int ObjectiveNumber,
    string ObjectiveText,
    string PriorityCode,
    string StatusCode,
    long? OwnerUserId,
    DateTimeOffset? DueUtc,
    DateTimeOffset CreatedUtc);

public sealed record CreateIncidentObjectiveRequestDto(
    long? OperationalPeriodId,
    int ObjectiveNumber,
    string ObjectiveText,
    string PriorityCode,
    string StatusCode,
    long? OwnerUserId,
    DateTimeOffset? DueUtc);

public sealed record UpdateIncidentObjectiveRequestDto(
    long? OperationalPeriodId,
    int ObjectiveNumber,
    string ObjectiveText,
    string PriorityCode,
    string StatusCode,
    long? OwnerUserId,
    DateTimeOffset? DueUtc);

public sealed record IcsPositionDto(
    int IcsPositionId,
    string PositionCode,
    string PositionName,
    string IcsSection,
    int SortOrder);

public sealed record IncidentCommandAssignmentDto(
    long IncidentCommandAssignmentId,
    long IncidentId,
    int IcsPositionId,
    string PositionCode,
    string PositionName,
    string IcsSection,
    long? AssignedUserId,
    string? AssignedUserDisplayName,
    long? AssignedContactId,
    string? AssignedContactName,
    long? AgencyOrganizationId,
    string? AgencyOrganizationName,
    DateTimeOffset AssignedFromUtc,
    DateTimeOffset? AssignedToUtc,
    string AssignmentStatusCode,
    string? Notes);

public sealed record UpsertIncidentCommandAssignmentRequestDto(
    int IcsPositionId,
    long? AssignedUserId,
    long? AssignedContactId,
    long? AgencyOrganizationId,
    string? Notes);

public sealed record IncidentCommandTransferLogEntryDto(
    long IncidentCommandAssignmentId,
    long IncidentId,
    int IcsPositionId,
    string PositionCode,
    string PositionName,
    string IcsSection,
    long? AssignedUserId,
    string? AssignedUserDisplayName,
    long? AssignedContactId,
    string? AssignedContactName,
    long? AgencyOrganizationId,
    string? AgencyOrganizationName,
    DateTimeOffset AssignedFromUtc,
    DateTimeOffset? AssignedToUtc,
    string AssignmentStatusCode,
    string? Notes);

public sealed record CreateIncidentCommandTransferRequestDto(
    int IcsPositionId,
    long? AssignedUserId,
    long? AssignedContactId,
    long? AgencyOrganizationId,
    string? TransferSummary,
    string? CommandPostLocation);

/// <summary>
/// Situation Report (SITREP) record for ICS-201 and periodic incident status updates.
/// </summary>
public sealed record SituationReportDto(
    long SituationReportId,
    long IncidentId,
    long? OperationalPeriodId,
    int ReportNumber,
    DateTimeOffset ReportedUtc,
    long ReportedByUserId,
    string ReportedByUserDisplayName,
    string Summary,
    string? CurrentActions,
    string? PlannedActions,
    string? UnmetNeeds,
    string StatusCode);

/// <summary>
/// Request DTO for generating a new situation report.
/// </summary>
public sealed record GenerateSituationReportRequestDto(
    long? OperationalPeriodId,
    string Summary,
    string? CurrentActions,
    string? PlannedActions,
    string? UnmetNeeds);

/// <summary>
/// Aggregated ICS-201 data for SITREP/IAP tab display.
/// Combines incident overview, current period, objectives, command assignments, and resource status.
/// </summary>
public sealed record Ics201DataDto(
    IncidentDetailDto IncidentDetail,
    IncidentOperationalPeriodDto? CurrentPeriod,
    IReadOnlyList<IncidentObjectiveDto> ActiveObjectives,
    IReadOnlyList<IncidentCommandAssignmentDto> CommandAssignments,
    string? ResourceStatusSummary);

public sealed record Ics202IncidentObjectivesDto(
    IncidentDetailDto IncidentDetail,
    IncidentOperationalPeriodDto? CurrentPeriod,
    IReadOnlyList<IncidentObjectiveDto> Objectives,
    DateTimeOffset GeneratedUtc);

public sealed record Ics203OrganizationAssignmentListDto(
    IncidentDetailDto IncidentDetail,
    IncidentOperationalPeriodDto? CurrentPeriod,
    IReadOnlyList<IncidentCommandAssignmentDto> Assignments,
    DateTimeOffset GeneratedUtc);

public sealed record Ics205CommunicationsPlanDto(
    IncidentDetailDto IncidentDetail,
    IncidentOperationalPeriodDto? CurrentPeriod,
    IReadOnlyList<IncidentCommunicationDto> ActiveCommunications,
    IReadOnlyList<IncidentCommandAssignmentDto> CommandAssignments,
    DateTimeOffset GeneratedUtc);

public sealed record Ics204AssignmentItemDto(
    long IncidentTaskId,
    string? TaskNumber,
    string TaskTitle,
    string PriorityCode,
    string StatusCode,
    string? AssignedToUserDisplayName,
    DateTimeOffset? DueUtc,
    string? ObjectiveReference);

public sealed record Ics204AssignmentListDto(
    IncidentDetailDto IncidentDetail,
    IncidentOperationalPeriodDto? CurrentPeriod,
    IReadOnlyList<Ics204AssignmentItemDto> Assignments,
    DateTimeOffset GeneratedUtc);

public sealed record Ics214ActivityLogEntryDto(
    DateTimeOffset ActivityUtc,
    string ActivityType,
    string Summary,
    string? Detail,
    string? ActorDisplayName);

public sealed record Ics214ActivityLogDto(
    IncidentDetailDto IncidentDetail,
    IncidentOperationalPeriodDto? CurrentPeriod,
    IReadOnlyList<Ics214ActivityLogEntryDto> Entries,
    DateTimeOffset GeneratedUtc);

public sealed record Ics215SafetyAnalysisItemDto(
    string HazardCategory,
    string HazardDescription,
    string RiskLevel,
    string MitigationAction,
    string? Owner);

public sealed record Ics215IncidentActionPlanSafetyAnalysisDto(
    IncidentDetailDto IncidentDetail,
    IncidentOperationalPeriodDto? CurrentPeriod,
    IReadOnlyList<Ics215SafetyAnalysisItemDto> SafetyItems,
    DateTimeOffset GeneratedUtc);

public sealed record Ics209IncidentStatusSummaryDto(
    IncidentDetailDto IncidentDetail,
    IncidentOperationalPeriodDto? CurrentPeriod,
    int OpenTaskCount,
    int ActiveObjectiveCount,
    int ActiveResourceRequestCount,
    int ActiveCommunicationCount,
    DateTimeOffset GeneratedUtc);

public sealed record IncidentIapPacketDto(
    long IncidentId,
    DateTimeOffset GeneratedUtc,
    Ics201DataDto? Ics201,
    Ics202IncidentObjectivesDto? Ics202,
    Ics203OrganizationAssignmentListDto? Ics203,
    Ics204AssignmentListDto? Ics204,
    Ics205CommunicationsPlanDto? Ics205,
    Ics214ActivityLogDto? Ics214,
    Ics215IncidentActionPlanSafetyAnalysisDto? Ics215,
    Ics209IncidentStatusSummaryDto? Ics209,
    IReadOnlyList<SituationReportDto> SituationReports);

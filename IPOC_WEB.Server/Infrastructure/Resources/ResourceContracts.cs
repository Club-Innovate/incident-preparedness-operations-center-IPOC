/*
File: IPOC_WEB.Server/Infrastructure/Resources/ResourceContracts.cs
Blueprint Name: ResourceContracts

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-06-22

Description:
Contracts for resource inventory and bed availability API payloads.

Features:
  - DTOs for inventory and snapshot views.
  - Request models for resource and bed update operations.

Security & Compliance:
  - Provides explicit payload boundaries for operational data exchange.
  - Helps prevent accidental exposure of non-required fields.
*/

namespace IPOC_WEB.Server.Infrastructure.Resources;

public sealed record ResourceInventoryDto(
    long LocationResourceInventoryId,
    long LocationId,
    string LocationName,
    string ResourceTypeCode,
    string ResourceTypeName,
    decimal QuantityTotal,
    decimal QuantityAvailable,
    decimal QuantityCommitted,
    decimal QuantityOutOfService,
    DateTimeOffset? LastReportedUtc);

public sealed record BedAvailabilityDto(
    long BedAvailabilitySnapshotId,
    long LocationId,
    string LocationName,
    string BedCategoryCode,
    int? StaffedBedsTotal,
    int? BedsAvailable,
    int? BedsOccupied,
    int? BedsUnavailable,
    int? IsolationCapableBeds,
    int? SurgeBedsPotential,
    DateTimeOffset ReportedUtc);

public sealed record ResourceRegionalRollupDto(
    int? RegionId,
    string RegionName,
    decimal ResourceAvailable,
    decimal ResourceCommitted,
    decimal ResourceOutOfService,
    long BedsAvailable,
    long BedsOccupied,
    long BedsUnavailable);

public sealed record ResourceRegionalRollupSnapshotDto(
    DateTimeOffset GeneratedUtc,
    decimal StatewideResourceAvailable,
    decimal StatewideResourceCommitted,
    decimal StatewideResourceOutOfService,
    long StatewideBedsAvailable,
    long StatewideBedsOccupied,
    long StatewideBedsUnavailable,
    IReadOnlyList<ResourceRegionalRollupDto> Regions);

public sealed record ResourceRegionalRollupFilterDto(
    int? RegionId,
    string? RegionName);

public sealed record UpdateResourceInventoryRequestDto(
    decimal? QuantityTotal,
    decimal? QuantityAvailable,
    decimal? QuantityCommitted,
    decimal? QuantityOutOfService,
    string? StatusNotes);

public sealed record UpdateBedAvailabilityRequestDto(
    int? StaffedBedsTotal,
    int? BedsAvailable,
    int? BedsOccupied,
    int? BedsUnavailable,
    int? IsolationCapableBeds,
    int? SurgeBedsPotential,
    string? StatusNotes);

public sealed record UserReportPresetDto(
    long UserReportPresetId,
    string PresetScope,
    string PresetName,
    string PresetJson,
    DateTimeOffset UpdatedUtc);

public sealed record UpsertUserReportPresetRequestDto(
    string PresetName,
    string PresetJson);

public sealed record ResourceInventoryImportRowDto(
    long LocationId,
    string ResourceTypeCode,
    decimal QuantityTotal,
    decimal QuantityAvailable,
    decimal QuantityCommitted,
    decimal QuantityOutOfService,
    DateTimeOffset? ReportedUtc);

public sealed record ResourceInventoryImportBatchRequestDto(
    string SourceSystemCode,
    string? SourceMessageId,
    IReadOnlyList<ResourceInventoryImportRowDto> Rows);

public sealed record BedAvailabilityImportRowDto(
    long LocationId,
    string BedCategoryCode,
    int? StaffedBedsTotal,
    int? BedsAvailable,
    int? BedsOccupied,
    int? BedsUnavailable,
    int? IsolationCapableBeds,
    int? SurgeBedsPotential,
    DateTimeOffset? ReportedUtc);

public sealed record BedAvailabilityImportBatchRequestDto(
    string SourceSystemCode,
    string? SourceMessageId,
    IReadOnlyList<BedAvailabilityImportRowDto> Rows);

public sealed record ImportBatchResultDto(
    int TotalRows,
    int SucceededRows,
    int FailedRows,
    DateTimeOffset ProcessedUtc);

public sealed record ImportRejectDto(
    int RowNumber,
    string InterfaceTypeCode,
    string SourceSystemCode,
    string? SourceMessageId,
    string Reason,
    string RawData);

public sealed record DetailedImportBatchResultDto(
    ImportBatchResultDto Result,
    IReadOnlyList<ImportRejectDto> Rejects,
    string RejectReportCsv,
    int CreatedRows = 0,
    int UpdatedRows = 0);

public sealed record FhirBedAvailabilityImportRequestDto(
    string SourceSystemCode,
    string? SourceMessageId,
    string BundleJson);

public sealed record StartStreamingIngestionRequestDto(
    string? StreamDirectory,
    int? PollIntervalSeconds,
    bool? EnableFileWatcher,
    string? DefaultSourceSystemCode);

public sealed record StreamingIngestionStatusDto(
    bool IsRunning,
    string StreamDirectory,
    int PollIntervalSeconds,
    bool FileWatcherEnabled,
    string DefaultSourceSystemCode,
    int PendingFileCount,
    int ProcessedFileCount,
    int FailedFileCount,
    DateTimeOffset? LastStartedUtc,
    DateTimeOffset? LastScanUtc,
    string? LastError);

/*
File: IPOC_WEB.Server/Infrastructure/Lookups/LookupContracts.cs
Blueprint Name: LookupContracts

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2026-06-23
Updated: 2026-07-13

Description:
Lookup and reference-data contracts used by runtime UX dropdowns and admin management APIs.

Features:
  - Generic code-set value DTOs.
  - Create/update request models for self-service lookup administration.
  - Location lookup DTO for active organization/region-aware location rendering.

Security & Compliance:
  - Constrains payloads to lookup metadata only.
  - Supports soft-delete and audited lookup administration workflows.
*/

namespace IPOC_WEB.Server.Infrastructure.Lookups;

public sealed record LookupValueDto(
    int CodeValueId,
    string CodeSetName,
    string Code,
    string DisplayName,
    int SortOrder,
    bool IsActive,
    string? Description);

public sealed record CreateLookupValueRequestDto(
    string Code,
    string DisplayName,
    int? SortOrder,
    string? Description);

public sealed record UpdateLookupValueRequestDto(
    string DisplayName,
    int? SortOrder,
    string? Description,
    bool? IsActive);

public sealed record LocationLookupDto(
    long LocationId,
    string LocationName,
    long? OrganizationId,
    string? OrganizationName,
    int? RegionId,
    string? RegionName,
    decimal? Latitude,
    decimal? Longitude,
    string? CityName,
    string? StateCode,
    string? PostalCode,
    string DisplayText);

public sealed record AdminLocationDto(
    long LocationId,
    string LocationName,
    string? OrganizationName,
    string? RegionName,
    decimal? Latitude,
    decimal? Longitude,
    string? CityName,
    string? StateCode,
    string? PostalCode,
    bool IsActive,
    string DisplayText);

public sealed record AdminLocationSnapshotDto(
    long LocationId,
    string LocationName,
    string? OrganizationName,
    string? RegionName,
    string? CityName,
    string? StateCode,
    string? PostalCode,
    bool IsActive,
    int ResourceInventoryRowCount,
    decimal TotalQuantityAvailable,
    decimal TotalQuantityCommitted,
    decimal TotalQuantityOutOfService,
    DateTimeOffset? LastResourceReportedUtc,
    int BedSnapshotRowCount,
    int TotalBedsAvailable,
    int TotalBedsOccupied,
    int TotalBedsUnavailable,
    DateTimeOffset? LastBedReportedUtc);

public sealed record UpdateLocationActiveStatusRequestDto(
    bool IsActive);

public sealed record UpdateAdminLocationGeoRequestDto(
    decimal? Latitude,
    decimal? Longitude,
    string? CityName,
    string? StateCode,
    string? PostalCode);

public sealed record AdminLocationGeocodeRequestDto(
    string? CityName,
    string? StateCode,
    string? PostalCode,
    string? LocationName,
    string? AddressLine1);

public sealed record AdminLocationGeocodeResultDto(
    decimal Latitude,
    decimal Longitude,
    string NormalizedQuery,
    string GeocodeSource,
    decimal ConfidenceScore);

public sealed record AdminIcsPositionDto(
    int IcsPositionId,
    string PositionCode,
    string PositionName,
    string IcsSection,
    string? ParentPositionCode,
    int SortOrder,
    bool IsNimsStandard,
    string? Description);

public sealed record CreateAdminIcsPositionRequestDto(
    string PositionCode,
    string PositionName,
    string IcsSection,
    string? ParentPositionCode,
    int? SortOrder,
    bool? IsNimsStandard,
    string? Description);

public sealed record UpdateAdminIcsPositionRequestDto(
    string PositionName,
    string IcsSection,
    string? ParentPositionCode,
    int? SortOrder,
    bool? IsNimsStandard,
    string? Description);

public sealed record UpdateAdminIcsPositionStandardStatusRequestDto(
    bool IsNimsStandard);

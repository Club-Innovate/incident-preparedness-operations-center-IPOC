/*
 * User-related DTOs for ipoc Web platform.
 *
 * SECURITY CONSIDERATIONS:
 * - ActiveUserDto intentionally excludes sensitive fields (EntraObjectId, UserPrincipalName, phone, MFA timestamps)
 * - DisplayName and EmailAddress are safe for incident command assignment UX
 * - OrganizationName provides operational context without exposing org structure details
 *
 * ARCHITECTURE:
 * - Follows workspace direct SQL service pattern
 * - DTOs map cleanly from sec.AppUser query projections
 * - Designed for reusable user picker components across incident, resource, and objective modules
 */

namespace IPOC_WEB.Server.Infrastructure.Users;

/// <summary>
/// Lightweight DTO for active user selection in command assignments, task ownership, etc.
/// </summary>
/// <param name="UserId">Internal user identifier</param>
/// <param name="DisplayName">User's full display name</param>
/// <param name="EmailAddress">User's email address (may be null for external users)</param>
/// <param name="OrganizationName">Primary organization affiliation (optional context)</param>
public sealed record ActiveUserDto(
    long UserId,
    string DisplayName,
    string? EmailAddress,
    string? OrganizationName
);

public sealed record ActiveContactDto(
    long ContactId,
    string DisplayName
);

public sealed record AdminUserDto(
    long UserId,
    string DisplayName,
    string? EmailAddress,
    bool IsActive,
    IReadOnlyList<string> ActiveRoleCodes);

public sealed record AdminRoleDto(
    int RoleId,
    string RoleCode,
    string RoleName,
    string? Description,
    bool IsPrivileged);

public sealed record AdminUserRoleAssignmentDto(
    long UserRoleAssignmentId,
    int RoleId,
    string RoleCode,
    string RoleName,
    DateTimeOffset EffectiveFromUtc,
    DateTimeOffset? EffectiveToUtc,
    bool IsActive);

public sealed record UpsertAdminUserRolesRequestDto(
    IReadOnlyList<string> RoleCodes,
    string? AssignmentReason);

public sealed record CreateAdminUserRequestDto(
    string DisplayName,
    string? EmailAddress,
    bool IsActive,
    string? UserPrincipalName,
    Guid? EntraObjectId);

public sealed record UpdateUserActiveStatusRequestDto(
    bool IsActive);

public sealed record UserSessionAdminDto(
    long UserSessionId,
    long UserId,
    string DisplayName,
    string? EmailAddress,
    string? EntraSessionId,
    DateTimeOffset LoginUtc,
    DateTimeOffset? LastSeenUtc,
    DateTimeOffset? LogoutUtc,
    bool MfaSatisfied,
    string? ClientIpAddress,
    string SessionStatus,
    string? TerminationReason,
    DateTimeOffset? TerminatedUtc,
    bool IsImpersonationActive,
    long? ImpersonatingAdminUserId,
    string? ImpersonatingAdminDisplayName,
    DateTimeOffset? ImpersonationStartedUtc);

public sealed record TerminateUserSessionRequestDto(
    string? TerminationReason);

public sealed record StartUserImpersonationRequestDto(
    long TargetUserId,
    string? Reason);

public sealed record StopUserImpersonationRequestDto(
    string? Reason);

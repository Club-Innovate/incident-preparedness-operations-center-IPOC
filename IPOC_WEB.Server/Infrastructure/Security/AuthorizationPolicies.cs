/*
File: IPOC_WEB.Server/Infrastructure/Security/AuthorizationPolicies.cs
Blueprint Name: Authorization

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-12

Description:
Central authorization policy definitions for API capability boundaries.

Features:
  - Named policies for incidents, resources, and EEI workflows.
  - Consistent policy registration in one location.

Security & Compliance:
  - Provides policy guardrails for least-privilege endpoint access.
  - Enables auditable, explicit authorization boundaries.
*/

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace IPOC_WEB.Server.Infrastructure.Security;

public static class AuthorizationPolicies
{
    public const string IncidentViewer = "IncidentViewer";
    public const string IncidentCommander = "IncidentCommander";
    public const string ResourceReporter = "ResourceReporter";
    public const string EeiResponder = "EeiResponder";
    public const string LookupViewer = "LookupViewer";
    public const string LookupContributor = "LookupContributor";
    public const string LookupAdmin = "LookupAdmin";
    public const string DataOpsAdmin = "DataOpsAdmin";

    private static readonly string[] LookupViewerRoleCodes =
    [
        "SYSTEM_ADMIN",
        "KDHE_ADMIN",
        "INCIDENT_COMMANDER",
        "LOOKUP_CONTRIBUTOR",
        "LOOKUP_ADMIN"
    ];

    private static readonly string[] LookupContributorRoleCodes =
    [
        "SYSTEM_ADMIN",
        "KDHE_ADMIN",
        "INCIDENT_COMMANDER",
        "LOOKUP_CONTRIBUTOR",
        "LOOKUP_ADMIN"
    ];

    private static readonly string[] LookupAdminRoleCodes =
    [
        "SYSTEM_ADMIN",
        "KDHE_ADMIN",
        "LOOKUP_ADMIN"
    ];

    private static readonly string[] DataOpsAdminRoleCodes =
    [
        "SYSTEM_ADMIN",
        "KDHE_ADMIN",
        "DATA_OPS_ADMIN"
    ];

    public static void Configure(AuthorizationOptions options)
    {
        options.AddPolicy(IncidentViewer, policy => policy.RequireAuthenticatedUser());
        options.AddPolicy(IncidentCommander, policy => policy.RequireAuthenticatedUser());
        options.AddPolicy(ResourceReporter, policy => policy.RequireAuthenticatedUser());
        options.AddPolicy(EeiResponder, policy => policy.RequireAuthenticatedUser());

        options.AddPolicy(LookupViewer, policy => policy
            .RequireAuthenticatedUser()
            .RequireAssertion(context =>
                HasRoleCode(context.User, LookupViewerRoleCodes)
                || HasScopeOrPermission(context.User, "lookup.view")
                || HasScopeOrPermission(context.User, "access_as_user")));

        options.AddPolicy(LookupContributor, policy => policy
            .RequireAuthenticatedUser()
            .RequireAssertion(context =>
                HasRoleCode(context.User, LookupContributorRoleCodes)
                || HasScopeOrPermission(context.User, "lookup.contribute")
                || HasScopeOrPermission(context.User, "access_as_user")));

        options.AddPolicy(LookupAdmin, policy => policy
            .RequireAuthenticatedUser()
            .RequireAssertion(context =>
                HasRoleCode(context.User, LookupAdminRoleCodes)
                || HasScopeOrPermission(context.User, "lookup.admin")
                || HasScopeOrPermission(context.User, "access_as_user")));

        options.AddPolicy(DataOpsAdmin, policy => policy
            .RequireAuthenticatedUser()
            .RequireAssertion(context =>
                HasRoleCode(context.User, DataOpsAdminRoleCodes)
                || HasScopeOrPermission(context.User, "data.ops.admin")
                || HasScopeOrPermission(context.User, "access_as_user")));
    }

    private static bool HasRoleCode(ClaimsPrincipal user, IReadOnlyCollection<string> roleCodes)
    {
        var roles = user.FindAll("roles")
            .Concat(user.FindAll("role"))
            .Concat(user.FindAll(ClaimTypes.Role))
            .Select(claim => claim.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return roleCodes.Any(roles.Contains);
    }

    private static bool HasScopeOrPermission(ClaimsPrincipal user, string value)
    {
        var scopeClaim = user.FindFirst("scp")?.Value
            ?? user.FindFirst("http://schemas.microsoft.com/identity/claims/scope")?.Value
            ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(scopeClaim))
        {
            var scopes = scopeClaim.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (scopes.Contains(value, StringComparer.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return user.FindAll("permissions")
            .Select(claim => claim.Value)
            .Any(permission => string.Equals(permission, value, StringComparison.OrdinalIgnoreCase));
    }
}

/*
 * User query service for ipoc Web platform.
 *
 * ARCHITECTURE:
 * - Follows workspace direct SQL pattern (no EF dependencies)
 * - Uses parameterized queries and ADO.NET for data access
 * - Designed for lookup/reference scenarios (user pickers, assignment dropdowns, audit trails)
 *
 * SECURITY:
 * - Returns only active users (IsActive = 1) to prevent assignment of deactivated accounts
 * - Intentionally excludes sensitive Entra/authentication fields from projections
 * - Caller authorization is enforced at the endpoint level (this service trusts its caller)
 */

using System.Data;
using System.Globalization;
using IPOC_WEB.Server.Infrastructure.Configuration;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace IPOC_WEB.Server.Infrastructure.Users;

/// <summary>
/// Query service for user-related data access operations.
/// </summary>
public interface IUserQueryService
{
    /// <summary>
    /// Retrieves all active users suitable for assignment to incident command positions, tasks, objectives, etc.
    /// </summary>
    /// <returns>List of active users with basic profile and organization context</returns>
    Task<IReadOnlyList<ActiveUserDto>> GetActiveUsersAsync();
    Task<IReadOnlyList<ActiveContactDto>> GetActiveContactsAsync();
    Task<(IReadOnlyList<AdminUserDto> Items, int TotalCount)> GetAdminUsersAsync(string? search, bool? isActive, int pageNumber, int pageSize, CancellationToken cancellationToken);
    Task<long> CreateAdminUserAsync(CreateAdminUserRequestDto request, CancellationToken cancellationToken);
    Task<long?> FindAdminUserIdByEmailOrUpnAsync(string? emailAddress, string? userPrincipalName, CancellationToken cancellationToken);
    Task<bool> UpdateAdminUserAsync(long userId, CreateAdminUserRequestDto request, CancellationToken cancellationToken);
    Task<bool> UpdateUserActiveStatusAsync(long userId, bool isActive, CancellationToken cancellationToken);
    Task<IReadOnlyList<AdminRoleDto>> GetActiveAdminRolesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<AdminUserRoleAssignmentDto>> GetAdminUserRoleAssignmentsAsync(long userId, CancellationToken cancellationToken);
    Task<bool> UpsertAdminUserRoleAssignmentsAsync(long userId, IReadOnlyList<string> roleCodes, long? assignedByUserId, string? assignmentReason, CancellationToken cancellationToken);
    Task<(IReadOnlyList<UserSessionAdminDto> Items, int TotalCount)> GetActiveUserSessionsAsync(string? search, int pageNumber, int pageSize, CancellationToken cancellationToken);
    Task<bool> TerminateUserSessionAsync(long userSessionId, long? terminatedByUserId, string? terminationReason, CancellationToken cancellationToken);
    Task<bool> StartUserSessionImpersonationAsync(long userSessionId, long adminUserId, long targetUserId, string? reason, CancellationToken cancellationToken);
    Task<bool> StopUserSessionImpersonationAsync(long userSessionId, long adminUserId, string? reason, CancellationToken cancellationToken);
}

/// <summary>
/// Implementation of user query service using direct SQL access pattern.
/// </summary>
public sealed class UserQueryService : IUserQueryService
{
    private readonly string _connectionString;

    public UserQueryService(IConfiguration configuration, IOptions<SqlDataOptions> sqlOptions)
    {
        var configuredConnectionName = sqlOptions.Value.ConnectionStringName;
        _connectionString = configuration.GetConnectionString(configuredConnectionName)
            ?? throw new InvalidOperationException($"Connection string '{configuredConnectionName}' is not configured.");
    }

    public async Task<IReadOnlyList<ActiveUserDto>> GetActiveUsersAsync()
    {
        const string sql = """
            SELECT
                u.UserId,
                u.DisplayName,
                u.EmailAddress
            FROM sec.AppUser u
            WHERE u.IsActive = 1
            ORDER BY u.DisplayName;
            """;

        var users = new List<ActiveUserDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            users.Add(new ActiveUserDto(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                null  // OrganizationName - schema doesn't have user-org linkage yet
            ));
        }

        return users;
    }

    public async Task<IReadOnlyList<ActiveContactDto>> GetActiveContactsAsync()
    {
        const string sql = """
            SELECT
                c.ContactId,
                c.DisplayName
            FROM org.Contact c
            ORDER BY c.DisplayName;
            """;

        var contacts = new List<ActiveContactDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            contacts.Add(new ActiveContactDto(
                reader.GetInt64(0),
                reader.GetString(1)));
        }

        return contacts;
    }

    public async Task<(IReadOnlyList<AdminUserDto> Items, int TotalCount)> GetAdminUsersAsync(string? search, bool? isActive, int pageNumber, int pageSize, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT COUNT(1)
            FROM sec.AppUser u
            WHERE (@search IS NULL OR u.DisplayName LIKE @search OR u.EmailAddress LIKE @search)
              AND (@isActive IS NULL OR u.IsActive = @isActive);

            SELECT
                u.UserId,
                u.DisplayName,
                u.EmailAddress,
                u.IsActive,
                ActiveRoles = ISNULL(
                    (
                        SELECT STRING_AGG(r.RoleCode, ',')
                        FROM sec.UserRoleAssignment ura
                        INNER JOIN sec.Role r ON r.RoleId = ura.RoleId
                        WHERE ura.UserId = u.UserId
                          AND (ura.EffectiveToUtc IS NULL OR ura.EffectiveToUtc > SYSUTCDATETIME())
                    ),
                    '')
            FROM sec.AppUser u
            WHERE (@search IS NULL OR u.DisplayName LIKE @search OR u.EmailAddress LIKE @search)
              AND (@isActive IS NULL OR u.IsActive = @isActive)
            ORDER BY u.DisplayName
            OFFSET @offset ROWS
            FETCH NEXT @pageSize ROWS ONLY;
            """;

        var users = new List<AdminUserDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        var normalizedSearch = string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%";
        var normalizedPageNumber = Math.Max(1, pageNumber);
        var normalizedPageSize = Math.Max(1, pageSize);
        var offset = (normalizedPageNumber - 1) * normalizedPageSize;
        command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, 200) { Value = (object?)normalizedSearch ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@isActive", SqlDbType.Bit) { Value = (object?)isActive ?? DBNull.Value });
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
            users.Add(new AdminUserDto(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.GetBoolean(3),
                (reader.IsDBNull(4) ? string.Empty : reader.GetString(4))
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray()
            ));
        }

        return (users, totalCount);
    }

    public async Task<long> CreateAdminUserAsync(CreateAdminUserRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO sec.AppUser
            (
                EntraObjectId,
                UserPrincipalName,
                DisplayName,
                EmailAddress,
                IsActive,
                IsExternalUser,
                LastSuccessfulLoginUtc,
                LastMfaSatisfiedUtc
            )
            OUTPUT INSERTED.UserId
            VALUES
            (
                @entraObjectId,
                @userPrincipalName,
                @displayName,
                @emailAddress,
                @isActive,
                0,
                NULL,
                NULL
            );
            """;

        var normalizedDisplayName = request.DisplayName.Trim();
        var normalizedEmail = string.IsNullOrWhiteSpace(request.EmailAddress)
            ? null
            : request.EmailAddress.Trim().ToLowerInvariant();
        var normalizedUserPrincipalName = string.IsNullOrWhiteSpace(request.UserPrincipalName)
            ? null
            : request.UserPrincipalName.Trim().ToLowerInvariant();
        var userPrincipalName = normalizedUserPrincipalName ?? normalizedEmail ?? $"local.user.{Guid.NewGuid():N}@ipoc.local";
        var entraObjectId = request.EntraObjectId ?? Guid.NewGuid();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@entraObjectId", SqlDbType.UniqueIdentifier) { Value = entraObjectId });
        command.Parameters.Add(new SqlParameter("@userPrincipalName", SqlDbType.NVarChar, 320) { Value = userPrincipalName });
        command.Parameters.Add(new SqlParameter("@displayName", SqlDbType.NVarChar, 200) { Value = normalizedDisplayName });
        command.Parameters.Add(new SqlParameter("@emailAddress", SqlDbType.NVarChar, 320) { Value = (object?)normalizedEmail ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@isActive", SqlDbType.Bit) { Value = request.IsActive });

        var scalar = await command.ExecuteScalarAsync(cancellationToken);
        if (scalar is null)
        {
            throw new InvalidOperationException("User creation did not return a user id.");
        }

        return Convert.ToInt64(scalar, CultureInfo.InvariantCulture);
    }

    public async Task<long?> FindAdminUserIdByEmailOrUpnAsync(string? emailAddress, string? userPrincipalName, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP (1)
                u.UserId
            FROM sec.AppUser u
            WHERE (@emailAddress IS NOT NULL AND u.EmailAddress = @emailAddress)
               OR (@userPrincipalName IS NOT NULL AND u.UserPrincipalName = @userPrincipalName)
            ORDER BY u.UserId;
            """;

        var normalizedEmail = string.IsNullOrWhiteSpace(emailAddress)
            ? null
            : emailAddress.Trim().ToLowerInvariant();
        var normalizedUserPrincipalName = string.IsNullOrWhiteSpace(userPrincipalName)
            ? null
            : userPrincipalName.Trim().ToLowerInvariant();

        if (normalizedEmail is null && normalizedUserPrincipalName is null)
        {
            return null;
        }

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@emailAddress", SqlDbType.NVarChar, 320) { Value = (object?)normalizedEmail ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@userPrincipalName", SqlDbType.NVarChar, 320) { Value = (object?)normalizedUserPrincipalName ?? DBNull.Value });

        var scalar = await command.ExecuteScalarAsync(cancellationToken);
        return scalar is null ? null : Convert.ToInt64(scalar, CultureInfo.InvariantCulture);
    }

    public async Task<bool> UpdateAdminUserAsync(long userId, CreateAdminUserRequestDto request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE sec.AppUser
            SET
                DisplayName = @displayName,
                EmailAddress = @emailAddress,
                UserPrincipalName = @userPrincipalName,
                EntraObjectId = @entraObjectId,
                IsActive = @isActive
            WHERE UserId = @userId;
            """;

        var normalizedDisplayName = request.DisplayName.Trim();
        var normalizedEmail = string.IsNullOrWhiteSpace(request.EmailAddress)
            ? null
            : request.EmailAddress.Trim().ToLowerInvariant();
        var normalizedUserPrincipalName = string.IsNullOrWhiteSpace(request.UserPrincipalName)
            ? normalizedEmail
            : request.UserPrincipalName.Trim().ToLowerInvariant();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@displayName", SqlDbType.NVarChar, 200) { Value = normalizedDisplayName });
        command.Parameters.Add(new SqlParameter("@emailAddress", SqlDbType.NVarChar, 320) { Value = (object?)normalizedEmail ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@userPrincipalName", SqlDbType.NVarChar, 320) { Value = (object?)normalizedUserPrincipalName ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@entraObjectId", SqlDbType.UniqueIdentifier) { Value = (object?)request.EntraObjectId ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@isActive", SqlDbType.Bit) { Value = request.IsActive });

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    public async Task<bool> UpdateUserActiveStatusAsync(long userId, bool isActive, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE sec.AppUser
            SET IsActive = @isActive
            WHERE UserId = @userId;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
        command.Parameters.Add(new SqlParameter("@isActive", SqlDbType.Bit) { Value = isActive });

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    public async Task<IReadOnlyList<AdminRoleDto>> GetActiveAdminRolesAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                r.RoleId,
                r.RoleCode,
                r.RoleName,
                r.Description,
                r.IsPrivileged
            FROM sec.Role r
            WHERE r.IsActive = 1
            ORDER BY r.IsPrivileged DESC, r.RoleName;
            """;

        var roles = new List<AdminRoleDto>();

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
            roles.Add(new AdminRoleDto(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.GetBoolean(4)));
        }

        return roles;
    }

    public async Task<IReadOnlyList<AdminUserRoleAssignmentDto>> GetAdminUserRoleAssignmentsAsync(long userId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                ura.UserRoleAssignmentId,
                r.RoleId,
                r.RoleCode,
                r.RoleName,
                ura.EffectiveFromUtc,
                ura.EffectiveToUtc,
                CASE WHEN ura.EffectiveToUtc IS NULL OR ura.EffectiveToUtc > SYSUTCDATETIME() THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS IsActive
            FROM sec.UserRoleAssignment ura
            INNER JOIN sec.Role r ON r.RoleId = ura.RoleId
            WHERE ura.UserId = @userId
            ORDER BY IsActive DESC, r.RoleName;
            """;

        var assignments = new List<AdminUserRoleAssignmentDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            assignments.Add(new AdminUserRoleAssignmentDto(
                reader.GetInt64(0),
                reader.GetInt32(1),
                reader.GetString(2),
                reader.GetString(3),
                ReadDateTimeOffset(reader, 4),
                ReadNullableDateTimeOffset(reader, 5),
                reader.GetBoolean(6)));
        }

        return assignments;
    }

    public async Task<bool> UpsertAdminUserRoleAssignmentsAsync(long userId, IReadOnlyList<string> roleCodes, long? assignedByUserId, string? assignmentReason, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            const string closeExistingSql = """
                UPDATE sec.UserRoleAssignment
                SET EffectiveToUtc = SYSUTCDATETIME()
                WHERE UserId = @userId
                  AND (EffectiveToUtc IS NULL OR EffectiveToUtc > SYSUTCDATETIME());
                """;

            await using (var closeCommand = new SqlCommand(closeExistingSql, connection, (SqlTransaction)transaction))
            {
                closeCommand.CommandType = CommandType.Text;
                closeCommand.CommandTimeout = 30;
                closeCommand.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
                await closeCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            var normalizedRoleCodes = roleCodes
                .Where(code => !string.IsNullOrWhiteSpace(code))
                .Select(code => code.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            if (normalizedRoleCodes.Length > 0)
            {
                const string insertSql = """
                    INSERT INTO sec.UserRoleAssignment
                    (
                        UserId,
                        RoleId,
                        AssignedByUserId,
                        AssignmentReason,
                        EffectiveFromUtc,
                        EffectiveToUtc
                    )
                    SELECT
                        @userId,
                        r.RoleId,
                        @assignedByUserId,
                        @assignmentReason,
                        SYSUTCDATETIME(),
                        NULL
                    FROM sec.Role r
                    WHERE r.RoleCode = @roleCode
                      AND r.IsActive = 1;
                    """;

                foreach (var roleCode in normalizedRoleCodes)
                {
                    await using var insertCommand = new SqlCommand(insertSql, connection, (SqlTransaction)transaction)
                    {
                        CommandType = CommandType.Text,
                        CommandTimeout = 30,
                    };

                    insertCommand.Parameters.Add(new SqlParameter("@userId", SqlDbType.BigInt) { Value = userId });
                    insertCommand.Parameters.Add(new SqlParameter("@assignedByUserId", SqlDbType.BigInt) { Value = (object?)assignedByUserId ?? DBNull.Value });
                    insertCommand.Parameters.Add(new SqlParameter("@assignmentReason", SqlDbType.NVarChar, 500) { Value = string.IsNullOrWhiteSpace(assignmentReason) ? DBNull.Value : assignmentReason.Trim() });
                    insertCommand.Parameters.Add(new SqlParameter("@roleCode", SqlDbType.NVarChar, 80) { Value = roleCode });

                    await insertCommand.ExecuteNonQueryAsync(cancellationToken);
                }
            }

            await transaction.CommitAsync(cancellationToken);
            return true;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<(IReadOnlyList<UserSessionAdminDto> Items, int TotalCount)> GetActiveUserSessionsAsync(string? search, int pageNumber, int pageSize, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT COUNT(1)
            FROM sec.UserSession s
            INNER JOIN sec.AppUser u ON u.UserId = s.UserId
            WHERE s.SessionStatus = 'Active'
              AND (@search IS NULL OR u.DisplayName LIKE @search OR u.EmailAddress LIKE @search OR s.ClientIpAddress LIKE @search);

            SELECT
                s.UserSessionId,
                s.UserId,
                u.DisplayName,
                u.EmailAddress,
                s.EntraSessionId,
                s.LoginUtc,
                s.LastSeenUtc,
                s.LogoutUtc,
                s.MfaSatisfied,
                s.ClientIpAddress,
                s.SessionStatus,
                s.TerminationReason,
                s.LogoutUtc AS TerminatedUtc,
                CASE WHEN imp.ImpersonationSessionId IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS IsImpersonationActive,
                imp.AdminUserId,
                adminUser.DisplayName AS ImpersonatingAdminDisplayName,
                imp.StartedUtc AS ImpersonationStartedUtc
            FROM sec.UserSession s
            INNER JOIN sec.AppUser u ON u.UserId = s.UserId
            OUTER APPLY (
                SELECT TOP(1)
                    ais.ImpersonationSessionId,
                    ais.AdminUserId,
                    ais.StartedUtc
                FROM sec.AdminImpersonationSession ais
                WHERE ais.TargetUserId = s.UserId
                  AND ais.EndedUtc IS NULL
                ORDER BY ais.StartedUtc DESC, ais.ImpersonationSessionId DESC
            ) imp
            LEFT JOIN sec.AppUser adminUser ON adminUser.UserId = imp.AdminUserId
            WHERE s.SessionStatus = 'Active'
              AND (@search IS NULL OR u.DisplayName LIKE @search OR u.EmailAddress LIKE @search OR s.ClientIpAddress LIKE @search)
            ORDER BY s.LoginUtc DESC
            OFFSET @offset ROWS
            FETCH NEXT @pageSize ROWS ONLY;
            """;

        var sessions = new List<UserSessionAdminDto>();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        var normalizedSearch = string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%";
        var normalizedPageNumber = Math.Max(1, pageNumber);
        var normalizedPageSize = Math.Max(1, pageSize);
        var offset = (normalizedPageNumber - 1) * normalizedPageSize;
        command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, 200) { Value = (object?)normalizedSearch ?? DBNull.Value });
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
            sessions.Add(new UserSessionAdminDto(
                reader.GetInt64(0),
                reader.GetInt64(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                ReadDateTimeOffset(reader, 5),
                ReadNullableDateTimeOffset(reader, 6),
                ReadNullableDateTimeOffset(reader, 7),
                reader.GetBoolean(8),
                reader.IsDBNull(9) ? null : reader.GetString(9),
                reader.GetString(10),
                reader.IsDBNull(11) ? null : reader.GetString(11),
                ReadNullableDateTimeOffset(reader, 12),
                reader.GetBoolean(13),
                reader.IsDBNull(14) ? null : reader.GetInt64(14),
                reader.IsDBNull(15) ? null : reader.GetString(15),
                ReadNullableDateTimeOffset(reader, 16)
            ));
        }

        return (sessions, totalCount);
    }

    public async Task<bool> TerminateUserSessionAsync(long userSessionId, long? terminatedByUserId, string? terminationReason, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE sec.UserSession
            SET SessionStatus = 'Terminated',
                LogoutUtc = COALESCE(LogoutUtc, SYSUTCDATETIME()),
                TerminatedByUserId = @terminatedByUserId,
                TerminationReason = COALESCE(@terminationReason, TerminationReason)
            WHERE UserSessionId = @userSessionId
              AND SessionStatus = 'Active';
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userSessionId", SqlDbType.BigInt) { Value = userSessionId });
        command.Parameters.Add(new SqlParameter("@terminatedByUserId", SqlDbType.BigInt) { Value = (object?)terminatedByUserId ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@terminationReason", SqlDbType.NVarChar, 500) { Value = (object?)terminationReason ?? DBNull.Value });

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    public async Task<bool> StartUserSessionImpersonationAsync(long userSessionId, long adminUserId, long targetUserId, string? reason, CancellationToken cancellationToken)
    {
        const string sql = """
            IF NOT EXISTS (
                SELECT 1
                FROM sec.UserSession s
                WHERE s.UserSessionId = @userSessionId
                  AND s.UserId = @targetUserId
                  AND s.SessionStatus = 'Active')
            BEGIN
                SELECT CAST(0 AS bit);
                RETURN;
            END;

            IF NOT EXISTS (
                SELECT 1
                FROM sec.AppUser u
                WHERE u.UserId = @targetUserId
                  AND u.IsActive = 1)
            BEGIN
                SELECT CAST(0 AS bit);
                RETURN;
            END;

            IF EXISTS (
                SELECT 1
                FROM sec.AdminImpersonationSession ais
                WHERE ais.TargetUserId = @targetUserId
                  AND ais.EndedUtc IS NULL)
            BEGIN
                SELECT CAST(0 AS bit);
                RETURN;
            END;

            INSERT INTO sec.AdminImpersonationSession (
                AdminUserId,
                TargetUserId,
                Justification,
                ApprovedByUserId)
            VALUES (
                @adminUserId,
                @targetUserId,
                @reason,
                @adminUserId);

            SELECT CAST(1 AS bit);
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        var normalizedReason = string.IsNullOrWhiteSpace(reason)
            ? "Admin impersonation initiated from session administration controls."
            : reason.Trim();

        command.Parameters.Add(new SqlParameter("@userSessionId", SqlDbType.BigInt) { Value = userSessionId });
        command.Parameters.Add(new SqlParameter("@adminUserId", SqlDbType.BigInt) { Value = adminUserId });
        command.Parameters.Add(new SqlParameter("@targetUserId", SqlDbType.BigInt) { Value = targetUserId });
        command.Parameters.Add(new SqlParameter("@reason", SqlDbType.NVarChar, 1000) { Value = normalizedReason });

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is bool succeeded && succeeded;
    }

    public async Task<bool> StopUserSessionImpersonationAsync(long userSessionId, long adminUserId, string? reason, CancellationToken cancellationToken)
    {
        const string sql = """
            DECLARE @targetUserId bigint;

            SELECT @targetUserId = s.UserId
            FROM sec.UserSession s
            WHERE s.UserSessionId = @userSessionId
              AND s.SessionStatus = 'Active';

            IF @targetUserId IS NULL
            BEGIN
                SELECT CAST(0 AS bit);
                RETURN;
            END;

            UPDATE ais
            SET ais.EndedUtc = COALESCE(ais.EndedUtc, SYSUTCDATETIME()),
                ais.Justification = CASE
                    WHEN @reason IS NULL OR LEN(@reason) = 0 THEN ais.Justification
                    ELSE CONCAT(ais.Justification, CHAR(10), '[END] ', @reason)
                END
            FROM sec.AdminImpersonationSession ais
            WHERE ais.TargetUserId = @targetUserId
              AND ais.AdminUserId = @adminUserId
              AND ais.EndedUtc IS NULL;

            IF @@ROWCOUNT = 0
            BEGIN
                SELECT CAST(0 AS bit);
                RETURN;
            END;

            SELECT CAST(1 AS bit);
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 30,
        };

        command.Parameters.Add(new SqlParameter("@userSessionId", SqlDbType.BigInt) { Value = userSessionId });
        command.Parameters.Add(new SqlParameter("@adminUserId", SqlDbType.BigInt) { Value = adminUserId });
        command.Parameters.Add(new SqlParameter("@reason", SqlDbType.NVarChar, 1000) { Value = string.IsNullOrWhiteSpace(reason) ? DBNull.Value : reason.Trim() });

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is bool succeeded && succeeded;
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
}

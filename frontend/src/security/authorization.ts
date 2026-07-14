type NavigationModuleAuthorizationRule = {
  alignedBackendPolicies: string[];
  allowedRoles: string[];
  allowedScopes: string[];
};

const normalizeRoles = (roles: string[]) => new Set(roles.map((role) => role.trim().toUpperCase()));
const normalizeScopes = (scopes: string[]) => new Set(scopes.map((scope) => scope.trim().toLowerCase()));

const hasAnyRole = (roles: Set<string>, expectedRoles: string[]) => expectedRoles.some((role) => roles.has(role));
const hasAnyScope = (scopes: Set<string>, expectedScopes: string[]) => expectedScopes.some((scope) => scopes.has(scope));

export const navigationModuleAuthorizationRules = {
  logistics: {
    alignedBackendPolicies: ['AuthorizationPolicies.ResourceReporter', 'AuthorizationPolicies.IncidentCommander'],
    allowedRoles: ['SYSTEM_ADMIN', 'KDHE_ADMIN', 'INCIDENT_COMMANDER', 'RESOURCE_REPORTER'],
    allowedScopes: ['access_as_user', 'resource.report'],
  },
  finance: {
    alignedBackendPolicies: ['AuthorizationPolicies.LookupAdmin', 'AuthorizationPolicies.IncidentCommander'],
    allowedRoles: ['SYSTEM_ADMIN', 'KDHE_ADMIN', 'INCIDENT_COMMANDER', 'LOOKUP_ADMIN'],
    allowedScopes: ['access_as_user', 'lookup.admin'],
  },
  afterAction: {
    alignedBackendPolicies: ['AuthorizationPolicies.LookupAdmin', 'AuthorizationPolicies.IncidentCommander'],
    allowedRoles: ['SYSTEM_ADMIN', 'KDHE_ADMIN', 'INCIDENT_COMMANDER', 'LOOKUP_ADMIN'],
    allowedScopes: ['access_as_user', 'lookup.admin'],
  },
} satisfies Record<'logistics' | 'finance' | 'afterAction', NavigationModuleAuthorizationRule>;

function hasNavigationModuleAccess(
  isAuthenticated: boolean,
  authRoles: string[],
  authScopes: string[],
  rule: NavigationModuleAuthorizationRule,
): boolean {
  if (!isAuthenticated) {
    return false;
  }

  const normalizedRoles = normalizeRoles(authRoles);
  const normalizedScopes = normalizeScopes(authScopes);

  return hasAnyRole(normalizedRoles, rule.allowedRoles) || hasAnyScope(normalizedScopes, rule.allowedScopes);
}

export function canManageLogisticsModuleActions(isAuthenticated: boolean, authRoles: string[], authScopes: string[]): boolean {
  return hasNavigationModuleAccess(isAuthenticated, authRoles, authScopes, navigationModuleAuthorizationRules.logistics);
}

export function canManageFinanceModuleActions(isAuthenticated: boolean, authRoles: string[], authScopes: string[]): boolean {
  return hasNavigationModuleAccess(isAuthenticated, authRoles, authScopes, navigationModuleAuthorizationRules.finance);
}

export function canManageAfterActionModuleActions(isAuthenticated: boolean, authRoles: string[], authScopes: string[]): boolean {
  return hasNavigationModuleAccess(isAuthenticated, authRoles, authScopes, navigationModuleAuthorizationRules.afterAction);
}

import {
  canManageAfterActionModuleActions,
  canManageFinanceModuleActions,
  canManageLogisticsModuleActions,
  navigationModuleAuthorizationRules,
} from './authorization';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runAuthorizationSmoke(): void {
  assert(
    canManageLogisticsModuleActions(true, ['RESOURCE_REPORTER'], []) === true,
    'Expected logistics actions to allow RESOURCE_REPORTER role.',
  );

  assert(
    canManageLogisticsModuleActions(true, [], ['resource.report']) === true,
    'Expected logistics actions to allow resource.report scope.',
  );

  assert(
    canManageLogisticsModuleActions(false, ['RESOURCE_REPORTER'], ['resource.report']) === false,
    'Expected logistics actions to deny unauthenticated users.',
  );

  assert(
    canManageFinanceModuleActions(true, ['LOOKUP_ADMIN'], []) === true,
    'Expected finance actions to allow LOOKUP_ADMIN role.',
  );

  assert(
    canManageFinanceModuleActions(true, [], ['lookup.admin']) === true,
    'Expected finance actions to allow lookup.admin scope.',
  );

  assert(
    canManageFinanceModuleActions(true, ['RESOURCE_REPORTER'], ['resource.report']) === false,
    'Expected finance actions to deny unrelated role/scope.',
  );

  assert(
    canManageAfterActionModuleActions(true, ['INCIDENT_COMMANDER'], []) === true,
    'Expected after-action controls to allow INCIDENT_COMMANDER role.',
  );

  assert(
    canManageAfterActionModuleActions(true, [], ['access_as_user']) === true,
    'Expected after-action controls to allow access_as_user scope.',
  );

  assert(
    canManageAfterActionModuleActions(false, ['INCIDENT_COMMANDER'], ['access_as_user']) === false,
    'Expected after-action controls to deny unauthenticated users.',
  );

  assert(
    navigationModuleAuthorizationRules.logistics.alignedBackendPolicies.includes('AuthorizationPolicies.ResourceReporter'),
    'Expected logistics authorization rule to remain aligned with backend ResourceReporter policy.',
  );

  assert(
    navigationModuleAuthorizationRules.finance.alignedBackendPolicies.includes('AuthorizationPolicies.LookupAdmin'),
    'Expected finance authorization rule to remain aligned with backend LookupAdmin policy.',
  );

  assert(
    navigationModuleAuthorizationRules.afterAction.alignedBackendPolicies.includes('AuthorizationPolicies.LookupAdmin'),
    'Expected after-action authorization rule to remain aligned with backend LookupAdmin policy.',
  );

}

runAuthorizationSmoke();

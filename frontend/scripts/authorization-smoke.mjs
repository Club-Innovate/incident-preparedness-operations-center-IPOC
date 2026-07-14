import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runAuthorizationSmoke() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const authorizationPath = path.resolve(scriptDirectory, '../src/security/authorization.ts');
  const logisticsCardPath = path.resolve(scriptDirectory, '../src/components/navigation/LogisticsCoordinationCard.tsx');
  const financeCardPath = path.resolve(scriptDirectory, '../src/components/navigation/FinanceAdministrationCard.tsx');
  const afterActionCardPath = path.resolve(scriptDirectory, '../src/components/navigation/AfterActionReadinessCard.tsx');
  const appPath = path.resolve(scriptDirectory, '../src/App.tsx');

  const source = fs.readFileSync(authorizationPath, 'utf8');
  const logisticsCardSource = fs.readFileSync(logisticsCardPath, 'utf8');
  const financeCardSource = fs.readFileSync(financeCardPath, 'utf8');
  const afterActionCardSource = fs.readFileSync(afterActionCardPath, 'utf8');
  const appSource = fs.readFileSync(appPath, 'utf8');

  assert(source.includes('export const navigationModuleAuthorizationRules'), 'Expected centralized navigationModuleAuthorizationRules export.');
  assert(source.includes('canManageLogisticsModuleActions'), 'Expected logistics authorization helper.');
  assert(source.includes('canManageFinanceModuleActions'), 'Expected finance authorization helper.');
  assert(source.includes('canManageAfterActionModuleActions'), 'Expected after-action authorization helper.');

  assert(source.includes('AuthorizationPolicies.ResourceReporter'), 'Expected logistics backend policy alignment metadata.');
  assert(source.includes('AuthorizationPolicies.LookupAdmin'), 'Expected lookup admin policy alignment metadata for finance/after-action.');

  assert(source.includes("'RESOURCE_REPORTER'"), 'Expected RESOURCE_REPORTER role in logistics rule.');
  assert(source.includes("'LOOKUP_ADMIN'"), 'Expected LOOKUP_ADMIN role in finance/after-action rules.');
  assert(source.includes("'resource.report'"), 'Expected resource.report scope in logistics rule.');
  assert(source.includes("'lookup.admin'"), 'Expected lookup.admin scope in finance/after-action rules.');

  const programPath = path.resolve(scriptDirectory, '../../IPOC_WEB.Server/Program.cs');
  const programSource = fs.readFileSync(programPath, 'utf8');
  assert(
    programSource.includes('resources.MapGet("/report-presets/{presetScope}"')
      && programSource.includes('.RequireAuthorization(AuthorizationPolicies.ResourceReporter)'),
    'Expected report preset GET endpoint to require ResourceReporter authorization policy.',
  );
  assert(
    programSource.includes('resources.MapPost("/report-presets/{presetScope}"')
      && programSource.includes('.RequireAuthorization(AuthorizationPolicies.ResourceReporter)'),
    'Expected report preset POST endpoint to require ResourceReporter authorization policy.',
  );
  assert(
    programSource.includes('resources.MapDelete("/report-presets/{presetScope}/{userReportPresetId:long}"')
      && programSource.includes('.RequireAuthorization(AuthorizationPolicies.ResourceReporter)'),
    'Expected report preset DELETE endpoint to require ResourceReporter authorization policy.',
  );

  assert(logisticsCardSource.includes('canManageLogisticsModuleActions'), 'Expected logistics card to use centralized authorization helper.');
  assert(logisticsCardSource.includes('require commander/reporter access'), 'Expected logistics card to show unauthorized guidance text.');
  assert(logisticsCardSource.includes('disabled={!canManageLogisticsActions'), 'Expected logistics actions to be disabled by authorization gate.');

  assert(financeCardSource.includes('canManageFinanceModuleActions'), 'Expected finance card to use centralized authorization helper.');
  assert(financeCardSource.includes('require admin/commander access'), 'Expected finance card to show unauthorized guidance text.');
  assert(financeCardSource.includes('disabled={!canManageFinanceActions'), 'Expected finance actions to be disabled by authorization gate.');

  assert(afterActionCardSource.includes('canManageAfterActionModuleActions'), 'Expected after-action card to use centralized authorization helper.');
  assert(afterActionCardSource.includes('require admin/commander access'), 'Expected after-action card to show unauthorized guidance text.');
  assert(afterActionCardSource.includes('disabled={!canManageAfterActionControls'), 'Expected after-action controls to be disabled by authorization gate.');

  assert(appSource.includes('authRoles={authMe?.roles ?? []}'), 'Expected App to pass auth roles into navigation cards.');
  assert(appSource.includes('authScopes={authMe?.scopes ?? []}'), 'Expected App to pass auth scopes into navigation cards.');
}

runAuthorizationSmoke();
console.log('[PASS ] Frontend authorization smoke checks passed.');

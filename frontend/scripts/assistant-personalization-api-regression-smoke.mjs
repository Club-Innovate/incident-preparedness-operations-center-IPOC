import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runAssistantPersonalizationApiRegressionSmoke() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const apiPath = path.resolve(scriptDirectory, '../src/api.ts');
  const assistantDockPath = path.resolve(scriptDirectory, '../src/components/agent/AssistantDock.tsx');
  const serverProgramPath = path.resolve(scriptDirectory, '../../IPOC_WEB.Server/Program.cs');

  const apiSource = fs.readFileSync(apiPath, 'utf8');
  const assistantDockSource = fs.readFileSync(assistantDockPath, 'utf8');
  const serverProgramSource = fs.readFileSync(serverProgramPath, 'utf8');

  assert(
    apiSource.includes("fetchApi('/api/v1/agent/personalization'"),
    'Expected frontend API client to post personalization updates to /api/v1/agent/personalization.',
  );
  assert(
    apiSource.includes('if (response.status === 409)'),
    'Expected agent personalization API client to surface stale-write conflict handling for 409 responses.',
  );
  assert(
    apiSource.includes("name: 'AgentPersonalizationConflictError'"),
    'Expected agent personalization API client to emit typed conflict error for stale personalization writes.',
  );
  assert(
    apiSource.includes("fetchApi('/api/v1/agent/personalization/policy'"),
    'Expected frontend API client to interact with personalization policy endpoint.',
  );

  assert(
    assistantDockSource.includes('if (!isAuthenticated || !localStateHydrated || !serverStateHydrated) {'),
    'Expected hydration-gated persistence guard to block early remote overwrites before local/server hydration.',
  );
  assert(
    assistantDockSource.includes('expectedUpdatedUtc: personalizationUpdatedUtcRef.current ?? undefined,'),
    'Expected AssistantDock to send expectedUpdatedUtc concurrency token with personalization saves.',
  );
  assert(
    assistantDockSource.includes('AgentPersonalizationConflictError'),
    'Expected AssistantDock to explicitly handle stale-write conflict responses.',
  );
  assert(
    assistantDockSource.includes('shouldMarkLocalPreferencesPresent') === false || assistantDockSource.includes('ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY'),
    'Expected AssistantDock to maintain explicit local personalization marker behavior for merge-order correctness.',
  );

  assert(
    serverProgramSource.includes('const string AgentPersonalizationScope = "agent-assistant-personalization";'),
    'Expected backend personalization scope constant for persisted agent personalization.',
  );
  assert(
    serverProgramSource.includes('agent.MapPost("/personalization", async (AgentPersonalizationRequestDto request'),
    'Expected backend personalization write endpoint mapping.',
  );
  assert(
    serverProgramSource.includes('ExpectedUpdatedUtc'),
    'Expected backend personalization contract to include expectedUpdatedUtc concurrency token.',
  );
  assert(
    serverProgramSource.includes('return Results.Conflict(new'),
    'Expected backend personalization endpoint to reject stale writes with conflict response.',
  );
  assert(
    serverProgramSource.includes('UpsertUserReportPresetAsync(userId.Value, AgentPersonalizationScope, upsertRequest, cancellationToken)'),
    'Expected backend personalization endpoint to persist via user report preset upsert.',
  );
  assert(
    serverProgramSource.includes('resources.MapGet("/report-presets/{presetScope}"'),
    'Expected backend report preset read endpoint for personalization retrieval.',
  );
  assert(
    serverProgramSource.includes('resources.MapPost("/report-presets/{presetScope}"'),
    'Expected backend report preset write endpoint for personalization persistence.',
  );
}

runAssistantPersonalizationApiRegressionSmoke();
console.log('[PASS ] Assistant personalization API regression smoke checks passed.');

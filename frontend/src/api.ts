/*
File: frontend/src/api.ts
Blueprint Name: FrontendApiClient

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-14

Description:
Typed frontend API client for weather, readiness, incident, resource, bed, and auth diagnostics endpoints.

Features:
  - Centralized fetch wrapper with bearer-token attachment.
  - Typed request/response helpers for operational workflows.
  - Consistent error messages for UI handling.

Security & Compliance:
  - Sends authorization headers only when token acquisition succeeds.
  - Avoids logging or exposing token values in client code paths.
*/

import { getAccessToken } from './authToken';

const LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
const lookupCache = new Map<string, { expiresAtUtcMs: number; value: unknown }>();
const INCIDENT_CACHE_TTL_MS = 20 * 1000;
const incidentReadCache = new Map<string, { expiresAtUtcMs: number; value: unknown }>();
const incidentInFlightRequests = new Map<string, Promise<unknown>>();
const API_TIMING_DEBUG_LOCAL_KEY = 'ipoc.api.timing.debug';

export class ApiValidationError extends Error {
  validationErrors: Record<string, string[]>;

  constructor(message: string, validationErrors: Record<string, string[]>) {
    super(message);
    this.name = 'ApiValidationError';
    this.validationErrors = validationErrors;
  }
}

function isApiTimingDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(API_TIMING_DEBUG_LOCAL_KEY) === 'true';
}

function readIncidentCacheValue<T>(key: string): T | null {
  const cached = incidentReadCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAtUtcMs) {
    incidentReadCache.delete(key);
    return null;
  }

  return cached.value as T;
}

function writeIncidentCacheValue<T>(key: string, value: T): void {
  incidentReadCache.set(key, {
    value,
    expiresAtUtcMs: Date.now() + INCIDENT_CACHE_TTL_MS,
  });
}

function invalidateIncidentCache(prefix: string): void {
  const keys = Array.from(incidentReadCache.keys());
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      incidentReadCache.delete(key);
    }
  }
}

async function readIncidentWithCache<T>(cacheKey: string, loader: () => Promise<T>): Promise<T> {
  const cached = readIncidentCacheValue<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const inFlight = incidentInFlightRequests.get(cacheKey) as Promise<T> | undefined;
  if (inFlight) {
    return inFlight;
  }

  const request = loader()
    .then((value) => {
      writeIncidentCacheValue(cacheKey, value);
      return value;
    })
    .finally(() => {
      incidentInFlightRequests.delete(cacheKey);
    });

  incidentInFlightRequests.set(cacheKey, request);
  return request;
}

export async function approveIncidentOperationalPeriod(
  incidentId: number,
  operationalPeriodId: number,
): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/operational-periods/${operationalPeriodId}/approve`, {
    method: 'POST',
  });

  if (!response.ok && response.status === 400) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid operational period approval request.', validationErrors);
    }
  }

  if (!response.ok) {
    throw new Error(`Unable to approve operational period (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:operational-periods`);
}

export async function reopenIncidentOperationalPeriod(
  incidentId: number,
  operationalPeriodId: number,
): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/operational-periods/${operationalPeriodId}/reopen`, {
    method: 'POST',
  });

  if (!response.ok && response.status === 400) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid operational period reopen request.', validationErrors);
    }
  }

  if (!response.ok) {
    throw new Error(`Unable to reopen operational period (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:operational-periods`);
}

function getLookupCacheValue<T>(key: string): T | null {
  const cached = lookupCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAtUtcMs) {
    lookupCache.delete(key);
    return null;
  }

  return cached.value as T;
}

async function tryReadValidationErrors(response: Response): Promise<Record<string, string[]> | null> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('json')) {
    return null;
  }

  try {
    const payload = await response.json() as { errors?: Record<string, string[]> };
    if (!payload.errors || typeof payload.errors !== 'object') {
      return null;
    }

    return payload.errors;
  } catch {
    return null;
  }
}

function tryGetRetryAfterMs(response: Response): number | null {
  const retryAfterHeader = response.headers.get('Retry-After');
  if (!retryAfterHeader) {
    return null;
  }

  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(0, seconds * 1000);
  }

  const dateUtcMs = Date.parse(retryAfterHeader);
  if (!Number.isNaN(dateUtcMs)) {
    return Math.max(0, dateUtcMs - Date.now());
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function delayWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return delay(ms);
  }

  if (signal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', handleAbort);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

async function fetchApiWith429Backoff(input: string, init?: RequestInit, requireAuth = true, maxRetries = 2, signal?: AbortSignal): Promise<Response> {
  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    const requestInit: RequestInit = signal ? { ...(init ?? {}), signal } : (init ?? {});
    const response = await fetchApi(input, requestInit, requireAuth);
    if (response.status !== 429 || attempt >= maxRetries) {
      return response;
    }

    const retryAfterMs = tryGetRetryAfterMs(response);
    const backoffMs = retryAfterMs ?? ((attempt + 1) * 750 + Math.floor(Math.random() * 250));
    await delayWithSignal(backoffMs, signal);
    attempt += 1;
  }
}

function setLookupCacheValue<T>(key: string, value: T): void {
  lookupCache.set(key, {
    value,
    expiresAtUtcMs: Date.now() + LOOKUP_CACHE_TTL_MS,
  });
}

function invalidateLookupCache(prefix: string): void {
  const keys = Array.from(lookupCache.keys());
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      lookupCache.delete(key);
    }
  }
}
import type {
  AdminIcsPosition,
  AdminIcsPositionListQuery,
  AdminListQuery,
  AdminLocation,
  AdminLocationSnapshot,
  AdminSessionListQuery,
  AdminUserSession,
  AdminUser,
  ActiveUser,
  ActiveContact,
  AddBedAvailabilityRequest,
  AuthMeResponse,
  AuditEventListItem,
  AuditEventListQuery,
  AuthTokenDebugResponse,
  BedAvailabilityItem,
  CreateIncidentRequest,
  CreateIncidentTaskRequest,
  CreateIncidentTimelineEventRequest,
  CreateIncidentCommunicationRequest,
  CreateCommunicationDispatchRequest,
  CreateIncidentResourceRequest,
  CreateAdminIcsPositionRequest,
  CreateIncidentOperationalPeriodRequest,
  CreateIncidentObjectiveRequest,
  CreateLookupValueRequest,
  GenerateSituationReportRequest,
  FhirBedImportResult,
  FhirBedAvailabilityAdapterContract,
  Ics201Data,
  Ics202Data,
  Ics203Data,
  Ics204Data,
  Ics205Data,
  Ics209Data,
  Ics214Data,
  Ics215Data,
  IncidentIapPacket,
  IcsPosition,
  IncidentCommandAssignment,
  DashboardSummary,
  DetailedImportBatchResult,
  IncidentDetail,
  IncidentSummary,
  IncidentTask,
  IncidentTimelineEvent,
  StartStreamingIngestionRequest,
  SyntheticDataPreview,
  SyntheticDataResetResult,
  StreamingIngestionStatus,
  StreamingUploadResult,
  IncidentCommunication,
  IncidentCommunicationLifecycleSummary,
  CommunicationDispatchResult,
  ExternalProviderHealth,
  ExternalProviderHealthFederationSummary,
  ExternalProviderHealthHistory,
  ExternalProviderHealthStorageRotateResult,
  ExternalProviderHealthStorageStatus,
  ExternalProviderHealthTrends,
  CreateAdminUserRequest,
  AdminRole,
  AdminUserRoleAssignment,
  UpsertAdminUserRolesRequest,
  IncidentResourceRequest,
  IncidentResourceLifecycleSummary,
  IncidentResourceLifecycleEvidencePackage,
  IncidentOperationalPeriod,
  IncidentObjective,
  LocationLookupValue,
  LookupValue,
  PagedResult,
  ResourceInventoryItem,
  ResourceRegionalRollupItem,
  NotificationRecipient,
  SituationReport,
  SystemReadiness,
  UserReportPreset,
  UpdateIncidentRequest,
  UpdateIncidentTaskStatusRequest,
  UpdateIncidentTaskAssignmentRequest,
  UpdateIncidentCommunicationRequest,
  UpdateRecipientDeliveryStatusRequest,
  UpdateIncidentResourceRequest,
  UpdateIncidentOperationalPeriodRequest,
  UpdateIncidentObjectiveRequest,
  UpdateAdminIcsPositionRequest,
  UpdateLookupValueRequest,
  UpdateResourceInventoryRequest,
  UpsertIncidentCommandAssignmentRequest,
  UpsertUserReportPresetRequest,
  AcknowledgeRecipientRequest,
  EscalateNotificationRequest,
  EscalationResult,
  WeatherForecast,
  AgentChatCompletionRequest,
  AgentChatCompletionResponse,
  AgentPredictiveDemandSupplyResponse,
  AgentConversationSession,
  AgentPersonalizationRequest,
  AgentPersonalizationSaveResult,
  AgentAnalyticsEventRequest,
  AgentConfigHealth,
  AgentConnectivityHealth,
  AgentPersonalizationPolicy,
  AgentPersonalizationPolicyAuditItem,
  AgentPersonalizationPolicyState,
  AdminLocationGeocodeRequest,
  AdminLocationGeocodeResult,
  AdminCacheModeState,
  CopLiveOverlayFeed,
  CopLiveOverlayExternalReadiness,
  CopLiveOverlayContractDocument,
  IncidentAfterActionEvidencePackage,
  IncidentIapGovernanceEvidencePackage,
  WeatherForecastQuery,
  UpdateAdminLocationGeoRequest,
} from './types';
import type { CreateUiAlertRequest, UiAlert } from './notifications/types';

async function fetchApi(input: string, init?: RequestInit, requireAuth = true): Promise<Response> {
  const timingDebug = isApiTimingDebugEnabled();
  const startedAt = timingDebug ? performance.now() : 0;
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  const allowDevelopmentAnonymous = import.meta.env.DEV;

  if (requireAuth && !token && !allowDevelopmentAnonymous) {
    throw new Error('Authentication required. Sign in to continue.');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(input, {
      ...init,
      headers,
    });

    if (timingDebug) {
      const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
      console.debug(`[API] ${init?.method ?? 'GET'} ${input} -> ${response.status} (${elapsedMs}ms)`);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    console.error('API request failed before receiving a response.', {
      endpoint: input,
      method: init?.method ?? 'GET',
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'No error message available.',
    });

    throw new Error('Network request failed. Please retry.');
  }
}

export async function getAdminRoles(): Promise<AdminRole[]> {
  const response = await fetchApi('/api/v1/admin/roles');

  if (!response.ok) {
    throw new Error(`Unable to load admin roles (${response.status}).`);
  }

  return response.json() as Promise<AdminRole[]>;
}

export async function getAdminUserRoles(userId: number): Promise<AdminUserRoleAssignment[]> {
  const response = await fetchApi(`/api/v1/admin/users/${userId}/roles`);

  if (!response.ok) {
    throw new Error(`Unable to load user roles (${response.status}).`);
  }

  return response.json() as Promise<AdminUserRoleAssignment[]>;
}

export async function upsertAdminUserRoles(
  userId: number,
  request: UpsertAdminUserRolesRequest,
): Promise<{ userId: number; roleCodes: string[] }> {
  const response = await fetchApi(`/api/v1/admin/users/${userId}/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to update user roles (${response.status}).`);
  }

  return response.json() as Promise<{ userId: number; roleCodes: string[] }>;
}

export async function getIncidentResourceLifecycleSummary(incidentId: number): Promise<IncidentResourceLifecycleSummary> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/resources/lifecycle-summary`);

  if (!response.ok) {
    throw new Error(`Unable to load incident resource lifecycle summary (${response.status}).`);
  }

  return response.json() as Promise<IncidentResourceLifecycleSummary>;
}

export async function exportIncidentResourceEvidenceCsv(
  incidentId: number,
  statusCode?: string,
): Promise<Blob> {
  const queryParams = new URLSearchParams();
  if (statusCode && statusCode.trim().length > 0 && statusCode !== 'All') {
    queryParams.set('statusCode', statusCode.trim());
  }

  const queryString = queryParams.toString();
  const endpoint = queryString.length > 0
    ? `/api/v1/incidents/${incidentId}/resources/evidence/export/csv?${queryString}`
    : `/api/v1/incidents/${incidentId}/resources/evidence/export/csv`;

  const response = await fetchApi(endpoint);

  if (!response.ok) {
    throw new Error(`Unable to export resource evidence CSV (${response.status}).`);
  }

  return response.blob();
}

export async function exportAdminLocationSnapshotJson(locationId: number): Promise<Blob> {
  const response = await fetchApi(`/api/v1/admin/locations/${locationId}/snapshot/export/json`);

  if (!response.ok) {
    throw new Error(`Unable to export facility snapshot JSON (${response.status}).`);
  }

  return response.blob();
}

export async function getIncidentResourceLifecycleEvidencePackage(
  incidentId: number,
): Promise<IncidentResourceLifecycleEvidencePackage> {
  const endpoint = `/api/v1/incidents/${incidentId}/resources/lifecycle-evidence/export/json`;
  const response = await fetchApi(endpoint);

  if (!response.ok) {
    throw new Error(`Unable to load incident resource lifecycle evidence (${response.status}).`);
  }

  return await response.json() as IncidentResourceLifecycleEvidencePackage;
}

export async function getIncidentAfterActionEvidencePackage(
  incidentId: number,
): Promise<IncidentAfterActionEvidencePackage> {
  const endpoint = `/api/v1/incidents/${incidentId}/after-action/evidence/export/json`;
  const response = await fetchApi(endpoint);

  if (!response.ok) {
    throw new Error(`Unable to load incident after-action evidence package (${response.status}).`);
  }

  return await response.json() as IncidentAfterActionEvidencePackage;
}

export async function exportExternalProviderHealthExecutivePacketZip(
  provider?: string,
  rollingDays = 30,
  windowHours = 24 * 30,
  bucketMinutes = 60,
): Promise<Blob> {
  const params = new URLSearchParams();
  if (provider?.trim()) {
    params.set('provider', provider.trim());
  }

  params.set('rollingDays', String(Math.min(180, Math.max(1, Math.round(rollingDays)))));
  params.set('windowHours', String(Math.min(24 * 90, Math.max(1, Math.round(windowHours)))));
  params.set('bucketMinutes', String(Math.min(24 * 60, Math.max(5, Math.round(bucketMinutes)))));

  const response = await fetchApi(`/api/v1/reports/external-provider-health/executive-packet/export/zip?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Unable to export external provider executive packet ZIP (${response.status}).`);
  }

  return response.blob();
}

export async function getIncidentIapGovernanceEvidencePackage(incidentId: number, signal?: AbortSignal): Promise<IncidentIapGovernanceEvidencePackage> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/iap-governance/evidence/json`, undefined, true, 2, signal);

  if (!response.ok && response.status === 400) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid incident IAP governance evidence request.', validationErrors);
    }
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load incident IAP governance evidence (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load incident IAP governance evidence (${response.status}).`);
  }

  return response.json() as Promise<IncidentIapGovernanceEvidencePackage>;
}

export async function exportIncidentResourceLifecycleEvidenceJson(
  incidentId: number,
): Promise<Blob> {
  const endpoint = `/api/v1/incidents/${incidentId}/resources/lifecycle-evidence/export/json`;
  const response = await fetchApi(endpoint);

  if (!response.ok) {
    throw new Error(`Unable to export incident resource lifecycle evidence (${response.status}).`);
  }

  return response.blob();
}

export async function exportIncidentAfterActionEvidenceJson(
  incidentId: number,
): Promise<Blob> {
  const endpoint = `/api/v1/incidents/${incidentId}/after-action/evidence/export/json`;
  const response = await fetchApi(endpoint);

  if (!response.ok) {
    throw new Error(`Unable to export incident after-action evidence (${response.status}).`);
  }

  return response.blob();
}

export async function getIncidentCommunicationLifecycleSummary(
  incidentId: number,
  fromUtc?: string,
  toUtc?: string,
): Promise<IncidentCommunicationLifecycleSummary> {
  const queryParams = new URLSearchParams();
  if (fromUtc && fromUtc.trim().length > 0) {
    queryParams.set('fromUtc', fromUtc);
  }

  if (toUtc && toUtc.trim().length > 0) {
    queryParams.set('toUtc', toUtc);
  }

  const queryString = queryParams.toString();
  const endpoint = queryString.length > 0
    ? `/api/v1/incidents/${incidentId}/communications/lifecycle-summary?${queryString}`
    : `/api/v1/incidents/${incidentId}/communications/lifecycle-summary`;

  const response = await fetchApi(endpoint);
  if (!response.ok) {
    throw new Error(`Unable to load communication lifecycle summary (${response.status}).`);
  }

  return await response.json() as IncidentCommunicationLifecycleSummary;
}

export async function exportIncidentCommunicationEvidenceCsv(
  incidentId: number,
  fromUtc?: string,
  toUtc?: string,
): Promise<Blob> {
  const queryParams = new URLSearchParams();
  if (fromUtc && fromUtc.trim().length > 0) {
    queryParams.set('fromUtc', fromUtc);
  }

  if (toUtc && toUtc.trim().length > 0) {
    queryParams.set('toUtc', toUtc);
  }

  const queryString = queryParams.toString();
  const endpoint = queryString.length > 0
    ? `/api/v1/incidents/${incidentId}/communications/evidence/export/csv?${queryString}`
    : `/api/v1/incidents/${incidentId}/communications/evidence/export/csv`;

  const response = await fetchApi(endpoint);
  if (!response.ok) {
    throw new Error(`Unable to export communication evidence CSV (${response.status}).`);
  }

  return response.blob();
}

export async function getUserReportPresets(presetScope: string): Promise<UserReportPreset[]> {
  const response = await fetchApi(`/api/v1/resources/report-presets/${encodeURIComponent(presetScope)}`);

  if (!response.ok) {
    throw new Error(`Unable to load report presets (${response.status}).`);
  }

  return response.json() as Promise<UserReportPreset[]>;
}

export async function upsertUserReportPreset(presetScope: string, request: UpsertUserReportPresetRequest): Promise<number> {
  const response = await fetchApi(`/api/v1/resources/report-presets/${encodeURIComponent(presetScope)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to save report preset (${response.status}).`);
  }

  const payload = await response.json() as { userReportPresetId: number };
  return payload.userReportPresetId;
}

export async function deleteUserReportPreset(presetScope: string, userReportPresetId: number): Promise<void> {
  const response = await fetchApi(`/api/v1/resources/report-presets/${encodeURIComponent(presetScope)}/${userReportPresetId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Unable to delete report preset (${response.status}).`);
  }
}

export async function getAgentConversationHistory(): Promise<AgentConversationSession[]> {
  const response = await fetchApi('/api/v1/agent/history');

  if (!response.ok) {
    throw new Error(`Unable to load agent conversation history (${response.status}).`);
  }

  return response.json() as Promise<AgentConversationSession[]>;
}

export async function completeAgentChat(request: AgentChatCompletionRequest): Promise<AgentChatCompletionResponse> {
  const response = await fetchApi('/api/v1/agent/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to complete agent chat request (${response.status}).`);
  }

  return response.json() as Promise<AgentChatCompletionResponse>;
}

export async function getAgentPredictiveDemandSupply(
  incidentId: number,
  horizonHours = 24,
): Promise<AgentPredictiveDemandSupplyResponse> {
  const params = new URLSearchParams();
  params.set('incidentId', String(Math.max(1, Math.round(incidentId))));
  params.set('horizonHours', String(Math.min(168, Math.max(6, Math.round(horizonHours)))));

  const response = await fetchApi(`/api/v1/agent/planning/predictive-demand-supply?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Unable to load predictive demand/supply insight (${response.status}).`);
  }

  return response.json() as Promise<AgentPredictiveDemandSupplyResponse>;
}

export async function saveAgentPersonalization(request: AgentPersonalizationRequest): Promise<AgentPersonalizationSaveResult> {
  const sendRequest = (payload: AgentPersonalizationRequest) => fetchApi('/api/v1/agent/personalization', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let response = await sendRequest(request);

  if (response.status === 409) {
    const conflictPayload = await response.json() as { message?: string; currentUpdatedUtc?: string };
    const currentUpdatedUtc = conflictPayload.currentUpdatedUtc?.trim();

    if (currentUpdatedUtc) {
      response = await sendRequest({
        ...request,
        expectedUpdatedUtc: currentUpdatedUtc,
      });
    } else {
      const conflictMessage = conflictPayload.message ?? 'Agent personalization save conflict. Refresh and retry.';
      const conflictError = new Error(conflictMessage);
      Object.assign(conflictError, {
        name: 'AgentPersonalizationConflictError',
        currentUpdatedUtc: conflictPayload.currentUpdatedUtc,
      });
      throw conflictError;
    }
  }

  if (!response.ok) {
    throw new Error(`Unable to save agent personalization (${response.status}).`);
  }

  return response.json() as Promise<AgentPersonalizationSaveResult>;
}

export async function createAgentAnalyticsEvent(request: AgentAnalyticsEventRequest): Promise<void> {
  const response = await fetchApi('/api/v1/agent/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to save agent analytics event (${response.status}).`);
  }
}

export async function getAgentConfigHealth(): Promise<AgentConfigHealth> {
  const response = await fetchApi('/api/v1/agent/config/health');

  if (!response.ok) {
    throw new Error(`Unable to load agent configuration health (${response.status}).`);
  }

  return response.json() as Promise<AgentConfigHealth>;
}

export async function getAgentConnectivityHealth(): Promise<AgentConnectivityHealth> {
  const response = await fetchApi('/api/v1/agent/config/connectivity');

  if (!response.ok) {
    throw new Error(`Unable to load agent connectivity health (${response.status}).`);
  }

  return response.json() as Promise<AgentConnectivityHealth>;
}

export async function getAgentPersonalizationPolicy(): Promise<AgentPersonalizationPolicyState> {
  const response = await fetchApi('/api/v1/agent/personalization/policy');

  if (!response.ok) {
    throw new Error(`Unable to load agent personalization policy (${response.status}).`);
  }

  return response.json() as Promise<AgentPersonalizationPolicyState>;
}

export async function saveAgentPersonalizationPolicy(request: AgentPersonalizationPolicy): Promise<void> {
  const response = await fetchApi('/api/v1/agent/personalization/policy', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to save agent personalization policy (${response.status}).`);
  }
}

export async function getAgentPersonalizationPolicyHistory(pageNumber = 1, pageSize = 10): Promise<PagedResult<AgentPersonalizationPolicyAuditItem>> {
  const normalizedPageNumber = Math.max(1, Math.round(pageNumber));
  const normalizedPageSize = Math.min(50, Math.max(1, Math.round(pageSize)));
  const query = new URLSearchParams({
    pageNumber: String(normalizedPageNumber),
    pageSize: String(normalizedPageSize),
  });

  const response = await fetchApi(`/api/v1/agent/personalization/policy/history?${query.toString()}`);

  if (!response.ok) {
    throw new Error(`Unable to load agent personalization policy history (${response.status}).`);
  }

  return response.json() as Promise<PagedResult<AgentPersonalizationPolicyAuditItem>>;
}

export async function getWeatherForecast(query?: WeatherForecastQuery): Promise<WeatherForecast[]> {
  const params = new URLSearchParams();
  if (typeof query?.incidentId === 'number' && Number.isFinite(query.incidentId)) {
    params.set('incidentId', String(query.incidentId));
  }
  if (typeof query?.locationId === 'number' && Number.isFinite(query.locationId)) {
    params.set('locationId', String(query.locationId));
  }
  if (typeof query?.defaultLocationId === 'number' && Number.isFinite(query.defaultLocationId)) {
    params.set('defaultLocationId', String(query.defaultLocationId));
  }
  if (query?.city?.trim()) {
    params.set('city', query.city.trim());
  }
  if (query?.state?.trim()) {
    params.set('state', query.state.trim());
  }
  if (query?.postalCode?.trim()) {
    params.set('postalCode', query.postalCode.trim());
  }
  if (query?.defaultCity?.trim()) {
    params.set('defaultCity', query.defaultCity.trim());
  }
  if (query?.defaultState?.trim()) {
    params.set('defaultState', query.defaultState.trim());
  }
  if (query?.defaultPostalCode?.trim()) {
    params.set('defaultPostalCode', query.defaultPostalCode.trim());
  }

  const queryString = params.toString();
  const response = await fetchApi(`/api/v1/weatherforecast${queryString ? `?${queryString}` : ''}`, undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load weather data (${response.status}).`);
  }

  return response.json() as Promise<WeatherForecast[]>;
}

export async function getCopLiveOverlayFeed(): Promise<CopLiveOverlayFeed> {
  const response = await fetchApi('/api/v1/cop/live-overlay', undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load COP live overlay feed (${response.status}).`);
  }

  return response.json() as Promise<CopLiveOverlayFeed>;
}

export async function getCopLiveOverlayContract(): Promise<CopLiveOverlayContractDocument> {
  const response = await fetchApi('/api/v1/cop/live-overlay/contract', undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load COP live overlay contract (${response.status}).`);
  }

  return response.json() as Promise<CopLiveOverlayContractDocument>;
}

export async function getCopLiveOverlayExternalReadiness(): Promise<CopLiveOverlayExternalReadiness> {
  const response = await fetchApi('/api/v1/cop/live-overlay/external-readiness', undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load COP live overlay external readiness (${response.status}).`);
  }

  return response.json() as Promise<CopLiveOverlayExternalReadiness>;
}

export async function getSystemReadiness(): Promise<SystemReadiness> {
  const response = await fetchApi('/api/v1/system/readiness', undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load system readiness (${response.status}).`);
  }

  return response.json() as Promise<SystemReadiness>;
}

export async function getAdminCacheMode(): Promise<AdminCacheModeState> {
  const response = await fetchApi('/api/v1/admin/cache/mode');

  if (!response.ok) {
    throw new Error(`Unable to load admin cache mode (${response.status}).`);
  }

  return response.json() as Promise<AdminCacheModeState>;
}

export async function updateAdminCacheMode(cacheUseRedisRequested: boolean): Promise<AdminCacheModeState> {
  const response = await fetchApi('/api/v1/admin/cache/mode', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cacheUseRedisRequested }),
  });

  if (!response.ok) {
    throw new Error(`Unable to save admin cache mode (${response.status}).`);
  }

  return response.json() as Promise<AdminCacheModeState>;
}

export async function getExternalProviderHealth(): Promise<ExternalProviderHealth> {
  const response = await fetchApi('/api/v1/system/external-provider-health', undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load external provider health (${response.status}).`);
  }

  return response.json() as Promise<ExternalProviderHealth>;
}

export async function getExternalProviderHealthHistory(provider?: string, take = 50): Promise<ExternalProviderHealthHistory> {
  const params = new URLSearchParams();
  if (provider?.trim()) {
    params.set('provider', provider.trim());
  }
  params.set('take', String(Math.min(200, Math.max(1, Math.round(take)))));

  const response = await fetchApi(`/api/v1/system/external-provider-health/history?${params.toString()}`, undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load external provider health history (${response.status}).`);
  }

  return response.json() as Promise<ExternalProviderHealthHistory>;
}

export async function getExternalProviderHealthFederationSummary(windowHours = 24 * 30): Promise<ExternalProviderHealthFederationSummary> {
  const params = new URLSearchParams();
  params.set('windowHours', String(Math.min(24 * 365, Math.max(1, Math.round(windowHours)))));

  const response = await fetchApi(`/api/v1/system/external-provider-health/federation/summary?${params.toString()}`, undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load external provider federation summary (${response.status}).`);
  }

  return response.json() as Promise<ExternalProviderHealthFederationSummary>;
}

export async function getExternalProviderHealthHistoryWarehouse(provider?: string, take = 200): Promise<ExternalProviderHealthHistory> {
  const params = new URLSearchParams();
  if (provider?.trim()) {
    params.set('provider', provider.trim());
  }
  params.set('take', String(Math.min(5000, Math.max(1, Math.round(take)))));

  const response = await fetchApi(`/api/v1/system/external-provider-health/history/warehouse?${params.toString()}`, undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load external provider warehouse history (${response.status}).`);
  }

  return response.json() as Promise<ExternalProviderHealthHistory>;
}

export async function getExternalProviderHealthStorageStatus(): Promise<ExternalProviderHealthStorageStatus> {
  const response = await fetchApi('/api/v1/system/external-provider-health/storage', undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load external provider telemetry storage status (${response.status}).`);
  }

  return response.json() as Promise<ExternalProviderHealthStorageStatus>;
}

export async function getExternalProviderHealthTrends(provider?: string, windowHours = 24, bucketMinutes = 60): Promise<ExternalProviderHealthTrends> {
  const params = new URLSearchParams();
  if (provider?.trim()) {
    params.set('provider', provider.trim());
  }

  params.set('windowHours', String(Math.min(24 * 30, Math.max(1, Math.round(windowHours)))));
  params.set('bucketMinutes', String(Math.min(24 * 60, Math.max(5, Math.round(bucketMinutes)))));

  const response = await fetchApi(`/api/v1/system/external-provider-health/trends?${params.toString()}`, undefined, false);

  if (!response.ok) {
    throw new Error(`Unable to load external provider telemetry trends (${response.status}).`);
  }

  return response.json() as Promise<ExternalProviderHealthTrends>;
}

export async function evaluateExternalProviderHealthAlerts(
  provider?: string,
  windowHours = 24,
  minEventCount = 20,
  failureRateThreshold = 0.25,
): Promise<{
  evaluated: boolean;
  reason?: string;
  retryAfterSeconds?: number;
  createdAlertIds: number[];
}> {
  const params = new URLSearchParams();
  if (provider?.trim()) {
    params.set('provider', provider.trim());
  }

  params.set('windowHours', String(Math.min(24 * 30, Math.max(1, Math.round(windowHours)))));
  params.set('minEventCount', String(Math.min(5000, Math.max(1, Math.round(minEventCount)))));
  params.set('failureRateThreshold', String(Math.min(1, Math.max(0.01, failureRateThreshold))));

  const response = await fetchApi(`/api/v1/system/external-provider-health/alerts/evaluate?${params.toString()}`, {
    method: 'POST',
  }, false);

  if (!response.ok) {
    throw new Error(`Unable to evaluate external provider health alerts (${response.status}).`);
  }

  return response.json() as Promise<{
    evaluated: boolean;
    reason?: string;
    retryAfterSeconds?: number;
    createdAlertIds: number[];
  }>;
}

export async function exportExternalProviderHealthGovernanceCsv(provider?: string, windowHours = 24 * 30, bucketMinutes = 60): Promise<Blob> {
  const params = new URLSearchParams();
  if (provider?.trim()) {
    params.set('provider', provider.trim());
  }

  params.set('windowHours', String(Math.min(24 * 90, Math.max(1, Math.round(windowHours)))));
  params.set('bucketMinutes', String(Math.min(24 * 60, Math.max(5, Math.round(bucketMinutes)))));

  const response = await fetchApi(`/api/v1/reports/external-provider-health/governance/export/csv?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Unable to export external provider governance CSV (${response.status}).`);
  }

  return response.blob();
}

export async function exportExternalProviderHealthScorecardCsv(provider?: string, rollingDays = 30): Promise<Blob> {
  const params = new URLSearchParams();
  if (provider?.trim()) {
    params.set('provider', provider.trim());
  }

  params.set('rollingDays', String(Math.min(180, Math.max(1, Math.round(rollingDays)))));
  const response = await fetchApi(`/api/v1/reports/external-provider-health/scorecards/export/csv?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Unable to export external provider scorecard CSV (${response.status}).`);
  }

  return response.blob();
}

export async function exportExternalProviderHealthScorecardJson(provider?: string, rollingDays = 30): Promise<Blob> {
  const params = new URLSearchParams();
  if (provider?.trim()) {
    params.set('provider', provider.trim());
  }

  params.set('rollingDays', String(Math.min(180, Math.max(1, Math.round(rollingDays)))));
  const response = await fetchApi(`/api/v1/reports/external-provider-health/scorecards/export/json?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Unable to export external provider scorecard JSON (${response.status}).`);
  }

  return response.blob();
}

export async function rotateExternalProviderHealthStorage(): Promise<ExternalProviderHealthStorageRotateResult> {
  const response = await fetchApi('/api/v1/system/external-provider-health/storage/rotate', {
    method: 'POST',
  }, false);

  if (!response.ok) {
    throw new Error(`Unable to rotate external provider telemetry storage (${response.status}).`);
  }

  return response.json() as Promise<ExternalProviderHealthStorageRotateResult>;
}

export async function getIncidents(): Promise<IncidentSummary[]> {
  const response = await fetchApiWith429Backoff('/api/v1/incidents');

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load incidents (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load incidents (${response.status}).`);
  }

  return response.json() as Promise<IncidentSummary[]>;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetchApiWith429Backoff('/api/v1/incidents/dashboard-summary');

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load dashboard summary (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load dashboard summary (${response.status}).`);
  }

  return response.json() as Promise<DashboardSummary>;
}

export async function getIncidentById(incidentId: number): Promise<IncidentDetail> {
  return readIncidentWithCache(`incident:${incidentId}:detail`, async () => {
    const response = await fetchApi(`/api/v1/incidents/${incidentId}`);

    if (!response.ok) {
      throw new Error(`Unable to load incident detail (${response.status}).`);
    }

    return response.json() as Promise<IncidentDetail>;
  });
}

export async function createIncident(request: CreateIncidentRequest): Promise<number> {
  const response = await fetchApi('/api/v1/incidents/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to create incident (${response.status}).`);
  }

  invalidateIncidentCache('incident:');

  const payload = await response.json() as { incidentId: number };
  return payload.incidentId;
}

export async function updateIncident(incidentId: number, request: UpdateIncidentRequest): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to update incident (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:`);
}

export async function getIncidentTasks(incidentId: number): Promise<IncidentTask[]> {
  return readIncidentWithCache(`incident:${incidentId}:tasks`, async () => {
    const response = await fetchApi(`/api/v1/incidents/${incidentId}/tasks`);

    if (!response.ok) {
      throw new Error(`Unable to load incident tasks (${response.status}).`);
    }

    return response.json() as Promise<IncidentTask[]>;
  });
}

export async function createIncidentTask(incidentId: number, request: CreateIncidentTaskRequest): Promise<number> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to create incident task (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:tasks`);

  const payload = await response.json() as { incidentTaskId: number };
  return payload.incidentTaskId;
}

export async function updateIncidentTaskStatus(incidentId: number, incidentTaskId: number, request: UpdateIncidentTaskStatusRequest): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/tasks/${incidentTaskId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to update incident task status (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:tasks`);
}

export async function updateIncidentTaskAssignment(incidentId: number, incidentTaskId: number, request: UpdateIncidentTaskAssignmentRequest): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/tasks/${incidentTaskId}/assignment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to update incident task assignment (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:tasks`);
}

export async function getIncidentTimeline(incidentId: number): Promise<IncidentTimelineEvent[]> {
  return readIncidentWithCache(`incident:${incidentId}:timeline`, async () => {
    const response = await fetchApi(`/api/v1/incidents/${incidentId}/timeline`);

    if (!response.ok) {
      throw new Error(`Unable to load incident timeline (${response.status}).`);
    }

    return response.json() as Promise<IncidentTimelineEvent[]>;
  });
}

export async function createIncidentTimelineEvent(incidentId: number, request: CreateIncidentTimelineEventRequest): Promise<number> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/timeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to create incident timeline event (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:timeline`);

  const payload = await response.json() as { incidentTimelineEventId: number };
  return payload.incidentTimelineEventId;
}

export async function getIncidentCommunications(incidentId: number, signal?: AbortSignal): Promise<IncidentCommunication[]> {
  if (signal) {
    const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/communications`, undefined, true, 2, signal);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Unable to load incident communications (429). Rate limited; please retry in a moment.');
      }
      throw new Error(`Unable to load incident communications (${response.status}).`);
    }

    return response.json() as Promise<IncidentCommunication[]>;
  }

  return readIncidentWithCache(`incident:${incidentId}:communications`, async () => {
    const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/communications`, undefined, true, 2, signal);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Unable to load incident communications (429). Rate limited; please retry in a moment.');
      }
      throw new Error(`Unable to load incident communications (${response.status}).`);
    }

    return response.json() as Promise<IncidentCommunication[]>;
  });
}

export async function createIncidentCommunication(incidentId: number, request: CreateIncidentCommunicationRequest): Promise<number> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/communications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid incident communication create request.', validationErrors);
    }

    throw new Error(`Unable to create incident communication (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:communications`);

  const payload = await response.json() as { incidentCommunicationId: number };
  return payload.incidentCommunicationId;
}

export async function updateIncidentCommunication(incidentId: number, incidentCommunicationId: number, request: UpdateIncidentCommunicationRequest): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/communications/${incidentCommunicationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid incident communication update request.', validationErrors);
    }

    throw new Error(`Unable to update incident communication (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:communications`);
}

export async function getIncidentResourceRequests(incidentId: number, signal?: AbortSignal): Promise<IncidentResourceRequest[]> {
  if (signal) {
    const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/resources`, undefined, true, 2, signal);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Unable to load incident resource requests (429). Rate limited; please retry in a moment.');
      }
      throw new Error(`Unable to load incident resource requests (${response.status}).`);
    }

    return response.json() as Promise<IncidentResourceRequest[]>;
  }

  return readIncidentWithCache(`incident:${incidentId}:resources`, async () => {
    const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/resources`, undefined, true, 2, signal);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Unable to load incident resource requests (429). Rate limited; please retry in a moment.');
      }
      throw new Error(`Unable to load incident resource requests (${response.status}).`);
    }

    return response.json() as Promise<IncidentResourceRequest[]>;
  });
}

export async function createIncidentResourceRequest(incidentId: number, request: CreateIncidentResourceRequest): Promise<number> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid incident resource request create request.', validationErrors);
    }

    throw new Error(`Unable to create incident resource request (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:resources`);

  const payload = await response.json() as { incidentResourceRequestId: number };
  return payload.incidentResourceRequestId;
}

export async function updateIncidentResourceRequest(
  incidentId: number,
  incidentResourceRequestId: number,
  request: UpdateIncidentResourceRequest,
): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/resources/${incidentResourceRequestId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid incident resource request update.', validationErrors);
    }

    throw new Error(`Unable to update incident resource request (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:resources`);
}

export async function getIncidentOperationalPeriods(incidentId: number): Promise<IncidentOperationalPeriod[]> {
  return readIncidentWithCache(`incident:${incidentId}:operational-periods`, async () => {
    const response = await fetchApi(`/api/v1/incidents/${incidentId}/operational-periods`);

    if (!response.ok) {
      throw new Error(`Unable to load incident operational periods (${response.status}).`);
    }

    return response.json() as Promise<IncidentOperationalPeriod[]>;
  });
}

export async function createIncidentOperationalPeriod(incidentId: number, request: CreateIncidentOperationalPeriodRequest): Promise<number> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/operational-periods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    if (response.status === 400) {
      const validationErrors = await tryReadValidationErrors(response);
      if (validationErrors) {
        throw new ApiValidationError('Invalid operational period create request.', validationErrors);
      }
    }

    throw new Error(`Unable to create incident operational period (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:operational-periods`);

  const payload = await response.json() as { operationalPeriodId: number };
  return payload.operationalPeriodId;
}

export async function updateIncidentOperationalPeriod(
  incidentId: number,
  operationalPeriodId: number,
  request: UpdateIncidentOperationalPeriodRequest,
): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/operational-periods/${operationalPeriodId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    if (response.status === 400) {
      const validationErrors = await tryReadValidationErrors(response);
      if (validationErrors) {
        throw new ApiValidationError('Invalid operational period update request.', validationErrors);
      }
    }

    throw new Error(`Unable to update incident operational period (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:operational-periods`);
}

export async function getIncidentObjectives(incidentId: number): Promise<IncidentObjective[]> {
  return readIncidentWithCache(`incident:${incidentId}:objectives`, async () => {
    const response = await fetchApi(`/api/v1/incidents/${incidentId}/objectives`);

    if (!response.ok) {
      throw new Error(`Unable to load incident objectives (${response.status}).`);
    }

    return response.json() as Promise<IncidentObjective[]>;
  });
}

export async function createIncidentObjective(incidentId: number, request: CreateIncidentObjectiveRequest): Promise<number> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/objectives`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to create incident objective (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:objectives`);

  const payload = await response.json() as { incidentObjectiveId: number };
  return payload.incidentObjectiveId;
}

export async function updateIncidentObjective(
  incidentId: number,
  incidentObjectiveId: number,
  request: UpdateIncidentObjectiveRequest,
): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/objectives/${incidentObjectiveId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to update incident objective (${response.status}).`);
  }

  invalidateIncidentCache(`incident:${incidentId}:objectives`);
}

export async function getIcsPositions(forceRefresh = false): Promise<IcsPosition[]> {
  const cacheKey = 'lookup:ics-positions:v2';
  if (forceRefresh) {
    invalidateLookupCache('lookup:ics-positions');
  }

  const cached = getLookupCacheValue<IcsPosition[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  const response = await fetchApi('/api/v1/lookups/ics-positions');

  if (!response.ok) {
    throw new Error(`Unable to load ICS positions (${response.status}).`);
  }

  const positions = await response.json() as IcsPosition[];
  setLookupCacheValue(cacheKey, positions);
  return positions;
}

export async function getActiveUsers(): Promise<ActiveUser[]> {
  const cacheKey = 'lookup:active-users';
  const cached = getLookupCacheValue<ActiveUser[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetchApi('/api/v1/users/active');

  if (!response.ok) {
    throw new Error(`Unable to load active users (${response.status}).`);
  }

  const users = await response.json() as ActiveUser[];
  setLookupCacheValue(cacheKey, users);
  return users;
}

export async function getActiveContacts(): Promise<ActiveContact[]> {
  const cacheKey = 'lookup:active-contacts';
  const cached = getLookupCacheValue<ActiveContact[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetchApi('/api/v1/users/contacts');

  if (!response.ok) {
    throw new Error(`Unable to load active contacts (${response.status}).`);
  }

  const contacts = await response.json() as ActiveContact[];
  setLookupCacheValue(cacheKey, contacts);
  return contacts;
}

export async function getAdminUsers(query?: AdminListQuery): Promise<PagedResult<AdminUser>> {
  const params = new URLSearchParams();
  if (query?.search?.trim()) {
    params.set('search', query.search.trim());
  }
  if (typeof query?.isActive === 'boolean') {
    params.set('isActive', String(query.isActive));
  }
  if (query?.pageNumber) {
    params.set('pageNumber', String(query.pageNumber));
  }
  if (query?.pageSize) {
    params.set('pageSize', String(query.pageSize));
  }

  const queryString = params.toString();
  const response = await fetchApi(`/api/v1/admin/users${queryString ? `?${queryString}` : ''}`);

  if (!response.ok) {
    throw new Error(`Unable to load admin users (${response.status}).`);
  }

  return response.json() as Promise<PagedResult<AdminUser>>;
}

export async function updateAdminUserActiveStatus(userId: number, isActive: boolean): Promise<void> {
  const response = await fetchApi(`/api/v1/admin/users/${userId}/active`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isActive }),
  });

  if (!response.ok) {
    throw new Error(`Unable to update user status (${response.status}).`);
  }
}

export async function createAdminUser(request: CreateAdminUserRequest): Promise<{ userId: number }> {
  const response = await fetchApi('/api/v1/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok && response.status === 400) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid admin user creation request.', validationErrors);
    }
  }

  if (!response.ok) {
    throw new Error(`Unable to create admin user (${response.status}).`);
  }

  return response.json() as Promise<{ userId: number }>;
}

export async function importAdminUsersCsv(file: File, sourceSystemCode: string, sourceMessageId?: string, updateExisting?: boolean): Promise<DetailedImportBatchResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sourceSystemCode', sourceSystemCode);
  if (sourceMessageId && sourceMessageId.trim().length > 0) {
    formData.append('sourceMessageId', sourceMessageId.trim());
  }
  if (typeof updateExisting === 'boolean') {
    formData.append('updateExisting', updateExisting ? 'true' : 'false');
  }

  const response = await fetchApi('/api/v1/admin/users/import/csv', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Unable to import admin users CSV (${response.status}).`);
  }

  return response.json() as Promise<DetailedImportBatchResult>;
}

export async function downloadAdminUsersRejectReportCsv(file: File, sourceSystemCode: string, sourceMessageId?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sourceSystemCode', sourceSystemCode);
  if (sourceMessageId && sourceMessageId.trim().length > 0) {
    formData.append('sourceMessageId', sourceMessageId.trim());
  }

  const response = await fetchApi('/api/v1/admin/users/import/csv/reject-report', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Unable to generate admin user reject report (${response.status}).`);
  }

  return response.text();
}

export async function getAdminLocations(query?: AdminListQuery): Promise<PagedResult<AdminLocation>> {
  const params = new URLSearchParams();
  if (query?.search?.trim()) {
    params.set('search', query.search.trim());
  }
  if (typeof query?.isActive === 'boolean') {
    params.set('isActive', String(query.isActive));
  }
  if (query?.pageNumber) {
    params.set('pageNumber', String(query.pageNumber));
  }
  if (query?.pageSize) {
    params.set('pageSize', String(query.pageSize));
  }

  const queryString = params.toString();
  const response = await fetchApi(`/api/v1/admin/locations${queryString ? `?${queryString}` : ''}`);

  if (!response.ok) {
    throw new Error(`Unable to load admin locations (${response.status}).`);
  }

  return response.json() as Promise<PagedResult<AdminLocation>>;
}

export async function getAdminIcsPositions(query?: AdminIcsPositionListQuery): Promise<PagedResult<AdminIcsPosition>> {
  const params = new URLSearchParams();
  if (query?.search?.trim()) {
    params.set('search', query.search.trim());
  }
  if (typeof query?.isNimsStandard === 'boolean') {
    params.set('isNimsStandard', String(query.isNimsStandard));
  }
  if (query?.pageNumber) {
    params.set('pageNumber', String(query.pageNumber));
  }
  if (query?.pageSize) {
    params.set('pageSize', String(query.pageSize));
  }

  const queryString = params.toString();
  const response = await fetchApi(`/api/v1/admin/ics-positions${queryString ? `?${queryString}` : ''}`);

  if (!response.ok) {
    throw new Error(`Unable to load ICS positions (${response.status}).`);
  }

  return response.json() as Promise<PagedResult<AdminIcsPosition>>;
}

export async function createAdminIcsPosition(request: CreateAdminIcsPositionRequest): Promise<number> {
  const response = await fetchApi('/api/v1/admin/ics-positions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Unable to create ICS position.', validationErrors);
    }

    throw new Error(`Unable to create ICS position (${response.status}).`);
  }

  const payload = await response.json() as { icsPositionId: number };
  invalidateLookupCache('lookup:ics-positions');
  return payload.icsPositionId;
}

export async function updateAdminIcsPosition(icsPositionId: number, request: UpdateAdminIcsPositionRequest): Promise<void> {
  const response = await fetchApi(`/api/v1/admin/ics-positions/${icsPositionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Unable to update ICS position.', validationErrors);
    }

    throw new Error(`Unable to update ICS position (${response.status}).`);
  }

  invalidateLookupCache('lookup:ics-positions');
}

export async function updateAdminIcsPositionNimsStandardStatus(icsPositionId: number, isNimsStandard: boolean): Promise<void> {
  const response = await fetchApi(`/api/v1/admin/ics-positions/${icsPositionId}/nims-standard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isNimsStandard }),
  });

  if (!response.ok) {
    throw new Error(`Unable to update ICS position NIMS status (${response.status}).`);
  }

  invalidateLookupCache('lookup:ics-positions');
}

export async function updateAdminLocationActiveStatus(locationId: number, isActive: boolean): Promise<void> {
  const response = await fetchApi(`/api/v1/admin/locations/${locationId}/active`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isActive }),
  });

  if (!response.ok) {
    throw new Error(`Unable to update location status (${response.status}).`);
  }
}

export async function updateAdminLocationGeo(locationId: number, request: UpdateAdminLocationGeoRequest): Promise<AdminLocation> {
  const response = await fetchApi(`/api/v1/admin/locations/${locationId}/geo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Unable to update location geo metadata.', validationErrors);
    }

    throw new Error(`Unable to update location geo metadata (${response.status}).`);
  }

  return response.json() as Promise<AdminLocation>;
}

export async function geocodeAdminLocation(locationId: number, request: AdminLocationGeocodeRequest): Promise<AdminLocationGeocodeResult> {
  const response = await fetchApi(`/api/v1/admin/locations/${locationId}/geocode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Unable to geocode location metadata.', validationErrors);
    }

    throw new Error(`Unable to geocode location metadata (${response.status}).`);
  }

  return response.json() as Promise<AdminLocationGeocodeResult>;
}

export async function getAdminLocationSnapshot(locationId: number): Promise<AdminLocationSnapshot> {
  const response = await fetchApi(`/api/v1/admin/locations/${locationId}/snapshot`);

  if (!response.ok) {
    throw new Error(`Unable to load facility snapshot (${response.status}).`);
  }

  return response.json() as Promise<AdminLocationSnapshot>;
}

export async function exportAdminLocationSnapshotCsv(locationId: number): Promise<Blob> {
  const response = await fetchApi(`/api/v1/admin/locations/${locationId}/snapshot/export/csv`);

  if (!response.ok) {
    throw new Error(`Unable to export facility snapshot CSV (${response.status}).`);
  }

  return response.blob();
}

export async function getAdminActiveSessions(query?: AdminSessionListQuery): Promise<PagedResult<AdminUserSession>> {
  const params = new URLSearchParams();
  if (query?.search?.trim()) {
    params.set('search', query.search.trim());
  }
  if (query?.pageNumber) {
    params.set('pageNumber', String(query.pageNumber));
  }
  if (query?.pageSize) {
    params.set('pageSize', String(query.pageSize));
  }

  const queryString = params.toString();
  const response = await fetchApi(`/api/v1/admin/sessions${queryString ? `?${queryString}` : ''}`);

  if (!response.ok) {
    throw new Error(`Unable to load active sessions (${response.status}).`);
  }

  return response.json() as Promise<PagedResult<AdminUserSession>>;
}

export async function terminateAdminSession(userSessionId: number, terminationReason?: string): Promise<void> {
  const response = await fetchApi(`/api/v1/admin/sessions/${userSessionId}/terminate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ terminationReason }),
  });

  if (!response.ok) {
    throw new Error(`Unable to terminate session (${response.status}).`);
  }
}

export async function startAdminSessionImpersonation(userSessionId: number, targetUserId: number, reason?: string): Promise<void> {
  const response = await fetchApi(`/api/v1/admin/sessions/${userSessionId}/impersonate/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetUserId, reason }),
  });

  if (!response.ok) {
    throw new Error(`Unable to start impersonation (${response.status}).`);
  }
}

export async function stopAdminSessionImpersonation(userSessionId: number, reason?: string): Promise<void> {
  const response = await fetchApi(`/api/v1/admin/sessions/${userSessionId}/impersonate/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error(`Unable to stop impersonation (${response.status}).`);
  }
}

export async function exportAdminSessionComplianceEvidenceJson(): Promise<Blob> {
  const response = await fetchApi('/api/v1/admin/sessions/compliance-evidence/export/json');

  if (!response.ok) {
    throw new Error(`Unable to export session compliance evidence (${response.status}).`);
  }

  return response.blob();
}

export async function getIncidentCommandAssignments(incidentId: number): Promise<IncidentCommandAssignment[]> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/command-assignments`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Unable to load command assignments (${response.status}).`);
  }

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) {
    if (import.meta.env.DEV) {
      console.warn('[ICS] command-assignments payload was not an array.', { incidentId, payloadType: typeof payload });
    }
    return [];
  }

  const asNumberOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };

  const asStringOrNull = (value: unknown): string | null => {
    if (value === null || value === undefined) {
      return null;
    }

    return typeof value === 'string' ? value : String(value);
  };

  let droppedRowCount = 0;
  const normalized = payload
    .map((item) => {
      if (!item || typeof item !== 'object') {
        droppedRowCount += 1;
        return null;
      }

      const row = item as Record<string, unknown>;
      const incidentCommandAssignmentId = asNumberOrNull(row.incidentCommandAssignmentId ?? row.IncidentCommandAssignmentId);
      const incidentIdValue = asNumberOrNull(row.incidentId ?? row.IncidentId);
      const icsPositionId = asNumberOrNull(row.icsPositionId ?? row.IcsPositionId);
      const assignedUserId = asNumberOrNull(row.assignedUserId ?? row.AssignedUserId);
      const assignedContactId = asNumberOrNull(row.assignedContactId ?? row.AssignedContactId);
      const agencyOrganizationId = asNumberOrNull(row.agencyOrganizationId ?? row.AgencyOrganizationId);

      if (incidentCommandAssignmentId === null || incidentIdValue === null || icsPositionId === null) {
        droppedRowCount += 1;
        return null;
      }

      return {
        incidentCommandAssignmentId,
        incidentId: incidentIdValue,
        icsPositionId,
        positionCode: asStringOrNull(row.positionCode ?? row.PositionCode) ?? '',
        positionName: asStringOrNull(row.positionName ?? row.PositionName) ?? '',
        icsSection: asStringOrNull(row.icsSection ?? row.IcsSection) ?? '',
        assignedUserId,
        assignedUserDisplayName: asStringOrNull(row.assignedUserDisplayName ?? row.AssignedUserDisplayName),
        assignedContactId,
        assignedContactName: asStringOrNull(row.assignedContactName ?? row.AssignedContactName),
        agencyOrganizationId,
        agencyOrganizationName: asStringOrNull(row.agencyOrganizationName ?? row.AgencyOrganizationName),
        assignedFromUtc: asStringOrNull(row.assignedFromUtc ?? row.AssignedFromUtc) ?? new Date(0).toISOString(),
        assignedToUtc: asStringOrNull(row.assignedToUtc ?? row.AssignedToUtc),
        assignmentStatusCode: asStringOrNull(row.assignmentStatusCode ?? row.AssignmentStatusCode) ?? 'Assigned',
        notes: asStringOrNull(row.notes ?? row.Notes),
      } satisfies IncidentCommandAssignment;
    })
    .filter((item): item is IncidentCommandAssignment => item !== null);

  if (import.meta.env.DEV) {
    console.debug('[ICS] command-assignments normalized.', {
      incidentId,
      rawCount: payload.length,
      normalizedCount: normalized.length,
      droppedRowCount,
    });
  }

  return normalized;
}

export async function upsertIncidentCommandAssignment(incidentId: number, request: UpsertIncidentCommandAssignmentRequest): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/command-assignments`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to assign command position (${response.status}).`);
  }
}

export async function removeIncidentCommandAssignment(incidentId: number, icsPositionId: number): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/command-assignments/${icsPositionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Unable to remove command assignment (${response.status}).`);
  }
}

export async function getLookupValues(codeSetName: string): Promise<LookupValue[]> {
  const cacheKey = `lookup:codeset:${codeSetName.toLowerCase()}`;
  const cached = getLookupCacheValue<LookupValue[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetchApi(`/api/v1/lookups/codesets/${encodeURIComponent(codeSetName)}`);

  if (!response.ok) {
    throw new Error(`Unable to load lookup values (${response.status}).`);
  }

  const values = await response.json() as LookupValue[];
  setLookupCacheValue(cacheKey, values);
  return values;
}

export async function searchLookupValues(codeSetName: string, query: string, maxResults = 10): Promise<LookupValue[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0) {
    return [];
  }

  const boundedMax = Math.min(25, Math.max(1, maxResults));
  const response = await fetchApi(
    `/api/v1/lookups/codesets/${encodeURIComponent(codeSetName)}/search?q=${encodeURIComponent(normalizedQuery)}&maxResults=${boundedMax}`,
  );

  if (!response.ok) {
    throw new Error(`Unable to search lookup values (${response.status}).`);
  }

  return await response.json() as LookupValue[];
}

export async function getLocationLookups(): Promise<LocationLookupValue[]> {
  const cacheKey = 'lookup:locations';
  const cached = getLookupCacheValue<LocationLookupValue[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetchApi('/api/v1/lookups/locations');

  if (!response.ok) {
    throw new Error(`Unable to load location lookups (${response.status}).`);
  }

  const values = await response.json() as LocationLookupValue[];
  setLookupCacheValue(cacheKey, values);
  return values;
}

export async function createLookupValue(codeSetName: string, request: CreateLookupValueRequest): Promise<number> {
  const response = await fetchApi(`/api/v1/lookups/codesets/${encodeURIComponent(codeSetName)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to create lookup value (${response.status}).`);
  }

  invalidateLookupCache(`lookup:codeset:${codeSetName.toLowerCase()}`);

  const payload = await response.json() as { codeValueId: number };
  return payload.codeValueId;
}

export async function updateLookupValue(codeSetName: string, codeValueId: number, request: UpdateLookupValueRequest): Promise<void> {
  const response = await fetchApi(`/api/v1/lookups/codesets/${encodeURIComponent(codeSetName)}/${codeValueId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to update lookup value (${response.status}).`);
  }

  invalidateLookupCache(`lookup:codeset:${codeSetName.toLowerCase()}`);
}

export async function activateIncident(incidentId: number): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/activate`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Unable to activate incident (${response.status}).`);
  }
}

export async function closeIncident(incidentId: number): Promise<void> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/close`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Unable to close incident (${response.status}).`);
  }
}

export async function getAuthMe(): Promise<AuthMeResponse> {
  const response = await fetchApi('/api/v1/auth/me');

  if (!response.ok) {
    throw new Error(`Unable to load auth claims (${response.status}).`);
  }

  return response.json() as Promise<AuthMeResponse>;
}

export async function getAuthTokenDebug(): Promise<AuthTokenDebugResponse> {
  const response = await fetchApi('/api/v1/auth/token-debug');

  if (!response.ok) {
    throw new Error(`Unable to load token debug claims (${response.status}).`);
  }

  return response.json() as Promise<AuthTokenDebugResponse>;
}

export async function getAuditEvents(query?: AuditEventListQuery): Promise<PagedResult<AuditEventListItem>> {
  const params = new URLSearchParams();

  if (query?.incidentId && query.incidentId > 0) {
    params.set('incidentId', String(query.incidentId));
  }

  if (query?.eventCategory && query.eventCategory.trim().length > 0) {
    params.set('eventCategory', query.eventCategory.trim());
  }

  if (query?.outcomeCode && query.outcomeCode.trim().length > 0) {
    params.set('outcomeCode', query.outcomeCode.trim());
  }

  if (query?.fromUtc && query.fromUtc.trim().length > 0) {
    params.set('fromUtc', query.fromUtc.trim());
  }

  if (query?.toUtc && query.toUtc.trim().length > 0) {
    params.set('toUtc', query.toUtc.trim());
  }

  if (query?.pageNumber && query.pageNumber > 0) {
    params.set('pageNumber', String(query.pageNumber));
  }

  if (query?.pageSize && query.pageSize > 0) {
    params.set('pageSize', String(query.pageSize));
  }

  const queryString = params.toString();
  const response = await fetchApi(`/api/v1/reports/audit-events${queryString ? `?${queryString}` : ''}`);

  if (!response.ok) {
    throw new Error(`Unable to load audit events (${response.status}).`);
  }

  return response.json() as Promise<PagedResult<AuditEventListItem>>;
}

export async function exportAuditEventsCsv(query?: AuditEventListQuery): Promise<Blob> {
  const params = new URLSearchParams();

  if (query?.incidentId && query.incidentId > 0) {
    params.set('incidentId', String(query.incidentId));
  }

  if (query?.eventCategory && query.eventCategory.trim().length > 0) {
    params.set('eventCategory', query.eventCategory.trim());
  }

  if (query?.outcomeCode && query.outcomeCode.trim().length > 0) {
    params.set('outcomeCode', query.outcomeCode.trim());
  }

  if (query?.fromUtc && query.fromUtc.trim().length > 0) {
    params.set('fromUtc', query.fromUtc.trim());
  }

  if (query?.toUtc && query.toUtc.trim().length > 0) {
    params.set('toUtc', query.toUtc.trim());
  }

  if (query?.pageNumber && query.pageNumber > 0) {
    params.set('pageNumber', String(query.pageNumber));
  }

  if (query?.pageSize && query.pageSize > 0) {
    params.set('pageSize', String(query.pageSize));
  }

  const queryString = params.toString();
  const response = await fetchApi(`/api/v1/reports/audit-events/export/csv${queryString ? `?${queryString}` : ''}`);

  if (!response.ok) {
    throw new Error(`Unable to export audit events CSV (${response.status}).`);
  }

  return response.blob();
}

export async function writeLoginAuditEvent(): Promise<void> {
  const response = await fetchApi('/api/v1/auth/audit/login', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Unable to write login audit event (${response.status}).`);
  }
}

export async function writeLogoutAuditEvent(): Promise<void> {
  const response = await fetchApi('/api/v1/auth/audit/logout', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Unable to write logout audit event (${response.status}).`);
  }
}

export async function getResourceInventory(): Promise<ResourceInventoryItem[]> {
  const response = await fetchApi('/api/v1/resources/inventory');

  if (!response.ok) {
    throw new Error(`Unable to load resource inventory (${response.status}).`);
  }

  return response.json() as Promise<ResourceInventoryItem[]>;
}

export async function getResourceRegionalRollups(regionId?: number | null, regionName?: string): Promise<ResourceRegionalRollupItem[]> {
  const queryParams = new URLSearchParams();
  if (regionId && regionId > 0) {
    queryParams.set('regionId', String(regionId));
  }

  if (regionName && regionName.trim().length > 0) {
    queryParams.set('regionName', regionName.trim());
  }

  const queryString = queryParams.toString();
  const endpoint = queryString.length > 0
    ? `/api/v1/resources/regional-rollups?${queryString}`
    : '/api/v1/resources/regional-rollups';

  const response = await fetchApi(endpoint);

  if (!response.ok) {
    throw new Error(`Unable to load resource regional rollups (${response.status}).`);
  }

  return response.json() as Promise<ResourceRegionalRollupItem[]>;
}

export async function exportResourceRegionalRollupsCsv(regionId?: number | null, regionName?: string): Promise<Blob> {
  const queryParams = new URLSearchParams();
  if (regionId && regionId > 0) {
    queryParams.set('regionId', String(regionId));
  }

  if (regionName && regionName.trim().length > 0) {
    queryParams.set('regionName', regionName.trim());
  }

  const queryString = queryParams.toString();
  const endpoint = queryString.length > 0
    ? `/api/v1/resources/regional-rollups/export/csv?${queryString}`
    : '/api/v1/resources/regional-rollups/export/csv';

  const response = await fetchApi(endpoint);

  if (!response.ok) {
    throw new Error(`Unable to export resource regional rollups CSV (${response.status}).`);
  }

  return response.blob();
}

export async function updateResourceInventory(locationResourceInventoryId: number, request: UpdateResourceInventoryRequest): Promise<void> {
  const response = await fetchApi(`/api/v1/resources/inventory/${locationResourceInventoryId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to update resource inventory (${response.status}).`);
  }
}

export async function getBedAvailability(): Promise<BedAvailabilityItem[]> {
  const response = await fetchApi('/api/v1/beds/availability');

  if (!response.ok) {
    throw new Error(`Unable to load bed availability (${response.status}).`);
  }

  return response.json() as Promise<BedAvailabilityItem[]>;
}

export async function addBedAvailability(locationId: number, request: AddBedAvailabilityRequest): Promise<void> {
  const response = await fetchApi(`/api/v1/beds/availability/${locationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to submit bed availability (${response.status}).`);
  }
}

export async function importResourceInventoryCsv(file: File, sourceSystemCode: string, sourceMessageId?: string): Promise<DetailedImportBatchResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sourceSystemCode', sourceSystemCode);
  if (sourceMessageId && sourceMessageId.trim().length > 0) {
    formData.append('sourceMessageId', sourceMessageId.trim());
  }

  const response = await fetchApi('/api/v1/resources/import/inventory/csv', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Unable to import resource inventory CSV (${response.status}).`);
  }

  return response.json() as Promise<DetailedImportBatchResult>;
}

export async function downloadResourceInventoryRejectReportCsv(file: File, sourceSystemCode: string, sourceMessageId?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sourceSystemCode', sourceSystemCode);
  if (sourceMessageId && sourceMessageId.trim().length > 0) {
    formData.append('sourceMessageId', sourceMessageId.trim());
  }

  const response = await fetchApi('/api/v1/resources/import/inventory/csv/reject-report', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Unable to generate resource reject report (${response.status}).`);
  }

  return response.text();
}

export async function importBedAvailabilityCsv(file: File, sourceSystemCode: string, sourceMessageId?: string): Promise<DetailedImportBatchResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sourceSystemCode', sourceSystemCode);
  if (sourceMessageId && sourceMessageId.trim().length > 0) {
    formData.append('sourceMessageId', sourceMessageId.trim());
  }

  const response = await fetchApi('/api/v1/beds/import/availability/csv', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Unable to import bed availability CSV (${response.status}).`);
  }

  return response.json() as Promise<DetailedImportBatchResult>;
}

export async function downloadBedAvailabilityRejectReportCsv(file: File, sourceSystemCode: string, sourceMessageId?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sourceSystemCode', sourceSystemCode);
  if (sourceMessageId && sourceMessageId.trim().length > 0) {
    formData.append('sourceMessageId', sourceMessageId.trim());
  }

  const response = await fetchApi('/api/v1/beds/import/availability/csv/reject-report', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Unable to generate bed reject report (${response.status}).`);
  }

  return response.text();
}

export async function importFhirBedAvailability(bundleJson: string, sourceSystemCode: string, sourceMessageId?: string): Promise<FhirBedImportResult> {
  const response = await fetchApi('/api/v1/beds/import/availability/fhir', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sourceSystemCode,
      sourceMessageId,
      bundleJson,
    }),
  });

  if (!response.ok) {
    if (response.status === 400) {
      const validationErrors = await tryReadValidationErrors(response);
      if (validationErrors) {
        throw new ApiValidationError('Invalid FHIR bed availability import request.', validationErrors);
      }
    }

    throw new Error(`Unable to import FHIR bed availability (${response.status}).`);
  }

  return response.json() as Promise<FhirBedImportResult>;
}

export async function getFhirBedAvailabilityAdapterContract(): Promise<FhirBedAvailabilityAdapterContract> {
  const response = await fetchApi('/api/v1/beds/import/availability/fhir/adapter-contract');

  if (!response.ok) {
    throw new Error(`Unable to load FHIR adapter contract (${response.status}).`);
  }

  return response.json() as Promise<FhirBedAvailabilityAdapterContract>;
}

export async function getStreamingIngestionStatus(): Promise<StreamingIngestionStatus> {
  const response = await fetchApi('/api/v1/admin/streaming/status');

  if (!response.ok) {
    throw new Error(`Unable to load streaming ingestion status (${response.status}).`);
  }

  return response.json() as Promise<StreamingIngestionStatus>;
}

export async function startStreamingIngestion(request: StartStreamingIngestionRequest): Promise<StreamingIngestionStatus> {
  const response = await fetchApi('/api/v1/admin/streaming/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to start streaming ingestion (${response.status}).`);
  }

  return response.json() as Promise<StreamingIngestionStatus>;
}

export async function stopStreamingIngestion(): Promise<StreamingIngestionStatus> {
  const response = await fetchApi('/api/v1/admin/streaming/stop', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Unable to stop streaming ingestion (${response.status}).`);
  }

  return response.json() as Promise<StreamingIngestionStatus>;
}

export async function uploadStreamingPayload(file: File): Promise<StreamingUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetchApi('/api/v1/admin/streaming/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Unable to upload streaming payload (${response.status}).`);
  }

  return response.json() as Promise<StreamingUploadResult>;
}

export async function resetSyntheticLogisticsData(): Promise<SyntheticDataResetResult> {
  const response = await fetchApi('/api/v1/admin/data/synthetic/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Unable to reset synthetic logistics data (${response.status}).`);
  }

  return response.json() as Promise<SyntheticDataResetResult>;
}

export async function seedSyntheticLogisticsData(): Promise<SyntheticDataResetResult> {
  const response = await fetchApi('/api/v1/admin/data/synthetic/seed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Unable to seed synthetic logistics data (${response.status}).`);
  }

  return response.json() as Promise<SyntheticDataResetResult>;
}

export async function getSyntheticDataPreview(): Promise<SyntheticDataPreview> {
  const response = await fetchApi('/api/v1/admin/data/synthetic/preview');

  if (!response.ok) {
    throw new Error(`Unable to load synthetic data preview (${response.status}).`);
  }

  return response.json() as Promise<SyntheticDataPreview>;
}

// ===========================
// SITREP / ICS-201 APIs
// ===========================

export async function getIcs201Data(incidentId: number, signal?: AbortSignal): Promise<Ics201Data> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/ics-201`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load ICS-201 data (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load ICS-201 data (${response.status}).`);
  }

  return response.json() as Promise<Ics201Data>;
}

export async function getIcs202Data(incidentId: number, signal?: AbortSignal): Promise<Ics202Data> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/ics-202`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load ICS-202 data (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load ICS-202 data (${response.status}).`);
  }

  return response.json() as Promise<Ics202Data>;
}

export async function getIcs203Data(incidentId: number, signal?: AbortSignal): Promise<Ics203Data> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/ics-203`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load ICS-203 data (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load ICS-203 data (${response.status}).`);
  }

  return response.json() as Promise<Ics203Data>;
}

export async function getIcs205Data(incidentId: number, signal?: AbortSignal): Promise<Ics205Data> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/ics-205`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load ICS-205 data (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load ICS-205 data (${response.status}).`);
  }

  return response.json() as Promise<Ics205Data>;
}

export async function getIcs204Data(incidentId: number, signal?: AbortSignal): Promise<Ics204Data> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/ics-204`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load ICS-204 data (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load ICS-204 data (${response.status}).`);
  }

  return response.json() as Promise<Ics204Data>;
}

export async function getIcs209Data(incidentId: number, signal?: AbortSignal): Promise<Ics209Data> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/ics-209`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load ICS-209 data (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load ICS-209 data (${response.status}).`);
  }

  return response.json() as Promise<Ics209Data>;
}

export async function getIcs214Data(incidentId: number, signal?: AbortSignal): Promise<Ics214Data> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/ics-214`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load ICS-214 data (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load ICS-214 data (${response.status}).`);
  }

  return response.json() as Promise<Ics214Data>;
}

export async function getIcs215Data(incidentId: number, signal?: AbortSignal): Promise<Ics215Data> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/ics-215`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load ICS-215 data (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load ICS-215 data (${response.status}).`);
  }

  return response.json() as Promise<Ics215Data>;
}

export async function getIncidentIapPacket(incidentId: number, signal?: AbortSignal): Promise<IncidentIapPacket> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/iap-packet`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load incident IAP packet (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load incident IAP packet (${response.status}).`);
  }

  return response.json() as Promise<IncidentIapPacket>;
}

export async function exportIncidentIapPacketJson(incidentId: number, signal?: AbortSignal): Promise<Blob> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/iap-packet/export/json`, undefined, true, 2, signal);

  if (!response.ok && response.status === 400) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid incident IAP packet export request.', validationErrors);
    }
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to export incident IAP packet (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to export incident IAP packet (${response.status}).`);
  }

  return response.blob();
}

export async function getIncidentIapPacketPrintHtml(incidentId: number, signal?: AbortSignal): Promise<string> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/iap-packet/print`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load incident IAP print HTML (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load incident IAP print HTML (${response.status}).`);
  }

  return response.text();
}

export async function exportIncidentIapPacketPrintHtml(incidentId: number, signal?: AbortSignal): Promise<string> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/iap-packet/export/print`, undefined, true, 2, signal);

  if (!response.ok && response.status === 400) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid incident IAP print export request.', validationErrors);
    }
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to export incident IAP print HTML (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to export incident IAP print HTML (${response.status}).`);
  }

  return response.text();
}

export async function exportIncidentIapGovernanceEvidenceJson(incidentId: number, signal?: AbortSignal): Promise<Blob> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/iap-governance/evidence/json`, undefined, true, 2, signal);

  if (!response.ok && response.status === 400) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid incident IAP governance evidence export request.', validationErrors);
    }
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to export incident IAP governance evidence (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to export incident IAP governance evidence (${response.status}).`);
  }

  return response.blob();
}

export async function getSituationReports(incidentId: number, signal?: AbortSignal): Promise<SituationReport[]> {
  const response = await fetchApiWith429Backoff(`/api/v1/incidents/${incidentId}/situation-reports`, undefined, true, 2, signal);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Unable to load situation reports (429). Rate limited; please retry in a moment.');
    }
    throw new Error(`Unable to load situation reports (${response.status}).`);
  }

  return response.json() as Promise<SituationReport[]>;
}

export async function createSituationReport(incidentId: number, request: GenerateSituationReportRequest): Promise<{ situationReportId: number }> {
  const response = await fetchApi(`/api/v1/incidents/${incidentId}/situation-reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    if (response.status === 400) {
      const validationErrors = await tryReadValidationErrors(response);
      if (validationErrors) {
        throw new ApiValidationError('Invalid situation report request.', validationErrors);
      }
    }

    throw new Error(`Unable to create situation report (${response.status}).`);
  }

  return response.json() as Promise<{ situationReportId: number }>;
}

export async function getUiAlerts(): Promise<UiAlert[]> {
  const response = await fetchApi('/api/v1/alerts');

  if (!response.ok) {
    throw new Error(`Unable to load alerts (${response.status}).`);
  }

  return response.json() as Promise<UiAlert[]>;
}

export async function createUiAlert(request: CreateUiAlertRequest): Promise<{ alertId: number }> {
  const response = await fetchApi('/api/v1/alerts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to create alert (${response.status}).`);
  }

  return response.json() as Promise<{ alertId: number }>;
}

export async function acknowledgeUiAlert(alertId: number): Promise<void> {
  const response = await fetchApi(`/api/v1/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Unable to acknowledge alert (${response.status}).`);
  }
}

export async function deleteUiAlert(alertId: number): Promise<void> {
  const response = await fetchApi(`/api/v1/alerts/${alertId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Unable to delete alert (${response.status}).`);
  }
}

export async function clearUiAlerts(): Promise<number> {
  const response = await fetchApi('/api/v1/alerts', {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Unable to clear alerts (${response.status}).`);
  }

  const payload = await response.json() as { removedCount: number };
  return payload.removedCount;
}

export async function createCommunicationDispatch(request: CreateCommunicationDispatchRequest): Promise<CommunicationDispatchResult> {
  const response = await fetchApi('/api/v1/alerts/dispatch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid communication dispatch request.', validationErrors);
    }

    throw new Error(`Unable to dispatch communication (${response.status}).`);
  }

  return response.json() as Promise<CommunicationDispatchResult>;
}

export async function getNotificationRecipients(notificationId: number): Promise<NotificationRecipient[]> {
  const response = await fetchApi(`/api/v1/alerts/${notificationId}/recipients`);

  if (!response.ok) {
    throw new Error(`Unable to load notification recipients (${response.status}).`);
  }

  return response.json() as Promise<NotificationRecipient[]>;
}

export async function updateNotificationRecipientDeliveryStatus(
  notificationId: number,
  notificationRecipientId: number,
  request: UpdateRecipientDeliveryStatusRequest,
): Promise<void> {
  const response = await fetchApi(`/api/v1/alerts/${notificationId}/recipients/${notificationRecipientId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid recipient status update request.', validationErrors);
    }

    throw new Error(`Unable to update notification recipient status (${response.status}).`);
  }
}

export async function acknowledgeNotificationRecipient(
  notificationId: number,
  notificationRecipientId: number,
  request: AcknowledgeRecipientRequest,
): Promise<void> {
  const response = await fetchApi(`/api/v1/alerts/${notificationId}/recipients/${notificationRecipientId}/acknowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid recipient acknowledge request.', validationErrors);
    }

    throw new Error(`Unable to acknowledge notification recipient (${response.status}).`);
  }
}

export async function escalateNotification(notificationId: number, request: EscalateNotificationRequest): Promise<EscalationResult> {
  const response = await fetchApi(`/api/v1/alerts/${notificationId}/escalate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const validationErrors = await tryReadValidationErrors(response);
    if (validationErrors) {
      throw new ApiValidationError('Invalid escalation request.', validationErrors);
    }

    throw new Error(`Unable to escalate notification (${response.status}).`);
  }

  return response.json() as Promise<EscalationResult>;
}


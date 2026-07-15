/*
File: frontend/src/types.ts
Blueprint Name: FrontendContracts

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-14

Description:
Shared TypeScript contracts for frontend API payloads.

Features:
  - Typed models for incident, resource, bed, readiness, and auth diagnostics data.
  - Request payload contracts for resource and bed commands.

Security & Compliance:
  - Encourages strict payload handling and explicit data shape boundaries.
  - Reduces accidental exposure through strongly typed contracts.
*/

export interface WeatherForecast {
  date: string;
  temperatureC: number;
  temperatureF: number;
  summary: string;
  locationLabel?: string | null;
  source?: string | null;
}

export type WeatherRiskLevel = 'low' | 'moderate' | 'high';

export interface WeatherOperationalSignalDay {
  date: string;
  temperatureC: number;
  temperatureF: number;
  summary: string;
  riskLevel: WeatherRiskLevel;
}

export interface WeatherOperationalSignal {
  hasData: boolean;
  locationLabel: string;
  sourceLabel: string;
  immediateSummary: string;
  averageTempF: number;
  minTempF: number;
  maxTempF: number;
  temperatureSpread: number;
  moderateRiskDayCount: number;
  highRiskDayCount: number;
  days: WeatherOperationalSignalDay[];
}

export interface WeatherForecastQuery {
  incidentId?: number;
  locationId?: number;
  defaultLocationId?: number;
  city?: string;
  state?: string;
  postalCode?: string;
  defaultCity?: string;
  defaultState?: string;
  defaultPostalCode?: string;
}

export interface CopLiveOverlayFeedPoint {
  locationId: number;
  stressDelta: number;
  source: string;
  updatedUtc: string;
}

export interface CopLiveOverlayFeed {
  provider: string;
  status: string;
  fallbackUsed: boolean;
  detail: string | null;
  lastExternalAttemptUtc?: string | null;
  lastExternalFailureReason?: string | null;
  generatedUtc: string;
  points: CopLiveOverlayFeedPoint[];
}

export interface CopLiveOverlayContractDocument {
  providerMode: string;
  externalUrlEnvironmentVariable: string;
  acceptedPayloadSchema: unknown;
  samplePayload: unknown;
  responseShape: {
    provider: string;
    status: string;
    fallbackUsed: string;
    detail: string;
    lastExternalAttemptUtc: string;
    lastExternalFailureReason: string;
    generatedUtc: string;
    points: string;
  };
}

export interface CopLiveOverlayExternalReadiness {
  providerMode: string;
  urlConfigured: boolean;
  status: string;
  httpStatusCode: number | null;
  rawPointCount: number;
  validPointCount: number;
  activeLocationMatchCount: number;
  invalidPointCount: number;
  detail: string;
  checkedUtc: string;
}

export interface ExternalProviderHealthPolicy {
  failureThreshold: number;
  openDurationSeconds: number;
}

export interface ExternalProviderHealthItem {
  provider: string;
  circuitState: string;
  circuitOpenedUntilUtc: string | null;
  retryAfterSeconds: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastSuccessUtc: string | null;
  lastFailureUtc: string | null;
  lastError: string | null;
}

export interface ExternalProviderHealth {
  status: string;
  policy: ExternalProviderHealthPolicy;
  providers: ExternalProviderHealthItem[];
  checkedUtc: string;
}

export interface ExternalProviderHealthHistoryEvent {
  provider: string;
  eventType: string;
  detail: string;
  eventUtc: string;
}

export interface ExternalProviderHealthHistory {
  provider: string | null;
  take: number;
  total: number;
  events: ExternalProviderHealthHistoryEvent[];
}

export interface ExternalProviderHealthStorageRotation {
  archiveDirectory: string;
  maxFileSizeBytes: number;
  percentOfThreshold: number;
  thresholdReached: boolean;
  status: string;
}

export interface ExternalProviderHealthStorageStatus {
  persistToFile: boolean;
  filePath: string;
  fileExists: boolean;
  fileSizeBytes: number;
  persistToSql: boolean;
  sqlRetentionDays: number;
  inMemoryEventCount: number;
  inMemoryMaxEvents: number;
  rotation: ExternalProviderHealthStorageRotation;
  checkedUtc: string;
}

export interface ExternalProviderHealthStorageRotateResult {
  succeeded: boolean;
  attempted: boolean;
  archiveFilePath: string | null;
  sourceFileBytes: number;
  message: string;
  executedUtc: string;
}

export interface ExternalProviderHealthTrendWindow {
  hours: number;
  bucketMinutes: number;
  startUtc: string;
  endUtc: string;
}

export interface ExternalProviderHealthTrendTotals {
  success: number;
  failure: number;
  bypass: number;
  events: number;
  failureRate: number;
}

export interface ExternalProviderHealthTrendProviderSummaryItem {
  provider: string;
  successCount: number;
  failureCount: number;
  bypassCount: number;
  total: number;
  failureRate: number;
  lastEventUtc: string;
}

export interface ExternalProviderHealthTrendBucket {
  bucketStartUtc: string;
  bucketEndUtc: string;
  successCount: number;
  failureCount: number;
  bypassCount: number;
  total: number;
  failureRate: number;
}

export interface ExternalProviderHealthTrends {
  provider: string | null;
  window: ExternalProviderHealthTrendWindow;
  totals: ExternalProviderHealthTrendTotals;
  providerSummary: ExternalProviderHealthTrendProviderSummaryItem[];
  buckets: ExternalProviderHealthTrendBucket[];
  checkedUtc: string;
}

export interface ExternalProviderHealthFederationProviderSummaryItem {
  provider: string;
  successCount: number;
  failureCount: number;
  bypassCount: number;
  totalCount: number;
  failureRate: number;
  lastEventUtc: string;
}

export interface ExternalProviderHealthFederationEnvironmentSummary {
  environment: string;
  successCount: number;
  failureCount: number;
  bypassCount: number;
  totalCount: number;
  failureRate: number;
  providerCount: number;
  providers: ExternalProviderHealthFederationProviderSummaryItem[];
}

export interface ExternalProviderHealthFederationSummary {
  windowHours: number;
  environmentCount: number;
  environments: ExternalProviderHealthFederationEnvironmentSummary[];
  checkedUtc: string;
}

export interface IncidentOperationalInsight {
  hasIncident: boolean;
  incidentStatusCode: string | null;
  openTaskCount: number;
  totalTaskCount: number;
  overdueTaskCount: number;
  taskActivity24hCount: number;
  taskActivity24hDelta: number;
  timelineEventCount: number;
  timelineActivity24hCount: number;
  timelineActivity24hDelta: number;
  latestTimelineUtc: string | null;
  staleTimelineHours: number | null;
  communicationCount: number;
  communicationActivity24hCount: number;
  communicationActivity24hDelta: number;
  sitrepCount: number;
  latestSitrepUtc: string | null;
  staleSitrepHours: number | null;
  resourceRequestCount: number;
  needsAttention: boolean;
  attentionScore: number;
  attentionLevel: 'low' | 'moderate' | 'high';
  needsAttentionReasons: string[];
  maturityScore: number;
  maturityLevel: 'Type5' | 'Type4' | 'Type3' | 'Type2' | 'Type1';
  commandPostureRecommendations: string[];
  nimsComplianceScore: number;
  nimsComplianceLevel: 'compliant' | 'watch' | 'at-risk';
  nimsComplianceGaps: string[];
  missionDependencyStatus: 'stable' | 'watch' | 'critical';
  missionDependencyNodeCount: number;
  missionDependencyEdgeCount: number;
  missionDependencyBlockers: string[];
}

export interface SystemReadiness {
  status: string;
  environment: string;
  sqlConnectionConfigured: boolean;
  degradedReadFallbackEnabled: boolean;
  cacheUseRedis: boolean;
  adminDataOpsScriptExecutionEnabled: boolean;
  checkedUtc: string;
}

export interface AdminCacheModeState {
  cacheUseRedisRequested: boolean;
  cacheUseRedisEffective: boolean;
  requiresRestart: boolean;
  source: string;
  dockerRedisStartAttempted: boolean;
  dockerRedisStartSucceeded: boolean;
  dockerRedisStartMessage: string | null;
  updatedUtc: string;
}

export interface IncidentSummary {
  incidentId: number;
  incidentNumber: string;
  incidentName: string;
  incidentTypeCode: string;
  incidentStatusCode: string;
  severityCode: string | null;
  activatedUtc: string | null;
  createdUtc: string;
}

export interface DashboardSummary {
  totalIncidentCount: number;
  activeIncidentCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  openObjectiveCount: number;
  latestSitrepUtc: string | null;
  sitrepsLast24HoursCount: number;
}

export interface IncidentDetail {
  incidentId: number;
  incidentNumber: string;
  incidentName: string;
  incidentTypeCode: string;
  incidentStatusCode: string;
  severityCode: string | null;
  leadOrganizationId: number | null;
  leadRegionId: number | null;
  primaryLocationId: number | null;
  isPlannedEvent: boolean;
  startedUtc: string | null;
  activatedUtc: string | null;
  closedUtc: string | null;
  initialSummary: string | null;
  situationSummary: string | null;
  createdByUserId: number;
  createdUtc: string;
  updatedUtc: string | null;
}

export interface AuthMeResponse {
  isAuthenticated: boolean;
  authenticationType: string | null;
  name: string | null;
  username: string | null;
  scopes: string[];
  roles: string[];
}

export interface TokenDebugClaim {
  type: string;
  value: string;
}

export interface AuthTokenDebugResponse {
  isAuthenticated: boolean;
  authenticationType: string | null;
  name: string | null;
  username: string | null;
  audience: string | null;
  issuer: string | null;
  scopes: string[];
  roles: string[];
  configuredAudience: string | null;
  configuredAuthority: string | null;
  allClaims: TokenDebugClaim[];
}

export interface ResourceInventoryItem {
  locationResourceInventoryId: number;
  locationId: number;
  locationName: string;
  resourceTypeCode: string;
  resourceTypeName: string;
  quantityTotal: number;
  quantityAvailable: number;
  quantityCommitted: number;
  quantityOutOfService: number;
  lastReportedUtc: string | null;
}

export interface BedAvailabilityItem {
  bedAvailabilitySnapshotId: number;
  locationId: number;
  locationName: string;
  bedCategoryCode: string;
  staffedBedsTotal: number | null;
  bedsAvailable: number | null;
  bedsOccupied: number | null;
  bedsUnavailable: number | null;
  isolationCapableBeds: number | null;
  surgeBedsPotential: number | null;
  reportedUtc: string;
}

export interface ResourceRegionalRollupItem {
  regionId: number | null;
  regionName: string;
  resourceAvailable: number;
  resourceCommitted: number;
  resourceOutOfService: number;
  bedsAvailable: number;
  bedsOccupied: number;
  bedsUnavailable: number;
}

export interface UpdateResourceInventoryRequest {
  quantityTotal?: number;
  quantityAvailable?: number;
  quantityCommitted?: number;
  quantityOutOfService?: number;
  statusNotes?: string;
}

export interface ImportBatchResult {
  totalRows: number;
  succeededRows: number;
  failedRows: number;
  processedUtc: string;
}

export interface ImportReject {
  rowNumber: number;
  interfaceType: string;
  sourceSystemCode: string;
  sourceMessageId: string | null;
  outcome: string;
  reason: string;
  rawData: string;
}

export interface DetailedImportBatchResult {
  result: ImportBatchResult;
  rejects: ImportReject[];
  rejectReportCsv: string;
  createdRows?: number;
  updatedRows?: number;
}

export interface FhirBedImportResult {
  result: ImportBatchResult;
  rejectedCount: number;
  rejects: string[];
  rejectReportCsv: string;
}

export interface FhirBedAvailabilityAdapterContract {
  contractVersion: string;
  adapterName: string;
  interfaceTypeCode: string;
  supportedFhir: {
    bundleResourceType: string;
    requiredEntryResourceTypes: string[];
    locationReferencePattern: string;
    locationIdentityMapping: string;
  };
  bedCategoryMapping: {
    source: string;
    target: string;
    requirement: string;
  };
  extensionMapping: Array<{
    urlKey: string;
    targetField: string;
    valueType: string;
    required: boolean;
  }>;
  idempotency: {
    key: string;
    duplicateBehavior: string;
  };
  endpoint: {
    method: string;
    path: string;
    requiredRequestFields: string[];
    optionalRequestFields: string[];
  };
  deliverySlices: Array<{
    slice: string;
    goal: string;
    includes: string[];
  }>;
}

export interface StartStreamingIngestionRequest {
  streamDirectory?: string;
  pollIntervalSeconds?: number;
  enableFileWatcher?: boolean;
  defaultSourceSystemCode?: string;
}

export interface StreamingIngestionStatus {
  isRunning: boolean;
  streamDirectory: string;
  pollIntervalSeconds: number;
  fileWatcherEnabled: boolean;
  defaultSourceSystemCode: string;
  pendingFileCount: number;
  processedFileCount: number;
  failedFileCount: number;
  lastStartedUtc: string | null;
  lastScanUtc: string | null;
  lastError: string | null;
}

export interface StreamingUploadResult {
  fileName: string;
  savedPath: string;
  status: StreamingIngestionStatus;
}

export interface SyntheticDataResetResult {
  succeeded: boolean;
  message: string;
  exitCode: number;
  operationCode: string;
  traceId: string;
  outcome: string;
  actorUserId: number | null;
  executedUtc: string;
}

export interface SyntheticDataPreview {
  enabled: boolean;
  environment: string;
  sqlConnected: boolean;
  syntheticLocationCount: number;
  syntheticInventoryCount: number;
  syntheticBedSnapshotCount: number;
  syntheticIncidentRequestCount: number;
  checkedUtc: string;
}

export interface UserReportPreset {
  userReportPresetId: number;
  presetScope: string;
  presetName: string;
  presetJson: string;
  updatedUtc: string;
}

export interface CopCommandHandoffContext {
  target?: 'incidents' | 'planning' | 'operations' | 'after-action';
  incidentId?: number | null;
  incidentNumber?: string | null;
  incidentName?: string | null;
  sourceAction?: string;
  regionFilter?: string;
  locationFilter?: string;
  geoOverlayLayer?: 'composite' | 'resource' | 'bed' | 'incident';
  geoOverlayStressFilter?: 'all' | 'watch' | 'high';
  copMapBaseLayer?: 'streets' | 'terrain' | 'satellite';
  copLiveOverlayFeedMode?: 'off' | 'watch' | 'priority';
  aoiLinkedLayerSetPresetId?: string | null;
  aoiLinkedLayerSetPresetName?: string | null;
  locationId?: number | null;
  regionName?: string | null;
  generatedUtc?: string;
}

export interface AgentConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: string;
}

export interface AgentConversationSession {
  id: string;
  title: string;
  messages: AgentConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentChatCompletionRequest {
  sessionId: string;
  prompt: string;
  includeHistory: boolean;
  topP?: number;
  temperature?: number;
}

export interface AgentCitation {
  label: string;
  source?: string | null;
  sourceId?: string | null;
  score?: number | null;
  url?: string | null;
}

export interface AgentChatCompletionResponse {
  sessionId: string;
  message: AgentConversationMessage;
  groundedSources: string[];
  citations: AgentCitation[];
  modelName: string;
  confidenceScore: number;
  fallbackUsed: boolean;
  retrievalStatus: 'Grounded' | 'NoContext' | 'Fallback' | string;
}

export interface AgentPredictiveDemandSupplyResourceGap {
  resourceTypeCode: string;
  requestedOutstandingQuantity: number;
  availableQuantity: number;
  predictedGapQuantity: number;
}

export interface AgentPredictiveDemandSupplyConfidenceInterval {
  lower: number;
  upper: number;
}

export interface AgentPredictiveDemandSupplyResponse {
  incidentId: number;
  incidentNumber: string;
  incidentName: string;
  horizonHours: number;
  modelId: string;
  modelVersion: string;
  trainedAtUtc: string;
  confidenceInterval: AgentPredictiveDemandSupplyConfidenceInterval;
  driftStatus: string;
  demandPressureIndex: number;
  supplyReadinessIndex: number;
  riskLevel: string;
  projectedDemandQuantity: number;
  projectedSupplyQuantity: number;
  predictedShortfallQuantity: number;
  shortageByResourceType: AgentPredictiveDemandSupplyResourceGap[];
  recommendations: string[];
  assumptions: string[];
  generatedUtc: string;
}

export interface AgentPersonalizationRequest {
  avatar: string;
  theme: 'auto' | 'light' | 'dark' | 'midnight' | 'violet';
  fontScale: number;
  expectedUpdatedUtc?: string;
}

export interface AgentPersonalizationSaveResult {
  userReportPresetId: number;
  updatedUtc?: string;
}

export interface AgentPersonalizationPolicy {
  showDiagnostics: boolean;
  requireApprovalForAll: boolean;
  lockGovernanceToggles: boolean;
  enforceGlobalStyle: boolean;
  allowedThemes: string[];
  allowedAvatars: string[];
  allowedFontScaleMin: number;
  allowedFontScaleMax: number;
  allowedAccentColors: string[];
}

export interface AgentPersonalizationPolicyState {
  hasGlobalPolicy: boolean;
  canManagePolicy: boolean;
  policy: AgentPersonalizationPolicy;
  checkedUtc: string;
}

export interface AgentPersonalizationPolicyAuditItem {
  auditEventId: number;
  eventUtc: string;
  actorUserId: number | null;
  actorDisplayName: string | null;
  outcomeCode: string;
  detailJson: string | null;
}

export interface AgentAnalyticsEventRequest {
  eventName: string;
  sessionId?: string;
  occurredAt: string;
  metadataJson?: string;
}

export interface AgentConfigHealth {
  status: string;
  environment: string;
  azureOpenAiEnabled: boolean;
  azureOpenAiConfigured: boolean;
  azureOpenAiEndpoint: string;
  azureOpenAiDeployment: string;
  azureOpenAiApiVersion: string;
  azureOpenAiUseManagedIdentity: boolean;
  azureOpenAiAuthMode: string;
  azureAiSearchEnabled: boolean;
  azureAiSearchConfigured: boolean;
  azureAiSearchEndpoint: string;
  azureAiSearchIndexName: string;
  azureAiSearchSemanticConfiguration: string;
  azureAiSearchQueryType: string;
  azureAiSearchDataSourceType: string;
  azureAiSearchUseManagedIdentity: boolean;
  azureAiSearchAuthMode: string;
  checkedUtc: string;
}

export interface AgentConnectivityHealth {
  status: string;
  environment: string;
  azureOpenAiConnected: boolean;
  azureOpenAiError: string;
  azureOpenAiAuthMode: string;
  azureOpenAiActiveDeployment?: string | null;
  azureAiSearchConnected: boolean;
  azureAiSearchError: string;
  azureAiSearchAuthMode: string;
  checkedUtc: string;
}

export interface AuditEventListItem {
  auditEventId: number;
  eventUtc: string;
  actorUserId: number | null;
  actorDisplayName: string | null;
  eventCategory: string;
  eventAction: string;
  entitySchemaName: string | null;
  entityTableName: string | null;
  entityPrimaryKey: string | null;
  incidentId: number | null;
  locationId: number | null;
  clientIpAddress: string | null;
  outcomeCode: string;
  detailJson: string | null;
}

export interface AuditEventListQuery {
  incidentId?: number;
  eventCategory?: string;
  outcomeCode?: string;
  fromUtc?: string;
  toUtc?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface UpsertUserReportPresetRequest {
  presetName: string;
  presetJson: string;
}

export interface AddBedAvailabilityRequest {
  staffedBedsTotal?: number;
  bedsAvailable?: number;
  bedsOccupied?: number;
  bedsUnavailable?: number;
  isolationCapableBeds?: number;
  surgeBedsPotential?: number;
  statusNotes?: string;
}

export interface CreateIncidentRequest {
  incidentNumber: string;
  incidentName: string;
  incidentTypeCode: string;
  severityCode?: string;
  primaryLocationId?: number;
  isPlannedEvent: boolean;
  initialSummary?: string;
}

export interface UpdateIncidentRequest {
  incidentName: string;
  incidentTypeCode: string;
  severityCode?: string;
  primaryLocationId?: number;
  isPlannedEvent: boolean;
  initialSummary?: string;
  situationSummary?: string;
}

export interface IncidentTask {
  incidentTaskId: number;
  incidentId: number;
  taskNumber: string | null;
  taskTitle: string;
  taskDescription: string | null;
  assignedToUserId: number | null;
  assignedToUserDisplayName: string | null;
  priorityCode: string;
  statusCode: string;
  dueUtc: string | null;
  completedUtc: string | null;
  createdUtc: string;
  updatedUtc: string | null;
}

export interface CreateIncidentTaskRequest {
  taskTitle: string;
  taskDescription?: string;
  assignedToUserId?: number;
  priorityCode: string;
  dueUtc?: string;
}

export interface UpdateIncidentTaskStatusRequest {
  statusCode: string;
}

export interface UpdateIncidentTaskAssignmentRequest {
  assignedToUserId?: number;
}

export interface IncidentTimelineEvent {
  incidentTimelineEventId: number;
  incidentId: number;
  eventUtc: string;
  eventTypeCode: string;
  eventTitle: string;
  eventDescription: string | null;
  locationId: number | null;
  createdUtc: string;
}

export interface CreateIncidentTimelineEventRequest {
  eventUtc?: string;
  eventTypeCode: string;
  eventTitle: string;
  eventDescription?: string;
  locationId?: number;
}

export interface IncidentCommunication {
  incidentCommunicationId: number;
  incidentId: number;
  notificationId: number | null;
  loggedUtc: string;
  channelCode: string;
  directionCode: string;
  subject: string;
  message: string;
  statusCode: string;
  createdByUserId: number;
  createdByUserDisplayName: string;
  createdUtc: string;
  updatedUtc: string | null;
}

export interface IncidentCommunicationLifecycleSummary {
  totalCommunications: number;
  communicationsWithNotifications: number;
  totalNotifications: number;
  totalRecipients: number;
  queuedRecipients: number;
  sentRecipients: number;
  failedRecipients: number;
  suppressedRecipients: number;
  cancelledRecipients: number;
  acknowledgedRecipients: number;
  emailRecipients: number;
  smsRecipients: number;
  voiceRecipients: number;
  pushRecipients: number;
  emailSentRecipients: number;
  smsSentRecipients: number;
  voiceSentRecipients: number;
  pushSentRecipients: number;
  emailFailedRecipients: number;
  smsFailedRecipients: number;
  voiceFailedRecipients: number;
  pushFailedRecipients: number;
}

export interface CreateIncidentCommunicationRequest {
  channelCode: string;
  directionCode: string;
  subject: string;
  message: string;
  notificationId?: number;
  notificationTypeCode?: string;
  notificationPriorityCode?: 'Low' | 'Normal' | 'High' | 'Critical';
  notificationRecipients?: CommunicationRecipientRequest[];
}

export interface UpdateIncidentCommunicationRequest {
  channelCode: string;
  directionCode: string;
  subject: string;
  message: string;
  statusCode: string;
}

export interface CommunicationRecipientRequest {
  userId?: number;
  contactId?: number;
  locationId?: number;
  channelCode: 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH';
  destinationAddress: string;
}

export interface CreateCommunicationDispatchRequest {
  incidentId?: number;
  notificationTypeCode: string;
  subject: string;
  messageBody: string;
  priorityCode: 'Low' | 'Normal' | 'High' | 'Critical';
  recipients: CommunicationRecipientRequest[];
}

export interface CommunicationDispatchResult {
  notificationId: number;
  recipientCount: number;
  notificationStatusCode: string;
}

export interface NotificationRecipient {
  notificationRecipientId: number;
  notificationId: number;
  userId: number | null;
  contactId: number | null;
  locationId: number | null;
  channelCode: 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH';
  destinationAddress: string;
  deliveryStatusCode: 'Queued' | 'Sent' | 'Failed' | 'Suppressed' | 'Cancelled';
  sentUtc: string | null;
  failureReason: string | null;
  acknowledgedUtc: string | null;
  acknowledgedByUserId: number | null;
}

export interface UpdateRecipientDeliveryStatusRequest {
  deliveryStatusCode: 'Queued' | 'Sent' | 'Failed' | 'Suppressed' | 'Cancelled';
  failureReason?: string;
}

export interface AcknowledgeRecipientRequest {
  acknowledgmentNote?: string;
}

export interface EscalateNotificationRequest {
  escalationReason: string;
  escalationChannelCode: 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH';
  escalationDestinationAddress: string;
}

export interface EscalationResult {
  sourceNotificationId: number;
  escalatedNotificationId: number;
  recipientCount: number;
}

export interface IncidentResourceRequest {
  incidentResourceRequestId: number;
  incidentId: number;
  requestedUtc: string;
  resourceTypeCode: string;
  resourceTypeName: string;
  requestedQuantity: number;
  assignedQuantity: number | null;
  unitOfMeasureCode: string;
  priorityCode: string;
  statusCode: string;
  notes: string | null;
  requestedByUserId: number;
  requestedByUserDisplayName: string;
  createdUtc: string;
  updatedUtc: string | null;
}

export interface CreateIncidentResourceRequest {
  resourceTypeCode: string;
  resourceTypeName: string;
  requestedQuantity: number;
  unitOfMeasureCode: string;
  priorityCode: string;
  notes?: string;
}

export interface UpdateIncidentResourceRequest {
  resourceTypeCode: string;
  resourceTypeName: string;
  requestedQuantity: number;
  assignedQuantity?: number;
  unitOfMeasureCode: string;
  priorityCode: string;
  statusCode: string;
  notes?: string;
}

export interface IncidentResourceLifecycleSummary {
  totalRequests: number;
  requestedRequests: number;
  approvedRequests: number;
  partiallyFulfilledRequests: number;
  fulfilledRequests: number;
  deniedRequests: number;
  cancelledRequests: number;
  archivedRequests: number;
  totalRequestedQuantity: number;
  totalAssignedQuantity: number;
  openUnassignedRequests: number;
}

export interface EvidenceAcceptanceChecklistItem {
  check: string;
  status: string;
  evidence: string;
}

export interface ResourceLifecycleTransitionCoverage {
  requestedToApproved: boolean;
  approvedToFulfillment: boolean;
  terminalDispositionObserved: boolean;
}

export interface ResourceLifecycleRoutingLaneBreakdown {
  requested: number;
  approved: number;
  partiallyFulfilled: number;
  fulfilled: number;
  denied: number;
  cancelled: number;
  archived: number;
}

export interface IncidentResourceLifecycleEvidencePackage {
  incidentId: number;
  generatedUtc: string;
  lifecycleSummary: IncidentResourceLifecycleSummary;
  transitionCoverage: ResourceLifecycleTransitionCoverage;
  routingLaneBreakdown: ResourceLifecycleRoutingLaneBreakdown;
  blockedReasons: string[];
  acceptanceChecklist: EvidenceAcceptanceChecklistItem[];
}

export interface IapGovernanceSummary {
  operationalPeriodCount: number;
  approvedOperationalPeriodCount: number;
  hasApprovedOperationalPeriod: boolean;
  hasIapPacketPayload: boolean;
  exportEligible: boolean;
  blockedReasons: string[];
}

export interface IapGovernanceLatestApprovedOperationalPeriod {
  operationalPeriodId: number;
  periodNumber: number;
  periodName: string | null;
  startUtc: string;
  endUtc: string;
  approvedByUserId: number | null;
  approvedUtc: string | null;
}

export interface IapGovernanceStatusBreakdownItem {
  statusCode: string;
  count: number;
}

export interface IncidentIapGovernanceEvidencePackage {
  incidentId: number;
  generatedUtc: string;
  governance: IapGovernanceSummary;
  latestApprovedOperationalPeriod: IapGovernanceLatestApprovedOperationalPeriod | null;
  operationalPeriodStatusBreakdown: IapGovernanceStatusBreakdownItem[];
  acceptanceChecklist: EvidenceAcceptanceChecklistItem[];
}

export interface IncidentOperationalPeriod {
  operationalPeriodId: number;
  incidentId: number;
  periodNumber: number;
  periodName: string | null;
  startUtc: string;
  endUtc: string;
  statusCode: string;
  planningMeetingUtc: string | null;
  approvedByUserId: number | null;
  approvedUtc: string | null;
}

export interface CreateIncidentOperationalPeriodRequest {
  periodNumber: number;
  periodName?: string;
  startUtc: string;
  endUtc: string;
  statusCode: string;
  planningMeetingUtc?: string;
}

export interface UpdateIncidentOperationalPeriodRequest {
  periodNumber: number;
  periodName?: string;
  startUtc: string;
  endUtc: string;
  statusCode: string;
  planningMeetingUtc?: string;
  approvedByUserId?: number;
  approvedUtc?: string;
}

export interface IncidentObjective {
  incidentObjectiveId: number;
  incidentId: number;
  operationalPeriodId: number | null;
  objectiveNumber: number;
  objectiveText: string;
  priorityCode: string;
  statusCode: string;
  ownerUserId: number | null;
  dueUtc: string | null;
  createdUtc: string;
}

export interface CreateIncidentObjectiveRequest {
  operationalPeriodId?: number;
  objectiveNumber: number;
  objectiveText: string;
  priorityCode: string;
  statusCode: string;
  ownerUserId?: number;
  dueUtc?: string;
}

export interface UpdateIncidentObjectiveRequest {
  operationalPeriodId?: number;
  objectiveNumber: number;
  objectiveText: string;
  priorityCode: string;
  statusCode: string;
  ownerUserId?: number;
  dueUtc?: string;
}

export interface LookupValue {
  codeValueId: number;
  codeSetName: string;
  code: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  description: string | null;
}

export interface CreateLookupValueRequest {
  code: string;
  displayName: string;
  sortOrder?: number;
  description?: string;
}

export interface UpdateLookupValueRequest {
  displayName: string;
  sortOrder?: number;
  description?: string;
  isActive?: boolean;
}

export interface LocationLookupValue {
  locationId: number;
  locationName: string;
  organizationId: number | null;
  organizationName: string | null;
  regionId: number | null;
  regionName: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cityName?: string | null;
  stateCode?: string | null;
  postalCode?: string | null;
  displayText: string;
}

export interface UpdateAdminLocationGeoRequest {
  latitude?: number | null;
  longitude?: number | null;
  cityName?: string;
  stateCode?: string;
  postalCode?: string;
}

export interface AdminLocationGeocodeRequest {
  cityName?: string;
  stateCode?: string;
  postalCode?: string;
  locationName?: string;
  addressLine1?: string;
}

export interface AdminLocationGeocodeResult {
  latitude: number;
  longitude: number;
  normalizedQuery: string;
  geocodeSource: string;
  confidenceScore: number;
}

export interface AdminUserSession {
  userSessionId: number;
  userId: number;
  displayName: string;
  emailAddress: string | null;
  entraSessionId: string | null;
  loginUtc: string;
  lastSeenUtc: string | null;
  logoutUtc: string | null;
  mfaSatisfied: boolean;
  clientIpAddress: string | null;
  sessionStatus: string;
  terminationReason: string | null;
  terminatedUtc: string | null;
  isImpersonationActive: boolean;
  impersonatingAdminUserId: number | null;
  impersonatingAdminDisplayName: string | null;
  impersonationStartedUtc: string | null;
}

export interface IcsPosition {
  icsPositionId: number;
  positionCode: string;
  positionName: string;
  icsSection: string;
  sortOrder: number;
}

export interface IncidentCommandAssignment {
  incidentCommandAssignmentId: number;
  incidentId: number;
  icsPositionId: number;
  positionCode: string;
  positionName: string;
  icsSection: string;
  assignedUserId: number | null;
  assignedUserDisplayName: string | null;
  assignedContactId: number | null;
  assignedContactName: string | null;
  agencyOrganizationId: number | null;
  agencyOrganizationName: string | null;
  assignedFromUtc: string;
  assignedToUtc: string | null;
  assignmentStatusCode: string;
  notes: string | null;
}

export interface UpsertIncidentCommandAssignmentRequest {
  icsPositionId: number;
  assignedUserId?: number;
  assignedContactId?: number;
  agencyOrganizationId?: number;
  notes?: string;
}

export interface IncidentCommandTransferLogEntry {
  incidentCommandAssignmentId: number;
  incidentId: number;
  icsPositionId: number;
  positionCode: string;
  positionName: string;
  icsSection: string;
  assignedUserId: number | null;
  assignedUserDisplayName: string | null;
  assignedContactId: number | null;
  assignedContactName: string | null;
  agencyOrganizationId: number | null;
  agencyOrganizationName: string | null;
  assignedFromUtc: string;
  assignedToUtc: string | null;
  assignmentStatusCode: string;
  notes: string | null;
}

export interface CreateIncidentCommandTransferRequest {
  icsPositionId: number;
  assignedUserId?: number;
  assignedContactId?: number;
  agencyOrganizationId?: number;
  transferSummary?: string;
  commandPostLocation?: string;
}

export interface ActiveUser {
  userId: number;
  displayName: string;
  emailAddress: string | null;
  organizationName: string | null;
}

export interface ActiveContact {
  contactId: number;
  displayName: string;
}

export interface AdminUser {
  userId: number;
  displayName: string;
  emailAddress: string | null;
  isActive: boolean;
  activeRoleCodes: string[];
}

export interface AdminRole {
  roleId: number;
  roleCode: string;
  roleName: string;
  description: string | null;
  isPrivileged: boolean;
}

export interface AdminUserRoleAssignment {
  userRoleAssignmentId: number;
  roleId: number;
  roleCode: string;
  roleName: string;
  effectiveFromUtc: string;
  effectiveToUtc: string | null;
  isActive: boolean;
}

export interface UpsertAdminUserRolesRequest {
  roleCodes: string[];
  assignmentReason?: string;
}

export interface CreateAdminUserRequest {
  displayName: string;
  emailAddress?: string;
  isActive: boolean;
  userPrincipalName?: string;
  entraObjectId?: string;
}

export interface AdminListQuery {
  search?: string;
  isActive?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export interface AdminSessionListQuery {
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface PagedResult<TItem> {
  items: TItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface AdminLocation {
  locationId: number;
  locationName: string;
  organizationName: string | null;
  regionName: string | null;
  latitude: number | null;
  longitude: number | null;
  cityName: string | null;
  stateCode: string | null;
  postalCode: string | null;
  isActive: boolean;
  displayText: string;
}

export interface AdminLocationSnapshot {
  locationId: number;
  locationName: string;
  organizationName: string | null;
  regionName: string | null;
  cityName: string | null;
  stateCode: string | null;
  postalCode: string | null;
  isActive: boolean;
  resourceInventoryRowCount: number;
  totalQuantityAvailable: number;
  totalQuantityCommitted: number;
  totalQuantityOutOfService: number;
  lastResourceReportedUtc: string | null;
  bedSnapshotRowCount: number;
  totalBedsAvailable: number;
  totalBedsOccupied: number;
  totalBedsUnavailable: number;
  lastBedReportedUtc: string | null;
}

export interface AdminIcsPosition {
  icsPositionId: number;
  positionCode: string;
  positionName: string;
  icsSection: string;
  parentPositionCode: string | null;
  sortOrder: number;
  isNimsStandard: boolean;
  description: string | null;
}

export interface AdminIcsPositionListQuery {
  search?: string;
  isNimsStandard?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export interface CreateAdminIcsPositionRequest {
  positionCode: string;
  positionName: string;
  icsSection: string;
  parentPositionCode?: string;
  sortOrder?: number;
  isNimsStandard?: boolean;
  description?: string;
}

export interface UpdateAdminIcsPositionRequest {
  positionName: string;
  icsSection: string;
  parentPositionCode?: string;
  sortOrder?: number;
  isNimsStandard?: boolean;
  description?: string;
}

export interface SituationReport {
  situationReportId: number;
  incidentId: number;
  operationalPeriodId: number | null;
  reportNumber: number;
  reportedUtc: string;
  reportedByUserId: number;
  reportedByUserDisplayName: string;
  summary: string;
  currentActions: string | null;
  plannedActions: string | null;
  unmetNeeds: string | null;
  statusCode: string;
}

export interface AfterActionEvidenceReadiness {
  replayReady: boolean;
  hvaReady: boolean;
  communicationTraceReady: boolean;
  timelineReady: boolean;
  situationReportReady: boolean;
}

export interface AfterActionEvidenceSummary {
  timelineCount: number;
  communicationCount: number;
  resourceRequestCount: number;
  situationReportCount: number;
  latestTimelineUtc: string | null;
  latestCommunicationUtc: string | null;
  latestResourceUtc: string | null;
  latestSituationReportUtc: string | null;
}

export interface AfterActionEvidenceAcceptanceCheck {
  check: string;
  status: string;
  evidence: string;
}

export interface IncidentAfterActionEvidencePackage {
  incidentId: number;
  generatedUtc: string;
  readiness: AfterActionEvidenceReadiness;
  evidenceSummary: AfterActionEvidenceSummary;
  blockedReasons: string[];
  acceptanceChecklist: AfterActionEvidenceAcceptanceCheck[];
}

export interface GenerateSituationReportRequest {
  operationalPeriodId?: number;
  summary: string;
  currentActions?: string;
  plannedActions?: string;
  unmetNeeds?: string;
}

export interface Ics201Data {
  incidentDetail: IncidentDetail;
  currentPeriod: IncidentOperationalPeriod | null;
  activeObjectives: IncidentObjective[];
  commandAssignments: IncidentCommandAssignment[];
  resourceStatusSummary: string | null;
}

export interface Ics202Data {
  incidentDetail: IncidentDetail;
  currentPeriod: IncidentOperationalPeriod | null;
  objectives: IncidentObjective[];
  generatedUtc: string;
}

export interface Ics203Data {
  incidentDetail: IncidentDetail;
  currentPeriod: IncidentOperationalPeriod | null;
  assignments: IncidentCommandAssignment[];
  generatedUtc: string;
}

export interface Ics204AssignmentItem {
  incidentTaskId: number;
  taskNumber: string | null;
  taskTitle: string;
  priorityCode: string;
  statusCode: string;
  assignedToUserDisplayName: string | null;
  dueUtc: string | null;
  objectiveReference: string | null;
}

export interface Ics204Data {
  incidentDetail: IncidentDetail;
  currentPeriod: IncidentOperationalPeriod | null;
  assignments: Ics204AssignmentItem[];
  generatedUtc: string;
}

export interface Ics205Data {
  incidentDetail: IncidentDetail;
  currentPeriod: IncidentOperationalPeriod | null;
  activeCommunications: IncidentCommunication[];
  commandAssignments: IncidentCommandAssignment[];
  generatedUtc: string;
}

export interface Ics214ActivityLogEntry {
  activityUtc: string;
  activityType: string;
  summary: string;
  detail: string | null;
  actorDisplayName: string | null;
}

export interface Ics214Data {
  incidentDetail: IncidentDetail;
  currentPeriod: IncidentOperationalPeriod | null;
  entries: Ics214ActivityLogEntry[];
  generatedUtc: string;
}

export interface Ics215SafetyAnalysisItem {
  hazardCategory: string;
  hazardDescription: string;
  riskLevel: string;
  mitigationAction: string;
  owner: string | null;
}

export interface Ics215Data {
  incidentDetail: IncidentDetail;
  currentPeriod: IncidentOperationalPeriod | null;
  safetyItems: Ics215SafetyAnalysisItem[];
  generatedUtc: string;
}

export interface Ics209Data {
  incidentDetail: IncidentDetail;
  currentPeriod: IncidentOperationalPeriod | null;
  openTaskCount: number;
  activeObjectiveCount: number;
  activeResourceRequestCount: number;
  activeCommunicationCount: number;
  generatedUtc: string;
}

export interface IncidentIapPacket {
  incidentId: number;
  generatedUtc: string;
  ics201: Ics201Data | null;
  ics202: Ics202Data | null;
  ics203: Ics203Data | null;
  ics204: Ics204Data | null;
  ics205: Ics205Data | null;
  ics214: Ics214Data | null;
  ics215: Ics215Data | null;
  ics209: Ics209Data | null;
  situationReports: SituationReport[];
}


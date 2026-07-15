import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Badge, Card, Form, ListGroup, Modal, Tab, Tabs } from 'react-bootstrap';
import {
  ApiValidationError,
  createAdminIcsPosition,
  createCommunicationDispatch,
  downloadBedAvailabilityRejectReportCsv,
  downloadResourceInventoryRejectReportCsv,
  acknowledgeNotificationRecipient,
  escalateNotification,
  getAdminActiveSessions,
  getAdminIcsPositions,
  getAdminLocations,
  getAdminLocationSnapshot,
  exportAdminLocationSnapshotCsv,
  exportAdminLocationSnapshotJson,
  getAdminRoles,
  getAdminUserRoles,
  getAdminUsers,
  downloadAdminUsersRejectReportCsv,
  getAuthTokenDebug,
  getAdminCacheMode,
  getFhirBedAvailabilityAdapterContract,
  getCopLiveOverlayContract,
  getCopLiveOverlayExternalReadiness,
  getCopLiveOverlayFeed,
  getExternalProviderHealth,
  getExternalProviderHealthFederationSummary,
  getExternalProviderHealthHistory,
  getExternalProviderHealthHistoryWarehouse,
  getExternalProviderHealthStorageStatus,
  getExternalProviderHealthTrends,
  evaluateExternalProviderHealthAlerts,
  exportExternalProviderHealthGovernanceCsv,
  exportExternalProviderHealthScorecardCsv,
  exportExternalProviderHealthScorecardJson,
  exportExternalProviderHealthExecutivePacketZip,
  exportAuditEventsCsv,
  createAdminUser,
  getUserReportPresets,
  upsertUserReportPreset,
  getNotificationRecipients,
  getSyntheticDataPreview,
  getStreamingIngestionStatus,
  importBedAvailabilityCsv,
  importAdminUsersCsv,
  importFhirBedAvailability,
  importResourceInventoryCsv,
  seedSyntheticLogisticsData,
  resetSyntheticLogisticsData,
  startAdminSessionImpersonation,
  startStreamingIngestion,
  stopStreamingIngestion,
  stopAdminSessionImpersonation,
  rotateExternalProviderHealthStorage,
  terminateAdminSession,
  exportAdminSessionComplianceEvidenceJson,
  upsertAdminUserRoles,
  updateNotificationRecipientDeliveryStatus,
  updateAdminIcsPosition,
  updateAdminIcsPositionNimsStandardStatus,
  updateAdminLocationGeo,
  updateAdminLocationActiveStatus,
  updateAdminCacheMode,
  updateAdminUserActiveStatus,
  uploadStreamingPayload,
  geocodeAdminLocation,
} from '../../api';
import { authDiagnostics } from '../../authConfig';
import type { NotificationSettings, NotifyHandler } from '../../notifications/types';
import type {
  AdminIcsPosition,
  CopLiveOverlayContractDocument,
  CopLiveOverlayExternalReadiness,
  CopLiveOverlayFeed,
  ExternalProviderHealth,
  ExternalProviderHealthFederationSummary,
  ExternalProviderHealthHistory,
  ExternalProviderHealthStorageStatus,
  ExternalProviderHealthTrends,
  AdminLocation,
  AdminLocationSnapshot,
  AdminUser,
  AdminRole,
  AdminUserRoleAssignment,
  AdminUserSession,
  AuthMeResponse,
  AdminCacheModeState,
  AuthTokenDebugResponse,
  CommunicationDispatchResult,
  CreateAdminIcsPositionRequest,
  CreateCommunicationDispatchRequest,
  DetailedImportBatchResult,
  FhirBedImportResult,
  FhirBedAvailabilityAdapterContract,
  NotificationRecipient,
  EscalationResult,
  StartStreamingIngestionRequest,
  StreamingIngestionStatus,
  SyntheticDataResetResult,
  SyntheticDataPreview,
  SystemReadiness,
  UpdateRecipientDeliveryStatusRequest,
  UpdateAdminIcsPositionRequest,
  UpdateAdminLocationGeoRequest,
  AdminLocationGeocodeResult,
} from '../../types';
import IconActionButton from '../common/IconActionButton';
import IpocDataGrid from '../common/IpocDataGrid';
import LabelWithInfo from '../common/LabelWithInfo';
import LookupAdminCard from './LookupAdminCard';

type AdminWorkspaceCardProps = {
  readiness: SystemReadiness | null;
  authMe: AuthMeResponse | null;
  authMeError: string | null;
  isAuthenticated: boolean;
  initialActiveTab?: string;
  onNotify: NotifyHandler;
  notificationSettings: NotificationSettings;
  onSetToastEnabled: (enabled: boolean) => void;
  onSetAlertFeedEnabled: (enabled: boolean) => void;
  onSetNotificationVariantEnabled: (variant: 'success' | 'danger' | 'warning' | 'info', enabled: boolean) => void;
  onSetNotificationStatusEnabled: (status: 'new' | 'acknowledged', enabled: boolean) => void;
};

type AdminSessionAuditPresetCache = {
  eventCategory: string;
  outcomeCode: string;
  fromLocal: string;
  toLocal: string;
  preset: 'custom' | 'auth-failures-24h' | 'auth-success-24h' | 'all-last-7d';
};

type AdminUserBulkImportRun = {
  executedUtc: string;
  sourceSystemCode: string;
  sourceMessageId: string;
  updateExisting: boolean;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  failedRows: number;
};

type IcsHierarchyNode = {
  position: AdminIcsPosition;
  children: IcsHierarchyNode[];
};

function renderAdminTabTitle(iconClassName: string, label: string) {
  return (
    <span className="ipoc-admin-tab-title">
      <i className={`${iconClassName} ipoc-admin-tab-title-icon`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

type AdminLocationSnapshotPromptTemplate = 'executive-brief' | 'operations-handoff' | 'facility-status-check';

function AdminWorkspaceCard({
  readiness,
  authMe,
  authMeError,
  isAuthenticated,
  initialActiveTab,
  onNotify,
  notificationSettings,
  onSetToastEnabled,
  onSetAlertFeedEnabled,
  onSetNotificationVariantEnabled,
  onSetNotificationStatusEnabled,
}: AdminWorkspaceCardProps) {
  const adminPageSize = 25;
  const ADMIN_DATA_OPS_SCOPE = 'admin-data-ops';
  const ADMIN_DATA_OPS_PRESET = 'default';
  const ADMIN_WEATHER_SCOPE = 'admin-weather';
  const ADMIN_WEATHER_PRESET = 'default';
  const WEATHER_DEFAULT_LOCAL_KEY = 'ipoc.weather.defaultLocation';
  const ADMIN_CACHE_USE_REDIS_LOCAL_KEY = 'ipoc.admin.cache.useRedis';
  const API_TIMING_DEBUG_LOCAL_KEY = 'ipoc.api.timing.debug';
const ADMIN_AUDIT_PRESET_SCOPE = 'admin-audit-presets';
const ADMIN_AUDIT_PRESET_NAME = 'session-admin-default';
const ADMIN_USER_BULK_IMPORT_HISTORY_LOCAL_KEY = 'ipoc.admin.userBulkImportHistory';
  const DEFAULT_INTEGRATION_SAMPLES_HINT = '.\\data\\Integration-Samples';
  const DEFAULT_BATCH_RESOURCE_CSV_HINT = '.\\data\\Integration-Samples\\IOCEM_Batch_ResourceInventory.csv';
  const DEFAULT_BATCH_BED_CSV_HINT = '.\\data\\Integration-Samples\\IOCEM_Batch_BedAvailability.csv';
  const DEFAULT_FHIR_BUNDLE_HINT = '.\\data\\Integration-Samples\\IOCEM_FHIR_BedCapacity.bundle.json';
  const DEFAULT_STREAM_PAYLOAD_HINT = '.\\data\\Integration-Samples\\IOCEM_Streaming_IncidentAndResources.json';
  const [activeTab, setActiveTab] = useState(initialActiveTab ?? 'general');
  const [adminDataMode, setAdminDataMode] = useState<'demo' | 'live'>(() => {
    const persisted = localStorage.getItem('ipoc.admin.dataMode');
    return persisted === 'demo' || persisted === 'live' ? persisted : 'live';
  });
  const [adminCacheUseRedis, setAdminCacheUseRedis] = useState<boolean | null>(() => {
    const persisted = localStorage.getItem('ipoc.admin.cache.useRedis');
    if (persisted === 'true') {
      return true;
    }

    if (persisted === 'false') {
      return false;
    }

    return null;
  });
  const [adminCacheModeState, setAdminCacheModeState] = useState<AdminCacheModeState | null>(null);
  const [adminCacheModeSaving, setAdminCacheModeSaving] = useState(false);
  const [apiTimingDebugEnabled, setApiTimingDebugEnabled] = useState<boolean>(() => {
    return localStorage.getItem(API_TIMING_DEBUG_LOCAL_KEY) === 'true';
  });
  const [weatherDefaultLocationIdInput, setWeatherDefaultLocationIdInput] = useState('');
  const [weatherDefaultCityInput, setWeatherDefaultCityInput] = useState('');
  const [weatherDefaultStateInput, setWeatherDefaultStateInput] = useState('');
  const [weatherDefaultPostalCodeInput, setWeatherDefaultPostalCodeInput] = useState('');
  const [weatherPreferenceHydrated, setWeatherPreferenceHydrated] = useState(false);
  const [weatherPreferenceSaveStatus, setWeatherPreferenceSaveStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [weatherPreferenceSavedAt, setWeatherPreferenceSavedAt] = useState<string | null>(null);
  const weatherPreferenceLastSavedRef = useRef('');

  const [tokenDebug, setTokenDebug] = useState<AuthTokenDebugResponse | null>(null);
  const [tokenDebugLoading, setTokenDebugLoading] = useState(false);

  const [resourceCsvFile, setResourceCsvFile] = useState<File | null>(null);
  const [bedCsvFile, setBedCsvFile] = useState<File | null>(null);
  const [sourceSystemCode, setSourceSystemCode] = useState('BATCH_IMPORT');
  const [sourceMessageId, setSourceMessageId] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [validationOnlyMode, setValidationOnlyMode] = useState(false);
  const [resourceImportResult, setResourceImportResult] = useState<DetailedImportBatchResult | null>(null);
  const [bedImportResult, setBedImportResult] = useState<DetailedImportBatchResult | null>(null);

  const [fhirJsonInput, setFhirJsonInput] = useState('');
  const [fhirLoading, setFhirLoading] = useState(false);
  const [fhirResult, setFhirResult] = useState<FhirBedImportResult | null>(null);
  const [fhirAdapterContract, setFhirAdapterContract] = useState<FhirBedAvailabilityAdapterContract | null>(null);
  const [fhirAdapterContractLoading, setFhirAdapterContractLoading] = useState(false);

  const [streamingStatus, setStreamingStatus] = useState<StreamingIngestionStatus | null>(null);
  const [streamingLoading, setStreamingLoading] = useState(false);
  const [streamDirectory, setStreamDirectory] = useState('');
  const [streamPollIntervalSeconds, setStreamPollIntervalSeconds] = useState('15');
  const [streamSourceSystemCode, setStreamSourceSystemCode] = useState('SIM_STREAM');
  const [streamWatcherEnabled, setStreamWatcherEnabled] = useState(true);
  const [streamUploadFile, setStreamUploadFile] = useState<File | null>(null);

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersSearch, setAdminUsersSearch] = useState('');
  const [adminUsersStatusFilter, setAdminUsersStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [adminUsersPageNumber, setAdminUsersPageNumber] = useState(1);
  const [adminUsersTotalCount, setAdminUsersTotalCount] = useState(0);
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [adminRolesLoading, setAdminRolesLoading] = useState(false);
  const [adminUserRoleModalOpen, setAdminUserRoleModalOpen] = useState(false);
  const [adminUserRoleTarget, setAdminUserRoleTarget] = useState<AdminUser | null>(null);
  const [adminUserRoleAssignments, setAdminUserRoleAssignments] = useState<AdminUserRoleAssignment[]>([]);
  const [adminUserRoleSelection, setAdminUserRoleSelection] = useState<string[]>([]);
  const [adminUserRoleReason, setAdminUserRoleReason] = useState('');
  const [adminUserRoleSaving, setAdminUserRoleSaving] = useState(false);
  const [adminUserCreateDisplayName, setAdminUserCreateDisplayName] = useState('');
  const [adminUserCreateEmailAddress, setAdminUserCreateEmailAddress] = useState('');
  const [adminUserCreateUpn, setAdminUserCreateUpn] = useState('');
  const [adminUserCreateEntraObjectId, setAdminUserCreateEntraObjectId] = useState('');
  const [adminUserCreateIsActive, setAdminUserCreateIsActive] = useState(true);
  const [adminUserCreateValidationErrors, setAdminUserCreateValidationErrors] = useState<Record<string, string[]>>({});
  const [adminUserBulkCsvFile, setAdminUserBulkCsvFile] = useState<File | null>(null);
  const [adminUserBulkSourceSystemCode, setAdminUserBulkSourceSystemCode] = useState('ADMIN_USER_IMPORT');
  const [adminUserBulkSourceMessageId, setAdminUserBulkSourceMessageId] = useState('');
  const [adminUserBulkUpdateExisting, setAdminUserBulkUpdateExisting] = useState(false);
  const [adminUserBulkLoading, setAdminUserBulkLoading] = useState(false);
  const [adminUserBulkResult, setAdminUserBulkResult] = useState<DetailedImportBatchResult | null>(null);
  const [adminUserBulkAuditExportLoading, setAdminUserBulkAuditExportLoading] = useState(false);
  const [adminUserBulkImportHistory, setAdminUserBulkImportHistory] = useState<AdminUserBulkImportRun[]>(() => {
    try {
      const stored = localStorage.getItem(ADMIN_USER_BULK_IMPORT_HISTORY_LOCAL_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored) as AdminUserBulkImportRun[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [adminLocations, setAdminLocations] = useState<AdminLocation[]>([]);
  const [adminLocationsLoading, setAdminLocationsLoading] = useState(false);
  const [adminLocationsSearch, setAdminLocationsSearch] = useState('');
  const [adminLocationsStatusFilter, setAdminLocationsStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [adminLocationsPageNumber, setAdminLocationsPageNumber] = useState(1);
  const [adminLocationsTotalCount, setAdminLocationsTotalCount] = useState(0);
  const [showAdminLocationGeoModal, setShowAdminLocationGeoModal] = useState(false);
  const [adminLocationGeoEditing, setAdminLocationGeoEditing] = useState<AdminLocation | null>(null);
  const [adminLocationGeoLatitude, setAdminLocationGeoLatitude] = useState('');
  const [adminLocationGeoLongitude, setAdminLocationGeoLongitude] = useState('');
  const [adminLocationGeoCityName, setAdminLocationGeoCityName] = useState('');
  const [adminLocationGeoStateCode, setAdminLocationGeoStateCode] = useState('');
  const [adminLocationGeoPostalCode, setAdminLocationGeoPostalCode] = useState('');
  const [adminLocationGeoLoading, setAdminLocationGeoLoading] = useState(false);
  const [adminLocationGeoValidationErrors, setAdminLocationGeoValidationErrors] = useState<Record<string, string[]>>({});
  const [adminLocationGeocodeResult, setAdminLocationGeocodeResult] = useState<AdminLocationGeocodeResult | null>(null);
  const [adminLocationSnapshot, setAdminLocationSnapshot] = useState<AdminLocationSnapshot | null>(null);
  const [adminLocationSnapshotLoading, setAdminLocationSnapshotLoading] = useState(false);
  const [adminLocationSnapshotPromptTemplate, setAdminLocationSnapshotPromptTemplate] = useState<AdminLocationSnapshotPromptTemplate>('executive-brief');
  const [adminLocationSnapshotPromptText, setAdminLocationSnapshotPromptText] = useState('');
  const [adminLocationSnapshotPromptGeneratedUtc, setAdminLocationSnapshotPromptGeneratedUtc] = useState<string | null>(null);

  const buildAdminLocationSnapshotSignals = (snapshot: AdminLocationSnapshot) => {
    const signals: Array<{ severity: 'success' | 'warning' | 'danger'; label: string; detail: string }> = [];

    const totalTrackedBeds = snapshot.totalBedsAvailable + snapshot.totalBedsOccupied;
    if (totalTrackedBeds > 0) {
      const occupancyRatio = snapshot.totalBedsOccupied / totalTrackedBeds;
      if (occupancyRatio >= 0.9) {
        signals.push({
          severity: 'danger',
          label: 'High bed occupancy',
          detail: `${Math.round(occupancyRatio * 100)}% occupied`,
        });
      } else if (occupancyRatio >= 0.75) {
        signals.push({
          severity: 'warning',
          label: 'Elevated bed occupancy',
          detail: `${Math.round(occupancyRatio * 100)}% occupied`,
        });
      } else {
        signals.push({
          severity: 'success',
          label: 'Bed occupancy stable',
          detail: `${Math.round(occupancyRatio * 100)}% occupied`,
        });
      }
    }

    if (snapshot.totalQuantityCommitted > snapshot.totalQuantityAvailable) {
      signals.push({
        severity: 'warning',
        label: 'Resource commitment pressure',
        detail: `Committed ${snapshot.totalQuantityCommitted} exceeds available ${snapshot.totalQuantityAvailable}`,
      });
    }

    const nowMs = Date.now();
    const bedStalenessHours = snapshot.lastBedReportedUtc
      ? (nowMs - new Date(snapshot.lastBedReportedUtc).getTime()) / (1000 * 60 * 60)
      : Number.POSITIVE_INFINITY;
    const resourceStalenessHours = snapshot.lastResourceReportedUtc
      ? (nowMs - new Date(snapshot.lastResourceReportedUtc).getTime()) / (1000 * 60 * 60)
      : Number.POSITIVE_INFINITY;

    const worstStaleness = Math.max(bedStalenessHours, resourceStalenessHours);
    if (worstStaleness >= 24) {
      signals.push({
        severity: 'danger',
        label: 'Snapshot data stale',
        detail: `Last update exceeds ${Math.round(worstStaleness)}h`,
      });
    } else if (worstStaleness >= 6) {
      signals.push({
        severity: 'warning',
        label: 'Snapshot refresh aging',
        detail: `Last update ${Math.round(worstStaleness)}h ago`,
      });
    }

    if (snapshot.resourceInventoryRowCount === 0 || snapshot.bedSnapshotRowCount === 0) {
      signals.push({
        severity: 'warning',
        label: 'Partial facility visibility',
        detail: 'One or more snapshot datasets have no rows',
      });
    }

    return signals;
  };

  const buildAdminLocationSnapshotPrompt = (
    location: AdminLocation,
    snapshot: AdminLocationSnapshot,
    template: AdminLocationSnapshotPromptTemplate,
  ) => {
    const resourceReported = snapshot.lastResourceReportedUtc ? new Date(snapshot.lastResourceReportedUtc).toISOString() : 'n/a';
    const bedReported = snapshot.lastBedReportedUtc ? new Date(snapshot.lastBedReportedUtc).toISOString() : 'n/a';

    const summary = [
      `Facility: ${location.locationName}`,
      `LocationId: ${location.locationId}`,
      `Resource rows: ${snapshot.resourceInventoryRowCount}`,
      `Resource totals (available/committed/out-of-service): ${snapshot.totalQuantityAvailable}/${snapshot.totalQuantityCommitted}/${snapshot.totalQuantityOutOfService}`,
      `Bed rows: ${snapshot.bedSnapshotRowCount}`,
      `Bed totals (available/occupied/unavailable): ${snapshot.totalBedsAvailable}/${snapshot.totalBedsOccupied}/${snapshot.totalBedsUnavailable}`,
      `Last resource report UTC: ${resourceReported}`,
      `Last bed report UTC: ${bedReported}`,
      `Status signals: ${buildAdminLocationSnapshotSignals(snapshot).map((signal) => `${signal.label} (${signal.detail})`).join(' | ') || 'none'}`,
    ].join('\n');

    switch (template) {
      case 'operations-handoff':
        return [
          'Generate an operations handoff update using the following point-in-time facility posture data.',
          'Highlight immediate bottlenecks, bed pressure, and recommended 4-hour actions.',
          summary,
        ].join('\n\n');
      case 'facility-status-check':
        return [
          'Generate a facility status-check checklist from this snapshot.',
          'Return a concise checklist with owner-ready action prompts for stale or degraded metrics.',
          summary,
        ].join('\n\n');
      case 'executive-brief':
      default:
        return [
          'Generate an executive facility brief from this point-in-time snapshot.',
          'Keep it concise and decision-oriented: current posture, risk signals, and recommended executive decisions.',
          summary,
        ].join('\n\n');
    }
  };

  const applySessionAuditQuickPreset = (preset: 'auth-failures-24h' | 'auth-success-24h' | 'all-last-7d') => {
    const now = new Date();
    const start = new Date(now);

    if (preset === 'all-last-7d') {
      start.setDate(now.getDate() - 7);
      setAdminSessionAuditEventCategory('');
      setAdminSessionAuditOutcomeCode('');
    } else {
      start.setHours(now.getHours() - 24);
      setAdminSessionAuditEventCategory('AUTHENTICATION');
      setAdminSessionAuditOutcomeCode(preset === 'auth-failures-24h' ? 'FAILURE' : 'SUCCESS');
    }

    const toLocalDateTimeInput = (value: Date) => {
      const local = new Date(value.getTime() - (value.getTimezoneOffset() * 60000));
      return local.toISOString().slice(0, 16);
    };

    setAdminSessionAuditFromLocal(toLocalDateTimeInput(start));
    setAdminSessionAuditToLocal(toLocalDateTimeInput(now));
    setAdminSessionAuditPreset(preset);
    onNotify('Session audit quick preset applied.', 'info');
  };

  const clearSessionAuditFilters = () => {
    setAdminSessionAuditEventCategory('AUTHENTICATION');
    setAdminSessionAuditOutcomeCode('');
    setAdminSessionAuditFromLocal('');
    setAdminSessionAuditToLocal('');
    setAdminSessionAuditPreset('custom');
    onNotify('Session audit filters reset to defaults.', 'info');
  };

  const handleExportAdminUserBulkAuditEvidence = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before exporting admin user bulk import audit evidence.', 'warning');
      return;
    }

    try {
      setAdminUserBulkAuditExportLoading(true);
      const blob = await exportAuditEventsCsv({
        eventCategory: 'ADMIN_USER_IMPORT',
        pageSize: 500,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `admin-user-import-audit-evidence-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onNotify('Admin user import audit evidence exported.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export admin user import audit evidence.';
      onNotify(message, 'danger');
    } finally {
      setAdminUserBulkAuditExportLoading(false);
    }
  };

  const handleExportAdminLocationSnapshotJson = async () => {
    if (!isAuthenticated || !adminLocationGeoEditing) {
      onNotify('Sign in before exporting facility snapshot.', 'warning');
      return;
    }

    try {
      setAdminLocationSnapshotLoading(true);
      const blob = await exportAdminLocationSnapshotJson(adminLocationGeoEditing.locationId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-location-snapshot-${adminLocationGeoEditing.locationId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      onNotify('Facility snapshot JSON exported.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export facility snapshot JSON.';
      onNotify(message, 'danger');
    } finally {
      setAdminLocationSnapshotLoading(false);
    }
  };

  const handleGenerateAdminLocationSnapshotPrompt = () => {
    if (!adminLocationGeoEditing || !adminLocationSnapshot) {
      onNotify('Load a facility snapshot before generating prompt guidance.', 'warning');
      return;
    }

    const promptText = buildAdminLocationSnapshotPrompt(
      adminLocationGeoEditing,
      adminLocationSnapshot,
      adminLocationSnapshotPromptTemplate,
    );
    setAdminLocationSnapshotPromptText(promptText);
    setAdminLocationSnapshotPromptGeneratedUtc(new Date().toISOString());
    onNotify('Facility snapshot prompt generated.', 'success');
  };

  const handleCopyAdminLocationSnapshotPrompt = async () => {
    if (!adminLocationSnapshotPromptText.trim()) {
      onNotify('Generate a facility snapshot prompt before copying.', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(adminLocationSnapshotPromptText);
      onNotify('Facility snapshot prompt copied to clipboard.', 'success');
    } catch {
      onNotify('Unable to access clipboard. Copy prompt manually from the text area.', 'warning');
    }
  };

  const handleDownloadAdminLocationSnapshotPrompt = () => {
    if (!adminLocationSnapshotPromptText.trim() || !adminLocationGeoEditing) {
      onNotify('Generate a facility snapshot prompt before downloading.', 'warning');
      return;
    }

    const promptFileContent = [
      `GeneratedUtc: ${adminLocationSnapshotPromptGeneratedUtc ?? 'n/a'}`,
      `Template: ${adminLocationSnapshotPromptTemplate}`,
      '',
      adminLocationSnapshotPromptText,
    ].join('\n');

    const blob = new Blob([promptFileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `admin-location-snapshot-prompt-${adminLocationGeoEditing.locationId}-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    onNotify('Facility snapshot prompt downloaded.', 'success');
  };

  const handleExportAdminLocationSnapshotCsv = async () => {
    if (!isAuthenticated || !adminLocationGeoEditing) {
      onNotify('Sign in before exporting facility snapshot.', 'warning');
      return;
    }

    try {
      setAdminLocationSnapshotLoading(true);
      const blob = await exportAdminLocationSnapshotCsv(adminLocationGeoEditing.locationId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-location-snapshot-${adminLocationGeoEditing.locationId}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      onNotify('Facility snapshot CSV exported.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export facility snapshot CSV.';
      onNotify(message, 'danger');
    } finally {
      setAdminLocationSnapshotLoading(false);
    }
  };

  const handleExportSessionComplianceEvidence = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before exporting session compliance evidence.', 'warning');
      return;
    }

    try {
      setAdminSessionsLoading(true);
      const blob = await exportAdminSessionComplianceEvidenceJson();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `admin-session-compliance-evidence-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onNotify('Session compliance evidence exported.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export session compliance evidence.';
      onNotify(message, 'danger');
    } finally {
      setAdminSessionsLoading(false);
    }
  };

  const handleDownloadAdminUserBulkTemplate = () => {
    const templateCsv = [
      'displayName,emailAddress,userPrincipalName,entraObjectId,isActive,roleCodes',
      'Jordan Analyst,jordan.analyst@example.org,jordan.analyst@tenant.onmicrosoft.com,,true,CONTRIBUTOR|INCIDENT_COMMANDER',
      'Alex Admin,alex.admin@example.org,alex.admin@tenant.onmicrosoft.com,,true,SYSTEM_ADMIN',
    ].join('\n');

    downloadCsv('admin-users-bulk-template.csv', templateCsv);
    onNotify('Admin bulk-user import template downloaded.', 'success');
  };

  const handleImportAdminUsersCsv = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before importing users.', 'warning');
      return;
    }

    if (!adminUserBulkCsvFile) {
      onNotify('Select a user CSV file before running bulk import.', 'warning');
      return;
    }

    try {
      setAdminUserBulkLoading(true);
      setAdminUserBulkResult(null);

      const result = await importAdminUsersCsv(
        adminUserBulkCsvFile,
        adminUserBulkSourceSystemCode.trim(),
        adminUserBulkSourceMessageId.trim() || undefined,
        adminUserBulkUpdateExisting,
      );
      setAdminUserBulkResult(result);

      const createdRows = result.createdRows ?? result.result.succeededRows;
      const updatedRows = result.updatedRows ?? 0;
      setAdminUserBulkImportHistory((current) => ([{
        executedUtc: new Date().toISOString(),
        sourceSystemCode: adminUserBulkSourceSystemCode.trim() || 'ADMIN_USER_IMPORT',
        sourceMessageId: adminUserBulkSourceMessageId.trim(),
        updateExisting: adminUserBulkUpdateExisting,
        totalRows: result.result.totalRows,
        createdRows,
        updatedRows,
        failedRows: result.result.failedRows,
      }, ...current]).slice(0, 12));

      await handleLoadAdminUsers(1);

      if (result.result.failedRows > 0) {
        onNotify(`Bulk user import finished with ${result.result.failedRows} failed row(s).`, 'warning');
      } else {
        onNotify(`Bulk user import completed: ${createdRows} created, ${updatedRows} updated.`, 'success');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to import user CSV.';
      onNotify(message, 'danger');
    } finally {
      setAdminUserBulkLoading(false);
    }
  };

  const handleDownloadAdminUserBulkRejectReport = async () => {
    if (!adminUserBulkCsvFile) {
      onNotify('Select a user CSV file before downloading reject report.', 'warning');
      return;
    }

    try {
      setAdminUserBulkLoading(true);
      const csv = await downloadAdminUsersRejectReportCsv(
        adminUserBulkCsvFile,
        adminUserBulkSourceSystemCode.trim(),
        adminUserBulkSourceMessageId.trim() || undefined,
      );
      downloadCsv('admin-user-import-reject-report.csv', csv);
      onNotify('Admin user reject report downloaded.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate admin user reject report.';
      onNotify(message, 'danger');
    } finally {
      setAdminUserBulkLoading(false);
    }
  };

  const handleLoadAdminRoles = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setAdminRolesLoading(true);
      const roles = await getAdminRoles();
      setAdminRoles(roles);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load admin roles.';
      onNotify(message, 'danger');
    } finally {
      setAdminRolesLoading(false);
    }
  };

  const openAdminUserRoleEditor = async (user: AdminUser) => {
    if (!isAuthenticated) {
      onNotify('Sign in before managing user roles.', 'warning');
      return;
    }

    try {
      setAdminUsersLoading(true);
      if (adminRoles.length === 0) {
        const roles = await getAdminRoles();
        setAdminRoles(roles);
      }

      const assignments = await getAdminUserRoles(user.userId);
      setAdminUserRoleTarget(user);
      setAdminUserRoleAssignments(assignments);
      setAdminUserRoleSelection(assignments.filter((item) => item.isActive).map((item) => item.roleCode));
      setAdminUserRoleReason('');
      setAdminUserRoleModalOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load user role assignments.';
      onNotify(message, 'danger');
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const toggleAdminUserRoleSelection = (roleCode: string) => {
    setAdminUserRoleSelection((current) => (
      current.includes(roleCode)
        ? current.filter((value) => value !== roleCode)
        : [...current, roleCode]
    ));
  };

  const handleSaveAdminUserRoles = async () => {
    if (!adminUserRoleTarget) {
      return;
    }

    try {
      setAdminUserRoleSaving(true);
      await upsertAdminUserRoles(adminUserRoleTarget.userId, {
        roleCodes: adminUserRoleSelection,
        assignmentReason: adminUserRoleReason.trim().length > 0 ? adminUserRoleReason.trim() : undefined,
      });

      const refreshedAssignments = await getAdminUserRoles(adminUserRoleTarget.userId);
      setAdminUserRoleAssignments(refreshedAssignments);
      await handleLoadAdminUsers(adminUsersPageNumber);
      onNotify('User roles updated.', 'success');
      setAdminUserRoleModalOpen(false);
      setAdminUserRoleTarget(null);
      setAdminUserRoleSelection([]);
      setAdminUserRoleReason('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update user roles.';
      onNotify(message, 'danger');
    } finally {
      setAdminUserRoleSaving(false);
    }
  };

  const handleCreateAdminUser = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before creating users.', 'warning');
      return;
    }

    const displayName = adminUserCreateDisplayName.trim();
    const emailAddress = adminUserCreateEmailAddress.trim();
    const userPrincipalName = adminUserCreateUpn.trim();
    const entraObjectIdText = adminUserCreateEntraObjectId.trim();

    if (!displayName) {
      setAdminUserCreateValidationErrors((current) => ({ ...current, displayName: ['Display name is required.'] }));
      onNotify('Display name is required to create a user.', 'warning');
      return;
    }

    if (entraObjectIdText.length > 0 && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entraObjectIdText)) {
      setAdminUserCreateValidationErrors((current) => ({ ...current, entraObjectId: ['Entra Object ID must be a valid GUID.'] }));
      onNotify('Entra Object ID must be a valid GUID.', 'warning');
      return;
    }

    try {
      setAdminUserCreateValidationErrors({});
      setAdminUsersLoading(true);
      await createAdminUser({
        displayName,
        emailAddress: emailAddress.length > 0 ? emailAddress : undefined,
        isActive: adminUserCreateIsActive,
        userPrincipalName: userPrincipalName.length > 0 ? userPrincipalName : undefined,
        entraObjectId: entraObjectIdText.length > 0 ? entraObjectIdText : undefined,
      });
      setAdminUserCreateDisplayName('');
      setAdminUserCreateEmailAddress('');
      setAdminUserCreateUpn('');
      setAdminUserCreateEntraObjectId('');
      setAdminUserCreateIsActive(true);
      setAdminUserCreateValidationErrors({});
      await handleLoadAdminUsers(1);
      onNotify('User created successfully.', 'success');
    } catch (error) {
      if (error instanceof ApiValidationError) {
        setAdminUserCreateValidationErrors(error.validationErrors);
        onNotify('Please review create-user validation errors.', 'warning');
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to create user.';
      onNotify(message, 'danger');
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const [adminIcsPositions, setAdminIcsPositions] = useState<AdminIcsPosition[]>([]);
  const [adminIcsPositionsLoading, setAdminIcsPositionsLoading] = useState(false);
  const [adminIcsPositionsSearch, setAdminIcsPositionsSearch] = useState('');
  const [adminIcsPositionsStandardFilter, setAdminIcsPositionsStandardFilter] = useState<'all' | 'standard' | 'custom'>('all');
  const [adminIcsPositionsPageNumber, setAdminIcsPositionsPageNumber] = useState(1);
  const [adminIcsPositionsTotalCount, setAdminIcsPositionsTotalCount] = useState(0);
  const [adminIcsPositionPositionCode, setAdminIcsPositionPositionCode] = useState('');
  const [adminIcsPositionPositionName, setAdminIcsPositionPositionName] = useState('');
  const [adminIcsPositionSection, setAdminIcsPositionSection] = useState('');
  const [adminIcsPositionParentCode, setAdminIcsPositionParentCode] = useState('');
  const [adminIcsPositionSortOrder, setAdminIcsPositionSortOrder] = useState('100');
  const [adminIcsPositionDescription, setAdminIcsPositionDescription] = useState('');
  const [adminIcsPositionIsStandard, setAdminIcsPositionIsStandard] = useState(true);
  const [adminIcsPositionEditId, setAdminIcsPositionEditId] = useState<number | null>(null);
  const [adminIcsPositionValidationErrors, setAdminIcsPositionValidationErrors] = useState<Record<string, string[]>>({});
  const [adminIcsPositionSaveMessage, setAdminIcsPositionSaveMessage] = useState<string | null>(null);
  const [showIcsHierarchyPreview, setShowIcsHierarchyPreview] = useState(false);
  const adminIcsPositionCodeInputRef = useRef<HTMLInputElement | null>(null);
  const adminIcsPositionNameInputRef = useRef<HTMLInputElement | null>(null);
  const adminIcsPositionSectionInputRef = useRef<HTMLInputElement | null>(null);
  const adminIcsPositionParentCodeInputRef = useRef<HTMLInputElement | null>(null);
  const adminIcsPositionSortOrderInputRef = useRef<HTMLInputElement | null>(null);
  const adminIcsPositionDescriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [adminSessions, setAdminSessions] = useState<AdminUserSession[]>([]);
  const [adminSessionsLoading, setAdminSessionsLoading] = useState(false);
  const [adminSessionsSearch, setAdminSessionsSearch] = useState('');
  const [adminSessionsPageNumber, setAdminSessionsPageNumber] = useState(1);
  const [adminSessionsTotalCount, setAdminSessionsTotalCount] = useState(0);
  const [adminSessionAuditFromLocal, setAdminSessionAuditFromLocal] = useState('');
  const [adminSessionAuditToLocal, setAdminSessionAuditToLocal] = useState('');
  const [adminSessionAuditEventCategory, setAdminSessionAuditEventCategory] = useState('AUTHENTICATION');
  const [adminSessionAuditOutcomeCode, setAdminSessionAuditOutcomeCode] = useState('');
  const [adminSessionAuditExportLoading, setAdminSessionAuditExportLoading] = useState(false);
  const [adminSessionAuditPreset, setAdminSessionAuditPreset] = useState<'custom' | 'auth-failures-24h' | 'auth-success-24h' | 'all-last-7d'>('custom');
  const [sessionTerminationReason, setSessionTerminationReason] = useState('');
  const [sessionImpersonationReason, setSessionImpersonationReason] = useState('');
  const [dispatchIncidentId, setDispatchIncidentId] = useState('');
  const [dispatchNotificationTypeCode, setDispatchNotificationTypeCode] = useState('INCIDENT_NOTIFICATION');
  const [dispatchSubject, setDispatchSubject] = useState('');
  const [dispatchMessageBody, setDispatchMessageBody] = useState('');
  const [dispatchPriorityCode, setDispatchPriorityCode] = useState<'Low' | 'Normal' | 'High' | 'Critical'>('Normal');
  const [dispatchChannelCode, setDispatchChannelCode] = useState<'EMAIL' | 'SMS' | 'VOICE' | 'PUSH'>('EMAIL');
  const [dispatchDestinationAddress, setDispatchDestinationAddress] = useState('');
  const [dispatchUserId, setDispatchUserId] = useState('');
  const [dispatchContactId, setDispatchContactId] = useState('');
  const [dispatchLocationId, setDispatchLocationId] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<CommunicationDispatchResult | null>(null);
  const [recipientLookupNotificationId, setRecipientLookupNotificationId] = useState('');
  const [notificationRecipients, setNotificationRecipients] = useState<NotificationRecipient[]>([]);
  const [notificationRecipientsLoading, setNotificationRecipientsLoading] = useState(false);
  const [recipientStatusSelection, setRecipientStatusSelection] = useState<Record<number, UpdateRecipientDeliveryStatusRequest['deliveryStatusCode']>>({});
  const [recipientFailureReasonInput, setRecipientFailureReasonInput] = useState<Record<number, string>>({});
  const [recipientAcknowledgmentNoteInput, setRecipientAcknowledgmentNoteInput] = useState<Record<number, string>>({});
  const [escalateNotificationIdInput, setEscalateNotificationIdInput] = useState('');
  const [escalationReasonInput, setEscalationReasonInput] = useState('');
  const [escalationChannelCodeInput, setEscalationChannelCodeInput] = useState<'EMAIL' | 'SMS' | 'VOICE' | 'PUSH'>('EMAIL');
  const [escalationDestinationAddressInput, setEscalationDestinationAddressInput] = useState('');
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [escalationResult, setEscalationResult] = useState<EscalationResult | null>(null);
  const [syntheticResetLoading, setSyntheticResetLoading] = useState(false);
  const [syntheticSeedLoading, setSyntheticSeedLoading] = useState(false);
  const [showDataOpsConfirmModal, setShowDataOpsConfirmModal] = useState(false);
  const [pendingDataOpsAction, setPendingDataOpsAction] = useState<'seed' | 'reset' | null>(null);
  const [dataOpsAckInput, setDataOpsAckInput] = useState('');
  const [dataOpsPreview, setDataOpsPreview] = useState<SyntheticDataPreview | null>(null);
  const [dataOpsPreviewLoading, setDataOpsPreviewLoading] = useState(false);
  const [lastDataOpsResult, setLastDataOpsResult] = useState<SyntheticDataResetResult | null>(null);
  const [copLiveOverlayContract, setCopLiveOverlayContract] = useState<CopLiveOverlayContractDocument | null>(null);
  const [copLiveOverlayExternalReadiness, setCopLiveOverlayExternalReadiness] = useState<CopLiveOverlayExternalReadiness | null>(null);
  const [copLiveOverlayFeedPreview, setCopLiveOverlayFeedPreview] = useState<CopLiveOverlayFeed | null>(null);
  const [copLiveOverlayDiagnosticsLoading, setCopLiveOverlayDiagnosticsLoading] = useState(false);
  const [externalProviderHealth, setExternalProviderHealth] = useState<ExternalProviderHealth | null>(null);
  const [externalProviderHealthHistory, setExternalProviderHealthHistory] = useState<ExternalProviderHealthHistory | null>(null);
  const [externalProviderHealthHistoryWarehouse, setExternalProviderHealthHistoryWarehouse] = useState<ExternalProviderHealthHistory | null>(null);
  const [externalProviderHealthStorageStatus, setExternalProviderHealthStorageStatus] = useState<ExternalProviderHealthStorageStatus | null>(null);
  const [externalProviderStorageRotateLoading, setExternalProviderStorageRotateLoading] = useState(false);
  const [externalProviderHealthTrends, setExternalProviderHealthTrends] = useState<ExternalProviderHealthTrends | null>(null);
  const [externalProviderHealthFederationSummary, setExternalProviderHealthFederationSummary] = useState<ExternalProviderHealthFederationSummary | null>(null);
  const [externalProviderTrendWindowHours] = useState<'24' | '168' | '720'>('24');
  const [externalProviderTrendProvider] = useState('');
  const [externalProviderAlertMinEventCount] = useState('20');
  const [externalProviderAlertFailureThresholdPercent] = useState('25');
  const [externalProviderAlertEvaluationLoading, setExternalProviderAlertEvaluationLoading] = useState(false);
  const [externalProviderGovernanceExportLoading, setExternalProviderGovernanceExportLoading] = useState(false);
  const [externalProviderScorecardExportLoading, setExternalProviderScorecardExportLoading] = useState(false);
  const [externalProviderExecutivePacketExportLoading, setExternalProviderExecutivePacketExportLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const applyCache = (cache: AdminSessionAuditPresetCache) => {
      setAdminSessionAuditEventCategory(cache.eventCategory || 'AUTHENTICATION');
      setAdminSessionAuditOutcomeCode(cache.outcomeCode || '');
      setAdminSessionAuditFromLocal(cache.fromLocal || '');
      setAdminSessionAuditToLocal(cache.toLocal || '');
      setAdminSessionAuditPreset(cache.preset || 'custom');
    };

    const restoreSessionAuditPreset = async () => {
      if (!isAuthenticated) {
        return;
      }

      try {
        const presets = await getUserReportPresets(ADMIN_AUDIT_PRESET_SCOPE);
        const preset = presets.find((item) => item.presetName === ADMIN_AUDIT_PRESET_NAME) ?? presets[0] ?? null;
        if (!preset || isCancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as AdminSessionAuditPresetCache;
        applyCache(parsed);
      } catch {
        // Use in-memory defaults when persisted audit preset is unavailable.
      }
    };

    void restoreSessionAuditPreset();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const payload: AdminSessionAuditPresetCache = {
      eventCategory: adminSessionAuditEventCategory,
      outcomeCode: adminSessionAuditOutcomeCode,
      fromLocal: adminSessionAuditFromLocal,
      toLocal: adminSessionAuditToLocal,
      preset: adminSessionAuditPreset,
    };

    void upsertUserReportPreset(ADMIN_AUDIT_PRESET_SCOPE, {
      presetName: ADMIN_AUDIT_PRESET_NAME,
      presetJson: JSON.stringify(payload),
    });
  }, [
    adminSessionAuditEventCategory,
    adminSessionAuditOutcomeCode,
    adminSessionAuditFromLocal,
    adminSessionAuditToLocal,
    adminSessionAuditPreset,
    isAuthenticated,
  ]);

  useEffect(() => {
    localStorage.setItem(ADMIN_USER_BULK_IMPORT_HISTORY_LOCAL_KEY, JSON.stringify(adminUserBulkImportHistory));
  }, [adminUserBulkImportHistory]);

  const handleRefreshExternalProviderDiagnostics = async () => {
    try {
      setCopLiveOverlayDiagnosticsLoading(true);
      const trendWindowHours = Number(externalProviderTrendWindowHours);
      const [health, history, storage, trends, warehouseHistory, federationSummary] = await Promise.all([
        getExternalProviderHealth(),
        getExternalProviderHealthHistory(undefined, 25),
        getExternalProviderHealthStorageStatus(),
        getExternalProviderHealthTrends(externalProviderTrendProvider.trim() || undefined, trendWindowHours, 60),
        getExternalProviderHealthHistoryWarehouse(undefined, 25),
        getExternalProviderHealthFederationSummary(Number.isFinite(trendWindowHours) ? trendWindowHours : 24 * 30),
      ]);

      setExternalProviderHealth(health);
      setExternalProviderHealthHistory(history);
      setExternalProviderHealthHistoryWarehouse(warehouseHistory);
      setExternalProviderHealthStorageStatus(storage);
      setExternalProviderHealthTrends(trends);
      setExternalProviderHealthFederationSummary(federationSummary);
      onNotify('External provider diagnostics refreshed.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh external provider diagnostics.';
      onNotify(message, 'danger');
    } finally {
      setCopLiveOverlayDiagnosticsLoading(false);
    }
  };

  const handleExportSessionAuditEvidence = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before exporting session/auth audit evidence.', 'warning');
      return;
    }

    const normalizeLocalDateTime = (value: string): string | undefined => {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      const parsedMs = Date.parse(trimmed);
      return Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : undefined;
    };

    try {
      setAdminSessionAuditExportLoading(true);
      const blob = await exportAuditEventsCsv({
        eventCategory: adminSessionAuditEventCategory.trim() || undefined,
        outcomeCode: adminSessionAuditOutcomeCode.trim() || undefined,
        fromUtc: normalizeLocalDateTime(adminSessionAuditFromLocal),
        toUtc: normalizeLocalDateTime(adminSessionAuditToLocal),
        pageSize: 1000,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `admin-session-audit-evidence-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onNotify('Session/auth audit evidence exported.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export session/auth audit evidence.';
      onNotify(message, 'danger');
    } finally {
      setAdminSessionAuditExportLoading(false);
    }
  };

  const handleExportExternalProviderExecutivePacket = async () => {
    try {
      setExternalProviderExecutivePacketExportLoading(true);
      const trendWindowHours = Number(externalProviderTrendWindowHours);
      const rollingDays = Math.max(1, Math.round((Number.isFinite(trendWindowHours) ? trendWindowHours : 24 * 30) / 24));
      const blob = await exportExternalProviderHealthExecutivePacketZip(
        externalProviderTrendProvider.trim() || undefined,
        rollingDays,
        Number.isFinite(trendWindowHours) ? trendWindowHours : 24 * 30,
        60,
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `external-provider-executive-packet-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onNotify('External provider executive packet ZIP generated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export external provider executive packet ZIP.';
      onNotify(message, 'danger');
    } finally {
      setExternalProviderExecutivePacketExportLoading(false);
    }
  };

  const handleExportExternalProviderScorecard = async (format: 'csv' | 'json') => {
    try {
      setExternalProviderScorecardExportLoading(true);
      const trendWindowHours = Number(externalProviderTrendWindowHours);
      const rollingDays = Math.max(1, Math.round((Number.isFinite(trendWindowHours) ? trendWindowHours : 24 * 30) / 24));

      const blob = format === 'csv'
        ? await exportExternalProviderHealthScorecardCsv(externalProviderTrendProvider.trim() || undefined, rollingDays)
        : await exportExternalProviderHealthScorecardJson(externalProviderTrendProvider.trim() || undefined, rollingDays);

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `external-provider-scorecard-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onNotify(`External provider scorecard ${format.toUpperCase()} export generated.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to export external provider scorecard ${format.toUpperCase()}.`;
      onNotify(message, 'danger');
    } finally {
      setExternalProviderScorecardExportLoading(false);
    }
  };

  const handleExportExternalProviderGovernanceCsv = async () => {
    try {
      setExternalProviderGovernanceExportLoading(true);
      const trendWindowHours = Number(externalProviderTrendWindowHours);
      const blob = await exportExternalProviderHealthGovernanceCsv(
        externalProviderTrendProvider.trim() || undefined,
        Number.isFinite(trendWindowHours) ? trendWindowHours : 24 * 30,
        60,
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `external-provider-governance-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onNotify('External provider governance CSV export generated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export external provider governance CSV.';
      onNotify(message, 'danger');
    } finally {
      setExternalProviderGovernanceExportLoading(false);
    }
  };

  const handleEvaluateExternalProviderAlerts = async () => {
    try {
      setExternalProviderAlertEvaluationLoading(true);
      const trendWindowHours = Number(externalProviderTrendWindowHours);
      const minEventCount = Number(externalProviderAlertMinEventCount);
      const failureRateThreshold = Number(externalProviderAlertFailureThresholdPercent) / 100;

      const result = await evaluateExternalProviderHealthAlerts(
        externalProviderTrendProvider.trim() || undefined,
        trendWindowHours,
        Number.isFinite(minEventCount) ? minEventCount : 20,
        Number.isFinite(failureRateThreshold) ? failureRateThreshold : 0.25,
      );

      if (!result.evaluated) {
        onNotify(
          result.retryAfterSeconds
            ? `External provider alert evaluation is cooling down. Retry in ${result.retryAfterSeconds}s.`
            : 'External provider alert evaluation skipped.',
          'info');
        return;
      }

      if (result.createdAlertIds.length > 0) {
        onNotify(`Created ${result.createdAlertIds.length} external provider threshold alert(s).`, 'warning');
      } else {
        onNotify('No external provider threshold breaches detected for the selected window.', 'success');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to evaluate external provider health alerts.';
      onNotify(message, 'danger');
    } finally {
      setExternalProviderAlertEvaluationLoading(false);
    }
  };

  const handleRefreshExternalProviderTrends = async () => {
    try {
      setCopLiveOverlayDiagnosticsLoading(true);
      const trendWindowHours = Number(externalProviderTrendWindowHours);
      const [trends, federationSummary] = await Promise.all([
        getExternalProviderHealthTrends(externalProviderTrendProvider.trim() || undefined, trendWindowHours, 60),
        getExternalProviderHealthFederationSummary(Number.isFinite(trendWindowHours) ? trendWindowHours : 24 * 30),
      ]);
      setExternalProviderHealthTrends(trends);
      setExternalProviderHealthFederationSummary(federationSummary);
      onNotify('External provider telemetry trends refreshed.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh external provider telemetry trends.';
      onNotify(message, 'danger');
    } finally {
      setCopLiveOverlayDiagnosticsLoading(false);
    }
  };

  const handleRotateExternalProviderStorage = async () => {
    try {
      setExternalProviderStorageRotateLoading(true);
      const result = await rotateExternalProviderHealthStorage();
      const refreshedStorage = await getExternalProviderHealthStorageStatus();
      setExternalProviderHealthStorageStatus(refreshedStorage);

      if (result.succeeded) {
        onNotify(
          result.archiveFilePath
            ? `External provider telemetry storage rotated. Archive: ${result.archiveFilePath}`
            : result.message,
          'success');
      } else {
        onNotify(result.message, result.attempted ? 'warning' : 'info');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to rotate external provider telemetry storage.';
      onNotify(message, 'danger');
    } finally {
      setExternalProviderStorageRotateLoading(false);
    }
  };

  const handleStartSessionImpersonation = async (session: AdminUserSession) => {
    if (!isAuthenticated) {
      onNotify('Sign in before managing impersonation.', 'warning');
      return;
    }

    if (session.isImpersonationActive) {
      onNotify('Impersonation is already active for this session user.', 'warning');
      return;
    }

    try {
      setAdminSessionsLoading(true);
      await startAdminSessionImpersonation(session.userSessionId, session.userId, sessionImpersonationReason.trim() || undefined);
      await handleLoadAdminSessions(adminSessionsPageNumber);
      onNotify('Impersonation started and audited.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start impersonation.';
      onNotify(message, 'danger');
    } finally {
      setAdminSessionsLoading(false);
    }
  };

  const handleStopSessionImpersonation = async (session: AdminUserSession) => {
    if (!isAuthenticated) {
      onNotify('Sign in before managing impersonation.', 'warning');
      return;
    }

    if (!session.isImpersonationActive) {
      onNotify('No active impersonation is recorded for this session user.', 'warning');
      return;
    }

    try {
      setAdminSessionsLoading(true);
      await stopAdminSessionImpersonation(session.userSessionId, sessionImpersonationReason.trim() || undefined);
      await handleLoadAdminSessions(adminSessionsPageNumber);
      onNotify('Impersonation ended and audited.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to stop impersonation.';
      onNotify(message, 'danger');
    } finally {
      setAdminSessionsLoading(false);
    }
  };

  const handleRefreshCopLiveOverlayDiagnostics = async () => {
    try {
      setCopLiveOverlayDiagnosticsLoading(true);
      const [contract, readiness, feed] = await Promise.all([
        getCopLiveOverlayContract(),
        getCopLiveOverlayExternalReadiness(),
        getCopLiveOverlayFeed(),
      ]);

      setCopLiveOverlayContract(contract);
      setCopLiveOverlayExternalReadiness(readiness);
      setCopLiveOverlayFeedPreview(feed);
      onNotify('COP live overlay diagnostics refreshed.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh COP live overlay diagnostics.';
      onNotify(message, 'danger');
    } finally {
      setCopLiveOverlayDiagnosticsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadDataOpsState = async () => {
      try {
        const presets = await getUserReportPresets(ADMIN_DATA_OPS_SCOPE);
        const preset = presets.find((item) => item.presetName === ADMIN_DATA_OPS_PRESET) ?? presets[0] ?? null;
        if (!preset?.presetJson || cancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          lastDataOpsResult?: SyntheticDataResetResult;
          cacheUseRedisRequested?: boolean;
        };

        if (parsed.lastDataOpsResult) {
          setLastDataOpsResult(parsed.lastDataOpsResult);
        }

        if (typeof parsed.cacheUseRedisRequested === 'boolean') {
          setAdminCacheUseRedis(parsed.cacheUseRedisRequested);
          localStorage.setItem(ADMIN_CACHE_USE_REDIS_LOCAL_KEY, parsed.cacheUseRedisRequested ? 'true' : 'false');
        }
      } catch {
        const local = localStorage.getItem('ipoc.admin.dataops.lastResult');
        if (!local || cancelled) {
          const localCacheUseRedis = localStorage.getItem(ADMIN_CACHE_USE_REDIS_LOCAL_KEY);
          if (localCacheUseRedis === 'true') {
            setAdminCacheUseRedis(true);
          } else if (localCacheUseRedis === 'false') {
            setAdminCacheUseRedis(false);
          }
          return;
        }

        try {
          setLastDataOpsResult(JSON.parse(local) as SyntheticDataResetResult);
        } catch {
          // ignore invalid local snapshot
        }
      }
    };

    void loadDataOpsState();

    return () => {
      cancelled = true;
    };
  }, [ADMIN_CACHE_USE_REDIS_LOCAL_KEY, ADMIN_DATA_OPS_PRESET, ADMIN_DATA_OPS_SCOPE, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWeatherPreferenceHydrated(false);
      setWeatherPreferenceSaveStatus('idle');
      return;
    }

    let cancelled = false;
    setWeatherPreferenceHydrated(false);
    setWeatherPreferenceSaveStatus('loading');

    const applyWeatherPreference = (payload: {
      defaultLocationId?: number | null;
      defaultCity?: string | null;
      defaultState?: string | null;
      defaultPostalCode?: string | null;
    }) => {
      if (cancelled) {
        return;
      }

      setWeatherDefaultLocationIdInput(
        typeof payload.defaultLocationId === 'number' && Number.isFinite(payload.defaultLocationId) && payload.defaultLocationId > 0
          ? String(Math.round(payload.defaultLocationId))
          : '',
      );
      setWeatherDefaultCityInput(payload.defaultCity?.trim() ?? '');
      setWeatherDefaultStateInput(payload.defaultState?.trim() ?? '');
      setWeatherDefaultPostalCodeInput(payload.defaultPostalCode?.trim() ?? '');

      const normalized = {
        defaultLocationId: typeof payload.defaultLocationId === 'number' && Number.isFinite(payload.defaultLocationId) && payload.defaultLocationId > 0
          ? Math.round(payload.defaultLocationId)
          : null,
        defaultCity: payload.defaultCity?.trim() || null,
        defaultState: payload.defaultState?.trim() || null,
        defaultPostalCode: payload.defaultPostalCode?.trim() || null,
      };
      weatherPreferenceLastSavedRef.current = JSON.stringify(normalized);
      setWeatherPreferenceSavedAt(new Date().toISOString());
      setWeatherPreferenceSaveStatus('saved');
      setWeatherPreferenceHydrated(true);
    };

    const loadWeatherPreference = async () => {
      try {
        const presets = await getUserReportPresets(ADMIN_WEATHER_SCOPE);
        const preset = presets.find((item) => item.presetName === ADMIN_WEATHER_PRESET) ?? presets[0] ?? null;
        if (preset?.presetJson) {
          const parsed = JSON.parse(preset.presetJson) as {
            defaultLocationId?: number | null;
            defaultCity?: string | null;
            defaultState?: string | null;
            defaultPostalCode?: string | null;
          };
          applyWeatherPreference(parsed);
          return;
        }
      } catch {
        // fall back to local value below
      }

      const local = localStorage.getItem(WEATHER_DEFAULT_LOCAL_KEY);
      if (!local) {
        weatherPreferenceLastSavedRef.current = JSON.stringify({
          defaultLocationId: null,
          defaultCity: null,
          defaultState: null,
          defaultPostalCode: null,
        });
        setWeatherPreferenceSavedAt(null);
        setWeatherPreferenceSaveStatus('idle');
        setWeatherPreferenceHydrated(true);
        return;
      }

      try {
        const parsedLocal = JSON.parse(local) as {
          defaultLocationId?: number | null;
          defaultCity?: string | null;
          defaultState?: string | null;
          defaultPostalCode?: string | null;
        };
        applyWeatherPreference(parsedLocal);
      } catch {
        // ignore invalid local weather preference json
        weatherPreferenceLastSavedRef.current = JSON.stringify({
          defaultLocationId: null,
          defaultCity: null,
          defaultState: null,
          defaultPostalCode: null,
        });
        setWeatherPreferenceSavedAt(null);
        setWeatherPreferenceSaveStatus('idle');
        setWeatherPreferenceHydrated(true);
      }
    };

    void loadWeatherPreference();

    return () => {
      cancelled = true;
    };
  }, [ADMIN_WEATHER_PRESET, ADMIN_WEATHER_SCOPE, WEATHER_DEFAULT_LOCAL_KEY, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadAdminCacheMode = async () => {
      try {
        const state = await getAdminCacheMode();
        if (cancelled) {
          return;
        }

        setAdminCacheModeState(state);
        setAdminCacheUseRedis(state.cacheUseRedisRequested);
      } catch {
        // fallback remains readiness + local value
      }
    };

    void loadAdminCacheMode();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (lastDataOpsResult) {
      localStorage.setItem('ipoc.admin.dataops.lastResult', JSON.stringify(lastDataOpsResult));
    }

    if (adminCacheUseRedis !== null) {
      localStorage.setItem(ADMIN_CACHE_USE_REDIS_LOCAL_KEY, adminCacheUseRedis ? 'true' : 'false');
    }

    const timeoutId = window.setTimeout(() => {
      void upsertUserReportPreset(ADMIN_DATA_OPS_SCOPE, {
        presetName: ADMIN_DATA_OPS_PRESET,
        presetJson: JSON.stringify({
          lastDataOpsResult,
          cacheUseRedisRequested: adminCacheUseRedis,
        }),
      }).catch(() => {
        // keep local fallback
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ADMIN_CACHE_USE_REDIS_LOCAL_KEY, ADMIN_DATA_OPS_PRESET, ADMIN_DATA_OPS_SCOPE, adminCacheUseRedis, isAuthenticated, lastDataOpsResult]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!weatherPreferenceHydrated) {
      return;
    }

    const normalized = {
      defaultLocationId: (() => {
        const parsed = Number(weatherDefaultLocationIdInput);
        return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
      })(),
      defaultCity: weatherDefaultCityInput.trim() || null,
      defaultState: weatherDefaultStateInput.trim() || null,
      defaultPostalCode: weatherDefaultPostalCodeInput.trim() || null,
    };

    const serialized = JSON.stringify(normalized);
    if (weatherPreferenceLastSavedRef.current === serialized) {
      return;
    }

    setWeatherPreferenceSaveStatus('saving');

    localStorage.setItem(WEATHER_DEFAULT_LOCAL_KEY, serialized);

    const timeoutId = window.setTimeout(() => {
      void upsertUserReportPreset(ADMIN_WEATHER_SCOPE, {
        presetName: ADMIN_WEATHER_PRESET,
        presetJson: serialized,
      })
        .then(() => {
          weatherPreferenceLastSavedRef.current = serialized;
          setWeatherPreferenceSavedAt(new Date().toISOString());
          setWeatherPreferenceSaveStatus('saved');
        })
        .catch(() => {
          setWeatherPreferenceSaveStatus('error');
        });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    ADMIN_WEATHER_PRESET,
    ADMIN_WEATHER_SCOPE,
    WEATHER_DEFAULT_LOCAL_KEY,
    isAuthenticated,
    weatherPreferenceHydrated,
    weatherDefaultCityInput,
    weatherDefaultLocationIdInput,
    weatherDefaultPostalCodeInput,
    weatherDefaultStateInput,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      try {
        setDataOpsPreviewLoading(true);
        const preview = await getSyntheticDataPreview();
        if (!cancelled) {
          setDataOpsPreview(preview);
        }
      } catch {
        if (!cancelled) {
          setDataOpsPreview(null);
        }
      } finally {
        if (!cancelled) {
          setDataOpsPreviewLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, syntheticResetLoading, syntheticSeedLoading]);

  useEffect(() => {
    localStorage.setItem('ipoc.admin.dataMode', adminDataMode);
  }, [adminDataMode]);

  useEffect(() => {
    localStorage.setItem(API_TIMING_DEBUG_LOCAL_KEY, apiTimingDebugEnabled ? 'true' : 'false');
  }, [API_TIMING_DEBUG_LOCAL_KEY, apiTimingDebugEnabled]);

  const effectiveAdminCacheUseRedis = adminCacheModeState?.cacheUseRedisRequested ?? adminCacheUseRedis ?? Boolean(readiness?.cacheUseRedis);

  const runtimeCacheUseRedis = adminCacheModeState?.cacheUseRedisEffective ?? Boolean(readiness?.cacheUseRedis);
  const cacheModeRequiresRestart = adminCacheModeState?.requiresRestart ?? (effectiveAdminCacheUseRedis !== runtimeCacheUseRedis);
  const cacheDockerStartAttempted = adminCacheModeState?.dockerRedisStartAttempted ?? false;
  const cacheDockerStartSucceeded = adminCacheModeState?.dockerRedisStartSucceeded ?? false;
  const cacheDockerStartMessage = adminCacheModeState?.dockerRedisStartMessage ?? null;

  const handleSetAdminCacheMode = async (cacheUseRedisRequested: boolean) => {
    setAdminCacheUseRedis(cacheUseRedisRequested);

    if (!isAuthenticated) {
      return;
    }

    try {
      setAdminCacheModeSaving(true);
      const updatedState = await updateAdminCacheMode(cacheUseRedisRequested);
      setAdminCacheModeState(updatedState);

      if (updatedState.dockerRedisStartAttempted && updatedState.dockerRedisStartSucceeded) {
        onNotify(
          updatedState.requiresRestart
            ? 'Redis container startup command executed. Persisted mode is Redis; runtime provider swap still requires service-level runtime alignment.'
            : 'Redis container startup command executed and cache mode is aligned with active runtime provider.',
          updatedState.requiresRestart ? 'warning' : 'success');
        return;
      }

      if (updatedState.dockerRedisStartAttempted && !updatedState.dockerRedisStartSucceeded) {
        onNotify('Redis mode saved, but Docker startup command failed. Review admin cache detail for command output.', 'warning');
        return;
      }

      onNotify(
        updatedState.requiresRestart
          ? 'Cache mode preference saved. Runtime provider remains unchanged until process-level cache wiring is aligned.'
          : 'Cache mode preference saved and aligned with the active runtime cache provider.',
        updatedState.requiresRestart ? 'warning' : 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save cache mode preference.';
      onNotify(message, 'danger');
    } finally {
      setAdminCacheModeSaving(false);
    }
  };

  const diagnosticsStateRetainedForNextSlice = {
    copLiveOverlayContract,
    copLiveOverlayExternalReadiness,
    copLiveOverlayFeedPreview,
    externalProviderHealth,
    externalProviderHealthHistory,
    externalProviderHealthHistoryWarehouse,
    externalProviderHealthStorageStatus,
    externalProviderStorageRotateLoading,
    externalProviderHealthTrends,
    externalProviderHealthFederationSummary,
    externalProviderTrendWindowHours,
    externalProviderTrendProvider,
    externalProviderAlertMinEventCount,
    externalProviderAlertFailureThresholdPercent,
    externalProviderAlertEvaluationLoading,
    externalProviderGovernanceExportLoading,
    externalProviderScorecardExportLoading,
    externalProviderExecutivePacketExportLoading,
    handleRefreshExternalProviderDiagnostics,
    handleExportExternalProviderExecutivePacket,
    handleExportExternalProviderScorecard,
    handleExportExternalProviderGovernanceCsv,
    handleEvaluateExternalProviderAlerts,
    handleRefreshExternalProviderTrends,
    handleRotateExternalProviderStorage,
  };
  void diagnosticsStateRetainedForNextSlice;

  const dispatchDestinationPlaceholder = useMemo(() => {
    if (dispatchChannelCode === 'EMAIL') {
      return 'user@example.org';
    }

    if (dispatchChannelCode === 'SMS' || dispatchChannelCode === 'VOICE') {
      return '+15551234567';
    }

    return 'https://push.endpoint.example/device-token';
  }, [dispatchChannelCode]);

  const escalationDestinationPlaceholder = useMemo(() => {
    if (escalationChannelCodeInput === 'EMAIL') {
      return 'escalation@example.org';
    }

    if (escalationChannelCodeInput === 'SMS' || escalationChannelCodeInput === 'VOICE') {
      return '+15557654321';
    }

    return 'https://push.endpoint.example/device-token';
  }, [escalationChannelCodeInput]);

  const adminUsersTotalPages = Math.max(1, Math.ceil(adminUsersTotalCount / adminPageSize));
  const adminLocationsTotalPages = Math.max(1, Math.ceil(adminLocationsTotalCount / adminPageSize));
  const adminIcsPositionsTotalPages = Math.max(1, Math.ceil(adminIcsPositionsTotalCount / adminPageSize));
  const adminSessionsTotalPages = Math.max(1, Math.ceil(adminSessionsTotalCount / adminPageSize));

  const adminUsersGridRows = useMemo(() => adminUsers.map((user) => ({
    id: user.userId,
    displayName: user.displayName,
    emailAddress: user.emailAddress ?? '—',
    isActive: user.isActive,
    activeRoleCodes: user.activeRoleCodes,
    user,
  })), [adminUsers]);

  const adminUsersGridColumnDefs: ColDef<(typeof adminUsersGridRows)[number]>[] = useMemo(() => [
    { field: 'displayName', headerName: 'User', minWidth: 170, flex: 1.1 },
    { field: 'emailAddress', headerName: 'Email', minWidth: 220, flex: 1.4 },
    {
      field: 'isActive',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      valueFormatter: (params) => (params.value ? 'Active' : 'Inactive'),
      cellRenderer: (params: { value?: boolean }) => (
        <Badge bg={params.value ? 'success' : 'secondary'}>{params.value ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      field: 'activeRoleCodes',
      headerName: 'Roles',
      minWidth: 220,
      flex: 1.4,
      sortable: false,
      filter: false,
      cellRenderer: (params: { value?: string[] }) => {
        const roles = Array.isArray(params.value) ? params.value : [];
        if (roles.length === 0) {
          return <span className="small text-muted">No roles</span>;
        }

        return (
          <div className="d-flex flex-wrap gap-1">
            {roles.slice(0, 4).map((roleCode) => (
              <Badge key={`user-role-${roleCode}`} bg="secondary">{roleCode}</Badge>
            ))}
            {roles.length > 4 && <Badge bg="dark">+{roles.length - 4}</Badge>}
          </div>
        );
      },
    },
    {
      colId: 'action',
      headerName: 'Actions',
      minWidth: 170,
      maxWidth: 220,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof adminUsersGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div className="text-end d-inline-flex gap-1">
            <IconActionButton
              iconClassName="bi bi-shield-check"
              tooltip="Manage user roles"
              ariaLabel={`Manage roles for ${row.displayName}`}
              onClick={() => {
                void openAdminUserRoleEditor(row.user);
              }}
              disabled={adminUsersLoading || !isAuthenticated}
              variant="outline-primary"
            />
            <IconActionButton
              iconClassName={row.isActive ? 'bi bi-person-x' : 'bi bi-person-check'}
              tooltip={row.isActive ? 'Deactivate user' : 'Activate user'}
              ariaLabel={row.isActive ? `Deactivate user ${row.displayName}` : `Activate user ${row.displayName}`}
              onClick={() => {
                void handleToggleAdminUserActive(row.user);
              }}
              disabled={adminUsersLoading || !isAuthenticated}
              variant={row.isActive ? 'outline-warning' : 'outline-success'}
            />
          </div>
        );
      },
    },
  ], [adminUsersLoading, isAuthenticated]);

  const adminLocationsGridRows = useMemo(() => adminLocations.map((location) => ({
    id: location.locationId,
    locationName: location.locationName,
    organizationName: location.organizationName ?? '—',
    regionName: location.regionName ?? '—',
    latitude: location.latitude,
    longitude: location.longitude,
    cityName: location.cityName ?? '—',
    stateCode: location.stateCode ?? '—',
    postalCode: location.postalCode ?? '—',
    isActive: location.isActive,
    location,
  })), [adminLocations]);

  const adminLocationsGridColumnDefs: ColDef<(typeof adminLocationsGridRows)[number]>[] = useMemo(() => [
    { field: 'locationName', headerName: 'Facility', minWidth: 180, flex: 1.2 },
    { field: 'organizationName', headerName: 'Organization', minWidth: 170, flex: 1.1 },
    { field: 'regionName', headerName: 'Region', minWidth: 140, flex: 0.9 },
    {
      field: 'latitude',
      headerName: 'Latitude',
      minWidth: 130,
      flex: 0.8,
      valueFormatter: (params) => (typeof params.value === 'number' ? params.value.toFixed(5) : '—'),
    },
    {
      field: 'longitude',
      headerName: 'Longitude',
      minWidth: 130,
      flex: 0.8,
      valueFormatter: (params) => (typeof params.value === 'number' ? params.value.toFixed(5) : '—'),
    },
    { field: 'cityName', headerName: 'City', minWidth: 120, flex: 0.8 },
    { field: 'stateCode', headerName: 'State', minWidth: 90, flex: 0.6 },
    { field: 'postalCode', headerName: 'Postal', minWidth: 110, flex: 0.7 },
    {
      field: 'isActive',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      valueFormatter: (params) => (params.value ? 'Active' : 'Inactive'),
      cellRenderer: (params: { value?: boolean }) => (
        <Badge bg={params.value ? 'success' : 'secondary'}>{params.value ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      colId: 'action',
      headerName: 'Action',
      minWidth: 110,
      maxWidth: 140,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof adminLocationsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div className="text-end">
            <IconActionButton
              iconClassName={row.isActive ? 'bi bi-building-dash' : 'bi bi-building-check'}
              tooltip={row.isActive ? 'Deactivate facility' : 'Activate facility'}
              ariaLabel={row.isActive ? `Deactivate facility ${row.locationName}` : `Activate facility ${row.locationName}`}
              onClick={() => {
                void handleToggleAdminLocationActive(row.location);
              }}
              disabled={adminLocationsLoading || !isAuthenticated}
              variant={row.isActive ? 'outline-warning' : 'outline-success'}
            />
            <IconActionButton
              iconClassName="bi bi-geo-alt"
              tooltip="Edit facility geolocation"
              ariaLabel={`Edit facility geolocation for ${row.locationName}`}
              onClick={() => {
                handleOpenAdminLocationGeoModal(row.location);
              }}
              disabled={adminLocationsLoading || !isAuthenticated}
              variant="outline-primary"
            />
          </div>
        );
      },
    },
  ], [adminLocationsLoading, isAuthenticated]);

  const adminSessionsGridRows = useMemo(() => adminSessions.map((session) => ({
    id: session.userSessionId,
    displayName: session.displayName,
    emailAddress: session.emailAddress ?? '—',
    loginUtc: session.loginUtc,
    lastSeenUtc: session.lastSeenUtc,
    clientIpAddress: session.clientIpAddress ?? '—',
    mfaSatisfied: session.mfaSatisfied,
    isImpersonationActive: session.isImpersonationActive,
    impersonatingAdminDisplayName: session.impersonatingAdminDisplayName,
    impersonationStartedUtc: session.impersonationStartedUtc,
    session,
  })), [adminSessions]);

  const adminSessionsGridColumnDefs: ColDef<(typeof adminSessionsGridRows)[number]>[] = useMemo(() => [
    {
      field: 'displayName',
      headerName: 'User',
      minWidth: 210,
      flex: 1.3,
      cellRenderer: (params: { data?: (typeof adminSessionsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div>
            <div>{row.displayName}</div>
            <div className="small text-muted">{row.emailAddress}</div>
          </div>
        );
      },
    },
    {
      field: 'loginUtc',
      headerName: 'Login',
      minWidth: 170,
      flex: 1,
      valueFormatter: (params) => new Date(String(params.value)).toLocaleString(),
    },
    {
      field: 'lastSeenUtc',
      headerName: 'Last Seen',
      minWidth: 170,
      flex: 1,
      valueFormatter: (params) => (params.value ? new Date(String(params.value)).toLocaleString() : '—'),
    },
    { field: 'clientIpAddress', headerName: 'IP', minWidth: 130, flex: 0.9 },
    {
      field: 'mfaSatisfied',
      headerName: 'MFA',
      minWidth: 100,
      flex: 0.7,
      valueFormatter: (params) => (params.value ? 'Yes' : 'No'),
      cellRenderer: (params: { value?: boolean }) => (
        <Badge bg={params.value ? 'success' : 'warning'} text={params.value ? undefined : 'dark'}>
          {params.value ? 'Yes' : 'No'}
        </Badge>
      ),
    },
    {
      field: 'isImpersonationActive',
      headerName: 'Impersonation',
      minWidth: 190,
      flex: 1.1,
      cellRenderer: (params: { data?: (typeof adminSessionsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        if (!row.isImpersonationActive) {
          return <Badge bg="secondary">Inactive</Badge>;
        }

        return (
          <div>
            <Badge bg="warning" text="dark">Active</Badge>
            {row.impersonatingAdminDisplayName && (
              <div className="small text-muted">by {row.impersonatingAdminDisplayName}</div>
            )}
            {row.impersonationStartedUtc && (
              <div className="small text-muted">since {new Date(row.impersonationStartedUtc).toLocaleString()}</div>
            )}
          </div>
        );
      },
    },
    {
      colId: 'action',
      headerName: 'Action',
      minWidth: 190,
      maxWidth: 230,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof adminSessionsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div className="text-end">
            <IconActionButton
              iconClassName={row.isImpersonationActive ? 'bi bi-person-slash' : 'bi bi-person-badge'}
              tooltip={row.isImpersonationActive ? 'Stop impersonation' : 'Start impersonation'}
              ariaLabel={row.isImpersonationActive ? `Stop impersonation for ${row.displayName}` : `Start impersonation for ${row.displayName}`}
              onClick={() => {
                if (row.isImpersonationActive) {
                  void handleStopSessionImpersonation(row.session);
                  return;
                }

                void handleStartSessionImpersonation(row.session);
              }}
              disabled={adminSessionsLoading || !isAuthenticated}
              variant={row.isImpersonationActive ? 'outline-warning' : 'outline-primary'}
            />
            <IconActionButton
              iconClassName="bi bi-x-octagon"
              tooltip="Terminate session"
              ariaLabel={`Terminate session for ${row.displayName}`}
              onClick={() => {
                void handleTerminateSession(row.session);
              }}
              disabled={adminSessionsLoading || !isAuthenticated}
              variant="outline-danger"
            />
          </div>
        );
      },
    },
  ], [adminSessionsLoading, isAuthenticated]);

  const adminIcsPositionsGridRows = useMemo(() => adminIcsPositions.map((position) => ({
    id: position.icsPositionId,
    positionCode: position.positionCode,
    positionName: position.positionName,
    description: position.description,
    icsSection: position.icsSection,
    parentPositionCode: position.parentPositionCode ?? '—',
    sortOrder: position.sortOrder,
    isNimsStandard: position.isNimsStandard,
    position,
  })), [adminIcsPositions]);

  const adminIcsPositionsGridColumnDefs: ColDef<(typeof adminIcsPositionsGridRows)[number]>[] = useMemo(() => [
    { field: 'positionCode', headerName: 'Code', minWidth: 120, flex: 0.8 },
    {
      field: 'positionName',
      headerName: 'Name',
      minWidth: 220,
      flex: 1.4,
      cellRenderer: (params: { data?: (typeof adminIcsPositionsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div>
            <div>{row.positionName}</div>
            {row.description && <div className="small text-muted text-truncate" title={row.description}>{row.description}</div>}
          </div>
        );
      },
    },
    { field: 'icsSection', headerName: 'Section', minWidth: 130, flex: 0.9 },
    { field: 'parentPositionCode', headerName: 'Parent', minWidth: 120, flex: 0.8 },
    { field: 'sortOrder', headerName: 'Sort', minWidth: 90, flex: 0.6, type: 'numericColumn', cellClass: 'text-end' },
    {
      field: 'isNimsStandard',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      valueFormatter: (params) => (params.value ? 'NIMS' : 'Custom'),
      cellRenderer: (params: { value?: boolean }) => (
        <Badge bg={params.value ? 'primary' : 'secondary'}>{params.value ? 'NIMS' : 'Custom'}</Badge>
      ),
    },
    {
      colId: 'actions',
      headerName: 'Actions',
      minWidth: 140,
      maxWidth: 180,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof adminIcsPositionsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div className="d-inline-flex gap-2 justify-content-end w-100">
            <IconActionButton
              iconClassName="bi bi-pencil"
              tooltip="Edit ICS position"
              ariaLabel={`Edit ICS position ${row.positionCode}`}
              onClick={() => handlePopulateAdminIcsPositionEdit(row.position)}
              disabled={adminIcsPositionsLoading || !isAuthenticated}
              variant="outline-primary"
            />
            <IconActionButton
              iconClassName={row.isNimsStandard ? 'bi bi-slash-circle' : 'bi bi-check-circle'}
              tooltip={row.isNimsStandard ? 'Mark position as custom' : 'Mark position as NIMS standard'}
              ariaLabel={row.isNimsStandard ? `Mark ${row.positionCode} as custom` : `Mark ${row.positionCode} as NIMS standard`}
              onClick={() => {
                void handleToggleAdminIcsPositionStandard(row.position);
              }}
              disabled={adminIcsPositionsLoading || !isAuthenticated}
              variant={row.isNimsStandard ? 'outline-warning' : 'outline-success'}
            />
          </div>
        );
      },
    },
  ], [adminIcsPositionsLoading, isAuthenticated]);

  const notificationRecipientsGridRows = useMemo(() => notificationRecipients.map((recipient) => ({
    id: recipient.notificationRecipientId,
    destinationAddress: recipient.destinationAddress,
    userId: recipient.userId,
    contactId: recipient.contactId,
    locationId: recipient.locationId,
    channelCode: recipient.channelCode,
    deliveryStatusCode: recipient.deliveryStatusCode,
    recipient,
  })), [notificationRecipients]);

  const notificationRecipientsGridColumnDefs: ColDef<(typeof notificationRecipientsGridRows)[number]>[] = useMemo(() => [
    {
      field: 'destinationAddress',
      headerName: 'Recipient',
      minWidth: 260,
      flex: 1.6,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div>
            <div className="small">{row.destinationAddress}</div>
            <div className="text-muted small">U:{row.userId ?? '—'} C:{row.contactId ?? '—'} L:{row.locationId ?? '—'}</div>
          </div>
        );
      },
    },
    { field: 'channelCode', headerName: 'Channel', minWidth: 110, flex: 0.8 },
    {
      field: 'deliveryStatusCode',
      headerName: 'Status',
      minWidth: 140,
      flex: 1,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <Form.Select
            size="sm"
            value={recipientStatusSelection[row.id] ?? row.deliveryStatusCode}
            onChange={(event) => setRecipientStatusSelection((current) => ({
              ...current,
              [row.id]: event.target.value as UpdateRecipientDeliveryStatusRequest['deliveryStatusCode'],
            }))}
          >
            <option value="Queued">Queued</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
            <option value="Suppressed">Suppressed</option>
            <option value="Cancelled">Cancelled</option>
          </Form.Select>
        );
      },
    },
    {
      field: 'id',
      headerName: 'Failure Reason',
      minWidth: 170,
      flex: 1.2,
      sortable: false,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <Form.Control
            size="sm"
            value={recipientFailureReasonInput[row.id] ?? ''}
            onChange={(event) => setRecipientFailureReasonInput((current) => ({
              ...current,
              [row.id]: event.target.value,
            }))}
            placeholder="Optional for Failed"
          />
        );
      },
    },
    {
      field: 'id',
      headerName: 'Acknowledgment Note',
      minWidth: 170,
      flex: 1.2,
      sortable: false,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <Form.Control
            size="sm"
            value={recipientAcknowledgmentNoteInput[row.id] ?? ''}
            onChange={(event) => setRecipientAcknowledgmentNoteInput((current) => ({
              ...current,
              [row.id]: event.target.value,
            }))}
            placeholder="Ack note"
          />
        );
      },
    },
    {
      colId: 'actions',
      headerName: 'Actions',
      minWidth: 150,
      maxWidth: 190,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div className="d-flex justify-content-end gap-2">
            <IconActionButton
              iconClassName="bi bi-check2-square"
              tooltip="Update recipient delivery status"
              ariaLabel={`Update status for recipient ${row.id}`}
              onClick={() => {
                void handleUpdateRecipientStatus(row.recipient);
              }}
              disabled={notificationRecipientsLoading || !isAuthenticated}
              variant="outline-primary"
            />
            <IconActionButton
              iconClassName="bi bi-check2-circle"
              tooltip="Acknowledge recipient delivery"
              ariaLabel={`Acknowledge recipient ${row.id}`}
              onClick={() => {
                void handleAcknowledgeRecipient(row.recipient);
              }}
              disabled={notificationRecipientsLoading || !isAuthenticated}
              variant="outline-success"
            />
          </div>
        );
      },
    },
  ], [isAuthenticated, notificationRecipientsLoading, recipientAcknowledgmentNoteInput, recipientFailureReasonInput, recipientStatusSelection]);

  const runSyntheticReset = async () => {
    try {
      setSyntheticResetLoading(true);
      const result = await resetSyntheticLogisticsData();
      setLastDataOpsResult(result);
      onNotify(result.message, result.succeeded ? 'success' : 'warning');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reset synthetic logistics data.';
      onNotify(message, 'danger');
    } finally {
      setSyntheticResetLoading(false);
    }
  };

  const handleOpenAdminLocationGeoModal = (location: AdminLocation) => {
    setAdminLocationGeoEditing(location);
    setAdminLocationGeoLatitude(location.latitude !== null ? String(location.latitude) : '');
    setAdminLocationGeoLongitude(location.longitude !== null ? String(location.longitude) : '');
    setAdminLocationGeoCityName(location.cityName ?? '');
    setAdminLocationGeoStateCode(location.stateCode ?? '');
    setAdminLocationGeoPostalCode(location.postalCode ?? '');
    setAdminLocationGeoValidationErrors({});
    setAdminLocationGeocodeResult(null);
    setAdminLocationSnapshot(null);
    setAdminLocationSnapshotPromptText('');
    setShowAdminLocationGeoModal(true);

    void (async () => {
      try {
        setAdminLocationSnapshotLoading(true);
        const snapshot = await getAdminLocationSnapshot(location.locationId);
        setAdminLocationSnapshot(snapshot);
      } catch {
        setAdminLocationSnapshot(null);
      } finally {
        setAdminLocationSnapshotLoading(false);
      }
    })();
  };

  const handleSaveAdminLocationGeo = async () => {
    if (!isAuthenticated || !adminLocationGeoEditing) {
      onNotify('Sign in before managing facility geolocation.', 'warning');
      return;
    }

    const parsedLatitude = adminLocationGeoLatitude.trim().length > 0 ? Number(adminLocationGeoLatitude.trim()) : null;
    const parsedLongitude = adminLocationGeoLongitude.trim().length > 0 ? Number(adminLocationGeoLongitude.trim()) : null;

    const request: UpdateAdminLocationGeoRequest = {
      latitude: Number.isFinite(parsedLatitude ?? NaN) ? parsedLatitude : null,
      longitude: Number.isFinite(parsedLongitude ?? NaN) ? parsedLongitude : null,
      cityName: adminLocationGeoCityName.trim(),
      stateCode: adminLocationGeoStateCode.trim(),
      postalCode: adminLocationGeoPostalCode.trim(),
    };

    try {
      setAdminLocationGeoLoading(true);
      setAdminLocationGeoValidationErrors({});
      await updateAdminLocationGeo(adminLocationGeoEditing.locationId, request);
      const snapshot = await getAdminLocationSnapshot(adminLocationGeoEditing.locationId);
      setAdminLocationSnapshot(snapshot);
      await handleLoadAdminLocations(adminLocationsPageNumber);
      setShowAdminLocationGeoModal(false);
      onNotify('Facility geolocation saved.', 'success');
    } catch (error) {
      if (error instanceof ApiValidationError) {
        setAdminLocationGeoValidationErrors(error.validationErrors);
        onNotify('Please review facility geolocation validation errors.', 'warning');
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to save facility geolocation.';
      onNotify(message, 'danger');
    } finally {
      setAdminLocationGeoLoading(false);
    }
  };

  const handleGeocodeAdminLocation = async () => {
    if (!isAuthenticated || !adminLocationGeoEditing) {
      onNotify('Sign in before geocoding facility metadata.', 'warning');
      return;
    }

    try {
      setAdminLocationGeoLoading(true);
      const result = await geocodeAdminLocation(adminLocationGeoEditing.locationId, {
        cityName: adminLocationGeoCityName.trim(),
        stateCode: adminLocationGeoStateCode.trim(),
        postalCode: adminLocationGeoPostalCode.trim(),
        locationName: adminLocationGeoEditing.locationName,
      });

      setAdminLocationGeocodeResult(result);
      setAdminLocationGeoLatitude(String(result.latitude));
      setAdminLocationGeoLongitude(String(result.longitude));
      onNotify(`Geocode resolved (${result.geocodeSource}) with confidence ${Math.round(result.confidenceScore * 100)}%.`, 'info');
    } catch (error) {
      if (error instanceof ApiValidationError) {
        setAdminLocationGeoValidationErrors(error.validationErrors);
        onNotify('Please review geocode request validation errors.', 'warning');
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to geocode facility metadata.';
      onNotify(message, 'danger');
    } finally {
      setAdminLocationGeoLoading(false);
    }
  };

  const runSyntheticSeed = async () => {
    try {
      setSyntheticSeedLoading(true);
      const result = await seedSyntheticLogisticsData();
      setLastDataOpsResult(result);
      onNotify(result.message, result.succeeded ? 'success' : 'warning');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to seed synthetic logistics data.';
      onNotify(message, 'danger');
    } finally {
      setSyntheticSeedLoading(false);
    }
  };

  const openDataOpsConfirmModal = (action: 'seed' | 'reset') => {
    setPendingDataOpsAction(action);
    setDataOpsAckInput('');
    setShowDataOpsConfirmModal(true);
  };

  const handleSeedSyntheticData = async () => {
    openDataOpsConfirmModal('seed');
  };

  const handleResetSyntheticData = async () => {
    openDataOpsConfirmModal('reset');
  };

  const closeDataOpsConfirmModal = () => {
    if (syntheticSeedLoading || syntheticResetLoading) {
      return;
    }

    setShowDataOpsConfirmModal(false);
    setPendingDataOpsAction(null);
    setDataOpsAckInput('');
  };

  const expectedDataOpsAck = pendingDataOpsAction === 'seed'
    ? 'SEED SYNTHETIC'
    : pendingDataOpsAction === 'reset'
      ? 'RESET SYNTHETIC'
      : '';

  const isDataOpsAckValid = expectedDataOpsAck.length > 0 && dataOpsAckInput.trim().toUpperCase() === expectedDataOpsAck;

  const confirmDataOpsAction = async () => {
    if (!pendingDataOpsAction || !isDataOpsAckValid) {
      return;
    }

    if (pendingDataOpsAction === 'seed') {
      await runSyntheticSeed();
    } else {
      await runSyntheticReset();
    }

    setShowDataOpsConfirmModal(false);
    setPendingDataOpsAction(null);
    setDataOpsAckInput('');
  };

  const handleCopySyntheticResetCommand = async () => {
    const command = '.\\Initialize-Database.ps1 -ConnectionString "<YOUR_CONNECTION_STRING>" -ResetSyntheticLogisticsData';

    try {
      await navigator.clipboard.writeText(command);
      onNotify('Synthetic reset command copied to clipboard.', 'success');
    } catch {
      onNotify('Unable to copy command. Use Database_Seed_Reset_Runbook.md manually.', 'warning');
    }
  };

  const icsHierarchyTree = useMemo(() => {
    const byCode = new Map<string, AdminIcsPosition>();
    adminIcsPositions.forEach((position) => {
      byCode.set(position.positionCode, position);
    });

    const nodesByCode = new Map<string, IcsHierarchyNode>();
    adminIcsPositions.forEach((position) => {
      nodesByCode.set(position.positionCode, { position, children: [] });
    });

    const roots: IcsHierarchyNode[] = [];

    nodesByCode.forEach((node) => {
      const parentCode = node.position.parentPositionCode;
      if (!parentCode) {
        roots.push(node);
        return;
      }

      const parent = byCode.get(parentCode);
      const parentNode = parent ? nodesByCode.get(parent.positionCode) : null;
      if (!parentNode) {
        roots.push(node);
        return;
      }

      parentNode.children.push(node);
    });

    const sortNodes = (nodes: IcsHierarchyNode[]) => {
      nodes.sort((left, right) => {
        if (left.position.sortOrder !== right.position.sortOrder) {
          return left.position.sortOrder - right.position.sortOrder;
        }

        return left.position.positionName.localeCompare(right.position.positionName);
      });

      nodes.forEach((node) => sortNodes(node.children));
    };

    sortNodes(roots);
    return roots;
  }, [adminIcsPositions]);

  const renderIcsHierarchyNode = (node: IcsHierarchyNode) => {
    return (
      <li key={node.position.icsPositionId} className="small">
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="fw-semibold">{node.position.positionCode}</span>
          <span>{node.position.positionName}</span>
          <Badge bg={node.position.isNimsStandard ? 'primary' : 'secondary'}>
            {node.position.isNimsStandard ? 'NIMS' : 'Custom'}
          </Badge>
        </div>
        <div className="text-muted ms-1 mb-1">{node.position.icsSection}</div>
        {node.children.length > 0 && (
          <ul className="ps-3 mb-1">
            {node.children.map((childNode) => renderIcsHierarchyNode(childNode))}
          </ul>
        )}
      </li>
    );
  };

  const handleLoadTokenDebug = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before loading token debug claims.', 'warning');
      return;
    }

    try {
      setTokenDebugLoading(true);
      const payload = await getAuthTokenDebug();
      setTokenDebug(payload);
      onNotify('Token debug claims loaded.', 'success');
    } catch (debugError) {
      const message = debugError instanceof Error ? debugError.message : 'Unable to load token debug claims.';
      onNotify(message, 'danger');
    } finally {
      setTokenDebugLoading(false);
    }
  };

  const handleDispatchCommunication = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before dispatching communications.', 'warning');
      return;
    }

    if (dispatchSubject.trim().length === 0 || dispatchMessageBody.trim().length === 0) {
      onNotify('Dispatch subject and message body are required.', 'warning');
      return;
    }

    if (dispatchDestinationAddress.trim().length === 0) {
      onNotify('Recipient destination address is required.', 'warning');
      return;
    }

    const parsedUserId = Number.parseInt(dispatchUserId, 10);
    const parsedContactId = Number.parseInt(dispatchContactId, 10);
    const parsedLocationId = Number.parseInt(dispatchLocationId, 10);
    const parsedIncidentId = Number.parseInt(dispatchIncidentId, 10);

    const hasUserId = Number.isFinite(parsedUserId) && parsedUserId > 0;
    const hasContactId = Number.isFinite(parsedContactId) && parsedContactId > 0;
    const hasLocationId = Number.isFinite(parsedLocationId) && parsedLocationId > 0;

    if (!hasUserId && !hasContactId && !hasLocationId) {
      onNotify('Provide at least one recipient principal id (user/contact/location).', 'warning');
      return;
    }

    const request: CreateCommunicationDispatchRequest = {
      incidentId: Number.isFinite(parsedIncidentId) && parsedIncidentId > 0 ? parsedIncidentId : undefined,
      notificationTypeCode: dispatchNotificationTypeCode.trim().toUpperCase(),
      subject: dispatchSubject.trim(),
      messageBody: dispatchMessageBody.trim(),
      priorityCode: dispatchPriorityCode,
      recipients: [
        {
          userId: hasUserId ? parsedUserId : undefined,
          contactId: hasContactId ? parsedContactId : undefined,
          locationId: hasLocationId ? parsedLocationId : undefined,
          channelCode: dispatchChannelCode,
          destinationAddress: dispatchDestinationAddress.trim(),
        },
      ],
    };

    try {
      setDispatchLoading(true);
      const result = await createCommunicationDispatch(request);
      setDispatchResult(result);
      setRecipientLookupNotificationId(result.notificationId.toString());
      onNotify(`Communication dispatched: #${result.notificationId}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to dispatch communication.';
      onNotify(message, 'danger');
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleLoadNotificationRecipients = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before loading notification recipients.', 'warning');
      return;
    }

    const parsedNotificationId = Number.parseInt(recipientLookupNotificationId, 10);
    if (!Number.isFinite(parsedNotificationId) || parsedNotificationId <= 0) {
      onNotify('Enter a valid notification id to load recipients.', 'warning');
      return;
    }

    try {
      setNotificationRecipientsLoading(true);
      const recipients = await getNotificationRecipients(parsedNotificationId);
      setNotificationRecipients(recipients);

      const nextStatuses: Record<number, UpdateRecipientDeliveryStatusRequest['deliveryStatusCode']> = {};
      const nextFailureReasons: Record<number, string> = {};
      const nextAckNotes: Record<number, string> = {};

      recipients.forEach((recipient) => {
        nextStatuses[recipient.notificationRecipientId] = recipient.deliveryStatusCode;
        nextFailureReasons[recipient.notificationRecipientId] = recipient.failureReason ?? '';
        nextAckNotes[recipient.notificationRecipientId] = '';
      });

      setRecipientStatusSelection(nextStatuses);
      setRecipientFailureReasonInput(nextFailureReasons);
      setRecipientAcknowledgmentNoteInput(nextAckNotes);
      onNotify(`Loaded ${recipients.length} recipient record(s).`, 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load notification recipients.';
      onNotify(message, 'danger');
    } finally {
      setNotificationRecipientsLoading(false);
    }
  };

  const handleUpdateRecipientStatus = async (recipient: NotificationRecipient) => {
    const selectedStatus = recipientStatusSelection[recipient.notificationRecipientId] ?? recipient.deliveryStatusCode;
    const failureReason = recipientFailureReasonInput[recipient.notificationRecipientId]?.trim();

    try {
      setNotificationRecipientsLoading(true);
      await updateNotificationRecipientDeliveryStatus(recipient.notificationId, recipient.notificationRecipientId, {
        deliveryStatusCode: selectedStatus,
        failureReason: selectedStatus === 'Failed' ? (failureReason || undefined) : undefined,
      });
      await handleLoadNotificationRecipients();
      onNotify('Recipient delivery status updated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update recipient delivery status.';
      onNotify(message, 'danger');
    } finally {
      setNotificationRecipientsLoading(false);
    }
  };

  const handleAcknowledgeRecipient = async (recipient: NotificationRecipient) => {
    const acknowledgmentNote = recipientAcknowledgmentNoteInput[recipient.notificationRecipientId]?.trim();

    try {
      setNotificationRecipientsLoading(true);
      await acknowledgeNotificationRecipient(recipient.notificationId, recipient.notificationRecipientId, {
        acknowledgmentNote: acknowledgmentNote.length > 0 ? acknowledgmentNote : undefined,
      });
      await handleLoadNotificationRecipients();
      onNotify('Recipient delivery acknowledged.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to acknowledge recipient.';
      onNotify(message, 'danger');
    } finally {
      setNotificationRecipientsLoading(false);
    }
  };

  const handleEscalateNotification = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before escalating notifications.', 'warning');
      return;
    }

    const parsedNotificationId = Number.parseInt(escalateNotificationIdInput, 10);
    if (!Number.isFinite(parsedNotificationId) || parsedNotificationId <= 0) {
      onNotify('Enter a valid notification id to escalate.', 'warning');
      return;
    }

    if (escalationReasonInput.trim().length === 0 || escalationDestinationAddressInput.trim().length === 0) {
      onNotify('Escalation reason and destination address are required.', 'warning');
      return;
    }

    try {
      setEscalationLoading(true);
      const result = await escalateNotification(parsedNotificationId, {
        escalationReason: escalationReasonInput.trim(),
        escalationChannelCode: escalationChannelCodeInput,
        escalationDestinationAddress: escalationDestinationAddressInput.trim(),
      });
      setEscalationResult(result);
      setRecipientLookupNotificationId(result.escalatedNotificationId.toString());
      onNotify(`Notification escalated to #${result.escalatedNotificationId}.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to escalate notification.';
      onNotify(message, 'danger');
    } finally {
      setEscalationLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (activeTab === 'users' && adminRoles.length === 0 && !adminRolesLoading) {
      void handleLoadAdminRoles();
    }

    if (activeTab === 'users' && adminUsers.length === 0 && !adminUsersLoading) {
      void handleLoadAdminUsers(1);
    }

    if (activeTab === 'facilities-admin' && adminLocations.length === 0 && !adminLocationsLoading) {
      void handleLoadAdminLocations(1);
    }

    if (activeTab === 'ics-positions-admin' && adminIcsPositions.length === 0 && !adminIcsPositionsLoading) {
      void handleLoadAdminIcsPositions(1);
    }

    if (activeTab === 'session-admin' && adminSessions.length === 0 && !adminSessionsLoading) {
      void handleLoadAdminSessions(1);
    }
  }, [
    activeTab,
    isAuthenticated,
    adminRoles.length,
    adminRolesLoading,
    adminUsers.length,
    adminUsersLoading,
    adminLocations.length,
    adminLocationsLoading,
    adminIcsPositions.length,
    adminIcsPositionsLoading,
    adminSessions.length,
    adminSessionsLoading,
  ]);

  const handleLoadAdminSessions = async (requestedPageNumber?: number) => {
    if (!isAuthenticated) {
      onNotify('Sign in before loading sessions.', 'warning');
      return;
    }

    try {
      setAdminSessionsLoading(true);
      const targetPageNumber = requestedPageNumber ?? adminSessionsPageNumber;
      const result = await getAdminActiveSessions({
        search: adminSessionsSearch.trim() || undefined,
        pageNumber: targetPageNumber,
        pageSize: adminPageSize,
      });
      setAdminSessions(result.items);
      setAdminSessionsTotalCount(result.totalCount);
      setAdminSessionsPageNumber(result.pageNumber);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load active sessions.';
      onNotify(message, 'danger');
    } finally {
      setAdminSessionsLoading(false);
    }
  };

  const handleTerminateSession = async (session: AdminUserSession) => {
    if (!isAuthenticated) {
      onNotify('Sign in before managing sessions.', 'warning');
      return;
    }

    try {
      setAdminSessionsLoading(true);
      await terminateAdminSession(session.userSessionId, sessionTerminationReason.trim() || undefined);
      await handleLoadAdminSessions(adminSessionsPageNumber);
      onNotify('Session terminated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to terminate session.';
      onNotify(message, 'danger');
    } finally {
      setAdminSessionsLoading(false);
    }
  };

  const handleLoadAdminLocations = async (requestedPageNumber?: number) => {
    if (!isAuthenticated) {
      onNotify('Sign in before loading facilities.', 'warning');
      return;
    }

    try {
      setAdminLocationsLoading(true);
      const targetPageNumber = requestedPageNumber ?? adminLocationsPageNumber;
      const result = await getAdminLocations({
        search: adminLocationsSearch.trim() || undefined,
        isActive: adminLocationsStatusFilter === 'all' ? undefined : adminLocationsStatusFilter === 'active',
        pageNumber: targetPageNumber,
        pageSize: adminPageSize,
      });
      setAdminLocations(result.items);
      setAdminLocationsTotalCount(result.totalCount);
      setAdminLocationsPageNumber(result.pageNumber);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load facilities.';
      onNotify(message, 'danger');
    } finally {
      setAdminLocationsLoading(false);
    }
  };

  const handleToggleAdminLocationActive = async (location: AdminLocation) => {
    if (!isAuthenticated) {
      onNotify('Sign in before managing facilities.', 'warning');
      return;
    }

    try {
      setAdminLocationsLoading(true);
      await updateAdminLocationActiveStatus(location.locationId, !location.isActive);
      await handleLoadAdminLocations(adminLocationsPageNumber);
      onNotify(location.isActive ? 'Facility deactivated.' : 'Facility activated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update facility status.';
      onNotify(message, 'danger');
    } finally {
      setAdminLocationsLoading(false);
    }
  };

  const handleLoadAdminUsers = async (requestedPageNumber?: number) => {
    if (!isAuthenticated) {
      onNotify('Sign in before loading users.', 'warning');
      return;
    }

    try {
      setAdminUsersLoading(true);
      const targetPageNumber = requestedPageNumber ?? adminUsersPageNumber;
      const result = await getAdminUsers({
        search: adminUsersSearch.trim() || undefined,
        isActive: adminUsersStatusFilter === 'all' ? undefined : adminUsersStatusFilter === 'active',
        pageNumber: targetPageNumber,
        pageSize: adminPageSize,
      });
      setAdminUsers(result.items);
      setAdminUsersTotalCount(result.totalCount);
      setAdminUsersPageNumber(result.pageNumber);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load admin users.';
      onNotify(message, 'danger');
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const resetAdminIcsPositionForm = () => {
    setAdminIcsPositionEditId(null);
    setAdminIcsPositionPositionCode('');
    setAdminIcsPositionPositionName('');
    setAdminIcsPositionSection('');
    setAdminIcsPositionParentCode('');
    setAdminIcsPositionSortOrder('100');
    setAdminIcsPositionDescription('');
    setAdminIcsPositionIsStandard(true);
    setAdminIcsPositionValidationErrors({});
    setAdminIcsPositionSaveMessage(null);
  };

  const focusFirstAdminIcsPositionValidationField = (validationErrors: Record<string, string[]>) => {
    if (validationErrors.positionCode?.length) {
      adminIcsPositionCodeInputRef.current?.focus();
      return;
    }

    if (validationErrors.positionName?.length) {
      adminIcsPositionNameInputRef.current?.focus();
      return;
    }

    if (validationErrors.icsSection?.length) {
      adminIcsPositionSectionInputRef.current?.focus();
      return;
    }

    if (validationErrors.parentPositionCode?.length) {
      adminIcsPositionParentCodeInputRef.current?.focus();
      return;
    }

    if (validationErrors.sortOrder?.length) {
      adminIcsPositionSortOrderInputRef.current?.focus();
      return;
    }

    if (validationErrors.description?.length) {
      adminIcsPositionDescriptionInputRef.current?.focus();
    }
  };

  const handleLoadAdminIcsPositions = async (requestedPageNumber?: number) => {
    if (!isAuthenticated) {
      onNotify('Sign in before loading ICS positions.', 'warning');
      return;
    }

    try {
      setAdminIcsPositionsLoading(true);
      const targetPageNumber = requestedPageNumber ?? adminIcsPositionsPageNumber;
      const result = await getAdminIcsPositions({
        search: adminIcsPositionsSearch.trim() || undefined,
        isNimsStandard: adminIcsPositionsStandardFilter === 'all' ? undefined : adminIcsPositionsStandardFilter === 'standard',
        pageNumber: targetPageNumber,
        pageSize: adminPageSize,
      });
      setAdminIcsPositions(result.items);
      setAdminIcsPositionsTotalCount(result.totalCount);
      setAdminIcsPositionsPageNumber(result.pageNumber);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load ICS positions.';
      onNotify(message, 'danger');
    } finally {
      setAdminIcsPositionsLoading(false);
    }
  };

  const handlePopulateAdminIcsPositionEdit = (position: AdminIcsPosition) => {
    setAdminIcsPositionEditId(position.icsPositionId);
    setAdminIcsPositionPositionCode(position.positionCode);
    setAdminIcsPositionPositionName(position.positionName);
    setAdminIcsPositionSection(position.icsSection);
    setAdminIcsPositionParentCode(position.parentPositionCode ?? '');
    setAdminIcsPositionSortOrder(position.sortOrder.toString());
    setAdminIcsPositionDescription(position.description ?? '');
    setAdminIcsPositionIsStandard(position.isNimsStandard);
    setAdminIcsPositionValidationErrors({});
    setAdminIcsPositionSaveMessage(null);
  };

  const handleSaveAdminIcsPosition = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before managing ICS positions.', 'warning');
      return;
    }

    const positionCode = adminIcsPositionPositionCode.trim().toUpperCase();
    const positionName = adminIcsPositionPositionName.trim();
    const icsSection = adminIcsPositionSection.trim();
    const parentPositionCode = adminIcsPositionParentCode.trim().length > 0 ? adminIcsPositionParentCode.trim().toUpperCase() : undefined;
    const description = adminIcsPositionDescription.trim().length > 0 ? adminIcsPositionDescription.trim() : undefined;
    const parsedSortOrder = Number.parseInt(adminIcsPositionSortOrder, 10);
    const sortOrder = Number.isFinite(parsedSortOrder) ? parsedSortOrder : undefined;

    if (!positionCode && adminIcsPositionEditId === null) {
      onNotify('Position code is required.', 'warning');
      return;
    }

    if (positionName.length === 0) {
      onNotify('Position name is required.', 'warning');
      return;
    }

    if (icsSection.length === 0) {
      onNotify('ICS section is required.', 'warning');
      return;
    }

    if (sortOrder !== undefined && sortOrder < 0) {
      onNotify('Sort order cannot be negative.', 'warning');
      return;
    }

    try {
      setAdminIcsPositionValidationErrors({});
      setAdminIcsPositionsLoading(true);

      const wasCreate = adminIcsPositionEditId === null;

      if (wasCreate) {
        const createRequest: CreateAdminIcsPositionRequest = {
          positionCode,
          positionName,
          icsSection,
          parentPositionCode,
          sortOrder,
          description,
          isNimsStandard: adminIcsPositionIsStandard,
        };
        await createAdminIcsPosition(createRequest);
        onNotify('ICS position created.', 'success');
      } else {
        const updateRequest: UpdateAdminIcsPositionRequest = {
          positionName,
          icsSection,
          parentPositionCode,
          sortOrder,
          description,
          isNimsStandard: adminIcsPositionIsStandard,
        };
        await updateAdminIcsPosition(adminIcsPositionEditId, updateRequest);
        onNotify('ICS position updated.', 'success');
      }

      resetAdminIcsPositionForm();
      await handleLoadAdminIcsPositions(adminIcsPositionsPageNumber);
      setAdminIcsPositionSaveMessage(`${wasCreate ? 'Created' : 'Updated'} and refreshed at ${new Date().toLocaleTimeString()}.`);
    } catch (error) {
      if (error instanceof ApiValidationError) {
        setAdminIcsPositionValidationErrors(error.validationErrors);
        setAdminIcsPositionSaveMessage(null);
        focusFirstAdminIcsPositionValidationField(error.validationErrors);
        onNotify('Please review ICS position form validation errors.', 'warning');
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to save ICS position.';
      onNotify(message, 'danger');
    } finally {
      setAdminIcsPositionsLoading(false);
    }
  };

  const handleToggleAdminIcsPositionStandard = async (position: AdminIcsPosition) => {
    if (!isAuthenticated) {
      onNotify('Sign in before managing ICS positions.', 'warning');
      return;
    }

    try {
      setAdminIcsPositionsLoading(true);
      await updateAdminIcsPositionNimsStandardStatus(position.icsPositionId, !position.isNimsStandard);
      await handleLoadAdminIcsPositions(adminIcsPositionsPageNumber);
      onNotify(position.isNimsStandard ? 'ICS position marked custom.' : 'ICS position marked NIMS standard.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update ICS position status.';
      onNotify(message, 'danger');
    } finally {
      setAdminIcsPositionsLoading(false);
    }
  };

  const handleToggleAdminUserActive = async (user: AdminUser) => {
    if (!isAuthenticated) {
      onNotify('Sign in before managing users.', 'warning');
      return;
    }

    try {
      setAdminUsersLoading(true);
      await updateAdminUserActiveStatus(user.userId, !user.isActive);
      await handleLoadAdminUsers(adminUsersPageNumber);
      onNotify(user.isActive ? 'User deactivated.' : 'User activated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update user status.';
      onNotify(message, 'danger');
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const handleDownloadResourceRejectReport = async () => {
    if (!resourceCsvFile) {
      onNotify('Select a resource inventory CSV file first.', 'warning');
      return;
    }

    try {
      setImportLoading(true);
      const csv = await downloadResourceInventoryRejectReportCsv(resourceCsvFile, sourceSystemCode.trim(), sourceMessageId.trim() || undefined);
      downloadCsv('resource-import-reject-report.csv', csv);
      onNotify('Resource reject report downloaded.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download resource reject report.';
      onNotify(message, 'danger');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadBedRejectReport = async () => {
    if (!bedCsvFile) {
      onNotify('Select a bed availability CSV file first.', 'warning');
      return;
    }

    try {
      setImportLoading(true);
      const csv = await downloadBedAvailabilityRejectReportCsv(bedCsvFile, sourceSystemCode.trim(), sourceMessageId.trim() || undefined);
      downloadCsv('bed-import-reject-report.csv', csv);
      onNotify('Bed reject report downloaded.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download bed reject report.';
      onNotify(message, 'danger');
    } finally {
      setImportLoading(false);
    }
  };

  const handleUploadStreamPayload = async () => {
    if (!streamUploadFile) {
      onNotify('Select a stream payload JSON file first.', 'warning');
      return;
    }

    try {
      setStreamingLoading(true);
      const uploadResult = await uploadStreamingPayload(streamUploadFile);
      setStreamingStatus(uploadResult.status);
      onNotify(`Stream payload uploaded: ${uploadResult.fileName}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to upload stream payload.';
      onNotify(message, 'danger');
    } finally {
      setStreamingLoading(false);
    }
  };

  const handleRefreshStreamingStatus = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before checking streaming status.', 'warning');
      return;
    }

    try {
      setStreamingLoading(true);
      const status = await getStreamingIngestionStatus();
      setStreamingStatus(status);
      if (!streamDirectory) {
        setStreamDirectory(status.streamDirectory);
      }
      setStreamPollIntervalSeconds(status.pollIntervalSeconds.toString());
      setStreamSourceSystemCode(status.defaultSourceSystemCode);
      setStreamWatcherEnabled(status.fileWatcherEnabled);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load streaming status.';
      onNotify(message, 'danger');
    } finally {
      setStreamingLoading(false);
    }
  };

  const handleStartStreaming = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before starting streaming ingestion.', 'warning');
      return;
    }

    const parsedInterval = Number.parseInt(streamPollIntervalSeconds, 10);
    const request: StartStreamingIngestionRequest = {
      streamDirectory: streamDirectory.trim().length > 0 ? streamDirectory.trim() : undefined,
      pollIntervalSeconds: Number.isFinite(parsedInterval) ? parsedInterval : undefined,
      enableFileWatcher: streamWatcherEnabled,
      defaultSourceSystemCode: streamSourceSystemCode.trim().length > 0 ? streamSourceSystemCode.trim() : undefined,
    };

    try {
      setStreamingLoading(true);
      const status = await startStreamingIngestion(request);
      setStreamingStatus(status);
      onNotify('Streaming ingestion started from Admin workspace.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start streaming ingestion.';
      onNotify(message, 'danger');
    } finally {
      setStreamingLoading(false);
    }
  };

  const handleStopStreaming = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before stopping streaming ingestion.', 'warning');
      return;
    }

    try {
      setStreamingLoading(true);
      const status = await stopStreamingIngestion();
      setStreamingStatus(status);
      onNotify('Streaming ingestion stopped.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to stop streaming ingestion.';
      onNotify(message, 'danger');
    } finally {
      setStreamingLoading(false);
    }
  };

  const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportResourceCsv = async () => {
    if (!resourceCsvFile) {
      onNotify('Select a resource inventory CSV file first.', 'warning');
      return;
    }

    try {
      setImportLoading(true);
      const result = await importResourceInventoryCsv(resourceCsvFile, sourceSystemCode.trim(), sourceMessageId.trim() || undefined);
      setResourceImportResult(result);
      onNotify(`Resource inventory import completed. Success: ${result.result.succeededRows}; Failed: ${result.result.failedRows}; Rejected: ${result.rejects.length}.`, result.result.failedRows === 0 && result.rejects.length === 0 ? 'success' : 'warning');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to import resource CSV.';
      onNotify(message, 'danger');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportBedCsv = async () => {
    if (!bedCsvFile) {
      onNotify('Select a bed availability CSV file first.', 'warning');
      return;
    }

    try {
      setImportLoading(true);
      const result = await importBedAvailabilityCsv(bedCsvFile, sourceSystemCode.trim(), sourceMessageId.trim() || undefined);
      setBedImportResult(result);
      onNotify(`Bed availability import completed. Success: ${result.result.succeededRows}; Failed: ${result.result.failedRows}; Rejected: ${result.rejects.length}.`, result.result.failedRows === 0 && result.rejects.length === 0 ? 'success' : 'warning');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to import bed CSV.';
      onNotify(message, 'danger');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportFhir = async () => {
    if (fhirJsonInput.trim().length === 0) {
      onNotify('Paste a FHIR bundle JSON payload first.', 'warning');
      return;
    }

    try {
      setFhirLoading(true);
      const result = await importFhirBedAvailability(fhirJsonInput, sourceSystemCode.trim(), sourceMessageId.trim() || undefined);
      setFhirResult(result);
      onNotify(`FHIR import completed. Success: ${result.result.succeededRows}; Failed: ${result.result.failedRows}; Rejected: ${result.rejectedCount}.`, result.result.failedRows === 0 ? 'success' : 'warning');
    } catch (error) {
      if (error instanceof ApiValidationError) {
        const firstValidationError = Object.values(error.validationErrors).flat()[0];
        onNotify(firstValidationError ?? error.message, 'warning');
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to import FHIR payload.';
      onNotify(message, 'danger');
    } finally {
      setFhirLoading(false);
    }
  };

  const handleLoadFhirAdapterContract = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setFhirAdapterContractLoading(true);
      const contract = await getFhirBedAvailabilityAdapterContract();
      setFhirAdapterContract(contract);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load FHIR adapter contract.';
      onNotify(message, 'danger');
    } finally {
      setFhirAdapterContractLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'fhir' || !isAuthenticated || fhirAdapterContractLoading || fhirAdapterContract) {
      return;
    }

    void handleLoadFhirAdapterContract();
  }, [activeTab, fhirAdapterContract, fhirAdapterContractLoading, isAuthenticated]);

  return (
    <Card className="shadow-sm border-light-subtle h-100 ipoc-admin-workspace-card">
      <Card.Header className="fw-semibold d-flex justify-content-between align-items-center">
        <span>Administration Workspace</span>
        <Badge bg={readiness?.status === 'Healthy' ? 'success' : 'danger'}>{readiness?.status ?? 'Unknown'}</Badge>
      </Card.Header>
      <Card.Body className="ipoc-admin-workspace-body">
        <div className="ipoc-admin-tabs-vertical-layout">
          <Tabs
            activeKey={activeTab}
            onSelect={(eventKey) => setActiveTab(eventKey ?? 'general')}
            id="admin-workspace-tabs"
            className="ipoc-admin-tabs"
            mountOnEnter
            unmountOnExit={false}
          >
          <Tab eventKey="general" title={renderAdminTabTitle('bi bi-speedometer2', 'General')}>
            <ListGroup>
              <ListGroup.Item>
                <div className="fw-semibold">Environment</div>
                <div className="small text-muted">{readiness?.environment ?? 'n/a'}</div>
              </ListGroup.Item>
              <ListGroup.Item>
                <div className="fw-semibold">SQL Connectivity</div>
                <div className="small text-muted">{readiness?.sqlConnectionConfigured ? 'Configured' : 'Missing'} (ConnectionStrings:IocEm)</div>
              </ListGroup.Item>
              <ListGroup.Item>
                <div className="fw-semibold">Degraded Read Fallback</div>
                <div className="small text-muted">{readiness?.degradedReadFallbackEnabled ? 'Enabled' : 'Disabled'}</div>
              </ListGroup.Item>
              <ListGroup.Item>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="fw-semibold">Cache</div>
                  <Badge bg={effectiveAdminCacheUseRedis ? 'success' : 'secondary'}>
                    {effectiveAdminCacheUseRedis ? 'Redis Enabled' : 'In-Memory Enabled'}
                  </Badge>
                </div>
                <div className="small text-muted mt-1">
                  Toggle whether application cache should use Redis (Docker-hosted) or local in-memory output cache.
                </div>
                <div className="small text-muted mt-1">
                  Requested mode: <strong>{effectiveAdminCacheUseRedis ? 'Redis' : 'In-Memory'}</strong> · Runtime mode: <strong>{runtimeCacheUseRedis ? 'Redis' : 'In-Memory'}</strong>
                </div>
                {cacheModeRequiresRestart && (
                  <div className="small text-muted mt-1">
                    Runtime mismatch detected. Restart services after config sync (`Cache:UseRedis`) to apply the requested mode.
                  </div>
                )}
                {cacheDockerStartAttempted && (
                  <div className={`small mt-1 ${cacheDockerStartSucceeded ? 'text-success' : 'text-danger'}`}>
                    Docker Redis startup attempt: {cacheDockerStartSucceeded ? 'succeeded' : 'failed'}.
                    {cacheDockerStartMessage && (
                      <span className="d-block">{cacheDockerStartMessage}</span>
                    )}
                  </div>
                )}
                <div className="d-flex flex-wrap gap-3 mt-2">
                  <Form.Check
                    type="radio"
                    id="admin-cache-mode-redis"
                    name="admin-cache-mode"
                    label="Use Redis cache"
                    checked={effectiveAdminCacheUseRedis}
                    onChange={() => {
                      void handleSetAdminCacheMode(true);
                    }}
                    disabled={adminCacheModeSaving}
                    data-testid="admin-cache-mode-redis"
                  />
                  <Form.Check
                    type="radio"
                    id="admin-cache-mode-memory"
                    name="admin-cache-mode"
                    label="Use in-memory cache"
                    checked={!effectiveAdminCacheUseRedis}
                    onChange={() => {
                      void handleSetAdminCacheMode(false);
                    }}
                    disabled={adminCacheModeSaving}
                    data-testid="admin-cache-mode-memory"
                  />
                </div>
              </ListGroup.Item>

              <ListGroup.Item>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="fw-semibold">Data Mode</div>
                  <Badge bg={adminDataMode === 'demo' ? 'warning' : 'success'}>
                    {adminDataMode === 'demo' ? 'Demo/Synthetic' : 'Live/Operational'}
                  </Badge>
                </div>
                <div className="small text-muted mt-1">Select the operator mode for admin workflows. This does not change backend connection strings.</div>
                <div className="d-flex flex-wrap gap-3 mt-2">
                  <Form.Check
                    type="radio"
                    id="admin-data-mode-live"
                    name="admin-data-mode"
                    label="Live data mode"
                    checked={adminDataMode === 'live'}
                    onChange={() => setAdminDataMode('live')}
                  />
                  <Form.Check
                    type="radio"
                    id="admin-data-mode-demo"
                    name="admin-data-mode"
                    label="Demo/synthetic mode"
                    checked={adminDataMode === 'demo'}
                    onChange={() => setAdminDataMode('demo')}
                  />
                </div>
                <div className="small text-muted mt-2">
                  Backend readiness: SQL {readiness?.sqlConnectionConfigured ? 'configured' : 'missing'}; Redis cache {readiness?.cacheUseRedis ? 'enabled' : 'disabled'}.
                </div>
                <div className="small text-muted mt-1">
                  Synthetic reset endpoint: {readiness?.adminDataOpsScriptExecutionEnabled ? 'enabled' : 'disabled'} (Development-gated)
                </div>
                <ListGroup className="mt-2">
                  <ListGroup.Item className="small d-flex justify-content-between">
                    <span>Synthetic locations</span>
                    <strong>{dataOpsPreviewLoading ? '...' : (dataOpsPreview?.syntheticLocationCount ?? 'n/a')}</strong>
                  </ListGroup.Item>
                  <ListGroup.Item className="small d-flex justify-content-between">
                    <span>Synthetic inventory rows</span>
                    <strong>{dataOpsPreviewLoading ? '...' : (dataOpsPreview?.syntheticInventoryCount ?? 'n/a')}</strong>
                  </ListGroup.Item>
                  <ListGroup.Item className="small d-flex justify-content-between">
                    <span>Synthetic bed snapshots</span>
                    <strong>{dataOpsPreviewLoading ? '...' : (dataOpsPreview?.syntheticBedSnapshotCount ?? 'n/a')}</strong>
                  </ListGroup.Item>
                  <ListGroup.Item className="small d-flex justify-content-between">
                    <span>Synthetic incident requests</span>
                    <strong>{dataOpsPreviewLoading ? '...' : (dataOpsPreview?.syntheticIncidentRequestCount ?? 'n/a')}</strong>
                  </ListGroup.Item>
                </ListGroup>
                <div className="mt-2">
                  <div className="d-inline-flex gap-2">
                    <IconActionButton
                      iconClassName="bi bi-clipboard"
                      tooltip="Copy synthetic-data reset command"
                      ariaLabel="Copy synthetic-data reset command"
                      onClick={() => {
                        void handleCopySyntheticResetCommand();
                      }}
                      variant="outline-secondary"
                    />
                    <IconActionButton
                      iconClassName={syntheticSeedLoading ? 'bi bi-arrow-repeat' : 'bi bi-database-add'}
                      tooltip="Run synthetic-data seed now (Development only)"
                      ariaLabel="Run synthetic-data seed now"
                      onClick={() => {
                        void handleSeedSyntheticData();
                      }}
                      variant="outline-success"
                      disabled={syntheticSeedLoading || adminDataMode !== 'demo' || !Boolean(readiness?.adminDataOpsScriptExecutionEnabled)}
                    />
                    <IconActionButton
                      iconClassName={syntheticResetLoading ? 'bi bi-arrow-repeat' : 'bi bi-trash3'}
                      tooltip="Run synthetic-data reset now (Development only)"
                      ariaLabel="Run synthetic-data reset now"
                      onClick={() => {
                        void handleResetSyntheticData();
                      }}
                      variant="outline-warning"
                      disabled={syntheticResetLoading || adminDataMode !== 'demo' || !Boolean(readiness?.adminDataOpsScriptExecutionEnabled)}
                    />
                  </div>
                </div>
                <div className="small fw-semibold mt-2">Last DataOps operation</div>
                {lastDataOpsResult ? (
                  <ListGroup className="mt-1">
                    <ListGroup.Item className="small d-flex justify-content-between">
                      <span>Operation</span>
                      <strong>{lastDataOpsResult.operationCode.toUpperCase()}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item className="small d-flex justify-content-between">
                      <span>Outcome</span>
                      <strong>{lastDataOpsResult.outcome}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item className="small d-flex justify-content-between">
                      <span>Exit code</span>
                      <strong>{lastDataOpsResult.exitCode}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item className="small d-flex justify-content-between">
                      <span>Actor user id</span>
                      <strong>{lastDataOpsResult.actorUserId ?? 'n/a'}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item className="small d-flex justify-content-between">
                      <span>Trace id</span>
                      <strong>{lastDataOpsResult.traceId}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item className="small d-flex justify-content-between">
                      <span>Executed UTC</span>
                      <strong>{lastDataOpsResult.executedUtc}</strong>
                    </ListGroup.Item>
                  </ListGroup>
                ) : (
                  <div className="small text-muted mt-1">No data-ops execution telemetry captured yet.</div>
                )}
              </ListGroup.Item>
              <ListGroup.Item>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="fw-semibold">API Performance Timing Logs</div>
                  <Badge bg={apiTimingDebugEnabled ? 'info' : 'secondary'}>
                    {apiTimingDebugEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="small text-muted mt-1">
                  Admin-only local toggle for frontend API timing logs. When enabled, browser console shows request method, status, and elapsed ms.
                </div>
                <div className="small text-muted mt-1">
                  Scope: this browser only (`localStorage: {API_TIMING_DEBUG_LOCAL_KEY}`).
                </div>
                <div className="mt-2">
                  <Form.Check
                    type="switch"
                    id="admin-api-timing-debug-enabled"
                    label="Enable API timing debug logs"
                    checked={apiTimingDebugEnabled}
                    onChange={(event) => {
                      setApiTimingDebugEnabled(event.target.checked);
                    }}
                  />
                </div>
              </ListGroup.Item>
              <ListGroup.Item>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="fw-semibold">Default Weather Feed Location</div>
                  <span className="d-inline-flex gap-2 align-items-center">
                    <Badge bg="secondary">Dashboard fallback</Badge>
                    <Badge bg={
                      weatherPreferenceSaveStatus === 'saving' || weatherPreferenceSaveStatus === 'loading'
                        ? 'info'
                        : weatherPreferenceSaveStatus === 'saved'
                          ? 'success'
                          : weatherPreferenceSaveStatus === 'error'
                            ? 'danger'
                            : 'secondary'
                    }>
                      {weatherPreferenceSaveStatus === 'loading'
                        ? 'Loading saved defaults'
                        : weatherPreferenceSaveStatus === 'saving'
                          ? 'Saving'
                          : weatherPreferenceSaveStatus === 'saved'
                            ? 'Saved'
                            : weatherPreferenceSaveStatus === 'error'
                              ? 'Save failed'
                              : 'Not saved'}
                    </Badge>
                  </span>
                </div>
                <div className="small text-muted mt-1">
                  Used when selected incident context does not resolve weather coordinates. Incident location still has highest priority.
                </div>
                <div className="small text-muted mt-1">
                  {weatherPreferenceSaveStatus === 'saved'
                    ? `Defaults saved ${weatherPreferenceSavedAt ? new Date(weatherPreferenceSavedAt).toLocaleString() : 'just now'}.`
                    : weatherPreferenceSaveStatus === 'saving' || weatherPreferenceSaveStatus === 'loading'
                      ? 'Persisting weather defaults…'
                      : weatherPreferenceSaveStatus === 'error'
                        ? 'Unable to persist to server. Local fallback was retained and will retry on next change.'
                        : 'Update any field to persist fallback defaults automatically.'}
                </div>
                <div className="row g-2 mt-1">
                  <div className="col-md-3">
                    <Form.Label className="small text-muted mb-1">Default Location ID</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={weatherDefaultLocationIdInput}
                      onChange={(event) => setWeatherDefaultLocationIdInput(event.target.value)}
                      placeholder="e.g. 1001"
                    />
                  </div>
                  <div className="col-md-3">
                    <Form.Label className="small text-muted mb-1">Default City</Form.Label>
                    <Form.Control
                      value={weatherDefaultCityInput}
                      onChange={(event) => setWeatherDefaultCityInput(event.target.value)}
                      placeholder="e.g. Denver"
                    />
                  </div>
                  <div className="col-md-3">
                    <Form.Label className="small text-muted mb-1">Default State</Form.Label>
                    <Form.Control
                      value={weatherDefaultStateInput}
                      onChange={(event) => setWeatherDefaultStateInput(event.target.value)}
                      placeholder="e.g. CO"
                    />
                  </div>
                  <div className="col-md-3">
                    <Form.Label className="small text-muted mb-1">Default Postal Code</Form.Label>
                    <Form.Control
                      value={weatherDefaultPostalCodeInput}
                      onChange={(event) => setWeatherDefaultPostalCodeInput(event.target.value)}
                      placeholder="e.g. 80203"
                    />
                  </div>
                </div>
              </ListGroup.Item>
              <ListGroup.Item>
                <div className="fw-semibold mb-2">Feature rollback notice</div>
                <div className="small text-muted">
                  The previous no-code authoring implementation has been removed from this build.
                </div>
              </ListGroup.Item>

              <ListGroup.Item>
                <div className="fw-semibold mb-2">Notification Controls</div>
                <div className="small text-muted mb-2">Control which notifications show as toast and which are routed into Alert Center.</div>
                <div className="row g-2">
                  <div className="col-md-6">
                    <Form.Check
                      type="switch"
                      id="admin-notify-toast-enabled"
                      label="Enable toast popups"
                      checked={notificationSettings.toastEnabled}
                      onChange={(event) => onSetToastEnabled(event.target.checked)}
                    />
                  </div>
                  <div className="col-md-6">
                    <Form.Check
                      type="switch"
                      id="admin-notify-alert-feed-enabled"
                      label="Enable Alert Center feed"
                      checked={notificationSettings.alertFeedEnabled}
                      onChange={(event) => onSetAlertFeedEnabled(event.target.checked)}
                    />
                  </div>
                </div>
                <div className="small fw-semibold mt-3 mb-1">Enabled notification types</div>
                <div className="d-flex flex-wrap gap-3">
                  <Form.Check
                    type="checkbox"
                    id="admin-notify-variant-success"
                    label="Success"
                    checked={notificationSettings.enabledVariants.success}
                    onChange={(event) => onSetNotificationVariantEnabled('success', event.target.checked)}
                  />
                  <Form.Check
                    type="checkbox"
                    id="admin-notify-variant-danger"
                    label="Error"
                    checked={notificationSettings.enabledVariants.danger}
                    onChange={(event) => onSetNotificationVariantEnabled('danger', event.target.checked)}
                  />
                  <Form.Check
                    type="checkbox"
                    id="admin-notify-variant-warning"
                    label="Warning"
                    checked={notificationSettings.enabledVariants.warning}
                    onChange={(event) => onSetNotificationVariantEnabled('warning', event.target.checked)}
                  />
                  <Form.Check
                    type="checkbox"
                    id="admin-notify-variant-info"
                    label="Info"
                    checked={notificationSettings.enabledVariants.info}
                    onChange={(event) => onSetNotificationVariantEnabled('info', event.target.checked)}
                  />
                </div>
                <div className="small fw-semibold mt-3 mb-1">Enabled alert statuses</div>
                <div className="d-flex flex-wrap gap-3">
                  <Form.Check
                    type="checkbox"
                    id="admin-notify-status-new"
                    label="New"
                    checked={notificationSettings.enabledStatuses.new}
                    onChange={(event) => onSetNotificationStatusEnabled('new', event.target.checked)}
                  />
                  <Form.Check
                    type="checkbox"
                    id="admin-notify-status-ack"
                    label="Acknowledged"
                    checked={notificationSettings.enabledStatuses.acknowledged}
                    onChange={(event) => onSetNotificationStatusEnabled('acknowledged', event.target.checked)}
                  />
                </div>
              </ListGroup.Item>

              <ListGroup.Item>
                <div className="fw-semibold d-flex justify-content-between align-items-center">
                  <span>COP live overlay diagnostics</span>
                  <IconActionButton
                    iconClassName="bi bi-arrow-clockwise"
                    tooltip="Refresh COP contract, readiness probe, provider trends, and federation diagnostics."
                    ariaLabel="Refresh COP live overlay diagnostics"
                    onClick={() => {
                      void handleRefreshCopLiveOverlayDiagnostics();
                    }}
                    disabled={copLiveOverlayDiagnosticsLoading}
                    variant={copLiveOverlayDiagnosticsLoading ? 'secondary' : 'outline-secondary'}
                  />
                </div>
                <div className="small text-muted mt-1">
                  Validate external feed contract and runtime status side-by-side before go-live.
                </div>
                <div className="small text-muted mt-1">
                  Provider telemetry health and recent failure/bypass history are available below.
                </div>
              </ListGroup.Item>

              <ListGroup.Item>
                <div className="small text-muted mb-2">Diagnostics tooling remains available for clearer admin operations.</div>
                <div className="small text-muted">
                  Detailed overlay diagnostics remain available in the Security & Auth and COP tooling paths.
                </div>
              </ListGroup.Item>
            </ListGroup>
          </Tab>

          <Tab eventKey="security" title={renderAdminTabTitle('bi bi-shield-lock', 'Security & Auth')}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold">Auth Scope Check</div>
              <Badge bg={authMe?.isAuthenticated ? 'success' : 'secondary'}>{authMe?.isAuthenticated ? 'Signed In' : 'Not Signed In'}</Badge>
            </div>
            {authMeError && <div className="small text-muted mb-2">{authMeError}</div>}
            {!authMeError && authMe && <div className="small text-muted mb-2">{authMe.scopes.length > 0 ? authMe.scopes.join(', ') : 'No scopes in token'}</div>}
            <IconActionButton
              iconClassName="bi bi-shield-lock"
              tooltip={tokenDebugLoading ? 'Loading token claims...' : 'Load token debug claims'}
              ariaLabel="Load token debug claims"
              onClick={() => void handleLoadTokenDebug()}
              disabled={tokenDebugLoading}
            />
            {tokenDebug && (
              <div className="small text-muted mt-2">
                <div>aud: {tokenDebug.audience ?? 'n/a'}</div>
                <div>iss: {tokenDebug.issuer ?? 'n/a'}</div>
                <div>scopes: {tokenDebug.scopes.length > 0 ? tokenDebug.scopes.join(', ') : 'none'}</div>
                <div>roles: {tokenDebug.roles.length > 0 ? tokenDebug.roles.join(', ') : 'none'}</div>
              </div>
            )}
            <div className="small text-muted mt-3">
              redirectUri={authDiagnostics.redirectUri}; origin={authDiagnostics.currentOrigin}; tenantConfigured={String(authDiagnostics.tenantConfigured)}; clientConfigured={String(authDiagnostics.clientConfigured)}; apiScopeConfigured={String(authDiagnostics.apiScopeConfigured)}.
            </div>
          </Tab>

          <Tab eventKey="lookups" title={renderAdminTabTitle('bi bi-list-check', 'Lookup Management')}>
            <LookupAdminCard isAuthenticated={isAuthenticated} onNotify={onNotify} />
          </Tab>

          <Tab eventKey="users" title={renderAdminTabTitle('bi bi-people', 'User Admin')}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="small text-muted">Create users and manage active lifecycle status.</div>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="secondary">{adminUsersTotalCount} total</Badge>
                <IconActionButton
                  iconClassName="bi bi-arrow-clockwise"
                  tooltip={adminUsersLoading ? 'Loading users...' : 'Refresh admin users'}
                  ariaLabel="Refresh admin users"
                  onClick={() => void handleLoadAdminUsers()}
                  disabled={adminUsersLoading || !isAuthenticated}
                />
              </div>
            </div>

            <Card className="border-0 bg-body-tertiary mb-3">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2">Create user</div>
                <div className="small text-muted mb-2">
                  Quick create uses display name/email and auto-generates identity placeholders. Use advanced UPN and Entra Object ID only when pre-provisioning against a known identity record.
                </div>
                <div className="row g-2">
                  <div className="col-md-3">
                    <Form.Group>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Display name" info="Required full name shown in user administration lists and assignment selectors." /></Form.Label>
                      <Form.Control
                        value={adminUserCreateDisplayName}
                        onChange={(event) => setAdminUserCreateDisplayName(event.target.value)}
                        placeholder="e.g., Jordan Analyst"
                        isInvalid={Boolean(adminUserCreateValidationErrors.displayName?.length)}
                      />
                      {adminUserCreateValidationErrors.displayName?.length ? (
                        <Form.Control.Feedback type="invalid">
                          {adminUserCreateValidationErrors.displayName[0]}
                        </Form.Control.Feedback>
                      ) : null}
                    </Form.Group>
                  </div>
                  <div className="col-md-3">
                    <Form.Group>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Email" info="Optional contact email used for identity context and notification workflows." /> <span className="text-muted">(optional)</span></Form.Label>
                      <Form.Control
                        value={adminUserCreateEmailAddress}
                        onChange={(event) => setAdminUserCreateEmailAddress(event.target.value)}
                        placeholder="user@organization.org"
                        isInvalid={Boolean(adminUserCreateValidationErrors.emailAddress?.length)}
                      />
                      {adminUserCreateValidationErrors.emailAddress?.length ? (
                        <Form.Control.Feedback type="invalid">
                          {adminUserCreateValidationErrors.emailAddress[0]}
                        </Form.Control.Feedback>
                      ) : null}
                    </Form.Group>
                  </div>
                  <div className="col-md-3">
                    <Form.Group>
                      <Form.Label className="small mb-1"><LabelWithInfo text="UPN" info="Advanced optional Entra user principal name for pre-provisioned identity alignment." /> <span className="text-muted">(advanced, optional)</span></Form.Label>
                      <Form.Control
                        value={adminUserCreateUpn}
                        onChange={(event) => setAdminUserCreateUpn(event.target.value)}
                        placeholder="user@tenant.onmicrosoft.com"
                        isInvalid={Boolean(adminUserCreateValidationErrors.userPrincipalName?.length)}
                      />
                      {adminUserCreateValidationErrors.userPrincipalName?.length ? (
                        <Form.Control.Feedback type="invalid">
                          {adminUserCreateValidationErrors.userPrincipalName[0]}
                        </Form.Control.Feedback>
                      ) : null}
                    </Form.Group>
                  </div>
                  <div className="col-md-2">
                    <Form.Group>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Initial status" info="Set whether the new user is created as active or inactive at provisioning time." /></Form.Label>
                      <Form.Select
                        value={adminUserCreateIsActive ? 'active' : 'inactive'}
                        onChange={(event) => setAdminUserCreateIsActive(event.target.value === 'active')}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </Form.Select>
                    </Form.Group>
                  </div>
                  <div className="col-md-1 d-flex align-items-end">
                    <IconActionButton
                      iconClassName="bi bi-person-plus"
                      tooltip="Create user"
                      ariaLabel="Create user"
                      onClick={() => {
                        void handleCreateAdminUser();
                      }}
                      disabled={adminUsersLoading || !isAuthenticated || adminUserCreateDisplayName.trim().length === 0}
                      variant="outline-primary"
                    />
                  </div>
                  <div className="col-md-12">
                    <Form.Group>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Entra Object ID" info="Advanced optional Entra directory object identifier used when linking to an existing identity record." /> <span className="text-muted">(advanced, optional)</span></Form.Label>
                      <Form.Control
                        value={adminUserCreateEntraObjectId}
                        onChange={(event) => setAdminUserCreateEntraObjectId(event.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000"
                        isInvalid={Boolean(adminUserCreateValidationErrors.entraObjectId?.length)}
                      />
                      {adminUserCreateValidationErrors.entraObjectId?.length ? (
                        <Form.Control.Feedback type="invalid">
                          {adminUserCreateValidationErrors.entraObjectId[0]}
                        </Form.Control.Feedback>
                      ) : null}
                    </Form.Group>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card className="border-0 bg-body-tertiary mb-3">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2">Bulk user import (CSV)</div>
                <div className="small text-muted mb-2">
                  Import multiple users in one operation and optionally assign roles per row using <code>roleCodes</code> separated by <code>|</code>.
                </div>

                <div className="row g-2 align-items-end">
                  <div className="col-md-8">
                    <Form.Group>
                      <Form.Label className="small mb-1"><LabelWithInfo text="User import CSV" info="Upload CSV with columns: displayName, emailAddress, userPrincipalName, entraObjectId, isActive, roleCodes. roleCodes supports pipe-delimited values such as SYSTEM_ADMIN|CONTRIBUTOR." /></Form.Label>
                      <Form.Control
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(event) => setAdminUserBulkCsvFile((event.target as HTMLInputElement).files?.[0] ?? null)}
                        data-testid="admin-user-bulk-import-file-input"
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-2">
                    <Form.Group>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Source system" info="Producer code recorded with import telemetry for traceability and replay diagnostics." /></Form.Label>
                      <Form.Control
                        value={adminUserBulkSourceSystemCode}
                        onChange={(event) => setAdminUserBulkSourceSystemCode(event.target.value)}
                        placeholder="ADMIN_USER_IMPORT"
                        data-testid="admin-user-bulk-import-source-system"
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-2">
                    <Form.Group>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Source message ID" info="Optional idempotency and run-correlation identifier for import evidence replay." /> <span className="text-muted">(optional)</span></Form.Label>
                      <Form.Control
                        value={adminUserBulkSourceMessageId}
                        onChange={(event) => setAdminUserBulkSourceMessageId(event.target.value)}
                        placeholder="BULK-IMPORT-001"
                        data-testid="admin-user-bulk-import-source-message-id"
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-12 d-flex align-items-end justify-content-end gap-2">
                    <Form.Check
                      type="switch"
                      id="admin-user-bulk-import-update-existing"
                      label="Update existing users"
                      checked={adminUserBulkUpdateExisting}
                      onChange={(event) => setAdminUserBulkUpdateExisting(event.target.checked)}
                      disabled={adminUserBulkLoading || !isAuthenticated}
                      data-testid="admin-user-bulk-import-update-existing"
                    />
                    <IconActionButton
                      iconClassName="bi bi-download"
                      tooltip="Download bulk user CSV template"
                      ariaLabel="Download bulk user CSV template"
                      onClick={handleDownloadAdminUserBulkTemplate}
                      variant="outline-secondary"
                      disabled={adminUserBulkLoading}
                    />
                    <IconActionButton
                      iconClassName="bi bi-upload"
                      tooltip="Import user CSV"
                      ariaLabel="Import user CSV"
                      onClick={() => {
                        void handleImportAdminUsersCsv();
                      }}
                      variant="outline-primary"
                      disabled={adminUserBulkLoading || !isAuthenticated || !adminUserBulkCsvFile}
                      testId="admin-user-bulk-import-run"
                    />
                    <IconActionButton
                      iconClassName="bi bi-file-earmark-arrow-down"
                      tooltip="Generate admin user reject report from CSV"
                      ariaLabel="Generate admin user reject report from CSV"
                      onClick={() => {
                        void handleDownloadAdminUserBulkRejectReport();
                      }}
                      variant="outline-secondary"
                      disabled={adminUserBulkLoading || !adminUserBulkCsvFile}
                      testId="admin-user-bulk-import-reject-report"
                    />
                    <IconActionButton
                      iconClassName="bi bi-shield-check"
                      tooltip="Export admin user import audit evidence"
                      ariaLabel="Export admin user import audit evidence"
                      onClick={() => {
                        void handleExportAdminUserBulkAuditEvidence();
                      }}
                      variant="outline-secondary"
                      disabled={adminUserBulkLoading || adminUserBulkAuditExportLoading || !isAuthenticated}
                      testId="admin-user-bulk-import-audit-export"
                    />
                  </div>
                </div>

                {adminUserBulkResult && (
                  <div className="small mt-2" data-testid="admin-user-bulk-import-summary">
                    <div className="text-muted">
                      Processed {adminUserBulkResult.result.totalRows} row(s) · Created {adminUserBulkResult.createdRows ?? adminUserBulkResult.result.succeededRows} · Updated {adminUserBulkResult.updatedRows ?? 0} · Failed {adminUserBulkResult.result.failedRows}
                    </div>
                    {adminUserBulkResult.rejects.length > 0 && (
                      <div className="mt-1" style={{ maxHeight: '7rem', overflowY: 'auto' }}>
                        {adminUserBulkResult.rejects.map((reject) => (
                          <div key={`admin-user-bulk-error-${reject.rowNumber}-${reject.reason}`} className="text-danger">
                            Row {reject.rowNumber}: {reject.reason}
                          </div>
                        ))}
                      </div>
                    )}
                    {adminUserBulkResult.rejects.length > 0 && (
                      <div className="mt-1">
                        <IconActionButton
                          iconClassName="bi bi-filetype-csv"
                          tooltip="Download last import reject report CSV"
                          ariaLabel="Download last import reject report CSV"
                          onClick={() => downloadCsv('admin-user-import-rejects.csv', adminUserBulkResult.rejectReportCsv)}
                          variant="outline-secondary"
                          testId="admin-user-bulk-import-reject-report-inline"
                        />
                      </div>
                    )}
                  </div>
                )}

                {adminUserBulkImportHistory.length > 0 && (
                  <div className="small mt-3" data-testid="admin-user-bulk-import-history">
                    <div className="fw-semibold mb-1">Recent bulk import runs</div>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Executed</th>
                            <th>Source</th>
                            <th>Message ID</th>
                            <th className="text-end">Rows</th>
                            <th className="text-end">Created</th>
                            <th className="text-end">Updated</th>
                            <th className="text-end">Failed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminUserBulkImportHistory.map((run) => (
                            <tr key={`${run.executedUtc}-${run.sourceSystemCode}-${run.sourceMessageId}`}>
                              <td>{new Date(run.executedUtc).toLocaleString()}</td>
                              <td>
                                {run.sourceSystemCode}
                                {run.updateExisting ? <div className="small text-muted">update-existing</div> : null}
                              </td>
                              <td>{run.sourceMessageId || 'N/A'}</td>
                              <td className="text-end">{run.totalRows}</td>
                              <td className="text-end">{run.createdRows}</td>
                              <td className="text-end">{run.updatedRows}</td>
                              <td className="text-end">{run.failedRows}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Search Users" info="Filter users by display name or email address." /></Form.Label>
                  <Form.Control
                    value={adminUsersSearch}
                    onChange={(event) => setAdminUsersSearch(event.target.value)}
                    placeholder="Name or email"
                  />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Status" info="Filter by active or inactive user status." /></Form.Label>
                  <Form.Select value={adminUsersStatusFilter} onChange={(event) => setAdminUsersStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}>
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-3 d-flex align-items-end gap-2">
                <IconActionButton
                  iconClassName="bi bi-funnel"
                  tooltip="Apply user filters"
                  ariaLabel="Apply user filters"
                  onClick={() => void handleLoadAdminUsers(1)}
                  disabled={adminUsersLoading || !isAuthenticated}
                  variant="outline-primary"
                />
              </div>
            </div>

            {adminUsers.length === 0 && !adminUsersLoading && (
              <div className="small text-muted mb-2">No users loaded. Use refresh to load user lifecycle data.</div>
            )}

            <div className="small text-muted mb-2">
              Role model: <strong>SYSTEM_ADMIN</strong> (admin), <strong>CONTRIBUTOR</strong> (operations authoring), <strong>INCIDENT_COMMANDER</strong> (runtime/operator).
            </div>

            {adminUsers.length > 0 && (
              <>
                <IpocDataGrid
                  gridId="admin-users"
                  rowData={adminUsersGridRows}
                  columnDefs={adminUsersGridColumnDefs}
                  emptyMessage="No users loaded. Use refresh to load user lifecycle data."
                  pageSize={25}
                />

                <div className="d-flex justify-content-between align-items-center mt-2">
                  <div className="small text-muted">Page {adminUsersPageNumber} of {adminUsersTotalPages}</div>
                  <div className="d-flex gap-2">
                    <IconActionButton
                      iconClassName="bi bi-chevron-left"
                      tooltip="Previous user page"
                      ariaLabel="Previous user page"
                      onClick={() => void handleLoadAdminUsers(adminUsersPageNumber - 1)}
                      disabled={adminUsersLoading || !isAuthenticated || adminUsersPageNumber <= 1}
                    />
                    <IconActionButton
                      iconClassName="bi bi-chevron-right"
                      tooltip="Next user page"
                      ariaLabel="Next user page"
                      onClick={() => void handleLoadAdminUsers(adminUsersPageNumber + 1)}
                      disabled={adminUsersLoading || !isAuthenticated || adminUsersPageNumber >= adminUsersTotalPages}
                    />
                  </div>
                </div>
              </>
            )}

            <Modal show={adminUserRoleModalOpen} onHide={() => setAdminUserRoleModalOpen(false)} centered>
              <Modal.Header closeButton>
                <Modal.Title>Manage User Roles</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <div className="small text-muted mb-2">
                  {adminUserRoleTarget
                    ? `Assign roles for ${adminUserRoleTarget.displayName}.`
                    : 'Select user role assignments.'}
                </div>

                <div className="d-flex flex-wrap gap-2 mb-3">
                  {adminRoles.map((role) => {
                    const selected = adminUserRoleSelection.includes(role.roleCode);
                    return (
                      <Badge
                        key={`admin-role-chip-${role.roleCode}`}
                        bg={selected ? 'primary' : 'secondary'}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleAdminUserRoleSelection(role.roleCode)}
                      >
                        {role.roleCode}
                      </Badge>
                    );
                  })}
                </div>

                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Assignment reason" info="Optional audit note explaining why role assignments were updated for this user." /> <span className="text-muted">(optional)</span></Form.Label>
                  <Form.Control
                    value={adminUserRoleReason}
                    onChange={(event) => setAdminUserRoleReason(event.target.value)}
                    placeholder="Reason for role assignment update"
                  />
                </Form.Group>

                <div className="small text-muted mt-3 mb-1">Current active assignments</div>
                {adminUserRoleAssignments.filter((item) => item.isActive).length === 0 ? (
                  <div className="small text-muted">No active roles assigned.</div>
                ) : (
                  <div className="d-flex flex-wrap gap-1">
                    {adminUserRoleAssignments
                      .filter((item) => item.isActive)
                      .map((item) => (
                        <Badge key={`active-assignment-${item.userRoleAssignmentId}`} bg="info">{item.roleCode}</Badge>
                      ))}
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <IconActionButton
                  iconClassName="bi bi-x-lg"
                  tooltip="Cancel role assignment"
                  ariaLabel="Cancel role assignment"
                  onClick={() => setAdminUserRoleModalOpen(false)}
                  variant="outline-secondary"
                />
                <IconActionButton
                  iconClassName="bi bi-save"
                  tooltip="Save role assignments"
                  ariaLabel="Save role assignments"
                  onClick={() => {
                    void handleSaveAdminUserRoles();
                  }}
                  disabled={adminUserRoleSaving || !adminUserRoleTarget}
                  variant="outline-primary"
                />
              </Modal.Footer>
            </Modal>
          </Tab>

          <Tab eventKey="facilities-admin" title={renderAdminTabTitle('bi bi-geo-alt', 'Facility Admin')}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="small text-muted">Manage facility active lifecycle status.</div>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="secondary">{adminLocationsTotalCount} total</Badge>
                <IconActionButton
                  iconClassName="bi bi-arrow-clockwise"
                  tooltip={adminLocationsLoading ? 'Loading facilities...' : 'Refresh facilities'}
                  ariaLabel="Refresh facilities"
                  onClick={() => void handleLoadAdminLocations()}
                  disabled={adminLocationsLoading || !isAuthenticated}
                />
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Search Facilities" info="Filter facilities by location, organization, or region." /></Form.Label>
                  <Form.Control
                    value={adminLocationsSearch}
                    onChange={(event) => setAdminLocationsSearch(event.target.value)}
                    placeholder="Facility, organization, or region"
                  />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Status" info="Filter by active or inactive facility status." /></Form.Label>
                  <Form.Select value={adminLocationsStatusFilter} onChange={(event) => setAdminLocationsStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}>
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-3 d-flex align-items-end gap-2">
                <IconActionButton
                  iconClassName="bi bi-funnel"
                  tooltip="Apply facility filters"
                  ariaLabel="Apply facility filters"
                  onClick={() => void handleLoadAdminLocations(1)}
                  disabled={adminLocationsLoading || !isAuthenticated}
                  variant="outline-primary"
                />
              </div>
            </div>

            {adminLocations.length === 0 && !adminLocationsLoading && (
              <div className="small text-muted mb-2">No facilities loaded. Use refresh to load facility lifecycle data.</div>
            )}

            {adminLocations.length > 0 && (
              <>
                <IpocDataGrid
                  gridId="admin-facilities"
                  rowData={adminLocationsGridRows}
                  columnDefs={adminLocationsGridColumnDefs}
                  emptyMessage="No facilities loaded. Use refresh to load facility lifecycle data."
                  pageSize={25}
                />

                <div className="d-flex justify-content-between align-items-center mt-2">
                  <div className="small text-muted">Page {adminLocationsPageNumber} of {adminLocationsTotalPages}</div>
                  <div className="d-flex gap-2">
                    <IconActionButton
                      iconClassName="bi bi-chevron-left"
                      tooltip="Previous facility page"
                      ariaLabel="Previous facility page"
                      onClick={() => void handleLoadAdminLocations(adminLocationsPageNumber - 1)}
                      disabled={adminLocationsLoading || !isAuthenticated || adminLocationsPageNumber <= 1}
                    />
                    <IconActionButton
                      iconClassName="bi bi-chevron-right"
                      tooltip="Next facility page"
                      ariaLabel="Next facility page"
                      onClick={() => void handleLoadAdminLocations(adminLocationsPageNumber + 1)}
                      disabled={adminLocationsLoading || !isAuthenticated || adminLocationsPageNumber >= adminLocationsTotalPages}
                    />
                  </div>
                </div>
              </>
            )}
          </Tab>

          <Tab eventKey="ics-positions-admin" title={renderAdminTabTitle('bi bi-diagram-3', 'ICS Positions')}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="small text-muted">Create and maintain incident command structure positions.</div>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="secondary">{adminIcsPositionsTotalCount} total</Badge>
                <IconActionButton
                  iconClassName="bi bi-arrow-clockwise"
                  tooltip={adminIcsPositionsLoading ? 'Loading ICS positions...' : 'Refresh ICS positions'}
                  ariaLabel="Refresh ICS positions"
                  onClick={() => void handleLoadAdminIcsPositions()}
                  disabled={adminIcsPositionsLoading || !isAuthenticated}
                />
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Search Positions" info="Filter positions by code, name, or ICS section." /></Form.Label>
                  <Form.Control
                    value={adminIcsPositionsSearch}
                    onChange={(event) => setAdminIcsPositionsSearch(event.target.value)}
                    placeholder="Code, name, or section"
                  />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Standard Filter" info="Filter positions by NIMS standard vs custom classification." /></Form.Label>
                  <Form.Select value={adminIcsPositionsStandardFilter} onChange={(event) => setAdminIcsPositionsStandardFilter(event.target.value as 'all' | 'standard' | 'custom')}>
                    <option value="all">All</option>
                    <option value="standard">NIMS Standard</option>
                    <option value="custom">Custom</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-3 d-flex align-items-end gap-2">
                <IconActionButton
                  iconClassName="bi bi-funnel"
                  tooltip="Apply ICS position filters"
                  ariaLabel="Apply ICS position filters"
                  onClick={() => void handleLoadAdminIcsPositions(1)}
                  disabled={adminIcsPositionsLoading || !isAuthenticated}
                  variant="outline-primary"
                />
              </div>
            </div>

            <div className="border rounded p-3 mb-3 bg-body-tertiary">
              <div className="fw-semibold mb-2">{adminIcsPositionEditId === null ? 'Create ICS Position' : `Edit ICS Position #${adminIcsPositionEditId}`}</div>
              <div className="row g-2">
                <div className="col-md-3">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="Position Code" info="Short unique code (for example: IC, OPS, LOG)." /></Form.Label>
                    <Form.Control
                      ref={adminIcsPositionCodeInputRef}
                      value={adminIcsPositionPositionCode}
                      onChange={(event) => setAdminIcsPositionPositionCode(event.target.value.toUpperCase())}
                      placeholder="Code"
                      disabled={adminIcsPositionEditId !== null}
                      isInvalid={Boolean(adminIcsPositionValidationErrors.positionCode?.length)}
                    />
                    {adminIcsPositionValidationErrors.positionCode?.map((errorMessage) => (
                      <Form.Text key={errorMessage} className="text-danger d-block">{errorMessage}</Form.Text>
                    ))}
                  </Form.Group>
                </div>
                <div className="col-md-5">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="Position Name" info="Full display name used in assignment boards and reports." /></Form.Label>
                    <Form.Control
                      ref={adminIcsPositionNameInputRef}
                      value={adminIcsPositionPositionName}
                      onChange={(event) => setAdminIcsPositionPositionName(event.target.value)}
                      placeholder="Position name"
                      isInvalid={Boolean(adminIcsPositionValidationErrors.positionName?.length)}
                    />
                    {adminIcsPositionValidationErrors.positionName?.map((errorMessage) => (
                      <Form.Text key={errorMessage} className="text-danger d-block">{errorMessage}</Form.Text>
                    ))}
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="ICS Section" info="Command section bucket (Command, Operations, Planning, Logistics, Finance/Admin)." /></Form.Label>
                    <Form.Control
                      ref={adminIcsPositionSectionInputRef}
                      value={adminIcsPositionSection}
                      onChange={(event) => setAdminIcsPositionSection(event.target.value)}
                      placeholder="Section"
                      isInvalid={Boolean(adminIcsPositionValidationErrors.icsSection?.length)}
                    />
                    {adminIcsPositionValidationErrors.icsSection?.map((errorMessage) => (
                      <Form.Text key={errorMessage} className="text-danger d-block">{errorMessage}</Form.Text>
                    ))}
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="Parent Position Code" info="Optional parent position code for organizational hierarchy." /></Form.Label>
                    <Form.Control
                      ref={adminIcsPositionParentCodeInputRef}
                      value={adminIcsPositionParentCode}
                      onChange={(event) => setAdminIcsPositionParentCode(event.target.value.toUpperCase())}
                      placeholder="Parent code"
                      isInvalid={Boolean(adminIcsPositionValidationErrors.parentPositionCode?.length)}
                    />
                    {adminIcsPositionValidationErrors.parentPositionCode?.map((errorMessage) => (
                      <Form.Text key={errorMessage} className="text-danger d-block">{errorMessage}</Form.Text>
                    ))}
                  </Form.Group>
                </div>
                <div className="col-md-3">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="Sort Order" info="Lower values appear earlier in ICS position displays." /></Form.Label>
                    <Form.Control
                      ref={adminIcsPositionSortOrderInputRef}
                      value={adminIcsPositionSortOrder}
                      onChange={(event) => setAdminIcsPositionSortOrder(event.target.value)}
                      placeholder="100"
                      isInvalid={Boolean(adminIcsPositionValidationErrors.sortOrder?.length)}
                    />
                    {adminIcsPositionValidationErrors.sortOrder?.map((errorMessage) => (
                      <Form.Text key={errorMessage} className="text-danger d-block">{errorMessage}</Form.Text>
                    ))}
                  </Form.Group>
                </div>
                <div className="col-md-5 d-flex align-items-end">
                  <Form.Check
                    type="switch"
                    id="admin-ics-position-is-standard"
                    label="NIMS standard position"
                    checked={adminIcsPositionIsStandard}
                    onChange={(event) => setAdminIcsPositionIsStandard(event.target.checked)}
                  />
                </div>
                <div className="col-12">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="Description" info="Optional notes describing role responsibilities or usage guidance." /></Form.Label>
                    <Form.Control
                      ref={adminIcsPositionDescriptionInputRef}
                      as="textarea"
                      rows={2}
                      value={adminIcsPositionDescription}
                      onChange={(event) => setAdminIcsPositionDescription(event.target.value)}
                      placeholder="Optional description"
                      isInvalid={Boolean(adminIcsPositionValidationErrors.description?.length)}
                    />
                    {adminIcsPositionValidationErrors.description?.map((errorMessage) => (
                      <Form.Text key={errorMessage} className="text-danger d-block">{errorMessage}</Form.Text>
                    ))}
                  </Form.Group>
                </div>
              {adminIcsPositionSaveMessage && (
                <div className="small text-success mt-2">{adminIcsPositionSaveMessage}</div>
              )}
              </div>
              <div className="d-flex gap-2 mt-3">
                <IconActionButton
                  iconClassName="bi bi-floppy"
                  tooltip={adminIcsPositionEditId === null ? 'Create ICS position' : 'Update ICS position'}
                  ariaLabel={adminIcsPositionEditId === null ? 'Create ICS position' : 'Update ICS position'}
                  onClick={() => void handleSaveAdminIcsPosition()}
                  disabled={adminIcsPositionsLoading || !isAuthenticated}
                  variant="outline-primary"
                />
                <IconActionButton
                  iconClassName="bi bi-eraser"
                  tooltip="Clear ICS position form"
                  ariaLabel="Clear ICS position form"
                  onClick={resetAdminIcsPositionForm}
                  disabled={adminIcsPositionsLoading}
                  variant="outline-secondary"
                />
              </div>
            </div>

            {adminIcsPositions.length > 0 && (
              <div className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">ICS Hierarchy Preview</div>
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg="light" text="dark">Current page</Badge>
                    <IconActionButton
                      iconClassName={showIcsHierarchyPreview ? 'bi bi-arrows-collapse' : 'bi bi-arrows-expand'}
                      tooltip={showIcsHierarchyPreview ? 'Collapse ICS hierarchy preview' : 'Expand ICS hierarchy preview'}
                      ariaLabel={showIcsHierarchyPreview ? 'Collapse ICS hierarchy preview' : 'Expand ICS hierarchy preview'}
                      onClick={() => setShowIcsHierarchyPreview((current) => !current)}
                      variant="outline-secondary"
                    />
                  </div>
                </div>
                {showIcsHierarchyPreview ? (
                  <>
                    <div className="small text-muted mb-2">Preview of parent-child command structure from currently loaded rows.</div>
                    <ul className="ps-3 mb-0">
                      {icsHierarchyTree.map((rootNode) => renderIcsHierarchyNode(rootNode))}
                    </ul>
                  </>
                ) : (
                  <div className="small text-muted">Collapsed. Expand to view parent-child hierarchy.</div>
                )}
              </div>
            )}

            {adminIcsPositions.length === 0 && !adminIcsPositionsLoading && (
              <div className="small text-muted mb-2">No ICS positions loaded. Use refresh to load command structure positions.</div>
            )}

            {adminIcsPositions.length > 0 && (
              <>
                <IpocDataGrid
                  gridId="admin-ics-positions"
                  rowData={adminIcsPositionsGridRows}
                  columnDefs={adminIcsPositionsGridColumnDefs}
                  emptyMessage="No ICS positions loaded. Use refresh to load command structure positions."
                  pageSize={25}
                />

                <div className="d-flex justify-content-between align-items-center mt-2">
                  <div className="small text-muted">Page {adminIcsPositionsPageNumber} of {adminIcsPositionsTotalPages}</div>
                  <div className="d-flex gap-2">
                    <IconActionButton
                      iconClassName="bi bi-chevron-left"
                      tooltip="Previous ICS positions page"
                      ariaLabel="Previous ICS positions page"
                      onClick={() => void handleLoadAdminIcsPositions(adminIcsPositionsPageNumber - 1)}
                      disabled={adminIcsPositionsLoading || !isAuthenticated || adminIcsPositionsPageNumber <= 1}
                    />
                    <IconActionButton
                      iconClassName="bi bi-chevron-right"
                      tooltip="Next ICS positions page"
                      ariaLabel="Next ICS positions page"
                      onClick={() => void handleLoadAdminIcsPositions(adminIcsPositionsPageNumber + 1)}
                      disabled={adminIcsPositionsLoading || !isAuthenticated || adminIcsPositionsPageNumber >= adminIcsPositionsTotalPages}
                    />
                  </div>
                </div>
              </>
            )}
          </Tab>

          <Tab eventKey="session-admin" title={renderAdminTabTitle('bi bi-person-badge', 'Session Admin')}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="small text-muted">View and terminate active sessions.</div>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="secondary">{adminSessionsTotalCount} total</Badge>
                <IconActionButton
                  iconClassName="bi bi-shield-check"
                  tooltip="Export session compliance evidence"
                  ariaLabel="Export session compliance evidence"
                  onClick={() => void handleExportSessionComplianceEvidence()}
                  disabled={adminSessionsLoading || !isAuthenticated}
                  variant="outline-primary"
                />
                <IconActionButton
                  iconClassName="bi bi-arrow-clockwise"
                  tooltip={adminSessionsLoading ? 'Loading sessions...' : 'Refresh active sessions'}
                  ariaLabel="Refresh active sessions"
                  onClick={() => void handleLoadAdminSessions()}
                  disabled={adminSessionsLoading || !isAuthenticated}
                />
              </div>
            </div>

            <div className="border rounded p-2 mb-3" data-testid="admin-session-audit-export-filters">
              <div className="small fw-semibold mb-2">Session/auth audit evidence export</div>
              <div className="d-flex flex-wrap gap-2 mb-2" data-testid="admin-session-audit-presets">
                <Badge bg={adminSessionAuditPreset === 'auth-failures-24h' ? 'primary' : 'secondary'}>
                  Auth failures 24h
                </Badge>
                <Badge bg={adminSessionAuditPreset === 'auth-success-24h' ? 'primary' : 'secondary'}>
                  Auth success 24h
                </Badge>
                <Badge bg={adminSessionAuditPreset === 'all-last-7d' ? 'primary' : 'secondary'}>
                  All events 7d
                </Badge>
              </div>
              <div className="d-flex justify-content-end gap-2 mb-2">
                <IconActionButton
                  iconClassName="bi bi-exclamation-triangle"
                  tooltip="Apply quick preset: authentication failures in last 24 hours"
                  ariaLabel="Apply quick preset authentication failures in last 24 hours"
                  onClick={() => applySessionAuditQuickPreset('auth-failures-24h')}
                  disabled={adminSessionAuditExportLoading || adminSessionsLoading || !isAuthenticated}
                  variant="outline-warning"
                  testId="admin-session-audit-preset-failures"
                />
                <IconActionButton
                  iconClassName="bi bi-check-circle"
                  tooltip="Apply quick preset: authentication successes in last 24 hours"
                  ariaLabel="Apply quick preset authentication successes in last 24 hours"
                  onClick={() => applySessionAuditQuickPreset('auth-success-24h')}
                  disabled={adminSessionAuditExportLoading || adminSessionsLoading || !isAuthenticated}
                  variant="outline-success"
                  testId="admin-session-audit-preset-success"
                />
                <IconActionButton
                  iconClassName="bi bi-calendar-week"
                  tooltip="Apply quick preset: all audit events in last 7 days"
                  ariaLabel="Apply quick preset all audit events in last 7 days"
                  onClick={() => applySessionAuditQuickPreset('all-last-7d')}
                  disabled={adminSessionAuditExportLoading || adminSessionsLoading || !isAuthenticated}
                  variant="outline-secondary"
                  testId="admin-session-audit-preset-week"
                />
                <IconActionButton
                  iconClassName="bi bi-arrow-counterclockwise"
                  tooltip="Reset session audit filters to defaults"
                  ariaLabel="Reset session audit filters to defaults"
                  onClick={clearSessionAuditFilters}
                  disabled={adminSessionAuditExportLoading || adminSessionsLoading || !isAuthenticated}
                  variant="outline-secondary"
                  testId="admin-session-audit-reset"
                />
              </div>
              <div className="row g-2">
                <div className="col-md-3">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="Audit category" info="Optional audit category filter used when exporting requestable session/auth evidence." /></Form.Label>
                    <Form.Control
                      value={adminSessionAuditEventCategory}
                      onChange={(event) => setAdminSessionAuditEventCategory(event.target.value)}
                      placeholder="AUTHENTICATION"
                      data-testid="admin-session-audit-category"
                    />
                  </Form.Group>
                </div>
                <div className="col-md-3">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="Outcome code" info="Optional outcome filter (for example SUCCESS, FAILURE, WARNING)." /></Form.Label>
                    <Form.Control
                      value={adminSessionAuditOutcomeCode}
                      onChange={(event) => setAdminSessionAuditOutcomeCode(event.target.value)}
                      placeholder="SUCCESS"
                      data-testid="admin-session-audit-outcome"
                    />
                  </Form.Group>
                </div>
                <div className="col-md-3">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="From (local)" info="Optional local datetime start boundary for exported session/auth audit events." /></Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={adminSessionAuditFromLocal}
                      onChange={(event) => setAdminSessionAuditFromLocal(event.target.value)}
                      data-testid="admin-session-audit-from"
                    />
                  </Form.Group>
                </div>
                <div className="col-md-3">
                  <Form.Group>
                    <Form.Label className="small mb-1"><LabelWithInfo text="To (local)" info="Optional local datetime end boundary for exported session/auth audit events." /></Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={adminSessionAuditToLocal}
                      onChange={(event) => setAdminSessionAuditToLocal(event.target.value)}
                      data-testid="admin-session-audit-to"
                    />
                  </Form.Group>
                </div>
              </div>
              <div className="d-flex justify-content-end mt-2">
                <IconActionButton
                  iconClassName="bi bi-file-earmark-arrow-down"
                  tooltip="Export requestable session/auth audit evidence CSV"
                  ariaLabel="Export requestable session auth audit evidence CSV"
                  onClick={() => {
                    void handleExportSessionAuditEvidence();
                  }}
                  disabled={adminSessionAuditExportLoading || adminSessionsLoading || !isAuthenticated}
                  variant="outline-secondary"
                  testId="admin-session-audit-export"
                />
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-8">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Search Sessions" info="Filter sessions by user name, email, or client IP." /></Form.Label>
                  <Form.Control
                    value={adminSessionsSearch}
                    onChange={(event) => setAdminSessionsSearch(event.target.value)}
                    placeholder="User, email, or IP"
                  />
                </Form.Group>
              </div>
              <div className="col-md-4 d-flex align-items-end gap-2">
                <IconActionButton
                  iconClassName="bi bi-funnel"
                  tooltip="Apply session filters"
                  ariaLabel="Apply session filters"
                  onClick={() => void handleLoadAdminSessions(1)}
                  disabled={adminSessionsLoading || !isAuthenticated}
                  variant="outline-primary"
                />
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label className="small mb-1"><LabelWithInfo text="Termination Reason" info="Optional reason recorded when terminating user sessions." /></Form.Label>
              <Form.Control value={sessionTerminationReason} onChange={(event) => setSessionTerminationReason(event.target.value)} placeholder="Optional reason" />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small mb-1"><LabelWithInfo text="Impersonation Reason" info="Reason recorded when starting or stopping impersonation." /></Form.Label>
              <Form.Control value={sessionImpersonationReason} onChange={(event) => setSessionImpersonationReason(event.target.value)} placeholder="Reason for impersonation action" />
            </Form.Group>

            {adminSessions.length === 0 && !adminSessionsLoading && (
              <div className="small text-muted mb-2">No active sessions loaded. Use refresh to load current sessions.</div>
            )}

            {adminSessions.length > 0 && (
              <>
                <IpocDataGrid
                  gridId="admin-sessions"
                  rowData={adminSessionsGridRows}
                  columnDefs={adminSessionsGridColumnDefs}
                  emptyMessage="No active sessions loaded. Use refresh to load current sessions."
                  pageSize={25}
                />

                <div className="d-flex justify-content-between align-items-center mt-2">
                  <div className="small text-muted">Page {adminSessionsPageNumber} of {adminSessionsTotalPages}</div>
                  <div className="d-flex gap-2">
                    <IconActionButton
                      iconClassName="bi bi-chevron-left"
                      tooltip="Previous session page"
                      ariaLabel="Previous session page"
                      onClick={() => void handleLoadAdminSessions(adminSessionsPageNumber - 1)}
                      disabled={adminSessionsLoading || !isAuthenticated || adminSessionsPageNumber <= 1}
                    />
                    <IconActionButton
                      iconClassName="bi bi-chevron-right"
                      tooltip="Next session page"
                      ariaLabel="Next session page"
                      onClick={() => void handleLoadAdminSessions(adminSessionsPageNumber + 1)}
                      disabled={adminSessionsLoading || !isAuthenticated || adminSessionsPageNumber >= adminSessionsTotalPages}
                    />
                  </div>
                </div>
              </>
            )}
          </Tab>

          <Tab eventKey="imports" title={renderAdminTabTitle('bi bi-file-earmark-arrow-up', 'Batch Imports')}>
            <div className="small text-muted mb-2">
              Default sample files now live under <code>{DEFAULT_INTEGRATION_SAMPLES_HINT}</code>.
            </div>
            <div className="small text-muted mb-3">
              Resource CSV: <code>{DEFAULT_BATCH_RESOURCE_CSV_HINT}</code> · Bed CSV: <code>{DEFAULT_BATCH_BED_CSV_HINT}</code>
            </div>
            <div className="d-flex align-items-center gap-2 mb-3">
              <Badge bg={validationOnlyMode ? 'warning' : 'primary'} text={validationOnlyMode ? 'dark' : undefined}>
                {validationOnlyMode ? 'Validation-only mode' : 'Import mode'}
              </Badge>
              <span className="small text-muted">
                {validationOnlyMode
                  ? 'Action buttons generate reject reports from CSV without writing imports.'
                  : 'Action buttons import rows and return result details.'}
              </span>
            </div>

            <Form.Check
              className="mb-3"
              type="switch"
              id="imports-validation-only-mode"
              label="Use validation-only mode (generate reject report without import)"
              checked={validationOnlyMode}
              onChange={(event) => setValidationOnlyMode(event.target.checked)}
            />

            <div className="row g-3">
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1"><LabelWithInfo text="Source System Code" info="Unique source identifier used for ingestion traceability and idempotency." /></Form.Label>
                  <Form.Control value={sourceSystemCode} onChange={(event) => setSourceSystemCode(event.target.value)} />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1"><LabelWithInfo text="Source Message Id (optional)" info="Optional unique message key for duplicate detection across imports." /></Form.Label>
                  <Form.Control value={sourceMessageId} onChange={(event) => setSourceMessageId(event.target.value)} />
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-2">
              <Form.Label className="small mb-1"><LabelWithInfo text="Resource Inventory CSV" info="Upload CSV rows for resource inventory upsert by location and resource type." /></Form.Label>
              <Form.Control type="file" accept=".csv,text/csv" onChange={(event) => setResourceCsvFile((event.target as HTMLInputElement).files?.[0] ?? null)} />
            </Form.Group>
            <IconActionButton
              iconClassName={validationOnlyMode ? 'bi bi-file-earmark-arrow-down' : 'bi bi-upload'}
              tooltip={validationOnlyMode ? 'Generate resource reject report from CSV (no import write)' : 'Import resource inventory CSV'}
              ariaLabel={validationOnlyMode ? 'Generate resource reject report from CSV' : 'Import resource inventory CSV'}
              onClick={() => void (validationOnlyMode ? handleDownloadResourceRejectReport() : handleImportResourceCsv())}
              disabled={importLoading || !isAuthenticated || sourceSystemCode.trim().length === 0}
              variant="outline-primary"
            />
            {resourceImportResult && (
              <div className="small text-muted mt-2">
                <div>Rows: {resourceImportResult.result.totalRows}; Success: {resourceImportResult.result.succeededRows}; Failed: {resourceImportResult.result.failedRows}; Rejected: {resourceImportResult.rejects.length}; Processed: {new Date(resourceImportResult.result.processedUtc).toLocaleString()}</div>
                {resourceImportResult.rejects.length > 0 && (
                  <div className="mt-2">
                    <IconActionButton
                      iconClassName="bi bi-download"
                      tooltip="Download resource import reject report"
                      ariaLabel="Download resource import reject report"
                      onClick={() => downloadCsv('resource-import-rejects.csv', resourceImportResult.rejectReportCsv)}
                    />
                  </div>
                )}
              </div>
            )}

            <hr />

            <Form.Group className="mb-2">
              <Form.Label className="small mb-1"><LabelWithInfo text="Bed Availability CSV" info="Upload CSV rows for bed snapshot ingestion and reconciliation." /></Form.Label>
              <Form.Control type="file" accept=".csv,text/csv" onChange={(event) => setBedCsvFile((event.target as HTMLInputElement).files?.[0] ?? null)} />
            </Form.Group>
            <IconActionButton
              iconClassName={validationOnlyMode ? 'bi bi-file-earmark-arrow-down' : 'bi bi-upload'}
              tooltip={validationOnlyMode ? 'Generate bed reject report from CSV (no import write)' : 'Import bed availability CSV'}
              ariaLabel={validationOnlyMode ? 'Generate bed reject report from CSV' : 'Import bed availability CSV'}
              onClick={() => void (validationOnlyMode ? handleDownloadBedRejectReport() : handleImportBedCsv())}
              disabled={importLoading || !isAuthenticated || sourceSystemCode.trim().length === 0}
              variant="outline-primary"
            />
            {bedImportResult && (
              <div className="small text-muted mt-2">
                <div>Rows: {bedImportResult.result.totalRows}; Success: {bedImportResult.result.succeededRows}; Failed: {bedImportResult.result.failedRows}; Rejected: {bedImportResult.rejects.length}; Processed: {new Date(bedImportResult.result.processedUtc).toLocaleString()}</div>
                {bedImportResult.rejects.length > 0 && (
                  <div className="mt-2">
                    <IconActionButton
                      iconClassName="bi bi-download"
                      tooltip="Download bed import reject report"
                      ariaLabel="Download bed import reject report"
                      onClick={() => downloadCsv('bed-import-rejects.csv', bedImportResult.rejectReportCsv)}
                    />
                  </div>
                )}
              </div>
            )}
          </Tab>

          <Tab eventKey="fhir" title={renderAdminTabTitle('bi bi-arrow-left-right', 'FHIR Translator')}>
            <div className="small text-muted mb-2">
              Default FHIR sample bundle: <code>{DEFAULT_FHIR_BUNDLE_HINT}</code>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="small text-muted">Use the adapter contract to validate payload expectations before importing.</div>
              <IconActionButton
                iconClassName="bi bi-arrow-clockwise"
                tooltip={fhirAdapterContractLoading ? 'Loading FHIR adapter contract...' : 'Refresh FHIR adapter contract'}
                ariaLabel="Refresh FHIR adapter contract"
                onClick={() => void handleLoadFhirAdapterContract()}
                disabled={fhirAdapterContractLoading || !isAuthenticated}
                variant={fhirAdapterContractLoading ? 'secondary' : 'outline-secondary'}
              />
            </div>
            {fhirAdapterContract && (
              <Card className="border-0 bg-body-tertiary mb-2">
                <Card.Body className="py-2 small">
                  <div><strong>Contract:</strong> {fhirAdapterContract.adapterName} v{fhirAdapterContract.contractVersion}</div>
                  <div><strong>FHIR:</strong> {fhirAdapterContract.supportedFhir.bundleResourceType}; required resources: {fhirAdapterContract.supportedFhir.requiredEntryResourceTypes.join(', ')}</div>
                  <div><strong>Endpoint:</strong> {fhirAdapterContract.endpoint.method} {fhirAdapterContract.endpoint.path}</div>
                  <div><strong>Required fields:</strong> {fhirAdapterContract.endpoint.requiredRequestFields.join(', ')}</div>
                  <div><strong>Idempotency:</strong> {fhirAdapterContract.idempotency.key}</div>
                </Card.Body>
              </Card>
            )}
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1"><LabelWithInfo text="FHIR Bundle JSON" info="Paste Location and HealthcareService bundle payload for translation into IOCEM bed snapshots." /></Form.Label>
              <Form.Control as="textarea" rows={10} value={fhirJsonInput} onChange={(event) => setFhirJsonInput(event.target.value)} placeholder="Paste Location/HealthcareService bundle JSON..." />
            </Form.Group>
            <IconActionButton
              iconClassName="bi bi-arrow-repeat"
              tooltip={fhirLoading ? 'Translating and importing FHIR payload...' : 'Translate and import FHIR payload'}
              ariaLabel="Translate and import FHIR payload"
              onClick={() => void handleImportFhir()}
              disabled={fhirLoading || !isAuthenticated || sourceSystemCode.trim().length === 0}
              variant="outline-primary"
            />
            {fhirResult && (
              <div className="small text-muted mt-2">
                <div>Rows: {fhirResult.result.totalRows}; Success: {fhirResult.result.succeededRows}; Failed: {fhirResult.result.failedRows}; Rejected: {fhirResult.rejectedCount}</div>
                {fhirResult.rejects.length > 0 && (
                  <>
                    <ul className="mt-1 mb-0">
                      {fhirResult.rejects.slice(0, 10).map((reject, index) => (
                        <li key={`${reject}-${index}`}>{reject}</li>
                      ))}
                    </ul>
                    <div className="mt-2">
                      <IconActionButton
                        iconClassName="bi bi-download"
                        tooltip="Download FHIR import reject report"
                        ariaLabel="Download FHIR import reject report"
                        onClick={() => downloadCsv('fhir-import-rejects.csv', fhirResult.rejectReportCsv)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </Tab>

          <Tab eventKey="streaming" title={renderAdminTabTitle('bi bi-broadcast', 'Streaming')}>
            <div className="small text-muted mb-2">
              Default stream directory: <code>{DEFAULT_INTEGRATION_SAMPLES_HINT}</code>
            </div>
            <div className="small text-muted mb-3">
              Default stream payload sample: <code>{DEFAULT_STREAM_PAYLOAD_HINT}</code>
            </div>
            <div className="row g-3">
              <div className="col-md-8">
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1"><LabelWithInfo text="Stream Directory" info="Server-side folder scanned for inbound streaming JSON payloads." /></Form.Label>
                  <Form.Control value={streamDirectory} onChange={(event) => setStreamDirectory(event.target.value)} placeholder="Leave blank for server default" />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1"><LabelWithInfo text="Poll Interval (seconds)" info="How often the ingestion service scans the stream directory." /></Form.Label>
                  <Form.Control value={streamPollIntervalSeconds} onChange={(event) => setStreamPollIntervalSeconds(event.target.value)} />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1"><LabelWithInfo text="Default Source System Code" info="Fallback source system code when inbound payload omits one." /></Form.Label>
                  <Form.Control value={streamSourceSystemCode} onChange={(event) => setStreamSourceSystemCode(event.target.value)} />
                </Form.Group>
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <Form.Check
                  className="mb-3"
                  type="switch"
                  id="streaming-file-watcher-toggle"
                  label="Enable file watcher"
                  checked={streamWatcherEnabled}
                  onChange={(event) => setStreamWatcherEnabled(event.target.checked)}
                />
              </div>
            </div>

            <div className="d-flex gap-2 mb-3">
              <IconActionButton
                iconClassName="bi bi-arrow-clockwise"
                tooltip={streamingLoading ? 'Working...' : 'Refresh streaming status'}
                ariaLabel="Refresh streaming status"
                onClick={() => void handleRefreshStreamingStatus()}
                disabled={streamingLoading || !isAuthenticated}
              />
              <IconActionButton
                iconClassName="bi bi-play"
                tooltip="Start streaming ingestion"
                ariaLabel="Start streaming ingestion"
                onClick={() => void handleStartStreaming()}
                disabled={streamingLoading || !isAuthenticated}
                variant="outline-primary"
              />
              <IconActionButton
                iconClassName="bi bi-stop"
                tooltip="Stop streaming ingestion"
                ariaLabel="Stop streaming ingestion"
                onClick={() => void handleStopStreaming()}
                disabled={streamingLoading || !isAuthenticated}
                variant="outline-danger"
              />
            </div>

            <Form.Group className="mb-3">
              <Form.Label className="small mb-1"><LabelWithInfo text="Upload Stream Payload JSON" info="Upload a JSON stream payload file directly into the active stream directory." /></Form.Label>
              <Form.Control type="file" accept=".json,application/json" onChange={(event) => setStreamUploadFile((event.target as HTMLInputElement).files?.[0] ?? null)} />
            </Form.Group>
            <div className="d-flex gap-2 mb-3">
              <IconActionButton
                iconClassName="bi bi-cloud-upload"
                tooltip="Upload stream payload file"
                ariaLabel="Upload stream payload file"
                onClick={() => void handleUploadStreamPayload()}
                disabled={streamingLoading || !isAuthenticated || !streamUploadFile}
                variant="outline-primary"
              />
            </div>

            {streamingStatus && (
              <ListGroup>
                <ListGroup.Item>
                  <div className="fw-semibold">Status</div>
                  <div className="small text-muted">{streamingStatus.isRunning ? 'Running' : 'Stopped'}</div>
                </ListGroup.Item>
                <ListGroup.Item>
                  <div className="fw-semibold">Directory</div>
                  <div className="small text-muted">{streamingStatus.streamDirectory}</div>
                </ListGroup.Item>
                <ListGroup.Item>
                  <div className="fw-semibold">Polling / Watcher</div>
                  <div className="small text-muted">{streamingStatus.pollIntervalSeconds}s / {streamingStatus.fileWatcherEnabled ? 'Enabled' : 'Disabled'}</div>
                </ListGroup.Item>
                <ListGroup.Item>
                  <div className="fw-semibold">Queue / Processed / Failed</div>
                  <div className="small text-muted">{streamingStatus.pendingFileCount} / {streamingStatus.processedFileCount} / {streamingStatus.failedFileCount}</div>
                </ListGroup.Item>
                <ListGroup.Item>
                  <div className="fw-semibold">Last Scan</div>
                  <div className="small text-muted">{streamingStatus.lastScanUtc ? new Date(streamingStatus.lastScanUtc).toLocaleString() : 'n/a'}</div>
                </ListGroup.Item>
                {streamingStatus.lastError && (
                  <ListGroup.Item>
                    <div className="fw-semibold">Last Error</div>
                    <div className="small text-muted">{streamingStatus.lastError}</div>
                  </ListGroup.Item>
                )}
              </ListGroup>
            )}
          </Tab>

          <Tab eventKey="communications" title={renderAdminTabTitle('bi bi-chat-dots', 'Communications')}>
            <div className="small text-muted mb-3">Dispatch notifications and manage recipient delivery lifecycle (status, acknowledgment, escalation).</div>

            <div className="row g-3">
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Incident Id (optional)" info="Optional incident context for dispatch records." /></Form.Label>
                  <Form.Control value={dispatchIncidentId} onChange={(event) => setDispatchIncidentId(event.target.value)} placeholder="e.g. 1001" />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Notification Type" info="Communication type code (e.g., INCIDENT_NOTIFICATION, RESOURCE_REQUEST)." /></Form.Label>
                  <Form.Control value={dispatchNotificationTypeCode} onChange={(event) => setDispatchNotificationTypeCode(event.target.value)} />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Priority" info="Dispatch priority used by notification orchestration." /></Form.Label>
                  <Form.Select value={dispatchPriorityCode} onChange={(event) => setDispatchPriorityCode(event.target.value as 'Low' | 'Normal' | 'High' | 'Critical')}>
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Channel" info="Dispatch channel for recipient destination." /></Form.Label>
                  <Form.Select value={dispatchChannelCode} onChange={(event) => setDispatchChannelCode(event.target.value as 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH')}>
                    <option value="EMAIL">EMAIL</option>
                    <option value="SMS">SMS</option>
                    <option value="VOICE">VOICE</option>
                    <option value="PUSH">PUSH</option>
                  </Form.Select>
                </Form.Group>
              </div>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Subject" info="Notification subject line sent to recipients." /></Form.Label>
                  <Form.Control value={dispatchSubject} onChange={(event) => setDispatchSubject(event.target.value)} placeholder="Operational update" />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Destination Address" info="Destination by channel: EMAIL uses email address, SMS/VOICE use phone number, and PUSH uses token or HTTPS endpoint." /></Form.Label>
                  <Form.Control value={dispatchDestinationAddress} onChange={(event) => setDispatchDestinationAddress(event.target.value)} placeholder={dispatchDestinationPlaceholder} />
                </Form.Group>
              </div>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Recipient User Id" info="Optional user principal id for recipient targeting." /></Form.Label>
                  <Form.Control value={dispatchUserId} onChange={(event) => setDispatchUserId(event.target.value)} placeholder="Optional" />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Recipient Contact Id" info="Optional contact principal id for recipient targeting." /></Form.Label>
                  <Form.Control value={dispatchContactId} onChange={(event) => setDispatchContactId(event.target.value)} placeholder="Optional" />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Recipient Location Id" info="Optional location principal id for recipient targeting." /></Form.Label>
                  <Form.Control value={dispatchLocationId} onChange={(event) => setDispatchLocationId(event.target.value)} placeholder="Optional" />
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mt-3 mb-2">
              <Form.Label className="small mb-1"><LabelWithInfo text="Message Body" info="Main dispatch content sent to the selected recipient destination." /></Form.Label>
              <Form.Control as="textarea" rows={4} value={dispatchMessageBody} onChange={(event) => setDispatchMessageBody(event.target.value)} placeholder="Enter communication body..." />
            </Form.Group>

            <IconActionButton
              iconClassName="bi bi-send"
              tooltip={dispatchLoading ? 'Dispatching communication...' : 'Dispatch communication'}
              ariaLabel="Dispatch communication"
              onClick={() => void handleDispatchCommunication()}
              disabled={dispatchLoading || !isAuthenticated}
              variant="outline-primary"
            />

            {dispatchResult && (
              <div className="small text-muted mt-2">
                Notification #{dispatchResult.notificationId} queued for {dispatchResult.recipientCount} recipient(s). Status: {dispatchResult.notificationStatusCode}.
              </div>
            )}

            <hr />

            <div className="row g-2 mb-2">
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Notification Id" info="Load recipients for a specific notification id." /></Form.Label>
                  <Form.Control value={recipientLookupNotificationId} onChange={(event) => setRecipientLookupNotificationId(event.target.value)} placeholder="Notification id" />
                </Form.Group>
              </div>
              <div className="col-md-8 d-flex align-items-end">
                <IconActionButton
                  iconClassName="bi bi-people"
                  tooltip={notificationRecipientsLoading ? 'Loading recipients...' : 'Load notification recipients'}
                  ariaLabel="Load notification recipients"
                  onClick={() => void handleLoadNotificationRecipients()}
                  disabled={notificationRecipientsLoading || !isAuthenticated}
                  variant="outline-secondary"
                />
              </div>
            </div>

            {notificationRecipients.length > 0 && (
              <div className="mb-3">
                <IpocDataGrid
                  gridId="admin-communication-recipients"
                  rowData={notificationRecipientsGridRows}
                  columnDefs={notificationRecipientsGridColumnDefs}
                  emptyMessage="No notification recipients loaded."
                  pageSize={25}
                />
              </div>
            )}

            <hr />

            <div className="row g-2">
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Escalate Notification Id" info="Source notification id to escalate." /></Form.Label>
                  <Form.Control value={escalateNotificationIdInput} onChange={(event) => setEscalateNotificationIdInput(event.target.value)} placeholder="Notification id" />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Escalation Channel" info="Escalation target channel (EMAIL or SMS)." /></Form.Label>
                  <Form.Select value={escalationChannelCodeInput} onChange={(event) => setEscalationChannelCodeInput(event.target.value as 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH')}>
                    <option value="EMAIL">EMAIL</option>
                    <option value="SMS">SMS</option>
                    <option value="VOICE">VOICE</option>
                    <option value="PUSH">PUSH</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Escalation Destination" info="Escalation recipient destination address." /></Form.Label>
                  <Form.Control value={escalationDestinationAddressInput} onChange={(event) => setEscalationDestinationAddressInput(event.target.value)} placeholder={escalationDestinationPlaceholder} />
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mt-2 mb-2">
              <Form.Label className="small mb-1"><LabelWithInfo text="Escalation Reason" info="Reason text stored with the escalated notification." /></Form.Label>
              <Form.Control as="textarea" rows={2} value={escalationReasonInput} onChange={(event) => setEscalationReasonInput(event.target.value)} placeholder="Reason for escalation..." />
            </Form.Group>

            <IconActionButton
              iconClassName="bi bi-exclamation-triangle"
              tooltip={escalationLoading ? 'Escalating notification...' : 'Escalate notification'}
              ariaLabel="Escalate notification"
              onClick={() => void handleEscalateNotification()}
              disabled={escalationLoading || !isAuthenticated}
              variant="outline-danger"
            />

            {escalationResult && (
              <div className="small text-muted mt-2">
                Escalated #{escalationResult.sourceNotificationId} to #{escalationResult.escalatedNotificationId} for {escalationResult.recipientCount} recipient(s).
              </div>
            )}
          </Tab>
          </Tabs>
        </div>
      </Card.Body>

      <Modal show={showAdminLocationGeoModal} onHide={() => setShowAdminLocationGeoModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="small fw-semibold">Facility Geolocation Editor</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="small text-muted mb-2">
            {adminLocationGeoEditing
              ? `Update geolocation metadata for ${adminLocationGeoEditing.locationName}.`
              : 'Update geolocation metadata.'}
          </div>
          <div className="row g-2">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="small mb-1"><LabelWithInfo text="Latitude" info="Facility latitude coordinate used for map placement and geospatial analytics." /></Form.Label>
                <Form.Control value={adminLocationGeoLatitude} onChange={(event) => setAdminLocationGeoLatitude(event.target.value)} placeholder="e.g., 37.687200" />
                {adminLocationGeoValidationErrors.latitude?.length ? <div className="text-danger small mt-1">{adminLocationGeoValidationErrors.latitude[0]}</div> : null}
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="small mb-1"><LabelWithInfo text="Longitude" info="Facility longitude coordinate used for map placement and geospatial analytics." /></Form.Label>
                <Form.Control value={adminLocationGeoLongitude} onChange={(event) => setAdminLocationGeoLongitude(event.target.value)} placeholder="e.g., -97.330100" />
                {adminLocationGeoValidationErrors.longitude?.length ? <div className="text-danger small mt-1">{adminLocationGeoValidationErrors.longitude[0]}</div> : null}
              </Form.Group>
            </div>
            <div className="col-md-5">
              <Form.Group>
                <Form.Label className="small mb-1"><LabelWithInfo text="City" info="City name used for facility addressing, geocoding hints, and locality filters." /></Form.Label>
                <Form.Control value={adminLocationGeoCityName} onChange={(event) => setAdminLocationGeoCityName(event.target.value)} placeholder="City" />
              </Form.Group>
            </div>
            <div className="col-md-3">
              <Form.Group>
                <Form.Label className="small mb-1"><LabelWithInfo text="State" info="Two-letter state code used for address normalization and geocode matching." /></Form.Label>
                <Form.Control value={adminLocationGeoStateCode} onChange={(event) => setAdminLocationGeoStateCode(event.target.value.toUpperCase())} placeholder="KS" />
                {adminLocationGeoValidationErrors.stateCode?.length ? <div className="text-danger small mt-1">{adminLocationGeoValidationErrors.stateCode[0]}</div> : null}
              </Form.Group>
            </div>
            <div className="col-md-4">
              <Form.Group>
                <Form.Label className="small mb-1"><LabelWithInfo text="Postal Code" info="ZIP/postal code used for location precision and downstream geocoding quality." /></Form.Label>
                <Form.Control value={adminLocationGeoPostalCode} onChange={(event) => setAdminLocationGeoPostalCode(event.target.value)} placeholder="67202" />
                {adminLocationGeoValidationErrors.postalCode?.length ? <div className="text-danger small mt-1">{adminLocationGeoValidationErrors.postalCode[0]}</div> : null}
              </Form.Group>
            </div>
          </div>
          {adminLocationGeocodeResult ? (
            <div className="small text-muted mt-2">
              Geocode: {adminLocationGeocodeResult.normalizedQuery} · Source {adminLocationGeocodeResult.geocodeSource} · Confidence {Math.round(adminLocationGeocodeResult.confidenceScore * 100)}%
            </div>
          ) : null}
          <div className="mt-3">
            <div className="small fw-semibold d-flex align-items-center justify-content-between gap-2">
              <span>Facility operational snapshot</span>
              <IconActionButton
                iconClassName="bi bi-download"
                tooltip="Export facility snapshot metrics as CSV evidence."
                ariaLabel="Export facility snapshot metrics as CSV"
                onClick={() => {
                  void handleExportAdminLocationSnapshotCsv();
                }}
                disabled={adminLocationSnapshotLoading || !adminLocationGeoEditing}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-filetype-json"
                tooltip="Export facility snapshot payload as JSON evidence."
                ariaLabel="Export facility snapshot payload as JSON"
                onClick={() => {
                  void handleExportAdminLocationSnapshotJson();
                }}
                disabled={adminLocationSnapshotLoading || !adminLocationGeoEditing}
                variant="outline-secondary"
              />
            </div>
            {adminLocationSnapshotLoading ? (
              <div className="small text-muted">Loading snapshot...</div>
            ) : adminLocationSnapshot ? (
              <ListGroup className="mt-1">
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Facility name</span>
                  <strong>{adminLocationSnapshot.locationName || 'n/a'}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Organization</span>
                  <strong>{adminLocationSnapshot.organizationName || 'n/a'}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Region</span>
                  <strong>{adminLocationSnapshot.regionName || 'n/a'}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>City / State / Postal</span>
                  <strong>
                    {[adminLocationSnapshot.cityName, adminLocationSnapshot.stateCode, adminLocationSnapshot.postalCode]
                      .filter((value): value is string => Boolean(value && value.trim().length > 0))
                      .join(' / ') || 'n/a'}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Facility status</span>
                  <strong>{adminLocationSnapshot.isActive ? 'Active' : 'Inactive'}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Resource inventory rows</span>
                  <strong>{adminLocationSnapshot.resourceInventoryRowCount}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Total available quantity</span>
                  <strong>{adminLocationSnapshot.totalQuantityAvailable}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Total committed quantity</span>
                  <strong>{adminLocationSnapshot.totalQuantityCommitted}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Total out-of-service quantity</span>
                  <strong>{adminLocationSnapshot.totalQuantityOutOfService}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Last resource reported</span>
                  <strong>{adminLocationSnapshot.lastResourceReportedUtc ? new Date(adminLocationSnapshot.lastResourceReportedUtc).toLocaleString() : 'n/a'}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Bed snapshot rows</span>
                  <strong>{adminLocationSnapshot.bedSnapshotRowCount}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Total beds available</span>
                  <strong>{adminLocationSnapshot.totalBedsAvailable}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Total beds occupied</span>
                  <strong>{adminLocationSnapshot.totalBedsOccupied}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Total beds unavailable</span>
                  <strong>{adminLocationSnapshot.totalBedsUnavailable}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="small d-flex justify-content-between">
                  <span>Last bed reported</span>
                  <strong>{adminLocationSnapshot.lastBedReportedUtc ? new Date(adminLocationSnapshot.lastBedReportedUtc).toLocaleString() : 'n/a'}</strong>
                </ListGroup.Item>
              </ListGroup>
            ) : (
              <div className="small text-muted">No snapshot data available for this facility.</div>
            )}
          </div>
          {adminLocationSnapshot ? (
            <div className="mt-3">
              <div className="small fw-semibold mb-2">Facility status signals</div>
              {buildAdminLocationSnapshotSignals(adminLocationSnapshot).length > 0 ? (
                <div className="d-flex flex-wrap gap-2">
                  {buildAdminLocationSnapshotSignals(adminLocationSnapshot).map((signal, index) => (
                    <Badge key={`${signal.label}-${index}`} bg={signal.severity} className="small">
                      {signal.label}: {signal.detail}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="small text-muted">No critical or warning signals detected from current snapshot.</div>
              )}
            </div>
          ) : null}
          <div className="mt-3 border-top pt-3">
            <div className="small fw-semibold mb-2">Facility snapshot prompt kit</div>
            {(() => {
              if (!adminLocationSnapshot || !adminLocationSnapshotPromptGeneratedUtc) {
                return null;
              }

              const snapshotLatestUtc = [
                adminLocationSnapshot.lastResourceReportedUtc,
                adminLocationSnapshot.lastBedReportedUtc,
              ]
                .filter((value): value is string => Boolean(value))
                .sort();

              const snapshotLatestUtcValue = snapshotLatestUtc.length > 0
                ? snapshotLatestUtc[snapshotLatestUtc.length - 1]
                : null;

              const promptGeneratedAt = new Date(adminLocationSnapshotPromptGeneratedUtc).getTime();
              const snapshotLatestAt = snapshotLatestUtcValue ? new Date(snapshotLatestUtcValue).getTime() : null;
              const promptIsStale = snapshotLatestAt !== null && Number.isFinite(snapshotLatestAt) && Number.isFinite(promptGeneratedAt)
                ? promptGeneratedAt < snapshotLatestAt
                : false;

              return (
                <div className="small mb-2 d-flex align-items-center gap-2 flex-wrap">
                  <Badge bg={promptIsStale ? 'warning' : 'success'}>
                    {promptIsStale ? 'Prompt stale vs latest snapshot' : 'Prompt aligned to current snapshot'}
                  </Badge>
                  <span className="text-muted">
                    Generated: {new Date(adminLocationSnapshotPromptGeneratedUtc).toLocaleString()}
                  </span>
                </div>
              );
            })()}
            <div className="row g-2 align-items-end">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Prompt Template" info="Generate standardized ad-hoc/operator prompts from the current facility snapshot posture." /></Form.Label>
                  <Form.Select
                    value={adminLocationSnapshotPromptTemplate}
                    onChange={(event) => setAdminLocationSnapshotPromptTemplate(event.target.value as AdminLocationSnapshotPromptTemplate)}
                    disabled={!adminLocationSnapshot}
                  >
                    <option value="executive-brief">Executive brief</option>
                    <option value="operations-handoff">Operations handoff</option>
                    <option value="facility-status-check">Facility status check</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6 d-flex justify-content-md-end gap-2">
                <IconActionButton
                  iconClassName="bi bi-stars"
                  tooltip="Generate prompt text from current facility snapshot."
                  ariaLabel="Generate facility snapshot prompt"
                  onClick={handleGenerateAdminLocationSnapshotPrompt}
                  disabled={!adminLocationSnapshot}
                  variant="outline-primary"
                />
                <IconActionButton
                  iconClassName="bi bi-clipboard"
                  tooltip="Copy generated prompt text to clipboard."
                  ariaLabel="Copy facility snapshot prompt"
                  onClick={() => {
                    void handleCopyAdminLocationSnapshotPrompt();
                  }}
                  disabled={!adminLocationSnapshotPromptText.trim()}
                  variant="outline-secondary"
                />
                <IconActionButton
                  iconClassName="bi bi-download"
                  tooltip="Download generated prompt text as a TXT file."
                  ariaLabel="Download facility snapshot prompt text"
                  onClick={handleDownloadAdminLocationSnapshotPrompt}
                  disabled={!adminLocationSnapshotPromptText.trim()}
                  variant="outline-secondary"
                />
              </div>
            </div>
            <Form.Group className="mt-2">
              <Form.Label className="small mb-1"><LabelWithInfo text="Generated prompt text" info="Prompt text persists per facility for authenticated users and can be reused between sessions." /></Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={adminLocationSnapshotPromptText}
                onChange={(event) => setAdminLocationSnapshotPromptText(event.target.value)}
                placeholder="Generate a prompt from the current snapshot to assist executive briefs, handoffs, or facility status checks."
              />
            </Form.Group>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <IconActionButton
            iconClassName="bi bi-x-circle"
            tooltip="Cancel geolocation editor changes."
            ariaLabel="Cancel geolocation editor changes"
            onClick={() => setShowAdminLocationGeoModal(false)}
            variant="outline-secondary"
          />
          <IconActionButton
            iconClassName="bi bi-geo-alt"
            tooltip="Geocode the current location values and propose normalized coordinates."
            ariaLabel="Geocode facility location"
            onClick={() => {
              void handleGeocodeAdminLocation();
            }}
            disabled={adminLocationGeoLoading || !adminLocationGeoEditing}
            variant="outline-primary"
          />
          <IconActionButton
            iconClassName="bi bi-save"
            tooltip="Save facility geolocation metadata to the system record."
            ariaLabel="Save facility geolocation metadata"
            onClick={() => {
              void handleSaveAdminLocationGeo();
            }}
            disabled={adminLocationGeoLoading || !adminLocationGeoEditing}
            variant="primary"
          />
        </Modal.Footer>
      </Modal>

      <Modal
        show={showDataOpsConfirmModal}
        onHide={closeDataOpsConfirmModal}
        backdrop="static"
        keyboard={false}
        centered
      >
        <Modal.Header closeButton={!syntheticSeedLoading && !syntheticResetLoading}>
          <Modal.Title>Confirm synthetic data operation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="small mb-2">
            {pendingDataOpsAction === 'seed'
              ? 'Seed will insert synthetic/demo logistics records into IOCEM for demo-mode workflows.'
              : 'Reset will remove synthetic/demo logistics records from IOCEM and clear seeded demo posture.'}
          </div>
          <ListGroup className="mb-2">
            <ListGroup.Item className="small d-flex justify-content-between">
              <span>Environment</span>
              <strong>{readiness?.environment ?? 'n/a'}</strong>
            </ListGroup.Item>
            <ListGroup.Item className="small d-flex justify-content-between">
              <span>SQL connectivity</span>
              <strong>{readiness?.sqlConnectionConfigured ? 'Configured' : 'Missing'}</strong>
            </ListGroup.Item>
            <ListGroup.Item className="small d-flex justify-content-between">
              <span>DataOps endpoint readiness</span>
              <strong>{readiness?.adminDataOpsScriptExecutionEnabled ? 'Enabled' : 'Disabled'}</strong>
            </ListGroup.Item>
          </ListGroup>
          <Form.Group>
            <Form.Label className="small mb-1"><LabelWithInfo text="Confirmation acknowledgment" info="Type the exact confirmation phrase to authorize synthetic data seed/reset operations." />: <strong>{expectedDataOpsAck || 'SEED SYNTHETIC / RESET SYNTHETIC'}</strong></Form.Label>
            <Form.Control
              size="sm"
              value={dataOpsAckInput}
              onChange={(event) => setDataOpsAckInput(event.target.value)}
              placeholder={expectedDataOpsAck || 'Type acknowledgment text'}
              autoComplete="off"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <IconActionButton
            iconClassName="bi bi-x-circle"
            tooltip="Cancel synthetic data operation confirmation."
            ariaLabel="Cancel synthetic data operation confirmation"
            onClick={closeDataOpsConfirmModal}
            disabled={syntheticSeedLoading || syntheticResetLoading}
            variant="outline-secondary"
          />
          <IconActionButton
            iconClassName={pendingDataOpsAction === 'seed' ? 'bi bi-database-fill-add' : 'bi bi-trash3'}
            tooltip={pendingDataOpsAction === 'seed'
              ? 'Confirm synthetic logistics seed operation.'
              : 'Confirm synthetic logistics reset operation.'}
            ariaLabel={pendingDataOpsAction === 'seed'
              ? 'Confirm synthetic logistics seed operation'
              : 'Confirm synthetic logistics reset operation'}
            onClick={() => {
              void confirmDataOpsAction();
            }}
            disabled={!isDataOpsAckValid || syntheticSeedLoading || syntheticResetLoading || !pendingDataOpsAction}
            variant={pendingDataOpsAction === 'seed' ? 'success' : 'warning'}
          />
        </Modal.Footer>
      </Modal>
    </Card>
  );
}

export default AdminWorkspaceCard;

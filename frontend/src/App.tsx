/*
File: frontend/src/App.tsx
Blueprint Name: FrontendAppShell

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-14

Description:
Primary application shell for ipoc web operations UI.
Implements incident workspace, resource pilot panel, auth controls, and alert center UX.

Features:
  - Incident list/detail and command operations.
  - Resource inventory and bed snapshot pilot interactions.
  - Auth diagnostics, alert center, and collapsible navigation.

Security & Compliance:
  - Uses token-based API access and authenticated state guards.
  - Routes operational errors through controlled toast/alert channels.
  - Avoids displaying sensitive security token material in UI state.
*/

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionStatus } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import {
  Accordion,
  Button,
} from 'react-bootstrap';
import { msalConfigured } from './authConfig';
import type {
  BedAvailabilityItem,
  IcsPosition,
  IncidentCommandAssignment,
  IncidentCommunication,
  IncidentDetail,
  DashboardSummary,
  IncidentSummary,
  IncidentResourceRequest,
  IncidentTask,
  IncidentTimelineEvent,
  IncidentOperationalPeriod,
  IncidentObjective,
  IncidentOperationalInsight,
  ResourceInventoryItem,
  SituationReport,
  SystemReadiness,
  WeatherForecast,
} from './types';
const AdminWorkspaceCard = lazy(() => import('./components/admin/AdminWorkspaceCard'));
const AlertCenterPanel = lazy(() => import('./components/alerts/AlertCenterPanel'));
const ActiveIncidentBoardCard = lazy(() => import('./components/incidents/ActiveIncidentBoardCard'));
const CreateIncidentCard = lazy(() => import('./components/incidents/CreateIncidentCard'));
const IncidentCommandPaneCard = lazy(() => import('./components/incidents/IncidentCommandPaneCard'));
import AppShellLayout from './components/layout/AppShellLayout';
import { UserGuidePage } from './components/help';
const DashboardSnapshotCard = lazy(() => import('./components/layout/DashboardSnapshotCard'));
const AssistantDock = lazy(() => import('./components/agent/AssistantDock'));
const InteractiveIncidentAnalyticsCard = lazy(() => import('./components/layout/InteractiveIncidentAnalyticsCard'));
const IncidentWorkspaceCard = lazy(() => import('./components/layout/IncidentWorkspaceCard'));
const ReportingWorkspaceCard = lazy(() => import('./components/layout/ReportingWorkspaceCard'));
const AuditEvidenceCard = lazy(() => import('./components/layout/AuditEvidenceCard'));
const WeatherFeedCard = lazy(() => import('./components/layout/WeatherFeedCard'));
const CommonOperatingPictureCard = lazy(() => import('./components/cop/CommonOperatingPictureCard'));
const OperationsCoordinationCard = lazy(() => import('./components/navigation/OperationsCoordinationCard'));
const PlanningCycleCard = lazy(() => import('./components/navigation/PlanningCycleCard'));
const LogisticsCoordinationCard = lazy(() => import('./components/navigation/LogisticsCoordinationCard'));
const FinanceAdministrationCard = lazy(() => import('./components/navigation/FinanceAdministrationCard'));
const AfterActionReadinessCard = lazy(() => import('./components/navigation/AfterActionReadinessCard'));
const ResourcePostureCard = lazy(() => import('./components/resources/ResourcePostureCard'));
const FacilitiesCapacityAnalyticsCard = lazy(() => import('./components/resources/FacilitiesCapacityAnalyticsCard'));
const FacilitiesTrendDrilldownCard = lazy(() => import('./components/resources/FacilitiesTrendDrilldownCard'));
import { useAuthSessionActions } from './hooks/useAuthSessionActions';
import { useIncidentDataRefresh } from './hooks/useIncidentDataRefresh';
import { useIncidentWorkspaceActions } from './hooks/useIncidentWorkspaceActions';
import { useNotifications } from './hooks/useNotifications';
import { useOperationalDataLoading } from './hooks/useOperationalDataLoading';
import { useOperationalLookups } from './hooks/useOperationalLookups';
import { useResourceDataRefresh } from './hooks/useResourceDataRefresh';
import { useResourcePostureActions } from './hooks/useResourcePostureActions';
import { buildWeatherOperationalSignal } from './utils/weatherOperationalSignal';
import { applyThemeToDocument, predefinedThemes } from './theme';
import type { ThemePalette } from './theme';
import './App.css';

type AppView = 'dashboard' | 'incidents' | 'facilities' | 'reports' | 'cop' | 'operations' | 'planning' | 'logistics' | 'finance' | 'after-action';

const parseAppView = (value: string | null): AppView => {
  if (
    value === 'dashboard'
    || value === 'incidents'
    || value === 'facilities'
    || value === 'reports'
    || value === 'cop'
    || value === 'operations'
    || value === 'planning'
    || value === 'logistics'
    || value === 'finance'
    || value === 'after-action'
  ) {
    return value;
  }

  return 'dashboard';
};

function App() {
  const MIN_NAVIGATION_PANE_WIDTH = 320;
  const MAX_NAVIGATION_PANE_WIDTH = 420;
  const APP_SHELL_PRESET_SCOPE = 'app-shell';
  const APP_SHELL_PRESET_NAME = 'default';

  const viewSuspenseFallback = (
    <div className="small py-2 ipoc-loading-inline">
      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
      <span>Loading workspace module…</span>
    </div>
  );

  const { instance, accounts, inProgress } = useMsal();

  const [weather, setWeather] = useState<WeatherForecast[]>([]);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [readiness, setReadiness] = useState<SystemReadiness | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [incidentSearchText, setIncidentSearchText] = useState('');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('All');
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [incidentCreateNumber, setIncidentCreateNumber] = useState('');
  const [incidentCreateName, setIncidentCreateName] = useState('');
  const [incidentCreateTypeCode, setIncidentCreateTypeCode] = useState('');
  const [incidentCreateSeverity, setIncidentCreateSeverity] = useState('');
  const [incidentCreatePrimaryLocationId, setIncidentCreatePrimaryLocationId] = useState('');
  const [incidentCreateSummary, setIncidentCreateSummary] = useState('');
  const [incidentCreatePlanned, setIncidentCreatePlanned] = useState(false);
  const [incidentEditName, setIncidentEditName] = useState('');
  const [incidentEditTypeCode, setIncidentEditTypeCode] = useState('');
  const [incidentEditSeverity, setIncidentEditSeverity] = useState('');
  const [incidentEditPrimaryLocationId, setIncidentEditPrimaryLocationId] = useState('');
  const [incidentEditInitialSummary, setIncidentEditInitialSummary] = useState('');
  const [incidentEditSituationSummary, setIncidentEditSituationSummary] = useState('');
  const [incidentEditPlanned, setIncidentEditPlanned] = useState(false);
  const [incidentDetail, setIncidentDetail] = useState<IncidentDetail | null>(null);
  const [incidentDetailLoading, setIncidentDetailLoading] = useState(false);
  const [incidentDetailError, setIncidentDetailError] = useState<string | null>(null);
  const [incidentActionLoading, setIncidentActionLoading] = useState(false);
  const [incidentTasks, setIncidentTasks] = useState<IncidentTask[]>([]);
  const [incidentTasksLoading, setIncidentTasksLoading] = useState(false);
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskDescriptionInput, setTaskDescriptionInput] = useState('');
  const [taskPriorityInput, setTaskPriorityInput] = useState('');
  const [taskAssignedToUserIdInput, setTaskAssignedToUserIdInput] = useState('');
  const [taskDueInput, setTaskDueInput] = useState('');
  const [incidentTimelineEvents, setIncidentTimelineEvents] = useState<IncidentTimelineEvent[]>([]);
  const [incidentTimelineLoading, setIncidentTimelineLoading] = useState(false);
  const [timelineTypeInput, setTimelineTypeInput] = useState('');
  const [timelineTitleInput, setTimelineTitleInput] = useState('');
  const [timelineDescriptionInput, setTimelineDescriptionInput] = useState('');
  const [timelineEventUtcInput, setTimelineEventUtcInput] = useState('');
  const [incidentOperationalPeriods, setIncidentOperationalPeriods] = useState<IncidentOperationalPeriod[]>([]);
  const [incidentOperationalPeriodsLoading, setIncidentOperationalPeriodsLoading] = useState(false);
  const [operationalPeriodNumberInput, setOperationalPeriodNumberInput] = useState('');
  const [operationalPeriodNameInput, setOperationalPeriodNameInput] = useState('');
  const [operationalPeriodStartInput, setOperationalPeriodStartInput] = useState('');
  const [operationalPeriodEndInput, setOperationalPeriodEndInput] = useState('');
  const [operationalPeriodStatusInput, setOperationalPeriodStatusInput] = useState('Planned');
  const [operationalPeriodPlanningMeetingInput, setOperationalPeriodPlanningMeetingInput] = useState('');
  const [incidentObjectives, setIncidentObjectives] = useState<IncidentObjective[]>([]);
  const [incidentObjectivesLoading, setIncidentObjectivesLoading] = useState(false);
  const [objectiveOperationalPeriodIdInput, setObjectiveOperationalPeriodIdInput] = useState('');
  const [objectiveNumberInput, setObjectiveNumberInput] = useState('');
  const [objectiveTextInput, setObjectiveTextInput] = useState('');
  const [objectivePriorityInput, setObjectivePriorityInput] = useState('Normal');
  const [objectiveStatusInput, setObjectiveStatusInput] = useState('Open');
  const [objectiveOwnerUserIdInput, setObjectiveOwnerUserIdInput] = useState('');
  const [objectiveDueInput, setObjectiveDueInput] = useState('');
  const [icsPositions, setIcsPositions] = useState<IcsPosition[]>([]);
  const [icsPositionsLoading, setIcsPositionsLoading] = useState(false);
  const [incidentCommandAssignments, setIncidentCommandAssignments] = useState<IncidentCommandAssignment[]>([]);
  const [incidentCommandAssignmentsLoading, setIncidentCommandAssignmentsLoading] = useState(false);
  const [incidentWorkspaceResourceRequestCount, setIncidentWorkspaceResourceRequestCount] = useState(0);
  const [incidentWorkspaceCommunicationCount, setIncidentWorkspaceCommunicationCount] = useState(0);
  const [incidentWorkspaceSitrepCount, setIncidentWorkspaceSitrepCount] = useState(0);
  const [incidentWorkspaceResourceRequests, setIncidentWorkspaceResourceRequests] = useState<IncidentResourceRequest[]>([]);
  const [incidentWorkspaceCommunications, setIncidentWorkspaceCommunications] = useState<IncidentCommunication[]>([]);
  const [incidentWorkspaceSituationReports, setIncidentWorkspaceSituationReports] = useState<SituationReport[]>([]);
  const [incidentOperationalInsightRefreshNonce, setIncidentOperationalInsightRefreshNonce] = useState(0);
  const [incidentOperationalInsight, setIncidentOperationalInsight] = useState<IncidentOperationalInsight | null>(null);
  const [resourceInventory, setResourceInventory] = useState<ResourceInventoryItem[]>([]);
  const [bedAvailability, setBedAvailability] = useState<BedAvailabilityItem[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null);
  const [resourceTotalInput, setResourceTotalInput] = useState('');
  const [resourceAvailableInput, setResourceAvailableInput] = useState('');
  const [resourceCommittedInput, setResourceCommittedInput] = useState('');
  const [resourceOutOfServiceInput, setResourceOutOfServiceInput] = useState('');
  const [bedLocationIdInput, setBedLocationIdInput] = useState('');
  const [bedStaffedInput, setBedStaffedInput] = useState('');
  const [bedAvailableInput, setBedAvailableInput] = useState('');
  const [bedOccupiedInput, setBedOccupiedInput] = useState('');
  const [bedUnavailableInput, setBedUnavailableInput] = useState('');
  const [bedIsolationInput, setBedIsolationInput] = useState('');
  const [bedSurgeInput, setBedSurgeInput] = useState('');
  const [showAlertCenter, setShowAlertCenter] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<string | undefined>(undefined);
  const [showThemeStudio, setShowThemeStudio] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemePalette>(predefinedThemes[0]);
  const [navigationExpanded, setNavigationExpanded] = useState(true);
  const [navigationPaneWidth, setNavigationPaneWidth] = useState(280);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [viewAccordionState, setViewAccordionState] = useState<Record<AppView, string[]>>({
    dashboard: ['snapshot'],
    incidents: ['workspace'],
    facilities: ['capacity'],
    reports: ['reporting'],
    cop: ['cop-overview'],
    operations: ['ops-overview'],
    planning: ['planning-overview'],
    logistics: ['logistics-overview'],
    finance: ['finance-overview'],
    'after-action': ['aar-overview'],
  });
  const [reportWindowDays, setReportWindowDays] = useState(30);
  const [reportGroupBy, setReportGroupBy] = useState<'status' | 'type'>('status');
  const [reportStatusFilter, setReportStatusFilter] = useState('All');
  const [reportTypeFilter, setReportTypeFilter] = useState('All');
  const [appShellPreferencesReady, setAppShellPreferencesReady] = useState(false);
  const navigationResizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const currentUserLabel = accounts.length > 0 ? accounts[0].name ?? accounts[0].username ?? 'Authenticated User' : 'Guest';
  const isAuthenticated = accounts.length > 0;
  const isMsalBusy = inProgress !== InteractionStatus.None;
  const helpSearchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isHelpMode = helpSearchParams.get('help') === '1';
  const helpView = parseAppView(helpSearchParams.get('view'));

  useEffect(() => {
    if (accounts.length > 0 && instance.getActiveAccount() === null) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  useEffect(() => {
    const persistedActiveView = localStorage.getItem('ipoc.activeView');
    if (
      persistedActiveView === 'dashboard'
      || persistedActiveView === 'incidents'
      || persistedActiveView === 'facilities'
      || persistedActiveView === 'reports'
      || persistedActiveView === 'cop'
      || persistedActiveView === 'operations'
      || persistedActiveView === 'planning'
      || persistedActiveView === 'logistics'
      || persistedActiveView === 'finance'
      || persistedActiveView === 'after-action'
    ) {
      setActiveView(persistedActiveView);
    }

    const persistedReportWindow = Number(localStorage.getItem('ipoc.reportWindowDays'));
    if (Number.isFinite(persistedReportWindow) && persistedReportWindow > 0) {
      setReportWindowDays(persistedReportWindow);
    }

    const persistedReportGroupBy = localStorage.getItem('ipoc.reportGroupBy');
    if (persistedReportGroupBy === 'status' || persistedReportGroupBy === 'type') {
      setReportGroupBy(persistedReportGroupBy);
    }

    const persistedReportStatusFilter = localStorage.getItem('ipoc.reportStatusFilter');
    if (persistedReportStatusFilter) {
      setReportStatusFilter(persistedReportStatusFilter);
    }

    const persistedReportTypeFilter = localStorage.getItem('ipoc.reportTypeFilter');
    if (persistedReportTypeFilter) {
      setReportTypeFilter(persistedReportTypeFilter);
    }

    const persistedAccordionState = localStorage.getItem('ipoc.viewAccordionState');
    if (persistedAccordionState) {
      try {
        const parsed = JSON.parse(persistedAccordionState) as Partial<Record<AppView, unknown>>;
        setViewAccordionState((current) => ({
          dashboard: Array.isArray(parsed.dashboard) ? parsed.dashboard.filter((item): item is string => typeof item === 'string') : current.dashboard,
          incidents: Array.isArray(parsed.incidents) ? parsed.incidents.filter((item): item is string => typeof item === 'string') : current.incidents,
          facilities: Array.isArray(parsed.facilities) ? parsed.facilities.filter((item): item is string => typeof item === 'string') : current.facilities,
          reports: Array.isArray(parsed.reports) ? parsed.reports.filter((item): item is string => typeof item === 'string') : current.reports,
          cop: Array.isArray(parsed.cop) ? parsed.cop.filter((item): item is string => typeof item === 'string') : current.cop,
          operations: Array.isArray(parsed.operations) ? parsed.operations.filter((item): item is string => typeof item === 'string') : current.operations,
          planning: Array.isArray(parsed.planning) ? parsed.planning.filter((item): item is string => typeof item === 'string') : current.planning,
          logistics: Array.isArray(parsed.logistics) ? parsed.logistics.filter((item): item is string => typeof item === 'string') : current.logistics,
          finance: Array.isArray(parsed.finance) ? parsed.finance.filter((item): item is string => typeof item === 'string') : current.finance,
          'after-action': Array.isArray(parsed['after-action']) ? parsed['after-action'].filter((item): item is string => typeof item === 'string') : current['after-action'],
        }));
      } catch {
        // ignore invalid persisted accordion state
      }
    }

    const persistedNavigationWidth = Number(localStorage.getItem('ipoc.navigationPaneWidth'));
    if (Number.isFinite(persistedNavigationWidth)) {
      const clamped = Math.min(MAX_NAVIGATION_PANE_WIDTH, Math.max(MIN_NAVIGATION_PANE_WIDTH, persistedNavigationWidth));
      setNavigationPaneWidth(clamped);
    }

    setAppShellPreferencesReady(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('ipoc.navigationPaneWidth', String(navigationPaneWidth));
  }, [navigationPaneWidth]);

  useEffect(() => {
    localStorage.setItem('ipoc.reportWindowDays', String(reportWindowDays));
  }, [reportWindowDays]);

  useEffect(() => {
    localStorage.setItem('ipoc.reportGroupBy', reportGroupBy);
  }, [reportGroupBy]);

  useEffect(() => {
    localStorage.setItem('ipoc.reportStatusFilter', reportStatusFilter);
  }, [reportStatusFilter]);

  useEffect(() => {
    localStorage.setItem('ipoc.reportTypeFilter', reportTypeFilter);
  }, [reportTypeFilter]);

  useEffect(() => {
    localStorage.setItem('ipoc.viewAccordionState', JSON.stringify(viewAccordionState));
  }, [viewAccordionState]);

  const handleViewAccordionChange = (
    view: AppView,
    eventKey: string | string[] | null | undefined,
  ) => {
    const normalizedKeys = eventKey === null
      ? []
      : Array.isArray(eventKey)
        ? eventKey
        : [eventKey];

    setViewAccordionState((current) => ({
      ...current,
      [view]: normalizedKeys,
    }));
  };

  const isAccordionSectionOpen = (
    view: AppView,
    key: string,
  ) => viewAccordionState[view].includes(key);

  const handleNavigate = (view: AppView) => {
    setActiveView(view);
    localStorage.setItem('ipoc.activeView', view);
  };

  const handleOpenHelp = () => {
    const helpUrl = new URL(window.location.pathname, window.location.origin);
    helpUrl.searchParams.set('help', '1');
    helpUrl.searchParams.set('view', activeView);
    window.open(helpUrl.toString(), '_blank');
  };

  const handleStartNavigationResize = (clientX: number) => {
    if (!navigationExpanded) {
      return;
    }

    navigationResizeStateRef.current = {
      startX: clientX,
      startWidth: navigationPaneWidth,
    };
  };

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (!navigationResizeStateRef.current) {
        return;
      }

      const delta = event.clientX - navigationResizeStateRef.current.startX;
      const next = navigationResizeStateRef.current.startWidth + delta;
      setNavigationPaneWidth(Math.min(MAX_NAVIGATION_PANE_WIDTH, Math.max(MIN_NAVIGATION_PANE_WIDTH, next)));
    };

    const handlePointerUp = () => {
      navigationResizeStateRef.current = null;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const keyToView: Record<string, AppView> = {
      d: 'dashboard',
      i: 'incidents',
      f: 'facilities',
      r: 'reports',
      c: 'cop',
      o: 'operations',
      p: 'planning',
      l: 'logistics',
      n: 'finance',
      a: 'after-action',
    };

    let awaitingSecondKey = false;
    let resetTimeoutId: number | null = null;

    const clearLeaderKey = () => {
      awaitingSecondKey = false;
      if (resetTimeoutId !== null) {
        window.clearTimeout(resetTimeoutId);
        resetTimeoutId = null;
      }
    };

    const startLeaderWindow = () => {
      awaitingSecondKey = true;
      if (resetTimeoutId !== null) {
        window.clearTimeout(resetTimeoutId);
      }
      resetTimeoutId = window.setTimeout(() => {
        awaitingSecondKey = false;
        resetTimeoutId = null;
      }, 1200);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (!awaitingSecondKey) {
        if (key === 'g') {
          event.preventDefault();
          startLeaderWindow();
        }
        return;
      }

      event.preventDefault();
      if (key === 'z') {
        setShowAlertCenter(true);
        clearLeaderKey();
        return;
      }

      const targetView = keyToView[key];
      if (targetView) {
        handleNavigate(targetView);
      }
      clearLeaderKey();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearLeaderKey();
    };
  }, []);

  const {
    toastState,
    alertFeed,
    notificationSettings,
    showToast,
    closeToast,
    removeAlertItem,
    acknowledgeAlertItem,
    clearAlertFeed,
    setVariantEnabled,
    setStatusEnabled,
    setToastEnabled,
    setAlertFeedEnabled,
  } = useNotifications(isAuthenticated);

  const {
    incidentTypeLookups,
    incidentSeverityLookups,
    incidentStatusLookups,
    taskPriorityLookups,
    taskStatusLookups,
    timelineEventTypeLookups,
    resourceTypeLookups,
    locationLookups,
  } = useOperationalLookups(isAuthenticated, showToast);

  useEffect(() => {
    if (incidentTypeLookups.length > 0 && incidentCreateTypeCode.length === 0) {
      setIncidentCreateTypeCode(incidentTypeLookups[0].code);
    }
  }, [incidentTypeLookups, incidentCreateTypeCode]);

  useEffect(() => {
    if (taskPriorityLookups.length > 0 && taskPriorityInput.length === 0) {
      setTaskPriorityInput(taskPriorityLookups[0].code);
    }
  }, [taskPriorityLookups, taskPriorityInput]);

  useEffect(() => {
    if (timelineEventTypeLookups.length > 0 && timelineTypeInput.length === 0) {
      setTimelineTypeInput(timelineEventTypeLookups[0].code);
    }
  }, [timelineEventTypeLookups, timelineTypeInput]);

  useEffect(() => {
    if (locationLookups.length > 0 && bedLocationIdInput.length === 0) {
      setBedLocationIdInput(String(locationLookups[0].locationId));
    }
  }, [locationLookups, bedLocationIdInput]);

  useEffect(() => {
    if (locationLookups.length > 0 && incidentCreatePrimaryLocationId.length === 0) {
      setIncidentCreatePrimaryLocationId(String(locationLookups[0].locationId));
    }
  }, [locationLookups, incidentCreatePrimaryLocationId]);

  useOperationalDataLoading({
    isAuthenticated,
    selectedIncidentId,
    selectedIncidentPrimaryLocationId: incidentDetail?.primaryLocationId ?? null,
    onNotify: showToast,
    setWeather,
    setReadiness,
    setIncidentsLoading,
    setIncidents,
    setIncidentsError,
    setSelectedIncidentId,
    setIncidentDetail,
    setIncidentDetailLoading,
    setIncidentDetailError,
    setIncidentEditName,
    setIncidentEditTypeCode,
    setIncidentEditSeverity,
    setIncidentEditPrimaryLocationId,
    setIncidentEditInitialSummary,
    setIncidentEditSituationSummary,
    setIncidentEditPlanned,
    setIncidentTasks,
    setIncidentTimelineEvents,
    setIncidentOperationalPeriods,
    setIncidentObjectives,
    setIncidentCommandAssignments,
  });

  const filteredIncidents = useMemo(() => {
    const normalizedSearch = incidentSearchText.trim().toLowerCase();

    return incidents.filter((incident) => {
      const statusMatches = incidentStatusFilter === 'All' || incident.incidentStatusCode === incidentStatusFilter;
      const searchMatches =
        normalizedSearch.length === 0 ||
        incident.incidentNumber.toLowerCase().includes(normalizedSearch) ||
        incident.incidentName.toLowerCase().includes(normalizedSearch) ||
        incident.incidentTypeCode.toLowerCase().includes(normalizedSearch);

      return statusMatches && searchMatches;
    });
  }, [incidents, incidentSearchText, incidentStatusFilter]);

  const incidentStatusFilterOptions = useMemo(() => {
    const statusCodes = incidentStatusLookups.map((item) => item.code);
    return ['All', ...statusCodes];
  }, [incidentStatusLookups]);

  const averageTempF = useMemo(() => {
    if (weather.length === 0) {
      return 0;
    }

    const total = weather.reduce((sum, item) => sum + item.temperatureF, 0);
    return Math.round(total / weather.length);
  }, [weather]);
  const weatherOperationalSignal = useMemo(() => buildWeatherOperationalSignal(weather), [weather]);

  const recentResourceRows = useMemo(() => resourceInventory.slice(0, 8), [resourceInventory]);
  const recentBedRows = useMemo(() => bedAvailability.slice(0, 12), [bedAvailability]);
  const activeIncidentCount = useMemo(
    () => incidents.filter((incident) => incident.incidentStatusCode !== 'Closed').length,
    [incidents],
  );
  const closedIncidentCount = useMemo(
    () => incidents.filter((incident) => incident.incidentStatusCode === 'Closed').length,
    [incidents],
  );
  const selectedIncidentOpenTaskCount = useMemo(
    () => incidentTasks.filter((task) => task.statusCode !== 'Completed').length,
    [incidentTasks],
  );
  const selectedIncidentTimelineCount = useMemo(
    () => incidentTimelineEvents.length,
    [incidentTimelineEvents],
  );

  useEffect(() => {
    if (!isAuthenticated || selectedIncidentId === null) {
      setIncidentWorkspaceResourceRequestCount(0);
      setIncidentWorkspaceCommunicationCount(0);
      setIncidentWorkspaceSitrepCount(0);
      setIncidentWorkspaceResourceRequests([]);
      setIncidentWorkspaceCommunications([]);
      setIncidentWorkspaceSituationReports([]);
      setIncidentOperationalInsight(null);
      return;
    }

    const controller = new AbortController();

    void Promise.all([
      import('./api').then((api) => api.getIncidentResourceRequests(selectedIncidentId, controller.signal)),
      import('./api').then((api) => api.getIncidentCommunications(selectedIncidentId, controller.signal)),
      import('./api').then((api) => api.getSituationReports(selectedIncidentId, controller.signal)),
    ])
      .then(([resourceRequests, communications, situationReports]) => {
        setIncidentWorkspaceResourceRequests(resourceRequests);
        setIncidentWorkspaceCommunications(communications);
        setIncidentWorkspaceSituationReports(situationReports);
        setIncidentWorkspaceResourceRequestCount(resourceRequests.length);
        setIncidentWorkspaceCommunicationCount(communications.length);
        setIncidentWorkspaceSitrepCount(situationReports.length);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setIncidentWorkspaceResourceRequests([]);
        setIncidentWorkspaceCommunications([]);
        setIncidentWorkspaceSituationReports([]);
        setIncidentWorkspaceResourceRequestCount(0);
        setIncidentWorkspaceCommunicationCount(0);
        setIncidentWorkspaceSitrepCount(0);
        setIncidentOperationalInsight(null);
      });

    return () => {
      controller.abort();
    };
  }, [
    incidentDetail?.incidentStatusCode,
    incidentTasks,
    incidentTimelineEvents,
    incidentObjectives,
    incidentOperationalPeriods,
    incidentCommandAssignments,
    incidentOperationalInsightRefreshNonce,
    isAuthenticated,
    selectedIncidentId,
    selectedIncidentOpenTaskCount,
  ]);

  useEffect(() => {
    if (!isAuthenticated || selectedIncidentId === null) {
      return;
    }

    const nowUtcMs = Date.now();
    const ms24h = 24 * 60 * 60 * 1000;
    const cutoff24hMs = nowUtcMs - ms24h;
    const overdueTaskCount = incidentTasks.filter((task) => (
      task.statusCode !== 'Completed'
      && task.dueUtc !== null
      && new Date(task.dueUtc).getTime() < nowUtcMs
    )).length;
    const taskActivity24hCount = incidentTasks.filter((task) => {
      const createdMs = Date.parse(task.createdUtc);
      const updatedMs = task.updatedUtc ? Date.parse(task.updatedUtc) : NaN;
      const completedMs = task.completedUtc ? Date.parse(task.completedUtc) : NaN;
      return (Number.isFinite(createdMs) && createdMs >= cutoff24hMs)
        || (Number.isFinite(updatedMs) && updatedMs >= cutoff24hMs)
        || (Number.isFinite(completedMs) && completedMs >= cutoff24hMs);
    }).length;
    const taskActivity24hDelta = taskActivity24hCount - Math.max(0, incidentTasks.length - taskActivity24hCount);

    const latestTimelineUtc = incidentTimelineEvents.length === 0
      ? null
      : incidentTimelineEvents.reduce((latest, item) => (
        latest === null || new Date(item.eventUtc).getTime() > new Date(latest).getTime()
          ? item.eventUtc
          : latest
      ), null as string | null);
    const timelineActivity24hCount = incidentTimelineEvents.filter((item) => {
      const eventMs = Date.parse(item.eventUtc);
      return Number.isFinite(eventMs) && eventMs >= cutoff24hMs;
    }).length;
    const timelineActivity24hDelta = timelineActivity24hCount - Math.max(0, incidentTimelineEvents.length - timelineActivity24hCount);
    const staleTimelineHours = latestTimelineUtc === null
      ? null
      : Math.floor((nowUtcMs - new Date(latestTimelineUtc).getTime()) / (1000 * 60 * 60));

    const latestSitrepUtc = incidentWorkspaceSituationReports.length === 0
      ? null
      : incidentWorkspaceSituationReports.reduce((latest, item) => (
        latest === null || new Date(item.reportedUtc).getTime() > new Date(latest).getTime()
          ? item.reportedUtc
          : latest
      ), null as string | null);
    const staleSitrepHours = latestSitrepUtc === null
      ? null
      : Math.floor((nowUtcMs - new Date(latestSitrepUtc).getTime()) / (1000 * 60 * 60));

    const communicationActivity24hCount = incidentWorkspaceCommunications.filter((item) => {
      const loggedMs = Date.parse(item.loggedUtc);
      return Number.isFinite(loggedMs) && loggedMs >= cutoff24hMs;
    }).length;
    const communicationActivity24hDelta = communicationActivity24hCount - Math.max(0, incidentWorkspaceCommunications.length - communicationActivity24hCount);

    const needsAttentionReasons: string[] = [];
    if (overdueTaskCount > 0) {
      needsAttentionReasons.push(`Overdue tasks: ${overdueTaskCount}`);
    }
    if (staleTimelineHours !== null && staleTimelineHours > 24) {
      needsAttentionReasons.push(`Timeline not updated in ${staleTimelineHours}h`);
    }
    if (incidentWorkspaceSituationReports.length === 0) {
      needsAttentionReasons.push('No SITREP published');
    } else if (staleSitrepHours !== null && staleSitrepHours > 24) {
      needsAttentionReasons.push(`SITREP not updated in ${staleSitrepHours}h`);
    }
    if (communicationActivity24hCount === 0 && incidentWorkspaceCommunications.length > 0) {
      needsAttentionReasons.push('No communications activity in last 24h');
    }
    if (taskActivity24hCount === 0 && incidentTasks.length > 0) {
      needsAttentionReasons.push('No task activity in last 24h');
    }

    let attentionScore = 0;
    attentionScore += Math.min(5, overdueTaskCount);
    if (staleTimelineHours !== null && staleTimelineHours > 24) {
      attentionScore += Math.min(4, Math.floor(staleTimelineHours / 24));
    }
    if (staleSitrepHours !== null && staleSitrepHours > 24) {
      attentionScore += Math.min(4, Math.floor(staleSitrepHours / 24));
    }
    if (incidentWorkspaceSituationReports.length === 0) {
      attentionScore += 3;
    }
    if (communicationActivity24hCount === 0 && incidentWorkspaceCommunications.length > 0) {
      attentionScore += 2;
    }
    if (taskActivity24hCount === 0 && incidentTasks.length > 0) {
      attentionScore += 2;
    }

    const attentionLevel: 'low' | 'moderate' | 'high' = attentionScore >= 8
      ? 'high'
      : attentionScore >= 4
        ? 'moderate'
        : 'low';

    const objectiveCompletionRatio = incidentObjectives.length === 0
      ? 0
      : incidentObjectives.filter((objective) => objective.statusCode === 'Completed').length / incidentObjectives.length;
    const isIncidentActive = (incidentDetail?.incidentStatusCode ?? '').toLowerCase() === 'active';
    const staleSitrepPenalty = staleSitrepHours !== null && staleSitrepHours > 24 ? 10 : 0;
    const staleTimelinePenalty = staleTimelineHours !== null && staleTimelineHours > 24 ? 10 : 0;
    const overduePenalty = Math.min(20, overdueTaskCount * 2);
    const communicationPenalty = communicationActivity24hCount === 0 && incidentWorkspaceCommunications.length > 0 ? 10 : 0;
    const sitrepCoveragePenalty = incidentWorkspaceSituationReports.length === 0 ? 15 : 0;
    const baseMaturity = isIncidentActive ? 80 : 70;
    const maturityScore = Math.max(0, Math.min(100,
      Math.round(baseMaturity - staleSitrepPenalty - staleTimelinePenalty - overduePenalty - communicationPenalty - sitrepCoveragePenalty + Math.round(objectiveCompletionRatio * 10)),
    ));

    const maturityLevel: 'Type5' | 'Type4' | 'Type3' | 'Type2' | 'Type1' = maturityScore >= 85
      ? 'Type1'
      : maturityScore >= 70
        ? 'Type2'
        : maturityScore >= 55
          ? 'Type3'
          : maturityScore >= 40
            ? 'Type4'
            : 'Type5';

    const commandPostureRecommendations: string[] = [];
    if (maturityLevel === 'Type1' || maturityLevel === 'Type2') {
      commandPostureRecommendations.push('Maintain unified command staffing; monitor for complexity surge.');
    }
    if (maturityLevel === 'Type3' || maturityLevel === 'Type4') {
      commandPostureRecommendations.push('Increase planning cadence and section chief coordination for next operational period.');
    }
    if (maturityLevel === 'Type4' || maturityLevel === 'Type5') {
      commandPostureRecommendations.push('Consider EOC escalation posture and add logistics/finance command depth.');
    }
    if (staleSitrepHours !== null && staleSitrepHours > 24) {
      commandPostureRecommendations.push('Publish SITREP update to restore decision-cycle confidence.');
    }
    if (overdueTaskCount > 0) {
      commandPostureRecommendations.push(`Resolve ${overdueTaskCount} overdue task(s) or reassign ownership.`);
    }

    const nimsComplianceGaps: string[] = [];
    if (incidentObjectives.length === 0) {
      nimsComplianceGaps.push('No incident objectives recorded for current planning cycle.');
    }
    if (incidentOperationalPeriods.length === 0) {
      nimsComplianceGaps.push('No operational period established.');
    } else if (!incidentOperationalPeriods.some((period) => period.statusCode === 'Approved' || period.statusCode === 'Active')) {
      nimsComplianceGaps.push('No approved or active operational period in effect.');
    }
    if (incidentCommandAssignments.length === 0) {
      nimsComplianceGaps.push('ICS command assignments are not established.');
    }
    if (incidentWorkspaceSituationReports.length === 0) {
      nimsComplianceGaps.push('No SITREP published for current incident lifecycle.');
    }
    if (staleSitrepHours !== null && staleSitrepHours > 24) {
      nimsComplianceGaps.push(`SITREP stale (${staleSitrepHours}h since update).`);
    }
    if (overdueTaskCount > 0) {
      nimsComplianceGaps.push(`Overdue tasks present (${overdueTaskCount}).`);
    }

    const nimsComplianceScore = Math.max(0, Math.min(100, 100 - (nimsComplianceGaps.length * 12)));
    const nimsComplianceLevel: 'compliant' | 'watch' | 'at-risk' = nimsComplianceScore >= 80
      ? 'compliant'
      : nimsComplianceScore >= 60
        ? 'watch'
        : 'at-risk';

    const openObjectives = incidentObjectives.filter((objective) => objective.statusCode !== 'Completed').length;
    const openTasks = incidentTasks.filter((task) => task.statusCode !== 'Completed').length;
    const blockerWarnings: string[] = [];
    if (openObjectives > 0 && incidentCommandAssignments.length === 0) {
      blockerWarnings.push('Open objectives without ICS command assignments.');
    }
    if (openTasks > 0 && communicationActivity24hCount === 0 && incidentWorkspaceCommunications.length > 0) {
      blockerWarnings.push('Open tasks with no communication activity in last 24h.');
    }
    if (openTasks > 0 && incidentWorkspaceResourceRequests.length === 0) {
      blockerWarnings.push('Open tasks with no linked resource requests in workspace.');
    }
    if (incidentOperationalPeriods.length > 0 && !incidentOperationalPeriods.some((period) => period.statusCode === 'Approved' || period.statusCode === 'Active')) {
      blockerWarnings.push('Operational periods are not approved/active for execution cycle.');
    }

    const missionDependencyNodeCount = openObjectives + openTasks;
    const missionDependencyEdgeCount = blockerWarnings.length;
    const missionDependencyStatus: 'stable' | 'watch' | 'critical' = blockerWarnings.length >= 3
      ? 'critical'
      : blockerWarnings.length >= 1
        ? 'watch'
        : 'stable';

    setIncidentOperationalInsight({
      hasIncident: true,
      incidentStatusCode: incidentDetail?.incidentStatusCode ?? null,
      openTaskCount: selectedIncidentOpenTaskCount,
      totalTaskCount: incidentTasks.length,
      overdueTaskCount,
      taskActivity24hCount,
      taskActivity24hDelta,
      timelineEventCount: incidentTimelineEvents.length,
      timelineActivity24hCount,
      timelineActivity24hDelta,
      latestTimelineUtc,
      staleTimelineHours,
      communicationCount: incidentWorkspaceCommunications.length,
      communicationActivity24hCount,
      communicationActivity24hDelta,
      sitrepCount: incidentWorkspaceSituationReports.length,
      latestSitrepUtc,
      staleSitrepHours,
      resourceRequestCount: incidentWorkspaceResourceRequests.length,
      needsAttention: needsAttentionReasons.length > 0,
      attentionScore,
      attentionLevel,
      needsAttentionReasons,
      maturityScore,
      maturityLevel,
      commandPostureRecommendations,
      nimsComplianceScore,
      nimsComplianceLevel,
      nimsComplianceGaps,
      missionDependencyStatus,
      missionDependencyNodeCount,
      missionDependencyEdgeCount,
      missionDependencyBlockers: blockerWarnings,
    });
  }, [
    incidentDetail?.incidentStatusCode,
    incidentTasks,
    incidentTimelineEvents,
    incidentObjectives,
    incidentOperationalPeriods,
    incidentCommandAssignments,
    incidentWorkspaceCommunications,
    incidentWorkspaceResourceRequests,
    incidentWorkspaceSituationReports,
    incidentOperationalInsightRefreshNonce,
    isAuthenticated,
    selectedIncidentId,
    selectedIncidentOpenTaskCount,
  ]);

  const {
    refreshIncidents,
    refreshSelectedIncidentDetail,
    refreshIncidentTasks,
    refreshIncidentTimeline,
    refreshIncidentOperationalPeriods,
    refreshIncidentObjectives,
    refreshIcsPositions,
    refreshIncidentCommandAssignments,
  } = useIncidentDataRefresh({
    isAuthenticated,
    selectedIncidentId,
    setIncidents,
    setIncidentsError,
    setIncidentDetail,
    setIncidentDetailLoading,
    setIncidentDetailError,
    setIncidentTasks,
    setIncidentTasksLoading,
    setIncidentTimelineEvents,
    setIncidentTimelineLoading,
    setIncidentOperationalPeriods,
    setIncidentOperationalPeriodsLoading,
    setIncidentObjectives,
    setIncidentObjectivesLoading,
    setIcsPositions,
    setIcsPositionsLoading,
    setIncidentCommandAssignments,
    setIncidentCommandAssignmentsLoading,
    onNotify: showToast,
  });

  const { refreshResources } = useResourceDataRefresh({
    isAuthenticated,
    selectedInventoryId,
    bedLocationIdInput,
    setResourceInventory,
    setBedAvailability,
    setResourceLoading,
    setSelectedInventoryId,
    setBedLocationIdInput,
    onNotify: showToast,
  });

  const {
    authMe,
    authMeError,
    handleSignIn,
    handleSignOut,
  } = useAuthSessionActions({
    instance,
    accountsLength: accounts.length,
    onNotify: showToast,
  });

  const authRedirectInitiatedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated || !msalConfigured || authRedirectInitiatedRef.current || isMsalBusy) {
      return;
    }

    authRedirectInitiatedRef.current = true;
    void handleSignIn();
  }, [handleSignIn, isAuthenticated, isMsalBusy]);

  const {
    handleCreateIncident,
    handleSaveIncidentMetadata,
    handleCreateIncidentTask,
    handleUpdateIncidentTaskStatus,
    handleUpdateIncidentTaskAssignment,
    handleCreateIncidentTimelineEvent,
    handleCreateOperationalPeriod,
    handleApproveOperationalPeriod,
    handleReopenOperationalPeriod,
    handleCreateObjective,
    handleUpdateOperationalPeriod,
    handleUpdateObjective,
    handleActivateIncident,
    handleCloseIncident,
    handleAssignCommandPosition,
    handleRemoveCommandAssignment,
  } = useIncidentWorkspaceActions({
    isAuthenticated,
    selectedIncidentId,
    incidentDetail,
    incidentCreateNumber,
    incidentCreateName,
    incidentCreateTypeCode,
    incidentCreateSeverity,
    incidentCreatePrimaryLocationId,
    incidentCreateSummary,
    incidentCreatePlanned,
    incidentEditName,
    incidentEditTypeCode,
    incidentEditSeverity,
    incidentEditPrimaryLocationId,
    incidentEditInitialSummary,
    incidentEditSituationSummary,
    incidentEditPlanned,
    taskTitleInput,
    taskDescriptionInput,
    taskPriorityInput,
    taskAssignedToUserIdInput,
    taskDueInput,
    timelineTypeInput,
    timelineTitleInput,
    timelineDescriptionInput,
    timelineEventUtcInput,
    operationalPeriodNumberInput,
    operationalPeriodNameInput,
    operationalPeriodStartInput,
    operationalPeriodEndInput,
    operationalPeriodStatusInput,
    operationalPeriodPlanningMeetingInput,
    objectiveOperationalPeriodIdInput,
    objectiveNumberInput,
    objectiveTextInput,
    objectivePriorityInput,
    objectiveStatusInput,
    objectiveOwnerUserIdInput,
    objectiveDueInput,
    incidentTypeLookups,
    taskPriorityLookups,
    timelineEventTypeLookups,
    locationLookups,
    refreshIncidents,
    refreshSelectedIncidentDetail,
    refreshIncidentTasks,
    refreshIncidentTimeline,
    refreshIncidentOperationalPeriods,
    refreshIncidentObjectives,
    refreshIncidentCommandAssignments,
    onNotify: showToast,
    setSelectedIncidentId,
    setIncidentActionLoading,
    setIncidentDetailError,
    setIncidentCreateNumber,
    setIncidentCreateName,
    setIncidentCreateTypeCode,
    setIncidentCreateSeverity,
    setIncidentCreatePrimaryLocationId,
    setIncidentCreateSummary,
    setIncidentCreatePlanned,
    setTaskTitleInput,
    setTaskDescriptionInput,
    setTaskPriorityInput,
    setTaskAssignedToUserIdInput,
    setTaskDueInput,
    setTimelineTypeInput,
    setTimelineTitleInput,
    setTimelineDescriptionInput,
    setTimelineEventUtcInput,
    setOperationalPeriodNumberInput,
    setOperationalPeriodNameInput,
    setOperationalPeriodStartInput,
    setOperationalPeriodEndInput,
    setOperationalPeriodStatusInput,
    setOperationalPeriodPlanningMeetingInput,
    setObjectiveOperationalPeriodIdInput,
    setObjectiveNumberInput,
    setObjectiveTextInput,
    setObjectivePriorityInput,
    setObjectiveStatusInput,
    setObjectiveOwnerUserIdInput,
    setObjectiveDueInput,
  });

  const {
    handleUpdateInventory,
    handleAddBedSnapshot,
  } = useResourcePostureActions({
    isAuthenticated,
    selectedInventoryId,
    bedLocationIdInput,
    resourceTotalInput,
    resourceAvailableInput,
    resourceCommittedInput,
    resourceOutOfServiceInput,
    bedStaffedInput,
    bedAvailableInput,
    bedOccupiedInput,
    bedUnavailableInput,
    bedIsolationInput,
    bedSurgeInput,
    refreshResources,
    onNotify: showToast,
  });

  useEffect(() => {
    const savedThemeId = localStorage.getItem('ipoc.activeThemeId');
    const savedCustomTheme = localStorage.getItem('ipoc.customTheme');

    if (savedThemeId === 'custom' && savedCustomTheme) {
      try {
        const parsed = JSON.parse(savedCustomTheme) as ThemePalette;
        const customTheme: ThemePalette = {
          ...parsed,
          id: 'custom',
          name: parsed.name || 'Custom Theme',
        };
        setActiveTheme(customTheme);
        applyThemeToDocument(customTheme);
        return;
      } catch {
        // Fall back to default theme.
      }
    }

    const matchedTheme = predefinedThemes.find((theme) => theme.id === savedThemeId) ?? predefinedThemes[0];
    setActiveTheme(matchedTheme);
    applyThemeToDocument(matchedTheme);
  }, []);

  useEffect(() => {
    applyThemeToDocument(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    if (!isAuthenticated || !appShellPreferencesReady) {
      return;
    }

    let cancelled = false;

    const loadServerPreferences = async () => {
      try {
        const api = await import('./api');
        const presets = await api.getUserReportPresets(APP_SHELL_PRESET_SCOPE);
        const preset = presets.find((item) => item.presetName === APP_SHELL_PRESET_NAME) ?? presets[0] ?? null;

        if (!preset || !preset.presetJson) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          activeView?: AppView;
          reportWindowDays?: number;
          reportGroupBy?: 'status' | 'type';
          reportStatusFilter?: string;
          reportTypeFilter?: string;
          activeThemeId?: string;
          customTheme?: ThemePalette;
        };

        if (cancelled) {
          return;
        }

        if (
          parsed.activeView === 'dashboard'
          || parsed.activeView === 'incidents'
          || parsed.activeView === 'facilities'
          || parsed.activeView === 'reports'
          || parsed.activeView === 'cop'
          || parsed.activeView === 'operations'
          || parsed.activeView === 'planning'
          || parsed.activeView === 'logistics'
          || parsed.activeView === 'finance'
          || parsed.activeView === 'after-action'
        ) {
          setActiveView(parsed.activeView);
        }

        if (Number.isFinite(parsed.reportWindowDays) && Number(parsed.reportWindowDays) > 0) {
          setReportWindowDays(Number(parsed.reportWindowDays));
        }

        if (parsed.reportGroupBy === 'status' || parsed.reportGroupBy === 'type') {
          setReportGroupBy(parsed.reportGroupBy);
        }

        if (typeof parsed.reportStatusFilter === 'string' && parsed.reportStatusFilter.length > 0) {
          setReportStatusFilter(parsed.reportStatusFilter);
        }

        if (typeof parsed.reportTypeFilter === 'string' && parsed.reportTypeFilter.length > 0) {
          setReportTypeFilter(parsed.reportTypeFilter);
        }

        if (parsed.activeThemeId === 'custom' && parsed.customTheme) {
          setActiveTheme({
            ...parsed.customTheme,
            id: 'custom',
            name: parsed.customTheme.name || 'Custom Theme',
          });
        } else if (typeof parsed.activeThemeId === 'string' && parsed.activeThemeId.length > 0) {
          const matchedTheme = predefinedThemes.find((theme) => theme.id === parsed.activeThemeId);
          if (matchedTheme) {
            setActiveTheme(matchedTheme);
          }
        }
      } catch {
        // Silent fallback to local preferences.
      }
    };

    void loadServerPreferences();

    return () => {
      cancelled = true;
    };
  }, [APP_SHELL_PRESET_NAME, APP_SHELL_PRESET_SCOPE, appShellPreferencesReady, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !appShellPreferencesReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const payload = {
        activeView,
        reportWindowDays,
        reportGroupBy,
        reportStatusFilter,
        reportTypeFilter,
        activeThemeId: activeTheme.id,
        customTheme: activeTheme.id === 'custom' ? activeTheme : null,
      };

      void import('./api')
        .then((api) => api.upsertUserReportPreset(APP_SHELL_PRESET_SCOPE, {
          presetName: APP_SHELL_PRESET_NAME,
          presetJson: JSON.stringify(payload),
        }))
        .catch(() => {
          // Silent fallback to local preferences.
        });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    APP_SHELL_PRESET_NAME,
    APP_SHELL_PRESET_SCOPE,
    activeTheme,
    activeView,
    appShellPreferencesReady,
    isAuthenticated,
    reportGroupBy,
    reportStatusFilter,
    reportTypeFilter,
    reportWindowDays,
  ]);

  const handleApplyTheme = (theme: ThemePalette) => {
    setActiveTheme(theme);
    localStorage.setItem('ipoc.activeThemeId', theme.id);
    if (theme.id === 'custom') {
      localStorage.setItem('ipoc.customTheme', JSON.stringify(theme));
    }
    setShowThemeStudio(false);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setDashboardSummary(null);
      return;
    }

    const loadDashboardSummary = async () => {
      try {
        const api = await import('./api');
        const summary = await api.getDashboardSummary();
        setDashboardSummary(summary);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load dashboard summary.';
        showToast(message, 'danger');
      }
    };

    void loadDashboardSummary();
  }, [isAuthenticated, showToast]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void import('./api')
      .then((api) => api.getDashboardSummary())
      .then((summary) => setDashboardSummary(summary))
      .catch(() => {
        // No-op; notification handled by command/refresh actions when relevant.
      });
  }, [
    isAuthenticated,
    incidents,
    incidentTasks,
    incidentObjectives,
    incidentTimelineEvents,
  ]);

  useEffect(() => {
    void refreshResources();
  }, [refreshResources]);

  if (isHelpMode) {
    return (
      <Suspense fallback={viewSuspenseFallback}>
        <UserGuidePage initialView={helpView} />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center p-4">
          <h1 className="h4 mb-3">Authentication Required</h1>
          <p className="text-muted mb-3">
            {isMsalBusy
              ? 'Completing sign-in...'
              : 'Sign in with your Microsoft Entra account to access IPOC.'}
          </p>
          <Button
            variant="primary"
            onClick={() => void handleSignIn()}
            disabled={!msalConfigured || isMsalBusy}
          >
            {isMsalBusy ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShellLayout
      currentUserLabel={currentUserLabel}
      alertCount={alertFeed.length}
      incidentCount={incidents.length}
      operationsOpenTaskCount={selectedIncidentOpenTaskCount}
      planningSitrepCount={incidentWorkspaceSitrepCount}
      logisticsResourceRequestCount={incidentWorkspaceResourceRequestCount}
      financeActiveIncidentCount={activeIncidentCount}
      afterActionClosedIncidentCount={closedIncidentCount}
      hasAccounts={accounts.length > 0}
      msalConfigured={msalConfigured}
      navigationExpanded={navigationExpanded}
      navigationPaneWidth={navigationPaneWidth}
      activeView={activeView}
      showAdminPanel={showAdminPanel}
      showThemeStudio={showThemeStudio}
      activeThemeId={activeTheme.id}
      activeThemeName={activeTheme.name}
      toastState={toastState}
      onOpenAlertCenter={() => setShowAlertCenter(true)}
      onOpenAdminPanel={() => {
        setAdminInitialTab(undefined);
        setShowAdminPanel(true);
      }}
      onCloseAdminPanel={() => setShowAdminPanel(false)}
      onOpenThemeStudio={() => setShowThemeStudio(true)}
      onOpenHelp={handleOpenHelp}
      onCloseThemeStudio={() => setShowThemeStudio(false)}
      onApplyTheme={handleApplyTheme}
      onNavigate={handleNavigate}
      onSignIn={() => void handleSignIn()}
      onSignOut={() => void handleSignOut()}
      onToggleNavigation={() => setNavigationExpanded((current) => !current)}
      onStartNavigationResize={handleStartNavigationResize}
      onCloseToast={closeToast}
      adminPanelContent={(
        <Suspense fallback={viewSuspenseFallback}>
          <AdminWorkspaceCard
            readiness={readiness}
            authMe={authMe}
            authMeError={authMeError}
            isAuthenticated={isAuthenticated}
            initialActiveTab={adminInitialTab}
            onNotify={showToast}
            notificationSettings={notificationSettings}
            onSetToastEnabled={setToastEnabled}
            onSetAlertFeedEnabled={setAlertFeedEnabled}
            onSetNotificationVariantEnabled={setVariantEnabled}
            onSetNotificationStatusEnabled={setStatusEnabled}
          />
        </Suspense>
      )}

      alertCenterPanel={(
        <Suspense fallback={viewSuspenseFallback}>
          <AlertCenterPanel
            show={showAlertCenter}
            onHide={() => setShowAlertCenter(false)}
            alertFeed={alertFeed}
            onClear={clearAlertFeed}
            onAcknowledge={(alertId) => {
              acknowledgeAlertItem(alertId);
            }}
            onRemove={removeAlertItem}
          />
        </Suspense>
      )}
      assistantDock={(
        <Suspense fallback={null}>
          <AssistantDock
            isAuthenticated={isAuthenticated}
            authRoles={authMe?.roles ?? []}
            onNotify={showToast}
          />
        </Suspense>
      )}
    >
      {/* Dashboard View */}
      {activeView === 'dashboard' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState.dashboard}
          onSelect={(eventKey) => handleViewAccordionChange('dashboard', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="snapshot">
            <Accordion.Header>Dashboard Snapshot</Accordion.Header>
            <Accordion.Body>
              {isAccordionSectionOpen('dashboard', 'snapshot') && (
                <Suspense fallback={viewSuspenseFallback}>
                  <DashboardSnapshotCard
                    averageTempF={averageTempF}
                    incidentCount={dashboardSummary?.totalIncidentCount ?? incidents.length}
                    activeIncidentCount={dashboardSummary?.activeIncidentCount ?? activeIncidentCount}
                    selectedIncidentOpenTaskCount={dashboardSummary?.openTaskCount ?? selectedIncidentOpenTaskCount}
                    selectedIncidentTimelineCount={selectedIncidentTimelineCount}
                    readinessStatus={readiness?.status ?? 'Unknown'}
                    degradedModeEnabled={Boolean(readiness?.degradedReadFallbackEnabled)}
                    maturityLevel={incidentOperationalInsight?.maturityLevel ?? 'unknown'}
                    maturityScore={incidentOperationalInsight?.maturityScore ?? null}
                    nimsComplianceLevel={incidentOperationalInsight?.nimsComplianceLevel ?? 'unknown'}
                    nimsComplianceScore={incidentOperationalInsight?.nimsComplianceScore ?? null}
                    nimsComplianceGapCount={incidentOperationalInsight?.nimsComplianceGaps.length ?? 0}
                    missionDependencyStatus={incidentOperationalInsight?.missionDependencyStatus ?? 'unknown'}
                    missionDependencyNodeCount={incidentOperationalInsight?.missionDependencyNodeCount ?? null}
                    missionDependencyEdgeCount={incidentOperationalInsight?.missionDependencyEdgeCount ?? null}
                    missionDependencyBlockerCount={incidentOperationalInsight?.missionDependencyBlockers.length ?? 0}
                    commandPostureRecommendations={incidentOperationalInsight?.commandPostureRecommendations ?? []}
                    aarCandidateCount={[
                      ...(incidentOperationalInsight?.nimsComplianceGaps ?? []),
                      ...(incidentOperationalInsight?.missionDependencyBlockers ?? []),
                      ...(incidentOperationalInsight?.commandPostureRecommendations ?? []),
                    ].length}
                  />
                </Suspense>
              )}
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="analytics">
            <Accordion.Header>Incident Analytics</Accordion.Header>
            <Accordion.Body>
              {isAccordionSectionOpen('dashboard', 'analytics') && (
                <Suspense fallback={viewSuspenseFallback}>
                  <InteractiveIncidentAnalyticsCard
                    incidents={incidents}
                    incidentStatusLookups={incidentStatusLookups}
                    incidentTypeLookups={incidentTypeLookups}
                    incidentSeverityLookups={incidentSeverityLookups}
                  />
                </Suspense>
              )}
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="resources">
            <Accordion.Header>Resource Posture</Accordion.Header>
            <Accordion.Body>
              {isAccordionSectionOpen('dashboard', 'resources') && (
                <Suspense fallback={viewSuspenseFallback}>
                  <ResourcePostureCard
                    resourceLoading={resourceLoading}
                    recentResourceRows={recentResourceRows}
                    selectedInventoryId={selectedInventoryId}
                    resourceTotalInput={resourceTotalInput}
                    resourceAvailableInput={resourceAvailableInput}
                    resourceCommittedInput={resourceCommittedInput}
                    resourceOutOfServiceInput={resourceOutOfServiceInput}
                    bedLocationIdInput={bedLocationIdInput}
                    bedStaffedInput={bedStaffedInput}
                    bedAvailableInput={bedAvailableInput}
                    bedOccupiedInput={bedOccupiedInput}
                    bedUnavailableInput={bedUnavailableInput}
                    bedIsolationInput={bedIsolationInput}
                    bedSurgeInput={bedSurgeInput}
                    recentBedRows={recentBedRows}
                    locationLookups={locationLookups}
                    setSelectedInventoryId={(value) => setSelectedInventoryId(value)}
                    setResourceTotalInput={setResourceTotalInput}
                    setResourceAvailableInput={setResourceAvailableInput}
                    setResourceCommittedInput={setResourceCommittedInput}
                    setResourceOutOfServiceInput={setResourceOutOfServiceInput}
                    setBedLocationIdInput={setBedLocationIdInput}
                    setBedStaffedInput={setBedStaffedInput}
                    setBedAvailableInput={setBedAvailableInput}
                    setBedOccupiedInput={setBedOccupiedInput}
                    setBedUnavailableInput={setBedUnavailableInput}
                    setBedIsolationInput={setBedIsolationInput}
                    setBedSurgeInput={setBedSurgeInput}
                    onUpdateInventory={() => void handleUpdateInventory()}
                    onAddBedSnapshot={() => void handleAddBedSnapshot()}
                  />
                </Suspense>
              )}
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="weather">
            <Accordion.Header>Weather Feed</Accordion.Header>
            <Accordion.Body>
              {isAccordionSectionOpen('dashboard', 'weather') && (
                <Suspense fallback={viewSuspenseFallback}>
                  <WeatherFeedCard weather={weather} />
                </Suspense>
              )}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}

      {/* Incidents View */}
      {activeView === 'incidents' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState.incidents}
          onSelect={(eventKey) => handleViewAccordionChange('incidents', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="workspace">
            <Accordion.Header>Incident Workspace Snapshot</Accordion.Header>
            <Accordion.Body>
              {isAccordionSectionOpen('incidents', 'workspace') && (
                <Suspense fallback={viewSuspenseFallback}>
                  <IncidentWorkspaceCard
                    incidentDetail={incidentDetail}
                    resourceRequestCount={incidentWorkspaceResourceRequestCount}
                    communicationCount={incidentWorkspaceCommunicationCount}
                    sitrepCount={incidentWorkspaceSitrepCount}
                    openTaskCount={selectedIncidentOpenTaskCount}
                    timelineEventCount={selectedIncidentTimelineCount}
                    operationalInsight={incidentOperationalInsight ?? undefined}
                    weatherOperationalSignal={weatherOperationalSignal}
                    onNotify={showToast}
                  />
                </Suspense>
              )}
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="create">
            <Accordion.Header>Create Incident</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <CreateIncidentCard
                  incidentCreateNumber={incidentCreateNumber}
                  incidentCreateName={incidentCreateName}
                  incidentCreateTypeCode={incidentCreateTypeCode}
                  incidentCreateSeverity={incidentCreateSeverity}
                  incidentCreatePrimaryLocationId={incidentCreatePrimaryLocationId}
                  incidentCreateSummary={incidentCreateSummary}
                  incidentCreatePlanned={incidentCreatePlanned}
                  incidentTypeLookups={incidentTypeLookups}
                  incidentSeverityLookups={incidentSeverityLookups}
                  locationLookups={locationLookups}
                  incidentActionLoading={incidentActionLoading}
                  isAuthenticated={isAuthenticated}
                  setIncidentCreateNumber={setIncidentCreateNumber}
                  setIncidentCreateName={setIncidentCreateName}
                  setIncidentCreateTypeCode={setIncidentCreateTypeCode}
                  setIncidentCreateSeverity={setIncidentCreateSeverity}
                  setIncidentCreatePrimaryLocationId={setIncidentCreatePrimaryLocationId}
                  setIncidentCreateSummary={setIncidentCreateSummary}
                  setIncidentCreatePlanned={setIncidentCreatePlanned}
                  onCreateIncident={() => void handleCreateIncident()}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="board">
            <Accordion.Header>Active Incident Board</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <ActiveIncidentBoardCard
                  incidentSearchText={incidentSearchText}
                  incidentStatusFilter={incidentStatusFilter}
                  incidentStatusFilterOptions={incidentStatusFilterOptions}
                  incidentsLoading={incidentsLoading}
                  isAuthenticated={isAuthenticated}
                  incidentsError={incidentsError}
                  incidents={incidents}
                  filteredIncidents={filteredIncidents}
                  selectedIncidentId={selectedIncidentId}
                  setIncidentSearchText={setIncidentSearchText}
                  setIncidentStatusFilter={setIncidentStatusFilter}
                  setSelectedIncidentId={setSelectedIncidentId}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="command">
            <Accordion.Header>Incident Command Workspace</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <IncidentCommandPaneCard
                  isAuthenticated={isAuthenticated}
                  selectedIncidentId={selectedIncidentId}
                  incidentDetail={incidentDetail}
                  incidentDetailLoading={incidentDetailLoading}
                  incidentDetailError={incidentDetailError}
                  incidentActionLoading={incidentActionLoading}
                  incidentEditName={incidentEditName}
                  incidentEditTypeCode={incidentEditTypeCode}
                  incidentEditSeverity={incidentEditSeverity}
                  incidentEditPrimaryLocationId={incidentEditPrimaryLocationId}
                  incidentEditInitialSummary={incidentEditInitialSummary}
                  incidentEditSituationSummary={incidentEditSituationSummary}
                  incidentEditPlanned={incidentEditPlanned}
                  locationLookups={locationLookups}
                  incidentTypeLookups={incidentTypeLookups}
                  incidentSeverityLookups={incidentSeverityLookups}
                  icsPositions={icsPositions}
                  icsPositionsLoading={icsPositionsLoading}
                  incidentCommandAssignments={incidentCommandAssignments}
                  incidentCommandAssignmentsLoading={incidentCommandAssignmentsLoading}
                  incidentTasks={incidentTasks}
                  incidentTasksLoading={incidentTasksLoading}
                  taskTitleInput={taskTitleInput}
                  taskDescriptionInput={taskDescriptionInput}
                  taskPriorityInput={taskPriorityInput}
                  taskAssignedToUserIdInput={taskAssignedToUserIdInput}
                  taskDueInput={taskDueInput}
                  taskPriorityLookups={taskPriorityLookups}
                  taskStatusLookups={taskStatusLookups}
                  incidentTimelineEvents={incidentTimelineEvents}
                  incidentTimelineLoading={incidentTimelineLoading}
                  timelineTypeInput={timelineTypeInput}
                  timelineTitleInput={timelineTitleInput}
                  timelineDescriptionInput={timelineDescriptionInput}
                  timelineEventUtcInput={timelineEventUtcInput}
                  timelineEventTypeLookups={timelineEventTypeLookups}
                  resourceTypeLookups={resourceTypeLookups}
                  incidentOperationalPeriods={incidentOperationalPeriods}
                  incidentOperationalPeriodsLoading={incidentOperationalPeriodsLoading}
                  operationalPeriodNumberInput={operationalPeriodNumberInput}
                operationalPeriodNameInput={operationalPeriodNameInput}
                operationalPeriodStartInput={operationalPeriodStartInput}
                operationalPeriodEndInput={operationalPeriodEndInput}
                operationalPeriodStatusInput={operationalPeriodStatusInput}
                operationalPeriodPlanningMeetingInput={operationalPeriodPlanningMeetingInput}
                incidentObjectives={incidentObjectives}
                incidentObjectivesLoading={incidentObjectivesLoading}
                objectiveOperationalPeriodIdInput={objectiveOperationalPeriodIdInput}
                objectiveNumberInput={objectiveNumberInput}
                objectiveTextInput={objectiveTextInput}
                objectivePriorityInput={objectivePriorityInput}
                objectiveStatusInput={objectiveStatusInput}
                objectiveOwnerUserIdInput={objectiveOwnerUserIdInput}
                objectiveDueInput={objectiveDueInput}
                operationalInsight={incidentOperationalInsight ?? undefined}
                setIncidentEditName={setIncidentEditName}
                setIncidentEditTypeCode={setIncidentEditTypeCode}
                setIncidentEditSeverity={setIncidentEditSeverity}
                setIncidentEditPrimaryLocationId={setIncidentEditPrimaryLocationId}
                setIncidentEditInitialSummary={setIncidentEditInitialSummary}
                setIncidentEditSituationSummary={setIncidentEditSituationSummary}
                setIncidentEditPlanned={setIncidentEditPlanned}
                setTaskTitleInput={setTaskTitleInput}
                setTaskDescriptionInput={setTaskDescriptionInput}
                setTaskPriorityInput={setTaskPriorityInput}
                setTaskAssignedToUserIdInput={setTaskAssignedToUserIdInput}
                setTaskDueInput={setTaskDueInput}
                setTimelineTypeInput={setTimelineTypeInput}
                setTimelineTitleInput={setTimelineTitleInput}
                setTimelineDescriptionInput={setTimelineDescriptionInput}
                setTimelineEventUtcInput={setTimelineEventUtcInput}
                setOperationalPeriodNumberInput={setOperationalPeriodNumberInput}
                setOperationalPeriodNameInput={setOperationalPeriodNameInput}
                setOperationalPeriodStartInput={setOperationalPeriodStartInput}
                setOperationalPeriodEndInput={setOperationalPeriodEndInput}
                setOperationalPeriodStatusInput={setOperationalPeriodStatusInput}
                setOperationalPeriodPlanningMeetingInput={setOperationalPeriodPlanningMeetingInput}
                setObjectiveOperationalPeriodIdInput={setObjectiveOperationalPeriodIdInput}
                setObjectiveNumberInput={setObjectiveNumberInput}
                setObjectiveTextInput={setObjectiveTextInput}
                setObjectivePriorityInput={setObjectivePriorityInput}
                setObjectiveStatusInput={setObjectiveStatusInput}
                setObjectiveOwnerUserIdInput={setObjectiveOwnerUserIdInput}
                setObjectiveDueInput={setObjectiveDueInput}
                onSaveIncidentMetadata={() => void handleSaveIncidentMetadata()}
                onCreateIncidentTask={() => void handleCreateIncidentTask()}
                onUpdateIncidentTaskStatus={(incidentTaskId, statusCode) => {
                  void handleUpdateIncidentTaskStatus(incidentTaskId, statusCode);
                }}
                onUpdateIncidentTaskAssignment={(incidentTaskId, assignedToUserId) => {
                  void handleUpdateIncidentTaskAssignment(incidentTaskId, assignedToUserId);
                }}
                onCreateIncidentTimelineEvent={() => void handleCreateIncidentTimelineEvent()}
                onCreateOperationalPeriod={() => void handleCreateOperationalPeriod()}
                onApproveOperationalPeriod={(operationalPeriodId) => (
                  handleApproveOperationalPeriod(operationalPeriodId)
                )}
                onReopenOperationalPeriod={(operationalPeriodId) => (
                  handleReopenOperationalPeriod(operationalPeriodId)
                )}
                onCreateObjective={() => void handleCreateObjective()}
                onUpdateOperationalPeriod={(operationalPeriodId, request) => (
                  handleUpdateOperationalPeriod(operationalPeriodId, request)
                )}
                onUpdateObjective={(incidentObjectiveId, request) => (
                  handleUpdateObjective(incidentObjectiveId, request)
                )}
                onActivateIncident={() => void handleActivateIncident()}
                onCloseIncident={() => void handleCloseIncident()}
                onAssignCommandPosition={(icsPositionId, assignedUserId) => (
                  handleAssignCommandPosition(icsPositionId, assignedUserId)
                )}
                onRemoveCommandAssignment={(icsPositionId) => {
                  void handleRemoveCommandAssignment(icsPositionId);
                }}
                onRefreshIcsPositions={() => {
                  void refreshIcsPositions(true);
                }}
                onRefreshIncidentCommandAssignments={() => {
                  void refreshIncidentCommandAssignments();
                }}
                onOperationalDataChanged={() => {
                  setIncidentOperationalInsightRefreshNonce((current) => current + 1);
                }}
                  onNotify={showToast}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}

      {/* Facilities View */}
      {activeView === 'facilities' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState.facilities}
          onSelect={(eventKey) => handleViewAccordionChange('facilities', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="capacity">
            <Accordion.Header>Capacity Analytics</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <FacilitiesCapacityAnalyticsCard
                  resourceInventory={resourceInventory}
                  bedAvailability={bedAvailability}
                  isAuthenticated={isAuthenticated}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="trends">
            <Accordion.Header>Trend Drilldown</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <FacilitiesTrendDrilldownCard
                  resourceInventory={resourceInventory}
                  bedAvailability={bedAvailability}
                  isAuthenticated={isAuthenticated}
                  onNotify={showToast}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="posture">
            <Accordion.Header>Resource Posture</Accordion.Header>
            <Accordion.Body>
              {isAccordionSectionOpen('facilities', 'posture') && (
                <Suspense fallback={viewSuspenseFallback}>
                  <ResourcePostureCard
                    resourceLoading={resourceLoading}
                    recentResourceRows={recentResourceRows}
                    selectedInventoryId={selectedInventoryId}
                    resourceTotalInput={resourceTotalInput}
                    resourceAvailableInput={resourceAvailableInput}
                    resourceCommittedInput={resourceCommittedInput}
                    resourceOutOfServiceInput={resourceOutOfServiceInput}
                    bedLocationIdInput={bedLocationIdInput}
                    bedStaffedInput={bedStaffedInput}
                    bedAvailableInput={bedAvailableInput}
                    bedOccupiedInput={bedOccupiedInput}
                    bedUnavailableInput={bedUnavailableInput}
                    bedIsolationInput={bedIsolationInput}
                    bedSurgeInput={bedSurgeInput}
                    recentBedRows={recentBedRows}
                    locationLookups={locationLookups}
                    setSelectedInventoryId={(value) => setSelectedInventoryId(value)}
                    setResourceTotalInput={setResourceTotalInput}
                    setResourceAvailableInput={setResourceAvailableInput}
                    setResourceCommittedInput={setResourceCommittedInput}
                    setResourceOutOfServiceInput={setResourceOutOfServiceInput}
                    setBedLocationIdInput={setBedLocationIdInput}
                    setBedStaffedInput={setBedStaffedInput}
                    setBedAvailableInput={setBedAvailableInput}
                    setBedOccupiedInput={setBedOccupiedInput}
                    setBedUnavailableInput={setBedUnavailableInput}
                    setBedIsolationInput={setBedIsolationInput}
                    setBedSurgeInput={setBedSurgeInput}
                    onUpdateInventory={() => void handleUpdateInventory()}
                    onAddBedSnapshot={() => void handleAddBedSnapshot()}
                  />
                </Suspense>
              )}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}

      {/* Reports View */}
      {activeView === 'reports' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState.reports}
          onSelect={(eventKey) => handleViewAccordionChange('reports', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="reporting">
            <Accordion.Header>Reporting Workspace</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <ReportingWorkspaceCard
                  incidents={incidents}
                  incidentStatusLookups={incidentStatusLookups}
                  incidentTypeLookups={incidentTypeLookups}
                  dashboardSummary={dashboardSummary}
                  reportWindowDays={reportWindowDays}
                  reportGroupBy={reportGroupBy}
                  reportStatusFilter={reportStatusFilter}
                  reportTypeFilter={reportTypeFilter}
                  setReportWindowDays={setReportWindowDays}
                  setReportGroupBy={setReportGroupBy}
                  setReportStatusFilter={setReportStatusFilter}
                  setReportTypeFilter={setReportTypeFilter}
                  onNavigateToView={(view) => handleNavigate(view)}
                  onNotify={showToast}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="analytics">
            <Accordion.Header>Incident Analytics</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <InteractiveIncidentAnalyticsCard
                  incidents={incidents}
                  incidentStatusLookups={incidentStatusLookups}
                  incidentTypeLookups={incidentTypeLookups}
                  incidentSeverityLookups={incidentSeverityLookups}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="audit-evidence">
            <Accordion.Header>Audit Evidence</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <AuditEvidenceCard incidents={incidents} />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}

      {/* COP View */}
      {activeView === 'cop' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState.cop}
          onSelect={(eventKey) => handleViewAccordionChange('cop', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="cop-overview">
            <Accordion.Header>Common Operating Picture</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <CommonOperatingPictureCard
                  isAuthenticated={isAuthenticated}
                  incidents={incidents}
                  resourceInventory={resourceInventory}
                  bedAvailability={bedAvailability}
                  locationLookups={locationLookups}
                  operationalInsight={incidentOperationalInsight ?? undefined}
                  weatherOperationalSignal={weatherOperationalSignal}
                  onNavigate={(view) => handleNavigate(view)}
                  onNotify={showToast}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}

      {/* Operations View */}
      {activeView === 'operations' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState.operations}
          onSelect={(eventKey) => handleViewAccordionChange('operations', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="ops-overview">
            <Accordion.Header>Operations Coordination Workspace</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <OperationsCoordinationCard
                  isAuthenticated={isAuthenticated}
                  activeIncidentCount={activeIncidentCount}
                  selectedIncidentLabel={incidentDetail ? `${incidentDetail.incidentNumber} — ${incidentDetail.incidentName}` : 'No incident selected'}
                  selectedIncidentOpenTaskCount={selectedIncidentOpenTaskCount}
                  selectedIncidentTimelineCount={selectedIncidentTimelineCount}
                  selectedIncidentResourceRequestCount={incidentWorkspaceResourceRequestCount}
                  selectedIncidentCommunicationCount={incidentWorkspaceCommunicationCount}
                  incidents={incidents}
                  selectedIncidentId={selectedIncidentId}
                  onSelectIncident={(incidentId) => setSelectedIncidentId(incidentId)}
                  attentionLevel={incidentOperationalInsight?.attentionLevel ?? 'unknown'}
                  needsAttentionReasonCount={incidentOperationalInsight?.needsAttentionReasons.length ?? 0}
                  onNotify={showToast}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}

      {/* Planning View */}
      {activeView === 'planning' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState.planning}
          onSelect={(eventKey) => handleViewAccordionChange('planning', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="planning-overview">
            <Accordion.Header>Planning Cycle Workspace</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <PlanningCycleCard
                  isAuthenticated={isAuthenticated}
                  selectedIncidentLabel={incidentDetail ? `${incidentDetail.incidentNumber} — ${incidentDetail.incidentName}` : 'No incident selected'}
                  incidents={incidents}
                  selectedIncidentId={selectedIncidentId}
                  onSelectIncident={(incidentId) => setSelectedIncidentId(incidentId)}
                  operationalPeriodCount={incidentOperationalPeriods.length}
                  objectiveCount={incidentObjectives.length}
                  sitrepCount={incidentWorkspaceSitrepCount}
                  staleSitrepHours={incidentOperationalInsight?.staleSitrepHours ?? null}
                  latestTimelineUtc={incidentOperationalInsight?.latestTimelineUtc ?? null}
                  weatherOperationalSignal={weatherOperationalSignal}
                  onNavigate={(view) => handleNavigate(view)}
                  onNotify={showToast}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}

      {/* Logistics View */}
      {activeView === 'logistics' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState.logistics}
          onSelect={(eventKey) => handleViewAccordionChange('logistics', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="logistics-overview">
            <Accordion.Header>Logistics & Staging Workspace</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <LogisticsCoordinationCard
                  isAuthenticated={isAuthenticated}
                  authRoles={authMe?.roles ?? []}
                  authScopes={authMe?.scopes ?? []}
                  resourceInventory={resourceInventory}
                  bedAvailability={bedAvailability}
                  locationLookups={locationLookups}
                  weatherOperationalSignal={weatherOperationalSignal}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}

      {/* Finance View */}
      {activeView === 'finance' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState.finance}
          onSelect={(eventKey) => handleViewAccordionChange('finance', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="finance-overview">
            <Accordion.Header>Finance & Administration Workspace</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <FinanceAdministrationCard
                  isAuthenticated={isAuthenticated}
                  authRoles={authMe?.roles ?? []}
                  authScopes={authMe?.scopes ?? []}
                  incidentCount={incidents.length}
                  activeIncidentCount={activeIncidentCount}
                  selectedIncidentResourceRequestCount={incidentWorkspaceResourceRequestCount}
                  selectedIncidentOpenTaskCount={selectedIncidentOpenTaskCount}
                  onNotify={showToast}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}

      {/* After Action View */}
      {activeView === 'after-action' && (
        <Accordion
          alwaysOpen
          activeKey={viewAccordionState['after-action']}
          onSelect={(eventKey) => handleViewAccordionChange('after-action', eventKey)}
          className="ipoc-view-accordion ipoc-section-accordion"
        >
          <Accordion.Item eventKey="aar-overview">
            <Accordion.Header>After Action & Improvement Planning</Accordion.Header>
            <Accordion.Body>
              <Suspense fallback={viewSuspenseFallback}>
                <AfterActionReadinessCard
                  isAuthenticated={isAuthenticated}
                  authRoles={authMe?.roles ?? []}
                  authScopes={authMe?.scopes ?? []}
                  incidentCount={incidents.length}
                  closedIncidentCount={closedIncidentCount}
                  selectedIncidentTimelineCount={selectedIncidentTimelineCount}
                  selectedIncidentCommunicationCount={incidentWorkspaceCommunicationCount}
                  selectedIncidentResourceRequestCount={incidentWorkspaceResourceRequestCount}
                  commandPostureRecommendations={incidentOperationalInsight?.commandPostureRecommendations ?? []}
                  nimsComplianceGaps={incidentOperationalInsight?.nimsComplianceGaps ?? []}
                  missionDependencyBlockers={incidentOperationalInsight?.missionDependencyBlockers ?? []}
                  selectedIncidentId={selectedIncidentId}
                  onNotify={showToast}
                />
              </Suspense>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      )}
    </AppShellLayout>
  );
}

export default App;

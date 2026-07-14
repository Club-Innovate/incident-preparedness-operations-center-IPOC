import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  getIncidentById,
  getIncidentCommandAssignments,
  getIncidentTasks,
  getIncidentTimeline,
  getIncidentOperationalPeriods,
  getIncidentObjectives,
  getIncidents,
  getSystemReadiness,
  getWeatherForecast,
} from '../api';
import type { NotifyHandler } from '../notifications/types';
import type {
  IncidentDetail,
  IncidentSummary,
  IncidentCommandAssignment,
  IncidentTask,
  IncidentTimelineEvent,
  IncidentOperationalPeriod,
  IncidentObjective,
  SystemReadiness,
  WeatherForecast,
} from '../types';

type WeatherDefaultLocationPreference = {
  defaultLocationId?: number;
  defaultCity?: string;
  defaultState?: string;
  defaultPostalCode?: string;
};

type OperationalDataLoadingDeps = {
  isAuthenticated: boolean;
  selectedIncidentId: number | null;
  selectedIncidentPrimaryLocationId: number | null;
  onNotify: NotifyHandler;
  setWeather: Dispatch<SetStateAction<WeatherForecast[]>>;
  setReadiness: Dispatch<SetStateAction<SystemReadiness | null>>;
  setIncidentsLoading: Dispatch<SetStateAction<boolean>>;
  setIncidents: Dispatch<SetStateAction<IncidentSummary[]>>;
  setIncidentsError: Dispatch<SetStateAction<string | null>>;
  setSelectedIncidentId: Dispatch<SetStateAction<number | null>>;
  setIncidentDetail: Dispatch<SetStateAction<IncidentDetail | null>>;
  setIncidentDetailLoading: Dispatch<SetStateAction<boolean>>;
  setIncidentDetailError: Dispatch<SetStateAction<string | null>>;
  setIncidentEditName: Dispatch<SetStateAction<string>>;
  setIncidentEditTypeCode: Dispatch<SetStateAction<string>>;
  setIncidentEditSeverity: Dispatch<SetStateAction<string>>;
  setIncidentEditPrimaryLocationId: Dispatch<SetStateAction<string>>;
  setIncidentEditInitialSummary: Dispatch<SetStateAction<string>>;
  setIncidentEditSituationSummary: Dispatch<SetStateAction<string>>;
  setIncidentEditPlanned: Dispatch<SetStateAction<boolean>>;
  setIncidentTasks: Dispatch<SetStateAction<IncidentTask[]>>;
  setIncidentTimelineEvents: Dispatch<SetStateAction<IncidentTimelineEvent[]>>;
  setIncidentOperationalPeriods: Dispatch<SetStateAction<IncidentOperationalPeriod[]>>;
  setIncidentObjectives: Dispatch<SetStateAction<IncidentObjective[]>>;
  setIncidentCommandAssignments: Dispatch<SetStateAction<IncidentCommandAssignment[]>>;
};

export function useOperationalDataLoading(deps: OperationalDataLoadingDeps) {
  const incidentDetailRequestVersion = useRef(0);
  const selectedIncidentStorageKey = 'ipoc.selectedIncidentId';
  const weatherDefaultStorageKey = 'ipoc.weather.defaultLocation';

  const readWeatherDefaultPreference = (): WeatherDefaultLocationPreference => {
    if (typeof window === 'undefined') {
      return {};
    }

    const raw = window.localStorage.getItem(weatherDefaultStorageKey);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as WeatherDefaultLocationPreference;
      const normalized: WeatherDefaultLocationPreference = {};

      if (typeof parsed.defaultLocationId === 'number' && Number.isFinite(parsed.defaultLocationId) && parsed.defaultLocationId > 0) {
        normalized.defaultLocationId = Math.round(parsed.defaultLocationId);
      }

      if (typeof parsed.defaultCity === 'string' && parsed.defaultCity.trim().length > 0) {
        normalized.defaultCity = parsed.defaultCity.trim();
      }

      if (typeof parsed.defaultState === 'string' && parsed.defaultState.trim().length > 0) {
        normalized.defaultState = parsed.defaultState.trim();
      }

      if (typeof parsed.defaultPostalCode === 'string' && parsed.defaultPostalCode.trim().length > 0) {
        normalized.defaultPostalCode = parsed.defaultPostalCode.trim();
      }

      return normalized;
    } catch {
      return {};
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        deps.setIncidentsLoading(true);
        const weatherDefaultPreference = readWeatherDefaultPreference();
        const [weatherResult, readinessResult] = await Promise.all([
          getWeatherForecast(weatherDefaultPreference),
          getSystemReadiness(),
        ]);

        deps.setWeather(weatherResult);
        deps.setReadiness(readinessResult);

        if (!deps.isAuthenticated) {
          deps.setIncidents([]);
          deps.setIncidentsError(null);
          return;
        }

        try {
          const incidentsResult = await getIncidents();
          deps.setIncidents(incidentsResult);

          if (incidentsResult.length > 0) {
            const persistedIncidentIdRaw = typeof window !== 'undefined'
              ? window.localStorage.getItem(selectedIncidentStorageKey)
              : null;
            const persistedIncidentId = persistedIncidentIdRaw ? Number(persistedIncidentIdRaw) : Number.NaN;
            const persistedIncidentStillExists = Number.isFinite(persistedIncidentId)
              ? incidentsResult.some((incident) => incident.incidentId === persistedIncidentId)
              : false;

            deps.setSelectedIncidentId(persistedIncidentStillExists ? persistedIncidentId : incidentsResult[0].incidentId);
          } else {
            deps.setSelectedIncidentId(null);
          }

          deps.setIncidentsError(null);
        } catch (incidentLoadError) {
          const incidentMessage = incidentLoadError instanceof Error ? incidentLoadError.message : 'Unable to load incidents.';
          deps.setIncidents([]);
          deps.setIncidentsError(incidentMessage);
          deps.onNotify(incidentMessage, 'danger');
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Unable to load data.';
        deps.onNotify(message, 'danger');
      } finally {
        deps.setIncidentsLoading(false);
      }
    };

    void load();
  }, [
    deps.isAuthenticated,
    deps.onNotify,
    deps.setIncidents,
    deps.setIncidentsError,
    deps.setIncidentsLoading,
    deps.setReadiness,
    deps.setSelectedIncidentId,
    deps.setWeather,
  ]);

  useEffect(() => {
    let cancelled = false;

    const reloadContextWeather = async () => {
      try {
        const weatherDefaultPreference = readWeatherDefaultPreference();
        const weatherResult = await getWeatherForecast({
          incidentId: deps.selectedIncidentId ?? undefined,
          locationId: deps.selectedIncidentPrimaryLocationId ?? undefined,
          ...weatherDefaultPreference,
        });
        if (!cancelled) {
          deps.setWeather(weatherResult);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to load weather data for selected incident context.';
        deps.onNotify(message, 'warning');
      }
    };

    void reloadContextWeather();

    return () => {
      cancelled = true;
    };
  }, [
    deps.onNotify,
    deps.selectedIncidentId,
    deps.selectedIncidentPrimaryLocationId,
    deps.setWeather,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Keep persisted incident through auth bootstrap on page refresh.
    // Clearing here when unauthenticated causes the selected incident to be lost
    // before auth/session state is restored.
    if (!deps.isAuthenticated) {
      return;
    }

    if (deps.selectedIncidentId === null) {
      window.localStorage.removeItem(selectedIncidentStorageKey);
      return;
    }

    window.localStorage.setItem(selectedIncidentStorageKey, String(deps.selectedIncidentId));
  }, [deps.isAuthenticated, deps.selectedIncidentId]);

  useEffect(() => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.setIncidentDetail(null);
      deps.setIncidentEditName('');
      deps.setIncidentEditTypeCode('');
      deps.setIncidentEditSeverity('');
      deps.setIncidentEditPrimaryLocationId('');
      deps.setIncidentEditInitialSummary('');
      deps.setIncidentEditSituationSummary('');
      deps.setIncidentEditPlanned(false);
      deps.setIncidentTasks([]);
      deps.setIncidentTimelineEvents([]);
      deps.setIncidentOperationalPeriods([]);
      deps.setIncidentObjectives([]);
      deps.setIncidentCommandAssignments([]);
      return;
    }

    const loadIncidentDetail = async () => {
      const requestVersion = ++incidentDetailRequestVersion.current;
      const selectedIncidentId = deps.selectedIncidentId!;

      try {
        deps.setIncidentDetailLoading(true);
        deps.setIncidentDetailError(null);

        const detailPromise = getIncidentById(selectedIncidentId);
        const tasksPromise = getIncidentTasks(selectedIncidentId);
        const timelinePromise = getIncidentTimeline(selectedIncidentId);
        const operationalPeriodsPromise = getIncidentOperationalPeriods(selectedIncidentId);
        const objectivesPromise = getIncidentObjectives(selectedIncidentId);
        const commandAssignmentsPromise = getIncidentCommandAssignments(selectedIncidentId);

        const detail = await detailPromise;
        if (requestVersion !== incidentDetailRequestVersion.current) {
          return;
        }

        deps.setIncidentDetail(detail);
        deps.setIncidentEditName(detail.incidentName);
        deps.setIncidentEditTypeCode(detail.incidentTypeCode);
        deps.setIncidentEditSeverity(detail.severityCode ?? '');
        deps.setIncidentEditPrimaryLocationId(detail.primaryLocationId ? String(detail.primaryLocationId) : '');
        deps.setIncidentEditInitialSummary(detail.initialSummary ?? '');
        deps.setIncidentEditSituationSummary(detail.situationSummary ?? '');
        deps.setIncidentEditPlanned(detail.isPlannedEvent);

        const [tasksResult, timelineResult, operationalPeriodsResult, objectivesResult, commandAssignmentsResult] = await Promise.allSettled([
          tasksPromise,
          timelinePromise,
          operationalPeriodsPromise,
          objectivesPromise,
          commandAssignmentsPromise,
        ]);

        if (requestVersion !== incidentDetailRequestVersion.current) {
          return;
        }

        if (tasksResult.status === 'fulfilled') {
          deps.setIncidentTasks(tasksResult.value);
        } else {
          deps.setIncidentTasks([]);
        }

        if (timelineResult.status === 'fulfilled') {
          deps.setIncidentTimelineEvents(timelineResult.value);
        } else {
          deps.setIncidentTimelineEvents([]);
        }

        if (operationalPeriodsResult.status === 'fulfilled') {
          deps.setIncidentOperationalPeriods(operationalPeriodsResult.value);
        } else {
          deps.setIncidentOperationalPeriods([]);
        }

        if (objectivesResult.status === 'fulfilled') {
          deps.setIncidentObjectives(objectivesResult.value);
        } else {
          deps.setIncidentObjectives([]);
        }

        if (commandAssignmentsResult.status === 'fulfilled') {
          deps.setIncidentCommandAssignments(commandAssignmentsResult.value);
        } else {
          deps.setIncidentCommandAssignments([]);
          const assignmentMessage = commandAssignmentsResult.reason instanceof Error
            ? commandAssignmentsResult.reason.message
            : 'Unable to load command assignments.';
          deps.onNotify(assignmentMessage, 'danger');
        }

      } catch (detailError) {
        if (requestVersion !== incidentDetailRequestVersion.current) {
          return;
        }

        const message = detailError instanceof Error ? detailError.message : 'Unable to load incident detail.';
        deps.setIncidentDetailError(message);
        deps.onNotify(message, 'danger');
      } finally {
        if (requestVersion === incidentDetailRequestVersion.current) {
          deps.setIncidentDetailLoading(false);
        }
      }
    };

    void loadIncidentDetail();
  }, [
    deps.isAuthenticated,
    deps.onNotify,
    deps.selectedIncidentId,
    deps.setIncidentDetail,
    deps.setIncidentDetailError,
    deps.setIncidentDetailLoading,
    deps.setIncidentEditInitialSummary,
    deps.setIncidentEditName,
    deps.setIncidentEditPlanned,
    deps.setIncidentEditSeverity,
    deps.setIncidentEditPrimaryLocationId,
    deps.setIncidentEditSituationSummary,
    deps.setIncidentEditTypeCode,
    deps.setIncidentTasks,
    deps.setIncidentTimelineEvents,
    deps.setIncidentOperationalPeriods,
    deps.setIncidentObjectives,
    deps.setIncidentCommandAssignments,
  ]);
}

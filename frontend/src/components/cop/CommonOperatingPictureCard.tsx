import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Col, Form, ListGroup, Modal, ProgressBar, Row } from 'react-bootstrap';
import type { ColDef } from 'ag-grid-community';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MapContainer, Marker, Popup, ScaleControl, TileLayer, Tooltip as LeafletTooltip, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { divIcon } from 'leaflet';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import MapControlStrip from '../common/MapControlStrip';
import IpocDataGrid from '../common/IpocDataGrid';
import { deleteUserReportPreset, getCopLiveOverlayFeed, getUserReportPresets, upsertUserReportPreset } from '../../api';
import type { NotifyHandler } from '../../notifications/types';
import type { BedAvailabilityItem, CopLiveOverlayFeedPoint, IncidentOperationalInsight, IncidentSummary, LocationLookupValue, ResourceInventoryItem, WeatherOperationalSignal } from '../../types';
import 'leaflet/dist/leaflet.css';

type CommonOperatingPictureCardProps = {
  isAuthenticated: boolean;
  incidents: IncidentSummary[];
  resourceInventory: ResourceInventoryItem[];
  bedAvailability: BedAvailabilityItem[];
  locationLookups: LocationLookupValue[];
  operationalInsight?: IncidentOperationalInsight;
  weatherOperationalSignal: WeatherOperationalSignal;
  onNavigate?: (view: 'incidents' | 'planning' | 'operations' | 'after-action') => void;
  onNotify: NotifyHandler;
};

type CopLayerSetPreset = {
  id: string;
  name: string;
  geoOverlayLayer: 'composite' | 'resource' | 'bed' | 'incident';
  geoOverlayStressFilter: 'all' | 'watch' | 'high';
  copMapBaseLayer: CopMapBaseLayerMode;
  copLiveOverlayFeedMode: CopLiveOverlayFeedMode;
  userReportPresetId?: number;
};

type CopAoiPreset = {
  id: string;
  name: string;
  regionFilter: string;
  locationFilter: string;
  linkedLayerSetPresetId?: string | null;
  linkedLayerSetPresetName?: string | null;
  userReportPresetId?: number;
};

type CopGeoCoordinate = {
  lat: number;
  lng: number;
};

type CopMapBaseLayerMode = 'streets' | 'terrain';
type CopLiveOverlayFeedMode = 'off' | 'simulated';

type CopLiveOverlayFeedHealth = {
  provider: string;
  status: string;
  fallbackUsed: boolean;
  detail: string | null;
  lastExternalAttemptUtc: string | null;
  lastExternalFailureReason: string | null;
  generatedUtc: string | null;
};

const COP_LIVE_OVERLAY_FEED_ENABLED = import.meta.env.VITE_COP_LIVE_OVERLAY_FEED === 'true';

const COP_MAP_GEO_PRESETS: Record<number, CopGeoCoordinate> = {
  8101: { lat: 37.6872, lng: -97.3301 },
  8102: { lat: 39.0473, lng: -95.6752 },
  8103: { lat: 37.7528, lng: -100.0171 },
  8104: { lat: 38.4673, lng: -98.5362 },
};

const COP_MAP_CENTER: [number, number] = [38.5, -98.0];
const COP_MAP_DEFAULT_ZOOM = 6;

const COP_MAP_BASE_LAYER_CONFIG: Record<CopMapBaseLayerMode, { url: string; attribution: string; label: string }> = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    label: 'Streets',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap contributors',
    label: 'Terrain',
  },
};

function resolveCopGeoCoordinate(locationId: number): CopGeoCoordinate {
  const preset = COP_MAP_GEO_PRESETS[locationId];
  if (preset) {
    return preset;
  }

  const lat = 37 + (((locationId * 37) % 300) / 100);
  const lng = -101 + (((locationId * 53) % 500) / 100);
  return { lat, lng };
}

function extractLocationCoordinate(location: LocationLookupValue | undefined): CopGeoCoordinate | null {
  if (!location) {
    return null;
  }

  const candidate = location as unknown as Record<string, unknown>;
  const latRaw = candidate.latitude ?? candidate.lat;
  const lngRaw = candidate.longitude ?? candidate.lng;

  if (typeof latRaw !== 'number' || typeof lngRaw !== 'number') {
    return null;
  }

  if (!Number.isFinite(latRaw) || !Number.isFinite(lngRaw)) {
    return null;
  }

  if (Math.abs(latRaw) > 90 || Math.abs(lngRaw) > 180) {
    return null;
  }

  return { lat: latRaw, lng: lngRaw };
}

function CopMapViewportController({
  mapPoints,
  selectedLocationId,
  mapZoomLevel,
  fitToSignalsNonce,
  resetMapExtentNonce,
}: {
  mapPoints: Array<{ locationId: number; coordinate: CopGeoCoordinate }>;
  selectedLocationId: number | null;
  mapZoomLevel: number;
  fitToSignalsNonce: number;
  resetMapExtentNonce: number;
}) {
  const map = useMap();
  const [hasInitialFitApplied, setHasInitialFitApplied] = useState(false);

  const fitToSignalPoints = () => {
    if (mapPoints.length === 0) {
      map.setView(COP_MAP_CENTER, COP_MAP_DEFAULT_ZOOM);
      return;
    }

    const bounds: [[number, number], [number, number]] = [
      [Math.min(...mapPoints.map((point) => point.coordinate.lat)), Math.min(...mapPoints.map((point) => point.coordinate.lng))],
      [Math.max(...mapPoints.map((point) => point.coordinate.lat)), Math.max(...mapPoints.map((point) => point.coordinate.lng))],
    ];

    map.fitBounds(bounds, {
      padding: [20, 20],
      maxZoom: 9,
      animate: true,
      duration: 0.45,
    });
  };

  useEffect(() => {
    if (mapPoints.length === 0 || hasInitialFitApplied) {
      return;
    }

    fitToSignalPoints();
    setHasInitialFitApplied(true);
  }, [hasInitialFitApplied, map, mapPoints]);

  useEffect(() => {
    fitToSignalPoints();
  }, [fitToSignalsNonce, map, mapPoints]);

  useEffect(() => {
    map.setView(COP_MAP_CENTER, COP_MAP_DEFAULT_ZOOM, { animate: true, duration: 0.45 });
  }, [map, resetMapExtentNonce]);

  useEffect(() => {
    map.setZoom(mapZoomLevel);
  }, [map, mapZoomLevel]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize();
    }, 60);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [map, mapPoints.length, mapZoomLevel]);

  useEffect(() => {
    if (selectedLocationId === null) {
      return;
    }

    const selected = mapPoints.find((point) => point.locationId === selectedLocationId);
    if (!selected) {
      return;
    }

    map.flyTo([selected.coordinate.lat, selected.coordinate.lng], Math.max(map.getZoom(), 8), {
      animate: true,
      duration: 0.45,
    });
  }, [map, mapPoints, selectedLocationId]);

  return null;
}

function CopMapZoomSync({
  onZoomChanged,
}: {
  onZoomChanged: (zoom: number) => void;
}) {
  const [lastZoom, setLastZoom] = useState<number | null>(null);

  useMapEvents({
    zoomend: (event) => {
      const nextZoom = event.target.getZoom();
      if (lastZoom === nextZoom) {
        return;
      }

      setLastZoom(nextZoom);
      onZoomChanged(nextZoom);
    },
  });

  return null;
}

function CommonOperatingPictureCard({ isAuthenticated, incidents, resourceInventory, bedAvailability, locationLookups, operationalInsight, weatherOperationalSignal, onNavigate, onNotify }: CommonOperatingPictureCardProps) {
  const COP_AOI_SCOPE = 'cop-aoi-filters';
  const COP_LAYER_SET_SCOPE = 'cop-layer-set-presets';
  const COP_AI_SCOPE = 'cop-ai-copilot';
  const COP_AI_PRESET = 'default';
  const COP_AI_LOCAL_KEY = 'ipoc.cop.aiCopilot';
  const [regionFilter, setRegionFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [drilldownRegion, setDrilldownRegion] = useState<string | null>(null);
  const [drilldownLocationId, setDrilldownLocationId] = useState<number | null>(null);
  const [geoOverlayLayer, setGeoOverlayLayer] = useState<'composite' | 'resource' | 'bed' | 'incident'>('composite');
  const [geoOverlayStressFilter, setGeoOverlayStressFilter] = useState<'all' | 'watch' | 'high'>('all');
  const [copLiveOverlayFeedMode, setCopLiveOverlayFeedMode] = useState<CopLiveOverlayFeedMode>('off');
  const [copLiveOverlayFeedPoints, setCopLiveOverlayFeedPoints] = useState<Record<number, CopLiveOverlayFeedPoint>>({});
  const [copLiveOverlayFeedHealth, setCopLiveOverlayFeedHealth] = useState<CopLiveOverlayFeedHealth>({
    provider: 'none',
    status: 'inactive',
    fallbackUsed: false,
    detail: null,
    lastExternalAttemptUtc: null,
    lastExternalFailureReason: null,
    generatedUtc: null,
  });
  const [acknowledgedOverlayLocationIds, setAcknowledgedOverlayLocationIds] = useState<number[]>([]);
  const [copMapBaseLayer, setCopMapBaseLayer] = useState<CopMapBaseLayerMode>('streets');
  const [copMapZoomLevel, setCopMapZoomLevel] = useState(COP_MAP_DEFAULT_ZOOM);
  const [fitCopMapToSignalsNonce, setFitCopMapToSignalsNonce] = useState(0);
  const [resetCopMapExtentNonce, setResetCopMapExtentNonce] = useState(0);
  const [copMapFocusMode, setCopMapFocusMode] = useState(false);
  const [aoiPresetNameInput, setAoiPresetNameInput] = useState('');
  const [aoiLinkedLayerSetPresetId, setAoiLinkedLayerSetPresetId] = useState('none');
  const [layerSetNameInput, setLayerSetNameInput] = useState('');
  const [aiCopilotPrompt, setAiCopilotPrompt] = useState('Summarize overnight changes and recommend operational priorities.');
  const [aiCopilotOutput, setAiCopilotOutput] = useState('');
  const [aiCopilotGeneratedAt, setAiCopilotGeneratedAt] = useState<string | null>(null);
  const [aiCopilotApprovalStatus, setAiCopilotApprovalStatus] = useState<'not-started' | 'pending-review' | 'approved' | 'rejected'>('not-started');
  const [aiCopilotApprover, setAiCopilotApprover] = useState('');
  const [aiCopilotApprovalAt, setAiCopilotApprovalAt] = useState<string | null>(null);
  const [showWeatherRiskDayDetails, setShowWeatherRiskDayDetails] = useState(false);

  const weatherRiskLevelFilter = weatherOperationalSignal.highRiskDayCount > 0 ? 'high' : 'moderate';
  const weatherRiskDays = weatherOperationalSignal.days.filter((item) => item.riskLevel === weatherRiskLevelFilter);

  const parseAiApprovalStatus = (value: unknown): 'not-started' | 'pending-review' | 'approved' | 'rejected' => {
    if (value === 'pending-review' || value === 'approved' || value === 'rejected') {
      return value;
    }

    return 'not-started';
  };
  const [aoiPresets, setAoiPresets] = useState<CopAoiPreset[]>(() => {
    const raw = localStorage.getItem('ipoc.cop.aoiPresets');
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as CopAoiPreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [layerSetPresets, setLayerSetPresets] = useState<CopLayerSetPreset[]>(() => {
    const raw = localStorage.getItem('ipoc.cop.layerSetPresets');
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as CopLayerSetPreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadServerPresets = async () => {
      try {
        const presets = await getUserReportPresets(COP_AOI_SCOPE);
        const mapped: CopAoiPreset[] = [];

        presets.forEach((preset) => {
          try {
            const parsed = JSON.parse(preset.presetJson) as Partial<CopAoiPreset>;
            mapped.push({
              id: `server-${preset.userReportPresetId}`,
              name: preset.presetName,
              regionFilter: typeof parsed.regionFilter === 'string' ? parsed.regionFilter : 'All',
              locationFilter: typeof parsed.locationFilter === 'string' ? parsed.locationFilter : 'All',
              linkedLayerSetPresetId: typeof parsed.linkedLayerSetPresetId === 'string' ? parsed.linkedLayerSetPresetId : null,
              linkedLayerSetPresetName: typeof parsed.linkedLayerSetPresetName === 'string' ? parsed.linkedLayerSetPresetName : null,
              userReportPresetId: preset.userReportPresetId,
            });
          } catch {
            // skip malformed preset payload
          }
        });

        if (!cancelled && mapped.length > 0) {
          setAoiPresets(mapped);
          localStorage.setItem('ipoc.cop.aoiPresets', JSON.stringify(mapped));
        }
      } catch {
        // local presets remain active
      }
    };

    void loadServerPresets();

    return () => {
      cancelled = true;
    };
  }, [COP_AOI_SCOPE, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadLayerSetPresets = async () => {
      try {
        const presets = await getUserReportPresets(COP_LAYER_SET_SCOPE);
        const mapped: CopLayerSetPreset[] = [];

        presets.forEach((preset) => {
          try {
            const parsed = JSON.parse(preset.presetJson) as Partial<CopLayerSetPreset>;
            mapped.push({
              id: `server-${preset.userReportPresetId}`,
              name: preset.presetName,
              geoOverlayLayer: parsed.geoOverlayLayer === 'resource' || parsed.geoOverlayLayer === 'bed' || parsed.geoOverlayLayer === 'incident' ? parsed.geoOverlayLayer : 'composite',
              geoOverlayStressFilter: parsed.geoOverlayStressFilter === 'watch' || parsed.geoOverlayStressFilter === 'high' ? parsed.geoOverlayStressFilter : 'all',
              copMapBaseLayer: parsed.copMapBaseLayer === 'terrain' ? 'terrain' : 'streets',
              copLiveOverlayFeedMode: parsed.copLiveOverlayFeedMode === 'simulated' ? 'simulated' : 'off',
              userReportPresetId: preset.userReportPresetId,
            });
          } catch {
            // skip malformed payloads
          }
        });

        if (!cancelled && mapped.length > 0) {
          setLayerSetPresets(mapped);
          localStorage.setItem('ipoc.cop.layerSetPresets', JSON.stringify(mapped));
        }
      } catch {
        // local presets remain active
      }
    };

    void loadLayerSetPresets();

    return () => {
      cancelled = true;
    };
  }, [COP_LAYER_SET_SCOPE, isAuthenticated]);

  useEffect(() => {
    const persisted = localStorage.getItem(COP_AI_LOCAL_KEY);
    if (!persisted) {
      return;
    }

    try {
      const parsed = JSON.parse(persisted) as {
        aiCopilotPrompt?: string;
        aiCopilotOutput?: string;
        aiCopilotGeneratedAt?: string | null;
        aiCopilotApprovalStatus?: string;
        aiCopilotApprover?: string;
        aiCopilotApprovalAt?: string | null;
      };

      setAiCopilotPrompt(typeof parsed.aiCopilotPrompt === 'string' ? parsed.aiCopilotPrompt : 'Summarize overnight changes and recommend operational priorities.');
      setAiCopilotOutput(typeof parsed.aiCopilotOutput === 'string' ? parsed.aiCopilotOutput : '');
      setAiCopilotGeneratedAt(typeof parsed.aiCopilotGeneratedAt === 'string' ? parsed.aiCopilotGeneratedAt : null);
      setAiCopilotApprovalStatus(parseAiApprovalStatus(parsed.aiCopilotApprovalStatus));
      setAiCopilotApprover(typeof parsed.aiCopilotApprover === 'string' ? parsed.aiCopilotApprover : '');
      setAiCopilotApprovalAt(typeof parsed.aiCopilotApprovalAt === 'string' ? parsed.aiCopilotApprovalAt : null);
    } catch {
      // ignore invalid persisted state
    }
  }, [COP_AI_LOCAL_KEY]);

  useEffect(() => {
    localStorage.setItem(COP_AI_LOCAL_KEY, JSON.stringify({
      aiCopilotPrompt,
      aiCopilotOutput,
      aiCopilotGeneratedAt,
      aiCopilotApprovalStatus,
      aiCopilotApprover,
      aiCopilotApprovalAt,
    }));
  }, [COP_AI_LOCAL_KEY, aiCopilotApprovalAt, aiCopilotApprovalStatus, aiCopilotApprover, aiCopilotGeneratedAt, aiCopilotOutput, aiCopilotPrompt]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadServerAiState = async () => {
      try {
        const presets = await getUserReportPresets(COP_AI_SCOPE);
        const preset = presets.find((item) => item.presetName === COP_AI_PRESET) ?? presets[0] ?? null;
        if (!preset || !preset.presetJson || cancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          aiCopilotPrompt?: string;
          aiCopilotOutput?: string;
          aiCopilotGeneratedAt?: string | null;
          aiCopilotApprovalStatus?: string;
          aiCopilotApprover?: string;
          aiCopilotApprovalAt?: string | null;
        };

        setAiCopilotPrompt(typeof parsed.aiCopilotPrompt === 'string' ? parsed.aiCopilotPrompt : 'Summarize overnight changes and recommend operational priorities.');
        setAiCopilotOutput(typeof parsed.aiCopilotOutput === 'string' ? parsed.aiCopilotOutput : '');
        setAiCopilotGeneratedAt(typeof parsed.aiCopilotGeneratedAt === 'string' ? parsed.aiCopilotGeneratedAt : null);
        setAiCopilotApprovalStatus(parseAiApprovalStatus(parsed.aiCopilotApprovalStatus));
        setAiCopilotApprover(typeof parsed.aiCopilotApprover === 'string' ? parsed.aiCopilotApprover : '');
        setAiCopilotApprovalAt(typeof parsed.aiCopilotApprovalAt === 'string' ? parsed.aiCopilotApprovalAt : null);
      } catch {
        // fallback remains local storage
      }
    };

    void loadServerAiState();

    return () => {
      cancelled = true;
    };
  }, [COP_AI_PRESET, COP_AI_SCOPE, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void upsertUserReportPreset(COP_AI_SCOPE, {
        presetName: COP_AI_PRESET,
        presetJson: JSON.stringify({
          aiCopilotPrompt,
          aiCopilotOutput,
          aiCopilotGeneratedAt,
          aiCopilotApprovalStatus,
          aiCopilotApprover,
          aiCopilotApprovalAt,
        }),
      }).catch(() => {
        // fallback remains local storage
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [COP_AI_PRESET, COP_AI_SCOPE, aiCopilotApprovalAt, aiCopilotApprovalStatus, aiCopilotApprover, aiCopilotGeneratedAt, aiCopilotOutput, aiCopilotPrompt, isAuthenticated]);

  const regionOptions = useMemo(() => {
    const names = new Set<string>();
    locationLookups.forEach((location) => {
      if (location.regionName && location.regionName.trim().length > 0) {
        names.add(location.regionName.trim());
      }
    });

    return ['All', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [locationLookups]);

  const locationOptions = useMemo(() => {
    const filtered = locationLookups.filter((location) => {
      if (regionFilter === 'All') {
        return true;
      }

      return (location.regionName ?? '') === regionFilter;
    });

    return [
      { label: 'All', value: 'All' },
      ...filtered.map((location) => ({
        label: location.displayText,
        value: String(location.locationId),
      })),
    ];
  }, [locationLookups, regionFilter]);

  const scopedLocationIds = useMemo(() => {
    const scoped = locationLookups.filter((location) => {
      if (regionFilter !== 'All' && (location.regionName ?? '') !== regionFilter) {
        return false;
      }

      if (locationFilter !== 'All' && String(location.locationId) !== locationFilter) {
        return false;
      }

      return true;
    });

    return new Set(scoped.map((location) => location.locationId));
  }, [locationLookups, regionFilter, locationFilter]);

  const scopedLocationMap = useMemo(() => {
    const map = new Map<number, LocationLookupValue>();
    locationLookups.forEach((location) => {
      if (scopedLocationIds.has(location.locationId)) {
        map.set(location.locationId, location);
      }
    });
    return map;
  }, [locationLookups, scopedLocationIds]);

  const scopedResourceInventory = useMemo(
    () => resourceInventory.filter((item) => scopedLocationIds.has(item.locationId)),
    [resourceInventory, scopedLocationIds],
  );

  const scopedBedAvailability = useMemo(
    () => bedAvailability.filter((item) => scopedLocationIds.has(item.locationId)),
    [bedAvailability, scopedLocationIds],
  );

  const incidentPosture = useMemo(() => {
    const summary = {
      total: incidents.length,
      active: 0,
      closed: 0,
      criticalSeverity: 0,
      highSeverity: 0,
    };

    incidents.forEach((incident) => {
      if (incident.incidentStatusCode === 'Closed') {
        summary.closed += 1;
      } else {
        summary.active += 1;
      }

      if (incident.severityCode === 'Critical') {
        summary.criticalSeverity += 1;
      }

      if (incident.severityCode === 'High') {
        summary.highSeverity += 1;
      }
    });

    return summary;
  }, [incidents]);

  const resourcePosture = useMemo(() => {
    const summary = {
      totalQuantity: 0,
      availableQuantity: 0,
      committedQuantity: 0,
      outOfServiceQuantity: 0,
    };

    scopedResourceInventory.forEach((item) => {
      summary.totalQuantity += item.quantityTotal;
      summary.availableQuantity += item.quantityAvailable;
      summary.committedQuantity += item.quantityCommitted;
      summary.outOfServiceQuantity += item.quantityOutOfService;
    });

    return summary;
  }, [scopedResourceInventory]);

  const bedPosture = useMemo(() => {
    const summary = {
      staffedBedsTotal: 0,
      bedsAvailable: 0,
      bedsOccupied: 0,
      bedsUnavailable: 0,
      surgeBedsPotential: 0,
    };

    scopedBedAvailability.forEach((item) => {
      summary.staffedBedsTotal += item.staffedBedsTotal ?? 0;
      summary.bedsAvailable += item.bedsAvailable ?? 0;
      summary.bedsOccupied += item.bedsOccupied ?? 0;
      summary.bedsUnavailable += item.bedsUnavailable ?? 0;
      summary.surgeBedsPotential += item.surgeBedsPotential ?? 0;
    });

    return summary;
  }, [scopedBedAvailability]);

  const locationRollups = useMemo(() => {
    const rollups = new Map<number, {
      locationId: number;
      locationName: string;
      regionName: string;
      resourceAvailable: number;
      resourceCommitted: number;
      resourceOutOfService: number;
      bedsAvailable: number;
      bedsOccupied: number;
      bedsUnavailable: number;
    }>();

    scopedLocationMap.forEach((location, locationId) => {
      rollups.set(locationId, {
        locationId,
        locationName: location.locationName,
        regionName: location.regionName ?? 'Unassigned',
        resourceAvailable: 0,
        resourceCommitted: 0,
        resourceOutOfService: 0,
        bedsAvailable: 0,
        bedsOccupied: 0,
        bedsUnavailable: 0,
      });
    });

    scopedResourceInventory.forEach((item) => {
      const rollup = rollups.get(item.locationId);
      if (!rollup) {
        return;
      }

      rollup.resourceAvailable += item.quantityAvailable;
      rollup.resourceCommitted += item.quantityCommitted;
      rollup.resourceOutOfService += item.quantityOutOfService;
    });

    scopedBedAvailability.forEach((item) => {
      const rollup = rollups.get(item.locationId);
      if (!rollup) {
        return;
      }

      rollup.bedsAvailable += item.bedsAvailable ?? 0;
      rollup.bedsOccupied += item.bedsOccupied ?? 0;
      rollup.bedsUnavailable += item.bedsUnavailable ?? 0;
    });

    return Array.from(rollups.values()).sort((a, b) => a.locationName.localeCompare(b.locationName));
  }, [scopedLocationMap, scopedResourceInventory, scopedBedAvailability]);

  const resourceReadinessPercent = useMemo(() => {
    if (resourcePosture.totalQuantity <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((resourcePosture.availableQuantity / resourcePosture.totalQuantity) * 100)));
  }, [resourcePosture]);

  const bedCapacityPercent = useMemo(() => {
    if (bedPosture.staffedBedsTotal <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((bedPosture.bedsAvailable / bedPosture.staffedBedsTotal) * 100)));
  }, [bedPosture]);

  const incidentPressurePercent = useMemo(() => {
    if (incidentPosture.total <= 0) {
      return 0;
    }

    const weightedPressure = incidentPosture.criticalSeverity * 35 + incidentPosture.highSeverity * 20 + incidentPosture.active * 10;
    const maxPressure = incidentPosture.total * 35;
    return Math.max(0, Math.min(100, Math.round((weightedPressure / maxPressure) * 100)));
  }, [incidentPosture]);

  const incidentComplexityIndex = useMemo(() => {
    const weighted = (incidentPosture.criticalSeverity * 4) + (incidentPosture.highSeverity * 2) + incidentPosture.active;
    return Math.max(1, weighted);
  }, [incidentPosture]);

  const predictiveSignals = useMemo(() => {
    const hospitalSurgeRisk = Math.min(100, Math.round((100 - bedCapacityPercent) + (incidentPressurePercent * 0.35)));
    const ppeDepletionRisk = Math.min(100, Math.round((100 - resourceReadinessPercent) + (incidentPressurePercent * 0.25)));
    const staffingShortageRisk = Math.min(100, Math.round((incidentPressurePercent * 0.55) + (incidentComplexityIndex * 1.4)));
    const shelterOccupancyRisk = Math.min(100, Math.round((incidentPressurePercent * 0.5) + (incidentPosture.active * 2)));
    const fuelShortageRisk = Math.min(100, Math.round((100 - resourceReadinessPercent) * 0.85));
    const debrisVolumeRisk = Math.min(100, Math.round((incidentPressurePercent * 0.4) + (incidentPosture.active * 1.8)));

    return [
      { id: 'predict-hospital-surge', label: 'Hospital surge', value: hospitalSurgeRisk },
      { id: 'predict-ppe-depletion', label: 'PPE depletion', value: ppeDepletionRisk },
      { id: 'predict-staffing-shortage', label: 'Staffing shortages', value: staffingShortageRisk },
      { id: 'predict-shelter-occupancy', label: 'Shelter occupancy', value: shelterOccupancyRisk },
      { id: 'predict-fuel-shortage', label: 'Fuel shortages', value: fuelShortageRisk },
      { id: 'predict-debris-volume', label: 'Debris volume', value: debrisVolumeRisk },
    ];
  }, [bedCapacityPercent, incidentComplexityIndex, incidentPosture.active, incidentPressurePercent, resourceReadinessPercent]);

  const commandRiskActions = useMemo(() => {
    const actions: string[] = [];

    const nimsGaps = operationalInsight?.nimsComplianceGaps ?? [];
    const dependencyBlockers = operationalInsight?.missionDependencyBlockers ?? [];
    const commandRecommendations = operationalInsight?.commandPostureRecommendations ?? [];

    if (nimsGaps.length > 0) {
      actions.push(`Close ${nimsGaps.length} NIMS compliance gap(s) in the next planning cycle.`);
    }

    if (dependencyBlockers.length > 0) {
      actions.push(`Prioritize mitigation for ${dependencyBlockers.length} mission dependency blocker(s).`);
    }

    if (commandRecommendations.length > 0) {
      actions.push(commandRecommendations[0]);
    }

    if (actions.length === 0) {
      actions.push('No immediate command risk actions generated. Maintain current COP monitoring cadence.');
    }

    return actions.slice(0, 3);
  }, [operationalInsight]);

  const canGenerateAiCopilotOutput = incidentPosture.total > 0 && locationRollups.length > 0;

  const buildAiCopilotOutput = (request: string) => {
    const topPrediction = [...predictiveSignals].sort((a, b) => b.value - a.value)[0];

    return [
      `AI Incident Co-Pilot Response (${new Date().toISOString()})`,
      `Request: ${request}`,
      `Incident posture: ${incidentPosture.active} active / ${incidentPosture.closed} closed (critical ${incidentPosture.criticalSeverity}, high ${incidentPosture.highSeverity}).`,
      `Operational scope: ${locationRollups.length} locations in AOI.`,
      `Predicted top impact: ${topPrediction.label} risk ${topPrediction.value}%.`,
      `Recommended actions:`,
      '1) Prioritize facilities with highest constrained-location stress and open dependency blockers.',
      '2) Pre-stage mutual aid resources for high-risk regions and validate next operational period staffing targets.',
      '3) Trigger communications update and command briefing package for upcoming period.',
      '',
      'Draft ICS products generated from current posture are available via ICS draft actions below.',
    ].join('\n');
  };

  const generateAiCopilotOutput = (request: string) => {
    if (!canGenerateAiCopilotOutput) {
      onNotify('AI Incident Co-Pilot blocked: incident and location baseline data are required.', 'warning');
      return;
    }

    const generatedAt = new Date().toISOString();
    setAiCopilotOutput(buildAiCopilotOutput(request));
    setAiCopilotGeneratedAt(generatedAt);
    setAiCopilotApprovalStatus('pending-review');
    setAiCopilotApprovalAt(null);
    onNotify('AI Incident Co-Pilot draft generated. Human approval is required before operational use.', 'info');
  };

  const generateIcsDraft = (icsProduct: 'ICS-202' | 'ICS-203' | 'ICS-204') => {
    const prompt = `Draft ${icsProduct} from current operations.`;
    setAiCopilotPrompt(prompt);
    generateAiCopilotOutput(prompt);
  };

  const runCopilotQuickPrompt = (prompt: string) => {
    setAiCopilotPrompt(prompt);
    generateAiCopilotOutput(prompt);
  };

  const approveAiCopilotOutput = () => {
    if (aiCopilotApprovalStatus !== 'pending-review' || aiCopilotOutput.trim().length === 0) {
      onNotify('AI Incident Co-Pilot approval blocked: generate a pending-review draft first.', 'warning');
      return;
    }

    const actor = aiCopilotApprover.trim().length > 0 ? aiCopilotApprover.trim() : 'COP operator';
    setAiCopilotApprover(actor);
    setAiCopilotApprovalStatus('approved');
    setAiCopilotApprovalAt(new Date().toISOString());
    onNotify(`AI Incident Co-Pilot draft approved by ${actor}.`, 'success');
  };

  const rejectAiCopilotOutput = () => {
    if (aiCopilotApprovalStatus !== 'pending-review' || aiCopilotOutput.trim().length === 0) {
      onNotify('AI Incident Co-Pilot rejection blocked: generate a pending-review draft first.', 'warning');
      return;
    }

    const actor = aiCopilotApprover.trim().length > 0 ? aiCopilotApprover.trim() : 'COP operator';
    setAiCopilotApprover(actor);
    setAiCopilotApprovalStatus('rejected');
    setAiCopilotApprovalAt(new Date().toISOString());
    onNotify(`AI Incident Co-Pilot draft rejected by ${actor}.`, 'warning');
  };

  const locationCapacityChartData = useMemo(() => {
    return locationRollups.slice(0, 8).map((rollup) => ({
      location: rollup.locationName,
      resourcesAvailable: rollup.resourceAvailable,
      bedsAvailable: rollup.bedsAvailable,
    }));
  }, [locationRollups]);

  const regionalPressureChartData = useMemo(() => {
    const regionMap = new Map<string, { region: string; critical: number; high: number; active: number; locations: number }>();
    locationRollups.forEach((rollup) => {
      const existing = regionMap.get(rollup.regionName);
      if (existing) {
        existing.locations += 1;
        return;
      }

      regionMap.set(rollup.regionName, {
        region: rollup.regionName,
        critical: 0,
        high: 0,
        active: 0,
        locations: 1,
      });
    });

    if (regionMap.size === 0) {
      regionMap.set('Unassigned', {
        region: 'Unassigned',
        critical: incidentPosture.criticalSeverity,
        high: incidentPosture.highSeverity,
        active: incidentPosture.active,
        locations: 1,
      });
    } else {
      const values = Array.from(regionMap.values());
      const activeSeed = Math.max(1, incidentPosture.active);
      values.forEach((entry, index) => {
        const weight = entry.locations / values.reduce((sum, item) => sum + item.locations, 0);
        entry.active = Math.round(activeSeed * weight);
        entry.critical = Math.round(incidentPosture.criticalSeverity * weight);
        entry.high = Math.round(incidentPosture.highSeverity * weight);
        if (index === values.length - 1) {
          const activeDelta = incidentPosture.active - values.reduce((sum, item) => sum + item.active, 0);
          const criticalDelta = incidentPosture.criticalSeverity - values.reduce((sum, item) => sum + item.critical, 0);
          const highDelta = incidentPosture.highSeverity - values.reduce((sum, item) => sum + item.high, 0);
          entry.active += activeDelta;
          entry.critical += criticalDelta;
          entry.high += highDelta;
        }
      });
    }

    return Array.from(regionMap.values()).sort((a, b) => b.critical - a.critical || b.high - a.high || a.region.localeCompare(b.region));
  }, [incidentPosture, locationRollups]);

  const bedMixChartData = useMemo(() => {
    return [
      { name: 'Available', value: bedPosture.bedsAvailable, fill: '#198754' },
      { name: 'Occupied', value: bedPosture.bedsOccupied, fill: '#0d6efd' },
      { name: 'Unavailable', value: bedPosture.bedsUnavailable, fill: '#dc3545' },
    ].filter((item) => item.value > 0);
  }, [bedPosture]);

  const constrainedLocations = useMemo(() => {
    return locationRollups
      .map((rollup) => {
        const resourceTotal = rollup.resourceAvailable + rollup.resourceCommitted + rollup.resourceOutOfService;
        const bedTotal = rollup.bedsAvailable + rollup.bedsOccupied + rollup.bedsUnavailable;
        const resourceStress = resourceTotal > 0 ? (rollup.resourceCommitted + rollup.resourceOutOfService) / resourceTotal : 0;
        const bedStress = bedTotal > 0 ? (rollup.bedsOccupied + rollup.bedsUnavailable) / bedTotal : 0;
        const compositeStress = ((resourceStress + bedStress) / 2) * 100;

        return {
          ...rollup,
          compositeStress: Math.round(compositeStress),
        };
      })
      .sort((a, b) => b.compositeStress - a.compositeStress)
      .slice(0, 5);
  }, [locationRollups]);

  const copGeoOverlayPoints = useMemo(() => {
    return locationRollups
      .map((rollup) => {
        const explicitCoordinate = extractLocationCoordinate(scopedLocationMap.get(rollup.locationId));
        const resourceTotal = rollup.resourceAvailable + rollup.resourceCommitted + rollup.resourceOutOfService;
        const bedTotal = rollup.bedsAvailable + rollup.bedsOccupied + rollup.bedsUnavailable;
        const resourceStress = resourceTotal > 0 ? (rollup.resourceCommitted + rollup.resourceOutOfService) / resourceTotal : 0;
        const bedStress = bedTotal > 0 ? (rollup.bedsOccupied + rollup.bedsUnavailable) / bedTotal : 0;
        const compositeStress = Math.round(((resourceStress + bedStress) / 2) * 100);
        const incidentStress = Math.min(100, Math.round((incidentPressurePercent * 0.7) + (compositeStress * 0.3)));

        const layerStress = geoOverlayLayer === 'resource'
          ? Math.round(resourceStress * 100)
          : geoOverlayLayer === 'bed'
            ? Math.round(bedStress * 100)
            : geoOverlayLayer === 'incident'
              ? incidentStress
              : compositeStress;

        return {
          ...rollup,
          coordinate: explicitCoordinate ?? resolveCopGeoCoordinate(rollup.locationId),
          compositeStress,
          resourceStressPercent: Math.round(resourceStress * 100),
          bedStressPercent: Math.round(bedStress * 100),
          incidentStressPercent: incidentStress,
          layerStress,
        };
      })
      .slice(0, 30);
  }, [geoOverlayLayer, incidentPressurePercent, locationRollups, scopedLocationMap]);

  useEffect(() => {
    if (!COP_LIVE_OVERLAY_FEED_ENABLED || copLiveOverlayFeedMode !== 'simulated') {
      setCopLiveOverlayFeedPoints({});
      setCopLiveOverlayFeedHealth({
        provider: 'none',
        status: 'inactive',
        fallbackUsed: false,
        detail: null,
        lastExternalAttemptUtc: null,
        lastExternalFailureReason: null,
        generatedUtc: null,
      });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadFeed = async () => {
      try {
        const feed = await getCopLiveOverlayFeed();
        if (cancelled || controller.signal.aborted) {
          return;
        }

        const nextFeed = feed.points.reduce<Record<number, CopLiveOverlayFeedPoint>>((accumulator, point) => {
          accumulator[point.locationId] = point;
          return accumulator;
        }, {});

        setCopLiveOverlayFeedPoints(nextFeed);
        setCopLiveOverlayFeedHealth({
          provider: feed.provider,
          status: feed.status,
          fallbackUsed: feed.fallbackUsed,
          detail: feed.detail,
          lastExternalAttemptUtc: feed.lastExternalAttemptUtc ?? null,
          lastExternalFailureReason: feed.lastExternalFailureReason ?? null,
          generatedUtc: feed.generatedUtc,
        });
      } catch {
        if (!cancelled) {
          setCopLiveOverlayFeedPoints({});
          setCopLiveOverlayFeedHealth({
            provider: 'error',
            status: 'error',
            fallbackUsed: false,
            detail: 'Live overlay feed unavailable. Using local overlay baseline.',
            lastExternalAttemptUtc: null,
            lastExternalFailureReason: null,
            generatedUtc: null,
          });
        }
      }
    };

    void loadFeed();
    const intervalId = window.setInterval(() => {
      void loadFeed();
    }, 15000);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [copLiveOverlayFeedMode]);

  const copGeoOverlayFeedAdjustedPoints = useMemo(() => {
    if (copLiveOverlayFeedMode !== 'simulated') {
      return copGeoOverlayPoints;
    }

    return copGeoOverlayPoints.map((point) => {
      const feedPoint = copLiveOverlayFeedPoints[point.locationId];
      if (!feedPoint) {
        return point;
      }

      const nextLayerStress = Math.max(0, Math.min(100, point.layerStress + feedPoint.stressDelta));
      return {
        ...point,
        layerStress: nextLayerStress,
      };
    });
  }, [copLiveOverlayFeedPoints, copGeoOverlayPoints, copLiveOverlayFeedMode]);

  const copGeoOverlayVisiblePoints = useMemo(() => {
    if (geoOverlayStressFilter === 'high') {
      return copGeoOverlayFeedAdjustedPoints.filter((point) => point.layerStress >= 75);
    }

    if (geoOverlayStressFilter === 'watch') {
      return copGeoOverlayFeedAdjustedPoints.filter((point) => point.layerStress >= 55);
    }

    return copGeoOverlayFeedAdjustedPoints;
  }, [copGeoOverlayFeedAdjustedPoints, geoOverlayStressFilter]);

  const copGeoOverlayViewportPoints = useMemo(
    () => copGeoOverlayVisiblePoints.map((point) => ({ locationId: point.locationId, coordinate: point.coordinate })),
    [copGeoOverlayVisiblePoints],
  );

  const geoOverlaySummary = useMemo(() => {
    if (copGeoOverlayVisiblePoints.length === 0) {
      return {
        layer: geoOverlayLayer,
        averageStress: 0,
        highStressCount: 0,
        watchStressCount: 0,
      };
    }

    const total = copGeoOverlayVisiblePoints.reduce((sum, point) => sum + point.layerStress, 0);
    const highStressCount = copGeoOverlayVisiblePoints.filter((point) => point.layerStress >= 75).length;
    const watchStressCount = copGeoOverlayVisiblePoints.filter((point) => point.layerStress >= 55 && point.layerStress < 75).length;

    return {
      layer: geoOverlayLayer,
      averageStress: Math.round(total / copGeoOverlayVisiblePoints.length),
      highStressCount,
      watchStressCount,
    };
  }, [copGeoOverlayVisiblePoints, geoOverlayLayer]);

  const copGeoHotspots = useMemo(() => {
    return [...copGeoOverlayVisiblePoints]
      .sort((a, b) => b.layerStress - a.layerStress || b.compositeStress - a.compositeStress)
      .slice(0, 5);
  }, [copGeoOverlayVisiblePoints]);

  const overlayCommandQueue = useMemo(() => {
    return copGeoHotspots
      .filter((point) => !acknowledgedOverlayLocationIds.includes(point.locationId))
      .map((point) => {
      const priority = point.layerStress >= 85 ? 'Immediate' : point.layerStress >= 70 ? 'Priority' : 'Monitor';
      const action = point.layerStress >= 85
        ? 'Escalate incident command execution and validate contingency capacity.'
        : point.layerStress >= 70
          ? 'Open planning and assign mitigation actions for the next period cycle.'
          : 'Track trend and maintain watch posture.';

      return {
        ...point,
        priority,
        action,
      };
    });
  }, [acknowledgedOverlayLocationIds, copGeoHotspots]);

  const tableDrilldownRows = useMemo(() => {
    return locationRollups.filter((rollup) => {
      if (drilldownRegion && rollup.regionName !== drilldownRegion) {
        return false;
      }

      if (drilldownLocationId !== null && rollup.locationId !== drilldownLocationId) {
        return false;
      }

      return true;
    });
  }, [drilldownLocationId, drilldownRegion, locationRollups]);

  const tableGridRows = useMemo(() => tableDrilldownRows.map((rollup) => ({
    id: rollup.locationId,
    regionName: rollup.regionName,
    locationName: rollup.locationName,
    resourceAvailable: rollup.resourceAvailable,
    resourceCommitted: rollup.resourceCommitted,
    resourceOutOfService: rollup.resourceOutOfService,
    bedsAvailable: rollup.bedsAvailable,
    bedsOccupied: rollup.bedsOccupied,
    bedsUnavailable: rollup.bedsUnavailable,
  })), [tableDrilldownRows]);

  const tableGridColumnDefs: ColDef<(typeof tableGridRows)[number]>[] = useMemo(() => [
    { field: 'regionName', headerName: 'Region', minWidth: 140, flex: 1 },
    { field: 'locationName', headerName: 'Location', minWidth: 170, flex: 1.2 },
    { field: 'resourceAvailable', headerName: 'Res Available', minWidth: 130, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'resourceCommitted', headerName: 'Res Committed', minWidth: 135, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'resourceOutOfService', headerName: 'Res OOS', minWidth: 110, flex: 0.9, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'bedsAvailable', headerName: 'Beds Available', minWidth: 130, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'bedsOccupied', headerName: 'Beds Occupied', minWidth: 130, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'bedsUnavailable', headerName: 'Beds Unavailable', minWidth: 140, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
  ], []);

  const handleRegionalPressureDrilldown = (regionName: string | undefined) => {
    if (!regionName) {
      return;
    }

    setDrilldownRegion(regionName);
    setDrilldownLocationId(null);
  };

  const handleLocationCapacityDrilldown = (locationName: string | undefined) => {
    if (!locationName) {
      return;
    }

    const matched = locationRollups.find((rollup) => rollup.locationName === locationName);
    if (!matched) {
      return;
    }

    setDrilldownLocationId(matched.locationId);
    setDrilldownRegion(matched.regionName);
  };

  const copBedMixChartData = useMemo(() => bedMixChartData.map((item, index) => ({
    ...item,
    fill: index === 0
      ? 'var(--ipoc-chart-success)'
      : index === 1
        ? 'var(--ipoc-chart-series-1)'
        : 'var(--ipoc-chart-critical)',
  })), [bedMixChartData]);

  const saveAoiPreset = async () => {
    const normalizedName = aoiPresetNameInput.trim();
    if (!normalizedName) {
      return;
    }

    const linkedLayerSet = aoiLinkedLayerSetPresetId === 'none'
      ? null
      : layerSetPresets.find((preset) => preset.id === aoiLinkedLayerSetPresetId) ?? null;

    const nextPreset: CopAoiPreset = {
      id: `preset-${Date.now()}`,
      name: normalizedName,
      regionFilter,
      locationFilter,
      linkedLayerSetPresetId: linkedLayerSet?.id ?? null,
      linkedLayerSetPresetName: linkedLayerSet?.name ?? null,
    };

    const nextPresets = [nextPreset, ...aoiPresets].slice(0, 12);

    try {
      if (isAuthenticated) {
        const userReportPresetId = await upsertUserReportPreset(COP_AOI_SCOPE, {
          presetName: normalizedName,
          presetJson: JSON.stringify({
            regionFilter,
            locationFilter,
            linkedLayerSetPresetId: linkedLayerSet?.id ?? null,
            linkedLayerSetPresetName: linkedLayerSet?.name ?? null,
          }),
        });

        const merged = nextPresets.map((preset) => {
          if (preset.id === nextPreset.id) {
            return {
              ...preset,
              id: `server-${userReportPresetId}`,
              userReportPresetId,
            };
          }

          return preset;
        });

        setAoiPresets(merged);
        localStorage.setItem('ipoc.cop.aoiPresets', JSON.stringify(merged));
        setAoiPresetNameInput('');
        setAoiLinkedLayerSetPresetId('none');
        return;
      }
    } catch {
      // local fallback below
    }

    setAoiPresets(nextPresets);
    localStorage.setItem('ipoc.cop.aoiPresets', JSON.stringify(nextPresets));
    setAoiPresetNameInput('');
    setAoiLinkedLayerSetPresetId('none');
  };

  const applyAoiPreset = (preset: CopAoiPreset) => {
    setRegionFilter(preset.regionFilter);
    setLocationFilter(preset.locationFilter);
    setDrilldownRegion(null);
    setDrilldownLocationId(null);

    const linkedLayerSet = layerSetPresets.find((item) => (
      (preset.linkedLayerSetPresetId && item.id === preset.linkedLayerSetPresetId)
      || (preset.linkedLayerSetPresetName && item.name === preset.linkedLayerSetPresetName)
    ));
    if (linkedLayerSet) {
      applyLayerSetPreset(linkedLayerSet);
    }
  };

  const deleteAoiPreset = async (preset: CopAoiPreset) => {
    try {
      if (isAuthenticated && preset.userReportPresetId) {
        await deleteUserReportPreset(COP_AOI_SCOPE, preset.userReportPresetId);
      }
    } catch {
      // continue with local removal
    }

    const next = aoiPresets.filter((item) => item.id !== preset.id);
    setAoiPresets(next);
    localStorage.setItem('ipoc.cop.aoiPresets', JSON.stringify(next));
  };

  const saveLayerSetPreset = async () => {
    const normalizedName = layerSetNameInput.trim();
    if (!normalizedName) {
      return;
    }

    const nextPreset: CopLayerSetPreset = {
      id: `layer-set-${Date.now()}`,
      name: normalizedName,
      geoOverlayLayer,
      geoOverlayStressFilter,
      copMapBaseLayer,
      copLiveOverlayFeedMode,
    };

    const nextPresets = [nextPreset, ...layerSetPresets].slice(0, 12);

    try {
      if (isAuthenticated) {
        const userReportPresetId = await upsertUserReportPreset(COP_LAYER_SET_SCOPE, {
          presetName: normalizedName,
          presetJson: JSON.stringify({
            geoOverlayLayer,
            geoOverlayStressFilter,
            copMapBaseLayer,
            copLiveOverlayFeedMode,
          }),
        });

        const merged = nextPresets.map((preset) => (
          preset.id === nextPreset.id
            ? { ...preset, id: `server-${userReportPresetId}`, userReportPresetId }
            : preset
        ));

        setLayerSetPresets(merged);
        localStorage.setItem('ipoc.cop.layerSetPresets', JSON.stringify(merged));
        setLayerSetNameInput('');
        return;
      }
    } catch {
      // local fallback below
    }

    setLayerSetPresets(nextPresets);
    localStorage.setItem('ipoc.cop.layerSetPresets', JSON.stringify(nextPresets));
    setLayerSetNameInput('');
  };

  const applyLayerSetPreset = (preset: CopLayerSetPreset) => {
    setGeoOverlayLayer(preset.geoOverlayLayer);
    setGeoOverlayStressFilter(preset.geoOverlayStressFilter);
    setCopMapBaseLayer(preset.copMapBaseLayer);
    setCopLiveOverlayFeedMode(preset.copLiveOverlayFeedMode);
  };

  const deleteLayerSetPreset = async (preset: CopLayerSetPreset) => {
    try {
      if (isAuthenticated && preset.userReportPresetId) {
        await deleteUserReportPreset(COP_LAYER_SET_SCOPE, preset.userReportPresetId);
      }
    } catch {
      // continue with local removal
    }

    const next = layerSetPresets.filter((item) => item.id !== preset.id);
    setLayerSetPresets(next);
    localStorage.setItem('ipoc.cop.layerSetPresets', JSON.stringify(next));
  };

  const publishCopHandoffContext = (
    target: 'incidents' | 'planning' | 'operations' | 'after-action',
    sourceAction: string,
    locationId?: number,
    regionName?: string,
  ) => {
    const linkedLayerSet = aoiLinkedLayerSetPresetId === 'none'
      ? null
      : layerSetPresets.find((preset) => preset.id === aoiLinkedLayerSetPresetId) ?? null;

    const payload = {
      target,
      sourceAction,
      regionFilter,
      locationFilter,
      geoOverlayLayer,
      geoOverlayStressFilter,
      copMapBaseLayer,
      copLiveOverlayFeedMode,
      aoiLinkedLayerSetPresetId: linkedLayerSet?.id ?? null,
      aoiLinkedLayerSetPresetName: linkedLayerSet?.name ?? null,
      locationId: locationId ?? drilldownLocationId,
      regionName: regionName ?? drilldownRegion,
      generatedUtc: new Date().toISOString(),
    };

    localStorage.setItem('ipoc.cop.commandHandoffContext', JSON.stringify(payload));
  };

  return (
    <Card className="ipoc-mission-cockpit ipoc-cop-cockpit border-light-subtle">
      <Card.Header className="small fw-semibold d-flex align-items-center justify-content-between">
        <span>Common Operating Picture</span>
        <Badge bg="secondary">Production Candidate</Badge>
      </Card.Header>
      <Card.Body>
        <Row className="g-2 align-items-end mb-3">
          <Col md={4}>
            <Form.Label className="small mb-1"><LabelWithInfo text="AOI Region" info="Select the region-level area of interest used to scope COP overlays, counts, and command posture signals." /></Form.Label>
            <Form.Select value={regionFilter} onChange={(event) => {
              setRegionFilter(event.target.value);
              setLocationFilter('All');
            }}>
              {regionOptions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={6}>
            <Form.Label className="small mb-1"><LabelWithInfo text="AOI Location" info="Narrow the area of interest to a specific location for focused COP situational analysis." /></Form.Label>
            <Form.Select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              {locationOptions.map((location) => (
                <option key={location.value} value={location.value}>{location.label}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Scope" info="Displays how many locations are currently included by AOI filters." /></Form.Label>
            <div><Badge bg="secondary">{locationRollups.length} locations</Badge></div>
          </Col>
        </Row>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-1 d-flex align-items-center justify-content-between">
              <span>COP weather overlay context</span>
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none"
                onClick={() => setShowWeatherRiskDayDetails((current) => !current)}
                disabled={weatherRiskDays.length === 0}
              >
                <Badge bg={weatherOperationalSignal.highRiskDayCount > 0 ? 'danger' : weatherOperationalSignal.moderateRiskDayCount > 0 ? 'warning' : 'secondary'}>
                  {weatherOperationalSignal.highRiskDayCount > 0
                    ? `${weatherOperationalSignal.highRiskDayCount} high-risk day(s)`
                    : weatherOperationalSignal.moderateRiskDayCount > 0
                      ? `${weatherOperationalSignal.moderateRiskDayCount} watch day(s)`
                      : 'Stable weather'}
                </Badge>
              </button>
            </div>
            <div className="small text-muted">
              {weatherOperationalSignal.locationLabel} · Source {weatherOperationalSignal.sourceLabel} · Avg {weatherOperationalSignal.averageTempF}°F
            </div>
            {!weatherOperationalSignal.hasData && (
              <div className="small text-muted mt-1">
                Live weather unavailable for current AOI/incident context. Configure resolvable location coordinates to restore overlay weather risk context.
              </div>
            )}
            <div className="small text-muted mt-1">{weatherOperationalSignal.immediateSummary}</div>
            {showWeatherRiskDayDetails && weatherRiskDays.length > 0 && (
              <ListGroup variant="flush" className="mt-2">
                {weatherRiskDays.map((item) => (
                  <ListGroup.Item key={`cop-weather-risk-${item.date}`} className="px-0 py-1 small bg-transparent">
                    <span className="fw-semibold">{new Date(item.date).toLocaleDateString()}</span>
                    <span className="text-muted"> · {item.temperatureF}°F / {item.temperatureC}°C · {item.summary}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">COP AOI preset controls</div>
            <Row className="g-2 align-items-end mb-2">
              <Col md={5}>
                <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Preset name" info="Name the AOI preset so operators can quickly re-apply this region/location context." /></Form.Label>
                <Form.Control
                  size="sm"
                  value={aoiPresetNameInput}
                  placeholder="Save current AOI filters"
                  onChange={(event) => setAoiPresetNameInput(event.target.value)}
                />
              </Col>
              <Col md={5}>
                <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Linked layer set" info="Optionally bind a saved layer set so AOI presets also restore map layer/stress/feed configuration." /></Form.Label>
                <Form.Select
                  size="sm"
                  value={aoiLinkedLayerSetPresetId}
                  onChange={(event) => setAoiLinkedLayerSetPresetId(event.target.value)}
                >
                  <option value="none">No linked layer set</option>
                  {layerSetPresets.map((preset) => (
                    <option key={`aoi-layer-link-${preset.id}`} value={preset.id}>{preset.name}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={2} className="d-flex gap-2 justify-content-md-end">
                <IconActionButton
                  iconClassName="bi bi-save"
                  tooltip="Save current AOI preset"
                  ariaLabel="Save current AOI preset"
                  onClick={() => void saveAoiPreset()}
                  variant="outline-secondary"
                  disabled={aoiPresetNameInput.trim().length === 0}
                />
                <IconActionButton
                  iconClassName="bi bi-x-circle"
                  tooltip="Clear AOI filters"
                  ariaLabel="Clear AOI filters"
                  onClick={() => {
                    setRegionFilter('All');
                    setLocationFilter('All');
                    setDrilldownRegion(null);
                    setDrilldownLocationId(null);
                  }}
                  variant="outline-secondary"
                />
              </Col>
            </Row>
            {aoiPresets.length === 0 ? (
              <div className="small text-muted">No AOI presets saved yet.</div>
            ) : (
              <ListGroup variant="flush">
                {aoiPresets.map((preset) => (
                  <ListGroup.Item key={preset.id} className="px-0 py-1 small d-flex align-items-center justify-content-between">
                    <span>
                      <span className="fw-semibold">{preset.name}</span>
                      <span className="text-muted"> · Region {preset.regionFilter} · Location {preset.locationFilter}{preset.linkedLayerSetPresetName ? ` · Layer ${preset.linkedLayerSetPresetName}` : ''}</span>
                    </span>
                    <span className="d-inline-flex gap-1">
                      <IconActionButton
                        iconClassName="bi bi-check2-circle"
                        tooltip="Apply AOI preset"
                        ariaLabel="Apply AOI preset"
                        onClick={() => applyAoiPreset(preset)}
                        variant="outline-secondary"
                      />
                      <IconActionButton
                        iconClassName="bi bi-trash"
                        tooltip="Delete AOI preset"
                        ariaLabel="Delete AOI preset"
                        onClick={() => {
                          void deleteAoiPreset(preset);
                        }}
                        variant="outline-secondary"
                      />
                    </span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>COP geospatial overlay starter</span>
              <Badge bg="secondary">AOI map-first preview</Badge>
            </div>
            <div className="small text-muted mb-2">
              Interactive location overlay for AOI-constrained facilities. Marker color indicates composite stress posture.
            </div>
            <Row className="g-2 align-items-end mb-2">
              <Col md={8}>
                <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Layer set name" info="Name the current map layer configuration for reuse in COP operations and AOI-linked presets." /></Form.Label>
                <Form.Control
                  size="sm"
                  value={layerSetNameInput}
                  placeholder="Save current layer, stress, basemap, and feed mode"
                  onChange={(event) => setLayerSetNameInput(event.target.value)}
                />
              </Col>
              <Col md={4} className="d-flex justify-content-md-end gap-2">
                <IconActionButton
                  iconClassName="bi bi-save"
                  tooltip="Save current COP layer set"
                  ariaLabel="Save COP layer set"
                  onClick={() => {
                    void saveLayerSetPreset();
                  }}
                  variant="outline-secondary"
                  disabled={layerSetNameInput.trim().length === 0}
                />
              </Col>
            </Row>
            {layerSetPresets.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mb-2">
                {layerSetPresets.map((preset) => (
                  <span key={preset.id} className="d-inline-flex align-items-center gap-1">
                    <Badge bg="secondary">{preset.name}</Badge>
                    <IconActionButton
                      iconClassName="bi bi-check2-circle"
                      tooltip="Apply layer set preset"
                      ariaLabel="Apply layer set preset"
                      onClick={() => applyLayerSetPreset(preset)}
                      variant="outline-secondary"
                      size="sm"
                    />
                    <IconActionButton
                      iconClassName="bi bi-trash"
                      tooltip="Delete layer set preset"
                      ariaLabel="Delete layer set preset"
                      onClick={() => {
                        void deleteLayerSetPreset(preset);
                      }}
                      variant="outline-secondary"
                      size="sm"
                    />
                  </span>
                ))}
              </div>
            )}
            <div className="d-inline-flex flex-wrap gap-2 mb-2">
              <Badge
                bg={geoOverlayLayer === 'composite' ? 'dark' : 'secondary'}
                role="button"
                onClick={() => setGeoOverlayLayer('composite')}
              >
                Composite layer
              </Badge>
              <Badge
                bg={geoOverlayLayer === 'resource' ? 'dark' : 'secondary'}
                role="button"
                onClick={() => setGeoOverlayLayer('resource')}
              >
                Resource pressure
              </Badge>
              <Badge
                bg={geoOverlayLayer === 'bed' ? 'dark' : 'secondary'}
                role="button"
                onClick={() => setGeoOverlayLayer('bed')}
              >
                Bed pressure
              </Badge>
              <Badge
                bg={geoOverlayLayer === 'incident' ? 'dark' : 'secondary'}
                role="button"
                onClick={() => setGeoOverlayLayer('incident')}
              >
                Incident pressure
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-2 mb-2">
              <Badge
                bg={copMapBaseLayer === 'streets' ? 'dark' : 'secondary'}
                role="button"
                onClick={() => setCopMapBaseLayer('streets')}
              >
                {COP_MAP_BASE_LAYER_CONFIG.streets.label}
              </Badge>
              <Badge
                bg={copMapBaseLayer === 'terrain' ? 'dark' : 'secondary'}
                role="button"
                onClick={() => setCopMapBaseLayer('terrain')}
              >
                {COP_MAP_BASE_LAYER_CONFIG.terrain.label}
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-2 mb-2">
              <Badge
                bg={geoOverlayStressFilter === 'all' ? 'dark' : 'secondary'}
                role="button"
                onClick={() => setGeoOverlayStressFilter('all')}
              >
                All stress
              </Badge>
              <Badge
                bg={geoOverlayStressFilter === 'watch' ? 'dark' : 'secondary'}
                role="button"
                onClick={() => setGeoOverlayStressFilter('watch')}
              >
                Watch+
              </Badge>
              <Badge
                bg={geoOverlayStressFilter === 'high' ? 'dark' : 'secondary'}
                role="button"
                onClick={() => setGeoOverlayStressFilter('high')}
              >
                High only
              </Badge>
            </div>
            {COP_LIVE_OVERLAY_FEED_ENABLED && (
              <div className="d-inline-flex flex-wrap gap-2 mb-2">
                <Badge
                  bg={copLiveOverlayFeedMode === 'off' ? 'dark' : 'secondary'}
                  role="button"
                  onClick={() => setCopLiveOverlayFeedMode('off')}
                >
                  Feed off
                </Badge>
                <Badge
                  bg={copLiveOverlayFeedMode === 'simulated' ? 'dark' : 'secondary'}
                  role="button"
                  onClick={() => setCopLiveOverlayFeedMode('simulated')}
                >
                  Simulated feed
                </Badge>
              </div>
            )}
            <div className="position-relative border rounded overflow-hidden" style={{ height: 280 }}>
              <div className="position-absolute top-0 end-0 p-2 d-flex align-items-center gap-1" style={{ zIndex: 500 }}>
                <MapControlStrip
                  mapName="COP map"
                  onZoomIn={() => setCopMapZoomLevel((current) => Math.min(10, current + 1))}
                  onZoomOut={() => setCopMapZoomLevel((current) => Math.max(5, current - 1))}
                  onResetZoom={() => setCopMapZoomLevel(COP_MAP_DEFAULT_ZOOM)}
                  onFitToMarkers={() => setFitCopMapToSignalsNonce((current) => current + 1)}
                  onResetExtent={() => setResetCopMapExtentNonce((current) => current + 1)}
                  onOpenFocus={() => setCopMapFocusMode(true)}
                  fitToMarkersDisabled={copGeoOverlayVisiblePoints.length === 0}
                />
              </div>
              {copGeoOverlayVisiblePoints.length === 0 ? (
                <div className="small text-muted p-3">No AOI locations available for geospatial overlay.</div>
              ) : (
                <MapContainer
                  center={COP_MAP_CENTER}
                  zoom={copMapZoomLevel}
                  style={{ width: '100%', height: '100%' }}
                  zoomControl={false}
                  scrollWheelZoom
                >
                  <TileLayer
                    url={COP_MAP_BASE_LAYER_CONFIG[copMapBaseLayer].url}
                    attribution={COP_MAP_BASE_LAYER_CONFIG[copMapBaseLayer].attribution}
                  />
                  <ZoomControl position="bottomright" />
                  <ScaleControl position="bottomleft" imperial={false} />
                  <CopMapViewportController
                    mapPoints={copGeoOverlayViewportPoints}
                    selectedLocationId={drilldownLocationId}
                    mapZoomLevel={copMapZoomLevel}
                    fitToSignalsNonce={fitCopMapToSignalsNonce}
                    resetMapExtentNonce={resetCopMapExtentNonce}
                  />
                  <CopMapZoomSync onZoomChanged={setCopMapZoomLevel} />
                  <MarkerClusterGroup chunkedLoading>
                    {copGeoOverlayVisiblePoints.map((point) => {
                      const markerClass = point.layerStress >= 75
                        ? 'ipoc-cop-map-marker ipoc-cop-map-marker-high'
                        : point.layerStress >= 55
                          ? 'ipoc-cop-map-marker ipoc-cop-map-marker-watch'
                          : 'ipoc-cop-map-marker ipoc-cop-map-marker-low';

                      const icon = divIcon({
                        className: markerClass,
                        html: '<span></span>',
                        iconSize: [14, 14],
                        iconAnchor: [7, 7],
                      });

                      return (
                        <Marker
                          key={`cop-geo-${point.locationId}`}
                          position={[point.coordinate.lat, point.coordinate.lng]}
                          icon={icon}
                          eventHandlers={{
                            click: () => {
                              setDrilldownRegion(point.regionName);
                              setDrilldownLocationId(point.locationId);
                            },
                          }}
                        >
                          <LeafletTooltip direction="top" offset={[0, -6]}>
                            {point.locationName} · {point.layerStress}%
                          </LeafletTooltip>
                          <Popup>
                            <div className="small">
                              <div className="fw-semibold">{point.locationName}</div>
                              <div className="text-muted mb-1">{point.regionName}</div>
                              <div>Layer stress: <strong>{point.layerStress}%</strong></div>
                              <div>Resource stress: {point.resourceStressPercent}%</div>
                              <div>Bed stress: {point.bedStressPercent}%</div>
                              <div>Incident stress: {point.incidentStressPercent}%</div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MarkerClusterGroup>
                </MapContainer>
              )}
            </div>
            <Modal
              show={copMapFocusMode}
              onHide={() => setCopMapFocusMode(false)}
              centered
              size="xl"
              dialogClassName="ipoc-map-focus-modal"
            >
              <Modal.Header closeButton>
                <Modal.Title className="small fw-semibold">COP Focus Map</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="small text-muted">Expanded geospatial view with full operator controls and AOI overlay markers.</div>
                  <IconActionButton
                    iconClassName="bi bi-arrow-return-left"
                    tooltip="Return to cockpit map panel"
                    ariaLabel="Return to cockpit map panel"
                    onClick={() => setCopMapFocusMode(false)}
                    variant="outline-secondary"
                    size="sm"
                  />
                </div>
                <div className="position-relative rounded border" style={{ minHeight: '70vh' }}>
                  <MapContainer
                    center={COP_MAP_CENTER}
                    zoom={copMapZoomLevel}
                    style={{ minHeight: '70vh', width: '100%' }}
                    zoomControl={false}
                    scrollWheelZoom
                  >
                    <TileLayer
                      url={COP_MAP_BASE_LAYER_CONFIG[copMapBaseLayer].url}
                      attribution={COP_MAP_BASE_LAYER_CONFIG[copMapBaseLayer].attribution}
                    />
                    <ZoomControl position="bottomright" />
                    <ScaleControl position="bottomleft" imperial={false} />
                    <CopMapViewportController
                      mapPoints={copGeoOverlayViewportPoints}
                      selectedLocationId={drilldownLocationId}
                      mapZoomLevel={copMapZoomLevel}
                      fitToSignalsNonce={fitCopMapToSignalsNonce}
                      resetMapExtentNonce={resetCopMapExtentNonce}
                    />
                    <CopMapZoomSync onZoomChanged={setCopMapZoomLevel} />
                    <MarkerClusterGroup chunkedLoading>
                      {copGeoOverlayVisiblePoints.map((point) => {
                        const markerClass = point.layerStress >= 75
                          ? 'ipoc-cop-map-marker ipoc-cop-map-marker-high'
                          : point.layerStress >= 55
                            ? 'ipoc-cop-map-marker ipoc-cop-map-marker-watch'
                            : 'ipoc-cop-map-marker ipoc-cop-map-marker-low';

                        const icon = divIcon({
                          className: markerClass,
                          html: '<span></span>',
                          iconSize: [14, 14],
                          iconAnchor: [7, 7],
                        });

                        return (
                          <Marker
                            key={`cop-focus-geo-${point.locationId}`}
                            position={[point.coordinate.lat, point.coordinate.lng]}
                            icon={icon}
                            eventHandlers={{
                              click: () => {
                                setDrilldownRegion(point.regionName);
                                setDrilldownLocationId(point.locationId);
                              },
                            }}
                          >
                            <LeafletTooltip direction="top" offset={[0, -6]}>
                              {point.locationName} · {point.layerStress}%
                            </LeafletTooltip>
                            <Popup>
                              <div className="small">
                                <div className="fw-semibold">{point.locationName}</div>
                                <div className="text-muted mb-1">{point.regionName}</div>
                                <div>Layer stress: <strong>{point.layerStress}%</strong></div>
                                <div>Resource stress: {point.resourceStressPercent}%</div>
                                <div>Bed stress: {point.bedStressPercent}%</div>
                                <div>Incident stress: {point.incidentStressPercent}%</div>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })}
                    </MarkerClusterGroup>
                  </MapContainer>
                </div>
              </Modal.Body>
            </Modal>
            <div className="small text-muted mt-2 d-inline-flex gap-2">
              <Badge bg="success">Low stress</Badge>
              <Badge bg="warning">Watch</Badge>
              <Badge bg="danger">High stress</Badge>
            </div>
            <div className="small text-muted mt-1">Active overlay: {geoOverlayLayer === 'composite' ? 'Composite stress' : geoOverlayLayer === 'resource' ? 'Resource pressure' : geoOverlayLayer === 'bed' ? 'Bed pressure' : 'Incident pressure'}.</div>
            <div className="small text-muted mt-1">
              AOI overlay summary: avg stress {geoOverlaySummary.averageStress}% · high stress {geoOverlaySummary.highStressCount} · watch {geoOverlaySummary.watchStressCount} · visible markers {copGeoOverlayVisiblePoints.length}/{copGeoOverlayPoints.length}
            </div>
            {COP_LIVE_OVERLAY_FEED_ENABLED && copLiveOverlayFeedMode === 'simulated' && (
              <div className="small text-muted mt-1">
                Live overlay feed: simulated delta adjustments active for {Object.keys(copLiveOverlayFeedPoints).length} locations.
              </div>
            )}
            {COP_LIVE_OVERLAY_FEED_ENABLED && copLiveOverlayFeedMode === 'simulated' && (
              <div className="small text-muted mt-1">
                Feed status: {copLiveOverlayFeedHealth.status} · provider {copLiveOverlayFeedHealth.provider} · fallback {copLiveOverlayFeedHealth.fallbackUsed ? 'yes' : 'no'}
                {copLiveOverlayFeedHealth.generatedUtc ? ` · updated ${new Date(copLiveOverlayFeedHealth.generatedUtc).toLocaleTimeString()}` : ''}
                {copLiveOverlayFeedHealth.lastExternalAttemptUtc ? ` · last external attempt ${new Date(copLiveOverlayFeedHealth.lastExternalAttemptUtc).toLocaleTimeString()}` : ''}
                {copLiveOverlayFeedHealth.lastExternalFailureReason ? ` · last external failure ${copLiveOverlayFeedHealth.lastExternalFailureReason}` : ''}
                {copLiveOverlayFeedHealth.detail ? ` · ${copLiveOverlayFeedHealth.detail}` : ''}
              </div>
            )}
            <div className="mt-2">
              <div className="small fw-semibold mb-1">Overlay hotspot drill actions</div>
              {copGeoHotspots.length === 0 ? (
                <div className="small text-muted">No hotspot drill actions available for current AOI scope.</div>
              ) : (
                <ListGroup variant="flush">
                  {copGeoHotspots.map((point) => (
                    <ListGroup.Item key={`cop-hotspot-${point.locationId}`} className="px-0 py-1 bg-transparent d-flex align-items-center justify-content-between small">
                      <span>
                        <span className="fw-semibold">{point.locationName}</span>
                        <span className="text-muted"> · {point.regionName} · stress {point.layerStress}%</span>
                      </span>
                      <span className="d-inline-flex gap-1">
                        <IconActionButton
                          iconClassName="bi bi-crosshair"
                          tooltip="Focus map and table drill-down on this hotspot"
                          ariaLabel="Focus COP hotspot"
                          onClick={() => {
                            setDrilldownRegion(point.regionName);
                            setDrilldownLocationId(point.locationId);
                            setFitCopMapToSignalsNonce((current) => current + 1);
                          }}
                          variant="outline-secondary"
                        />
                        <IconActionButton
                          iconClassName="bi bi-shield-exclamation"
                          tooltip="Open Incident workspace for hotspot execution follow-up"
                          ariaLabel="Open Incident workspace for hotspot"
                          onClick={() => {
                            setDrilldownRegion(point.regionName);
                            setDrilldownLocationId(point.locationId);
                            publishCopHandoffContext('incidents', 'cop-hotspot-follow-up', point.locationId, point.regionName);
                            onNavigate?.('incidents');
                          }}
                          variant="outline-secondary"
                          disabled={!onNavigate}
                        />
                      </span>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
            <div className="mt-2">
              <div className="small fw-semibold mb-1 d-flex align-items-center justify-content-between">
                <span>Overlay command queue</span>
                <IconActionButton
                  iconClassName="bi bi-arrow-counterclockwise"
                  tooltip="Reset overlay action acknowledgments"
                  ariaLabel="Reset overlay action acknowledgments"
                  onClick={() => setAcknowledgedOverlayLocationIds([])}
                  disabled={acknowledgedOverlayLocationIds.length === 0}
                  variant="outline-secondary"
                  size="sm"
                />
              </div>
              {overlayCommandQueue.length === 0 ? (
                <div className="small text-muted">No overlay command queue actions available for current AOI scope.</div>
              ) : (
                <ListGroup variant="flush">
                  {overlayCommandQueue.map((entry) => (
                    <ListGroup.Item key={`cop-overlay-queue-${entry.locationId}`} className="px-0 py-1 bg-transparent d-flex align-items-center justify-content-between small gap-2">
                      <div>
                        <div className="fw-semibold">{entry.locationName} <Badge bg={entry.priority === 'Immediate' ? 'danger' : entry.priority === 'Priority' ? 'warning' : 'secondary'}>{entry.priority}</Badge></div>
                        <div className="text-muted">{entry.action}</div>
                      </div>
                      <span className="d-inline-flex gap-1">
                        <IconActionButton
                          iconClassName="bi bi-diagram-2"
                          tooltip="Open Planning workspace for queued overlay action"
                          ariaLabel="Open Planning workspace for queued overlay action"
                          onClick={() => {
                            setDrilldownRegion(entry.regionName);
                            setDrilldownLocationId(entry.locationId);
                            publishCopHandoffContext('planning', 'cop-overlay-queue-planning', entry.locationId, entry.regionName);
                            onNavigate?.('planning');
                          }}
                          variant="outline-secondary"
                          disabled={!onNavigate}
                        />
                        <IconActionButton
                          iconClassName="bi bi-list-task"
                          tooltip="Open Operations workspace for queued overlay action"
                          ariaLabel="Open Operations workspace for queued overlay action"
                          onClick={() => {
                            setDrilldownRegion(entry.regionName);
                            setDrilldownLocationId(entry.locationId);
                            publishCopHandoffContext('operations', 'cop-overlay-queue-operations', entry.locationId, entry.regionName);
                            onNavigate?.('operations');
                          }}
                          variant="outline-secondary"
                          disabled={!onNavigate}
                        />
                        <IconActionButton
                          iconClassName="bi bi-check2-square"
                          tooltip="Acknowledge queued action"
                          ariaLabel="Acknowledge queued action"
                          onClick={() => {
                            setAcknowledgedOverlayLocationIds((current) => current.includes(entry.locationId)
                              ? current
                              : [...current, entry.locationId]);
                            onNotify(`Overlay action acknowledged for ${entry.locationName}.`, 'info');
                          }}
                          variant="outline-secondary"
                        />
                      </span>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
            <div className="d-inline-flex flex-wrap gap-2 mt-2">
              <IconActionButton
                iconClassName="bi bi-shield-exclamation"
                tooltip="Open Incident workspace for high-stress execution follow-up"
                ariaLabel="Open Incident workspace from COP overlay"
                onClick={() => {
                  publishCopHandoffContext('incidents', 'cop-overlay-risk-board');
                  onNavigate?.('incidents');
                }}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
              <IconActionButton
                iconClassName="bi bi-diagram-2"
                tooltip="Open Planning workspace for layer-driven planning actions"
                ariaLabel="Open Planning workspace from COP overlay"
                onClick={() => {
                  publishCopHandoffContext('planning', 'cop-overlay-risk-board');
                  onNavigate?.('planning');
                }}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
              <IconActionButton
                iconClassName="bi bi-list-task"
                tooltip="Open Operations workspace for overlay action execution"
                ariaLabel="Open Operations workspace from COP overlay"
                onClick={() => {
                  publishCopHandoffContext('operations', 'cop-overlay-risk-board');
                  onNavigate?.('operations');
                }}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
              <IconActionButton
                iconClassName="bi bi-journal-check"
                tooltip="Open After Action workspace for overlay risk corrective capture"
                ariaLabel="Open After Action workspace from COP overlay"
                onClick={() => {
                  publishCopHandoffContext('after-action', 'cop-overlay-risk-board');
                  onNavigate?.('after-action');
                }}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>Unified command risk board</span>
              <span className="d-inline-flex gap-1">
                <Badge bg={operationalInsight?.maturityLevel === 'Type1' ? 'success' : operationalInsight?.maturityLevel === 'Type2' ? 'info' : operationalInsight?.maturityLevel === 'Type3' ? 'secondary' : operationalInsight?.maturityLevel === 'Type4' ? 'warning' : operationalInsight?.maturityLevel === 'Type5' ? 'danger' : 'secondary'}>
                  Maturity {operationalInsight?.maturityLevel ?? 'unknown'}{operationalInsight?.maturityScore !== undefined && operationalInsight?.maturityScore !== null ? ` (${operationalInsight.maturityScore})` : ''}
                </Badge>
                <Badge bg={operationalInsight?.nimsComplianceLevel === 'compliant' ? 'success' : operationalInsight?.nimsComplianceLevel === 'watch' ? 'warning' : operationalInsight?.nimsComplianceLevel === 'at-risk' ? 'danger' : 'secondary'}>
                  NIMS {operationalInsight?.nimsComplianceLevel ?? 'unknown'}{operationalInsight?.nimsComplianceScore !== undefined && operationalInsight?.nimsComplianceScore !== null ? ` (${operationalInsight.nimsComplianceScore})` : ''}
                </Badge>
                <Badge bg={operationalInsight?.missionDependencyStatus === 'stable' ? 'success' : operationalInsight?.missionDependencyStatus === 'watch' ? 'warning' : operationalInsight?.missionDependencyStatus === 'critical' ? 'danger' : 'secondary'}>
                  Dependency {operationalInsight?.missionDependencyStatus ?? 'unknown'}
                </Badge>
              </span>
            </div>
            <ListGroup variant="flush" className="mb-2">
              {commandRiskActions.map((action) => (
                <ListGroup.Item key={action} className="px-0 py-1 small bg-transparent">
                  {action}
                </ListGroup.Item>
              ))}
            </ListGroup>
            <div className="d-inline-flex flex-wrap gap-2">
              <IconActionButton
                iconClassName="bi bi-diagram-2"
                tooltip="Open Planning workspace for NIMS and period-cycle follow-up"
                ariaLabel="Open Planning workspace"
                onClick={() => {
                  publishCopHandoffContext('planning', 'cop-unified-command-risk-board');
                  onNavigate?.('planning');
                }}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
              <IconActionButton
                iconClassName="bi bi-shield-exclamation"
                tooltip="Open Incident workspace for command/dependency execution"
                ariaLabel="Open Incident workspace"
                onClick={() => {
                  publishCopHandoffContext('incidents', 'cop-unified-command-risk-board');
                  onNavigate?.('incidents');
                }}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
              <IconActionButton
                iconClassName="bi bi-list-task"
                tooltip="Open Operations workspace for command task execution"
                ariaLabel="Open Operations workspace"
                onClick={() => {
                  publishCopHandoffContext('operations', 'cop-unified-command-risk-board');
                  onNavigate?.('operations');
                }}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
              <IconActionButton
                iconClassName="bi bi-journal-check"
                tooltip="Open After Action workspace for lessons and corrective tracking"
                ariaLabel="Open After Action workspace"
                onClick={() => {
                  publishCopHandoffContext('after-action', 'cop-unified-command-risk-board');
                  onNavigate?.('after-action');
                }}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>AI Incident Co-Pilot</span>
              <Badge bg={aiCopilotApprovalStatus === 'approved' ? 'success' : aiCopilotApprovalStatus === 'rejected' ? 'danger' : aiCopilotApprovalStatus === 'pending-review' ? 'warning' : 'secondary'}>
                {aiCopilotApprovalStatus === 'not-started' ? 'Not started' : aiCopilotApprovalStatus === 'pending-review' ? 'Pending review' : aiCopilotApprovalStatus === 'approved' ? 'Approved' : 'Rejected'}
              </Badge>
            </div>
            <div className="small text-muted mb-2">
              Doctrine-aware AI co-pilot draft flow with explicit human approval for COP summaries and ICS product generation.
            </div>
            <Form.Control
              size="sm"
              type="text"
              value={aiCopilotPrompt}
              placeholder="Describe the AI COP request"
              aria-label="AI Incident Co-Pilot prompt"
              onChange={(event) => setAiCopilotPrompt(event.target.value)}
            />
            <Form.Control
              size="sm"
              as="textarea"
              rows={7}
              className="mt-2"
              value={aiCopilotOutput}
              readOnly
              aria-label="AI Incident Co-Pilot output"
              placeholder="Generate AI COP draft to review and approve."
            />
            <div className="row g-2 mt-1">
              <div className="col-md-6">
                <Form.Control
                  size="sm"
                  type="text"
                  value={aiCopilotApprover}
                  placeholder="Approver name"
                  aria-label="AI Incident Co-Pilot approver"
                  onChange={(event) => setAiCopilotApprover(event.target.value)}
                />
              </div>
              <div className="col-md-6 small text-muted d-flex align-items-center justify-content-md-end">
                {aiCopilotGeneratedAt
                  ? `Generated ${new Date(aiCopilotGeneratedAt).toLocaleString()}`
                  : 'No AI draft generated'}
              </div>
            </div>
            <div className="d-inline-flex flex-wrap gap-2 mt-2">
              <IconActionButton
                iconClassName="bi bi-lightning-charge"
                tooltip="Generate next operational period objectives"
                ariaLabel="Generate next operational period objectives"
                onClick={() => runCopilotQuickPrompt('Generate the next operational period objectives.')}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-moon-stars"
                tooltip="Summarize overnight changes"
                ariaLabel="Summarize overnight changes"
                onClick={() => runCopilotQuickPrompt('Summarize overnight changes.')}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-boxes"
                tooltip="Recommend resource ordering based on incident complexity"
                ariaLabel="Recommend resource ordering based on incident complexity"
                onClick={() => runCopilotQuickPrompt('Recommend resource ordering based on incident complexity.')}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-stars"
                tooltip="Generate AI Incident Co-Pilot draft"
                ariaLabel="Generate AI Incident Co-Pilot draft"
                onClick={() => generateAiCopilotOutput(aiCopilotPrompt.trim().length > 0 ? aiCopilotPrompt : 'Summarize overnight changes and recommend operational priorities.')}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-file-earmark-text"
                tooltip="Draft ICS-202 from current operations"
                ariaLabel="Draft ICS-202 from current operations"
                onClick={() => generateIcsDraft('ICS-202')}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-diagram-3"
                tooltip="Draft ICS-203 from current operations"
                ariaLabel="Draft ICS-203 from current operations"
                onClick={() => generateIcsDraft('ICS-203')}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-people"
                tooltip="Draft ICS-204 from current operations"
                ariaLabel="Draft ICS-204 from current operations"
                onClick={() => generateIcsDraft('ICS-204')}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-check2-circle"
                tooltip="Approve AI Incident Co-Pilot draft"
                ariaLabel="Approve AI Incident Co-Pilot draft"
                onClick={approveAiCopilotOutput}
                variant="outline-secondary"
                disabled={aiCopilotApprovalStatus !== 'pending-review' || aiCopilotOutput.trim().length === 0}
              />
              <IconActionButton
                iconClassName="bi bi-x-circle"
                tooltip="Reject AI Incident Co-Pilot draft"
                ariaLabel="Reject AI Incident Co-Pilot draft"
                onClick={rejectAiCopilotOutput}
                variant="outline-secondary"
                disabled={aiCopilotApprovalStatus !== 'pending-review' || aiCopilotOutput.trim().length === 0}
              />
            </div>
            {aiCopilotApprovalAt && (
              <div className="small text-muted mt-2">
                Decision {aiCopilotApprovalStatus} by {aiCopilotApprover.trim().length > 0 ? aiCopilotApprover : 'COP operator'} at {new Date(aiCopilotApprovalAt).toLocaleString()}
              </div>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">Predictive impact analytics</div>
            <div className="small text-muted mb-2">
              Forecast view for public health and emergency management risks using current COP pressure and capacity posture.
            </div>
            <div className="small">
              {predictiveSignals.map((signal, index) => (
                <div key={signal.id} className="mb-2">
                  <div className="d-flex justify-content-between small text-muted">
                    <span>{signal.label}</span>
                    <strong>{signal.value}%</strong>
                  </div>
                  <div className="analytics-track">
                    <div className={`analytics-bar analytics-bar-${index % 4}`} style={{ width: `${signal.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>

        <Row className="g-2 mb-3">
          <Col md={4}>
            <Card className="ipoc-mission-kpi-card h-100">
              <Card.Body className="py-2">
                <div className="small text-muted">Resource readiness</div>
                <div className="fw-semibold fs-5">{resourceReadinessPercent}%</div>
                <ProgressBar now={resourceReadinessPercent} variant={resourceReadinessPercent >= 65 ? 'success' : resourceReadinessPercent >= 40 ? 'warning' : 'danger'} className="mt-1" />
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="ipoc-mission-kpi-card h-100">
              <Card.Body className="py-2">
                <div className="small text-muted">Bed capacity headroom</div>
                <div className="fw-semibold fs-5">{bedCapacityPercent}%</div>
                <ProgressBar now={bedCapacityPercent} variant={bedCapacityPercent >= 45 ? 'success' : bedCapacityPercent >= 25 ? 'warning' : 'danger'} className="mt-1" />
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="ipoc-mission-kpi-card h-100">
              <Card.Body className="py-2">
                <div className="small text-muted">Incident pressure</div>
                <div className="fw-semibold fs-5">{incidentPressurePercent}%</div>
                <ProgressBar now={incidentPressurePercent} variant={incidentPressurePercent < 35 ? 'success' : incidentPressurePercent < 60 ? 'warning' : 'danger'} className="mt-1" />
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-2 mb-3">
          <Col lg={8}>
            <Card className="ipoc-mission-analytics-card h-100">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2">COP regional pressure profile</div>
                {regionalPressureChartData.length === 0 ? (
                  <div className="small text-muted">No regional pressure data available for selected scope.</div>
                ) : (
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={regionalPressureChartData}
                        onClick={(state) => handleRegionalPressureDrilldown((state as { activePayload?: Array<{ payload?: { region?: string } }> } | undefined)?.activePayload?.[0]?.payload?.region)}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="region" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="critical" stackId="pressure" fill="var(--ipoc-chart-critical)" name="Critical" />
                        <Bar dataKey="high" stackId="pressure" fill="var(--ipoc-chart-warning)" name="High" />
                        <Bar dataKey="active" stackId="pressure" fill="var(--ipoc-chart-series-1)" name="Active" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
          <Col lg={4}>
            <Card className="ipoc-mission-analytics-card h-100">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2">COP bed utilization mix</div>
                {copBedMixChartData.length === 0 ? (
                  <div className="small text-muted">No bed occupancy data available for selected scope.</div>
                ) : (
                  <div className="small">
                    {copBedMixChartData.map((entry, index) => {
                      const totalBeds = copBedMixChartData.reduce((sum, item) => sum + item.value, 0);
                      const widthPercent = totalBeds > 0 ? Math.round((entry.value / totalBeds) * 100) : 0;

                      return (
                        <div key={entry.name} className="mb-2">
                          <div className="d-flex justify-content-between small text-muted">
                            <span>{entry.name}</span>
                            <strong>{entry.value}</strong>
                          </div>
                          <div className="analytics-track">
                            <div className={`analytics-bar analytics-bar-${index % 4}`} style={{ width: `${widthPercent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-2 mb-3">
          <Col lg={7}>
            <Card className="ipoc-mission-analytics-card h-100">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2">COP location capacity index (top 8)</div>
                {locationCapacityChartData.length === 0 ? (
                  <div className="small text-muted">No location capacity data available for selected scope.</div>
                ) : (
                  <div style={{ width: '100%', height: 230 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={locationCapacityChartData}
                        layout="vertical"
                        margin={{ left: 12, right: 12 }}
                        onClick={(state) => handleLocationCapacityDrilldown((state as { activePayload?: Array<{ payload?: { location?: string } }> } | undefined)?.activePayload?.[0]?.payload?.location)}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" width={130} dataKey="location" />
                        <Tooltip />
                        <Bar dataKey="resourcesAvailable" fill="var(--ipoc-chart-series-1)" name="Resources available" />
                        <Bar dataKey="bedsAvailable" fill="var(--ipoc-chart-success)" name="Beds available" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
          <Col lg={5}>
            <Card className="ipoc-mission-analytics-card h-100">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2">COP constrained locations</div>
                {constrainedLocations.length === 0 ? (
                  <div className="small text-muted">No constrained locations available for selected scope.</div>
                ) : (
                  <div className="small">
                    {constrainedLocations.map((location) => (
                      <div
                        key={location.locationId}
                        className="d-flex align-items-center justify-content-between py-1 border-bottom"
                        role="button"
                        onClick={() => {
                          setDrilldownRegion(location.regionName);
                          setDrilldownLocationId(location.locationId);
                        }}
                      >
                        <div>
                          <div className="fw-semibold">{location.locationName}</div>
                          <div className="text-muted">{location.regionName}</div>
                        </div>
                        <Badge bg={location.compositeStress >= 75 ? 'danger' : location.compositeStress >= 55 ? 'warning' : 'secondary'}>
                          Stress {location.compositeStress}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-2 mb-3">
          <Col md={4}>
            <div className="small text-muted">Incidents: Total {incidentPosture.total}; Active {incidentPosture.active}; Closed {incidentPosture.closed}; Critical {incidentPosture.criticalSeverity}; High {incidentPosture.highSeverity}</div>
          </Col>
          <Col md={4}>
            <div className="small text-muted">Resources: Total {resourcePosture.totalQuantity}; Available {resourcePosture.availableQuantity}; Committed {resourcePosture.committedQuantity}; Out-of-Service {resourcePosture.outOfServiceQuantity}</div>
          </Col>
          <Col md={4}>
            <div className="small text-muted">Beds: Staffed {bedPosture.staffedBedsTotal}; Available {bedPosture.bedsAvailable}; Occupied {bedPosture.bedsOccupied}; Unavailable {bedPosture.bedsUnavailable}; Surge {bedPosture.surgeBedsPotential}</div>
          </Col>
        </Row>

        {(drilldownRegion || drilldownLocationId !== null) && (
          <div className="small text-muted mb-2 d-flex align-items-center justify-content-between">
            <span>
              COP drill-down active:
              {drilldownRegion ? ` Region ${drilldownRegion}` : ''}
              {drilldownLocationId !== null ? ` · Location ${tableDrilldownRows[0]?.locationName ?? drilldownLocationId}` : ''}
            </span>
            <Badge bg="secondary" role="button" onClick={() => {
              setDrilldownRegion(null);
              setDrilldownLocationId(null);
            }}>
              Clear drill-down
            </Badge>
          </div>
        )}

        {tableDrilldownRows.length === 0 ? (
          <div className="small text-muted">No locations in the selected AOI scope.</div>
        ) : (
          <IpocDataGrid
            gridId="cop-location-rollups"
            rowData={tableGridRows}
            columnDefs={tableGridColumnDefs}
            emptyMessage="No locations in the selected AOI scope."
            pageSize={25}
          />
        )}
      </Card.Body>
    </Card>
  );
}

export default CommonOperatingPictureCard;

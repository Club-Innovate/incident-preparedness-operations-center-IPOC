import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Col, Form, ListGroup, Modal, ProgressBar, Row } from 'react-bootstrap';
import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MapContainer, Marker, Popup, ScaleControl, TileLayer, Tooltip as LeafletTooltip, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { divIcon } from 'leaflet';
import type { BedAvailabilityItem, LocationLookupValue, ResourceInventoryItem, WeatherOperationalSignal } from '../../types';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import MapControlStrip from '../common/MapControlStrip';
import { getUserReportPresets, upsertUserReportPreset } from '../../api';
import { canManageLogisticsModuleActions } from '../../security/authorization';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

type LogisticsCoordinationCardProps = {
  isAuthenticated: boolean;
  authRoles: string[];
  authScopes: string[];
  resourceInventory: ResourceInventoryItem[];
  bedAvailability: BedAvailabilityItem[];
  locationLookups: LocationLookupValue[];
  weatherOperationalSignal: WeatherOperationalSignal;
};

type LogisticsChartPoint = {
  locationId: number;
  location: string;
  inventoryGap: number;
  shortageGap: number;
  riskScore: number;
};

type LogisticsSeriesKey = 'inventoryGap' | 'shortageGap' | 'riskScore';

type ContinuityTimelinePoint = {
  tick: string;
  liveInventoryCount: number;
  liveBedCount: number;
  constrainedCount: number;
  shortageCount: number;
  overlayActive: number;
};

type CommandRadarPoint = {
  metric: string;
  value: number;
};

type MapPinSortMode = 'risk' | 'inventory' | 'shortage' | 'name';

type MapPinSortDirection = 'desc' | 'asc';

type MapGeoCoordinate = {
  lat: number;
  lng: number;
};

type MapSignalPoint = {
  locationId: number;
  locationName: string;
  riskScore: number;
  inventoryGap: number;
  shortageGap: number;
  coordinate: MapGeoCoordinate;
};

type MapBaseLayerMode = 'streets' | 'terrain' | 'satellite';

const MAP_GEO_PRESETS: Record<number, MapGeoCoordinate> = {
  8101: { lat: 37.6872, lng: -97.3301 },
  8102: { lat: 39.0473, lng: -95.6752 },
  8103: { lat: 37.7528, lng: -100.0171 },
  8104: { lat: 38.4673, lng: -98.5362 },
};

const KANSAS_MAP_CENTER: [number, number] = [38.5, -98.0];
const KANSAS_DEFAULT_ZOOM = 6;

const MAP_BASE_LAYER_CONFIG: Record<MapBaseLayerMode, { url: string; attribution: string; label: string }> = {
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
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    label: 'Satellite-like',
  },
};

function LogisticsMapViewportController({
  mapPoints,
  selectedPoint,
  mapZoomLevel,
  fitToSignalsNonce,
  fitToKansasNonce,
}: {
  mapPoints: MapSignalPoint[];
  selectedPoint: MapSignalPoint | null;
  mapZoomLevel: number;
  fitToSignalsNonce: number;
  fitToKansasNonce: number;
}) {
  const map = useMap();

  const fitToSignalPoints = () => {
    if (mapPoints.length === 0) {
      map.setView(KANSAS_MAP_CENTER, KANSAS_DEFAULT_ZOOM);
      return;
    }

    const bounds: [[number, number], [number, number]] = [
      [Math.min(...mapPoints.map((point) => point.coordinate.lat)), Math.min(...mapPoints.map((point) => point.coordinate.lng))],
      [Math.max(...mapPoints.map((point) => point.coordinate.lat)), Math.max(...mapPoints.map((point) => point.coordinate.lng))],
    ];

    map.fitBounds(bounds, {
      padding: [22, 22],
      maxZoom: 9,
      animate: true,
      duration: 0.6,
    });
  };

  useEffect(() => {
    fitToSignalPoints();
  }, [map, mapPoints]);

  useEffect(() => {
    fitToSignalPoints();
  }, [fitToSignalsNonce, map, mapPoints]);

  useEffect(() => {
    map.setView(KANSAS_MAP_CENTER, KANSAS_DEFAULT_ZOOM, { animate: true, duration: 0.55 });
  }, [fitToKansasNonce, map]);

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
    if (!selectedPoint) {
      return;
    }

    map.flyTo([selectedPoint.coordinate.lat, selectedPoint.coordinate.lng], Math.max(map.getZoom(), mapZoomLevel), {
      animate: true,
      duration: 0.45,
    });
  }, [map, mapZoomLevel, selectedPoint]);

  return null;
}

function LogisticsMapZoomSync({
  onZoomChanged,
}: {
  onZoomChanged: (zoom: number) => void;
}) {
  const [lastZoom, setLastZoom] = useState<number | null>(null);

  const map = useMapEvents({
    zoomend: () => {
      const nextZoom = map.getZoom();
      if (lastZoom === nextZoom) {
        return;
      }

      setLastZoom(nextZoom);
      onZoomChanged(nextZoom);
    },
  });

  return null;
}

const NAV_LOGISTICS_SCOPE = 'navigation-logistics';
const NAV_LOGISTICS_PRESET = 'default';
const INVENTORY_WATCH_KEY = 'ipoc.nav.logistics.stagingWatchIds';
const SHORTAGE_ESCALATION_KEY = 'ipoc.nav.logistics.shortageEscalationIds';

type LocationOperationsSignal = {
  locationId: number;
  locationName: string;
  inventoryGap: number;
  shortageGap: number;
  constrainedLaneCount: number;
  shortageLaneCount: number;
  riskScore: number;
};

type InventoryConstraintSignal = {
  key: number;
  locationId: number;
  locationName: string;
  resourceTypeName: string;
  gap: number;
  pressurePercent: number;
};

type FacilityShortageSignal = {
  key: number;
  locationId: number;
  locationName: string;
  bedCategoryCode: string;
  shortage: number;
  availabilityPercent: number;
};

type InventoryBaselineSignal = {
  key: number;
  locationId: number;
  locationName: string;
  resourceTypeName: string;
  available: number;
  committed: number;
  outOfService: number;
  pressurePercent: number;
};

type BedBaselineSignal = {
  key: number;
  locationId: number;
  locationName: string;
  bedCategoryCode: string;
  staffed: number;
  available: number;
  occupancyPercent: number;
};

const SYNTHETIC_LOGISTICS_INVENTORY: ResourceInventoryItem[] = [
  {
    locationResourceInventoryId: -900001,
    locationId: 8101,
    locationName: 'Synthetic Wichita General',
    resourceTypeCode: 'VENTILATOR',
    resourceTypeName: 'Ventilator',
    quantityTotal: 35,
    quantityAvailable: 6,
    quantityCommitted: 24,
    quantityOutOfService: 5,
    lastReportedUtc: new Date().toISOString(),
  },
  {
    locationResourceInventoryId: -900002,
    locationId: 8101,
    locationName: 'Synthetic Wichita General',
    resourceTypeCode: 'PPE_KIT',
    resourceTypeName: 'PPE Kit',
    quantityTotal: 1200,
    quantityAvailable: 320,
    quantityCommitted: 800,
    quantityOutOfService: 80,
    lastReportedUtc: new Date().toISOString(),
  },
  {
    locationResourceInventoryId: -900003,
    locationId: 8102,
    locationName: 'Synthetic Topeka Regional',
    resourceTypeCode: 'RN_STAFF',
    resourceTypeName: 'Registered Nurse Staff',
    quantityTotal: 160,
    quantityAvailable: 41,
    quantityCommitted: 98,
    quantityOutOfService: 21,
    lastReportedUtc: new Date().toISOString(),
  },
  {
    locationResourceInventoryId: -900004,
    locationId: 8103,
    locationName: 'Synthetic Dodge City Medical Center',
    resourceTypeCode: 'VENTILATOR',
    resourceTypeName: 'Ventilator',
    quantityTotal: 18,
    quantityAvailable: 3,
    quantityCommitted: 12,
    quantityOutOfService: 3,
    lastReportedUtc: new Date().toISOString(),
  },
  {
    locationResourceInventoryId: -900005,
    locationId: 8104,
    locationName: 'Synthetic Region 4 Staging Warehouse',
    resourceTypeCode: 'AMBULANCE_TEAM',
    resourceTypeName: 'Ambulance Team',
    quantityTotal: 14,
    quantityAvailable: 4,
    quantityCommitted: 8,
    quantityOutOfService: 2,
    lastReportedUtc: new Date().toISOString(),
  },
];

const SYNTHETIC_LOGISTICS_BEDS: BedAvailabilityItem[] = [
  {
    bedAvailabilitySnapshotId: -910001,
    locationId: 8101,
    locationName: 'Synthetic Wichita General',
    bedCategoryCode: 'ICU',
    staffedBedsTotal: 92,
    bedsAvailable: 8,
    bedsOccupied: 76,
    bedsUnavailable: 8,
    isolationCapableBeds: 14,
    surgeBedsPotential: 12,
    reportedUtc: new Date().toISOString(),
  },
  {
    bedAvailabilitySnapshotId: -910002,
    locationId: 8101,
    locationName: 'Synthetic Wichita General',
    bedCategoryCode: 'MedSurg',
    staffedBedsTotal: 210,
    bedsAvailable: 28,
    bedsOccupied: 160,
    bedsUnavailable: 22,
    isolationCapableBeds: 35,
    surgeBedsPotential: 24,
    reportedUtc: new Date().toISOString(),
  },
  {
    bedAvailabilitySnapshotId: -910003,
    locationId: 8102,
    locationName: 'Synthetic Topeka Regional',
    bedCategoryCode: 'ICU',
    staffedBedsTotal: 58,
    bedsAvailable: 5,
    bedsOccupied: 48,
    bedsUnavailable: 5,
    isolationCapableBeds: 8,
    surgeBedsPotential: 7,
    reportedUtc: new Date().toISOString(),
  },
  {
    bedAvailabilitySnapshotId: -910004,
    locationId: 8103,
    locationName: 'Synthetic Dodge City Medical Center',
    bedCategoryCode: 'ICU',
    staffedBedsTotal: 40,
    bedsAvailable: 3,
    bedsOccupied: 33,
    bedsUnavailable: 4,
    isolationCapableBeds: 6,
    surgeBedsPotential: 5,
    reportedUtc: new Date().toISOString(),
  },
];

function LogisticsCoordinationCard({ isAuthenticated, authRoles, authScopes, resourceInventory, bedAvailability, locationLookups, weatherOperationalSignal }: LogisticsCoordinationCardProps) {
  const [stagingWatchIds, setStagingWatchIds] = useState<number[]>([]);
  const [shortageEscalationIds, setShortageEscalationIds] = useState<number[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState('All');
  const [bedCategoryFilter, setBedCategoryFilter] = useState('All');
  const [inventorySortMode, setInventorySortMode] = useState<'gap' | 'pressure'>('gap');
  const [facilitySortMode, setFacilitySortMode] = useState<'shortage' | 'availability'>('shortage');
  const [watchOnlyMode, setWatchOnlyMode] = useState(false);
  const [escalationOnlyMode, setEscalationOnlyMode] = useState(false);
  const [hiddenChartSeries, setHiddenChartSeries] = useState<LogisticsSeriesKey[]>([]);
  const [mapLayerMode, setMapLayerMode] = useState<'risk' | 'inventory' | 'shortage'>('risk');
  const [mapBaseLayerMode, setMapBaseLayerMode] = useState<MapBaseLayerMode>('streets');
  const [clusterPins, setClusterPins] = useState(true);
  const [fitToSignalsNonce, setFitToSignalsNonce] = useState(0);
  const [fitToKansasNonce, setFitToKansasNonce] = useState(0);
  const [mapPinSortMode, setMapPinSortMode] = useState<MapPinSortMode>('risk');
  const [mapPinSortDirection, setMapPinSortDirection] = useState<MapPinSortDirection>('desc');
  const [mapZoomLevel, setMapZoomLevel] = useState(KANSAS_DEFAULT_ZOOM);
  const [mapFocusMode, setMapFocusMode] = useState(false);
  const [showWeatherRiskDayDetails, setShowWeatherRiskDayDetails] = useState(false);
  const [riskThreshold, setRiskThreshold] = useState(0);
  const [locationChartDepth, setLocationChartDepth] = useState<'8' | '12' | '16'>('8');
  const [mapMarkerLimit, setMapMarkerLimit] = useState<'8' | '16' | '24'>('16');
  const [continuityTimeline, setContinuityTimeline] = useState<ContinuityTimelinePoint[]>([]);
  const [autoTrackHighestRisk, setAutoTrackHighestRisk] = useState(false);

  const MIN_LIVE_INVENTORY_RECORDS = 4;
  const MIN_LIVE_BED_RECORDS = 3;
  const liveInventoryRecordCount = resourceInventory.length;
  const liveBedRecordCount = bedAvailability.length;

  const liveConstrainedInventoryCount = resourceInventory.filter((item) => (
    item.quantityAvailable <= item.quantityCommitted || item.quantityAvailable <= item.quantityOutOfService
  )).length;

  const liveFacilityShortageCount = bedAvailability.filter((item) => {
    const staffed = item.staffedBedsTotal ?? 0;
    const available = item.bedsAvailable ?? 0;
    return staffed > 0 && available <= Math.max(1, Math.floor(staffed * 0.1));
  }).length;

  const useSyntheticSignalOverlay = (
    (liveConstrainedInventoryCount === 0 && liveFacilityShortageCount === 0)
    || liveInventoryRecordCount < MIN_LIVE_INVENTORY_RECORDS
    || liveBedRecordCount < MIN_LIVE_BED_RECORDS
  );

  const liveFeedHealthVariant = (liveInventoryRecordCount >= MIN_LIVE_INVENTORY_RECORDS && liveBedRecordCount >= MIN_LIVE_BED_RECORDS)
    ? 'success'
    : 'warning';

  const latestLiveResourceUtc = useMemo(() => {
    const values = resourceInventory
      .map((item) => item.lastReportedUtc)
      .filter((item): item is string => typeof item === 'string');

    if (values.length === 0) {
      return null;
    }

    return values.reduce((latest, current) => (new Date(current).getTime() > new Date(latest).getTime() ? current : latest));
  }, [resourceInventory]);

  const latestLiveBedUtc = useMemo(() => {
    const values = bedAvailability
      .map((item) => item.reportedUtc)
      .filter((item): item is string => typeof item === 'string');

    if (values.length === 0) {
      return null;
    }

    return values.reduce((latest, current) => (new Date(current).getTime() > new Date(latest).getTime() ? current : latest));
  }, [bedAvailability]);

  const latestLiveUpdateUtc = useMemo(() => {
    if (!latestLiveResourceUtc && !latestLiveBedUtc) {
      return null;
    }

    if (!latestLiveResourceUtc) {
      return latestLiveBedUtc;
    }

    if (!latestLiveBedUtc) {
      return latestLiveResourceUtc;
    }

    return new Date(latestLiveResourceUtc).getTime() > new Date(latestLiveBedUtc).getTime()
      ? latestLiveResourceUtc
      : latestLiveBedUtc;
  }, [latestLiveBedUtc, latestLiveResourceUtc]);

  const effectiveResourceInventory = useMemo(() => (
    useSyntheticSignalOverlay
      ? [...resourceInventory, ...SYNTHETIC_LOGISTICS_INVENTORY]
      : resourceInventory
  ), [resourceInventory, useSyntheticSignalOverlay]);

  const effectiveBedAvailability = useMemo(() => (
    useSyntheticSignalOverlay
      ? [...bedAvailability, ...SYNTHETIC_LOGISTICS_BEDS]
      : bedAvailability
  ), [bedAvailability, useSyntheticSignalOverlay]);

  useEffect(() => {
    const persistedWatch = localStorage.getItem(INVENTORY_WATCH_KEY);
    const persistedEscalation = localStorage.getItem(SHORTAGE_ESCALATION_KEY);

    if (persistedWatch) {
      try {
        const parsed = JSON.parse(persistedWatch) as unknown;
        if (Array.isArray(parsed)) {
          setStagingWatchIds(parsed.filter((item): item is number => Number.isFinite(item)));
        }
      } catch {
        // ignore invalid persisted state
      }
    }

    if (persistedEscalation) {
      try {
        const parsed = JSON.parse(persistedEscalation) as unknown;
        if (Array.isArray(parsed)) {
          setShortageEscalationIds(parsed.filter((item): item is number => Number.isFinite(item)));
        }
      } catch {
        // ignore invalid persisted state
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadServerState = async () => {
      try {
        const presets = await getUserReportPresets(NAV_LOGISTICS_SCOPE);
        const preset = presets.find((item) => item.presetName === NAV_LOGISTICS_PRESET) ?? presets[0] ?? null;
        if (!preset || !preset.presetJson || cancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          stagingWatchIds?: number[];
          shortageEscalationIds?: number[];
        };

        if (Array.isArray(parsed.stagingWatchIds)) {
          setStagingWatchIds(parsed.stagingWatchIds.filter((item): item is number => Number.isFinite(item)));
        }

        if (Array.isArray(parsed.shortageEscalationIds)) {
          setShortageEscalationIds(parsed.shortageEscalationIds.filter((item): item is number => Number.isFinite(item)));
        }
      } catch {
        // fallback remains local storage
      }
    };

    void loadServerState();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void upsertUserReportPreset(NAV_LOGISTICS_SCOPE, {
        presetName: NAV_LOGISTICS_PRESET,
        presetJson: JSON.stringify({
          stagingWatchIds,
          shortageEscalationIds,
        }),
      }).catch(() => {
        // fallback remains local storage
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [NAV_LOGISTICS_PRESET, NAV_LOGISTICS_SCOPE, isAuthenticated, shortageEscalationIds, stagingWatchIds]);

  useEffect(() => {
    localStorage.setItem(INVENTORY_WATCH_KEY, JSON.stringify(stagingWatchIds));
  }, [stagingWatchIds]);

  useEffect(() => {
    localStorage.setItem(SHORTAGE_ESCALATION_KEY, JSON.stringify(shortageEscalationIds));
  }, [shortageEscalationIds]);

  const inventoryTypeOptions = useMemo(() => (
    ['All', ...Array.from(new Set(effectiveResourceInventory.map((item) => item.resourceTypeName))).sort((left, right) => left.localeCompare(right))]
  ), [effectiveResourceInventory]);

  useEffect(() => {
    if (!inventoryTypeOptions.includes(inventoryTypeFilter)) {
      setInventoryTypeFilter('All');
    }
  }, [inventoryTypeFilter, inventoryTypeOptions]);

  const inventoryBaselineSignals = useMemo<InventoryBaselineSignal[]>(() => (
    effectiveResourceInventory.map((item) => {
      const denominator = Math.max(item.quantityTotal, 1);
      const pressurePercent = Math.min(100, Math.round(((item.quantityCommitted + item.quantityOutOfService) / denominator) * 100));
      return {
        key: item.locationResourceInventoryId,
        locationId: item.locationId,
        locationName: item.locationName,
        resourceTypeName: item.resourceTypeName,
        available: item.quantityAvailable,
        committed: item.quantityCommitted,
        outOfService: item.quantityOutOfService,
        pressurePercent,
      };
    })
  ), [effectiveResourceInventory]);

  const bedCategoryOptions = useMemo(() => (
    ['All', ...Array.from(new Set(effectiveBedAvailability.map((item) => item.bedCategoryCode))).sort((left, right) => left.localeCompare(right))]
  ), [effectiveBedAvailability]);

  useEffect(() => {
    if (!bedCategoryOptions.includes(bedCategoryFilter)) {
      setBedCategoryFilter('All');
    }
  }, [bedCategoryFilter, bedCategoryOptions]);

  const bedBaselineSignals = useMemo<BedBaselineSignal[]>(() => (
    effectiveBedAvailability.map((item) => {
      const staffed = item.staffedBedsTotal ?? 0;
      const available = item.bedsAvailable ?? 0;
      const occupied = item.bedsOccupied ?? 0;
      const occupancyPercent = staffed > 0 ? Math.max(0, Math.min(100, Math.round((occupied / staffed) * 100))) : 0;

      return {
        key: item.bedAvailabilitySnapshotId,
        locationId: item.locationId,
        locationName: item.locationName,
        bedCategoryCode: item.bedCategoryCode,
        staffed,
        available,
        occupancyPercent,
      };
    })
  ), [effectiveBedAvailability]);

  const constrainedInventorySignals = useMemo<InventoryConstraintSignal[]>(() => (
    effectiveResourceInventory
      .map((item) => {
        const gap = Math.max(item.quantityCommitted + item.quantityOutOfService - item.quantityAvailable, 0);
        const denominator = Math.max(item.quantityTotal, 1);
        const pressurePercent = Math.min(100, Math.round(((item.quantityCommitted + item.quantityOutOfService) / denominator) * 100));
        return {
          key: item.locationResourceInventoryId,
          locationId: item.locationId,
          locationName: item.locationName,
          resourceTypeName: item.resourceTypeName,
          gap,
          pressurePercent,
        };
      })
      .filter((item) => item.gap > 0)
  ), [effectiveResourceInventory]);

  const shortageFacilitySignals = useMemo<FacilityShortageSignal[]>(() => (
    effectiveBedAvailability
      .map((item) => {
        const staffed = item.staffedBedsTotal ?? 0;
        const available = item.bedsAvailable ?? 0;
        const shortage = Math.max(Math.floor(staffed * 0.1) - available, 0);
        const availabilityPercent = staffed > 0 ? Math.max(0, Math.min(100, Math.round((available / staffed) * 100))) : 0;
        return {
          key: item.bedAvailabilitySnapshotId,
          locationId: item.locationId,
          locationName: item.locationName,
          bedCategoryCode: item.bedCategoryCode,
          shortage,
          availabilityPercent,
        };
      })
      .filter((item) => item.shortage > 0)
  ), [effectiveBedAvailability]);

  const locationSignals = useMemo<LocationOperationsSignal[]>(() => {
    const aggregate = new Map<number, LocationOperationsSignal>();

    for (const signal of inventoryBaselineSignals) {
      const current = aggregate.get(signal.locationId) ?? {
        locationId: signal.locationId,
        locationName: signal.locationName,
        inventoryGap: 0,
        shortageGap: 0,
        constrainedLaneCount: 0,
        shortageLaneCount: 0,
        riskScore: 0,
      };

      aggregate.set(signal.locationId, current);
    }

    for (const signal of bedBaselineSignals) {
      const current = aggregate.get(signal.locationId) ?? {
        locationId: signal.locationId,
        locationName: signal.locationName,
        inventoryGap: 0,
        shortageGap: 0,
        constrainedLaneCount: 0,
        shortageLaneCount: 0,
        riskScore: 0,
      };

      aggregate.set(signal.locationId, current);
    }

    for (const signal of constrainedInventorySignals) {
      const current = aggregate.get(signal.locationId) ?? {
        locationId: signal.locationId,
        locationName: signal.locationName,
        inventoryGap: 0,
        shortageGap: 0,
        constrainedLaneCount: 0,
        shortageLaneCount: 0,
        riskScore: 0,
      };

      current.inventoryGap += signal.gap;
      current.constrainedLaneCount += 1;
      aggregate.set(signal.locationId, current);
    }

    for (const signal of shortageFacilitySignals) {
      const current = aggregate.get(signal.locationId) ?? {
        locationId: signal.locationId,
        locationName: signal.locationName,
        inventoryGap: 0,
        shortageGap: 0,
        constrainedLaneCount: 0,
        shortageLaneCount: 0,
        riskScore: 0,
      };

      current.shortageGap += signal.shortage;
      current.shortageLaneCount += 1;
      aggregate.set(signal.locationId, current);
    }

    const values = Array.from(aggregate.values());
    const maxInventoryGap = Math.max(...values.map((item) => item.inventoryGap), 1);
    const maxShortageGap = Math.max(...values.map((item) => item.shortageGap), 1);
    const maxConstrainedLanes = Math.max(...values.map((item) => item.constrainedLaneCount), 1);
    const maxShortageLanes = Math.max(...values.map((item) => item.shortageLaneCount), 1);

    return values
      .map((item) => {
        const inventorySignal = Math.min(100, Math.round((item.inventoryGap / maxInventoryGap) * 100));
        const shortageSignal = Math.min(100, Math.round((item.shortageGap / maxShortageGap) * 100));
        const constrainedLaneSignal = Math.min(100, Math.round((item.constrainedLaneCount / maxConstrainedLanes) * 100));
        const shortageLaneSignal = Math.min(100, Math.round((item.shortageLaneCount / maxShortageLanes) * 100));

        const riskScore = Math.round(
          (inventorySignal * 0.35)
          + (shortageSignal * 0.35)
          + (constrainedLaneSignal * 0.15)
          + (shortageLaneSignal * 0.15),
        );

        return {
          ...item,
          riskScore,
        };
      })
      .sort((left, right) => right.riskScore - left.riskScore);
  }, [bedBaselineSignals, constrainedInventorySignals, inventoryBaselineSignals, shortageFacilitySignals]);

  useEffect(() => {
    if (!selectedLocationId) {
      return;
    }

    if (!locationSignals.some((item) => item.locationId === selectedLocationId)) {
      setSelectedLocationId(null);
    }
  }, [locationSignals, selectedLocationId]);

  useEffect(() => {
    if (!autoTrackHighestRisk || locationSignals.length === 0) {
      return;
    }

    const highestRiskLocationId = locationSignals[0].locationId;
    if (selectedLocationId !== highestRiskLocationId) {
      setSelectedLocationId(highestRiskLocationId);
    }
  }, [autoTrackHighestRisk, locationSignals, selectedLocationId]);

  const constrainedInventoryCount = constrainedInventorySignals.length;
  const facilityShortageCount = shortageFacilitySignals.length;

  useEffect(() => {
    const tick = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    setContinuityTimeline((current) => {
      const last = current[current.length - 1];
      if (
        last
        && last.liveInventoryCount === liveInventoryRecordCount
        && last.liveBedCount === liveBedRecordCount
        && last.constrainedCount === constrainedInventoryCount
        && last.shortageCount === facilityShortageCount
        && last.overlayActive === (useSyntheticSignalOverlay ? 1 : 0)
      ) {
        return current;
      }

      const nextPoint: ContinuityTimelinePoint = {
        tick,
        liveInventoryCount: liveInventoryRecordCount,
        liveBedCount: liveBedRecordCount,
        constrainedCount: constrainedInventoryCount,
        shortageCount: facilityShortageCount,
        overlayActive: useSyntheticSignalOverlay ? 1 : 0,
      };

      return [...current, nextPoint].slice(-12);
    });
  }, [constrainedInventoryCount, facilityShortageCount, liveBedRecordCount, liveInventoryRecordCount, useSyntheticSignalOverlay]);

  const logisticsSignalVariant = constrainedInventoryCount > 0 || facilityShortageCount > 0
    ? 'info'
    : 'success';

  const constrainedInventoryTop = useMemo(() => {
    const constrainedSource = constrainedInventorySignals.length > 0
      ? constrainedInventorySignals
      : inventoryBaselineSignals.map((item) => ({
          key: item.key,
          locationId: item.locationId,
          locationName: item.locationName,
          resourceTypeName: item.resourceTypeName,
          gap: 0,
          pressurePercent: item.pressurePercent,
        }));

    const filtered = constrainedSource
      .filter((item) => selectedLocationId === null || item.locationId === selectedLocationId)
      .filter((item) => inventoryTypeFilter === 'All' || item.resourceTypeName === inventoryTypeFilter)
      .filter((item) => !watchOnlyMode || stagingWatchIds.includes(item.key));

    const sorted = [...filtered].sort((left, right) => (
      inventorySortMode === 'pressure'
        ? right.pressurePercent - left.pressurePercent || right.gap - left.gap
        : right.gap - left.gap || right.pressurePercent - left.pressurePercent
    ));

    return sorted.slice(0, 8);
  }, [constrainedInventorySignals, inventoryBaselineSignals, inventorySortMode, inventoryTypeFilter, selectedLocationId, watchOnlyMode, stagingWatchIds]);

  const shortageFacilitiesTop = useMemo(() => {
    const shortageSource = shortageFacilitySignals.length > 0
      ? shortageFacilitySignals
      : bedBaselineSignals.map((item) => ({
          key: item.key,
          locationId: item.locationId,
          locationName: item.locationName,
          bedCategoryCode: item.bedCategoryCode,
          shortage: 0,
          availabilityPercent: item.staffed > 0 ? Math.max(0, Math.min(100, Math.round((item.available / item.staffed) * 100))) : 0,
        }));

    const filtered = shortageSource
      .filter((item) => selectedLocationId === null || item.locationId === selectedLocationId)
      .filter((item) => bedCategoryFilter === 'All' || item.bedCategoryCode === bedCategoryFilter)
      .filter((item) => !escalationOnlyMode || shortageEscalationIds.includes(item.key));

    const sorted = [...filtered].sort((left, right) => (
      facilitySortMode === 'availability'
        ? left.availabilityPercent - right.availabilityPercent || right.shortage - left.shortage
        : right.shortage - left.shortage || left.availabilityPercent - right.availabilityPercent
    ));

    return sorted.slice(0, 8);
  }, [bedBaselineSignals, bedCategoryFilter, escalationOnlyMode, facilitySortMode, selectedLocationId, shortageEscalationIds, shortageFacilitySignals]);

  const activeLocationSignal = selectedLocationId === null
    ? null
    : locationSignals.find((item) => item.locationId === selectedLocationId) ?? null;

  const commandRadarLocationSignal = activeLocationSignal ?? locationSignals[0] ?? null;

  const commandRadarData = useMemo<CommandRadarPoint[]>(() => {
    if (!commandRadarLocationSignal) {
      return [];
    }

    const inventoryScale = Math.min(100, commandRadarLocationSignal.inventoryGap * 5);
    const shortageScale = Math.min(100, commandRadarLocationSignal.shortageGap * 8);
    const riskScale = Math.min(100, commandRadarLocationSignal.riskScore);
    const laneLoadScale = Math.min(100, (commandRadarLocationSignal.constrainedLaneCount + commandRadarLocationSignal.shortageLaneCount) * 12);

    return [
      { metric: 'Inventory Pressure', value: inventoryScale },
      { metric: 'Facility Shortage', value: shortageScale },
      { metric: 'Composite Risk', value: riskScale },
      { metric: 'Lane Load', value: laneLoadScale },
    ];
  }, [commandRadarLocationSignal]);

  const totalInventoryGap = constrainedInventorySignals.reduce((sum, item) => sum + item.gap, 0);
  const totalShortageGap = shortageFacilitySignals.reduce((sum, item) => sum + item.shortage, 0);
  const inventoryConstraintRatio = effectiveResourceInventory.length > 0
    ? Math.round((constrainedInventoryCount / effectiveResourceInventory.length) * 100)
    : 0;
  const facilityConstraintRatio = effectiveBedAvailability.length > 0
    ? Math.round((facilityShortageCount / effectiveBedAvailability.length) * 100)
    : 0;

  const canManageLogisticsActions = canManageLogisticsModuleActions(isAuthenticated, authRoles, authScopes);

  const highRiskThreshold = 70;
  const moderateRiskThreshold = 45;

  const highRiskLocationCount = locationSignals.filter((item) => item.riskScore >= highRiskThreshold).length;
  const moderateRiskLocationCount = locationSignals.filter((item) => item.riskScore >= moderateRiskThreshold && item.riskScore < highRiskThreshold).length;
  const lowRiskLocationCount = Math.max(locationSignals.length - highRiskLocationCount - moderateRiskLocationCount, 0);

  const locationRiskThreshold = Number(riskThreshold);

  const locationSignalsFiltered = useMemo(() => (
    locationSignals.filter((item) => item.riskScore >= locationRiskThreshold || item.locationId === selectedLocationId)
  ), [locationRiskThreshold, locationSignals, selectedLocationId]);

  const mapSignals = useMemo(() => (
    [...locationSignalsFiltered]
      .sort((left, right) => {
        const direction = mapPinSortDirection === 'desc' ? -1 : 1;

        if (mapPinSortMode === 'name') {
          return left.locationName.localeCompare(right.locationName) * direction;
        }

        if (mapPinSortMode === 'inventory') {
          return (left.inventoryGap - right.inventoryGap) * direction;
        }

        if (mapPinSortMode === 'shortage') {
          return (left.shortageGap - right.shortageGap) * direction;
        }

        return (left.riskScore - right.riskScore) * direction;
      })
      .slice(0, Number(mapMarkerLimit))
  ), [locationSignalsFiltered, mapMarkerLimit, mapPinSortDirection, mapPinSortMode]);

  const mapSignalPoints = useMemo<MapSignalPoint[]>(() => {
    const locationLookupMap = new Map<number, LocationLookupValue>();
    locationLookups.forEach((location) => {
      locationLookupMap.set(location.locationId, location);
    });

    const locationLookupCoordinate = (locationId: number): MapGeoCoordinate | null => {
      const location = locationLookupMap.get(locationId);
      const latitude = location?.latitude;
      const longitude = location?.longitude;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return null;
      }

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return null;
      }

      return { lat: latitude, lng: longitude };
    };

    const locationNameCoordinate = (locationName: string): MapGeoCoordinate | null => {
      const name = locationName.toLowerCase();
      if (name.includes('wichita')) {
        return { lat: 37.6872, lng: -97.3301 };
      }

      if (name.includes('topeka')) {
        return { lat: 39.0473, lng: -95.6752 };
      }

      if (name.includes('dodge')) {
        return { lat: 37.7528, lng: -100.0171 };
      }

      if (name.includes('kc') || name.includes('kansas city')) {
        return { lat: 39.1142, lng: -94.6275 };
      }

      if (name.includes('hays')) {
        return { lat: 38.8792, lng: -99.3268 };
      }

      if (name.includes('garden city')) {
        return { lat: 37.9717, lng: -100.8727 };
      }

      if (name.includes('salina')) {
        return { lat: 38.8403, lng: -97.6114 };
      }

      if (name.includes('emporia')) {
        return { lat: 38.4049, lng: -96.1817 };
      }

      return null;
    };

    return mapSignals.map((signal, index) => {
      const resolvedLookupCoordinate = locationLookupCoordinate(signal.locationId);
      const presetCoordinate = resolvedLookupCoordinate ?? MAP_GEO_PRESETS[signal.locationId] ?? locationNameCoordinate(signal.locationName);

      const fallbackCoordinate: MapGeoCoordinate = {
        lat: 37.5 + (((signal.locationId * 13) % 18) * 0.13),
        lng: -101.5 + (((signal.locationId * 17) % 34) * 0.22),
      };

      const spreadOffset = (index % 4) * 0.012;
      const coordinate = presetCoordinate ?? fallbackCoordinate;

      return {
        locationId: signal.locationId,
        locationName: signal.locationName,
        riskScore: signal.riskScore,
        inventoryGap: signal.inventoryGap,
        shortageGap: signal.shortageGap,
        coordinate: {
          lat: coordinate.lat + spreadOffset,
          lng: coordinate.lng + spreadOffset,
        },
      };
    });
  }, [locationLookups, mapSignals]);

  const selectedMapPoint = selectedLocationId === null
    ? null
    : mapSignalPoints.find((item) => item.locationId === selectedLocationId) ?? null;

  const markerGlyphForSignal = (signal: LocationOperationsSignal) => {
    if (mapLayerMode === 'inventory') {
      return signal.inventoryGap >= 12 ? '▲' : '▴';
    }

    if (mapLayerMode === 'shortage') {
      return signal.shortageGap >= 6 ? '■' : '▢';
    }

    return signal.riskScore >= 70 ? '◆' : signal.riskScore >= 45 ? '●' : '○';
  };

  const markerColorForSignal = (signal: LocationOperationsSignal) => (
    mapLayerMode === 'inventory'
      ? (signal.inventoryGap >= 12 ? 'var(--ipoc-chart-info)' : 'var(--ipoc-chart-series-1)')
      : mapLayerMode === 'shortage'
        ? (signal.shortageGap >= 6 ? 'var(--ipoc-chart-warning)' : 'var(--ipoc-chart-neutral)')
        : (signal.riskScore >= 70 ? 'var(--ipoc-chart-critical)' : signal.riskScore >= 45 ? 'var(--ipoc-chart-warning)' : 'var(--ipoc-chart-series-1)')
  );

  const markerIconForSignal = (signal: LocationOperationsSignal, isSelected: boolean) => {
    const markerColor = markerColorForSignal(signal);
    const markerGlyph = markerGlyphForSignal(signal);

    return divIcon({
      className: 'ipoc-logistics-marker-icon',
      html: `<div class="ipoc-logistics-marker-shell ${isSelected ? 'ipoc-logistics-marker-selected' : ''}" style="border-color:${markerColor};color:${markerColor};">${markerGlyph}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -11],
      tooltipAnchor: [0, -11],
    });
  };

  const logisticsChartData = useMemo<LogisticsChartPoint[]>(() => (
    locationSignalsFiltered
      .slice(0, Number(locationChartDepth))
      .map((item) => ({
        locationId: item.locationId,
        location: item.locationName.length > 16 ? `${item.locationName.slice(0, 16)}…` : item.locationName,
        inventoryGap: item.inventoryGap,
        shortageGap: item.shortageGap,
        riskScore: item.riskScore,
      }))
  ), [locationChartDepth, locationSignalsFiltered]);

  const logisticsMapLegendLabel = mapLayerMode === 'inventory'
    ? 'Inventory pressure layer'
    : mapLayerMode === 'shortage'
      ? 'Facility shortage layer'
      : 'Composite risk layer';

  const mapBaseLayer = MAP_BASE_LAYER_CONFIG[mapBaseLayerMode];

  const inventoryConstraintVariant = inventoryConstraintRatio >= 55
    ? 'danger'
    : inventoryConstraintRatio >= 35
      ? 'warning'
      : inventoryConstraintRatio >= 15
        ? 'info'
        : 'success';

  const facilityConstraintVariant = facilityConstraintRatio >= 50
    ? 'danger'
    : facilityConstraintRatio >= 30
      ? 'warning'
      : facilityConstraintRatio >= 12
        ? 'info'
        : 'success';

  const inventoryGapVariant = totalInventoryGap >= 40
    ? 'danger'
    : totalInventoryGap >= 20
      ? 'warning'
      : totalInventoryGap > 0
        ? 'info'
        : 'success';

  const shortageGapVariant = totalShortageGap >= 25
    ? 'danger'
    : totalShortageGap >= 10
      ? 'warning'
      : totalShortageGap > 0
        ? 'info'
        : 'success';

  const mapTooltipForSignal = (item: LocationOperationsSignal) => (
    `${item.locationName} · Risk ${item.riskScore} · Inventory ${item.inventoryGap} · Shortage ${item.shortageGap}`
  );

  const continuityStatusLabel = useSyntheticSignalOverlay
    ? 'Continuity state: overlay supporting sparse live feed'
    : 'Continuity state: running on live signals';
  const weatherRiskLevelFilter = weatherOperationalSignal.highRiskDayCount > 0 ? 'high' : 'moderate';
  const weatherRiskDays = weatherOperationalSignal.days.filter((item) => item.riskLevel === weatherRiskLevelFilter);

  const legacyLogisticsChartData = useMemo<LogisticsChartPoint[]>(() => (
    locationSignals
      .slice(0, 8)
      .map((item) => ({
        locationId: item.locationId,
        location: item.locationName.length > 16 ? `${item.locationName.slice(0, 16)}…` : item.locationName,
        inventoryGap: item.inventoryGap,
        shortageGap: item.shortageGap,
        riskScore: item.riskScore,
      }))
  ), [locationSignals]);

  const riskDistributionChartData = useMemo(() => ([
    { name: 'High', value: highRiskLocationCount, fill: 'var(--ipoc-chart-critical)' },
    { name: 'Moderate', value: moderateRiskLocationCount, fill: 'var(--ipoc-chart-warning)' },
    { name: 'Low', value: lowRiskLocationCount, fill: 'var(--ipoc-chart-success)' },
  ].filter((item) => item.value > 0)), [highRiskLocationCount, lowRiskLocationCount, moderateRiskLocationCount]);

  const flaggedWorkloadChartData = useMemo(() => ([
    {
      bucket: 'Inventory Constraints',
      flagged: stagingWatchIds.length,
      unflagged: Math.max(constrainedInventoryCount - stagingWatchIds.length, 0),
    },
    {
      bucket: 'Facility Shortages',
      flagged: shortageEscalationIds.length,
      unflagged: Math.max(facilityShortageCount - shortageEscalationIds.length, 0),
    },
  ]), [constrainedInventoryCount, facilityShortageCount, shortageEscalationIds.length, stagingWatchIds.length]);

  const toggleStagingWatch = (id: number) => {
    setStagingWatchIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  };

  const toggleShortageEscalation = (id: number) => {
    setShortageEscalationIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  };

  const handleResetOperationalFilters = () => {
    setSelectedLocationId(null);
    setInventoryTypeFilter('All');
    setBedCategoryFilter('All');
    setInventorySortMode('gap');
    setFacilitySortMode('shortage');
    setWatchOnlyMode(false);
    setEscalationOnlyMode(false);
    setAutoTrackHighestRisk(false);
    setMapPinSortMode('risk');
    setMapPinSortDirection('desc');
    setMapZoomLevel(KANSAS_DEFAULT_ZOOM);
    setMapBaseLayerMode('streets');
    setClusterPins(true);
    setMapFocusMode(false);
  };

  const handleFocusHighestRiskLocation = () => {
    if (locationSignals.length === 0) {
      return;
    }

    setSelectedLocationId(locationSignals[0].locationId);
  };

  const handleLocationChartClick = (point: LogisticsChartPoint | undefined) => {
    if (!point) {
      return;
    }

    setSelectedLocationId(point.locationId);
  };

  const handleToggleSeries = (dataKey: string | undefined) => {
    if (dataKey !== 'inventoryGap' && dataKey !== 'shortageGap' && dataKey !== 'riskScore') {
      return;
    }

    setHiddenChartSeries((current) => (
      current.includes(dataKey)
        ? current.filter((item) => item !== dataKey)
        : [...current, dataKey]
    ));
  };

  return (
    <Card className="shadow-sm ipoc-logistics-cockpit">
      <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
        <span className="pe-2">Logistics & Staging Operations Cockpit</span>
        <span className="d-inline-flex gap-2">
          <IconActionButton
            iconClassName="bi bi-info-circle"
            tooltip="Logistics workspace for cross-facility staging, shortage triage, disruption monitoring, and escalation controls."
            ariaLabel="Logistics workspace information"
            onClick={() => undefined}
            variant="outline-secondary"
            size="sm"
          />
          <Badge bg="secondary">Data Scope Global</Badge>
          <Badge bg={liveFeedHealthVariant}>Live Feed {liveInventoryRecordCount} inv / {liveBedRecordCount} bed</Badge>
          <Badge bg={useSyntheticSignalOverlay ? 'warning' : 'success'}>{useSyntheticSignalOverlay ? 'Synthetic Overlay On' : 'Live Signals Active'}</Badge>
          <Badge bg={logisticsSignalVariant}>
            {constrainedInventoryCount + facilityShortageCount} logistics constraints
          </Badge>
        </span>
      </Card.Header>
      <Card.Body>
        <div className="small text-muted mb-2">
          Last live update: {latestLiveUpdateUtc ? new Date(latestLiveUpdateUtc).toLocaleString() : 'No live telemetry timestamp yet'}
        </div>
        <div className="small text-muted mb-2 d-flex align-items-center gap-2 flex-wrap">
          <span>Weather impact: {weatherOperationalSignal.immediateSummary}</span>
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
                  : 'No weather disruption'}
            </Badge>
          </button>
        </div>
        {!weatherOperationalSignal.hasData && (
          <div className="small text-muted mb-2">
            Live weather unavailable for current logistics context. Configure incident or default weather location coordinates for live disruption signals.
          </div>
        )}
        {showWeatherRiskDayDetails && weatherRiskDays.length > 0 && (
          <ListGroup variant="flush" className="mb-2">
            {weatherRiskDays.map((item) => (
              <ListGroup.Item key={`logistics-weather-risk-${item.date}`} className="px-0 py-1 small bg-transparent">
                <span className="fw-semibold">{new Date(item.date).toLocaleDateString()}</span>
                <span className="text-muted"> · {item.temperatureF}°F / {item.temperatureC}°C · {item.summary}</span>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
        {useSyntheticSignalOverlay && (
          <div className="small text-muted mb-2">
            Live logistics feeds are still sparse or have limited constraints. Synthetic overlay is active to keep cockpit visuals stable.
          </div>
        )}
        {!canManageLogisticsActions && (
          <div className="small text-muted mb-2">Logistics action controls require commander/reporter access.</div>
        )}

        <Row className="g-3 mb-3">
          <Col lg={3} md={6}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-logistics-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Inventory constraints</div>
                <div className={`fw-semibold fs-5 text-${inventoryConstraintVariant}`}>{constrainedInventoryCount}</div>
                <ProgressBar now={inventoryConstraintRatio} variant={inventoryConstraintVariant} className="mt-2" style={{ height: '0.5rem' }} />
                <div className="small text-muted mt-1">{inventoryConstraintRatio}% of lanes constrained</div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-logistics-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Facility shortage signals</div>
                <div className={`fw-semibold fs-5 text-${facilityConstraintVariant}`}>{facilityShortageCount}</div>
                <ProgressBar now={facilityConstraintRatio} variant={facilityConstraintVariant} className="mt-2" style={{ height: '0.5rem' }} />
                <div className="small text-muted mt-1">{facilityConstraintRatio}% of bed snapshots at risk</div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-logistics-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Total inventory gap</div>
                <div className={`fw-semibold fs-5 text-${inventoryGapVariant}`}>{totalInventoryGap}</div>
                <ProgressBar now={Math.min(100, totalInventoryGap * 2)} variant={inventoryGapVariant} className="mt-2" style={{ height: '0.5rem' }} />
                <div className="small text-muted mt-1">Staging watchlist {stagingWatchIds.length}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-logistics-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Total shortage gap</div>
                <div className={`fw-semibold fs-5 text-${shortageGapVariant}`}>{totalShortageGap}</div>
                <ProgressBar now={Math.min(100, totalShortageGap * 3)} variant={shortageGapVariant} className="mt-2" style={{ height: '0.5rem' }} />
                <div className="small text-muted mt-1">Escalation queue {shortageEscalationIds.length}</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-3">
          <Col xl={5}>
            <Card className="h-100 border">
              <Card.Header className="py-2 small fw-semibold d-flex align-items-center justify-content-between">
                <span>Facility Operations Map (Logistics Focus)</span>
                <IconActionButton
                  iconClassName="bi bi-x-diamond"
                  tooltip="Clear location focus"
                  ariaLabel="Clear logistics location focus"
                  onClick={() => setSelectedLocationId(null)}
                  variant="outline-secondary"
                  disabled={selectedLocationId === null}
                />
              </Card.Header>
              <Card.Body>
                <div
                  className="position-relative rounded border ipoc-logistics-map-surface"
                  style={{
                    minHeight: '250px',
                    background: 'linear-gradient(180deg, rgba(13,110,253,0.06) 0%, rgba(13,110,253,0.01) 45%, rgba(108,117,125,0.05) 100%)',
                  }}
                >
                  <div className="position-absolute top-0 start-0 p-2 small text-muted">Kansas Logistics Operational Map · {logisticsMapLegendLabel}</div>
                  <div className="position-absolute top-0 end-0 p-2 d-flex align-items-center gap-1 ipoc-logistics-map-overlay-controls">
                    <MapControlStrip
                      mapName="logistics map"
                      onZoomIn={() => setMapZoomLevel((current) => Math.min(10, current + 1))}
                      onZoomOut={() => setMapZoomLevel((current) => Math.max(5, current - 1))}
                      onResetZoom={() => setMapZoomLevel(KANSAS_DEFAULT_ZOOM)}
                      onFitToMarkers={() => setFitToSignalsNonce((current) => current + 1)}
                      onResetExtent={() => setFitToKansasNonce((current) => current + 1)}
                      onOpenFocus={() => setMapFocusMode(true)}
                      fitToMarkersDisabled={mapSignalPoints.length === 0}
                    />
                  </div>
                  {mapSignalPoints.length === 0 ? (
                    <div className="position-absolute top-50 start-50 translate-middle small text-muted">No location constraints available.</div>
                  ) : (
                    <MapContainer
                      center={KANSAS_MAP_CENTER}
                      zoom={mapZoomLevel}
                      scrollWheelZoom
                      preferCanvas
                      zoomControl={false}
                      style={{ minHeight: '250px', width: '100%' }}
                      className="rounded"
                    >
                      <ZoomControl position="bottomright" />
                      <ScaleControl position="bottomleft" imperial={false} />
                      <TileLayer
                        attribution={mapBaseLayer.attribution}
                        url={mapBaseLayer.url}
                      />
                      <LogisticsMapViewportController
                        mapPoints={mapSignalPoints}
                        selectedPoint={selectedMapPoint}
                        mapZoomLevel={mapZoomLevel}
                        fitToSignalsNonce={fitToSignalsNonce}
                        fitToKansasNonce={fitToKansasNonce}
                      />
                      <LogisticsMapZoomSync onZoomChanged={setMapZoomLevel} />
                      {clusterPins ? (
                        <MarkerClusterGroup chunkedLoading>
                          {mapSignalPoints.map((point) => {
                            const signal = mapSignals.find((item) => item.locationId === point.locationId);
                            if (!signal) {
                              return null;
                            }

                            return (
                              <Marker
                                key={`logistics-map-${point.locationId}`}
                                position={[point.coordinate.lat, point.coordinate.lng]}
                                icon={markerIconForSignal(signal, selectedLocationId === point.locationId)}
                                eventHandlers={{
                                  click: () => setSelectedLocationId(point.locationId),
                                }}
                              >
                                <LeafletTooltip direction="top" offset={[0, -6]}>
                                  {mapTooltipForSignal(signal)}
                                </LeafletTooltip>
                                <Popup>
                                  <div className="small fw-semibold">{signal.locationName}</div>
                                  <div className="small text-muted">Risk {signal.riskScore}/100</div>
                                  <div className="small text-muted">Inventory gap {signal.inventoryGap}</div>
                                  <div className="small text-muted">Shortage gap {signal.shortageGap}</div>
                                </Popup>
                              </Marker>
                            );
                          })}
                        </MarkerClusterGroup>
                      ) : (
                        mapSignalPoints.map((point) => {
                          const signal = mapSignals.find((item) => item.locationId === point.locationId);
                          if (!signal) {
                            return null;
                          }

                          return (
                            <Marker
                              key={`logistics-map-${point.locationId}`}
                              position={[point.coordinate.lat, point.coordinate.lng]}
                              icon={markerIconForSignal(signal, selectedLocationId === point.locationId)}
                              eventHandlers={{
                                click: () => setSelectedLocationId(point.locationId),
                              }}
                            >
                              <LeafletTooltip direction="top" offset={[0, -6]}>
                                {mapTooltipForSignal(signal)}
                              </LeafletTooltip>
                              <Popup>
                                <div className="small fw-semibold">{signal.locationName}</div>
                                <div className="small text-muted">Risk {signal.riskScore}/100</div>
                                <div className="small text-muted">Inventory gap {signal.inventoryGap}</div>
                                <div className="small text-muted">Shortage gap {signal.shortageGap}</div>
                              </Popup>
                            </Marker>
                          );
                        })
                      )}
                    </MapContainer>
                  )}
                </div>
                <Modal
                  show={mapFocusMode}
                  onHide={() => setMapFocusMode(false)}
                  centered
                  size="xl"
                  dialogClassName="ipoc-map-focus-modal"
                >
                  <Modal.Header closeButton>
                    <Modal.Title className="small fw-semibold">Logistics Focus Map</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="small text-muted">Expanded map view with full operator controls and live signal markers.</div>
                      <IconActionButton
                        iconClassName="bi bi-arrow-return-left"
                        tooltip="Return to cockpit map panel"
                        ariaLabel="Return to cockpit map panel"
                        onClick={() => setMapFocusMode(false)}
                        variant="outline-secondary"
                        size="sm"
                      />
                    </div>
                    <div className="position-relative rounded border ipoc-logistics-map-surface" style={{ minHeight: '70vh' }}>
                      <MapContainer
                        center={KANSAS_MAP_CENTER}
                        zoom={mapZoomLevel}
                        scrollWheelZoom
                        preferCanvas
                        zoomControl={false}
                        style={{ minHeight: '70vh', width: '100%' }}
                        className="rounded"
                      >
                        <ZoomControl position="bottomright" />
                        <ScaleControl position="bottomleft" imperial={false} />
                        <TileLayer
                          attribution={mapBaseLayer.attribution}
                          url={mapBaseLayer.url}
                        />
                        <LogisticsMapViewportController
                          mapPoints={mapSignalPoints}
                          selectedPoint={selectedMapPoint}
                          mapZoomLevel={mapZoomLevel}
                          fitToSignalsNonce={fitToSignalsNonce}
                          fitToKansasNonce={fitToKansasNonce}
                        />
                        <LogisticsMapZoomSync onZoomChanged={setMapZoomLevel} />
                        {clusterPins ? (
                          <MarkerClusterGroup chunkedLoading>
                            {mapSignalPoints.map((point) => {
                              const signal = mapSignals.find((item) => item.locationId === point.locationId);
                              if (!signal) {
                                return null;
                              }

                              return (
                                <Marker
                                  key={`logistics-focus-map-${point.locationId}`}
                                  position={[point.coordinate.lat, point.coordinate.lng]}
                                  icon={markerIconForSignal(signal, selectedLocationId === point.locationId)}
                                  eventHandlers={{
                                    click: () => setSelectedLocationId(point.locationId),
                                  }}
                                >
                                  <LeafletTooltip direction="top" offset={[0, -6]}>
                                    {mapTooltipForSignal(signal)}
                                  </LeafletTooltip>
                                  <Popup>
                                    <div className="small fw-semibold">{signal.locationName}</div>
                                    <div className="small text-muted">Risk {signal.riskScore}/100</div>
                                    <div className="small text-muted">Inventory gap {signal.inventoryGap}</div>
                                    <div className="small text-muted">Shortage gap {signal.shortageGap}</div>
                                  </Popup>
                                </Marker>
                              );
                            })}
                          </MarkerClusterGroup>
                        ) : (
                          mapSignalPoints.map((point) => {
                            const signal = mapSignals.find((item) => item.locationId === point.locationId);
                            if (!signal) {
                              return null;
                            }

                            return (
                              <Marker
                                key={`logistics-focus-map-${point.locationId}`}
                                position={[point.coordinate.lat, point.coordinate.lng]}
                                icon={markerIconForSignal(signal, selectedLocationId === point.locationId)}
                                eventHandlers={{
                                  click: () => setSelectedLocationId(point.locationId),
                                }}
                              >
                                <LeafletTooltip direction="top" offset={[0, -6]}>
                                  {mapTooltipForSignal(signal)}
                                </LeafletTooltip>
                                <Popup>
                                  <div className="small fw-semibold">{signal.locationName}</div>
                                  <div className="small text-muted">Risk {signal.riskScore}/100</div>
                                  <div className="small text-muted">Inventory gap {signal.inventoryGap}</div>
                                  <div className="small text-muted">Shortage gap {signal.shortageGap}</div>
                                </Popup>
                              </Marker>
                            );
                          })
                        )}
                      </MapContainer>
                    </div>
                  </Modal.Body>
                </Modal>
                <div className="small text-muted mt-2 d-flex align-items-center gap-2 flex-wrap">
                  <Badge bg="secondary">Base layer {mapBaseLayer.label}</Badge>
                  <Badge bg="secondary">Pins {mapSignalPoints.length}</Badge>
                  <Badge bg={clusterPins ? 'info' : 'secondary'}>{clusterPins ? 'Clustering On' : 'Clustering Off'}</Badge>
                </div>
                <div className="small text-muted mt-1 d-flex align-items-center gap-3 flex-wrap">
                  <span><i className="bi bi-circle-fill me-1" style={{ color: 'var(--ipoc-chart-critical)' }} />Risk ≥ {highRiskThreshold}</span>
                  <span><i className="bi bi-circle-fill me-1" style={{ color: 'var(--ipoc-chart-warning)' }} />Risk {moderateRiskThreshold}–{highRiskThreshold - 1}</span>
                  <span><i className="bi bi-circle-fill me-1" style={{ color: 'var(--ipoc-chart-series-1)' }} />Risk &lt; {moderateRiskThreshold}</span>
                </div>
                <div className="small text-muted mt-2">
                  {activeLocationSignal
                    ? `Focused: ${activeLocationSignal.locationName} · Risk ${activeLocationSignal.riskScore} · Inventory gap ${activeLocationSignal.inventoryGap} · Shortage gap ${activeLocationSignal.shortageGap}`
                    : 'No location focus selected. Select a map marker to scope logistics triage.'}
                </div>
                <div className="small text-muted mt-2 d-flex align-items-center gap-3 flex-wrap">
                  <span><i className="bi bi-circle-fill me-1" />High risk: {highRiskLocationCount}</span>
                  <span><i className="bi bi-circle me-1" />Moderate: {moderateRiskLocationCount}</span>
                  <span><i className="bi bi-circle me-1" />Low: {lowRiskLocationCount}</span>
                </div>
                <ListGroup className="mt-2" variant="flush">
                  {locationSignals.slice(0, 3).map((item) => (
                    <ListGroup.Item key={`logistics-risk-${item.locationId}`} className="px-0 py-1 small d-flex align-items-center justify-content-between">
                      <span>{item.locationName}</span>
                      <Badge bg="secondary">Risk {item.riskScore}</Badge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          </Col>

          <Col xl={7}>
            <Card className="h-100 border">
              <Card.Header className="py-2 small fw-semibold">Constraint Analytics & Command Board</Card.Header>
              <Card.Body>
                <div className="d-flex align-items-center justify-content-end gap-2 mb-2">
                  <IconActionButton
                    iconClassName={watchOnlyMode ? 'bi bi-bookmark-check' : 'bi bi-bookmark'}
                    tooltip={watchOnlyMode ? 'Show all inventory lanes' : 'Show watchlisted inventory lanes only'}
                    ariaLabel={watchOnlyMode ? 'Disable watchlist only mode' : 'Enable watchlist only mode'}
                    onClick={() => setWatchOnlyMode((current) => !current)}
                    variant="outline-primary"
                  />
                  <IconActionButton
                    iconClassName={escalationOnlyMode ? 'bi bi-flag-fill' : 'bi bi-flag'}
                    tooltip={escalationOnlyMode ? 'Show all shortage signals' : 'Show escalated shortage signals only'}
                    ariaLabel={escalationOnlyMode ? 'Disable escalation only mode' : 'Enable escalation only mode'}
                    onClick={() => setEscalationOnlyMode((current) => !current)}
                    variant="outline-secondary"
                  />
                  <IconActionButton
                    iconClassName="bi bi-bullseye"
                    tooltip="Focus highest risk location"
                    ariaLabel="Focus highest risk location"
                    onClick={handleFocusHighestRiskLocation}
                    variant="outline-info"
                    disabled={locationSignals.length === 0}
                  />
                  <IconActionButton
                    iconClassName={autoTrackHighestRisk ? 'bi bi-crosshair2' : 'bi bi-crosshair'}
                    tooltip={autoTrackHighestRisk ? 'Disable auto-track highest risk location' : 'Enable auto-track highest risk location'}
                    ariaLabel={autoTrackHighestRisk ? 'Disable auto-track highest risk location' : 'Enable auto-track highest risk location'}
                    onClick={() => setAutoTrackHighestRisk((current) => !current)}
                    variant={autoTrackHighestRisk ? 'outline-info' : 'outline-secondary'}
                    disabled={locationSignals.length === 0}
                  />
                  <IconActionButton
                    iconClassName="bi bi-arrow-counterclockwise"
                    tooltip="Reset logistics filters and focus"
                    ariaLabel="Reset logistics filters and focus"
                    onClick={handleResetOperationalFilters}
                    variant="outline-secondary"
                  />
                </div>

                <Row className="g-2 mb-2">
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Map signal layer" info="Choose which operational stress signal drives map marker semantics: composite risk, inventory pressure, or facility shortage." /></Form.Label>
                    <Form.Select size="sm" value={mapLayerMode} onChange={(event) => setMapLayerMode(event.target.value as 'risk' | 'inventory' | 'shortage')}>
                      <option value="risk">Composite Risk</option>
                      <option value="inventory">Inventory Pressure</option>
                      <option value="shortage">Facility Shortage</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Map base layer" info="Switch base cartography view to emphasize roads, terrain, or satellite-style context for field interpretation." /></Form.Label>
                    <Form.Select size="sm" value={mapBaseLayerMode} onChange={(event) => setMapBaseLayerMode(event.target.value as MapBaseLayerMode)}>
                      <option value="streets">Streets</option>
                      <option value="terrain">Terrain</option>
                      <option value="satellite">Satellite-like</option>
                    </Form.Select>
                    <div className="small text-muted mt-1">Uses static tile source switching for stable rendering in cockpit layout.</div>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Map pin sort" info="Order markers by risk, inventory, shortage, or location name to control triage reading priority." /></Form.Label>
                    <Form.Select size="sm" value={mapPinSortMode} onChange={(event) => setMapPinSortMode(event.target.value as MapPinSortMode)}>
                      <option value="risk">Risk Score</option>
                      <option value="inventory">Inventory Gap</option>
                      <option value="shortage">Shortage Gap</option>
                      <option value="name">Location Name</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Chart depth" info="Set how many top constrained locations are included in logistics chart summaries." /></Form.Label>
                    <Form.Select size="sm" value={locationChartDepth} onChange={(event) => setLocationChartDepth(event.target.value as '8' | '12' | '16')}>
                      <option value="8">Top 8 Locations</option>
                      <option value="12">Top 12 Locations</option>
                      <option value="16">Top 16 Locations</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Map sort direction" info="Control whether the map ordering prioritizes highest or lowest values for the selected pin sort mode." /></Form.Label>
                    <Form.Select size="sm" value={mapPinSortDirection} onChange={(event) => setMapPinSortDirection(event.target.value as MapPinSortDirection)}>
                      <option value="desc">Highest First</option>
                      <option value="asc">Lowest First</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Map marker behavior" info="Choose clustered markers for dense views or individual pins for direct one-location actions." /></Form.Label>
                    <Form.Select size="sm" value={clusterPins ? 'clustered' : 'individual'} onChange={(event) => setClusterPins(event.target.value === 'clustered')}>
                      <option value="clustered">Clustered</option>
                      <option value="individual">Individual Pins</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Map marker density" info="Limit marker count for compact, standard, or dense operator map rendering." /></Form.Label>
                    <Form.Select size="sm" value={mapMarkerLimit} onChange={(event) => setMapMarkerLimit(event.target.value as '8' | '16' | '24')}>
                      <option value="8">Compact (8)</option>
                      <option value="16">Standard (16)</option>
                      <option value="24">Dense (24)</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text={`Risk threshold: ${locationRiskThreshold}`} info="Set the minimum composite risk score for locations to be emphasized in logistics triage surfaces." /></Form.Label>
                    <Form.Range
                      min={0}
                      max={80}
                      step={5}
                      value={locationRiskThreshold}
                      onChange={(event) => setRiskThreshold(Number(event.target.value))}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Inventory type filter" info="Restrict logistics views to a specific inventory category for focused fulfillment analysis." /></Form.Label>
                    <Form.Select size="sm" value={inventoryTypeFilter} onChange={(event) => setInventoryTypeFilter(event.target.value)}>
                      {inventoryTypeOptions.map((option) => (
                        <option key={`inventory-type-${option}`} value={option}>{option}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Bed category filter" info="Filter facility bed analytics by bed category to isolate capacity constraints." /></Form.Label>
                    <Form.Select size="sm" value={bedCategoryFilter} onChange={(event) => setBedCategoryFilter(event.target.value)}>
                      {bedCategoryOptions.map((option) => (
                        <option key={`bed-category-${option}`} value={option}>{option}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Inventory ranking mode" info="Rank inventory signals by largest fulfillment gap or highest pressure index." /></Form.Label>
                    <Form.Select size="sm" value={inventorySortMode} onChange={(event) => setInventorySortMode(event.target.value as 'gap' | 'pressure')}>
                      <option value="gap">Largest Gap</option>
                      <option value="pressure">Highest Pressure</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Facility ranking mode" info="Rank facilities by largest shortage or lowest availability to guide rapid support routing." /></Form.Label>
                    <Form.Select size="sm" value={facilitySortMode} onChange={(event) => setFacilitySortMode(event.target.value as 'shortage' | 'availability')}>
                      <option value="shortage">Largest Shortage</option>
                      <option value="availability">Lowest Availability</option>
                    </Form.Select>
                  </Col>
                </Row>

                <div className="small text-muted mb-2">
                  Command cues: {watchOnlyMode ? 'watchlist-only mode active' : 'all watch states shown'} · {escalationOnlyMode ? 'escalation-only mode active' : 'all escalation states shown'} · {continuityStatusLabel}.
                </div>

                <Card className="border-0 bg-body-tertiary mb-2">
                  <Card.Body className="py-2">
                    <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
                      <span>Command Pressure Radar</span>
                      <span className="text-muted">{commandRadarLocationSignal ? commandRadarLocationSignal.locationName : 'No location'}</span>
                    </div>
                    {commandRadarData.length === 0 ? (
                      <div className="small text-muted">No command signal available for radar profiling.</div>
                    ) : (
                      <div style={{ width: '100%', height: 220 }}>
                        <ResponsiveContainer>
                          <RadarChart data={commandRadarData} outerRadius={82}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar dataKey="value" stroke="var(--ipoc-chart-series-1)" fill="var(--ipoc-chart-series-1)" fillOpacity={0.35} />
                            <Tooltip />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div className="small text-muted mt-1">Profiles active command load across inventory, shortage, composite risk, and lane pressure.</div>
                  </Card.Body>
                </Card>

                <Card className="border-0 bg-body-tertiary mb-2">
                  <Card.Body className="py-2">
                    <div className="small fw-semibold mb-2">Data Continuity Timeline (Live vs Overlay)</div>
                    {continuityTimeline.length < 2 ? (
                      <div className="small text-muted">Awaiting enough data transitions to chart continuity trend.</div>
                    ) : (
                      <div style={{ width: '100%', height: 190 }}>
                        <ResponsiveContainer>
                          <LineChart data={continuityTimeline}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="tick" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="liveInventoryCount" stroke="var(--ipoc-chart-series-1)" strokeWidth={2} dot={false} name="Live Inventory Rows" />
                            <Line type="monotone" dataKey="liveBedCount" stroke="var(--ipoc-chart-success)" strokeWidth={2} dot={false} name="Live Bed Rows" />
                            <Line type="monotone" dataKey="constrainedCount" stroke="var(--ipoc-chart-series-4)" dot={false} name="Constrained Lanes" />
                            <Line type="monotone" dataKey="shortageCount" stroke="var(--ipoc-chart-warning)" dot={false} name="Shortage Signals" />
                            <Line type="stepAfter" dataKey="overlayActive" stroke="var(--ipoc-chart-critical)" strokeWidth={2} dot={false} name="Overlay Active (1/0)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div className="small text-muted mt-1">Tracks live-feed volume and overlay activation state across recent refresh transitions.</div>
                  </Card.Body>
                </Card>

                <Card className="border-0 bg-body-tertiary mb-2">
                  <Card.Body className="py-2">
                    <div className="small fw-semibold mb-2">Top Location Constraint Trend</div>
                    {(logisticsChartData.length === 0 && legacyLogisticsChartData.length === 0) ? (
                      <div className="small text-muted">No location constraint data available for charting.</div>
                    ) : (
                      <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer>
                          <BarChart
                            data={logisticsChartData.length > 0 ? logisticsChartData : legacyLogisticsChartData}
                            onClick={(state) => handleLocationChartClick((state as { activePayload?: Array<{ payload?: LogisticsChartPoint }> } | undefined)?.activePayload?.[0]?.payload)}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="location" interval={0} angle={-20} textAnchor="end" height={55} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend onClick={(entry) => handleToggleSeries((entry as { dataKey?: string } | undefined)?.dataKey)} />
                            <Bar dataKey="inventoryGap" fill="var(--ipoc-chart-series-1)" name="Inventory Gap" hide={hiddenChartSeries.includes('inventoryGap')} />
                            <Bar dataKey="shortageGap" fill="var(--ipoc-chart-neutral)" name="Shortage Gap" hide={hiddenChartSeries.includes('shortageGap')} />
                            <Bar dataKey="riskScore" fill="var(--ipoc-chart-success)" name="Risk Score" hide={hiddenChartSeries.includes('riskScore')} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div className="small text-muted mt-1">Click a bar group to focus that location on the logistics map. Click legend labels to toggle series visibility.</div>
                  </Card.Body>
                </Card>

                <Card className="border-0 bg-body-tertiary mb-2">
                  <Card.Body className="py-2">
                    <div className="small fw-semibold mb-2">Location Risk Distribution</div>
                    {riskDistributionChartData.length === 0 ? (
                      <div className="small text-muted">No risk distribution data available.</div>
                    ) : (
                      <div className="small">
                        {riskDistributionChartData.map((entry, index) => {
                          const total = riskDistributionChartData.reduce((sum, item) => sum + item.value, 0);
                          const widthPercent = total > 0 ? Math.round((entry.value / total) * 100) : 0;

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

                <Card className="border-0 bg-body-tertiary mb-2">
                  <Card.Body className="py-2">
                    <div className="small fw-semibold mb-2">Watchlist vs Escalation Workload</div>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer>
                        <BarChart data={flaggedWorkloadChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="bucket" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="flagged" stackId="workload" fill="var(--ipoc-chart-series-1)" name="Flagged" />
                          <Bar dataKey="unflagged" stackId="workload" fill="var(--ipoc-chart-neutral)" name="Unflagged" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="small text-muted mt-1">Shows command workload distribution between flagged and unflagged triage items.</div>
                  </Card.Body>
                </Card>

                <div className="small fw-semibold mt-2 mb-1 d-flex align-items-center justify-content-between">
                  <span>Constrained inventory lanes</span>
                  <span className="text-muted">Watchlist: {stagingWatchIds.length}</span>
                </div>
                <div className="small text-muted mb-2 d-flex align-items-center justify-content-end">
                  <IconActionButton
                    iconClassName="bi bi-x-circle"
                    tooltip="Clear staging watchlist"
                    ariaLabel="Clear staging watchlist"
                    onClick={() => setStagingWatchIds([])}
                    variant="outline-secondary"
                    disabled={!canManageLogisticsActions || stagingWatchIds.length === 0}
                  />
                </div>
                {constrainedInventoryTop.length === 0 ? (
                  <div className="small text-muted">No inventory records matched current filters.</div>
                ) : (
                  <ListGroup variant="flush">
                    {constrainedInventoryTop.map((item) => (
                      <ListGroup.Item key={`logistics-constraint-${item.key}`} className="px-0 py-1 small d-flex justify-content-between align-items-center">
                        <span>
                          {item.locationName} · {item.resourceTypeName}
                          <div className="text-muted">{constrainedInventorySignals.length > 0 ? `Gap ${item.gap} · ` : ''}Pressure {item.pressurePercent}%</div>
                        </span>
                        <IconActionButton
                          iconClassName={stagingWatchIds.includes(item.key) ? 'bi bi-bookmark-check' : 'bi bi-bookmark-plus'}
                          tooltip={stagingWatchIds.includes(item.key) ? 'Remove from staging watchlist' : 'Add to staging watchlist'}
                          ariaLabel={stagingWatchIds.includes(item.key) ? 'Remove lane from staging watchlist' : 'Add lane to staging watchlist'}
                          onClick={() => toggleStagingWatch(item.key)}
                          variant="outline-primary"
                          disabled={!canManageLogisticsActions}
                        />
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}

                <div className="small fw-semibold mt-3 mb-1 d-flex align-items-center justify-content-between">
                  <span>Facility shortage signals</span>
                  <span className="text-muted">Escalations: {shortageEscalationIds.length}</span>
                </div>
                <div className="small text-muted mb-2 d-flex align-items-center justify-content-end">
                  <IconActionButton
                    iconClassName="bi bi-x-circle"
                    tooltip="Clear shortage escalation queue"
                    ariaLabel="Clear shortage escalation queue"
                    onClick={() => setShortageEscalationIds([])}
                    variant="outline-secondary"
                    disabled={!canManageLogisticsActions || shortageEscalationIds.length === 0}
                  />
                </div>
                {shortageFacilitiesTop.length === 0 ? (
                  <div className="small text-muted">No bed capacity records matched current filters.</div>
                ) : (
                  <ListGroup variant="flush">
                    {shortageFacilitiesTop.map((item) => (
                      <ListGroup.Item key={`logistics-shortage-${item.key}`} className="px-0 py-1 small d-flex justify-content-between align-items-center">
                        <span>
                          {item.locationName} · {item.bedCategoryCode}
                          <div className="text-muted">{shortageFacilitySignals.length > 0 ? `Shortage ${item.shortage} · ` : ''}Availability {item.availabilityPercent}%</div>
                        </span>
                        <IconActionButton
                          iconClassName={shortageEscalationIds.includes(item.key) ? 'bi bi-flag-fill' : 'bi bi-flag'}
                          tooltip={shortageEscalationIds.includes(item.key) ? 'Remove shortage escalation flag' : 'Add shortage escalation flag'}
                          ariaLabel={shortageEscalationIds.includes(item.key) ? 'Remove shortage escalation flag' : 'Add shortage escalation flag'}
                          onClick={() => toggleShortageEscalation(item.key)}
                          variant="outline-secondary"
                          disabled={!canManageLogisticsActions}
                        />
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}

export default LogisticsCoordinationCard;

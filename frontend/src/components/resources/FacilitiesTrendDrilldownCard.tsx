import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, Col, Form, Row } from 'react-bootstrap';
import type { ColDef } from 'ag-grid-community';
import { getUserReportPresets, upsertUserReportPreset } from '../../api';
import LabelWithInfo from '../common/LabelWithInfo';
import IconActionButton from '../common/IconActionButton';
import IpocDataGrid from '../common/IpocDataGrid';
import type { NotifyHandler } from '../../notifications/types';
import type { BedAvailabilityItem, ResourceInventoryItem } from '../../types';

type TrendMetric = 'bedsAvailable' | 'bedsOccupied' | 'staffedBedsTotal' | 'surgeBedsPotential';

type FacilitiesTrendDrilldownCardProps = {
  bedAvailability: BedAvailabilityItem[];
  resourceInventory: ResourceInventoryItem[];
  isAuthenticated: boolean;
  onNotify?: NotifyHandler;
};

const FACILITIES_TREND_SETTINGS_SCOPE = 'facilities-trend-drilldown-v1';
const FACILITIES_TREND_SETTINGS_NAME = 'default';

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function metricLabel(metric: TrendMetric): string {
  switch (metric) {
    case 'bedsAvailable':
      return 'Beds Available';
    case 'bedsOccupied':
      return 'Beds Occupied';
    case 'staffedBedsTotal':
      return 'Staffed Beds';
    case 'surgeBedsPotential':
      return 'Surge Potential';
    default:
      return metric;
  }
}

function metricValue(item: BedAvailabilityItem, metric: TrendMetric): number {
  if (metric === 'bedsAvailable') {
    return item.bedsAvailable ?? 0;
  }

  if (metric === 'bedsOccupied') {
    return item.bedsOccupied ?? 0;
  }

  if (metric === 'staffedBedsTotal') {
    return item.staffedBedsTotal ?? 0;
  }

  return item.surgeBedsPotential ?? 0;
}

function projectTrendValues(values: number[], stepsAhead: number[]): Record<number, number> {
  const projections: Record<number, number> = {};

  if (values.length === 0) {
    stepsAhead.forEach((step) => {
      projections[step] = 0;
    });
    return projections;
  }

  if (values.length === 1) {
    stepsAhead.forEach((step) => {
      projections[step] = Math.max(0, Math.round(values[0]));
    });
    return projections;
  }

  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const xCentered = i - xMean;
    numerator += xCentered * (values[i] - yMean);
    denominator += xCentered * xCentered;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  stepsAhead.forEach((step) => {
    const projectedIndex = (n - 1) + step;
    projections[step] = Math.max(0, Math.round(intercept + slope * projectedIndex));
  });

  return projections;
}

function FacilitiesTrendDrilldownCard({ bedAvailability, resourceInventory, isAuthenticated, onNotify }: FacilitiesTrendDrilldownCardProps) {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('bedsAvailable');
  const [trendWindow, setTrendWindow] = useState(12);
  const [occupancyAlertThresholdPercent, setOccupancyAlertThresholdPercent] = useState(85);
  const [availableAlertFloorPercent, setAvailableAlertFloorPercent] = useState(15);
  const [settingsReady, setSettingsReady] = useState(false);
  const lastAlertKeyRef = useRef('');

  useEffect(() => {
    const raw = localStorage.getItem('ipoc.facilitiesTrendDrilldown.settings');
    if (!raw) {
      setSettingsReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        selectedLocation?: string;
        trendMetric?: TrendMetric;
        trendWindow?: number;
        occupancyAlertThresholdPercent?: number;
        availableAlertFloorPercent?: number;
      };

      if (parsed.selectedLocation) {
        setSelectedLocation(parsed.selectedLocation);
      }

      if (parsed.trendMetric === 'bedsAvailable' || parsed.trendMetric === 'bedsOccupied' || parsed.trendMetric === 'staffedBedsTotal' || parsed.trendMetric === 'surgeBedsPotential') {
        setTrendMetric(parsed.trendMetric);
      }

      if (parsed.trendWindow === 12 || parsed.trendWindow === 24 || parsed.trendWindow === 48) {
        setTrendWindow(parsed.trendWindow);
      }

      if (typeof parsed.occupancyAlertThresholdPercent === 'number' && Number.isFinite(parsed.occupancyAlertThresholdPercent)) {
        setOccupancyAlertThresholdPercent(Math.min(100, Math.max(1, Math.round(parsed.occupancyAlertThresholdPercent))));
      }

      if (typeof parsed.availableAlertFloorPercent === 'number' && Number.isFinite(parsed.availableAlertFloorPercent)) {
        setAvailableAlertFloorPercent(Math.min(100, Math.max(1, Math.round(parsed.availableAlertFloorPercent))));
      }
    } catch {
      // Ignore malformed local settings.
    }

    setSettingsReady(true);
  }, []);

  const locationOptions = useMemo(() => {
    const names = new Set<string>();
    bedAvailability.forEach((item) => names.add(item.locationName));
    resourceInventory.forEach((item) => names.add(item.locationName));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [bedAvailability, resourceInventory]);

  useEffect(() => {
    if (locationOptions.length === 0) {
      setSelectedLocation('');
      return;
    }

    if (!selectedLocation || !locationOptions.includes(selectedLocation)) {
      setSelectedLocation(locationOptions[0]);
    }
  }, [locationOptions, selectedLocation]);

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    localStorage.setItem('ipoc.facilitiesTrendDrilldown.settings', JSON.stringify({
      selectedLocation,
      trendMetric,
      trendWindow,
      occupancyAlertThresholdPercent,
      availableAlertFloorPercent,
    }));
  }, [
    availableAlertFloorPercent,
    occupancyAlertThresholdPercent,
    selectedLocation,
    settingsReady,
    trendMetric,
    trendWindow,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !settingsReady) {
      return;
    }

    let cancelled = false;

    const loadServerSettings = async () => {
      try {
        const presets = await getUserReportPresets(FACILITIES_TREND_SETTINGS_SCOPE);
        const preset = presets.find((item) => item.presetName === FACILITIES_TREND_SETTINGS_NAME) ?? presets[0] ?? null;

        if (!preset?.presetJson) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          selectedLocation?: string;
          trendMetric?: TrendMetric;
          trendWindow?: number;
          occupancyAlertThresholdPercent?: number;
          availableAlertFloorPercent?: number;
        };

        if (cancelled) {
          return;
        }

        if (parsed.selectedLocation) {
          setSelectedLocation(parsed.selectedLocation);
        }

        if (parsed.trendMetric === 'bedsAvailable' || parsed.trendMetric === 'bedsOccupied' || parsed.trendMetric === 'staffedBedsTotal' || parsed.trendMetric === 'surgeBedsPotential') {
          setTrendMetric(parsed.trendMetric);
        }

        if (parsed.trendWindow === 12 || parsed.trendWindow === 24 || parsed.trendWindow === 48) {
          setTrendWindow(parsed.trendWindow);
        }

        if (typeof parsed.occupancyAlertThresholdPercent === 'number' && Number.isFinite(parsed.occupancyAlertThresholdPercent)) {
          setOccupancyAlertThresholdPercent(Math.min(100, Math.max(1, Math.round(parsed.occupancyAlertThresholdPercent))));
        }

        if (typeof parsed.availableAlertFloorPercent === 'number' && Number.isFinite(parsed.availableAlertFloorPercent)) {
          setAvailableAlertFloorPercent(Math.min(100, Math.max(1, Math.round(parsed.availableAlertFloorPercent))));
        }
      } catch {
        // Keep local settings when server settings are unavailable.
      }
    };

    void loadServerSettings();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, settingsReady]);

  useEffect(() => {
    if (!isAuthenticated || !settingsReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const payload = {
        selectedLocation,
        trendMetric,
        trendWindow,
        occupancyAlertThresholdPercent,
        availableAlertFloorPercent,
      };

      void upsertUserReportPreset(FACILITIES_TREND_SETTINGS_SCOPE, {
        presetName: FACILITIES_TREND_SETTINGS_NAME,
        presetJson: JSON.stringify(payload),
      }).catch(() => {
        // Keep local settings if server write fails.
      });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    availableAlertFloorPercent,
    isAuthenticated,
    occupancyAlertThresholdPercent,
    selectedLocation,
    settingsReady,
    trendMetric,
    trendWindow,
  ]);

  const trendRows = useMemo(() => {
    if (!selectedLocation) {
      return [] as BedAvailabilityItem[];
    }

    return bedAvailability
      .filter((item) => item.locationName === selectedLocation)
      .sort((a, b) => Date.parse(a.reportedUtc) - Date.parse(b.reportedUtc))
      .slice(-trendWindow);
  }, [bedAvailability, selectedLocation, trendWindow]);

  const trendValues = useMemo(() => trendRows.map((item) => metricValue(item, trendMetric)), [trendRows, trendMetric]);

  const snapshotIntervalHours = useMemo(() => {
    if (trendRows.length < 2) {
      return 1;
    }

    let totalMs = 0;
    let count = 0;

    for (let index = 1; index < trendRows.length; index += 1) {
      const prior = Date.parse(trendRows[index - 1].reportedUtc);
      const current = Date.parse(trendRows[index].reportedUtc);
      const delta = current - prior;
      if (Number.isFinite(delta) && delta > 0) {
        totalMs += delta;
        count += 1;
      }
    }

    if (count === 0) {
      return 1;
    }

    return Math.max(1, totalMs / count / (1000 * 60 * 60));
  }, [trendRows]);

  const forecastHorizonSteps = useMemo(() => {
    const toSteps = (hours: number) => Math.max(1, Math.round(hours / snapshotIntervalHours));
    return {
      in24h: toSteps(24),
      in48h: toSteps(48),
      in72h: toSteps(72),
    };
  }, [snapshotIntervalHours]);

  const forecastValues = useMemo(() => {
    const projected = projectTrendValues(trendValues, [forecastHorizonSteps.in24h, forecastHorizonSteps.in48h, forecastHorizonSteps.in72h]);
    return {
      in24h: projected[forecastHorizonSteps.in24h] ?? 0,
      in48h: projected[forecastHorizonSteps.in48h] ?? 0,
      in72h: projected[forecastHorizonSteps.in72h] ?? 0,
    };
  }, [forecastHorizonSteps.in24h, forecastHorizonSteps.in48h, forecastHorizonSteps.in72h, trendValues]);

  const maxTrendValue = useMemo(() => {
    if (trendValues.length === 0) {
      return 1;
    }

    return Math.max(...trendValues, 1);
  }, [trendValues]);

  const latestSnapshot = useMemo(() => {
    if (trendRows.length === 0) {
      return null;
    }

    return trendRows[trendRows.length - 1];
  }, [trendRows]);

  const historyDrillRows = useMemo(() => {
    return trendRows.map((item) => {
      const staffed = item.staffedBedsTotal ?? 0;
      const available = item.bedsAvailable ?? 0;
      const occupied = item.bedsOccupied ?? 0;
      const occupancyPercent = staffed > 0 ? Math.round((occupied / staffed) * 100) : 0;
      const availablePercent = staffed > 0 ? Math.round((available / staffed) * 100) : 0;

      let risk: 'normal' | 'watch' | 'critical' = 'normal';
      if (occupancyPercent >= occupancyAlertThresholdPercent || availablePercent <= availableAlertFloorPercent) {
        risk = 'critical';
      } else if (occupancyPercent >= Math.max(1, occupancyAlertThresholdPercent - 10) || availablePercent <= Math.min(99, availableAlertFloorPercent + 10)) {
        risk = 'watch';
      }

      return {
        key: `${item.bedAvailabilitySnapshotId}-${item.reportedUtc}`,
        reportedUtc: item.reportedUtc,
        staffed,
        available,
        occupied,
        occupancyPercent,
        availablePercent,
        risk,
      };
    });
  }, [availableAlertFloorPercent, occupancyAlertThresholdPercent, trendRows]);

  useEffect(() => {
    if (!onNotify || !selectedLocation || !latestSnapshot) {
      return;
    }

    const staffed = latestSnapshot.staffedBedsTotal ?? 0;
    const available = latestSnapshot.bedsAvailable ?? 0;
    const occupied = latestSnapshot.bedsOccupied ?? 0;
    const occupancyPercent = staffed > 0 ? Math.round((occupied / staffed) * 100) : 0;
    const availablePercent = staffed > 0 ? Math.round((available / staffed) * 100) : 0;

    const occupancyTriggered = occupancyPercent >= occupancyAlertThresholdPercent;
    const availabilityTriggered = availablePercent <= availableAlertFloorPercent;

    if (!occupancyTriggered && !availabilityTriggered) {
      return;
    }

    const alertKey = `${selectedLocation}|${latestSnapshot.bedAvailabilitySnapshotId}|${occupancyAlertThresholdPercent}|${availableAlertFloorPercent}`;
    if (lastAlertKeyRef.current === alertKey) {
      return;
    }

    lastAlertKeyRef.current = alertKey;
    onNotify(
      `Bed capacity alert: ${selectedLocation} occupancy ${occupancyPercent}% / available ${availablePercent}% (thresholds: occ >= ${occupancyAlertThresholdPercent}%, avail <= ${availableAlertFloorPercent}%).`,
      'warning',
    );
  }, [availableAlertFloorPercent, latestSnapshot, occupancyAlertThresholdPercent, onNotify, selectedLocation]);

  const locationResourceRows = useMemo(() => {
    if (!selectedLocation) {
      return [] as ResourceInventoryItem[];
    }

    return resourceInventory.filter((item) => item.locationName === selectedLocation);
  }, [resourceInventory, selectedLocation]);

  const topConstraintRows = useMemo(() => {
    return locationResourceRows
      .map((item) => {
        const total = Number(item.quantityTotal);
        const available = Number(item.quantityAvailable);
        const availabilityPercent = total > 0 ? Math.round((available / total) * 100) : 0;
        return {
          key: `${item.locationResourceInventoryId}`,
          resourceTypeName: item.resourceTypeName,
          available,
          total,
          availabilityPercent,
        };
      })
      .sort((a, b) => a.availabilityPercent - b.availabilityPercent || a.resourceTypeName.localeCompare(b.resourceTypeName))
      .slice(0, 8);
  }, [locationResourceRows]);

  const trendCsv = useMemo(() => {
    const lines = ['ReportedUtc,BedCategory,Metric,Value'];
    trendRows.forEach((item) => {
      const value = metricValue(item, trendMetric);
      lines.push(`"${item.reportedUtc}","${item.bedCategoryCode}","${metricLabel(trendMetric)}",${value}`);
    });

    return lines.join('\n');
  }, [trendMetric, trendRows]);

  const constraintsCsv = useMemo(() => {
    const lines = ['ResourceType,Available,Total,AvailabilityPercent'];
    topConstraintRows.forEach((row) => {
      const safeType = row.resourceTypeName.replace(/"/g, '""');
      lines.push(`"${safeType}",${row.available},${row.total},${row.availabilityPercent}`);
    });

    return lines.join('\n');
  }, [topConstraintRows]);

  const constraintGridRows = useMemo(() => topConstraintRows.map((row) => ({
    id: row.key,
    resourceTypeName: row.resourceTypeName,
    available: row.available,
    total: row.total,
    availabilityPercent: row.availabilityPercent,
  })), [topConstraintRows]);

  const constraintColumnDefs: ColDef<(typeof constraintGridRows)[number]>[] = useMemo(() => [
    {
      field: 'resourceTypeName',
      headerName: 'Resource Type',
      minWidth: 180,
      flex: 1.4,
    },
    {
      field: 'available',
      headerName: 'Available',
      minWidth: 110,
      flex: 0.9,
      type: 'numericColumn',
      cellClass: 'text-end',
      valueFormatter: (params) => Number(params.value ?? 0).toFixed(0),
    },
    {
      field: 'total',
      headerName: 'Total',
      minWidth: 110,
      flex: 0.9,
      type: 'numericColumn',
      cellClass: 'text-end',
      valueFormatter: (params) => Number(params.value ?? 0).toFixed(0),
    },
    {
      field: 'availabilityPercent',
      headerName: 'Availability',
      minWidth: 120,
      flex: 1,
      type: 'numericColumn',
      cellClass: 'text-end fw-semibold',
      valueFormatter: (params) => `${params.value ?? 0}%`,
    },
  ], []);

  const historyGridRows = useMemo(() => historyDrillRows.map((row) => ({
    id: row.key,
    reportedUtc: row.reportedUtc,
    staffed: row.staffed,
    available: row.available,
    occupied: row.occupied,
    occupancyPercent: row.occupancyPercent,
    availablePercent: row.availablePercent,
    risk: row.risk === 'critical' ? 'Critical' : row.risk === 'watch' ? 'Watch' : 'Normal',
  })), [historyDrillRows]);

  const historyColumnDefs: ColDef<(typeof historyGridRows)[number]>[] = useMemo(() => [
    {
      field: 'reportedUtc',
      headerName: 'Reported',
      minWidth: 190,
      flex: 1.4,
      sort: 'desc',
      valueFormatter: (params) => new Date(String(params.value)).toLocaleString(),
    },
    { field: 'staffed', headerName: 'Staffed', minWidth: 100, flex: 0.8, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'available', headerName: 'Available', minWidth: 100, flex: 0.8, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'occupied', headerName: 'Occupied', minWidth: 100, flex: 0.8, type: 'numericColumn', cellClass: 'text-end' },
    {
      field: 'occupancyPercent',
      headerName: 'Occupancy',
      minWidth: 110,
      flex: 0.9,
      type: 'numericColumn',
      cellClass: 'text-end',
      valueFormatter: (params) => `${params.value ?? 0}%`,
    },
    {
      field: 'availablePercent',
      headerName: 'Available %',
      minWidth: 110,
      flex: 0.9,
      type: 'numericColumn',
      cellClass: 'text-end',
      valueFormatter: (params) => `${params.value ?? 0}%`,
    },
    { field: 'risk', headerName: 'Risk', minWidth: 110, flex: 0.8 },
  ], []);

  return (
    <Card className="shadow-sm mb-3">
      <Card.Header className="fw-semibold">Facility Trend and Drilldown</Card.Header>
      <Card.Body>
        <Row className="g-2 mb-3 align-items-end">
          <Col md={4}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Location" info="Select the facility for trend and drilldown analysis." /></Form.Label>
            <Form.Select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
              {locationOptions.length === 0 && <option value="">No locations</option>}
              {locationOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Trend metric" info="Choose which bed metric to chart over time." /></Form.Label>
            <Form.Select value={trendMetric} onChange={(e) => setTrendMetric(e.target.value as TrendMetric)}>
              <option value="bedsAvailable">Beds Available</option>
              <option value="bedsOccupied">Beds Occupied</option>
              <option value="staffedBedsTotal">Staffed Beds</option>
              <option value="surgeBedsPotential">Surge Potential</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Trend window" info="Select the number of recent snapshots included in the trend." /></Form.Label>
            <Form.Select value={trendWindow} onChange={(e) => setTrendWindow(Number(e.target.value))}>
              <option value={12}>Last 12 snapshots</option>
              <option value={24}>Last 24 snapshots</option>
              <option value={48}>Last 48 snapshots</option>
            </Form.Select>
          </Col>
          <Col md={2}>
            <Badge bg="secondary">Points: {trendRows.length}</Badge>
          </Col>
        </Row>

        <Row className="g-2 mb-3 align-items-end">
          <Col md={3}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Occ. alert threshold %" info="Alert threshold for occupancy percentage." /></Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={100}
              value={occupancyAlertThresholdPercent}
              onChange={(e) => setOccupancyAlertThresholdPercent(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Col>
          <Col md={3}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Avail. alert floor %" info="Minimum resource availability percentage before triggering risk indicators." /></Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={100}
              value={availableAlertFloorPercent}
              onChange={(e) => setAvailableAlertFloorPercent(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Col>
        </Row>

        <div className="d-flex justify-content-end gap-2 mb-2">
          <IconActionButton
            iconClassName="bi bi-graph-up-arrow"
            tooltip="Export trend data to CSV"
            ariaLabel="Export trend CSV"
            onClick={() => downloadCsv('facility-trend.csv', trendCsv)}
            variant="outline-secondary"
            disabled={trendRows.length === 0}
          />
          <IconActionButton
            iconClassName="bi bi-file-earmark-spreadsheet"
            tooltip="Export constraints data to CSV"
            ariaLabel="Export constraints CSV"
            onClick={() => downloadCsv('facility-constraints.csv', constraintsCsv)}
            variant="outline-secondary"
            disabled={topConstraintRows.length === 0}
          />
        </div>

        <Row className="g-3">
          <Col lg={7}>
            <div className="analytics-shell mb-2">
              <div className="small fw-semibold mb-2">{metricLabel(trendMetric)} trend</div>
              {trendRows.length === 0 ? (
                <div className="text-muted small">No snapshots available for this location.</div>
              ) : (
                <div className="d-flex align-items-end gap-1" style={{ height: 130 }}>
                  {trendRows.map((item, index) => {
                    const value = metricValue(item, trendMetric);
                    const heightPercent = Math.max(4, Math.round((value / maxTrendValue) * 100));
                    const barClassIndex = index % 4;

                    return (
                      <div key={`${item.bedAvailabilitySnapshotId}-${item.reportedUtc}-${index}`} className="d-flex flex-column align-items-center" style={{ width: `${100 / trendRows.length}%` }}>
                        <div className="analytics-track w-100" style={{ height: 104 }}>
                          <div className={`analytics-bar analytics-bar-${barClassIndex}`} style={{ height: `${heightPercent}%`, marginTop: `${100 - heightPercent}%` }} />
                        </div>
                        <div className="small text-muted mt-1" style={{ fontSize: '0.65rem' }}>{new Date(item.reportedUtc).toLocaleDateString()}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="analytics-shell">
              <div className="small fw-semibold mb-2">Projected {metricLabel(trendMetric)} (24/48/72h)</div>
              {trendRows.length === 0 ? (
                <div className="text-muted small">Not enough snapshots to calculate a forecast.</div>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  <Badge bg="secondary">24h: {forecastValues.in24h}</Badge>
                  <Badge bg="secondary">48h: {forecastValues.in48h}</Badge>
                  <Badge bg="secondary">72h: {forecastValues.in72h}</Badge>
                </div>
              )}
            </div>
          </Col>

          <Col lg={5}>
            <Card className="h-100">
              <Card.Body>
                <div className="fw-semibold mb-2">Latest Capacity Snapshot</div>
                {!latestSnapshot && <div className="text-muted small">No bed snapshot available.</div>}
                {latestSnapshot && (
                  <div className="d-flex flex-wrap gap-2">
                    <Badge bg="secondary">Staffed: {latestSnapshot.staffedBedsTotal ?? 0}</Badge>
                    <Badge bg="primary">Available: {latestSnapshot.bedsAvailable ?? 0}</Badge>
                    <Badge bg="danger">Occupied: {latestSnapshot.bedsOccupied ?? 0}</Badge>
                    <Badge bg="info" text="dark">Surge: {latestSnapshot.surgeBedsPotential ?? 0}</Badge>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <div className="mt-3 fw-semibold">Resource Constraint Drilldown</div>
        <div className="mt-2">
          <IpocDataGrid
            gridId="facilities-trend-constraints"
            rowData={constraintGridRows}
            columnDefs={constraintColumnDefs}
            emptyMessage="No resource inventory rows for selected location."
            pageSize={10}
          />
        </div>

        <div className="mt-3 fw-semibold">Bed Availability History Drill-In</div>
        <div className="mt-2">
          <IpocDataGrid
            gridId="facilities-trend-history"
            rowData={historyGridRows}
            columnDefs={historyColumnDefs}
            emptyMessage="No bed history snapshots for selected location."
            pageSize={12}
          />
        </div>
      </Card.Body>
    </Card>
  );
}

export default FacilitiesTrendDrilldownCard;

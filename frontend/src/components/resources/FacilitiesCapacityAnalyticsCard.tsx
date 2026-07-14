import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Col, Form, Row } from 'react-bootstrap';
import type { ColDef } from 'ag-grid-community';
import { deleteUserReportPreset, getUserReportPresets, upsertUserReportPreset } from '../../api';
import LabelWithInfo from '../common/LabelWithInfo';
import IconActionButton from '../common/IconActionButton';
import IpocDataGrid from '../common/IpocDataGrid';
import type { BedAvailabilityItem, ResourceInventoryItem } from '../../types';

type CapacityGroupMode = 'location' | 'resourceType';

type FacilitiesCapacityAnalyticsCardProps = {
  resourceInventory: ResourceInventoryItem[];
  bedAvailability: BedAvailabilityItem[];
  isAuthenticated: boolean;
};

type FacilitiesReportPreset = {
  id: string;
  name: string;
  groupMode: CapacityGroupMode;
  locationFilter: string;
  occupancyThresholdPercent: number;
  resourceAvailabilityThresholdPercent: number;
  userReportPresetId?: number;
};

const FACILITIES_PRESET_SCOPE = 'facilities-capacity-v1';

type CapacityRow = {
  key: string;
  staffedBeds: number;
  bedsAvailable: number;
  bedsOccupied: number;
  surgeBeds: number;
  resourceAvailable: number;
  resourceTotal: number;
};

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

function FacilitiesCapacityAnalyticsCard({ resourceInventory, bedAvailability, isAuthenticated }: FacilitiesCapacityAnalyticsCardProps) {
  const [groupMode, setGroupMode] = useState<CapacityGroupMode>('location');
  const [locationFilter, setLocationFilter] = useState('All');
  const [occupancyThresholdPercent, setOccupancyThresholdPercent] = useState(80);
  const [resourceAvailabilityThresholdPercent, setResourceAvailabilityThresholdPercent] = useState(35);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [presets, setPresets] = useState<FacilitiesReportPreset[]>(() => {
    const raw = localStorage.getItem('ipoc.facilitiesReportPresets');
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as FacilitiesReportPreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadServerPresets = async () => {
      try {
        const serverPresets = await getUserReportPresets(FACILITIES_PRESET_SCOPE);
        const mapped: FacilitiesReportPreset[] = [];

        serverPresets.forEach((preset) => {
          try {
            const parsed = JSON.parse(preset.presetJson) as Partial<FacilitiesReportPreset>;
            mapped.push({
              id: `server-${preset.userReportPresetId}`,
              name: preset.presetName,
              groupMode: parsed.groupMode === 'resourceType' ? 'resourceType' : 'location',
              locationFilter: typeof parsed.locationFilter === 'string' ? parsed.locationFilter : 'All',
              occupancyThresholdPercent: typeof parsed.occupancyThresholdPercent === 'number' ? parsed.occupancyThresholdPercent : 80,
              resourceAvailabilityThresholdPercent: typeof parsed.resourceAvailabilityThresholdPercent === 'number' ? parsed.resourceAvailabilityThresholdPercent : 35,
              userReportPresetId: preset.userReportPresetId,
            });
          } catch {
            // Skip malformed preset payloads.
          }
        });

        if (mapped.length > 0) {
          setPresets(mapped);
          localStorage.setItem('ipoc.facilitiesReportPresets', JSON.stringify(mapped));
        }
      } catch {
        // Keep local cached presets when server persistence is unavailable.
      }
    };

    void loadServerPresets();
  }, [isAuthenticated]);

  const locationOptions = useMemo(() => {
    const names = new Set<string>();
    resourceInventory.forEach((item) => names.add(item.locationName));
    bedAvailability.forEach((item) => names.add(item.locationName));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [bedAvailability, resourceInventory]);

  const rows = useMemo(() => {
    const map = new Map<string, CapacityRow>();

    resourceInventory
      .filter((item) => locationFilter === 'All' || item.locationName === locationFilter)
      .forEach((item) => {
        const key = groupMode === 'location' ? item.locationName : item.resourceTypeName;
        const existing = map.get(key) ?? {
          key,
          staffedBeds: 0,
          bedsAvailable: 0,
          bedsOccupied: 0,
          surgeBeds: 0,
          resourceAvailable: 0,
          resourceTotal: 0,
        };

        existing.resourceAvailable += Number(item.quantityAvailable);
        existing.resourceTotal += Number(item.quantityTotal);
        map.set(key, existing);
      });

    bedAvailability
      .filter((item) => locationFilter === 'All' || item.locationName === locationFilter)
      .forEach((item) => {
        const key = groupMode === 'location' ? item.locationName : item.bedCategoryCode;
        const existing = map.get(key) ?? {
          key,
          staffedBeds: 0,
          bedsAvailable: 0,
          bedsOccupied: 0,
          surgeBeds: 0,
          resourceAvailable: 0,
          resourceTotal: 0,
        };

        existing.staffedBeds += item.staffedBedsTotal ?? 0;
        existing.bedsAvailable += item.bedsAvailable ?? 0;
        existing.bedsOccupied += item.bedsOccupied ?? 0;
        existing.surgeBeds += item.surgeBedsPotential ?? 0;
        map.set(key, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.resourceAvailable - a.resourceAvailable || b.bedsAvailable - a.bedsAvailable);
  }, [bedAvailability, groupMode, locationFilter, resourceInventory]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.staffedBeds += row.staffedBeds;
        acc.bedsAvailable += row.bedsAvailable;
        acc.bedsOccupied += row.bedsOccupied;
        acc.surgeBeds += row.surgeBeds;
        acc.resourceAvailable += row.resourceAvailable;
        acc.resourceTotal += row.resourceTotal;
        return acc;
      },
      { staffedBeds: 0, bedsAvailable: 0, bedsOccupied: 0, surgeBeds: 0, resourceAvailable: 0, resourceTotal: 0 },
    );
  }, [rows]);

  const occupancyPercent = totals.staffedBeds > 0
    ? Math.round((totals.bedsOccupied / totals.staffedBeds) * 100)
    : 0;

  const atRiskFacilities = useMemo(() => {
    if (groupMode !== 'location') {
      return [] as CapacityRow[];
    }

    return rows
      .filter((row) => {
        const rowOccupancy = row.staffedBeds > 0 ? row.bedsOccupied / row.staffedBeds : 0;
        const rowAvailability = row.resourceTotal > 0 ? row.resourceAvailable / row.resourceTotal : 1;
        return rowOccupancy >= occupancyThresholdPercent / 100
          || rowAvailability <= resourceAvailabilityThresholdPercent / 100;
      })
      .slice(0, 5);
  }, [groupMode, occupancyThresholdPercent, resourceAvailabilityThresholdPercent, rows]);

  const groupedCsv = useMemo(() => {
    const lines = ['Group,BedsAvailable,BedsOccupied,SurgeBeds,ResourceAvailable,ResourceTotal'];
    rows.forEach((row) => {
      const safeGroup = row.key.replace(/"/g, '""');
      lines.push(`"${safeGroup}",${row.bedsAvailable},${row.bedsOccupied},${row.surgeBeds},${row.resourceAvailable},${row.resourceTotal}`);
    });

    return lines.join('\n');
  }, [rows]);

  const gridRows = useMemo(() => rows.map((row) => ({
    id: `${groupMode}-${row.key}`,
    groupLabel: row.key,
    bedsAvailable: row.bedsAvailable,
    bedsOccupied: row.bedsOccupied,
    surgeBeds: row.surgeBeds,
    resourceAvailable: row.resourceAvailable,
    resourceTotal: row.resourceTotal,
  })), [groupMode, rows]);

  const gridColumnDefs: ColDef<(typeof gridRows)[number]>[] = useMemo(() => [
    {
      field: 'groupLabel',
      headerName: groupMode === 'location' ? 'Location' : 'Resource Type',
      minWidth: 180,
      flex: 1.4,
    },
    {
      field: 'bedsAvailable',
      headerName: 'Beds Avail.',
      minWidth: 120,
      flex: 1,
      type: 'numericColumn',
      cellClass: 'text-end',
    },
    {
      field: 'bedsOccupied',
      headerName: 'Beds Occupied',
      minWidth: 130,
      flex: 1,
      type: 'numericColumn',
      cellClass: 'text-end',
    },
    {
      field: 'surgeBeds',
      headerName: 'Surge',
      minWidth: 100,
      flex: 0.9,
      type: 'numericColumn',
      cellClass: 'text-end',
    },
    {
      field: 'resourceAvailable',
      headerName: 'Resource Avail.',
      minWidth: 130,
      flex: 1,
      type: 'numericColumn',
      cellClass: 'text-end',
      valueFormatter: (params) => Number(params.value ?? 0).toFixed(0),
    },
    {
      field: 'resourceTotal',
      headerName: 'Resource Total',
      minWidth: 130,
      flex: 1,
      type: 'numericColumn',
      cellClass: 'text-end',
      valueFormatter: (params) => Number(params.value ?? 0).toFixed(0),
    },
  ], [groupMode]);

  const savePreset = async () => {
    const normalizedName = presetNameInput.trim();
    if (!normalizedName) {
      return;
    }

    const nextPreset: FacilitiesReportPreset = {
      id: `preset-${Date.now()}`,
      name: normalizedName,
      groupMode,
      locationFilter,
      occupancyThresholdPercent,
      resourceAvailabilityThresholdPercent,
    };

    const nextPresets = [nextPreset, ...presets].slice(0, 12);

    try {
      if (isAuthenticated) {
        const userReportPresetId = await upsertUserReportPreset(FACILITIES_PRESET_SCOPE, {
          presetName: normalizedName,
          presetJson: JSON.stringify({
            groupMode,
            locationFilter,
            occupancyThresholdPercent,
            resourceAvailabilityThresholdPercent,
          }),
        });

        const merged = nextPresets.map((preset) => {
          if (preset.id === nextPreset.id) {
            return { ...preset, id: `server-${userReportPresetId}`, userReportPresetId };
          }

          return preset;
        });

        setPresets(merged);
        localStorage.setItem('ipoc.facilitiesReportPresets', JSON.stringify(merged));
        setPresetNameInput('');
        return;
      }
    } catch {
      // Fall through to local-only persistence.
    }

    setPresets(nextPresets);
    localStorage.setItem('ipoc.facilitiesReportPresets', JSON.stringify(nextPresets));
    setPresetNameInput('');
  };

  const applyPreset = (preset: FacilitiesReportPreset) => {
    setGroupMode(preset.groupMode);
    setLocationFilter(preset.locationFilter);
    setOccupancyThresholdPercent(preset.occupancyThresholdPercent);
    setResourceAvailabilityThresholdPercent(preset.resourceAvailabilityThresholdPercent);
  };

  const deletePreset = async (preset: FacilitiesReportPreset) => {
    try {
      if (isAuthenticated && preset.userReportPresetId) {
        await deleteUserReportPreset(FACILITIES_PRESET_SCOPE, preset.userReportPresetId);
      }
    } catch {
      // Continue with local deletion to avoid blocking UI.
    }

    const next = presets.filter((item) => item.id !== preset.id);
    setPresets(next);
    localStorage.setItem('ipoc.facilitiesReportPresets', JSON.stringify(next));
  };

  return (
    <Card className="shadow-sm mb-3">
      <Card.Header className="fw-semibold">Facilities Capacity and Utilization</Card.Header>
      <Card.Body>
        <Row className="g-2 mb-3 align-items-end">
          <Col md={4}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Location filter" info="Restrict analysis to a specific location or all locations." /></Form.Label>
            <Form.Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="All">All locations</option>
              {locationOptions.map((locationName) => (
                <option key={locationName} value={locationName}>{locationName}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Occ. risk %" info="Occupancy percentage threshold used to flag at-risk facilities." /></Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={100}
              value={occupancyThresholdPercent}
              onChange={(e) => setOccupancyThresholdPercent(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Col>
          <Col md={2}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Res. risk %" info="Resource availability percentage threshold used to flag at-risk facilities." /></Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={100}
              value={resourceAvailabilityThresholdPercent}
              onChange={(e) => setResourceAvailabilityThresholdPercent(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Col>
          <Col md={8} className="d-flex justify-content-md-end">
            <div className="d-flex gap-2">
              <IconActionButton
                iconClassName="bi bi-download"
                tooltip="Export grouped facilities capacity data to CSV"
                ariaLabel="Export facilities capacity CSV"
                onClick={() => downloadCsv('facilities-capacity-grouped.csv', groupedCsv)}
                variant="outline-secondary"
                disabled={rows.length === 0}
              />

              <IconActionButton
                iconClassName="bi bi-geo-alt"
                tooltip="Group capacity analytics by location"
                ariaLabel="Group capacity analytics by location"
                onClick={() => setGroupMode('location')}
                variant={groupMode === 'location' ? 'secondary' : 'outline-secondary'}
              />
              <IconActionButton
                iconClassName="bi bi-boxes"
                tooltip="Group capacity analytics by resource type"
                ariaLabel="Group capacity analytics by resource type"
                onClick={() => setGroupMode('resourceType')}
                variant={groupMode === 'resourceType' ? 'secondary' : 'outline-secondary'}
              />
            </div>
          </Col>
        </Row>

        <Row className="g-2 mb-3 align-items-end">
          <Col md={4}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Save report preset" info="Store current filters and thresholds as a reusable report preset." /></Form.Label>
            <Form.Control
              value={presetNameInput}
              placeholder="Preset name"
              onChange={(e) => setPresetNameInput(e.target.value)}
            />
          </Col>
          <Col md="auto">
            <IconActionButton
              iconClassName="bi bi-bookmark-plus"
              tooltip="Save current filters and thresholds as a preset"
              ariaLabel="Save facilities preset"
              onClick={() => void savePreset()}
              variant="secondary"
              disabled={presetNameInput.trim().length === 0}
            />
          </Col>
          {presets.length > 0 && (
            <Col md={7}>
              <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Saved presets" info="Apply or delete previously saved report presets." /></Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <div key={preset.id} className="d-inline-flex align-items-center gap-1">
                    <IconActionButton
                      iconClassName="bi bi-bookmark-check"
                      tooltip={`Apply preset: ${preset.name}`}
                      ariaLabel={`Apply preset ${preset.name}`}
                      onClick={() => applyPreset(preset)}
                      variant="outline-secondary"
                    />
                    <IconActionButton
                      iconClassName="bi bi-trash"
                      tooltip={`Delete preset: ${preset.name}`}
                      ariaLabel={`Delete preset ${preset.name}`}
                      onClick={() => void deletePreset(preset)}
                      variant="outline-secondary"
                    />
                  </div>
                ))}
              </div>
            </Col>
          )}
        </Row>

        <div className="d-flex flex-wrap gap-2 mb-3">
          <Badge bg="secondary">Staffed Beds: {totals.staffedBeds}</Badge>
          <Badge bg="primary">Beds Available: {totals.bedsAvailable}</Badge>
          <Badge bg="danger">Occupancy: {occupancyPercent}%</Badge>
          <Badge bg="info" text="dark">Surge Capacity: {totals.surgeBeds}</Badge>
          <Badge bg="secondary">Resources Available: {totals.resourceAvailable.toFixed(0)} / {totals.resourceTotal.toFixed(0)}</Badge>
          <Badge bg="secondary">At-Risk Facilities: {atRiskFacilities.length}</Badge>
        </div>

        {groupMode === 'location' && atRiskFacilities.length > 0 && (
          <div className="analytics-shell mb-3">
            <div className="small fw-semibold mb-2">Top At-Risk Facilities</div>
            <div className="d-flex flex-wrap gap-2">
              {atRiskFacilities.map((row) => {
                const rowOccupancy = row.staffedBeds > 0 ? Math.round((row.bedsOccupied / row.staffedBeds) * 100) : 0;
                const rowAvailability = row.resourceTotal > 0 ? Math.round((row.resourceAvailable / row.resourceTotal) * 100) : 100;
                return (
                  <Badge key={`risk-${row.key}`} bg="danger">
                    {row.key}: Occ {rowOccupancy}% | Res {rowAvailability}%
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        <IpocDataGrid
          gridId="facilities-capacity-grouped"
          rowData={gridRows}
          columnDefs={gridColumnDefs}
          emptyMessage="No facilities data available for current filters."
          pageSize={25}
        />
      </Card.Body>
    </Card>
  );
}

export default FacilitiesCapacityAnalyticsCard;

import { useMemo } from 'react';
import {
  Card,
  Col,
  Form,
  Row,
  Spinner,
} from 'react-bootstrap';
import type { ColDef } from 'ag-grid-community';
import IconActionButton from '../common/IconActionButton';
import IpocDataGrid from '../common/IpocDataGrid';
import LabelWithInfo from '../common/LabelWithInfo';
import type { BedAvailabilityItem, LocationLookupValue, ResourceInventoryItem } from '../../types';

type ResourcePostureCardProps = {
  resourceLoading: boolean;
  recentResourceRows: ResourceInventoryItem[];
  selectedInventoryId: number | null;
  resourceTotalInput: string;
  resourceAvailableInput: string;
  resourceCommittedInput: string;
  resourceOutOfServiceInput: string;
  bedLocationIdInput: string;
  bedStaffedInput: string;
  bedAvailableInput: string;
  bedOccupiedInput: string;
  bedUnavailableInput: string;
  bedIsolationInput: string;
  bedSurgeInput: string;
  recentBedRows: BedAvailabilityItem[];
  locationLookups: LocationLookupValue[];
  setSelectedInventoryId: (value: number) => void;
  setResourceTotalInput: (value: string) => void;
  setResourceAvailableInput: (value: string) => void;
  setResourceCommittedInput: (value: string) => void;
  setResourceOutOfServiceInput: (value: string) => void;
  setBedLocationIdInput: (value: string) => void;
  setBedStaffedInput: (value: string) => void;
  setBedAvailableInput: (value: string) => void;
  setBedOccupiedInput: (value: string) => void;
  setBedUnavailableInput: (value: string) => void;
  setBedIsolationInput: (value: string) => void;
  setBedSurgeInput: (value: string) => void;
  onUpdateInventory: () => void;
  onAddBedSnapshot: () => void;
};

function ResourcePostureCard({
  resourceLoading,
  recentResourceRows,
  selectedInventoryId,
  resourceTotalInput,
  resourceAvailableInput,
  resourceCommittedInput,
  resourceOutOfServiceInput,
  bedLocationIdInput,
  bedStaffedInput,
  bedAvailableInput,
  bedOccupiedInput,
  bedUnavailableInput,
  bedIsolationInput,
  bedSurgeInput,
  recentBedRows,
  locationLookups,
  setSelectedInventoryId,
  setResourceTotalInput,
  setResourceAvailableInput,
  setResourceCommittedInput,
  setResourceOutOfServiceInput,
  setBedLocationIdInput,
  setBedStaffedInput,
  setBedAvailableInput,
  setBedOccupiedInput,
  setBedUnavailableInput,
  setBedIsolationInput,
  setBedSurgeInput,
  onUpdateInventory,
  onAddBedSnapshot,
}: ResourcePostureCardProps) {
  const resourceGridRows = useMemo(() => recentResourceRows.map((row) => ({
    id: row.locationResourceInventoryId,
    locationName: row.locationName,
    resourceTypeName: row.resourceTypeName,
    quantityAvailable: row.quantityAvailable,
    quantityTotal: row.quantityTotal,
    quantityCommitted: row.quantityCommitted,
    quantityOutOfService: row.quantityOutOfService,
  })), [recentResourceRows]);

  const resourceGridColumnDefs: ColDef<(typeof resourceGridRows)[number]>[] = useMemo(() => [
    { field: 'locationName', headerName: 'Location', minWidth: 170, flex: 1.2 },
    { field: 'resourceTypeName', headerName: 'Type', minWidth: 150, flex: 1.1 },
    { field: 'quantityAvailable', headerName: 'Available', minWidth: 110, flex: 0.9, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'quantityTotal', headerName: 'Total', minWidth: 100, flex: 0.8, type: 'numericColumn', cellClass: 'text-end' },
    {
      colId: 'select',
      headerName: '',
      minWidth: 72,
      maxWidth: 88,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof resourceGridRows)[number] }) => {
        if (!params.data) {
          return null;
        }

        return (
          <div className="text-end">
            <IconActionButton
              iconClassName="bi bi-check2"
              tooltip="Select this inventory row for editing"
              ariaLabel="Select inventory row"
              onClick={() => {
                setSelectedInventoryId(params.data?.id ?? 0);
                setResourceTotalInput(String(params.data?.quantityTotal ?? ''));
                setResourceAvailableInput(String(params.data?.quantityAvailable ?? ''));
                setResourceCommittedInput(String(params.data?.quantityCommitted ?? ''));
                setResourceOutOfServiceInput(String(params.data?.quantityOutOfService ?? ''));
              }}
              variant={selectedInventoryId === params.data.id ? 'secondary' : 'outline-secondary'}
            />
          </div>
        );
      },
    },
  ], [selectedInventoryId, setResourceAvailableInput, setResourceCommittedInput, setResourceOutOfServiceInput, setResourceTotalInput, setSelectedInventoryId]);

  const bedGridRows = useMemo(() => recentBedRows.map((row) => ({
    id: row.bedAvailabilitySnapshotId,
    reportedUtc: row.reportedUtc,
    locationName: row.locationName,
    bedCategoryCode: row.bedCategoryCode,
    staffedBedsTotal: row.staffedBedsTotal ?? 0,
    bedsAvailable: row.bedsAvailable ?? 0,
    bedsOccupied: row.bedsOccupied ?? 0,
  })), [recentBedRows]);

  const bedGridColumnDefs: ColDef<(typeof bedGridRows)[number]>[] = useMemo(() => [
    {
      field: 'reportedUtc',
      headerName: 'Reported',
      minWidth: 180,
      flex: 1.3,
      sort: 'desc',
      valueFormatter: (params) => new Date(String(params.value)).toLocaleString(),
    },
    { field: 'locationName', headerName: 'Location', minWidth: 160, flex: 1.1 },
    { field: 'bedCategoryCode', headerName: 'Category', minWidth: 120, flex: 0.9 },
    { field: 'staffedBedsTotal', headerName: 'Staffed', minWidth: 100, flex: 0.8, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'bedsAvailable', headerName: 'Available', minWidth: 100, flex: 0.8, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'bedsOccupied', headerName: 'Occupied', minWidth: 100, flex: 0.8, type: 'numericColumn', cellClass: 'text-end' },
  ], []);

  return (
    <Card className="shadow-sm mb-3">
      <Card.Header className="fw-semibold">Resource Posture (Pilot)</Card.Header>
      <Card.Body>
        {resourceLoading && (
          <div className="d-flex align-items-center gap-2 mb-3">
            <Spinner animation="border" size="sm" />
            <span>Loading resource and bed data...</span>
          </div>
        )}

        {!resourceLoading && recentResourceRows.length === 0 && (
          <div className="text-muted small mb-3">No resource inventory records available yet.</div>
        )}

        {!resourceLoading && recentResourceRows.length > 0 && (
          <div className="mb-3">
            <IpocDataGrid
              gridId="resource-posture-inventory"
              rowData={resourceGridRows}
              columnDefs={resourceGridColumnDefs}
              emptyMessage="No resource inventory records available yet."
              pageSize={10}
            />
          </div>
        )}

        <Row className="g-2 align-items-end">
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Total Qty" info="Enter the total quantity currently reported at the selected location/resource type." /></Form.Label>
            <Form.Control
              size="sm"
              value={resourceTotalInput}
              onChange={(event) => setResourceTotalInput(event.target.value)}
              placeholder="Total"
            />
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Available Qty" info="Enter quantity currently available for deployment." /></Form.Label>
            <Form.Control
              size="sm"
              value={resourceAvailableInput}
              onChange={(event) => setResourceAvailableInput(event.target.value)}
              placeholder="Available"
            />
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Committed Qty" info="Enter quantity already committed to active operations." /></Form.Label>
            <Form.Control
              size="sm"
              value={resourceCommittedInput}
              onChange={(event) => setResourceCommittedInput(event.target.value)}
              placeholder="Committed"
            />
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Out of Service Qty" info="Enter quantity temporarily unavailable due to maintenance or outage." /></Form.Label>
            <Form.Control
              size="sm"
              value={resourceOutOfServiceInput}
              onChange={(event) => setResourceOutOfServiceInput(event.target.value)}
              placeholder="Out of service"
            />
          </Col>
          <Col md="auto">
            <IconActionButton
              iconClassName="bi bi-upload"
              tooltip={selectedInventoryId ? 'Submit resource inventory update for selected row' : 'Select an inventory row first'}
              ariaLabel="Update selected resource inventory"
              onClick={onUpdateInventory}
              disabled={!selectedInventoryId}
            />
          </Col>
        </Row>

        <hr />

        <div className="fw-semibold mb-2">Bed Availability Snapshot</div>
        {!resourceLoading && recentBedRows.length > 0 && (
          <div className="small text-muted mb-2">
            Latest: {recentBedRows[0].locationName} ({recentBedRows[0].bedCategoryCode}) at {new Date(recentBedRows[0].reportedUtc).toLocaleString()}
          </div>
        )}

        <Row className="g-2 align-items-end">
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Location" info="Choose the facility location for this bed snapshot." /></Form.Label>
            <Form.Select
              size="sm"
              value={bedLocationIdInput}
              onChange={(event) => setBedLocationIdInput(event.target.value)}
            >
              {locationLookups.map((location) => (
                <option key={location.locationId} value={String(location.locationId)}>{location.displayText}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Staffed Beds" info="Total staffed beds available in this category." /></Form.Label>
            <Form.Control
              size="sm"
              value={bedStaffedInput}
              onChange={(event) => setBedStaffedInput(event.target.value)}
              placeholder="Staffed"
            />
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Beds Available" info="Beds currently available to accept patients." /></Form.Label>
            <Form.Control
              size="sm"
              value={bedAvailableInput}
              onChange={(event) => setBedAvailableInput(event.target.value)}
              placeholder="Available"
            />
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Beds Occupied" info="Beds currently occupied in this category." /></Form.Label>
            <Form.Control
              size="sm"
              value={bedOccupiedInput}
              onChange={(event) => setBedOccupiedInput(event.target.value)}
              placeholder="Occupied"
            />
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Beds Unavailable" info="Beds not usable due to operational constraints." /></Form.Label>
            <Form.Control
              size="sm"
              value={bedUnavailableInput}
              onChange={(event) => setBedUnavailableInput(event.target.value)}
              placeholder="Unavailable"
            />
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Isolation Beds" info="Beds with isolation capability." /></Form.Label>
            <Form.Control
              size="sm"
              value={bedIsolationInput}
              onChange={(event) => setBedIsolationInput(event.target.value)}
              placeholder="Isolation"
            />
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Surge Potential" info="Additional surge beds that can be activated." /></Form.Label>
            <Form.Control
              size="sm"
              value={bedSurgeInput}
              onChange={(event) => setBedSurgeInput(event.target.value)}
              placeholder="Surge"
            />
          </Col>
          <Col md="auto">
            <IconActionButton
              iconClassName="bi bi-send"
              tooltip="Submit bed availability snapshot"
              ariaLabel="Submit bed availability snapshot"
              onClick={onAddBedSnapshot}
            />
          </Col>
        </Row>

        {!resourceLoading && recentBedRows.length > 0 && (
          <div className="mt-3">
            <IpocDataGrid
              gridId="resource-posture-beds"
              rowData={bedGridRows}
              columnDefs={bedGridColumnDefs}
              emptyMessage="No bed snapshots available."
              pageSize={10}
            />
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default ResourcePostureCard;

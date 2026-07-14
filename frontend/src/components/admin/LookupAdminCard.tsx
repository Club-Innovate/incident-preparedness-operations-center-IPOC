import { useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Badge, Col, Form, Row, Spinner } from 'react-bootstrap';
import { createLookupValue, getLookupValues, updateLookupValue } from '../../api';
import IconActionButton from '../common/IconActionButton';
import IpocDataGrid from '../common/IpocDataGrid';
import LabelWithInfo from '../common/LabelWithInfo';
import type { LookupValue } from '../../types';

type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

type LookupAdminCardProps = {
  isAuthenticated: boolean;
  onNotify: (message: string, variant: ToastVariant) => void;
};

const adminCodeSetOptions = [
  'IncidentType',
  'Severity',
  'IncidentStatus',
  'TaskPriority',
  'TaskStatus',
  'TimelineEventType',
] as const;

function LookupAdminCard({ isAuthenticated, onNotify }: LookupAdminCardProps) {
  const [selectedAdminCodeSetName, setSelectedAdminCodeSetName] = useState('IncidentType');
  const [adminLookupValues, setAdminLookupValues] = useState<LookupValue[]>([]);
  const [adminLookupLoading, setAdminLookupLoading] = useState(false);
  const [adminLookupCreateCode, setAdminLookupCreateCode] = useState('');
  const [adminLookupCreateDisplayName, setAdminLookupCreateDisplayName] = useState('');
  const [adminLookupCreateDescription, setAdminLookupCreateDescription] = useState('');
  const [adminLookupCreateSortOrder, setAdminLookupCreateSortOrder] = useState('');

  const canManage = useMemo(() => isAuthenticated && !adminLookupLoading, [isAuthenticated, adminLookupLoading]);

  const loadAdminLookupValues = async (codeSetName: string) => {
    if (!isAuthenticated) {
      setAdminLookupValues([]);
      return;
    }

    try {
      setAdminLookupLoading(true);
      const values = await getLookupValues(codeSetName);
      setAdminLookupValues(values);
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : 'Unable to load admin lookup values.';
      onNotify(message, 'danger');
    } finally {
      setAdminLookupLoading(false);
    }
  };

  const lookupGridRows = useMemo(() => adminLookupValues.map((value) => ({
    id: value.codeValueId,
    code: value.code,
    displayName: value.displayName,
    isActive: value.isActive,
  })), [adminLookupValues]);

  const lookupGridColumnDefs: ColDef<(typeof lookupGridRows)[number]>[] = useMemo(() => [
    { field: 'code', headerName: 'Code', minWidth: 150, flex: 1 },
    { field: 'displayName', headerName: 'Name', minWidth: 220, flex: 1.3 },
    {
      field: 'isActive',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      valueFormatter: (params) => (params.value ? 'Active' : 'Inactive'),
      cellRenderer: (params: { value?: boolean }) => (
        <Badge bg={params.value ? 'success' : 'secondary'}>
          {params.value ? 'Active' : 'Inactive'}
        </Badge>
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
      cellRenderer: (params: { data?: (typeof lookupGridRows)[number] }) => {
        if (!params.data) {
          return null;
        }

        return (
          <div className="text-end">
            <IconActionButton
              iconClassName={params.data.isActive ? 'bi bi-toggle-on' : 'bi bi-toggle-off'}
              tooltip={params.data.isActive ? 'Deactivate lookup value' : 'Activate lookup value'}
              ariaLabel={params.data.isActive ? 'Deactivate lookup value' : 'Activate lookup value'}
              onClick={() => {
                void handleToggleLookupValueActive(params.data?.id ?? 0, !(params.data?.isActive ?? false));
              }}
              disabled={!canManage}
              variant={params.data.isActive ? 'outline-warning' : 'outline-success'}
            />
          </div>
        );
      },
    },
  ], [canManage]);

  useEffect(() => {
    void loadAdminLookupValues(selectedAdminCodeSetName);
  }, [selectedAdminCodeSetName, isAuthenticated]);

  const handleCreateAdminLookupValue = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in to manage lookup values.', 'warning');
      return;
    }

    if (adminLookupCreateCode.trim().length === 0 || adminLookupCreateDisplayName.trim().length === 0) {
      onNotify('Lookup code and display name are required.', 'warning');
      return;
    }

    const parsedSortOrder = adminLookupCreateSortOrder.trim().length > 0 ? Number(adminLookupCreateSortOrder) : undefined;
    if (parsedSortOrder !== undefined && (!Number.isFinite(parsedSortOrder) || parsedSortOrder < 0)) {
      onNotify('Sort order must be a non-negative number.', 'warning');
      return;
    }

    try {
      setAdminLookupLoading(true);
      await createLookupValue(selectedAdminCodeSetName, {
        code: adminLookupCreateCode.trim(),
        displayName: adminLookupCreateDisplayName.trim(),
        description: adminLookupCreateDescription.trim().length > 0 ? adminLookupCreateDescription.trim() : undefined,
        sortOrder: parsedSortOrder,
      });

      setAdminLookupCreateCode('');
      setAdminLookupCreateDisplayName('');
      setAdminLookupCreateDescription('');
      setAdminLookupCreateSortOrder('');

      await loadAdminLookupValues(selectedAdminCodeSetName);
      onNotify('Lookup value created.', 'success');
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : 'Unable to create lookup value.';
      onNotify(message, 'danger');
    } finally {
      setAdminLookupLoading(false);
    }
  };

  const handleToggleLookupValueActive = async (codeValueId: number, nextIsActive: boolean) => {
    if (!isAuthenticated) {
      onNotify('Sign in to manage lookup values.', 'warning');
      return;
    }

    const selected = adminLookupValues.find((item) => item.codeValueId === codeValueId);
    if (!selected) {
      return;
    }

    try {
      setAdminLookupLoading(true);
      await updateLookupValue(selectedAdminCodeSetName, codeValueId, {
        displayName: selected.displayName,
        description: selected.description ?? undefined,
        sortOrder: selected.sortOrder,
        isActive: nextIsActive,
      });

      await loadAdminLookupValues(selectedAdminCodeSetName);
      onNotify(nextIsActive ? 'Lookup value activated.' : 'Lookup value deactivated.', 'success');
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : 'Unable to update lookup value.';
      onNotify(message, 'danger');
    } finally {
      setAdminLookupLoading(false);
    }
  };

  return (
    <>
      <div className="fw-semibold">Lookup Administration</div>
      <div className="text-muted small mt-1 mb-2">Add new values and activate/deactivate existing values by code set.</div>

      <Form.Group className="mb-2">
        <Form.Label className="small mb-1"><LabelWithInfo text="Code Set" info="Select the lookup code set to view and manage values." /></Form.Label>
        <Form.Select
          size="sm"
          value={selectedAdminCodeSetName}
          onChange={(event) => setSelectedAdminCodeSetName(event.target.value)}
          disabled={adminLookupLoading}
        >
          {adminCodeSetOptions.map((codeSetName) => (
            <option key={codeSetName} value={codeSetName}>{codeSetName}</option>
          ))}
        </Form.Select>
      </Form.Group>

      <Row className="g-2 mb-2">
        <Col md={6}>
          <Form.Label className="small mb-1"><LabelWithInfo text="Code" info="Unique machine-readable value stored in the selected code set." /></Form.Label>
          <Form.Control
            size="sm"
            value={adminLookupCreateCode}
            onChange={(event) => setAdminLookupCreateCode(event.target.value)}
            placeholder="Code"
            disabled={!canManage}
          />
        </Col>
        <Col md={6}>
          <Form.Label className="small mb-1"><LabelWithInfo text="Display Name" info="Human-readable label shown throughout the application." /></Form.Label>
          <Form.Control
            size="sm"
            value={adminLookupCreateDisplayName}
            onChange={(event) => setAdminLookupCreateDisplayName(event.target.value)}
            placeholder="Display Name"
            disabled={!canManage}
          />
        </Col>
        <Col md={8}>
          <Form.Label className="small mb-1"><LabelWithInfo text="Description" info="Optional explanatory text for operators and admins." /></Form.Label>
          <Form.Control
            size="sm"
            value={adminLookupCreateDescription}
            onChange={(event) => setAdminLookupCreateDescription(event.target.value)}
            placeholder="Description (optional)"
            disabled={!canManage}
          />
        </Col>
        <Col md={4}>
          <Form.Label className="small mb-1"><LabelWithInfo text="Sort Order" info="Optional non-negative ordering value; lower numbers appear first." /></Form.Label>
          <Form.Control
            size="sm"
            value={adminLookupCreateSortOrder}
            onChange={(event) => setAdminLookupCreateSortOrder(event.target.value)}
            placeholder="Sort Order"
            disabled={!canManage}
          />
        </Col>
        <Col md={12} className="d-flex justify-content-start">
          <IconActionButton
            iconClassName="bi bi-plus-circle"
            tooltip={adminLookupLoading ? 'Saving lookup value...' : 'Add lookup value'}
            ariaLabel="Add lookup value"
            onClick={handleCreateAdminLookupValue}
            disabled={!canManage}
            variant="outline-primary"
          />
        </Col>
      </Row>

      {adminLookupLoading && (
        <div className="d-flex align-items-center gap-2 small text-muted mb-2">
          <Spinner animation="border" size="sm" />
          <span>Loading lookup values...</span>
        </div>
      )}

      {!adminLookupLoading && adminLookupValues.length === 0 && (
        <div className="small text-muted">No values found for this code set.</div>
      )}

      {!adminLookupLoading && adminLookupValues.length > 0 && (
        <IpocDataGrid
          gridId="admin-lookup-values"
          rowData={lookupGridRows}
          columnDefs={lookupGridColumnDefs}
          emptyMessage="No values found for this code set."
          pageSize={25}
        />
      )}
    </>
  );
}

export default LookupAdminCard;

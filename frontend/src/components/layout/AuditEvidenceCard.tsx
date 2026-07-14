import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import type { ColDef } from 'ag-grid-community';
import { exportAuditEventsCsv, getAuditEvents } from '../../api';
import type { AuditEventListItem, IncidentSummary } from '../../types';
import IconActionButton from '../common/IconActionButton';
import IpocDataGrid from '../common/IpocDataGrid';
import LabelWithInfo from '../common/LabelWithInfo';

function downloadCsv(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type AuditEvidenceCardProps = {
  incidents: IncidentSummary[];
};

function AuditEvidenceCard({ incidents }: AuditEvidenceCardProps) {
  const [incidentIdFilter, setIncidentIdFilter] = useState('All');
  const [eventCategoryFilter, setEventCategoryFilter] = useState('All');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [items, setItems] = useState<AuditEventListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromUtcIso = useMemo(() => (fromDateFilter ? `${fromDateFilter}T00:00:00Z` : undefined), [fromDateFilter]);
  const toUtcIso = useMemo(() => (toDateFilter ? `${toDateFilter}T23:59:59.999Z` : undefined), [toDateFilter]);

  useEffect(() => {
    setPageNumber(1);
  }, [incidentIdFilter, eventCategoryFilter, outcomeFilter, fromDateFilter, toDateFilter, pageSize]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getAuditEvents({
      incidentId: incidentIdFilter === 'All' ? undefined : Number(incidentIdFilter),
      eventCategory: eventCategoryFilter === 'All' ? undefined : eventCategoryFilter,
      outcomeCode: outcomeFilter === 'All' ? undefined : outcomeFilter,
      fromUtc: fromUtcIso,
      toUtc: toUtcIso,
      pageNumber,
      pageSize,
    })
      .then((response) => {
        setItems(response.items);
        setTotalCount(response.totalCount);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load audit evidence.');
        setItems([]);
        setTotalCount(0);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [incidentIdFilter, eventCategoryFilter, outcomeFilter, fromUtcIso, toUtcIso, pageNumber, pageSize]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => set.add(item.eventCategory));
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const outcomeOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => set.add(item.outcomeCode));
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const exportEvidenceCsv = async () => {
    try {
      setExporting(true);
      setError(null);

      const blob = await exportAuditEventsCsv({
        incidentId: incidentIdFilter === 'All' ? undefined : Number(incidentIdFilter),
        eventCategory: eventCategoryFilter === 'All' ? undefined : eventCategoryFilter,
        outcomeCode: outcomeFilter === 'All' ? undefined : outcomeFilter,
        fromUtc: fromUtcIso,
        toUtc: toUtcIso,
        pageNumber,
        pageSize,
      });

      const now = new Date();
      const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
      downloadCsv(`audit-evidence-${stamp}.csv`, blob);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to export audit evidence.');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const gridRows = useMemo(() => items.map((item) => ({
    id: item.auditEventId,
    eventUtc: item.eventUtc,
    eventCategory: item.eventCategory,
    eventAction: item.eventAction,
    outcomeCode: item.outcomeCode,
    actorDisplayName: item.actorDisplayName ?? 'System',
    incidentId: item.incidentId ?? '—',
    entityName: `${item.entitySchemaName ?? ''}.${item.entityTableName ?? ''}`.replace(/^\.$/, '—'),
  })), [items]);

  const gridColumnDefs: ColDef<(typeof gridRows)[number]>[] = useMemo(() => [
    {
      field: 'eventUtc',
      headerName: 'Event UTC',
      minWidth: 180,
      flex: 1.3,
      sort: 'desc',
      valueFormatter: (params) => new Date(String(params.value)).toLocaleString(),
    },
    {
      field: 'eventCategory',
      headerName: 'Category',
      minWidth: 150,
      flex: 1,
    },
    {
      field: 'eventAction',
      headerName: 'Action',
      minWidth: 180,
      flex: 1.2,
    },
    {
      field: 'outcomeCode',
      headerName: 'Outcome',
      minWidth: 120,
      flex: 0.9,
    },
    {
      field: 'actorDisplayName',
      headerName: 'Actor',
      minWidth: 160,
      flex: 1,
    },
    {
      field: 'incidentId',
      headerName: 'Incident',
      minWidth: 120,
      flex: 0.8,
    },
    {
      field: 'entityName',
      headerName: 'Entity',
      minWidth: 180,
      flex: 1.2,
    },
  ], []);

  return (
    <Card className="shadow-sm">
      <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
        <span>Audit Evidence Feed</span>
        <Badge bg="secondary">MVP</Badge>
      </Card.Header>
      <Card.Body>
        <Row className="g-2 align-items-end mb-3">
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Incident" info="Optionally scope evidence to a specific incident." /></Form.Label>
            <Form.Select value={incidentIdFilter} onChange={(event) => setIncidentIdFilter(event.target.value)}>
              <option value="All">All incidents</option>
              {incidents.map((incident) => (
                <option key={incident.incidentId} value={String(incident.incidentId)}>
                  {incident.incidentNumber} — {incident.incidentName}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Category" info="Filter by audit event category." /></Form.Label>
            <Form.Select value={eventCategoryFilter} onChange={(event) => setEventCategoryFilter(event.target.value)}>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Outcome" info="Filter by audit event outcome." /></Form.Label>
            <Form.Select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)}>
              {outcomeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="From" info="Start date in UTC." /></Form.Label>
            <Form.Control type="date" value={fromDateFilter} onChange={(event) => setFromDateFilter(event.target.value)} />
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="To" info="End date in UTC." /></Form.Label>
            <Form.Control type="date" value={toDateFilter} onChange={(event) => setToDateFilter(event.target.value)} />
          </Col>
          <Col md={1}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Page" info="Rows per page for evidence feed." /></Form.Label>
            <Form.Select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </Form.Select>
          </Col>
        </Row>

        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="small text-muted">Showing {items.length} of {totalCount} evidence rows.</div>
          <div className="d-flex gap-2">
            <IconActionButton
              iconClassName="bi bi-download"
              tooltip="Export current audit evidence page to CSV"
              ariaLabel="Export audit evidence CSV"
              onClick={() => {
                void exportEvidenceCsv();
              }}
              variant="outline-secondary"
              disabled={items.length === 0 || loading || exporting}
            />
            <IconActionButton
              iconClassName="bi bi-chevron-left"
              tooltip="Previous audit evidence page"
              ariaLabel="Previous audit evidence page"
              onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              variant="outline-secondary"
              disabled={pageNumber <= 1 || loading}
            />
            <span className="small align-self-center">{pageNumber}/{totalPages}</span>
            <IconActionButton
              iconClassName="bi bi-chevron-right"
              tooltip="Next audit evidence page"
              ariaLabel="Next audit evidence page"
              onClick={() => setPageNumber((current) => Math.min(totalPages, current + 1))}
              variant="outline-secondary"
              disabled={pageNumber >= totalPages || loading}
            />
          </div>
        </div>

        {loading && (
          <div className="d-flex align-items-center gap-2 mb-2">
            <Spinner animation="border" size="sm" />
            <span className="small">Loading audit evidence...</span>
          </div>
        )}

        {!loading && error && <div className="small text-danger mb-2">{error}</div>}

        <IpocDataGrid
          gridId="audit-evidence-feed"
          rowData={gridRows}
          columnDefs={gridColumnDefs}
          emptyMessage="No audit evidence rows for the selected filters."
          pageSize={25}
        />
      </Card.Body>
    </Card>
  );
}

export default AuditEvidenceCard;

import { Badge, Card, Form, ListGroup } from 'react-bootstrap';
import { useEffect, useMemo, useState } from 'react';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';

export type ExecutionLaneSignalStatus = 'ready' | 'in-progress' | 'at-risk' | 'planned' | 'backlog';
export type ExecutionDirectiveStatus = 'planned' | 'in-progress' | 'blocked' | 'completed';

export type ExecutionLaneSignalItem = {
  id: string;
  capability: string;
  capabilityInfo?: string;
  rfpReference: string;
  nextStep: string;
  signalStatus: ExecutionLaneSignalStatus;
};

export type ExecutionDirective = {
  id: string;
  status: ExecutionDirectiveStatus;
  owner: string;
  dueDate: string;
  blockedByDirectiveId: string;
};

type ExecutionLaneBoardProps = {
  title: string;
  titleInfo?: string;
  items: ExecutionLaneSignalItem[];
  directives: ExecutionDirective[];
  onDirectiveChange: (id: string, patch: Partial<ExecutionDirective>) => void;
  enableDependencySequencing?: boolean;
};

function getSignalBadgeVariant(status: ExecutionLaneSignalStatus): string {
  if (status === 'ready') {
    return 'success';
  }

  if (status === 'in-progress') {
    return 'info';
  }

  if (status === 'at-risk') {
    return 'warning';
  }

  return 'secondary';
}

function getSignalLabel(status: ExecutionLaneSignalStatus): string {
  if (status === 'ready') {
    return 'Ready';
  }

  if (status === 'in-progress') {
    return 'In Progress';
  }

  if (status === 'at-risk') {
    return 'At Risk';
  }

  if (status === 'planned') {
    return 'Planned';
  }

  return 'Backlog';
}

function getDirectiveBadgeVariant(status: ExecutionDirectiveStatus): string {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'in-progress') {
    return 'info';
  }

  if (status === 'blocked') {
    return 'danger';
  }

  return 'secondary';
}

function getDirectiveLabel(status: ExecutionDirectiveStatus): string {
  if (status === 'completed') {
    return 'Completed';
  }

  if (status === 'in-progress') {
    return 'In Progress';
  }

  if (status === 'blocked') {
    return 'Blocked';
  }

  return 'Planned';
}

function ExecutionLaneBoard({ title, titleInfo, items, directives, onDirectiveChange, enableDependencySequencing = false }: ExecutionLaneBoardProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | ExecutionDirectiveStatus>('all');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sortMode, setSortMode] = useState<'none' | 'due-soonest' | 'blocked-first' | 'dependency-chain'>(
    enableDependencySequencing ? 'dependency-chain' : 'none',
  );
  const [myItemsOnly, setMyItemsOnly] = useState(false);
  const [myOwnerTag, setMyOwnerTag] = useState(() => localStorage.getItem('ipoc.execution.myOwnerTag') ?? '');
  const [selectedDirectiveIds, setSelectedDirectiveIds] = useState<string[]>([]);
  const [directiveErrors, setDirectiveErrors] = useState<Record<string, string>>({});

  const normalizedOwnerFilter = ownerFilter.trim().toLowerCase();
  const normalizedMyOwnerTag = myOwnerTag.trim().toLowerCase();
  const todayIsoDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const itemsWithDirective = useMemo(() => items.map((item) => {
    const directive = directives.find((entry) => entry.id === item.id)
      ?? {
        id: item.id,
        status: 'planned' as const,
        owner: '',
        dueDate: '',
        blockedByDirectiveId: '',
      };

    return {
      item,
      directive,
    };
  }), [directives, items]);

  const directivesById = useMemo(() => new Map(itemsWithDirective.map((entry) => [entry.item.id, entry.directive])), [itemsWithDirective]);

  const filteredItems = useMemo(() => itemsWithDirective.filter(({ directive }) => {
    const statusMatches = statusFilter === 'all' || directive.status === statusFilter;
    const ownerMatches = normalizedOwnerFilter.length === 0
      || directive.owner.toLowerCase().includes(normalizedOwnerFilter);
    const myItemsMatch = !myItemsOnly
      || normalizedMyOwnerTag.length === 0
      || directive.owner.toLowerCase().includes(normalizedMyOwnerTag);

    return statusMatches && ownerMatches && myItemsMatch;
  }), [itemsWithDirective, myItemsOnly, normalizedMyOwnerTag, normalizedOwnerFilter, statusFilter]);

  const sortedItems = useMemo(() => {
    if (sortMode === 'none') {
      return filteredItems;
    }

    const toDueTs = (dueDate: string): number => {
      if (dueDate.trim().length === 0) {
        return Number.POSITIVE_INFINITY;
      }

      const parsed = Date.parse(dueDate);
      return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    };

    const rankStatus = (status: ExecutionDirectiveStatus): number => {
      if (status === 'blocked') {
        return 0;
      }
      if (status === 'in-progress') {
        return 1;
      }
      if (status === 'planned') {
        return 2;
      }
      return 3;
    };

    const computeDependencyDepth = (directiveId: string, visited: Set<string>): number => {
      if (visited.has(directiveId)) {
        return Number.MAX_SAFE_INTEGER;
      }

      const currentDirective = directivesById.get(directiveId);
      if (!currentDirective || currentDirective.blockedByDirectiveId.length === 0) {
        return 0;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(directiveId);
      return 1 + computeDependencyDepth(currentDirective.blockedByDirectiveId, nextVisited);
    };

    const copy = [...filteredItems];
    copy.sort((a, b) => {
      if (sortMode === 'due-soonest') {
        return toDueTs(a.directive.dueDate) - toDueTs(b.directive.dueDate);
      }

      if (sortMode === 'dependency-chain') {
        const depthDelta = computeDependencyDepth(a.item.id, new Set()) - computeDependencyDepth(b.item.id, new Set());
        if (depthDelta !== 0) {
          return depthDelta;
        }

        return toDueTs(a.directive.dueDate) - toDueTs(b.directive.dueDate);
      }

      const statusDelta = rankStatus(a.directive.status) - rankStatus(b.directive.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      return toDueTs(a.directive.dueDate) - toDueTs(b.directive.dueDate);
    });

    return copy;
  }, [directivesById, filteredItems, sortMode]);

  const directiveCounts = useMemo(() => itemsWithDirective.reduce((acc, current) => {
    acc[current.directive.status] += 1;
    return acc;
  }, {
    planned: 0,
    'in-progress': 0,
    blocked: 0,
    completed: 0,
  } as Record<ExecutionDirectiveStatus, number>), [itemsWithDirective]);

  const filteredCount = sortedItems.length;

  useEffect(() => {
    const available = new Set(items.map((item) => item.id));
    setSelectedDirectiveIds((current) => current.filter((id) => available.has(id)));
  }, [items]);

  const handleMyOwnerTagChange = (value: string) => {
    setMyOwnerTag(value);
    localStorage.setItem('ipoc.execution.myOwnerTag', value);
  };

  const clearSelection = () => {
    setSelectedDirectiveIds([]);
  };

  const setDirectiveError = (id: string, message: string | null) => {
    setDirectiveErrors((current) => {
      if (message === null) {
        if (!current[id]) {
          return current;
        }

        const next = { ...current };
        delete next[id];
        return next;
      }

      return {
        ...current,
        [id]: message,
      };
    });
  };

  const applyDirectivePatch = (id: string, patch: Partial<ExecutionDirective>): boolean => {
    const current = directivesById.get(id) ?? {
      id,
      status: 'planned' as const,
      owner: '',
      dueDate: '',
      blockedByDirectiveId: '',
    };

    const next = {
      ...current,
      ...patch,
    };

    if ((next.status === 'in-progress' || next.status === 'blocked') && next.owner.trim().length === 0) {
      setDirectiveError(id, 'Owner is required before setting status to In Progress or Blocked.');
      return false;
    }

    if ((next.status === 'in-progress' || next.status === 'completed') && next.dueDate.trim().length === 0) {
      setDirectiveError(id, 'Due date is required before setting status to In Progress or Completed.');
      return false;
    }

    if (next.status === 'completed' && next.owner.trim().length === 0) {
      setDirectiveError(id, 'Owner is required before setting status to Completed.');
      return false;
    }

    if (next.blockedByDirectiveId === id) {
      setDirectiveError(id, 'A directive cannot be blocked by itself.');
      return false;
    }

    if (next.status === 'completed' && next.blockedByDirectiveId.length > 0) {
      const blocker = directivesById.get(next.blockedByDirectiveId);
      if (blocker && blocker.status !== 'completed') {
        setDirectiveError(id, 'Complete the blocker directive before setting this directive to Completed.');
        return false;
      }
    }

    setDirectiveError(id, null);
    onDirectiveChange(id, patch);
    return true;
  };

  const selectedVisibleItems = sortedItems.filter(({ item }) => selectedDirectiveIds.includes(item.id));
  const allVisibleSelected = sortedItems.length > 0 && selectedVisibleItems.length === sortedItems.length;

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedDirectiveIds((current) => current.filter((id) => !sortedItems.some(({ item }) => item.id === id)));
      return;
    }

    const visibleIds = sortedItems.map(({ item }) => item.id);
    setSelectedDirectiveIds((current) => Array.from(new Set([...current, ...visibleIds])));
  };

  const toggleSelectDirective = (id: string, isChecked: boolean) => {
    setSelectedDirectiveIds((current) => {
      if (isChecked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((value) => value !== id);
    });
  };

  const applyBulkPatch = (patchFactory: (itemId: string) => Partial<ExecutionDirective>) => {
    selectedVisibleItems.forEach(({ item }) => {
      applyDirectivePatch(item.id, patchFactory(item.id));
    });
  };

  const bulkAssignMyOwnerTag = () => {
    const owner = myOwnerTag.trim();
    if (owner.length === 0) {
      return;
    }

    applyBulkPatch(() => ({ owner }));
  };

  const bulkMarkCompleted = () => {
    applyBulkPatch(() => ({ status: 'completed' }));
  };

  const bulkMarkBlocked = () => {
    applyBulkPatch(() => ({ status: 'blocked' }));
  };

  const bulkSetDueToday = () => {
    applyBulkPatch(() => ({ dueDate: todayIsoDate }));
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setSortMode('none');
    setOwnerFilter('');
    setMyItemsOnly(false);
  };

  const isOverdueDirective = (directive: ExecutionDirective): boolean => {
    if (!directive.dueDate || directive.status === 'completed') {
      return false;
    }

    return directive.dueDate < todayIsoDate;
  };

  const isBlockedByOpenDependency = (directive: ExecutionDirective): boolean => {
    if (!directive.blockedByDirectiveId) {
      return false;
    }

    const blocker = directivesById.get(directive.blockedByDirectiveId);
    if (!blocker) {
      return false;
    }

    return blocker.status !== 'completed';
  };

  const resolveBlockerAssist = (directiveId: string, directive: ExecutionDirective) => {
    if (!directive.blockedByDirectiveId) {
      return;
    }

    const blocker = directivesById.get(directive.blockedByDirectiveId);
    if (blocker && blocker.status !== 'completed') {
      applyDirectivePatch(blocker.id, { status: 'completed' });
    }

    const owner = directive.owner.trim().length > 0
      ? directive.owner
      : myOwnerTag.trim();

    applyDirectivePatch(directiveId, {
      blockedByDirectiveId: '',
      owner,
      dueDate: directive.dueDate || todayIsoDate,
      status: owner.trim().length > 0 ? 'in-progress' : 'planned',
    });
  };

  const getDirectiveName = (directiveId: string): string => {
    const match = items.find((item) => item.id === directiveId);
    return match?.capability ?? directiveId;
  };

  return (
    <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
      <Card.Body className="py-2">
        <div className="small fw-semibold mb-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span>{titleInfo ? <LabelWithInfo text={title} info={titleInfo} /> : title}</span>
          <span className="d-inline-flex flex-wrap align-items-center gap-1">
            <Badge bg="secondary">Planned {directiveCounts.planned}</Badge>
            <Badge bg="info">In Progress {directiveCounts['in-progress']}</Badge>
            <Badge bg="danger">Blocked {directiveCounts.blocked}</Badge>
            <Badge bg="success">Completed {directiveCounts.completed}</Badge>
            <IconActionButton
              iconClassName="bi bi-x-circle"
              tooltip="Clear execution board filters"
              ariaLabel="Clear execution board filters"
              onClick={clearFilters}
              variant="outline-secondary"
              size="sm"
            />
          </span>
        </div>
        <div className="row g-2 mb-2">
          <div className="col-md-4">
            <Form.Select
              size="sm"
              value={statusFilter}
              aria-label="Execution directive status filter"
              onChange={(event) => setStatusFilter(event.target.value as 'all' | ExecutionDirectiveStatus)}
            >
              <option value="all">All statuses</option>
              <option value="planned">Planned</option>
              <option value="in-progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </Form.Select>
          </div>
          <div className="col-md-4">
            <Form.Select
              size="sm"
              value={sortMode}
              aria-label="Execution directive sort order"
              onChange={(event) => setSortMode(event.target.value as 'none' | 'due-soonest' | 'blocked-first')}
            >
              <option value="none">No sorting</option>
              <option value="due-soonest">Sort by due soonest</option>
              <option value="blocked-first">Sort blocked first</option>
              {enableDependencySequencing && <option value="dependency-chain">Sort by dependency chain</option>}
            </Form.Select>
          </div>
          <div className="col-md-4">
            <Form.Control
              size="sm"
              type="text"
              placeholder="Filter by owner"
              value={ownerFilter}
              aria-label="Execution directive owner filter"
              onChange={(event) => setOwnerFilter(event.target.value)}
            />
          </div>
        </div>
        <div className="row g-2 mb-2 align-items-center">
          <div className="col-md-4">
            <Form.Check
              type="switch"
              id={`execution-my-items-${title.replace(/\s+/g, '-').toLowerCase()}`}
              label="My items only"
              checked={myItemsOnly}
              onChange={(event) => setMyItemsOnly(event.target.checked)}
            />
          </div>
          <div className="col-md-4">
            <Form.Control
              size="sm"
              type="text"
              placeholder="My owner tag"
              value={myOwnerTag}
              aria-label="My owner tag"
              onChange={(event) => handleMyOwnerTagChange(event.target.value)}
            />
          </div>
          <div className="col-md-4 small text-muted text-md-end">
            Showing {filteredCount} of {items.length}
          </div>
        </div>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div className="d-inline-flex align-items-center gap-2 small">
            <Form.Check
              type="checkbox"
              id={`execution-select-all-${title.replace(/\s+/g, '-').toLowerCase()}`}
              checked={allVisibleSelected}
              onChange={() => toggleSelectAllVisible()}
              label="Select all visible"
            />
            <span className="text-muted">Selected {selectedVisibleItems.length}</span>
          </div>
          <div className="d-inline-flex flex-wrap align-items-center gap-1">
            <IconActionButton
              iconClassName="bi bi-person-plus"
              tooltip="Assign selected directives to My owner tag"
              ariaLabel="Assign selected directives to my owner tag"
              onClick={bulkAssignMyOwnerTag}
              variant="outline-secondary"
              size="sm"
              disabled={selectedVisibleItems.length === 0 || myOwnerTag.trim().length === 0}
            />
            <IconActionButton
              iconClassName="bi bi-calendar-plus"
              tooltip="Set due date to today for selected directives"
              ariaLabel="Set due date to today for selected directives"
              onClick={bulkSetDueToday}
              variant="outline-secondary"
              size="sm"
              disabled={selectedVisibleItems.length === 0}
            />
            <IconActionButton
              iconClassName="bi bi-check2-all"
              tooltip="Mark selected directives completed"
              ariaLabel="Mark selected directives completed"
              onClick={bulkMarkCompleted}
              variant="outline-secondary"
              size="sm"
              disabled={selectedVisibleItems.length === 0}
            />
            <IconActionButton
              iconClassName="bi bi-slash-circle"
              tooltip="Mark selected directives blocked"
              ariaLabel="Mark selected directives blocked"
              onClick={bulkMarkBlocked}
              variant="outline-secondary"
              size="sm"
              disabled={selectedVisibleItems.length === 0}
            />
            <IconActionButton
              iconClassName="bi bi-x-square"
              tooltip="Clear selected directives"
              ariaLabel="Clear selected directives"
              onClick={clearSelection}
              variant="outline-secondary"
              size="sm"
              disabled={selectedVisibleItems.length === 0}
            />
          </div>
        </div>
        <ListGroup variant="flush">
          {sortedItems.map(({ item, directive }) => {
            const isOverdue = isOverdueDirective(directive);
            const blockedByOpenDependency = isBlockedByOpenDependency(directive);
            const rowSelected = selectedDirectiveIds.includes(item.id);
            const rowError = directiveErrors[item.id];

            return (
              <ListGroup.Item key={item.id} className={`px-0 py-2 small ${blockedByOpenDependency ? 'execution-lane-item-blocked' : ''}`}>
                <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                  <span className="d-inline-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      id={`execution-select-${item.id}`}
                      checked={rowSelected}
                      onChange={(event) => toggleSelectDirective(item.id, event.target.checked)}
                      aria-label={`Select ${item.capability}`}
                    />
                    <span className="fw-semibold">
                      {item.capabilityInfo
                        ? <LabelWithInfo text={item.capability} info={item.capabilityInfo} className="small" />
                        : item.capability}
                    </span>
                  </span>
                  <span className="d-inline-flex gap-1">
                    <Badge bg={getSignalBadgeVariant(item.signalStatus)}>{getSignalLabel(item.signalStatus)}</Badge>
                    <Badge bg={getDirectiveBadgeVariant(directive.status)}>{getDirectiveLabel(directive.status)}</Badge>
                    {isOverdue && <Badge bg="danger">Overdue</Badge>}
                    {blockedByOpenDependency && <Badge bg="warning">Blocked by dependency</Badge>}
                  </span>
                </div>
                <div className="text-muted mt-1">{item.nextStep}</div>
                <div className="row g-2 mt-1">
                  <div className="col-md-3">
                    <Form.Select
                      size="sm"
                      value={directive.status}
                      aria-label={`${item.capability} execution status`}
                      onChange={(event) => {
                        applyDirectivePatch(item.id, { status: event.target.value as ExecutionDirectiveStatus });
                      }}
                    >
                      <option value="planned">Planned</option>
                      <option value="in-progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="completed">Completed</option>
                    </Form.Select>
                  </div>
                  <div className="col-md-4">
                    <Form.Control
                      size="sm"
                      type="text"
                      placeholder="Owner"
                      value={directive.owner}
                      aria-label={`${item.capability} owner`}
                      onChange={(event) => {
                        applyDirectivePatch(item.id, { owner: event.target.value });
                      }}
                    />
                  </div>
                  <div className="col-md-3">
                    <Form.Control
                      size="sm"
                      type="date"
                      value={directive.dueDate}
                      aria-label={`${item.capability} due date`}
                      onChange={(event) => {
                        applyDirectivePatch(item.id, { dueDate: event.target.value });
                      }}
                    />
                  </div>
                  <div className="col-md-2">
                    <Form.Select
                      size="sm"
                      value={directive.blockedByDirectiveId}
                      aria-label={`${item.capability} blocked by directive`}
                      onChange={(event) => {
                        applyDirectivePatch(item.id, { blockedByDirectiveId: event.target.value });
                      }}
                    >
                      <option value="">No dependency</option>
                      {items
                        .filter((candidate) => candidate.id !== item.id)
                        .map((candidate) => (
                          <option key={`blocked-by-${item.id}-${candidate.id}`} value={candidate.id}>
                            {candidate.capability}
                          </option>
                        ))}
                    </Form.Select>
                  </div>
                </div>
                <div className="d-inline-flex flex-wrap gap-2 mt-2">
                  <IconActionButton
                    iconClassName="bi bi-unlock"
                    tooltip="Resolve blocker assist"
                    ariaLabel={`Resolve blocker assist for ${item.capability}`}
                    onClick={() => {
                      resolveBlockerAssist(item.id, directive);
                    }}
                    variant="outline-secondary"
                    size="sm"
                    disabled={!directive.blockedByDirectiveId}
                  />
                  <IconActionButton
                    iconClassName="bi bi-check2-circle"
                    tooltip="Mark directive completed"
                    ariaLabel={`Mark ${item.capability} completed`}
                    onClick={() => {
                      applyDirectivePatch(item.id, { status: 'completed' });
                    }}
                    variant="outline-secondary"
                    size="sm"
                    disabled={directive.status === 'completed'}
                  />
                  <IconActionButton
                    iconClassName="bi bi-slash-circle"
                    tooltip="Mark directive blocked"
                    ariaLabel={`Mark ${item.capability} blocked`}
                    onClick={() => {
                      applyDirectivePatch(item.id, { status: 'blocked' });
                    }}
                    variant="outline-secondary"
                    size="sm"
                    disabled={directive.status === 'blocked'}
                  />
                  <IconActionButton
                    iconClassName="bi bi-person-check"
                    tooltip="Assign directive to My owner tag"
                    ariaLabel={`Assign ${item.capability} to my owner tag`}
                    onClick={() => {
                      applyDirectivePatch(item.id, { owner: myOwnerTag.trim() });
                    }}
                    variant="outline-secondary"
                    size="sm"
                    disabled={myOwnerTag.trim().length === 0}
                  />
                  <IconActionButton
                    iconClassName="bi bi-calendar-check"
                    tooltip="Set due date to today"
                    ariaLabel={`Set ${item.capability} due date to today`}
                    onClick={() => {
                      applyDirectivePatch(item.id, { dueDate: todayIsoDate });
                    }}
                    variant="outline-secondary"
                    size="sm"
                    disabled={directive.dueDate === todayIsoDate}
                  />
                </div>
                {directive.blockedByDirectiveId.length > 0 && (
                  <div className="small text-muted mt-1">
                    Blocked by: {getDirectiveName(directive.blockedByDirectiveId)}
                  </div>
                )}
                {rowError && <div className="small text-danger mt-2">{rowError}</div>}
              </ListGroup.Item>
            );
          })}
          {sortedItems.length === 0 && (
            <ListGroup.Item className="px-0 py-2 small text-muted">
              No execution directives match the current filters.
            </ListGroup.Item>
          )}
        </ListGroup>
      </Card.Body>
    </Card>
  );
}

export default ExecutionLaneBoard;

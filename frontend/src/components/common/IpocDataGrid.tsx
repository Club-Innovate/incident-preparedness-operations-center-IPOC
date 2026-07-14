import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import IconActionButton from './IconActionButton';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule]);

type IpocDataGridState = {
  columnState?: ReturnType<GridApi['getColumnState']>;
  pageSize?: number;
};

type IpocDataGridProps<TRow extends object> = {
  gridId: string;
  rowData: TRow[];
  columnDefs: ColDef<TRow>[];
  emptyMessage?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  className?: string;
  height?: number | string;
};

const defaultColDef: ColDef = {
  sortable: true,
  resizable: true,
  filter: true,
  suppressMovable: false,
  suppressAutoSize: false,
};

function safeParseGridState(raw: string | null): IpocDataGridState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as IpocDataGridState;
    return parsed;
  } catch {
    return null;
  }
}

function IpocDataGrid<TRow extends object>({
  gridId,
  rowData,
  columnDefs,
  emptyMessage = 'No rows available.',
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  className,
  height = 320,
}: IpocDataGridProps<TRow>) {
  const storageKey = `ipoc.grid.${gridId}`;
  const [gridApi, setGridApi] = useState<GridApi<TRow> | null>(null);
  const [paginationPageSize, setPaginationPageSize] = useState(pageSize);

  const theme = useMemo(() => themeQuartz.withParams({
    fontSize: 11,
    rowHeight: 34,
    headerHeight: 36,
    wrapperBorderRadius: 6,
    spacing: 6,
  }), []);

  const persistState = (api: GridApi<TRow>) => {
    const payload: IpocDataGridState = {
      columnState: api.getColumnState(),
      pageSize: paginationPageSize,
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
  };

  const handleGridReady = (event: GridReadyEvent<TRow>) => {
    const api = event.api;
    setGridApi(api);

    const persisted = safeParseGridState(localStorage.getItem(storageKey));
    if (persisted?.columnState && persisted.columnState.length > 0) {
      api.applyColumnState({
        state: persisted.columnState,
        applyOrder: true,
      });
    }

    if (typeof persisted?.pageSize === 'number' && Number.isFinite(persisted.pageSize) && persisted.pageSize > 0) {
      setPaginationPageSize(persisted.pageSize);
      api.setGridOption('paginationPageSize', persisted.pageSize);
    }
  };

  const handleAutoFitColumns = () => {
    if (!gridApi) {
      return;
    }

    gridApi.autoSizeAllColumns(false);
    persistState(gridApi);
  };

  useEffect(() => {
    if (!gridApi) {
      return;
    }

    gridApi.setGridOption('paginationPageSize', paginationPageSize);
    persistState(gridApi);
  }, [gridApi, paginationPageSize]);

  useEffect(() => {
    if (!gridApi) {
      return;
    }

    const handlePersist = () => persistState(gridApi);

    const listeners: Array<[Parameters<GridApi['addEventListener']>[0], () => void]> = [
      ['columnMoved', handlePersist],
      ['columnResized', handlePersist],
      ['sortChanged', handlePersist],
      ['columnVisible', handlePersist],
      ['columnPinned', handlePersist],
    ];

    listeners.forEach(([eventName, listener]) => {
      gridApi.addEventListener(eventName, listener);
    });

    return () => {
      if (typeof gridApi.isDestroyed === 'function' && gridApi.isDestroyed()) {
        return;
      }

      listeners.forEach(([eventName, listener]) => {
        try {
          gridApi.removeEventListener(eventName, listener);
        } catch {
          // Grid can be destroyed before React cleanup runs in some tab/unmount flows.
        }
      });
    };
  }, [gridApi]);

  return (
    <div className={className}>
      <div className="d-flex justify-content-between align-items-center mb-2 ipoc-grid-toolbar">
        <div className="small text-muted ipoc-grid-toolbar-meta">Rows: {rowData.length}</div>
        <div className="d-inline-flex align-items-center gap-2 small ipoc-grid-toolbar-controls">
          <IconActionButton
            iconClassName="bi bi-arrows-angle-expand"
            tooltip="Auto-fit all columns to visible content"
            ariaLabel="Auto-fit all columns"
            onClick={handleAutoFitColumns}
            disabled={!gridApi}
            variant="outline-secondary"
            tooltipPlacement="top"
          />
          <label className="text-muted ipoc-grid-pagesize-label" htmlFor={`ipoc-grid-pagesize-${gridId}`}>Page size</label>
          <select
            id={`ipoc-grid-pagesize-${gridId}`}
            className="form-select form-select-sm ipoc-grid-pagesize-select"
            style={{ width: 'auto', fontSize: '0.72rem' }}
            value={paginationPageSize}
            onChange={(event) => setPaginationPageSize(Number(event.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={`${gridId}-size-${size}`} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="ipoc-data-grid-shell" style={{ width: '100%', height }}>
        <AgGridReact<TRow>
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          theme={theme}
          onGridReady={handleGridReady}
          animateRows
          skipHeaderOnAutoSize={false}
          pagination
          paginationPageSize={paginationPageSize}
          paginationPageSizeSelector={false}
          suppressCellFocus={false}
          overlayNoRowsTemplate={`<span class="small text-muted">${emptyMessage}</span>`}
        />
      </div>
    </div>
  );
}

export default IpocDataGrid;

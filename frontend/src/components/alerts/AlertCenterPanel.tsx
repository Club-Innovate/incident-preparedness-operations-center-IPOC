import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Badge, ListGroup, Offcanvas } from 'react-bootstrap';
import IconActionButton from '../common/IconActionButton';
import type { AlertStatus, ToastVariant } from '../../notifications/types';

export type AlertFeedItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  occurredAt: string;
  status: AlertStatus;
  source: 'system' | 'incident' | 'facilities' | 'reports' | 'security';
};

type AlertCenterPanelProps = {
  show: boolean;
  onHide: () => void;
  alertFeed: AlertFeedItem[];
  onClear: () => void;
  onRemove: (alertId: number) => void;
  onAcknowledge: (alertId: number) => void;
};

function AlertCenterPanel({ show, onHide, alertFeed, onClear, onRemove, onAcknowledge }: AlertCenterPanelProps) {
  const [panelWidth, setPanelWidth] = useState(520);
  const isResizingRef = useRef(false);

  useEffect(() => {
    const persistedWidth = localStorage.getItem('ipoc.alertCenter.widthPx');
    if (!persistedWidth) {
      return;
    }

    const parsedWidth = Number(persistedWidth);
    if (!Number.isFinite(parsedWidth)) {
      return;
    }

    const minWidth = 460;
    const maxWidth = Math.max(minWidth, window.innerWidth - 120);
    setPanelWidth(Math.min(maxWidth, Math.max(minWidth, parsedWidth)));
  }, []);

  useEffect(() => {
    localStorage.setItem('ipoc.alertCenter.widthPx', String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current) {
        return;
      }

      const minWidth = 460;
      const maxWidth = Math.max(minWidth, window.innerWidth - 120);
      const nextWidth = window.innerWidth - event.clientX;
      const clamped = Math.min(maxWidth, Math.max(minWidth, nextWidth));
      setPanelWidth(clamped);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const getVariantBadgeClass = (variant: ToastVariant) => {
    switch (variant) {
      case 'success':
        return 'ipoc-alert-badge-success';
      case 'warning':
        return 'ipoc-alert-badge-warning';
      case 'danger':
        return 'ipoc-alert-badge-danger';
      default:
        return 'ipoc-alert-badge-info';
    }
  };

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="end"
      className="ipoc-themed-panel ipoc-alert-center-offcanvas"
      style={{ '--bs-offcanvas-width': `${panelWidth}px` } as CSSProperties}
    >
      <div
        className="ipoc-alert-center-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Alert Center panel"
        title="Drag to resize Alert Center"
        onMouseDown={() => {
          isResizingRef.current = true;
        }}
      />
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Alert Center</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <div className="d-flex justify-content-end mb-3">
          <IconActionButton
            iconClassName="bi bi-trash"
            tooltip="Delete all alerts from the Alert Center."
            ariaLabel="Delete all alerts"
            onClick={onClear}
            variant="outline-secondary"
            disabled={alertFeed.length === 0}
          />
        </div>

        {alertFeed.length === 0 ? (
          <div className="text-muted small">No alerts recorded.</div>
        ) : (
          <ListGroup>
            {alertFeed.map((item) => (
              <ListGroup.Item key={item.id} className="d-flex align-items-start justify-content-between gap-2">
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <Badge className={getVariantBadgeClass(item.variant)}>{item.variant.toUpperCase()}</Badge>
                    <Badge className={item.status === 'acknowledged' ? 'ipoc-alert-badge-ack' : 'ipoc-alert-badge-new'}>{item.status === 'acknowledged' ? 'ACK' : 'NEW'}</Badge>
                    <Badge className="ipoc-alert-badge-source">{item.source.toUpperCase()}</Badge>
                    <span className="small text-muted text-nowrap">{new Date(item.occurredAt).toLocaleString()}</span>
                  </div>
                  <div className="small mt-1">{item.message}</div>
                </div>
                <div className="d-flex gap-2">
                  <IconActionButton
                    iconClassName="bi bi-check2-circle"
                    tooltip="Acknowledge this alert to mark it as reviewed while keeping it in the feed."
                    ariaLabel="Acknowledge alert"
                    onClick={() => onAcknowledge(item.id)}
                    variant="outline-success"
                    disabled={item.status === 'acknowledged'}
                  />
                  <IconActionButton
                    iconClassName="bi bi-x-lg"
                    tooltip="Delete this alert from the feed."
                    ariaLabel="Delete alert"
                    onClick={() => onRemove(item.id)}
                    variant="outline-secondary"
                  />
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export default AlertCenterPanel;

import { Badge, Card } from 'react-bootstrap';
import IconActionButton from './IconActionButton';
import type { CopCommandHandoffContext } from '../../types';

type CopHandoffBannerProps = {
  context: CopCommandHandoffContext;
  badgeLabel: string;
  onDismiss: () => void;
  onClear: () => void;
};

function CopHandoffBanner({ context, badgeLabel, onDismiss, onClear }: CopHandoffBannerProps) {
  return (
    <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
      <Card.Body className="py-2">
        <div className="small fw-semibold mb-1 d-flex align-items-center justify-content-between">
          <span>COP handoff context active</span>
          <Badge bg="info">{badgeLabel}</Badge>
        </div>
        <div className="small text-muted mb-2">
          Source {context.sourceAction ?? 'cop-overlay'} · Region {context.regionName ?? context.regionFilter ?? 'All'} · AOI {context.locationFilter ?? 'All'} · Layer {context.geoOverlayLayer ?? 'composite'} · Stress {context.geoOverlayStressFilter ?? 'all'} · Basemap {context.copMapBaseLayer ?? 'streets'} · Feed {context.copLiveOverlayFeedMode ?? 'off'}
        </div>
        {context.aoiLinkedLayerSetPresetName && (
          <div className="small text-muted mb-2">
            Linked layer preset {context.aoiLinkedLayerSetPresetName}
          </div>
        )}
        <div className="d-inline-flex gap-2">
          <IconActionButton
            iconClassName="bi bi-eye-slash"
            tooltip="Dismiss COP handoff banner for this workspace session"
            ariaLabel="Dismiss COP handoff banner"
            onClick={onDismiss}
            variant="outline-secondary"
          />
          <IconActionButton
            iconClassName="bi bi-trash"
            tooltip="Clear COP handoff context payload"
            ariaLabel="Clear COP handoff context payload"
            onClick={onClear}
            variant="outline-secondary"
          />
        </div>
      </Card.Body>
    </Card>
  );
}

export default CopHandoffBanner;

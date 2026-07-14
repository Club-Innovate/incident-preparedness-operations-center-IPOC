import { OverlayTrigger, Tooltip } from 'react-bootstrap';

type LabelWithInfoProps = {
  text: string;
  info: string;
  tip?: string;
  className?: string;
};

function LabelWithInfo({ text, info, tip, className }: LabelWithInfoProps) {
  return (
    <span className={`d-inline-flex align-items-center gap-1 ${className ?? ''}`.trim()}>
      <span>{text}</span>
      <OverlayTrigger
        placement="top"
        overlay={(
          <Tooltip id={`tooltip-label-${text.replace(/\s+/g, '-').toLowerCase()}`}>
            <div>{info}</div>
            {tip && (
              <div className="mt-1">
                <span className="fw-semibold">Tip:</span> {tip}
              </div>
            )}
          </Tooltip>
        )}
      >
        <i className="bi bi-info-circle text-muted" aria-label={`${text} information`} role="img" />
      </OverlayTrigger>
    </span>
  );
}

export default LabelWithInfo;

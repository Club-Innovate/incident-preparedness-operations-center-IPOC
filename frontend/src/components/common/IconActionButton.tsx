import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import type { Placement } from 'react-bootstrap/esm/types';

type IconActionButtonProps = {
  iconClassName: string;
  tooltip: string;
  ariaLabel: string;
  onClick: () => void;
  variant?: string;
  size?: 'sm' | 'lg';
  disabled?: boolean;
  className?: string;
  tooltipPlacement?: Placement;
  ariaExpanded?: boolean;
  ariaControls?: string;
  testId?: string;
};

function IconActionButton({
  iconClassName,
  tooltip,
  ariaLabel,
  onClick,
  variant = 'outline-secondary',
  size = 'sm',
  disabled = false,
  className,
  tooltipPlacement = 'top',
  ariaExpanded,
  ariaControls,
  testId,
}: IconActionButtonProps) {
  return (
    <OverlayTrigger
      placement={tooltipPlacement}
      container={typeof document !== 'undefined' ? document.body : undefined}
      popperConfig={{ strategy: 'fixed' }}
      flip
      rootClose
      delay={{ show: 80, hide: 60 }}
      overlay={<Tooltip id={`tooltip-${ariaLabel.replace(/\s+/g, '-').toLowerCase()}`} className="text-start">{tooltip}</Tooltip>}
    >
      <span className="d-inline-block">
        <Button
          type="button"
          variant={variant}
          size={size}
          className={`icon-btn ${className ?? ''}`.trim()}
          aria-label={ariaLabel}
          data-testid={testId}
          aria-expanded={ariaExpanded}
          aria-controls={ariaControls}
          onClick={onClick}
          disabled={disabled}
          style={disabled ? { pointerEvents: 'none' } : undefined}
        >
          <i className={iconClassName} aria-hidden="true" />
        </Button>
      </span>
    </OverlayTrigger>
  );
}

export default IconActionButton;

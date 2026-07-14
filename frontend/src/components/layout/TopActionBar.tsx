import { Badge, Nav, Navbar } from 'react-bootstrap';
import IconActionButton from '../common/IconActionButton';

type TopActionBarProps = {
  currentUserLabel: string;
  alertCount: number;
  hasAccounts: boolean;
  msalConfigured: boolean;
  onOpenAlertCenter: () => void;
  onOpenAdminPanel: () => void;
  onOpenThemeStudio: () => void;
  onOpenHelp: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

function TopActionBar({
  currentUserLabel,
  alertCount,
  hasAccounts,
  msalConfigured,
  onOpenAlertCenter,
  onOpenAdminPanel,
  onOpenThemeStudio,
  onOpenHelp,
  onSignIn,
  onSignOut,
}: TopActionBarProps) {
  return (
    <Nav className="ms-auto align-items-center gap-2 ipoc-top-action-bar">
      <Navbar.Text className="ipoc-user-chip">
        <i className="bi bi-person-circle" aria-hidden="true" />
        <span>{currentUserLabel}</span>
      </Navbar.Text>

      <div className="alert-bell-wrap">
        <IconActionButton
          iconClassName="bi bi-bell"
          tooltip="Open alert center"
          ariaLabel="Open alert center"
          onClick={onOpenAlertCenter}
          variant="outline-light"
          tooltipPlacement="bottom"
        />

        {alertCount > 0 && (
          <Badge bg="danger" pill className="alert-bell-count">
            {alertCount}
          </Badge>
        )}
      </div>

      <IconActionButton
        iconClassName="bi bi-gear"
        tooltip="Open administration workspace"
        ariaLabel="Open administration workspace"
        onClick={onOpenAdminPanel}
        variant="outline-light"
        tooltipPlacement="bottom"
      />

      <IconActionButton
        iconClassName="bi bi-palette"
        tooltip="Open theme studio"
        ariaLabel="Open theme studio"
        onClick={onOpenThemeStudio}
        variant="outline-light"
        tooltipPlacement="bottom"
      />

      <IconActionButton
        iconClassName="bi bi-question-circle"
        tooltip="Help"
        ariaLabel="Help"
        onClick={onOpenHelp}
        variant="outline-light"
        tooltipPlacement="bottom"
      />

      {!hasAccounts ? (
        <IconActionButton
          iconClassName="bi bi-box-arrow-in-right"
          tooltip={msalConfigured ? 'Sign in' : 'Sign in disabled until Entra config is set'}
          ariaLabel={msalConfigured ? 'Sign in' : 'Sign in disabled until Entra config is set'}
          onClick={onSignIn}
          disabled={!msalConfigured}
          variant="outline-light"
          tooltipPlacement="bottom"
        />
      ) : (
        <IconActionButton
          iconClassName="bi bi-box-arrow-right"
          tooltip="Sign out"
          ariaLabel="Sign out"
          onClick={onSignOut}
          variant="outline-light"
          tooltipPlacement="bottom"
        />
      )}
    </Nav>
  );
}

export default TopActionBar;

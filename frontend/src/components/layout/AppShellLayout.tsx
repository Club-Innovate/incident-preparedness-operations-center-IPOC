import React, { type ReactNode } from 'react';
import { Col, Container, Modal, Navbar, Row, Toast, ToastContainer } from 'react-bootstrap';
import type { ToastState } from '../../notifications/types';
import TopActionBar from './TopActionBar';
import NavigationPaneCard from './NavigationPaneCard';
import ThemeCustomizerModal from './ThemeCustomizerModal';
import type { ThemePalette } from '../../theme';

type AppShellLayoutProps = {
  currentUserLabel: string;
  alertCount: number;
  incidentCount: number;
  operationsOpenTaskCount: number;
  planningSitrepCount: number;
  logisticsResourceRequestCount: number;
  financeActiveIncidentCount: number;
  afterActionClosedIncidentCount: number;
  hasAccounts: boolean;
  msalConfigured: boolean;
  navigationExpanded: boolean;
  navigationPaneWidth: number;
  activeView: 'dashboard' | 'incidents' | 'facilities' | 'reports' | 'cop' | 'operations' | 'planning' | 'logistics' | 'finance' | 'after-action';
  showAdminPanel: boolean;
  showThemeStudio: boolean;
  activeThemeId: string;
  activeThemeName: string;
  toastState: ToastState;
  onOpenAlertCenter: () => void;
  onOpenAdminPanel: () => void;
  onCloseAdminPanel: () => void;
  onOpenThemeStudio: () => void;
  onOpenHelp: () => void;
  onCloseThemeStudio: () => void;
  onApplyTheme: (theme: ThemePalette) => void;
  onNavigate: (view: 'dashboard' | 'incidents' | 'facilities' | 'reports' | 'cop' | 'operations' | 'planning' | 'logistics' | 'finance' | 'after-action') => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onToggleNavigation: () => void;
  onStartNavigationResize: (clientX: number) => void;
  onCloseToast: () => void;
  adminPanelContent: ReactNode;
  alertCenterPanel: ReactNode;
  assistantDock?: ReactNode;
  children: ReactNode;
};

function AppShellLayout({
  currentUserLabel,
  alertCount,
  incidentCount,
  operationsOpenTaskCount,
  planningSitrepCount,
  logisticsResourceRequestCount,
  financeActiveIncidentCount,
  afterActionClosedIncidentCount,
  hasAccounts,
  msalConfigured,
  navigationExpanded,
  navigationPaneWidth,
  activeView,
  showAdminPanel,
  showThemeStudio,
  activeThemeId,
  activeThemeName,
  toastState,
  onOpenAlertCenter,
  onOpenAdminPanel,
  onCloseAdminPanel,
  onOpenThemeStudio,
  onOpenHelp,
  onCloseThemeStudio,
  onApplyTheme,
  onNavigate,
  onSignIn,
  onSignOut,
  onToggleNavigation,
  onStartNavigationResize,
  onCloseToast,
  adminPanelContent,
  alertCenterPanel,
  assistantDock,
  children,
}: AppShellLayoutProps) {
  return (
    <React.Fragment>
      <div className="ipoc-shell min-vh-100">
        <Navbar variant="dark" expand="lg" className="ipoc-navbar border-bottom shadow-sm">
          <Container fluid>
            <Navbar.Brand className="ipoc-brand-block">
              <img src="/ipoc-logo.png" alt="IPOC" className="ipoc-brand-logo" />
            </Navbar.Brand>
            <TopActionBar
              currentUserLabel={currentUserLabel}
              alertCount={alertCount}
              hasAccounts={hasAccounts}
              msalConfigured={msalConfigured}
              onOpenAlertCenter={onOpenAlertCenter}
              onOpenAdminPanel={onOpenAdminPanel}
              onOpenThemeStudio={onOpenThemeStudio}
              onOpenHelp={onOpenHelp}
              onSignIn={onSignIn}
              onSignOut={onSignOut}
            />
          </Container>
        </Navbar>

        <Container fluid className="ipoc-main-container py-3">
          <Row className="gx-2 gy-3">
            <Col
              className={`nav-pane-col ${navigationExpanded ? '' : 'ipoc-nav-collapsed-col'}`}
              style={navigationExpanded
                ? { flex: `0 0 ${navigationPaneWidth}px`, maxWidth: `${navigationPaneWidth}px` }
                : undefined}
            >
              <NavigationPaneCard
                navigationExpanded={navigationExpanded}
                activeView={activeView}
                incidentCount={incidentCount}
                operationsOpenTaskCount={operationsOpenTaskCount}
                planningSitrepCount={planningSitrepCount}
                logisticsResourceRequestCount={logisticsResourceRequestCount}
                financeActiveIncidentCount={financeActiveIncidentCount}
                afterActionClosedIncidentCount={afterActionClosedIncidentCount}
                alertCount={alertCount}
                onToggleNavigation={onToggleNavigation}
                onStartResize={(clientX) => onStartNavigationResize(clientX)}
                onNavigate={onNavigate}
                onOpenAlertCenter={onOpenAlertCenter}
              />
            </Col>

            <Col>
              {children}
            </Col>
          </Row>
        </Container>

        <Modal
          show={showAdminPanel}
          onHide={onCloseAdminPanel}
          size="xl"
          centered
          scrollable
          className="ipoc-themed-panel ipoc-admin-modal"
          dialogClassName="ipoc-admin-modal-dialog"
        >
          <Modal.Header closeButton>
            <Modal.Title>Administration</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {adminPanelContent}
          </Modal.Body>
        </Modal>

        <ThemeCustomizerModal
          show={showThemeStudio}
          activeThemeId={activeThemeId}
          activeThemeName={activeThemeName}
          onHide={onCloseThemeStudio}
          onApplyTheme={onApplyTheme}
        />

        <div className="ipoc-themed-panel">
          {alertCenterPanel}
        </div>

        {assistantDock}

        <ToastContainer position="bottom-end" className="p-3 ipoc-toast-container">
          <Toast
            key={toastState.sequence}
            className={`ipoc-toast ipoc-toast-${toastState.variant} ${toastState.show ? 'ipoc-toast-visible' : 'ipoc-toast-hidden'}`}
            show={toastState.show}
            onClose={onCloseToast}
            delay={3500}
            autohide
            animation={false}
          >
            <Toast.Body>{toastState.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </div>
    </React.Fragment>
  );
}

export default AppShellLayout;

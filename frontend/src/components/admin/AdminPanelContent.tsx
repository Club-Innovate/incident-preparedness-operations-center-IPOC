import { useState } from 'react';
import { Badge, ListGroup } from 'react-bootstrap';
import { getAuthTokenDebug } from '../../api';
import { authDiagnostics } from '../../authConfig';
import type { NotifyHandler } from '../../notifications/types';
import type { AuthMeResponse, AuthTokenDebugResponse, SystemReadiness } from '../../types';
import IconActionButton from '../common/IconActionButton';
import LookupAdminCard from './LookupAdminCard';

type AdminPanelContentProps = {
  readiness: SystemReadiness | null;
  authMe: AuthMeResponse | null;
  authMeError: string | null;
  isAuthenticated: boolean;
  onNotify: NotifyHandler;
};

function AdminPanelContent({ readiness, authMe, authMeError, isAuthenticated, onNotify }: AdminPanelContentProps) {
  const [tokenDebug, setTokenDebug] = useState<AuthTokenDebugResponse | null>(null);
  const [tokenDebugLoading, setTokenDebugLoading] = useState(false);

  const handleLoadTokenDebug = async () => {
    if (!isAuthenticated) {
      onNotify('Sign in before loading token debug claims.', 'warning');
      return;
    }

    try {
      setTokenDebugLoading(true);
      const payload = await getAuthTokenDebug();
      setTokenDebug(payload);
      onNotify('Token debug claims loaded.', 'success');
    } catch (debugError) {
      const message = debugError instanceof Error ? debugError.message : 'Unable to load token debug claims.';
      onNotify(message, 'danger');
    } finally {
      setTokenDebugLoading(false);
    }
  };

  return (
    <>
      <ListGroup className="mb-3">
        <ListGroup.Item>
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-semibold">System Status</span>
            <Badge bg={readiness?.status === 'Healthy' ? 'success' : 'danger'}>{readiness?.status ?? 'Unknown'}</Badge>
          </div>
          <div className="text-muted small mt-1">Environment: {readiness?.environment ?? 'n/a'}</div>
        </ListGroup.Item>

        <ListGroup.Item>
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-semibold">SQL Connectivity</span>
            <Badge bg={readiness?.sqlConnectionConfigured ? 'success' : 'secondary'}>
              {readiness?.sqlConnectionConfigured ? 'Configured' : 'Missing'}
            </Badge>
          </div>
          <div className="text-muted small mt-1">Config key: ConnectionStrings:IocEm</div>
          <div className="text-muted small">File: IPOC_WEB.Server/appsettings.Development.json</div>
        </ListGroup.Item>

        <ListGroup.Item>
          <LookupAdminCard
            isAuthenticated={isAuthenticated}
            onNotify={onNotify}
          />
        </ListGroup.Item>

        <ListGroup.Item>
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-semibold">Auth Scope Check</span>
            <Badge bg={authMe?.isAuthenticated ? 'success' : 'secondary'}>
              {authMe?.isAuthenticated ? 'Signed In' : 'Not Signed In'}
            </Badge>
          </div>
          {authMeError && <div className="text-muted small mt-1">{authMeError}</div>}
          {!authMeError && authMe && (
            <div className="text-muted small mt-1">{authMe.scopes.length > 0 ? authMe.scopes.join(', ') : 'No scopes in token'}</div>
          )}
          {!authMeError && !authMe && <div className="text-muted small mt-1">Sign in to validate claims.</div>}
          <div className="mt-2">
            <IconActionButton
              iconClassName={tokenDebugLoading ? 'bi bi-arrow-repeat' : 'bi bi-shield-lock'}
              tooltip="Load token debug claims (audience, issuer, scopes, and roles)."
              ariaLabel="Load token debug claims"
              onClick={() => void handleLoadTokenDebug()}
              variant="outline-secondary"
              disabled={tokenDebugLoading}
            />
          </div>
          {tokenDebug && (
            <div className="text-muted small mt-2">
              <div>aud: {tokenDebug.audience ?? 'n/a'}</div>
              <div>iss: {tokenDebug.issuer ?? 'n/a'}</div>
              <div>scopes: {tokenDebug.scopes.length > 0 ? tokenDebug.scopes.join(', ') : 'none'}</div>
              <div>roles: {tokenDebug.roles.length > 0 ? tokenDebug.roles.join(', ') : 'none'}</div>
              <div>configuredAudience: {tokenDebug.configuredAudience ?? 'n/a'}</div>
              <div>configuredAuthority: {tokenDebug.configuredAuthority ?? 'n/a'}</div>
            </div>
          )}
        </ListGroup.Item>
      </ListGroup>

      <div className="text-muted small">
        Sign-in diagnostics: redirectUri={authDiagnostics.redirectUri}; origin={authDiagnostics.currentOrigin}; tenantConfigured={String(authDiagnostics.tenantConfigured)}; clientConfigured={String(authDiagnostics.clientConfigured)}; apiScopeConfigured={String(authDiagnostics.apiScopeConfigured)}.
      </div>
      <div className="text-muted small mt-2">
        If AADSTS65005 appears, the API scope in VITE_API_SCOPE is not exposed/consented yet. Login now uses OIDC scopes only; API token acquisition still requires a valid exposed scope.
      </div>
    </>
  );
}

export default AdminPanelContent;

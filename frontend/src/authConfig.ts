/*
File: frontend/src/authConfig.ts
Blueprint Name: FrontendAuthConfig

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-06-22

Description:
MSAL client configuration and diagnostics metadata for Entra-based SPA authentication.

Features:
  - Tenant/client/scope-driven auth configuration.
  - Login and token request scope definitions.
  - Runtime diagnostics values for troubleshooting.

Security & Compliance:
  - Keeps credentials externalized through environment configuration.
  - Uses minimal login scopes and explicit API scope separation.
*/

import type { Configuration } from '@azure/msal-browser';

const tenantId = import.meta.env.VITE_AZURE_TENANT_ID ?? '';
const configuredClientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? '';
const apiScope = import.meta.env.VITE_API_SCOPE ?? '';
const configuredRedirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI ?? '';
const redirectUri = window.location.origin;

const hasPlaceholderValue = (value: string) => value.includes('<') || value.includes('>');
const hasConfiguredApiScope = apiScope.length > 0 && !hasPlaceholderValue(apiScope);

export const msalConfigured =
  configuredClientId.length > 0 &&
  tenantId.length > 0 &&
  !hasPlaceholderValue(configuredClientId) &&
  !hasPlaceholderValue(tenantId);

const fallbackClientId = '00000000-0000-0000-0000-000000000000';
const effectiveClientId = configuredClientId.length > 0 ? configuredClientId : fallbackClientId;

export const msalConfig: Configuration = {
  auth: {
    clientId: effectiveClientId,
    authority: tenantId.length > 0 ? `https://login.microsoftonline.com/${tenantId}` : undefined,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'offline_access'],
};

export const tokenRequest = {
  scopes: hasConfiguredApiScope ? [apiScope] : [],
};

export const authDiagnostics = {
  tenantConfigured: tenantId.length > 0 && !hasPlaceholderValue(tenantId),
  clientConfigured: configuredClientId.length > 0 && !hasPlaceholderValue(configuredClientId),
  apiScopeConfigured: hasConfiguredApiScope,
  redirectUri,
  currentOrigin: window.location.origin,
  redirectUriOverrideConfigured: configuredRedirectUri.length > 0,
};

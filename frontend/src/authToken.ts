/*
File: frontend/src/authToken.ts
Blueprint Name: FrontendTokenAcquisition

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-06-23

Description:
Token acquisition helper for frontend API authorization.

Features:
  - Silent token acquisition for configured API scopes.
  - Interactive redirect fallback for consent or re-auth requirements.
  - Shared MSAL instance registration.

Security & Compliance:
  - Does not persist or log token values in application code.
  - Uses delegated token flow consistent with Entra SPA patterns.
*/

import { InteractionRequiredAuthError, type IPublicClientApplication } from '@azure/msal-browser';
import { loginRequest, tokenRequest } from './authConfig';

let msalInstance: IPublicClientApplication | null = null;

export function setMsalInstance(instance: IPublicClientApplication): void {
  msalInstance = instance;
}

export async function getAccessToken(): Promise<string | null> {
  if (!msalInstance || tokenRequest.scopes.length === 0) {
    return null;
  }

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    return null;
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      ...tokenRequest,
      account: accounts[0],
    });

    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect(tokenRequest.scopes.length > 0
        ? tokenRequest
        : loginRequest);
      return null;
    }

    console.error('Token acquisition failed.', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'No error message available.',
    });

    return null;
  }
}

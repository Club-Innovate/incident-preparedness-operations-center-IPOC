import { useEffect, useRef, useState } from 'react';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { authDiagnostics, loginRequest, msalConfigured } from '../authConfig';
import { getAuthMe, writeLoginAuditEvent, writeLogoutAuditEvent } from '../api';
import type { NotifyHandler } from '../notifications/types';
import type { AuthMeResponse } from '../types';

type AuthSessionActionDeps = {
  instance: IPublicClientApplication;
  accountsLength: number;
  onNotify: NotifyHandler;
};

export function useAuthSessionActions({ instance, accountsLength, onNotify }: AuthSessionActionDeps) {
  const [authMe, setAuthMe] = useState<AuthMeResponse | null>(null);
  const [authMeError, setAuthMeError] = useState<string | null>(null);
  const inactivityLogoutInProgressRef = useRef(false);

  useEffect(() => {
    const loadAuthDiagnostics = async () => {
      if (!msalConfigured || accountsLength === 0) {
        setAuthMe(null);
        setAuthMeError(null);
        return;
      }

      try {
        setAuthMeError(null);
        const me = await getAuthMe();
        setAuthMe(me);
        try {
          await writeLoginAuditEvent();
        } catch {
          // Non-blocking: operational login should not fail on audit write failure.
        }
      } catch (authError) {
        setAuthMe(null);
        const message = authError instanceof Error ? authError.message : 'Unable to load auth diagnostics.';
        if (message.includes('Authentication required.')) {
          setAuthMeError(null);
          return;
        }

        setAuthMeError(message);
      }
    };

    void loadAuthDiagnostics();
  }, [accountsLength]);

  const handleSignIn = async () => {
    if (!msalConfigured) {
      const missing: string[] = [];

      if (!authDiagnostics.tenantConfigured) {
        missing.push('VITE_AZURE_TENANT_ID');
      }

      if (!authDiagnostics.clientConfigured) {
        missing.push('VITE_AZURE_CLIENT_ID');
      }

      onNotify(`Sign-in is not configured. Missing: ${missing.join(', ') || 'configuration values'}.`, 'warning');
      return;
    }

    try {
      await instance.loginRedirect(loginRequest);
      onNotify('Redirecting to Microsoft sign-in...', 'info');
    } catch (signInError) {
      const message = signInError instanceof Error ? signInError.message : 'Unable to start sign-in flow.';
      const scopeHint = message.includes('AADSTS65005')
        ? ' Scope is not exposed in Entra yet. Add API scope access_as_user or update VITE_API_SCOPE to an existing exposed scope.'
        : '';
      onNotify(`${message}${scopeHint}`, 'danger');
    }
  };

  const handleSignOut = async () => {
    try {
      try {
        await writeLogoutAuditEvent();
      } catch {
        // Non-blocking: proceed with sign-out even if audit write fails.
      }

      await instance.logoutRedirect();
    } catch (signOutError) {
      const message = signOutError instanceof Error ? signOutError.message : 'Unable to sign out.';
      onNotify(message, 'danger');
    }
  };

  useEffect(() => {
    if (accountsLength === 0 || !msalConfigured) {
      inactivityLogoutInProgressRef.current = false;
      return;
    }

    const parsedTimeoutMinutes = Number.parseInt(import.meta.env.VITE_AUTH_INACTIVITY_TIMEOUT_MINUTES ?? '30', 10);
    const timeoutMinutes = Number.isFinite(parsedTimeoutMinutes) && parsedTimeoutMinutes > 0
      ? parsedTimeoutMinutes
      : 30;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    let inactivityTimerId: number | null = null;

    const clearInactivityTimer = () => {
      if (inactivityTimerId !== null) {
        window.clearTimeout(inactivityTimerId);
        inactivityTimerId = null;
      }
    };

    const triggerInactivityLogout = async () => {
      if (inactivityLogoutInProgressRef.current) {
        return;
      }

      inactivityLogoutInProgressRef.current = true;
      onNotify(`Session expired after ${timeoutMinutes} minutes of inactivity. Redirecting to sign in.`, 'warning');

      try {
        try {
          await writeLogoutAuditEvent();
        } catch {
          // Non-blocking: continue logout even if audit write fails.
        }

        await instance.logoutRedirect();
      } catch (logoutError) {
        inactivityLogoutInProgressRef.current = false;
        const message = logoutError instanceof Error ? logoutError.message : 'Unable to sign out after session timeout.';
        onNotify(message, 'danger');
      }
    };

    const resetInactivityTimer = () => {
      clearInactivityTimer();
      inactivityTimerId = window.setTimeout(() => {
        void triggerInactivityLogout();
      }, timeoutMs);
    };

    const interactionEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'touchstart'];

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      clearInactivityTimer();
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });
    };
  }, [accountsLength, instance, onNotify]);

  return {
    authMe,
    authMeError,
    handleSignIn,
    handleSignOut,
  };
}

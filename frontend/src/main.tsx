/*
File: frontend/src/main.tsx
Blueprint Name: FrontendBootstrap

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-14

Description:
Frontend application bootstrap entrypoint.

Features:
  - Initializes MSAL public client instance.
  - Registers global providers and styles.
  - Renders root application shell.

Security & Compliance:
  - Ensures centralized auth provider initialization before app render.
  - Keeps auth configuration sourced from controlled config module.
*/

import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './index.css';
import App from './App.tsx';
import { msalConfig } from './authConfig';
import { setMsalInstance } from './authToken';

const msalInstance = new PublicClientApplication(msalConfig);
setMsalInstance(msalInstance);

const bootstrap = async () => {
  await msalInstance.initialize();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  );
};

void bootstrap();

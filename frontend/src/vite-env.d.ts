/*
File: frontend/src/vite-env.d.ts
Blueprint Name: FrontendEnvTyping

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-12

Description:
Vite environment variable type declarations for frontend build-time config.

Features:
  - Typed access to Entra tenant/client/scope environment variables.

Security & Compliance:
  - Supports controlled and explicit environment-driven configuration usage.
*/

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV?: boolean;
  readonly PROD?: boolean;
  readonly MODE?: string;
  readonly VITE_AZURE_TENANT_ID?: string;
  readonly VITE_AZURE_CLIENT_ID?: string;
  readonly VITE_API_SCOPE?: string;
  readonly VITE_AUTH_INACTIVITY_TIMEOUT_MINUTES?: string;
  readonly VITE_POWERBI_EMBED_URL?: string;
  readonly VITE_IPOC_AGENT_AZURE_AI?: string;
  readonly VITE_AZURE_OPENAI_DEPLOYMENT?: string;
  readonly VITE_AZURE_OPENAI_API_VERSION?: string;
  readonly VITE_AZURE_SEARCH_INDEX_NAME?: string;
  readonly VITE_AZURE_SEARCH_QUERY_TYPE?: string;
  readonly VITE_COP_LIVE_OVERLAY_FEED?: string;
  readonly VITE_IPOC_NAV_PLANNING_AI_ENABLED?: string;
  readonly VITE_IPOC_NAV_FINANCE_PREDICTIVE_ENABLED?: string;
  readonly VITE_IPOC_NAV_AFTER_ACTION_AI_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'react-leaflet' {
  export const MapContainer: any;
  export const Marker: any;
  export const Popup: any;
  export const ScaleControl: any;
  export const TileLayer: any;
  export const Tooltip: any;
  export const ZoomControl: any;
  export function useMap(): any;
  export function useMapEvents(events: Record<string, (event: any) => void>): any;
}

declare module 'react-leaflet-cluster' {
  const MarkerClusterGroup: any;
  export default MarkerClusterGroup;
}

declare module 'leaflet/dist/leaflet.css';

declare module '*.css';

declare module '@azure/msal-react' {
  export function useMsal(): {
    instance: any;
    accounts: Array<{ name?: string; username?: string }>;
    inProgress: any;
  };

  export const MsalProvider: any;
}

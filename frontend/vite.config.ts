/*
File: frontend/vite.config.ts
Blueprint Name: FrontendBuildConfig

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-02

Description:
Vite configuration for local HTTPS dev hosting, API proxying, and production build tuning.

Features:
  - HTTPS development host configuration with local certificate support.
  - API proxy routing to backend service endpoints.
  - Build output tuning and chunk splitting settings.

Security & Compliance:
  - Uses local TLS dev cert to align secure redirect URI behavior.
  - Avoids embedding secrets in client build config.
*/

import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const certPath = path.resolve(__dirname, '.cert', 'aspnetapp.pem');
const keyPath = path.resolve(__dirname, '.cert', 'aspnetapp.key');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    https: fs.existsSync(certPath) && fs.existsSync(keyPath)
      ? {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        }
      : undefined,
    port: 51009,
    strictPort: true,
    proxy: {
      // Proxy API calls to the app service
      '/api': {
        target: process.env.SERVER_HTTPS || process.env.SERVER_HTTP,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    cssCodeSplit: true,
    rolldownOptions: {
      output: {
        codeSplitting: true,
      },
    },
  },
});

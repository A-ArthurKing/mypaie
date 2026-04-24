/*
 * Fichier : vite.config.js
 * Rôle    : Configuration Vite — port 5569, proxy /api vers Flask sur 5000.
 * Module  : mypaie / frontend
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5569,
    proxy: {
      // Redirige tous les appels /api/* vers le serveur Flask Python
      "/api": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
      },
    },
  },
});

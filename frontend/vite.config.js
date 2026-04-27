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
    host: true, // Écouter sur toutes les interfaces (important pour Docker)
    proxy: {
      // Redirige tous les appels /api/* vers le serveur Flask Python
      // "backend" est le nom du service dans docker-compose.yml
      "/api": {
        target: "http://backend:5001",
        changeOrigin: true,
      },
    },
  },
});

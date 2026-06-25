import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The /preview/ deployment sets VITE_SAVE_SUFFIX; when present we also tag the
// PWA name so an installed preview icon stays distinct from the live game.
const previewTag = process.env.VITE_SAVE_SUFFIX ? " (Preview)" : "";

export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
  },
  server: {
    host: true,
    port: 5173,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "maskable-512x512.png",
      ],
      // Precache the whole built app shell so the game runs fully offline.
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      manifest: {
        name: "Realms of Valor" + previewTag,
        short_name: "Realms" + previewTag,
        description:
          "A fairy-tale, turn-based strategy game inspired by Heroes of Might & Magic II.",
        theme_color: "#1a120a",
        background_color: "#0c0a06",
        display: "fullscreen",
        orientation: "any",
        start_url: "./",
        scope: "./",
        categories: ["games", "entertainment"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});

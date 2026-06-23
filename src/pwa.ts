// Registers the service worker so the game is installable and runs offline.
// With registerType "autoUpdate", a new build silently takes over on the next
// visit; we just reload once it's ready so players always get the latest realm.
import { registerSW } from "virtual:pwa-register";

export function registerPWA(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      updateSW(true);
    },
    onOfflineReady() {
      console.info("Realms of Valor is ready to play offline.");
    },
  });
}

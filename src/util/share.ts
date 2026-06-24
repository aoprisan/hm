// Sharing helpers for inviting friends to the game. There is no save state to
// encode, so the shared link is just the app URL — opening it launches the game.

const SHARE_TITLE = "Realms of Valor";
const SHARE_TEXT = "Play Realms of Valor!";

// A clean, shareable URL for this deployment (origin + path, no query/hash).
export function shareUrl(): string {
  return location.origin + location.pathname;
}

// Try the native share sheet, then fall back to copying the link to the clipboard.
// Returns what actually happened so the caller can show appropriate feedback.
export async function genericShare(): Promise<"shared" | "copied" | "unavailable"> {
  const url = shareUrl();
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
  };
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
      return "shared";
    } catch (e) {
      // The user dismissing the native sheet rejects with AbortError — treat as
      // a no-op rather than falling through to clipboard.
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
      // Otherwise fall through to the clipboard path below.
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "unavailable";
    }
  }
  return "unavailable";
}

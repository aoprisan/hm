// Resource / date readout, drawn as a translucent overlay bar. Adapts to the
// available width: on narrow (portrait) bars it shows only the core economy
// resources (gold/wood/ore) plus the date; wider bars show the full set.
import { GameState } from "../game/state";
import { RESOURCE_ORDER, ResourceKind } from "../data/resources";
import { resourceIcon } from "../art/sprites_ui";
import { glass, text } from "./widgets";

export const HUD_H = 44;

const CORE: ResourceKind[] = ["wood", "ore", "gold"];

// Draw a resource bar inside the given rect. Returns nothing; purely visual.
export function drawResourceBar(
  ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number, w: number, h: number,
): void {
  glass(ctx, x, y, w, h, 0, 0.62);
  const cy = y + h / 2;
  const compact = w < 560;
  // Reserve room on the right for the date readout.
  const dateStr = compact
    ? `${state.dayName.slice(0, 3)}·W${state.week}`
    : `${state.dayName} · Week ${state.week}`;
  ctx.font = "bold 15px 'Trebuchet MS'";
  const dateW = ctx.measureText(dateStr).width + 16;

  const kinds = compact ? CORE : RESOURCE_ORDER;
  let cx = x + 12;
  const maxX = x + w - dateW;
  for (const k of kinds) {
    const icon = resourceIcon(k);
    const valStr = String(state.resources[k]);
    ctx.font = "bold 15px 'Trebuchet MS'";
    const slotW = icon.width + 6 + ctx.measureText(valStr).width + (k === "gold" ? 16 : 14);
    if (cx + slotW > maxX) break; // ran out of room
    ctx.drawImage(icon, cx, Math.round(cy - icon.height / 2));
    text(ctx, valStr, cx + icon.width + 4, cy + 5, "#fff0c8", "bold 15px 'Trebuchet MS'");
    cx += slotW;
  }
  text(ctx, dateStr, x + w - 12, cy + 5, "#fff0c8", "bold 15px 'Trebuchet MS'", "right");
}

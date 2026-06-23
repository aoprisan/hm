// Bottom resource bar + date readout (HOMM2-style status strip).
import { GameState } from "../game/state";
import { RESOURCE_ORDER } from "../data/resources";
import { resourceIcon } from "../art/sprites_ui";
import { panel, text } from "./widgets";

export const HUD_H = 44;

export function drawHud(ctx: CanvasRenderingContext2D, state: GameState, vw: number, vh: number): void {
  const y = vh - HUD_H;
  panel(ctx, 0, y, vw, HUD_H);
  let x = 16;
  for (const k of RESOURCE_ORDER) {
    const icon = resourceIcon(k);
    ctx.drawImage(icon, x, y + 12, icon.width, icon.height);
    text(ctx, String(state.resources[k]), x + 24, y + 27, "#fff0c8", "bold 15px 'Trebuchet MS'");
    x += k === "gold" ? 24 + ctx.measureText(String(state.resources[k])).width + 30 : 78;
  }
  // date on the right
  text(
    ctx,
    `Week ${state.week}, Day ${state.dayOfWeek}`,
    vw - 16, y + 27, "#fff0c8", "bold 16px 'Trebuchet MS'", "right",
  );
}

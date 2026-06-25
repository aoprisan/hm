// Compact hero readout: level, attack, defense and experience progress, shown
// wherever the hero appears (the adventure army sheet and the town hero strip).
import { Hero } from "../game/hero";
import { text } from "./widgets";

// Draw the badge at (x, y) within width `w`. `dark` selects colors for a dark
// overlay (true) vs. a light parchment card (false). When `bar` is false only
// the single stat line is drawn (with XP shown as text on the right).
export function heroBadge(
  ctx: CanvasRenderingContext2D, hero: Hero, x: number, y: number, w: number,
  opts: { dark?: boolean; bar?: boolean } = {},
): void {
  const dark = opts.dark ?? true;
  const labelCol = dark ? "#e8d6a4" : "#5b3a1a";
  const next = hero.expForNextLevel();
  text(ctx, `Lv ${hero.level}    ATK ${hero.attack}    DEF ${hero.defense}`,
    x, y, labelCol, "13px 'Trebuchet MS'");

  if (opts.bar === false) {
    text(ctx, `XP ${hero.experience}/${next}`, x + w, y,
      dark ? "#bfa15a" : "#7a5a30", "12px 'Trebuchet MS'", "right");
    return;
  }

  const by = y + 6;
  const frac = Math.max(0, Math.min(1, hero.experience / next));
  ctx.fillStyle = dark ? "#2a1d10" : "#9c7c44";
  ctx.fillRect(x, by, w, 9);
  ctx.fillStyle = dark ? "#c08a30" : "#c8a030";
  ctx.fillRect(x + 1, by + 1, (w - 2) * frac, 7);
  text(ctx, `XP ${hero.experience}/${next}`, x + w / 2, by + 8,
    dark ? "#fff0c8" : "#3a2410", "10px 'Trebuchet MS'", "center");
}

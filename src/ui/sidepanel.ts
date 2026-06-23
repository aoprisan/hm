// Right-hand command panel: hero portrait + army, movement points, and a minimap.
import { GameState } from "../game/state";
import { CREATURES } from "../data/creatures";
import { creatureSprite } from "../art/sprites_creatures";
import { heroSprite } from "../art/sprites_objects";
import { panel, parchment, text, textShadow, Rect } from "./widgets";

const TERRAIN_COLOR: Record<string, string> = {
  grass: "#4f8a3a", dirt: "#b3863f", sand: "#d8b06a", forest: "#2f5a22",
  water: "#2f6fb0", mountain: "#7d756a", rock: "#5f574c",
};

export function drawSidePanel(ctx: CanvasRenderingContext2D, state: GameState, p: Rect, mapView: Rect, camX: number, camY: number): void {
  panel(ctx, p.x, p.y, p.w, p.h);
  const inner = p.x + 12;
  // ---- hero card ----
  parchment(ctx, p.x + 10, p.y + 10, p.w - 20, 92);
  heroSprite.draw(ctx, p.x + 18, p.y + 20, 4);
  textShadow(ctx, state.hero.name, inner + 80, p.y + 32, "#3a2410", "bold 16px 'Trebuchet MS'");
  text(ctx, `Level ${state.hero.level}`, inner + 80, p.y + 52, "#5b3a1a", "13px 'Trebuchet MS'");
  text(ctx, `Atk ${state.hero.attack}  Def ${state.hero.defense}`, inner + 80, p.y + 70, "#5b3a1a", "13px 'Trebuchet MS'");
  // movement bar
  const mvFrac = state.hero.movePoints / state.hero.maxMovePoints;
  text(ctx, "Move", inner, p.y + 90, "#5b3a1a", "11px 'Trebuchet MS'");
  ctx.fillStyle = "#3a2410";
  ctx.fillRect(inner + 40, p.y + 80, p.w - 64, 10);
  ctx.fillStyle = mvFrac > 0.25 ? "#4f8a3a" : "#c8413a";
  ctx.fillRect(inner + 41, p.y + 81, (p.w - 66) * mvFrac, 8);

  // ---- army row ----
  const ay = p.y + 116;
  text(ctx, "Army", inner, ay - 4, "#fff0c8", "bold 13px 'Trebuchet MS'");
  const slotW = (p.w - 24) / 5;
  for (let i = 0; i < 5; i++) {
    const sx = p.x + 12 + i * slotW;
    panel(ctx, sx, ay, slotW - 4, 56, "#5b4a36", "#6a5a44", "#2a1d10");
    const s = state.hero.army[i];
    if (s && s.count > 0) {
      const spr = creatureSprite(s.id);
      const sc = Math.max(1, Math.floor(Math.min((slotW - 12) / spr.w, 34 / spr.h)));
      spr.drawCenteredBottom(ctx, sx + (slotW - 4) / 2, ay + 40, sc);
      textShadow(ctx, String(s.count), sx + (slotW - 4) / 2, ay + 53, "#fff0c8", "bold 13px 'Trebuchet MS'", "center");
    }
  }

  // ---- minimap ----
  const mmSize = p.w - 28;
  const mmX = p.x + 14;
  const mmY = p.y + p.h - mmSize - 70;
  panel(ctx, mmX - 4, mmY - 4, mmSize + 8, mmSize + 8, "#2a1d10", "#3a2410", "#1c1208");
  const map = state.map;
  const cell = mmSize / map.width;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!state.fog.isRevealed(x, y)) {
        ctx.fillStyle = "#1a140c";
      } else {
        ctx.fillStyle = TERRAIN_COLOR[map.terrainAt(x, y)] ?? "#4f8a3a";
      }
      ctx.fillRect(mmX + x * cell, mmY + y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  // object dots
  for (const o of map.objects) {
    if (!state.fog.isRevealed(o.x, o.y)) continue;
    let col: string | null = null;
    if (o.type === "castle") col = "#6fb0e6";
    else if (o.type === "stronghold") col = "#c8413a";
    else if (o.type === "mine") col = o.owner === "player" ? "#6fb0e6" : "#f2c44d";
    if (col) {
      ctx.fillStyle = col;
      ctx.fillRect(mmX + o.x * cell - 1, mmY + o.y * cell - 1, 3, 3);
    }
  }
  // hero dot
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(mmX + state.hero.fx * cell - 1, mmY + state.hero.fy * cell - 1, 3, 3);
  // viewport rectangle
  const tile = mapView.w / Math.round(mapView.w / 32); // ~32
  void tile;
  ctx.strokeStyle = "#fff0c8";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    mmX + (camX / 32) * cell,
    mmY + (camY / 32) * cell,
    (mapView.w / 32) * cell,
    (mapView.h / 32) * cell,
  );
}

// small helper exported for tooltips
export function creatureName(id: keyof typeof CREATURES): string {
  return CREATURES[id].name;
}

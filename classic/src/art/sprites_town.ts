// Town (castle) screen art: a painted fairy-tale backdrop plus a distinct
// structure for each building. Buildings are drawn centered on their anchor's
// bottom. The TownScene dims structures that aren't built yet.
import { BuildingId, DWELLING_IDS } from "../data/buildings";
import { FactionId, FACTIONS } from "../data/factions";

function mk(w: number, h: number): { cv: HTMLCanvasElement; c: CanvasRenderingContext2D } {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return { cv, c: cv.getContext("2d")! };
}
function r(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}
function tri(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, col: string): void {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath(); c.fill();
}

// lighten/darken a #rrggbb hex toward white/black by `amt` in [-1,1].
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (sh: number) => {
    let v = (n >> sh) & 0xff;
    v = amt >= 0 ? v + (255 - v) * amt : v * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  const to2 = (v: number) => v.toString(16).padStart(2, "0");
  return `#${to2(ch(16))}${to2(ch(8))}${to2(ch(0))}`;
}

const bgCache = new Map<string, HTMLCanvasElement>();
export function townBackground(w: number, h: number, faction: FactionId): HTMLCanvasElement {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const key = `${faction}-${w}x${h}`;
  const hit = bgCache.get(key);
  if (hit) return hit;
  const pal = FACTIONS[faction].palette;
  const { cv, c } = mk(w, h);
  const dark = faction === "warlock" || faction === "necropolis";

  // sky gradient
  const horizon = h * 0.40;
  const g = c.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, pal.sky[0]);
  g.addColorStop(1, pal.sky[1]);
  c.fillStyle = g;
  c.fillRect(0, 0, w, Math.ceil(horizon) + 2);

  // soft sun / moon with a halo
  const lum = dark ? "rgba(225,225,245,0.85)" : "rgba(255,240,176,0.9)";
  c.fillStyle = dark ? "rgba(200,200,235,0.10)" : "rgba(255,240,176,0.18)";
  c.beginPath(); c.arc(w - 150, 88, 76, 0, Math.PI * 2); c.fill();
  c.fillStyle = lum;
  c.beginPath(); c.arc(w - 150, 88, 44, 0, Math.PI * 2); c.fill();

  // drifting clouds (or eerie wisps for dark factions)
  const cloud = dark ? "rgba(180,180,200,0.16)" : "rgba(255,255,255,0.55)";
  for (const [cx, cy, s] of [[w * 0.18, h * 0.14, 1.1], [w * 0.62, h * 0.1, 0.8], [w * 0.84, h * 0.22, 0.9]] as const) {
    c.fillStyle = cloud;
    for (const [dx, dy, rr] of [[-34, 6, 20], [-8, -4, 26], [22, 6, 22], [50, 8, 16]] as const) {
      c.beginPath(); c.ellipse(cx + dx * s, cy + dy * s, rr * s, rr * 0.7 * s, 0, 0, Math.PI * 2); c.fill();
    }
  }

  // two layers of distant mountains
  for (let i = 0; i < 6; i++) {
    const mx = i * (w / 5);
    tri(c, mx - 130, horizon + 4, mx, h * 0.16 + (i % 2) * 30, mx + 130, horizon + 4, shade(pal.mountain, 0.2));
  }
  for (let i = 0; i < 5; i++) {
    const mx = i * (w / 4) + 60;
    tri(c, mx - 150, horizon + 8, mx, h * 0.24 + (i % 2) * 22, mx + 150, horizon + 8, pal.mountain);
  }

  // rolling meadow with a soft front-to-back gradient (lighter near the back)
  const gg = c.createLinearGradient(0, horizon - 10, 0, h);
  gg.addColorStop(0, shade(pal.ground, 0.14));
  gg.addColorStop(0.5, pal.ground);
  gg.addColorStop(1, shade(pal.ground, -0.12));
  c.fillStyle = gg;
  c.fillRect(0, Math.floor(horizon - 10), w, h);

  // gentle rolling rises along the horizon for depth
  c.fillStyle = shade(pal.ground, 0.08);
  for (const [hx, hw2] of [[w * 0.22, w * 0.5], [w * 0.78, w * 0.55]] as const) {
    c.beginPath();
    c.ellipse(hx, horizon + 18, hw2, h * 0.12, 0, Math.PI, Math.PI * 2);
    c.fill();
  }

  // the grand castle motte: a rounded hill the keep sits upon (centered on the
  // castle anchor at design 472/1024, base near design 188/524).
  const mcx = w * (472 / 1024);
  const mTop = h * (178 / 524);
  const mW = w * 0.34;
  c.fillStyle = shade(pal.ground, -0.06);
  c.beginPath();
  c.moveTo(mcx - mW, h);
  c.bezierCurveTo(mcx - mW * 0.7, mTop + h * 0.18, mcx - mW * 0.34, mTop, mcx, mTop);
  c.bezierCurveTo(mcx + mW * 0.34, mTop, mcx + mW * 0.7, mTop + h * 0.18, mcx + mW, h);
  c.closePath();
  c.fill();
  // sunlit left flank of the motte
  c.fillStyle = shade(pal.ground, 0.10);
  c.beginPath();
  c.moveTo(mcx - mW, h);
  c.bezierCurveTo(mcx - mW * 0.7, mTop + h * 0.18, mcx - mW * 0.34, mTop, mcx, mTop);
  c.lineTo(mcx, h);
  c.closePath();
  c.fill();

  // ground speckle
  c.fillStyle = pal.groundDetail;
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * w;
    const y = horizon + Math.random() * (h - horizon);
    c.fillRect(x | 0, y | 0, 2, 1);
  }

  // a winding road climbing the motte to the castle gate
  c.fillStyle = pal.road;
  c.beginPath();
  c.moveTo(w * 0.5 - 64, h);
  c.bezierCurveTo(w * 0.5 - 6, h * 0.82, mcx - 46, h * 0.6, mcx - 30, mTop + h * 0.06);
  c.lineTo(mcx + 30, mTop + h * 0.06);
  c.bezierCurveTo(mcx + 50, h * 0.62, w * 0.5 + 70, h * 0.84, w * 0.5 + 116, h);
  c.closePath();
  c.fill();
  // road edge highlight
  c.strokeStyle = shade(pal.road, 0.18);
  c.lineWidth = 2;
  c.stroke();

  // scattered flower tufts on the meadow (skip the gloomy factions)
  if (!dark) {
    const petals = ["#f2e4c0", "#f2c44d", "#e88aa0", "#a9d8f0"];
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w;
      const y = horizon + 20 + Math.random() * (h - horizon - 24);
      c.fillStyle = petals[(Math.random() * petals.length) | 0];
      c.fillRect(x | 0, y | 0, 2, 2);
      c.fillStyle = shade(pal.groundDetail, -0.1);
      c.fillRect(x | 0, (y + 2) | 0, 1, 2);
    }
  }

  bgCache.set(key, cv);
  return cv;
}

// ---- per-building structures ----
// Cached by `shared:<id>` for the 7 faction-agnostic buildings and by
// `<faction>:<dwellingN>` for the per-faction dwellings.
const bcache = new Map<string, HTMLCanvasElement>();

export function buildingArt(id: BuildingId, faction: FactionId): HTMLCanvasElement {
  const slot = DWELLING_IDS.indexOf(id as never);
  // The castle is faction-tinted (its roofs/banners match the town), so it is
  // cached per faction; the other shared buildings are faction-agnostic.
  const key = slot >= 0 ? `${faction}:${id}` : id === "castle" ? `castle:${faction}` : `shared:${id}`;
  const hit = bcache.get(key);
  if (hit) return hit;
  const out = slot >= 0 ? dwellingArt(faction, slot) : sharedBuildingArt(id, faction);
  bcache.set(key, out);
  return out;
}

function sharedBuildingArt(id: BuildingId, faction: FactionId): HTMLCanvasElement {
  switch (id) {
    case "castle": return drawCastle(faction);
    case "townHall": return drawTownHall();
    case "statue": return drawStatue();
    case "well": return drawWell();
    case "marketplace": return drawMarket();
    case "tavern": return drawTavern();
    case "mageGuild": return drawMageGuild();
    default: return mk(40, 40).cv;
  }
}

interface DwellingColors { wall: string; roof: string; accent: string; dark: string; }
const DWELLING_COLORS: Record<FactionId, DwellingColors> = {
  knight: { wall: "#d8b483", roof: "#8a5a2b", accent: "#c8413a", dark: "#3a2410" },
  sorceress: { wall: "#d8b483", roof: "#2f5a22", accent: "#79b85a", dark: "#5b3a1a" },
  warlock: { wall: "#5f574c", roof: "#7a3f9a", accent: "#c98ad8", dark: "#1c1610" },
  necropolis: { wall: "#e9e4d6", roof: "#5f574c", accent: "#9b938a", dark: "#3a2410" },
};

// Knight keeps its bespoke dwelling art; the other factions share six themed
// silhouettes (tier 1..6) tinted from their palette.
function dwellingArt(faction: FactionId, slot: number): HTMLCanvasElement {
  if (faction === "knight") {
    return [drawHut, drawArchery, drawBlacksmith, drawArmory, drawJousting, drawCathedral][slot]();
  }
  const col = DWELLING_COLORS[faction];
  return [genHut, genTower, genHall, genKeep, genLair, genTemple][slot](col);
}

function shadow(c: CanvasRenderingContext2D, cx: number, by: number, rw: number): void {
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath(); c.ellipse(cx, by, rw, 7, 0, 0, Math.PI * 2); c.fill();
}

// A grand, faction-tinted hilltop keep: a crenellated curtain wall with a
// gatehouse and portcullis, two flanking conical-roofed towers, and a tall
// central keep flying the town's banner. Drawn with its base at the canvas
// bottom so it rests on the motte painted into the background.
function drawCastle(faction: FactionId): HTMLCanvasElement {
  const pal = FACTIONS[faction].palette;
  const roof = pal.roofPrimary, flag = pal.banner;
  const stone = "#bcb4a6", dk = "#857c70", lt = "#d6cebe", glow = "#ffd98a";
  const { cv, c } = mk(236, 168);
  shadow(c, 118, 162, 110);

  // crenellated parapet helper
  const crenel = (x: number, y: number, wdt: number, merlon = 11, gap = 7) => {
    let cx = x;
    while (cx < x + wdt) { r(c, cx, y, Math.min(merlon, x + wdt - cx), 9, stone); cx += merlon + gap; }
  };

  // ---- central keep (rises behind the wall) ----
  const kx = 92, kw = 52, kTop = 26;
  r(c, kx, kTop, kw, 60, stone);
  r(c, kx, kTop, 7, 60, lt);
  r(c, kx + kw - 7, kTop, 7, 60, dk);
  crenel(kx - 2, kTop - 8, kw + 4);
  r(c, kx + 18, kTop + 18, 14, 22, "#241a10"); // tall arched window
  c.fillStyle = "#3a2a14"; c.beginPath(); c.arc(kx + 25, kTop + 18, 7, Math.PI, 0); c.fill();
  r(c, kx + 21, kTop + 22, 8, 12, glow);
  // keep banner on a pole
  r(c, kx + kw / 2 - 1, 2, 3, kTop - 2, "#5b3a1a");
  c.fillStyle = flag;
  c.beginPath(); c.moveTo(kx + kw / 2 + 2, 4); c.lineTo(kx + kw / 2 + 26, 11); c.lineTo(kx + kw / 2 + 2, 18); c.closePath(); c.fill();

  // ---- curtain wall ----
  const wy = 78;
  r(c, 30, wy, 176, 84, stone);
  r(c, 30, wy, 176, 7, lt);
  r(c, 30, wy + 78, 176, 6, dk);
  crenel(30, wy - 8, 176);
  // faint ashlar courses
  c.fillStyle = "rgba(90,80,66,0.25)";
  for (let y = wy + 18; y < wy + 78; y += 16) r(c, 34, y, 168, 1, "rgba(90,80,66,0.25)");

  // ---- gatehouse ----
  const gx = 96, gw = 44;
  r(c, gx, wy - 6, gw, 90, shade(stone, -0.06));
  r(c, gx, wy - 6, 6, 90, lt);
  crenel(gx - 1, wy - 16, gw + 2, 10, 6);
  // arched gate with portcullis + warm torchlight
  c.fillStyle = "#2a1d10";
  c.beginPath();
  c.moveTo(gx + 8, wy + 84); c.lineTo(gx + 8, wy + 40);
  c.arc(gx + gw / 2, wy + 40, gw / 2 - 8, Math.PI, 0);
  c.lineTo(gx + gw - 8, wy + 84); c.closePath(); c.fill();
  c.strokeStyle = "#6a5a44"; c.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(gx + 8 + i * 7, wy + 40); c.lineTo(gx + 8 + i * 7, wy + 84); c.stroke(); }
  for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(gx + 8, wy + 48 + i * 12); c.lineTo(gx + gw - 8, wy + 48 + i * 12); c.stroke(); }
  r(c, gx + gw / 2 - 8, wy + 70, 16, 14, glow); // lit doorway

  // ---- flanking towers with conical roofs ----
  for (const tx of [6, 188]) {
    r(c, tx, 50, 42, 112, stone);
    r(c, tx, 50, 7, 112, lt);
    r(c, tx + 35, 50, 7, 112, dk);
    crenel(tx - 1, 42, 44, 10, 7);
    // conical roof
    tri(c, tx + 21, 8, tx + 48, 50, tx - 6, 50, roof);
    tri(c, tx + 21, 8, tx + 48, 50, tx + 21, 50, shade(roof, -0.18));
    // finial pennant
    r(c, tx + 20, 0, 2, 10, "#5b3a1a");
    c.fillStyle = flag;
    c.beginPath(); c.moveTo(tx + 22, 1); c.lineTo(tx + 38, 6); c.lineTo(tx + 22, 11); c.closePath(); c.fill();
    // windows
    r(c, tx + 16, 72, 10, 14, "#241a10"); r(c, tx + 18, 76, 6, 8, glow);
    r(c, tx + 16, 104, 10, 14, "#241a10"); r(c, tx + 18, 108, 6, 8, glow);
  }
  return cv;
}

function drawTownHall(): HTMLCanvasElement {
  const { cv, c } = mk(150, 120);
  shadow(c, 75, 116, 64);
  r(c, 24, 50, 102, 66, "#cfc7b8");
  r(c, 24, 50, 102, 6, "#e9e4d6");
  tri(c, 14, 50, 75, 12, 136, 50, "#c8922a");
  tri(c, 75, 12, 136, 50, 75, 50, "#a8761f");
  // columns
  for (let i = 0; i < 4; i++) r(c, 34 + i * 26, 56, 8, 58, "#e9e4d6");
  r(c, 64, 80, 22, 36, "#3a2410");
  // gold dome flag
  r(c, 73, 0, 4, 14, "#5b3a1a");
  c.fillStyle = "#f2c44d";
  c.beginPath(); c.moveTo(77, 0); c.lineTo(92, 4); c.lineTo(77, 8); c.closePath(); c.fill();
  return cv;
}

function drawStatue(): HTMLCanvasElement {
  const { cv, c } = mk(70, 110);
  shadow(c, 35, 106, 28);
  r(c, 18, 78, 34, 28, "#9b938a");
  r(c, 22, 70, 26, 10, "#b8b0a2");
  // golden knight
  r(c, 30, 30, 10, 10, "#f2c44d"); // head
  r(c, 26, 40, 18, 26, "#c8922a"); // torso
  r(c, 28, 40, 4, 26, "#f2c44d");
  r(c, 44, 24, 4, 38, "#f2c44d"); // raised sword
  r(c, 41, 22, 10, 4, "#fff0b0");
  r(c, 28, 66, 6, 12, "#c8922a"); r(c, 38, 66, 6, 12, "#c8922a");
  return cv;
}

function drawWell(): HTMLCanvasElement {
  const { cv, c } = mk(90, 100);
  shadow(c, 45, 96, 38);
  r(c, 22, 56, 46, 40, "#9b938a");
  r(c, 22, 56, 46, 6, "#b8b0a2");
  for (let i = 0; i < 6; i++) r(c, 24 + i * 7, 62, 5, 34, "#7d756a");
  // posts + roof
  r(c, 24, 16, 5, 40, "#5b3a1a");
  r(c, 61, 16, 5, 40, "#5b3a1a");
  tri(c, 10, 22, 45, 0, 80, 22, "#8a2b27");
  r(c, 14, 22, 62, 6, "#5b3a1a");
  // bucket
  r(c, 40, 30, 10, 10, "#8a5a2b");
  return cv;
}

function drawMarket(): HTMLCanvasElement {
  const { cv, c } = mk(130, 100);
  shadow(c, 65, 96, 58);
  // stall base
  r(c, 16, 56, 98, 40, "#8a5a2b");
  r(c, 16, 56, 98, 6, "#b9824a");
  // striped awning
  for (let i = 0; i < 10; i++) r(c, 12 + i * 10, 38, 10, 18, i % 2 ? "#c8413a" : "#f2e4c0");
  r(c, 12, 36, 102, 4, "#8a2b27");
  // goods
  r(c, 24, 62, 12, 10, "#f2c44d");
  r(c, 44, 62, 12, 10, "#c98ad8");
  r(c, 64, 62, 12, 10, "#6fb0e6");
  r(c, 84, 62, 12, 10, "#79b85a");
  return cv;
}

function drawTavern(): HTMLCanvasElement {
  const { cv, c } = mk(120, 110);
  shadow(c, 60, 106, 52);
  r(c, 18, 50, 84, 56, "#d8b483");
  // timber framing
  for (const x of [18, 56, 94]) r(c, x, 50, 4, 56, "#5b3a1a");
  for (const y of [50, 78, 102]) r(c, 18, y, 84, 4, "#5b3a1a");
  tri(c, 8, 50, 60, 16, 112, 50, "#8a5a2b");
  r(c, 50, 78, 20, 28, "#3a2410");
  r(c, 26, 58, 14, 14, "#6fb0e6"); r(c, 80, 58, 14, 14, "#6fb0e6");
  // hanging sign
  r(c, 104, 40, 3, 20, "#3a2410");
  r(c, 98, 56, 16, 12, "#8a5a2b");
  r(c, 100, 58, 12, 8, "#f2c44d");
  return cv;
}

function drawMageGuild(): HTMLCanvasElement {
  const { cv, c } = mk(90, 140);
  shadow(c, 45, 136, 34);
  r(c, 26, 50, 38, 86, "#7a5fa0");
  r(c, 26, 50, 8, 86, "#9a7fc0");
  r(c, 56, 50, 8, 86, "#5a3f80");
  tri(c, 16, 50, 45, 4, 74, 50, "#3f2a66");
  // star
  c.fillStyle = "#f2c44d";
  c.font = "16px serif";
  c.fillText("✦", 38, 30);
  r(c, 38, 96, 14, 40, "#1c1610");
  r(c, 32, 64, 10, 14, "#a9d8f0"); r(c, 48, 64, 10, 14, "#a9d8f0");
  return cv;
}

function drawHut(): HTMLCanvasElement {
  const { cv, c } = mk(90, 90);
  shadow(c, 45, 86, 36);
  r(c, 20, 48, 50, 38, "#d8b483");
  tri(c, 10, 50, 45, 16, 80, 50, "#c8922a"); // thatch
  tri(c, 10, 50, 45, 24, 80, 50, "#a8761f");
  r(c, 38, 62, 14, 24, "#5b3a1a");
  r(c, 24, 56, 10, 10, "#3a2410");
  return cv;
}

function drawArchery(): HTMLCanvasElement {
  const { cv, c } = mk(100, 90);
  shadow(c, 50, 86, 42);
  // fence
  for (let i = 0; i < 6; i++) r(c, 10 + i * 14, 50, 4, 36, "#8a5a2b");
  r(c, 8, 56, 84, 4, "#8a5a2b");
  // target
  c.fillStyle = "#f2e4c0"; c.beginPath(); c.arc(70, 44, 18, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#c8413a"; c.beginPath(); c.arc(70, 44, 12, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#f2e4c0"; c.beginPath(); c.arc(70, 44, 6, 0, Math.PI * 2); c.fill();
  r(c, 90, 30, 16, 4, "#5b3a1a"); // arrow
  return cv;
}

function drawBlacksmith(): HTMLCanvasElement {
  const { cv, c } = mk(110, 100);
  shadow(c, 55, 96, 46);
  r(c, 20, 52, 70, 44, "#9b938a");
  r(c, 20, 52, 70, 6, "#b8b0a2");
  tri(c, 12, 52, 55, 24, 98, 52, "#5f574c");
  r(c, 44, 70, 22, 26, "#1c1610");
  // chimney + smoke
  r(c, 76, 18, 12, 34, "#7d756a");
  c.fillStyle = "rgba(180,180,180,0.6)";
  c.beginPath(); c.arc(82, 12, 7, 0, Math.PI * 2); c.arc(90, 4, 6, 0, Math.PI * 2); c.fill();
  // anvil
  r(c, 24, 80, 16, 8, "#3a2410");
  r(c, 28, 76, 8, 5, "#5f574c");
  return cv;
}

function drawArmory(): HTMLCanvasElement {
  const { cv, c } = mk(110, 100);
  shadow(c, 55, 96, 46);
  r(c, 22, 50, 66, 46, "#b8b0a2");
  r(c, 22, 50, 66, 6, "#cfc7b8");
  tri(c, 14, 50, 55, 20, 96, 50, "#7d756a");
  // shield emblem
  c.fillStyle = "#c8413a";
  c.beginPath();
  c.moveTo(55, 58); c.lineTo(70, 64); c.lineTo(70, 78);
  c.lineTo(55, 88); c.lineTo(40, 78); c.lineTo(40, 64); c.closePath(); c.fill();
  r(c, 53, 60, 4, 24, "#f2c44d");
  r(c, 44, 68, 22, 4, "#f2c44d");
  return cv;
}

function drawJousting(): HTMLCanvasElement {
  const { cv, c } = mk(120, 100);
  shadow(c, 60, 96, 52);
  // two tents
  for (const [tx, col] of [[18, "#3f78c8"], [70, "#c8413a"]] as const) {
    tri(c, tx, 60, tx + 16, 24, tx + 32, 60, col);
    r(c, tx, 60, 32, 36, col === "#3f78c8" ? "#2a5fa0" : "#8a2b27");
    r(c, tx + 14, 8, 3, 18, "#5b3a1a");
    c.fillStyle = "#f2c44d";
    c.beginPath(); c.moveTo(tx + 17, 8); c.lineTo(tx + 27, 11); c.lineTo(tx + 17, 14); c.closePath(); c.fill();
  }
  // crossed lances
  r(c, 50, 40, 40, 3, "#8a5a2b");
  return cv;
}

function drawCathedral(): HTMLCanvasElement {
  const { cv, c } = mk(110, 150);
  shadow(c, 55, 146, 46);
  r(c, 30, 60, 50, 86, "#e9e4d6");
  r(c, 30, 60, 50, 8, "#ffffff");
  tri(c, 22, 62, 55, 14, 88, 62, "#c8922a");
  // cross
  r(c, 53, 0, 4, 16, "#f2c44d");
  r(c, 48, 4, 14, 4, "#f2c44d");
  // rose window + doors
  c.fillStyle = "#6fb0e6"; c.beginPath(); c.arc(55, 78, 9, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#3a2410";
  c.beginPath(); c.moveTo(44, 146); c.lineTo(44, 104); c.arc(55, 104, 11, Math.PI, 0); c.lineTo(66, 146); c.closePath(); c.fill();
  return cv;
}

// ---- generic themed dwellings (tiers 1..6) for non-knight factions ----
function diamond(c: CanvasRenderingContext2D, cx: number, cy: number, rad: number, col: string): void {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(cx, cy - rad); c.lineTo(cx + rad, cy); c.lineTo(cx, cy + rad); c.lineTo(cx - rad, cy);
  c.closePath(); c.fill();
}

function genHut(col: DwellingColors): HTMLCanvasElement {
  const { cv, c } = mk(90, 90);
  shadow(c, 45, 86, 36);
  r(c, 22, 50, 46, 36, col.wall);
  r(c, 22, 50, 46, 5, col.accent);
  tri(c, 12, 52, 45, 18, 78, 52, col.roof);
  r(c, 39, 64, 12, 22, col.dark); // door
  r(c, 26, 58, 9, 9, col.accent); // window
  return cv;
}

function genTower(col: DwellingColors): HTMLCanvasElement {
  const { cv, c } = mk(100, 95);
  shadow(c, 50, 91, 36);
  r(c, 36, 28, 30, 62, col.wall);
  r(c, 36, 28, 6, 62, col.accent);
  tri(c, 28, 30, 51, 6, 74, 30, col.roof);
  for (let i = 0; i < 3; i++) r(c, 46, 40 + i * 16, 10, 9, col.dark); // window slits
  // banner
  r(c, 50, 0, 3, 8, col.dark);
  c.fillStyle = col.accent;
  c.beginPath(); c.moveTo(53, 0); c.lineTo(64, 3); c.lineTo(53, 7); c.closePath(); c.fill();
  return cv;
}

function genHall(col: DwellingColors): HTMLCanvasElement {
  const { cv, c } = mk(110, 100);
  shadow(c, 55, 96, 46);
  r(c, 22, 48, 66, 48, col.wall);
  r(c, 22, 48, 66, 6, col.accent);
  tri(c, 14, 50, 55, 20, 96, 50, col.roof);
  r(c, 47, 70, 16, 26, col.dark); // door
  diamond(c, 55, 62, 9, col.accent); // emblem
  return cv;
}

function genKeep(col: DwellingColors): HTMLCanvasElement {
  const { cv, c } = mk(110, 105);
  shadow(c, 55, 101, 48);
  // central wall
  r(c, 30, 50, 50, 50, col.wall);
  r(c, 30, 50, 50, 6, col.accent);
  tri(c, 24, 52, 55, 24, 86, 52, col.roof);
  r(c, 47, 76, 16, 24, col.dark);
  // flanking turrets
  for (const tx of [10, 78]) {
    r(c, tx, 58, 22, 42, col.wall);
    r(c, tx, 58, 5, 42, col.accent);
    tri(c, tx - 2, 60, tx + 11, 40, tx + 24, 60, col.roof);
    r(c, tx + 7, 70, 8, 12, col.dark);
  }
  return cv;
}

function genLair(col: DwellingColors): HTMLCanvasElement {
  const { cv, c } = mk(120, 110);
  shadow(c, 60, 106, 52);
  // rocky mound
  c.fillStyle = col.wall;
  c.beginPath(); c.moveTo(8, 104); c.lineTo(60, 22); c.lineTo(112, 104); c.closePath(); c.fill();
  c.fillStyle = shade(col.wall, -0.22);
  c.beginPath(); c.moveTo(60, 22); c.lineTo(112, 104); c.lineTo(64, 104); c.closePath(); c.fill();
  // cave mouth
  c.fillStyle = col.dark;
  c.beginPath(); c.moveTo(42, 104); c.lineTo(42, 74); c.arc(60, 74, 18, Math.PI, 0); c.lineTo(78, 104); c.closePath(); c.fill();
  // glowing eyes / torches
  r(c, 50, 80, 5, 5, col.accent);
  r(c, 65, 80, 5, 5, col.accent);
  return cv;
}

function genTemple(col: DwellingColors): HTMLCanvasElement {
  const { cv, c } = mk(110, 150);
  shadow(c, 55, 146, 46);
  r(c, 30, 58, 50, 88, col.wall);
  r(c, 30, 58, 50, 8, col.accent);
  tri(c, 22, 60, 55, 12, 88, 60, col.roof);
  // spire
  r(c, 53, 0, 4, 14, col.dark);
  diamond(c, 55, 4, 6, col.accent);
  // great doors + emblem
  c.fillStyle = col.dark;
  c.beginPath(); c.moveTo(44, 146); c.lineTo(44, 102); c.arc(55, 102, 11, Math.PI, 0); c.lineTo(66, 146); c.closePath(); c.fill();
  diamond(c, 55, 80, 11, col.accent);
  return cv;
}

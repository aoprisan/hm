// Procedural NPC art: a portrait bust for the dialogue panel and a small standing
// figure for the adventure map. Drawn on canvases with simple shapes, mirroring
// the approach in sprites_objects.ts so the storybook pixel look stays consistent.
import { PortraitKind } from "../data/npcs";

interface Palette {
  hood: string;   // hat / hood
  hoodDk: string; // hood shadow side
  hair: string;   // hair & beard
  robe: string;   // body robe / tunic
  robeDk: string;
  skin: string;
  accent: string; // trim / staff bauble
  beard: boolean; // elders & seers wear a beard; villagers do not
}

const PALS: Record<PortraitKind, Palette> = {
  elder: {
    hood: "#5a4a8c", hoodDk: "#42356a", hair: "#e8e4d8", robe: "#6b5a8c",
    robeDk: "#4c3f6a", skin: "#e6c49a", accent: "#caa15a", beard: true,
  },
  sage: {
    hood: "#7a3f9a", hoodDk: "#542c70", hair: "#dcd4e6", robe: "#3f3a5a",
    robeDk: "#2c2842", skin: "#e6c49a", accent: "#f2c44d", beard: true,
  },
  villager: {
    hood: "#8a5a2b", hoodDk: "#5b3a1a", hair: "#5b3a1a", robe: "#5b9a42",
    robeDk: "#3f7330", skin: "#e6c49a", accent: "#b9824a", beard: false,
  },
};

function cv(w: number, h: number): { cv: HTMLCanvasElement; c: CanvasRenderingContext2D } {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  return { cv: el, c: el.getContext("2d")! };
}
function r(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

// ---------- Portrait bust (shown beside dialogue) ----------
const portraitCache = new Map<PortraitKind, HTMLCanvasElement>();
export function npcPortrait(kind: PortraitKind): HTMLCanvasElement {
  const cached = portraitCache.get(kind);
  if (cached) return cached;
  const p = PALS[kind];
  const { cv: el, c } = cv(30, 34);

  // shoulders / robe
  r(c, 3, 26, 24, 8, p.robeDk);
  r(c, 4, 26, 22, 7, p.robe);
  r(c, 13, 26, 4, 8, p.accent); // collar trim

  // hood / hat dome
  c.fillStyle = p.hoodDk;
  c.beginPath(); c.ellipse(15, 12, 12, 11, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = p.hood;
  c.beginPath(); c.ellipse(14, 11, 11, 10, 0, 0, Math.PI * 2); c.fill();

  // face
  r(c, 8, 11, 14, 14, p.skin);
  r(c, 8, 11, 14, 2, "#f2d8b0"); // brow highlight

  // hair sides peeking from the hood
  r(c, 7, 13, 2, 9, p.hair);
  r(c, 21, 13, 2, 9, p.hair);

  // eyes
  r(c, 11, 17, 2, 2, "#1c1208");
  r(c, 17, 17, 2, 2, "#1c1208");

  if (p.beard) {
    // a flowing beard covering the lower face
    c.fillStyle = p.hair;
    c.beginPath();
    c.moveTo(8, 20); c.lineTo(22, 20); c.lineTo(18, 30); c.lineTo(12, 30); c.closePath();
    c.fill();
    r(c, 13, 19, 4, 2, "#caa07a"); // hint of mouth above the beard
  } else {
    r(c, 13, 22, 4, 2, "#b8845c"); // mouth
  }

  portraitCache.set(kind, el);
  return el;
}

// ---------- Map figure (a small standing NPC token) ----------
const bodyCache = new Map<PortraitKind, HTMLCanvasElement>();
export function npcBody(kind: PortraitKind): HTMLCanvasElement {
  const cached = bodyCache.get(kind);
  if (cached) return cached;
  const p = PALS[kind];
  const { cv: el, c } = cv(20, 30);

  // ground shadow
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath(); c.ellipse(10, 28, 8, 3, 0, 0, Math.PI * 2); c.fill();

  // robe body (trapezoid)
  c.fillStyle = p.robeDk;
  c.beginPath();
  c.moveTo(6, 13); c.lineTo(14, 13); c.lineTo(17, 27); c.lineTo(3, 27); c.closePath();
  c.fill();
  c.fillStyle = p.robe;
  c.beginPath();
  c.moveTo(7, 13); c.lineTo(13, 13); c.lineTo(15, 27); c.lineTo(5, 27); c.closePath();
  c.fill();
  r(c, 9, 14, 2, 13, p.accent); // robe seam

  // head + hood
  c.fillStyle = p.hoodDk;
  c.beginPath(); c.ellipse(10, 7, 6, 6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = p.hood;
  c.beginPath(); c.ellipse(10, 6, 5, 5, 0, 0, Math.PI * 2); c.fill();
  r(c, 7, 6, 6, 6, p.skin);
  r(c, 8, 8, 1, 1, "#1c1208");
  r(c, 11, 8, 1, 1, "#1c1208");
  if (p.beard) { r(c, 7, 10, 6, 3, p.hair); }

  if (kind === "sage") {
    // a staff with a glowing bauble
    r(c, 16, 6, 1, 21, "#5b3a1a");
    r(c, 15, 4, 3, 3, p.accent);
  }

  bodyCache.set(kind, el);
  return el;
}

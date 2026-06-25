// Shared fairy-tale palette. Each single-character key maps to a hex color.
// '.' and ' ' are transparent. Sprites across the game reference these keys so
// the whole world shares one warm, storybook-consistent color family.
export const PAL: Record<string, string | null> = {
  ".": null,
  " ": null,

  // ink / outlines
  k: "#1c1610", // near-black outline
  K: "#000000",

  // browns & wood
  b: "#3a2412", // dark brown
  B: "#5b3a1a", // brown
  w: "#8a5a2b", // wood
  W: "#b9824a", // light wood
  t: "#d8b483", // tan / parchment

  // skin
  s: "#e8b98c", // skin
  S: "#c08a5a", // shadow skin
  f: "#f4d4b0", // pale skin

  // greens (grass / forest)
  g: "#4f8a3a", // grass
  G: "#3c6e2c", // dark grass
  l: "#6fae4e", // light grass
  v: "#2f5a22", // deep leaf
  V: "#79b85a", // bright leaf
  o: "#9ccb5e", // pale highlight green

  // blues (water / sky)
  u: "#3f78c8", // blue
  U: "#28548f", // dark blue
  c: "#6fb0e6", // light blue / cyan
  q: "#2f6fb0", // water
  Q: "#1f4f86", // deep water
  C: "#a9d8f0", // pale sky foam

  // gold / yellows
  y: "#f2c44d", // gold
  Y: "#c8922a", // dark gold
  e: "#fff0b0", // pale gold highlight

  // reds / banners
  r: "#c8413a", // red
  R: "#8f2b27", // dark red
  p: "#7a3f9a", // purple
  P: "#c98ad8", // pink/violet
  m: "#d94f7a", // magenta rose

  // metals / stone
  z: "#c9ced6", // steel
  Z: "#8a9099", // dark steel
  a: "#9b938a", // ash grey
  A: "#6b645c", // dark grey
  n: "#b8b0a2", // stone
  N: "#7d756a", // dark stone
  x: "#e9e4d6", // light stone / bone
  h: "#ffffff", // white

  // sand / dirt
  d: "#d8b06a", // sand
  D: "#b3863f", // dark sand / dirt
  i: "#7e5a30", // road dirt

  // orange / fire
  j: "#e8862e", // orange
  J: "#b85f18", // dark orange
};

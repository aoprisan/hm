// Fog of war: revealed tiles. Starts hidden; the hero's scouting radius reveals.
export class Fog {
  readonly width: number;
  readonly height: number;
  revealed: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.revealed = new Uint8Array(width * height);
  }

  isRevealed(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.revealed[y * this.width + x] === 1;
  }

  reveal(cx: number, cy: number, radius: number): void {
    const r2 = (radius + 0.4) * (radius + 0.4);
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.revealed[y * this.width + x] = 1;
      }
    }
  }
}

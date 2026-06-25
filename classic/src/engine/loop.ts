// Game loop: requestAnimationFrame with clamped delta time.
export function startLoop(step: (dt: number) => void): void {
  let last = performance.now();
  function frame(now: number) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // clamp after tab-switch / hitches
    step(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// One temporary canvas serves overlapping bursts. Positions are in viewport pixels.
const colors = ['#55cfa0', '#207b61', '#b3efc0', '#efb956', '#bfa2ee', '#fb987f'];
const still = matchMedia('(prefers-reduced-motion: reduce)');
const particles = [];
let layer, context, frame;

function clear() {
  cancelAnimationFrame(frame);
  particles.length = 0;
  layer?.remove();
  layer = context = frame = null;
}

function prepare() {
  if (still.matches || document.hidden) return false;
  if (layer) return true;
  layer = document.createElement('canvas');
  context = layer.getContext('2d');
  if (!context) { clear(); return false; }
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  const scale = Math.min(devicePixelRatio || 1, 2);
  layer.width = Math.ceil(innerWidth * scale);
  layer.height = Math.ceil(innerHeight * scale);
  context.scale(scale, scale);
  document.body.append(layer);
  return true;
}

function draw(now) {
  context.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const t = Math.max(0, (now - p.start) / 1000);
    if (t >= p.life) { particles.splice(i, 1); continue; }
    const flight = (1 - Math.exp(-1.4 * t)) / 1.4;
    const x = p.x + p.vx * flight + 5 * Math.sin(t * 7 + p.spin) * t;
    const y = p.y + p.vy * flight + p.gravity * t * t / 2;
    context.save();
    context.translate(x, y);
    context.rotate(p.spin + t * p.turn);
    context.scale(1, .24 + .76 * Math.abs(Math.cos(t * 7 + p.spin)));
    context.globalAlpha = Math.min(1, (p.life - t) / .24);
    context.fillStyle = p.color;
    context.fillRect(-p.width / 2, -p.width / 4, p.width, p.width / 2);
    context.restore();
  }
  if (particles.length) frame = requestAnimationFrame(draw);
  else clear();
}

function spray(x, y, angle, spread, speed, gravity, count, life, size) {
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const heading = angle + (Math.random() - .5) * spread;
    const launch = speed * (.7 + Math.random() * .48);
    particles.push({
      x, y, start, gravity, vx: Math.cos(heading) * launch, vy: Math.sin(heading) * launch,
      spin: Math.random() * Math.PI * 2, turn: (Math.random() - .5) * 13,
      life: life * (.82 + Math.random() * .28), width: size * (.66 + Math.random() * .65),
      color: colors[i % colors.length]
    });
  }
  if (particles.length > 160) particles.splice(0, particles.length - 160);
  if (!frame) frame = requestAnimationFrame(draw);
}

export function celebrateStep(checkbox) {
  if (!prepare()) return;
  const box = checkbox.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const angle = x < innerWidth / 2 ? -1.11 : -Math.PI + 1.11;
  spray(x, box.top + box.height / 2, angle, 1.65, 218, 330, 20, .85, 7);
}

export function celebrateGoal() {
  if (!prepare()) return;
  const y = innerHeight * .80;
  const reach = Math.min(innerWidth * .48, 420);
  const rise = Math.min(innerHeight * .98, 850);
  const angle = Math.atan2(-rise, reach);
  const speed = Math.hypot(reach, rise);
  spray(0, y, angle, .68, speed, 400, 42, 1.55, 11);
  spray(innerWidth, y, -Math.PI - angle, .68, speed, 400, 42, 1.55, 11);
}

still.addEventListener('change', () => { if (still.matches) clear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
window.addEventListener('pagehide', clear);
window.addEventListener('resize', clear);

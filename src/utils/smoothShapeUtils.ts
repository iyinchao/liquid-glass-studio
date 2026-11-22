export type CornerTransition = [number, number, number, number];

export interface SmoothShapeGeometry {
  width: number;
  height: number;
  radius: number;
  smoothing: number;
}

// Unit-radius cubic: P0=(0,0), P1=(2b,0), P2=(3b,0), P3=(3b+c,d).
// Its curvature starts at zero and ends at one, matching the unit circle.
function transition(angle: number): CornerTransition {
  if (angle < 0.0001) return [0, 0, 0, 0];
  const sine = Math.sin(angle);
  const d = 2 * Math.sin(angle / 2) ** 2;
  const c = d / Math.tan(angle);
  const b = 3 * d * d / (2 * sine ** 3);
  return [b, c, d, 3 * b + c - sine];
}

function fitTransition(smoothing: number, available: number): CornerTransition {
  let low = 0;
  let high = Math.max(0, Math.min(1, smoothing)) * Math.PI / 4;
  if (transition(high)[3] <= available) return transition(high);
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    if (transition(mid)[3] > available) high = mid;
    else low = mid;
  }
  return transition(low);
}

export function buildSmoothCorners(g: SmoothShapeGeometry) {
  const radius = Math.max(0, Math.min(g.radius, g.width / 2, g.height / 2));
  return {
    horizontal: fitTransition(g.smoothing, radius > 0 ? Math.max(0, g.width / 2 / radius - 1) : 0),
    vertical: fitTransition(g.smoothing, radius > 0 ? Math.max(0, g.height / 2 / radius - 1) : 0),
  };
}

export function transitionPoint(t: number, k: CornerTransition): [number, number] {
  return [k[0] * (6 * t - 3 * t * t) + k[1] * t ** 3, k[2] * t ** 3];
}

// Counter-clockwise from the right-hand midpoint to the top midpoint.
export function smoothQuarter(g: SmoothShapeGeometry): [number, number][] {
  const r = Math.max(0, Math.min(g.radius, g.width / 2, g.height / 2));
  const w = g.width / 2;
  const h = g.height / 2;
  if (r === 0) return [[w, 0], [w, h], [0, h]];
  const { horizontal: top, vertical: side } = buildSmoothCorners(g);
  const points: [number, number][] = [[w, 0], [w, Math.max(0, h - r * (1 + side[3]))]];
  if (side[2] > 0) {
    for (let i = 1; i <= 64; i++) {
      const [x, y] = transitionPoint(i / 64, side);
      points.push([w - r * y, h - r * (1 + side[3]) + r * x]);
    }
  }
  const from = side[2] > 0 ? Math.atan2(side[2], side[1]) : 0;
  const to = Math.PI / 2 - (top[2] > 0 ? Math.atan2(top[2], top[1]) : 0);
  for (let i = 0; i <= 64; i++) {
    const angle = from + (to - from) * i / 64;
    points.push([w - r + r * Math.cos(angle), h - r + r * Math.sin(angle)]);
  }
  if (top[2] > 0) {
    for (let i = 63; i >= 0; i--) {
      const [x, y] = transitionPoint(i / 64, top);
      points.push([w - r * (1 + top[3]) + r * x, h - r * y]);
    }
  }
  points.push([0, h]);
  return points;
}

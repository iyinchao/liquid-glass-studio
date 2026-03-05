export interface ShowcaseKeyframe {
  t: number;
  values: Record<string, any>;
  mouse?: [number, number];
  easing?: 'linear' | 'easeInOut';
}

export interface ShowcaseDemo {
  id: string;
  duration: number;
  keyframes: ShowcaseKeyframe[];
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function lerpValue(a: any, b: any, t: number): any {
  if (typeof a === 'number' && typeof b === 'number') {
    return a + (b - a) * t;
  }
  if (typeof a === 'boolean') return t < 0.5 ? a : b;
  if (a && typeof a === 'object' && 'r' in a && 'g' in a && 'b' in a) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
      a: a.a !== undefined ? a.a + ((b.a ?? a.a) - a.a) * t : undefined,
    };
  }
  return t < 0.5 ? a : b;
}

export function getShowcaseFrame(
  demo: ShowcaseDemo,
  elapsedSec: number,
): { values: Record<string, any>; mouse: [number, number] | null } {
  const loopTime = elapsedSec % demo.duration;
  const normalizedTime = loopTime / demo.duration;

  const kf = demo.keyframes;
  let prevIdx = 0;
  let nextIdx = 0;
  for (let i = 0; i < kf.length; i++) {
    if (kf[i].t <= normalizedTime) prevIdx = i;
  }
  nextIdx = prevIdx + 1 >= kf.length ? 0 : prevIdx + 1;

  const prev = kf[prevIdx];
  const next = kf[nextIdx];

  const segStart = prev.t;
  const segEnd = nextIdx === 0 ? 1 : next.t;
  const segLen = segEnd - segStart;
  let segT = segLen > 0 ? (normalizedTime - segStart) / segLen : 0;

  const easingMode = next.easing ?? 'easeInOut';
  if (easingMode === 'easeInOut') segT = easeInOut(segT);

  const values: Record<string, any> = {};
  const allKeys = new Set([...Object.keys(prev.values), ...Object.keys(next.values)]);
  for (const key of allKeys) {
    const a = prev.values[key];
    const b = next.values[key];
    if (a !== undefined && b !== undefined) {
      values[key] = lerpValue(a, b, segT);
    } else {
      values[key] = a ?? b;
    }
  }

  let mouse: [number, number] | null = null;
  if (prev.mouse && next.mouse) {
    mouse = [
      prev.mouse[0] + (next.mouse[0] - prev.mouse[0]) * segT,
      prev.mouse[1] + (next.mouse[1] - prev.mouse[1]) * segT,
    ];
  } else if (prev.mouse) {
    mouse = prev.mouse;
  }

  return { values, mouse };
}

export const SHOWCASE_DEMOS: ShowcaseDemo[] = [
  {
    id: 'rainbowPrism',
    duration: 8,
    keyframes: [
      {
        t: 0,
        values: {
          refThickness: 25,
          refFactor: 1.52,
          refDispersion: 3,
          refFresnelRange: 35,
          refFresnelHardness: 30,
          refFresnelFactor: 25,
          glareRange: 40,
          glareHardness: 45,
          glareFactor: 100,
          glareConvergence: 60,
          glareOppositeFactor: 70,
          glareAngle: -180,
          blurRadius: 1,
          blurEdge: true,
          tint: { r: 255, g: 200, b: 200, a: 0.08 },
          shadowExpand: 25,
          shadowFactor: 15,
        },
        mouse: [0.3, 0.7],
      },
      {
        t: 0.25,
        values: {
          refDispersion: 50,
          glareAngle: -90,
          tint: { r: 200, g: 255, b: 200, a: 0.08 },
        },
        mouse: [0.7, 0.7],
      },
      {
        t: 0.5,
        values: {
          refDispersion: 30,
          glareAngle: 0,
          tint: { r: 200, g: 200, b: 255, a: 0.08 },
        },
        mouse: [0.7, 0.3],
      },
      {
        t: 0.75,
        values: {
          refDispersion: 50,
          glareAngle: 90,
          tint: { r: 255, g: 220, b: 200, a: 0.08 },
        },
        mouse: [0.3, 0.3],
      },
      {
        t: 0.95,
        values: {
          refDispersion: 3,
          glareAngle: 180,
          tint: { r: 255, g: 200, b: 200, a: 0.08 },
        },
        mouse: [0.3, 0.7],
      },
    ],
  },
  {
    id: 'shapeMorph',
    duration: 10,
    keyframes: [
      {
        t: 0,
        values: {
          shapeWidth: 200,
          shapeHeight: 200,
          shapeRadius: 80,
          shapeRoundness: 5,
          refThickness: 20,
          refFactor: 1.4,
          refDispersion: 7,
          blurRadius: 1,
          blurEdge: true,
          glareAngle: -45,
          glareFactor: 90,
          tint: { r: 255, g: 255, b: 255, a: 0 },
        },
        mouse: [0.5, 0.5],
      },
      {
        t: 0.2,
        values: {
          shapeWidth: 400,
          shapeHeight: 120,
          shapeRadius: 20,
          shapeRoundness: 2,
        },
        mouse: [0.3, 0.6],
      },
      {
        t: 0.4,
        values: {
          shapeWidth: 150,
          shapeHeight: 350,
          shapeRadius: 100,
          shapeRoundness: 7,
        },
        mouse: [0.7, 0.4],
      },
      {
        t: 0.6,
        values: {
          shapeWidth: 350,
          shapeHeight: 350,
          shapeRadius: 50,
          shapeRoundness: 3,
        },
        mouse: [0.5, 0.3],
      },
      {
        t: 0.8,
        values: {
          shapeWidth: 120,
          shapeHeight: 120,
          shapeRadius: 100,
          shapeRoundness: 5,
        },
        mouse: [0.4, 0.6],
      },
      {
        t: 0.95,
        values: {
          shapeWidth: 200,
          shapeHeight: 200,
          shapeRadius: 80,
          shapeRoundness: 5,
        },
        mouse: [0.5, 0.5],
      },
    ],
  },
  {
    id: 'glowPulse',
    duration: 6,
    keyframes: [
      {
        t: 0,
        values: {
          refThickness: 20,
          refFactor: 1.4,
          refDispersion: 7,
          blurRadius: 1,
          blurEdge: true,
          glareAngle: -45,
          glareFactor: 90,
          emissiveIntensity: 0,
          emissiveColor: { r: 255, g: 180, b: 100, a: 1 },
          tint: { r: 255, g: 255, b: 255, a: 0 },
        },
        mouse: [0.5, 0.5],
      },
      {
        t: 0.15,
        values: {
          emissiveIntensity: 40,
          blurRadius: 10,
          emissiveColor: { r: 255, g: 200, b: 130, a: 1 },
        },
        mouse: [0.45, 0.55],
      },
      {
        t: 0.35,
        values: {
          emissiveIntensity: 80,
          blurRadius: 30,
          emissiveColor: { r: 150, g: 180, b: 255, a: 1 },
        },
        mouse: [0.55, 0.45],
      },
      {
        t: 0.5,
        values: {
          emissiveIntensity: 60,
          blurRadius: 20,
          emissiveColor: { r: 180, g: 255, b: 200, a: 1 },
        },
        mouse: [0.5, 0.5],
      },
      {
        t: 0.7,
        values: {
          emissiveIntensity: 80,
          blurRadius: 30,
          emissiveColor: { r: 255, g: 150, b: 200, a: 1 },
        },
        mouse: [0.45, 0.55],
      },
      {
        t: 0.9,
        values: {
          emissiveIntensity: 10,
          blurRadius: 3,
          emissiveColor: { r: 255, g: 180, b: 100, a: 1 },
        },
        mouse: [0.5, 0.5],
      },
    ],
  },
  {
    id: 'diamondSparkle',
    duration: 8,
    keyframes: [
      {
        t: 0,
        values: {
          refThickness: 35,
          refFactor: 2.42,
          refDispersion: 38,
          refFresnelRange: 50,
          refFresnelHardness: 55,
          refFresnelFactor: 45,
          glareRange: 55,
          glareHardness: 70,
          glareFactor: 60,
          glareConvergence: 75,
          glareOppositeFactor: 90,
          glareAngle: -180,
          blurRadius: 1,
          blurEdge: false,
          tint: { r: 255, g: 255, b: 255, a: 0 },
          shadowExpand: 20,
          shadowFactor: 12,
        },
        mouse: [0.5, 0.8],
      },
      {
        t: 0.25,
        values: {
          glareFactor: 120,
          glareAngle: -90,
        },
        mouse: [0.8, 0.5],
      },
      {
        t: 0.5,
        values: {
          glareFactor: 60,
          glareAngle: 0,
        },
        mouse: [0.5, 0.2],
      },
      {
        t: 0.75,
        values: {
          glareFactor: 120,
          glareAngle: 90,
        },
        mouse: [0.2, 0.5],
      },
      {
        t: 0.95,
        values: {
          glareFactor: 60,
          glareAngle: 180,
        },
        mouse: [0.5, 0.8],
      },
    ],
  },
  {
    id: 'frostMelt',
    duration: 6,
    keyframes: [
      {
        t: 0,
        values: {
          refThickness: 20,
          refFactor: 1.1,
          refDispersion: 2,
          refFresnelRange: 20,
          refFresnelHardness: 10,
          refFresnelFactor: 15,
          glareRange: 50,
          glareHardness: 8,
          glareFactor: 40,
          glareConvergence: 30,
          glareOppositeFactor: 40,
          glareAngle: -45,
          blurRadius: 80,
          blurEdge: true,
          tint: { r: 180, g: 210, b: 255, a: 0.15 },
          shadowExpand: 30,
          shadowFactor: 10,
        },
        mouse: [0.5, 0.5],
      },
      {
        t: 0.35,
        values: {
          blurRadius: 1,
          refFactor: 1.8,
          tint: { r: 255, g: 255, b: 255, a: 0 },
          refDispersion: 15,
        },
        mouse: [0.6, 0.4],
      },
      {
        t: 0.65,
        values: {
          blurRadius: 1,
          refFactor: 1.8,
          tint: { r: 255, g: 255, b: 255, a: 0 },
          refDispersion: 15,
        },
        mouse: [0.4, 0.6],
      },
      {
        t: 0.95,
        values: {
          blurRadius: 80,
          refFactor: 1.1,
          tint: { r: 180, g: 210, b: 255, a: 0.15 },
          refDispersion: 2,
        },
        mouse: [0.5, 0.5],
      },
    ],
  },
];

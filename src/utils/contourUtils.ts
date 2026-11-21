import { smoothQuarter, type SmoothShapeGeometry } from './smoothShapeUtils';

export const MAX_CONTOUR_POINTS = 128;

export type RectangleGeometry = SmoothShapeGeometry;

interface Sample {
  x: number;
  y: number;
  length: number;
}

// Build one stable, local-space perimeter. Translation, lighting and fusion never resample it.
export function buildRectangleContour(g: RectangleGeometry): { points: Float32Array; count: number } {
  const halfWidth = g.width / 2;
  const samples: Sample[] = [{ x: halfWidth, y: 0, length: 0 }];
  const append = (x: number, y: number) => {
    const previous = samples[samples.length - 1];
    const distance = Math.hypot(x - previous.x, y - previous.y);
    if (distance > 0.000001) samples.push({ x, y, length: previous.length + distance });
  };
  for (const [x, y] of smoothQuarter(g)) append(x, y);
  const quarterLength = samples[samples.length - 1].length;

  interface Piece { a: number; b: number; split: number; error: number }
  const fit = (a: number, b: number): Piece => {
    const start = samples[a];
    const end = samples[b];
    let error = 0;
    let split = a;
    for (let i = a + 1; i < b; i++) {
      const p = samples[i];
      const t = (p.length - start.length) / (end.length - start.length);
      const deviation = Math.hypot(p.x - start.x - (end.x - start.x) * t, p.y - start.y - (end.y - start.y) * t);
      if (deviation > error) { error = deviation; split = i; }
    }
    return { a, b, split, error };
  };
  const pieces = [fit(0, samples.length - 1)];
  while (pieces.length < MAX_CONTOUR_POINTS / 4) {
    let worst = -1;
    for (let i = 0; i < pieces.length; i++) {
      if (pieces[i].error > 0.1 && (worst < 0 || pieces[i].error > pieces[worst].error)) worst = i;
    }
    if (worst < 0) break;
    const p = pieces[worst];
    pieces.splice(worst, 1, fit(p.a, p.split), fit(p.split, p.b));
  }
  const quarter = pieces.map(p => samples[p.a]);
  quarter.push(samples[samples.length - 1]);
  const points = new Float32Array(MAX_CONTOUR_POINTS * 4);
  const segmentCount = quarter.length - 1;
  let count = 0;
  const write = (x: number, y: number, length: number) => {
    points[count * 4] = x;
    points[count * 4 + 1] = y;
    // Unwrapped perimeter fraction. The shader explicitly unwraps the closing segment.
    points[count * 4 + 2] = length / (4 * quarterLength);
    points[count * 4 + 3] = 1 / quarterLength;
    count++;
  };
  for (let i = 0; i < segmentCount; i++) {
    const p = quarter[i];
    write(p.x, p.y, p.length);
  }
  for (let i = segmentCount; i > 0; i--) {
    const p = quarter[i];
    write(-p.x, p.y, 2 * quarterLength - p.length);
  }
  for (let i = 0; i < segmentCount; i++) {
    const p = quarter[i];
    write(-p.x, -p.y, 2 * quarterLength + p.length);
  }
  for (let i = segmentCount; i > 0; i--) {
    const p = quarter[i];
    write(p.x, -p.y, 4 * quarterLength - p.length);
  }
  return { points, count };
}

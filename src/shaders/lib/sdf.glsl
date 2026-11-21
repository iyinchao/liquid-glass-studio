// Signed distance functions shared by the background and main passes.
// `#include`d into a shader that already declares `#version` / `precision`.
// Requires these uniforms to be declared by the includer:
//   float u_dpr; vec2 u_resolution; int u_showShape1;
//   float u_shapeWidth, u_shapeHeight, u_shapeRadius, u_mergeRate;

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

// Cubic transition in unit-radius coordinates. k=(b,c,d,extra extent).
vec2 transitionPosition(float t, vec4 k) {
  return vec2(k.x * (6.0 * t - 3.0 * t * t) + k.y * t * t * t, k.z * t * t * t);
}

vec2 transitionTangent(float t, vec4 k) {
  return vec2(6.0 * k.x * (1.0 - t) + 3.0 * k.y * t * t, 3.0 * k.z * t * t);
}

// Squared distance and outward signed projection; endpoints remain candidates.
vec2 transitionDistance(vec2 p, vec4 k) {
  vec2 end = vec2(3.0 * k.x + k.y, k.z);
  float low = 0.0;
  float high = 1.0;
  float t = 0.0;
  float best = 1e30;
  vec2 previous = vec2(0.0);
  // A short coarse search also handles points inside the curve's evolute.
  // A single endpoint derivative can miss the closest stationary point there.
  for (int i = 0; i < 8; i++) {
    float from = float(i) / 8.0;
    vec2 nextPoint = transitionPosition(from + 0.125, k);
    vec2 edge = nextPoint - previous;
    float along = clamp(dot(p - previous, edge) / max(dot(edge, edge), 1e-12), 0.0, 1.0);
    vec2 delta = p - mix(previous, nextPoint, along);
    float distance = dot(delta, delta);
    if (distance < best) {
      best = distance;
      t = from + along / 8.0;
      low = max(0.0, from - 0.125);
      high = min(1.0, from + 0.25);
    }
    previous = nextPoint;
  }
  for (int i = 0; i < 10; i++) {
    vec2 offset = transitionPosition(t, k) - p;
    vec2 tangent = transitionTangent(t, k);
    float f = dot(offset, tangent);
    if (f > 0.0) high = t;
    else low = t;
    vec2 second = vec2(-6.0 * k.x + 6.0 * k.y * t, 6.0 * k.z * t);
    float derivative = dot(tangent, tangent) + dot(offset, second);
    float next = t - f / max(derivative, 0.00000001);
    if (abs(next - t) < 0.0000005) break;
    if (next <= low || next >= high || derivative <= 0.0) next = 0.5 * (low + high);
    t = next;
  }
  vec2 offset = p - transitionPosition(t, k);
  vec2 tangent = transitionTangent(t, k);
  vec2 result = vec2(dot(offset, offset), dot(offset, vec2(tangent.y, -tangent.x)));
  if (dot(p, p) < result.x) result = vec2(dot(p, p), -p.y);
  vec2 endOffset = p - end;
  if (dot(endOffset, endOffset) < result.x) {
    result = vec2(dot(endOffset, endOffset), dot(endOffset, vec2(k.z, -k.y)));
  }
  return result;
}

float continuousRoundedRectSDF(vec2 p, vec2 halfSize, float radius) {
  p = abs(p);
  if (radius < 0.0000001) {
    vec2 d = p - halfSize;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
  // Every candidate is measured in the same Euclidean metric, including fusion/shadows.
  p /= radius;
  halfSize /= radius;
  vec4 top = u_cornerHorizontal;
  vec4 side = u_cornerVertical;
  vec2 start = max(halfSize - vec2(1.0) - vec2(top.w, side.w), vec2(0.0));
  vec2 topOffset = p - vec2(clamp(p.x, 0.0, start.x), halfSize.y);
  vec2 nearest = vec2(dot(topOffset, topOffset), topOffset.y);
  vec2 sideOffset = p - vec2(halfSize.x, clamp(p.y, 0.0, start.y));
  if (dot(sideOffset, sideOffset) < nearest.x) nearest = vec2(dot(sideOffset, sideOffset), sideOffset.x);

  vec2 radial = p - (halfSize - vec2(1.0));
  vec2 sideNormal = vec2(1.0, 0.0);
  vec2 topNormal = vec2(0.0, 1.0);
  if (side.z > 0.0) sideNormal = normalize(vec2(side.y, side.z));
  if (top.z > 0.0) topNormal = normalize(vec2(top.z, top.y));
  vec2 circlePoint = radial / max(length(radial), 0.0000001);
  if (sideNormal.x * radial.y - sideNormal.y * radial.x < 0.0) circlePoint = sideNormal;
  else if (radial.x * topNormal.y - radial.y * topNormal.x < 0.0) circlePoint = topNormal;
  else if (dot(radial, radial) < 0.000000000001) circlePoint = sideNormal;
  vec2 circleOffset = radial - circlePoint;
  vec2 circleCandidate = vec2(dot(circleOffset, circleOffset), dot(circleOffset, circlePoint));
  if (circleCandidate.x < nearest.x) nearest = circleCandidate;

  if (top.z > 0.0) {
    vec2 query = vec2(p.x - start.x, halfSize.y - p.y);
    vec2 extent = vec2(3.0 * top.x + top.y, top.z);
    vec2 boxOffset = max(max(-query, query - extent), vec2(0.0));
    if (dot(boxOffset, boxOffset) < nearest.x) {
      vec2 candidate = transitionDistance(query, top);
      if (candidate.x < nearest.x) nearest = candidate;
    }
  }
  if (side.z > 0.0) {
    vec2 query = vec2(p.y - start.y, halfSize.x - p.x);
    vec2 extent = vec2(3.0 * side.x + side.y, side.z);
    vec2 boxOffset = max(max(-query, query - extent), vec2(0.0));
    if (dot(boxOffset, boxOffset) < nearest.x) {
      vec2 candidate = transitionDistance(query, side);
      if (candidate.x < nearest.x) nearest = candidate;
    }
  }
  return sqrt(max(nearest.x, 0.0)) * (nearest.y < 0.0 ? -1.0 : 1.0) * radius;
}

float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

vec2 shapeDistances(vec2 p1, vec2 p2, vec2 p) {
  vec2 p1n = p1 + p / u_resolution.y;
  vec2 p2n = p2 + p / u_resolution.y;

  float d1 = u_showShape1 == 1 ? sdCircle(p1n, 100.0 * u_dpr / u_resolution.y) : 1.0;
  float d2 = continuousRoundedRectSDF(
    p2n,
    vec2(u_shapeWidth, u_shapeHeight) * (0.5 * u_dpr / u_resolution.y),
    u_shapeRadius * u_dpr / u_resolution.y
  );

  return vec2(d1, d2);
}

float mainSDF(vec2 p1, vec2 p2, vec2 p) {
  vec2 distances = shapeDistances(p1, p2, p);
  return smin(distances.x, distances.y, u_mergeRate);
}

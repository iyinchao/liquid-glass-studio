// Signed distance functions shared by the background and main passes.
// `#include`d into a WGSL module that already declares the `Uniforms` struct
// and the `@group(0) @binding(0) var<uniform> u: Uniforms;` binding.
// Mirrors src/shaders/lib/sdf.glsl for the WebGPU backend.

fn sdCircle(p: vec2f, r: f32) -> f32 {
  return length(p) - r;
}

// Cubic transition in unit-radius coordinates. k=(b,c,d,extra extent).
fn transitionPosition(t: f32, k: vec4f) -> vec2f {
  return vec2f(k.x * (6.0 * t - 3.0 * t * t) + k.y * t * t * t, k.z * t * t * t);
}

fn transitionTangent(t: f32, k: vec4f) -> vec2f {
  return vec2f(6.0 * k.x * (1.0 - t) + 3.0 * k.y * t * t, 3.0 * k.z * t * t);
}

// Squared distance and outward signed projection; endpoints remain candidates.
fn transitionDistance(p: vec2f, k: vec4f) -> vec2f {
  var end = vec2f(3.0 * k.x + k.y, k.z);
  var low = 0.0;
  var high = 1.0;
  var t = 0.0;
  var best = 1e30;
  var previous = vec2f(0.0);
  // A short coarse search also handles points inside the curve's evolute.
  // A single endpoint derivative can miss the closest stationary point there.
  for (var i = 0; i < 8; i++) {
    var segmentStart = f32(i) / 8.0;
    var nextPoint = transitionPosition(segmentStart + 0.125, k);
    var edge = nextPoint - previous;
    var along = clamp(dot(p - previous, edge) / max(dot(edge, edge), 1e-12), 0.0, 1.0);
    var delta = p - mix(previous, nextPoint, along);
    var distance = dot(delta, delta);
    if (distance < best) {
      best = distance;
      t = segmentStart + along / 8.0;
      low = max(0.0, segmentStart - 0.125);
      high = min(1.0, segmentStart + 0.25);
    }
    previous = nextPoint;
  }
  for (var i = 0; i < 10; i++) {
    var offset = transitionPosition(t, k) - p;
    var tangent = transitionTangent(t, k);
    var f = dot(offset, tangent);
    if (f > 0.0) { high = t; }
    else { low = t; }
    var second = vec2f(-6.0 * k.x + 6.0 * k.y * t, 6.0 * k.z * t);
    var derivative = dot(tangent, tangent) + dot(offset, second);
    var next = t - f / max(derivative, 0.00000001);
    if (abs(next - t) < 0.0000005) { break; }
    if (next <= low || next >= high || derivative <= 0.0) { next = 0.5 * (low + high); }
    t = next;
  }
  var offset = p - transitionPosition(t, k);
  var tangent = transitionTangent(t, k);
  var result = vec2f(dot(offset, offset), dot(offset, vec2f(tangent.y, -tangent.x)));
  if (dot(p, p) < result.x) { result = vec2f(dot(p, p), -p.y); }
  var endOffset = p - end;
  if (dot(endOffset, endOffset) < result.x) {
    result = vec2f(dot(endOffset, endOffset), dot(endOffset, vec2f(k.z, -k.y)));
  }
  return result;
}

fn continuousRoundedRectSDF(p_in: vec2f, halfSize_in: vec2f, radius: f32) -> f32 {
  var p = p_in;
  var halfSize = halfSize_in;
  p = abs(p);
  if (radius < 0.0000001) {
    var d = p - halfSize;
    return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0)));
  }
  // Every candidate is measured in the same Euclidean metric, including fusion/shadows.
  p /= radius;
  halfSize /= radius;
  var top = u.u_cornerHorizontal;
  var side = u.u_cornerVertical;
  var start = max(halfSize - vec2f(1.0) - vec2f(top.w, side.w), vec2f(0.0));
  var topOffset = p - vec2f(clamp(p.x, 0.0, start.x), halfSize.y);
  var nearest = vec2f(dot(topOffset, topOffset), topOffset.y);
  var sideOffset = p - vec2f(halfSize.x, clamp(p.y, 0.0, start.y));
  if (dot(sideOffset, sideOffset) < nearest.x) { nearest = vec2f(dot(sideOffset, sideOffset), sideOffset.x); }
  var radial = p - (halfSize - vec2f(1.0));
  var sideNormal = vec2f(1.0, 0.0);
  var topNormal = vec2f(0.0, 1.0);
  if (side.z > 0.0) { sideNormal = normalize(vec2f(side.y, side.z)); }
  if (top.z > 0.0) { topNormal = normalize(vec2f(top.z, top.y)); }
  var circlePoint = radial / max(length(radial), 0.0000001);
  if (sideNormal.x * radial.y - sideNormal.y * radial.x < 0.0) { circlePoint = sideNormal; }
  else if (radial.x * topNormal.y - radial.y * topNormal.x < 0.0) { circlePoint = topNormal; }
  else if (dot(radial, radial) < 0.000000000001) { circlePoint = sideNormal; }
  var circleOffset = radial - circlePoint;
  var circleCandidate = vec2f(dot(circleOffset, circleOffset), dot(circleOffset, circlePoint));
  if (circleCandidate.x < nearest.x) { nearest = circleCandidate; }
  if (top.z > 0.0) {
    var query = vec2f(p.x - start.x, halfSize.y - p.y);
    var extent = vec2f(3.0 * top.x + top.y, top.z);
    var boxOffset = max(max(-query, query - extent), vec2f(0.0));
    if (dot(boxOffset, boxOffset) < nearest.x) {
      var candidate = transitionDistance(query, top);
      if (candidate.x < nearest.x) { nearest = candidate; }
    }
  }
  if (side.z > 0.0) {
    var query = vec2f(p.y - start.y, halfSize.x - p.x);
    var extent = vec2f(3.0 * side.x + side.y, side.z);
    var boxOffset = max(max(-query, query - extent), vec2f(0.0));
    if (dot(boxOffset, boxOffset) < nearest.x) {
      var candidate = transitionDistance(query, side);
      if (candidate.x < nearest.x) { nearest = candidate; }
    }
  }
  return sqrt(max(nearest.x, 0.0)) * select(1.0, -1.0, nearest.y < 0.0) * radius;
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
  if (k <= 0.0) { return min(a, b); }
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

fn shapeDistances(p1: vec2f, p2: vec2f, p: vec2f) -> vec2f {
  let p1n = p1 + p / u.u_resolution.y;
  let p2n = p2 + p / u.u_resolution.y;
  var d1: f32;
  if (u.u_showShape1 == 1) {
    d1 = sdCircle(p1n, 100.0 * u.u_dpr / u.u_resolution.y);
  } else {
    d1 = 1.0;
  }
  let d2 = continuousRoundedRectSDF(
    p2n,
    vec2f(u.u_shapeWidth, u.u_shapeHeight) * (0.5 * u.u_dpr / u.u_resolution.y),
    u.u_shapeRadius * u.u_dpr / u.u_resolution.y
  );
  return vec2f(d1, d2);
}

fn mainSDF(p1: vec2f, p2: vec2f, p: vec2f) -> f32 {
  let distances = shapeDistances(p1, p2, p);
  return smin(distances.x, distances.y, u.u_mergeRate);
}

// Background pass fragment shader for WebGPU
// Ported from fragment-bg.glsl

struct Uniforms {
  u_resolution: vec2f,
  u_dpr: f32,
  _pad0: f32,
  u_mouse: vec2f,
  u_mouseSpring: vec2f,
  u_shapeWidth: f32,
  u_shapeHeight: f32,
  u_shapeRadius: f32,
  _shapePad: f32,
  u_mergeRate: f32,
  u_glareAngle: f32,
  u_shadowExpand: f32,
  u_shadowFactor: f32,
  u_shadowPosition: vec2f,
  u_bgTextureRatio: f32,
  u_bgType: i32,
  u_bgTextureReady: i32,
  u_showShape1: i32,
  u_blurRadius: i32,
  u_blurEdge: i32,
  // main pass uniforms (unused here but in same buffer)
  u_tint: vec4f,
  u_refThickness: f32,
  u_refFactor: f32,
  u_refDispersion: f32,
  u_refFresnelRange: f32,
  u_refFresnelHardness: f32,
  u_refFresnelFactor: f32,
  u_glareRange: f32,
  u_glareHardness: f32,
  u_glareConvergence: f32,
  u_glareOppositeFactor: f32,
  u_glareFactor: f32,
  _pad1: f32,
  u_darkEdgeWidth: f32,
  u_darkEdgeFactor: f32,
  u_darkEdgeSoftness: f32,
  u_darkEdgeFade: f32,
  u_darkEdgeRange: f32,
  u_contourCount: i32,
  u_darkEdgeLighting: f32,
  _contourPad: i32,
  u_cornerHorizontal: vec4f,
  u_cornerVertical: vec4f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var u_bgTexture: texture_2d<f32>;
@group(0) @binding(2) var u_sampler: sampler;

fn chessboard(uv: vec2f, size: f32, mode: i32) -> f32 {
  let yBars = step(size * 2.0, (uv.y * 2.0) % (size * 4.0));
  let xBars = step(size * 2.0, (uv.x * 2.0) % (size * 4.0));
  if (mode == 0) {
    return yBars;
  } else if (mode == 1) {
    return xBars;
  } else {
    return abs(yBars - xBars);
  }
}

fn halfColor(uv: vec2f) -> f32 {
  if (uv.y > 0.5) {
    return 1.0;
  } else {
    return 0.0;
  }
}

#include './lib/sdf.wgsl'

fn getCoverUV(uv_in: vec2f, canvasAspect: f32, textureAspect: f32) -> vec2f {
  var uv = uv_in;
  if (canvasAspect > textureAspect) {
    let scale = textureAspect / canvasAspect;
    uv.y = uv.y * scale + 0.5 - 0.5 * scale;
  } else {
    let scale = canvasAspect / textureAspect;
    uv.x = uv.x * scale + 0.5 - 0.5 * scale;
  }
  return uv;
}

@fragment
fn fs_main(@builtin(position) frag_coord: vec4f, @location(0) v_uv: vec2f) -> @location(0) vec4f {
  let u_resolution1x = u.u_resolution / u.u_dpr;
  var bgColor = vec3f(1.0);

  // frag_coord.y is top-down in WebGPU; flip to get GLSL-style bottom-up pixel coords
  let pixel = vec2f(frag_coord.x, u.u_resolution.y - frag_coord.y);
  // v_uv has y=0 at top (WebGPU convention); compute GLSL-style uv with y=0 at bottom
  let gl_uv = vec2f(v_uv.x, 1.0 - v_uv.y);

  if (u.u_bgType <= 0) {
    bgColor = vec3f(1.0 - chessboard(pixel / u.u_dpr, 20.0, 2) / 4.0);
  } else if (u.u_bgType <= 1) {
    if (gl_uv.x < 0.5 && gl_uv.y > 0.5) {
      bgColor = vec3f(chessboard(pixel / u.u_dpr, 10.0, 0));
    } else if (gl_uv.x > 0.5 && gl_uv.y < 0.5) {
      bgColor = vec3f(chessboard(pixel / u.u_dpr, 10.0, 1));
    } else if (gl_uv.x < 0.5 && gl_uv.y < 0.5) {
      bgColor = vec3f(0.0);
    }
  } else if (u.u_bgType <= 2) {
    bgColor = vec3f(halfColor(pixel / u.u_resolution) * 0.6 + 0.3);
  } else if (u.u_bgType <= 11) {
    if (u.u_bgTextureReady != 1) {
      bgColor = vec3f(1.0 - chessboard(pixel / u.u_dpr, 20.0, 2) / 4.0);
    } else {
      // v_uv matches WebGPU texture coords (y=0 at top), correct for texture sampling
      let uv = getCoverUV(v_uv, u.u_resolution.x / u.u_resolution.y, u.u_bgTextureRatio);
      bgColor = textureSampleLevel(u_bgTexture, u_sampler, uv, 0.0).rgb;
    }
  }

  // shadow — uses pixel (GLSL-style bottom-up coords) for SDF
  let p1 = (vec2f(0.0) - u.u_resolution * 0.5 + vec2f(u.u_shadowPosition.x * u.u_dpr, u.u_shadowPosition.y * u.u_dpr)) / u.u_resolution.y;
  let p2 = (vec2f(0.0) - u.u_mouseSpring + vec2f(u.u_shadowPosition.x * u.u_dpr, u.u_shadowPosition.y * u.u_dpr)) / u.u_resolution.y;
  let merged = mainSDF(p1, p2, pixel);
  let shadow = exp(-1.0 / u.u_shadowExpand * abs(merged) * u_resolution1x.y) * 0.6 * u.u_shadowFactor;

  return vec4f(bgColor - vec3f(shadow), 1.0);
}

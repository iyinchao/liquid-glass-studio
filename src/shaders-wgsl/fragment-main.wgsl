// Main glass effect composition shader for WebGPU
// Ported from fragment-main.glsl (STEP==9 branch only)

const PI: f32 = 3.14159265359;
const N_R: f32 = 0.98; // 1.0 - 0.02
const N_G: f32 = 1.0;
const N_B: f32 = 1.02; // 1.0 + 0.02

struct Uniforms {
  u_resolution: vec2f,
  u_dpr: f32,
  _pad0: f32,
  u_mouse: vec2f,
  u_mouseSpring: vec2f,
  u_shapeWidth: f32,
  u_shapeHeight: f32,
  u_shapeRadius: f32,
  u_shapeRoundness: f32,
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
  u_refDistance: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var u_blurredBg: texture_2d<f32>;
@group(0) @binding(2) var u_bg: texture_2d<f32>;
@group(0) @binding(3) var u_sampler: sampler;

#include './lib/sdf.wgsl'
#include './lib/math.wgsl'

fn getNormal(p1: vec2f, p2: vec2f, p: vec2f) -> vec2f {
  // dFdx(gl_FragCoord.x) = 1.0 on a fullscreen quad, so eps = 1.0
  let h = vec2f(1.0, 1.0);
  let grad = vec2f(
    mainSDF(p1, p2, p + vec2f(h.x, 0.0)) - mainSDF(p1, p2, p - vec2f(h.x, 0.0)),
    mainSDF(p1, p2, p + vec2f(0.0, h.y)) - mainSDF(p1, p2, p - vec2f(0.0, h.y))
  ) / (2.0 * h);
  return grad * 1.414213562 * 1000.0;
}

// Safe normalize: returns zero vector instead of NaN when length is near zero
fn safeNormalize(v: vec2f) -> vec2f {
  let len = length(v);
  if (len < 1e-8) {
    return vec2f(0.0);
  }
  return v / len;
}

#include './lib/color.wgsl'

fn vec2ToAngle(v: vec2f) -> f32 {
  var angle = atan2(v.y, v.x);
  if (angle < 0.0) { angle += 2.0 * PI; }
  return angle;
}

// ---- Texture dispersion ----

fn getTextureDispersion(v_uv: vec2f, mixRate: f32, offset: vec2f, factor: f32) -> vec4f {
  var pixel = vec4f(1.0);

  let bgR = textureSampleLevel(u_bg, u_sampler, v_uv + offset * (1.0 - (N_R - 1.0) * factor), 0.0).r;
  let bgG = textureSampleLevel(u_bg, u_sampler, v_uv + offset * (1.0 - (N_G - 1.0) * factor), 0.0).g;
  let bgB = textureSampleLevel(u_bg, u_sampler, v_uv + offset * (1.0 - (N_B - 1.0) * factor), 0.0).b;

  let blurR = textureSampleLevel(u_blurredBg, u_sampler, v_uv + offset * (1.0 - (N_R - 1.0) * factor), 0.0).r;
  let blurG = textureSampleLevel(u_blurredBg, u_sampler, v_uv + offset * (1.0 - (N_G - 1.0) * factor), 0.0).g;
  let blurB = textureSampleLevel(u_blurredBg, u_sampler, v_uv + offset * (1.0 - (N_B - 1.0) * factor), 0.0).b;

  pixel.r = mix(bgR, blurR, mixRate);
  pixel.g = mix(bgG, blurG, mixRate);
  pixel.b = mix(bgB, blurB, mixRate);

  return pixel;
}

// ---- Main fragment shader (STEP==9 equivalent) ----

@fragment
fn fs_main(@builtin(position) frag_coord: vec4f, @location(0) v_uv: vec2f) -> @location(0) vec4f {
  let u_resolution1x = u.u_resolution / u.u_dpr;

  // WebGPU frag_coord.y is top-down, flip to match GLSL bottom-up convention
  let pixel = vec2f(frag_coord.x, u.u_resolution.y - frag_coord.y);

  // center of shape 1
  let p1 = (vec2f(0.0) - u.u_resolution * 0.5) / u.u_resolution.y;
  // center of shape 2
  let p2 = (vec2f(0.0) - u.u_mouseSpring) / u.u_resolution.y;
  // merged shape
  let merged = mainSDF(p1, p2, pixel);

  var outColor: vec4f;

  if (merged < 0.005) {
    let nmerged = -1.0 * (merged * u_resolution1x.y);

    // calculate refraction edge factor
    let x_R_ratio = 1.0 - nmerged / u.u_refThickness;
    let thetaI = safeAsin(pow(x_R_ratio, 2.0));
    let thetaT = safeAsin(1.0 / u.u_refFactor * sin(thetaI));
    var edgeFactor = -1.0 * tan(thetaT - thetaI);
    if (nmerged >= u.u_refThickness) {
      edgeFactor = 0.0;
    }

    if (edgeFactor <= 0.0) {
      outColor = textureSampleLevel(u_blurredBg, u_sampler, v_uv, 0.0);
      outColor = mix(outColor, vec4f(u.u_tint.r, u.u_tint.g, u.u_tint.b, 1.0), u.u_tint.a * 0.8);
    } else {
      let edgeH = nmerged / u.u_refThickness;
      let normal = getNormal(p1, p2, pixel);

      var blurMixRate: f32;
      if (u.u_blurEdge > 0) {
        blurMixRate = 1.0;
      } else {
        blurMixRate = edgeH;
      }

      // Normal is in GLSL bottom-up coords (Y up), but v_uv.y is top-down (Y down).
      // Flip the Y component of the offset to match v_uv orientation.
      let refOffset = -normal * edgeFactor * u.u_refDistance * u.u_dpr * vec2f(
        u.u_resolution.y / (u_resolution1x.x * u.u_dpr),
        1.0
      );
      let blurredPixel = getTextureDispersion(
        v_uv,
        blurMixRate,
        vec2f(refOffset.x, -refOffset.y),
        u.u_refDispersion
      );

      // basic tint
      outColor = mix(blurredPixel, vec4f(u.u_tint.r, u.u_tint.g, u.u_tint.b, 1.0), u.u_tint.a * 0.8);

      // add fresnel
      let fresnelFactor = clamp(
        pow(
          1.0 + merged * u_resolution1x.y / 1500.0 * pow(500.0 / u.u_refFresnelRange, 2.0) + u.u_refFresnelHardness,
          5.0
        ),
        0.0, 1.0
      );

      var fresnelTintLCH = SRGB_TO_LCH(
        mix(vec3f(1.0), vec3f(u.u_tint.r, u.u_tint.g, u.u_tint.b), u.u_tint.a * 0.5)
      );
      fresnelTintLCH.x += 20.0 * fresnelFactor * u.u_refFresnelFactor;
      fresnelTintLCH.x = clamp(fresnelTintLCH.x, 0.0, 100.0);

      outColor = mix(
        outColor,
        vec4f(LCH_TO_SRGB(fresnelTintLCH), 1.0),
        fresnelFactor * u.u_refFresnelFactor * 0.7 * length(normal)
      );

      // add glare
      let glareGeoFactor = clamp(
        pow(
          1.0 + merged * u_resolution1x.y / 1500.0 * pow(500.0 / u.u_glareRange, 2.0) + u.u_glareHardness,
          5.0
        ),
        0.0, 1.0
      );

      let glareAngle = (vec2ToAngle(safeNormalize(normal)) - PI / 4.0 + u.u_glareAngle) * 2.0;
      var glareFarside: i32 = 0;
      if ((glareAngle > PI * (2.0 - 0.5) && glareAngle < PI * (4.0 - 0.5)) || glareAngle < PI * (0.0 - 0.5)) {
        glareFarside = 1;
      }

      var glareSideFactor: f32;
      if (glareFarside == 1) {
        glareSideFactor = 1.2 * u.u_glareOppositeFactor;
      } else {
        glareSideFactor = 1.2;
      }

      var glareAngleFactor = (0.5 + sin(glareAngle) * 0.5) * glareSideFactor * u.u_glareFactor;
      glareAngleFactor = clamp(pow(glareAngleFactor, 0.1 + u.u_glareConvergence * 2.0), 0.0, 1.0);

      var glareTintLCH = SRGB_TO_LCH(
        mix(blurredPixel.rgb, vec3f(u.u_tint.r, u.u_tint.g, u.u_tint.b), u.u_tint.a * 0.5)
      );
      glareTintLCH.x += 150.0 * glareAngleFactor * glareGeoFactor;
      glareTintLCH.y += 30.0 * glareAngleFactor * glareGeoFactor;
      glareTintLCH.x = clamp(glareTintLCH.x, 0.0, 120.0);

      outColor = mix(
        outColor,
        vec4f(LCH_TO_SRGB(glareTintLCH), 1.0),
        glareAngleFactor * glareGeoFactor * length(normal)
      );
    }
  } else {
    outColor = textureSampleLevel(u_bg, u_sampler, v_uv, 0.0);
  }

  // smooth edge transition
  outColor = mix(outColor, textureSampleLevel(u_bg, u_sampler, v_uv, 0.0), smoothstep(-0.001, 0.001, merged));

  return outColor;
}

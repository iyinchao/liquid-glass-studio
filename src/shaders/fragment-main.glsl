#version 300 es

precision highp float;

#define PI (3.14159265359)

const float N_R = 1.0 - 0.02;
const float N_G = 1.0;
const float N_B = 1.0 + 0.02;

in vec2 v_uv;
uniform sampler2D u_blurredBg;
uniform sampler2D u_bg;
uniform vec2 u_resolution;
uniform float u_dpr;
uniform vec2 u_mouse;
uniform vec2 u_mouseSpring;
uniform float u_mergeRate;
uniform float u_shapeWidth;
uniform float u_shapeHeight;
uniform float u_shapeRadius;
uniform vec4 u_cornerHorizontal;
uniform vec4 u_cornerVertical;
uniform vec4 u_tint;
uniform float u_refThickness;
uniform float u_refDistance;
uniform float u_refFactor;
uniform float u_refDispersion;
uniform float u_refFresnelRange;
uniform float u_refFresnelFactor;
uniform float u_refFresnelHardness;
uniform float u_darkEdgeWidth;
uniform float u_darkEdgeFactor;
uniform float u_darkEdgeSoftness;
uniform float u_darkEdgeFade;
uniform float u_darkEdgeRange;
uniform float u_darkEdgeLighting;
uniform int u_contourCount;
uniform vec4 u_contourPoints[128];
uniform float u_glareRange;
uniform float u_glareConvergence;
uniform float u_glareOppositeFactor;
uniform float u_glareFactor;
uniform float u_glareHardness;
uniform float u_glareAngle;
uniform int u_blurEdge;
uniform int u_showShape1;

uniform int STEP;

out vec4 fragColor;

#include './lib/sdf.glsl'
#include './lib/math.glsl'

vec2 getNormal(vec2 p1, vec2 p2, vec2 p) {
  // 使用场景尺度自适应的 eps
  vec2 h = vec2(max(abs(dFdx(p.x)), 0.0001), max(abs(dFdy(p.y)), 0.0001));

  vec2 grad =
    vec2(
      mainSDF(p1, p2, p + vec2(h.x, 0.0)) - mainSDF(p1, p2, p - vec2(h.x, 0.0)),
      mainSDF(p1, p2, p + vec2(0.0, h.y)) - mainSDF(p1, p2, p - vec2(0.0, h.y))
    ) /
    (2.0 * h);

  // return normalize(grad);
  return grad * 1.414213562 * 1000.0;
}

vec2 getNormal2(vec2 p1, vec2 p2, vec2 p) {
  float eps = 0.7071 * 0.0005; // ~1/sqrt(2) * epsilon
  vec2 e1 = vec2(1.0, 1.0);
  vec2 e2 = vec2(-1.0, 1.0);
  vec2 e3 = vec2(1.0, -1.0);
  vec2 e4 = vec2(-1.0, -1.0);

  return normalize(
    e1 * mainSDF(p1, p2, p + eps * e1) +
      e2 * mainSDF(p1, p2, p + eps * e2) +
      e3 * mainSDF(p1, p2, p + eps * e3) +
      e4 * mainSDF(p1, p2, p + eps * e4)
  );
}

vec2 getNormal3(vec2 p1, vec2 p2, vec2 p) {
  float eps = 0.0005;
  vec2 e = vec2(eps, 0.0);

  float dx = mainSDF(p1, p2, p + e.xy) - mainSDF(p1, p2, p - e.xy); // ∂f/∂x
  float dy = mainSDF(p1, p2, p + e.yx) - mainSDF(p1, p2, p - e.yx); // ∂f/∂y

  return normalize(vec2(dx, dy));
}

#include './lib/color.glsl'

float vec2ToAngle(vec2 v) {
  if (dot(v, v) < 0.000000000001) return 0.0;
  float angle = atan(v.y, v.x);
  if (angle < 0.0) angle += 2.0 * PI;
  return angle;
}

vec3 vec2ToRgb(vec2 v) {
  float angle = atan(v.y, v.x);
  if (angle < 0.0) angle += 2.0 * PI;
  float hue = angle / (2.0 * PI);
  vec3 hsv = vec3(hue, 1.0, 1.0);
  return hsv2rgb(hsv);
}

vec4 getTextureDispersion(
  sampler2D tex1,
  sampler2D tex2,
  float mixRate,
  vec2 offset,
  float factor
) {
  vec4 pixel = vec4(1.0);

  float bgR = texture(tex1, v_uv + offset * (1.0 - (N_R - 1.0) * factor)).r;
  float bgG = texture(tex1, v_uv + offset * (1.0 - (N_G - 1.0) * factor)).g;
  float bgB = texture(tex1, v_uv + offset * (1.0 - (N_B - 1.0) * factor)).b;

  float blurR = texture(tex2, v_uv + offset * (1.0 - (N_R - 1.0) * factor)).r;
  float blurG = texture(tex2, v_uv + offset * (1.0 - (N_G - 1.0) * factor)).g;
  float blurB = texture(tex2, v_uv + offset * (1.0 - (N_B - 1.0) * factor)).b;

  pixel.r = mix(bgR, blurR, mixRate);
  pixel.g = mix(bgG, blurG, mixRate);
  pixel.b = mix(bgB, blurB, mixRate);

  return pixel;
}

// Local rectangle coordinates never change when shapes translate or merge.
vec2 rectangleContourPhase(vec2 pixel) {
  float bestDistance = 1e30;
  float fraction = 0.0;
  for (int i = 0; i < 128; i++) {
    if (i >= u_contourCount) break;
    vec4 a = u_contourPoints[i];
    int next = (i + 1) % u_contourCount;
    vec4 b = u_contourPoints[next];
    vec2 edge = b.xy - a.xy;
    float t = clamp(dot(pixel - a.xy, edge) / max(dot(edge, edge), 0.000001), 0.0, 1.0);
    vec2 offset = pixel - mix(a.xy, b.xy, t);
    float distance = dot(offset, offset);
    if (distance < bestDistance) {
      bestDistance = distance;
      // Unwrap before interpolation, including on long straight edges.
      fraction = mix(a.z, b.z + (next == 0 ? 1.0 : 0.0), t);
    }
  }
  float phase = 4.0 * PI * fraction;
  return vec2(cos(phase), sin(phase));
}

// Double-angle vectors encode the two opposite highlight peaks without a 0/2PI seam.
vec2 doublePhase(vec2 v, float denominator) {
  return vec2(v.x * v.x - v.y * v.y, 2.0 * v.x * v.y) / max(denominator, 1e-12);
}

void main() {
  vec2 u_resolution1x = u_resolution.xy / u_dpr;
  // center of shape 1
  vec2 p1 = (vec2(0, 0) - u_resolution.xy * 0.5) / u_resolution.y;
  // center of shape 2
  vec2 p2 = (vec2(0, 0) - u_mouseSpring) / u_resolution.y;
  // merged shape
  vec2 distances = shapeDistances(p1, p2, gl_FragCoord.xy);
  float merged = smin(distances.x, distances.y, u_mergeRate);


  // Normalize the SDF gradient so the border stays in CSS pixels, including at merged corners.
  vec2 sdfGradientVector = vec2(dFdx(merged), dFdy(merged));
  float sdfGradient = max(length(sdfGradientVector), 0.000001);
  float insideDistance = max(-merged / (sdfGradient * u_dpr), 0.0);
  float edgeSoftness = max(u_darkEdgeSoftness, 0.5 / u_dpr);
  float rimShade = 0.0;
  if (u_contourCount > 1 && u_darkEdgeWidth > 0.0 && u_darkEdgeFactor > 0.0 &&
      abs(merged) / (sdfGradient * u_dpr) < u_darkEdgeWidth + edgeSoftness + 2.0 / u_dpr) {
    // Use the same smooth-union weight as the silhouette.
    float h = u_mergeRate > 0.0
      ? clamp(0.5 + 0.5 * (distances.y - distances.x) / u_mergeRate, 0.0, 1.0)
      : step(distances.x, distances.y);
    if (u_showShape1 != 1) h = 0.0;
    vec2 localCircle = (gl_FragCoord.xy - u_resolution * 0.5) / u_dpr;
    vec2 circlePhase = doublePhase(localCircle, dot(localCircle, localCircle));
    vec2 rectanglePhase = rectangleContourPhase((gl_FragCoord.xy - u_mouseSpring) / u_dpr);
    vec2 arcPhase = mix(rectanglePhase, circlePhase, h);

    vec2 dx = 0.5 * (shapeDistances(p1, p2, gl_FragCoord.xy + vec2(1.0, 0.0)) - shapeDistances(p1, p2, gl_FragCoord.xy - vec2(1.0, 0.0)));
    vec2 dy = 0.5 * (shapeDistances(p1, p2, gl_FragCoord.xy + vec2(0.0, 1.0)) - shapeDistances(p1, p2, gl_FragCoord.xy - vec2(0.0, 1.0)));
    vec2 circleGradient = vec2(dx.x, dy.x);
    vec2 rectangleGradient = vec2(dx.y, dy.y);
    vec2 gradient = mix(rectangleGradient, circleGradient, h);
    float reference = mix(length(rectangleGradient), length(circleGradient), h);
    // Preserve cancellation at the neck: normalizing this vector would amplify noise.
    vec2 physicalPhase = doublePhase(gradient, reference * reference);
    vec2 phase = mix(arcPhase, physicalPhase, clamp(u_darkEdgeLighting, 0.0, 1.0));
    float signal = dot(phase, vec2(cos(2.0 * u_glareAngle), -sin(2.0 * u_glareAngle)));
    float progress = acos(clamp(signal, -1.0, 1.0)) / PI;
    float arcRate = mix(u_contourPoints[0].w, 2.0 / (PI * 100.0), h);
    float coverage = clamp(u_darkEdgeRange, 0.0, 1.0);
    float fade = coverage * clamp(u_darkEdgeFade, 0.0, 1.0);
    float antialias = max(arcRate / u_dpr, 0.00001);
    rimShade = (1.0 - smoothstep(
      max(coverage - max(fade, antialias), 0.0),
      max(coverage, 0.00001),
      progress
    )) * step(0.00001, coverage);
  }
  // Arc-length coverage changes opacity; radial width remains fixed inside the outline.
  float darkEdgeOpacity = u_darkEdgeFactor * rimShade *
    step(0.0001, u_darkEdgeWidth) *
    (1.0 - smoothstep(
      max(u_darkEdgeWidth - edgeSoftness, 0.0),
      u_darkEdgeWidth + edgeSoftness,
      insideDistance
    ));

  vec4 outColor;
  // step 0: sdfs
  if (STEP <= 0) {
    float px = 2.0 / u_resolution.y;
    vec3 col = merged > 0.0 ? vec3(1.0, 1.0, 1.0) * merged : vec3(1.0, 1.0, 1.0) * -merged * 2.0;
    col *= 3.0;
    col = mix(
      col,
      vec3(1.0),
      1.0 - smoothstep(0.5 / u_resolution1x.y - px, 0.5 / u_resolution1x.y + px, abs(merged))
    );
    outColor = vec4(col, 1.0);
  } else if (STEP <= 1) {
    float px = 2.0 / u_resolution.y;
    vec3 col = merged > 0.0 ? vec3(0.9, 0.6, 0.3) : vec3(0.65, 0.85, 1.0);
    // 阴影
    col *= 1.0 - exp(-0.03 * abs(merged) * u_resolution1x.y);
    // 等高线
    col *= 0.6 + 0.4 * smoothstep(-0.5, 0.5, cos(0.25 * abs(merged) * u_resolution1x.y * 2.0));
    // 外层白框
    col = mix(
      col,
      vec3(1.0),
      1.0 - smoothstep(1.5 / u_resolution1x.y - px, 1.5 / u_resolution1x.y + px, abs(merged))
    );
    outColor = vec4(col, 1.0);
    // step 1: normals
  } else if (STEP <= 2) {
    if (merged < 0.0) {
      vec2 normal = getNormal(p1, p2, gl_FragCoord.xy);
      vec3 normalColor = vec2ToRgb(normal);

      float l = length(normal);

      outColor = vec4(normalColor, l);
    } else {
      outColor = vec4(vec3(0.8), 0.0);
    }
    // step2: edge factors
  } else if (STEP <= 3) {
    if (merged < 0.0) {
      float nmerged = -1.0 * (merged * u_resolution1x.y);

      float x_R_ratio = 1.0 - nmerged / u_refThickness;
      float thetaI = safeAsin(pow(x_R_ratio, 2.0));
      float thetaT = safeAsin(1.0 / u_refFactor * sin(thetaI));
      float edgeFactor = -1.0 * tan(thetaT - thetaI);
      if (nmerged >= u_refThickness) {
        edgeFactor = 0.0;
      }

      if (nmerged < u_refThickness) {
        outColor = vec4(vec3(edgeFactor), 1.0);
      } else {
        outColor = vec4(vec3(0.0), 1.0);
      }
    } else {
      outColor = vec4(0.0);
    }
    // step3: edge factor with normal
  } else if (STEP <= 4) {
    if (merged < 0.0) {
      vec2 normal = getNormal(p1, p2, gl_FragCoord.xy);
      vec3 normalColor = vec2ToRgb(normal);
      float nmerged = -1.0 * (merged * u_resolution1x.y);

      float x_R_ratio = 1.0 - nmerged / u_refThickness;
      float thetaI = safeAsin(pow(x_R_ratio, 2.0));
      float thetaT = safeAsin(1.0 / u_refFactor * sin(thetaI));
      float edgeFactor = -1.0 * tan(thetaT - thetaI);
      if (nmerged >= u_refThickness) {
        edgeFactor = 0.0;
      }

      outColor = vec4(normalColor * edgeFactor * u_dpr * length(normal), 1.0);
    } else {
      outColor = vec4(0.0);
    }
    // add refaction
  } else if (STEP <= 5) {
    if (merged < 0.0) {
      outColor = texture(u_blurredBg, v_uv);
    } else {
      outColor = texture(u_bg, v_uv);
    }
  } else if (STEP <= 6) {
    if (merged < 0.0) {
      vec2 normal = getNormal(p1, p2, gl_FragCoord.xy);
      float nmerged = -1.0 * (merged * u_resolution1x.y);

      float x_R_ratio = 1.0 - nmerged / u_refThickness;
      float thetaI = safeAsin(pow(x_R_ratio, 2.0));
      float thetaT = safeAsin(1.0 / u_refFactor * sin(thetaI));
      float edgeFactor = -1.0 * tan(thetaT - thetaI);
      // Will have value > 0 inside of shape, force normalize here
      if (nmerged >= u_refThickness) {
        edgeFactor = 0.0;
      }

      if (edgeFactor <= 0.0) {
        outColor = texture(u_blurredBg, v_uv);
      } else {
        vec4 blurredPixel = texture(
          u_blurredBg,
          v_uv -
            normal *
              edgeFactor *
              u_refDistance *
              u_dpr *
              vec2(
                u_resolution.y / u_resolution1x.x, /* resolution independent */
                1.0
              )
        );
        outColor = blurredPixel;
      }
    } else {
      outColor = texture(u_bg, v_uv);
    }
    //
  } else if (STEP <= 7) {
    if (merged < 0.0) {
      vec2 normal = getNormal(p1, p2, gl_FragCoord.xy);
      float nmerged = -1.0 * (merged * u_resolution1x.y);

      float x_R_ratio = 1.0 - nmerged / u_refThickness;
      float thetaI = safeAsin(pow(x_R_ratio, 2.0));
      float thetaT = safeAsin(1.0 / u_refFactor * sin(thetaI));
      float edgeFactor = -1.0 * tan(thetaT - thetaI);
      // Will have value > 0 inside of shape, force normalize here
      if (nmerged >= u_refThickness) {
        edgeFactor = 0.0;
      }

      // other fresnel implements:
      // float r0 = pow((1.0 - u_refFactor) / (1.0 + u_refFactor), 2.0);
      // float fresnelFactor = r0 + (1.0 - r0) * pow(1.0 - cos(thetaI), 5.0);
      // if (fresnelFactor < 0.028) {
      //   fresnelFactor = 0.0;
      // }
      // fresnelFactor *= 10.0;

      // float fresnelFactor =
      //   0.5 *
      //   (pow(sin(thetaI - thetaT) / sin(thetaI + thetaT), 2.0) +
      //     pow(tan(thetaI - thetaT) / tan(thetaI + thetaT), 2.0));
      // fresnelFactor = clamp(fresnelFactor, 0.0, 1.0);

      float fresnelFactor = clamp(
        pow(
          1.0 +
            merged * u_resolution1x.y / 1500.0 * pow(500.0 / u_refFresnelRange, 2.0) +
            u_refFresnelHardness,
          5.0
        ),
        0.0,
        1.0
      );

      if (edgeFactor <= 0.0) {
        outColor = texture(u_blurredBg, v_uv);
      } else {
        vec4 blurredPixel = texture(
          u_blurredBg,
          v_uv -
            normal *
              edgeFactor *
              u_refDistance *
              u_dpr *
              vec2(
                u_resolution.y / u_resolution1x.x, /* resolution independent */
                1.0
              ),
          u_refDispersion
        );
        outColor = mix(blurredPixel, vec4(1.0), fresnelFactor * u_refFresnelFactor * 0.7);
        // outColor = vec4(vec3(fresnelFactor), 1.0);
      }
    } else {
      outColor = texture(u_bg, v_uv);
    }
  } else if (STEP <= 8) {
    if (merged < 0.0) {
      float nmerged = -1.0 * (merged * u_resolution1x.y);

      float x_R_ratio = 1.0 - nmerged / u_refThickness;
      float thetaI = safeAsin(pow(x_R_ratio, 2.0));
      float thetaT = safeAsin(1.0 / u_refFactor * sin(thetaI));
      float edgeFactor = -1.0 * tan(thetaT - thetaI);
      // Will have value > 0 inside of shape, force normalize here
      if (nmerged >= u_refThickness) {
        edgeFactor = 0.0;
      }

      float fresnelFactor = clamp(
        pow(
          1.0 +
            merged * u_resolution1x.y / 1500.0 * pow(500.0 / u_refFresnelRange, 2.0) +
            u_refFresnelHardness,
          5.0
        ),
        0.0,
        1.0
      );

      float glareGeoFactor = clamp(
        pow(
          1.0 +
            merged * u_resolution1x.y / 1500.0 * pow(500.0 / u_glareRange, 2.0) +
            u_glareHardness,
          5.0
        ),
        0.0,
        1.0
      );

      if (edgeFactor <= 0.0) {
        outColor = texture(u_blurredBg, v_uv);
        //
        // outColor = mix(
        //   outColor,
        //   vec4(u_tint.r, u_tint.g, u_tint.b, u_tint.a * 0.5),
        //   u_tint.a * 0.8
        // );
        // outColor.a = 1.0;
      } else {
        vec2 normal = getNormal(p1, p2, gl_FragCoord.xy);

        float glareAngle = (vec2ToAngle(normalize(normal)) - PI / 4.0 + u_glareAngle) * 2.0;
        int glareFarside = 0;
        if (
          glareAngle > PI * (2.0 - 0.5) && glareAngle < PI * (4.0 - 0.5) ||
          glareAngle < PI * (0.0 - 0.5)
        ) {
          glareFarside = 1;
        }

        float glareAngleFactor =
          (0.5 + sin(glareAngle) * 0.5) * 1.0 * (glareFarside == 1 ? 0.8 : 1.2) * u_glareFactor;
        glareAngleFactor = clamp(pow(glareAngleFactor, 0.3 + u_glareConvergence * 1.5), 0.0, 1.0);

        vec4 blurredPixel = texture(
          u_blurredBg,
          v_uv -
            normal *
              edgeFactor *
              u_refDistance *
              u_dpr *
              vec2(
                u_resolution.y / u_resolution1x.x, /* resolution independent */
                1.0
              ),
          u_refDispersion
        );
        //
        // outColor = mix(
        //   blurredPixel,
        //   vec4(u_tint.r, u_tint.g, u_tint.b, u_tint.a * 0.5),
        //   u_tint.a * 0.8
        // );
        // outColor.a = 1.0;
        // outColor = mix(outColor, vec4(1.0), fresnelFactor * u_refFresnelFactor * 0.7);
        outColor = blurredPixel;

        vec3 tintLCH = SRGB_TO_LCH(
          mix(vec3(1.0), vec3(u_tint.r, u_tint.g, u_tint.b), u_tint.a * 0.5)
        );
        tintLCH.x += 20.0 * fresnelFactor * u_refFresnelFactor;
        tintLCH.x = clamp(tintLCH.x, 0.0, 100.0);

        outColor = mix(
          outColor,
          // vec4(
          // LCH_TO_SRGB(tintLCH),
          // u_tint.a * 0.5
          // ),
          vec4(1.0),
          fresnelFactor * u_refFresnelFactor * 0.7
        );

        // ------
        outColor = mix(
          outColor,
          // vec4(
          //   LCH_TO_SRGB(tintLCH),
          //   u_tint.a * 0.5
          // ),
          vec4(1.0),
          glareAngleFactor * glareGeoFactor
        );
        // outColor = vec4(vec3(glareAngleFactor * glareGeoFactor), 1.0);
      }
    } else {
      outColor = texture(u_bg, v_uv);
    }
  } else if (STEP <= 9) {
    if (merged < 0.005) {
      float nmerged = -1.0 * (merged * u_resolution1x.y);

      // calculate refraction edge factor:
      float x_R_ratio = 1.0 - nmerged / u_refThickness;
      float thetaI = safeAsin(pow(x_R_ratio, 2.0));
      float thetaT = safeAsin(1.0 / u_refFactor * sin(thetaI));
      float edgeFactor = -1.0 * tan(thetaT - thetaI);
      // Will have value > 0 inside of shape, force normalize here
      if (nmerged >= u_refThickness) {
        edgeFactor = 0.0;
      }

      if (edgeFactor <= 0.0) {
        outColor = texture(u_blurredBg, v_uv);
        outColor = mix(outColor, vec4(u_tint.r, u_tint.g, u_tint.b, 1.0), u_tint.a * 0.8);
      } else {
        // height of glass edge:
        // h = r - sqrt(r*r - x*x) // (0<=x<=r)
        float edgeH = nmerged / u_refThickness;
        // (u_refThickness - sqrt(u_refThickness * u_refThickness - nmerged * nmerged)) /
        // u_refThickness;
        // u_refThickness - pow(u_refThickness * u_refThickness - nmerged * nmerged, 0.5);
        // u_refThickness - pow(u_refThickness * u_refThickness - nmerged * nmerged, 0.5);
        // calculate parameters
        vec2 normal = getNormal(p1, p2, gl_FragCoord.xy);
        vec4 blurredPixel = getTextureDispersion(
          u_bg,
          u_blurredBg,
          u_blurEdge > 0
            ? 1.0
            : edgeH,
          -normal *
            edgeFactor *
            u_refDistance *
            u_dpr *
            vec2(
              u_resolution.y / (u_resolution1x.x * u_dpr), /* resolution independent */
              1.0
            ),
          u_refDispersion
        );

        // basic tint
        outColor = mix(blurredPixel, vec4(u_tint.r, u_tint.g, u_tint.b, 1.0), u_tint.a * 0.8);

        // add fresnel
        float fresnelFactor = clamp(
          pow(
            1.0 +
              merged * u_resolution1x.y / 1500.0 * pow(500.0 / u_refFresnelRange, 2.0) +
              u_refFresnelHardness,
            5.0
          ),
          0.0,
          1.0
        );

        vec3 fresnelTintLCH = SRGB_TO_LCH(
          mix(vec3(1.0), vec3(u_tint.r, u_tint.g, u_tint.b), u_tint.a * 0.5)
        );
        fresnelTintLCH.x += 20.0 * fresnelFactor * u_refFresnelFactor;
        fresnelTintLCH.x = clamp(fresnelTintLCH.x, 0.0, 100.0);

        outColor = mix(
          outColor,
          vec4(LCH_TO_SRGB(fresnelTintLCH), 1.0),
          fresnelFactor * u_refFresnelFactor * 0.7 * length(normal)
        );

        // add glare
        float glareGeoFactor = clamp(
          pow(
            1.0 +
              merged * u_resolution1x.y / 1500.0 * pow(500.0 / u_glareRange, 2.0) +
              u_glareHardness,
            5.0
          ),
          0.0,
          1.0
        );

        float glareAngle = (vec2ToAngle(normalize(normal)) - PI / 4.0 + u_glareAngle) * 2.0;
        int glareFarside = 0;
        if (
          glareAngle > PI * (2.0 - 0.5) && glareAngle < PI * (4.0 - 0.5) ||
          glareAngle < PI * (0.0 - 0.5)
        ) {
          glareFarside = 1;
        }
        float glareAngleFactor =
          (0.5 + sin(glareAngle) * 0.5) *
          (glareFarside == 1
            ? 1.2 * u_glareOppositeFactor
            : 1.2) *
          u_glareFactor;
        glareAngleFactor = clamp(pow(glareAngleFactor, 0.1 + u_glareConvergence * 2.0), 0.0, 1.0);

        vec3 glareTintLCH = SRGB_TO_LCH(
          mix(blurredPixel.rgb, vec3(u_tint.r, u_tint.g, u_tint.b), u_tint.a * 0.5)
        );
        glareTintLCH.x += 150.0 * glareAngleFactor * glareGeoFactor;
        glareTintLCH.y += 30.0 * glareAngleFactor * glareGeoFactor;
        glareTintLCH.x = clamp(glareTintLCH.x, 0.0, 120.0);

        float glareWeight = glareAngleFactor * glareGeoFactor * length(normal);
        outColor = mix(
          outColor,
          vec4(LCH_TO_SRGB(glareTintLCH), 1.0),
          glareWeight
        );
      }
    } else {
      outColor = texture(u_bg, v_uv);
    }

    // The transparent angular plateau reproduces the original highlight exactly.
    outColor.rgb *= 1.0 - darkEdgeOpacity;

    // Share the silhouette coverage with the bright rim, including its antialiasing fringe.
    outColor = mix(outColor, texture(u_bg, v_uv), smoothstep(-0.001, 0.001, merged));

  }

  fragColor = outColor;
}

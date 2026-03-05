// Full port of fragment-main.glsl to WGSL for WebGPU.
// All features: SDF shapes, editor mode, text SDF, refraction, dispersion,
// Fresnel, glare, color-space conversions, tone mapping, UI content, emissive.

struct MainUniforms {
    u_resolution: vec2<f32>,
    u_dpr: f32,
    u_mergeRate: f32,
    u_mouse: vec2<f32>,
    u_shapeWidth: f32,
    u_shapeHeight: f32,
    u_mouseSpring: vec2<f32>,
    u_shapeRadius: f32,
    u_shapeRoundness: f32,
    u_tint: vec4<f32>,
    u_refThickness: f32,
    u_refFactor: f32,
    u_refDispersion: f32,
    u_refFresnelRange: f32,
    u_refFresnelFactor: f32,
    u_refFresnelHardness: f32,
    u_glareRange: f32,
    u_glareConvergence: f32,
    u_glareOppositeFactor: f32,
    u_glareFactor: f32,
    u_glareHardness: f32,
    u_glareAngle: f32,
    u_blurEdge: i32,
    u_showShape1: i32,
    u_emissiveColor: vec3<f32>,
    u_emissiveIntensity: f32,
    u_emissivePulse: f32,
    u_hdrEnabled: i32,
    u_exposure: f32,
    u_toneMappingType: i32,
    u_bloom: f32,
    u_uiContentEnabled: i32,
    u_uiContentOpacity: f32,
    u_shapeCount: i32,
    u_shapes: array<vec4<f32>, 8>,
    u_shapeParams: array<vec4<f32>, 8>,
    u_textEnabled: i32,
    u_textScale: f32,
    STEP: i32,
};

@group(0) @binding(0) var<uniform> u: MainUniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var u_blurredBg: texture_2d<f32>;
@group(0) @binding(3) var u_bg: texture_2d<f32>;
@group(0) @binding(4) var u_uiContent: texture_2d<f32>;
@group(0) @binding(5) var u_textSDF: texture_2d<f32>;

const PI: f32 = 3.14159265359;
const N_R: f32 = 0.98;
const N_G: f32 = 1.0;
const N_B: f32 = 1.02;

// ========== SDF functions ==========

fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn superellipseCornerSDF(p_in: vec2<f32>, r: f32, n: f32) -> f32 {
    let p = abs(p_in);
    let v = pow(pow(p.x, n) + pow(p.y, n), 1.0 / n);
    return v - r;
}

fn roundedRectSDF(p_in: vec2<f32>, center: vec2<f32>, width: f32, height: f32, cornerRadius: f32, n: f32) -> f32 {
    let p = p_in - center;
    let cr = cornerRadius * u.u_dpr;
    let d = abs(p) - vec2<f32>(width * u.u_dpr, height * u.u_dpr) * 0.5;

    var dist: f32;
    if (d.x > -cr && d.y > -cr) {
        let cornerCenter = sign(p) * (vec2<f32>(width * u.u_dpr, height * u.u_dpr) * 0.5 - vec2<f32>(cr));
        let cornerP = p - cornerCenter;
        dist = superellipseCornerSDF(cornerP, cr, n);
    } else {
        dist = min(max(d.x, d.y), 0.0) + length(max(d, vec2<f32>(0.0)));
    }

    return dist;
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

fn sdEllipse(p: vec2<f32>, r: vec2<f32>) -> f32 {
    let k = p / r;
    return (length(k) - 1.0) * min(r.x, r.y);
}

fn sdTriangle(p_in: vec2<f32>, r: f32) -> f32 {
    let k = sqrt(3.0);
    var p = p_in;
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) {
        p = vec2<f32>(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    }
    p.x = p.x - clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
}

fn sdStar(p_in: vec2<f32>, r: f32, rf: f32) -> f32 {
    let k1 = vec2<f32>(0.809016994375, -0.587785252292);
    let k2 = vec2<f32>(-k1.x, k1.y);
    var p = p_in;
    p.x = abs(p.x);
    p = p - 2.0 * max(dot(k1, p), 0.0) * k1;
    p = p - 2.0 * max(dot(k2, p), 0.0) * k2;
    p.x = abs(p.x);
    p.y = p.y - r;
    let ba = rf * vec2<f32>(-k1.y, k1.x) - vec2<f32>(0.0, 1.0);
    let h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
    return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

fn sdHexagon(p_in: vec2<f32>, r: f32) -> f32 {
    let k = vec3<f32>(-0.866025404, 0.5, 0.577350269);
    var p = abs(p_in);
    p = p - 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p = p - vec2<f32>(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
}

fn shapeSDF(pn: vec2<f32>, shapeW: f32, shapeH: f32, shapeR: f32, shapeN: f32, shapeType: i32) -> f32 {
    let rY = u.u_resolution.y;
    if (shapeType == 1) {
        return sdEllipse(pn, vec2<f32>(shapeW * u.u_dpr * 0.5, shapeH * u.u_dpr * 0.5) / rY);
    } else if (shapeType == 2) {
        let s = min(shapeW, shapeH) * u.u_dpr * 0.5 / rY;
        return sdTriangle(pn, s);
    } else if (shapeType == 3) {
        let s = min(shapeW, shapeH) * u.u_dpr * 0.5 / rY;
        return sdStar(pn, s, 0.45);
    } else if (shapeType == 4) {
        let s = min(shapeW, shapeH) * u.u_dpr * 0.5 / rY;
        return sdHexagon(pn, s);
    } else {
        return roundedRectSDF(pn, vec2<f32>(0.0), shapeW / rY, shapeH / rY, shapeR / rY, shapeN);
    }
}

fn mainSDF(p1: vec2<f32>, p2: vec2<f32>, p: vec2<f32>) -> f32 {
    var d: f32;
    if (u.u_shapeCount > 0) {
        var result: f32 = 1.0;
        var hasShape: bool = false;
        for (var i: i32 = 0; i < 8; i = i + 1) {
            if (i >= u.u_shapeCount) { break; }
            let shapeCenter = vec2<f32>(u.u_shapes[i].x, u.u_shapes[i].y);
            let shapeW = u.u_shapes[i].z;
            let shapeH = u.u_shapes[i].w;
            let shapeR = u.u_shapeParams[i].x;
            let shapeN = u.u_shapeParams[i].y;
            let shapeType = i32(u.u_shapeParams[i].z);
            let pn = (-shapeCenter) / u.u_resolution.y + p / u.u_resolution.y;
            let dd = shapeSDF(pn, shapeW, shapeH, shapeR, shapeN, shapeType);
            if (!hasShape) {
                result = dd;
                hasShape = true;
            } else {
                result = smin(result, dd, u.u_mergeRate);
            }
        }
        d = result;
    } else {
        // Legacy follow mode
        let p1n = p1 + p / u.u_resolution.y;
        let p2n = p2 + p / u.u_resolution.y;

        var d1: f32;
        if (u.u_showShape1 == 1) {
            d1 = sdCircle(p1n, 100.0 * u.u_dpr / u.u_resolution.y);
        } else {
            d1 = 1.0;
        }
        let d2 = roundedRectSDF(
            p2n,
            vec2<f32>(0.0),
            u.u_shapeWidth / u.u_resolution.y,
            u.u_shapeHeight / u.u_resolution.y,
            u.u_shapeRadius / u.u_resolution.y,
            u.u_shapeRoundness
        );

        d = smin(d1, d2, u.u_mergeRate);
    }

    if (u.u_textEnabled == 1) {
        var uv = p / u.u_resolution;
        uv.y = 1.0 - uv.y;
        let textSample = textureSample(u_textSDF, texSampler, uv).r;
        let textDist = (textSample - 0.5) * u.u_textScale / u.u_resolution.y;
        d = smin(d, textDist, u.u_mergeRate);
    }

    return d;
}

fn getNormal(p1: vec2<f32>, p2: vec2<f32>, p: vec2<f32>) -> vec2<f32> {
    let h = vec2<f32>(max(abs(dpdx(p.x)), 0.0001), max(abs(dpdy(p.y)), 0.0001));

    let grad = vec2<f32>(
        mainSDF(p1, p2, p + vec2<f32>(h.x, 0.0)) - mainSDF(p1, p2, p - vec2<f32>(h.x, 0.0)),
        mainSDF(p1, p2, p + vec2<f32>(0.0, h.y)) - mainSDF(p1, p2, p - vec2<f32>(0.0, h.y))
    ) / (2.0 * h);

    return grad * 1.414213562 * 1000.0;
}

// ========== Color utility ==========

fn hsv2rgb(c: vec3<f32>) -> vec3<f32> {
    let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(vec3<f32>(c.x) + K.xyz) * 6.0 - vec3<f32>(K.w));
    return c.z * mix(vec3<f32>(K.x), clamp(p - vec3<f32>(K.x), vec3<f32>(0.0), vec3<f32>(1.0)), c.y);
}

fn vec2ToAngle(v: vec2<f32>) -> f32 {
    var angle = atan2(v.y, v.x);
    if (angle < 0.0) { angle = angle + 2.0 * PI; }
    return angle;
}

fn vec2ToRgb(v: vec2<f32>) -> vec3<f32> {
    var angle = atan2(v.y, v.x);
    if (angle < 0.0) { angle = angle + 2.0 * PI; }
    let hue = angle / (2.0 * PI);
    let hsv = vec3<f32>(hue, 1.0, 1.0);
    return hsv2rgb(hsv);
}

// ========== Color-space conversions ==========
// Matrices are transposed from GLSL so we can use M * v (WGSL column-major)

const D65_WHITE: vec3<f32> = vec3<f32>(0.95045592705, 1.0, 1.08905775076);

// GLSL RGB_TO_XYZ_M rows become WGSL columns (transposed)
const RGB_TO_XYZ_M: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>(0.4124, 0.2126, 0.0193),
    vec3<f32>(0.3576, 0.7152, 0.1192),
    vec3<f32>(0.1805, 0.0722, 0.9505)
);

// GLSL XYZ_TO_RGB_M rows become WGSL columns (transposed)
const XYZ_TO_RGB_M: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>( 3.2406255, -0.9689307,  0.0557101),
    vec3<f32>(-1.537208,   1.8757561, -0.2040211),
    vec3<f32>(-0.4986286,  0.0415175,  1.0569959)
);

fn UNCOMPAND_SRGB(a: f32) -> f32 {
    if (a > 0.04045) {
        return pow((a + 0.055) / 1.055, 2.4);
    }
    return a / 12.92;
}

fn COMPAND_RGB(a: f32) -> f32 {
    if (a <= 0.0031308) {
        return 12.92 * a;
    }
    return 1.055 * pow(a, 0.41666666666) - 0.055;
}

fn SRGB_TO_RGB(srgb: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(UNCOMPAND_SRGB(srgb.x), UNCOMPAND_SRGB(srgb.y), UNCOMPAND_SRGB(srgb.z));
}

fn RGB_TO_SRGB(rgb: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(COMPAND_RGB(rgb.x), COMPAND_RGB(rgb.y), COMPAND_RGB(rgb.z));
}

fn RGB_TO_XYZ(rgb: vec3<f32>) -> vec3<f32> {
    // D65 white only (GLSL uses WHITE == D65_WHITE branch)
    return RGB_TO_XYZ_M * rgb;
}

fn XYZ_TO_RGB(xyz: vec3<f32>) -> vec3<f32> {
    return XYZ_TO_RGB_M * xyz;
}

fn SRGB_TO_XYZ(srgb: vec3<f32>) -> vec3<f32> {
    return RGB_TO_XYZ(SRGB_TO_RGB(srgb));
}

fn XYZ_TO_SRGB(xyz: vec3<f32>) -> vec3<f32> {
    return RGB_TO_SRGB(XYZ_TO_RGB(xyz));
}

fn XYZ_TO_LAB_F(x: f32) -> f32 {
    if (x > 0.00885645167) {
        return pow(x, 0.333333333);
    }
    return 7.78703703704 * x + 0.13793103448;
}

fn XYZ_TO_LAB(xyz: vec3<f32>) -> vec3<f32> {
    let xyz_s = xyz / D65_WHITE;
    let xs = vec3<f32>(
        XYZ_TO_LAB_F(xyz_s.x),
        XYZ_TO_LAB_F(xyz_s.y),
        XYZ_TO_LAB_F(xyz_s.z)
    );
    return vec3<f32>(
        116.0 * xs.y - 16.0,
        500.0 * (xs.x - xs.y),
        200.0 * (xs.y - xs.z)
    );
}

fn SRGB_TO_LAB(srgb: vec3<f32>) -> vec3<f32> {
    return XYZ_TO_LAB(SRGB_TO_XYZ(srgb));
}

fn LAB_TO_LCH(Lab: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(Lab.x, sqrt(dot(Lab.yz, Lab.yz)), atan2(Lab.z, Lab.y) * 57.2957795131);
}

fn SRGB_TO_LCH(srgb: vec3<f32>) -> vec3<f32> {
    return LAB_TO_LCH(SRGB_TO_LAB(srgb));
}

fn LAB_TO_XYZ_F(x: f32) -> f32 {
    if (x > 0.206897) {
        return x * x * x;
    }
    return 0.12841854934 * (x - 0.137931034);
}

fn LAB_TO_XYZ(Lab: vec3<f32>) -> vec3<f32> {
    let w = (Lab.x + 16.0) / 116.0;
    return D65_WHITE * vec3<f32>(
        LAB_TO_XYZ_F(w + Lab.y / 500.0),
        LAB_TO_XYZ_F(w),
        LAB_TO_XYZ_F(w - Lab.z / 200.0)
    );
}

fn LAB_TO_SRGB(lab: vec3<f32>) -> vec3<f32> {
    return XYZ_TO_SRGB(LAB_TO_XYZ(lab));
}

fn LCH_TO_LAB(LCh: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(LCh.x, LCh.y * cos(LCh.z * 0.01745329251), LCh.y * sin(LCh.z * 0.01745329251));
}

fn LCH_TO_SRGB(lch: vec3<f32>) -> vec3<f32> {
    return LAB_TO_SRGB(LCH_TO_LAB(lch));
}

// ========== Tone mapping ==========

fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
    let a: f32 = 2.51;
    let b: f32 = 0.03;
    let c: f32 = 2.43;
    let d: f32 = 0.59;
    let e: f32 = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn Reinhard(x: vec3<f32>) -> vec3<f32> {
    return x / (1.0 + x);
}

// ========== Main fragment ==========

@fragment
fn main_frag(@builtin(position) fragCoord: vec4<f32>, @location(0) v_uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Flip Y for WebGPU top-down fragCoord
    let fragXY = vec2<f32>(fragCoord.x, u.u_resolution.y - fragCoord.y);
    let u_resolution1x = u.u_resolution / u.u_dpr;

    // center of shape 1
    let p1 = (vec2<f32>(0.0) - u.u_resolution * 0.5) / u.u_resolution.y;
    // center of shape 2
    let p2 = (vec2<f32>(0.0) - u.u_mouseSpring) / u.u_resolution.y;
    // merged shape
    let merged = mainSDF(p1, p2, fragXY);

    var outColor: vec4<f32>;

    // step 0: sdfs
    if (u.STEP <= 0) {
        let px = 2.0 / u.u_resolution.y;
        var col: vec3<f32>;
        if (merged > 0.0) {
            col = vec3<f32>(1.0) * merged;
        } else {
            col = vec3<f32>(1.0) * -merged * 2.0;
        }
        col = col * 3.0;
        col = mix(
            col,
            vec3<f32>(1.0),
            1.0 - smoothstep(0.5 / u_resolution1x.y - px, 0.5 / u_resolution1x.y + px, abs(merged))
        );
        outColor = vec4<f32>(col, 1.0);

    } else if (u.STEP <= 1) {
        let px = 2.0 / u.u_resolution.y;
        var col: vec3<f32>;
        if (merged > 0.0) {
            col = vec3<f32>(0.9, 0.6, 0.3);
        } else {
            col = vec3<f32>(0.65, 0.85, 1.0);
        }
        col = col * (1.0 - exp(-0.03 * abs(merged) * u_resolution1x.y));
        col = col * (0.6 + 0.4 * smoothstep(-0.5, 0.5, cos(0.25 * abs(merged) * u_resolution1x.y * 2.0)));
        col = mix(
            col,
            vec3<f32>(1.0),
            1.0 - smoothstep(1.5 / u_resolution1x.y - px, 1.5 / u_resolution1x.y + px, abs(merged))
        );
        outColor = vec4<f32>(col, 1.0);

    // step 2: normals
    } else if (u.STEP <= 2) {
        if (merged < 0.0) {
            let normal = getNormal(p1, p2, fragXY);
            let normalColor = vec2ToRgb(normal);
            let l = length(normal);
            outColor = vec4<f32>(normalColor, l);
        } else {
            outColor = vec4<f32>(vec3<f32>(0.8), 0.0);
        }

    // step 3: edge factors
    } else if (u.STEP <= 3) {
        if (merged < 0.0) {
            let nmerged = -1.0 * (merged * u_resolution1x.y);
            let x_R_ratio = 1.0 - nmerged / u.u_refThickness;
            let thetaI = asin(pow(x_R_ratio, 2.0));
            let thetaT = asin(1.0 / u.u_refFactor * sin(thetaI));
            var edgeFactor = -1.0 * tan(thetaT - thetaI);
            if (nmerged >= u.u_refThickness) {
                edgeFactor = 0.0;
            }

            if (nmerged < u.u_refThickness) {
                outColor = vec4<f32>(vec3<f32>(edgeFactor), 1.0);
            } else {
                outColor = vec4<f32>(vec3<f32>(0.0), 1.0);
            }
        } else {
            outColor = vec4<f32>(0.0);
        }

    // step 4: edge factor with normal
    } else if (u.STEP <= 4) {
        if (merged < 0.0) {
            let normal = getNormal(p1, p2, fragXY);
            let normalColor = vec2ToRgb(normal);
            let nmerged = -1.0 * (merged * u_resolution1x.y);

            let x_R_ratio = 1.0 - nmerged / u.u_refThickness;
            let thetaI = asin(pow(x_R_ratio, 2.0));
            let thetaT = asin(1.0 / u.u_refFactor * sin(thetaI));
            var edgeFactor = -1.0 * tan(thetaT - thetaI);
            if (nmerged >= u.u_refThickness) {
                edgeFactor = 0.0;
            }

            outColor = vec4<f32>(normalColor * edgeFactor * u.u_dpr * length(normal), 1.0);
        } else {
            outColor = vec4<f32>(0.0);
        }

    // step 5: add refraction
    } else if (u.STEP <= 5) {
        if (merged < 0.0) {
            outColor = textureSample(u_blurredBg, texSampler, v_uv);
        } else {
            outColor = textureSample(u_bg, texSampler, v_uv);
        }

    // step 6: refraction with normals
    } else if (u.STEP <= 6) {
        if (merged < 0.0) {
            let normal = getNormal(p1, p2, fragXY);
            let nmerged = -1.0 * (merged * u_resolution1x.y);

            let x_R_ratio = 1.0 - nmerged / u.u_refThickness;
            let thetaI = asin(pow(x_R_ratio, 2.0));
            let thetaT = asin(1.0 / u.u_refFactor * sin(thetaI));
            var edgeFactor = -1.0 * tan(thetaT - thetaI);
            if (nmerged >= u.u_refThickness) {
                edgeFactor = 0.0;
            }

            if (edgeFactor <= 0.0) {
                outColor = textureSample(u_blurredBg, texSampler, v_uv);
            } else {
                let blurredPixel = textureSample(
                    u_blurredBg,
                    texSampler,
                    v_uv -
                        normal *
                        edgeFactor *
                        0.05 *
                        u.u_dpr *
                        vec2<f32>(
                            u.u_resolution.y / u_resolution1x.x,
                            1.0
                        )
                );
                outColor = blurredPixel;
            }
        } else {
            outColor = textureSample(u_bg, texSampler, v_uv);
        }

    // step 7: fresnel + glare
    } else if (u.STEP <= 7) {
        if (merged < 0.0) {
            let normal = getNormal(p1, p2, fragXY);
            let nmerged = -1.0 * (merged * u_resolution1x.y);

            let x_R_ratio = 1.0 - nmerged / u.u_refThickness;
            let thetaI = asin(pow(x_R_ratio, 2.0));
            let thetaT = asin(1.0 / u.u_refFactor * sin(thetaI));
            var edgeFactor = -1.0 * tan(thetaT - thetaI);
            if (nmerged >= u.u_refThickness) {
                edgeFactor = 0.0;
            }

            let fresnelFactor = clamp(
                pow(
                    1.0 +
                        merged * u_resolution1x.y / 1500.0 * pow(500.0 / u.u_refFresnelRange, 2.0) +
                        u.u_refFresnelHardness,
                    5.0
                ),
                0.0,
                1.0
            );

            if (edgeFactor <= 0.0) {
                outColor = textureSample(u_blurredBg, texSampler, v_uv);
            } else {
                // Drop LOD bias (u_refDispersion) - not supported in WGSL textureSample
                let blurredPixel = textureSample(
                    u_blurredBg,
                    texSampler,
                    v_uv -
                        normal *
                        edgeFactor *
                        0.05 *
                        u.u_dpr *
                        vec2<f32>(
                            u.u_resolution.y / u_resolution1x.x,
                            1.0
                        )
                );
                outColor = mix(blurredPixel, vec4<f32>(1.0), fresnelFactor * u.u_refFresnelFactor * 0.7);
            }
        } else {
            outColor = textureSample(u_bg, texSampler, v_uv);
        }

    // step 8: full glare
    } else if (u.STEP <= 8) {
        if (merged < 0.0) {
            let nmerged = -1.0 * (merged * u_resolution1x.y);

            let x_R_ratio = 1.0 - nmerged / u.u_refThickness;
            let thetaI = asin(pow(x_R_ratio, 2.0));
            let thetaT = asin(1.0 / u.u_refFactor * sin(thetaI));
            var edgeFactor = -1.0 * tan(thetaT - thetaI);
            if (nmerged >= u.u_refThickness) {
                edgeFactor = 0.0;
            }

            let fresnelFactor = clamp(
                pow(
                    1.0 +
                        merged * u_resolution1x.y / 1500.0 * pow(500.0 / u.u_refFresnelRange, 2.0) +
                        u.u_refFresnelHardness,
                    5.0
                ),
                0.0,
                1.0
            );

            let glareGeoFactor = clamp(
                pow(
                    1.0 +
                        merged * u_resolution1x.y / 1500.0 * pow(500.0 / u.u_glareRange, 2.0) +
                        u.u_glareHardness,
                    5.0
                ),
                0.0,
                1.0
            );

            if (edgeFactor <= 0.0) {
                outColor = textureSample(u_blurredBg, texSampler, v_uv);
            } else {
                let normal = getNormal(p1, p2, fragXY);

                let glareAngle = (vec2ToAngle(normalize(normal)) - PI / 4.0 + u.u_glareAngle) * 2.0;
                var glareFarside: i32 = 0;
                if (
                    (glareAngle > PI * (2.0 - 0.5) && glareAngle < PI * (4.0 - 0.5)) ||
                    glareAngle < PI * (0.0 - 0.5)
                ) {
                    glareFarside = 1;
                }

                var glareAngleFactor: f32;
                if (glareFarside == 1) {
                    glareAngleFactor = (0.5 + sin(glareAngle) * 0.5) * 1.0 * 0.8 * u.u_glareFactor;
                } else {
                    glareAngleFactor = (0.5 + sin(glareAngle) * 0.5) * 1.0 * 1.2 * u.u_glareFactor;
                }
                glareAngleFactor = clamp(pow(glareAngleFactor, 0.3 + u.u_glareConvergence * 1.5), 0.0, 1.0);

                let blurredPixel = textureSample(
                    u_blurredBg,
                    texSampler,
                    v_uv -
                        normal *
                        edgeFactor *
                        0.05 *
                        u.u_dpr *
                        vec2<f32>(
                            u.u_resolution.y / u_resolution1x.x,
                            1.0
                        )
                );
                outColor = blurredPixel;

                var tintLCH = SRGB_TO_LCH(
                    mix(vec3<f32>(1.0), vec3<f32>(u.u_tint.r, u.u_tint.g, u.u_tint.b), u.u_tint.a * 0.5)
                );
                tintLCH.x = tintLCH.x + 20.0 * fresnelFactor * u.u_refFresnelFactor;
                tintLCH.x = clamp(tintLCH.x, 0.0, 100.0);

                outColor = mix(
                    outColor,
                    vec4<f32>(1.0),
                    fresnelFactor * u.u_refFresnelFactor * 0.7
                );

                outColor = mix(
                    outColor,
                    vec4<f32>(1.0),
                    glareAngleFactor * glareGeoFactor
                );
            }
        } else {
            outColor = textureSample(u_bg, texSampler, v_uv);
        }

    // step 9: final production render
    } else if (u.STEP <= 9) {
        if (merged < 0.005) {
            let nmerged = -1.0 * (merged * u_resolution1x.y);

            // calculate refraction edge factor
            let x_R_ratio = 1.0 - nmerged / u.u_refThickness;
            let thetaI = asin(pow(x_R_ratio, 2.0));
            let thetaT = asin(1.0 / u.u_refFactor * sin(thetaI));
            var edgeFactor = -1.0 * tan(thetaT - thetaI);
            if (nmerged >= u.u_refThickness) {
                edgeFactor = 0.0;
            }

            if (edgeFactor <= 0.0) {
                outColor = textureSample(u_blurredBg, texSampler, v_uv);
                outColor = mix(outColor, vec4<f32>(u.u_tint.r, u.u_tint.g, u.u_tint.b, 1.0), u.u_tint.a * 0.8);
            } else {
                // height of glass edge
                let edgeH = nmerged / u.u_refThickness;

                let normal = getNormal(p1, p2, fragXY);

                // Inline getTextureDispersion: sample u_bg and u_blurredBg with per-channel UV offsets
                let offset = -normal *
                    edgeFactor *
                    0.05 *
                    u.u_dpr *
                    vec2<f32>(
                        u.u_resolution.y / (u_resolution1x.x * u.u_dpr),
                        1.0
                    );
                let factor = u.u_refDispersion;
                var mixRate: f32;
                if (u.u_blurEdge > 0) {
                    mixRate = 1.0;
                } else {
                    mixRate = edgeH;
                }

                let bgR = textureSample(u_bg, texSampler, v_uv + offset * (1.0 - (N_R - 1.0) * factor)).r;
                let bgG = textureSample(u_bg, texSampler, v_uv + offset * (1.0 - (N_G - 1.0) * factor)).g;
                let bgB = textureSample(u_bg, texSampler, v_uv + offset * (1.0 - (N_B - 1.0) * factor)).b;

                let blurR = textureSample(u_blurredBg, texSampler, v_uv + offset * (1.0 - (N_R - 1.0) * factor)).r;
                let blurG = textureSample(u_blurredBg, texSampler, v_uv + offset * (1.0 - (N_G - 1.0) * factor)).g;
                let blurB = textureSample(u_blurredBg, texSampler, v_uv + offset * (1.0 - (N_B - 1.0) * factor)).b;

                var blurredPixel: vec4<f32>;
                blurredPixel.r = mix(bgR, blurR, mixRate);
                blurredPixel.g = mix(bgG, blurG, mixRate);
                blurredPixel.b = mix(bgB, blurB, mixRate);
                blurredPixel.a = 1.0;

                // basic tint
                outColor = mix(blurredPixel, vec4<f32>(u.u_tint.r, u.u_tint.g, u.u_tint.b, 1.0), u.u_tint.a * 0.8);

                // add fresnel
                let fresnelFactor = clamp(
                    pow(
                        1.0 +
                            merged * u_resolution1x.y / 1500.0 * pow(500.0 / u.u_refFresnelRange, 2.0) +
                            u.u_refFresnelHardness,
                        5.0
                    ),
                    0.0,
                    1.0
                );

                var fresnelTintLCH = SRGB_TO_LCH(
                    mix(vec3<f32>(1.0), vec3<f32>(u.u_tint.r, u.u_tint.g, u.u_tint.b), u.u_tint.a * 0.5)
                );
                fresnelTintLCH.x = fresnelTintLCH.x + 20.0 * fresnelFactor * u.u_refFresnelFactor;
                fresnelTintLCH.x = clamp(fresnelTintLCH.x, 0.0, 100.0);

                outColor = mix(
                    outColor,
                    vec4<f32>(LCH_TO_SRGB(fresnelTintLCH), 1.0),
                    fresnelFactor * u.u_refFresnelFactor * 0.7 * length(normal)
                );

                // add glare
                let glareGeoFactor = clamp(
                    pow(
                        1.0 +
                            merged * u_resolution1x.y / 1500.0 * pow(500.0 / u.u_glareRange, 2.0) +
                            u.u_glareHardness,
                        5.0
                    ),
                    0.0,
                    1.0
                );

                let glareAngle = (vec2ToAngle(normalize(normal)) - PI / 4.0 + u.u_glareAngle) * 2.0;
                var glareFarside: i32 = 0;
                if (
                    (glareAngle > PI * (2.0 - 0.5) && glareAngle < PI * (4.0 - 0.5)) ||
                    glareAngle < PI * (0.0 - 0.5)
                ) {
                    glareFarside = 1;
                }
                var glareAngleFactor: f32;
                if (glareFarside == 1) {
                    glareAngleFactor = (0.5 + sin(glareAngle) * 0.5) *
                        (1.2 * u.u_glareOppositeFactor) *
                        u.u_glareFactor;
                } else {
                    glareAngleFactor = (0.5 + sin(glareAngle) * 0.5) *
                        1.2 *
                        u.u_glareFactor;
                }
                glareAngleFactor = clamp(pow(glareAngleFactor, 0.1 + u.u_glareConvergence * 2.0), 0.0, 1.0);

                var glareTintLCH = SRGB_TO_LCH(
                    mix(blurredPixel.rgb, vec3<f32>(u.u_tint.r, u.u_tint.g, u.u_tint.b), u.u_tint.a * 0.5)
                );
                glareTintLCH.x = glareTintLCH.x + 150.0 * glareAngleFactor * glareGeoFactor;
                glareTintLCH.y = glareTintLCH.y + 30.0 * glareAngleFactor * glareGeoFactor;
                glareTintLCH.x = clamp(glareTintLCH.x, 0.0, 120.0);

                outColor = mix(
                    outColor,
                    vec4<f32>(LCH_TO_SRGB(glareTintLCH), 1.0),
                    glareAngleFactor * glareGeoFactor * length(normal)
                );
            }
        } else {
            outColor = textureSample(u_bg, texSampler, v_uv);
        }

        // UI content compositing
        if (u.u_uiContentEnabled == 1 && merged < 0.0) {
            let nmerged_ui = -1.0 * (merged * u_resolution1x.y);
            let x_R_ratio_ui = 1.0 - nmerged_ui / u.u_refThickness;
            let thetaI_ui = asin(pow(clamp(x_R_ratio_ui, 0.0, 1.0), 2.0));
            let thetaT_ui = asin(1.0 / u.u_refFactor * sin(thetaI_ui));
            var edgeFactor_ui = -1.0 * tan(thetaT_ui - thetaI_ui);
            if (nmerged_ui >= u.u_refThickness) {
                edgeFactor_ui = 0.0;
            }
            let normal_ui = getNormal(p1, p2, fragXY);
            var refractedUV = v_uv;
            if (edgeFactor_ui > 0.0) {
                refractedUV = v_uv - normal_ui * edgeFactor_ui * 0.05 * u.u_dpr *
                    vec2<f32>(u.u_resolution.y / (u_resolution1x.x * u.u_dpr), 1.0);
            }
            let uiColor = textureSample(u_uiContent, texSampler, refractedUV);
            outColor = vec4<f32>(mix(outColor.rgb, uiColor.rgb, uiColor.a * u.u_uiContentOpacity), outColor.a);
        }

        // Self-illumination (emissive glow)
        if (merged < 0.0 && u.u_emissiveIntensity > 0.0) {
            let nmerged_em = -1.0 * (merged * u_resolution1x.y);
            let emissiveDepth = clamp(nmerged_em / u.u_refThickness, 0.0, 1.0);
            let emissiveFactor = smoothstep(0.0, 0.5, emissiveDepth);
            let pulseMultiplier = 1.0 + u.u_emissivePulse * 0.3;
            let emissive = u.u_emissiveColor * u.u_emissiveIntensity * emissiveFactor * pulseMultiplier;
            outColor = vec4<f32>(outColor.rgb + emissive, outColor.a);
        }

        // smooth edge
        outColor = mix(outColor, textureSample(u_bg, texSampler, v_uv), smoothstep(-0.001, 0.001, merged));
    }

    // HDR tone mapping (applied to all steps)
    if (u.u_hdrEnabled == 1) {
        outColor = vec4<f32>(outColor.rgb * u.u_exposure, outColor.a);

        // Bloom: extract bright areas and add soft glow
        if (u.u_bloom > 0.0) {
            let bright = max(outColor.rgb - vec3<f32>(1.0), vec3<f32>(0.0));
            outColor = vec4<f32>(outColor.rgb + bright * u.u_bloom, outColor.a);
        }

        if (u.u_toneMappingType == 1) {
            outColor = vec4<f32>(Reinhard(outColor.rgb), outColor.a);
        } else if (u.u_toneMappingType == 2) {
            outColor = vec4<f32>(ACESFilm(outColor.rgb), outColor.a);
        }
        outColor = vec4<f32>(pow(outColor.rgb, vec3<f32>(1.0 / 2.2)), outColor.a);
    }

    return outColor;
}

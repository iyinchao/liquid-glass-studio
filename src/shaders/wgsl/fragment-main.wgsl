// Simplified main fragment shader for WebGPU path.
// This is a foundational port — the full glass rendering pipeline
// (Fresnel, glare, color-space conversions) is in the GLSL version.
// This WGSL version handles basic refraction + tint for demonstration.

struct Uniforms {
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
    u_showShape1: i32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var u_blurredBg: texture_2d<f32>;

const PI: f32 = 3.14159265359;

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

fn mainSDF(p1: vec2<f32>, p2: vec2<f32>, p: vec2<f32>) -> f32 {
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

    return smin(d1, d2, u.u_mergeRate);
}

@fragment
fn main_frag(@builtin(position) fragCoord: vec4<f32>, @location(0) v_uv: vec2<f32>) -> @location(0) vec4<f32> {
    let fragXY = vec2<f32>(fragCoord.x, u.u_resolution.y - fragCoord.y);
    let u_resolution1x = u.u_resolution / u.u_dpr;

    let p1 = (vec2<f32>(0.0) - u.u_resolution * 0.5) / u.u_resolution.y;
    let p2 = (vec2<f32>(0.0) - u.u_mouseSpring) / u.u_resolution.y;

    let merged = mainSDF(p1, p2, fragXY);

    var outColor = textureSample(u_blurredBg, texSampler, v_uv);

    if (merged < 0.005) {
        let nmerged = -1.0 * (merged * u_resolution1x.y);

        // Simple refraction
        let x_R_ratio = 1.0 - nmerged / u.u_refThickness;
        let thetaI = asin(pow(clamp(x_R_ratio, 0.0, 1.0), 2.0));
        let thetaT = asin(1.0 / u.u_refFactor * sin(thetaI));
        var edgeFactor = -1.0 * tan(thetaT - thetaI);

        if (nmerged >= u.u_refThickness) {
            edgeFactor = 0.0;
        }

        if (edgeFactor > 0.0) {
            // Basic refraction offset
            let blurredPixel = textureSample(u_blurredBg, texSampler, v_uv);
            outColor = mix(blurredPixel, vec4<f32>(u.u_tint.r, u.u_tint.g, u.u_tint.b, 1.0), u.u_tint.a * 0.8);
        } else {
            outColor = textureSample(u_blurredBg, texSampler, v_uv);
            outColor = mix(outColor, vec4<f32>(u.u_tint.r, u.u_tint.g, u.u_tint.b, 1.0), u.u_tint.a * 0.8);
        }
    }

    // Smooth edge
    outColor = mix(outColor, textureSample(u_blurredBg, texSampler, v_uv), smoothstep(-0.001, 0.001, merged));

    return outColor;
}

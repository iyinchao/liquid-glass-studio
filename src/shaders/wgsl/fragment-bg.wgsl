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
    u_shadowExpand: f32,
    u_shadowFactor: f32,
    u_shadowPosition: vec2<f32>,
    u_bgType: i32,
    u_bgTextureReady: i32,
    u_bgTextureRatio: f32,
    u_showShape1: i32,
    u_time: f32,
    u_textEnabled: i32,
    u_textScale: f32,
    u_shapeCount: i32,
    _pad1: i32,
    u_shapes: array<vec4<f32>, 8>,
    u_shapeParams: array<vec4<f32>, 8>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var u_bgTexture: texture_2d<f32>;
@group(0) @binding(3) var u_textSDF: texture_2d<f32>;

fn chessboard(uv: vec2<f32>, size: f32, mode: i32) -> f32 {
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

fn halfColor(uv: vec2<f32>) -> f32 {
    if (uv.y > 0.5) {
        return 1.0;
    } else {
        return 0.0;
    }
}

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
        var result = 1.0;
        var hasShape = false;
        for (var i = 0; i < 8; i++) {
            if (i >= u.u_shapeCount) {
                break;
            }
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
        var uv = p / u.u_resolution.xy;
        uv.y = 1.0 - uv.y;
        let textSample = textureSample(u_textSDF, texSampler, uv).r;
        let textDist = (textSample - 0.5) * u.u_textScale / u.u_resolution.y;
        d = smin(d, textDist, u.u_mergeRate);
    }

    return d;
}

fn getCoverUV(uv_in: vec2<f32>, canvasAspect: f32, textureAspect: f32) -> vec2<f32> {
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
fn main_frag(@builtin(position) fragCoord: vec4<f32>, @location(0) v_uv: vec2<f32>) -> @location(0) vec4<f32> {
    let u_resolution1x = u.u_resolution.xy / u.u_dpr;
    var bgColor = vec3<f32>(1.0);

    // Note: In WebGPU, fragCoord.y is top-down. We flip for consistency with GL.
    let fragXY = vec2<f32>(fragCoord.x, u.u_resolution.y - fragCoord.y);

    if (u.u_bgType <= 0) {
        bgColor = vec3<f32>(1.0 - chessboard(fragXY / u.u_dpr, 20.0, 2) / 4.0);
    } else if (u.u_bgType <= 1) {
        if (v_uv.x < 0.5 && v_uv.y > 0.5) {
            bgColor = vec3<f32>(chessboard(fragXY / u.u_dpr, 10.0, 0));
        } else if (v_uv.x > 0.5 && v_uv.y < 0.5) {
            bgColor = vec3<f32>(chessboard(fragXY / u.u_dpr, 10.0, 1));
        } else if (v_uv.x < 0.5 && v_uv.y < 0.5) {
            bgColor = vec3<f32>(0.0);
        }
    } else if (u.u_bgType <= 2) {
        bgColor = vec3<f32>(halfColor(fragXY / u.u_resolution) * 0.6 + 0.3);
    } else if (u.u_bgType <= 11) {
        if (u.u_bgTextureReady != 1) {
            bgColor = vec3<f32>(1.0 - chessboard(fragXY / u.u_dpr, 20.0, 2) / 4.0);
        } else {
            let uv = getCoverUV(v_uv, u.u_resolution.x / u.u_resolution.y, u.u_bgTextureRatio);
            bgColor = textureSample(u_bgTexture, texSampler, uv).rgb;
        }
    }

    // draw shadow
    let p1 = (vec2<f32>(0.0) - u.u_resolution.xy * 0.5 + vec2<f32>(u.u_shadowPosition.x * u.u_dpr, u.u_shadowPosition.y * u.u_dpr)) / u.u_resolution.y;
    let p2 = (vec2<f32>(0.0) - u.u_mouseSpring + vec2<f32>(u.u_shadowPosition.x * u.u_dpr, u.u_shadowPosition.y * u.u_dpr)) / u.u_resolution.y;
    let merged = mainSDF(p1, p2, fragXY);

    let shadow = exp(-1.0 / u.u_shadowExpand * abs(merged) * u_resolution1x.y) * 0.6 * u.u_shadowFactor;

    return vec4<f32>(bgColor - vec3<f32>(shadow), 1.0);
}

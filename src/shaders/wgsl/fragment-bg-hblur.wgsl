// Horizontal blur pass
const MAX_BLUR_RADIUS: i32 = 200;

struct BlurUniforms {
    u_resolution: vec2<f32>,
    u_blurRadius: i32,
    _pad0: i32,
    u_blurWeights: array<vec4<f32>, 51>, // 201 floats packed into vec4s (ceil(201/4) = 51)
};

@group(0) @binding(0) var<uniform> u: BlurUniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var u_prevPassTexture: texture_2d<f32>;

fn getWeight(index: i32) -> f32 {
    let vec_index = index / 4;
    let component = index % 4;
    let v = u.u_blurWeights[vec_index];
    switch (component) {
        case 0: { return v.x; }
        case 1: { return v.y; }
        case 2: { return v.z; }
        default: { return v.w; }
    }
}

@fragment
fn main_frag(@builtin(position) fragCoord: vec4<f32>, @location(0) v_uv: vec2<f32>) -> @location(0) vec4<f32> {
    let texelSize = 1.0 / u.u_resolution;
    var color = textureSample(u_prevPassTexture, texSampler, v_uv) * getWeight(0);

    for (var i: i32 = 1; i <= min(u.u_blurRadius, MAX_BLUR_RADIUS); i = i + 1) {
        let w = getWeight(i);
        let offset = vec2<f32>(f32(i)) * texelSize;
        color = color + textureSample(u_prevPassTexture, texSampler, v_uv + vec2<f32>(offset.x, 0.0)) * w;
        color = color + textureSample(u_prevPassTexture, texSampler, v_uv - vec2<f32>(offset.x, 0.0)) * w;
    }

    return color;
}

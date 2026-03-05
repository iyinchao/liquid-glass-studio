struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn main(@location(0) a_position: vec2<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.uv = (a_position + 1.0) * 0.5;
    output.position = vec4<f32>(a_position, 0.0, 1.0);
    return output;
}

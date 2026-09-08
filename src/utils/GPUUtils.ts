/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IMultiPassRenderer, RenderPassConfig } from './RendererInterface';

// ---- GPU Framebuffer ----

class GPUFrameBuffer {
  private device: GPUDevice;
  private _colorTexture: GPUTexture;
  private _colorView: GPUTextureView;
  private _depthTexture: GPUTexture;
  private _depthView: GPUTextureView;
  private width: number;
  private height: number;

  constructor(device: GPUDevice, width: number, height: number) {
    this.device = device;
    this.width = width;
    this.height = height;
    const { color, depth } = this.createTextures();
    this._colorTexture = color;
    this._colorView = color.createView();
    this._depthTexture = depth;
    this._depthView = depth.createView();
  }

  private createTextures() {
    const color = this.device.createTexture({
      size: [this.width, this.height],
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const depth = this.device.createTexture({
      size: [this.width, this.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return { color, depth };
  }

  get colorTexture(): GPUTexture { return this._colorTexture; }
  get colorView(): GPUTextureView { return this._colorView; }
  get depthView(): GPUTextureView { return this._depthView; }

  resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    this._colorTexture.destroy();
    this._depthTexture.destroy();
    this.width = width;
    this.height = height;
    const { color, depth } = this.createTextures();
    this._colorTexture = color;
    this._colorView = color.createView();
    this._depthTexture = depth;
    this._depthView = depth.createView();
  }

  dispose(): void {
    this._colorTexture.destroy();
    this._depthTexture.destroy();
  }
}

// ---- Render Pass Types ----

/** Pass type determines which bind group layout to use */
type PassType = 'bg' | 'blur' | 'main';

function detectPassType(config: RenderPassConfig): PassType {
  if (config.name === 'bgPass') return 'bg';
  if (config.name === 'vBlurPass' || config.name === 'hBlurPass') return 'blur';
  return 'main';
}

// ---- GPU Render Pass ----

class GPURenderPassObj {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private vertexBuffer: GPUBuffer;
  private frameBuffer: GPUFrameBuffer | null;
  private passType: PassType;
  public config: RenderPassConfig;

  // Bind group layout for dynamic recreation
  private bindGroupLayout: GPUBindGroupLayout;

  constructor(
    device: GPUDevice,
    config: RenderPassConfig,
    canvasFormat: GPUTextureFormat,
    width: number,
    height: number,
  ) {
    this.device = device;
    this.config = config;
    this.passType = detectPassType(config);

    // Create vertex buffer (fullscreen quad)
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    // Create bind group layout based on pass type
    this.bindGroupLayout = this.createBindGroupLayout();

    // Create shader module (combined vertex + fragment)
    const shaderModule = device.createShaderModule({
      code: config.shader.vertex + '\n' + config.shader.fragment,
    });

    const outputFormat = config.outputToScreen ? canvasFormat : 'rgba16float' as GPUTextureFormat;

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 2 * 4, // 2 floats * 4 bytes
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
        }],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: outputFormat }],
      },
      primitive: { topology: 'triangle-strip' },
    });

    this.frameBuffer = config.outputToScreen
      ? null
      : new GPUFrameBuffer(device, width, height);
  }

  private createBindGroupLayout(): GPUBindGroupLayout {
    if (this.passType === 'blur') {
      return this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        ],
      });
    } else if (this.passType === 'main') {
      return this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        ],
      });
    } else {
      // bg pass
      return this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        ],
      });
    }
  }

  render(
    encoder: GPUCommandEncoder,
    targetView: GPUTextureView | null,
    bindGroup: GPUBindGroup,
  ): void {
    const view = this.frameBuffer ? this.frameBuffer.colorView : targetView!;

    const passDesc: GPURenderPassDescriptor = {
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    };

    const pass = encoder.beginRenderPass(passDesc);
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.draw(4);
    pass.end();
  }

  getOutputTexture(): GPUTexture | null {
    return this.frameBuffer ? this.frameBuffer.colorTexture : null;
  }

  getBindGroupLayout(): GPUBindGroupLayout {
    return this.bindGroupLayout;
  }

  getPassType(): PassType {
    return this.passType;
  }

  resize(width: number, height: number): void {
    this.frameBuffer?.resize(width, height);
  }

  dispose(): void {
    this.frameBuffer?.dispose();
    this.vertexBuffer.destroy();
  }
}

// ---- Multi-Pass Renderer ----

export class GPUMultiPassRenderer implements IMultiPassRenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private canvasFormat: GPUTextureFormat;
  private passes: Map<string, GPURenderPassObj> = new Map();
  private passesArray: GPURenderPassObj[] = [];
  private globalUniforms: Record<string, any> = {};
  private sampler: GPUSampler;

  // Shared uniform buffer (re-created each frame)
  private uniformBuffer: GPUBuffer | null = null;
  // Blur weights storage buffer
  private blurWeightsBuffer: GPUBuffer | null = null;
  // Placeholder 1x1 white texture for when no bg texture is available
  private placeholderTexture: GPUTexture;

  constructor(
    canvas: HTMLCanvasElement,
    configs: RenderPassConfig[],
    device: GPUDevice,
  ) {
    this.device = device;
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('WebGPU context not available');
    this.context = context;

    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format: this.canvasFormat,
      alphaMode: 'opaque',
    });

    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // Placeholder 1x1 white texture
    this.placeholderTexture = device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
      { texture: this.placeholderTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1],
    );

    for (const cfg of configs) {
      const pass = new GPURenderPassObj(device, cfg, this.canvasFormat, canvas.width, canvas.height);
      this.passes.set(cfg.name, pass);
      this.passesArray.push(pass);
    }
  }

  resize(width: number, height: number): void {
    for (const pass of this.passesArray) {
      pass.resize(width, height);
    }
  }

  setUniform(name: string, value: any): void {
    this.globalUniforms[name] = value;
  }

  setUniforms(uniforms: Record<string, any>): void {
    Object.assign(this.globalUniforms, uniforms);
  }

  clearUniform(name: string): void {
    delete this.globalUniforms[name];
  }

  clearAllUniforms(): void {
    this.globalUniforms = {};
  }

  render(passUniforms?: Record<string, any>[] | Record<string, Record<string, any>>): void {
    const encoder = this.device.createCommandEncoder();
    const targetView = this.context.getCurrentTexture().createView();

    for (let i = 0; i < this.passesArray.length; i++) {
      const pass = this.passesArray[i];
      const config = pass.config;

      // Merge global + per-pass uniforms
      const uniforms: Record<string, any> = { ...this.globalUniforms };
      if (passUniforms) {
        if (Array.isArray(passUniforms)) {
          Object.assign(uniforms, passUniforms[i]);
        } else {
          Object.assign(uniforms, passUniforms[config.name] ?? null);
        }
      }

      // Resolve input textures from previous passes
      const inputTextures: Record<string, GPUTexture> = {};
      if (config.inputs) {
        for (const [uniformName, fromPassName] of Object.entries(config.inputs)) {
          const fromPass = this.passes.get(fromPassName);
          const tex = fromPass?.getOutputTexture();
          if (tex) {
            inputTextures[uniformName] = tex;
          }
        }
      }

      // Build bind group for this pass
      const bindGroup = this.buildBindGroup(pass, uniforms, inputTextures);

      pass.render(
        encoder,
        config.outputToScreen ? targetView : null,
        bindGroup,
      );
    }

    this.device.queue.submit([encoder.finish()]);
  }

  private buildBindGroup(
    pass: GPURenderPassObj,
    uniforms: Record<string, any>,
    inputTextures: Record<string, GPUTexture>,
  ): GPUBindGroup {
    const passType = pass.getPassType();

    if (passType === 'blur') {
      return this.buildBlurBindGroup(pass, uniforms, inputTextures);
    } else if (passType === 'main') {
      return this.buildMainBindGroup(pass, uniforms, inputTextures);
    } else {
      return this.buildBgBindGroup(pass, uniforms);
    }
  }

  private buildBgBindGroup(pass: GPURenderPassObj, uniforms: Record<string, any>): GPUBindGroup {
    const uniformBuffer = this.createMainUniformBuffer(uniforms);
    const bgTexture = (uniforms.u_bgTexture as GPUTexture) ?? this.placeholderTexture;

    return this.device.createBindGroup({
      layout: pass.getBindGroupLayout(),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: bgTexture.createView() },
        { binding: 2, resource: this.sampler },
      ],
    });
  }

  private buildBlurBindGroup(
    pass: GPURenderPassObj,
    uniforms: Record<string, any>,
    inputTextures: Record<string, GPUTexture>,
  ): GPUBindGroup {
    // Blur uniform buffer: resolution(vec2f) + blurRadius(i32) + pad(i32) = 16 bytes
    const data = new ArrayBuffer(16);
    const f32 = new Float32Array(data);
    const i32 = new Int32Array(data);
    f32[0] = uniforms.u_resolution?.[0] ?? 0;
    f32[1] = uniforms.u_resolution?.[1] ?? 0;
    i32[2] = uniforms.u_blurRadius ?? 1;
    i32[3] = 0; // pad

    const uniformBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, data);

    // Blur weights storage buffer
    const weights: number[] = uniforms.u_blurWeights ?? [1.0];
    const weightsData = new Float32Array(Math.max(weights.length, 4)); // minimum 16 bytes
    weightsData.set(weights);
    const weightsBuffer = this.device.createBuffer({
      size: weightsData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(weightsBuffer, 0, weightsData);

    // Input texture
    const inputTex = inputTextures.u_prevPassTexture ?? this.placeholderTexture;

    return this.device.createBindGroup({
      layout: pass.getBindGroupLayout(),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: inputTex.createView() },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: { buffer: weightsBuffer } },
      ],
    });
  }

  private buildMainBindGroup(
    pass: GPURenderPassObj,
    uniforms: Record<string, any>,
    inputTextures: Record<string, GPUTexture>,
  ): GPUBindGroup {
    const uniformBuffer = this.createMainUniformBuffer(uniforms);
    const blurredBg = inputTextures.u_blurredBg ?? this.placeholderTexture;
    const bg = inputTextures.u_bg ?? this.placeholderTexture;

    return this.device.createBindGroup({
      layout: pass.getBindGroupLayout(),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: blurredBg.createView() },
        { binding: 2, resource: bg.createView() },
        { binding: 3, resource: this.sampler },
      ],
    });
  }

  /**
   * Creates the main uniform buffer matching the Uniforms struct layout in WGSL.
   * Layout (std140-like alignment):
   *
   * offset  field                    type     size
   * 0       u_resolution             vec2f    8
   * 8       u_dpr                    f32      4
   * 12      _pad0                    f32      4
   * 16      u_mouse                  vec2f    8
   * 24      u_mouseSpring            vec2f    8
   * 32      u_shapeWidth             f32      4
   * 36      u_shapeHeight            f32      4
   * 40      u_shapeRadius            f32      4
   * 44      u_shapeRoundness         f32      4
   * 48      u_mergeRate              f32      4
   * 52      u_glareAngle             f32      4
   * 56      u_shadowExpand           f32      4
   * 60      u_shadowFactor           f32      4
   * 64      u_shadowPosition         vec2f    8
   * 72      u_bgTextureRatio         f32      4
   * 76      u_bgType                 i32      4
   * 80      u_bgTextureReady         i32      4
   * 84      u_showShape1             i32      4
   * 88      u_blurRadius             i32      4
   * 92      u_blurEdge               i32      4
   * 96      u_tint                   vec4f    16
   * 112     u_refThickness           f32      4
   * 116     u_refFactor              f32      4
   * 120     u_refDispersion          f32      4
   * 124     u_refFresnelRange        f32      4
   * 128     u_refFresnelHardness     f32      4
   * 132     u_refFresnelFactor       f32      4
   * 136     u_glareRange             f32      4
   * 140     u_glareHardness          f32      4
   * 144     u_glareConvergence       f32      4
   * 148     u_glareOppositeFactor    f32      4
   * 152     u_glareFactor            f32      4
   * 156     u_refDistance            f32      4   (reuses former _pad1 slot)
   * Total: 160 bytes
   */
  private createMainUniformBuffer(uniforms: Record<string, any>): GPUBuffer {
    const BUFFER_SIZE = 160;
    const data = new ArrayBuffer(BUFFER_SIZE);
    const f32 = new Float32Array(data);
    const i32 = new Int32Array(data);

    // u_resolution (offset 0)
    const res = uniforms.u_resolution ?? [0, 0];
    f32[0] = res[0]; f32[1] = res[1];
    // u_dpr (offset 8)
    f32[2] = uniforms.u_dpr ?? 1;
    // _pad0 (offset 12)
    f32[3] = 0;
    // u_mouse (offset 16)
    const mouse = uniforms.u_mouse ?? [0, 0];
    f32[4] = mouse[0]; f32[5] = mouse[1];
    // u_mouseSpring (offset 24)
    const ms = uniforms.u_mouseSpring ?? [0, 0];
    f32[6] = ms[0]; f32[7] = ms[1];
    // u_shapeWidth (offset 32)
    f32[8] = uniforms.u_shapeWidth ?? 200;
    // u_shapeHeight (offset 36)
    f32[9] = uniforms.u_shapeHeight ?? 200;
    // u_shapeRadius (offset 40)
    f32[10] = uniforms.u_shapeRadius ?? 80;
    // u_shapeRoundness (offset 44)
    f32[11] = uniforms.u_shapeRoundness ?? 5;
    // u_mergeRate (offset 48)
    f32[12] = uniforms.u_mergeRate ?? 0.05;
    // u_glareAngle (offset 52)
    f32[13] = uniforms.u_glareAngle ?? 0;
    // u_shadowExpand (offset 56)
    f32[14] = uniforms.u_shadowExpand ?? 25;
    // u_shadowFactor (offset 60)
    f32[15] = uniforms.u_shadowFactor ?? 0.15;
    // u_shadowPosition (offset 64)
    const sp = uniforms.u_shadowPosition ?? [0, 0];
    f32[16] = sp[0]; f32[17] = sp[1];
    // u_bgTextureRatio (offset 72)
    f32[18] = uniforms.u_bgTextureRatio ?? 1;
    // u_bgType (offset 76)
    i32[19] = uniforms.u_bgType ?? 0;
    // u_bgTextureReady (offset 80)
    i32[20] = uniforms.u_bgTextureReady ?? 0;
    // u_showShape1 (offset 84)
    i32[21] = uniforms.u_showShape1 ?? 1;
    // u_blurRadius (offset 88)
    i32[22] = uniforms.u_blurRadius ?? 1;
    // u_blurEdge (offset 92)
    i32[23] = uniforms.u_blurEdge ?? 1;
    // u_tint (offset 96, vec4f aligned to 16 bytes)
    const tint = uniforms.u_tint ?? [1, 1, 1, 0];
    f32[24] = tint[0]; f32[25] = tint[1]; f32[26] = tint[2]; f32[27] = tint[3];
    // u_refThickness (offset 112)
    f32[28] = uniforms.u_refThickness ?? 20;
    // u_refFactor (offset 116)
    f32[29] = uniforms.u_refFactor ?? 1.4;
    // u_refDispersion (offset 120)
    f32[30] = uniforms.u_refDispersion ?? 7;
    // u_refFresnelRange (offset 124)
    f32[31] = uniforms.u_refFresnelRange ?? 30;
    // u_refFresnelHardness (offset 128)
    f32[32] = uniforms.u_refFresnelHardness ?? 0.2;
    // u_refFresnelFactor (offset 132)
    f32[33] = uniforms.u_refFresnelFactor ?? 0.2;
    // u_glareRange (offset 136)
    f32[34] = uniforms.u_glareRange ?? 30;
    // u_glareHardness (offset 140)
    f32[35] = uniforms.u_glareHardness ?? 0.2;
    // u_glareConvergence (offset 144)
    f32[36] = uniforms.u_glareConvergence ?? 0.5;
    // u_glareOppositeFactor (offset 148)
    f32[37] = uniforms.u_glareOppositeFactor ?? 0.8;
    // u_glareFactor (offset 152)
    f32[38] = uniforms.u_glareFactor ?? 0.9;
    // u_refDistance (offset 156, reuses former _pad1 slot — keeps buffer at 160 bytes)
    f32[39] = uniforms.u_refDistance ?? 0.05;

    const buffer = this.device.createBuffer({
      size: BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  dispose(): void {
    for (const pass of this.passesArray) {
      pass.dispose();
    }
    this.passes.clear();
    this.passesArray = [];
    this.uniformBuffer?.destroy();
    this.blurWeightsBuffer?.destroy();
    this.placeholderTexture.destroy();
    this.globalUniforms = {};
  }
}

// ---- Texture Utilities ----

export async function gpuLoadTextureFromURL(
  device: GPUDevice,
  url: string,
): Promise<{ texture: GPUTexture; ratio: number }> {
  // Load via Image element first — this handles SVG and all browser-supported
  // image formats, matching WebGL's loadTextureFromURL behavior.
  const img = new Image();
  img.crossOrigin = '';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  const bitmap = await createImageBitmap(img);
  const w = bitmap.width;
  const h = bitmap.height;

  const texture = device.createTexture({
    size: [w, h],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: bitmap, flipY: false },
    { texture },
    [w, h],
  );

  bitmap.close();

  return { texture, ratio: w / h };
}

export function gpuCreateEmptyTexture(device: GPUDevice, width = 1, height = 1): GPUTexture {
  return device.createTexture({
    size: [width, height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

export async function gpuUpdateVideoTexture(
  device: GPUDevice,
  texture: GPUTexture,
  video: HTMLVideoElement,
): Promise<{ ratio: number; texture: GPUTexture } | undefined> {
  if (video.readyState < video.HAVE_CURRENT_DATA) return;

  let ratio = video.videoWidth / video.videoHeight;
  if (isNaN(ratio)) ratio = 1;

  // Recreate texture if video size changed
  let oldTexture: GPUTexture | null = null;
  if (texture.width !== video.videoWidth || texture.height !== video.videoHeight) {
    oldTexture = texture;
    texture = device.createTexture({
      size: [video.videoWidth, video.videoHeight],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  // Use createImageBitmap to ensure consistent sRGB color handling (same as image path)
  const bitmap = await createImageBitmap(video);
  device.queue.copyExternalImageToTexture(
    { source: bitmap, flipY: false },
    { texture },
    [bitmap.width, bitmap.height],
  );
  bitmap.close();

  // Destroy old texture after the new one is ready and written to
  if (oldTexture) {
    oldTexture.destroy();
  }

  return { ratio, texture };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * WebGPU-based multi-pass renderer.
 * Full implementation mirroring the MultiPassRenderer API from GLUtils.ts
 * so the application can switch between WebGL2 and WebGPU backends.
 */

import {
  createPlaceholderTexture,
  loadWebGPUTexture,
  createWebGPUHDRTexture,
  updateWebGPUVideoTexture,
  uploadWebGPUCanvasTexture,
  uploadWebGPUTextSDFTexture,
} from './WebGPUTextureUtils';

// ─── Uniform Buffer Layout ──────────────────────────────────────────────────

type FieldType = 'f32' | 'i32' | 'vec2f' | 'vec3f' | 'vec4f' | 'array_vec4f';

interface FieldDef {
  name: string;
  type: FieldType;
  count?: number; // for array_vec4f
}

/**
 * Computes byte offsets respecting WGSL/std140 alignment rules.
 * Provides set(name, value) to write into a CPU-side ArrayBuffer.
 */
class UniformBufferLayout {
  private fields: FieldDef[];
  private offsets: Map<string, { byte: number; type: FieldType; count?: number }> = new Map();
  private _size: number;
  private buffer: ArrayBuffer;
  private f32View: Float32Array;
  private i32View: Int32Array;

  constructor(fields: FieldDef[]) {
    this.fields = fields;
    this._size = this.computeLayout();
    this.buffer = new ArrayBuffer(this._size);
    this.f32View = new Float32Array(this.buffer);
    this.i32View = new Int32Array(this.buffer);
  }

  private align(offset: number, alignment: number): number {
    return Math.ceil(offset / alignment) * alignment;
  }

  private computeLayout(): number {
    let offset = 0;
    for (const field of this.fields) {
      let alignment: number;
      let size: number;

      switch (field.type) {
        case 'f32':
        case 'i32':
          alignment = 4;
          size = 4;
          break;
        case 'vec2f':
          alignment = 8;
          size = 8;
          break;
        case 'vec3f':
          // vec3 has 16-byte alignment in std140/WGSL
          alignment = 16;
          size = 12;
          break;
        case 'vec4f':
          alignment = 16;
          size = 16;
          break;
        case 'array_vec4f':
          alignment = 16;
          size = 16 * (field.count ?? 1);
          break;
        default:
          alignment = 4;
          size = 4;
      }

      offset = this.align(offset, alignment);
      this.offsets.set(field.name, { byte: offset, type: field.type, count: field.count });
      offset += size;
    }

    // Round up to 16-byte boundary (uniform buffer size must be multiple of 16)
    return this.align(offset, 16);
  }

  get size(): number {
    return this._size;
  }

  set(name: string, value: any): void {
    const info = this.offsets.get(name);
    if (!info) return;

    const byteOffset = info.byte;
    const f32Offset = byteOffset / 4;

    switch (info.type) {
      case 'f32':
        this.f32View[f32Offset] = value as number;
        break;
      case 'i32':
        this.i32View[f32Offset] = value as number;
        break;
      case 'vec2f':
        if (Array.isArray(value)) {
          this.f32View[f32Offset] = value[0];
          this.f32View[f32Offset + 1] = value[1];
        }
        break;
      case 'vec3f':
        if (Array.isArray(value)) {
          this.f32View[f32Offset] = value[0];
          this.f32View[f32Offset + 1] = value[1];
          this.f32View[f32Offset + 2] = value[2];
        }
        break;
      case 'vec4f':
        if (Array.isArray(value)) {
          this.f32View[f32Offset] = value[0];
          this.f32View[f32Offset + 1] = value[1];
          this.f32View[f32Offset + 2] = value[2];
          this.f32View[f32Offset + 3] = value[3] ?? 0;
        }
        break;
      case 'array_vec4f': {
        const arr = value as number[];
        const count = info.count ?? 1;
        // Pack flat array into vec4 slots (16 bytes each)
        for (let i = 0; i < count; i++) {
          const base = f32Offset + i * 4;
          this.f32View[base] = arr[i * 4] ?? 0;
          this.f32View[base + 1] = arr[i * 4 + 1] ?? 0;
          this.f32View[base + 2] = arr[i * 4 + 2] ?? 0;
          this.f32View[base + 3] = arr[i * 4 + 3] ?? 0;
        }
        break;
      }
    }
  }

  getBuffer(): ArrayBuffer {
    return this.buffer;
  }
}

// ─── Pass Definitions ───────────────────────────────────────────────────────

export interface WebGPURenderPassDef {
  name: string;
  vertexShader: string;
  fragmentShader: string;
  inputs?: Record<string, string>; // uniformName -> sourcePassName
  textureSlots?: string[]; // external texture uniform names (e.g. ['u_bgTexture', 'u_textSDF'])
  outputToScreen?: boolean;
}

// Mapping of uniform names -> field defs per pass
const BG_PASS_FIELDS: FieldDef[] = [
  { name: 'u_resolution', type: 'vec2f' },
  { name: 'u_dpr', type: 'f32' },
  { name: 'u_mergeRate', type: 'f32' },
  { name: 'u_mouse', type: 'vec2f' },
  { name: 'u_shapeWidth', type: 'f32' },
  { name: 'u_shapeHeight', type: 'f32' },
  { name: 'u_mouseSpring', type: 'vec2f' },
  { name: 'u_shapeRadius', type: 'f32' },
  { name: 'u_shapeRoundness', type: 'f32' },
  { name: 'u_shadowExpand', type: 'f32' },
  { name: 'u_shadowFactor', type: 'f32' },
  { name: 'u_shadowPosition', type: 'vec2f' },
  { name: 'u_bgType', type: 'i32' },
  { name: 'u_bgTextureReady', type: 'i32' },
  { name: 'u_bgTextureRatio', type: 'f32' },
  { name: 'u_showShape1', type: 'i32' },
  { name: 'u_time', type: 'f32' },
  { name: 'u_textEnabled', type: 'i32' },
  { name: 'u_textScale', type: 'f32' },
  { name: 'u_shapeCount', type: 'i32' },
  // pad to vec4 alignment before arrays
  { name: '_pad_bg_0', type: 'i32' },
  { name: 'u_shapes', type: 'array_vec4f', count: 8 },
  { name: 'u_shapeParams', type: 'array_vec4f', count: 8 },
];

const BLUR_PASS_FIELDS: FieldDef[] = [
  { name: 'u_resolution', type: 'vec2f' },
  { name: 'u_blurRadius', type: 'i32' },
  { name: '_pad_blur', type: 'i32' },
  { name: 'u_blurWeights', type: 'array_vec4f', count: 51 },
];

const MAIN_PASS_FIELDS: FieldDef[] = [
  { name: 'u_resolution', type: 'vec2f' },
  { name: 'u_dpr', type: 'f32' },
  { name: 'u_mergeRate', type: 'f32' },
  { name: 'u_mouse', type: 'vec2f' },
  { name: 'u_shapeWidth', type: 'f32' },
  { name: 'u_shapeHeight', type: 'f32' },
  { name: 'u_mouseSpring', type: 'vec2f' },
  { name: 'u_shapeRadius', type: 'f32' },
  { name: 'u_shapeRoundness', type: 'f32' },
  { name: 'u_tint', type: 'vec4f' },
  { name: 'u_refThickness', type: 'f32' },
  { name: 'u_refFactor', type: 'f32' },
  { name: 'u_refDispersion', type: 'f32' },
  { name: 'u_refFresnelRange', type: 'f32' },
  { name: 'u_refFresnelFactor', type: 'f32' },
  { name: 'u_refFresnelHardness', type: 'f32' },
  { name: 'u_glareRange', type: 'f32' },
  { name: 'u_glareConvergence', type: 'f32' },
  { name: 'u_glareOppositeFactor', type: 'f32' },
  { name: 'u_glareFactor', type: 'f32' },
  { name: 'u_glareHardness', type: 'f32' },
  { name: 'u_glareAngle', type: 'f32' },
  { name: 'u_blurEdge', type: 'i32' },
  { name: 'u_showShape1', type: 'i32' },
  { name: 'u_emissiveColor', type: 'vec3f' },
  { name: 'u_emissiveIntensity', type: 'f32' },
  { name: 'u_emissivePulse', type: 'f32' },
  { name: 'u_hdrEnabled', type: 'i32' },
  { name: 'u_exposure', type: 'f32' },
  { name: 'u_toneMappingType', type: 'i32' },
  { name: 'u_bloom', type: 'f32' },
  { name: 'u_uiContentEnabled', type: 'i32' },
  { name: 'u_uiContentOpacity', type: 'f32' },
  { name: 'u_shapeCount', type: 'i32' },
  { name: 'u_shapes', type: 'array_vec4f', count: 8 },
  { name: 'u_shapeParams', type: 'array_vec4f', count: 8 },
  { name: 'u_textEnabled', type: 'i32' },
  { name: 'u_textScale', type: 'f32' },
  { name: 'STEP', type: 'i32' },
];

function getFieldsForPass(passName: string): FieldDef[] {
  switch (passName) {
    case 'bgPass':
      return BG_PASS_FIELDS;
    case 'vBlurPass':
    case 'hBlurPass':
      return BLUR_PASS_FIELDS;
    case 'mainPass':
      return MAIN_PASS_FIELDS;
    default:
      return MAIN_PASS_FIELDS;
  }
}

// ─── Per-pass bind group layout configs ─────────────────────────────────────

interface BindGroupSlot {
  binding: number;
  visibility: number;
  type: 'uniform' | 'sampler' | 'texture';
}

function getBindGroupSlotsForPass(passName: string): BindGroupSlot[] {
  const F = GPUShaderStage.FRAGMENT;
  const VF = GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX;

  switch (passName) {
    case 'bgPass':
      return [
        { binding: 0, visibility: VF, type: 'uniform' },
        { binding: 1, visibility: F, type: 'sampler' },
        { binding: 2, visibility: F, type: 'texture' },     // u_bgTexture
        { binding: 3, visibility: F, type: 'texture' }, // u_textSDF (r32float)
      ];
    case 'vBlurPass':
    case 'hBlurPass':
      return [
        { binding: 0, visibility: VF, type: 'uniform' },
        { binding: 1, visibility: F, type: 'sampler' },
        { binding: 2, visibility: F, type: 'texture' },     // u_prevPassTexture
      ];
    case 'mainPass':
      return [
        { binding: 0, visibility: VF, type: 'uniform' },
        { binding: 1, visibility: F, type: 'sampler' },
        { binding: 2, visibility: F, type: 'texture' },     // u_blurredBg
        { binding: 3, visibility: F, type: 'texture' },     // u_bg
        { binding: 4, visibility: F, type: 'texture' },     // u_uiContent
        { binding: 5, visibility: F, type: 'texture' }, // u_textSDF (r32float)
      ];
    default:
      return [
        { binding: 0, visibility: VF, type: 'uniform' },
        { binding: 1, visibility: F, type: 'sampler' },
        { binding: 2, visibility: F, type: 'texture' },
      ];
  }
}

// Maps pass texture uniform names to their binding indices
function getTextureBindingMap(passName: string): Record<string, number> {
  switch (passName) {
    case 'bgPass':
      return { u_bgTexture: 2, u_textSDF: 3 };
    case 'vBlurPass':
    case 'hBlurPass':
      return { u_prevPassTexture: 2 };
    case 'mainPass':
      return { u_blurredBg: 2, u_bg: 3, u_uiContent: 4, u_textSDF: 5 };
    default:
      return {};
  }
}

// ─── Internal Pass State ────────────────────────────────────────────────────

interface PassState {
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  uniformLayout: UniformBufferLayout;
  bindGroupLayout: GPUBindGroupLayout;
  bindGroup: GPUBindGroup;
  textureViews: Map<number, GPUTextureView>; // binding -> current view
  outputTexture: GPUTexture | null;
  outputView: GPUTextureView | null;
  def: WebGPURenderPassDef;
  bindGroupDirty: boolean;
}

// ─── Texture Handle ─────────────────────────────────────────────────────────

export interface WebGPUTextureHandle {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
}

// ─── WebGPU Multi-Pass Renderer ─────────────────────────────────────────────

export class WebGPUMultiPassRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';
  private canvas: HTMLCanvasElement;
  private passOrder: string[] = [];
  private passes: Map<string, PassState> = new Map();
  private width = 0;
  private height = 0;
  private vertexBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private placeholderTexture: GPUTexture | null = null;
  private placeholderView: GPUTextureView | null = null;
  private _ready = false;
  private globalUniforms: Record<string, any> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get ready(): boolean {
    return this._ready;
  }

  // ── Init ────────────────────────────────────────────────────────────────

  async init(passDefs: WebGPURenderPassDef[]): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn('[WebGPU] Not available in this browser');
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('[WebGPU] No adapter found');
        return false;
      }

      // Request float32-filterable so we can use linear filtering on r32float SDF textures
      const features: GPUFeatureName[] = [];
      if (adapter.features.has('float32-filterable')) {
        features.push('float32-filterable');
      }
      this.device = await adapter.requestDevice({
        requiredFeatures: features,
      });
      this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
      if (!this.context) {
        console.warn('[WebGPU] Could not get context');
        return false;
      }

      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
      });

      // Fullscreen quad vertex buffer
      const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      this.vertexBuffer = this.device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

      // Sampler
      this.sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });

      // Placeholder textures
      this.placeholderTexture = createPlaceholderTexture(this.device);
      this.placeholderView = this.placeholderTexture.createView();

      this.width = this.canvas.width;
      this.height = this.canvas.height;

      // Add passes
      for (const def of passDefs) {
        this.addPass(def);
      }

      this._ready = true;
      console.log('[WebGPU] Renderer initialized successfully');
      return true;
    } catch (e) {
      console.error('[WebGPU] Initialization failed:', e);
      return false;
    }
  }

  // ── Pass Setup ──────────────────────────────────────────────────────────

  private addPass(def: WebGPURenderPassDef): void {
    if (!this.device) return;

    const vertexModule = this.device.createShaderModule({ code: def.vertexShader });
    const fragmentModule = this.device.createShaderModule({ code: def.fragmentShader });

    // Uniform buffer layout
    const fields = getFieldsForPass(def.name);
    const uniformLayout = new UniformBufferLayout(fields);
    const uniformBuffer = this.device.createBuffer({
      size: uniformLayout.size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Bind group layout
    const slots = getBindGroupSlotsForPass(def.name);
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: slots.map((slot) => {
        const entry: GPUBindGroupLayoutEntry = {
          binding: slot.binding,
          visibility: slot.visibility,
        };
        if (slot.type === 'uniform') {
          entry.buffer = { type: 'uniform' };
        } else if (slot.type === 'sampler') {
          entry.sampler = { type: 'filtering' };
        } else if (slot.type === 'texture') {
          entry.texture = { sampleType: 'float' };
        }
        return entry;
      }),
    });

    // Initial bind group with placeholders
    const textureViews = new Map<number, GPUTextureView>();
    const bindGroupEntries: GPUBindGroupEntry[] = slots.map((slot) => {
      if (slot.type === 'uniform') {
        return { binding: slot.binding, resource: { buffer: uniformBuffer } };
      } else if (slot.type === 'sampler') {
        return { binding: slot.binding, resource: this.sampler! };
      } else {
        // texture
        const view = this.placeholderView!;
        textureViews.set(slot.binding, view);
        return { binding: slot.binding, resource: view };
      }
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: bindGroupEntries,
    });

    // Pipeline
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    const pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 8,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' as GPUVertexFormat }],
          },
        ],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'main_frag',
        targets: [
          {
            format: def.outputToScreen ? this.format : 'rgba16float',
          },
        ],
      },
      primitive: { topology: 'triangle-strip' },
    });

    // Output texture for non-screen passes
    let outputTexture: GPUTexture | null = null;
    let outputView: GPUTextureView | null = null;
    if (!def.outputToScreen && this.width > 0 && this.height > 0) {
      outputTexture = this.device.createTexture({
        size: [this.width, this.height],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      outputView = outputTexture.createView();
    }

    this.passOrder.push(def.name);
    this.passes.set(def.name, {
      pipeline,
      uniformBuffer,
      uniformLayout,
      bindGroupLayout,
      bindGroup,
      textureViews,
      outputTexture,
      outputView,
      def,
      bindGroupDirty: false,
    });
  }

  // ── Uniform API (mirrors WebGL MultiPassRenderer) ───────────────────────

  setUniform(name: string, value: any): void {
    this.globalUniforms[name] = value;
  }

  setUniforms(uniforms: Record<string, any>): void {
    Object.assign(this.globalUniforms, uniforms);
  }

  clearUniform(name: string): void {
    delete this.globalUniforms[name];
  }

  // ── Texture Methods ─────────────────────────────────────────────────────

  async loadTexture(url: string): Promise<{ handle: WebGPUTextureHandle; ratio: number }> {
    if (!this.device) throw new Error('WebGPU not initialized');
    const { texture, ratio } = await loadWebGPUTexture(this.device, url);
    return {
      handle: {
        texture,
        view: texture.createView(),
        width: texture.width,
        height: texture.height,
      },
      ratio,
    };
  }

  createHDRTexture(hdrData: {
    width: number;
    height: number;
    data: Float32Array;
  }): { handle: WebGPUTextureHandle; ratio: number } {
    if (!this.device) throw new Error('WebGPU not initialized');
    const { texture, ratio } = createWebGPUHDRTexture(this.device, hdrData);
    return {
      handle: {
        texture,
        view: texture.createView(),
        width: hdrData.width,
        height: hdrData.height,
      },
      ratio,
    };
  }

  updateVideoTexture(
    handle: WebGPUTextureHandle | null,
    video: HTMLVideoElement,
  ): { handle: WebGPUTextureHandle; ratio: number } | null {
    if (!this.device) return null;
    const result = updateWebGPUVideoTexture(
      this.device,
      handle?.texture ?? null,
      video,
    );
    if (!result) return null;
    // Reuse existing handle/view if texture object is the same
    if (handle && result.texture === handle.texture) {
      return { handle, ratio: result.ratio };
    }
    return {
      handle: {
        texture: result.texture,
        view: result.texture.createView(),
        width: video.videoWidth,
        height: video.videoHeight,
      },
      ratio: result.ratio,
    };
  }

  uploadCanvasTexture(
    canvas: HTMLCanvasElement,
    existing?: WebGPUTextureHandle | null,
  ): WebGPUTextureHandle {
    if (!this.device) throw new Error('WebGPU not initialized');
    const texture = uploadWebGPUCanvasTexture(
      this.device,
      canvas,
      existing?.texture ?? null,
    );
    // Reuse existing handle/view if texture object is the same
    if (existing && texture === existing.texture) {
      return existing;
    }
    return {
      texture,
      view: texture.createView(),
      width: canvas.width,
      height: canvas.height,
    };
  }

  uploadTextSDFTexture(
    sdfResult: { data: Float32Array; width: number; height: number },
    existing?: WebGPUTextureHandle | null,
  ): WebGPUTextureHandle {
    if (!this.device) throw new Error('WebGPU not initialized');
    const texture = uploadWebGPUTextSDFTexture(
      this.device,
      sdfResult,
      existing?.texture ?? null,
    );
    // Reuse existing handle/view if texture object is the same
    if (existing && texture === existing.texture) {
      return existing;
    }
    return {
      texture,
      view: texture.createView(),
      width: sdfResult.width,
      height: sdfResult.height,
    };
  }

  // ── Resize ──────────────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (!this.device) return;

    for (const [, pass] of this.passes) {
      if (!pass.def.outputToScreen) {
        pass.outputTexture?.destroy();
        pass.outputTexture = this.device.createTexture({
          size: [width, height],
          format: 'rgba16float',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        pass.outputView = pass.outputTexture.createView();
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  render(passUniforms?: Record<string, Record<string, any>>): void {
    if (!this.device || !this.context || !this.vertexBuffer) return;

    const encoder = this.device.createCommandEncoder();

    for (const passName of this.passOrder) {
      const pass = this.passes.get(passName);
      if (!pass) continue;

      // Merge global + per-pass uniforms
      const uniforms: Record<string, any> = { ...this.globalUniforms };
      if (passUniforms && passUniforms[passName]) {
        Object.assign(uniforms, passUniforms[passName]);
      }

      // Write uniforms to layout buffer
      const textureBindingMap = getTextureBindingMap(passName);
      for (const [key, value] of Object.entries(uniforms)) {
        // Skip texture values - those go to bind groups
        if (value && typeof value === 'object' && 'texture' in value && 'view' in value) {
          // This is a WebGPUTextureHandle
          const bindingIdx = textureBindingMap[key];
          if (bindingIdx !== undefined) {
            this.setPassTextureView(pass, bindingIdx, (value as WebGPUTextureHandle).view);
          }
          continue;
        }
        // Skip WebGLTexture objects (passed as undefined for WebGPU)
        if (value instanceof WebGLTexture) continue;

        // Handle blur weights specially - pack into vec4 array
        if (key === 'u_blurWeights' && Array.isArray(value)) {
          const packed: number[] = [];
          for (let i = 0; i < 204; i++) {
            packed.push(i < value.length ? value[i] : 0);
          }
          pass.uniformLayout.set('u_blurWeights', packed);
          continue;
        }

        // Handle shape arrays - pack vec2[] into vec4[] for shapeParams
        if (key === 'u_shapeParams' && Array.isArray(value)) {
          // value is flat [r0, n0, r1, n1, ...] - pack into vec4 [r0, n0, 0, 0, r1, n1, 0, 0, ...]
          const packed: number[] = [];
          for (let i = 0; i < 8; i++) {
            packed.push(value[i * 2] ?? 0);     // radius
            packed.push(value[i * 2 + 1] ?? 2); // roundness
            packed.push(0);                       // padding
            packed.push(0);                       // padding
          }
          pass.uniformLayout.set('u_shapeParams', packed);
          continue;
        }

        pass.uniformLayout.set(key, value);
      }

      // Upload uniform buffer
      this.device.queue.writeBuffer(
        pass.uniformBuffer,
        0,
        pass.uniformLayout.getBuffer(),
      );

      // Resolve inter-pass texture inputs
      if (pass.def.inputs) {
        for (const [uniformName, sourcePassName] of Object.entries(pass.def.inputs)) {
          const sourcePass = this.passes.get(sourcePassName);
          if (sourcePass?.outputView) {
            const bindingIdx = textureBindingMap[uniformName];
            if (bindingIdx !== undefined) {
              this.setPassTextureView(pass, bindingIdx, sourcePass.outputView);
            }
          }
        }
      }

      // Rebuild bind group if dirty
      if (pass.bindGroupDirty) {
        this.rebuildBindGroup(pass);
      }

      // Render
      const colorAttachment: GPURenderPassColorAttachment = {
        view: pass.def.outputToScreen
          ? this.context.getCurrentTexture().createView()
          : pass.outputView!,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      };

      const renderPass = encoder.beginRenderPass({
        colorAttachments: [colorAttachment],
      });
      renderPass.setPipeline(pass.pipeline);
      renderPass.setBindGroup(0, pass.bindGroup);
      renderPass.setVertexBuffer(0, this.vertexBuffer);
      renderPass.draw(4);
      renderPass.end();
    }

    this.device.queue.submit([encoder.finish()]);
  }

  // ── Internal Helpers ────────────────────────────────────────────────────

  private setPassTextureView(pass: PassState, binding: number, view: GPUTextureView): void {
    const current = pass.textureViews.get(binding);
    if (current !== view) {
      pass.textureViews.set(binding, view);
      pass.bindGroupDirty = true;
    }
  }

  private rebuildBindGroup(pass: PassState): void {
    if (!this.device) return;

    const slots = getBindGroupSlotsForPass(pass.def.name);
    const entries: GPUBindGroupEntry[] = slots.map((slot) => {
      if (slot.type === 'uniform') {
        return { binding: slot.binding, resource: { buffer: pass.uniformBuffer } };
      } else if (slot.type === 'sampler') {
        return { binding: slot.binding, resource: this.sampler! };
      } else {
        const view = pass.textureViews.get(slot.binding) ?? this.placeholderView!;
        return { binding: slot.binding, resource: view };
      }
    });

    pass.bindGroup = this.device.createBindGroup({
      layout: pass.bindGroupLayout,
      entries,
    });
    pass.bindGroupDirty = false;
  }

  // ── Dispose ─────────────────────────────────────────────────────────────

  dispose(): void {
    for (const [, pass] of this.passes) {
      pass.outputTexture?.destroy();
      pass.uniformBuffer.destroy();
    }
    this.passes.clear();
    this.passOrder = [];
    this.vertexBuffer?.destroy();
    this.placeholderTexture?.destroy();
    this.device?.destroy();
    this._ready = false;
    this.globalUniforms = {};
  }
}

/**
 * Check if WebGPU is available in the current browser.
 */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

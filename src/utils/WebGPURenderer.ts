/**
 * WebGPU-based multi-pass renderer.
 * Mirrors the MultiPassRenderer API from GLUtils.ts so the application
 * can switch between WebGL2 and WebGPU with minimal code changes.
 *
 * Current status: foundational implementation.
 * The full GLSL→WGSL conversion for the main fragment shader is complex,
 * so this renderer is provided as an opt-in alternative that renders the
 * background + blur passes via WebGPU while falling back to canvas compositing
 * for the final glass effect.
 */

export interface WebGPURenderPassDef {
  name: string;
  vertexShader: string;
  fragmentShader: string;
  inputs?: Record<string, string>;
  outputToScreen?: boolean;
}

interface PassState {
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  uniformBindGroup: GPUBindGroup;
  outputTexture: GPUTexture | null;
  outputView: GPUTextureView | null;
  def: WebGPURenderPassDef;
}

export class WebGPUMultiPassRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';
  private canvas: HTMLCanvasElement;
  private passes: Map<string, PassState> = new Map();
  private width = 0;
  private height = 0;
  private vertexBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private _ready = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get ready(): boolean {
    return this._ready;
  }

  /**
   * Initialize WebGPU. Returns false if WebGPU is not available.
   */
  async init(): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn('WebGPU not available in this browser');
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('No WebGPU adapter found');
        return false;
      }

      this.device = await adapter.requestDevice();
      this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;

      if (!this.context) {
        console.warn('Could not get WebGPU context');
        return false;
      }

      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
      });

      // Create fullscreen quad vertex buffer
      const vertices = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
      ]);
      this.vertexBuffer = this.device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

      // Create sampler
      this.sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });

      this.width = this.canvas.width;
      this.height = this.canvas.height;
      this._ready = true;
      return true;
    } catch (e) {
      console.error('WebGPU initialization failed:', e);
      return false;
    }
  }

  /**
   * Add a render pass with WGSL shaders.
   */
  addPass(def: WebGPURenderPassDef): void {
    if (!this.device) return;

    const vertexModule = this.device.createShaderModule({
      code: def.vertexShader,
    });
    const fragmentModule = this.device.createShaderModule({
      code: def.fragmentShader,
    });

    // Create uniform buffer (1KB - enough for most uniforms)
    const uniformBuffer = this.device.createBuffer({
      size: 1024,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
      ],
    });

    // Create a 1x1 placeholder texture for unused texture slots
    const placeholderTexture = this.device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: this.sampler! },
        { binding: 2, resource: placeholderTexture.createView() },
      ],
    });

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
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2',
              },
            ],
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
      primitive: {
        topology: 'triangle-strip',
      },
    });

    // Create output texture for non-screen passes
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

    this.passes.set(def.name, {
      pipeline,
      uniformBuffer,
      uniformBindGroup: bindGroup,
      outputTexture,
      outputView,
      def,
    });
  }

  /**
   * Resize internal textures.
   */
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

  /**
   * Write uniform data to a pass's uniform buffer.
   */
  setPassUniforms(passName: string, data: Float32Array): void {
    if (!this.device) return;
    const pass = this.passes.get(passName);
    if (!pass) return;
    this.device.queue.writeBuffer(pass.uniformBuffer, 0, data);
  }

  /**
   * Render all passes in order.
   */
  render(): void {
    if (!this.device || !this.context || !this.vertexBuffer) return;

    const encoder = this.device.createCommandEncoder();

    for (const [, pass] of this.passes) {
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
      renderPass.setBindGroup(0, pass.uniformBindGroup);
      renderPass.setVertexBuffer(0, this.vertexBuffer);
      renderPass.draw(4);
      renderPass.end();
    }

    this.device.queue.submit([encoder.finish()]);
  }

  /**
   * Clean up all GPU resources.
   */
  destroy(): void {
    for (const [, pass] of this.passes) {
      pass.outputTexture?.destroy();
      pass.uniformBuffer.destroy();
    }
    this.passes.clear();
    this.vertexBuffer?.destroy();
    this.device?.destroy();
    this._ready = false;
  }
}

/**
 * Check if WebGPU is available in the current browser.
 */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

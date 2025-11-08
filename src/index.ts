// Main library exports
export { LiquidGlass, type LiquidGlassProps } from './components/LiquidGlass/LiquidGlass';

// Utility exports (if needed by consumers)
export { computeGaussianKernelByRadius } from './utils';
export {
  MultiPassRenderer,
  ShaderProgram,
  FrameBuffer,
  RenderPass,
  loadTextureFromURL,
  createEmptyTexture,
  updateVideoTexture,
} from './utils/GLUtils';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import styles from './LiquidGlass.module.scss';
import {
  MultiPassRenderer,
} from '../../utils/GLUtils';
import { Controller } from '@react-spring/web';
import { computeGaussianKernelByRadius } from '../../utils';

import VertexShader from '../../shaders/vertex.glsl?raw';
import FragmentBgShader from '../../shaders/fragment-bg.glsl?raw';
import FragmentBgVblurShader from '../../shaders/fragment-bg-vblur.glsl?raw';
import FragmentBgHblurShader from '../../shaders/fragment-bg-hblur.glsl?raw';
import FragmentMainShader from '../../shaders/fragment-main.glsl?raw';

export interface LiquidGlassProps {
  children?: ReactNode;

  // Shape properties
  width?: number;
  height?: number;
  shapeRadius?: number; // 0-100, percentage of corner roundness
  shapeRoundness?: number; // Roundness parameter for superellipse

  // Glass effect properties
  blur?: number; // Blur radius
  refThickness?: number; // Refraction thickness
  refFactor?: number; // Refraction strength
  refDispersion?: number; // Chromatic dispersion
  refFresnelRange?: number; // Fresnel effect range
  refFresnelHardness?: number; // 0-100
  refFresnelFactor?: number; // 0-100

  // Glare properties
  glareAngle?: number; // Degrees
  glareRange?: number;
  glareHardness?: number; // 0-100
  glareConvergence?: number; // 0-100
  glareOppositeFactor?: number; // 0-100
  glareFactor?: number; // 0-100

  // Tint color
  tint?: { r: number; g: number; b: number; a: number };

  // Shadow properties
  shadowExpand?: number;
  shadowFactor?: number; // 0-100
  shadowPosition?: { x: number; y: number };

  // Advanced
  mergeRate?: number; // For multiple shapes
  step?: number; // Rendering quality step
  springSizeFactor?: number; // Motion spring effect

  // Style
  className?: string;
  style?: CSSProperties;
}

export function LiquidGlass({
  children,
  width = 300,
  height = 300,
  shapeRadius = 50,
  shapeRoundness = 2.5,
  blur = 20,
  refThickness = 50,
  refFactor = 0.5,
  refDispersion = 0.02,
  refFresnelRange = 1.5,
  refFresnelHardness = 50,
  refFresnelFactor = 50,
  glareAngle = 135,
  glareRange = 1.5,
  glareHardness = 50,
  glareConvergence = 50,
  glareOppositeFactor = 20,
  glareFactor = 100,
  tint = { r: 255, g: 255, b: 255, a: 0 },
  shadowExpand = 10,
  shadowFactor = 30,
  shadowPosition = { x: 0, y: 0 },
  mergeRate = 0.5,
  step = 1.0,
  springSizeFactor = 10,
  className,
  style,
}: LiquidGlassProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dpr = useRef(window.devicePixelRatio);

  const stateRef = useRef<{
    renderRaf: number | null;
    canvasPointerPos: { x: number; y: number };
    blurWeights: number[];
    lastMouseSpringValue: { x: number; y: number };
    lastMouseSpringTime: null | number;
    mouseSpring: Controller<{ x: number; y: number }>;
    mouseSpringSpeed: { x: number; y: number };
  }>({
    renderRaf: null,
    canvasPointerPos: { x: width * dpr.current / 2, y: height * dpr.current / 2 },
    blurWeights: [],
    lastMouseSpringValue: { x: 0, y: 0 },
    lastMouseSpringTime: null,
    mouseSpring: new Controller({
      x: width * dpr.current / 2,
      y: height * dpr.current / 2,
      onChange: (c) => {
        if (!stateRef.current.lastMouseSpringTime) {
          stateRef.current.lastMouseSpringTime = Date.now();
          stateRef.current.lastMouseSpringValue = c.value;
          return;
        }

        const now = Date.now();
        const lastValue = stateRef.current.lastMouseSpringValue;
        const dt = now - stateRef.current.lastMouseSpringTime;
        const dx = {
          x: c.value.x - lastValue.x,
          y: c.value.y - lastValue.y,
        };
        const speed = {
          x: dx.x / dt,
          y: dx.y / dt,
        };

        if (Math.abs(speed.x) > 1e10 || Math.abs(speed.y) > 1e10) {
          speed.x = 0;
          speed.y = 0;
        }

        stateRef.current.mouseSpringSpeed = speed;
        stateRef.current.lastMouseSpringValue = c.value;
        stateRef.current.lastMouseSpringTime = now;
      },
    }),
    mouseSpringSpeed: { x: 0, y: 0 },
  });

  // Compute blur weights when blur radius changes
  useMemo(() => {
    stateRef.current.blurWeights = computeGaussianKernelByRadius(blur);
  }, [blur]);

  // Setup canvas size
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.width = width * dpr.current;
    canvasRef.current.height = height * dpr.current;
  }, [width, height]);

  // Main WebGL rendering effect
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvasEl = canvasRef.current;

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      stateRef.current.canvasPointerPos = {
        x: (e.clientX - rect.left) * dpr.current,
        y: (height - (e.clientY - rect.top)) * dpr.current,
      };
      stateRef.current.mouseSpring.start(stateRef.current.canvasPointerPos);
    };

    canvasEl.addEventListener('pointermove', onPointerMove);

    const gl = canvasEl.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }

    const renderer = new MultiPassRenderer(canvasEl, [
      {
        name: 'bgPass',
        shader: {
          vertex: VertexShader,
          fragment: FragmentBgShader,
        },
      },
      {
        name: 'vBlurPass',
        shader: {
          vertex: VertexShader,
          fragment: FragmentBgVblurShader,
        },
        inputs: {
          u_prevPassTexture: 'bgPass',
        },
      },
      {
        name: 'hBlurPass',
        shader: {
          vertex: VertexShader,
          fragment: FragmentBgHblurShader,
        },
        inputs: {
          u_prevPassTexture: 'vBlurPass',
        },
      },
      {
        name: 'mainPass',
        shader: {
          vertex: VertexShader,
          fragment: FragmentMainShader,
        },
        inputs: {
          u_blurredBg: 'hBlurPass',
          u_bg: 'bgPass',
        },
        outputToScreen: true,
      },
    ]);

    let raf: number | null = null;

    const render = () => {
      raf = requestAnimationFrame(render);

      gl.viewport(0, 0, width * dpr.current, height * dpr.current);
      renderer.resize(width * dpr.current, height * dpr.current);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const mouseSpring = stateRef.current.mouseSpring.get();

      const shapeSizeSpring = {
        x: width + (Math.abs(stateRef.current.mouseSpringSpeed.x) * width * springSizeFactor) / 100,
        y: height + (Math.abs(stateRef.current.mouseSpringSpeed.y) * height * springSizeFactor) / 100,
      };

      renderer.setUniforms({
        u_resolution: [width * dpr.current, height * dpr.current],
        u_dpr: dpr.current,
        u_blurWeights: stateRef.current.blurWeights,
        u_blurRadius: blur,
        u_mouse: [stateRef.current.canvasPointerPos.x, stateRef.current.canvasPointerPos.y],
        u_mouseSpring: [mouseSpring.x, mouseSpring.y],
        u_shapeWidth: shapeSizeSpring.x,
        u_shapeHeight: shapeSizeSpring.y,
        u_shapeRadius: ((Math.min(shapeSizeSpring.x, shapeSizeSpring.y) / 2) * shapeRadius) / 100,
        u_shapeRoundness: shapeRoundness,
        u_mergeRate: mergeRate,
        u_glareAngle: (glareAngle * Math.PI) / 180,
        u_showShape1: 1,
      });

      renderer.render({
        bgPass: {
          u_bgType: 0, // Simple grid background
          u_bgTextureReady: 0,
          u_shadowExpand: shadowExpand,
          u_shadowFactor: shadowFactor / 100,
          u_shadowPosition: [-shadowPosition.x, -shadowPosition.y],
        },
        mainPass: {
          u_tint: [tint.r / 255, tint.g / 255, tint.b / 255, tint.a],
          u_refThickness: refThickness,
          u_refFactor: refFactor,
          u_refDispersion: refDispersion,
          u_refFresnelRange: refFresnelRange,
          u_refFresnelHardness: refFresnelHardness / 100,
          u_refFresnelFactor: refFresnelFactor / 100,
          u_glareRange: glareRange,
          u_glareHardness: glareHardness / 100,
          u_glareConvergence: glareConvergence / 100,
          u_glareOppositeFactor: glareOppositeFactor / 100,
          u_glareFactor: glareFactor / 100,
          STEP: step,
        },
      });
    };

    raf = requestAnimationFrame(render);

    return () => {
      canvasEl.removeEventListener('pointermove', onPointerMove);
      if (raf) {
        cancelAnimationFrame(raf);
      }
      renderer.dispose();
    };
  }, [
    width,
    height,
    blur,
    shapeRadius,
    shapeRoundness,
    refThickness,
    refFactor,
    refDispersion,
    refFresnelRange,
    refFresnelHardness,
    refFresnelFactor,
    glareAngle,
    glareRange,
    glareHardness,
    glareConvergence,
    glareOppositeFactor,
    glareFactor,
    tint,
    shadowExpand,
    shadowFactor,
    shadowPosition,
    mergeRate,
    step,
    springSizeFactor,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {children}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${height}px`,
            pointerEvents: 'none',
            ['--dpr']: dpr.current,
          } as CSSProperties
        }
      />
    </div>
  );
}

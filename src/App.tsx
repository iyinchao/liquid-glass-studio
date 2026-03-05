import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import styles from './App.module.scss';
import {
  createEmptyTexture,
  createHDRTexture,
  loadTextureFromURL,
  MultiPassRenderer,
  updateVideoTexture,
} from './utils/GLUtils';
import { isHDRFile, loadHDRFile } from './utils/hdrLoader';
import { ResizableWindow } from './components/ResizableWindow';
import type { ResizeWindowCtrlRefType } from './components/ResizableWindow/ResizableWindow';

import VertexShader from './shaders/vertex.glsl?raw';
import FragmentBgShader from './shaders/fragment-bg.glsl?raw';
import FragmentBgVblurShader from './shaders/fragment-bg-vblur.glsl?raw';
import FragmentBgHblurShader from './shaders/fragment-bg-hblur.glsl?raw';
import FragmentMainShader from './shaders/fragment-main.glsl?raw';
import { Controller } from '@react-spring/web';

// import { useResizeObserver } from './utils/useResizeOberver';
import clsx from 'clsx';
import { capitalize, computeGaussianKernelByRadius } from './utils';
import { EditorMode, createDefaultShape } from './components/EditorMode';
import type { ShapeDef } from './components/EditorMode';

import bgGrid from '@/assets/bg-grid.png';
import bgBars from '@/assets/bg-bars.png';
import bgHalf from '@/assets/bg-half.png';
import bgTimcook from '@/assets/bg-timcook.png';
import bgUI from '@/assets/bg-ui.svg';
import bgTahoeLightImg from '@/assets/bg-tahoe-light.webp';
import bgText from '@/assets/bg-text.jpg';
import bgBuildings from '@/assets/bg-buildings.png';
import bgVideoFish from '@/assets/bg-video-fish.mp4';
import bgVideo2 from '@/assets/bg-video-2.mp4';
import bgVideo3 from '@/assets/bg-video-3.mp4';

import XIcon from '@mui/icons-material/X';
import GitHubIcon from '@mui/icons-material/GitHub';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { useLevaControls } from './Controls';
import { PresetControls } from './components/PresetControls/PresetControls';
import {
  createUIContentCanvas,
  renderUIContent,
  uploadCanvasTexture,
  type UIContentType,
} from './utils/uiContentRenderer';
import { generateTextSDF, uploadTextSDFTexture, SDF_RANGE } from './utils/textSDF';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasInfo, setCanvasInfo] = useState<{ width: number; height: number; dpr: number }>({
    width: Math.max(Math.min(window.innerWidth, window.innerHeight) - 150, 600),
    height: Math.max(Math.min(window.innerWidth, window.innerHeight) - 150, 600),
    dpr: 1,
  });

  // Editor mode shape state
  const [editorShapes, setEditorShapes] = useState<ShapeDef[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const editorShapesRef = useRef<ShapeDef[]>([]);
  editorShapesRef.current = editorShapes;

  const { controls, lang, langName, levaGlobal, controlsAPI } = useLevaControls({
    containerRender: {
      /* eslint-disable react-hooks/rules-of-hooks */
      bgType: ({ value, setValue }) => {
        const [customFileType, setCustomFileType] = useState<null | 'image' | 'video' | 'hdr'>(null);
        const [customFile, setCustomFile] = useState<null | File>(null);
        const [customFileUrl, setCustomFileUrl] = useState<null | string>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);

        return (
          <div className={styles.bgSelect}>
            {[
              { v: 11, media: '', loadTexture: true, type: 'custom' as const },
              { v: 0, media: bgGrid, loadTexture: false },
              { v: 1, media: bgBars, loadTexture: false },
              { v: 2, media: bgHalf, loadTexture: false },
              { v: 3, media: bgTahoeLightImg, loadTexture: true },
              { v: 4, media: bgBuildings, loadTexture: true },
              { v: 5, media: bgText, loadTexture: true },
              { v: 6, media: bgTimcook, loadTexture: true },
              { v: 7, media: bgUI, loadTexture: true },
              { v: 8, media: bgVideoFish, loadTexture: true, type: 'video' as const },
              { v: 9, media: bgVideo2, loadTexture: true, type: 'video' as const },
              { v: 10, media: bgVideo3, loadTexture: true, type: 'video' as const },
            ].map(({ v, media, loadTexture, type }) => {
              const mediaType = type === 'custom' ? customFileType : (type ?? 'image');
              const mediaUrl = type === 'custom' ? customFileUrl : media;
              return (
                <div
                  className={clsx(
                    styles.bgSelectItem,
                    styles[`bgSelectItemType${capitalize(type ?? 'image')}`],
                    {
                      [styles.bgSelectItemActive]: value === v,
                    },
                  )}
                  // style={{ backgroundImage: !type ? `url(${media})` : '' }}
                  key={v}
                  onClick={() => {
                    if (type === 'custom') {
                      if (!mediaUrl) {
                        fileInputRef.current?.click();
                      } else if (value === v) {
                        fileInputRef.current?.click();
                      }
                    }
                    setValue(v);
                    if (loadTexture && mediaUrl) {
                      stateRef.current.bgTextureUrl = mediaUrl;
                      if (mediaType === 'video') {
                        stateRef.current.bgTextureType = 'video';
                      } else if (mediaType === 'hdr') {
                        stateRef.current.bgTextureType = 'hdr';
                      } else {
                        stateRef.current.bgTextureType = 'image';
                      }
                    } else {
                      stateRef.current.bgTextureUrl = null;
                      stateRef.current.bgTextureReady = false;
                    }
                  }}
                >
                  {mediaUrl &&
                    (mediaType === 'video' ? (
                      <video
                        playsInline
                        muted={true}
                        loop
                        className={styles.bgSelectItemVideo}
                        ref={(ref) => {
                          if (ref) {
                            stateRef.current.bgVideoEls.set(v, ref);
                          } else {
                            stateRef.current.bgVideoEls.delete(v);
                          }
                        }}
                      >
                        <source src={mediaUrl}></source>
                      </video>
                    ) : mediaType === 'image' ? (
                      <img src={mediaUrl} className={styles.bgSelectItemImg} />
                    ) : null)}
                  {type === 'custom' ? (
                    <>
                      <input
                        type="file"
                        accept="image/*,video/*,.hdr"
                        ref={fileInputRef}
                        multiple={false}
                        onChange={(e) => {
                          if (!e.target.files?.[0]) {
                            return;
                          }
                          const file = e.target.files[0];
                          setCustomFile(file);
                          if (customFileUrl) {
                            URL.revokeObjectURL(customFileUrl);
                          }
                          const newUrl = URL.createObjectURL(file);
                          setCustomFileUrl(newUrl);
                          const fileType: 'image' | 'video' | 'hdr' = isHDRFile(file)
                            ? 'hdr'
                            : file.type.startsWith('image/')
                              ? 'image'
                              : file.type.startsWith('video/')
                                ? 'video'
                                : 'image';
                          setCustomFileType(fileType);
                          setValue(v);
                          stateRef.current.bgTextureUrl = newUrl;
                          stateRef.current.bgTextureType = fileType;
                          if (fileType === 'hdr') {
                            stateRef.current.hdrFile = file;
                          }
                        }}
                      ></input>
                      <FileUploadOutlinedIcon />
                    </>
                  ) : null}
                  <div
                    className={clsx(
                      styles.bgSelectItemOverlay,
                      styles[`bgSelectItemOverlay${capitalize(type ?? 'image')}`],
                    )}
                  >
                    {mediaType === 'video' && (
                      <PlayCircleOutlinedIcon
                        className={styles.bgSelectItemVideoIcon}
                        style={{
                          opacity: value !== v ? 1 : 0,
                        }}
                      />
                    )}
                    {type === 'custom' && (
                      <div className={styles.bgSelectItemCustomIcon}>
                        <FileUploadOutlinedIcon />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      },
      /* eslint-enable react-hooks/rules-of-hooks */
    },
  });

  const stateRef = useRef<{
    canvasWindowCtrlRef: ResizeWindowCtrlRefType | null;
    renderRaf: number | null;
    canvasInfo: typeof canvasInfo;
    glStates: {
      gl: WebGL2RenderingContext;
      programs: Record<string, WebGLProgram>;
      vao: WebGLVertexArrayObject;
    } | null;
    canvasPos: { x: number; y: number };
    canvasPointerPos: { x: number; y: number };
    controls: typeof controls;
    blurWeights: number[];
    lastMouseSpringValue: { x: number; y: number };
    lastMouseSpringTime: null | number;
    mouseSpring: Controller<{ x: number; y: number }>;
    mouseSpringSpeed: { x: number; y: number };
    bgTextureUrl: string | null;
    bgTexture: WebGLTexture | null;
    bgTextureRatio: number;
    bgTextureType: 'image' | 'video' | 'hdr' | null;
    hdrFile: File | null;
    isHDRContent: boolean;
    bgTextureReady: boolean;
    bgVideoEls: Map<number, HTMLVideoElement>;
    langName: typeof langName;
    uiContentCanvas: HTMLCanvasElement | null;
    uiContentTexture: WebGLTexture | null;
    textSDFTexture: WebGLTexture | null;
    textSDFDirty: boolean;
    lastTextContent: string;
    lastTextSize: number;
    lastTextFont: string;
    lastTextEnabled: boolean;
    startTime: number | null;
  }>({
    canvasWindowCtrlRef: null,
    renderRaf: null,
    glStates: null,
    canvasInfo,
    canvasPos: {
      x: 0,
      y: 0,
    },
    canvasPointerPos: {
      x: 0,
      y: 0,
    },
    controls,
    blurWeights: [],
    lastMouseSpringValue: {
      x: 0,
      y: 0,
    },
    lastMouseSpringTime: null,
    mouseSpring: new Controller({
      x: 0,
      y: 0,
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
    mouseSpringSpeed: {
      x: 0,
      y: 0,
    },
    bgTextureUrl: null,
    bgTexture: null,
    bgTextureRatio: 1,
    bgTextureType: null,
    hdrFile: null,
    isHDRContent: false,
    bgTextureReady: false,
    bgVideoEls: new Map(),
    langName: langName,
    uiContentCanvas: null,
    uiContentTexture: null,
    textSDFTexture: null,
    textSDFDirty: true,
    lastTextContent: '',
    lastTextSize: 0,
    lastTextFont: '',
    lastTextEnabled: false,
    lastTextSuperSample: 0,
    lastTextCanvasWidth: 0,
    lastTextCanvasHeight: 0,
    lastTextCanvasDpr: 0,
    startTime: null,
  });
  stateRef.current.canvasInfo = canvasInfo;
  stateRef.current.controls = controls;
  stateRef.current.langName = langName;

  // Initialize editor shapes when editor mode is first enabled
  const prevEditorMode = useRef(false);
  useEffect(() => {
    if (controls.editorMode && !prevEditorMode.current) {
      // Entering editor mode: seed with one shape at center
      if (editorShapes.length === 0) {
        const initial = createDefaultShape(canvasInfo.width, canvasInfo.height);
        initial.width = controls.shapeWidth;
        initial.height = controls.shapeHeight;
        initial.radius = controls.shapeRadius;
        initial.roundness = controls.shapeRoundness;
        setEditorShapes([initial]);
        setSelectedShapeId(initial.id);
      }
    }
    prevEditorMode.current = controls.editorMode;
  }, [controls.editorMode]);

  // useEffect(() => {
  //   setLangName(controls.language[0] as keyof typeof languages);
  // }, [controls.language]);

  // console.log(controls.language);

  useMemo(() => {
    stateRef.current.blurWeights = computeGaussianKernelByRadius(controls.blurRadius);
  }, [controls.blurRadius]);

  const centerizeCanvasWindow = useCallback(() => {
    const ctrl = stateRef.current.canvasWindowCtrlRef;
    if (!ctrl) {
      return;
    }
    const size = ctrl.getSize();
    ctrl.setMoveOffset({
      x: window.innerWidth / 2 - size.width / 2,
      y: window.innerHeight / 2 - size.height / 2,
    });
  }, []);

  useLayoutEffect(() => {
    const onResize = () => {
      centerizeCanvasWindow();
      setCanvasInfo((v) => ({
        ...v,
        dpr: window.devicePixelRatio,
      }));
    };
    window.addEventListener('resize', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useLayoutEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    canvasRef.current.width = canvasInfo.width * canvasInfo.dpr;
    canvasRef.current.height = canvasInfo.height * canvasInfo.dpr;
  }, [canvasInfo]);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const canvasEl = canvasRef.current;
    const onPointerMove = (e: PointerEvent) => {
      const canvasInfo = stateRef.current.canvasInfo;
      if (!canvasInfo) {
        return;
      }
      // In editor mode, don't update mouse tracking for shapes
      if (stateRef.current.controls.editorMode) {
        return;
      }
      stateRef.current.canvasPointerPos = {
        x: (e.clientX - stateRef.current.canvasPos.x) * canvasInfo.dpr,
        y:
          (stateRef.current.canvasInfo.height - (e.clientY - stateRef.current.canvasPos.y)) *
          canvasInfo.dpr,
      };
      stateRef.current.mouseSpring.start(stateRef.current.canvasPointerPos);
    };
    canvasEl.addEventListener('pointermove', onPointerMove);

    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvasEl.getContext('webgl2', { colorSpace: 'display-p3' } as WebGLContextAttributes);
      if (gl) {
        try {
          (gl as any).drawingBufferColorSpace = 'display-p3';
          console.log('[Liquid Glass] 10-bit display-p3 canvas enabled');
        } catch {
          console.log('[Liquid Glass] display-p3 drawingBufferColorSpace not supported, using sRGB');
        }
      }
    } catch {
      gl = canvasEl.getContext('webgl2');
    }
    if (!gl) {
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
    const lastState = {
      canvasInfo: null as typeof canvasInfo | null,
      controls: null as typeof controls | null,
      bgTextureType: null as typeof stateRef.current.bgTextureType,
      bgTextureUrl: null as typeof stateRef.current.bgTextureUrl,
    };
    const render = () => {
      raf = requestAnimationFrame(render);

      const now = performance.now();
      if (!stateRef.current.startTime) {
        stateRef.current.startTime = now;
      }
      const elapsedTime = (now - stateRef.current.startTime) / 1000.0;

      const canvasInfo = stateRef.current.canvasInfo;
      const textureUrl = stateRef.current.bgTextureUrl;
      if (
        !lastState.canvasInfo ||
        lastState.canvasInfo.width !== canvasInfo.width ||
        lastState.canvasInfo.height !== canvasInfo.height ||
        lastState.canvasInfo.dpr !== canvasInfo.dpr
      ) {
        gl.viewport(
          0,
          0,
          Math.round(canvasInfo.width * canvasInfo.dpr),
          Math.round(canvasInfo.height * canvasInfo.dpr),
        );
        renderer.resize(canvasInfo.width * canvasInfo.dpr, canvasInfo.height * canvasInfo.dpr);
        renderer.setUniform('u_resolution', [
          canvasInfo.width * canvasInfo.dpr,
          canvasInfo.height * canvasInfo.dpr,
        ]);
      }
      if (textureUrl !== lastState.bgTextureUrl) {
        if (lastState.bgTextureType === 'video') {
          if (lastState.controls?.bgType !== undefined) {
            stateRef.current.bgVideoEls.get(lastState.controls.bgType)?.pause();
          }
        }
        if (!textureUrl) {
          if (stateRef.current.bgTexture) {
            gl.deleteTexture(stateRef.current.bgTexture);
            stateRef.current.bgTexture = null;
            stateRef.current.bgTextureType = null;
            stateRef.current.isHDRContent = false;
          }
        } else {
          if (stateRef.current.bgTextureType === 'image') {
            stateRef.current.isHDRContent = false;
            const rafId = requestAnimationFrame(() => {
              stateRef.current.bgTextureReady = false;
            });
            loadTextureFromURL(gl, textureUrl).then(({ texture, ratio }) => {
              if (stateRef.current.bgTextureUrl === textureUrl) {
                cancelAnimationFrame(rafId);
                stateRef.current.bgTexture = texture;
                stateRef.current.bgTextureRatio = ratio;
                stateRef.current.bgTextureReady = true;
              }
            });
          } else if (stateRef.current.bgTextureType === 'video') {
            stateRef.current.isHDRContent = false;
            stateRef.current.bgTextureReady = false;
            stateRef.current.bgTexture = createEmptyTexture(gl);
            stateRef.current.bgVideoEls.get(stateRef.current.controls.bgType)?.play();
          } else if (stateRef.current.bgTextureType === 'hdr' && stateRef.current.hdrFile) {
            stateRef.current.bgTextureReady = false;
            stateRef.current.isHDRContent = true;
            const hdrFile = stateRef.current.hdrFile;
            loadHDRFile(hdrFile).then((hdrData) => {
              if (stateRef.current.bgTextureUrl === textureUrl) {
                const { texture, ratio } = createHDRTexture(gl, hdrData);
                stateRef.current.bgTexture = texture;
                stateRef.current.bgTextureRatio = ratio;
                stateRef.current.bgTextureReady = true;
                // Auto-enable HDR mode for HDR content
                controlsAPI.set({ hdrEnabled: true, hdrToneMappingType: 2 });
              }
            }).catch((err) => {
              console.error('[Liquid Glass] Failed to load HDR file:', err);
            });
          }
        }
      }
      lastState.controls = stateRef.current.controls;
      lastState.bgTextureType = stateRef.current.bgTextureType;
      lastState.canvasInfo = canvasInfo;
      lastState.bgTextureUrl = stateRef.current.bgTextureUrl;

      if (stateRef.current.bgTextureType === 'video') {
        const videoEl = stateRef.current.bgVideoEls.get(stateRef.current.controls.bgType);
        if (stateRef.current.bgTexture && videoEl) {
          const info = updateVideoTexture(gl, stateRef.current.bgTexture, videoEl);

          if (info) {
            stateRef.current.bgTextureRatio = info.ratio;
            stateRef.current.bgTextureReady = true;
          }
        }
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const controls = stateRef.current.controls;
      const mouseSpring = stateRef.current.mouseSpring.get();

      const shapeSizeSpring = {
        x:
          controls.shapeWidth +
          (Math.abs(stateRef.current.mouseSpringSpeed.x) *
            controls.shapeWidth *
            controls.springSizeFactor) /
          100,
        y:
          controls.shapeHeight +
          (Math.abs(stateRef.current.mouseSpringSpeed.y) *
            controls.shapeHeight *
            controls.springSizeFactor) /
          100,
      };

      // Build shape uniforms for editor mode
      const editorShapes = editorShapesRef.current;
      const isEditorMode = controls.editorMode && editorShapes.length > 0;

      // Prepare shape arrays for uniforms (up to 8 shapes)
      // Each shape: vec4(x, y, width, height) in canvas pixel coords
      // Params: vec2(radius, roundness) per shape
      const shapeData: number[] = [];
      const shapeParamsData: number[] = [];
      if (isEditorMode) {
        for (let i = 0; i < 8; i++) {
          if (i < editorShapes.length) {
            const s = editorShapes[i];
            // Convert from CSS coords (origin top-left) to shader coords (origin bottom-left)
            const sx = s.x * canvasInfo.dpr;
            const sy = (canvasInfo.height - s.y) * canvasInfo.dpr;
            const sw = s.width * canvasInfo.dpr;
            const sh = s.height * canvasInfo.dpr;
            const sr =
              ((Math.min(sw, sh) / 2) * s.radius) / 100;
            shapeData.push(sx, sy, sw, sh);
            shapeParamsData.push(sr, s.roundness);
          } else {
            shapeData.push(0, 0, 0, 0);
            shapeParamsData.push(0, 2);
          }
        }
      }

      renderer.setUniforms({
        u_resolution: [canvasInfo.width * canvasInfo.dpr, canvasInfo.height * canvasInfo.dpr],
        u_dpr: canvasInfo.dpr,
        u_blurWeights: stateRef.current.blurWeights,
        u_blurRadius: stateRef.current.controls.blurRadius,
        u_mouse: [stateRef.current.canvasPointerPos.x, stateRef.current.canvasPointerPos.y],
        u_mouseSpring: isEditorMode ? [0, 0] : [mouseSpring.x, mouseSpring.y],
        u_shapeWidth: shapeSizeSpring.x,
        u_shapeHeight: shapeSizeSpring.y,
        u_shapeRadius:
          ((Math.min(shapeSizeSpring.x, shapeSizeSpring.y) / 2) * controls.shapeRadius) / 100,
        u_shapeRoundness: controls.shapeRoundness,
        u_mergeRate: controls.mergeRate,
        u_glareAngle: (controls.glareAngle * Math.PI) / 180,
        u_showShape1: controls.showShape1 && !controls.textEnabled ? 1 : 0,
        u_shapeCount: isEditorMode ? editorShapes.length : 0,
        u_shapes: isEditorMode ? shapeData : new Array(32).fill(0),
        u_shapeParams: isEditorMode ? shapeParamsData : new Array(16).fill(0),
      });

      // UI Content rendering
      if (controls.uiContentEnabled) {
        const cw = Math.round(canvasInfo.width * canvasInfo.dpr);
        const ch = Math.round(canvasInfo.height * canvasInfo.dpr);
        if (
          !stateRef.current.uiContentCanvas ||
          stateRef.current.uiContentCanvas.width !== cw ||
          stateRef.current.uiContentCanvas.height !== ch
        ) {
          stateRef.current.uiContentCanvas = createUIContentCanvas(cw, ch);
        }
        renderUIContent(
          stateRef.current.uiContentCanvas,
          controls.uiContentType as UIContentType,
          { text: controls.uiContentText },
        );
        stateRef.current.uiContentTexture = uploadCanvasTexture(
          gl,
          stateRef.current.uiContentCanvas,
          stateRef.current.uiContentTexture,
        );
      }

      // Text SDF generation
      if (
        controls.textEnabled !== stateRef.current.lastTextEnabled ||
        controls.textContent !== stateRef.current.lastTextContent ||
        controls.textSize !== stateRef.current.lastTextSize ||
        controls.textFont !== stateRef.current.lastTextFont ||
        controls.textSuperSample !== stateRef.current.lastTextSuperSample ||
        stateRef.current.lastTextCanvasWidth !== canvasInfo.width ||
        stateRef.current.lastTextCanvasHeight !== canvasInfo.height ||
        stateRef.current.lastTextCanvasDpr !== canvasInfo.dpr
      ) {
        stateRef.current.textSDFDirty = true;
        stateRef.current.lastTextEnabled = controls.textEnabled;
        stateRef.current.lastTextContent = controls.textContent;
        stateRef.current.lastTextSize = controls.textSize;
        stateRef.current.lastTextFont = controls.textFont;
        stateRef.current.lastTextSuperSample = controls.textSuperSample;
        stateRef.current.lastTextCanvasWidth = canvasInfo.width;
        stateRef.current.lastTextCanvasHeight = canvasInfo.height;
        stateRef.current.lastTextCanvasDpr = canvasInfo.dpr;
      }

      if (controls.textEnabled && stateRef.current.textSDFDirty) {
        const sdfWidth = Math.round(canvasInfo.width * canvasInfo.dpr);
        const sdfHeight = Math.round(canvasInfo.height * canvasInfo.dpr);
        const sdfResult = generateTextSDF(
          controls.textContent,
          controls.textSize * canvasInfo.dpr,
          controls.textFont,
          sdfWidth,
          sdfHeight,
          controls.textSuperSample,
        );
        stateRef.current.textSDFTexture = uploadTextSDFTexture(
          gl,
          sdfResult,
          stateRef.current.textSDFTexture,
        );
        stateRef.current.textSDFDirty = false;
      }

      const textSDFTexture = controls.textEnabled && stateRef.current.textSDFTexture
        ? stateRef.current.textSDFTexture
        : undefined;

      renderer.render({
        bgPass: {
          u_bgType: controls.bgType,
          u_bgTexture: (stateRef.current.bgTextureUrl && stateRef.current.bgTexture) ?? undefined,
          u_bgTextureRatio:
            stateRef.current.bgTextureUrl && stateRef.current.bgTexture
              ? stateRef.current.bgTextureRatio
              : undefined,
          u_bgTextureReady: stateRef.current.bgTextureReady ? 1 : 0,
          u_shadowExpand: controls.shadowExpand,
          u_shadowFactor: controls.shadowFactor / 100,
          u_shadowPosition: [-controls.shadowPosition.x, -controls.shadowPosition.y],
          u_textSDF: textSDFTexture,
          u_textEnabled: controls.textEnabled ? 1 : 0,
          u_textScale: 2 * SDF_RANGE,
        },
        mainPass: {
          u_tint: [
            controls.tint.r / 255,
            controls.tint.g / 255,
            controls.tint.b / 255,
            controls.tint.a,
          ],
          u_refThickness: controls.refThickness,
          u_refFactor: controls.refFactor,
          u_refDispersion: controls.refDispersion,
          u_refFresnelRange: controls.refFresnelRange,
          u_refFresnelHardness: controls.refFresnelHardness / 100,
          u_refFresnelFactor: controls.refFresnelFactor / 100,
          u_glareRange: controls.glareRange,
          u_glareHardness: controls.glareHardness / 100,
          u_glareConvergence: controls.glareConvergence / 100,
          u_glareOppositeFactor: controls.glareOppositeFactor / 100,
          u_glareFactor: controls.glareFactor / 100,
          u_blurEdge: controls.blurEdge ? 1 : 0,
          u_uiContentEnabled: controls.uiContentEnabled ? 1 : 0,
          u_uiContentOpacity: controls.uiContentOpacity / 100,
          u_uiContent: controls.uiContentEnabled && stateRef.current.uiContentTexture
            ? stateRef.current.uiContentTexture
            : undefined,
          u_emissiveColor: [
            controls.emissiveColor.r / 255,
            controls.emissiveColor.g / 255,
            controls.emissiveColor.b / 255,
          ],
          u_emissiveIntensity: controls.emissiveIntensity / 100,
          u_emissivePulse: controls.emissivePulse
            ? Math.sin(elapsedTime * 2.0) * 0.5 + 0.5
            : 0.0,
          u_hdrEnabled: controls.hdrEnabled ? 1 : 0,
          u_exposure: controls.hdrExposure,
          u_toneMappingType: controls.hdrToneMappingType,
          u_bloom: controls.hdrBloom,
          u_textSDF: textSDFTexture,
          u_textEnabled: controls.textEnabled ? 1 : 0,
          u_textScale: 2 * SDF_RANGE,
          STEP: controls.step,
        },
      });
    };
    raf = requestAnimationFrame(render);

    return () => {
      canvasEl.removeEventListener('pointermove', onPointerMove);
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, []);

  return (
    <>
      {levaGlobal}
      <header className={styles.header}>
        <div className={styles.logoWrapper}>
          <div className={styles.title}>Liquid Glass Studio</div>
          <div className={styles.subtitle}>{lang['ui.subtitle']}</div>
        </div>
        <div className={styles.content}>
          <span>
            by <a>iyinchao</a>
          </span>
          <a
            href="https://github.com/iyinchao/liquid-glass-studio"
            target="_blank"
            className={styles.button}
          >
            <GitHubIcon />
          </a>
          <a
            href="https://x.com/charles_yin/status/1936338569267986605"
            target="_blank"
            className={styles.button}
          >
            <XIcon></XIcon>
          </a>
        </div>
      </header>
      <PresetControls
        controls={controls}
        controlsAPI={controlsAPI}
        lang={lang}
      />
      <ResizableWindow
        disableMove
        size={canvasInfo}
        onResize={(size) => {
          setCanvasInfo({
            ...size,
            dpr: window.devicePixelRatio,
          });
          centerizeCanvasWindow();
        }}
        onMove={(pos) => {
          stateRef.current.canvasPos = pos;
        }}
        ctrlRef={(ref) => {
          stateRef.current.canvasWindowCtrlRef = ref;
        }}
      >
        <div className={clsx(styles.canvasContainer)}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={
              {
                ['--dpr']: canvasInfo.dpr,
              } as CSSProperties
            }
          />
          {controls.editorMode && (
            <EditorMode
              shapes={editorShapes}
              onShapesChange={setEditorShapes}
              selectedShapeId={selectedShapeId}
              onSelectShape={setSelectedShapeId}
              canvasWidth={canvasInfo.width}
              canvasHeight={canvasInfo.height}
              lang={lang}
            />
          )}
        </div>
      </ResizableWindow>
    </>
  );
}

export default App;

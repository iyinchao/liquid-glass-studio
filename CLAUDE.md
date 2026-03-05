# Liquid Glass Studio - Claude Code Agent Instructions

## Project Overview

Liquid Glass Studio is a WebGL2/WebGPU-powered recreation of Apple's Liquid Glass UI effects. It renders real-time glass effects using custom GLSL/WGSL shaders with a React + TypeScript frontend.

**Stack**: React 18, TypeScript, Vite, SCSS Modules, Leva (controls UI), react-spring

## Architecture

```
src/
  App.tsx                     # Main app: canvas setup, render loop, texture management
  Controls.tsx                # All UI control parameters (Leva-based)
  main.tsx                    # Entry point
  components/
    EditorMode/               # Multi-shape editor with drag/resize
    PresetControls/           # Preset buttons and showcase animation triggers
    ResizableWindow/          # Draggable/resizable canvas container
    LevaButton/               # Custom Leva button component
    LevaCheckButtons/         # Custom Leva toggle buttons
    LevaContainer/            # Custom Leva container for bg selector
    LevaVectorNew/            # Custom Leva 2D vector input
  shaders/
    vertex.glsl               # Shared vertex shader (WebGL2)
    fragment-bg.glsl          # Background pass: renders bg + shadow + text SDF
    fragment-bg-vblur.glsl    # Vertical Gaussian blur pass
    fragment-bg-hblur.glsl    # Horizontal Gaussian blur pass
    fragment-main.glsl        # Main composite pass: refraction, fresnel, glare, tint, HDR
    wgsl/                     # WebGPU equivalents of all shaders
  utils/
    GLUtils.ts                # WebGL2 multi-pass renderer, texture loading
    WebGPURenderer.ts         # WebGPU multi-pass renderer
    WebGPUTextureUtils.ts     # WebGPU texture helpers
    presetUtils.ts            # 8 built-in presets, import/export functions
    showcaseAnimations.ts     # 5 keyframe-animated demo sequences
    textSDF.ts                # SDF text generation from canvas
    uiContentRenderer.ts      # Clock/weather/music/text canvas rendering
    hdrLoader.ts              # .hdr file parser
    languages.ts              # i18n strings (en-US, zh-CN, uz-UZ)
```

## Rendering Pipeline

4-pass multipass pipeline:
1. **bgPass**: Renders background (pattern/image/video/HDR), shadow, and text SDF
2. **vBlurPass**: Vertical Gaussian blur of bgPass output
3. **hBlurPass**: Horizontal Gaussian blur of vBlurPass output
4. **mainPass**: Final composite - refraction, dispersion, fresnel, glare, tint, emissive, HDR tone mapping, UI content

## Key Shader Uniforms (fragment-main.glsl)

### Refraction
| Uniform | Type | Description |
|---------|------|-------------|
| `u_refThickness` | float | Glass edge depth (1-80) |
| `u_refFactor` | float | Index of refraction (1-4) |
| `u_refDispersion` | float | Chromatic aberration (0-50) |
| `u_refFresnelRange` | float | Fresnel reflection extent (0-100) |
| `u_refFresnelHardness` | float | Fresnel edge sharpness (0-1, mapped from 0-100) |
| `u_refFresnelFactor` | float | Fresnel highlight intensity (0-1, mapped from 0-100) |

### Glare
| Uniform | Type | Description |
|---------|------|-------------|
| `u_glareRange` | float | Glare extent from edges (0-100) |
| `u_glareHardness` | float | Glare falloff sharpness (0-1) |
| `u_glareFactor` | float | Overall glare brightness (0-1.2) |
| `u_glareConvergence` | float | Glare concentration (0-1) |
| `u_glareOppositeFactor` | float | Far-side glare brightness (0-1) |
| `u_glareAngle` | float | Light direction in radians |

### Visual
| Uniform | Type | Description |
|---------|------|-------------|
| `u_tint` | vec4 | RGBA color overlay inside glass |
| `u_blurEdge` | int | 1 = uniform blur, 0 = depth-faded blur |
| `u_emissiveColor` | vec3 | Self-illumination color (0-1 per channel) |
| `u_emissiveIntensity` | float | Glow strength (0-1) |
| `u_emissivePulse` | float | Pulse animation factor (0-1, sine-driven) |

### HDR
| Uniform | Type | Description |
|---------|------|-------------|
| `u_hdrEnabled` | int | Enable tone mapping |
| `u_exposure` | float | Brightness multiplier (0.1-10) |
| `u_toneMappingType` | int | 0=None, 1=Reinhard, 2=ACES Filmic |
| `u_bloom` | float | HDR bloom intensity (0-1) |

### Shape System
| Uniform | Type | Description |
|---------|------|-------------|
| `u_shapeCount` | int | Number of editor shapes (0 = legacy follow mode) |
| `u_shapes[8]` | vec4[] | Per-shape: x, y, width, height |
| `u_shapeParams[8]` | vec4[] | Per-shape: radius, roundness, shapeType, unused |
| `u_mergeRate` | float | Smooth union blend factor (0-0.3) |

Shape types: 0=rect, 1=circle, 2=triangle, 3=star, 4=hexagon

## Creating New Glass Presets

Add to `BUILT_IN_PRESETS` array in `src/utils/presetUtils.ts`:

```typescript
{
  id: 'myPreset',
  values: {
    refThickness: 20,
    refFactor: 1.4,
    refDispersion: 7,
    refFresnelRange: 30,
    refFresnelHardness: 20,
    refFresnelFactor: 20,
    glareRange: 30,
    glareHardness: 20,
    glareFactor: 90,
    glareConvergence: 50,
    glareOppositeFactor: 80,
    glareAngle: -45,
    blurRadius: 1,
    blurEdge: true,
    tint: { r: 255, g: 255, b: 255, a: 0 },
    shadowExpand: 25,
    shadowFactor: 15,
  },
}
```

The `GlassPresetValues` type defines exactly which fields a preset can set. All are required.

## Common Design Workflows

### "Frosted card" effect
- High `blurRadius` (30-60), low `refFactor` (1.05-1.2), `blurEdge: true`
- Light tint with low alpha: `{ r: 240, g: 245, b: 255, a: 0.05 }`
- Low dispersion (0-3)

### "Crystal/diamond" effect
- High `refFactor` (1.8-2.5), high `refDispersion` (20-50)
- No blur (`blurRadius: 1`), `blurEdge: false`
- High glare values, especially `glareFactor` and `glareHardness`

### "Glowing glass" effect
- Set `emissiveIntensity` > 0, choose `emissiveColor`
- Enable `emissivePulse` for animation
- Works well with slight tint and moderate blur

### "Dark glass" (obsidian-like)
- Dark tint with high alpha: `{ r: 20, g: 20, b: 30, a: 0.5 }`
- High `refFresnelFactor` (50-70) for bright edge reflections
- Low `glareRange`, high `glareHardness`

## Adding New Shape Types

1. Add SDF function in `src/shaders/fragment-main.glsl` (and WGSL equivalent)
2. Add type to `shapeSDF()` dispatch function with new type index
3. Add to `ShapeType` union and `SHAPE_TYPES` array in `src/components/EditorMode/EditorMode.tsx`
4. Add index to `SHAPE_TYPE_INDEX` map

## Project Commands

```bash
pnpm install    # Install dependencies
pnpm dev        # Dev server (Vite)
pnpm build      # Production build
```

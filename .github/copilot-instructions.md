# Liquid Glass Studio - Copilot Instructions

WebGL2/WebGPU real-time glass effect renderer (Apple Liquid Glass UI). React 18 + TypeScript + Vite + GLSL shaders.

## Key Files

- `src/App.tsx` — Main render loop, canvas, texture management
- `src/Controls.tsx` — All UI control parameters (Leva)
- `src/utils/presetUtils.ts` — 8 built-in presets, import/export
- `src/shaders/fragment-main.glsl` — Main shader (refraction, fresnel, glare, tint, HDR, emissive)
- `src/shaders/wgsl/` — WebGPU shader equivalents
- `src/components/EditorMode/` — Multi-shape editor (drag/resize, 5 shape types)
- `src/utils/GLUtils.ts` — WebGL2 renderer
- `src/utils/WebGPURenderer.ts` — WebGPU renderer

## Pipeline

4-pass: bgPass → vBlurPass → hBlurPass → mainPass (composite to screen).

## Glass Parameters

**Refraction**: refThickness (1-80), refFactor (1-4, IOR), refDispersion (0-50, chromatic aberration)
**Fresnel**: refFresnelRange/Hardness/Factor (0-100 each)
**Glare**: glareRange/Hardness (0-100), glareFactor (0-120), glareConvergence/OppositeFactor (0-100), glareAngle (-180 to 180 degrees)
**Blur**: blurRadius (1-200), blurEdge (bool)
**Tint**: RGBA overlay. Shadow: shadowExpand (2-100), shadowFactor (0-100)
**Emissive**: emissiveColor (RGB), emissiveIntensity (0-100), emissivePulse (bool)
**HDR**: hdrEnabled, hdrExposure (0.1-10), hdrToneMappingType (0=None, 1=Reinhard, 2=ACES), hdrBloom (0-1)
**Shapes**: width/height (20-800), radius (1-100), roundness (2-7), mergeRate (0-0.3). Types: rect(0), circle(1), triangle(2), star(3), hexagon(4)

## Preset Creation

Add to `BUILT_IN_PRESETS` in `src/utils/presetUtils.ts`. All `GlassPresetValues` fields required: refThickness, refFactor, refDispersion, refFresnelRange/Hardness/Factor, glareRange/Hardness/Factor/Convergence/OppositeFactor/Angle, blurRadius, blurEdge, tint, shadowExpand/Factor.

## Design Recipes

- **Frosted**: blurRadius 30-60, refFactor ~1.1, light tint alpha ~0.05
- **Crystal**: refFactor 2+, dispersion 20-50, no blur, high glare
- **Glow**: emissiveIntensity > 0, emissivePulse for animation
- **Dark**: tint alpha 0.4-0.6 with dark RGB, high fresnel

## New Shape Types

1. Add SDF in `fragment-main.glsl` + `wgsl/fragment-main.wgsl`
2. Add case in `shapeSDF()` dispatch
3. Add to `ShapeType`, `SHAPE_TYPES`, `SHAPE_TYPE_INDEX` in `EditorMode.tsx`

## Commands

```bash
pnpm install && pnpm dev    # Development
pnpm build                  # Production
```

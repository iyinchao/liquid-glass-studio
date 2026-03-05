# 🔮 Liquid Glass Studio

![frontPhoto](./.github/assets/title.png)

[English](README.md) | [简体中文](README-zh.md) | [O‘zbekcha](README-uz.md)

The Ultimate Web Recreation of Apple’s Liquid Glass UI, powered by WebGL2 and shaders. Includes most Liquid Glass features with fine-grained controls for detailed customization.

## Online Demo

https://liquid-glass-studio.vercel.app/

For users in mainland China, please visit:  
https://liquid-glass.iyinchao.cn/

## ScreenShots

<table align="center">
  <tr>
    <td><img src="./.github/assets/title-video.gif" width="240" ></td>
    <td><img src="./.github/assets/screen-shot-1.png" width="240" /></td>
    <td><img src="./.github/assets/screen-shot-2.png" width="240" /></td>
  </tr>
  <tr>
    <td><img src="./.github/assets/screen-shot-3.png" width="240" /></td>
    <td><img src="./.github/assets/screen-shot-4.png" width="240" /></td>
  </tr>
</table>

## Features

**Apple Liquid Glass Effects:**

- Refraction
- Dispersion
- Fresnel reflection
- Superellipse shapes
- Blob effect (shape merging)
- Glare with customizable angle
- Gaussian blur masking
- Anti-aliasing

**Rendering:**

- WebGL2-based rendering for high-performance graphics
- WebGPU rendering backend with toggle and FPS overlay
- HDR illumination with tone mapping
- SDF text rendering with glass effect
- Self-illumination / emissive glow

**Interactive Controls:**

- Comprehensive real-time parameter adjustments via an intuitive UI
- 8 built-in glass presets
- Editor mode with multiple shapes (circle, triangle, star, hexagon, ellipse)
- UI content inside glass shapes
- Showcase animations with 5 animated demos

**Background Options:**

- Support for both images and videos as dynamic backgrounds

**Animation Support:**

- Spring-based shape animations with configurable behavior

## Technical Highlights

- Multipass rendering for high-quality & performant Gaussian blur
- SDF-defined shapes and smooth merge function
- Custom shader implementations for realistic glass effects
- Custom Leva UI components for intuitive parameter controls

## Getting Started

### Prerequisites

- Node.js (latest LTS version recommended)
- pnpm package manager

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Usage Guide

### Glass Presets

Click the preset buttons in the top bar to instantly switch between 8 built-in glass styles:

| Preset | Character | Key Traits |
|--------|-----------|------------|
| **Crystal Clear** | Transparent, sharp refraction | High refFactor (1.52), low blur, strong glare |
| **Frosted Glass** | Blurred, diffused | High blur (45), low refraction, soft glare |
| **Tinted Window** | Colored transparency | Blue tint (rgba 80,160,220,0.2), moderate blur |
| **Diamond** | Brilliant, prismatic | Very high refFactor (2.42), high dispersion (38), no blur |
| **Water Drop** | Subtle, natural | refFactor 1.33 (water), light blue tint, edge blur |
| **Soap Bubble** | Thin, iridescent | Very thin (3), extreme dispersion (45), high fresnel |
| **Ice** | Semi-frozen, crystalline | Blue tint (0.15 alpha), moderate blur (12), hard glare |
| **Obsidian** | Dark, reflective | Dark tint (0.55 alpha), thick (40), high fresnel factor |

Each preset modifies glass-related shader parameters only (refraction, glare, blur, tint, shadow). Shape, animation, and debug settings remain unchanged.

### Editor Mode

1. Toggle **Editor Mode** in Basic Settings
2. A default rectangle shape appears at the center of the canvas
3. **Add shapes** using the **+** button in the editor toolbar (max 8)
4. **Select** a shape by clicking it; a blue outline and resize handles appear
5. **Drag** shapes by clicking and dragging inside the selection
6. **Resize** shapes by dragging the corner/edge handles (nw, n, ne, e, se, s, sw, w)
7. **Delete** the selected shape using the trash icon

**Per-shape controls** (visible when a shape is selected):
- **Type**: Rectangle, Circle, Triangle, Star, Hexagon
- **Radius**: Corner radius (for rectangles) or size factor (0-100)
- **Roundness**: Superellipse exponent (2 = ellipse, 5 = default squircle, 7 = near-rectangle)

Shapes merge together via the **Merge Rate** slider (Shape Settings), creating smooth blob-like unions.

### Glass Effect Controls

**Refraction**
- **Ref Thickness** (1-80): How deep light travels through the glass edge. Higher = wider refraction zone
- **Ref Factor** (1-4): Index of refraction. 1.0 = no bending, 1.33 = water, 1.52 = glass, 2.42 = diamond
- **Ref Dispersion** (0-50): Chromatic aberration strength. Separates R/G/B channels at edges

**Fresnel Reflection**
- **Fresnel Range** (0-100): How far inward the fresnel reflection extends
- **Fresnel Hardness** (0-100): Sharpness of the fresnel edge falloff
- **Fresnel Factor** (0-100): Intensity of the fresnel white highlight

**Glare**
- **Glare Range** (0-100): How far inward the glare extends from edges
- **Glare Hardness** (0-100): Sharpness of the glare falloff
- **Glare Factor** (0-120): Overall glare brightness
- **Glare Convergence** (0-100): How concentrated the glare is along the light angle
- **Glare Opposite Factor** (0-100): Brightness of glare on the far side from the light
- **Glare Angle** (-180 to 180): Direction of the simulated light source in degrees

**Blur**
- **Blur Radius** (1-200): Gaussian blur strength applied to the background behind glass
- **Blur Edge**: When enabled, applies full blur uniformly; when disabled, blur fades toward center

**Tint & Shadow**
- **Tint**: RGBA color overlay applied inside the glass shape
- **Shadow Expand** (2-100): Size of the drop shadow behind the shape
- **Shadow Factor** (0-100): Darkness/opacity of the shadow
- **Shadow Position**: X/Y offset of the shadow

### Text Rendering

1. Open **Text Settings** (collapsed by default)
2. Toggle **Text Enabled** to render SDF text as a glass shape
3. Set **Text Content** to any string (default: "Glass")
4. Adjust **Text Size** (20-500px) and pick a **Font** (Arial, Helvetica, Georgia, etc.)
5. **Super Sample** (1-4): Higher values produce smoother SDF edges at the cost of performance

The text shape merges with other glass shapes via the same Merge Rate slider. Text + shape combinations create complex glass typography effects.

### Self-Illumination

Open **Self-Illumination** settings (collapsed by default):

- **Emissive Color**: The glow color (default warm white: 255, 220, 200)
- **Emissive Intensity** (0-100): Glow brightness. 0 = off
- **Emissive Pulse**: Toggles a sine-wave animation that pulses the glow intensity over time

The emissive effect is depth-aware -- it's stronger toward the center of the glass shape and fades toward edges.

### HDR Illumination

Open **HDR Settings** (collapsed by default):

1. **HDR Enabled**: Activates tone mapping and exposure controls
2. **HDR Exposure** (0.1-10.0): Brightness multiplier applied before tone mapping
3. **Tone Mapping Type**:
   - **None**: Raw linear output
   - **Reinhard**: Simple x/(1+x) mapping, preserves detail in highlights
   - **ACES Filmic**: Cinematic S-curve, richer contrast and color
4. **HDR Bloom** (0-1.0): Extracts pixels brighter than 1.0 and adds soft glow

To use HDR environments: upload a `.hdr` file via the custom background upload button. The app auto-enables HDR mode and sets ACES tone mapping.

### WebGPU Backend

1. Open **Debug Settings** (collapsed by default)
2. Toggle **WebGPU** on (requires a browser with WebGPU support like Chrome 113+)
3. The FPS overlay in the bottom-right of the canvas shows: backend name (WebGPU/WebGL2), FPS, and frame time in ms
4. If WebGPU initialization fails, the app automatically falls back to WebGL2

### UI Content

Open **UI Content Settings** (collapsed by default):

1. Toggle **UI Content Enabled**
2. Choose a **Content Type**:
   - **Clock**: Displays a live digital clock
   - **Weather**: Shows a weather widget
   - **Music Player**: Renders a music player UI
   - **Custom Text**: Displays your own text string
3. Adjust **UI Content Text** for custom text mode
4. **UI Content Opacity** (0-100): Transparency of the content rendered inside the glass

Content is rendered to a 2D canvas, uploaded as a texture, and composited inside the glass shape with refraction-aware UV distortion.

### Showcase Animations

Click the **play** icons in the top bar to run animated demos:

| Demo | Duration | Description |
|------|----------|-------------|
| **Rainbow Prism** | 8s | Rotates glare angle with shifting dispersion and tint colors |
| **Shape Morph** | 10s | Animates shape dimensions and roundness through various forms |
| **Glow Pulse** | 6s | Cycles emissive colors and intensities with changing blur |
| **Diamond Sparkle** | 8s | Diamond preset with rotating glare and mouse position |
| **Frost Melt** | 6s | Transitions from heavy frost blur to clear refraction and back |

Animations loop continuously. Click the stop button to return to your previous settings. Your parameter state is preserved and restored when the showcase ends.

### Background Options

Select backgrounds from the visual grid in the control panel:

- **Built-in patterns**: Grid, bars, half-tone, and other test patterns
- **Photos**: Tahoe landscape, buildings, Tim Cook, UI mockup, text sample
- **Videos**: Fish tank, traffic, flowers (auto-play with loop)
- **Custom upload**: Click the upload icon to load your own image, video, or `.hdr` file

### Import / Export

- **Export**: Use the export functionality to save your current parameter configuration as a `liquid-glass-preset.json` file
- **Import**: Load a previously saved `.json` preset file to restore all parameters

Preset files include all control values, a version string, and a timestamp.

## TODO

- [x] More Glare Controls (hardness / color / size etc.)
- [x] Custom Background
- [x] Render with WebGPU
- [x] Editor mode
- [x] Glass Text Rendering
- [x] Glass Presets
- [x] Self-illumination
- [x] HDR illumination
- [x] Control parameter import / export
- [x] Render Step view to show intermediate results
- [x] UI Content inside of shape

## Contributors

- [@Hmz1hb](https://github.com/Hmz1hb)

## Credits

Thanks to the following resources and inspirations:

- [SDF functions](https://iquilezles.org/articles/distfunctions2d/) and [smooth merge function](https://iquilezles.org/articles/smin/) by [Inigo Quilez](https://iquilezles.org/)
- Sample photo (Buildings) by <a href="https://unsplash.com/@anewevisual?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Adrian Newell</a> on <a href="https://unsplash.com/photos/a-row-of-multicolored-houses-on-a-street-UtfxJZ-uy5Q?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Unsplash</a>
- Sample video (Fish / Traffic) by Tom Fisk from [Pexels](https://www.pexels.com/video/light-city-road-traffic-4062991/)
- Sample video (Flower) by Pixabay from [Pexels](https://www.pexels.com/video/orange-flowers-856383/)
- Sample Photo by Apple and Tim Cook

## License

[MIT License](LICENSE)

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

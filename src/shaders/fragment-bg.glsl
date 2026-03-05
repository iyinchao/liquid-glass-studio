#version 300 es

precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_dpr;
uniform vec2 u_mouse;
uniform vec2 u_mouseSpring;
uniform float u_time;
uniform float u_mergeRate;
uniform float u_shapeWidth;
uniform float u_shapeHeight;
uniform float u_shapeRadius;
uniform float u_shapeRoundness;
uniform float u_shadowExpand;
uniform float u_shadowFactor;
uniform vec2 u_shadowPosition;
uniform int u_bgType;
uniform sampler2D u_bgTexture;
uniform float u_bgTextureRatio;
uniform int u_bgTextureReady;
uniform int u_showShape1;

uniform int u_shapeCount;
uniform vec4 u_shapes[8]; // x, y, width, height per shape
uniform vec4 u_shapeParams[8]; // radius, roundness, shapeType, unused per shape

uniform sampler2D u_textSDF;
uniform int u_textEnabled;
uniform float u_textScale;

float chessboard(vec2 uv, float size, int mode) {
  float yBars = step(size * 2.0, mod(uv.y * 2.0, size * 4.0));
  float xBars = step(size * 2.0, mod(uv.x * 2.0, size * 4.0));

  if (mode == 0) {
    return yBars;
  } else if (mode == 1) {
    return xBars;
  } else {
    return abs(yBars - xBars);
  }
}

float halfColor(vec2 uv) {
  if (uv.y > 0.5) {
    return 1.0;
  } else {
    return 0.0;
  }
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float superellipseCornerSDF(vec2 p, float r, float n) {
  p = abs(p);
  float v = pow(pow(p.x, n) + pow(p.y, n), 1.0 / n);
  return v - r;
}

float roundedRectSDF(vec2 p, vec2 center, float width, float height, float cornerRadius, float n) {
  // 移动到中心坐标系
  p -= center;

  float cr = cornerRadius * u_dpr;

  // 计算到矩形边缘的距离
  vec2 d = abs(p) - vec2(width * u_dpr, height * u_dpr) * 0.5;

  // 对于边缘区域和角落，我们需要不同的处理
  float dist;

  if (d.x > -cr && d.y > -cr) {
    // 角落区域
    vec2 cornerCenter = sign(p) * (vec2(width * u_dpr, height * u_dpr) * 0.5 - vec2(cr));
    vec2 cornerP = p - cornerCenter;
    dist = superellipseCornerSDF(cornerP, cr, n);
  } else {
    // 内部和边缘区域
    dist = min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }

  return dist;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdEllipse(vec2 p, vec2 r) {
  vec2 k = p / r;
  return (length(k) - 1.0) * min(r.x, r.y);
}

float sdTriangle(vec2 p, float r) {
  const float k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

float sdStar(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float shapeSDF(vec2 pn, float shapeW, float shapeH, float shapeR, float shapeN, int shapeType) {
  float rY = u_resolution.y;
  if (shapeType == 1) {
    return sdEllipse(pn, vec2(shapeW * u_dpr * 0.5, shapeH * u_dpr * 0.5) / rY);
  } else if (shapeType == 2) {
    float s = min(shapeW, shapeH) * u_dpr * 0.5 / rY;
    return sdTriangle(pn, s);
  } else if (shapeType == 3) {
    float s = min(shapeW, shapeH) * u_dpr * 0.5 / rY;
    return sdStar(pn, s, 0.45);
  } else if (shapeType == 4) {
    float s = min(shapeW, shapeH) * u_dpr * 0.5 / rY;
    return sdHexagon(pn, s);
  } else {
    return roundedRectSDF(pn, vec2(0.0), shapeW / rY, shapeH / rY, shapeR / rY, shapeN);
  }
}

float sdgMin(float a, float b) {
  return a < b
    ? a
    : b;
}

float mainSDF(vec2 p1, vec2 p2, vec2 p) {
  float d;
  if (u_shapeCount > 0) {
    float result = 1.0;
    bool hasShape = false;
    for (int i = 0; i < 8; i++) {
      if (i >= u_shapeCount) break;
      vec2 shapeCenter = vec2(u_shapes[i].x, u_shapes[i].y);
      float shapeW = u_shapes[i].z;
      float shapeH = u_shapes[i].w;
      float shapeR = u_shapeParams[i].x;
      float shapeN = u_shapeParams[i].y;
      int shapeType = int(u_shapeParams[i].z);
      vec2 pn = (-shapeCenter) / u_resolution.y + p / u_resolution.y;
      float dd = shapeSDF(pn, shapeW, shapeH, shapeR, shapeN, shapeType);
      if (!hasShape) {
        result = dd;
        hasShape = true;
      } else {
        result = smin(result, dd, u_mergeRate);
      }
    }
    d = result;
  } else {
    vec2 p1n = p1 + p / u_resolution.y;
    vec2 p2n = p2 + p / u_resolution.y;
    float d1 = u_showShape1 == 1 ? sdCircle(p1n, 100.0 * u_dpr / u_resolution.y) : 1.0;
    float d2 = roundedRectSDF(
      p2n,
      vec2(0.0),
      u_shapeWidth / u_resolution.y,
      u_shapeHeight / u_resolution.y,
      u_shapeRadius / u_resolution.y,
      u_shapeRoundness
    );

    d = smin(d1, d2, u_mergeRate);
  }

  if (u_textEnabled == 1) {
    vec2 uv = p / u_resolution.xy;
    uv.y = 1.0 - uv.y;
    float textSample = texture(u_textSDF, uv).r;
    float textDist = (textSample - 0.5) * u_textScale / u_resolution.y;
    d = smin(d, textDist, u_mergeRate);
  }

  return d;
}

// 输入：原始 uv、canvas 宽高比、纹理宽高比
// 输出：变换后的 uv，可直接用于 texture 采样
vec2 getCoverUV(vec2 uv, float canvasAspect, float textureAspect) {
  if (canvasAspect > textureAspect) {
    // canvas 更宽，纹理竖向拉伸
    float scale = textureAspect / canvasAspect;
    uv.y = uv.y * scale + 0.5 - 0.5 * scale;
  } else {
    // canvas 更高，纹理横向拉伸
    float scale = canvasAspect / textureAspect;
    uv.x = uv.x * scale + 0.5 - 0.5 * scale;
  }
  return uv;
}

void main() {
  vec2 u_resolution1x = u_resolution.xy / u_dpr;
  // float chessboardBg = chessboard(gl_FragCoord.xy, 14.0);
  vec3 bgColor = vec3(1.0);

  if (u_bgType <= 0) {
    // chessboard
    bgColor = vec3(1.0 - chessboard(gl_FragCoord.xy / u_dpr, 20.0, 2) / 4.0);
  } else if (u_bgType <= 1) {
    if (v_uv.x < 0.5 && v_uv.y > 0.5) {
      bgColor = vec3(chessboard(gl_FragCoord.xy / u_dpr, 10.0, 0));
    } else if (v_uv.x > 0.5 && v_uv.y < 0.5) {
      bgColor = vec3(chessboard(gl_FragCoord.xy / u_dpr, 10.0, 1));
    } else if (v_uv.x < 0.5 && v_uv.y < 0.5) {
      bgColor = vec3(0.0);
    }
  } else if (u_bgType <= 2) {
    bgColor = vec3(halfColor(gl_FragCoord.xy / u_resolution) * 0.6 + 0.3);
  } else if (u_bgType <= 11) {
    if (u_bgTextureReady != 1) {
      // chessboard
      bgColor = vec3(1.0 - chessboard(gl_FragCoord.xy / u_dpr, 20.0, 2) / 4.0);
    } else {
      vec2 uv = getCoverUV(v_uv, u_resolution.x / u_resolution.y, u_bgTextureRatio);

      // 不需要判断越界，CLAMP_TO_EDGE 会自动处理
      bgColor = texture(u_bgTexture, uv).rgb;
    }
  }

  // float chessboardBg = 1.0 - chessboard(gl_FragCoord.xy / u_dpr, 10.0) / 4.0;
  // float halfColorBg = halfColor(gl_FragCoord.xy / u_resolution);

  // draw shadow
  // center of shape 1
  vec2 p1 =
    (vec2(0, 0) -
      u_resolution.xy * 0.5 +
      vec2(u_shadowPosition.x * u_dpr, u_shadowPosition.y * u_dpr)) /
    u_resolution.y;
  // center of shape 2
  vec2 p2 =
    (vec2(0, 0) - u_mouseSpring + vec2(u_shadowPosition.x * u_dpr, u_shadowPosition.y * u_dpr)) /
    u_resolution.y;
  // merged shape
  float merged = mainSDF(p1, p2, gl_FragCoord.xy);

  float shadow = exp(-1.0 / u_shadowExpand * abs(merged) * u_resolution1x.y) * 0.6 * u_shadowFactor;

  fragColor = vec4(bgColor - vec3(shadow), 1.0);
}

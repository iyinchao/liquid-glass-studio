/**
 * Generates a distance field texture from rendered text.
 *
 * Approach:
 * 1. Render text to an offscreen canvas using Canvas 2D API
 * 2. Extract the alpha channel as a binary mask
 * 3. Compute a distance field using a dead-reckoning distance transform
 * 4. Return a Uint8Array suitable for WebGL texture upload (single-channel R8)
 */

export const SDF_RANGE = 128; // max distance in pixels stored in the SDF
export const SDF_SUPERSAMPLE_DEFAULT = 2; // default render SDF at Nx screen resolution

interface TextSDFResult {
  data: Float32Array;
  width: number;
  height: number;
}

/**
 * Simple 2-pass (row + column) Euclidean distance transform.
 * Computes squared distances, then takes sqrt at the end.
 */
function computeDistanceField(
  mask: Uint8Array,
  width: number,
  height: number,
  inside: boolean,
): Float32Array {
  const INF = 1e10;
  const size = width * height;
  const dist = new Float32Array(size);

  // Initialize: 0 for target pixels, INF for background
  for (let i = 0; i < size; i++) {
    const isTarget = inside ? mask[i] > 127 : mask[i] <= 127;
    dist[i] = isTarget ? 0 : INF;
  }

  // 1D squared distance transform along a row/column
  // Uses the Felzenszwalb & Huttenlocher parabola method
  const f = new Float32Array(Math.max(width, height));
  const v = new Int32Array(Math.max(width, height));
  const z = new Float32Array(Math.max(width, height) + 1);
  const d = new Float32Array(Math.max(width, height));

  function dt1d(source: Float32Array, offset: number, stride: number, length: number) {
    for (let q = 0; q < length; q++) {
      f[q] = source[offset + q * stride];
    }

    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    let k = 0;

    for (let q = 1; q < length; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }

    k = 0;
    for (let q = 0; q < length; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }

    for (let q = 0; q < length; q++) {
      source[offset + q * stride] = d[q];
    }
  }

  // Transform columns
  for (let x = 0; x < width; x++) {
    dt1d(dist, x, width, height);
  }

  // Transform rows
  for (let y = 0; y < height; y++) {
    dt1d(dist, y * width, 1, width);
  }

  // Take sqrt
  for (let i = 0; i < size; i++) {
    dist[i] = Math.sqrt(dist[i]);
  }

  return dist;
}

export function generateTextSDF(
  text: string,
  fontSize: number,
  fontFamily: string,
  canvasWidth: number,
  canvasHeight: number,
  supersample: number = SDF_SUPERSAMPLE_DEFAULT,
): TextSDFResult {
  // Supersample for higher resolution SDF
  const sdfW = canvasWidth * supersample;
  const sdfH = canvasHeight * supersample;
  const sdfFontSize = fontSize * supersample;

  // Create offscreen canvas at supersampled resolution
  const canvas = document.createElement('canvas');
  canvas.width = sdfW;
  canvas.height = sdfH;
  const ctx = canvas.getContext('2d')!;

  // Clear to transparent
  ctx.clearRect(0, 0, sdfW, sdfH);

  // Render text centered
  ctx.fillStyle = 'white';
  ctx.font = `bold ${sdfFontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, sdfW / 2, sdfH / 2);

  // Extract alpha channel as mask
  const imageData = ctx.getImageData(0, 0, sdfW, sdfH);
  const pixels = imageData.data;
  const size = sdfW * sdfH;
  const mask = new Uint8Array(size);

  for (let i = 0; i < size; i++) {
    mask[i] = pixels[i * 4 + 3]; // alpha channel
  }

  // Compute distance fields for inside and outside
  const outsideDist = computeDistanceField(mask, sdfW, sdfH, false);
  const insideDist = computeDistanceField(mask, sdfW, sdfH, true);

  // Combine into signed distance field as float (full precision)
  // 0.5 = on the boundary, >0.5 = outside, <0.5 = inside
  const sdfData = new Float32Array(size);
  const sdfRange = SDF_RANGE * supersample;
  for (let i = 0; i < size; i++) {
    const signedDist = insideDist[i] - outsideDist[i];
    sdfData[i] = Math.max(0, Math.min(1, 0.5 + signedDist / (2 * sdfRange)));
  }

  return {
    data: sdfData,
    width: sdfW,
    height: sdfH,
  };
}

/**
 * Creates or updates a WebGL texture from SDF data.
 */
export function uploadTextSDFTexture(
  gl: WebGL2RenderingContext,
  sdfResult: TextSDFResult,
  existingTexture?: WebGLTexture | null,
): WebGLTexture {
  const texture = existingTexture ?? gl.createTexture()!;

  // Enable linear filtering for float textures (required by WebGL2)
  gl.getExtension('OES_texture_float_linear');

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R32F,
    sdfResult.width,
    sdfResult.height,
    0,
    gl.RED,
    gl.FLOAT,
    sdfResult.data,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

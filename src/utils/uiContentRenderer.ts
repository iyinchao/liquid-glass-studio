export type UIContentType = 'clock' | 'weather' | 'music' | 'custom-text';

export function createUIContentCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function renderUIContent(
  canvas: HTMLCanvasElement,
  type: UIContentType,
  options?: { text?: string }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Clear with transparent
  ctx.clearRect(0, 0, w, h);

  switch (type) {
    case 'clock':
      renderClock(ctx, w, h);
      break;
    case 'weather':
      renderWeather(ctx, w, h);
      break;
    case 'music':
      renderMusic(ctx, w, h);
      break;
    case 'custom-text':
      renderCustomText(ctx, w, h, options?.text ?? 'Hello');
      break;
  }
}

function renderClock(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  const secStr = seconds;

  const cx = w / 2;
  const cy = h / 2;

  // Main time
  const fontSize = Math.min(w, h) * 0.18;
  ctx.font = `300 ${fontSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillText(timeStr, cx, cy - fontSize * 0.15);

  // Seconds
  const secFontSize = fontSize * 0.35;
  ctx.font = `300 ${secFontSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(secStr, cx, cy + fontSize * 0.45);

  // Date
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const dateFontSize = fontSize * 0.22;
  ctx.font = `400 ${dateFontSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(dateStr, cx, cy + fontSize * 0.75);
}

function renderWeather(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const baseSize = Math.min(w, h) * 0.12;

  // Sun icon (simple circle + rays)
  const sunR = baseSize * 0.5;
  const sunCx = cx;
  const sunCy = cy - baseSize * 0.8;
  ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
  ctx.beginPath();
  ctx.arc(sunCx, sunCy, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Rays
  ctx.strokeStyle = 'rgba(255, 220, 100, 0.7)';
  ctx.lineWidth = sunR * 0.15;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const innerR = sunR * 1.4;
    const outerR = sunR * 1.9;
    ctx.beginPath();
    ctx.moveTo(sunCx + Math.cos(angle) * innerR, sunCy + Math.sin(angle) * innerR);
    ctx.lineTo(sunCx + Math.cos(angle) * outerR, sunCy + Math.sin(angle) * outerR);
    ctx.stroke();
  }

  // Temperature
  const tempFontSize = baseSize * 1.5;
  ctx.font = `200 ${tempFontSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillText('72°', cx, cy + baseSize * 1.0);

  // Label
  const labelFontSize = baseSize * 0.35;
  ctx.font = `400 ${labelFontSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('Sunny', cx, cy + baseSize * 1.8);
}

function renderMusic(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const baseSize = Math.min(w, h) * 0.1;

  // Album art placeholder (rounded rect)
  const artSize = baseSize * 2.5;
  const artX = cx - artSize / 2;
  const artY = cy - baseSize * 2.2;
  const artR = artSize * 0.15;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.roundRect(artX, artY, artSize, artSize, artR);
  ctx.fill();

  // Music note icon inside album art
  const noteSize = artSize * 0.35;
  ctx.font = `${noteSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('\u266B', cx, artY + artSize / 2);

  // Song title
  const titleFontSize = baseSize * 0.45;
  ctx.font = `500 ${titleFontSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText('Bohemian Rhapsody', cx, cy + baseSize * 0.8);

  // Artist
  const artistFontSize = baseSize * 0.35;
  ctx.font = `400 ${artistFontSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('Queen', cx, cy + baseSize * 1.3);

  // Progress bar
  const barW = artSize * 1.2;
  const barH = baseSize * 0.12;
  const barX = cx - barW / 2;
  const barY = cy + baseSize * 1.8;
  const progress = 0.35;

  // Bar background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, barH / 2);
  ctx.fill();

  // Bar progress
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * progress, barH, barH / 2);
  ctx.fill();

  // Time labels
  const timeFontSize = baseSize * 0.25;
  ctx.font = `400 ${timeFontSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'left';
  ctx.fillText('2:05', barX, barY + barH + timeFontSize * 1.5);
  ctx.textAlign = 'right';
  ctx.fillText('5:55', barX + barW, barY + barH + timeFontSize * 1.5);
}

function renderCustomText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string
): void {
  const cx = w / 2;
  const cy = h / 2;

  const fontSize = Math.min(w, h) * 0.1;
  ctx.font = `300 ${fontSize}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

  // Word wrap
  const maxWidth = w * 0.7;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = cy - totalHeight / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, startY + i * lineHeight);
  }
}

/**
 * Upload an HTMLCanvasElement as a WebGL texture.
 * Creates a new texture if none provided, otherwise updates in-place.
 */
export function uploadCanvasTexture(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  existingTexture?: WebGLTexture | null
): WebGLTexture {
  const texture = existingTexture ?? gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    canvas
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

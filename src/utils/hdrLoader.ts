/**
 * Pure TypeScript Radiance HDR (.hdr / RGBE) file parser.
 * No external dependencies.
 */

export interface HDRImageData {
  width: number;
  height: number;
  data: Float32Array; // RGB float data (width * height * 3)
}

export function isHDRFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.hdr');
}

export function loadHDRFile(file: File): Promise<HDRImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseRGBE(reader.result as ArrayBuffer));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read HDR file'));
    reader.readAsArrayBuffer(file);
  });
}

export function parseRGBE(buffer: ArrayBuffer): HDRImageData {
  const bytes = new Uint8Array(buffer);
  let pos = 0;

  // Read header lines
  function readLine(): string {
    let line = '';
    while (pos < bytes.length) {
      const ch = bytes[pos++];
      if (ch === 0x0a) break; // \n
      if (ch !== 0x0d) line += String.fromCharCode(ch); // skip \r
    }
    return line;
  }

  // Validate magic
  const magic = readLine();
  if (!magic.startsWith('#?') && !magic.startsWith('#?RADIANCE')) {
    throw new Error('Not a valid Radiance HDR file');
  }

  // Skip header until empty line
  let format = '';
  while (pos < bytes.length) {
    const line = readLine();
    if (line.length === 0) break;
    if (line.startsWith('FORMAT=')) {
      format = line.substring(7).trim();
    }
  }

  if (format && format !== '32-bit_rle_rgbe' && format !== '32-bit_rle_xyze') {
    throw new Error(`Unsupported HDR format: ${format}`);
  }

  // Parse resolution line: "-Y height +X width"
  const resLine = readLine();
  const resMatch = resLine.match(/^-Y\s+(\d+)\s+\+X\s+(\d+)$/);
  if (!resMatch) {
    throw new Error(`Unsupported HDR resolution string: ${resLine}`);
  }
  const height = parseInt(resMatch[1], 10);
  const width = parseInt(resMatch[2], 10);

  const data = new Float32Array(width * height * 3);

  // Decode scanlines
  for (let y = 0; y < height; y++) {
    const scanline = decodeScanline(bytes, pos, width);
    pos = scanline.newPos;
    const rgbe = scanline.data;

    for (let x = 0; x < width; x++) {
      const si = x * 4;
      const di = (y * width + x) * 3;
      const r = rgbe[si];
      const g = rgbe[si + 1];
      const b = rgbe[si + 2];
      const e = rgbe[si + 3];

      if (e === 0) {
        data[di] = 0;
        data[di + 1] = 0;
        data[di + 2] = 0;
      } else {
        const scale = Math.pow(2, e - 128 - 8);
        data[di] = (r + 0.5) * scale;
        data[di + 1] = (g + 0.5) * scale;
        data[di + 2] = (b + 0.5) * scale;
      }
    }
  }

  return { width, height, data };
}

function decodeScanline(
  bytes: Uint8Array,
  pos: number,
  width: number,
): { data: Uint8Array; newPos: number } {
  // Check for new-style adaptive RLE
  if (
    width >= 8 &&
    width <= 0x7fff &&
    pos + 4 <= bytes.length &&
    bytes[pos] === 2 &&
    bytes[pos + 1] === 2 &&
    ((bytes[pos + 2] << 8) | bytes[pos + 3]) === width
  ) {
    pos += 4;
    const scanline = new Uint8Array(width * 4);

    // Read each of the 4 channels separately (RLE encoded)
    for (let ch = 0; ch < 4; ch++) {
      let x = 0;
      while (x < width) {
        if (pos >= bytes.length) throw new Error('Unexpected end of HDR data');
        const code = bytes[pos++];
        if (code > 128) {
          // Run
          const count = code - 128;
          if (x + count > width) throw new Error('HDR RLE run overflow');
          const val = bytes[pos++];
          for (let i = 0; i < count; i++) {
            scanline[(x + i) * 4 + ch] = val;
          }
          x += count;
        } else {
          // Non-run
          const count = code;
          if (x + count > width) throw new Error('HDR RLE non-run overflow');
          for (let i = 0; i < count; i++) {
            scanline[(x + i) * 4 + ch] = bytes[pos++];
          }
          x += count;
        }
      }
    }

    return { data: scanline, newPos: pos };
  }

  // Old-style (non-RLE or old RLE) — just read raw RGBE pixels
  const scanline = new Uint8Array(width * 4);
  for (let x = 0; x < width; x++) {
    scanline[x * 4] = bytes[pos++];
    scanline[x * 4 + 1] = bytes[pos++];
    scanline[x * 4 + 2] = bytes[pos++];
    scanline[x * 4 + 3] = bytes[pos++];
  }
  return { data: scanline, newPos: pos };
}

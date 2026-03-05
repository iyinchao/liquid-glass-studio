export function createPlaceholderTexture(device: GPUDevice): GPUTexture {
  const texture = device.createTexture({
    size: [1, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4 },
    [1, 1],
  );

  return texture;
}

export async function loadWebGPUTexture(
  device: GPUDevice,
  url: string,
): Promise<{ texture: GPUTexture; ratio: number }> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = url;
  await image.decode();

  const bitmap = await createImageBitmap(image);

  const texture = device.createTexture({
    size: [bitmap.width, bitmap.height],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: bitmap, flipY: true },
    { texture },
    [bitmap.width, bitmap.height],
  );

  const ratio = bitmap.width / bitmap.height;
  bitmap.close();

  return { texture, ratio };
}

export function createWebGPUVideoTexture(
  device: GPUDevice,
  width: number,
  height: number,
): GPUTexture {
  return device.createTexture({
    size: [width, height],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

export function updateWebGPUVideoTexture(
  device: GPUDevice,
  texture: GPUTexture | null,
  video: HTMLVideoElement,
): { texture: GPUTexture; ratio: number } | null {
  if (video.readyState < video.HAVE_CURRENT_DATA) return null;

  const width = video.videoWidth;
  const height = video.videoHeight;

  if (
    !texture ||
    texture.width !== width ||
    texture.height !== height
  ) {
    if (texture) texture.destroy();
    texture = createWebGPUVideoTexture(device, width, height);
  }

  device.queue.copyExternalImageToTexture(
    { source: video, flipY: true },
    { texture },
    [width, height],
  );

  let ratio = width / height;
  if (isNaN(ratio)) ratio = 1;

  return { texture, ratio };
}

export function createWebGPUHDRTexture(
  device: GPUDevice,
  hdrData: { width: number; height: number; data: Float32Array },
): { texture: GPUTexture; ratio: number } {
  const pixelCount = hdrData.width * hdrData.height;
  const rgba = new Float32Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    rgba[i * 4] = hdrData.data[i * 3];
    rgba[i * 4 + 1] = hdrData.data[i * 3 + 1];
    rgba[i * 4 + 2] = hdrData.data[i * 3 + 2];
    rgba[i * 4 + 3] = 1.0;
  }

  const texture = device.createTexture({
    size: [hdrData.width, hdrData.height],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    rgba,
    { bytesPerRow: hdrData.width * 4 * 4 },
    [hdrData.width, hdrData.height],
  );

  return { texture, ratio: hdrData.width / hdrData.height };
}

export function uploadWebGPUCanvasTexture(
  device: GPUDevice,
  canvas: HTMLCanvasElement,
  existingTexture?: GPUTexture | null,
): GPUTexture {
  let texture = existingTexture ?? null;

  if (
    !texture ||
    texture.width !== canvas.width ||
    texture.height !== canvas.height
  ) {
    if (texture) texture.destroy();
    texture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  // Use canvas directly as source (no async createImageBitmap needed)
  device.queue.copyExternalImageToTexture(
    { source: canvas, flipY: true },
    { texture },
    [canvas.width, canvas.height],
  );

  return texture;
}

export function uploadWebGPUTextSDFTexture(
  device: GPUDevice,
  sdfResult: { data: Float32Array; width: number; height: number },
  existingTexture?: GPUTexture | null,
): GPUTexture {
  let texture = existingTexture ?? null;

  if (
    !texture ||
    texture.width !== sdfResult.width ||
    texture.height !== sdfResult.height
  ) {
    if (texture) texture.destroy();
    texture = device.createTexture({
      size: [sdfResult.width, sdfResult.height],
      format: 'r32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
  }

  device.queue.writeTexture(
    { texture },
    sdfResult.data,
    { bytesPerRow: sdfResult.width * 4 },
    [sdfResult.width, sdfResult.height],
  );

  return texture;
}

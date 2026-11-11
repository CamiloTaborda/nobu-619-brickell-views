/**
 * Compone una vista fuera del hilo principal: descarga los tiles, los decodifica
 * y los une en un ImageBitmap listo para la GPU, sin recomprimir la imagen.
 * El resultado va invertido en vertical porque WebGL ignora flipY en los ImageBitmap.
 */

export interface ComposeRequest {
  id: number;
  width: number;
  height: number;
  tiles: { url: string; x: number; y: number }[];
}
export interface CancelRequest {
  cancel: number;
}
export type ComposeResponse = { id: number; bitmap: ImageBitmap } | { id: number; error: 'aborted' | 'failed' };

const MAX_CONCURRENT_TILES = 16;
const TILE_RETRIES = 1;

const running = new Map<number, AbortController>();

async function loadTile(url: string, signal: AbortSignal, retries = TILE_RETRIES): Promise<ImageBitmap> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`tile ${response.status}`);
    return await createImageBitmap(await response.blob());
  } catch (error) {
    if (signal.aborted || retries === 0) throw error;
    return loadTile(url, signal, retries - 1);
  }
}

async function compose({ id, width, height, tiles }: ComposeRequest) {
  const controller = new AbortController();
  running.set(id, controller);
  try {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: false })!;
    context.setTransform(1, 0, 0, -1, 0, height);

    let next = 0;
    const lane = async () => {
      while (next < tiles.length) {
        const tile = tiles[next++];
        const image = await loadTile(tile.url, controller.signal);
        context.drawImage(image, tile.x, tile.y);
        image.close();
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_TILES, tiles.length) }, lane));

    const bitmap = canvas.transferToImageBitmap();
    postMessage({ id, bitmap } satisfies ComposeResponse, { transfer: [bitmap] });
  } catch {
    postMessage({ id, error: controller.signal.aborted ? 'aborted' : 'failed' } satisfies ComposeResponse);
  } finally {
    running.delete(id);
  }
}

addEventListener('message', ({ data }: MessageEvent<ComposeRequest | CancelRequest>) => {
  if ('cancel' in data) running.get(data.cancel)?.abort();
  else void compose(data);
});

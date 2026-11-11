/**
 * Entrega al visor una imagen ya decodificada en lugar de una URL, evitando
 * volver a descargarla y descomprimirla en el hilo principal.
 */
import { EquirectangularAdapter, utils, type EquirectangularPanorama, type PanoData } from '@photo-sphere-viewer/core';
import type { StitchResult } from '../../lib/stitch';

interface StitchedPanorama extends EquirectangularPanorama {
  path: string;
  bitmap: ImageBitmap;
  data: PanoData;
}

export const toPanorama = (image: StitchResult): StitchedPanorama => ({ path: image.key, bitmap: image.bitmap, data: image.panoData });

export class StitchedAdapter extends EquirectangularAdapter {
  override async loadTexture(panorama: string | EquirectangularPanorama) {
    const { bitmap, data, path } = panorama as StitchedPanorama;
    const texture = utils.createTexture(bitmap as unknown as HTMLImageElement);
    texture.flipY = false; // el Worker ya entrega la imagen invertida
    return { panorama, texture, panoData: utils.mergePanoData(bitmap.width, bitmap.height, data), cacheKey: path };
  }
}
